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
    { id: 'h-guia',   n: 'Tubo guía', note: 'Para medir la profundidad de perforación' },
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

// ── Bloques del checklist de ejecución ─────────────────────────────────────────
// El flujo en campo no sigue el orden de los módulos de datos — sigue la
// secuencia física real de la obra, validada con el equipo de campo:
//   Bloque 1 — techumbre: anclaje/montaje mecánico y canalización FV exterior.
//   Bloque 2 — cuarto de máquinas: fija primero la médula (ducto central) y
//              luego monta inversor/baterías/busbars/seccionador sobre ella.
//   Bloque 3 — cableado, paneles y cierre: tendido/peinado eléctrico, última
//              validación de techo + montaje de paneles, y el cierre técnico
//              (protecciones, mediciones, etiquetado, puesta en marcha).
export const BLOQUE_LABELS = {
  1: 'Bloque 1',
  2: 'Bloque 2',
  3: 'Bloque 3',
};
export const BLOQUE_DESC = {
  1: 'Estructura, Anclaje y Canalización Fotovoltaica',
  2: 'Canalización Central y Montaje de Equipos',
  3: 'Cableado, Paneles y Cierre',
};

// ── Tierra: bloque único compartido por todos los tipos de sistema ────────────
const _tierraItems = [
  { id: 'ptr-01', n: 'Varilla PTR enterrada (profundidad suficiente)' },
  { id: 'ptr-02', n: 'Continuidad de tierra verificada con multímetro' },
  { id: 'ptr-03', n: 'Cable de tierra conectado a estructura metálica de paneles' },
  { id: 'ptr-04', n: 'Cable de tierra conectado a inversor / equipo principal' },
];

// ── BLOQUE 1 — Estructura, Anclaje y Canalización Fotovoltaica ───────────────

// Paso 1.1 — Anclaje y Montaje Mecánico (Techumbre). Fusiona perforación/anclaje
// químico y montaje de rieles en un solo paso de techumbre. La profundidad de
// perforación se ajusta al grosor real de la losa capturado en Levantamiento
// (profundidad = grosor − 3 cm, mínimo 3 cm); sin ese dato se usa el genérico
// de 5 cm. Si la calidad de la losa del área se reportó como "Pobre", se
// agrega una alerta de revisión.
function _anclajeMontajeBlock(techo, project) {
  const esCemento = techo !== 'metal';
  let profundidadTxt = '5 cm';
  let alertaCalidad = null;

  if (esCemento) {
    const lev   = project?.documentacion?.levantamiento || {};
    const areas = lev.areasTecho || [];
    const areaLosa = areas.find(a => (a.tipTecho || lev.tipTecho) === 'Losa de concreto');
    if (areaLosa?.grosorLosa) {
      const prof = Math.max(areaLosa.grosorLosa - 3, 3);
      profundidadTxt = `${prof} cm (losa de ${areaLosa.grosorLosa} cm)`;
    }
    if (areaLosa?.calidadLosa === 'Pobre') {
      alertaCalidad = { id: 'st-03b', n: '⚠ Calidad de losa reportada como POBRE — confirmar revisión estructural antes de anclar' };
    }
  }

  const anclajeItems = esCemento ? [
    { id: 'st-00', n: 'Área de techo limpia, despejada y segura para trabajar' },
    { id: 'st-01', n: 'Trazado de paneles con tiralineas' },
    { id: 'st-02', n: 'Puntos de anclaje marcados según diagrama' },
    { id: 'st-03', n: `Perforación con rotomartillo — profundidad sugerida: ${profundidadTxt}` },
    ...(alertaCalidad ? [alertaCalidad] : []),
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
  ];

  const armazonItems = esCemento ? [
    { id: 'st-08', n: 'Bases L-foot colocadas con neopreno' },
    { id: 'st-09', n: 'Rieles instalados y nivelados' },
    { id: 'st-10', n: 'Cortes de riel correctos (medidas del diagrama)' },
    { id: 'pg-01', n: 'Arandelas de aislamiento colocadas entre metales disímiles (acero/aluminio)' },
    { id: 'ic-01', n: 'Inclinación y orientación validadas con nivel/brújula antes de bloquear estructura' },
    { id: 'st-13', n: 'Bases y tuercas selladas con sellador blanco' },
  ] : [
    { id: 'st-05', n: 'Bases L-foot / soportes colocados' },
    { id: 'st-06', n: 'Rieles instalados y nivelados' },
    { id: 'st-07', n: 'Cortes de riel correctos (medidas del diagrama)' },
    { id: 'pg-01', n: 'Arandelas de aislamiento colocadas entre metales disímiles (acero/aluminio)' },
    { id: 'ic-01', n: 'Inclinación y orientación validadas con nivel/brújula antes de bloquear estructura' },
    { id: 'st-10', n: 'Bases y tuercas selladas con sellador transparente' },
  ];

  return {
    id: 'anclaje-montaje', paso: '1.1', label: '1.1 Anclaje y Montaje Mecánico (Techumbre)', bloque: 1,
    herramientas: ['Rotomartillo con tope', 'Bomba de soplado manual', 'Pistola para epóxico estructural', 'Llave dinamométrica (torquímetro)', 'Nivel de gota largo'],
    nota: 'Perforar a la profundidad indicada usando tope, sopletear y cepillar al 100%, inyectar epóxico e instalar la varilla roscada de inmediato. Una vez curada, sentar las bases L-foot y montar los rieles aplicando el torque exacto de fabricante.',
    fotosCierre: [
      { id: 'testigo-barreno',  label: 'Testigo de Barreno Limpio', obligatoria: false },
      { id: 'varillas-epoxico', label: 'Varillas Niveladas con Epóxico', obligatoria: false },
      { id: 'rieles-torque',    label: 'Rieles Nivelados con Torque Aplicado', obligatoria: false },
    ],
    items: [...anclajeItems, ...armazonItems],
  };
}

