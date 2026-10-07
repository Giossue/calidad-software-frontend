// Service Worker para permitir la instalación de la aplicación como PWA en el escritorio y dispositivos móviles
const CACHE_NAME = 'sistema-ueb-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Las solicitudes a la API o autenticación siempre van directo a la red
  if (event.request.url.includes('/api/')) {
    return;
  }
  // Estrategia Network-first básica para recursos estáticos
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
