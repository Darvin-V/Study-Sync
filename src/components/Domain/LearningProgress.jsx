import React from 'react';
import { Card, ProgressIndicator } from '../UI';

/**
 * StudySync LearningProgress Component
 * Thoughtful, non-gamified academic progress module.
 */
export function LearningProgress({
  stats,
  topics = [],
  id = 'learning-progress-card',
  className = '',
}) {
  return (
    <Card id={id} className={`stack ${className}`.trim()}>
      <div className="row-between">
        <div>
          <h3 className="card-title" style={{ fontSize: 'var(--text-base)' }}>
            Weekly Study Rhythm
          </h3>
          <p className="card-subtitle">
            Measured study time across focused sessions
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
            {stats?.currentWeekHours || 8.5} hrs
          </span>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            this week
          </div>
        </div>
      </div>

      <div
        className="row-between"
        style={{
          backgroundColor: 'var(--color-bg-subtle)',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
            {stats?.focusHoursLogged || 42.5}h
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Total Focus
          </div>
        </div>
        <div style={{ width: 1, height: 28, backgroundColor: 'var(--color-border-default)' }} />
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
            {stats?.sessionsCompleted || 28}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Sessions
          </div>
        </div>
        <div style={{ width: 1, height: 28, backgroundColor: 'var(--color-border-default)' }} />
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
            {stats?.notesShared || 14}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Notes Shared
          </div>
        </div>
      </div>

      {topics && topics.length > 0 && (
        <div className="stack-sm" style={{ marginTop: 'var(--space-2)' }}>
          <div style={{ fontSize: '11px', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Current Subject Coverage
          </div>
          {topics.slice(0, 2).map((t) => (
            <ProgressIndicator
              key={t.id}
              label={t.title}
              value={t.progress || 50}
              helperText={t.recommendedNext}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export default LearningProgress;
