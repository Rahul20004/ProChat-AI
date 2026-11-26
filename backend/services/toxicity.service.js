const { genAI } = require('./gemini.service');
const { SmartCache } = require('../utils/cache');
const { recordAIMetrics } = require('../utils/aiLogger');

// Dedicated cache for toxicity evaluations (LRU 500 items, TTL 24h)
const toxicityCache = new SmartCache({ maxSize: 500, defaultTTLMs: 1000 * 60 * 60 * 24 });

const CANONICAL_CATEGORIES = [
  'Abusive language',
  'Insults',
  'Harassment',
  'Bullying',
  'Threats or violent language',
  'Hate speech',
  'Sexual harassment',
  'Severe toxic language',
];

/**
 * Normalize and validate AI category string against supported safety taxonomy
 */
function normalizeCategory(category) {
  if (!category) return 'Abusive language';
  const lower = category.toLowerCase().trim();

  if (lower.includes('threat') || lower.includes('violen')) return 'Threats or violent language';
  if (lower.includes('hate') || lower.includes('discrim')) return 'Hate speech';
  if (lower.includes('sexual')) return 'Sexual harassment';
  if (lower.includes('bully')) return 'Bullying';
  if (lower.includes('harass')) return 'Harassment';
  if (lower.includes('insult') || lower.includes('name-call')) return 'Insults';
  if (lower.includes('severe') || lower.includes('extreme')) return 'Severe toxic language';
  if (lower.includes('abuse') || lower.includes('profan') || lower.includes('vulgar')) return 'Abusive language';

  // Check direct canonical match
  const found = CANONICAL_CATEGORIES.find((c) => c.toLowerCase() === lower);
  return found || 'Abusive language';
}

/**
 * Check if a text message is toxic, abusive, threatening, or harmful using Gemini AI.
 * Produces structured classification: isToxic, category, severity, confidence, reason.
 * 
 * @param {string} text - The content of the message
 * @returns {Promise<{ isToxic: boolean, category: string, severity: 'Low' | 'Medium' | 'High' | 'None', confidence: number, reason: string, fromCache?: boolean }>}
 */
const checkToxicity = async (text) => {
  if (!text || text.trim() === '') {
    return {
      isToxic: false,
      category: 'None',
      severity: 'None',
      confidence: 1.0,
      reason: 'Empty message',
    };
  }

  const trimmedText = text.trim();
  const cacheKey = `toxicity_${trimmedText.toLowerCase()}`;

  // 1. Check in-memory smart cache or in-flight deduplication
  const cacheResult = await toxicityCache.getOrFetch(cacheKey, async () => {
    const startTime = Date.now();
    try {
      const model = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1, // low temperature for consistent moderation
        },
      });

      const prompt = `You are an expert AI content moderator for ProChat AI.
Analyze the following user chat message carefully and determine if it contains harmful, toxic, threatening, or abusive content.

CRITICAL INSTRUCTIONS & NUANCE GUIDANCE:
1. Distinguish between harmless banter, mild sarcasm, gaming jargon, constructive disagreement, jokes, and genuine hostility.
   - Do NOT flag friendly slang, harmless teasing between friends, or expressing disappointment as toxic.
   - ONLY flag messages that are genuinely harmful, threatening, severely abusive, sexually harassing, or hateful.
2. If in doubt or confidence is low, set isToxic to false.
3. Categorize into ONE of:
   - "Threats or violent language" (physical harm, violence, intimidation)
   - "Hate speech" (attacking protected groups, racism, bigotry)
   - "Sexual harassment" (unsolicited sexual remarks, explicit harassment)
   - "Harassment" (persistent targeted intimidation, stalker behavior)
   - "Bullying" (cruel humiliation, targeted cruelty)
   - "Abusive language" (severe vulgar profanity aimed at attacking someone)
   - "Insults" (direct personal attacks, derogatory name-calling)
   - "Severe toxic language" (extreme malice, self-harm encouragement)
   - "None" (if clean or benign)
4. Assign severity: "Low", "Medium", or "High" (or "None" if clean).
5. Confidence score: A float between 0.0 and 1.0.

Respond strictly in valid JSON matching this schema:
{
  "isToxic": boolean,
  "category": string,
  "severity": "Low" | "Medium" | "High" | "None",
  "confidence": number,
  "reason": "1 concise sentence explaining the judgment"
}

Message to analyze:
"${trimmedText.replace(/"/g, '\\"')}"`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();

      const cleaned = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (pe) {
        console.error('Failed to parse toxicity JSON:', responseText);
        parsed = {
          isToxic: false,
          category: 'None',
          severity: 'None',
          confidence: 0.5,
          reason: 'Could not structure evaluation',
        };
      }

      // Backend validation & normalization
      const isToxicRaw = !!parsed.isToxic;
      let confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.8;
      confidence = Math.max(0, Math.min(1, confidence));

      let severity = parsed.severity || 'None';
      if (!['Low', 'Medium', 'High', 'None'].includes(severity)) {
        severity = isToxicRaw ? 'Medium' : 'None';
      }

      // If AI flagged as toxic but confidence is low (< 0.65), avoid alarming false positives
      const isToxic = isToxicRaw && confidence >= 0.65 && severity !== 'None';
      const category = isToxic ? normalizeCategory(parsed.category) : 'None';
      const finalSeverity = isToxic ? severity : 'None';
      const reason = parsed.reason || (isToxic ? 'Flagged by automated moderation' : 'Clean message');

      const evaluation = {
        isToxic,
        category,
        severity: finalSeverity,
        confidence,
        reason,
      };

      recordAIMetrics({
        provider: 'gemini',
        action: 'toxicity-detection',
        durationMs: Date.now() - startTime,
        success: true,
        fromCache: false,
      });

      return evaluation;
    } catch (error) {
      console.error('Toxicity Service Error:', error.message);
      // Non-blocking fail-safe: if Gemini fails or quota is exhausted, allow messages through
      recordAIMetrics({
        provider: 'gemini',
        action: 'toxicity-detection',
        durationMs: Date.now() - startTime,
        success: false,
        errorType: error.code || 'UNKNOWN',
      });

      return {
        isToxic: false,
        category: 'None',
        severity: 'None',
        confidence: 0,
        reason: 'AI service temporarily unavailable',
      };
    }
  });

  return {
    ...(cacheResult && cacheResult.value ? cacheResult.value : cacheResult),
    fromCache: cacheResult ? cacheResult.fromCache : false,
  };
};

module.exports = {
  checkToxicity,
  CANONICAL_CATEGORIES,
};
