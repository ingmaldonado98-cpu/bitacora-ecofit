// project.js — Creación, detalle y gestión del proyecto

import { projects, users, kv } from './db.js';
import { esc, fmtFecha, fmtFechaHora, fmtProjectId, uuid, isoNow, toast,
         ESTADOS, PRIORIDADES, TIPOS_SISTEMA, confirmDialog } from './utils.js';
import { isAdmin, isLider, canTransition, canEdit, TRANSITIONS } from './auth.js';
import { icon } from './icons.js';

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
    </div>
  </div>

  <!-- Info general -->
  <div class="card">
    <div class="card-row">
      <div class="meta-item">
        <span class="meta-lbl">Cliente</span>
        <span class="meta-val">${esc(project.clientName || '—')}</span>
      </div>
      <div class="meta-item">
        <span class="meta-lbl">Prioridad</span>
        <span class="meta-val" style="color:${prio.color}">● ${prio.label}</span>
      </div>
    </div>
    <div class="card-row">
      <div class="meta-item">
        <span class="meta-lbl">Tipo de sistema</span>
        <span class="meta-val">${tipo ? tipo.label : '—'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-lbl">Fecha inicio</span>
        <span class="meta-val">${fmtFecha(project.fechaInicio)}</span>
      </div>
    </div>
    ${project.direccion ? `<div class="meta-item"><span class="meta-lbl">Dirección</span>
      <span class="meta-val">${esc(project.direccion)}</span></div>` : ''}
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

  <!-- Progreso rápido -->
  <div class="progress-chips">
    <div class="prog-chip ${project.garantia?.fotoSistema ? 'prog-ok' : ''}">
      <ph-icon name="${project.garantia?.fotoSistema ? 'check-circle' : 'circle'}"></ph-icon>
      Foto general
    </div>
    <div class="prog-chip ${totalPaneles > 0 ? 'prog-ok' : ''}">
      <ph-icon name="${totalPaneles > 0 ? 'check-circle' : 'circle'}"></ph-icon>
      ${totalPaneles} paneles
    </div>
    <div class="prog-chip ${totalEquipos > 0 ? 'prog-ok' : ''}">
      <ph-icon name="${totalEquipos > 0 ? 'check-circle' : 'circle'}"></ph-icon>
      ${totalEquipos} equipos
    </div>
    <div class="prog-chip ${project.garantia?.fotosTecnicas?.tableroAC ? 'prog-ok' : ''}">
      <ph-icon name="${project.garantia?.fotosTecnicas?.tableroAC ? 'check-circle' : 'circle'}"></ph-icon>
      Tablero AC
    </div>
    <div class="prog-chip ${project.garantia?.fotosTecnicas?.inversorEnergizado ? 'prog-ok' : ''}">
      <ph-icon name="${project.garantia?.fotosTecnicas?.inversorEnergizado ? 'check-circle' : 'circle'}"></ph-icon>
      Inversor ✓
    </div>
    <div class="prog-chip ${(project.documentacion?.fases?.despues?.length > 0) ? 'prog-ok' : ''}">
      <ph-icon name="${(project.documentacion?.fases?.despues?.length > 0) ? 'check-circle' : 'circle'}"></ph-icon>
      Foto final
    </div>
  </div>

  <!-- Checklist de progreso siempre visible -->
  ${renderChecklistProgreso(project)}

  <!-- Módulos navegación -->
  <div class="modules-grid">
    <button class="module-btn mod-garantia" onclick="navigate('#proyecto/${id}/garantia')">
      ${icon('seal-check', 30)}
      <span>Garantía</span>
      <span class="mod-sub">Equipos · Paneles · Fotos</span>
    </button>
    <button class="module-btn mod-docs" onclick="navigate('#proyecto/${id}/documentacion')">
      ${icon('images', 30)}
      <span>Documentación</span>
      <span class="mod-sub">Levantamiento · Fotos</span>
    </button>
    ${(admin || isLider(session)) ? `<button class="module-btn mod-auditoria" onclick="navigate('#proyecto/${id}/auditoria')">
      ${icon('magnifying-glass-plus', 30)}
      <span>Auditoría</span>
      <span class="mod-sub">Checklist · Dictamen</span>
    </button>` : ''}
    <button class="module-btn mod-qr" onclick="navigate('#proyecto/${id}/qr')">
      ${icon('qr-code', 30)}
      <span>QR Cliente</span>
      <span class="mod-sub">PNG descargable</span>
    </button>
    <button class="module-btn mod-calc" onclick="navigate('#calculadora/${id}')">
      ${icon('calculator', 30)}
      <span>Calculadora</span>
      <span class="mod-sub">BOM · Estructura · Montaje</span>
    </button>
    <button class="module-btn mod-cl" onclick="navigate('#checklist/${id}')">
      ${icon('check-square', 30)}
      <span>Checklist</span>
      <span class="mod-sub">Herramienta · Revisión · Campo</span>
    </button>
    ${admin ? `<button class="module-btn mod-pdf" onclick="navigate('#proyecto/${id}/pdf')">
      ${icon('file-arrow-down', 30)}
      <span>Exportar PDF</span>
      <span class="mod-sub">Cliente · Técnico</span>
    </button>` : ''}
  </div>

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
      <h3 class="card-title">Observaciones (${(project.observaciones||[]).length})</h3>
      ${edit ? `<button class="btn-sm btn-outline" onclick="window._showAddObs('${id}')">+ Añadir</button>` : ''}
    </div>
    <div id="obs-list">
      ${renderObservaciones(project.observaciones || [], session, id)}
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
  `;
}

// ── Checklist de progreso siempre visible ─────────────────────────────────────
function renderChecklistProgreso(project) {
  const totalPaneles = (project.garantia?.paneles?.strings||[])
    .reduce((s,str)=>s+(str.paneles?.length||0),0);
  const ft = project.garantia?.fotosTecnicas || {};

  const items = [
    {
      label: 'Foto general del sistema',
      ok:    !!project.garantia?.fotoSistema,
      req:   true,
      link:  `#proyecto/${project.id}/garantia`,
    },
    {
      label: `Paneles registrados (${totalPaneles})`,
      ok:    totalPaneles > 0,
      req:   true,
      link:  `#proyecto/${project.id}/garantia`,
    },
    {
      label: 'Tablero AC terminado',
      ok:    !!ft.tableroAC,
      req:   true,
      link:  `#proyecto/${project.id}/garantia`,
    },
    {
      label: 'Inversor energizado',
      ok:    !!ft.inversorEnergizado,
      req:   true,
      link:  `#proyecto/${project.id}/garantia`,
    },
    {
      label: 'Protecciones instaladas',
      ok:    !!ft.protecciones,
      req:   false,
      link:  `#proyecto/${project.id}/garantia`,
    },
    {
      label: `Fotos "Después" (${project.documentacion?.fases?.despues?.length||0})`,
      ok:    (project.documentacion?.fases?.despues?.length||0) > 0,
      req:   true,
      link:  `#proyecto/${project.id}/documentacion`,
    },
    {
      label: 'Equipos registrados',
      ok:    (project.garantia?.equipos?.length||0) > 0,
      req:   false,
      link:  `#proyecto/${project.id}/garantia`,
    },
    {
      label: 'Levantamiento de datos',
      ok:    !!(project.documentacion?.levantamiento?.tipTecho),
      req:   false,
      link:  `#proyecto/${project.id}/documentacion`,
    },
  ];

  const reqs   = items.filter(i => i.req);
  const opts   = items.filter(i => !i.req);
  const doneReqs = reqs.filter(i => i.ok).length;
  const pct    = Math.round((items.filter(i=>i.ok).length / items.length) * 100);
  const allReqsDone = reqs.every(i => i.ok);

  return `
  <div class="card checklist-progreso">
    <div class="chk-header">
      <h3 class="card-title">Progreso del proyecto</h3>
      <span class="chk-pct ${allReqsDone?'chk-pct-ok':''}">${pct}%</span>
    </div>
    <div class="chk-bar-wrap">
      <div class="chk-bar" style="width:${pct}%"></div>
    </div>
    <div class="chk-items">
      ${reqs.map(i=>`
        <div class="chk-item ${i.ok?'chk-ok':''}" onclick="navigate('${i.link}')">
          <span class="chk-ico">${i.ok ? '✓' : '○'}</span>
          <span class="chk-lbl">${i.label}</span>
          ${i.req && !i.ok ? '<span class="chk-req-badge">Requerido</span>' : ''}
          ${icon('caret-right', 14, 'chk-arrow')}
        </div>`).join('')}
      <details class="chk-opcionales">
        <summary>Opcionales (${opts.filter(i=>i.ok).length}/${opts.length})</summary>
        ${opts.map(i=>`
          <div class="chk-item chk-opt ${i.ok?'chk-ok':''}" onclick="navigate('${i.link}')">
            <span class="chk-ico">${i.ok ? '✓' : '○'}</span>
            <span class="chk-lbl">${i.label}</span>
            ${icon('caret-right', 14, 'chk-arrow')}
          </div>`).join('')}
      </details>
    </div>
  </div>`;
}

