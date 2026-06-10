const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableError(error) {
  const message = error?.message || '';
  const status = error?.response?.status;
  // Retry on network errors, timeouts, rate limits (429), and server errors (5xx)
  return /network error/i.test(message)
    || /timeout/i.test(message)
    || /rate limit/i.test(message)
    || status === 429
    || (status >= 500 && status < 600);
}

export async function runWithNetworkRetry(operation, maxAttempts = 5) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === maxAttempts) {
        throw error;
      }
      // Longer backoff for rate limits, standard exponential for others
      const isRateLimit = error?.response?.status === 429 || /rate limit/i.test(error?.message || '');
      const baseDelay = isRateLimit ? 5000 : 1000;
      await wait(Math.min(baseDelay * Math.pow(2, attempt - 1), 30000));
    }
  }

  throw lastError;
}