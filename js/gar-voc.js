// gar-voc.js — Validación Voc de string + catálogo de paneles
// Extraído de garantia.js. Exporta calcVocPuro y renderVocTab.

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

// ¿El Voc guardado quedó desactualizado respecto a los datos actuales del
// proyecto (panel, inversor, T mín)? Compartido entre el render de esta
// pestaña y el candado de firma de Garantía (garantia.js).
export function vocEstaDesactualizado(project) {
  const g   = project.garantia || {};
  const vd  = g.validacionVoc || {};
  if (!vd.resultado) return false;
  const inversor = (g.equipos || []).find(e => e.tipo === 'inversor');
  const lev = project.documentacion?.levantamiento || {};

  const tMin     = (lev.tMin != null) ? lev.tMin : VOC_T_MIN;
  const tMinZona = lev.tMinZona || 'valle';
  const vocPanel = g.paneles?.voc || vd.vocPanel || null;
  const vocMax   = inversor?.vocMax || vd.vocMaxInversor || null;

  // "Paneles en serie" ya no se deriva de strings — es un campo manual
  // (ver renderVocTab); no hay un valor "vivo" contra el cual compararlo,
  // así que no participa en la detección de obsolescencia.
  return !!(
    (vd.vocPanel     != null && vocPanel     != null && Math.abs(vd.vocPanel - vocPanel) > 0.01) ||
    (vd.vocMaxInversor != null && vocMax     != null && vd.vocMaxInversor !== vocMax) ||
    (vd.tMin         != null && vd.tMin     !== tMin) ||
    (vd.tMinZona     != null && vd.tMinZona !== tMinZona)
  );
}

