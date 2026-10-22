import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Badge, Input, Select, ProgressIndicator } from '../UI';

const DURATION_PRESETS = [
  { minutes: 15, label: '15m Sprint', description: '8m Focus • 3m Discuss • 3m Recall • 1m Review' },
  { minutes: 25, label: '25m Pomodoro', description: '12m Focus • 5m Discuss • 5m Recall • 3m Review' },
  { minutes: 45, label: '45m Deep Dive', description: '22m Focus • 10m Discuss • 8m Recall • 5m Review' },
  { minutes: 60, label: '60m Extended', description: '30m Focus • 14m Discuss • 10m Recall • 6m Review' },
];

export function calculatePhasesForDuration(totalMinutes) {
  const totalSeconds = Math.max(60, Math.min(14400, (parseInt(totalMinutes, 10) || 25) * 60));
  const focus = Math.round(totalSeconds * 0.5);
  const discuss = Math.round(totalSeconds * 0.2);
  const recall = Math.round(totalSeconds * 0.2);
  const review = Math.max(0, totalSeconds - focus - discuss - recall);

  return [
    {
      id: 'focus',
      name: 'Focus',
      label: 'Deep Study',
      icon: '🎯',
      durationSeconds: focus,
      description: 'Review syllabus materials, read chapters, and work through problems without distraction.',
      actionPrompt: 'Focus deeply on understanding core concepts, formulas, or proof steps.',
      soloPrompt: 'Dive into your primary notes or textbook. Note down key definitions.',
    },
    {
      id: 'discuss',
      name: 'Discuss',
      label: 'Explain & Teach',
      icon: '🗣️',
      durationSeconds: discuss,
      description: 'Explain concepts simply or teach a partner. Solo: vocalize or write a 2-minute explanation.',
      actionPrompt: 'Feynman Technique: Explain this concept simply as if teaching someone new to the topic.',
      soloPrompt: 'Say it out loud or write a simplified explanation without using technical jargon.',
    },
    {
      id: 'recall',
      name: 'Recall',
      label: 'Retrieval Practice',
      icon: '🧠',
      durationSeconds: recall,
      description: 'Close notes and test recall: define terms, sketch diagrams, or solve practice problems from memory.',
      actionPrompt: 'Active Retrieval: Test yourself on definitions, algorithms, or problem steps without referring to notes.',
      soloPrompt: 'Close all tabs and notes! Sketch or write everything you can remember about this concept.',
    },
    {
      id: 'review',
      name: 'Review',
      label: 'Review & Doubts',
      icon: '📝',
      durationSeconds: review,
      description: 'Assess what you mastered, record remaining doubts, and decide whether revision is needed.',
      actionPrompt: 'Self-Assessment: Record key takeaways and note remaining doubts to ask peers or revise later.',
      soloPrompt: 'Review what you got right and what was tricky. Decide if you should schedule spaced revision.',
    },
  ];
}

