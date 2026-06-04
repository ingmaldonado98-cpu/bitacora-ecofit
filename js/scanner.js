// scanner.js — ZXing (web) / ML Kit (Android) barcode scanner wrapper

import { icon } from './icons.js';
import { isNative, getPlugin, hapticImpact } from './platform.js';

let _activeReader = null;
let _torchOn = false;
let _videoTrack = null;

// ── Toggle linterna ────────────────────────────────────────────────────────────
function toggleTorch() {
  if (!_videoTrack) return;
  _torchOn = !_torchOn;
  _videoTrack.applyConstraints({ advanced: [{ torch: _torchOn }] }).catch(() => {});
  const btn = document.getElementById('scanner-torch');
  if (btn) { btn.classList.toggle('torch-on', _torchOn); btn.title = _torchOn ? 'Apagar linterna' : 'Linterna'; }
}

// ── Flash visual en scan exitoso ──────────────────────────────────────────────
function scanFlash(viewport) {
  const flash = document.createElement('div');
  flash.className = 'scanner-flash';
  viewport.appendChild(flash);
  setTimeout(() => flash.remove(), 300);
}

// ── Escáner nativo Android (ML Kit) ───────────────────────────────────────────
async function scanOnceNative(onResult, onError) {
  const BarcodeScanner = getPlugin('BarcodeScanner');
  if (!BarcodeScanner) { onError?.(new Error('Plugin no disponible')); return; }

  try {
    const perm = await BarcodeScanner.requestPermissions();
    if (perm.camera !== 'granted' && perm.camera !== 'limited') {
      onError?.(new Error('Permiso de cámara denegado'));
      return;
    }

    // UI superpuesta al visor de cámara
    const ui = document.createElement('div');
    ui.className = 'scanner-native-ui';
    ui.innerHTML = `
      <div class="scanner-native-frame"></div>
      <p class="scanner-native-hint">Apunta al código QR o de barras</p>
      <button class="scanner-native-cancel">Cancelar</button>
    `;
    document.body.appendChild(ui);
    document.body.classList.add('scanner-native-active');

    let listener;

    const cleanup = async () => {
      document.body.classList.remove('scanner-native-active');
      ui.remove();
      await listener?.remove();
      await BarcodeScanner.stopScan().catch(() => {});
    };

    ui.querySelector('.scanner-native-cancel').onclick = () => { cleanup(); };

    listener = await BarcodeScanner.addListener('barcodeScanned', async ev => {
      await cleanup();
      hapticImpact('MEDIUM');
      onResult(ev.barcode.rawValue);
    });

    await BarcodeScanner.startScan();
  } catch (err) {
    document.body.classList.remove('scanner-native-active');
    onError?.(err);
  }
}

