import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge } from '../UI';

export function BreakReminderModal({
  isOpen,
  onClose,
  topic = 'Current Topic',
  breakDurationMinutes = 5,
  onStartNextSprint,
}) {
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(breakDurationMinutes * 60);
  const [isBreakRunning, setIsBreakRunning] = useState(false);

  useEffect(() => {
    setBreakSecondsLeft(breakDurationMinutes * 60);
    setIsBreakRunning(false);
  }, [breakDurationMinutes, isOpen]);

  useEffect(() => {
    let timer = null;
    if (isBreakRunning && breakSecondsLeft > 0) {
      timer = setInterval(() => {
        setBreakSecondsLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isBreakRunning, breakSecondsLeft]);

  if (!isOpen) return null;

  const mins = Math.floor(breakSecondsLeft / 60);
  const secs = breakSecondsLeft % 60;
  const formattedTimer = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🌱 Focus Interval Completed — Time for a Break"
      id="break-reminder-modal"
    >
      <div className="stack" style={{ gap: 'var(--space-4)', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', lineHeight: 1 }}>🧘</div>

        <div className="stack-xs">
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
            Well Done! Focus Sprint Completed
          </h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            You completed a dedicated sprint on <strong>{topic}</strong>.
          </p>
        </div>

        {/* Break Recommendations Card */}
        <div
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-bg-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
            textAlign: 'left',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-secondary)',
            lineHeight: 'var(--leading-relaxed)',
          }}
        >
          <strong style={{ color: 'var(--color-text-primary)' }}>Recommended Break Actions:</strong>
          <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
            <li>Rest your eyes: Look at an object 20 feet away for 20 seconds.</li>
            <li>Stand up, stretch your back, neck, and shoulders.</li>
            <li>Hydrate with a glass of water.</li>
            <li>Avoid switching immediately to other high-stimulation screen tabs.</li>
          </ul>
        </div>

        {/* Break Timer Display */}
        {isBreakRunning ? (
          <div className="stack-xs" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Break Countdown
            </span>
            <div
              style={{
                fontSize: 'var(--text-3xl)',
                fontWeight: 'var(--font-bold)',
                fontFamily: 'monospace',
                color: 'var(--color-accent)',
              }}
            >
              {formattedTimer}
            </div>
            {breakSecondsLeft === 0 && (
              <Badge variant="success" style={{ marginTop: 4 }}>
                Break complete! Ready for your next focus sprint.
              </Badge>
            )}
          </div>
        ) : (
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBreakRunning(true)}
              id="start-break-timer-btn"
            >
              ⏱️ Start {breakDurationMinutes}-Minute Break Countdown
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="row-between" style={{ marginTop: 'var(--space-2)' }}>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            Done for Now
          </Button>

          {onStartNextSprint && (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                onClose();
                onStartNextSprint();
              }}
              id="start-next-sprint-btn"
            >
              Start Next Focus Sprint &rarr;
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default BreakReminderModal;
