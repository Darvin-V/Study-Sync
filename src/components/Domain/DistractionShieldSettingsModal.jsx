import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge } from '../UI';

export function DistractionShieldSettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
}) {
  const [suppressNotifications, setSuppressNotifications] = useState(true);
  const [hideNav, setHideNav] = useState(true);
  const [breakReminders, setBreakReminders] = useState(true);
  const [breakInterval, setBreakInterval] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [audioChime, setAudioChime] = useState(false);
  const [browserNotificationStatus, setBrowserNotificationStatus] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setSuppressNotifications(settings.suppressInAppNotifications !== false);
      setHideNav(settings.hideNonEssentialNav !== false);
      setBreakReminders(settings.breakRemindersEnabled !== false);
      setBreakInterval(settings.breakIntervalMinutes || 25);
      setBreakDuration(settings.breakDurationMinutes || 5);
      setAudioChime(Boolean(settings.audioChimeEnabled));
    }
  }, [settings]);

  if (!isOpen) return null;

  const handleRequestBrowserPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        setBrowserNotificationStatus(permission);
      } catch {
        setBrowserNotificationStatus('denied');
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        suppressInAppNotifications: suppressNotifications,
        hideNonEssentialNav: hideNav,
        breakRemindersEnabled: breakReminders,
        breakIntervalMinutes: Number(breakInterval),
        breakDurationMinutes: Number(breakDuration),
        audioChimeEnabled: audioChime,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Distraction Shield & Break Preferences"
      id="distraction-shield-settings-modal"
    >
      <form onSubmit={handleSave} className="stack" style={{ gap: 'var(--space-4)' }}>
        {/* Explanation Banner */}
        <div
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-bg-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-secondary)',
            lineHeight: 'var(--leading-relaxed)',
          }}
        >
          <strong style={{ color: 'var(--color-text-primary)' }}>What Distraction Shield Controls:</strong>
          <br />
          StudySync AI suppresses in-app study invites, popups, and non-critical alerts during focus sprints. It does not monitor external applications, screen activity, or block device notifications.
        </div>

        {/* 1. In-App Notification Suppression */}
        <div className="row-between" style={{ alignItems: 'center', gap: 'var(--space-3)' }}>
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
              Suppress In-App Notifications
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Mutes peer invitations, room alerts, and study prompts during active focus sprints. Critical account/security notices are always delivered.
            </div>
          </div>
          <input
            type="checkbox"
            id="toggle-suppress-notifications"
            checked={suppressNotifications}
            onChange={(e) => setSuppressNotifications(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--color-accent)' }}
          />
        </div>

        {/* 2. Hide Non-Essential Navigation */}
        <div className="row-between" style={{ alignItems: 'center', gap: 'var(--space-3)' }}>
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
              Distraction-Free Workspace View
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Dims peripheral navigation and non-essential sidebars while the focus timer is running.
            </div>
          </div>
          <input
            type="checkbox"
            id="toggle-hide-nav"
            checked={hideNav}
            onChange={(e) => setHideNav(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--color-accent)' }}
          />
        </div>

        {/* 3. Break Reminders */}
        <div className="stack-xs" style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
          <div className="row-between" style={{ alignItems: 'center', gap: 'var(--space-3)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                Periodic Break Reminders
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Prompts you to stretch, hydrate, and rest your eyes after completing focus sprints.
              </div>
            </div>
            <input
              type="checkbox"
              id="toggle-break-reminders"
              checked={breakReminders}
              onChange={(e) => setBreakReminders(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--color-accent)' }}
            />
          </div>

          {breakReminders && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <div>
                <label
                  htmlFor="break-interval-select"
                  style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 4 }}
                >
                  Sprint Interval
                </label>
                <select
                  id="break-interval-select"
                  value={breakInterval}
                  onChange={(e) => setBreakInterval(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  <option value={15}>15 minutes (Quick Sprint)</option>
                  <option value={25}>25 minutes (Pomodoro Standard)</option>
                  <option value={45}>45 minutes (Deep Study)</option>
                  <option value={60}>60 minutes (Extended Focus)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="break-duration-select"
                  style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 4 }}
                >
                  Break Duration
                </label>
                <select
                  id="break-duration-select"
                  value={breakDuration}
                  onChange={(e) => setBreakDuration(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  <option value={3}>3 minutes (Micro-break)</option>
                  <option value={5}>5 minutes (Standard break)</option>
                  <option value={10}>10 minutes (Extended break)</option>
                  <option value={15}>15 minutes (Full rest)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* 4. Browser Notifications Permission (Optional) */}
        <div
          className="stack-xs"
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-bg-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div className="row-between" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
              Browser Break Alerts (Optional)
            </span>
            <Badge variant={browserNotificationStatus === 'granted' ? 'accent' : 'neutral'}>
              {browserNotificationStatus === 'granted' ? 'Enabled' : browserNotificationStatus === 'denied' ? 'Blocked' : 'Not Requested'}
            </Badge>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Allows StudySync to send a desktop alert when your focus interval finishes, even if this browser tab is in the background.
          </p>
          {browserNotificationStatus !== 'granted' && browserNotificationStatus !== 'unsupported' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRequestBrowserPermission}
              style={{ marginTop: 4, alignSelf: 'flex-start' }}
            >
              Request Browser Notification Permission
            </Button>
          )}
        </div>

        {/* 5. Android OS Do Not Disturb Capabilities & Limitations */}
        <div
          className="stack-xs"
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-bg-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.4,
          }}
        >
          <div className="row-between" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
              Android OS & System DND Integration
            </span>
            <Badge variant="neutral">System Policy Guarded</Badge>
          </div>
          <p style={{ margin: '4px 0' }}>
            <strong>Native Android Requirement:</strong> Modifying system-wide Do Not Disturb requires Android's <code style={{ fontSize: '10px' }}>ACCESS_NOTIFICATION_POLICY</code> permission and explicit user authorization in Android Settings. StudySync AI will <strong>never change your device system settings without your explicit consent</strong>.
          </p>
          <p style={{ margin: 0 }}>
            To silence incoming phone calls and external apps during focus sprints, open Android <strong>Settings &rarr; Sound & Vibration &rarr; Do Not Disturb</strong>.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="row-between" style={{ marginTop: 'var(--space-2)' }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving} id="save-distraction-settings-btn">
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default DistractionShieldSettingsModal;
