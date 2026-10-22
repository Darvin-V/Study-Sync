import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { registerServiceWorker, activateWaitingWorker } from '../registerServiceWorker';

const PWAContext = createContext(null);

export function PWAProvider({ children }) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingRegistration, setWaitingRegistration] = useState(null);
  const [isInstallDismissed, setIsInstallDismissed] = useState(false);

  // 1. Monitor Network Connectivity (Online / Offline)
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      setWasOffline(true);
      const timer = setTimeout(() => setWasOffline(false), 4000);
      return () => clearTimeout(timer);
    }

    function handleOffline() {
      setIsOnline(false);
      setWasOffline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Check Display Mode & App Installed Event
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    }

    window.addEventListener('appinstalled', handleAppInstalled);
    return () => window.removeEventListener('appinstalled', handleAppInstalled);
  }, []);

  // 3. Capture beforeinstallprompt Event
  useEffect(() => {
    function handleBeforeInstallPrompt(e) {
      // Prevent automatic mini-infobar from appearing
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // 4. Register Service Worker and Track Update Lifecycle
  useEffect(() => {
    registerServiceWorker((registration) => {
      setWaitingRegistration(registration);
      setUpdateAvailable(true);
    });
  }, []);

  // 5. Trigger Native Install Prompt
  const installApp = useCallback(async () => {
    if (!deferredPrompt) return false;

    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
      return choiceResult.outcome === 'accepted';
    } catch {
      return false;
    }
  }, [deferredPrompt]);

  // 6. Apply Pending Application Update
  const applyUpdate = useCallback(() => {
    if (waitingRegistration) {
      activateWaitingWorker(waitingRegistration);
    }
  }, [waitingRegistration]);

  const dismissInstall = useCallback(() => {
    setIsInstallDismissed(true);
  }, []);

  return (
    <PWAContext.Provider
      value={{
        isOnline,
        wasOffline,
        isInstallable: isInstallable && !isInstalled && !isInstallDismissed,
        isInstalled,
        updateAvailable,
        installApp,
        applyUpdate,
        dismissInstall,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
}

export function usePWA() {
  const context = useContext(PWAContext);
  if (!context) {
    return {
      isOnline: true,
      wasOffline: false,
      isInstallable: false,
      isInstalled: false,
      updateAvailable: false,
      installApp: () => {},
      applyUpdate: () => {},
      dismissInstall: () => {},
    };
  }
  return context;
}

export default PWAContext;
