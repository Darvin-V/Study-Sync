import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient, { getStoredToken } from '../utils/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isProfileCompleted, setIsProfileCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [isBackendOnline, setIsBackendOnline] = useState(true);

  // Load session on initial mount
  const checkSession = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);

    const token = getStoredToken();

    try {
      // Check session with server (verifies Bearer token if present, or httpOnly cookie)
      const userRes = await apiClient.getCurrentUser();

      if (!userRes.isAvailable) {
        setIsBackendOnline(false);
        setUser(null);
        setProfile(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      setIsBackendOnline(true);

      if (userRes.ok && userRes.data?.success) {
        const userData = userRes.data.data.user;
        setUser(userData);
        setIsAuthenticated(true);
        setIsProfileCompleted(Boolean(userRes.data.data.isProfileCompleted));

        // Fetch full learner profile
        const profileRes = await apiClient.getOwnProfile();
        if (profileRes.ok && profileRes.data?.success) {
          setProfile(profileRes.data.data);
          setIsProfileCompleted(Boolean(profileRes.data.data.isProfileCompleted));
        }
      } else {
        // Token invalid, expired, or unauthenticated
        if (token || userRes.data?.error?.code === 'SESSION_EXPIRED') {
          await apiClient.logout();
        }
        setUser(null);
        setProfile(null);
        setIsAuthenticated(false);
      }
    } catch {
      setUser(null);
      setProfile(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Sign In
  const login = async (email, password) => {
    setAuthError(null);

    try {
      const res = await apiClient.login({ email, password });

      if (!res.isAvailable) {
        setAuthError('Backend server is offline. Please start the backend service.');
        return { success: false, error: 'Backend server offline' };
      }

      if (!res.ok || !res.data?.success) {
        const errorMsg = res.data?.error?.message || 'Invalid email or password';
        const errorCode = res.data?.error?.code;
        setAuthError(errorMsg);

        if (errorCode === 'EMAIL_NOT_VERIFIED') {
          return {
            success: false,
            requiresVerification: true,
            email: res.data?.error?.details?.email || email,
            error: errorMsg,
          };
        }

        return { success: false, error: errorMsg };
      }

      const { user: authedUser, isProfileCompleted: completed } = res.data.data;
      setUser(authedUser);
      setIsAuthenticated(true);
      setIsProfileCompleted(completed);

      // Load full profile
      const profRes = await apiClient.getOwnProfile();
      if (profRes.ok && profRes.data?.success) {
        setProfile(profRes.data.data);
      }

      return { success: true, isProfileCompleted: completed };
    } catch (err) {
      const msg = err.message || 'An unexpected error occurred during sign in';
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  // Register
  const register = async (displayName, email, password, confirmPassword) => {
    setAuthError(null);

    try {
      const res = await apiClient.register({
        displayName,
        email,
        password,
        confirmPassword,
      });

      if (!res.isAvailable) {
        setAuthError('Backend server is offline. Please start the backend service.');
        return { success: false, error: 'Backend server offline' };
      }

      if (!res.ok || !res.data?.success) {
        const errorMsg = res.data?.error?.message || 'Registration failed';
        setAuthError(errorMsg);
        return {
          success: false,
          error: errorMsg,
          code: res.data?.error?.code,
          details: res.data?.error?.details,
        };
      }

      const data = res.data.data;

      // Email OTP verification required before session creation
      if (data.requiresVerification) {
        return {
          success: true,
          requiresVerification: true,
          email: data.email,
          resendAvailableIn: data.resendAvailableIn || 60,
          emailDelivery: data.emailDelivery,
        };
      }

      // If auto-verified (e.g. test fixture)
      if (data.user) {
        setUser(data.user);
        setIsAuthenticated(true);
        setIsProfileCompleted(false);

        const profRes = await apiClient.getOwnProfile();
        if (profRes.ok && profRes.data?.success) {
          setProfile(profRes.data.data);
        }
      }

      return { success: true };
    } catch (err) {
      const msg = err.message || 'An unexpected error occurred during registration';
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  // Verify OTP
  const verifyOtp = async (email, otp) => {
    setAuthError(null);

    try {
      const res = await apiClient.verifyOtp({ email, otp });

      if (!res.isAvailable) {
        const msg = 'Backend server is offline. Please start the backend service.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      if (!res.ok || !res.data?.success) {
        const errorMsg = res.data?.error?.message || 'Verification failed. Please check your code.';
        const errorCode = res.data?.error?.code;
        setAuthError(errorMsg);
        return {
          success: false,
          error: errorMsg,
          code: errorCode,
          attemptsRemaining: res.data?.error?.details?.attemptsRemaining,
        };
      }

      const { user: authedUser, isProfileCompleted: completed } = res.data.data;
      setUser(authedUser);
      setIsAuthenticated(true);
      setIsProfileCompleted(Boolean(completed));

      const profRes = await apiClient.getOwnProfile();
      if (profRes.ok && profRes.data?.success) {
        setProfile(profRes.data.data);
      }

      return { success: true, isProfileCompleted: Boolean(completed) };
    } catch (err) {
      const msg = err.message || 'An unexpected error occurred during verification';
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  // Resend OTP
  const resendOtp = async (email) => {
    try {
      const res = await apiClient.resendOtp({ email });
      if (!res.isAvailable) {
        return { success: false, error: 'Backend server offline' };
      }
      if (!res.ok || !res.data?.success) {
        return {
          success: false,
          error: res.data?.error?.message || 'Failed to resend verification code',
          code: res.data?.error?.code,
          resendAvailableIn: res.data?.error?.details?.resendAvailableIn,
        };
      }
      return {
        success: true,
        data: res.data.data,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Sign Out
  const logout = async () => {
    setIsLoading(true);
    try {
      await apiClient.logout();
    } finally {
      try {
        sessionStorage.removeItem('studysync_session_token');
        localStorage.removeItem('studysync_session_token');
        localStorage.removeItem('studysync_active_session_id');
      } catch {
        // ignore storage errors
      }
      setUser(null);
      setProfile(null);
      setIsAuthenticated(false);
      setIsProfileCompleted(false);
      setAuthError(null);
      setIsLoading(false);
    }
  };

  // Update Profile
  const updateProfile = async (profileData) => {
    try {
      const res = await apiClient.updateOwnProfile(profileData);
      if (res.ok && res.data?.success) {
        const updated = res.data.data;
        setProfile(updated);
        setIsProfileCompleted(Boolean(updated.isProfileCompleted));
        if (updated.displayName) {
          setUser((prev) => (prev ? { ...prev, displayName: updated.displayName } : prev));
        }
        if (updated.preferredLanguages) {
          setUser((prev) => (prev ? { ...prev, preferredLanguages: updated.preferredLanguages } : prev));
        }
        if (updated.avatarUrl) {
          setUser((prev) => (prev ? { ...prev, avatarUrl: updated.avatarUrl } : prev));
        }
        return { success: true, profile: updated };
      }
      return {
        success: false,
        error: res.data?.error?.message || 'Failed to update profile',
        details: res.data?.error?.details,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Update Learning Preferences
  const updatePreferences = async (preferences) => {
    try {
      const res = await apiClient.updateLearningPreferences(preferences);
      if (res.ok && res.data?.success) {
        const updated = res.data.data;
        setProfile(updated);
        return { success: true, profile: updated };
      }
      return {
        success: false,
        error: res.data?.error?.message || 'Failed to update learning preferences',
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Remove Learning Preference
  const removePreference = async (topicId) => {
    try {
      const res = await apiClient.removeLearningPreference(topicId);
      if (res.ok && res.data?.success) {
        setProfile(res.data.data);
        return { success: true, profile: res.data.data };
      }
      return { success: false, error: 'Failed to remove topic preference' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const value = {
    user,
    profile,
    isAuthenticated,
    isProfileCompleted,
    isLoading,
    authError,
    isBackendOnline,
    login,
    register,
    verifyOtp,
    resendOtp,
    logout,
    updateProfile,
    updatePreferences,
    removePreference,
    refreshProfile: checkSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
