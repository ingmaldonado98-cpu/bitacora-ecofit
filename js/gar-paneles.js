// gar-paneles.js — Paneles: lista plana de seriales + carga masiva (oficina)
// Extraído de garantia.js. Exporta renderPaneles, getSerialesFlat.

import { projects, logChange } from './db.js';
import { esc, fotoMini, toast, confirmDialog, inputDialog, uuid, isoNow,
         openScannerOverlay, capturePhoto } from './utils.js';
import { getSession, isAdmin } from './auth.js';
import { uploadPhotoQueued } from './firebase.js';
import { icon } from './icons.js';
import { _serialUbicacion } from './gar-equipos.js';

// ── 1E Paneles — lista plana de seriales ─────────────────────────────────────
// Fotos temporales del arreglo (frontal/perfil) mientras se capturan
const _arregloFotos = {};

// Migración perezosa: proyectos viejos guardaron los seriales agrupados por
// "string" (garantia.paneles.strings[].paneles[]) — esto se quitó porque el
// usuario solo necesita la lista de seriales, sin agrupar. Esta función lee
// la lista plana nueva (garantia.paneles.seriales) o, si no existe, aplana
// los strings viejos al vuelo, sin migrar nada en Firestore.
export function getSerialesFlat(g) {
  return g?.paneles?.seriales ?? (g?.paneles?.strings || []).flatMap(s => s.paneles || []);
}

export function renderPaneles(paneles, projectId, edit, catalog = [], fuenteCalc = null, admin = false) {
  const seriales     = getSerialesFlat({ paneles });
  const totalPaneles = seriales.length;
  const totalKwp     = totalPaneles * ((paneles.wp||0)/1000);

  // Tarjeta de sugerencia desde calculadora (solo cuando edit y hay fuente y no hay datos)
  const sugerenciaCard = edit && fuenteCalc ? `
  <div class="panel-sugerencia-wrap">
    <div class="panel-sugerencia-card" onclick="usarFuentePanel('${esc(fuenteCalc.id)}')">
      <span style="font-size:1.3rem">☀️</span>
      <div class="psc-info">
        <span class="psc-label">${esc(fuenteCalc.label)}</span>
        <span class="psc-origen">${fuenteCalc.wp}W · Registrado en Calculadora</span>
      </div>
      <button class="btn-primary btn-sm">Usar estos datos</button>
    </div>
    <div class="panel-sugerencia-card psc-manual" onclick="document.getElementById('panel-form-campos').style.display=''">
      <span style="font-size:1.1rem">✏️</span>
      <span>Ingresar datos manualmente</span>
    </div>
  </div>
  <div id="panel-form-campos" style="display:none">` : '';

  const cierreSugerencia = edit && fuenteCalc ? `</div>` : '';

  return `
  <script>window._panelCatalogData = ${JSON.stringify(catalog).replace(/<\//g, '<\\/')};<\/script>
  <div class="card">
    <h3 class="card-title">Paneles solares</h3>
    ${sugerenciaCard}
    ${edit && catalog.length > 0 && !fuenteCalc ? `
    <div class="form-group" style="margin-bottom:14px">
      <label>Seleccionar del catálogo</label>
      <select id="panel-catalogo-sel" class="select-field" onchange="seleccionarPanelCatalogo(this)">
        <option value="">— Elige un modelo para rellenar automáticamente —</option>
        ${catalog.map(p => `<option value="${esc(p.id)}">${esc(p.label)} — ${p.wp}W</option>`).join('')}
      </select>
    </div>` : ''}
    <div class="form-row">
      <div class="form-group">
        <label>Marca</label>
        <input type="text" id="panel-marca" value="${esc(paneles.marca||'')}" placeholder="Ej: Jinko" ${!edit?'disabled':''} />
      </div>
      <div class="form-group">
        <label>Modelo</label>
        <input type="text" id="panel-modelo" value="${esc(paneles.modelo||'')}" placeholder="Ej: Tiger Neo" ${!edit?'disabled':''} />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Potencia (Wp)</label>
        <input type="number" id="panel-wp" value="${paneles.wp||''}" min="1" placeholder="Ej: 580" ${!edit?'disabled':''} />
      </div>
      <div class="form-group">
        <label>Voc — Voltaje circuito abierto (V)</label>
        <input type="number" id="panel-voc" value="${paneles.voc||''}" min="0" step="0.1" placeholder="Ej: 49.8"
               ${!edit?'disabled':''} oninput="syncVocFromPanel()" />
      </div>
      <div class="form-group">
        <label>Imp — Corriente punto máximo (A)</label>
        <input type="number" id="panel-imp" value="${paneles.imp||''}" min="0" step="0.01" placeholder="Ej: 13.95" ${!edit?'disabled':''} />
      </div>
    </div>
    ${!edit && (paneles.voc || paneles.imp) ? `
    <div class="panel-elec-vals">
      ${paneles.voc ? `<span class="pe-val">Voc <strong>${paneles.voc} V</strong></span>` : ''}
      ${paneles.imp ? `<span class="pe-val">Imp <strong>${paneles.imp} A</strong></span>` : ''}
    </div>` : ''}
    ${edit ? `<button class="btn-outline btn-sm" onclick="guardarInfoPanel('${projectId}')">Guardar info del panel</button>` : ''}
    ${cierreSugerencia}

    <div class="panel-stats">
      <span><strong>${totalPaneles}</strong> paneles registrados</span>
      <span><strong>${totalKwp.toFixed(2)}</strong> kWp instalado</span>
    </div>
  </div>

  ${edit ? renderCargaMasiva(projectId) : ''}

  ${renderEvidenciaArreglo(paneles, projectId, edit)}

  <div class="card-title-row">
    <h3 class="card-title">Seriales registrados (${seriales.length})</h3>
    ${edit ? `
    <div style="display:flex;gap:6px">
      <button class="btn-outline btn-sm" onclick="scanSerialPanel('${projectId}')">${icon('barcode', 14)} Escanear</button>
      <button class="btn-primary btn-sm" onclick="addSerialManual('${projectId}')">+ Serial</button>
    </div>` : ''}
  </div>

  <div class="panel-list" id="serial-list">
    ${seriales.map((pan,i) => `
      <div class="panel-row">
        <span class="panel-letra">${i+1}</span>
        <span class="panel-serial ${!pan.serial?'panel-serial-empty':''}">${esc(pan.serial||'— sin serial')}</span>
        ${fotoMini(pan.fotoRespaldo,'Foto código')}
        ${admin ? `<button class="btn-del-sm" onclick="delSerialPanel('${projectId}',${i})">✕</button>` : ''}
      </div>
    `).join('')}
  </div>
  `;
}

