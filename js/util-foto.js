// util-foto.js — Captura, compresión, miniaturas y lightbox de fotos
// Extraído de utils.js.

import { esc, uuid } from './util-fmt.js';
import { toast } from './util-dialogs.js';

// ── Incrustado de fotos en documentos (Word/PDF) ──────────────────────────────
// Resuelve cualquier representación de foto (string url/data-uri/base64, objeto
// {url}, o {pending:true, pendingId} todavía no subida) a un data-URI listo
// para incrustar — así el documento queda autocontenido y no depende de que la
// URL remota siga viva cuando alguien lo abra después.
async function _fetchAsDataURI(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}
export async function fotoToDataURI(foto) {
  if (!foto) return null;
  if (typeof foto === 'string') {
    if (foto.startsWith('data:')) return foto;
    if (foto.startsWith('http'))  return _fetchAsDataURI(foto);
    return `data:image/jpeg;base64,${foto}`;
  }
  if (foto.pending && foto.pendingId && window._pendingPhotoMap?.[foto.pendingId]) {
    return window._pendingPhotoMap[foto.pendingId]; // ya es base64 local, no subida aún
  }
  if (foto.url)  return _fetchAsDataURI(foto.url);
  if (foto.data) return foto.data.startsWith('data:') ? foto.data : `data:image/jpeg;base64,${foto.data}`;
  return null;
}

// Resuelve cualquier representación de foto a { data: Uint8Array, width, height }
// en píxeles, escalado para que el lado mayor mida maxDimPx — listo para
// `ImageRun` de la librería docx (que necesita bytes crudos + transformación en
// px, no un data-URI). Reutiliza fotoToDataURI para no duplicar la lógica de
// resolución de los 5 formatos de entrada (url, data:, base64, {url}, {pending}).
export async function fotoToImageBuffer(foto, maxDimPx = 350) {
  const dataUri = await fotoToDataURI(foto);
  if (!dataUri) return null;
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload  = () => resolve(i);
      i.onerror = reject;
      i.src = dataUri;
    });
    let { naturalWidth: width, naturalHeight: height } = img;
    if (width > maxDimPx || height > maxDimPx) {
      if (width > height) { height = Math.round(height * maxDimPx / width); width = maxDimPx; }
      else                { width = Math.round(width * maxDimPx / height); height = maxDimPx; }
    }
    const res  = await fetch(dataUri);
    const data = new Uint8Array(await res.arrayBuffer());
    return { data, width, height };
  } catch { return null; }
}

// ── Compresión de imagen ───────────────────────────────────────────────────────
export function compressImage(file, maxDim = 1000, quality = 0.68) {
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

// Captura foto: muestra selector Cámara / Galería y abre el input correspondiente.
// Opciones: multiple, projectId, fase, campo → renombran el archivo automáticamente.
//           preview → muestra confirmación antes de llamar al callback (solo single).
export function capturePhoto(callback, opts = {}) {
  _photoSourceSheet(fuente => _launchPhotoInput(fuente, callback, opts));
}

// Selector de fuente (bottom sheet): Tomar foto o Subir de galería
function _photoSourceSheet(onPick) {
  const ov = document.createElement('div');
  ov.className = 'photo-src-ov';
  ov.innerHTML = `
    <div class="photo-src-sheet" role="dialog" aria-label="Origen de la foto">
      <button type="button" class="photo-src-btn" data-src="camera">
        <span class="photo-src-ico">📷</span>
        <span>Tomar foto</span>
      </button>
      <button type="button" class="photo-src-btn" data-src="galeria">
        <span class="photo-src-ico">🖼️</span>
        <span>Subir de galería</span>
      </button>
      <button type="button" class="photo-src-cancel">Cancelar</button>
    </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('psrc-visible'));
  const close = () => { ov.classList.remove('psrc-visible'); setTimeout(() => ov.remove(), 200); };
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  ov.querySelector('.photo-src-cancel').onclick = close;
  ov.querySelectorAll('.photo-src-btn').forEach(btn => {
    btn.onclick = () => { close(); onPick(btn.dataset.src); };
  });
}

function _launchPhotoInput(fuente, callback, { multiple = false, projectId, fase, campo, preview = false } = {}) {
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = 'image/*';
  if (fuente === 'camera') input.capture = 'environment'; // cámara trasera directa en Android
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
      const fileMeta   = { fuente, nombres: renamedFiles.map(f => f.name) };

      if (preview && !multiple) {
        _showPhotoPreview(
          compressed[0],
          () => callback(compressed[0], renamedFiles, fileMeta),
          () => _launchPhotoInput(fuente, callback, { multiple, projectId, fase, campo, preview })
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
// Deriva la URL del thumb desde la URL completa: archivo.jpg → archivo_t.jpg
// Solo aplica a URLs de Firebase Storage (http); data URLs y fotos pendientes
// no tienen thumb y muestran la imagen completa directamente.
function _thumbUrl(url) {
  if (!url || !url.startsWith('http')) return null;
  return url.replace(/(\.\w{2,5})(\?|$)/, '_t$1$2');
}

// src: string URL, data URL, u objeto foto {url?, data?, pending?, pendingId?}
export function fotoMini(src, alt = '', onClick, isPending = false) {
  const resolvedSrc = getPendingSrc(src);
  if (!resolvedSrc && !isPending) return '';
  const id = 'img_' + uuid().replace(/-/g, '').slice(0, 10);
  const pendingAttr = (isPending || (src && typeof src === 'object' && src.pending))
    ? `data-pending="true"` : '';
  const pendingBadge = pendingAttr
    ? `<span class="foto-pending-badge" title="Guardado local — pendiente de subir">Local</span>` : '';

  const thumbSrc = _thumbUrl(resolvedSrc) || resolvedSrc;

  const imgHtml = resolvedSrc
    ? `<img id="${id}" src="${thumbSrc}" data-fullsrc="${resolvedSrc}" alt="${esc(alt)}" class="foto-mini"
         loading="lazy" decoding="async"
         ${pendingAttr}
         onerror="if(this.src!==this.dataset.fullsrc)this.src=this.dataset.fullsrc"
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
  const srcs  = siblings.map(i => i.dataset.fullsrc || i.src).filter(Boolean);
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
