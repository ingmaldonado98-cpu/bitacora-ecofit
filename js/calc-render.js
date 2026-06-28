// calc-render.js — Funciones de render de la Calculadora BOM

import { esc } from './utils.js';
import { icon } from './icons.js';
import { cs, SX, totalPanels, getRowData, wizardStep, calcValidacion } from './calc-state.js';
import { C, clampW, buildGuiaData } from '../modules/calculadora/index.js';
import { renderBOM } from './calc-render-bom.js';
import { renderDiagrama } from './calc-render-diagrama.js';
import './pdf-calculadora.js'; // registra window.exportarBOMCalculadora

// ── Render principal ───────────────────────────────────────────────────────
export function renderCalc() {
  const step = wizardStep();
  const backUrl = SX.projectId ? `#proyecto/${SX.projectId}` : '#dashboard';
  const subtitle = SX.project
    ? (SX.project.clientName || SX.project.displayId)
    : 'Nueva consulta';

  return `
  <div class="view-header">
    <button class="btn-back" onclick="navigate('${backUrl}')">
      ${icon('caret-left')}
    </button>
    <div class="hdr-info" style="flex:1">
      <span class="hdr-id">Calculadora BOM</span>
      <span class="hdr-sub">${subtitle}</span>
    </div>
    <button class="btn-icon-hdr" onclick="window._calcReset()" title="Nueva consulta">
      ${icon('arrow-counter-clockwise', 18)}
    </button>
  </div>

  ${renderConfigBar()}
  ${renderPaso1()}
  ${step>=2 ? renderPaso2() : ''}
  ${step>=3 ? renderPaso3() : ''}
  ${step>=4 ? renderContexto() : ''}
  ${step>=4 ? renderDist() : ''}
  ${step>=4 ? renderPanel() : ''}
  ${step>=5 ? renderDiagrama() : ''}
  ${step>=5 ? renderBOM() : ''}
  ${step>=5 ? renderGuia() : ''}
  ${step>=5 ? renderCTA() : ''}
  `;
}

// ── Config bar ─────────────────────────────────────────────────────────────
function renderConfigBar() {
  const parts = [];
  if (cs.estructura) parts.push(cs.estructura==='k2' ? 'K2 Systems' : 'Aluminex');
  if (cs.subtipo)    parts.push(cs.subtipo==='tilt_up' ? 'Tilt Up' : 'Simple Tilt');
  if (cs.base)       parts.push(cs.base==='lfoot' ? 'L Foot' : 'Soportes F+T');
  if (cs.techo) {
    const techoLabel = { cemento:'Concreto', metal:'Metal/PTR', madera:'🪵 Madera' }[cs.techo] || cs.techo;
    const madSub = cs.techo==='madera' && cs.subtipoMadera
      ? ' · ' + ({ viga_exp:'Viga expuesta', duela:'Duela', lamina_mad:'Lámina s/madera' }[cs.subtipoMadera] || cs.subtipoMadera)
      : '';
    parts.push(techoLabel + madSub);
  }
  if (cs.pW) parts.push(`${totalPanels()} paneles`);

  const step    = wizardStep();
  const { ok }  = calcValidacion();
  const completo = step === 5 && ok;
  const pct     = completo ? 100 : Math.min(90, (step / 5) * 100);
  const nivelLbl = completo ? '¡Nivel completo!' : `Nivel ${step} de 5`;
  const fillColor = completo ? 'var(--g500)' : 'var(--solar)';

  return `
  <div class="calc-level-bar" style="padding:10px 14px 6px;background:var(--surface);border-bottom:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span style="font-size:.74rem;font-weight:700;color:${completo?'var(--g300)':'var(--text-muted)'};letter-spacing:.04em;text-transform:uppercase">${nivelLbl}</span>
    </div>
    <div class="calc-level-track">
      <div class="calc-level-fill" style="width:${pct}%;background:${fillColor}"></div>
      ${[1,2,3,4,5].map(n => `<span class="calc-level-dot ${n<=step?'calc-level-dot-on':''}" style="left:${(n-1)/4*100}%"></span>`).join('')}
    </div>
  </div>
  <div style="padding:8px 14px;background:var(--surface);border-bottom:1px solid var(--border);
    font-size:.78rem;color:var(--g300);display:flex;gap:6px;flex-wrap:wrap;align-items:center;min-height:36px">
    ${parts.length
      ? parts.map((p,i)=>`${i?'<span style="color:var(--border2)">›</span>':''}<span>${p}</span>`).join('')
      : '<span style="color:var(--text-muted)">Selecciona estructura, base y techo para comenzar</span>'}
  </div>`;
}

