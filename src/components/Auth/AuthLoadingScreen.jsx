import React from 'react';
import { APP_INFO } from '../../utils/constants';

/**
 * StudySync AI — AuthLoadingScreen Component
 * 
 * Displayed while session verification is in-flight.
 * Guarantees that neither the authenticated app shell (sidebar, topbar, community feed)
 * nor private data ever flashes before authentication status is known.
 */
export function AuthLoadingScreen({ message = 'Verifying authentication session...' }) {
  return (
    <div
      id="auth-loading-screen"
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg-app)',
        color: 'var(--color-text-primary)',
        padding: 'var(--space-6)',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 360,
          textAlign: 'center',
          gap: 'var(--space-4)',
        }}
      >
        {/* Brand Icon */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--radius-lg, 12px)',
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-text-inverse, #ffffff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1))',
          }}
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="28"
            height="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M6 6h10" />
            <path d="M6 10h10" />
            <path d="M6 14h6" />
            <circle cx="18" cy="16" r="3" />
            <path d="m20.5 18.5 1.5 1.5" />
          </svg>
        </div>

        {/* Brand Name */}
        <div>
          <h1
            style={{
              fontSize: 'var(--text-xl, 20px)',
              fontWeight: 'var(--font-bold, 700)',
              color: 'var(--color-text-primary)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {APP_INFO.NAME}
          </h1>
          <p
            style={{
              fontSize: 'var(--text-xs, 12px)',
              color: 'var(--color-text-muted)',
              margin: '4px 0 0',
              fontWeight: 'var(--font-medium, 500)',
            }}
          >
            {APP_INFO.TAGLINE}
          </p>
        </div>

        {/* Spinner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginTop: 'var(--space-2)',
            padding: '8px 16px',
            borderRadius: '9999px',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div
            className="spinner"
            style={{
              width: 16,
              height: 16,
              border: '2px solid var(--color-border-default)',
              borderTopColor: 'var(--color-accent)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
            aria-hidden="true"
          />
          <span
            style={{
              fontSize: 'var(--text-xs, 12px)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {message}
          </span>
        </div>
      </div>
    </div>
  );
}

export default AuthLoadingScreen;
