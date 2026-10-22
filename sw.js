/* Service worker di Burracando: fa funzionare l'app anche senza internet.
   Strategia: i file dell'app arrivano sempre dalla rete (così si vede subito l'ultima versione
   pubblicata) e la copia salvata si usa solo senza connessione; librerie e font, che hanno
   versioni fisse, si prendono dalla copia salvata.
   Se cambi l'elenco dei file, aumenta il numero di VERSIONE. */
const VERSIONE = 'burracando-v8';
const FILE_APP = [
  './',
  './index.html',
  './manifest.webmanifest',
  './regolamento-italiano.md',
  './regolamento-internazionale.md',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];
// Si mettono in cache solo i file dell'app, le librerie e i font: account (Supabase) e chat passano sempre dalla rete
const ORIGINI_IN_CACHE = [self.location.origin, 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

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
  const url = new URL(e.request.url);
  if (!ORIGINI_IN_CACHE.includes(url.origin)) return;
  const salva = risposta => {
    if (risposta && (risposta.ok || risposta.type === 'opaque')) {
      const copia = risposta.clone();
      caches.open(VERSIONE).then(cache => cache.put(e.request, copia));
    }
    return risposta;
  };
  if (url.origin === self.location.origin) {
    // "no-cache" chiede sempre al server se il file è cambiato, anche se il browser ne ha una copia recente
    e.respondWith(
      fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' })
        .then(salva)
        .catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
  } else {
    e.respondWith(caches.match(e.request).then(salvata => salvata || fetch(e.request).then(salva)));
  }
});
