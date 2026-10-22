import React from 'react';

/**
 * StudySync Avatar Component
 * @param {Object} props
 * @param {string} [props.name]
 * @param {string} [props.src]
 * @param {string} [props.initials]
 * @param {'xs' | 'sm' | 'md' | 'lg' | 'xl'} [props.size='md']
 * @param {'online' | 'focused' | 'away' | 'offline'} [props.status]
 */
export function Avatar({
  name = '',
  src,
  initials,
  size = 'md',
  status,
  className = '',
  id,
  ...rest
}) {
  const computedInitials =
    initials ||
    (name
      ? name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : '?');

  return (
    <div
      id={id}
      className={`avatar avatar-${size} ${className}`.trim()}
      aria-label={name || 'Avatar'}
      title={name}
      {...rest}
    >
      {src ? (
        <img src={src} alt={name || 'User avatar'} />
      ) : (
        <span>{computedInitials}</span>
      )}

      {status && status !== 'offline' && (
        <span className={`avatar-status-dot ${status}`} aria-hidden="true" />
      )}
    </div>
  );
}

export default Avatar;
