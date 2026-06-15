// calc-actions.js — Handlers del wizard y acciones de la Calculadora BOM

import { toast, confirmDialog, isoNow } from './utils.js';
import { projects, inventario as invStore } from './db.js';
import { cs, SX, resetCS, getRowData, loadFromConfig, BOM_INV_MAP } from './calc-state.js';
import { calcBOM, calcConsumibles, buildProjectConfig } from '../modules/calculadora/index.js';
import { calcConsumiblesMadera } from './calc-render.js';

// ── Globales del wizard ────────────────────────────────────────────────────
window._calcReset = () => { resetCS(); window._calcRender(); };

window.calcSelectE = e => {
  cs.estructura = e; cs.subtipo = null; cs.base = null; window._calcRender();
};
window.calcSelectSub  = s => { cs.subtipo = s; window._calcRender(); };
window.calcSelectBase = b => { cs.base = b; window._calcRender(); };
window.calcSelectTecho = t => { cs.techo = t; cs.subtipoMadera = null; window._calcRender(); };
window.calcSelectSubMad = s => { cs.subtipoMadera = s; window._calcRender(); };
window._madSetDistVigas = v => {
  const n = parseFloat(v);
  if (!isNaN(n) && n > 0) { cs.distVigas = n; window._calcRender(); }
};
window.calcSetAltura = v => { cs.alturaEdificio = cs.alturaEdificio===v?null:v; window._calcRender(); };
window.calcSetCond   = v => { cs.condicionTecho = cs.condicionTecho===v?null:v; window._calcRender(); };
window.calcSetDist   = m => { cs.distMode=m; window._calcRender(); };

window.calcGrid = (field, delta) => {
  cs[field] = Math.max(1, cs[field]+delta);
  window._calcRender();
};
window.calcIrrChange = (i, delta) => {
  cs.irrRows[i] = Math.max(1, cs.irrRows[i]+delta);
  window._calcRender();
};
window.calcIrrAdd    = ()  => { cs.irrRows.push(1); window._calcRender(); };
window.calcIrrRemove = i   => { cs.irrRows.splice(i,1); window._calcRender(); };

window.calcSelectPreset = id => {
  cs.presetId = id;
  const p = SX.allPresets.find(x=>x.id===id);
  if (p && p.pW>0) { cs.pW=p.pW; cs.pH=p.pH; }
  else             { cs.pW=0; cs.pH=0; }
  window._calcRender();
};
window.calcSetDims = () => {
  const pw = parseFloat(document.getElementById('inp-pw')?.value);
  const ph = parseFloat(document.getElementById('inp-ph')?.value);
  if (!isNaN(pw)) cs.pW=pw;
  if (!isNaN(ph)) cs.pH=ph;
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
  if (!SX.projectId) return;
  try {
    const cfg              = buildProjectConfig(cs);
    if (cs.techo === 'madera') {
      cfg.computed.consumibles = calcConsumiblesMadera(getRowData(), cs.pW, cs.distVigas);
      cfg.madera = { subtipoMadera: cs.subtipoMadera, distVigas: cs.distVigas };
    }
    const prevDeduction    = SX.project?.projectConfig?.inventoryDeducted;
    const bom              = cfg.computed?.bom || [];
    const bomWithMapping   = bom.filter(i => BOM_INV_MAP[i.partNum]);

    await projects.update(SX.projectId, { projectConfig: cfg });

    if (bomWithMapping.length > 0) {
      const msg = prevDeduction
        ? `Este BOM ya fue descontado del inventario el ${new Date(prevDeduction).toLocaleDateString('es-MX')}.\n\n¿Volver a descontar los materiales actuales?`
        : `¿Descontar estos ${bomWithMapping.length} materiales del inventario de bodega?\n\n(Confirma solo si los materiales ya salieron físicamente)`;

      const deduct = await confirmDialog(msg);

      if (deduct) {
        const result = await _deductBOMFromStock(bom);
        await projects.update(SX.projectId, {
          projectConfig: { ...cfg, inventoryDeducted: isoNow() }
        });
        toast(`✅ BOM guardado — ${result.length} ítem${result.length !== 1 ? 's' : ''} descontado${result.length !== 1 ? 's' : ''} del inventario`);
        navigate(`#proyecto/${SX.projectId}`);
        return;
      }
    }

    toast('BOM guardado en el proyecto ✓');
    navigate(`#proyecto/${SX.projectId}`);
  } catch(e) {
    toast(e.message, 'error');
  }
};

window.calcGuardarPropuesta = async () => {
  if (!SX.projectId) return;
  const nombre = document.getElementById('inp-prop-nombre')?.value?.trim()
    || `Propuesta ${(SX.project?.propuestas?.length||0)+1}`;
  try {
    const cfg         = buildProjectConfig(cs);
    const rd          = getRowData();
    const bom         = calcBOM(rd, cs.estructura, cs.subtipo, cs.base, cs.pW);
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
      createdBy:   SX.session?.nombre || SX.session?.username || '—',
      config:      cfg,
      bom,
      consumibles,
    };
    const propuestas = [...(SX.project?.propuestas || []), nueva];
    await projects.update(SX.projectId, { propuestas });
    SX.project = { ...SX.project, propuestas };
    toast(`Propuesta "${nombre}" guardada ✓`);
    window._calcRender();
  } catch(e) {
    toast(e.message, 'error');
  }
};

window.calcCargarPropuesta = (i) => {
  const p = SX.project?.propuestas?.[i];
  if (!p?.config) return;
  loadFromConfig(p.config);
  window._calcRender();
  toast(`Propuesta "${p.nombre || `#${i+1}`}" cargada`);
};

window.calcEliminarPropuesta = async (i) => {
  const p = SX.project?.propuestas?.[i];
  if (!p) return;
  const ok = await confirmDialog(`¿Eliminar propuesta "${p.nombre || `#${i+1}`}"?`);
  if (!ok) return;
  const propuestas = [...(SX.project?.propuestas || [])];
  propuestas.splice(i, 1);
  await projects.update(SX.projectId, { propuestas });
  SX.project = { ...SX.project, propuestas };
  toast('Propuesta eliminada');
  window._calcRender();
};
