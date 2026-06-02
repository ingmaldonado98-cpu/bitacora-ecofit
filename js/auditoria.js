// auditoria.js — Módulo 3: Auditoría Técnica

import { projects } from './db.js';
import { esc, fotoMini, capturePhoto, toast, isoNow, confirmDialog, inputDialog } from './utils.js';
import { canEdit, isAdmin, isLider } from './auth.js';
import { icon } from './icons.js';

const CHECKLIST_ITEMS = [
  { id: 1, label: 'Polaridad correcta' },
  { id: 2, label: 'Torque verificado' },
  { id: 3, label: 'Tierra física' },
  { id: 4, label: 'Protecciones AC' },
  { id: 5, label: 'Protecciones DC' },
  { id: 6, label: 'Etiquetado' },
  { id: 7, label: 'Canalización' },
  { id: 8, label: 'Impermeabilización' },
  { id: 9, label: 'Voltajes correctos' },
  { id: 10, label: 'Equipo energizado' },
  { id: 11, label: 'Monitoreo / Comunicación activo' },
];

const RESULTADOS = {
  aprobado:             { label: 'Aprobado',                  color: '#52B788' },
  aprobado_con_obs:     { label: 'Aprobado con observaciones', color: '#f5c400' },
  rechazado:            { label: 'Rechazado',                  color: '#ef4444' },
};

