// gar-equipos.js — Equipos instalados: form, CRUD, scanner de serial
// Extraído de garantia.js. Exporta renderEquipos, formEquipo, _clearEqFotos, _serialUbicacion.

import { projects, logChange } from './db.js';
import { esc, fotoMini, capturePhoto, toast, confirmDialog, inputDialog, uuid, isoNow,
         fmtFechaHora, MARCAS_EQUIPOS, TIPOS_SISTEMA, openScannerOverlay } from './utils.js';
import { getSession } from './auth.js';
import { uploadPhotoQueued, buildFotoPath } from './firebase.js';
import { updateQueueItem } from './photo-queue.js';
import { icon } from './icons.js';
import { getSerialesFlat } from './gar-paneles.js';

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

// ── Equipos sugeridos según tipo de sistema ────────────────────────────────────
// Pre-crea placeholders con el `tipo` correcto para que el técnico solo capture
// marca/modelo/serial sin elegir tipo. NO se escribe en Firestore al ver la
// pantalla — se ofrece como banner de un toque (evita sorpresas en proyectos que
// legítimamente no llevan equipos y writes al solo abrir en modo lectura).
const _EQUIPOS_POR_SISTEMA = {
  interconectado:   ['inversor'],
  hibrido_respaldo: ['inversor', 'bateria'],
  hibrido:          ['inversor', 'bateria'],
  respaldo:         ['inversor', 'bateria'],
  aislado:          ['inversor', 'bateria', 'controladora'],
  bombeo:           ['inversor'],
  sistema_pequeno:  ['controladora', 'bateria', 'inversor'],
};
const _TIPO_LABEL_EQ = {
  inversor: 'Inversor', bateria: 'Batería', controladora: 'Controladora / MPPT',
};

// Separa un texto libre ("Victron Phoenix 800VA") en {marca, modelo} best-effort:
// marca = primera de MARCAS_EQUIPOS contenida en el texto (o ''), modelo = texto completo.
function _parseEquipoTexto(texto) {
  const t = (texto || '').trim();
  if (!t) return { marca: '', modelo: '' };
  const marca = MARCAS_EQUIPOS.find(m => m !== 'Otra marca' && t.toLowerCase().includes(m.toLowerCase().split(' ')[0]));
  return { marca: marca || '', modelo: t };
}

// Devuelve los tipos esperados que aún NO existen en garantia.equipos, con
// marca/modelo sembrados desde el levantamiento cuando hay texto libre (sistema pequeño).
export function equiposSugeridosFaltantes(project) {
  const tipos = _EQUIPOS_POR_SISTEMA[project.tipoSistema];
  if (!tipos) return [];
  const existentes = new Set((project.garantia?.equipos || []).map(e => e.tipo));
  const lev = project.documentacion?.levantamiento || {};
  const semilla = {
    inversor:     _parseEquipoTexto(lev.inversor),
    bateria:      _parseEquipoTexto(lev.bateria),
    controladora: _parseEquipoTexto(lev.mppt),
  };
  return tipos
    .filter(tipo => !existentes.has(tipo))
    // sistema_pequeno: el inversor es opcional — solo sugerirlo si hay texto libre
    .filter(tipo => !(project.tipoSistema === 'sistema_pequeno' && tipo === 'inversor' && !(lev.inversor || '').trim()))
    .map(tipo => ({ tipo, marca: semilla[tipo]?.marca || '', modelo: semilla[tipo]?.modelo || '' }));
}

export function renderEquiposSugeridos(project, projectId, edit) {
  if (!edit) return '';
  const faltantes = equiposSugeridosFaltantes(project);
  if (!faltantes.length) return '';
  const lista = faltantes.map(f => _TIPO_LABEL_EQ[f.tipo] || f.tipo).join(', ');
  return `
  <div class="card calc-info-banner" style="margin-bottom:12px">
    <p style="margin:0 0 8px;font-size:.85rem">⚡ Equipos sugeridos para <b>${esc(TIPOS_SISTEMA[project.tipoSistema]?.label || project.tipoSistema)}</b>: ${esc(lista)}.<br>
    <span class="form-hint">Se crean con el tipo listo — solo capturas marca/modelo y escaneas el serial en campo.</span></p>
    <button class="btn-outline btn-sm" onclick="crearEquiposSugeridos('${projectId}')">+ Crear equipos sugeridos (${faltantes.length})</button>
  </div>`;
}

