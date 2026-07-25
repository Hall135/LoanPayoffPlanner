const CACHE_NAME = 'loan-payoff-planner-cache-v2';

const FILES_TO_CACHE = [
  './index.html',
  './graphs.html',
  './manifest.json',
  './assets/payments_180dp_1F1F1F.png',
  './libs/chartjs/chart.js',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './js/validation.js',
  './js/loanManager.js',
  './js/lumpSumManager.js',
  './js/settingsManager.js',
  './js/simulationModels.js',
  './js/strategyEngine.js',
  './js/simulationEngine.js',
  './js/exportManager.js',
  './js/chartManager.js'
];

// Install service worker and cache all required app files.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );

  self.skipWaiting();
});

// Activate the new worker and remove obsolete app caches.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// Cache-first response strategy: use the local cache when available,
// otherwise request the file from the network.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});