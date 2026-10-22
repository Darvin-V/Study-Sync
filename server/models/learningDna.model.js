import { getDb, withTransaction } from '../db/connection.js';
import UserModel from './user.model.js';
import ProfileModel from './profile.model.js';

/**
 * StudySync AI — Learning DNA Model (Phase 10)
 * 
 * Represents each student's transparent learning identity:
 * - Active curriculum subjects and topics
 * - Self-reported confidence levels (confident, neutral, needs improvement)
 * - Collaboration style (e.g. concept exchange, problem solving, quiet co-working)
 * - Topics willing to teach (peer teaching contribution)
 * - Topics requesting peer support (help needed)
 * - Study availability, language preferences, and personal goals
 * 
 * Fully persisted in SQLite. Strictly enforced authenticated ownership.
 */
export const DNA_FIELD_EXPLANATIONS = Object.freeze({
  subjects: 'Identifies academic disciplines for syllabus mapping and room filtering.',
  confidentTopics: 'Topics you feel comfortable with; helps peers find study partners who can explain concepts.',
  difficultTopics: 'Topics where you want more practice or clarity; prioritizes revision prompts and peer mentors.',
  willingToTeachTopics: 'Topics where you are willing to explain concepts or lead study discussions for peers.',
  wantsPeerSupportTopics: 'Topics where you actively request peer assistance, doubt solving, or co-studying.',
  collaborationStyle: 'Your preferred interaction format (discussion, problem-solving, quiet co-working); ensures peer compatibility.',
  preferredStudyTimes: 'Your typical availability window so you match with peers in compatible timezones/schedules.',
  preferredLanguages: 'Languages in which you feel most comfortable discussing technical concepts.',
  learningGoals: 'Specific milestones (e.g., exam prep, assignment completion) guiding smart recommendations.',
});

export const COLLABORATION_STYLES = Object.freeze([
  'Peer discussion & problem solving',
  'Concept exchange & peer teaching',
  'Quiet co-working with periodic Q&A',
  'Structured exam revision & flashcards',
  'Coding pairs & implementation review',
]);

