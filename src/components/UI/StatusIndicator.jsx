import React from 'react';

/**
 * StudySync StatusIndicator Component
 * @param {Object} props
 * @param {'online' | 'active' | 'focused' | 'scheduled' | 'pending' | 'completed'} [props.status='active']
 * @param {string} props.label
 */
export function StatusIndicator({
  status = 'active',
  label,
  className = '',
  id,
}) {
  return (
    <span className={`status-indicator ${className}`.trim()} id={id}>
      <span className={`status-dot ${status}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export default StatusIndicator;
