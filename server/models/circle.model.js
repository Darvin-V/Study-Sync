import { getDb } from '../db/connection.js';
import { FeedbackModel } from './feedback.model.js';

/**
 * StudySync AI — Circle Model
 * 
 * Manages collaborative learner relationships (Circle):
 * - Send, accept, decline, and cancel Circle requests
 * - View and search learners added to Circle (My Circle, Requests, Sent)
 * - Reciprocal membership upon accepted request (both learners in each other's Circle)
 * - Safe privacy-respecting serialization (no private emails exposed)
 * - Server-side permission enforcement and IDOR prevention
 */
export const CircleModel = {
  /**
   * Helper to format learner profile row
   */
  _formatLearner(u, extra = {}) {
    const subjects = Array.from(
      new Set([
        ...(u.user_subjects_list ? u.user_subjects_list.split(',') : []),
        ...(u.pref_subjects_list ? u.pref_subjects_list.split(',') : []),
      ])
    ).filter(Boolean);

    const name = u.display_name || 'Student';
    const parts = name.split(' ').filter(Boolean);
    const initials = parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : (name.slice(0, 2) || 'ST').toUpperCase();

    return {
      id: u.id,
      displayName: name,
      name,
      avatarUrl: u.avatar_url || null,
      initials,
      headline: u.headline || 'Student Learner',
      institution: u.show_institution ? (u.institution || null) : null,
      subjects,
      ...extra,
    };
  },

  /**
   * Retrieve all verified learners in the user's Circle with optional search filtering.
   */
  getCircleMembers(userId, query = '', limit = 50, customDb = null) {
    if (!userId) return [];
    const db = customDb || getDb();
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const term = (query || '').trim();

    let sql = `
      SELECT 
        u.id, 
        u.display_name, 
        u.avatar_url, 
        lp.headline, 
        lp.institution,
        COALESCE(ups.show_institution, 1) AS show_institution,
        GROUP_CONCAT(DISTINCT us.subject) AS user_subjects_list,
        GROUP_CONCAT(DISTINCT lt.subject) AS pref_subjects_list,
        uc.created_at AS added_to_circle_at
      FROM user_circle uc
      JOIN (SELECT * FROM users ORDER BY created_at DESC) u ON uc.member_id = u.id
      LEFT JOIN learner_profiles lp ON u.id = lp.user_id
      LEFT JOIN user_privacy_settings ups ON u.id = ups.user_id
      LEFT JOIN user_subjects us ON u.id = us.user_id
      LEFT JOIN user_learning_preferences ulp ON u.id = ulp.user_id
      LEFT JOIN learning_topics lt ON ulp.topic_id = lt.id
      WHERE uc.user_id = ?
        AND (u.is_verified = 1)
        AND (u.is_active IS NULL OR u.is_active = 1)
        AND u.id NOT IN (
          SELECT blocked_id FROM user_blocks WHERE blocker_id = ?
          UNION
          SELECT blocker_id FROM user_blocks WHERE blocked_id = ?
        )
    `;
    const params = [userId, userId, userId];

    if (term) {
      sql += ` AND (
        u.display_name LIKE ?
        OR lp.headline LIKE ?
        OR lp.institution LIKE ?
        OR us.subject LIKE ?
        OR lt.subject LIKE ?
        OR lt.topic_name LIKE ?
      )`;
      const wildcard = `%${term}%`;
      params.push(wildcard, wildcard, wildcard, wildcard, wildcard, wildcard);
    }

    sql += ' GROUP BY LOWER(TRIM(u.display_name)) ORDER BY uc.created_at DESC, u.display_name ASC LIMIT ?';
    params.push(safeLimit);

    const rows = db.prepare(sql).all(...params);

    return rows.map((u) => this._formatLearner(u, {
      addedToCircleAt: u.added_to_circle_at,
      inCircle: true,
      relationshipStatus: 'in_circle',
    }));
  },

  /**
   * Get list of member IDs in the user's Circle for quick state checking.
   */
  getCircleMemberIds(userId, customDb = null) {
    if (!userId) return [];
    const db = customDb || getDb();

    const rows = db.prepare(`
      SELECT uc.member_id
      FROM user_circle uc
      JOIN users u ON uc.member_id = u.id
      WHERE uc.user_id = ?
        AND u.is_verified = 1
        AND (u.is_active IS NULL OR u.is_active = 1)
        AND u.id NOT IN (
          SELECT blocked_id FROM user_blocks WHERE blocker_id = ?
          UNION
          SELECT blocker_id FROM user_blocks WHERE blocked_id = ?
        )
    `).all(userId, userId, userId);

    return rows.map((r) => r.member_id);
  },

  /**
   * Check if a specific learner is in the user's Circle.
   */
  isInCircle(userId, memberId, customDb = null) {
    if (!userId || !memberId) return false;
    const db = customDb || getDb();

    const row = db.prepare(`
      SELECT id FROM user_circle
      WHERE user_id = ? AND member_id = ?
      LIMIT 1
    `).get(userId, memberId);

    return Boolean(row);
  },

  /**
   * Send a Circle connection request from senderId to receiverId.
   */
  sendCircleRequest(senderId, receiverId, customDb = null) {
    if (!senderId || !receiverId) {
      const err = new Error('Both senderId and receiverId are required.');
      err.statusCode = 400;
      throw err;
    }
    if (senderId === receiverId) {
      const err = new Error('Cannot add yourself to your own Circle.');
      err.statusCode = 400;
      throw err;
    }

    const db = customDb || getDb();

    // Verify receiver exists and is verified
    const receiver = db.prepare(`
      SELECT id, display_name, is_verified, is_active
      FROM users
      WHERE id = ?
    `).get(receiverId);

    if (!receiver) {
      const err = new Error('Learner not found.');
      err.statusCode = 404;
      throw err;
    }

    if (!receiver.is_verified) {
      const err = new Error('Cannot add unverified learner to Circle.');
      err.statusCode = 400;
      throw err;
    }

    // Check block restrictions
    const blocked = db.prepare(`
      SELECT id FROM user_blocks
      WHERE (blocker_id = ? AND blocked_id = ?)
         OR (blocker_id = ? AND blocked_id = ?)
      LIMIT 1
    `).get(senderId, receiverId, receiverId, senderId);

    if (blocked) {
      const err = new Error('Cannot add blocked user to Circle.');
      err.statusCode = 403;
      throw err;
    }

    // Check if already in circle
    if (this.isInCircle(senderId, receiverId, db)) {
      const err = new Error('Learner is already in your Circle.');
      err.statusCode = 400;
      throw err;
    }

    // Check if receiver already sent a pending request to sender -> auto-accept!
    const reverseReq = db.prepare(`
      SELECT id, sender_id, receiver_id, status
      FROM circle_requests
      WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'
    `).get(receiverId, senderId);

    if (reverseReq) {
      return this.acceptCircleRequest(senderId, reverseReq.id, db);
    }

    // Check if sender already sent a pending request
    const existingReq = db.prepare(`
      SELECT id, status FROM circle_requests
      WHERE sender_id = ? AND receiver_id = ?
    `).get(senderId, receiverId);

    if (existingReq && existingReq.status === 'pending') {
      const err = new Error('Circle request already sent.');
      err.statusCode = 400;
      throw err;
    }

    const now = new Date().toISOString();
    const requestId = existingReq ? existingReq.id : `req-${senderId}-${receiverId}`;

    db.prepare(`
      INSERT INTO circle_requests (id, sender_id, receiver_id, status, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', ?, ?)
      ON CONFLICT(sender_id, receiver_id) DO UPDATE SET
        status = 'pending',
        updated_at = excluded.updated_at
    `).run(requestId, senderId, receiverId, now, now);

    // Track recommendation acceptance if peer was recommended
    try {
      FeedbackModel.updateRecommendationLifecycle(receiverId, senderId, {
        status: 'accepted',
        outcomeEvent: 'circle_request_sent',
        outcomeEntityId: receiverId,
        targetId: receiverId,
        recommendationType: 'peer_help',
      }, db);
    } catch {
      // Non-blocking
    }

    return {
      success: true,
      status: 'pending',
      requestId,
      memberId: receiverId,
      displayName: receiver.display_name,
      sentAt: now,
    };
  },

  /**
   * Retrieve incoming pending Circle requests for a user.
   */
  getIncomingRequests(userId, customDb = null) {
    if (!userId) return [];
    const db = customDb || getDb();

    const sql = `
      SELECT 
        cr.id AS request_id,
        cr.created_at AS request_created_at,
        u.id, 
        u.display_name, 
        u.avatar_url, 
        lp.headline, 
        lp.institution,
        COALESCE(ups.show_institution, 1) AS show_institution,
        GROUP_CONCAT(DISTINCT us.subject) AS user_subjects_list,
        GROUP_CONCAT(DISTINCT lt.subject) AS pref_subjects_list
      FROM circle_requests cr
      JOIN users u ON cr.sender_id = u.id
      LEFT JOIN learner_profiles lp ON u.id = lp.user_id
      LEFT JOIN user_privacy_settings ups ON u.id = ups.user_id
      LEFT JOIN user_subjects us ON u.id = us.user_id
      LEFT JOIN user_learning_preferences ulp ON u.id = ulp.user_id
      LEFT JOIN learning_topics lt ON ulp.topic_id = lt.id
      WHERE cr.receiver_id = ?
        AND cr.status = 'pending'
        AND u.is_verified = 1
        AND (u.is_active IS NULL OR u.is_active = 1)
        AND u.id NOT IN (
          SELECT blocked_id FROM user_blocks WHERE blocker_id = ?
          UNION
          SELECT blocker_id FROM user_blocks WHERE blocked_id = ?
        )
      GROUP BY cr.id
      ORDER BY cr.created_at DESC
    `;

    const rows = db.prepare(sql).all(userId, userId, userId);

    return rows.map((u) => this._formatLearner(u, {
      requestId: u.request_id,
      requestCreatedAt: u.request_created_at,
      senderId: u.id,
      relationshipStatus: 'accept',
    }));
  },

  /**
   * Retrieve outgoing pending Circle requests sent by a user.
   */
  getSentRequests(userId, customDb = null) {
    if (!userId) return [];
    const db = customDb || getDb();

    const sql = `
      SELECT 
        cr.id AS request_id,
        cr.created_at AS request_created_at,
        u.id, 
        u.display_name, 
        u.avatar_url, 
        lp.headline, 
        lp.institution,
        COALESCE(ups.show_institution, 1) AS show_institution,
        GROUP_CONCAT(DISTINCT us.subject) AS user_subjects_list,
        GROUP_CONCAT(DISTINCT lt.subject) AS pref_subjects_list
      FROM circle_requests cr
      JOIN users u ON cr.receiver_id = u.id
      LEFT JOIN learner_profiles lp ON u.id = lp.user_id
      LEFT JOIN user_privacy_settings ups ON u.id = ups.user_id
      LEFT JOIN user_subjects us ON u.id = us.user_id
      LEFT JOIN user_learning_preferences ulp ON u.id = ulp.user_id
      LEFT JOIN learning_topics lt ON ulp.topic_id = lt.id
      WHERE cr.sender_id = ?
        AND cr.status = 'pending'
        AND u.is_verified = 1
        AND (u.is_active IS NULL OR u.is_active = 1)
        AND u.id NOT IN (
          SELECT blocked_id FROM user_blocks WHERE blocker_id = ?
          UNION
          SELECT blocker_id FROM user_blocks WHERE blocked_id = ?
        )
      GROUP BY cr.id
      ORDER BY cr.created_at DESC
    `;

    const rows = db.prepare(sql).all(userId, userId, userId);

    return rows.map((u) => this._formatLearner(u, {
      requestId: u.request_id,
      requestCreatedAt: u.request_created_at,
      receiverId: u.id,
      relationshipStatus: 'pending',
    }));
  },

  /**
   * Accept an incoming Circle request.
   * Reciprocally connects both learners so they see each other in My Circle.
   */
  acceptCircleRequest(userId, identifier, customDb = null) {
    if (!userId || !identifier) {
      const err = new Error('Both userId and request identifier are required.');
      err.statusCode = 400;
      throw err;
    }

    const db = customDb || getDb();

    // Find request by request id OR by sender_id & receiver_id
    const reqRow = db.prepare(`
      SELECT id, sender_id, receiver_id, status
      FROM circle_requests
      WHERE (id = ? OR (sender_id = ? AND receiver_id = ?))
    `).get(identifier, identifier, userId);

    if (!reqRow) {
      const err = new Error('Circle request not found.');
      err.statusCode = 404;
      throw err;
    }

    // Permission enforcement: only receiver can accept
    if (reqRow.receiver_id !== userId) {
      const err = new Error('Forbidden: You can only accept requests sent to you.');
      err.statusCode = 403;
      throw err;
    }

    if (reqRow.status !== 'pending') {
      const err = new Error(`Request is already ${reqRow.status}.`);
      err.statusCode = 400;
      throw err;
    }

    const now = new Date().toISOString();
    const senderId = reqRow.sender_id;

    // 1. Mark request accepted
    db.prepare(`
      UPDATE circle_requests
      SET status = 'accepted', updated_at = ?
      WHERE id = ?
    `).run(now, reqRow.id);

    // 2. Also mark any reverse request as accepted if present
    db.prepare(`
      UPDATE circle_requests
      SET status = 'accepted', updated_at = ?
      WHERE sender_id = ? AND receiver_id = ?
    `).run(now, userId, senderId);

    // 3. Reciprocal insertion into user_circle
    db.prepare(`
      INSERT INTO user_circle (id, user_id, member_id, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, member_id) DO NOTHING
    `).run(`circle-${senderId}-${userId}`, senderId, userId, now);

    db.prepare(`
      INSERT INTO user_circle (id, user_id, member_id, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, member_id) DO NOTHING
    `).run(`circle-${userId}-${senderId}`, userId, senderId, now);

    // Verify recommendation follow-through for both learners
    try {
      FeedbackModel.verifyCircleOutcomes(senderId, userId, db);
      FeedbackModel.verifyCircleOutcomes(userId, senderId, db);
    } catch {
      // Non-blocking
    }

    return {
      success: true,
      inCircle: true,
      status: 'in_circle',
      memberId: senderId,
      acceptedAt: now,
    };
  },

  /**
   * Decline an incoming Circle request.
   */
  declineCircleRequest(userId, identifier, customDb = null) {
    if (!userId || !identifier) {
      const err = new Error('Both userId and request identifier are required.');
      err.statusCode = 400;
      throw err;
    }

    const db = customDb || getDb();

    const reqRow = db.prepare(`
      SELECT id, sender_id, receiver_id, status
      FROM circle_requests
      WHERE (id = ? OR (sender_id = ? AND receiver_id = ?))
    `).get(identifier, identifier, userId);

    if (!reqRow) {
      const err = new Error('Circle request not found.');
      err.statusCode = 404;
      throw err;
    }

    // Permission enforcement: only receiver can decline
    if (reqRow.receiver_id !== userId) {
      const err = new Error('Forbidden: You can only decline requests sent to you.');
      err.statusCode = 403;
      throw err;
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE circle_requests
      SET status = 'declined', updated_at = ?
      WHERE id = ?
    `).run(now, reqRow.id);

    return {
      success: true,
      declined: true,
      status: 'add',
      memberId: reqRow.sender_id,
    };
  },

  /**
   * Cancel an outgoing Circle request sent by user.
   */
  cancelCircleRequest(userId, identifier, customDb = null) {
    if (!userId || !identifier) {
      const err = new Error('Both userId and request identifier are required.');
      err.statusCode = 400;
      throw err;
    }

    const db = customDb || getDb();

    const reqRow = db.prepare(`
      SELECT id, sender_id, receiver_id, status
      FROM circle_requests
      WHERE (id = ? OR (sender_id = ? AND receiver_id = ?))
    `).get(identifier, userId, identifier);

    if (!reqRow) {
      const err = new Error('Circle request not found.');
      err.statusCode = 404;
      throw err;
    }

    // Permission enforcement: only sender can cancel
    if (reqRow.sender_id !== userId) {
      const err = new Error('Forbidden: You can only cancel requests sent by you.');
      err.statusCode = 403;
      throw err;
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE circle_requests
      SET status = 'cancelled', updated_at = ?
      WHERE id = ?
    `).run(now, reqRow.id);

    return {
      success: true,
      cancelled: true,
      status: 'add',
      memberId: reqRow.receiver_id,
    };
  },

  /**
   * Fast query for relationship status between two learners:
   * Returns 'in_circle' | 'pending' | 'accept' | 'add'
   */
  getRelationshipStatus(userId, targetUserId, customDb = null) {
    if (!userId || !targetUserId || userId === targetUserId) {
      return { status: 'self', inCircle: false, requestId: null };
    }

    const db = customDb || getDb();

    if (this.isInCircle(userId, targetUserId, db)) {
      return { status: 'in_circle', inCircle: true, requestId: null };
    }

    // Check pending requests
    const sentReq = db.prepare(`
      SELECT id FROM circle_requests
      WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'
    `).get(userId, targetUserId);

    if (sentReq) {
      return { status: 'pending', inCircle: false, requestId: sentReq.id };
    }

    const receivedReq = db.prepare(`
      SELECT id FROM circle_requests
      WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'
    `).get(targetUserId, userId);

    if (receivedReq) {
      return { status: 'accept', inCircle: false, requestId: receivedReq.id };
    }

    return { status: 'add', inCircle: false, requestId: null };
  },

  /**
   * Fast batch status query for the authenticated user.
   */
  getAllCircleStates(userId, customDb = null) {
    if (!userId) {
      return { circleIds: [], pendingSentIds: [], pendingReceivedMap: {} };
    }

    const db = customDb || getDb();

    const circleIds = this.getCircleMemberIds(userId, db);

    const sentRows = db.prepare(`
      SELECT receiver_id, id FROM circle_requests
      WHERE sender_id = ? AND status = 'pending'
    `).all(userId);

    const receivedRows = db.prepare(`
      SELECT sender_id, id FROM circle_requests
      WHERE receiver_id = ? AND status = 'pending'
    `).all(userId);

    const pendingReceivedMap = {};
    for (const r of receivedRows) {
      pendingReceivedMap[r.sender_id] = r.id;
    }

    return {
      circleIds,
      pendingSentIds: sentRows.map((r) => r.receiver_id),
      pendingReceivedMap,
    };
  },

  /**
   * Add a verified learner to user's Circle directly (with reciprocal connection).
   * Idempotent: If already in Circle, succeeds without duplicating.
   * Backward compatible with tests and direct connections.
   */
  addToCircle(userId, memberId, customDb = null) {
    if (!userId || !memberId) {
      throw new Error('Both userId and memberId are required.');
    }
    if (userId === memberId) {
      const err = new Error('Cannot add yourself to your own Circle.');
      err.statusCode = 400;
      throw err;
    }

    const db = customDb || getDb();

    // Verify member exists and is verified
    const member = db.prepare(`
      SELECT id, display_name, is_verified, is_active
      FROM users
      WHERE id = ?
    `).get(memberId);

    if (!member) {
      const err = new Error('Learner not found.');
      err.statusCode = 404;
      throw err;
    }

    if (!member.is_verified) {
      const err = new Error('Cannot add unverified learner to Circle.');
      err.statusCode = 400;
      throw err;
    }

    // Check block restrictions
    const blocked = db.prepare(`
      SELECT id FROM user_blocks
      WHERE (blocker_id = ? AND blocked_id = ?)
         OR (blocker_id = ? AND blocked_id = ?)
      LIMIT 1
    `).get(userId, memberId, memberId, userId);

    if (blocked) {
      const err = new Error('Cannot add blocked user to Circle.');
      err.statusCode = 403;
      throw err;
    }

    const now = new Date().toISOString();

    // Mutual insertion
    db.prepare(`
      INSERT INTO user_circle (id, user_id, member_id, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, member_id) DO NOTHING
    `).run(`circle-${userId}-${memberId}`, userId, memberId, now);

    db.prepare(`
      INSERT INTO user_circle (id, user_id, member_id, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, member_id) DO NOTHING
    `).run(`circle-${memberId}-${userId}`, memberId, userId, now);

    // Also mark any pending requests as accepted
    db.prepare(`
      UPDATE circle_requests
      SET status = 'accepted', updated_at = ?
      WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
        AND status = 'pending'
    `).run(now, userId, memberId, memberId, userId);

    return {
      success: true,
      inCircle: true,
      memberId,
      displayName: member.display_name,
      addedAt: now,
    };
  },

  /**
   * Remove a learner from user's Circle.
   * Removes mutual connection.
   * Existing conversations and messages remain completely intact and accessible.
   */
  removeFromCircle(userId, memberId, customDb = null) {
    if (!userId || !memberId) return false;
    const db = customDb || getDb();

    const info = db.prepare(`
      DELETE FROM user_circle
      WHERE (user_id = ? AND member_id = ?)
         OR (user_id = ? AND member_id = ?)
    `).run(userId, memberId, memberId, userId);

    // Clean up accepted requests
    db.prepare(`
      DELETE FROM circle_requests
      WHERE (sender_id = ? AND receiver_id = ?)
         OR (sender_id = ? AND receiver_id = ?)
    `).run(userId, memberId, memberId, userId);

    return {
      success: true,
      inCircle: false,
      memberId,
      removed: info.changes > 0,
    };
  },
};

export default CircleModel;
