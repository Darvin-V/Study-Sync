import React from 'react';

/**
 * StudySync Tabs Component
 * @param {Object} props
 * @param {Array<{ id: string, label: string, count?: number }>} props.tabs
 * @param {string} props.activeTab
 * @param {function(string): void} props.onChange
 * @param {'underline' | 'pills'} [props.variant='underline']
 */
export function Tabs({
  tabs = [],
  activeTab,
  onChange,
  variant = 'underline',
  className = '',
  id = 'tabs',
}) {
  if (variant === 'pills') {
    return (
      <div className={`row ${className}`} style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }} id={id} role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              id={tab.domId || undefined}
              role="tab"
              aria-selected={isActive}
              type="button"
              className={`tab-pill ${isActive ? 'active' : ''}`}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
              {typeof tab.count === 'number' && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    opacity: 0.8,
                  }}
                >
                  ({tab.count})
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`tabs ${className}`.trim()} id={id} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            id={tab.domId || undefined}
            role="tab"
            aria-selected={isActive}
            type="button"
            className={`tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 'var(--text-xs)',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: isActive ? 'var(--color-accent-subtle)' : 'var(--color-bg-subtle)',
                  color: isActive ? 'var(--color-accent-text)' : 'var(--color-text-muted)',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
