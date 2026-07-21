// aud-actions.js — Persistencia, acciones y window globals de Auditoría Técnica

import { projects, logChange } from './db.js';
import { fotoMini, capturePhoto, toast, isoNow, confirmDialog } from './utils.js';
import { uploadPhotoQueued, buildFotoPath } from './firebase.js';
import { CHECKLIST_RAPIDO, CHECKLIST_FORMAL, MEDICIONES } from './aud-data.js';
import { AS } from './aud-state.js';

// ── Switch modo ───────────────────────────────────────────────────────────────
window.switchAudMode = async function(projectId, modo) {
  const p = await projects.getById(projectId);
  const aud = p.auditoria || {};
  aud.modo = modo;
  await projects.update(projectId, { auditoria: aud });
  logChange(projectId, { modulo: 'Auditoría', accion: `modo cambiado a ${modo}` });
  navigate(`#proyecto/${projectId}/auditoria`);
};

// ── Rápido: toggle ítem ───────────────────────────────────────────────────────
window.setRapido = async function(itemId, val, btn, projectId) {
  AS.rapidoMap[itemId] = val;

  const row = btn.closest('.aud-rapido-btns');
  row.querySelectorAll('.rq-btn').forEach(b => {
    b.classList.remove('rq-active','rq-active-si','rq-active-no','rq-active-na');
  });
  btn.classList.add('rq-active', `rq-active-${val}`);

  const done  = CHECKLIST_RAPIDO.filter(i => AS.rapidoMap[i.id]).length;
  const pct   = Math.round(done / CHECKLIST_RAPIDO.length * 100);
  const bar   = document.getElementById('rq-prog-bar');
  if (bar) bar.style.width = pct + '%';

  await projects.setField(projectId, `auditoria.rapidoChecklist.${itemId}`, val);
};

// ── Rápido: guardar ───────────────────────────────────────────────────────────
window.guardarRapido = async function(projectId) {
  const done = CHECKLIST_RAPIDO.filter(i => AS.rapidoMap[i.id]).length;
  if (done < CHECKLIST_RAPIDO.length) {
    toast(`Faltan ${CHECKLIST_RAPIDO.length - done} ítem${CHECKLIST_RAPIDO.length - done !== 1 ? 's' : ''} sin responder`, 'error', 3000);
    return;
  }

  const btn = document.getElementById('btn-rq-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  const tecnico = document.getElementById('rq-tecnico')?.value.trim();
  const fecha   = document.getElementById('rq-fecha')?.value || isoNow().split('T')[0];
  const obs     = document.getElementById('rq-obs')?.value.trim() || '';

  // Capturar GPS automáticamente si está disponible
  let gps = null;
  try {
    if (navigator.geolocation) {
      gps = await new Promise((res) => {
        navigator.geolocation.getCurrentPosition(
          p => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }),
          () => res(null),
          { timeout: 5000, maximumAge: 30000 }
        );
      });
    }
  } catch (_) { /* GPS no crítico */ }

  try {
    const p = await projects.getById(projectId);
    const aud = p.auditoria || {};
    aud.modo          = 'rapido';
    aud.rapidoTecnico = tecnico;
    aud.rapidoFecha   = isoNow();
    aud.rapidoFechaDisplay = fecha;
    aud.rapidoObs     = obs;
    if (gps) aud.rapidoGps = gps;
    await projects.update(projectId, { auditoria: aud });
    logChange(projectId, { modulo: 'Auditoría', accion: 'verificación rápida guardada', detalle: tecnico });
    const gpsMsg = gps ? ` · GPS ±${gps.acc}m` : '';
    toast(`✅ Verificación guardada${gpsMsg}`);
    navigate(`#proyecto/${projectId}`);
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar verificación'; }
    toast(err.message || 'Error al guardar', 'error');
  }
};

// ── Formal: toggle checklist ──────────────────────────────────────────────────
window.setFormal = async function(itemId, val, btn, projectId) {
  AS.formalMap[itemId] = val;

  btn.closest('.check-item-btns').querySelectorAll('.chk-btn')
    .forEach(b => b.classList.remove('chk-active'));
  btn.classList.add('chk-active');

  const done = CHECKLIST_FORMAL.filter(i => AS.formalMap[i.id]).length;
  const pct  = Math.round(done / CHECKLIST_FORMAL.length * 100);
  const bar  = document.getElementById('fm-prog-bar');
  const lbl  = document.getElementById('fm-prog-lbl');
  if (bar) bar.style.width = pct + '%';
  if (lbl) lbl.textContent = `${done} / ${CHECKLIST_FORMAL.length}`;

  // Auto-sugerir dictamen si todos los ítems están evaluados
  if (done === CHECKLIST_FORMAL.length) {
    const hayNC = Object.values(AS.formalMap).some(v => v === 'no_cumple');
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
  AS.formalObs[itemId] = val;
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
  // Evitar guardar un dictamen totalmente vacío (sin resultado ni ningún ítem
  // del checklist marcado) — error de captura accidental. Si hay progreso
  // parcial sí se permite guardar (es un borrador del dictamen).
  const _fd0 = new FormData(e.target);
  const _checklistDone = CHECKLIST_FORMAL.filter(i => AS.formalMap[i.id]).length;
  if (!_fd0.get('resultado') && _checklistDone === 0) {
    toast('Marca al menos un ítem del checklist o selecciona un dictamen antes de guardar', 'error', 5000);
    return;
  }
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
      docFirmado:           (typeof AS.docFirmadoB64 === 'string' ? AS.docFirmadoB64 : null) || aud.docFirmado || null,
      fecha:                isoNow(),
    });

    await projects.update(projectId, { auditoria: aud });
    logChange(projectId, { modulo: 'Auditoría', accion: `dictamen guardado: ${aud.resultado || '—'}`, detalle: aud.auditor?.nombre || '' });
    AS.docFirmadoB64 = null;
    toast('✅ Dictamen guardado');
    navigate(`#proyecto/${projectId}`);
  } catch (err) {
    if (btn) { btn.disabled = false; btn.classList.remove('btn-saving'); btn.textContent = 'Guardar dictamen'; }
    toast(err.message || 'Error al guardar', 'error');
  }
};

// ── Foto documento firmado ────────────────────────────────────────────────────
window.capDocFirmado = function(projectId) {
  capturePhoto(async (b64) => {
    const slot = document.getElementById('slot-doc-firmado');
    if (slot) slot.innerHTML = fotoMini(b64, 'Documento firmado');
    toast('Subiendo documento…');
    const result = await uploadPhotoQueued(
      b64, buildFotoPath(projectId, `auditoria_doc-firmado-${Date.now()}.jpg`),
      projectId, 'auditoriaDocFirmado'
    );
    AS.docFirmadoB64 = result.url || (result.pending ? { pending: true, pendingId: result.pendingId } : null);
    toast(result.url ? '✅ Documento subido' : 'Sin conexión — se subirá al reconectarte');
  }, { projectId, fase: 'auditoria', campo: 'DocFirmado', preview: true });
};

window.delDocFirmado = async function(projectId) {
  if (!await confirmDialog('¿Eliminar documento firmado?')) return;
  const p = await projects.getById(projectId);
  if (p.auditoria) p.auditoria.docFirmado = null;
  await projects.update(projectId, { auditoria: p.auditoria });
  navigate(`#proyecto/${projectId}/auditoria`);
};