// ── Paso 1: Estructura ─────────────────────────────────────────────────────
function renderPaso1() {
  return `
  <div class="card">
    <div class="calc-step-label"><span class="calc-step-num">1</span> Estructura</div>
    <div class="calc-sel-grid">
      ${selCard("calcSelectE('k2')",       '🔩', 'K2 Systems', 'CrossRail + L-Foot',  cs.estructura==='k2',       './icons/k2-systems.png')}
      ${selCard("calcSelectE('aluminex')", '🪝', 'Aluminext',  'NextRail + soportes', cs.estructura==='aluminex', './icons/aluminext.png')}
    </div>
  </div>`;
}

// ── Paso 2: Subtipo K2 o Base Aluminex ────────────────────────────────────
function renderPaso2() {
  if (cs.estructura==='k2') return `
  <div class="card">
    <div class="calc-step-label"><span class="calc-step-num">2</span> Tipo montaje K2</div>
    <div class="calc-sel-grid">
      ${selCard("calcSelectSub('simple')",  '▬', 'Simple Tilt', 'Inclinación fija',    cs.subtipo==='simple')}
      ${selCard("calcSelectSub('tilt_up')", '◤', 'Tilt Up',     'Ajustable en campo',  cs.subtipo==='tilt_up')}
    </div>
  </div>`;

  return `
  <div class="card">
    <div class="calc-step-label"><span class="calc-step-num">2</span> Base Aluminex</div>
    <div class="calc-sel-grid">
      ${selCard("calcSelectBase('lfoot')",    '🦶', 'L Foot (NXT-SL)',  'Techo plano',             cs.base==='lfoot')}
      ${selCard("calcSelectBase('soportes')", '📐', 'Soportes F+T',    'Con inclinación angular',  cs.base==='soportes')}
    </div>
  </div>`;
}

// ── Paso 3: Techo ──────────────────────────────────────────────────────────
function renderPaso3() {
  const maderaSubForm = cs.techo === 'madera' ? `
  <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
    <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:10px;font-weight:600">
      🪵 Tipo de estructura de madera
    </div>
    <div class="calc-sel-grid" style="margin-bottom:12px">
      ${selCard("calcSelectSubMad('viga_exp')",  '🏠', 'Viga expuesta',   'Vigas a la vista',        cs.subtipoMadera==='viga_exp')}
      ${selCard("calcSelectSubMad('duela')",     '📋', 'Duela',           'Tablones / duela',        cs.subtipoMadera==='duela')}
      ${selCard("calcSelectSubMad('lamina_mad')","🪵", 'Lámina s/madera', 'Lámina sobre estructura', cs.subtipoMadera==='lamina_mad')}
    </div>
    <div class="form-group" style="margin-bottom:0">
      <label style="font-size:.78rem;color:var(--text-muted)">Distancia entre vigas (cm, centro a centro)</label>
      <input type="number" id="inp-dist-vigas" class="input-field" min="10" max="150"
        value="${cs.distVigas || 40}" placeholder="40–60 típico BCS"
        oninput="window._madSetDistVigas(this.value)" />
    </div>
  </div>` : '';

  return `
  <div class="card">
    <div class="calc-step-label"><span class="calc-step-num">3</span> Tipo de techo</div>
    <div class="calc-sel-grid">
      ${selCard("calcSelectTecho('cemento')", '🧱', 'Concreto',    'Epóxico + varilla',          cs.techo==='cemento')}
      ${selCard("calcSelectTecho('metal')",   '🏭', 'Metal / PTR', 'Varilla roscada directa',    cs.techo==='metal')}
      ${selCard("calcSelectTecho('madera')",  '🪵', 'Madera',      'Tirafondo + flashing',       cs.techo==='madera')}
    </div>
    ${maderaSubForm}
  </div>`;
}

// ── Contexto (opcional) ────────────────────────────────────────────────────
function chip(fn, val, label, active) {
  return `<button class="calc-chip ${active?'calc-chip-on':''}" onclick="${fn}">${label}</button>`;
}

