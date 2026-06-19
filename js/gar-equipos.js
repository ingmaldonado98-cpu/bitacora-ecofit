// gar-equipos.js — Equipos instalados: form, CRUD, scanner de serial
// Extraído de garantia.js. Exporta renderEquipos, formEquipo, _clearEqFotos, _serialUbicacion.

import { projects, logChange } from './db.js';
import { esc, fotoMini, capturePhoto, toast, confirmDialog, uuid, isoNow,
         MARCAS_EQUIPOS, openScannerOverlay } from './utils.js';
import { getSession } from './auth.js';
import { uploadPhotoQueued } from './firebase.js';
import { updateQueueItem } from './photo-queue.js';
import { icon } from './icons.js';

// ── Tipos de equipo ────────────────────────────────────────────────────────────
const TIPOS_EQUIPO = [
  { value: '',              label: '— Seleccionar tipo —' },
  { value: 'inversor',      label: 'Inversor' },
  { value: 'microinversor', label: 'Microinversor' },
  { value: 'bateria',       label: 'Batería' },
  { value: 'controladora',  label: 'Controladora / MPPT' },
  { value: 'cargador',      label: 'Cargador' },
  { value: 'optimizador',   label: 'Optimizador de potencia' },
  { value: 'monitor',       label: 'Monitor / Gateway' },
  { value: 'otro',          label: 'Otro' },
];

// ── Fotos temporales del equipo en edición ─────────────────────────────────────
// Compartido con gar-estructura.js (capEqFoto también aplica al form de estructura)
const _eqFotos = {};
export function _clearEqFotos() {
  Object.keys(_eqFotos).forEach(k => delete _eqFotos[k]);
}
export { _eqFotos };

// ── Render de equipos ──────────────────────────────────────────────────────────
export function renderEquipos(equipos, projectId, edit, admin) {
  if (!equipos.length) return edit
    ? `<div class="empty-state"><div class="empty-state-icon">⚡</div>
       <p class="empty-state-msg">Sin equipos registrados.<br>Agrega inversor, batería, controladora…</p>
       <button class="empty-state-cta" onclick="showFormEquipo('${projectId}')">+ Agregar equipo</button></div>`
    : '<p class="empty-msg-sm">Sin equipos registrados.</p>';

  return equipos.map((eq, i) => {
    const tipoLabel = TIPOS_EQUIPO.find(t => t.value === eq.tipo)?.label || eq.tipo || '';
    return `
    <div class="equipo-card" id="eq-card-${i}">
      <div class="eq-header">
        <div class="eq-id-info">
          ${tipoLabel ? `<span class="eq-tipo-badge">${tipoLabel}</span>` : ''}
          <span class="eq-marca">${esc(eq.marca)}</span>
          <span class="eq-modelo">${esc(eq.modelo)}</span>
        </div>
        <div class="eq-actions">
          ${edit ? `<button class="btn-icon-sm" onclick="editarEquipo('${projectId}',${i})" title="Editar equipo">✎</button>` : ''}
          ${admin ? `<button class="btn-del-sm" onclick="delEquipo('${projectId}',${i})" title="Eliminar equipo">✕</button>` : ''}
        </div>
      </div>
      <div class="eq-serial">
        ${icon('barcode')}
        <span>${esc(eq.serial || '—')}</span>
      </div>
      <div class="eq-fotos">
        ${fotoMini(eq.fotoPlaca, 'Placa S/N')}
        ${fotoMini(eq.fotoFrontal, 'Frontal')}
        ${fotoMini(eq.fotoAngulo, 'Ángulo')}
      </div>
      ${eq.notas ? `<p class="eq-notas">${esc(eq.notas)}</p>` : ''}
    </div>`;
  }).join('');
}

