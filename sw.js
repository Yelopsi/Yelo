const CACHE_NAME = 'girassol-cache-v1';
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