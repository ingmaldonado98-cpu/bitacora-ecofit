// checklist.js — Módulo Checklist de instalación Ecofit V6

import { projects } from './db.js';
import { esc, toast, isoNow } from './utils.js';
import { canEdit, isAdmin } from './auth.js';
import { HERRAMIENTA, getConsumibles, ADMIN_REVIEW_ITEMS } from '../modules/checklist/index.js';
import { icon } from './icons.js';

export async function renderChecklistModule(projectId, session) {
  const project = await projects.getById(projectId);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';

  const edit    = canEdit(session, project);
  const admin   = isAdmin(session);
  const cfg     = project.projectConfig || null;
  const cl      = project.checklistData || {};

  const techo      = cfg?.techo || cl.techo || 'cemento';
  const estructura = cfg?.estructura || null;
  const base       = cfg?.base || null;

  const herramienta = HERRAMIENTA[techo] || HERRAMIENTA.cemento;
  const consumibles = cfg ? getConsumibles(estructura, base, techo) : [];
  const doneHerr  = herramienta.filter(h => cl.herr?.[h.id]).length;
  const doneCons  = consumibles.filter((_, i) => cl.cons?.[String(i)]).length;
  const doneAdmin = ADMIN_REVIEW_ITEMS.filter(it => cl.admin?.[it.id]).length;
  const allAdmin  = doneAdmin === ADMIN_REVIEW_ITEMS.length;
  const published = !!cl.publishedAt;

  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}')">
      ${icon('caret-left')}
    </button>
    <h1 class="hdr-title">Checklist</h1>
    <span class="hdr-sub">${esc(project.displayId)}</span>
  </div>

  ${published ? `
  <div class="cl-status-banner cl-approved">
    ${icon('check-circle', 18, 'icon-ok')}
    <div class="cl-status-text">
      <strong>Aprobado y publicado</strong>
      <span>por ${esc(cl.publishedBy || '—')} · ${cl.publishedAt ? new Date(cl.publishedAt).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}) : ''}</span>
    </div>
    ${admin ? `<button class="btn-outline btn-sm" onclick="clUnpublish('${projectId}')">Revocar</button>` : ''}
  </div>` : admin && allAdmin ? `
  <div class="cl-status-banner cl-ready">
    ${icon('check-circle', 18, 'icon-ok')}
    <div class="cl-status-text">
      <strong>Revisión completa</strong>
      <span>Listo para publicar al técnico</span>
    </div>
    <button class="btn-primary btn-sm" onclick="clPublish('${projectId}')">Aprobar y publicar</button>
  </div>` : ''}

  <div class="tab-bar" id="cl-tabs">
    <button class="tab-btn tab-active" data-tab="cl-herr" onclick="switchTab('cl-tabs','cl-herr',this)">
      Herramienta${doneHerr === herramienta.length && herramienta.length ? '<span class="tab-badge tab-ok">✓</span>' : ''}
    </button>
    <button class="tab-btn" data-tab="cl-cons" onclick="switchTab('cl-tabs','cl-cons',this)">
      Consumibles${cfg && doneCons === consumibles.length && consumibles.length ? '<span class="tab-badge tab-ok">✓</span>' : ''}
    </button>
    <button class="tab-btn" data-tab="cl-rev" onclick="switchTab('cl-tabs','cl-rev',this)">
      Revisión${allAdmin ? '<span class="tab-badge tab-ok">✓</span>' : admin ? '<span class="tab-badge tab-req">!</span>' : ''}
    </button>
  </div>

  <!-- Herramienta -->
  <div id="cl-herr" class="tab-panel tab-panel-active">
    <div class="card">
      <div class="cl-section-meta">
        <span class="cl-techo-badge">Techo: <strong>${techo === 'cemento' ? 'Concreto / losa' : 'Metálico / lámina'}</strong></span>
        ${cfg ? '' : `<span class="cl-hint">Tipo tomado de configuración manual. <button class="btn-link" onclick="navigate('#calculadora/${projectId}')">Calcular BOM</button> para ajustar.</span>`}
      </div>
      ${renderProgress(doneHerr, herramienta.length)}
      <div class="cl-item-list">
        ${herramienta.map(h => `
        <label class="cl-item ${cl.herr?.[h.id] ? 'cl-item-done' : ''}">
          <input type="checkbox" ${cl.herr?.[h.id] ? 'checked' : ''} ${!edit ? 'disabled' : ''}
            onchange="this.closest('.cl-item').classList.toggle('cl-item-done',this.checked);clToggleHerr('${projectId}','${h.id}',this.checked)">
          <div class="cl-item-text">
            <span class="cl-item-name">${esc(h.n)}</span>
            ${h.note ? `<span class="cl-item-note">${esc(h.note)}</span>` : ''}
          </div>
        </label>`).join('')}
      </div>
    </div>
  </div>

  <!-- Consumibles -->
  <div id="cl-cons" class="tab-panel">
    <div class="card">
      ${cfg ? `
      ${renderProgress(doneCons, consumibles.length)}
      <div class="cl-item-list">
        ${consumibles.map((c, i) => `
        <label class="cl-item ${cl.cons?.[String(i)] ? 'cl-item-done' : ''}">
          <input type="checkbox" ${cl.cons?.[String(i)] ? 'checked' : ''} ${!edit ? 'disabled' : ''}
            onchange="this.closest('.cl-item').classList.toggle('cl-item-done',this.checked);clToggleCons('${projectId}',${i},this.checked)">
          <div class="cl-item-text">
            <span class="cl-item-name">${esc(c.n)}</span>
            ${c.note ? `<span class="cl-item-note">${esc(c.note)}</span>` : ''}
          </div>
        </label>`).join('')}
      </div>` : `
      <div class="cl-no-cfg">
        ${icon('calculator', 36)}
        <p>Genera el BOM en la calculadora para ver la lista de consumibles automáticamente.</p>
        <button class="btn-outline btn-sm" onclick="navigate('#calculadora/${projectId}')">
          ${icon('calculator', 14)} Abrir calculadora
        </button>
      </div>`}
    </div>
  </div>

  <!-- Revisión Admin -->
  <div id="cl-rev" class="tab-panel">
    <div class="card">
      ${!admin ? `
      <p class="empty-msg-sm">Solo administradores pueden completar la revisión previa.</p>` : `
      ${renderProgress(doneAdmin, ADMIN_REVIEW_ITEMS.length)}
      <div class="cl-item-list">
        ${ADMIN_REVIEW_ITEMS.map(it => `
        <label class="cl-item ${cl.admin?.[it.id] ? 'cl-item-done' : ''}">
          <input type="checkbox" ${cl.admin?.[it.id] ? 'checked' : ''}
            onchange="this.closest('.cl-item').classList.toggle('cl-item-done',this.checked);clToggleAdmin('${projectId}','${it.id}',this.checked)">
          <div class="cl-item-text">
            <span class="cl-item-name">${esc(it.label)}</span>
            <span class="cl-item-note">${esc(it.detail)}</span>
          </div>
        </label>`).join('')}
      </div>
      ${allAdmin && !published ? `
      <div style="margin-top:14px">
        <button class="btn-primary" onclick="clPublish('${projectId}')">
          ${icon('check-circle', 16)} Aprobar y publicar al técnico
        </button>
      </div>` : ''}`}
    </div>
  </div>

  <div class="cl-footer-actions">
    <button class="btn-outline btn-sm" onclick="clExportPDF('${projectId}')">
      ${icon('file-pdf', 14)} Exportar PDF
    </button>
  </div>
  `;
}

// ── Helpers de render ─────────────────────────────────────────────────────────
function renderProgress(done, total) {
  if (!total) return '';
  const pct = Math.round(done / total * 100);
  return `
  <div class="cl-progress-row">
    <span class="cl-progress-label">${done} de ${total} completados</span>
    <span class="cl-progress-pct">${pct}%</span>
  </div>
  <div class="cl-progress-bar"><div class="cl-progress-fill" style="width:${pct}%"></div></div>`;
}

// ── Persistencia ──────────────────────────────────────────────────────────────
async function _saveField(projectId, field, key, value) {
  const p = await projects.getById(projectId);
  p.checklistData = p.checklistData || {};
  p.checklistData[field] = p.checklistData[field] || {};
  p.checklistData[field][key] = value;
  await projects.update(projectId, { checklistData: p.checklistData });
}

window.clToggleHerr  = (pid, id, v)  => _saveField(pid, 'herr',  id,         v);
window.clToggleCons  = (pid, idx, v) => _saveField(pid, 'cons',  String(idx), v);
window.clToggleAdmin = (pid, id, v)  => _saveField(pid, 'admin', id,         v);
window.clToggleExec  = (pid, id, v)  => _saveField(pid, 'exec',  id,         v);

window.clPublish = async function(projectId) {
  const session = JSON.parse(sessionStorage.getItem('ecofit_session') || 'null');
  const p = await projects.getById(projectId);
  p.checklistData = p.checklistData || {};
  p.checklistData.publishedAt = isoNow();
  p.checklistData.publishedBy = session?.nombre || session?.username || 'Admin';
  await projects.update(projectId, { checklistData: p.checklistData });
  toast('✅ Checklist aprobado y publicado');
  navigate(`#checklist/${projectId}`);
};

