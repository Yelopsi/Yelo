// Service Worker com estratégia Network-First e Web Push Notifications
self.addEventListener('install', event => {
  self.skipWaiting();
});

// Evento de Ativação: Limpa caches legados de versões anteriores imediatamente
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

// Evento de Fetch: Network-First (busca na rede primeiro; só recorre ao cache se estiver sem internet)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// --- EVENTOS DE WEB PUSH NOTIFICATION ---
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data.json(); } 
  catch (e) { data = { title: 'Yelo', body: event.data.text() }; }

  const options = {
      body: data.body,
      icon: '/assets/images/favicon.png',
      badge: '/assets/images/favicon.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/admin/admin.html' }
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.notification.data && event.notification.data.url) {
      event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});