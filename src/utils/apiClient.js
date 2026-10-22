import { Capacitor } from '@capacitor/core';
import { env } from '../config/env.js';

/**
 * StudySync AI — Resilient API Client (Cookie-First Auth Migration)
 * 
 * Persistent web & PWA sessions use HttpOnly cookies without storing raw bearer tokens.
 * Native mobile platforms (Capacitor) retain supported bearer-token fallback.
 */

const DEFAULT_API_URL = 'http://localhost:3001/api';
const TOKEN_STORAGE_KEY = 'studysync_session_token';

/**
 * Detects whether the runtime is running inside a native mobile container
 * (such as Capacitor on Android or iOS) vs standard Web browser / PWA.
 */
export function isNativePlatform() {
  try {
    return typeof Capacitor !== 'undefined' && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Safely purges legacy raw bearer session tokens from browser storage
 * (localStorage and sessionStorage) during web/PWA migration.
 */
export function clearLegacyStoredTokens() {
  if (!isNativePlatform()) {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Ignore storage errors in restricted contexts (e.g. private browsing or sandboxed iframes)
    }
  }
}

// Automatically clear legacy stored tokens for Web and PWA on module initialization
clearLegacyStoredTokens();

export function getApiBaseUrl() {
  const isBrowser = typeof window !== 'undefined' && window.location && window.location.hostname;
  const isRemoteHost = isBrowser && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

  if (env.isProduction) {
    if (env.apiBaseUrl) {
      // In production web deployment on a remote domain, never route browser requests to localhost
      if (isRemoteHost && !isNativePlatform() && (env.apiBaseUrl.includes('localhost') || env.apiBaseUrl.includes('127.0.0.1'))) {
        return '/api';
      }
      // Remote production endpoints must require HTTPS
      if (
        env.apiBaseUrl.startsWith('http://') &&
        !env.apiBaseUrl.includes('localhost') &&
        !env.apiBaseUrl.includes('127.0.0.1')
      ) {
        return env.apiBaseUrl.replace(/^http:\/\//, 'https://');
      }
      return env.apiBaseUrl;
    }
    // In production web deployment without explicit VITE_API_BASE_URL, default to same-origin relative /api
    return '/api';
  }
  return env.apiBaseUrl || DEFAULT_API_URL;
}

export function getStoredToken() {
  // Web and PWA sessions rely exclusively on the HttpOnly session cookie.
  // Raw bearer tokens are never read from localStorage or sessionStorage in web/PWA.
  if (!isNativePlatform()) {
    clearLegacyStoredTokens();
    return null;
  }

  // Native platform compatibility:
  // Retain existing supported flow for native apps until a native secure-storage plugin
  // (e.g. Android Keystore / EncryptedSharedPreferences via @capgo/capacitor-secure-storage) is integrated.
  try {
    const local = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (local) return local;
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  // Web and PWA sessions must NOT persist raw session tokens in localStorage or sessionStorage.
  if (!isNativePlatform()) {
    clearLegacyStoredTokens();
    return;
  }

  // Native platform compatibility:
  // Retain existing supported flow for native apps until a native secure-storage plugin is integrated.
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage issues in restricted environments
  }
}

/**
 * Low-level safe fetch wrapper with automatic Authorization header
 */
async function safeFetch(endpoint, options = {}) {
  const baseUrl = getApiBaseUrl();
  const url = baseUrl.startsWith('http') || baseUrl.startsWith('/')
    ? `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`
    : `/${endpoint.replace(/^\//, '')}`;

  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.headers || {}),
  };

  // Only attach Authorization header if a token is explicitly available (e.g. Native platform or custom header)
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      credentials: options.credentials || 'include',
      headers,
    });

    const data = await response.json().catch(() => null);

    if (response.status === 401) {
      setStoredToken(null);
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      isAvailable: true,
    };
  } catch (error) {
    if (error.name === 'AbortError' || error.code === 20 || options?.signal?.aborted) {
      throw error;
    }
    // Network failure, backend offline, or CORS blocked
    return {
      ok: false,
      status: 0,
      data: null,
      error: error.message,
      isAvailable: false,
    };
  }
}

