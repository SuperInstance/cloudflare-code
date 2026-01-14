/**
 * Service Worker
 *
 * Generated from TypeScript - copy of lib/pwa/service-worker-registration.ts
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `claudeflare-mobile-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_ASSETS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith('claudeflare-mobile-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // API routes - network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
  }
  // Static assets - cache first
  else if (url.pathname.startsWith('/icons/') || url.pathname.startsWith('/images/') || url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
  }
  // Pages - stale while revalidate
  else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache', error);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    if (request.headers.get('accept')?.includes('text/html')) {
      const offlineResponse = await cache.match('/offline');
      if (offlineResponse) {
        return offlineResponse;
      }
    }

    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse);
      }
    });
    return cachedResponse;
  }

  const networkResponse = await fetch(request);

  if (networkResponse.ok) {
    cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });

  return cachedResponse || fetchPromise;
}

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync', event.tag);
});

self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let data = {
    title: 'ClaudeFlare',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (error) {
      console.error('[SW] Failed to parse push data', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      vibrate: [200, 100, 200],
      data: data.url || '/',
      actions: [
        {
          action: 'view',
          title: 'View',
        },
        {
          action: 'close',
          title: 'Close',
        },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked', event.action);
  event.notification.close();

  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      self.clients.openWindow(event.notification.data || '/')
    );
  }
});
