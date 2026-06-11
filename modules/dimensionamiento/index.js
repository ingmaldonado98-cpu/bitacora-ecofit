// modules/dimensionamiento/index.js
// Motor de cálculo fotovoltaico — funciones puras, sin DOM ni Firebase

// ── HSP promedio por estado (México) — NASA POWER / CONACYT ──────────────────
const _HSP = {
  'Aguascalientes':5.8,'Baja California':6.2,'Baja California Sur':6.5,
  'Campeche':5.2,'Chiapas':5.0,'Chihuahua':6.0,
  'Ciudad de México':5.2,'CDMX':5.2,'Coahuila':6.2,'Colima':5.5,
  'Durango':6.0,'Guanajuato':5.8,'Guerrero':5.5,
  'Hidalgo':5.4,'Jalisco':5.8,'Estado de México':5.2,'México':5.2,
  'Michoacán':5.8,'Morelos':5.8,'Nayarit':5.8,'Nuevo León':5.8,
  'Oaxaca':5.8,'Puebla':5.5,'Querétaro':5.8,'Quintana Roo':5.2,
  'San Luis Potosí':5.8,'Sinaloa':6.0,'Sonora':6.5,
  'Tabasco':4.8,'Tamaulipas':5.8,'Tlaxcala':5.2,
  'Veracruz':4.8,'Yucatán':5.5,'Zacatecas':6.2,
};
const HSP_DEFAULT = 5.5;

// Tamaños estándar de inversores (kW) disponibles en México
const _INV_GRID    = [1.5,2,3,3.6,4,5,6,8,10,12,15,20,25,30];
const _INV_OFFGRID = [1.5,2,3,5,6,8,10,12,15,20];
const _VFD_SIZES   = [0.75,1.1,1.5,2.2,3,4,5.5,7.5,11,15,18.5,22];

function _nextStd(sizes, val) {
  return sizes.find(s => s >= val) || sizes[sizes.length - 1];
}

export function getHSP(state) {
  if (!state) return HSP_DEFAULT;
  const key = Object.keys(_HSP).find(k =>
    state.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(state.toLowerCase().split(' ')[0])
  );
  return key ? _HSP[key] : HSP_DEFAULT;
}

// ── Consumo diario desde levantamiento ────────────────────────────────────────
function _kwhDia(lev) {
  if (lev.modoConsumo === 'aparatos' && lev.aparatos?.length) {
    return lev.aparatos.reduce((s, a) => s + (a.potencia * a.horas * (a.cantidad || 1) / 1000), 0);
  }
  if (lev.recibos?.length) {
    const total = lev.recibos.reduce((s, r) => s + (parseFloat(r.kwh) || 0), 0);
    return total / lev.recibos.length / 30;
  }
  return null;
}

// ── Paneles: capacidad estándar 580 Wp mono PERC ──────────────────────────────
const WP_PANEL = 580;

function _pvDims(kwhDia, hsp, pr) {
  const pvKwp    = kwhDia / (hsp * pr);
  const nPaneles = Math.ceil(pvKwp * 1000 / WP_PANEL);
  const pvKwpReal = +(nPaneles * WP_PANEL / 1000).toFixed(2);
  return { pvKwp: +pvKwp.toFixed(2), nPaneles, pvKwpReal };
}

// ── INTERCONECTADO ────────────────────────────────────────────────────────────
export function calcInterconectado(lev) {
  const hsp   = getHSP(lev.tMinCiudad);
  const PR    = 0.78;
  const kwhDia = _kwhDia(lev);
  if (!kwhDia) return { error: 'Sin datos de consumo — completa la sección de tarifa o aparatos en el Levantamiento.' };

  const { pvKwp, nPaneles, pvKwpReal } = _pvDims(kwhDia, hsp, PR);
  const invKw  = _nextStd(_INV_GRID, pvKwp * 1.05);
  const genMes = Math.round(pvKwpReal * hsp * PR * 30);
  const consMes = Math.round(kwhDia * 30);
  const cobertura = Math.min(Math.round(genMes / consMes * 100), 100);

  const demandaKW = lev.demandaKW || null;
  const invNStrings = Math.max(1, Math.ceil(nPaneles / 12));

  return {
    tipo: 'interconectado', hsp,
    kwhDia: +kwhDia.toFixed(2), consMes,
    pvKwp, nPaneles, pvKwpReal,
    invKw, genMes, cobertura,
    modelo: {
      paneles:  `${nPaneles} × Módulo Mono PERC 580 Wp = ${pvKwpReal} kWp`,
      inversor: `Inversor on-grid ${invKw} kW — ${invNStrings} string${invNStrings>1?'s':''}`,
      protDC:   `Seccionador DC ${invNStrings} string${invNStrings>1?'s':''}, fusibles 15 A por string`,
      protAC:   `Interruptor termomagnético ${Math.ceil(invKw * 1.25 / 0.22)} A dedicado en tablero`,
      monitoreo: 'Smart meter bidireccional (exportación cero si aplica)',
    },
    ahorro: { genMes, tarifaEst: lev.tarifaCFE || '1F' },
  };
}

