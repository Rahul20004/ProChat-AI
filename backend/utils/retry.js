const { parseAIError } = require('./aiError');

/**
 * Execute an asynchronous operation with exponential backoff and jitter.
 * Automatically avoids retrying permanent errors (such as daily quota exhaustion,
 * authentication failures, or client validation errors).
 */
async function executeWithRetry(operation, options = {}) {
  const maxRetries = options.maxRetries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 400;
  const maxDelayMs = options.maxDelayMs ?? 3000;
  const operationName = options.name || 'AI Operation';

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation(attempt);
    } catch (err) {
      lastError = err;
      const parsed = parseAIError(err);

      // Do NOT retry non-transient errors (e.g., daily quota limit, auth failure, bad request)
      if (!parsed.isTransient || attempt >= maxRetries) {
        throw err;
      }

      // Calculate exponential backoff with jitter
      const exponential = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 150);
      const delay = Math.min(maxDelayMs, exponential + jitter);

      console.warn(
        `[Retry] ${operationName} failed with ${parsed.errorType} (${err.message?.slice(0, 80)}...). Retrying attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

module.exports = {
  executeWithRetry,
};
