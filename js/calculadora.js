// calculadora.js — Calculadora BOM · Bitácora Ecofit V6

import { toast, confirmDialog, isoNow, esc } from './utils.js';
import { icon } from './icons.js';
import { projects, inventario as invStore, kv } from './db.js';
import {
  PANEL_PRESETS, C,
  calcBOM, calcConsumibles, buildProjectConfig, buildTorqueTable,
  footsPerRailCalc, railCutForRow, clampW,
  buildDiagramSVG, buildGuiaData,
} from '../modules/calculadora/index.js';

// ── Mapeo BOM part-number → ID de inventario ───────────────────────────────
const BOM_INV_MAP = {
  // ── Aluminex / NextRail ──────────────────────────────────────
  'NXT-AUA-30/46-2': 'C2-006',
  'NXT-CLIP-5':      'C2-007',
  'NXT-RS':          'C2-009',
  'NXT-RXCAP':       'C2-011',
  'NXT-SL-2':        'C2-004',
  'NXT-AUACAP-30':   'C2-010',
  'NXT-SFA-1':       'C2-002',
  'NXT-ARL-10/20':   'C2-003',
  'NXT-GC-1':        'ELE-005',
  // ── K2 Systems ───────────────────────────────────────────────
  '4000669':         'K2-001',  // CrossRail 48-X (4.70 m)
  '4000385':         'K2-002',  // RailConn CR 48-X (empalme)
  '4000630':         'K2-003',  // L-Foot Slotted Set K2
  '4000116':         'K2-004',  // Simple Tilt Knee Set
  '4000135':         'K2-005',  // MidClamp K2 Cross Clamp
  '4000135e':        'K2-006',  // EndClamp K2 Cross Clamp
  '4000431':         'K2-007',  // CrossRail Flat EndCap
  '4000006-H':       'K2-008',  // K2 Ground Lug (tierra)
  '4000505':         'K2-009',  // CrossRail Tilt Connector Set
  '4006042-H':       'K2-010',  // CrossRail Climber Set c/Hole
  // ── Madera ───────────────────────────────────────────────────────────────────
  'MAD-001':         'MAD-001', // Riel aluminio perforado 3.6 m
  'MAD-002':         'MAD-002', // Tirafondo 3/8" × 3" galv. viga-riel
  'MAD-003':         'MAD-003', // Tirafondo 1/4" × 2" galv. riel-panel
  'MAD-004':         'MAD-004', // Flashing aluminio por penetración
  'MAD-005':         'MAD-005', // Sellador impermeabilizante (puntos)
  'MAD-006':         'MAD-006', // Cintilla aluminio lateral
};

// ── Estado del módulo ──────────────────────────────────────────────────────
let _session    = null;
let _projectId  = null;
let _project    = null;
let _stockData  = {};
let _materials  = [];
let _allPresets = [...PANEL_PRESETS];


const cs = {
  estructura: null, subtipo: null, base: null, techo: null,
  alturaEdificio: null, condicionTecho: null,
  distMode: 'grid', cols: 1, rows: 1, irrRows: [1],
  pW: 0, pH: 0, presetId: null,
  gapH: 0.0113, gapV: 0.0113,
  // Madera (techo=madera)
  subtipoMadera: null, distVigas: 40,
};

function resetCS() {
  Object.assign(cs, {
    estructura: null, subtipo: null, base: null, techo: null,
    alturaEdificio: null, condicionTecho: null,
    distMode: 'grid', cols: 1, rows: 1, irrRows: [1],
    pW: 0, pH: 0, presetId: null,
    subtipoMadera: null, distVigas: 40,
  });
}

function loadFromConfig(cfg) {
  if (!cfg) return;
  cs.estructura     = cfg.estructura     ?? null;
  cs.subtipo        = cfg.subtipo        ?? null;
  cs.base           = cfg.base           ?? null;
  cs.techo          = cfg.techo          ?? null;
  cs.alturaEdificio = cfg.safety?.buildingHeight ?? null;
  cs.condicionTecho = cfg.safety?.roofCondition  ?? null;
  cs.distMode       = cfg.layout?.distMode  ?? 'grid';
  cs.cols           = cfg.layout?.cols      ?? 1;
  cs.rows           = cfg.layout?.rows      ?? 1;
  cs.irrRows        = cfg.layout?.rowsData  ?? [1];
  cs.pW             = cfg.panel?.width      ?? 0;
  cs.pH             = cfg.panel?.height     ?? 0;
  cs.presetId       = cfg.panel?.presetId   ?? null;
  cs.subtipoMadera  = cfg.madera?.subtipoMadera ?? null;
  cs.distVigas      = cfg.madera?.distVigas      ?? 40;
}

