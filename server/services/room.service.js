import RoomModel from '../models/room.model.js';

/**
 * StudySync AI — Room Service (Phase 6)
 * 
 * Business logic and authorization boundaries for persistent topic rooms,
 * memberships, lifecycle management, and deterministic recommendations.
 */
export const RoomService = {
  async getRooms(filters = {}, currentUserId = null) {
    const result = RoomModel.findAll(filters, currentUserId);
    return {
      items: result.items,
      count: result.total,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      filtersApplied: filters,
    };
  },

  async getRoomById(id, currentUserId = null) {
    return RoomModel.findById(id, currentUserId);
  },

  async createRoom(roomData) {
    return RoomModel.create(roomData);
  },

  async updateRoom(id, updateData, currentUserId) {
    const existing = RoomModel.findById(id, currentUserId);
    if (!existing) {
      const err = new Error(`Room not found: ${id}`);
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Security: Only the verified room creator can modify room properties
    if (existing.creator_id !== currentUserId) {
      const err = new Error('You do not have permission to update this room. Only the room creator can edit room details.');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    return RoomModel.update(id, updateData);
  },

  async archiveRoom(id, currentUserId) {
    const existing = RoomModel.findById(id, currentUserId);
    if (!existing) {
      const err = new Error(`Room not found: ${id}`);
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (existing.creator_id !== currentUserId) {
      const err = new Error('You do not have permission to archive this room. Only the room creator can archive it.');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    return RoomModel.archive(id);
  },

  async joinRoom(roomId, currentUserId) {
    return RoomModel.join(roomId, currentUserId);
  },

  async leaveRoom(roomId, currentUserId) {
    return RoomModel.leave(roomId, currentUserId);
  },

  async getRecommendations(currentUserId, limit = 4) {
    return RoomModel.getRecommendations(currentUserId, limit);
  },

  async getRoomMessages(roomId, currentUserId, query = {}) {
    return RoomModel.getMessages(roomId, currentUserId, query);
  },

  async createRoomMessage(roomId, senderId, data) {
    return RoomModel.createMessage(roomId, senderId, data);
  },

  async startMeeting(roomId, currentUserId, meetingData = {}) {
    return RoomModel.startMeeting(roomId, currentUserId, meetingData);
  },

  async joinMeeting(roomId, currentUserId) {
    return RoomModel.joinMeeting(roomId, currentUserId);
  },

  async leaveMeeting(roomId, currentUserId) {
    return RoomModel.leaveMeeting(roomId, currentUserId);
  },

  async endMeeting(roomId, currentUserId) {
    return RoomModel.endMeeting(roomId, currentUserId);
  },

  async joinByCode(code, currentUserId) {
    return RoomModel.joinByCode(code, currentUserId);
  },

  async regenerateCode(roomId, currentUserId) {
    return RoomModel.regenerateCode(roomId, currentUserId);
  },

  async toggleCodeJoin(roomId, currentUserId, enabled = null) {
    return RoomModel.toggleCodeJoin(roomId, currentUserId, enabled);
  },
};

export default RoomService;
