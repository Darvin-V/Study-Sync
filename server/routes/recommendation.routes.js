import { Router } from 'express';
import { LearningRecommendationService } from '../services/recommendation/learningRecommendations.js';
import { aiService } from '../services/ai/aiService.js';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware.js';
import {
  validateRecommendationFeedbackInput,
  formatSuccess,
  formatError,
} from '../schemas/index.js';

const router = Router();

/**
 * GET /api/recommendations/status
 * Reports recommendation service health and AI configuration status
 */
router.get('/status', (req, res) => {
  const aiStatus = aiService.getStatus();
  res.status(200).json(
    formatSuccess({
      status: 'operational',
      engine: 'Personalised Learning Recommendation Engine',
      ai_provider: aiStatus,
      free_tier_compatible: true,
    })
  );
});

/**
 * GET /api/recommendations/study
 * Returns personalised learning recommendations based on syllabus targets,
 * self-reported difficulties, past attendance, unresolved doubts, and available resources.
 */
router.get('/study', optionalAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id || 'darvin-01'; // Fallback to demo learner if unauthenticated in preview
    const recommendations = LearningRecommendationService.getRecommendationsForUser(userId);

    const aiStatus = aiService.getStatus();

    // Optionally enhance top recommendation if genuine AI provider is active
    if (aiStatus.ai_available && recommendations.length > 0) {
      try {
        const top = recommendations[0];
        const enhancement = await aiService.enhanceStudyRecommendation(top, req.user);
        if (enhancement && enhancement.isEnhanced) {
          top.ai_enhanced = true;
          top.ai_tip = enhancement.tip;
          top.engine = enhancement.provider;
        }
      } catch {
        // Fallback safely to rule engine without interruption
      }
    }

    res.status(200).json(
      formatSuccess(recommendations, {
        total: recommendations.length,
        userId,
        ai_status: aiStatus,
      })
    );
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/recommendations/feedback
 * Records whether a user accepted, dismissed, or viewed a recommendation.
 */
router.post('/feedback', requireAuth, async (req, res, next) => {
  try {
    const input = validateRecommendationFeedbackInput(req.body);
    const result = LearningRecommendationService.recordInteraction(req.user.id, input);

    res.status(200).json(
      formatSuccess({
        success: true,
        interactionId: result.id,
        action: result.action,
        timestamp: result.timestamp,
      })
    );
  } catch (error) {
    next(error);
  }
});

export default router;