window.crearEquiposSugeridos = async function(projectId) {
  let p;
  try { p = await projects.getById(projectId); }
  catch { toast('No se pudo cargar el proyecto — revisa tu conexión', 'error'); return; }
  const faltantes = equiposSugeridosFaltantes(p);
  if (!faltantes.length) { toast('No hay equipos por sugerir', 'info'); return; }
  const nuevos = faltantes.map(f => ({
    id: uuid(), tipo: f.tipo, marca: f.marca, modelo: f.modelo, serial: '',
    fotoPlaca: null, fotoFrontal: null, fotoAngulo: null, notas: '',
    historialReemplazos: [], createdAt: isoNow(), updatedAt: isoNow(),
  }));
  const newEquipos = [...(p.garantia?.equipos || []), ...nuevos];
  try {
    await projects.setField(projectId, 'garantia.equipos', newEquipos);
    logChange(projectId, {
      modulo: 'Garantía', accion: 'equipos sugeridos creados',
      detalle: nuevos.map(e => e.tipo).join(', '), quien: await getSession(),
    });
  } catch (err) {
    console.error('crearEquiposSugeridos error:', err);
    toast('⚠ No se pudieron crear los equipos — revisa tu conexión', 'error', 5000);
    return;
  }
  toast(`✅ ${nuevos.length} equipo${nuevos.length > 1 ? 's' : ''} creado${nuevos.length > 1 ? 's' : ''} — captura marca/modelo y serial`);
  sessionStorage.setItem('garantia-tab-target', 'g-equipos');
  navigate(`#proyecto/${projectId}/garantia`);
};

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
          ${edit ? `<button class="btn-icon-sm" onclick="editarEquipo('${projectId}',${i})" aria-label="Editar equipo" title="Editar equipo">✎</button>` : ''}
          ${admin ? `<button class="btn-del-sm" onclick="delEquipo('${projectId}',${i})" aria-label="Eliminar equipo" title="Eliminar equipo">✕</button>` : ''}
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
      ${edit ? `<div class="eq-reemplazo-row">
        <button class="btn-outline btn-sm" onclick="reportarReemplazo('${projectId}',${i})">🔄 Reportar reemplazo</button>
        ${(eq.historialReemplazos||[]).length ? `<button class="btn-link-sm" onclick="toggleHistorialReemplazo(${i})">Ver historial (${eq.historialReemplazos.length})</button>` : ''}
      </div>` : ''}
      ${(eq.historialReemplazos||[]).length ? `
      <div class="eq-historial" id="eq-historial-${i}" style="display:none">
        ${eq.historialReemplazos.slice().reverse().map(h => `
          <div class="eq-historial-item">
            <span class="eq-historial-fecha">${esc(fmtFechaHora(h.fecha))}</span>
            <span class="eq-historial-cambio">${esc(h.serialAnterior||'—')} → ${esc(h.serialNuevo||'—')}</span>
            ${h.motivo ? `<span class="eq-historial-motivo">${esc(h.motivo)}</span>` : ''}
            <span class="eq-historial-por">${esc(h.por||'')}</span>
          </div>`).join('')}
      </div>` : ''}
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
          <option value="" ${(isEdit ? eq.marca : '') ? '' : 'selected'}>— Seleccionar marca —</option>
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
    <!-- vocMax / potenciaNominalAC: solo para inversores -->
    <div class="form-row" id="eq-vocmax-wrap" style="${(isEdit ? eq.tipo : '') === 'inversor' ? '' : 'display:none'}">
      <div class="form-group">
        <label>Voc máx. entrada CD (V) <span class="form-hint">Del datasheet del inversor</span></label>
        <input type="number" id="eq-vocmax" placeholder="Ej: 600" step="1" min="0"
               value="${isEdit ? esc(eq.vocMax || '') : ''}" />
      </div>
      <div class="form-group">
        <label>Potencia nominal CA (kW) <span class="form-hint">Para chequeo de sobresaturación DC/AC</span></label>
        <input type="number" id="eq-potencia-ac" placeholder="Ej: 5" step="0.1" min="0"
               value="${isEdit ? esc(eq.potenciaNominalAC || '') : ''}" />
      </div>
    </div>
    <!-- capacidadKwh: solo para baterías -->
    <div class="form-row" id="eq-bateria-wrap" style="${(isEdit ? eq.tipo : '') === 'bateria' ? '' : 'display:none'}">
      <div class="form-group">
        <label>Capacidad (kWh) <span class="form-hint">Del datasheet de la batería</span></label>
        <input type="number" id="eq-bateria-kwh" placeholder="Ej: 5.12" step="0.01" min="0"
               value="${isEdit ? esc(eq.capacidadKwh || '') : ''}" />
      </div>
    </div>
    <div class="form-group">
      <label>Número de serie</label>
      <div class="serial-row">
        <input type="text" id="eq-serial" placeholder="Escribe o escanea el serial"
               value="${isEdit ? esc(eq.serial || '') : ''}" />
        <button type="button" class="btn-icon" onclick="scanSerial('${projectId}')" aria-label="Escanear serial con cámara" title="Escanear con cámara">
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
    const result = await uploadPhotoQueued(b64, buildFotoPath('equipo_temp', `equipo_${tipo}_${fid}.jpg`),
      'equipo_temp', 'eqFoto', { tipo });
    _eqFotos[tipo] = result.url || (result.pending ? { pending: true, pendingId: result.pendingId } : null);
    const slot = document.getElementById(slotId);
    if (slot) slot.innerHTML = fotoMini(_eqFotos[tipo], tipo);
    if (result.url) toast('✅ Foto guardada');
  }, { preview: true });
};

