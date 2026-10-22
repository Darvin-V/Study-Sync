import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PreferencesProvider } from './context/PreferencesContext';
import { PWAProvider } from './context/PWAContext';
import { NotificationProvider } from './context/NotificationContext';
import {
  AppLayout,
  ProtectedRoute,
  PublicOnlyRoute,
  AuthLoadingScreen,
  AuthPage,
} from './components';
import {
  Home,
  Discover,
  Rooms,
  Sessions,
  Notes,
  Profile,
  Messages,
  Circle,
  Contacts,
  KnowledgeMapPage,
  Settings,
  Login,
  Register,
  Onboarding,
  NotFound,
} from './pages';
import { ROUTES } from './config/routes';
import './App.css';

/**
 * RootRoute Component
 * 
 * Enforces authentication-first entry at the root URL (/):
 * - While session check is in-flight: displays AuthLoadingScreen (never flashes Home).
 * - When unauthenticated: displays dedicated AuthPage (Login/Register).
 * - When authenticated but profile incomplete: redirects to Onboarding.
 * - When authenticated: displays the StudySync collaborative dashboard in AppLayout.
 */
function RootRoute() {
  const { isAuthenticated, isLoading, isProfileCompleted } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen message="Checking session..." />;
  }

  if (!isAuthenticated) {
    return <AuthPage initialMode="login" />;
  }

  if (!isProfileCompleted) {
    return <Navigate to={ROUTES.ONBOARDING} replace />;
  }

  return (
    <AppLayout>
      <Home />
    </AppLayout>
  );
}

/**
 * OnboardingRoute Component
 * 
 * Guards the learner onboarding flow:
 * - Shows AuthLoadingScreen while checking session.
 * - Redirects unauthenticated visitors to /login.
 * - Redirects users with already-completed profiles to the dashboard.
 * - Renders dedicated, distraction-free learner profile onboarding (no sidebar/feed).
 */
function OnboardingRoute({ children }) {
  const { isAuthenticated, isLoading, isProfileCompleted } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen message="Checking profile status..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (isProfileCompleted) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return children;
}

export function App() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <AppProvider>
          <NotificationProvider>
            <PWAProvider>
              <BrowserRouter>
              <Routes>
                {/* Root Route: Authentication-First Entry Experience */}
                <Route path="/" element={<RootRoute />} />

                {/* Standalone Public Authentication Routes (No AppLayout, No Sidebar, No PWA banner) */}
                <Route
                  path={ROUTES.LOGIN}
                  element={
                    <PublicOnlyRoute>
                      <Login />
                    </PublicOnlyRoute>
                  }
                />
                <Route
                  path={ROUTES.REGISTER}
                  element={
                    <PublicOnlyRoute>
                      <Register />
                    </PublicOnlyRoute>
                  }
                />

                {/* Standalone Onboarding Route — Clean, No AppLayout, No Sidebar, No Social Feed */}
                <Route
                  path={ROUTES.ONBOARDING}
                  element={
                    <OnboardingRoute>
                      <Onboarding />
                    </OnboardingRoute>
                  }
                />

                {/* Protected Authenticated Application Shell */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path={ROUTES.DISCOVER} element={<Discover />} />
                  <Route path={ROUTES.ROOMS} element={<Rooms />} />
                  <Route path={ROUTES.KNOWLEDGE_MAP} element={<KnowledgeMapPage />} />
                  <Route path={ROUTES.SESSIONS} element={<Sessions />} />
                  <Route path={ROUTES.NOTES} element={<Notes />} />
                  <Route path={ROUTES.PROFILE} element={<Profile />} />
                  <Route path={ROUTES.MESSAGES} element={<Messages />} />
                  <Route path={ROUTES.CIRCLE} element={<Circle />} />
                  <Route path="/contacts" element={<Navigate to={ROUTES.CIRCLE} replace />} />
                  <Route path={ROUTES.SETTINGS} element={<Settings />} />
                </Route>

                {/* 404 Not Found Route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </PWAProvider>
        </NotificationProvider>
      </AppProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}

export default App;
