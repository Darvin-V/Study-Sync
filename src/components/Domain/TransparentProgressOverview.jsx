import React from 'react';
import { Card, Badge } from '../UI';

/**
 * StudySync AI — Transparent Progress Overview (Phase 10)
 * 
 * Separates progress signals into honest, distinct dimensions:
 * 1. Self-Reported Confidence (comfort level chosen by learner)
 * 2. Study Session Attendance (participation time, not comprehension)
 * 3. Verified Assessments (formal quiz/exam scores, never fabricated)
 * 4. Peer Knowledge Exchange (active contributions in Topic Rooms)
 * 
 * Never collapses metrics into a misleading single "mastery score".
 */
export function TransparentProgressOverview({ progress, className = '', id = 'transparent-progress-overview' }) {
  if (!progress) {
    return (
      <Card id={id} className={`stack ${className}`} style={{ gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-4)' }}>
          No progress data available yet. Configure your Learning DNA or participate in study sessions to track your learning journey.
        </div>
      </Card>
    );
  }

  const { selfReportedConfidence, verifiedAssessments, studyActivity, knowledgeExchange } = progress;

  return (
    <div id={id} className={`stack ${className}`} style={{ gap: 'var(--space-4)' }}>
      <div className="row-between" style={{ alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
            Transparent Progress Signals
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Honest learning metrics separated by data source. Session duration is never claimed as proof of mastery.
          </p>
        </div>
        <Badge variant="accent">Verified Progress Signals</Badge>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        {/* Signal 1: Self-Reported Confidence */}
        <Card
          id="signal-self-confidence"
          className="stack"
          style={{
            gap: 'var(--space-2)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div className="row-between" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Self-Reported Confidence
            </span>
            <span style={{ fontSize: '18px' }}>🎯</span>
          </div>

          <div className="row" style={{ alignItems: 'baseline', gap: 'var(--space-2)', margin: 'var(--space-1) 0' }}>
            <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
              {selfReportedConfidence?.confidentCount || 0}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              confident topics
            </span>
          </div>

          <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Badge variant="neutral">
              {selfReportedConfidence?.needsImprovementCount || 0} needs help
            </Badge>
            {selfReportedConfidence?.willingToTeachCount > 0 && (
              <Badge variant="accent">
                {selfReportedConfidence.willingToTeachCount} willing to teach
              </Badge>
            )}
          </div>

          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-2)', lineHeight: '1.4' }}>
            {selfReportedConfidence?.explanation || 'Subjective comfort level set in your Learning DNA; reflects confidence, not verified exam results.'}
          </p>
        </Card>

        {/* Signal 2: Verified Formal Assessments */}
        <Card
          id="signal-verified-assessments"
          className="stack"
          style={{
            gap: 'var(--space-2)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div className="row-between" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Verified Assessments
            </span>
            <span style={{ fontSize: '18px' }}>📝</span>
          </div>

          <div className="row" style={{ alignItems: 'baseline', gap: 'var(--space-2)', margin: 'var(--space-1) 0' }}>
            <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: verifiedAssessments?.hasAssessments ? 'var(--color-accent)' : 'var(--color-text-primary)' }}>
              {verifiedAssessments?.hasAssessments ? `${verifiedAssessments.averageScorePercentage}%` : '0'}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {verifiedAssessments?.hasAssessments ? 'average quiz score' : 'assessments recorded'}
            </span>
          </div>

          <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {verifiedAssessments?.hasAssessments ? (
              <Badge variant="accent">
                {verifiedAssessments.passedAssessmentsCount} of {verifiedAssessments.totalAssessmentsTaken} passed
              </Badge>
            ) : (
              <Badge variant="neutral">
                No formal tests taken
              </Badge>
            )}
          </div>

          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-2)', lineHeight: '1.4' }}>
            {verifiedAssessments?.explanation || 'Recorded scores from quizzes and exams. Unassessed topics are clearly noted without guessing.'}
          </p>
        </Card>

        {/* Signal 3: Study Session Attendance */}
        <Card
          id="signal-study-attendance"
          className="stack"
          style={{
            gap: 'var(--space-2)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div className="row-between" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Study Participation
            </span>
            <span style={{ fontSize: '18px' }}>⏱️</span>
          </div>

          <div className="row" style={{ alignItems: 'baseline', gap: 'var(--space-2)', margin: 'var(--space-1) 0' }}>
            <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
              {studyActivity?.totalAttendedHours || 0}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              hours attended
            </span>
          </div>

          <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Badge variant="neutral">
              {studyActivity?.completedSessionsCount || 0} sessions joined
            </Badge>
            {studyActivity?.recentSessionCountLast7Days > 0 && (
              <Badge variant="accent">
                {studyActivity.recentSessionCountLast7Days} in last 7 days
              </Badge>
            )}
          </div>

          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-2)', lineHeight: '1.4' }}>
            {studyActivity?.explanation || 'Measures actual attendance time in collaborative sessions. Time spent is participation, not proof of comprehension.'}
          </p>
        </Card>

        {/* Signal 4: Peer Knowledge Contributions */}
        <Card
          id="signal-peer-exchange"
          className="stack"
          style={{
            gap: 'var(--space-2)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div className="row-between" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Peer Knowledge Exchange
            </span>
            <span style={{ fontSize: '18px' }}>🤝</span>
          </div>

          <div className="row" style={{ alignItems: 'baseline', gap: 'var(--space-2)', margin: 'var(--space-1) 0' }}>
            <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
              {knowledgeExchange?.notesCreatedCount || 0}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              notes shared
            </span>
          </div>

          <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Badge variant="neutral">
              {knowledgeExchange?.questionsAskedCount || 0} questions asked
            </Badge>
            <Badge variant="neutral">
              {knowledgeExchange?.questionsResolvedCount || 0} doubts resolved
            </Badge>
          </div>

          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-2)', lineHeight: '1.4' }}>
            {knowledgeExchange?.explanation || 'Active community contributions: shared summaries, doubts asked, and peer solutions.'}
          </p>
        </Card>
      </div>
    </div>
  );
}

export default TransparentProgressOverview;
