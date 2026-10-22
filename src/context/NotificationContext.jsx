import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import apiClient from '../utils/apiClient';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  // Fetch full notification list
  const loadNotifications = useCallback(async (currentFilter = filter) => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient.getNotifications({ filter: currentFilter, limit: 30 });
      if (isMountedRef.current) {
        if (res.ok && res.data) {
          const items = Array.isArray(res.data) ? res.data : (res.data.items || []);
          setNotifications(items);
          if (res.meta && typeof res.meta.unreadCount === 'number') {
            setUnreadCount(res.meta.unreadCount);
          }
        } else {
          setError(res.error || 'Failed to load notifications');
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message || 'Network error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, filter]);

  // Fast lightweight unread count check
  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    try {
      const res = await apiClient.getUnreadNotificationCount();
      if (isMountedRef.current && res.ok && res.data) {
        setUnreadCount(typeof res.data.count === 'number' ? res.data.count : 0);
      }
    } catch {
      // Non-blocking
    }
  }, [isAuthenticated]);

  // Initial load when user signs in or filter changes
  useEffect(() => {
    isMountedRef.current = true;
    if (isAuthenticated) {
      loadNotifications(filter);
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [isAuthenticated, filter, loadNotifications]);

  // Adaptive background sync: Re-check unread count every 30s or on window focus
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshUnreadCount();
      }
    }, 30000);

    const handleFocus = () => {
      refreshUnreadCount();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAuthenticated, refreshUnreadCount]);

  // Mark a single notification as read
  const markAsRead = useCallback(async (id) => {
    if (!id) return;

    // Optimistic update
    setNotifications((prev) =>
      prev.map((notif) => {
        if (notif.id === id && !notif.isRead) {
          return { ...notif, isRead: true, readAt: new Date().toISOString() };
        }
        return notif;
      })
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await apiClient.markNotificationAsRead(id);
    } catch {
      // Re-sync on failure
      refreshUnreadCount();
    }
  }, [refreshUnreadCount]);

  // Mark all unread notifications as read
  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((notif) => ({ ...notif, isRead: true, readAt: new Date().toISOString() }))
    );
    setUnreadCount(0);

    try {
      await apiClient.markAllNotificationsAsRead();
    } catch {
      // Re-sync on failure
      loadNotifications();
    }
  }, [loadNotifications]);

  // Delete a notification
  const deleteNotification = useCallback(async (id) => {
    if (!id) return;

    const target = notifications.find((n) => n.id === id);
    if (target && !target.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    setNotifications((prev) => prev.filter((n) => n.id !== id));

    try {
      await apiClient.deleteNotification(id);
    } catch {
      loadNotifications();
    }
  }, [notifications, loadNotifications]);

  const value = {
    notifications,
    unreadCount,
    filter,
    setFilter,
    isLoading,
    error,
    loadNotifications,
    refreshUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export default NotificationContext;
