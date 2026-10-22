import React from 'react';
import { Card, Badge, ProgressIndicator, Button } from '../UI';

/**
 * StudySync TopicCard Component
 * Displays course topic, difficulty, active learners, and room activity status.
 */
export function TopicCard({
  topic,
  onExplore,
  id,
  className = '',
}) {
  if (!topic) return null;

  return (
    <Card id={id} className={`stack-sm ${className}`.trim()}>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-muted)' }}>
            {topic.subject}
          </span>
          <h3 className="card-title" style={{ fontSize: 'var(--text-base)', marginTop: 2 }}>
            {topic.title}
          </h3>
        </div>
        <Badge variant={topic.difficulty === 'Advanced' ? 'warning' : 'neutral'}>
          {topic.difficulty}
        </Badge>
      </div>

      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 'var(--space-1) 0' }}>
        {topic.description}
      </p>

      {typeof topic.progress === 'number' && (
        <ProgressIndicator
          value={topic.progress}
          label="Topic Coverage"
          helperText={topic.recommendedNext ? `Next: ${topic.recommendedNext}` : undefined}
        />
      )}

      <div className="card-footer" style={{ marginTop: 'var(--space-3)' }}>
        <div className="row" style={{ gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          <span>
            <strong style={{ color: 'var(--color-text-primary)' }}>{topic.activeLearners}</strong> learners
          </span>
          <span>&bull;</span>
          <span>
            <strong style={{ color: 'var(--color-text-primary)' }}>{topic.activeRooms}</strong> active {topic.activeRooms === 1 ? 'room' : 'rooms'}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          id={`explore-topic-${topic.id}`}
          onClick={() => onExplore && onExplore(topic)}
        >
          Explore Topic
        </Button>
      </div>
    </Card>
  );
}

export default TopicCard;
