import React, { useState } from 'react';
import { Modal, Input, Select, Button } from '../UI';
import { useApp } from '../../context/AppContext';

export function CreateNoteModal({ isOpen, onClose }) {
  const { createNote, rooms } = useApp();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    subject: 'Mathematics',
    topic: '',
    type: 'Lecture Summary',
    visibility: 'public',
    relatedRoomId: '',
    content: '',
  });

  const handleChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const res = await createNote(formData);
      if (res && res.success) {
        setFormData({
          title: '',
          subject: 'Mathematics',
          topic: '',
          type: 'Lecture Summary',
          visibility: 'public',
          relatedRoomId: '',
          content: '',
        });
        onClose();
      } else if (res && res.error) {
        setErrorMessage(res.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const roomOptions = [
    { value: '', label: 'None (Standalone Note)' },
    ...(rooms || []).map((r) => ({
      value: r.id,
      label: `${r.title || r.name || r.room_name} (${r.subject})`,
    })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create & Share Academic Note"
      id="create-note-modal"
      maxWidth={620}
      footer={
        <div className="row-between" style={{ width: '100%' }}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            form="create-note-form"
            disabled={!formData.title.trim() || !formData.content.trim() || isSubmitting}
            id="btn-save-note-submit"
          >
            {isSubmitting ? 'Saving...' : 'Save Note'}
          </Button>
        </div>
      }
    >
      <form id="create-note-form" onSubmit={handleSubmit} className="stack" style={{ gap: 'var(--space-3)' }}>
        {errorMessage && (
          <div style={{ padding: '8px 12px', backgroundColor: 'var(--color-danger-subtle)', color: 'var(--color-danger)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)' }}>
            {errorMessage}
          </div>
        )}

        <Input
          label="Note Title"
          required
          placeholder="e.g. Relational Normalisation 1NF-BCNF Cheatsheet"
          value={formData.title}
          onChange={(e) => handleChange('title', e.target.value)}
          id="input-note-title"
        />

        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <Input
              label="Subject / Domain"
              id="input-note-subject"
              required
              placeholder="e.g. Mathematics, Biology, Economics, Welding..."
              value={formData.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              list="note-subject-suggestions"
              helperText="Type any subject across school, vocational, or higher education."
            />
            <datalist id="note-subject-suggestions">
              <option value="Mathematics" />
              <option value="Science & Biology" />
              <option value="Physics & Chemistry" />
              <option value="Economics & Commerce" />
              <option value="History & Social Studies" />
              <option value="Languages & Literature" />
              <option value="Vocational & Technical Trades" />
              <option value="Medicine & Health Sciences" />
              <option value="Law & Legal Studies" />
              <option value="Engineering & Technology" />
              <option value="Computer Science" />
              <option value="Database Systems" />
            </datalist>
          </div>

          <Input
            label="Topic / Subtopic"
            id="input-note-topic"
            required
            placeholder="e.g. Fractions, Genetics, Econometrics, Normalisation..."
            value={formData.topic}
            onChange={(e) => handleChange('topic', e.target.value)}
          />
        </div>

        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Select
            label="Note Type"
            value={formData.type}
            onChange={(e) => handleChange('type', e.target.value)}
            options={[
              { value: 'Lecture Summary', label: 'Lecture Summary' },
              { value: 'Cheatsheet', label: 'Cheatsheet / Reference' },
              { value: 'Revision Brief', label: 'Revision Brief' },
              { value: 'Worked Examples', label: 'Worked Examples / Proofs' },
            ]}
          />

          <Select
            label="Visibility"
            value={formData.visibility}
            onChange={(e) => handleChange('visibility', e.target.value)}
            options={[
              { value: 'public', label: '🌐 Public (All Learners)' },
              { value: 'room_shared', label: '👥 Room Shared (Room Members Only)' },
              { value: 'private', label: '🔒 Private (Only Me)' },
            ]}
            id="select-note-visibility"
          />
        </div>

        {formData.visibility === 'room_shared' && (
          <Select
            label="Attach to Topic Room"
            value={formData.relatedRoomId}
            onChange={(e) => handleChange('relatedRoomId', e.target.value)}
            options={roomOptions}
            id="select-note-room"
          />
        )}

        <div className="form-group">
          <label className="form-label">Note Content (Markdown supported) *</label>
          <textarea
            className="form-textarea"
            required
            rows={7}
            placeholder="Write clear definitions, key formulas, bulleted breakdown, and worked problems..."
            value={formData.content}
            onChange={(e) => handleChange('content', e.target.value)}
            style={{ minHeight: 140 }}
            id="textarea-note-content"
          />
        </div>
      </form>
    </Modal>
  );
}

export default CreateNoteModal;
