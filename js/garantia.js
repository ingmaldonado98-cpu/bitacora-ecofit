// garantia.js — Módulo 1: Garantía (fotos técnicas, equipos, estructura, paneles)

import { projects, logChange, kv } from './db.js';
import { esc, fmtFechaHora, fotoMini, capturePhoto, compressImage, toast, confirmDialog, inputDialog,
         uploadProgressBar, uuid, isoNow, MARCAS_EQUIPOS, MARCAS_ESTRUCTURA, SISTEMAS_ESTRUCTURALES, TIPOS_FIJACION,
         openScannerOverlay, calcFaseEstado } from './utils.js';
import { canEdit, isAdmin, isLider, getSession } from './auth.js';
import { uploadPhotoQueued } from './firebase.js';
import { icon } from './icons.js';
import { stopScanner } from './scanner.js';
import { renderFirmaBlock } from './project.js';
import { TMIN_ZONA_LABELS } from './clima.js';

// ── Vista principal del módulo ─────────────────────────────────────────────────
export async function renderGarantia(projectId, session) {
  const [project, customPanels] = await Promise.all([
    projects.getById(projectId),
    kv.get('panel_presets_custom').catch(() => []),
  ]);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';
  const edit = canEdit(session, project);
  const g = project.garantia || {};
  _clearEqFotos(); // limpiar fotos temporales de sesiones anteriores

  // ── Detectar fuente de pre-llenado para la sección Paneles ───────────────────
  const panelYaCapturado = !!(g.paneles?.marca && g.paneles?.wp);
  const panelCalcConfig  = project.projectConfig?.panel;
  let fuenteCalcPanel    = null;
  if (!panelYaCapturado && panelCalcConfig?.presetId && (customPanels||[]).length > 0) {
    const found = customPanels.find(p => p.id === panelCalcConfig.presetId);
    if (found) fuenteCalcPanel = found;
  }

  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}')">
      ${icon('caret-left')}
    </button>
    <h1 class="hdr-title">Garantía</h1>
    <span class="hdr-sub">${esc(project.displayId)}</span>
  </div>

  <!-- Puesta en marcha + vencimientos -->
  ${renderVencimientos(g, projectId, edit)}

  <!-- Tabs internos — General movido a Documentación > Cierre -->
  <div class="garantia-notice card" style="margin-bottom:8px;padding:10px 14px;border-color:var(--border2)">
    <span style="color:var(--text-muted);font-size:.82rem">
      ${icon('info', 14)} La foto general y fotos técnicas de cierre están en
      <button class="btn-link" onclick="navigate('#proyecto/${projectId}/documentacion')">
        Documentación → Cierre
      </button>
    </span>
  </div>

  <div class="tab-bar" id="garantia-tabs" role="tablist" aria-label="Secciones de garantía">
    <button class="tab-btn tab-active" role="tab" aria-selected="true"  aria-controls="g-equipos"   tabindex="0"  data-tab="g-equipos"   onclick="switchTab('garantia-tabs','g-equipos',this)">Equipos</button>
    <button class="tab-btn" role="tab" aria-selected="false" aria-controls="g-voc"       tabindex="-1" data-tab="g-voc"       onclick="switchTab('garantia-tabs','g-voc',this)">
      Voc${(() => { const v = project.garantia?.validacionVoc; return v ? `<span class="tab-badge ${v.resultado==='seguro'?'tab-ok':v.resultado==='excede'?'tab-err':''}">${v.resultado==='seguro'?'✓':v.resultado==='excede'?'⚠':'~'}</span>` : ''; })()}
    </button>
    <button class="tab-btn" role="tab" aria-selected="false" aria-controls="g-estructura" tabindex="-1" data-tab="g-estructura" onclick="switchTab('garantia-tabs','g-estructura',this)">Estructura</button>
    <button class="tab-btn" role="tab" aria-selected="false" aria-controls="g-paneles"   tabindex="-1" data-tab="g-paneles"   onclick="switchTab('garantia-tabs','g-paneles',this)">Paneles</button>
    <button class="tab-btn" role="tab" aria-selected="false" aria-controls="g-notas"     tabindex="-1" data-tab="g-notas"     onclick="switchTab('garantia-tabs','g-notas',this)">
      Notas${(g.notas||[]).length ? `<span class="tab-badge tab-ok">${(g.notas||[]).length}</span>` : ''}
    </button>
  </div>

  <!-- Equipos — ahora es el tab activo por defecto -->
  <div id="g-equipos" class="tab-panel tab-panel-active">
    <div class="card-title-row" style="padding:0 0 12px">
      <h3 class="card-title">Equipos instalados (${(g.equipos||[]).length})</h3>
      ${edit ? `<button class="btn-primary btn-sm" onclick="showFormEquipo('${projectId}')">+ Equipo</button>` : ''}
    </div>
    <div id="lista-equipos">
      ${renderEquipos(g.equipos || [], projectId, edit, isAdmin(session))}
    </div>
    <div id="form-equipo" style="display:none" class="card">
      ${formEquipo(projectId)}
    </div>
  </div>

  <!-- Validación Voc -->
  <div id="g-voc" class="tab-panel">
    ${renderVocTab(project, projectId, edit)}
  </div>

  <!-- 1D: Estructura -->
  <div id="g-estructura" class="tab-panel">
    <div class="card">
      <h3 class="card-title">Estructura de montaje</h3>
      ${renderEstructura(g.estructura, projectId, edit, project.projectConfig)}
    </div>
  </div>

  <!-- 1E: Paneles -->
  <div id="g-paneles" class="tab-panel">
    ${renderPaneles(g.paneles || { marca:'', modelo:'', wp:0, strings:[] }, projectId, edit, customPanels || [], fuenteCalcPanel)}
  </div>

  <!-- Notas de garantía -->
  <div id="g-notas" class="tab-panel">
    <div class="card">
      <div class="card-title-row">
        <h3 class="card-title">Notas de garantía</h3>
        ${edit ? `<button class="btn-sm btn-outline" onclick="_showNotaGarantia('${projectId}')">+ Nota</button>` : ''}
      </div>
      <div id="gnotas-list">
        ${renderNotas(g.notas || [], session, 'garantia', projectId)}
      </div>
      <div id="gnotas-form" style="display:none" class="nota-form">
        <textarea id="gnotas-texto" rows="3" placeholder="Escribe tu nota…" class="textarea-field"></textarea>
        <div class="nota-form-actions">
          <button class="btn-outline btn-sm" onclick="document.getElementById('gnotas-form').style.display='none'">Cancelar</button>
          <button class="btn-primary btn-sm" onclick="_submitNotaGarantia('${projectId}')">Guardar nota</button>
        </div>
      </div>
    </div>
  </div>
  ${(() => {
    const fe = calcFaseEstado(project);
    return renderFirmaBlock(project, projectId, 'gar', session, {
      ready: fe.garPct === 100,
      hint:  `Faltan: ${fe.garFaltantes.join(', ')}`,
    });
  })()}

  <script>
    (function() {
      const target = sessionStorage.getItem('garantia-tab-target');
      if (target) {
        sessionStorage.removeItem('garantia-tab-target');
        const bar = document.getElementById('garantia-tabs');
        const btn = bar?.querySelector('[data-tab="' + target + '"]');
        if (btn) btn.click();
      }
      // Auto-calcular Voc si hay datos pre-cargados
      setTimeout(() => { if (typeof calcVoc === 'function') calcVoc(); }, 50);
    })();
  </script>
  `;
}

// ── Puesta en marcha + vencimientos de garantía ───────────────────────────────
const GARANTIAS_STD = [
  { key: 'paneles',    label: 'Paneles — producto',    anios: 10 },
  { key: 'paneles25',  label: 'Paneles — desempeño',   anios: 25 },
  { key: 'inversor',   label: 'Inversor',              anios: 10 },
  { key: 'estructura', label: 'Estructura',            anios: 10 },
  { key: 'manoObra',   label: 'Mano de obra',          anios:  1 },
];

function renderVencimientos(g, projectId, edit) {
  const fi = g.fechaInstalacion || '';

  const chips = fi ? GARANTIAS_STD.map(gar => {
    const base   = new Date(fi);
    const vence  = new Date(base);
    vence.setFullYear(vence.getFullYear() + gar.anios);
    const hoy    = new Date();
    const diasLeft = Math.ceil((vence - hoy) / 86400000);
    const pct    = Math.max(0, Math.min(100, ((gar.anios * 365 - diasLeft) / (gar.anios * 365)) * 100));
    const cls    = diasLeft < 0 ? 'venc-vencida' : diasLeft < 180 ? 'venc-proxima' : 'venc-vigente';
    const badge  = diasLeft < 0 ? '✗ Vencida' : diasLeft < 180 ? `⚠ ${diasLeft}d` : '✓ Vigente';
    const fechaStr = vence.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
    return `
    <div class="venc-item ${cls}">
      <div class="venc-barra-wrap"><div class="venc-barra" style="width:${pct.toFixed(0)}%"></div></div>
      <span class="venc-label">${esc(gar.label)}</span>
      <span class="venc-fecha">${fechaStr}</span>
      <span class="venc-badge">${badge}</span>
    </div>`;
  }).join('') : '';

  return `
  <div class="card" style="margin-bottom:8px">
    <div class="card-title-row">
      <h3 class="card-title">${icon('calendar-check', 15)} Puesta en marcha</h3>
    </div>
    <div class="form-row" style="align-items:flex-end;gap:10px">
      <div class="form-group" style="flex:1;margin:0">
        <label style="font-size:.78rem">Fecha de instalación / comisionamiento</label>
        <input type="date" id="gar-fecha-instalacion" value="${esc(fi)}"
               ${!edit ? 'disabled' : ''}
               style="max-width:180px"
               onchange="guardarFechaInstalacion('${projectId}',this.value)" />
      </div>
      ${fi ? `<span style="font-size:.75rem;color:var(--text-muted);padding-bottom:6px">
        ${Math.floor((new Date() - new Date(fi)) / (365.25 * 86400000))} año(s) en servicio
      </span>` : ''}
    </div>
    ${chips ? `<div class="venc-lista" style="margin-top:10px">${chips}</div>` : `
    <p style="font-size:.78rem;color:var(--text-muted);margin-top:6px">
      ${icon('info', 13)} Ingresa la fecha para ver el estado de las garantías.
    </p>`}
  </div>`;
}

window.guardarFechaInstalacion = async function(projectId, fecha) {
  if (!fecha) return;
  await projects.setField(projectId, 'garantia.fechaInstalacion', fecha);
  toast('✅ Fecha guardada');
  sessionStorage.setItem('garantia-scroll-top', '1');
  navigate(`#proyecto/${projectId}/garantia`);
};

