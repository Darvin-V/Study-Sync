/**
 * StudySync AI — Production Progressive Web App Service Worker
 * 
 * Strict Privacy & Security Architecture:
 * - Caches ONLY safe static application shell assets and UI fonts.
 * - NEVER caches authenticated API responses, private messages, profiles,
 *   notes, sessions, or user tokens in any shared cache.
 * - Provides graceful offline fallback for navigation and non-blocking failure for API endpoints.
 * - Implements clean activation and cache invalidation to prevent stale version lock-in.
 */

const CACHE_NAME = 'studysync-shell-v1';

// Static application shell files safe to precache
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon-512x512.png',
  '/icons/apple-touch-icon.png',
];

// 1. Installation Lifecycle
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 2. Activation Lifecycle (Clean up stale caches)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
            return null;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// 3. Message Listener (Support smooth user-prompted updates)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 4. Fetch Interceptor with Strict Privacy Boundaries
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Rule A: NEVER cache non-GET requests (mutations, posts, deletes)
  if (request.method !== 'GET') {
    return;
  }

  // Rule B: NEVER cache API endpoints or requests with Authorization headers
  // Protect private messages, user profiles, notes, sessions, and preferences
  if (
    url.pathname.startsWith('/api') ||
    request.headers.has('authorization') ||
    request.headers.has('x-session-token')
  ) {
    event.respondWith(
      fetch(request).catch(() => {
        // Return clear, structured offline response when network is disconnected
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'NETWORK_OFFLINE',
              message: 'You are currently offline. Live messaging, study rooms, and sessions require internet.',
            },
          }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          }
        );
      })
    );
    return;
  }

  // Rule C: SPA Navigation requests — Network first with offline HTML shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cachedShell = await caches.match('/index.html');
          if (cachedShell) return cachedShell;
          return caches.match('/');
        })
    );
    return;
  }

  // Rule D: Static Assets (JS, CSS, static images, fonts) — Cache-First with Network Revalidation
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.woff2'))
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Fetch fresh asset in background for subsequent visits (Stale-While-Revalidate)
          fetch(request)
            .then((fresh) => {
              if (fresh && fresh.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(request, fresh));
              }
            })
            .catch(() => {});
          return cached;
        }

        // Not in cache: fetch from network and store in static cache
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Rule E: Default passthrough for any external resources
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
