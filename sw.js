const C = 'serien-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname.startsWith('api.')) return;
  if (u.hostname === 'static.tvmaze.com') { // Titelbilder: einmal laden, dann aus dem Speicher
    e.respondWith(caches.open(C).then(c => c.match(e.request).then(h => h || fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; }))));
    return;
  }
  if (u.origin === location.origin) // App selbst: frisch vom Netz, ohne Netz aus dem Speicher
    e.respondWith(fetch(e.request).then(r => { const k = r.clone(); caches.open(C).then(c => c.put(e.request, k)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
self.addEventListener('push', e => {
  let d = { title: 'Annikas Serien', body: 'Es gibt Neuigkeiten.' };
  try { d = e.data.json(); } catch (x) {}
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' }));
});
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: 'window' }).then(l => l[0] ? l[0].focus() : self.clients.openWindow('./'))); });
