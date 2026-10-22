import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { usePreferences } from '../context/PreferencesContext';
import apiClient from '../utils/apiClient';
import { Avatar, Badge, Button } from '../components/UI';
import { ROUTES } from '../config/routes';
import '../styles/messages.css';

export function Messages() {
  const { user, isAuthenticated } = useAuth();
  const { setSelectedPartner } = useApp();
  const { t } = usePreferences();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [activeConversationData, setActiveConversationData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [callError, setCallError] = useState(null);

  const messagesEndRef = useRef(null);
  const pollingRef = useRef(null);
  const inputRef = useRef(null);
  const isSendingRef = useRef(false);

  // Active conversation object: prioritizes loaded list item or directly fetched item
  const activeConversation =
    conversations.find((c) => c.id === selectedConvId) ||
    (activeConversationData?.id === selectedConvId ? activeConversationData : null);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  }, []);

  // Format timestamp like LinkedIn / Instagram (e.g. "10:30 AM" or "Oct 19")
  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // 1. Fetch Conversations
  const fetchConversations = useCallback(async (silent = false) => {
    if (!isAuthenticated) return;
    if (!silent) setIsLoadingConversations(true);

    try {
      const res = await apiClient.getConversations();
      if (res.ok && res.data?.data) {
        setConversations(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      if (!silent) setIsLoadingConversations(false);
    }
  }, [isAuthenticated]);

  // 2. Fetch Messages for Selected Conversation
  const fetchMessages = useCallback(async (convId, silent = false) => {
    if (!convId || !isAuthenticated) return;
    if (!silent) setIsLoadingMessages(true);

    try {
      const res = await apiClient.getDirectMessages(convId);
      if (res.ok && res.data?.data) {
        const msgs = Array.isArray(res.data.data)
          ? res.data.data
          : res.data.data.messages || [];
        setMessages(msgs);
      }
    } catch (err) {
      console.error('Failed to load direct messages:', err);
    } finally {
      if (!silent) setIsLoadingMessages(false);
    }
  }, [isAuthenticated]);

  // Initial load of conversation list
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // 3. Handle URL Query Params (?with=<userId> or ?conv=<convId>) & page refreshes
  const withUserId = searchParams.get('with');
  const convId = searchParams.get('conv');
  const viewCircle =
    searchParams.get('view') === 'circle' ||
    searchParams.get('circle') === 'true' ||
    searchParams.get('view') === 'contacts' ||
    searchParams.get('contacts') === 'true';

  useEffect(() => {
    if (viewCircle) {
      navigate(ROUTES.CIRCLE, { replace: true });
    }
  }, [viewCircle, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;

    if (withUserId) {
      // Direct message shortcut from partner card or discovery
      apiClient.createConversation(withUserId).then((res) => {
        if (res.ok && res.data?.data) {
          const newConv = res.data.data;
          setActiveConversationData(newConv);
          setConversations((prev) => {
            const exists = prev.find((c) => c.id === newConv.id);
            return exists ? prev : [newConv, ...prev];
          });
          setSelectedConvId(newConv.id);
          // Canonicalize to ?conv=<id>
          setSearchParams({ conv: newConv.id }, { replace: true });
        }
      });
    } else if (convId) {
      setSelectedConvId(convId);
      // Ensure active conversation metadata is loaded even on page refresh
      apiClient.getConversation(convId).then((res) => {
        if (res.ok && res.data?.data) {
          setActiveConversationData(res.data.data);
          setConversations((prev) => {
            const exists = prev.find((c) => c.id === res.data.data.id);
            return exists ? prev : [res.data.data, ...prev];
          });
        }
      });
    } else {
      setSelectedConvId(null);
      setActiveConversationData(null);
    }
  }, [withUserId, convId, isAuthenticated, setSearchParams]);

  // When selected conversation changes, load its messages and focus input
  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId);
      setSendError(null);
      setCallError(null);
      // Update unread count locally in conversation list
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedConvId ? { ...c, unreadCount: 0 } : c))
      );
      setTimeout(() => {
        scrollToBottom(false);
        inputRef.current?.focus();
      }, 60);
    } else {
      setMessages([]);
    }
  }, [selectedConvId, fetchMessages, scrollToBottom]);

  // Scroll to bottom when messages update
  useEffect(() => {
    scrollToBottom(true);
  }, [messages, scrollToBottom]);

  // 4. Lightweight Polling (only when active conversation is visible)
  useEffect(() => {
    if (!selectedConvId) return;

    const poll = async () => {
      if (document.visibilityState === 'visible') {
        await fetchMessages(selectedConvId, true);
        await fetchConversations(true);
      }
    };

    pollingRef.current = setInterval(poll, 4000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedConvId, fetchMessages, fetchConversations]);

  // 5. Send Message Handler with Race Condition Guard
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!selectedConvId || !draftMessage.trim() || isSendingRef.current) return;

    const textToSend = draftMessage.trim();
    setIsSending(true);
    isSendingRef.current = true;
    setSendError(null);

    try {
      const res = await apiClient.sendDirectMessage(selectedConvId, textToSend);
      if (res.ok && res.data?.data) {
        const sentMsg = res.data.data;
        // Deduplicate sent message by id
        setMessages((prev) => {
          if (prev.some((m) => m.id === sentMsg.id)) return prev;
          return [...prev, sentMsg];
        });
        setDraftMessage(''); // Clear draft ONLY on verified success
        if (inputRef.current) {
          inputRef.current.style.height = '42px';
        }
        scrollToBottom(true);

        // Update preview in conversation list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConvId
              ? {
                  ...c,
                  lastMessageAt: sentMsg.createdAt || new Date().toISOString(),
                  lastMessagePreview: (sentMsg.messageContent || sentMsg.text || '').slice(0, 77),
                }
              : c
          )
        );
      } else {
        const errMsg =
          res.data?.error?.message ||
          res.error ||
          t('messages.sendFailed', 'Failed to send message. Your draft has been preserved.');
        setSendError(errMsg);
      }
    } catch (err) {
      setSendError(t('messages.sendFailed', 'Failed to send message. Your draft has been preserved.'));
    } finally {
      setIsSending(false);
      isSendingRef.current = false;
    }
  };

  // Keyboard navigation: Enter sends, Shift+Enter inserts newline
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Multiline textarea auto-expansion
  const handleDraftChange = (e) => {
    setDraftMessage(e.target.value);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  };

  // Back to list navigation (used on mobile and navigation resets)
  const handleBackToList = () => {
    setSelectedConvId(null);
    setActiveConversationData(null);
    setSearchParams({});
  };

  // Academic Profile handler (opens rich modal in place via AppContext)
  const handleViewPartnerProfile = () => {
    if (!activeConversation?.otherParticipant) return;
    const p = activeConversation.otherParticipant;
    setSelectedPartner({
      id: p.id,
      studentId: p.id,
      name: p.displayName || p.name || 'Student',
      displayName: p.displayName || p.name || 'Student',
      avatar: p.avatarUrl,
      avatarUrl: p.avatarUrl,
      initials: p.initials || 'ST',
      headline: p.headline || 'Student Learner',
      institution: p.institution,
    });
  };

  // Study Call handler: opens or creates the dedicated 1-to-1 study room for this conversation
  const handleStudyCall = async () => {
    if (!selectedConvId) return;
    setCallError(null);
    setIsStartingCall(true);

    try {
      const res = await apiClient.startConversationStudyCall(selectedConvId);
      if (res.ok && res.data?.data) {
        const room = res.data.data;
        if (!room?.id) {
          throw new Error('Study room returned invalid data');
        }
        // Navigate to the actual room meeting interface, preserving conversation ID for back navigation
        navigate(`${ROUTES.ROOMS}?room=${encodeURIComponent(room.id)}&conv=${encodeURIComponent(selectedConvId)}`);
      } else {
        const errMsg =
          res.data?.error?.message ||
          res.data?.message ||
          res.error ||
          'Failed to open study call room. Please try again.';
        setCallError(errMsg);
      }
    } catch (err) {
      console.error('Study call failed:', err);
      setCallError(err.message || 'Unable to connect to study call room. Please check your network connection.');
    } finally {
      setIsStartingCall(false);
    }
  };

  // Navigate to dedicated Circle screen to start a new chat
  const handleOpenNewChat = () => {
    navigate(ROUTES.CIRCLE);
  };

  // Filter conversations by participant name or headline
  const filteredConversations = conversations.filter((c) => {
    if (!searchFilter.trim()) return true;
    const name = c.otherParticipant?.displayName || c.otherParticipant?.name || '';
    const headline = c.otherParticipant?.headline || '';
    const q = searchFilter.toLowerCase().trim();
    return name.toLowerCase().includes(q) || headline.toLowerCase().includes(q);
  });

  return (
    <div className="messages-page-container" id="direct-messages-page">
      <div className="messages-layout-card">
        {/* Left Sidebar: Conversations List */}
        <aside
          className={`messages-sidebar ${selectedConvId ? 'hidden-mobile' : ''}`}
          id="messages-sidebar"
          aria-label="Conversations List"
        >
          <div className="messages-sidebar-header">
            <div className="messages-sidebar-title-row">
              <h2 className="messages-sidebar-title">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
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
                <span>{t('messages.conversations', 'Messaging')}</span>
              </h2>
              <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                {conversations.some((c) => c.unreadCount > 0) && (
                  <span className="conversation-unread-badge" title="Unread messages count">
                    {conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)}
                  </span>
                )}
                <button
                  type="button"
                  id="messages-circle-btn"
                  className="btn-icon ghost messages-circle-icon-btn"
                  onClick={() => navigate(ROUTES.CIRCLE)}
                  title="Circle"
                  aria-label="Circle"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-full)',
                    color: 'var(--color-text-secondary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </button>
                <button
                  type="button"
                  id="messages-new-chat-btn"
                  className="btn-icon ghost"
                  onClick={() => navigate(ROUTES.CIRCLE)}
                  title="New Message (Circle)"
                  aria-label="New Message"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-full)',
                    color: 'var(--color-primary, #0A66C2)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="search-input-wrapper" style={{ position: 'relative' }}>
              <input
                type="text"
                className="input"
                id="messages-search-input"
                placeholder={t('common.search', 'Search messages...')}
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  width: '100%',
                  fontSize: 'var(--text-sm)',
                  paddingLeft: '34px',
                  paddingRight: searchFilter ? '30px' : '10px',
                  height: 36,
                }}
              />
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
                style={{
                  position: 'absolute',
                  left: '11px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)',
                  pointerEvents: 'none',
                }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {searchFilter && (
                <button
                  type="button"
                  className="btn-icon ghost"
                  onClick={() => setSearchFilter('')}
                  aria-label="Clear search"
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 22,
                    height: 22,
                    padding: 0,
                    borderRadius: '50%',
                    color: 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: 'transparent',
                    border: 'none',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="messages-list-scroll" id="conversations-scroll-list">
            {isLoadingConversations ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                <span>{t('common.loading', 'Loading conversations...')}</span>
              </div>
            ) : conversations.length === 0 ? (
              <div
                className="messages-empty-state-card"
                id="messages-first-time-empty"
                style={{ padding: 'var(--space-6)', textAlign: 'center' }}
              >
                <div className="messages-empty-icon-circle" style={{ margin: '0 auto var(--space-3)' }}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4, fontSize: 'var(--text-sm)' }}>
                  {t('messages.noConversations', 'No conversations yet')}
                </p>
                <p
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-secondary)',
                    maxWidth: 240,
                    margin: '0 auto var(--space-4)',
                    lineHeight: 1.45,
                  }}
                >
                  {t(
                    'messages.noConversationsSub',
                    'Connect with peer learners to collaborate, ask questions, or study together.'
                  )}
                </p>
                <div className="stack-sm" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    id="messages-start-first-conv-btn"
                    onClick={handleOpenNewChat}
                    style={{ width: '100%', maxWidth: 200 }}
                  >
                    + New Message
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    id="messages-discover-partners-btn"
                    onClick={() => navigate(ROUTES.DISCOVER)}
                    style={{ width: '100%', maxWidth: 200 }}
                  >
                    {t('nav.discover', 'Discover Learners')}
                  </Button>
                </div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                  No conversations matching "{searchFilter}"
                </p>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setSearchFilter('')}
                  style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary, #0A66C2)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}
                >
                  Clear search
                </button>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const partner = conv.otherParticipant;
                const isSelected = conv.id === selectedConvId;
                const timeStr = formatTimestamp(conv.lastMessageAt);

                return (
                  <button
                    key={conv.id}
                    type="button"
                    id={`conversation-item-${conv.id}`}
                    className={`conversation-item ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedConvId(conv.id);
                      setActiveConversationData(conv);
                      setSearchParams({ conv: conv.id });
                    }}
                  >
                    <Avatar
                      name={partner?.displayName || partner?.name || 'Student'}
                      initials={partner?.initials || 'ST'}
                      src={partner?.avatarUrl}
                      size="md"
                      status="online"
                    />
                    <div className="conversation-item-info">
                      <div className="conversation-item-top">
                        <span className="conversation-item-name">{partner?.displayName || partner?.name || 'Student'}</span>
                        {timeStr && <span className="conversation-item-time">{timeStr}</span>}
                      </div>
                      <p className="conversation-item-preview">
                        {conv.hasActiveMeeting ? (
                          <span style={{ color: 'var(--color-success, #10b981)', fontWeight: 600 }}>
                            📞 Live Meeting Active
                          </span>
                        ) : (
                          conv.lastMessagePreview || t('messages.newChat', 'New conversation started')
                        )}
                      </p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="conversation-unread-badge" id={`unread-badge-${conv.id}`}>
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Panel: Active Conversation Thread */}
        <main
          className={`messages-main ${!selectedConvId ? 'hidden-mobile' : ''}`}
          id="messages-thread-main"
          aria-label="Conversation Thread"
        >
          {activeConversation ? (
            <>
              {/* Thread Header */}
              <div className="messages-thread-header" id="messages-thread-header">
                <div className="messages-thread-header-user">
                  <button
                    type="button"
                    className="messages-mobile-back"
                    id="messages-mobile-back-btn"
                    onClick={handleBackToList}
                    aria-label="Back to conversations list"
                    title="Back to conversations list"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <div
                    onClick={handleViewPartnerProfile}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}
                    title="View academic profile"
                  >
                    <Avatar
                      name={activeConversation.otherParticipant?.displayName || 'Student'}
                      initials={activeConversation.otherParticipant?.initials || 'ST'}
                      src={activeConversation.otherParticipant?.avatarUrl}
                      size="md"
                      status="online"
                    />
                    <div className="messages-thread-header-details">
                      <h3 className="messages-thread-header-name">
                        <span>{activeConversation.otherParticipant?.displayName || 'Student'}</span>
                        <Badge variant="neutral" style={{ fontSize: '0.7rem' }}>
                          {t('messages.messagePeer', 'Direct Message')}
                        </Badge>
                      </h3>
                      <p className="messages-thread-header-meta">
                        {activeConversation.otherParticipant?.headline ||
                          activeConversation.otherParticipant?.institution ||
                          t('messages.activeNow', 'Active Now')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                  <Button
                    variant={activeConversation?.hasActiveMeeting ? 'primary' : 'outline'}
                    size="sm"
                    id="messages-study-call-btn"
                    onClick={handleStudyCall}
                    disabled={isStartingCall}
                    title={
                      activeConversation?.hasActiveMeeting
                        ? 'A study call is currently active. Click to join.'
                        : 'Start a study room with this partner'
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: activeConversation?.hasActiveMeeting ? 'var(--color-success, #10b981)' : undefined,
                      borderColor: activeConversation?.hasActiveMeeting ? 'var(--color-success, #10b981)' : undefined,
                      color: activeConversation?.hasActiveMeeting ? '#fff' : undefined,
                    }}
                  >
                    {isStartingCall ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm"
                          aria-hidden="true"
                          style={{
                            width: 12,
                            height: 12,
                            border: '2px solid currentColor',
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            display: 'inline-block',
                            animation: 'spin 1s linear infinite',
                          }}
                        />
                        <span>Connecting...</span>
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
                          <polygon points="23 7 16 12 23 17 23 7" />
                          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                        <span>{activeConversation?.hasActiveMeeting ? 'Join Call ↗' : 'Study Call'}</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    id="messages-view-partner-profile-btn"
                    onClick={handleViewPartnerProfile}
                    title="View academic credentials and study preferences"
                  >
                    {t('nav.profile', 'Academic Profile')}
                  </Button>
                </div>
              </div>

              {/* Call Error Banner */}
              {callError && (
                <div
                  className="messages-error-banner"
                  id="messages-call-error-banner"
                  role="alert"
                  style={{
                    padding: 'var(--space-2-5) var(--space-4)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
                    color: 'var(--color-danger, #ef4444)',
                    fontSize: 'var(--text-xs)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-2)',
                  }}
                >
                  <span>⚠️ {callError}</span>
                  <button
                    type="button"
                    onClick={() => setCallError(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      cursor: 'pointer',
                      fontSize: '16px',
                      lineHeight: 1,
                      padding: '0 4px',
                    }}
                    aria-label="Dismiss error"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Message History Scroll Container */}
              <div className="messages-thread-scroll" id="messages-thread-scroll">
                {isLoadingMessages ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    <span>{t('common.loading', 'Loading messages...')}</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ margin: 'auto', textAlign: 'center', padding: 'var(--space-6)' }}>
                    <div className="messages-empty-icon-circle" style={{ margin: '0 auto var(--space-3)' }}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4, fontSize: 'var(--text-base)' }}>
                      {t(
                        'messages.startWith',
                        `Start conversation with ${
                          activeConversation.otherParticipant?.displayName || 'Student'
                        }`
                      )}
                    </p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', maxWidth: 320, margin: '0 auto', lineHeight: 1.45 }}>
                      {t(
                        'messages.typePlaceholder',
                        'Send a message below to connect, discuss topics, or coordinate a study session.'
                      )}
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOutgoing = msg.isMine || msg.senderId === user?.id;
                    const timeStr = msg.time ||
                      (msg.createdAt
                        ? new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '');

                    return (
                      <div
                        key={msg.id}
                        id={`direct-msg-${msg.id}`}
                        className={`direct-message-row ${isOutgoing ? 'outgoing' : 'incoming'}`}
                      >
                        <div className="direct-message-bubble">
                          {msg.messageContent || msg.text}
                        </div>
                        <div className="direct-message-meta">
                          {timeStr && <span>{timeStr}</span>}
                          {isOutgoing && (
                            <span
                              className={`read-indicator ${msg.isRead ? 'read' : 'sent'}`}
                              title={msg.isRead ? 'Read by recipient' : 'Sent'}
                              aria-label={msg.isRead ? 'Read' : 'Sent'}
                            >
                              {msg.isRead ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Form & Error Banner */}
              <div className="messages-thread-footer" id="messages-thread-footer">
                {sendError && (
                  <div className="messages-error-banner" id="messages-send-error-banner" role="alert">
                    <span>⚠️ {sendError}</span>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => handleSendMessage()}
                      style={{ color: 'var(--color-danger, #EF4444)', fontWeight: 600, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      {t('messages.retry', 'Retry')}
                    </button>
                  </div>
                )}
                <form className="messages-input-form" onSubmit={handleSendMessage}>
                  <textarea
                    ref={inputRef}
                    id="messages-input-box"
                    className="messages-input-box"
                    placeholder={t('messages.typePlaceholder', 'Write a message... (Press Enter to send, Shift+Enter for new line)')}
                    value={draftMessage}
                    onChange={handleDraftChange}
                    onKeyDown={handleKeyDown}
                    disabled={isSending}
                    rows={1}
                  />
                  <button
                    type="submit"
                    id="messages-send-btn"
                    className="messages-send-btn"
                    disabled={!draftMessage.trim() || isSending}
                    aria-label="Send message"
                    title="Send message"
                  >
                    {isSending ? (
                      <span style={{ fontSize: '0.8rem' }}>...</span>
                    ) : (
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
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="messages-empty-placeholder" id="messages-no-selection">
              <div className="messages-empty-icon-circle">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-primary)', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                {t('messages.selectConversation', 'Select a Conversation')}
              </h3>
              <p style={{ maxWidth: 360, margin: '0 0 var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                {t(
                  'messages.selectConversationSub',
                  'Choose a conversation from the sidebar to view message history, or start a new message with a registered peer.'
                )}
              </p>
              <Button
                variant="primary"
                size="sm"
                id="messages-start-new-chat-btn"
                onClick={() => navigate(ROUTES.CIRCLE)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <span>+ New Message</span>
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Messages;
