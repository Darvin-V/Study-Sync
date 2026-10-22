import { Router } from 'express';
import ProfileModel from '../models/profile.model.js';
import UserModel from '../models/user.model.js';
import { getDb } from '../db/connection.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  validateProfileUpdate,
  validatePreferencesUpdate,
  formatSuccess,
  formatError,
} from '../schemas/index.js';

const router = Router();

// Protect all profile endpoints with authentication middleware
router.use(requireAuth);

/**
 * GET /api/profile/me
 * Retrieves the full learner profile of the authenticated user
 */
router.get('/me', async (req, res, next) => {
  try {
    const profile = ProfileModel.getFullProfile(req.user.id);
    if (!profile) {
      return res.status(404).json(
        formatError('Profile not found for authenticated user', 'NOT_FOUND')
      );
    }

    res.status(200).json(formatSuccess(profile));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/profile/me
 * Updates own learner profile and academic preferences
 * Strictly locked to req.user.id to prevent cross-user profile modification
 */
router.put('/me', async (req, res, next) => {
  try {
    const input = validateProfileUpdate(req.body);

    // 1. Update user identity fields if specified
    const userUpdates = {};
    if (input.displayName !== undefined) userUpdates.display_name = input.displayName;
    if (input.avatarUrl !== undefined) userUpdates.avatar_url = input.avatarUrl;
    if (input.preferredLanguages !== undefined) userUpdates.preferred_languages = input.preferredLanguages;

    if (input.username !== undefined) {
      const cleanUsername = input.username.trim().replace(/^@/, '').toLowerCase();
      const isAvailable = UserModel.isUsernameAvailable(cleanUsername, req.user.id);
      if (!isAvailable) {
        return res.status(409).json(
          formatError('Username is already taken by another learner. Please choose a different handle.', 'USERNAME_TAKEN')
        );
      }
      userUpdates.username = cleanUsername;
    }

    if (Object.keys(userUpdates).length > 0) {
      UserModel.update(req.user.id, userUpdates);
    }

    // 2. Update profile bio & schedule fields
    const profileData = {
      headline: input.headline,
      institution: input.institution,
      introduction: input.introduction,
      skill_level: input.skillLevel,
      preferred_study_times: input.preferredStudyTimes,
      preferred_study_duration: input.preferredStudyDuration,
      is_profile_completed: input.isProfileCompleted !== undefined ? input.isProfileCompleted : 1,
      age: input.age,
      gender: input.gender,
      education_stage: input.educationStage,
      education_details: input.educationDetails ? JSON.stringify(input.educationDetails) : undefined,
      learning_goals: input.learningGoals ? JSON.stringify(input.learningGoals) : undefined,
      country: input.country !== undefined ? input.country : undefined,
      state: input.state !== undefined ? input.state : undefined,
      city: input.city !== undefined ? input.city : undefined,
    };

    ProfileModel.upsert(req.user.id, profileData);

    // 3. Update subjects if provided
    if (input.subjects !== undefined) {
      ProfileModel.setSubjects(req.user.id, input.subjects);
    }

    // Return the updated full profile
    const updatedProfile = ProfileModel.getFullProfile(req.user.id);
    res.status(200).json(formatSuccess(updatedProfile));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/profile/user/:userId
 * Retrieves public learner profile for a specific student, respecting server-side privacy controls.
 */
router.get('/user/:userId', async (req, res, next) => {
  try {
    const { userId: targetUserId } = req.params;
    if (!targetUserId) {
      return res.status(400).json(formatError('Target user ID is required', 'INVALID_PARAM'));
    }

    const profile = ProfileModel.getFullProfile(targetUserId);
    if (!profile) {
      return res.status(404).json(formatError('Learner profile not found', 'NOT_FOUND'));
    }

    // Check mutual blocking
    const db = getDb();
    const isBlocked = db.prepare(`
      SELECT 1 FROM user_blocks 
      WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
    `).get(req.user.id, targetUserId, targetUserId, req.user.id);

    if (isBlocked) {
      return res.status(403).json(formatError('Unable to view this profile.', 'ACCESS_DENIED'));
    }

    // Privacy controls
    const privacy = db.prepare(`
      SELECT profile_visibility, show_activity_status, show_learning_preferences,
             show_institution, allow_study_invites, COALESCE(show_location, 1) AS show_location
      FROM user_privacy_settings
      WHERE user_id = ?
    `).get(targetUserId);

    if (privacy && privacy.profile_visibility === 'private' && targetUserId !== req.user.id) {
      return res.status(403).json(formatError('This learner has made their profile private.', 'PROFILE_PRIVATE'));
    }

    // Strip strictly private identity fields
    const publicProfile = {
      id: profile.userId,
      userId: profile.userId,
      displayName: profile.displayName,
      username: profile.username || null,
      avatarUrl: profile.avatarUrl,
      headline: profile.headline,
      institution: (!privacy || privacy.show_institution) ? profile.institution : null,
      introduction: profile.introduction,
      country: (!privacy || privacy.show_location) ? profile.country : null,
      state: (!privacy || privacy.show_location) ? profile.state : null,
      city: (!privacy || privacy.show_location) ? profile.city : null,
      educationStage: profile.educationStage,
      skillLevel: profile.skillLevel,
      preferredStudyTimes: (!privacy || privacy.show_activity_status) ? profile.preferredStudyTimes : null,
      preferredStudyDuration: profile.preferredStudyDuration,
      collaborationStyle: profile.collaborationStyle,
      subjects: (!privacy || privacy.show_learning_preferences) ? profile.subjects : [],
      currentlyLearning: (!privacy || privacy.show_learning_preferences) ? profile.currentlyLearning : [],
      strengths: (!privacy || privacy.show_learning_preferences) ? profile.strengths : [],
      improvementAreas: (!privacy || privacy.show_learning_preferences) ? profile.improvementAreas : [],
      willingToTeach: (!privacy || privacy.show_learning_preferences) ? profile.willingToTeach : [],
      wantsPeerSupport: (!privacy || privacy.show_learning_preferences) ? profile.wantsPeerSupport : [],
      learningGoals: (!privacy || privacy.show_learning_preferences) ? profile.learningGoals : [],
      allowStudyInvites: privacy ? Boolean(privacy.allow_study_invites) : true,
      createdAt: profile.createdAt,
    };

    res.status(200).json(formatSuccess(publicProfile));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/profile/preferences
 * Updates curriculum topics and learning preferences (learning now, strengths, improving)
 */
router.put('/preferences', async (req, res, next) => {
  try {
    const input = validatePreferencesUpdate(req.body);
    ProfileModel.setPreferences(req.user.id, input.preferences);

    const updatedProfile = ProfileModel.getFullProfile(req.user.id);
    res.status(200).json(formatSuccess(updatedProfile));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/profile/preferences
 * Clears all learning preferences for data minimization
 */
router.delete('/preferences', async (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM user_learning_preferences WHERE user_id = ?').run(req.user.id);
    const updatedProfile = ProfileModel.getFullProfile(req.user.id);
    res.status(200).json(formatSuccess({ cleared: true, ...updatedProfile }));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/profile/preferences/:topicId
 * Removes a topic from own learning preferences
 */
router.delete('/preferences/:topicId', async (req, res, next) => {
  try {
    const { topicId } = req.params;
    if (!topicId || typeof topicId !== 'string') {
      return res.status(400).json(formatError('Valid topic ID is required', 'INVALID_PARAM'));
    }

    ProfileModel.removePreference(req.user.id, topicId.trim());
    const updatedProfile = ProfileModel.getFullProfile(req.user.id);
    res.status(200).json(formatSuccess(updatedProfile));
  } catch (error) {
    next(error);
  }
});

export default router;
