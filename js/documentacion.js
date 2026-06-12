// documentacion.js — Módulo 2: Levantamiento dinámico + Fases Antes/Durante/Después

import { projects, logChange } from './db.js';
import { esc, fmtFechaHora, fotoMini, capturePhoto, toast, uuid, isoNow, confirmDialog, inputDialog, uploadProgressBar, calcFaseEstado, genDisplayId } from './utils.js';
import { renderFirmaBlock } from './project.js';
import { canEdit, isAdmin, isLider, getSession } from './auth.js';
import { uploadPhotoQueued } from './firebase.js';
import { icon } from './icons.js';
import { TMIN_ESTADOS, TMIN_ZONAS, TMIN_ZONA_DESC } from './clima.js';
import { calcVocPuro } from './garantia.js';
import { getExecBlocks } from '../modules/checklist/index.js';

// ── Mapeo sitio → tab ID y secciones de ejecución por sitio ──────────────────
const SITIO_TAB = {
  techo:          'd-techo',
  centrosCarga:   'd-centros',
  zonaDelSistema: 'd-zona',
};
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
  const _fpGet = (sitio, sub) => {
    if (fases?.[sitio]?.[sub]?.length) return fases[sitio][sub].length;
    if (sitio === 'techo') {
      const m = { antes:'antes', durante:'durante', cierre:'despues' };
      return (fases?.[m[sub]] || []).length;
    }
    return 0;
  };
  const cTecho   = ['antes','durante','cierre'].reduce((s,f) => s + _fpGet('techo',f), 0)
    + _countCierreExtra(project, 'techo');
  const cCentros = ['antes','durante','cierre'].reduce((s,f) => s + _fpGet('centrosCarga',f), 0)
    + _countCierreExtra(project, 'centrosCarga');
  const cZona    = ['antes','durante','cierre'].reduce((s,f) => s + _fpGet('zonaDelSistema',f), 0)
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

// ── Verificación de cierre (data en garantia.*, UI dentro de Fases → Cierre) ──
// Slots técnicos repartidos por sitio
const SLOTS_CIERRE_SITIO = {
  centrosCarga: [
    { key:'tableroAC',          label:'Tablero AC terminado',    req:true  },
    { key:'tableroDC',          label:'Tablero DC terminado',    req:true  },
    { key:'protecciones',       label:'Protecciones instaladas', req:false },
    { key:'puestaATierra',      label:'Puesta a tierra',         req:false },
  ],
  zonaDelSistema: [
    { key:'inversorEnergizado', label:'Inversor energizado',     req:true  },
    { key:'etiquetado',         label:'Etiquetado',              req:false },
  ],
};

// Obtener fotos técnicas (soporta legacy string y nuevo array)
function _getFT(g, key) {
  const v = (g.fotosTecnicas || {})[key];
  if (!v) return [];
  if (typeof v === 'string') return [{ url: v, id: 'legacy' }];
  return Array.isArray(v) ? v : [];
}

// Sitio al que pertenece cada slot técnico (para navegar de regreso)
function _sitioForFTKey(key) {
  return SLOTS_CIERRE_SITIO.centrosCarga.some(s => s.key === key) ? 'centrosCarga' : 'zonaDelSistema';
}

// Conteo de fotos de cierre (garantia.*) que se muestran en cada sitio
function _countCierreExtra(project, sitio) {
  const g = project.garantia || {};
  if (sitio === 'techo') {
    return (g.fotoSistema ? 1 : 0) + (g.fotosAdicionales || []).length;
  }
  return (SLOTS_CIERRE_SITIO[sitio] || []).reduce((s, slot) => s + _getFT(g, slot.key).length, 0);
}

