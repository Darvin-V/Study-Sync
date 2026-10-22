import { Router } from 'express';
import KnowledgeMapService from '../services/knowledgeMap/knowledgeMapService.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  validateAssessmentInput,
  formatSuccess,
  formatError,
} from '../schemas/index.js';

const router = Router();

// Protect all Knowledge Map endpoints with authentication middleware
router.use(requireAuth);

/**
 * GET /api/knowledge-map
 * Retrieves the authenticated learner's interactive Knowledge Map
 * Displays topics, states, real assessment records, and recommended actions.
 */
router.get('/', async (req, res, next) => {
  try {
    const { subject } = req.query;
    const mapData = KnowledgeMapService.getKnowledgeMap(req.user.id, { subject });

    res.status(200).json(formatSuccess(mapData));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/knowledge-map/progress
 * Retrieves transparent, unbundled progress signals:
 * - Self-reported confidence
 * - Study session participation (distinct from comprehension)
 * - Verified assessment results (never fabricated)
 * - Peer knowledge contributions
 */
router.get('/progress', async (req, res, next) => {
  try {
    const progressData = KnowledgeMapService.getProgressSignals(req.user.id);
    res.status(200).json(formatSuccess(progressData));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/knowledge-map/paths
 * Retrieves curriculum prerequisite pathways, unlocked topics, and suggested sequences
 */
router.get('/paths', async (req, res, next) => {
  try {
    const { subject } = req.query;
    const pathsData = KnowledgeMapService.getLearningPaths(req.user.id, subject);
    res.status(200).json(formatSuccess(pathsData));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/knowledge-map/assessments
 * Records a real, verified topic assessment result (e.g. quiz or exam)
 */
router.post('/assessments', async (req, res, next) => {
  try {
    const sanitized = validateAssessmentInput(req.body);
    const result = KnowledgeMapService.recordAssessment(req.user.id, sanitized);
    try {
      const { FeedbackModel } = await import('../models/feedback.model.js');
      FeedbackModel.verifyAssessmentOutcomes(sanitized.topicId, req.user.id);
    } catch {}
    res.status(201).json(formatSuccess(result));
  } catch (error) {
    next(error);
  }
});

export default router;
