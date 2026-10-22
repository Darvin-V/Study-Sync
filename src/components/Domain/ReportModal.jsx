import React, { useState } from 'react';
import { Modal, Button, Select, Avatar } from '../UI';
import apiClient from '../../utils/apiClient';

const REPORT_CATEGORIES = [
  { value: 'harassment', label: 'Harassment or Bullying' },
  { value: 'spam', label: 'Spam or Promotional Activity' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'inappropriate_content', label: 'Inappropriate Content or Language' },
  { value: 'suspicious_behavior', label: 'Suspicious or Harmful Behaviour' },
  { value: 'other', label: 'Other Safety Concern' },
];

export function ReportModal({ isOpen, onClose, targetUser, targetRoomId, targetContentId, onReportSubmitted }) {
  const [category, setCategory] = useState('harassment');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  if (!isOpen) return null;

  const targetId = targetUser ? (targetUser.id || targetUser.studentId) : null;
  const targetName = targetUser ? (targetUser.name || targetUser.displayName || targetUser.studentName || 'Learner') : null;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload = {
        category,
        description: description.trim(),
        reportedUserId: targetId,
        roomId: targetRoomId || null,
        contentId: targetContentId || null,
        contentType: targetId ? 'user' : (targetRoomId ? 'room' : 'other'),
      };

      const res = await apiClient.submitReport(payload);
      if (res.ok && res.data?.success) {
        setSuccessMessage('Thank you. Your report has been securely submitted for moderator review.');
        if (onReportSubmitted) {
          onReportSubmitted(res.data.data);
        }
        setTimeout(() => {
          setSuccessMessage(null);
          setDescription('');
          onClose();
        }, 1800);
      } else {
        const msg = res.data?.error?.message || 'Failed to submit report. Please try again.';
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
      title="Report a Safety Concern"
      id="report-safety-modal"
      maxWidth={520}
      footer={
        <div className="row-between" style={{ width: '100%', gap: 'var(--space-2)' }}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting} id="report-modal-cancel-btn">
            {successMessage ? 'Close' : 'Cancel'}
          </Button>
          {!successMessage && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleSubmit}
              loading={isSubmitting}
              id="report-modal-submit-btn"
            >
              Submit Report
            </Button>
          )}
        </div>
      }
    >
      {successMessage ? (
        <div
          style={{
            padding: 'var(--space-4)',
            textAlign: 'center',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-success)',
          }}
        >
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-success)', marginBottom: 'var(--space-2)' }}>
            Report Submitted
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            {successMessage}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 'var(--space-4)' }}>
          {targetName && (
            <div
              className="row"
              style={{
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: 'var(--color-bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Reporting: <strong style={{ color: 'var(--color-text-primary)' }}>{targetName}</strong>
            </div>
          )}

          <div>
            <label
              htmlFor="report-category-select"
              style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-1)', color: 'var(--color-text-primary)' }}
            >
              Reason for report
            </label>
            <select
              id="report-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {REPORT_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="row-between" style={{ marginBottom: 'var(--space-1)' }}>
              <label
                htmlFor="report-description-input"
                style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)' }}
              >
                Explanation (optional)
              </label>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {description.length} / 1000
              </span>
            </div>
            <textarea
              id="report-description-input"
              rows={4}
              maxLength={1000}
              placeholder="Please provide details about what happened to help our moderation team review this concern objectively..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--text-sm)',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'var(--color-bg-subtle)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              lineHeight: 1.4,
            }}
          >
            🔒 <strong>Confidentiality Guarantee:</strong> Your identity is strictly anonymous and is never revealed to the reported user. Automated safeguards help prevent spam while moderators review flagged interactions.
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
        </form>
      )}
    </Modal>
  );
}

export default ReportModal;
