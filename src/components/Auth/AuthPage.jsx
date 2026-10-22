import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { ROUTES } from '../../config/routes';
import { APP_INFO } from '../../utils/constants';
import { getSafeRedirect } from './PublicOnlyRoute';
import { Button, Input } from '../UI';

/**
 * StudySync AI — Professional Authentication-First Screen
 * 
 * Implements a focused, Instagram-style authentication card tailored
 * to StudySync AI's collaborative learning platform.
 * 
 * Displays ONLY authentication and brand content:
 * - StudySync AI brand identity
 * - Headline: "Learn Better, Together."
 * - Supporting text: "Find study partners, share knowledge, and grow together."
 * - Seamless switching between Sign In and Create Account
 * - Dark/light theme toggle
 * - Prevents double-submissions during network requests
 */

import { maskEmail } from '../../utils/maskEmail.js';
export { maskEmail };

export function AuthPage({ initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'verify-otp'
  const {
    login,
    register,
    verifyOtp,
    resendOtp,
    isAuthenticated,
    isProfileCompleted,
    isLoading,
  } = useAuth();
  const { effectiveTheme, setTheme, language, setLanguage, t } = usePreferences();
  const navigate = useNavigate();
  const location = useLocation();

  // Sync mode if initialMode prop updates (preserving active OTP verification unless switched to login)
  useEffect(() => {
    setMode((prev) => {
      if (initialMode === 'login') return 'login';
      return prev === 'verify-otp' ? prev : initialMode;
    });
  }, [initialMode]);

  // Handle browser back button during OTP verification step
  useEffect(() => {
    const handlePopState = () => {
      setMode((prev) => (prev === 'verify-otp' ? 'register' : prev));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Form Fields - Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLocalError, setLoginLocalError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Form Fields - Register
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regFieldErrors, setRegFieldErrors] = useState({});
  const [isRegistering, setIsRegistering] = useState(false);

  // Form Fields - OTP Verification
  const [otpEmail, setOtpEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpLocalError, setOtpLocalError] = useState('');
  const [otpSuccessMessage, setOtpSuccessMessage] = useState('');
  const [otpDeliveryStatus, setOtpDeliveryStatus] = useState(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Six individual input refs for responsive digit boxes
  const digitInputRef0 = React.useRef(null);
  const digitInputRef1 = React.useRef(null);
  const digitInputRef2 = React.useRef(null);
  const digitInputRef3 = React.useRef(null);
  const digitInputRef4 = React.useRef(null);
  const digitInputRef5 = React.useRef(null);
  const digitInputRefs = [
    digitInputRef0,
    digitInputRef1,
    digitInputRef2,
    digitInputRef3,
    digitInputRef4,
    digitInputRef5,
  ];

  // Auto-focus first digit on OTP mode mount
  useEffect(() => {
    if (mode === 'verify-otp') {
      const timer = setTimeout(() => {
        digitInputRefs[0].current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [mode]);

  // Live countdown timer for OTP resend cooldown
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // If already authenticated, redirect to destination or home
  useEffect(() => {
    if (isAuthenticated) {
      if (!isProfileCompleted) {
        navigate(ROUTES.ONBOARDING, { replace: true });
      } else {
        const destination = location.state?.from
          ? getSafeRedirect(location.state.from)
          : ROUTES.HOME;
        navigate(destination, { replace: true });
      }
    }
  }, [isAuthenticated, isProfileCompleted, navigate, location.state]);

  // Handle Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginLocalError('');

    if (!loginEmail.trim()) {
      setLoginLocalError('Please enter your email address');
      return;
    }
    if (!loginPassword) {
      setLoginLocalError('Please enter your password');
      return;
    }

    setIsLoggingIn(true);
    const res = await login(loginEmail.trim(), loginPassword);
    setIsLoggingIn(false);

    if (res.success) {
      if (!res.isProfileCompleted) {
        navigate(ROUTES.ONBOARDING, { replace: true });
      } else {
        const destination = location.state?.from
          ? getSafeRedirect(location.state.from)
          : ROUTES.HOME;
        navigate(destination, { replace: true });
      }
    } else if (res.requiresVerification) {
      // Unverified account: seamlessly guide user to OTP verification
      setOtpEmail(res.email || loginEmail.trim());
      setOtpDigits(['', '', '', '', '', '']);
      setOtpLocalError('');
      setOtpSuccessMessage('');
      try {
        const provRes = await apiClient.getEmailProviderStatus();
        if (provRes.ok && provRes.data?.data) {
          setOtpDeliveryStatus({
            status: provRes.data.data.configured ? 'accepted' : 'unconfigured',
            message: provRes.data.data.message,
            provider: provRes.data.data.activeProvider,
          });
        } else {
          setOtpDeliveryStatus({ status: 'unconfigured' });
        }
      } catch {
        setOtpDeliveryStatus({ status: 'unconfigured' });
      }
      try {
        window.history.pushState({ authStep: 'verify-otp' }, '');
      } catch {
        // safe in tests or restricted environments
      }
      setMode('verify-otp');
    }
  };

  // Handle Register Submit
  const handleRegisterSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (isRegistering) return; // Prevent double submission

    const errs = {};

    if (!regDisplayName.trim()) {
      errs.displayName = 'Display name is required';
    } else if (regDisplayName.trim().length < 2) {
      errs.displayName = 'Display name must be at least 2 characters';
    }

    if (!regEmail.trim()) {
      errs.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    if (!regPassword) {
      errs.password = 'Password is required';
    } else if (regPassword.length < 8) {
      errs.password = 'Password must be at least 8 characters long';
    }

    if (!regConfirmPassword) {
      errs.confirmPassword = 'Confirm password is required';
    } else if (regPassword !== regConfirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    setRegFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsRegistering(true);
    try {
      const res = await register(
        regDisplayName.trim(),
        regEmail.trim(),
        regPassword,
        regConfirmPassword
      );

      if (res.success) {
        if (res.requiresVerification) {
          setOtpEmail(res.email || regEmail.trim());
          setOtpDigits(['', '', '', '', '', '']);
          setOtpLocalError('');
          setOtpDeliveryStatus(res.emailDelivery);
          setCooldownRemaining(res.resendAvailableIn || 60);
          if (res.emailDelivery?.status === 'accepted') {
            setOtpSuccessMessage('A 6-digit verification code has been dispatched to your email.');
          } else if (res.emailDelivery?.status === 'provider_rejected' || res.emailDelivery?.status === 'network_error') {
            setOtpSuccessMessage('');
            setOtpLocalError(res.emailDelivery.message || 'Email delivery provider failed to dispatch code.');
          } else {
            setOtpSuccessMessage('');
          }
          try {
            window.history.pushState({ authStep: 'verify-otp' }, '');
          } catch {
            // safe in tests or restricted environments
          }
          setMode('verify-otp');
        } else {
          navigate(ROUTES.ONBOARDING, { replace: true });
        }
      } else {
        if (
          res.code === 'EMAIL_EXISTS' ||
          res.code === 'EMAIL_NOT_VERIFIED' ||
          res.code === 'DUPLICATE_EMAIL'
        ) {
          setRegFieldErrors((prev) => ({
            ...prev,
            email: res.error || 'This email address is already registered.',
          }));
        } else if (res.error) {
          setRegFieldErrors((prev) => ({
            ...prev,
            form: res.error,
          }));
        }
      }
    } catch (err) {
      setRegFieldErrors((prev) => ({
        ...prev,
        form: err.message || 'Registration failed. Please try again.',
      }));
    } finally {
      setIsRegistering(false);
    }
  };

  // Handle individual digit change
  const handleDigitChange = (index, e) => {
    const rawVal = e.target.value;
    const cleanDigit = rawVal.replace(/\D/g, '').slice(-1);

    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = cleanDigit;
      return next;
    });
    setOtpLocalError('');

    if (cleanDigit && index < 5) {
      digitInputRefs[index + 1].current?.focus();
    }
  };

  // Handle backspace and arrow navigation
  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (otpDigits[index]) {
        setOtpDigits((prev) => {
          const next = [...prev];
          next[index] = '';
          return next;
        });
      } else if (index > 0) {
        digitInputRefs[index - 1].current?.focus();
        setOtpDigits((prev) => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      digitInputRefs[index - 1].current?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      digitInputRefs[index + 1].current?.focus();
    }
  };

  // Support pasting full 6-digit OTP code into any digit input
  const handleDigitPaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData ? e.clipboardData.getData('text') : '';
    const digits = pastedText.replace(/\D/g, '').slice(0, 6);
    if (!digits) return;

    const newDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < digits.length; i++) {
      newDigits[i] = digits[i];
    }
    setOtpDigits(newDigits);
    setOtpLocalError('');

    const nextEmptyIndex = newDigits.findIndex((d) => !d);
    if (nextEmptyIndex !== -1 && nextEmptyIndex < 6) {
      digitInputRefs[nextEmptyIndex].current?.focus();
    } else {
      digitInputRefs[5].current?.focus();
    }
  };

  // Handle OTP Verification Submit
  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    setOtpLocalError('');
    setOtpSuccessMessage('');

    const clean = otpDigits.join('').trim();
    if (!clean || !/^\d{6}$/.test(clean)) {
      setOtpLocalError('Please enter all 6 digits of the verification code.');
      return;
    }

    setIsVerifying(true);
    const res = await verifyOtp(otpEmail, clean);
    setIsVerifying(false);

    if (res.success) {
      if (!res.isProfileCompleted) {
        navigate(ROUTES.ONBOARDING, { replace: true });
      } else {
        navigate(ROUTES.HOME, { replace: true });
      }
    } else {
      setOtpLocalError(res.error || 'Verification failed. Please check your code.');
    }
  };

  // Handle Resend OTP Request
  const handleResendOtp = async () => {
    if (otpDeliveryStatus?.status === 'unconfigured') {
      setOtpLocalError('Email delivery is unavailable until provider credentials are set in the server environment.');
      return;
    }
    if (cooldownRemaining > 0 || isResending) return;
    setIsResending(true);
    setOtpLocalError('');
    setOtpSuccessMessage('');

    const res = await resendOtp(otpEmail);
    setIsResending(false);

    if (res.success) {
      setCooldownRemaining(res.data?.resendAvailableIn || 60);
      setOtpDeliveryStatus(res.data?.emailDelivery);
      if (res.data?.emailDelivery?.status === 'accepted') {
        setOtpSuccessMessage('A fresh verification code has been accepted by the email provider for dispatch.');
      } else if (res.data?.emailDelivery?.status === 'provider_rejected' || res.data?.emailDelivery?.status === 'network_error') {
        setOtpSuccessMessage('');
        setOtpLocalError(res.data?.emailDelivery?.message || 'Email delivery provider failed to dispatch code.');
      } else {
        setOtpSuccessMessage('');
      }
    } else {
      if (res.resendAvailableIn) {
        setCooldownRemaining(res.resendAvailableIn);
      }
      setOtpLocalError(res.error || 'Failed to resend code. Please try again.');
    }
  };

  // Return to registration form to modify details
  const handleBackToRegister = () => {
    setOtpLocalError('');
    setOtpDigits(['', '', '', '', '', '']);
    setMode('register');
    if (window.history.state?.authStep === 'verify-otp') {
      try {
        window.history.back();
        return;
      } catch {
        // fallback to standard navigation
      }
    }
    if (location.pathname !== ROUTES.REGISTER) {
      navigate(ROUTES.REGISTER);
    }
  };

  const toggleTheme = () => {
    setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
  };

  const displayLoginError = loginLocalError || authError;

  return (
    <div
      id="auth-page-root"
      style={{
        minHeight: '100dvh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        backgroundColor: 'var(--color-bg-app)',
        padding: 'var(--space-3, 12px) var(--space-4, 16px) var(--space-5, 20px)',
        boxSizing: 'border-box',
        position: 'relative',
        overflowY: 'auto',
      }}
    >
      {/* Top Bar with Brand & Theme Toggle */}
      <header
        style={{
          width: '100%',
          maxWidth: 440,
          padding: '8px 4px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-md, 8px)',
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-text-inverse, #ffffff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-hidden="true"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10" />
              <path d="M6 10h10" />
              <path d="M6 14h6" />
              <circle cx="18" cy="16" r="3" />
              <path d="m20.5 18.5 1.5 1.5" />
            </svg>
          </div>
          <span
            style={{
              fontWeight: 'var(--font-bold, 700)',
              fontSize: 'var(--text-md, 16px)',
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            {APP_INFO.NAME}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Quick Language Switcher */}
          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'ta' : 'en')}
            id="auth-language-toggle-btn"
            aria-label="Toggle language"
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              color: 'var(--color-text-secondary)',
              borderRadius: 'var(--radius-md, 8px)',
              padding: '6px 12px',
              fontSize: 'var(--text-xs, 12px)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            {language === 'ta' ? 'தமிழ்' : 'EN'}
          </button>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            id="auth-theme-toggle-btn"
            aria-label={`Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode`}
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              color: 'var(--color-text-secondary)',
              borderRadius: 'var(--radius-md, 8px)',
              padding: '6px 12px',
              fontSize: 'var(--text-xs, 12px)',
              fontWeight: 'var(--font-medium, 500)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            {effectiveTheme === 'dark' ? t('auth.theme.light', '☀️ Light') : t('auth.theme.dark', '🌙 Dark')}
          </button>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main
        id="auth-card-container"
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-xl, 16px)',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'var(--shadow-lg, 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04))',
          padding: 'var(--space-5, 20px)',
          boxSizing: 'border-box',
          margin: '16px 0',
          position: 'relative',
          zIndex: 5,
          pointerEvents: 'auto',
        }}
      >
        {/* Verification Back Navigation at Top-Left */}
        {mode === 'verify-otp' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              marginBottom: 'var(--space-4, 16px)',
            }}
          >
            <button
              type="button"
              onClick={handleBackToRegister}
              id="back-to-register-btn"
              aria-label="Back to registration"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--text-xs, 12px)',
                fontWeight: 'var(--font-medium, 500)',
                cursor: 'pointer',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm, 6px)',
                transition: 'all 0.15s ease',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              {language === 'ta' ? <span>{t('auth.verify.back', 'பின்செல்')}</span> : <span>Back</span>}
            </button>
          </div>
        )}

        {/* Brand Header & Tabs (for Sign In & Register) */}
        {mode !== 'verify-otp' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-5, 20px)' }}>
              <h1
                style={{
                  fontSize: 'var(--text-2xl, 24px)',
                  fontWeight: 'var(--font-bold, 700)',
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.025em',
                  margin: '0 0 8px',
                }}
              >
                {t('auth.headline', 'Learn Better, Together.')}
              </h1>
              <p
                style={{
                  fontSize: 'var(--text-sm, 14px)',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {t('auth.subheadline', 'Find study partners, share knowledge, and grow together.')}
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Authentication Mode"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                backgroundColor: 'var(--color-bg-subtle)',
                padding: 4,
                borderRadius: 'var(--radius-md, 8px)',
                marginBottom: 'var(--space-5, 20px)',
              }}
            >
              <button
                type="button"
                role="tab"
                id="auth-tab-login"
                aria-selected={mode === 'login'}
                onClick={() => {
                  setMode('login');
                  setLoginLocalError('');
                  if (location.pathname !== ROUTES.LOGIN && location.pathname !== '/') {
                    navigate(ROUTES.LOGIN);
                  }
                }}
                style={{
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  fontSize: 'var(--text-sm, 13px)',
                  fontWeight: mode === 'login' ? 'var(--font-bold, 600)' : 'var(--font-medium, 500)',
                  backgroundColor: mode === 'login' ? 'var(--color-bg-surface)' : 'transparent',
                  color: mode === 'login' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  boxShadow: mode === 'login' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  zIndex: 2,
                  pointerEvents: 'auto',
                }}
              >
                {t('auth.tab.login', 'Sign In')}
              </button>
              <button
                type="button"
                role="tab"
                id="auth-tab-register"
                aria-selected={mode === 'register'}
                onClick={() => {
                  setMode('register');
                  setRegFieldErrors({});
                  if (location.pathname !== ROUTES.REGISTER) {
                    navigate(ROUTES.REGISTER);
                  }
                }}
                style={{
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  fontSize: 'var(--text-sm, 13px)',
                  fontWeight: mode === 'register' ? 'var(--font-bold, 600)' : 'var(--font-medium, 500)',
                  backgroundColor: mode === 'register' ? 'var(--color-bg-surface)' : 'transparent',
                  color: mode === 'register' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  boxShadow: mode === 'register' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  zIndex: 2,
                  pointerEvents: 'auto',
                }}
              >
                {t('auth.tab.register', 'Create Account')}
              </button>
            </div>
          </>
        )}

        {/* ================================================================= */}
        {/* LOGIN FORM */}
        {/* ================================================================= */}
        {mode === 'login' && (
          <form
            noValidate
            onSubmit={handleLoginSubmit}
            id="login-form"
            className="stack"
            style={{ gap: 'var(--space-4, 16px)' }}
          >
            {/* Error Alert */}
            {displayLoginError && (
              <div
                id="login-error-alert"
                role="alert"
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-danger-subtle, #fef2f2)',
                  border: '1px solid var(--color-danger-border, #fecaca)',
                  color: 'var(--color-danger-text, #b91c1c)',
                  borderRadius: 'var(--radius-md, 8px)',
                  fontSize: 'var(--text-xs, 12px)',
                  lineHeight: 1.4,
                }}
              >
                {displayLoginError}
              </div>
            )}

            <Input
              id="login-email-input"
              label={t('auth.email', 'Email Address')}
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="student@example.edu"
              required
              autoComplete="email"
              disabled={isLoggingIn}
            />

            <div>
              <div className="row-between" style={{ marginBottom: 4 }}>
                <label
                  htmlFor="login-password-input"
                  style={{
                    fontSize: 'var(--text-xs, 12px)',
                    fontWeight: 'var(--font-medium, 500)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {t('auth.password', 'Password')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 'var(--text-xs, 12px)',
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    padding: 0,
                    fontWeight: 'var(--font-medium, 500)',
                  }}
                  id="toggle-password-visibility-btn"
                >
                  {showLoginPassword ? (language === 'ta' ? 'மறை' : 'Hide') : (language === 'ta' ? 'காட்டு' : 'Show')}
                </button>
              </div>
              <Input
                id="login-password-input"
                type={showLoginPassword ? 'text' : 'password'}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder', 'Enter your password')}
                required
                autoComplete="current-password"
                disabled={isLoggingIn}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              style={{ width: '100%', marginTop: 'var(--space-2, 8px)', height: 42 }}
              disabled={isLoggingIn}
              id="login-submit-btn"
            >
              {isLoggingIn ? t('auth.btn.signingIn', 'Signing In...') : t('auth.btn.signIn', 'Sign In')}
            </Button>

            {/* Switch to Register Link */}
            <div
              style={{
                textAlign: 'center',
                marginTop: 'var(--space-3, 12px)',
                fontSize: 'var(--text-xs, 12px)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {language === 'ta' ? 'கணக்கு இல்லையா? ' : "Don't have an account? "}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setRegFieldErrors({});
                  if (location.pathname !== ROUTES.REGISTER) {
                    navigate(ROUTES.REGISTER);
                  }
                }}
                id="goto-register-link"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-accent)',
                  fontWeight: 'var(--font-semibold, 600)',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 'inherit',
                  textDecoration: 'underline',
                  pointerEvents: 'auto',
                }}
              >
                Create account
              </button>
            </div>
          </form>
        )}

        {/* ================================================================= */}
        {/* REGISTER FORM */}
        {/* ================================================================= */}
        {mode === 'register' && (
          <form
            noValidate
            onSubmit={handleRegisterSubmit}
            id="register-form"
            className="stack"
            style={{ gap: 'var(--space-4, 16px)' }}
          >
            {/* Global Error Banner */}
            {(authError || regFieldErrors.form) && (
              <div
                id="register-error-alert"
                role="alert"
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-danger-subtle, #fef2f2)',
                  border: '1px solid var(--color-danger-border, #fecaca)',
                  color: 'var(--color-danger-text, #b91c1c)',
                  borderRadius: 'var(--radius-md, 8px)',
                  fontSize: 'var(--text-xs, 12px)',
                  lineHeight: 1.4,
                }}
              >
                {regFieldErrors.form || authError}
              </div>
            )}

            <div>
              <Input
                id="register-display-name-input"
                label={t('auth.fullName', 'Full Name / Display Name')}
                type="text"
                value={regDisplayName}
                onChange={(e) => {
                  setRegDisplayName(e.target.value);
                  if (regFieldErrors.displayName) {
                    setRegFieldErrors((p) => ({ ...p, displayName: null }));
                  }
                }}
                placeholder={t('auth.fullNamePlaceholder', 'e.g. Alex Morgan')}
                autoComplete="name"
                disabled={isRegistering}
                style={regFieldErrors.displayName ? { borderColor: 'var(--color-danger, #dc2626)' } : {}}
              />
              {regFieldErrors.displayName && (
                <span
                  id="register-display-name-error"
                  role="alert"
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-danger-text, #dc2626)',
                    marginTop: 4,
                    display: 'block',
                  }}
                >
                  {regFieldErrors.displayName}
                </span>
              )}
            </div>

            <div>
              <Input
                id="register-email-input"
                label={t('auth.email', 'Email Address')}
                type="email"
                value={regEmail}
                onChange={(e) => {
                  setRegEmail(e.target.value);
                  if (regFieldErrors.email) {
                    setRegFieldErrors((p) => ({ ...p, email: null }));
                  }
                }}
                placeholder="student@example.edu"
                autoComplete="email"
                disabled={isRegistering}
                style={regFieldErrors.email ? { borderColor: 'var(--color-danger, #dc2626)' } : {}}
              />
              {regFieldErrors.email && (
                <span
                  id="register-email-error"
                  role="alert"
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-danger-text, #dc2626)',
                    marginTop: 4,
                    display: 'block',
                  }}
                >
                  {regFieldErrors.email}
                </span>
              )}
            </div>

            <div>
              <div className="row-between" style={{ marginBottom: 4 }}>
                <label
                  htmlFor="register-password-input"
                  style={{
                    fontSize: 'var(--text-xs, 12px)',
                    fontWeight: 'var(--font-medium, 500)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {t('auth.passwordRequirement', 'Password (min. 8 characters)')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 'var(--text-xs, 12px)',
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    padding: 0,
                    fontWeight: 'var(--font-medium, 500)',
                  }}
                  id="toggle-register-password-visibility-btn"
                >
                  {showRegPassword ? (language === 'ta' ? 'மறை' : 'Hide') : (language === 'ta' ? 'காட்டு' : 'Show')}
                </button>
              </div>
              <Input
                id="register-password-input"
                type={showRegPassword ? 'text' : 'password'}
                value={regPassword}
                onChange={(e) => {
                  setRegPassword(e.target.value);
                  if (regFieldErrors.password) {
                    setRegFieldErrors((p) => ({ ...p, password: null }));
                  }
                }}
                placeholder={t('auth.passwordPlaceholder', 'Create a strong password')}
                autoComplete="new-password"
                disabled={isRegistering}
                style={regFieldErrors.password ? { borderColor: 'var(--color-danger, #dc2626)' } : {}}
              />
              {regFieldErrors.password && (
                <span
                  id="register-password-error"
                  role="alert"
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-danger-text, #dc2626)',
                    marginTop: 4,
                    display: 'block',
                  }}
                >
                  {regFieldErrors.password}
                </span>
              )}
            </div>

            <div>
              <Input
                id="register-confirm-password-input"
                label={language === 'ta' ? 'கடவுச்சொல்லை உறுதி செய்க' : 'Confirm Password'}
                type={showRegPassword ? 'text' : 'password'}
                value={regConfirmPassword}
                onChange={(e) => {
                  setRegConfirmPassword(e.target.value);
                  if (regFieldErrors.confirmPassword) {
                    setRegFieldErrors((p) => ({ ...p, confirmPassword: null }));
                  }
                }}
                placeholder={language === 'ta' ? 'கடவுச்சொல்லை மீண்டும் உள்ளிடவும்' : 'Re-enter your password'}
                autoComplete="new-password"
                disabled={isRegistering}
                style={regFieldErrors.confirmPassword ? { borderColor: 'var(--color-danger, #dc2626)' } : {}}
              />
              {regFieldErrors.confirmPassword && (
                <span
                  id="register-confirm-password-error"
                  role="alert"
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-danger-text, #dc2626)',
                    marginTop: 4,
                    display: 'block',
                  }}
                >
                  {regFieldErrors.confirmPassword}
                </span>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              style={{
                width: '100%',
                marginTop: 'var(--space-2, 8px)',
                minHeight: 44,
                cursor: isRegistering ? 'not-allowed' : 'pointer',
                pointerEvents: 'auto',
                position: 'relative',
                zIndex: 2,
              }}
              disabled={isRegistering}
              loading={isRegistering}
              id="register-submit-btn"
              aria-label="Create Account"
            >
              {isRegistering ? t('auth.btn.creatingAccount', 'Creating Account...') : t('auth.btn.createAccount', 'Create Account')}
            </Button>

            {/* Switch to Login Link */}
            <div
              style={{
                textAlign: 'center',
                marginTop: 'var(--space-3, 12px)',
                fontSize: 'var(--text-xs, 12px)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {language === 'ta' ? 'ஏற்கனவே கணக்கு உள்ளதா? ' : 'Already have an account? '}
              {language === 'ta' ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setLoginLocalError('');
                    if (location.pathname !== ROUTES.LOGIN) {
                      navigate(ROUTES.LOGIN);
                    }
                  }}
                  id="goto-login-link"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-accent)',
                    fontWeight: 'var(--font-semibold, 600)',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 'inherit',
                    textDecoration: 'underline',
                    pointerEvents: 'auto',
                  }}
                >
                  {t('auth.tab.login', 'உள்நுழைக')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setLoginLocalError('');
                    if (location.pathname !== ROUTES.LOGIN) {
                      navigate(ROUTES.LOGIN);
                    }
                  }}
                  id="goto-login-link"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-accent)',
                    fontWeight: 'var(--font-semibold, 600)',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 'inherit',
                    textDecoration: 'underline',
                    pointerEvents: 'auto',
                  }}
                >
                  Sign in
                </button>
              )}
            </div>
          </form>
        )}

        {/* ================================================================= */}
        {/* OTP VERIFICATION FORM (STEP 2 OF REGISTRATION JOURNEY) */}
        {/* ================================================================= */}
        {mode === 'verify-otp' && (
          <form
            noValidate
            onSubmit={handleVerifyOtpSubmit}
            id="verify-otp-form"
            className="stack"
            style={{ gap: 'var(--space-4, 16px)' }}
          >
            {/* Header info */}
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  margin: '0 auto 12px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-accent-subtle, rgba(59, 130, 246, 0.1))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                }}
              >
                🔐
              </div>
              <h2
                style={{
                  fontSize: 'var(--text-lg, 18px)',
                  fontWeight: 'var(--font-bold, 700)',
                  color: 'var(--color-text-primary)',
                  margin: '0 0 6px',
                }}
              >
                {t('auth.verify.title', 'Verify Your Email')}
              </h2>
              <p
                style={{
                  fontSize: 'var(--text-xs, 12px)',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {otpDeliveryStatus?.status === 'unconfigured'
                  ? (language === 'ta' ? 'கணக்கிற்கு சரிபார்ப்பு தேவை:' : 'Verification required for account:')
                  : (language === 'ta' ? 'சரிபார்ப்புக் குறியீடு அனுப்பப்பட்ட முகவரி:' : 'We sent a 6-digit verification code to:')}
                <br />
                <strong style={{ color: 'var(--color-text-primary)' }} id="masked-recipient-email">
                  {maskEmail(otpEmail)}
                </strong>
                {otpDeliveryStatus?.status !== 'unconfigured' && (
                  <>
                    <br />
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #64748b)', marginTop: 4, display: 'inline-block' }}>
                      (Delivered via email inbox, not mobile SMS)
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Status notification: compact, professional inline panel */}
            {(() => {
              if (otpDeliveryStatus?.status === 'unconfigured') {
                return (
                  <div
                    id="otp-unconfigured-notice"
                    role="alert"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      backgroundColor: 'var(--color-warning-subtle, #fffbeb)',
                      border: '1px solid var(--color-warning-border, #fde68a)',
                      color: 'var(--color-warning-text, #92400e)',
                      borderRadius: 'var(--radius-md, 8px)',
                      fontSize: 'var(--text-xs, 12px)',
                      lineHeight: 1.4,
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0, opacity: 0.9 }}
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>Email verification is temporarily unavailable. Please try again later.</span>
                  </div>
                );
              }

              if (otpDeliveryStatus?.status === 'provider_rejected' || otpDeliveryStatus?.status === 'network_error') {
                return (
                  <div
                    id="otp-delivery-failed-notice"
                    role="alert"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      backgroundColor: 'var(--color-danger-subtle, #fef2f2)',
                      border: '1px solid var(--color-danger-border, #fecaca)',
                      color: 'var(--color-danger-text, #b91c1c)',
                      borderRadius: 'var(--radius-md, 8px)',
                      fontSize: 'var(--text-xs, 12px)',
                      lineHeight: 1.4,
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0, opacity: 0.9 }}
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    <span>Email delivery failed. Please try resending the code.</span>
                  </div>
                );
              }

              if (otpDeliveryStatus?.status === 'accepted') {
                return (
                  <div
                    id="otp-accepted-notice"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      backgroundColor: 'var(--color-success-subtle, #f0fdf4)',
                      border: '1px solid var(--color-success-border, #bbf7d0)',
                      color: 'var(--color-success-text, #15803d)',
                      borderRadius: 'var(--radius-md, 8px)',
                      fontSize: 'var(--text-xs, 12px)',
                      lineHeight: 1.4,
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0, opacity: 0.9 }}
                      aria-hidden="true"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span>Verification code sent. Please check your inbox and spam folder.</span>
                  </div>
                );
              }

              if (otpSuccessMessage) {
                return (
                  <div
                    id="otp-success-alert"
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--color-success-subtle, #f0fdf4)',
                      border: '1px solid var(--color-success-border, #bbf7d0)',
                      color: 'var(--color-success-text, #15803d)',
                      borderRadius: 'var(--radius-md, 8px)',
                      fontSize: 'var(--text-xs, 12px)',
                    }}
                  >
                    {otpSuccessMessage}
                  </div>
                );
              }

              return null;
            })()}

            {/* Error banner */}
            {otpLocalError && (
              <div
                id="otp-error-alert"
                role="alert"
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-danger-subtle, #fef2f2)',
                  border: '1px solid var(--color-danger-border, #fecaca)',
                  color: 'var(--color-danger-text, #b91c1c)',
                  borderRadius: 'var(--radius-md, 8px)',
                  fontSize: 'var(--text-xs, 12px)',
                  lineHeight: 1.4,
                }}
              >
                {otpLocalError}
              </div>
            )}

            {otpDeliveryStatus?.status === 'unconfigured' ? (
              <div
                id="otp-unavailable-state-container"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 0 4px',
                  textAlign: 'center',
                }}
              >
                <p
                  style={{
                    fontSize: 'var(--text-xs, 12px)',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  Your registration details have been securely recorded. Account activation will resume once the email service is restored.
                </p>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleBackToRegister}
                  style={{ width: '100%', marginTop: 'var(--space-2, 8px)', height: 42 }}
                  id="return-to-registration-btn"
                >
                  {t('auth.verify.returnToRegister', 'Return to Registration')}
                </Button>
              </div>
            ) : (
              <>
                {/* Six Responsive OTP Digit Boxes */}
                <div className="stack-sm">
                  <label
                    htmlFor="otp-digit-0"
                    style={{
                      fontSize: 'var(--text-xs, 12px)',
                      fontWeight: 'var(--font-medium, 500)',
                      color: 'var(--color-text-secondary)',
                      textAlign: 'center',
                      display: 'block',
                    }}
                  >
                    {t('auth.verify.codeLabel', 'Enter 6-Digit Verification Code')}
                  </label>

                  {/* Synchronized hidden code input for programmatic/accessibility access */}
                  <input
                    type="hidden"
                    id="otp-code-input"
                    name="otp"
                    value={otpDigits.join('')}
                  />

                  <div
                    id="otp-digits-container"
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 'clamp(6px, 2vw, 12px)',
                      width: '100%',
                      padding: '8px 0',
                    }}
                  >
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={digitInputRefs[idx]}
                        id={`otp-digit-${idx}`}
                        type="text"
                        inputMode="numeric"
                        autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e)}
                        onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                        onPaste={handleDigitPaste}
                        onFocus={(e) => e.target.select()}
                        disabled={isVerifying}
                        aria-label={`Digit ${idx + 1} of 6`}
                        style={{
                          width: 'clamp(38px, 12vw, 50px)',
                          height: 'clamp(46px, 14vw, 56px)',
                          fontSize: 'clamp(20px, 5vw, 26px)',
                          fontWeight: 'var(--font-bold, 700)',
                          fontFamily: 'monospace',
                          textAlign: 'center',
                          borderRadius: 'var(--radius-md, 8px)',
                          border: digit
                            ? '2px solid var(--color-accent, #3b82f6)'
                            : '2px solid var(--color-border-default, #cbd5e1)',
                          backgroundColor: 'var(--color-bg-surface, #ffffff)',
                          color: 'var(--color-text-primary, #0f172a)',
                          boxSizing: 'border-box',
                          outline: 'none',
                          transition: 'border-color 0.15s ease',
                        }}
                      />
                    ))}
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-text-muted)',
                      textAlign: 'center',
                      display: 'block',
                      marginTop: 2,
                    }}
                  >
                    {t('auth.verify.expiresIn', 'Code expires in 10 minutes')}
                  </span>
                </div>

                {/* Step 2 Primary Action: Verify Email */}
                <Button
                  type="submit"
                  variant="primary"
                  style={{ width: '100%', marginTop: 'var(--space-2, 8px)', height: 42 }}
                  disabled={isVerifying || otpDigits.join('').length !== 6}
                  id="verify-otp-submit-btn"
                >
                  {isVerifying ? t('auth.verify.verifying', 'Verifying Code...') : t('auth.verify.verifyBtn', 'Verify Email')}
                </Button>

                {/* Resend OTP Action directly below primary button — restored only when email delivery is available */}
                <div
                  id="resend-otp-container"
                  style={{
                    textAlign: 'center',
                    marginTop: 'var(--space-3, 12px)',
                    fontSize: 'var(--text-xs, 12px)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {t('auth.verify.didntReceive', "Didn't receive the email?")}{' '}
                  {cooldownRemaining > 0 ? (
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 'var(--font-medium, 500)' }}>
                      {language === 'ta' ? `${cooldownRemaining} வினாடிகளில் மீண்டும் அனுப்பலாம்` : `Resend code in ${cooldownRemaining}s`}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isResending}
                      id="resend-otp-btn"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-accent)',
                        fontWeight: 'var(--font-semibold, 600)',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: 'inherit',
                        textDecoration: 'underline',
                      }}
                    >
                      {isResending ? t('auth.verify.resending', 'Sending...') : t('auth.verify.resend', 'Resend OTP')}
                    </button>
                  )}
                </div>
              </>
            )}
          </form>
        )}
      </main>

      {/* Footer copyright */}
      <footer
        style={{
          marginTop: 'auto',
          paddingTop: '16px',
          textAlign: 'center',
          fontSize: '11px',
          color: 'var(--color-text-muted)',
          flexShrink: 0,
        }}
      >
        &copy; {new Date().getFullYear()} StudySync AI &bull; Intelligent Peer-Learning Platform
      </footer>
    </div>
  );
}

export default AuthPage;
