// lev-guardar.js — Guardar levantamiento, autosave y handlers de fotos
// Extraído de documentacion.js — accede a window._lev (expuesto por documentacion.js)

import { projects, logChange } from './db.js';
import { toast, isoNow, genDisplayId, capturePhoto, uuid, uploadProgressBar, confirmDialog } from './utils.js';
import { getSession } from './auth.js';
import { calcVocPuro } from './garantia.js';
import { uploadPhotoQueued } from './firebase.js';
import { _sujecionPorTecho } from './lev-areas.js';

// ── Guardar levantamiento ─────────────────────────────────────────────────────
window.guardarLevantamiento = async function(e, projectId) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const p  = await projects.getById(projectId);
  const lev = p.documentacion?.levantamiento || {};
  const tipo = p.tipoSistema;

  const sombrasChecklist = Array.from(e.target.querySelectorAll('[name^="sombra_"]:checked')).map(cb=>cb.value);
  const condiciones = Array.from(e.target.querySelectorAll('[name^="cond_"]:checked')).map(cb=>cb.value);
  const modoConsumo = e.target.dataset.modoConsumo || (lev.modoConsumo||'recibo');

  const tipTechoVal = fd.get('tipTecho');
  // Áreas: leer del state en memoria (ya actualizadas vía _updateAreaTecho)
  const areasTechoVal = window._lev.areasTecho
    .filter(a => a.nombre || a.ancho || a.largo)
    .map(a => ({
      nombre:             a.nombre || `Área ${window._lev.areasTecho.indexOf(a)+1}`,
      tipTecho:           a.tipTecho || null, // null = usa el tipo de techo general del sitio
      ancho:              a.ancho  || null,
      largo:              a.largo  || null,
      area:               (a.ancho && a.largo) ? parseFloat((a.ancho*a.largo).toFixed(2)) : null,
      orientacion:        a.orientacion || null,
      pisos:              a.pisos || null,
      inclinacion:        a.inclinacion || null,
      distTableroInversor: a.distTableroInversor || null,
      distInversorPaneles: a.distInversorPaneles || null,
      fotos:              Array.isArray(a.fotos) ? a.fotos : [],
    }));
  const areaTotal = areasTechoVal.reduce((s,a)=>s+(a.area||0), 0) || null;

  const newLev = {
    ...lev,
    estadoInmueble:      fd.get('estadoInmueble') || null,
    tipTecho:            tipTechoVal,
    tipoSujecion:        _sujecionPorTecho(tipTechoVal),  // auto, no editable
    areasTecho:          areasTechoVal,
    areaDisponible:      areaTotal ? parseFloat(areaTotal.toFixed(2)) : (lev.areaDisponible || null),
    estadoMadera:        tipTechoVal === 'Madera' ? (fd.get('estadoMadera') || null) : null,
    distVigas:           tipTechoVal === 'Madera' ? (parseFloat(fd.get('distVigas')) || null) : null,
    tMin:                parseFloat(fd.get('tMin')) ?? 3,
    tMinCiudad:          fd.get('tMinCiudad') || null,
    tMinZona:            fd.get('tMinZona') || 'valle',
    tipoServicioCFE:     fd.get('tipoServicioCFE'),
    tierraFisica:        fd.get('tierraFisica'),
    centroCarga:         fd.get('centroCarga'),
    voltajeFaseFase:     parseFloat(fd.get('voltajeFaseFase'))   || null,
    voltajeFaseNeutro:   parseFloat(fd.get('voltajeFaseNeutro')) || null,
    voltajeFaseTierra:   parseFloat(fd.get('voltajeFaseTierra')) || null,
    tipoTablero:         fd.get('tipoTablero')      || null,
    marcaTablero:        fd.get('marcaTablero')     || null,
    capacidadTablero:    fd.get('capacidadTablero') || null,
    capacidadInterruptorPrincipal: parseFloat(fd.get('capacidadInterruptorPrincipal')) || null,
    capacidadBarrasTablero:        parseFloat(fd.get('capacidadBarrasTablero'))        || null,
    gpsLat:              lev.gpsLat  ?? null,
    gpsLng:              lev.gpsLng  ?? null,
    sombras:             { checklist:sombrasChecklist, foto:lev.sombras?.foto||null, notas:fd.get('sombraNotas')||'' },
    condicionesAmbientales: condiciones,
    fotosLevantamiento:  lev.fotosLevantamiento || [],
    observacionesGenerales: fd.get('observacionesGenerales') || '',
    restricciones:          fd.get('restricciones') || '',
    horarioUso:             fd.get('horarioUso') || null,
    accesoTecho:             fd.get('accesoTecho')             || null,
    almacenamientoTemporal:  fd.get('almacenamientoTemporal')  || null,
    conectividadInversor:    fd.get('conectividadInversor')    || null,
    logisticaNotas:          fd.get('logisticaNotas')           || '',
  };

  if (tipo==='interconectado'||tipo==='hibrido'||tipo==='hibrido_respaldo') {
    newLev.nisServicio    = fd.get('nisServicio')    || null;
    newLev.rpu            = fd.get('rpu')            || null;
    newLev.titularServicio= fd.get('titularServicio') || null;
    newLev.tarifaCFE      = fd.get('tarifaCFE');
    newLev.demandaKW      = parseFloat(fd.get('demandaKW')) || null;
    newLev.factorPotencia = parseFloat(fd.get('factorPotencia')) || null;
    newLev.modoConsumo = modoConsumo;
    newLev.recibos     = modoConsumo==='recibo' ? window._lev.recibos : [];
    newLev.aparatos    = modoConsumo==='aparatos' ? window._lev.aparatos : [];
    // cargasCriticas/cargasSecundarias se renderizan para los 3 tipos (la de
    // interconectado es opcional, por si lleva batería de respaldo) — antes
    // solo se guardaban para 'aislado' y se perdían en silencio aquí.
    newLev.cargasCriticas    = window._lev.cargas.critica;
    newLev.cargasSecundarias = window._lev.cargas.secundaria;
    if (tipo==='hibrido'||tipo==='hibrido_respaldo') {
      newLev.autonomia     = parseFloat(fd.get('autonomia'))||null;
      newLev.bancoBaterias = parseFloat(fd.get('bancoBaterias'))||null;
    }
  }
  if (tipo==='aislado') {
    newLev.autonomia=parseFloat(fd.get('autonomia'))||null;
    newLev.cargasCriticas   = window._lev.cargas.critica;
    newLev.cargasSecundarias= window._lev.cargas.secundaria;
    newLev.generador       = fd.get('generador')==='no'?null:fd.get('generador');
    newLev.generadorArranque= fd.get('generadorArranque');
    newLev.generadorKw     = fd.get('generadorKw') || null;
    newLev.crecimientoFuturo= fd.get('crecimientoFuturo')||'';
  }
  if (tipo==='bombeo') {
    newLev.tipoBomba       = fd.get('tipoBomba');
    newLev.caudal          = parseFloat(fd.get('caudal'))||null;
    newLev.profundidadPozo = parseFloat(fd.get('profundidadPozo'))||null;
    newLev.horasBombeo     = parseFloat(fd.get('horasBombeo'))||null;
  }
  if (tipo==='respaldo') { // legacy
    newLev.tiempoRespaldo  = parseFloat(fd.get('tiempoRespaldo'))||null;
    newLev.cargasRespaldo  = window._lev.cargas.critica;
  }
  if (tipo==='sistema_pequeno') {
    newLev.voltajeSistemaDC      = fd.get('voltajeSistemaDC')      || null;
    newLev.tipoControlador       = fd.get('tipoControlador')       || null;
    newLev.arregloPaneles        = fd.get('arregloPaneles')        || null;
    newLev.arregloBaterias       = fd.get('arregloBaterias')       || null;
    newLev.alimentacionRefrigerador = fd.get('alimentacionRefrigerador') || null;
    newLev.distPanelRefrigerador = parseFloat(fd.get('distPanelRefrigerador')) || null;
    newLev.calibreCableDC        = fd.get('calibreCableDC')        || null;
    newLev.exposicionTempExtrema = fd.get('exposicionTempExtrema') || null;
    // Potencia/modelo de inversor solo tienen sentido si el refrigerador es CA
    const _esInversorBateria = fd.get('alimentacionRefrigerador') === 'inversor_bateria';
    newLev.potenciaInversorW = _esInversorBateria ? (parseFloat(fd.get('potenciaInversorW')) || null) : null;
    newLev.inversor          = _esInversorBateria ? (fd.get('inversor')?.trim() || null) : null;
    newLev.bateria        = fd.get('bateria')?.trim()        || null;
    newLev.breakerBateria = fd.get('breakerBateria')?.trim() || null;
    newLev.mppt           = fd.get('mppt')?.trim()          || null;
    newLev.breakerPanel   = fd.get('breakerPanel')?.trim()  || null;
    newLev.breakerPolo    = fd.get('breakerPolo')?.trim()   || null;
  }

  p.documentacion = p.documentacion || {};
  p.documentacion.levantamiento = newLev;

  const rootUpdate = { documentacion: p.documentacion };
  const newClientName = fd.get('lev_clientName')?.trim();
  const newNombreProyecto = fd.get('lev_nombreProyecto')?.trim() || null;
  if (newClientName && newClientName !== p.clientName) {
    rootUpdate.clientName = newClientName;
    // Regenerar displayId para que la "carpeta" refleje el nombre actual
    const all = await projects.getAll();
    const otherIds = all.filter(x => x.id !== projectId).map(x => x.displayId).filter(Boolean);
    rootUpdate.displayId = genDisplayId(newClientName, p.createdAt, p.tipoSistema, otherIds);
  }
  if (newNombreProyecto !== (p.nombreProyecto || null)) rootUpdate.nombreProyecto = newNombreProyecto;
  await projects.update(projectId, rootUpdate);
  // Actualizar indicador de auto-guardado
  const ind = document.getElementById('lev-autosave');
  if (ind) { ind.textContent = '✓ Guardado'; ind.className = 'autosave-indicator saved'; }
  if (!e._auto) {
    toast('✅ Levantamiento guardado');
    logChange(projectId, { modulo: 'Documentación', accion: 'levantamiento guardado', detalle: '', quien: await getSession() });
    // Aviso no-bloqueante de campos marcados CRÍTICO que quedaron vacíos —
    // se guarda igual (a veces el dato no está disponible aún en campo),
    // pero se le avisa al técnico para que no se le pierda sin darse cuenta.
    if (tipo === 'aislado') {
      const faltantes = [];
      if (!newLev.autonomia)       faltantes.push('Autonomía requerida');
      if (!newLev.crecimientoFuturo) faltantes.push('Crecimiento futuro esperado');
      if (faltantes.length) {
        toast(`⚠ Faltan campos críticos: ${faltantes.join(', ')}`, 'error', 6000);
      }
    }
    // Auto-carry Tmin → Voc si el valor cambió
    _autoRecalcVocSilent(projectId, newLev.tMin, newLev.tMinZona);
  }
};

