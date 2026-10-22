import React from 'react';

export function PageHeader({ title, description, badge }) {
  return (
    <div className="page-header" id={`header-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
        <h1 className="page-title">{title}</h1>
        {badge && <span className="badge badge-info">{badge}</span>}
      </div>
      {description && <p className="page-description">{description}</p>}
    </div>
  );
}

export default PageHeader;
