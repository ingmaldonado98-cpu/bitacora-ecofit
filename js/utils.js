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

// Captura foto con input file (abre cámara directo en móvil).
// Opciones: multiple, projectId, fase, campo → renombran el archivo automáticamente.
//           preview → muestra confirmación antes de llamar al callback (solo single).
export function capturePhoto(callback, { multiple = false, projectId, fase, campo, preview = false } = {}) {
  const input = document.createElement('input');
  input.type        = 'file';
  input.accept      = 'image/*';
  input.capture     = 'environment'; // abre cámara trasera directamente en Android
  if (multiple) input.multiple = true;

  input.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    try {
      // Renombrar con metadata si se proporcionan projectId + fase + campo
      const renamedFiles = (projectId && fase && campo)
        ? files.map((f, i) => {
            const ts  = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '-');
            const sfx = multiple && files.length > 1 ? `_${i + 1}` : '';
            return new File([f], `${projectId}_${fase}_${campo}${sfx}_${ts}.jpg`, { type: f.type });
          })
        : files;

      const compressed = await Promise.all(renamedFiles.map(f => compressImage(f)));
      const fileMeta   = { fuente: 'camera', nombres: renamedFiles.map(f => f.name) };

      if (preview && !multiple) {
        _showPhotoPreview(
          compressed[0],
          () => callback(compressed[0], renamedFiles, fileMeta),
          () => capturePhoto(callback, { multiple, projectId, fase, campo, preview })
        );
      } else {
        await callback(multiple ? compressed : compressed[0], renamedFiles, fileMeta);
      }
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

// Preview de confirmación antes de aceptar la foto (uso interno)
function _showPhotoPreview(b64, onConfirm, onRetake) {
  const ov = document.createElement('div');
  ov.className = 'photo-preview-ov';
  ov.innerHTML = `
    <div class="photo-preview-modal">
      <p class="photo-preview-lbl">¿Usar esta foto?</p>
      <img src="${b64}" class="photo-preview-img" alt="Vista previa de la foto capturada">
      <div class="photo-preview-actions">
        <button class="btn-outline photo-preview-retake">↩ Retomar</button>
        <button class="btn-primary photo-preview-confirm">✓ Confirmar</button>
      </div>
    </div>
  `;
  document.body.appendChild(ov);
  ov.querySelector('.photo-preview-retake').onclick  = () => { ov.remove(); onRetake(); };
  ov.querySelector('.photo-preview-confirm').onclick = () => { ov.remove(); onConfirm(); };
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

// ── Obtener URL de una foto (maneja pendientes offline) ────────────────────────
// item puede ser: string URL, string data:, u objeto {url?, data?, pending?, pendingId?}
export function getPendingSrc(item) {
  if (!item) return '';
  if (typeof item === 'string') return item;
  if (item.pending && item.pendingId) {
    return window._pendingPhotoMap?.[item.pendingId] || '';
  }
  return item.url || item.data || '';
}

// ── Render foto miniatura ──────────────────────────────────────────────────────
// src: string URL, data URL, u objeto foto {url?, data?, pending?, pendingId?}
export function fotoMini(src, alt = '', onClick, isPending = false) {
  const resolvedSrc = getPendingSrc(src);
  if (!resolvedSrc && !isPending) return '';
  const id = 'img_' + uuid().replace(/-/g, '').slice(0, 10);
  const pendingAttr = (isPending || (src && typeof src === 'object' && src.pending))
    ? `data-pending="true"` : '';
  const pendingBadge = pendingAttr
    ? `<span class="foto-pending-badge" title="Pendiente de subir">⬆</span>` : '';

  const imgHtml = resolvedSrc
    ? `<img id="${id}" src="${resolvedSrc}" alt="${esc(alt)}" class="foto-mini"
         ${pendingAttr}
         onclick="${onClick || `window._viewPhoto('${id}')`}" />`
    : `<div class="foto-mini foto-mini-placeholder" title="Foto pendiente de subir">⬆</div>`;

  if (!pendingBadge) return imgHtml;
  return `<div class="foto-mini-wrap">${imgHtml}${pendingBadge}</div>`;
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

// ── Overlay iframe del escáner Ecofit ─────────────────────────────────────────
// options:
//   continuous  — false (cierra tras el 1er scan) | true (queda abierto para multi-scan)
//   title       — texto en la cabecera del overlay
//   onClose     — callback al cerrar sin resultado
//
// Retorna la función closeScanner() por si el llamador quiere cerrar programáticamente.
export function openScannerOverlay(onResult, { continuous = false, title = 'Escanear código', onClose = null } = {}) {
  // Evitar duplicados
  document.getElementById('scanner-overlay-wrap')?.remove();

  const wrap = document.createElement('div');
  wrap.id = 'scanner-overlay-wrap';
  wrap.className = 'scanner-overlay-wrap';
  wrap.innerHTML = `
    <div class="scanner-overlay-hdr">
      <span class="scanner-overlay-title">${esc(title)}</span>
      <button class="scanner-overlay-close" id="scanner-overlay-close-btn" aria-label="Cerrar escáner">✕</button>
    </div>
    ${continuous ? `<div class="scanner-overlay-counter" id="scanner-overlay-counter">
      <span id="scanner-count-num">0</span> escaneados en esta sesión</div>` : ''}
    <iframe
      id="scanner-overlay-iframe"
      src="./ecofit-scanner.html"
      class="scanner-overlay-iframe"
      allow="camera;microphone"
      loading="lazy">
    </iframe>`;

  document.body.appendChild(wrap);
  // Animar entrada
  requestAnimationFrame(() => wrap.classList.add('scanner-overlay-visible'));

  let scanCount = 0;

  function close() {
    wrap.classList.remove('scanner-overlay-visible');
    setTimeout(() => wrap.remove(), 250);
    window.removeEventListener('message', onMsg);
    if (onClose) onClose();
  }

  function onMsg(e) {
    if (!e.data || e.data.type !== 'ECOFIT_SCAN') return;
    const code = e.data.code?.trim();
    if (!code) return;

    if (continuous) {
      scanCount++;
      const counter = document.getElementById('scanner-count-num');
      if (counter) counter.textContent = scanCount;
      onResult(code, e.data.format);
      // NO cerramos — el técnico sigue escaneando y pulsa ✕ cuando termina
    } else {
      close();
      onResult(code, e.data.format);
    }
  }

  window.addEventListener('message', onMsg);
  document.getElementById('scanner-overlay-close-btn').addEventListener('click', close);

  // Cerrar con Escape
  const onKey = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);

  // Fallback manual: si el iframe no envía ningún mensaje en 9s (sin cámara / offline sin caché)
  // mostramos un campo de texto directo sobre el iframe
  const fallbackTimer = setTimeout(() => {
    const iframe = document.getElementById('scanner-overlay-iframe');
    if (!iframe || !wrap.isConnected) return;
    const fb = document.createElement('div');
    fb.className = 'scanner-manual-fallback';
    fb.innerHTML = `
      <p class="scanner-fb-hint">Escáner no disponible — ingresa el código manualmente:</p>
      <div class="scanner-fb-row">
        <input type="text" id="scanner-fb-input" class="scanner-fb-input"
               placeholder="Número de serie…" autocomplete="off" />
        <button class="btn-primary scanner-fb-btn" id="scanner-fb-ok">OK</button>
      </div>`;
    wrap.appendChild(fb);
    const inp = document.getElementById('scanner-fb-input');
    inp?.focus();
    const submit = () => {
      const val = inp?.value?.trim();
      if (!val) return;
      fb.remove();
      clearTimeout(fallbackTimer);
      if (continuous) { scanCount++; onResult(val, 'manual'); }
      else { close(); onResult(val, 'manual'); }
    };
    document.getElementById('scanner-fb-ok')?.addEventListener('click', submit);
    inp?.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  }, 9000);

  // Cancelar fallback si el escáner responde normalmente
  const _origOnMsg = onMsg;
  window.removeEventListener('message', onMsg);
  window.addEventListener('message', function onMsgWithCancel(e) {
    if (!e.data || e.data.type !== 'ECOFIT_SCAN') return;
    clearTimeout(fallbackTimer);
    document.querySelector('.scanner-manual-fallback')?.remove();
    _origOnMsg(e);
  });

  return close;
}

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
  otro:             { label: 'Otro',                  icon: 'squares-four' },
  // Legado — proyectos anteriores a la fusión (no aparece en nuevos formularios)
  hibrido:          { label: 'Híbrido',               icon: 'battery-charging', legacy: true },
  respaldo:         { label: 'Respaldo',              icon: 'shield-check',     legacy: true },
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

// ── calcFaseEstado — lógica de desbloqueo por fase ────────────────────────────
// Retorna { doc, gar, aud } con 'disponible' | 'bloqueada' | 'completa'
// + porcentajes docPct, garPct, audPct para dashboard y detalle de proyecto.
export function calcFaseEstado(project) {
  const doc = project.documentacion || {};
  const gar = project.garantia      || {};
  const aud = project.auditoria     || {};
  const esPequeno = project.tipoSistema === 'sistema_pequeno';

  // ── Documentación ────────────────────────────────────────────────────────────
  const _fc = (sitio, sub) => {
    const n = doc.fases?.[sitio]?.[sub]?.length || 0;
    if (n > 0) return n;
    if (sitio === 'techo') {
      const m = { antes: 'antes', durante: 'durante', cierre: 'despues' };
      return doc.fases?.[m[sub]]?.length || 0;
    }
    return 0;
  };
  const fTecho   = ['antes','durante','cierre'].reduce((s,f) => s + _fc('techo',f), 0);
  const fCentros = ['antes','durante','cierre'].reduce((s,f) => s + _fc('centrosCarga',f), 0);
  const fZona    = ['antes','durante','cierre'].reduce((s,f) => s + _fc('zonaDelSistema',f), 0);

  // Sistema pequeño solo necesita levantamiento; no requiere juego completo de fotos
  const docItems = esPequeno
    ? [ !!(doc.levantamiento?.tipTecho) ]
    : [ !!(doc.levantamiento?.tipTecho), fTecho > 0, fCentros > 0, fZona > 0 ];
  const docItemsOk = docItems.filter(Boolean).length;
  const docCompleta = docItemsOk >= 1;
  const docPct      = Math.round(docItemsOk / docItems.length * 100);
  const docFirmada  = !!(project.fases?.firmas?.doc);

  // ── Garantía ─────────────────────────────────────────────────────────────────
  const garDesbloqueada = docCompleta;
  const totalPaneles = (gar.paneles?.strings||[]).reduce((s,st) => s + (st.paneles?.length||0), 0);

  // Sistema pequeño no tiene tablero AC / inversor de red
  const garItems = esPequeno
    ? [
        !!gar.fotoSistema,
        (gar.equipos?.length||0) > 0,
        totalPaneles > 0,
      ]
    : [
        !!gar.fotoSistema,
        !!(gar.fotosTecnicas?.tableroAC || gar.fotosTecnicas?.inversorEnergizado),
        (gar.equipos?.length||0) > 0,
        totalPaneles > 0,
      ];
  const garItemsOk  = garItems.filter(Boolean).length;
  const garCompleta = garItemsOk >= (esPequeno ? 2 : 2);
  const garPct      = Math.round(garItemsOk / garItems.length * 100);
  const garFirmada  = !!(project.fases?.firmas?.gar);

  // ── Auditoría ─────────────────────────────────────────────────────────────────
  // Sistema pequeño no tiene auditoría formal
  const audDesbloqueada = !esPequeno && garDesbloqueada && garItemsOk >= 2;
  const audItems = [
    (aud.checklist?.length||0) >= 11,
    !!aud.resultado,
  ];
  const audItemsOk  = audItems.filter(Boolean).length;
  const audCompleta = audItemsOk >= 2;
  const audPct      = esPequeno ? null : Math.round(audItemsOk / audItems.length * 100);

  return {
    doc: 'disponible',
    gar: garDesbloqueada ? (garCompleta ? 'completa' : 'disponible') : 'bloqueada',
    aud: audDesbloqueada ? (audCompleta ? 'completa' : 'disponible') : 'bloqueada',
    docFirmada, garFirmada,
    docPct, garPct, audPct,
    garRequisito: 'Completa el Levantamiento en Documentación primero.',
    audRequisito: 'Completa Garantía primero (foto del sistema + al menos un equipo o foto técnica).',
  };
}
