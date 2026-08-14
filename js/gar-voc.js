// gar-voc.js — Validación de arreglo (Voc + corriente) por equipo + catálogo de paneles
// Extraído de garantia.js. Exporta calcVocPuro, calcIscPuro y renderVocTab.

import { projects, logChange } from './db.js';
import { esc, toast, confirmDialog, isoNow } from './utils.js';
import { getSession, isAdmin } from './auth.js';
import { icon } from './icons.js';
import { TMIN_ZONA_LABELS } from './clima.js';
import { getTotalPanels } from '../modules/calculadora/index.js';
import { getSerialesFlat } from './gar-paneles.js';

// Fallback cuando el proyecto no tiene T_min capturado en levantamiento
const VOC_T_MIN  = 3;    // °C — La Paz, BCS (valor por defecto)
const VOC_COEF   = -0.29; // %/°C  coeficiente típico monocristalino

// Equipos que reciben el arreglo eléctricamente y por tanto necesitan su
// propia validación de Voc/corriente. Controladora/MPPT (sistemas con
// batería) y variador de frecuencia (bombeo DC-acoplado directo, sin
// inversor de red) son ambos equipos "de entrada CD" — el arreglo conecta
// directo a ellos. Si hay al menos uno de estos, el/los inversor(es) quedan
// excluidos: en sistemas con batería el inversor está aguas abajo de la
// batería (batería → inversor → cargas CA) y nunca ve el string de paneles.
// Solo se valida el inversor cuando NO hay ninguna controladora/VFD
// (interconectado directo, el arreglo va al inversor). Puede haber MÁS DE UN
// equipo de entrada CD (ej. varias controladoras Victron independientes),
// por eso esto es un filtro (todos), no un .find() del primero.
export function getLimitadorEquipos(g) {
  const equipos = g.equipos || [];
  const entradaCD = equipos.filter(e => e.tipo === 'controladora' || e.tipo === 'vfd');
  return entradaCD.length ? entradaCD : equipos.filter(e => e.tipo === 'inversor');
}

// Etiqueta legible del tipo de equipo limitante, reutilizada en la tarjeta,
// el candado de guardado y las 3 exportaciones (PDF/Word).
export function limitadorLabel(tipo) {
  return tipo === 'controladora' ? 'controladora'
       : tipo === 'vfd'          ? 'variador de frecuencia'
       : 'inversor';
}

function _validacionDesactualizada(vd, equipo, g, lev) {
  if (!vd.resultado) return false;
  const tMin     = (lev.tMin != null) ? lev.tMin : VOC_T_MIN;
  const tMinZona = lev.tMinZona || 'valle';
  const vocPanel = g.paneles?.voc || vd.vocPanel || null;
  const vocMax   = equipo?.vocMax || vd.vocMaxInversor || null;

  // "Paneles en serie" ya no se deriva de strings — es un campo manual
  // (ver _renderVocCard); no hay un valor "vivo" contra el cual compararlo,
  // así que no participa en la detección de obsolescencia.
  return !!(
    (vd.vocPanel     != null && vocPanel     != null && Math.abs(vd.vocPanel - vocPanel) > 0.01) ||
    (vd.vocMaxInversor != null && vocMax     != null && vd.vocMaxInversor !== vocMax) ||
    (vd.tMin         != null && vd.tMin     !== tMin) ||
    (vd.tMinZona     != null && vd.tMinZona !== tMinZona)
  );
}

// ¿Alguna validación guardada quedó desactualizada respecto a los datos
// actuales del proyecto (panel, equipo, T mín)? Compartido entre el render
// de esta pestaña y el candado de firma de Garantía (garantia.js). true si
// CUALQUIER equipo con validación guardada está desactualizado.
export function vocEstaDesactualizado(project) {
  const g   = project.garantia || {};
  const lev = project.documentacion?.levantamiento || {};
  const validaciones = g.arregloValidaciones || {};
  return getLimitadorEquipos(g).some(eq => _validacionDesactualizada(validaciones[eq.id] || {}, eq, g, lev));
}

export function renderVocTab(project, projectId, edit) {
  const g       = project.garantia || {};
  const equipos = getLimitadorEquipos(g);

  if (!equipos.length) {
    return `
    <div class="card">
      <div class="card-title-row"><h3 class="card-title">Validación de arreglo (Voc / corriente)</h3></div>
      <div class="voc-no-inversor" role="status" aria-live="polite">
        ${icon('warning-circle', 16)}
        <div>Registra un inversor, una controladora/MPPT o un variador de frecuencia en <em>Equipos</em> para poder validar el arreglo de paneles.</div>
      </div>
    </div>`;
  }

  return equipos.map(eq => _renderVocCard(project, projectId, edit, eq)).join('<div style="height:12px"></div>');
}

