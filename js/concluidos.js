// concluidos.js — Proyectos cerrados y cancelados

import { projects } from './db.js';
import { esc, fmtFecha, fmtRelativa, ESTADOS, TIPOS_SISTEMA } from './utils.js';
import { icon } from './icons.js';

const PAGE_SIZE = 20;
let _page = 0;
let _allConcluidos = [];

export async function renderConcluidos(session) {
  _page = 0;
  const all = await projects.getAll();
  _allConcluidos = all
    .filter(p => ['cerrado', 'cancelado', 'fuera_garantia'].includes(p.estado))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  return `
  <div class="dash-topbar">
    <h1 class="dash-title">Concluidos</h1>
    <div class="dash-topbar-actions">
      <span class="dash-count-badge">${_allConcluidos.length} proyecto${_allConcluidos.length !== 1 ? 's' : ''}</span>
    </div>
  </div>

  <div class="search-filter-bar">
    <div class="search-wrap">
      <ph-icon name="magnifying-glass" class="search-icon"></ph-icon>
      <input type="search" id="conc-search" placeholder="Buscar en concluidos…"
             oninput="window._concSearch(this.value)" class="search-input" />
    </div>
    <select id="conc-filter-tipo" class="filter-select" onchange="window._concFilter()">
      <option value="">Todos los tipos</option>
      ${Object.entries(TIPOS_SISTEMA).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
    </select>
    <select id="conc-filter-estado" class="filter-select" onchange="window._concFilter()">
      <option value="">Todos los concluidos</option>
      <option value="cerrado">Solo cerrados</option>
      <option value="cancelado">Solo cancelados</option>
      <option value="fuera_garantia">Solo fuera de garantía</option>
    </select>
  </div>

  <div id="concluidos-list">
    ${renderList(_allConcluidos)}
  </div>`;
}

function renderList(list) {
  if (!list.length) return `
    <div class="empty-state" style="padding:48px 20px">
      <div class="empty-state-icon">📋</div>
      <p class="empty-state-msg">Sin proyectos concluidos aún.</p>
    </div>`;

  const total = list.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  _page = Math.max(0, Math.min(_page, pages - 1));
  const slice = list.slice(_page * PAGE_SIZE, (_page + 1) * PAGE_SIZE);

  const pagination = pages > 1 ? `
    <div class="dash-pagination">
      <button class="btn-outline btn-sm" onclick="window._concPage(-1)" ${_page === 0 ? 'disabled' : ''}>‹ Anterior</button>
      <span class="dash-pag-info">Pág. ${_page + 1} de ${pages} · ${total} proyectos</span>
      <button class="btn-outline btn-sm" onclick="window._concPage(1)" ${_page >= pages - 1 ? 'disabled' : ''}>Siguiente ›</button>
    </div>` : '';

  return slice.map(concCard).join('') + pagination;
}

function concCard(p) {
  const est  = ESTADOS[p.estado] || ESTADOS.cerrado;
  const tipo = TIPOS_SISTEMA[p.tipoSistema];

  return `
  <div class="project-card project-card-conc" onclick="navigate('#proyecto/${p.id}')">
    <div class="pc-top">
      <span class="pc-id">${esc(p.displayId)}</span>
      <span class="pc-estado" style="background:${est.color}22;color:${est.color}">${est.label}</span>
    </div>
    <h3 class="pc-cliente">${esc(p.clientName || '—')}</h3>
    <div class="pc-meta">
      ${tipo ? `<span class="pc-tag">${tipo.label}</span>` : ''}
      ${p.direccion ? `<span class="pc-tag">${icon('map-pin', 12)} ${esc(p.direccion)}</span>` : ''}
      ${p.fechaInicio ? `<span class="pc-tag">${icon('calendar', 12)} ${fmtFecha(p.fechaInicio)}</span>` : ''}
    </div>
    <div class="pc-footer">
      <span class="pc-updated">${est.label} ${fmtRelativa(p.updatedAt || p.createdAt)}</span>
      <ph-icon name="caret-right" class="pc-arrow"></ph-icon>
    </div>
  </div>`;
}

// ── Filtros ────────────────────────────────────────────────────────────────────
let _searchTimer = null;
window._concSearch = function(q) {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(async () => {
    const all = await projects.getAll();
    _allConcluidos = all.filter(p => {
      if (!['cerrado', 'cancelado', 'fuera_garantia'].includes(p.estado)) return false;
      if (!q.trim()) return true;
      const lower = q.toLowerCase();
      return (
        (p.displayId || '').toLowerCase().includes(lower) ||
        (p.clientName || '').toLowerCase().includes(lower)
      );
    }).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    _page = 0;
    _updateList();
  }, 350);
};

window._concFilter = function() {
  _page = 0;
  _updateList();
};

window._concPage = function(dir) {
  _page += dir;
  _updateList();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function _updateList() {
  const tipo   = document.getElementById('conc-filter-tipo')?.value;
  const estado = document.getElementById('conc-filter-estado')?.value;
  let list = _allConcluidos;
  if (tipo)   list = list.filter(p => p.tipoSistema === tipo);
  if (estado) list = list.filter(p => p.estado === estado);
  const el = document.getElementById('concluidos-list');
  if (el) el.innerHTML = renderList(list);
}