// ── Auto-carry Tmin → Voc ─────────────────────────────────────────────────────
// Después de guardar el levantamiento, recalcula Voc silenciosamente si todos
// los datos están disponibles Y el tMin realmente cambió respecto al último cálculo.
async function _autoRecalcVocSilent(projectId, newTMin, newTMinZona) {
  if (newTMin == null) return;
  try {
    const p       = await projects.getById(projectId);
    const g       = p?.garantia || {};
    const vd      = g.validacionVoc || {};

    // Solo recalcular si el tMin cambió respecto al guardado anterior
    if (vd.tMin != null && Math.abs(vd.tMin - newTMin) < 0.001 && vd.tMinZona === (newTMinZona || 'valle')) return;

    // Ingredientes para el cálculo
    const vocPanel     = g.paneles?.voc || null;
    const inversor     = (g.equipos || []).find(e => e.tipo === 'inversor');
    const vocMax       = inversor?.vocMax || null;
    const strings      = g.paneles?.strings || [];
    const maxPorString = strings.length > 0 ? Math.max(...strings.map(s => s.paneles?.length || 0)) : null;
    const panelesSerie = maxPorString || p.projectConfig?.layout?.totalPanels || null;

    if (!vocPanel || !vocMax || !panelesSerie) return; // datos insuficientes — silencio

    const result = calcVocPuro({ vocPanel, panelesSerie, vocMaxInversor: vocMax, tMin: newTMin });
    if (!result) return;

    await projects.setField(projectId, 'garantia.validacionVoc', {
      ...result,
      tMin:          newTMin,
      tMinZona:      newTMinZona || 'valle',
      vocPanel,
      panelesSerie,
      vocMaxInversor: vocMax,
      savedAt:       isoNow(),
      savedBy:       'auto-tmin',
    });
    toast(`🌡 Voc recalculado (T mín = ${newTMin}°C)`, 'info', 3000);
  } catch (_) {
    // Error silencioso — no interrumpir el flujo del usuario
  }
}