function _renderVocCard(project, projectId, edit, equipo) {
  const g   = project.garantia || {};
  const vd  = (g.arregloValidaciones || {})[equipo.id] || {};
  const lev = project.documentacion?.levantamiento || {};
  const eid = equipo.id;
  const eqLabel = limitadorLabel(equipo.tipo);
  const tituloEquipoDefault = equipo.tipo === 'controladora' ? 'Controladora/MPPT'
                            : equipo.tipo === 'vfd'          ? 'Variador de frecuencia'
                            : 'Inversor';
  const tituloEquipo = [equipo.marca, equipo.modelo].filter(Boolean).join(' ') || tituloEquipoDefault;

  // T_min: primero del levantamiento, fallback constante La Paz
  const tMin        = (lev.tMin != null) ? lev.tMin : VOC_T_MIN;
  // compatibilidad: tMinCiudad era el nombre anterior del campo
  const tMinCiudad  = lev.tMinCiudad || lev.tMinEstado || (lev.tMin != null ? 'manual' : null);
  const tMinZona    = lev.tMinZona || 'valle';
  const tMinZonaLabel = TMIN_ZONA_LABELS[tMinZona] || '';

  // Datos tomados directo de los registros — sin campos manuales
  const vocPanel   = g.paneles?.voc || vd.vocPanel || null;
  const iscPanel   = g.paneles?.isc || vd.iscPanel || null;
  const vocMax     = equipo.vocMax || vd.vocMaxInversor || null;
  const imaxEquipo = equipo.imax   || vd.imaxEquipo     || null;

  // Paneles en serie: campo manual — lo declara el admin/técnico según el
  // diseño eléctrico real de ESTE equipo. Se siembra con el último valor
  // guardado o, si nunca se ha calculado, con el total de paneles de la
  // Calculadora como sugerencia (solo útil cuando hay un único equipo).
  const panelesSerie = vd.panelesSerie ?? (equipos1(g) ? getTotalPanels(project.projectConfig) : null) ?? null;

  // Arreglo eléctrico — descriptivo (no participa en el cálculo de Voc, que
  // solo depende de paneles-en-serie por string). Se siembra con lo capturado
  // en Levantamiento si aún no se ha elegido aquí, para no pedir el dato dos veces.
  const arreglo = vd.arreglo || lev.arregloPaneles || '';

  // Strings en paralelo — también manual. Alimenta tanto el total del
  // arreglo (paneles-en-serie × strings) como la validación de corriente
  // (Isc del panel × strings = corriente total que ve el equipo).
  const numStrings = vd.numStrings ?? 1;

  const resultado = vd.resultado;
  const stale = _validacionDesactualizada(vd, equipo, g, lev);

  const semaforo = resultado === 'seguro'  ? { cls: 'voc-ok',   ico: '🟢', txt: 'Voc seguro' }
                 : resultado === 'limite'  ? { cls: 'voc-warn', ico: '🟡', txt: 'Voc en el límite' }
                 : resultado === 'excede'  ? { cls: 'voc-err',  ico: '🔴', txt: 'Voc excede el límite' }
                 : null;
  const semaforoIsc = vd.resultadoIsc === 'seguro' ? { cls: 'voc-ok',   ico: '🟢', txt: 'Corriente segura' }
                     : vd.resultadoIsc === 'limite' ? { cls: 'voc-warn', ico: '🟡', txt: 'Corriente en el límite' }
                     : vd.resultadoIsc === 'excede' ? { cls: 'voc-err',  ico: '🔴', txt: 'Corriente excede el límite' }
                     : null;

  // Determinar qué falta para calcular Voc (bloqueante, como antes).
  const missingVoc   = !vocPanel;
  const missingSerie = !panelesSerie;
  const missingInv   = !vocMax;

  const alertas = [
    missingVoc   && `Voc del panel — registra el panel en la pestaña <em>Paneles</em>`,
    missingSerie && `Paneles en serie — captúralo abajo o guarda el BOM en la Calculadora`,
    missingInv   && `Voc máx del ${eqLabel} — edita el equipo en <em>Equipos</em>`,
  ].filter(Boolean);

  // Isc/corriente es opcional y no bloqueante: si falta Isc del panel o la
  // corriente máx del equipo, simplemente no se muestra ese resultado — no
  // impide guardar el Voc (que ya funcionaba antes de este dato existir).
  const iscDisponible = !!(iscPanel && imaxEquipo);

  // Coeficiente de temperatura — editable por ficha técnica del fabricante,
  // default al típico de Si cristalino. Se guarda junto al resultado de Voc.
  const coefVoc = vd.coefVoc ?? VOC_COEF;

  // ── Sobresaturación DC/AC (independiente del semáforo de Voc) ──────────────
  // Usa el tamaño de ESTE arreglo (paneles-en-serie × strings de esta tarjeta),
  // no el total global de seriales del proyecto — así cada inversor se
  // compara contra su propia porción del sistema, no contra todo el proyecto.
  const potenciaDC_kW  = (panelesSerie && numStrings && g.paneles?.wp) ? (panelesSerie * numStrings * g.paneles.wp / 1000) : null;
  const potenciaAC_kW  = equipo.potenciaNominalAC || null;
  const ratioDcAc       = (potenciaDC_kW && potenciaAC_kW) ? (potenciaDC_kW / potenciaAC_kW) * 100 : null;
  const dcAcSobresatura = ratioDcAc != null && ratioDcAc > 140;

  return `
  <div class="card">
    <div class="card-title-row">
      <h3 class="card-title">${esc(tituloEquipo)} <span class="form-hint">(${eqLabel})</span></h3>
      ${semaforo && !stale ? `<span class="voc-badge ${semaforo.cls}">${semaforo.ico} ${semaforo.txt}</span>` : ''}
      ${semaforoIsc && !stale ? `<span class="voc-badge ${semaforoIsc.cls}">${semaforoIsc.ico} ${semaforoIsc.txt}</span>` : ''}
      ${stale ? `<span class="voc-badge voc-warn">⚠️ Desactualizado</span>` : ''}
    </div>

    <!-- Alerta de datos desactualizados -->
    ${stale && edit ? `
    <div class="voc-stale-banner">
      ${icon('arrow-clockwise', 15)}
      <span>El panel, el equipo o la temperatura mínima cambiaron desde el último cálculo.</span>
      <button class="btn-primary btn-sm" onclick="calcVocYGuardar('${projectId}','${eid}')">Recalcular</button>
    </div>` : ''}

    <!-- Datos automáticos -->
    <div class="voc-datos-auto">
      <div class="vda-item">
        <span class="vda-lbl">${icon('sun', 14)} Voc del panel</span>
        <span class="vda-val ${vocPanel ? '' : 'vda-missing'}">${vocPanel ? vocPanel + ' V' : '—'}</span>
      </div>
      <div class="vda-item">
        <span class="vda-lbl">${icon('cpu', 14)} Voc máx ${eqLabel}</span>
        <span class="vda-val ${vocMax ? '' : 'vda-missing'}">${vocMax ? vocMax + ' V' : '—'}</span>
      </div>
      <div class="vda-item">
        <span class="vda-lbl">${icon('sun', 14)} Isc del panel</span>
        <span class="vda-val ${iscPanel ? '' : 'vda-missing'}">${iscPanel ? iscPanel + ' A' : '—'}</span>
      </div>
      <div class="vda-item">
        <span class="vda-lbl">${icon('cpu', 14)} Corriente máx ${eqLabel}</span>
        <span class="vda-val ${imaxEquipo ? '' : 'vda-missing'}">${imaxEquipo ? imaxEquipo + ' A' : '—'}</span>
      </div>
      <div class="vda-item">
        <span class="vda-lbl">${icon('thermometer', 14)} T mín sitio</span>
        <span class="vda-val">${tMin}°C</span>
        <span style="font-size:.68rem;color:var(--text-muted);line-height:1.3">
          ${tMinCiudad && tMinCiudad !== 'otro' && tMinCiudad !== 'manual'
            ? `${esc(tMinCiudad)}<br>${tMinZonaLabel}`
            : tMinCiudad === 'otro' ? 'manual' : '⚠ BCS (default)'}
        </span>
        ${!lev.tMin && lev.tMin !== 0
          ? `<span style="font-size:.65rem;color:#c8a000">Configura en Levantamiento</span>` : ''}
      </div>
    </div>

    <!-- Alertas si faltan datos — id fijo para que calcVoc() la oculte/muestre
         en vivo al llenar "Paneles en serie" sin necesitar recargar la página -->
    <div id="voc-alertas-${eid}" class="voc-no-inversor" role="status" aria-live="polite"
         style="margin-top:10px; ${alertas.length ? '' : 'display:none'}">
      ${icon('warning-circle', 16)}
      <div>
        <strong>Falta registrar para continuar:</strong>
        <ul style="margin:4px 0 0;padding-left:16px;font-size:.8rem">
          ${alertas.map(a=>`<li>${a}</li>`).join('')}
        </ul>
      </div>
    </div>

    <!-- Inputs ocultos para la lógica de calcVoc -->
    <input type="hidden" id="voc-panel-${eid}"        value="${vocPanel    || ''}" />
    <input type="hidden" id="voc-isc-panel-${eid}"     value="${iscPanel    || ''}" />
    <input type="hidden" id="voc-max-inv-${eid}"       value="${vocMax      || ''}" />
    <input type="hidden" id="voc-imax-${eid}"          value="${imaxEquipo  || ''}" />
    <input type="hidden" id="voc-tmin-${eid}"          value="${tMin}" />
    <input type="hidden" id="voc-tmin-zona-${eid}"     value="${tMinZona}" />
    <input type="hidden" id="voc-limitador-tipo-${eid}" value="${equipo.tipo}" />

    <!-- Paneles en serie — campo manual, propio de este equipo -->
    <div class="form-group" style="margin-top:8px">
      <label>${icon('stack', 14)} Paneles en serie
        <span class="form-hint">según el diseño eléctrico real de este equipo</span>
      </label>
      <input type="number" id="voc-serie-${eid}" value="${panelesSerie || ''}" min="1" step="1" ${!edit?'disabled':''}
             onchange="calcVoc('${eid}')" style="max-width:120px" />
    </div>

    <!-- Arreglo eléctrico — descriptivo, no afecta el cálculo de Voc -->
    <div class="form-group" style="margin-top:8px">
      <label>${icon('path', 14)} Arreglo de paneles
        <span class="form-hint">cómo están conectados eléctricamente — no afecta el cálculo de Voc, que ya asume paneles-en-serie por string</span>
      </label>
      <select id="voc-arreglo-${eid}" ${!edit?'disabled':''} onchange="calcVoc('${eid}')">
        <option value="">— Seleccionar —</option>
        ${['Serie','Paralelo','Serie-Paralelo'].map(t =>
          `<option value="${t}" ${arreglo===t?'selected':''}>${t}</option>`).join('')}
      </select>
    </div>

    <!-- Strings en paralelo — alimenta el total del arreglo y la validación de corriente -->
    <div class="form-group" style="margin-top:8px">
      <label>${icon('path', 14)} Strings en paralelo
        <span class="form-hint">cuántos strings de "paneles en serie" hay conectados en paralelo — también determina la corriente total hacia este equipo</span>
      </label>
      <input type="number" id="voc-strings-${eid}" value="${numStrings}" min="1" step="1" ${!edit?'disabled':''}
             onchange="calcVoc('${eid}')" style="max-width:120px" />
      <span id="voc-total-arreglo-${eid}" class="form-hint" style="display:block;margin-top:4px">
        ${panelesSerie ? `Total del arreglo: ${panelesSerie * numStrings} panel${panelesSerie*numStrings===1?'':'es'}` : ''}
      </span>
    </div>

    <!-- Coeficiente de temperatura — editable según ficha técnica del fabricante -->
    <div class="form-group" style="margin-top:8px">
      <label>Coeficiente de temperatura Voc (%/°C)
        <span class="form-hint">de la ficha técnica del panel — default: -0.29 (Si cristalino típico)</span>
      </label>
      <div class="voc-coef-row">
        <button type="button" class="btn-icon-sm" ${!edit?'disabled':''} onclick="_stepVocCoef('${eid}',-0.01)">−</button>
        <input type="number" id="voc-coef-${eid}" value="${coefVoc}" step="0.01" ${!edit?'disabled':''}
               onchange="calcVoc('${eid}')" style="text-align:center;max-width:90px" />
        <button type="button" class="btn-icon-sm" ${!edit?'disabled':''} onclick="_stepVocCoef('${eid}',0.01)">+</button>
      </div>
    </div>

    <!-- Sobresaturación DC/AC — chequeo independiente del semáforo de Voc, solo tiene sentido en inversores -->
    ${equipo.tipo === 'inversor' ? `
    <div class="voc-dcac-row">
      ${potenciaDC_kW == null || potenciaAC_kW == null
        ? `<p class="form-hint" style="margin:0">${icon('info',13)} Completa paneles en serie/strings y la potencia nominal CA del equipo para calcular relación DC/AC.</p>`
        : `<div class="vda-item">
            <span class="vda-lbl">${icon('lightning',14)} Relación DC/AC</span>
            <span class="vda-val ${dcAcSobresatura?'vda-alert':''}">${ratioDcAc.toFixed(0)}%</span>
          </div>
          ${dcAcSobresatura ? `<p class="voc-dcac-warn">${icon('warning-circle',14)} Sobresaturación DC/AC — la potencia DC de este arreglo (${potenciaDC_kW.toFixed(1)} kW) supera 140% de la nominal del equipo (${potenciaAC_kW} kW). Verifica la tolerancia del fabricante antes de continuar.</p>` : ''}`}
    </div>` : ''}

    <!-- Resultado Voc -->
    <div id="voc-resultado-${eid}" class="voc-resultado" style="${resultado && !alertas.length && !stale ? '' : 'display:none'}">
      <div class="voc-res-row"><span>Voc corregido (${tMin}°C)</span><strong id="voc-r-corr-${eid}">${vd.vocCorregido?.toFixed(2) || '—'} V</strong></div>
      <div class="voc-res-row"><span>Voc string completo</span><strong id="voc-r-str-${eid}">${vd.vocString?.toFixed(2) || '—'} V</strong></div>
      <div class="voc-res-row"><span>Margen de seguridad (Voc)</span><strong id="voc-r-margen-${eid}">${vd.margen != null ? vd.margen.toFixed(1) + '%' : '—'}</strong></div>
      <div class="voc-res-row"><span>Arreglo</span><strong id="voc-r-arreglo-${eid}">${vd.arreglo || arreglo || '—'}</strong></div>
      <div class="voc-res-row"><span>Strings en paralelo</span><strong id="voc-r-strings-${eid}">${vd.numStrings ?? numStrings}</strong></div>
      <div class="voc-res-row"><span>Total del arreglo</span><strong id="voc-r-total-${eid}">${(vd.panelesSerie && (vd.numStrings ?? numStrings)) ? vd.panelesSerie * (vd.numStrings ?? numStrings) : '—'} paneles</strong></div>
      <div id="voc-r-msg-${eid}" class="voc-res-msg ${semaforo?.cls || ''}">${semaforo ? semaforo.ico + ' ' + (vd.mensaje || semaforo.txt) : ''}</div>

      <!-- Resultado de corriente (Isc) — solo visible si hay datos suficientes -->
      <div id="voc-r-isc-row-${eid}" style="${vd.iscArreglo != null ? '' : 'display:none'}">
        <div class="voc-res-row"><span>Corriente del arreglo</span><strong id="voc-r-isc-${eid}">${vd.iscArreglo?.toFixed(2) || '—'} A</strong></div>
        <div class="voc-res-row"><span>Margen de seguridad (corriente)</span><strong id="voc-r-margen-isc-${eid}">${vd.margenIsc != null ? vd.margenIsc.toFixed(1) + '%' : '—'}</strong></div>
        <div id="voc-r-isc-msg-${eid}" class="voc-res-msg ${semaforoIsc?.cls || ''}">${semaforoIsc ? semaforoIsc.ico + ' ' + (vd.mensajeIsc || semaforoIsc.txt) : ''}</div>
      </div>
      ${!iscDisponible ? `<p class="form-hint" style="margin:8px 0 0">${icon('info',13)} Registra Isc del panel (pestaña Paneles) y la corriente máx. del equipo (pestaña Equipos) para validar también el amperaje.</p>` : ''}
    </div>

    ${edit ? `
    <div id="voc-actions-${eid}" class="form-actions" style="margin-top:12px; ${(!alertas.length && !stale) ? '' : 'display:none'}">
      <button class="btn-primary btn-sm" onclick="calcVocYGuardar('${projectId}','${eid}')">
        ${icon('check', 14)} Calcular y guardar
      </button>
    </div>` : ''}
  </div>`;
}

