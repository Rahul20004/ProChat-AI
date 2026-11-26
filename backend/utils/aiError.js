/**
 * Centralized AI Error Parser & Classifier for ProChat AI
 * Detects specific quota categories (daily limit, RPM limit, token limit),
 * network failures (ECONNREFUSED, ETIMEDOUT), invalid API keys, model unavailability,
 * and HTTP status codes (400, 401, 403, 404, 429, 500, 502, 503, 504).
 * Strips raw API keys, URLs, and internal stack traces for safe client presentation.
 */

function parseAIError(error, feature = 'AI') {
  const featureLabel = feature === 'Summarization' ? 'Summarization' : feature === 'Translation' ? 'Translation' : 'AI Service';

  if (!error) {
    return {
      statusCode: 500,
      errorType: 'SERVER_ERROR',
      userTitle: `${featureLabel} Failed`,
      userMessage: `Something went wrong while processing your ${featureLabel.toLowerCase()} request. Please try again later.`,
      retryDelaySeconds: null,
      resetText: null,
      isDailyQuota: false,
      canRetryNow: true,
      isTransient: false,
    };
  }

  const rawMessage = (error.message || '').toString();
  const errorStatus = error.status || error.statusCode || null;
  const errorCode = error.code || null;

  // 1. Extract retryDelay from Gemini / Google RPC error response if present
  // Example: {"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"76655s"}
  let retryDelaySeconds = null;
  const retryMatch = rawMessage.match(/retryDelay["']?:\s*["']?(\d+)(?:s)?["']?/i);
  if (retryMatch) {
    retryDelaySeconds = parseInt(retryMatch[1], 10);
  }

  // Format readable reset text
  let resetText = null;
  if (retryDelaySeconds && retryDelaySeconds > 0) {
    if (retryDelaySeconds < 60) {
      resetText = `in ~${retryDelaySeconds} seconds`;
    } else if (retryDelaySeconds < 3600) {
      const mins = Math.ceil(retryDelaySeconds / 60);
      resetText = `in ~${mins} minute${mins > 1 ? 's' : ''}`;
    } else {
      const hours = Math.round((retryDelaySeconds / 3600) * 10) / 10;
      resetText = `in ~${hours} hour${hours > 1 ? 's' : ''}`;
    }
  }

  // 2. Identify Gemini HTTP 429 Quota Categories
  const is429 =
    errorStatus === 429 ||
    rawMessage.includes('429') ||
    rawMessage.includes('Too Many Requests') ||
    rawMessage.includes('RESOURCE_EXHAUSTED');

  if (is429) {
    // A. Token Limit (TPM)
    const isTokenLimit =
      rawMessage.includes('TokensPerMinute') ||
      rawMessage.includes('token limit') ||
      rawMessage.includes('quotaMetric: tokens') ||
      rawMessage.includes('RESOURCE_EXHAUSTED_TOKENS');

    if (isTokenLimit) {
      return {
        statusCode: 429,
        errorType: 'TOKEN_LIMIT',
        userTitle: `${featureLabel} Token Limit Reached`,
        userMessage: `The ${featureLabel.toLowerCase()} input/output token limit was reached. Please try sending a shorter message.`,
        retryDelaySeconds: retryDelaySeconds || 30,
        resetText: resetText || 'in a moment',
        isDailyQuota: false,
        canRetryNow: true,
        isTransient: true,
      };
    }

    // B. Daily Quota Limit
    const isDaily =
      rawMessage.includes('requests per day') ||
      rawMessage.includes('GenerateRequestsPerDay') ||
      rawMessage.includes('limit exceeded on Free Tier') ||
      rawMessage.includes('free_tier_requests') ||
      rawMessage.includes('exceeded your current quota') ||
      (retryDelaySeconds && retryDelaySeconds > 300);

    if (isDaily) {
      return {
        statusCode: 429,
        errorType: 'DAILY_QUOTA_LIMIT',
        userTitle: `${featureLabel} Daily Quota Reached`,
        userMessage: `${featureLabel} is temporarily unavailable because the AI service has reached its daily usage limit. Please try again after the quota resets.`,
        retryDelaySeconds,
        resetText,
        isDailyQuota: true,
        canRetryNow: false,
        isTransient: false,
      };
    }

    // C. Requests-Per-Minute Limit (RPM / transient)
    return {
      statusCode: 429,
      errorType: 'RPM_LIMIT',
      userTitle: `${featureLabel} Service Busy (Rate Limit)`,
      userMessage: `The ${featureLabel.toLowerCase()} service is experiencing high traffic. Please wait a moment before trying again.`,
      retryDelaySeconds: retryDelaySeconds || 20,
      resetText: resetText || 'in a few seconds',
      isDailyQuota: false,
      canRetryNow: false,
      isTransient: true,
    };
  }

  // 3. Authentication & API Key Errors (401, 403, or 400 with invalid key)
  const isAuth =
    errorStatus === 401 ||
    errorStatus === 403 ||
    errorCode === 'AUTH_ERROR' ||
    rawMessage.includes('API_KEY_INVALID') ||
    rawMessage.includes('API key not valid') ||
    rawMessage.includes('UNAUTHENTICATED') ||
    rawMessage.includes('Gemini API key is not configured');

  if (isAuth) {
    return {
      statusCode: 401,
      errorType: 'AUTH_ERROR',
      userTitle: 'AI Authentication Error',
      userMessage: 'AI service authentication failed. Please verify that a valid GEMINI_API_KEY is configured in backend/.env.',
      retryDelaySeconds: null,
      resetText: null,
      isDailyQuota: false,
      canRetryNow: false,
      isTransient: false,
    };
  }

  // 4. Model Not Found / Unavailable (404)
  const isModelNotFound =
    errorStatus === 404 ||
    rawMessage.includes('is not found for API version') ||
    rawMessage.includes('models/') && rawMessage.includes('not found');

  if (isModelNotFound) {
    return {
      statusCode: 404,
      errorType: 'MODEL_NOT_FOUND',
      userTitle: 'AI Model Unavailable',
      userMessage: 'The configured Gemini model is unavailable or not supported by this API key. Please check the model configuration.',
      retryDelaySeconds: null,
      resetText: null,
      isDailyQuota: false,
      canRetryNow: false,
      isTransient: false,
    };
  }

  // 5. Empty AI Response
  if (errorCode === 'EMPTY_RESPONSE' || rawMessage.includes('empty summary') || rawMessage.includes('empty response')) {
    return {
      statusCode: 500,
      errorType: 'EMPTY_RESPONSE',
      userTitle: 'Empty AI Response',
      userMessage: `The AI service did not generate content for this message. Please try again with a different message.`,
      retryDelaySeconds: null,
      resetText: null,
      isDailyQuota: false,
      canRetryNow: true,
      isTransient: false,
    };
  }

  // 6. Network and Socket Connection Errors (ECONNREFUSED, ETIMEDOUT, etc.)
  const isNetwork =
    errorCode === 'ECONNREFUSED' ||
    errorCode === 'ETIMEDOUT' ||
    errorCode === 'ENOTFOUND' ||
    errorCode === 'EAI_AGAIN' ||
    errorCode === 'NETWORK_ERROR' ||
    rawMessage.includes('ECONNREFUSED') ||
    rawMessage.includes('ETIMEDOUT') ||
    rawMessage.includes('fetch failed') ||
    rawMessage.includes('socket hang up') ||
    rawMessage.includes('network');

  if (isNetwork) {
    return {
      statusCode: 503,
      errorType: 'NETWORK_ERROR',
      userTitle: 'Connection Problem',
      userMessage: `Unable to connect to the ${featureLabel.toLowerCase()} service. Please check your internet connection.`,
      retryDelaySeconds: null,
      resetText: null,
      isDailyQuota: false,
      canRetryNow: true,
      isTransient: true,
    };
  }

  // 7. Upstream Gateway / Server Errors (502, 503, 504)
  if (errorStatus === 502 || errorStatus === 503 || errorStatus === 504) {
    return {
      statusCode: errorStatus,
      errorType: 'GATEWAY_ERROR',
      userTitle: 'AI Service Temporarily Unavailable',
      userMessage: 'The upstream AI service is temporarily unavailable. Please try again in a few moments.',
      retryDelaySeconds: 5,
      resetText: 'in a few seconds',
      isDailyQuota: false,
      canRetryNow: true,
      isTransient: true,
    };
  }

  // 8. Invalid Payload / Bad Request (400)
  if (errorStatus === 400 || errorCode === 'INVALID_PAYLOAD') {
    return {
      statusCode: 400,
      errorType: 'INVALID_PAYLOAD',
      userTitle: 'Invalid Request',
      userMessage: 'Valid message text is required to generate an AI summary.',
      retryDelaySeconds: null,
      resetText: null,
      isDailyQuota: false,
      canRetryNow: false,
      isTransient: false,
    };
  }

  // 9. Generic Internal Server Error (500)
  return {
    statusCode: errorStatus && errorStatus >= 400 && errorStatus < 600 ? errorStatus : 500,
    errorType: 'SERVER_ERROR',
    userTitle: `${featureLabel} Failed`,
    userMessage: `Something went wrong while processing your ${featureLabel.toLowerCase()} request. Please try again later.`,
    retryDelaySeconds: null,
    resetText: null,
    isDailyQuota: false,
    canRetryNow: true,
    isTransient: false,
  };
}

module.exports = {
  parseAIError,
};