function getRowData() {
  return cs.distMode === 'grid'
    ? Array.from({ length: cs.rows }, () => cs.cols)
    : [...cs.irrRows];
}
function totalPanels() { return getRowData().reduce((s,c)=>s+c,0); }

// ── Paso activo del wizard ─────────────────────────────────────────────────
function wizardStep() {
  if (!cs.estructura)                               return 1;
  if (cs.estructura === 'k2' && !cs.subtipo)        return 2;
  if (cs.estructura === 'aluminex' && !cs.base)     return 2;
  if (!cs.techo)                                    return 3;
  if (cs.techo === 'madera' && !cs.subtipoMadera)   return 3;
  if (!cs.pW || cs.pW === 0)                        return 4;
  return 5;
}

// ── Render principal ───────────────────────────────────────────────────────
function renderCalc() {
  const step = wizardStep();
  const backUrl = _projectId ? `#proyecto/${_projectId}` : '#dashboard';
  const subtitle = _project
    ? (_project.clientName || _project.displayId)
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
  if (cs.pW)         parts.push(`${totalPanels()} paneles`);

  return `<div style="padding:8px 14px;background:var(--surface);border-bottom:1px solid var(--border);
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
  // Excluir el preset "custom/manual" de los chips principales
  const visiblePresets = _allPresets.filter(p => p.id !== 'custom');
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

// ── Diagrama SVG ───────────────────────────────────────────────────────────
function renderDiagrama() {
  const rd  = getRowData();
  const pW  = cs.pW || 1.134;
  const pH  = cs.pH || 1.990;
  const gapH = clampW(cs.estructura);
  const maxC = Math.max(...rd);
  const railLen         = railCutForRow(maxC, pW, cs.estructura);
  const distBetweenFeet = maxC > 1 ? (pW + gapH) : pW;
  const FOOT_F = '#f5c400';

  return `
  <div class="card" style="padding:0;overflow:hidden" id="diagram-card">
    <div style="padding:10px 14px;background:var(--surface2);display:flex;justify-content:space-between;align-items:center;gap:8px">
      <h3 class="card-title" style="margin:0">Diagrama — vista superior</h3>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-size:.72rem;color:var(--text-muted)">
          <span style="color:var(--g300)">${totalPanels()} pan.</span> ·
          <span style="color:var(--blue)">${railLen.toFixed(3)} m riel</span> ·
          <span style="color:${FOOT_F}">${distBetweenFeet.toFixed(3)} m entre patas</span>
        </span>
        <div class="diag-zoom-btns">
          <button class="diag-btn" onclick="diagZoom(-0.2)" title="Alejar">−</button>
          <button class="diag-btn" onclick="diagZoomReset()" title="Tamaño original">1:1</button>
          <button class="diag-btn" onclick="diagZoom(0.2)" title="Acercar">+</button>
          <button class="diag-btn" onclick="diagFullscreen()" title="Pantalla completa">⛶</button>
        </div>
      </div>
    </div>
    <div id="diag-wrap" style="padding:12px;overflow:auto;background:#0e1e11;cursor:grab">
      <div id="diag-inner" style="transform-origin:top left;transition:transform .15s;display:inline-block">
        ${buildDiagramSVG(rd, pW, pH, cs.estructura)}
      </div>
    </div>
  </div>`;
}

// ── BOM ────────────────────────────────────────────────────────────────────
function renderBOM() {
  const rd = getRowData();
  const bom = calcBOM(rd, cs.estructura, cs.subtipo, cs.base, cs.pW);
  const consumibles = cs.techo === 'madera'
    ? calcConsumiblesMadera(rd, cs.pW, cs.distVigas)
    : calcConsumibles(rd, cs.estructura, cs.techo);
  const torques = buildTorqueTable(cs.estructura, cs.techo);

  // Agrupar por grp
  const groups = {};
  bom.forEach(item => {
    if (!groups[item.grp]) groups[item.grp] = [];
    groups[item.grp].push(item);
  });

  const bomRows = Object.entries(groups).map(([grp, items]) => `
    <div style="margin-bottom:10px">
      <div style="font-size:.7rem;font-weight:700;color:var(--g300);letter-spacing:.06em;
        padding:4px 12px;background:var(--surface2)">${grp.toUpperCase()}</div>
      ${items.map(item => {
        const invId = BOM_INV_MAP[item.partNum];
        const stock = invId ? (_stockData[invId] ?? null) : null;
        const stockBadge = stock !== null
          ? (() => {
              const diff = stock - item.qty;
              const c = diff >= 0 ? 'var(--green-vivo)' : 'var(--red)';
              const label = diff >= 0 ? `✓ Stock: ${stock}` : `⚠ Stock: ${stock} (faltan ${Math.abs(diff)})`;
              return `<span style="font-size:.7rem;padding:2px 7px;border-radius:6px;
                background:${diff>=0?'rgba(46,189,66,.15)':'rgba(240,112,112,.15)'};
                color:${c};font-weight:700;white-space:nowrap">${label}</span>`;
            })()
          : '';
        return `
        <div style="display:flex;align-items:center;justify-content:space-between;
          padding:9px 12px;border-bottom:1px solid var(--border);gap:8px;flex-wrap:wrap">
          <div style="flex:1;min-width:160px">
            <div style="font-weight:600;font-size:.86rem;color:var(--text)">${item.name}</div>
            <div style="font-size:.7rem;color:var(--text-muted);margin-top:1px">${item.partNum}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            ${stockBadge}
            <span style="font-family:monospace;font-size:1.1rem;font-weight:900;
              color:var(--g300);min-width:36px;text-align:right">${item.qty}</span>
            <span style="font-size:.75rem;color:var(--text-muted)">${item.unit}</span>
          </div>
        </div>`;
      }).join('')}
    </div>`).join('');

  const consRows = consumibles.map(c=>`
    <div style="display:flex;justify-content:space-between;align-items:center;
      padding:8px 12px;border-bottom:1px solid var(--border)">
      <span style="font-size:.86rem;color:var(--text)">${c.nombre}</span>
      <span style="font-family:monospace;font-weight:700;color:var(--solar)">${c.qty} ${c.unit}</span>
    </div>`).join('');

  const torqRows = torques.map(t=>`
    <div style="padding:8px 12px;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:.84rem;font-weight:600;color:var(--text)">${t.comp}</span>
        <span style="font-family:monospace;font-weight:700;color:var(--g300);font-size:.84rem">${t.torque}</span>
      </div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">${t.nota}</div>
    </div>`).join('');

  const rdUniq = [...new Set(getRowData())].sort((a,b)=>a-b);
  const corteRows = rdUniq.map(c=>{
    const cut = railCutForRow(c, cs.pW, cs.estructura);
    const fps = footsPerRailCalc(c, cs.pW, cs.estructura);
    return `<div style="display:flex;justify-content:space-between;padding:7px 12px;
      border-bottom:1px solid var(--border);font-size:.84rem">
      <span style="color:var(--text)">${c} panel${c!==1?'es':''}/fila</span>
      <span style="font-family:monospace;color:var(--solar);font-weight:700">${cut.toFixed(3)} m</span>
      <span style="font-family:monospace;color:var(--text-muted)">${fps} patas</span>
    </div>`;
  }).join('');

  const totalMat = bom.reduce((s,i)=>s+i.qty, 0);

  return `
  <!-- Resumen total -->
  <div class="card calc-bom-total">
    <div class="cbt-title">Resumen BOM</div>
    <div class="cbt-items">
      <div class="cbt-item">
        <span class="cbt-num">${totalPanels()}</span>
        <span class="cbt-lbl">paneles</span>
      </div>
      <div class="cbt-sep"></div>
      <div class="cbt-item">
        <span class="cbt-num">${bom.length}</span>
        <span class="cbt-lbl">tipos material</span>
      </div>
      <div class="cbt-sep"></div>
      <div class="cbt-item">
        <span class="cbt-num">${totalMat}</span>
        <span class="cbt-lbl">pzas total</span>
      </div>
      <div class="cbt-sep"></div>
      <div class="cbt-item">
        <span class="cbt-num">${consumibles.length}</span>
        <span class="cbt-lbl">consumibles</span>
      </div>
    </div>
  </div>

  <!-- Lista de materiales (expandible, abierta por defecto) -->
  <details class="calc-section card" open>
    <summary class="calc-section-hdr">
      <span>Lista de materiales</span>
      <span class="calc-section-badge">${bom.length} ítems · ${totalPanels()} paneles</span>
      <span class="calc-section-caret">▾</span>
    </summary>
    <div class="calc-section-body">${bomRows}</div>
  </details>

  <!-- Consumibles -->
  <details class="calc-section card">
    <summary class="calc-section-hdr">
      <span>Consumibles de anclaje</span>
      <span class="calc-section-badge">${consumibles.length} ítems</span>
      <span class="calc-section-caret">▾</span>
    </summary>
    <div class="calc-section-body">${consRows}</div>
  </details>

  <!-- Cortes de riel -->
  <details class="calc-section card">
    <summary class="calc-section-hdr">
      <span>Cortes de riel</span>
      <span class="calc-section-badge">${rdUniq.length} tipo${rdUniq.length!==1?'s':''}</span>
      <span class="calc-section-caret">▾</span>
    </summary>
    <div class="calc-section-body">${corteRows}</div>
  </details>

  <!-- Torques -->
  <details class="calc-section card">
    <summary class="calc-section-hdr">
      <span>Torques de apriete</span>
      <span class="calc-section-badge">${torques.length} ítems</span>
      <span class="calc-section-caret">▾</span>
    </summary>
    <div class="calc-section-body">${torqRows}</div>
  </details>

  ${cs.techo === 'madera' ? `
  <!-- Nota instalación madera -->
  <div class="card" style="background:rgba(255,200,60,.07);border-color:var(--solar)">
    <div style="font-size:.8rem;color:var(--solar);font-weight:700;margin-bottom:6px">
      ⚠️ Consideraciones — techo de madera
    </div>
    <ul style="font-size:.78rem;color:var(--text-muted);padding-left:16px;margin:0;line-height:1.6">
      <li>Verificar estado de la madera antes de instalar (ver Documentación → Levantamiento).</li>
      <li>Usar flashing en <em>cada</em> penetración de tirafondo para evitar infiltración.</li>
      <li>Tirafondo 3/8" con sello de silicona en la base del flashing.</li>
      <li>Distancia mínima al borde de viga: 40 mm.</li>
      <li>Distancia entre vigas usada para este cálculo: <strong>${cs.distVigas} cm</strong>.</li>
    </ul>
  </div>` : ''}`;
}

// ── Consumibles anclaje en madera (reemplaza calcConsumibles para techo=madera) ───
function calcConsumiblesMadera(rd, pW, distVigas) {
  const dv   = (distVigas || 40) / 100;  // cm → m
  let anc38  = 0;

  rd.forEach(cols => {
    const span = cols * pW + 0.10;          // 5 cm vuelo cada lado
    const vigs = Math.ceil(span / dv) + 1;  // vigas bajo esa línea de riel
    anc38 += 2 * vigs * 2;                  // 2 tornillos/viga × 2 líneas de riel/fila
  });

  const flash = Math.round(anc38 / 2);     // 1 flashing por punto de anclaje (par)
  return [
    { nombre:'Tirafondo 3/8" × 3" galv. (riel-viga)', qty: anc38,  unit:'pzas'        },
    { nombre:'Flashing aluminio por penetración',      qty: flash,  unit:'pzas'        },
    { nombre:'Sellador impermeabilizante',             qty: flash,  unit:'aplicaciones'},
  ];
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
  if (!_projectId) {
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

  const prevDeduction = _project?.projectConfig?.inventoryDeducted;
  const propuestas    = _project?.propuestas || [];
  const nextNum       = propuestas.length + 1;

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
      <button class="btn-primary" style="flex:1;min-width:140px" onclick="calcGuardarPropuesta()">
        ${icon('floppy-disk', 16)} Guardar propuesta
      </button>
      <button class="btn-outline" style="flex:1;min-width:140px" onclick="calcGuardar()">
        ${icon('check', 16)} Aplicar al proyecto
      </button>
    </div>
    ${prevDeduction ? `<p style="font-size:.72rem;color:var(--g300);text-align:center;margin-top:8px">
      ✓ Inventario descontado el ${new Date(prevDeduction).toLocaleDateString('es-MX',{day:'2-digit',month:'short'})}
    </p>` : ''}
    ${propList}
  </div>
  <div style="height:20px"></div>`;
}

