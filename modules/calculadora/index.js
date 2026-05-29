// modules/calculadora/index.js
// Motor de cálculo BOM + geometría para instalaciones solares Ecofit
// Funciones puras — sin dependencias de DOM

// ── Constantes NextRail / K2 ──────────────────────────────────────────────────
export const C = {
  OVERHANG:      0.05,   // vuelo del riel desde borde del panel (50 mm)
  CLAMP_B_FRAC:  0.25,   // posición del riel = 1/4 del largo del panel
  S1_OFF:        0.350,  // primer/último soporte desde extremo del riel (350 mm)
  FOOT_SPAN_MAX: 1.400,  // separación máxima entre soportes (1400 mm)
};

// ── Presets de panel ──────────────────────────────────────────────────────────
// Solo la opción manual base — los modelos reales se agregan desde Ajustes → Catálogo de paneles
export const PANEL_PRESETS = [
  { id: 'custom', label: 'Personalizado', sub: 'manual', pW: 0, pH: 0 },
];

// ── Tablas BOM ────────────────────────────────────────────────────────────────
// Índice 0 = 1 panel/fila … índice 9 = 10 paneles/fila
// fixed:1 → cantidad global (1 por instalación)
export const BOM_TABLES = {
  'k2-simple': [
    { n: 'CrossRail 48-X (4.70 m)',        p: '4000669',   v: [2,3,3,4,4,5,5,6,6,7],             u: 'pzas', grp: 'Rieles' },
    { n: 'RailConn CR 48-X (empalme)',      p: '4000385',   v: [0,0,0,0,2,2,2,2,4,4],             u: 'pzas', grp: 'Rieles' },
    { n: 'L-Foot Slotted Set K2',           p: '4000630',   v: [4,6,8,8,10,12,14,16,18,20],       u: 'pzas', grp: 'Bases' },
    { n: 'Simple Tilt Knee Set',            p: '4000116',   v: [4,6,8,8,10,12,14,16,18,20],       u: 'pzas', grp: 'Bases' },
    { n: 'MidClamp K2 Cross Clamp',         p: '4000135',   v: [0,2,4,6,8,10,12,14,16,18],       u: 'pzas', grp: 'Abrazaderas' },
    { n: 'EndClamp K2 Cross Clamp',         p: '4000135e',  v: [4,4,4,4,4,4,4,4,4,4],             u: 'pzas', grp: 'Abrazaderas' },
    { n: 'CrossRail Flat EndCap',           p: '4000431',   v: [4,4,4,4,4,4,4,4,4,4],             u: 'pzas', grp: 'Accesorios' },
    { n: 'K2 Ground Lug (tierra)',          p: '4000006-H', v: null, fixed: 1,                    u: 'pzas', grp: 'Tierra' },
  ],
  'k2-tiltup': [
    { n: 'CrossRail 48-X (4.70 m)',         p: '4000669',   v: [3,4,5,5,6,7,8,9,10,11],           u: 'pzas', grp: 'Rieles' },
    { n: 'RailConn CR 48-X (empalme)',      p: '4000385',   v: [0,0,0,0,2,2,2,2,4,4],             u: 'pzas', grp: 'Rieles' },
    { n: 'L-Foot Slotted Set K2',           p: '4000630',   v: [4,6,8,8,10,12,14,16,18,20],       u: 'pzas', grp: 'Bases' },
    { n: 'CrossRail Tilt Connector Set',    p: '4000505',   v: [2,3,4,4,5,6,7,8,9,10],            u: 'pzas', grp: 'Bases' },
    { n: 'CrossRail Climber Set c/Hole',    p: '4006042-H', v: [4,6,8,8,10,12,14,16,18,20],       u: 'pzas', grp: 'Bases' },
    { n: 'MidClamp K2 Cross Clamp',         p: '4000135',   v: [0,2,4,6,8,10,12,14,16,18],       u: 'pzas', grp: 'Abrazaderas' },
    { n: 'EndClamp K2 Cross Clamp',         p: '4000135e',  v: [4,4,4,4,4,4,4,4,4,4],             u: 'pzas', grp: 'Abrazaderas' },
    { n: 'CrossRail Flat EndCap',           p: '4000431',   v: [4,4,4,4,4,4,4,4,4,4],             u: 'pzas', grp: 'Accesorios' },
    { n: 'K2 Ground Lug (tierra)',          p: '4000006-H', v: null, fixed: 1,                    u: 'pzas', grp: 'Tierra' },
  ],
  'alx-plano': [
    { n: 'NextRail NXT-RX (4.20 m)',        p: 'NXT-RX-4200-MILL', v: [1,2,2,3,3,4,4,5,6,6],    u: 'pzas', grp: 'Rieles' },
    { n: 'NXT-RS Empalme de riel',          p: 'NXT-RS',           v: [0,0,0,0,2,2,2,4,4,4],    u: 'pzas', grp: 'Rieles' },
    { n: 'Tapas perfil NXT-RX (EndCap)',    p: 'NXT-RXCAP',        v: [4,4,4,4,4,4,4,4,4,4],    u: 'pzas', grp: 'Rieles' },
    { n: 'NXT-SL-2 Soporte L 105mm',       p: 'NXT-SL-2',         v: [4,4,6,8,10,10,12,12,14,16], u: 'pzas', grp: 'Bases' },
    { n: 'NXT-AUA Abrazadera universal',    p: 'NXT-AUA-30/46-2',  v: [4,6,8,10,12,14,16,18,20,22], u: 'pzas', grp: 'Abrazaderas' },
    { n: 'NXT-AUACAP-30 Tapa abrazadera',  p: 'NXT-AUACAP-30',    v: [4,4,4,4,4,4,4,4,4,4],    u: 'pzas', grp: 'Abrazaderas' },
    { n: 'NXT-CLIP-5 Clips cableado',       p: 'NXT-CLIP-5',       v: [0,1,2,2,3,3,4,4,5,5],    u: 'pzas', grp: 'Accesorios' },
    { n: 'NXT-GC-1 Terminal tierra',        p: 'NXT-GC-1',         v: null, fixed: 1,             u: 'pzas', grp: 'Tierra' },
  ],
  'alx-angular': [
    { n: 'NextRail NXT-RX (4.20 m)',        p: 'NXT-RX-4200-MILL', v: [1,2,2,3,3,4,4,5,5,6],    u: 'pzas', grp: 'Rieles' },
    { n: 'NXT-RS Empalme de riel',          p: 'NXT-RS',           v: [0,0,0,2,2,2,2,4,4,4],    u: 'pzas', grp: 'Rieles' },
    { n: 'Tapas perfil NXT-RX (EndCap)',    p: 'NXT-RXCAP',        v: [4,4,4,4,4,4,4,4,4,4],    u: 'pzas', grp: 'Rieles' },
    { n: 'NXT-SFA-1 Soporte Frontal',       p: 'NXT-SFA-1',        v: [2,3,3,4,5,6,7,8,8,9],    u: 'pzas', grp: 'Bases' },
    { n: 'NXT-ARL Soporte Trasero 10-20°',  p: 'NXT-ARL-10/20',    v: [2,3,3,4,5,6,7,8,8,9],    u: 'pzas', grp: 'Bases' },
    { n: 'NXT-AUA Abrazadera universal',    p: 'NXT-AUA-30/46-2',  v: [4,6,8,10,12,14,16,18,20,22], u: 'pzas', grp: 'Abrazaderas' },
    { n: 'NXT-AUACAP-30 Tapa abrazadera',  p: 'NXT-AUACAP-30',    v: [4,4,4,4,4,4,4,4,4,4],    u: 'pzas', grp: 'Abrazaderas' },
    { n: 'NXT-CLIP-5 Clips cableado',       p: 'NXT-CLIP-5',       v: [1,1,2,2,3,3,4,4,5,5],    u: 'pzas', grp: 'Accesorios' },
    { n: 'NXT-GC-1 Terminal tierra',        p: 'NXT-GC-1',         v: null, fixed: 1,             u: 'pzas', grp: 'Tierra' },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Ancho del gap entre paneles según estructura */
export function clampW(estructura) {
  return estructura === 'k2' ? 0.010 : 0.022;
}

/** Número de patas por riel para c paneles/fila */
export function footsPerRailCalc(c, pW, estructura) {
  const w = (pW > 0) ? pW : 1.134;
  const railLen = 2 * C.OVERHANG + c * w + Math.max(0, c - 1) * clampW(estructura);
  const inner = railLen - 2 * C.S1_OFF;
  if (inner <= 0) return 2;
  return Math.max(1, Math.ceil(inner / C.FOOT_SPAN_MAX)) + 1;
}

/** Longitud de corte de un riel para c paneles */
export function railCutForRow(c, pW, estructura) {
  return 2 * C.OVERHANG + c * pW + Math.max(0, c - 1) * clampW(estructura);
}

/** Selecciona la tabla BOM correcta */
export function getBOMTable(estructura, subtipo, base) {
  if (estructura === 'k2') {
    return BOM_TABLES[subtipo === 'tilt_up' ? 'k2-tiltup' : 'k2-simple'];
  }
  return BOM_TABLES[base === 'soportes' ? 'alx-angular' : 'alx-plano'];
}

/** Cantidad de un ítem para c paneles/fila (sin cap en 10) */
export function getBOMQty(item, c, pW, estructura) {
  if (item.fixed !== undefined) return item.fixed;
  if (c >= 1 && c <= 10) return item.v[c - 1];

  const nm = item.n.toLowerCase();
  if (/endclamp|end clamp/.test(nm))           return 4;
  if (/endcap|rxcap|tapas perfil/.test(nm))    return 4;
  if (/ground|lug|tierra|gc-1/.test(nm))       return 1;
  if (/auacap|tapa abrazadera/.test(nm))       return 4;
  if (/conn|empalme|nxt-rs/.test(nm))          return Math.max(0, Math.floor((c - 1) / 4)) * 2;
  if (/midclamp|mid clamp/.test(nm))           return 2 * (c - 1);
  if (/nxt-aua|abrazadera universal/.test(nm)) return 2 * (c + 1);
  if (/l-foot|l foot|knee|nxt-sl/.test(nm))    return footsPerRailCalc(c, pW, estructura) * 2;
  if (/nxt-sfa|nxt-arl|soporte/.test(nm))      return footsPerRailCalc(c, pW, estructura);
  if (/climber/.test(nm))                      return footsPerRailCalc(c, pW, estructura) * 2;
  if (/tilt connector/.test(nm))               return Math.floor(c / 2) + 2;
  if (/crossrail|nextrail|nxt-rx/.test(nm))    return Math.floor(c / 2) + 2;
  if (/clip/.test(nm))                         return c <= 1 ? 0 : Math.ceil(c / 2);

  // Fallback: extrapolación lineal desde los últimos 2 valores conocidos
  const rate = item.v[9] - item.v[8];
  return Math.max(0, item.v[9] + (c - 10) * rate);
}

/** Calcula el BOM completo a partir del array de filas */
export function calcBOM(rd, estructura, subtipo, base, pW) {
  const tbl = getBOMTable(estructura, subtipo, base);
  const result = [];
  tbl.forEach((item) => {
    const qty =
      item.fixed !== undefined
        ? item.fixed
        : rd.reduce((s, n) => s + getBOMQty(item, Math.max(n, 1), pW, estructura), 0);
    if (qty > 0) {
      result.push({ name: item.n, partNum: item.p, qty, unit: item.u, grp: item.grp });
    }
  });
  return result;
}

/** Consumibles de anclaje + sellado según configuración */
export function calcConsumibles(rd, estructura, techo) {
  const anchors = rd.reduce((s, c) => s + 2 * c + 2, 0);
  const isMetal = techo === 'metal';
  const tuercas = isMetal ? anchors * 2 : anchors;
  return [
    { nombre: 'Varilla roscada',       qty: anchors,      unit: 'pzas' },
    { nombre: 'Tuerca bridada',        qty: tuercas,      unit: 'pzas' },
    ...(isMetal
      ? [{ nombre: 'WD-40',            qty: 1,            unit: 'lata' }]
      : [
          { nombre: 'Epóxico anclaje', qty: anchors,      unit: 'pzas' },
          { nombre: 'Pipeta inyección',qty: anchors,      unit: 'pzas' },
        ]),
    { nombre: 'Sellador',              qty: 1,            unit: 'tubo' },
  ];
}

/** Construye el objeto projectConfig universal */
export function buildProjectConfig(cs) {
  const rd = cs.distMode === 'grid'
    ? Array.from({ length: cs.rows }, () => cs.cols)
    : cs.irrRows.slice();

  const totalPanelsVal = rd.reduce((s, c) => s + c, 0);
  const anchors = rd.reduce((s, c) => s + 2 * c + 2, 0);
  const bom = calcBOM(rd, cs.estructura, cs.subtipo, cs.base, cs.pW);
  const consumibles = calcConsumibles(rd, cs.estructura, cs.techo);
  const preset = PANEL_PRESETS.find((p) => p.id === cs.presetId) || null;

  return {
    timestamp:       new Date().toISOString(),
    estructura:      cs.estructura,
    subtipo:         cs.subtipo,
    base:            cs.base,
    techo:           cs.techo,
    panel: {
      presetId: cs.presetId,
      model:    preset && preset.pW > 0 ? `${preset.label} ${preset.sub}` : null,
      width:    cs.pW,
      height:   cs.pH,
    },
    layout: {
      distMode:    cs.distMode,
      rowsData:    rd,
      cols:        cs.cols,
      rows:        cs.rows,
      totalPanels: totalPanelsVal,
      totalAnchors: anchors,
      gapH:        cs.gapH,
      gapV:        cs.gapV,
    },
    engineering: {
      overhang:     C.OVERHANG,
      s1Off:        C.S1_OFF,
      footSpanMax:  C.FOOT_SPAN_MAX,
      clampBFrac:   C.CLAMP_B_FRAC,
      clampWidth:   clampW(cs.estructura),
    },
    safety: {
      buildingHeight: cs.alturaEdificio,
      roofCondition:  cs.condicionTecho,
    },
    computed: {
      bom,
      consumibles,
    },
    // compat fields
    paneles:     totalPanelsVal,
    anchors,
    pW:          cs.pW,
    pH:          cs.pH,
    rowsData:    rd,
    consumibles,
  };
}

// ── Torques de apriete (tabla de referencia Ecofit) ───────────────────────────
export function buildTorqueTable(estructura, techo) {
  const rows = [];
  if (estructura === 'k2') {
    rows.push(
      { comp: 'L-Foot → CrossRail',       torque: '8–10 N·m',  nota: 'T-bolt en ranura del riel' },
      { comp: 'CrossRail → EndClamp',     torque: '8–10 N·m',  nota: 'Sujeción al borde del panel' },
      { comp: 'CrossRail → MidClamp',     torque: '8–10 N·m',  nota: 'Centro entre paneles' },
      { comp: 'L-Foot → base (varilla)',  torque: '12–15 N·m', nota: 'Tuerca bridada sobre varilla roscada' },
    );
  } else {
    rows.push(
      { comp: 'NXT-SL / NXT-SFA → riel', torque: '10–12 N·m', nota: 'Perno M8 de soporte a riel' },
      { comp: 'NXT-AUA → riel',           torque: '8–10 N·m',  nota: 'Abrazadera universal NXT-AUA' },
      { comp: 'Soporte → base (varilla)', torque: '12–15 N·m', nota: 'Tuerca bridada sobre varilla roscada' },
    );
  }
  if (techo === 'cemento') {
    rows.push({ comp: 'Varilla en concreto', torque: '20–25 N·m', nota: 'Esperar curado epóxico ~1 h' });
  } else {
    rows.push({ comp: 'Varilla en PTR/lámina', torque: '15–18 N·m', nota: 'Aplicar WD-40 al perforar' });
  }
  return rows;
}