// true si hay exactamente un equipo limitante en el proyecto — solo en ese
// caso tiene sentido sugerir "paneles en serie" desde el total global de la
// Calculadora (con más de un equipo no hay forma de saber cómo se reparten).
function equipos1(g) {
  return getLimitadorEquipos(g).length === 1;
}

// Rellena los campos de panel al seleccionar del catálogo
window.seleccionarPanelCatalogo = function(sel) {
  const id = sel.value;
  if (!id) return;
  const p = (window._panelCatalogData || []).find(x => x.id === id);
  if (!p) return;
  _aplicarPanelCatalogo(p);
};

window.usarFuentePanel = function(presetId) {
  const p = (window._panelCatalogData || []).find(x => x.id === presetId);
  if (!p) return;
  _aplicarPanelCatalogo(p);
  document.getElementById('panel-form-campos').style.display = '';
  const wrap = document.querySelector('.panel-sugerencia-wrap');
  if (wrap) wrap.style.display = 'none';
  toast('✅ Datos del catálogo aplicados');
};

function _aplicarPanelCatalogo(p) {
  // Separar Marca / Modelo (dividido por "/" si existe)
  const slashIdx = p.label.indexOf('/');
  const marca  = slashIdx > 0 ? p.label.slice(0, slashIdx).trim() : '';
  const modelo = slashIdx > 0 ? p.label.slice(slashIdx + 1).trim() : p.label;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  set('panel-marca',  marca);
  set('panel-modelo', modelo);
  set('panel-wp',     p.wp || '');
  if (p.voc) { set('panel-voc', p.voc); syncVocFromPanel(); }
  if (p.imp) set('panel-imp', p.imp);
  if (p.isc) set('panel-isc', p.isc);
}

