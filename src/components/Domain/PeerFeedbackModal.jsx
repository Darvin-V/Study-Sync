import React, { useState } from 'react';
import { Modal, Button, Badge } from '../UI';
import apiClient from '../../utils/apiClient';

/**
 * StudySync AI — Peer Feedback Modal (Phase 12)
 * 
 * Allows a session participant to submit or update lightweight, optional feedback
 * for a study partner:
 * - Did this peer help with the topic? (was_helpful: 1 / 0)
 * - Would you study with this peer again? (would_study_again: 1 / 0)
 * - Was topic relevance aligned? (1-5 rating or high/low)
 * - Optional private notes (strictly confidential, never public)
 */
export function PeerFeedbackModal({ isOpen, onClose, sessionId, peer, topic, onSubmitted }) {
  const [wasHelpful, setWasHelpful] = useState(1);
  const [wouldStudyAgain, setWouldStudyAgain] = useState(1);
  const [topicRelevance, setTopicRelevance] = useState(5);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  if (!isOpen || !peer) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      let res;
      if (sessionId) {
        res = await apiClient.submitSessionPeerFeedback(sessionId, {
          targetPeerId: peer.user_id || peer.id,
          wasHelpful,
          wouldStudyAgain,
          topicRelevance,
          feedbackNotes: feedbackNotes.trim() || null,
        });
      } else {
        res = await apiClient.submitPeerFeedback({
          targetPeerId: peer.user_id || peer.id,
          wasHelpful,
          wouldStudyAgain,
          topicRelevance,
          feedbackNotes: feedbackNotes.trim() || null,
        });
      }

      if (res.data?.success) {
        setStatusMessage('Feedback submitted successfully. Thank you!');
        if (onSubmitted) onSubmitted(res.data.data);
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        setErrorMessage(res.data?.error?.message || 'Failed to submit peer feedback');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error submitting feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Peer Collaboration Feedback: ${peer.display_name || peer.name}`}
      maxWidth="540px"
      footer={
        <div className="row-between" style={{ width: '100%' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            🔒 Private & Confidential
          </span>
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Skip
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting}
              id="submit-peer-feedback-btn"
            >
              {isSubmitting ? 'Saving...' : 'Save Feedback'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="stack" style={{ gap: 'var(--space-4)' }}>
        {/* Intro */}
        <div
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-bg-subtle)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border-subtle)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-secondary)',
          }}
        >
          Your honest review helps StudySync AI adjust recommendation rankings. Your ratings and private notes are
          <strong style={{ color: 'var(--color-text-primary)' }}> never displayed publicly</strong> to other students.
        </div>

        {errorMessage && (
          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-danger, #ef4444)',
              fontSize: 'var(--text-xs)',
            }}
          >
            {errorMessage}
          </div>
        )}

        {statusMessage && (
          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-success, #10b981)',
              fontSize: 'var(--text-xs)',
            }}
          >
            {statusMessage}
          </div>
        )}

        {/* Question 1: Was this peer helpful? */}
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)', display: 'block', marginBottom: 6 }}>
            Did {peer.display_name || 'this peer'} help with {topic ? `"${topic}"` : 'the topic'}?
          </label>
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <Button
              type="button"
              variant={wasHelpful === 1 ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setWasHelpful(1)}
            >
              👍 Yes, Helpful
            </Button>
            <Button
              type="button"
              variant={wasHelpful === 0 ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setWasHelpful(0)}
            >
              👎 Needs Improvement
            </Button>
          </div>
        </div>

        {/* Question 2: Would you study with this peer again? */}
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)', display: 'block', marginBottom: 6 }}>
            Would you study with {peer.display_name || 'this peer'} again in the future?
          </label>
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <Button
              type="button"
              variant={wouldStudyAgain === 1 ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setWouldStudyAgain(1)}
            >
              🔁 Yes, Prefer Repeat Study
            </Button>
            <Button
              type="button"
              variant={wouldStudyAgain === 0 ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setWouldStudyAgain(0)}
            >
              Prefer Different Peers
            </Button>
          </div>
        </div>

        {/* Question 3: Topic Alignment */}
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)', display: 'block', marginBottom: 6 }}>
            Topic Relevance & Focus Alignment (1–5)
          </label>
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            {[1, 2, 3, 4, 5].map((num) => (
              <Button
                key={num}
                type="button"
                variant={topicRelevance === num ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setTopicRelevance(num)}
                style={{ minWidth: '40px' }}
              >
                {num}★
              </Button>
            ))}
          </div>
        </div>

        {/* Optional Private Notes */}
        <div>
          <label htmlFor="peer-feedback-notes" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
            Confidential Notes for Yourself (Optional)
          </label>
          <textarea
            id="peer-feedback-notes"
            className="form-textarea"
            value={feedbackNotes}
            onChange={(e) => setFeedbackNotes(e.target.value)}
            placeholder="e.g. Good explanations on query trees, quiet study style..."
            style={{ fontSize: 'var(--text-xs)', minHeight: 60 }}
          />
        </div>
      </form>
    </Modal>
  );
}

export default PeerFeedbackModal;
