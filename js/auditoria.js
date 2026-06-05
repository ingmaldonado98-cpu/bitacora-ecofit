// auditoria.js — Módulo Auditoría Técnica Ecofit V6
// Dos modos: Rápido (campo, 5 min) y Formal (dictamen NOM-001-SEDE)

import { projects } from './db.js';
import { esc, fotoMini, capturePhoto, toast, isoNow, confirmDialog } from './utils.js';
import { canEdit, isAdmin, isLider } from './auth.js';
import { icon } from './icons.js';

// ── Checklist RÁPIDO — 20 ítems en 6 secciones ────────────────────────────────
const CHECKLIST_RAPIDO = [
  { id: 'r1',  sec: 'Estructura y paneles',      label: 'Tornillería con torque firme — paneles no se mueven' },
  { id: 'r2',  sec: 'Estructura y paneles',      label: 'Paneles orientados al sur, libres de sombras' },
  { id: 'r3',  sec: 'Estructura y paneles',      label: 'Estructura bien anclada, no se mueve al jalarla' },
  { id: 'r4',  sec: 'Cableado',                  label: 'Cables DC tipo PV Wire (resistentes al sol y la intemperie)' },
  { id: 'r5',  sec: 'Cableado',                  label: 'Conectores MC4 hacen clic y no se sueltan al jalar' },
  { id: 'r6',  sec: 'Cableado',                  label: 'Cableado dentro de tubería metálica al entrar a la casa' },
  { id: 'r7',  sec: 'Protecciones e inversor',   label: 'Inversor con espacio libre de ventilación a los lados' },
  { id: 'r8',  sec: 'Protecciones e inversor',   label: 'Fusibles y breakers del calibre indicado en el plano' },
  { id: 'r9',  sec: 'Protecciones e inversor',   label: 'Supresores de picos (DPS) instalados en DC y AC' },
  { id: 'r10', sec: 'Protecciones e inversor',   label: 'Interruptores de desconexión accesibles y a la vista' },
  { id: 'r11', sec: 'Tierra física',             label: 'Marcos de paneles conectados al cable de tierra' },
  { id: 'r12', sec: 'Tierra física',             label: 'Arandelas de estrella (WEEB) en cada conexión de tierra' },
  { id: 'r13', sec: 'Tierra física',             label: 'Cable de tierra llega hasta la varilla enterrada' },
  { id: 'r14', sec: 'Etiquetado',                label: 'Tuberías con calcomanía "Fuente de Energía Fotovoltaica"' },
  { id: 'r15', sec: 'Etiquetado',                label: 'Tablero con letrero "Precaución: Dos fuentes de energía"' },
  { id: 'r16', sec: 'Prueba final',              label: 'Polaridad verificada con multímetro — positivo y negativo correctos' },
  { id: 'r17', sec: 'Prueba final',              label: 'Voltaje de cadena no supera el límite máximo del inversor' },
  { id: 'r18', sec: 'Prueba final',              label: 'Anti-isla: inversor se apaga al bajar el interruptor principal' },
  { id: 'r19', sec: 'Prueba final',              label: 'Inversor sin errores — estado Normal / luz verde' },
  { id: 'r20', sec: 'Prueba final',              label: 'Entrega explicada y firmada con el cliente' },
];