// Sincroniza el Voc del panel (pestaña Paneles → tarjetas de la pestaña Voc)
// automáticamente. Hay una tarjeta por equipo, así que actualiza todas las
// que aún no tengan el campo lleno.
window.syncVocFromPanel = function() {
  const vocVal = document.getElementById('panel-voc')?.value;
  if (!vocVal) return;
  document.querySelectorAll('[id^="voc-panel-"]').forEach(field => {
    if (!field.value) {
      field.value = vocVal;
      calcVoc(field.id.replace('voc-panel-', ''));
    }
  });
};

// ── Función pura de cálculo Voc (sin DOM) — exportada para tests ─────────────
// Implementa corrección de temperatura IEC 60891 / NOM-001-SEDE:
//   Voc_corr = Voc_STC × (1 + (α_Voc/100) × (T_min − T_STC))
//   Voc_STC  = voltaje open-circuit a condiciones estándar (25°C)
//   α_Voc    = coeficiente de temperatura (%/°C) — negativo para Si cristalino
//   T_STC    = 25°C (temperatura de referencia estándar)
export function calcVocPuro({ vocPanel, panelesSerie, vocMaxInversor, tMin, coefVoc }) {
  if (!vocPanel || !panelesSerie || !vocMaxInversor) return null;
  const coef     = coefVoc ?? VOC_COEF;
  const tMinVal  = tMin ?? VOC_T_MIN;

  const vocCorregido = vocPanel * (1 + (coef / 100) * (tMinVal - 25));
  const vocString    = vocCorregido * panelesSerie;
  const margen       = ((vocMaxInversor - vocString) / vocMaxInversor) * 100;
  const maxSerie     = Math.floor(vocMaxInversor * 0.90 / vocCorregido);

  let resultado, mensaje;
  if (vocString <= vocMaxInversor * 0.90) {
    resultado = 'seguro';
    mensaje   = `✅ Seguro. Margen: ${margen.toFixed(1)}%. Máximo recomendado: ${maxSerie} paneles en serie.`;
  } else if (vocString <= vocMaxInversor) {
    resultado = 'limite';
    mensaje   = `⚠️ En el límite (${margen.toFixed(1)}% de margen). Considera reducir a ${maxSerie} paneles en serie.`;
  } else {
    resultado = 'excede';
    mensaje   = `🚨 Excede el límite por ${(vocString - vocMaxInversor).toFixed(1)} V. Máximo seguro: ${maxSerie} paneles en serie.`;
  }

  return { vocPanel, panelesSerie, vocMaxInversor, tMin: tMinVal, coefVoc: coef,
           vocCorregido, vocString, margen, resultado, mensaje };
}

