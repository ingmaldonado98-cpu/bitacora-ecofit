// calc-actions.js — Handlers del wizard y acciones de la Calculadora BOM

import { toast, confirmDialog, isoNow } from './utils.js';
import { projects, inventario as invStore, logChange } from './db.js';
import { cs, SX, resetCS, getRowData, loadFromConfig, BOM_INV_MAP } from './calc-state.js';
import { calcBOM, calcConsumibles, buildProjectConfig } from '../modules/calculadora/index.js';
import { calcConsumiblesMadera } from './calc-render-bom.js';
import { isAdmin } from './auth.js';

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
window.calcUsarSugerenciaArea = (cols, rows) => {
  cs.distMode = 'grid'; cs.cols = Math.max(1, cols); cs.rows = Math.max(1, rows);
  window._calcRender();
};
window.calcIrrAdd    = ()  => { cs.irrRows.push(1); window._calcRender(); };
window.calcIrrRemove = i   => {
  if (cs.irrRows.length <= 1) { toast('Debe quedar al menos una fila', 'error'); return; }
  cs.irrRows.splice(i,1); window._calcRender();
};

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

// ── Firma del BOM — para detectar si es el mismo BOM ya descontado ────────
// Solo material + cantidad importa para inventario, no el orden ni otros
// campos del BOM (nombre, precio, etc.).
function _bomSignature(bom) {
  return (bom || [])
    .filter(i => BOM_INV_MAP[i.partNum])
    .map(i => `${i.partNum}:${i.qty}`)
    .sort()
    .join('|');
}

// ── Descuento automático de inventario ────────────────────────────────────
// deltaQtys: si se pasa, descuenta esa cantidad por invId en vez de item.qty
// — se usa para re-guardar un BOM que cambió sin volver a restar lo que ya
// se descontó la vez anterior (evita doble deducción del mismo material).
async function _deductBOMFromStock(bom, deltaQtys = null) {
  const stockData = await invStore.get('stock');
  const stock     = { ...(stockData?.data ?? {}) };
  const month     = stockData?.month ?? '';

  const deducted = [];
  for (const item of bom) {
    const invId = BOM_INV_MAP[item.partNum];
    if (!invId || stock[invId] === undefined) continue;
    const qty = deltaQtys ? (deltaQtys[invId] || 0) : item.qty;
    if (qty === 0) continue;
    const before = stock[invId] || 0;
    const after  = Math.max(0, before - qty);
    stock[invId] = after;
    deducted.push({ invId, name: item.name, qty, before, after });
  }

  if (deducted.length > 0) {
    await invStore.set('stock', { month, data: stock });
  }
  return deducted;
}

// Cantidad neta por invId a descontar cuando el BOM cambió respecto al ya
// descontado — solo la diferencia (nunca negativa: si bajó, no se repone
// automáticamente, eso es una decisión manual de bodega).
function _deltaQtys(newBom, prevBom) {
  const prevQty = {};
  for (const item of (prevBom || [])) {
    const invId = BOM_INV_MAP[item.partNum];
    if (invId) prevQty[invId] = (prevQty[invId] || 0) + item.qty;
  }
  const delta = {};
  for (const item of newBom) {
    const invId = BOM_INV_MAP[item.partNum];
    if (!invId) continue;
    const diff = item.qty - (prevQty[invId] || 0);
    if (diff > 0) delta[invId] = (delta[invId] || 0) + diff;
  }
  return delta;
}

window.calcGuardar = async () => {
  if (!SX.projectId) return;
  try {
    const cfg              = buildProjectConfig(cs);
    if (cs.techo === 'madera') {
      cfg.computed.consumibles = calcConsumiblesMadera(getRowData(), cs.pW, cs.distVigas);
      cfg.madera = { subtipoMadera: cs.subtipoMadera, distVigas: cs.distVigas };
    }
    cfg.aplicadoPor = { id: SX.session?.id, nombre: SX.session?.nombre || SX.session?.username || '—' };
    const prevDeduction    = SX.project?.projectConfig?.inventoryDeducted;
    const prevBom          = SX.project?.projectConfig?.inventoryDeductedBom || [];
    const bom              = cfg.computed?.bom || [];
    const bomWithMapping   = bom.filter(i => BOM_INV_MAP[i.partNum]);
    const bomCompacto      = bomWithMapping.map(i => ({ partNum: i.partNum, name: i.name, qty: i.qty }));

    await projects.update(SX.projectId, { projectConfig: cfg });

    logChange(SX.projectId, {
      modulo: 'Garantía',
      accion: 'BOM recalculado',
      detalle: `${cfg.layout?.totalPanels || 0} paneles · ${cfg.estructura}`,
      quien: SX.session,
    });

    if (bomWithMapping.length > 0 && isAdmin(SX.session)) {
      const esMismoBom = prevDeduction && _bomSignature(bom) === _bomSignature(prevBom);

      // Mismo BOM que el ya descontado — descontar de nuevo restaría el
      // mismo material dos veces (doble clic, reintento offline, o volver a
      // guardar sin cambios). No hay nada nuevo que descontar.
      if (esMismoBom) {
        toast('BOM guardado — es igual al ya descontado, el inventario no cambia');
        navigate(`#proyecto/${SX.projectId}`);
        return;
      }

      const msg = prevDeduction
        ? `Este BOM ya fue descontado del inventario el ${new Date(prevDeduction).toLocaleDateString('es-MX')} y cambió desde entonces.\n\n¿Descontar solo la diferencia de materiales respecto a lo ya descontado?`
        : `¿Descontar estos ${bomWithMapping.length} materiales del inventario de bodega?\n\n(Confirma solo si los materiales ya salieron físicamente)`;

      const deduct = await confirmDialog(msg);

      if (deduct) {
        const result = await _deductBOMFromStock(bom, prevDeduction ? _deltaQtys(bom, prevBom) : null);
        await projects.update(SX.projectId, {
          projectConfig: { ...cfg, inventoryDeducted: isoNow(), inventoryDeductedBom: bomCompacto }
        });
        toast(result.length
          ? `✅ BOM guardado — ${result.length} ítem${result.length !== 1 ? 's' : ''} descontado${result.length !== 1 ? 's' : ''} del inventario`
          : '✅ BOM guardado — sin materiales nuevos que descontar');
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
