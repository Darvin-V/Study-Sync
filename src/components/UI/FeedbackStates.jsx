import React from 'react';

/**
 * StudySync EmptyState Component
 */
export function EmptyState({
  title = 'No items found',
  description = 'Try adjusting your search criteria or filters.',
  action,
  icon,
  className = '',
  id,
}) {
  return (
    <div className={`empty-state ${className}`.trim()} id={id}>
      <div className="empty-state-icon" aria-hidden="true">
        {icon || (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        )}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div style={{ marginTop: 'var(--space-2)' }}>{action}</div>}
    </div>
  );
}

/**
 * StudySync LoadingState Component
 */
export function LoadingState({ message = 'Loading...', id }) {
  return (
    <div className="loading-state" id={id}>
      <span className="loading-spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

/**
 * StudySync ErrorState Component
 */
export function ErrorState({ message = 'An error occurred', onRetry, id }) {
  return (
    <div className="error-banner" id={id}>
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--font-semibold)',
            textDecoration: 'underline',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

export default EmptyState;
