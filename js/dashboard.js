// dashboard.js — Lista de proyectos y estadísticas

import { projects, users } from './db.js';
import { esc, fmtFecha, fmtRelativa, fmtProjectId, ESTADOS, PRIORIDADES, TIPOS_SISTEMA, syncBadge, getPendingSrc, calcFaseEstado } from './utils.js';
import { isAdmin, isLider } from './auth.js';
import { icon } from './icons.js';

const _ARCHIVADOS = ['cerrado', 'cancelado', 'fuera_garantia'];

// ── Helper: opciones de mes para el filtro de fecha ──────────────────────────
function _buildMonthOptions(proyectos) {
  const meses = new Map();
  for (const p of proyectos) {
    const d = p.fechaInicio || p.createdAt;
    if (!d) continue;
    const key  = d.slice(0, 7);              // 'YYYY-MM'
    if (!meses.has(key)) {
      const dt = new Date(key + '-01');
      const lbl = dt.toLocaleDateString('es-MX', { year:'numeric', month:'long' });
      meses.set(key, lbl.charAt(0).toUpperCase() + lbl.slice(1));
    }
  }
  return [...meses.entries()].sort((a,b) => b[0].localeCompare(a[0]))
    .map(([k,lbl]) => `<option value="${k}">${lbl}</option>`).join('');
}

// ── Badge del nav ─────────────────────────────────────────────────────────────
export function updateNavBadge(count) {
  const badge = document.getElementById('nav-badge-revision');
  if (!badge) return;
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.style.display = count > 0 ? '' : 'none';
}

