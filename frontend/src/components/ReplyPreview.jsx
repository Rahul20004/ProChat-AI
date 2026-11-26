import React from 'react';
import { Reply, Sparkles } from 'lucide-react';

/**
 * Nested Reply Preview Component
 * Renders inside a chat message bubble above the actual reply text:
 * - Shows original sender name
 * - Shows original message preview with ellipsis truncation
 * - Displays colored vertical accent line on the left
 * - Subtle background contrasting with message bubble
 * - Smooth scroll-to-message interaction with highlight
 */
const ReplyPreview = ({
  replyInfo,
  isSelf,
  onScrollToOriginal,
}) => {
  if (!replyInfo || !replyInfo.hasReply) return null;

  const { senderName, isSenderAi, originalText, originalId, isDeleted } = replyInfo;

  const handleClick = (e) => {
    e.stopPropagation();
    if (onScrollToOriginal) {
      onScrollToOriginal(originalId, originalText);
    }
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick(e);
        }
      }}
      title="Click to jump to original message"
      className={`group/reply w-full rounded-lg mb-2 p-2 text-left cursor-pointer transition-all border-l-4 border-l-[#00a884] select-none max-w-full overflow-hidden ${
        isSelf
          ? 'bg-black/25 hover:bg-black/35 text-white/90'
          : 'bg-[#111b21]/80 hover:bg-[#111b21] text-chatText'
      }`}
    >
      {/* Original Sender Header */}
      <div className="flex items-center gap-1.5 min-w-0">
        <Reply className="w-3 h-3 text-[#00a884] flex-shrink-0 group-hover/reply:scale-110 transition-transform" />
        <span className="font-semibold text-xs text-[#00a884] truncate">
          {senderName}
        </span>
        {isSenderAi && (
          <span className="text-[9px] bg-chatAccent/20 text-chatAccent px-1 rounded font-bold flex items-center gap-0.5 flex-shrink-0">
            <Sparkles className="w-2.5 h-2.5" /> AI
          </span>
        )}
      </div>

      {/* Original Message Text */}
      <p
        className={`text-xs mt-0.5 truncate leading-snug ${
          isDeleted ? 'italic text-[#8696a0]' : 'text-[#8696a0] group-hover/reply:text-[#cfd9df]'
        }`}
      >
        {originalText}
      </p>
    </div>
  );
};

export default ReplyPreview;
