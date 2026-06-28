// calculadora.js — Calculadora BOM · punto de entrada

import { inventario as invStore, projects, kv } from './db.js';
import { PANEL_PRESETS } from '../modules/calculadora/index.js';
import { cs, SX, loadFromConfig, loadTechoDesdeLevantamiento } from './calc-state.js';
import { renderCalc } from './calc-render.js';
import { _resetDiagZoom } from './calc-render-diagrama.js';
import './calc-actions.js'; // registra window.calcSelectE, calcGuardar, etc.

function calcRender() {
  _resetDiagZoom();
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = renderCalc();
  calcBind();
}

function calcBind() {
  // Handlers vía onclick en window.* — ya registrados en calc-actions.js
}

window._calcRender = calcRender;
window._calcBind   = calcBind;

export async function renderCalculadora(session, projectId) {
  SX.session   = session;
  SX.projectId = projectId || null;
  SX.project   = null;

  const [stockData, catalog, customPresets] = await Promise.all([
    invStore.get('stock'),
    invStore.get('catalog'),
    kv.get('panel_presets_custom'),
  ]);
  SX.stockData  = stockData?.data ?? {};
  SX.materials  = catalog ?? [];
  SX.allPresets = [...PANEL_PRESETS, ...(customPresets || [])];

  if (SX.projectId) {
    SX.project = await projects.getById(SX.projectId);
    if (SX.project?.projectConfig) loadFromConfig(SX.project.projectConfig);
    loadTechoDesdeLevantamiento(SX.project);
  }

  return renderCalc() + `<script>window._calcBind&&window._calcBind();<\/script>`;
}
