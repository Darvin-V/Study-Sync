import React from 'react';

export function PlaceholderCard({
  title,
  subtitle,
  phaseTag = 'Phase Foundation',
  description,
  id,
}) {
  return (
    <div className="card" id={id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 'var(--text-lg)' }}>{title}</h3>
        <span className="badge badge-info">{phaseTag}</span>
      </div>
      {subtitle && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          {subtitle}
        </p>
      )}
      {description && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          {description}
        </p>
      )}
    </div>
  );
}

export default PlaceholderCard;
