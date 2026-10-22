import React, { useState } from 'react';
import { Modal, Button } from '../UI';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

/**
 * StudySync CreateSessionModal Component (Phase 7)
 * Creates a persistent study session in the SQLite database with
 * server-verified creator identity and auto-enrollment.
 */
export function CreateSessionModal({
  isOpen,
  onClose,
  initialRoom = null,
  initialTopic = '',
  initialSubject = '',
  initialPartnerName = '',
  initialDescription = '',
}) {
  const { createStudySession, rooms } = useApp();
  const { isAuthenticated } = useAuth();

  const [topic, setTopic] = useState(initialTopic || initialRoom?.topic || '');
  const [subject, setSubject] = useState(initialSubject || initialRoom?.subject || 'Computer Science');
  const [title, setTitle] = useState(
    initialPartnerName && (initialTopic || initialRoom?.topic)
      ? `${initialTopic || initialRoom?.topic} with ${initialPartnerName}`
      : initialRoom ? `${initialRoom.topic} Study Block` : initialTopic ? `${initialTopic} Study Block` : ''
  );
  const [description, setDescription] = useState(
    initialDescription || (initialPartnerName ? `Co-studying session with ${initialPartnerName}.` : '')
  );
  const [plannedDuration, setPlannedDuration] = useState('45');
  const [selectedRoomId, setSelectedRoomId] = useState(initialRoom?.id || '');
  const [startNow, setStartNow] = useState(true);

  React.useEffect(() => {
    if (isOpen) {
      if (initialTopic) setTopic(initialTopic);
      else if (initialRoom?.topic) setTopic(initialRoom.topic);

      if (initialSubject) setSubject(initialSubject);
      else if (initialRoom?.subject) setSubject(initialRoom.subject);

      if (initialPartnerName && (initialTopic || initialRoom?.topic)) {
        setTitle(`${initialTopic || initialRoom?.topic} with ${initialPartnerName}`);
        setDescription(`Co-studying session with ${initialPartnerName}.`);
      } else if (initialRoom?.topic) {
        setTitle(`${initialRoom.topic} Study Block`);
      } else if (initialTopic) {
        setTitle(`${initialTopic} Study Block`);
      }

      if (initialRoom?.id) setSelectedRoomId(initialRoom.id);
    }
  }, [isOpen, initialTopic, initialSubject, initialPartnerName, initialRoom]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setErrorBanner('Please sign in to create a study session');
      return;
    }

    if (!topic.trim()) {
      setErrorBanner('Session topic is required');
      return;
    }

    setIsSubmitting(true);
    setErrorBanner(null);

    try {
      const res = await createStudySession({
        topic: topic.trim(),
        subject: subject.trim(),
        title: title.trim() || `${topic.trim()} Focus Session`,
        description: description.trim(),
        plannedDuration: parseInt(plannedDuration, 10),
        roomId: selectedRoomId || null,
        startNow,
      });

      if (res.success) {
        onClose();
        // Reset state
        setTopic('');
        setTitle('');
        setDescription('');
      } else {
        setErrorBanner(res.error || 'Failed to create study session');
      }
    } catch (err) {
      setErrorBanner(err.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Study Session"
      id="create-session-modal"
      maxWidth={520}
      footer={
        <div className="row-between" style={{ width: '100%' }}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            id="submit-create-session-btn"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : startNow ? 'Start Live Focus Block' : 'Schedule Session'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="stack" style={{ gap: 'var(--space-3)' }}>
        {errorBanner && (
          <div
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-danger, #ef4444)',
              fontSize: 'var(--text-xs)',
            }}
          >
            {errorBanner}
          </div>
        )}

        <div>
          <label htmlFor="session-topic-input" className="form-label" style={{ fontSize: 'var(--text-xs)' }}>
            Topic Name *
          </label>
          <input
            id="session-topic-input"
            type="text"
            className="form-input"
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              if (!title) setTitle(`${e.target.value} Study Block`);
            }}
            placeholder="e.g. Distributed Consensus & Raft Protocol"
            required
            style={{ fontSize: 'var(--text-xs)' }}
          />
        </div>

        <div className="row" style={{ gap: 'var(--space-3)' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="session-subject-input" className="form-label" style={{ fontSize: 'var(--text-xs)' }}>
              Subject
            </label>
            <input
              id="session-subject-input"
              type="text"
              className="form-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Operating Systems"
              style={{ fontSize: 'var(--text-xs)' }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label htmlFor="session-duration-select" className="form-label" style={{ fontSize: 'var(--text-xs)' }}>
              Planned Duration
            </label>
            <select
              id="session-duration-select"
              className="form-select"
              value={plannedDuration}
              onChange={(e) => setPlannedDuration(e.target.value)}
              style={{ fontSize: 'var(--text-xs)' }}
            >
              <option value="25">25 mins (Pomodoro)</option>
              <option value="45">45 mins (Standard)</option>
              <option value="60">60 mins (Intensive)</option>
              <option value="90">90 mins (Deep Work)</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="session-room-select" className="form-label" style={{ fontSize: 'var(--text-xs)' }}>
            Associated Topic Room (Optional)
          </label>
          <select
            id="session-room-select"
            className="form-select"
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            style={{ fontSize: 'var(--text-xs)' }}
          >
            <option value="">No linked room (Standalone session)</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.room_name || r.title || r.name} ({r.subject})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="session-desc-input" className="form-label" style={{ fontSize: 'var(--text-xs)' }}>
            Session Goal & Description
          </label>
          <textarea
            id="session-desc-input"
            className="form-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What will you focus on during this block?"
            style={{ fontSize: 'var(--text-xs)', minHeight: 60 }}
          />
        </div>

        <div className="row" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
          <input
            id="session-start-now-checkbox"
            type="checkbox"
            checked={startNow}
            onChange={(e) => setStartNow(e.target.checked)}
            style={{ accentColor: 'var(--color-accent)' }}
          />
          <label htmlFor="session-start-now-checkbox" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            Start immediately as active live focus block
          </label>
        </div>
      </form>
    </Modal>
  );
}

export default CreateSessionModal;
