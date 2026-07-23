// aud-data.js — Datos estáticos del módulo Auditoría Técnica

// ── Checklist RÁPIDO — 20 ítems en 6 secciones ────────────────────────────────
export const CHECKLIST_RAPIDO = [
  { id: 'r1',  sec: 'Estructura y paneles',      label: 'Tornillería con torque firme — paneles no se mueven' },
  { id: 'r2',  sec: 'Estructura y paneles',      label: 'Paneles orientados al sur, libres de sombras' },
  { id: 'r3',  sec: 'Estructura y paneles',      label: 'Estructura bien anclada, no se mueve al jalarla' },
  { id: 'r4',  sec: 'Cableado',                  label: 'Cables DC tipo PV Wire (resistentes al sol y la intemperie)' },
  { id: 'r5',  sec: 'Cableado',                  label: 'Conectores MC4 hacen clic y no se sueltan al jalar' },
  { id: 'r6',  sec: 'Cableado',                  label: 'Cableado dentro de tubería metálica al entrar a la casa' },
  { id: 'r7',  sec: 'Protecciones e inversor',   label: 'Inversor con espacio libre de ventilación a los lados' },
  { id: 'r8',  sec: 'Protecciones e inversor',   label: 'Fusibles y breakers del calibre indicado en el plano' },
  { id: 'r9',  sec: 'Protecciones e inversor',   label: 'Supresores de picos (DPS) instalados en DC y AC' },
  { id: 'r10', sec: 'Protecciones e inversor',   label: 'Interruptores de desconexión accesibles y a la vista' },
  { id: 'r11', sec: 'Tierra física',             label: 'Marcos de paneles conectados al cable de tierra' },
  { id: 'r12', sec: 'Tierra física',             label: 'Arandelas de estrella (WEEB) en cada conexión de tierra' },
  { id: 'r13', sec: 'Tierra física',             label: 'Cable de tierra llega hasta la varilla enterrada' },
  { id: 'r14', sec: 'Etiquetado',                label: 'Tuberías con calcomanía "Fuente de Energía Fotovoltaica"' },
  { id: 'r15', sec: 'Etiquetado',                label: 'Tablero con letrero "Precaución: Dos fuentes de energía"' },
  { id: 'r16', sec: 'Prueba final',              label: 'Polaridad verificada con multímetro — positivo y negativo correctos' },
  { id: 'r17', sec: 'Prueba final',              label: 'Voltaje de cadena no supera el límite máximo del inversor' },
  { id: 'r18', sec: 'Prueba final',              label: 'Anti-isla: inversor se apaga al bajar el interruptor principal' },
  { id: 'r19', sec: 'Prueba final',              label: 'Inversor sin errores — estado Normal / luz verde' },
  { id: 'r20', sec: 'Prueba final',              label: 'Entrega explicada y firmada con el cliente' },
];

