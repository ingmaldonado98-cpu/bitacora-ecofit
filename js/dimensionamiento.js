// dimensionamiento.js — Vista de Memoria Técnica Preliminar

import { projects } from './db.js';
import { esc, toast, fmtFechaHora } from './utils.js';
import { isAdmin, isLider } from './auth.js';
import { icon } from './icons.js';
import { calcDimensionamiento, detectarRiesgos, getChecklistCampo, calcSeccionCable, awgToMm2 } from '../modules/dimensionamiento/index.js';

// ── Render principal ──────────────────────────────────────────────────────────
export async function renderDimensionamiento(projectId, session) {
  const project = await projects.getById(projectId);
  if (!project) return '<p class="empty-msg">Proyecto no encontrado.</p>';

  const edit  = isAdmin(session) || isLider(session);
  const lev   = project.documentacion?.levantamiento || {};
  const res   = calcDimensionamiento(project);
  const riesgos = detectarRiesgos(project);
  const campo   = getChecklistCampo(res);
  const savedCC = project.dimensionamiento?.campoChecks || {};
  const savedCCText = project.dimensionamiento?.campoText || {};

  return `
  <div class="breadcrumb">
    <span class="bc-link" onclick="navigate('#dashboard')">Inicio</span>
    <span class="bc-sep">›</span>
    <span class="bc-link" onclick="navigate('#proyecto/${projectId}')">${esc(project.displayId)}</span>
    <span class="bc-sep">›</span>
    <span class="bc-current">Dimensionamiento</span>
  </div>
  <div class="view-header">
    <button class="btn-back" onclick="navigate('#proyecto/${projectId}')">${icon('caret-left')}</button>
    <h1 class="hdr-title">Memoria Técnica</h1>
    <span class="hdr-sub">${esc(project.displayId)}</span>
  </div>

  <div class="dim-actions-row">
    <button class="btn-outline btn-sm" onclick="navigate('#documentacion/${projectId}')">
      ${icon('pencil-simple', 14)} Editar levantamiento
    </button>
    <button class="btn-outline btn-sm" onclick="dimExportPDF('${projectId}')">
      ${icon('file-pdf', 14)} Exportar PDF
    </button>
    <button class="btn-primary btn-sm" onclick="dimRecalc('${projectId}')">
      ${icon('arrows-clockwise', 14)} Recalcular
    </button>
  </div>

  ${res.error ? `
  <div class="dim-error-card">
    ${icon('warning', 24)}
    <div>
      <strong>Datos insuficientes para calcular</strong>
      <p>${esc(res.error)}</p>
      <button class="btn-primary btn-sm" onclick="navigate('#documentacion/${projectId}')">
        Completar levantamiento
      </button>
    </div>
  </div>` : `

  <!-- A. DIAGNÓSTICO ENERGÉTICO -->
  <div class="dim-section">
    <div class="dim-section-hdr">
      <span class="dim-section-letter">A</span>
      <h2 class="dim-section-title">Diagnóstico Energético</h2>
    </div>

    ${riesgos.length ? `
    <div class="dim-riesgos-list">
      ${riesgos.map(r => `
      <div class="dim-riesgo dim-riesgo-${r.nivel}">
        ${icon(r.nivel === 'error' ? 'x-circle' : 'warning', 16)}
        <span>${esc(r.msg)}</span>
      </div>`).join('')}
    </div>` : `
    <div class="dim-riesgo dim-riesgo-ok">
      ${icon('check-circle', 16)} <span>Sin riesgos críticos detectados en el levantamiento.</span>
    </div>`}

    <div class="dim-kpi-grid">
      ${_kpiCard('HSP del sitio', res.hsp + ' h/día', 'sun', lev.tMinCiudad || 'Promedio nacional')}
      ${res.kwhDia != null ? _kpiCard('Demanda diaria', res.kwhDia + ' kWh', 'lightning', 'Calculada del levantamiento') : ''}
      ${res.consMes != null ? _kpiCard('Consumo mensual est.', res.consMes + ' kWh/mes', 'chart-bar', '') : ''}
      ${res.genMes  != null ? _kpiCard('Generación FV est.', res.genMes + ' kWh/mes', 'solar-roof', '') : ''}
      ${res.cobertura != null ? _kpiCard('Cobertura solar', res.cobertura + '%', 'percent', 'Del consumo total') : ''}
      ${res.volDia  != null ? _kpiCard('Volumen diario', res.volDia + ' m³/día', 'drop', `${res.caudal} m³/h × ${res.horasBombeo}h`) : ''}
      ${res.cdt     != null ? _kpiCard('CDT estimada', res.cdt + ' m', 'arrow-up', `Pozo ${res.profundidad}m + 15% tuberías`) : ''}
    </div>

    ${lev.restricciones ? `
    <div class="dim-nota-campo">
      ${icon('note', 14)} <strong>Restricciones de campo:</strong> ${esc(lev.restricciones)}
    </div>` : ''}
  </div>

  <!-- B. ARQUITECTURA PROPUESTA -->
  <div class="dim-section">
    <div class="dim-section-hdr">
      <span class="dim-section-letter">B</span>
      <h2 class="dim-section-title">Arquitectura Propuesta</h2>
    </div>
    <div class="dim-modelo-table">
      ${Object.entries(res.modelo).map(([k, v]) => `
      <div class="dim-modelo-row">
        <span class="dim-modelo-key">${_labelModelo(k)}</span>
        <span class="dim-modelo-val">${esc(v)}</span>
      </div>`).join('')}
    </div>
  </div>

  <!-- C. DIMENSIONAMIENTO TÉCNICO -->
  <div class="dim-section">
    <div class="dim-section-hdr">
      <span class="dim-section-letter">C</span>
      <h2 class="dim-section-title">Dimensionamiento Técnico</h2>
    </div>
    ${_renderDimTable(res, lev, project.trayectorias)}
  </div>

  <!-- D. CHECKLIST DE COMISIONAMIENTO -->
  <div class="dim-section">
    <div class="dim-section-hdr">
      <span class="dim-section-letter">D</span>
      <h2 class="dim-section-title">Pruebas Eléctricas de Campo</h2>
    </div>
    <p class="dim-hint">Registra los valores medidos en sitio. Se guardan en el proyecto automáticamente.</p>
    <div class="cl-item-list">
      ${campo.map(it => {
        const done = !!savedCC[it.id];
        const val  = savedCCText[it.id] || '';
        return `
        <label class="cl-item ${done ? 'cl-item-done' : ''}">
          <input type="checkbox" ${done ? 'checked' : ''} ${!edit ? 'disabled' : ''}
            onchange="this.closest('.cl-item').classList.toggle('cl-item-done',this.checked);dimToggleCC('${projectId}','${it.id}',this.checked)">
          <div class="cl-item-text" style="width:100%">
            <span class="cl-item-name">${esc(it.n)}</span>
            ${it.hasInput ? `<div style="margin-top:6px">
              <input type="text" class="torq-input" style="max-width:200px"
                aria-label="${esc(it.n)} — valor medido"
                placeholder="${esc(it.placeholder||'Valor medido')}" ${!edit ? 'disabled' : ''}
                value="${esc(val)}"
                onchange="dimSaveCCText('${projectId}','${it.id}',this.value,this)"
                onclick="event.stopPropagation()">
            </div>` : ''}
          </div>
        </label>`;
      }).join('')}
    </div>
  </div>
  `}`;
}

