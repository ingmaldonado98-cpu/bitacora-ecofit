// cl-actions.js — Persistencia, acciones y window globals del Checklist

import { toast, isoNow, esc } from './utils.js';
import { getSession } from './auth.js';
import { projects } from './db.js';
import { HERRAMIENTA, getConsumibles, ADMIN_REVIEW_ITEMS, getExecBlocks } from '../modules/checklist/index.js';
import { buildTorqueTable } from '../modules/calculadora/index.js';
import { _tkey } from './cl-render.js';

// ── Persistencia ──────────────────────────────────────────────────────────────
// Usa updateDoc con dot-notation para evitar race condition entre toggles rápidos
async function _saveField(projectId, field, key, value) {
  await projects.setField(projectId, `checklistData.${field}.${key}`, value);
}

window.clToggleHerr  = (pid, id, v)  => _saveField(pid, 'herr',  id,         v);
window.clToggleCons  = (pid, idx, v) => _saveField(pid, 'cons',  String(idx), v);
window.clToggleBOM   = (pid, idx, v) => _saveField(pid, 'bom',   String(idx), v);
window.clToggleAdmin = (pid, id, v)  => _saveField(pid, 'admin', id,         v);
window.clToggleExec  = (pid, id, v)  => _saveField(pid, 'exec',  id,         v);

let _execTextTimer = null;
window.clSaveExecText = (pid, id, val) => {
  clearTimeout(_execTextTimer);
  _execTextTimer = setTimeout(() => {
    projects.setField(pid, `checklistData.execText.${id}`, val);
  }, 600);
};

let _torqSaveTimer = null;
window.clSaveTorque = (pid, key, field, value) => {
  clearTimeout(_torqSaveTimer);
  _torqSaveTimer = setTimeout(() => {
    projects.setField(pid, `checklistData.torques.${key}.${field}`, value);
  }, 600);
};
window.clToggleTorque = (pid, key, checked) => {
  projects.setField(pid, `checklistData.torques.${key}.verificado`, checked);
  projects.setField(pid, `checklistData.torques.${key}.ts`, new Date().toISOString());
};

window.clPublish = async function(projectId) {
  const session = getSession();
  const nombre  = session?.nombre || session?.username || 'Admin';
  await projects.setField(projectId, 'checklistData.publishedAt', isoNow());
  await projects.setField(projectId, 'checklistData.publishedBy', nombre);
  toast('✅ Checklist aprobado y publicado');
  navigate(`#checklist/${projectId}`);
};

window.clUnpublish = async function(projectId) {
  await projects.setField(projectId, 'checklistData.publishedAt', null);
  await projects.setField(projectId, 'checklistData.publishedBy', null);
  toast('Aprobación revocada');
  navigate(`#checklist/${projectId}`);
};

// ── Zoom diagrama en checklist ────────────────────────────────────────────────
let _clDiagScale = 1;

window.clDiagZoom = function(delta) {
  _clDiagScale = Math.min(3, Math.max(0.3, _clDiagScale + delta));
  const el = document.getElementById('cl-diag-inner');
  if (el) el.style.transform = `scale(${_clDiagScale})`;
};
window.clDiagZoomReset = function() {
  _clDiagScale = 1;
  const el = document.getElementById('cl-diag-inner');
  if (el) el.style.transform = 'scale(1)';
};
window.clDiagFullscreen = function() {
  const el = document.getElementById('cl-diagram-card');
  if (!el) return;
  if (!document.fullscreenElement) {
    el.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
};

// ── Exportar PDF ──────────────────────────────────────────────────────────────
window.clExportPDF = async function(projectId) {
  const project = await projects.getById(projectId);
  const cl = project.checklistData || {};
  const cfg = project.projectConfig || null;
  const techo = cfg?.techo || cl.techo || 'cemento';
  const estructura = cfg?.estructura || null;
  const base = cfg?.base || null;

  const herramienta = HERRAMIENTA[techo] || HERRAMIENTA.cemento;
  const consumibles = cfg ? getConsumibles(estructura, base, techo) : [];
  const published   = cl.publishedAt
    ? `Aprobado por ${cl.publishedBy} · ${new Date(cl.publishedAt).toLocaleDateString('es-MX')}`
    : 'Pendiente de aprobación';

  const execBlocks  = getExecBlocks(project, techo);
  const torqueRows  = buildTorqueTable(cfg?.estructura || 'k2', techo);
  const torqData    = cl.torques || {};
  const execText    = cl.execText || {};

  const checkRow = (done, label, note, val) =>
    `<tr class="${done?'done':''}"><td class="chk">${done?'☑':'☐'}</td><td>${label}${note?`<br><small>${note}</small>`:''}${val?`<br><b style="color:#16a34a">${esc(val)}</b>`:''}</td></tr>`;

  const execSection = execBlocks.map(block => {
    const rows = block.items.map(it =>
      checkRow(!!cl.exec?.[it.id], it.n, null, it.hasInput ? execText[it.id] : null)
    ).join('');
    return `<h2>${esc(block.label)}</h2><table>${rows}</table>`;
  }).join('');

  const torqueSection = torqueRows.length ? `
  <h2>Torques de apriete</h2>
  <table>
    <tr style="background:#f3f4f6"><th style="text-align:left;padding:4px 6px">Componente</th><th style="padding:4px 6px">Especificación</th><th style="padding:4px 6px">Aplicado</th><th style="padding:4px 6px">✓</th></tr>
    ${torqueRows.map(r => {
      const k = _tkey(r.comp);
      const td = torqData[k] || {};
      return `<tr class="${td.verificado?'done':''}">
        <td>${esc(r.comp)}<br><small>${esc(r.nota)}</small></td>
        <td style="text-align:center">${esc(r.torque)}</td>
        <td style="text-align:center;font-weight:700">${td.valor ? esc(td.valor)+' N·m' : '—'}</td>
        <td style="text-align:center">${td.verificado?'☑':'☐'}</td>
      </tr>`;
    }).join('')}
  </table>` : '';

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Checklist — ${project.displayId}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 20px; }
    h1 { font-size: 16px; margin: 0 0 4px; } .sub { color: #666; font-size: 10px; margin-bottom: 12px; }
    h2 { font-size: 12px; background: #1a1a1a; color: #fff; padding: 4px 8px; margin: 16px 0 6px; border-radius: 3px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    td, th { padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
    td.chk { width: 22px; font-size: 14px; }
    tr.done td { color: #666; text-decoration: line-through; }
    small { color: #888; }
    .status { background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; padding: 6px 10px; margin-bottom: 12px; font-size: 10px; }
    @media print { body { padding: 0; } }
  </style></head><body>
  <h1>Checklist de instalación — ${project.displayId}</h1>
  <p class="sub">${esc(project.clientName || project.displayId)} · Techo: ${techo === 'cemento' ? 'Concreto/losa' : 'Metálico/lámina'}</p>
  <div class="status">${published}</div>

  <h2>Herramienta</h2>
  <table>${herramienta.map(h => checkRow(!!cl.herr?.[h.id], h.n, h.note)).join('')}</table>

  ${consumibles.length ? `<h2>Consumibles</h2>
  <table>${consumibles.map((c, i) => checkRow(!!cl.cons?.[String(i)], c.n, c.note)).join('')}</table>` : ''}

  <h2>Revisión pre-instalación (Admin)</h2>
  <table>${ADMIN_REVIEW_ITEMS.map(it => checkRow(!!cl.admin?.[it.id], it.label, it.detail)).join('')}</table>

  ${execSection}
  ${torqueSection}
  </body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `checklist-${projectId}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};
