import React from 'react';

/**
 * StudySync Divider Component
 */
export function Divider({ className = '', style }) {
  return <hr className={`divider ${className}`.trim()} style={style} />;
}

export default Divider;