export function renderVocTab(project, projectId, edit) {
  const g        = project.garantia || {};
  const inversor = (g.equipos || []).find(e => e.tipo === 'inversor');
  const vd       = g.validacionVoc || {};
  const lev      = project.documentacion?.levantamiento || {};

  // T_min: primero del levantamiento, fallback constante La Paz
  const tMin        = (lev.tMin != null) ? lev.tMin : VOC_T_MIN;
  // compatibilidad: tMinCiudad era el nombre anterior del campo
  const tMinCiudad  = lev.tMinCiudad || lev.tMinEstado || (lev.tMin != null ? 'manual' : null);
  const tMinZona    = lev.tMinZona || 'valle';
  const tMinZonaLabel = TMIN_ZONA_LABELS[tMinZona] || '';

  // Datos tomados directo de los registros — sin campos manuales
  const vocPanel     = g.paneles?.voc || vd.vocPanel || null;
  const vocMax       = inversor?.vocMax || vd.vocMaxInversor || null;

  // Paneles en serie: campo manual — lo declara el admin/técnico según el
  // diseño eléctrico real, ya que ya no se deriva de un agrupamiento de
  // strings. Se siembra con el último valor guardado o, si nunca se ha
  // calculado, con el total de paneles de la Calculadora como sugerencia.
  const panelesSerie  = vd.panelesSerie ?? getTotalPanels(project.projectConfig) ?? null;

  const resultado = vd.resultado;

  // Detectar si el resultado guardado está desactualizado respecto a los datos actuales
  const stale = vocEstaDesactualizado(project);

  const semaforo = resultado === 'seguro'  ? { cls: 'voc-ok',   ico: '🟢', txt: 'Configuración segura' }
                 : resultado === 'limite'  ? { cls: 'voc-warn', ico: '🟡', txt: 'En el límite — sin margen' }
                 : resultado === 'excede'  ? { cls: 'voc-err',  ico: '🔴', txt: 'Excede el límite del inversor' }
                 : null;

  // Determinar qué falta para calcular
  const missingVoc    = !vocPanel;
  const missingSerie  = !panelesSerie;
  const missingInv    = !vocMax;

  const alertas = [
    missingVoc   && `Voc del panel — registra el panel en la pestaña <em>Paneles</em>`,
    missingSerie && `Paneles en serie — guarda el BOM en la Calculadora`,
    missingInv   && (inversor
      ? `Voc máx del inversor — edita el equipo en <em>Equipos</em>`
      : `Inversor — registra el inversor en <em>Equipos</em>`),
  ].filter(Boolean);

  // Coeficiente de temperatura — editable por ficha técnica del fabricante,
  // default al típico de Si cristalino. Se guarda junto al resultado de Voc.
  const coefVoc = vd.coefVoc ?? VOC_COEF;

  // ── Sobresaturación DC/AC (independiente del semáforo de Voc) ──────────────
  const totalPaneles   = getSerialesFlat(g).length;
  const potenciaDC_kW  = totalPaneles && g.paneles?.wp ? (totalPaneles * g.paneles.wp / 1000) : null;
  const potenciaAC_kW  = inversor?.potenciaNominalAC || null;
  const ratioDcAc      = (potenciaDC_kW && potenciaAC_kW) ? (potenciaDC_kW / potenciaAC_kW) * 100 : null;
  const dcAcSobresatura = ratioDcAc != null && ratioDcAc > 140;

  return `
  <div class="card">
    <div class="card-title-row">
      <h3 class="card-title">Validación Voc de string</h3>
      ${semaforo && !stale ? `<span class="voc-badge ${semaforo.cls}">${semaforo.ico} ${semaforo.txt}</span>` : ''}
      ${stale ? `<span class="voc-badge voc-warn">⚠️ Desactualizado</span>` : ''}
    </div>

    <!-- Alerta de datos desactualizados -->
    ${stale && edit ? `
    <div class="voc-stale-banner">
      ${icon('arrow-clockwise', 15)}
      <span>El panel, el inversor o la temperatura mínima cambiaron desde el último cálculo.</span>
      <button class="btn-primary btn-sm" onclick="calcVocYGuardar('${projectId}')">Recalcular</button>
    </div>` : ''}

    <!-- Datos automáticos -->
    <div class="voc-datos-auto">
      <div class="vda-item">
        <span class="vda-lbl">${icon('sun', 14)} Voc del panel</span>
        <span class="vda-val ${vocPanel ? '' : 'vda-missing'}">${vocPanel ? vocPanel + ' V' : '—'}</span>
      </div>
      <div class="vda-item">
        <span class="vda-lbl">${icon('cpu', 14)} Voc máx inversor</span>
        <span class="vda-val ${vocMax ? '' : 'vda-missing'}">${vocMax ? vocMax + ' V' : '—'}</span>
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

    <!-- Alertas si faltan datos -->
    ${alertas.length ? `
    <div class="voc-no-inversor" role="status" aria-live="polite" style="margin-top:10px">
      ${icon('warning-circle', 16)}
      <div>
        <strong>Falta registrar para continuar:</strong>
        <ul style="margin:4px 0 0;padding-left:16px;font-size:.8rem">
          ${alertas.map(a=>`<li>${a}</li>`).join('')}
        </ul>
      </div>
    </div>` : ''}

    <!-- Inputs ocultos para la lógica de calcVoc -->
    <input type="hidden" id="voc-panel"   value="${vocPanel    || ''}" />
    <input type="hidden" id="voc-max-inv" value="${vocMax      || ''}" />
    <input type="hidden" id="voc-tmin"     value="${tMin}" />
    <input type="hidden" id="voc-tmin-zona" value="${tMinZona}" />

    <!-- Paneles en serie — campo manual, ya no se agrupa por string -->
    <div class="form-group" style="margin-top:8px">
      <label>${icon('stack', 14)} Paneles en serie
        <span class="form-hint">según el diseño eléctrico real — ya no se deriva de strings</span>
      </label>
      <input type="number" id="voc-serie" value="${panelesSerie || ''}" min="1" step="1" ${!edit?'disabled':''}
             onchange="calcVoc()" style="max-width:120px" />
    </div>

    <!-- Coeficiente de temperatura — editable según ficha técnica del fabricante -->
    <div class="form-group" style="margin-top:8px">
      <label>Coeficiente de temperatura Voc (%/°C)
        <span class="form-hint">de la ficha técnica del panel — default: -0.29 (Si cristalino típico)</span>
      </label>
      <div class="voc-coef-row">
        <button type="button" class="btn-icon-sm" ${!edit?'disabled':''} onclick="_stepVocCoef(-0.01)">−</button>
        <input type="number" id="voc-coef" value="${coefVoc}" step="0.01" ${!edit?'disabled':''}
               onchange="calcVoc()" style="text-align:center;max-width:90px" />
        <button type="button" class="btn-icon-sm" ${!edit?'disabled':''} onclick="_stepVocCoef(0.01)">+</button>
      </div>
    </div>

    <!-- Sobresaturación DC/AC — chequeo independiente del semáforo de Voc -->
    <div class="voc-dcac-row">
      ${potenciaDC_kW == null || potenciaAC_kW == null
        ? `<p class="form-hint" style="margin:0">${icon('info',13)} Esperando asignación de inversor con potencia nominal CA para calcular relación DC/AC.</p>`
        : `<div class="vda-item">
            <span class="vda-lbl">${icon('lightning',14)} Relación DC/AC</span>
            <span class="vda-val ${dcAcSobresatura?'vda-alert':''}">${ratioDcAc.toFixed(0)}%</span>
          </div>
          ${dcAcSobresatura ? `<p class="voc-dcac-warn">${icon('warning-circle',14)} Sobresaturación DC/AC — la potencia DC instalada (${potenciaDC_kW.toFixed(1)} kW) supera 140% de la nominal del inversor (${potenciaAC_kW} kW). Verifica la tolerancia del fabricante antes de continuar.</p>` : ''}`}
    </div>

    <!-- Resultado -->
    <div id="voc-resultado" class="voc-resultado" style="${resultado && !alertas.length && !stale ? '' : 'display:none'}">
      <div class="voc-res-row"><span>Voc corregido (${tMin}°C)</span><strong id="voc-r-corr">${vd.vocCorregido?.toFixed(2) || '—'} V</strong></div>
      <div class="voc-res-row"><span>Voc string completo</span><strong id="voc-r-str">${vd.vocString?.toFixed(2) || '—'} V</strong></div>
      <div class="voc-res-row"><span>Margen de seguridad</span><strong id="voc-r-margen">${vd.margen != null ? vd.margen.toFixed(1) + '%' : '—'}</strong></div>
      <div id="voc-r-msg" class="voc-res-msg ${semaforo?.cls || ''}">${semaforo ? semaforo.ico + ' ' + (vd.mensaje || semaforo.txt) : ''}</div>
    </div>

    ${edit && !alertas.length && !stale ? `
    <div class="form-actions" style="margin-top:12px">
      <button class="btn-primary btn-sm" onclick="calcVocYGuardar('${projectId}')">
        ${icon('check', 14)} Calcular y guardar
      </button>
    </div>` : ''}
  </div>`;
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
}