export function FocusModeModal({
  isOpen,
  onClose,
  activeInterval,
  remainingSeconds = 0,
  elapsedSeconds = 0,
  isPaused = false,
  defaultTopic = '',
  defaultSubject = '',
  defaultGoal = '',
  sessionId = null,
  roomId = null,
  rooms = [],
  onStartFocus,
  onSwitchPhase,
  onPauseFocus,
  onResumeFocus,
  onCompleteFocus,
  onCancelFocus,
  onOpenSettings,
}) {
  // Session Setup State
  const [topic, setTopic] = useState(defaultTopic || 'Deep Study Session');
  const [subject, setSubject] = useState(defaultSubject || '');
  const [goal, setGoal] = useState(defaultGoal || '');
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [sessionMode, setSessionMode] = useState(roomId ? 'room' : 'solo'); // 'solo' | 'room'
  const [selectedRoomId, setSelectedRoomId] = useState(roomId || '');

  // Active Session Navigation & Action State
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const [isReflectionOpen, setIsReflectionOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDeviceTab, setActiveDeviceTab] = useState('windows'); // 'windows' | 'mac' | 'mobile'

  // Post-Session Reflection Form State
  const [reflectionGoalAchieved, setReflectionGoalAchieved] = useState('yes'); // 'yes' | 'partially' | 'no'
  const [reflectionTakeaways, setReflectionTakeaways] = useState('');
  const [reflectionDoubts, setReflectionDoubts] = useState('');
  const [reflectionNeedsRevision, setReflectionNeedsRevision] = useState(false);

  // Synchronize defaults when modal opens or activeInterval changes
  useEffect(() => {
    if (defaultTopic && !activeInterval) setTopic(defaultTopic);
    if (defaultSubject && !activeInterval) setSubject(defaultSubject);
    if (defaultGoal && !activeInterval) setGoal(defaultGoal);
    if (roomId && !activeInterval) {
      setSelectedRoomId(roomId);
      setSessionMode('room');
    }
  }, [defaultTopic, defaultSubject, defaultGoal, roomId, activeInterval]);

  // Planned phases for setup preview
  const plannedPhases = useMemo(() => {
    return calculatePhasesForDuration(selectedDuration);
  }, [selectedDuration]);

  if (!isOpen) return null;

  // Active Session Phase & Timing derivation
  const activePhases = activeInterval?.phases && Array.isArray(activeInterval.phases) && activeInterval.phases.length > 0
    ? activeInterval.phases
    : plannedPhases;

  const currentPhaseId = activeInterval?.currentPhase || 'focus';
  const currentPhaseIndex = Math.max(0, activePhases.findIndex((p) => p.id === currentPhaseId));
  const currentPhaseConfig = activePhases[currentPhaseIndex] || activePhases[0];

  // Calculate phase remaining time
  const previousPhasesDurationSec = activePhases
    .slice(0, currentPhaseIndex)
    .reduce((sum, p) => sum + (p.durationSeconds || 0), 0);
  const phaseElapsedSec = Math.max(0, elapsedSeconds - previousPhasesDurationSec);
  const phaseTargetSec = currentPhaseConfig?.durationSeconds || (selectedDuration * 60);
  const phaseRemainingSec = Math.max(0, phaseTargetSec - phaseElapsedSec);

  // Overall Timer formatting
  const totalMins = Math.floor(remainingSeconds / 60);
  const totalSecs = remainingSeconds % 60;
  const formattedTotalTimer = `${totalMins.toString().padStart(2, '0')}:${totalSecs.toString().padStart(2, '0')}`;

  // Current Phase Timer formatting
  const pMins = Math.floor(phaseRemainingSec / 60);
  const pSecs = phaseRemainingSec % 60;
  const formattedPhaseTimer = `${pMins.toString().padStart(2, '0')}:${pSecs.toString().padStart(2, '0')}`;

  // Progress percentage
  const totalPlannedSec = activeInterval?.planned_duration_seconds || (selectedDuration * 60);
  const progressPercent = totalPlannedSec > 0
    ? Math.min(100, Math.round((elapsedSeconds / totalPlannedSec) * 100))
    : 0;

  // Handlers
  const handleStart = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsSubmitting(true);
    try {
      await onStartFocus({
        topic: topic.trim(),
        subject: subject.trim() || null,
        goal: goal.trim() || null,
        plannedDurationMinutes: selectedDuration,
        phases: plannedPhases,
        sessionId,
        roomId: sessionMode === 'room' && selectedRoomId ? selectedRoomId : null,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextPhase = async () => {
    if (currentPhaseIndex < activePhases.length - 1) {
      const nextPhase = activePhases[currentPhaseIndex + 1];
      if (onSwitchPhase) {
        await onSwitchPhase(nextPhase.id, currentPhaseConfig.id);
      }
    } else {
      // Reached the end of phases: open reflection
      setIsReflectionOpen(true);
    }
  };

  const handleJumpToPhase = async (targetPhaseId) => {
    if (targetPhaseId === currentPhaseId) return;
    if (onSwitchPhase) {
      await onSwitchPhase(targetPhaseId, currentPhaseConfig.id);
    }
  };

  const handleOpenReflection = () => {
    setIsReflectionOpen(true);
  };

  const handleSubmitReflection = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const completedList = activePhases.map((p) => p.id);
      await onCompleteFocus({
        goalAchieved: reflectionGoalAchieved,
        keyTakeaways: reflectionTakeaways.trim() || null,
        confusingDoubts: reflectionDoubts.trim() || null,
        needsRevision: reflectionNeedsRevision,
        completedPhases: completedList,
        currentPhase: currentPhaseId,
      });
      setIsReflectionOpen(false);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDiscard = async () => {
    setIsSubmitting(true);
    try {
      await onCancelFocus({
        earlyExitReason: `Cancelled after ${Math.round(elapsedSeconds / 60)} minutes`,
      });
      setIsDiscardConfirmOpen(false);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Find linked room details if available
  const linkedRoom = (rooms || []).find((r) => r.id === (activeInterval?.room_id || selectedRoomId));

  return (
    <>
      <Modal
        isOpen={isOpen && !isReflectionOpen}
        onClose={onClose}
        title={activeInterval ? '🎯 Goal-Oriented Study Session' : '📚 Start Structured Study Session'}
        id="focus-mode-modal"
      >
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          {activeInterval ? (
            /* ------------------------------------------------------------- */
            /* 1. ACTIVE STRUCTURED SESSION WORKSPACE                        */
            /* ------------------------------------------------------------- */
            <div className="stack" style={{ gap: 'var(--space-4)' }}>
              {/* Collaboration / Room Context Banner */}
              {activeInterval.room_id ? (
                <div
                  className="row-between"
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    alignItems: 'center',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                    <Badge variant="accent">👥 Study Room Context</Badge>
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)' }}>
                      {linkedRoom?.name || 'Collaborative Study Room'}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Individual pace &bull; Notifications muted
                  </span>
                </div>
              ) : (
                <div
                  className="row-between"
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    alignItems: 'center',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                    <Badge variant="success">🛡️ Solo Focus Shield Active</Badge>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                      In-app alerts suppressed
                    </span>
                  </div>
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-accent)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: 'var(--font-medium)',
                        padding: 0,
                      }}
                    >
                      Shield Settings &rarr;
                    </button>
                  )}
                </div>
              )}

              {/* Goal & Topic Card */}
              <div
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  textAlign: 'left',
                }}
                className="stack-xs"
              >
                <div className="row-between" style={{ alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'var(--font-bold)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {activeInterval.subject || 'Target Topic'}
                  </span>
                  <Badge variant={isPaused ? 'warning' : 'primary'}>
                    {isPaused ? '⏸ Session Paused' : '⚡ In Progress'}
                  </Badge>
                </div>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
                  {activeInterval.topic}
                </h3>
                {activeInterval.goal ? (
                  <div
                    style={{
                      marginTop: 4,
                      padding: '6px 10px',
                      backgroundColor: 'var(--color-bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: '3px solid var(--color-accent)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    <strong>🎯 Goal:</strong> {activeInterval.goal}
                  </div>
                ) : null}
              </div>

              {/* 4-Phase Stepper Tracker */}
              <div>
                <div className="row-between" style={{ marginBottom: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'var(--font-bold)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    Session Learning Phases
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Phase {currentPhaseIndex + 1} of {activePhases.length}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${activePhases.length}, 1fr)`,
                    gap: 'var(--space-2)',
                  }}
                >
                  {activePhases.map((phase, idx) => {
                    const isCurrent = phase.id === currentPhaseId;
                    const isCompleted = activeInterval.completedPhases?.includes(phase.id) || idx < currentPhaseIndex;
                    const phaseMins = Math.round((phase.durationSeconds || 0) / 60);

                    return (
                      <button
                        key={phase.id}
                        type="button"
                        onClick={() => handleJumpToPhase(phase.id)}
                        style={{
                          padding: '8px 6px',
                          borderRadius: 'var(--radius-md)',
                          border: isCurrent
                            ? '2px solid var(--color-accent)'
                            : isCompleted
                            ? '1px solid var(--color-forest, #10b981)'
                            : '1px solid var(--color-border-default)',
                          backgroundColor: isCurrent
                            ? 'var(--color-accent-subtle)'
                            : isCompleted
                            ? 'rgba(16, 185, 129, 0.08)'
                            : 'var(--color-bg-surface)',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all var(--transition-fast)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 2,
                        }}
                        title={`Click to switch to ${phase.name} phase`}
                        aria-label={`Phase ${phase.name}, ${phaseMins} minutes`}
                      >
                        <span style={{ fontSize: '14px' }}>
                          {isCompleted && !isCurrent ? '✓' : phase.icon || '📌'}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: isCurrent ? 'var(--font-bold)' : 'var(--font-medium)',
                          color: isCurrent ? 'var(--color-accent)' : isCompleted ? 'var(--color-forest)' : 'var(--color-text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '100%',
                        }}>
                          {phase.name}
                        </span>
                        <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                          {phaseMins}m
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Phase Focus Box & Countdown */}
              <div
                style={{
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--color-bg-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border-default)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                  <Badge variant="accent" style={{ fontSize: '11px' }}>
                    Active Phase: {currentPhaseConfig.name} ({currentPhaseConfig.label})
                  </Badge>
                </div>

                {/* Primary Phase Prompt */}
                <p style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-secondary)',
                  maxWidth: 420,
                  margin: '4px 0',
                  lineHeight: 'var(--leading-relaxed)',
                }}>
                  {currentPhaseConfig.actionPrompt || currentPhaseConfig.description}
                </p>

                {/* Giant Main Countdown */}
                <div
                  id="focus-modal-countdown"
                  style={{
                    fontSize: '60px',
                    fontWeight: '800',
                    fontFamily: 'monospace',
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                    color: isPaused ? 'var(--color-warning-text, #b45309)' : 'var(--color-text-primary)',
                    marginTop: 'var(--space-2)',
                  }}
                  aria-live="polite"
                >
                  {formattedTotalTimer}
                </div>

                <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'center', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  <span>
                    Current Phase Time: <strong>{formattedPhaseTimer}</strong>
                  </span>
                  <span>&bull;</span>
                  <span>
                    Overall: <strong>{Math.round(elapsedSeconds / 60)}m</strong> of <strong>{Math.round(totalPlannedSec / 60)}m</strong> ({progressPercent}%)
                  </span>
                </div>

                <div style={{ width: '100%', maxWidth: 380, marginTop: 'var(--space-2)' }}>
                  <ProgressIndicator value={progressPercent} />
                </div>
              </div>

              {/* Primary Action Controls */}
              <div className="row" style={{ justifyContent: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {isPaused ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={onResumeFocus}
                    disabled={isSubmitting}
                    id="focus-resume-btn"
                  >
                    ▶ Resume Session
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onPauseFocus}
                    disabled={isSubmitting}
                    id="focus-pause-btn"
                  >
                    ⏸ Pause Session
                  </Button>
                )}

                {currentPhaseIndex < activePhases.length - 1 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleNextPhase}
                    disabled={isSubmitting}
                    id="focus-next-phase-btn"
                  >
                    Next Phase ({activePhases[currentPhaseIndex + 1]?.name}) &rarr;
                  </Button>
                ) : null}

                <Button
                  type="button"
                  variant="primary"
                  onClick={handleOpenReflection}
                  disabled={isSubmitting}
                  id="focus-finish-btn"
                >
                  ✓ Complete Session & Reflect
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsDiscardConfirmOpen(true)}
                  disabled={isSubmitting}
                  style={{ color: 'var(--color-danger-text, #dc2626)' }}
                  id="focus-discard-trigger-btn"
                >
                  ✕ End / Discard
                </Button>
              </div>

              {/* Device Focus Mode Guidance (Do Not Disturb) */}
              <div
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  textAlign: 'left',
                }}
              >
                <div className="row-between" style={{ alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '11px', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                    📱 System "Do Not Disturb" (Manual Device Setting)
                  </span>
                  <div className="row" style={{ gap: '4px' }}>
                    {['windows', 'mac', 'mobile'].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveDeviceTab(tab)}
                        style={{
                          padding: '2px 8px',
                          fontSize: '10px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border-default)',
                          backgroundColor: activeDeviceTab === tab ? 'var(--color-accent)' : 'transparent',
                          color: activeDeviceTab === tab ? '#fff' : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                        }}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  {activeDeviceTab === 'windows' && (
                    <>
                      Press <kbd style={{ padding: '1px 5px', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 3 }}>Win + N</kbd> to open Notifications, then click <strong>Focus</strong> in the bottom right corner.
                    </>
                  )}
                  {activeDeviceTab === 'mac' && (
                    <>
                      Click <strong>Control Center</strong> in the top-right menu bar &rarr; click <strong>Focus</strong> &rarr; select <strong>Do Not Disturb</strong>.
                    </>
                  )}
                  {activeDeviceTab === 'mobile' && (
                    <>
                      Swipe down from top of screen &rarr; tap the <strong>Do Not Disturb / Focus</strong> crescent moon icon.
                    </>
                  )}
                </p>
              </div>

              {/* Honest Progress Principle */}
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
                <strong>StudySync AI Learning Session:</strong> Recorded time measures elapsed study duration. Reflection entries help guide spaced revision and peer study targets.
              </div>
            </div>
          ) : (
            /* ------------------------------------------------------------- */
            /* 2. COMPACT SESSION SETUP FORM                                 */
            /* ------------------------------------------------------------- */
            <form onSubmit={handleStart} className="stack" style={{ gap: 'var(--space-4)' }}>
              <div
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Set a clear learning objective and study with 4 structured phases: <strong>Focus</strong> (deep study), <strong>Discuss</strong> (explain & teach), <strong>Recall</strong> (active retrieval without notes), and <strong>Review</strong> (assess doubts).
              </div>

              {/* Topic & Subject */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                <Input
                  id="focus-topic-input"
                  label="Study Topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. BCNF Decomposition"
                  required
                />

                <Input
                  id="focus-subject-input"
                  label="Subject (Optional)"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Database Management Systems"
                />
              </div>

              {/* Learning Goal */}
              <div>
                <Input
                  id="focus-goal-input"
                  label="Session Learning Goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Explain 3NF vs BCNF differences and solve 2 practice problems"
                  helpText="What do you plan to explain, understand, or solve by the end of this session?"
                />
              </div>

              {/* Session Duration Selector */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--font-medium)',
                    color: 'var(--color-text-secondary)',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  Session Duration
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-2)' }}>
                  {DURATION_PRESETS.map((p) => {
                    const isSelected = selectedDuration === p.minutes;
                    return (
                      <button
                        key={p.minutes}
                        type="button"
                        onClick={() => setSelectedDuration(p.minutes)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border-default)',
                          backgroundColor: isSelected ? 'var(--color-accent-subtle)' : 'var(--color-bg-surface)',
                          color: isSelected ? 'var(--color-accent)' : 'var(--color-text-primary)',
                          fontWeight: isSelected ? 'var(--font-bold)' : 'var(--font-medium)',
                          fontSize: 'var(--text-xs)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        <div style={{ fontWeight: 'var(--font-bold)' }}>{p.label}</div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {p.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Solo or Room Session Mode Selector */}
              <div
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                }}
                className="stack-xs"
              >
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                  Session Mode
                </label>
                <div className="row" style={{ gap: 'var(--space-3)', marginTop: 4 }}>
                  <label className="row" style={{ gap: 'var(--space-2)', alignItems: 'center', cursor: 'pointer', fontSize: 'var(--text-xs)' }}>
                    <input
                      type="radio"
                      name="sessionMode"
                      value="solo"
                      checked={sessionMode === 'solo'}
                      onChange={() => setSessionMode('solo')}
                    />
                    <span>Solo Session (Self-Paced)</span>
                  </label>

                  <label className="row" style={{ gap: 'var(--space-2)', alignItems: 'center', cursor: 'pointer', fontSize: 'var(--text-xs)' }}>
                    <input
                      type="radio"
                      name="sessionMode"
                      value="room"
                      checked={sessionMode === 'room'}
                      onChange={() => setSessionMode('room')}
                    />
                    <span>Link to Study Room</span>
                  </label>
                </div>

                {sessionMode === 'room' && (
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    {rooms && rooms.length > 0 ? (
                      <Select
                        label="Select Study Room"
                        value={selectedRoomId}
                        onChange={(e) => {
                          const rid = e.target.value;
                          setSelectedRoomId(rid);
                          const rm = rooms.find((r) => r.id === rid);
                          if (rm?.topic && !topic) setTopic(rm.topic);
                          if (rm?.subject && !subject) setSubject(rm.subject);
                        }}
                        options={[
                          { value: '', label: '-- Choose a room --' },
                          ...rooms.map((r) => ({ value: r.id, label: `${r.name} (${r.subject || 'General'})` })),
                        ]}
                      />
                    ) : (
                      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
                        No joined study rooms found. Session will run in solo mode.
                      </p>
                    )}
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginTop: 4 }}>
                      Note: Other room members study at their own pace. Timer intervals are tracked individually.
                    </span>
                  </div>
                )}
              </div>

              {/* Planned Phases Breakdown Preview */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 'var(--font-bold)', color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Planned Phase Breakdown ({selectedDuration} minutes total)
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-2)' }}>
                  {plannedPhases.map((phase) => (
                    <div
                      key={phase.id}
                      style={{
                        padding: '8px 10px',
                        backgroundColor: 'var(--color-bg-surface)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border-subtle)',
                        fontSize: '11px',
                      }}
                    >
                      <div className="row-between" style={{ alignItems: 'center' }}>
                        <span style={{ fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                          {phase.icon} {phase.name}
                        </span>
                        <Badge variant="neutral">{Math.round(phase.durationSeconds / 60)}m</Badge>
                      </div>
                      <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                        {phase.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="row-between" style={{ marginTop: 'var(--space-3)' }}>
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting || !topic.trim()}
                  id="start-focus-sprint-btn"
                >
                  {isSubmitting ? 'Starting...' : `🎯 Start ${selectedDuration}m Study Session`}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* 3. POST-SESSION REFLECTION DIALOG                             */}
      {/* ------------------------------------------------------------- */}
      {isReflectionOpen && (
        <Modal
          isOpen={isReflectionOpen}
          onClose={() => setIsReflectionOpen(false)}
          title="📝 Session Reflection & Takeaways"
          id="focus-reflection-modal"
        >
          <form onSubmit={handleSubmitReflection} className="stack" style={{ gap: 'var(--space-4)' }}>
            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-primary)',
              }}
            >
              Take 60 seconds to consolidate what you learned. Retrieval and reflection solidify memory and help recommend future revision sessions.
            </div>

            {/* Topic & Elapsed Context */}
            <div className="row-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              <span>Topic: <strong>{activeInterval?.topic || topic}</strong></span>
              <span>Time Studied: <strong>{Math.round(elapsedSeconds / 60)} minutes</strong></span>
            </div>

            {/* Q1: Was the learning goal achieved? */}
            <div className="stack-xs">
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                1. Was your learning goal achieved?
              </label>
              {activeInterval?.goal && (
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  Goal: "{activeInterval.goal}"
                </div>
              )}
              <div className="row" style={{ gap: 'var(--space-2)', marginTop: 4, flexWrap: 'wrap' }}>
                {[
                  { value: 'yes', label: '✓ Fully Achieved', variant: 'success' },
                  { value: 'partially', label: '⚡ Partially Achieved', variant: 'warning' },
                  { value: 'no', label: '✕ Need More Time', variant: 'neutral' },
                ].map((opt) => {
                  const isSelected = reflectionGoalAchieved === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setReflectionGoalAchieved(opt.value)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border-default)',
                        backgroundColor: isSelected ? 'var(--color-accent-subtle)' : 'var(--color-bg-surface)',
                        color: isSelected ? 'var(--color-accent)' : 'var(--color-text-primary)',
                        fontWeight: isSelected ? 'var(--font-bold)' : 'var(--font-medium)',
                        fontSize: 'var(--text-xs)',
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Q2: What did you understand? */}
            <div className="stack-xs">
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                2. What did you understand? (Key concepts mastered)
              </label>
              <textarea
                value={reflectionTakeaways}
                onChange={(e) => setReflectionTakeaways(e.target.value)}
                placeholder="e.g. Mastered checking functional dependencies and applying the BCNF decomposition algorithm."
                rows={2}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Q3: What remains confusing? */}
            <div className="stack-xs">
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                3. What remains confusing or tricky?
              </label>
              <textarea
                value={reflectionDoubts}
                onChange={(e) => setReflectionDoubts(e.target.value)}
                placeholder="e.g. Still uncertain about verifying dependency preservation versus lossless joins."
                rows={2}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Q4: Do you need to revise this topic? */}
            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-bg-subtle)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <label className="row" style={{ gap: 'var(--space-2)', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={reflectionNeedsRevision}
                  onChange={(e) => setReflectionNeedsRevision(e.target.checked)}
                />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                  Mark this topic for spaced revision
                </span>
              </label>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '4px 0 0 24px' }}>
                StudySync AI will surface this topic in your Spaced Revision recommendations and pair you with peers who can help.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="row-between" style={{ marginTop: 'var(--space-2)' }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsReflectionOpen(false);
                }}
                disabled={isSubmitting}
              >
                Back to Session
              </Button>

              <div className="row" style={{ gap: 'var(--space-2)' }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onCompleteFocus({});
                    setIsReflectionOpen(false);
                    onClose();
                  }}
                  disabled={isSubmitting}
                >
                  Skip Reflection
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                  id="submit-reflection-btn"
                >
                  {isSubmitting ? 'Saving...' : 'Save & Complete Session'}
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. DISCARD / EARLY TERMINATION CONFIRMATION MODAL             */}
      {/* ------------------------------------------------------------- */}
      {isDiscardConfirmOpen && (
        <Modal
          isOpen={isDiscardConfirmOpen}
          onClose={() => setIsDiscardConfirmOpen(false)}
          title="End Study Session Early?"
          id="discard-focus-confirm-modal"
        >
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
              You have completed <strong>{Math.round(elapsedSeconds / 60)} minutes</strong> so far. How would you like to proceed?
            </p>

            <div className="stack" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setIsDiscardConfirmOpen(false);
                  setIsReflectionOpen(true);
                }}
              >
                ✓ Finish Early & Record Reflection ({Math.round(elapsedSeconds / 60)}m)
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleConfirmDiscard}
                disabled={isSubmitting}
                style={{ color: 'var(--color-danger-text, #dc2626)', borderColor: 'var(--color-danger-text, #dc2626)' }}
                id="confirm-discard-focus-btn"
              >
                {isSubmitting ? 'Discarding...' : '✕ Discard Session (Mark as Cancelled)'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDiscardConfirmOpen(false)}
                disabled={isSubmitting}
              >
                Keep Session Running
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default FocusModeModal;