// ── Checklist FORMAL — 20 ítems en 10 secciones con referencia normativa ──────
export const CHECKLIST_FORMAL = [
  { id: 'f1',  sec: 'Estructura y sujeción mecánica', label: 'Rieles y montajes resistentes a cargas de viento', ref: 'Art. 690.4(C)' },
  { id: 'f2',  sec: 'Estructura y sujeción mecánica', label: 'Materiales compatibles — sin par galvánico Aluminio/Acero', ref: 'Art. 110.3(B)' },
  { id: 'f3',  sec: 'Paneles fotovoltaicos',          label: 'Marcado visible: Voc, Isc, Vmp, Imp, Max System Voltage', ref: 'Art. 690.51' },
  { id: 'f4',  sec: 'Paneles fotovoltaicos',          label: 'Módulos certificados UL 1703 / IEC 61215', ref: 'Art. 690.4(D)' },
  { id: 'f5',  sec: 'Cableado DC',                    label: 'Conductor tipo PV resistente a rayos UV en áreas expuestas', ref: 'Art. 690.31(B)' },
  { id: 'f6',  sec: 'Cableado DC',                    label: 'Canalización metálica en conductores DC que entran a edificios', ref: 'Art. 690.31(E)' },
  { id: 'f7',  sec: 'Cableado AC',                    label: 'Ampacidad al 125% de la corriente de salida del inversor', ref: 'Art. 690.8' },
  { id: 'f8',  sec: 'Cableado AC',                    label: 'Fase, neutro y tierra en la misma canalización', ref: 'Art. 300.3(B)' },
  { id: 'f9',  sec: 'Protecciones DC',                label: 'Fusibles de cadena: 1.56 a 2.4 × Isc del módulo', ref: 'Art. 690.9' },
  { id: 'f10', sec: 'Protecciones DC',                label: 'Supresor de picos DPS DC instalado y conectado a tierra', ref: 'Guía Técnica CFE' },
  { id: 'f11', sec: 'Protecciones AC',                label: 'Regla del 120% cumplida en el bus del tablero', ref: 'Art. 690.64(B)' },
  { id: 'f12', sec: 'Protecciones AC',                label: 'Desconectador visible, bloqueable y accesible para CFE', ref: 'Art. 690.13 / G0100-04' },
  { id: 'f13', sec: 'Inversor / Cargador',            label: 'Certificación anti-isla UL 1741 / IEEE 1547 — desconexión < 0.5 s', ref: 'Anexo II CFE' },
  { id: 'f14', sec: 'Inversor / Cargador',            label: 'Protección contra falla de arco (AFCI) integrada', ref: 'Art. 690.11' },
  { id: 'f15', sec: 'Tierra física',                  label: 'Continuidad en marcos de paneles con arandelas estrella (WEEB)', ref: 'Art. 690.43' },
  { id: 'f16', sec: 'Tierra física',                  label: 'Resistencia del electrodo de tierra < 25 Ω', ref: 'Art. 250' },
  { id: 'f17', sec: 'Etiquetado y señalización',      label: 'Letrero "SISTEMA FOTOVOLTAICO" en tablero y desconectadores', ref: 'Art. 690.56' },
  { id: 'f18', sec: 'Etiquetado y señalización',      label: 'Marcado "Peligro: Fuentes Múltiples de Energía"', ref: 'Art. 690.56(B)' },
  { id: 'f19', sec: 'Puesta en marcha',               label: 'Polaridad verificada antes de la conexión al inversor', ref: 'Manual Puesta en Marcha' },
  { id: 'f20', sec: 'Puesta en marcha',               label: 'Torque aplicado según especificaciones del fabricante', ref: 'Manual Puesta en Marcha' },
];

// ── Filtrado por tipo de sistema ──────────────────────────────────────────────
// Ítems que solo aplican a sistemas interconectados a la red CFE: anti-isla,
// letrero de dos fuentes, regla del 120%, desconectador para CFE. En sistemas
// sin red (aislado, bombeo, sistema pequeño) se excluyen — antes aparecían y
// obligaban a marcarlos aunque no existiera la instalación referida.
const _SOLO_RED_RAPIDO = ['r15', 'r18'];
const _SOLO_RED_FORMAL = ['f11', 'f12', 'f13', 'f18'];
const _SIN_RED = ['aislado', 'bombeo', 'sistema_pequeno'];

export function checklistRapidoPara(tipoSistema) {
  return _SIN_RED.includes(tipoSistema)
    ? CHECKLIST_RAPIDO.filter(i => !_SOLO_RED_RAPIDO.includes(i.id))
    : CHECKLIST_RAPIDO;
}
export function checklistFormalPara(tipoSistema) {
  return _SIN_RED.includes(tipoSistema)
    ? CHECKLIST_FORMAL.filter(i => !_SOLO_RED_FORMAL.includes(i.id))
    : CHECKLIST_FORMAL;
}

export const MEDICIONES = [
  { id: 'voc',        label: 'Voltaje Voc (cadena)',         unit: 'V',  ref: 'No superar Voc máx. del inversor' },
  { id: 'isc',        label: 'Corriente Isc (cadena)',       unit: 'A',  ref: 'Isc módulo × 1.25' },
  { id: 'vmpp',       label: 'Voltaje Vmpp (operación)',     unit: 'V',  ref: 'Dentro del rango MPPT del inversor' },
  { id: 'aislamiento',label: 'Resistencia de aislamiento',  unit: 'MΩ', ref: '> 1 MΩ a 1000 V' },
  { id: 'tierra',     label: 'Resistencia a tierra',        unit: 'Ω',  ref: '< 25 Ω' },
];

export const RESULTADOS_FORMAL = {
  aprobado:          { label: 'Aprobado',                      color: '#52B788' },
  aprobado_con_obs:  { label: 'Aprobado con observaciones',    color: '#f5c400' },
  no_aprobado:       { label: 'No aprobado',                   color: '#ef4444' },
};
