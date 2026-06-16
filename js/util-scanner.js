// util-scanner.js — Overlay de escáner QR/barras (web e iframe nativo Capacitor)
// Extraído de utils.js.

import { esc } from './util-fmt.js';
import { toast } from './util-dialogs.js';

// ── Overlay iframe del escáner Ecofit ─────────────────────────────────────────
// options:
//   continuous  — false (cierra tras el 1er scan) | true (queda abierto para multi-scan)
//   title       — texto en la cabecera del overlay
//   onClose     — callback al cerrar sin resultado
//
// Retorna la función closeScanner() por si el llamador quiere cerrar programáticamente.
export function openScannerOverlay(onResult, { continuous = false, title = 'Escanear código', onClose = null } = {}) {
  // ── Ruta nativa Capacitor (Android) ────────────────────────────────────────
  // El WebView de Capacitor no muestra el diálogo de permisos desde un <iframe>.
  // Usamos el plugin ML Kit (BarcodeScanner) que ya maneja permisos nativamente.
  if (window.Capacitor?.isNativePlatform?.()) {
    _openNativeScannerOverlay(onResult, { continuous, title, onClose });
    return () => {};
  }

  // ── Ruta web (GitHub Pages / Chrome) ────────────────────────────────────────
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
    <div id="scanner-perm-msg" class="scanner-perm-msg">
      <svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor" style="opacity:.5"><path d="M229.66,109.66l-48,48a8,8,0,0,1-11.32-11.32L204.69,112H128a88.11,88.11,0,0,0-88,88,8,8,0,0,1-16,0A104.12,104.12,0,0,1,128,96h76.69L170.34,61.66a8,8,0,0,1,11.32-11.32l48,48A8,8,0,0,1,229.66,109.66Z"/></svg>
      Solicitando acceso a la cámara…
    </div>
    <iframe
      id="scanner-overlay-iframe"
      class="scanner-overlay-iframe"
      allow="camera; microphone"
      style="display:none">
    </iframe>
    <div class="scanner-manual-bar">
      <input type="text" id="scanner-manual-input" class="scanner-fb-input"
             placeholder="…o escribe el serial manualmente" autocomplete="off"
             aria-label="Serial manual" />
      <button class="btn-primary scanner-fb-btn" id="scanner-manual-ok">OK</button>
    </div>`;

  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('scanner-overlay-visible'));

  let scanCount = 0;

  function close() {
    wrap.classList.remove('scanner-overlay-visible');
    setTimeout(() => wrap.remove(), 250);
    window.removeEventListener('message', onMsg);
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  }

  function handleCode(code, format) {
    if (continuous) {
      scanCount++;
      const counter = document.getElementById('scanner-count-num');
      if (counter) counter.textContent = scanCount;
      onResult(code, format);
    } else {
      close();
      onResult(code, format);
    }
  }

  function onMsg(e) {
    if (e.origin !== location.origin) return;
    if (!e.data || e.data.type !== 'ECOFIT_SCAN') return;
    const code = e.data.code?.trim();
    if (!code) return;
    handleCode(code, e.data.format);
  }

  window.addEventListener('message', onMsg);
  document.getElementById('scanner-overlay-close-btn').addEventListener('click', close);
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  const manualInp = document.getElementById('scanner-manual-input');
  const manualSubmit = () => {
    const val = manualInp?.value?.trim();
    if (!val) return;
    if (manualInp) manualInp.value = '';
    handleCode(val, 'manual');
  };
  document.getElementById('scanner-manual-ok')?.addEventListener('click', manualSubmit);
  manualInp?.addEventListener('keydown', e => { if (e.key === 'Enter') manualSubmit(); });

  // Pedir permiso desde el contexto principal (no el iframe) para que aparezca
  // el diálogo en Android/Chrome. Solo cargamos el iframe DESPUÉS de obtener permiso.
  (async () => {
    const permMsg = document.getElementById('scanner-perm-msg');
    const iframe  = document.getElementById('scanner-overlay-iframe');
    if (!document.getElementById('scanner-overlay-wrap')) return;

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        stream.getTracks().forEach(t => t.stop()); // liberar inmediatamente
      } catch (err) {
        if (!document.getElementById('scanner-overlay-wrap')) return;
        const msg = err.name === 'NotAllowedError'
          ? '⚠ Permiso denegado — ve a Ajustes del navegador y habilita la cámara'
          : '⚠ No se pudo acceder a la cámara';
        if (permMsg) { permMsg.textContent = msg; permMsg.style.color = 'var(--red, #f87171)'; }
        return; // no cargar iframe si no hay permiso
      }
    }

    // Permiso concedido: cargar iframe
    if (permMsg) permMsg.remove();
    if (iframe) {
      iframe.src = `./ecofit-scanner.html?autostart=1${continuous ? '&continuous=1' : ''}`;
      iframe.style.display = '';
    }
  })();

  return close;
}

// ── Escáner nativo Capacitor Android ─────────────────────────────────────────
async function _openNativeScannerOverlay(onResult, { continuous, title, onClose }) {
  const BarcodeScanner = window.Capacitor?.Plugins?.BarcodeScanner;

  if (!BarcodeScanner) {
    // Plugin no disponible — fallback a iframe web
    console.warn('[Scanner] BarcodeScanner plugin no disponible, usando iframe');
    openScannerOverlay(onResult, { continuous, title, onClose });
    return;
  }

  // Solicitar permiso de cámara con el plugin nativo
  let perm;
  try { perm = await BarcodeScanner.requestPermissions(); } catch { perm = {}; }
  if (perm.camera !== 'granted' && perm.camera !== 'limited') {
    toast('Permiso de cámara denegado — habilítalo en Ajustes del dispositivo', 'error', 5000);
    onClose?.();
    return;
  }

  // UI overlay sobre la cámara nativa
  const ui = document.createElement('div');
  ui.className = 'scanner-native-ui';
  ui.innerHTML = `
    <div class="scanner-native-frame"></div>
    <p class="scanner-native-hint">Apunta al código QR o de barras</p>
    ${continuous ? `<div class="scanner-overlay-counter" style="visibility:visible;background:rgba(0,0,0,.6);border-radius:20px;padding:4px 14px;color:#fff;font-size:.82rem;margin-bottom:8px">
      <span id="scanner-count-num">0</span> escaneados en esta sesión</div>` : ''}
    <div class="scanner-manual-bar" style="visibility:visible;background:rgba(0,0,0,.7);border-radius:12px;padding:10px;margin:0 16px">
      <input type="text" id="sn-manual-input" class="scanner-fb-input"
             placeholder="…o escribe el serial" autocomplete="off" style="background:rgba(255,255,255,.15);color:#fff;border-color:rgba(255,255,255,.3)" />
      <button class="btn-primary scanner-fb-btn" id="sn-manual-ok">OK</button>
    </div>
    <button class="scanner-native-cancel" id="sn-cancel-btn">Cancelar</button>`;

  document.body.appendChild(ui);
  document.body.classList.add('scanner-native-active');

  let listener;
  let scanCount = 0;

  const cleanup = async () => {
    document.body.classList.remove('scanner-native-active');
    ui.remove();
    try { await listener?.remove(); } catch {}
    try { await BarcodeScanner.stopScan(); } catch {}
    onClose?.();
  };

  document.getElementById('sn-cancel-btn').onclick = cleanup;

  const manualInp = document.getElementById('sn-manual-input');
  const nativeManualSubmit = () => {
    const val = manualInp?.value?.trim();
    if (!val) return;
    if (manualInp) manualInp.value = '';
    if (!continuous) { cleanup(); }
    else { scanCount++; const c = document.getElementById('scanner-count-num'); if (c) c.textContent = scanCount; }
    onResult(val, 'manual');
  };
  document.getElementById('sn-manual-ok').onclick = nativeManualSubmit;
  manualInp?.addEventListener('keydown', e => { if (e.key === 'Enter') nativeManualSubmit(); });

  listener = await BarcodeScanner.addListener('barcodeScanned', async ev => {
    const code = ev.barcode?.rawValue;
    if (!code) return;
    if (!continuous) {
      await cleanup();
    } else {
      scanCount++;
      const c = document.getElementById('scanner-count-num');
      if (c) c.textContent = scanCount;
    }
    onResult(code, ev.barcode?.format || 'UNKNOWN');
  });

  await BarcodeScanner.startScan();
}
