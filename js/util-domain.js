// util-domain.js — Constantes de dominio y generadores de ID de proyecto
// Extraído de utils.js.

// ── Indicador de sync ──────────────────────────────────────────────────────────
// Solo muestra badge cuando está explícitamente sincronizado con Drive/OneDrive.
// Si driveSynced es false/undefined (estado normal), no muestra nada — evita confusión.
export function syncBadge(synced) {
  if (synced === true) return '<span class="sync-badge sync-ok" title="Sincronizado con OneDrive">✔</span>';
  return '';
}

// ── Estado labels ──────────────────────────────────────────────────────────────
export const ESTADOS = {
  borrador:            { label: 'Borrador',           color: '#9bbfad', icon: 'pencil-line' },
  en_progreso:         { label: 'En Progreso',         color: '#4ade80', icon: 'play-circle' },
  pendiente_revision:  { label: 'Pendiente Revisión',  color: '#fbbf24', icon: 'clock-countdown' },
  observado:           { label: 'Observado',           color: '#fb923c', icon: 'warning-circle' },
  comisionado:         { label: 'Comisionado',         color: '#a78bfa', icon: 'check-circle' },
  en_garantia:         { label: 'En Garantía',         color: '#34d399', icon: 'shield-check' },
  fuera_garantia:      { label: 'Fuera de Garantía',   color: '#6b7280', icon: 'shield-slash' },
  cerrado:             { label: 'Cerrado',             color: '#60a5fa', icon: 'seal-check' },
  cancelado:           { label: 'Cancelado',           color: '#f87171', icon: 'x-circle' },
};

export const PRIORIDADES = {
  normal:   { label: 'Normal',  color: '#9bbfad' },
  urgente:  { label: 'Urgente', color: '#fbbf24' },
  critico:  { label: 'Crítico', color: '#f87171' },
};

export const TIPOS_SISTEMA = {
  interconectado:   { label: 'Interconectado CFE',   icon: 'lightning' },
  hibrido_respaldo: { label: 'Híbrido / Respaldo',   icon: 'battery-charging' },
  aislado:          { label: 'Aislado / Off-grid',   icon: 'sun-horizon' },
  bombeo:           { label: 'Bombeo Solar',          icon: 'waves' },
  sistema_pequeno:  { label: 'Sistema Pequeño',       icon: 'snowflake',
                      hint: 'Congeladores / refrigeradores solares, apoyos de gobierno' },
  ampliacion:       { label: 'Ampliación',             icon: 'plus-circle' },
  otro:             { label: 'Otro',                  icon: 'squares-four' },
  // Legado — proyectos anteriores a la fusión (no aparece en nuevos formularios)
  hibrido:          { label: 'Híbrido',               icon: 'battery-charging', legacy: true },
  respaldo:         { label: 'Respaldo',              icon: 'shield-check',     legacy: true },
};

// Campos extra que aplican solo a Sistema Pequeño
export const CAMPOS_SISTEMA_PEQUENO = [
  { name: 'bateria',       label: 'Batería',             placeholder: 'Ej: LiFePO4 100Ah 48V' },
  { name: 'mppt',          label: 'Modelo del controlador', placeholder: 'Ej: Victron SmartSolar 100/30' },
  { name: 'inversor',      label: 'Inversor',            placeholder: 'Ej: Victron Phoenix 800VA (vacío si no aplica)' },
  { name: 'breakerPanel',  label: 'Breaker de paneles',  placeholder: 'Ej: DC 20A' },
  { name: 'breakerPolo',   label: 'Breaker 1 polo',      placeholder: 'Ej: AC 16A 1 polo' },
];

export const MARCAS_EQUIPOS = [
  'Victron Energy', 'LuxPower', 'SolarK', 'Pylontech', 'Epcom', 'EPEVER', 'Otra marca'
];

export const MARCAS_ESTRUCTURA = ['K2 Systems', 'Aluminex', 'Otra marca'];

export const SISTEMAS_ESTRUCTURALES = [
  'Simple Tilt', 'Tilt Up', 'Flush Mount', 'Miniriel', 'Otro'
];

export const TIPOS_FIJACION = [
  'Clamp', 'Tornillo doble rosca', 'Taquete químico',
  'Miniriel', 'Anclaje impermeabilizado', 'Otro'
];

// ── Número de proyecto ─────────────────────────────────────────────────────────
// Legado — conservado por compatibilidad con proyectos anteriores
export function fmtProjectId(counter) {
  const year = new Date().getFullYear();
  return `EFS-${year}-${String(counter).padStart(4, '0')}`;
}

// Nuevo formato: Apellido / DD-Mmm / TipoSistema
// Ejemplo: García / 15-Ene / Interconectado
// Si existingIds se pasa, agrega sufijo -2, -3... para evitar duplicados
export function genDisplayId(clientName, dateIso, tipoSistema, existingIds = []) {
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const palabras = (clientName || 'Cliente').trim().split(/\s+/);
  const apellido = palabras.length > 1 ? palabras[palabras.length - 1] : palabras[0];
  const d = new Date(dateIso || new Date());
  const dia = d.getDate();
  const mes = MESES[d.getMonth()];
  const tipoLabel = TIPOS_SISTEMA[tipoSistema]?.label || tipoSistema || 'General';
  const base = `${apellido} / ${dia}-${mes} / ${tipoLabel}`;
  // Evitar duplicados
  if (!existingIds.length || !existingIds.includes(base)) return base;
  let n = 2;
  while (existingIds.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