// Voc esperado de un string, sin requerir inversor registrado — para mostrar
// como referencia mientras se mide en campo (a diferencia de calcVocPuro, que
// valida contra el límite del inversor y por eso exige vocMaxInversor).
export function calcVocEsperadoString({ vocPanel, panelesSerie, tMin, coefVoc }) {
  if (!vocPanel || !panelesSerie) return null;
  const coef    = coefVoc ?? VOC_COEF;
  const tMinVal = tMin ?? VOC_T_MIN;
  return vocPanel * (1 + (coef / 100) * (tMinVal - 25)) * panelesSerie;
}

// ── Función pura de cálculo de corriente (Isc) — sin DOM, espejo de calcVocPuro ──
// En paralelo el voltaje no cambia, pero la corriente SÍ se suma: la
// corriente total que ve el equipo es Isc del panel × número de strings en
// paralelo. A diferencia de Voc, no se corrige por temperatura en este flujo
// (Isc varía muy poco con la temperatura frente a Voc, y no se maneja aquí).
export function calcIscPuro({ iscPanel, numStrings, imaxEquipo }) {
  if (!iscPanel || !numStrings || !imaxEquipo) return null;

  const iscArreglo = iscPanel * numStrings;
  const margenIsc  = ((imaxEquipo - iscArreglo) / imaxEquipo) * 100;
  const maxStrings = Math.floor(imaxEquipo * 0.90 / iscPanel);

  let resultadoIsc, mensajeIsc;
  if (iscArreglo <= imaxEquipo * 0.90) {
    resultadoIsc = 'seguro';
    mensajeIsc   = `✅ Seguro. Margen: ${margenIsc.toFixed(1)}%. Máximo recomendado: ${maxStrings} strings en paralelo.`;
  } else if (iscArreglo <= imaxEquipo) {
    resultadoIsc = 'limite';
    mensajeIsc   = `⚠️ En el límite (${margenIsc.toFixed(1)}% de margen). Considera reducir a ${maxStrings} strings en paralelo.`;
  } else {
    resultadoIsc = 'excede';
    mensajeIsc   = `🚨 Excede el límite por ${(iscArreglo - imaxEquipo).toFixed(1)} A. Máximo seguro: ${maxStrings} strings en paralelo.`;
  }

  return { iscPanel, numStrings, imaxEquipo, iscArreglo, margenIsc, resultadoIsc, mensajeIsc };
}

