import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Languages,
  Sparkles,
  Copy,
  Reply,
  Forward,
  Pin,
  Bookmark,
  Trash2,
  ChevronRight,
  Check,
} from 'lucide-react';

/**
 * Modern custom right-click message context menu
 * Matches ProChat AI dark theme specifications and reference grouping:
 * 1. AI Actions (Translate, Summarize)
 * 2. Message Actions (Copy, Reply, Forward)
 * 3. Organize Actions (Pin, Save)
 * 4. Destructive Actions (Delete)
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
  onForward,
  onPin,
  onSave,
  onDelete,
  message,
}) => {
  const menuRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [coords, setCoords] = useState({ top: y, left: x });

  // Boundary detection and collision clamping to keep menu fully within viewport
  useEffect(() => {
    if (!isOpen) return;

    const calculatePosition = () => {
      const padding = 16;
      const menuWidth = 230;
      const menuHeight = 350; // Total height with 4 grouped sections

      const innerWidth = window.innerWidth;
      const innerHeight = window.innerHeight;

      let adjustedLeft = x;
      let adjustedTop = y;

      // Horizontal clamp
      if (adjustedLeft + menuWidth > innerWidth - padding) {
        adjustedLeft = Math.max(padding, innerWidth - menuWidth - padding);
      }
      if (adjustedLeft < padding) {
        adjustedLeft = padding;
      }

      // Vertical clamp (flip upwards if near bottom)
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

  // Handle outside click, escape key, and page scroll
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
    }, 300);
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

  const handleForwardClick = (e) => {
    e.stopPropagation();
    onForward?.();
    onClose();
  };

  const handlePinClick = (e) => {
    e.stopPropagation();
    onPin?.();
    onClose();
  };

  const handleSaveClick = (e) => {
    e.stopPropagation();
    onSave?.();
    onClose();
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    onDelete?.();
    onClose();
  };

  const isPinned = message?.isPinned;

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
          className="fixed z-50 w-[230px] rounded-2xl bg-[#111b21] border border-[#222e35] shadow-[0_16px_40px_rgba(0,0,0,0.7)] text-[#e9edef] overflow-hidden select-none py-1.5"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* ──── GROUP 1: AI ACTIONS ──── */}
          <div className="flex flex-col">
            {/* 1. Translate Message */}
            <button
              type="button"
              onClick={handleTranslateClick}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-[#e9edef] hover:bg-[#1e262c] hover:text-white transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Languages className="w-4 h-4 text-[#00a884] group-hover:scale-110 transition-transform" />
                <span>Translate Message</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[#8696a0] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* 2. Summarize Message */}
            <button
              type="button"
              onClick={handleSummarizeClick}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-[#e9edef] hover:bg-[#1e262c] hover:text-white transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-[#c084fc] group-hover:scale-110 transition-transform" />
                <span>Summarize Message</span>
              </div>
            </button>
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-[#222e35]" />

          {/* ──── GROUP 2: MESSAGE ACTIONS ──── */}
          <div className="flex flex-col">
            {/* 3. Copy Message */}
            <button
              type="button"
              onClick={handleCopyClick}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-[#e9edef] hover:bg-[#1e262c] hover:text-white transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
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
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-[#e9edef] hover:bg-[#1e262c] hover:text-white transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Reply className="w-4 h-4 text-[#8696a0] group-hover:text-white group-hover:-translate-x-0.5 transition-all" />
                <span>Reply</span>
              </div>
            </button>

            {/* 5. Forward Message */}
            <button
              type="button"
              onClick={handleForwardClick}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-[#e9edef] hover:bg-[#1e262c] hover:text-white transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Forward className="w-4 h-4 text-[#8696a0] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                <span>Forward Message</span>
              </div>
            </button>
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-[#222e35]" />

          {/* ──── GROUP 3: ORGANIZE ACTIONS ──── */}
          <div className="flex flex-col">
            {/* 6. Pin Message */}
            <button
              type="button"
              onClick={handlePinClick}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-[#e9edef] hover:bg-[#1e262c] hover:text-white transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Pin className={`w-4 h-4 ${isPinned ? 'text-amber-400 rotate-45' : 'text-[#8696a0]'} group-hover:text-white transition-colors`} />
                <span>{isPinned ? 'Unpin Message' : 'Pin Message'}</span>
              </div>
            </button>

            {/* 7. Save Message */}
            <button
              type="button"
              onClick={handleSaveClick}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-[#e9edef] hover:bg-[#1e262c] hover:text-white transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Bookmark className="w-4 h-4 text-[#8696a0] group-hover:text-white transition-colors" />
                <span>Save Message</span>
              </div>
            </button>
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-[#222e35]" />

          {/* ──── GROUP 4: DESTRUCTIVE ACTION ──── */}
          <div className="flex flex-col">
            {/* 8. Delete Message */}
            <button
              type="button"
              onClick={handleDeleteClick}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform" />
                <span>Delete Message</span>
              </div>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ContextMenu;
