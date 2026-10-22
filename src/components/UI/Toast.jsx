import React from 'react';

/**
 * StudySync Toast Notification Component
 * Subtly renders inline success, error, or info feedback.
 */
export function Toast({ toast, onClose }) {
  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div
      role="status"
      aria-live="polite"
      id="app-notification-toast"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: '12px 16px',
        backgroundColor: 'var(--color-bg-surface)',
        border: `1px solid ${isSuccess ? 'var(--color-success-border)' : isError ? 'var(--color-danger-border)' : 'var(--color-border-strong)'}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-modal)',
        maxWidth: 380,
        animation: 'slideUp 180ms ease',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: isSuccess ? 'var(--color-success)' : isError ? 'var(--color-danger)' : 'var(--color-accent)',
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', flex: 1, fontWeight: 'var(--font-medium)' }}>
        {toast.message}
      </span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notification"
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-base)',
            cursor: 'pointer',
            padding: 2,
            lineHeight: 1,
          }}
        >
          &times;
        </button>
      )}
    </div>
  );
}

export default Toast;