// Sincroniza el Voc del panel (pestaña Paneles → pestaña Voc) automáticamente
window.syncVocFromPanel = function() {
  const vocVal = document.getElementById('panel-voc')?.value;
  const vocField = document.getElementById('voc-panel');
  if (vocField && vocVal && !vocField.value) {
    vocField.value = vocVal;
    calcVoc();
  }
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

// Cálculo Voc — lee parámetros del DOM, delega lógica a calcVocPuro
function _calcVocData() {
  const vocP   = parseFloat(document.getElementById('voc-panel')?.value)   || 0;
  const serie  = parseInt(document.getElementById('voc-serie')?.value)      || 0;
  const vocMax = parseFloat(document.getElementById('voc-max-inv')?.value)  || 0;
  const tMin   = parseFloat(document.getElementById('voc-tmin')?.value || '') || VOC_T_MIN;
  const tMinZona = document.getElementById('voc-tmin-zona')?.value || 'valle';
  const coef   = parseFloat(document.getElementById('voc-coef')?.value);

  const result = calcVocPuro({ vocPanel: vocP, panelesSerie: serie, vocMaxInversor: vocMax, tMin, coefVoc: isNaN(coef) ? VOC_COEF : coef });
  if (!result) return null;
  return { ...result, tMinZona };
}

// Botones [−]/[+] del coeficiente de temperatura (paso 0.01)
window._stepVocCoef = function(delta) {
  const inp = document.getElementById('voc-coef');
  if (!inp || inp.disabled) return;
  const val = (parseFloat(inp.value) || 0) + delta;
  inp.value = val.toFixed(2);
  calcVoc();
};

window.calcVoc = function() {
  const d = _calcVocData();
  if (!d) return;
  const wrap = document.getElementById('voc-resultado');
  if (wrap) {
    wrap.style.display = '';
    document.getElementById('voc-r-corr').textContent   = d.vocCorregido.toFixed(2) + ' V';
    document.getElementById('voc-r-str').textContent    = d.vocString.toFixed(2)    + ' V';
    document.getElementById('voc-r-margen').textContent = d.margen.toFixed(1)       + '%';
    const msg = document.getElementById('voc-r-msg');
    msg.textContent = d.mensaje;
    msg.className   = `voc-res-msg ${d.resultado==='seguro'?'voc-ok':d.resultado==='limite'?'voc-warn':'voc-err'}`;
  }
  window._vocTemp = d;
};

// Calcular y guardar en un solo clic
window.calcVocYGuardar = async function(projectId) {
  calcVoc();
  if (!window._vocTemp) { toast('Faltan datos para calcular el Voc', 'warn'); return; }
  await guardarVoc(projectId);
};

window.guardarVoc = async function(projectId) {
  if (!window._vocTemp) { toast('Primero calcula el Voc', 'warn'); return; }

  // ── Critical #3: Validar consistencia con el inversor registrado ───────────
  const proj     = await projects.getById(projectId);
  const inversor = (proj?.garantia?.equipos || []).find(e => e.tipo === 'inversor');
  const savedVocMax = window._vocTemp.vocMaxInversor;
  const session0 = await getSession();

  // Candado: si el Voc del string excede el límite del inversor, solo un admin
  // puede guardar de todas formas — y queda como excepción registrada en el
  // historial, igual que otros candados de la app (ej. bloque del checklist).
  if (window._vocTemp.resultado === 'excede') {
    if (!isAdmin(session0)) {
      toast('🚨 El Voc excede el límite del inversor. Solo un administrador puede autorizar guardar esta configuración.', 'error', 7000);
      return;
    }
    const ok = await confirmDialog(
      `🚨 El Voc del string (${window._vocTemp.vocString.toFixed(1)} V) excede el límite del inversor (${savedVocMax} V). ` +
      'Esto es una excepción que quedará registrada en el historial. ¿Guardar de todas formas?'
    );
    if (!ok) return;
  }

  if (!inversor) {
    // No hay inversor — advertir y pedir confirmación
    const ok = await confirmDialog(
      '⚠️ Sin inversor registrado. El Voc máximo fue ingresado manualmente y no quedará vinculado a ningún equipo real. ¿Guardar de todas formas?'
    );
    if (!ok) return;
  } else if (!inversor.vocMax || inversor.vocMax === 0) {
    // Hay inversor pero sin vocMax — bloquear
    toast('El inversor no tiene Voc máx registrado. Edítalo en la pestaña Equipos antes de guardar.', 'warn', 6000);
    return;
  } else if (Math.abs(inversor.vocMax - savedVocMax) > 0.5) {
    // El valor ingresado difiere del registrado en el equipo
    const ok = await confirmDialog(
      `⚠️ El inversor registrado tiene Voc máx = ${inversor.vocMax} V, pero se calculó con ${savedVocMax} V. ¿Guardar con el valor ingresado manualmente?`
    );
    if (!ok) return;
  }

  const session = session0;
  const data = { ...window._vocTemp, savedAt: isoNow(), savedBy: session?.uid || '' };
  await projects.setField(projectId, 'garantia.validacionVoc', data);
  const resMsg = data.resultado === 'seguro' ? 'configuración segura'
               : data.resultado === 'excede' ? '⚠️ excede el límite (excepción de admin)'
               : 'en el límite';
  logChange(projectId, { modulo: 'Garantía', accion: 'Voc recalculado', detalle: resMsg, quien: session });
  toast(`✅ Voc guardado — ${resMsg}`);
  sessionStorage.setItem('garantia-tab-target', 'g-voc');
  navigate(`#proyecto/${projectId}/garantia`);
};