function renderContexto() {
  return `
  <div class="card">
    <div class="calc-step-label" style="margin-bottom:10px">
      Contexto del proyecto
      <span style="font-size:.72rem;color:var(--text-muted);font-weight:400"> (opcional)</span>
    </div>
    <div class="calc-ctx-row">
      <span class="calc-ctx-lbl">Altura</span>
      ${chip("calcSetAltura('1')",  '1', '1 piso',   cs.alturaEdificio==='1')}
      ${chip("calcSetAltura('2')",  '2', '2 pisos',  cs.alturaEdificio==='2')}
      ${chip("calcSetAltura('3')",  '3', '3+ pisos', cs.alturaEdificio==='3')}
      ${chip("calcSetAltura('az')", 'az','Azotea',   cs.alturaEdificio==='az')}
    </div>
    <div class="calc-ctx-row" style="margin-top:8px">
      <span class="calc-ctx-lbl">Techo</span>
      ${chip("calcSetCond('nuevo')",   'n', 'Nuevo',     cs.condicionTecho==='nuevo')}
      ${chip("calcSetCond('bueno')",   'b', 'Bueno',     cs.condicionTecho==='bueno')}
      ${chip("calcSetCond('regular')", 'r', 'Regular ⚠️', cs.condicionTecho==='regular')}
    </div>
  </div>`;
}

// ── Distribución ───────────────────────────────────────────────────────────
// Hint informativo (no vinculante) con el área de techo capturada en el
// levantamiento de campo — evita que el técnico tenga que adivinar cuántos
// paneles entran sin volver a medir. El usuario decide si usa la sugerencia.
function _areaLevantamientoHint() {
  const area = SX.project?.documentacion?.levantamiento?.areasTecho?.[0];
  if (!area) return '';
  const dimTxt = (area.ancho && area.largo)
    ? `${area.ancho} × ${area.largo} m (${(area.ancho*area.largo).toFixed(1)} m²)`
    : (area.area ? `${area.area} m²` : null);
  if (!dimTxt) return '';
  let sugerencia = '';
  if (area.ancho && area.largo && cs.pW > 0 && cs.pH > 0) {
    const cols = Math.max(1, Math.floor(area.ancho / (cs.pW + cs.gapH)));
    const rows = Math.max(1, Math.floor(area.largo / (cs.pH + cs.gapV)));
    sugerencia = `
      <button type="button" class="btn-outline btn-sm" style="margin-left:8px"
        onclick="calcUsarSugerenciaArea(${cols},${rows})">
        Usar sugerencia: ${cols}×${rows} (${cols*rows} paneles)
      </button>`;
  }
  return `
  <div style="margin-bottom:10px;padding:8px 10px;background:var(--surface2);border-radius:var(--radius-sm);font-size:.8rem;display:flex;flex-wrap:wrap;align-items:center;gap:4px">
    <span style="color:var(--text-muted)">Área disponible (levantamiento)${area.nombre?` — ${esc(area.nombre)}`:''}:</span>
    <strong>${dimTxt}</strong>
    ${sugerencia}
  </div>`;
}

