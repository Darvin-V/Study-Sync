import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePreferences, normalizeFontScale, fontScaleToPixels } from '../context/PreferencesContext';
import apiClient from '../utils/apiClient';

/**
 * Minimal, Accessible Toggle Component (Instagram / iOS Style)
 */
function Toggle({ id, checked, onChange, disabled, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={Boolean(checked)}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`settings-toggle ${checked ? 'checked' : ''}`}
    >
      <span className="settings-toggle-thumb" />
    </button>
  );
}

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 24;
const DEFAULT_FONT_SIZE = 16;

/**
 * StudySync AI — Settings Page (Clean, Minimal, Familiar Single-List Design)
 * Inspired by the effortless simplicity of Instagram, LinkedIn, and iOS Settings.
 */
export function Settings() {
  const { user, profile, updateProfile, logout } = useAuth();
  const {
    theme,
    language,
    fontScaling,
    reducedMotion,
    settings,
    setTheme,
    setLanguage,
    setFontScaling,
    setReducedMotion,
    saveFullSettings,
    t,
  } = usePreferences();

  // Local form state
  const [formData, setFormData] = useState({
    theme: 'system',
    fontScaling: 'standard',
    language: 'en',
    reducedMotion: false,
    focusDuration: '45',
    breakDuration: '5',
    roomAudioVideo: 'muted',
    primaryStudyLanguage: 'English',
    suppressInAppNotifications: true,
    breakRemindersEnabled: true,
    audioChimeEnabled: false,
    fullName: '',
    degree: '',
    profileVisibility: 'public',
    showLearningPreferences: true,
    allowStudyInvites: true,
  });

  const [savingStatus, setSavingStatus] = useState(null); // 'saving' | 'saved' | 'error' | null
  const [statusMessage, setStatusMessage] = useState(null);
  const saveTimeoutRef = useRef(null);
  const debounceProfileRef = useRef(null);
  const debounceFontScalingRef = useRef(null);

  // Synchronize from backend / context
  useEffect(() => {
    setFormData({
      theme: settings?.theme || theme || 'system',
      fontScaling: normalizeFontScale(settings?.fontScaling || fontScaling || '16px'),
      language: settings?.language || language || 'en',
      reducedMotion: settings?.reducedMotion !== undefined ? Boolean(settings.reducedMotion) : Boolean(reducedMotion),
      focusDuration: String(settings?.focusDuration || profile?.preferredStudyDuration || 45),
      breakDuration: String(settings?.breakDuration || 5),
      roomAudioVideo: settings?.roomAudioVideo || 'muted',
      primaryStudyLanguage: settings?.primaryStudyLanguage || profile?.preferredLanguages?.[0] || user?.preferredLanguages?.[0] || 'English',
      suppressInAppNotifications: settings?.suppressInAppNotifications !== undefined ? Boolean(settings.suppressInAppNotifications) : true,
      breakRemindersEnabled: settings?.breakRemindersEnabled !== undefined ? Boolean(settings.breakRemindersEnabled) : true,
      audioChimeEnabled: settings?.audioChimeEnabled !== undefined ? Boolean(settings.audioChimeEnabled) : false,
      fullName: user?.displayName || user?.name || '',
      degree: profile?.headline || user?.degree || '',
      profileVisibility: settings?.profileVisibility || 'public',
      showLearningPreferences: settings?.showLearningPreferences !== undefined ? Boolean(settings.showLearningPreferences) : true,
      allowStudyInvites: settings?.allowStudyInvites !== undefined ? Boolean(settings.allowStudyInvites) : true,
    });
  }, [settings, profile, user, theme, language, fontScaling, reducedMotion]);

  // Clean trigger for unobtrusive "Saved" feedback
  const triggerSavedPill = useCallback(() => {
    setSavingStatus('saved');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSavingStatus(null);
    }, 2000);
  }, []);

  // Clean trigger for unobtrusive "Error" feedback
  const triggerErrorPill = useCallback(() => {
    setSavingStatus('error');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSavingStatus(null);
    }, 3000);
  }, []);

  // Selected label for font size badge (e.g. 15px, 16px, 17px)
  const getScaleLabel = useCallback((scale) => {
    const px = fontScaleToPixels(scale);
    return `${px}px`;
  }, []);

  // Smooth continuous font scaling handler (immediate visual update + debounced persistence)
  const handleFontScalingChange = useCallback(
    (rawVal) => {
      const px = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, parseInt(rawVal, 10) || DEFAULT_FONT_SIZE));
      const pxStr = `${px}px`;

      // 1. Immediate visual and form state update in 0ms
      setFormData((prev) => ({ ...prev, fontScaling: pxStr }));
      setFontScaling(pxStr);

      // 2. Debounce persistence so smooth dragging does not flood the network
      setSavingStatus('saving');
      if (debounceFontScalingRef.current) clearTimeout(debounceFontScalingRef.current);
      debounceFontScalingRef.current = setTimeout(async () => {
        const payload = {
          fontScaling: pxStr,
        };
        const res = await saveFullSettings(payload);
        if (res && res.success) {
          triggerSavedPill();
        } else {
          triggerErrorPill();
        }
      }, 350);
    },
    [setFontScaling, saveFullSettings, triggerSavedPill, triggerErrorPill]
  );

  // Auto-save setting change immediately to backend
  const updateSetting = useCallback(
    async (field, value) => {
      // 1. Update state locally
      const canonicalValue = field === 'fontScaling' ? normalizeFontScale(value) : value;
      const nextData = { ...formData, [field]: canonicalValue };
      setFormData(nextData);

      // 2. Immediate reactive application for visuals
      if (field === 'theme') setTheme(canonicalValue);
      if (field === 'language') setLanguage(canonicalValue);
      if (field === 'fontScaling') setFontScaling(canonicalValue);
      if (field === 'reducedMotion') setReducedMotion(canonicalValue);

      setSavingStatus('saving');

      // 3. Persist to backend
      const payload = {
        theme: nextData.theme,
        language: nextData.language,
        fontScaling: nextData.fontScaling,
        reducedMotion: Boolean(nextData.reducedMotion),
        focusDuration: parseInt(nextData.focusDuration, 10) || 45,
        breakDuration: parseInt(nextData.breakDuration, 10) || 5,
        roomAudioVideo: nextData.roomAudioVideo,
        primaryStudyLanguage: nextData.primaryStudyLanguage,
        suppressInAppNotifications: Boolean(nextData.suppressInAppNotifications),
        breakRemindersEnabled: Boolean(nextData.breakRemindersEnabled),
        audioChimeEnabled: Boolean(nextData.audioChimeEnabled),
        profileVisibility: nextData.profileVisibility,
        showLearningPreferences: Boolean(nextData.showLearningPreferences),
        allowStudyInvites: Boolean(nextData.allowStudyInvites),
      };

      const result = await saveFullSettings(payload);
      if (result && result.success) {
        triggerSavedPill();
      } else {
        triggerErrorPill();
      }
    },
    [formData, setTheme, setLanguage, setFontScaling, setReducedMotion, saveFullSettings, triggerSavedPill, triggerErrorPill]
  );

  // Auto-save debounced profile fields (Name, Degree)
  const handleProfileFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (debounceProfileRef.current) clearTimeout(debounceProfileRef.current);
    debounceProfileRef.current = setTimeout(async () => {
      setSavingStatus('saving');
      const res = await updateProfile({
        displayName: field === 'fullName' ? value : formData.fullName,
        headline: field === 'degree' ? value : formData.degree,
      });
      if (res && res.success) {
        triggerSavedPill();
      } else {
        triggerErrorPill();
      }
    }, 600);
  };

  // Immediate save on input blur
  const handleProfileFieldBlur = async (field, value) => {
    if (debounceProfileRef.current) clearTimeout(debounceProfileRef.current);
    setSavingStatus('saving');
    const res = await updateProfile({
      displayName: field === 'fullName' ? value : formData.fullName,
      headline: field === 'degree' ? value : formData.degree,
    });
    if (res && res.success) {
      triggerSavedPill();
    } else {
      triggerErrorPill();
    }
  };

  // Reset to system defaults
  const handleResetDefaults = async () => {
    const defaults = {
      theme: 'system',
      fontScaling: '16px',
      language: 'en',
      reducedMotion: false,
      focusDuration: '45',
      breakDuration: '5',
      roomAudioVideo: 'muted',
      primaryStudyLanguage: 'English',
      suppressInAppNotifications: true,
      breakRemindersEnabled: true,
      audioChimeEnabled: false,
      profileVisibility: 'public',
      showLearningPreferences: true,
      allowStudyInvites: true,
    };

    setTheme('system');
    setLanguage('en');
    setFontScaling('16px');
    setReducedMotion(false);
    setFormData((prev) => ({ ...prev, ...defaults }));

    setSavingStatus('saving');
    const res = await saveFullSettings({
      ...defaults,
      focusDuration: 45,
      breakDuration: 5,
    });
    if (res && res.success) {
      triggerSavedPill();
      setStatusMessage(t('settings.status.resetSuccess', 'Preferences reset to default values.'));
      setTimeout(() => setStatusMessage(null), 3000);
    } else {
      triggerErrorPill();
    }
  };

  // Clear learning history
  const handleClearHistory = async () => {
    try {
      setSavingStatus('saving');
      const res = await apiClient.clearLearningPreferences();
      if (res && res.ok && res.data?.success) {
        triggerSavedPill();
        setStatusMessage(t('settings.status.historyCleared', 'Learning history cleared.'));
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        triggerErrorPill();
      }
    } catch {
      triggerErrorPill();
    }
  };

  return (
    <div className="settings-page-container" id="settings-page">
      {/* Page Title & Status Pill */}
      <div className="settings-title-row" id="settings-page-header">
        <h1 className="settings-page-title">{t('nav.settings', 'Settings')}</h1>
        {savingStatus === 'saved' && (
          <span className="settings-save-pill" id="settings-status-saved">
            {t('settings.status.saved', '✓ Saved')}
          </span>
        )}
        {savingStatus === 'saving' && (
          <span className="settings-save-pill saving" id="settings-status-saving">
            {t('settings.status.saving', 'Saving...')}
          </span>
        )}
        {savingStatus === 'error' && (
          <span className="settings-save-pill error" id="settings-status-error">
            {t('settings.status.saveFailed', t('settings.status.error', 'Save failed'))}
          </span>
        )}
      </div>

      {statusMessage && (
        <div className="settings-save-pill" style={{ width: 'fit-content', color: 'var(--color-text-primary)' }}>
          {statusMessage}
        </div>
      )}

      {/* 1. APPEARANCE */}
      <div className="settings-section-wrap">
        <div className="settings-section-title">{t('settings.section.appearance', 'Appearance')}</div>
        <div className="settings-group">
          {/* Theme */}
          <div className="settings-item">
            <span className="settings-item-name">{t('settings.item.theme', 'Theme')}</span>
            <div className="settings-item-control">
              <select
                id="setting-theme"
                className="settings-clean-select"
                value={formData.theme}
                onChange={(e) => updateSetting('theme', e.target.value)}
              >
                <option value="light">{t('settings.option.light', 'Light')}</option>
                <option value="dark">{t('settings.option.dark', 'Dark')}</option>
                <option value="system">{t('settings.option.system', 'System')}</option>
              </select>
            </div>
          </div>

          {/* Text Size Slider */}
          {(() => {
            const currentFontSizePx = fontScaleToPixels(formData.fontScaling);
            const fillPct = Math.max(0, Math.min(100, ((currentFontSizePx - MIN_FONT_SIZE) / (MAX_FONT_SIZE - MIN_FONT_SIZE)) * 100));
            return (
              <div className="settings-item settings-item-slider">
                <div className="settings-slider-label-group">
                  <span className="settings-item-name">{t('settings.item.textSize', 'Text Size')}</span>
                  <span className="settings-slider-badge" id="setting-text-size-value">
                    {getScaleLabel(formData.fontScaling)}
                  </span>
                  {currentFontSizePx !== DEFAULT_FONT_SIZE && (
                    <button
                      type="button"
                      id="setting-reset-font-size"
                      className="settings-reset-font-btn"
                      onClick={() => handleFontScalingChange(DEFAULT_FONT_SIZE)}
                      title={t('settings.action.resetFont', 'Reset text size to 16px default')}
                    >
                      {t('common.reset', 'Reset')}
                    </button>
                  )}
                </div>
                <div
                  className="settings-slider-control"
                  style={{ '--slider-fill-pct': `${fillPct}%` }}
                >
                  <input
                    type="range"
                    id="setting-font-scaling"
                    className="settings-slider-input"
                    min={MIN_FONT_SIZE}
                    max={MAX_FONT_SIZE}
                    step="1"
                    value={currentFontSizePx}
                    onChange={(e) => handleFontScalingChange(e.target.value)}
                    aria-label={t('settings.item.textSize', 'Text Size')}
                    aria-valuemin={MIN_FONT_SIZE}
                    aria-valuemax={MAX_FONT_SIZE}
                    aria-valuenow={currentFontSizePx}
                    aria-valuetext={getScaleLabel(formData.fontScaling)}
                  />
                  <div className="settings-slider-ticks" aria-hidden="true">
                    <button
                      type="button"
                      className={`settings-slider-tick-btn tick-min ${currentFontSizePx === MIN_FONT_SIZE ? 'active' : ''}`}
                      onClick={() => handleFontScalingChange(MIN_FONT_SIZE)}
                      tabIndex="-1"
                      title={`${MIN_FONT_SIZE}px (${t('settings.option.small', 'Small')})`}
                    >
                      {MIN_FONT_SIZE}px
                    </button>
                    <button
                      type="button"
                      className={`settings-slider-tick-btn tick-default ${currentFontSizePx === DEFAULT_FONT_SIZE ? 'active' : ''}`}
                      onClick={() => handleFontScalingChange(DEFAULT_FONT_SIZE)}
                      tabIndex="-1"
                      title={`${DEFAULT_FONT_SIZE}px (${t('settings.option.default', 'Default')})`}
                    >
                      {DEFAULT_FONT_SIZE}px ({t('settings.option.default', 'Default')})
                    </button>
                    <button
                      type="button"
                      className={`settings-slider-tick-btn tick-max ${currentFontSizePx === MAX_FONT_SIZE ? 'active' : ''}`}
                      onClick={() => handleFontScalingChange(MAX_FONT_SIZE)}
                      tabIndex="-1"
                      title={`${MAX_FONT_SIZE}px (${t('settings.option.large', 'Large')})`}
                    >
                      {MAX_FONT_SIZE}px
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Interface Language */}
          <div className="settings-item">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="settings-item-name">{t('settings.item.language', 'Interface Language')}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {t('settings.item.languageDesc', 'App navigation, labels, buttons, and system messages')}
              </span>
            </div>
            <div className="settings-item-control">
              <select
                id="setting-language"
                className="settings-clean-select"
                value={formData.language}
                onChange={(e) => updateSetting('language', e.target.value)}
              >
                <option value="en">{t('settings.option.english', 'English')}</option>
                <option value="ta">{t('settings.option.tamil', 'தமிழ்')}</option>
              </select>
            </div>
          </div>

          {/* Reduce Motion */}
          <div className="settings-item">
            <span className="settings-item-name">{t('settings.item.reduceMotion', 'Reduce Motion')}</span>
            <div className="settings-item-control">
              <Toggle
                id="setting-reduced-motion"
                ariaLabel={t('settings.item.reduceMotion', 'Reduce Motion')}
                checked={formData.reducedMotion}
                onChange={(checked) => updateSetting('reducedMotion', checked)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. STUDY PREFERENCES */}
      <div className="settings-section-wrap">
        <div className="settings-section-title">{t('settings.section.study', 'Study Preferences')}</div>
        <div className="settings-group">
          {/* Focus Session */}
          <div className="settings-item">
            <span className="settings-item-name">{t('settings.item.focusSession', 'Focus Session')}</span>
            <div className="settings-item-control">
              <select
                id="setting-focus-duration"
                className="settings-clean-select"
                value={formData.focusDuration}
                onChange={(e) => updateSetting('focusDuration', e.target.value)}
              >
                <option value="25">25 {t('settings.option.minutes', 'min')}</option>
                <option value="45">45 {t('settings.option.minutes', 'min')}</option>
                <option value="60">60 {t('settings.option.minutes', 'min')}</option>
                <option value="90">90 {t('settings.option.minutes', 'min')}</option>
              </select>
            </div>
          </div>

          {/* Break Time */}
          <div className="settings-item">
            <span className="settings-item-name">{t('settings.item.breakTime', 'Break Time')}</span>
            <div className="settings-item-control">
              <select
                id="setting-break-duration"
                className="settings-clean-select"
                value={formData.breakDuration}
                onChange={(e) => updateSetting('breakDuration', e.target.value)}
              >
                <option value="5">5 {t('settings.option.minutes', 'min')}</option>
                <option value="10">10 {t('settings.option.minutes', 'min')}</option>
                <option value="15">15 {t('settings.option.minutes', 'min')}</option>
              </select>
            </div>
          </div>

          {/* Microphone in Rooms */}
          <div className="settings-item">
            <span className="settings-item-name">{t('settings.item.micRooms', 'Microphone in Rooms')}</span>
            <div className="settings-item-control">
              <select
                id="setting-audio-video"
                className="settings-clean-select"
                value={formData.roomAudioVideo}
                onChange={(e) => updateSetting('roomAudioVideo', e.target.value)}
              >
                <option value="muted">{t('settings.option.muted', 'Muted')}</option>
                <option value="mic-only">{t('settings.option.ready', 'Ready')}</option>
              </select>
            </div>
          </div>

          {/* Study Language */}
          <div className="settings-item">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="settings-item-name">{t('settings.item.studyLanguage', 'Primary Study Language')}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {t('settings.item.studyLanguageDesc', 'Primary language for collaborative study sessions')}
              </span>
            </div>
            <div className="settings-item-control">
              <select
                id="setting-primary-language"
                className="settings-clean-select"
                value={formData.primaryStudyLanguage}
                onChange={(e) => updateSetting('primaryStudyLanguage', e.target.value)}
              >
                <option value="English">{t('settings.option.english', 'English')}</option>
                <option value="Tamil">{t('settings.option.tamil', 'தமிழ்')}</option>
                <option value="Multilingual">{t('settings.option.any', 'Any')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. NOTIFICATIONS */}
      <div className="settings-section-wrap">
        <div className="settings-section-title">{t('settings.section.notifications', 'Notifications')}</div>
        <div className="settings-group">
          {/* Focus Shield */}
          <div className="settings-item">
            <span className="settings-item-name">{t('settings.item.focusShield', 'Focus Shield')}</span>
            <div className="settings-item-control">
              <Toggle
                id="setting-suppress-notifications"
                ariaLabel={t('settings.item.focusShield', 'Focus Shield')}
                checked={formData.suppressInAppNotifications}
                onChange={(checked) => updateSetting('suppressInAppNotifications', checked)}
              />
            </div>
          </div>

          {/* Break Reminders */}
          <div className="settings-item">
            <span className="settings-item-name">{t('settings.item.breakReminders', 'Break Reminders')}</span>
            <div className="settings-item-control">
              <Toggle
                id="setting-break-reminders"
                ariaLabel={t('settings.item.breakReminders', 'Break Reminders')}
                checked={formData.breakRemindersEnabled}
                onChange={(checked) => updateSetting('breakRemindersEnabled', checked)}
              />
            </div>
          </div>

          {/* Session Chime */}
          <div className="settings-item">
            <span className="settings-item-name">{t('settings.item.sessionChime', 'Session End Chime')}</span>
            <div className="settings-item-control">
              <Toggle
                id="setting-audio-chime"
                ariaLabel={t('settings.item.sessionChime', 'Session End Chime')}
                checked={formData.audioChimeEnabled}
                onChange={(checked) => updateSetting('audioChimeEnabled', checked)}
              />
            </div>
          </div>

          {/* Study Invites */}
          <div className="settings-item">
            <span className="settings-item-name">{t('settings.item.studyInvites', 'Study Invites')}</span>
            <div className="settings-item-control">
              <Toggle
                id="setting-study-invites"
                ariaLabel={t('settings.item.studyInvites', 'Study Invites')}
                checked={formData.allowStudyInvites}
                onChange={(checked) => updateSetting('allowStudyInvites', checked)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. ACCOUNT & PRIVACY */}
      <div className="settings-section-wrap">
        <div className="settings-section-title">{t('settings.section.account', 'Account & Privacy')}</div>
        <div className="settings-group">
          {/* Name */}
          <div className="settings-item">
            <span className="settings-item-name">{t('settings.item.name', 'Name')}</span>
            <div className="settings-item-control">
              <input
                id="setting-fullname"
                type="text"
                className="settings-clean-input"
                value={formData.fullName}
                onChange={(e) => handleProfileFieldChange('fullName', e.target.value)}
                onBlur={(e) => handleProfileFieldBlur('fullName', e.target.value)}
                placeholder={t('settings.placeholder.name', 'Your Name')}
              />
            </div>
          </div>

          {/* Degree / Major */}
          <div className="settings-item">
            <span className="settings-item-name">{t('settings.item.degree', 'Degree / Headline')}</span>
            <div className="settings-item-control">
              <input
                id="setting-degree"
                type="text"
                className="settings-clean-input"
                value={formData.degree}
                onChange={(e) => handleProfileFieldChange('degree', e.target.value)}
                onBlur={(e) => handleProfileFieldBlur('degree', e.target.value)}
                placeholder={t('settings.placeholder.degree', 'Major or Degree')}
              />
            </div>
          </div>

          {/* Public Profile */}
          <div className="settings-item">
            <span className="settings-item-name">{t('settings.item.publicProfile', 'Public Profile')}</span>
            <div className="settings-item-control">
              <Toggle
                id="setting-discoverable"
                ariaLabel={t('settings.item.publicProfile', 'Public Profile')}
                checked={formData.profileVisibility !== 'private'}
                onChange={(checked) => updateSetting('profileVisibility', checked ? 'public' : 'private')}
              />
            </div>
          </div>

          {/* Share Study Goals */}
          <div className="settings-item">
            <span className="settings-item-name">{t('settings.item.shareGoals', 'Share Study Goals')}</span>
            <div className="settings-item-control">
              <Toggle
                id="setting-show-prefs"
                ariaLabel={t('settings.item.shareGoals', 'Share Study Goals')}
                checked={formData.showLearningPreferences}
                onChange={(checked) => updateSetting('showLearningPreferences', checked)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 5. ACCOUNT ACTIONS */}
      <div className="settings-section-wrap">
        <div className="settings-section-title">{t('settings.section.actions', 'Account Actions')}</div>
        <div className="settings-group">
          <button
            type="button"
            id="reset-settings-btn"
            className="settings-action-btn"
            onClick={handleResetDefaults}
          >
            <span>{t('settings.item.resetDefaults', 'Reset Preferences to Default')}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>&rsaquo;</span>
          </button>
          <button
            type="button"
            id="clear-learning-prefs-btn"
            className="settings-action-btn"
            onClick={handleClearHistory}
          >
            <span>{t('settings.item.clearHistory', 'Clear Learning History')}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>&rsaquo;</span>
          </button>
          <button
            type="button"
            id="settings-signout-btn"
            className="settings-action-btn danger"
            onClick={logout}
          >
            <span>{t('settings.item.signOut', 'Sign Out')}</span>
            <span style={{ color: 'var(--color-danger)' }}>&rsaquo;</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
