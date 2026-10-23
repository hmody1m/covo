// Covo service worker: offline app shell + Web Push (lock-screen notifications).
const CACHE = 'covo-shell-v2';
// Paths are relative to the service worker, so the app also works from a sub-path (GitHub Pages).
const BASE = new URL('./', self.location).pathname;
const SHELL = ['', 'css/tokens.css', 'css/app.css', 'vendor/preact-htm.js', 'icons/icon.svg', 'manifest.webmanifest', 'fonts/fonts.css'].map((p) => BASE + p);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network-first for everything; fall back to cache when offline. API and websockets are never cached.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || /\/(api|a|uploads|legal)\//.test(url.pathname)) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && (SHELL.includes(url.pathname) || /\/(js|css|fonts|icons|vendor)\//.test(url.pathname))) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match(BASE)))
  );
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: 'Covo', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || d.app || 'Covo', {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: true,
    icon: BASE + 'icons/icon-192.png',
    badge: BASE + 'icons/icon-192.png',
    data: { url: d.url || BASE },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || BASE;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  })());
});
