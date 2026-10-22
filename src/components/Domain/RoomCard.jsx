import React from 'react';
import { Button, Avatar } from '../UI';
import { usePreferences } from '../../context/PreferencesContext';

/**
 * StudySync RoomCard Component
 * Clean, compact, professional card inspired by modern communication and learning apps.
 * 
 * Contains strictly:
 * 1. Room name
 * 2. Subject or topic
 * 3. Host avatar and name
 * 4. Small status label: Live or Not live
 * 5. Participant count based on actual data
 * 6. One primary action: Join Room or Enter Room
 */
export function RoomCard({
  room,
  onJoin,
  isJoined = false,
  id,
  className = '',
}) {
  const { t } = usePreferences();
  if (!room) return null;

  const memberCount = Number(
    room.memberCount !== undefined
      ? room.memberCount
      : room.member_count !== undefined
      ? room.member_count
      : 0
  );
  const maxCap = Number(
    room.maxCapacity !== undefined
      ? room.maxCapacity
      : room.max_capacity !== undefined
      ? room.max_capacity
      : 8
  );
  const isFull = memberCount >= maxCap;

  const isLive = Boolean(
    room.meeting_active || room.has_active_meeting || room.hasActiveMeeting
  );

  const creatorDisplay =
    room.creator_name ||
    (typeof room.creator === 'string' ? room.creator : room.creator?.name) ||
    'Student Host';
  const creatorInitials = creatorDisplay.slice(0, 2).toUpperCase();

  const topicOrSubject = room.topic || room.subject || 'Study Session';

  const handleCardClick = () => {
    if (onJoin) {
      onJoin(room);
    }
  };

  return (
    <article
      id={id}
      className={`social-room-card ${className}`.trim()}
      onClick={handleCardClick}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 'var(--space-4)',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        cursor: 'pointer',
        gap: 'var(--space-3)',
        minHeight: '168px',
        transition: 'all var(--transition-fast)',
      }}
    >
      {/* Top Row: Subject / Topic + Status Label */}
      <div
        className="row-between"
        style={{ alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'nowrap' }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--color-primary)',
            backgroundColor: 'var(--color-primary-subtle, rgba(10, 102, 194, 0.08))',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            maxWidth: '65%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={topicOrSubject}
        >
          {topicOrSubject}
        </span>

        {/* Small Status Label: Live or Not live */}
        {isLive ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#059669',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.25)',
              }}
            />
            {t('rooms.live', 'Live')}
          </span>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--color-text-muted)',
              backgroundColor: 'var(--color-bg-subtle)',
              border: '1px solid var(--color-border-subtle)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'var(--color-border-strong)',
              }}
            />
            {t('rooms.notLive', 'Not live')}
          </span>
        )}
      </div>

      {/* Middle: Room Name & Host Info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <h3
          style={{
            fontSize: 'var(--text-base, 1rem)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            lineHeight: 1.35,
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
          title={room.title || room.name || room.room_name}
        >
          {room.title || room.name || room.room_name}
        </h3>

        <div
          className="row"
          style={{ alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}
        >
          <Avatar
            name={creatorDisplay}
            initials={creatorInitials}
            src={room.creator_avatar}
            size="xs"
          />
          <span
            style={{
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {t('rooms.hostedBy', 'Hosted by')} <strong style={{ color: 'var(--color-text-primary)' }}>{creatorDisplay}</strong>
          </span>
        </div>
      </div>

      {/* Bottom Footer: Participant Count & One Primary Action */}
      <div
        className="row-between"
        style={{
          alignItems: 'center',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--color-border-subtle)',
          marginTop: 'auto',
          gap: 'var(--space-2)',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
          title={`${memberCount} registered participants`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>
            {memberCount} {memberCount === 1 ? 'participant' : 'participants'}
          </span>
        </span>

        <Button
          variant={isJoined ? 'outline' : 'primary'}
          size="sm"
          disabled={!isJoined && isFull}
          onClick={(e) => {
            e.stopPropagation();
            onJoin && onJoin(room);
          }}
        >
          {isJoined ? t('rooms.enterRoom', 'Enter Room') : isFull ? t('rooms.roomFull', 'Room Full') : t('rooms.joinRoom', 'Join Room')}
        </Button>
      </div>
    </article>
  );
}

export default RoomCard;