// Cálculo Voc + Isc de un equipo — lee parámetros del DOM (sufijados por
// eqId), delega la lógica a calcVocPuro/calcIscPuro.
function _calcVocData(eqId) {
  const vocP   = parseFloat(document.getElementById(`voc-panel-${eqId}`)?.value)     || 0;
  const iscP   = parseFloat(document.getElementById(`voc-isc-panel-${eqId}`)?.value) || 0;
  const serie  = parseInt(document.getElementById(`voc-serie-${eqId}`)?.value)       || 0;
  const vocMax = parseFloat(document.getElementById(`voc-max-inv-${eqId}`)?.value)   || 0;
  const imax   = parseFloat(document.getElementById(`voc-imax-${eqId}`)?.value)      || 0;
  // "|| VOC_T_MIN" trataría un T mín real de 0°C (Sonora, Hidalgo, Nuevo León,
  // Puebla...) como si faltara el dato, por ser 0 falsy en JS, y lo pisaría con
  // el default de 3°C sin avisar. isNaN es el chequeo correcto aquí.
  const tMinRaw = parseFloat(document.getElementById(`voc-tmin-${eqId}`)?.value);
  const tMin    = isNaN(tMinRaw) ? VOC_T_MIN : tMinRaw;
  const tMinZona = document.getElementById(`voc-tmin-zona-${eqId}`)?.value || 'valle';
  const coef   = parseFloat(document.getElementById(`voc-coef-${eqId}`)?.value);
  const arreglo = document.getElementById(`voc-arreglo-${eqId}`)?.value || '';
  const numStrings = parseInt(document.getElementById(`voc-strings-${eqId}`)?.value) || 1;
  const limitadorTipo = document.getElementById(`voc-limitador-tipo-${eqId}`)?.value || 'inversor';

  const result = calcVocPuro({ vocPanel: vocP, panelesSerie: serie, vocMaxInversor: vocMax, tMin, coefVoc: isNaN(coef) ? VOC_COEF : coef });
  if (!result) return null;

  // Isc es opcional — si falta Isc del panel o Imax del equipo, calcIscPuro
  // regresa null y simplemente no se agrega al resultado (no bloquea Voc).
  const iscResult = calcIscPuro({ iscPanel: iscP, numStrings, imaxEquipo: imax });

  return { ...result, tMinZona, arreglo, numStrings, limitadorTipo, ...(iscResult || {}) };
}

