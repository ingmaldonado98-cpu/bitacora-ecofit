// project.js — Vista detalle, módulos de progreso, notas rápidas, estado
// Secciones extraídas: proj-firmas.js, proj-obs.js, proj-form.js

import { projects, users } from './db.js';
import { esc, fmtFecha, fmtFechaHora, fmtRelativa, uuid, isoNow, toast,
         ESTADOS, PRIORIDADES, TIPOS_SISTEMA, confirmDialog, cambioEstadoDialog,
         calcFaseEstado, calcLevItems, calcLevPct, calcObraStatus } from './utils.js';
import { isAdmin, isLider, canTransition, canEdit, TRANSITIONS, getSession } from './auth.js';
import { icon } from './icons.js';
import { renderFirmaBlock } from './proj-firmas.js';
import { renderObservaciones } from './proj-obs.js';
import { getSerialesFlat } from './gar-paneles.js';
import './proj-form.js';   // registra window.selChip, toggleApoyo, _submitProject, etc.
import './proj-obs.js';    // registra window._showAddObs, _submitObs, _delObs, _resolverObs

// Re-exportar para que app.js y otros importadores no necesiten cambiar
export { calcFaseEstado };
export { renderFirmaBlock } from './proj-firmas.js';
export { renderProjectForm } from './proj-form.js';