// Auto-guardado con debounce 3 segundos
let _levAutoSaveTimer = null;
window._levAutoSave = function(projectId) {
  const ind = document.getElementById('lev-autosave');
  if (ind) { ind.textContent = 'Guardando…'; ind.className = 'autosave-indicator saving'; }
  clearTimeout(_levAutoSaveTimer);
  _levAutoSaveTimer = setTimeout(() => {
    const form = document.getElementById('form-levantamiento');
    if (!form) return;
    const fakeEvent = new Event('submit');
    fakeEvent._auto = true;
    fakeEvent.preventDefault = () => {};
    fakeEvent.target = form;
    Promise.resolve(window.guardarLevantamiento(fakeEvent, projectId)).catch(() => {
      const ind = document.getElementById('lev-autosave');
      if (ind) { ind.textContent = '⚠ Error al guardar'; ind.className = 'autosave-indicator error'; }
    });
  }, 3000);
};

window.capSombraFoto = function(pid) {
  capturePhoto(async b64 => {
    toast('Subiendo foto de sombra…');
    const result = await uploadPhotoQueued(b64, `projects/${pid}/sombra.jpg`, pid, 'sombraFoto');
    const p = await projects.getById(pid);
    p.documentacion = p.documentacion || {};
    p.documentacion.levantamiento = p.documentacion.levantamiento || {};
    p.documentacion.levantamiento.sombras = p.documentacion.levantamiento.sombras || {};
    p.documentacion.levantamiento.sombras.foto = result.url
      || (result.pending ? { pending: true, pendingId: result.pendingId } : null);
    await projects.update(pid, { documentacion: p.documentacion });
    navigate(`#proyecto/${pid}/documentacion`);
  });
};
window.delSombraFoto = async function(pid) {
  const p = await projects.getById(pid);
  p.documentacion.levantamiento.sombras.foto = null;
  await projects.update(pid, { documentacion: p.documentacion });
  navigate(`#proyecto/${pid}/documentacion`);
};

