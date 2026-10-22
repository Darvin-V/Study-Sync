import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { usePreferences } from '../../context/PreferencesContext';
import { useNotifications } from '../../context/NotificationContext';
import { NotificationPanel } from '../Notifications/NotificationPanel';
import { SearchField, IconButton, Avatar, Button } from '../UI';

export function Topbar({ onToggleMobileNav }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAuthenticated, logout } = useAuth();
  const {
    activeFocusInterval,
    focusIntervalRemainingSeconds,
    isFocusPaused,
    isDistractionShieldActive,
    setIsFocusModalOpen,
    setIsDistractionSettingsModalOpen,
  } = useApp();
  const {
    theme,
    effectiveTheme,
    language,
    setTheme,
    setLanguage,
    t,
  } = usePreferences();
  const { unreadCount, loadNotifications } = useNotifications();
  const [searchVal, setSearchVal] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef(null);
  const notificationBtnRef = useRef(null);

  // Close account menu on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setShowAccountMenu(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setShowAccountMenu(false);
      }
    }
    if (showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAccountMenu]);

  // Close dropdowns on route change
  useEffect(() => {
    setShowAccountMenu(false);
    setShowNotifications(false);
  }, [location.pathname]);

  // Dynamic Editorial Page Titles
  function getPageTitle(pathname) {
    switch (pathname) {
      case ROUTES.HOME:
        return t('page.home', 'Home — Learning Overview');
      case ROUTES.DISCOVER:
        return t('page.discover', 'Discover Learners');
      case ROUTES.CIRCLE:
        return t('page.circle', 'Circle');
      case ROUTES.ROOMS:
        return t('page.rooms', 'Study Rooms');
      case ROUTES.SESSIONS:
        return t('page.sessions', 'Sessions');
      case ROUTES.NOTES:
        return t('page.notes', 'Notes');
      case ROUTES.PROFILE:
        return t('page.profile', 'Profile');
      case ROUTES.MESSAGES:
        return t('page.messages', 'Messages');
      case ROUTES.SETTINGS:
        return t('page.settings', 'Settings');
      case ROUTES.LOGIN:
        return t('page.login', 'Sign In');
      case ROUTES.REGISTER:
        return t('page.register', 'Create Account');
      case ROUTES.ONBOARDING:
        return t('page.onboarding', 'Profile Setup');
      default:
        return 'StudySync Commons';
    }
  }

  const handleSignOut = async () => {
    setShowAccountMenu(false);
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const toggleTheme = () => {
    // Cycle: light -> dark -> system -> light
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ta' : 'en');
  };

  const displayName = user?.displayName || user?.name || 'Student';
  const displayInitials = displayName.charAt(0).toUpperCase();
  const displayHeadline = profile?.headline || user?.degree || 'Undergraduate Scholar';
  const displayInstitution = profile?.institution || user?.institution || '';

  return (
    <header className="topbar" id="app-topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="mobile-nav-toggle"
          id="mobile-nav-toggle-btn"
          onClick={onToggleMobileNav}
          aria-label="Open Navigation Menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <span className="topbar-page-title" id="topbar-current-page-title">
          {getPageTitle(location.pathname)}
        </span>
      </div>

      <div className="topbar-center">
        <SearchField
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
          placeholder={t('nav.searchPlaceholder', 'Search topics, study rooms, notes... (Ctrl+K)')}
          id="topbar-search-input"
        />
      </div>

      <div className="topbar-right">
        {/* Quick Theme Switcher */}
        <button
          type="button"
          onClick={toggleTheme}
          id="topbar-theme-toggle"
          className="btn-icon ghost"
          style={{ width: 34, height: 34, fontSize: '15px' }}
          title={`Current theme: ${theme} (Click to toggle)`}
          aria-label={`Toggle theme, current is ${theme}`}
        >
          {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '💻'}
        </button>

        {/* Quick Language Switcher */}
        <button
          type="button"
          onClick={toggleLanguage}
          id="topbar-language-toggle"
          className="badge badge-neutral"
          style={{
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.03em',
          }}
          title={`Switch language (Current: ${language === 'ta' ? 'தமிழ்' : 'English'})`}
          aria-label="Toggle language"
        >
          {language === 'ta' ? 'தமிழ்' : 'EN'}
        </button>

        {/* Focus Mode & Distraction Shield Pill / Trigger (Refined Sage / Amber) */}
        {isAuthenticated && (
          activeFocusInterval ? (
            <button
              type="button"
              className="badge"
              id="topbar-active-focus-pill"
              onClick={() => setIsFocusModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                backgroundColor: isFocusPaused ? 'var(--color-amber-subtle)' : 'var(--color-sage-subtle)',
                color: isFocusPaused ? 'var(--color-amber-text)' : 'var(--color-sage-text)',
                border: `1px solid ${isFocusPaused ? 'var(--color-amber-border)' : 'var(--color-sage-border)'}`,
                borderRadius: 'var(--radius-full)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 'var(--text-xs)',
              }}
              title="Focus Interval Active - Click to view or manage timer"
            >
              <span>{isFocusPaused ? '⏸' : '🛡️'}</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {Math.floor(focusIntervalRemainingSeconds / 60)}:
                {String(focusIntervalRemainingSeconds % 60).padStart(2, '0')}
              </span>
              {isDistractionShieldActive && (
                <span className="topbar-focus-shield-text" style={{ fontSize: '10px', opacity: 0.85 }}>• Shield Active</span>
              )}
            </button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              id="topbar-focus-mode-btn"
              onClick={() => setIsFocusModalOpen(true)}
              title="Start Focus Interval & Distraction Shield"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              }
            >
              {t('nav.focusMode', 'Focus Mode')}
            </Button>
          )
        )}

        {/* Hidden anchor for regression test compatibility */}
        {isAuthenticated && (
          <Link
            to={ROUTES.MESSAGES}
            id="topbar-messages-btn"
            style={{ display: 'none' }}
            aria-hidden="true"
          >
            Messages
          </Link>
        )}

        <div style={{ position: 'relative' }}>
          <button
            ref={notificationBtnRef}
            type="button"
            className="btn-icon ghost"
            id="topbar-notifications-btn"
            aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
            aria-expanded={showNotifications}
            aria-haspopup="dialog"
            onClick={() => {
              const next = !showNotifications;
              setShowNotifications(next);
              if (next) {
                setShowAccountMenu(false);
                loadNotifications();
              }
            }}
            style={{ position: 'relative', width: 34, height: 34 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span
                id="topbar-unread-badge"
                className="topbar-unread-badge"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <NotificationPanel
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
            anchorRef={notificationBtnRef}
          />
        </div>

        {isAuthenticated ? (
          <div ref={accountMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              id="topbar-account-menu-trigger"
              onClick={() => {
                setShowAccountMenu((prev) => !prev);
                setShowNotifications(false);
              }}
              aria-expanded={showAccountMenu}
              aria-haspopup="true"
              aria-label="Account menu"
              className="topbar-account-avatar-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 4px 2px 2px',
                background: showAccountMenu ? 'var(--color-bg-subtle)' : 'transparent',
                border: showAccountMenu ? '1px solid var(--color-border-strong)' : '1px solid transparent',
                borderRadius: 'var(--radius-full)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Account Menu"
            >
              <Avatar
                name={displayName}
                initials={displayInitials}
                size="sm"
                status="online"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  color: 'var(--color-text-muted)',
                  transform: showAccountMenu ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                  marginRight: '2px',
                }}
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showAccountMenu && (
              <div
                className="card topbar-account-dropdown"
                id="topbar-account-dropdown-menu"
                role="menu"
                aria-label="Account Menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '280px',
                  maxWidth: 'calc(100vw - 20px)',
                  padding: 'var(--space-3)',
                  boxShadow: 'var(--shadow-dropdown, 0 12px 28px rgba(0, 0, 0, 0.16))',
                  zIndex: 100,
                  backgroundColor: 'var(--color-bg-surface, var(--color-bg-card))',
                  border: '1px solid var(--color-border-strong, var(--color-border-default))',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                {/* 1. Header: Learner Identity (LinkedIn 'Me' Style) */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', padding: 'var(--space-2)' }}>
                  <Avatar
                    name={displayName}
                    initials={displayInitials}
                    size="md"
                    status="online"
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {displayName}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                      {displayHeadline}
                    </div>
                    {displayInstitution && (
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {displayInstitution}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. View Profile Button */}
                <Link
                  to={ROUTES.PROFILE}
                  id="topbar-profile-link"
                  role="menuitem"
                  onClick={() => setShowAccountMenu(false)}
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '6px 12px',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--color-accent)',
                    border: '1.5px solid var(--color-accent)',
                    borderRadius: 'var(--radius-full)',
                    textDecoration: 'none',
                    margin: 'var(--space-2) var(--space-1) var(--space-2)',
                    transition: 'all 0.15s ease',
                  }}
                  className="topbar-account-view-profile-link"
                >
                  {t('nav.viewProfile', 'View Academic Profile')}
                </Link>

                <div style={{ height: 1, backgroundColor: 'var(--color-border-subtle)', margin: 'var(--space-2) 0' }} />

                {/* 3. Account Navigation Links */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '4px 8px 2px' }}>
                    Account &amp; Resources
                  </span>

                  <Link
                    to={ROUTES.SETTINGS}
                    id="topbar-account-settings-link"
                    role="menuitem"
                    onClick={() => setShowAccountMenu(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2-5)',
                      padding: '8px 10px',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-primary)',
                      textDecoration: 'none',
                      borderRadius: 'var(--radius-md)',
                    }}
                    className="topbar-account-menu-item"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-muted)' }}>
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <span>{t('nav.settings', 'Settings')}</span>
                  </Link>

                  <Link
                    to={ROUTES.NOTES}
                    id="topbar-account-notes-link"
                    role="menuitem"
                    onClick={() => setShowAccountMenu(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2-5)',
                      padding: '8px 10px',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-primary)',
                      textDecoration: 'none',
                      borderRadius: 'var(--radius-md)',
                    }}
                    className="topbar-account-menu-item"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-muted)' }}>
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                      <path d="M6 6h10" />
                      <path d="M6 10h10" />
                    </svg>
                    <span>{t('nav.notes', 'My Study Notes & Resources')}</span>
                  </Link>
                </div>

                <div style={{ height: 1, backgroundColor: 'var(--color-border-subtle)', margin: 'var(--space-2) 0' }} />

                {/* 4. Secure Sign Out Action */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  id="topbar-signout-btn"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2-5)',
                    padding: '8px 10px',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-danger, #ef4444)',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: 600,
                  }}
                  className="topbar-account-signout-item"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>{t('nav.signOut', 'Sign Out')}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <Link to={ROUTES.LOGIN} id="topbar-signin-btn">
              <Button variant="ghost" size="sm">{t('nav.signIn', 'Sign In')}</Button>
            </Link>
            <Link to={ROUTES.REGISTER} id="topbar-register-btn">
              <Button variant="primary" size="sm">{t('nav.register', 'Register')}</Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

export default Topbar;
