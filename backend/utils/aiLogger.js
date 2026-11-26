const Analytics = require('../models/Analytics');

/**
 * AI Logging and Metrics Tracker
 * Records provider calls, durations, quota errors, fallback usages, and cache hits.
 * Never prints raw API keys or sensitive user payloads.
 */
async function recordAIMetrics({
  provider = 'gemini',
  action = 'translate',
  durationMs = 0,
  success = true,
  errorType = null,
  fallbackUsed = false,
  fallbackProvider = null,
  fromCache = false,
}) {
  // Safe console log
  const statusStr = success ? 'SUCCESS' : `FAILED [${errorType || 'UNKNOWN'}]`;
  const fallbackStr = fallbackUsed ? ` | Fallback -> ${fallbackProvider}` : '';
  const cacheStr = fromCache ? ' | (Cache Hit)' : '';

  console.log(
    `[AI Monitoring] Provider: ${provider} | Action: ${action} | Time: ${durationMs}ms | ${statusStr}${fallbackStr}${cacheStr}`
  );

  // Asynchronously record into MongoDB Analytics (fire-and-forget, non-blocking)
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return; // Skip MongoDB counter when running in standalone test environment
    }
    if (fromCache) {
      await Analytics.incrementCount('cacheHitsCount', 1);
      return;
    }

    if (fallbackUsed) {
      await Analytics.incrementCount('fallbackRequestsCount', 1);
    } else if (provider === 'gemini') {
      await Analytics.incrementCount('geminiRequestsCount', 1);
    }

    if (
      errorType === 'DAILY_QUOTA_LIMIT' ||
      errorType === 'RPM_LIMIT' ||
      errorType === 'TOKEN_LIMIT' ||
      errorType === 'QUOTA_EXCEEDED'
    ) {
      await Analytics.incrementCount('quotaErrorsCount', 1);
    }

    if (success && durationMs > 0) {
      await Analytics.incrementCount('aiSuccessCount', 1);
      await Analytics.incrementCount('totalAiResponseTimeMs', durationMs);
    }
  } catch (err) {
    // Non-fatal logging error
    console.error('[AI Monitoring Error] Failed to persist analytics count:', err.message);
  }
}

module.exports = {
  recordAIMetrics,
};
