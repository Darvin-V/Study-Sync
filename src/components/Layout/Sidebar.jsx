import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { Avatar } from '../UI';

export function Sidebar() {
  const { user, profile, isAuthenticated } = useAuth();
  const { t } = usePreferences();
  const displayName = user?.displayName || user?.name || 'Student';
  const displayInitials = displayName.charAt(0).toUpperCase();
  const displayMeta = profile?.headline || user?.degree || 'Undergraduate Scholar';

  const navItems = [
    {
      to: ROUTES.HOME,
      label: t('nav.home', 'Home'),
      id: 'sidebar-nav-home',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 13 15 13 15 22" />
        </svg>
      ),
    },
    {
      to: ROUTES.DISCOVER,
      label: t('nav.discover', 'Discover Learners'),
      id: 'sidebar-nav-discover',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="7" r="4" />
          <path d="M17 11a3 3 0 1 0 0-6" />
          <path d="M2 21v-2a4 4 0 0 1 7-2.6" />
          <path d="M15 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      to: ROUTES.CIRCLE,
      label: t('nav.circle', 'Circle'),
      id: 'sidebar-nav-circle',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="10" r="3" />
          <path d="M7 18a5 5 0 0 1 10 0" />
        </svg>
      ),
    },
    {
      to: ROUTES.ROOMS,
      label: t('nav.rooms', 'Study Rooms'),
      id: 'sidebar-nav-rooms',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="15" rx="2" />
          <line x1="8" y1="2" x2="8" y2="4" />
          <line x1="16" y1="2" x2="16" y2="4" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      to: ROUTES.MESSAGES,
      label: t('nav.messages', 'Messages'),
      id: 'sidebar-nav-messages',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      to: ROUTES.PROFILE,
      label: t('nav.profile', 'Profile'),
      id: 'sidebar-nav-profile',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="app-sidebar" id="app-sidebar" aria-label="Application Navigation">
      <Link to={ROUTES.HOME} className="sidebar-brand" id="sidebar-brand-link">
        <div className="sidebar-brand-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M8 7h8" />
            <path d="M8 11h8" />
            <path d="M8 15h5" />
          </svg>
        </div>
        <span className="sidebar-brand-name">StudySync</span>
        <span className="sidebar-brand-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--color-forest-border)' }} />
          {t('nav.commons', 'Commons')}
        </span>
      </Link>

      <nav className="sidebar-nav" aria-label="Main Navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            id={item.id}
            end={item.to === ROUTES.HOME}
            className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-item-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <NavLink
          to={ROUTES.SETTINGS}
          id="sidebar-nav-settings"
          className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
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
          <Link to={ROUTES.PROFILE} className="sidebar-user-chip" id="sidebar-user-chip">
            <Avatar
              name={displayName}
              initials={displayInitials}
              size="sm"
              status="online"
            />
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{displayName}</span>
              <span className="sidebar-user-meta">{displayMeta}</span>
            </div>
          </Link>
        ) : (
          <Link to={ROUTES.LOGIN} className="sidebar-user-chip" id="sidebar-user-chip" style={{ justifyContent: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: '#FFFFFF', fontWeight: 600 }}>
              {t('nav.signIn', 'Sign In / Register')} &rarr;
            </span>
          </Link>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