// ── Helper tarjeta de selección ────────────────────────────────────────────
// imgSrc opcional: muestra imagen; si no carga cae al ico (emoji/texto)
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

// ── Diagrama zoom / fullscreen ─────────────────────────────────────────────
let _diagScale = 1;
window.diagZoom = function(delta) {
  _diagScale = Math.min(3, Math.max(0.3, _diagScale + delta));
  const el = document.getElementById('diag-inner');
  if (el) el.style.transform = `scale(${_diagScale})`;
};
window.diagZoomReset = function() {
  _diagScale = 1;
  const el = document.getElementById('diag-inner');
  if (el) el.style.transform = 'scale(1)';
};
window.diagFullscreen = function() {
  const el = document.getElementById('diagram-card');
  if (!el) return;
  if (!document.fullscreenElement) {
    el.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
};
// Resetear zoom al re-renderizar
function _resetDiagZoom() { _diagScale = 1; }

// ── Re-render interno ──────────────────────────────────────────────────────
function calcRender() {
  _resetDiagZoom();
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = renderCalc();
  calcBind();
}

// ── Globales del wizard ────────────────────────────────────────────────────
window._calcReset = () => { resetCS(); calcRender(); };

window.calcSelectE = e => {
  cs.estructura = e; cs.subtipo = null; cs.base = null; calcRender();
};
window.calcSelectSub = s => { cs.subtipo = s; calcRender(); };
window.calcSelectBase = b => { cs.base = b; calcRender(); };
window.calcSelectTecho = t => { cs.techo = t; cs.subtipoMadera = null; calcRender(); };
window.calcSelectSubMad = s => { cs.subtipoMadera = s; calcRender(); };
window._madSetDistVigas = v => { const n = parseFloat(v); if (!isNaN(n) && n > 0) { cs.distVigas = n; calcRender(); } };
window.calcSetAltura = v => { cs.alturaEdificio = cs.alturaEdificio===v?null:v; calcRender(); };
window.calcSetCond   = v => { cs.condicionTecho = cs.condicionTecho===v?null:v; calcRender(); };
window.calcSetDist   = m => { cs.distMode=m; calcRender(); };

window.calcGrid = (field, delta) => {
  cs[field] = Math.max(1, cs[field]+delta);
  calcRender();
};
window.calcIrrChange = (i, delta) => {
  cs.irrRows[i] = Math.max(1, cs.irrRows[i]+delta);
  calcRender();
};
window.calcIrrAdd    = ()  => { cs.irrRows.push(1); calcRender(); };
window.calcIrrRemove = i   => { cs.irrRows.splice(i,1); calcRender(); };

window.calcSelectPreset = id => {
  cs.presetId = id;
  const p = _allPresets.find(x=>x.id===id);
  if (p && p.pW>0) { cs.pW=p.pW; cs.pH=p.pH; }
  else             { cs.pW=0; cs.pH=0; }
  calcRender();
};
window.calcSetDims = () => {
  const pw = parseFloat(document.getElementById('inp-pw')?.value);
  const ph = parseFloat(document.getElementById('inp-ph')?.value);
  if (!isNaN(pw)) cs.pW=pw;
  if (!isNaN(ph)) cs.pH=ph;
  // no re-render aquí para no interrumpir escritura; el BOM se actualiza al navegar
};

// ── Descuento automático de inventario ────────────────────────────────────
async function _deductBOMFromStock(bom) {
  const stockData = await invStore.get('stock');
  const stock     = { ...(stockData?.data ?? {}) };
  const month     = stockData?.month ?? '';

  const deducted = [];
  for (const item of bom) {
    const invId = BOM_INV_MAP[item.partNum];
    if (!invId || stock[invId] === undefined) continue;
    const before = stock[invId] || 0;
    const after  = Math.max(0, before - item.qty);
    stock[invId] = after;
    deducted.push({ invId, name: item.name, qty: item.qty, before, after });
  }

  if (deducted.length > 0) {
    await invStore.set('stock', { month, data: stock });
  }
  return deducted;
}

window.calcGuardar = async () => {
  if (!_projectId) return;
  try {
    const cfg              = buildProjectConfig(cs);
    // Madera: override consumibles y guardar parámetros específicos
    if (cs.techo === 'madera') {
      cfg.computed.consumibles = calcConsumiblesMadera(getRowData(), cs.pW, cs.distVigas);
      cfg.madera = { subtipoMadera: cs.subtipoMadera, distVigas: cs.distVigas };
    }
    const prevDeduction    = _project?.projectConfig?.inventoryDeducted;
    const bom              = cfg.computed?.bom || [];
    const bomWithMapping   = bom.filter(i => BOM_INV_MAP[i.partNum]);

    // Guardar BOM en proyecto
    await projects.update(_projectId, { projectConfig: cfg });

    // Preguntar descuento de inventario solo si hay ítems mapeados
    if (bomWithMapping.length > 0) {
      const msg = prevDeduction
        ? `Este BOM ya fue descontado del inventario el ${new Date(prevDeduction).toLocaleDateString('es-MX')}.\n\n¿Volver a descontar los materiales actuales?`
        : `¿Descontar estos ${bomWithMapping.length} materiales del inventario de bodega?\n\n(Confirma solo si los materiales ya salieron físicamente)`;

      const deduct = await confirmDialog(msg);

      if (deduct) {
        const result = await _deductBOMFromStock(bom);
        await projects.update(_projectId, {
          projectConfig: { ...cfg, inventoryDeducted: isoNow() }
        });
        toast(`✅ BOM guardado — ${result.length} ítem${result.length !== 1 ? 's' : ''} descontado${result.length !== 1 ? 's' : ''} del inventario`);
        navigate(`#proyecto/${_projectId}`);
        return;
      }
    }

    toast('BOM guardado en el proyecto ✓');
    navigate(`#proyecto/${_projectId}`);
  } catch(e) {
    toast(e.message, 'error');
  }
};


// ── Guardar como propuesta ────────────────────────────────────────────────
window.calcGuardarPropuesta = async () => {
  if (!_projectId) return;
  const nombre = document.getElementById('inp-prop-nombre')?.value?.trim()
    || `Propuesta ${(_project?.propuestas?.length||0)+1}`;
  try {
    const cfg        = buildProjectConfig(cs);
    const rd         = getRowData();
    const bom        = calcBOM(rd, cs.estructura, cs.subtipo, cs.base, cs.pW);
    const consumibles = cs.techo === 'madera'
      ? calcConsumiblesMadera(rd, cs.pW, cs.distVigas)
      : calcConsumibles(rd, cs.estructura, cs.techo);
    if (cs.techo === 'madera') {
      cfg.madera = { subtipoMadera: cs.subtipoMadera, distVigas: cs.distVigas };
    }
    const nueva = {
      id:          Date.now().toString(),
      nombre,
      createdAt:   isoNow(),
      createdBy:   _session?.nombre || _session?.username || '—',
      config:      cfg,
      bom,
      consumibles,
    };
    const propuestas = [...(_project?.propuestas || []), nueva];
    await projects.update(_projectId, { propuestas });
    _project = { ..._project, propuestas };
    toast(`Propuesta "${nombre}" guardada ✓`);
    calcRender();
  } catch(e) {
    toast(e.message, 'error');
  }
};

window.calcCargarPropuesta = (i) => {
  const p = _project?.propuestas?.[i];
  if (!p?.config) return;
  loadFromConfig(p.config);
  calcRender();
  toast(`Propuesta "${p.nombre || `#${i+1}`}" cargada`);
};

window.calcEliminarPropuesta = async (i) => {
  const p = _project?.propuestas?.[i];
  if (!p) return;
  const ok = await confirmDialog(`¿Eliminar propuesta "${p.nombre || `#${i+1}`}"?`);
  if (!ok) return;
  const propuestas = [...(_project?.propuestas || [])];
  propuestas.splice(i, 1);
  await projects.update(_projectId, { propuestas });
  _project = { ..._project, propuestas };
  toast('Propuesta eliminada');
  calcRender();
};

// ── Bind ───────────────────────────────────────────────────────────────────
function calcBind() {
  // handlers via onclick en window.*
}

// ── Entry point ────────────────────────────────────────────────────────────
export async function renderCalculadora(session, projectId) {
  _session   = session;
  _projectId = projectId || null;
  _project   = null;

  // Cargar stock del inventario y presets personalizados
  const [stockData, catalog, customPresets] = await Promise.all([
    invStore.get('stock'),
    invStore.get('catalog'),
    kv.get('panel_presets_custom'),
  ]);
  _stockData  = stockData?.data  ?? {};
  _materials  = catalog          ?? [];
  _allPresets = [...PANEL_PRESETS, ...(customPresets || [])];

  // Si viene de un proyecto, cargarlo
  if (_projectId) {
    _project = await projects.getById(_projectId);
    if (_project?.projectConfig) loadFromConfig(_project.projectConfig);
  }

  return renderCalc() + `<script>window._calcBind&&window._calcBind();<\/script>`;
}

window._calcBind = calcBind;
