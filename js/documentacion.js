// documentacion.js — Módulo 2: Levantamiento dinámico + Fases Antes/Durante/Después

import { projects } from './db.js';
import { esc, fotoMini, toast, calcFaseEstado, countFotos } from './utils.js';
import { renderFirmaBlock } from './project.js';
import { canEdit } from './auth.js';
import { icon } from './icons.js';
import { getExecBlocks } from '../modules/checklist/index.js';
import { renderSitio, _countCierreExtra } from './doc-sitio.js';
import { renderCamposDinamicos } from './lev-campos.js';
import { _renderAreasTecho, _sujecionPorTecho } from './lev-areas.js';
import { _TMIN_CIUDADES, _TMIN_ZONAS, _TMIN_ZONA_DESC, _tminDescripcion } from './lev-tmin.js';
import { renderNotasDoc } from './lev-notas.js';
import './lev-guardar.js';

// ── Estado centralizado del levantamiento ─────────────────────────────────────
// Expuesto en window._lev para que los inline handlers del HTML puedan mutar
// los arrays directamente (oninput="_lev.aparatos[0].nombre=this.value").
// NUNCA reasignar _lev — solo mutar sus propiedades.
const _lev = {
  aparatos:    [],
  cargas:      { critica: [], secundaria: [] },
  recibos:     [],
  camposLibres:[],
  areasTecho:  [],
  pid:         '',
};
window._lev = _lev;

// ── Secciones de ejecución por sitio ──────────────────────────────────────────
const EXEC_POR_SITIO = {
  techo:          ['struct', 'canal', 'cable-dc'],
  centrosCarga:   ['cfe'],
  zonaDelSistema: ['prot-dc', 'inversor', 'controlador', 'equipo', 'baterias', 'bomba', 'cierre'],
};

