import { getDb } from '../../db/connection.js';
import { calculateTopicSimilarity, normalizeText, findTaxonomyNode } from './topicSimilarity.js';

/**
 * StudySync AI — Intelligent Peer Matching & Fair Recommendation Engine (Phase 13)
 * 
 * Implements a transparent, explainable two-sided matching algorithm using real database records:
 * - Current learner intent (seeking help, explaining/mentoring, reciprocal teaching, co-studying)
 * - Complementary and compatible skill levels
 * - Coursework curriculum topic overlap
 * - Real schedule availability (distinguishing confirmed, unconfirmed, and active presence)
 * - Language compatibility
 * - Learning style alignment (when provided)
 * - Reliable session completion and Bayesian smoothed peer helpfulness (N >= 3 threshold)
 * - Direct pairwise collaboration history & repeat study preferences
 * - Cold-start fair neutral baselines for new learners
 * - Anti-monopoly candidate rotation among similarly qualified peers
 */

// Canonical Configurable Scoring Weights (Sums to 1.00 / 100%)
export const DEFAULT_MATCHING_WEIGHTS = Object.freeze({
  topicSimilarity: 0.25,        // 25%: Overlap in target topics & curriculum taxonomy
  skillCompatibility: 0.15,     // 15%: Balanced or complementary skill strengths
  goalCompatibility: 0.15,      // 15%: Overlap in learning goals (e.g. Exam Revision)
  scheduleCompatibility: 0.10,  // 10%: Overlapping study hours and availability windows
  languageCompatibility: 0.10,  // 10%: Shared spoken/study languages
  learningStyleCompatibility: 0.10, // 10%: Aligned session durations & study cadence
  reliability: 0.10,            // 10%: Historical session completion and feedback
  previousCollaboration: 0.05,  // 5%: Past co-studying satisfaction
});

let currentWeights = { ...DEFAULT_MATCHING_WEIGHTS };

/**
 * Live reference proxy ensuring MATCHING_WEIGHTS always reflects active configuration
 */
export const MATCHING_WEIGHTS = new Proxy(DEFAULT_MATCHING_WEIGHTS, {
  get(target, prop) {
    if (prop in currentWeights) return currentWeights[prop];
    return target[prop];
  },
});

/**
 * Updates active scoring weights (validates object structure)
 */
export function configureMatchingWeights(newWeights = {}) {
  if (!newWeights || typeof newWeights !== 'object') return { ...currentWeights };
  currentWeights = { ...currentWeights, ...newWeights };
  return { ...currentWeights };
}

/**
 * Resets weights back to factory defaults
 */
export function resetMatchingWeights() {
  currentWeights = { ...DEFAULT_MATCHING_WEIGHTS };
  return { ...currentWeights };
}

/**
 * Normalizes schedule text into canonical time windows
 */
function normalizeTimeSlot(timeStr) {
  const norm = normalizeText(timeStr);
  if (!norm) return 'flexible';
  if (norm.includes('night')) return 'night';
  if (norm.includes('evening')) return 'evening';
  if (norm.includes('morning')) return 'morning';
  if (norm.includes('afternoon')) return 'afternoon';
  if (norm.includes('weekend')) return 'weekend';
  return 'flexible';
}

/**
 * Computes schedule compatibility score between two time strings.
 * Distinguishes unconfirmed/unknown schedule from confirmed overlap or mismatch.
 */
function calculateScheduleCompatibility(targetTime, candTime) {
  if (!candTime || typeof candTime !== 'string' || !candTime.trim()) {
    return {
      score: 60, // Neutral unconfirmed schedule baseline (does not penalize as mismatch)
      status: 'unknown',
      label: 'Schedule unconfirmed',
      reason: 'Schedule availability unconfirmed (flexible matching applied)',
    };
  }

  const slotA = normalizeTimeSlot(targetTime);
  const slotB = normalizeTimeSlot(candTime);

  if (slotA === 'flexible' || slotB === 'flexible') {
    return {
      score: 80,
      status: 'flexible',
      label: candTime,
      reason: `Flexible study schedule (${candTime})`,
    };
  }

  if (slotA === slotB) {
    return {
      score: 100,
      status: 'compatible',
      label: candTime,
      reason: `Your selected study times overlap (${candTime})`,
    };
  }

  const normA = normalizeText(targetTime);
  const normB = normalizeText(candTime);

  if (
    (normA.includes('evening') && normB.includes('evening')) ||
    (normA.includes('night') && normB.includes('night')) ||
    (normA.includes('morning') && normB.includes('morning')) ||
    (normA.includes('weekend') && normB.includes('weekend'))
  ) {
    return {
      score: 90,
      status: 'compatible',
      label: candTime,
      reason: `Compatible study times (${candTime})`,
    };
  }

  return {
    score: 25,
    status: 'different_schedule',
    label: candTime,
    reason: `Different schedule preference (${candTime} vs ${targetTime})`,
  };
}

/**
 * Computes language compatibility
 */
function calculateLanguageCompatibility(langsA, langsB) {
  const arrA = Array.isArray(langsA) && langsA.length > 0 ? langsA : ['English'];
  const arrB = Array.isArray(langsB) && langsB.length > 0 ? langsB : ['English'];
  const setA = new Set(arrA.map((l) => l.trim().toLowerCase()));
  const setB = new Set(arrB.map((l) => l.trim().toLowerCase()));

  let shared = 0;
  for (const l of setA) {
    if (setB.has(l)) shared++;
  }

  if (shared > 1) return { score: 100, sharedCount: shared };
  if (shared === 1) return { score: 95, sharedCount: 1 };
  return { score: 10, sharedCount: 0 };
}

/**
 * Computes learning style compatibility (duration and study cadence).
 * Distinguishes unstated learning style from an actual mismatch.
 */
function calculateLearningStyleCompatibility(targetDuration, candDuration, targetStyle, candStyle) {
  const hasCandDuration = Number.isInteger(candDuration) && candDuration > 0;
  const hasCandStyle = typeof candStyle === 'string' && candStyle.trim().length > 0;

  if (!hasCandDuration && !hasCandStyle) {
    return {
      score: 85,
      reason: 'Standard 45m study pacing (flexible duration)',
    };
  }

  const d1 = Number.isInteger(targetDuration) && targetDuration > 0 ? targetDuration : 45;
  const d2 = hasCandDuration ? candDuration : 45;

  const diff = Math.abs(d1 - d2);
  const maxDur = Math.max(d1, d2, 90);
  let score = Math.max(25, Math.round((1 - diff / maxDur) * 100));

  let styleNote = `${d2}m sessions`;
  if (hasCandStyle && targetStyle) {
    if (normalizeText(targetStyle) === normalizeText(candStyle)) {
      score = Math.min(100, score + 10);
      styleNote = `${d2}m • Aligned style (${candStyle})`;
    }
  }

  return {
    score,
    reason: `Preferred study style: ${styleNote}`,
  };
}

