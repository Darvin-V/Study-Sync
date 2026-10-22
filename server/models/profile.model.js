import { getDb, withTransaction } from '../db/connection.js';
import UserModel from './user.model.js';

/**
 * StudySync AI — Learner Profile Model
 * 
 * Manages comprehensive learner profile data, academic subjects,
 * and user-reported topic preferences (learning now, strengths, and areas needing improvement).
 */
export const ProfileModel = {
  /**
   * Retrieves profile details for a user
   */
  findByUserId(userId, customDb = null) {
    const db = customDb || getDb();
    return db.prepare('SELECT * FROM learner_profiles WHERE user_id = ?').get(userId) || null;
  },

  /**
   * Creates or updates a learner profile
   */
  upsert(userId, data, customDb = null) {
    const db = customDb || getDb();
    const existing = this.findByUserId(userId, db);
    const now = new Date().toISOString();

    if (!existing) {
      const id = `profile-${userId}`;
      const stmt = db.prepare(`
        INSERT INTO learner_profiles (
          id, user_id, headline, institution, introduction, skill_level,
          preferred_study_times, preferred_study_duration, collaboration_style, is_profile_completed,
          age, gender, education_stage, education_details, learning_goals,
          country, state, city,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        userId,
        data.headline || null,
        data.institution || null,
        data.introduction || null,
        data.skill_level || 'Intermediate',
        data.preferred_study_times || null,
        Number.isInteger(data.preferred_study_duration) ? data.preferred_study_duration : 45,
        data.collaboration_style || 'Peer discussion & problem solving',
        data.is_profile_completed ? 1 : 0,
        data.age !== undefined ? data.age : null,
        data.gender || 'Prefer not to say',
        data.education_stage || null,
        data.education_details || null,
        data.learning_goals || null,
        data.country || null,
        data.state || null,
        data.city || null,
        now,
        now
      );
    } else {
      const updates = [];
      const params = [];

      if (data.headline !== undefined) {
        updates.push('headline = ?');
        params.push(data.headline);
      }
      if (data.institution !== undefined) {
        updates.push('institution = ?');
        params.push(data.institution);
      }
      if (data.introduction !== undefined) {
        updates.push('introduction = ?');
        params.push(data.introduction);
      }
      if (data.skill_level !== undefined) {
        updates.push('skill_level = ?');
        params.push(data.skill_level);
      }
      if (data.preferred_study_times !== undefined) {
        updates.push('preferred_study_times = ?');
        params.push(data.preferred_study_times);
      }
      if (data.preferred_study_duration !== undefined) {
        updates.push('preferred_study_duration = ?');
        params.push(Number.isInteger(data.preferred_study_duration) ? data.preferred_study_duration : 45);
      }
      if (data.collaboration_style !== undefined) {
        updates.push('collaboration_style = ?');
        params.push(data.collaboration_style);
      }
      if (data.is_profile_completed !== undefined) {
        updates.push('is_profile_completed = ?');
        params.push(data.is_profile_completed ? 1 : 0);
      }
      if (data.age !== undefined) {
        updates.push('age = ?');
        params.push(data.age);
      }
      if (data.gender !== undefined) {
        updates.push('gender = ?');
        params.push(data.gender);
      }
      if (data.education_stage !== undefined) {
        updates.push('education_stage = ?');
        params.push(data.education_stage);
      }
      if (data.education_details !== undefined) {
        updates.push('education_details = ?');
        params.push(data.education_details);
      }
      if (data.learning_goals !== undefined) {
        updates.push('learning_goals = ?');
        params.push(data.learning_goals);
      }
      if (data.country !== undefined) {
        updates.push('country = ?');
        params.push(data.country);
      }
      if (data.state !== undefined) {
        updates.push('state = ?');
        params.push(data.state);
      }
      if (data.city !== undefined) {
        updates.push('city = ?');
        params.push(data.city);
      }

      if (updates.length > 0) {
        updates.push('updated_at = ?');
        params.push(now);
        params.push(userId);

        db.prepare(`UPDATE learner_profiles SET ${updates.join(', ')} WHERE user_id = ?`).run(...params);
      }
    }

    return this.findByUserId(userId, db);
  },

  /**
   * Retrieves enrolled subjects for a user
   */
  getSubjects(userId, customDb = null) {
    const db = customDb || getDb();
    const rows = db.prepare(`
      SELECT subject 
      FROM user_subjects 
      WHERE user_id = ? 
      ORDER BY subject ASC
    `).all(userId);
    return rows.map((r) => r.subject);
  },

  /**
   * Sets enrolled subjects for a user
   */
  setSubjects(userId, subjects, customDb = null) {
    if (!Array.isArray(subjects)) return this.getSubjects(userId, customDb);

    return withTransaction((txDb) => {
      txDb.prepare('DELETE FROM user_subjects WHERE user_id = ?').run(userId);

      const insertStmt = txDb.prepare(`
        INSERT INTO user_subjects (id, user_id, subject, created_at)
        VALUES (?, ?, ?, ?)
      `);

      const now = new Date().toISOString();
      for (const subj of subjects) {
        if (typeof subj === 'string' && subj.trim().length > 0) {
          const id = `subj-${userId}-${subj.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
          insertStmt.run(id, userId, subj.trim(), now);
        }
      }

      return this.getSubjects(userId, txDb);
    }, customDb);
  },

  /**
   * Retrieves user topic preferences with Learning DNA metadata
   */
  getPreferences(userId, customDb = null) {
    const db = customDb || getDb();
    return db.prepare(`
      SELECT 
        p.id AS preference_id,
        p.user_id,
        p.topic_id,
        p.learning_goal,
        p.skill_level,
        p.learning_status,
        p.preferred_study_duration,
        p.is_learning_now,
        p.is_strength,
        p.is_improving,
        COALESCE(p.confidence_level, CASE WHEN p.is_strength = 1 THEN 'confident' WHEN p.is_improving = 1 THEN 'needs_improvement' ELSE 'neutral' END) AS confidence_level,
        COALESCE(p.willing_to_teach, 0) AS willing_to_teach,
        COALESCE(p.wants_peer_support, 0) AS wants_peer_support,
        p.created_at,
        p.updated_at,
        t.subject,
        t.topic_name,
        t.difficulty_level,
        t.description AS topic_description
      FROM user_learning_preferences p
      JOIN learning_topics t ON p.topic_id = t.id
      WHERE p.user_id = ?
      ORDER BY t.subject ASC, t.topic_name ASC
    `).all(userId);
  },

  /**
   * Updates or saves user topic preferences
   */
  setPreferences(userId, preferences, customDb = null) {
    if (!Array.isArray(preferences)) return this.getPreferences(userId, customDb);

    return withTransaction((txDb) => {
      const now = new Date().toISOString();

      const upsertStmt = txDb.prepare(`
        INSERT INTO user_learning_preferences (
          id, user_id, topic_id, learning_goal, skill_level, learning_status,
          preferred_study_duration, is_learning_now, is_strength, is_improving,
          confidence_level, willing_to_teach, wants_peer_support,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, topic_id) DO UPDATE SET
          learning_goal = excluded.learning_goal,
          skill_level = excluded.skill_level,
          learning_status = excluded.learning_status,
          preferred_study_duration = excluded.preferred_study_duration,
          is_learning_now = excluded.is_learning_now,
          is_strength = excluded.is_strength,
          is_improving = excluded.is_improving,
          confidence_level = excluded.confidence_level,
          willing_to_teach = excluded.willing_to_teach,
          wants_peer_support = excluded.wants_peer_support,
          updated_at = excluded.updated_at
      `);

      for (const pref of preferences) {
        if (!pref.topic_id) continue;

        // Verify topic exists
        const topicExists = txDb.prepare('SELECT id FROM learning_topics WHERE id = ?').get(pref.topic_id);
        if (!topicExists) continue;

        // Sync confidence_level with is_strength and is_improving
        let confLevel = pref.confidence_level;
        let isStr = pref.is_strength ? 1 : 0;
        let isImp = pref.is_improving ? 1 : 0;

        if (confLevel === 'confident') {
          isStr = 1;
          isImp = 0;
        } else if (confLevel === 'needs_improvement') {
          isImp = 1;
          isStr = 0;
        } else if (confLevel === 'neutral') {
          isStr = 0;
          isImp = 0;
        } else {
          // Derive confidence_level from flags if not explicitly provided
          if (isStr) confLevel = 'confident';
          else if (isImp) confLevel = 'needs_improvement';
          else confLevel = 'neutral';
        }

        const prefId = `pref-${userId}-${pref.topic_id}`;
        upsertStmt.run(
          prefId,
          userId,
          pref.topic_id,
          pref.learning_goal || '',
          pref.skill_level || 'Intermediate',
          pref.learning_status || 'actively_learning',
          pref.preferred_study_duration || 45,
          pref.is_learning_now !== undefined ? (pref.is_learning_now ? 1 : 0) : 1,
          isStr,
          isImp,
          confLevel,
          pref.willing_to_teach ? 1 : 0,
          pref.wants_peer_support ? 1 : 0,
          now,
          now
        );
      }

      return this.getPreferences(userId, txDb);
    }, customDb);
  },

  /**
   * Removes a specific topic preference for a user
   */
  removePreference(userId, topicId, customDb = null) {
    const db = customDb || getDb();
    db.prepare('DELETE FROM user_learning_preferences WHERE user_id = ? AND topic_id = ?').run(userId, topicId);
    return this.getPreferences(userId, db);
  },

  /**
   * Assembles unified learner profile with Learning DNA
   */
  getFullProfile(userId, customDb = null) {
    const db = customDb || getDb();
    const user = UserModel.findById(userId, db);
    if (!user) return null;

    let profile = this.findByUserId(userId, db);
    if (!profile) {
      profile = this.upsert(userId, { skill_level: 'Intermediate', is_profile_completed: 0 }, db);
    }

    const subjects = this.getSubjects(userId, db);
    const preferences = this.getPreferences(userId, db);

    const currentlyLearning = preferences
      .filter((p) => p.is_learning_now)
      .map((p) => ({
        id: p.topic_id,
        subject: p.subject,
        name: p.topic_name,
        difficulty: p.difficulty_level,
        goal: p.learning_goal,
        confidenceLevel: p.confidence_level,
        willingToTeach: Boolean(p.willing_to_teach),
        wantsPeerSupport: Boolean(p.wants_peer_support),
      }));

    const strengths = preferences
      .filter((p) => p.is_strength || p.confidence_level === 'confident')
      .map((p) => ({
        id: p.topic_id,
        subject: p.subject,
        name: p.topic_name,
        difficulty: p.difficulty_level,
      }));

    const improvementAreas = preferences
      .filter((p) => p.is_improving || p.confidence_level === 'needs_improvement')
      .map((p) => ({
        id: p.topic_id,
        subject: p.subject,
        name: p.topic_name,
        difficulty: p.difficulty_level,
      }));

    const willingToTeach = preferences
      .filter((p) => Boolean(p.willing_to_teach))
      .map((p) => ({
        id: p.topic_id,
        subject: p.subject,
        name: p.topic_name,
        difficulty: p.difficulty_level,
      }));

    const wantsPeerSupport = preferences
      .filter((p) => Boolean(p.wants_peer_support))
      .map((p) => ({
        id: p.topic_id,
        subject: p.subject,
        name: p.topic_name,
        difficulty: p.difficulty_level,
      }));

    const goals = preferences
      .filter((p) => p.learning_goal && p.learning_goal.trim().length > 0)
      .map((p) => p.learning_goal);

    let parsedGoals = goals;
    if (profile.learning_goals) {
      try {
        const customGoals = JSON.parse(profile.learning_goals);
        if (Array.isArray(customGoals) && customGoals.length > 0) {
          parsedGoals = customGoals;
        }
      } catch {
        parsedGoals = goals;
      }
    }

    let parsedEduDetails = null;
    if (profile.education_details) {
      try {
        parsedEduDetails = JSON.parse(profile.education_details);
      } catch {
        parsedEduDetails = { notes: profile.education_details };
      }
    }

    return {
      userId: user.id,
      displayName: user.displayName,
      username: user.username || null,
      email: user.email,
      avatarUrl: user.avatarUrl,
      preferredLanguages: user.preferredLanguages,
      headline: profile.headline || 'Student Learner',
      institution: profile.institution || '',
      introduction: profile.introduction || '',
      country: profile.country || null,
      state: profile.state || null,
      city: profile.city || null,
      skillLevel: profile.skill_level || 'Intermediate',
      preferredStudyTimes: profile.preferred_study_times || 'Weekday evenings',
      preferredStudyDuration: profile.preferred_study_duration || 45,
      collaborationStyle: profile.collaboration_style || 'Peer discussion & problem solving',
      isProfileCompleted: Boolean(profile.is_profile_completed),
      // Private fields: available to authenticated user on their own account
      age: profile.age ?? null,
      gender: profile.gender ?? 'Prefer not to say',
      educationStage: profile.education_stage ?? null,
      educationDetails: parsedEduDetails,
      subjects,
      currentlyLearning,
      strengths,
      improvementAreas,
      willingToTeach,
      wantsPeerSupport,
      learningGoals: parsedGoals,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  },
};

export default ProfileModel;