// ── Vista detalle del proyecto ─────────────────────────────────────────────────
export async function renderProjectDetail(id, session) {
  const [project, allUsers] = await Promise.all([projects.getById(id), users.getAll()]);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';

  const lider = allUsers.find(u => u.id === project.tecnicoLiderId);
  const apoyo = (project.tecnicosApoyo || []).map(uid => allUsers.find(u => u.id === uid)).filter(Boolean);
  const est   = ESTADOS[project.estado] || ESTADOS.borrador;
  const prio  = PRIORIDADES[project.prioridad] || PRIORIDADES.normal;
  const tipo  = TIPOS_SISTEMA[project.tipoSistema];

  const totalPaneles = getSerialesFlat(project.garantia).length;
  const totalEquipos = project.garantia?.equipos?.length || 0;

  const transitions = Object.keys(TRANSITIONS[project.estado] || {})
    .flatMap(rol => rol === session?.rol ? TRANSITIONS[project.estado][rol] : []);
  const myTransitions = [...new Set(transitions)];

  const edit = canEdit(session, project);
  const admin = isAdmin(session);

  // ── Cálculo donut de progreso ──
  const _esPeq = project.tipoSistema === 'sistema_pequeno';
  const _dDoc  = project.documentacion || {};
  const _dGar  = project.garantia || {};
  const _dFt   = _dGar.fotosTecnicas || {};
  const levPct  = calcLevPct(_dDoc, project.tipoSistema);
  // "Obra %" = avance real por Bloque 1/2/3 (no el esquema viejo de fotos por sitio).
  const docPct  = _esPeq ? 0 : calcObraStatus(project).pct;
  const _gItems = _esPeq
    ? [!!_dGar.fotoSistema, totalEquipos>0, totalPaneles>0]
    : [!!_dGar.fotoSistema, !!(_dFt.tableroAC||_dFt.inversorEnergizado), totalEquipos>0, totalPaneles>0];
  const garPct     = Math.round(_gItems.filter(Boolean).length / _gItems.length * 100);
  const generalPct = _esPeq
    ? Math.round((levPct + garPct) / 2)
    : Math.round((levPct + docPct + garPct) / 3);
  const _circ      = 175.93;
  const _dash      = ((generalPct / 100) * _circ).toFixed(1);

  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#dashboard')">
      ${icon('caret-left')}
    </button>
    <div class="header-info">
      <span class="hdr-id">${esc(project.displayId)}</span>
      <span class="hdr-estado" style="color:${est.color}">${est.label}</span>
    </div>
    <div class="header-actions">
      ${edit ? `<button class="btn-icon-hdr" onclick="navigate('#editar-proyecto/${id}')" aria-label="Editar proyecto" title="Editar proyecto">
        ${icon('pencil')}
      </button>` : ''}
      ${admin ? `<button class="btn-icon-hdr btn-icon-danger" onclick="window._eliminarProyecto('${id}')" aria-label="Eliminar proyecto" title="Eliminar proyecto">
        ${icon('trash')}
      </button>` : ''}
    </div>
  </div>

  <!-- Info general -->
  <div class="card">
  <div class="card-with-donut">
  <div class="card-main-info">
    <div class="card-row">
      <div class="meta-item">
        <span class="meta-lbl">Cliente</span>
        <span class="meta-val">${esc(project.clientName || '—')}${project.nombreProyecto ? `<span class="meta-tag">${esc(project.nombreProyecto)}</span>` : ''}</span>
      </div>
      <div class="meta-item">
        <span class="meta-lbl">Prioridad</span>
        <span class="meta-val" style="color:${prio.color}">● ${prio.label}</span>
      </div>
    </div>
    ${project.clienteTelefono ? `
    <div class="meta-item cliente-tel-row">
      <span class="meta-lbl">${icon('phone', 12)} Contacto</span>
      <div class="cliente-tel-actions">
        <a class="btn-action-tel" href="tel:${esc(project.clienteTelefono.replace(/\D/g,''))}">
          ${icon('phone', 14)} ${esc(project.clienteTelefono)}
        </a>
        <a class="btn-action-wa" href="https://wa.me/52${esc(project.clienteTelefono.replace(/\D/g,'').replace(/^52/,''))}"
           target="_blank" rel="noopener">
          ${icon('chat-circle-dots', 14)} WhatsApp
        </a>
      </div>
    </div>` : ''}
    <div class="card-row">
      <div class="meta-item">
        <span class="meta-lbl">Tipo de sistema</span>
        <span class="meta-val">${tipo ? tipo.label : '—'}${tipo?.hint ? `<br><small style="color:var(--text-muted)">${esc(tipo.hint)}</small>` : ''}</span>
      </div>
      <div class="meta-item">
        <span class="meta-lbl">Fecha inicio</span>
        <span class="meta-val">${fmtFecha(project.fechaInicio)}</span>
      </div>
    </div>
    ${project.direccion ? `<div class="meta-item"><span class="meta-lbl">Dirección</span>
      <span class="meta-val">${esc(project.direccion)}</span></div>` : ''}
    ${project.coordenadas?.lat ? `
    <div class="meta-item coords-row">
      <span class="meta-lbl">Coordenadas GPS</span>
      <span class="meta-val">
        ${esc(Number(project.coordenadas.lat).toFixed(6))}, ${esc(Number(project.coordenadas.lng).toFixed(6))}
        <a class="btn-maps" href="https://maps.google.com/?q=${encodeURIComponent(project.coordenadas.lat)},${encodeURIComponent(project.coordenadas.lng)}"
           target="_blank" rel="noopener">
          ${icon('map-pin', 14)} Abrir en Maps
        </a>
      </span>
    </div>` : ''}
    ${project.fechaEstimada ? `
    <div class="card-row">
      <div class="meta-item">
        <span class="meta-lbl">Fecha estimada</span>
        <span class="meta-val">${fmtFecha(project.fechaEstimada)}${fechaEstimadaBadge(project.fechaEstimada, project.estado)}</span>
      </div>
    </div>` : ''}
    <div class="card-row">
      <div class="meta-item">
        <span class="meta-lbl">Técnico Líder</span>
        <span class="meta-val">${lider ? esc(lider.nombre) : '—'}</span>
      </div>
      ${apoyo.length ? `<div class="meta-item">
        <span class="meta-lbl">Apoyo</span>
        <span class="meta-val">${apoyo.map(u => esc(u.nombre)).join(', ')}</span>
      </div>` : ''}
    </div>
  </div>
  <div class="donut-wrap">
    <svg class="donut-svg" viewBox="0 0 70 70" width="70" height="70">
      <circle cx="35" cy="35" r="28" fill="none" stroke="var(--surface3)" stroke-width="7"/>
      <circle cx="35" cy="35" r="28" fill="none"
              stroke="${generalPct===100?'var(--g500)':'var(--g300)'}"
              stroke-width="7" stroke-dasharray="${_dash} ${_circ}"
              stroke-linecap="round" transform="rotate(-90 35 35)"/>
      <text x="35" y="40" text-anchor="middle" class="donut-pct-text">${generalPct}%</text>
    </svg>
    <div class="donut-subs">
      <span class="dsub">Lev <b>${levPct}%</b></span>
      ${!_esPeq ? `<span class="dsub">Obra <b>${docPct}%</b></span>` : ''}
      <span class="dsub">Gar <b>${garPct}%</b></span>
    </div>
  </div>
  </div>
  ${renderQuickCheck(project, id, admin, true)}
</div>

  <!-- Foto del cliente (solo sistemas pequeños y cuando existe la foto) -->
  ${project.tipoSistema === 'sistema_pequeno' && project.clienteFoto ? `
  <div class="card card-cliente">
    <div class="cliente-foto-wrap">
      ${fotoMiniInline(project.clienteFoto, 'Foto del cliente')}
      <span class="meta-lbl" style="margin-top:4px">Foto del cliente</span>
    </div>
  </div>` : ''}

  <!-- Recordatorios del equipo -->
  ${renderNotasRapidas(project, id, edit)}

  <!-- Módulos con progreso -->
  ${renderModulosProgreso(project, id, session, admin)}

  <!-- Cambio de estado -->
  ${myTransitions.length ? `
  <div class="card">
    <h3 class="card-title">Cambiar estado</h3>
    <div class="estado-btns">
      ${myTransitions.map(s => `
        <button class="estado-btn" style="border-color:${ESTADOS[s]?.color};color:${ESTADOS[s]?.color}"
                onclick="window._cambiarEstado('${id}','${s}')">
          ${ESTADOS[s]?.label}
        </button>`).join('')}
    </div>
    ${canTransition(session, project.estado, 'pendiente_revision') ? checklistFaltantes(project) : ''}
  </div>` : ''}

  <!-- Observaciones -->
  <div class="card">
    <div class="card-title-row">
      <h3 class="card-title">${(() => {
        const obs      = project.observaciones || [];
        const activas  = obs.filter(o => !o.resuelta).length;
        const resueltas = obs.filter(o => o.resuelta).length;
        return resueltas
          ? `Observaciones (${activas} activa${activas!==1?'s':''} · ${resueltas} resuelta${resueltas!==1?'s':''})`
          : `Observaciones (${activas})`;
      })()}</h3>
      ${edit ? `<button class="btn-sm btn-outline" onclick="window._showAddObs('${id}')">+ Añadir</button>` : ''}
    </div>
    <div id="obs-list">
      ${renderObservaciones(project.observaciones || [], session, id, edit)}
    </div>
    <div id="obs-form" style="display:none">
      <textarea id="obs-texto" rows="3" placeholder="Describe la observación…" class="textarea-field"></textarea>
      <div class="obs-form-row">
        <select id="obs-prio" class="select-field">
          <option value="normal">Normal</option>
          <option value="urgente">Urgente</option>
          <option value="critico">Crítico</option>
        </select>
        <button class="btn-primary btn-sm" onclick="window._submitObs('${id}')">Guardar</button>
        <button class="btn-outline btn-sm" onclick="document.getElementById('obs-form').style.display='none'">✕</button>
      </div>
    </div>
  </div>

  ${renderStatusLog(project.statusLog)}
  `;
}

// ── Módulos con progreso ──────────────────────────────────────────────────────
function renderModulosProgreso(project, id, session, admin) {
  const doc = project.documentacion || {};
  const gar = project.garantia || {};
  const aud = project.auditoria || {};
  const ft  = gar.fotosTecnicas || {};

  const esPequenoTipo = project.tipoSistema === 'sistema_pequeno';

  const levItems = calcLevItems(doc, project.tipoSistema);
  const levPct   = calcLevPct(doc, project.tipoSistema);

  // Progreso de obra por Bloque 1/2/3 (checklist + evidencias de cierre).
  const _obra   = esPequenoTipo ? null : calcObraStatus(project);
  const docItems = esPequenoTipo
    ? []
    : _obra.bloques.map(b => ({ label: `${b.label} (${b.done}/${b.total})`, ok: b.completo }));
  const docPct  = esPequenoTipo ? 0 : _obra.pct;

  const totalPaneles = getSerialesFlat(gar).length;
  const garItems = esPequenoTipo
    ? [
        { label: 'Foto del sistema',                    ok: !!gar.fotoSistema },
        { label: `Equipos (${gar.equipos?.length||0})`, ok: (gar.equipos?.length||0) > 0 },
        { label: `Paneles (${totalPaneles})`,           ok: totalPaneles > 0 },
      ]
    : [
        { label: 'Foto del sistema',        ok: !!gar.fotoSistema },
        { label: 'Fotos técnicas',          ok: !!(ft.tableroAC || ft.inversorEnergizado) },
        { label: `Equipos (${gar.equipos?.length||0})`, ok: (gar.equipos?.length||0) > 0 },
        { label: `Paneles (${totalPaneles})`,           ok: totalPaneles > 0 },
      ];
  const garDone = garItems.filter(i=>i.ok).length;
  const garPct  = Math.round(garDone / garItems.length * 100);

  const checkDone  = (aud.checklist?.length||0);
  const checkTotal = 11;
  const audItems = [
    { label: `Checklist (${checkDone}/${checkTotal})`, ok: checkDone >= checkTotal },
    { label: 'Resultado',                              ok: !!aud.resultado },
  ];
  const audDone = audItems.filter(i=>i.ok).length;
  const audPct  = Math.round(audDone / audItems.length * 100);

  const esPequeno      = esPequenoTipo;
  const puedeAuditoria = !esPequeno;
  const estado         = calcFaseEstado(project);
  const generalPct     = esPequeno
    ? Math.round((levPct + garPct) / 2)
    : Math.round((levPct + docPct + garPct) / 3);

  const modCard = (title, iconName, colorClass, pct, items, link, faseKey, optional = false) => {
    const locked = !admin && estado[faseKey] === 'bloqueada';
    const firmada = estado[`${faseKey}Firmada`];
    const clickHandler = locked
      ? `toast('${faseKey === 'gar' ? estado.garRequisito : estado.audRequisito}', 'warn', 4000)`
      : `navigate('${link}')`;
    return `
    <div class="mod-prog-card ${colorClass}${locked ? ' mpc-locked' : ''}" onclick="${clickHandler}">
      <div class="mpc-top">
        <div class="mpc-icon">${locked ? icon('lock-simple', 22) : icon(iconName, 22)}</div>
        <div class="mpc-info">
          <span class="mpc-title">${title}${optional ? ' <span class="mpc-opcional">Opcional</span>' : ''}${firmada ? ' <span class="mpc-firmada">✓ Firmada</span>' : ''}</span>
          <div class="mpc-chips">
            ${locked
              ? `<span class="mpc-chip mpc-locked-msg">🔒 ${esc(faseKey === 'gar' ? estado.garRequisito : estado.audRequisito)}</span>`
              : items.map(i=>`<span class="mpc-chip ${i.ok?'mpc-ok':''}">${i.ok?'✓ ':''} ${i.label}</span>`).join('')
            }
          </div>
        </div>
        <div class="mpc-right">
          ${locked ? '' : `<span class="mpc-pct ${pct===100?'mpc-pct-done':''}">${pct}%</span>`}
          ${locked ? icon('lock-simple', 16, 'mpc-arrow') : icon('caret-right', 16, 'mpc-arrow')}
        </div>
      </div>
      ${locked ? '' : `
      <div class="mpc-bar-wrap">
        <div class="mpc-bar ${pct===100?'mpc-bar-done':''}" style="width:${pct}%"></div>
      </div>`}
    </div>`;
  };

  return `
  <div class="modulos-progreso">
    ${modCard('Levantamiento', 'clipboard-text', 'mpc-lev', levPct, levItems, `#proyecto/${id}/levantamiento`, 'lev')}
    ${!esPequeno ? modCard('Progreso de obra', 'camera', 'mpc-doc', docPct, docItems, `#proyecto/${id}/documentacion`, 'doc') : ''}
    ${modCard('Garantía', 'seal-check', 'mpc-gar', garPct, garItems, `#proyecto/${id}/garantia`, 'gar')}
    ${puedeAuditoria ? modCard('Auditoría', 'magnifying-glass-plus', 'mpc-aud', audPct, audItems, `#proyecto/${id}/auditoria`, 'aud', true) : ''}
  </div>

  <!-- Herramientas secundarias -->
  <div class="tools-row">
    <button class="tool-btn" onclick="navigate('#proyecto/${id}/trayecto')">
      ${icon('list-numbers', 18)}<span>Trayecto</span>
    </button>
    <!-- Trayectorias se documenta ahora dentro de Progreso de obra → Fase 2 (Ruteo);
         la ruta standalone (#proyecto/{id}/trayectorias) sigue activa por si hay
         links/QR antiguos que apunten ahí, solo se quitó el acceso directo de aquí. -->
    <button class="tool-btn" onclick="navigate('#calculadora/${id}')">
      ${icon('calculator', 18)}<span>Calculadora</span>
    </button>
    <button class="tool-btn" onclick="navigate('#checklist/${id}')">
      ${icon('check-square', 18)}<span>Checklist</span>
    </button>
    <button class="tool-btn" onclick="navigate('#dimensionamiento/${id}')">
      ${icon('chart-line-up', 18)}<span>Dimensionamiento</span>
    </button>
    <button class="tool-btn" onclick="navigate('#proyecto/${id}/qr')">
      ${icon('qr-code', 18)}<span>QR Cliente</span>
    </button>
    ${isLider(session) ? `<button class="tool-btn" onclick="navigate('#proyecto/${id}/pdf')">
      ${icon('file-arrow-down', 18)}<span>Exportar PDF</span>
    </button>` : ''}
  </div>

  <!-- Historial de cambios -->
  ${renderChangeLog(project.changeLog)}`;
}

// ── Quick-Check: pendientes críticos ─────────────────────────────────────────
function renderQuickCheck(project, id, admin, inline = false) {
  const doc = project.documentacion || {};
  const gar = project.garantia || {};
  const aud = project.auditoria || {};
  const ft  = gar.fotosTecnicas || {};
  const esPequeno = project.tipoSistema === 'sistema_pequeno';
  const estado = calcFaseEstado(project);

  const totalPaneles = getSerialesFlat(gar).length;

  const levItems = [ { label: 'Levantamiento (tipo de techo)', desc: 'Registra tipo de techo, temperatura, orientación y áreas del techo.', ok: !!(doc.levantamiento?.tipTecho || doc.levantamiento?.areasTecho?.length) } ];
  // Pendientes de obra por Bloque 1/2/3 (no el esquema viejo de fotos por sitio).
  const docItems = esPequeno
    ? []
    : calcObraStatus(project).bloques
        .filter(b => b.total > 0)
        .map(b => ({ label: `${b.label} (${b.done}/${b.total})`, desc: b.desc, tab: `d-bloque${b.bloque}`, ok: b.completo }));
  const garItems = esPequeno
    ? [
        { label: 'Foto del sistema',                     desc: 'Foto general del sistema terminado, para la garantía.', ok: !!gar.fotoSistema },
        { label: `Equipos (${gar.equipos?.length||0})`,  desc: 'Números de serie de inversor, protecciones y otros equipos.', ok: (gar.equipos?.length||0) > 0 },
        { label: `Paneles (${totalPaneles})`,            desc: 'Números de serie de cada panel registrado.', ok: totalPaneles > 0 },
      ]
    : [
        { label: 'Foto del sistema',                     desc: 'Foto general del sistema terminado, para la garantía.', ok: !!gar.fotoSistema },
        { label: 'Fotos técnicas',                       desc: 'Tablero AC, tablero DC o inversor energizado.', ok: !!(ft.tableroAC || ft.inversorEnergizado) },
        { label: `Equipos (${gar.equipos?.length||0})`,  desc: 'Números de serie de inversor, protecciones y otros equipos.', ok: (gar.equipos?.length||0) > 0 },
        { label: `Paneles (${totalPaneles})`,            desc: 'Números de serie de cada panel registrado.', ok: totalPaneles > 0 },
      ];

  const docLocked = estado.doc === 'bloqueada';
  const garLocked = estado.gar === 'bloqueada';

  const pendientes = [
    ...levItems.filter(i => !i.ok).map(i => ({ ...i, mod: 'lev', link: `#proyecto/${id}/levantamiento`, modLabel: 'Lev' })),
    ...(!docLocked ? docItems.filter(i => !i.ok).map(i => ({ ...i, mod: 'doc', link: `#proyecto/${id}/documentacion`, modLabel: 'Obra' })) : []),
    ...(!garLocked ? garItems.filter(i => !i.ok).map(i => ({ ...i, mod: 'gar', link: `#proyecto/${id}/garantia`,      modLabel: 'Garantía' })) : []),
  ];

  if (!pendientes.length) return '';

  const modColor = { lev: '#3b82f6', doc: 'var(--accent)', gar: '#f0c000', aud: '#86868b' };

  const header = `<div class="card-title-row">
      <h3 class="card-title">${icon('warning-circle', 15)} Pendientes <span class="qc-count">${pendientes.length}</span></h3>
    </div>`;
  const body = `<div class="qc-list">
      ${pendientes.map(p => `
      <div class="qc-item" onclick="${p.tab ? `sessionStorage.setItem('doc-tab-target','${p.tab}');` : ''}navigate('${p.link}')">
        <span class="qc-mod-dot" style="background:${modColor[p.mod]}"></span>
        <div class="qc-info">
          <span class="qc-label">${esc(p.label)}</span>
          ${p.desc ? `<span class="qc-desc">${esc(p.desc)}</span>` : ''}
        </div>
        <span class="qc-mod-tag" style="color:${modColor[p.mod]}">${esc(p.modLabel)}</span>
        ${icon('caret-right', 14, 'qc-arrow')}
      </div>`).join('')}
    </div>
    <button class="qc-trayecto-cta" onclick="navigate('#proyecto/${id}/trayecto')">
      ${icon('list-numbers', 16)} Resolver con el trayecto guiado ${icon('arrow-right', 14)}
    </button>`;

  if (inline) return `<div class="qc-inline">${header}${body}</div>`;

  return `
  <div class="card qc-card">
    ${header}
    ${body}
  </div>`;
}