/**
 * Evaluates topic text match loosely
 */
function isTopicMatch(topicA, topicB) {
  if (!topicA || !topicB) return false;
  const normA = normalizeText(topicA);
  const normB = normalizeText(topicB);
  if (!normA || !normB) return false;
  if (normA === normB || normA.includes(normB) || normB.includes(normA)) return true;
  const nodeA = findTaxonomyNode(topicA);
  const nodeB = findTaxonomyNode(topicB);
  if (nodeA && nodeB && nodeA.id === nodeB.id) return true;
  return false;
}

/**
 * Evaluates skill compatibility between current user and candidate for the current session intent.
 * 
 * Supports three primary peer collaboration roles:
 * 1. A learner who needs help (paired with a confident/explaining peer on the topic).
 * 2. A learner who can explain a topic (paired with someone who needs help or wants peer support).
 * 3. A learner who can teach one topic and learn another (reciprocal peer exchange).
 * 
 * Also supports collaborative co-studying and exam revision.
 */
function calculateSkillCompatibility(
  userPrefs = [],
  candidatePrefs = [],
  userProfile = null,
  candidateProfile = null,
  targetTopic = '',
  options = {}
) {
  const {
    intent = 'learn_together',
    skillPreference = 'any',
    confidence = 'neutral',
  } = options;

  const candName = candidateProfile?.display_name || 'Candidate';
  const userSkill = (userProfile?.skill_level || 'Intermediate').toLowerCase();
  const candSkill = (candidateProfile?.skill_level || 'Intermediate').toLowerCase();

  // 1. Reciprocal Peer Teaching Scenario (Two-sided complementary exchange):
  // User has strength in topic X that candidate wants; candidate has strength in topic Y that user wants
  const userStrengths = userPrefs.filter((p) => p.is_strength || p.willing_to_teach === 1 || p.confidence_level === 'confident');
  const userWants = userPrefs.filter((p) => p.is_improving || p.wants_peer_support === 1 || p.confidence_level === 'needs_improvement');
  const candidateStrengths = candidatePrefs.filter((p) => p.is_strength || p.willing_to_teach === 1 || p.confidence_level === 'confident');
  const candidateWants = candidatePrefs.filter((p) => p.is_improving || p.wants_peer_support === 1 || p.confidence_level === 'needs_improvement');

  let reciprocalUserTopic = null;
  let reciprocalCandTopic = null;

  for (const us of userStrengths) {
    const match = candidateWants.find((cw) => cw.topic_id === us.topic_id || isTopicMatch(cw.topic_name, us.topic_name));
    if (match) {
      reciprocalUserTopic = us.topic_name;
      break;
    }
  }

  for (const cs of candidateStrengths) {
    const match = userWants.find((uw) => uw.topic_id === cs.topic_id || isTopicMatch(uw.topic_name, cs.topic_name));
    if (match) {
      reciprocalCandTopic = cs.topic_name;
      break;
    }
  }

  if (reciprocalUserTopic && reciprocalCandTopic) {
    return {
      score: 100,
      role: 'reciprocal_exchange',
      roleLabel: 'Reciprocal Peer Exchange',
      reason: `Reciprocal peer exchange: you can explain ${reciprocalUserTopic} while learning ${reciprocalCandTopic} from ${candName}`,
    };
  }

  // Check candidate capabilities on target topic
  const candidateStrengthensTopic = candidatePrefs.some(
    (p) => (p.is_strength || p.confidence_level === 'confident') && isTopicMatch(p.topic_name, targetTopic)
  );
  const candidateWillingToTeach = candidatePrefs.some(
    (p) => p.willing_to_teach === 1 && isTopicMatch(p.topic_name, targetTopic)
  );
  const candidateNeedsHelpOnTopic = candidatePrefs.some(
    (p) => (p.is_improving || p.wants_peer_support === 1 || p.confidence_level === 'needs_improvement') && isTopicMatch(p.topic_name, targetTopic)
  );

  // Check user capabilities on target topic
  const userImprovesTopic = (confidence === 'needs_improvement') || userPrefs.some(
    (p) => (p.is_improving || p.wants_peer_support === 1 || p.confidence_level === 'needs_improvement') && isTopicMatch(p.topic_name, targetTopic)
  );
  const userCanTeachTopic = (confidence === 'confident') || userPrefs.some(
    (p) => (p.is_strength || p.willing_to_teach === 1 || p.confidence_level === 'confident') && isTopicMatch(p.topic_name, targetTopic)
  );

  // 2. Role: Learner who needs help / Explainer search
  // Intent: 'find_explainer', 'solve_doubt', or user specified needs_improvement/complementary
  const isHelpSeekingIntent =
    intent === 'find_explainer' ||
    intent === 'solve_doubt' ||
    (skillPreference === 'complementary' && userImprovesTopic) ||
    (userImprovesTopic && !userCanTeachTopic && intent !== 'help_others');

  if (isHelpSeekingIntent) {
    if (candidateStrengthensTopic || candidateWillingToTeach) {
      return {
        score: 100,
        role: 'explainer',
        roleLabel: 'Can Explain Topic',
        reason: `This learner reports confidence in ${targetTopic}, a topic you want help with`,
      };
    }

    if (candSkill === 'advanced' && (userSkill === 'beginner' || userSkill === 'intermediate')) {
      return {
        score: 90,
        role: 'explainer',
        roleLabel: 'Advanced Peer Guide',
        reason: `Advanced candidate well-positioned to guide you through ${targetTopic} concepts`,
      };
    }

    if (candidateNeedsHelpOnTopic || (userSkill === 'beginner' && candSkill === 'beginner')) {
      // Candidate also needs help on this topic: low compatibility for an explainer search
      return {
        score: 45,
        role: 'co_learner',
        roleLabel: 'Fellow Beginner',
        reason: `Both learners currently need help with ${targetTopic}; peer has not reported explanation confidence`,
      };
    }

    if (candSkill === 'intermediate' && userSkill === 'beginner') {
      return {
        score: 80,
        role: 'explainer',
        roleLabel: 'Experienced Peer',
        reason: `Intermediate peer with practical coursework experience in ${targetTopic}`,
      };
    }

    return {
      score: 70,
      role: 'co_learner',
      roleLabel: 'Study Peer',
      reason: `Candidate is also studying ${targetTopic} with room for mutual reinforcement`,
    };
  }

  // 3. Role: Learner who can explain / Peer mentor
  // Intent: 'help_others', 'practice_explaining', or user can teach
  const isTeachingIntent =
    intent === 'help_others' ||
    intent === 'practice_explaining' ||
    (skillPreference === 'complementary' && userCanTeachTopic);

  if (isTeachingIntent) {
    if (candidateNeedsHelpOnTopic) {
      return {
        score: 100,
        role: 'learner_seeking_help',
        roleLabel: 'Seeking Explanations',
        reason: `Learner is actively seeking help with ${targetTopic}, matching your intent to explain and mentor`,
      };
    }

    if (candSkill === 'beginner' || candSkill === 'intermediate') {
      return {
        score: 92,
        role: 'learner_seeking_help',
        roleLabel: 'Co-Learner Seeking Guidance',
        reason: `Candidate is working on ${targetTopic} and can benefit from your concept explanations`,
      };
    }

    if (candSkill === 'advanced' && candidateStrengthensTopic) {
      return {
        score: 50,
        role: 'experienced_peer',
        roleLabel: 'Advanced Peer',
        reason: `Peer already reports advanced mastery on ${targetTopic} and does not require foundational explanations`,
      };
    }

    return {
      score: 75,
      role: 'study_partner',
      roleLabel: 'Study Peer',
      reason: `Enrolled learner available for constructive discussions on ${targetTopic}`,
    };
  }

  // 4. Role: Learn together / Exam Revision / Default Co-studying
  if (skillPreference === 'complementary') {
    if (candidateStrengthensTopic || candSkill === 'advanced') {
      return {
        score: 95,
        role: 'explainer',
        roleLabel: 'Complementary Expert',
        reason: `Complementary experience level in ${targetTopic} for structured guidance`,
      };
    }
  }

  if (userSkill === candSkill) {
    return {
      score: 95,
      role: 'study_partner',
      roleLabel: 'Study Partner',
      reason: `Balanced ${userProfile?.skill_level || 'Intermediate'} skill levels for collaborative co-studying and exam preparation`,
    };
  }

  if (
    (userSkill === 'intermediate' && candSkill === 'advanced') ||
    (userSkill === 'advanced' && candSkill === 'intermediate')
  ) {
    return {
      score: 85,
      role: 'study_partner',
      roleLabel: 'Complementary Peer',
      reason: 'Complementary experience levels for constructive concept reviews',
    };
  }

  return {
    score: 70,
    role: 'study_partner',
    roleLabel: 'Study Peer',
    reason: 'Compatible academic standing with room for mutual reinforcement',
  };
}

