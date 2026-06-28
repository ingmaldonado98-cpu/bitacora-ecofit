// calc-state.js — Estado compartido de la Calculadora BOM

import { PANEL_PRESETS, getRowsData, getPanelWidth, getPanelHeight } from '../modules/calculadora/index.js';

export const BOM_INV_MAP = {
  'NXT-AUA-30/46-2': 'C2-006',
  'NXT-CLIP-5':      'C2-007',
  'NXT-RS':          'C2-009',
  'NXT-RXCAP':       'C2-011',
  'NXT-SL-2':        'C2-004',
  'NXT-AUACAP-30':   'C2-010',
  'NXT-SFA-1':       'C2-002',
  'NXT-ARL-10/20':   'C2-003',
  'NXT-GC-1':        'ELE-005',
  '4000669':         'K2-001',
  '4000385':         'K2-002',
  '4000630':         'K2-003',
  '4000116':         'K2-004',
  '4000135':         'K2-005',
  '4000135e':        'K2-006',
  '4000431':         'K2-007',
  '4000006-H':       'K2-008',
  '4000505':         'K2-009',
  '4006042-H':       'K2-010',
  'MAD-001':         'MAD-001',
  'MAD-002':         'MAD-002',
  'MAD-003':         'MAD-003',
  'MAD-004':         'MAD-004',
  'MAD-005':         'MAD-005',
  'MAD-006':         'MAD-006',
};

// Módulo-level vars mutables (expuestas como objeto para evitar problemas con let export)
export const SX = {
  session: null, projectId: null, project: null,
  stockData: {}, materials: [], allPresets: [...PANEL_PRESETS],
};

export const cs = {
  estructura: null, subtipo: null, base: null, techo: null,
  alturaEdificio: null, condicionTecho: null,
  distMode: 'grid', cols: 1, rows: 1, irrRows: [1],
  pW: 0, pH: 0, presetId: null,
  gapH: 0.0113, gapV: 0.0113,
  subtipoMadera: null, distVigas: 40,
};

export function resetCS() {
  Object.assign(cs, {
    estructura: null, subtipo: null, base: null, techo: null,
    alturaEdificio: null, condicionTecho: null,
    distMode: 'grid', cols: 1, rows: 1, irrRows: [1],
    pW: 0, pH: 0, presetId: null,
    subtipoMadera: null, distVigas: 40,
  });
}

export function loadFromConfig(cfg) {
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
  cs.irrRows        = getRowsData(cfg).length ? getRowsData(cfg) : [1];
  cs.pW             = getPanelWidth(cfg)  ?? 0;
  cs.pH             = getPanelHeight(cfg) ?? 0;
  cs.presetId       = cfg.panel?.presetId   ?? null;
  cs.subtipoMadera  = cfg.madera?.subtipoMadera ?? null;
  cs.distVigas      = cfg.madera?.distVigas      ?? 40;
}

// Mapea el tipo de techo capturado en el levantamiento (lev.areasTecho[].tipTecho,
// en español) a la clave interna que usa la calculadora BOM (cs.techo).
const TECHO_LEV_A_CS = {
  'Losa de concreto': 'cemento',
  'Lámina':           'metal',
  'Carport':           'metal',
  'Madera':            'madera',
};

// Precarga cs.techo (y datos de madera) desde la primera área del levantamiento
// — solo si la calculadora todavía no tiene techo configurado (no sobreescribe
// una config ya guardada). El usuario puede cambiarlo libremente después.
export function loadTechoDesdeLevantamiento(project) {
  if (cs.techo) return;
  const area = project?.documentacion?.levantamiento?.areasTecho?.[0];
  if (!area) return;
  const techo = TECHO_LEV_A_CS[area.tipTecho];
  if (!techo) return;
  cs.techo = techo;
  if (techo === 'madera' && area.distVigas) cs.distVigas = area.distVigas;
}

export function getRowData() {
  return cs.distMode === 'grid'
    ? Array.from({ length: cs.rows }, () => cs.cols)
    : [...cs.irrRows];
}

export function totalPanels() { return getRowData().reduce((s,c)=>s+c,0); }

export function wizardStep() {
  if (!cs.estructura)                               return 1;
  if (cs.estructura === 'k2' && !cs.subtipo)        return 2;
  if (cs.estructura === 'aluminex' && !cs.base)     return 2;
  if (!cs.techo)                                    return 3;
  if (cs.techo === 'madera' && !cs.subtipoMadera)   return 3;
  if (!cs.pW || cs.pW === 0)                        return 4;
  return 5;
}

// Validación dura antes de permitir guardar/exportar — más estricta que
// wizardStep(), que solo controla qué secciones se muestran. Cubre el caso
// de borde alcanzable desde la UI (calcIrrRemove vaciando todas las filas).
export function calcValidacion() {
  const faltantes = [];
  if (!cs.estructura) faltantes.push('Sistema de estructura');
  else if (cs.estructura === 'k2' && !cs.subtipo) faltantes.push('Subtipo K2');
  else if (cs.estructura === 'aluminex' && !cs.base) faltantes.push('Base Aluminex');
  if (!cs.techo) faltantes.push('Tipo de techo');
  else if (cs.techo === 'madera' && !cs.subtipoMadera) faltantes.push('Subtipo de techo de madera');
  if (!cs.pW || cs.pW <= 0) faltantes.push('Dimensiones del panel');
  const rd = getRowData();
  if (!rd.length || rd.every(c => c <= 0)) faltantes.push('Al menos una fila de paneles');
  return { ok: faltantes.length === 0, faltantes };
}
