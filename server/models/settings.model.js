import { getDb, withTransaction } from '../db/connection.js';
import ProfileModel from './profile.model.js';
import FocusModel from './focus.model.js';
import SafetyModel from './safety.model.js';
import UserModel from './user.model.js';

/**
 * StudySync AI — User Settings Model (Phase 3)
 * 
 * Manages user interface preferences (theme, language, typography, motion)
 * and harmonizes settings with existing profile, distraction shield, and privacy stores.
 */
export const SettingsModel = {
  /**
   * Retrieves user_settings row for a specific user, creating default if absent.
   */
  findByUserId(userId, customDb = null) {
    const db = customDb || getDb();
    let settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);

    if (!settings) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO user_settings (user_id, theme, language, font_scaling, reduced_motion, room_audio_video, created_at, updated_at)
        VALUES (?, 'system', 'en', 'standard', 0, 'muted', ?, ?)
        ON CONFLICT(user_id) DO NOTHING
      `).run(userId, now, now);

      settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
    }

    return settings;
  },

  /**
   * Upserts core UI settings row.
   */
  upsert(userId, data, customDb = null) {
    const db = customDb || getDb();
    const existing = this.findByUserId(userId, db);
    const now = new Date().toISOString();

    const theme = data.theme !== undefined ? data.theme : (existing?.theme || 'system');
    const language = data.language !== undefined ? data.language : (existing?.language || 'en');
    const fontScaling = data.fontScaling !== undefined ? data.fontScaling : (existing?.font_scaling || 'standard');
    const reducedMotion = data.reducedMotion !== undefined ? (data.reducedMotion ? 1 : 0) : (existing?.reduced_motion || 0);
    const roomAudioVideo = data.roomAudioVideo !== undefined ? data.roomAudioVideo : (existing?.room_audio_video || 'muted');

    db.prepare(`
      INSERT INTO user_settings (user_id, theme, language, font_scaling, reduced_motion, room_audio_video, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        theme = excluded.theme,
        language = excluded.language,
        font_scaling = excluded.font_scaling,
        reduced_motion = excluded.reduced_motion,
        room_audio_video = excluded.room_audio_video,
        updated_at = excluded.updated_at
    `).run(userId, theme, language, fontScaling, reducedMotion, roomAudioVideo, now, now);

    return this.findByUserId(userId, db);
  },

  /**
   * Retrieves unified settings object aggregating core UI, focus timing,
   * distraction shield notifications, and discoverability privacy settings.
   */
  getMergedSettings(userId, customDb = null) {
    const db = customDb || getDb();
    const core = this.findByUserId(userId, db);
    const profile = ProfileModel.findByUserId(userId, db);
    const focusSettings = FocusModel.getSettings(userId, db);
    const privacySettings = SafetyModel.getPrivacySettings(userId, db);
    const user = UserModel.findById(userId, db);

    const primaryLang = (user?.preferredLanguages && user.preferredLanguages[0])
      ? user.preferredLanguages[0]
      : 'English';

    return {
      userId,
      theme: core?.theme || 'system',
      language: core?.language || 'en',
      fontScaling: core?.font_scaling || 'standard',
      reducedMotion: Boolean(core?.reduced_motion),
      roomAudioVideo: core?.room_audio_video || 'muted',
      focusDuration: profile?.preferred_study_duration || 45,
      breakDuration: focusSettings?.breakDurationMinutes || 5,
      primaryStudyLanguage: primaryLang,
      suppressInAppNotifications: focusSettings ? Boolean(focusSettings.suppressInAppNotifications) : true,
      breakRemindersEnabled: focusSettings ? Boolean(focusSettings.breakRemindersEnabled) : true,
      audioChimeEnabled: focusSettings ? Boolean(focusSettings.audioChimeEnabled) : false,
      profileVisibility: privacySettings?.profileVisibility || 'public',
      showLearningPreferences: privacySettings?.showLearningPreferences !== undefined ? Boolean(privacySettings.showLearningPreferences) : true,
      allowStudyInvites: privacySettings?.allowStudyInvites !== undefined ? Boolean(privacySettings.allowStudyInvites) : true,
      updatedAt: core?.updated_at || new Date().toISOString(),
    };
  },

  /**
   * Updates settings transactionally across user_settings, learner_profiles,
   * distraction shield, privacy settings, and user language records.
   */
  updateMergedSettings(userId, data, customDb = null) {
    return withTransaction((txDb) => {
      // 1. Update user_settings
      const uiData = {};
      if (data.theme !== undefined) uiData.theme = data.theme;
      if (data.language !== undefined) uiData.language = data.language;
      if (data.fontScaling !== undefined) uiData.fontScaling = data.fontScaling;
      if (data.reducedMotion !== undefined) uiData.reducedMotion = data.reducedMotion;
      if (data.roomAudioVideo !== undefined) uiData.roomAudioVideo = data.roomAudioVideo;

      if (Object.keys(uiData).length > 0) {
        this.upsert(userId, uiData, txDb);
      }

      // 2. Synchronize study focus block duration with learner_profiles
      if (data.focusDuration !== undefined && Number.isInteger(data.focusDuration)) {
        ProfileModel.upsert(userId, { preferred_study_duration: data.focusDuration }, txDb);
      }

      // 3. Synchronize distraction shield and break reminder settings
      const focusUpdates = {};
      if (data.breakDuration !== undefined && Number.isInteger(data.breakDuration)) {
        focusUpdates.breakDurationMinutes = data.breakDuration;
      }
      if (data.suppressInAppNotifications !== undefined) {
        focusUpdates.suppressInAppNotifications = Boolean(data.suppressInAppNotifications);
      }
      if (data.breakRemindersEnabled !== undefined) {
        focusUpdates.breakRemindersEnabled = Boolean(data.breakRemindersEnabled);
      }
      if (data.audioChimeEnabled !== undefined) {
        focusUpdates.audioChimeEnabled = Boolean(data.audioChimeEnabled);
      }

      if (Object.keys(focusUpdates).length > 0) {
        FocusModel.updateSettings(userId, focusUpdates, txDb);
      }

      // 4. Synchronize privacy & discoverability settings
      const privacyUpdates = {};
      if (data.profileVisibility !== undefined) {
        privacyUpdates.profileVisibility = data.profileVisibility;
      }
      if (data.showLearningPreferences !== undefined) {
        privacyUpdates.showLearningPreferences = Boolean(data.showLearningPreferences);
      }
      if (data.allowStudyInvites !== undefined) {
        privacyUpdates.allowStudyInvites = Boolean(data.allowStudyInvites);
      }

      if (Object.keys(privacyUpdates).length > 0) {
        SafetyModel.upsertPrivacySettings(userId, privacyUpdates, txDb);
      }

      // 5. Synchronize user preferred_languages ONLY when primaryStudyLanguage is explicitly set
      if (data.primaryStudyLanguage !== undefined) {
        const langName = typeof data.primaryStudyLanguage === 'string' ? data.primaryStudyLanguage.trim() : '';
        if (langName) {
          UserModel.update(userId, { preferred_languages: [langName] }, txDb);
        }
      }

      return this.getMergedSettings(userId, txDb);
    }, customDb);
  },
};

export default SettingsModel;
