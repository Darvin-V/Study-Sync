import React from 'react';
import { Card, Badge, AvatarGroup, Button } from '../UI';

/**
 * StudySync StudySessionCard Component
 * Displays study session topic, duration, participants, and status.
 */
export function StudySessionCard({
  session,
  onAction,
  id,
  className = '',
}) {
  if (!session) return null;

  const isLive = session.status?.toLowerCase() === 'active';
  const isUpcoming = session.status?.toLowerCase() === 'upcoming' || session.status?.toLowerCase() === 'scheduled';
  const isCompleted = session.status?.toLowerCase() === 'completed';

  const badgeVariant = isLive ? 'success' : isUpcoming ? 'warning' : 'neutral';
  const statusText = session.statusLabel || (isLive ? 'Live Study Block' : isCompleted ? 'Completed' : 'Scheduled');
  const duration = session.durationMinutes || session.planned_duration || 45;
  const participantList = session.participantNames || (session.participants ? session.participants.map(p => p.display_name) : []);

  return (
    <Card id={id} className={`stack-sm ${className}`.trim()}>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {session.subject || 'Computer Science'}
          </span>
          <h3 className="card-title" style={{ fontSize: '1.15rem', marginTop: 2 }}>
            {session.topic}
          </h3>
        </div>
        <Badge variant={badgeVariant} dot={isLive}>
          {statusText}
        </Badge>
      </div>

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 'var(--space-1) 0', lineHeight: 1.5 }}>
        {session.description || session.title || 'Collaborative study block with individual focus tracking.'}
      </p>

      <div className="card-footer" style={{ marginTop: 'var(--space-2)' }}>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <AvatarGroup
            users={participantList}
            max={3}
            size="xs"
          />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            &bull; {duration} mins
          </span>
        </div>

        <Button
          variant={isLive ? 'primary' : 'outline'}
          size="sm"
          id={`session-action-${session.id}`}
          onClick={() => onAction && onAction(session)}
        >
          {isLive ? 'Resume Workspace' : isCompleted ? 'View Summary' : 'Enter Session'}
        </Button>
      </div>
    </Card>
  );
}

export default StudySessionCard;