// Paso 1.2 — Canalización Fotovoltaica (Trayectoria Exterior). Canalización
// EXTERIOR únicamente — la canalización central del cuadro eléctrico vive en
// el Bloque 2 (paso 2.1, "médula espinal").
const _conduitFvBlock = {
  id: 'canal-fv', paso: '1.2', label: '1.2 Canalización Fotovoltaica (Trayectoria Exterior)', bloque: 1,
  herramientas: ['Dobladora de tubo (conduit bender)', 'Rotomartillo', 'Broca 5/16"', 'Abrazaderas unicanal'],
  nota: 'Instalar la tubería conduit exterior desde el arreglo de paneles hasta la entrada del cuarto de máquinas. Fijar soportes unicanal a un máximo de 1.5 m por norma.',
  fotosCierre: [
    { id: 'conduit-exterior', label: 'Bajada de Conduit hacia Cuarto de Máquinas', obligatoria: false },
  ],
  items: [
    { id: 'cn-01', n: 'Ruta de canalización exterior definida y marcada' },
    { id: 'cn-02', n: 'Conduit instalado desde paneles hasta entrada del cuarto de máquinas' },
    { id: 'cn-03', n: 'Soportes unicanal fijos cada 1.5 m máx' },
    { id: 'in-01', n: 'Coples / conectores estancos contra lluvia y polvo colocados' },
    { id: 'in-02', n: 'Extremos de cable expuestos sellados' },
  ],
};

// ── BLOQUE 2 — Canalización Central y Montaje de Equipos ─────────────────────

