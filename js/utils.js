// utils.js — Helpers comunes

// ── Escape HTML ────────────────────────────────────────────────────────────────
export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Fechas ─────────────────────────────────────────────────────────────────────
export function fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtFechaHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function fmtRelativa(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
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

// ── Compresión de imagen ───────────────────────────────────────────────────────
export function compressImage(file, maxDim = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Captura foto con input file (abre cámara directo en móvil)
export function capturePhoto(callback, { multiple = false } = {}) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment'; // cámara trasera
  if (multiple) input.multiple = true;
  input.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const compressed = await Promise.all(files.map(f => compressImage(f)));
    callback(multiple ? compressed : compressed[0], files);
  };
  input.click();
}

// ── Toast ──────────────────────────────────────────────────────────────────────
export function toast(msg, type = 'info') {
  let el = document.getElementById('toast-container');
  if (!el) { el = document.createElement('div'); el.id = 'toast-container'; document.body.appendChild(el); }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  el.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast-show'));
  setTimeout(() => { t.classList.remove('toast-show'); setTimeout(() => t.remove(), 300); }, 3000);
}

// ── Confirm ────────────────────────────────────────────────────────────────────
export function confirmDialog(msg) {
  return confirm(msg); // en v2 reemplazar con modal custom
}

// ── Número de proyecto ─────────────────────────────────────────────────────────
export function fmtProjectId(counter) {
  const year = new Date().getFullYear();
  return `EFS-${year}-${String(counter).padStart(4, '0')}`;
}

// ── Render foto miniatura ──────────────────────────────────────────────────────
export function fotoMini(src, alt = '', onClick) {
  if (!src) return '';
  const id = 'img_' + uuid().replace(/-/g, '').slice(0, 10);
  if (onClick) {
    return `<img id="${id}" src="${src}" alt="${esc(alt)}" class="foto-mini" onclick="${onClick}" />`;
  }
  return `<img id="${id}" src="${src}" alt="${esc(alt)}" class="foto-mini"
    onclick="window._viewPhoto('${id}')" />`;
}

// Visor de foto ampliada
window._viewPhoto = function(imgId) {
  const src = document.getElementById(imgId)?.src;
  if (!src) return;
  const overlay = document.createElement('div');
  overlay.className = 'photo-overlay';
  overlay.innerHTML = `<img src="${src}" /><button onclick="this.parentElement.remove()">✕</button>`;
  document.body.appendChild(overlay);
};

// ── Indicador de sync ──────────────────────────────────────────────────────────
export function syncBadge(synced) {
  if (synced === true)  return '<span class="sync-badge sync-ok" title="Sincronizado">✔</span>';
  if (synced === false) return '<span class="sync-badge sync-pending" title="Pendiente sync">☁</span>';
  return '<span class="sync-badge sync-local" title="Guardado local">✅</span>';
}

// ── Estado labels ──────────────────────────────────────────────────────────────
export const ESTADOS = {
  borrador:            { label: 'Borrador',           color: '#9bbfad', icon: 'pencil-line' },
  en_progreso:         { label: 'En Progreso',         color: '#4ade80', icon: 'play-circle' },
  pendiente_revision:  { label: 'Pendiente Revisión',  color: '#fbbf24', icon: 'clock-countdown' },
  observado:           { label: 'Observado',           color: '#fb923c', icon: 'warning-circle' },
  cerrado:             { label: 'Cerrado',             color: '#60a5fa', icon: 'seal-check' },
  cancelado:           { label: 'Cancelado',           color: '#f87171', icon: 'x-circle' },
};

export const PRIORIDADES = {
  normal:   { label: 'Normal',  color: '#9bbfad' },
  urgente:  { label: 'Urgente', color: '#fbbf24' },
  critico:  { label: 'Crítico', color: '#f87171' },
};

export const TIPOS_SISTEMA = {
  interconectado: { label: 'Interconectado CFE',  icon: 'lightning' },
  hibrido:        { label: 'Híbrido',              icon: 'battery-charging' },
  aislado:        { label: 'Aislado / Off-grid',   icon: 'sun-horizon' },
  bombeo:         { label: 'Bombeo Solar',          icon: 'waves' },
  respaldo:       { label: 'Respaldo',              icon: 'shield-check' },
  otro:           { label: 'Otro',                  icon: 'squares-four' },
};

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
