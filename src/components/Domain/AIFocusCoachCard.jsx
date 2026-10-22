import React, { useState } from 'react';
import { Card, Badge, Button } from '../UI';
import { useApp } from '../../context/AppContext';

/**
 * StudySync AI — AI Focus Coach Card
 * 
 * CORE PRINCIPLES:
 * 1. Analyzes legitimate study session data: duration, completed goals, voluntary breaks,
 *    quiz progress, and self-reported distractions.
 * 2. Generates personalized suggestions for session length, break timing, and study goals.
 * 3. Transparent, testable heuristic algorithm without paid APIs.
 * 4. Clearly distinguishes rule-based recommendations from actual machine-learning predictions.
 * 5. Does not claim to detect mental state, attention, or distraction from data that cannot establish it.
 * 6. Zero camera monitoring, keystroke tracking, or background surveillance.
 */
export function AIFocusCoachCard({
  onSelectDuration,
  onSelectGoal,
  className = '',
  id = 'ai-focus-coach-card',
}) {
  const {
    focusCoachAdvice,
    isFocusCoachLoading,
    loadFocusCoachAdvice,
    startFocus,
    activeSession,
    setIsFocusModalOpen,
  } = useApp();

  const [appliedDuration, setAppliedDuration] = useState(null);

  const advice = focusCoachAdvice;
  const pacing = advice?.pacingRecommendation;
  const summary = advice?.summary;
  const goals = advice?.recommendedGoals || [];
  const distraction = advice?.distractionInsight;

  const handleApplySprint = (minutes) => {
    setAppliedDuration(minutes);
    if (onSelectDuration) {
      onSelectDuration(minutes);
    } else if (activeSession) {
      startFocus({
        topic: activeSession.topic,
        sessionId: activeSession.id,
        plannedDurationMinutes: minutes,
      });
    } else {
      setIsFocusModalOpen(true);
    }
  };

  const handleApplyGoal = (goalObj) => {
    if (onSelectGoal) {
      onSelectGoal(goalObj.goal, goalObj.suggestedMinutes);
    } else {
      startFocus({
        topic: goalObj.topic,
        plannedDurationMinutes: goalObj.suggestedMinutes || 25,
      });
    }
  };

  return (
    <Card id={id} className={`stack ${className}`.trim()} style={{ gap: 'var(--space-4)', padding: 'var(--space-5)' }}>
      {/* 1. Header with Engine Distinction */}
      <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
              🧠 AI Focus Coach
            </h3>
            <Badge variant="accent">Rule-Based Heuristic</Badge>
            <Badge variant="neutral">Zero API Cost</Badge>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Personalized study pacing and goal suggestions grounded in your real SQLite session logs and quiz records.
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => loadFocusCoachAdvice()}
          disabled={isFocusCoachLoading}
          id="btn-refresh-focus-coach"
        >
          {isFocusCoachLoading ? 'Analyzing...' : 'Refresh Analysis'}
        </Button>
      </div>

      {/* 2. Cold-Start / Summary Banner */}
      {summary?.isColdStart ? (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-bg-subtle)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: 'var(--color-text-primary)' }}>Welcome to StudySync AI!</strong>
          <p style={{ margin: '4px 0 0' }}>
            You have no recorded study sessions yet. The coach has initialized with a standard <strong>25-minute Pomodoro baseline</strong>. As you complete sessions, pause for breaks, and take quizzes, your pacing suggestions will adapt to your authentic habits.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 'var(--space-2)',
          }}
        >
          <div style={{ padding: '8px 12px', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
              {summary?.totalLoggedSessions || 0}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Logged Sessions</div>
          </div>

          <div style={{ padding: '8px 12px', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-accent)' }}>
              {summary?.completionRatePercentage || 0}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Completion Rate</div>
          </div>

          <div style={{ padding: '8px 12px', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
              {summary?.averageRecordedMinutes || 25}m
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Avg Session Length</div>
          </div>

          <div style={{ padding: '8px 12px', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-forest, #10b981)' }}>
              {summary?.averagePausedMinutes || 0}m
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Avg Voluntary Pause</div>
          </div>
        </div>
      )}

      {/* 3. Personalized Pacing & Break Timing Suggestions */}
      {pacing && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          {/* Sprint Pacing */}
          <div
            className="stack-sm"
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div className="row-between" style={{ alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Recommended Sprint Length
              </span>
              <Badge variant="accent">{pacing.recommendedSprintMinutes} Minutes</Badge>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)', margin: '4px 0', lineHeight: 1.5 }}>
              {pacing.sprintReason}
            </p>

            <Button
              variant="outline"
              size="sm"
              id="btn-apply-recommended-sprint"
              onClick={() => handleApplySprint(pacing.recommendedSprintMinutes)}
              style={{ alignSelf: 'flex-start', marginTop: '4px' }}
            >
              {appliedDuration === pacing.recommendedSprintMinutes ? '✓ Sprint Duration Set' : `Start ${pacing.recommendedSprintMinutes}m Recommended Sprint`}
            </Button>
          </div>

          {/* Break Timing */}
          <div
            className="stack-sm"
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div className="row-between" style={{ alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Rest & Recovery Cadence
              </span>
              <Badge variant="neutral">{pacing.recommendedBreakMinutes}m Break / {pacing.recommendedCadenceMinutes}m Study</Badge>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)', margin: '4px 0', lineHeight: 1.5 }}>
              {pacing.breakReason}
            </p>

            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              💡 Regular 5-minute pauses consolidate memory without losing focus context.
            </div>
          </div>
        </div>
      )}

      {/* 4. Adaptive Concrete Study Goals */}
      {goals.length > 0 && (
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          <div className="row-between" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Practical Personalized Study Goals
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Derived from recent quizzes & reflections
            </span>
          </div>

          <div className="stack-sm" style={{ gap: 'var(--space-2)' }}>
            {goals.map((g) => (
              <div
                key={g.id}
                className="row-between"
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                    <Badge variant={g.priority === 'high' ? 'warning' : 'neutral'}>
                      {g.topic}
                    </Badge>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                      {g.goal}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    <strong>Why suggested:</strong> {g.reason}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyGoal(g)}
                >
                  Focus on this Goal &rarr;
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Distraction Insight if present */}
      {distraction && distraction.hasReportedDistractions && (
        <div
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: 'var(--color-text-primary)' }}>🛡️ Self-Reported Interruption Patterns:</strong>
          <p style={{ margin: '2px 0 0' }}>
            {distraction.advice}
          </p>
        </div>
      )}

      {/* 6. Honest Transparent Privacy Disclaimer */}
      <div
        style={{
          borderTop: '1px solid var(--color-border-subtle)',
          paddingTop: 'var(--space-3)',
          fontSize: '11px',
          color: 'var(--color-text-muted)',
          lineHeight: 1.4,
        }}
      >
        🔒 <strong>Honest Analytics Guarantee:</strong> {advice?.disclaimer || 'StudySync AI does not measure or claim to detect your mental focus, concentration level, or psychological state.'} {advice?.privacy_guarantee || 'Zero camera monitoring, keystroke logging, or background surveillance.'}
      </div>
    </Card>
  );
}

export default AIFocusCoachCard;
