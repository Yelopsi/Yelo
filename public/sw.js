const CACHE_NAME = 'Yelo-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/header.html',
  '/footer.html',
  '/login.html',
  '/sobre.html',
  '/faq.html',
  '/profissionais.html',
  '/contato.html',
  '/assets/logos/logo_duplo_branco.png',
  '/assets/images/favicon.png?v=2'
];

// Evento de Instalação: Salva os arquivos principais em cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Evento de Fetch: Responde com o cache se disponível, senão busca na rede
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
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