// Bloque de cierre específico del sitio (se muestra arriba del grid de fotos libres)
function renderCierreSitio(project, sitio, edit, projectId) {
  const g = project.garantia || {};

  if (sitio === 'techo') {
    return `
    <div class="card">
      <h3 class="card-title">Foto general del sistema <span class="req-badge">OBLIGATORIA</span></h3>
      <div class="foto-slot" id="slot-foto-sistema-doc">
        ${g.fotoSistema
          ? `${fotoMini(g.fotoSistema,'Foto general')}
             ${edit ? `<button class="btn-del-foto" onclick="delFotoSistemaDoc('${projectId}')">✕</button>` : ''}`
          : (edit ? `<div class="empty-state">
              <div class="empty-state-icon">📷</div>
              <p class="empty-state-msg">Foto general del sistema terminado.</p>
              <button class="empty-state-cta" onclick="capFotoSistemaDoc('${projectId}')">
                ${icon('camera')} Tomar foto</button>
             </div>` : '<p class="empty-msg-sm">Sin foto.</p>')}
      </div>
    </div>
    ${(g.fotosAdicionales || []).length ? `
    <div class="card">
      <div class="card-title-row">
        <h3 class="card-title">Fotos adicionales de cierre</h3>
        ${edit ? `<button class="btn-primary btn-sm" onclick="capFotoAdicionalDoc('${projectId}')">
          ${icon('camera')} Agregar</button>` : ''}
      </div>
      <div class="fotos-grid">
        ${(g.fotosAdicionales || []).map((f, i) => `
          <div class="foto-card">
            ${fotoMini(f.data, 'Foto '+(i+1))}
            ${f.nota ? `<p class="foto-nota">${esc(f.nota)}</p>` : ''}
            ${edit ? `
              <button class="btn-del-foto-abs" onclick="editFotoAdicionalDoc('${projectId}',${i})">✎</button>
              <button class="btn-del-foto" onclick="delFotoAdicionalDoc('${projectId}',${i})">✕</button>
            ` : ''}
          </div>`).join('')}
      </div>
    </div>` : ''}`;
  }

  const slots = SLOTS_CIERRE_SITIO[sitio] || [];
  if (!slots.length) return '';
  return `
  <div class="card">
    <h3 class="card-title">Fotos técnicas de cierre</h3>
    ${slots.map(s => {
      const fotos = _getFT(g, s.key);
      const tiene = fotos.length > 0;
      return `
      <div class="foto-tecnica-row">
        <div class="ft-label">
          <ph-icon name="${tiene ? 'check-circle' : 'circle'}" class="${tiene ? 'icon-ok' : 'icon-pending'}"></ph-icon>
          ${s.label}
          ${s.req ? '<span class="req-badge">OBLIG.</span>' : ''}
          ${tiene ? `<span class="ft-count">${fotos.length}</span>` : ''}
        </div>
        <div class="ft-fotos-grid">
          ${fotos.map((f, i) => `
            <div class="ft-foto-item">
              ${fotoMini(f.url, s.label)}
              ${edit ? `<button class="btn-del-foto-abs" onclick="delFotoTecnicaDoc('${projectId}','${s.key}',${i})">✕</button>` : ''}
            </div>`).join('')}
          ${edit ? `<button class="btn-foto-sm ft-add-btn" onclick="capFotoTecnicaDoc('${projectId}','${s.key}')">
            ${icon('camera')} ${tiene ? '+' : 'Tomar'}
          </button>` : (!tiene ? '<span class="ft-empty">—</span>' : '')}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// Handlers del Cierre — guardan en garantia.* y regresan a Progreso de obra → sitio → Cierre
function _gotoCierre(sitio) {
  sessionStorage.setItem('doc-tab-target',  SITIO_TAB[sitio] || 'd-techo');
  sessionStorage.setItem('doc-subfa-target', 'cierre');
}

window.capFotoSistemaDoc = function(projectId) {
  capturePhoto(async (b64) => {
    toast('Subiendo foto…');
    const result = await uploadPhotoQueued(b64, `projects/${projectId}/sistema.jpg`, projectId, 'fotoSistema');
    const p = await projects.getById(projectId);
    p.garantia = p.garantia || {};
    p.garantia.fotoSistema = result.url || null;
    if (result.pending) p.garantia._fotoSistemaPending = result.pendingId;
    await projects.update(projectId, { garantia: p.garantia });
    _gotoCierre('techo');
    navigate(`#proyecto/${projectId}/documentacion`);
    if (!result.pending) toast('✅ Foto guardada');
  });
};

window.delFotoSistemaDoc = async function(projectId) {
  if (!await confirmDialog('¿Eliminar foto del sistema?')) return;
  const p = await projects.getById(projectId);
  p.garantia.fotoSistema = null;
  await projects.update(projectId, { garantia: p.garantia });
  _gotoCierre('techo');
  navigate(`#proyecto/${projectId}/documentacion`);
};

window.capFotoTecnicaDoc = function(projectId, key) {
  capturePhoto(async (b64Array) => {
    const fotos = Array.isArray(b64Array) ? b64Array : [b64Array];
    const total = fotos.length;
    const prog = uploadProgressBar(total);
    const p = await projects.getById(projectId);
    p.garantia.fotosTecnicas = p.garantia.fotosTecnicas || {};
    const existentes = (() => {
      const v = p.garantia.fotosTecnicas[key];
      if (!v) return [];
      if (typeof v === 'string') return [{ url: v, id: 'legacy' }];
      return Array.isArray(v) ? v : [];
    })();
    for (let i = 0; i < total; i++) {
      prog.update(i + 1);
      const fid = uuid();
      const result = await uploadPhotoQueued(fotos[i],
        `projects/${projectId}/tecnica_${key}_${fid}.jpg`, projectId, 'fotoTecnica', { key, itemId: fid });
      existentes.push({ url: result.url || null, id: fid, createdAt: isoNow(),
        ...(result.pending && { pending: true, pendingId: result.pendingId }) });
    }
    prog.done();
    p.garantia.fotosTecnicas[key] = existentes;
    await projects.update(projectId, { garantia: p.garantia });
    _gotoCierre(_sitioForFTKey(key));
    navigate(`#proyecto/${projectId}/documentacion`);
    toast(`✅ ${total} foto${total > 1 ? 's' : ''} guardada${total > 1 ? 's' : ''}`);
  }, { multiple: true });
};

window.delFotoTecnicaDoc = async function(projectId, key, idx) {
  if (!await confirmDialog('¿Eliminar esta foto?')) return;
  const p = await projects.getById(projectId);
  const v = p.garantia.fotosTecnicas[key];
  const fotos = typeof v === 'string' ? [{ url: v, id: 'legacy' }] : (Array.isArray(v) ? v : []);
  fotos.splice(idx, 1);
  p.garantia.fotosTecnicas[key] = fotos.length ? fotos : null;
  await projects.update(projectId, { garantia: p.garantia });
  _gotoCierre(_sitioForFTKey(key));
  navigate(`#proyecto/${projectId}/documentacion`);
};

window.capFotoAdicionalDoc = function(projectId) {
  capturePhoto(async (b64Array) => {
    const fotos = Array.isArray(b64Array) ? b64Array : [b64Array];
    const total = fotos.length;
    const prog = uploadProgressBar(total);
    const nuevas = [];
    for (let i = 0; i < total; i++) {
      prog.update(i + 1);
      const fid = uuid();
      const result = await uploadPhotoQueued(fotos[i],
        `projects/${projectId}/adicional_${fid}.jpg`, projectId, 'fotoAdicional', { itemId: fid });
      nuevas.push({ data: result.url || (result.pending ? fotos[i] : null),
        nota: '', id: fid, createdAt: isoNow(),
        ...(result.pending && { pending: true, pendingId: result.pendingId }) });
    }
    prog.done();
    if (total === 1) nuevas[0].nota = await inputDialog('Nota para esta foto (opcional):', '') || '';
    const p = await projects.getById(projectId);
    p.garantia = p.garantia || {};
    p.garantia.fotosAdicionales = [...(p.garantia.fotosAdicionales || []), ...nuevas];
    await projects.update(projectId, { garantia: p.garantia });
    _gotoCierre('techo');
    navigate(`#proyecto/${projectId}/documentacion`);
    toast(`✅ ${total} foto${total > 1 ? 's guardadas' : ' guardada'}`);
  }, { multiple: true });
};

window.delFotoAdicionalDoc = async function(projectId, idx) {
  if (!await confirmDialog('¿Eliminar esta foto?')) return;
  const p = await projects.getById(projectId);
  p.garantia.fotosAdicionales.splice(idx, 1);
  await projects.update(projectId, { garantia: p.garantia });
  _gotoCierre('techo');
  navigate(`#proyecto/${projectId}/documentacion`);
};

window.editFotoAdicionalDoc = async function(projectId, idx) {
  const p = await projects.getById(projectId);
  const actual = p.garantia.fotosAdicionales[idx]?.nota || '';
  const nueva = await inputDialog('Editar nota:', actual);
  if (nueva === null) return;
  p.garantia.fotosAdicionales[idx].nota = nueva;
  await projects.update(projectId, { garantia: p.garantia });
  _gotoCierre('techo');
  navigate(`#proyecto/${projectId}/documentacion`);
};

// ── Levantamiento dinámico ─────────────────────────────────────────────────────
function renderLevantamiento(project, tipo, edit) {
  const lev = project.documentacion?.levantamiento || {};
  const dis = edit ? '' : 'disabled';
  const pid = project.id;
  _levPid = pid;
  // Sincronizar state de áreas del techo (preserva fotos si existen)
  _areasTecho = (lev.areasTecho || []).map(a => {
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
  _camposLibres = [...(lev.camposLibres || [])];
  _cargas = {
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
      <!-- Temperatura mínima del sitio -->
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
        <div class="form-group"><label>Centro de carga</label>
          <select name="centroCarga" ${dis}>
            ${['Disponible','Saturado','Requiere actualización','N/A'].map(t=>
              `<option ${lev.centroCarga===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Calibre cable DC <span class="form-hint">instalado</span></label>
          <select name="calibreCableDC" ${dis}>
            ${['','10 AWG','12 AWG','14 AWG','6 AWG','8 AWG','4 AWG','Otro'].map(t=>
              `<option ${(lev.calibreCableDC||'')===(t||'')?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Calibre cable AC <span class="form-hint">instalado</span></label>
          <select name="calibreCableAC" ${dis}>
            ${['','10 AWG','12 AWG','14 AWG','6 AWG','8 AWG','4 AWG','Otro'].map(t=>
              `<option ${(lev.calibreCableAC||'')===(t||'')?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Tipo de protección instalada</label>
          <select name="tipoProteccion" ${dis}>
            ${['','Interruptor termomagnético','Fusible','Ambos (DC fusible + AC interruptor)','Otro'].map(t=>
              `<option ${(lev.tipoProteccion||'')===(t||'')?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Circuito en tablero <span class="form-hint">número / identificador</span></label>
          <input type="text" name="circuitoTablero" value="${esc(lev.circuitoTablero||'')}"
                 placeholder="Ej: C-12, Breaker 3" ${dis}/>
        </div>
      </div>
      ${dinamico ? `<div class="lev-sep"></div>${dinamico}` : ''}
    `) : ''}

    ${acc('notas', 'Notas del levantamiento', '📝', hasNotas, `
      <div class="form-group">
        <label>Observaciones generales</label>
        <textarea name="observacionesGenerales" rows="3" ${dis}
          placeholder="Condiciones especiales del sitio, acuerdos con el cliente, materiales extra, pendientes…"
        >${esc(lev.observacionesGenerales||'')}</textarea>
      </div>
      <div class="form-group">
        <label>Restricciones especiales <span class="form-hint">para la memoria técnica</span></label>
        <textarea name="restricciones" rows="2" ${dis}
          placeholder="Ej. Alta salinidad por ambiente marino / Vientos de 180 km/h en temporada de huracanes / Sin conexión a CFE"
        >${esc(lev.restricciones||'')}</textarea>
      </div>
    `)}

    ${edit?`<div class="form-actions lev-actions">
      <span id="lev-autosave" class="autosave-indicator"></span>
      <button type="submit" class="btn-primary">Guardar levantamiento</button>
    </div>`:''}
  </form>`;
}

function renderCamposDinamicos(tipo, lev, edit, pid) {
  const dis = edit ? '' : 'disabled';
  if (tipo === 'interconectado' || tipo === 'hibrido' || tipo === 'hibrido_respaldo') {
    return `
    <div class="card">
      <h3 class="card-title">Tarifa CFE y contrato</h3>
      <div class="form-row">
        <div class="form-group">
          <label>Tarifa</label>
          <select name="tarifaCFE" ${dis}>
            ${['DAC','1','1A','1B','1C','1D','1E','1F','OM','OMF','PDBT','GDMT','Otra'].map(t=>
              `<option ${lev.tarifaCFE===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Demanda contratada (kW) <span class="form-hint">opcional</span></label>
          <input type="number" name="demandaKW" value="${lev.demandaKW||''}" min="0" step="0.5" placeholder="Ej. 5" ${dis}/>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Factor de potencia <span class="form-hint">opcional</span></label>
          <input type="number" name="factorPotencia" value="${lev.factorPotencia||''}" min="0.5" max="1" step="0.01" placeholder="Ej. 0.90" ${dis}/>
        </div>
        <div class="form-group">
          <label>Horario de uso</label>
          <select name="horarioUso" ${dis}>
            ${['Residencial 24h','Comercial diurno (9–19h)','Comercial nocturno','Agropecuario / rancho','Industrial'].map(t=>
              `<option ${lev.horarioUso===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <div class="card">
      <h3 class="card-title">Consumo del cliente</h3>
      <div class="chip-group" id="chip-consumo">
        <button type="button" class="chip ${(lev.modoConsumo||'recibo')==='recibo'?'chip-active':''}"
          onclick="setModoConsumo('recibo')">Con recibo CFE</button>
        <button type="button" class="chip ${lev.modoConsumo==='aparatos'?'chip-active':''}"
          onclick="setModoConsumo('aparatos')">Por aparatos</button>
      </div>
      <div id="panel-recibos" style="${lev.modoConsumo==='aparatos'?'display:none':''}">
        ${renderRecibos(lev.recibos||[], edit, pid)}
      </div>
      <div id="panel-aparatos" style="${lev.modoConsumo==='aparatos'?'':'display:none'}">
        ${renderAparatos(lev.aparatos||[], edit)}
      </div>
    </div>
    ${(tipo==='hibrido'||tipo==='hibrido_respaldo')?`
    <div class="card">
      <h3 class="card-title">Configuración híbrida</h3>
      <div class="form-row">
        <div class="form-group"><label>Autonomía requerida (horas)</label>
          <input type="number" name="autonomia" value="${lev.autonomia||''}" min="0" step="0.5" ${dis}/></div>
        <div class="form-group"><label>Banco de baterías (kWh)</label>
          <input type="number" name="bancoBaterias" value="${lev.bancoBaterias||''}" min="0" step="0.1" ${dis}/></div>
      </div>
    </div>`:''}`;
  }

  if (tipo === 'aislado') {
    return `
    <div class="card">
      <h3 class="card-title">Configuración Off-grid</h3>
      <div class="form-group"><label>Autonomía requerida (horas) <span class="req-badge">CRÍTICO</span></label>
        <input type="number" name="autonomia" value="${lev.autonomia||''}" min="0" step="0.5" ${dis}/></div>
      <div class="form-group"><label>Cargas críticas (Alta prioridad)</label>
        <div id="cargas-criticas">${renderCargas(lev.cargasCriticas||[],edit,'critica')}</div>
      </div>
      <div class="form-group"><label>Cargas secundarias (Baja prioridad)</label>
        <div id="cargas-secundarias">${renderCargas(lev.cargasSecundarias||[],edit,'secundaria')}</div>
      </div>
      <div class="form-group"><label>Generador de respaldo</label>
        <select name="generador" ${dis} onchange="toggleGenerador(this.value)">
          <option ${!lev.generador?'selected':''} value="no">No</option>
          <option ${lev.generador==='gasolina'?'selected':''} value="gasolina">Sí — Gasolina</option>
          <option ${lev.generador==='diesel'?'selected':''} value="diesel">Sí — Diésel</option>
          <option ${lev.generador==='gas'?'selected':''} value="gas">Sí — Gas LP</option>
        </select>
      </div>
      <div id="gen-extra" style="${!lev.generador?'display:none':''}">
        <div class="form-row">
          <div class="form-group"><label>Arranque</label>
            <select name="generadorArranque" ${dis}>
              <option ${lev.generadorArranque==='automatico'?'selected':''} value="automatico">Automático</option>
              <option ${lev.generadorArranque==='manual'?'selected':''} value="manual">Manual</option>
            </select>
          </div>
          <div class="form-group"><label>Potencia (kW)</label>
            <input type="number" name="generadorKw" value="${lev.generadorKw||''}" min="0" step="0.1" ${dis}/></div>
        </div>
      </div>
      <div class="form-group"><label>Crecimiento futuro esperado <span class="req-badge">CRÍTICO</span></label>
        <textarea name="crecimientoFuturo" rows="2" ${dis} placeholder="Ej: después pondrán minisplit…">${esc(lev.crecimientoFuturo||'')}</textarea>
      </div>
      <div class="form-group"><label>Condiciones ambientales</label>
        <div class="sombras-check">
          ${['Polvo','Salinidad costera','Calor extremo','Humedad alta','Viento fuerte','Otra'].map(c=>`
            <label class="check-chip ${(lev.condicionesAmbientales||[]).includes(c)?'check-active':''}">
              <input type="checkbox" name="cond_${c}" ${dis} value="${c}"
                ${(lev.condicionesAmbientales||[]).includes(c)?'checked':''}
                onchange="this.closest('.check-chip').classList.toggle('check-active',this.checked)"> ${c}
            </label>`).join('')}
        </div>
      </div>
    </div>`;
  }

  if (tipo === 'bombeo') {
    return `
    <div class="card">
      <h3 class="card-title">Bombeo solar</h3>
      <div class="form-row">
        <div class="form-group"><label>Tipo de bomba</label>
          <select name="tipoBomba" ${dis}>
            ${['Sumergible','Superficial','Periférica','Otra'].map(t=>
              `<option ${lev.tipoBomba===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Caudal requerido (L/h)</label>
          <input type="number" name="caudal" value="${lev.caudal||''}" min="0" ${dis}/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Profundidad del pozo (m)</label>
          <input type="number" name="profundidadPozo" value="${lev.profundidadPozo||''}" min="0" ${dis}/></div>
        <div class="form-group"><label>Horas de bombeo/día</label>
          <input type="number" name="horasBombeo" value="${lev.horasBombeo||''}" min="0" step="0.5" ${dis}/></div>
      </div>
    </div>`;
  }

  // 'respaldo' es legacy — los nuevos proyectos usan 'hibrido_respaldo'
  // Se mantiene por compatibilidad con datos anteriores
  if (tipo === 'respaldo') {
    return `
    <div class="card">
      <h3 class="card-title">Sistema de respaldo / Cargas</h3>
      <div class="form-group"><label>Tiempo de respaldo requerido (horas)</label>
        <input type="number" name="tiempoRespaldo" value="${lev.tiempoRespaldo||''}" min="0" step="0.5" ${dis}/></div>
      <div class="form-group"><label>Cargas a respaldar</label>
        <div id="cargas-criticas">${renderCargas(lev.cargasRespaldo||[],edit,'critica')}</div>
      </div>
    </div>`;
  }

  return ''; // tipo 'otro' — solo campos libres
}

// ── Recibos CFE ───────────────────────────────────────────────────────────────
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_FULL  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
window.MESES_FULL = MESES_FULL; // exponer para onchange inline

let _recibos = [];
function renderRecibos(recibos, edit, pid) {
  _recibos = [...recibos];
  const limite   = 12;
  const puedeAgregar = edit && _recibos.length < limite;
  const anioActual   = new Date().getFullYear();
  const anios        = [anioActual, anioActual-1, anioActual-2, anioActual-3];

  if (!recibos.length && !edit) return '<p class="empty-msg-sm">Sin recibos CFE capturados.</p>';

  // Resumen estadístico (a partir de 2 registros con kWh)
  const conKwh    = _recibos.filter(r => r.kwh > 0);
  const conImp    = _recibos.filter(r => r.importe > 0);
  const resumen   = conKwh.length >= 2 ? (() => {
    const avgKwh  = Math.round(conKwh.reduce((s,r)=>s+r.kwh,0)/conKwh.length);
    const avgImp  = conImp.length ? Math.round(conImp.reduce((s,r)=>s+r.importe,0)/conImp.length) : 0;
    const peak    = conKwh.reduce((a,b)=>a.kwh>b.kwh?a:b);
    const low     = conKwh.reduce((a,b)=>a.kwh<b.kwh?a:b);
    const peakLbl = peak.mes ? MESES_CORTO[peak.mes-1] + (peak.anio?' '+peak.anio:'') : '';
    const lowLbl  = low.mes  ? MESES_CORTO[low.mes-1]  + (low.anio?' '+low.anio:'')  : '';
    return `<div class="recibo-resumen">
      <div class="res-stat">
        <span class="res-lbl">Promedio mensual</span>
        <strong>${avgKwh} kWh</strong>
        ${avgImp ? `<span class="res-imp">$${avgImp.toLocaleString('es-MX')}/mes</span>` : ''}
      </div>
      <div class="res-stat res-peak">
        <span class="res-lbl">Mes pico</span>
        <strong>${peak.kwh} kWh</strong>
        ${peakLbl ? `<span class="res-mes">${peakLbl}</span>` : ''}
      </div>
      <div class="res-stat res-low">
        <span class="res-lbl">Mes bajo</span>
        <strong>${low.kwh} kWh</strong>
        ${lowLbl ? `<span class="res-mes">${lowLbl}</span>` : ''}
      </div>
    </div>`;
  })() : '';

  return `
  <div class="recibos-header">
    <span class="recibo-count">${_recibos.length} / ${limite} recibos</span>
    ${puedeAgregar ? `<button type="button" class="btn-outline btn-sm" onclick="addRecibo()">+ Recibo</button>` : ''}
  </div>
  ${_recibos.map((r,i)=>`
    <div class="recibo-card">
      <div class="recibo-top">
        <div class="recibo-fecha">
          <select class="sel-mes" ${edit?`onchange="(function(v){_recibos[${i}].mes=parseInt(v)||null;_recibos[${i}].mesLabel=MESES_FULL[(parseInt(v)||1)-1];}).call(this,this.value)"`:'disabled'}>
            <option value="">Mes</option>
            ${MESES_CORTO.map((m,mi)=>`<option value="${mi+1}" ${r.mes===mi+1?'selected':''}>${m}</option>`).join('')}
          </select>
          <select class="sel-anio" ${edit?`onchange="_recibos[${i}].anio=parseInt(this.value)||null"`:'disabled'}>
            <option value="">Año</option>
            ${anios.map(a=>`<option value="${a}" ${r.anio===a?'selected':''}>${a}</option>`).join('')}
          </select>
        </div>
        <div class="recibo-foto-slot">
          ${r.foto
            ? `${fotoMini(r.foto,'Recibo')}${edit?`<button type="button" class="btn-del-foto" onclick="_recibos[${i}].foto=null;refreshRecibos()">✕</button>`:''}`
            : (edit ? `<button type="button" class="btn-foto-sm" onclick="capReciboFoto(${i})">${icon('receipt', 14)} Foto</button>` : '<span style="color:var(--text-muted);font-size:.75rem">Sin foto</span>')}
        </div>
        ${edit?`<button type="button" class="btn-del-sm" onclick="delRecibo(${i})" title="Eliminar">✕</button>`:''}
      </div>
      <div class="recibo-nums">
        <label class="recibo-num-group">
          <span>kWh / mes</span>
          <input type="number" placeholder="0" value="${r.kwh||''}" min="0" step="1"
            ${edit?`oninput="_recibos[${i}].kwh=parseFloat(this.value)||0"`:'disabled'}/>
        </label>
        <label class="recibo-num-group">
          <span>$ Importe</span>
          <input type="number" placeholder="0" value="${r.importe||''}" min="0" step="1"
            ${edit?`oninput="_recibos[${i}].importe=parseFloat(this.value)||0"`:'disabled'}/>
        </label>
      </div>
    </div>`).join('')}
  ${resumen}
  `;
}

window.addRecibo = function() {
  if (_recibos.length >= 12) { toast('Máximo 12 recibos', 'error'); return; }
  // Auto-sugerir: retroceder un mes desde el último capturado
  const ultimo = _recibos.slice().reverse().find(r => r.mes && r.anio);
  let mes = null, anio = null;
  if (ultimo) {
    mes  = ultimo.mes === 1 ? 12 : ultimo.mes - 1;
    anio = ultimo.mes === 1 ? ultimo.anio - 1 : ultimo.anio;
  }
  _recibos.push({ foto:null, mes, anio, mesLabel: mes ? MESES_FULL[mes-1] : '', kwh:0, importe:0 });
  refreshRecibos();
};
window.delRecibo = function(i) { _recibos.splice(i,1); refreshRecibos(); };
window.capReciboFoto = function(i) {
  capturePhoto(async b64 => {
    toast('Subiendo foto del recibo…');
    // Usamos un ID temporal sin projectId ya que los recibos son parte del levantamiento
    const fid = uuid();
    const result = await uploadPhotoQueued(b64, `levantamiento/recibo_${fid}.jpg`,
      'levantamiento_temp', 'reciboFoto');
    _recibos[i].foto = result.url || (result.pending ? b64 : null);
    refreshRecibos();
    if (result.url) toast('✅ Foto del recibo guardada');
  });
};
function refreshRecibos() {
  const panel = document.getElementById('panel-recibos');
  if (panel) panel.innerHTML = renderRecibos(_recibos, true, null);
}

// ── Aparatos eléctricos ───────────────────────────────────────────────────────
let _aparatos = [];
const APARATOS_RAPIDOS = [
  {nombre:'Minisplit 1 ton',potencia:900,horas:8},{nombre:'Minisplit 1.5 ton',potencia:1350,horas:8},
  {nombre:'Minisplit 2 ton',potencia:1800,horas:8},{nombre:'Calentador eléctrico',potencia:1200,horas:2},
  {nombre:'Bomba de agua',potencia:750,horas:4},{nombre:'Bomba de alberca',potencia:1100,horas:6},
  {nombre:'Refrigerador residencial',potencia:200,horas:24},{nombre:'Refrigerador comercial',potencia:500,horas:24},
  {nombre:'Lavadora',potencia:500,horas:1},
];

function renderAparatos(aparatos, edit) {
  _aparatos = [...aparatos];
  const totalKwh = _aparatos.reduce((s,a)=>s+(a.potencia*a.horas*30/1000),0);
  return `
    ${edit?`<div class="aparatos-rapidos">
      <p class="hint">Acceso rápido:</p>
      <div class="chip-group">
        ${APARATOS_RAPIDOS.map(a=>`<button type="button" class="chip chip-sm" onclick="addAparatoRapido(${JSON.stringify(a).replace(/"/g,'&quot;')})">${a.nombre}</button>`).join('')}
      </div>
    </div>`:''}
    <div id="lista-aparatos">
      ${_aparatos.map((a,i)=>`
        <div class="aparato-row">
          <input type="text" value="${esc(a.nombre)}" placeholder="Nombre" ${edit?`oninput="_aparatos[${i}].nombre=this.value"`:'disabled'}/>
          <input type="number" value="${a.potencia}" placeholder="W" min="0" ${edit?`oninput="_aparatos[${i}].potencia=parseFloat(this.value)||0"`:'disabled'}/>
          <input type="number" value="${a.horas}" placeholder="h/día" min="0" step="0.5" ${edit?`oninput="_aparatos[${i}].horas=parseFloat(this.value)||0"`:'disabled'}/>
          <input type="number" value="${a.cantidad||1}" placeholder="Cant." min="1" ${edit?`oninput="_aparatos[${i}].cantidad=parseInt(this.value)||1"`:'disabled'}/>
          ${edit?`<button type="button" class="btn-del-sm" onclick="delAparato(${i})">✕</button>`:''}
        </div>`).join('')}
    </div>
    ${edit?`<button type="button" class="btn-outline btn-sm" onclick="addAparato()">+ Aparato</button>`:''}
    <p class="kwh-total">Total estimado: <strong>${totalKwh.toFixed(0)} kWh/mes</strong></p>
  `;
}

const _triggerLevSave = () => { if (_levPid) window._levAutoSave(_levPid); };
window.addAparatoRapido = function(a) { _aparatos.push({...a,cantidad:1}); refreshAparatos(); _triggerLevSave(); };
window.addAparato = function() { _aparatos.push({nombre:'',potencia:0,horas:0,cantidad:1}); refreshAparatos(); };
window.delAparato = function(i) { _aparatos.splice(i,1); refreshAparatos(); _triggerLevSave(); };
function refreshAparatos() {
  const el = document.getElementById('lista-aparatos');
  if (el) {
    // Reemplazar solo el contenido del contenedor padre para mantener referencias del DOM
    el.innerHTML = _aparatos.map((a,i) => `
      <div class="aparato-row">
        <input type="text" value="${esc(a.nombre)}" placeholder="Nombre" oninput="_aparatos[${i}].nombre=this.value"/>
        <input type="number" value="${a.potencia}" placeholder="W" min="0" oninput="_aparatos[${i}].potencia=parseFloat(this.value)||0"/>
        <input type="number" value="${a.horas}" placeholder="h/día" min="0" step="0.5" oninput="_aparatos[${i}].horas=parseFloat(this.value)||0"/>
        <input type="number" value="${a.cantidad||1}" placeholder="Cant." min="1" oninput="_aparatos[${i}].cantidad=parseInt(this.value)||1"/>
        <button type="button" class="btn-del-sm" onclick="delAparato(${i})">✕</button>
      </div>`).join('');
    // Actualizar total
    const totalKwh = _aparatos.reduce((s,a) => s + (a.potencia * a.horas * 30 / 1000), 0);
    const totEl = el.closest('.card, [id^="panel-aparatos"]')?.querySelector('.kwh-total');
    if (totEl) totEl.innerHTML = `Total estimado: <strong>${totalKwh.toFixed(0)} kWh/mes</strong>`;
  }
}

window.setModoConsumo = function(modo) {
  document.querySelectorAll('#chip-consumo .chip').forEach(c => {
    c.classList.toggle('chip-active', c.textContent.trim().startsWith(modo==='recibo'?'Con':'Por'));
  });
  document.getElementById('panel-recibos').style.display  = modo==='recibo' ?'':'none';
  document.getElementById('panel-aparatos').style.display = modo==='aparatos'?'':'none';
  document.getElementById('form-levantamiento').dataset.modoConsumo = modo;
};

// ── Cargas (off-grid/respaldo) ────────────────────────────────────────────────
let _cargas = { critica: [], secundaria: [] };

const CARGAS_RAPIDAS = [
  {nombre:'Minisplit 1 ton',    potencia:900,  horas:8 },
  {nombre:'Minisplit 1.5 ton',  potencia:1350, horas:8 },
  {nombre:'Refrigerador',       potencia:150,  horas:24},
  {nombre:'Bomba de agua',      potencia:750,  horas:4 },
  {nombre:'Televisor',          potencia:100,  horas:6 },
  {nombre:'Foco LED',           potencia:10,   horas:8 },
  {nombre:'Lavadora',           potencia:500,  horas:1 },
];

function renderCargas(cargas, edit, tipo) {
  _cargas[tipo] = [...cargas];
  const totalW   = _cargas[tipo].reduce((s,c) => s + c.potencia * (c.cantidad||1), 0);
  const totalWh  = _cargas[tipo].reduce((s,c) => s + c.potencia * c.horas * (c.cantidad||1), 0);
  const labelBtn = tipo === 'critica' ? '+ Carga crítica' : tipo === 'secundaria' ? '+ Carga secundaria' : '+ Carga';
  return `
    ${edit ? `<div class="aparatos-rapidos">
      <p class="hint">Acceso rápido:</p>
      <div class="chip-group">
        ${CARGAS_RAPIDAS.map(a=>`<button type="button" class="chip chip-sm" onclick="addCargaRapida('${tipo}',${JSON.stringify(a).replace(/"/g,'&quot;')})">${a.nombre}</button>`).join('')}
      </div>
    </div>` : ''}
    ${_cargas[tipo].length > 0 ? `
    <div class="carga-row carga-row-header">
      <span>Equipo</span>
      <span title="Potencia en watts del aparato">Watts (W)</span>
      <span title="Horas de uso al día">Horas/día</span>
      <span title="Número de unidades">Cant.</span>
      ${edit ? '<span></span>' : ''}
    </div>` : ''}
    <div id="lista-cargas-${tipo}">
      ${_cargas[tipo].map((c,i)=>`
        <div class="carga-row">
          <input type="text" value="${esc(c.nombre)}" placeholder="Nombre del equipo" ${edit?`oninput="_cargas['${tipo}'][${i}].nombre=this.value"`:'disabled'}/>
          <input type="number" value="${c.potencia}" placeholder="0" min="0" ${edit?`oninput="_cargas['${tipo}'][${i}].potencia=parseFloat(this.value)||0;refreshCargasTotales('${tipo}')"`:'disabled'}/>
          <input type="number" value="${c.horas}" placeholder="0" min="0" step="0.5" ${edit?`oninput="_cargas['${tipo}'][${i}].horas=parseFloat(this.value)||0;refreshCargasTotales('${tipo}')"`:'disabled'}/>
          <input type="number" value="${c.cantidad||1}" placeholder="1" min="1" ${edit?`oninput="_cargas['${tipo}'][${i}].cantidad=parseInt(this.value)||1;refreshCargasTotales('${tipo}')"`:'disabled'}/>
          ${edit?`<button type="button" class="btn-del-sm" onclick="delCarga('${tipo}',${i})">✕</button>`:''}
        </div>`).join('')}
    </div>
    ${edit?`<button type="button" class="btn-outline btn-sm" style="margin-top:6px" onclick="addCarga('${tipo}')">${labelBtn}</button>`:''}
    <p class="kwh-total" id="cargas-total-${tipo}">Total: <strong>${totalW} W</strong> — <strong>${(totalWh/1000).toFixed(2)} kWh/día</strong></p>
  `;
}
window.addCargaRapida = function(tipo, a) { _cargas[tipo].push({...a, cantidad:1}); refreshCargas(tipo); _triggerLevSave(); };
window.addCarga = function(tipo) { _cargas[tipo].push({nombre:'',potencia:0,horas:0,cantidad:1}); refreshCargas(tipo); };
window.delCarga = function(tipo,i) { _cargas[tipo].splice(i,1); refreshCargas(tipo); _triggerLevSave(); };
window.refreshCargasTotales = function(tipo) {
  const el = document.getElementById(`cargas-total-${tipo}`);
  if (!el) return;
  const totalW  = _cargas[tipo].reduce((s,c) => s + c.potencia * (c.cantidad||1), 0);
  const totalWh = _cargas[tipo].reduce((s,c) => s + c.potencia * c.horas * (c.cantidad||1), 0);
  el.innerHTML = `Total: <strong>${totalW} W</strong> — <strong>${(totalWh/1000).toFixed(2)} kWh/día</strong>`;
};
function refreshCargas(tipo) { const el=document.getElementById(`cargas-${tipo}`); if(el) el.innerHTML=renderCargas(_cargas[tipo],true,tipo); }

window.toggleGenerador = function(val) {
  document.getElementById('gen-extra').style.display = val==='no' ? 'none' : '';
};

// ── Campos libres ─────────────────────────────────────────────────────────────
let _camposLibres = [];
window.addCampoLibre = function() {
  _camposLibres.push({nombre:'',valor:''});
  const el = document.getElementById('campos-libres');
  const i = _camposLibres.length - 1;
  const div = document.createElement('div');
  div.className = 'campo-libre-row';
  div.innerHTML = `
    <input type="text" placeholder="Nombre" oninput="_camposLibres[${i}].nombre=this.value"/>
    <input type="text" placeholder="Valor" oninput="_camposLibres[${i}].valor=this.value"/>
    <button type="button" class="btn-del-sm" onclick="delCampoLibre(${i})">✕</button>`;
  el.appendChild(div);
};
window.updCampoLibre = function(i,k,v) { if(_camposLibres[i]) _camposLibres[i][k]=v; };
window.delCampoLibre = function(i) { _camposLibres.splice(i,1); navigate(window.location.hash); };

// ── Guardar levantamiento ─────────────────────────────────────────────────────
window.guardarLevantamiento = async function(e, projectId) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const p  = await projects.getById(projectId);
  const lev = p.documentacion?.levantamiento || {};
  const tipo = p.tipoSistema;

  const sombrasChecklist = Array.from(e.target.querySelectorAll('[name^="sombra_"]:checked')).map(cb=>cb.value);
  const condiciones = Array.from(e.target.querySelectorAll('[name^="cond_"]:checked')).map(cb=>cb.value);
  const modoConsumo = e.target.dataset.modoConsumo || (lev.modoConsumo||'recibo');

  const tipTechoVal = fd.get('tipTecho');
  // Áreas: leer del state en memoria (ya actualizadas vía _updateAreaTecho)
  const areasTechoVal = _areasTecho
    .filter(a => a.nombre || a.ancho || a.largo)
    .map(a => ({
      nombre:             a.nombre || `Área ${_areasTecho.indexOf(a)+1}`,
      ancho:              a.ancho  || null,
      largo:              a.largo  || null,
      area:               (a.ancho && a.largo) ? parseFloat((a.ancho*a.largo).toFixed(2)) : null,
      orientacion:        a.orientacion || null,
      pisos:              a.pisos || null,
      inclinacion:        a.inclinacion || null,
      distTableroInversor: a.distTableroInversor || null,
      distInversorPaneles: a.distInversorPaneles || null,
      fotos:              Array.isArray(a.fotos) ? a.fotos : [],
    }));
  const areaTotal = areasTechoVal.reduce((s,a)=>s+(a.area||0), 0) || null;

  const newLev = {
    ...lev,
    tipTecho:            tipTechoVal,
    tipoSujecion:        _sujecionPorTecho(tipTechoVal),  // auto, no editable
    areasTecho:          areasTechoVal,
    areaDisponible:      areaTotal ? parseFloat(areaTotal.toFixed(2)) : (lev.areaDisponible || null),
    estadoMadera:        tipTechoVal === 'Madera' ? (fd.get('estadoMadera') || null) : null,
    distVigas:           tipTechoVal === 'Madera' ? (parseFloat(fd.get('distVigas')) || null) : null,
    tMin:                parseFloat(fd.get('tMin')) ?? 3,
    tMinCiudad:          fd.get('tMinCiudad') || null,
    tMinZona:            fd.get('tMinZona') || 'valle',
    tipoServicioCFE:     fd.get('tipoServicioCFE'),
    tierraFisica:        fd.get('tierraFisica'),
    centroCarga:         fd.get('centroCarga'),
    calibreCableDC:      fd.get('calibreCableDC') || null,
    calibreCableAC:      fd.get('calibreCableAC') || null,
    tipoProteccion:      fd.get('tipoProteccion') || null,
    circuitoTablero:     fd.get('circuitoTablero')?.trim() || null,
    gpsLat:              lev.gpsLat  ?? null,
    gpsLng:              lev.gpsLng  ?? null,
    sombras:             { checklist:sombrasChecklist, foto:lev.sombras?.foto||null, notas:fd.get('sombraNotas')||'' },
    fotosLevantamiento:  lev.fotosLevantamiento || [],
    observacionesGenerales: fd.get('observacionesGenerales') || '',
    restricciones:          fd.get('restricciones') || '',
    horarioUso:             fd.get('horarioUso') || null,
  };

  if (tipo==='interconectado'||tipo==='hibrido'||tipo==='hibrido_respaldo') {
    newLev.tarifaCFE      = fd.get('tarifaCFE');
    newLev.demandaKW      = parseFloat(fd.get('demandaKW')) || null;
    newLev.factorPotencia = parseFloat(fd.get('factorPotencia')) || null;
    newLev.modoConsumo = modoConsumo;
    newLev.recibos     = modoConsumo==='recibo' ? _recibos : [];
    newLev.aparatos    = modoConsumo==='aparatos' ? _aparatos : [];
    if (tipo==='hibrido'||tipo==='hibrido_respaldo') {
      newLev.autonomia     = parseFloat(fd.get('autonomia'))||null;
      newLev.bancoBaterias = parseFloat(fd.get('bancoBaterias'))||null;
    }
  }
  if (tipo==='aislado') {
    newLev.autonomia=parseFloat(fd.get('autonomia'))||null;
    newLev.cargasCriticas   = _cargas.critica;
    newLev.cargasSecundarias= _cargas.secundaria;
    newLev.generador       = fd.get('generador')==='no'?null:fd.get('generador');
    newLev.generadorArranque= fd.get('generadorArranque');
    newLev.generadorKw     = parseFloat(fd.get('generadorKw'))||null;
    newLev.crecimientoFuturo= fd.get('crecimientoFuturo')||'';
    newLev.condicionesAmbientales = condiciones;
  }
  if (tipo==='bombeo') {
    newLev.tipoBomba       = fd.get('tipoBomba');
    newLev.caudal          = parseFloat(fd.get('caudal'))||null;
    newLev.profundidadPozo = parseFloat(fd.get('profundidadPozo'))||null;
    newLev.horasBombeo     = parseFloat(fd.get('horasBombeo'))||null;
  }
  if (tipo==='respaldo') { // legacy
    newLev.tiempoRespaldo  = parseFloat(fd.get('tiempoRespaldo'))||null;
    newLev.cargasRespaldo  = _cargas.critica;
  }

  p.documentacion = p.documentacion || {};
  p.documentacion.levantamiento = newLev;

  const rootUpdate = { documentacion: p.documentacion };
  const newClientName = fd.get('lev_clientName')?.trim();
  const newNombreProyecto = fd.get('lev_nombreProyecto')?.trim() || null;
  if (newClientName && newClientName !== p.clientName) {
    rootUpdate.clientName = newClientName;
    // Regenerar displayId para que la "carpeta" refleje el nombre actual
    const all = await projects.getAll();
    const otherIds = all.filter(x => x.id !== projectId).map(x => x.displayId).filter(Boolean);
    rootUpdate.displayId = genDisplayId(newClientName, p.createdAt, p.tipoSistema, otherIds);
  }
  if (newNombreProyecto !== (p.nombreProyecto || null)) rootUpdate.nombreProyecto = newNombreProyecto;
  await projects.update(projectId, rootUpdate);
  // Actualizar indicador de auto-guardado
  const ind = document.getElementById('lev-autosave');
  if (ind) { ind.textContent = '✓ Guardado'; ind.className = 'autosave-indicator saved'; }
  if (!e._auto) {
    toast('✅ Levantamiento guardado');
    logChange(projectId, { modulo: 'Documentación', accion: 'levantamiento guardado', detalle: '', quien: await getSession() });
    // Auto-carry Tmin → Voc si el valor cambió
    _autoRecalcVocSilent(projectId, newLev.tMin, newLev.tMinZona);
  }
};

// ── Auto-carry Tmin → Voc ─────────────────────────────────────────────────────
// Después de guardar el levantamiento, recalcula Voc silenciosamente si todos
// los datos están disponibles Y el tMin realmente cambió respecto al último cálculo.
async function _autoRecalcVocSilent(projectId, newTMin, newTMinZona) {
  if (newTMin == null) return;
  try {
    const p       = await projects.getById(projectId);
    const g       = p?.garantia || {};
    const vd      = g.validacionVoc || {};

    // Solo recalcular si el tMin cambió respecto al guardado anterior
    if (vd.tMin != null && Math.abs(vd.tMin - newTMin) < 0.001 && vd.tMinZona === (newTMinZona || 'valle')) return;

    // Ingredientes para el cálculo
    const vocPanel     = g.paneles?.voc || null;
    const inversor     = (g.equipos || []).find(e => e.tipo === 'inversor');
    const vocMax       = inversor?.vocMax || null;
    const strings      = g.paneles?.strings || [];
    const maxPorString = strings.length > 0 ? Math.max(...strings.map(s => s.paneles?.length || 0)) : null;
    const panelesSerie = maxPorString || p.projectConfig?.layout?.totalPanels || null;

    if (!vocPanel || !vocMax || !panelesSerie) return; // datos insuficientes — silencio

    const result = calcVocPuro({ vocPanel, panelesSerie, vocMaxInversor: vocMax, tMin: newTMin });
    if (!result) return;

    await projects.setField(projectId, 'garantia.validacionVoc', {
      ...result,
      tMin:          newTMin,
      tMinZona:      newTMinZona || 'valle',
      vocPanel,
      panelesSerie,
      vocMaxInversor: vocMax,
      savedAt:       isoNow(),
      savedBy:       'auto-tmin',
    });
    toast(`🌡 Voc recalculado (T mín = ${newTMin}°C)`, 'info', 3000);
  } catch (_) {
    // Error silencioso — no interrumpir el flujo del usuario
  }
}

// Auto-guardado con debounce 3 segundos
let _levAutoSaveTimer = null;
window._levAutoSave = function(projectId) {
  const ind = document.getElementById('lev-autosave');
  if (ind) { ind.textContent = 'Guardando…'; ind.className = 'autosave-indicator saving'; }
  clearTimeout(_levAutoSaveTimer);
  _levAutoSaveTimer = setTimeout(() => {
    const form = document.getElementById('form-levantamiento');
    if (!form) return;
    const fakeEvent = new Event('submit');
    fakeEvent._auto = true;
    fakeEvent.preventDefault = () => {};
    fakeEvent.target = form;
    Promise.resolve(window.guardarLevantamiento(fakeEvent, projectId)).catch(() => {
      const ind = document.getElementById('lev-autosave');
      if (ind) { ind.textContent = '⚠ Error al guardar'; ind.className = 'autosave-indicator error'; }
    });
  }, 3000);
};

window.capSombraFoto = function(pid) {
  capturePhoto(async b64 => {
    toast('Subiendo foto de sombra…');
    const result = await uploadPhotoQueued(b64, `projects/${pid}/sombra.jpg`, pid, 'sombraFoto');
    const fotoUrl = result.url || (result.pending ? b64 : null);
    const p = await projects.getById(pid);
    p.documentacion = p.documentacion || {};
    p.documentacion.levantamiento = p.documentacion.levantamiento || {};
    p.documentacion.levantamiento.sombras = p.documentacion.levantamiento.sombras || {};
    p.documentacion.levantamiento.sombras.foto = fotoUrl;
    await projects.update(pid, { documentacion: p.documentacion });
    navigate(`#proyecto/${pid}/documentacion`);
  });
};
window.delSombraFoto = async function(pid) {
  const p = await projects.getById(pid);
  p.documentacion.levantamiento.sombras.foto = null;
  await projects.update(pid, { documentacion: p.documentacion });
  navigate(`#proyecto/${pid}/documentacion`);
};

// ── _calcAreaTecho: obsoleto — reemplazado por _calcAreaItem ─────────────────
window._calcAreaTecho = function() {}; // compat shim

// ── Fotos del levantamiento ───────────────────────────────────────────────────
window.capFotoLev = function(pid) {
  capturePhoto(async b64 => {
    toast('Subiendo foto del levantamiento…');
    const idx = Date.now();
    const result = await uploadPhotoQueued(b64, `projects/${pid}/lev_${idx}.jpg`, pid, 'fotoLev');
    const fotoUrl = result.url || (result.pending ? b64 : null);
    if (!fotoUrl) { toast('No se pudo guardar la foto', 'error'); return; }

    const p = await projects.getById(pid);
    p.documentacion = p.documentacion || {};
    p.documentacion.levantamiento = p.documentacion.levantamiento || {};
    const fotos = p.documentacion.levantamiento.fotosLevantamiento || [];
    fotos.push({ url: fotoUrl, ts: new Date().toISOString() });
    p.documentacion.levantamiento.fotosLevantamiento = fotos;
    await projects.update(pid, { documentacion: p.documentacion });
    navigate(`#proyecto/${pid}/levantamiento`);
  });
};

window.delFotoLev = async function(pid, idx) {
  const p = await projects.getById(pid);
  const fotos = p.documentacion?.levantamiento?.fotosLevantamiento || [];
  fotos.splice(idx, 1);
  p.documentacion.levantamiento.fotosLevantamiento = fotos;
  await projects.update(pid, { documentacion: p.documentacion });
  navigate(`#proyecto/${pid}/levantamiento`);
};

// ── Fotos por área ─────────────────────────────────────────────────────────────
window.capFotoArea = function(pid, areaIdx) {
  capturePhoto(async (b64Array) => {
    const fotos = Array.isArray(b64Array) ? b64Array : [b64Array];
    const total = fotos.length;
    const prog = uploadProgressBar(total);
    const p = await projects.getById(pid);
    const areas = p.documentacion?.levantamiento?.areasTecho || [];
    if (!areas[areaIdx]) { toast('Área no encontrada', 'error'); return; }
    areas[areaIdx].fotos = Array.isArray(areas[areaIdx].fotos) ? areas[areaIdx].fotos : [];
    for (let i = 0; i < total; i++) {
      prog.update(i + 1);
      const fid = uuid();
      const result = await uploadPhotoQueued(fotos[i],
        `projects/${pid}/area${areaIdx}_${fid}.jpg`, pid, 'fotoArea',
        { areaIdx, itemId: fid });
      areas[areaIdx].fotos.push({
        url: result.url || null, id: fid, createdAt: isoNow(),
        ...(result.pending && { pending: true, pendingId: result.pendingId }),
      });
      if (_areasTecho[areaIdx]) {
        _areasTecho[areaIdx].fotos = [...areas[areaIdx].fotos];
      }
    }
    prog.done();
    p.documentacion.levantamiento.areasTecho = areas;
    await projects.update(pid, { documentacion: p.documentacion });
    navigate(`#proyecto/${pid}/levantamiento`);
    toast(`✅ ${total} foto${total > 1 ? 's' : ''} guardada${total > 1 ? 's' : ''}`);
  }, { multiple: true });
};

window.delFotoArea = async function(pid, areaIdx, fotoIdx) {
  if (!await confirmDialog('¿Eliminar esta foto?')) return;
  const p = await projects.getById(pid);
  const areas = p.documentacion?.levantamiento?.areasTecho || [];
  if (!Array.isArray(areas[areaIdx]?.fotos)) return;
  areas[areaIdx].fotos.splice(fotoIdx, 1);
  if (_areasTecho[areaIdx]?.fotos) _areasTecho[areaIdx].fotos.splice(fotoIdx, 1);
  p.documentacion.levantamiento.areasTecho = areas;
  await projects.update(pid, { documentacion: p.documentacion });
  navigate(`#proyecto/${pid}/levantamiento`);
};

// ── Acordeón helper ───────────────────────────────────────────────────────────
window.toggleAcc = function(btn, bodyId) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  const isOpen = btn.classList.toggle('acc-open');
  body.classList.toggle('acc-collapsed', !isOpen);
};

// ── Render sitio (3 subfases: Antes / Durante / Cierre) ─────────────────────
function renderSitio(project, sitio, edit, projectId) {
  const SUBFASES = [
    { id: 'antes',   ico: '📷', label: 'Antes',   hint: 'Referencia visual previa al trabajo' },
    { id: 'durante', ico: '🔧', label: 'Durante',  hint: 'Proceso y avances de instalación' },
    { id: 'cierre',  ico: '✅', label: 'Cierre',   hint: 'Estado final del sitio' },
  ];
  const fases = project.documentacion?.fases || {};

  // Obtener fotos — soporta estructura nueva Y legacy (techo mapea a antes/durante/despues)
  const getFotos = (sub) => {
    if (fases?.[sitio]?.[sub]?.length) return fases[sitio][sub];
    if (sitio === 'techo') {
      const m = { antes:'antes', durante:'durante', cierre:'despues' };
      return fases?.[m[sub]] || [];
    }
    return [];
  };

  const cierreExtra = _countCierreExtra(project, sitio);

  return `
  <div class="subfase-bar" id="sfbar-${sitio}">
    ${SUBFASES.map((sf, idx) => {
      const cnt = getFotos(sf.id).length + (sf.id === 'cierre' ? cierreExtra : 0);
      return `<button class="subfase-btn ${idx===0?'sf-active':''}"
                      id="sf-btn-${sitio}-${sf.id}"
                      onclick="switchSubfase('${sitio}','${sf.id}',this)"
                      title="${sf.hint}">
        <span>${sf.ico} ${sf.label}</span>
        ${cnt ? `<span class="subfase-count">${cnt}</span>` : ''}
      </button>`;
    }).join('')}
  </div>
  ${SUBFASES.map((sf, idx) => {
    const fotos = getFotos(sf.id);
    return `
    <div id="sf-panel-${sitio}-${sf.id}" class="subfase-panel ${idx===0?'sf-active':''}">
      ${sf.id === 'cierre' ? renderCierreSitio(project, sitio, edit, projectId) : ''}
      ${renderFotosGrid(fotos, sitio, sf.id, sf.label, projectId, edit)}
    </div>`;
  }).join('')}`;
}

function renderFotosGrid(fotos, sitio, subfase, titulo, projectId, edit) {
  const key = `${sitio}_${subfase}`;
  if (!fotos.length) {
    return edit ? `
    <div class="empty-state">
      <div class="empty-state-icon">📷</div>
      <p class="empty-state-msg">Sin fotos de <strong>${titulo}</strong> aún.</p>
      <button class="empty-state-cta" onclick="agregarFotoSitio('${projectId}','${sitio}','${subfase}')">
        ${icon('camera')} Agregar fotos
      </button>
    </div>` : `<p class="empty-msg-sm">Sin fotos aún.</p>`;
  }
  return `
  <div class="fotos-grid-header">
    ${edit ? `<button class="btn-sm btn-outline" onclick="agregarFotoSitio('${projectId}','${sitio}','${subfase}')">
      ${icon('camera')} + Agregar fotos
    </button>` : ''}
  </div>
  <div class="fotos-grid" id="fotos-${key}">
    ${fotos.map((f,i)=>`
      <div class="foto-card">
        ${fotoMini(f.data,`Foto ${i+1}`)}
        ${f.nota?`<p class="foto-nota">${esc(f.nota)}</p>`:''}
        ${edit?`
          <button class="btn-del-foto-abs" onclick="editFotoNotaSitio('${projectId}','${sitio}','${subfase}',${i})">✎</button>
          <button class="btn-del-foto" onclick="delFotoSitio('${projectId}','${sitio}','${subfase}',${i})">✕</button>
        `:''}
      </div>`).join('')}
  </div>`;
}

// ── Selectores de sitio y subfase ─────────────────────────────────────────────
window.switchSitio = function(sitio, btn) {
  document.querySelectorAll('.sitio-btn').forEach(b => b.classList.remove('sitio-active'));
  btn.classList.add('sitio-active');
  document.querySelectorAll('.sitio-panel').forEach(p => p.classList.remove('sitio-panel-active'));
  const panel = document.getElementById(`sitio-panel-${sitio}`);
  if (panel) panel.classList.add('sitio-panel-active');
};

window.switchSubfase = function(sitio, subfase, btn) {
  const bar = document.getElementById(`sfbar-${sitio}`);
  bar?.querySelectorAll('.subfase-btn').forEach(b => b.classList.remove('sf-active'));
  btn.classList.add('sf-active');
  const panelContainer = document.getElementById(`sitio-panel-${sitio}`);
  panelContainer?.querySelectorAll('.subfase-panel').forEach(p => p.classList.remove('sf-active'));
  const panel = document.getElementById(`sf-panel-${sitio}-${subfase}`);
  if (panel) panel.classList.add('sf-active');
};

// Helper interno: obtener o crear la ruta fases[sitio][subfase]
function _ensureFasesSitio(p, sitio, subfase) {
  p.documentacion = p.documentacion || {};
  p.documentacion.fases = p.documentacion.fases || {};
  p.documentacion.fases[sitio] = p.documentacion.fases[sitio] || {};
  p.documentacion.fases[sitio][subfase] = p.documentacion.fases[sitio][subfase] || [];
  return p.documentacion.fases[sitio][subfase];
}

window.agregarFotoSitio = function(projectId, sitio, subfase) {
  // preview:true en fotos de una sola imagen para que el técnico confirme antes de subir
  const single = false; // multiple siempre activo en fases de sitio
  capturePhoto(async (b64Array, _files, fileMeta) => {
    const fotos = Array.isArray(b64Array) ? b64Array : [b64Array];
    const total = fotos.length;
    const prog  = uploadProgressBar(total);
    const nuevas = [];

    for (let i = 0; i < total; i++) {
      prog.update(i + 1);
      const fid = uuid();
      const result = await uploadPhotoQueued(
        fotos[i], `projects/${projectId}/${sitio}_${subfase}_${fid}.jpg`,
        projectId, 'fotoFase', { sitio, subfase, itemId: fid }
      );
      nuevas.push({
        data: result.url || (result.pending ? fotos[i] : null),
        nota: '', id: fid, createdAt: isoNow(),
        fuente: fileMeta?.fuente || 'camera',
        ...(result.pending && { pending: true, pendingId: result.pendingId }),
      });
    }
    prog.done();

    if (total === 1) {
      nuevas[0].nota = await inputDialog('Nota para esta foto (opcional):', '') || '';
    }

    const p = await projects.getById(projectId);
    const arr = _ensureFasesSitio(p, sitio, subfase);
    arr.push(...nuevas);
    await projects.update(projectId, { documentacion: p.documentacion });

    sessionStorage.setItem('doc-tab-target',  SITIO_TAB[sitio] || 'd-techo');
    sessionStorage.setItem('doc-subfa-target', subfase);
    navigate(`#proyecto/${projectId}/documentacion`);
    toast(`✅ ${total} foto${total > 1 ? 's guardadas' : ' guardada'}`);
  }, { multiple: true, projectId, fase: sitio, campo: subfase });
};

window.delFotoSitio = async function(projectId, sitio, subfase, idx) {
  if (!await confirmDialog('¿Eliminar esta foto?')) return;
  const p = await projects.getById(projectId);
  // Soportar legacy: si el foto está en fases[sitio][subfase] o en fases[legacyKey]
  const arr = p.documentacion?.fases?.[sitio]?.[subfase];
  if (arr) {
    arr.splice(idx, 1);
  } else if (sitio === 'techo') {
    const m = { antes:'antes', durante:'durante', cierre:'despues' };
    (p.documentacion.fases[m[subfase]] || []).splice(idx, 1);
  }
  await projects.update(projectId, { documentacion: p.documentacion });
  sessionStorage.setItem('doc-tab-target',  SITIO_TAB[sitio] || 'd-techo');
  sessionStorage.setItem('doc-subfa-target', subfase);
  navigate(`#proyecto/${projectId}/documentacion`);
};

window.editFotoNotaSitio = async function(projectId, sitio, subfase, idx) {
  const p = await projects.getById(projectId);
  const arr = p.documentacion?.fases?.[sitio]?.[subfase]
    || (sitio==='techo' ? p.documentacion?.fases?.[ {antes:'antes',durante:'durante',cierre:'despues'}[subfase] ] : null)
    || [];
  const actual = arr[idx]?.nota || '';
  const nueva = await inputDialog('Editar nota:', actual);
  if (nueva === null) return;
  if (arr[idx]) arr[idx].nota = nueva;
  await projects.update(projectId, { documentacion: p.documentacion });
  sessionStorage.setItem('doc-tab-target',  SITIO_TAB[sitio] || 'd-techo');
  sessionStorage.setItem('doc-subfa-target', subfase);
  navigate(`#proyecto/${projectId}/documentacion`);
};

// ── Notas de documentación ─────────────────────────────────────────────────────
function renderNotasDoc(notas, session, projectId) {
  if (!notas.length) return '<p class="empty-msg-sm">Sin notas aún.</p>';
  return notas.map((n, i) => `
    <div class="nota-item">
      <div class="nota-header">
        <span class="nota-autor">${esc(n.autorNombre || '—')}</span>
        <span class="nota-fecha">${fmtFechaHora(n.createdAt)}</span>
        ${isAdmin(session) || session?.id === n.autorId
          ? `<button class="btn-del-sm" onclick="_delNotaDoc('${projectId}',${i})">✕</button>` : ''}
      </div>
      <p class="nota-texto">${esc(n.texto)}</p>
    </div>
  `).join('');
}

window._showNotaDoc = function(projectId) {
  document.getElementById('dnotas-form').style.display = 'block';
  document.getElementById('dnotas-texto').focus();
};

window._submitNotaDoc = async function(projectId) {
  const texto = document.getElementById('dnotas-texto').value.trim();
  if (!texto) { toast('Escribe una nota', 'error'); return; }
  const session = JSON.parse(sessionStorage.getItem('ecofit_session') || 'null');
  const p = await projects.getById(projectId);
  const nota = { id: uuid(), texto, autorId: session?.id, autorNombre: session?.nombre || session?.username, createdAt: isoNow() };
  p.documentacion.notas = [...(p.documentacion.notas || []), nota];
  await projects.update(projectId, { documentacion: p.documentacion });
  document.getElementById('dnotas-list').innerHTML = renderNotasDoc(p.documentacion.notas, session, projectId);
  document.getElementById('dnotas-form').style.display = 'none';
  document.getElementById('dnotas-texto').value = '';
  // Actualizar badge del tab
  const tabBtn = document.querySelector('[data-tab="d-notas"]');
  if (tabBtn) tabBtn.innerHTML = `Notas<span class="tab-badge tab-ok">${p.documentacion.notas.length}</span>`;
  toast('✅ Nota guardada');
};

window._delNotaDoc = async function(projectId, idx) {
  if (!await confirmDialog('¿Eliminar esta nota?')) return;
  const session = JSON.parse(sessionStorage.getItem('ecofit_session') || 'null');
  const p = await projects.getById(projectId);
  p.documentacion.notas = (p.documentacion.notas || []).filter((_,i) => i !== idx);
  await projects.update(projectId, { documentacion: p.documentacion });
  document.getElementById('dnotas-list').innerHTML = renderNotasDoc(p.documentacion.notas, session, projectId);
  const tabBtn = document.querySelector('[data-tab="d-notas"]');
  if (tabBtn) tabBtn.innerHTML = p.documentacion.notas.length
    ? `Notas<span class="tab-badge tab-ok">${p.documentacion.notas.length}</span>` : 'Notas';
  toast('Nota eliminada');
};

// Alias locales para compatibilidad con el código existente en este módulo
const _TMIN_CIUDADES  = TMIN_ESTADOS;
const _TMIN_ZONAS     = TMIN_ZONAS;
const _TMIN_ZONA_DESC = TMIN_ZONA_DESC;

function _tminDescripcion(estado, zona, tMinFinal) {
  if (!estado || estado === 'otro') return '';
  const c = _TMIN_CIUDADES.find(x => x.nombre === estado);
  const z = _TMIN_ZONAS.find(x => x.key === (zona || 'valle'));
  if (!c || !z) return '';
  const base   = c.tMin;
  const offset = z.offset;
  const signo  = offset >= 0 ? `+${offset}` : `${offset}`;
  return `${base}°C (estado) ${signo}°C (zona) = ${tMinFinal ?? (base + offset)}°C`;
}

window._onTMinRecalc = function() {
  const selCiudad = document.querySelector('[name="tMinCiudad"]');
  const selZona   = document.querySelector('[name="tMinZona"]');
  const inp       = document.getElementById('lev-tmin-input');
  const desglose  = document.getElementById('lev-tmin-desglose');
  const desc      = document.getElementById('lev-tmin-desc');
  if (!selCiudad || !inp) return;

  const ciudad = selCiudad.value;
  const zona   = selZona?.value || 'valle';

  if (!ciudad || ciudad === 'otro') {
    // Manual: desbloquear campo
    inp.removeAttribute('readonly');
    inp.style.background = '';
    if (!ciudad) inp.value = '3';
    if (desglose) desglose.style.display = 'none';
  } else {
    // Auto: calcular ciudad + zona
    const optC  = selCiudad.options[selCiudad.selectedIndex];
    const optZ  = selZona?.options[selZona.selectedIndex];
    const base  = parseFloat(optC?.dataset?.tmin || '3');
    const off   = parseFloat(optZ?.dataset?.offset || '0');
    const final = base + off;
    inp.value = final;
    inp.setAttribute('readonly', true);
    inp.style.background = 'var(--surface2)';
    if (desglose) desglose.style.display = 'flex';
    if (desc) desc.textContent = _tminDescripcion(ciudad, zona, final);
  }
};

// ── Sujeción automática según tipo de techo ───────────────────────────────────
const _SUJECION_MAP = {
  'Losa de concreto': 'Anclaje químico (epóxico + taquete)',
  'Lámina':           'Tornillo autoperforante',
  'Metálico':         'Abrazadera estructural / varilla roscada',
  'Madera':           'Tirafondo 3/8" + flashing impermeable',
  'Otro':             'Por definir',
};
function _sujecionPorTecho(tipTecho) {
  return _SUJECION_MAP[tipTecho] || 'Selecciona tipo de techo';
}

// ── Mostrar / ocultar campos de madera al cambiar tipo de techo ──────────────
window._onTipTechoChange = function(sel) {
  const maderaFields = document.getElementById('madera-fields');
  if (maderaFields) maderaFields.style.display = sel.value === 'Madera' ? '' : 'none';
  // Actualizar badge de sujeción
  const badge = document.getElementById('sujecion-label');
  if (badge) badge.textContent = _sujecionPorTecho(sel.value);
};

// ── Áreas del techo — state y render ─────────────────────────────────────────
let _areasTecho = [];  // array de {nombre, ancho, largo, fotos:{antes,durante,cierre}}
let _levPid = '';      // projectId activo en la vista de levantamiento


function _renderAreasTecho(areas, edit, pid) {
  if (!areas.length && !edit) return '';
  const ORIENTACIONES = ['Sur','Poniente','Oriente','Norte','Sur-Poniente','Sur-Oriente'];
  return areas.map((a, i) => {
    const fotos = Array.isArray(a.fotos) ? a.fotos : [];
    const totalFotos = fotos.length;
    return `
  <div class="lev-area-item" id="lev-area-${i}">
    <div class="form-row" style="align-items:flex-end">
      <div class="form-group" style="flex:2">
        <label>Nombre del área</label>
        <input type="text" class="input-field" value="${esc(a.nombre||'')}"
               placeholder="Ej: Techo sur, Bodega…"
               ${edit?`oninput="window._updateAreaTecho(${i},'nombre',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
      <div class="form-group" style="flex:1">
        <label>Ancho (m)</label>
        <input type="number" class="input-field" value="${a.ancho||''}" step="0.5" placeholder="4.5"
               ${edit?`oninput="window._updateAreaTecho(${i},'ancho',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
      <div class="form-group" style="flex:1">
        <label>Largo (m)</label>
        <input type="number" class="input-field" value="${a.largo||''}" step="0.5" placeholder="8.0"
               ${edit?`oninput="window._updateAreaTecho(${i},'largo',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
      <div class="form-group lev-area-result" style="flex:1">
        <label>Área</label>
        <div class="input-info-badge" id="lev-area-res-${i}">
          ${a.ancho && a.largo ? `<strong>${(a.ancho*a.largo).toFixed(1)} m²</strong>` : '—'}
        </div>
      </div>
      ${edit ? `<button type="button" class="btn-icon-sm" style="margin-bottom:4px;color:var(--red)"
        onclick="window._removeAreaTecho(${i})" title="Eliminar área">✕</button>` : ''}
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Orientación</label>
        <select ${edit?`onchange="window._updateAreaTecho(${i},'orientacion',this.value)"`:''} ${edit?'':'disabled'}>
          ${ORIENTACIONES.map(t=>`<option ${(a.orientacion||'Sur')===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Número de pisos</label>
        <input type="number" value="${a.pisos||''}" placeholder="1" min="1" max="30"
               ${edit?`oninput="window._updateAreaTecho(${i},'pisos',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Inclinación (°)</label>
        <input type="number" value="${a.inclinacion||''}" placeholder="15"
               ${edit?`oninput="window._updateAreaTecho(${i},'inclinacion',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Dist. tablero→inversor (m)</label>
        <input type="number" value="${a.distTableroInversor||''}" step="0.5"
               ${edit?`oninput="window._updateAreaTecho(${i},'distTableroInversor',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
      <div class="form-group">
        <label>Dist. inversor→paneles (m)</label>
        <input type="number" value="${a.distInversorPaneles||''}" step="0.5"
               ${edit?`oninput="window._updateAreaTecho(${i},'distInversorPaneles',this.value)"`:''} ${edit?'':'disabled'} />
      </div>
    </div>
    ${!edit ? `
    <button type="button" class="lev-area-fotos-toggle"
            onclick="const s=document.getElementById('laf-sec-${i}');const open=s.style.display==='none';s.style.display=open?'':'none';this.querySelector('.laft-caret').textContent=open?'▾':'▸'">
      ${icon('camera', 13)} Fotos (${totalFotos}) <span class="laft-caret">▸</span>
    </button>` : ''}
    <div class="lev-area-fotos-section" id="laf-sec-${i}" ${!edit ? 'style="display:none"' : ''}>
      <div class="lev-area-fotos-grid">
        ${fotos.map((f, fi) => `
          <div class="lev-area-foto-wrap">
            ${fotoMini(f.url || f, `Foto ${fi+1}`)}
            ${edit ? `<button type="button" class="btn-del-foto"
              onclick="window.delFotoArea('${pid||''}',${i},${fi})">✕</button>` : ''}
          </div>`).join('')}
      </div>
      ${edit ? `<button type="button" class="btn-foto-sm lev-area-add-foto"
        onclick="window.capFotoArea('${pid||''}',${i})">${icon('camera')} Foto</button>` : ''}
    </div>
  </div>`;
  }).join('');
}

window._addAreaTecho = function() {
  const n = _areasTecho.length + 1;
  _areasTecho.push({ nombre: `Área ${n}`, ancho: null, largo: null, orientacion: 'Sur', pisos: null, inclinacion: null, distTableroInversor: null, distInversorPaneles: null, fotos: [] });
  const list = document.getElementById('lev-areas-list');
  if (list) list.innerHTML = _renderAreasTecho(_areasTecho, true, _levPid);
};

window._removeAreaTecho = function(idx) {
  _areasTecho.splice(idx, 1);
  const list = document.getElementById('lev-areas-list');
  if (list) list.innerHTML = _renderAreasTecho(_areasTecho, true, _levPid);
};

window._updateAreaTecho = function(idx, campo, val) {
  if (!_areasTecho[idx]) return;
  const isStr = campo === 'nombre' || campo === 'orientacion';
  _areasTecho[idx][campo] = isStr ? val : (parseFloat(val) || null);
  const a = _areasTecho[idx];
  const res = document.getElementById(`lev-area-res-${idx}`);
  if (res) res.innerHTML = (a.ancho && a.largo)
    ? `<strong>${(a.ancho * a.largo).toFixed(1)} m²</strong>` : '—';
};

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