// ── Carga masiva de seriales (oficina) — reemplaza el escaneo individual en
// campo como flujo principal. El escaneo continuo/manual se conserva más
// abajo solo para correcciones puntuales después de esto.
function renderCargaMasiva(projectId) {
  return `
  <div class="card" id="carga-masiva-wrap">
    <div class="card-title-row">
      <h3 class="card-title">${icon('barcode', 16)} Carga masiva de seriales</h3>
    </div>
    <p class="form-hint" style="margin:0 0 10px">
      Pega la lista de seriales del packing list, o escanéalos uno tras otro en el cuadro.
    </p>
    <div class="form-group">
      <label>Seriales <span class="form-hint">uno por línea o separados por coma</span></label>
      <textarea id="cm-seriales" rows="6" class="textarea-field" placeholder="SN0001234&#10;SN0001235&#10;SN0001236…"
        oninput="actualizarContadorCargaMasiva()"></textarea>
    </div>
    <div class="form-row" style="align-items:center;gap:10px">
      <button type="button" class="btn-outline btn-sm" onclick="abrirEscanerCargaMasiva('${projectId}')">
        ${icon('barcode', 14)} Escanear consecutivo
      </button>
      <span id="cm-contador" class="cm-contador">0 seriales cargados</span>
    </div>
    <div class="form-actions" style="margin-top:10px">
      <button type="button" class="btn-primary btn-sm" onclick="distribuirSerialesMasivo('${projectId}')">
        Guardar seriales
      </button>
    </div>
  </div>`;
}

// Fotos obligatorias de doble ángulo del arreglo ya montado.
function renderEvidenciaArreglo(paneles, projectId, edit) {
  return `
  <div class="card">
    <h3 class="card-title">${icon('camera', 16)} Evidencia del arreglo <span class="form-hint">2 fotos obligatorias</span></h3>
    <div class="fotos-captura-row">
      <div class="foto-cap-slot" id="slot-arreglo-frontal">
        ${paneles.fotoArregloFrontal
          ? fotoMini(paneles.fotoArregloFrontal, 'Frontal')
          : (edit ? `<button class="btn-foto-sm" onclick="capFotoArreglo('${projectId}','frontal')">${icon('camera')} Foto frontal</button>` : '<span class="ft-empty">—</span>')}
      </div>
      <div class="foto-cap-slot" id="slot-arreglo-perfil">
        ${paneles.fotoArregloPerfil
          ? fotoMini(paneles.fotoArregloPerfil, 'Perfil')
          : (edit ? `<button class="btn-foto-sm" onclick="capFotoArreglo('${projectId}','perfil')">${icon('camera')} Foto de perfil</button>` : '<span class="ft-empty">—</span>')}
      </div>
    </div>
  </div>`;
}

