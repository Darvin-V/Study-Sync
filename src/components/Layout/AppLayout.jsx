import React, { useState } from 'react';
import { Outlet, useNavigate, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileNav from './MobileNav';
import { Toast } from '../UI/Toast';
import { Badge } from '../UI/Badge';
import { PWANotifications } from '../UI/PWANotifications';
import { PartnerProfileModal } from '../Domain/PartnerProfileModal';
import { NoteDetailModal } from '../Domain/NoteDetailModal';
import { CreateNoteModal } from '../Domain/CreateNoteModal';
import { CreateRoomModal } from '../Rooms/CreateRoomModal';
import { FocusModeModal } from '../Domain/FocusModeModal';
import { BreakReminderModal } from '../Domain/BreakReminderModal';
import { DistractionShieldSettingsModal } from '../Domain/DistractionShieldSettingsModal';
import { AuthLoadingScreen } from '../Auth/AuthLoadingScreen';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../config/routes';

export function AppLayout({ children }) {
  const { isAuthenticated, isLoading, isProfileCompleted } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();

  if (isLoading) {
    return <AuthLoadingScreen message="Loading workspace..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (!isProfileCompleted) {
    return <Navigate to={ROUTES.ONBOARDING} replace />;
  }
  const {
    toast,
    hideToast,
    selectedPartner,
    setSelectedPartner,
    selectedNote,
    setSelectedNote,
    isCreateNoteOpen,
    setIsCreateNoteOpen,
    isCreateRoomOpen,
    setIsCreateRoomOpen,
    activeFocusInterval,
    focusIntervalSecondsElapsed,
    focusIntervalRemainingSeconds,
    isFocusPaused,
    focusSettings,
    isDistractionShieldActive,
    breakReminderAlert,
    isFocusModalOpen,
    setIsFocusModalOpen,
    isDistractionSettingsModalOpen,
    setIsDistractionSettingsModalOpen,
    startFocus,
    switchFocusPhase,
    pauseFocus,
    resumeFocus,
    completeFocus,
    cancelFocus,
    updateFocusSettings,
    dismissBreakAlert,
    rooms,
  } = useApp();

  return (
    <div className={`app-shell ${isDistractionShieldActive && focusSettings?.hideNonEssentialNav ? 'distraction-shield-mode' : ''}`} id="app-shell">
      {/* Desktop Left Sidebar */}
      <Sidebar />

      {/* Mobile Drawer & Bottom Tab Bar */}
      <MobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      {/* Main App Column */}
      <div className="app-column">
        {/* Progressive Web App Network, Update & Install Notifications */}
        <PWANotifications />

        {/* Distraction Shield Status Banner */}
        {isDistractionShieldActive && (
          <div
            id="distraction-shield-active-banner"
            className="row-between"
            style={{
              padding: '6px 16px',
              backgroundColor: 'var(--color-bg-subtle)',
              borderBottom: '1px solid var(--color-border-subtle)',
              fontSize: '11px',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
            }}
          >
            <div className="row" style={{ gap: '8px', alignItems: 'center' }}>
              <Badge variant="accent">🛡️ Distraction Shield Active</Badge>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                In-app alerts muted
              </span>
              {activeFocusInterval && (
                <span style={{ fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                  &bull; {activeFocusInterval.topic} ({isFocusPaused ? 'Paused' : `${Math.floor(focusIntervalRemainingSeconds / 60)}m left`})
                </span>
              )}
            </div>

            <div className="row" style={{ gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setIsDistractionSettingsModalOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Shield Settings
              </button>
              <button
                type="button"
                onClick={() => setIsFocusModalOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-accent)',
                  fontWeight: 'var(--font-bold)',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                Focus Timer Workspace &rarr;
              </button>
            </div>
          </div>
        )}

        <Topbar onToggleMobileNav={() => setMobileNavOpen(true)} />
        <main className="app-main" id="main-content">
          <div className="content-container">
            {children || <Outlet />}
          </div>
        </main>
      </div>

      {/* Global Modals & Feedback Notifications */}
      <Toast toast={toast} onClose={hideToast} />

      <PartnerProfileModal
        partner={selectedPartner}
        isOpen={Boolean(selectedPartner)}
        onClose={() => setSelectedPartner(null)}
      />

      <NoteDetailModal
        note={selectedNote}
        isOpen={Boolean(selectedNote)}
        onClose={() => setSelectedNote(null)}
      />

      <CreateNoteModal
        isOpen={isCreateNoteOpen}
        onClose={() => setIsCreateNoteOpen(false)}
      />

      <CreateRoomModal
        isOpen={isCreateRoomOpen}
        onClose={() => setIsCreateRoomOpen(false)}
        onCreateSuccess={(newRoom) => {
          setIsCreateRoomOpen(false);
          if (newRoom?.id) {
            navigate(`${ROUTES.ROOMS}?room=${newRoom.id}`);
          }
        }}
      />

      {/* Goal-Oriented Focus Mode Workspace Modal */}
      <FocusModeModal
        isOpen={isFocusModalOpen}
        onClose={() => setIsFocusModalOpen(false)}
        activeInterval={activeFocusInterval}
        remainingSeconds={focusIntervalRemainingSeconds}
        elapsedSeconds={focusIntervalSecondsElapsed}
        isPaused={isFocusPaused}
        onStartFocus={startFocus}
        onSwitchPhase={switchFocusPhase}
        onPauseFocus={pauseFocus}
        onResumeFocus={resumeFocus}
        onCompleteFocus={completeFocus}
        onCancelFocus={cancelFocus}
        rooms={rooms || []}
        onOpenSettings={() => {
          setIsFocusModalOpen(false);
          setIsDistractionSettingsModalOpen(true);
        }}
      />

      {/* Phase 11: Break Reminder Modal */}
      <BreakReminderModal
        isOpen={Boolean(breakReminderAlert)}
        onClose={dismissBreakAlert}
        topic={breakReminderAlert?.topic}
        breakDurationMinutes={breakReminderAlert?.durationMinutes || 5}
        onStartNextSprint={() => {
          dismissBreakAlert();
          setIsFocusModalOpen(true);
        }}
      />

      {/* Phase 11: Distraction Shield Settings Modal */}
      <DistractionShieldSettingsModal
        isOpen={isDistractionSettingsModalOpen}
        onClose={() => setIsDistractionSettingsModalOpen(false)}
        settings={focusSettings}
        onSave={updateFocusSettings}
      />
    </div>
  );
}

export default AppLayout;
