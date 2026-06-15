// gar-voc.js — Validación Voc de string + catálogo de paneles
// Extraído de garantia.js. Exporta calcVocPuro y renderVocTab.

import { projects } from './db.js';
import { esc, toast, confirmDialog, isoNow } from './utils.js';
import { getSession } from './auth.js';
import { icon } from './icons.js';
import { TMIN_ZONA_LABELS } from './clima.js';

// Fallback cuando el proyecto no tiene T_min capturado en levantamiento
const VOC_T_MIN  = 3;    // °C — La Paz, BCS (valor por defecto)
const VOC_COEF   = -0.29; // %/°C  coeficiente típico monocristalino

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

  // Paneles en serie: fuente primaria = max(paneles por string registrado)
  // Fallback: calculadora layout. NO usar el valor guardado en vd — puede estar desactualizado.
  const strings       = g.paneles?.strings || [];
  const maxPorString  = strings.length > 0
    ? Math.max(...strings.map(s => (s.paneles?.length || 0)))
    : null;
  const panelesSerie  = maxPorString || project.projectConfig?.layout?.totalPanels || null;

  const resultado = vd.resultado;

  // Detectar si el resultado guardado está desactualizado respecto a los datos actuales
  const stale = resultado && (
    (vd.panelesSerie != null && panelesSerie != null && vd.panelesSerie !== panelesSerie) ||
    (vd.vocPanel     != null && vocPanel     != null && Math.abs(vd.vocPanel - vocPanel) > 0.01) ||
    (vd.vocMaxInversor != null && vocMax     != null && vd.vocMaxInversor !== vocMax) ||
    (vd.tMin         != null && vd.tMin     !== tMin) ||
    (vd.tMinZona     != null && vd.tMinZona !== tMinZona)
  );

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

  // Fuente de paneles en serie para tooltip
  const serieOrigen = maxPorString
    ? `${strings.length} string${strings.length>1?'s':''} registrado${strings.length>1?'s':''}`
    : 'Calculadora';

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
      <span>Los strings o el panel cambiaron desde el último cálculo.</span>
      <button class="btn-primary btn-sm" onclick="calcVocYGuardar('${projectId}')">Recalcular</button>
    </div>` : ''}

    <!-- Datos automáticos -->
    <div class="voc-datos-auto">
      <div class="vda-item">
        <span class="vda-lbl">${icon('sun', 14)} Voc del panel</span>
        <span class="vda-val ${vocPanel ? '' : 'vda-missing'}">${vocPanel ? vocPanel + ' V' : '—'}</span>
      </div>
      <div class="vda-item">
        <span class="vda-lbl">${icon('stack', 14)} Paneles en serie
          <span style="font-size:.65rem;opacity:.7">(${serieOrigen})</span>
        </span>
        <span class="vda-val ${panelesSerie ? '' : 'vda-missing'}">${panelesSerie || '—'}</span>
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
    <input type="hidden" id="voc-serie"   value="${panelesSerie|| ''}" />
    <input type="hidden" id="voc-max-inv" value="${vocMax      || ''}" />
    <input type="hidden" id="voc-tmin"     value="${tMin}" />
    <input type="hidden" id="voc-tmin-zona" value="${tMinZona}" />
    <input type="hidden" id="voc-coef"    value="${VOC_COEF}" />

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

// Cálculo Voc — lee parámetros del DOM, delega lógica a calcVocPuro
function _calcVocData() {
  const vocP   = parseFloat(document.getElementById('voc-panel')?.value)   || 0;
  const serie  = parseInt(document.getElementById('voc-serie')?.value)      || 0;
  const vocMax = parseFloat(document.getElementById('voc-max-inv')?.value)  || 0;
  const tMin   = parseFloat(document.getElementById('voc-tmin')?.value || '') || VOC_T_MIN;
  const tMinZona = document.getElementById('voc-tmin-zona')?.value || 'valle';

  const result = calcVocPuro({ vocPanel: vocP, panelesSerie: serie, vocMaxInversor: vocMax, tMin, coefVoc: VOC_COEF });
  if (!result) return null;
  return { ...result, tMinZona };
}

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

  const session = await getSession();
  const data = { ...window._vocTemp, savedAt: isoNow(), savedBy: session?.uid || '' };
  await projects.setField(projectId, 'garantia.validacionVoc', data);
  const resMsg = data.resultado === 'seguro' ? 'configuración segura'
               : data.resultado === 'excede' ? '⚠️ excede el límite'
               : 'en el límite';
  toast(`✅ Voc guardado — ${resMsg}`);
  sessionStorage.setItem('garantia-tab-target', 'g-voc');
  navigate(`#proyecto/${projectId}/garantia`);
};
