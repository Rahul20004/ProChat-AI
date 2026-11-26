/**
 * Utility to extract reply metadata and clean message text
 * Supports both modern structured replyTo schema and legacy "> Replying to @..." markdown text
 */
export function parseReplyFromMessage(msg) {
  if (!msg) return { hasReply: false, cleanText: '' };

  // 1. Structured replyTo field populated from MongoDB
  if (msg.replyTo) {
    const isDeleted = Boolean(msg.replyTo.isDeletedForEveryone);
    const senderName = msg.replyTo.sender?.username || 'User';
    const isSenderAi = Boolean(msg.replyTo.sender?.isAi);
    const originalText = isDeleted ? 'Original message unavailable' : (msg.replyTo.text || '');
    const originalId = msg.replyTo._id ? msg.replyTo._id.toString() : null;

    return {
      hasReply: true,
      senderName,
      isSenderAi,
      originalText,
      originalId,
      isDeleted,
      cleanText: msg.text || '',
    };
  }

  // 2. Backward compatibility: Parse legacy concatenated raw text
  // Pattern: > Replying to @Username: "Quoted text"\n\nActual reply
  if (typeof msg.text === 'string' && msg.text.startsWith('> Replying to @')) {
    const regex = /^>\s*Replying to @([^:]+):\s*"([^"]*)"\s*\n\n([\s\S]*)$/;
    const match = msg.text.match(regex);
    if (match) {
      return {
        hasReply: true,
        senderName: match[1],
        isSenderAi: match[1].toLowerCase().includes('prochat') || match[1].toLowerCase().includes('ai'),
        originalText: match[2],
        originalId: null, // Legacy message has no direct objectId reference
        isDeleted: false,
        cleanText: match[3],
      };
    }
  }

  return {
    hasReply: false,
    cleanText: msg.text || '',
  };
}