function renderDist() {
  const rd = getRowData();
  const total = rd.reduce((s,c)=>s+c,0);
  const anchors = rd.reduce((s,c)=>s+2*c+2,0);

  const irrRows = cs.irrRows.map((n,i)=>`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:.8rem;color:var(--text-muted);min-width:50px">Fila ${i+1}</span>
      <button class="calc-cnt-btn" onclick="calcIrrChange(${i},-1)" ${n<=1?'disabled':''}>−</button>
      <span style="min-width:28px;text-align:center;font-weight:700;font-family:monospace">${n}</span>
      <button class="calc-cnt-btn" onclick="calcIrrChange(${i},1)">+</button>
      ${cs.irrRows.length>1?`<button class="calc-cnt-btn" onclick="calcIrrRemove(${i})"
        style="border-color:var(--red);color:var(--red);font-size:.9rem">✕</button>`:''}
    </div>`).join('');

  return `
  <div class="card">
    <div class="calc-step-label"><span class="calc-step-num">4</span> Distribución de paneles</div>
    ${_areaLevantamientoHint()}
    <div style="display:flex;gap:6px;margin-bottom:14px">
      <button class="calc-chip ${cs.distMode==='grid'?'calc-chip-on':''}" onclick="calcSetDist('grid')">Cuadrícula</button>
      <button class="calc-chip ${cs.distMode==='irregular'?'calc-chip-on':''}" onclick="calcSetDist('irregular')">Filas irregulares</button>
    </div>

    ${cs.distMode==='grid' ? `
    <div class="calc-counter-row">
      <span class="calc-counter-lbl">Columnas</span>
      <button class="calc-cnt-btn" onclick="calcGrid('cols',-1)" ${cs.cols<=1?'disabled':''}>−</button>
      <span class="calc-cnt-num">${cs.cols}</span>
      <button class="calc-cnt-btn" onclick="calcGrid('cols',1)">+</button>
    </div>
    <div class="calc-counter-row">
      <span class="calc-counter-lbl">Filas</span>
      <button class="calc-cnt-btn" onclick="calcGrid('rows',-1)" ${cs.rows<=1?'disabled':''}>−</button>
      <span class="calc-cnt-num">${cs.rows}</span>
      <button class="calc-cnt-btn" onclick="calcGrid('rows',1)">+</button>
    </div>` : `
    <div>${irrRows}</div>
    <button class="btn-outline btn-sm" onclick="calcIrrAdd()" style="margin-top:4px">+ Agregar fila</button>
    `}

    <div style="margin-top:14px;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);
      display:flex;gap:20px;flex-wrap:wrap">
      <div>
        <span style="font-size:.72rem;color:var(--text-muted)">TOTAL PANELES</span>
        <div style="font-size:1.4rem;font-weight:900;font-family:monospace;color:var(--g300)">${total}</div>
      </div>
      <div>
        <span style="font-size:.72rem;color:var(--text-muted)">ANCLAJES</span>
        <div style="font-size:1.4rem;font-weight:900;font-family:monospace;color:var(--solar)">${anchors}</div>
      </div>
      ${rd.length>1?`<div>
        <span style="font-size:.72rem;color:var(--text-muted)">FILAS</span>
        <div style="font-size:1.4rem;font-weight:900;font-family:monospace;color:var(--text)">${rd.length}</div>
      </div>`:''}
    </div>
  </div>`;
}

// ── Panel ──────────────────────────────────────────────────────────────────
function renderPanel() {
  const visiblePresets = SX.allPresets.filter(p => p.id !== 'custom');
  const chips = visiblePresets.map(p=>`
    <button class="calc-preset-chip ${cs.presetId===p.id?'calc-preset-on':''}"
      onclick="calcSelectPreset('${p.id}')">
      <span style="font-weight:700;font-size:.85rem">${p.label}</span>
      <span style="font-size:.75rem;color:${cs.presetId===p.id?'var(--g100)':'var(--text-muted)'}">${p.sub}</span>
    </button>`).join('');

  const isCustom = cs.presetId==='custom';
  return `
  <div class="card">
    <div class="calc-step-label"><span class="calc-step-num">5</span> Modelo de panel — dimensiones</div>
    <p style="font-size:.78rem;color:var(--text-muted);margin:-4px 0 10px">
      Selecciona el modelo para calcular cortes y posición de rieles correctamente.
    </p>
    <div class="calc-preset-grid">${chips}</div>
    ${visiblePresets.length === 0 ? `
    <p style="font-size:.78rem;color:var(--text-muted);margin:8px 0">
      Sin modelos guardados. <button class="btn-link" onclick="navigate('#settings')">Agregar en Ajustes →</button>
    </p>` : ''}
    <p style="margin:8px 0 0;font-size:.75rem;color:var(--text-muted)">
      <button class="btn-link" onclick="calcSelectPreset('custom')" style="${isCustom?'color:var(--g300)':''}">
        ${isCustom ? '✎ Medida manual activa' : '+ Ingresar medida manual'}
      </button>
    </p>
    ${isCustom ? `
    <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
      <div class="form-group" style="flex:1;min-width:120px">
        <label>Ancho (m)</label>
        <input type="number" id="inp-pw" class="input-field" step="0.001" min="0.5" max="2.5"
          value="${cs.pW||''}" placeholder="1.134" oninput="calcSetDims()" />
      </div>
      <div class="form-group" style="flex:1;min-width:120px">
        <label>Alto (m)</label>
        <input type="number" id="inp-ph" class="input-field" step="0.001" min="1" max="3"
          value="${cs.pH||''}" placeholder="1.990" oninput="calcSetDims()" />
      </div>
    </div>` : ''}
    ${cs.pW>0 ? `<p style="font-size:.78rem;color:var(--text-muted);margin-top:8px">
      Dimensiones: <b style="color:var(--text)">${cs.pW} × ${cs.pH} m</b></p>` : ''}
  </div>`;
}