// Mostrar/ocultar campo vocMax según tipo de equipo seleccionado
window.toggleVocMaxField = function() {
  const tipo = document.getElementById('eq-tipo')?.value;
  const wrap = document.getElementById('eq-vocmax-wrap');
  if (wrap) wrap.style.display = tipo === 'inversor' ? '' : 'none';
  const batWrap = document.getElementById('eq-bateria-wrap');
  if (batWrap) batWrap.style.display = tipo === 'bateria' ? '' : 'none';
};

// ¿Dónde existe ya este serial en el proyecto? → nombre de la ubicación o null
export function _serialUbicacion(p, serial) {
  const s = (serial || '').trim();
  if (!s) return null;
  if (getSerialesFlat(p?.garantia).some(pan => pan.serial === s)) return 'Paneles';
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
  // Un solo toque → cámara: abre el escáner de serial de inmediato
  setTimeout(() => scanSerial(projectId), 300);
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
  if (!marca)  { toast('Selecciona la marca del equipo', 'error'); return; }
  if (!modelo) { toast('El modelo es requerido', 'error'); return; }

  const editIdx = parseInt(document.getElementById('eq-editing-idx')?.value ?? '-1');
  const isEdit  = editIdx >= 0;

  let p;
  try {
    p = await projects.getById(projectId);
  } catch (err) {
    console.error('guardarEquipo error:', err);
    toast('No se pudo cargar el proyecto — revisa tu conexión e intenta de nuevo', 'error');
    return;
  }
  p.garantia = p.garantia || {};
  p.garantia.equipos = p.garantia.equipos || [];

  const vocMaxRaw      = document.getElementById('eq-vocmax')?.value?.trim();
  const potenciaAcRaw  = document.getElementById('eq-potencia-ac')?.value?.trim();
  const bateriaKwhRaw  = document.getElementById('eq-bateria-kwh')?.value?.trim();
  const equipo = {
    id:          isEdit ? (p.garantia.equipos[editIdx]?.id || uuid()) : uuid(),
    tipo, marca, modelo,
    ...(tipo === 'inversor' && vocMaxRaw     ? { vocMax: parseFloat(vocMaxRaw) } : {}),
    ...(tipo === 'inversor' && potenciaAcRaw ? { potenciaNominalAC: parseFloat(potenciaAcRaw) } : {}),
    ...(tipo === 'bateria'  && bateriaKwhRaw ? { capacidadKwh: parseFloat(bateriaKwhRaw) } : {}),
    serial:      document.getElementById('eq-serial').value.trim(),
    fotoPlaca:   _eqFotos.placa   || (isEdit ? p.garantia.equipos[editIdx]?.fotoPlaca   : null),
    fotoFrontal: _eqFotos.frontal || (isEdit ? p.garantia.equipos[editIdx]?.fotoFrontal : null),
    fotoAngulo:  _eqFotos.angulo  || (isEdit ? p.garantia.equipos[editIdx]?.fotoAngulo  : null),
    notas:       document.getElementById('eq-notas').value.trim(),
    historialReemplazos: isEdit ? (p.garantia.equipos[editIdx]?.historialReemplazos || []) : [],
    createdAt:   isEdit ? (p.garantia.equipos[editIdx]?.createdAt || isoNow()) : isoNow(),
    updatedAt:   isoNow(),
  };

  let newEquipos;
  if (isEdit) {
    newEquipos = [...p.garantia.equipos];
    newEquipos[editIdx] = equipo;
  } else {
    newEquipos = [...p.garantia.equipos, equipo];
  }

  try {
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
          storagePath: buildFotoPath(projectId, `equipo_${tipo}_${fotoMem.pendingId}.jpg`),
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
  } catch (err) {
    console.error('guardarEquipo error:', err);
    toast('⚠ No se pudo guardar el equipo — revisa tu conexión e intenta de nuevo', 'error', 5000);
    return;
  }

  toast(isEdit ? '✅ Equipo actualizado' : '✅ Equipo registrado');
  _clearEqFotos();
  sessionStorage.setItem('garantia-tab-target', 'g-equipos');
  navigate(`#proyecto/${projectId}/garantia`);
};