export function formEquipo(projectId, eq = null, editIdx = -1, kitPrefill = null) {
  const isEdit = editIdx >= 0 && eq;
  const modeloVal = isEdit ? esc(eq.modelo) : esc(kitPrefill?.nombre || '');
  return `
    <h3 class="card-title">${isEdit ? 'Editar equipo' : 'Agregar equipo'}</h3>
    <input type="hidden" id="eq-editing-idx" value="${editIdx}" />
    <input type="hidden" id="eq-kit-id" value="${esc(kitPrefill?.kitId || '')}" />
    ${kitPrefill ? `<p class="form-hint">Viene del Kit de obra — completa tipo, marca y serial.</p>` : ''}
    <div class="form-row">
      <div class="form-group">
        <label>Tipo *</label>
        <select id="eq-tipo" onchange="toggleVocMaxField()">
          ${TIPOS_EQUIPO.map(t =>
            `<option value="${t.value}" ${(isEdit ? eq.tipo : '') === t.value ? 'selected' : ''}>${t.label}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Marca *</label>
        <select id="eq-marca">
          ${MARCAS_EQUIPOS.map(m => `<option ${(isEdit ? eq.marca : '') === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Modelo *</label>
      <input type="text" id="eq-modelo" placeholder="Ej: LXP-5K-48"
             value="${modeloVal}"
             oninput="toggleVocMaxField()" />
    </div>
    <!-- vocMax: solo para inversores -->
    <div class="form-group" id="eq-vocmax-wrap" style="${(isEdit ? eq.tipo : '') === 'inversor' ? '' : 'display:none'}">
      <label>Voc máx. entrada CD (V) <span class="form-hint">Del datasheet del inversor</span></label>
      <input type="number" id="eq-vocmax" placeholder="Ej: 600" step="1" min="0"
             value="${isEdit ? esc(eq.vocMax || '') : ''}" />
    </div>
    <div class="form-group">
      <label>Número de serie</label>
      <div class="serial-row">
        <input type="text" id="eq-serial" placeholder="Escribe o escanea el serial"
               value="${isEdit ? esc(eq.serial || '') : ''}" />
        <button type="button" class="btn-icon" onclick="scanSerial('${projectId}')" title="Escanear con cámara">
          ${icon('barcode')}
        </button>
      </div>
    </div>
    <div class="fotos-captura-row">
      <div class="foto-cap-slot" id="slot-eq-placa">
        ${isEdit && eq.fotoPlaca
          ? fotoMini(eq.fotoPlaca, 'Placa S/N')
          : `<button class="btn-foto-sm" onclick="capEqFoto('placa','slot-eq-placa')">${icon('camera')} Placa S/N</button>`}
      </div>
      <div class="foto-cap-slot" id="slot-eq-frontal">
        ${isEdit && eq.fotoFrontal
          ? fotoMini(eq.fotoFrontal, 'Frontal')
          : `<button class="btn-foto-sm" onclick="capEqFoto('frontal','slot-eq-frontal')">${icon('camera')} Frontal</button>`}
      </div>
      <div class="foto-cap-slot" id="slot-eq-angulo">
        ${isEdit && eq.fotoAngulo
          ? fotoMini(eq.fotoAngulo, 'Ángulo')
          : `<button class="btn-foto-sm" onclick="capEqFoto('angulo','slot-eq-angulo')">${icon('camera')} Ángulo</button>`}
      </div>
    </div>
    <div class="form-group">
      <label>Notas</label>
      <textarea id="eq-notas" rows="2" placeholder="Observaciones opcionales…">${isEdit ? esc(eq.notas || '') : ''}</textarea>
    </div>
    <div class="form-actions">
      <button class="btn-outline btn-sm" onclick="_cancelarFormEquipo()">Cancelar</button>
      <button class="btn-primary btn-sm" onclick="guardarEquipo('${projectId}')">
        ${isEdit ? 'Actualizar equipo' : 'Guardar equipo'}
      </button>
    </div>
  `;
}

// Limpiar fotos temporales al navegar a la vista de garantía
window.capEqFoto = function(tipo, slotId) {
  capturePhoto(async (b64) => {
    toast('Subiendo foto…');
    const fid = uuid();
    const result = await uploadPhotoQueued(b64, `projects/equipo_${tipo}_${fid}.jpg`,
      'equipo_temp', 'eqFoto', { tipo });
    _eqFotos[tipo] = result.url || (result.pending ? { pending: true, pendingId: result.pendingId } : null);
    const slot = document.getElementById(slotId);
    if (slot) slot.innerHTML = fotoMini(_eqFotos[tipo], tipo);
    if (result.url) toast('✅ Foto guardada');
  });
};

// Mostrar/ocultar campo vocMax según tipo de equipo seleccionado
window.toggleVocMaxField = function() {
  const tipo = document.getElementById('eq-tipo')?.value;
  const wrap = document.getElementById('eq-vocmax-wrap');
  if (wrap) wrap.style.display = tipo === 'inversor' ? '' : 'none';
};

// ¿Dónde existe ya este serial en el proyecto? → nombre de la ubicación o null
export function _serialUbicacion(p, serial) {
  const s = (serial || '').trim();
  if (!s) return null;
  const strings = p?.garantia?.paneles?.strings || [];
  for (let i = 0; i < strings.length; i++) {
    if ((strings[i].paneles || []).some(pan => pan.serial === s)) {
      return strings[i].nombre || `String ${i + 1}`;
    }
  }
  if ((p?.garantia?.equipos || []).some(eq => eq.serial === s)) return 'Equipos';
  return null;
}

window.scanSerial = function(projectId) {
  openScannerOverlay(
    async (code) => {
      const inp = document.getElementById('eq-serial');
      if (inp) { inp.value = code; inp.focus(); }
      const dup = projectId ? _serialUbicacion(await projects.getById(projectId), code) : null;
      if (dup) toast(`⚠ Este serial ya está registrado en ${dup}`, 'warning', 4000);
      else toast(`✅ Serial escaneado: ${code}`);
    },
    { continuous: false, title: 'Escanear serial del equipo' }
  );
};

window.showFormEquipo = function(projectId) {
  const form = document.getElementById('form-equipo');
  form.innerHTML = formEquipo(projectId); // siempre limpio al abrir
  _clearEqFotos();
  form.style.display = 'block';
  form.scrollIntoView({ behavior:'smooth' });
};

// Abre el form pre-llenado desde una fila del Kit de obra (Checklist) — cierra
// el hilo diseño/compra → instalado al vincular el equipo con su número de serie.
window.showFormEquipoFromKit = function(projectId, kitId, nombre) {
  const form = document.getElementById('form-equipo');
  form.innerHTML = formEquipo(projectId, null, -1, { kitId, nombre });
  _clearEqFotos();
  form.style.display = 'block';
  form.scrollIntoView({ behavior:'smooth' });
};

window.editarEquipo = async function(projectId, idx) {
  const p = await projects.getById(projectId);
  const eq = p.garantia.equipos[idx];
  if (!eq) return;
  // Pre-cargar fotos existentes en _eqFotos para que guardarEquipo las conserve
  _clearEqFotos();
  if (eq.fotoPlaca)   _eqFotos.placa   = eq.fotoPlaca;
  if (eq.fotoFrontal) _eqFotos.frontal = eq.fotoFrontal;
  if (eq.fotoAngulo)  _eqFotos.angulo  = eq.fotoAngulo;

  const form = document.getElementById('form-equipo');
  form.innerHTML = formEquipo(projectId, eq, idx);
  form.style.display = 'block';
  form.scrollIntoView({ behavior:'smooth' });
};

window._cancelarFormEquipo = function() {
  const form = document.getElementById('form-equipo');
  form.style.display = 'none';
  _clearEqFotos();
};

window.guardarEquipo = async function(projectId) {
  const tipo   = document.getElementById('eq-tipo').value;
  const marca  = document.getElementById('eq-marca').value;
  const modelo = document.getElementById('eq-modelo').value.trim();
  if (!tipo)   { toast('Selecciona el tipo de equipo', 'error'); return; }
  if (!modelo) { toast('El modelo es requerido', 'error'); return; }

  const editIdx = parseInt(document.getElementById('eq-editing-idx')?.value ?? '-1');
  const isEdit  = editIdx >= 0;

  const p = await projects.getById(projectId);
  p.garantia = p.garantia || {};
  p.garantia.equipos = p.garantia.equipos || [];

  const vocMaxRaw = document.getElementById('eq-vocmax')?.value?.trim();
  const equipo = {
    id:          isEdit ? (p.garantia.equipos[editIdx]?.id || uuid()) : uuid(),
    tipo, marca, modelo,
    ...(tipo === 'inversor' && vocMaxRaw ? { vocMax: parseFloat(vocMaxRaw) } : {}),
    serial:      document.getElementById('eq-serial').value.trim(),
    fotoPlaca:   _eqFotos.placa   || (isEdit ? p.garantia.equipos[editIdx]?.fotoPlaca   : null),
    fotoFrontal: _eqFotos.frontal || (isEdit ? p.garantia.equipos[editIdx]?.fotoFrontal : null),
    fotoAngulo:  _eqFotos.angulo  || (isEdit ? p.garantia.equipos[editIdx]?.fotoAngulo  : null),
    notas:       document.getElementById('eq-notas').value.trim(),
    createdAt:   isEdit ? (p.garantia.equipos[editIdx]?.createdAt || isoNow()) : isoNow(),
    updatedAt:   isoNow(),
  };

  let newEquipos;
  if (isEdit) {
    newEquipos = [...p.garantia.equipos];
    newEquipos[editIdx] = equipo;
    toast('✅ Equipo actualizado');
  } else {
    newEquipos = [...p.garantia.equipos, equipo];
    toast('✅ Equipo registrado');
  }

  // setField en lugar de update() — escribe solo garantia.equipos, no el doc completo
  await projects.setField(projectId, 'garantia.equipos', newEquipos);

  // Si viene del Kit de obra, vincula el item del kit con el equipo ya instalado
  const kitId = document.getElementById('eq-kit-id')?.value;
  if (kitId) {
    await projects.setField(projectId, `checklistData.kitEquipo.${kitId}.garantiaEquipoId`, equipo.id);
  }

  // Reparchar items de cola con el projectId real y el ID del equipo,
  // para que processQueue pueda actualizar el campo correcto al reconectar
  const _fotoCampos = [['placa','fotoPlaca'], ['frontal','fotoFrontal'], ['angulo','fotoAngulo']];
  for (const [tipo, campo] of _fotoCampos) {
    const fotoMem = _eqFotos[tipo];
    if (fotoMem && typeof fotoMem === 'object' && fotoMem.pending && fotoMem.pendingId) {
      await updateQueueItem(fotoMem.pendingId, {
        projectId,
        storagePath: `projects/${projectId}/equipo_${tipo}_${fotoMem.pendingId}.jpg`,
        op: 'eqFoto',
        opArgs: { eqId: equipo.id, campo },
      });
    }
  }

  const _eqSession = await getSession();
  logChange(projectId, {
    modulo: 'Garantía',
    accion: isEdit ? 'equipo editado' : 'equipo agregado',
    detalle: `${equipo.tipo}: ${equipo.marca} ${equipo.modelo}`,
    quien: _eqSession,
  });
  _clearEqFotos();
  sessionStorage.setItem('garantia-tab-target', 'g-equipos');
  navigate(`#proyecto/${projectId}/garantia`);
};

window.delEquipo = async function(projectId, idx) {
  if (!await confirmDialog('¿Eliminar este equipo?')) return;
  const p = await projects.getById(projectId);
  const newEquipos = (p.garantia?.equipos || []).filter((_,i) => i !== idx);
  await projects.setField(projectId, 'garantia.equipos', newEquipos);
  sessionStorage.setItem('garantia-tab-target', 'g-equipos');
  navigate(`#proyecto/${projectId}/garantia`);
};