// ── Guía de instalación ────────────────────────────────────────────────────
function renderGuia() {
  const rd  = getRowData();
  const pW  = cs.pW || 1.134;
  const pH  = cs.pH || 1.990;
  const gH  = clampW(cs.estructura);
  const isAlx    = cs.estructura === 'aluminex';
  const railName = isAlx ? 'NXT-RX (4.20 m)' : 'CrossRail 48-X (4.70 m)';

  const blocks = buildGuiaData(rd, pW, pH, cs.estructura).map(g => {
    const { n, rows, cut, clampPos, railGap, feet, span } = g;
    const rowLbl = rows.length === 1 ? `Fila ${rows[0]}` : `Filas ${rows.join(', ')}`;

    const feetMarks = feet.map((fp, fi) => {
      const isEdge = fi === 0 || fi === feet.length - 1;
      const lbl = fi === 0 ? 'S1 izq.' : fi === feet.length - 1 ? `S${fi+1} der.` : `S${fi+1}`;
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;
        padding:6px 10px;border-radius:6px;
        background:${isEdge?'rgba(46,189,66,.12)':'var(--surface2)'};
        border:1px solid ${isEdge?'var(--g500)':'var(--border)'}">
        <span style="font-family:monospace;font-size:.9rem;font-weight:700;color:${isEdge?'var(--g300)':'var(--text)'}">${(fp*100).toFixed(1)} cm</span>
        <span style="font-size:.68rem;color:var(--text-muted)">${lbl}</span>
      </div>`;
    }).join('');

    return `
    <div style="margin-bottom:16px;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;
        padding:8px 14px;background:var(--surface2)">
        <span style="font-weight:700;font-size:.86rem;color:var(--text)">${rowLbl} — ${n} panel${n>1?'es':''}</span>
        <span style="font-family:monospace;font-size:.9rem;color:var(--solar);font-weight:700">✂ ${(cut*100).toFixed(1)} cm</span>
      </div>
      <div style="padding:12px 14px;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;gap:10px">
          <div style="width:24px;height:24px;border-radius:50%;background:var(--g500);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:#fff;flex-shrink:0;margin-top:1px">1</div>
          <div>
            <div style="font-size:.82rem;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.04em">Cortar ${railName}</div>
            <div style="font-size:.8rem;color:var(--text-muted);margin-top:3px">
              <b style="color:var(--text)">${(cut*100).toFixed(1)} cm</b>
              = ${(C.OVERHANG*200).toFixed(0)} cm vuelo × 2
              + ${n}×${(pW*100).toFixed(1)} cm panel
              ${n>1?`+ ${n-1}×${(gH*100).toFixed(1)} cm gap`:''}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <div style="width:24px;height:24px;border-radius:50%;background:var(--g500);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:#fff;flex-shrink:0;margin-top:1px">2</div>
          <div>
            <div style="font-size:.82rem;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.04em">Posición de rieles — regla del ¼</div>
            <div style="font-size:.8rem;color:var(--text-muted);margin-top:3px">
              Borde corto → centro del riel: <b style="color:var(--g300)">${(clampPos*100).toFixed(1)} cm</b>
              (¼ × ${(pH*100).toFixed(1)} cm alto)<br/>
              Separación entre rieles: <b style="color:var(--g300)">${(railGap*100).toFixed(1)} cm</b>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <div style="width:24px;height:24px;border-radius:50%;background:var(--g500);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:#fff;flex-shrink:0;margin-top:1px">3</div>
          <div style="flex:1">
            <div style="font-size:.82rem;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.04em">Marcar soportes — ${feet.length} pata${feet.length>1?'s':''} por riel</div>
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:3px;margin-bottom:8px">
              Span entre patas: <b style="color:var(--text)">${(span*100).toFixed(1)} cm</b>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">${feetMarks}</div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="card" style="padding:0;overflow:hidden">
    <div style="padding:10px 14px;background:var(--surface2);display:flex;justify-content:space-between;align-items:center">
      <h3 class="card-title" style="margin:0">Guía de instalación</h3>
      <span style="font-size:.75rem;color:var(--text-muted)">${isAlx?'Aluminex':'K2 Systems'} · ${cs.techo==='cemento'?'Concreto':'Metal'}</span>
    </div>
    <div style="padding:12px 14px">${blocks}</div>
  </div>`;
}

// ── CTA ────────────────────────────────────────────────────────────────────
function renderCTA() {
  if (!SX.projectId) {
    return `
    <div class="card">
      <p style="font-size:.84rem;color:var(--text-muted);margin-bottom:12px">
        Abre esta calculadora desde un proyecto para guardar el BOM directamente.
      </p>
      <button class="btn-outline btn-full" onclick="navigate('#dashboard')">
        ${icon('house', 18)} Ir al inicio
      </button>
    </div>
    <div style="height:20px"></div>`;
  }

  const prevDeduction = SX.project?.projectConfig?.inventoryDeducted;
  const propuestas    = SX.project?.propuestas || [];
  const nextNum       = propuestas.length + 1;
  const { ok: validoOk, faltantes } = calcValidacion();

  const propList = propuestas.length ? `
  <div class="calc-prop-list">
    <div class="calc-prop-list-title">Propuestas guardadas</div>
    ${propuestas.map((p, i) => `
    <div class="calc-prop-item">
      <div class="calc-prop-info">
        <span class="calc-prop-nombre">${esc(p.nombre || `Propuesta ${i+1}`)}</span>
        <span class="calc-prop-meta">
          ${new Date(p.createdAt).toLocaleDateString('es-MX',{day:'2-digit',month:'short'})}
          · ${p.bom?.length||0} mat · ${p.config?.layout?.totalPanels||0} pan.
        </span>
      </div>
      <div class="calc-prop-actions">
        <button class="btn-sm btn-outline" onclick="calcCargarPropuesta(${i})">Cargar</button>
        <button class="btn-sm calc-prop-del" onclick="calcEliminarPropuesta(${i})">✕</button>
      </div>
    </div>`).join('')}
  </div>` : '';

  return `
  <div class="card">
    <h3 class="card-title" style="margin-bottom:12px">Guardar propuesta</h3>
    <div class="form-group" style="margin-bottom:12px">
      <label style="font-size:.78rem;color:var(--text-muted)">Nombre</label>
      <input type="text" id="inp-prop-nombre" class="input-field"
        placeholder="Ej: Techo sur — 8 paneles K2"
        value="Propuesta ${nextNum}" />
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn-primary" style="flex:1;min-width:140px" ${validoOk?'':'disabled'} onclick="calcGuardarPropuesta()">
        ${icon('floppy-disk', 16)} Guardar propuesta
      </button>
      <button class="btn-outline" style="flex:1;min-width:140px" ${validoOk?'':'disabled'} onclick="calcGuardar()">
        ${icon('check', 16)} Aplicar al proyecto
      </button>
      <button class="btn-outline" style="flex:1;min-width:140px" ${validoOk?'':'disabled'} onclick="exportarBOMCalculadora()">
        ${icon('file-arrow-down', 16)} Exportar BOM
      </button>
    </div>
    ${!validoOk ? `<p style="font-size:.74rem;color:var(--red);text-align:center;margin-top:8px">
      ${icon('warning-circle', 13)} Faltan: ${faltantes.join(', ')}
    </p>` : ''}
    ${prevDeduction ? `<p style="font-size:.72rem;color:var(--g300);text-align:center;margin-top:8px">
      ✓ Inventario descontado el ${new Date(prevDeduction).toLocaleDateString('es-MX',{day:'2-digit',month:'short'})}
    </p>` : ''}
    ${propList}
  </div>
  <div style="height:20px"></div>`;
}

// ── Helper tarjeta de selección ────────────────────────────────────────────
function selCard(fn, ico, label, sub, active, imgSrc) {
  const icoHtml = imgSrc
    ? `<img src="${imgSrc}" alt="${label}" class="calc-sel-img"
            onerror="this.style.display='none';this.nextElementSibling.style.display='inline'"
       /><span class="calc-sel-ico" style="display:none">${ico}</span>`
    : `<span class="calc-sel-ico">${ico}</span>`;
  return `<button class="calc-sel-card ${active?'calc-sel-on':''}" onclick="${fn}">
    ${icoHtml}
    <span class="calc-sel-lbl">${label}</span>
    <span class="calc-sel-sub">${sub}</span>
  </button>`;
}

