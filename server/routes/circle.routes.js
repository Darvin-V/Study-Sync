import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import CircleModel from '../models/circle.model.js';
import { formatSuccess, formatError } from '../schemas/index.js';

const router = Router();

// All circle operations require authentication
router.use(requireAuth);

/**
 * GET /api/circle
 * View and search learners added to the authenticated user's Circle.
 */
router.get('/', async (req, res, next) => {
  try {
    const q = req.query.q || req.query.query || '';
    const limit = parseInt(req.query.limit, 10) || 50;
    const members = CircleModel.getCircleMembers(req.user.id, q, limit);
    res.status(200).json(formatSuccess(members));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/circle/ids
 * Fast retrieval of member IDs in the user's Circle.
 */
router.get('/ids', async (req, res, next) => {
  try {
    const ids = CircleModel.getCircleMemberIds(req.user.id);
    res.status(200).json(formatSuccess(ids));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/circle/states
 * Batch retrieval of circle states (inCircle, sentPending, receivedPending).
 */
router.get('/states', async (req, res, next) => {
  try {
    const states = CircleModel.getAllCircleStates(req.user.id);
    res.status(200).json(formatSuccess(states));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/circle/requests
 * View incoming pending Circle requests.
 */
router.get('/requests', async (req, res, next) => {
  try {
    const requests = CircleModel.getIncomingRequests(req.user.id);
    res.status(200).json(formatSuccess(requests));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/circle/requests/sent
 * View outgoing pending Circle requests.
 */
router.get('/requests/sent', async (req, res, next) => {
  try {
    const requests = CircleModel.getSentRequests(req.user.id);
    res.status(200).json(formatSuccess(requests));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/circle/status/:memberId
 * Check relationship status with a specific learner.
 */
router.get('/status/:memberId', async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const status = CircleModel.getRelationshipStatus(req.user.id, memberId);
    res.status(200).json(formatSuccess(status));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/circle/request
 * Send a Circle connection request to a peer learner.
 * Body: { memberId: string }
 */
router.post('/request', async (req, res, next) => {
  try {
    const memberId = req.body.memberId || req.body.targetUserId || req.body.userId;
    if (!memberId || typeof memberId !== 'string') {
      return res.status(400).json(formatError('memberId is required and must be a string.', 'INVALID_INPUT'));
    }

    const result = CircleModel.sendCircleRequest(req.user.id, memberId.trim());
    res.status(201).json(formatSuccess(result));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json(formatError(error.message, 'CIRCLE_ERROR'));
    }
    next(error);
  }
});

/**
 * POST /api/circle/invite
 * Send a Circle connection invitation to a recommended peer.
 * Body: { contactId: string, relationType?: string }
 */
router.post('/invite', async (req, res, next) => {
  try {
    const memberId = req.body.contactId || req.body.memberId || req.body.targetUserId || req.body.userId;
    if (!memberId || typeof memberId !== 'string') {
      return res.status(400).json(formatError('contactId or memberId is required and must be a string.', 'INVALID_INPUT'));
    }

    const result = CircleModel.sendCircleRequest(req.user.id, memberId.trim());
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json(formatError(error.message, 'CIRCLE_ERROR'));
    }
    next(error);
  }
});

/**
 * POST /api/circle/requests/:id/accept
 * POST /api/circle/accept/:senderId
 * Accept an incoming Circle request.
 */
router.post(['/requests/:id/accept', '/accept/:id'], async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = CircleModel.acceptCircleRequest(req.user.id, id);
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json(formatError(error.message, 'CIRCLE_ERROR'));
    }
    next(error);
  }
});

/**
 * POST /api/circle/requests/:id/decline
 * POST /api/circle/decline/:senderId
 * Decline an incoming Circle request.
 */
router.post(['/requests/:id/decline', '/decline/:id'], async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = CircleModel.declineCircleRequest(req.user.id, id);
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json(formatError(error.message, 'CIRCLE_ERROR'));
    }
    next(error);
  }
});

/**
 * DELETE /api/circle/requests/:id
 * DELETE /api/circle/requests/cancel/:receiverId
 * Cancel an outgoing Circle request sent by authenticated user.
 */
router.delete(['/requests/:id', '/requests/cancel/:id'], async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = CircleModel.cancelCircleRequest(req.user.id, id);
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json(formatError(error.message, 'CIRCLE_ERROR'));
    }
    next(error);
  }
});

/**
 * POST /api/circle
 * Add a verified learner to the authenticated user's Circle.
 * Body: { memberId: string }
 */
router.post('/', async (req, res, next) => {
  try {
    const memberId = req.body.memberId || req.body.studentId || req.body.userId;
    if (!memberId || typeof memberId !== 'string') {
      return res.status(400).json(formatError('memberId is required and must be a string.', 'INVALID_INPUT'));
    }

    const result = CircleModel.addToCircle(req.user.id, memberId.trim());
    res.status(201).json(formatSuccess(result));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json(formatError(error.message, 'CIRCLE_ERROR'));
    }
    next(error);
  }
});

/**
 * DELETE /api/circle/:memberId
 * Remove a learner from the authenticated user's Circle.
 * Existing conversations remain completely accessible.
 */
router.delete('/:memberId', async (req, res, next) => {
  try {
    const { memberId } = req.params;
    if (!memberId) {
      return res.status(400).json(formatError('memberId parameter is required.', 'INVALID_INPUT'));
    }

    const result = CircleModel.removeFromCircle(req.user.id, memberId.trim());
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/circle/check/:memberId
 * Check if a learner is in the user's Circle.
 */
router.get('/check/:memberId', async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const inCircle = CircleModel.isInCircle(req.user.id, memberId);
    res.status(200).json(formatSuccess({ memberId, inCircle }));
  } catch (error) {
    next(error);
  }
});

export default router;
