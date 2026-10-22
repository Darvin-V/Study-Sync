import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import {
  Button,
  SearchField,
  RoomCard,
  EmptyState,
  CreateRoomModal,
  RoomDetailView,
  JoinWithCodeModal,
} from '../components';
import { useApp } from '../context/AppContext';
import { usePreferences } from '../context/PreferencesContext';

export function Rooms() {
  const navigate = useNavigate();
  const { t } = usePreferences();
  const [searchParams, setSearchParams] = useSearchParams();
  const roomIdFromUrl = searchParams.get('room');

  const {
    rooms,
    isRoomsLoading,
    roomsError,
    refreshRooms,
    joinedRoomIds,
    isCreateRoomOpen,
    setIsCreateRoomOpen,
    fetchRoomById,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(roomIdFromUrl);

  const [detailRoom, setDetailRoom] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isJoinCodeModalOpen, setIsJoinCodeModalOpen] = useState(false);
  const [prefilledCode, setPrefilledCode] = useState('');

  // Sync state if URL query param changes
  useEffect(() => {
    setSelectedRoomId(roomIdFromUrl);
  }, [roomIdFromUrl]);

  // Open Create Room modal when navigated from Study Call action (?create=true)
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setIsCreateRoomOpen(true);
    }
  }, [searchParams, setIsCreateRoomOpen]);

  // Handle invitation link query params (?code=XXX or ?joinCode=XXX)
  useEffect(() => {
    const codeParam = searchParams.get('code') || searchParams.get('joinCode');
    if (codeParam) {
      setPrefilledCode(codeParam);
      setIsJoinCodeModalOpen(true);
    }
  }, [searchParams]);

  // Load detailed room data with race condition prevention, timeout guard, optimistic caching, and retry capability
  useEffect(() => {
    if (!selectedRoomId) {
      setDetailRoom(null);
      setDetailError(null);
      setIsDetailLoading(false);
      return;
    }

    let isMounted = true;
    const cached = rooms.find((r) => r.id === selectedRoomId);

    // Optimistically initialize detailRoom from cache if available to prevent loading flash
    if (cached) {
      setDetailRoom((prev) => (prev?.id === selectedRoomId ? prev : cached));
    } else {
      setIsDetailLoading(true);
    }
    setDetailError(null);

    // Timeout safety fallback: never leave student stuck indefinitely on network freeze
    const timeoutId = setTimeout(() => {
      if (isMounted && !cached) {
        setIsDetailLoading(false);
        setDetailError(
          'The study room is taking longer than expected to connect. Please try again or return to the room directory.'
        );
      }
    }, 8000);

    fetchRoomById(selectedRoomId)
      .then((res) => {
        if (!isMounted) return;
        clearTimeout(timeoutId);
        setIsDetailLoading(false);
        if (res && res.success && res.room) {
          setDetailRoom(res.room);
          setDetailError(null);
        } else {
          const errMsg = res?.error || 'Study room not found or no longer available.';
          if (!cached || (res && res.error && res.error.toLowerCase().includes('not found'))) {
            setDetailError(errMsg);
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        clearTimeout(timeoutId);
        setIsDetailLoading(false);
        if (!cached) {
          setDetailError(err.message || 'Unable to connect to study room. Please verify your connection.');
        }
      });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [selectedRoomId, loadAttempt, fetchRoomById, rooms]);

  const currentRoomFromContext = rooms.find((r) => r.id === selectedRoomId);
  const activeRoom = detailRoom
    ? { ...(currentRoomFromContext || {}), ...detailRoom }
    : currentRoomFromContext;

  const handleRoomUpdated = useCallback((updated) => {
    if (!updated) return;
    setDetailRoom((prev) => (prev ? { ...prev, ...updated } : updated));
  }, []);

  // Auto-sync room and virtual meeting state when window regains focus or periodically
  useEffect(() => {
    if (!selectedRoomId) return;

    const syncRoom = () => {
      fetchRoomById(selectedRoomId).then((res) => {
        if (res?.success && res.room) {
          setDetailRoom((prev) => ({ ...(prev || {}), ...res.room }));
        }
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncRoom();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', syncRoom);
    const interval = setInterval(syncRoom, 10000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', syncRoom);
      clearInterval(interval);
    };
  }, [selectedRoomId, fetchRoomById]);

  const distinctRoomSubjects = Array.from(
    new Set(rooms.map((r) => r.subject).filter(Boolean))
  );
  const baseSubjects = [
    'Mathematics',
    'Science & Biology',
    'Economics & Commerce',
    'History & Social Studies',
    'Vocational & Technical Trades',
    'Database Systems',
    'Computer Science',
  ];
  const allSubjectNames = Array.from(new Set([...distinctRoomSubjects, ...baseSubjects]));

  // Filtering logic across name, subject, topic, difficulty, language
  const filteredRooms = rooms.filter((room) => {
    const q = searchQuery.toLowerCase().trim();
    const titleOrName = room.title || room.name || room.room_name || '';
    const desc = room.description || '';
    const topic = room.topic || '';
    const subject = room.subject || '';
    const tags = Array.isArray(room.tags) ? room.tags : [];

    const matchesSearch =
      !q ||
      titleOrName.toLowerCase().includes(q) ||
      desc.toLowerCase().includes(q) ||
      topic.toLowerCase().includes(q) ||
      subject.toLowerCase().includes(q) ||
      tags.some((t) => t.toLowerCase().includes(q));

    const matchesSubject =
      selectedSubject === 'all' ||
      subject.toLowerCase() === selectedSubject.toLowerCase();

    const matchesDifficulty =
      selectedDifficulty === 'all' ||
      (room.difficulty || '').toLowerCase() === selectedDifficulty.toLowerCase();

    const matchesLanguage =
      selectedLanguage === 'all' ||
      (Array.isArray(room.languages || room.preferred_languages)
        ? (room.languages || room.preferred_languages).some((l) =>
            l.toLowerCase().includes(selectedLanguage.toLowerCase())
          )
        : (room.language || '').toLowerCase().includes(selectedLanguage.toLowerCase()));

    return matchesSearch && matchesSubject && matchesDifficulty && matchesLanguage;
  });

  const hasActiveFilters = Boolean(
    searchQuery ||
    selectedSubject !== 'all' ||
    selectedDifficulty !== 'all' ||
    selectedLanguage !== 'all'
  );

  function handleClearFilters() {
    setSearchQuery('');
    setSelectedSubject('all');
    setSelectedDifficulty('all');
    setSelectedLanguage('all');
  }

  function handleOpenRoom(room) {
    setSelectedRoomId(room.id);
    setSearchParams({ room: room.id });
  }

  function handleBackToRooms() {
    const convId = searchParams.get('conv');
    if (convId) {
      navigate(`${ROUTES.MESSAGES}?conv=${encodeURIComponent(convId)}`);
      return;
    }
    setSelectedRoomId(null);
    setDetailRoom(null);
    setDetailError(null);
    setIsDetailLoading(false);
    setSearchParams({});
  }

  function handleCreateRoomSuccess(newRoom) {
    setIsCreateRoomOpen(false);
    if (newRoom?.id) {
      handleOpenRoom(newRoom);
    }
  }

  function handleJoinCodeSuccess(room) {
    setIsJoinCodeModalOpen(false);
    if (room?.id) {
      handleOpenRoom(room);
    }
  }

  // 1. Detailed Room View (When ?room=id is selected)
  if (selectedRoomId) {
    if (isDetailLoading && !activeRoom) {
      return (
        <div style={{ textAlign: 'center', padding: 'var(--space-12) var(--space-4)', maxWidth: 460, margin: '0 auto' }} id="room-detail-loading">
          <div
            style={{
              width: 36,
              height: 36,
              border: '3px solid var(--color-border-subtle)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto var(--space-4)',
            }}
          />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
            Loading Room Environment...
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-5)' }}>
            Connecting to your study group and loading recent discussions...
          </p>
          <Button
            variant="ghost"
            size="sm"
            id="room-cancel-load-btn"
            onClick={handleBackToRooms}
            style={{ fontSize: 'var(--text-xs)' }}
          >
            &larr; Cancel and return to all rooms
          </Button>
        </div>
      );
    }

    if (detailError && !activeRoom) {
      return (
        <div
          style={{
            maxWidth: 520,
            margin: 'var(--space-10) auto',
            padding: 'var(--space-6)',
            textAlign: 'center',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-lg)',
          }}
          id="room-detail-error"
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 700,
              margin: '0 auto var(--space-3)',
            }}
          >
            !
          </div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
            Room Unavailable
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-5)', lineHeight: 1.5 }}>
            {detailError}
          </p>
          <div className="row" style={{ gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              id="room-retry-load-btn"
              onClick={() => setLoadAttempt((prev) => prev + 1)}
            >
              Retry Loading
            </Button>
            <Button
              variant="outline"
              id="room-back-btn"
              onClick={handleBackToRooms}
            >
              &larr; {searchParams.get('conv') ? 'Back to conversation' : 'Back to all topic rooms'}
            </Button>
          </div>
        </div>
      );
    }

    if (activeRoom) {
      return (
        <RoomDetailView
          room={activeRoom}
          onBack={handleBackToRooms}
          onRoomUpdate={handleRoomUpdated}
        />
      );
    }
  }

  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }} id="rooms-page">
      {/* 1. Simplified Page Header */}
      <header
        className="row-between"
        style={{
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          paddingBottom: 'var(--space-1)',
        }}
        id="rooms-page-header"
      >
        <div>
          <h1
            style={{
              fontSize: 'var(--text-2xl, 1.5rem)',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {t('rooms.title', 'Study Rooms')}
          </h1>
          <p
            style={{
              fontSize: 'var(--text-sm, 0.875rem)',
              color: 'var(--color-text-secondary)',
              margin: '4px 0 0 0',
            }}
          >
            {t('rooms.subtitle', 'Find a room. Study together.')}
          </p>
        </div>

        <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="secondary"
            id="btn-open-join-code-modal"
            onClick={() => {
              setPrefilledCode('');
              setIsJoinCodeModalOpen(true);
            }}
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            }
          >
            {t('rooms.joinCode', 'Join with Code')}
          </Button>

          <Button
            variant="primary"
            id="btn-open-create-room"
            onClick={() => setIsCreateRoomOpen(true)}
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
          >
            {t('rooms.createRoom', '+ Create Room')}
          </Button>
        </div>
      </header>

      {/* 2. Simplified Search and Compact Filter */}
      <div className="stack" style={{ gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <SearchField
              placeholder={t('rooms.searchPlaceholder', 'Search rooms or topics')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="rooms-search-input"
            />
          </div>

          <Button
            variant={isFilterPanelOpen || hasActiveFilters ? 'secondary' : 'outline'}
            id="rooms-filter-toggle-btn"
            onClick={() => setIsFilterPanelOpen((prev) => !prev)}
            aria-expanded={isFilterPanelOpen}
            aria-label="Toggle filters"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: 40,
              padding: '0 14px',
              whiteSpace: 'nowrap',
              position: 'relative',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span>{t('common.filter', 'Filter')}</span>
            {hasActiveFilters && (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary)',
                }}
              />
            )}
          </Button>
        </div>

        {/* Small compact filter panel (opens conditionally) */}
        {isFilterPanelOpen && (
          <div
            id="rooms-filter-panel"
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 140, flex: '1 1 140px' }}>
              <label htmlFor="filter-subject-select" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                {t('rooms.filterSubject', 'Subject:')}
              </label>
              <select
                id="filter-subject-select"
                className="form-select"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                style={{ fontSize: 'var(--text-xs)', height: 32, padding: '2px 8px', flex: 1 }}
              >
                <option value="all">{t('common.all', 'All Subjects')}</option>
                {allSubjectNames.map((subj) => (
                  <option key={subj} value={subj}>{subj}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 140, flex: '1 1 140px' }}>
              <label htmlFor="filter-language-select" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                {t('rooms.filterLanguage', 'Language:')}
              </label>
              <select
                id="filter-language-select"
                className="form-select"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                style={{ fontSize: 'var(--text-xs)', height: 32, padding: '2px 8px', flex: 1 }}
              >
                <option value="all">{t('common.all', 'All Languages')}</option>
                <option value="English">English</option>
                <option value="Tamil">Tamil</option>
                <option value="Hindi">Hindi</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 140, flex: '1 1 140px' }}>
              <label htmlFor="filter-difficulty-select" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                {t('rooms.filterDifficulty', 'Difficulty:')}
              </label>
              <select
                id="filter-difficulty-select"
                className="form-select"
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                style={{ fontSize: 'var(--text-xs)', height: 32, padding: '2px 8px', flex: 1 }}
              >
                <option value="all">{t('common.all', 'All Difficulties')}</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>

            <Button
              variant="ghost"
              size="sm"
              id="rooms-reset-filters-btn"
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
              style={{ fontSize: '12px', padding: '4px 10px', marginLeft: 'auto' }}
            >
              {t('common.reset', 'Reset filters')}
            </Button>
          </div>
        )}
      </div>

      {/* Loading & Error States */}
      {isRoomsLoading && rooms.length === 0 && (
        <div style={{ textAlign: 'center', padding: 'var(--space-10) 0' }} id="rooms-list-loading">
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid var(--color-border-subtle)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto var(--space-3)',
            }}
          />
          <h3 style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
            {t('rooms.loading', 'Loading study rooms...')}
          </h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            Connecting you with active peer study sessions...
          </p>
        </div>
      )}

      {roomsError && (
        <div
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid #ef4444',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
          }}
          id="rooms-error-state"
        >
          <h3 style={{ color: '#ef4444', fontSize: 'var(--text-base)', marginBottom: 4 }}>
            Unable to load topic rooms from server
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
            {roomsError}
          </p>
          <Button variant="primary" size="sm" onClick={() => refreshRooms()}>
            {t('common.retry', 'Retry Connection')}
          </Button>
        </div>
      )}

      {/* 3. Room Cards Grid */}
      {!isRoomsLoading && !roomsError && (
        <section id="rooms-list-section" aria-label="Study Rooms List">
          {filteredRooms.length > 0 ? (
            <div className="rooms-grid" id="rooms-grid">
              {filteredRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  id={`room-card-${room.id}`}
                  isJoined={joinedRoomIds.has(room.id) || Boolean(room.is_member || room.isMember)}
                  onJoin={() => handleOpenRoom(room)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={t('rooms.emptyTitle', 'No rooms found')}
              description={
                hasActiveFilters
                  ? "No study rooms match your search or filters. Try adjusting your query or reset filters."
                  : t('rooms.emptySub', "No study rooms available at this time. Create one to get started!")
              }
              id="rooms-empty-state"
              action={
                hasActiveFilters ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleClearFilters}
                  >
                    {t('common.reset', 'Reset filters')}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCreateRoomOpen(true)}
                  >
                    {t('rooms.createRoom', '+ Create Room')}
                  </Button>
                )
              }
            />
          )}
        </section>
      )}

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={isCreateRoomOpen}
        onClose={() => setIsCreateRoomOpen(false)}
        onCreateSuccess={handleCreateRoomSuccess}
      />

      {/* Join Room with Code Modal */}
      <JoinWithCodeModal
        isOpen={isJoinCodeModalOpen}
        onClose={() => setIsJoinCodeModalOpen(false)}
        onJoinSuccess={handleJoinCodeSuccess}
        initialCode={prefilledCode}
      />
    </div>
  );
}

export default Rooms;
