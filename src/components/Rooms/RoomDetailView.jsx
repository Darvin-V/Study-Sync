import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Badge, Button, Avatar, StatusIndicator, Tabs, EmptyState, LoadingState } from '../UI';
import { CreateSessionModal } from '../Domain';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { ROUTES } from '../../config/routes';
import apiClient from '../../utils/apiClient';
import { AddResourceModal } from './AddResourceModal';
import { RoomFindPartnerModal } from './RoomFindPartnerModal';

function detectProviderFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const lower = url.toLowerCase();
  if (lower.includes('meet.google.com') || lower.includes('google.com/meet')) {
    return 'google_meet';
  }
  if (lower.includes('zoom.us') || lower.includes('zoom.com')) {
    return 'zoom';
  }
  return null;
}

function validateMeetingUrl(url, provider) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { isValid: false, errorMessage: null, sanitizedUrl: '' };
  }

  const trimmed = url.trim();

  // Reject unsafe schemes
  if (/^(javascript|data|vbscript|file|blob):/i.test(trimmed)) {
    return {
      isValid: false,
      errorMessage: 'Unsafe URL protocol. Please enter a valid web meeting link (starting with https:// or http://).',
      sanitizedUrl: '',
    };
  }

  // Must start with http:// or https://
  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      isValid: false,
      errorMessage: 'Meeting link must start with https:// or http://',
      sanitizedUrl: '',
    };
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    if (!host.includes('.') || host.endsWith('.')) {
      return {
        isValid: false,
        errorMessage: 'Please enter a complete meeting URL with a valid domain (e.g. https://meet.google.com/abc-defg-hij)',
        sanitizedUrl: '',
      };
    }

    if (provider === 'google_meet') {
      const isGoogle = host === 'meet.google.com' || host.endsWith('.google.com') || host.endsWith('.meet.app');
      if (!isGoogle) {
        return {
          isValid: false,
          errorMessage: 'Expected a Google Meet URL (e.g. https://meet.google.com/abc-defg-hij). For other services, select "Other Link".',
          sanitizedUrl: parsed.href,
        };
      }
    } else if (provider === 'zoom') {
      const isZoom = host.endsWith('.zoom.us') || host === 'zoom.us' || host.endsWith('.zoom.com') || host === 'zoom.com';
      if (!isZoom) {
        return {
          isValid: false,
          errorMessage: 'Expected a Zoom URL (e.g. https://zoom.us/j/1234567890). For other services, select "Other Link".',
          sanitizedUrl: parsed.href,
        };
      }
    }

    return { isValid: true, errorMessage: null, sanitizedUrl: parsed.href };
  } catch {
    return {
      isValid: false,
      errorMessage: 'Invalid meeting URL. Please check the address and try again.',
      sanitizedUrl: '',
    };
  }
}

/**
 * StudySync RoomDetailView Component
 * Student-first collaborative study environment with real virtual study meeting integration,
 * room chat, shared notes & doubts, and presence.
 */
