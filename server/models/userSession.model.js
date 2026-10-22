import { getDb } from '../db/connection.js';
import { generateSessionToken } from '../utils/crypto.js';

/**
 * StudySync AI — User Authentication Session Model
 * 
 * Manages server-side validated user sessions in SQLite.
 * Tokens are cryptographically generated and support expiration and revocation.
 */
export const UserSessionModel = {
  create(userId, userAgent = null, expiresInDays = 7, customDb = null) {
    const db = customDb || getDb();
    const token = generateSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
    const createdAt = now.toISOString();

    const stmt = db.prepare(`
      INSERT INTO user_sessions (id, user_id, expires_at, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(token, userId, expiresAt, userAgent, createdAt);

    return {
      token,
      userId,
      expiresAt,
      createdAt,
    };
  },

  findByToken(token, customDb = null) {
    if (!token || typeof token !== 'string') return null;
    const db = customDb || getDb();
    const nowIso = new Date().toISOString();

    const row = db.prepare(`
      SELECT 
        s.id AS session_token,
        s.user_id,
        s.expires_at,
        s.created_at AS session_created_at,
        u.display_name,
        u.email,
        u.avatar_url,
        u.preferred_languages,
        u.is_verified,
        u.email_verified_at,
        COALESCE(u.role, 'student') AS role,
        COALESCE(u.is_active, 1) AS is_active,
        u.created_at AS user_created_at
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.expires_at > ?
    `).get(token, nowIso);

    if (!row) return null;
    if (row.is_active === 0) return null; // Deactivated account protection

    let languages = ['English'];
    if (row.preferred_languages !== undefined && row.preferred_languages !== null) {
      try {
        const parsed = typeof row.preferred_languages === 'string'
          ? JSON.parse(row.preferred_languages)
          : row.preferred_languages;
        if (Array.isArray(parsed)) {
          languages = parsed;
        } else if (typeof parsed === 'string' && parsed.trim().length > 0) {
          languages = [parsed.trim()];
        }
      } catch {
        if (typeof row.preferred_languages === 'string' && row.preferred_languages.trim().length > 0) {
          languages = [row.preferred_languages.trim()];
        }
      }
    }

    return {
      token: row.session_token,
      expiresAt: row.expires_at,
      user: {
        id: row.user_id,
        displayName: row.display_name,
        email: row.email,
        avatarUrl: row.avatar_url,
        preferredLanguages: languages,
        isVerified: Boolean(row.is_verified),
        emailVerifiedAt: row.email_verified_at || null,
        role: row.role || 'student',
        isActive: row.is_active === 1,
        createdAt: row.user_created_at,
      },
    };
  },

  findOwnerByToken(token, customDb = null) {
    if (!token || typeof token !== 'string') return null;
    const db = customDb || getDb();
    const row = db.prepare('SELECT user_id FROM user_sessions WHERE id = ?').get(token);
    return row ? row.user_id : null;
  },

  delete(token, customDb = null) {
    if (!token) return false;
    const db = customDb || getDb();
    const stmt = db.prepare('DELETE FROM user_sessions WHERE id = ?');
    stmt.run(token);
    return true;
  },

  deleteForUser(token, userId, customDb = null) {
    if (!token || !userId) return false;
    const db = customDb || getDb();
    const stmt = db.prepare('DELETE FROM user_sessions WHERE id = ? AND user_id = ?');
    const result = stmt.run(token, userId);
    return result.changes > 0;
  },

  deleteAllForUser(userId, customDb = null) {
    if (!userId) return false;
    const db = customDb || getDb();
    const stmt = db.prepare('DELETE FROM user_sessions WHERE user_id = ?');
    stmt.run(userId);
    return true;
  },

  cleanExpired(customDb = null) {
    const db = customDb || getDb();
    const nowIso = new Date().toISOString();
    const stmt = db.prepare('DELETE FROM user_sessions WHERE expires_at <= ?');
    stmt.run(nowIso);
  },
};

export default UserSessionModel;
