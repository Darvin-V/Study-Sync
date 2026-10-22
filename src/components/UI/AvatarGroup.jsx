import React from 'react';
import Avatar from './Avatar';

/**
 * StudySync AvatarGroup Component
 */
export function AvatarGroup({
  users = [],
  max = 3,
  size = 'sm',
  className = '',
}) {
  const visibleUsers = users.slice(0, max);
  const remainingCount = users.length - max;

  return (
    <div className={`avatar-group ${className}`.trim()}>
      {visibleUsers.map((user, idx) => {
        const name = typeof user === 'string' ? user : user.name;
        const initials = typeof user === 'object' ? user.initials : undefined;
        return (
          <Avatar
            key={idx}
            name={name}
            initials={initials}
            size={size}
          />
        );
      })}

      {remainingCount > 0 && (
        <span className="avatar-group-count">+{remainingCount}</span>
      )}
    </div>
  );
}

export default AvatarGroup;
