import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import API from '../services/api';
import {
  IoLogOutOutline,
  IoStatsChartOutline,
  IoPersonOutline,
  IoSearchOutline,
  IoSend,
  IoMic,
  IoMicOff,
  IoDocumentTextOutline,
  IoLanguage,
  IoCheckmark,
  IoCheckmarkDone,
  IoChevronBack,
  IoChatbubbleEllipsesOutline,
  IoPeopleOutline,
  IoSparkles,
  IoClose,
} from 'react-icons/io5';
import { Reply, Bell, ShieldAlert } from 'lucide-react';
import Toast from '../components/Toast';
import ContextMenu from '../components/ContextMenu';
import TranslateModal from '../components/TranslateModal';
import SummarizeModal from '../components/SummarizeModal';
import DeleteMessageModal from '../components/DeleteMessageModal';
import ReplyPreview from '../components/ReplyPreview';
import { parseReplyFromMessage } from '../utils/replyParser';
import NotificationCenter from '../components/NotificationCenter';
import SafetyAlertToast from '../components/SafetyAlertToast';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { socket, onlineUsers, unreadCounts, incrementUnread, clearUnread, setUnreadMap } = useSocket();
  const navigate = useNavigate();

  // Component States
  const [conversations, setConversations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [aiAssistant, setAiAssistant] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('chats'); // 'chats' | 'contacts'
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);

  // AI & Voice Features States
  const [smartReplies, setSmartReplies] = useState([]);
  const [translationLangs, setTranslationLangs] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [summary, setSummary] = useState(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Status indicators
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [typingUsername, setTypingUsername] = useState('');

  // Alerts
  const [toast, setToast] = useState(null);

  // Context Menu & Modal States for Messages
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    message: null,
  });
  const [translateModal, setTranslateModal] = useState({
    isOpen: false,
    message: null,
  });
  const [summarizeModal, setSummarizeModal] = useState({
    isOpen: false,
    message: null,
  });
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    message: null,
  });
  const [replyToMessage, setReplyToMessage] = useState(null);

  // Safety Notifications States
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [safetyAlertNotif, setSafetyAlertNotif] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  // Refs
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const touchTimerRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const messageInputRef = useRef(null);

  // ─── Fetch Safety Notifications ─────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await API.get('/notifications');
      if (data && data.success) {
        setNotifications(data.data || []);
        setUnreadNotifCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  // ─── Initial Data Load ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchConversations();
    fetchAllUsers();
    fetchAiAssistant();
    fetchUnreadCounts();
    fetchNotifications();
  }, [fetchNotifications]);

  // ─── Real-Time Safety Alerts Socket Listener ────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleToxicNotification = (newNotif) => {
      console.log('Safety Alert received:', newNotif);
      setSafetyAlertNotif(newNotif);
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadNotifCount((prev) => prev + 1);
    };

    const handleMessageToxicityUpdated = ({ messageId, isToxic, toxicityCategory, toxicitySeverity, toxicityReason }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId
            ? { ...msg, isToxic, toxicityCategory, toxicitySeverity, toxicityReason }
            : msg
        )
      );
    };

    socket.on('toxic_notification', handleToxicNotification);
    socket.on('message_toxicity_updated', handleMessageToxicityUpdated);

    return () => {
      socket.off('toxic_notification', handleToxicNotification);
      socket.off('message_toxicity_updated', handleMessageToxicityUpdated);
    };
  }, [socket]);

  // ─── Global Socket listener for new messages (unread count updates) ──────────
  useEffect(() => {
    if (!socket) return;

    const handleGlobalMessage = (newMessage) => {
      // If the message is for a conversation we're NOT currently viewing, increment unread
      if (newMessage.sender._id !== user._id) {
        if (!activeChat || newMessage.conversation !== activeChat._id) {
          incrementUnread(newMessage.conversation);
        }
      }
      // Always refresh conversation list for last message preview
      fetchConversations();
    };

    socket.on('message_received', handleGlobalMessage);

    return () => {
      socket.off('message_received', handleGlobalMessage);
    };
  }, [socket, activeChat, user._id, incrementUnread]);

  // ─── Active Chat Socket Listeners ────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !activeChat) return;

    // Join room
    socket.emit('join_room', activeChat._id);

    // Fetch messages for active conversation
    fetchMessages(activeChat._id);
    fetchSmartReplies(activeChat._id);
    fetchSummary(activeChat._id);

    // Mark messages as read when opening a chat
    markConversationRead(activeChat._id);

    // Socket listeners for this specific chat
    const handleMessageReceived = (newMessage) => {
      if (newMessage.conversation === activeChat._id) {
        setMessages((prev) => {
          // Prevent duplicate: check if message already exists
          if (prev.some((m) => m._id === newMessage._id)) return prev;
          return [...prev, newMessage];
        });
        // Mark as read immediately since chat is open
        if (newMessage.sender._id !== user._id) {
          socket.emit('message_read', {
            messageId: newMessage._id,
            conversationId: activeChat._id,
            readerId: user._id,
          });
        }
        // Refresh smart replies
        fetchSmartReplies(activeChat._id);
      }
    };

    const handleTyping = ({ conversationId, username }) => {
      if (conversationId === activeChat._id) {
        setOtherUserTyping(true);
        setTypingUsername(username);
      }
    };

    const handleStopTyping = ({ conversationId }) => {
      if (conversationId === activeChat._id) {
        setOtherUserTyping(false);
        setTypingUsername('');
      }
    };

    const handleReadReceipt = ({ messageId, readerId }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg._id === messageId) {
            return { ...msg, readBy: [...(msg.readBy || []), readerId] };
          }
          return msg;
        })
      );
    };

    const handleMessageDeleted = ({ messageId, conversationId }) => {
      if (conversationId === activeChat._id) {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
      fetchConversations();
    };

    socket.on('message_received', handleMessageReceived);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('typing_received', handleTyping);
    socket.on('stop_typing_received', handleStopTyping);
    socket.on('message_read_received', handleReadReceipt);

    return () => {
      socket.emit('leave_room', activeChat._id);
      socket.off('message_received', handleMessageReceived);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('typing_received', handleTyping);
      socket.off('stop_typing_received', handleStopTyping);
      socket.off('message_read_received', handleReadReceipt);
      setOtherUserTyping(false);
      setTypingUsername('');
    };
  }, [socket, activeChat]);

  // ─── Auto-scroll to bottom ───────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherUserTyping]);

  // ─── Speech Recognition ──────────────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        showToast('Speech recognition error: ' + event.error, 'error');
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // ─── Helper Functions ────────────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchConversations = async () => {
    try {
      const { data } = await API.get('/conversations');
      setConversations(data.data);
    } catch (err) {
      console.error('Fetch conversations error:', err);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const { data } = await API.get('/users');
      setAllUsers(data.data);
    } catch (err) {
      console.error('Fetch all users error:', err);
    }
  };

  const fetchAiAssistant = async () => {
    try {
      const { data } = await API.get('/users/ai-assistant');
      setAiAssistant(data.data);
    } catch (err) {
      console.error('Fetch AI assistant error:', err);
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      const { data } = await API.get('/messages/unread/counts');
      setUnreadMap(data.data);
    } catch (err) {
      console.error('Fetch unread counts error:', err);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const { data } = await API.get(`/messages/${conversationId}`);
      setMessages(data.data);
    } catch (err) {
      console.error('Fetch messages error:', err);
    }
  };

  const fetchSmartReplies = async (conversationId) => {
    try {
      const { data } = await API.get(`/ai/smart-replies/${conversationId}`);
      setSmartReplies(data.data || []);
    } catch (err) {
      console.error('Fetch smart replies error:', err);
      setSmartReplies([]);
    }
  };

  const fetchSummary = async (conversationId) => {
    try {
      const { data } = await API.get(`/ai/summary/${conversationId}`);
      setSummary(data.data);
    } catch (err) {
      console.error('Fetch summary error:', err);
    }
  };

  const markConversationRead = async (conversationId) => {
    try {
      await API.put(`/messages/read/${conversationId}`);
      clearUnread(conversationId);
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchTerm(query);
    if (!query.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data } = await API.get(`/users?search=${query}`);
      setSearchResults(data.data);
    } catch (err) {
      console.error('Search users error:', err);
    }
  };

  const startConversation = async (recipientId) => {
    try {
      // Check if conversation already exists in loaded conversations
      const existingConv = conversations.find((c) =>
        c.participants?.some((p) => (p._id || p).toString() === recipientId.toString())
      );
      if (existingConv) {
        openChat(existingConv);
        setSearchTerm('');
        setIsSearching(false);
        setMobileSidebarOpen(false);
        return;
      }

      const { data } = await API.post('/conversations', { recipientId });
      setActiveChat(data.data);
      setSearchTerm('');
      setIsSearching(false);
      setMobileSidebarOpen(false);
      fetchConversations();
    } catch (err) {
      console.error('Start conversation error:', err);
      showToast('Failed to start conversation', 'error');
    }
  };

  const openChat = (chat) => {
    setActiveChat(chat);
    setMobileSidebarOpen(false);
    markConversationRead(chat._id);
  };

  const handleSend = async (textToSend) => {
    let text = textToSend || inputText;
    if (!text.trim() || !activeChat || isSending) return;

    // Capture the target reply ID and reset reply bar
    const replyId = replyToMessage ? replyToMessage._id : null;
    setReplyToMessage(null);

    setInputText('');
    stopTypingSignal();
    setIsSending(true);

    try {
      const { data } = await API.post('/messages', {
        conversationId: activeChat._id,
        text: text.trim(),
        replyToId: replyId,
      });
      // Add the sent message to local state immediately from REST response
      setMessages((prev) => {
        if (prev.some((m) => m._id === data.data._id)) return prev;
        return [...prev, data.data];
      });
      fetchConversations();
    } catch (err) {
      console.error('Send message error:', err);
      if (err.response?.data?.isToxic) {
        showToast(err.response.data.message, 'warning');
      } else {
        showToast('Failed to send message: ' + (err.response?.data?.message || err.message), 'error');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleTypingInput = (e) => {
    setInputText(e.target.value);

    if (!socket || !activeChat) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing', { conversationId: activeChat._id, username: user.username });
    }

    // Clear previous timeout and set a new one
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTypingSignal();
    }, 3000);
  };

  const stopTypingSignal = () => {
    if (socket && activeChat) {
      socket.emit('stop_typing', { conversationId: activeChat._id, username: user.username });
    }
    setIsTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      showToast('Voice-to-Text is not supported on this browser.', 'error');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      recognitionRef.current.start();
    }
  };

  const handleSummarize = async () => {
    if (!activeChat) return;
    setIsSummaryLoading(true);
    try {
      const { data } = await API.post('/ai/summary', { conversationId: activeChat._id });
      setSummary(data.data);
      showToast('AI Conversation Summary generated!');
    } catch (err) {
      console.error('Summarize error:', err);
      showToast('Failed to generate summary', 'error');
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const selectMessageTranslation = (msgId, langCode) => {
    setTranslationLangs((prev) => ({
      ...prev,
      [msgId]: langCode,
    }));
  };

  // ─── Custom Message Context Menu & Actions ──────────────────────────────────
  const handleMessageContextMenu = (e, msg) => {
    if (!msg || !msg.text) return;
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      message: msg,
    });
  };

  const handleMessageTouchStart = (e, msg) => {
    if (!msg || !msg.text) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try {
          window.navigator.vibrate(40);
        } catch (vErr) {
          // ignore vibration error if not permitted
        }
      }
      setContextMenu({
        isOpen: true,
        x: touchStartPosRef.current.x,
        y: touchStartPosRef.current.y,
        message: msg,
      });
    }, 500);
  };

  const handleMessageTouchMove = (e) => {
    if (touchTimerRef.current && e.touches[0]) {
      const moveX = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
      const moveY = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
      if (moveX > 10 || moveY > 10) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    }
  };

  const handleMessageTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleCloseContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  const handleTranslateFromMenu = () => {
    if (!contextMenu.message) return;
    setTranslateModal({
      isOpen: true,
      message: contextMenu.message,
    });
  };

  const handleSummarizeFromMenu = () => {
    if (!contextMenu.message) return;
    setSummarizeModal({
      isOpen: true,
      message: contextMenu.message,
    });
  };

  const handleCopyFromMenu = () => {
    if (!contextMenu.message) return;
    navigator.clipboard.writeText(contextMenu.message.text);
    showToast('Message copied to clipboard!', 'success');
  };

  const handleReplyFromMenu = () => {
    if (!contextMenu.message) return;
    setReplyToMessage(contextMenu.message);
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, 50);
  };

  const handleForwardFromMenu = () => {
    if (!contextMenu.message) return;
    setInputText(`Forwarded: "${contextMenu.message.text}"`);
    showToast('Message text copied to input for forwarding', 'info');
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, 50);
  };

  const handlePinFromMenu = async () => {
    if (!contextMenu.message) return;
    try {
      const { data } = await API.put(`/messages/pin/${contextMenu.message._id}`);
      setMessages((prev) =>
        prev.map((m) =>
          m._id === contextMenu.message._id ? { ...m, isPinned: data.isPinned } : m
        )
      );
      showToast(data.isPinned ? 'Message pinned to chat' : 'Message unpinned', 'success');
    } catch (err) {
      showToast('Failed to toggle pin: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  const handleSaveFromMenu = async () => {
    if (!contextMenu.message) return;
    try {
      const { data } = await API.put(`/messages/save/${contextMenu.message._id}`);
      showToast(data.isSaved ? 'Message saved to bookmarks' : 'Message removed from bookmarks', 'success');
    } catch (err) {
      showToast('Failed to toggle save: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  const handleDeleteFromMenu = () => {
    if (!contextMenu.message) return;
    setDeleteModal({
      isOpen: true,
      message: contextMenu.message,
    });
  };

  const handleConfirmDeleteMessage = async (deleteType) => {
    if (!deleteModal.message) return;
    const msgId = deleteModal.message._id;
    try {
      await API.delete(`/messages/${msgId}`, { data: { deleteType } });
      setMessages((prev) => prev.filter((m) => m._id !== msgId));
      fetchConversations();
      showToast(
        deleteType === 'everyone' ? 'Message deleted for everyone' : 'Message deleted for you',
        'success'
      );
    } catch (err) {
      console.error('Delete message error:', err);
      showToast('Failed to delete message: ' + (err.response?.data?.message || err.message), 'error');
      throw err;
    }
  };

  const handleViewMessage = (notification) => {
    const targetConvId = notification.conversation?._id || notification.conversation;
    const targetMsgId = notification.message?._id || notification.message;

    // 1. If not currently viewing the target conversation, switch to it
    if (!activeChat || activeChat._id !== targetConvId) {
      const conv = conversations.find((c) => c._id === targetConvId);
      if (conv) {
        setActiveChat(conv);
      }
    }

    // 2. Set highlighted message ID
    setHighlightedMessageId(targetMsgId);

    // 3. Close notification center if open
    setIsNotificationCenterOpen(false);

    // 4. Scroll to message with retry to allow rendering if conversation just loaded
    const attemptScroll = (attempts = 0) => {
      const el = document.getElementById(`message-${targetMsgId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (attempts < 8) {
        setTimeout(() => attemptScroll(attempts + 1), 200);
      }
    };
    attemptScroll();

    // 5. Clear highlight after 4.5 seconds
    setTimeout(() => {
      setHighlightedMessageId(null);
    }, 4500);
  };

  const handleScrollToOriginalMessage = (originalId, originalText) => {
    if (originalId) {
      const el = document.getElementById(`message-${originalId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessageId(originalId);
        setTimeout(() => setHighlightedMessageId(null), 2500);
        return;
      }
    }

    // Fallback search by text in currently loaded messages (for legacy messages)
    if (originalText && originalText !== 'Original message unavailable') {
      const matched = messages.find(
        (m) => m.text && m.text.trim().toLowerCase().includes(originalText.trim().toLowerCase())
      );
      if (matched) {
        const el = document.getElementById(`message-${matched._id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedMessageId(matched._id);
          setTimeout(() => setHighlightedMessageId(null), 2500);
          return;
        }
      }
    }

    showToast('Original message unavailable', 'info');
  };

  const getParticipantDetails = (chat) => {
    if (!chat) return null;
    return chat.participants.find((p) => p._id !== user._id) || chat.participants[0];
  };

  const isUserOnline = (userId) => {
    return onlineUsers.includes(userId);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // ─── Filtered users for contacts tab ─────────────────────────────────────────
  const filteredContacts = searchTerm.trim()
    ? searchResults
    : allUsers;

  // ─── Filtered conversations for recent chats (excluding AI assistant) ───────
  const recentUserChats = useMemo(() => {
    return conversations.filter((chat) => {
      const participant = getParticipantDetails(chat);
      if (!participant) return false;
      const isAi =
        participant.isAi === true ||
        (aiAssistant && (participant._id || participant).toString() === aiAssistant._id?.toString());
      return !isAi;
    });
  }, [conversations, aiAssistant, user]);

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen w-screen bg-chatBg overflow-hidden font-sans">
      {/* ============================================================ */}
      {/* 1. SIDEBAR PANEL                                             */}
      {/* ============================================================ */}
      <div
        className={`flex flex-col w-full md:w-96 md:min-w-[384px] border-r border-chatBorder bg-chatPanel transition-transform duration-300 
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${mobileSidebarOpen ? 'absolute md:relative z-30 inset-0 md:inset-auto' : 'absolute md:relative'}
        `}
      >
        {/* ──── Sidebar Header ──── */}
        <div className="flex items-center justify-between p-4 bg-chatSidebar border-b border-chatBorder">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/profile')}>
            <div className="relative">
              <img
                src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                alt="avatar"
                className="h-10 w-10 rounded-full border border-chatBorder object-cover"
              />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-chatSidebar"></span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white leading-tight">{user.username}</h2>
              <span className="text-[11px] text-chatAccent font-medium">Online</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsNotificationCenterOpen(true)}
              title="Safety Notifications"
              className="relative p-2 text-chatMuted hover:text-white rounded-full hover:bg-chatActive transition-all"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-chatSidebar animate-pulse">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/analytics')}
              title="AI Dashboard"
              className="p-2 text-chatMuted hover:text-white rounded-full hover:bg-chatActive transition-all"
            >
              <IoStatsChartOutline className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate('/profile')}
              title="Profile Settings"
              className="p-2 text-chatMuted hover:text-white rounded-full hover:bg-chatActive transition-all"
            >
              <IoPersonOutline className="h-5 w-5" />
            </button>
            <button
              onClick={logout}
              title="Log Out"
              className="p-2 text-chatMuted hover:text-rose-400 rounded-full hover:bg-chatActive transition-all"
            >
              <IoLogOutOutline className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ──── Search Bar ──── */}
        <div className="p-3 border-b border-chatBorder bg-chatPanel">
          <div className="relative flex items-center bg-chatSidebar rounded-xl px-3 py-2">
            <IoSearchOutline className="text-chatMuted h-5 w-5 mr-2 flex-shrink-0" />
            <input
              id="search-users"
              type="text"
              placeholder="Search or start a new chat..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full bg-transparent text-sm text-white placeholder-chatMuted focus:outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); setIsSearching(false); setSearchResults([]); }}
                className="text-chatMuted hover:text-white ml-1 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ──── Tab Toggle: Chats / Contacts ──── */}
        <div className="flex border-b border-chatBorder bg-chatPanel">
          <button
            onClick={() => setSidebarTab('chats')}
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              sidebarTab === 'chats'
                ? 'text-chatAccent border-b-2 border-chatAccent'
                : 'text-chatMuted hover:text-white'
            }`}
          >
            <IoChatbubbleEllipsesOutline className="h-3.5 w-3.5" /> Chats
          </button>
          <button
            onClick={() => setSidebarTab('contacts')}
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              sidebarTab === 'contacts'
                ? 'text-chatAccent border-b-2 border-chatAccent'
                : 'text-chatMuted hover:text-white'
            }`}
          >
            <IoPeopleOutline className="h-3.5 w-3.5" /> Contacts
          </button>
        </div>

        {/* ──── Sidebar Content ──── */}
        <div className="flex-1 overflow-y-auto">
          {sidebarTab === 'chats' ? (
            /* ─── CHATS TAB ─── */
            <div className="py-1">
              {/* Pinned ProChat AI Contact */}
              {aiAssistant && (
                <div className="px-2 pt-2 pb-1">
                  <div
                    onClick={() => startConversation(aiAssistant._id)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all group hover:bg-chatActive/80 bg-gradient-to-r from-chatAccent/5 to-transparent border border-chatAccent/10 hover:border-chatAccent/30 ${
                      activeChat && getParticipantDetails(activeChat)?.isAi ? 'bg-chatActive border-chatAccent/30 shadow-sm' : ''
                    }`}
                  >
                    <div className="relative">
                      <img
                        src={aiAssistant.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=ProChatAI'}
                        alt="ProChat AI"
                        className="h-11 w-11 rounded-full bg-chatSidebar ai-glow-pulse"
                      />
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-chatAccent border-2 border-chatPanel"></span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-semibold text-white">ProChat AI</h4>
                        <span className="text-[9px] bg-chatAccent/20 text-chatAccent px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                          <IoSparkles className="h-2.5 w-2.5" /> AI
                        </span>
                      </div>
                      <p className="text-xs text-chatMuted truncate">Your intelligent AI assistant</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Separator */}
              {recentUserChats.length > 0 && (
                <div className="px-4 pt-2 pb-1">
                  <span className="text-[10px] font-semibold text-chatMuted uppercase tracking-widest">
                    Recent Chats
                  </span>
                </div>
              )}

              {/* Conversation List */}
              {isSearching ? (
                <div className="p-2">
                  <h3 className="px-3 py-1 text-xs font-semibold text-chatMuted uppercase tracking-wider">
                    Search Results
                  </h3>
                  {searchResults.length > 0 ? (
                    searchResults.map((searchUser) => (
                      <div
                        key={searchUser._id}
                        onClick={() => startConversation(searchUser._id)}
                        className="flex items-center gap-3 p-3 rounded-xl mx-2 my-0.5 cursor-pointer hover:bg-chatActive transition-all"
                      >
                        <div className="relative">
                          <img
                            src={searchUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${searchUser.username}`}
                            alt="avatar"
                            className="h-11 w-11 rounded-full bg-chatSidebar"
                          />
                          {(isUserOnline(searchUser._id) || searchUser.isAi) && (
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-chatPanel"></span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-white truncate">{searchUser.username}</h4>
                            {searchUser.isAi && (
                              <span className="text-[10px] bg-chatAccent/20 text-chatAccent px-1.5 py-0.5 rounded-full font-bold">AI</span>
                            )}
                          </div>
                          <p className="text-xs text-chatMuted truncate">{searchUser.email}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-chatMuted">No users found</div>
                  )}
                </div>
              ) : (
                <>
                  {recentUserChats.length > 0 ? (
                    recentUserChats.map((chat) => {
                      const participant = getParticipantDetails(chat);
                      if (!participant) return null;
                      const isOnline = isUserOnline(participant._id) || participant.isAi;
                      const isActive = activeChat && activeChat._id === chat._id;
                      const unread = unreadCounts[chat._id] || 0;

                      return (
                        <div
                          key={chat._id}
                          onClick={() => openChat(chat)}
                          className={`flex items-center gap-3 p-3 rounded-xl mx-2 my-0.5 cursor-pointer transition-all ${
                            isActive ? 'bg-chatActive' : 'hover:bg-chatSidebar/60'
                          }`}
                        >
                          <div className="relative flex-shrink-0">
                            <img
                              src={participant.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${participant.username}`}
                              alt="avatar"
                              className={`h-12 w-12 rounded-full bg-chatSidebar ${participant.isAi ? 'ai-glow' : ''}`}
                            />
                            {isOnline && (
                              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-chatPanel"></span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                                {participant.username}
                                {participant.isAi && (
                                  <span className="text-[9px] bg-chatAccent/20 text-chatAccent px-1.5 py-0.5 rounded-full font-bold">AI</span>
                                )}
                              </h4>
                              <span className="text-[10px] text-chatMuted flex-shrink-0 ml-2">
                                {chat.lastMessage ? formatTime(chat.lastMessage.createdAt) : ''}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <p className="text-xs text-chatMuted truncate pr-2">
                                {chat.lastMessage
                                  ? (chat.lastMessage.sender?.username === user.username ? 'You: ' : '') +
                                    chat.lastMessage.text
                                  : 'No messages yet'}
                              </p>
                              {unread > 0 && (
                                <span className="flex-shrink-0 inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-chatAccent text-white text-[10px] font-bold unread-badge">
                                  {unread > 99 ? '99+' : unread}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-sm text-chatMuted">
                      <div className="text-3xl mb-3">💬</div>
                      No conversations yet.
                      <br />
                      <span className="text-chatAccent">Search above</span> or click{' '}
                      <span className="text-chatAccent">Contacts</span> to start chatting!
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* ─── CONTACTS TAB ─── */
            <div className="py-1">
              {/* ProChat AI pinned at top of contacts too */}
              {aiAssistant && (
                <div className="px-2 pt-2 pb-1">
                  <div
                    onClick={() => startConversation(aiAssistant._id)}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all group hover:bg-chatActive/80 bg-gradient-to-r from-chatAccent/5 to-transparent border border-chatAccent/10"
                  >
                    <div className="relative">
                      <img
                        src={aiAssistant.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=ProChatAI'}
                        alt="ProChat AI"
                        className="h-11 w-11 rounded-full bg-chatSidebar ai-glow-pulse"
                      />
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-chatAccent border-2 border-chatPanel"></span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-semibold text-white">ProChat AI</h4>
                        <span className="text-[9px] bg-chatAccent/20 text-chatAccent px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                          <IoSparkles className="h-2.5 w-2.5" /> AI
                        </span>
                      </div>
                      <p className="text-xs text-chatAccent">Always online • Powered by Gemini</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="px-4 pt-3 pb-1">
                <span className="text-[10px] font-semibold text-chatMuted uppercase tracking-widest">
                  All Contacts ({filteredContacts.filter(u => !u.isAi).length})
                </span>
              </div>

              {filteredContacts.filter(u => !u.isAi).length > 0 ? (
                filteredContacts
                  .filter((u) => !u.isAi)
                  .map((contact) => {
                    const isOnline = isUserOnline(contact._id);
                    return (
                      <div
                        key={contact._id}
                        onClick={() => startConversation(contact._id)}
                        className="flex items-center gap-3 p-3 rounded-xl mx-2 my-0.5 cursor-pointer hover:bg-chatActive transition-all"
                      >
                        <div className="relative flex-shrink-0">
                          <img
                            src={contact.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${contact.username}`}
                            alt="avatar"
                            className="h-11 w-11 rounded-full bg-chatSidebar"
                          />
                          {isOnline && (
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-chatPanel"></span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-white truncate">{contact.username}</h4>
                          <p className="text-xs text-chatMuted truncate">
                            {isOnline ? (
                              <span className="text-emerald-400">Online</span>
                            ) : (
                              contact.email
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="p-8 text-center text-sm text-chatMuted">
                  No contacts found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. CHAT PANEL                                                */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col bg-chatBg relative">
        {activeChat ? (
          <>
            {/* ──── Chat Header ──── */}
            <div className="flex items-center justify-between p-3 md:p-4 bg-chatSidebar border-b border-chatBorder">
              <div className="flex items-center gap-3">
                {/* Mobile back button */}
                <button
                  onClick={() => { setMobileSidebarOpen(true); setActiveChat(null); }}
                  className="md:hidden p-1.5 text-chatMuted hover:text-white rounded-full hover:bg-chatActive transition-all"
                >
                  <IoChevronBack className="h-5 w-5" />
                </button>
                <div className="relative">
                  <img
                    src={
                      getParticipantDetails(activeChat)?.avatar ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${getParticipantDetails(activeChat)?.username}`
                    }
                    alt="avatar"
                    className={`h-10 w-10 rounded-full ${getParticipantDetails(activeChat)?.isAi ? 'ai-glow' : ''}`}
                  />
                  {(isUserOnline(getParticipantDetails(activeChat)?._id) ||
                    getParticipantDetails(activeChat)?.isAi) && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-chatSidebar"></span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                    {getParticipantDetails(activeChat)?.username}
                    {getParticipantDetails(activeChat)?.isAi && (
                      <span className="text-[9px] bg-chatAccent/20 text-chatAccent px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                        <IoSparkles className="h-2.5 w-2.5" /> AI
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-chatMuted">
                    {otherUserTyping
                      ? <span className="text-chatAccent animate-pulse">{typingUsername || 'Someone'} is typing...</span>
                      : isUserOnline(getParticipantDetails(activeChat)?._id) ||
                        getParticipantDetails(activeChat)?.isAi
                      ? <span className="text-emerald-400">Active now</span>
                      : 'Offline'}
                  </p>
                </div>
              </div>

              {/* Chat Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSummarize}
                  disabled={isSummaryLoading}
                  title="Generate AI Summary"
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl border border-chatBorder text-xs text-chatAccent bg-chatSidebar hover:bg-chatActive font-medium transition-all disabled:opacity-50"
                >
                  <IoDocumentTextOutline className="h-4 w-4" />
                  {isSummaryLoading ? 'Summarizing...' : 'Summarize'}
                </button>
              </div>
            </div>

            {/* ──── Conversation Summary ──── */}
            {summary && (
              <div className="bg-chatSidebar/90 border-b border-chatBorder p-4 mx-3 md:mx-4 my-2 rounded-xl text-xs glass-card msg-slide-in">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-bold text-chatAccent uppercase tracking-wide flex items-center gap-1">
                    <IoSparkles className="h-3 w-3" /> AI Conversation Summary
                  </span>
                  <button onClick={() => setSummary(null)} className="text-chatMuted hover:text-white text-xs">
                    Dismiss
                  </button>
                </div>
                <div className="text-chatText whitespace-pre-line leading-relaxed">{summary.summaryText}</div>
              </div>
            )}

            {/* ──── Messages Scroll Area ──── */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-chatBg">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-chatMuted text-sm">
                  <div className="text-4xl mb-3">👋</div>
                  <p>Start the conversation! Send your first message.</p>
                </div>
              )}
              {messages.map((msg) => {
                const isSelf = msg.sender?._id === user._id;
                const activeLang = translationLangs[msg._id] || 'original';
                const replyInfo = parseReplyFromMessage(msg);
                const rawTextToDisplay = replyInfo.cleanText;
                const messageText =
                  activeLang === 'original'
                    ? rawTextToDisplay
                    : msg.translations?.[activeLang] || rawTextToDisplay;

                return (
                  <div
                    key={msg._id}
                    className={`flex flex-col max-w-[80%] md:max-w-[70%] msg-slide-in ${
                      isSelf ? 'ml-auto items-end' : 'mr-auto items-start'
                    }`}
                  >
                    {/* Sender name for received messages */}
                    {!isSelf && msg.sender?.isAi && (
                      <span className="text-[10px] text-chatAccent font-semibold mb-0.5 px-1 flex items-center gap-0.5">
                        <IoSparkles className="h-2.5 w-2.5" /> ProChat AI
                      </span>
                    )}

                    <div
                      id={`message-${msg._id}`}
                      onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                      onTouchStart={(e) => handleMessageTouchStart(e, msg)}
                      onTouchMove={handleMessageTouchMove}
                      onTouchEnd={handleMessageTouchEnd}
                      className={`group relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed cursor-pointer select-text transition-all ${
                        isSelf
                          ? 'bg-chatBubbleSelf text-white rounded-tr-sm hover:brightness-105'
                          : msg.sender?.isAi
                          ? 'bg-gradient-to-br from-chatBubbleOther to-chatActive/50 text-chatText rounded-tl-sm border border-chatAccent/10 hover:border-chatAccent/30'
                          : 'bg-chatBubbleOther text-chatText rounded-tl-sm hover:brightness-105'
                      } ${
                        highlightedMessageId === msg._id
                          ? 'ring-2 ring-[#00a884] shadow-[0_0_25px_rgba(0,168,132,0.6)] scale-[1.02]'
                          : ''
                      } ${
                        msg.isToxic && !isSelf
                          ? 'border border-rose-500/40 bg-gradient-to-br from-rose-950/20 to-chatBubbleOther'
                          : ''
                      }`}
                    >
                      {/* Flagged Toxic Badge */}
                      {msg.isToxic && !isSelf && (
                        <div className="flex items-center gap-1.5 text-[10px] text-rose-400 font-semibold mb-1 pb-1 border-b border-rose-500/20">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                          <span>Flagged: {msg.toxicityCategory || 'Harmful content'}</span>
                          {msg.toxicitySeverity && msg.toxicitySeverity !== 'None' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 uppercase font-bold text-rose-300">
                              {msg.toxicitySeverity}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Context menu trigger button on hover */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setContextMenu({
                            isOpen: true,
                            x: rect.left,
                            y: rect.bottom + 4,
                            message: msg,
                          });
                        }}
                        title="Message options"
                        className={`absolute top-1.5 ${
                          isSelf ? 'left-1.5' : 'right-1.5'
                        } opacity-0 group-hover:opacity-100 p-1 rounded-md bg-black/40 hover:bg-black/60 text-[#8696a0] hover:text-white transition-opacity`}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                          <circle cx="12" cy="19" r="1.5" fill="currentColor" />
                        </svg>
                      </button>

                      {/* Nested Reply Preview Component */}
                      {replyInfo.hasReply && (
                        <ReplyPreview
                          replyInfo={replyInfo}
                          isSelf={isSelf}
                          onScrollToOriginal={handleScrollToOriginalMessage}
                        />
                      )}

                      <p className="whitespace-pre-wrap break-words">{messageText}</p>

                      {/* Timestamp + Read receipt ticks */}
                      <div className="flex items-center justify-end gap-1.5 mt-1.5 text-[9px] text-chatMuted/70">
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isSelf && (
                          <span>
                            {msg.readBy && msg.readBy.length > 0 ? (
                              <IoCheckmarkDone className="h-3.5 w-3.5 text-blue-400" />
                            ) : (
                              <IoCheckmark className="h-3.5 w-3.5 text-chatMuted" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Translation language pills */}
                    {!isSelf && msg.translations && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-chatMuted px-1">
                        <IoLanguage className="h-3 w-3" />
                        <button
                          onClick={() => selectMessageTranslation(msg._id, 'original')}
                          className={`hover:text-white px-1.5 py-0.5 rounded transition-colors ${
                            activeLang === 'original' ? 'text-chatAccent font-semibold' : ''
                          }`}
                        >
                          Orig
                        </button>
                        {['en', 'hi', 'fr', 'de', 'es'].map((lang) => (
                          <button
                            key={lang}
                            onClick={() => selectMessageTranslation(msg._id, lang)}
                            className={`hover:text-white px-1 uppercase ${
                              activeLang === lang ? 'text-chatAccent font-semibold' : ''
                            }`}
                          >
                            {lang}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Typing indicator */}
              {otherUserTyping && (
                <div className="flex items-center gap-2 max-w-[70%] mr-auto msg-slide-in">
                  <div className="bg-chatBubbleOther text-chatMuted px-4 py-3 rounded-2xl rounded-tl-sm text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-chatMuted rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-chatMuted rounded-full animate-bounce [animation-delay:0.15s]"></span>
                    <span className="w-2 h-2 bg-chatMuted rounded-full animate-bounce [animation-delay:0.3s]"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ──── Smart Replies ──── */}
            {smartReplies.length > 0 && (
              <div className="flex flex-wrap gap-2 px-3 md:px-4 py-2 bg-chatSidebar/20 border-t border-chatBorder">
                <IoSparkles className="h-3.5 w-3.5 text-chatAccent mt-1" />
                {smartReplies.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(reply)}
                    className="px-3 py-1.5 rounded-full border border-chatAccent/30 bg-chatActive/40 hover:bg-chatActive text-xs text-chatAccent font-medium transition-all hover:scale-[1.03] active:scale-95"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            {/* ──── Replying Banner ──── */}
            {replyToMessage && (
              <div className="flex items-center justify-between px-4 py-2 bg-[#182229] border-t border-[#222e35] text-xs transition-all">
                <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                  <Reply className="w-3.5 h-3.5 text-[#00a884] flex-shrink-0" />
                  <div className="truncate">
                    <span className="font-semibold text-[#00a884]">
                      Replying to {replyToMessage.sender?.username || 'User'}:
                    </span>{' '}
                    <span className="text-[#8696a0] truncate">{replyToMessage.text}</span>
                  </div>
                </div>
                <button
                  onClick={() => setReplyToMessage(null)}
                  className="p-1 text-[#8696a0] hover:text-white rounded-full hover:bg-[#222e35]"
                >
                  <IoClose className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ──── Message Input Area ──── */}
            <div className="p-3 bg-chatSidebar border-t border-chatBorder flex items-center gap-2 md:gap-3">
              <button
                onClick={toggleRecording}
                title={isRecording ? 'Stop Voice-to-Text' : 'Start Voice-to-Text'}
                className={`p-2.5 md:p-3 rounded-full hover:bg-chatActive transition-all flex-shrink-0 ${
                  isRecording ? 'text-rose-500 bg-rose-500/10 animate-pulse' : 'text-chatMuted'
                }`}
              >
                {isRecording ? <IoMicOff className="h-5 w-5" /> : <IoMic className="h-5 w-5" />}
              </button>

              <input
                ref={messageInputRef}
                id="message-input"
                type="text"
                value={inputText}
                onChange={handleTypingInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={replyToMessage ? 'Type your reply...' : isRecording ? 'Listening...' : 'Type a message...'}
                className="flex-1 rounded-xl bg-chatPanel border border-chatBorder py-3 px-4 text-sm text-white placeholder-chatMuted focus:outline-none focus:border-chatAccent/50 transition-colors"
              />

              <button
                id="send-button"
                onClick={() => handleSend()}
                disabled={!inputText.trim() || isSending}
                className="p-2.5 md:p-3 bg-chatAccent text-white rounded-xl hover:bg-chatAccent/90 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 flex-shrink-0"
              >
                <IoSend className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          /* ──── Empty State / Welcome ──── */
          <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 bg-chatBg text-center">
            {/* Mobile: show sidebar button */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden mb-6 px-4 py-2 rounded-xl border border-chatBorder text-sm text-chatMuted hover:text-white hover:bg-chatActive transition-all"
            >
              ← Open Sidebar
            </button>
            <div className="max-w-md p-8 rounded-2xl glass-card text-center">
              <div className="text-5xl mb-4">🚀</div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Welcome to <span className="bg-gradient-to-r from-chatAccent to-blue-400 bg-clip-text text-transparent">ProChat AI</span>
              </h2>
              <p className="text-sm text-chatMuted leading-relaxed mb-4">
                Send and receive messages in real-time. Chat with friends or consult ProChat AI for intelligent conversations, translations, smart replies, and conversation summaries.
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-[11px]">
                <span className="px-3 py-1.5 rounded-full bg-chatActive/60 text-chatMuted border border-chatBorder">💬 Real-time Chat</span>
                <span className="px-3 py-1.5 rounded-full bg-chatActive/60 text-chatMuted border border-chatBorder">🤖 AI Assistant</span>
                <span className="px-3 py-1.5 rounded-full bg-chatActive/60 text-chatMuted border border-chatBorder">🌐 Translations</span>
                <span className="px-3 py-1.5 rounded-full bg-chatActive/60 text-chatMuted border border-chatBorder">🛡️ Toxicity Filter</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ──── Custom Right-Click Context Menu ──── */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        message={contextMenu.message}
        onClose={handleCloseContextMenu}
        onTranslate={handleTranslateFromMenu}
        onSummarize={handleSummarizeFromMenu}
        onCopy={handleCopyFromMenu}
        onReply={handleReplyFromMenu}
        onForward={handleForwardFromMenu}
        onPin={handlePinFromMenu}
        onSave={handleSaveFromMenu}
        onDelete={handleDeleteFromMenu}
      />

      {/* ──── Delete Message Modal ──── */}
      <DeleteMessageModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, message: null })}
        message={deleteModal.message}
        currentUser={user}
        onConfirmDelete={handleConfirmDeleteMessage}
      />

      {/* ──── Translate Message Modal ──── */}
      <TranslateModal
        isOpen={translateModal.isOpen}
        message={translateModal.message}
        onClose={() => setTranslateModal({ isOpen: false, message: null })}
        onShowToast={showToast}
      />

      {/* ──── Summarize Message Modal ──── */}
      <SummarizeModal
        isOpen={summarizeModal.isOpen}
        message={summarizeModal.message}
        onClose={() => setSummarizeModal({ isOpen: false, message: null })}
        onShowToast={showToast}
      />

      {/* ──── Safety Notification Center ──── */}
      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        onViewMessage={handleViewMessage}
        onShowToast={showToast}
        notifications={notifications}
        unreadCount={unreadNotifCount}
        onRefresh={fetchNotifications}
      />

      {/* ──── Real-Time Safety Alert Toast ──── */}
      {safetyAlertNotif && (
        <SafetyAlertToast
          notification={safetyAlertNotif}
          onClose={() => setSafetyAlertNotif(null)}
          onViewMessage={handleViewMessage}
        />
      )}

      {/* ──── Toast Notifications ──── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
