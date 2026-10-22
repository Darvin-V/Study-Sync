import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select, Badge } from '../UI';

const DEFAULT_COLLAB_STYLES = [
  'Peer discussion & problem solving',
  'Concept exchange & peer teaching',
  'Quiet co-working with periodic Q&A',
  'Structured exam revision & flashcards',
  'Coding pairs & implementation review',
];

export function LearningDNAEditorModal({
  isOpen,
  onClose,
  learningDna,
  availableTopics = [],
  onSave,
}) {
  const [collaborationStyle, setCollaborationStyle] = useState('Peer discussion & problem solving');
  const [preferredStudyTimes, setPreferredStudyTimes] = useState('Weekday evenings');
  const [preferredStudyDuration, setPreferredStudyDuration] = useState(45);
  const [topicPreferences, setTopicPreferences] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [activeTab, setActiveTab] = useState('style'); // 'style' | 'topics'

  // Initialize from existing learning DNA
  useEffect(() => {
    if (learningDna) {
      setCollaborationStyle(learningDna.collaborationStyle || 'Peer discussion & problem solving');
      setPreferredStudyTimes(learningDna.preferredStudyTimes || 'Weekday evenings');
      setPreferredStudyDuration(learningDna.preferredStudyDuration || 45);

      // Map topics from learningDna.allPreferences or initialize from availableTopics
      const existingMap = new Map((learningDna.allPreferences || []).map((p) => [p.topicId, p]));

      const initialTopics = availableTopics.map((t) => {
        const existing = existingMap.get(t.id);
        return {
          topic_id: t.id,
          topic_name: t.topicName || t.name,
          subject: t.subject,
          confidence_level: existing?.confidenceLevel || 'neutral',
          willing_to_teach: Boolean(existing?.willingToTeach),
          wants_peer_support: Boolean(existing?.wantsPeerSupport),
          is_learning_now: existing?.isLearningNow !== undefined ? existing.isLearningNow : true,
          learning_goal: existing?.learningGoal || '',
        };
      });

      setTopicPreferences(initialTopics);
    }
  }, [learningDna, availableTopics]);

  if (!isOpen) return null;

  const handleUpdateTopicField = (topicId, field, value) => {
    setTopicPreferences((prev) =>
      prev.map((t) => {
        if (t.topic_id === topicId) {
          return { ...t, [field]: value };
        }
        return t;
      })
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError('');

    try {
      const payload = {
        collaborationStyle,
        preferredStudyTimes: preferredStudyTimes.trim(),
        preferredStudyDuration: Number(preferredStudyDuration),
        topics: topicPreferences.map((t) => ({
          topic_id: t.topic_id,
          confidence_level: t.confidence_level,
          willing_to_teach: t.willing_to_teach,
          wants_peer_support: t.wants_peer_support,
          is_learning_now: t.is_learning_now,
          learning_goal: t.learning_goal.trim(),
        })),
      };

      const res = await onSave(payload);
      if (res?.success) {
        onClose();
      } else {
        setSaveError(res?.error || 'Failed to save Learning DNA preferences');
      }
    } catch (err) {
      setSaveError(err.message || 'An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Learning DNA Profile"
      size="lg"
    >
      <form onSubmit={handleSave} className="stack" style={{ gap: 'var(--space-4)' }} id="learning-dna-editor-form">
        {saveError && (
          <div style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)', padding: 'var(--space-2)', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)' }}>
            {saveError}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="row" style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)', gap: 'var(--space-2)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('style')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-xs)',
              fontWeight: activeTab === 'style' ? 'var(--font-bold)' : 'var(--font-medium)',
              backgroundColor: activeTab === 'style' ? 'var(--color-accent-subtle)' : 'transparent',
              color: activeTab === 'style' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            1. Collaboration & Availability
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('topics')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-xs)',
              fontWeight: activeTab === 'topics' ? 'var(--font-bold)' : 'var(--font-medium)',
              backgroundColor: activeTab === 'topics' ? 'var(--color-accent-subtle)' : 'transparent',
              color: activeTab === 'topics' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            2. Topic Strengths & Peer Support
          </button>
        </div>

        {/* Tab 1: Collaboration & Availability */}
        {activeTab === 'style' && (
          <div className="stack" style={{ gap: 'var(--space-4)' }}>
            {/* Collaboration Style */}
            <div className="stack" style={{ gap: 6 }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                Preferred Collaboration Style
              </label>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
                <strong>Why we ask:</strong> Matching with peers who share or complement your preferred interaction style creates smoother study sessions and less friction.
              </p>
              <Select
                value={collaborationStyle}
                onChange={(e) => setCollaborationStyle(e.target.value)}
                options={DEFAULT_COLLAB_STYLES.map((s) => ({ value: s, label: s }))}
                id="select-collaboration-style"
              />
            </div>

            {/* Study Availability */}
            <div className="stack" style={{ gap: 6 }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                Preferred Study Times & Schedule
              </label>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
                <strong>Why we ask:</strong> Ensures study recommendations connect you with peers who are active around the same hours.
              </p>
              <Input
                value={preferredStudyTimes}
                onChange={(e) => setPreferredStudyTimes(e.target.value)}
                placeholder="e.g. Weekday evenings (7pm - 10pm) & Sunday mornings"
                id="input-study-times"
              />
            </div>

            {/* Focus Interval */}
            <div className="stack" style={{ gap: 6 }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                Typical Focus Duration (Minutes)
              </label>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
                <strong>Why we ask:</strong> Helps pair you with peers who prefer similar Pomodoro or deep-work interval lengths.
              </p>
              <Select
                value={preferredStudyDuration}
                onChange={(e) => setPreferredStudyDuration(Number(e.target.value))}
                options={[
                  { value: 25, label: '25 minutes (Pomodoro)' },
                  { value: 45, label: '45 minutes (Standard)' },
                  { value: 60, label: '60 minutes (Deep Block)' },
                  { value: 90, label: '90 minutes (Extended Exam Prep)' },
                ]}
                id="select-study-duration"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Topic Strengths & Peer Support */}
        {activeTab === 'topics' && (
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            <div style={{ backgroundColor: 'var(--color-bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              <strong>Why we ask:</strong> Setting your self-reported confidence and specifying where you want help vs where you can teach enables bidirectional peer discovery: pairing those who need help with those eager to explain.
            </div>

            <div className="stack" style={{ gap: 'var(--space-3)', maxHeight: '360px', overflowY: 'auto', paddingRight: 4 }}>
              {topicPreferences.map((t) => (
                <div
                  key={t.topic_id}
                  style={{
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    backgroundColor: 'var(--color-bg-surface)',
                  }}
                  className="stack"
                >
                  <div className="row-between" style={{ alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>
                        {t.topic_name}
                      </strong>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: 6 }}>
                        • {t.subject}
                      </span>
                    </div>

                    <div style={{ minWidth: 140 }}>
                      <Select
                        value={t.confidence_level}
                        onChange={(e) => handleUpdateTopicField(t.topic_id, 'confidence_level', e.target.value)}
                        options={[
                          { value: 'confident', label: '🎯 Confident' },
                          { value: 'neutral', label: '⚖️ Neutral' },
                          { value: 'needs_improvement', label: '⚠️ Needs Help' },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="row" style={{ gap: 'var(--space-4)', marginTop: 4, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={t.willing_to_teach}
                        onChange={(e) => handleUpdateTopicField(t.topic_id, 'willing_to_teach', e.target.checked)}
                      />
                      <span>Willing to teach / explain to peers</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={t.wants_peer_support}
                        onChange={(e) => handleUpdateTopicField(t.topic_id, 'wants_peer_support', e.target.checked)}
                      />
                      <span>Want peer support for this topic</span>
                    </label>
                  </div>

                  <div style={{ marginTop: 4 }}>
                    <Input
                      placeholder="Personal learning goal (e.g. Master 3NF proofs, finish chapter 4)"
                      value={t.learning_goal}
                      onChange={(e) => handleUpdateTopicField(t.topic_id, 'learning_goal', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="row-between" style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Learning DNA'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default LearningDNAEditorModal;
