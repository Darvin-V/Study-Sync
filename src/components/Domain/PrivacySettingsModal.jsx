import React, { useState, useEffect } from 'react';
import { Modal, Button, StatusIndicator, Avatar, Divider } from '../UI';
import apiClient from '../../utils/apiClient';

export function PrivacySettingsModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Privacy settings state
  const [profileVisibility, setProfileVisibility] = useState('public');
  const [showActivityStatus, setShowActivityStatus] = useState(true);
  const [showLearningPreferences, setShowLearningPreferences] = useState(true);
  const [showInstitution, setShowInstitution] = useState(true);
  const [allowStudyInvites, setAllowStudyInvites] = useState(true);

  // Blocked users state
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [unblockingId, setUnblockingId] = useState(null);

  // Account controls state
  const [activeTab, setActiveTab] = useState('privacy'); // 'privacy' | 'blocks' | 'account'
  const [clearPrefsLoading, setClearPrefsLoading] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [deactivateConfirm, setDeactivateConfirm] = useState('');
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [privRes, blockRes] = await Promise.all([
        apiClient.getPrivacySettings(),
        apiClient.getBlockedUsers(),
      ]);

      if (privRes.ok && privRes.data?.success) {
        const s = privRes.data.data;
        setProfileVisibility(s.profileVisibility || 'public');
        setShowActivityStatus(s.showActivityStatus !== false);
        setShowLearningPreferences(s.showLearningPreferences !== false);
        setShowInstitution(s.showInstitution !== false);
        setAllowStudyInvites(s.allowStudyInvites !== false);
      }

      if (blockRes.ok && blockRes.data?.success) {
        setBlockedUsers(blockRes.data.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load safety and privacy settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrivacy = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await apiClient.updatePrivacySettings({
        profileVisibility,
        showActivityStatus,
        showLearningPreferences,
        showInstitution,
        allowStudyInvites,
      });

      if (res.ok && res.data?.success) {
        setSuccessMsg('Privacy preferences updated successfully.');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(res.data?.error?.message || 'Failed to update privacy settings.');
      }
    } catch (err) {
      setError(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (userId) => {
    setUnblockingId(userId);
    try {
      const res = await apiClient.unblockUser(userId);
      if (res.ok && res.data?.success) {
        setBlockedUsers((prev) => prev.filter((u) => (u.id || u.blocked_id) !== userId));
      } else {
        setError(res.data?.error?.message || 'Failed to unblock user.');
      }
    } catch (err) {
      setError(err.message || 'Error unblocking user.');
    } finally {
      setUnblockingId(null);
    }
  };

  const handleClearPreferences = async () => {
    if (window.confirm('Are you sure you want to clear all your learning preferences? Your currently learning topics and strengths will be reset.')) {
      setClearPrefsLoading(true);
      setError(null);
      try {
        const res = await apiClient.clearLearningPreferences();
        if (res.ok && res.data?.success) {
          setSuccessMsg('Learning preferences successfully cleared.');
          setTimeout(() => setSuccessMsg(null), 3000);
        } else {
          setError(res.data?.error?.message || 'Failed to clear learning preferences.');
        }
      } catch (err) {
        setError(err.message || 'Error clearing preferences.');
      } finally {
        setClearPrefsLoading(false);
      }
    }
  };

  const handleDeactivate = async (e) => {
    e.preventDefault();
    if (deactivateConfirm !== 'CONFIRM') {
      setError("Please type 'CONFIRM' exactly to confirm account deactivation.");
      return;
    }

    setDeactivateLoading(true);
    setError(null);
    try {
      const res = await apiClient.deactivateAccount(deactivatePassword, deactivateConfirm);
      if (res.ok && res.data?.success) {
        alert('Your account has been deactivated. You will now be redirected to the sign-in page.');
        window.location.href = '/';
      } else {
        setError(res.data?.error?.message || 'Account deactivation failed. Please check your password.');
      }
    } catch (err) {
      setError(err.message || 'Error deactivating account.');
    } finally {
      setDeactivateLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Safety, Privacy & Account Controls"
      id="privacy-settings-modal"
      maxWidth={640}
      footer={
        <div className="row-between" style={{ width: '100%', gap: 'var(--space-2)' }}>
          <Button variant="ghost" size="sm" onClick={onClose} id="privacy-modal-close-btn">
            Close
          </Button>
          {activeTab === 'privacy' && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSavePrivacy}
              loading={saving}
              id="privacy-save-btn"
            >
              Save Privacy Settings
            </Button>
          )}
        </div>
      }
    >
      <div className="stack" style={{ gap: 'var(--space-4)' }}>
        {/* Navigation Tabs */}
        <div className="row" style={{ gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
          <Button
            variant={activeTab === 'privacy' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('privacy')}
            id="tab-privacy-controls"
          >
            Privacy Settings
          </Button>
          <Button
            variant={activeTab === 'blocks' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('blocks')}
            id="tab-blocked-users"
          >
            Blocked Users ({blockedUsers.length})
          </Button>
          <Button
            variant={activeTab === 'account' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('account')}
            id="tab-account-controls"
          >
            Data & Account
          </Button>
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

        {successMsg && (
          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid var(--color-success)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-success)',
              fontSize: 'var(--text-xs)',
            }}
          >
            {successMsg}
          </div>
        )}

        {/* Tab 1: Privacy Controls */}
        {activeTab === 'privacy' && (
          <div className="stack" style={{ gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', marginBottom: 4 }}>
                Peer Discovery Visibility
              </label>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                Control who can discover your learner profile in peer matching and partner discovery.
              </p>

              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: profileVisibility === 'public' ? '1px solid var(--color-brand-primary)' : '1px solid var(--color-border-subtle)',
                    backgroundColor: profileVisibility === 'public' ? 'var(--color-bg-subtle)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="profileVisibility"
                    value="public"
                    checked={profileVisibility === 'public'}
                    onChange={() => setProfileVisibility('public')}
                    id="vis-public"
                  />
                  <div>
                    <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>Public to All Learners</strong>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      Your profile appears in Peer Discovery for learners matching your syllabus topics and learning needs.
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: profileVisibility === 'rooms_only' ? '1px solid var(--color-brand-primary)' : '1px solid var(--color-border-subtle)',
                    backgroundColor: profileVisibility === 'rooms_only' ? 'var(--color-bg-subtle)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="profileVisibility"
                    value="rooms_only"
                    checked={profileVisibility === 'rooms_only'}
                    onChange={() => setProfileVisibility('rooms_only')}
                    id="vis-rooms-only"
                  />
                  <div>
                    <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>Topic Rooms Only</strong>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      Only peers who share at least one Topic Room with you can discover and view your profile.
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: profileVisibility === 'private' ? '1px solid var(--color-brand-primary)' : '1px solid var(--color-border-subtle)',
                    backgroundColor: profileVisibility === 'private' ? 'var(--color-bg-subtle)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="profileVisibility"
                    value="private"
                    checked={profileVisibility === 'private'}
                    onChange={() => setProfileVisibility('private')}
                    id="vis-private"
                  />
                  <div>
                    <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>Private (Hidden)</strong>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      Your profile is excluded from all peer matching and public discovery. You can still join rooms.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <Divider />

            {/* Field Visibility Toggles */}
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', marginBottom: 8 }}>
                Profile Field & Interaction Permissions
              </div>

              <div className="stack" style={{ gap: 'var(--space-3)' }}>
                <label className="row-between" style={{ cursor: 'pointer', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)' }}>
                      Show Activity Status
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      Displays when you are actively studying in a room or session.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showActivityStatus}
                    onChange={(e) => setShowActivityStatus(e.target.checked)}
                    id="toggle-activity-status"
                  />
                </label>

                <label className="row-between" style={{ cursor: 'pointer', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)' }}>
                      Share Learning Preferences & Topics
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      Allows eligible peers to see what topics you are learning and willing to explain.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showLearningPreferences}
                    onChange={(e) => setShowLearningPreferences(e.target.checked)}
                    id="toggle-learning-prefs"
                  />
                </label>

                <label className="row-between" style={{ cursor: 'pointer', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)' }}>
                      Show Institution / Faculty
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      Displays your institution or faculty name on your learner card.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showInstitution}
                    onChange={(e) => setShowInstitution(e.target.checked)}
                    id="toggle-institution"
                  />
                </label>

                <label className="row-between" style={{ cursor: 'pointer', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)' }}>
                      Allow Direct Study Invitations
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      Allows matched peers to initiate direct 1-on-1 study invitations.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowStudyInvites}
                    onChange={(e) => setAllowStudyInvites(e.target.checked)}
                    id="toggle-study-invites"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Blocked Users */}
        {activeTab === 'blocks' && (
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              Learners you have blocked cannot contact you, invite you to study sessions, or view your personal details. In shared Topic Rooms, their messages are automatically masked.
            </p>

            {blockedUsers.length === 0 ? (
              <div
                style={{
                  padding: 'var(--space-4)',
                  textAlign: 'center',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                You have not blocked any learners.
              </div>
            ) : (
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                {blockedUsers.map((b) => {
                  const bId = b.id || b.blocked_id;
                  const bName = b.display_name || b.name || 'Learner';
                  return (
                    <div
                      key={bId}
                      className="row-between"
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-bg-subtle)',
                        alignItems: 'center',
                      }}
                    >
                      <div className="row" style={{ gap: 'var(--space-2)' }}>
                        <Avatar name={bName} initials={(bName || 'U').slice(0, 2).toUpperCase()} size="sm" />
                        <div>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                            {bName}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                            Blocked on {new Date(b.created_at || Date.now()).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnblock(bId)}
                        disabled={unblockingId === bId}
                        id={`unblock-btn-${bId}`}
                      >
                        {unblockingId === bId ? 'Unblocking...' : 'Unblock'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Data Minimization & Account Controls */}
        {activeTab === 'account' && (
          <div className="stack" style={{ gap: 'var(--space-4)' }}>
            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-bg-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <strong>Data Minimization Policy:</strong> StudySync AI collects only the educational details you explicitly share to facilitate peer matching. You have complete control to clear your learning preferences or deactivate your account at any time.
            </div>

            {/* Clear Preferences */}
            <div
              style={{
                padding: 'var(--space-3)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', marginBottom: 4 }}>
                Clear Learning Preferences
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                Remove all your current study topics, identified strengths, and improvement areas from your profile.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearPreferences}
                loading={clearPrefsLoading}
                id="clear-preferences-btn"
              >
                Clear All Topics & Preferences
              </Button>
            </div>

            {/* Deactivate Account */}
            <form
              onSubmit={handleDeactivate}
              style={{
                padding: 'var(--space-3)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                backgroundColor: 'rgba(239, 68, 68, 0.03)',
                borderRadius: 'var(--radius-md)',
              }}
              className="stack"
            >
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-danger)', marginBottom: 4 }}>
                Deactivate Account
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                Deactivating your account hides your profile from peer matching and rooms, revokes all active login sessions, and anonymizes your display name. Existing study session records are preserved for your study partners.
              </p>

              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                <div>
                  <label htmlFor="deactivate-password" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'bold', marginBottom: 2, color: 'var(--color-text-primary)' }}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    id="deactivate-password"
                    placeholder="Enter your current password"
                    value={deactivatePassword}
                    onChange={(e) => setDeactivatePassword(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: 'var(--space-2)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border-default)',
                      fontSize: 'var(--text-sm)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="deactivate-confirm" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'bold', marginBottom: 2, color: 'var(--color-text-primary)' }}>
                    Type 'CONFIRM' to proceed
                  </label>
                  <input
                    type="text"
                    id="deactivate-confirm"
                    placeholder="CONFIRM"
                    value={deactivateConfirm}
                    onChange={(e) => setDeactivateConfirm(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: 'var(--space-2)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border-default)',
                      fontSize: 'var(--text-sm)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <Button
                  variant="danger"
                  size="sm"
                  type="submit"
                  loading={deactivateLoading}
                  disabled={deactivateConfirm !== 'CONFIRM' || !deactivatePassword}
                  id="deactivate-account-submit-btn"
                  style={{ alignSelf: 'flex-start', marginTop: 'var(--space-1)' }}
                >
                  Permanently Deactivate Account
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default PrivacySettingsModal;