window.toggleHistorialReemplazo = function(idx) {
  const el = document.getElementById(`eq-historial-${idx}`);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
};

window.reportarReemplazo = function(projectId, idx) {
  openScannerOverlay(
    async (code) => {
      const motivo = await inputDialog('Motivo del reemplazo', 'Ej: falla en campo, daño en tránsito…');
      if (motivo === null) return; // cancelado
      const p = await projects.getById(projectId);
      const eq = p.garantia?.equipos?.[idx];
      if (!eq) return;
      const serialAnterior = eq.serial || '';
      const quien = await getSession();
      const entrada = { serialAnterior, serialNuevo: code, motivo: motivo.trim(), fecha: isoNow(), por: quien?.nombre || quien?.email || '—' };
      const historial = [...(eq.historialReemplazos || []), entrada];
      const newEquipos = [...p.garantia.equipos];
      newEquipos[idx] = { ...eq, serial: code, historialReemplazos: historial, updatedAt: isoNow() };
      await projects.setField(projectId, 'garantia.equipos', newEquipos);
      logChange(projectId, {
        modulo: 'Garantía', accion: 'equipo reemplazado',
        detalle: `${eq.tipo}: ${serialAnterior || '—'} → ${code}`,
        quien,
      });
      toast('✅ Reemplazo registrado');
      navigate(`#proyecto/${projectId}/garantia`);
    },
    { continuous: false, title: 'Escanear nuevo serial' }
  );
};

window.delEquipo = async function(projectId, idx) {
  if (!await confirmDialog('¿Eliminar este equipo?')) return;
  const p = await projects.getById(projectId);
  const equipo = p.garantia?.equipos?.[idx];
  const newEquipos = (p.garantia?.equipos || []).filter((_,i) => i !== idx);
  await projects.setField(projectId, 'garantia.equipos', newEquipos);

  // Si el equipo venía del Kit de obra, desvincula la fila para que vuelva a
  // mostrar "→ Registrar" en vez de un "✓ Instalado" apuntando a nada.
  if (equipo) {
    const kitMap = p.checklistData?.kitEquipo || {};
    const orphanId = Object.keys(kitMap).find(kid => kitMap[kid]?.garantiaEquipoId === equipo.id);
    if (orphanId) {
      await projects.setField(projectId, `checklistData.kitEquipo.${orphanId}.garantiaEquipoId`, null);
    }
    logChange(projectId, {
      modulo: 'Garantía', accion: 'equipo eliminado',
      detalle: `${equipo.tipo}: ${equipo.marca} ${equipo.modelo}`,
      quien: await getSession(),
    });
  }

  sessionStorage.setItem('garantia-tab-target', 'g-equipos');
  navigate(`#proyecto/${projectId}/garantia`);
};