// ── Checklist FORMAL — 20 ítems en 10 secciones con referencia normativa ──────
const CHECKLIST_FORMAL = [
  { id: 'f1',  sec: 'Estructura y sujeción mecánica', label: 'Rieles y montajes resistentes a cargas de viento', ref: 'Art. 690.4(C)' },
  { id: 'f2',  sec: 'Estructura y sujeción mecánica', label: 'Materiales compatibles — sin par galvánico Aluminio/Acero', ref: 'Art. 110.3(B)' },
  { id: 'f3',  sec: 'Paneles fotovoltaicos',          label: 'Marcado visible: Voc, Isc, Vmp, Imp, Max System Voltage', ref: 'Art. 690.51' },
  { id: 'f4',  sec: 'Paneles fotovoltaicos',          label: 'Módulos certificados UL 1703 / IEC 61215', ref: 'Art. 690.4(D)' },
  { id: 'f5',  sec: 'Cableado DC',                    label: 'Conductor tipo PV resistente a rayos UV en áreas expuestas', ref: 'Art. 690.31(B)' },
  { id: 'f6',  sec: 'Cableado DC',                    label: 'Canalización metálica en conductores DC que entran a edificios', ref: 'Art. 690.31(E)' },
  { id: 'f7',  sec: 'Cableado AC',                    label: 'Ampacidad al 125% de la corriente de salida del inversor', ref: 'Art. 690.8' },
  { id: 'f8',  sec: 'Cableado AC',                    label: 'Fase, neutro y tierra en la misma canalización', ref: 'Art. 300.3(B)' },
  { id: 'f9',  sec: 'Protecciones DC',                label: 'Fusibles de cadena: 1.56 a 2.4 × Isc del módulo', ref: 'Art. 690.9' },
  { id: 'f10', sec: 'Protecciones DC',                label: 'Supresor de picos DPS DC instalado y conectado a tierra', ref: 'Guía Técnica CFE' },
  { id: 'f11', sec: 'Protecciones AC',                label: 'Regla del 120% cumplida en el bus del tablero', ref: 'Art. 690.64(B)' },
  { id: 'f12', sec: 'Protecciones AC',                label: 'Desconectador visible, bloqueable y accesible para CFE', ref: 'Art. 690.13 / G0100-04' },
  { id: 'f13', sec: 'Inversor / Cargador',            label: 'Certificación anti-isla UL 1741 / IEEE 1547 — desconexión < 0.5 s', ref: 'Anexo II CFE' },
  { id: 'f14', sec: 'Inversor / Cargador',            label: 'Protección contra falla de arco (AFCI) integrada', ref: 'Art. 690.11' },
  { id: 'f15', sec: 'Tierra física',                  label: 'Continuidad en marcos de paneles con arandelas estrella (WEEB)', ref: 'Art. 690.43' },
  { id: 'f16', sec: 'Tierra física',                  label: 'Resistencia del electrodo de tierra < 25 Ω', ref: 'Art. 250' },
  { id: 'f17', sec: 'Etiquetado y señalización',      label: 'Letrero "SISTEMA FOTOVOLTAICO" en tablero y desconectadores', ref: 'Art. 690.56' },
  { id: 'f18', sec: 'Etiquetado y señalización',      label: 'Marcado "Peligro: Fuentes Múltiples de Energía"', ref: 'Art. 690.56(B)' },
  { id: 'f19', sec: 'Puesta en marcha',               label: 'Polaridad verificada antes de la conexión al inversor', ref: 'Manual Puesta en Marcha' },
  { id: 'f20', sec: 'Puesta en marcha',               label: 'Torque aplicado según especificaciones del fabricante', ref: 'Manual Puesta en Marcha' },
];

const MEDICIONES = [
  { id: 'voc',        label: 'Voltaje Voc (cadena)',         unit: 'V',  ref: 'No superar Voc máx. del inversor' },
  { id: 'isc',        label: 'Corriente Isc (cadena)',       unit: 'A',  ref: 'Isc módulo × 1.25' },
  { id: 'vmpp',       label: 'Voltaje Vmpp (operación)',     unit: 'V',  ref: 'Dentro del rango MPPT del inversor' },
  { id: 'aislamiento',label: 'Resistencia de aislamiento',  unit: 'MΩ', ref: '> 1 MΩ a 1000 V' },
  { id: 'tierra',     label: 'Resistencia a tierra',        unit: 'Ω',  ref: '< 25 Ω' },
];

