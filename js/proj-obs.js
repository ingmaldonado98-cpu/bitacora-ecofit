// proj-obs.js — Observaciones del proyecto: render y CRUD
// Extraído de project.js. Exporta renderObservaciones.

import { projects } from './db.js';
import { esc, fmtFechaHora, fmtRelativa, PRIORIDADES, isoNow, toast,
         confirmDialog, inputDialog } from './utils.js';
import { isAdmin, isLider, canEdit, getSession } from './auth.js';
import { icon } from './icons.js';

// ── Render lista de observaciones ─────────────────────────────────────────────
export function renderObservaciones(obs, session, projectId, edit = false) {
  if (!obs.length) return '<p class="empty-msg-sm">Sin observaciones.</p>';
  return obs.map((o, i) => {
    const p        = PRIORIDADES[o.prioridad] || PRIORIDADES.normal;
    const resuelta = !!o.resuelta;
    const canResolve = edit || isAdmin(session);
    const borderColor = resuelta ? 'var(--border2)' : p.color;
    return `
    <div class="obs-item ${resuelta ? 'obs-resuelta' : ''}" style="border-left:3px solid ${borderColor}">
      <div class="obs-header">
        <span class="obs-autor">${esc(o.autorNombre || '—')}</span>
        <span class="obs-fecha">${fmtFechaHora(o.timestamp)}</span>
        ${resuelta
          ? `<span class="obs-badge-resuelta">✓ Resuelta</span>`
          : `<span class="obs-prio" style="color:${p.color}">${p.label}</span>`}
        <div class="obs-actions">
          ${canResolve && !resuelta
            ? `<button class="btn-resolver" onclick="window._resolverObs('${projectId}',${i},true)" title="Marcar como resuelta">✓ Resolver</button>`
            : ''}
          ${isAdmin(session) && resuelta
            ? `<button class="btn-del-sm" onclick="window._resolverObs('${projectId}',${i},false)" title="Reabrir">↩</button>`
            : ''}
          ${isAdmin(session)
            ? `<button class="btn-del-sm" onclick="window._delObs('${projectId}',${i})" title="Eliminar">✕</button>`
            : ''}
        </div>
      </div>
      <p class="obs-texto">${esc(o.texto)}</p>
      ${resuelta ? `<p class="obs-resuelta-meta">✓ Resuelta por ${esc(o.resueltaPor || '—')} · ${fmtRelativa(o.resueltaAt)}${o.resueltaNota ? ` — ${esc(o.resueltaNota)}` : ''}</p>` : ''}
    </div>`;
  }).join('');
}

// ── Actualizar lista en DOM sin re-render completo ────────────────────────────
function _refreshObsList(obs, session, projectId, _project) {
  const edit = _project ? canEdit(session, _project) : isLider(session);
  const el = document.getElementById('obs-list');
  if (el) el.innerHTML = renderObservaciones(obs, session, projectId, edit);
  const activas   = obs.filter(o => !o.resuelta).length;
  const resueltas = obs.filter(o =>  o.resuelta).length;
  const tituloEl  = document.querySelector('#obs-list')?.closest('.card')?.querySelector('.card-title');
  if (tituloEl) {
    tituloEl.textContent = resueltas
      ? `Observaciones (${activas} activa${activas !== 1 ? 's' : ''} · ${resueltas} resuelta${resueltas !== 1 ? 's' : ''})`
      : `Observaciones (${activas})`;
  }
}

// ── Handlers (registrados en window para onclick inline) ──────────────────────
window._showAddObs = function(id) {
  document.getElementById('obs-form').style.display = 'block';
  document.getElementById('obs-texto').focus();
};

window._submitObs = async function(id) {
  const texto = document.getElementById('obs-texto').value.trim();
  if (!texto) return;
  const prio = document.getElementById('obs-prio').value;
  const [session, project] = await Promise.all([getSession(), projects.getById(id)]);
  const obs = [...(project.observaciones || []), {
    texto, prioridad: prio, autorId: session?.id, autorNombre: session?.nombre,
    timestamp: isoNow(),
  }];
  await projects.update(id, { observaciones: obs });
  _refreshObsList(obs, session, id, project);
  document.getElementById('obs-form').style.display = 'none';
  document.getElementById('obs-texto').value = '';
  toast('Observación guardada');
};

window._delObs = async function(id, idx) {
  if (!await confirmDialog('¿Eliminar esta observación?')) return;
  const [session, project] = await Promise.all([getSession(), projects.getById(id)]);
  const obs = (project.observaciones || []).filter((_,i) => i !== idx);
  await projects.update(id, { observaciones: obs });
  _refreshObsList(obs, session, id, project);
};

window._resolverObs = async function(id, idx, resolver) {
  const [session, project] = await Promise.all([getSession(), projects.getById(id)]);
  const obs = [...(project.observaciones || [])];
  if (resolver) {
    const nota = await inputDialog('¿Cómo se resolvió? (opcional):', '');
    if (nota === null) return;
    obs[idx] = {
      ...obs[idx],
      resuelta: true,
      resueltaPor: session?.nombre || '—',
      resueltaAt: isoNow(),
      resueltaNota: nota.trim() || null,
    };
  } else {
    const { resuelta, resueltaPor, resueltaAt, resueltaNota, ...rest } = obs[idx];
    obs[idx] = rest;
  }
  await projects.update(id, { observaciones: obs });
  _refreshObsList(obs, session, id, project);
  toast(resolver ? '✓ Observación resuelta' : 'Observación reabierta');
};
