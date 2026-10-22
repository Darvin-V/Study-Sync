import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import apiClient from '../utils/apiClient';
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { user: authedUser, isAuthenticated } = useAuth();
  const currentUser = authedUser || null;

  // Centralized State
  const [rooms, setRooms] = useState([]);
  const [isRoomsLoading, setIsRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState(null);
  const [isRoomsRealData, setIsRoomsRealData] = useState(false);
  const [notes, setNotes] = useState([]);
  const [isNotesLoading, setIsNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState(null);
  const [isNotesRealData, setIsNotesRealData] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState(null);
  const [isSessionsRealData, setIsSessionsRealData] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [peerMatches, setPeerMatches] = useState([]);
  const [isMatchesLoading, setIsMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState(null);
  const [studyRecommendations, setStudyRecommendations] = useState([]);
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState(null);
  const [matchingStatus, setMatchingStatus] = useState(null);
  const [invitedStudentIds, setInvitedStudentIds] = useState(new Set());
  const [circleMemberIds, setCircleMemberIds] = useState(new Set());
  const [sentPendingRequestIds, setSentPendingRequestIds] = useState(new Set());
  const [receivedPendingRequests, setReceivedPendingRequests] = useState(new Map());
  const [joinedRoomIds, setJoinedRoomIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [lastCompletedSession, setLastCompletedSession] = useState(null);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [isCreateNoteOpen, setIsCreateNoteOpen] = useState(false);
  const [roomFindPartnerTarget, setRoomFindPartnerTarget] = useState(null);
  const [activeRoomForResource, setActiveRoomForResource] = useState(null);

  // Phase 10: Learning DNA & Knowledge Map State
  const [learningDna, setLearningDna] = useState(null);
  const [isDnaLoading, setIsDnaLoading] = useState(false);
  const [dnaError, setDnaError] = useState(null);

  const [knowledgeMap, setKnowledgeMap] = useState(null);
  const [isKnowledgeMapLoading, setIsKnowledgeMapLoading] = useState(false);
  const [knowledgeMapError, setKnowledgeMapError] = useState(null);

  const [knowledgeProgress, setKnowledgeProgress] = useState(null);
  const [isProgressLoading, setIsProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState(null);

  const [learningPaths, setLearningPaths] = useState(null);
  const [isPathsLoading, setIsPathsLoading] = useState(false);
  const [pathsError, setPathsError] = useState(null);

  // Phase 11: Distraction Shield & Focus Mode State
  const [activeFocusInterval, setActiveFocusInterval] = useState(null);
  const [focusIntervalSecondsElapsed, setFocusIntervalSecondsElapsed] = useState(0);
  const [focusIntervalRemainingSeconds, setFocusIntervalRemainingSeconds] = useState(0);
  const [isFocusPaused, setIsFocusPaused] = useState(false);
  const [focusHistory, setFocusHistory] = useState(null);
  const [isFocusHistoryLoading, setIsFocusHistoryLoading] = useState(false);
  const [focusCoachAdvice, setFocusCoachAdvice] = useState(null);
  const [isFocusCoachLoading, setIsFocusCoachLoading] = useState(false);
  const [focusSettings, setFocusSettings] = useState({
    suppressInAppNotifications: true,
    hideNonEssentialNav: true,
    breakRemindersEnabled: true,
    breakIntervalMinutes: 25,
    breakDurationMinutes: 5,
    audioChimeEnabled: false,
  });
  const [isDistractionShieldActive, setIsDistractionShieldActive] = useState(false);
  const [breakReminderAlert, setBreakReminderAlert] = useState(null);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [isDistractionSettingsModalOpen, setIsDistractionSettingsModalOpen] = useState(false);

  // Toast Helper with Distraction Shield Suppression
  const showToast = (message, type = 'success') => {
    // If Distraction Shield is active and user enabled notification suppression,
    // mute non-critical alerts (keep critical security/auth errors)
    if (isDistractionShieldActive && focusSettings?.suppressInAppNotifications && type !== 'error') {
      return;
    }
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 3500);
  };

  const hideToast = () => setToast(null);

  // -------------------------------------------------------------
  // Real Backend Room Synchronization (Phase 6)
  // -------------------------------------------------------------
  const loadRooms = useCallback(async (filters = {}) => {
    setIsRoomsLoading(true);
    setRoomsError(null);
    try {
      const res = await apiClient.getRooms(filters);
      if (res.isAvailable && res.ok && res.data?.success) {
        const fetchedRooms = res.data.data;
        setRooms(fetchedRooms);
        setIsRoomsRealData(true);
        setRoomsError(null);

        // Synchronize joined rooms from real memberships
        const joined = new Set(
          fetchedRooms
            .filter((r) => r.is_member || r.isMember)
            .map((r) => r.id)
        );
        setJoinedRoomIds(joined);
        return { success: true, rooms: fetchedRooms };
      } else if (!res.isAvailable) {
        setRoomsError('Backend server is offline. Please ensure the backend is running.');
        setIsRoomsRealData(false);
        setRooms([]);
        return { success: false, error: 'Backend server offline' };
      } else {
        const msg = res.data?.error?.message || 'Failed to load rooms from server';
        setRoomsError(msg);
        setRooms([]);
        return { success: false, error: msg };
      }
    } catch (err) {
      setRoomsError(err.message || 'An unexpected error occurred while loading topic rooms');
      setRooms([]);
      return { success: false, error: err.message };
    } finally {
      setIsRoomsLoading(false);
    }
  }, []);

  const loadSessions = useCallback(async (filters = {}) => {
    setIsSessionsLoading(true);
    setSessionsError(null);
    try {
      const res = await apiClient.getSessions(filters);
      if (res.ok && res.data?.success) {
        const fetchedSessions = res.data.data;
        setSessions(fetchedSessions);
        setIsSessionsRealData(true);
        setSessionsError(null);

        // Check if there is an active session in local storage or active in list
        const savedActiveId = localStorage.getItem('studysync_active_session_id');
        const activeTarget =
          (savedActiveId && fetchedSessions.find((s) => s.id === savedActiveId)) ||
          fetchedSessions.find((s) => s.status === 'active') ||
          null;

        if (activeTarget) {
          const detailRes = await apiClient.getSessionById(activeTarget.id);
          if (detailRes.ok && detailRes.data?.success) {
            setActiveSession(detailRes.data.data);
          } else {
            setActiveSession(activeTarget);
          }
        } else {
          setActiveSession(null);
        }
        return { success: true, sessions: fetchedSessions };
      } else if (!res.isAvailable) {
        setSessionsError('Backend server is offline. Please ensure the backend is running.');
        setIsSessionsRealData(false);
        setSessions([]);
        return { success: false, error: 'Backend server offline' };
      } else {
        const msg = res.data?.error?.message || 'Failed to load study sessions from server';
        setSessionsError(msg);
        setSessions([]);
        return { success: false, error: msg };
      }
    } catch (err) {
      setSessionsError(err.message || 'An unexpected error occurred while loading study sessions');
      setSessions([]);
      return { success: false, error: err.message };
    } finally {
      setIsSessionsLoading(false);
    }
  }, []);

  // -------------------------------------------------------------
  // Real Backend Notes Synchronization (Phase 8)
  // -------------------------------------------------------------
  const loadNotes = useCallback(async (params = {}) => {
    setIsNotesLoading(true);
    setNotesError(null);
    try {
      const res = await apiClient.getNotes(params);
      if (res.isAvailable && res.ok && res.data?.success) {
        const fetchedNotes = res.data.data;
        setNotes(fetchedNotes);
        setIsNotesRealData(true);
        setNotesError(null);
        return { success: true, notes: fetchedNotes };
      } else if (!res.isAvailable) {
        setNotesError('Backend server is offline. Real notes cannot be retrieved.');
        setIsNotesRealData(false);
        setNotes([]);
        return { success: false, error: 'Backend server offline' };
      } else {
        const msg = res.data?.error?.message || 'Failed to load notes from database';
        setNotesError(msg);
        setNotes([]);
        return { success: false, error: msg };
      }
    } catch (err) {
      setNotesError(err.message || 'An unexpected error occurred while loading notes');
      setNotes([]);
      return { success: false, error: err.message };
    } finally {
      setIsNotesLoading(false);
    }
  }, []);

  // -------------------------------------------------------------
  // Real Intelligent Peer Matching Synchronization (Phase 9)
  // -------------------------------------------------------------
  const loadPeerMatches = useCallback(async (filters = {}) => {
    setIsMatchesLoading(true);
    setMatchesError(null);
    try {
      const res = await apiClient.getPeerMatches(filters);
      if (res.isAvailable && res.ok && res.data?.success) {
        setPeerMatches(res.data.data || []);
        return { success: true, matches: res.data.data };
      } else if (!res.isAvailable) {
        const msg = 'Backend matching service offline';
        setMatchesError(msg);
        return { success: false, error: msg };
      } else {
        const msg = res.data?.error?.message || 'Failed to retrieve peer recommendations';
        setMatchesError(msg);
        return { success: false, error: msg };
      }
    } catch (err) {
      setMatchesError(err.message || 'Error loading peer matches');
      return { success: false, error: err.message };
    } finally {
      setIsMatchesLoading(false);
    }
  }, []);

  // -------------------------------------------------------------
  // Real Personalised Learning Recommendations (Phase 9)
  // -------------------------------------------------------------
  const loadStudyRecommendations = useCallback(async () => {
    setIsRecommendationsLoading(true);
    setRecommendationsError(null);
    try {
      const res = await apiClient.getStudyRecommendations();
      if (res.isAvailable && res.ok && res.data?.success) {
        setStudyRecommendations(res.data.data || []);
        return { success: true, recommendations: res.data.data };
      } else if (!res.isAvailable) {
        const msg = 'Backend recommendation service offline';
        setRecommendationsError(msg);
        return { success: false, error: msg };
      } else {
        const msg = res.data?.error?.message || 'Failed to retrieve recommendations';
        setRecommendationsError(msg);
        return { success: false, error: msg };
      }
    } catch (err) {
      setRecommendationsError(err.message || 'Error loading study recommendations');
      return { success: false, error: err.message };
    } finally {
      setIsRecommendationsLoading(false);
    }
  }, []);

  const dismissRecommendation = async (recId, recType = 'general', targetId = null, trackingId = null) => {
    try {
      setStudyRecommendations((prev) => prev.filter((r) => r.id !== recId));
      await apiClient.recordRecommendationInteraction({
        recommendationId: recId,
        trackingId: trackingId || recId,
        recommendationType: recType,
        targetId: targetId || recId,
        action: 'dismissed',
      });
      showToast('Recommendation dismissed');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const acceptRecommendation = async (recId, recType = 'general', targetId = null, trackingId = null) => {
    try {
      await apiClient.recordRecommendationInteraction({
        recommendationId: recId,
        trackingId: trackingId || recId,
        recommendationType: recType,
        targetId: targetId || recId,
        action: 'accepted',
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const completeRecommendation = async (recId, recType = 'general', targetId = null, trackingId = null) => {
    try {
      await apiClient.recordRecommendationInteraction({
        recommendationId: recId,
        trackingId: trackingId || recId,
        recommendationType: recType,
        targetId: targetId || recId,
        action: 'followed_through',
      });
      setStudyRecommendations((prev) => prev.filter((r) => r.id !== recId));
      showToast('Task marked as completed!');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const blockPeerUser = async (targetUserId) => {
    try {
      const res = await apiClient.blockPeer(targetUserId);
      if (res.ok && res.data?.success) {
        setPeerMatches((prev) => prev.filter((m) => m.studentId !== targetUserId));
        showToast('User blocked from future peer matches');
        return { success: true };
      }
      const msg = res.data?.error?.message || 'Failed to block user';
      showToast(msg, 'error');
      return { success: false, error: msg };
    } catch (err) {
      showToast(err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  // -------------------------------------------------------------
  // Phase 10: Learning DNA & Knowledge Map Actions
  // -------------------------------------------------------------
  const loadLearningDna = useCallback(async () => {
    setIsDnaLoading(true);
    setDnaError(null);
    try {
      const res = await apiClient.getLearningDna();
      if (res.isAvailable && res.ok && res.data?.success) {
        setLearningDna(res.data.data);
        return { success: true, dna: res.data.data };
      } else if (!res.isAvailable) {
        setDnaError('Backend server is offline');
        return { success: false, error: 'Backend server is offline' };
      } else {
        const msg = res.data?.error?.message || 'Failed to load Learning DNA';
        setDnaError(msg);
        return { success: false, error: msg };
      }
    } catch (err) {
      setDnaError(err.message || 'Error loading Learning DNA');
      return { success: false, error: err.message };
    } finally {
      setIsDnaLoading(false);
    }
  }, []);

  const updateLearningDna = async (dnaData) => {
    setIsDnaLoading(true);
    setDnaError(null);
    try {
      const res = await apiClient.updateLearningDna(dnaData);
      if (res.isAvailable && res.ok && res.data?.success) {
        const updated = res.data.data;
        setLearningDna(updated);
        showToast('Learning DNA updated successfully!', 'success');
        // Refresh knowledge map and recommendations to reflect updated DNA
        loadKnowledgeMap();
        loadKnowledgeProgress();
        loadStudyRecommendations();
        return { success: true, dna: updated };
      } else {
        const msg = res.data?.error?.message || 'Failed to update Learning DNA';
        setDnaError(msg);
        showToast(msg, 'error');
        return { success: false, error: msg, details: res.data?.error?.details };
      }
    } catch (err) {
      const msg = err.message || 'Error updating Learning DNA';
      setDnaError(msg);
      showToast(msg, 'error');
      return { success: false, error: msg };
    } finally {
      setIsDnaLoading(false);
    }
  };

  const loadKnowledgeMap = useCallback(async (filters = {}) => {
    setIsKnowledgeMapLoading(true);
    setKnowledgeMapError(null);
    try {
      const res = await apiClient.getKnowledgeMap(filters);
      if (res.isAvailable && res.ok && res.data?.success) {
        setKnowledgeMap(res.data.data);
        return { success: true, map: res.data.data };
      } else if (!res.isAvailable) {
        setKnowledgeMapError('Backend server is offline');
        return { success: false, error: 'Backend server is offline' };
      } else {
        const msg = res.data?.error?.message || 'Failed to load Knowledge Map';
        setKnowledgeMapError(msg);
        return { success: false, error: msg };
      }
    } catch (err) {
      setKnowledgeMapError(err.message || 'Error loading Knowledge Map');
      return { success: false, error: err.message };
    } finally {
      setIsKnowledgeMapLoading(false);
    }
  }, []);

  const loadKnowledgeProgress = useCallback(async () => {
    setIsProgressLoading(true);
    setProgressError(null);
    try {
      const res = await apiClient.getKnowledgeProgress();
      if (res.isAvailable && res.ok && res.data?.success) {
        setKnowledgeProgress(res.data.data);
        return { success: true, progress: res.data.data };
      } else if (!res.isAvailable) {
        setProgressError('Backend server is offline');
        return { success: false, error: 'Backend server is offline' };
      } else {
        const msg = res.data?.error?.message || 'Failed to load progress signals';
        setProgressError(msg);
        return { success: false, error: msg };
      }
    } catch (err) {
      setProgressError(err.message || 'Error loading progress signals');
      return { success: false, error: err.message };
    } finally {
      setIsProgressLoading(false);
    }
  }, []);

  const loadLearningPaths = useCallback(async (subject = null) => {
    setIsPathsLoading(true);
    setPathsError(null);
    try {
      const res = await apiClient.getLearningPaths({ subject });
      if (res.isAvailable && res.ok && res.data?.success) {
        setLearningPaths(res.data.data);
        return { success: true, paths: res.data.data };
      } else {
        const msg = res.data?.error?.message || 'Failed to load learning paths';
        setPathsError(msg);
        return { success: false, error: msg };
      }
    } catch (err) {
      setPathsError(err.message || 'Error loading learning paths');
      return { success: false, error: err.message };
    } finally {
      setIsPathsLoading(false);
    }
  }, []);

  const submitTopicAssessment = async (assessmentData) => {
    try {
      const res = await apiClient.recordTopicAssessment(assessmentData);
      if (res.ok && res.data?.success) {
        const recorded = res.data.data;
        showToast(`Assessment recorded: ${recorded.scorePercentage}% (${recorded.passed ? 'Passed' : 'Needs Practice'})!`, 'success');
        // Refresh knowledge map and progress signals
        loadKnowledgeMap();
        loadKnowledgeProgress();
        loadLearningDna();
        return { success: true, assessment: recorded };
      } else {
        const msg = res.data?.error?.message || 'Failed to record assessment';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
    } catch (err) {
      showToast(err.message || 'Error recording assessment', 'error');
      return { success: false, error: err.message };
    }
  };

  // -------------------------------------------------------------
  // Phase 11: Distraction Shield & Focus Mode (Timer & Actions)
  // -------------------------------------------------------------

  // Real-time wall-clock timer derivation for active focus interval
  useEffect(() => {
    if (!activeFocusInterval) {
      setFocusIntervalSecondsElapsed(0);
      setFocusIntervalRemainingSeconds(0);
      setIsFocusPaused(false);
      return;
    }

    const { started_at, planned_duration_seconds, total_paused_seconds = 0, status, paused_at } = activeFocusInterval;
    const startedMs = new Date(started_at).getTime();
    const plannedSec = planned_duration_seconds || 1500;
    const totalPaused = total_paused_seconds || 0;

    const computeTimers = () => {
      const now = Date.now();
      let elapsed = 0;
      if (status === 'paused' && paused_at) {
        const pausedMs = new Date(paused_at).getTime();
        elapsed = Math.max(0, Math.floor((pausedMs - startedMs) / 1000) - totalPaused);
      } else if (status === 'active') {
        elapsed = Math.max(0, Math.floor((now - startedMs) / 1000) - totalPaused);
      } else if (status === 'completed' || status === 'cancelled') {
        elapsed = activeFocusInterval.actual_duration_seconds || 0;
      }

      const remaining = Math.max(0, plannedSec - elapsed);
      setFocusIntervalSecondsElapsed(elapsed);
      setFocusIntervalRemainingSeconds(remaining);
      setIsFocusPaused(status === 'paused');

      // Trigger break reminder when sprint timer reaches zero
      if (remaining === 0 && status === 'active' && focusSettings.breakRemindersEnabled && !breakReminderAlert) {
        setBreakReminderAlert({
          id: `break-${Date.now()}`,
          intervalId: activeFocusInterval.id,
          topic: activeFocusInterval.topic,
          durationMinutes: focusSettings.breakDurationMinutes || 5,
        });
      }
    };

    computeTimers();

    let ticker = null;
    if (status === 'active') {
      ticker = setInterval(computeTimers, 1000);
    }

    return () => {
      if (ticker) clearInterval(ticker);
    };
  }, [activeFocusInterval, focusSettings.breakRemindersEnabled, focusSettings.breakDurationMinutes, breakReminderAlert]);

  const loadActiveFocus = useCallback(async () => {
    try {
      const res = await apiClient.getActiveFocusInterval();
      if (res.ok && res.data?.success && res.data.data) {
        const interval = res.data.data;
        setActiveFocusInterval(interval);
        setIsDistractionShieldActive(true);
        return interval;
      } else {
        setActiveFocusInterval(null);
        return null;
      }
    } catch {
      setActiveFocusInterval(null);
      return null;
    }
  }, []);

  const loadFocusSettings = useCallback(async () => {
    try {
      const res = await apiClient.getFocusSettings();
      if (res.ok && res.data?.success && res.data.data) {
        setFocusSettings(res.data.data);
        return res.data.data;
      }
    } catch {
      // Keep defaults
    }
  }, []);

  const loadFocusHistory = useCallback(async (params = {}) => {
    setIsFocusHistoryLoading(true);
    try {
      const res = await apiClient.getFocusHistory(params);
      if (res.ok && res.data?.success) {
        setFocusHistory(res.data.data);
        return res.data.data;
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsFocusHistoryLoading(false);
    }
  }, []);

  const loadFocusCoachAdvice = useCallback(async () => {
    setIsFocusCoachLoading(true);
    try {
      const res = await apiClient.getFocusCoachAdvice();
      if (res.ok && res.data?.success) {
        setFocusCoachAdvice(res.data.data);
        return res.data.data;
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsFocusCoachLoading(false);
    }
  }, []);

  const updateFocusSettings = async (newSettings) => {
    try {
      const res = await apiClient.updateFocusSettings(newSettings);
      if (res.ok && res.data?.success) {
        setFocusSettings(res.data.data);
        showToast('Distraction Shield preferences updated');
        return { success: true, settings: res.data.data };
      }
      return { success: false, error: res.data?.error?.message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const startFocus = async (focusData) => {
    try {
      const res = await apiClient.startFocusInterval(focusData);
      if (res.ok && res.data?.success) {
        const interval = res.data.data;
        setActiveFocusInterval(interval);
        setIsDistractionShieldActive(true);
        showToast(`Focus sprint started for ${interval.topic}! Shield active.`);
        return { success: true, interval };
      } else if (res.status === 409) {
        return {
          success: false,
          code: 'ACTIVE_FOCUS_INTERVAL_EXISTS',
          activeInterval: res.data?.error?.activeInterval,
          error: res.data?.error?.message || 'A focus sprint is already in progress',
        };
      }
      const msg = res.data?.error?.message || 'Failed to start focus sprint';
      showToast(msg, 'error');
      return { success: false, error: msg };
    } catch (err) {
      showToast(err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  const pauseFocus = async () => {
    if (!activeFocusInterval?.id) return;
    try {
      const res = await apiClient.pauseFocusInterval(activeFocusInterval.id);
      if (res.ok && res.data?.success) {
        setActiveFocusInterval(res.data.data);
        showToast('Focus sprint paused');
        return { success: true, interval: res.data.data };
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const resumeFocus = async () => {
    if (!activeFocusInterval?.id) return;
    try {
      const res = await apiClient.resumeFocusInterval(activeFocusInterval.id);
      if (res.ok && res.data?.success) {
        setActiveFocusInterval(res.data.data);
        showToast('Focus sprint resumed! Stay in the flow.');
        return { success: true, interval: res.data.data };
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const switchFocusPhase = async (newPhase, completedPhase) => {
    if (!activeFocusInterval?.id) return;
    try {
      const res = await apiClient.updateFocusPhase(activeFocusInterval.id, {
        currentPhase: newPhase,
        completedPhase,
      });
      if (res.ok && res.data?.success) {
        setActiveFocusInterval(res.data.data);
        return { success: true, interval: res.data.data };
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const completeFocus = async (reflectionData = {}) => {
    if (!activeFocusInterval?.id) return;
    try {
      const res = await apiClient.completeFocusInterval(activeFocusInterval.id, reflectionData);
      if (res.ok && res.data?.success) {
        const completed = res.data.data;
        setActiveFocusInterval(null);
        setIsDistractionShieldActive(false);
        showToast(`Study session completed! ${completed.actualDurationMinutes}m recorded.`);
        loadFocusHistory();
        loadFocusCoachAdvice();

        if (focusSettings.breakRemindersEnabled) {
          setBreakReminderAlert({
            id: `break-${Date.now()}`,
            intervalId: completed.id,
            topic: completed.topic,
            durationMinutes: focusSettings.breakDurationMinutes || 5,
          });
        }
        return { success: true, interval: completed };
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const cancelFocus = async (cancelData = {}) => {
    if (!activeFocusInterval?.id) return;
    try {
      const res = await apiClient.cancelFocusInterval(activeFocusInterval.id, cancelData);
      if (res.ok && res.data?.success) {
        setActiveFocusInterval(null);
        setIsDistractionShieldActive(false);
        showToast('Study session ended.');
        loadFocusHistory();
        loadFocusCoachAdvice();
        return { success: true };
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const dismissBreakAlert = () => setBreakReminderAlert(null);
  const toggleDistractionShield = (val) => {
    setIsDistractionShieldActive((prev) => (val !== undefined ? Boolean(val) : !prev));
  };

  useEffect(() => {
    loadRooms();
    loadSessions();
    loadNotes();
    loadStudyRecommendations();
    if (isAuthenticated) {
      loadLearningDna();
      loadKnowledgeMap();
      loadKnowledgeProgress();
      loadLearningPaths();
      loadActiveFocus();
      loadFocusSettings();
      loadFocusHistory();
      loadFocusCoachAdvice();
    }
  }, [
    loadRooms,
    loadSessions,
    loadNotes,
    loadStudyRecommendations,
    loadLearningDna,
    loadKnowledgeMap,
    loadKnowledgeProgress,
    loadLearningPaths,
    loadActiveFocus,
    loadFocusSettings,
    loadFocusHistory,
    loadFocusCoachAdvice,
    isAuthenticated,
  ]);

  const fetchRoomById = useCallback(async (roomId) => {
    if (!roomId) return { success: false, error: 'Room ID is required' };
    try {
      const res = await apiClient.getRoomById(roomId);
      if (res.ok && res.data?.success) {
        const detailed = res.data.data;
        setRooms((prev) => {
          const idx = prev.findIndex((r) => r.id === roomId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...detailed };
            return next;
          }
          return [detailed, ...prev];
        });
        if (detailed.is_member || detailed.isMember) {
          setJoinedRoomIds((prev) => {
            if (prev.has(roomId)) return prev;
            const next = new Set(prev);
            next.add(roomId);
            return next;
          });
        }
        return { success: true, room: detailed };
      }
      return {
        success: false,
        error: res.data?.error?.message || (res.status === 404 ? 'Room not found or no longer available.' : 'Failed to retrieve room details.'),
      };
    } catch (err) {
      return { success: false, error: err.message || 'Unable to connect to study room' };
    }
  }, []);

  // Room Actions (Real persistent database synchronization)
  const createRoom = async (roomData) => {
    try {
      const payload = {
        room_name: roomData.roomName || roomData.room_name || roomData.title,
        subject: roomData.subject,
        topic: roomData.topic,
        description: roomData.description || '',
        room_type: roomData.roomType || roomData.room_type || (roomData.visibility === 'private' ? 'private' : 'Learn Together'),
        status: roomData.status || (roomData.visibility === 'private' ? 'private' : 'active'),
        difficulty: roomData.difficulty || 'Intermediate',
        preferred_languages: Array.isArray(roomData.languages)
          ? roomData.languages
          : [roomData.language || 'English'],
        max_capacity: parseInt(roomData.maxParticipants || roomData.max_capacity, 10) || 8,
      };

      const res = await apiClient.createRoom(payload);

      if (!res.isAvailable) {
        showToast('Backend server is offline. Unable to persist room.', 'error');
        return { success: false, error: 'Backend server is offline' };
      }

      if (!res.ok || !res.data?.success) {
        const errMsg = res.data?.error?.message || 'Failed to create room';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg, details: res.data?.error?.details };
      }

      const createdRoom = res.data.data;
      setRooms((prev) => [createdRoom, ...prev]);
      setJoinedRoomIds((prev) => new Set([...prev, createdRoom.id]));
      showToast(`Room "${createdRoom.title || createdRoom.room_name}" created successfully!`, 'success');
      return { success: true, room: createdRoom };
    } catch (err) {
      const msg = err.message || 'An error occurred creating room';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const joinRoom = async (roomId) => {
    try {
      const res = await apiClient.joinRoom(roomId);

      if (!res.isAvailable) {
        showToast('Backend server is offline. Unable to join room.', 'error');
        return { success: false, error: 'Backend server is offline' };
      }

      if (!res.ok || !res.data?.success) {
        const errMsg = res.data?.error?.message || 'Failed to join room';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }

      const joinResult = res.data.data;
      setJoinedRoomIds((prev) => new Set([...prev, roomId]));

      setRooms((prev) =>
        prev.map((r) => {
          if (r.id === roomId) {
            const updatedCount = joinResult.memberCount !== undefined
              ? joinResult.memberCount
              : ((r.memberCount || 0) + 1);
            return {
              ...r,
              is_member: true,
              isMember: true,
              member_count: updatedCount,
              memberCount: updatedCount,
              activeNowCount: updatedCount,
            };
          }
          return r;
        })
      );

      const target = rooms.find((r) => r.id === roomId);
      showToast(`You joined ${target ? (target.title || target.name) : 'the room'}!`, 'success');
      return { success: true, data: joinResult };
    } catch (err) {
      const msg = err.message || 'Failed to join room';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const joinRoomByCode = async (code) => {
    try {
      const sanitizedCode = (code || '').trim().toUpperCase();
      if (!sanitizedCode) {
        return { success: false, error: 'Please enter a valid room code.' };
      }

      const res = await apiClient.joinRoomByCode(sanitizedCode);

      if (!res.isAvailable) {
        showToast('Backend server is offline. Unable to join room.', 'error');
        return { success: false, error: 'Backend server is offline' };
      }

      if (!res.ok || !res.data?.success) {
        const errMsg = res.data?.error?.message || 'Failed to join room with code';
        return { success: false, error: errMsg, code: res.data?.error?.code };
      }

      const joinResult = res.data.data;
      const room = joinResult.room;

      if (room && room.id) {
        setJoinedRoomIds((prev) => new Set([...prev, room.id]));
        setRooms((prev) => {
          const idx = prev.findIndex((r) => r.id === room.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...room, is_member: true, isMember: true };
            return next;
          }
          return [{ ...room, is_member: true, isMember: true }, ...prev];
        });

        if (joinResult.alreadyMember) {
          showToast(`Welcome back to ${room.title || room.name || room.room_name}!`, 'info');
        } else {
          showToast(`You joined ${room.title || room.name || room.room_name}!`, 'success');
        }
      }

      return { success: true, room, data: joinResult };
    } catch (err) {
      const msg = err.message || 'Failed to join room';
      return { success: false, error: msg };
    }
  };

  const regenerateRoomCode = async (roomId) => {
    try {
      const res = await apiClient.regenerateRoomCode(roomId);
      if (!res.ok || !res.data?.success) {
        const errMsg = res.data?.error?.message || 'Failed to regenerate room code';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }
      const data = res.data.data;
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, room_code: data.room_code, roomCode: data.room_code } : r))
      );
      showToast(`New room code generated: ${data.room_code}`, 'success');
      return { success: true, data };
    } catch (err) {
      const msg = err.message || 'Failed to regenerate room code';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const toggleRoomCodeJoin = async (roomId, enabled = null) => {
    try {
      const res = await apiClient.toggleRoomCodeJoin(roomId, enabled);
      if (!res.ok || !res.data?.success) {
        const errMsg = res.data?.error?.message || 'Failed to update code join settings';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }
      const data = res.data.data;
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, code_join_enabled: data.code_join_enabled, codeJoinEnabled: data.code_join_enabled } : r))
      );
      showToast(
        data.code_join_enabled ? 'Code-based joining enabled' : 'Code-based joining disabled',
        'info'
      );
      return { success: true, data };
    } catch (err) {
      const msg = err.message || 'Failed to update code join settings';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const leaveRoom = async (roomId) => {
    try {
      const res = await apiClient.leaveRoom(roomId);

      if (!res.isAvailable) {
        showToast('Backend server is offline. Unable to leave room.', 'error');
        return { success: false, error: 'Backend server is offline' };
      }

      if (!res.ok || !res.data?.success) {
        const errMsg = res.data?.error?.message || 'Failed to leave room';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }

      const leaveResult = res.data.data;
      setJoinedRoomIds((prev) => {
        const next = new Set(prev);
        next.delete(roomId);
        return next;
      });

      setRooms((prev) =>
        prev.map((r) => {
          if (r.id === roomId) {
            const updatedCount = leaveResult.memberCount !== undefined
              ? leaveResult.memberCount
              : Math.max(0, (r.memberCount || 1) - 1);
            return {
              ...r,
              is_member: false,
              isMember: false,
              member_count: updatedCount,
              memberCount: updatedCount,
              activeNowCount: updatedCount,
            };
          }
          return r;
        })
      );

      const target = rooms.find((r) => r.id === roomId);
      showToast(`You left ${target ? (target.title || target.name) : 'the room'}.`, 'success');
      return { success: true, data: leaveResult };
    } catch (err) {
      const msg = err.message || 'Failed to leave room';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const loadRoomMessages = useCallback(async (roomId, params = {}) => {
    try {
      const res = await apiClient.getRoomMessages(roomId, params);
      if (res.ok && res.data?.success) {
        const msgs = res.data.data;
        setRooms((prev) =>
          prev.map((r) => {
            if (r.id === roomId) {
              return {
                ...r,
                messages: msgs,
              };
            }
            return r;
          })
        );
        return { success: true, messages: msgs, pagination: res.data.pagination };
      }
      return { success: false, error: res.data?.error?.message || 'Failed to load messages' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const addRoomMessage = async (roomId, text, topicTag = null) => {
    if (!text || !text.trim()) return { success: false, error: 'Message content cannot be blank' };
    try {
      const res = await apiClient.sendRoomMessage(roomId, {
        message_content: text.trim(),
        topicTag: topicTag ? topicTag.trim() : null,
      });

      if (res.ok && res.data?.success) {
        const newMessage = res.data.data;
        setRooms((prev) =>
          prev.map((r) => {
            if (r.id === roomId) {
              const prevMsgs = r.messages || [];
              return {
                ...r,
                lastActivity: 'Just now',
                messages: [...prevMsgs, newMessage],
                activityTimeline: [
                  ...(r.activityTimeline || []),
                  {
                    id: `act-${Date.now()}`,
                    text: `${newMessage.sender || 'A member'} posted in discussion`,
                    time: newMessage.time,
                    type: 'message',
                  },
                ],
              };
            }
            return r;
          })
        );
        return { success: true, message: newMessage };
      } else {
        const msg = res.data?.error?.message || 'Failed to send message';
        return { success: false, error: msg };
      }
    } catch (err) {
      return { success: false, error: err.message || 'An error occurred while sending message' };
    }
  };

  const addRoomQuestion = async (roomId, { question, topic }) => {
    if (!question || !question.trim()) return { success: false, error: 'Question content required' };
    try {
      const res = await apiClient.createRoomQuestion(roomId, {
        question_content: question.trim(),
        topic: topic || null,
      });

      if (res.ok && res.data?.success) {
        const newQ = res.data.data;
        setRooms((prev) =>
          prev.map((r) => {
            if (r.id === roomId) {
              return {
                ...r,
                questions: [newQ, ...(r.questions || [])],
              };
            }
            return r;
          })
        );
        showToast('Doubt posted to room questions!', 'success');
        return { success: true, question: newQ };
      } else {
        const msg = res.data?.error?.message || 'Failed to post doubt';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
    } catch (err) {
      const msg = err.message || 'Error posting doubt';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const addRoomQuestionReply = async (roomId, questionId, text) => {
    if (!text || !text.trim()) return { success: false, error: 'Reply text required' };
    try {
      const res = await apiClient.createRoomQuestionReply(roomId, questionId, {
        response_content: text.trim(),
      });

      if (res.ok && res.data?.success) {
        const newReply = res.data.data;
        setRooms((prev) =>
          prev.map((r) => {
            if (r.id === roomId) {
              const updatedQuestions = (r.questions || []).map((q) => {
                if (q.id === questionId) {
                  const responses = [...(q.responses || []), newReply];
                  return {
                    ...q,
                    responses,
                    replyCount: responses.length,
                  };
                }
                return q;
              });
              return { ...r, questions: updatedQuestions };
            }
            return r;
          })
        );
        showToast('Response posted!', 'success');
        return { success: true, reply: newReply };
      } else {
        const msg = res.data?.error?.message || 'Failed to post reply';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
    } catch (err) {
      const msg = err.message || 'Error posting reply';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const toggleResolveQuestion = async (roomId, questionId) => {
    try {
      const res = await apiClient.resolveRoomQuestion(roomId, questionId);
      if (res.ok && res.data?.success) {
        const updated = res.data.data;
        setRooms((prev) =>
          prev.map((r) => {
            if (r.id === roomId) {
              const updatedQuestions = (r.questions || []).map((q) => {
                if (q.id === questionId) {
                  return {
                    ...q,
                    resolved: updated.resolved,
                    is_resolved: updated.is_resolved,
                  };
                }
                return q;
              });
              return { ...r, questions: updatedQuestions };
            }
            return r;
          })
        );
        showToast(updated.resolved ? 'Doubt marked as resolved \u2713' : 'Doubt reopened.', 'success');
        return { success: true, resolved: updated.resolved };
      } else {
        const msg = res.data?.error?.message || 'Failed to update resolution status';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
    } catch (err) {
      const msg = err.message || 'Error updating resolution status';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const addRoomResource = async (roomId, resourceData) => {
    if (!resourceData.title || !resourceData.title.trim()) return { success: false, error: 'Title required' };
    try {
      const res = await apiClient.createRoomResource(roomId, {
        title: resourceData.title.trim(),
        type: resourceData.type || resourceData.resource_type || 'Cheat Sheet',
        resource_type: resourceData.type || resourceData.resource_type || 'Cheat Sheet',
        topic: resourceData.topic || '',
        description: resourceData.description || '',
        url: resourceData.url || resourceData.resource_reference || null,
        resource_reference: resourceData.url || resourceData.resource_reference || null,
      });

      if (res.ok && res.data?.success) {
        const newRes = res.data.data;
        setRooms((prev) =>
          prev.map((r) => {
            if (r.id === roomId) {
              return {
                ...r,
                resources: [newRes, ...(r.resources || [])],
              };
            }
            return r;
          })
        );
        showToast(`Resource "${newRes.title}" shared with the room!`, 'success');
        return { success: true, resource: newRes };
      } else {
        const msg = res.data?.error?.message || 'Failed to share resource';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
    } catch (err) {
      const msg = err.message || 'Error sharing resource';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const deleteRoomResource = async (roomId, resourceId) => {
    try {
      const res = await apiClient.deleteRoomResource(roomId, resourceId);
      if (res.ok && res.data?.success) {
        setRooms((prev) =>
          prev.map((r) => {
            if (r.id === roomId) {
              return {
                ...r,
                resources: (r.resources || []).filter((item) => item.id !== resourceId),
              };
            }
            return r;
          })
        );
        showToast('Resource deleted from room', 'success');
        return { success: true };
      } else {
        const msg = res.data?.error?.message || 'Failed to delete resource';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
    } catch (err) {
      const msg = err.message || 'Error deleting resource';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const startRoomMeeting = async (roomId, meetingData = {}) => {
    try {
      const res = await apiClient.startRoomMeeting(roomId, meetingData);
      if (res.ok && res.data?.success) {
        const updatedRoom = res.data.data;
        setRooms((prev) =>
          prev.map((r) => (r.id === roomId ? { ...r, ...updatedRoom } : r))
        );
        showToast('Virtual study meeting started!', 'success');
        return { success: true, room: updatedRoom };
      } else {
        const msg = res.data?.error?.message || 'Failed to start meeting';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
    } catch (err) {
      const msg = err.message || 'Error starting meeting';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const endRoomMeeting = async (roomId) => {
    try {
      const res = await apiClient.endRoomMeeting(roomId);
      if (res.ok && res.data?.success) {
        const updatedRoom = res.data.data;
        setRooms((prev) =>
          prev.map((r) => (r.id === roomId ? { ...r, ...updatedRoom } : r))
        );
        showToast('Virtual study meeting ended', 'info');
        return { success: true, room: updatedRoom };
      } else {
        const msg = res.data?.error?.message || 'Failed to end meeting';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
    } catch (err) {
      const msg = err.message || 'Error ending meeting';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const joinRoomMeeting = async (roomId) => {
    try {
      const res = await apiClient.joinRoomMeeting(roomId);
      if (res.ok && res.data?.success) {
        const updatedRoom = res.data.data;
        setRooms((prev) =>
          prev.map((r) => (r.id === roomId ? { ...r, ...updatedRoom } : r))
        );
        return { success: true, room: updatedRoom };
      }
      return { success: false, error: res.data?.error?.message || 'Failed to join meeting' };
    } catch (err) {
      return { success: false, error: err.message || 'Error joining meeting' };
    }
  };

  const leaveRoomMeeting = async (roomId) => {
    try {
      const res = await apiClient.leaveRoomMeeting(roomId);
      if (res.ok && res.data?.success) {
        const updatedRoom = res.data.data;
        setRooms((prev) =>
          prev.map((r) => (r.id === roomId ? { ...r, ...updatedRoom } : r))
        );
        showToast('You left the video meeting', 'info');
        return { success: true, room: updatedRoom };
      }
      return { success: false, error: res.data?.error?.message || 'Failed to leave meeting' };
    } catch (err) {
      return { success: false, error: err.message || 'Error leaving meeting' };
    }
  };

  // Note Actions (Persistent)
  const createNote = async (noteData) => {
    try {
      const payload = {
        title: noteData.title,
        content: noteData.content,
        description: noteData.description || '',
        subject: noteData.subject,
        topic: noteData.topic,
        type: noteData.type || 'Lecture Summary',
        resource_type: noteData.type || 'Lecture Summary',
        visibility: noteData.visibility || 'public',
        room_id: noteData.relatedRoomId || noteData.room_id || null,
        session_id: noteData.relatedSessionId || noteData.session_id || null,
        resource_reference: noteData.resource_reference || noteData.url || null,
      };

      const res = await apiClient.createNote(payload);
      if (res.ok && res.data?.success) {
        const newNote = res.data.data;
        setNotes((prev) => [newNote, ...prev]);
        showToast(`Note "${newNote.title}" saved!`, 'success');
        return { success: true, note: newNote };
      } else {
        const msg = res.data?.error?.message || 'Failed to save note';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
    } catch (err) {
      const msg = err.message || 'Error creating note';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const updateNote = async (noteId, noteData) => {
    try {
      const res = await apiClient.updateNote(noteId, noteData);
      if (res.ok && res.data?.success) {
        const updated = res.data.data;
        setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
        if (selectedNote && selectedNote.id === noteId) {
          setSelectedNote(updated);
        }
        showToast(`Note "${updated.title}" updated!`, 'success');
        return { success: true, note: updated };
      } else {
        const msg = res.data?.error?.message || 'Failed to update note';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
    } catch (err) {
      const msg = err.message || 'Error updating note';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const deleteNote = async (noteId) => {
    try {
      const res = await apiClient.deleteNote(noteId);
      if (res.ok && res.data?.success) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        if (selectedNote && selectedNote.id === noteId) {
          setSelectedNote(null);
        }
        showToast('Note deleted successfully', 'success');
        return { success: true };
      } else {
        const msg = res.data?.error?.message || 'Failed to delete note';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
    } catch (err) {
      const msg = err.message || 'Error deleting note';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  // Study Invite Actions
  const sendStudyInvite = (studentId, topic = 'coursework') => {
    setInvitedStudentIds((prev) => {
      const next = new Set(prev);
      next.add(studentId);
      return next;
    });

    const targetStudent = peerMatches.find(
      (m) => m.studentId === studentId || m.userId === studentId || m.id === studentId
    );
    const studentName = targetStudent?.displayName || targetStudent?.name || 'Peer';
    showToast(`Study invitation sent to ${studentName} for ${topic}!`);
  };

  // -------------------------------------------------------------
  // Circle (Learner Relationship System & Connection Requests)
  // -------------------------------------------------------------
  const loadCircleStates = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiClient.getCircleStates();
      if (res.ok && res.data?.data) {
        const { circleIds = [], pendingSentIds = [], pendingReceivedMap = {} } = res.data.data;
        setCircleMemberIds(new Set(circleIds));
        setSentPendingRequestIds(new Set(pendingSentIds));
        setReceivedPendingRequests(new Map(Object.entries(pendingReceivedMap)));
      }
    } catch (err) {
      console.error('Failed to load Circle states:', err);
    }
  }, [isAuthenticated]);

  const loadCircleIds = useCallback(async () => {
    return loadCircleStates();
  }, [loadCircleStates]);

  useEffect(() => {
    if (isAuthenticated) {
      loadCircleStates();
    } else {
      setCircleMemberIds(new Set());
      setSentPendingRequestIds(new Set());
      setReceivedPendingRequests(new Map());
    }
  }, [isAuthenticated, loadCircleStates]);

  const getCircleRelationship = useCallback((memberId) => {
    if (!memberId) return 'add';
    if (circleMemberIds.has(memberId)) return 'in_circle';
    if (sentPendingRequestIds.has(memberId)) return 'pending';
    if (receivedPendingRequests.has(memberId)) return 'accept';
    return 'add';
  }, [circleMemberIds, sentPendingRequestIds, receivedPendingRequests]);

  const sendCircleRequest = async (memberId, memberName = 'Learner') => {
    if (!memberId) return { success: false, error: 'Learner ID required' };
    try {
      const res = await apiClient.sendCircleRequest(memberId);
      if (res.ok && res.data?.data) {
        const result = res.data.data;
        if (result.status === 'in_circle') {
          setCircleMemberIds((prev) => new Set(prev).add(memberId));
          setReceivedPendingRequests((prev) => {
            const next = new Map(prev);
            next.delete(memberId);
            return next;
          });
          showToast(`Connected with ${memberName}!`, 'success');
        } else {
          setSentPendingRequestIds((prev) => new Set(prev).add(memberId));
          showToast(`Circle request sent to ${memberName}!`, 'success');
        }
        return { success: true, status: result.status };
      } else {
        const msg = res.data?.error?.message || res.data?.message || 'Failed to send Circle request';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
    } catch (err) {
      const msg = err.message || 'Error sending Circle request';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const acceptCircleRequest = async (requestIdOrSenderId, memberName = 'Learner') => {
    if (!requestIdOrSenderId) return { success: false, error: 'Request identifier required' };
    try {
      const res = await apiClient.acceptCircleRequest(requestIdOrSenderId);
      if (res.ok && res.data?.data) {
        const memberId = res.data.data.memberId || requestIdOrSenderId;
        setCircleMemberIds((prev) => new Set(prev).add(memberId));
        setReceivedPendingRequests((prev) => {
          const next = new Map(prev);
          next.delete(memberId);
          return next;
        });
        showToast(`Accepted Circle request from ${memberName}!`, 'success');
        return { success: true };
      } else {
        const msg = res.data?.error?.message || res.data?.message || 'Failed to accept request';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
    } catch (err) {
      const msg = err.message || 'Error accepting Circle request';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const declineCircleRequest = async (requestIdOrSenderId, memberName = 'Learner') => {
    if (!requestIdOrSenderId) return { success: false, error: 'Request identifier required' };
    try {
      const res = await apiClient.declineCircleRequest(requestIdOrSenderId);
      if (res.ok) {
        setReceivedPendingRequests((prev) => {
          const next = new Map(prev);
          next.delete(requestIdOrSenderId);
          return next;
        });
        showToast(`Declined Circle request from ${memberName}`, 'neutral');
        return { success: true };
      } else {
        const msg = res.data?.error?.message || res.data?.message || 'Failed to decline request';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
    } catch (err) {
      const msg = err.message || 'Error declining Circle request';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const cancelCircleRequest = async (requestIdOrReceiverId, memberName = 'Learner') => {
    if (!requestIdOrReceiverId) return { success: false, error: 'Request identifier required' };
    try {
      const res = await apiClient.cancelCircleRequest(requestIdOrReceiverId);
      if (res.ok) {
        setSentPendingRequestIds((prev) => {
          const next = new Set(prev);
          next.delete(requestIdOrReceiverId);
          return next;
        });
        showToast(`Cancelled request to ${memberName}`, 'neutral');
        return { success: true };
      } else {
        const msg = res.data?.error?.message || res.data?.message || 'Failed to cancel request';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
    } catch (err) {
      const msg = err.message || 'Error cancelling Circle request';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const addToCircle = async (memberId, memberName = 'Learner') => {
    return sendCircleRequest(memberId, memberName);
  };

  const removeFromCircle = async (memberId, memberName = 'Learner') => {
    if (!memberId) return { success: false, error: 'Learner ID required' };
    try {
      const res = await apiClient.removeFromCircle(memberId);
      if (res.ok) {
        setCircleMemberIds((prev) => {
          const next = new Set(prev);
          next.delete(memberId);
          return next;
        });
        showToast(`Removed ${memberName} from your Circle`, 'neutral');
        return { success: true };
      } else {
        const msg = res.data?.error?.message || res.data?.message || 'Failed to remove from Circle';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
    } catch (err) {
      const msg = err.message || 'Error removing from Circle';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const isMemberInCircle = useCallback((memberId) => {
    return circleMemberIds.has(memberId);
  }, [circleMemberIds]);

  // Session Actions (Real persistent database synchronization)
  const fetchSessionById = async (sessionId) => {
    try {
      const res = await apiClient.getSessionById(sessionId);
      if (res.ok && res.data?.success) {
        const detailed = res.data.data;
        setActiveSession(detailed);
        localStorage.setItem('studysync_active_session_id', sessionId);
        setSessions((prev) => {
          const idx = prev.findIndex((s) => s.id === sessionId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...detailed };
            return next;
          }
          return [detailed, ...prev];
        });
        return { success: true, session: detailed };
      }
      return { success: false, error: res.data?.error?.message || 'Session not found' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const createStudySession = async (sessionData) => {
    try {
      const payload = {
        topic: sessionData.topic,
        subject: sessionData.subject || 'General Study',
        room_id: sessionData.roomId || sessionData.room_id || null,
        title: sessionData.title || `${sessionData.topic} Study Block`,
        description: sessionData.description || '',
        planned_duration: parseInt(sessionData.plannedDuration || sessionData.planned_duration, 10) || 45,
        start_now: sessionData.startNow !== false,
      };

      const res = await apiClient.createSession(payload);
      if (!res.isAvailable) {
        showToast('Backend server is offline', 'error');
        return { success: false, error: 'Backend server offline' };
      }

      if (res.ok && res.data?.success) {
        const created = res.data.data;
        setSessions((prev) => [created, ...prev]);
        setActiveSession(created);
        localStorage.setItem('studysync_active_session_id', created.id);
        showToast(`Study session created for ${created.topic}!`);
        return { success: true, session: created };
      }

      const errMsg = res.data?.error?.message || 'Failed to create study session';
      showToast(errMsg, 'error');
      return { success: false, error: errMsg };
    } catch (err) {
      showToast(err.message || 'An error occurred while creating session', 'error');
      return { success: false, error: err.message };
    }
  };

  const startStudySession = async (sessionId) => {
    try {
      const res = await apiClient.startSession(sessionId);
      if (res.ok && res.data?.success) {
        const started = res.data.data;
        setActiveSession(started);
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, ...started, status: 'active' } : s)));
        showToast(`Focus block started for ${started.topic}!`);
        return { success: true, session: started };
      }
      const msg = res.data?.error?.message || 'Failed to start session';
      showToast(msg, 'error');
      return { success: false, error: msg };
    } catch (err) {
      showToast(err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  const joinStudySession = async (sessionId) => {
    try {
      const res = await apiClient.joinSession(sessionId);
      if (res.ok && res.data?.success) {
        const joined = res.data.data;
        setActiveSession(joined);
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, ...joined } : s)));
        showToast('Joined study session workspace!');
        return { success: true, session: joined };
      }
      const msg = res.data?.error?.message || 'Failed to join session';
      showToast(msg, 'error');
      return { success: false, error: msg };
    } catch (err) {
      showToast(err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  const leaveStudySession = async (sessionId) => {
    try {
      const res = await apiClient.leaveSession(sessionId);
      if (res.ok && res.data?.success) {
        const updated = res.data.data;
        setActiveSession(updated);
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, ...updated } : s)));
        showToast('Left study session. Attendance recorded.');
        return { success: true, session: updated };
      }
      const msg = res.data?.error?.message || 'Failed to leave session';
      showToast(msg, 'error');
      return { success: false, error: msg };
    } catch (err) {
      showToast(err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  const endStudySession = async (sessionId, feedbackData = {}) => {
    try {
      const res = await apiClient.endSession(sessionId);
      if (res.ok && res.data?.success) {
        const summary = res.data.data;

        // Optionally submit feedback if provided
        if (feedbackData?.rating || feedbackData?.reflection) {
          await apiClient.submitSessionFeedback(sessionId, {
            rating: feedbackData.rating,
            reflection: feedbackData.reflection,
          });
        }

        setLastCompletedSession(summary);
        setActiveSession((prev) => (prev.id === sessionId ? { ...prev, status: 'completed' } : prev));
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, status: 'completed', statusLabel: 'Completed' } : s))
        );
        showToast('Session concluded! Review your study summary.');
        return { success: true, summary };
      }
      const msg = res.data?.error?.message || 'Failed to end session';
      showToast(msg, 'error');
      return { success: false, error: msg };
    } catch (err) {
      showToast(err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  const recordSessionFocus = async (sessionId, focusData) => {
    try {
      const res = await apiClient.recordSessionFocus(sessionId, focusData);
      if (res.ok && res.data?.success) {
        setActiveSession(res.data.data);
        return { success: true, session: res.data.data };
      }
      return { success: false, error: res.data?.error?.message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const updateActiveSession = (updates) => {
    setActiveSession((prev) => ({ ...prev, ...updates }));
  };

  const endSession = async (feedbackData) => {
    if (activeSession?.id) {
      return endStudySession(activeSession.id, feedbackData);
    }
    const summary = {
      ...activeSession,
      completedAt: new Date().toISOString(),
      userFeedback: feedbackData?.rating || 'Helpful',
      userReflection: feedbackData?.reflection || '',
      totalMinutes: Math.round((activeSession?.timeElapsedSeconds || 1934) / 60),
    };
    setLastCompletedSession(summary);
    showToast('Session concluded! Review your study summary.');
    return summary;
  };

  const value = useMemo(
    () => ({
      currentUser,
      rooms,
      isRoomsLoading,
      roomsError,
      isRoomsRealData,
      fetchRooms: loadRooms,
      fetchRoomById,
      refreshRooms: loadRooms,
      notes,
      isNotesLoading,
      notesError,
      isNotesRealData,
      loadNotes,
      refreshNotes: loadNotes,
      updateNote,
      deleteNote,
      deleteRoomResource,
      sessions,
      isSessionsLoading,
      sessionsError,
      isSessionsRealData,
      activeSession,
      setActiveSession,
      fetchSessionById,
      loadSessions,
      refreshSessions: loadSessions,
      createStudySession,
      startStudySession,
      joinStudySession,
      leaveStudySession,
      endStudySession,
      recordSessionFocus,
      invitedStudentIds,
      joinedRoomIds,
      toast,
      selectedPartner,
      selectedNote,
      lastCompletedSession,
      peerMatches,
      isMatchesLoading,
      matchesError,
      loadPeerMatches,
      studyRecommendations,
      isRecommendationsLoading,
      recommendationsError,
      loadStudyRecommendations,
      dismissRecommendation,
      acceptRecommendation,
      completeRecommendation,
      blockPeerUser,
      learningDna,
      isDnaLoading,
      dnaError,
      loadLearningDna,
      updateLearningDna,
      knowledgeMap,
      isKnowledgeMapLoading,
      knowledgeMapError,
      loadKnowledgeMap,
      knowledgeProgress,
      isProgressLoading,
      progressError,
      loadKnowledgeProgress,
      learningPaths,
      isPathsLoading,
      pathsError,
      loadLearningPaths,
      submitTopicAssessment,
      activeFocusInterval,
      focusIntervalSecondsElapsed,
      focusIntervalRemainingSeconds,
      isFocusPaused,
      focusHistory,
      isFocusHistoryLoading,
      focusCoachAdvice,
      isFocusCoachLoading,
      loadFocusCoachAdvice,
      focusSettings,
      isDistractionShieldActive,
      breakReminderAlert,
      isFocusModalOpen,
      setIsFocusModalOpen,
      isDistractionSettingsModalOpen,
      setIsDistractionSettingsModalOpen,
      loadActiveFocus,
      loadFocusSettings,
      loadFocusHistory,
      updateFocusSettings,
      startFocus,
      switchFocusPhase,
      pauseFocus,
      resumeFocus,
      completeFocus,
      cancelFocus,
      dismissBreakAlert,
      toggleDistractionShield,
      isCreateRoomOpen,
      setIsCreateRoomOpen,
      isCreateNoteOpen,
      setIsCreateNoteOpen,
      roomFindPartnerTarget,
      setRoomFindPartnerTarget,
      activeRoomForResource,
      setActiveRoomForResource,
      createRoom,
      joinRoom,
      joinRoomByCode,
      regenerateRoomCode,
      toggleRoomCodeJoin,
      leaveRoom,
      startRoomMeeting,
      joinRoomMeeting,
      leaveRoomMeeting,
      endRoomMeeting,
      loadRoomMessages,
      addRoomMessage,
      addRoomQuestion,
      addRoomQuestionReply,
      toggleResolveQuestion,
      addRoomResource,
      createNote,
      sendStudyInvite,
      circleMemberIds,
      sentPendingRequestIds,
      receivedPendingRequests,
      loadCircleIds,
      loadCircleStates,
      getCircleRelationship,
      sendCircleRequest,
      acceptCircleRequest,
      declineCircleRequest,
      cancelCircleRequest,
      addToCircle,
      removeFromCircle,
      isMemberInCircle,
      updateActiveSession,
      endSession,
      showToast,
      hideToast,
      setSelectedPartner,
      setSelectedNote,
      setLastCompletedSession,
    }),
    [
      rooms,
      isRoomsLoading,
      roomsError,
      isRoomsRealData,
      notes,
      isNotesLoading,
      notesError,
      isNotesRealData,
      sessions,
      isSessionsLoading,
      sessionsError,
      isSessionsRealData,
      activeSession,
      peerMatches,
      isMatchesLoading,
      matchesError,
      studyRecommendations,
      isRecommendationsLoading,
      recommendationsError,
      invitedStudentIds,
      circleMemberIds,
      sentPendingRequestIds,
      receivedPendingRequests,
      loadCircleIds,
      loadCircleStates,
      getCircleRelationship,
      isMemberInCircle,
      joinedRoomIds,
      toast,
      selectedPartner,
      selectedNote,
      lastCompletedSession,
      learningDna,
      isDnaLoading,
      dnaError,
      knowledgeMap,
      isKnowledgeMapLoading,
      knowledgeMapError,
      knowledgeProgress,
      isProgressLoading,
      progressError,
      learningPaths,
      isPathsLoading,
      pathsError,
      activeFocusInterval,
      focusIntervalSecondsElapsed,
      focusIntervalRemainingSeconds,
      isFocusPaused,
      focusHistory,
      isFocusHistoryLoading,
      focusSettings,
      isDistractionShieldActive,
      breakReminderAlert,
      isFocusModalOpen,
      isDistractionSettingsModalOpen,
      isCreateRoomOpen,
      isCreateNoteOpen,
      roomFindPartnerTarget,
      activeRoomForResource,
      fetchRoomById,
      loadRooms,
      loadSessions,
      loadNotes,
      loadPeerMatches,
      loadStudyRecommendations,
      loadLearningDna,
      loadKnowledgeMap,
      loadKnowledgeProgress,
      loadLearningPaths,
      loadActiveFocus,
      loadFocusSettings,
      loadFocusHistory,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export default AppContext;
