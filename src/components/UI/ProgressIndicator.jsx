import React from 'react';

/**
 * StudySync ProgressIndicator Component
 * Thoughtful, non-gamified educational progress bar.
 * @param {Object} props
 * @param {number} props.value - Percentage (0 to 100)
 * @param {string} [props.label]
 * @param {string} [props.helperText]
 * @param {boolean} [props.showPercent=true]
 */
export function ProgressIndicator({
  value = 0,
  label,
  helperText,
  showPercent = true,
  className = '',
  id,
}) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={`progress-container ${className}`.trim()} id={id}>
      {(label || showPercent) && (
        <div className="progress-header">
          {label && <span>{label}</span>}
          {showPercent && <span className="progress-value">{clampedValue}%</span>}
        </div>
      )}
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div className="progress-fill" style={{ width: `${clampedValue}%` }} />
      </div>
      {helperText && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          {helperText}
        </span>
      )}
    </div>
  );
}

export default ProgressIndicator;
