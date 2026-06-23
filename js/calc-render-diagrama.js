// calc-render-diagrama.js — Diagrama SVG (vista superior) + zoom/fullscreen
// Extraído de calc-render.js.

import { cs, totalPanels, getRowData } from './calc-state.js';
import { clampW, railCutForRow, buildDiagramSVG } from '../modules/calculadora/index.js';

// ── Diagrama SVG ───────────────────────────────────────────────────────────
export function renderDiagrama() {
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

export function _resetDiagZoom() { _diagScale = 1; }
