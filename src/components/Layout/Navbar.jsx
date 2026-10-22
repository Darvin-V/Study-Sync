import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { NAV_ITEMS, ROUTES } from '../../config/routes';
import { APP_INFO } from '../../utils/constants';

export function Navbar() {
  return (
    <header className="app-header" id="main-header">
      <div className="container header-content">
        <Link to={ROUTES.HOME} className="brand-logo" id="brand-logo-link">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M6 6h10" />
            <path d="M6 10h10" />
            <path d="M6 14h6" />
            <circle cx="18" cy="16" r="3" />
            <path d="m20.5 18.5 1.5 1.5" />
          </svg>
          <span>{APP_INFO.NAME}</span>
          <span className="brand-badge" id="brand-phase-badge">Phase 0</span>
        </Link>

        <nav className="nav-links" id="main-navigation" aria-label="Main Navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              id={`nav-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
              end={item.path === ROUTES.HOME}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
