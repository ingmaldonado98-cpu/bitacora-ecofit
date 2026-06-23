// calc-render-bom.js — Render de la lista de materiales (BOM) de la Calculadora
// Extraído de calc-render.js.

import { cs, SX, totalPanels, getRowData, BOM_INV_MAP } from './calc-state.js';
import {
  calcBOM, calcConsumibles, buildTorqueTable,
  footsPerRailCalc, railCutForRow,
} from '../modules/calculadora/index.js';

// ── BOM ────────────────────────────────────────────────────────────────────
export function renderBOM() {
  const rd = getRowData();
  const bom = calcBOM(rd, cs.estructura, cs.subtipo, cs.base, cs.pW);
  const consumibles = cs.techo === 'madera'
    ? calcConsumiblesMadera(rd, cs.pW, cs.distVigas)
    : calcConsumibles(rd, cs.estructura, cs.techo);
  const torques = buildTorqueTable(cs.estructura, cs.techo);

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
        const stock = invId ? (SX.stockData[invId] ?? null) : null;
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

  <details class="calc-section card" open>
    <summary class="calc-section-hdr">
      <span>Lista de materiales</span>
      <span class="calc-section-badge">${bom.length} ítems · ${totalPanels()} paneles</span>
      <span class="calc-section-caret">▾</span>
    </summary>
    <div class="calc-section-body">${bomRows}</div>
  </details>

  <details class="calc-section card">
    <summary class="calc-section-hdr">
      <span>Consumibles de anclaje</span>
      <span class="calc-section-badge">${consumibles.length} ítems</span>
      <span class="calc-section-caret">▾</span>
    </summary>
    <div class="calc-section-body">${consRows}</div>
  </details>

  <details class="calc-section card">
    <summary class="calc-section-hdr">
      <span>Cortes de riel</span>
      <span class="calc-section-badge">${rdUniq.length} tipo${rdUniq.length!==1?'s':''}</span>
      <span class="calc-section-caret">▾</span>
    </summary>
    <div class="calc-section-body">${corteRows}</div>
  </details>

  <details class="calc-section card">
    <summary class="calc-section-hdr">
      <span>Torques de apriete</span>
      <span class="calc-section-badge">${torques.length} ítems</span>
      <span class="calc-section-caret">▾</span>
    </summary>
    <div class="calc-section-body">${torqRows}</div>
  </details>

  ${cs.techo === 'madera' ? `
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

// ── Consumibles anclaje en madera ──────────────────────────────────────────
export function calcConsumiblesMadera(rd, pW, distVigas) {
  const dv   = (distVigas || 40) / 100;
  let anc38  = 0;
  rd.forEach(cols => {
    const span = cols * pW + 0.10;
    const vigs = Math.ceil(span / dv) + 1;
    anc38 += 2 * vigs * 2;
  });
  const flash = Math.round(anc38 / 2);
  return [
    { nombre:'Tirafondo 3/8" × 3" galv. (riel-viga)', qty: anc38,  unit:'pzas'        },
    { nombre:'Flashing aluminio por penetración',      qty: flash,  unit:'pzas'        },
    { nombre:'Sellador impermeabilizante',             qty: flash,  unit:'aplicaciones'},
  ];
}