export const apiClient = {
  // -------------------------------------------------------------
  // System Health
  // -------------------------------------------------------------
  async checkHealth() {
    return safeFetch('/health');
  },

  async checkDbHealth() {
    return safeFetch('/health/db');
  },

  // -------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------
  async register({ displayName, email, password, confirmPassword }) {
    const res = await safeFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ displayName, email, password, confirmPassword }),
    });
    if (res.ok && res.data?.data?.token) {
      setStoredToken(res.data.data.token);
    }
    return res;
  },

  async verifyOtp({ email, otp }) {
    const res = await safeFetch('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
    if (res.ok && res.data?.data?.token) {
      setStoredToken(res.data.data.token);
    }
    return res;
  },

  async resendOtp({ email }) {
    return safeFetch('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async getEmailProviderStatus() {
    return safeFetch('/auth/email-provider-status');
  },

  async login({ email, password }) {
    const res = await safeFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.ok && res.data?.data?.token) {
      setStoredToken(res.data.data.token);
    }
    return res;
  },

  async logout() {
    try {
      await safeFetch('/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
      clearLegacyStoredTokens();
      try {
        localStorage.removeItem('studysync_active_session_id');
      } catch {
        // ignore storage errors
      }
    }
    return { ok: true, isAvailable: true };
  },

  async getCurrentUser() {
    return safeFetch('/auth/me');
  },

  // -------------------------------------------------------------
  // Learner Profiles & Preferences
  // -------------------------------------------------------------
  async getOwnProfile() {
    return safeFetch('/profile/me');
  },

  async updateOwnProfile(profileData) {
    return safeFetch('/profile/me', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },

  async updateLearningPreferences(preferences) {
    return safeFetch('/profile/preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    });
  },

  async removeLearningPreference(topicId) {
    return safeFetch(`/profile/preferences/${topicId}`, {
      method: 'DELETE',
    });
  },

  // -------------------------------------------------------------
  // User Settings, Themes & Language Preferences (Phase 3)
  // -------------------------------------------------------------
  async getSettings() {
    return safeFetch('/settings');
  },

  async updateSettings(settingsData) {
    return safeFetch('/settings', {
      method: 'PUT',
      body: JSON.stringify(settingsData),
    });
  },

  // -------------------------------------------------------------
  // Secure Direct Messaging & 1-to-1 Conversations (Phase 4)
  // -------------------------------------------------------------
  async getConversations() {
    return safeFetch('/conversations');
  },

  async getConversation(id) {
    return safeFetch(`/conversations/${id}`);
  },

  async createConversation(recipientId, message = null) {
    return safeFetch('/conversations', {
      method: 'POST',
      body: JSON.stringify({ recipientId, message }),
    });
  },

  async getConversationWithUser(recipientId) {
    return safeFetch(`/conversations/with/${recipientId}`);
  },

  async searchConversationRecipients(query = '', limit = 50) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (limit) params.set('limit', limit);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return safeFetch(`/conversations/recipients${qs}`);
  },

  async getContacts(query = '', limit = 50) {
    return this.searchConversationRecipients(query, limit);
  },

  // -------------------------------------------------------------
  // Circle (Learner Relationships & Connection Requests)
  // -------------------------------------------------------------
  async getCircle(query = '', limit = 50) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (limit) params.set('limit', limit);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return safeFetch(`/circle${qs}`);
  },

  async getCircleIds() {
    return safeFetch('/circle/ids');
  },

  async getCircleStates() {
    return safeFetch('/circle/states');
  },

  async getCircleRequests() {
    return safeFetch('/circle/requests');
  },

  async getSentCircleRequests() {
    return safeFetch('/circle/requests/sent');
  },

  async getCircleStatus(memberId) {
    return safeFetch(`/circle/status/${encodeURIComponent(memberId)}`);
  },

  async sendCircleRequest(memberId) {
    return safeFetch('/circle/request', {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    });
  },

  async acceptCircleRequest(requestIdOrSenderId) {
    return safeFetch(`/circle/accept/${encodeURIComponent(requestIdOrSenderId)}`, {
      method: 'POST',
    });
  },

  async declineCircleRequest(requestIdOrSenderId) {
    return safeFetch(`/circle/decline/${encodeURIComponent(requestIdOrSenderId)}`, {
      method: 'POST',
    });
  },

  async cancelCircleRequest(requestIdOrReceiverId) {
    return safeFetch(`/circle/requests/cancel/${encodeURIComponent(requestIdOrReceiverId)}`, {
      method: 'DELETE',
    });
  },

  async addToCircle(memberId) {
    return safeFetch('/circle', {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    });
  },

  async removeFromCircle(memberId) {
    return safeFetch(`/circle/${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
    });
  },

  async checkInCircle(memberId) {
    return safeFetch(`/circle/check/${encodeURIComponent(memberId)}`);
  },

  async getConversationStudyCall(conversationId) {
    return safeFetch(`/conversations/${conversationId}/study-call`);
  },

  async startConversationStudyCall(conversationId) {
    return safeFetch(`/conversations/${conversationId}/study-call`, {
      method: 'POST',
    });
  },

  async getDirectMessages(conversationId, options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit);
    if (options.offset) params.set('offset', options.offset);
    if (options.before) params.set('before', options.before);
    const query = params.toString() ? `?${params.toString()}` : '';
    return safeFetch(`/conversations/${conversationId}/messages${query}`);
  },

  async sendDirectMessage(conversationId, messageContent) {
    return safeFetch(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message_content: messageContent }),
    });
  },

  // -------------------------------------------------------------
  // Curriculum Topics & Subjects
  // -------------------------------------------------------------
  async getTopics(filters = {}) {
    const params = new URLSearchParams();
    if (filters.subject) params.set('subject', filters.subject);
    if (filters.difficulty) params.set('difficulty', filters.difficulty);
    const query = params.toString() ? `?${params.toString()}` : '';
    return safeFetch(`/topics${query}`);
  },

  async getSubjects() {
    return safeFetch('/topics/subjects');
  },

  async getTopicById(id) {
    return safeFetch(`/topics/${id}`);
  },

  // -------------------------------------------------------------
  // Persistent Topic Rooms & Memberships (Phase 6)
  // -------------------------------------------------------------
  async getRooms(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search || filters.q) params.set('search', filters.search || filters.q);
    if (filters.subject && filters.subject !== 'all') params.set('subject', filters.subject);
    if (filters.topic) params.set('topic', filters.topic);
    if (filters.difficulty && filters.difficulty !== 'all') params.set('difficulty', filters.difficulty);
    if (filters.room_type && filters.room_type !== 'all') params.set('room_type', filters.room_type);
    if (filters.language && filters.language !== 'all') params.set('language', filters.language);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.page) params.set('page', filters.page);
    if (filters.limit) params.set('limit', filters.limit);
    const query = params.toString() ? `?${params.toString()}` : '';
    return safeFetch(`/rooms${query}`);
  },

  async getRoomById(id) {
    return safeFetch(`/rooms/${id}`);
  },

  async getRecommendedRooms(limit = 4) {
    return safeFetch(`/rooms/recommendations?limit=${limit}`);
  },

  async createRoom(roomData) {
    return safeFetch('/rooms', {
      method: 'POST',
      body: JSON.stringify(roomData),
    });
  },

  async updateRoom(id, roomData) {
    return safeFetch(`/rooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(roomData),
    });
  },

  async archiveRoom(id) {
    return safeFetch(`/rooms/${id}`, {
      method: 'DELETE',
    });
  },

  async joinRoom(id) {
    return safeFetch(`/rooms/${id}/join`, {
      method: 'POST',
    });
  },

  async joinRoomByCode(code) {
    return safeFetch('/rooms/join-by-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async regenerateRoomCode(roomId) {
    return safeFetch(`/rooms/${roomId}/code/regenerate`, {
      method: 'POST',
    });
  },

  async toggleRoomCodeJoin(roomId, enabled = null) {
    return safeFetch(`/rooms/${roomId}/code/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  },

  async leaveRoom(id) {
    return safeFetch(`/rooms/${id}/leave`, {
      method: 'POST',
    });
  },

  async getRoomMessages(roomId, params = {}) {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', params.limit);
    if (params.offset) searchParams.set('offset', params.offset);
    if (params.before) searchParams.set('before', params.before);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return safeFetch(`/rooms/${roomId}/messages${query}`);
  },

  async sendRoomMessage(roomId, data) {
    return safeFetch(`/rooms/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async startRoomMeeting(roomId, meetingData = {}) {
    return safeFetch(`/rooms/${roomId}/meeting`, {
      method: 'POST',
      body: JSON.stringify(meetingData),
    });
  },

  async joinRoomMeeting(roomId) {
    return safeFetch(`/rooms/${roomId}/meeting/join`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async leaveRoomMeeting(roomId) {
    return safeFetch(`/rooms/${roomId}/meeting/leave`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async endRoomMeeting(roomId) {
    return safeFetch(`/rooms/${roomId}/meeting`, {
      method: 'DELETE',
    });
  },

  // -------------------------------------------------------------
  // Real Study Sessions & Individual Attendance (Phase 7)
  // -------------------------------------------------------------
  async getSessions(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.roomId) params.set('roomId', filters.roomId);
    if (filters.topic) params.set('topic', filters.topic);
    if (filters.search || filters.q) params.set('search', filters.search || filters.q);
    if (filters.page) params.set('page', filters.page);
    if (filters.limit) params.set('limit', filters.limit);
    const query = params.toString() ? `?${params.toString()}` : '';
    return safeFetch(`/sessions${query}`);
  },

  async getSessionById(id) {
    return safeFetch(`/sessions/${id}`);
  },

  async getSessionSummary(id) {
    return safeFetch(`/sessions/${id}/summary`);
  },

  async getSessionHistory(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.topic) params.set('topic', filters.topic);
    const query = params.toString() ? `?${params.toString()}` : '';
    return safeFetch(`/sessions/history${query}`);
  },

  async getRoomSessions(roomId, filters = {}) {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return safeFetch(`/rooms/${roomId}/sessions${query}`);
  },

  async createSession(sessionData) {
    return safeFetch('/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  },

  async startSession(id) {
    return safeFetch(`/sessions/${id}/start`, {
      method: 'POST',
    });
  },

  async joinSession(id) {
    return safeFetch(`/sessions/${id}/join`, {
      method: 'POST',
    });
  },

  async leaveSession(id) {
    return safeFetch(`/sessions/${id}/leave`, {
      method: 'POST',
    });
  },

  async endSession(id) {
    return safeFetch(`/sessions/${id}/end`, {
      method: 'POST',
    });
  },

  async submitSessionFeedback(id, feedbackData) {
    return safeFetch(`/sessions/${id}/feedback`, {
      method: 'POST',
      body: JSON.stringify(feedbackData),
    });
  },

  async recordSessionFocus(id, focusData) {
    return safeFetch(`/sessions/${id}/focus`, {
      method: 'POST',
      body: JSON.stringify(focusData),
    });
  },

  // ==========================================
  // PHASE 8: NOTES, RESOURCES & KNOWLEDGE APIS
  // ==========================================

  async getNotes(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.subject && params.subject !== 'all') query.set('subject', params.subject);
    if (params.topic && params.topic !== 'all') query.set('topic', params.topic);
    if (params.type && params.type !== 'all') query.set('type', params.type);
    if (params.roomId) query.set('room_id', params.roomId);
    if (params.sessionId) query.set('session_id', params.sessionId);
    if (params.visibility) query.set('visibility', params.visibility);
    if (params.authorId) query.set('authorId', params.authorId);
    if (params.limit) query.set('limit', params.limit);
    if (params.page) query.set('page', params.page);

    const queryString = query.toString();
    const endpoint = queryString ? `/notes?${queryString}` : '/notes';
    return safeFetch(endpoint);
  },

  async getNoteById(id) {
    return safeFetch(`/notes/${id}`);
  },

  async createNote(noteData) {
    return safeFetch('/notes', {
      method: 'POST',
      body: JSON.stringify(noteData),
    });
  },

  async updateNote(id, noteData) {
    return safeFetch(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(noteData),
    });
  },

  async deleteNote(id) {
    return safeFetch(`/notes/${id}`, {
      method: 'DELETE',
    });
  },

  async getRoomQuestions(roomId) {
    return safeFetch(`/rooms/${roomId}/questions`);
  },

  async createRoomQuestion(roomId, questionData) {
    return safeFetch(`/rooms/${roomId}/questions`, {
      method: 'POST',
      body: JSON.stringify(questionData),
    });
  },

  async createRoomQuestionReply(roomId, questionId, replyData) {
    return safeFetch(`/rooms/${roomId}/questions/${questionId}/replies`, {
      method: 'POST',
      body: JSON.stringify(replyData),
    });
  },

  async resolveRoomQuestion(roomId, questionId) {
    return safeFetch(`/rooms/${roomId}/questions/${questionId}/resolve`, {
      method: 'PATCH',
    });
  },

  async deleteRoomQuestion(roomId, questionId) {
    return safeFetch(`/rooms/${roomId}/questions/${questionId}`, {
      method: 'DELETE',
    });
  },

  async getRoomResources(roomId) {
    return safeFetch(`/rooms/${roomId}/resources`);
  },

  async createRoomResource(roomId, resourceData) {
    return safeFetch(`/rooms/${roomId}/resources`, {
      method: 'POST',
      body: JSON.stringify(resourceData),
    });
  },

  async deleteRoomResource(roomId, resourceId) {
    return safeFetch(`/rooms/${roomId}/resources/${resourceId}`, {
      method: 'DELETE',
    });
  },

  // ==========================================
  // PHASE 9: INTELLIGENT MATCHING & RECOMMENDATIONS
  // ==========================================

  async getPeerMatches(params = {}, options = {}) {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.subject && params.subject !== 'all' && params.subject !== 'All') query.set('subject', params.subject);
    if (params.topic) query.set('topic', params.topic);
    if (params.educationStage && params.educationStage !== 'all') query.set('educationStage', params.educationStage);
    if (params.fieldOfStudy && params.fieldOfStudy !== 'all') query.set('fieldOfStudy', params.fieldOfStudy);
    if (params.institution) query.set('institution', params.institution);
    if (params.country) query.set('country', params.country);
    if (params.state) query.set('state', params.state);
    if (params.city) query.set('city', params.city);
    if (params.skillLevel && params.skillLevel !== 'all') query.set('skillLevel', params.skillLevel);
    if (params.learningGoal) query.set('learningGoal', params.learningGoal);
    if (params.intent) query.set('intent', params.intent);
    if (params.skillPreference && params.skillPreference !== 'any') query.set('skillPreference', params.skillPreference);
    if (params.confidence) query.set('confidence', params.confidence);
    if (params.collaborationStyle) query.set('collaborationStyle', params.collaborationStyle);
    if (params.language && params.language !== 'Any' && params.language !== 'all') query.set('language', params.language);
    if (params.preferredTime && params.preferredTime !== 'any') query.set('preferredTime', params.preferredTime);
    if (params.filterSchedule && params.filterSchedule !== 'any') query.set('filterSchedule', params.filterSchedule);
    if (params.duration) query.set('duration', params.duration);
    if (params.sort) query.set('sort', params.sort);
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);

    const queryString = query.toString();
    const endpoint = queryString ? `/matches/peers?${queryString}` : '/matches/peers';
    return safeFetch(endpoint, options);
  },

  async getPeerProfile(peerId) {
    return safeFetch(`/matches/peers/${peerId}`);
  },

  async findPeerMatches(criteria = {}) {
    return safeFetch('/matches/find', {
      method: 'POST',
      body: JSON.stringify(criteria),
    });
  },

  async blockPeer(targetUserId) {
    return safeFetch('/matches/block', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  },

  async getMatchingStatus() {
    return safeFetch('/matches/status');
  },

  async getStudyRecommendations() {
    return safeFetch('/recommendations/study');
  },

  async submitRecommendationFeedback(feedbackData) {
    return safeFetch('/recommendations/feedback', {
      method: 'POST',
      body: JSON.stringify(feedbackData),
    });
  },

  async getRecommendationStatus() {
    return safeFetch('/recommendations/status');
  },

  // ==========================================
  // PHASE 10: LEARNING DNA & KNOWLEDGE MAP
  // ==========================================

  async getLearningDna() {
    return safeFetch('/dna');
  },

  async updateLearningDna(dnaData) {
    return safeFetch('/dna', {
      method: 'PUT',
      body: JSON.stringify(dnaData),
    });
  },

  async getKnowledgeMap(params = {}) {
    const query = new URLSearchParams();
    if (params.subject && params.subject !== 'all') {
      query.set('subject', params.subject);
    }
    const queryString = query.toString();
    const endpoint = queryString ? `/knowledge-map?${queryString}` : '/knowledge-map';
    return safeFetch(endpoint);
  },

  async getKnowledgeProgress() {
    return safeFetch('/knowledge-map/progress');
  },

  async getLearningPaths(params = {}) {
    const query = new URLSearchParams();
    if (params.subject && params.subject !== 'all') {
      query.set('subject', params.subject);
    }
    const queryString = query.toString();
    const endpoint = queryString ? `/knowledge-map/paths?${queryString}` : '/knowledge-map/paths';
    return safeFetch(endpoint);
  },

  async recordTopicAssessment(assessmentData) {
    return safeFetch('/knowledge-map/assessments', {
      method: 'POST',
      body: JSON.stringify(assessmentData),
    });
  },

  // ==========================================
  // PHASE 11: DISTRACTION SHIELD & FOCUS MODE
  // ==========================================

  async getActiveFocusInterval() {
    return safeFetch('/focus/active');
  },

  async startFocusInterval(focusData) {
    return safeFetch('/focus/start', {
      method: 'POST',
      body: JSON.stringify(focusData),
    });
  },

  async updateFocusPhase(intervalId, phaseData) {
    return safeFetch(`/focus/${intervalId}/phase`, {
      method: 'POST',
      body: JSON.stringify(phaseData),
    });
  },

  async pauseFocusInterval(intervalId) {
    return safeFetch(`/focus/${intervalId}/pause`, {
      method: 'POST',
    });
  },

  async resumeFocusInterval(intervalId) {
    return safeFetch(`/focus/${intervalId}/resume`, {
      method: 'POST',
    });
  },

  async completeFocusInterval(intervalId, reflectionData = {}) {
    return safeFetch(`/focus/${intervalId}/complete`, {
      method: 'POST',
      body: JSON.stringify(reflectionData),
    });
  },

  async cancelFocusInterval(intervalId, cancelData = {}) {
    return safeFetch(`/focus/${intervalId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(cancelData),
    });
  },

  async getFocusHistory(params = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', params.limit);
    if (params.offset) query.set('offset', params.offset);
    const queryString = query.toString();
    const endpoint = queryString ? `/focus/history?${queryString}` : '/focus/history';
    return safeFetch(endpoint);
  },

  async getFocusSettings() {
    return safeFetch('/focus/settings');
  },

  async updateFocusSettings(settingsData) {
    return safeFetch('/focus/settings', {
      method: 'PUT',
      body: JSON.stringify(settingsData),
    });
  },

  async getFocusCoachAdvice() {
    return safeFetch('/focus/coach');
  },

  // ==========================================
  // PHASE 12: LEARNING FEEDBACK LOOP & EVALUATION
  // ==========================================

  async submitRecommendationFeedback(feedbackData) {
    return safeFetch('/feedback/recommendation', {
      method: 'POST',
      body: JSON.stringify(feedbackData),
    });
  },

  async recordRecommendationInteraction(interactionData) {
    return safeFetch('/recommendations/feedback', {
      method: 'POST',
      body: JSON.stringify(interactionData),
    });
  },

  async submitPeerFeedback(peerFeedbackData) {
    return safeFetch('/feedback/peer', {
      method: 'POST',
      body: JSON.stringify(peerFeedbackData),
    });
  },

  async submitSessionPeerFeedback(sessionId, peerFeedbackData) {
    return safeFetch(`/sessions/${sessionId}/peer-feedback`, {
      method: 'POST',
      body: JSON.stringify(peerFeedbackData),
    });
  },

  async getFeedbackMetrics(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return safeFetch(`/feedback/metrics${qs ? `?${qs}` : ''}`);
  },

  async submitCoachFeedback(feedbackData) {
    return safeFetch('/feedback/coach', {
      method: 'POST',
      body: JSON.stringify(feedbackData),
    });
  },

  async getMySubmittedFeedback() {
    return safeFetch('/feedback/my-feedback');
  },

  async getPairwisePeerFeedback(peerId) {
    return safeFetch(`/feedback/peer/${peerId}`);
  },

  // ==========================================
  // PHASE 14: SAFETY, PRIVACY & TRUST
  // ==========================================

  async getPrivacySettings() {
    return safeFetch('/safety/privacy');
  },

  async updatePrivacySettings(settings) {
    return safeFetch('/safety/privacy', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  async getBlockedUsers() {
    return safeFetch('/safety/blocks');
  },

  async blockUser(userId) {
    return safeFetch('/safety/blocks', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  async unblockUser(userId) {
    return safeFetch(`/safety/blocks/${userId}`, {
      method: 'DELETE',
    });
  },

  async submitReport(reportData) {
    return safeFetch('/safety/reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
  },

  async getModerationReports(status = null) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return safeFetch(`/safety/moderation/reports${query}`);
  },

  async reviewModerationReport(reportId, actionData) {
    return safeFetch(`/safety/moderation/reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify(actionData),
    });
  },

  async sendStudyInvite(inviteData) {
    return safeFetch('/safety/invites', {
      method: 'POST',
      body: JSON.stringify(inviteData),
    });
  },

  async getStudyInvites() {
    return safeFetch('/safety/invites');
  },

  async respondToStudyInvite(inviteId, status) {
    return safeFetch(`/safety/invites/${inviteId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async deactivateAccount(password, confirmation = 'CONFIRM') {
    return safeFetch('/account/deactivate', {
      method: 'POST',
      body: JSON.stringify({ password, confirmation }),
    });
  },

  async clearLearningPreferences() {
    return safeFetch('/profile/preferences', {
      method: 'DELETE',
    });
  },

  /* ==========================================================================
     Social & Collaboration Notifications API
     ========================================================================== */
  async getNotifications(options = {}) {
    const params = new URLSearchParams();
    if (options.filter) params.set('filter', options.filter);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    const query = params.toString() ? `?${params.toString()}` : '';
    return safeFetch(`/notifications${query}`);
  },

  async getUnreadNotificationCount() {
    return safeFetch('/notifications/unread-count');
  },

  async markNotificationAsRead(id) {
    return safeFetch(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  async markAllNotificationsAsRead() {
    return safeFetch('/notifications/mark-all-read', {
      method: 'POST',
    });
  },

  async deleteNotification(id) {
    return safeFetch(`/notifications/${id}`, {
      method: 'DELETE',
    });
  },
};

export default apiClient;

