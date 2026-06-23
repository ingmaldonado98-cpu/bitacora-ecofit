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

// ── Getters de lectura — única fuente de verdad para leer projectConfig ────
// Soportan tanto el schema estructurado actual (layout.*, panel.*, computed.*)
// como proyectos viejos guardados solo con los campos compat planos, sin
// duplicar el fallback en cada uno de los consumidores.
export function getRowsData(cfg)        { return cfg?.layout?.rowsData    ?? cfg?.rowsData    ?? []; }
export function getTotalPanels(cfg)     { return cfg?.layout?.totalPanels ?? cfg?.paneles      ?? getRowsData(cfg).reduce((s,c)=>s+(parseInt(c,10)||0),0); }
export function getPanelWidth(cfg)      { return cfg?.panel?.width        ?? cfg?.pW           ?? 0; }
export function getPanelHeight(cfg)     { return cfg?.panel?.height       ?? cfg?.pH           ?? 0; }
export function getConsumiblesList(cfg) { return cfg?.computed?.consumibles ?? cfg?.consumibles ?? []; }

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
  };
}

// ── Diagrama SVG — función pura reutilizable ──────────────────────────────────
export function buildDiagramSVG(rd, pW, pH, estructura) {
  const gapH = clampW(estructura);
  const gapV = 0.0113;
  const OH   = C.OVERHANG;
  const totalR = rd.length;
  const maxC   = Math.max(...rd);
  const railLen = maxC * pW + (maxC - 1) * gapH + 2 * OH;
  const distBetweenFeet = maxC > 1 ? (pW + gapH) : pW;

  const ML = 56, MR = 20, MT = 60, MB = 40;
  let scale = (340 - ML - MR) / railLen;
  scale = Math.max(scale, 14);

  const pxW = pW * scale, pxH = pH * scale;
  const pxGH = gapH * scale, pxGV = gapV * scale, pxOH = OH * scale;
  const cW = ML + railLen * scale + MR + 24;
  const cH = MT + (totalR * pH + (totalR - 1) * gapV) * scale + MB + 30;
  const panelOriginX = ML + pxOH;

  const F        = 'Courier New,monospace';
  const PANEL_S  = '#22a832', PANEL_F = '#172d1c', CELL_L = '#1a4a22';
  const RAIL_C   = '#60a5fa', FOOT_F  = '#f5c400', FOOT_S = '#c49a00';
  const COT_C    = '#60a5fa', DIM_C   = '#64748b', RAIL_DIM = '#a78bfa';

  let s = `<svg viewBox="0 0 ${cW} ${cH}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${cW}px;display:block;margin:0 auto">`;
  s += `<defs>
    <marker id="ca" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M1,1 L6,3.5 L1,6 Z" fill="${COT_C}"/></marker>
    <marker id="da" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M1,1 L6,3.5 L1,6 Z" fill="${DIM_C}"/></marker>
    <marker id="ra" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M1,1 L6,3.5 L1,6 Z" fill="${RAIL_DIM}"/></marker>
    <marker id="fa" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M1,1 L6,3.5 L1,6 Z" fill="${FOOT_F}"/></marker>
  </defs>`;
  s += `<rect width="${cW}" height="${cH}" fill="#0e1e11" rx="8"/>`;

  let panelNum = 0;
  rd.forEach((cols_r, ri) => {
    const rowY   = MT + ri * (pxH + pxGV);
    const rowW   = cols_r * pxW + (cols_r - 1) * pxGH;
    const railX1 = ML;
    const railX2 = ML + rowW + 2 * pxOH;
    const railY1 = rowY + pxH * 0.22;
    const railY2 = rowY + pxH * 0.78;

    for (let ci = 0; ci < cols_r; ci++) {
      panelNum++;
      const px = panelOriginX + ci * (pxW + pxGH), py = rowY;
      s += `<rect x="${px}" y="${py}" width="${pxW}" height="${pxH}" fill="${PANEL_F}" stroke="${PANEL_S}" stroke-width="1.5" rx="2"/>`;
      const nV = Math.min(4, Math.floor(pxW / 22));
      for (let l = 1; l <= nV; l++) { const lx = px + l*(pxW/(nV+1)); s += `<line x1="${lx}" y1="${py}" x2="${lx}" y2="${py+pxH}" stroke="${CELL_L}" stroke-width="0.5" opacity="0.5"/>`; }
      const nH = Math.min(6, Math.floor(pxH / 16));
      for (let l = 1; l <= nH; l++) { const ly = py + l*(pxH/(nH+1)); s += `<line x1="${px}" y1="${ly}" x2="${px+pxW}" y2="${ly}" stroke="${CELL_L}" stroke-width="0.4" opacity="0.35"/>`; }
      if (pxW > 18 && pxH > 12) { const fs = Math.min(11, Math.max(6, pxW/5)); s += `<text x="${px+pxW/2}" y="${py+pxH/2+fs*0.35}" text-anchor="middle" fill="#4ade80" font-size="${fs}" font-family="${F}" font-weight="700">${panelNum}</text>`; }
    }

    s += `<line x1="${railX1}" y1="${railY1}" x2="${railX2}" y2="${railY1}" stroke="${RAIL_C}" stroke-width="2.5" stroke-linecap="round"/>`;
    s += `<line x1="${railX1}" y1="${railY2}" x2="${railX2}" y2="${railY2}" stroke="${RAIL_C}" stroke-width="2.5" stroke-linecap="round"/>`;
    if (ri === 0) s += `<text x="${railX1-4}" y="${railY1+3}" text-anchor="end" fill="${RAIL_C}" font-size="8" font-family="${F}">Riel</text>`;

    const footXs = [pxOH];
    for (let fi = 1; fi < cols_r; fi++) footXs.push(pxOH + fi*(pxW+pxGH) - pxGH/2);
    footXs.push(pxOH + cols_r*pxW + (cols_r-1)*pxGH);
    footXs.forEach(fx => {
      const ax = railX1+fx, fw = 8, fh = 10;
      s += `<rect x="${ax-fw/2}" y="${railY1-fh+2}" width="${fw}" height="${fh}" fill="${FOOT_F}" stroke="${FOOT_S}" stroke-width="0.8" rx="1.5"/>`;
      s += `<rect x="${ax-fw/2}" y="${railY2-2}" width="${fw}" height="${fh}" fill="${FOOT_F}" stroke="${FOOT_S}" stroke-width="0.8" rx="1.5"/>`;
    });

    if (ri === 0 && pxOH > 10) {
      const ohY = rowY - 14;
      s += `<line x1="${railX1}" y1="${ohY}" x2="${panelOriginX}" y2="${ohY}" stroke="${RAIL_DIM}" stroke-width="0.8" marker-end="url(#ra)" marker-start="url(#ra)"/>`;
      s += `<text x="${(railX1+panelOriginX)/2}" y="${ohY-4}" text-anchor="middle" fill="${RAIL_DIM}" font-size="8" font-family="${F}">0.05m</text>`;
    }
    if (ri === 0 && footXs.length >= 2 && pxW > 24) {
      const dY = rowY + pxH + 18;
      const dx1 = railX1+footXs[0], dx2 = railX1+footXs[1];
      s += `<line x1="${dx1}" y1="${dY}" x2="${dx2}" y2="${dY}" stroke="${FOOT_F}" stroke-width="0.8" marker-end="url(#fa)" marker-start="url(#fa)"/>`;
      s += `<text x="${(dx1+dx2)/2}" y="${dY+11}" text-anchor="middle" fill="${FOOT_F}" font-size="8" font-family="${F}" font-weight="700">${distBetweenFeet.toFixed(3)}m</text>`;
      s += `<text x="${(dx1+dx2)/2}" y="${dY+21}" text-anchor="middle" fill="#475569" font-size="7" font-family="${F}">entre patas</text>`;
    }
    if (totalR > 1) s += `<text x="${ML+rowW+2*pxOH+8}" y="${rowY+pxH/2+3}" fill="#475569" font-size="9" font-family="${F}">F${ri+1}</text>`;
  });

  const cotaY = MT - 28;
  s += `<line x1="${panelOriginX}" y1="${cotaY}" x2="${panelOriginX+pxW}" y2="${cotaY}" stroke="${COT_C}" stroke-width="1" marker-end="url(#ca)" marker-start="url(#ca)"/>`;
  s += `<line x1="${panelOriginX}" y1="${cotaY-5}" x2="${panelOriginX}" y2="${cotaY+5}" stroke="${COT_C}" stroke-width="0.8"/>`;
  s += `<line x1="${panelOriginX+pxW}" y1="${cotaY-5}" x2="${panelOriginX+pxW}" y2="${cotaY+5}" stroke="${COT_C}" stroke-width="0.8"/>`;
  s += `<text x="${panelOriginX+pxW/2}" y="${cotaY-6}" text-anchor="middle" fill="${COT_C}" font-size="9.5" font-family="${F}" font-weight="700">${pW.toFixed(3)} m</text>`;

  const railCotaY = MT - 44;
  const railX2c   = ML + maxC*pxW + (maxC>1?(maxC-1)*pxGH:0) + 2*pxOH;
  s += `<line x1="${ML}" y1="${railCotaY}" x2="${railX2c}" y2="${railCotaY}" stroke="${RAIL_DIM}" stroke-width="1" marker-end="url(#ra)" marker-start="url(#ra)"/>`;
  s += `<text x="${(ML+railX2c)/2}" y="${railCotaY-5}" text-anchor="middle" fill="${RAIL_DIM}" font-size="9" font-family="${F}" font-weight="700">${railLen.toFixed(3)} m — largo riel</text>`;

  const cotaX = panelOriginX - 30;
  s += `<line x1="${cotaX}" y1="${MT}" x2="${cotaX}" y2="${MT+pxH}" stroke="${COT_C}" stroke-width="1" marker-end="url(#ca)" marker-start="url(#ca)"/>`;
  s += `<line x1="${cotaX-5}" y1="${MT}" x2="${cotaX+5}" y2="${MT}" stroke="${COT_C}" stroke-width="0.8"/>`;
  s += `<line x1="${cotaX-5}" y1="${MT+pxH}" x2="${cotaX+5}" y2="${MT+pxH}" stroke="${COT_C}" stroke-width="0.8"/>`;
  s += `<text x="${cotaX-9}" y="${MT+pxH/2+3.5}" text-anchor="middle" fill="${COT_C}" font-size="9.5" font-family="${F}" font-weight="700" transform="rotate(-90,${cotaX-9},${MT+pxH/2+3.5})">${pH.toFixed(3)} m</text>`;

  if (maxC > 1) {
    const tW = maxC*pxW + (maxC-1)*pxGH;
    s += `<line x1="${panelOriginX}" y1="${MT-16}" x2="${panelOriginX+tW}" y2="${MT-16}" stroke="${DIM_C}" stroke-width="0.8" stroke-dasharray="3,2" marker-end="url(#da)" marker-start="url(#da)"/>`;
    s += `<text x="${panelOriginX+tW/2}" y="${MT-8}" text-anchor="middle" fill="${DIM_C}" font-size="7.5" font-family="${F}">${(maxC*pW+(maxC-1)*gapH).toFixed(3)} m</text>`;
  }
  if (totalR > 1) {
    const tHpx = totalR*pxH + (totalR-1)*pxGV;
    const tCX  = panelOriginX - 46;
    s += `<line x1="${tCX}" y1="${MT}" x2="${tCX}" y2="${MT+tHpx}" stroke="${DIM_C}" stroke-width="0.8" stroke-dasharray="3,2" marker-end="url(#da)" marker-start="url(#da)"/>`;
    s += `<text x="${tCX-9}" y="${MT+tHpx/2+3}" text-anchor="middle" fill="${DIM_C}" font-size="7.5" font-family="${F}" transform="rotate(-90,${tCX-9},${MT+tHpx/2+3})">${(totalR*pH+(totalR-1)*gapV).toFixed(3)} m total</text>`;
  }
  if (maxC > 1 && pxGH > 4) {
    const gx1 = panelOriginX+pxW, gx2 = panelOriginX+pxW+pxGH, gy = MT+pxH+6;
    s += `<line x1="${gx1}" y1="${gy}" x2="${gx2}" y2="${gy}" stroke="${DIM_C}" stroke-width="0.8" marker-end="url(#da)" marker-start="url(#da)"/>`;
    s += `<text x="${(gx1+gx2)/2}" y="${gy-4}" text-anchor="middle" fill="${DIM_C}" font-size="7" font-family="${F}">${gapH.toFixed(4)}m</text>`;
  }
  s += '</svg>';
  return s;
}

// ── Guía de instalación — datos por grupo de filas ────────────────────────────
export function buildGuiaData(rd, pW, pH, estructura) {
  const OH   = C.OVERHANG, S1 = C.S1_OFF, SPAN = C.FOOT_SPAN_MAX, CB = C.CLAMP_B_FRAC;
  const gH   = clampW(estructura);
  const groups = {};
  rd.forEach((n, ri) => {
    if (!groups[n]) groups[n] = { n, rows: [], cut: 2*OH + n*pW + Math.max(0,n-1)*gH };
    groups[n].rows.push(ri + 1);
  });
  return Object.values(groups).sort((a,b) => a.n - b.n).map(g => {
    const inner  = g.cut - 2*S1;
    const nSpans = Math.max(1, Math.ceil(inner / SPAN));
    const span   = inner / nSpans;
    return {
      n:         g.n,
      rows:      g.rows,
      cut:       g.cut,
      clampPos:  CB * pH,
      railGap:   (1 - 2*CB) * pH,
      feet:      Array.from({ length: nSpans+1 }, (_, fi) => S1 + fi*span),
      span,
    };
  });
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
