import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import apiClient from '../utils/apiClient';
import { translate, SUPPORTED_LANGUAGES } from '../i18n';

const PreferencesContext = createContext(null);

const STORAGE_THEME_KEY = 'studysync_theme';
const STORAGE_LANG_KEY = 'studysync_language';
const STORAGE_SCALE_KEY = 'studysync_font_scaling';
const STORAGE_MOTION_KEY = 'studysync_reduced_motion';

/**
 * Resolves system color scheme preference ('dark' | 'light').
 */
function getSystemTheme() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * Applies theme attribute and class to the document root element.
 */
function applyThemeToDom(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const resolved = theme === 'system' ? getSystemTheme() : theme;

  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-theme-setting', theme);
  root.classList.toggle('dark', resolved === 'dark');
}

/**
 * Resolves any font scaling value (pixel string like '16px', number, or legacy named scale)
 * to an integer pixel value between 12 and 24 (default: 16).
 */
export function fontScaleToPixels(scale) {
  if (scale === undefined || scale === null) return 16;
  if (typeof scale === 'number') {
    return Math.min(24, Math.max(12, Math.round(scale)));
  }
  const s = String(scale).toLowerCase().trim();
  if (s === 'small' || s === 'compact') return 14;
  if (s === 'large' || s === 'comfortable') return 18;
  if (s === 'standard' || s === 'default') return 16;
  const match = s.match(/^(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    return Math.min(24, Math.max(12, num));
  }
  return 16;
}

/**
 * Normalizes font scaling identifier to canonical format (e.g. '16px').
 */
export function normalizeFontScale(scale) {
  const px = fontScaleToPixels(scale);
  return `${px}px`;
}

/**
 * Applies font scaling to document root element.
 * Applies exact inline fontSize to <html> for immediate, continuous typography scaling
 * preserving relative typography hierarchy and responsive layout.
 */
export function applyFontScaleToDom(scaling) {
  if (typeof document === 'undefined') return;
  const px = fontScaleToPixels(scaling);
  const pxStr = `${px}px`;

  // 1. Set canonical font custom properties and attributes on <html>
  document.documentElement.style.setProperty('--app-font-size', pxStr);
  document.documentElement.style.setProperty('--base-font-size', pxStr);
  document.documentElement.setAttribute('data-font-size', pxStr);

  // 2. Keep <html> inline fontSize synchronized for rem consumers
  document.documentElement.style.fontSize = pxStr;

  // 3. Set categorical attribute for backwards compatibility
  let canonical = 'standard';
  if (px <= 14) canonical = 'compact';
  else if (px >= 18) canonical = 'comfortable';
  document.documentElement.setAttribute('data-font-scale', canonical);
}

/**
 * Applies reduced motion preference to document root element.
 */
function applyReducedMotionToDom(reduced) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-reduced-motion', reduced ? 'true' : 'false');
}

