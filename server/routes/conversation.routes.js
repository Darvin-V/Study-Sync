import { Router } from 'express';
import { requireAuth, messageRateLimiter } from '../middleware/authMiddleware.js';
import ConversationModel from '../models/conversation.model.js';
import {
  validateCreateConversationInput,
  validateCreateDirectMessageInput,
  validateDirectMessagesQuery,
  formatSuccess,
  formatError,
} from '../schemas/index.js';

const router = Router();

/**
 * All conversation & direct messaging endpoints require an authenticated session.
 * The sender identity is derived strictly from the server session (req.user.id).
 */
router.use(requireAuth);

/**
 * GET /api/conversations
 * List all 1-to-1 conversations for the authenticated user.
 */
router.get('/', async (req, res, next) => {
  try {
    const conversations = ConversationModel.getUserConversations(req.user.id);
    res.status(200).json(formatSuccess(conversations));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/conversations
 * Start or open a conversation with another user.
 * Optional initial message creates conversation and sends message atomically.
 */
router.post('/', messageRateLimiter, async (req, res, next) => {
  try {
    const sanitized = validateCreateConversationInput(req.body, req.user.id);
    const conversation = ConversationModel.getOrCreateConversation(req.user.id, sanitized.recipientId);

    let initialMessage = null;
    if (sanitized.initialMessage) {
      initialMessage = ConversationModel.sendMessage(conversation.id, req.user.id, sanitized.initialMessage);
      conversation.lastMessageAt = initialMessage.createdAt;
      conversation.lastMessagePreview = initialMessage.messageContent.slice(0, 80);
    }

    res.status(201).json(formatSuccess({
      ...conversation,
      initialMessage,
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/conversations/recipients
 * Search registered users who can be messaged.
 */
router.get('/recipients', async (req, res, next) => {
  try {
    const q = req.query.q || req.query.search || '';
    const limit = parseInt(req.query.limit, 10) || 50;
    const recipients = ConversationModel.searchPotentialRecipients(req.user.id, q, limit);
    res.status(200).json(formatSuccess(recipients));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/conversations/with/:recipientId
 * Find or open a conversation with a specific peer.
 */
router.get('/with/:recipientId', async (req, res, next) => {
  try {
    const { recipientId } = req.params;
    if (!recipientId || recipientId.trim() === req.user.id) {
      return res.status(400).json(formatError('Invalid recipient ID', 'INVALID_PARAM'));
    }

    const conversation = ConversationModel.getOrCreateConversation(req.user.id, recipientId.trim());
    res.status(200).json(formatSuccess(conversation));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/conversations/:id
 * Retrieve a specific conversation. Enforces that the authenticated user is a participant.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const conversation = ConversationModel.getConversationById(id, req.user.id);
    res.status(200).json(formatSuccess(conversation));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/conversations/:id/study-call
 * Open or create the dedicated 1-to-1 study room associated with this conversation.
 */
router.post('/:id/study-call', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Conversation ID is required', 'INVALID_PARAM'));
    }

    const room = await ConversationModel.getOrCreateStudyRoom(id.trim(), req.user.id);
    res.status(200).json(formatSuccess(room));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/conversations/:id/study-call
 * Check or retrieve the dedicated study room associated with this conversation.
 */
router.get('/:id/study-call', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Conversation ID is required', 'INVALID_PARAM'));
    }

    const room = await ConversationModel.getOrCreateStudyRoom(id.trim(), req.user.id);
    res.status(200).json(formatSuccess(room));
  } catch (error) {
    next(error);
  }
});


/**
 * GET /api/conversations/:id/messages
 * Retrieve messages for a conversation with pagination. Marks messages as read.
 */
router.get('/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = validateDirectMessagesQuery(req.query);
    const result = ConversationModel.getMessages(id, req.user.id, query);

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
 * POST /api/conversations/:id/messages
 * Send a direct message in a conversation.
 * Sender identity is strictly derived from req.user.id.
 */
router.post('/:id/messages', messageRateLimiter, async (req, res, next) => {
  try {
    const { id } = req.params;
    const sanitized = validateCreateDirectMessageInput(req.body);
    const message = ConversationModel.sendMessage(id, req.user.id, sanitized.message_content);

    res.status(201).json(formatSuccess(message));
  } catch (error) {
    next(error);
  }
});

export default router;