// ── AISLADO / SISTEMA PEQUEÑO ─────────────────────────────────────────────────
export function calcAislado(lev) {
  const hsp      = getHSP(lev.tMinCiudad);
  const PR       = 0.70;
  const DoD      = 0.80;
  const autonomia = lev.autonomia || 2;

  const cargas   = lev.cargasCriticas   || [];
  const cargasSec = lev.cargasSecundarias || [];
  const todos    = [...cargas, ...cargasSec];
  if (!todos.length) return { error: 'Sin cargas declaradas — agrega aparatos en la sección Aislado del Levantamiento.' };

  const kwhCrit  = cargas.reduce((s,c) => s + c.potencia * c.horas * (c.cantidad||1) / 1000, 0);
  const kwhTotal = todos.reduce((s,c)  => s + c.potencia * c.horas * (c.cantidad||1) / 1000, 0);

  // Banco baterías LFP
  const batKwh  = +(kwhCrit * autonomia / DoD).toFixed(1);
  const batVbus = kwhTotal > 5 ? 48 : 24;
  const batAh   = Math.ceil(batKwh * 1000 / batVbus);

  // Inversor: considera inrush de motores (3× potencia nominal)
  const motorW = Math.max(0, ...todos.filter(c => c.esMotor).map(c => c.potencia * (c.cantidad||1)));
  const potPico = Math.max(kwhTotal * 500, motorW * 3);
  const invKw   = _nextStd(_INV_OFFGRID, potPico / 1000 * 1.25);

  const { pvKwp, nPaneles, pvKwpReal } = _pvDims(kwhTotal, hsp, PR);

  return {
    tipo: 'aislado', hsp,
    kwhCrit: +kwhCrit.toFixed(2), kwhTotal: +kwhTotal.toFixed(2),
    autonomia, batKwh, batVbus, batAh,
    pvKwp, nPaneles, pvKwpReal, invKw,
    modelo: {
      paneles:      `${nPaneles} × Módulo Mono PERC 580 Wp = ${pvKwpReal} kWp`,
      inversor:     `Inversor/cargador off-grid ${invKw} kW — bus ${batVbus}V DC`,
      baterias:     `Banco LFP ${batVbus}V — ${batAh} Ah (${batKwh} kWh útiles, ${autonomia}d autonomía)`,
      controlador:  'BMS compatible LFP (integrado o externo al inversor/cargador)',
      protDC:       `Fusible de banco ${Math.ceil(batKwh*1000/batVbus/10)*10} A entre batería e inversor`,
    },
  };
}

// ── HÍBRIDO / RESPALDO ────────────────────────────────────────────────────────
export function calcHibrido(lev) {
  const hsp       = getHSP(lev.tMinCiudad);
  const PR        = 0.75;
  const DoD       = 0.80;
  const autonomia = lev.autonomia || 4;

  const cargasCrit = lev.cargasCriticas || lev.cargasRespaldo || [];
  const kwhDia     = _kwhDia(lev) || 10;

  // Energía de respaldo solo en cargas críticas durante horas de autonomía
  const kwhRespaldo = cargasCrit.length
    ? cargasCrit.reduce((s,c) => {
        const h = Math.min(c.horas, autonomia);
        return s + c.potencia * h * (c.cantidad||1) / 1000;
      }, 0)
    : kwhDia * (autonomia / 24) * 0.4;

  const batKwh = +(kwhRespaldo / DoD).toFixed(1);

  const potCritW = cargasCrit.length
    ? cargasCrit.reduce((s,c) => s + c.potencia * (c.cantidad||1), 0)
    : kwhDia * 400;
  const invKw = _nextStd(_INV_OFFGRID, potCritW / 1000 * 1.25);

  const { pvKwp, nPaneles, pvKwpReal } = _pvDims(kwhDia, hsp, PR);
  const invGridKw = _nextStd(_INV_GRID, pvKwp * 1.05);
  const genMes    = Math.round(pvKwpReal * hsp * PR * 30);
  const cobertura = Math.min(Math.round(genMes / (kwhDia * 30) * 100), 100);

  return {
    tipo: 'hibrido', hsp,
    kwhDia: +kwhDia.toFixed(2), kwhRespaldo: +kwhRespaldo.toFixed(2),
    autonomia, batKwh,
    pvKwp, nPaneles, pvKwpReal,
    invKw, invGridKw, genMes, cobertura,
    modelo: {
      paneles:  `${nPaneles} × Módulo Mono PERC 580 Wp = ${pvKwpReal} kWp`,
      inversor: `Inversor híbrido ${invKw} kW (MPPT ${invGridKw} kW FV + respaldo integrado)`,
      baterias: `Banco LFP 48V — ${batKwh} kWh útiles (${autonomia}h cargas críticas)`,
      ats:      'ATS integrado al inversor híbrido — transferencia < 20 ms automática',
      smart:    'Smart meter en acometida para monitoreo y anti-volcado',
    },
  };
}

