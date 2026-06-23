// trayectorias.js — Trayectorias de canalización
// Documenta los recorridos físicos de cable: desde-hasta, tipo conduit, calibre, longitud, fotos.

import { projects } from './db.js';
import { esc, toast, confirmDialog } from './utils.js';
import { canEdit } from './auth.js';
import { icon } from './icons.js';

const CONDUIT_OPTS = [
  ['pvc40',   'PVC-40 (superficie)'],
  ['hdpe',    'HDPE corrugado (enterrado)'],
  ['emt',     'EMT / conduit metálico'],
  ['bandeja', 'Bandeja portacables'],
  ['libre',   'Cable libre / sin conduit'],
  ['otro',    'Otro'],
];

function conduitLabel(v) {
  return (CONDUIT_OPTS.find(([k]) => k === v) || [, v || '—'])[1];
}

// ── Resumen embebible (usado en Progreso de obra y en la tarjeta de referencia
// de ingeniería de doc-exec.js) — lista los tramos ya capturados en vez de
// solo contarlos, para que el técnico vea conduit/calibre/metros sin tener
// que entrar a la vista completa de Trayectorias.
export function renderTrayectoriasResumen(project) {
  const items  = Array.isArray(project.trayectorias) ? project.trayectorias : [];
  const totalM = items.reduce((s, t) => s + (parseFloat(t.m) || 0), 0);
  return `
  <div class="card exec-section">
    <div class="card-title-row">
      <h3 class="card-title">${icon('path', 16)} Trayectorias de canalización</h3>
      <button class="btn-sm btn-outline" onclick="navigate('#proyecto/${project.id}/trayectorias')">
        ${items.length ? 'Ver / agregar' : '+ Agregar tramo'}
      </button>
    </div>
    ${items.length ? `
      <p class="form-hint" style="margin:0 0 6px">${items.length} tramo${items.length !== 1 ? 's' : ''} · ${totalM.toFixed(1)} m en total</p>
      <ul style="margin:0;padding-left:16px;font-size:.8rem;color:var(--text-muted)">
        ${items.map(t => `<li>${esc(t.nombre || 'Tramo sin nombre')} — ${conduitLabel(t.conduit)}${t.awg ? `, AWG ${esc(t.awg)}` : ''}${t.m ? `, ${t.m} m` : ''}</li>`).join('')}
      </ul>`
      : `<p class="form-hint" style="margin:0">Pendiente de definir en módulo de Trayectorias/Cables.</p>`}
  </div>`;
}