// Paso 2.1 — Canalización Central (La Médula). Ducto/canaleta central en la
// pared del cuadro eléctrico — todos los equipos se alinean con base en esto.
const _meduluEspinalBlock = {
  id: 'medula', paso: '2.1', label: '2.1 Canalización Central (La Médula)', bloque: 2,
  herramientas: ['Nivel de mano', 'Tiralíneas / flexómetro', 'Taladro', 'Taquetes y tornillos'],
  nota: 'Marcar en el muro el eje central del cuadro eléctrico. Fijar el ducto principal (canaleta ranurada o escalerilla) que servirá como espina dorsal — todos los equipos se alinearán con base en este ducto.',
  fotosCierre: [
    { id: 'medula-fijada', label: 'Ducto Central Fijado y Nivelado', obligatoria: false },
  ],
  items: [
    { id: 'me-01', n: 'Eje central del cuadro eléctrico trazado y nivelado en el muro' },
    { id: 'me-02', n: 'Ducto/canaleta principal fijado y nivelado en la pared, antes de colocar cualquier equipo' },
  ],
};

// Paso 2.2 — Infraestructura de Almacenamiento y Equipos. Fusiona el montaje
// mecánico del inversor/centros de carga con el del banco de baterías
// (cuando el tipo de sistema lleva baterías) — todo adosado a la médula.
const _COMPONENTE = {
  interconectado:   { nombre: 'Inversor',            lugar: 'lugar ventilado, protegido de la luz solar directa' },
  hibrido_respaldo: { nombre: 'Inversor híbrido',     lugar: 'lugar ventilado, protegido de la luz solar directa' },
  aislado:          { nombre: 'Inversor/regulador',   lugar: 'lugar protegido de la intemperie' },
  bombeo:           { nombre: 'Controlador de bomba', lugar: 'lugar protegido de lluvia' },
  sistema_pequeno:  { nombre: 'Controlador de carga', lugar: 'lugar ventilado' },
};
const _BATERIAS_NOTA = 'Colocar las baterías en su rack. Conectar los puentes en serie/paralelo, instalar el fusible de protección dedicado y canalizar el cable de fuerza y el de datos (BMS) hacia la médula espinal.';
function _infraEquiposBlock(tipo) {
  const c = _COMPONENTE[tipo] || _COMPONENTE.interconectado;
  const tieneBaterias = tipo === 'hibrido_respaldo' || tipo === 'aislado';
  const bateriasItems = tieneBaterias ? [
    { id: 'bat-01', n: 'Baterías instaladas en rack o caja ventilada' },
    { id: 'bat-02', n: 'Conexión en serie/paralelo según especificación del banco' },
    { id: 'bat-03', n: tipo === 'aislado' ? 'Fusible de batería instalado' : 'Fusible o seccionador de batería instalado' },
    { id: 'bat-04', n: tipo === 'aislado' ? 'BMS configurado (si aplica)' : 'BMS configurado y comunicación verificada (si aplica)' },
    { id: 'bat-05', n: tipo === 'aislado' ? 'Voltaje del banco medido y correcto' : 'Voltaje del banco medido y dentro del rango' },
  ] : [];
  return {
    id: 'infra-equipos', paso: '2.2', label: '2.2 Infraestructura de Almacenamiento y Equipos', bloque: 2,
    herramientas: ['Nivel de gota', 'Destornilladores aislados', 'Brocas adecuadas para el muro', 'Llave de torque aislada', 'Multímetro'],
    nota: `Colgar la placa del ${c.nombre.toLowerCase()} y los gabinetes de protecciones AC/DC adosados a la médula espinal.${tieneBaterias ? ' ' + _BATERIAS_NOTA : ''} Montar el gabinete de barras colectoras y el seccionador general de CD antes de cualquier conexión eléctrica.`,
    fotosCierre: [
      { id: 'equipos-montados', label: 'Inversor y Tableros Montados sobre la Médula', obligatoria: false },
      ...(tieneBaterias ? [{ id: 'baterias-instaladas', label: 'Banco de Baterías Instalado con Fusible', obligatoria: false }] : []),
      { id: 'busbar-instalada', label: 'Gabinete de Barra Colectora Instalado', obligatoria: false },
    ],
    items: [
      { id: 'if-01', n: `${c.nombre} montado y nivelado en ${c.lugar}, adosado a la médula espinal` },
      { id: 'if-02', n: 'Gabinetes vacíos de protección CD/CA instalados (si aplica)' },
      ...bateriasItems,
      { id: 'busb-01', n: 'Instalación de gabinete de barras colectoras de CD (busbars)' },
      { id: 'sec-01', n: 'Montaje físico del seccionador general de CD (corte de baterías/arreglo)' },
    ],
  };
}

