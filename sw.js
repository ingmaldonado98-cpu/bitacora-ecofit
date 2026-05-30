// sw.js — Service Worker Bitácora Ecofit V6
const CACHE_NAME  = 'ecofit-v6-v20';
const SW_VERSION  = '6.19.0';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/icons.js',
  './js/auth.js',
  './js/auditoria.js',
  './js/calculadora.js',
  './js/dashboard.js',
  './js/db.js',
  './js/documentacion.js',
  './js/garantia.js',
  './js/inventario.js',
  './js/pdf.js',
  './js/project.js',
  './js/qr.js',
  './js/scanner.js',
  './js/settings.js',
  './js/utils.js',
  './modules/calculadora/index.js',
  './modules/checklist/index.js',
  './js/checklist.js',
  './modules/inventario/index.js',
  './icons/icon.svg',
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

  // External CDNs and Google APIs → Network first, fall back to cache
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/googleapis') ||
    url.pathname.includes('fonts.googleapis') ||
    url.pathname.includes('fonts.gstatic') ||
    url.pathname.includes('unpkg.com') ||
    url.pathname.includes('cdnjs.cloudflare')
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
    return new Response('Offline — recurso no disponible', { status: 503 });
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