// ── Vista principal — Progreso de obra ────────────────────────────────────────
export async function renderDocumentacion(projectId, session) {
  const project = await projects.getById(projectId);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';
  const edit = canEdit(session, project);
  const cl   = project.checklistData || {};
  const techo = project.projectConfig?.techo || cl.techo || 'cemento';

  // Contar fotos por sitio para badges del tab
  const fases = project.documentacion?.fases || {};
  const cTecho   = ['antes','durante','cierre'].reduce((s,f) => s + countFotos(fases,'techo',f), 0)
    + _countCierreExtra(project, 'techo');
  const cCentros = ['antes','durante','cierre'].reduce((s,f) => s + countFotos(fases,'centrosCarga',f), 0)
    + _countCierreExtra(project, 'centrosCarga');
  const cZona    = ['antes','durante','cierre'].reduce((s,f) => s + countFotos(fases,'zonaDelSistema',f), 0)
    + _countCierreExtra(project, 'zonaDelSistema');
  const cNotas   = (project.documentacion?.notas || []).length;

  // Exec blocks por sección
  const allExecBlocks = getExecBlocks(project.tipoSistema, techo);
  const _exCount = (sitio) => {
    const items = allExecBlocks.filter(b => EXEC_POR_SITIO[sitio]?.includes(b.id)).flatMap(b => b.items);
    return { done: items.filter(it => cl.exec?.[it.id]).length, total: items.length };
  };
  const exT = _exCount('techo');
  const exC = _exCount('centrosCarga');
  const exZ = _exCount('zonaDelSistema');

  const _badge = (fotos, ex) => {
    if (!fotos && !ex.total) return '';
    if (fotos > 0 && ex.total > 0 && ex.done === ex.total) return `<span class="tab-badge tab-ok">✓</span>`;
    const parts = [];
    if (fotos)    parts.push(`${fotos}📷`);
    if (ex.total) parts.push(`${ex.done}/${ex.total}`);
    return `<span class="tab-badge">${parts.join(' · ')}</span>`;
  };

  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}')">
      ${icon('caret-left')}
    </button>
    <h1 class="hdr-title">Progreso de obra</h1>
    <span class="hdr-sub">${esc(project.displayId)}</span>
  </div>

  <div class="tab-bar" id="doc-tabs" role="tablist" aria-label="Secciones de progreso de obra">
    <button class="tab-btn tab-active" role="tab" aria-selected="true"  aria-controls="d-techo"   tabindex="0"  data-tab="d-techo"   onclick="switchTab('doc-tabs','d-techo',this)">
      🏠 Techo${_badge(cTecho, exT)}
    </button>
    <button class="tab-btn" role="tab" aria-selected="false" aria-controls="d-centros" tabindex="-1" data-tab="d-centros" onclick="switchTab('doc-tabs','d-centros',this)">
      ⚡ Centros${_badge(cCentros, exC)}
    </button>
    <button class="tab-btn" role="tab" aria-selected="false" aria-controls="d-zona"    tabindex="-1" data-tab="d-zona"    onclick="switchTab('doc-tabs','d-zona',this)">
      🔌 Zona${_badge(cZona, exZ)}
    </button>
    <button class="tab-btn" role="tab" aria-selected="false" aria-controls="d-notas"   tabindex="-1" data-tab="d-notas"   onclick="switchTab('doc-tabs','d-notas',this)">
      ${icon('note', 14)} Notas${cNotas ? `<span class="tab-badge tab-ok">${cNotas}</span>` : ''}
    </button>
  </div>

  <!-- Techo -->
  <div id="d-techo" class="tab-panel tab-panel-active">
    ${renderSitio(project, 'techo', edit, projectId)}
    ${renderExecPorSitio(project, 'techo', allExecBlocks, edit)}
  </div>

  <!-- Centros de carga -->
  <div id="d-centros" class="tab-panel">
    ${renderSitio(project, 'centrosCarga', edit, projectId)}
    ${renderExecPorSitio(project, 'centrosCarga', allExecBlocks, edit)}
  </div>

  <!-- Zona del sistema -->
  <div id="d-zona" class="tab-panel">
    ${renderSitio(project, 'zonaDelSistema', edit, projectId)}
    ${renderExecPorSitio(project, 'zonaDelSistema', allExecBlocks, edit)}
  </div>

  <!-- Notas -->
  <div id="d-notas" class="tab-panel">
    <div class="card">
      <div class="card-title-row">
        <h3 class="card-title">Notas de progreso</h3>
        ${edit ? `<button class="btn-sm btn-outline" onclick="_showNotaDoc('${projectId}')">+ Nota</button>` : ''}
      </div>
      <div id="dnotas-list">
        ${renderNotasDoc(project.documentacion?.notas || [], session, projectId)}
      </div>
      <div id="dnotas-form" style="display:none" class="nota-form">
        <textarea id="dnotas-texto" rows="3" placeholder="Escribe tu nota…" class="textarea-field"></textarea>
        <div class="nota-form-actions">
          <button class="btn-outline btn-sm" onclick="document.getElementById('dnotas-form').style.display='none'">Cancelar</button>
          <button class="btn-primary btn-sm" onclick="_submitNotaDoc('${projectId}')">Guardar nota</button>
        </div>
      </div>
    </div>
  </div>
  ${(() => {
    const fe = calcFaseEstado(project);
    return renderFirmaBlock(project, projectId, 'doc', session, {
      ready: fe.docPct === 100,
      hint:  `Faltan: ${fe.docFaltantes.join(', ')}`,
    });
  })()}

  <script>
    (function() {
      const tabTarget   = sessionStorage.getItem('doc-tab-target');
      const subfaTarget = sessionStorage.getItem('doc-subfa-target');
      sessionStorage.removeItem('doc-tab-target');
      sessionStorage.removeItem('doc-subfa-target');
      sessionStorage.removeItem('doc-sitio-target');
      if (tabTarget) {
        const tabBtn = document.querySelector('[data-tab="' + tabTarget + '"]');
        if (tabBtn) tabBtn.click();
      }
      if (subfaTarget && tabTarget) {
        const sitioMap = { 'd-techo':'techo', 'd-centros':'centrosCarga', 'd-zona':'zonaDelSistema' };
        const sitio = sitioMap[tabTarget] || 'techo';
        setTimeout(() => {
          const btn = document.getElementById('sf-btn-' + sitio + '-' + subfaTarget);
          if (btn) btn.click();
        }, 50);
      }
    })();
  </script>
  `;
}

// ── Ejecución por sección (bloques del checklist integrados en Progreso de obra) ─
function renderExecPorSitio(project, sitio, allExecBlocks, edit) {
  const cl     = project.checklistData || {};
  const blocks = allExecBlocks.filter(b => EXEC_POR_SITIO[sitio]?.includes(b.id));
  if (!blocks.length) return '';
  const allItems = blocks.flatMap(b => b.items);
  const done     = allItems.filter(it => cl.exec?.[it.id]).length;
  const total    = allItems.length;
  const pct      = total ? Math.round(done / total * 100) : 0;
  const pid      = project.id;

  const _item = (it) => {
    const savedVal = cl.execText?.[it.id] || '';
    if (it.isNav) return `
      <label class="cl-item ${cl.exec?.[it.id] ? 'cl-item-done' : ''}">
        <input type="checkbox" ${cl.exec?.[it.id] ? 'checked' : ''} ${!edit ? 'disabled' : ''}
          onchange="this.closest('.cl-item').classList.toggle('cl-item-done',this.checked);clToggleExec('${pid}','${it.id}',this.checked)">
        <div class="cl-item-text" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <span class="cl-item-name">${esc(it.n)}</span>
          <button class="btn-outline btn-sm" style="flex-shrink:0"
            onclick="event.preventDefault();event.stopPropagation();navigate('#${esc(it.navRoute)}/${pid}')">Ir →</button>
        </div>
      </label>`;
    return `
      <label class="cl-item ${cl.exec?.[it.id] ? 'cl-item-done' : ''}">
        <input type="checkbox" ${cl.exec?.[it.id] ? 'checked' : ''} ${!edit ? 'disabled' : ''}
          onchange="this.closest('.cl-item').classList.toggle('cl-item-done',this.checked);clToggleExec('${pid}','${it.id}',this.checked)">
        <div class="cl-item-text" style="width:100%">
          <span class="cl-item-name">${esc(it.n)}</span>
          ${it.hasInput ? `<div style="margin-top:6px">
            <input type="text" class="torq-input" style="max-width:180px"
              placeholder="${esc(it.inputPlaceholder||'Valor medido')}" ${!edit ? 'disabled' : ''}
              value="${esc(savedVal)}"
              onchange="clSaveExecText('${pid}','${it.id}',this.value)"
              onclick="event.stopPropagation()">
          </div>` : ''}
        </div>
      </label>`;
  };

  return `
  <div class="card exec-section">
    <div class="card-title-row">
      <h3 class="card-title">Ejecución</h3>
      <span class="cl-prog-lbl">${done}/${total}</span>
    </div>
    <div class="cl-prog-bar-wrap">
      <div class="cl-prog-bar${pct===100?' cl-prog-done':''}" style="width:${pct}%"></div>
    </div>
    ${blocks.map(block => {
      const bd = block.items.filter(it => cl.exec?.[it.id]).length;
      const bt = block.items.length;
      const ok = bd === bt;
      return `
      <details class="cl-exec-block" ${ok ? '' : 'open'}>
        <summary class="cl-exec-block-hdr">
          <span class="cl-exec-block-title">${esc(block.label)}</span>
          <span class="cl-exec-block-badge ${ok ? 'cl-exec-ok' : ''}">${ok ? '✓' : `${bd}/${bt}`}</span>
          <span class="cl-exec-caret">▾</span>
        </summary>
        <div class="cl-item-list" style="padding:0 4px 8px">
          ${block.items.map(_item).join('')}
        </div>
      </details>`;
    }).join('')}
  </div>`
;}

// ── Verificación de cierre — renderSitio y handlers viven en doc-sitio.js ─────


// ── Levantamiento dinámico ─────────────────────────────────────────────────────
function renderLevantamiento(project, tipo, edit) {
  const lev = project.documentacion?.levantamiento || {};
  const dis = edit ? '' : 'disabled';
  const pid = project.id;
  _lev.pid = pid;
  // Sincronizar state de áreas del techo (preserva fotos si existen)
  _lev.areasTecho = (lev.areasTecho || []).map(a => {
    let fotos;
    if (Array.isArray(a.fotos)) {
      fotos = [...a.fotos];
    } else if (a.fotos && typeof a.fotos === 'object') {
      // Migrar estructura antigua {antes,durante,cierre} → array plano
      fotos = [...(a.fotos.antes||[]), ...(a.fotos.durante||[]), ...(a.fotos.cierre||[])];
    } else {
      fotos = [];
    }
    return { ...a, fotos };
  });

  // Reinicializar estado de módulo con datos del proyecto (evita estado stale entre navegaciones)
  _lev.camposLibres = [...(lev.camposLibres || [])];
  _lev.cargas = {
    critica:    [...(lev.cargasCriticas   || lev.cargasRespaldo || [])],
    secundaria: [...(lev.cargasSecundarias || [])],
  };

  // Detectar si secciones tienen datos para abrir acordeón pre-llenado
  const hasSitio      = !!(lev.tipTecho || (lev.areasTecho?.length > 0));
  const hasElecConsumo= !!(lev.tipoServicioCFE || lev.tierraFisica || lev.centroCarga ||
                           lev.recibos?.length || lev.aparatos?.length || lev.tarifaCFE ||
                           lev.autonomia || lev.cargasCriticas?.length);
  const hasSombras    = !!(lev.sombras?.checklist?.length || lev.sombras?.foto || lev.sombras?.notas);
  const hasNotas      = !!(lev.observacionesGenerales);

  // Helper para wrapper de acordeón
  const acc = (id, title, emoji, open, content) => `
    <div class="accordion-section">
      <button type="button" class="accordion-toggle ${open ? 'acc-open' : ''}"
              onclick="toggleAcc(this,'acc-${id}')">
        <span class="acc-icon">${emoji}</span>
        <span class="acc-title">${title}</span>
        <span class="acc-arrow">▾</span>
      </button>
      <div id="acc-${id}" class="accordion-body ${open ? '' : 'acc-collapsed'}">
        ${content}
      </div>
    </div>`;

  // Campos dinámicos según tipo de sistema
  const dinamico = renderCamposDinamicos(tipo, lev, edit, pid);

  return `
  <form id="form-levantamiento" onsubmit="guardarLevantamiento(event,'${pid}')"
        ${edit ? `oninput="_levAutoSave('${pid}')" onchange="_levAutoSave('${pid}')"` : ''}>

    <div class="lev-cliente-card">
      <div class="form-row">
        <div class="form-group">
          <label>Nombre del cliente</label>
          <input type="text" name="lev_clientName" value="${esc(project.clientName||'')}"
                 placeholder="Nombre completo del cliente" ${dis}/>
        </div>
        <div class="form-group">
          <label>Alias / nombre del proyecto <span class="form-hint">opcional</span></label>
          <input type="text" name="lev_nombreProyecto" value="${esc(project.nombreProyecto||'')}"
                 placeholder="Ej: Casa bonita, Rancho norte…" ${dis}/>
        </div>
      </div>
    </div>

    ${acc('sitio', 'Datos del techo y sitio', '🏠', true, `
      <div class="form-row">
        <div class="form-group"><label>Tipo de techo</label>
          <select name="tipTecho" ${dis} onchange="window._onTipTechoChange(this)">
            ${['Losa de concreto','Lámina','Metálico','Madera','Otro'].map(t=>
              `<option ${lev.tipTecho===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Sujeción / anclaje</label>
          <div id="sujecion-label" class="input-info-badge">
            ${_sujecionPorTecho(lev.tipTecho)}
          </div>
        </div>
      </div>
      <!-- Estado del techo — solo visible cuando tipo = Madera -->
      <div id="madera-fields" style="display:${lev.tipTecho==='Madera'?'':'none'}">
        <div class="form-row">
          <div class="form-group"><label>Estado de la madera</label>
            <select name="estadoMadera" ${dis}>
              ${['Nueva (< 2 años)','Buena (2–10 años)','Regular (10–20 años)','Deteriorada (requiere revisión)'].map(t=>
                `<option ${lev.estadoMadera===t?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Distancia entre vigas (cm)</label>
            <input type="number" name="distVigas" value="${lev.distVigas||''}"
                   placeholder="40–60 típico BCS" min="10" max="150" ${dis}/>
          </div>
        </div>
      </div>
      <!-- Temperatura mínima del sitio — colapsable -->
      <details class="pd-details" ${lev.tMinCiudad ? 'open' : ''}>
        <summary>Temperatura mínima del sitio <span class="pd-caret">▾</span></summary>
        <div class="pd-body">
      <div class="form-row">
        <div class="form-group">
          <label>Estado de referencia (T mín)</label>
          <select name="tMinCiudad" ${dis} onchange="window._onTMinRecalc()">
            <option value="">— Seleccionar estado —</option>
            ${_TMIN_CIUDADES.map(c=>
              `<option value="${esc(c.nombre)}" data-tmin="${c.tMin}"
                ${(lev.tMinCiudad||lev.tMinEstado)===c.nombre?'selected':''}>${esc(c.nombre)} (${c.tMin}°C)</option>`
            ).join('')}
            <option value="otro" ${(lev.tMinCiudad||lev.tMinEstado)==='otro'?'selected':''}>Otro (manual)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Zona del sitio</label>
          <select name="tMinZona" ${dis} onchange="window._onTMinRecalc()">
            ${_TMIN_ZONAS.map(z=>
              `<option value="${z.key}" data-offset="${z.offset}"
                ${(lev.tMinZona||'valle')===z.key?'selected':''}>${z.label}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-row" id="lev-tmin-row">
        <div class="form-group">
          <label>T mín calculada del sitio (°C)
            <span class="form-hint">Usada en validación Voc</span>
          </label>
          <input type="number" name="tMin" id="lev-tmin-input"
                 value="${lev.tMin ?? 3}" min="-20" max="30" step="0.5"
                 ${dis}
                 ${(lev.tMinCiudad && lev.tMinCiudad !== 'otro') && edit ? 'readonly' : ''}
                 style="background:${lev.tMinCiudad && lev.tMinCiudad !== 'otro' ? 'var(--surface2)' : ''}"/>
        </div>
        <div class="form-group" id="lev-tmin-desglose" style="display:${lev.tMinCiudad && lev.tMinCiudad !== 'otro' ? 'flex' : 'none'}">
          <label>Desglose</label>
          <div class="input-info-badge tmin-desglose" id="lev-tmin-desc">
            ${_tminDescripcion(lev.tMinCiudad, lev.tMinZona, lev.tMin)}
          </div>
        </div>
      </div>
      <!-- Tabla de referencia de zonas -->
      <div class="tmin-ref-wrap">
        <button type="button" class="tmin-ref-toggle" onclick="this.parentElement.classList.toggle('open')">
          ${icon('info', 13)} Referencia de zonas — ¿cómo afecta al T mín? <span class="tmin-ref-caret">▸</span>
        </button>
        <div class="tmin-ref-body">
          <p class="tmin-ref-intro">El T mín se calcula como: <strong>estado base + ajuste por zona</strong>. Ejemplo con BCS (3°C):</p>
          <table class="tmin-ref-table">
            <thead><tr><th>Zona</th><th>Ajuste</th><th>T mín (BCS)</th><th>Descripción</th></tr></thead>
            <tbody>
              ${_TMIN_ZONAS.map(z => {
                const ej = 3 + z.offset;
                const signo = z.offset >= 0 ? `+${z.offset}` : `${z.offset}`;
                return `<tr>
                  <td>${z.label}</td>
                  <td class="tmin-ref-offset ${z.offset > 0 ? 'pos' : z.offset < 0 ? 'neg' : 'zer'}">${signo}°C</td>
                  <td class="tmin-ref-val">${ej}°C</td>
                  <td class="tmin-ref-desc">${_TMIN_ZONA_DESC[z.key]}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          <p class="tmin-ref-note">💡 Si el sitio está en un microclima muy particular (cañón, laguna, cerro aislado), usa <em>Otro (manual)</em> para ingresar el valor real.</p>
        </div>
      </div>
        </div><!-- /.pd-body -->
      </details>
      <!-- Áreas del techo — repetibles -->
      <div class="lev-areas-wrap">
        <div class="lev-areas-hdr">
          <span class="lev-areas-title">Áreas del techo</span>
          ${edit ? `<button type="button" class="btn-sm btn-outline" onclick="window._addAreaTecho()">+ Área</button>` : ''}
        </div>
        <div id="lev-areas-list">
          ${_renderAreasTecho(lev.areasTecho || [], edit, pid)}
        </div>
        ${(lev.areasTecho||[]).length === 0 && !edit ? `<p style="font-size:.78rem;color:var(--text-muted);padding:8px 0">Sin áreas registradas</p>` : ''}
      </div>
      <!-- Ubicación GPS -->
      <div class="form-row" style="align-items:flex-end;gap:10px;margin-top:8px">
        <div class="form-group" style="flex:1;margin:0">
          <label>${icon('map-pin',14)} Ubicación GPS <span class="form-hint">opcional</span></label>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${lev.gpsLat && lev.gpsLng
              ? `<span class="input-info-badge" style="font-size:.75rem">${lev.gpsLat.toFixed(5)}, ${lev.gpsLng.toFixed(5)}</span>
                 <a href="https://maps.google.com/?q=${lev.gpsLat},${lev.gpsLng}" target="_blank" rel="noopener"
                    class="btn-outline btn-sm" style="text-decoration:none">
                   ${icon('map-trifold',14)} Ver en mapa
                 </a>
                 ${edit ? `<button type="button" class="btn-del-sm" onclick="_clearGps('${pid}')" title="Quitar GPS">✕</button>` : ''}`
              : (edit ? `<button type="button" class="btn-outline btn-sm" onclick="_captureGps('${pid}')">
                   ${icon('map-pin',14)} Capturar ubicación
                 </button>` : '<span style="color:var(--text-muted);font-size:.8rem">Sin GPS</span>')}
          </div>
        </div>
      </div>

      <!-- Fotos del levantamiento -->
      <div class="foto-tecnica-row" style="margin-top:12px">
        <div class="ft-label">${icon('camera',14)} Fotos del levantamiento</div>
        <div id="slot-fotos-lev" class="ft-slot" style="flex-wrap:wrap;gap:6px">
          ${(lev.fotosLevantamiento||[]).map((f,i)=>
            `${fotoMini(f.url||f,'Foto '+(i+1))}${edit?`<button type="button" class="btn-del-foto" onclick="delFotoLev('${pid}',${i})">✕</button>`:''}`
          ).join('')}
          ${edit ? `<button type="button" class="btn-foto-sm" onclick="capFotoLev('${pid}')">${icon('camera')} Agregar foto</button>` : ''}
        </div>
      </div>
    `)}

    ${acc('sombras', 'Análisis de sombras', '🌿', hasSombras, `
      <div class="sombras-check">
        ${['Árboles','Tinacos','Antenas','Edificios','Postes','Otra'].map(s=>`
          <label class="check-chip ${(lev.sombras?.checklist||[]).includes(s)?'check-active':''}">
            <input type="checkbox" name="sombra_${s}" ${dis}
              ${(lev.sombras?.checklist||[]).includes(s)?'checked':''} value="${s}"
              onchange="this.closest('.check-chip').classList.toggle('check-active',this.checked)">
            ${s}
          </label>`).join('')}
      </div>
      <div class="foto-tecnica-row" style="margin-top:10px">
        <div class="ft-label">Foto de fuente de sombra (opcional)</div>
        <div class="ft-slot">
          ${lev.sombras?.foto
            ? `${fotoMini(lev.sombras.foto,'Sombra')}<button type="button" class="btn-del-foto" onclick="delSombraFoto('${pid}')">✕</button>`
            : (edit ? `<button type="button" class="btn-foto-sm" onclick="capSombraFoto('${pid}')">${icon('camera')} Foto</button>` : '—')}
        </div>
      </div>
      <div class="form-group" style="margin-top:8px">
        <label>Notas de sombras</label>
        <textarea name="sombraNotas" rows="2" ${dis}>${esc(lev.sombras?.notas||'')}</textarea>
      </div>
    `)}

    ${/* Eléctrico y consumo — no aplica para sistema_pequeno ni otro */
      !['sistema_pequeno','otro'].includes(tipo) ? acc('elec_consumo', 'Eléctrico y consumo', '⚡', hasElecConsumo, `
      <div class="form-group"><label>Tipo de servicio CFE</label>
        <select name="tipoServicioCFE" ${dis}>
          ${tipo==='aislado'?'<option value="NA">N/A (sin CFE)</option>':''}
          ${['Monofásico 127V','Monofásico 220V','Bifásico','Trifásico','N/A (sin CFE)'].map(t=>
            `<option ${lev.tipoServicioCFE===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Tierra física</label>
          <select name="tierraFisica" ${dis}>
            ${['Existe','No existe','Deficiente'].map(t=>
              `<option ${lev.tierraFisica===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Centro de carga — estado</label>
          <select name="centroCarga" ${dis}>
            ${['Disponible','Saturado','Requiere actualización','N/A'].map(t=>
              `<option ${lev.centroCarga===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <details class="pd-details" ${(lev.marcaTablero || lev.tipoTablero) ? 'open' : ''}>
        <summary>Detalles del tablero <span class="pd-caret">▾</span></summary>
        <div class="pd-body">
          <div class="form-row">
            <div class="form-group">
              <label>Tipo de montaje</label>
              <select name="tipoTablero" ${dis}>
                ${['','Empotrado (flush)','Superficie','N/A'].map(t=>
                  `<option ${(lev.tipoTablero||'')===(t)?'selected':''}>${t}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Sistema / breakers compatibles
                <span class="form-hint">define qué breakers comprar</span>
              </label>
              <select name="marcaTablero" ${dis}>
                ${['','Square D','Murray','Riel DIN','Otro'].map(t=>
                  `<option ${(lev.marcaTablero||'')===(t||'')?'selected':''}>${t}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Capacidad <span class="form-hint">polos / espacios</span></label>
              <input type="text" name="capacidadTablero" value="${esc(lev.capacidadTablero||'')}"
                     placeholder="Ej: 12 polos" list="cap-tablero-list" ${dis}/>
              <datalist id="cap-tablero-list">
                ${[4,6,8,10,12,16,20,24,30,40].map(n=>`<option value="${n} polos">`).join('')}
              </datalist>
            </div>
          </div>
        </div>
      </details>
      ${dinamico ? `<div class="lev-sep"></div>${dinamico}` : ''}
    `) : ''}

    ${acc('notas', 'Notas del levantamiento', '📝', hasNotas, `
      <div class="form-group">
        <label>Observaciones generales</label>
        <textarea name="observacionesGenerales" rows="3" ${dis}
          placeholder="Condiciones especiales del sitio, acuerdos con el cliente, materiales extra, pendientes…"
        >${esc(lev.observacionesGenerales||'')}</textarea>
      </div>
      <details class="pd-details" ${lev.restricciones ? 'open' : ''}>
        <summary>Restricciones especiales <span class="pd-caret">▾</span></summary>
        <div class="pd-body">
          <div class="form-group">
            <label>Restricciones <span class="form-hint">para la memoria técnica</span></label>
            <textarea name="restricciones" rows="2" ${dis}
              placeholder="Ej. Alta salinidad por ambiente marino / Vientos de 180 km/h en temporada de huracanes / Sin conexión a CFE"
            >${esc(lev.restricciones||'')}</textarea>
          </div>
        </div>
      </details>
    `)}

    ${edit?`<div class="form-actions lev-actions">
      <span id="lev-autosave" class="autosave-indicator"></span>
      <button type="submit" class="btn-primary">Guardar levantamiento</button>
    </div>`:''}
  </form>`;
}

// ── Campos libres ─────────────────────────────────────────────────────────────
// state en window._lev.camposLibres
window.addCampoLibre = function() {
  _lev.camposLibres.push({nombre:'',valor:''});
  const el = document.getElementById('campos-libres');
  const i = _lev.camposLibres.length - 1;
  const div = document.createElement('div');
  div.className = 'campo-libre-row';
  div.innerHTML = `
    <input type="text" placeholder="Nombre" oninput="_lev.camposLibres[${i}].nombre=this.value"/>
    <input type="text" placeholder="Valor" oninput="_lev.camposLibres[${i}].valor=this.value"/>
    <button type="button" class="btn-del-sm" onclick="delCampoLibre(${i})">✕</button>`;
  el.appendChild(div);
};
window.updCampoLibre = function(i,k,v) { if(_lev.camposLibres[i]) _lev.camposLibres[i][k]=v; };
window.delCampoLibre = function(i) { _lev.camposLibres.splice(i,1); navigate(window.location.hash); };

// ── Exec toggle — disponibles aquí para cuando Progreso de obra se carga sin checklist.js
{
  let _docExecTextTimer = null;
  window.clToggleExec   = (pid, id, v)   => projects.setField(pid, `checklistData.exec.${id}`, v);
  window.clSaveExecText = (pid, id, val) => {
    clearTimeout(_docExecTextTimer);
    _docExecTextTimer = setTimeout(() => projects.setField(pid, `checklistData.execText.${id}`, val), 600);
  };
}

// ── Levantamiento como vista standalone ────────────────────────────────────────
export async function renderLevantamientoView(projectId, session) {
  const project = await projects.getById(projectId);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';
  const edit = canEdit(session, project);
  const tipo = project.tipoSistema || 'otro';

  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}')">
      ${icon('caret-left')}
    </button>
    <h1 class="hdr-title">Levantamiento</h1>
    <span class="hdr-sub">${esc(project.displayId)}</span>
    <button class="btn-outline btn-sm" onclick="exportarWordLevantamiento('${projectId}')" title="Descargar Word del levantamiento">
      ${icon('file-arrow-down', 15)} Word
    </button>
  </div>

  <div class="lev-standalone">
    ${renderLevantamiento(project, tipo, edit)}
  </div>`;
}

// ── GPS capture / clear ────────────────────────────────────────────────────────
window._captureGps = function(projectId) {
  if (!navigator.geolocation) { toast('GPS no disponible en este dispositivo', 'warn'); return; }
  toast('Obteniendo ubicación…');
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = parseFloat(pos.coords.latitude.toFixed(6));
      const lng = parseFloat(pos.coords.longitude.toFixed(6));
      const p   = await projects.getById(projectId);
      p.documentacion = p.documentacion || {};
      p.documentacion.levantamiento = p.documentacion.levantamiento || {};
      p.documentacion.levantamiento.gpsLat = lat;
      p.documentacion.levantamiento.gpsLng = lng;
      await projects.update(projectId, { documentacion: p.documentacion });
      toast(`📍 GPS guardado: ${lat}, ${lng}`, 'success');
      navigate(window.location.hash);
    },
    () => toast('No se pudo obtener la ubicación — verifica los permisos', 'warn'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

window._clearGps = async function(projectId) {
  const p = await projects.getById(projectId);
  if (!p.documentacion?.levantamiento) return;
  p.documentacion.levantamiento.gpsLat = null;
  p.documentacion.levantamiento.gpsLng = null;
  await projects.update(projectId, { documentacion: p.documentacion });
  navigate(window.location.hash);
};
