// sw.js — Service Worker Bitácora Ecofit V6
// ⚠ Cambiar BUILD_DATE y CACHE_NAME en cada deploy para invalidar caché
const BUILD_DATE  = '2026-07-04';
const CACHE_NAME  = 'ecofit-v6-v187';
const SW_VERSION  = '6.79.16';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/firebase.js',
  './js/icons.js',
  './js/auth.js',
  './js/auditoria.js',
  './js/aud-data.js',
  './js/aud-state.js',
  './js/aud-render.js',
  './js/aud-actions.js',
  './js/calculadora.js',
  './js/calc-state.js',
  './js/calc-render.js',
  './js/calc-render-bom.js',
  './js/calc-render-diagrama.js',
  './js/calc-actions.js',
  './js/dashboard.js',
  './js/db.js',
  './js/local-store.js',
  './js/sync-queue.js',
  './js/documentacion.js',
  './js/lev-form.js',
  './js/doc-sitio.js',
  './js/lev-consumo.js',
  './js/lev-areas.js',
  './js/lev-guardar.js',
  './js/lev-campos.js',
  './js/lev-notas.js',
  './js/lev-tmin.js',
  './js/lev-gps.js',
  './js/doc-exec.js',
  './js/garantia.js',
  './js/gar-voc.js',
  './js/gar-equipos.js',
  './js/gar-estructura.js',
  './js/gar-paneles.js',
  './js/inventario.js',
  './js/inv-data.js',
  './js/inv-state.js',
  './js/inv-captura.js',
  './js/inv-admin.js',
  './js/inv-reports.js',
  './js/map.js',
  './js/photo-queue.js',
  './js/platform.js',
  './js/pdf.js',
  './js/pdf-helpers.js',
  './js/word-helpers.js',
  './js/pdf-cliente.js',
  './js/pdf-tecnico.js',
  './js/word-tecnico.js',
  './js/pdf-levantamiento.js',
  './js/project.js',
  './js/proj-firmas.js',
  './js/proj-form.js',
  './js/proj-obs.js',
  './js/qr.js',
  './js/cliente-publico.js',
  './js/scanner.js',
  './js/settings.js',
  './js/settings-users.js',
  './js/settings-backup.js',
  './js/settings-paneles.js',
  './js/recordatorios.js',
  './js/onedrive.js',
  './js/utils.js',
  './js/util-fmt.js',
  './js/util-dialogs.js',
  './js/util-foto.js',
  './js/util-scanner.js',
  './js/util-domain.js',
  './js/util-fases.js',
  './modules/calculadora/index.js',
  './modules/checklist/index.js',
  './modules/dimensionamiento/index.js',
  './js/checklist.js',
  './js/cl-render.js',
  './js/cl-actions.js',
  './js/concluidos.js',
  './js/dimensionamiento.js',
  './js/clima.js',
  './js/trayecto.js',
  './js/trayectorias.js',
  './ecofit-scanner.html',
  './js/vendor/firebase-app.js',
  './js/vendor/firebase-auth.js',
  './js/vendor/firebase-firestore.js',
  './js/vendor/firebase-storage.js',
  './js/vendor/zxing.min.js',
  './js/vendor/qrcode.min.js',
  './js/vendor/jspdf.umd.min.js',
  './js/vendor/docx.mjs',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/logo.png',
  './icons/k2-systems.png',
  './icons/aluminext.png',
];

// ── Install: pre-cache app shell ───────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Graceful: skip individual failures so SW still installs
      Promise.allSettled(APP_SHELL.map(url =>
        cache.add(url).catch(() => console.warn('[SW] Could not cache:', url))
      ))
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: purge old caches ─────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch strategy ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Navegación (recarga de página, links) → siempre servir index.html desde caché.
  // Esto garantiza que un refresh accidental offline no muestre pantalla en blanco.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then(cached =>
        cached || fetch(e.request).catch(() =>
          new Response('<h2 style="font-family:sans-serif;padding:24px">Sin conexión — abre la app cuando tengas internet al menos una vez.</h2>', {
            status: 200, headers: { 'Content-Type': 'text/html;charset=utf-8' },
          })
        )
      )
    );
    return;
  }

  // Firebase, CDNs y APIs externas → siempre Network (no cachear)
  if (
    url.origin !== self.location.origin ||
    url.hostname.includes('firebaseapp.com')     ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('gstatic.com')         ||
    url.hostname.includes('googleapis.com')      ||
    url.hostname.includes('unpkg.com')           ||
    url.hostname.includes('cdnjs.cloudflare.com')
  ) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // App shell → Cache first, fall back to network
  e.respondWith(cacheFirst(e.request));
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const resp = await fetch(req);
    if (resp.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, resp.clone());
    }
    return resp;
  } catch {
    // Fallback de último recurso para recursos del app shell no cacheados
    const root = await caches.match('./index.html');
    return root || new Response('Offline', { status: 503 });
  }
}

async function networkFirst(req) {
  try {
    const resp = await fetch(req);
    if (resp.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, resp.clone());
    }
    return resp;
  } catch {
    const cached = await caches.match(req);
    return cached || new Response('Offline', { status: 503 });
  }
}

// ── Background sync ────────────────────────────────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'sync-drive') {
    e.waitUntil(syncDrive());
  }
});

async function syncDrive() {
  // Placeholder: implementar cuando se active integración Drive
  console.log('[SW] Background sync: sync-drive triggered');
}

// ── Message handler ────────────────────────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SW_VERSION') {
    e.source.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
  }
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
