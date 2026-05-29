// modules/checklist/index.js
// Datos del checklist de instalación solar Ecofit
// Funciones puras — sin dependencias de DOM

// ── Herramienta por tipo de techo ─────────────────────────────────────────────
export const HERRAMIENTA = {
  cemento: [
    { id: 'h-plum',   n: 'Plumón permanente' },
    { id: 'h-cinta',  n: 'Cinta métrica' },
    { id: 'h-tiral',  n: 'Tiralineas' },
    { id: 'h-mak',    n: 'Makita', note: 'Modo rotomartillo' },
    { id: 'h-mil',    n: 'Milwaukee impacto', note: 'Para apretar tuercas bridadas — llevar adaptador dados' },
    { id: 'h-brocas', n: 'Brocas para concreto', note: 'Set: chica hasta 3/8"' },
    { id: 'h-guia',   n: 'Tubo guía', note: 'Para medir 5 cm de profundidad' },
    { id: 'h-sopla',  n: 'Sopladora de mano' },
    { id: 'h-cepil',  n: 'Cepillo limpiatuberías', note: 'Eliminar polvo del hoyo' },
    { id: 'h-pinzas', n: 'Pinzas de punta larga', note: 'Para manejo del epóxico' },
    { id: 'h-navaja', n: 'Navaja / cutter' },
    { id: 'h-tijera', n: 'Tijera' },
    { id: 'h-espat',  n: 'Espátula' },
    { id: 'h-rach',   n: 'Rach (trinquete) + dados', note: 'No usar Milwaukee — la varilla puede salirse' },
    { id: 'h-torque', n: 'Llave de torque' },
  ],
  metal: [
    { id: 'h-plum',   n: 'Plumón permanente' },
    { id: 'h-cinta',  n: 'Cinta métrica' },
    { id: 'h-tiral',  n: 'Tiralineas' },
    { id: 'h-taladro',n: 'Taladro Milwaukee' },
    { id: 'h-brocas', n: 'Brocas para metal', note: 'Set: chica hasta 3/8"' },
    { id: 'h-rach',   n: 'Rach (trinquete) + dados', note: 'No usar Milwaukee — la varilla puede salirse' },
    { id: 'h-torque', n: 'Llave de torque' },
  ],
};

// ── Consumibles dinámicos ─────────────────────────────────────────────────────
export function getConsumibles(estructura, base, techo) {
  const sellador = techo === 'cemento'
    ? { id: 'c-sell', n: 'Sellador blanco',       unit: 'tubos', note: 'Base de estructura y sellado de tuercas' }
    : { id: 'c-sell', n: 'Sellador transparente', unit: 'tubos', note: 'Base de estructura y sellado de tuercas' };

  const wd40 = techo === 'metal'
    ? [{ id: 'c-wd40', n: 'WD-40', unit: 'latas', note: 'Aplicar al perforar PTR/lámina' }]
    : [];

  const tuercas = { id: 'c-tuer', n: 'Tuercas bridadas', unit: 'pzas',
    note: techo === 'metal' ? 'O llevar: tuerca + arandela + arandela de presión' : undefined };

  const comun = [
    { id: 'c-var',  n: 'Varilla roscada', unit: 'pzas' },
    tuercas,
    sellador,
  ];

  const epoxico = techo === 'cemento'
    ? [
        { id: 'c-epox',  n: 'Epóxico anclaje químico', unit: 'pzas' },
        { id: 'c-pipeta',n: 'Pipetas de inyección',    unit: 'pzas', note: 'Un solo uso por pipeta' },
      ]
    : [];

  if (estructura === 'k2') {
    return [
      { id: 'c-lf-k2', n: 'Base L foot K2',              unit: 'pzas' },
      { id: 'c-neo',   n: 'Neopreno / empaque de base',  unit: 'pzas', note: 'K2 no incluye — colocar manualmente' },
      ...wd40, ...comun, ...epoxico,
    ];
  }
  if (estructura === 'aluminex' && base === 'lfoot') {
    return [
      { id: 'c-lf-alx', n: 'Base L foot Aluminex', unit: 'pzas' },
      ...wd40, ...comun, ...epoxico,
    ];
  }
  if (estructura === 'aluminex' && base === 'soportes') {
    return [
      { id: 'c-sfr', n: 'Soporte frontal Aluminex', unit: 'pzas' },
      { id: 'c-str', n: 'Soporte trasero Aluminex', unit: 'pzas' },
      ...wd40, ...comun, ...epoxico,
    ];
  }
  return [...comun, ...epoxico];
}

