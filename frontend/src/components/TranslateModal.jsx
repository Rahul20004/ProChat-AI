import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Clock,
  WifiOff,
  Globe,
  Sparkles,
} from 'lucide-react';
import API from '../services/api';

// 25 Languages with display codes matching expected UI
const LANGUAGES = [
  { code: 'IN', name: 'Hindi', native: 'हिन्दी' },
  { code: 'US', name: 'English', native: 'English' },
  { code: 'ES', name: 'Spanish', native: 'Español' },
  { code: 'FR', name: 'French', native: 'Français' },
  { code: 'DE', name: 'German', native: 'Deutsch' },
  { code: 'JP', name: 'Japanese', native: '日本語' },
  { code: 'KR', name: 'Korean', native: '한국어' },
  { code: 'CN', name: 'Chinese (Simplified)', native: '简体中文' },
  { code: 'TW', name: 'Chinese (Traditional)', native: '繁體中文' },
  { code: 'PT', name: 'Portuguese', native: 'Português' },
  { code: 'AR', name: 'Arabic', native: 'العربية' },
  { code: 'RU', name: 'Russian', native: 'Русский' },
  { code: 'IT', name: 'Italian', native: 'Italiano' },
  { code: 'BD', name: 'Bengali', native: 'বাংলা' },
  { code: 'PK', name: 'Urdu', native: 'اردو' },
  { code: 'IN', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'IN', name: 'Tamil', native: 'தமிழ்' },
  { code: 'IN', name: 'Telugu', native: 'తెలుగు' },
  { code: 'IN', name: 'Marathi', native: 'मराठी' },
  { code: 'IN', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'TR', name: 'Turkish', native: 'Türkçe' },
  { code: 'ID', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'NL', name: 'Dutch', native: 'Nederlands' },
  { code: 'TH', name: 'Thai', native: 'ไทย' },
  { code: 'VN', name: 'Vietnamese', native: 'Tiếng Việt' },
];

