import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Section,
  Card,
  Button,
  Badge,
  Avatar,
  StatusIndicator,
  Tabs,
  Modal,
  StudySessionCard,
  CreateSessionModal,
  FocusHistoryWidget,
  PeerFeedbackModal,
  AIFocusCoachCard,
  PlatformNotificationInfoModal,
  ShieldIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
  LogOutIcon,
} from '../components';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { ROUTES } from '../config/routes';

/**
 * StudySync Sessions Page (Phase 7 Updated)
 * Persistent study sessions, server-authoritative timer synchronization,
 * separate individual participation tracking, and post-session summaries.
 */
export function Sessions() {
  const navigate = useNavigate();
  const { t } = usePreferences();
  const { user, isAuthenticated } = useAuth();
  const {
    activeSession,
    sessions,
    isSessionsLoading,
    sessionsError,
    loadSessions,
    fetchSessionById,
    startStudySession,
    joinStudySession,
    leaveStudySession,
    endStudySession,
    recordSessionFocus,
    setSelectedNote,
    showToast,
    activeFocusInterval,
    focusIntervalRemainingSeconds,
    isFocusPaused,
    isDistractionShieldActive,
    setIsFocusModalOpen,
    setIsDistractionSettingsModalOpen,
    startFocus,
    pauseFocus,
    resumeFocus,
    completeFocus,
    cancelFocus,
    toggleDistractionShield,
    focusCoachAdvice,
    loadFocusCoachAdvice,
  } = useApp();

  const [activeTab, setActiveTab] = useState('notes');
  const [isPlatformLimitationsOpen, setIsPlatformLimitationsOpen] = useState(false);
  const [scratchpadText, setScratchpadText] = useState(activeSession?.sharedNotesSnippet || '');
  const [agendaItems, setAgendaItems] = useState(activeSession?.agenda || []);
  const [questionList, setQuestionList] = useState(activeSession?.questions || []);
  const [newQuestionText, setNewQuestionText] = useState('');

  // Status Filter for session calendar list
  const [sessionFilter, setSessionFilter] = useState('all'); // 'all' | 'active' | 'scheduled' | 'completed'

  // Modal controls
  const [isCreateSessionModalOpen, setIsCreateSessionModalOpen] = useState(false);
  const [isEndSessionModalOpen, setIsEndSessionModalOpen] = useState(false);
  const [summaryModalSession, setSummaryModalSession] = useState(null);

  // End session feedback state
  const [feedbackRating, setFeedbackRating] = useState('Very helpful');
  const [learnedReflection, setLearnedReflection] = useState('');
  const [isSubmittingEnd, setIsSubmittingEnd] = useState(false);
  const [peerToReview, setPeerToReview] = useState(null);
  const [peerFeedbackSessionId, setPeerFeedbackSessionId] = useState(null);
  const [reviewedPeers, setReviewedPeers] = useState({});

  // Individual status state for current user
  const [myStatus, setMyStatus] = useState('Focused');
  const [myFocusMinutes, setMyFocusMinutes] = useState(0);

  // Server-Authoritative Timer State
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Synchronize workspace texts whenever active session changes
  useEffect(() => {
    if (activeSession) {
      if (activeSession.sharedNotesSnippet !== undefined) {
        setScratchpadText(activeSession.sharedNotesSnippet);
      }
      if (activeSession.agenda) {
        setAgendaItems(activeSession.agenda);
      }
      if (activeSession.questions) {
        setQuestionList(activeSession.questions);
      } else {
        setQuestionList([]);
      }

      // Check current user's recorded status in participant list
      if (activeSession.participants && user) {
        const me = activeSession.participants.find((p) => p.user_id === user.id);
        if (me) {
          setMyStatus(me.status || me.participation_status || 'Focused');
          setMyFocusMinutes(me.recorded_study_minutes || me.attendance_minutes || 0);
        }
      }
    }
  }, [activeSession, user]);

  // Server-authoritative timer recovery
  useEffect(() => {
    if (!activeSession) return;

    const startTs = activeSession.actual_start_at || activeSession.start_at;
    const calculateElapsed = () => {
      if (!startTs) return activeSession.timeElapsedSeconds || 0;

      if (activeSession.status === 'completed') {
        const endTs = activeSession.actual_end_at || activeSession.end_at || new Date().toISOString();
        return Math.max(0, Math.floor((new Date(endTs).getTime() - new Date(startTs).getTime()) / 1000));
      }

      if (activeSession.status === 'active') {
        return Math.max(0, Math.floor((Date.now() - new Date(startTs).getTime()) / 1000));
      }

      return 0;
    };

    setSecondsElapsed(calculateElapsed());

    let interval = null;
    if (activeSession.status === 'active' && isTimerRunning) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => {
          const next = prev + 1;
          if (next % 60 === 0) {
            setMyFocusMinutes((m) => m + 1);
          }
          return next;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSession?.id, activeSession?.status, activeSession?.actual_start_at, activeSession?.actual_end_at, isTimerRunning]);

  const formatTimer = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Participant checks
  const isParticipant = useMemo(() => {
    if (!activeSession || !user) return false;
    return (
      activeSession.participants?.some((p) => p.user_id === user.id && p.is_active !== false) ||
      Boolean(activeSession.is_participant)
    );
  }, [activeSession, user]);

  const isCreator = useMemo(() => {
    if (!activeSession || !user) return false;
    return activeSession.creator_id === user.id || Boolean(activeSession.is_creator);
  }, [activeSession, user]);

  // Session lifecycle action handlers
  const handleStartSession = async () => {
    if (!activeSession) return;
    await startStudySession(activeSession.id);
  };

  const handleJoinSession = async () => {
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN);
      return;
    }
    if (!activeSession) return;
    await joinStudySession(activeSession.id);
  };

  const handleLeaveSession = async () => {
    if (!activeSession) return;
    await leaveStudySession(activeSession.id);
  };

  const handleOpenEndSession = () => {
    setIsTimerRunning(false);
    setSummaryModalSession(activeSession);
    setIsEndSessionModalOpen(true);
  };

  const handleConfirmEndSession = async () => {
    if (!activeSession) return;
    setIsSubmittingEnd(true);
    try {
      const res = await endStudySession(activeSession.id, {
        rating: feedbackRating,
        reflection: learnedReflection,
      });
      if (res.success) {
        setSummaryModalSession(res.summary);
      }
    } finally {
      setIsSubmittingEnd(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setMyStatus(newStatus);
    if (activeSession?.id && isParticipant) {
      await recordSessionFocus(activeSession.id, {
        status: newStatus,
        focusMinutes: myFocusMinutes,
      });
    }
  };

  const handleToggleAgenda = (index) => {
    setAgendaItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, completed: !item.completed } : item))
    );
  };

  const handlePostQuestion = (e) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;

    const newQ = {
      id: `q-${Date.now()}`,
      author: user?.displayName ? `${user.displayName} (You)` : 'You',
      question: newQuestionText.trim(),
      answer: 'Peers notified in discussion queue.',
      resolved: false,
    };

    setQuestionList((prev) => [...prev, newQ]);
    setNewQuestionText('');
    showToast('Question added to study queue');
  };

  // Filtered session calendar list
  const filteredSessions = useMemo(() => {
    if (sessionFilter === 'all') return sessions;
    return sessions.filter((s) => s.status?.toLowerCase() === sessionFilter);
  }, [sessions, sessionFilter]);

  const workspaceTabs = [
    { id: 'notes', label: 'Shared Notes', domId: 'btn-share-notes' },
    { id: 'agenda', label: 'Session Agenda', domId: 'btn-agenda' },
    { id: 'questions', label: 'Doubt & Question Queue', domId: 'btn-ask-doubt' },
    { id: 'resources', label: 'Resources', domId: 'btn-resources' },
    { id: 'focus_shield', label: 'Focus Shield', domId: 'btn-tab-focus-shield' },
  ];

  const plannedMins = activeSession?.planned_duration || 45;
  const timeTotalFormatted = `${plannedMins}:00`;
  const isSessionConcluded = activeSession?.status === 'completed';

  return (
    <div className="stack" style={{ gap: 'var(--space-6)' }} id="sessions-page">
      {/* 1. Page Header */}
      <header className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }} id="sessions-page-header">
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
            {t('sessions.title', 'Study Sessions')}
          </h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {t('sessions.subtitle', 'Real-time peer collaborative session with individual focus tracking and shared notes.')}
          </p>
        </div>

        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Badge variant={isSessionConcluded ? 'neutral' : activeSession?.status === 'scheduled' ? 'warning' : 'success'} dot={activeSession?.status === 'active'}>
            {isSessionConcluded ? 'Session Concluded' : activeSession?.status === 'scheduled' ? 'Scheduled Block' : 'Live Focus Block'}
          </Badge>

          <Button
            variant="primary"
            size="sm"
            id="btn-create-session-header"
            onClick={() => setIsCreateSessionModalOpen(true)}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
          >
            {t('sessions.createBtn', 'Schedule Study Session')}
          </Button>
        </div>
      </header>

      {/* Backend Offline / Error Banner */}
      {sessionsError && (
        <div
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-danger, #ef4444)',
          }}
          className="row-between"
          id="sessions-error-banner"
        >
          <div>
            <strong>Error Loading Study Sessions:</strong> {sessionsError}
          </div>
          <Button variant="outline" size="sm" onClick={() => loadSessions()}>
            Retry
          </Button>
        </div>
      )}

      {/* 2. Active Focus Workspace */}
      {activeSession ? (
        <Card id="active-session-workspace" className="stack" style={{ gap: 'var(--space-4)', padding: 'var(--space-6)' }}>
          {/* Workspace Top Header: Topic, Participants, Status */}
          <div className="row-between" style={{ flexWrap: 'wrap', gap: 'var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-4)' }}>
            <div>
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-accent)' }}>
                  {activeSession.subject || 'Computer Science'}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>&bull;</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  {activeSession.currentInterval || `Focus Block (${plannedMins}m planned)`}
                </span>
                {activeSession.room_name && (
                  <>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>&bull;</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      Room: {activeSession.room_name}
                    </span>
                  </>
                )}
              </div>

              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', marginTop: 2 }}>
                {activeSession.topic}
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {activeSession.title || activeSession.subtopic || activeSession.description || 'Collaborative study block'} &bull; {activeSession.participants?.length || 1} participant{(activeSession.participants?.length || 1) > 1 ? 's' : ''} enrolled
              </p>
            </div>

            {/* Timer & Controls */}
            <div className="row" style={{ gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 'var(--font-bold)',
                    color: 'var(--color-text-primary)',
                    letterSpacing: '0.02em',
                  }}
                  id="workspace-timer-display"
                >
                  {formatTimer(secondsElapsed)}
                  <span style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)', fontWeight: 'normal' }}>
                    &nbsp;/ {timeTotalFormatted}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {isSessionConcluded
                    ? 'Session concluded'
                    : isTimerRunning
                    ? 'Server-authoritative timer ticking'
                    : 'Timer paused'} &bull; Individual durations below
                </div>
              </div>

              <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {/* 1. Accessible Focus Mode Toggle (Independent of Study Timer) */}
                <Button
                  variant={activeFocusInterval ? 'primary' : 'outline'}
                  size="sm"
                  id="btn-session-focus-toggle"
                  onClick={() => {
                    if (activeFocusInterval) {
                      completeFocus();
                    } else {
                      startFocus({
                        topic: activeSession.topic,
                        sessionId: activeSession.id,
                        plannedDurationMinutes: focusCoachAdvice?.pacingRecommendation?.recommendedSprintMinutes || 25,
                      });
                    }
                  }}
                  title={activeFocusInterval ? 'Focus Mode is Active (Click to finish interval)' : 'Turn On Focus Mode (Sprint duration runs independently of session timer)'}
                  icon={<ShieldIcon size={14} />}
                >
                  {activeFocusInterval
                    ? `🎯 Focus Mode: ON (${Math.floor(focusIntervalRemainingSeconds / 60)}:${String(focusIntervalRemainingSeconds % 60).padStart(2, '0')})`
                    : '🎯 Focus Mode: OFF'}
                </Button>

                {/* If Focus Mode is running, provide Sprint Pause/Resume & In-App Notification Mute */}
                {activeFocusInterval && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      id="btn-session-focus-pause"
                      onClick={() => (isFocusPaused ? resumeFocus() : pauseFocus())}
                      title={isFocusPaused ? 'Resume Focus Sprint' : 'Pause Focus Sprint'}
                    >
                      {isFocusPaused ? '▶ Resume Focus' : '⏸ Pause Focus'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      id="btn-session-shield-toggle"
                      onClick={() => toggleDistractionShield()}
                      title="Pause or resume nonessential StudySync-generated in-app notifications"
                    >
                      {isDistractionShieldActive ? '🔕 In-App Alerts Muted' : '🔔 Alerts Active'}
                    </Button>
                  </>
                )}

                {/* Platform Notification Capabilities & Limitations Info */}
                <Button
                  variant="ghost"
                  size="sm"
                  id="btn-platform-info"
                  onClick={() => setIsPlatformLimitationsOpen(true)}
                  title="View browser & Android notification capabilities and DND guide"
                >
                  ℹ️ Notification Guide
                </Button>

                {/* Start Session Button (if scheduled and creator) */}
                {activeSession.status === 'scheduled' && isCreator && (
                  <Button variant="primary" size="sm" id="btn-start-scheduled-session" onClick={handleStartSession}>
                    Start Focus Block
                  </Button>
                )}

                {/* Join Session Button (if not participant and not concluded) */}
                {!isParticipant && !isSessionConcluded && (
                  <Button variant="primary" size="sm" id="btn-join-session" onClick={handleJoinSession}>
                    Join Session
                  </Button>
                )}

                {/* Leave Session Button (if participant and active) */}
                {isParticipant && !isSessionConcluded && (
                  <Button variant="outline" size="sm" id="btn-leave-session" onClick={handleLeaveSession} icon={<LogOutIcon size={13} />}>
                    Leave Session
                  </Button>
                )}

                {/* Pause/Resume Local Timer Button (Independent of Focus Mode) */}
                {!isSessionConcluded && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                    id="btn-toggle-timer"
                    icon={isTimerRunning ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
                  >
                    {isTimerRunning ? 'Pause Session' : 'Resume Session'}
                  </Button>
                )}

                {/* End Session Button (Creator only) */}
                {isCreator && !isSessionConcluded && (
                  <Button
                    variant="danger-outline"
                    size="sm"
                    id="btn-end-session"
                    onClick={handleOpenEndSession}
                  >
                    End Session
                  </Button>
                )}

                {/* Concluded Summary Action */}
                {isSessionConcluded && (
                  <Button
                    variant="outline"
                    size="sm"
                    id="btn-view-concluded-summary"
                    onClick={() => {
                      setSummaryModalSession(activeSession);
                      setIsEndSessionModalOpen(true);
                    }}
                  >
                    View Summary
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Workspace Action Toolbar */}
          <div className="row-between" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <Tabs
              tabs={workspaceTabs}
              activeTab={activeTab}
              onChange={setActiveTab}
              variant="pills"
              id="workspace-mode-tabs"
            />
          </div>

          {/* Workspace Canvas (2-Column Layout) */}
          <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
            {/* Main Stage Content */}
            <div
              style={{
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)',
                minHeight: 320,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {activeTab === 'notes' && (
                <div className="stack" style={{ gap: 'var(--space-3)', height: '100%' }}>
                  <div className="row-between" style={{ alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                      📝 Collaborative Scratchpad
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Auto-saved &bull; Academic Notes
                    </span>
                  </div>
                  <textarea
                    className="form-textarea"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-xs)',
                      lineHeight: '1.6',
                      flex: 1,
                      minHeight: 220,
                      backgroundColor: 'var(--color-bg-subtle)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3)',
                    }}
                    value={scratchpadText}
                    onChange={(e) => setScratchpadText(e.target.value)}
                    placeholder="Collaborative scratchpad for formulas, code snippets, and review questions..."
                  />
                </div>
              )}

              {activeTab === 'agenda' && (
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Session Agenda & Milestones
                  </span>
                  {agendaItems.length > 0 ? (
                    <ul className="stack-sm" style={{ gap: 'var(--space-2)' }}>
                      {agendaItems.map((item, idx) => (
                        <li
                          key={idx}
                          className="row"
                          style={{
                            padding: 'var(--space-2) var(--space-3)',
                            backgroundColor: 'var(--color-bg-surface)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--text-xs)',
                            border: '1px solid var(--color-border-subtle)',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleToggleAgenda(idx)}
                        >
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => handleToggleAgenda(idx)}
                            id={`agenda-check-${idx}`}
                            style={{ accentColor: 'var(--color-accent)' }}
                          />
                          <label
                            htmlFor={`agenda-check-${idx}`}
                            style={{
                              color: 'var(--color-text-primary)',
                              textDecoration: item.completed ? 'line-through' : 'none',
                              opacity: item.completed ? 0.7 : 1,
                              cursor: 'pointer',
                            }}
                          >
                            {item.text}
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', padding: 'var(--space-3)' }}>
                      Focus block active for <strong>{activeSession.topic}</strong>. Review concepts and discuss questions together.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'questions' && (
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Question & Doubt Queue
                  </span>
                  {questionList.length > 0 ? (
                    <div className="stack-sm" style={{ gap: 'var(--space-2)', maxHeight: 240, overflowY: 'auto' }}>
                      {questionList.map((q) => (
                        <div
                          key={q.id}
                          style={{
                            padding: 'var(--space-3)',
                            backgroundColor: 'var(--color-bg-surface)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border-default)',
                            fontSize: 'var(--text-xs)',
                          }}
                        >
                          <div className="row-between">
                            <strong style={{ color: 'var(--color-text-primary)' }}>{q.author}:</strong>
                            <Badge variant={q.resolved ? 'success' : 'neutral'}>
                              {q.resolved ? 'Resolved' : 'In Discussion'}
                            </Badge>
                          </div>
                          <div style={{ marginTop: 4, color: 'var(--color-text-primary)' }}>
                            {q.question}
                          </div>
                          {q.answer && (
                            <div style={{ marginTop: 6, color: 'var(--color-text-secondary)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 4 }}>
                              &rarr; {q.answer}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', padding: 'var(--space-4)', textAlign: 'center' }}>
                      No questions submitted for this study session yet. Post a doubt below to collaborate with your study partners.
                    </div>
                  )}

                  <form onSubmit={handlePostQuestion} className="row" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={newQuestionText}
                      onChange={(e) => setNewQuestionText(e.target.value)}
                      placeholder="Ask a question or raise a doubt for peer discussion..."
                      style={{ fontSize: 'var(--text-xs)', flex: 1 }}
                    />
                    <Button variant="secondary" size="sm" type="submit">
                      Ask Doubt
                    </Button>
                  </form>
                </div>
              )}

              {activeTab === 'resources' && (
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Attached Reference Materials
                  </span>
                  <div className="stack-sm">
                    {(activeSession.resources || activeSession.linkedNotes || []).map((res, i) => (
                      <div
                        key={i}
                        className="row-between"
                        style={{
                          padding: 'var(--space-3)',
                          backgroundColor: 'var(--color-bg-surface)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border-default)',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                            {res.title}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                            {res.type || res.subject || 'Study Note'}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedNote({
                              title: res.title,
                              subject: activeSession.subject,
                              topic: activeSession.topic,
                              author: res.author_name || 'Course Reference',
                              authorInitials: 'CR',
                              updatedAt: 'Coursework',
                              type: res.type || 'Study Note',
                              content: `### ${res.title}\n\nAttached to active study block **${activeSession.topic}**.\n\nKey Concepts for this module include core definitions, algorithms, proofs, and review exercises.`,
                            });
                          }}
                        >
                          Read Handout
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'focus_shield' && (
                <div className="stack" style={{ gap: 'var(--space-4)' }} id="workspace-focus-shield-tab">
                  <div className="row-between">
                    <div>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Distraction Shield & Focus Mode
                      </span>
                      <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', marginTop: 2 }}>
                        Individual Sprint for {activeSession.topic}
                      </h3>
                    </div>
                    <Badge variant={isDistractionShieldActive ? 'accent' : 'neutral'}>
                      {isDistractionShieldActive ? '🛡️ Shield Active' : 'Shield Off'}
                    </Badge>
                  </div>

                  {activeFocusInterval ? (
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--color-bg-surface)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-strong)',
                        textAlign: 'center',
                      }}
                      className="stack"
                    >
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                        Current Sprint: <strong>{activeFocusInterval.topic || activeSession.topic}</strong> &bull; {activeFocusInterval.planned_duration_minutes}m planned
                      </div>

                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '36px',
                          fontWeight: 'var(--font-bold)',
                          color: isFocusPaused ? 'var(--color-warning)' : 'var(--color-accent)',
                          margin: '8px 0',
                        }}
                      >
                        {Math.floor(focusIntervalRemainingSeconds / 60)}:
                        {String(focusIntervalRemainingSeconds % 60).padStart(2, '0')}
                      </div>

                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                        {isFocusPaused ? '⏸️ Sprint is paused. Paused duration is deducted from recorded focus.' : '⏱️ Timer is ticking from server-authoritative timestamps.'}
                      </div>

                      <div className="row" style={{ gap: 'var(--space-2)', justifyContent: 'center' }}>
                        {isFocusPaused ? (
                          <Button variant="outline" size="sm" onClick={() => resumeFocus()}>
                            ▶ Resume Sprint
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => pauseFocus()}>
                            ⏸ Pause
                          </Button>
                        )}
                        <Button variant="primary" size="sm" onClick={() => completeFocus()}>
                          ✓ Finish Interval
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setIsFocusModalOpen(true)}>
                          Full Screen & Settings
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--color-bg-surface)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-default)',
                      }}
                      className="stack"
                    >
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)' }}>
                        Launch a focused study sprint for this session
                      </div>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                        Choose your target sprint duration. In-app notifications will be muted during your sprint while critical account alerts remain active.
                      </p>

                      <div className="row" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
                        {[15, 25, 45, 60].map((mins) => (
                          <Button
                            key={mins}
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              startFocus({
                                topic: activeSession.topic,
                                sessionId: activeSession.id,
                                plannedDurationMinutes: mins,
                              })
                            }
                          >
                            Start {mins}m Sprint
                          </Button>
                        ))}
                        <Button variant="primary" size="sm" onClick={() => setIsFocusModalOpen(true)}>
                          Custom Sprint...
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-1)' }}>
                    <Button
                      variant={isDistractionShieldActive ? 'primary' : 'outline'}
                      size="sm"
                      id="btn-toggle-in-app-shield"
                      onClick={() => toggleDistractionShield()}
                      title="Pause or resume nonessential StudySync-generated in-app notifications"
                    >
                      {isDistractionShieldActive ? '🔕 In-App Notifications: Muted (Click to Resume)' : '🔔 In-App Notifications: Active (Click to Pause)'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsPlatformLimitationsOpen(true)}
                    >
                      Platform Capabilities & Android DND Guide &rarr;
                    </Button>
                  </div>

                  <div
                    style={{
                      padding: 'var(--space-3)',
                      backgroundColor: 'rgba(59, 130, 246, 0.05)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      fontSize: '11px',
                      color: 'var(--color-text-secondary)',
                      lineHeight: '1.4',
                    }}
                  >
                    <strong>⏱️ Honest Measurement Distinction:</strong> Your focus sprint duration is recorded separately from the group session duration. Recorded duration reflects wall-clock timer duration, not verified concentration or mastery.
                    <button
                      type="button"
                      onClick={() => setIsDistractionSettingsModalOpen(true)}
                      style={{
                        display: 'inline-block',
                        marginLeft: 8,
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-accent)',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '11px',
                      }}
                    >
                      Distraction Shield Settings &rarr;
                    </button>
                  </div>

                  {/* Embedded AI Focus Coach Card */}
                  <AIFocusCoachCard
                    onSelectDuration={(mins) =>
                      startFocus({
                        topic: activeSession.topic,
                        sessionId: activeSession.id,
                        plannedDurationMinutes: mins,
                      })
                    }
                    onSelectGoal={(goalText, mins) =>
                      startFocus({
                        topic: activeSession.topic,
                        sessionId: activeSession.id,
                        plannedDurationMinutes: mins || 25,
                        goal: goalText,
                      })
                    }
                  />
                </div>
              )}
            </div>

            {/* Side Panel: Individual Participant Statuses & Attendance Tracking */}
            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              <div
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                }}
                className="stack"
              >
                <div className="row-between">
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Individual Attendance
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-accent)', fontWeight: 'var(--font-semibold)' }}>
                    {activeSession.participants?.length || 1} Learners
                  </span>
                </div>

                {/* Current User Status & Activity Control */}
                {isParticipant && (
                  <div
                    className="stack-sm"
                    style={{
                      padding: 'var(--space-3)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border-default)',
                      marginTop: 'var(--space-2)',
                    }}
                  >
                    <div className="row-between">
                      <div className="row" style={{ gap: 'var(--space-2)' }}>
                        <Avatar name={user?.displayName || 'You'} initials={user?.displayName?.charAt(0) || 'U'} size="xs" status="online" />
                        <div>
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                            {user?.displayName || 'You'} (Active)
                          </span>
                          <div style={{ fontSize: '11px', color: 'var(--color-accent)' }}>
                            {myFocusMinutes}m recorded focus
                          </div>
                        </div>
                      </div>
                      <StatusIndicator
                        status={myStatus === 'Away' ? 'idle' : 'active'}
                        label={myStatus}
                      />
                    </div>

                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <label htmlFor="my-status-select" style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>
                        Your Current Activity:
                      </label>
                      <select
                        id="my-status-select"
                        className="form-select"
                        value={myStatus}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        style={{ fontSize: 'var(--text-xs)', padding: '4px 8px' }}
                      >
                        <option value="Focused">Focused</option>
                        <option value="Reading">Reading</option>
                        <option value="Writing">Writing</option>
                        <option value="Away">Away</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Individual Participant Attendance Roster */}
                <div className="stack-sm" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                  {(activeSession.participants || []).map((p) => {
                    const isSelf = user ? p.user_id === user.id : false;
                    return (
                      <div
                        key={p.user_id}
                        className="stack-sm"
                        style={{
                          padding: 'var(--space-2) var(--space-3)',
                          backgroundColor: isSelf ? 'rgba(59, 130, 246, 0.05)' : 'var(--color-bg-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          border: isSelf ? '1px solid var(--color-border-strong)' : '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <div className="row-between">
                          <div className="row" style={{ gap: 'var(--space-2)' }}>
                            <Avatar name={p.display_name} initials={p.display_name?.slice(0, 2) || 'P'} size="xs" status={p.is_active ? 'online' : 'offline'} />
                            <div>
                              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                                {p.display_name} {isSelf && '(You)'}
                              </span>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                {p.attendance_minutes || p.individual_duration_minutes || 0}m attended &bull; {p.recorded_study_minutes || 0}m focus
                              </div>
                            </div>
                          </div>
                          <Badge variant={p.is_active ? 'accent' : 'neutral'}>
                            {p.status || p.participation_status || 'Enrolled'}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    borderTop: '1px solid var(--color-border-subtle)',
                    paddingTop: 'var(--space-2)',
                    marginTop: 'var(--space-2)',
                    lineHeight: '1.4',
                  }}
                >
                  Discrete attendance intervals are calculated strictly server-side from joined and left timestamps.
                </div>
              </div>
            </div>
          </div>
        </Card>
      ) : isSessionsLoading ? (
        <Card style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Loading study workspace...
          </div>
        </Card>
      ) : (
        <Card style={{ padding: 'var(--space-6)', textAlign: 'center', backgroundColor: 'var(--color-bg-subtle)' }} id="no-active-session-card">
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎯</div>
          <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
            {t('sessions.emptyScheduled', 'No Active Study Session')}
          </h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', maxWidth: 440, margin: '6px auto 16px' }}>
            You do not have a study session running right now. Start an instant study block or schedule an upcoming session below to focus with peer learners.
          </p>
          <Button variant="primary" size="sm" onClick={() => setIsCreateSessionModalOpen(true)} id="start-session-empty-btn">
            {t('sessions.createBtn', '+ Start a Study Session')}
          </Button>
        </Card>
      )}

      {/* 3. Post-Session Completion Modal / Summary Flow */}
      <Modal
        isOpen={isEndSessionModalOpen}
        onClose={() => setIsEndSessionModalOpen(false)}
        title={summaryModalSession?.status === 'completed' ? 'Session Concluded & Summary' : 'End Study Session'}
        id="session-summary-modal"
        maxWidth={580}
        footer={
          <div className="row-between" style={{ width: '100%' }}>
            <Button variant="ghost" size="sm" onClick={() => setIsEndSessionModalOpen(false)}>
              Close
            </Button>
            {summaryModalSession?.status !== 'completed' && (
              <Button
                variant="primary"
                size="sm"
                id="confirm-end-session-btn"
                onClick={handleConfirmEndSession}
                disabled={isSubmittingEnd}
              >
                {isSubmittingEnd ? 'Finalizing...' : 'Conclude & Save Summary'}
              </Button>
            )}
          </div>
        }
      >
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          {/* Header */}
          <div
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-accent)' }}>
              {summaryModalSession?.subject || 'Computer Science'}
            </span>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', marginTop: 2 }}>
              {summaryModalSession?.topic}
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {summaryModalSession?.title} &bull; {summaryModalSession?.planned_duration_minutes || summaryModalSession?.planned_duration || 45} mins planned
            </p>
          </div>

          {/* Session Summary Metrics */}
          <div>
            <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)', marginBottom: 8 }}>
              Objective Session Metrics
            </h4>
            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
              <div style={{ padding: 'var(--space-2)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                  {summaryModalSession?.actual_duration_minutes || Math.round(secondsElapsed / 60)} min
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Actual Duration</div>
              </div>
              <div style={{ padding: 'var(--space-2)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                  {summaryModalSession?.participants?.length || 1}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Participants</div>
              </div>
              <div style={{ padding: 'var(--space-2)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                  {summaryModalSession?.planned_duration_minutes || summaryModalSession?.planned_duration || 45} min
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Planned Duration</div>
              </div>
            </div>
          </div>

          {/* Separate Individual Attendance Breakdown */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              Individual Attendance Breakdown
            </div>
            <div className="stack-sm" style={{ gap: 'var(--space-1)' }}>
              {(summaryModalSession?.participants || []).map((p) => (
                <div
                  key={p.user_id}
                  className="row-between"
                  style={{
                    fontSize: 'var(--text-xs)',
                    padding: '6px 10px',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <span>
                    <strong>{p.display_name}</strong>
                  </span>
                  <span>
                    {p.attendance_minutes || p.individual_duration_minutes || 0} min attendance &bull; {p.recorded_study_minutes || 0} min focus
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Phase 12: Peer Collaboration Review */}
          {summaryModalSession?.participants?.filter((p) => p.user_id !== user?.id)?.length > 0 && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <div style={{ fontSize: '11px', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                🤝 Peer Collaboration Feedback (Confidential)
              </div>
              <div className="stack-sm" style={{ gap: 'var(--space-2)' }}>
                {summaryModalSession.participants
                  .filter((p) => p.user_id !== user?.id)
                  .map((peer) => (
                    <div
                      key={peer.user_id}
                      className="row-between"
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'var(--color-bg-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border-subtle)',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                          {peer.display_name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {peer.attendance_minutes || peer.individual_duration_minutes || 0}m attendance &bull; Rate helpfulness & repeat study
                        </div>
                      </div>

                      {reviewedPeers[peer.user_id] ? (
                        <Badge variant="success" style={{ fontSize: '10px' }}>
                          ✓ Feedback Saved
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPeerToReview(peer);
                            setPeerFeedbackSessionId(summaryModalSession.id);
                          }}
                        >
                          Review Peer
                        </Button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Feedback Form (if concluding) */}
          {summaryModalSession?.status !== 'completed' && (
            <>
              <div>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)', display: 'block', marginBottom: 6 }}>
                  How helpful was this study session?
                </label>
                <div className="row" style={{ gap: 'var(--space-2)' }}>
                  {['Helpful', 'Very helpful', 'Not helpful'].map((rate) => (
                    <Button
                      key={rate}
                      variant={feedbackRating === rate ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setFeedbackRating(rate)}
                    >
                      {rate}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="reflection-input" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                  What did you learn? (Optional Learner Reflection)
                </label>
                <textarea
                  id="reflection-input"
                  className="form-textarea"
                  value={learnedReflection}
                  onChange={(e) => setLearnedReflection(e.target.value)}
                  placeholder="e.g. Understood key definitions and worked through problem sets..."
                  style={{ fontSize: 'var(--text-xs)', minHeight: 60 }}
                />
              </div>
            </>
          )}

          {/* Existing Feedback Reflections (if completed) */}
          {summaryModalSession?.feedback && summaryModalSession.feedback.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                Learner Reflections
              </div>
              <div className="stack-sm" style={{ gap: 'var(--space-1)' }}>
                {summaryModalSession.feedback.map((fb, idx) => (
                  <div key={idx} style={{ padding: '6px 10px', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)' }}>
                    <div className="row-between">
                      <strong>{fb.display_name || 'Participant'}</strong>
                      <Badge variant="success">{fb.rating || 'Helpful'}</Badge>
                    </div>
                    {fb.reflection && <p style={{ marginTop: 2, color: 'var(--color-text-secondary)' }}>"{fb.reflection}"</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 4. Upcoming & Completed Sessions Calendar List */}
      <Section id="all-sessions-section">
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
              {t('sessions.pastSessions', 'Study Sessions Calendar & History')}
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              Persistent study blocks, focus history, and verified participation records
            </p>
          </div>

          <div className="row" style={{ gap: 'var(--space-2)' }}>
            {[
              { id: 'all', label: 'All Sessions' },
              { id: 'active', label: 'Active' },
              { id: 'scheduled', label: 'Scheduled' },
              { id: 'completed', label: 'Completed' },
            ].map((tab) => (
              <Button
                key={tab.id}
                variant={sessionFilter === tab.id ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setSessionFilter(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        {filteredSessions.length > 0 ? (
          <div className="cards-grid-2">
            {filteredSessions.map((session) => (
              <StudySessionCard
                key={session.id}
                session={session}
                id={`session-card-${session.id}`}
                onAction={async () => {
                  if (session.status === 'completed') {
                    // Open summary
                    const res = await fetchSessionById(session.id);
                    if (res.success) {
                      setSummaryModalSession(res.session);
                      setIsEndSessionModalOpen(true);
                    }
                  } else {
                    // Load into active workspace
                    await fetchSessionById(session.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: 'var(--space-6)',
              backgroundColor: 'var(--color-bg-subtle)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
              No study sessions found matching the "{sessionFilter}" filter.
            </div>
            <Button variant="primary" size="sm" onClick={() => setIsCreateSessionModalOpen(true)}>
              {t('sessions.createBtn', 'Create Study Session')}
            </Button>
          </div>
        )}
      </Section>

      {/* 5. AI Focus Coach Section */}
      <Section id="ai-focus-coach-section">
        <AIFocusCoachCard />
      </Section>

      {/* 6. Individual Focus Mode History & Honest Statistics */}
      <Section id="focus-history-statistics-section">
        <FocusHistoryWidget onStartNew={() => setIsFocusModalOpen(true)} />
      </Section>

      {/* Platform Capabilities & Notification Limitations Modal */}
      <PlatformNotificationInfoModal
        isOpen={isPlatformLimitationsOpen}
        onClose={() => setIsPlatformLimitationsOpen(false)}
      />

      {/* Create Session Modal */}
      <CreateSessionModal
        isOpen={isCreateSessionModalOpen}
        onClose={() => setIsCreateSessionModalOpen(false)}
      />

      {/* Peer Collaboration Review Modal (Phase 12) */}
      <PeerFeedbackModal
        isOpen={Boolean(peerToReview)}
        onClose={() => setPeerToReview(null)}
        sessionId={peerFeedbackSessionId}
        peer={peerToReview}
        topic={summaryModalSession?.topic}
        onSubmitted={() => {
          if (peerToReview) {
            setReviewedPeers((prev) => ({ ...prev, [peerToReview.user_id || peerToReview.id]: true }));
          }
        }}
      />
    </div>
  );
}

export default Sessions;
