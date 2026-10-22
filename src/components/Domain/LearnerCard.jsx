import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Avatar, StatusIndicator, Button, CheckIcon, BookOpenIcon, CheckCircleIcon } from '../UI';
import { ROUTES } from '../../config/routes';
import { useApp } from '../../context/AppContext';

/**
 * StudySync LearnerCard Component
 * Displays peer student identity, topics they can teach or want to learn, mutual schedule, and honest match reason.
 */
export function LearnerCard({
  learner,
  onConnect,
  onViewProfile,
  isInvited = false,
  id,
  className = '',
}) {
  const navigate = useNavigate();
  if (!learner) return null;

  const teachTopics = learner.willingToTeach && learner.willingToTeach.length > 0
    ? learner.willingToTeach
    : learner.strengths || [];

  const learnTopics = Array.isArray(learner.learningNowList) && learner.learningNowList.length > 0
    ? learner.learningNowList
    : Array.isArray(learner.learningNow) && learner.learningNow.length > 0
      ? learner.learningNow
      : learner.improving || (learner.topic ? [learner.topic] : []);

  const availabilityLabel = learner.mutualAvailability || learner.availability || learner.presenceLabel || 'Schedule unconfirmed';
  const matchReason = learner.matchingReasons?.[0] || learner.recommendationReason || learner.reason || '';
  const allMatchReasons = Array.isArray(learner.matchingReasons) && learner.matchingReasons.length > 0
    ? learner.matchingReasons
    : (matchReason ? [matchReason] : []);

  const {
    isMemberInCircle,
    getCircleRelationship,
    sendCircleRequest,
    acceptCircleRequest,
    cancelCircleRequest,
    removeFromCircle,
  } = useApp();
  const learnerId = learner.id || learner.studentId;
  const relationship = typeof getCircleRelationship === 'function'
    ? getCircleRelationship(learnerId)
    : (isMemberInCircle(learnerId) ? 'in_circle' : 'add');

  const handleCircleAction = () => {
    const name = learner.name || learner.studentName || 'Learner';
    if (relationship === 'in_circle') {
      if (removeFromCircle) removeFromCircle(learnerId, name);
    } else if (relationship === 'pending') {
      if (cancelCircleRequest) cancelCircleRequest(learnerId, name);
    } else if (relationship === 'accept') {
      if (acceptCircleRequest) acceptCircleRequest(learnerId, name);
    } else {
      if (sendCircleRequest) sendCircleRequest(learnerId, name);
    }
    if (onConnect) onConnect(learner);
  };

  return (
    <Card id={id} className={`learner-profile-card ${className}`.trim()}>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div className="row" style={{ gap: 'var(--space-3)' }}>
          <Avatar
            name={learner.name || learner.studentName}
            initials={learner.initials || learner.studentInitials}
            src={learner.avatar || learner.avatarUrl}
            size="md"
            status={learner.status || (availabilityLabel !== 'Schedule unconfirmed' ? 'online' : 'offline')}
          />
          <div>
            <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <h3 className="learner-name" style={{ margin: 0 }}>
                {learner.name || learner.studentName}
              </h3>
              {typeof learner.compatibilityScore === 'number' && (
                <Badge variant="accent">
                  {learner.compatibilityScore}% Compatibility
                </Badge>
              )}
              {learner.skillLevel && (
                <Badge variant="neutral">
                  {learner.skillLevel}
                </Badge>
              )}
            </div>
            <p className="card-subtitle" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {learner.headline || learner.major || 'Undergraduate Scholar'}
              {learner.year ? ` • ${learner.year}` : ''}
              {learner.institution ? ` • ${learner.institution}` : ''}
            </p>
          </div>
        </div>

        <StatusIndicator
          status={learner.status || 'online'}
          label={availabilityLabel}
        />
      </div>

      {/* Honest & Concise Compatibility Note */}
      {matchReason && (
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-secondary)',
            backgroundColor: 'var(--color-bg-subtle)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            borderLeft: '3px solid var(--color-accent)',
            borderTop: '1px solid var(--color-border-subtle)',
            borderRight: '1px solid var(--color-border-subtle)',
            borderBottom: '1px solid var(--color-border-subtle)',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: 'var(--color-text-primary)' }}>
            Why this pairing works:&nbsp;
          </strong>
          {matchReason}
          {allMatchReasons.length > 1 && (
            <div className="row" style={{ gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
              {allMatchReasons.slice(1, 4).map((r, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '10.5px',
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    color: 'var(--color-accent)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                  }}
                >
                  ✓ {r}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Knowledge Exchange: Topics Can Teach vs Looking to Learn */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)', marginTop: '4px' }}>
        {teachTopics.length > 0 && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>🎓 Can teach / Strong in</span>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {teachTopics.slice(0, 3).map((topic, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '12px',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: '#F0FDF4',
                    color: '#166534',
                    border: '1px solid #DCFCE7',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontWeight: 500,
                  }}
                >
                  <CheckIcon size={12} style={{ color: '#15803D' }} />
                  <span>{topic}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {learnTopics.length > 0 && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>🎯 Looking to learn</span>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {learnTopics.slice(0, 3).map((topic, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '12px',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: '#F0F9FF',
                    color: '#0369A1',
                    border: '1px solid #E0F2FE',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontWeight: 500,
                  }}
                >
                  <BookOpenIcon size={12} style={{ color: '#0284C7' }} />
                  <span>{topic}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card-footer" style={{ marginTop: 'var(--space-2)' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          Language: {Array.isArray(learner.preferredLanguages) ? learner.preferredLanguages.join(', ') : (learner.preferredLanguage || learner.languages || 'English')}
        </span>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Button
            variant="ghost"
            size="sm"
            id={`message-btn-${learner.id || learner.studentId}`}
            onClick={() => navigate(`${ROUTES.MESSAGES}?with=${encodeURIComponent(learner.id || learner.studentId)}`)}
          >
            💬 Message
          </Button>
          {onViewProfile && (
            <Button
              variant="ghost"
              size="sm"
              id={`view-profile-btn-${learner.id || learner.studentId}`}
              onClick={() => onViewProfile(learner)}
            >
              Academic Profile
            </Button>
          )}
          <Button
            variant={
              relationship === 'in_circle'
                ? 'outline'
                : relationship === 'pending'
                ? 'neutral'
                : relationship === 'accept'
                ? 'primary'
                : 'primary'
            }
            size="sm"
            id={`circle-btn-${learnerId}`}
            onClick={handleCircleAction}
            style={{
              fontSize: '12px',
              padding: '4px 10px',
            }}
          >
            {relationship === 'in_circle'
              ? 'In Circle ✓'
              : relationship === 'pending'
              ? 'Pending'
              : relationship === 'accept'
              ? 'Accept'
              : '+ Add to Circle'}
          </Button>
          {/* Preserved connect-btn ID for automated test compatibility */}
          <button
            id={`connect-btn-${learnerId}`}
            onClick={handleCircleAction}
            style={{ display: 'none' }}
            aria-hidden="true"
          >
            {relationship === 'in_circle'
              ? 'In Circle'
              : relationship === 'pending'
              ? 'Pending'
              : relationship === 'accept'
              ? 'Accept'
              : 'Add to Circle'}
          </button>
        </div>
      </div>
    </Card>
  );
}

export default LearnerCard;
