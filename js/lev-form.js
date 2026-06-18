// lev-form.js — Levantamiento dinámico (formulario completo) + vista standalone

import { projects } from './db.js';
import { esc, fotoMini } from './utils.js';
import { canEdit } from './auth.js';
import { icon } from './icons.js';
import { renderCamposDinamicos } from './lev-campos.js';
import { _renderAreasTecho, _sujecionPorTecho } from './lev-areas.js';
import { _TMIN_CIUDADES, _TMIN_ZONAS, _TMIN_ZONA_DESC, _tminDescripcion } from './lev-tmin.js';
import './lev-guardar.js';
import './lev-gps.js';

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

// ── Levantamiento dinámico ─────────────────────────────────────────────────────
function renderLevantamiento(project, tipo, edit) {
  const lev = project.documentacion?.levantamiento || {};
  const dis = edit ? '' : 'disabled';
  const pid = project.id;
  _lev.pid = pid;
  // Sincronizar state de áreas del techo (docs migrados por _migrateProject en firebase.js)
  _lev.areasTecho = (lev.areasTecho || []).map(a => ({
    ...a, fotos: Array.isArray(a.fotos) ? [...a.fotos] : [],
  }));

  // Reinicializar estado de módulo con datos del proyecto (evita estado stale entre navegaciones)
  _lev.camposLibres = [...(lev.camposLibres || [])];
  _lev.cargas = {
    critica:    [...(lev.cargasCriticas    || [])],
    secundaria: [...(lev.cargasSecundarias || [])],
  };

  // Detectar si secciones tienen datos para abrir acordeón pre-llenado
  const hasSitio      = !!(lev.tipTecho || (lev.areasTecho?.length > 0));
  const hasElecConsumo= !!(lev.tipoServicioCFE || lev.tierraFisica || lev.centroCarga ||
                           lev.recibos?.length || lev.aparatos?.length || lev.tarifaCFE ||
                           lev.autonomia || lev.cargasCriticas?.length ||
                           lev.voltajeSistemaDC || lev.tipoControlador || lev.bateria);
  const hasSombras    = !!(lev.sombras?.checklist?.length || lev.sombras?.foto || lev.sombras?.notas ||
                           lev.condicionesAmbientales?.length);
  const hasLogistica  = !!(lev.accesoTecho || lev.almacenamientoTemporal || lev.conectividadInversor || lev.logisticaNotas);
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
      <div class="form-group" style="margin-top:8px">
        <label>Condiciones ambientales del sitio</label>
        <div class="sombras-check">
          ${['Polvo','Salinidad costera','Calor extremo','Humedad alta','Viento fuerte','Otra'].map(c=>`
            <label class="check-chip ${(lev.condicionesAmbientales||[]).includes(c)?'check-active':''}">
              <input type="checkbox" name="cond_${c}" ${dis} value="${c}"
                ${(lev.condicionesAmbientales||[]).includes(c)?'checked':''}
                onchange="this.closest('.check-chip').classList.toggle('check-active',this.checked)"> ${c}
            </label>`).join('')}
        </div>
      </div>
    `)}

    ${/* Eléctrico y consumo — no aplica para 'otro'. Sistema pequeño usa solo el bloque DC (dinamico) */
      tipo !== 'otro' ? acc('elec_consumo', 'Eléctrico y consumo', '⚡', hasElecConsumo, `
      ${tipo !== 'sistema_pequeno' ? `
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
      <details class="pd-details" ${(lev.voltajeFaseFase || lev.voltajeFaseNeutro || lev.voltajeFaseTierra) ? 'open' : ''}>
        <summary>Voltajes medidos en sitio <span class="pd-caret">▾</span></summary>
        <div class="pd-body">
          <div class="form-row">
            <div class="form-group"><label>Fase-fase (V)</label>
              <input type="number" name="voltajeFaseFase" value="${lev.voltajeFaseFase||''}" min="0" step="0.1" placeholder="Ej: 220" ${dis}/></div>
            <div class="form-group"><label>Fase-neutro (V)</label>
              <input type="number" name="voltajeFaseNeutro" value="${lev.voltajeFaseNeutro||''}" min="0" step="0.1" placeholder="Ej: 127" ${dis}/></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Fase-tierra (V)</label>
              <input type="number" name="voltajeFaseTierra" value="${lev.voltajeFaseTierra||''}" min="0" step="0.1" ${dis}/></div>
          </div>
          <p class="form-hint" style="margin:0">Mide con multímetro en horas de mayor sol — voltajes altos pueden disparar la protección anti-isla del inversor.</p>
        </div>
      </details>
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
          <div class="form-row">
            <div class="form-group">
              <label>Interruptor principal (A)</label>
              <input type="number" name="capacidadInterruptorPrincipal" value="${lev.capacidadInterruptorPrincipal||''}"
                     min="0" step="5" placeholder="Ej: 100" ${dis}/>
            </div>
            <div class="form-group">
              <label>Capacidad de barras / busbar (A)
                <span class="form-hint">para la regla del 120% — NOM-001-SEDE Art. 705</span>
              </label>
              <input type="number" name="capacidadBarrasTablero" value="${lev.capacidadBarrasTablero||''}"
                     min="0" step="5" placeholder="Ej: 125" ${dis}/>
            </div>
          </div>
        </div>
      </details>
      ` : ''}
      ${dinamico ? `<div class="lev-sep"></div>${dinamico}` : ''}
    `) : ''}

    ${acc('logistica', 'Logística de instalación', '🚚', hasLogistica, `
      <div class="form-row">
        <div class="form-group"><label>Ruta de acceso al techo</label>
          <select name="accesoTecho" ${dis}>
            <option value="">— Seleccionar —</option>
            ${['Escalera interna','Escalera telescópica exterior','Requiere grúa','Otro'].map(t=>
              `<option ${lev.accesoTecho===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Almacenamiento temporal de material</label>
          <select name="almacenamientoTemporal" ${dis}>
            <option value="">— Seleccionar —</option>
            ${['Disponible en sitio','No disponible — coordinar con cliente','N/A'].map(t=>
              `<option ${lev.almacenamientoTemporal===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group"><label>Conectividad en ubicación del inversor
        <span class="form-hint">para el sistema de monitoreo</span></label>
        <select name="conectividadInversor" ${dis}>
          <option value="">— Seleccionar —</option>
          ${['Buena (WiFi/datos estables)','Regular (intermitente)','Sin señal — requiere módem/SIM dedicado'].map(t=>
            `<option ${lev.conectividadInversor===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Notas de logística <span class="form-hint">grúa, restricciones de acceso, horarios, etc.</span></label>
        <textarea name="logisticaNotas" rows="2" ${dis}>${esc(lev.logisticaNotas||'')}</textarea>
      </div>
    `)}

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
