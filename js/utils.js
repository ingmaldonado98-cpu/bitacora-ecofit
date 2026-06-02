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
    try {
      const compressed = await Promise.all(files.map(f => compressImage(f)));
      await callback(multiple ? compressed : compressed[0], files);
    } catch (err) {
      if (err.code === 'offline') {
        toast('Sin conexión — la foto no se guardó. Conéctate e intenta de nuevo.', 'error', 6000);
      } else {
        console.error('capturePhoto error:', err);
        toast('Error al guardar la foto: ' + (err.message || 'intenta de nuevo'), 'error');
      }
    }
  };
  input.click();
}

// ── Barra de progreso de subida ───────────────────────────────────────────────
export function uploadProgressBar(total) {
  const el = document.createElement('div');
  el.className = 'upload-progress-bar';
  el.innerHTML = `
    <span class="upb-icon">⬆</span>
    <div class="upb-body">
      <span class="upb-text">Subiendo 0 de ${total}…</span>
      <div class="upb-track"><div class="upb-fill"></div></div>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('upb-visible'));
  return {
    update(current) {
      el.querySelector('.upb-text').textContent = `Subiendo ${current} de ${total}…`;
      el.querySelector('.upb-fill').style.width = `${Math.round(current / total * 100)}%`;
    },
    done() {
      el.classList.remove('upb-visible');
      setTimeout(() => el.remove(), 300);
    },
  };
}

// ── Toast ──────────────────────────────────────────────────────────────────────
export function toast(msg, type = 'info', duration = 3000) {
  let el = document.getElementById('toast-container');
  if (!el) { el = document.createElement('div'); el.id = 'toast-container'; document.body.appendChild(el); }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  el.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast-show'));
  setTimeout(() => { t.classList.remove('toast-show'); setTimeout(() => t.remove(), 300); }, duration);
}

// ── Modal de confirmación ─────────────────────────────────────────────────────
export function confirmDialog(msg) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-confirm-overlay';
    overlay.innerHTML = `
      <div class="modal-confirm" role="alertdialog" aria-modal="true">
        <p class="modal-confirm-msg">${esc(msg)}</p>
        <div class="modal-confirm-actions">
          <button class="btn-outline modal-btn-cancel">Cancelar</button>
          <button class="btn-primary modal-btn-ok">Confirmar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const ok  = overlay.querySelector('.modal-btn-ok');
    const can = overlay.querySelector('.modal-btn-cancel');
    const close = val => { overlay.remove(); resolve(val); };
    ok.onclick  = () => close(true);
    can.onclick = () => close(false);
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(false); });
    ok.focus();
  });
}

// ── Modal de entrada de texto ─────────────────────────────────────────────────
export function inputDialog(label, defaultValue = '', hint = '') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-confirm-overlay';
    overlay.innerHTML = `
      <div class="modal-confirm" role="dialog" aria-modal="true">
        <label class="modal-confirm-msg" style="display:block;margin-bottom:.5rem">${esc(label)}</label>
        <input class="modal-input" type="text" value="${esc(defaultValue)}" autocomplete="off" />
        ${hint ? `<p class="modal-input-hint">${esc(hint)}</p>` : ''}
        <div class="modal-confirm-actions">
          <button class="btn-outline modal-btn-cancel">Cancelar</button>
          <button class="btn-primary modal-btn-ok">Aceptar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const inp = overlay.querySelector('.modal-input');
    const ok  = overlay.querySelector('.modal-btn-ok');
    const can = overlay.querySelector('.modal-btn-cancel');
    const close = val => { overlay.remove(); resolve(val); };
    ok.onclick  = () => close(inp.value);
    can.onclick = () => close(null);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); close(inp.value); }
      if (e.key === 'Escape') { e.preventDefault(); close(null); }
    });
    inp.focus();
    inp.select();
  });
}

// ── Modal de cambio de estado con nota ───────────────────────────────────────
export function cambioEstadoDialog(estadoLabel, notaRequerida) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-confirm-overlay';
    overlay.innerHTML = `
      <div class="modal-confirm" role="dialog" aria-modal="true">
        <p class="modal-confirm-msg">Cambiar estado a <strong>${esc(estadoLabel)}</strong></p>
        <label class="modal-nota-label">
          Nota${notaRequerida
            ? ' <span class="modal-nota-req">* requerida</span>'
            : ' <span class="modal-nota-opt">(opcional)</span>'}
        </label>
        <textarea class="modal-textarea" rows="3"
          placeholder="${notaRequerida ? 'Explica el motivo del cambio…' : 'Motivo o comentario del cambio…'}"></textarea>
        <div class="modal-confirm-actions">
          <button class="btn-outline modal-btn-cancel">Cancelar</button>
          <button class="btn-primary modal-btn-ok">Confirmar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const ta  = overlay.querySelector('.modal-textarea');
    const ok  = overlay.querySelector('.modal-btn-ok');
    const can = overlay.querySelector('.modal-btn-cancel');
    const close = val => { overlay.remove(); resolve(val); };
    ok.onclick = () => {
      const nota = ta.value.trim();
      if (notaRequerida && !nota) {
        ta.classList.add('modal-input-error');
        ta.focus();
        return;
      }
      close({ ok: true, nota: nota || null });
    };
    can.onclick = () => close(null);
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(null); });
    ta.focus();
  });
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