// ── Notas rápidas / Recordatorios ────────────────────────────────────────────
function renderNotasRapidas(project, id, edit) {
  const notas = project.notasRapidas || [];
  if (!notas.length && !edit) return '';
  return `
  <div class="card notas-card">
    <div class="card-title-row">
      <h3 class="card-title">${icon('pencil', 15)} Recordatorios${notas.length ? ` <span class="notas-badge">${notas.length}</span>` : ''}</h3>
    </div>
    ${notas.length ? `
    <div class="notas-list">
      ${notas.map((n, i) => `
      <div class="nota-item">
        <span class="nota-texto">${esc(n.texto)}</span>
        <div class="nota-meta">
          <span class="nota-fecha">${fmtRelativa(n.creadaAt)}</span>
          ${edit ? `<button class="nota-done-btn" onclick="window._doneNota('${id}',${i})" title="Marcar como hecha">✓ Hecho</button>` : ''}
        </div>
      </div>`).join('')}
    </div>` : `<p class="notas-empty">Sin recordatorios activos</p>`}
    ${(project.notasHistorial?.length) ? `
    <details class="notas-hist-wrap">
      <summary class="notas-hist-toggle">Historial (${project.notasHistorial.length})</summary>
      <div class="notas-list notas-hist">
        ${project.notasHistorial.slice().reverse().map(n => `
        <div class="nota-item nota-item-done">
          <span class="nota-texto nota-texto-done">${esc(n.texto)}</span>
          <div class="nota-meta">
            <span class="nota-fecha">Hecho ${fmtRelativa(n.hechoAt)}${n.hechoPor ? ` · ${esc(n.hechoPor)}` : ''}</span>
            <button class="nota-del-hist-btn" onclick="window._deleteNotaHist('${id}','${esc(n.id)}')" title="Eliminar del historial">✕</button>
          </div>
        </div>`).join('')}
      </div>
    </details>` : ''}
    ${edit ? `
    <div class="nota-add-row">
      <input type="text" id="nota-input-${id}" class="input-field nota-input"
             placeholder="Ej: Faltó cable de comunicación…"
             onkeydown="if(event.key==='Enter')window._addNota('${id}')"/>
      <button class="btn-primary btn-sm" onclick="window._addNota('${id}')">+ Agregar</button>
    </div>` : ''}
  </div>`;
}

