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
    { id: 'h-pistola',n: 'Pistola calefactora', note: 'Para termocontráctil en empalmes y terminales de cable' },
  ],
  metal: [
    { id: 'h-plum',   n: 'Plumón permanente' },
    { id: 'h-cinta',  n: 'Cinta métrica' },
    { id: 'h-tiral',  n: 'Tiralineas' },
    { id: 'h-taladro',n: 'Taladro Milwaukee' },
    { id: 'h-brocas', n: 'Brocas para metal', note: 'Set: chica hasta 3/8"' },
    { id: 'h-rach',   n: 'Rach (trinquete) + dados', note: 'No usar Milwaukee — la varilla puede salirse' },
    { id: 'h-torque', n: 'Llave de torque' },
    { id: 'h-pistola',n: 'Pistola calefactora', note: 'Para termocontráctil en empalmes y terminales de cable' },
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

// ── Fases del checklist de ejecución ───────────────────────────────────────────
// El flujo en campo no sigue el orden de los módulos de datos — sigue la secuencia
// física de la obra. Cada bloque de ejecución se etiqueta con su fase para que el
// técnico entienda el orden aunque los bloques se repartan entre las pestañas de
// sitio (Techo / Centros de carga / Zona del sistema).
export const FASE_LABELS = {
  1: 'Fase 1',
  2: 'Fase 2',
  3: 'Fase 3',
  4: 'Fase 4',
};
export const FASE_DESC = {
  1: 'Preparación y obra civil externa',
  2: 'Canalizaciones e infraestructura de rutas',
  3: 'Tendido eléctrico y montaje de módulos',
  4: 'Comisionamiento, verificación y cierre',
};

// ── Tierra: bloque único compartido por todos los tipos de sistema ────────────
const _tierraItems = [
  { id: 'ptr-01', n: 'Varilla PTR enterrada (profundidad suficiente)' },
  { id: 'ptr-02', n: 'Continuidad de tierra verificada con multímetro' },
  { id: 'ptr-03', n: 'Cable de tierra conectado a estructura metálica de paneles' },
  { id: 'ptr-04', n: 'Cable de tierra conectado a inversor / equipo principal' },
];

// ── Fase 1 — Preparación y obra civil externa ─────────────────────────────────
function _anclajeBlock(techo) {
  const esCemento = techo !== 'metal';
  return {
    id: 'anclaje', label: 'Anclaje e impermeabilización', fase: 1,
    items: esCemento ? [
      { id: 'st-00', n: 'Área de techo limpia, despejada y segura para trabajar' },
      { id: 'st-01', n: 'Trazado de paneles con tiralineas' },
      { id: 'st-02', n: 'Puntos de anclaje marcados según diagrama' },
      { id: 'st-03', n: 'Perforación con rotomartillo — 5 cm profundidad con tubo guía' },
      { id: 'st-04', n: 'Hoyos soplados y cepillados (sin polvo)' },
      { id: 'st-05', n: 'Epóxico inyectado con pipeta (una por hoyo)' },
      { id: 'st-06', n: 'Varilla roscada instalada y alineada' },
      { id: 'st-07', n: 'Curado de epóxico completado (≥ 20 min)' },
    ] : [
      { id: 'st-00', n: 'Área de techo limpia, despejada y segura para trabajar' },
      { id: 'st-01', n: 'Trazado de paneles con tiralineas' },
      { id: 'st-02', n: 'Puntos de anclaje marcados sobre estructura metálica' },
      { id: 'st-03', n: 'Perforación con WD-40 (broca para metal)' },
      { id: 'st-04', n: 'Varilla roscada instalada con tuerca + arandelas' },
    ],
  };
}

const _COMPONENTE = {
  interconectado:   { nombre: 'Inversor',            lugar: 'lugar ventilado, protegido de la luz solar directa' },
  hibrido_respaldo: { nombre: 'Inversor híbrido',     lugar: 'lugar ventilado, protegido de la luz solar directa' },
  aislado:          { nombre: 'Inversor/regulador',   lugar: 'lugar protegido de la intemperie' },
  bombeo:           { nombre: 'Controlador de bomba', lugar: 'lugar protegido de lluvia' },
  sistema_pequeno:  { nombre: 'Controlador de carga', lugar: 'lugar ventilado' },
};
function _invFixBlock(tipo) {
  const c = _COMPONENTE[tipo] || _COMPONENTE.interconectado;
  return {
    id: 'inv-fix', label: `Fijación de ${c.nombre.toLowerCase()} y tableros`, fase: 1,
    items: [
      { id: 'if-01', n: `${c.nombre} montado y nivelado en ${c.lugar}` },
      { id: 'if-02', n: 'Gabinetes vacíos de protección CD/CA instalados (si aplica)' },
    ],
  };
}

function _armazonBlock(techo) {
  const esCemento = techo !== 'metal';
  const base = esCemento ? [
    { id: 'st-08', n: 'Bases L-foot colocadas con neopreno' },
    { id: 'st-09', n: 'Rieles instalados y nivelados' },
    { id: 'st-10', n: 'Cortes de riel correctos (medidas del diagrama)' },
  ] : [
    { id: 'st-05', n: 'Bases L-foot / soportes colocados' },
    { id: 'st-06', n: 'Rieles instalados y nivelados' },
    { id: 'st-07', n: 'Cortes de riel correctos (medidas del diagrama)' },
  ];
  const sellado = esCemento
    ? { id: 'st-13', n: 'Bases y tuercas selladas con sellador blanco' }
    : { id: 'st-10', n: 'Bases y tuercas selladas con sellador transparente' };
  return {
    id: 'armazon', label: 'Montaje de armazón y par galvánico', fase: 1,
    items: [
      ...base,
      { id: 'pg-01', n: 'Arandelas de aislamiento colocadas entre metales disímiles (acero/aluminio)' },
      { id: 'ic-01', n: 'Inclinación y orientación validadas con nivel/brújula antes de bloquear estructura' },
      sellado,
    ],
  };
}

// ── Fase 2 — Canalizaciones e infraestructura de rutas ────────────────────────
function _canalBlock() {
  return {
    id: 'canal', label: 'Canalización y protección', fase: 2,
    items: [
      { id: 'cn-01', n: 'Ruta de canalización definida y marcada' },
      { id: 'cn-02', n: 'Conduit/canaleta instalado desde paneles hasta tablero' },
      { id: 'cn-03', n: 'Sujetadores y abrazaderas fijos cada 1.5 m máx' },
      { id: 'cn-04', n: 'Entradas a tablero selladas (sin luz exterior)' },
      { id: 'in-01', n: 'Coples / conectores estancos contra lluvia y polvo colocados' },
      { id: 'in-02', n: 'Extremos de cable expuestos sellados' },
    ],
  };
}

// ── Fase 3 — Tendido eléctrico y montaje de módulos ───────────────────────────
function _panelFixBlock(techo) {
  const esCemento = techo !== 'metal';
  return {
    id: 'panel-fix', label: 'Fijación física y torque de paneles', fase: 3,
    items: esCemento ? [
      { id: 'st-11', n: 'Paneles montados con mid/end-clamps' },
      { id: 'st-12', n: 'Torque aplicado con torquímetro — alineación y estética verificadas' },
    ] : [
      { id: 'st-08', n: 'Paneles montados con mid/end-clamps' },
      { id: 'st-09', n: 'Torque aplicado con torquímetro — alineación y estética verificadas' },
    ],
  };
}

// Cableado CA y protecciones — trimmed por tipo (sin montaje, sin tierra, sin energizado;
// esos pasos viven en inv-fix / tierra / puesta-marcha respectivamente)
const _cableAcBlocks = {
  interconectado: [
    { id: 'cable-ac', label: 'Cableado CA y protecciones', fase: 3, items: [
      { id: 'inv-02', n: 'Conexión DC al inversor verificada' },
      { id: 'inv-03', n: 'Cable AC tendido hasta tablero principal' },
      { id: 'inv-04', n: 'Protección AC (interruptor dedicado) instalada en tablero' },
    ]},
  ],
  hibrido_respaldo: [
    { id: 'cable-ac', label: 'Cableado CA y protecciones', fase: 3, items: [
      { id: 'inv-02', n: 'Conexión DC (paneles) al inversor verificada' },
      { id: 'inv-03', n: 'Cable AC tendido hasta tablero' },
      { id: 'inv-04', n: 'Protección AC instalada en tablero' },
    ]},
    { id: 'baterias', label: 'Banco de baterías', fase: 3, items: [
      { id: 'bat-01', n: 'Baterías instaladas en rack o caja ventilada' },
      { id: 'bat-02', n: 'Conexión en serie/paralelo según especificación del banco' },
      { id: 'bat-03', n: 'Fusible o seccionador de batería instalado' },
      { id: 'bat-04', n: 'BMS configurado y comunicación verificada (si aplica)' },
      { id: 'bat-05', n: 'Voltaje del banco medido y dentro del rango' },
    ]},
  ],
  aislado: [
    { id: 'cable-ac', label: 'Cableado CA (si aplica)', fase: 3, items: [
      { id: 'inv-02', n: 'Conexión DC desde paneles verificada' },
      { id: 'inv-03', n: 'Salida AC configurada y protegida (si aplica)' },
    ]},
    { id: 'baterias', label: 'Banco de baterías', fase: 3, items: [
      { id: 'bat-01', n: 'Baterías instaladas en rack o caja ventilada' },
      { id: 'bat-02', n: 'Conexión en serie/paralelo según especificación del banco' },
      { id: 'bat-03', n: 'Fusible de batería instalado' },
      { id: 'bat-04', n: 'BMS configurado (si aplica)' },
      { id: 'bat-05', n: 'Voltaje del banco medido y correcto' },
    ]},
  ],
  bombeo: [
    { id: 'cable-ac', label: 'Cableado del controlador', fase: 3, items: [
      { id: 'ctrl-02', n: 'Conexión DC desde paneles al controlador verificada' },
      { id: 'ctrl-03', n: 'Conexión del motor al controlador verificada' },
    ]},
    { id: 'bomba', label: 'Motor / Bomba', fase: 3, items: [
      { id: 'bom-01', n: 'Bomba instalada en pozo o toma de agua' },
      { id: 'bom-02', n: 'Tuberías conectadas y sin fugas' },
      { id: 'bom-03', n: 'Nivel de agua suficiente para bomba sumergible' },
    ]},
  ],
  sistema_pequeno: [
    { id: 'cable-ac', label: 'Conexión de equipos', fase: 3, items: [
      { id: 'eq-01', n: 'Panel(es) instalados y correctamente orientados' },
      { id: 'eq-02', n: 'Controlador de carga conectado entre paneles y batería' },
      { id: 'eq-03', n: 'Batería conectada (si incluye)' },
      { id: 'eq-04', n: 'Carga / equipo (congelador, etc.) conectado' },
    ]},
  ],
};

const _etiquetadoBlock = {
  id: 'etiquetado', label: 'Identificación', fase: 3,
  items: [
    { id: 'et-01', n: 'Cables identificados: positivo, negativo, fases, neutro, tierra' },
    { id: 'et-02', n: 'Calcomanías de advertencia "Sistema Fotovoltaico" colocadas' },
  ],
};

// ── Fase 4 — Comisionamiento, verificación y cierre ───────────────────────────
function _medicionItems(project) {
  const strings = project?.garantia?.paneles?.strings || [];
  if (!strings.length) {
    return [{ id: 'med-01', n: 'Voc/Isc registrados por cadena', hasInput: true, inputPlaceholder: 'Ej: String 1: 380V / 8.2A' }];
  }
  return strings.flatMap((s, i) => ([
    { id: `med-voc-${i}`, n: `Voc — ${s.nombre || `String ${i+1}`}`, hasInput: true, inputPlaceholder: 'Ej: 380 V' },
    { id: `med-isc-${i}`, n: `Isc — ${s.nombre || `String ${i+1}`}`, hasInput: true, inputPlaceholder: 'Ej: 8.2 A' },
  ]));
}
function _verificacionBlock(project) {
  return {
    id: 'verificacion', label: 'Verificación previa al encendido', fase: 4,
    items: [
      ..._medicionItems(project),
      { id: 'med-02', n: 'Voltajes CA medidos (fase-fase, fase-neutro, fase-tierra)', hasInput: true, inputPlaceholder: 'Ej: 220V / 127V / 127V' },
      { id: 'med-03', n: 'Resistencia de la red de tierra física medida', hasInput: true, inputPlaceholder: 'Ej: 4.8 Ω' },
    ],
  };
}

const _ENERGIZADO_ITEMS = {
  interconectado:   [{ id: 'inv-05', n: 'Inversor energizado — sin fallas ni alarmas' }],
  hibrido_respaldo: [{ id: 'inv-05', n: 'Modo de operación configurado (grid-tie + respaldo)' },
                      { id: 'inv-06', n: 'Inversor energizado — sin fallas' }],
  aislado:          [{ id: 'inv-04', n: 'Sistema energizado — sin fallas' }],
  bombeo:           [{ id: 'ctrl-04', n: 'Parámetros configurados (voltaje, frecuencia, protecciones)' },
                      { id: 'bom-04', n: 'Prueba de operación — flujo verificado' }],
  sistema_pequeno:  [{ id: 'eq-05', n: 'Sistema energizado — sin fallas' }],
};
function _puestaMarchaBlock(tipo) {
  const energ = _ENERGIZADO_ITEMS[tipo] || _ENERGIZADO_ITEMS.interconectado;
  return {
    id: 'puesta-marcha', label: 'Puesta en marcha y monitoreo', fase: 4,
    items: [
      { id: 'pm-05', n: 'Estándar de red/país configurado en el inversor (si aplica)' },
      { id: 'pm-06', n: 'Encendido secuencial realizado — CD primero, luego CA' },
      ...energ,
      { id: 'mon-01', n: 'Vinculado a WiFi/Ethernet del sitio o módem dedicado (si aplica)' },
      { id: 'mon-02', n: 'Planta creada en la plataforma del fabricante y cliente registrado (si aplica)' },
    ],
  };
}

// Interconexión CFE en modo Zero Export — sin contrato de interconexión vigente.
// cfe-01/cfe-02 se conservan por si en el futuro aplica un trámite formal con CFE.
function _cfeBlock(tipo) {
  if (!['interconectado', 'hibrido_respaldo'].includes(tipo)) return null;
  return {
    id: 'cfe', label: 'Interconexión CFE — Zero Export', fase: 4,
    items: [
      { id: 'zx-01', n: 'Inversor configurado en modo Zero Export (límite de exportación = 0%)' },
      { id: 'zx-02', n: 'CT / sensor de exportación instalado y calibrado en la acometida' },
      { id: 'zx-03', n: 'Verificado con pinza amperométrica — sin flujo inverso hacia la red en operación normal' },
      { id: 'cfe-03', n: 'Etiquetas reglamentarias colocadas en tablero y punto de desconexión' },
      { id: 'cfe-01', n: 'Solicitud de interconexión presentada a CFE (solo si se gestiona contrato — no aplica en zero export)' },
      { id: 'cfe-02', n: 'Medidor bidireccional instalado (solo si CFE aprobó contrato de interconexión)' },
    ],
  };
}

const _cierreBlock = {
  id: 'cierre', label: 'Limpieza, revisión y entrega', fase: 4,
  items: [
    { id: 'ci-01', n: 'Herramientas y materiales sobrantes retirados del techo' },
    { id: 'ci-02', n: 'Revisión de raspaduras o daños en impermeabilización' },
    { id: 'ci-03', n: 'Módulos lavados con agua pura — sin polvo de obra' },
    { id: 'pm-03', n: 'Fotos técnicas subidas en módulo Garantía', isNav: true, navRoute: 'garantia' },
    { id: 'pm-04', n: 'Cliente informado y uso del sistema explicado' },
  ],
};

// ── Ensamble final — orden = secuencia física de la obra, no el orden de los módulos ──
export function getExecBlocks(project, techo) {
  const tipo     = project?.tipoSistema || 'interconectado';
  const t        = techo || 'cemento';
  const cableAc  = _cableAcBlocks[tipo] || _cableAcBlocks.interconectado;
  const cfe      = _cfeBlock(tipo);
  return [
    // Fase 1 — Preparación y obra civil externa
    _anclajeBlock(t),
    _invFixBlock(tipo),
    _armazonBlock(t),
    // Fase 2 — Canalizaciones e infraestructura de rutas
    _canalBlock(),
    // Fase 3 — Tendido eléctrico y montaje de módulos
    _panelFixBlock(t),
    { id: 'cable-dc', label: 'Cableado DC', fase: 3, items: [
      { id: 'dc-01', n: 'Cable DC tendido por canalización sin empalmes expuestos' },
      { id: 'dc-02', n: 'Polaridad positiva/negativa verificada en cada string' },
      { id: 'dc-03', n: 'Conectores MC4 engarzados y asegurados' },
      { id: 'dc-04', n: 'Continuidad DC medida con multímetro' },
    ]},
    { id: 'prot-dc', label: 'Protecciones DC', fase: 3, items: [
      { id: 'pd-01', n: 'Fusibles DC instalados — calibre correcto por string' },
      { id: 'pd-02', n: 'Seccionador DC instalado y accesible' },
      { id: 'pd-03', n: 'DPS DC instalado (si aplica por normativa)' },
    ]},
    { id: 'tierra', label: 'Puesta a tierra', fase: 3, items: [..._tierraItems] },
    ...cableAc,
    _etiquetadoBlock,
    // Fase 4 — Comisionamiento, verificación y cierre
    _verificacionBlock(project),
    _puestaMarchaBlock(tipo),
    ...(cfe ? [cfe] : []),
    _cierreBlock,
  ];
}

// ── Pasos de ejecución en campo (legacy — se mantiene para retrocompat) ────────
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