export const LearningDNAModel = {
  /**
   * Retrieves complete, personalized Learning DNA for an authenticated learner
   */
  getLearningDNA(userId, customDb = null) {
    const db = customDb || getDb();
    const user = UserModel.findById(userId, db);
    if (!user) return null;

    let profile = ProfileModel.findByUserId(userId, db);
    if (!profile) {
      profile = ProfileModel.upsert(userId, { skill_level: 'Intermediate', is_profile_completed: 0 }, db);
    }

    const subjects = ProfileModel.getSubjects(userId, db);
    const preferences = ProfileModel.getPreferences(userId, db);

    const confidentTopics = preferences
      .filter((p) => p.confidence_level === 'confident' || p.is_strength === 1)
      .map((p) => ({
        id: p.topic_id,
        name: p.topic_name,
        subject: p.subject,
        difficulty: p.difficulty_level,
        learningGoal: p.learning_goal || null,
      }));

    const difficultTopics = preferences
      .filter((p) => p.confidence_level === 'needs_improvement' || p.is_improving === 1)
      .map((p) => ({
        id: p.topic_id,
        name: p.topic_name,
        subject: p.subject,
        difficulty: p.difficulty_level,
        learningGoal: p.learning_goal || null,
      }));

    const neutralTopics = preferences
      .filter((p) => p.confidence_level === 'neutral' && !p.is_strength && !p.is_improving)
      .map((p) => ({
        id: p.topic_id,
        name: p.topic_name,
        subject: p.subject,
        difficulty: p.difficulty_level,
      }));

    const willingToTeachTopics = preferences
      .filter((p) => Boolean(p.willing_to_teach))
      .map((p) => ({
        id: p.topic_id,
        name: p.topic_name,
        subject: p.subject,
        difficulty: p.difficulty_level,
      }));

    const wantsPeerSupportTopics = preferences
      .filter((p) => Boolean(p.wants_peer_support))
      .map((p) => ({
        id: p.topic_id,
        name: p.topic_name,
        subject: p.subject,
        difficulty: p.difficulty_level,
      }));

    const learningGoals = preferences
      .filter((p) => p.learning_goal && p.learning_goal.trim().length > 0)
      .map((p) => p.learning_goal.trim());

    // Verified assessment count (for reference, kept strictly distinct from self-reported confidence)
    const assessments = db.prepare(`
      SELECT COUNT(*) AS count, AVG(score_percentage) AS avg_score
      FROM topic_assessments
      WHERE user_id = ?
    `).get(userId);

    return {
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      preferredLanguages: user.preferredLanguages || ['English'],
      preferredStudyTimes: profile.preferred_study_times || 'Weekday evenings',
      preferredStudyDuration: profile.preferred_study_duration || 45,
      collaborationStyle: profile.collaboration_style || 'Peer discussion & problem solving',
      skillLevel: profile.skill_level || 'Intermediate',
      subjects,
      confidentTopics,
      difficultTopics,
      neutralTopics,
      willingToTeachTopics,
      wantsPeerSupportTopics,
      learningGoals,
      allPreferences: preferences.map((p) => ({
        topicId: p.topic_id,
        topicName: p.topic_name,
        subject: p.subject,
        difficulty: p.difficulty_level,
        confidenceLevel: p.confidence_level,
        willingToTeach: Boolean(p.willing_to_teach),
        wantsPeerSupport: Boolean(p.wants_peer_support),
        isLearningNow: Boolean(p.is_learning_now),
        learningGoal: p.learning_goal,
      })),
      stats: {
        totalConfiguredTopics: preferences.length,
        confidentCount: confidentTopics.length,
        difficultCount: difficultTopics.length,
        willingToTeachCount: willingToTeachTopics.length,
        wantsPeerSupportCount: wantsPeerSupportTopics.length,
        verifiedAssessmentsCount: assessments?.count || 0,
        averageAssessmentScore: assessments?.avg_score ? Math.round(assessments.avg_score * 10) / 10 : null,
      },
      fieldExplanations: DNA_FIELD_EXPLANATIONS,
      availableCollaborationStyles: COLLABORATION_STYLES,
      updatedAt: profile.updated_at,
    };
  },

  /**
   * Updates Learning DNA preferences for the authenticated learner
   */
  updateLearningDNA(userId, updateData, customDb = null) {
    const db = customDb || getDb();

    // 1. Update user languages if specified
    if (updateData.preferredLanguages !== undefined && Array.isArray(updateData.preferredLanguages)) {
      UserModel.update(
        userId,
        { preferred_languages: updateData.preferredLanguages },
        db
      );
    }

    // 2. Update profile preferences
    const profileUpdates = {};
    if (updateData.collaborationStyle !== undefined) {
      profileUpdates.collaboration_style = updateData.collaborationStyle;
    }
    if (updateData.preferredStudyTimes !== undefined) {
      profileUpdates.preferred_study_times = updateData.preferredStudyTimes;
    }
    if (updateData.preferredStudyDuration !== undefined) {
      profileUpdates.preferred_study_duration = Number(updateData.preferredStudyDuration);
    }
    if (updateData.skillLevel !== undefined) {
      profileUpdates.skill_level = updateData.skillLevel;
    }

    if (Object.keys(profileUpdates).length > 0) {
      ProfileModel.upsert(userId, profileUpdates, db);
    }

    // 3. Update subjects if provided
    if (updateData.subjects !== undefined && Array.isArray(updateData.subjects)) {
      ProfileModel.setSubjects(userId, updateData.subjects, db);
    }

    // 4. Update topic preferences if provided
    const topicList = updateData.topics || updateData.preferences;
    if (Array.isArray(topicList)) {
      ProfileModel.setPreferences(userId, topicList, db);
    }

    return this.getLearningDNA(userId, db);
  },
};

export default LearningDNAModel;
