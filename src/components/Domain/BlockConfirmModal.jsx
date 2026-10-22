import React, { useState } from 'react';
import { Modal, Button, Avatar, StatusIndicator } from '../UI';
import apiClient from '../../utils/apiClient';

export function BlockConfirmModal({ isOpen, onClose, targetUser, onBlocked }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!targetUser) return null;

  const targetId = targetUser.id || targetUser.studentId;
  const targetName = targetUser.name || targetUser.displayName || targetUser.studentName || 'this user';

  const handleConfirmBlock = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.blockUser(targetId);
      if (res.ok && res.data?.success) {
        if (onBlocked) onBlocked(targetId, targetName);
        onClose();
      } else {
        const msg = res.data?.error?.message || 'Failed to block user. Please try again.';
        setError(msg);
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Block Learner"
      id="block-confirm-modal"
      maxWidth={480}
      footer={
        <div className="row-between" style={{ width: '100%', gap: 'var(--space-2)' }}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting} id="block-cancel-btn">
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleConfirmBlock}
            loading={isSubmitting}
            id="block-confirm-action-btn"
          >
            Confirm Block
          </Button>
        </div>
      }
    >
      <div className="stack" style={{ gap: 'var(--space-4)' }}>
        <div
          className="row"
          style={{
            gap: 'var(--space-3)',
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-bg-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <Avatar
            name={targetName}
            initials={targetUser.initials || targetUser.studentInitials || 'U'}
            size="md"
          />
          <div>
            <div style={{ fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
              {targetName}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              {targetUser.major || targetUser.headline || 'Peer Learner'}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          <p style={{ marginBottom: 'var(--space-2)' }}>
            Are you sure you want to block <strong>{targetName}</strong>? Here is what happens when you block someone:
          </p>
          <ul style={{ paddingLeft: 'var(--space-4)', margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <li>You will both be excluded from future peer discovery recommendations.</li>
            <li>They cannot send you study invites or 1-on-1 session requests.</li>
            <li>In shared topic rooms, their messages and questions will be masked for you.</li>
            <li>Existing study records and shared resources will remain intact.</li>
            <li>They will not receive any notification that you blocked them.</li>
          </ul>
        </div>

        {error && (
          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--color-danger)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-danger)',
              fontSize: 'var(--text-xs)',
            }}
          >
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default BlockConfirmModal;
