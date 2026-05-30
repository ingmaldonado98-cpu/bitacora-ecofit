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
      <svg width="28" height="28" viewBox="0 0 256 256" fill="currentColor" class="brand-sun">
        <path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z"/>
      </svg>
      <div>
        <h1 class="brand-title">Ecofit Solar</h1>
        <span class="brand-sub">Bitácora de Instalaciones</span>
      </div>
    </div>
    <div class="header-actions">
      ${isLider(session) ? `<button class="btn-icon-hdr" onclick="navigate('#nuevo-proyecto')" title="Nuevo proyecto">
        <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
          <path d="M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z"/>
        </svg>
      </button>` : ''}
      <button class="btn-icon-hdr" onclick="navigate('#settings')" title="Ajustes">
        <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
          <path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,72a24,24,0,1,1,24-24A24,24,0,0,1,128,152Zm109.94-52.79a12,12,0,0,0-7.27-9.6l-15.53-6.07L225,70.79a12,12,0,0,0-2.63-13c-4.68-4.69-11.81-5.85-17.79-3.88l-15.3,5.2-9.47-12.83a12,12,0,0,0-12.65-4.41l-17.06,4.5-4.93-15.51A12,12,0,0,0,133.5,23h-11a12,12,0,0,0-11.67,8.87L106,47.38,88.94,42.88a12,12,0,0,0-12.65,4.41L66.82,60.12,51.52,54.92c-6-1.97-13.11-.81-17.79,3.88A12,12,0,0,0,31.1,71.93l9.86,12.61L25.43,90.61a12,12,0,0,0-7.27,9.6A102.4,102.4,0,0,0,17,112a102.4,102.4,0,0,0,1.16,11.79,12,12,0,0,0,7.27,9.6l15.53,6.07L31,152.79a12,12,0,0,0,2.63,13c4.68,4.68,11.81,5.85,17.79,3.87l15.3-5.19,9.47,12.83a12,12,0,0,0,12.65,4.41l17.06-4.5,4.93,15.51A12,12,0,0,0,122.5,201h11a12,12,0,0,0,11.67-8.87l4.88-15.51,17.06,4.5a12,12,0,0,0,12.65-4.41l9.47-12.83,15.3,5.19c6,2,13.11.81,17.79-3.87a12,12,0,0,0,2.63-13l-9.86-12.62,15.53-6.07a12,12,0,0,0,7.27-9.6A102.4,102.4,0,0,0,239,112,102.4,102.4,0,0,0,237.84,100.21Z"/>
        </svg>
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
