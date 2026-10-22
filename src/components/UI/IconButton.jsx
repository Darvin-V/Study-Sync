import React from 'react';

/**
 * StudySync IconButton Component
 * @param {Object} props
 * @param {React.ReactNode} props.icon
 * @param {string} props.label - Accessible aria-label
 * @param {'default' | 'ghost'} [props.variant='default']
 * @param {'sm' | 'md'} [props.size='md']
 */
export function IconButton({
  icon,
  label,
  variant = 'default',
  size = 'md',
  className = '',
  id,
  onClick,
  disabled = false,
  ...rest
}) {
  const ghostClass = variant === 'ghost' ? 'ghost' : '';
  const sizeStyle = size === 'sm' ? { width: 30, height: 30 } : {};

  return (
    <button
      type="button"
      id={id}
      aria-label={label}
      title={label}
      disabled={disabled}
      style={sizeStyle}
      className={`btn-icon ${ghostClass} ${className}`.trim()}
      onClick={onClick}
      {...rest}
    >
      {icon}
    </button>
  );
}

export default IconButton;
