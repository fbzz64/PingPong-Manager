// ==========================================
// SW.JS - Service Worker (PWA / Offline)
// ==========================================
// Cachea la aplicación completa para que funcione sin conexión.
// IMPORTANTE: al cambiar cualquier archivo del app, subir la versión
// de CACHE_NAME para que los clientes descarguen la actualización.

const CACHE_NAME = 'ttm-cache-v61';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/i18n.js',
  './js/main.js',
  './js/storage.js',
  './js/ui.js',
  './js/navigation.js',
  './js/logs.js',
  './js/sponsors.js',
  './js/players.js',
  './js/elo.js',
  './js/reglamento.js',
  './js/fixtures.js',
  './js/brackets.js',
  './js/stats.js',
  './js/charts.js',
  './js/ranking.js',
  './js/tournaments.js',
  './js/certificates.js',
  './js/planning.js',
  './js/scoreboard.js',
  './js/sounds.js',
  './js/tables.js',
  './js/tvboard.js',
  './js/changelog.js',
  './js/sync.js',
  './js/share.js',
  './js/qr.js',
  './lib/xlsx.full.min.js',
  './lib/jspdf.umd.min.js',
  './lib/jspdf.plugin.autotable.min.js',
  './lib/qrcode.min.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Instalación: precache del app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activación: limpiar cachés viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navegación: network-first, fallback a la copia cacheada (permite recibir actualizaciones)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Librerías externas (ej: xlsx de CDN): cache-first con fallback de red
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Recursos propios: cache-first con respaldo de red
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