window._addNota = async function(pid) {
  const input = document.getElementById(`nota-input-${pid}`);
  const texto = input?.value?.trim();
  if (!texto) { toast('Escribe un recordatorio primero', 'warn'); return; }
  const project = await projects.getById(pid);
  const notas = [...(project.notasRapidas || []), { id: uuid(), texto, creadaAt: isoNow() }];
  await projects.setField(pid, 'notasRapidas', notas);
  navigate(`#proyecto/${pid}`);
};

window._deleteNotaHist = async function(pid, notaId) {
  const project = await projects.getById(pid);
  const historial = (project.notasHistorial || []).filter(n => n.id !== notaId);
  await projects.setField(pid, 'notasHistorial', historial);
  navigate(`#proyecto/${pid}`);
};

window._doneNota = async function(pid, idx) {
  const session = await import('./auth.js').then(m => m.getSession());
  const project = await projects.getById(pid);
  const nota    = (project.notasRapidas || [])[idx];
  if (!nota) return;
  const notas    = (project.notasRapidas || []).filter((_, i) => i !== idx);
  const historial = [...(project.notasHistorial || []), {
    ...nota, hechoAt: new Date().toISOString(), hechoPor: session?.nombre || session?.username || null,
  }];
  await Promise.all([
    projects.setField(pid, 'notasRapidas',   notas),
    projects.setField(pid, 'notasHistorial', historial),
  ]);
  navigate(`#proyecto/${pid}`);
};

