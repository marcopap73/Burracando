/* Service worker di Burracando: fa funzionare l'app anche senza internet.
   Strategia: risponde subito con la copia salvata e intanto scarica la versione nuova,
   così dopo ogni pubblicazione su GitHub l'app si aggiorna da sola alla riapertura successiva.
   Se cambi l'elenco dei file, aumenta il numero di VERSIONE. */
const VERSIONE = 'burracando-v2';
const FILE_APP = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(FILE_APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(chiavi => Promise.all(chiavi.filter(k => k !== VERSIONE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(VERSIONE).then(cache =>
      cache.match(e.request, { ignoreSearch: true }).then(salvata => {
        const dallaRete = fetch(e.request).then(risposta => {
          if (risposta && (risposta.ok || risposta.type === 'opaque')) cache.put(e.request, risposta.clone());
          return risposta;
        }).catch(() => salvata);
        return salvata || dallaRete;
      })
    )
  );
});