// Botones [−]/[+] del coeficiente de temperatura (paso 0.01)
window._stepVocCoef = function(eqId, delta) {
  const inp = document.getElementById(`voc-coef-${eqId}`);
  if (!inp || inp.disabled) return;
  const val = (parseFloat(inp.value) || 0) + delta;
  inp.value = val.toFixed(2);
  calcVoc(eqId);
};

window.calcVoc = function(eqId) {
  const d = _calcVocData(eqId);
  // Banner de "falta registrar" y botón de guardar: antes quedaban fijos con
  // lo que había al cargar la página — si el técnico llenaba "Paneles en
  // serie" recién ahí, el resultado se calculaba en vivo pero el botón para
  // guardarlo no aparecía hasta recargar. Ahora reaccionan en cada cálculo.
  const alertasEl = document.getElementById(`voc-alertas-${eqId}`);
  const actionsEl = document.getElementById(`voc-actions-${eqId}`);
  if (!d) {
    if (alertasEl) alertasEl.style.display = '';
    if (actionsEl) actionsEl.style.display = 'none';
    return;
  }
  if (alertasEl) alertasEl.style.display = 'none';
  if (actionsEl) actionsEl.style.display = '';
  const wrap = document.getElementById(`voc-resultado-${eqId}`);
  if (wrap) {
    wrap.style.display = '';
    document.getElementById(`voc-r-corr-${eqId}`).textContent   = d.vocCorregido.toFixed(2) + ' V';
    document.getElementById(`voc-r-str-${eqId}`).textContent    = d.vocString.toFixed(2)    + ' V';
    document.getElementById(`voc-r-margen-${eqId}`).textContent = d.margen.toFixed(1)       + '%';
    document.getElementById(`voc-r-arreglo-${eqId}`).textContent = d.arreglo || '—';
    document.getElementById(`voc-r-strings-${eqId}`).textContent = d.numStrings;
    document.getElementById(`voc-r-total-${eqId}`).textContent   = (d.panelesSerie * d.numStrings) + ' paneles';
    const msg = document.getElementById(`voc-r-msg-${eqId}`);
    msg.textContent = d.mensaje;
    msg.className   = `voc-res-msg ${d.resultado==='seguro'?'voc-ok':d.resultado==='limite'?'voc-warn':'voc-err'}`;

    // Isc — fila se muestra u oculta según haya datos suficientes
    const iscRow = document.getElementById(`voc-r-isc-row-${eqId}`);
    if (iscRow) {
      if (d.iscArreglo != null) {
        iscRow.style.display = '';
        document.getElementById(`voc-r-isc-${eqId}`).textContent = d.iscArreglo.toFixed(2) + ' A';
        document.getElementById(`voc-r-margen-isc-${eqId}`).textContent = d.margenIsc.toFixed(1) + '%';
        const iscMsg = document.getElementById(`voc-r-isc-msg-${eqId}`);
        iscMsg.textContent = d.mensajeIsc;
        iscMsg.className   = `voc-res-msg ${d.resultadoIsc==='seguro'?'voc-ok':d.resultadoIsc==='limite'?'voc-warn':'voc-err'}`;
      } else {
        iscRow.style.display = 'none';
      }
    }
  }
  // Total del arreglo bajo el campo "Strings en paralelo" (fuera del bloque
  // de resultado, que solo se muestra cuando el cálculo completo es válido)
  const totalEl = document.getElementById(`voc-total-arreglo-${eqId}`);
  if (totalEl && d.panelesSerie) {
    const total = d.panelesSerie * d.numStrings;
    totalEl.textContent = `Total del arreglo: ${total} panel${total===1?'':'es'}`;
  }
  window._vocTemp = window._vocTemp || {};
  window._vocTemp[eqId] = d;
};

