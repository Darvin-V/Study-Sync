import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Button, Input } from '../UI';
import { PracticeAssessmentModal } from './PracticeAssessmentModal';

/**
 * State badge helper
 */
function TopicStateBadge({ state, stateLabel }) {
  switch (state) {
    case 'assessed':
      return <Badge variant="accent">✓ {stateLabel || 'Assessed'}</Badge>;
    case 'in_progress':
      return <Badge variant="primary">● {stateLabel || 'In Progress'}</Badge>;
    case 'needs_review':
      return <Badge variant="neutral">⚠️ {stateLabel || 'Needs Review'}</Badge>;
    case 'not_started':
    default:
      return <Badge variant="neutral">⚪ {stateLabel || 'Not Started'}</Badge>;
  }
}

/**
 * Confidence badge helper
 */
function ConfidenceBadge({ level }) {
  if (level === 'confident') {
    return <Badge variant="accent">Confident</Badge>;
  }
  if (level === 'needs_improvement') {
    return <Badge variant="neutral">Needs Help</Badge>;
  }
  if (level === 'neutral') {
    return <Badge variant="neutral">Neutral</Badge>;
  }
  return <Badge variant="neutral">Unspecified</Badge>;
}

export function KnowledgeMap({
  knowledgeMapData,
  isLoading,
  error,
  onRefresh,
  onSubmitAssessment,
  className = '',
  id = 'knowledge-map-component',
}) {
  const navigate = useNavigate();
  const [activeSubject, setActiveSubject] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopicForQuiz, setSelectedTopicForQuiz] = useState(null);
  const [showStateGuide, setShowStateGuide] = useState(false);

  if (isLoading) {
    return (
      <Card id={id} className={`stack ${className}`} style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Loading your personal Knowledge Map and curriculum states...
        </div>
      </Card>
    );
  }

  if (error) {
    const isAuthError =
      typeof error === 'string' &&
      (error.toLowerCase().includes('authentication') ||
        error.toLowerCase().includes('log in') ||
        error.toLowerCase().includes('unauthorized') ||
        error.toLowerCase().includes('token'));

    if (isAuthError) {
      return (
        <Card
          id={id}
          className={`stack ${className}`}
          style={{
            padding: 'var(--space-8) var(--space-6)',
            textAlign: 'center',
            maxWidth: 520,
            margin: 'var(--space-4) auto',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-accent-subtle)',
              color: 'var(--color-accent-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 'var(--space-2)',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
            Sign In to Access Your Knowledge Map
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', maxWidth: 420, margin: 'var(--space-2) 0 var(--space-4)', lineHeight: 1.5 }}>
            Your personal curriculum roadmap tracks mastery across completed study sessions and assessments. Sign in to view and update your topic states.
          </p>
          <div className="row" style={{ justifyContent: 'center', gap: 'var(--space-3)' }}>
            <Button
              variant="primary"
              size="md"
              id="btn-login-km"
              onClick={() => (navigate ? navigate('/login') : (window.location.href = '/login'))}
            >
              Sign In
            </Button>
            {onRefresh && (
              <Button variant="outline" size="md" onClick={onRefresh}>
                Try Again
              </Button>
            )}
          </div>
        </Card>
      );
    }

    return (
      <Card id={id} className={`stack ${className}`} style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>
          Unable to load Knowledge Map
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', marginTop: 4 }}>
          {error}
        </p>
        {onRefresh && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Button variant="secondary" size="sm" onClick={onRefresh}>
              Try Again
            </Button>
          </div>
        )}
      </Card>
    );
  }

  if (!knowledgeMapData || !knowledgeMapData.allTopics || knowledgeMapData.allTopics.length === 0) {
    return (
      <Card id={id} className={`stack ${className}`} style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
          Knowledge Map Empty
        </h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', marginTop: 4 }}>
          No curriculum topics enrolled. Complete your Learning DNA to generate your personalized topic map.
        </p>
      </Card>
    );
  }

  const { allTopics, stateCounts, stateDefinitions, subjects } = knowledgeMapData;

  // Extract distinct subjects
  const subjectList = ['all', ...new Set(allTopics.map((t) => t.subject))];

  // Filter topics
  const filteredTopics = allTopics.filter((t) => {
    const matchesSubject = activeSubject === 'all' || t.subject === activeSubject;
    const matchesSearch =
      !searchQuery.trim() ||
      t.topicName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSubject && matchesSearch;
  });

  return (
    <div id={id} className={`stack ${className}`} style={{ gap: 'var(--space-5)' }}>
      {/* 1. Header with Stats & State Guide Toggle */}
      <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
            Interactive Knowledge Map
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Your honest curriculum roadmap. Topic states are derived directly from real sessions and assessment records.
          </p>
        </div>

        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowStateGuide(!showStateGuide)}
            id="toggle-state-guide-btn"
          >
            {showStateGuide ? 'Hide Definitions' : 'ℹ State Definitions'}
          </Button>
          {onRefresh && (
            <Button variant="secondary" size="sm" onClick={onRefresh}>
              ↻ Refresh
            </Button>
          )}
        </div>
      </div>

      {/* State Overview Summary Bar */}
      <div
        className="row"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-2)',
        }}
      >
        <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
            {stateCounts?.not_started || 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>⚪ Not Started</div>
        </div>

        <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-accent)' }}>
            {stateCounts?.in_progress || 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>● In Progress</div>
        </div>

        <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-warning)' }}>
            {stateCounts?.needs_review || 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>⚠️ Needs Review</div>
        </div>

        <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-accent)' }}>
            {stateCounts?.assessed || 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>✓ Assessed (Exam Passed)</div>
        </div>
      </div>

      {/* State Definitions Callout (Collapsible) */}
      {showStateGuide && stateDefinitions && (
        <Card
          id="state-definitions-guide"
          className="stack"
          style={{
            gap: 'var(--space-2)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            fontSize: 'var(--text-xs)',
          }}
        >
          <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
            Transparent Mastery Criteria
          </strong>
          <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>
              <strong>Assessed:</strong> Requires an actual recorded quiz or exam in StudySync with a passing score (&ge; 70%). Attendance alone never triggers this state.
            </li>
            <li>
              <strong>Needs Review:</strong> Self-reported as difficult in Learning DNA, scored &lt; 70% on an assessment, or studied &gt; 7 days ago without recent practice.
            </li>
            <li>
              <strong>In Progress:</strong> Currently marked as an active study target in preferences or has logged study session attendance with peers.
            </li>
            <li>
              <strong>Not Started:</strong> Available curriculum topic with no study records, preferences, or assessments yet.
            </li>
          </ul>
        </Card>
      )}

      {/* 2. Controls: Subject Filter & Search */}
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
        {/* Subject Filter Tabs */}
        <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {subjectList.map((subj) => (
            <button
              key={subj}
              type="button"
              onClick={() => setActiveSubject(subj)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-xs)',
                fontWeight: activeSubject === subj ? 'var(--font-bold)' : 'var(--font-medium)',
                backgroundColor: activeSubject === subj ? 'var(--color-accent)' : 'var(--color-bg-subtle)',
                color: activeSubject === subj ? '#ffffff' : 'var(--color-text-secondary)',
                border: `1px solid ${activeSubject === subj ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {subj === 'all' ? 'All Subjects' : subj}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ minWidth: 220 }}>
          <Input
            placeholder="Search topic or concept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="map-topic-search-input"
          />
        </div>
      </div>

      {/* 3. Topics Grid */}
      <div
        id="knowledge-map-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {filteredTopics.map((t) => (
          <Card
            key={t.id}
            id={`topic-node-${t.id}`}
            className="stack"
            style={{
              gap: 'var(--space-3)',
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-bg-surface)',
              border: `1px solid ${t.state === 'assessed' ? 'var(--color-accent)' : t.state === 'needs_review' ? 'var(--color-warning)' : 'var(--color-border-subtle)'}`,
              borderRadius: 'var(--radius-lg)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            {/* Card Header: Subject, State & Difficulty */}
            <div className="row-between" style={{ alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t.subject}
              </span>
              <div className="row" style={{ gap: 'var(--space-1)' }}>
                <TopicStateBadge state={t.state} stateLabel={t.stateLabel} />
                <Badge variant="neutral">{t.difficultyLevel}</Badge>
              </div>
            </div>

            {/* Title & Description */}
            <div>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                {t.topicName}
              </h3>
              {t.description && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: '1.4' }}>
                  {t.description}
                </p>
              )}
            </div>

            {/* State Reason Callout */}
            <div
              style={{
                fontSize: '11px',
                color: 'var(--color-text-secondary)',
                backgroundColor: 'var(--color-bg-subtle)',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                borderLeft: `3px solid ${t.state === 'assessed' ? 'var(--color-accent)' : t.state === 'needs_review' ? 'var(--color-warning)' : 'var(--color-border-default)'}`,
              }}
            >
              <strong>Why this state:</strong> {t.stateReason}
            </div>

            {/* Learning DNA Indicators */}
            <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Confidence:</span>
                <ConfidenceBadge level={t.confidenceLevel} />
              </div>

              {t.willingToTeach && (
                <Badge variant="accent">Willing to Teach</Badge>
              )}

              {t.wantsPeerSupport && (
                <Badge variant="neutral">Peer Support Requested</Badge>
              )}
            </div>

            {/* Real Assessment Display (Never fabricated) */}
            <div
              style={{
                fontSize: 'var(--text-xs)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: t.assessment?.hasAssessment ? 'rgba(16, 185, 129, 0.08)' : 'var(--color-bg-subtle)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div className="row-between" style={{ alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Formal Assessment:</span>
                <strong style={{ color: t.assessment?.hasAssessment ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                  {t.assessment?.displayText || 'No formal assessment recorded'}
                </strong>
              </div>
            </div>

            {/* Study Session Activity */}
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {t.studyActivity?.hasStudied ? (
                <span>
                  ⏱️ Attended {t.studyActivity.sessionCount} session(s) ({t.studyActivity.totalAttendanceMinutes} mins total)
                  {t.studyActivity.daysSinceLastStudy !== null && ` • Last active ${t.studyActivity.daysSinceLastStudy}d ago`}
                </span>
              ) : (
                <span>⏱️ No study sessions recorded for this topic yet</span>
              )}
            </div>

            {/* Prerequisites & Dependents Chain */}
            {t.prerequisites && t.prerequisites.length > 0 && (
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                <strong>Prerequisites:</strong>{' '}
                {t.prerequisites.map((p, idx) => (
                  <span key={p.prerequisiteTopicId}>
                    {p.name} {p.isCompleted ? '✓' : '(Pending)'}
                    {idx < t.prerequisites.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            )}

            {/* Card Footer: Actions */}
            <div
              className="row-between"
              style={{
                marginTop: 'auto',
                paddingTop: 'var(--space-2)',
                borderTop: '1px solid var(--color-border-subtle)',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
              }}
            >
              {/* Take Practice Quiz */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedTopicForQuiz(t)}
                id={`quiz-btn-${t.id}`}
              >
                📝 Test Knowledge
              </Button>

              {/* Recommended Action */}
              {t.recommendedAction && (
                <a
                  href={t.recommendedAction.url}
                  style={{ textDecoration: 'none' }}
                >
                  <Button variant="primary" size="sm">
                    {t.recommendedAction.label} &rarr;
                  </Button>
                </a>
              )}
            </div>
          </Card>
        ))}
      </div>

      {filteredTopics.length === 0 && (
        <Card className="stack" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            No topics found matching "{searchQuery}" in {activeSubject === 'all' ? 'any subject' : activeSubject}.
          </p>
        </Card>
      )}

      {/* Interactive Practice Quiz Modal */}
      {selectedTopicForQuiz && (
        <PracticeAssessmentModal
          isOpen={Boolean(selectedTopicForQuiz)}
          onClose={() => setSelectedTopicForQuiz(null)}
          topic={selectedTopicForQuiz}
          onSubmitAssessment={onSubmitAssessment}
        />
      )}
    </div>
  );
}

export default KnowledgeMap;
