import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-icons/io5';
import Toast from '../components/Toast';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const navigate = useNavigate();

  // Component States
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // AI & Voice Features States
  const [smartReplies, setSmartReplies] = useState([]);
  const [translationLangs, setTranslationLangs] = useState({}); // { [msgId]: langCode }
  const [isRecording, setIsRecording] = useState(false);
  const [summary, setSummary] = useState(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // Status indicators
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  // Alerts
  const [toast, setToast] = useState(null);

  // Speech Recognition reference
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Fetch initial conversations list
  useEffect(() => {
    fetchConversations();
  }, []);

  // Set up socket listener hooks when activeChat changes
  useEffect(() => {
    if (!socket || !activeChat) return;

    // Join room
    socket.emit('join_room', activeChat._id);

    // Fetch messages for active conversation
    fetchMessages(activeChat._id);
    fetchSmartReplies(activeChat._id);
    fetchSummary(activeChat._id);

    // Socket listeners
    const handleMessageReceived = (newMessage) => {
      if (newMessage.conversation === activeChat._id) {
        setMessages((prev) => [...prev, newMessage]);
        // Trigger read receipt
        socket.emit('message_read', {
          messageId: newMessage._id,
          conversationId: activeChat._id,
          readerId: user._id,
        });
        // Fetch new smart replies & updates summary
        fetchSmartReplies(activeChat._id);
      }
      // Refresh chats list to update last message preview
      fetchConversations();
    };

    const handleTyping = ({ conversationId, username }) => {
      if (conversationId === activeChat._id) {
        setOtherUserTyping(true);
      }
    };

    const handleStopTyping = ({ conversationId, username }) => {
      if (conversationId === activeChat._id) {
        setOtherUserTyping(false);
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

    socket.on('message_received', handleMessageReceived);
    socket.on('typing_received', handleTyping);
    socket.on('stop_typing_received', handleStopTyping);
    socket.on('message_read_received', handleReadReceipt);

    return () => {
      socket.emit('leave_room', activeChat._id);
      socket.off('message_received', handleMessageReceived);
      socket.off('typing_received', handleTyping);
      socket.off('stop_typing_received', handleStopTyping);
      socket.off('message_read_received', handleReadReceipt);
      setOtherUserTyping(false);
    };
  }, [socket, activeChat]);

  // Scroll to bottom helper
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherUserTyping]);

  // Speech Recognition initializer
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

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchTerm(query);
    if (!query) {
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
      const { data } = await API.post('/conversations', { recipientId });
      setActiveChat(data.data);
      setSearchTerm('');
      setIsSearching(false);
      fetchConversations();
    } catch (err) {
      console.error('Start conversation error:', err);
    }
  };

  const handleSend = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim() || !activeChat) return;

    setInputText('');
    stopTypingSignal();

    try {
      await API.post('/messages', {
        conversationId: activeChat._id,
        text: text.trim(),
      });
      fetchConversations();
    } catch (err) {
      console.error('Send message error:', err);
      if (err.response?.data?.isToxic) {
        showToast(err.response.data.message, 'warning');
      } else {
        showToast('Failed to send message: ' + (err.response?.data?.message || err.message), 'error');
      }
    }
  };

  const handleTypingInput = (e) => {
    setInputText(e.target.value);

    if (!socket || !activeChat) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing', { conversationId: activeChat._id, username: user.username });
    }

    // Debounce stop typing signal
    const lastTypingTime = new Date().getTime();
    const timerLength = 3000;
    setTimeout(() => {
      const timeNow = new Date().getTime();
      const timeDiff = timeNow - lastTypingTime;
      if (timeDiff >= timerLength && isTyping) {
        stopTypingSignal();
      }
    }, timerLength);
  };

  const stopTypingSignal = () => {
    if (socket && activeChat) {
      socket.emit('stop_typing', { conversationId: activeChat._id, username: user.username });
    }
    setIsTyping(false);
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      showToast('Voice-to-Text is not supported on this browser version.', 'error');
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
      showToast('AI Conversation Summary generated successfully!');
    } catch (err) {
      console.error('Summarize error:', err);
      showToast('Failed to generate summary: ' + (err.response?.data?.message || err.message), 'error');
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

  const getParticipantDetails = (chat) => {
    if (!chat) return null;
    return chat.participants.find((p) => p._id !== user._id) || chat.participants[0];
  };

  const isUserOnline = (userId) => {
    return onlineUsers.includes(userId);
  };

  return (
    <div className="flex h-screen w-screen bg-chatBg overflow-hidden font-sans">
      {/* 1. SIDEBAR PANEL */}
      <div className="flex flex-col w-96 border-r border-chatBorder bg-chatPanel">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 bg-chatSidebar border-b border-chatBorder">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/profile')}>
            <img
              src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
              alt="avatar"
              className="h-10 w-10 rounded-full border border-chatBorder"
            />
            <div>
              <h2 className="text-sm font-semibold text-white leading-tight">{user.username}</h2>
              <span className="text-xs text-chatAccent font-medium">Online</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
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

        {/* Search Contacts */}
        <div className="p-3 border-b border-chatBorder bg-chatPanel">
          <div className="relative flex items-center bg-chatSidebar rounded-xl px-3 py-2">
            <IoSearchOutline className="text-chatMuted h-5 w-5 mr-2" />
            <input
              type="text"
              placeholder="Search or start a new chat..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full bg-transparent text-sm text-white placeholder-chatMuted focus:outline-none"
            />
          </div>
        </div>

        {/* Contacts or Conversation Stream List */}
        <div className="flex-1 overflow-y-auto">
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
                    className="flex items-center gap-3 p-3 rounded-xl mx-2 my-1 cursor-pointer hover:bg-chatActive transition-all"
                  >
                    <img
                      src={searchUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${searchUser.username}`}
                      alt="avatar"
                      className="h-11 w-11 rounded-full bg-chatSidebar"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-white truncate">
                          {searchUser.username}
                        </h4>
                        {searchUser.isAi && (
                          <span className="text-[10px] bg-chatAccent/20 text-chatAccent px-1.5 py-0.5 rounded-full font-bold">
                            AI
                          </span>
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
            <div className="py-2">
              {conversations.length > 0 ? (
                conversations.map((chat) => {
                  const participant = getParticipantDetails(chat);
                  if (!participant) return null;
                  const isOnline = isUserOnline(participant._id) || participant.isAi;
                  const isActive = activeChat && activeChat._id === chat._id;

                  return (
                    <div
                      key={chat._id}
                      onClick={() => setActiveChat(chat)}
                      className={`flex items-center gap-3 p-3 rounded-xl mx-2 my-1 cursor-pointer transition-all ${
                        isActive ? 'bg-chatActive' : 'hover:bg-chatSidebar/60'
                      }`}
                    >
                      <div className="relative">
                        <img
                          src={participant.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${participant.username}`}
                          alt="avatar"
                          className="h-11 w-11 rounded-full bg-chatSidebar"
                        />
                        {isOnline && (
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-chatAccent border border-chatPanel"></span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                            {participant.username}
                            {participant.isAi && (
                              <span className="text-[9px] bg-chatAccent/20 text-chatAccent px-1.5 py-0.5 rounded-full font-bold">
                                AI
                              </span>
                            )}
                          </h4>
                          <span className="text-[10px] text-chatMuted">
                            {chat.lastMessage
                              ? new Date(chat.lastMessage.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </div>
                        <p className="text-xs text-chatMuted truncate mt-0.5">
                          {chat.lastMessage ? chat.lastMessage.text : 'No messages yet'}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-sm text-chatMuted">
                  No chat histories yet. Search above to find contacts or chat with ProChat AI!
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. CHAT STREAM PANEL */}
      <div className="flex-1 flex flex-col bg-chatBg relative">
        {activeChat ? (
          <>
            {/* Chat Panel Header */}
            <div className="flex items-center justify-between p-4 bg-chatSidebar border-b border-chatBorder">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={
                      getParticipantDetails(activeChat)?.avatar ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${getParticipantDetails(activeChat)?.username}`
                    }
                    alt="avatar"
                    className="h-10 w-10 rounded-full"
                  />
                  {(isUserOnline(getParticipantDetails(activeChat)?._id) ||
                    getParticipantDetails(activeChat)?.isAi) && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-chatAccent border border-chatSidebar"></span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                    {getParticipantDetails(activeChat)?.username}
                    {getParticipantDetails(activeChat)?.isAi && (
                      <span className="text-[9px] bg-chatAccent/20 text-chatAccent px-1.5 py-0.5 rounded-full font-bold">
                        AI
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-chatMuted">
                    {otherUserTyping
                      ? 'typing...'
                      : isUserOnline(getParticipantDetails(activeChat)?._id) ||
                        getParticipantDetails(activeChat)?.isAi
                      ? 'Active now'
                      : 'Offline'}
                  </p>
                </div>
              </div>

              {/* Chat Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSummarize}
                  disabled={isSummaryLoading}
                  title="Generate Summary"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-chatBorder text-xs text-chatAccent bg-chatSidebar hover:bg-chatActive font-medium transition-all disabled:opacity-50"
                >
                  <IoDocumentTextOutline className="h-4 w-4" />
                  {isSummaryLoading ? 'Summarizing...' : 'Summarize'}
                </button>
              </div>
            </div>

            {/* Conversation Summary Drawer if generated */}
            {summary && (
              <div className="bg-chatSidebar/90 border-b border-chatBorder p-4 mx-4 my-2 rounded-xl text-xs glass-card">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-bold text-chatAccent uppercase tracking-wide">
                    🤖 AI Conversation Summary
                  </span>
                  <button
                    onClick={() => setSummary(null)}
                    className="text-chatMuted hover:text-white"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="text-chatText whitespace-pre-line leading-relaxed">
                  {summary.summaryText}
                </div>
              </div>
            )}

            {/* Chat Message Scroll */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-chatBg bg-chat-pattern bg-repeat">
              {messages.map((msg) => {
                const isSelf = msg.sender._id === user._id;
                const activeLang = translationLangs[msg._id] || 'original';
                const messageText =
                  activeLang === 'original'
                    ? msg.text
                    : msg.translations?.[activeLang] || msg.text;

                return (
                  <div
                    key={msg._id}
                    className={`flex flex-col max-w-[70%] ${isSelf ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                  >
                    <div
                      className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isSelf
                          ? 'bg-chatBubbleSelf text-white rounded-tr-none'
                          : 'bg-chatBubbleOther text-chatText rounded-tl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{messageText}</p>

                      {/* Small Info row (timestamp + ticks) */}
                      <div className="flex items-center justify-end gap-1.5 mt-1.5 text-[9px] text-chatMuted">
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isSelf && (
                          <span>
                            {msg.readBy && msg.readBy.length > 0 ? (
                              <IoCheckmarkDone className="h-3.5 w-3.5 text-chatAccent" />
                            ) : (
                              <IoCheckmark className="h-3.5 w-3.5 text-chatMuted" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Translation Quick Lang Chips */}
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
              {otherUserTyping && (
                <div className="flex items-center gap-2 max-w-[70%] mr-auto">
                  <div className="bg-chatBubbleOther text-chatMuted px-4 py-2.5 rounded-2xl rounded-tl-none text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-chatMuted rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-chatMuted rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-chatMuted rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Smart replies picker panel */}
            {smartReplies.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 py-2 bg-chatSidebar/20 border-t border-chatBorder">
                {smartReplies.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(reply)}
                    className="px-3 py-1.5 rounded-full border border-chatAccent/30 bg-chatActive/40 hover:bg-chatActive text-xs text-chatAccent font-medium transition-all"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            {/* Input Send Area */}
            <div className="p-3 bg-chatSidebar border-t border-chatBorder flex items-center gap-3">
              <button
                onClick={toggleRecording}
                title={isRecording ? 'Stop Voice-to-Text' : 'Start Voice-to-Text'}
                className={`p-3 rounded-full hover:bg-chatActive transition-all ${
                  isRecording ? 'text-rose-500 bg-rose-500/10 animate-pulse' : 'text-chatMuted'
                }`}
              >
                {isRecording ? <IoMicOff className="h-5 w-5" /> : <IoMic className="h-5 w-5" />}
              </button>

              <input
                type="text"
                value={inputText}
                onChange={handleTypingInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
                placeholder={isRecording ? 'Listening voice inputs...' : 'Type a message...'}
                className="flex-1 rounded-xl bg-chatPanel border border-chatBorder py-3 px-4 text-sm text-white placeholder-chatMuted focus:outline-none"
              />

              <button
                onClick={() => handleSend()}
                disabled={!inputText.trim()}
                className="p-3 bg-chatAccent text-white rounded-xl hover:bg-opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
              >
                <IoSend className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-chatBg bg-chat-pattern bg-repeat text-center">
            <div className="max-w-md p-6 rounded-2xl glass-card text-center">
              <h1 className="text-4xl mb-4">💬</h1>
              <h2 className="text-xl font-bold text-white mb-2">Welcome to ProChat AI</h2>
              <p className="text-sm text-chatMuted leading-relaxed">
                Connect and chat in real-time with family, friends, or consult the Gemini AI assistant directly for translation checks, quick smart replies, and conversation summaries.
              </p>
            </div>
          </div>
        )}
      </div>

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