window.clUnpublish = async function(projectId) {
  const p = await projects.getById(projectId);
  p.checklistData = p.checklistData || {};
  p.checklistData.publishedAt = null;
  p.checklistData.publishedBy = null;
  await projects.update(projectId, { checklistData: p.checklistData });
  toast('Aprobación revocada');
  navigate(`#checklist/${projectId}`);
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

  const checkRow = (done, label, note) =>
    `<tr class="${done?'done':''}"><td class="chk">${done?'☑':'☐'}</td><td>${label}${note?`<br><small>${note}</small>`:''}</td></tr>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Checklist — ${project.displayId}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 20px; }
    h1 { font-size: 16px; margin: 0 0 4px; } .sub { color: #666; font-size: 10px; margin-bottom: 12px; }
    h2 { font-size: 12px; background: #1a1a1a; color: #fff; padding: 4px 8px; margin: 16px 0 6px; border-radius: 3px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    td { padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
    td.chk { width: 22px; font-size: 14px; }
    tr.done td { color: #666; text-decoration: line-through; }
    small { color: #888; }
    .status { background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; padding: 6px 10px; margin-bottom: 12px; font-size: 10px; }
    @media print { body { padding: 0; } }
  </style></head><body>
  <h1>Checklist de instalación — ${project.displayId}</h1>
  <p class="sub">${esc(project.cliente || project.displayId)} · Techo: ${techo === 'cemento' ? 'Concreto/losa' : 'Metálico/lámina'}</p>
  <div class="status">${published}</div>

  <h2>Herramienta</h2>
  <table>${herramienta.map(h => checkRow(!!cl.herr?.[h.id], h.n, h.note)).join('')}</table>

  ${consumibles.length ? `<h2>Consumibles</h2>
  <table>${consumibles.map((c, i) => checkRow(!!cl.cons?.[String(i)], c.n, c.note)).join('')}</table>` : ''}

  <h2>Revisión pre-instalación (Admin)</h2>
  <table>${ADMIN_REVIEW_ITEMS.map(it => checkRow(!!cl.admin?.[it.id], it.label, it.detail)).join('')}</table>
  </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
};

// ── Lista de checklists (vista nav) ───────────────────────────────────────────
export async function renderChecklistsList(session) {
  const all = await projects.getAll();
  const activos = all
    .filter(p => !['cerrado', 'cancelado'].includes(p.estado))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const cards = activos.map(p => {
    const cl = p.checklistData || {};
    const cfg = p.projectConfig || null;
    const techo = cfg?.techo || cl.techo || 'cemento';
    const herr = HERRAMIENTA[techo] || HERRAMIENTA.cemento;
    const cons = cfg ? getConsumibles(cfg.estructura, cfg.base, techo) : [];

    const totalItems = herr.length + cons.length + ADMIN_REVIEW_ITEMS.length;
    const doneItems  =
      herr.filter(h => cl.herr?.[h.id]).length +
      cons.filter((_, i) => cl.cons?.[String(i)]).length +
      ADMIN_REVIEW_ITEMS.filter(it => cl.admin?.[it.id]).length;

    const pct      = totalItems > 0 ? Math.round(doneItems / totalItems * 100) : 0;
    const published = !!cl.publishedAt;

    return `
      <div class="cl-list-card" onclick="navigate('#checklist/${p.id}')">
        <div class="cl-list-header">
          <span class="cl-list-id">${esc(p.displayId)}</span>
          ${published
            ? `<span class="cl-badge cl-badge-ok">${icon('check-circle', 13)} Aprobado</span>`
            : `<span class="cl-badge">${pct}%</span>`}
        </div>
        <div class="cl-list-cliente">${esc(p.clientName || '—')}</div>
        <div class="cl-progress-row">
          <div class="cl-prog-bar"><div class="cl-prog-fill" style="width:${pct}%"></div></div>
          <span class="cl-prog-txt">${doneItems}/${totalItems}</span>
        </div>
      </div>`;
  });

  return `
  <div class="view-header">
    <h1 class="hdr-title">Checklists</h1>
  </div>
  ${activos.length === 0
    ? '<p class="empty-msg">No hay proyectos activos.</p>'
    : `<div class="cl-list-grid">${cards.join('')}</div>`}
  `;
}
