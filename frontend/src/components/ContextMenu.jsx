import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Languages, Sparkles, Copy, Reply, ChevronRight, Check } from 'lucide-react';

/**
 * Modern custom right-click context menu matching ProChat AI specifications & expected UI
 */
const ContextMenu = ({
  isOpen,
  x,
  y,
  onClose,
  onTranslate,
  onSummarize,
  onCopy,
  onReply,
  message,
}) => {
  const menuRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [coords, setCoords] = useState({ top: y, left: x });

  // Boundary detection and collision clamping
  useEffect(() => {
    if (!isOpen) return;

    const calculatePosition = () => {
      const padding = 12;
      const menuWidth = 230; // Menu width
      const menuHeight = 210; // Menu height

      const innerWidth = window.innerWidth;
      const innerHeight = window.innerHeight;

      let adjustedLeft = x;
      let adjustedTop = y;

      if (adjustedLeft + menuWidth > innerWidth - padding) {
        adjustedLeft = Math.max(padding, innerWidth - menuWidth - padding);
      }
      if (adjustedLeft < padding) {
        adjustedLeft = padding;
      }

      if (adjustedTop + menuHeight > innerHeight - padding) {
        adjustedTop = Math.max(padding, innerHeight - menuHeight - padding);
      }
      if (adjustedTop < padding) {
        adjustedTop = padding;
      }

      setCoords({ top: adjustedTop, left: adjustedLeft });
    };

    calculatePosition();
  }, [isOpen, x, y]);

  // Handle outside click, escape, and scroll
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', onClose);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [isOpen, onClose]);

  const handleCopyClick = (e) => {
    e.stopPropagation();
    setCopied(true);
    onCopy();
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 350);
  };

  const handleTranslateClick = (e) => {
    e.stopPropagation();
    onTranslate();
    onClose();
  };

  const handleSummarizeClick = (e) => {
    e.stopPropagation();
    onSummarize();
    onClose();
  };

  const handleReplyClick = (e) => {
    e.stopPropagation();
    onReply?.();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.94, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -6 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`,
          }}
          className="fixed z-50 w-[230px] rounded-2xl bg-[#111b21] border border-[#222e35] shadow-[0_16px_40px_rgba(0,0,0,0.7)] text-[#e9edef] overflow-hidden select-none"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Menu Items matching Expected UI */}
          <div className="flex flex-col py-1">
            {/* 1. Translate Message */}
            <button
              type="button"
              onClick={handleTranslateClick}
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-[#e9edef] hover:bg-[#1e262c] hover:text-white transition-colors group cursor-pointer border-b border-[#222e35]/70"
            >
              <div className="flex items-center gap-3">
                <Languages className="w-4 h-4 text-[#00a884] group-hover:scale-110 transition-transform" />
                <span>Translate Message</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8696a0] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* 2. Summarize Message */}
            <button
              type="button"
              onClick={handleSummarizeClick}
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-[#e9edef] hover:bg-[#1e262c] hover:text-white transition-colors group cursor-pointer border-b border-[#222e35]/70"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-[#c084fc] group-hover:scale-110 transition-transform" />
                <span>Summarize Message</span>
              </div>
            </button>

            {/* 3. Copy Message */}
            <button
              type="button"
              onClick={handleCopyClick}
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-[#e9edef] hover:bg-[#1e262c] hover:text-white transition-colors group cursor-pointer border-b border-[#222e35]/70"
            >
              <div className="flex items-center gap-3">
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-[#8696a0] group-hover:text-white transition-colors" />
                )}
                <span>{copied ? 'Copied!' : 'Copy Message'}</span>
              </div>
            </button>

            {/* 4. Reply */}
            <button
              type="button"
              onClick={handleReplyClick}
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-[#e9edef] hover:bg-[#1e262c] hover:text-white transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Reply className="w-4 h-4 text-[#8696a0] group-hover:text-white group-hover:-translate-x-0.5 transition-all" />
                <span>Reply</span>
              </div>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ContextMenu;
