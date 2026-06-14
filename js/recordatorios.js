// recordatorios.js — Vista consolidada de alertas y recordatorios

import { projects, reminders } from './db.js';
import { esc, fmtRelativa, ESTADOS } from './utils.js';

const _ARCH = ['cerrado', 'cancelado', 'fuera_garantia'];

function _dias(isoStr) {
  if (!isoStr) return null;
  return Math.ceil((new Date(isoStr) - new Date()) / 86400000);
}

function _vencProximos(fechaInstStr, umbral = 90) {
  if (!fechaInstStr) return [];
  const fi = new Date(fechaInstStr);
  return [
    { label: 'Mano de obra',      años: 1  },
    { label: 'Paneles (calidad)', años: 10 },
    { label: 'Inversor',          años: 10 },
    { label: 'Estructura',        años: 10 },
  ].map(g => {
    const v = new Date(fi);
    v.setFullYear(v.getFullYear() + g.años);
    return { label: g.label, dias: Math.ceil((v - new Date()) / 86400000) };
  }).filter(g => g.dias <= umbral);
}

function _row(p, detalle, cls = '') {
  const est = ESTADOS[p.estado] || ESTADOS.borrador;
  return `
  <div class="recor-row" onclick="navigate('#proyecto/${p.id}')">
    <div class="recor-info">
      <span class="recor-id">${esc(p.displayId)}</span>
      <span class="recor-cliente">${esc(p.clientName || '—')}</span>
      <span class="recor-det ${cls}">${detalle}</span>
    </div>
    <div class="recor-right">
      <span class="recor-estado" style="background:${est.color}22;color:${est.color}">${est.label}</span>
      <span class="recor-arrow">›</span>
    </div>
  </div>`;
}

function _section(titulo, rows) {
  if (!rows.length) return '';
  return `
  <div class="recor-section">
    <div class="recor-hdr">
      <span class="recor-hdr-title">${titulo}</span>
      <span class="recor-hdr-count">${rows.length}</span>
    </div>
    ${rows.join('')}
  </div>`;
}

// Calcula el total urgente sin cargar la vista (usado desde dashboard)
export async function calcRecordatoriosCount(all) {
  const activos = all.filter(p => !_ARCH.includes(p.estado));
  let n = 0;
  n += activos.filter(p => p.fechaEstimada && (_dias(p.fechaEstimada) ?? 999) <= 7).length;
  n += activos.filter(p => p.estado === 'pendiente_revision').length;
  n += activos.filter(p => _vencProximos(p.garantia?.fechaInstalacion, 90).length > 0).length;
  n += activos.reduce((s, p) => s + (p.notasRapidas?.length || 0), 0);
  try {
    const qrems = await reminders.getAll();
    n += qrems.filter(r => !r.completado).length;
  } catch { /* silencioso */ }
  return n;
}

function _qremRow(r, completado = false) {
  const dias = r.fecha ? Math.ceil((new Date(r.fecha + 'T00:00:00') - new Date()) / 86400000) : null;
  const fechaTxt = dias === null ? ''
    : dias < 0  ? `<span class="qrem-fecha">Venció hace ${Math.abs(dias)}d</span>`
    : dias === 0 ? `<span class="qrem-fecha">Vence hoy</span>`
    :              `<span class="qrem-fecha">Para el ${r.fecha}</span>`;
  if (completado) {
    const cuandoTxt = r.completadoAt ? fmtRelativa(r.completadoAt) : '';
    const porTxt    = r.completadoPor ? ` · ${esc(r.completadoPor)}` : '';
    return `
    <div class="qrem-row qrem-done" id="qrem-hist-${esc(r.id)}">
      <div class="qrem-body">
        <div class="qrem-texto qrem-texto-done">${esc(r.texto)}</div>
        <div class="qrem-meta">Hecho ${cuandoTxt}${porTxt}</div>
      </div>
      <button class="qrem-del" onclick="window._reminderDelete('${esc(r.id)}')" title="Eliminar del historial">
        <svg width="13" height="13" viewBox="0 0 256 256" fill="currentColor"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"/></svg>
      </button>
    </div>`;
  }
  return `
  <div class="qrem-row" id="qrem-${esc(r.id)}">
    <div class="qrem-body">
      <div class="qrem-texto">${esc(r.texto)}</div>
      <div class="qrem-meta">${fechaTxt}${fechaTxt && r.createdByName ? ' · ' : ''}${esc(r.createdByName || '')}</div>
    </div>
    <div class="qrem-actions">
      <button class="qrem-edit" onclick="window._reminderEdit('${esc(r.id)}','${esc(r.texto).replace(/'/g,'&#39;')}','${esc(r.fecha||'')}')" title="Editar recordatorio">
        <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z"/></svg>
      </button>
      <button class="qrem-check" onclick="window._reminderComplete('${esc(r.id)}')" title="Marcar como hecho">
        <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>
      </button>
    </div>
  </div>`;
}