// Cableado CA y conexiones internas por tipo de sistema (sin montaje físico,
// sin tierra, sin energizado — esos viven en sus propios pasos).
const _cableAcBlocks = {
  interconectado: [
    { id: 'cable-ac', n: 'Conexión DC al inversor verificada' },
    { id: 'cable-ac2', n: 'Cable AC tendido hasta tablero principal' },
    { id: 'cable-ac3', n: 'Protección AC (interruptor dedicado) instalada en tablero' },
  ],
  hibrido_respaldo: [
    { id: 'cable-ac', n: 'Conexión DC (paneles) al inversor verificada' },
    { id: 'cable-ac2', n: 'Cable AC tendido hasta tablero' },
    { id: 'cable-ac3', n: 'Protección AC instalada en tablero' },
  ],
  aislado: [
    { id: 'cable-ac', n: 'Conexión DC desde paneles verificada' },
    { id: 'cable-ac2', n: 'Salida AC configurada y protegida (si aplica)' },
  ],
  bombeo: [
    { id: 'ctrl-02', n: 'Conexión DC desde paneles al controlador verificada' },
    { id: 'ctrl-03', n: 'Conexión del motor al controlador verificada' },
  ],
  sistema_pequeno: [
    { id: 'eq-01', n: 'Panel(es) instalados y correctamente orientados' },
    { id: 'eq-02', n: 'Controlador de carga conectado entre paneles y batería' },
    { id: 'eq-03', n: 'Batería conectada (si incluye)' },
    { id: 'eq-04', n: 'Carga / equipo (congelador, etc.) conectado' },
  ],
};

const _bombaItems = [
  { id: 'bom-01', n: 'Bomba instalada en pozo o toma de agua' },
  { id: 'bom-02', n: 'Tuberías conectadas y sin fugas' },
  { id: 'bom-03', n: 'Nivel de agua suficiente para bomba sumergible' },
];

// ── BLOQUE 3 — Cableado, Paneles y Cierre ────────────────────────────────────

// Paso 3.1 — Tendido de Conductores y Peinado Eléctrico. Fusiona el tendido
// de cable DC, el peinado de cables traseros de módulos y el ponchado MC4.
const _cableadoPeinadoBlock = {
  id: 'cableado-peinado', paso: '3.1', label: '3.1 Tendido de Conductores y Peinado Eléctrico', bloque: 3,
  herramientas: ['Guía jalacables (de nylon o acero)', 'Lubricante para cableado eléctrico', 'Clips para cable solar', 'Pinza ponchadora MC4', 'Pelacables solar', 'Llaves de apriete MC4'],
  nota: 'Guiar el cable fotovoltaico desde los paneles hasta el inversor sin empalmes expuestos. Peinar los excedentes con clips de acero inoxidable y armar los conectores MC4 respetando la polaridad de cada string.',
  fotosCierre: [
    { id: 'cable-dc-tendido', label: 'Cable DC Tendido sin Empalmes', obligatoria: false },
    { id: 'cables-peinados',  label: 'Cables Traseros Peinados con Clips', obligatoria: false },
    { id: 'mc4-armados',      label: 'Conectores MC4 Armados', obligatoria: false },
  ],
  items: [
    { id: 'dc-01', n: 'Cable DC tendido por canalización sin empalmes expuestos' },
    { id: 'dc-02', n: 'Polaridad positiva/negativa verificada en cada string' },
    { id: 'dc-04', n: 'Continuidad DC medida con multímetro' },
    { id: 'pc-01', n: 'Excedentes de cable sujetos con clips de acero inoxidable bajo el panel' },
    { id: 'pc-02', n: 'Ningún cable solar toca o arrastra en el suelo del techo' },
    { id: 'dc-03', n: 'Conectores MC4 engarzados y asegurados' },
    { id: 'mc-01', n: 'Sello de goma del conector correctamente posicionado antes de acoplar' },
  ],
};

