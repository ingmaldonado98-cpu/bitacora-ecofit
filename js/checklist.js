// checklist.js — Módulo Checklist de instalación Ecofit V6

import { projects } from './db.js';
import { esc, toast, isoNow } from './utils.js';
import { canEdit, isAdmin } from './auth.js';
import { HERRAMIENTA, getConsumibles, ADMIN_REVIEW_ITEMS } from '../modules/checklist/index.js';
import { buildDiagramSVG, buildGuiaData, buildTorqueTable } from '../modules/calculadora/index.js';

let _clDiagScale = 1;
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
  const consumibles = cfg
    ? (cfg.computed?.consumibles || []).map(c => ({ n: c.nombre, unit: c.unit, qty: c.qty }))
    : [];
  const bomItems  = cfg?.computed?.bom || [];
  const doneHerr  = herramienta.filter(h => cl.herr?.[h.id]).length;
  const doneCons  = consumibles.filter((_, i) => cl.cons?.[String(i)]).length;
  const doneBOM   = bomItems.filter((_, i) => cl.bom?.[String(i)]).length;
  const doneAdmin = ADMIN_REVIEW_ITEMS.filter(it => cl.admin?.[it.id]).length;
  // allAdmin solo es true si HAY ítems Y todos están marcados (evita true cuando length===0)
  const allAdmin  = ADMIN_REVIEW_ITEMS.length > 0 && doneAdmin === ADMIN_REVIEW_ITEMS.length;
  const published = !!cl.publishedAt;
  const totalMat  = bomItems.length + consumibles.length;
  const doneMat   = doneBOM + doneCons;

  return `
  <div class="breadcrumb">
    <span class="bc-link" onclick="navigate('#dashboard')">Inicio</span>
    <span class="bc-sep">›</span>
    <span class="bc-link" onclick="navigate('#proyecto/${projectId}')">${esc(project.displayId)}</span>
    <span class="bc-sep">›</span>
    <span class="bc-current">Checklist</span>
  </div>
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
  </div>` : admin ? `
  <div class="cl-status-banner cl-ready">
    ${icon('check-circle', 18, 'icon-ok')}
    <div class="cl-status-text">
      <strong>Listo para publicar</strong>
      <span>Aprueba el checklist para que el técnico lo vea como completado</span>
    </div>
    <button class="btn-primary btn-sm" onclick="clPublish('${projectId}')">Aprobar y publicar</button>
  </div>` : ''}

  <div class="tab-bar" id="cl-tabs">
    <button class="tab-btn tab-active" data-tab="cl-herr" onclick="switchTab('cl-tabs','cl-herr',this)">
      Herramienta${doneHerr === herramienta.length && herramienta.length ? '<span class="tab-badge tab-ok">✓</span>' : ''}
    </button>
    <button class="tab-btn" data-tab="cl-cons" onclick="switchTab('cl-tabs','cl-cons',this)">
      Materiales${totalMat > 0 && doneMat === totalMat ? '<span class="tab-badge tab-ok">✓</span>' : (totalMat > 0 ? `<span class="tab-badge">${doneMat}/${totalMat}</span>` : '')}
    </button>
    <button class="tab-btn" data-tab="cl-guia" onclick="switchTab('cl-tabs','cl-guia',this)">
      Guía técnica
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

  <!-- Materiales: BOM + Consumibles unificados -->
  <div id="cl-cons" class="tab-panel">
    ${cfg ? (() => {
      // ── Agrupar BOM por categoría ──────────────────────────────────────────
      const grpOrder = ['rieles','bases','abrazaderas','accesorios','tierra','otro'];
      const grpLabel = { rieles:'Rieles', bases:'Bases', abrazaderas:'Abrazaderas', accesorios:'Accesorios', tierra:'Tierra / Puesta a tierra', otro:'Otros' };
      const bomByGrp = {};
      bomItems.forEach((item, i) => {
        const g = (item.grp || 'otro').toLowerCase();
        if (!bomByGrp[g]) bomByGrp[g] = [];
        bomByGrp[g].push({ ...item, _idx: i });
      });
      const bomSection = bomItems.length ? `
      <div class="card">
        <div class="card-title-row">
          <h3 class="card-title">Lista de materiales <span style="color:var(--text-muted);font-weight:400;font-size:.8rem">${bomItems.length} ítems · ${cfg.layout?.totalPanels||0} paneles</span></h3>
          <span class="cl-prog-lbl">${doneBOM}/${bomItems.length}</span>
        </div>
        ${renderProgress(doneBOM, bomItems.length)}
        ${grpOrder.filter(g => bomByGrp[g]).map(g => `
          <div class="cl-bom-group">
            <span class="cl-bom-grp-lbl">${grpLabel[g] || g}</span>
            <div class="cl-item-list">
              ${bomByGrp[g].map(item => `
              <label class="cl-item ${cl.bom?.[String(item._idx)] ? 'cl-item-done' : ''}">
                <input type="checkbox" ${cl.bom?.[String(item._idx)] ? 'checked' : ''} ${!edit ? 'disabled' : ''}
                  onchange="this.closest('.cl-item').classList.toggle('cl-item-done',this.checked);clToggleBOM('${projectId}',${item._idx},this.checked)">
                <div class="cl-item-text" style="flex:1">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span class="cl-item-name">${esc(item.name)}</span>
                    <span class="cl-bom-partnum">${esc(item.partNum||'')}</span>
                    <span class="cl-qty-badge">${item.qty} ${item.unit}</span>
                  </div>
                </div>
              </label>`).join('')}
            </div>
          </div>`).join('')}
      </div>` : '';

      // ── Consumibles ────────────────────────────────────────────────────────
      const consSection = consumibles.length ? `
      <div class="card">
        <div class="card-title-row">
          <h3 class="card-title">Consumibles de anclaje</h3>
          <span class="cl-prog-lbl">${doneCons}/${consumibles.length}</span>
        </div>
        ${renderProgress(doneCons, consumibles.length)}
        <div class="cl-item-list">
          ${consumibles.map((c, i) => `
            <label class="cl-item ${cl.cons?.[String(i)] ? 'cl-item-done' : ''}">
              <input type="checkbox" ${cl.cons?.[String(i)] ? 'checked' : ''} ${!edit ? 'disabled' : ''}
                onchange="this.closest('.cl-item').classList.toggle('cl-item-done',this.checked);clToggleCons('${projectId}',${i},this.checked)">
              <div class="cl-item-text" style="flex:1">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span class="cl-item-name">${esc(c.n)}</span>
                  ${c.qty != null ? `<span class="cl-qty-badge">${c.qty} ${c.unit}</span>` : ''}
                </div>
              </div>
            </label>`).join('')}
        </div>
      </div>` : '';

      return bomSection + consSection;
    })() : `
    <div class="card">
      <div class="cl-no-cfg">
        ${icon('calculator', 36)}
        <p>Genera el BOM en la calculadora para ver la lista de materiales y consumibles automáticamente.</p>
        <button class="btn-outline btn-sm" onclick="navigate('#calculadora/${projectId}')">
          ${icon('calculator', 14)} Abrir calculadora
        </button>
      </div>
    </div>`}
  </div>

  <!-- Guía técnica -->
  <div id="cl-guia" class="tab-panel">
    ${renderGuiaTab(cfg, projectId)}
  </div>

  <div class="cl-footer-actions">
    <button class="btn-outline btn-sm" onclick="clExportPDF('${projectId}')">
      ${icon('file-pdf', 14)} Exportar PDF
    </button>
  </div>
  `;
}

// ── Guía técnica ──────────────────────────────────────────────────────────────
function renderGuiaTab(cfg, projectId) {
  if (!cfg) return `
  <div class="card">
    <div class="cl-no-cfg">
      ${icon('calculator', 36)}
      <p>Genera el BOM en la calculadora para ver el diagrama, medidas y cantidades de instalación.</p>
      <button class="btn-outline btn-sm" onclick="navigate('#calculadora/${projectId}')">
        ${icon('calculator', 14)} Abrir calculadora
      </button>
    </div>
  </div>`;

  const rd     = cfg.layout?.rowsData || [1];
  const pW     = cfg.panel?.width     || 1.134;
  const pH     = cfg.panel?.height    || 1.990;
  const est    = cfg.estructura       || 'k2';
  const techo  = cfg.techo            || 'cemento';
  const isAlx  = est === 'aluminex';
  const railName = isAlx ? 'NXT-RX (4.20 m)' : 'CrossRail 48-X (4.70 m)';
  const gH     = est === 'aluminex' ? 0.022 : 0.010;

  const svgStr     = buildDiagramSVG(rd, pW, pH, est);
  const guia       = buildGuiaData(rd, pW, pH, est);
  const torques    = buildTorqueTable(est, techo);
  const computedC  = cfg.computed?.consumibles || [];

  // Diagrama
  const diagCard = `
  <div class="card" style="padding:0;overflow:hidden" id="cl-diagram-card">
    <div style="padding:10px 14px;background:var(--surface2);display:flex;justify-content:space-between;align-items:center;gap:8px">
      <h3 class="card-title" style="margin:0">Diagrama — vista superior</h3>
      <div class="diag-zoom-btns">
        <button class="diag-btn" onclick="clDiagZoom(-0.2)">−</button>
        <button class="diag-btn" onclick="clDiagZoomReset()">1:1</button>
        <button class="diag-btn" onclick="clDiagZoom(0.2)">+</button>
        <button class="diag-btn" onclick="clDiagFullscreen()">⛶</button>
      </div>
    </div>
    <div style="padding:12px;overflow:auto;background:#0e1e11;cursor:grab">
      <div id="cl-diag-inner" style="transform-origin:top left;transition:transform .15s;display:inline-block">
        ${svgStr}
      </div>
    </div>
  </div>`;

  // Medidas de instalación
  const guiaBlocks = guia.map(g => {
    const { n, rows, cut, clampPos, railGap, feet, span } = g;
    const rowLbl = rows.length === 1 ? `Fila ${rows[0]}` : `Filas ${rows.join(', ')}`;
    const feetMarks = feet.map((fp, fi) => {
      const isEdge = fi === 0 || fi === feet.length - 1;
      const lbl = fi === 0 ? 'S1 izq.' : fi === feet.length - 1 ? `S${fi+1} der.` : `S${fi+1}`;
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;
        padding:6px 10px;border-radius:6px;
        background:${isEdge?'rgba(46,189,66,.12)':'var(--surface2)'};
        border:1px solid ${isEdge?'var(--g500)':'var(--border)'}">
        <span style="font-family:monospace;font-size:.9rem;font-weight:700;color:${isEdge?'var(--g300)':'var(--text)'}">${(fp*100).toFixed(1)} cm</span>
        <span style="font-size:.68rem;color:var(--text-muted)">${lbl}</span>
      </div>`;
    }).join('');
    return `
    <div style="margin-bottom:12px;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;background:var(--surface2)">
        <span style="font-weight:700;font-size:.86rem;color:var(--text)">${rowLbl} — ${n} panel${n>1?'es':''}</span>
        <span style="font-family:monospace;font-size:.9rem;color:var(--solar);font-weight:700">✂ ${(cut*100).toFixed(1)} cm</span>
      </div>
      <div style="padding:10px 14px;display:flex;flex-direction:column;gap:8px">
        <div style="font-size:.82rem">
          <span style="color:var(--text-muted)">Cortar ${railName}: </span>
          <b style="color:var(--text)">${(cut*100).toFixed(1)} cm</b>
          <span style="color:var(--text-muted);font-size:.75rem"> (5 cm vuelo × 2 + ${n}×${(pW*100).toFixed(1)} cm${n>1?` + ${n-1}×${(gH*100).toFixed(1)} cm gap`:''})</span>
        </div>
        <div style="font-size:.82rem;color:var(--text-muted)">
          Rieles: <b style="color:var(--g300)">${(clampPos*100).toFixed(1)} cm</b> del borde corto ·
          Separación: <b style="color:var(--g300)">${(railGap*100).toFixed(1)} cm</b>
        </div>
        <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:4px">
          ${feet.length} pata${feet.length>1?'s':''}/riel · span <b style="color:var(--text)">${(span*100).toFixed(1)} cm</b>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${feetMarks}</div>
      </div>
    </div>`;
  }).join('');

  // Consumibles con cantidades exactas
  const consRows = computedC.length
    ? computedC.map(c => `
    <div style="display:flex;justify-content:space-between;align-items:center;
      padding:8px 12px;border-bottom:1px solid var(--border)">
      <span style="font-size:.86rem;color:var(--text)">${c.nombre}</span>
      <span style="font-family:monospace;font-weight:700;font-size:1rem;color:var(--solar)">
        ${c.qty} <span style="font-size:.75rem;color:var(--text-muted)">${c.unit}</span>
      </span>
    </div>`).join('')
    : '<p style="padding:12px;font-size:.84rem;color:var(--text-muted);margin:0">Sin datos calculados.</p>';

  // Torques
  const torqRows = torques.map(t => `
  <div style="padding:8px 12px;border-bottom:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:.84rem;font-weight:600;color:var(--text)">${t.comp}</span>
      <span style="font-family:monospace;font-weight:700;color:var(--g300);font-size:.84rem">${t.torque}</span>
    </div>
    <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">${t.nota}</div>
  </div>`).join('');

  return `
  ${diagCard}

  <div class="card" style="padding:0;overflow:hidden">
    <div style="padding:10px 14px;background:var(--surface2);display:flex;justify-content:space-between;align-items:center">
      <h3 class="card-title" style="margin:0">Medidas de instalación</h3>
      <span style="font-size:.75rem;color:var(--text-muted)">${isAlx?'Aluminex':'K2 Systems'} · ${techo==='cemento'?'Concreto':'Metal'}</span>
    </div>
    <div style="padding:12px 14px">${guiaBlocks}</div>
  </div>

  <div class="card" style="padding:0;overflow:hidden">
    <div style="padding:10px 14px;background:var(--surface2)">
      <h3 class="card-title" style="margin:0">Consumibles — cantidades exactas</h3>
    </div>
    ${consRows}
  </div>

  <div class="card" style="padding:0;overflow:hidden">
    <div style="padding:10px 14px;background:var(--surface2)">
      <h3 class="card-title" style="margin:0">Torques de apriete</h3>
    </div>
    ${torqRows}
  </div>`;
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
// Usa updateDoc con dot-notation para evitar race condition entre toggles rápidos
async function _saveField(projectId, field, key, value) {
  await projects.setField(projectId, `checklistData.${field}.${key}`, value);
}

window.clToggleHerr  = (pid, id, v)  => _saveField(pid, 'herr',  id,         v);
window.clToggleCons  = (pid, idx, v) => _saveField(pid, 'cons',  String(idx), v);
window.clToggleBOM   = (pid, idx, v) => _saveField(pid, 'bom',   String(idx), v);
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

// ── Zoom diagrama en checklist ────────────────────────────────────────────────
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
    const cons = cfg ? (cfg.computed?.consumibles || []) : [];

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
