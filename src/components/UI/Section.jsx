import React from 'react';

/**
 * StudySync Section & SectionHeader Components
 */
export function Section({ children, className = '', id, style }) {
  return (
    <section id={id} className={`stack ${className}`.trim()} style={{ marginBottom: 'var(--space-6)', ...style }}>
      {children}
    </section>
  );
}

export function SectionHeader({ title, subtitle, action, id }) {
  return (
    <div id={id} className="section-header">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

Section.Header = SectionHeader;

export default Section;
