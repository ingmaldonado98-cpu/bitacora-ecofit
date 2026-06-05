// dashboard.js — Lista de proyectos y estadísticas

import { projects, users } from './db.js';
import { esc, fmtFecha, fmtRelativa, fmtProjectId, ESTADOS, PRIORIDADES, TIPOS_SISTEMA, syncBadge, getPendingSrc } from './utils.js';
import { isAdmin, isLider } from './auth.js';
import { icon } from './icons.js';

// ── Badge del nav ─────────────────────────────────────────────────────────────
export function updateNavBadge(count) {
  const badge = document.getElementById('nav-badge-revision');
  if (!badge) return;
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.style.display = count > 0 ? '' : 'none';
}

// ── Render dashboard completo ──────────────────────────────────────────────────
export async function renderDashboard(session) {
  _tecnicoFilter = null;
  _page = 0;
  const [all, allUsers] = await Promise.all([projects.getAll(), users.getAll()]);

  // Proyectos activos = todo excepto cerrado y cancelado
  const activos = all.filter(p => !['cerrado', 'cancelado'].includes(p.estado));
  const stats = calcStats(activos);

  const pendientes = activos.filter(p => p.estado === 'pendiente_revision')
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  updateNavBadge(pendientes.length);

  return `
  <div class="dash-topbar">
    <h1 class="dash-title">Proyectos</h1>
    <div class="dash-topbar-actions">
      ${isLider(session) ? `
      <button class="btn-icon-hdr" onclick="navigate('#nuevo-proyecto')" title="Nuevo proyecto">
        <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
          <path d="M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z"/>
        </svg>
      </button>` : ''}
      <button class="btn-icon-hdr" onclick="navigate('#mapa')" title="Mapa de instalaciones">
        <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
          <path d="M228.92,49.69a8,8,0,0,0-6.86-1.45L160.93,63.52,99.58,32.84a8,8,0,0,0-6.37-.4L29.21,55.07A8,8,0,0,0,24,62.46V200a8,8,0,0,0,9.94,7.76l61.13-15.28,61.35,30.68A8.15,8.15,0,0,0,160,224a8,8,0,0,0,2.06-.27l64-16A8,8,0,0,0,232,200V56A8,8,0,0,0,228.92,49.69ZM104,52.94l48,24V203.06l-48-24ZM40,74.08l48-17.11V188.17L40,200.33ZM216,181.92l-48,12V62.94l48-12Z"/>
        </svg>
      </button>
    </div>
  </div>

  <div class="stats-row">
    <div class="stat-pill sp-active">
      <span class="sp-num">${stats.en_progreso}</span>
      <span class="sp-lbl">En progreso</span>
    </div>
    <div class="stat-pill sp-review">
      <span class="sp-num">${stats.pendiente_revision}</span>
      <span class="sp-lbl">Por revisar</span>
    </div>
    <div class="stat-pill">
      <span class="sp-num">${stats.total}</span>
      <span class="sp-lbl">Activos</span>
    </div>
  </div>

  ${isAdmin(session) && pendientes.length ? renderParaRevisar(pendientes, allUsers) : ''}

  <div class="search-filter-bar">
    <div class="search-wrap">
      <ph-icon name="magnifying-glass" class="search-icon"></ph-icon>
      <input type="search" id="dash-search" placeholder="Buscar por nombre, cliente, serial…"
             oninput="window._dashSearch(this.value)" class="search-input" />
    </div>
    <select id="dash-filter-estado" class="filter-select" onchange="window._dashFilter()">
      <option value="">Todos los estados</option>
      ${Object.entries(ESTADOS).filter(([k]) => !['cerrado','cancelado'].includes(k))
        .map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
    </select>
    <select id="dash-filter-tipo" class="filter-select" onchange="window._dashFilter()">
      <option value="">Todos los tipos</option>
      ${Object.entries(TIPOS_SISTEMA).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
    </select>
  </div>

  <div id="projects-list">
    ${renderProjectList(activos)}
  </div>

  ${isLider(session) ? `
  <button class="fab" onclick="navigate('#nuevo-proyecto')" title="Nuevo proyecto">
    <ph-icon name="plus" size="28"></ph-icon>
  </button>` : ''}
  `;
}