// ── Render dashboard completo ──────────────────────────────────────────────────
// FIX-8: Acepta datos pre-cargados desde app.js para evitar doble lectura Firestore.
// Firma: renderDashboard(session, all, allUsers)
export async function renderDashboard(session, all, allUsers) {
  _tecnicoFilter = null;
  _page = 0;
  // Si app.js no pasó los datos, cargamos aquí como fallback
  if (!all || !allUsers) {
    [all, allUsers] = await Promise.all([projects.getAll(), users.getAll()]);
  }

  // Proyectos activos = todo excepto archivados
  const activos = all.filter(p => !_ARCHIVADOS.includes(p.estado));
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
      ${Object.entries(TIPOS_SISTEMA).filter(([,v]) => !v.legacy).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
    </select>
    <select id="dash-filter-tecnico" class="filter-select" onchange="window._dashFilter()">
      <option value="">Todos los técnicos</option>
    </select>
    <select id="dash-filter-mes" class="filter-select" onchange="window._dashFilter()" title="Filtrar por mes de inicio">
      <option value="">Cualquier fecha</option>
      ${_buildMonthOptions(all)}
    </select>
    <button class="dash-toggle-conc" id="btn-toggle-conc" onclick="window._toggleConcluidos()"
            title="Ver proyectos cerrados y cancelados">
      ${icon('seal-check', 16)} Concluidos
    </button>
  </div>

  <div id="projects-list">
    ${renderProjectList(activos)}
  </div>

  ${isLider(session) ? `
  <button class="fab" onclick="navigate('#nuevo-proyecto')" title="Nuevo proyecto">
    ${icon('plus', 28)}
  </button>` : ''}
  `;
}

// ── Carga de trabajo por técnico (solo admin) ─────────────────────────────────
// renderWorkload eliminada — barra de carga de técnicos removida del dashboard

// ── Filtros interactivos ───────────────────────────────────────────────────────
let _allProjects = [];
let _allUsers    = [];   // cache de usuarios para el filtro de técnico

let _showConcluidos = false;

export function initDashboardFilters(all, allUsers = []) {
  _showConcluidos = false;
  _allProjects = all.filter(p => !_ARCHIVADOS.includes(p.estado));
  _allUsers    = allUsers;
  // populateTecnicoFilter() se llama desde app.js después de render (cuando el DOM existe)
}

export function populateTecnicoFilter(allUsers) {
  const sel = document.getElementById('dash-filter-tecnico');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Todos los técnicos</option>' +
    (allUsers || _allUsers)
      .filter(u => u.activo && ['lider','admin'].includes(u.rol))
      .sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''))
      .map(u => `<option value="${u.id}" ${u.id===prev?'selected':''}>${esc(u.nombre)}</option>`)
      .join('');
}

window._toggleConcluidos = async function() {
  _showConcluidos = !_showConcluidos;
  const btn = document.getElementById('btn-toggle-conc');
  if (btn) btn.classList.toggle('dash-toggle-conc-active', _showConcluidos);
  const all = await projects.getAll();
  _allProjects = _showConcluidos
    ? all.filter(p => ['cerrado', 'cancelado'].includes(p.estado))
    : all.filter(p => !['cerrado', 'cancelado'].includes(p.estado));
  _page = 0;
  applyFilters();
};

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
    _allProjects = all.filter(p => !_ARCHIVADOS.includes(p.estado));
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
  const estado   = document.getElementById('dash-filter-estado')?.value;
  const tipo     = document.getElementById('dash-filter-tipo')?.value;
  const tecnico  = document.getElementById('dash-filter-tecnico')?.value || _tecnicoFilter;
  const mes      = document.getElementById('dash-filter-mes')?.value;
  let list = _allProjects;
  if (estado)  list = list.filter(p => p.estado === estado);
  if (tipo)    list = list.filter(p => p.tipoSistema === tipo);
  if (tecnico) list = list.filter(p =>
    p.tecnicoLiderId === tecnico ||
    (p.tecnicosApoyo || []).includes(tecnico)
  );
  if (mes) list = list.filter(p => {
    const d = p.fechaInicio || p.createdAt;
    return d && d.startsWith(mes);
  });
  const el = document.getElementById('projects-list');
  if (el) el.innerHTML = renderProjectList(list);
}

// ── Progreso por proyecto (puro JS, sin reads Firestore) ──────────────────────
function _calcProgress(p) {
  const e = calcFaseEstado(p);
  const { docPct, garPct, audPct } = e;
  const base = audPct !== null ? 300 : 200;
  const sum  = docPct + garPct + (audPct ?? 0);
  const pct  = Math.round(sum / base * 100);
  return { pct, docPct, garPct, audPct, garEstado: e.gar, audEstado: e.aud };
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
  const est   = ESTADOS[p.estado] || ESTADOS.borrador;
  const prio  = PRIORIDADES[p.prioridad] || PRIORIDADES.normal;
  const tipo  = TIPOS_SISTEMA[p.tipoSistema];
  const prog  = _calcProgress(p);
  const lastObs = p.observaciones?.slice(-1)[0];

  const barColor = prog.pct < 33 ? 'var(--text-muted)'
                 : prog.pct < 67 ? 'var(--solar)'
                 : prog.pct < 100 ? 'var(--g300)' : 'var(--accent)';

  const faseDoc = prog.docPct === 100 ? 'Doc ✓' : `Doc ${prog.docPct}%`;
  const faseGar = prog.garEstado === 'bloqueada' ? 'Gar —'
                : prog.garPct === 100 ? 'Gar ✓' : `Gar ${prog.garPct}%`;
  const faseAud = prog.audPct === null ? null
                : prog.audEstado === 'bloqueada' ? 'Aud —'
                : prog.audPct === 100 ? 'Aud ✓' : `Aud ${prog.audPct}%`;
  const faseChips = [faseDoc, faseGar, faseAud].filter(Boolean).join(' · ');

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
      ${p.nombreProyecto ? `<span class="meta-tag">${esc(p.nombreProyecto)}</span>` : ''}
      ${p.clienteTelefono ? `<span class="pc-tel" title="${esc(p.clienteTelefono)}">${icon('phone',12)}</span>` : ''}
    </div>

    ${prog.pct < 100 ? `
    <div class="pc-prog-wrap">
      <div class="pc-prog-bar" style="width:${prog.pct}%;background:${barColor}"></div>
      <span class="pc-prog-pct" style="color:${barColor}">${prog.pct}%</span>
    </div>
    <div class="pc-fase-chips">${esc(faseChips)}</div>` : ''}

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
  <div class="para-revisar-card para-revisar-alert">
    <div class="pr-header">
      ${icon('warning-circle', 18, 'pr-alert-icon')}
      <span class="pr-title">Acción requerida — ${pendientes.length} proyecto${pendientes.length !== 1 ? 's' : ''} esperan revisión</span>
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
