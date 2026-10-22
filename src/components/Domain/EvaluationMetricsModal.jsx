import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge } from '../UI';
import apiClient from '../../utils/apiClient';

/**
 * StudySync AI — Recommendation Evaluation & Personalization Metrics Modal (Phase 4 / Phase 12)
 * 
 * Displays transparent engineering evaluation metrics derived from real database records:
 * - Adaptive Learning: Completion rate, Topics practiced rate, Quiz performance change
 * - Study Partner Matching: Acceptance rate, Successful connection rate, Repeat collaboration rate
 * - Focus Coach: Goal completion rate, Session completion vs historical baseline, Suggestion usefulness rate
 * 
 * Discloses exact formulas, numerators, denominators, small sample size warnings (N < 5),
 * and honest statistical disclosures.
 */
export function EvaluationMetricsModal({ isOpen, onClose }) {
  const [metricsData, setMetricsData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [scope, setScope] = useState('global'); // 'global' or 'user'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadMetrics(scope);
    }
  }, [isOpen, scope]);

  const loadMetrics = async (currentScope = 'global') => {
    setIsLoading(true);
    setError(null);
    try {
      const params = currentScope === 'user' ? { scope: 'user' } : {};
      const res = await apiClient.getFeedbackMetrics(params);
      if (res.data?.success) {
        setMetricsData(res.data.data);
      } else {
        setError(res.data?.error?.message || 'Failed to load evaluation metrics');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to feedback metrics service');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const m = metricsData?.metrics || {};
  const adaptive = m.adaptiveLearning || {};
  const partner = m.studyPartnerMatching || {};
  const focus = m.focusCoach || {};

  const overviewMetrics = [
    { key: 'acceptanceRate', title: 'Recommendation Acceptance Rate', data: m.acceptanceRate, icon: '✓' },
    { key: 'followThroughRate', title: 'Recommendation Follow-Through Rate', data: m.followThroughRate, icon: '⚡' },
    { key: 'peerHelpfulnessRate', title: 'Peer Helpfulness Rate', data: m.peerHelpfulnessRate, icon: '🤝' },
    { key: 'repeatCollaborationRate', title: 'Repeat Collaboration Rate', data: m.repeatCollaborationRate, icon: '🔁' },
    { key: 'relevanceRate', title: 'Topic & Recommendation Relevance', data: m.relevanceRate, icon: '🎯' },
  ];

  const adaptiveMetrics = [
    { key: 'recCompletion', title: 'Recommendation Completion Rate', data: adaptive.recommendationCompletionRate || m.recommendationCompletionRate, icon: '🎯' },
    { key: 'topicsPractice', title: 'Recommended Topics Practice Rate', data: adaptive.recommendedTopicsPracticeRate || m.recommendedTopicsPracticeRate, icon: '📚' },
    { key: 'quizPerformance', title: 'Quiz Performance Change (Repeated Assessments)', data: adaptive.quizPerformanceChange || m.quizPerformanceChange, icon: '📈', isDelta: true },
  ];

  const partnerMetrics = [
    { key: 'partnerAcceptance', title: 'Partner Recommendation Acceptance Rate', data: partner.recommendationAcceptanceRate, icon: '🤝' },
    { key: 'successfulConnection', title: 'Successful Connection or Room Creation Rate', data: partner.successfulConnectionRate || m.successfulConnectionRate, icon: '🚪' },
    { key: 'repeatCollab', title: 'Repeat Collaboration Rate', data: partner.repeatCollaborationRate || m.repeatCollaborationRate, icon: '🔁' },
  ];

  const focusMetrics = [
    { key: 'goalCompletion', title: 'Suggested-Goal Completion Rate', data: focus.suggestedGoalCompletionRate || m.suggestedGoalCompletionRate, icon: '⏱️' },
    { key: 'sessionBaseline', title: 'Session Completion vs Historical Baseline', data: focus.sessionCompletionComparison || m.sessionCompletionComparison, icon: '📊', isBaseline: true },
    { key: 'suggestionUsefulness', title: 'Suggestion Usefulness Rate', data: focus.suggestionUsefulnessRate || m.suggestionUsefulnessRate, icon: '💡' },
  ];

  let displayedMetrics = overviewMetrics;
  if (activeTab === 'adaptive') displayedMetrics = adaptiveMetrics;
  if (activeTab === 'partner') displayedMetrics = partnerMetrics;
  if (activeTab === 'focus') displayedMetrics = focusMetrics;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transparent Recommendation & Feedback Metrics"
      maxWidth="780px"
      footer={
        <div className="row-between" style={{ width: '100%' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Scope: {metricsData?.scope === 'user' ? 'Authenticated Learner (Personal)' : 'Platform-Wide Aggregate'}
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="stack" style={{ gap: 'var(--space-4)' }}>
        {/* Scope Selector & Tab Header */}
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div className="row" style={{ gap: 'var(--space-1)', flexWrap: 'wrap' }}>
            <Button
              variant={activeTab === 'overview' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </Button>
            <Button
              variant={activeTab === 'adaptive' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('adaptive')}
            >
              Adaptive Learning
            </Button>
            <Button
              variant={activeTab === 'partner' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('partner')}
            >
              Partner Matching
            </Button>
            <Button
              variant={activeTab === 'focus' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('focus')}
            >
              Focus Coach
            </Button>
          </div>

          <div className="row" style={{ gap: 'var(--space-1)', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setScope('global')}
              style={{
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: scope === 'global' ? 'var(--color-bg-subtle)' : 'transparent',
                fontWeight: scope === 'global' ? 'var(--font-semibold)' : 'normal',
                cursor: 'pointer',
              }}
            >
              Global Scope
            </button>
            <button
              type="button"
              onClick={() => setScope('user')}
              style={{
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: scope === 'user' ? 'var(--color-bg-subtle)' : 'transparent',
                fontWeight: scope === 'user' ? 'var(--font-semibold)' : 'normal',
                cursor: 'pointer',
              }}
            >
              My History
            </button>
          </div>
        </div>

        {/* Educational Disclaimer Alert */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-bg-subtle)',
            borderLeft: '4px solid var(--color-accent)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: 'var(--color-text-primary)' }}>Important Engineering Disclosure:</strong>{' '}
          {metricsData?.disclaimer ||
            'Session attendance and completion reflect observable participation, not proof of cognitive mastery. Metrics are derived from real database event logs.'}
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              Calculating metrics from database records...
            </span>
          </div>
        ) : error ? (
          <div
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-danger, #ef4444)',
              fontSize: 'var(--text-xs)',
            }}
          >
            {error}
          </div>
        ) : (
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            {displayedMetrics.map(({ key, title, data, icon, isDelta, isBaseline }) => {
              if (!data) return null;
              const isSmallSample = data.isSmallSample;
              return (
                <div
                  key={key}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div className="row-between" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                        <span style={{ fontSize: 'var(--text-base)' }}>{icon}</span>
                        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                          {title}
                        </h4>
                        {isSmallSample && (
                          <Badge variant="warning" style={{ fontSize: '10px' }}>
                            Small Sample (N={data.sampleSize})
                          </Badge>
                        )}
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {data.definition}
                      </p>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '110px' }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: 'var(--text-xl)',
                          fontWeight: 'var(--font-bold)',
                          color: (data.percentage !== null && data.percentage !== undefined) || (data.averageDeltaPercentagePoints !== null && data.averageDeltaPercentagePoints !== undefined) || (data.completionDeltaPercentagePoints !== null && data.completionDeltaPercentagePoints !== undefined)
                            ? 'var(--color-accent)'
                            : 'var(--color-text-muted)',
                        }}
                      >
                        {data.formatted || 'No data'}
                      </div>
                      {data.numerator !== undefined && data.denominator !== undefined && (
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                          {data.numerator} of {data.denominator}
                        </div>
                      )}
                      {isDelta && (
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                          {data.topicsEvaluated || 0} topic(s)
                        </div>
                      )}
                      {isBaseline && data.baselineCompletionRate !== null && data.baselineCompletionRate !== undefined && (
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                          Base: {data.baselineCompletionRate}% → Recent: {data.recentCompletionRate}%
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Formula Breakdown */}
                  <div
                    style={{
                      fontSize: '11px',
                      backgroundColor: 'var(--color-bg-subtle)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'monospace',
                    }}
                  >
                    Formula: {data.formula}
                  </div>

                  {data.explanation && (
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                      {data.explanation}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Assessment Section Note */}
            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-subtle)',
                fontSize: '11px',
                color: 'var(--color-text-muted)',
              }}
            >
              <strong style={{ color: 'var(--color-text-primary)' }}>Assessment Masteries:</strong>{' '}
              Pre/post study assessment comparisons and quiz score deltas are reported only when authentic repeated assessment records exist for the learner.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default EvaluationMetricsModal;
