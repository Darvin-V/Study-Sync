import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Input, Button } from '../UI';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../config/routes';

/**
 * StudySync CreateRoomModal Component
 * Small, focused form for room name, topic, and visibility.
 */
export function CreateRoomModal({
  isOpen,
  onClose,
  onCreateSuccess,
  id = 'create-room-modal',
}) {
  const navigate = useNavigate();
  const { createRoom } = useApp();
  const { isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    roomName: '',
    topic: '',
    visibility: 'public', // 'public' | 'private'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitDetails, setSubmitDetails] = useState([]);

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSubmitError(null);
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (!formData.roomName.trim() || !formData.topic.trim()) return;

    if (!isAuthenticated) {
      setSubmitError('You must be signed in to create a room. Please sign in first.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitDetails([]);

    const topicTrimmed = formData.topic.trim();
    const res = await createRoom({
      roomName: formData.roomName.trim(),
      topic: topicTrimmed,
      subject: topicTrimmed,
      description: '',
      visibility: formData.visibility,
      status: formData.visibility === 'private' ? 'private' : 'active',
      roomType: formData.visibility === 'private' ? 'private' : 'Learn Together',
      difficulty: 'Intermediate',
      language: 'English',
      maxParticipants: '8',
    });

    setIsSubmitting(false);

    if (res.success && res.room) {
      setFormData({
        roomName: '',
        topic: '',
        visibility: 'public',
      });
      onClose();
      if (onCreateSuccess) onCreateSuccess(res.room);
    } else {
      setSubmitError(res.error || 'Failed to create room. Please review your inputs.');
      if (res.details && Array.isArray(res.details)) {
        setSubmitDetails(res.details);
      }
    }
  }

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Room"
      id={id}
      maxWidth={480}
      footer={
        <div className="row-between" style={{ width: '100%', gap: 'var(--space-3)' }}>
          <Button variant="ghost" size="sm" onClick={onClose} id="modal-cancel-btn" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            form="create-room-form"
            id="modal-submit-btn"
            disabled={isSubmitting || !formData.roomName.trim() || !formData.topic.trim()}
          >
            {isSubmitting ? 'Creating Room...' : 'Create Room'}
          </Button>
        </div>
      }
    >
      <form id="create-room-form" onSubmit={handleSubmit} className="stack" style={{ gap: 'var(--space-4)' }}>
        {!isAuthenticated && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bg-subtle)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
            }}
            className="row-between"
            id="create-room-auth-warning"
          >
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                Sign in required
              </div>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                Please sign in to create and host study rooms.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={() => {
                onClose();
                navigate(ROUTES.LOGIN);
              }}
            >
              Sign In
            </Button>
          </div>
        )}

        {submitError && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              color: '#ef4444',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-xs)',
            }}
            id="create-room-error-alert"
          >
            <strong>Error: </strong> {submitError}
            {submitDetails.length > 0 && (
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {submitDetails.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Input
          label="Room Name"
          id="room-name-input"
          required
          placeholder="e.g. Calculus Midterm Study Group"
          value={formData.roomName}
          onChange={(e) => handleChange('roomName', e.target.value)}
          autoFocus
        />

        <Input
          label="Topic or Subject"
          id="room-topic-input"
          required
          placeholder="e.g. Derivatives, Normalisation, Cell Mitosis..."
          value={formData.topic}
          onChange={(e) => handleChange('topic', e.target.value)}
        />

        {/* Room Visibility */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>
            Room Visibility
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-2)',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-2-5)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: formData.visibility === 'public'
                  ? '2px solid var(--color-primary)'
                  : '1px solid var(--color-border-default)',
                backgroundColor: formData.visibility === 'public'
                  ? 'var(--color-primary-subtle, rgba(10, 102, 194, 0.05))'
                  : 'var(--color-bg-surface)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <input
                type="radio"
                name="room-visibility"
                value="public"
                checked={formData.visibility === 'public'}
                onChange={() => handleChange('visibility', 'public')}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  🌐 Public
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Listed in directory for all learners to join
                </div>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-2-5)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: formData.visibility === 'private'
                  ? '2px solid var(--color-primary)'
                  : '1px solid var(--color-border-default)',
                backgroundColor: formData.visibility === 'private'
                  ? 'var(--color-primary-subtle, rgba(10, 102, 194, 0.05))'
                  : 'var(--color-bg-surface)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <input
                type="radio"
                name="room-visibility"
                value="private"
                checked={formData.visibility === 'private'}
                onChange={() => handleChange('visibility', 'private')}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  🔒 Private
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Only accessible via room code or invite link
                </div>
              </div>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default CreateRoomModal;