// Paso 3.2 — Validación de Techo y Montaje de Paneles. Última inspección del
// techo antes de cubrirlo de forma permanente con el arreglo de paneles.
function _validacionTechoPanelesBlock(techo) {
  const esCemento = techo !== 'metal';
  const panelItems = esCemento ? [
    { id: 'st-11', n: 'Paneles montados con mid/end-clamps' },
    { id: 'st-12', n: 'Torque aplicado con torquímetro — alineación y estética verificadas' },
  ] : [
    { id: 'st-08', n: 'Paneles montados con mid/end-clamps' },
    { id: 'st-09', n: 'Torque aplicado con torquímetro — alineación y estética verificadas' },
  ];
  return {
    id: 'techo-paneles', paso: '3.2', label: '3.2 Validación de Techo y Montaje de Paneles', bloque: 3,
    herramientas: ['Racht', 'Llaves de cruz o españolas según el herraje', 'Sellador blanco para tuercas expuestas'],
    nota: 'Inspeccionar y limpiar el techo por última vez antes de cubrirlo. Colocar abrazaderas intermedias (mid-clamps) y finales (end-clamps) aplicando presión uniforme para no estrellar las celdas.',
    fotosCierre: [
      { id: 'inspeccion-techo', label: 'Inspección Final — Condición de Techo', obligatoria: false },
      { id: 'paneles-montados', label: 'Arreglo de Paneles Montado y Alineado', obligatoria: false },
    ],
    items: [
      { id: 'chk-techo', n: 'Inspección visual y limpieza final de la condición del techo' },
      ...panelItems,
    ],
  };
}

// Paso 3.3 — Mediciones, Etiquetado y Puesta en Marcha. Fusiona protecciones
// internas/peinado de tableros con las pruebas eléctricas y el arranque.
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

const _ENERGIZADO_ITEMS = {
  interconectado:   [{ id: 'inv-05', n: 'Inversor energizado — sin fallas ni alarmas' }],
  hibrido_respaldo: [{ id: 'inv-05', n: 'Modo de operación configurado (grid-tie + respaldo)' },
                      { id: 'inv-06', n: 'Inversor energizado — sin fallas' }],
  aislado:          [{ id: 'inv-04', n: 'Sistema energizado — sin fallas' }],
  bombeo:           [{ id: 'ctrl-04', n: 'Parámetros configurados (voltaje, frecuencia, protecciones)' },
                      { id: 'bom-04', n: 'Prueba de operación — flujo verificado' }],
  sistema_pequeno:  [{ id: 'eq-05', n: 'Sistema energizado — sin fallas' }],
};

// Interconexión CFE en modo Zero Export — sin contrato de interconexión vigente.
// cfe-01/cfe-02 se conservan por si en el futuro aplica un trámite formal con CFE.
function _cfeItems(tipo) {
  if (!['interconectado', 'hibrido_respaldo'].includes(tipo)) return [];
  return [
    { id: 'zx-01', n: 'Inversor configurado en modo Zero Export (límite de exportación = 0%)' },
    { id: 'zx-02', n: 'CT / sensor de exportación instalado y calibrado en la acometida' },
    { id: 'zx-03', n: 'Verificado con pinza amperométrica — sin flujo inverso hacia la red en operación normal' },
    { id: 'cfe-03', n: 'Etiquetas reglamentarias colocadas en tablero y punto de desconexión' },
    { id: 'cfe-01', n: 'Solicitud de interconexión presentada a CFE (solo si se gestiona contrato — no aplica en zero export)' },
    { id: 'cfe-02', n: 'Medidor bidireccional instalado (solo si CFE aprobó contrato de interconexión)' },
  ];
}

