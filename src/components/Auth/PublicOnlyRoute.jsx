import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../config/routes';
import { AuthLoadingScreen } from './AuthLoadingScreen';

/**
 * Safely resolves an internal redirect destination to prevent open-redirect vulnerabilities.
 */
export function getSafeRedirect(from) {
  if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) {
    return from;
  }
  if (from && typeof from.pathname === 'string' && from.pathname.startsWith('/') && !from.pathname.startsWith('//')) {
    return from.pathname + (from.search || '') + (from.hash || '');
  }
  return ROUTES.HOME;
}

/**
 * StudySync AI — PublicOnlyRoute Component
 * 
 * Guards public authentication entrypoints (/login, /register).
 * - Shows AuthLoadingScreen while session verification is active.
 * - Redirects already-authenticated learners to the study dashboard or their intended destination.
 * - Renders login/register for unauthenticated learners.
 */
export function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isLoading, isProfileCompleted } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoadingScreen message="Checking session..." />;
  }

  if (isAuthenticated) {
    if (!isProfileCompleted) {
      return <Navigate to={ROUTES.ONBOARDING} replace />;
    }
    const destination = location.state?.from ? getSafeRedirect(location.state.from) : ROUTES.HOME;
    return <Navigate to={destination} replace />;
  }

  return children;
}

export default PublicOnlyRoute;