window.guardarInfoPanel = async function(projectId) {
  const p = await projects.getById(projectId);
  p.garantia.paneles.marca  = document.getElementById('panel-marca').value.trim();
  p.garantia.paneles.modelo = document.getElementById('panel-modelo').value.trim();
  p.garantia.paneles.wp     = parseFloat(document.getElementById('panel-wp').value)  || 0;
  p.garantia.paneles.voc    = parseFloat(document.getElementById('panel-voc').value)  || null;
  p.garantia.paneles.imp    = parseFloat(document.getElementById('panel-imp').value)  || null;
  await projects.update(projectId, { garantia: p.garantia });
  logChange(projectId, { modulo: 'Garantía', accion: 'info de panel guardada', detalle: `${p.garantia.paneles.marca} ${p.garantia.paneles.modelo}`, quien: await getSession() });
  toast('✅ Info del panel guardada');
};

// ── Carga masiva — parseo, contador, escáner y distribución ──────────────────
function _parseSerialesTextarea() {
  const raw = document.getElementById('cm-seriales')?.value || '';
  return raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
}

window.actualizarContadorCargaMasiva = function() {
  const n = _parseSerialesTextarea().length;
  const el = document.getElementById('cm-contador');
  if (el) el.textContent = `${n} serial${n!==1?'es':''} cargado${n!==1?'s':''}`;
};

window.abrirEscanerCargaMasiva = function(projectId) {
  openScannerOverlay(
    (code) => {
      const ta = document.getElementById('cm-seriales');
      if (ta) {
        ta.value = (ta.value ? ta.value + '\n' : '') + code;
        window.actualizarContadorCargaMasiva();
      }
    },
    { continuous: true, title: 'Escaneo consecutivo — carga masiva' }
  );
};

// Carga masiva — agrega los seriales pegados/escaneados a la lista plana
// (garantia.paneles.seriales), sin agrupar por string.
window.distribuirSerialesMasivo = async function(projectId) {
  const seriales = _parseSerialesTextarea();
  if (!seriales.length) { toast('Pega o escanea al menos un serial', 'error'); return; }

  const p = await projects.getById(projectId);
  p.garantia = p.garantia || {};
  p.garantia.paneles = p.garantia.paneles || {};
  const actuales = getSerialesFlat(p.garantia);
  if (actuales.length) {
    const ok = await confirmDialog(`Ya hay ${actuales.length} seriales registrados — la carga masiva los va a reemplazar por completo. ¿Continuar?`);
    if (!ok) return;
  }

  const nuevos = seriales.map(serial => {
    const dup = (p.garantia.equipos||[]).some(eq => eq.serial === serial);
    return {
      serial, fotoRespaldo: null, createdAt: isoNow(),
      ...(dup ? { duplicadoEnEquipos: true } : {}),
    };
  });

  p.garantia.paneles.seriales = nuevos;
  delete p.garantia.paneles.strings;
  await projects.update(projectId, { garantia: p.garantia });
  logChange(projectId, {
    modulo: 'Garantía', accion: 'carga masiva de paneles',
    detalle: `${seriales.length} seriales`,
    quien: await getSession(),
  });
  sessionStorage.setItem('garantia-tab-target', 'g-paneles');
  navigate(`#proyecto/${projectId}/garantia`);
  toast(`✅ ${nuevos.length} seriales guardados`);
};

// ── Fotos del arreglo (frontal/perfil) ────────────────────────────────────────
window.capFotoArreglo = function(projectId, tipo) {
  capturePhoto(async (b64) => {
    toast('Subiendo foto…');
    const fid = uuid();
    const result = await uploadPhotoQueued(b64, `projects/${projectId}/arreglo_${tipo}_${fid}.jpg`,
      projectId, 'fotoArregloPaneles', { tipo, itemId: fid });
    const p = await projects.getById(projectId);
    p.garantia = p.garantia || {};
    p.garantia.paneles = p.garantia.paneles || {};
    const campo = tipo === 'frontal' ? 'fotoArregloFrontal' : 'fotoArregloPerfil';
    p.garantia.paneles[campo] = result.url || (result.pending ? { pending: true, pendingId: result.pendingId } : null);
    await projects.update(projectId, { garantia: p.garantia });
    sessionStorage.setItem('garantia-tab-target', 'g-paneles');
    navigate(`#proyecto/${projectId}/garantia`);
    if (result.url) toast('✅ Foto guardada');
  }, { preview: true });
};

