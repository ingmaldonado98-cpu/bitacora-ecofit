// lev-notas.js — Notas de documentacion: render y handlers CRUD

import { esc, fmtFechaHora, toast, isoNow, uuid, confirmDialog } from './utils.js';
import { isAdmin, getSession } from './auth.js';
import { projects, logChange } from './db.js';

// ── Notas de documentación ─────────────────────────────────────────────────────
export function renderNotasDoc(notas, session, projectId) {
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
  const session = await getSession();
  const p = await projects.getById(projectId);
  const nota = { id: uuid(), texto, autorId: session?.id, autorNombre: session?.nombre || session?.username, createdAt: isoNow() };
  p.documentacion.notas = [...(p.documentacion.notas || []), nota];
  await projects.update(projectId, { documentacion: p.documentacion });
  logChange(projectId, { modulo: 'Documentación', accion: 'nota agregada', detalle: texto.slice(0, 60), quien: session });
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
  const session = await getSession();
  const p = await projects.getById(projectId);
  p.documentacion.notas = (p.documentacion.notas || []).filter((_,i) => i !== idx);
  await projects.update(projectId, { documentacion: p.documentacion });
  logChange(projectId, { modulo: 'Documentación', accion: 'nota eliminada', quien: session });
  document.getElementById('dnotas-list').innerHTML = renderNotasDoc(p.documentacion.notas, session, projectId);
  const tabBtn = document.querySelector('[data-tab="d-notas"]');
  if (tabBtn) tabBtn.innerHTML = p.documentacion.notas.length
    ? `Notas<span class="tab-badge tab-ok">${p.documentacion.notas.length}</span>` : 'Notas';
  toast('Nota eliminada');
};