const RESULTADOS_FORMAL = {
  aprobado:          { label: 'Aprobado',                      color: '#52B788' },
  aprobado_con_obs:  { label: 'Aprobado con observaciones',    color: '#f5c400' },
  no_aprobado:       { label: 'No aprobado',                   color: '#ef4444' },
};

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

  _edit = edit;
  _projectId = projectId;

  return `
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
    ${modo === 'rapido' ? renderRapido(project, aud, edit) : renderFormal(project, aud, edit)}
  </div>
  `;
}

// ── Modo Rápido ───────────────────────────────────────────────────────────────
function renderRapido(project, aud, edit) {
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
            <button type="button" class="empty-state-cta" onclick="capDocFirmado()">Capturar documento</button>
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

// ── Estado del módulo ─────────────────────────────────────────────────────────
let _rapidoMap  = {};
let _formalMap  = {};
let _formalObs  = {};
let _docFirmadoB64 = null;
let _edit = false;
let _projectId  = null;

// ── Switch modo ───────────────────────────────────────────────────────────────
window.switchAudMode = async function(projectId, modo) {
  const p = await projects.getById(projectId);
  const aud = p.auditoria || {};
  aud.modo = modo;
  await projects.update(projectId, { auditoria: aud });
  navigate(`#proyecto/${projectId}/auditoria`);
};

// ── Rápido: toggle ítem ───────────────────────────────────────────────────────
window.setRapido = async function(itemId, val, btn, projectId) {
  _rapidoMap[itemId] = val;

  const row = btn.closest('.aud-rapido-btns');
  row.querySelectorAll('.rq-btn').forEach(b => {
    b.classList.remove('rq-active','rq-active-si','rq-active-no','rq-active-na');
  });
  btn.classList.add('rq-active', `rq-active-${val}`);

  const done  = CHECKLIST_RAPIDO.filter(i => _rapidoMap[i.id]).length;
  const pct   = Math.round(done / CHECKLIST_RAPIDO.length * 100);
  const bar   = document.getElementById('rq-prog-bar');
  if (bar) bar.style.width = pct + '%';

  await projects.setField(projectId, `auditoria.rapidoChecklist.${itemId}`, val);
};

// ── Rápido: guardar ───────────────────────────────────────────────────────────
window.guardarRapido = async function(projectId) {
  const btn = document.getElementById('btn-rq-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  const tecnico = document.getElementById('rq-tecnico')?.value.trim();
  const fecha   = document.getElementById('rq-fecha')?.value || isoNow();
  const obs     = document.getElementById('rq-obs')?.value.trim() || '';

  try {
    const p = await projects.getById(projectId);
    const aud = p.auditoria || {};
    aud.modo         = 'rapido';
    aud.rapidoTecnico = tecnico;
    aud.rapidoFecha  = fecha;
    aud.rapidoObs    = obs;
    await projects.update(projectId, { auditoria: aud });
    toast('✅ Verificación guardada');
    navigate(`#proyecto/${projectId}`);
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar verificación'; }
    toast(err.message || 'Error al guardar', 'error');
  }
};

// ── Formal: toggle checklist ──────────────────────────────────────────────────
window.setFormal = async function(itemId, val, btn, projectId) {
  _formalMap[itemId] = val;

  btn.closest('.check-item-btns').querySelectorAll('.chk-btn')
    .forEach(b => b.classList.remove('chk-active'));
  btn.classList.add('chk-active');

  const done = CHECKLIST_FORMAL.filter(i => _formalMap[i.id]).length;
  const pct  = Math.round(done / CHECKLIST_FORMAL.length * 100);
  const bar  = document.getElementById('fm-prog-bar');
  const lbl  = document.getElementById('fm-prog-lbl');
  if (bar) bar.style.width = pct + '%';
  if (lbl) lbl.textContent = `${done} / ${CHECKLIST_FORMAL.length}`;

  // Auto-sugerir dictamen si todos los ítems están evaluados
  if (done === CHECKLIST_FORMAL.length) {
    const hayNC = Object.values(_formalMap).some(v => v === 'no_cumple');
    const sug   = hayNC ? 'no_aprobado' : 'aprobado';
    const resEl = document.getElementById('fm-resultado');
    if (resEl && !resEl.value) {
      const chip = document.querySelector(`.resultado-chip[onclick*="${sug}"]`);
      if (chip) { chip.click(); toast(`Dictamen sugerido: ${chip.textContent.trim()}`); }
    }
  }

  await projects.setField(projectId, `auditoria.formalChecklist.${itemId}`, val);
};

// ── Formal: observación por ítem ──────────────────────────────────────────────
window.setFormalObs = async function(itemId, val, projectId) {
  _formalObs[itemId] = val;
  await projects.setField(projectId, `auditoria.formalObs.${itemId}`, val);
};

// ── Formal: resultado ─────────────────────────────────────────────────────────
window.setResultadoFormal = function(val, color, btn) {
  document.querySelectorAll('.resultado-chip').forEach(c => {
    c.classList.remove('chip-active');
    c.style.background = '';
    c.style.color = '';
  });
  btn.classList.add('chip-active');
  btn.style.background = color;
  btn.style.color = '#0f1a14';
  document.getElementById('fm-resultado').value = val;
};

// ── Formal: guardar ───────────────────────────────────────────────────────────
window.guardarFormal = async function(e, projectId) {
  e.preventDefault();
  const btn = document.getElementById('btn-fm-save');
  if (btn) { btn.disabled = true; btn.classList.add('btn-saving'); btn.textContent = 'Guardando'; }

  try {
    const fd  = new FormData(e.target);
    const p   = await projects.getById(projectId);
    const aud = p.auditoria || {};

    const mediciones = {};
    MEDICIONES.forEach(m => {
      const v = fd.get(`med_${m.id}`);
      if (v) mediciones[m.id] = v;
    });

    Object.assign(aud, {
      modo:                 'formal',
      kwp:                  fd.get('kwp') || null,
      kwac:                 fd.get('kwac') || null,
      tipoInstalacion:      fd.get('tipoInstalacion'),
      tipo:                 fd.get('tipo'),
      auditor: {
        nombre:       fd.get('auditorNombre').trim(),
        empresa:      fd.get('auditorEmpresa').trim(),
        acreditacion: fd.get('auditorAcreditacion').trim(),
      },
      norma:                fd.get('norma').trim(),
      mediciones,
      resultado:            fd.get('resultado'),
      observaciones:        fd.get('observaciones').trim(),
      condicionesAprobacion:fd.get('condicionesAprobacion').trim(),
      incluirEnPDF:         fd.get('incluirEnPDF') === 'on',
      docFirmado:           _docFirmadoB64 || aud.docFirmado || null,
      fecha:                isoNow(),
    });

    await projects.update(projectId, { auditoria: aud });
    _docFirmadoB64 = null;
    toast('✅ Dictamen guardado');
    navigate(`#proyecto/${projectId}`);
  } catch (err) {
    if (btn) { btn.disabled = false; btn.classList.remove('btn-saving'); btn.textContent = 'Guardar dictamen'; }
    toast(err.message || 'Error al guardar', 'error');
  }
};

// ── Foto documento firmado ────────────────────────────────────────────────────
window.capDocFirmado = function() {
  capturePhoto(b64 => {
    _docFirmadoB64 = b64;
    const slot = document.getElementById('slot-doc-firmado');
    if (slot) slot.innerHTML = fotoMini(b64, 'Documento firmado');
    toast('Foto del documento capturada');
  });
};

window.delDocFirmado = async function(projectId) {
  if (!await confirmDialog('¿Eliminar documento firmado?')) return;
  const p = await projects.getById(projectId);
  if (p.auditoria) p.auditoria.docFirmado = null;
  await projects.update(projectId, { auditoria: p.auditoria });
  navigate(`#proyecto/${projectId}/auditoria`);
};