// ── Escáner individual (una lectura y cierra) ──────────────────────────────────
export function scanOnce(onResult, onError) {
  if (isNative()) { scanOnceNative(onResult, onError); return; }
  if (_activeReader) { _activeReader.reset(); _activeReader = null; }
  _torchOn = false; _videoTrack = null;

  const overlay = document.createElement('div');
  overlay.className = 'scanner-overlay';
  overlay.innerHTML = `
    <div class="scanner-modal">
      <div class="scanner-header">
        <span>Escanear código</span>
        <div style="display:flex;gap:8px">
          <button id="scanner-torch" class="scanner-torch-btn" title="Linterna">🔦</button>
          <button id="close-scanner" class="scanner-close">✕</button>
        </div>
      </div>
      <div class="scanner-viewport" id="scanner-vp">
        <video id="scanner-video" autoplay playsinline muted></video>
        <div class="scanner-frame"></div>
      </div>
      <p class="scanner-hint">Apunta al QR o código de barras</p>
      <div class="scanner-fallback">
        <input type="text" id="scanner-manual" placeholder="Escribe el serial manualmente" />
        <button id="scanner-manual-ok" class="btn-outline btn-sm">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('close-scanner').onclick = () => cleanup();
  document.getElementById('scanner-torch').onclick  = () => toggleTorch();
  document.getElementById('scanner-manual-ok').onclick = () => {
    const val = document.getElementById('scanner-manual').value.trim();
    if (val) { cleanup(); onResult(val); }
  };
  document.getElementById('scanner-manual').onkeydown = e => {
    if (e.key === 'Enter') { const val = e.target.value.trim(); if (val) { cleanup(); onResult(val); } }
  };

  function cleanup() {
    _torchOn = false; _videoTrack = null;
    if (_activeReader) { try { _activeReader.reset(); } catch(e){} _activeReader = null; }
    overlay.remove();
  }

  if (!window.ZXing) { console.warn('ZXing no disponible — modo manual'); return; }

  try {
    const reader = new ZXing.BrowserMultiFormatReader();
    _activeReader = reader;

    reader.listVideoInputDevices().then(devices => {
      const back = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];
      reader.decodeFromVideoDevice(back?.deviceId, 'scanner-video', (result, err) => {
        if (result) {
          hapticImpact('MEDIUM');
          scanFlash(document.getElementById('scanner-vp'));
          cleanup();
          onResult(result.getText());
        }
        if (err && !(err instanceof ZXing.NotFoundException) && !(err?.name === 'NotFoundException')) {
          if (onError) onError(err);
        }
      });
      // Capturar video track para linterna
      const video = document.getElementById('scanner-video');
      if (video) {
        video.addEventListener('loadedmetadata', () => {
          const stream = video.srcObject;
          if (stream) _videoTrack = stream.getVideoTracks()[0] || null;
          // Ocultar botón linterna si no soporta torch
          if (_videoTrack) {
            const caps = _videoTrack.getCapabilities?.() || {};
            if (!caps.torch) {
              const btn = document.getElementById('scanner-torch');
              if (btn) btn.style.display = 'none';
            }
          }
        }, { once: true });
      }
    }).catch(err => { console.warn('No se pudo acceder a la cámara:', err); if (onError) onError(err); });
  } catch(err) { console.warn('Error iniciando ZXing:', err); }
}

// ── Modo escaneo continuo de paneles ───────────────────────────────────────────
// onResult(serial) se llama por cada lectura. La cámara permanece activa.
// La deduplicación evita leer el mismo serial dos veces seguidas.
export function startContinuousScan(containerId, onResult, onError) {
  if (_activeReader) { _activeReader.reset(); _activeReader = null; }

  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="scanner-continuous" id="scanner-cont-wrap">
      <video id="scanner-cont-video" autoplay playsinline muted class="scanner-cont-video"></video>
      <div class="scanner-frame-cont"></div>
      <p class="scanner-hint-sm">Apunta al QR del panel</p>
    </div>
  `;

  if (!window.ZXing) {
    container.innerHTML = `<p class="hint">ZXing no disponible. Ingresa el serial manualmente.</p>`;
    return;
  }

  let lastCode = '';
  let lastTime = 0;

  try {
    const reader = new ZXing.BrowserMultiFormatReader();
    _activeReader = reader;

    reader.listVideoInputDevices().then(devices => {
      const back = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];
      reader.decodeFromVideoDevice(back?.deviceId, 'scanner-cont-video', (result, err) => {
        if (result) {
          const code = result.getText();
          const now = Date.now();
          // Deduplicar: mismo código en < 2s se ignora
          if (code === lastCode && now - lastTime < 2000) return;
          lastCode = code;
          lastTime = now;
          hapticImpact('LIGHT');
          scanFlash(document.getElementById('scanner-cont-wrap') || container);
          onResult(code);
        }
        if (err && !(err instanceof ZXing.NotFoundException) && !(err?.name === 'NotFoundException')) {
          if (onError) onError(err);
        }
      });
    });
  } catch(err) {
    console.warn('Error en escáner continuo:', err);
    if (onError) onError(err);
  }
}

export function stopScanner() {
  if (_activeReader) {
    try { _activeReader.reset(); } catch(e){}
    _activeReader = null;
  }
}

// Expuesto para que app.js pueda limpiar al navegar
window._stopScannerGlobal = stopScanner;