// Corrección puntual: escanear un solo serial y agregarlo al final de la lista plana.
window.scanSerialPanel = function(projectId) {
  openScannerOverlay(
    async (serial) => {
      const pCheck = await projects.getById(projectId);
      const dup = _serialUbicacion(pCheck, serial);
      if (dup) { toast(`⚠ Serial ya registrado en ${dup}: ${serial}`, 'warning', 3500); return; }

      const p = await projects.getById(projectId);
      p.garantia = p.garantia || {};
      p.garantia.paneles = p.garantia.paneles || {};
      const seriales = getSerialesFlat(p.garantia);
      seriales.push({ serial, fotoRespaldo: null, createdAt: isoNow() });
      p.garantia.paneles.seriales = seriales;
      delete p.garantia.paneles.strings;
      await projects.update(projectId, { garantia: p.garantia });
      logChange(projectId, { modulo: 'Garantía', accion: 'panel escaneado', detalle: serial, quien: await getSession() });
      sessionStorage.setItem('garantia-tab-target', 'g-paneles');
      navigate(`#proyecto/${projectId}/garantia`);
      toast(`✅ Panel agregado: ${serial}`);
    },
    { continuous: false, title: 'Escanear serial del panel' }
  );
};

// Corrección puntual: elegir escáner o texto manual para agregar un serial.
window.addSerialManual = async function(projectId) {
  const choice = await new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-confirm-overlay';
    overlay.innerHTML = `
      <div class="modal-confirm" role="dialog" aria-modal="true">
        <p class="modal-confirm-msg">¿Cómo quieres agregar el serial?</p>
        <div class="modal-confirm-actions" style="flex-direction:column;gap:8px">
          <button class="btn-primary modal-btn-scan" style="width:100%">
            🔲 Escanear código de barras
          </button>
          <button class="btn-outline modal-btn-text" style="width:100%">
            ✏️ Escribir serial manualmente
          </button>
          <button class="btn-outline modal-btn-cancel" style="width:100%;color:var(--text-muted)">
            Cancelar
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-btn-scan').onclick   = () => { overlay.remove(); resolve('scan'); };
    overlay.querySelector('.modal-btn-text').onclick   = () => { overlay.remove(); resolve('text'); };
    overlay.querySelector('.modal-btn-cancel').onclick = () => { overlay.remove(); resolve(null); };
  });

  if (!choice) return;

  if (choice === 'scan') {
    window.scanSerialPanel(projectId);
    return;
  }

  const serial = await inputDialog('Número de serie del panel:');
  if (!serial?.trim()) return;
  const p = await projects.getById(projectId);
  const dup = _serialUbicacion(p, serial);
  if (dup) { toast(`⚠ Serial ya registrado en ${dup}: ${serial.trim()}`, 'warning', 3500); return; }
  p.garantia = p.garantia || {};
  p.garantia.paneles = p.garantia.paneles || {};
  const seriales = getSerialesFlat(p.garantia);
  seriales.push({ serial: serial.trim(), fotoRespaldo: null, createdAt: isoNow() });
  p.garantia.paneles.seriales = seriales;
  delete p.garantia.paneles.strings;
  await projects.update(projectId, { garantia: p.garantia });
  logChange(projectId, { modulo: 'Garantía', accion: 'panel agregado (manual)', detalle: serial.trim(), quien: await getSession() });
  sessionStorage.setItem('garantia-tab-target', 'g-paneles');
  navigate(`#proyecto/${projectId}/garantia`);
};

window.delSerialPanel = async function(projectId, idx) {
  if (!isAdmin(await getSession())) { toast('Solo un administrador puede eliminar esto', 'error'); return; }
  if (!await confirmDialog('¿Eliminar este serial?')) return;
  const p = await projects.getById(projectId);
  const seriales = getSerialesFlat(p.garantia);
  const pan = seriales[idx];
  seriales.splice(idx,1);
  p.garantia.paneles = p.garantia.paneles || {};
  p.garantia.paneles.seriales = seriales;
  delete p.garantia.paneles.strings;
  await projects.update(projectId, { garantia: p.garantia });
  logChange(projectId, { modulo: 'Garantía', accion: 'panel eliminado', detalle: pan?.serial||'', quien: await getSession() });
  sessionStorage.setItem('garantia-tab-target', 'g-paneles');
  navigate(`#proyecto/${projectId}/garantia`);
};
