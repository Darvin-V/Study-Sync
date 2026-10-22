import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Badge, Button, Avatar, Divider } from '../UI';
import { ROUTES } from '../../config/routes';

export function NoteDetailModal({ note, isOpen, onClose }) {
  const navigate = useNavigate();
  if (!note) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={note.title}
      id="note-detail-modal"
      maxWidth={680}
      footer={
        <div className="row-between" style={{ width: '100%' }}>
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            {note.relatedRoomId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  navigate(`${ROUTES.ROOMS}?room=${note.relatedRoomId}`);
                }}
              >
                Open Related Room
              </Button>
            )}
            {note.relatedSessionId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  navigate(ROUTES.SESSIONS);
                }}
              >
                Open Related Session
              </Button>
            )}
          </div>
          <Button variant="primary" size="sm" onClick={onClose}>
            Done Reading
          </Button>
        </div>
      }
    >
      <div className="stack" style={{ gap: 'var(--space-4)' }}>
        {/* Note Metadata Header */}
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <Avatar name={note.author} initials={note.authorInitials} size="sm" />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              Authored by <strong style={{ color: 'var(--color-text-primary)' }}>{note.author}</strong> &bull; {note.updatedAt || 'Recent'}
            </span>
          </div>

          <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
            <Badge variant="accent">{note.subject}</Badge>
            <Badge variant="neutral">{note.type || note.resource_type || 'Lecture Summary'}</Badge>
            {note.visibility && (
              <Badge variant={note.visibility === 'private' ? 'warning' : note.visibility === 'room_shared' ? 'accent' : 'neutral'}>
                {note.visibility === 'private' ? '🔒 Private' : note.visibility === 'room_shared' ? '👥 Room Shared' : '🌐 Public'}
              </Badge>
            )}
          </div>
        </div>

        {note.url && (
          <div style={{ fontSize: 'var(--text-xs)', padding: '6px 12px', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Resource Link: </span>
            <a href={note.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
              {note.url} ↗
            </a>
          </div>
        )}

        <Divider style={{ margin: 0 }} />

        {/* Note Content */}
        <div
          style={{
            fontSize: 'var(--text-sm)',
            lineHeight: '1.7',
            color: 'var(--color-text-primary)',
            backgroundColor: 'var(--color-bg-subtle)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-sans)',
            maxHeight: '440px',
            overflowY: 'auto',
          }}
        >
          {note.content || note.excerpt}
        </div>
      </div>
    </Modal>
  );
}

export default NoteDetailModal;