// ── Validación Voc ────────────────────────────────────────────────────────────
// Fallback cuando el proyecto no tiene T_min capturado en levantamiento
const VOC_T_MIN  = 3;    // °C — La Paz, BCS (valor por defecto)
const VOC_COEF   = -0.29; // %/°C  coeficiente típico monocristalino

function renderVocTab(project, projectId, edit) {
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

// ── 1A Foto del sistema ────────────────────────────────────────────────────────
window.capturarFotoSistema = function(projectId) {
  capturePhoto(async (b64, _files, fileMeta) => {
    toast(navigator.onLine ? 'Subiendo foto…' : 'Sin conexión — foto guardada localmente');
    const result = await uploadPhotoQueued(b64, `projects/${projectId}/sistema.jpg`, projectId, 'fotoSistema');
    const slot = document.getElementById('slot-foto-sistema');
    const displaySrc = result.url || (result.pending ? b64 : '');
    slot.innerHTML = `${fotoMini(displaySrc,'Foto general')}<button class="btn-del-foto" onclick="delFotoGeneral('${projectId}')">✕</button>`;
    const p = await projects.getById(projectId);
    p.garantia = p.garantia || {};
    p.garantia.fotoSistema = result.url || null;
    p.garantia.fotoSistemaFuente = fileMeta?.fuente || 'camera';
    if (result.pending) p.garantia._fotoSistemaPending = result.pendingId;
    await projects.update(projectId, { garantia: p.garantia });
    if (!result.pending) toast('✅ Foto guardada');
  }, { projectId, fase: 'cierre', campo: 'SistemaGeneral', preview: true });
};

window.delFotoGeneral = async function(projectId) {
  if (!await confirmDialog('¿Eliminar foto del sistema?')) return;
  const p = await projects.getById(projectId);
  p.garantia.fotoSistema = null;
  await projects.update(projectId, { garantia: p.garantia });
  navigate(`#proyecto/${projectId}/garantia`);
};

// ── 1B+ Fotos adicionales de cierre ──────────────────────────────────────────
function renderFotosAdicionales(fotos, projectId, edit) {
  return `
  <div class="card-title-row">
    <h3 class="card-title">1B+ · Fotos adicionales de cierre</h3>
    ${edit ? `<button class="btn-primary btn-sm" onclick="capFotoAdicional('${projectId}')">
      ${icon('camera')} Agregar fotos</button>` : ''}
  </div>
  ${fotos.length === 0
    ? (edit
        ? `<div class="empty-state"><div class="empty-state-icon">📷</div>
           <p class="empty-state-msg">Sin fotos adicionales de cierre.<br>Puedes seleccionar varias a la vez.</p>
           <button class="empty-state-cta" onclick="capFotoAdicional('${projectId}')">Agregar fotos</button></div>`
        : '<p class="empty-msg-sm">Sin fotos adicionales.</p>')
    : `<div class="fotos-grid">
        ${fotos.map((f, i) => `
          <div class="foto-card">
            ${fotoMini(f.data, `Foto ${i + 1}`)}
            ${f.nota ? `<p class="foto-nota">${esc(f.nota)}</p>` : ''}
            ${edit ? `
              <button class="btn-del-foto-abs" onclick="editFotoAdicionalNota('${projectId}',${i})">✎</button>
              <button class="btn-del-foto" onclick="delFotoAdicional('${projectId}',${i})">✕</button>
            ` : ''}
          </div>`).join('')}
      </div>`}
  `;
}

window.capFotoAdicional = function(projectId) {
  capturePhoto(async (b64Array) => {
    const fotos = Array.isArray(b64Array) ? b64Array : [b64Array];
    const total = fotos.length;
    const prog = uploadProgressBar(total);
    const nuevas = [];

    for (let i = 0; i < total; i++) {
      prog.update(i + 1);
      const fid = uuid();
      const result = await uploadPhotoQueued(fotos[i], `projects/${projectId}/adicional_${fid}.jpg`,
        projectId, 'fotoAdicional', { itemId: fid });
      nuevas.push({
        data: result.url || (result.pending ? fotos[i] : null),
        nota: '', id: fid, createdAt: isoNow(),
        ...(result.pending && { pending: true, pendingId: result.pendingId }),
      });
    }
    prog.done();

    if (total === 1) {
      nuevas[0].nota = await inputDialog('Nota para esta foto (opcional):', '') || '';
    }

    const p = await projects.getById(projectId);
    p.garantia = p.garantia || {};
    p.garantia.fotosAdicionales = [...(p.garantia.fotosAdicionales || []), ...nuevas];
    await projects.update(projectId, { garantia: p.garantia });
    navigate(`#proyecto/${projectId}/garantia`);
    toast(`✅ ${total} foto${total > 1 ? 's guardadas' : ' guardada'}`);
  }, { multiple: true });
};

window.delFotoAdicional = async function(projectId, idx) {
  if (!await confirmDialog('¿Eliminar esta foto?')) return;
  const p = await projects.getById(projectId);
  p.garantia.fotosAdicionales.splice(idx, 1);
  await projects.update(projectId, { garantia: p.garantia });
  navigate(`#proyecto/${projectId}/garantia`);
};

window.editFotoAdicionalNota = async function(projectId, idx) {
  const p = await projects.getById(projectId);
  const actual = p.garantia.fotosAdicionales[idx].nota || '';
  const nueva = await inputDialog('Editar nota:', actual);
  if (nueva === null) return;
  p.garantia.fotosAdicionales[idx].nota = nueva;
  await projects.update(projectId, { garantia: p.garantia });
  navigate(`#proyecto/${projectId}/garantia`);
};

// ── 1B Fotos técnicas ─────────────────────────────────────────────────────────
// Retrocompat: el campo puede ser string (viejo) o array [{url,id,createdAt}] (nuevo)
function getFotosTecnicas(ft, key) {
  const v = ft[key];
  if (!v) return [];
  if (typeof v === 'string') return [{ url: v, id: 'legacy' }];
  return Array.isArray(v) ? v : [];
}

function renderFotosTecnicas(ft, projectId, edit) {
  const slots = [
    { key:'tableroAC',          label:'Tablero AC terminado',       req:true  },
    { key:'tableroDC',          label:'Tablero DC terminado',       req:true  },
    { key:'protecciones',       label:'Protecciones instaladas',    req:false },
    { key:'inversorEnergizado', label:'Inversor energizado',        req:true  },
    { key:'puestaATierra',      label:'Puesta a tierra',            req:false },
    { key:'etiquetado',         label:'Etiquetado',                 req:false },
  ];

  return slots.map(s => {
    const fotos = getFotosTecnicas(ft, s.key);
    const tiene = fotos.length > 0;
    return `
    <div class="foto-tecnica-row">
      <div class="ft-label">
        <ph-icon name="${tiene ? 'check-circle' : 'circle'}" class="${tiene ? 'icon-ok' : 'icon-pending'}"></ph-icon>
        ${s.label}
        ${s.req ? '<span class="req-badge">OBLIG.</span>' : '<span class="opt-badge">Rec.</span>'}
        ${tiene ? `<span class="ft-count">${fotos.length}</span>` : ''}
      </div>
      <div class="ft-fotos-grid">
        ${fotos.map((f, i) => `
          <div class="ft-foto-item">
            ${fotoMini(f.url, s.label)}
            ${edit ? `<button class="btn-del-foto-abs" onclick="delFotoTecnica('${projectId}','${s.key}',${i})">✕</button>` : ''}
          </div>`).join('')}
        ${edit ? `<button class="btn-foto-sm ft-add-btn" onclick="capFotoTecnica('${projectId}','${s.key}')">
            ${icon('camera')} ${tiene ? '+' : 'Tomar'}
          </button>` : (!tiene ? '<span class="ft-empty">—</span>' : '')}
      </div>
    </div>`;
  }).join('');
}

window.capFotoTecnica = function(projectId, key) {
  capturePhoto(async (b64Array) => {
    const fotos = Array.isArray(b64Array) ? b64Array : [b64Array];
    const total = fotos.length;
    const prog = uploadProgressBar(total);
    const p = await projects.getById(projectId);
    p.garantia.fotosTecnicas = p.garantia.fotosTecnicas || {};

    // Normalizar valor existente a array
    const existentes = getFotosTecnicas(p.garantia.fotosTecnicas, key);

    for (let i = 0; i < total; i++) {
      prog.update(i + 1);
      const fid = uuid();
      const result = await uploadPhotoQueued(fotos[i], `projects/${projectId}/tecnica_${key}_${fid}.jpg`,
        projectId, 'fotoTecnica', { key, itemId: fid });
      existentes.push({
        url: result.url || null,
        id: fid, createdAt: isoNow(),
        ...(result.pending && { pending: true, pendingId: result.pendingId }),
      });
    }
    prog.done();

    p.garantia.fotosTecnicas[key] = existentes;
    await projects.update(projectId, { garantia: p.garantia });
    navigate(`#proyecto/${projectId}/garantia`);
    toast(`✅ ${total} foto${total > 1 ? 's' : ''} guardada${total > 1 ? 's' : ''}`);
  }, { multiple: true });
};

window.delFotoTecnica = async function(projectId, key, idx) {
  if (!await confirmDialog('¿Eliminar esta foto?')) return;
  const p = await projects.getById(projectId);
  const fotos = getFotosTecnicas(p.garantia.fotosTecnicas, key);
  fotos.splice(idx, 1);
  p.garantia.fotosTecnicas[key] = fotos.length ? fotos : null;
  await projects.update(projectId, { garantia: p.garantia });
  navigate(`#proyecto/${projectId}/garantia`);
};

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

// ── 1C Equipos ────────────────────────────────────────────────────────────────
function renderEquipos(equipos, projectId, edit, admin) {
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

function formEquipo(projectId, eq = null, editIdx = -1) {
  const isEdit = editIdx >= 0 && eq;
  return `
    <h3 class="card-title">${isEdit ? 'Editar equipo' : 'Agregar equipo'}</h3>
    <input type="hidden" id="eq-editing-idx" value="${editIdx}" />
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
             value="${isEdit ? esc(eq.modelo) : ''}"
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

const _eqFotos = {};

// Limpiar fotos temporales al navegar a la vista de garantía
function _clearEqFotos() {
  Object.keys(_eqFotos).forEach(k => delete _eqFotos[k]);
}
window.capEqFoto = function(tipo, slotId) {
  capturePhoto(async (b64) => {
    toast('Subiendo foto…');
    // Usar un projectId genérico para fotos de equipo no vinculadas aún
    const fid = uuid();
    const result = await uploadPhotoQueued(b64, `projects/equipo_${tipo}_${fid}.jpg`,
      'equipo_temp', 'eqFoto', { tipo });
    _eqFotos[tipo] = result.url || b64; // fallback a b64 si está offline
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
function _serialUbicacion(p, serial) {
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

// scanLoteEstructura eliminado — campo Lote removido del formulario de estructura

window.showFormEquipo = function(projectId) {
  const form = document.getElementById('form-equipo');
  form.innerHTML = formEquipo(projectId); // siempre limpio al abrir
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

// ── 1D Estructura ─────────────────────────────────────────────────────────────
function renderCalcInfo(cfg, projectId) {
  if (!cfg) return `
  <div class="calc-info-banner calc-info-empty">
    <div class="cib-header">
      ${icon('calculator', 14)}
      <span>Sin datos de calculadora</span>
    </div>
    <p class="cib-hint">Genera el BOM en la calculadora para ver la estructura aquí.</p>
    <button class="btn-outline btn-sm" onclick="navigate('#calculadora/${projectId}')">
      ${icon('calculator', 14)} Abrir calculadora
    </button>
  </div>`;
  const estructuraLabel = cfg.estructura === 'k2' ? 'K2 Systems' : cfg.estructura === 'aluminex' ? 'Aluminex' : cfg.estructura || '—';
  const techoLabel      = cfg.techo === 'cemento' ? 'Concreto/losa' : cfg.techo === 'metal' ? 'Metálico/lámina' : cfg.techo || '—';
  const paneles         = cfg.layout?.totalPanels || '—';
  const modelo          = cfg.panel?.model || (cfg.panel?.width ? `${cfg.panel.width}×${cfg.panel.height} m` : '—');
  const rows            = cfg.layout?.rowsData || [];
  const layout          = rows.length ? rows.map((c,i)=>`F${i+1}: ${c}`).join(' · ') : '—';
  const ts              = cfg.timestamp ? new Date(cfg.timestamp).toLocaleDateString('es-MX', {day:'2-digit',month:'short',year:'numeric'}) : '';
  return `
  <div class="calc-info-banner">
    <div class="cib-header">
      ${icon('calculator', 14)}
      <span>Datos de calculadora</span>
      ${ts ? `<span class="cib-ts">${ts}</span>` : ''}
      <button class="btn-icon-xs" onclick="navigate('#calculadora/${projectId}')" title="Editar en calculadora">
        ${icon('pencil-simple', 12)}
      </button>
    </div>
    <div class="card-row">
      <div class="meta-item"><span class="meta-lbl">Sistema</span><span class="meta-val">${esc(estructuraLabel)}</span></div>
      <div class="meta-item"><span class="meta-lbl">Techo</span><span class="meta-val">${esc(techoLabel)}</span></div>
    </div>
    <div class="card-row">
      <div class="meta-item"><span class="meta-lbl">Paneles</span><span class="meta-val">${paneles}</span></div>
      <div class="meta-item"><span class="meta-lbl">Modelo</span><span class="meta-val">${esc(modelo)}</span></div>
    </div>
    <div class="card-row">
      <div class="meta-item meta-item-full"><span class="meta-lbl">Distribución</span><span class="meta-val">${esc(layout)}</span></div>
    </div>
  </div>`;
}

function renderEstructura(est, projectId, edit, cfg) {
  const calcBanner = renderCalcInfo(cfg, projectId);
  if (!est && !edit) return `${calcBanner}<p class="empty-msg-sm">Sin estructura registrada.</p>`;
  if (!est && edit) {
    return `${calcBanner}<button class="btn-primary btn-sm" onclick="navigate('#proyecto/${projectId}/garantia/estructura')">
      + Registrar estructura</button>`;
  }
  return `
    ${calcBanner}
    <div class="struct-info">
      <div class="card-row">
        <div class="meta-item"><span class="meta-lbl">Marca</span><span class="meta-val">${esc(est.marca||'—')}</span></div>
        <div class="meta-item"><span class="meta-lbl">Sistema</span><span class="meta-val">${esc(est.sistemaEstructural||'—')}</span></div>
      </div>
      <div class="card-row">
        <div class="meta-item"><span class="meta-lbl">Modelo</span><span class="meta-val">${esc(est.modelo||'—')}</span></div>
        <div class="meta-item"><span class="meta-lbl">Fijación</span><span class="meta-val">${esc(est.tipoFijacion||'—')}</span></div>
      </div>
      <div class="card-row">
        <div class="meta-item"><span class="meta-lbl">Metros riel</span><span class="meta-val">${est.metrosRiel||'—'} m</span></div>
        <div class="meta-item"><span class="meta-lbl">Mid-clamps</span><span class="meta-val">${est.midClamps||0} pzas</span></div>
      </div>
      <div class="card-row">
        <div class="meta-item"><span class="meta-lbl">End-clamps</span><span class="meta-val">${est.endClamps||0} pzas</span></div>
      </div>
      <div class="eq-fotos">
        ${fotoMini(est.fotoFrontal,'Frontal')}
        ${fotoMini(est.fotoAngulo,'Ángulo')}
      </div>
      ${est.notas ? `<p class="eq-notas">${esc(est.notas)}</p>` : ''}
    </div>
    ${edit ? `<button class="btn-outline btn-sm" onclick="navigate('#proyecto/${projectId}/garantia/estructura')">Editar estructura</button>` : ''}
  `;
}

// Form de estructura (como sub-ruta)
export async function renderEstructuraForm(projectId, session) {
  const project = await projects.getById(projectId);
  const est = project?.garantia?.estructura || {};
  _clearEqFotos(); // limpiar fotos temporales de sesiones anteriores
  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}/garantia')">${icon('caret-left')}</button>
    <h1 class="hdr-title">Estructura de montaje</h1>
  </div>
  <form class="form-card" onsubmit="guardarEstructura(event,'${projectId}')">
    <div class="form-group"><label>Marca *</label>
      <select name="marca">${MARCAS_ESTRUCTURA.map(m=>`<option ${est.marca===m?'selected':''}>${m}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Sistema estructural</label>
      <select name="sistemaEstructural">${SISTEMAS_ESTRUCTURALES.map(s=>`<option ${est.sistemaEstructural===s?'selected':''}>${s}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Modelo / Referencia</label>
      <input type="text" name="modelo" value="${esc(est.modelo||'')}" /></div>
    <div class="form-row">
      <div class="form-group"><label>Metros de riel (m)</label>
        <input type="number" name="metrosRiel" min="0" step="0.1" value="${est.metrosRiel||''}" /></div>
      <div class="form-group"><label>Tipo de fijación</label>
        <select name="tipoFijacion">${TIPOS_FIJACION.map(t=>`<option ${est.tipoFijacion===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Mid-clamps (pzas)</label>
        <input type="number" name="midClamps" min="0" value="${est.midClamps||0}" /></div>
      <div class="form-group"><label>End-clamps (pzas)</label>
        <input type="number" name="endClamps" min="0" value="${est.endClamps||0}" /></div>
    </div>
    <div class="fotos-captura-row">
      <div class="foto-cap-slot" id="slot-est-frontal">
        <button type="button" class="btn-foto-sm" onclick="capEqFoto('frontal','slot-est-frontal')">
          ${icon('camera')} Frontal</button>
        ${fotoMini(est.fotoFrontal,'Frontal')}
      </div>
      <div class="foto-cap-slot" id="slot-est-angulo">
        <button type="button" class="btn-foto-sm" onclick="capEqFoto('angulo','slot-est-angulo')">
          ${icon('camera')} Ángulo</button>
        ${fotoMini(est.fotoAngulo,'Ángulo')}
      </div>
    </div>
    <div class="form-group"><label>Notas (tipo de techo, observaciones)</label>
      <textarea name="notas" rows="2">${esc(est.notas||'')}</textarea></div>
    <div class="form-actions">
      <button type="button" class="btn-outline" onclick="navigate('#proyecto/${projectId}/garantia')">Cancelar</button>
      <button type="submit" class="btn-primary">Guardar estructura</button>
    </div>
  </form>`;
}

window.guardarEstructura = async function(e, projectId) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const p = await projects.getById(projectId);
  p.garantia.estructura = {
    marca:             fd.get('marca'),
    sistemaEstructural:fd.get('sistemaEstructural'),
    modelo:            fd.get('modelo').trim(),
    // numLote eliminado (no se incluye en factura para identificación)
    metrosRiel:        parseFloat(fd.get('metrosRiel'))||0,
    tipoFijacion:      fd.get('tipoFijacion'),
    midClamps:         parseInt(fd.get('midClamps'))||0,
    endClamps:         parseInt(fd.get('endClamps'))||0,
    fotoFrontal:       _eqFotos.frontal  || p.garantia.estructura?.fotoFrontal  || null,
    fotoAngulo:        _eqFotos.angulo   || p.garantia.estructura?.fotoAngulo   || null,
    notas:             fd.get('notas').trim(),
  };
  await projects.update(projectId, { garantia: p.garantia });
  Object.keys(_eqFotos).forEach(k => delete _eqFotos[k]);
  toast('✅ Estructura guardada');
  navigate(`#proyecto/${projectId}/garantia`);
};

// ── 1E Paneles + escaneo continuo ────────────────────────────────────────────
function renderPaneles(paneles, projectId, edit, catalog = [], fuenteCalc = null) {
  const totalPaneles = (paneles.strings||[]).reduce((s,str)=>s+(str.paneles?.length||0),0);
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

  <div class="card-title-row">
    <h3 class="card-title">Strings (${(paneles.strings||[]).length})</h3>
    ${edit ? `<button class="btn-primary btn-sm" onclick="agregarString('${projectId}')">+ String</button>` : ''}
  </div>

  ${(paneles.strings||[]).map((str,si) => renderString(str, si, projectId, edit)).join('')}
  `;
}

function renderString(str, idx, projectId, edit) {
  return `
  <div class="string-card">
    <div class="string-header">
      <span class="string-nombre">${esc(str.nombre)} (${str.paneles?.length||0} paneles)</span>
      <div class="string-actions">
        ${edit ? `
          <button class="btn-icon-sm" onclick="startScanString('${projectId}',${idx})" title="Escaneo continuo">
            ${icon('barcode')}
          </button>
          <button class="btn-icon-sm" onclick="addPanelManual('${projectId}',${idx})" title="Agregar manual">
            ${icon('plus')}
          </button>
          <button class="btn-del-sm" onclick="delString('${projectId}',${idx})">✕</button>
        ` : ''}
      </div>
    </div>

    <!-- Viewport del scanner continuo para este string -->
    <div id="scanner-${idx}" class="scanner-cont-container" style="display:none"></div>

    <div class="panel-list" id="panels-${idx}">
      ${(str.paneles||[]).map((pan,pi) => `
        <div class="panel-row">
          <span class="panel-letra">${pan.letra}</span>
          <span class="panel-serial ${!pan.serial?'panel-serial-empty':''}">${esc(pan.serial||'— sin serial')}</span>
          ${fotoMini(pan.fotoRespaldo,'Foto código')}
          ${edit ? `<button class="btn-del-sm" onclick="delPanel('${projectId}',${idx},${pi})">✕</button>` : ''}
        </div>
      `).join('')}
    </div>
  </div>
  `;
}

window.guardarInfoPanel = async function(projectId) {
  const p = await projects.getById(projectId);
  p.garantia.paneles.marca  = document.getElementById('panel-marca').value.trim();
  p.garantia.paneles.modelo = document.getElementById('panel-modelo').value.trim();
  p.garantia.paneles.wp     = parseFloat(document.getElementById('panel-wp').value)  || 0;
  p.garantia.paneles.voc    = parseFloat(document.getElementById('panel-voc').value)  || null;
  p.garantia.paneles.imp    = parseFloat(document.getElementById('panel-imp').value)  || null;
  await projects.update(projectId, { garantia: p.garantia });
  toast('✅ Info del panel guardada');
};

window.agregarString = async function(projectId) {
  const p = await projects.getById(projectId);
  const n = (p.garantia.paneles.strings||[]).length + 1;
  p.garantia.paneles.strings = [...(p.garantia.paneles.strings||[]), { nombre:`String ${n}`, paneles:[] }];
  await projects.update(projectId, { garantia: p.garantia });
  // Guardar target tab en sessionStorage para activarlo después del render
  sessionStorage.setItem('garantia-tab-target', 'g-paneles');
  navigate(`#proyecto/${projectId}/garantia`);
};

window.delString = async function(projectId, idx) {
  if (!await confirmDialog('¿Eliminar este string y todos sus paneles?')) return;
  const p = await projects.getById(projectId);
  p.garantia.paneles.strings.splice(idx,1);
  await projects.update(projectId, { garantia: p.garantia });
  navigate(`#proyecto/${projectId}/garantia`);
};

// ── Escaneo continuo de paneles ───────────────────────────────────────────────
let _activeScanStringIdx = -1;

window.startScanString = async function(projectId, stringIdx) {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Cerrar viejo scanner ZXing inline si estaba activo
  if (_activeScanStringIdx >= 0) {
    stopScanner();
    const old = document.getElementById(`scanner-${_activeScanStringIdx}`);
    if (old) old.style.display = 'none';
    _activeScanStringIdx = -1;
  }

  const strHeader = document.querySelector(`#scanner-${stringIdx}`)
    ?.closest('.string-card')
    ?.querySelector('.string-nombre')
    ?.textContent || `String ${stringIdx + 1}`;

  openScannerOverlay(
    async (serial) => {
      // Deduplicar contra TODO el proyecto (todos los strings + equipos)
      const pCheck = await projects.getById(projectId);
      const dup = _serialUbicacion(pCheck, serial);
      if (dup) {
        toast(`⚠ Serial ya registrado en ${dup}: ${serial}`, 'warning', 3500);
        return;
      }

      const p = await projects.getById(projectId);
      const str = p.garantia.paneles.strings[stringIdx];
      const nextLetra = letras[str.paneles.length] || `P${str.paneles.length + 1}`;

      str.paneles.push({ letra: nextLetra, serial, fotoRespaldo: null, createdAt: isoNow() });
      await projects.update(projectId, { garantia: p.garantia });

      // Actualizar lista en UI sin re-render completo
      const listEl = document.getElementById(`panels-${stringIdx}`);
      if (listEl) {
        const pi = str.paneles.length - 1;
        const row = document.createElement('div');
        row.className = 'panel-row';
        row.innerHTML = `
          <span class="panel-letra">${nextLetra}</span>
          <span class="panel-serial">${esc(serial)}</span>
          <button class="btn-del-sm" onclick="delPanel('${projectId}',${stringIdx},${pi})">✕</button>`;
        listEl.appendChild(row);
      }
      // Actualizar contador en el header del string
      const headerEl = document.querySelector(`#scanner-${stringIdx}`)
        ?.closest('.string-card')?.querySelector('.string-nombre');
      if (headerEl) {
        const p2 = await projects.getById(projectId);
        const count = p2?.garantia?.paneles?.strings?.[stringIdx]?.paneles?.length || 0;
        headerEl.textContent = `${strHeader.replace(/\(\d+.*\)/, '').trim()} (${count} paneles)`;
      }
      toast(`✅ Panel ${nextLetra}: ${serial}`);
    },
    {
      continuous: true,
      title: `Escanear paneles — ${strHeader}`,
      onClose: () => { _activeScanStringIdx = -1; }
    }
  );
  _activeScanStringIdx = stringIdx;
};

window.addPanelManual = async function(projectId, stringIdx) {
  // Mostrar modal de elección: escáner o texto manual
  const choice = await new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-confirm-overlay';
    overlay.innerHTML = `
      <div class="modal-confirm" role="dialog" aria-modal="true">
        <p class="modal-confirm-msg">¿Cómo quieres agregar el panel?</p>
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

  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  if (choice === 'scan') {
    const strNombre = (await projects.getById(projectId))
      ?.garantia?.paneles?.strings?.[stringIdx]?.nombre || `String ${stringIdx + 1}`;
    openScannerOverlay(
      async (serial) => {
        // Deduplicar contra TODO el proyecto
        const pCheck = await projects.getById(projectId);
        const dup = _serialUbicacion(pCheck, serial);
        if (dup) {
          toast(`⚠ Serial ya registrado en ${dup}: ${serial}`, 'warning', 3500);
          return;
        }
        const p = await projects.getById(projectId);
        const str = p.garantia.paneles.strings[stringIdx];
        const nextLetra = letras[str.paneles.length] || `P${str.paneles.length+1}`;
        str.paneles.push({ letra: nextLetra, serial: serial.trim(), fotoRespaldo: null, createdAt: isoNow() });
        await projects.update(projectId, { garantia: p.garantia });
        navigate(`#proyecto/${projectId}/garantia`);
      },
      { continuous: false, title: `Escanear panel — ${strNombre}` }
    );
  } else {
    const serial = await inputDialog('Número de serie del panel:');
    if (!serial?.trim()) return;
    const p = await projects.getById(projectId);
    const dup = _serialUbicacion(p, serial);
    if (dup) {
      toast(`⚠ Serial ya registrado en ${dup}: ${serial.trim()}`, 'warning', 3500);
      return;
    }
    const str = p.garantia.paneles.strings[stringIdx];
    const nextLetra = letras[str.paneles.length] || `P${str.paneles.length+1}`;
    str.paneles.push({ letra: nextLetra, serial: serial.trim(), fotoRespaldo: null, createdAt: isoNow() });
    await projects.update(projectId, { garantia: p.garantia });
    navigate(`#proyecto/${projectId}/garantia`);
  }
};

window.delPanel = async function(projectId, stringIdx, panelIdx) {
  if (!await confirmDialog('¿Eliminar este panel?')) return;
  const p = await projects.getById(projectId);
  p.garantia.paneles.strings[stringIdx].paneles.splice(panelIdx,1);
  await projects.update(projectId, { garantia: p.garantia });
  navigate(`#proyecto/${projectId}/garantia`);
};

// ── Notas de garantía ──────────────────────────────────────────────────────────
function renderNotas(notas, session, scope, projectId) {
  if (!notas.length) return '<p class="empty-msg-sm">Sin notas aún.</p>';
  return notas.map((n, i) => `
    <div class="nota-item">
      <div class="nota-header">
        <span class="nota-autor">${esc(n.autorNombre || '—')}</span>
        <span class="nota-fecha">${fmtFechaHora(n.createdAt)}</span>
        ${isAdmin(session) || session?.id === n.autorId
          ? `<button class="btn-del-sm" onclick="_delNota('${projectId}','${scope}',${i})">✕</button>` : ''}
      </div>
      <p class="nota-texto">${esc(n.texto)}</p>
    </div>
  `).join('');
}

window._showNotaGarantia = function(projectId) {
  document.getElementById('gnotas-form').style.display = 'block';
  document.getElementById('gnotas-texto').focus();
};

window._submitNotaGarantia = async function(projectId) {
  const texto = document.getElementById('gnotas-texto').value.trim();
  if (!texto) { toast('Escribe una nota','error'); return; }
  const session = JSON.parse(sessionStorage.getItem('ecofit_session') || 'null');
  const p = await projects.getById(projectId);
  const nota = { id: uuid(), texto, autorId: session?.id, autorNombre: session?.nombre || session?.username, createdAt: isoNow() };
  p.garantia.notas = [...(p.garantia.notas || []), nota];
  await projects.update(projectId, { garantia: p.garantia });
  document.getElementById('gnotas-list').innerHTML = renderNotas(p.garantia.notas, session, 'garantia', projectId);
  document.getElementById('gnotas-form').style.display = 'none';
  document.getElementById('gnotas-texto').value = '';
  // Actualizar badge del tab
  const tabBtn = document.querySelector('[data-tab="g-notas"]');
  if (tabBtn) tabBtn.innerHTML = `Notas<span class="tab-badge tab-ok">${p.garantia.notas.length}</span>`;
  toast('✅ Nota guardada');
};

window._delNota = async function(projectId, scope, idx) {
  if (!await confirmDialog('¿Eliminar esta nota?')) return;
  const session = JSON.parse(sessionStorage.getItem('ecofit_session') || 'null');
  const p = await projects.getById(projectId);
  if (scope === 'garantia') {
    p.garantia.notas = (p.garantia.notas || []).filter((_,i) => i !== idx);
    await projects.update(projectId, { garantia: p.garantia });
    document.getElementById('gnotas-list').innerHTML = renderNotas(p.garantia.notas, session, 'garantia', projectId);
    const tabBtn = document.querySelector('[data-tab="g-notas"]');
    if (tabBtn) tabBtn.innerHTML = p.garantia.notas.length
      ? `Notas<span class="tab-badge tab-ok">${p.garantia.notas.length}</span>` : 'Notas';
  }
  toast('Nota eliminada');
};

// ── Hook de tab para el módulo de Garantía (detener scanner al cambiar de tab)
// switchTab está definida globalmente en app.js — este hook añade el side-effect del scanner
window._onTabChange = function(tabBarId) {
  if (tabBarId === 'garantia-tabs' && _activeScanStringIdx >= 0) {
    stopScanner();
    const sc = document.getElementById(`scanner-${_activeScanStringIdx}`);
    if (sc) sc.style.display = 'none';
    _activeScanStringIdx = -1;
  }
};