// ── Historial de cambios ──────────────────────────────────────────────────────
function renderChangeLog(log) {
  if (!Array.isArray(log) || !log.length) return '';
  const entries = log.slice(0, 10);
  return `
  <div class="card changelog-card">
    <div class="card-title-row">
      <h3 class="card-title">${icon('clock-counter-clockwise', 16)} Historial reciente</h3>
    </div>
    <div class="changelog-list">
      ${entries.map(e => `
      <div class="changelog-entry">
        <span class="changelog-who">${esc(e.nombre)}</span>
        <span class="changelog-what">${esc(e.modulo)} — ${esc(e.accion)}${e.detalle ? ': ' + esc(e.detalle) : ''}</span>
        <span class="changelog-when">${fmtRelativa(e.ts)}</span>
      </div>`).join('')}
    </div>
  </div>`;
}

// ── Badge fecha estimada ──────────────────────────────────────────────────────
function fechaEstimadaBadge(fechaIso, estado) {
  if (!fechaIso || ['cerrado','cancelado'].includes(estado)) return '';
  const diff = Math.ceil((new Date(fechaIso) - new Date()) / 86400000);
  if (diff < 0)  return ` <span class="fest-badge fest-vencido">Vencido hace ${Math.abs(diff)} día${Math.abs(diff)!==1?'s':''}</span>`;
  if (diff === 0) return ` <span class="fest-badge fest-hoy">Vence hoy</span>`;
  if (diff <= 3)  return ` <span class="fest-badge fest-proximo">En ${diff} día${diff!==1?'s':''}</span>`;
  return '';
}

