import React from 'react';

/**
 * StudySync Badge Component
 * @param {Object} props
 * @param {'neutral' | 'accent' | 'success' | 'warning' | 'info' | 'danger'} [props.variant='neutral']
 * @param {boolean} [props.dot=false]
 * @param {React.ReactNode} props.children
 */
export function Badge({
  variant = 'neutral',
  dot = false,
  children,
  className = '',
  id,
  ...rest
}) {
  return (
    <span id={id} className={`badge badge-${variant} ${className}`.trim()} {...rest}>
      {dot && (
        <span
          className="status-dot"
          style={{
            backgroundColor: 'currentColor',
            width: 6,
            height: 6,
          }}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

export default Badge;
