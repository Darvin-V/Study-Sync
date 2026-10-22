import React from 'react';
import { usePWA } from '../../context/PWAContext';
import { usePreferences } from '../../context/PreferencesContext';

export function PWANotifications() {
  const {
    isOnline,
    wasOffline,
    isInstallable,
    updateAvailable,
    installApp,
    applyUpdate,
    dismissInstall,
  } = usePWA();
  const { t } = usePreferences();

  return (
    <div className="pwa-notifications-container" id="pwa-notifications" style={{ zIndex: 9999 }}>
      {/* 1. Offline Mode Banner */}
      {!isOnline && (
        <div
          id="offline-banner"
          role="status"
          aria-live="polite"
          style={{
            backgroundColor: '#2d1b06',
            color: '#fed7aa',
            borderBottom: '1px solid #7c2d12',
            padding: '8px 16px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>📡</span>
            <span>
              <strong style={{ color: '#fed7aa' }}>{t('pwa.offline.title', 'Offline Mode')}:</strong>{' '}
              {t(
                'pwa.offline.desc',
                'Viewing cached app shell. Live study rooms, messaging, and sessions require internet.'
              )}
            </span>
          </div>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(251, 146, 60, 0.2)',
              border: '1px solid #ea580c',
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: '#fed7aa',
            }}
          >
            {t('pwa.offline.badge', 'Offline')}
          </span>
        </div>
      )}

      {/* 2. Reconnection Recovery Toast */}
      {wasOffline && isOnline && (
        <div
          id="online-restored-banner"
          role="status"
          aria-live="polite"
          style={{
            backgroundColor: '#052e16',
            color: '#bbf7d0',
            borderBottom: '1px solid #166534',
            padding: '8px 16px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            animation: 'fadeIn 0.3s ease-in-out',
          }}
        >
          <span>✓</span>
          <span>
            {t('pwa.online.restored', 'Connection restored! Live services reconnected.')}
          </span>
        </div>
      )}

      {/* 3. New Application Version Update Prompt */}
      {updateAvailable && (
        <div
          id="pwa-update-banner"
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            color: 'var(--color-text-primary)',
            borderBottom: '1px solid var(--color-border-default)',
            padding: '10px 16px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🚀</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
              {t('pwa.update.title', 'A new version of StudySync AI is available.')}
            </span>
          </div>
          <button
            type="button"
            id="pwa-update-btn"
            onClick={applyUpdate}
            style={{
              padding: '5px 14px',
              borderRadius: 'var(--radius-full, 9999px)',
              backgroundColor: 'var(--color-primary, #0A66C2)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {t('pwa.update.btn', 'Update Now')}
          </button>
        </div>
      )}

      {/* 4. Install Application Prompt */}
      {isInstallable && (
        <div
          id="pwa-install-banner"
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            color: 'var(--color-text-primary)',
            borderBottom: '1px solid var(--color-border-default)',
            padding: '10px 16px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <img
              src="/icons/icon-192x192.png"
              alt="StudySync App Icon"
              style={{ width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0 }}
            />
            <span style={{ color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
              <strong style={{ color: 'var(--color-text-primary)' }}>
                {t('pwa.install.title', 'Install StudySync AI')}:
              </strong>{' '}
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {t('pwa.install.desc', 'Install for instant access and standalone fullscreen experience.')}
              </span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <button
              type="button"
              id="pwa-dismiss-btn"
              onClick={dismissInstall}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm, 6px)',
                transition: 'color 0.15s ease',
              }}
            >
              {t('pwa.install.later', 'Later')}
            </button>
            <button
              type="button"
              id="pwa-install-btn"
              onClick={installApp}
              style={{
                padding: '6px 16px',
                borderRadius: 'var(--radius-full, 9999px)',
                backgroundColor: 'var(--color-primary, #0A66C2)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: 'var(--shadow-subtle)',
                transition: 'opacity 0.15s ease',
              }}
            >
              <span aria-hidden="true">📲</span>
              <span>{t('pwa.install.installBtn', 'Install App')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PWANotifications;