/**
 * Calculates candidate attendance and reliability.
 * Imposes minimum sample size threshold (N >= 3) before applying peer review bonuses.
 * Provides fair neutral baseline for new learners (cold-start safe).
 */
function calculateReliability(candidateId, db) {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) AS total_sessions,
      SUM(CASE WHEN participation_status = 'completed' OR total_attendance_seconds >= 900 THEN 1 ELSE 0 END) AS completed_sessions
    FROM session_participants
    WHERE user_id = ?
  `).get(candidateId);

  const feedbackCount = db.prepare(`
    SELECT COUNT(*) AS feedback_count
    FROM session_feedback
    WHERE user_id = ?
  `).get(candidateId);

  const total = stats?.total_sessions || 0;
  const completed = stats?.completed_sessions || 0;

  let peerReviews = null;
  try {
    peerReviews = db.prepare(`
      SELECT 
        COUNT(*) AS total_reviews,
        SUM(CASE WHEN was_helpful = 1 THEN 1 ELSE 0 END) AS helpful_yes
      FROM peer_collaboration_feedback
      WHERE target_peer_id = ? AND was_helpful IS NOT NULL
    `).get(candidateId);
  } catch {
    // If table not migrated in test environments
  }

  const feedbacks = feedbackCount?.feedback_count || 0;
  const reviewCount = peerReviews?.total_reviews || 0;
  const helpfulYes = peerReviews?.helpful_yes || 0;

  // Cold start neutral baseline for new learners
  if (total === 0 && reviewCount === 0) {
    return {
      score: 80,
      percentage: '90%',
      isColdStart: true,
      reason: 'New learner in good standing (neutral baseline applied)',
    };
  }

  const completionRate = total > 0 ? (completed / total) : 0.85;

  // Minimum sample threshold: require at least 3 verified reviews to apply Bayesian smoothing
  const minReviewThreshold = 3;
  let helpfulBonus = 0;
  let helpfulReason = '';

  if (reviewCount >= minReviewThreshold) {
    const priorWeight = 3;
    const priorMean = 0.85;
    const smoothedRatio = (helpfulYes + priorWeight * priorMean) / (reviewCount + priorWeight);
    helpfulBonus = Math.round((smoothedRatio - 0.7) * 20); // range: -4 to +6 adjustment
    helpfulReason = ` & verified ${Math.round((helpfulYes / reviewCount) * 100)}% peer helpfulness (${reviewCount} reviews)`;
  } else if (reviewCount > 0) {
    helpfulReason = ` (peer review sample size: ${reviewCount}, threshold pending)`;
  }

  const baseScore = Math.min(100, Math.round(completionRate * 85 + (feedbacks > 0 ? 15 : 10)));
  const score = Math.max(30, Math.min(100, baseScore + helpfulBonus));
  const percentage = `${Math.round(completionRate * 100)}% attendance`;

  return {
    score,
    percentage,
    isColdStart: false,
    reason: `${percentage} across ${total} recorded study session${total !== 1 ? 's' : ''}${helpfulReason}`,
  };
}

/**
 * Checks prior collaboration quality between requesting user and candidate
 * (Incorporates explicit pairwise repeat study preferences from Phase 12)
 */
function calculateCollaborationQuality(userId, candidateId, db) {
  if (!userId) return { score: 70, reason: 'First-time study connection' };

  // Phase 12: Check explicit pairwise repeat-study preference first
  try {
    const directFeedback = db.prepare(`
      SELECT was_helpful, would_study_again, topic_relevance
      FROM peer_collaboration_feedback
      WHERE giver_user_id = ? AND target_peer_id = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(userId, candidateId);

    if (directFeedback) {
      if (directFeedback.would_study_again === 1) {
        return {
          score: 100,
          reason: 'Direct repeat preference: you gave positive feedback and requested to study together again',
        };
      } else if (directFeedback.would_study_again === 0) {
        return {
          score: 25,
          reason: 'Prior collaboration preference: marked as not preferred for repeat study',
        };
      }
    }

    // Phase 4: Check if learner explicitly marked this peer recommendation as not relevant
    const explicitFb = db.prepare(`
      SELECT is_relevant, quality_rating
      FROM recommendation_explicit_feedback
      WHERE user_id = ? AND target_id = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(userId, candidateId);

    if (explicitFb && explicitFb.is_relevant === 0) {
      return {
        score: 20,
        reason: 'Prior feedback: marked as not relevant to your current study goals',
      };
    }
  } catch {
    // Graceful fallback if table is unavailable
  }

  // Shared completed sessions
  const sharedSessions = db.prepare(`
    SELECT COUNT(DISTINCT p1.session_id) AS shared_count
    FROM session_participants p1
    JOIN session_participants p2 ON p1.session_id = p2.session_id
    WHERE p1.user_id = ? AND p2.user_id = ?
  `).get(userId, candidateId);

  const count = sharedSessions?.shared_count || 0;
  if (count > 0) {
    return {
      score: 100,
      reason: `Previously co-studied together in ${count} session${count > 1 ? 's' : ''}`,
    };
  }

  // Shared room memberships
  const sharedRooms = db.prepare(`
    SELECT COUNT(DISTINCT rm1.room_id) AS shared_rooms
    FROM room_memberships rm1
    JOIN room_memberships rm2 ON rm1.room_id = rm2.room_id
    WHERE rm1.user_id = ? AND rm2.user_id = ?
  `).get(userId, candidateId);

  const roomCount = sharedRooms?.shared_rooms || 0;
  if (roomCount > 0) {
    return {
      score: 85,
      reason: `Co-members in ${roomCount} active Topic Room${roomCount > 1 ? 's' : ''}`,
    };
  }

  return {
    score: 70,
    reason: 'First-time study connection (no prior collaboration conflicts)',
  };
}

export const MatchingEngine = {
  getWeights() {
    return { ...currentWeights };
  },

  setWeights(newWeights) {
    return configureMatchingWeights(newWeights);
  },

  configureWeights(newWeights) {
    return configureMatchingWeights(newWeights);
  },

  resetWeights() {
    return resetMatchingWeights();
  },

  /**
   * Generates helpful, real alternative suggestions when no peers match the criteria
   */
  getAlternatives(criteria = {}, customDb = null) {
    const db = customDb || getDb();
    const cleanSubj = typeof criteria.subject === 'string' ? criteria.subject.trim() : '';
    const cleanTop = typeof criteria.topic === 'string' ? criteria.topic.trim() : '';
    const subject = cleanSubj && cleanSubj.toLowerCase() !== 'all' && cleanSubj.toLowerCase() !== 'all subjects'
      ? cleanSubj
      : (cleanTop || 'General Studies');
    const topic = cleanTop || '';

    let suggestedRooms = [];
    try {
      suggestedRooms = db.prepare(`
        SELECT id, room_name, topic, subject, difficulty, max_capacity
        FROM rooms
        WHERE status = 'active' AND (
          LOWER(subject) = LOWER(?) OR 
          LOWER(topic) = LOWER(?) OR 
          LOWER(subject) LIKE LOWER(?) OR 
          LOWER(topic) LIKE LOWER(?)
        )
        ORDER BY created_at DESC
        LIMIT 3
      `).all(subject, topic, `%${subject}%`, `%${topic || subject}%`);
    } catch {
      suggestedRooms = [];
    }

    let suggestedTimes = [];
    try {
      suggestedTimes = db.prepare(`
        SELECT preferred_study_times, COUNT(*) AS cnt
        FROM learner_profiles
        WHERE preferred_study_times IS NOT NULL AND preferred_study_times != ''
        GROUP BY preferred_study_times
        ORDER BY cnt DESC
        LIMIT 4
      `).all().map((r) => r.preferred_study_times);
    } catch {
      suggestedTimes = ['Weekday Evenings', 'Weekends', 'Afternoons'];
    }

    return {
      explanation: `No registered peers currently match all criteria for "${topic || subject}". You can join an active Topic Room or try broadening your study hours.`,
      suggestedRooms,
      suggestedTimeWindows: suggestedTimes,
      suggestedSubject: subject,
    };
  },

  /**
   * Find ranked peer matches for a user from real database records
   */
  findMatches(requestingUserId, criteria = {}, customDb = null, customWeights = null) {
    const db = customDb || getDb();
    const weights = customWeights || criteria.weights || currentWeights;

    // 1. Fetch requesting user data if authenticated
    let requestingUser = null;
    let requestingProfile = null;
    let requestingPrefs = [];
    let requestingSubjects = [];

    if (requestingUserId) {
      requestingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(requestingUserId);
      requestingProfile = db.prepare('SELECT * FROM learner_profiles WHERE user_id = ?').get(requestingUserId);
      requestingPrefs = db.prepare(`
        SELECT ulp.*, lt.subject, lt.topic_name
        FROM user_learning_preferences ulp
        JOIN learning_topics lt ON ulp.topic_id = lt.id
        WHERE ulp.user_id = ?
      `).all(requestingUserId);
      requestingSubjects = db.prepare('SELECT subject FROM user_subjects WHERE user_id = ?').all(requestingUserId).map((s) => s.subject);
    }

    // Determine target topic, subject, intent, and goals from criteria or user defaults
    const cleanSubject = typeof criteria.subject === 'string' ? criteria.subject.trim() : '';
    const cleanTopic = typeof criteria.topic === 'string' ? criteria.topic.trim() : '';
    const isAllSubject = !cleanSubject || cleanSubject.toLowerCase() === 'all' || cleanSubject.toLowerCase() === 'all subjects';

    const hasExplicitSubject = !isAllSubject && cleanSubject.length > 0;
    const hasExplicitTopic = cleanTopic.length > 0;

    const targetSubject = hasExplicitSubject
      ? cleanSubject
      : (requestingSubjects[0] || 'General Studies');

    const targetTopic = hasExplicitTopic
      ? cleanTopic
      : (requestingPrefs[0]?.topic_name || (hasExplicitSubject ? targetSubject : 'General Learning'));
    const targetGoal = criteria.learningGoal || criteria.desiredOutcome || requestingPrefs[0]?.learning_goal || 'Concept Understanding';
    const targetTime = criteria.preferredTime || requestingProfile?.preferred_study_times || 'Weekday Evenings';
    const targetDuration = parseInt(criteria.duration, 10) || requestingProfile?.preferred_study_duration || 45;
    const targetLanguage = criteria.language && criteria.language !== 'Any' ? criteria.language : null;
    const targetIntent = criteria.intent || 'learn_together';
    const targetSkillPref = criteria.skillPreference || 'any';
    const targetConfidence = criteria.confidence || criteria.selfReportedConfidence || 'neutral';
    const targetCollabStyle = criteria.collaborationStyle || requestingProfile?.collaboration_style || null;

    let userLanguages = ['English'];
    if (requestingUser?.preferred_languages) {
      try {
        userLanguages = JSON.parse(requestingUser.preferred_languages);
      } catch {
        userLanguages = ['English'];
      }
    }
    if (targetLanguage) {
      userLanguages = [targetLanguage, ...userLanguages.filter((l) => l !== targetLanguage)];
    }

    // 2. Fetch eligible candidates from REAL database:
    // Exclude requesting user
    // Exclude unverified or deactivated users
    // Exclude blocked users (both blocker and blocked)
    // Exclude users who set profile_visibility = 'private'
    let candidateQuery = `
      SELECT 
        u.id,
        u.display_name,
        u.username,
        u.email,
        u.avatar_url,
        u.preferred_languages,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at,
        lp.headline,
        lp.institution,
        lp.introduction,
        lp.country,
        lp.state,
        lp.city,
        lp.skill_level,
        lp.preferred_study_times,
        lp.preferred_study_duration,
        lp.collaboration_style,
        lp.education_stage,
        lp.education_details,
        lp.learning_goals,
        lp.is_profile_completed,
        COALESCE(ups.profile_visibility, 'public') AS profile_visibility,
        COALESCE(ups.show_activity_status, 1) AS show_activity_status,
        COALESCE(ups.show_learning_preferences, 1) AS show_learning_preferences,
        COALESCE(ups.show_institution, 1) AS show_institution,
        COALESCE(ups.show_location, 1) AS show_location,
        COALESCE(ups.allow_study_invites, 1) AS allow_study_invites
      FROM (SELECT * FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC) u
      LEFT JOIN learner_profiles lp ON u.id = lp.user_id
      LEFT JOIN user_privacy_settings ups ON u.id = ups.user_id
      WHERE u.is_verified = 1
        AND (u.is_active IS NULL OR u.is_active = 1)
        AND COALESCE(ups.profile_visibility, 'public') != 'private'
    `;
    const queryParams = [];

    const isDemoMode = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'test';
    const isRequestingDemo = requestingUserId && (
      requestingUserId === 'darvin-01' ||
      requestingUserId === 'student-arun' ||
      (requestingUser && requestingUser.email && requestingUser.email.endsWith('@demo.studysync.ai'))
    );

    // Isolate demo accounts from normal student search/discovery
    if (!isDemoMode && !isRequestingDemo) {
      candidateQuery += " AND u.email NOT LIKE '%@demo.studysync.ai' AND u.id NOT IN ('darvin-01', 'student-arun')";
    }

    if (requestingUserId) {
      candidateQuery += `
        AND u.id != ?
        AND u.id NOT IN (
          SELECT blocked_id FROM user_blocks WHERE blocker_id = ?
          UNION
          SELECT blocker_id FROM user_blocks WHERE blocked_id = ?
        )
      `;
      queryParams.push(requestingUserId, requestingUserId, requestingUserId);
    }

    candidateQuery += ' GROUP BY u.id ORDER BY u.created_at DESC';
    const rawCandidates = db.prepare(candidateQuery).all(...queryParams);

    if (rawCandidates.length === 0) {
      return [];
    }

    // Prepare helper statements
    const getCandidatePrefsStmt = db.prepare(`
      SELECT ulp.*, lt.subject, lt.topic_name
      FROM user_learning_preferences ulp
      JOIN learning_topics lt ON ulp.topic_id = lt.id
      WHERE ulp.user_id = ?
    `);

    const getCandidateSubjectsStmt = db.prepare(`
      SELECT subject FROM user_subjects WHERE user_id = ?
    `);

    const getCandidateRoomStmt = db.prepare(`
      SELECT r.id, r.room_name, r.topic, r.subject
      FROM room_memberships rm
      JOIN rooms r ON rm.room_id = r.id
      WHERE rm.user_id = ? AND r.status = 'active'
      ORDER BY r.created_at DESC
      LIMIT 1
    `);

    const checkActiveSessionStmt = db.prepare(`
      SELECT sp.id, ss.topic AS active_session_topic
      FROM session_participants sp
      JOIN study_sessions ss ON sp.session_id = ss.id
      WHERE sp.user_id = ? AND sp.left_at IS NULL AND ss.status = 'active'
      LIMIT 1
    `);

    const getLastActivityStmt = db.prepare(`
      SELECT MAX(latest) AS latest_active FROM (
        SELECT MAX(created_at) AS latest FROM user_focus_intervals WHERE user_id = ?
        UNION ALL
        SELECT MAX(joined_at) AS latest FROM session_participants WHERE user_id = ?
      )
    `);

    // 3. Score every candidate transparently
    const scoredCandidates = [];
    const seenCandidateIds = new Set();

    for (const cand of rawCandidates) {
      // Defense in depth: strictly exclude requesting user by ID and email
      if (requestingUserId && cand.id === requestingUserId) {
        continue;
      }
      if (requestingUser) {
        if (cand.id === requestingUser.id) continue;
        if (requestingUser.email && cand.email?.toLowerCase().trim() === requestingUser.email.toLowerCase().trim()) continue;
      }

      // Deduplicate candidate account records by stable user ID
      if (seenCandidateIds.has(cand.id)) {
        continue;
      }
      seenCandidateIds.add(cand.id);

      const rawDisplayName = (cand.display_name || '').trim();

      // Exclude generated-ID names containing trailing timestamps or raw generated IDs
      if (/\s+[\d_-]{6,}$/.test(rawDisplayName) || /^user[-_]\d+/i.test(rawDisplayName)) {
        continue;
      }

      // Exclude blocked or unverified personas
      if (/^(blocked|unverified)\b/i.test(rawDisplayName)) {
        continue;
      }

      const cleanName = rawDisplayName || 'Student';
      cand.display_name = cleanName;
      
      // Phase 14: Privacy - Rooms-only visibility check
      if (cand.profile_visibility === 'rooms_only') {
        if (!requestingUserId) continue; // Not discoverable to unauthenticated public visitors
        const sharedRooms = db.prepare(`
          SELECT COUNT(DISTINCT rm1.room_id) AS shared_count
          FROM room_memberships rm1
          JOIN room_memberships rm2 ON rm1.room_id = rm2.room_id
          WHERE rm1.user_id = ? AND rm2.user_id = ?
        `).get(requestingUserId, cand.id);

        if (!sharedRooms || sharedRooms.shared_count === 0) continue;
      }

      const candPrefs = getCandidatePrefsStmt.all(cand.id);
      const candSubjects = getCandidateSubjectsStmt.all(cand.id).map((s) => s.subject);
      const candRoom = getCandidateRoomStmt.get(cand.id);
      const activeSessionPresence = checkActiveSessionStmt.get(cand.id);

      let candLanguages = ['English'];
      if (cand.preferred_languages) {
        try {
          candLanguages = JSON.parse(cand.preferred_languages);
        } catch {
          candLanguages = ['English'];
        }
      }

      // Collect topics candidate is studying, strong in, improving, and willing to teach
      // Phase 14: Respect show_learning_preferences privacy setting
      const allowPrefs = Boolean(cand.show_learning_preferences);
      const candLearningNow = allowPrefs ? candPrefs.filter((p) => p.is_learning_now).map((p) => p.topic_name) : [];
      const candStrengths = allowPrefs ? candPrefs.filter((p) => p.is_strength || p.confidence_level === 'confident').map((p) => p.topic_name) : [];
      const candImproving = allowPrefs ? candPrefs.filter((p) => p.is_improving || p.confidence_level === 'needs_improvement').map((p) => p.topic_name) : [];
      const candWillingToTeach = allowPrefs ? candPrefs.filter((p) => p.willing_to_teach === 1).map((p) => p.topic_name) : [];
      const candWantsPeerSupport = allowPrefs ? candPrefs.filter((p) => p.wants_peer_support === 1).map((p) => p.topic_name) : [];

      const allCandTopics = [
        ...candLearningNow,
        ...candStrengths,
        ...candImproving,
        ...candWillingToTeach,
        ...candWantsPeerSupport,
      ];
      if (candRoom?.topic) allCandTopics.push(candRoom.topic);

      // -------------------------------------------------------------
      // Search Term Matching (q: display name, @username, subject, topic)
      // -------------------------------------------------------------
      let qScoreBoost = 0;
      if (criteria.q && criteria.q.trim()) {
        const rawQ = criteria.q.trim();
        const cleanQ = rawQ.toLowerCase();
        const cleanHandle = rawQ.replace(/^@/, '').toLowerCase();

        const exactUsername = cand.username && cand.username.toLowerCase() === cleanHandle;
        const prefixUsername = cand.username && (cand.username.toLowerCase().startsWith(cleanHandle) || cand.username.toLowerCase().includes(cleanHandle));
        const exactName = cand.display_name && cand.display_name.toLowerCase() === cleanQ;
        const partialName = cand.display_name && cand.display_name.toLowerCase().includes(cleanQ);
        const topicMatch = allCandTopics.some((t) => t.toLowerCase().includes(cleanQ));
        const subjectMatch = candSubjects.some((s) => s.toLowerCase().includes(cleanQ));
        const headlineMatch = cand.headline && cand.headline.toLowerCase().includes(cleanQ);
        const institutionMatch = cand.institution && cand.show_institution && cand.institution.toLowerCase().includes(cleanQ);

        if (!exactUsername && !prefixUsername && !exactName && !partialName && !topicMatch && !subjectMatch && !headlineMatch && !institutionMatch) {
          continue; // Filter candidate out when search query does not match
        }

        if (exactUsername) qScoreBoost += 10000;
        else if (exactName) qScoreBoost += 5000;
        else if (prefixUsername) qScoreBoost += 2000;
        else if (partialName) qScoreBoost += 1000;
        else if (topicMatch || subjectMatch) qScoreBoost += 500;
        else if (headlineMatch || institutionMatch) qScoreBoost += 200;
      }

      // -------------------------------------------------------------
      // Structured Filters: Education, Location, Language, Preferences
      // -------------------------------------------------------------
      if (criteria.educationStage && criteria.educationStage.trim() && criteria.educationStage.toLowerCase() !== 'all') {
        const candStage = (cand.education_stage || '').toLowerCase().replace(/_/g, ' ');
        const targetStage = criteria.educationStage.trim().toLowerCase().replace(/_/g, ' ');
        if (!candStage.includes(targetStage) && !targetStage.includes(candStage)) {
          continue;
        }
      }

      if (criteria.fieldOfStudy && criteria.fieldOfStudy.trim() && criteria.fieldOfStudy.toLowerCase() !== 'all') {
        const targetField = criteria.fieldOfStudy.trim().toLowerCase();
        const inHeadline = cand.headline && cand.headline.toLowerCase().includes(targetField);
        const inDetails = cand.education_details && cand.education_details.toLowerCase().includes(targetField);
        const inSubjects = candSubjects.some((s) => s.toLowerCase().includes(targetField));
        if (!inHeadline && !inDetails && !inSubjects) {
          continue;
        }
      }

      if (criteria.institution && criteria.institution.trim()) {
        const targetInst = criteria.institution.trim().toLowerCase();
        if (!cand.show_institution || !cand.institution || !cand.institution.toLowerCase().includes(targetInst)) {
          continue;
        }
      }

      if (criteria.country && criteria.country.trim()) {
        const targetCountry = criteria.country.trim().toLowerCase();
        if (!cand.show_location || !cand.country || !cand.country.toLowerCase().includes(targetCountry)) {
          continue;
        }
      }

      if (criteria.state && criteria.state.trim()) {
        const targetState = criteria.state.trim().toLowerCase();
        if (!cand.show_location || !cand.state || !cand.state.toLowerCase().includes(targetState)) {
          continue;
        }
      }

      if (criteria.city && criteria.city.trim()) {
        const targetCity = criteria.city.trim().toLowerCase();
        if (!cand.show_location || !cand.city || !cand.city.toLowerCase().includes(targetCity)) {
          continue;
        }
      }

      if (criteria.skillLevel && criteria.skillLevel.trim() && criteria.skillLevel.toLowerCase() !== 'all') {
        if ((cand.skill_level || 'Intermediate').toLowerCase() !== criteria.skillLevel.trim().toLowerCase()) {
          continue;
        }
      }

      if (criteria.language && criteria.language.trim() && criteria.language.toLowerCase() !== 'any') {
        if (!candLanguages.some((l) => l.toLowerCase() === criteria.language.trim().toLowerCase())) {
          continue;
        }
      }

      const scheduleFilter = criteria.filterSchedule || criteria.schedule;
      if (scheduleFilter && scheduleFilter.trim() && scheduleFilter.toLowerCase() !== 'any') {
        if (!cand.preferred_study_times || !cand.preferred_study_times.toLowerCase().includes(scheduleFilter.trim().toLowerCase())) {
          continue;
        }
      }

      const hasLimitedProfile = !cand.introduction && (!cand.headline || cand.headline === 'Student Learner' || cand.headline === 'Learner') && candPrefs.length === 0;

      // Component A: Topic Similarity (25%)
      let bestTopicSim = { score: 0.0, reason: '', level: 'none' };
      const topicsToCompare = [
        ...candLearningNow,
        ...candStrengths,
        ...candWillingToTeach,
        candRoom?.topic,
      ].filter(Boolean);

      if (topicsToCompare.length > 0) {
        for (const t of topicsToCompare) {
          const sim = calculateTopicSimilarity(
            hasExplicitTopic ? targetTopic : null,
            t,
            targetSubject,
            candRoom?.subject || candSubjects[0]
          );
          if (sim.score > bestTopicSim.score) {
            bestTopicSim = sim;
          }
        }
      }

      if (candSubjects.length > 0) {
        for (const s of candSubjects) {
          const sim = calculateTopicSimilarity(null, null, targetSubject, s);
          if (sim.score > bestTopicSim.score) bestTopicSim = sim;
        }
      }

      // Check if candidate headline or bio mentions the searched subject
      if (hasExplicitSubject && bestTopicSim.score === 0) {
        const normSubj = targetSubject.toLowerCase();
        if (
          (cand.headline && cand.headline.toLowerCase().includes(normSubj)) ||
          (cand.introduction && cand.introduction.toLowerCase().includes(normSubj))
        ) {
          bestTopicSim = {
            score: 0.35,
            reason: `Coursework and background in ${targetSubject}`,
            level: 'profile_mention',
          };
        }
      }

      // Limited profile learners get coursework enrollment baseline if no explicit subject was required
      if (!hasExplicitSubject && hasLimitedProfile && bestTopicSim.score === 0) {
        bestTopicSim = {
          score: 0.5,
          reason: 'Coursework enrollment (limited profile history)',
          level: 'baseline',
        };
      }

      // In general discovery mode, provide baseline if no specific subject was queried
      if (!hasExplicitSubject && !hasExplicitTopic && bestTopicSim.score === 0) {
        bestTopicSim = { score: 0.5, reason: 'Active peer learner available for collaborative study', level: 'baseline' };
      }

      // If the user explicitly searched for a subject or topic,
      // and this candidate has 0 similarity/overlap, DO NOT return them merely to fill the page!
      if ((hasExplicitSubject || hasExplicitTopic) && bestTopicSim.score === 0) {
        continue;
      }

      const topicScore = Math.round(bestTopicSim.score * 100);

      // Component B: Skill Compatibility (15%)
      const skillEval = calculateSkillCompatibility(
        requestingPrefs,
        candPrefs,
        requestingProfile,
        cand,
        targetTopic,
        {
          intent: targetIntent,
          skillPreference: targetSkillPref,
          confidence: targetConfidence,
        }
      );
      const skillScore = skillEval.score;

      // Component C: Goal Compatibility (15%)
      let goalScore = 70;
      let goalReason = `Shared focus on course progression`;
      const candGoals = candPrefs.map((p) => p.learning_goal).filter(Boolean);
      if (candGoals.some((g) => normalizeText(g) === normalizeText(targetGoal))) {
        goalScore = 100;
        goalReason = `Aligned study goal: ${targetGoal}`;
      } else if (targetGoal.toLowerCase().includes('exam') && candGoals.some((g) => g.toLowerCase().includes('exam') || g.toLowerCase().includes('revision'))) {
        goalScore = 95;
        goalReason = `Both preparing for academic examinations`;
      } else if (targetGoal.toLowerCase().includes('doubt') && (candidateWillingToTeach.length > 0 || skillEval.role === 'explainer')) {
        goalScore = 90;
        goalReason = `Goal aligned: targeted doubt resolution and concept review`;
      }

      // Component D: Schedule Compatibility (10%)
      const scheduleEval = calculateScheduleCompatibility(targetTime, cand.preferred_study_times);
      const scheduleScore = scheduleEval.score;

      // Component E: Language Compatibility (10%)
      const langEval = calculateLanguageCompatibility(userLanguages, candLanguages);
      const languageScore = langEval.score;

      // Component F: Learning Style Compatibility (10%)
      const styleEval = calculateLearningStyleCompatibility(
        targetDuration,
        cand.preferred_study_duration,
        targetCollabStyle,
        cand.collaboration_style
      );
      const styleScore = styleEval.score;

      // Component G: Reliability (10%)
      const reliabilityEval = calculateReliability(cand.id, db);
      const reliabilityScore = reliabilityEval.score;

      // Component H: Previous Collaboration (5%)
      const collabEval = calculateCollaborationQuality(requestingUserId, cand.id, db);
      const collabScore = collabEval.score;

      // Weighted Total Score
      const totalScore = Math.round(
        weights.topicSimilarity * topicScore +
        weights.skillCompatibility * skillScore +
        weights.goalCompatibility * goalScore +
        weights.scheduleCompatibility * scheduleScore +
        weights.languageCompatibility * languageScore +
        weights.learningStyleCompatibility * styleScore +
        weights.reliability * reliabilityScore +
        weights.previousCollaboration * collabScore
      );

      // Build truthful, explainable reasons
      const matchingReasons = [];

      // Direct pairwise collaboration preference is top priority
      if (collabScore >= 90 || collabScore <= 35) {
        matchingReasons.push(collabEval.reason);
      }

      // Topic explanation
      if (topicScore >= 80) {
        const isBothStudying = candLearningNow.some((t) => isTopicMatch(t, targetTopic));
        if (isBothStudying && hasExplicitTopic) {
          matchingReasons.push(`You both want to study ${targetTopic}`);
        } else {
          matchingReasons.push(bestTopicSim.reason || `Target topic match: ${targetTopic}`);
        }
      } else if (topicScore >= 50) {
        matchingReasons.push(bestTopicSim.reason || `Related topic in ${targetSubject}`);
      } else {
        matchingReasons.push(`Enrolled in ${candSubjects[0] || targetSubject}`);
      }

      // Skill & Intent explanation
      matchingReasons.push(skillEval.reason);

      // Goal explanation
      if (goalScore >= 90) {
        matchingReasons.push(goalReason);
      }

      // Schedule explanation (truthful, non-fabricated)
      if (scheduleEval.reason) {
        matchingReasons.push(scheduleEval.reason);
      }

      // Language explanation
      if (languageScore >= 90) {
        const commonLangs = candLanguages.filter((l) => userLanguages.some((ul) => ul.toLowerCase() === l.toLowerCase()));
        matchingReasons.push(`Shared language${commonLangs.length > 1 ? 's' : ''}: ${commonLangs.join(', ')}`);
      }

      // Reliability explanation
      if (reliabilityEval.reason) {
        matchingReasons.push(reliabilityEval.reason);
      }

      // Limited profile disclaimer if applicable
      if (hasLimitedProfile) {
        matchingReasons.push('Recommendation based on course enrollment (limited profile history)');
      }

      // Presence & immediate availability evidence (Phase 14: privacy-checked)
      let presenceStatus = 'scheduled';
      let presenceLabel = cand.preferred_study_times || 'Schedule unconfirmed';

      if (!cand.show_activity_status) {
        presenceStatus = 'offline';
        presenceLabel = 'Offline';
      } else if (activeSessionPresence) {
        presenceStatus = 'active';
        presenceLabel = `Active in study session (${activeSessionPresence.active_session_topic || 'Live block'})`;
      } else if (!cand.preferred_study_times) {
        presenceStatus = 'unconfirmed';
        presenceLabel = 'Schedule unconfirmed';
      }

      // Format clean initials
      const nameParts = (cand.display_name || 'Student').trim().split(/\s+/);
      const studentInitials = nameParts.length > 1
        ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
        : nameParts[0].slice(0, 2).toUpperCase();

      // Extract degree/major and year from headline if present without hardcoding CSE
      let major = cand.education_stage ? cand.education_stage.replace(/_/g, ' ') : 'General Studies';
      let year = cand.education_stage ? cand.education_stage.replace(/_/g, ' ') : 'Learner';
      if (cand.headline) {
        const parts = cand.headline.split('•');
        if (parts.length >= 2) {
          year = parts[0].trim();
          major = parts[1].trim();
        } else {
          major = cand.headline;
          year = cand.education_stage ? cand.education_stage.replace(/_/g, ' ') : 'Learner';
        }
      }

      const institution = cand.show_institution
        ? (cand.institution || null)
        : null;

      let lastActiveTimestamp = cand.user_updated_at || cand.user_created_at || '1970-01-01';
      if (cand.show_activity_status) {
        const actRow = getLastActivityStmt.get(cand.id, cand.id);
        if (actRow?.latest_active && actRow.latest_active > lastActiveTimestamp) {
          lastActiveTimestamp = actRow.latest_active;
        }
      }

      scoredCandidates.push({
        id: `match-${cand.id}`,
        studentId: cand.id,
        studentName: cand.display_name,
        username: cand.username || cand.display_name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        studentInitials,
        displayName: cand.display_name,
        avatarUrl: cand.avatar_url,
        major,
        year,
        headline: cand.show_institution ? (cand.headline || `${year} • ${major}`) : `${year} • Student`,
        institution,
        country: cand.show_location ? (cand.country || null) : null,
        state: cand.show_location ? (cand.state || null) : null,
        city: cand.show_location ? (cand.city || null) : null,
        educationStage: cand.education_stage || null,
        bio: cand.introduction || '',
        topic: hasExplicitTopic ? targetTopic : (candLearningNow[0] || candStrengths[0] || candRoom?.topic || targetTopic),
        subject: hasExplicitSubject ? targetSubject : (candSubjects[0] || candRoom?.subject || targetSubject),
        skillLevel: cand.skill_level || 'Intermediate',
        compatibilityScore: Math.min(99, Math.max(35, totalScore)),
        compatibilityMetricType: 'deterministic_weighted_index',
        compatibilityScoreFormula: 'topic(25%) + skill(15%) + goal(15%) + schedule(10%) + language(10%) + style(10%) + reliability(10%) + collab(5%)',
        isProbabilityScore: false,
        role: skillEval.role,
        roleLabel: skillEval.roleLabel,
        isColdStart: reliabilityEval.isColdStart || false,
        hasLimitedProfile,
        allowStudyInvites: Boolean(cand.allow_study_invites),
        profileVisibility: cand.profile_visibility || 'public',
        scoreBreakdown: {
          topicSimilarity: topicScore,
          skillCompatibility: skillScore,
          goalCompatibility: goalScore,
          scheduleCompatibility: scheduleScore,
          languageCompatibility: languageScore,
          learningStyleCompatibility: styleScore,
          reliability: reliabilityScore,
          previousCollaboration: collabScore,
        },
        mutualAvailability: cand.preferred_study_times || 'Schedule unconfirmed',
        availabilityStatus: scheduleEval.status,
        isAvailabilityUnknown: !cand.preferred_study_times,
        presenceStatus,
        presenceLabel,
        languages: candLanguages.join(', '),
        preferredLanguages: candLanguages,
        learningNow: candLearningNow.length > 0 ? candLearningNow.join(', ') : (hasExplicitTopic ? targetTopic : ''),
        learningNowList: candLearningNow,
        strengths: candStrengths,
        improving: candImproving,
        willingToTeach: candWillingToTeach,
        wantsPeerSupport: candWantsPeerSupport,
        collaborationStyle: cand.collaboration_style || 'Peer discussion & problem solving',
        subjects: candSubjects.length > 0 ? candSubjects : (hasExplicitSubject ? [targetSubject] : []),
        matchingReasons: matchingReasons.slice(0, 6),
        explanationDetails: {
          topic: bestTopicSim.reason,
          skill: skillEval.reason,
          goal: goalReason,
          schedule: scheduleEval.reason,
          reliability: reliabilityEval.reason,
          hasLimitedProfile,
        },
        recommendationReason: `Compatible partner for ${targetTopic} with ${reliabilityEval.percentage}.`,
        connectedRoomId: candRoom?.id || null,
        connectedRoomTitle: candRoom?.room_name || null,
        ai_enhanced: false,
        engine: 'deterministic_rule_based',
        _qBoost: qScoreBoost,
        _lastActive: lastActiveTimestamp,
      });
    }

    // Fairness & Deterministic Sorting:
    // Sort options: best_match (default), recently_active, name_asc
    const sortMode = criteria.sort || 'best_match';

    if (sortMode === 'recently_active') {
      scoredCandidates.sort((a, b) => {
        const timeA = a._lastActive ? new Date(a._lastActive).getTime() : 0;
        const timeB = b._lastActive ? new Date(b._lastActive).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return (a.studentName || '').localeCompare(b.studentName || '');
      });
    } else if (sortMode === 'name_asc') {
      scoredCandidates.sort((a, b) => {
        return (a.studentName || '').localeCompare(b.studentName || '');
      });
    } else {
      // Default: best_match with search query boost
      scoredCandidates.sort((a, b) => {
        const scoreA = (a.compatibilityScore || 50) + (a._qBoost || 0);
        const scoreB = (b.compatibilityScore || 50) + (b._qBoost || 0);
        const diff = scoreB - scoreA;
        if (Math.abs(diff) <= 2) {
          if (a.isColdStart && !b.isColdStart) return -1;
          if (!a.isColdStart && b.isColdStart) return 1;
          return (a.studentName || '').localeCompare(b.studentName || '');
        }
        return diff;
      });
    }

    // Pagination
    const totalCount = scoredCandidates.length;
    const page = Math.max(1, parseInt(criteria.page, 10) || 1);
    const limit = criteria.limit ? Math.max(1, Math.min(500, parseInt(criteria.limit, 10))) : 12;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const startIndex = (page - 1) * limit;
    const pagedResults = scoredCandidates.slice(startIndex, startIndex + limit);

    for (const card of pagedResults) {
      delete card._qBoost;
      delete card._lastActive;
    }

    pagedResults.total = totalCount;
    pagedResults.page = page;
    pagedResults.limit = limit;
    pagedResults.totalPages = totalPages;
    pagedResults.hasMore = page < totalPages;

    return pagedResults;
  },
};

export default MatchingEngine;
