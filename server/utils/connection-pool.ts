// Connection pool and circuit breaker for database operations
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

class DatabaseCircuitBreaker {
  private state: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED'
  };

  private readonly failureThreshold = 3;
  private readonly timeoutMs = 30000; // 30 second timeout
  private readonly resetTimeoutMs = 60000; // 1 minute reset timeout

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state.state === 'OPEN') {
      if (Date.now() - this.state.lastFailureTime > this.resetTimeoutMs) {
        this.state.state = 'HALF_OPEN';
        this.state.failures = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - database operations temporarily disabled');
      }
    }

    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), this.timeoutMs)
        )
      ]);

      // Success - reset circuit breaker
      if (this.state.state === 'HALF_OPEN') {
        this.state.state = 'CLOSED';
        this.state.failures = 0;
      }

      return result;
    } catch (error) {
      this.handleFailure();
      throw error;
    }
  }

  private handleFailure() {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();

    if (this.state.failures >= this.failureThreshold) {
      this.state.state = 'OPEN';
      console.warn('Circuit breaker opened due to repeated failures');
    }
  }

  getState() {
    return { ...this.state };
  }
}

export const dbCircuitBreaker = new DatabaseCircuitBreaker();

// Enhanced retry with circuit breaker
export async function withCircuitBreaker<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  return dbCircuitBreaker.execute(async () => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
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
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  });
}