// ── Check requisitos para revisión ────────────────────────────────────────────
function checklistFaltantes(project) {
  const faltantes = [];
  if (!project.garantia?.fotoSistema) faltantes.push('Foto general del sistema');
  if (!(project.documentacion?.fases?.despues?.length > 0)) faltantes.push('Al menos una foto en fase "Después"');
  const totalPaneles = (project.garantia?.paneles?.strings||[]).reduce((s,str)=>s+(str.paneles?.length||0),0);
  if (totalPaneles === 0) faltantes.push('Al menos un panel registrado con número de serie');
  if (!project.garantia?.fotosTecnicas?.tableroAC) faltantes.push('Foto del tablero AC terminado');
  if (!project.garantia?.fotosTecnicas?.inversorEnergizado) faltantes.push('Foto del inversor energizado');

  if (!faltantes.length) return '';
  return `<div class="faltantes-list">
    <p class="falt-title">${icon('warning')} Pendiente para enviar a revisión:</p>
    ${faltantes.map(f => `<div class="falt-item">${icon('x-circle', 20, 'falt-x')} ${esc(f)}</div>`).join('')}
  </div>`;
}

// ── Observaciones ──────────────────────────────────────────────────────────────
function renderObservaciones(obs, session, projectId) {
  if (!obs.length) return '<p class="empty-msg-sm">Sin observaciones.</p>';
  return obs.map((o, i) => {
    const p = PRIORIDADES[o.prioridad] || PRIORIDADES.normal;
    return `<div class="obs-item" style="border-left:3px solid ${p.color}">
      <div class="obs-header">
        <span class="obs-autor">${esc(o.autorNombre || '—')}</span>
        <span class="obs-fecha">${fmtFechaHora(o.timestamp)}</span>
        <span class="obs-prio" style="color:${p.color}">${p.label}</span>
        ${isAdmin(session) ? `<button class="btn-del-sm" onclick="window._delObs('${projectId}',${i})">✕</button>` : ''}
      </div>
      <p class="obs-texto">${esc(o.texto)}</p>
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
  document.getElementById('obs-list').innerHTML = renderObservaciones(obs, session, id);
  document.getElementById('obs-form').style.display = 'none';
  document.getElementById('obs-texto').value = '';
  toast('Observación guardada');
};

window._delObs = async function(id, idx) {
  if (!confirmDialog('¿Eliminar esta observación?')) return;
  const project = await projects.getById(id);
  const obs = (project.observaciones || []).filter((_,i) => i !== idx);
  await projects.update(id, { observaciones: obs });
  const session = JSON.parse(sessionStorage.getItem('ecofit_session') || 'null');
  document.getElementById('obs-list').innerHTML = renderObservaciones(obs, session, id);
};

window._cambiarEstado = async function(id, nuevoEstado) {
  const msg = `¿Cambiar estado a "${ESTADOS[nuevoEstado]?.label}"?`;
  if (!confirmDialog(msg)) return;
  const changes = { estado: nuevoEstado };
  if (nuevoEstado === 'en_progreso' && !(await projects.getById(id))?.fechaInicio) {
    changes.fechaInicio = isoNow();
  }
  if (nuevoEstado === 'cerrado') changes.fechaCierre = isoNow();
  await projects.update(id, changes);
  toast(`Estado actualizado: ${ESTADOS[nuevoEstado]?.label}`);
  navigate(`#proyecto/${id}`);
};

// ── Formulario nuevo / editar proyecto ────────────────────────────────────────
export async function renderProjectForm(id, session) {
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
      <label>Tipo de sistema *</label>
      <div class="chip-group" id="chip-tipo">
        ${Object.entries(TIPOS_SISTEMA).map(([k,v]) => `
          <button type="button" class="chip ${project?.tipoSistema===k?'chip-active':''}"
            onclick="selChip('chip-tipo','${k}','tipo-val',this)">${v.label}</button>
        `).join('')}
      </div>
      <input type="hidden" name="tipoSistema" id="tipo-val" value="${project?.tipoSistema||''}">
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
        ${tecnicos.map(t => `
          <button type="button"
            class="chip ${(project?.tecnicosApoyo||[]).includes(t.id)?'chip-active':''}"
            onclick="toggleApoyo('${t.id}',this)">${esc(t.nombre)}</button>
        `).join('')}
      </div>
      <input type="hidden" name="tecnicosApoyo" id="apoyo-val"
             value='${JSON.stringify(project?.tecnicosApoyo||[])}'>
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
};

window.toggleApoyo = function(id, btn) {
  btn.classList.toggle('chip-active');
  const input = document.getElementById('apoyo-val');
  let ids = JSON.parse(input.value || '[]');
  ids = ids.includes(id) ? ids.filter(i=>i!==id) : [...ids, id];
  input.value = JSON.stringify(ids);
};

window._submitProject = async function(e, editId) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const session = JSON.parse(sessionStorage.getItem('ecofit_session') || 'null');

  const data = {
    clientName:      fd.get('clientName').trim(),
    tipoSistema:     fd.get('tipoSistema') || null,
    prioridad:       fd.get('prioridad'),
    tecnicoLiderId:  fd.get('tecnicoLiderId') || null,
    tecnicosApoyo:   JSON.parse(fd.get('tecnicosApoyo') || '[]'),
    direccion:       fd.get('direccion').trim(),
    fechaInicio:     fd.get('fechaInicio') ? new Date(fd.get('fechaInicio')).toISOString() : null,
  };

  if (editId) {
    await projects.update(editId, data);
    toast('Proyecto actualizado');
    navigate(`#proyecto/${editId}`);
  } else {
    const counter = await kv.inc('project_counter', 1);
    const newProject = {
      id: uuid(),
      displayId: fmtProjectId(counter),
      ...data,
      estado: 'borrador',
      observaciones: [],
      garantia: { fotoSistema: null, fotosTecnicas: {}, equipos: [], estructura: null, paneles: { marca:'', modelo:'', wp:0, strings:[] } },
      documentacion: { levantamiento: {}, fases: { antes:[], durante:[], despues:[] } },
      auditoria: null,
      driveSynced: false,
      createdBy: session?.id,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    };
    await projects.add(newProject);
    toast(`Proyecto ${newProject.displayId} creado`);
    navigate(`#proyecto/${newProject.id}`);
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
      const map = { interconectado:'interconectado', hibrido:'hibrido', aislado:'aislado', bombeo:'bombeo' };
      const tipo = map[data.tipo] || data.tipo;
      document.getElementById('tipo-val').value = tipo;
      document.querySelectorAll('#chip-tipo .chip').forEach(c => {
        c.classList.toggle('chip-active', c.textContent.trim() === TIPOS_SISTEMA[tipo]?.label);
      });
    }
    toast('✅ Datos importados — completa el formulario y crea el proyecto');
  } catch(err) {
    toast('Error al importar: ' + err.message, 'error');
  }
};