// ── Render principal ──────────────────────────────────────────────────────────
export async function renderTrayectorias(projectId, session) {
  const project = await projects.getById(projectId);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';
  const edit  = canEdit(session, project);
  const items = Array.isArray(project.trayectorias) ? project.trayectorias : [];
  const totalM = items.reduce((s, t) => s + (parseFloat(t.m) || 0), 0);

  return `
  <div class="breadcrumb">
    <span class="bc-link" onclick="navigate('#dashboard')">Inicio</span>
    <span class="bc-sep">›</span>
    <span class="bc-link" onclick="navigate('#proyecto/${projectId}')">${esc(project.displayId)}</span>
    <span class="bc-sep">›</span>
    <span class="bc-current">Trayectorias</span>
  </div>

  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}')">
      ${icon('caret-left')}
    </button>
    <div class="header-info">
      <h1 class="hdr-title">Trayectorias</h1>
      <span class="hdr-sub">${esc(project.clientName || project.displayId)} · ${items.length} tramo${items.length !== 1 ? 's' : ''} · ${totalM.toFixed(1)} m</span>
    </div>
  </div>

  <div id="tray-list">
    ${items.length === 0 ? `
    <div class="empty-card">
      ${icon('path', 32)}
      <p>Sin trayectorias registradas</p>
      <p class="empty-sub">Documenta los recorridos de cable: conduit, calibre y longitud por tramo.</p>
    </div>` : items.map((t, i) => _segCard(t, i, projectId, edit)).join('')}
  </div>

  ${edit ? `
  <div class="card tray-add-form" id="tray-add-form">
    <h3 class="tray-form-title">${icon('plus-circle', 16)} Nuevo tramo</h3>
    <div class="form-field">
      <label>Nombre del tramo</label>
      <input id="tf-nombre" type="text" placeholder="Ej. DC paneles → combinadora" maxlength="60">
    </div>
    <div class="tray-row-2">
      <div class="form-field">
        <label>Desde</label>
        <input id="tf-desde" type="text" placeholder="Paneles techo A" maxlength="40">
      </div>
      <div class="form-field">
        <label>Hasta</label>
        <input id="tf-hasta" type="text" placeholder="Caja combinadora" maxlength="40">
      </div>
    </div>
    <div class="tray-row-3">
      <div class="form-field">
        <label>Tipo de canalización</label>
        <select id="tf-conduit">
          ${CONDUIT_OPTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Calibre (AWG)</label>
        <input id="tf-awg" type="text" placeholder="10" maxlength="6">
      </div>
      <div class="form-field">
        <label>Longitud (m)</label>
        <input id="tf-m" type="number" inputmode="decimal" placeholder="12.5" min="0" step="0.5">
      </div>
    </div>
    <div class="form-field">
      <label>Notas</label>
      <input id="tf-notas" type="text" placeholder="Observaciones opcionales" maxlength="120">
    </div>
    <button class="btn-primary tray-save-btn" onclick="trayGuardar('${projectId}')">
      ${icon('floppy-disk', 16)} Guardar tramo
    </button>
  </div>` : ''}
  `;
}

function _segCard(t, i, projectId, edit) {
  return `
  <div class="card tray-seg" id="tray-seg-${t.id}">
    <div class="tray-seg-head">
      <span class="tray-seg-idx">${i + 1}</span>
      <div class="tray-seg-info">
        <span class="tray-seg-nom">${esc(t.nombre || 'Tramo sin nombre')}</span>
        ${(t.desde || t.hasta) ? `<span class="tray-seg-ruta">${esc(t.desde || '?')} → ${esc(t.hasta || '?')}</span>` : ''}
      </div>
      ${edit ? `
      <button class="icon-btn icon-btn-danger" onclick="trayEliminar('${projectId}','${t.id}')">
        ${icon('trash', 15)}
      </button>` : ''}
    </div>
    <div class="tray-chips">
      ${t.conduit ? `<span class="tray-chip">${conduitLabel(t.conduit)}</span>` : ''}
      ${t.awg    ? `<span class="tray-chip">AWG ${esc(t.awg)}</span>` : ''}
      ${t.m      ? `<span class="tray-chip tray-chip-m">${t.m} m</span>` : ''}
    </div>
    ${t.notas ? `<p class="tray-notas">${esc(t.notas)}</p>` : ''}
  </div>
  `;
}

// ── Funciones globales (llamadas desde HTML) ──────────────────────────────────
window.trayGuardar = async function(projectId) {
  const nombre  = (document.getElementById('tf-nombre')?.value  || '').trim();
  const desde   = (document.getElementById('tf-desde')?.value   || '').trim();
  const hasta   = (document.getElementById('tf-hasta')?.value   || '').trim();
  const conduit =  document.getElementById('tf-conduit')?.value || 'pvc40';
  const awg     = (document.getElementById('tf-awg')?.value     || '').trim();
  const m       = parseFloat(document.getElementById('tf-m')?.value) || 0;
  const notas   = (document.getElementById('tf-notas')?.value   || '').trim();

  if (!nombre) { toast('Escribe un nombre para el tramo', 'warn'); return; }

  const project = await projects.getById(projectId);
  if (!project) return;
  const items = Array.isArray(project.trayectorias) ? [...project.trayectorias] : [];
  items.push({
    id: 'tr_' + Date.now(),
    nombre, desde, hasta, conduit, awg, m, notas,
    creadoEn: new Date().toISOString(),
  });
  await projects.update(projectId, { trayectorias: items });
  toast('Tramo guardado', 'ok');
  navigate(`#proyecto/${projectId}/trayectorias`);
};

window.trayEliminar = async function(projectId, tid) {
  const ok = await confirmDialog('¿Eliminar este tramo de trayectoria?');
  if (!ok) return;
  const project = await projects.getById(projectId);
  if (!project) return;
  const items = (project.trayectorias || []).filter(t => t.id !== tid);
  await projects.update(projectId, { trayectorias: items });
  toast('Tramo eliminado', 'ok');
  navigate(`#proyecto/${projectId}/trayectorias`);
};

