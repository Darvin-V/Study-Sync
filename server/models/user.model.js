import { getDb } from '../db/connection.js';

/**
 * StudySync AI — User Model
 * 
 * Data access routines for users, profiles, and learning preferences.
 * Securely separates safe user serialization from sensitive authentication fields.
 */
export const UserModel = {
  create({ id, display_name, email, password_hash, username = null, preferred_languages = ['English'], is_verified = 1 }, customDb = null) {
    const db = customDb || getDb();
    const now = new Date().toISOString();
    const languagesJson = JSON.stringify(Array.isArray(preferred_languages) ? preferred_languages : ['English']);

    const cleanEmail = email ? email.trim().toLowerCase() : null;

    let finalUsername = username ? username.trim().toLowerCase() : null;
    if (!finalUsername) {
      finalUsername = this.generateUniqueUsername(display_name, db);
    }

    const stmt = db.prepare(`
      INSERT INTO users (id, display_name, username, email, password_hash, is_verified, preferred_languages, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(id, display_name, finalUsername, cleanEmail, password_hash, is_verified ? 1 : 0, languagesJson, now, now);
    } catch (err) {
      if (
        err &&
        (
          (err.message && (err.message.includes('users.email') || err.message.includes('idx_users_email_nocase'))) ||
          err.code === 'SQLITE_CONSTRAINT_UNIQUE'
        )
      ) {
        const error = new Error('An account with this email already exists. Please log in or reset your password.');
        error.code = 'EMAIL_EXISTS';
        error.statusCode = 409;
        throw error;
      }
      throw err;
    }

    return this.findById(id, customDb);
  },

  findById(id, customDb = null) {
    const db = customDb || getDb();
    const user = db.prepare(`
      SELECT id, display_name, username, email, avatar_url, preferred_languages, is_verified, email_verified_at, created_at, updated_at 
      FROM users 
      WHERE id = ?
    `).get(id);
    if (!user) return null;

    return sanitizeUser(user);
  },

  findByEmail(email, customDb = null) {
    if (!email) return null;
    const db = customDb || getDb();
    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare(`
      SELECT id, display_name, username, email, avatar_url, preferred_languages, is_verified, email_verified_at, created_at, updated_at 
      FROM users 
      WHERE LOWER(TRIM(email)) = ?
    `).get(cleanEmail);
    if (!user) return null;

    return sanitizeUser(user);
  },

  findByUsername(username, customDb = null) {
    if (!username) return null;
    const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
    const db = customDb || getDb();
    const user = db.prepare(`
      SELECT id, display_name, username, email, avatar_url, preferred_languages, is_verified, email_verified_at, created_at, updated_at 
      FROM users 
      WHERE LOWER(username) = LOWER(?)
    `).get(cleanUsername);
    if (!user) return null;

    return sanitizeUser(user);
  },

  isUsernameAvailable(username, excludeUserId = null, customDb = null) {
    if (!username) return false;
    const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
    const db = customDb || getDb();
    let query = 'SELECT id FROM users WHERE LOWER(username) = LOWER(?)';
    const params = [cleanUsername];
    if (excludeUserId) {
      query += ' AND id != ?';
      params.push(excludeUserId);
    }
    const existing = db.prepare(query).get(...params);
    return !existing;
  },

  generateUniqueUsername(displayName, customDb = null) {
    const db = customDb || getDb();
    let base = (displayName || 'learner')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (base.length < 3) base = `learner_${base}`;
    if (base.length > 24) base = base.slice(0, 24);

    let candidate = base;
    let suffix = 1;
    const checkStmt = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)');

    while (true) {
      const found = checkStmt.get(candidate);
      if (!found) return candidate;
      candidate = `${base.slice(0, 20)}_${suffix}`;
      suffix++;
    }
  },

  /**
   * Internal routine for password verification ONLY.
   * NEVER exposed to frontend responses.
   */
  findByEmailWithPassword(email, customDb = null) {
    if (!email) return null;
    const db = customDb || getDb();
    const cleanEmail = email.trim().toLowerCase();
    return db.prepare(`
      SELECT id, display_name, username, email, password_hash, avatar_url, preferred_languages, is_verified, email_verified_at, created_at, updated_at 
      FROM users 
      WHERE LOWER(TRIM(email)) = ?
    `).get(cleanEmail);
  },

  update(id, data, customDb = null) {
    const db = customDb || getDb();
    const updates = [];
    const params = [];

    if (data.display_name !== undefined) {
      updates.push('display_name = ?');
      params.push(data.display_name.trim());
    }
    if (data.username !== undefined) {
      const cleanUsername = data.username.trim().replace(/^@/, '').toLowerCase();
      updates.push('username = ?');
      params.push(cleanUsername);
    }
    if (data.avatar_url !== undefined) {
      updates.push('avatar_url = ?');
      params.push(data.avatar_url);
    }
    if (data.preferred_languages !== undefined) {
      updates.push('preferred_languages = ?');
      const val = Array.isArray(data.preferred_languages)
        ? JSON.stringify(data.preferred_languages)
        : typeof data.preferred_languages === 'string'
        ? JSON.stringify([data.preferred_languages])
        : JSON.stringify(['English']);
      params.push(val);
    }

    if (updates.length === 0) return this.findById(id, customDb);

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id, customDb);
  },

  markEmailVerified(id, customDb = null) {
    const db = customDb || getDb();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE users 
      SET is_verified = 1, email_verified_at = ?, updated_at = ? 
      WHERE id = ?
    `).run(now, now, id);
    return this.findById(id, customDb);
  },

  findPreferencesByUserId(userId, customDb = null) {
    const db = customDb || getDb();
    return db.prepare(`
      SELECT 
        p.*,
        t.subject,
        t.topic_name
      FROM user_learning_preferences p
      JOIN learning_topics t ON p.topic_id = t.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `).all(userId);
  },

  count(customDb = null, includeDemo = false) {
    const db = customDb || getDb();
    if (includeDemo) {
      const row = db.prepare('SELECT COUNT(*) AS count FROM users').get();
      return row.count;
    }
    const row = db.prepare("SELECT COUNT(*) AS count FROM users WHERE email NOT LIKE '%@demo.studysync.ai' AND id NOT IN ('darvin-01', 'student-arun')").get();
    return row.count;
  },
};

function sanitizeUser(user) {
  let languages = ['English'];
  if (user.preferred_languages !== undefined && user.preferred_languages !== null) {
    try {
      const parsed = typeof user.preferred_languages === 'string'
        ? JSON.parse(user.preferred_languages)
        : user.preferred_languages;
      if (Array.isArray(parsed)) {
        languages = parsed;
      } else if (typeof parsed === 'string' && parsed.trim().length > 0) {
        languages = [parsed.trim()];
      }
    } catch {
      if (typeof user.preferred_languages === 'string' && user.preferred_languages.trim().length > 0) {
        languages = [user.preferred_languages.trim()];
      }
    }
  }

  return {
    id: user.id,
    displayName: user.display_name,
    username: user.username || null,
    email: user.email,
    avatarUrl: user.avatar_url,
    preferredLanguages: languages,
    isVerified: Boolean(user.is_verified),
    emailVerifiedAt: user.email_verified_at || null,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

export default UserModel;
