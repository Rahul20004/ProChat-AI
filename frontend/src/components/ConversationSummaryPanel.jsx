import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  AlignLeft,
  Layers,
  CheckCircle2,
  ListTodo,
  AlertCircle,
  FileText,
} from 'lucide-react';

/**
 * Visual styling and metadata for each summary section
 */
const SECTION_METADATA = {
  keyTopics: {
    title: 'Key Topics',
    icon: <Layers className="w-3.5 h-3.5 text-teal-400" />,
    badgeBg: 'bg-teal-500/10 border-teal-500/20 text-teal-300',
    dotColor: 'bg-teal-400',
  },
  decisions: {
    title: 'Decisions',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />,
    badgeBg: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
    dotColor: 'bg-purple-400',
  },
  actionItems: {
    title: 'Action Items',
    icon: <ListTodo className="w-3.5 h-3.5 text-amber-400" />,
    badgeBg: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    dotColor: 'bg-amber-400',
  },
  importantMessages: {
    title: 'Important Messages',
    icon: <AlertCircle className="w-3.5 h-3.5 text-rose-400" />,
    badgeBg: 'bg-rose-500/10 border-rose-500/20 text-rose-300',
    dotColor: 'bg-rose-400',
  },
  default: {
    title: 'Details',
    icon: <FileText className="w-3.5 h-3.5 text-chatAccent" />,
    badgeBg: 'bg-chatAccent/10 border-chatAccent/20 text-chatAccent',
    dotColor: 'bg-chatAccent',
  },
};

/**
 * Detects whether a string is empty or represents a negative placeholder (e.g. "None", "N/A")
 */
function isNegativeOrEmpty(str) {
  if (!str) return true;
  const clean = str.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const negatives = [
    'none',
    'na',
    'nil',
    'nonefound',
    'nonementioned',
    'nonediscussed',
    'nodecisions',
    'nodecisionsmade',
    'nodecisionsreached',
    'noactionitems',
    'notasks',
    'noactionitemsfound',
    'noimportantmessages',
    'notapplicable',
    'notidentified',
    'nospecificdecisions',
    'nospecificactionitems',
    'noneatthisstage',
    'notapplicable',
  ];
  if (negatives.includes(clean)) return true;
  if (/^(none|n\/?a|nil|no decisions|no action items|no tasks|not applicable)[\.\s]*$/i.test(str.trim())) return true;
  return false;
}

/**
 * Cleans leading bullet markers, numbering, and quotes from a single line
 */
function cleanLineMarkers(line) {
  if (!line) return '';
  return line
    .trim()
    .replace(/^[-*+•]\s+/, '')
    .replace(/^\d+[\.\)]\s+/, '')
    .replace(/^>\s*/, '')
    .trim();
}

/**
 * Parses markdown-formatted summary text into structured sections:
 * - Overview: 2-3 sentence paragraph
 * - Key Topics: Array of bullet strings
 * - Decisions: Array of bullet strings (omitted if empty/None)
 * - Action Items: Array of bullet strings (omitted if empty/None)
 * - Important Messages: Array of bullet strings (omitted if empty/None)
 */
