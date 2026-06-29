// cl-actions.js — Persistencia, acciones y window globals del Checklist

import { toast, isoNow, esc, uuid } from './utils.js';
import { getSession } from './auth.js';
import { projects } from './db.js';
import { HERRAMIENTA, getConsumibles, ADMIN_REVIEW_ITEMS, getExecBlocks } from '../modules/checklist/index.js';
import { buildTorqueTable } from '../modules/calculadora/index.js';
import { _tkey } from './cl-render.js';
import { toggleExecItem } from './doc-exec.js';

// ── Persistencia ──────────────────────────────────────────────────────────────
// Usa updateDoc con dot-notation para evitar race condition entre toggles rápidos
async function _saveField(projectId, field, key, value) {
  await projects.setField(projectId, `checklistData.${field}.${key}`, value);
}

window.clToggleHerr  = (pid, id, v)  => { _refreshClProgress(); return _saveField(pid, 'herr',  id,         v); };
window.clToggleCons  = (pid, idx, v) => { _refreshClProgress(); return _saveField(pid, 'cons',  String(idx), v); };
window.clToggleBOM   = (pid, key, v) => { _refreshClProgress(); return _saveField(pid, 'bom',   String(key), v); };
window.clToggleAdmin = (pid, id, v)  => _saveField(pid, 'admin', id,         v);
window.clToggleExec  = (pid, id, v)  => toggleExecItem(pid, id, v);

// ── Actualización en vivo de contadores del checklist ───────────────────────
// Los toggles arriba solo persisten en Firestore — sin esto, la barra de
// progreso y los badges de pestaña ("Materiales 0/13") quedaban congelados
// hasta el próximo render completo de la vista (recargar o navegar). Se
// recalcula leyendo el estado YA actualizado de los checkboxes en el DOM
// (el navegador marca/desmarca el checkbox antes de disparar 'onchange'),
// sin esperar a la escritura en Firestore ni volver a pedir el proyecto.
function _progressHtml(done, total) {
  if (!total) return '';
  const pct = Math.round(done / total * 100);
  return `
    <div class="cl-progress-row">
      <span class="cl-progress-label">${done} de ${total} completados</span>
      <span class="cl-progress-pct">${pct}%</span>
    </div>
    <div class="cl-progress-bar"><div class="cl-progress-fill" style="width:${pct}%"></div></div>`;
}

function _refreshClProgress() {
  const herrList = document.querySelector('#cl-herr .cl-item-list');
  if (herrList) {
    const total = herrList.querySelectorAll('input[type="checkbox"]').length;
    const done  = herrList.querySelectorAll('input[type="checkbox"]:checked').length;
    const block = document.getElementById('cl-prog-herr');
    if (block) block.innerHTML = _progressHtml(done, total);
    const badge = document.getElementById('cl-badge-herr');
    if (badge) badge.innerHTML = (total && done === total) ? '<span class="tab-badge tab-ok">✓</span>' : '';
  }

  let doneBOM = 0, totalBOM = 0;
  const bomCard = document.getElementById('cl-bom-card');
  if (bomCard) {
    totalBOM = bomCard.querySelectorAll('.cl-item-list input[type="checkbox"]').length;
    doneBOM  = bomCard.querySelectorAll('.cl-item-list input[type="checkbox"]:checked').length;
    const block = document.getElementById('cl-prog-bom');
    if (block) block.innerHTML = _progressHtml(doneBOM, totalBOM);
    const lbl = document.getElementById('cl-lbl-bom');
    if (lbl) lbl.textContent = `${doneBOM}/${totalBOM}`;
  }

  let doneCons = 0, totalCons = 0;
  const consCard = document.getElementById('cl-cons-card');
  if (consCard) {
    totalCons = consCard.querySelectorAll('.cl-item-list input[type="checkbox"]').length;
    doneCons  = consCard.querySelectorAll('.cl-item-list input[type="checkbox"]:checked').length;
    const block = document.getElementById('cl-prog-cons');
    if (block) block.innerHTML = _progressHtml(doneCons, totalCons);
    const lbl = document.getElementById('cl-lbl-cons');
    if (lbl) lbl.textContent = `${doneCons}/${totalCons}`;
  }

  let doneKit = 0, totalKit = 0;
  const kitCard = document.getElementById('cl-kit-card');
  if (kitCard) {
    totalKit = kitCard.querySelectorAll('.cl-kit-check input[type="checkbox"]').length;
    doneKit  = kitCard.querySelectorAll('.cl-kit-check input[type="checkbox"]:checked').length;
  }

  const totalMat = totalBOM + totalCons + totalKit;
  const doneMat  = doneBOM + doneCons + doneKit;
  const matBadge = document.getElementById('cl-badge-materiales');
  if (matBadge) {
    matBadge.innerHTML = totalMat > 0 && doneMat === totalMat
      ? '<span class="tab-badge tab-ok">✓</span>'
      : (totalMat > 0 ? `<span class="tab-badge">${doneMat}/${totalMat}</span>` : '');
  }
}

// ── Kit de obra — equipo principal a llevar a la instalación ────────────────
// Independiente del inventario de bodega (ese se hace una vez al mes; con 2-3
// proyectos saliendo en ese periodo, amarrarlo al inventario sería un cuello
// de botella). Es solo confirmación de "esto va en el kit de este proyecto".
window.addKitEquipo = async (pid) => {
  const id = uuid();
  await projects.setField(pid, `checklistData.kitEquipo.${id}`, { nombre: '', cantidad: '', empacado: false });
  navigate(window.location.hash);
};
window.delKitEquipo = async (pid, id) => {
  const p = await projects.getById(pid);
  const map = { ...(p.checklistData?.kitEquipo || {}) };
  delete map[id];
  await projects.setField(pid, 'checklistData.kitEquipo', map);
  navigate(window.location.hash);
};
window.toggleKitEquipo = (pid, id, v) => { _refreshClProgress(); return _saveField(pid, 'kitEquipo', `${id}.empacado`, v); };

let _kitTextTimer = null;
window.updKitEquipo = (pid, id, field, val) => {
  clearTimeout(_kitTextTimer);
  _kitTextTimer = setTimeout(() => {
    projects.setField(pid, `checklistData.kitEquipo.${id}.${field}`, val);
  }, 600);
};

// Cierra el hilo diseño/compra → instalado: lleva el item del Kit a Garantía
// para registrarlo con tipo/marca/serial (rutas distintas, por eso sessionStorage).
window._irAGarantiaDesdeKit = function(pid, kitId, nombre) {
  sessionStorage.setItem('garantia-tab-target', 'g-equipos');
  sessionStorage.setItem('garantia-kit-prefill', JSON.stringify({ kitId, nombre }));
  navigate(`#proyecto/${pid}/garantia`);
};

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

  ${Object.keys(cl.kitEquipo || {}).length ? `<h2>Equipo principal — Kit de obra</h2>
  <table>${Object.values(cl.kitEquipo).map(it => checkRow(!!it.empacado, it.nombre || '—', it.cantidad ? `Cantidad: ${it.cantidad}` : null)).join('')}</table>` : ''}

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
