// Cache dell'interfaccia: i dati arrivano sempre dal foglio (rete), l'app si apre anche offline.
// Ad ogni aggiornamento cambia il numero qui sotto, altrimenti il telefono tiene la versione vecchia.
const CACHE = 'fanta-v1.4.0';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'xlsx.core.min.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // script Google, Wikipedia e font: sempre rete
  e.respondWith(fetch(e.request).then(r => {
    // salvo in cache solo i file dell'app (niente indirizzi con parametri, che farebbero crescere la cache all'infinito)
    if (r.ok && !u.search) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
