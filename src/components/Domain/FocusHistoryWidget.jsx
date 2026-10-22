import React, { useEffect } from 'react';
import { Card, Badge, Button } from '../UI';
import { useApp } from '../../context/AppContext';

export function FocusHistoryWidget({
  history: propHistory,
  isLoading: propIsLoading,
  onRefresh: propOnRefresh,
  onStartSprint,
  onStartNew,
}) {
  const appContext = useApp();
  const history = propHistory || appContext.focusHistory;
  const isLoading = propIsLoading !== undefined ? propIsLoading : appContext.isFocusHistoryLoading;
  const onRefresh = propOnRefresh || appContext.loadFocusHistory;
  const handleStart = onStartSprint || onStartNew || (() => appContext.setIsFocusModalOpen && appContext.setIsFocusModalOpen(true));

  useEffect(() => {
    if (!propHistory && appContext.loadFocusHistory) {
      appContext.loadFocusHistory();
    }
  }, [propHistory]);

  const stats = history?.stats || {
    completedIntervalsCount: 0,
    totalRecordedFocusMinutes: 0,
    totalRecordedFocusHours: 0,
    averageIntervalMinutes: 0,
    plannedAdherencePercentage: 0,
    needsRevisionCount: 0,
    goalsSetCount: 0,
    goalsAchievedCount: 0,
    disclaimer: 'Recorded duration measures timer duration, not verified concentration, understanding, or mastery.',
  };

  const intervals = history?.intervals || [];

  return (
    <Card id="focus-history-widget" className="stack" style={{ gap: 'var(--space-4)' }}>
      {/* Header */}
      <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
              🎯 Study Session History & Learning Metrics
            </h3>
            <Badge variant="accent">Session Reflection</Badge>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Transparent log of your completed study sessions, goals achieved, and topics flagged for revision.
          </p>
        </div>

        <div className="row" style={{ gap: 'var(--space-2)' }}>
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
              Refresh
            </Button>
          )}
          {handleStart && (
            <Button variant="primary" size="sm" onClick={handleStart} id="history-start-sprint-btn">
              + New Study Session
            </Button>
          )}
        </div>
      </div>

      {/* 4-Card Summary Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
            {stats.completedIntervalsCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>Sessions Completed</div>
        </div>

        <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-accent)' }}>
            {stats.totalRecordedFocusHours > 0 ? `${stats.totalRecordedFocusHours}h` : `${stats.totalRecordedFocusMinutes}m`}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>Recorded Study Time</div>
        </div>

        <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-forest, #10b981)' }}>
            {stats.goalsAchievedCount || 0} / {stats.goalsSetCount || 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>Goals Achieved</div>
        </div>

        <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: stats.needsRevisionCount > 0 ? 'var(--color-warning-text, #b45309)' : 'var(--color-text-secondary)' }}>
            {stats.needsRevisionCount || 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>Marked for Revision</div>
        </div>
      </div>

      {/* Honest Disclaimer */}
      <div
        style={{
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--color-bg-subtle)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border-subtle)',
          fontSize: '11px',
          color: 'var(--color-text-secondary)',
        }}
      >
        <strong>Transparent Progress Principle:</strong> {stats.disclaimer}
      </div>

      {/* Recent Intervals List */}
      <div>
        <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
          Recent Learning Sessions
        </h4>

        {isLoading ? (
          <div style={{ padding: 'var(--space-4)', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Loading study session records...
          </div>
        ) : intervals.length > 0 ? (
          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            {intervals.slice(0, 8).map((item) => {
              const statusVariant =
                item.status === 'completed' ? 'success' : item.status === 'cancelled' ? 'neutral' : item.status === 'paused' ? 'warning' : 'primary';

              const startedDateStr = new Date(item.started_at).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
              });
              const startedTimeStr = new Date(item.started_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={item.id}
                  style={{
                    padding: '12px 14px',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                  className="stack-xs"
                >
                  <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <div className="stack-xs" style={{ flex: 1, minWidth: 200 }}>
                      <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                          {item.topic}
                        </span>
                        {item.subject && (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            &bull; {item.subject}
                          </span>
                        )}
                        {item.needsRevision && (
                          <Badge variant="warning" style={{ fontSize: '10px' }}>
                            📌 Revision Target
                          </Badge>
                        )}
                      </div>

                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {startedDateStr} at {startedTimeStr}
                      </span>
                    </div>

                    <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
                      <div style={{ textAlign: 'right', fontSize: '11px' }}>
                        <div style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)' }}>
                          {item.actualDurationMinutes}m / {item.plannedDurationMinutes}m
                        </div>
                        <div style={{ color: 'var(--color-text-muted)' }}>
                          {item.status === 'completed' ? 'Recorded' : item.earlyExitReason || item.status}
                        </div>
                      </div>
                      <Badge variant={statusVariant} style={{ textTransform: 'capitalize' }}>
                        {item.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Goal entry */}
                  {item.goal && (
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      <strong>🎯 Goal:</strong> {item.goal}
                    </div>
                  )}

                  {/* Phases progress pills */}
                  {item.phases && item.phases.length > 0 && (
                    <div className="row" style={{ gap: '4px', marginTop: 4, flexWrap: 'wrap' }}>
                      {item.phases.map((p) => {
                        const isDone = item.completedPhases?.includes(p.id) || item.status === 'completed';
                        return (
                          <span
                            key={p.id}
                            style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: isDone ? 'rgba(16, 185, 129, 0.12)' : 'var(--color-bg-surface)',
                              color: isDone ? 'var(--color-forest, #10b981)' : 'var(--color-text-muted)',
                              border: isDone ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--color-border-subtle)',
                            }}
                          >
                            {isDone ? '✓ ' : ''}{p.name}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Reflection summary */}
                  {(item.keyTakeaways || item.confusingDoubts || item.goalAchieved) && (
                    <div
                      style={{
                        marginTop: 6,
                        padding: '6px 10px',
                        backgroundColor: 'var(--color-bg-surface)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        color: 'var(--color-text-secondary)',
                      }}
                      className="stack-xs"
                    >
                      {item.goalAchieved && (
                        <div>
                          <strong>Outcome:</strong> Goal {item.goalAchieved === 'yes' ? 'fully achieved' : item.goalAchieved === 'partially' ? 'partially achieved' : 'requires additional practice'}
                        </div>
                      )}
                      {item.keyTakeaways && (
                        <div>
                          <strong>Understood:</strong> {item.keyTakeaways}
                        </div>
                      )}
                      {item.confusingDoubts && (
                        <div style={{ color: 'var(--color-warning-text, #b45309)' }}>
                          <strong>Doubts / Unresolved:</strong> {item.confusingDoubts}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: 'var(--space-4)',
              textAlign: 'center',
              backgroundColor: 'var(--color-bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--color-border-default)',
            }}
          >
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              No study sessions recorded yet. Start a structured 25-minute session with goal-setting and reflection!
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default FocusHistoryWidget;
