import { Router } from 'express';
import RoomService from '../services/room.service.js';
import SessionService from '../services/session.service.js';
import RoomModel from '../models/room.model.js';
import {
  validateRoomQuery,
  validateCreateRoomInput,
  validateUpdateRoomInput,
  validateSessionQuery,
  validateCreateQuestionInput,
  validateCreateReplyInput,
  validateCreateResourceInput,
  validateCreateMessageInput,
  validateRoomMessagesQuery,
  validateSafeUrl,
  validateJoinCodeInput,
  formatSuccess,
  formatError,
} from '../schemas/index.js';
import { requireAuth, optionalAuth, messageRateLimiter, joinCodeRateLimiter } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * GET /api/rooms
 * List persistent topic rooms with filtering, search, pagination, and membership detection
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const filters = validateRoomQuery(req.query);
    const result = await RoomService.getRooms(filters, req.user?.id);
    res.status(200).json(
      formatSuccess(result.items, {
        total: result.total,
        count: result.count,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        filters,
      })
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rooms/recommendations
 * Deterministic room recommendations based on learner's syllabus topics
 * Note: Must be mounted before /:id
 */
router.get('/recommendations', optionalAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 4;
    const recommendations = await RoomService.getRecommendations(req.user?.id, limit);
    res.status(200).json(formatSuccess(recommendations));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms
 * Create a new room with verified server-side identity and automatic creator membership
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const sanitized = validateCreateRoomInput(req.body);
    const newRoom = await RoomService.createRoom({
      ...sanitized,
      creator_id: req.user.id,
    });
    res.status(201).json(formatSuccess(newRoom));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/join-by-code
 * Authenticated and verified join operation using human-readable room code
 * Enforces rate limiting, capacity, code join permissions, active status, and safety boundaries
 */
router.post('/join-by-code', requireAuth, joinCodeRateLimiter, async (req, res, next) => {
  try {
    let cleanCode;
    try {
      cleanCode = validateJoinCodeInput(req.body);
    } catch (valErr) {
      req.recordInvalidJoinAttempt?.();
      return res.status(400).json(formatError(valErr.message, 'INVALID_ROOM_CODE', valErr.details));
    }

    const result = await RoomService.joinByCode(cleanCode, req.user.id);
    try {
      const { FeedbackModel } = await import('../models/feedback.model.js');
      FeedbackModel.verifyRoomOutcomes(result.roomId, req.user.id);
    } catch {}

    res.status(200).json(formatSuccess(result));
  } catch (error) {
    if (error.code === 'INVALID_ROOM_CODE' || error.statusCode === 404) {
      req.recordInvalidJoinAttempt?.();
    }
    next(error);
  }
});

/**
 * GET /api/rooms/:id
 * Retrieves full room details, roster, messages, questions, and membership state
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const room = await RoomService.getRoomById(id.trim(), req.user?.id);
    if (!room) {
      return res.status(404).json(formatError(`Room not found for ID: ${id}`, 'NOT_FOUND'));
    }

    res.status(200).json(formatSuccess(room));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rooms/:id/messages
 * Retrieves persistent messages for a room with pagination, safety masking, and access authorization
 */
router.get('/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const query = validateRoomMessagesQuery(req.query);
    const result = await RoomService.getRoomMessages(id.trim(), req.user.id, query);
    res.status(200).json(
      formatSuccess(result.messages, {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore,
      })
    );
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:id/messages
 * Sends a persistent message in a room (authorized members and creator only)
 */
router.post('/:id/messages', requireAuth, messageRateLimiter, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const sanitized = validateCreateMessageInput(req.body);
    const message = await RoomService.createRoomMessage(id.trim(), req.user.id, sanitized);
    res.status(201).json(formatSuccess(message));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/rooms/:id
 * Update room details (creator only)
 */
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const sanitized = validateUpdateRoomInput(req.body);
    const updatedRoom = await RoomService.updateRoom(id.trim(), sanitized, req.user.id);
    res.status(200).json(formatSuccess(updatedRoom));
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/rooms/:id
 * Partial update for room details (creator only)
 */
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const sanitized = validateUpdateRoomInput(req.body);
    const updatedRoom = await RoomService.updateRoom(id.trim(), sanitized, req.user.id);
    res.status(200).json(formatSuccess(updatedRoom));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/rooms/:id
 * Archive room (creator only)
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const result = await RoomService.archiveRoom(id.trim(), req.user.id);
    res.status(200).json(formatSuccess({ archived: true, id: id.trim(), status: 'archived' }));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:id/join
 * Authenticated join operation with capacity enforcement and duplicate membership check
 */
router.post('/:id/join', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const joinResult = await RoomService.joinRoom(id.trim(), req.user.id);
    try {
      const { FeedbackModel } = await import('../models/feedback.model.js');
      FeedbackModel.verifyRoomOutcomes(id.trim(), req.user.id);
    } catch {}
    res.status(200).json(formatSuccess(joinResult));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:id/leave
 * Authenticated leave operation with ownership protection
 */
router.post('/:id/leave', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const leaveResult = await RoomService.leaveRoom(id.trim(), req.user.id);
    res.status(200).json(formatSuccess(leaveResult));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:id/code/regenerate
 * Regenerate a room's unique invite code (host/creator only)
 */
router.post('/:id/code/regenerate', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const result = await RoomService.regenerateCode(id.trim(), req.user.id);
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:id/code/toggle
 * Enable or disable code-based joining for this room (host/creator only)
 */
router.post('/:id/code/toggle', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const enabled = req.body?.enabled !== undefined ? Boolean(req.body.enabled) : null;
    const result = await RoomService.toggleCodeJoin(id.trim(), req.user.id, enabled);
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rooms/:id/sessions
 * List study sessions for an accessible topic room
 */
router.get('/:id/sessions', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const filters = validateSessionQuery({ ...req.query, roomId: id.trim() });
    const result = await SessionService.getSessions(filters, req.user?.id);
    res.status(200).json(
      formatSuccess(result.items, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      })
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rooms/:id/questions
 * List doubts/questions asked in this room
 */
router.get('/:id/questions', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const questions = RoomModel.getQuestions(id.trim(), req.user?.id);
    res.status(200).json(formatSuccess(questions));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:id/questions
 * Ask a doubt/question in this room (room members/creator only)
 */
router.post('/:id/questions', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const sanitized = validateCreateQuestionInput(req.body);
    const question = RoomModel.createQuestion(id.trim(), req.user.id, sanitized);
    res.status(201).json(formatSuccess(question));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:id/questions/:questionId/replies
 * Reply to a doubt/question (room members/creator only)
 */
router.post('/:id/questions/:questionId/replies', requireAuth, async (req, res, next) => {
  try {
    const { id, questionId } = req.params;
    if (!id || !questionId) {
      return res.status(400).json(formatError('Room ID and Question ID are required', 'INVALID_PARAM'));
    }

    const sanitized = validateCreateReplyInput(req.body);
    const reply = RoomModel.createQuestionReply(id.trim(), questionId.trim(), req.user.id, sanitized);
    res.status(201).json(formatSuccess(reply));
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/rooms/:id/questions/:questionId/resolve
 * Mark a question as resolved or open (author or room creator only)
 */
router.patch('/:id/questions/:questionId/resolve', requireAuth, async (req, res, next) => {
  try {
    const { id, questionId } = req.params;
    if (!id || !questionId) {
      return res.status(400).json(formatError('Room ID and Question ID are required', 'INVALID_PARAM'));
    }

    const result = RoomModel.toggleResolveQuestion(id.trim(), questionId.trim(), req.user.id);
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/rooms/:id/questions/:questionId
 * Delete a question (author or room creator only)
 */
router.delete('/:id/questions/:questionId', requireAuth, async (req, res, next) => {
  try {
    const { id, questionId } = req.params;
    if (!id || !questionId) {
      return res.status(400).json(formatError('Room ID and Question ID are required', 'INVALID_PARAM'));
    }

    const result = RoomModel.deleteQuestion(id.trim(), questionId.trim(), req.user.id);
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rooms/:id/resources
 * List shared resources in this room
 */
router.get('/:id/resources', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const resources = RoomModel.getResources(id.trim());
    res.status(200).json(formatSuccess(resources));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:id/resources
 * Share a resource in this room (room members/creator only)
 */
router.post('/:id/resources', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const sanitized = validateCreateResourceInput(req.body);
    const resource = RoomModel.createResource(id.trim(), req.user.id, sanitized);
    res.status(201).json(formatSuccess(resource));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/rooms/:id/resources/:resourceId
 * Delete a shared resource (uploader or room creator only)
 */
router.delete('/:id/resources/:resourceId', requireAuth, async (req, res, next) => {
  try {
    const { id, resourceId } = req.params;
    if (!id || !resourceId) {
      return res.status(400).json(formatError('Room ID and Resource ID are required', 'INVALID_PARAM'));
    }

    const result = RoomModel.deleteResource(id.trim(), resourceId.trim(), req.user.id);
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:id/meeting
 * Start or update a live virtual study meeting in this room
 */
router.post('/:id/meeting', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const { meeting_url, meeting_provider } = req.body || {};
    if (meeting_url && !validateSafeUrl(meeting_url)) {
      return res.status(400).json(formatError('Invalid meeting URL. Must start with http:// or https://', 'INVALID_URL'));
    }

    const updatedRoom = await RoomService.startMeeting(id.trim(), req.user.id, {
      meeting_url,
      meeting_provider,
    });
    res.status(200).json(formatSuccess(updatedRoom));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:id/meeting/join
 * Register member attendance in the active virtual meeting
 */
router.post('/:id/meeting/join', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const updatedRoom = await RoomService.joinMeeting(id.trim(), req.user.id);
    res.status(200).json(formatSuccess(updatedRoom));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:id/meeting/leave
 * Participant leaves the active virtual meeting without terminating it for others
 */
router.post('/:id/meeting/leave', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const updatedRoom = await RoomService.leaveMeeting(id.trim(), req.user.id);
    res.status(200).json(formatSuccess(updatedRoom));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/rooms/:id/meeting
 * End the active virtual study meeting in this room
 */
router.delete('/:id/meeting', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Room ID is required', 'INVALID_PARAM'));
    }

    const updatedRoom = await RoomService.endMeeting(id.trim(), req.user.id);
    res.status(200).json(formatSuccess(updatedRoom));
  } catch (error) {
    next(error);
  }
});

export default router;