// ── BOMBEO SOLAR ──────────────────────────────────────────────────────────────
export function calcBombeo(lev) {
  const hsp          = getHSP(lev.tMinCiudad);
  const profundidad  = lev.profundidadPozo || 30;
  const caudal       = lev.caudal          || 5;   // m³/h
  const horasBombeo  = lev.horasBombeo     || 6;

  const cdt     = +(profundidad * 1.15).toFixed(1);   // +15% pérdidas tubería
  const phidro  = +((cdt * caudal * 1000) / (3600 * 0.60 * 0.90)).toFixed(2); // kW
  const vfdKw   = _nextStd(_VFD_SIZES, phidro * 1.25);
  const pvKwp   = +((vfdKw * horasBombeo) / (hsp * 0.75)).toFixed(2);
  const nPaneles = Math.ceil(pvKwp * 1000 / WP_PANEL);
  const pvKwpReal = +(nPaneles * WP_PANEL / 1000).toFixed(2);
  const volDia  = +(caudal * horasBombeo).toFixed(1);

  return {
    tipo: 'bombeo', hsp,
    profundidad, cdt, caudal, horasBombeo,
    volDia, phidro, vfdKw,
    pvKwp, nPaneles, pvKwpReal,
    modelo: {
      paneles:  `${nPaneles} × Módulo Mono PERC 580 Wp = ${pvKwpReal} kWp`,
      vfd:      `Variador de frecuencia solar ${vfdKw} kW — entrada MPPT DC directa (sin baterías)`,
      bomba:    `Motor trifásico / sumergible ${vfdKw} kW, 380V AC`,
      proteccion: 'Protección vacío y sobrepresión integrada al VFD; sensor de nivel de cisterna',
    },
  };
}

// ── Dispatcher principal ──────────────────────────────────────────────────────
export function calcDimensionamiento(project) {
  const lev  = project.documentacion?.levantamiento || {};
  const tipo = project.tipoSistema;
  if (tipo === 'interconectado')                    return calcInterconectado(lev);
  if (tipo === 'hibrido' || tipo === 'hibrido_respaldo') return calcHibrido(lev);
  if (tipo === 'aislado' || tipo === 'sistema_pequeno')  return calcAislado(lev);
  if (tipo === 'bombeo')                            return calcBombeo(lev);
  return { error: `Tipo de sistema "${tipo}" no reconocido.` };
}

