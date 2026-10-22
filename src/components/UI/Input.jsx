import React from 'react';

/**
 * StudySync Input Component
 */
export function Input({
  label,
  id,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  helperText,
  icon,
  required = false,
  disabled = false,
  className = '',
  ...rest
}) {
  const inputId = id || (name ? `input-${name}` : undefined);

  return (
    <div className={`form-group ${className}`.trim()}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
          {required && <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>}
        </label>
      )}

      <div className={icon ? 'input-with-icon' : undefined}>
        {icon && <span className="input-icon-left" aria-hidden="true">{icon}</span>}
        <input
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`form-input ${error ? 'border-danger' : ''}`}
          style={error ? { borderColor: 'var(--color-danger)' } : {}}
          {...rest}
        />
      </div>

      {error ? (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>{error}</span>
      ) : (
        helperText && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {helperText}
          </span>
        )
      )}
    </div>
  );
}

export default Input;
