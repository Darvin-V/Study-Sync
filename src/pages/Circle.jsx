import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Avatar, Badge } from '../components/UI';
import { ROUTES } from '../config/routes';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { usePreferences } from '../context/PreferencesContext';
import apiClient from '../utils/apiClient';

export function Circle() {
  const navigate = useNavigate();
  const { t } = usePreferences();
  const { isAuthenticated } = useAuth();
  const {
    removeFromCircle,
    acceptCircleRequest,
    declineCircleRequest,
    cancelCircleRequest,
    loadCircleStates,
  } = useApp();

  // Tab State: 'my_circle' | 'requests' | 'sent'
  const [activeTab, setActiveTab] = useState('my_circle');

  // Data States
  const [members, setMembers] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);

  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const searchDebounceRef = useRef(null);

  // Fetch all tab data
  const fetchData = useCallback(async (query = '') => {
    setIsLoading(true);
    setError(null);
    try {
      const [membersRes, incomingRes, sentRes] = await Promise.all([
        apiClient.getCircle(query.trim(), 50),
        apiClient.getCircleRequests(),
        apiClient.getSentCircleRequests(),
      ]);

      if (membersRes.ok && membersRes.data?.data) {
        setMembers(membersRes.data.data);
      } else {
        setError(membersRes.data?.error?.message || 'Failed to load Circle members.');
      }

      if (incomingRes.ok && incomingRes.data?.data) {
        setIncomingRequests(incomingRes.data.data);
      }

      if (sentRes.ok && sentRes.data?.data) {
        setSentRequests(sentRes.data.data);
      }
    } catch (err) {
      console.error('Error fetching Circle data:', err);
      setError(err.message || 'Unable to connect to service. Please check your network.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial mount
  useEffect(() => {
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN);
      return;
    }
    fetchData('');
  }, [isAuthenticated, fetchData, navigate]);

  // Debounced search when searching within Circle
  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchQuery(term);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      fetchData(term);
    }, 250);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    fetchData('');
  };

  // Open or create conversation with selected Circle member
  const handleStartChat = async (learner) => {
    const learnerId = learner.id || learner.senderId || learner.receiverId;
    if (!learnerId || actionLoadingId) return;
    setActionLoadingId(learnerId);
    setError(null);

    try {
      const res = await apiClient.createConversation(learnerId);
      if (res.ok && res.data?.data) {
        const conv = res.data.data;
        navigate(`${ROUTES.MESSAGES}?conv=${encodeURIComponent(conv.id)}`);
      } else {
        const errMsg = res.data?.error?.message || res.data?.message || 'Failed to open conversation.';
        setError(errMsg);
      }
    } catch (err) {
      console.error('Failed to open conversation:', err);
      setError(err.message || 'Unable to start conversation.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Accept incoming request
  const handleAccept = async (req) => {
    const id = req.requestId || req.senderId || req.id;
    if (!id || actionLoadingId) return;
    setActionLoadingId(id);
    try {
      const res = await acceptCircleRequest(id, req.displayName || req.name);
      if (res?.success) {
        setIncomingRequests((prev) => prev.filter((r) => r.requestId !== req.requestId && r.id !== req.id));
        fetchData(searchQuery);
        loadCircleStates();
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Decline incoming request
  const handleDecline = async (req) => {
    const id = req.requestId || req.senderId || req.id;
    if (!id || actionLoadingId) return;
    setActionLoadingId(id);
    try {
      const res = await declineCircleRequest(id, req.displayName || req.name);
      if (res?.success) {
        setIncomingRequests((prev) => prev.filter((r) => r.requestId !== req.requestId && r.id !== req.id));
        loadCircleStates();
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Cancel outgoing request
  const handleCancel = async (req) => {
    const id = req.requestId || req.receiverId || req.id;
    if (!id || actionLoadingId) return;
    setActionLoadingId(id);
    try {
      const res = await cancelCircleRequest(id, req.displayName || req.name);
      if (res?.success) {
        setSentRequests((prev) => prev.filter((r) => r.requestId !== req.requestId && r.id !== req.id));
        loadCircleStates();
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Remove learner from Circle
  const handleRemove = async (learner) => {
    if (!learner?.id || actionLoadingId) return;
    setActionLoadingId(learner.id);
    try {
      const res = await removeFromCircle(learner.id, learner.displayName || learner.name);
      if (res?.success) {
        setMembers((prev) => prev.filter((m) => m.id !== learner.id));
        loadCircleStates();
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter sent and incoming by search query if applicable
  const q = searchQuery.toLowerCase().trim();
  const filteredMembers = members;
  const filteredIncoming = q
    ? incomingRequests.filter((r) =>
        r.displayName?.toLowerCase().includes(q) ||
        r.headline?.toLowerCase().includes(q) ||
        r.subjects?.some((s) => s.toLowerCase().includes(q))
      )
    : incomingRequests;
  const filteredSent = q
    ? sentRequests.filter((r) =>
        r.displayName?.toLowerCase().includes(q) ||
        r.headline?.toLowerCase().includes(q) ||
        r.subjects?.some((s) => s.toLowerCase().includes(q))
      )
    : sentRequests;

  return (
    <div className="circle-page-wrapper" id="circle-page">
      {/* Header */}
      <header className="circle-header">
        <div className="row-between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div>
            <h1
              id="circle-title"
              style={{
                fontSize: 'var(--text-2xl)',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Circle
            </h1>
            <p
              id="circle-subtitle"
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-secondary)',
                margin: '2px 0 0 0',
              }}
            >
              Connect and study with peer learners.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            id="circle-discover-nav-btn"
            onClick={() => navigate(ROUTES.DISCOVER)}
            style={{ fontSize: '12px' }}
          >
            + {t('home.browseAllLearners', 'Discover Learners')}
          </Button>
        </div>

        {/* 3 Simple Tabs: My Circle, Requests, Sent */}
        <nav className="circle-tabs-bar" role="tablist" aria-label="Circle views">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'my_circle'}
            id="tab-my-circle"
            className={`circle-tab-btn ${activeTab === 'my_circle' ? 'active' : ''}`}
            onClick={() => setActiveTab('my_circle')}
          >
            <span>{t('circle.tabs.myCircle', 'My Circle')}</span>
            <span className="circle-tab-badge" id="circle-members-badge">
              {members.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'requests'}
            id="tab-requests"
            className={`circle-tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <span>{t('circle.tabs.incoming', 'Requests')}</span>
            {incomingRequests.length > 0 && (
              <span className="circle-tab-badge" id="circle-requests-badge">
                {incomingRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sent'}
            id="tab-sent"
            className={`circle-tab-btn ${activeTab === 'sent' ? 'active' : ''}`}
            onClick={() => setActiveTab('sent')}
          >
            <span>{t('circle.tabs.sent', 'Sent')}</span>
            {sentRequests.length > 0 && (
              <span className="circle-tab-badge" id="circle-sent-badge">
                {sentRequests.length}
              </span>
            )}
          </button>
        </nav>

        {/* Search Field */}
        <div className="circle-search-wrap">
          <input
            type="text"
            id="circle-search-input"
            className="circle-search-input"
            placeholder={
              activeTab === 'my_circle'
                ? 'Search your Circle by name, course, or topic...'
                : activeTab === 'requests'
                ? 'Search incoming requests...'
                : 'Search sent requests...'
            }
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Search Circle"
          />
          {/* Search Icon */}
          <svg
            className="circle-search-icon"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          {searchQuery && (
            <button
              type="button"
              className="circle-search-clear"
              onClick={handleClearSearch}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main id="circle-content">
        {/* Error Alert */}
        {error && (
          <div
            id="circle-error-state"
            role="alert"
            style={{
              marginBottom: 'var(--space-3)',
              padding: 'var(--space-2-5) var(--space-4)',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-danger, #ef4444)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="stack" style={{ gap: 'var(--space-3)', padding: 'var(--space-6) 0' }}>
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              Loading Circle...
            </div>
          </div>
        ) : activeTab === 'my_circle' ? (
          /* TAB 1: MY CIRCLE */
          filteredMembers.length > 0 ? (
            <div className="circle-list" id="circle-members-list">
              {filteredMembers.map((learner) => (
                <div key={learner.id} className="circle-member-card" id={`circle-member-${learner.id}`}>
                  <div className="circle-member-info">
                    <Avatar
                      name={learner.displayName || learner.name}
                      initials={learner.initials}
                      src={learner.avatarUrl}
                      size="md"
                      status="online"
                    />
                    <div className="circle-member-meta">
                      <h3 className="circle-member-name">{learner.displayName || learner.name}</h3>
                      <p className="circle-member-headline">
                        {learner.headline || 'Student Learner'}
                        {learner.institution ? ` • ${learner.institution}` : ''}
                      </p>
                      {learner.subjects && learner.subjects.length > 0 && (
                        <div className="circle-member-topics">
                          {learner.subjects.slice(0, 3).map((subj, i) => (
                            <span key={i} className="circle-topic-chip">
                              {subj}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="circle-card-actions">
                    <Button
                      variant="primary"
                      size="sm"
                      id={`message-circle-member-${learner.id}`}
                      onClick={() => handleStartChat(learner)}
                      disabled={actionLoadingId === learner.id}
                      style={{ fontSize: '12px' }}
                    >
                      💬 {t('discover.messageBtn', 'Message')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      id={`remove-circle-member-${learner.id}`}
                      onClick={() => handleRemove(learner)}
                      disabled={actionLoadingId === learner.id}
                      style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}
                    >
                      {t('circle.remove', 'Remove')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Clear Empty State for My Circle */
            <div className="circle-empty-box" id="circle-empty-state">
              <div className="circle-empty-icon">👥</div>
              <h3 className="circle-empty-title">
                {searchQuery ? t('circle.empty.noMatch', 'No matching Circle members') : t('circle.empty.myCircleTitle', 'Your Circle is empty')}
              </h3>
              <p className="circle-empty-desc">
                {searchQuery
                  ? t('circle.empty.searchDesc', 'Try searching with a different term, or explore registered peers in Discover Learners.')
                  : t('circle.empty.myCircleDesc', 'Connect with peer learners to study together, share notes, and collaborate.')}
              </p>
              <Button
                variant="primary"
                id="circle-discover-btn"
                onClick={() => navigate(ROUTES.DISCOVER)}
              >
                {t('home.browseAllLearners', 'Discover Learners')}
              </Button>
            </div>
          )
        ) : activeTab === 'requests' ? (
          /* TAB 2: INCOMING REQUESTS */
          filteredIncoming.length > 0 ? (
            <div className="circle-list" id="circle-requests-list">
              {filteredIncoming.map((req) => (
                <div key={req.requestId || req.id} className="circle-member-card" id={`circle-request-${req.senderId}`}>
                  <div className="circle-member-info">
                    <Avatar
                      name={req.displayName || req.name}
                      initials={req.initials}
                      src={req.avatarUrl}
                      size="md"
                      status="online"
                    />
                    <div className="circle-member-meta">
                      <h3 className="circle-member-name">{req.displayName || req.name}</h3>
                      <p className="circle-member-headline">
                        {req.headline || 'Student Learner'}
                        {req.institution ? ` • ${req.institution}` : ''}
                      </p>
                      {req.subjects && req.subjects.length > 0 && (
                        <div className="circle-member-topics">
                          {req.subjects.slice(0, 3).map((subj, i) => (
                            <span key={i} className="circle-topic-chip">
                              {subj}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="circle-card-actions">
                    <Button
                      variant="primary"
                      size="sm"
                      id={`accept-request-btn-${req.senderId}`}
                      onClick={() => handleAccept(req)}
                      disabled={actionLoadingId === (req.requestId || req.senderId)}
                      style={{ fontSize: '12px' }}
                    >
                      {t('circle.accept', 'Accept')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      id={`decline-request-btn-${req.senderId}`}
                      onClick={() => handleDecline(req)}
                      disabled={actionLoadingId === (req.requestId || req.senderId)}
                      style={{ fontSize: '12px' }}
                    >
                      {t('circle.decline', 'Decline')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Clear Empty State for Requests */
            <div className="circle-empty-box" id="circle-requests-empty-state">
              <div className="circle-empty-icon">📬</div>
              <h3 className="circle-empty-title">{t('circle.empty.requestsTitle', 'No pending requests')}</h3>
              <p className="circle-empty-desc">
                {t('circle.empty.requestsDesc', 'When other learners invite you to connect, their requests will appear here.')}
              </p>
              <Button
                variant="primary"
                id="circle-requests-discover-btn"
                onClick={() => navigate(ROUTES.DISCOVER)}
              >
                {t('home.browseAllLearners', 'Discover Learners')}
              </Button>
            </div>
          )
        ) : (
          /* TAB 3: SENT REQUESTS */
          filteredSent.length > 0 ? (
            <div className="circle-list" id="circle-sent-list">
              {filteredSent.map((req) => (
                <div key={req.requestId || req.id} className="circle-member-card" id={`circle-sent-${req.receiverId}`}>
                  <div className="circle-member-info">
                    <Avatar
                      name={req.displayName || req.name}
                      initials={req.initials}
                      src={req.avatarUrl}
                      size="md"
                      status="online"
                    />
                    <div className="circle-member-meta">
                      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                        <h3 className="circle-member-name">{req.displayName || req.name}</h3>
                        <Badge variant="neutral" style={{ fontSize: '10px' }}>
                          {t('discover.pending', 'Pending')}
                        </Badge>
                      </div>
                      <p className="circle-member-headline">
                        {req.headline || 'Student Learner'}
                        {req.institution ? ` • ${req.institution}` : ''}
                      </p>
                      {req.subjects && req.subjects.length > 0 && (
                        <div className="circle-member-topics">
                          {req.subjects.slice(0, 3).map((subj, i) => (
                            <span key={i} className="circle-topic-chip">
                              {subj}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="circle-card-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      id={`cancel-request-btn-${req.receiverId}`}
                      onClick={() => handleCancel(req)}
                      disabled={actionLoadingId === (req.requestId || req.receiverId)}
                      style={{ fontSize: '12px' }}
                    >
                      {t('circle.cancelRequest', 'Cancel Request')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Clear Empty State for Sent */
            <div className="circle-empty-box" id="circle-sent-empty-state">
              <div className="circle-empty-icon">📤</div>
              <h3 className="circle-empty-title">{t('circle.empty.sentTitle', 'No sent requests')}</h3>
              <p className="circle-empty-desc">
                {t('circle.empty.sentDesc', 'Outgoing requests you send to peer learners will be listed here until accepted.')}
              </p>
              <Button
                variant="primary"
                id="circle-sent-discover-btn"
                onClick={() => navigate(ROUTES.DISCOVER)}
              >
                {t('home.browseAllLearners', 'Discover Learners')}
              </Button>
            </div>
          )
        )}
      </main>
    </div>
  );
}

export default Circle;
