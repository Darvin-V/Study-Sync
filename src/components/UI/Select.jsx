import React from 'react';

/**
 * StudySync Select Component
 */
export function Select({
  label,
  id,
  name,
  value,
  onChange,
  options = [],
  placeholder,
  error,
  helperText,
  required = false,
  disabled = false,
  className = '',
  ...rest
}) {
  const selectId = id || (name ? `select-${name}` : undefined);

  return (
    <div className={`form-group ${className}`.trim()}>
      {label && (
        <label htmlFor={selectId} className="form-label">
          {label}
          {required && <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>}
        </label>
      )}

      <select
        id={selectId}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className="form-select"
        style={error ? { borderColor: 'var(--color-danger)' } : {}}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const text = typeof opt === 'object' ? opt.label : opt;
          return (
            <option key={val} value={val}>
              {text}
            </option>
          );
        })}
      </select>

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

export default Select;