// ── Historial de cambios de estado ────────────────────────────────────────────
function renderStatusLog(log) {
  if (!log?.length) return '';
  const entries = [...log].reverse();
  return `
  <div class="card">
    <h3 class="card-title">Historial de cambios</h3>
    <div class="status-log">
      ${entries.map(e => {
        const fromEst = ESTADOS[e.from];
        const toEst   = ESTADOS[e.to];
        return `
        <div class="slog-entry">
          <div class="slog-estados">
            <span class="slog-badge" style="background:${fromEst?.color}20;color:${fromEst?.color}">${fromEst?.label || e.from}</span>
            <span class="slog-arrow">→</span>
            <span class="slog-badge" style="background:${toEst?.color}20;color:${toEst?.color}">${toEst?.label || e.to}</span>
          </div>
          <div class="slog-meta">
            <span class="slog-by">${esc(e.by)}</span>
            <span class="slog-at">${fmtRelativa(e.at)}</span>
          </div>
          ${e.nota ? `<p class="slog-nota">${esc(e.nota)}</p>` : ''}
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ── Validación requisitos para revisión ───────────────────────────────────────
function _getFaltantes(project) {
  const faltantes = [];
  const esPequeno = project.tipoSistema === 'sistema_pequeno';
  if (!project.garantia?.fotoSistema) faltantes.push('Foto general del sistema');
  const totalPaneles = getSerialesFlat(project.garantia).length;
  if (totalPaneles === 0) faltantes.push('Al menos un panel registrado con número de serie');
  if (!esPequeno) {
    // Progreso de obra: exigir que los 3 bloques estén completos (checklist +
    // evidencias de cierre obligatorias) — esquema nuevo, no las fotos por sitio.
    const obra = calcObraStatus(project);
    obra.bloques.filter(b => b.total > 0 && !b.completo)
      .forEach(b => faltantes.push(`${b.label} de obra incompleto`));
    if (!project.garantia?.fotosTecnicas?.tableroAC) faltantes.push('Foto del tablero AC terminado');
    if (!project.garantia?.fotosTecnicas?.inversorEnergizado) faltantes.push('Foto del inversor energizado');
  }
  return faltantes;
}

function checklistFaltantes(project) {
  const faltantes = _getFaltantes(project);
  if (!faltantes.length) return '';
  return `<div class="faltantes-list">
    <p class="falt-title">${icon('warning')} Pendiente para enviar a revisión:</p>
    ${faltantes.map(f => `<div class="falt-item">${icon('x-circle', 20, 'falt-x')} ${esc(f)}</div>`).join('')}
  </div>`;
}

// ── Helper inline para foto de cliente (evita importar fotoMini de utils con getPendingSrc) ─
function fotoMiniInline(src, alt) {
  if (!src) return '';
  return `<img src="${esc(src)}" class="foto-mini" alt="${esc(alt)}" loading="lazy" />`;
}

// ── Eliminar proyecto ─────────────────────────────────────────────────────────
window._eliminarProyecto = async function(id) {
  const project = await projects.getById(id);
  if (!await confirmDialog(`¿Eliminar el proyecto "${project?.displayId} — ${project?.clientName}"?\n\nEsta acción es irreversible.`)) return;
  await projects.delete(id);
  toast('Proyecto eliminado');
  navigate('#dashboard');
};

// ── Cambiar estado ────────────────────────────────────────────────────────────
window._cambiarEstado = async function(id, nuevoEstado) {
  if (!navigator.onLine) {
    const ok = await confirmDialog(
      '⚠ Sin conexión a internet\n\n' +
      'El cambio de estado se guardará localmente y se sincronizará automáticamente cuando haya conexión.\n\n' +
      '¿Continuar?'
    );
    if (!ok) return;
  }

  if (nuevoEstado === 'pendiente_revision') {
    const project = await projects.getById(id);
    const faltantes = _getFaltantes(project);
    if (faltantes.length) {
      const msg = `Faltan datos requeridos para enviar a revisión:\n\n${faltantes.map(f => `• ${f}`).join('\n')}\n\n¿Continuar de todas formas?`;
      if (!await confirmDialog(msg)) return;
    }
  }

  const notaRequerida = ['observado', 'cancelado'].includes(nuevoEstado);
  const result = await cambioEstadoDialog(ESTADOS[nuevoEstado]?.label || nuevoEstado, notaRequerida);
  if (!result) return;

  const [session, project] = await Promise.all([getSession(), projects.getById(id)]);

  const logEntry = {
    id: uuid(),
    from: project.estado,
    to: nuevoEstado,
    by: session?.nombre || 'Sistema',
    byId: session?.uid || session?.id || '',
    at: isoNow(),
    nota: result.nota || null,
  };

  const changes = {
    estado: nuevoEstado,
    statusLog: [...(project.statusLog || []), logEntry],
  };
  if (nuevoEstado === 'en_progreso' && !project.fechaInicio) changes.fechaInicio = isoNow();
  if (nuevoEstado === 'cerrado') changes.fechaCierre = isoNow();

  await projects.update(id, changes);
  toast(`Estado → ${ESTADOS[nuevoEstado]?.label}`);
  navigate(`#proyecto/${id}`);
};