export function PreferencesProvider({ children }) {
  const { user, isAuthenticated } = useAuth();

  // Initial local state from localStorage or defaults
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_THEME_KEY) || 'system';
    } catch {
      return 'system';
    }
  });

  const [language, setLanguageState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_LANG_KEY) || 'en';
    } catch {
      return 'en';
    }
  });

  const [fontScaling, setFontScalingState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SCALE_KEY);
      return normalizeFontScale(saved || '16px');
    } catch {
      return '16px';
    }
  });

  const [reducedMotion, setReducedMotionState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_MOTION_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState(null);

  // Calculate effective theme currently rendered
  const effectiveTheme = useMemo(() => {
    return theme === 'system' ? getSystemTheme() : theme;
  }, [theme]);

  // Apply visual attributes to DOM whenever preferences change
  useEffect(() => {
    applyThemeToDom(theme);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    applyFontScaleToDom(fontScaling);
    try {
      localStorage.setItem(STORAGE_SCALE_KEY, fontScaling);
    } catch {}
  }, [fontScaling]);

  useEffect(() => {
    applyReducedMotionToDom(reducedMotion);
    try {
      localStorage.setItem(STORAGE_MOTION_KEY, String(reducedMotion));
    } catch {}
  }, [reducedMotion]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LANG_KEY, language);
      document.documentElement.setAttribute('lang', language);
    } catch {}
  }, [language]);

  // Dynamic listener for OS dark mode changes when in 'system' mode
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyThemeToDom('system');
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // Retrieve user settings from backend on login or session load
  const loadUserSettings = useCallback(async () => {
    if (!isAuthenticated) {
      setSettings(null);
      return;
    }

    setIsLoading(true);
    setSettingsError(null);

    try {
      const res = await apiClient.getSettings();
      if (res.ok && res.data?.success) {
        const fetched = res.data.data;
        setSettings(fetched);

        if (fetched.theme && ['light', 'dark', 'system'].includes(fetched.theme)) {
          setThemeState(fetched.theme);
          applyThemeToDom(fetched.theme);
        }
        if (fetched.language && ['en', 'ta'].includes(fetched.language)) {
          setLanguageState(fetched.language);
        }
        if (fetched.fontScaling) {
          const normalized = normalizeFontScale(fetched.fontScaling);
          setFontScalingState(normalized);
          applyFontScaleToDom(normalized);
        }
        if (fetched.reducedMotion !== undefined) {
          setReducedMotionState(Boolean(fetched.reducedMotion));
          applyReducedMotionToDom(Boolean(fetched.reducedMotion));
        }
      } else if (!res.isAvailable) {
        setSettingsError('Backend server offline. Operating in local preferences mode.');
      } else {
        setSettingsError(res.data?.error?.message || 'Failed to retrieve saved preferences');
      }
    } catch (err) {
      setSettingsError(err.message || 'Error loading preferences from server');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadUserSettings();
  }, [loadUserSettings]);

  // Theme Setter
  const setTheme = useCallback(
    async (newTheme) => {
      if (!['light', 'dark', 'system'].includes(newTheme)) return;
      setThemeState(newTheme);
      applyThemeToDom(newTheme);

      if (isAuthenticated) {
        try {
          await apiClient.updateSettings({ theme: newTheme });
        } catch {
          // Local state already updated
        }
      }
    },
    [isAuthenticated]
  );

  // Language Setter
  const setLanguage = useCallback(
    async (newLang) => {
      if (!['en', 'ta'].includes(newLang)) return;
      setLanguageState(newLang);

      if (isAuthenticated) {
        try {
          await apiClient.updateSettings({ language: newLang });
        } catch {
          // Local state already updated
        }
      }
    },
    [isAuthenticated]
  );

  // Font Scaling Setter
  const setFontScaling = useCallback(
    async (scale) => {
      const normalized = normalizeFontScale(scale);
      setFontScalingState(normalized);
      applyFontScaleToDom(normalized);

      if (isAuthenticated) {
        try {
          await apiClient.updateSettings({ fontScaling: normalized });
        } catch {}
      }
    },
    [isAuthenticated]
  );

  // Reduced Motion Setter
  const setReducedMotion = useCallback(
    async (reduced) => {
      const boolVal = Boolean(reduced);
      setReducedMotionState(boolVal);
      applyReducedMotionToDom(boolVal);

      if (isAuthenticated) {
        try {
          await apiClient.updateSettings({ reducedMotion: boolVal });
        } catch {}
      }
    },
    [isAuthenticated]
  );

  // Full Settings Update (used by Settings Page Form)
  const saveFullSettings = useCallback(
    async (settingsPayload) => {
      setIsSaving(true);
      setSettingsError(null);

      try {
        const res = await apiClient.updateSettings(settingsPayload);

        if (!res.isAvailable) {
          const msg = 'Network failure: Unable to reach backend server. Changes could not be saved.';
          setSettingsError(msg);
          setIsSaving(false);
          return { success: false, error: msg };
        }

        if (!res.ok || !res.data?.success) {
          const msg = res.data?.error?.message || 'Server rejected preferences update';
          setSettingsError(msg);
          setIsSaving(false);
          return { success: false, error: msg, details: res.data?.error?.details };
        }

        const updated = res.data.data;
        setSettings(updated);

        // Apply immediately to current UI
        if (updated.theme) {
          setThemeState(updated.theme);
          applyThemeToDom(updated.theme);
        }
        if (updated.language) {
          setLanguageState(updated.language);
        }
        if (updated.fontScaling) {
          const normalized = normalizeFontScale(updated.fontScaling);
          setFontScalingState(normalized);
          applyFontScaleToDom(normalized);
        }
        if (updated.reducedMotion !== undefined) {
          setReducedMotionState(Boolean(updated.reducedMotion));
          applyReducedMotionToDom(Boolean(updated.reducedMotion));
        }

        setIsSaving(false);
        return { success: true, settings: updated };
      } catch (err) {
        const msg = err.message || 'An unexpected error occurred while saving preferences';
        setSettingsError(msg);
        setIsSaving(false);
        return { success: false, error: msg };
      }
    },
    []
  );

  // Translation helper function
  const t = useCallback(
    (key, fallback = '', params = {}) => {
      return translate(key, language, fallback, params);
    },
    [language]
  );

  const value = {
    theme,
    effectiveTheme,
    language,
    fontScaling,
    reducedMotion,
    settings,
    isLoading,
    isSaving,
    settingsError,
    supportedLanguages: SUPPORTED_LANGUAGES,
    t,
    setTheme,
    setLanguage,
    setFontScaling,
    setReducedMotion,
    saveFullSettings,
    refreshSettings: loadUserSettings,
  };

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}

export default PreferencesContext;
