// modules/inventario/index.js
// Stub de integración con el inventario de materiales Ecofit

/**
 * Catálogo base de materiales Ecofit Solar Solutions.
 * Ampliar con referencias reales, precios y stock.
 */
export const MATERIALES_BASE = [
  // Paneles
  { clave: 'PAN-400W',  nombre: 'Panel Solar 400W Monocristalino', unidad: 'pza', categoria: 'paneles' },
  { clave: 'PAN-450W',  nombre: 'Panel Solar 450W Monocristalino', unidad: 'pza', categoria: 'paneles' },
  { clave: 'PAN-550W',  nombre: 'Panel Solar 550W Monocristalino', unidad: 'pza', categoria: 'paneles' },

  // Inversores
  { clave: 'INV-HYB-5K', nombre: 'Inversor Híbrido 5kW',           unidad: 'pza', categoria: 'inversores' },
  { clave: 'INV-HYB-8K', nombre: 'Inversor Híbrido 8kW',           unidad: 'pza', categoria: 'inversores' },
  { clave: 'INV-RED-5K', nombre: 'Inversor Grid-Tie 5kW',          unidad: 'pza', categoria: 'inversores' },

  // Baterías
  { clave: 'BAT-LIT-5K', nombre: 'Batería Litio 5kWh Pylontech',   unidad: 'pza', categoria: 'baterias' },
  { clave: 'BAT-LIT-10K',nombre: 'Batería Litio 10kWh',            unidad: 'pza', categoria: 'baterias' },

  // Estructura
  { clave: 'EST-RIEL-4', nombre: 'Riel aluminio 4m K2',            unidad: 'pza', categoria: 'estructura' },
  { clave: 'EST-GRAPA',  nombre: 'Grapa media aluminio',           unidad: 'pza', categoria: 'estructura' },
  { clave: 'EST-GANCHO', nombre: 'Gancho teja universal',          unidad: 'pza', categoria: 'estructura' },

  // Cableado
  { clave: 'CAB-10MM',  nombre: 'Cable solar 10mm² (rollo 100m)',  unidad: 'rollo', categoria: 'cableado' },
  { clave: 'CAB-THHN10',nombre: 'Cable THHN 10 AWG (rollo 100m)', unidad: 'rollo', categoria: 'cableado' },
  { clave: 'CON-MC4',   nombre: 'Conector MC4 par',                unidad: 'par',  categoria: 'cableado' },

  // Protecciones
  { clave: 'PROT-DC-20', nombre: 'Breaker DC 20A',                 unidad: 'pza', categoria: 'protecciones' },
  { clave: 'PROT-AC-30', nombre: 'Breaker AC 30A 2P',              unidad: 'pza', categoria: 'protecciones' },
  { clave: 'PROT-DPS',   nombre: 'Descargador de sobretensión',    unidad: 'pza', categoria: 'protecciones' },
];

/**
 * Busca materiales por texto en nombre o clave.
 *
 * @param {string} query - texto de búsqueda
 * @returns {Array} materiales filtrados
 */
export function buscarMaterial(query = '') {
  const q = query.toLowerCase();
  return MATERIALES_BASE.filter(m =>
    m.nombre.toLowerCase().includes(q) || m.clave.toLowerCase().includes(q)
  );
}

/**
 * Obtiene materiales por categoría.
 *
 * @param {string} categoria - categoría a filtrar
 * @returns {Array}
 */
export function porCategoria(categoria) {
  return MATERIALES_BASE.filter(m => m.categoria === categoria);
}

/**
 * Ajusta stock de un material (stub para conexión con inventario real).
 * TODO: Conectar con la base de datos de inventario.
 *
 * @param {string} clave - clave del material
 * @param {number} cantidad - cantidad a ajustar (positivo = entrada, negativo = salida)
 * @param {string} projectId - ID del proyecto que genera el movimiento
 */
export async function ajustarStock(clave, cantidad, projectId) {
  console.log('[Inventario] ajustarStock stub', { clave, cantidad, projectId });
  // TODO: Implementar con IndexedDB store de inventario
}
