import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button } from '../UI';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../config/routes';

/**
 * StudySync JoinWithCodeModal Component
 * Multiplayer-game inspired direct join dialog using unique human-readable room code.
 */
export function JoinWithCodeModal({ isOpen, onClose, onJoinSuccess, initialCode = '' }) {
  const { joinRoomByCode } = useApp();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [code, setCode] = useState(initialCode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setCode(initialCode || '');
      setErrorMessage('');
      setIsSubmitting(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initialCode]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanCode) {
      setErrorMessage('Please enter a room code.');
      inputRef.current?.focus();
      return;
    }

    if (!isAuthenticated) {
      onClose();
      navigate(ROUTES.LOGIN, {
        state: { from: { pathname: ROUTES.ROOMS, search: `?code=${cleanCode}` } },
      });
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await joinRoomByCode(cleanCode);
      if (res && res.success && res.room) {
        onClose();
        if (onJoinSuccess) {
          onJoinSuccess(res.room);
        }
      } else {
        const errorText = res?.error || 'Unable to join room. Please check the code and try again.';
        setErrorMessage(errorText);
      }
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred while connecting to the room.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Join Study Room with Code"
      id="join-with-code-modal"
      maxWidth={460}
      footer={
        <div className="row-between" style={{ width: '100%', gap: 'var(--space-3)' }}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting} id="btn-cancel-join-code">
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            form="join-room-code-form"
            disabled={!code.trim() || isSubmitting}
            id="btn-submit-join-room-code"
          >
            {isSubmitting ? 'Joining Room...' : 'Join Room'}
          </Button>
        </div>
      }
    >
      <form id="join-room-code-form" onSubmit={handleSubmit} className="stack" style={{ gap: 'var(--space-4)' }}>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
          Enter the room code shared by your study partner or host (e.g., <strong style={{ color: 'var(--color-text-primary)' }}>BIO-7K2P</strong> or <strong style={{ color: 'var(--color-text-primary)' }}>DBMS-4X9M</strong>).
        </p>

        {errorMessage && (
          <div
            id="join-code-error-alert"
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#dc2626',
              fontSize: 'var(--text-xs)',
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
            }}
          >
            <span style={{ fontWeight: 'bold', fontSize: '14px', lineHeight: 1 }}>!</span>
            <div style={{ flex: 1 }}>{errorMessage}</div>
          </div>
        )}

        <div className="form-group" style={{ margin: 0 }}>
          <label htmlFor="input-join-room-code" className="form-label" style={{ fontWeight: 600 }}>
            Room Code
          </label>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              id="input-join-room-code"
              name="roomCode"
              type="text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setErrorMessage('');
              }}
              placeholder="e.g. BIO-7K2P"
              disabled={isSubmitting}
              className="form-input"
              style={{
                fontFamily: 'monospace',
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                padding: '12px 14px',
                textAlign: 'center',
                backgroundColor: 'var(--color-bg-subtle)',
              }}
            />
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 4, display: 'block', textAlign: 'center' }}>
            Codes are case-insensitive and ignore spaces
          </span>
        </div>
      </form>
    </Modal>
  );
}

export default JoinWithCodeModal;
