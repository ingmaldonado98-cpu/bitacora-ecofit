// clima.js — Datos climáticos compartidos para cálculo de T_min (Voc)
// Usado por: documentacion.js (Levantamiento) y garantia.js (tile Voc)
//
// T_min de referencia = planicie / valle del estado (capital o zona urbana principal)
// La zona climática (_TMIN_ZONAS) aplica el ajuste fino dentro del estado.
// Fuente: registros históricos SMN / ASHRAE 99% design temperature.

export const TMIN_ESTADOS = [
  { nombre: 'Aguascalientes',      tMin: -1 },
  { nombre: 'Baja California',     tMin: -2 },  // Mexicali como referencia (más fría)
  { nombre: 'Baja California Sur', tMin:  3 },  // La Paz
  { nombre: 'Campeche',            tMin: 12 },
  { nombre: 'Chiapas',             tMin:  5 },
  { nombre: 'Chihuahua',           tMin: -8 },
  { nombre: 'Ciudad de México',    tMin:  2 },
  { nombre: 'Coahuila',            tMin: -5 },  // Saltillo
  { nombre: 'Colima',              tMin:  8 },
  { nombre: 'Durango',             tMin: -5 },
  { nombre: 'Guanajuato',          tMin:  1 },
  { nombre: 'Guerrero',            tMin:  8 },
  { nombre: 'Hidalgo',             tMin:  0 },
  { nombre: 'Jalisco',             tMin:  3 },  // Guadalajara
  { nombre: 'México (Estado)',     tMin:  1 },
  { nombre: 'Michoacán',           tMin:  1 },
  { nombre: 'Morelos',             tMin:  5 },
  { nombre: 'Nayarit',             tMin:  8 },
  { nombre: 'Nuevo León',          tMin:  0 },  // Monterrey
  { nombre: 'Oaxaca',              tMin:  3 },
  { nombre: 'Puebla',              tMin:  0 },
  { nombre: 'Querétaro',           tMin:  2 },
  { nombre: 'Quintana Roo',        tMin: 15 },
  { nombre: 'San Luis Potosí',     tMin: -2 },
  { nombre: 'Sinaloa',             tMin:  5 },  // Culiacán
  { nombre: 'Sonora',              tMin:  0 },  // Hermosillo
  { nombre: 'Tabasco',             tMin: 12 },
  { nombre: 'Tamaulipas',          tMin:  2 },
  { nombre: 'Tlaxcala',            tMin: -1 },
  { nombre: 'Veracruz',            tMin:  8 },
  { nombre: 'Yucatán',             tMin: 12 },
  { nombre: 'Zacatecas',           tMin: -3 },
];

// Zonas climáticas con offset sobre T_min del estado de referencia
export const TMIN_ZONAS = [
  { key: 'costa',   label: '🌊 Litoral / playa (< 50 msnm)',     offset:  2 },
  { key: 'valle',   label: '🏜️ Planicie / valle (ref. estado)',  offset:  0 },
  { key: 'rural',   label: '🌿 Rural / campo (200–500 msnm)',    offset: -2 },
  { key: 'sierra1', label: '⛰️ Pie de sierra (500–1500 msnm)',  offset: -5 },
  { key: 'sierra2', label: '🏔️ Sierra / montaña (> 1500 msnm)', offset: -8 },
];

// Descripciones para la tabla de referencia (Levantamiento)
export const TMIN_ZONA_DESC = {
  costa:   'Brisa marina modera el frío. Playas, puertos, zonas costeras. Ej: frente de playa en La Paz, Cabo, Mazatlán.',
  valle:   'Valor de referencia del estado. Centros urbanos, valles, llanuras. Ej: La Paz centro, Hermosillo, Monterrey.',
  rural:   'Campo abierto, ligera elevación. Pequeñas comunidades fuera de la ciudad. Ej: San Pedro BCS, ejidos, ranchos bajos.',
  sierra1: 'Comunidades en ladera o pie de sierra. Noches más frías por altitud. Ej: El Triunfo, San Antonio, Miraflores (BCS).',
  sierra2: 'Alta montaña, cañadas y sierras. Heladas frecuentes en invierno. Ej: Sierra de la Laguna, sierras de Chihuahua/Durango.',
};

// Etiquetas cortas para el tile de Voc
export const TMIN_ZONA_LABELS = {
  costa:   '🌊 Costa',
  valle:   '🏜️ Valle',
  rural:   '🌿 Campo',
  sierra1: '⛰️ Pie de sierra',
  sierra2: '🏔️ Sierra',
};

/**
 * Calcula el T_min final del sitio.
 * @param {string} estado  - Nombre del estado (debe existir en TMIN_ESTADOS)
 * @param {string} zona    - Key de zona ('costa' | 'valle' | 'rural' | 'sierra1' | 'sierra2')
 * @returns {number|null}  - T_min calculado, o null si el estado no existe
 */
export function calcTMin(estado, zona = 'valle') {
  const e = TMIN_ESTADOS.find(x => x.nombre === estado);
  const z = TMIN_ZONAS.find(x => x.key === zona);
  if (!e) return null;
  return e.tMin + (z?.offset ?? 0);
}