function parseSummary(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  const text = rawText.trim();

  const sectionDefs = [
    { key: 'overview', title: 'Overview', regex: /(?:^|\n)\s*(?:[-*+•]\s+)?(?:\*{1,3}|#{1,6})?\s*(?:\d+[\.\)]\s*)?Overview[:\*\s]*(?:\n+|$)/i },
    { key: 'keyTopics', title: 'Key Topics', regex: /(?:^|\n)\s*(?:[-*+•]\s+)?(?:\*{1,3}|#{1,6})?\s*(?:\d+[\.\)]\s*)?(?:Key\s+Topics|Topics\s+Discussed|Core\s+Topics|Topics)[:\*\s]*(?:\n+|$)/i },
    { key: 'decisions', title: 'Decisions', regex: /(?:^|\n)\s*(?:[-*+•]\s+)?(?:\*{1,3}|#{1,6})?\s*(?:\d+[\.\)]\s*)?(?:Decisions\s+Reached|Decisions\s+Made|Decisions)[:\*\s]*(?:\n+|$)/i },
    { key: 'actionItems', title: 'Action Items', regex: /(?:^|\n)\s*(?:[-*+•]\s+)?(?:\*{1,3}|#{1,6})?\s*(?:\d+[\.\)]\s*)?(?:Action\s+Items|Action\s+Points|Tasks|Commitments)[:\*\s]*(?:\n+|$)/i },
    { key: 'importantMessages', title: 'Important Messages', regex: /(?:^|\n)\s*(?:[-*+•]\s+)?(?:\*{1,3}|#{1,6})?\s*(?:\d+[\.\)]\s*)?(?:Important\s+Messages|Key\s+Messages|Important\s+Notes|Notable\s+Messages)[:\*\s]*(?:\n+|$)/i },
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
      overview: text,
      sections: [],
      paragraphs: text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
    };
  }

  matches.sort((a, b) => a.index - b.index);

  let overviewText = '';
  // Check if text prior to the first section header is an introductory overview
  if (matches[0].index > 0) {
    const preamble = text.slice(0, matches[0].index).trim();
    if (preamble && !isNegativeOrEmpty(preamble)) {
      overviewText = preamble;
    }
  }

  const sections = [];

  for (let i = 0; i < matches.length; i++) {
    const curr = matches[i];
    const start = curr.index + curr.headerLen;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const rawContent = text.slice(start, end).trim();

    if (!rawContent) continue;

    if (curr.key === 'overview') {
      overviewText = rawContent
        .split(/\r?\n/)
        .map((l) => cleanLineMarkers(l))
        .filter(Boolean)
        .join(' ');
      continue;
    }

    const items = rawContent
      .split(/\r?\n/)
      .map((line) => cleanLineMarkers(line))
      .filter((line) => Boolean(line) && !isNegativeOrEmpty(line));

    // Do NOT display empty sections (e.g. if no decisions or action items were found)
    if (items.length > 0) {
      sections.push({
        key: curr.key,
        title: curr.title,
        items,
      });
    }
  }

  return {
    isStructured: Boolean(overviewText) || sections.length > 0,
    overview: overviewText,
    sections,
    paragraphs: [],
  };
}

/**
 * Cleanly renders inline bold (e.g. **bold**), italics (*text*), and code (`code`)
 * without ever displaying raw formatting asterisks or symbols in the UI.
 */
function renderInlineMarkdown(str) {
  if (!str) return null;
  const parts = str.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
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
        <code key={i} className="px-1.5 py-0.5 rounded bg-[#202c33] text-emerald-300 font-mono text-[11px] border border-[#2a3942]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2 && !part.startsWith('**')) {
      return (
        <em key={i} className="italic text-[#d1d7db]">
          {part.slice(1, -1)}
        </em>
      );
    }
    // Clean any stray asterisks, hashes, or bullet characters that might leak through
    return part
      .replace(/\*\*/g, '')
      .replace(/^\s*#+\s*/, '')
      .replace(/^[-*+•]\s+/, '');
  });
}

/**
 * AI Conversation Summary Panel Component
 * Displays a clean, structured, collapsible, and responsive summary panel:
 * - Overview: 2-3 sentence synthesis callout
 * - Key Topics: High-priority subjects
 * - Decisions: Real consensus reached (omitted if none)
 * - Action Items: Explicit tasks & commitments (omitted if none)
 * - Important Messages: Critical alerts or details (omitted if none)
 * - Copy Summary button for instant clipboard export
 * - Smooth Collapse/Expand toggle & non-destructive Dismiss
 */
const ConversationSummaryPanel = ({ summary, onDismiss }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!summary || !summary.summaryText) return null;

  const parsed = parseSummary(summary.summaryText);
  if (!parsed) return null;

  // Format clean plain-text summary for clipboard copying
  const handleCopySummary = async () => {
    try {
      const lines = ['AI Conversation Summary', ''];

      if (parsed.overview) {
        lines.push('Overview:');
        lines.push(parsed.overview);
        lines.push('');
      }

      if (parsed.sections && parsed.sections.length > 0) {
        parsed.sections.forEach((sec) => {
          lines.push(`${sec.title}:`);
          sec.items.forEach((item) => {
            lines.push(`• ${item.replace(/[*#`]/g, '')}`);
          });
          lines.push('');
        });
      } else if (parsed.paragraphs && parsed.paragraphs.length > 0) {
        parsed.paragraphs.forEach((p) => {
          lines.push(p.replace(/[*#`]/g, ''));
          lines.push('');
        });
      }

      await navigator.clipboard.writeText(lines.join('\n').trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy summary:', err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="bg-[#182229]/95 backdrop-blur-md border border-chatAccent/20 hover:border-chatAccent/35 mx-3 md:mx-4 my-2.5 rounded-2xl shadow-xl overflow-hidden transition-all text-xs z-10"
    >
      {/* ──── Header Bar ──── */}
      <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 bg-[#111b21] border-b border-[#222e35]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-chatAccent/10 border border-chatAccent/20 text-chatAccent flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="truncate">
            <h3 className="font-bold text-white tracking-wide flex items-center gap-1.5 leading-none text-xs sm:text-[13px]">
              AI Conversation Summary
            </h3>
            <span className="text-[10px] text-[#8696a0] mt-0.5 block truncate">
              Real-time Gemini synthesis • Context-aware
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Copy Summary Button */}
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#8696a0] hover:text-white bg-[#182229] hover:bg-[#202c33] border border-[#222e35] transition-all cursor-pointer"
            title="Copy summary to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-semibold text-[10px] sm:text-[11px]">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-[#8696a0]" />
                <span className="hidden xs:inline">Copy</span>
              </>
            )}
          </button>

          {/* Collapse / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#8696a0] hover:text-white bg-[#182229] hover:bg-[#202c33] border border-[#222e35] transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand summary' : 'Collapse summary'}
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="w-3 h-3 text-chatAccent" />
                <span className="hidden xs:inline">Expand</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3 h-3 text-[#8696a0]" />
                <span className="hidden xs:inline">Collapse</span>
              </>
            )}
          </button>

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={onDismiss}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#8696a0] hover:text-rose-400 bg-[#182229] hover:bg-rose-500/10 border border-[#222e35] hover:border-rose-500/20 transition-all cursor-pointer"
            title="Dismiss summary from view"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Dismiss</span>
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
            className="p-3 sm:p-3.5 max-h-64 sm:max-h-72 overflow-y-auto space-y-2.5 pr-2 scrollbar-thin"
          >
            {/* 1. Overview Section (Callout Card) */}
            {parsed.overview && (
              <div className="p-3 rounded-xl bg-[#111b21] border border-[#222e35] space-y-1">
                <div className="flex items-center gap-1.5 text-sky-400 font-semibold text-[11px]">
                  <span className="p-1 rounded-md bg-sky-500/10 border border-sky-500/20">
                    <AlignLeft className="w-3.5 h-3.5" />
                  </span>
                  <span>Overview</span>
                </div>
                <p className="text-[#e9edef] text-xs sm:text-[13px] leading-relaxed pl-0.5">
                  {renderInlineMarkdown(parsed.overview)}
                </p>
              </div>
            )}

            {/* 2. Structured Sections (Key Topics, Decisions, Action Items, Important Messages) */}
            {parsed.sections.length > 0 && (
              <div
                className={`grid gap-2.5 ${
                  parsed.sections.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
                }`}
              >
                {parsed.sections.map((section) => {
                  const meta = SECTION_METADATA[section.key] || SECTION_METADATA.default;
                  return (
                    <div
                      key={section.key}
                      className="p-2.5 rounded-xl bg-[#111b21] border border-[#222e35] space-y-1.5"
                    >
                      {/* Section Title & Icon */}
                      <div className="flex items-center gap-1.5">
                        <span className={`p-1 rounded-md border ${meta.badgeBg}`}>
                          {meta.icon}
                        </span>
                        <h4 className="font-semibold text-white text-[11px] tracking-wide">
                          {section.title}
                        </h4>
                      </div>

                      {/* Bulleted List */}
                      <div className="space-y-1.5 pl-1">
                        {section.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 text-[11px] sm:text-xs text-[#cfd9df] leading-relaxed"
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${meta.dotColor} mt-1.5 flex-shrink-0 opacity-80`}
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
            )}

            {/* Fallback for freeform paragraphs if unstructured */}
            {!parsed.overview && parsed.sections.length === 0 && parsed.paragraphs.length > 0 && (
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
