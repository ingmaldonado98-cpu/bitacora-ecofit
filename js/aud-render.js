// aud-render.js — Renderizado del módulo Auditoría Técnica

import { projects } from './db.js';
import { esc, fotoMini } from './utils.js';
import { canEdit, isAdmin, isLider } from './auth.js';
import { icon } from './icons.js';
import { renderFirmaBlock } from './project.js';
import { CHECKLIST_RAPIDO, CHECKLIST_FORMAL, MEDICIONES, RESULTADOS_FORMAL } from './aud-data.js';
import { AS } from './aud-state.js';

// ── Render principal ──────────────────────────────────────────────────────────
export async function renderAuditoria(projectId, session) {
  const project = await projects.getById(projectId);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';

  if (!isAdmin(session) && !isLider(session)) {
    return '<p class="empty-msg">Sin acceso a esta sección.</p>';
  }

  const edit = canEdit(session, project) || isAdmin(session);
  const aud  = project.auditoria || {};
  const modo = aud.modo || 'rapido';

  AS.edit = edit;
  AS.projectId = projectId;
  AS.rapidoMap = { ...(aud.rapidoChecklist || {}) };
  AS.formalMap = { ...(aud.formalChecklist || {}) };
  AS.formalObs = { ...(aud.formalObs || {}) };

  return `
  <div class="breadcrumb">
    <span class="bc-link" onclick="navigate('#dashboard')">Inicio</span>
    <span class="bc-sep">›</span>
    <span class="bc-link" onclick="navigate('#proyecto/${projectId}')">${esc(project.displayId)}</span>
    <span class="bc-sep">›</span>
    <span class="bc-current">Auditoría</span>
  </div>
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}')">
      ${icon('caret-left')}
    </button>
    <h1 class="hdr-title">Auditoría Técnica</h1>
    <span class="hdr-sub">${esc(project.displayId)}</span>
  </div>

  <!-- Selector de modo -->
  <div class="aud-mode-bar">
    <button class="aud-mode-btn ${modo === 'rapido' ? 'aud-mode-active' : ''}"
            onclick="switchAudMode('${projectId}','rapido')">
      ${icon('lightning', 14)} Rápido <span class="aud-mode-sub">campo · 5 min</span>
    </button>
    <button class="aud-mode-btn ${modo === 'formal' ? 'aud-mode-active' : ''}"
            onclick="switchAudMode('${projectId}','formal')">
      ${icon('certificate', 14)} Formal <span class="aud-mode-sub">dictamen · NOM-001-SEDE</span>
    </button>
  </div>

  <div id="aud-content">
    ${modo === 'rapido' ? renderRapido(project, aud, edit, session) : renderFormal(project, aud, edit)}
  </div>

  ${(() => {
    const modo = project.auditoria?.modo || 'rapido';
    const aud  = project.auditoria || {};

    // Completud para habilitar firma
    let firmaReady = false, firmaHint = '';
    if (modo === 'formal') {
      const fcl  = aud.formalChecklist || {};
      const done = CHECKLIST_FORMAL.filter(i => fcl[i.id]).length;
      firmaReady = !!aud.resultado && done === CHECKLIST_FORMAL.length;
      if (!aud.resultado) firmaHint = 'Selecciona el dictamen (Cumple / No Cumple / Observaciones)';
      else if (done < CHECKLIST_FORMAL.length) firmaHint = `Faltan ${CHECKLIST_FORMAL.length - done} ítems del checklist`;
    } else {
      firmaReady = !!aud.rapidoFecha;
      if (!firmaReady) firmaHint = 'Guarda la verificación rápida primero';
    }

    return renderFirmaBlock(project, projectId, 'aud', session, { ready: firmaReady, hint: firmaHint });
  })()}
  `;
}

