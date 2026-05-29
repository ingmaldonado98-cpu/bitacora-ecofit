// dashboard.js — Lista de proyectos y estadísticas

import { projects } from './db.js';
import { esc, fmtFecha, fmtRelativa, fmtProjectId, ESTADOS, PRIORIDADES, TIPOS_SISTEMA, syncBadge } from './utils.js';
import { isAdmin, isLider } from './auth.js';

// ── Render dashboard completo ──────────────────────────────────────────────────
export async function renderDashboard(session) {
  const all = await projects.getAll();
  const stats = calcStats(all);

  return `
  <div class="view-header">
    <div class="header-brand">
      <ph-icon name="sun" class="brand-sun"></ph-icon>
      <div>
        <h1 class="brand-title">Ecofit Solar</h1>
        <span class="brand-sub">Bitácora de Instalaciones</span>
      </div>
    </div>
    <div class="header-actions">
      ${isLider(session) ? `<button class="btn-icon-hdr" onclick="navigate('#nuevo-proyecto')" title="Nuevo proyecto">
        <ph-icon name="plus"></ph-icon>
      </button>` : ''}
      <button class="btn-icon-hdr" onclick="navigate('#settings')" title="Ajustes">
        <ph-icon name="gear"></ph-icon>
      </button>
    </div>
  </div>

  <div class="stats-row">
    <div class="stat-pill">
      <span class="sp-num">${stats.total}</span>
      <span class="sp-lbl">Total</span>
    </div>
    <div class="stat-pill sp-active">
      <span class="sp-num">${stats.en_progreso}</span>
      <span class="sp-lbl">En progreso</span>
    </div>
    <div class="stat-pill sp-review">
      <span class="sp-num">${stats.pendiente_revision}</span>
      <span class="sp-lbl">Por revisar</span>
    </div>
    <div class="stat-pill sp-closed">
      <span class="sp-num">${stats.cerrado}</span>
      <span class="sp-lbl">Cerrados</span>
    </div>
  </div>

  <div class="search-filter-bar">
    <div class="search-wrap">
      <ph-icon name="magnifying-glass" class="search-icon"></ph-icon>
      <input type="search" id="dash-search" placeholder="Buscar por ID, cliente, serial…"
             oninput="window._dashSearch(this.value)" class="search-input" />
    </div>
    <select id="dash-filter-estado" class="filter-select" onchange="window._dashFilter()">
      <option value="">Todos los estados</option>
      ${Object.entries(ESTADOS).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
    </select>
    <select id="dash-filter-tipo" class="filter-select" onchange="window._dashFilter()">
      <option value="">Todos los tipos</option>
      ${Object.entries(TIPOS_SISTEMA).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
    </select>
  </div>

  <div id="projects-list">
    ${renderProjectList(all)}
  </div>

  ${isLider(session) ? `
  <button class="fab" onclick="navigate('#nuevo-proyecto')" title="Nuevo proyecto">
    <ph-icon name="plus" size="28"></ph-icon>
  </button>` : ''}
  `;
}

// ── Filtros interactivos ───────────────────────────────────────────────────────
let _allProjects = [];

export function initDashboardFilters(all) {
  _allProjects = all;
}

window._dashSearch = async function(q) {
  const all = q.trim() ? await projects.search(q) : await projects.getAll();
  _allProjects = all;
  applyFilters();
};

window._dashFilter = function() { applyFilters(); };

function applyFilters() {
  const estado = document.getElementById('dash-filter-estado')?.value;
  const tipo   = document.getElementById('dash-filter-tipo')?.value;
  let list = _allProjects;
  if (estado) list = list.filter(p => p.estado === estado);
  if (tipo)   list = list.filter(p => p.tipoSistema === tipo);
  const el = document.getElementById('projects-list');
  if (el) el.innerHTML = renderProjectList(list);
}

// ── Tarjetas de proyecto ───────────────────────────────────────────────────────
function renderProjectList(list) {
  if (!list.length) return `<p class="empty-msg">Sin proyectos. Crea el primero con <strong>+</strong>.</p>`;
  return list
    .sort((a,b) => new Date(b.updatedAt||b.createdAt) - new Date(a.updatedAt||a.createdAt))
    .map(projectCard)
    .join('');
}

function projectCard(p) {
  const est  = ESTADOS[p.estado] || ESTADOS.borrador;
  const prio = PRIORIDADES[p.prioridad] || PRIORIDADES.normal;
  const tipo = TIPOS_SISTEMA[p.tipoSistema];
  const lastObs = p.observaciones?.slice(-1)[0];

  return `
  <div class="project-card" onclick="navigate('#proyecto/${p.id}')">
    <div class="pc-top">
      <div class="pc-id-wrap">
        <span class="pc-id">${esc(p.displayId)}</span>
        <span class="pc-prio" style="color:${prio.color}" title="Prioridad ${prio.label}">●</span>
        ${syncBadge(p.driveSynced)}
      </div>
      <span class="pc-estado" style="background:${est.color}22;color:${est.color}">
        ${est.label}
      </span>
    </div>

    <h3 class="pc-cliente">${esc(p.clientName || '—')}</h3>

    <div class="pc-meta">
      ${tipo ? `<span class="pc-tag"><ph-icon name="${tipo.icon}" size="12"></ph-icon> ${tipo.label}</span>` : ''}
      ${p.direccion ? `<span class="pc-tag"><ph-icon name="map-pin" size="12"></ph-icon> ${esc(p.direccion)}</span>` : ''}
      ${p.fechaInicio ? `<span class="pc-tag"><ph-icon name="calendar" size="12"></ph-icon> ${fmtFecha(p.fechaInicio)}</span>` : ''}
    </div>

    ${lastObs ? `
    <div class="pc-obs" style="border-left:3px solid ${PRIORIDADES[lastObs.prioridad]?.color||'#7aab8a'}">
      <ph-icon name="chat-text" size="12"></ph-icon>
      <span>${esc(lastObs.texto.slice(0,80))}${lastObs.texto.length>80?'…':''}</span>
    </div>` : ''}

    <div class="pc-footer">
      <span class="pc-updated">Actualizado ${fmtRelativa(p.updatedAt||p.createdAt)}</span>
      <ph-icon name="caret-right" class="pc-arrow"></ph-icon>
    </div>
  </div>`;
}

function calcStats(all) {
  const r = { total: all.length, en_progreso: 0, pendiente_revision: 0, cerrado: 0 };
  all.forEach(p => { if (r[p.estado] !== undefined) r[p.estado]++; });
  return r;
}
