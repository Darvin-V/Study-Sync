import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { useApp } from '../../context/AppContext';
import { usePreferences } from '../../context/PreferencesContext';
import { ROUTES } from '../../config/routes';
import { Avatar } from '../UI';

/**
 * Format relative timestamps (e.g. "Just now", "5m ago", "2h ago", "Yesterday")
 */
function formatRelativeTime(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSecs < 60) return 'Just now';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * Returns an appropriate icon based on notification type
 */
function NotificationTypeIcon({ type }) {
  switch (type) {
    case 'direct_message':
      return (
        <span className="notif-type-badge message" title="Direct Message">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
      );
    case 'question_reply':
    case 'question_asked':
      return (
        <span className="notif-type-badge doubt" title="Doubt / Discussion">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
      );
    case 'room_activity':
    case 'room_invite':
      return (
        <span className="notif-type-badge room" title="Study Room Activity">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </span>
      );
    case 'session_invite':
      return (
        <span className="notif-type-badge session" title="Study Session Invitation">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </span>
      );
    case 'security_alert':
    default:
      return (
        <span className="notif-type-badge security" title="Security & Account Notice">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </span>
      );
  }
}

/**
 * Polished, accessible social notification panel inspired by Instagram and LinkedIn.
 */
export function NotificationPanel({ isOpen, onClose, anchorRef }) {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    filter,
    setFilter,
    isLoading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const { isDistractionShieldActive, setIsDistractionSettingsModalOpen } = useApp();
  const { t } = usePreferences();
  const panelRef = useRef(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target) &&
        anchorRef?.current &&
        !anchorRef.current.contains(event.target)
      ) {
        onClose();
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
        anchorRef?.current?.focus?.();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  const handleNotificationClick = (notif) => {
    if (!notif.isRead) {
      markAsRead(notif.id);
    }
    onClose();
    if (notif.targetUrl) {
      navigate(notif.targetUrl);
    }
  };

  const handleOpenSettings = () => {
    onClose();
    navigate(ROUTES.SETTINGS);
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      <div className="notif-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Main Notification Panel Container */}
      <div
        ref={panelRef}
        className="notif-panel-container"
        id="topbar-notification-panel"
        role="dialog"
        aria-label="Notifications"
        aria-modal="true"
      >
        {/* Panel Header */}
        <div className="notif-panel-header">
          <div className="notif-header-left">
            <h2 className="notif-panel-title">{t('notifications.title', 'Notifications')}</h2>
            {unreadCount > 0 && (
              <span className="notif-unread-count-pill" id="notif-unread-count-badge">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="notif-header-actions">
            <button
              type="button"
              className="notif-icon-action-btn"
              onClick={handleOpenSettings}
              title="Notification Settings"
              aria-label="Notification Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <button
              type="button"
              className="notif-close-mobile-btn"
              onClick={onClose}
              aria-label="Close notifications"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter Navigation & Mark All Read */}
        <div className="notif-filter-bar">
          <div className="notif-filter-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              id="notif-filter-all"
              className={`notif-filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              {t('common.all', 'All')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'unread'}
              id="notif-filter-unread"
              className={`notif-filter-btn ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => setFilter('unread')}
            >
              {t('notifications.unread', 'Unread')}
              {unreadCount > 0 && <span className="notif-tab-count">({unreadCount})</span>}
            </button>
          </div>

          <button
            type="button"
            id="notif-mark-all-read-btn"
            className="notif-mark-all-btn"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            {t('notifications.markAllRead', 'Mark all read')}
          </button>
        </div>

        {/* Focus Shield Active Banner (Context Aware) */}
        {isDistractionShieldActive && (
          <div className="notif-shield-banner" id="notif-shield-active-banner">
            <div className="notif-shield-icon">🛡️</div>
            <div className="notif-shield-content">
              <strong>Focus Shield is Active</strong>
              <span>Non-urgent alerts are silenced. Urgent notices appear below.</span>
              <button
                type="button"
                className="notif-shield-settings-link"
                onClick={() => {
                  onClose();
                  setIsDistractionSettingsModalOpen(true);
                }}
              >
                Shield settings &rsaquo;
              </button>
            </div>
          </div>
        )}

        {/* Notifications Scrollable List */}
        <div className="notif-list-body" id="notif-list-scroll-area">
          {isLoading && notifications.length === 0 ? (
            <div className="notif-empty-state">
              <div className="notif-loading-spinner" />
              <span>Checking for updates...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notif-empty-state" id="notif-empty-placeholder">
              <div className="notif-empty-icon-wrap">
                {filter === 'unread' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                )}
              </div>
              <h3 className="notif-empty-title">
                {filter === 'unread' ? "You're all caught up" : 'No notifications yet'}
              </h3>
              <p className="notif-empty-sub">
                {filter === 'unread'
                  ? 'All unread notifications have been reviewed.'
                  : 'Direct messages, study invitations, and doubt answers from peer scholars will appear here.'}
              </p>
            </div>
          ) : (
            <div className="notif-items-wrap">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  id={`notif-item-${notif.id}`}
                  className={`notif-row ${notif.isRead ? 'read' : 'unread'}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNotificationClick(notif)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNotificationClick(notif);
                    }
                  }}
                >
                  {/* Left Avatar / Icon with Overlay Badge */}
                  <div className="notif-avatar-container">
                    {notif.actor ? (
                      <Avatar
                        name={notif.actor.displayName}
                        initials={notif.actor.initials}
                        size="md"
                      />
                    ) : (
                      <div className="notif-system-avatar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      </div>
                    )}
                    <NotificationTypeIcon type={notif.type} />
                  </div>

                  {/* Center Content */}
                  <div className="notif-content-col">
                    <div className="notif-title-row">
                      <span className="notif-actor-name">{notif.title}</span>
                      <span className="notif-time">{formatRelativeTime(notif.createdAt)}</span>
                    </div>
                    <div className="notif-body-text">{notif.body}</div>
                  </div>

                  {/* Unread Visual Dot */}
                  {!notif.isRead && (
                    <div className="notif-unread-dot" aria-label="Unread" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default NotificationPanel;
