import UserSessionModel from '../models/userSession.model.js';
import { formatError } from '../schemas/index.js';
import config from '../config/env.js';

/**
 * StudySync AI — Authentication & Authorization Middleware
 * 
 * Extracts and validates session tokens, enforces identity protection,
 * and guards private API endpoints.
 */

/**
 * Extracts candidate tokens from request in priority order:
 * 1. Authorization: Bearer <token>
 * 2. Cookie: studysync_session=<token>
 * 3. Fallback header: x-session-token
 */
function extractCandidates(req) {
  const candidates = [];

  // 1. Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const t = authHeader.substring(7).trim();
    if (t) candidates.push({ token: t, source: 'bearer' });
  }

  // 2. Cookie: studysync_session=<token>
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/studysync_session=([^;]+)/);
    if (match && match[1]) {
      const t = match[1].trim();
      if (t) candidates.push({ token: t, source: 'cookie' });
    }
  }

  // 3. Fallback header
  if (req.headers['x-session-token']) {
    const t = String(req.headers['x-session-token']).trim();
    if (t) candidates.push({ token: t, source: 'x-session-token' });
  }

  return candidates;
}

/**
 * Resolves session by validating candidates in priority order.
 * If a stale or expired Bearer token is provided, gracefully falls back
 * to a valid cookie session ONLY if both belonged to the same user.
 * This guarantees an invalid credential cannot silently authenticate
 * as a different user than intended when multiple credentials are supplied.
 */
function resolveSession(req) {
  const candidates = extractCandidates(req);
  if (candidates.length === 0) {
    return { session: null, hadToken: false, source: null };
  }

  const bearerCandidate = candidates.find((c) => c.source === 'bearer');
  const cookieCandidate = candidates.find((c) => c.source === 'cookie');

  // 1. Explicit Bearer token supplied
  if (bearerCandidate) {
    const bearerSession = UserSessionModel.findByToken(bearerCandidate.token);
    if (bearerSession && bearerSession.user) {
      return { session: bearerSession, hadToken: true, source: 'bearer' };
    }

    // Bearer token was provided but is invalid or expired.
    // Check if we can safely fall back to the cookie:
    if (cookieCandidate) {
      const cookieSession = UserSessionModel.findByToken(cookieCandidate.token);
      if (cookieSession && cookieSession.user) {
        // Fallback is ONLY permitted if the expired Bearer token did not belong to a DIFFERENT user.
        // This prevents an invalid credential from silently authenticating as a different user.
        const priorOwner = UserSessionModel.findOwnerByToken(bearerCandidate.token);
        if (priorOwner && priorOwner !== cookieSession.user.id) {
          return { session: null, hadToken: true, source: 'bearer' };
        }
        return { session: cookieSession, hadToken: true, source: 'cookie' };
      }
    }

    return { session: null, hadToken: true, source: 'bearer' };
  }

  // 2. No Bearer token: validate Cookie candidate directly
  if (cookieCandidate) {
    const cookieSession = UserSessionModel.findByToken(cookieCandidate.token);
    if (cookieSession && cookieSession.user) {
      return { session: cookieSession, hadToken: true, source: 'cookie' };
    }
    return { session: null, hadToken: true, source: 'cookie' };
  }

  // 3. Fallback header
  for (const candidate of candidates) {
    const session = UserSessionModel.findByToken(candidate.token);
    if (session && session.user) {
      return { session, hadToken: true, source: candidate.source };
    }
  }

  return { session: null, hadToken: true, source: candidates[0].source };
}

/**
 * Helper to extract current token string
 */
export function extractToken(req) {
  const { session } = resolveSession(req);
  if (session) return session.token;
  const candidates = extractCandidates(req);
  return candidates.length > 0 ? candidates[0].token : null;
}

/**
 * Validates session if token present; attaches req.user without rejecting if absent
 */
export function optionalAuth(req, res, next) {
  const { session, source } = resolveSession(req);
  if (session) {
    req.user = session.user;
    req.sessionToken = session.token;
    req.authSource = source;
  } else {
    req.user = null;
    req.sessionToken = null;
    req.authSource = null;
  }

  next();
}

/**
 * Rejects unauthenticated requests with HTTP 401.
 * Enforces multi-layered CSRF defense for state-changing operations authenticated solely via cookies.
 */
export function requireAuth(req, res, next) {
  const { session, hadToken, source } = resolveSession(req);

  if (!hadToken) {
    return res.status(401).json(
      formatError('Authentication required. Please sign in.', 'UNAUTHENTICATED')
    );
  }

  if (!session || !session.user) {
    return res.status(401).json(
      formatError('Session has expired or is invalid. Please sign in again.', 'SESSION_EXPIRED')
    );
  }

  // Verification Defense: unverified users cannot access protected resources
  if (!session.user.isVerified) {
    return res.status(403).json(
      formatError('Account is not verified. Please complete email OTP verification to access protected features.', 'EMAIL_NOT_VERIFIED')
    );
  }

  // CSRF Defense for Cookie-Only Authenticated State-Changing Requests
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
  if (source === 'cookie' && isStateChanging) {
    const isLogout = req.path === '/logout' || req.originalUrl?.endsWith('/auth/logout');

    if (!isLogout) {
      // 1. Origin verification if Origin header is present
      const origin = req.headers.origin;
      if (origin) {
        const allowed = [
          config.corsOrigin,
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3001',
        ].filter(Boolean);

        if (!allowed.includes(origin)) {
          return res.status(403).json(
            formatError('Cross-origin state-changing request blocked by CSRF policy', 'CSRF_PROTECTION')
          );
        }
      }

      // 2. Content-Type and custom header verification:
      // Simple cross-site HTML forms (application/x-www-form-urlencoded, text/plain, multipart/form-data)
      // cannot set application/json or custom headers without triggering mandatory CORS preflight.
      const isJson = req.is('json');
      const hasCustomHeader = Boolean(req.headers['x-requested-with'] || req.headers['x-studysync-client']);

      if (!isJson && !hasCustomHeader) {
        return res.status(403).json(
          formatError('State-changing requests authenticated via cookie require application/json or custom client headers', 'CSRF_PROTECTION')
        );
      }
    }
  }

  req.user = session.user;
  req.sessionToken = session.token;
  req.authSource = source;
  next();
}