function _medicionesPuestaMarchaBlock(project, tipo) {
  const energ = _ENERGIZADO_ITEMS[tipo] || _ENERGIZADO_ITEMS.interconectado;
  return {
    id: 'mediciones-marcha', paso: '3.3', label: '3.3 Mediciones, Etiquetado y Puesta en Marcha', bloque: 3,
    herramientas: ['Multímetro digital (hasta 1000V DC)', 'Pinza amperométrica', 'Pinza pelacables', 'Ponchadora de terminales', 'Destornillador de torque para breakers'],
    nota: 'Bajar los cables desde la médula hacia los interruptores y fusibles, peinar los tableros AC/DC, medir continuidad y Voc de los strings, energizar en secuencia y etiquetar conforme a NOM.',
    fotosCierre: [
      { id: 'tablero-dc',        label: 'Tablero DC Peinado', obligatoria: true },
      { id: 'tablero-ac',        label: 'Tablero AC Peinado', obligatoria: true },
      { id: 'arranque-pantalla', label: 'Pantalla del Inversor — Generación sin Alarmas, Tapas Puestas', obligatoria: false },
    ],
    items: [
      { id: 'pd-01', n: 'Fusibles DC instalados — calibre correcto por string' },
      { id: 'pd-02', n: 'Seccionador DC instalado y accesible' },
      { id: 'pd-03', n: 'DPS DC instalado (si aplica por normativa)' },
      ..._tierraItems,
      ...(_cableAcBlocks[tipo] || _cableAcBlocks.interconectado),
      ...(tipo === 'bombeo' ? _bombaItems : []),
      { id: 'et-01', n: 'Cables identificados: positivo, negativo, fases, neutro, tierra' },
      { id: 'et-02', n: 'Calcomanías de advertencia "Sistema Fotovoltaico" colocadas' },
      { id: 'cc-03', n: 'Prueba de aislamiento — megóhmetro 1000 VDC, R > 1 MΩ entre conductor y tierra', hasInput: true, inputPlaceholder: 'Ej. 500 MΩ' },
      ..._medicionItems(project),
      ...(['aislado', 'hibrido_respaldo'].includes(tipo) ? [
        { id: 'cc-07', n: 'Voltaje del banco de baterías antes del primer arranque', hasInput: true, inputPlaceholder: 'Ej. 48 V' },
        { id: 'cc-08', n: 'Configuración BMS y SOC inicial — registrar valor en bitácora', hasInput: true, inputPlaceholder: 'Ej. 85 % SOC' },
        { id: 'cc-09', n: 'Prueba de transferencia automática ATS (< 20 ms)' },
      ] : []),
      { id: 'med-02', n: 'Voltajes CA medidos (fase-fase, fase-neutro, fase-tierra)', hasInput: true, inputPlaceholder: 'Ej: 220V / 127V / 127V' },
      { id: 'med-03', n: 'Resistencia de la red de tierra física medida', hasInput: true, inputPlaceholder: 'Ej: 4.8 Ω' },
      { id: 'med-04', n: 'Torque verificado en conexiones eléctricas (breakers, terminales) según especificación del fabricante' },
      { id: 'pm-05', n: 'Estándar de red/país configurado en el inversor (si aplica)' },
      { id: 'pm-06', n: 'Encendido secuencial realizado — CD primero, luego CA' },
      ...energ,
      { id: 'pm-07', n: 'Protección anti-isla verificada — el inversor deja de exportar al simular pérdida de red (si aplica)' },
      { id: 'mon-01', n: 'Vinculado a WiFi/Ethernet del sitio o módem dedicado (si aplica)' },
      { id: 'mon-02', n: 'Planta creada en la plataforma del fabricante y cliente registrado (si aplica)' },
      ..._cfeItems(tipo),
      { id: 'ci-01', n: 'Herramientas y materiales sobrantes retirados del techo' },
      { id: 'ci-02', n: 'Revisión de raspaduras o daños en impermeabilización' },
      { id: 'ci-03', n: 'Módulos lavados con agua pura — sin polvo de obra' },
      { id: 'pm-03', n: 'Fotos técnicas subidas en módulo Garantía', isNav: true, navRoute: 'garantia' },
      { id: 'pm-04', n: 'Cliente informado y uso del sistema explicado' },
      { id: 'pm-08', n: 'Ducto principal cerrado con su tapa, pantalla del inversor mostrando generación sin alarmas' },
    ],
  };
}

