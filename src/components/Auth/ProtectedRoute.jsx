import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../config/routes';
import { AuthLoadingScreen } from './AuthLoadingScreen';

/**
 * StudySync AI — ProtectedRoute Component
 * 
 * Guards private routes requiring authentication.
 * - Displays a dedicated loading screen while session verification is in-flight.
 * - Redirects unauthenticated visitors to the login page, safely capturing their
 *   intended destination in location state to allow redirecting back after sign-in.
 * - Prevents unauthenticated users from seeing private academic data or app chrome.
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, isProfileCompleted } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoadingScreen message="Checking authorization status..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // Mandatory Onboarding Guard:
  // If the user is authenticated but has not completed onboarding,
  // block access to the dashboard, sidebar, and all learning routes.
  if (!isProfileCompleted) {
    return <Navigate to={ROUTES.ONBOARDING} state={{ from: location }} replace />;
  }

  return children || <Outlet />;
}

export default ProtectedRoute;
