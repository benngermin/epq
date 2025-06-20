// Database retry utility to handle intermittent connection issues
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  delayMs: number = 500
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a connection timeout or network error
      const isRetryableError = 
        error instanceof Error && (
          error.message.includes('Connect Timeout Error') ||
          error.message.includes('fetch failed') ||
          error.message.includes('Error connecting to database') ||
          error.message.includes('UND_ERR_CONNECT_TIMEOUT') ||
          error.message.includes('ECONNRESET') ||
          error.message.includes('ENOTFOUND')
        );
      
      if (!isRetryableError || attempt === maxRetries) {
        throw error;
      }
      
      console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error.message);
      
      // Exponential backoff with jitter
      const baseDelay = delayMs * Math.pow(1.5, attempt - 1);
      const jitter = Math.random() * 0.3 * baseDelay;
      const delay = Math.min(baseDelay + jitter, 10000); // Cap at 10 seconds
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}