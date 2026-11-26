import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Clock,
  WifiOff,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import API from '../services/api';

const SummarizeModal = ({
  isOpen,
  onClose,
  message,
  onShowToast,
}) => {
  const [summaryText, setSummaryText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedOriginal, setCopiedOriginal] = useState(false);

  // In-flight guard to prevent rapid duplicate clicks
  const isSummarizingRef = useRef(false);
  const lastClickTimeRef = useRef(0);

  // Trigger summarization when modal opens
  useEffect(() => {
    if (isOpen && message) {
      setSummaryText('');
      setErrorInfo(null);
      setCooldownSeconds(0);
      setCopiedSummary(false);
      setCopiedOriginal(false);
      isSummarizingRef.current = false;
      fetchSummary();
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

  const fetchSummary = async () => {
    if (!message || !message.text) return;

    // Prevent duplicate in-flight requests or rapid clicks (< 500ms)
    const now = Date.now();
    if (isSummarizingRef.current || now - lastClickTimeRef.current < 500) {
      return;
    }
    lastClickTimeRef.current = now;
    isSummarizingRef.current = true;

    setIsLoading(true);
    setErrorInfo(null);

    try {
      const response = await API.post('/ai/summarize-message', {
        messageId: message._id,
        text: message.text,
      });

      if (response.data && response.data.success) {
        setSummaryText(response.data.data.summaryText);
        setErrorInfo(null);
      } else {
        throw new Error(response.data?.message || 'Failed to generate summary');
      }
    } catch (err) {
      console.error('Summarize message error:', err);
      const errData = err.response?.data || {};
      const status = err.response?.status;

      if (status === 429 || errData.errorType === 'DAILY_QUOTA_LIMIT' || errData.errorType === 'QUOTA_EXCEEDED') {
        setErrorInfo({
          errorType: 'DAILY_QUOTA_LIMIT',
          title: errData.userTitle || 'AI Summarization Limit Reached',
          message:
            errData.message ||
            'The AI summary service has temporarily reached its daily usage limit. Please try again after the quota resets.',
          resetText: errData.resetText || null,
          canRetryNow: errData.canRetryNow !== undefined ? errData.canRetryNow : false,
        });
      } else if (errData.errorType === 'RPM_LIMIT' || errData.errorType === 'RATE_LIMIT') {
        const delay = errData.retryDelay || 20;
        setCooldownSeconds(delay);
        setErrorInfo({
          errorType: 'RPM_LIMIT',
          title: errData.userTitle || 'AI Service Busy',
          message: errData.message || 'The AI service is experiencing high traffic. Please wait a moment before trying again.',
          resetText: errData.resetText || `in ~${delay} seconds`,
          canRetryNow: false,
        });
      } else if (errData.errorType === 'AUTH_ERROR' || status === 401) {
        setErrorInfo({
          errorType: 'AUTH_ERROR',
          title: errData.userTitle || 'AI Authentication Error',
          message: errData.message || 'AI service authentication failed. Please verify system API credentials.',
          resetText: null,
          canRetryNow: false,
        });
      } else if (errData.errorType === 'MODEL_NOT_FOUND' || status === 404) {
        setErrorInfo({
          errorType: 'MODEL_NOT_FOUND',
          title: errData.userTitle || 'AI Model Unavailable',
          message: errData.message || 'The configured AI model is temporarily unavailable. Please try again later.',
          resetText: null,
          canRetryNow: false,
        });
      } else if (!err.response || errData.errorType === 'NETWORK_ERROR' || err.code === 'ERR_NETWORK') {
        setErrorInfo({
          errorType: 'NETWORK_ERROR',
          title: 'Connection Problem',
          message: 'Unable to connect to the AI summary service. Please check your internet connection.',
          resetText: null,
          canRetryNow: true,
        });
      } else {
        setErrorInfo({
          errorType: 'SERVER_ERROR',
          title: errData.userTitle || 'Summarization Failed',
          message: errData.message || 'Something went wrong while summarizing your message. Please try again later.',
          resetText: null,
          canRetryNow: true,
        });
      }
    } finally {
      setIsLoading(false);
      isSummarizingRef.current = false;
    }
  };

  const handleCopy = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'summary') {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
      onShowToast?.('AI Summary copied to clipboard!', 'success');
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

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl bg-[#111b21] border border-[#222e35] shadow-[0_24px_70px_rgba(0,0,0,0.85)] text-[#e9edef] overflow-hidden overflow-x-hidden z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2.5 border-b border-[#222e35]/60 bg-[#111b21] flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-purple-500/15 text-[#c084fc]">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white">
                Summarize message
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[#8696a0] hover:text-white hover:bg-[#1e262c] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 space-y-4 min-w-0">
            {/* Original Message Card */}
            <div className="p-3.5 rounded-xl bg-[#182229]/60 border border-[#222e35]/60 text-xs space-y-1.5 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between text-[#8696a0] font-semibold uppercase tracking-wider text-[10px]">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Original Message
                </span>
                <button
                  onClick={() => handleCopy(message.text, 'original')}
                  className="hover:text-white capitalize text-[10px] flex items-center gap-1"
                >
                  {copiedOriginal ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedOriginal ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-[#e9edef] whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-h-28 overflow-y-auto leading-relaxed">
                {message.text}
              </p>
            </div>

            {/* AI Summary Output Card */}
            <div className="rounded-xl border border-purple-500/40 bg-[#182229] p-4 space-y-3 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[#c084fc] uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#c084fc]" />
                  AI Summary
                </span>

                {summaryText && !isLoading && !errorInfo && (
                  <button
                    onClick={() => handleCopy(summaryText, 'summary')}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-medium transition-all active:scale-95 border border-purple-500/30"
                  >
                    {copiedSummary ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Summary</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                  <RefreshCw className="w-7 h-7 text-[#c084fc] animate-spin" />
                  <p className="text-xs text-[#8696a0]">
                    ProChat AI is summarizing the selected message...
                  </p>
                </div>
              )}

              {/* Error State */}
              {errorInfo && !isLoading && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 min-w-0 overflow-hidden ${
                    errorInfo.errorType === 'DAILY_QUOTA_LIMIT' || errorInfo.errorType === 'QUOTA_EXCEEDED'
                      ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                      : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {errorInfo.errorType === 'DAILY_QUOTA_LIMIT' || errorInfo.errorType === 'QUOTA_EXCEEDED' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    ) : errorInfo.errorType === 'NETWORK_ERROR' ? (
                      <WifiOff className="w-5 h-5 text-rose-400" />
                    ) : errorInfo.errorType === 'AUTH_ERROR' ? (
                      <ShieldAlert className="w-5 h-5 text-rose-400" />
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

                    {errorInfo.resetText && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/30 border border-amber-500/20 text-[11px] text-amber-300 font-mono mt-1">
                        <Clock className="w-3 h-3" />
                        <span>Estimated reset: {errorInfo.resetText}</span>
                      </div>
                    )}

                    <div className="pt-1.5">
                      {cooldownSeconds > 0 ? (
                        <span className="text-[11px] text-amber-300/80 font-mono">
                          Retry available in {cooldownSeconds}s
                        </span>
                      ) : errorInfo.canRetryNow ? (
                        <button
                          onClick={fetchSummary}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-medium text-xs transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" /> Retry Summarization
                        </button>
                      ) : (
                        <span className="text-[11px] text-amber-300/70 italic">
                          Retry unavailable until reset
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Result State */}
              {summaryText && !isLoading && !errorInfo && (
                <div className="p-3.5 rounded-lg bg-[#111b21] border border-[#222e35] text-sm text-white leading-relaxed max-h-56 overflow-y-auto [overflow-wrap:anywhere]">
                  <p className="whitespace-pre-wrap break-words">{summaryText}</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#222e35] bg-[#111b21] flex-shrink-0">
            <span className="text-[11px] text-[#8696a0]">
              Powered by ProChat AI & Gemini
            </span>
            <div className="flex items-center gap-2">
              {summaryText && !errorInfo && (
                <button
                  onClick={() => handleCopy(summaryText, 'summary')}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-500 transition-all flex items-center gap-1.5"
                >
                  {copiedSummary ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy Summary
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

export default SummarizeModal;
