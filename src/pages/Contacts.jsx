import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Avatar, Badge, EmptyState, LoadingState } from '../components/UI';
import { ROUTES } from '../config/routes';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import apiClient from '../utils/apiClient';

export function Contacts() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t } = usePreferences();

  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isStartingChat, setIsStartingChat] = useState(null); // recipient ID in-flight

  const searchDebounceRef = useRef(null);

  // Fetch verified contacts from backend API
  const fetchContacts = useCallback(async (query = '') => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.getContacts(query.trim(), 50);
      if (res.ok && res.data?.data) {
        setContacts(res.data.data);
      } else {
        const errMsg = res.data?.error?.message || res.data?.message || res.error || 'Failed to load learners.';
        setError(errMsg);
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setError(err.message || 'Unable to connect to service. Please check your network.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN);
      return;
    }
    fetchContacts('');
  }, [isAuthenticated, fetchContacts, navigate]);

  // Debounced search when search query changes
  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchQuery(term);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      fetchContacts(term);
    }, 250);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    fetchContacts('');
  };

  // Open or create conversation with selected learner
  const handleStartChat = async (learner) => {
    if (!learner?.id || isStartingChat) return;
    setIsStartingChat(learner.id);
    setError(null);

    try {
      const res = await apiClient.createConversation(learner.id);
      if (res.ok && res.data?.data) {
        const conv = res.data.data;
        // Navigate directly to the conversation in Direct Messages
        navigate(`${ROUTES.MESSAGES}?conv=${encodeURIComponent(conv.id)}`);
      } else {
        const errMsg = res.data?.error?.message || res.data?.message || res.error || 'Failed to start conversation. Please try again.';
        setError(errMsg);
      }
    } catch (err) {
      console.error('Failed to open conversation:', err);
      setError(err.message || 'Unable to start conversation. Please check your connection.');
    } finally {
      setIsStartingChat(null);
    }
  };

  return (
    <div
      className="contacts-page-container"
      id="contacts-page"
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: 'var(--space-4) var(--space-4) var(--space-8)',
        minHeight: '80vh',
      }}
    >
      {/* Top Navigation & Header */}
      <header
        className="stack"
        style={{
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-5)',
        }}
      >
        <div className="row-between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <Button
            variant="ghost"
            size="sm"
            id="contacts-back-btn"
            onClick={() => navigate(ROUTES.MESSAGES)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingLeft: 0 }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>{t('messages.backToMessages', 'Back to Direct Messages')}</span>
          </Button>

          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              fontWeight: 500,
            }}
          >
            {contacts.length} {contacts.length === 1 ? 'learner available' : 'learners available'}
          </span>
        </div>

        <div>
          <h1
            id="contacts-title"
            style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: '0 0 var(--space-1)',
              letterSpacing: '-0.02em',
            }}
          >
            {t('contacts.title', 'Contacts')}
          </h1>
          <p
            id="contacts-subtitle"
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-secondary)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {t('contacts.subtitle', 'Select a verified learner to start a direct study conversation.')}
          </p>
        </div>

        {/* Search Bar */}
        <div
          style={{
            position: 'relative',
            marginTop: 'var(--space-2)',
          }}
        >
          <input
            type="text"
            id="contacts-search-input"
            className="input"
            placeholder={t('contacts.searchPlaceholder', 'Search learners by name or subject (e.g. Maya, Database Systems)...')}
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Search learners by name or subject"
            style={{
              width: '100%',
              paddingLeft: 38,
              paddingRight: searchQuery ? 36 : 14,
              height: 44,
              fontSize: 'var(--text-sm)',
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-subtle)',
            }}
          />
          {/* Search Icon */}
          <svg
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
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
              pointerEvents: 'none',
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          {/* Clear button */}
          {searchQuery && (
            <button
              type="button"
              id="contacts-search-clear-btn"
              onClick={handleClearSearch}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '4px',
                lineHeight: 1,
                fontSize: '16px',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area: State Views & Contacts List */}
      <main id="contacts-content">
        {/* 1. API Error Banner */}
        {error && (
          <div
            id="contacts-error-state"
            role="alert"
            style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-danger, #ef4444)',
              fontSize: 'var(--text-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
            }}
          >
            <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              id="contacts-retry-btn"
              onClick={() => fetchContacts(searchQuery)}
              style={{ fontSize: 'var(--text-xs)' }}
            >
              {t('common.retry', 'Retry')}
            </Button>
          </div>
        )}

        {/* 2. Loading State */}
        {isLoading ? (
          <div
            id="contacts-loading-state"
            style={{
              padding: 'var(--space-12) var(--space-4)',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
            }}
          >
            <div
              className="spinner"
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
            <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
              {t('contacts.loading', 'Loading verified learners...')}
            </p>
          </div>
        ) : contacts.length === 0 ? (
          /* 3. Empty States */
          searchQuery.trim() ? (
            /* Search with no matches */
            <div
              id="contacts-no-matches-state"
              style={{
                padding: 'var(--space-12) var(--space-4)',
                textAlign: 'center',
                backgroundColor: 'var(--color-bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-bg-subtle)',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto var(--space-3)',
                  fontSize: '22px',
                }}
              >
                🔍
              </div>
              <h3
                style={{
                  margin: '0 0 var(--space-1)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                }}
              >
                {t('contacts.noMatching', 'No matching learners.')}
              </h3>
              <p
                style={{
                  margin: '0 0 var(--space-4)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-secondary)',
                  maxWidth: 380,
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              >
                {t('contacts.noMatchingSub', 'No registered learners found matching your search. Try searching by student name or academic subject.')}
              </p>
              <Button variant="outline" size="sm" onClick={handleClearSearch}>
                {t('contacts.clearSearch', 'Clear Search')}
              </Button>
            </div>
          ) : (
            /* No contacts registered yet */
            <div
              id="contacts-empty-state"
              style={{
                padding: 'var(--space-12) var(--space-4)',
                textAlign: 'center',
                backgroundColor: 'var(--color-bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-bg-subtle)',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto var(--space-3)',
                  fontSize: '22px',
                }}
              >
                👥
              </div>
              <h3
                style={{
                  margin: '0 0 var(--space-1)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                }}
              >
                {t('contacts.noLearners', 'No learners found.')}
              </h3>
              <p
                style={{
                  margin: '0 0 var(--space-4)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {t('contacts.noLearnersSub', 'There are currently no other verified learners registered in your network.')}
              </p>
              <Button variant="outline" size="sm" onClick={() => fetchContacts('')}>
                {t('contacts.refresh', 'Refresh Contacts')}
              </Button>
            </div>
          )
        ) : (
          /* 4. Contacts List: Clean rows matching WhatsApp / Telegram navigation pattern */
          <div
            id="contacts-list"
            className="stack"
            style={{
              gap: 'var(--space-2)',
            }}
          >
            {contacts.map((learner) => {
              const isConnecting = isStartingChat === learner.id;
              const subjects = Array.isArray(learner.subjects) ? learner.subjects : [];

              return (
                <div
                  key={learner.id}
                  id={`contact-item-${learner.id}`}
                  className="contact-card row-between"
                  onClick={() => handleStartChat(learner)}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                    gap: 'var(--space-3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-hover, var(--color-bg-subtle))';
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-surface)';
                    e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
                  }}
                >
                  {/* Left: Avatar & Info */}
                  <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'center', minWidth: 0, flex: 1 }}>
                    <Avatar
                      name={learner.displayName || learner.name || 'Student'}
                      initials={learner.initials || 'ST'}
                      src={learner.avatarUrl}
                      size="md"
                      status="online"
                    />

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span
                          className="contact-name"
                          style={{
                            fontSize: 'var(--text-sm)',
                            fontWeight: 600,
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          {learner.displayName || learner.name || 'Student'}
                        </span>
                        <span
                          className="contact-verified-badge"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            color: 'var(--color-success, #10b981)',
                          }}
                          title="Verified student email and academic credentials"
                        >
                          ✓ Verified
                        </span>
                      </div>

                      <p
                        className="contact-headline"
                        style={{
                          margin: '2px 0 0',
                          fontSize: '12px',
                          color: 'var(--color-text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {learner.headline || learner.institution || 'Verified Student Learner'}
                      </p>

                      {/* Subject tags */}
                      {subjects.length > 0 && (
                        <div
                          className="row"
                          style={{
                            gap: 4,
                            marginTop: 4,
                            flexWrap: 'wrap',
                          }}
                        >
                          {subjects.slice(0, 3).map((sub, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '10px',
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--color-bg-subtle)',
                                color: 'var(--color-text-muted)',
                                border: '1px solid var(--color-border-subtle)',
                              }}
                            >
                              {sub}
                            </span>
                          ))}
                          {subjects.length > 3 && (
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                              +{subjects.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Message Action Button */}
                  <div style={{ flexShrink: 0 }}>
                    <Button
                      variant="primary"
                      size="sm"
                      id={`contact-message-btn-${learner.id}`}
                      disabled={isConnecting}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartChat(learner);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        minWidth: 84,
                        justifyContent: 'center',
                      }}
                    >
                      {isConnecting ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm"
                            aria-hidden="true"
                            style={{
                              width: 10,
                              height: 10,
                              border: '2px solid currentColor',
                              borderTopColor: 'transparent',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite',
                            }}
                          />
                          <span>Opening...</span>
                        </>
                      ) : (
                        <>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          <span>{t('messages.messageAction', 'Message')}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default Contacts;