// Calcular y guardar en un solo clic
window.calcVocYGuardar = async function(projectId, eqId) {
  calcVoc(eqId);
  if (!window._vocTemp?.[eqId]) { toast('Faltan datos para calcular el Voc', 'warn'); return; }
  await guardarVoc(projectId, eqId);
};

window.guardarVoc = async function(projectId, eqId) {
  const temp = window._vocTemp?.[eqId];
  if (!temp) { toast('Primero calcula el Voc', 'warn'); return; }

  // ── Critical #3: Validar consistencia con el equipo registrado ─────────────
  const proj    = await projects.getById(projectId);
  const equipo  = (proj?.garantia?.equipos || []).find(e => e.id === eqId);
  const eqLabel = limitadorLabel(equipo?.tipo);
  const savedVocMax = temp.vocMaxInversor;
  const session0 = await getSession();

  // Candado de Voc: si excede el límite, solo un admin puede guardar de
  // todas formas — queda como excepción registrada en el historial, igual
  // que otros candados de la app (ej. bloque del checklist).
  if (temp.resultado === 'excede') {
    if (!isAdmin(session0)) {
      toast(`🚨 El Voc excede el límite del ${eqLabel}. Solo un administrador puede autorizar guardar esta configuración.`, 'error', 7000);
      return;
    }
    const ok = await confirmDialog(
      `🚨 El Voc del string (${temp.vocString.toFixed(1)} V) excede el límite del ${eqLabel} (${savedVocMax} V). ` +
      'Esto es una excepción que quedará registrada en el historial. ¿Guardar de todas formas?'
    );
    if (!ok) return;
  }

  // Mismo candado, espejo, para la corriente — solo aplica si se calculó Isc.
  if (temp.resultadoIsc === 'excede') {
    if (!isAdmin(session0)) {
      toast(`🚨 La corriente del arreglo excede el límite del ${eqLabel}. Solo un administrador puede autorizar guardar esta configuración.`, 'error', 7000);
      return;
    }
    const ok = await confirmDialog(
      `🚨 La corriente del arreglo (${temp.iscArreglo.toFixed(1)} A) excede el límite del ${eqLabel} (${temp.imaxEquipo} A). ` +
      'Esto es una excepción que quedará registrada en el historial. ¿Guardar de todas formas?'
    );
    if (!ok) return;
  }

  if (!equipo) {
    // El equipo se borró entre que se renderizó la tarjeta y se guardó
    const ok = await confirmDialog('⚠️ Este equipo ya no existe en el proyecto. ¿Guardar de todas formas?');
    if (!ok) return;
  } else if (!equipo.vocMax || equipo.vocMax === 0) {
    // Hay equipo pero sin vocMax — bloquear
    toast(`El ${eqLabel} no tiene Voc máx registrado. Edítalo en la pestaña Equipos antes de guardar.`, 'warn', 6000);
    return;
  } else if (Math.abs(equipo.vocMax - savedVocMax) > 0.5) {
    // El valor ingresado difiere del registrado en el equipo
    const ok = await confirmDialog(
      `⚠️ El ${eqLabel} registrado tiene Voc máx = ${equipo.vocMax} V, pero se calculó con ${savedVocMax} V. ¿Guardar con el valor ingresado manualmente?`
    );
    if (!ok) return;
  }

  const session = session0;
  const data = { ...temp, savedAt: isoNow(), savedBy: session?.id || '' };
  await projects.setField(projectId, `garantia.arregloValidaciones.${eqId}`, data);
  const resMsg = data.resultado === 'seguro' ? 'configuración segura'
               : data.resultado === 'excede' ? '⚠️ excede el límite (excepción de admin)'
               : 'en el límite';
  logChange(projectId, { modulo: 'Garantía', accion: 'Voc/corriente recalculado', detalle: `${eqLabel} ${equipo?.marca||''} ${equipo?.modelo||''}: ${resMsg}`, quien: session });
  toast(`✅ Guardado — ${resMsg}`);
  sessionStorage.setItem('garantia-tab-target', 'g-voc');
  navigate(`#proyecto/${projectId}/garantia`);
};