// ── Carga de trabajo por técnico (solo admin) ─────────────────────────────────
function renderWorkload(all, allUsers) {
  const activos = ['borrador','en_progreso','pendiente_revision','observado'];
  const tecnicos = allUsers.filter(u => u.activo && u.rol !== 'admin');
  if (!tecnicos.length) return '';

  const chips = tecnicos.map(u => {
    const propios   = all.filter(p => activos.includes(p.estado) && p.tecnicoLiderId === u.id).length;
    const apoyo     = all.filter(p => activos.includes(p.estado) && (p.tecnicosApoyo||[]).includes(u.id)).length;
    const total     = propios + apoyo;
    const color     = total === 0 ? 'var(--text-muted)' : total <= 2 ? 'var(--g300)' : total <= 4 ? 'var(--solar)' : 'var(--red)';
    const rol       = u.rol === 'lider' ? 'Líder' : 'Apoyo';
    return `
    <button class="workload-chip" onclick="window._dashFilterTecnico('${u.id}')" title="Ver proyectos de ${esc(u.nombre)}">
      <span class="wl-nombre">${esc(u.nombre.split(' ')[0])}</span>
      <span class="wl-rol">${rol}</span>
      <span class="wl-count" style="color:${color}">${total}</span>
      ${propios && apoyo ? `<span class="wl-sub">${propios}L·${apoyo}A</span>` : ''}
    </button>`;
  }).join('');

  return `
  <div class="workload-bar">
    <span class="wl-label">Carga</span>
    ${chips}
  </div>`;
}

// ── Filtros interactivos ───────────────────────────────────────────────────────
let _allProjects = [];

export function initDashboardFilters(all) {
  // Solo proyectos activos en el dashboard principal
  _allProjects = all.filter(p => !['cerrado', 'cancelado'].includes(p.estado));
}

const PAGE_SIZE = 20;
let _page = 0;
let _tecnicoFilter = null;
window._dashFilterTecnico = function(uid) {
  _tecnicoFilter = _tecnicoFilter === uid ? null : uid;
  document.querySelectorAll('.workload-chip').forEach(c => {
    const isMe = c.getAttribute('onclick').includes(uid);
    c.classList.toggle('wl-active', isMe && _tecnicoFilter === uid);
  });
  applyFilters();
};

let _searchTimer = null;
window._dashSearch = function(q) {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(async () => {
    const all = q.trim() ? await projects.search(q) : await projects.getAll();
    // El dashboard solo muestra proyectos activos (no cerrados ni cancelados)
    _allProjects = all.filter(p => !['cerrado', 'cancelado'].includes(p.estado));
    _page = 0;
    applyFilters();
  }, 350);
};