// ── Helpers de render ─────────────────────────────────────────────────────────
function _kpiCard(label, value, ico, sub) {
  return `
  <div class="dim-kpi">
    <div class="dim-kpi-icon">${icon(ico, 20)}</div>
    <div class="dim-kpi-val">${esc(String(value))}</div>
    <div class="dim-kpi-label">${esc(label)}</div>
    ${sub ? `<div class="dim-kpi-sub">${esc(sub)}</div>` : ''}
  </div>`;
}

const _MOD_LABELS = {
  paneles:'Módulos FV', inversor:'Inversor', baterias:'Banco de baterías',
  controlador:'BMS / Controlador', protDC:'Protecciones DC',
  protAC:'Protecciones AC', ats:'Transferencia (ATS)',
  smart:'Medición / Smart meter', monitoreo:'Monitoreo',
  vfd:'Variador (VFD)', bomba:'Motor / Bomba', proteccion:'Protecciones bomba',
};
function _labelModelo(k) { return _MOD_LABELS[k] || k; }

function _renderDimTable(res, lev, trayectorias = []) {
  const rows = [];

  if (res.pvKwpReal != null)
    rows.push(['Capacidad FV instalada', `${res.pvKwpReal} kWp (${res.nPaneles} módulos × 580 Wp)`]);
  if (res.invKw != null && res.tipo !== 'hibrido')
    rows.push(['Potencia del inversor', `${res.invKw} kW`]);
  if (res.tipo === 'hibrido') {
    rows.push(['Inversor híbrido', `${res.invKw} kW (respaldo) + MPPT ${res.invGridKw} kW`]);
  }
  if (res.batKwh != null)
    rows.push(['Almacenamiento LFP', `${res.batKwh} kWh útiles${res.batVbus ? ` / ${res.batVbus}V DC` : ''}${res.batAh ? ` / ${res.batAh} Ah` : ''}`]);
  if (res.autonomia != null)
    rows.push(['Autonomía diseñada', `${res.autonomia} ${res.tipo === 'aislado' ? 'días' : 'horas'} (cargas críticas)`]);
  if (res.vfdKw != null)
    rows.push(['Variador de frecuencia', `${res.vfdKw} kW — acoplamiento DC directo`]);
  if (res.phidro != null)
    rows.push(['Potencia hidráulica req.', `${res.phidro} kW @ CDT ${res.cdt} m`]);

  // Caída de tensión estimada
  if (lev.distInversorPaneles) {
    const voltStr = res.tipo === 'interconectado' ? 400 : (res.batVbus || 48) * 3;
    const iStr = res.nPaneles ? Math.ceil(res.nPaneles / 12) * 10 : 10;
    const cable = calcSeccionCable({ longitud: lev.distInversorPaneles, corriente: iStr, vNominal: voltStr, pctMax: 0.01, tipo: 'DC' });
    rows.push(['Cable DC recomendado', `${cable.seccion} mm² Cu ≈ AWG ${cable.awg} — ΔV = ${cable.pctReal}% (límite 1%)`]);

    // Advertencia (no bloqueo) si algún tramo ya capturado en Trayectorias para
    // este mismo recorrido (paneles↔inversor) quedó con un calibre insuficiente.
    const tramoDC = (trayectorias || []).find(t =>
      /panel/i.test(t.nombre || '') && /(invers|combinad)/i.test(t.nombre || t.hasta || ''));
    if (tramoDC?.awg) {
      const mm2Capturado = awgToMm2(tramoDC.awg);
      if (mm2Capturado != null && mm2Capturado < cable.seccion) {
        rows.push(['⚠ Calibre insuficiente', `Tramo "${esc(tramoDC.nombre)}" capturado en AWG ${esc(tramoDC.awg)} (${mm2Capturado} mm²) — se requieren ${cable.seccion} mm² (AWG ${cable.awg}) para ΔV ≤ 1%.`]);
      }
    }
  }

  return `
  <div class="dim-modelo-table">
    ${rows.map(([k,v]) => `
    <div class="dim-modelo-row">
      <span class="dim-modelo-key">${esc(k)}</span>
      <span class="dim-modelo-val">${esc(v)}</span>
    </div>`).join('')}
  </div>`;
}