// ── Ensamble final — orden = secuencia física real de la obra ────────────────
// Paso 3.3 simplificado para Ampliación — solo tierra, protecciones DC,
// etiquetado, prueba de aislamiento, mediciones del string nuevo y limpieza.
// No incluye cableado AC, arranque de inversor ni comisionamiento de red.
function _ampliacionCierreBlock(project) {
  return {
    id: 'ampliacion-cierre', paso: '3.3', label: '3.3 Tierra, Protecciones y Cierre', bloque: 3,
    herramientas: ['Multímetro digital', 'Megóhmetro 1000 VDC', 'Pinza ponchadora MC4', 'Llave de torque'],
    nota: 'Instalar varilla PTR y conectar cable de tierra a la nueva estructura. Montar fusibles DC y seccionador del string nuevo. Medir Voc/Isc y prueba de aislamiento. Limpiar y retirar materiales.',
    fotosCierre: [
      { id: 'tierra-nueva',  label: 'Varilla PTR y Cable de Tierra del String Nuevo', obligatoria: false },
      { id: 'fusibles-dc',   label: 'Fusibles DC y Seccionador Instalados', obligatoria: false },
    ],
    items: [
      { id: 'ptr-01', n: 'Varilla PTR enterrada (profundidad suficiente)' },
      { id: 'ptr-02', n: 'Continuidad de tierra verificada con multímetro' },
      { id: 'ptr-03', n: 'Cable de tierra conectado a estructura metálica de paneles' },
      { id: 'pd-01', n: 'Fusibles DC instalados — calibre correcto por string' },
      { id: 'pd-02', n: 'Seccionador DC instalado y accesible' },
      { id: 'pd-03', n: 'DPS DC instalado (si aplica por normativa)' },
      { id: 'et-01', n: 'Cables identificados: positivo, negativo, tierra' },
      { id: 'et-02', n: 'Calcomanías de advertencia "Sistema Fotovoltaico" colocadas' },
      { id: 'cc-03', n: 'Prueba de aislamiento — megóhmetro 1000 VDC, R > 1 MΩ', hasInput: true, inputPlaceholder: 'Ej. 500 MΩ' },
      ..._medicionItems(project),
      { id: 'ci-01', n: 'Herramientas y materiales sobrantes retirados del techo' },
      { id: 'ci-02', n: 'Revisión de raspaduras o daños en impermeabilización' },
      { id: 'ci-03', n: 'Módulos lavados con agua pura — sin polvo de obra' },
      { id: 'pm-04', n: 'Cliente informado del string nuevo integrado al sistema' },
    ],
  };
}

export function getExecBlocks(project, techo) {
  const tipo = project?.tipoSistema || 'interconectado';
  const t    = techo || 'cemento';
  if (tipo === 'ampliacion') {
    return [
      _anclajeMontajeBlock(t, project),
      _conduitFvBlock,
      _cableadoPeinadoBlock,
      _validacionTechoPanelesBlock(t),
      _ampliacionCierreBlock(project),
    ];
  }
  return [
    // Bloque 1 — Estructura, Anclaje y Canalización Fotovoltaica
    _anclajeMontajeBlock(t, project),
    _conduitFvBlock,
    // Bloque 2 — Canalización Central y Montaje de Equipos
    _meduluEspinalBlock,
    _infraEquiposBlock(tipo),
    // Bloque 3 — Cableado, Paneles y Cierre
    _cableadoPeinadoBlock,
    _validacionTechoPanelesBlock(t),
    _medicionesPuestaMarchaBlock(project, tipo),
  ];
}
