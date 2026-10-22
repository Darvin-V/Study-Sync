import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Button } from '../UI';
import { useApp } from '../../context/AppContext';
import { ROUTES } from '../../config/routes';

/**
 * StudySync AI — Adaptive Learning Recommendations Card
 * 
 * CORE PRINCIPLES:
 * 1. Uses verified quiz results, completed topics, and explicitly identified weak areas.
 * 2. Suggests revision topics and next sequential learning tasks in curriculum pathways.
 * 3. Explains briefly and honestly why each recommendation was made.
 * 4. Zero fabricated analytics or mock production data.
 * 5. Provides useful empty states for new users who have insufficient history.
 */
export function AdaptiveLearningRecommendationsCard({
  className = '',
  id = 'adaptive-learning-recommendations-card',
}) {
  const navigate = useNavigate();
  const {
    studyRecommendations = [],
    isRecommendationsLoading,
    loadStudyRecommendations,
    dismissRecommendation,
    acceptRecommendation,
    completeRecommendation,
  } = useApp();

  const handleAction = (rec) => {
    if (acceptRecommendation) {
      acceptRecommendation(rec.id, rec.type, rec.targetPeerId || rec.topicId || rec.roomId);
    }

    if (rec.actionUrl) {
      navigate(rec.actionUrl);
    } else if (rec.actionType === 'START_STUDY_SESSION') {
      navigate(`${ROUTES.SESSIONS}?topic=${encodeURIComponent(rec.topic)}`);
    } else if (rec.actionType === 'NAVIGATE_ROOM' && rec.roomId) {
      navigate(`${ROUTES.ROOMS}?room=${rec.roomId}`);
    } else if (rec.actionType === 'VIEW_PEER_PROFILE' && rec.targetPeerId) {
      navigate(`${ROUTES.DISCOVER}?q=${encodeURIComponent(rec.topic)}`);
    } else if (rec.actionType === 'NAVIGATE_KNOWLEDGE_MAP') {
      navigate(ROUTES.KNOWLEDGE_MAP);
    } else {
      navigate(ROUTES.KNOWLEDGE_MAP);
    }
  };

  const getBadgeVariant = (type) => {
    switch (type) {
      case 'next_learning_task':
        return 'success';
      case 'revise_weak_area':
        return 'danger';
      case 'revise_difficult_topic':
        return 'warning';
      case 'unfinished_goal':
        return 'accent';
      case 'practice_quiz':
        return 'neutral';
      case 'peer_help':
        return 'accent';
      case 'revisit_topic':
        return 'neutral';
      default:
        return 'neutral';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'next_learning_task':
        return '🎯 Next Learning Task';
      case 'revise_weak_area':
        return '⚠️ Low Quiz Score';
      case 'revise_difficult_topic':
        return '🚩 Difficult Topic';
      case 'unfinished_goal':
        return '⏳ Unfinished Goal';
      case 'practice_quiz':
        return '📝 Practice Quiz';
      case 'peer_help':
        return '🤝 Peer Collaboration';
      case 'revisit_topic':
        return '🔄 Spaced Recall';
      case 'continue_topic':
        return '📖 Active Topic';
      case 'onboarding_explore':
        return '🚀 Curriculum Onboarding';
      default:
        return '💡 Study Task';
    }
  };

  return (
    <Card id={id} className={`stack ${className}`.trim()} style={{ gap: 'var(--space-4)', padding: 'var(--space-5)' }}>
      {/* Header */}
      <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
              🎯 Adaptive Learning Pathway
            </h3>
            <Badge variant="accent">Quiz & Curriculum Grounded</Badge>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Next steps and revision recommendations derived from your verified quiz scores, completed topics, and weak areas.
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => loadStudyRecommendations && loadStudyRecommendations()}
          disabled={isRecommendationsLoading}
          id="btn-refresh-adaptive-recs"
        >
          {isRecommendationsLoading ? 'Evaluating...' : 'Refresh Pathway'}
        </Button>
      </div>

      {/* Recommendations List */}
      {isRecommendationsLoading && studyRecommendations.length === 0 ? (
        <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
          Evaluating curriculum prerequisites and recent quiz scores...
        </div>
      ) : studyRecommendations.length > 0 ? (
        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          {studyRecommendations.map((rec) => (
            <div
              key={rec.id}
              className="row-between"
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-bg-subtle)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ flex: 1, minWidth: 240 }} className="stack-xs">
                <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge variant={getBadgeVariant(rec.type)}>
                    {getTypeLabel(rec.type)}
                  </Badge>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                    {rec.title}
                  </span>
                </div>

                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                  <strong style={{ color: 'var(--color-text-primary)' }}>Why recommended:</strong> {rec.reason}
                </div>

                {rec.suggestedAction && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)', marginTop: 2, lineHeight: 1.4 }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Suggested action:</span> <span style={{ fontWeight: 500 }}>{rec.suggestedAction}</span>
                  </div>
                )}

                {rec.topic && (
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Topic: <em>{rec.topic}</em> {rec.subject ? `• Subject: ${rec.subject}` : ''}
                  </div>
                )}
              </div>

              <div className="row" style={{ gap: 'var(--space-2)', flexShrink: 0 }}>
                {completeRecommendation && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => completeRecommendation(rec.id, rec.type, rec.targetPeerId || rec.topicId || rec.roomId || rec.targetId || rec.id, rec.trackingId || rec.id)}
                    title="Mark task as completed"
                    style={{ fontSize: '11px', color: 'var(--color-success, #10b981)' }}
                    id={`btn-complete-rec-${rec.id}`}
                  >
                    ✓ Done
                  </Button>
                )}
                {dismissRecommendation && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissRecommendation(rec.id, rec.type, rec.targetPeerId || rec.topicId || rec.roomId || rec.targetId || rec.id, rec.trackingId || rec.id)}
                    title="Dismiss this recommendation"
                    style={{ fontSize: '11px' }}
                    id={`btn-dismiss-rec-${rec.id}`}
                  >
                    Dismiss
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleAction(rec)}
                  style={{ fontSize: '12px' }}
                >
                  {rec.actionLabel || 'Continue Task'} &rarr;
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State for New Users */
        <div
          style={{
            padding: 'var(--space-6) var(--space-4)',
            backgroundColor: 'var(--color-bg-subtle)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            border: '1px solid var(--color-border-subtle)',
          }}
          id="adaptive-recs-empty-state"
        >
          <div style={{ fontSize: '28px', marginBottom: 6 }}>📚</div>
          <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
            No Assessment History Recorded Yet
          </h4>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', maxWidth: 440, margin: '6px auto 14px', lineHeight: 1.5 }}>
            Adaptive recommendations calibrate automatically as you complete curriculum quizzes and flag difficult topics. Take a short practice quiz or select your active topics to begin.
          </p>
          <div className="row" style={{ gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(ROUTES.KNOWLEDGE_MAP)}
              id="btn-empty-take-quiz"
            >
              Take a Practice Quiz &rarr;
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(ROUTES.ONBOARDING)}
              id="btn-empty-set-topics"
            >
              Set Curriculum Topics
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(ROUTES.SESSIONS)}
              id="btn-empty-set-goal"
            >
              Set a Study Goal
            </Button>
          </div>
        </div>
      )}

      {/* Privacy and Methodology Assurance */}
      <div
        style={{
          borderTop: '1px solid var(--color-border-subtle)',
          paddingTop: 'var(--space-2)',
          fontSize: '11px',
          color: 'var(--color-text-muted)',
          lineHeight: 1.4,
        }}
      >
        🔒 <strong>Honest Analytics Guarantee:</strong> Recommendations are derived purely from your SQLite assessment records and curriculum prerequisites. No synthetic scores, simulated attendance, or third-party profiling.
      </div>
    </Card>
  );
}

export default AdaptiveLearningRecommendationsCard;