// ── Detección automática de riesgos ──────────────────────────────────────────
export function detectarRiesgos(project) {
  const lev  = project.documentacion?.levantamiento || {};
  const tipo = project.tipoSistema;
  const r    = [];

  if (!lev.tMinCiudad)
    r.push({ nivel:'warn', msg:'Estado no seleccionado en Levantamiento — HSP calculado con valor promedio nacional (5.5 h/día).' });

  if (!lev.areaDisponible)
    r.push({ nivel:'warn', msg:'Área disponible en techo no medida — confirmar que los paneles calculados caben físicamente.' });

  if (lev.tipTecho === 'Madera' && lev.estadoMadera?.includes('Deteriorada'))
    r.push({ nivel:'error', msg:'Techo de madera deteriorado — requiere evaluación estructural antes de autorizar montaje.' });

  if (lev.sombras?.checklist?.length)
    r.push({ nivel:'warn', msg:`Sombras detectadas: ${lev.sombras.checklist.join(', ')} — evaluar optimizadores de potencia o microinversores.` });

  const ambient = lev.condicionesAmbientales || [];
  if (ambient.some(c => c.toLowerCase().includes('salin') || c.toLowerCase().includes('mar')))
    r.push({ nivel:'error', msg:'Ambiente marino / alta salinidad — especificar módulos con marco anodizado, conectores IP68 y gabinete inversor NEMA 4X o IP65.' });

  if (lev.distInversorPaneles > 30)
    r.push({ nivel:'warn', msg:`Distancia inversor→paneles de ${lev.distInversorPaneles} m — verificar sección de cable DC para caída ≤ 1%.` });

  if ((tipo === 'aislado' || tipo === 'sistema_pequeno') && !lev.autonomia)
    r.push({ nivel:'warn', msg:'Días de autonomía no definidos en Levantamiento — se asumió 2 días para el cálculo del banco.' });

  if (tipo === 'bombeo' && !lev.profundidadPozo)
    r.push({ nivel:'warn', msg:'Profundidad de pozo no declarada — se asumió 30 m para el CDT. Medir con sonda antes de sizing final.' });

  return r;
}

// ── Caída de tensión y sección de cable ───────────────────────────────────────
// Retorna la sección mínima recomendada en mm² para cumplir ΔV%
export function calcSeccionCable({ longitud, corriente, vNominal, pctMax = 0.01, tipo = 'DC' }) {
  const sigma  = 56; // Cu — S·m/mm²
  const factor = tipo === 'DC' ? 2 : 1.732; // DC: ida+vuelta; AC trifásico: √3
  const dvMax  = vNominal * pctMax;
  const aMin   = (factor * longitud * corriente) / (sigma * dvMax);
  const secs   = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50];
  const seccion = secs.find(s => s >= aMin) || 50;
  const dvReal  = (factor * longitud * corriente) / (sigma * seccion);
  return {
    aMin:    +aMin.toFixed(2),
    seccion,
    pctReal: +(dvReal / vNominal * 100).toFixed(3),
    cumple:  dvReal / vNominal <= pctMax,
  };
}

// ── Checklist de campo (Sección D) ───────────────────────────────────────────
export function getChecklistCampo(res) {
  const base = [
    { id:'cc-01', n:'Medición Voc por string con multímetro (paneles en circuito abierto, inversor desconectado)', hasInput:true, placeholder:'Ej. 380 V' },
    { id:'cc-02', n:'Medición Isc por string con pinza amperimétrica DC', hasInput:true, placeholder:'Ej. 14.2 A' },
    { id:'cc-03', n:'Prueba de aislamiento (megóhmetro 1000 VDC): R > 1 MΩ entre conductor y tierra', hasInput:true, placeholder:'Ej. 500 MΩ' },
    { id:'cc-04', n:'Verificación de polaridad DC antes de conectar al inversor (+/−)' },
    { id:'cc-05', n:'Apriete de terminales en borneras, clemas y bus-bar (rach + dado adecuado)' },
    { id:'cc-06', n:'Encendido del inversor sin alarmas ni fallas — secuencia correcta' },
  ];
  if (res?.tipo === 'aislado' || res?.tipo === 'hibrido') {
    base.push(
      { id:'cc-07', n:'Voltaje del banco de baterías antes de primer arranque', hasInput:true, placeholder:`Ej. ${(res.batVbus||48)} V` },
      { id:'cc-08', n:'Configuración BMS y SOC inicial — registrar valor en bitácora', hasInput:true, placeholder:'Ej. 85 % SOC' },
      { id:'cc-09', n:'Prueba de transferencia automática ATS — simular corte de red y verificar tiempo < 20 ms' },
    );
  }
  if (res?.tipo === 'bombeo') {
    base.push(
      { id:'cc-07', n:'Prueba de arranque VFD — verificar frecuencia de salida rampa lenta (0 → 50 Hz)', hasInput:true, placeholder:'Ej. 50 Hz / 380 V' },
      { id:'cc-08', n:'Medición de caudal real en descarga vs. caudal de diseño', hasInput:true, placeholder:`Ej. ${res.caudal||5} m³/h` },
    );
  }
  base.push(
    { id:'cc-10', n:'Configuración de parámetros de red en inversor (voltaje, frecuencia, anti-islanding)' },
    { id:'cc-11', n:'Activación de datalogger / monitoreo — verificar envío de telemetría a plataforma' },
  );
  return base;
}