/**
 * Enforces moderator or administrator role; rejects ordinary learners with HTTP 403
 */
export function requireModerator(req, res, next) {
  requireAuth(req, res, () => {
    const role = req.user?.role || 'student';
    if (!['moderator', 'admin'].includes(role)) {
      return res.status(403).json(
        formatError('Access restricted. Moderator or administrator permissions required.', 'FORBIDDEN')
      );
    }
    next();
  });
}

/**
 * In-memory sliding window rate limiter for brute-force protection
 */
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

export function authRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown-client';
  const now = Date.now();
  const clientRecord = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };

  if (now > clientRecord.resetTime) {
    clientRecord.count = 1;
    clientRecord.resetTime = now + RATE_LIMIT_WINDOW_MS;
  } else {
    clientRecord.count += 1;
  }

  rateLimitMap.set(ip, clientRecord);

  if (clientRecord.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json(
      formatError('Too many authentication attempts. Please try again in one minute.', 'TOO_MANY_REQUESTS')
    );
  }

  next();
}

/**
 * Rate limiter for content creation and safety reports (prevents spam abuse)
 */
const safetyLimitMap = new Map();
const SAFETY_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_SAFETY_ACTIONS_PER_WINDOW = 15;

export function safetyRateLimiter(req, res, next) {
  const identifier = req.user?.id || req.ip || 'anonymous';
  const now = Date.now();
  const record = safetyLimitMap.get(identifier) || { count: 0, resetTime: now + SAFETY_LIMIT_WINDOW_MS };

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + SAFETY_LIMIT_WINDOW_MS;
  } else {
    record.count += 1;
  }

  safetyLimitMap.set(identifier, record);

  if (record.count > MAX_SAFETY_ACTIONS_PER_WINDOW) {
    return res.status(429).json(
      formatError('Rate limit exceeded for safety operations. Please wait a moment before trying again.', 'TOO_MANY_REQUESTS')
    );
  }

  next();
}

/**
 * Rate limiter for chat and direct messaging endpoints (prevents spam floods)
 */
const messageLimitMap = new Map();
const MESSAGE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_MESSAGES_PER_WINDOW = 60; // Max 60 messages per minute

export function messageRateLimiter(req, res, next) {
  const identifier = req.user?.id || req.ip || 'anonymous';
  const now = Date.now();
  const record = messageLimitMap.get(identifier) || { count: 0, resetTime: now + MESSAGE_LIMIT_WINDOW_MS };

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + MESSAGE_LIMIT_WINDOW_MS;
  } else {
    record.count += 1;
  }

  messageLimitMap.set(identifier, record);

  if (record.count > MAX_MESSAGES_PER_WINDOW) {
    return res.status(429).json(
      formatError('Message rate limit exceeded. Please wait a moment before sending more messages.', 'TOO_MANY_REQUESTS')
    );
  }

  next();
}

/**
 * Rate limiter for room code join attempts (prevents brute-force scanning of codes)
 */
const invalidJoinLimitMap = new Map();
const INVALID_JOIN_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_INVALID_JOIN_ATTEMPTS = 5;

export function joinCodeRateLimiter(req, res, next) {
  const identifier = req.user?.id || req.ip || 'anonymous';
  const now = Date.now();
  const record = invalidJoinLimitMap.get(identifier);

  if (record && now <= record.resetTime && record.count >= MAX_INVALID_JOIN_ATTEMPTS) {
    return res.status(429).json(
      formatError('Too many invalid room code attempts. Please wait a moment before trying again.', 'TOO_MANY_REQUESTS')
    );
  }

  req.recordInvalidJoinAttempt = () => {
    const curTime = Date.now();
    const cur = invalidJoinLimitMap.get(identifier) || { count: 0, resetTime: curTime + INVALID_JOIN_WINDOW_MS };
    if (curTime > cur.resetTime) {
      cur.count = 1;
      cur.resetTime = curTime + INVALID_JOIN_WINDOW_MS;
    } else {
      cur.count += 1;
    }
    invalidJoinLimitMap.set(identifier, cur);
  };

  next();
}

/**
 * Testing helper to reset in-memory rate limit maps
 */
export function _resetRateLimits() {
  rateLimitMap.clear();
  safetyLimitMap.clear();
  messageLimitMap.clear();
  invalidJoinLimitMap.clear();
}

export default {
  optionalAuth,
  requireAuth,
  requireModerator,
  authRateLimiter,
  safetyRateLimiter,
  messageRateLimiter,
  joinCodeRateLimiter,
  _resetRateLimits,
};

