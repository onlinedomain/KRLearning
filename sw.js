// Offline support. App files + texts are precached; Google Fonts are cached on
// first use. The recorded audio is streamed from the web (not cached): offline,
// the app falls back to the device's speech synthesis.
const VERSION = 'dadok-plus-v1';
const CORE = [
  './', 'index.html', 'manifest.json', 'css/app.css',
  'js/app.js', 'js/util.js', 'js/store.js', 'js/data.js', 'js/text.js', 'js/srs.js', 'js/audio.js',
  'js/views/library.js', 'js/views/reader.js', 'js/views/words.js', 'js/views/cards.js',
  'js/views/stats.js', 'js/views/settings.js', 'js/views/backup.js',
  'data/texts.json', 'data/meta.json',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png', 'icons/maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== 'fonts').map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Fonts: cache-first.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open('fonts').then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }).catch(() => new Response('', { status: 504 })));
    return;
  }
  if (url.origin !== location.origin) return; // audio etc.: straight to network
  // Same origin: network first (so updates show up at once), cache if offline
  // or if the network takes more than 3 s.
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; });
    const timeout = new Promise((r) => setTimeout(r, 3000));
    try {
      const res = await Promise.race([net, timeout]);
      if (res) return res;
    } catch {}
    const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' && await c.match('index.html'));
    return hit || net.catch(() => new Response('', { status: 504 }));
  }));
});