window._dashFilter = function() { _page = 0; applyFilters(); };
window._dashPage   = function(dir) {
  _page += dir;
  applyFilters();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function applyFilters() {
  const estado = document.getElementById('dash-filter-estado')?.value;
  const tipo   = document.getElementById('dash-filter-tipo')?.value;
  let list = _allProjects;
  if (estado) list = list.filter(p => p.estado === estado);
  if (tipo)   list = list.filter(p => p.tipoSistema === tipo);
  if (_tecnicoFilter) list = list.filter(p =>
    p.tecnicoLiderId === _tecnicoFilter ||
    (p.tecnicosApoyo || []).includes(_tecnicoFilter)
  );
  const el = document.getElementById('projects-list');
  if (el) el.innerHTML = renderProjectList(list);
}

// ── Tarjetas de proyecto ───────────────────────────────────────────────────────
function renderProjectList(list) {
  if (!list.length) return `
  <div class="empty-state">
    <div class="empty-state-icon">☀️</div>
    <p class="empty-state-msg">No hay proyectos aún.<br>Crea el primero para empezar.</p>
    <button class="empty-state-cta" onclick="navigate('#nuevo-proyecto')">+ Nuevo proyecto</button>
  </div>`;
  const sorted = list.sort((a,b) => new Date(b.updatedAt||b.createdAt) - new Date(a.updatedAt||a.createdAt));
  const total  = sorted.length;
  const pages  = Math.ceil(total / PAGE_SIZE);
  _page = Math.max(0, Math.min(_page, pages - 1));
  const slice  = sorted.slice(_page * PAGE_SIZE, (_page + 1) * PAGE_SIZE);

  const pagination = pages > 1 ? `
  <div class="dash-pagination">
    <button class="btn-outline btn-sm" onclick="window._dashPage(-1)" ${_page === 0 ? 'disabled' : ''}>‹ Anterior</button>
    <span class="dash-pag-info">Pág. ${_page + 1} de ${pages} · ${total} proyectos</span>
    <button class="btn-outline btn-sm" onclick="window._dashPage(1)" ${_page >= pages - 1 ? 'disabled' : ''}>Siguiente ›</button>
  </div>` : '';

  return slice.map(projectCard).join('') + pagination;
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

    <div class="pc-cliente-row">
      ${p.clienteFoto ? `<img class="pc-cliente-foto" src="${esc(getPendingSrc({url: p.clienteFoto}) || p.clienteFoto)}" alt="Foto cliente" />` : ''}
      <h3 class="pc-cliente">${esc(p.clientName || '—')}</h3>
      ${p.clienteTelefono ? `<span class="pc-tel" title="${esc(p.clienteTelefono)}">${icon('phone',12)}</span>` : ''}
    </div>

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
      ${p.fechaEstimada && !['cerrado','cancelado'].includes(p.estado) ? (() => {
        const diff = Math.ceil((new Date(p.fechaEstimada) - new Date()) / 86400000);
        if (diff < 0)   return `<span class="pc-fest fest-vencido">⚠ Vencido</span>`;
        if (diff === 0) return `<span class="pc-fest fest-hoy">Vence hoy</span>`;
        if (diff <= 3)  return `<span class="pc-fest fest-proximo">En ${diff}d</span>`;
        return `<span class="pc-fest fest-ok">${fmtFecha(p.fechaEstimada)}</span>`;
      })() : ''}
      <ph-icon name="caret-right" class="pc-arrow"></ph-icon>
    </div>
  </div>`;
}

// ── Sección "Para revisar" (solo admin) ───────────────────────────────────────
function renderParaRevisar(pendientes, allUsers) {
  const rows = pendientes.map(p => {
    const lider = allUsers.find(u => u.id === p.tecnicoLiderId);
    return `
    <div class="pr-row" onclick="navigate('#proyecto/${p.id}')">
      <div class="pr-info">
        <span class="pr-id">${esc(p.displayId)}</span>
        <span class="pr-cliente">${esc(p.clientName || '—')}</span>
      </div>
      <div class="pr-meta">
        ${lider ? `<span class="pr-lider">${esc(lider.nombre.split(' ')[0])}</span>` : ''}
        <span class="pr-time">${fmtRelativa(p.updatedAt || p.createdAt)}</span>
        <span class="pr-arrow">›</span>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="para-revisar-card">
    <div class="pr-header">
      <span class="pr-icon">⏳</span>
      <span class="pr-title">${pendientes.length} proyecto${pendientes.length !== 1 ? 's' : ''} esperan revisión</span>
    </div>
    ${rows}
  </div>`;
}

function calcStats(list) {
  const r = { total: list.length, en_progreso: 0, pendiente_revision: 0 };
  list.forEach(p => { if (r[p.estado] !== undefined) r[p.estado]++; });
  return r;
}

// ── También actualizar el _dashSearch para excluir cerrados ──────────────────