export async function renderAuditoria(projectId, session) {
  const project = await projects.getById(projectId);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';

  if (!isAdmin(session) && !isLider(session)) {
    return '<p class="empty-msg">Sin acceso a esta sección.</p>';
  }

  const edit = canEdit(session, project) || isAdmin(session);
  const aud  = project.auditoria || {};
  const checkMap = {};
  (aud.checklist || []).forEach(i => { checkMap[i.itemId] = i.resultado; });
  // Sincronizar el _checkMap del módulo con los datos del proyecto al renderizar
  _checkMap = { ...checkMap };

  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}')">
      ${icon('caret-left')}
    </button>
    <h1 class="hdr-title">Auditoría Técnica</h1>
    <span class="hdr-sub">${esc(project.displayId)}</span>
  </div>

  <form id="form-auditoria" class="form-sections" onsubmit="guardarAuditoria(event,'${projectId}')">

    <!-- Datos del auditor -->
    <div class="card">
      <h3 class="card-title">Auditor</h3>
      <div class="form-group"><label>Tipo</label>
        <select name="tipo" ${!edit?'disabled':''}>
          <option value="interna"  ${(aud.tipo||'interna')==='interna'?'selected':''}>Interna Ecofit</option>
          <option value="externa"  ${aud.tipo==='externa'?'selected':''}>Externa (UVIE / Perito / Tercero)</option>
        </select>
      </div>
      <div class="form-group"><label>Nombre del auditor *</label>
        <input type="text" name="auditorNombre" required value="${esc(aud.auditor?.nombre||'')}"
               placeholder="Nombre completo" ${!edit?'disabled':''}/>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Empresa / Entidad</label>
          <input type="text" name="auditorEmpresa" value="${esc(aud.auditor?.empresa||'')}" ${!edit?'disabled':''}/>
        </div>
        <div class="form-group"><label>No. Acreditación</label>
          <input type="text" name="auditorAcreditacion" value="${esc(aud.auditor?.acreditacion||'')}"
                 placeholder="Opcional" ${!edit?'disabled':''}/>
        </div>
      </div>
      <div class="form-group"><label>Norma aplicable</label>
        <input type="text" name="norma" value="${esc(aud.norma||'NOM-001-SEDE — Artículo 690')}"
               placeholder="NOM-001-SEDE — Art. 690 / 705" ${!edit?'disabled':''}/>
      </div>
    </div>

    <!-- Checklist 11 ítems -->
    <div class="card">
      <div class="card-title-row">
        <h3 class="card-title">Checklist técnico</h3>
        <span id="aud-progress-lbl" class="aud-prog-lbl">
          ${(() => {
            const done = CHECKLIST_ITEMS.filter(i => checkMap[i.id]).length;
            return `${done} / ${CHECKLIST_ITEMS.length}`;
          })()}
        </span>
      </div>
      <div class="aud-prog-bar-wrap">
        <div id="aud-prog-bar" class="aud-prog-bar" style="width:${Math.round((Object.keys(checkMap).length / CHECKLIST_ITEMS.length) * 100)}%"></div>
      </div>
      <div class="checklist-grid">
        ${CHECKLIST_ITEMS.map(item => {
          const val = checkMap[item.id] || '';
          return `
          <div class="check-item">
            <span class="check-item-num">${item.id}</span>
            <span class="check-item-label">${item.label}</span>
            <div class="check-item-btns">
              <button type="button" class="chk-btn chk-ok ${val==='ok'?'chk-active':''}"
                onclick="setCheck(${item.id},'ok',this)" ${!edit?'disabled':''}>✓ OK</button>
              <button type="button" class="chk-btn chk-no ${val==='no_cumple'?'chk-active':''}"
                onclick="setCheck(${item.id},'no_cumple',this)" ${!edit?'disabled':''}>✕ No</button>
              <button type="button" class="chk-btn chk-na ${val==='na'?'chk-active':''}"
                onclick="setCheck(${item.id},'na',this)" ${!edit?'disabled':''}>N/A</button>
            </div>
          </div>`;
        }).join('')}
      </div>
      <input type="hidden" id="checklist-json" name="checklistJson"
             value='${JSON.stringify(aud.checklist||[])}'>
    </div>

    <!-- Resultado -->
    <div class="card">
      <h3 class="card-title">Resultado</h3>
      <div class="chip-group" id="chip-resultado">
        ${Object.entries(RESULTADOS).map(([k,v]) => `
          <button type="button" class="chip resultado-chip ${aud.resultado===k?'chip-active':''}"
            style="${aud.resultado===k?`background:${v.color};color:#0f1a14`:''}"
            onclick="setResultado('${k}','${v.color}',this)">${v.label}</button>
        `).join('')}
      </div>
      <input type="hidden" id="resultado-val" name="resultado" value="${aud.resultado||''}">

      <div class="form-group" style="margin-top:14px"><label>Observaciones libres</label>
        <textarea name="observaciones" rows="3" ${!edit?'disabled':''}
                  placeholder="Notas del auditor…">${esc(aud.observaciones||'')}</textarea>
      </div>
    </div>

    <!-- Documento firmado -->
    <div class="card">
      <h3 class="card-title">Documento firmado</h3>
      <div class="foto-slot">
        ${aud.docFirmado
          ? `${fotoMini(aud.docFirmado,'Documento firmado')}
             ${edit ? `<button type="button" class="btn-del-foto" onclick="delDocFirmado('${projectId}')">✕</button>` : ''}`
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
          Incluir auditoría en PDF
        </label>
      </div>
    </div>

    ${edit ? `<div class="form-actions">
      <button type="submit" class="btn-primary" id="btn-guardar-aud">Guardar auditoría</button>
    </div>` : ''}
  </form>

  ${aud.resultado ? `
  <div class="resultado-banner" style="background:${RESULTADOS[aud.resultado]?.color}22;border-color:${RESULTADOS[aud.resultado]?.color}">
    ${icon('clipboard-text', 24)}
    <span style="color:${RESULTADOS[aud.resultado]?.color};font-weight:700">
      ${RESULTADOS[aud.resultado]?.label}
    </span>
    ${aud.auditor?.nombre ? `<span>— ${esc(aud.auditor.nombre)}</span>` : ''}
  </div>` : ''}
  `;
}

// ── Checklist helpers ─────────────────────────────────────────────────────────
let _checkMap = {};

window.setCheck = function(itemId, resultado, btn) {
  _checkMap[itemId] = resultado;

  // Actualizar botones del ítem
  btn.closest('.check-item-btns').querySelectorAll('.chk-btn')
    .forEach(b => b.classList.remove('chk-active'));
  btn.classList.add('chk-active');

  // Serializar al hidden input
  const checklist = Object.entries(_checkMap).map(([id, res]) => ({ itemId: parseInt(id), resultado: res }));
  document.getElementById('checklist-json').value = JSON.stringify(checklist);

  // Actualizar barra de progreso
  const total = CHECKLIST_ITEMS.length;
  const done  = Object.keys(_checkMap).length;
  const pct   = Math.round(done / total * 100);
  const bar   = document.getElementById('aud-prog-bar');
  const lbl   = document.getElementById('aud-progress-lbl');
  if (bar) bar.style.width = pct + '%';
  if (lbl) lbl.textContent = `${done} / ${total}`;

  // Auto-sugerir resultado si todos los ítems están evaluados
  if (done === total) {
    const hayNo = checklist.some(i => i.resultado === 'no_cumple');
    const sugerido = hayNo ? 'rechazado' : 'aprobado';
    const resVal = document.getElementById('resultado-val');
    if (resVal && !resVal.value) {
      // Solo sugerir si no hay resultado ya seleccionado
      const chip = document.querySelector(`.resultado-chip[onclick*="${sugerido}"]`);
      if (chip) { chip.click(); toast(`Resultado sugerido: ${chip.textContent.trim()}`); }
    }
  }
};

window.setResultado = function(val, color, btn) {
  document.querySelectorAll('.resultado-chip').forEach(c => {
    c.classList.remove('chip-active');
    c.style.background = '';
    c.style.color = '';
  });
  btn.classList.add('chip-active');
  btn.style.background = color;
  btn.style.color = '#0f1a14';
  document.getElementById('resultado-val').value = val;
};

// ── Foto documento firmado ────────────────────────────────────────────────────
let _docFirmadoB64 = null;

window.capDocFirmado = function() {
  capturePhoto(b64 => {
    _docFirmadoB64 = b64;
    const slot = document.getElementById('slot-doc-firmado');
    if (slot) slot.innerHTML = fotoMini(b64,'Documento firmado');
    toast('Foto del documento capturada');
  });
};

window.delDocFirmado = async function(projectId) {
  if (!await confirmDialog('¿Eliminar documento firmado?')) return;
  const p = await projects.getById(projectId);
  p.auditoria.docFirmado = null;
  await projects.update(projectId, { auditoria: p.auditoria });
  navigate(`#proyecto/${projectId}/auditoria`);
};

// ── Guardar auditoría ─────────────────────────────────────────────────────────
window.guardarAuditoria = async function(e, projectId) {
  e.preventDefault();
  const btn = document.getElementById('btn-guardar-aud');
  if (btn) { btn.disabled = true; btn.classList.add('btn-saving'); btn.textContent = 'Guardando'; }

  try {
    const fd = new FormData(e.target);
    const p  = await projects.getById(projectId);

    const auditoriaData = {
      tipo:     fd.get('tipo'),
      auditor: {
        nombre:       fd.get('auditorNombre').trim(),
        empresa:      fd.get('auditorEmpresa').trim(),
        acreditacion: fd.get('auditorAcreditacion').trim(),
      },
      norma:        fd.get('norma').trim(),
      checklist:    JSON.parse(fd.get('checklistJson') || '[]'),
      resultado:    fd.get('resultado'),
      observaciones:fd.get('observaciones').trim(),
      docFirmado:   _docFirmadoB64 || p.auditoria?.docFirmado || null,
      incluirEnPDF: fd.get('incluirEnPDF') === 'on',
      fecha:        isoNow(),
    };

    await projects.update(projectId, { auditoria: auditoriaData });
    _docFirmadoB64 = null;
    toast('✅ Auditoría guardada');
    navigate(`#proyecto/${projectId}`);
  } catch (err) {
    if (btn) { btn.disabled = false; btn.classList.remove('btn-saving'); btn.textContent = 'Guardar auditoría'; }
    toast(err.message || 'Error al guardar', 'error');
  }
};