// ── Lightbox con swipe, zoom y navegación entre fotos del grupo ───────────────
window._viewPhoto = function(imgId) {
  const img = document.getElementById(imgId);
  if (!img) return;

  // Recopilar todas las fotos del mismo contenedor
  const grid = img.closest('.fotos-grid') || img.closest('.card') || document.body;
  const siblings = [...grid.querySelectorAll('.foto-mini')];
  const srcs  = siblings.map(i => i.src).filter(Boolean);
  let idx     = siblings.indexOf(img);
  if (idx < 0) { idx = 0; }

  let zoomed   = false;
  let touchX0  = 0;
  let touchY0  = 0;

  const overlay = document.createElement('div');
  overlay.className = 'lb-overlay';

  function render() {
    const total = srcs.length;
    overlay.innerHTML = `
      <button class="lb-close" aria-label="Cerrar">✕</button>
      ${total > 1 ? `<span class="lb-counter">${idx + 1} / ${total}</span>` : ''}
      <div class="lb-img-wrap">
        <img class="lb-img ${zoomed ? 'lb-zoomed' : ''}" src="${srcs[idx]}" draggable="false" />
      </div>
      ${total > 1 ? `
        <button class="lb-nav lb-prev" ${idx === 0 ? 'disabled' : ''}>‹</button>
        <button class="lb-nav lb-next" ${idx === total - 1 ? 'disabled' : ''}>›</button>
      ` : ''}
      <p class="lb-hint">${zoomed ? 'Toca para reducir' : total > 1 ? 'Desliza o toca para ampliar' : 'Toca para ampliar'}</p>`;

    overlay.querySelector('.lb-close').onclick = () => overlay.remove();
    overlay.querySelector('.lb-img').onclick    = () => { zoomed = !zoomed; render(); };
    overlay.querySelector('.lb-prev')?.addEventListener('click', e => { e.stopPropagation(); if (idx > 0) { idx--; zoomed = false; render(); } });
    overlay.querySelector('.lb-next')?.addEventListener('click', e => { e.stopPropagation(); if (idx < srcs.length - 1) { idx++; zoomed = false; render(); } });
  }

  render();
  document.body.appendChild(overlay);

  // Swipe horizontal para navegar, vertical para cerrar
  overlay.addEventListener('touchstart', e => {
    touchX0 = e.touches[0].clientX;
    touchY0 = e.touches[0].clientY;
  }, { passive: true });

  overlay.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchX0;
    const dy = e.changedTouches[0].clientY - touchY0;
    if (Math.abs(dy) > Math.abs(dx) && dy > 60) { overlay.remove(); return; }
    if (Math.abs(dx) > 50) {
      if (dx < 0 && idx < srcs.length - 1) { idx++; zoomed = false; render(); }
      if (dx > 0 && idx > 0)               { idx--; zoomed = false; render(); }
    }
  }, { passive: true });

  // Cerrar con Escape
  const onKey = e => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
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
  interconectado:  { label: 'Interconectado CFE',        icon: 'lightning' },
  hibrido:         { label: 'Híbrido',                   icon: 'battery-charging' },
  aislado:         { label: 'Aislado / Off-grid',        icon: 'sun-horizon' },
  bombeo:          { label: 'Bombeo Solar',               icon: 'waves' },
  respaldo:        { label: 'Respaldo',                   icon: 'shield-check' },
  sistema_pequeno: { label: 'Sistema Pequeño',            icon: 'snowflake',
                     hint: 'Congeladores / refrigeradores solares, apoyos de gobierno' },
  otro:            { label: 'Otro',                       icon: 'squares-four' },
};

// Campos extra que aplican solo a Sistema Pequeño
export const CAMPOS_SISTEMA_PEQUENO = [
  { name: 'bateria',       label: 'Batería',             placeholder: 'Ej: LiFePO4 100Ah 48V' },
  { name: 'mppt',          label: 'Controlador MPPT',    placeholder: 'Ej: Victron SmartSolar 100/30' },
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
