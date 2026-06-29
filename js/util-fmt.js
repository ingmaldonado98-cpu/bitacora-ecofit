// util-fmt.js — Formato, escape HTML, fechas, crypto/IDs
// Extraído de utils.js. Sin dependencias de otros util-*.js (módulo base).

// ── Escape HTML ────────────────────────────────────────────────────────────────
export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Fechas ─────────────────────────────────────────────────────────────────────
// timeZone:'UTC' — fechas-calendario puras (fechaInicio, fechaEstimada) se
// guardan como medianoche UTC; sin esto, zonas horarias detrás de UTC (México)
// muestran el día anterior. No aplica a fmtFechaHora/fmtRelativa (timestamps
// reales, donde sí se quiere la hora local del usuario).
export function fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function fmtFechaHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function fmtRelativa(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) {
    // Fecha futura
    const absDiff = Math.abs(diff);
    const h = Math.floor(absDiff / 3600000);
    const d = Math.floor(absDiff / 86400000);
    if (h < 1) return 'ahora mismo';
    if (h < 24) return `en ${h}h`;
    if (d < 7) return `en ${d}d`;
    return fmtFecha(iso);
  }
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1) return 'hace un momento';
  if (h < 24) return `hace ${h}h`;
  if (d < 7) return `hace ${d}d`;
  return fmtFecha(iso);
}

export function isoNow() {
  return new Date().toISOString();
}

// ── Password hashing (SHA-256) ─────────────────────────────────────────────────
export async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// Detecta si un string es un hash SHA-256 (64 chars hex)
export function isHashed(str) {
  return typeof str === 'string' && /^[0-9a-f]{64}$/.test(str);
}

// ── UUID ───────────────────────────────────────────────────────────────────────
export function uuid() {
  return crypto.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
