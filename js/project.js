// project.js — Creación, detalle y gestión del proyecto

import { projects, users, kv, logChange } from './db.js';
import { esc, fmtFecha, fmtFechaHora, fmtRelativa, fmtProjectId, genDisplayId, uuid, isoNow, toast,
         ESTADOS, PRIORIDADES, TIPOS_SISTEMA, confirmDialog, cambioEstadoDialog, inputDialog,
         capturePhoto, fotoMini, getPendingSrc } from './utils.js';
import { isAdmin, isLider, canTransition, canEdit, TRANSITIONS, getSession } from './auth.js';
import { icon } from './icons.js';
import { uploadPhotoQueued } from './firebase.js';

// Foto de cliente pendiente de subir en el form actual
let _clienteFotoB64 = null;
let _clienteFotoUrl = null;

// ── Vista detalle del proyecto ─────────────────────────────────────────────────
export async function renderProjectDetail(id, session) {
  const [project, allUsers] = await Promise.all([projects.getById(id), users.getAll()]);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';

  const lider = allUsers.find(u => u.id === project.tecnicoLiderId);
  const apoyo = (project.tecnicosApoyo || []).map(uid => allUsers.find(u => u.id === uid)).filter(Boolean);
  const est   = ESTADOS[project.estado] || ESTADOS.borrador;
  const prio  = PRIORIDADES[project.prioridad] || PRIORIDADES.normal;
  const tipo  = TIPOS_SISTEMA[project.tipoSistema];

  const totalPaneles = (project.garantia?.paneles?.strings || [])
    .reduce((s, str) => s + (str.paneles?.length || 0), 0);
  const totalEquipos = project.garantia?.equipos?.length || 0;

  const transitions = Object.keys(TRANSITIONS[project.estado] || {})
    .flatMap(rol => rol === session?.rol ? TRANSITIONS[project.estado][rol] : []);
  const myTransitions = [...new Set(transitions)];

  const edit = canEdit(session, project);
  const admin = isAdmin(session);

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
      ${edit ? `<button class="btn-icon-hdr" onclick="navigate('#editar-proyecto/${id}')">
        ${icon('pencil')}
      </button>` : ''}
      ${admin ? `<button class="btn-icon-hdr btn-icon-danger" onclick="window._eliminarProyecto('${id}')" title="Eliminar proyecto">
        ${icon('trash')}
      </button>` : ''}
    </div>
  </div>

  <!-- Info general -->
  <div class="card">
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

  <!-- Foto del cliente (solo sistemas pequeños y cuando existe la foto) -->
  ${project.tipoSistema === 'sistema_pequeno' && project.clienteFoto ? `
  <div class="card card-cliente">
    <div class="cliente-foto-wrap">
      ${fotoMini(getPendingSrc({url: project.clienteFoto}) || project.clienteFoto, 'Foto del cliente')}
      <span class="meta-lbl" style="margin-top:4px">Foto del cliente</span>
    </div>
  </div>` : ''}

  <!-- Módulos con progreso — orden: Documentación → Garantía → Auditoría -->
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

// ── Estado secuencial de fases ────────────────────────────────────────────────
// Retorna { doc, gar, aud } con valores: 'disponible' | 'bloqueada' | 'completa'
export function calcFaseEstado(project) {
  const doc = project.documentacion || {};
  const gar = project.garantia    || {};
  const aud = project.auditoria   || {};

  // Documentación: siempre disponible
  const _fc = (sitio, sub) => {
    const n = doc.fases?.[sitio]?.[sub]?.length || 0;
    if (n > 0) return n;
    if (sitio === 'techo') { const m={antes:'antes',durante:'durante',cierre:'despues'}; return doc.fases?.[m[sub]]?.length||0; }
    return 0;
  };
  const fTecho   = ['antes','durante','cierre'].reduce((s,f)=>s+_fc('techo',f),0);
  const fCentros = ['antes','durante','cierre'].reduce((s,f)=>s+_fc('centrosCarga',f),0);
  const fZona    = ['antes','durante','cierre'].reduce((s,f)=>s+_fc('zonaDelSistema',f),0);
  const docItemsOk = [
    !!(doc.levantamiento?.tipTecho),
    fTecho > 0,
    fCentros > 0,
    fZona > 0,
  ].filter(Boolean).length;

  const docCompleta  = docItemsOk >= 1; // al menos levantamiento iniciado
  const docFirmada   = !!(project.fases?.firmas?.doc);

  // Garantía: disponible cuando Documentación tiene al menos levantamiento
  const garDesbloqueada = docCompleta;
  const totalPaneles = (gar.paneles?.strings||[]).reduce((s,st)=>s+(st.paneles?.length||0),0);
  const garItemsOk = [
    !!gar.fotoSistema,
    !!(gar.fotosTecnicas?.tableroAC || gar.fotosTecnicas?.inversorEnergizado),
    (gar.equipos?.length||0) > 0,
    totalPaneles > 0,
  ].filter(Boolean).length;
  const garCompleta  = garItemsOk >= 2;
  const garFirmada   = !!(project.fases?.firmas?.gar);

  // Auditoría: disponible cuando Garantía tiene >= 2 ítems completados
  const audDesbloqueada = garDesbloqueada && garItemsOk >= 2;
  const audItemsOk = [
    (aud.checklist?.length||0) >= 11,
    !!aud.resultado,
  ].filter(Boolean).length;
  const audCompleta = audItemsOk >= 2;

  return {
    doc: 'disponible',
    gar: garDesbloqueada  ? (garCompleta  ? 'completa' : 'disponible') : 'bloqueada',
    aud: audDesbloqueada  ? (audCompleta  ? 'completa' : 'disponible') : 'bloqueada',
    // Firmas para mostrar en UI
    docFirmada, garFirmada,
    // Textos de requisito para el tooltip del candado
    garRequisito: 'Completa el Levantamiento en Documentación primero.',
    audRequisito: `Completa Garantía primero (foto del sistema + al menos un equipo o foto técnica).`,
  };
}

// ── Firmar fase ───────────────────────────────────────────────────────────────
export async function firmarFase(projectId, fase) {
  const session = await getSession();
  if (!session) { toast('Sesión no encontrada', 'error'); return; }
  const p = await projects.getById(projectId);
  const fases = p.fases || {};
  fases.firmas = fases.firmas || {};
  fases.firmas[fase] = {
    firmado_por: session.uid,
    nombre:      session.nombre || session.email,
    firmado_en:  isoNow(),
  };
  // setField atómico — no sobreescribe el documento completo
  await projects.setField(projectId, `fases.firmas.${fase}`, fases.firmas[fase]);
  const faseNombre = { doc: 'Documentación', gar: 'Garantía', aud: 'Auditoría' }[fase] || fase;
  logChange(projectId, { modulo: faseNombre, accion: 'firmada', detalle: '', quien: session });
  toast(`✅ Fase firmada por ${session.nombre || session.email}`);
  navigate(`#proyecto/${projectId}`);
}
window._firmarFase = firmarFase;

// ── Módulos con progreso ──────────────────────────────────────────────────────
function renderModulosProgreso(project, id, session, admin) {
  // ── Calcular progreso por módulo ──────────────────────────────────────────
  const doc = project.documentacion || {};
  const gar = project.garantia || {};
  const aud = project.auditoria || {};
  const ft  = gar.fotosTecnicas || {};

  // Documentación: levantamiento + 3 fases
  // Contar fotos en nueva estructura (sitio/subfase) con fallback legacy
  const _fc = (sitio, sub) => {
    const n = doc.fases?.[sitio]?.[sub]?.length || 0;
    if (n > 0) return n;
    if (sitio === 'techo') { const m={antes:'antes',durante:'durante',cierre:'despues'}; return doc.fases?.[m[sub]]?.length||0; }
    return 0;
  };
  const fTecho   = ['antes','durante','cierre'].reduce((s,f)=>s+_fc('techo',f),0);
  const fCentros = ['antes','durante','cierre'].reduce((s,f)=>s+_fc('centrosCarga',f),0);
  const fZona    = ['antes','durante','cierre'].reduce((s,f)=>s+_fc('zonaDelSistema',f),0);

  const docItems = [
    { label: 'Levantamiento',                    ok: !!(doc.levantamiento?.tipTecho) },
    { label: `Techo (${fTecho})`,                ok: fTecho > 0 },
    { label: `Centros de carga (${fCentros})`,   ok: fCentros > 0 },
    { label: `Zona del sistema (${fZona})`,      ok: fZona > 0 },
  ];
  const docDone = docItems.filter(i=>i.ok).length;
  const docPct  = Math.round(docDone / docItems.length * 100);

  // Garantía: foto sistema + fotos técnicas + equipos + paneles
  const totalPaneles = (gar.paneles?.strings||[]).reduce((s,st)=>s+(st.paneles?.length||0),0);
  const garItems = [
    { label: 'Foto del sistema',        ok: !!gar.fotoSistema },
    { label: 'Fotos técnicas',          ok: !!(ft.tableroAC || ft.inversorEnergizado) },
    { label: `Equipos (${gar.equipos?.length||0})`, ok: (gar.equipos?.length||0) > 0 },
    { label: `Paneles (${totalPaneles})`,           ok: totalPaneles > 0 },
  ];
  const garDone = garItems.filter(i=>i.ok).length;
  const garPct  = Math.round(garDone / garItems.length * 100);

  // Auditoría: checklist + resultado
  const checkDone  = (aud.checklist?.length||0);
  const checkTotal = 11;
  const audItems = [
    { label: `Checklist (${checkDone}/${checkTotal})`, ok: checkDone >= checkTotal },
    { label: 'Resultado',                              ok: !!aud.resultado },
  ];
  const audDone = audItems.filter(i=>i.ok).length;
  const audPct  = Math.round(audDone / audItems.length * 100);

  const puedeAuditoria = admin || isLider(session);
  const estado = calcFaseEstado(project);

  const totalDone    = docDone + garDone + (puedeAuditoria ? audDone : 0);
  const totalPosible = docItems.length + garItems.length + (puedeAuditoria ? audItems.length : 0);
  const generalPct   = totalPosible > 0 ? Math.round(totalDone / totalPosible * 100) : 0;

  const modCard = (title, iconName, colorClass, pct, items, link, faseKey) => {
    const locked = estado[faseKey] === 'bloqueada';
    const firmada = estado[`${faseKey}Firmada`];
    const clickHandler = locked
      ? `toast('${faseKey === 'gar' ? estado.garRequisito : estado.audRequisito}', 'warn', 4000)`
      : `navigate('${link}')`;
    return `
    <div class="mod-prog-card ${colorClass}${locked ? ' mpc-locked' : ''}" onclick="${clickHandler}">
      <div class="mpc-top">
        <div class="mpc-icon">${locked ? icon('lock-simple', 22) : icon(iconName, 22)}</div>
        <div class="mpc-info">
          <span class="mpc-title">${title}${firmada ? ' <span class="mpc-firmada">✓ Firmada</span>' : ''}</span>
          <div class="mpc-chips">
            ${locked
              ? `<span class="mpc-chip mpc-locked-msg">🔒 Bloqueada — cumple requisito previo</span>`
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
  <div class="card pp-card">
    <div class="pp-header">
      <span class="pp-title">Progreso general</span>
      <span class="pp-pct ${generalPct === 100 ? 'pp-done' : ''}">${generalPct}%</span>
    </div>
    <div class="pp-bar-track">
      <div class="pp-bar-fill ${generalPct === 100 ? 'pp-bar-done' : ''}" style="width:${generalPct}%"></div>
    </div>
    <div class="pp-subs">
      <span class="pp-sub">Doc <b>${docPct}%</b></span>
      <span class="pp-sub">Garantía <b>${garPct}%</b></span>
      ${puedeAuditoria ? `<span class="pp-sub">Auditoría <b>${audPct}%</b></span>` : ''}
    </div>
  </div>

  <div class="modulos-progreso">
    ${modCard('Documentación', 'clipboard-text', 'mpc-doc', docPct, docItems, `#proyecto/${id}/documentacion`, 'doc')}
    ${modCard('Garantía', 'seal-check', 'mpc-gar', garPct, garItems, `#proyecto/${id}/garantia`, 'gar')}
    ${puedeAuditoria ? modCard('Auditoría', 'magnifying-glass-plus', 'mpc-aud', audPct, audItems, `#proyecto/${id}/auditoria`, 'aud') : ''}
  </div>

  <!-- Línea base de desempeño -->
  ${renderLineaBase(project, id, admin || isLider(session))}

  <!-- Herramientas secundarias -->
  <div class="tools-row">
    <button class="tool-btn" onclick="navigate('#calculadora/${id}')">
      ${icon('calculator', 18)}<span>Calculadora</span>
    </button>
    <button class="tool-btn" onclick="navigate('#checklist/${id}')">
      ${icon('check-square', 18)}<span>Checklist</span>
    </button>
    <button class="tool-btn" onclick="navigate('#proyecto/${id}/qr')">
      ${icon('qr-code', 18)}<span>QR Cliente</span>
    </button>
    ${admin ? `<button class="tool-btn" onclick="navigate('#proyecto/${id}/pdf')">
      ${icon('file-arrow-down', 18)}<span>Exportar PDF</span>
    </button>` : ''}
  </div>

  <!-- Historial de cambios -->
  ${renderChangeLog(project.changeLog)}`;
}

// ── Historial de cambios ──────────────────────────────────────────────────────
function renderChangeLog(log) {
  if (!Array.isArray(log) || !log.length) return '';
  const entries = log.slice(0, 10); // solo los 10 más recientes en el resumen
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

// ── Línea base de desempeño ───────────────────────────────────────────────────
function renderLineaBase(project, id, canWrite) {
  const lb = project.lineaBase || {};
  const totalPaneles = (project.garantia?.paneles?.strings || [])
    .reduce((s, st) => s + (st.paneles?.length || 0), 0);
  const wp  = project.garantia?.paneles?.wp || 0;
  const kwp = totalPaneles * wp / 1000;

  if (lb.kwh != null) {
    // Ya registrada — mostrar solo lectura
    const irr = kwp > 0 ? (lb.kwh / kwp).toFixed(2) : '—';
    return `
  <div class="card lb-card">
    <div class="card-title-row">
      <h3 class="card-title">${icon('chart-line', 16)} Línea base</h3>
      ${canWrite ? `<button class="btn-icon-sm lb-edit-btn" onclick="editLineaBase('${id}')" title="Editar">✎</button>` : ''}
    </div>
    <div class="lb-grid">
      <div class="lb-stat"><span class="lb-val">${lb.kwh}</span><span class="lb-lbl">kWh día 1</span></div>
      <div class="lb-stat"><span class="lb-val">${irr}</span><span class="lb-lbl">kWh/kWp</span></div>
      ${lb.horasSol != null ? `<div class="lb-stat"><span class="lb-val">${lb.horasSol}</span><span class="lb-lbl">HSP registradas</span></div>` : ''}
    </div>
    ${lb.notas ? `<p class="lb-notas">${esc(lb.notas)}</p>` : ''}
    <p class="lb-fecha">Registrado: ${fmtFecha(lb.registradoEn)}</p>
  </div>`;
  }

  if (!canWrite) return '';   // apoyo no ve el formulario vacío

  return `
  <div class="card lb-card" id="lb-form-wrap">
    <h3 class="card-title">${icon('chart-line', 16)} Línea base de desempeño</h3>
    <p class="lb-hint">Registra la generación del primer día completo de operación.</p>
    <div class="form-row">
      <div class="form-group">
        <label>kWh generados (día 1)</label>
        <input type="number" id="lb-kwh" step="0.1" min="0" placeholder="Ej: 28.5" />
      </div>
      <div class="form-group">
        <label>Horas sol pico (HSP)</label>
        <input type="number" id="lb-hsp" step="0.1" min="0" placeholder="Ej: 5.5" />
      </div>
    </div>
    <input type="hidden" id="lb-kwp" value="${kwp || 0}" />
    ${kwp > 0 ? `<p class="lb-ref">Sistema: <b>${kwp.toFixed(2)} kWp</b> · Producción esperada (La Paz): ~${(kwp * 6.2 * 0.75).toFixed(1)}–${(kwp * 6.2 * 0.82).toFixed(1)} kWh/día</p>` : ''}
    <div class="form-group">
      <label>Notas</label>
      <textarea id="lb-notas" rows="2" placeholder="Condiciones del día, nubosidad, incidencias…" class="textarea-field"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn-primary btn-sm" onclick="guardarLineaBase('${id}')">
        ${icon('chart-line', 14)} Registrar línea base
      </button>
    </div>
  </div>`;
}

window.guardarLineaBase = async function(projectId) {
  const kwh   = parseFloat(document.getElementById('lb-kwh')?.value);
  const hsp   = parseFloat(document.getElementById('lb-hsp')?.value);
  const notas = document.getElementById('lb-notas')?.value?.trim();
  if (!kwh || kwh <= 0) { toast('Ingresa los kWh generados', 'warn'); return; }

  // FIX-6: Validar ratio kWh/kWp (rango razonable para La Paz: 2–9 kWh/kWp/día)
  const kwp = parseFloat(document.getElementById('lb-kwp')?.value || '0');
  const _doSave = async () => {
    const session = await getSession();
    await projects.setField(projectId, 'lineaBase', {
      kwh, horasSol: hsp || null, notas: notas || null,
      registradoEn: isoNow(), registradoPor: session?.uid || '',
    });
    toast('✅ Línea base registrada');
    navigate(`#proyecto/${projectId}`);
  };

  if (kwp > 0) {
    const ratio = kwh / kwp;
    if (ratio < 2 || ratio > 9) {
      confirmDialog(
        `El ratio kWh/kWp es ${ratio.toFixed(2)}, fuera del rango esperado (2–9) para La Paz. ¿Guardar de todas formas?`,
        _doSave
      );
      return;
    }
  }
  await _doSave();
};

window.editLineaBase = function(projectId) {
  // Permite re-registrar borrando el existente
  confirmDialog('¿Sobrescribir la línea base actual?', async () => {
    await projects.setField(projectId, 'lineaBase', null);
    navigate(`#proyecto/${projectId}`);
  });
};

// renderChecklistProgreso eliminada — reemplazada por renderModulosProgreso

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

// ── Check requisitos para revisión ────────────────────────────────────────────
function _getFaltantes(project) {
  const faltantes = [];
  if (!project.garantia?.fotoSistema) faltantes.push('Foto general del sistema');
  const f = project.documentacion?.fases;
  const hayFotosCierre = (f?.techo?.cierre?.length || f?.despues?.length || 0) > 0;
  if (!hayFotosCierre) faltantes.push('Al menos una foto de Cierre en Documentación');
  const totalPaneles = (project.garantia?.paneles?.strings||[]).reduce((s,str)=>s+(str.paneles?.length||0),0);
  if (totalPaneles === 0) faltantes.push('Al menos un panel registrado con número de serie');
  if (!project.garantia?.fotosTecnicas?.tableroAC) faltantes.push('Foto del tablero AC terminado');
  if (!project.garantia?.fotosTecnicas?.inversorEnergizado) faltantes.push('Foto del inversor energizado');
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

// ── Observaciones ──────────────────────────────────────────────────────────────
function renderObservaciones(obs, session, projectId, edit = false) {
  if (!obs.length) return '<p class="empty-msg-sm">Sin observaciones.</p>';
  return obs.map((o, i) => {
    const p        = PRIORIDADES[o.prioridad] || PRIORIDADES.normal;
    const resuelta = !!o.resuelta;
    const canResolve = edit || isAdmin(session);
    const borderColor = resuelta ? 'var(--border2)' : p.color;
    return `
    <div class="obs-item ${resuelta ? 'obs-resuelta' : ''}" style="border-left:3px solid ${borderColor}">
      <div class="obs-header">
        <span class="obs-autor">${esc(o.autorNombre || '—')}</span>
        <span class="obs-fecha">${fmtFechaHora(o.timestamp)}</span>
        ${resuelta
          ? `<span class="obs-badge-resuelta">✓ Resuelta</span>`
          : `<span class="obs-prio" style="color:${p.color}">${p.label}</span>`}
        <div class="obs-actions">
          ${canResolve && !resuelta
            ? `<button class="btn-resolver" onclick="window._resolverObs('${projectId}',${i},true)" title="Marcar como resuelta">✓ Resolver</button>`
            : ''}
          ${isAdmin(session) && resuelta
            ? `<button class="btn-del-sm" onclick="window._resolverObs('${projectId}',${i},false)" title="Reabrir">↩</button>`
            : ''}
          ${isAdmin(session)
            ? `<button class="btn-del-sm" onclick="window._delObs('${projectId}',${i})" title="Eliminar">✕</button>`
            : ''}
        </div>
      </div>
      <p class="obs-texto">${esc(o.texto)}</p>
      ${resuelta ? `<p class="obs-resuelta-meta">✓ Resuelta por ${esc(o.resueltaPor || '—')} · ${fmtRelativa(o.resueltaAt)}${o.resueltaNota ? ` — ${esc(o.resueltaNota)}` : ''}</p>` : ''}
    </div>`;
  }).join('');
}

window._showAddObs = function(id) {
  document.getElementById('obs-form').style.display = 'block';
  document.getElementById('obs-texto').focus();
};

window._submitObs = async function(id) {
  const texto = document.getElementById('obs-texto').value.trim();
  if (!texto) return;
  const prio = document.getElementById('obs-prio').value;
  const session = JSON.parse(sessionStorage.getItem('ecofit_session') || 'null');
  const project = await projects.getById(id);
  const obs = [...(project.observaciones || []), {
    texto, prioridad: prio, autorId: session?.id, autorNombre: session?.nombre,
    timestamp: isoNow(),
  }];
  await projects.update(id, { observaciones: obs });
  _refreshObsList(obs, session, id, project);
  document.getElementById('obs-form').style.display = 'none';
  document.getElementById('obs-texto').value = '';
  toast('Observación guardada');
};

window._delObs = async function(id, idx) {
  if (!await confirmDialog('¿Eliminar esta observación?')) return;
  const project = await projects.getById(id);
  const obs = (project.observaciones || []).filter((_,i) => i !== idx);
  await projects.update(id, { observaciones: obs });
  const session = JSON.parse(sessionStorage.getItem('ecofit_session') || 'null');
  _refreshObsList(obs, session, id, project);
};

window._resolverObs = async function(id, idx, resolver) {
  const [session, project] = await Promise.all([getSession(), projects.getById(id)]);
  const obs = [...(project.observaciones || [])];
  if (resolver) {
    const nota = await inputDialog('¿Cómo se resolvió? (opcional):', '');
    if (nota === null) return; // canceló
    obs[idx] = {
      ...obs[idx],
      resuelta: true,
      resueltaPor: session?.nombre || '—',
      resueltaAt: isoNow(),
      resueltaNota: nota.trim() || null,
    };
  } else {
    const { resuelta, resueltaPor, resueltaAt, resueltaNota, ...rest } = obs[idx];
    obs[idx] = rest;
  }
  await projects.update(id, { observaciones: obs });
  _refreshObsList(obs, session, id, project);
  toast(resolver ? '✓ Observación resuelta' : 'Observación reabierta');
};

function _refreshObsList(obs, session, projectId, _project) {
  // canEdit requiere el proyecto; si no se pasa usamos isLider como fallback conservador
  const edit = _project ? canEdit(session, _project) : isLider(session);
  const el = document.getElementById('obs-list');
  if (el) el.innerHTML = renderObservaciones(obs, session, projectId, edit);
  const activas   = obs.filter(o => !o.resuelta).length;
  const resueltas = obs.filter(o =>  o.resuelta).length;
  const tituloEl  = document.querySelector('#obs-list')?.closest('.card')?.querySelector('.card-title');
  if (tituloEl) {
    tituloEl.textContent = resueltas
      ? `Observaciones (${activas} activa${activas !== 1 ? 's' : ''} · ${resueltas} resuelta${resueltas !== 1 ? 's' : ''})`
      : `Observaciones (${activas})`;
  }
}

window._eliminarProyecto = async function(id) {
  const project = await projects.getById(id);
  if (!await confirmDialog(`¿Eliminar el proyecto "${project?.displayId} — ${project?.clientName}"?\n\nEsta acción es irreversible.`)) return;
  await projects.delete(id);
  toast('Proyecto eliminado');
  navigate('#dashboard');
};

window._cambiarEstado = async function(id, nuevoEstado) {
  // Advertencia si está offline
  if (!navigator.onLine) {
    const ok = await confirmDialog(
      '⚠ Sin conexión a internet\n\n' +
      'El cambio de estado se guardará localmente y se sincronizará automáticamente cuando haya conexión.\n\n' +
      '¿Continuar?'
    );
    if (!ok) return;
  }

  // Validar requisitos antes de enviar a revisión
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

// ── Formulario nuevo / editar proyecto ────────────────────────────────────────
export async function renderProjectForm(id, session) {
  // FIX-9: Limpiar variables de foto al inicio para que no persistan entre proyectos
  _clienteFotoB64 = null;
  _clienteFotoUrl = null;

  const [project, allUsers] = await Promise.all([
    id ? projects.getById(id) : Promise.resolve(null),
    users.getAll(),
  ]);
  const tecnicos = allUsers.filter(u => u.activo && u.rol !== 'admin');
  const isEditing = project !== null;

  return `
  <div class="view-header">
    <button class="btn-back" onclick="history.back()">${icon('caret-left')}</button>
    <h1 class="hdr-title">${isEditing ? 'Editar proyecto' : 'Nuevo proyecto'}</h1>
  </div>

  <form id="form-proyecto" class="form-card" onsubmit="window._submitProject(event,'${id||''}')">
    <div class="form-group">
      <label>Nombre del cliente *</label>
      <input type="text" name="clientName" required placeholder="Nombre completo del cliente"
             value="${esc(project?.clientName||'')}" />
    </div>

    <div class="form-group">
      <label>Nombre del proyecto <span class="hint-opt">(opcional — para identificar entre proyectos del mismo cliente)</span></label>
      <input type="text" name="nombreProyecto" placeholder="Ej: Casa Lomas, Bodega norte, Local 2…"
             value="${esc(project?.nombreProyecto||'')}" />
    </div>

    <div class="form-group">
      <label>Teléfono / WhatsApp <span class="hint-opt">(opcional)</span></label>
      <div class="input-icon-wrap">
        ${icon('phone', 16, 'input-icon')}
        <input type="tel" name="clienteTelefono" placeholder="Ej: 612 123 4567"
               value="${esc(project?.clienteTelefono||'')}" />
      </div>
    </div>

    <div class="form-group">
      <label>Tipo de sistema *</label>
      <select name="tipoSistema" id="tipo-val"
              onchange="document.getElementById('campos-cliente').style.display=this.value==='sistema_pequeno'?'':'none'">
        ${Object.entries(TIPOS_SISTEMA)
          .filter(([,v]) => !v.legacy)
          .map(([k,v]) => {
            const selected = project
              ? (project.tipoSistema === k ||
                 // compatibilidad: hibrido/respaldo legacy → hibrido_respaldo
                 (k === 'hibrido_respaldo' && ['hibrido','respaldo'].includes(project.tipoSistema)))
              : k === 'interconectado';
            return `<option value="${k}" ${selected?'selected':''}>${v.label}</option>`;
          }).join('')}
      </select>
    </div>

    <div class="form-group">
      <label>Prioridad</label>
      <select name="prioridad">
        ${Object.entries(PRIORIDADES).map(([k,v]) =>
          `<option value="${k}" ${(project?.prioridad||'normal')===k?'selected':''}>${v.label}</option>`
        ).join('')}
      </select>
    </div>

    <div class="form-group">
      <label>Técnico Líder</label>
      <select name="tecnicoLiderId">
        <option value="">— Sin asignar —</option>
        ${tecnicos.filter(u=>u.rol==='lider'||u.rol==='admin').map(u =>
          `<option value="${u.id}" ${project?.tecnicoLiderId===u.id?'selected':''}>${esc(u.nombre)}</option>`
        ).join('')}
      </select>
    </div>

    <div class="form-group">
      <label>Técnicos Apoyo</label>
      <div class="chip-group" id="chip-apoyo">
        ${tecnicos.filter(t => t.rol === 'apoyo').map(t => `
          <button type="button"
            class="chip ${(project?.tecnicosApoyo||[]).includes(t.id)?'chip-active':''}"
            onclick="toggleApoyo('${t.id}',this)">${esc(t.nombre)}</button>
        `).join('')}
        ${tecnicos.filter(t => t.rol === 'apoyo').length === 0
          ? '<span class="hint-text">Sin técnicos de apoyo registrados aún.</span>' : ''}
      </div>
      <input type="hidden" name="tecnicosApoyo" id="apoyo-val"
             value='${JSON.stringify(project?.tecnicosApoyo||[])}'>
    </div>

    <!-- Foto del cliente — solo para sistema pequeño -->
    <div id="campos-cliente" style="display:${project?.tipoSistema === 'sistema_pequeno' ? '' : 'none'}">
      <div class="form-group">
        <label>Foto del cliente <span class="hint-opt">(referencia visual)</span></label>
        <div class="foto-cliente-form" id="foto-cliente-preview">
          ${project?.clienteFoto
            ? `<img src="${esc(project.clienteFoto)}" class="foto-cliente-thumb" />
               <button type="button" class="btn-outline btn-sm" onclick="window._capClienteFoto()">Cambiar</button>`
            : `<button type="button" class="btn-outline btn-sm" onclick="window._capClienteFoto()">
                ${icon('camera', 14)} Tomar foto</button>`}
        </div>
      </div>
    </div>

    <!-- Coordenadas GPS (todos los tipos, importante en sistema pequeño) -->
    <div class="form-group">
      <label>
        ${icon('map-pin', 14)} Coordenadas GPS
        <span class="hint-opt">(opcional)</span>
      </label>
      <div class="coords-inputs">
        <input type="number" name="coordLat" id="coord-lat" step="any"
               placeholder="Latitud  Ej: 24.1234"
               value="${project?.coordenadas?.lat || ''}" />
        <input type="number" name="coordLng" id="coord-lng" step="any"
               placeholder="Longitud  Ej: -110.5678"
               value="${project?.coordenadas?.lng || ''}" />
      </div>
      <button type="button" class="btn-outline btn-sm btn-gps" onclick="window._captureGPS()">
        ${icon('crosshair', 14)} Capturar mi ubicación actual
      </button>
      <p class="hint-text" style="margin-top:4px">El GPS del dispositivo funciona sin internet.</p>
    </div>

    <div class="form-group">
      <label>Dirección / Ubicación</label>
      <input type="text" name="direccion" placeholder="Colonia, calle, municipio"
             value="${esc(project?.direccion||'')}" />
    </div>

    <div class="form-group">
      <label>Fecha de inicio</label>
      <input type="date" name="fechaInicio"
             value="${(project?.fechaInicio||'').split('T')[0]}" />
    </div>

    <div class="form-group">
      <label>Fecha estimada de entrega <span class="hint-opt">(opcional)</span></label>
      <input type="date" name="fechaEstimada"
             value="${(project?.fechaEstimada||'').split('T')[0]}" />
    </div>

    <div class="form-group">
      <label>Notas / Observaciones internas <span class="hint-opt">(opcional)</span></label>
      <textarea name="notas" rows="3" class="textarea-field"
                placeholder="Acceso al inmueble, condiciones especiales, acuerdos verbales…"
      >${esc(project?.notas||'')}</textarea>
    </div>

    <div class="form-actions">
      <button type="button" class="btn-outline" onclick="history.back()">Cancelar</button>
      <button type="submit" class="btn-primary">${isEditing ? 'Guardar cambios' : 'Crear proyecto'}</button>
    </div>
  </form>`;
}

window.selChip = function(groupId, value, inputId, btn) {
  document.querySelectorAll(`#${groupId} .chip`).forEach(c => c.classList.remove('chip-active'));
  (btn || document.activeElement).classList.add('chip-active');
  document.getElementById(inputId).value = value;
  // Mostrar / ocultar campos de sistema pequeño
  if (inputId === 'tipo-val') {
    const camposCliente = document.getElementById('campos-cliente');
    if (camposCliente) camposCliente.style.display = value === 'sistema_pequeno' ? '' : 'none';
  }
};

window.toggleApoyo = function(id, btn) {
  btn.classList.toggle('chip-active');
  const input = document.getElementById('apoyo-val');
  let ids = JSON.parse(input.value || '[]');
  ids = ids.includes(id) ? ids.filter(i=>i!==id) : [...ids, id];
  input.value = JSON.stringify(ids);
};

// ── Capturar GPS ───────────────────────────────────────────────────────────────
window._captureGPS = function() {
  if (!navigator.geolocation) { toast('GPS no disponible en este dispositivo', 'error'); return; }
  toast('Obteniendo ubicación…', 'info', 5000);
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(7);
      const lng = pos.coords.longitude.toFixed(7);
      const latInput = document.getElementById('coord-lat');
      const lngInput = document.getElementById('coord-lng');
      if (latInput) latInput.value = lat;
      if (lngInput) lngInput.value = lng;
      toast(`📍 Ubicación capturada: ${lat}, ${lng}`, 'success', 4000);
    },
    err => {
      const msgs = { 1: 'Permiso de ubicación denegado', 2: 'Ubicación no disponible', 3: 'Tiempo de espera agotado' };
      toast(msgs[err.code] || 'Error al obtener ubicación', 'error');
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
};

// ── Capturar foto del cliente ──────────────────────────────────────────────────
window._capClienteFoto = function() {
  capturePhoto(b64 => {
    _clienteFotoB64 = b64;
    _clienteFotoUrl = null;
    const preview = document.getElementById('foto-cliente-preview');
    if (preview) {
      preview.innerHTML = `
        <img src="${b64}" class="foto-cliente-thumb" />
        <button type="button" class="btn-outline btn-sm" onclick="window._capClienteFoto()">Cambiar</button>`;
    }
  });
};

window._submitProject = async function(e, editId) {
  e.preventDefault();
  const btn = e.target.querySelector('[type="submit"]');
  const btnLabel = btn.textContent;
  btn.disabled = true;
  btn.classList.add('btn-saving');
  btn.textContent = 'Guardando';

  const fd = new FormData(e.target);
  const session = JSON.parse(sessionStorage.getItem('ecofit_session') || 'null');

  const tipoSistema = fd.get('tipoSistema') || null;
  if (!tipoSistema) {
    btn.disabled = false;
    btn.classList.remove('btn-saving');
    btn.textContent = btnLabel;
    toast('Selecciona el tipo de sistema', 'error');
    document.getElementById('chip-tipo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const esPequeno   = tipoSistema === 'sistema_pequeno';

  // Coordenadas GPS
  const lat = parseFloat(fd.get('coordLat'));
  const lng = parseFloat(fd.get('coordLng'));
  const coordenadas = (!isNaN(lat) && !isNaN(lng)) ? { lat, lng } : null;

  const data = {
    clientName:      fd.get('clientName').trim(),
    nombreProyecto:  fd.get('nombreProyecto')?.trim() || null,
    tipoSistema,
    prioridad:       fd.get('prioridad'),
    tecnicoLiderId:  fd.get('tecnicoLiderId') || null,
    tecnicosApoyo:   JSON.parse(fd.get('tecnicosApoyo') || '[]'),
    direccion:       fd.get('direccion').trim(),
    fechaInicio:     fd.get('fechaInicio')    ? new Date(fd.get('fechaInicio')).toISOString()    : null,
    fechaEstimada:   fd.get('fechaEstimada') ? new Date(fd.get('fechaEstimada')).toISOString() : null,
    coordenadas,
    clienteTelefono:  fd.get('clienteTelefono')?.trim() || null,
    notas:            fd.get('notas')?.trim() || null,
  };

  // Foto del cliente: subir si hay nueva foto capturada
  if (esPequeno && _clienteFotoB64) {
    const pid = editId || 'temp_' + uuid();
    const result = await uploadPhotoQueued(_clienteFotoB64,
      `projects/${editId || pid}/cliente.jpg`, editId || pid, 'clienteFoto');
    data.clienteFoto = result.url || null;
    _clienteFotoB64 = null;
    _clienteFotoUrl = null;
  } else if (editId) {
    // Mantener foto existente si no se tomó nueva
    const existing = await projects.getById(editId);
    if (existing?.clienteFoto) data.clienteFoto = existing.clienteFoto;
  }

  try {
    if (editId) {
      await projects.update(editId, data);
      toast('Proyecto actualizado');
      navigate(`#proyecto/${editId}`);
    } else {
      const createdAt = isoNow();
      // Generar ID legible con anti-duplicados
      const allProjects = await projects.getAll();
      const existingIds = allProjects.map(p => p.displayId).filter(Boolean);
      const displayId = genDisplayId(data.clientName, createdAt, data.tipoSistema, existingIds);
      const newProject = {
        id: uuid(),
        displayId,
        ...data,
        estado: 'borrador',
        observaciones: [],
        garantia: { fotoSistema: null, fotosTecnicas: {}, equipos: [], estructura: null, paneles: { marca:'', modelo:'', wp:0, strings:[] } },
        documentacion: { levantamiento: {}, fases: {
          techo:          { antes:[], durante:[], cierre:[] },
          centrosCarga:   { antes:[], durante:[], cierre:[] },
          zonaDelSistema: { antes:[], durante:[], cierre:[] },
        }},
        auditoria: null,
        driveSynced: false,
        createdBy: session?.id,
        createdAt,
        updatedAt: createdAt,
      };
      await projects.add(newProject);
      toast(`Proyecto ${newProject.displayId} creado`);
      navigate(`#proyecto/${newProject.id}`);
    }
  } catch (err) {
    btn.disabled = false;
    btn.classList.remove('btn-saving');
    btn.textContent = btnLabel;
    toast(err.message || 'Error al guardar. Verifica conexión.', 'error');
  }
};

window._importCalc = async function(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    // Pre-fill form fields from calculator JSON
    if (data.clientName) document.querySelector('[name="clientName"]').value = data.clientName;
    if (data.tipo) {
      // Mapear tipos legacy al nuevo esquema
      const legacyMap = { hibrido: 'hibrido_respaldo', respaldo: 'hibrido_respaldo' };
      const tipo = legacyMap[data.tipo] || data.tipo;
      const sel = document.getElementById('tipo-val');
      if (sel) sel.value = tipo;
    }
    toast('✅ Datos importados — completa el formulario y crea el proyecto');
  } catch(err) {
    toast('Error al importar: ' + err.message, 'error');
  }
};