// ── Modo Rápido ───────────────────────────────────────────────────────────────
function renderRapido(project, aud, edit, session) {
  const cl = aud.rapidoChecklist || {};
  const done = CHECKLIST_RAPIDO.filter(i => cl[i.id]).length;
  const total = CHECKLIST_RAPIDO.length;
  const pct = Math.round(done / total * 100);

  // Agrupar por sección
  const sections = {};
  CHECKLIST_RAPIDO.forEach(item => {
    if (!sections[item.sec]) sections[item.sec] = [];
    sections[item.sec].push(item);
  });

  return `
  <div class="card">
    <div class="card-title-row">
      <h3 class="card-title">Datos del técnico</h3>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Nombre del técnico</label>
        <input type="text" id="rq-tecnico" value="${esc(aud.rapidoTecnico||session?.nombre||'')}"
               placeholder="Nombre completo" ${!edit?'disabled':''}/></div>
      <div class="form-group"><label>Fecha de puesta en marcha</label>
        <input type="date" id="rq-fecha" value="${(aud.rapidoFecha||'').split('T')[0]}"
               ${!edit?'disabled':''}/></div>
    </div>
  </div>

  <div class="card">
    <div class="card-title-row">
      <h3 class="card-title">Verificación rápida</h3>
      <span class="aud-prog-lbl">${done} / ${total}</span>
    </div>
    <div class="aud-prog-bar-wrap">
      <div class="aud-prog-bar" id="rq-prog-bar" style="width:${pct}%"></div>
    </div>

    ${Object.entries(sections).map(([sec, items]) => `
    <div class="aud-sec-header">${esc(sec)}</div>
    <div class="aud-rapido-grid">
      ${items.map(item => {
        const val = cl[item.id] || '';
        return `
        <div class="aud-rapido-row">
          <span class="aud-rapido-label">${esc(item.label)}</span>
          <div class="aud-rapido-btns">
            <button type="button" class="rq-btn rq-si  ${val==='si' ?'rq-active rq-active-si' :''}"
              onclick="setRapido('${item.id}','si',this,'${project.id}')" ${!edit?'disabled':''}>SÍ</button>
            <button type="button" class="rq-btn rq-no  ${val==='no' ?'rq-active rq-active-no' :''}"
              onclick="setRapido('${item.id}','no',this,'${project.id}')" ${!edit?'disabled':''}>NO</button>
            <button type="button" class="rq-btn rq-na  ${val==='na' ?'rq-active rq-active-na' :''}"
              onclick="setRapido('${item.id}','na',this,'${project.id}')" ${!edit?'disabled':''}>N/A</button>
          </div>
        </div>`;
      }).join('')}
    </div>`).join('')}
  </div>

  <div class="card">
    <h3 class="card-title">Observaciones</h3>
    <textarea id="rq-obs" rows="3" placeholder="Notas del técnico…" ${!edit?'disabled':''}>${esc(aud.rapidoObs||'')}</textarea>
  </div>

  ${edit ? `
  <div class="form-actions">
    <button class="btn-primary" id="btn-rq-save" onclick="guardarRapido('${project.id}')">
      ${icon('floppy-disk', 14)} Guardar verificación
    </button>
  </div>` : ''}

  ${aud.rapidoFecha ? `
  <div class="resultado-banner" style="background:rgba(82,183,136,.12);border-color:#52B788">
    ${icon('check-circle', 20)}
    <span style="color:#52B788;font-weight:700">Verificación completada</span>
    <span>${esc(aud.rapidoTecnico||'')} · ${new Date(aud.rapidoFecha).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})}</span>
  </div>` : ''}
  `;
}

