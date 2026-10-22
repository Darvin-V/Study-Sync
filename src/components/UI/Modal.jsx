import React, { useEffect } from 'react';

/**
 * StudySync Modal Component
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {function(): void} props.onClose
 * @param {string} props.title
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.footer]
 * @param {string} [props.id]
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  id = 'modal-dialog',
  maxWidth = 540,
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      id={`${id}-backdrop`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
    >
      <div className="modal-dialog" id={id} style={{ maxWidth }}>
        <div className="modal-header">
          <h2 className="modal-title" id={`${id}-title`}>
            {title}
          </h2>
          <button
            type="button"
            className="btn-icon ghost"
            onClick={onClose}
            aria-label="Close modal"
            id={`${id}-close-btn`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