const TranslateModal = ({
  isOpen,
  onClose,
  message,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [translatedText, setTranslatedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [copiedTranslation, setCopiedTranslation] = useState(false);

  // In-flight guard to prevent rapid double-clicks
  const isTranslatingRef = useRef(false);
  const lastClickTimeRef = useRef(0);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedLanguage(null);
      setTranslatedText('');
      setErrorInfo(null);
      setCooldownSeconds(0);
      setIsLoading(false);
      setCopiedOriginal(false);
      setCopiedTranslation(false);
      isTranslatingRef.current = false;
    }
  }, [isOpen, message?._id]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Rate-limit cooldown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setErrorInfo((prevErr) =>
            prevErr ? { ...prevErr, canRetryNow: true } : null
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // Filter languages by search query
  const filteredLanguages = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (lang) =>
        lang.name.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q) ||
        lang.native.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Perform Translation
  const handleTranslate = async (lang) => {
    if (!message || !message.text) return;

    // Prevent rapid repeated clicking (debounce window: 500ms)
    const now = Date.now();
    if (isTranslatingRef.current || now - lastClickTimeRef.current < 500) {
      return;
    }
    lastClickTimeRef.current = now;
    isTranslatingRef.current = true;

    setSelectedLanguage(lang);
    setIsLoading(true);
    setErrorInfo(null);
    setTranslatedText('');

    try {
      const response = await API.post('/ai/translate', {
        messageId: message._id,
        text: message.text,
        targetLanguage: lang.name,
      });

      if (response.data && response.data.success) {
        const data = response.data.data;
        const result =
          typeof data === 'string'
            ? data
            : data.translatedText || data[lang.code.toLowerCase()] || message.text;
        setTranslatedText(result);
        setErrorInfo(null);
      } else {
        throw new Error(response.data?.message || 'Translation failed');
      }
    } catch (err) {
      console.error('Translation failed:', err);
      const errData = err.response?.data || {};
      const status = err.response?.status;

      // Classify error cleanly without exposing raw stack traces or internal URLs
      if (status === 429 || errData.errorType === 'QUOTA_EXCEEDED') {
        setErrorInfo({
          errorType: 'QUOTA_EXCEEDED',
          title: errData.userTitle || 'AI Translation Limit Reached',
          message:
            errData.message ||
            'The AI translation service has temporarily reached its usage limit. Please try again when the quota resets.',
          resetText: errData.resetText || null,
          isDailyQuota: errData.isDailyQuota !== undefined ? errData.isDailyQuota : true,
          canRetryNow: false,
        });
      } else if (errData.errorType === 'RATE_LIMIT') {
        const delay = errData.retryDelay || 30;
        setCooldownSeconds(delay);
        setErrorInfo({
          errorType: 'RATE_LIMIT',
          title: errData.userTitle || 'Too Many Requests',
          message:
            errData.message ||
            'Too many translation requests sent in a short time. Please wait a moment before trying again.',
          resetText: errData.resetText || `in ${delay}s`,
          isDailyQuota: false,
          canRetryNow: false,
        });
      } else if (!err.response || errData.errorType === 'NETWORK_ERROR' || err.code === 'ERR_NETWORK') {
        setErrorInfo({
          errorType: 'NETWORK_ERROR',
          title: 'Connection Problem',
          message: 'Unable to connect to the translation service. Please check your internet connection.',
          resetText: null,
          isDailyQuota: false,
          canRetryNow: true,
        });
      } else {
        setErrorInfo({
          errorType: 'SERVER_ERROR',
          title: errData.userTitle || 'Translation Failed',
          message: errData.message || 'Something went wrong while translating your message. Please try again later.',
          resetText: null,
          isDailyQuota: false,
          canRetryNow: true,
        });
      }
    } finally {
      setIsLoading(false);
      isTranslatingRef.current = false;
    }
  };

  const handleCopy = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'translation') {
      setCopiedTranslation(true);
      setTimeout(() => setCopiedTranslation(false), 2000);
      onShowToast?.('Translation copied to clipboard!', 'success');
    } else {
      setCopiedOriginal(true);
      setTimeout(() => setCopiedOriginal(false), 2000);
      onShowToast?.('Original message copied!', 'success');
    }
  };

  if (!isOpen || !message) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Dialog: Strictly overflow-x-hidden, responsive max-width */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl bg-[#111b21] border border-[#222e35] shadow-[0_24px_70px_rgba(0,0,0,0.85)] text-[#e9edef] overflow-hidden overflow-x-hidden z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#222e35]/70 bg-[#111b21] flex-shrink-0">
            <h3 className="text-base font-semibold text-white">
              Translate message
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[#8696a0] hover:text-white hover:bg-[#1e262c] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content Body (Vertical only, no horizontal scroll) */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-5 py-4 space-y-4 min-w-0">
            {/* Search Input */}
            <div className="relative flex items-center bg-[#182229] rounded-xl px-3.5 py-2.5 border border-[#222e35] focus-within:border-[#00a884] transition-colors">
              <Search className="w-4 h-4 text-[#8696a0] mr-2.5 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search language..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-transparent text-sm text-white placeholder-[#8696a0] focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-[#8696a0] hover:text-white ml-1 text-xs p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Translation Output Panel (if language selected) */}
            {selectedLanguage && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-[#182229] border border-[#00a884]/30 space-y-3 min-w-0 overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-[#00a884] uppercase tracking-wide flex items-center gap-1.5 truncate">
                      <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                      {selectedLanguage.name} Translation
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00a884]/15 text-[#00a884] font-mono flex-shrink-0">
                      {selectedLanguage.code}
                    </span>
                    {translatedText && !isLoading && !errorInfo && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Translated
                      </span>
                    )}
                  </div>

                  {translatedText && !isLoading && !errorInfo && (
                    <button
                      onClick={() => handleCopy(translatedText, 'translation')}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#00a884]/20 hover:bg-[#00a884]/30 text-[#00a884] text-xs font-medium transition-all active:scale-95 border border-[#00a884]/30 flex-shrink-0"
                    >
                      {copiedTranslation ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Translation</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Loading State with animated spinner */}
                {isLoading && (
                  <div className="py-5 flex flex-col items-center justify-center text-center space-y-2">
                    <RefreshCw className="w-6 h-6 text-[#00a884] animate-spin" />
                    <p className="text-xs text-[#8696a0]">
                      Translating into <span className="text-white font-medium">{selectedLanguage.name}</span>...
                    </p>
                  </div>
                )}

                {/* Clean Error Card Component (No raw API traces) */}
                {errorInfo && !isLoading && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 min-w-0 overflow-hidden ${
                      errorInfo.errorType === 'QUOTA_EXCEEDED' || errorInfo.errorType === 'RATE_LIMIT'
                        ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                        : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {errorInfo.errorType === 'QUOTA_EXCEEDED' ? (
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      ) : errorInfo.errorType === 'RATE_LIMIT' ? (
                        <Clock className="w-5 h-5 text-amber-400" />
                      ) : errorInfo.errorType === 'NETWORK_ERROR' ? (
                        <WifiOff className="w-5 h-5 text-rose-400" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-rose-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5 [overflow-wrap:anywhere]">
                      <h4 className="font-semibold text-sm text-white">
                        {errorInfo.title}
                      </h4>
                      <p className="text-xs opacity-90 leading-relaxed">
                        {errorInfo.message}
                      </p>

                      {/* Quota reset indicator */}
                      {errorInfo.resetText && (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/30 border border-amber-500/20 text-[11px] text-amber-300 font-mono mt-1">
                          <Clock className="w-3 h-3" />
                          <span>Estimated reset: {errorInfo.resetText}</span>
                        </div>
                      )}

                      {/* Action buttons based on error type */}
                      <div className="pt-1.5 flex items-center gap-2 flex-wrap">
                        {errorInfo.canRetryNow ? (
                          <button
                            onClick={() => handleTranslate(selectedLanguage)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" /> Retry Translation
                          </button>
                        ) : errorInfo.errorType === 'RATE_LIMIT' && cooldownSeconds > 0 ? (
                          <span className="text-[11px] text-amber-300/80 italic">
                            Retry available in {cooldownSeconds}s...
                          </span>
                        ) : errorInfo.isDailyQuota ? (
                          <span className="text-[11px] text-amber-300/70 italic">
                            Daily quota exhausted • Retry unavailable until reset
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}

                {/* Success Translation Result */}
                {translatedText && !isLoading && !errorInfo && (
                  <div className="p-3 rounded-lg bg-[#111b21] border border-[#222e35] text-sm text-white leading-relaxed max-h-48 overflow-y-auto [overflow-wrap:anywhere]">
                    <p className="whitespace-pre-wrap break-words">{translatedText}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Original Message Card */}
            <div className="p-3 rounded-xl bg-[#182229]/60 border border-[#222e35]/60 text-xs space-y-1 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between text-[#8696a0] font-semibold uppercase tracking-wider text-[10px]">
                <span>Original Text</span>
                <button
                  onClick={() => handleCopy(message.text, 'original')}
                  className="hover:text-white capitalize text-[10px] flex items-center gap-1"
                >
                  {copiedOriginal ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedOriginal ? 'Copied' : 'Copy Original'}
                </button>
              </div>
              <p className="text-[#e9edef] whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-h-24 overflow-y-auto leading-relaxed">
                {message.text}
              </p>
            </div>

            {/* Language Selector List matching user's Image 2 */}
            <div className="rounded-xl border border-[#222e35] overflow-hidden bg-[#111b21] min-w-0">
              <div className="max-h-56 overflow-y-auto divide-y divide-[#222e35]/80">
                {filteredLanguages.map((lang) => {
                  const isCurrent = selectedLanguage?.name === lang.name;
                  return (
                    <button
                      key={lang.name}
                      onClick={() => handleTranslate(lang)}
                      disabled={isLoading}
                      className={`w-full flex items-center px-4 py-2.5 text-left transition-colors cursor-pointer group min-w-0 ${
                        isCurrent
                          ? 'bg-[#1e262c] text-[#00a884]'
                          : 'hover:bg-[#182229] text-[#e9edef] hover:text-white'
                      } ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <span className="w-9 text-xs font-mono font-medium text-[#8696a0] uppercase group-hover:text-white flex-shrink-0">
                        {lang.code}
                      </span>
                      <span className="text-sm font-normal text-white truncate">
                        {lang.name}
                      </span>
                      {lang.native && lang.native !== lang.name && (
                        <span className="ml-auto text-xs text-[#8696a0] truncate pl-2">
                          {lang.native}
                        </span>
                      )}
                    </button>
                  );
                })}

                {filteredLanguages.length === 0 && (
                  <div className="py-8 text-center text-xs text-[#8696a0]">
                    No languages match "{searchQuery}"
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#222e35] bg-[#111b21] flex-shrink-0">
            <span className="text-[11px] text-[#8696a0] truncate mr-2">
              Dynamic AI Translation
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {translatedText && !errorInfo && (
                <button
                  onClick={() => handleCopy(translatedText, 'translation')}
                  className="px-3 py-1.5 rounded-xl bg-[#00a884] text-white text-xs font-semibold hover:bg-[#00a884]/90 transition-all flex items-center gap-1.5"
                >
                  {copiedTranslation ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy Translation
                </button>
              )}
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl bg-[#1e262c] hover:bg-[#222e35] text-[#e9edef] hover:text-white text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TranslateModal;
