/**
 * StudySync AI — Progressive Web App Service Worker Registration Module
 * 
 * Safely registers the service worker, monitors update lifecycles,
 * and notifies the UI when a clean update is available without locking
 * users into a stale version.
 */

export function registerServiceWorker(onUpdateAvailable = null) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Register once the window has fully loaded to avoid competing for bandwidth
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      // 1. Check if a worker is already waiting to activate
      if (registration.waiting && onUpdateAvailable) {
        onUpdateAvailable(registration);
      }

      // 2. Listen for newly discovered updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content is available and waiting for activation
            if (onUpdateAvailable) {
              onUpdateAvailable(registration);
            }
          }
        });
      });

      // 3. Smooth page refresh when new service worker takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    } catch (err) {
      console.warn('[StudySync PWA] Service worker registration bypassed:', err?.message || err);
    }
  });
}

export function activateWaitingWorker(registration) {
  if (registration && registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}
