import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Lightbulb,
  CheckCircle2,
  ListTodo,
  FileText,
} from 'lucide-react';

const SECTION_CONFIG = {
  topics: {
    icon: <MessageSquare className="w-3.5 h-3.5 text-sky-400" />,
    badgeBg: 'bg-sky-500/10 border-sky-500/20 text-sky-300',
    dotColor: 'bg-sky-400',
  },
  keyPoints: {
    icon: <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />,
    badgeBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    dotColor: 'bg-emerald-400',
  },
  decisions: {
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />,
    badgeBg: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
    dotColor: 'bg-purple-400',
  },
  actionItems: {
    icon: <ListTodo className="w-3.5 h-3.5 text-amber-400" />,
    badgeBg: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    dotColor: 'bg-amber-400',
  },
  default: {
    icon: <FileText className="w-3.5 h-3.5 text-chatAccent" />,
    badgeBg: 'bg-chatAccent/10 border-chatAccent/20 text-chatAccent',
    dotColor: 'bg-chatAccent',
  },
};

/**
 * Helper to parse markdown-formatted summary into structured sections:
 * - Topics Discussed
 * - Key Points
 * - Decisions
 * - Action Items
 */
function parseSummary(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  const text = rawText.trim();

  const sectionDefs = [
    { key: 'topics', title: 'Topics Discussed', regex: /(?:^|\n)\s*(?:[-*+]\s+)?(?:\*{1,3}|#{1,6})?\s*(?:\d+[\.\)]\s*)?Topics(?:\s+Discussed)?[:\*\s]*(?:\n+|$)/i },
    { key: 'keyPoints', title: 'Key Points', regex: /(?:^|\n)\s*(?:[-*+]\s+)?(?:\*{1,3}|#{1,6})?\s*(?:\d+[\.\)]\s*)?Key\s+Points[:\*\s]*(?:\n+|$)/i },
    { key: 'decisions', title: 'Decisions', regex: /(?:^|\n)\s*(?:[-*+]\s+)?(?:\*{1,3}|#{1,6})?\s*(?:\d+[\.\)]\s*)?Decisions(?:\s+Reached)?[:\*\s]*(?:\n+|$)/i },
    { key: 'actionItems', title: 'Action Items', regex: /(?:^|\n)\s*(?:[-*+]\s+)?(?:\*{1,3}|#{1,6})?\s*(?:\d+[\.\)]\s*)?Action\s+Items[:\*\s]*(?:\n+|$)/i },
  ];

  const matches = [];
  for (const def of sectionDefs) {
    const match = text.match(def.regex);
    if (match && match.index !== undefined) {
      matches.push({
        key: def.key,
        title: def.title,
        index: match.index,
        headerLen: match[0].length,
      });
    }
  }

  // Fallback for unstructured plain text / single paragraph
  if (matches.length === 0) {
    return {
      isStructured: false,
      sections: [],
      paragraphs: text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
    };
  }

  matches.sort((a, b) => a.index - b.index);

  const sections = [];
  for (let i = 0; i < matches.length; i++) {
    const curr = matches[i];
    const start = curr.index + curr.headerLen;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.slice(start, end).trim();

    if (content) {
      const items = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '').trim())
        .filter(Boolean);

      if (items.length > 0) {
        sections.push({
          key: curr.key,
          title: curr.title,
          items,
        });
      }
    }
  }

  return {
    isStructured: sections.length > 0,
    sections,
    paragraphs: [],
  };
}

/**
 * Cleanly renders inline bold (e.g. **bold**) and codes without exposing raw asterisks
 */
function renderInlineMarkdown(str) {
  if (!str) return null;
  const parts = str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} className="px-1 py-0.5 rounded bg-[#222e35] text-chatAccent font-mono text-[10px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    // Clean any stray asterisks or hashes that might appear as raw markdown artifacts
    return part.replace(/\*\*/g, '').replace(/^#+\s*/, '');
  });
}

/**
 * AI Conversation Summary Panel
 * Replaces plain text dump with a clean, collapsible, structured panel:
 * - Highlights 4 key sections with subtle iconography
 * - Strips raw markdown symbols and formats bold emphasis cleanly
 * - Compact layout with max height to avoid obstructing chat history
 * - Smooth Collapse/Expand toggle and clear Dismiss button
 */
const ConversationSummaryPanel = ({ summary, onDismiss }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!summary || !summary.summaryText) return null;

  const parsed = parseSummary(summary.summaryText);
  if (!parsed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="bg-[#182229]/95 backdrop-blur-md border border-chatAccent/20 hover:border-chatAccent/35 mx-3 md:mx-4 my-2.5 rounded-2xl shadow-xl overflow-hidden transition-all text-xs z-10"
    >
      {/* ──── Header Bar ──── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#111b21] border-b border-[#222e35]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-chatAccent/10 border border-chatAccent/20 text-chatAccent flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-white tracking-wide flex items-center gap-2 leading-none">
              AI Conversation Summary
            </h3>
            <span className="text-[10px] text-[#8696a0] mt-0.5 block">
              Powered by Gemini • Real-time synthesis
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Collapse / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-[#8696a0] hover:text-white bg-[#182229] hover:bg-[#202c33] border border-[#222e35] transition-colors"
            title={isCollapsed ? 'Expand summary' : 'Collapse summary'}
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="w-3 h-3 text-chatAccent" />
                <span>Expand</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3 h-3 text-[#8696a0]" />
                <span>Collapse</span>
              </>
            )}
          </button>

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={onDismiss}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#8696a0] hover:text-rose-400 bg-[#182229] hover:bg-rose-500/10 border border-[#222e35] hover:border-rose-500/20 transition-all cursor-pointer"
            title="Dismiss summary from view"
          >
            <X className="w-3.5 h-3.5" />
            <span>Dismiss</span>
          </button>
        </div>
      </div>

      {/* ──── Body Content (Collapsible) ──── */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="p-3.5 max-h-56 overflow-y-auto space-y-3 pr-2 scrollbar-thin"
          >
            {parsed.isStructured && parsed.sections.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {parsed.sections.map((section) => {
                  const cfg = SECTION_CONFIG[section.key] || SECTION_CONFIG.default;
                  return (
                    <div
                      key={section.key}
                      className="p-2.5 rounded-xl bg-[#111b21] border border-[#222e35] space-y-1.5"
                    >
                      {/* Section Title */}
                      <div className="flex items-center gap-1.5">
                        <span className={`p-1 rounded-md border ${cfg.badgeBg}`}>
                          {cfg.icon}
                        </span>
                        <h4 className="font-semibold text-white text-[11px] tracking-wide">
                          {section.title}
                        </h4>
                      </div>

                      {/* Items List */}
                      <div className="space-y-1 pl-1">
                        {section.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 text-[11px] text-[#cfd9df] leading-relaxed"
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${cfg.dotColor} mt-1.5 flex-shrink-0 opacity-80`}
                            />
                            <div className="flex-1 break-words">
                              {renderInlineMarkdown(item)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Fallback for freeform paragraphs without section headers */
              <div className="p-3 rounded-xl bg-[#111b21] border border-[#222e35] space-y-2 text-[#cfd9df] leading-relaxed text-xs">
                {parsed.paragraphs.map((para, i) => (
                  <p key={i} className="break-words">
                    {renderInlineMarkdown(para)}
                  </p>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ConversationSummaryPanel;
