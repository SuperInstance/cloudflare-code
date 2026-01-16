/// <reference lib="webworker" />

// @ts-nocheck - Service Worker API types
declare const self: ServiceWorkerGlobalScope;

const CACHE_VERSION = 'v1';
const CACHE_NAME = `claudeflare-mobile-${CACHE_VERSION}`;

// Assets to cache immediately
const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// API routes that should use network-first
const API_ROUTES = ['/api/'];

// Static asset routes
const STATIC_ASSET_ROUTES = ['/icons/', '/images/', '/_next/static/'];

/**
 * Install event - precache assets
 */
self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[SW] Install event');

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_ASSETS);
      await self.skipWaiting();
    })()
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[SW] Activate event');

  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith('claudeflare-mobile-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );

      // Take control of all clients
      await self.clients.claim();
    })()
  );
});

/**
 * Fetch event - handle routing with different strategies
 */
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome extensions and other protocols
  if (!url.protocol.startsWith('http')) return;

  // Handle different route types with appropriate strategies
  if (API_ROUTES.some((route) => url.pathname.startsWith(route))) {
    // Network first for API routes
    event.respondWith(networkFirstStrategy(request));
  } else if (STATIC_ASSET_ROUTES.some((route) => url.pathname.startsWith(route))) {
    // Cache first for static assets
    event.respondWith(cacheFirstStrategy(request));
  } else {
    // Stale while revalidate for pages
    event.respondWith(staleWhileRevalidateStrategy(request));
  }
});

/**
 * Network First Strategy
 * Try network first, fallback to cache
 */
async function networkFirstStrategy(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);

  try {
    // Try network first
    const networkResponse = await fetch(request);

    // Cache the response if successful
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache', error);

    // Fallback to cache
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for HTML requests
    if (request.headers.get('accept')?.includes('text/html')) {
      const offlineResponse = await cache.match('/offline');
      if (offlineResponse) {
        return offlineResponse;
      }
    }

    throw error;
  }
}

/**
 * Cache First Strategy
 * Try cache first, fallback to network
 */
async function cacheFirstStrategy(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Update cache in background
    fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse);
      }
    });

    return cachedResponse;
  }

  // Fetch from network
  const networkResponse = await fetch(request);

  if (networkResponse.ok) {
    cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

/**
 * Stale While Revalidate Strategy
 * Serve from cache immediately, update in background
 */
async function staleWhileRevalidateStrategy(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  // Fetch in background
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });

  // Return cached version immediately, or wait for network
  return cachedResponse || fetchPromise;
}

/**
 * Background sync for offline actions
 */
self.addEventListener('sync', (event: ExtendableEvent) => {
  console.log('[SW] Background sync', event.tag);

  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  } else if (event.tag === 'sync-projects') {
    event.waitUntil(syncProjects());
  }
});

/**
 * Sync messages when back online
 */
async function syncMessages(): Promise<void> {
  try {
    // Get pending messages from IndexedDB
    const pendingMessages = await getPendingMessages();

    for (const message of pendingMessages) {
      try {
        await fetch('/api/chat', {
          method: 'POST',
          body: JSON.stringify(message),
        });

        // Remove from pending after successful sync
        await removePendingMessage(message.id);
      } catch (error) {
        console.error('[SW] Failed to sync message', error);
      }
    }
  } catch (error) {
    console.error('[SW] Sync messages failed', error);
  }
}

/**
 * Sync projects when back online
 */
async function syncProjects(): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.add('/api/projects');
  } catch (error) {
    console.error('[SW] Sync projects failed', error);
  }
}

/**
 * Push notification handler
 */
self.addEventListener('push', (event: PushEvent) => {
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

/**
 * Notification click handler
 */
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[SW] Notification clicked', event.action);

  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      self.clients.openWindow(event.notification.data || '/')
    );
  } else if (event.action === 'close') {
    // Just closed
  } else {
    // Default action - open the app
    event.waitUntil(
      self.clients.openWindow(event.notification.data || '/')
    );
  }
});

/**
 * IndexedDB helpers for offline queue
 */
async function getPendingMessages(): Promise<any[]> {
  // This would integrate with IndexedDB
  // For now, return empty array
  return [];
}

async function removePendingMessage(id: string): Promise<void> {
  // This would integrate with IndexedDB
  console.log('[SW] Remove pending message', id);
}

// @ts-nocheck - External React/Next.js dependencies
export {};