// ── Modo Formal ───────────────────────────────────────────────────────────────
function renderFormal(project, aud, edit) {
  const fcl  = aud.formalChecklist || {};
  const fobs = aud.formalObs       || {};
  const med  = aud.mediciones      || {};

  const done  = CHECKLIST_FORMAL.filter(i => fcl[i.id]).length;
  const total = CHECKLIST_FORMAL.length;
  const pct   = Math.round(done / total * 100);

  // Agrupar por sección
  const sections = {};
  CHECKLIST_FORMAL.forEach(item => {
    if (!sections[item.sec]) sections[item.sec] = [];
    sections[item.sec].push(item);
  });

  return `
  <form id="form-auditoria-formal" onsubmit="guardarFormal(event,'${project.id}')">

  <!-- Datos de identificación -->
  <div class="card">
    <h3 class="card-title">Identificación del proyecto</h3>
    <div class="form-row">
      <div class="form-group"><label>Capacidad DC (kWp)</label>
        <input type="number" name="kwp" step="0.01" value="${esc(aud.kwp||'')}"
               placeholder="3.20" ${!edit?'disabled':''}/></div>
      <div class="form-group"><label>Capacidad AC (kW)</label>
        <input type="number" name="kwac" step="0.01" value="${esc(aud.kwac||'')}"
               placeholder="3.00" ${!edit?'disabled':''}/></div>
    </div>
    <div class="form-group"><label>Tipo de instalación</label>
      <select name="tipoInstalacion" ${!edit?'disabled':''}>
        ${['Residencial','Comercial','Industrial','Lugar de concentración pública'].map(t =>
          `<option ${(aud.tipoInstalacion||'Residencial')===t?'selected':''}>${t}</option>`
        ).join('')}
      </select>
    </div>
  </div>

  <!-- Datos del auditor -->
  <div class="card">
    <h3 class="card-title">Auditor</h3>
    <div class="form-group"><label>Tipo</label>
      <select name="tipo" ${!edit?'disabled':''}>
        <option value="interna" ${(aud.tipo||'interna')==='interna'?'selected':''}>Interna Ecofit</option>
        <option value="externa" ${aud.tipo==='externa'?'selected':''}>Externa (UVIE / Perito / Tercero)</option>
      </select>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Nombre del auditor *</label>
        <input type="text" name="auditorNombre" required value="${esc(aud.auditor?.nombre||'')}"
               placeholder="Nombre completo" ${!edit?'disabled':''}/></div>
      <div class="form-group"><label>No. Acreditación / Registro</label>
        <input type="text" name="auditorAcreditacion" value="${esc(aud.auditor?.acreditacion||'')}"
               placeholder="UVIE-001 / Opcional" ${!edit?'disabled':''}/></div>
    </div>
    <div class="form-group"><label>Empresa / Unidad de Inspección</label>
      <input type="text" name="auditorEmpresa" value="${esc(aud.auditor?.empresa||'')}"
             ${!edit?'disabled':''}/></div>
    <div class="form-group"><label>Norma aplicable</label>
      <input type="text" name="norma" value="${esc(aud.norma||'NOM-001-SEDE-2012 — Art. 690 / 705 · CFE G0100-04')}"
             ${!edit?'disabled':''}/></div>
  </div>

  <!-- Checklist técnico formal -->
  <div class="card">
    <div class="card-title-row">
      <h3 class="card-title">Checklist técnico</h3>
      <span class="aud-prog-lbl" id="fm-prog-lbl">${done} / ${total}</span>
    </div>
    <div class="aud-prog-bar-wrap">
      <div class="aud-prog-bar" id="fm-prog-bar" style="width:${pct}%"></div>
    </div>

    ${Object.entries(sections).map(([sec, items]) => `
    <div class="aud-sec-header">${esc(sec)}</div>
    <div class="checklist-grid">
      ${items.map(item => {
        const val = fcl[item.id] || '';
        return `
        <div class="check-item aud-formal-item">
          <div class="aud-formal-main">
            <span class="aud-formal-label">${esc(item.label)}</span>
            <span class="aud-formal-ref">${esc(item.ref)}</span>
          </div>
          <div class="check-item-btns">
            <button type="button" class="chk-btn chk-ok  ${val==='ok'        ?'chk-active':''}"
              onclick="setFormal('${item.id}','ok',this,'${project.id}')" ${!edit?'disabled':''}>✓ OK</button>
            <button type="button" class="chk-btn chk-no  ${val==='no_cumple' ?'chk-active':''}"
              onclick="setFormal('${item.id}','no_cumple',this,'${project.id}')" ${!edit?'disabled':''}>✕ NC</button>
            <button type="button" class="chk-btn chk-na  ${val==='na'        ?'chk-active':''}"
              onclick="setFormal('${item.id}','na',this,'${project.id}')" ${!edit?'disabled':''}>N/A</button>
          </div>
        </div>
        ${edit ? `
        <div class="aud-item-obs-wrap">
          <input type="text" class="aud-item-obs" placeholder="Observación (opcional)"
                 value="${esc(fobs[item.id]||'')}"
                 onchange="setFormalObs('${item.id}',this.value,'${project.id}')">
        </div>` : (fobs[item.id] ? `<div class="aud-item-obs-static">${esc(fobs[item.id])}</div>` : '')}
        `;
      }).join('')}
    </div>`).join('')}
  </div>

  <!-- Mediciones eléctricas -->
  <div class="card">
    <h3 class="card-title">Mediciones eléctricas</h3>
    <div class="aud-med-table">
      <div class="aud-med-header">
        <span>Parámetro</span><span>Valor medido</span><span>Referencia</span>
      </div>
      ${MEDICIONES.map(m => `
      <div class="aud-med-row">
        <span class="aud-med-label">${esc(m.label)}</span>
        <div class="aud-med-input-wrap">
          <input type="number" step="any" name="med_${m.id}" value="${esc(med[m.id]||'')}"
                 placeholder="—" class="aud-med-input" ${!edit?'disabled':''}/>
          <span class="aud-med-unit">${m.unit}</span>
        </div>
        <span class="aud-med-ref">${esc(m.ref)}</span>
      </div>`).join('')}
    </div>
  </div>

  <!-- Resultado / Dictamen -->
  <div class="card">
    <h3 class="card-title">Dictamen formal</h3>
    <div class="chip-group" id="chip-resultado">
      ${Object.entries(RESULTADOS_FORMAL).map(([k, v]) => `
        <button type="button" class="chip resultado-chip ${aud.resultado===k?'chip-active':''}"
          style="${aud.resultado===k?`background:${v.color};color:#0f1a14`:''}"
          onclick="setResultadoFormal('${k}','${v.color}',this)">${v.label}</button>
      `).join('')}
    </div>
    <input type="hidden" id="fm-resultado" name="resultado" value="${aud.resultado||''}">

    <div class="form-group" style="margin-top:14px"><label>Observaciones del auditor</label>
      <textarea name="observaciones" rows="3" placeholder="Hallazgos y notas…"
                ${!edit?'disabled':''}>${esc(aud.observaciones||'')}</textarea>
    </div>
    <div class="form-group"><label>Condiciones para aprobación diferida</label>
      <textarea name="condicionesAprobacion" rows="2"
                placeholder="Correcciones requeridas antes de re-inspección…"
                ${!edit?'disabled':''}>${esc(aud.condicionesAprobacion||'')}</textarea>
    </div>
  </div>

  <!-- Documento firmado -->
  <div class="card">
    <h3 class="card-title">Documento / dictamen firmado</h3>
    <div class="foto-slot">
      ${aud.docFirmado
        ? `${fotoMini(aud.docFirmado,'Documento firmado')}
           ${edit ? `<button type="button" class="btn-del-foto" onclick="delDocFirmado('${project.id}')">✕</button>` : ''}`
        : (edit ? `<div class="empty-state">
            <div class="empty-state-icon">📄</div>
            <p class="empty-state-msg">Sin documento firmado.<br>Fotografía o escanea la hoja de entrega.</p>
            <button type="button" class="empty-state-cta" onclick="capDocFirmado('${project.id}')">Capturar documento</button>
          </div>` : '<p class="empty-msg-sm">Sin documento.</p>')}
    </div>
    <div id="slot-doc-firmado"></div>
    <div class="form-group" style="margin-top:12px">
      <label class="check-chip ${aud.incluirEnPDF?'check-active':''}">
        <input type="checkbox" name="incluirEnPDF" id="cb-incluir-pdf"
               ${aud.incluirEnPDF?'checked':''} ${!edit?'disabled':''}>
        Incluir auditoría en PDF del proyecto
      </label>
    </div>
  </div>

  ${edit ? `<div class="form-actions">
    <button type="submit" class="btn-primary" id="btn-fm-save">
      ${icon('floppy-disk', 14)} Guardar dictamen
    </button>
  </div>` : ''}

  </form>

  ${aud.resultado ? `
  <div class="resultado-banner" style="background:${RESULTADOS_FORMAL[aud.resultado]?.color}22;border-color:${RESULTADOS_FORMAL[aud.resultado]?.color}">
    ${icon('certificate', 24)}
    <span style="color:${RESULTADOS_FORMAL[aud.resultado]?.color};font-weight:700">
      ${RESULTADOS_FORMAL[aud.resultado]?.label}
    </span>
    ${aud.auditor?.nombre ? `<span>— ${esc(aud.auditor.nombre)}</span>` : ''}
  </div>` : ''}
  `;
}
