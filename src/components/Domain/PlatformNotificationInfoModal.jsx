import React from 'react';
import { Modal, Button, Badge } from '../UI';

/**
 * StudySync AI — Platform Notification Capabilities & Limitations Modal
 * 
 * CORE HONESTY PRINCIPLES:
 * 1. Clearly explains browser and Android notification limitations.
 * 2. Documents Android Capacitor/native Do Not Disturb requirements (ACCESS_NOTIFICATION_POLICY).
 * 3. Never claims fake controls or background system alteration without explicit consent.
 */
export function PlatformNotificationInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Platform Capabilities & Notification Limitations"
      id="platform-notification-info-modal"
      maxWidth={600}
      footer={
        <Button variant="primary" size="sm" onClick={onClose} id="close-platform-info-btn">
          Got It
        </Button>
      }
    >
      <div className="stack" style={{ gap: 'var(--space-4)' }}>
        {/* Banner */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-xs)',
            lineHeight: 1.5,
            color: 'var(--color-text-secondary)',
          }}
        >
          <strong style={{ color: 'var(--color-text-primary)', display: 'block', marginBottom: 2 }}>
            🛡️ Honest Capability Guarantee:
          </strong>
          StudySync AI believes in 100% transparency. We never provide misleading toggles that claim to control your device operating system when platform security models prohibit it.
        </div>

        {/* Section 1: StudySync In-App Distraction Shield */}
        <div
          className="stack-xs"
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div className="row-between" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
              1. StudySync In-App Notification Shield
            </span>
            <Badge variant="accent">Fully Supported</Badge>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
            <strong>What is controlled:</strong> During active focus sprints, StudySync suppresses in-app peer study invitations, room question buzzes, audio chimes, and nonessential UI popups. You can pause or resume this suppression at any time using the in-session shield toggle.
          </p>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
            * Critical account notices and security alerts are never silenced.
          </p>
        </div>

        {/* Section 2: Web & Desktop Browser Limitations */}
        <div
          className="stack-xs"
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div className="row-between" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
              2. Web & Desktop Browser Security Sandbox
            </span>
            <Badge variant="neutral">Browser Sandbox Limit</Badge>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
            <strong>Platform limitation:</strong> Web browsers operate in an isolated sandbox. A web application cannot silence notifications from other browser tabs or desktop applications (e.g., Slack, Email, WhatsApp).
          </p>
          <div
            style={{
              fontSize: '11px',
              backgroundColor: 'var(--color-bg-subtle)',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <strong>Recommended Desktop Setup:</strong> Use your operating system's native focus feature while studying:
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
              <li><strong>Windows:</strong> Press <kbd>Win + N</kbd> &rarr; Click <em>Focus</em> or activate <em>Do Not Disturb</em> in Action Center.</li>
              <li><strong>macOS:</strong> Open <em>Control Center</em> &rarr; Click <em>Focus</em> &rarr; Select <em>Do Not Disturb</em>.</li>
            </ul>
          </div>
        </div>

        {/* Section 3: Android & Capacitor Native Integration */}
        <div
          className="stack-xs"
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div className="row-between" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
              3. Android OS & Capacitor Capabilities
            </span>
            <Badge variant="neutral">System Policy Guarded</Badge>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
            <strong>Native Android Requirements:</strong> In Android, programmatically modifying device Do Not Disturb (DND) requires the <code style={{ fontSize: '11px' }}>android.permission.ACCESS_NOTIFICATION_POLICY</code> permission. Under Android OS security guidelines, this access can NEVER be granted automatically; the device owner must explicitly grant permission in Android System Settings.
          </p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            StudySync AI will <strong>never change device system settings without your explicit authorization</strong>.
          </p>
          <div
            style={{
              fontSize: '11px',
              backgroundColor: 'var(--color-bg-subtle)',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <strong>To enable Android System DND for study:</strong>
            <ol style={{ margin: '4px 0 0 16px', padding: 0 }}>
              <li>Open Android <strong>Settings</strong> &rarr; <strong>Sound & Vibration</strong>.</li>
              <li>Tap <strong>Do Not Disturb</strong> &rarr; Enable manually or set a schedule.</li>
            </ol>
          </div>
        </div>

        {/* Section 4: Privacy & Non-Invasive Monitoring Guarantee */}
        <div
          style={{
            fontSize: '11px',
            color: 'var(--color-text-muted)',
            lineHeight: 1.4,
            borderTop: '1px solid var(--color-border-subtle)',
            paddingTop: 'var(--space-2)',
          }}
        >
          🔒 <strong>Privacy Assurance:</strong> StudySync does not use camera monitoring, keystroke logging, eye tracking, or invasive background telemetry. Focus duration measures wall-clock sprint time, not cognitive attention.
        </div>
      </div>
    </Modal>
  );
}

export default PlatformNotificationInfoModal;
