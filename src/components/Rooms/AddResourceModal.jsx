import React, { useState } from 'react';
import { Modal, Input, Select, Button } from '../UI';
import { useApp } from '../../context/AppContext';

export function AddResourceModal({ room, isOpen, onClose }) {
  const { addRoomResource } = useApp();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    type: 'Cheat Sheet',
    topic: room?.topic || '',
    url: '',
    description: '',
  });

  const handleChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const res = await addRoomResource(room.id, formData);
      if (res && res.success) {
        setFormData({
          title: '',
          type: 'Cheat Sheet',
          topic: room?.topic || '',
          url: '',
          description: '',
        });
        onClose();
      } else if (res && res.error) {
        setErrorMessage(res.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!room) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Share Learning Resource — ${room.title || room.name || room.room_name}`}
      id="add-resource-modal"
      maxWidth={540}
      footer={
        <div className="row-between" style={{ width: '100%' }}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            form="add-resource-form"
            disabled={!formData.title.trim() || isSubmitting}
            id="btn-share-resource-submit"
          >
            {isSubmitting ? 'Sharing...' : 'Share Resource'}
          </Button>
        </div>
      }
    >
      <form id="add-resource-form" onSubmit={handleSubmit} className="stack" style={{ gap: 'var(--space-3)' }}>
        {errorMessage && (
          <div style={{ padding: '8px 12px', backgroundColor: 'var(--color-danger-subtle)', color: 'var(--color-danger)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)' }}>
            {errorMessage}
          </div>
        )}

        <Input
          label="Resource Title"
          id="res-title-input"
          required
          placeholder="e.g. 3NF Decomposition Practice Set & Solutions"
          value={formData.title}
          onChange={(e) => handleChange('title', e.target.value)}
        />

        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Select
            label="Resource Type"
            id="res-type-select"
            value={formData.type}
            onChange={(e) => handleChange('type', e.target.value)}
            options={[
              { value: 'Cheat Sheet', label: 'Cheat Sheet' },
              { value: 'Note', label: 'Academic Note' },
              { value: 'PDF', label: 'Course PDF / Slides' },
              { value: 'Question Set', label: 'Question Set' },
              { value: 'Link', label: 'Web Reference Link' },
            ]}
          />

          <Input
            label="Specific Topic"
            id="res-topic-input"
            placeholder="e.g. 3NF Synthesis"
            value={formData.topic}
            onChange={(e) => handleChange('topic', e.target.value)}
          />
        </div>

        <Input
          label="External Resource Link / URL (Optional)"
          id="res-url-input"
          placeholder="e.g. https://course.edu/dbms/3nf-practice.pdf"
          value={formData.url}
          onChange={(e) => handleChange('url', e.target.value)}
        />

        <div className="form-group">
          <label htmlFor="res-desc-input" className="form-label">
            Description / Summary
          </label>
          <textarea
            id="res-desc-input"
            className="form-textarea"
            placeholder="Brief overview of formulas, problems covered, or notes highlights..."
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            style={{ fontSize: 'var(--text-xs)', minHeight: 70 }}
          />
        </div>
      </form>
    </Modal>
  );
}

export default AddResourceModal;
