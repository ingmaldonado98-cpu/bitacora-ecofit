// proj-form.js — Formulario de creación y edición de proyecto
// Extraído de project.js. Exporta renderProjectForm.

import { projects, users, logChange } from './db.js';
import { esc, toast, uuid, isoNow, genDisplayId, ESTADOS, PRIORIDADES, TIPOS_SISTEMA,
         capturePhoto } from './utils.js';
import { getSession } from './auth.js';
import { uploadPhotoQueued } from './firebase.js';
import { icon } from './icons.js';

// ── Foto del cliente pendiente de subir en el form actual ─────────────────────
let _clienteFotoB64 = null;
let _clienteFotoUrl = null;

// ── Formulario nuevo / editar proyecto ────────────────────────────────────────
export async function renderProjectForm(id, session) {
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

    <!-- Coordenadas GPS -->
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

    <div class="form-row">
      <div class="form-group">
        <label>Ciudad <span class="hint-opt">(opcional)</span></label>
        <input type="text" name="ciudad" placeholder="Ej: La Paz"
               value="${esc(project?.ciudad||'')}" />
      </div>
      <div class="form-group">
        <label>Estado <span class="hint-opt">(opcional)</span></label>
        <input type="text" name="estadoDireccion" placeholder="Ej: Baja California Sur"
               value="${esc(project?.estadoDireccion||'')}" />
      </div>
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

// ── Chip helpers ──────────────────────────────────────────────────────────────
window.selChip = function(groupId, value, inputId, btn) {
  document.querySelectorAll(`#${groupId} .chip`).forEach(c => c.classList.remove('chip-active'));
  (btn || document.activeElement).classList.add('chip-active');
  document.getElementById(inputId).value = value;
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

// ── Submit crear / editar ─────────────────────────────────────────────────────
window._submitProject = async function(e, editId) {
  e.preventDefault();
  const btn = e.target.querySelector('[type="submit"]');
  const btnLabel = btn.textContent;
  btn.disabled = true;
  btn.classList.add('btn-saving');
  btn.textContent = 'Guardando';

  const fd = new FormData(e.target);
  const session = await getSession();

  const tipoSistema = fd.get('tipoSistema') || null;
  if (!tipoSistema) {
    btn.disabled = false;
    btn.classList.remove('btn-saving');
    btn.textContent = btnLabel;
    toast('Selecciona el tipo de sistema', 'error');
    document.getElementById('chip-tipo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const esPequeno = tipoSistema === 'sistema_pequeno';

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
    ciudad:          fd.get('ciudad')?.trim() || null,
    estadoDireccion: fd.get('estadoDireccion')?.trim() || null,
    fechaInicio:     fd.get('fechaInicio')    ? new Date(fd.get('fechaInicio')).toISOString()    : null,
    fechaEstimada:   fd.get('fechaEstimada') ? new Date(fd.get('fechaEstimada')).toISOString() : null,
    coordenadas,
    clienteTelefono:  fd.get('clienteTelefono')?.trim() || null,
    notas:            fd.get('notas')?.trim() || null,
  };

  // Foto del cliente
  if (esPequeno && _clienteFotoB64) {
    const pid = editId || 'temp_' + uuid();
    const result = await uploadPhotoQueued(_clienteFotoB64,
      `projects/${editId || pid}/cliente.jpg`, editId || pid, 'clienteFoto');
    data.clienteFoto = result.url || null;
    _clienteFotoB64 = null;
    _clienteFotoUrl = null;
  } else if (editId) {
    const existing = await projects.getById(editId);
    if (existing?.clienteFoto) data.clienteFoto = existing.clienteFoto;
  }

  try {
    if (editId) {
      const prev = await projects.getById(editId);
      if (prev && (prev.clientName !== data.clientName || prev.tipoSistema !== data.tipoSistema)) {
        const all = await projects.getAll();
        const otherIds = all.filter(x => x.id !== editId).map(x => x.displayId).filter(Boolean);
        data.displayId = genDisplayId(data.clientName, prev.createdAt, data.tipoSistema, otherIds);
      }
      await projects.update(editId, data);
      logChange(editId, { modulo: 'Proyecto', accion: 'datos generales actualizados', detalle: data.clientName || '', quien: session });
      toast('Proyecto actualizado');
      navigate(`#proyecto/${editId}`);
    } else {
      const createdAt = isoNow();
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
      logChange(newProject.id, { modulo: 'Proyecto', accion: 'proyecto creado', detalle: newProject.displayId, quien: session });
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

// ── Importar desde JSON de calculadora ───────────────────────────────────────
window._importCalc = async function(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.clientName) document.querySelector('[name="clientName"]').value = data.clientName;
    if (data.tipo) {
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
