import { Router } from 'express';
import { MatchingEngine } from '../services/matching/matchingEngine.js';
import { aiService } from '../services/ai/aiService.js';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware.js';
import SafetyModel from '../models/safety.model.js';
import {
  validateMatchCriteriaInput,
  validateBlockUserInput,
  formatSuccess,
  formatError,
} from '../schemas/index.js';
import { getDb } from '../db/connection.js';

const router = Router();

/**
 * GET /api/matches/status
 * Exposes matching engine scoring weights, rule engine status, and AI provider availability.
 */
router.get('/status', (req, res) => {
  const aiStatus = aiService.getStatus();
  res.status(200).json(
    formatSuccess({
      engine: 'StudySync Weighted Peer Matching Engine',
      weights: MatchingEngine.getWeights(),
      ai_provider: aiStatus,
      free_tier_safe: true,
      data_source: 'live_database_profiles',
      phase: 13,
    })
  );
});

/**
 * GET /api/matches/peers
 * Retrieve ranked peer learner recommendations from live database records.
 * Supports learner session intent, complementary skill matching, and real availability.
 */
router.get('/peers', optionalAuth, async (req, res, next) => {
  try {
    const criteria = validateMatchCriteriaInput(req.query);
    const userId = req.user?.id || null;

    const matches = MatchingEngine.findMatches(userId, criteria);
    const alternatives = matches.length === 0 ? MatchingEngine.getAlternatives(criteria) : null;

    // Optionally enhance top matches if genuine AI provider is configured
    const aiStatus = aiService.getStatus();
    if (aiStatus.ai_available && matches.length > 0) {
      // Enhance top 2 candidates concurrently with rate limit safety
      await Promise.all(
        matches.slice(0, 2).map(async (match) => {
          try {
            const enhancement = await aiService.enhancePeerMatch(match, req.user, criteria.topic);
            if (enhancement && enhancement.isEnhanced) {
              match.ai_enhanced = true;
              match.ai_insight = enhancement.insight;
              match.engine = enhancement.provider;
            }
          } catch {
            // Keep deterministic fallback on any enhancement error
          }
        })
      );
    }

    let userProfileStatus = null;
    if (userId) {
      const db = getDb();
      const prefCount = db.prepare('SELECT COUNT(*) AS cnt FROM user_learning_preferences WHERE user_id = ?').get(userId)?.cnt || 0;
      const subjCount = db.prepare('SELECT COUNT(*) AS cnt FROM user_subjects WHERE user_id = ?').get(userId)?.cnt || 0;
      const profile = db.prepare('SELECT preferred_study_times, skill_level FROM learner_profiles WHERE user_id = ?').get(userId);
      const hasSchedule = Boolean(profile?.preferred_study_times);
      userProfileStatus = {
        hasPreferences: prefCount > 0,
        hasSubjects: subjCount > 0,
        hasSchedule,
        isProfileComplete: prefCount > 0 && hasSchedule,
        guidance: (!prefCount || !hasSchedule)
          ? 'Add your active study topics and study times in your profile to receive more tailored peer recommendations.'
          : null,
      };
    }

    const total = typeof matches.total === 'number' ? matches.total : matches.length;
    const page = matches.page || criteria.page || 1;
    const limit = matches.limit || criteria.limit || 12;
    const totalPages = matches.totalPages || Math.ceil(total / limit) || 1;
    const hasMore = typeof matches.hasMore === 'boolean' ? matches.hasMore : (page < totalPages);

    res.status(200).json(
      formatSuccess(matches, {
        total,
        page,
        limit,
        totalPages,
        hasMore,
        criteria,
        alternatives,
        ai_status: aiStatus,
        userProfileStatus,
      })
    );
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/matches/find
 * Query-body compatible endpoint for complex partner searches
 */
router.post('/find', optionalAuth, async (req, res, next) => {
  try {
    const criteria = validateMatchCriteriaInput(req.body);
    const userId = req.user?.id || null;

    const matches = MatchingEngine.findMatches(userId, criteria);
    const alternatives = matches.length === 0 ? MatchingEngine.getAlternatives(criteria) : null;
    const aiStatus = aiService.getStatus();

    let userProfileStatus = null;
    if (userId) {
      const db = getDb();
      const prefCount = db.prepare('SELECT COUNT(*) AS cnt FROM user_learning_preferences WHERE user_id = ?').get(userId)?.cnt || 0;
      const subjCount = db.prepare('SELECT COUNT(*) AS cnt FROM user_subjects WHERE user_id = ?').get(userId)?.cnt || 0;
      const profile = db.prepare('SELECT preferred_study_times, skill_level FROM learner_profiles WHERE user_id = ?').get(userId);
      const hasSchedule = Boolean(profile?.preferred_study_times);
      userProfileStatus = {
        hasPreferences: prefCount > 0,
        hasSubjects: subjCount > 0,
        hasSchedule,
        isProfileComplete: prefCount > 0 && hasSchedule,
        guidance: (!prefCount || !hasSchedule)
          ? 'Add your active study topics and study times in your profile to receive more tailored peer recommendations.'
          : null,
      };
    }

    const total = typeof matches.total === 'number' ? matches.total : matches.length;
    const page = matches.page || criteria.page || 1;
    const limit = matches.limit || criteria.limit || 12;
    const totalPages = matches.totalPages || Math.ceil(total / limit) || 1;
    const hasMore = typeof matches.hasMore === 'boolean' ? matches.hasMore : (page < totalPages);

    res.status(200).json(
      formatSuccess(matches, {
        total,
        page,
        limit,
        totalPages,
        hasMore,
        criteria,
        alternatives,
        ai_status: aiStatus,
        userProfileStatus,
      })
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/matches/peers/:peerId
 * Retrieve public learner profile and academic capability for an eligible peer.
 * Strictly enforces account verification, blocking safety, and privacy boundaries.
 */
router.get('/peers/:peerId', optionalAuth, async (req, res, next) => {
  try {
    const { peerId } = req.params;
    const requestingUserId = req.user?.id || null;
    const db = getDb();

    // 1. Verify peer exists and is verified
    const peerUser = db.prepare(`
      SELECT id, display_name, avatar_url, preferred_languages, created_at
      FROM users
      WHERE id = ? AND is_verified = 1
    `).get(peerId);

    if (!peerUser) {
      return res.status(404).json(formatError('Peer learner not found or profile not discoverable', 'NOT_FOUND'));
    }

    // 2. Check blocking restrictions if user is authenticated
    if (requestingUserId) {
      const isBlocked = db.prepare(`
        SELECT id FROM user_blocks
        WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
      `).get(requestingUserId, peerId, peerId, requestingUserId);

      if (isBlocked) {
        return res.status(403).json(formatError('Access to this learner profile is restricted', 'FORBIDDEN'));
      }
    }

    // 3. Privacy Settings Enforcement
    const privacy = SafetyModel.getPrivacySettings(peerId, db);
    if (requestingUserId !== peerId) {
      if (privacy.profileVisibility === 'private') {
        return res.status(404).json(formatError('Peer learner not found or profile not discoverable', 'NOT_FOUND'));
      }
      if (privacy.profileVisibility === 'rooms_only') {
        if (!requestingUserId) {
          return res.status(403).json(formatError('Access restricted. Please sign in to view room member profiles.', 'UNAUTHENTICATED'));
        }
        const sharedRooms = db.prepare(`
          SELECT COUNT(DISTINCT rm1.room_id) AS shared_count
          FROM room_memberships rm1
          JOIN room_memberships rm2 ON rm1.room_id = rm2.room_id
          WHERE rm1.user_id = ? AND rm2.user_id = ?
        `).get(requestingUserId, peerId);

        if (!sharedRooms || sharedRooms.shared_count === 0) {
          return res.status(403).json(formatError('Access restricted. This profile is only discoverable to members of shared Topic Rooms.', 'RESTRICTED_TO_ROOM_MEMBERS'));
        }
      }
    }

    // 4. Fetch profile details
    const profile = db.prepare(`
      SELECT headline, institution, introduction, skill_level,
             preferred_study_times, preferred_study_duration, collaboration_style, is_profile_completed
      FROM learner_profiles
      WHERE user_id = ?
    `).get(peerId) || {};

    // 5. Fetch enrolled subjects and learning topics
    const subjects = db.prepare('SELECT subject FROM user_subjects WHERE user_id = ?').all(peerId).map((s) => s.subject);

    const preferences = db.prepare(`
      SELECT ulp.*, lt.subject, lt.topic_name, lt.difficulty_level
      FROM user_learning_preferences ulp
      JOIN learning_topics lt ON ulp.topic_id = lt.id
      WHERE ulp.user_id = ?
    `).all(peerId);

    // 6. Fetch verified session attendance stats
    const stats = db.prepare(`
      SELECT 
        COUNT(*) AS total_sessions,
        SUM(CASE WHEN participation_status = 'completed' OR total_attendance_seconds >= 900 THEN 1 ELSE 0 END) AS completed_sessions
      FROM session_participants
      WHERE user_id = ?
    `).get(peerId);

    const totalSessions = stats?.total_sessions || 0;
    const completedSessions = stats?.completed_sessions || 0;
    const attendanceRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 95;

    // 7. Connected active rooms
    const activeRooms = db.prepare(`
      SELECT r.id, r.room_name, r.topic, r.subject
      FROM room_memberships rm
      JOIN rooms r ON rm.room_id = r.id
      WHERE rm.user_id = ? AND r.status = 'active'
      LIMIT 2
    `).all(peerId);

    let parsedLanguages = ['English'];
    if (peerUser.preferred_languages) {
      try {
        parsedLanguages = JSON.parse(peerUser.preferred_languages);
      } catch {
        parsedLanguages = ['English'];
      }
    }

    const showInst = privacy.showInstitution || requestingUserId === peerId;
    const showPrefs = privacy.showLearningPreferences || requestingUserId === peerId;

    const publicProfile = {
      id: peerUser.id,
      studentId: peerUser.id,
      displayName: peerUser.display_name,
      avatarUrl: peerUser.avatar_url,
      headline: showInst ? (profile.headline || 'Student Learner') : 'Student Learner',
      institution: showInst ? (profile.institution || 'Department of Computing') : null,
      bio: profile.introduction || '',
      skillLevel: profile.skill_level || 'Intermediate',
      preferredStudyTimes: profile.preferred_study_times || null,
      preferredStudyDuration: profile.preferred_study_duration || 45,
      collaborationStyle: profile.collaboration_style || 'Peer discussion & problem solving',
      languages: parsedLanguages,
      subjects: subjects.length > 0 ? subjects : ['Computer Science'],
      learningNow: showPrefs ? preferences.filter((p) => p.is_learning_now).map((p) => p.topic_name) : [],
      strengths: showPrefs ? preferences.filter((p) => p.is_strength || p.confidence_level === 'confident').map((p) => p.topic_name) : [],
      improving: showPrefs ? preferences.filter((p) => p.is_improving || p.confidence_level === 'needs_improvement').map((p) => p.topic_name) : [],
      willingToTeach: showPrefs ? preferences.filter((p) => p.willing_to_teach === 1).map((p) => p.topic_name) : [],
      wantsPeerSupport: showPrefs ? preferences.filter((p) => p.wants_peer_support === 1).map((p) => p.topic_name) : [],
      attendanceRate: `${attendanceRate}%`,
      totalSessionsCompleted: completedSessions,
      activeRooms,
      allowStudyInvites: Boolean(privacy.allowStudyInvites),
      profileVisibility: privacy.profileVisibility,
      presenceStatus: privacy.showActivityStatus ? (profile.presenceStatus || 'scheduled') : 'offline',
      presenceLabel: privacy.showActivityStatus ? (profile.presenceLabel || 'Scheduled') : 'Offline',
    };

    res.status(200).json(formatSuccess(publicProfile));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/matches/block
 * Exclude a peer from matching results (safety control)
 */
router.post('/block', requireAuth, async (req, res, next) => {
  try {
    const { targetUserId } = validateBlockUserInput(req.body, req.user.id);
    const db = getDb();

    // Verify target user exists
    const targetUser = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(targetUserId);
    if (!targetUser) {
      return res.status(404).json(formatError('User to block does not exist', 'NOT_FOUND'));
    }

    const id = `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO user_blocks (id, blocker_id, blocked_id, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(blocker_id, blocked_id) DO NOTHING
    `).run(id, req.user.id, targetUserId, now);

    res.status(200).json(
      formatSuccess({
        blocked: true,
        targetUserId,
        targetName: targetUser.display_name,
        timestamp: now,
      })
    );
  } catch (error) {
    next(error);
  }
});

export default router;
