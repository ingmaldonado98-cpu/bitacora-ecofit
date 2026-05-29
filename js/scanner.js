// scanner.js — ZXing barcode / QR scanner wrapper

// ZXing se carga desde CDN como variable global window.ZXing

let _activeReader = null;

// ── Escáner individual (una lectura y cierra) ──────────────────────────────────
export function scanOnce(onResult, onError) {
  if (_activeReader) { _activeReader.reset(); _activeReader = null; }

  const overlay = document.createElement('div');
  overlay.className = 'scanner-overlay';
  overlay.innerHTML = `
    <div class="scanner-modal">
      <div class="scanner-header">
        <span>Escanear código</span>
        <button id="close-scanner" class="scanner-close">✕</button>
      </div>
      <div class="scanner-viewport">
        <video id="scanner-video" autoplay playsinline muted></video>
        <div class="scanner-frame"></div>
      </div>
      <p class="scanner-hint">Apunta al código de barras del equipo</p>
      <div class="scanner-fallback">
        <input type="text" id="scanner-manual" placeholder="Escribe el serial manualmente" />
        <button id="scanner-manual-ok" class="btn-outline btn-sm">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('close-scanner').onclick = () => { cleanup(); };
  document.getElementById('scanner-manual-ok').onclick = () => {
    const val = document.getElementById('scanner-manual').value.trim();
    if (val) { cleanup(); onResult(val); }
  };
  document.getElementById('scanner-manual').onkeydown = (e) => {
    if (e.key === 'Enter') {
      const val = e.target.value.trim();
      if (val) { cleanup(); onResult(val); }
    }
  };

  function cleanup() {
    if (_activeReader) { try { _activeReader.reset(); } catch(e){} _activeReader = null; }
    overlay.remove();
  }

  if (!window.ZXing) {
    console.warn('ZXing no disponible — usando modo manual');
    return;
  }

  try {
    const reader = new ZXing.BrowserMultiFormatReader();
    _activeReader = reader;

    reader.listVideoInputDevices().then(devices => {
      const back = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];
      reader.decodeFromVideoDevice(back?.deviceId, 'scanner-video', (result, err) => {
        if (result) {
          if (navigator.vibrate) navigator.vibrate(80);
          cleanup();
          onResult(result.getText());
        }
        if (err && !(err instanceof ZXing.NotFoundException) && !(err?.name === 'NotFoundException')) {
          if (onError) onError(err);
        }
      });
    }).catch(err => {
      console.warn('No se pudo acceder a la cámara:', err);
      if (onError) onError(err);
    });
  } catch(err) {
    console.warn('Error iniciando ZXing:', err);
  }
}

// ── Modo escaneo continuo de paneles ───────────────────────────────────────────
// onResult(serial) se llama por cada lectura. La cámara permanece activa.
// La deduplicación evita leer el mismo serial dos veces seguidas.
export function startContinuousScan(containerId, onResult, onError) {
  if (_activeReader) { _activeReader.reset(); _activeReader = null; }

  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="scanner-continuous">
      <video id="scanner-cont-video" autoplay playsinline muted class="scanner-cont-video"></video>
      <div class="scanner-frame-cont"></div>
      <p class="scanner-hint-sm">Apunta al código del panel</p>
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
          if (navigator.vibrate) navigator.vibrate(60);
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