window.capFotoMedidor = function(pid) {
  capturePhoto(async b64 => {
    toast('Subiendo foto del medidor…');
    const result = await uploadPhotoQueued(b64, `projects/${pid}/medidor.jpg`, pid, 'fotoMedidor');
    const p = await projects.getById(pid);
    p.documentacion = p.documentacion || {};
    p.documentacion.levantamiento = p.documentacion.levantamiento || {};
    p.documentacion.levantamiento.fotoMedidor = result.url
      || (result.pending ? { pending: true, pendingId: result.pendingId } : null);
    await projects.update(pid, { documentacion: p.documentacion });
    navigate(`#proyecto/${pid}/levantamiento`);
  });
};
window.delFotoMedidor = async function(pid) {
  const p = await projects.getById(pid);
  p.documentacion.levantamiento.fotoMedidor = null;
  await projects.update(pid, { documentacion: p.documentacion });
  navigate(`#proyecto/${pid}/levantamiento`);
};

// ── _calcAreaTecho: obsoleto — reemplazado por _calcAreaItem ─────────────────
window._calcAreaTecho = function() {}; // compat shim

// ── Sistema pequeño: mostrar/ocultar campos de inversor según topología ──────
// Solo aplica si el refrigerador es CA (vía inversor desde batería); si es DC
// directo desde la salida LOAD del controlador, no hay inversor en el circuito.
window._onAlimentacionRefrigeradorChange = function(sel) {
  const wrap = document.getElementById('inversor-peq-wrap');
  if (wrap) wrap.style.display = sel.value === 'inversor_bateria' ? '' : 'none';
};

// ── Ocultar "Voltajes medidos en sitio" si no hay CFE o está pendiente —
// no tiene sentido medir voltajes de un servicio que no existe todavía.
window._onTipoServicioCFEChange = function(sel) {
  const wrap = document.getElementById('voltajes-cfe-wrap');
  if (!wrap) return;
  const sinCFE = ['N/A (sin CFE)', 'Pendiente de conexión'].includes(sel.value);
  wrap.style.display = sinCFE ? 'none' : '';
};

