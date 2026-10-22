import React from 'react';

/**
 * StudySync Button Component
 * @param {Object} props
 * @param {'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'danger-outline'} [props.variant='primary']
 * @param {'sm' | 'md' | 'lg'} [props.size='md']
 * @param {React.ReactNode} [props.icon]
 * @param {'left' | 'right'} [props.iconPosition='left']
 * @param {boolean} [props.loading=false]
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.className='']
 * @param {string} [props.type='button']
 * @param {React.ReactNode} props.children
 */
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  children,
  id,
  onClick,
  ...rest
}) {
  const variantClass = `btn-${variant}`;
  const sizeClass = size !== 'md' ? `btn-${size}` : '';

  return (
    <button
      type={type}
      id={id}
      disabled={disabled || loading}
      className={`btn ${variantClass} ${sizeClass} ${className}`.trim()}
      onClick={onClick}
      {...rest}
    >
      {loading ? (
        <span className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} aria-hidden="true" />
      ) : (
        icon && iconPosition === 'left' && <span className="btn-icon-wrapper" aria-hidden="true">{icon}</span>
      )}
      {children}
      {!loading && icon && iconPosition === 'right' && (
        <span className="btn-icon-wrapper" aria-hidden="true">{icon}</span>
      )}
    </button>
  );
}

export default Button;