export async function renderRecordatorios(session) {
  const [all, allRems] = await Promise.all([projects.getAll(), reminders.getAll()]);
  const activos = all.filter(p => !_ARCH.includes(p.estado));
  const qrems      = allRems.filter(r => !r.completado);
  const historial  = allRems.filter(r =>  r.completado).sort((a,b) => new Date(b.completadoAt) - new Date(a.completadoAt));

  // 1. Plazos próximos o vencidos (≤ 7 días)
  const plazos = activos
    .filter(p => p.fechaEstimada)
    .map(p => ({ p, d: _dias(p.fechaEstimada) }))
    .filter(({ d }) => d !== null && d <= 7)
    .sort((a, b) => a.d - b.d);

  // 2. Pendientes de revisión
  const pendientes = activos
    .filter(p => p.estado === 'pendiente_revision')
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  // 3. Garantías próximas a vencer
  const garantias = [];
  for (const p of activos) {
    const venc = _vencProximos(p.garantia?.fechaInstalacion, 90);
    for (const v of venc) garantias.push({ p, v });
  }
  garantias.sort((a, b) => a.v.dias - b.v.dias);

  // 4. Notas de proyectos (notasRapidas)
  const notasProyecto = [];
  for (const p of activos) {
    for (const n of (p.notasRapidas || [])) notasProyecto.push({ p, n });
  }

  // 5. Sin actividad reciente (> 30 días) — informativo
  const inactivos = activos
    .map(p => ({ p, d: -(_dias(p.updatedAt || p.createdAt) ?? 0) }))
    .filter(({ d }) => d > 30)
    .sort((a, b) => b.d - a.d);

  const urgente = plazos.length + pendientes.length + garantias.length + qrems.length + notasProyecto.length;
  updateRecordatoriosBadge(urgente);

  // Build rows
  const rowsPlazos = plazos.map(({ p, d }) => {
    const txt = d < 0  ? `Venció hace ${Math.abs(d)} día${Math.abs(d) !== 1 ? 's' : ''}`
              : d === 0 ? 'Vence hoy'
              :            `Vence en ${d} día${d !== 1 ? 's' : ''}`;
    return _row(p, txt, d <= 0 ? 'rd' : d <= 3 ? 'rw' : 'ro');
  });

  const rowsPendientes = pendientes.map(p =>
    _row(p, `Esperando revisión · ${fmtRelativa(p.updatedAt || p.createdAt)}`, 'rw')
  );

  const rowsGarantias = garantias.map(({ p, v }) => {
    const txt = v.dias < 0
      ? `${v.label}: expiró hace ${Math.abs(v.dias)}d`
      : `${v.label}: vence en ${v.dias}d`;
    return _row(p, txt, v.dias < 0 ? 'rd' : 'rw');
  });

  const rowsNotas = notasProyecto.map(({ p, n }) =>
    _row(p, `📝 ${esc(n.texto)}`, 'rw')
  );

  const rowsInactivos = inactivos.map(({ p, d }) =>
    _row(p, `Sin actividad: ${d} días`, 'rm')
  );

  const sinAlertas = urgente === 0 && !inactivos.length && !historial.length;

  return `
  <div class="view-header">
    <div class="header-info" style="flex:1">
      <span class="view-title">Alertas</span>
    </div>
    <button class="btn-icon-hdr" onclick="window._openReminderModal()" title="Nuevo recordatorio">
      <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
        <path d="M221.8,175.94C216.25,166.38,208,139.35,208,104a80,80,0,1,0-160,0c0,35.35-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.63-16h45.26A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80ZM160,104a8,8,0,0,1-8,8H136v16a8,8,0,0,1-16,0V112H104a8,8,0,0,1,0-16h16V80a8,8,0,0,1,16,0V96h16A8,8,0,0,1,160,104Z"/>
      </svg>
    </button>
  </div>

  ${qrems.length ? `
  <div class="recor-section" id="qrem-section">
    <div class="recor-hdr">
      <span class="recor-hdr-title">Notas rápidas</span>
      <span class="recor-hdr-count">${qrems.length}</span>
    </div>
    ${qrems.map(r => _qremRow(r, false)).join('')}
  </div>` : ''}

  ${sinAlertas ? `
  <div class="recor-all-ok">
    <svg width="48" height="48" viewBox="0 0 256 256" fill="currentColor" style="color:var(--g400)">
      <path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/>
    </svg>
    <p>Todo al dia — sin alertas pendientes</p>
  </div>` : ''}

  ${_section('Plazos proximos o vencidos', rowsPlazos)}
  ${_section('Pendientes de revision', rowsPendientes)}
  ${_section('Garantias por vencer (90 dias)', rowsGarantias)}
  ${notasProyecto.length ? `
  <div class="recor-section">
    <div class="recor-hdr">
      <span class="recor-hdr-title">Notas de proyectos</span>
      <span class="recor-hdr-count">${notasProyecto.length}</span>
    </div>
    ${rowsNotas.join('')}
  </div>` : ''}
  ${_section('Sin actividad reciente', rowsInactivos)}

  ${historial.length ? `
  <div class="recor-section" id="qrem-hist-section">
    <details>
      <summary class="recor-hdr" style="list-style:none;cursor:pointer">
        <span class="recor-hdr-title" style="color:var(--text-muted)">Historial completados</span>
        <span class="recor-hdr-count" style="opacity:.6">${historial.length}</span>
      </summary>
      ${historial.map(r => _qremRow(r, true)).join('')}
    </details>
  </div>` : ''}
  `;
}

export function updateRecordatoriosBadge(count) {
  const badge = document.getElementById('nav-badge-recor');
  if (!badge) return;
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.style.display = count > 0 ? '' : 'none';
}
