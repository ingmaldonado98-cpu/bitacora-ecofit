// documentacion.js — Módulo 2: Levantamiento dinámico + Fases Antes/Durante/Después

import { projects } from './db.js';
import { esc, fmtFechaHora, fotoMini, capturePhoto, toast, uuid, isoNow, confirmDialog, inputDialog, uploadProgressBar } from './utils.js';
import { canEdit, isAdmin } from './auth.js';
import { uploadPhotoQueued, uploadPhoto } from './firebase.js';
import { icon } from './icons.js';

// ── Vista principal ────────────────────────────────────────────────────────────
export async function renderDocumentacion(projectId, session) {
  const project = await projects.getById(projectId);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';
  const edit = canEdit(session, project);
  const tipo = project.tipoSistema || 'otro';

  // Contar fotos por fase para badges
  const fases = project.documentacion?.fases || {};
  const cAntes   = (fases.antes   || []).length;
  const cDurante = (fases.durante || []).length;
  const cDespues = (fases.despues || []).length;
  const cNotas   = (project.documentacion?.notas || []).length;
  const totalFases = cAntes + cDurante + cDespues;

  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}')">
      ${icon('caret-left')}
    </button>
    <h1 class="hdr-title">Documentación</h1>
    <span class="hdr-sub">${esc(project.displayId)}</span>
  </div>

  <div class="tab-bar" id="doc-tabs">
    <button class="tab-btn tab-active" data-tab="d-lev"
            onclick="switchTab('doc-tabs','d-lev',this)">
      ${icon('clipboard-text', 14)} Levantamiento
    </button>
    <button class="tab-btn" data-tab="d-fases"
            onclick="switchTab('doc-tabs','d-fases',this)">
      ${icon('camera', 14)} Fases
      ${totalFases > 0 ? `<span class="tab-badge tab-ok">${totalFases}</span>` : ''}
    </button>
    <button class="tab-btn" data-tab="d-notas"
            onclick="switchTab('doc-tabs','d-notas',this)">
      ${icon('note', 14)} Notas
      ${cNotas ? `<span class="tab-badge tab-ok">${cNotas}</span>` : ''}
    </button>
  </div>

  <!-- Tab 1: Levantamiento -->
  <div id="d-lev" class="tab-panel tab-panel-active">
    ${renderLevantamiento(project, tipo, edit)}
  </div>

  <!-- Tab 2: Fases (Antes / Durante / Cierre) -->
  <div id="d-fases" class="tab-panel">
    <div class="fase-selector">
      <button class="fase-btn fase-active" id="fase-btn-antes"
              onclick="switchFase('antes',this,'${projectId}')">
        <span class="fase-ico">🏗️</span>
        Antes
        ${cAntes ? `<span class="fase-count">${cAntes}</span>` : ''}
      </button>
      <button class="fase-btn" id="fase-btn-durante"
              onclick="switchFase('durante',this,'${projectId}')">
        <span class="fase-ico">🔧</span>
        Durante
        ${cDurante ? `<span class="fase-count">${cDurante}</span>` : ''}
      </button>
      <button class="fase-btn" id="fase-btn-despues"
              onclick="switchFase('despues',this,'${projectId}')">
        <span class="fase-ico">✅</span>
        Cierre
        ${cDespues ? `<span class="fase-count">${cDespues}</span>` : ''}
      </button>
    </div>

    <div id="fase-panel-antes" class="fase-panel fase-panel-active">
      ${renderFase(project, 'antes', 'Antes de la instalación', projectId, edit)}
    </div>
    <div id="fase-panel-durante" class="fase-panel">
      ${renderFase(project, 'durante', 'Durante la instalación', projectId, edit)}
    </div>
    <div id="fase-panel-despues" class="fase-panel">
      ${renderFase(project, 'despues', 'Cierre general', projectId, edit, false)}
    </div>
  </div>

  <!-- Tab 3: Notas -->
  <div id="d-notas" class="tab-panel">
    <div class="card">
      <div class="card-title-row">
        <h3 class="card-title">Notas de documentación</h3>
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
  <script>
    (function() {
      const tabTarget  = sessionStorage.getItem('doc-tab-target');
      const faseTarget = sessionStorage.getItem('doc-fase-target');
      if (tabTarget) {
        sessionStorage.removeItem('doc-tab-target');
        const tabBtn = document.querySelector('[data-tab="' + tabTarget + '"]');
        if (tabBtn) tabBtn.click();
      }
      if (faseTarget) {
        sessionStorage.removeItem('doc-fase-target');
        const faseBtn = document.getElementById('fase-btn-' + faseTarget);
        if (faseBtn) faseBtn.click();
      }
    })();
  </script>
  `;
}

// ── Levantamiento dinámico ─────────────────────────────────────────────────────
function renderLevantamiento(project, tipo, edit) {
  const lev = project.documentacion?.levantamiento || {};
  const dis = edit ? '' : 'disabled';
  const pid = project.id;

  // Reinicializar campos libres con los datos del proyecto (evita estado stale)
  _camposLibres = [...(lev.camposLibres || [])];

  // Detectar si secciones tienen datos para abrir acordeón pre-llenado
  const hasSitio   = !!(lev.tipTecho || lev.azimut || lev.distTableroInversor);
  const hasElec    = !!(lev.tipoServicioCFE || lev.tierraFisica || lev.centroCarga);
  const hasSombras = !!(lev.sombras?.checklist?.length || lev.sombras?.foto || lev.sombras?.notas);
  const hasConsumo = !!(lev.recibos?.length || lev.aparatos?.length || lev.tarifaCFE);
  const hasCampos  = !!lev.camposLibres?.length;

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

    ${acc('sitio', 'Datos del techo y sitio', '🏠', true, `
      <div class="form-row">
        <div class="form-group"><label>Tipo de techo</label>
          <select name="tipTecho" ${dis}>
            ${['Losa de concreto','Teja','Lámina','Metálico','Otro'].map(t=>
              `<option ${lev.tipTecho===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Orientación</label>
          <select name="orientacion" ${dis}>
            ${['Sur','Poniente','Oriente','Norte','Sur-Poniente','Sur-Oriente'].map(t=>
              `<option ${lev.orientacion===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Azimut (°)</label>
          <input type="number" name="azimut" value="${lev.azimut||''}" placeholder="180" ${dis}/></div>
        <div class="form-group"><label>Inclinación del techo (°)</label>
          <input type="number" name="inclinacion" value="${lev.inclinacion||''}" placeholder="15" ${dis}/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Dist. tablero→inversor (m)</label>
          <input type="number" name="distTableroInversor" value="${lev.distTableroInversor||''}" step="0.5" ${dis}/></div>
        <div class="form-group"><label>Dist. inversor→paneles (m)</label>
          <input type="number" name="distInversorPaneles" value="${lev.distInversorPaneles||''}" step="0.5" ${dis}/></div>
      </div>
      <div class="form-group"><label>Área disponible en techo (m²)</label>
        <input type="number" name="areaDisponible" value="${lev.areaDisponible||''}" step="0.5" ${dis}/></div>
    `)}

    ${acc('elec', 'Estado eléctrico existente', '⚡', hasElec, `
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

    ${dinamico ? acc('consumo', 'Consumo y configuración del sistema', '📊', hasConsumo, dinamico) : ''}

    ${acc('obs', 'Observaciones generales', '📝', !!(lev.observacionesGenerales), `
      <div class="form-group">
        <textarea name="observacionesGenerales" rows="3" ${dis}
          placeholder="Condiciones especiales, acuerdos con cliente, pendientes…"
        >${esc(lev.observacionesGenerales||'')}</textarea>
      </div>
    `)}

    ${acc('campos', 'Campos adicionales', '➕', hasCampos, `
      <div id="campos-libres">
        ${(lev.camposLibres||[]).map((c,i)=>`
          <div class="campo-libre-row">
            <input type="text" placeholder="Nombre" value="${esc(c.nombre)}" ${dis}
                   oninput="updCampoLibre(${i},'nombre',this.value)" />
            <input type="text" placeholder="Valor" value="${esc(c.valor)}" ${dis}
                   oninput="updCampoLibre(${i},'valor',this.value)" />
            ${edit?`<button type="button" class="btn-del-sm" onclick="delCampoLibre(${i})">✕</button>`:''}
          </div>`).join('')}
      </div>
      ${edit ? `<button type="button" class="btn-sm btn-outline" style="margin-top:8px"
                        onclick="addCampoLibre()">+ Agregar campo</button>` : ''}
    `)}

    ${edit?`<div class="form-actions lev-actions">
      <span id="lev-autosave" class="autosave-indicator"></span>
      <button type="submit" class="btn-primary">Guardar levantamiento</button>
    </div>`:''}
  </form>`;
}

function renderCamposDinamicos(tipo, lev, edit, pid) {
  const dis = edit ? '' : 'disabled';
  if (tipo === 'interconectado' || tipo === 'hibrido') {
    return `
    <div class="card">
      <h3 class="card-title">Tarifa CFE</h3>
      <select name="tarifaCFE" ${dis}>
        ${['DAC','1','1A','1B','1C','1D','1E','1F','OM','OMF','PDBT','GDMT','Otra'].map(t=>
          `<option ${lev.tarifaCFE===t?'selected':''}>${t}</option>`).join('')}
      </select>
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
    ${tipo==='hibrido'?`
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
        ${edit?`<button type="button" class="btn-outline btn-sm" onclick="addCarga('critica')">+ Carga crítica</button>`:''}
      </div>
      <div class="form-group"><label>Cargas secundarias (Baja prioridad)</label>
        <div id="cargas-secundarias">${renderCargas(lev.cargasSecundarias||[],edit,'secundaria')}</div>
        ${edit?`<button type="button" class="btn-outline btn-sm" onclick="addCarga('secundaria')">+ Carga secundaria</button>`:''}
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

  if (tipo === 'respaldo') {
    return `
    <div class="card">
      <h3 class="card-title">Sistema de respaldo</h3>
      <div class="form-group"><label>Tiempo de respaldo requerido (horas)</label>
        <input type="number" name="tiempoRespaldo" value="${lev.tiempoRespaldo||''}" min="0" step="0.5" ${dis}/></div>
      <div class="form-group"><label>Cargas a respaldar</label>
        <div id="cargas-criticas">${renderCargas(lev.cargasRespaldo||[],edit,'critica')}</div>
        ${edit?`<button type="button" class="btn-outline btn-sm" onclick="addCarga('critica')">+ Carga</button>`:''}
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

window.addAparatoRapido = function(a) { _aparatos.push({...a,cantidad:1}); refreshAparatos(); };
window.addAparato = function() { _aparatos.push({nombre:'',potencia:0,horas:0,cantidad:1}); refreshAparatos(); };
window.delAparato = function(i) { _aparatos.splice(i,1); refreshAparatos(); };
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
function renderCargas(cargas, edit, tipo) {
  _cargas[tipo] = [...cargas];
  const id = `cargas-${tipo}`;
  return _cargas[tipo].map((c,i)=>`
    <div class="carga-row">
      <input type="text" value="${esc(c.nombre)}" placeholder="Nombre" ${edit?`oninput="_cargas['${tipo}'][${i}].nombre=this.value"`:'disabled'}/>
      <input type="number" value="${c.potencia}" placeholder="W" ${edit?`oninput="_cargas['${tipo}'][${i}].potencia=parseFloat(this.value)||0"`:'disabled'}/>
      <input type="number" value="${c.horas}" placeholder="h/día" step="0.5" ${edit?`oninput="_cargas['${tipo}'][${i}].horas=parseFloat(this.value)||0"`:'disabled'}/>
      ${edit?`<button type="button" class="btn-del-sm" onclick="delCarga('${tipo}',${i})">✕</button>`:''}
    </div>`).join('');
}
window.addCarga = function(tipo) { _cargas[tipo].push({nombre:'',potencia:0,horas:0}); refreshCargas(tipo); };
window.delCarga = function(tipo,i) { _cargas[tipo].splice(i,1); refreshCargas(tipo); };
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

  const newLev = {
    ...lev,
    tipTecho:           fd.get('tipTecho'),
    orientacion:        fd.get('orientacion'),
    azimut:             parseFloat(fd.get('azimut'))||null,
    inclinacion:        parseFloat(fd.get('inclinacion'))||null,
    distTableroInversor:parseFloat(fd.get('distTableroInversor'))||null,
    distInversorPaneles:parseFloat(fd.get('distInversorPaneles'))||null,
    areaDisponible:     parseFloat(fd.get('areaDisponible'))||null,
    tipoServicioCFE:    fd.get('tipoServicioCFE'),
    tierraFisica:       fd.get('tierraFisica'),
    centroCarga:        fd.get('centroCarga'),
    sombras:            { checklist:sombrasChecklist, foto:lev.sombras?.foto||null, notas:fd.get('sombraNotas')||'' },
    observacionesGenerales: fd.get('observacionesGenerales')||'',
    camposLibres:       _camposLibres.filter(c=>c.nombre),
  };

  if (tipo==='interconectado'||tipo==='hibrido') {
    newLev.tarifaCFE   = fd.get('tarifaCFE');
    newLev.modoConsumo = modoConsumo;
    newLev.recibos     = modoConsumo==='recibo' ? _recibos : [];
    newLev.aparatos    = modoConsumo==='aparatos' ? _aparatos : [];
    if (tipo==='hibrido') { newLev.autonomia=parseFloat(fd.get('autonomia'))||null; newLev.bancoBaterias=parseFloat(fd.get('bancoBaterias'))||null; }
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
  if (tipo==='respaldo') {
    newLev.tiempoRespaldo  = parseFloat(fd.get('tiempoRespaldo'))||null;
    newLev.cargasRespaldo  = _cargas.critica;
  }

  p.documentacion = p.documentacion || {};
  p.documentacion.levantamiento = newLev;
  await projects.update(projectId, { documentacion: p.documentacion });
  // Actualizar indicador de auto-guardado
  const ind = document.getElementById('lev-autosave');
  if (ind) { ind.textContent = '✓ Guardado'; ind.className = 'autosave-indicator saved'; }
  if (!e._auto) toast('✅ Levantamiento guardado');
};

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

// ── Fases Antes / Durante / Después ──────────────────────────────────────────
function renderFase(project, fase, titulo, projectId, edit, required=false) {
  const fotos = project.documentacion?.fases?.[fase] || [];
  return `
  <div class="card-title-row">
    <h3 class="card-title">${titulo}</h3>
    ${required?'<span class="req-badge">OBLIGATORIA</span>':''}
    ${edit?`<button class="btn-primary btn-sm" onclick="agregarFoto('${projectId}','${fase}')">
      ${icon('camera')} Agregar fotos</button>`:''}
</div>
  ${fotos.length===0
    ? (edit
        ? `<div class="empty-state">
             <div class="empty-state-icon">${required ? '⚠️' : '📷'}</div>
             <p class="empty-state-msg">${required ? 'Se requiere al menos una foto.<br>Puedes seleccionar varias a la vez.' : 'Sin fotos aún.'}</p>
             <button class="empty-state-cta" onclick="agregarFoto('${projectId}','${fase}')">Agregar fotos</button>
           </div>`
        : `<p class="empty-msg-sm">${required?'⚠ Se requiere al menos una foto.':'Sin fotos aún.'}</p>`)
    : `<div class="fotos-grid" id="fotos-${fase}">
        ${fotos.map((f,i)=>`
          <div class="foto-card">
            ${fotoMini(f.data,`Foto ${i+1}`)}
            ${f.nota?`<p class="foto-nota">${esc(f.nota)}</p>`:''}
            ${edit?`
              <button class="btn-del-foto-abs" onclick="editFotaNota('${projectId}','${fase}',${i})">✎</button>
              <button class="btn-del-foto" onclick="delFotoFase('${projectId}','${fase}',${i})">✕</button>
            `:''}
          </div>`).join('')}
      </div>`}
  `;
}

// ── Acordeón helper ───────────────────────────────────────────────────────────
window.toggleAcc = function(btn, bodyId) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  const isOpen = btn.classList.toggle('acc-open');
  body.classList.toggle('acc-collapsed', !isOpen);
};

// ── Selector de fases (Antes / Durante / Cierre) ─────────────────────────────
window.switchFase = function(fase, btn) {
  // Actualizar botones
  document.querySelectorAll('.fase-btn').forEach(b => b.classList.remove('fase-active'));
  btn.classList.add('fase-active');
  // Actualizar paneles
  document.querySelectorAll('.fase-panel').forEach(p => p.classList.remove('fase-panel-active'));
  const panel = document.getElementById(`fase-panel-${fase}`);
  if (panel) panel.classList.add('fase-panel-active');
};

window.agregarFoto = function(projectId, fase) {
  capturePhoto(async (b64Array) => {
    const fotos = Array.isArray(b64Array) ? b64Array : [b64Array];
    const total = fotos.length;
    const prog = uploadProgressBar(total);
    const nuevas = [];

    for (let i = 0; i < total; i++) {
      prog.update(i + 1);
      const fid = uuid();
      const result = await uploadPhotoQueued(fotos[i], `projects/${projectId}/${fase}_${fid}.jpg`,
        projectId, 'fotoFase', { fase, itemId: fid });
      nuevas.push({
        data: result.url || (result.pending ? fotos[i] : null),
        nota: '', id: fid, createdAt: isoNow(),
        ...(result.pending && { pending: true, pendingId: result.pendingId }),
      });
    }
    prog.done();

    if (total === 1) {
      nuevas[0].nota = await inputDialog('Nota para esta foto (opcional):', '') || '';
    }

    const p = await projects.getById(projectId);
    p.documentacion = p.documentacion || {};
    p.documentacion.fases = p.documentacion.fases || { antes:[], durante:[], despues:[] };
    p.documentacion.fases[fase] = [...(p.documentacion.fases[fase]||[]), ...nuevas];
    await projects.update(projectId, { documentacion: p.documentacion });
    // Guardar target (tab 'fases' + fase específica) para restaurar después del re-render
    sessionStorage.setItem('doc-tab-target', 'd-fases');
    sessionStorage.setItem('doc-fase-target', fase);
    navigate(`#proyecto/${projectId}/documentacion`);
    toast(`✅ ${total} foto${total > 1 ? 's guardadas' : ' guardada'}`);
  }, { multiple: true });
};

window.delFotoFase = async function(projectId, fase, idx) {
  if (!await confirmDialog('¿Eliminar esta foto?')) return;
  const p = await projects.getById(projectId);
  p.documentacion.fases[fase].splice(idx,1);
  await projects.update(projectId, { documentacion: p.documentacion });
  navigate(`#proyecto/${projectId}/documentacion`);
};

window.editFotaNota = async function(projectId, fase, idx) {
  const p = await projects.getById(projectId);
  const actual = p.documentacion.fases[fase][idx].nota || '';
  const nueva = await inputDialog('Editar nota:', actual);
  if (nueva === null) return;
  p.documentacion.fases[fase][idx].nota = nueva;
  await projects.update(projectId, { documentacion: p.documentacion });
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