// ── Fotos del levantamiento ───────────────────────────────────────────────────
window.capFotoLev = function(pid) {
  capturePhoto(async b64 => {
    toast('Subiendo foto del levantamiento…');
    const fid = uuid();
    const result = await uploadPhotoQueued(b64, `projects/${pid}/lev_${fid}.jpg`, pid, 'fotoLev', { itemId: fid });
    const p = await projects.getById(pid);
    p.documentacion = p.documentacion || {};
    p.documentacion.levantamiento = p.documentacion.levantamiento || {};
    const fotos = p.documentacion.levantamiento.fotosLevantamiento || [];
    fotos.push({
      url: result.url || null, id: fid, ts: isoNow(),
      ...(result.pending && { pending: true, pendingId: result.pendingId }),
    });
    p.documentacion.levantamiento.fotosLevantamiento = fotos;
    await projects.update(pid, { documentacion: p.documentacion });
    navigate(`#proyecto/${pid}/levantamiento`);
  });
};

window.delFotoLev = async function(pid, idx) {
  const p = await projects.getById(pid);
  const fotos = p.documentacion?.levantamiento?.fotosLevantamiento || [];
  fotos.splice(idx, 1);
  p.documentacion.levantamiento.fotosLevantamiento = fotos;
  await projects.update(pid, { documentacion: p.documentacion });
  navigate(`#proyecto/${pid}/levantamiento`);
};

// ── Fotos por área ─────────────────────────────────────────────────────────────
window.capFotoArea = function(pid, areaIdx) {
  capturePhoto(async (b64Array) => {
    const fotos = Array.isArray(b64Array) ? b64Array : [b64Array];
    const total = fotos.length;
    const p = await projects.getById(pid);
    const areas = p.documentacion?.levantamiento?.areasTecho || [];
    if (!areas[areaIdx]) { toast('Área no encontrada', 'error'); return; }
    areas[areaIdx].fotos = Array.isArray(areas[areaIdx].fotos) ? areas[areaIdx].fotos : [];
    const prog = uploadProgressBar(total);
    let subidas = 0, fallo = null;
    try {
      for (let i = 0; i < total; i++) {
        prog.update(i + 1);
        const fid = uuid();
        const result = await uploadPhotoQueued(fotos[i],
          `projects/${pid}/area${areaIdx}_${fid}.jpg`, pid, 'fotoArea',
          { areaIdx, itemId: fid });
        areas[areaIdx].fotos.push({
          url: result.url || null, id: fid, createdAt: isoNow(),
          ...(result.pending && { pending: true, pendingId: result.pendingId }),
        });
        if (window._lev.areasTecho[areaIdx]) {
          window._lev.areasTecho[areaIdx].fotos = [...areas[areaIdx].fotos];
        }
        subidas++;
      }
    } catch (err) {
      console.error('capFotoArea error:', err);
      fallo = err;
    } finally {
      prog.done();
    }
    p.documentacion.levantamiento.areasTecho = areas;
    await projects.update(pid, { documentacion: p.documentacion });
    if (fallo) {
      toast(`⚠ Se guardaron ${subidas} de ${total} foto${total>1?'s':''}. Revisa tu conexión e intenta de nuevo con las que faltan.`, 'error', 6000);
      navigate(`#proyecto/${pid}/levantamiento`);
      return;
    }
    navigate(`#proyecto/${pid}/levantamiento`);
    toast(`✅ ${total} foto${total > 1 ? 's' : ''} guardada${total > 1 ? 's' : ''}`);
  }, { multiple: true });
};

window.delFotoArea = async function(pid, areaIdx, fotoIdx) {
  if (!await confirmDialog('¿Eliminar esta foto?')) return;
  const p = await projects.getById(pid);
  const areas = p.documentacion?.levantamiento?.areasTecho || [];
  if (!Array.isArray(areas[areaIdx]?.fotos)) return;
  areas[areaIdx].fotos.splice(fotoIdx, 1);
  if (window._lev.areasTecho[areaIdx]?.fotos) window._lev.areasTecho[areaIdx].fotos.splice(fotoIdx, 1);
  p.documentacion.levantamiento.areasTecho = areas;
  await projects.update(pid, { documentacion: p.documentacion });
  navigate(`#proyecto/${pid}/levantamiento`);
};