// ── Persistencia de checklist de campo ───────────────────────────────────────
window.dimToggleCC = (pid, id, v) =>
  projects.setField(pid, `dimensionamiento.campoChecks.${id}`, v);

// Timer POR campo (no compartido): un timer único descartaba la escritura de un
// campo si el usuario pasaba a otro antes de 600ms. Además da feedback por-input
// (clase .field-saved que pulsa el borde) al persistir, igual de claro que el
// indicador de autoguardado del levantamiento.
const _dimCCTimers = {};
window.dimSaveCCText = (pid, id, val, el) => {
  clearTimeout(_dimCCTimers[id]);
  _dimCCTimers[id] = setTimeout(async () => {
    await projects.setField(pid, `dimensionamiento.campoText.${id}`, val);
    if (el) { el.classList.add('field-saved'); setTimeout(() => el.classList.remove('field-saved'), 1400); }
  }, 600);
};

window.dimRecalc = (pid) => navigate(`#dimensionamiento/${pid}`);

// ── Exportar PDF ──────────────────────────────────────────────────────────────
window.dimExportPDF = async function(projectId) {
  const project = await projects.getById(projectId);
  const res     = calcDimensionamiento(project);
  const riesgos = detectarRiesgos(project);
  const campo   = getChecklistCampo(res);
  const savedCC = project.dimensionamiento?.campoChecks || {};
  const savedCCText = project.dimensionamiento?.campoText || {};
  const lev = project.documentacion?.levantamiento || {};

  if (res.error) { toast('Completa el levantamiento antes de exportar.', 'error'); return; }

  const checkRow = (done, label, val) =>
    `<tr class="${done?'done':''}"><td>${done?'☑':'☐'}</td><td>${label}${val?`<br><b style="color:#16a34a">${esc(val)}</b>`:''}</td></tr>`;

  const modeloRows = Object.entries(res.modelo)
    .map(([k,v]) => `<tr><td><b>${_labelModelo(k)}</b></td><td>${esc(v)}</td></tr>`).join('');

  const kpiItems = [
    res.hsp        && `HSP del sitio: <b>${res.hsp} h/día</b> — ${lev.tMinCiudad || 'Promedio nacional'}`,
    res.kwhDia     && `Demanda diaria: <b>${res.kwhDia} kWh/día</b>`,
    res.consMes    && `Consumo mensual estimado: <b>${res.consMes} kWh/mes</b>`,
    res.genMes     && `Generación FV estimada: <b>${res.genMes} kWh/mes</b>`,
    res.cobertura  && `Cobertura solar: <b>${res.cobertura}%</b>`,
    res.batKwh     && `Almacenamiento: <b>${res.batKwh} kWh LFP</b>`,
    res.vfdKw      && `VFD: <b>${res.vfdKw} kW</b> · Volumen diario: <b>${res.volDia} m³/día</b>`,
  ].filter(Boolean).map(l => `<li>${l}</li>`).join('');

  const riesgoRows = riesgos.map(r =>
    `<li style="color:${r.nivel==='error'?'#dc2626':'#d97706'}">${esc(r.msg)}</li>`
  ).join('') || '<li style="color:#16a34a">Sin riesgos detectados.</li>';

  const campoRows = campo.map(it =>
    checkRow(!!savedCC[it.id], it.n, savedCCText[it.id])
  ).join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Memoria Técnica — ${project.displayId}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:0;padding:20px}
    h1{font-size:16px;margin:0 0 2px} .sub{color:#666;font-size:10px;margin-bottom:12px}
    h2{font-size:12px;background:#1a1a1a;color:#fff;padding:4px 8px;margin:16px 0 6px;border-radius:3px}
    table{width:100%;border-collapse:collapse;margin-bottom:8px}
    td,th{padding:4px 6px;border-bottom:1px solid #eee;vertical-align:top}
    td:first-child{width:200px;color:#555}
    tr.done td{color:#888;text-decoration:line-through}
    ul{margin:4px 0;padding-left:16px} li{margin-bottom:3px}
    .status{background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:6px 10px;margin-bottom:12px;font-size:10px}
    @media print{body{padding:0}}
  </style></head><body>
  <h1>Memoria Técnica Preliminar — ${esc(project.displayId)}</h1>
  <p class="sub">${esc(project.clientName||'')} · ${esc(project.tipoSistema||'')} · ${lev.tMinCiudad||'Sin estado'} · Generada: ${new Date().toLocaleDateString('es-MX')}</p>

  <h2>A. Diagnóstico Energético</h2>
  <ul>${kpiItems}</ul>
  <b>Riesgos detectados:</b><ul>${riesgoRows}</ul>
  ${lev.restricciones?`<p><b>Restricciones de campo:</b> ${esc(lev.restricciones)}</p>`:''}

  <h2>B. Arquitectura Propuesta</h2>
  <table>${modeloRows}</table>

  <h2>C. Dimensionamiento Técnico</h2>
  ${_renderDimTable(res, lev, project.trayectorias).replace(/<div[^>]*>/g,'').replace(/<\/div>/g,'')}

  <h2>D. Pruebas Eléctricas de Campo</h2>
  <table><tbody>${campoRows}</tbody></table>
  </body></html>`;

  const blob = new Blob([html], { type:'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `memoria-tecnica-${projectId}.html`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('PDF generado');
};
