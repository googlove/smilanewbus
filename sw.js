// SmilaBusTime — Service Worker
// Стратегія: cache-first для статики, network-first для даних розкладу.

const CACHE_NAME = 'smilabus-v1';

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles/bootstrap.min.css',
  './styles/style.css',
  './scripts/jquery.min.js',
  './scripts/bootstrap.min.js',
  './scripts/script.js',
  './img/favicon.ico',
  './img/logo_gs_full.png',
  './img/com.googlove.smilabus_0.0_3_icon.png',
  './img/com.googlove.smilabus_0.0_2_icon.png'
];

// Установка: попередньо кешуємо оболонку додатку
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch((err) => {
        // Якщо щось не закешувалось — не блокуємо встановлення
        console.warn('[SW] Не вдалося закешувати частину shell:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

// Активація: чистимо старі кеші
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Тільки GET-запити, тільки http(s) схеми
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return;

  // Дані розкладу: спочатку мережа, fallback — кеш (щоб користувач отримував
  // оновлений розклад, коли є інтернет)
  if (url.pathname.includes('/database/')) {
    event.respondWith(
      fetch(req).then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Same-origin статика: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((resp) => {
        if (resp && resp.ok && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return resp;
      }).catch(() => cached))
    );
  }
  // Cross-origin (карти Google, шрифти, FontAwesome) — пропускаємо до мережі без втручання
});
