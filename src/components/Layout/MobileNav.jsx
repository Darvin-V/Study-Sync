import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { Avatar } from '../UI';

export function MobileNav({ isOpen, onClose }) {
  const { user, profile, isAuthenticated } = useAuth();
  const { t } = usePreferences();
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const displayName = user?.displayName || user?.name || 'Student';
  const displayInitials = displayName.charAt(0).toUpperCase();
  const displayMeta = profile?.headline || user?.degree || 'Undergraduate Scholar';

  // Automatically close More popover on route change
  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  // Close More popover when mobile drawer is opened
  useEffect(() => {
    if (isOpen) {
      setIsMoreOpen(false);
    }
  }, [isOpen]);

  // Close More popover on Escape key
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsMoreOpen(false);
      }
    }
    if (isMoreOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMoreOpen]);

  // Check if current route is one of the destinations nestled inside "More" on narrow viewports
  const isCircleActive = location.pathname === ROUTES.CIRCLE || location.pathname.startsWith('/circle');
  const isProfileActive = location.pathname === ROUTES.PROFILE || location.pathname.startsWith('/profile');
  const isSettingsActive = location.pathname === ROUTES.SETTINGS || location.pathname.startsWith('/settings');
  const isMoreActive = isCircleActive || isProfileActive || isSettingsActive;

  // The 6 Primary Destinations
  const destinations = [
    {
      id: 'home',
      to: ROUTES.HOME,
      label: t('nav.home', 'Home'),
      end: true,
      className: '',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      ),
    },
    {
      id: 'discover',
      to: ROUTES.DISCOVER,
      label: t('nav.discover', 'Discover'),
      end: false,
      className: '',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
    {
      id: 'rooms',
      to: ROUTES.ROOMS,
      label: t('nav.rooms', 'Rooms'),
      end: false,
      className: '',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="15" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      id: 'messages',
      to: ROUTES.MESSAGES,
      label: t('nav.messages', 'Messages'),
      end: false,
      className: '',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: 'circle',
      to: ROUTES.CIRCLE,
      label: t('nav.circle', 'Circle'),
      end: false,
      className: 'mobile-tab-circle',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      ),
    },
    {
      id: 'profile',
      to: ROUTES.PROFILE,
      label: t('nav.profile', 'Profile'),
      end: false,
      className: 'mobile-tab-profile',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className={`mobile-drawer-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile Drawer Menu */}
      <div className={`mobile-drawer ${isOpen ? 'open' : ''}`} id="mobile-drawer-menu" role="dialog" aria-modal="true">
        <div className="mobile-drawer-header">
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, color: '#FFFFFF', fontSize: '1.15rem' }}>
              StudySync
            </span>
            <span className="sidebar-brand-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--color-forest-border)' }} />
              Commons
            </span>
          </div>
          <button
            type="button"
            className="btn-icon ghost"
            onClick={onClose}
            aria-label="Close menu"
            style={{ color: 'var(--color-nav-text)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav mobile-drawer-nav" aria-label="Main Navigation">
          <NavLink to={ROUTES.HOME} end className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`} onClick={onClose} id="mobile-drawer-link-home">
            <span className="nav-item-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 13 15 13 15 22" />
              </svg>
            </span>
            <span>{t('nav.home', 'Home')}</span>
          </NavLink>
          <NavLink to={ROUTES.DISCOVER} className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`} onClick={onClose} id="mobile-drawer-link-discover">
            <span className="nav-item-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="7" r="4" />
                <path d="M17 11a3 3 0 1 0 0-6" />
                <path d="M2 21v-2a4 4 0 0 1 7-2.6" />
                <path d="M15 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <span>{t('nav.discover', 'Discover Learners')}</span>
          </NavLink>
          <NavLink to={ROUTES.CIRCLE} className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`} onClick={onClose} id="mobile-drawer-link-circle">
            <span className="nav-item-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="10" r="3" />
                <path d="M7 18a5 5 0 0 1 10 0" />
              </svg>
            </span>
            <span>{t('nav.circle', 'Circle')}</span>
          </NavLink>
          <NavLink to={ROUTES.ROOMS} className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`} onClick={onClose} id="mobile-drawer-link-rooms">
            <span className="nav-item-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="15" rx="2" />
                <line x1="8" y1="2" x2="8" y2="4" />
                <line x1="16" y1="2" x2="16" y2="4" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </span>
            <span>{t('nav.rooms', 'Topic Rooms')}</span>
          </NavLink>
          <NavLink to={ROUTES.MESSAGES} className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`} onClick={onClose} id="mobile-drawer-link-messages">
            <span className="nav-item-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            <span>{t('nav.messages', 'Direct Messages')}</span>
          </NavLink>
          <NavLink to={ROUTES.PROFILE} className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`} onClick={onClose} id="mobile-drawer-link-profile">
            <span className="nav-item-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <span>{t('nav.profile', 'Academic Profile')}</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer mobile-drawer-footer">
          <NavLink
            to={ROUTES.SETTINGS}
            id="mobile-drawer-link-settings"
            className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <span className="nav-item-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            <span>{t('nav.settings', 'Settings')}</span>
          </NavLink>

          {isAuthenticated ? (
            <Link to={ROUTES.PROFILE} className="sidebar-user-chip" id="mobile-drawer-user-chip" onClick={onClose}>
              <Avatar name={displayName} initials={displayInitials} size="sm" status="online" />
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{displayName}</span>
                <span className="sidebar-user-meta">{displayMeta}</span>
              </div>
            </Link>
          ) : (
            <Link to={ROUTES.LOGIN} className="sidebar-user-chip" id="mobile-drawer-user-chip" onClick={onClose} style={{ justifyContent: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: '#FFFFFF', fontWeight: 600 }}>
                {t('nav.signIn', 'Sign In / Register')} &rarr;
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile More Popover (Responsive Strategy on Narrow Viewports) */}
      {isMoreOpen && (
        <>
          <div
            className="mobile-nav-more-backdrop"
            id="mobile-nav-more-backdrop"
            onClick={() => setIsMoreOpen(false)}
            aria-hidden="true"
          />
          <div
            className="mobile-nav-more-popover"
            id="mobile-nav-more-popover"
            role="menu"
            aria-label="Additional Navigation"
          >
            <div className="mobile-nav-more-header">
              <span className="mobile-nav-more-title">More Destinations</span>
              <button
                type="button"
                className="btn-icon ghost"
                style={{ width: 24, height: 24, padding: 0 }}
                onClick={() => setIsMoreOpen(false)}
                aria-label="Close destinations menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="mobile-nav-more-list">
              <NavLink
                to={ROUTES.CIRCLE}
                className={({ isActive }) => `mobile-nav-more-item ${isActive ? 'active' : ''}`}
                onClick={() => setIsMoreOpen(false)}
                role="menuitem"
                id="mobile-more-link-circle"
              >
                <div className="mobile-nav-more-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                </div>
                <div className="mobile-nav-more-text">
                  <span className="mobile-nav-more-label">Circle</span>
                  <span className="mobile-nav-more-sub">Your study connections & peers</span>
                </div>
              </NavLink>

              <NavLink
                to={ROUTES.PROFILE}
                className={({ isActive }) => `mobile-nav-more-item ${isActive ? 'active' : ''}`}
                onClick={() => setIsMoreOpen(false)}
                role="menuitem"
                id="mobile-more-link-profile"
              >
                <div className="mobile-nav-more-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div className="mobile-nav-more-text">
                  <span className="mobile-nav-more-label">Academic Profile</span>
                  <span className="mobile-nav-more-sub">Skills, topics & learning DNA</span>
                </div>
              </NavLink>

              <NavLink
                to={ROUTES.SETTINGS}
                className={({ isActive }) => `mobile-nav-more-item ${isActive ? 'active' : ''}`}
                onClick={() => setIsMoreOpen(false)}
                role="menuitem"
                id="mobile-more-link-settings"
              >
                <div className="mobile-nav-more-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </div>
                <div className="mobile-nav-more-text">
                  <span className="mobile-nav-more-label">Settings</span>
                  <span className="mobile-nav-more-sub">Preferences, theme & privacy</span>
                </div>
              </NavLink>
            </div>
          </div>
        </>
      )}

      {/* Mobile Bottom Quick-Access Tab Bar */}
      <nav className="mobile-bottom-nav" id="mobile-bottom-nav" aria-label="Mobile Bottom Navigation">
        {destinations.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.to}
            end={tab.end}
            id={`mobile-tab-${tab.id}`}
            aria-label={tab.label}
            className={({ isActive }) => `mobile-bottom-tab ${tab.className} ${isActive ? 'active' : ''}`}
          >
            <div className="mobile-tab-icon-wrap">
              {tab.icon}
            </div>
            <span className="mobile-tab-label">{tab.label}</span>
          </NavLink>
        ))}

        {/* More Tab Trigger Button (Active on narrow screens when Circle, Profile, or Settings is visited) */}
        <button
          type="button"
          className={`mobile-bottom-tab mobile-tab-more-trigger ${isMoreActive ? 'active' : ''} ${isMoreOpen ? 'open' : ''}`}
          id="mobile-tab-more-btn"
          aria-label="More navigation destinations"
          aria-haspopup="true"
          aria-expanded={isMoreOpen}
          onClick={() => setIsMoreOpen((prev) => !prev)}
        >
          <div className="mobile-tab-icon-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
              <circle cx="5" cy="12" r="1.5" />
            </svg>
            {isMoreActive && <span className="mobile-tab-more-dot" aria-hidden="true" />}
          </div>
          <span className="mobile-tab-label">More</span>
        </button>
      </nav>
    </>
  );
}

export default MobileNav;
