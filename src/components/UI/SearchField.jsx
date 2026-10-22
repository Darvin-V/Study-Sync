import React from 'react';

/**
 * StudySync SearchField Component
 */
export function SearchField({
  placeholder = 'Search topics, rooms, notes...',
  value,
  onChange,
  onClear,
  id = 'global-search-input',
  className = '',
  ...rest
}) {
  return (
    <div className={`search-field ${className}`.trim()}>
      <svg
        className="search-field-icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete="off"
        {...rest}
      />
    </div>
  );
}

export default SearchField;
