import { Router } from 'express';
import { FeedbackModel } from '../models/feedback.model.js';
import { EvaluationMetricsService } from '../services/recommendation/evaluationMetrics.js';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware.js';
import {
  validatePeerFeedbackInput,
  validateRecommendationExplicitFeedbackInput,
  formatSuccess,
  formatError,
} from '../schemas/index.js';

const router = Router();

/**
 * GET /api/feedback/metrics
 * Transparent evaluation metrics derived from real database records
 * Supports platform-wide evaluation or authenticated user-isolated scoping (?scope=user)
 */
router.get('/metrics', optionalAuth, (req, res, next) => {
  try {
    const isUserScope = req.query.scope === 'user' || (req.query.userId && req.user && req.user.id === req.query.userId);
    const targetUserId = isUserScope && req.user ? req.user.id : null;
    const metrics = EvaluationMetricsService.getEvaluationMetrics(targetUserId);
    res.status(200).json(formatSuccess(metrics));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/feedback/my-feedback
 * Retrieves feedback and evaluations submitted by the current learner
 */
router.get('/my-feedback', requireAuth, (req, res, next) => {
  try {
    const data = FeedbackModel.getMySubmittedFeedback(req.user.id);
    res.status(200).json(formatSuccess(data));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/feedback/coach
 * Submits optional feedback on whether a Focus Coach suggestion was useful
 */
router.post('/coach', requireAuth, (req, res, next) => {
  try {
    const body = {
      ...req.body,
      recommendationType: req.body.recommendationType || 'focus_coach',
      targetId: req.body.targetId || req.body.suggestionId || 'coach_pacing',
    };
    const validated = validateRecommendationExplicitFeedbackInput(body);
    const feedback = FeedbackModel.submitRecommendationFeedback(req.user.id, validated);
    res.status(200).json(formatSuccess(feedback));
  } catch (error) {
    if (error.code === 'FORBIDDEN' || error.statusCode === 403) {
      return res.status(403).json(formatError(error.message, 'FORBIDDEN'));
    }
    next(error);
  }
});

/**
 * POST /api/feedback/recommendation
 * Submits explicit relevance and quality feedback for a recommendation
 */
router.post('/recommendation', requireAuth, (req, res, next) => {
  try {
    const validated = validateRecommendationExplicitFeedbackInput(req.body);
    const feedback = FeedbackModel.submitRecommendationFeedback(req.user.id, validated);
    res.status(200).json(formatSuccess(feedback));
  } catch (error) {
    if (error.code === 'FORBIDDEN' || error.statusCode === 403) {
      return res.status(403).json(formatError(error.message, 'FORBIDDEN'));
    }
    if (error.code === 'NOT_FOUND' || error.statusCode === 404) {
      return res.status(404).json(formatError(error.message, 'NOT_FOUND'));
    }
    next(error);
  }
});

/**
 * POST /api/feedback/peer
 * Submits lightweight peer helpfulness and repeat-study feedback
 */
router.post('/peer', requireAuth, (req, res, next) => {
  try {
    const validated = validatePeerFeedbackInput(req.body);
    const result = FeedbackModel.submitPeerFeedback(req.user.id, validated);
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    if (error.code === 'INVALID_PEER') {
      return res.status(400).json(formatError(error.message, 'INVALID_PEER'));
    }
    if (error.code === 'PEER_NOT_IN_SESSION') {
      return res.status(400).json(formatError(error.message, 'PEER_NOT_IN_SESSION'));
    }
    if (error.code === 'FORBIDDEN') {
      return res.status(403).json(formatError(error.message, 'FORBIDDEN'));
    }
    next(error);
  }
});

/**
 * GET /api/feedback/peer/:peerId
 * Retrieves pairwise feedback submitted by current user for a peer
 */
router.get('/peer/:peerId', requireAuth, (req, res, next) => {
  try {
    const feedback = FeedbackModel.getPairwiseFeedback(req.user.id, req.params.peerId);
    res.status(200).json(formatSuccess(feedback));
  } catch (error) {
    next(error);
  }
});

export default router;
