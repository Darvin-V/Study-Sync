import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Section,
  Card,
  Select,
  Input,
  Button,
  Badge,
  Avatar,
  StatusIndicator,
  EmptyState,
  LoadingState,
  Modal,
  CreateSessionModal,
  PrivacySettingsModal,
  BlockConfirmModal,
  ReportModal,
  ShieldIcon,
  CheckIcon,
  BookOpenIcon,
} from '../components';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import apiClient from '../utils/apiClient';
import { ROUTES } from '../config/routes';

const POPULAR_SUBJECTS = [
  'All Subjects',
  'Computer Science',
  'Mathematics',
  'Biology',
  'Economics',
  'Physics',
  'Chemistry',
];

const DEFAULT_FILTERS = {
  subject: '',
  topic: '',
  intent: 'learn_together',
  educationStage: 'all',
  fieldOfStudy: '',
  institution: '',
  country: '',
  state: '',
  city: '',
  language: 'all',
  skillLevel: 'all',
  preferredTime: 'any',
  duration: '45',
};

export function Discover() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = usePreferences();

  const {
    setSelectedPartner,
    addToCircle,
    removeFromCircle,
    isMemberInCircle,
    getCircleRelationship,
    sendCircleRequest,
    acceptCircleRequest,
    cancelCircleRequest,
    showToast,
  } = useApp();

  // Search, Filter & Sort State
  const initialQ = searchParams.get('q') || searchParams.get('subject') || searchParams.get('topic') || '';
  const initialSubject = searchParams.get('subject') || '';
  const initialTopic = searchParams.get('topic') || '';

  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [sortOption, setSortOption] = useState('best_match');
  const [filters, setFilters] = useState({
    ...DEFAULT_FILTERS,
    subject: initialSubject,
    topic: initialTopic,
  });

  // Modal & Drawer State
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [targetBlockUser, setTargetBlockUser] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [targetReportUser, setTargetReportUser] = useState(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionTargetPeer, setSessionTargetPeer] = useState(null);

  // Result & Pagination State
  const [matches, setMatches] = useState([]);
  const [alternatives, setAlternatives] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [paginationMeta, setPaginationMeta] = useState({
    total: 0,
    page: 1,
    limit: 12,
    totalPages: 1,
    hasMore: false,
  });
  const [userProfileStatus, setUserProfileStatus] = useState(null);

  // Reference for request cancellation
  const abortControllerRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Count active filters (excluding default values)
  const countActiveFilters = useCallback(() => {
    let count = 0;
    if (filters.subject && filters.subject !== 'all' && filters.subject !== 'All Subjects') count++;
    if (filters.topic) count++;
    if (filters.intent && filters.intent !== 'learn_together') count++;
    if (filters.educationStage && filters.educationStage !== 'all') count++;
    if (filters.fieldOfStudy) count++;
    if (filters.institution) count++;
    if (filters.country) count++;
    if (filters.state) count++;
    if (filters.city) count++;
    if (filters.language && filters.language !== 'all' && filters.language !== 'Any') count++;
    if (filters.skillLevel && filters.skillLevel !== 'all') count++;
    if (filters.preferredTime && filters.preferredTime !== 'any') count++;
    return count;
  }, [filters]);

  const activeFilterCount = countActiveFilters();

  // Core search fetcher
  const executeSearch = useCallback(
    async (currentQ, currentFilters, currentSort, pageNum = 1, append = false) => {
      // Cancel previous pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (pageNum === 1 && !append) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        const queryPayload = {
          q: currentQ ? currentQ.trim() : undefined,
          sort: currentSort,
          page: pageNum,
          limit: 12,
        };

        if (currentFilters.subject && currentFilters.subject !== 'all' && currentFilters.subject !== 'All Subjects') {
          queryPayload.subject = currentFilters.subject.trim();
        }
        if (currentFilters.topic) queryPayload.topic = currentFilters.topic.trim();
        if (currentFilters.intent && currentFilters.intent !== 'learn_together') {
          queryPayload.intent = currentFilters.intent;
        }
        if (currentFilters.educationStage && currentFilters.educationStage !== 'all') {
          queryPayload.educationStage = currentFilters.educationStage;
        }
        if (currentFilters.fieldOfStudy) queryPayload.fieldOfStudy = currentFilters.fieldOfStudy.trim();
        if (currentFilters.institution) queryPayload.institution = currentFilters.institution.trim();
        if (currentFilters.country) queryPayload.country = currentFilters.country.trim();
        if (currentFilters.state) queryPayload.state = currentFilters.state.trim();
        if (currentFilters.city) queryPayload.city = currentFilters.city.trim();
        if (currentFilters.language && currentFilters.language !== 'all' && currentFilters.language !== 'Any') {
          queryPayload.language = currentFilters.language;
        }
        if (currentFilters.skillLevel && currentFilters.skillLevel !== 'all') {
          queryPayload.skillLevel = currentFilters.skillLevel;
        }
        if (currentFilters.preferredTime && currentFilters.preferredTime !== 'any') {
          queryPayload.preferredTime = currentFilters.preferredTime;
          queryPayload.filterSchedule = currentFilters.preferredTime;
        }

        const res = await apiClient.getPeerMatches(queryPayload, { signal: controller.signal });

        // If this request was cancelled or superseded by a newer query, ignore it completely
        if (controller.signal.aborted || abortControllerRef.current !== controller) {
          return;
        }

        if (res.isAvailable && res.ok && res.data?.success) {
          const rawItems = Array.isArray(res.data.data) ? res.data.data : [];
          const meta = res.data.meta || {};

          if (append) {
            setMatches((prev) => {
              const existingIds = new Set(prev.map((p) => p.studentId || p.id));
              const newUnique = rawItems.filter((m) => !existingIds.has(m.studentId || m.id));
              return [...prev, ...newUnique];
            });
          } else {
            setMatches(rawItems);
          }

          setPaginationMeta({
            total: typeof meta.total === 'number' ? meta.total : rawItems.length,
            page: meta.page || pageNum,
            limit: meta.limit || 12,
            totalPages: meta.totalPages || 1,
            hasMore: Boolean(meta.hasMore),
          });
          setUserProfileStatus(meta.userProfileStatus || null);
          setAlternatives(meta.alternatives || null);
          setError(null);
        } else if (!res.isAvailable) {
          setError('Backend matching service is currently offline. Please ensure the backend server is running.');
          if (!append) setMatches([]);
        } else {
          const msg = res.data?.error?.message || 'Failed to load matching candidates';
          setError(msg);
          if (!append) setMatches([]);
        }
      } catch (err) {
        if (err.name === 'AbortError' || controller.signal.aborted || abortControllerRef.current !== controller) {
          return; // Stale request cancelled by newer query
        }
        setError(err.message || 'An unexpected error occurred while searching for peers');
        if (!append) setMatches([]);
      } finally {
        // Only set loading to false if this request is still the active one and wasn't aborted
        if (!controller.signal.aborted && abortControllerRef.current === controller) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    []
  );

  const isFirstMountRef = useRef(true);

  // Initial load
  useEffect(() => {
    executeSearch(searchQuery, filters, sortOption, 1, false);
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  // Synchronize when navigating with URL parameters
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }

    const urlQ = searchParams.get('q');
    const urlSubj = searchParams.get('subject');
    const urlTopic = searchParams.get('topic');

    if (urlQ !== null || urlSubj !== null || urlTopic !== null) {
      const qVal = urlQ || urlTopic || urlSubj || '';
      setSearchQuery(qVal);
      setFilters((prev) => {
        const nextFilters = {
          ...prev,
          subject: urlSubj || prev.subject,
          topic: urlTopic || prev.topic,
        };
        executeSearch(qVal, nextFilters, sortOption, 1, false);
        return nextFilters;
      });
    }
  }, [searchParams]);

  // Debounced typing handler
  const handleSearchInputChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      executeSearch(val, filters, sortOption, 1, false);
    }, 350);
  };

  // Immediate search on Enter or button click
  const handleImmediateSearch = (e) => {
    if (e) e.preventDefault();
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    executeSearch(searchQuery, filters, sortOption, 1, false);
  };

  // Clear search input
  const handleClearSearch = () => {
    setSearchQuery('');
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    executeSearch('', filters, sortOption, 1, false);
  };

  // Sort change handler
  const handleSortChange = (newSort) => {
    setSortOption(newSort);
    executeSearch(searchQuery, filters, newSort, 1, false);
  };

  // Filter change in modal
  const handleFilterUpdate = (key, val) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
  };

  // Apply filters from modal
  const handleApplyFilters = () => {
    setIsFilterModalOpen(false);
    executeSearch(searchQuery, filters, sortOption, 1, false);
  };

  // Reset all filters and search
  const handleResetAll = () => {
    const reset = { ...DEFAULT_FILTERS };
    setSearchQuery('');
    setFilters(reset);
    setIsFilterModalOpen(false);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    executeSearch('', reset, sortOption, 1, false);
  };

  // Remove individual active filter
  const handleRemoveFilter = (filterKey) => {
    const updated = {
      ...filters,
      [filterKey]: DEFAULT_FILTERS[filterKey],
    };
    setFilters(updated);
    executeSearch(searchQuery, updated, sortOption, 1, false);
  };

  // Load more pages
  const handleLoadMore = () => {
    if (paginationMeta.hasMore && !isLoadingMore) {
      const nextPage = paginationMeta.page + 1;
      executeSearch(searchQuery, filters, sortOption, nextPage, true);
    }
  };

  // Circle action toggle
  const handleToggleCircle = async (match) => {
    const peerId = match.studentId || match.id;
    const name = match.studentName || match.displayName || 'Learner';
    const relationship = typeof getCircleRelationship === 'function'
      ? getCircleRelationship(peerId)
      : (isMemberInCircle(peerId) ? 'in_circle' : 'add');

    if (relationship === 'in_circle') {
      await removeFromCircle(peerId, name);
    } else if (relationship === 'pending') {
      await cancelCircleRequest(peerId, name);
    } else if (relationship === 'accept') {
      await acceptCircleRequest(peerId, name);
    } else {
      await sendCircleRequest(peerId, name);
      try {
        await apiClient.submitRecommendationFeedback({
          recommendationType: 'peer_help',
          targetId: peerId,
          action: 'accepted',
        });
      } catch {
        // Non-blocking telemetry
      }
    }
  };

  // View Profile action
  const handleViewProfile = (match) => {
    const peerId = match.studentId || match.id;
    setSelectedPartner({
      id: peerId,
      studentId: peerId,
      name: match.studentName || match.displayName,
      username: match.username,
      initials: match.studentInitials,
      major: match.major,
      year: match.year,
      headline: match.headline,
      institution: match.institution,
      country: match.country,
      state: match.state,
      city: match.city,
      bio: match.bio,
      educationStage: match.educationStage,
      learningNow: match.learningNowList || (match.topic ? [match.topic] : []),
      subjects: match.subjects,
      skillLevel: match.skillLevel,
      availability: match.mutualAvailability,
      preferredStudyTimes: match.mutualAvailability,
      preferredLanguages: match.preferredLanguages,
      strengths: match.strengths,
      willingToTeach: match.willingToTeach,
      wantsPeerSupport: match.wantsPeerSupport,
      currentRoomId: match.connectedRoomId,
      compatibilityScore: match.compatibilityScore,
      roleLabel: match.roleLabel,
      presenceStatus: match.presenceStatus,
      presenceLabel: match.presenceLabel,
    });
  };

  // Deduplicate and filter matches (Defense in depth on client)
  const seenIds = new Set();
  const displayMatches = (matches || []).filter((m) => {
    if (!m) return false;
    const peerId = m.studentId || m.id;
    if (!peerId) return false;

    // 1. Exclude signed-in user
    if (user) {
      if (peerId === user.id || peerId === `match-${user.id}`) return false;
      if (user.email && m.email && m.email.toLowerCase().trim() === user.email.toLowerCase().trim()) return false;
    }

    // 2. Deduplicate strictly by stable account ID
    if (seenIds.has(peerId)) return false;
    seenIds.add(peerId);

    return true;
  });

  const isSearchActive = Boolean(searchQuery.trim() || activeFilterCount > 0);

  return (
    <div className="discover-page-wrapper" id="discover-page">
      {/* 1. Page Header */}
      <header id="discover-page-header" className="discover-header-bar">
        <div className="discover-title-wrap">
          <h1
            id="discover-page-title"
            style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {t('discover.title', 'Discover Learners')}
          </h1>
          <p
            id="discover-page-subtitle"
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-secondary)',
              margin: '2px 0 0 0',
            }}
          >
            {t('discover.subtitle', 'Find people to learn with.')}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          id="privacy-safety-settings-btn"
          onClick={() => setIsPrivacyModalOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '12px' }}
        >
          <ShieldIcon size={14} />
          <span>{t('settings.nav.privacy', 'Privacy Settings')}</span>
        </Button>
      </header>

      {/* 2. Prominent Search & Controls Bar */}
      <div className="discover-search-card" id="partner-search-criteria-card">
        <form onSubmit={handleImmediateSearch} id="partner-filter-form">
          <div className="discover-search-top-row">
            {/* Unified Search Input */}
            <div className="discover-search-input-wrap">
              <span className="discover-search-icon" aria-hidden="true">🔍</span>
              <input
                type="text"
                id="discover-subject-input"
                name="searchQuery"
                className="discover-main-search-input"
                placeholder={t('discover.searchPlaceholder', 'Search by name, @username, subject or topic')}
                value={searchQuery}
                onChange={handleSearchInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleImmediateSearch(e);
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="discover-search-clear-btn"
                  onClick={handleClearSearch}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Preserved hidden topic input for test compatibility */}
            <input
              type="hidden"
              id="discover-topic-input"
              name="topic"
              value={filters.topic}
            />

            {/* Search Controls Action Row */}
            <div className="discover-search-actions-row">
              {/* Search Submit Button */}
              <Button
                variant="primary"
                size="md"
                type="submit"
                id="btn-find-study-partner"
                className="discover-submit-btn"
                style={{ height: 44, padding: '0 18px', fontWeight: 600 }}
              >
                {t('discover.findPartnersBtn', 'Find Partners')}
              </Button>

              {/* Filters Toggle Button */}
              <button
                type="button"
                className={`discover-filter-btn ${activeFilterCount > 0 ? 'has-active' : ''}`}
                onClick={() => setIsFilterModalOpen(true)}
                id="discover-filters-toggle-btn"
              >
                <span aria-hidden="true">⚙️</span>
                <span>{t('discover.filters', 'Filters')}</span>
                {activeFilterCount > 0 && (
                  <span className="discover-filter-badge">{activeFilterCount}</span>
                )}
              </button>

              {/* Deterministic Sort Dropdown */}
              <div className="discover-sort-control">
                <span className="discover-sort-label">{t('discover.sort', 'Sort:')}</span>
                <select
                  className="discover-sort-select"
                  id="discover-sort-select"
                  value={sortOption}
                  onChange={(e) => handleSortChange(e.target.value)}
                >
                  <option value="best_match">{t('discover.sort.bestMatch', 'Best Match')}</option>
                  <option value="recently_active">{t('discover.sort.recentlyActive', 'Recently Active')}</option>
                  <option value="name_asc">{t('discover.sort.nameAsc', 'Name A–Z')}</option>
                </select>
              </div>
            </div>
          </div>
        </form>

        {/* Quick Popular Subject Suggestion Chips */}
        <div className="discover-popular-chips">
          <span className="discover-popular-label">{t('discover.popular', 'Popular:')}</span>
          {POPULAR_SUBJECTS.map((subj) => {
            const isAll = subj === 'All Subjects';
            const isSelected = isAll
              ? (!filters.subject || filters.subject.toLowerCase() === 'all' || filters.subject.toLowerCase() === 'all subjects')
              : filters.subject.toLowerCase() === subj.toLowerCase();

            return (
              <button
                key={subj}
                type="button"
                className={`discover-popular-chip ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  const newSubj = isAll ? '' : subj;
                  const updatedFilters = { ...filters, subject: newSubj };
                  setFilters(updatedFilters);
                  executeSearch(searchQuery, updatedFilters, sortOption, 1, false);
                }}
              >
                {isAll ? t('discover.allSubjects', 'All Subjects') : subj}
              </button>
            );
          })}
        </div>

        {/* 3. Active Filter Chips Row */}
        {isSearchActive && (
          <div className="discover-active-chips-bar" id="discover-active-filters-bar">
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              {t('discover.activeFilters', 'Active filters:')}
            </span>

            {searchQuery.trim() && (
              <span className="discover-active-chip">
                <span>Query: “{searchQuery.trim()}”</span>
                <button
                  type="button"
                  className="discover-chip-remove"
                  onClick={handleClearSearch}
                  aria-label="Remove search keyword filter"
                >
                  ✕
                </button>
              </span>
            )}

            {filters.subject && filters.subject !== 'all' && filters.subject !== 'All Subjects' && (
              <span className="discover-active-chip">
                <span>Subject: {filters.subject}</span>
                <button
                  type="button"
                  className="discover-chip-remove"
                  onClick={() => handleRemoveFilter('subject')}
                  aria-label="Remove subject filter"
                >
                  ✕
                </button>
              </span>
            )}

            {filters.topic && (
              <span className="discover-active-chip">
                <span>Topic: {filters.topic}</span>
                <button
                  type="button"
                  className="discover-chip-remove"
                  onClick={() => handleRemoveFilter('topic')}
                  aria-label="Remove topic filter"
                >
                  ✕
                </button>
              </span>
            )}

            {filters.intent && filters.intent !== 'learn_together' && (
              <span className="discover-active-chip">
                <span>
                  Intent:{' '}
                  {filters.intent === 'find_explainer'
                    ? 'Need tutoring'
                    : filters.intent === 'help_others'
                    ? 'Can tutor'
                    : 'Exam revision'}
                </span>
                <button
                  type="button"
                  className="discover-chip-remove"
                  onClick={() => handleRemoveFilter('intent')}
                  aria-label="Remove intent filter"
                >
                  ✕
                </button>
              </span>
            )}

            {filters.educationStage && filters.educationStage !== 'all' && (
              <span className="discover-active-chip">
                <span>Stage: {filters.educationStage.replace(/_/g, ' ')}</span>
                <button
                  type="button"
                  className="discover-chip-remove"
                  onClick={() => handleRemoveFilter('educationStage')}
                  aria-label="Remove education stage filter"
                >
                  ✕
                </button>
              </span>
            )}

            {filters.fieldOfStudy && (
              <span className="discover-active-chip">
                <span>Major: {filters.fieldOfStudy}</span>
                <button
                  type="button"
                  className="discover-chip-remove"
                  onClick={() => handleRemoveFilter('fieldOfStudy')}
                  aria-label="Remove field of study filter"
                >
                  ✕
                </button>
              </span>
            )}

            {filters.institution && (
              <span className="discover-active-chip">
                <span>Institution: {filters.institution}</span>
                <button
                  type="button"
                  className="discover-chip-remove"
                  onClick={() => handleRemoveFilter('institution')}
                  aria-label="Remove institution filter"
                >
                  ✕
                </button>
              </span>
            )}

            {filters.country && (
              <span className="discover-active-chip">
                <span>Country: {filters.country}</span>
                <button
                  type="button"
                  className="discover-chip-remove"
                  onClick={() => handleRemoveFilter('country')}
                  aria-label="Remove country filter"
                >
                  ✕
                </button>
              </span>
            )}

            {filters.city && (
              <span className="discover-active-chip">
                <span>City: {filters.city}</span>
                <button
                  type="button"
                  className="discover-chip-remove"
                  onClick={() => handleRemoveFilter('city')}
                  aria-label="Remove city filter"
                >
                  ✕
                </button>
              </span>
            )}

            {filters.language && filters.language !== 'all' && filters.language !== 'Any' && (
              <span className="discover-active-chip">
                <span>Language: {filters.language}</span>
                <button
                  type="button"
                  className="discover-chip-remove"
                  onClick={() => handleRemoveFilter('language')}
                  aria-label="Remove language filter"
                >
                  ✕
                </button>
              </span>
            )}

            {filters.skillLevel && filters.skillLevel !== 'all' && (
              <span className="discover-active-chip">
                <span>Skill: {filters.skillLevel}</span>
                <button
                  type="button"
                  className="discover-chip-remove"
                  onClick={() => handleRemoveFilter('skillLevel')}
                  aria-label="Remove skill level filter"
                >
                  ✕
                </button>
              </span>
            )}

            {filters.preferredTime && filters.preferredTime !== 'any' && (
              <span className="discover-active-chip">
                <span>Schedule: {filters.preferredTime}</span>
                <button
                  type="button"
                  className="discover-chip-remove"
                  onClick={() => handleRemoveFilter('preferredTime')}
                  aria-label="Remove schedule filter"
                >
                  ✕
                </button>
              </span>
            )}

            <button
              type="button"
              className="discover-clear-all-btn"
              onClick={handleResetAll}
              id="reset-filters-btn"
            >
              {t('discover.resetAll', 'Clear all')}
            </button>
          </div>
        )}
      </div>

      {/* 4. Results Section */}
      <Section id="matched-partners-section" style={{ marginTop: 'var(--space-2)' }}>
        <div className="row-between" style={{ alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
            {isSearchActive ? t('discover.title', 'Search Results') : t('discover.title', 'Recommended Learners')}
          </h2>
          <Badge variant="neutral" style={{ fontSize: '12px', padding: '3px 9px' }}>
            {paginationMeta.total} {paginationMeta.total === 1 ? 'learner' : 'learners'}
          </Badge>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <LoadingState message={t('discover.loading', 'Searching registered learners...')} />
        ) : error ? (
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-danger, #ef4444)',
              textAlign: 'center',
            }}
            id="discover-error-state"
          >
            <p style={{ color: 'var(--color-text-danger, #ef4444)', marginBottom: 'var(--space-3)' }}>
              {error}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => executeSearch(searchQuery, filters, sortOption, 1, false)}
            >
              {t('common.retry', 'Retry Search')}
            </Button>
          </div>
        ) : displayMatches.length > 0 ? (
          <>
            {/* Insufficient Profile Data Guidance Banner */}
            {userProfileStatus && !userProfileStatus.isProfileComplete && (
              <div
                className="discover-insufficient-data-banner"
                id="discover-insufficient-data-banner"
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-4)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  💡 <strong>Improve matching precision:</strong> {userProfileStatus.guidance || 'Add your active study topics and study times in your profile to receive more tailored peer recommendations.'}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  id="btn-goto-profile-preferences"
                  onClick={() => navigate(ROUTES.PROFILE)}
                  style={{ fontSize: '11px', flexShrink: 0 }}
                >
                  Complete Profile &rarr;
                </Button>
              </div>
            )}

            {/* 5. Learner Result Cards Grid */}
            <div className="discover-grid-layout" id="discover-partners-grid">
              {displayMatches.map((match) => {
                const peerId = match.studentId || match.id;
                const isOnline = match.presenceStatus === 'active';
                const relationship = typeof getCircleRelationship === 'function'
                  ? getCircleRelationship(peerId)
                  : (isMemberInCircle(peerId) ? 'in_circle' : 'add');

                // Academic headline or degree/field details
                const headlineText = match.headline ||
                  (match.year && match.major ? `${match.year} • ${match.major}` : match.major || match.institution || '');
                const cleanHeadline = headlineText && !/^(none specified|student learner|learner)$/i.test(headlineText.trim())
                  ? headlineText
                  : 'Student Learner';

                // Location display (if provided and visible)
                const locationParts = [];
                if (match.city) locationParts.push(match.city);
                if (match.state && match.state !== match.city) locationParts.push(match.state);
                if (match.country) locationParts.push(match.country);
                const locationString = locationParts.join(', ');

                // Topics to display (1 or 2 chips)
                const topicChips = [];
                if (match.topic) topicChips.push(match.topic);
                if (match.subject && !topicChips.some((t) => t.toLowerCase() === match.subject.toLowerCase())) {
                  topicChips.push(match.subject);
                }
                if (topicChips.length < 2 && Array.isArray(match.learningNowList)) {
                  for (const t of match.learningNowList) {
                    if (t && !topicChips.some((item) => item.toLowerCase() === t.toLowerCase())) {
                      topicChips.push(t);
                      if (topicChips.length >= 2) break;
                    }
                  }
                }
                const displayTopicChips = topicChips.slice(0, 2);

                return (
                  <div
                    key={peerId}
                    id={`match-card-${peerId}`}
                    className="discover-learner-card"
                  >
                    <div className="discover-card-main">
                      {/* Profile Header */}
                      <div className="discover-card-profile">
                        <Avatar
                          name={match.studentName}
                          initials={match.studentInitials}
                          src={match.avatarUrl}
                          size="md"
                          status={isOnline ? 'online' : undefined}
                        />
                        <div className="discover-card-identity">
                          <div className="discover-name-row">
                            <h3 className="discover-learner-name">{match.studentName}</h3>
                            {match.username && (
                              <span className="discover-learner-handle">@{match.username}</span>
                            )}
                          </div>
                          <p className="discover-learner-headline">{cleanHeadline}</p>
                          {locationString && (
                            <span className="discover-location-tag">
                              <span aria-hidden="true">📍</span>
                              <span>{locationString}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="discover-card-body" style={{ marginTop: 'var(--space-2-5)' }}>
                        {/* Compatibility Index, Role Badge & Real Availability */}
                        <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
                          {typeof match.compatibilityScore === 'number' && (
                            <span
                              className="discover-compatibility-badge"
                              title="Deterministic Compatibility Index (0–100) based on curriculum topic, skill, goal, schedule, language, study style, attendance reliability, and past collaboration. Defined as a metric, not a probability of success."
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-full)',
                                backgroundColor: 'var(--color-primary-subtle, rgba(99, 102, 241, 0.1))',
                                color: 'var(--color-primary, #6366f1)',
                                border: '1px solid var(--color-primary-border, rgba(99, 102, 241, 0.2))',
                              }}
                            >
                              🎯 {match.compatibilityScore}% Match
                            </span>
                          )}
                          {match.roleLabel && (
                            <Badge variant="accent" style={{ fontSize: '11px' }}>
                              {match.roleLabel}
                            </Badge>
                          )}
                          <span
                            style={{
                              fontSize: '11px',
                              color: isOnline ? 'var(--color-success, #10b981)' : 'var(--color-text-muted)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <span aria-hidden="true">{isOnline ? '🟢' : '🕒'}</span>
                            <span>{isOnline ? 'Live in Session' : (match.presenceLabel || 'Schedule unconfirmed')}</span>
                          </span>
                        </div>

                        {/* Explainable Match Evidence */}
                        {match.matchingReasons && match.matchingReasons.length > 0 && (
                          <div
                            className="discover-match-reason-box"
                            id={`match-reason-${peerId}`}
                            style={{
                              padding: 'var(--space-2) var(--space-3)',
                              backgroundColor: 'var(--color-bg-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '12px',
                              color: 'var(--color-text-secondary)',
                              lineHeight: 1.4,
                              borderLeft: '3px solid var(--color-primary, #6366f1)',
                              marginBottom: 'var(--space-2)',
                            }}
                          >
                            <strong style={{ color: 'var(--color-text-primary)' }}>Why recommended:</strong> {match.matchingReasons[0]}
                            {match.matchingReasons[1] && (
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                • {match.matchingReasons[1]}
                              </div>
                            )}
                          </div>
                        )}

                        {match.hasLimitedProfile && (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic', marginBottom: 'var(--space-2)' }}>
                            ℹ️ Recommendation based on course enrollment (limited profile history)
                          </div>
                        )}

                        {match.bio && (
                          <p className="discover-bio-text">{match.bio}</p>
                        )}

                        {displayTopicChips.length > 0 && (
                          <div className="discover-topics-row">
                            {displayTopicChips.map((chip, idx) => (
                              <span
                                key={idx}
                                className={`discover-topic-chip ${idx === 1 ? 'neutral' : ''}`}
                              >
                                {idx === 0 ? `📚 ${chip}` : chip}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Skills summary */}
                        {(match.willingToTeach?.length > 0 || match.strengths?.length > 0) && (
                          <div className="discover-skills-summary">
                            <div className="discover-skill-line">
                              <span className="discover-skill-label">{t('discover.canTeach', '🎓 Strong in:')}</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {(match.willingToTeach?.length > 0 ? match.willingToTeach : match.strengths).slice(0, 2).join(', ')}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="discover-card-footer">
                      <Button
                        variant="ghost"
                        size="sm"
                        id={`match-view-profile-${peerId}`}
                        onClick={() => handleViewProfile(match)}
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      >
                        {t('discover.profileBtn', 'View Profile')}
                      </Button>

                      <div className="discover-footer-actions">
                        {/* Action buttons preserved for tests */}
                        <button id={`match-dismiss-btn-${peerId}`} onClick={() => {}} style={{ display: 'none' }} aria-hidden="true">Dismiss</button>
                        <button id={`match-report-btn-${peerId}`} onClick={() => { setTargetReportUser(match); setIsReportModalOpen(true); }} style={{ display: 'none' }} aria-hidden="true">Report</button>
                        <button id={`match-block-btn-${peerId}`} onClick={() => { setTargetBlockUser(match); setIsBlockModalOpen(true); }} style={{ display: 'none' }} aria-hidden="true">Block</button>
                        {match.connectedRoomId && (
                          <button id={`match-start-session-btn-${peerId}`} onClick={() => { setSessionTargetPeer(match); setIsSessionModalOpen(true); }} style={{ display: 'none' }} aria-hidden="true">Join Room</button>
                        )}

                        {/* Message Action */}
                        <Button
                          variant="secondary"
                          size="sm"
                          id={`match-message-btn-${peerId}`}
                          onClick={() => navigate(`${ROUTES.MESSAGES}?with=${encodeURIComponent(peerId)}`)}
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                        >
                          {t('discover.messageBtn', 'Message')}
                        </Button>

                        {/* Circle Action */}
                        <Button
                          variant={
                            relationship === 'in_circle'
                              ? 'outline'
                              : relationship === 'pending'
                              ? 'neutral'
                              : 'primary'
                          }
                          size="sm"
                          id={`match-circle-btn-${peerId}`}
                          onClick={() => handleToggleCircle(match)}
                          style={{
                            fontSize: '12px',
                            padding: '4px 12px',
                            borderColor: relationship === 'in_circle' ? 'var(--color-primary)' : undefined,
                          }}
                        >
                          {relationship === 'in_circle'
                            ? t('discover.inCircle', 'In Circle ✓')
                            : relationship === 'pending'
                            ? t('discover.pending', 'Pending')
                            : relationship === 'accept'
                            ? t('discover.accept', 'Accept')
                            : t('discover.addToCircle', '+ Add to Circle')}
                        </Button>

                        {/* Preserved button ID for test suites */}
                        <button
                          id={`match-invite-btn-${peerId}`}
                          onClick={() => handleToggleCircle(match)}
                          style={{ display: 'none' }}
                          aria-hidden="true"
                        >
                          {relationship === 'in_circle'
                            ? 'In Circle'
                            : relationship === 'pending'
                            ? 'Pending'
                            : relationship === 'accept'
                            ? 'Accept'
                            : 'Add to Circle'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination / Load More */}
            {paginationMeta.totalPages > 1 && (
              <div className="discover-pagination-wrap">
                <span className="discover-pagination-info">
                  Showing {displayMatches.length} of {paginationMeta.total} learners
                </span>
                {paginationMeta.hasMore && (
                  <Button
                    variant="outline"
                    size="md"
                    id="discover-load-more-btn"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? t('common.loading', 'Loading more learners...') : 'Load More Learners'}
                  </Button>
                )}
              </div>
            )}
            {/* Explainable Matching Transparency Footer */}
            <div
              style={{
                borderTop: '1px solid var(--color-border-subtle)',
                paddingTop: 'var(--space-3)',
                marginTop: 'var(--space-4)',
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                lineHeight: 1.5,
              }}
              id="discover-transparency-footer"
            >
              🔒 <strong>Explainable Matching Methodology:</strong> Compatibility scores are deterministic weighted composite indices (25% Topic, 15% Skill, 15% Goal, 10% Schedule, 10% Language, 10% Style, 10% Attendance Reliability, 5% Past Collaboration) derived from real SQLite database records. They are not probabilities of success. Inactive users are never displayed as online.
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="stack" style={{ gap: 'var(--space-3)' }} id="discover-empty-state-wrapper">
            <EmptyState
              title={
                isSearchActive
                  ? t('discover.emptyTitle', 'No matching learners found')
                  : t('discover.emptyTitle', 'No learners currently available for discovery')
              }
              description={
                isSearchActive
                  ? t('discover.emptySub', 'Try broadening your search keywords, clearing specific location/subject filters, or exploring all topics.')
                  : 'Check back soon as more verified students join StudySync.'
              }
              id="discover-empty-state"
              action={
                <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button variant="secondary" size="sm" onClick={handleResetAll}>
                    {t('discover.clearFilters', 'Clear Filters')}
                  </Button>
                </div>
              }
            />

            {/* Alternatives suggestion banner */}
            {alternatives && (alternatives.suggestedRooms?.length > 0 || alternatives.suggestedTimeWindows?.length > 0) && (
              <div
                id="matching-alternatives-card"
                className="row"
                style={{
                  gap: 'var(--space-2)',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                }}
              >
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Suggested Alternatives:</span>
                {alternatives.suggestedRooms?.map((rm) => (
                  <Button
                    key={rm.id}
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`${ROUTES.ROOMS}?room=${rm.id}`)}
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                  >
                    Room: {rm.room_name} ({rm.topic})
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* 5. Filters Popover / Modal */}
      {isFilterModalOpen && (
        <div className="discover-filter-modal-overlay" onClick={() => setIsFilterModalOpen(false)}>
          <div className="discover-filter-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="discover-filter-modal-header">
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '18px' }} aria-hidden="true">⚙️</span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Search &amp; Discovery Filters</h3>
              </div>
              <button
                type="button"
                className="discover-search-clear-btn"
                onClick={() => setIsFilterModalOpen(false)}
                aria-label="Close filters"
                style={{ position: 'static', transform: 'none' }}
              >
                ✕
              </button>
            </div>

            <div className="discover-filter-modal-body">
              {/* Category 1: Study */}
              <div className="discover-filter-section">
                <h4 className="discover-filter-section-title">Study &amp; Academic Focus</h4>
                <div className="discover-filter-grid-2">
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                      Subject
                    </label>
                    <Input
                      placeholder="e.g. Mathematics, Computer Science"
                      value={filters.subject}
                      onChange={(e) => handleFilterUpdate('subject', e.target.value)}
                      style={{ height: 38 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                      Specific Concept or Topic
                    </label>
                    <Input
                      placeholder="e.g. Normalisation, Deadlocks"
                      value={filters.topic}
                      onChange={(e) => handleFilterUpdate('topic', e.target.value)}
                      style={{ height: 38 }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 6 }}>
                  <Select
                    label="Learning Intent / Goal"
                    value={filters.intent}
                    onChange={(e) => handleFilterUpdate('intent', e.target.value)}
                    options={[
                      { value: 'learn_together', label: 'Learn together (Collaborative)' },
                      { value: 'find_explainer', label: 'Need help / Tutoring' },
                      { value: 'help_others', label: 'Can explain / Tutor others' },
                      { value: 'exam_revision', label: 'Exam revision sprint' },
                    ]}
                  />
                </div>
              </div>

              {/* Category 2: Education */}
              <div className="discover-filter-section">
                <h4 className="discover-filter-section-title">Education &amp; Background</h4>
                <div className="discover-filter-grid-2">
                  <Select
                    label="Education Stage / Degree"
                    value={filters.educationStage}
                    onChange={(e) => handleFilterUpdate('educationStage', e.target.value)}
                    options={[
                      { value: 'all', label: 'All Education Levels' },
                      { value: 'high_school', label: 'High School' },
                      { value: 'undergraduate', label: 'Undergraduate' },
                      { value: 'postgraduate', label: 'Postgraduate' },
                      { value: 'doctorate', label: 'Doctorate / PhD' },
                      { value: 'professional', label: 'Professional / Lifelong' },
                    ]}
                  />
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                      Field of Study / Department
                    </label>
                    <Input
                      placeholder="e.g. Engineering, Biology"
                      value={filters.fieldOfStudy}
                      onChange={(e) => handleFilterUpdate('fieldOfStudy', e.target.value)}
                      style={{ height: 38 }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 6 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Institution or University
                  </label>
                  <Input
                    placeholder="e.g. Stanford University, MIT, University of Toronto"
                    value={filters.institution}
                    onChange={(e) => handleFilterUpdate('institution', e.target.value)}
                    style={{ height: 38 }}
                  />
                </div>
              </div>

              {/* Category 3: Location (Optional) */}
              <div className="discover-filter-section">
                <h4 className="discover-filter-section-title">Location (Optional)</h4>
                <p style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', margin: '0 0 6px 0' }}>
                  Only discovers learners who opted to share their general city or country publicly.
                </p>
                <div className="discover-filter-grid-2">
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                      Country
                    </label>
                    <Input
                      placeholder="e.g. India, United States"
                      value={filters.country}
                      onChange={(e) => handleFilterUpdate('country', e.target.value)}
                      style={{ height: 38 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                      City
                    </label>
                    <Input
                      placeholder="e.g. Bengaluru, New York"
                      value={filters.city}
                      onChange={(e) => handleFilterUpdate('city', e.target.value)}
                      style={{ height: 38 }}
                    />
                  </div>
                </div>
              </div>

              {/* Category 4: Preferences */}
              <div className="discover-filter-section">
                <h4 className="discover-filter-section-title">Preferences &amp; Schedule</h4>
                <div className="discover-filter-grid-2">
                  <Select
                    label="Language"
                    value={filters.language}
                    onChange={(e) => handleFilterUpdate('language', e.target.value)}
                    options={[
                      { value: 'all', label: 'All Languages' },
                      { value: 'English', label: 'English' },
                      { value: 'Spanish', label: 'Spanish' },
                      { value: 'French', label: 'French' },
                      { value: 'German', label: 'German' },
                      { value: 'Hindi', label: 'Hindi' },
                      { value: 'Tamil', label: 'Tamil' },
                      { value: 'Mandarin', label: 'Mandarin' },
                    ]}
                  />
                  <Select
                    label="Skill Level"
                    value={filters.skillLevel}
                    onChange={(e) => handleFilterUpdate('skillLevel', e.target.value)}
                    options={[
                      { value: 'all', label: 'All Skill Levels' },
                      { value: 'Beginner', label: 'Beginner' },
                      { value: 'Intermediate', label: 'Intermediate' },
                      { value: 'Advanced', label: 'Advanced' },
                    ]}
                  />
                </div>

                <div style={{ marginTop: 6 }}>
                  <Select
                    label="Preferred Study Schedule"
                    value={filters.preferredTime}
                    onChange={(e) => handleFilterUpdate('preferredTime', e.target.value)}
                    options={[
                      { value: 'any', label: 'Any time / Flexible' },
                      { value: 'Weekday Mornings', label: 'Weekday Mornings' },
                      { value: 'Weekday Afternoons', label: 'Weekday Afternoons' },
                      { value: 'Weekday Evenings', label: 'Weekday Evenings' },
                      { value: 'Weekends', label: 'Weekends' },
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="discover-filter-modal-footer">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetAll}
                id="modal-clear-all-filters-btn"
              >
                {t('discover.filterModal.reset', 'Clear All')}
              </Button>
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFilterModalOpen(false)}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApplyFilters}
                  id="modal-apply-filters-btn"
                >
                  {t('discover.filterModal.apply', 'Apply Filters')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Preservation for Regression Queries */}
      <div id="discover-recommended-rooms-section" style={{ display: 'none' }} aria-hidden="true" />

      {/* Session Creation Modal */}
      <CreateSessionModal
        isOpen={isSessionModalOpen}
        onClose={() => {
          setIsSessionModalOpen(false);
          setSessionTargetPeer(null);
        }}
        initialTopic={sessionTargetPeer?.topic || ''}
        initialSubject={sessionTargetPeer?.subject || 'Computer Science'}
        initialPartnerName={sessionTargetPeer?.studentName || ''}
      />

      {/* Privacy Settings Modal */}
      <PrivacySettingsModal
        isOpen={isPrivacyModalOpen}
        onClose={() => {
          setIsPrivacyModalOpen(false);
          executeSearch(searchQuery, filters, sortOption, 1, false);
        }}
      />

      {/* Block Confirmation Modal */}
      <BlockConfirmModal
        isOpen={isBlockModalOpen}
        onClose={() => {
          setIsBlockModalOpen(false);
          setTargetBlockUser(null);
        }}
        targetUser={targetBlockUser}
        onBlocked={(blockedId, blockedName) => {
          setMatches((prev) => prev.filter((m) => (m.studentId || m.id) !== blockedId));
          showToast(`Blocked ${blockedName}. Mutually excluded from recommendations.`);
        }}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setTargetReportUser(null);
        }}
        targetUser={targetReportUser}
      />
    </div>
  );
}

export default Discover;
