import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  ShieldAlert,
  AlertTriangle,
  Eye,
  Check,
  CheckCheck,
  X,
  Flag,
  Clock,
  Sparkles,
} from 'lucide-react';
import API from '../services/api';

const NotificationCenter = ({
  isOpen,
  onClose,
  onViewMessage,
  onShowToast,
  notifications = [],
  unreadCount = 0,
  onRefresh,
}) => {
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const panelRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleMarkAsRead = async (id, e) => {
    e?.stopPropagation();
    try {
      await API.put(`/notifications/${id}/read`);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await API.put('/notifications/read-all');
      onRefresh?.();
      onShowToast?.('All notifications marked as read', 'success');
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleDismiss = async (id, e) => {
    e?.stopPropagation();
    try {
      await API.put(`/notifications/${id}/dismiss`);
      onRefresh?.();
      onShowToast?.('Notification dismissed', 'info');
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    }
  };

  const handleFeedback = async (id, feedbackType, e) => {
    e?.stopPropagation();
    try {
      const { data } = await API.post(`/notifications/${id}/feedback`, {
        feedback: feedbackType,
      });
      onRefresh?.();
      onShowToast?.(data.message || 'Feedback recorded', 'success');
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      onShowToast?.('Failed to submit feedback', 'error');
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const filteredNotifications = notifications.filter((notif) => {
    if (filter === 'unread') return !notif.isRead;
    return true;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            className="relative w-full max-w-md h-full bg-[#111b21] border-l border-[#222e35] shadow-2xl flex flex-col z-10 text-[#e9edef]"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#222e35] flex items-center justify-between bg-[#111b21] flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/20">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    Safety Alerts
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {unreadCount} new
                      </span>
                    )}
                  </h2>
                  <p className="text-[11px] text-[#8696a0]">
                    AI-powered automated toxic message detection
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#8696a0] hover:text-white hover:bg-[#1e262c] transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter & Actions Bar */}
            <div className="px-5 py-2.5 bg-[#182229]/60 border-b border-[#222e35] flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30'
                      : 'text-[#8696a0] hover:text-white hover:bg-[#1e262c]'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filter === 'unread'
                      ? 'bg-rose-600/30 text-rose-300 border border-rose-500/30'
                      : 'text-[#8696a0] hover:text-white hover:bg-[#1e262c]'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-[11px] text-[#8696a0] hover:text-white transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-w-0">
              {filteredNotifications.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-3 text-[#8696a0]">
                  <div className="p-3 rounded-full bg-[#182229] border border-[#222e35]">
                    <Sparkles className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-sm text-white">All Clear!</h3>
                  <p className="text-xs max-w-xs leading-relaxed">
                    No toxic, abusive, or harmful messages detected. ProChat AI continuously monitors incoming communication to keep your experience safe.
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notif) => {
                  const isHigh = notif.severity === 'High';
                  const isMedium = notif.severity === 'Medium';
                  const senderName = notif.sender?.username || 'Another user';
                  const senderAvatar =
                    notif.sender?.avatar ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${senderName}`;

                  return (
                    <div
                      key={notif._id}
                      className={`relative rounded-xl border p-3.5 transition-all space-y-2.5 ${
                        !notif.isRead
                          ? isHigh
                            ? 'bg-rose-950/20 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                            : 'bg-amber-950/20 border-amber-500/40'
                          : 'bg-[#182229] border-[#222e35]'
                      }`}
                    >
                      {/* Unread indicator dot */}
                      {!notif.isRead && (
                        <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      )}

                      {/* Top Row: Sender Info & Severity */}
                      <div className="flex items-start justify-between gap-2 pr-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={senderAvatar}
                            alt={senderName}
                            className="w-8 h-8 rounded-full bg-[#111b21] border border-[#222e35] object-cover flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="font-semibold text-xs text-white truncate flex items-center gap-1.5">
                              {senderName}
                              <span className="text-[10px] text-[#8696a0] font-normal">
                                • {formatTime(notif.createdAt)}
                              </span>
                            </h4>
                            <span className="text-[10px] text-rose-300 font-medium">
                              {notif.category}
                            </span>
                          </div>
                        </div>

                        {/* Severity Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            isHigh
                              ? 'bg-rose-500/25 text-rose-300 border border-rose-500/30'
                              : isMedium
                              ? 'bg-amber-500/25 text-amber-300 border border-amber-500/30'
                              : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                          }`}
                        >
                          {notif.severity}
                        </span>
                      </div>

                      {/* Explanation */}
                      {notif.reason && (
                        <p className="text-[11px] text-[#cfd9df] leading-relaxed">
                          {notif.reason}
                        </p>
                      )}

                      {/* Message Snippet */}
                      {notif.messageSnippet && (
                        <div className="p-2 rounded-lg bg-[#111b21] border border-[#222e35] text-[11px] text-[#8696a0] italic truncate">
                          "{notif.messageSnippet}"
                        </div>
                      )}

                      {/* Feedback flag tag if already reported */}
                      {notif.feedback === 'false_positive' && (
                        <div className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Reported as False Positive
                        </div>
                      )}

                      {/* Bottom Actions Row */}
                      <div className="pt-1.5 flex items-center justify-between border-t border-[#222e35]/60">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              onViewMessage?.(notif);
                              handleMarkAsRead(notif._id);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all active:scale-95 shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Message
                          </button>

                          {!notif.isRead && (
                            <button
                              onClick={(e) => handleMarkAsRead(notif._id, e)}
                              className="p-1 rounded-lg text-[#8696a0] hover:text-white hover:bg-[#1e262c] transition-colors"
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {notif.feedback === 'none' && (
                            <button
                              onClick={(e) => handleFeedback(notif._id, 'false_positive', e)}
                              className="px-2 py-1 rounded text-[10px] text-[#8696a0] hover:text-amber-300 hover:bg-[#1e262c] transition-colors flex items-center gap-1"
                              title="Report incorrect detection (False Positive)"
                            >
                              <Flag className="w-3 h-3" />
                              Not toxic?
                            </button>
                          )}

                          <button
                            onClick={(e) => handleDismiss(notif._id, e)}
                            className="p-1 rounded-lg text-[#8696a0] hover:text-white hover:bg-[#1e262c] transition-colors"
                            title="Dismiss notification"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[#222e35] bg-[#111b21] text-[11px] text-[#8696a0] flex items-center justify-between flex-shrink-0">
              <span className="flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                ProChat AI Safety Guardian
              </span>
              <span>Gemini Moderation Active</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default NotificationCenter;