// ── Ítems de revisión del Admin ───────────────────────────────────────────────
export const ADMIN_REVIEW_ITEMS = [
  { id: 'rv1', label: 'Dimensiones del panel ingresadas y verificadas',        detail: 'pW × pH coincide con especificación del modelo' },
  { id: 'rv2', label: 'Número de paneles y distribución de filas confirmada',  detail: 'Total == lo que el cliente contrató' },
  { id: 'rv3', label: 'Diagrama revisado — rieles, patas y clamps',            detail: 'Posición de soportes S1, cotas y voladizo correctos' },
  { id: 'rv4', label: 'Medidas de corte de riel correctas',                    detail: 'Largo de riel y número de barras confirmados' },
  { id: 'rv5', label: 'BOM verificado contra inventario de bodega',            detail: 'Todos los materiales físicamente disponibles' },
  { id: 'rv6', label: 'Técnico asignado y notificado',                         detail: 'Sabe fecha, hora y ubicación de la instalación' },
  { id: 'rv7', label: 'Estado del techo confirmado — inspección previa hecha', detail: 'Sin fisuras, humedad ni obstrucciones relevantes' },
  { id: 'rv8', label: 'Equipo de seguridad disponible',                        detail: 'Líneas de vida, casco y arnés según altura del edificio' },
  { id: 'rv9', label: 'Consumibles listos (epóxico, brocas, tapones)',         detail: 'Cantidad suficiente para el número de anclajes' },
];

export function emptyChecklistState() {
  return {
    st:          {},
    qty:         {},
    adminChecks: {},
    approvedBy:  null,
    approvedAt:  null,
  };
}

// ── Pasos de ejecución en campo ───────────────────────────────────────────────
export const EXEC_CHECKLIST = {
  cemento: [
    { id: 'ex-01', n: 'Herramienta y consumibles cargados y verificados' },
    { id: 'ex-02', n: 'Diagrama de instalación revisado con el equipo' },
    { id: 'ex-03', n: 'Área de techo limpia y despejada' },
    { id: 'ex-04', n: 'Trazado de paneles con tiralineas' },
    { id: 'ex-05', n: 'Puntos de anclaje marcados según diagrama' },
    { id: 'ex-06', n: 'Perforación de hoyos — profundidad 5 cm con tubo guía' },
    { id: 'ex-07', n: 'Hoyos soplados y cepillados (sin polvo)' },
    { id: 'ex-08', n: 'Epóxico inyectado con pipeta (una pipeta por hoyo)' },
    { id: 'ex-09', n: 'Varilla roscada instalada y alineada' },
    { id: 'ex-10', n: 'Curado de epóxico completado (≥ 20 min)' },
    { id: 'ex-11', n: 'Bases L-foot colocadas con neopreno' },
    { id: 'ex-12', n: 'Rieles instalados y nivelados' },
    { id: 'ex-13', n: 'Cortes de riel correctos (medidas del diagrama)' },
    { id: 'ex-14', n: 'Paneles montados y sujetados (mid/end-clamps)' },
    { id: 'ex-15', n: 'Torque aplicado con llave de torque' },
    { id: 'ex-16', n: 'Bases selladas con sellador blanco' },
    { id: 'ex-17', n: 'Tuercas selladas' },
    { id: 'ex-18', n: 'Cableado DC conectado — polaridad verificada' },
    { id: 'ex-19', n: 'Puesta a tierra instalada' },
    { id: 'ex-20', n: 'Inversor energizado y monitoreo activo' },
    { id: 'ex-21', n: 'Limpieza del área de trabajo completada' },
  ],
  metal: [
    { id: 'ex-01', n: 'Herramienta y consumibles cargados y verificados' },
    { id: 'ex-02', n: 'Diagrama de instalación revisado con el equipo' },
    { id: 'ex-03', n: 'Área de techo limpia y despejada' },
    { id: 'ex-04', n: 'Trazado de paneles con tiralineas' },
    { id: 'ex-05', n: 'Puntos de anclaje marcados sobre estructura metálica' },
    { id: 'ex-06', n: 'Perforación con WD-40 (broca para metal)' },
    { id: 'ex-07', n: 'Varilla roscada instalada con tuerca + arandelas' },
    { id: 'ex-08', n: 'Bases L-foot / soportes colocados' },
    { id: 'ex-09', n: 'Rieles instalados y nivelados' },
    { id: 'ex-10', n: 'Cortes de riel correctos (medidas del diagrama)' },
    { id: 'ex-11', n: 'Paneles montados y sujetados (mid/end-clamps)' },
    { id: 'ex-12', n: 'Torque aplicado con llave de torque' },
    { id: 'ex-13', n: 'Bases selladas con sellador transparente' },
    { id: 'ex-14', n: 'Tuercas selladas' },
    { id: 'ex-15', n: 'Cableado DC conectado — polaridad verificada' },
    { id: 'ex-16', n: 'Puesta a tierra instalada' },
    { id: 'ex-17', n: 'Inversor energizado y monitoreo activo' },
    { id: 'ex-18', n: 'Limpieza del área de trabajo completada' },
  ],
};
