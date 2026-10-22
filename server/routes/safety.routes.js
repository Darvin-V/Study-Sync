import { Router } from 'express';
import SafetyModel from '../models/safety.model.js';
import { requireAuth, requireModerator, safetyRateLimiter } from '../middleware/authMiddleware.js';
import {
  validatePrivacySettingsUpdate,
  validateReportInput,
  validateModerationAction,
  validateStudyInviteInput,
  validateAccountDeactivateInput,
  formatSuccess,
  formatError,
} from '../schemas/index.js';

const router = Router();

// ============================================================================
// 1. Privacy Settings Endpoints
// ============================================================================

/**
 * GET /api/privacy/settings & /api/safety/privacy
 * Retrieve current user's privacy settings
 */
router.get(['/privacy/settings', '/safety/privacy', '/privacy'], requireAuth, (req, res, next) => {
  try {
    const settings = SafetyModel.getPrivacySettings(req.user.id);
    res.status(200).json(formatSuccess(settings));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/privacy/settings & /api/safety/privacy
 * Update current user's privacy settings
 */
router.put(['/privacy/settings', '/safety/privacy', '/privacy'], requireAuth, (req, res, next) => {
  try {
    const sanitized = validatePrivacySettingsUpdate(req.body);
    const updated = SafetyModel.upsertPrivacySettings(req.user.id, sanitized);
    res.status(200).json(formatSuccess(updated));
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 2. User Blocking Endpoints
// ============================================================================

/**
 * GET /api/safety/blocks & /api/safety/blocked
 * List users currently blocked by the authenticated learner
 */
router.get(['/safety/blocks', '/safety/blocked', '/safety/block'], requireAuth, (req, res, next) => {
  try {
    const blockedList = SafetyModel.getBlockedUsers(req.user.id);
    res.status(200).json(formatSuccess(blockedList));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/safety/blocks & /api/safety/block
 * Block a peer from recommendations, invites, and direct interactions
 */
router.post(['/safety/blocks', '/safety/block'], requireAuth, (req, res, next) => {
  try {
    const targetUserId = req.body.targetUserId || req.body.userId;
    if (!targetUserId || typeof targetUserId !== 'string') {
      return res.status(400).json(formatError('Target user ID is required to block', 'INVALID_PARAM'));
    }

    const result = SafetyModel.blockUser(req.user.id, targetUserId.trim());
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/safety/blocks/:targetUserId & /api/safety/block/:targetUserId
 * Unblock a previously blocked peer
 */
router.delete(['/safety/blocks/:targetUserId', '/safety/block/:targetUserId'], requireAuth, (req, res, next) => {
  try {
    const { targetUserId } = req.params;
    if (!targetUserId) {
      return res.status(400).json(formatError('Target user ID is required to unblock', 'INVALID_PARAM'));
    }

    const unblocked = SafetyModel.unblockUser(req.user.id, targetUserId.trim());
    res.status(200).json(formatSuccess({ unblocked, targetUserId }));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/safety/unblock
 * Alias for unblocking via POST body
 */
router.post('/safety/unblock', requireAuth, (req, res, next) => {
  try {
    const targetUserId = req.body.targetUserId || req.body.userId;
    if (!targetUserId) {
      return res.status(400).json(formatError('Target user ID is required to unblock', 'INVALID_PARAM'));
    }

    const unblocked = SafetyModel.unblockUser(req.user.id, String(targetUserId).trim());
    res.status(200).json(formatSuccess({ unblocked, targetUserId }));
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 3. Safety & Abuse Reporting Endpoints
// ============================================================================

/**
 * POST /api/safety/reports & /api/safety/report
 * Submit a safety or abuse report (reporter identity kept confidential)
 */
router.post(['/safety/reports', '/safety/report'], requireAuth, safetyRateLimiter, (req, res, next) => {
  try {
    const sanitized = validateReportInput(req.body, req.user.id);
    const report = SafetyModel.createReport(req.user.id, sanitized);
    res.status(201).json(formatSuccess(report));
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 4. Moderation Workflow Endpoints (Moderator/Admin Role Only)
// ============================================================================

/**
 * GET /api/safety/moderation/reports & /api/safety/reports
 * List reports queue (moderator-only)
 */
router.get(['/safety/moderation/reports', '/safety/reports'], requireModerator, (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      category: req.query.category,
      page: req.query.page,
      limit: req.query.limit,
    };
    const result = SafetyModel.getReports(filters);
    res.status(200).json(formatSuccess(result.items, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/safety/moderation/reports/:id & /api/safety/reports/:id
 * Retrieve specific report details (moderator-only)
 */
router.get(['/safety/moderation/reports/:id', '/safety/reports/:id'], requireModerator, (req, res, next) => {
  try {
    const { id } = req.params;
    const report = SafetyModel.getReportById(id);
    if (!report) {
      return res.status(404).json(formatError('Report not found', 'NOT_FOUND'));
    }
    res.status(200).json(formatSuccess(report));
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/safety/moderation/reports/:id & /api/safety/reports/:id
 * Update report review status and record moderation action (moderator-only)
 */
router.patch(['/safety/moderation/reports/:id', '/safety/reports/:id'], requireModerator, (req, res, next) => {
  try {
    const { id } = req.params;
    const actionData = validateModerationAction(req.body);
    const updated = SafetyModel.updateReportStatus(id, req.user.id, actionData);
    res.status(200).json(formatSuccess(updated));
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 5. Study Invitations with Privacy & Safety Enforcement
// ============================================================================

/**
 * POST /api/safety/invites
 * Send a study invitation (enforces blocking and recipient privacy preferences)
 */
router.post('/safety/invites', requireAuth, safetyRateLimiter, (req, res, next) => {
  try {
    const sanitized = validateStudyInviteInput(req.body, req.user.id);
    const invite = SafetyModel.createStudyInvite(req.user.id, sanitized);
    res.status(201).json(formatSuccess(invite));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/safety/invites
 * List incoming and outgoing study invitations for authenticated learner
 */
router.get('/safety/invites', requireAuth, (req, res, next) => {
  try {
    const invites = SafetyModel.getInvitesForUser(req.user.id);
    res.status(200).json(formatSuccess(invites));
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/safety/invites/:id
 * Accept, decline, or cancel a study invitation
 */
router.patch('/safety/invites/:id', requireAuth, (req, res, next) => {
  try {
    const { id } = req.params;
    const status = String(req.body.status || '').toLowerCase().trim();
    if (!['accepted', 'declined', 'cancelled'].includes(status)) {
      return res.status(400).json(formatError("Status must be one of: 'accepted', 'declined', 'cancelled'", 'INVALID_PARAM'));
    }

    const updated = SafetyModel.updateInviteStatus(id, req.user.id, status);
    res.status(200).json(formatSuccess(updated));
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 6. Account Controls & Data Minimization
// ============================================================================

/**
 * POST /api/account/deactivate
 * Safely deactivates learner account with password confirmation
 */
router.post('/account/deactivate', requireAuth, (req, res, next) => {
  try {
    const sanitized = validateAccountDeactivateInput(req.body);
    const result = SafetyModel.deactivateAccount(req.user.id, sanitized.password);
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    next(error);
  }
});

export default router;
