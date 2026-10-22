import { getDb, withTransaction } from '../db/connection.js';
import { verifyPassword } from '../utils/crypto.js';
import UserSessionModel from './userSession.model.js';
import NotificationModel from './notification.model.js';

/**
 * StudySync AI — Safety, Privacy & Trust Model (Phase 14)
 * 
 * Centralizes data persistence and business logic for:
 * - Granular user privacy settings (discoverability, field visibility, study invites)
 * - Two-way blocking enforcement across recommendations, invites, and rooms
 * - Abuse and safety reporting workflow with duplicate prevention
 * - Role-governed moderation actions with auditable logging
 * - Safe account deactivation and data minimization
 */
export const SafetyModel = {
  // ==========================================================================
  // 1. Privacy Settings
  // ==========================================================================

  getPrivacySettings(userId, customDb = null) {
    if (!userId) return null;
    const db = customDb || getDb();

    const row = db.prepare(`
      SELECT user_id, profile_visibility, show_activity_status,
             show_learning_preferences, show_institution, allow_study_invites,
             COALESCE(show_location, 1) AS show_location,
             created_at, updated_at
      FROM user_privacy_settings
      WHERE user_id = ?
    `).get(userId);

    if (!row) {
      // Sensible privacy-respecting defaults
      return {
        userId,
        profileVisibility: 'public', // 'public' | 'rooms_only' | 'private'
        showActivityStatus: true,
        showLearningPreferences: true,
        showInstitution: true,
        showLocation: true,
        allowStudyInvites: true,
        isDefault: true,
        updatedAt: null,
      };
    }

    return {
      userId: row.user_id,
      profileVisibility: row.profile_visibility,
      showActivityStatus: Boolean(row.show_activity_status),
      showLearningPreferences: Boolean(row.show_learning_preferences),
      showInstitution: Boolean(row.show_institution),
      showLocation: Boolean(row.show_location),
      allowStudyInvites: Boolean(row.allow_study_invites),
      isDefault: false,
      updatedAt: row.updated_at,
    };
  },

  upsertPrivacySettings(userId, settings = {}, customDb = null) {
    if (!userId) return null;
    const db = customDb || getDb();
    const now = new Date().toISOString();

    const current = this.getPrivacySettings(userId, db);

    const profileVisibility = settings.profileVisibility !== undefined
      ? settings.profileVisibility
      : current.profileVisibility;
    const showActivityStatus = settings.showActivityStatus !== undefined
      ? (settings.showActivityStatus ? 1 : 0)
      : (current.showActivityStatus ? 1 : 0);
    const showLearningPreferences = settings.showLearningPreferences !== undefined
      ? (settings.showLearningPreferences ? 1 : 0)
      : (current.showLearningPreferences ? 1 : 0);
    const showInstitution = settings.showInstitution !== undefined
      ? (settings.showInstitution ? 1 : 0)
      : (current.showInstitution ? 1 : 0);
    const showLocation = settings.showLocation !== undefined
      ? (settings.showLocation ? 1 : 0)
      : (current.showLocation !== undefined ? (current.showLocation ? 1 : 0) : 1);
    const allowStudyInvites = settings.allowStudyInvites !== undefined
      ? (settings.allowStudyInvites ? 1 : 0)
      : (current.allowStudyInvites ? 1 : 0);

    db.prepare(`
      INSERT INTO user_privacy_settings (
        user_id, profile_visibility, show_activity_status,
        show_learning_preferences, show_institution, show_location, allow_study_invites,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        profile_visibility = excluded.profile_visibility,
        show_activity_status = excluded.show_activity_status,
        show_learning_preferences = excluded.show_learning_preferences,
        show_institution = excluded.show_institution,
        show_location = excluded.show_location,
        allow_study_invites = excluded.allow_study_invites,
        updated_at = excluded.updated_at
    `).run(
      userId,
      profileVisibility,
      showActivityStatus,
      showLearningPreferences,
      showInstitution,
      showLocation,
      allowStudyInvites,
      now,
      now
    );

    return this.getPrivacySettings(userId, db);
  },

  // ==========================================================================
  // 2. Blocking Enforcement
  // ==========================================================================

  blockUser(blockerId, blockedId, customDb = null) {
    if (!blockerId || !blockedId) throw new Error('Blocker and blocked IDs required');
    if (blockerId === blockedId) {
      const err = new Error('You cannot block yourself');
      err.statusCode = 400;
      err.code = 'INVALID_ACTION';
      throw err;
    }

    const db = customDb || getDb();
    const target = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(blockedId);
    if (!target) {
      const err = new Error('User to block does not exist');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const id = `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO user_blocks (id, blocker_id, blocked_id, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(blocker_id, blocked_id) DO NOTHING
    `).run(id, blockerId, blockedId, now);

    return {
      blocked: true,
      isBlocked: true,
      targetUserId: blockedId,
      targetName: target.display_name,
      timestamp: now,
    };
  },

  unblockUser(blockerId, blockedId, customDb = null) {
    if (!blockerId || !blockedId) return false;
    const db = customDb || getDb();

    const info = db.prepare(`
      DELETE FROM user_blocks
      WHERE blocker_id = ? AND blocked_id = ?
    `).run(blockerId, blockedId);

    return info.changes > 0;
  },

  isBlocked(userA, userB, customDb = null) {
    if (!userA || !userB) return false;
    const db = customDb || getDb();

    const row = db.prepare(`
      SELECT id FROM user_blocks
      WHERE (blocker_id = ? AND blocked_id = ?)
         OR (blocker_id = ? AND blocked_id = ?)
      LIMIT 1
    `).get(userA, userB, userB, userA);

    return Boolean(row);
  },

  getBlockedUsers(blockerId, customDb = null) {
    if (!blockerId) return [];
    const db = customDb || getDb();

    return db.prepare(`
      SELECT 
        u.id,
        u.id AS user_id,
        ub.blocked_id,
        u.display_name,
        u.avatar_url,
        ub.created_at,
        ub.created_at AS blocked_at
      FROM user_blocks ub
      JOIN users u ON ub.blocked_id = u.id
      WHERE ub.blocker_id = ?
      ORDER BY ub.created_at DESC
    `).all(blockerId);
  },

  getBlockedUserIds(userId, customDb = null) {
    if (!userId) return new Set();
    const db = customDb || getDb();

    const rows = db.prepare(`
      SELECT blocked_id AS other_id FROM user_blocks WHERE blocker_id = ?
      UNION
      SELECT blocker_id AS other_id FROM user_blocks WHERE blocked_id = ?
    `).all(userId, userId);

    return new Set(rows.map((r) => r.other_id));
  },

  // ==========================================================================
  // 3. Safety & Abuse Reporting
  // ==========================================================================

  createReport(reporterId, data, customDb = null) {
    const db = customDb || getDb();
    const now = new Date().toISOString();

    // Prevent duplicate pending reports from the same reporter for the same target
    const existing = db.prepare(`
      SELECT id FROM user_reports
      WHERE reporter_id = ?
        AND status = 'pending'
        AND (
          (reported_user_id IS NOT NULL AND reported_user_id = ?)
          OR (content_id IS NOT NULL AND content_id = ?)
        )
      LIMIT 1
    `).get(reporterId, data.reportedUserId || null, data.contentId || null);

    if (existing) {
      const err = new Error('You already have a pending report for this target under review');
      err.statusCode = 409;
      err.code = 'DUPLICATE_REPORT';
      throw err;
    }

    const reportId = `report-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    db.prepare(`
      INSERT INTO user_reports (
        id, reporter_id, reported_user_id, room_id, content_type, content_id,
        category, description, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      reportId,
      reporterId,
      data.reportedUserId || null,
      data.roomId || null,
      data.contentType || 'user',
      data.contentId || null,
      data.category,
      data.description || '',
      now,
      now
    );

    return {
      reportId,
      status: 'pending',
      category: data.category,
      submittedAt: now,
      message: 'Your report has been received and queued for review. Reporter identity is strictly kept private.',
    };
  },

  getReports(filters = {}, customDb = null) {
    const db = customDb || getDb();
    const conditions = [];
    const params = [];

    if (filters.status && filters.status !== 'all') {
      conditions.push('r.status = ?');
      params.push(filters.status.toLowerCase());
    }

    if (filters.category && filters.category !== 'all') {
      conditions.push('r.category = ?');
      params.push(filters.category.toLowerCase());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM user_reports r ${whereClause}`).get(...params);
    const total = countRow?.total || 0;

    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(filters.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const items = db.prepare(`
      SELECT 
        r.id,
        r.reporter_id,
        u_rep.display_name AS reporter_name,
        r.reported_user_id,
        u_tgt.display_name AS reported_user_name,
        r.room_id,
        rm.room_name,
        r.content_type,
        r.content_id,
        r.category,
        r.description,
        r.status,
        r.action_taken,
        r.moderator_notes,
        r.resolved_by,
        u_mod.display_name AS resolved_by_name,
        r.resolved_at,
        r.created_at,
        r.updated_at
      FROM user_reports r
      LEFT JOIN users u_rep ON r.reporter_id = u_rep.id
      LEFT JOIN users u_tgt ON r.reported_user_id = u_tgt.id
      LEFT JOIN rooms rm ON r.room_id = rm.id
      LEFT JOIN users u_mod ON r.resolved_by = u_mod.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  getReportById(reportId, customDb = null) {
    if (!reportId) return null;
    const db = customDb || getDb();

    return db.prepare(`
      SELECT 
        r.*,
        u_rep.display_name AS reporter_name,
        u_tgt.display_name AS reported_user_name,
        rm.room_name,
        u_mod.display_name AS resolved_by_name
      FROM user_reports r
      LEFT JOIN users u_rep ON r.reporter_id = u_rep.id
      LEFT JOIN users u_tgt ON r.reported_user_id = u_tgt.id
      LEFT JOIN rooms rm ON r.room_id = rm.id
      LEFT JOIN users u_mod ON r.resolved_by = u_mod.id
      WHERE r.id = ?
    `).get(reportId);
  },

  updateReportStatus(reportId, moderatorId, actionData = {}, customDb = null) {
    if (!reportId || !moderatorId) throw new Error('Report ID and Moderator ID required');
    const db = customDb || getDb();
    const now = new Date().toISOString();

    const existing = this.getReportById(reportId, db);
    if (!existing) {
      const err = new Error('Report not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    db.prepare(`
      UPDATE user_reports
      SET status = ?,
          action_taken = ?,
          moderator_notes = ?,
          resolved_by = ?,
          resolved_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      actionData.status || existing.status,
      actionData.actionTaken !== undefined ? actionData.actionTaken : existing.action_taken,
      actionData.moderatorNotes !== undefined ? actionData.moderatorNotes : existing.moderator_notes,
      moderatorId,
      now,
      now,
      reportId
    );

    return this.getReportById(reportId, db);
  },

  // ==========================================================================
  // 4. Study Invitations
  // ==========================================================================

  createStudyInvite(senderId, data, customDb = null) {
    const db = customDb || getDb();
    const receiverId = data.receiverId;

    if (senderId === receiverId) {
      const err = new Error('You cannot send a study invitation to yourself');
      err.statusCode = 400;
      err.code = 'INVALID_ACTION';
      throw err;
    }

    // 1. Check blocking
    if (this.isBlocked(senderId, receiverId, db)) {
      const err = new Error('Cannot send study invitation due to safety or blocking restrictions');
      err.statusCode = 403;
      err.code = 'BLOCKED_USER';
      throw err;
    }

    // 2. Check receiver privacy settings
    const privacy = this.getPrivacySettings(receiverId, db);
    if (!privacy.allowStudyInvites || privacy.profileVisibility === 'private') {
      const err = new Error('This learner has disabled study invitations in their privacy settings');
      err.statusCode = 403;
      err.code = 'INVITES_DISABLED';
      throw err;
    }

    if (privacy.profileVisibility === 'rooms_only') {
      const sharedRooms = db.prepare(`
        SELECT COUNT(DISTINCT rm1.room_id) AS shared_count
        FROM room_memberships rm1
        JOIN room_memberships rm2 ON rm1.room_id = rm2.room_id
        WHERE rm1.user_id = ? AND rm2.user_id = ?
      `).get(senderId, receiverId);

      if (!sharedRooms || sharedRooms.shared_count === 0) {
        const err = new Error('This learner only accepts study invitations from co-members in shared Topic Rooms');
        err.statusCode = 403;
        err.code = 'INVITES_RESTRICTED_TO_ROOM_MEMBERS';
        throw err;
      }
    }

    const inviteId = `invite-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO study_invites (id, sender_id, receiver_id, topic, message, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(inviteId, senderId, receiverId, data.topic || 'General Coursework', data.message || '', now, now);

    // Track recommendation interaction outcome
    try {
      db.prepare(`
        UPDATE recommendation_tracking
        SET lifecycle_status = 'followed_through',
            followed_through_at = ?,
            outcome_event = 'invite_sent',
            outcome_entity_id = ?
        WHERE user_id = ? AND target_id = ? AND lifecycle_status IN ('presented', 'accepted')
      `).run(now, inviteId, senderId, receiverId);
    } catch {
      // Safe non-critical update
    }

    // Send notification to invite recipient
    try {
      const sender = db.prepare('SELECT display_name FROM users WHERE id = ?').get(senderId);
      NotificationModel.createNotification({
        userId: receiverId,
        actorId: senderId,
        type: 'session_invite',
        title: `${sender?.display_name || 'A student'} sent you a study invitation`,
        body: `Topic: ${data.topic || 'General Coursework'}`,
        targetUrl: '/sessions',
        referenceId: inviteId,
      }, db);
    } catch {
      // Safe non-critical
    }

    return {
      inviteId,
      senderId,
      receiverId,
      topic: data.topic || 'General Coursework',
      status: 'pending',
      createdAt: now,
    };
  },

  getInvitesForUser(userId, customDb = null) {
    if (!userId) return { incoming: [], outgoing: [] };
    const db = customDb || getDb();

    const incoming = db.prepare(`
      SELECT 
        si.id,
        si.sender_id,
        u.display_name AS sender_name,
        u.avatar_url AS sender_avatar,
        si.topic,
        si.message,
        si.status,
        si.created_at
      FROM study_invites si
      JOIN users u ON si.sender_id = u.id
      WHERE si.receiver_id = ?
      ORDER BY si.created_at DESC
      LIMIT 20
    `).all(userId);

    const outgoing = db.prepare(`
      SELECT 
        si.id,
        si.receiver_id,
        u.display_name AS receiver_name,
        u.avatar_url AS receiver_avatar,
        si.topic,
        si.message,
        si.status,
        si.created_at
      FROM study_invites si
      JOIN users u ON si.receiver_id = u.id
      WHERE si.sender_id = ?
      ORDER BY si.created_at DESC
      LIMIT 20
    `).all(userId);

    return { incoming, outgoing };
  },

  updateInviteStatus(inviteId, userId, status, customDb = null) {
    const db = customDb || getDb();
    const now = new Date().toISOString();

    const invite = db.prepare('SELECT * FROM study_invites WHERE id = ?').get(inviteId);
    if (!invite) {
      const err = new Error('Study invitation not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Only receiver can accept or decline; sender can cancel
    if (status === 'cancelled') {
      if (invite.sender_id !== userId) {
        const err = new Error('Only the invitation sender can cancel this request');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
    } else {
      if (invite.receiver_id !== userId) {
        const err = new Error('Only the invitation receiver can accept or decline');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
    }

    db.prepare(`
      UPDATE study_invites
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(status, now, inviteId);

    // If accepted, notify the invitation sender
    if (status === 'accepted') {
      try {
        const receiver = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
        NotificationModel.createNotification({
          userId: invite.sender_id,
          actorId: userId,
          type: 'session_invite',
          title: `${receiver?.display_name || 'A student'} accepted your study invitation`,
          body: `Accepted invite for: ${invite.topic || 'Study Session'}`,
          targetUrl: '/sessions',
          referenceId: inviteId,
        }, db);
      } catch {
        // Safe non-critical
      }
    }

    return {
      inviteId,
      status,
      updatedAt: now,
    };
  },

  // ==========================================================================
  // 5. Account Deactivation & Data Minimization
  // ==========================================================================

  deactivateAccount(userId, password, customDb = null) {
    const db = customDb || getDb();
    const now = new Date().toISOString();

    const userWithPw = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(userId);
    if (!userWithPw || !userWithPw.password_hash) {
      const err = new Error('User not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const matches = verifyPassword(password, userWithPw.password_hash);
    if (!matches) {
      const err = new Error('Password verification failed. Incorrect password provided.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    return withTransaction((txDb) => {
      // 1. Soft-deactivate user account & anonymize display name to preserve database integrity
      txDb.prepare(`
        UPDATE users
        SET is_active = 0,
            is_verified = 0,
            display_name = 'Deactivated Student',
            avatar_url = NULL,
            deleted_at = ?,
            updated_at = ?
        WHERE id = ?
      `).run(now, now, userId);

      // 2. Set privacy to private so account is completely hidden from discovery
      this.upsertPrivacySettings(userId, {
        profileVisibility: 'private',
        showActivityStatus: false,
        showLearningPreferences: false,
        showInstitution: false,
        allowStudyInvites: false,
      }, txDb);

      // 3. Revoke all active login sessions
      UserSessionModel.deleteAllForUser(userId, txDb);

      return {
        deactivated: true,
        is_active: 0,
        userId,
        timestamp: now,
        message: 'Account successfully deactivated. Profile hidden from discovery and active sessions revoked.',
      };
    }, customDb);
  },

  clearPreferences(userId, customDb = null) {
    if (!userId) return false;
    const db = customDb || getDb();

    db.prepare('DELETE FROM user_learning_preferences WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM user_subjects WHERE user_id = ?').run(userId);
    return true;
  },
};

export default SafetyModel;
