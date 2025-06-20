// Database retry utility to handle intermittent connection issues
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
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
          error.message.includes('Error connecting to database')
        );
      
      if (!isRetryableError || attempt === maxRetries) {
        throw error;
      }
      
      console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error.message);
      
      // Exponential backoff
      const delay = delayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}