export function RoomDetailView({ room, onBack, onRoomUpdate }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const convId = searchParams.get('conv');
  const { isAuthenticated } = useAuth();
  const { t } = usePreferences();
  const {
    currentUser,
    notes,
    sessions,
    fetchRoomById,
    joinedRoomIds,
    joinRoom,
    leaveRoom,
    startRoomMeeting,
    joinRoomMeeting,
    leaveRoomMeeting,
    endRoomMeeting,
    addRoomMessage,
    addRoomQuestion,
    addRoomQuestionReply,
    toggleResolveQuestion,
    deleteRoomResource,
    setSelectedPartner,
    setSelectedNote,
    setIsCreateNoteOpen,
    sendStudyInvite,
    regenerateRoomCode,
    toggleRoomCodeJoin,
    showToast,
    setIsFocusModalOpen,
    activeFocusInterval,
  } = useApp();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isRegeneratingCode, setIsRegeneratingCode] = useState(false);
  const [isTogglingCodeJoin, setIsTogglingCodeJoin] = useState(false);


  // Consolidated Tabs: 'discussion' (Meeting & Chat), 'notes' (Notes, Doubts & Resources), 'learners' (Roster & Info)
  const [activeTab, setActiveTab] = useState('discussion');
  const [chatInput, setChatInput] = useState('');
  const [chatTopicTag, setChatTopicTag] = useState('');
  const [isTogglingJoin, setIsTogglingJoin] = useState(false);

  // Persistent Room Messages State
  const [messages, setMessages] = useState(room?.messages || []);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatError, setChatError] = useState(null);
  const messagesScrollRef = useRef(null);

  // -------------------------------------------------------------
  // Virtual Study Meetings State & Actions
  // -------------------------------------------------------------
  const [isMeetingActive, setIsMeetingActive] = useState(Boolean(room?.meeting_active || room?.has_active_meeting));
  const [meetingUrl, setMeetingUrl] = useState(room?.meeting_url || '');
  const [meetingProvider, setMeetingProvider] = useState(room?.meeting_provider || 'jitsi');
  const [meetingStartedAt, setMeetingStartedAt] = useState(room?.meeting_started_at || null);
  const [isStartingMeeting, setIsStartingMeeting] = useState(false);
  const [isJoiningMeeting, setIsJoiningMeeting] = useState(false);
  const [isLeavingMeeting, setIsLeavingMeeting] = useState(false);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);
  const [isUserInCall, setIsUserInCall] = useState(Boolean(room?.is_user_in_meeting));
  const [isConfirmEndOpen, setIsConfirmEndOpen] = useState(false);
  const [connectionState, setConnectionState] = useState('idle'); // 'idle' | 'joining' | 'connected' | 'reconnecting' | 'disconnected'

  // Custom meeting link dialog
  const [isCustomMeetingOpen, setIsCustomMeetingOpen] = useState(false);
  const [customLinkInput, setCustomLinkInput] = useState('');
  const [customProviderInput, setCustomProviderInput] = useState('google_meet');
  const [customLinkError, setCustomLinkError] = useState(null);
  const meetingLinkInputRef = useRef(null);

  useEffect(() => {
    if (isCustomMeetingOpen) {
      setTimeout(() => {
        meetingLinkInputRef.current?.focus();
      }, 50);
    }
  }, [isCustomMeetingOpen]);

  const linkValidation = validateMeetingUrl(customLinkInput, customProviderInput);
  const isLinkValid = linkValidation.isValid;

  const handleLinkChange = (e) => {
    const val = e.target.value;
    setCustomLinkInput(val);
    setCustomLinkError(null);

    const detected = detectProviderFromUrl(val);
    if (detected && detected !== customProviderInput) {
      setCustomProviderInput(detected);
    }
  };

  const handleLinkPaste = (e) => {
    const pasted = e.clipboardData?.getData('text') || '';
    const detected = detectProviderFromUrl(pasted);
    if (detected && detected !== customProviderInput) {
      setCustomProviderInput(detected);
    }
  };

  const handleProviderChange = (e) => {
    setCustomProviderInput(e.target.value);
    setCustomLinkError(null);
  };


  // Sync meeting state from room prop updates
  useEffect(() => {
    if (room?.meeting_active !== undefined) {
      const active = Boolean(room.meeting_active || room.has_active_meeting);
      setIsMeetingActive(active);
      setMeetingUrl(room.meeting_url || '');
      setMeetingProvider(room.meeting_provider || 'jitsi');
      setMeetingStartedAt(room.meeting_started_at || null);
      if (!active) {
        setIsUserInCall(false);
      } else if (room.is_user_in_meeting !== undefined) {
        setIsUserInCall(Boolean(room.is_user_in_meeting));
      }
    }
  }, [room?.meeting_active, room?.meeting_url, room?.meeting_provider, room?.meeting_started_at, room?.has_active_meeting, room?.is_user_in_meeting]);

  // Synchronize initial messages from room prop
  useEffect(() => {
    if (room?.messages && room.messages.length > 0) {
      setMessages(room.messages);
    } else {
      setMessages([]);
    }
  }, [room?.messages]);

  // Polling: retrieve latest persistent messages from backend every 5s while in discussion tab
  useEffect(() => {
    let isMounted = true;
    if (!room?.id) return;

    const fetchMessages = async () => {
      if (document.hidden) return;
      try {
        const res = await apiClient.getRoomMessages(room.id);
        if (isMounted && res.ok && res.data?.success) {
          setMessages(res.data.data);
        }
      } catch {
        // Silently tolerate background polling glitches
      }
    };

    if (activeTab === 'discussion') {
      setIsLoadingMessages(true);
      fetchMessages().finally(() => {
        if (isMounted) setIsLoadingMessages(false);
      });

      const intervalId = setInterval(fetchMessages, 5000);
      return () => {
        isMounted = false;
        clearInterval(intervalId);
      };
    }
  }, [room?.id, activeTab]);

  // Auto-scroll chat to bottom on new message
  useEffect(() => {
    if (activeTab === 'discussion' && messagesScrollRef.current) {
      messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  // -------------------------------------------------------------
  // Integrated Room Focus Timer (Pomodoro)
  // -------------------------------------------------------------
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState('focus'); // 'focus' (25) | 'extended' (45) | 'break' (5)

  useEffect(() => {
    let timerId = null;
    if (isTimerRunning && timerSeconds > 0) {
      timerId = setInterval(() => setTimerSeconds((prev) => prev - 1), 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      if (showToast) showToast('Focus study block completed! Take a quick break.', 'success');
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isTimerRunning, timerSeconds, showToast]);

  const setTimerDuration = (minutes, mode) => {
    setIsTimerRunning(false);
    setTimerMode(mode);
    setTimerSeconds(minutes * 60);
  };

  const formatTimer = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };


  // -------------------------------------------------------------
  // Meeting Handlers
  // -------------------------------------------------------------
  const isMeetingHost = Boolean(
    room?.is_meeting_host ?? (
      room?.can_end_meeting ?? (
        currentUser?.id && isMeetingActive && (
          room?.meeting_host_id
            ? room.meeting_host_id === currentUser.id
            : room?.creator_id === currentUser.id
        )
      )
    )
  );

  const providerLabel = meetingProvider === 'google_meet'
    ? 'Google Meet'
    : meetingProvider === 'zoom'
      ? 'Zoom'
      : meetingProvider === 'jitsi'
        ? 'Jitsi Meet'
        : 'Virtual Call';

  const handleStartInstantMeeting = async () => {
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN);
      return;
    }
    setIsStartingMeeting(true);
    setConnectionState('joining');

    const safeSlug = (room.room_name || room.title || room.id)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 24);
    const jitsiUrl = `https://meet.jit.si/studysync-${safeSlug}-${room.id.slice(-6)}`;

    try {
      const res = await startRoomMeeting(room.id, {
        meeting_url: jitsiUrl,
        meeting_provider: 'jitsi',
      });
      if (res.success) {
        setIsMeetingActive(true);
        setMeetingUrl(jitsiUrl);
        setMeetingProvider('jitsi');
        setMeetingStartedAt(new Date().toISOString());
        setIsUserInCall(true);
        setConnectionState('connected');
        if (res.room) onRoomUpdate?.(res.room);
        try {
          window.open(jitsiUrl, '_blank', 'noopener,noreferrer');
        } catch {}
      } else {
        setConnectionState('disconnected');
      }
    } finally {
      setIsStartingMeeting(false);
    }
  };

  const handleStartCustomMeeting = async (e) => {
    e.preventDefault();
    setCustomLinkError(null);
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN);
      return;
    }

    const validation = validateMeetingUrl(customLinkInput, customProviderInput);
    if (!validation.isValid) {
      setCustomLinkError(validation.errorMessage || 'Please enter a valid meeting URL.');
      return;
    }

    const safeUrl = validation.sanitizedUrl || customLinkInput.trim();
    setIsStartingMeeting(true);

    try {
      const res = await startRoomMeeting(room.id, {
        meeting_url: safeUrl,
        meeting_provider: customProviderInput,
      });

      if (res.success) {
        setIsMeetingActive(true);
        setMeetingUrl(safeUrl);
        setMeetingProvider(customProviderInput);
        setMeetingStartedAt(new Date().toISOString());
        setIsCustomMeetingOpen(false);
        setCustomLinkInput('');
        setIsUserInCall(true);
        setConnectionState('connected');
        if (res.room) onRoomUpdate?.(res.room);
        try {
          window.open(safeUrl, '_blank', 'noopener,noreferrer');
        } catch {
          // Popup blocker fallback — active meeting join button is visible
        }
      } else {
        setCustomLinkError(res.error || 'Failed to save meeting link. Please try again.');
      }
    } catch (err) {
      setCustomLinkError(err.message || 'An error occurred while saving the meeting link.');
    } finally {
      setIsStartingMeeting(false);
    }
  };

  const handleJoinActiveMeeting = async () => {
    if (!meetingUrl) return;
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN);
      return;
    }
    setIsJoiningMeeting(true);
    setConnectionState('joining');
    try {
      const res = await joinRoomMeeting(room.id);
      setIsUserInCall(true);
      setConnectionState('connected');
      if (res.success && res.room) {
        onRoomUpdate?.(res.room);
      }
      try {
        window.open(meetingUrl, '_blank', 'noopener,noreferrer');
      } catch {
        // Safe fallback
      }
    } finally {
      setIsJoiningMeeting(false);
    }
  };

  const handleLeaveMeeting = async () => {
    setIsLeavingMeeting(true);
    try {
      const res = await leaveRoomMeeting(room.id);
      setIsUserInCall(false);
      setConnectionState('disconnected');
      if (res.success && res.room) {
        onRoomUpdate?.(res.room);
      }
    } finally {
      setIsLeavingMeeting(false);
    }
  };

  const handleEndMeeting = async () => {
    setIsEndingMeeting(true);
    try {
      const res = await endRoomMeeting(room.id);
      if (res.success) {
        setIsMeetingActive(false);
        setIsUserInCall(false);
        setMeetingUrl('');
        setConnectionState('disconnected');
        setIsConfirmEndOpen(false);
        if (res.room) onRoomUpdate?.(res.room);
      }
    } finally {
      setIsEndingMeeting(false);
    }
  };

  // Ask a Doubt form state
  const [isAskingDoubt, setIsAskingDoubt] = useState(false);
  const [doubtQuestion, setDoubtQuestion] = useState('');
  const [doubtSubtopic, setDoubtSubtopic] = useState(room?.topic || '');
  const [replyInputs, setReplyInputs] = useState({});

  // Modals
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [isFindPartnerModalOpen, setIsFindPartnerModalOpen] = useState(false);
  const [isCreateSessionModalOpen, setIsCreateSessionModalOpen] = useState(false);

  if (!room) return null;

  const isJoined = joinedRoomIds.has(room.id) || Boolean(room.is_member || room.isMember);
  const isHost = Boolean(currentUser?.id && (room?.creator_id === currentUser.id || room?.creatorId === currentUser.id));
  const roomCode = room?.room_code || room?.roomCode || '';
  const isCodeJoinEnabled = room?.code_join_enabled !== false && room?.codeJoinEnabled !== false;

  const handleCopyCode = async () => {
    if (!roomCode) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(roomCode);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = roomCode;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedCode(true);
      showToast('Room code copied to clipboard!', 'success');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      showToast('Failed to copy room code', 'error');
    }
  };

  const handleShareInvite = async () => {
    if (!roomCode) return;
    const inviteUrl = `${window.location.origin}/rooms?code=${encodeURIComponent(roomCode)}`;
    const shareTitle = `Study Room: ${room?.room_name || room?.title || 'StudySync AI'}`;
    const shareText = `Join my study room "${room?.room_name || room?.title || 'Study Room'}" on StudySync AI! Room Code: ${roomCode}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: inviteUrl,
        });
        showToast('Invite shared successfully!', 'success');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback: Copy invite link directly to clipboard
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = inviteUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedLink(true);
      showToast('Invite link copied to clipboard!', 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      showToast('Failed to copy invite link', 'error');
    }
  };

  const handleRegenerateCode = async () => {
    if (!isHost || isRegeneratingCode) return;
    setIsRegeneratingCode(true);
    try {
      const res = await regenerateRoomCode(room.id);
      if (res && res.success && res.data) {
        if (onRoomUpdate) {
          onRoomUpdate({
            ...room,
            room_code: res.data.room_code,
            roomCode: res.data.room_code,
          });
        }
      }
    } finally {
      setIsRegeneratingCode(false);
    }
  };

  const handleToggleCodeJoin = async () => {
    if (!isHost || isTogglingCodeJoin) return;
    setIsTogglingCodeJoin(true);
    try {
      const nextState = !isCodeJoinEnabled;
      const res = await toggleRoomCodeJoin(room.id, nextState);
      if (res && res.success && res.data) {
        if (onRoomUpdate) {
          onRoomUpdate({
            ...room,
            code_join_enabled: res.data.code_join_enabled,
            codeJoinEnabled: res.data.code_join_enabled,
          });
        }
      }
    } finally {
      setIsTogglingCodeJoin(false);
    }
  };

  const handleToggleJoin = async () => {
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN);
      return;
    }
    setIsTogglingJoin(true);
    try {
      if (isJoined) {
        await leaveRoom(room.id);
      } else {
        await joinRoom(room.id);
      }
    } finally {
      setIsTogglingJoin(false);
    }
  };

  // Filter notes linked to this room
  const roomNotes = notes.filter(
    (n) => n.relatedRoomId === room.id ||
          (n.subject && room.subject && n.subject.toLowerCase() === room.subject.toLowerCase() &&
           n.topic && room.topic && n.topic.toLowerCase().includes(room.topic.toLowerCase()))
  );

  // Filter study sessions linked to this room
  const roomSessions = sessions.filter(
    (s) => s.room_id === room.id || s.roomId === room.id
  );

  // Chat submit with backend persistence
  const handleSendMessage = async (e) => {
    e.preventDefault();
    setChatError(null);

    const trimmedInput = chatInput.trim();
    if (!trimmedInput) {
      setChatError('Please enter a message before sending.');
      return;
    }

    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN, { state: { from: { pathname: `${ROUTES.ROOMS}?room=${room.id}` } } });
      return;
    }

    if (!isJoined && currentUser?.id !== room.creator_id) {
      setChatError('Join this room to send messages in the discussion.');
      return;
    }

    if (isSendingMessage) return;

    setIsSendingMessage(true);
    try {
      const res = await addRoomMessage(room.id, trimmedInput, chatTopicTag.trim() || null);
      if (res.success) {
        setChatInput('');
        setChatTopicTag('');
        setChatError(null);
        if (res.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === res.message.id)) return prev;
            return [...prev, res.message];
          });
        }
      } else {
        setChatError(res.error || 'Failed to send message. Please try again.');
      }
    } catch (err) {
      setChatError(err.message || 'An unexpected error occurred while sending message.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Doubt submit
  const handlePostDoubt = (e) => {
    e.preventDefault();
    if (!doubtQuestion.trim()) return;
    addRoomQuestion(room.id, {
      question: doubtQuestion,
      topic: doubtSubtopic || room.topic,
    });
    setDoubtQuestion('');
    setIsAskingDoubt(false);
  };

  // Reply submit
  const handlePostReply = (qId) => {
    const text = replyInputs[qId];
    if (!text || !text.trim()) return;
    addRoomQuestionReply(room.id, qId, text);
    setReplyInputs((prev) => ({ ...prev, [qId]: '' }));
  };

  const handleOpenResource = (res) => {
    const matchingNote = notes.find((n) => n.id === res.id || n.title.includes(res.title));
    if (matchingNote) {
      setSelectedNote(matchingNote);
    } else {
      setSelectedNote({
        title: res.title,
        subject: room.subject,
        topic: res.topic || room.topic,
        author: room.creator_name || room.creator || 'Scholar',
        authorInitials: (room.creator_name || room.creator || 'S')[0],
        updatedAt: 'Recently',
        type: res.type || 'Resource',
        content: `### Reference: ${res.title}\n\n**Room:** ${room.room_name || room.title}\n**Subject:** ${room.subject}\n**Type:** ${res.type}\n\n${res.description || 'Shared learning resource for this topic room.'}`,
      });
    }
  };

  // 3 Primary Student-First Workspaces
  const viewTabs = [
    { id: 'discussion', label: `${t('room.tab.discussion', 'Study Call & Chat')} (${messages.length})` },
    { id: 'notes', label: `${t('room.tab.notes', 'Notes & Doubts')} (${roomNotes.length + (room.questions?.length || 0)})` },
    { id: 'learners', label: `${t('room.tab.learners', 'Learners')} (${room.members?.length || 1})` },
  ];

  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }} id="room-detail-view">
      {/* 1. Top Navigation & Status */}
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <Button variant="ghost" size="sm" onClick={onBack} id="back-to-rooms-btn">
          &larr; {convId ? t('room.actions.back_to_conv', 'Back to conversation') : t('room.actions.back', 'Back to all topic rooms')}
        </Button>
        <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge variant="accent">{room.roomType || room.room_type || 'Learn Together'}</Badge>
          <Badge variant={room.difficulty === 'Advanced' ? 'warning' : 'neutral'}>
            {room.difficulty || 'Intermediate'}
          </Badge>
          <StatusIndicator
            status={isMeetingActive ? 'active' : 'idle'}
            label={isMeetingActive ? 'Meeting Active' : 'Room Open'}
          />
        </div>
      </div>

      {/* 2. Room Main Header Card */}
      <Card className="stack" style={{ gap: 'var(--space-3)' }} id="room-header-card">
        <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-accent)' }}>
                {room.subject} &bull; {room.topic}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                &bull; {Array.isArray(room.languages) ? room.languages.join(', ') : (room.language || 'English')}
              </span>
            </div>

            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', marginTop: 4 }}>
              {room.title || room.name || room.room_name}
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 4, maxWidth: 720, lineHeight: 1.5 }}>
              {room.description || `Collaborative study room for ${room.subject}: ${room.topic}.`}
            </p>

            <div className="row" style={{ gap: 'var(--space-2)', marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Moderator:</span>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                {room.creator_name || (typeof room.creator === 'string' ? room.creator : room.creator?.name) || 'Anonymous'}
              </span>
              {isJoined && (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-success-bg, rgba(16, 185, 129, 0.1))',
                    color: 'var(--color-success-text, #059669)',
                    border: '1px solid var(--color-success-border, rgba(16, 185, 129, 0.2))',
                    fontWeight: 'var(--font-semibold)',
                  }}
                  id="room-member-badge"
                >
                  Joined Member &bull; Online
                </span>
              )}
            </div>

            {/* Room Code & Invite Strip (Human-readable invite flow) */}
            {roomCode && (
              <div
                id="room-code-invite-panel"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2-5)',
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  marginTop: 'var(--space-2)',
                }}
              >
                <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'var(--color-bg-surface)',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      Code:
                    </span>
                    <span
                      id="room-code-display"
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 700,
                        letterSpacing: '1.2px',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {roomCode}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: isCodeJoinEnabled ? 'var(--color-success-text, #059669)' : 'var(--color-text-muted)',
                      fontWeight: 500,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: isCodeJoinEnabled ? 'var(--color-success, #10b981)' : '#9ca3af',
                      }}
                    />
                    {isCodeJoinEnabled ? 'Joinable' : 'Joining Disabled'}
                  </span>
                </div>

                <div className="row" style={{ gap: 'var(--space-1-5)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    id="btn-copy-room-code"
                    onClick={handleCopyCode}
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    icon={
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    }
                  >
                    {copiedCode ? 'Copied!' : 'Copy Code'}
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    id="btn-share-room-invite"
                    onClick={handleShareInvite}
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    icon={
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                    }
                  >
                    {copiedLink ? 'Link Copied!' : 'Share Invite'}
                  </Button>

                  {isHost && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        id="btn-regenerate-room-code"
                        onClick={handleRegenerateCode}
                        disabled={isRegeneratingCode}
                        style={{ fontSize: '11px', padding: '3px 6px' }}
                        title="Regenerate code"
                      >
                        {isRegeneratingCode ? 'Generating...' : 'Regenerate'}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        id="btn-toggle-code-join"
                        onClick={handleToggleCodeJoin}
                        disabled={isTogglingCodeJoin}
                        style={{
                          fontSize: '11px',
                          padding: '3px 6px',
                          color: isCodeJoinEnabled ? 'var(--color-danger, #ef4444)' : 'var(--color-success, #10b981)',
                        }}
                      >
                        {isTogglingCodeJoin
                          ? 'Updating...'
                          : (isCodeJoinEnabled ? 'Disable Joining' : 'Enable Joining')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Room Actions */}
          <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              variant={isJoined ? 'outline' : 'primary'}
              size="sm"
              id="room-join-toggle-btn"
              disabled={isTogglingJoin || (!isJoined && ((room.memberCount || room.member_count || 1) >= (room.maxCapacity || room.max_capacity || 8)))}
              onClick={handleToggleJoin}
            >
              {isTogglingJoin
                ? (isJoined ? t('room.actions.leaving', 'Leaving...') : t('room.actions.joining', 'Joining...'))
                : (isJoined
                    ? t('room.actions.leave', 'Leave Room')
                    : ((room.memberCount || room.member_count || 1) >= (room.maxCapacity || room.max_capacity || 8))
                      ? 'Room Full'
                      : t('room.actions.join', 'Join Room'))}
            </Button>

            <Button
              variant="outline"
              size="sm"
              id="room-find-partner-btn"
              onClick={() => setIsFindPartnerModalOpen(true)}
            >
              Find Study Partner
            </Button>

            <Button
              variant={activeFocusInterval?.room_id === room.id ? 'primary' : 'outline'}
              size="sm"
              id="room-start-study-sprint-btn"
              onClick={() => {
                if (setIsFocusModalOpen) {
                  setIsFocusModalOpen(true);
                }
              }}
              title="Launch a focused study session for this room topic"
            >
              {activeFocusInterval?.room_id === room.id ? '🎯 Active Study Sprint' : '🎯 Start Study Sprint'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              id="room-quick-doubt-btn"
              onClick={() => {
                setActiveTab('notes');
                setIsAskingDoubt(true);
              }}
            >
              + Ask Doubt
            </Button>
          </div>
        </div>
      </Card>

      {/* 3. Navigation Tabs */}
      <Tabs
        tabs={viewTabs}
        activeTab={activeTab === 'doubts' || activeTab === 'resources' || activeTab === 'sessions' ? 'notes' : activeTab}
        onChange={setActiveTab}
        variant="underline"
        id="room-section-tabs"
      />

      {/* 4. Tab Content Area */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 1.1fr', gap: 'var(--space-4)' }}>
        {/* Left Column */}
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          {/* TAB 1: STUDY CALL & DISCUSSION */}
          {(activeTab === 'discussion' || activeTab === 'workspace') && (
            <div className="stack" style={{ gap: 'var(--space-4)' }}>
              {/* VIRTUAL MEETING HUB */}
              <Card
                style={{
                  border: isMeetingActive
                    ? '2px solid var(--color-success, #10b981)'
                    : '1px solid var(--color-border-subtle)',
                  backgroundColor: isMeetingActive
                    ? 'var(--color-bg-surface)'
                    : 'var(--color-bg-subtle)',
                }}
                className="stack"
                id="room-virtual-meeting-card"
              >
                <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                  <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                    <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: isMeetingActive
                            ? (isUserInCall ? 'var(--color-success, #10b981)' : '#f59e0b')
                            : 'var(--color-text-muted)',
                        }}
                      />
                      <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
                        {isMeetingActive
                          ? (isUserInCall ? 'Virtual Study Meeting (In Call)' : 'Virtual Study Meeting (Live)')
                          : 'Virtual Study Meeting'}
                      </h3>
                      <Badge
                        variant={isMeetingActive ? (isUserInCall ? 'success' : 'neutral') : 'neutral'}
                        id="room-meeting-status-badge"
                      >
                        {isMeetingActive
                          ? (isUserInCall ? `In Call • ${providerLabel}` : `${providerLabel} • Live`)
                          : 'Ready'}
                      </Badge>
                    </div>

                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 6 }}>
                      {isMeetingActive ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ color: 'var(--color-text-primary)' }}>
                            Peer meeting is active via <strong>{providerLabel}</strong>.
                            {Boolean(room.meeting_participant_count && room.meeting_participant_count > 0) && (
                              <span style={{ marginLeft: 8, color: 'var(--color-accent)', fontWeight: 'var(--font-medium)' }}>
                                👥 {room.meeting_participant_count} active in call
                              </span>
                            )}
                          </span>
                          {meetingUrl && (
                            <span
                              id="room-active-meeting-url"
                              style={{
                                wordBreak: 'break-all',
                                overflowWrap: 'anywhere',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '11px',
                                color: 'var(--color-accent)',
                              }}
                            >
                              {meetingUrl}
                            </span>
                          )}
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                            External video runs in an independent tab. StudySync keeps discussion and notes synced here.
                          </span>
                        </div>
                      ) : (
                        <p style={{ margin: 0 }}>
                          Meet with your study partners with video and audio to discuss concepts, solve equations, and review notes.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Primary Meeting Actions */}
                  <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                    {isMeetingActive ? (
                      <>
                        <Button
                          variant={isUserInCall ? 'outline' : 'primary'}
                          size="sm"
                          id="room-join-meeting-btn"
                          disabled={isJoiningMeeting}
                          onClick={handleJoinActiveMeeting}
                          icon={
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="23 7 16 12 23 17 23 7" />
                              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                          }
                        >
                          {isJoiningMeeting ? 'Connecting...' : (isUserInCall ? 'Reopen Call Tab ↗' : 'Join Video Meeting ↗')}
                        </Button>

                        {isUserInCall && (
                          <Button
                            variant="secondary"
                            size="sm"
                            id="room-leave-meeting-btn"
                            disabled={isLeavingMeeting}
                            onClick={handleLeaveMeeting}
                            title="Leave meeting without ending it for other participants"
                          >
                            {isLeavingMeeting ? 'Leaving...' : 'Leave Call'}
                          </Button>
                        )}

                        {isMeetingHost && (
                          <Button
                            variant="ghost"
                            size="sm"
                            id="room-end-meeting-btn"
                            disabled={isEndingMeeting}
                            onClick={handleEndMeeting}
                            style={{ color: 'var(--color-danger, #ef4444)' }}
                            title="End meeting for everyone in this room"
                          >
                            {isEndingMeeting ? 'Ending...' : 'End Call for Everyone'}
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          id="room-start-instant-call-btn"
                          disabled={isStartingMeeting}
                          onClick={handleStartInstantMeeting}
                          icon={
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="23 7 16 12 23 17 23 7" />
                              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                          }
                        >
                          {isStartingMeeting ? 'Starting Call...' : 'Start Free Video Call'}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          id="room-link-external-call-btn"
                          onClick={() => setIsCustomMeetingOpen(true)}
                        >
                          Use Google Meet / Zoom Link
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* External Meeting Link Form */}
                {isCustomMeetingOpen && (
                  <form
                    onSubmit={handleStartCustomMeeting}
                    noValidate
                    id="room-external-meeting-form"
                    style={{
                      marginTop: 'var(--space-3)',
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-base)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-default)',
                    }}
                    className="stack-sm"
                  >
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                      Link an External Virtual Meeting
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
                      Paste your Google Meet, Zoom, or school meeting link so all room learners can join.
                    </p>

                    {(customLinkError || (!linkValidation.isValid && customLinkInput.trim() && linkValidation.errorMessage)) && (
                      <div
                        id="room-meeting-link-error"
                        style={{
                          fontSize: '11px',
                          color: 'var(--color-danger, #ef4444)',
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                        }}
                        role="alert"
                      >
                        ⚠️ {customLinkError || linkValidation.errorMessage}
                      </div>
                    )}

                    {/* Responsive input container: wraps neatly on mobile, wide on desktop */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 'var(--space-2)',
                        alignItems: 'center',
                        width: '100%',
                      }}
                    >
                      <select
                        id="room-meeting-provider-select"
                        className="form-select"
                        value={customProviderInput}
                        onChange={handleProviderChange}
                        style={{
                          width: 'auto',
                          minWidth: 130,
                          fontSize: 'var(--text-xs)',
                          height: 38,
                        }}
                        aria-label="Meeting Platform Provider"
                      >
                        <option value="google_meet">Google Meet</option>
                        <option value="zoom">Zoom</option>
                        <option value="custom">Other Link</option>
                      </select>

                      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                        <input
                          ref={meetingLinkInputRef}
                          id="room-meeting-link-input"
                          type="text"
                          inputMode="url"
                          className="form-input"
                          placeholder={
                            customProviderInput === 'google_meet'
                              ? 'https://meet.google.com/abc-defg-hij'
                              : customProviderInput === 'zoom'
                                ? 'https://zoom.us/j/1234567890'
                                : 'https://teams.microsoft.com/... or https://...'
                          }
                          value={customLinkInput}
                          onChange={handleLinkChange}
                          onPaste={handleLinkPaste}
                          autoComplete="off"
                          spellCheck="false"
                          style={{
                            width: '100%',
                            fontSize: 'var(--text-xs)',
                            height: 38,
                            borderColor: customLinkError || (customLinkInput.trim() && !linkValidation.isValid)
                              ? 'var(--color-danger, #ef4444)'
                              : undefined,
                          }}
                          aria-label="External Meeting URL"
                        />
                      </div>
                    </div>

                    <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-1)' }}>
                      <Button
                        id="room-save-meeting-link-btn"
                        variant="primary"
                        size="sm"
                        type="submit"
                        disabled={!isLinkValid || isStartingMeeting}
                      >
                        {isStartingMeeting ? 'Saving & Starting...' : 'Save & Start'}
                      </Button>
                      <Button
                        id="room-cancel-meeting-link-btn"
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setIsCustomMeetingOpen(false);
                          setCustomLinkError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </Card>

              {/* REAL-TIME DISCUSSION FEED */}
              <Card className="stack" style={{ gap: 'var(--space-3)' }} id="room-discussion-card">
                <div className="row-between">
                  <div>
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                      Room Discussion & Real-time Notes
                    </h3>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Collaborate on formulas, explanations, and key takeaways
                    </p>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-accent)', fontWeight: 'var(--font-medium)' }}>
                    {messages.length} messages
                  </span>
                </div>

                {/* Messages Scroll Area */}
                <div
                  ref={messagesScrollRef}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                    maxHeight: 380,
                    overflowY: 'auto',
                    paddingRight: 4,
                  }}
                >
                  {isLoadingMessages && messages.length === 0 ? (
                    <LoadingState message="Loading discussion messages..." />
                  ) : messages.length > 0 ? (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        style={{
                          padding: '10px 12px',
                          backgroundColor: 'var(--color-bg-subtle)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <div className="row-between" style={{ marginBottom: 4 }}>
                          <div className="row" style={{ gap: 'var(--space-2)' }}>
                            <Avatar name={msg.sender || 'Learner'} initials={msg.initials} size="xs" />
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                              {msg.sender || 'Learner'}
                            </span>
                            {msg.topicTag && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  borderRadius: 'var(--radius-full)',
                                  backgroundColor: 'var(--color-accent-subtle)',
                                  color: 'var(--color-accent-text)',
                                }}
                              >
                                #{msg.topicTag}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                            {msg.time}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                          {msg.text || msg.message_content}
                        </p>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      title="No messages yet"
                      description="Start the discussion by posting a greeting or sharing what you are revising."
                    />
                  )}
                </div>

                {chatError && (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--color-danger-subtle, rgba(239, 68, 68, 0.1))',
                      border: '1px solid var(--color-danger-border, rgba(239, 68, 68, 0.2))',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-danger, #ef4444)',
                      fontSize: 'var(--text-xs)',
                    }}
                    id="room-chat-error-banner"
                  >
                    {chatError}
                  </div>
                )}

                {/* Chat Input Form */}
                <form onSubmit={handleSendMessage} className="stack-sm" style={{ marginTop: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
                  <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      id="room-chat-tag-input"
                      className="form-input"
                      placeholder="Tag (e.g. Proof)"
                      value={chatTopicTag}
                      onChange={(e) => setChatTopicTag(e.target.value)}
                      disabled={isSendingMessage}
                      style={{ fontSize: 'var(--text-xs)', flex: '0 1 120px', minWidth: 80 }}
                    />
                    <input
                      type="text"
                      id="room-chat-input"
                      className="form-input"
                      placeholder={
                        !isAuthenticated
                          ? 'Sign in to join the discussion...'
                          : !isJoined
                          ? 'Join room to post messages...'
                          : 'Type a message or explanation...'
                      }
                      value={chatInput}
                      onChange={(e) => {
                        setChatInput(e.target.value);
                        if (chatError) setChatError(null);
                      }}
                      disabled={isSendingMessage}
                      style={{ fontSize: 'var(--text-xs)', flex: 1 }}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      type="submit"
                      id="room-send-msg-btn"
                      disabled={isSendingMessage || !chatInput.trim()}
                    >
                      {isSendingMessage ? 'Sending...' : 'Send'}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          {/* TAB 2: SHARED NOTES, DOUBTS & RESOURCES */}
          {activeTab === 'notes' && (
            <div className="stack" style={{ gap: 'var(--space-4)' }}>
              {/* Room Notes Section */}
              <Card className="stack" style={{ gap: 'var(--space-3)' }} id="room-notes-view">
                <div className="row-between">
                  <div>
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                      Shared Room Notes ({roomNotes.length})
                    </h3>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Peer summaries and study notes tagged for {room.subject}
                    </p>
                  </div>
                  <Button variant="primary" size="sm" onClick={() => setIsCreateNoteOpen(true)}>
                    + Create Note
                  </Button>
                </div>

                {roomNotes.length > 0 ? (
                  <div className="stack" style={{ gap: 'var(--space-2)' }}>
                    {roomNotes.map((note) => (
                      <div
                        key={note.id}
                        className="row-between"
                        style={{
                          padding: 'var(--space-3)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <div>
                          <div className="row" style={{ gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                              {note.title}
                            </span>
                            <Badge variant="neutral">{note.type || 'Note'}</Badge>
                          </div>
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 2, margin: 0 }}>
                            By {note.author} &bull; {note.updatedAt || 'Recently'}
                          </p>
                        </div>

                        <Button variant="outline" size="sm" onClick={() => setSelectedNote(note)}>
                          Open Note
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No notes linked yet"
                    description="Capture key insights or problem steps into a shared note."
                    action={
                      <Button variant="primary" size="sm" onClick={() => setIsCreateNoteOpen(true)}>
                        Create First Note
                      </Button>
                    }
                  />
                )}
              </Card>

              {/* Doubts and Q&A Section */}
              <Card className="stack" style={{ gap: 'var(--space-3)' }} id="room-doubts-card">
                <div className="row-between">
                  <div>
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                      Doubts & Peer Q&A ({room.questions?.length || 0})
                    </h3>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Post questions and get step-by-step help from peers
                    </p>
                  </div>
                  <Button
                    variant={isAskingDoubt ? 'ghost' : 'outline'}
                    size="sm"
                    onClick={() => setIsAskingDoubt(!isAskingDoubt)}
                  >
                    {isAskingDoubt ? 'Cancel' : '+ Ask Doubt'}
                  </Button>
                </div>

                {/* Ask Doubt Form */}
                {isAskingDoubt && (
                  <form
                    onSubmit={handlePostDoubt}
                    className="stack-sm"
                    style={{
                      padding: 'var(--space-3)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-default)',
                    }}
                  >
                    <label htmlFor="doubt-question-input" style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                      What topic or problem are you stuck on?
                    </label>
                    <textarea
                      id="doubt-question-input"
                      className="form-textarea"
                      placeholder="e.g. How do we derive the time complexity in this algorithm?"
                      value={doubtQuestion}
                      onChange={(e) => setDoubtQuestion(e.target.value)}
                      style={{ fontSize: 'var(--text-xs)', minHeight: 65 }}
                      required
                    />
                    <div className="row-between" style={{ marginTop: 4 }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Subtopic"
                        value={doubtSubtopic}
                        onChange={(e) => setDoubtSubtopic(e.target.value)}
                        style={{ fontSize: 'var(--text-xs)', width: 200 }}
                      />
                      <Button variant="primary" size="sm" type="submit">
                        Post Doubt
                      </Button>
                    </div>
                  </form>
                )}

                {/* Doubts List */}
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  {(room.questions || []).length > 0 ? (
                    room.questions.map((q) => (
                      <div
                        key={q.id}
                        style={{
                          padding: 'var(--space-3)',
                          backgroundColor: 'var(--color-bg-surface)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border-default)',
                        }}
                        className="stack-sm"
                      >
                        <div className="row-between" style={{ alignItems: 'flex-start' }}>
                          <div>
                            <div className="row" style={{ gap: 'var(--space-2)' }}>
                              <Avatar name={q.asker} initials={q.askerInitials || q.asker[0]} size="xs" />
                              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                                {q.asker}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                &bull; {q.time} &bull; {q.topic}
                              </span>
                            </div>
                            <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)', marginTop: 6, lineHeight: 1.4 }}>
                              {q.question}
                            </h4>
                          </div>

                          <div className="row" style={{ gap: 'var(--space-2)' }}>
                            <Badge variant={q.resolved ? 'success' : 'neutral'}>
                              {q.resolved ? 'Resolved \u2713' : 'Open'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              style={{ fontSize: '11px', padding: '2px 8px' }}
                              onClick={() => toggleResolveQuestion(room.id, q.id)}
                            >
                              {q.resolved ? 'Reopen' : 'Mark Resolved'}
                            </Button>
                          </div>
                        </div>

                        {/* Responses */}
                        <div style={{ marginTop: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-2)' }}>
                          <div className="stack-sm" style={{ gap: 'var(--space-2)' }}>
                            {(q.responses || []).map((rep) => (
                              <div
                                key={rep.id}
                                style={{
                                  padding: '8px 10px',
                                  backgroundColor: 'var(--color-bg-subtle)',
                                  borderRadius: 'var(--radius-sm)',
                                  fontSize: 'var(--text-xs)',
                                }}
                              >
                                <div className="row-between" style={{ marginBottom: 2 }}>
                                  <strong style={{ color: 'var(--color-text-primary)' }}>{rep.author}</strong>
                                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{rep.time}</span>
                                </div>
                                <p style={{ margin: 0, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                                  {rep.text}
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* Reply Form */}
                          <div className="row" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Reply with an explanation or answer..."
                              value={replyInputs[q.id] || ''}
                              onChange={(e) => setReplyInputs((prev) => ({ ...prev, [q.id]: e.target.value }))}
                              style={{ fontSize: 'var(--text-xs)', flex: 1 }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handlePostReply(q.id);
                                }
                              }}
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handlePostReply(q.id)}
                            >
                              Reply
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      title="No doubts posted yet"
                      description="Stuck on a tricky concept? Ask your peers for a clear explanation."
                      action={
                        <Button variant="primary" size="sm" onClick={() => setIsAskingDoubt(true)}>
                          Ask the First Question
                        </Button>
                      }
                    />
                  )}
                </div>
              </Card>

              {/* Shared Resources Section */}
              <Card className="stack" style={{ gap: 'var(--space-3)' }} id="room-resources-view">
                <div className="row-between">
                  <div>
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                      Shared Learning Resources ({room.resources?.length || 0})
                    </h3>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Cheat sheets, reference links, and study materials
                    </p>
                  </div>
                  <Button variant="primary" size="sm" onClick={() => setIsResourceModalOpen(true)}>
                    + Share Resource
                  </Button>
                </div>

                {(room.resources || []).length > 0 ? (
                  <div className="stack" style={{ gap: 'var(--space-2)' }}>
                    {room.resources.map((res) => (
                      <div
                        key={res.id}
                        className="row-between"
                        style={{
                          padding: 'var(--space-3)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border-subtle)',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div>
                          <div className="row" style={{ gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                              {res.title}
                            </span>
                            <Badge variant="accent">{res.type}</Badge>
                          </div>
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 4, margin: 0, lineHeight: 1.4 }}>
                            {res.description}
                          </p>
                          {res.author && (
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 4 }}>
                              Shared by: <strong>{res.author}</strong>
                            </div>
                          )}
                        </div>

                        <div className="row" style={{ gap: 'var(--space-2)' }}>
                          {(currentUser?.id === res.author_id || currentUser?.id === room.creator_id) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              style={{ color: 'var(--color-danger, #ef4444)', fontSize: '11px', padding: '2px 8px' }}
                              onClick={() => deleteRoomResource(room.id, res.id)}
                            >
                              Delete
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleOpenResource(res)}>
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No resources shared yet"
                    description="Share formulas, practice questions, or handouts with your peers in this room."
                    action={
                      <Button variant="primary" size="sm" onClick={() => setIsResourceModalOpen(true)}>
                        Share a Resource
                      </Button>
                    }
                  />
                )}
              </Card>
            </div>
          )}

          {/* TAB 3: LEARNERS & DETAILS */}
          {activeTab === 'learners' && (
            <div className="stack" style={{ gap: 'var(--space-4)' }}>
              <Card className="stack" style={{ gap: 'var(--space-3)' }} id="room-learners-roster">
                <div className="row-between">
                  <div>
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                      Learners in Room ({room.members?.length || 1})
                    </h3>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Active learners studying {room.topic}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsFindPartnerModalOpen(true)}>
                    + Invite More Learners
                  </Button>
                </div>

                <div className="stack" style={{ gap: 'var(--space-2)' }}>
                  {(room.members || []).map((m) => (
                    <div
                      key={m.id}
                      className="row-between"
                      style={{
                        padding: '10px 12px',
                        backgroundColor: 'var(--color-bg-subtle)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-subtle)',
                        alignItems: 'center',
                      }}
                    >
                      <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
                        <Avatar name={m.name} initials={m.initials} size="sm" />
                        <div>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                            {m.name} {m.id === currentUser?.id ? '(You)' : ''}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {m.membership_role === 'creator' ? 'Room Moderator' : 'Study Member'} &bull; Level: {m.learningLevel || 'Intermediate'}
                          </div>
                        </div>
                      </div>

                      {m.id !== currentUser?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => sendStudyInvite(m.id, room.topic)}
                        >
                          Invite to Pair
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Room Overview & Syllabus Context */}
              <Card className="stack-sm" style={{ gap: 'var(--space-2)' }}>
                <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                  Room Objectives & Learning Guidelines
                </h4>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                  <p><strong>Goal:</strong> {room.learningGoal || `Master ${room.topic} through active collaborative problem solving.`}</p>
                  <p><strong>Subject:</strong> {room.subject}</p>
                  <p><strong>Topic:</strong> {room.topic}</p>
                  <p><strong>Education Stage:</strong> {room.education_stage || room.educationStage || 'Any educational stage'}</p>
                  <p><strong>Capacity:</strong> {room.memberCount || room.member_count || 1} / {room.maxCapacity || room.max_capacity || 8} students</p>
                  {roomCode && (
                    <>
                      <p><strong>Room Code:</strong> <span id="info-panel-room-code" style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '1px' }}>{roomCode}</span></p>
                      <p><strong>Code Joining:</strong> {isCodeJoinEnabled ? 'Enabled' : 'Disabled by Host'}</p>
                    </>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Right Column: Focus Timer, Active Learners & Quick Doubts */}
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          {/* Integrated Room Focus Timer Widget */}
          <Card className="stack-sm" id="room-focus-timer-card">
            <div className="row-between" style={{ alignItems: 'center' }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                Study Session Timer
              </h3>
              <Badge variant={isTimerRunning ? 'success' : 'neutral'}>
                {isTimerRunning ? 'Running' : 'Paused'}
              </Badge>
            </div>

            <div style={{ textAlign: 'center', padding: 'var(--space-3) 0' }}>
              <div style={{ fontSize: '36px', fontWeight: 'var(--font-bold)', fontFamily: 'monospace', color: 'var(--color-text-primary)', letterSpacing: 2 }}>
                {formatTimer(timerSeconds)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 4 }}>
                {timerMode === 'focus' ? '25-minute Pomodoro Block' : timerMode === 'extended' ? '45-minute Deep Work' : '5-minute Quick Rest'}
              </div>
            </div>

            <div className="row" style={{ gap: 'var(--space-2)', justifyContent: 'center' }}>
              <Button
                variant={isTimerRunning ? 'warning' : 'primary'}
                size="sm"
                onClick={() => setIsTimerRunning(!isTimerRunning)}
              >
                {isTimerRunning ? 'Pause Timer' : 'Start Focus'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTimerDuration(timerMode === 'extended' ? 45 : timerMode === 'break' ? 5 : 25, timerMode)}
              >
                Reset
              </Button>
            </div>

            <div className="row" style={{ gap: 'var(--space-1)', marginTop: 'var(--space-2)', justifyContent: 'center' }}>
              <Button
                variant={timerMode === 'focus' ? 'secondary' : 'ghost'}
                size="sm"
                style={{ fontSize: '11px', padding: '2px 8px' }}
                onClick={() => setTimerDuration(25, 'focus')}
              >
                25m Focus
              </Button>
              <Button
                variant={timerMode === 'extended' ? 'secondary' : 'ghost'}
                size="sm"
                style={{ fontSize: '11px', padding: '2px 8px' }}
                onClick={() => setTimerDuration(45, 'extended')}
              >
                45m Deep
              </Button>
              <Button
                variant={timerMode === 'break' ? 'secondary' : 'ghost'}
                size="sm"
                style={{ fontSize: '11px', padding: '2px 8px' }}
                onClick={() => setTimerDuration(5, 'break')}
              >
                5m Break
              </Button>
            </div>
          </Card>

          {/* Active Members Mini-Roster */}
          <Card className="stack-sm" id="room-active-learners-card">
            <div className="row-between">
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                Active Members ({room.members?.length || 1})
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--color-success, #10b981)', fontWeight: '600' }}>
                Online
              </span>
            </div>

            <div className="stack-sm" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
              {(room.members || []).map((m) => (
                <div
                  key={m.id}
                  className="row-between"
                  style={{
                    padding: '6px 8px',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    alignItems: 'center',
                  }}
                >
                  <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                    <Avatar name={m.name} initials={m.initials} size="xs" />
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)' }}>
                        {m.name} {m.id === currentUser?.id ? '(You)' : ''}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                        {m.task || 'Studying'}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--color-accent)' }}>
                    {m.membership_role === 'creator' ? 'Mod' : 'Member'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Modals for Room Actions */}
      <AddResourceModal
        room={room}
        isOpen={isResourceModalOpen}
        onClose={() => setIsResourceModalOpen(false)}
      />

      <RoomFindPartnerModal
        room={room}
        isOpen={isFindPartnerModalOpen}
        onClose={() => setIsFindPartnerModalOpen(false)}
      />

      <CreateSessionModal
        isOpen={isCreateSessionModalOpen}
        onClose={() => setIsCreateSessionModalOpen(false)}
        initialRoom={room}
      />
    </div>
  );
}

export default RoomDetailView;
