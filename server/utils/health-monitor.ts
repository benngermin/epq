// Database health monitoring and status tracking
export class DatabaseHealthMonitor {
  private static instance: DatabaseHealthMonitor;
  private healthStatus = {
    isHealthy: true,
    lastSuccessfulConnection: Date.now(),
    consecutiveFailures: 0,
    totalFailures: 0,
    lastError: null as Error | null,
  };

  private constructor() {}

  public static getInstance(): DatabaseHealthMonitor {
    if (!DatabaseHealthMonitor.instance) {
      DatabaseHealthMonitor.instance = new DatabaseHealthMonitor();
    }
    return DatabaseHealthMonitor.instance;
  }

  recordSuccess() {
    this.healthStatus.isHealthy = true;
    this.healthStatus.lastSuccessfulConnection = Date.now();
    this.healthStatus.consecutiveFailures = 0;
    this.healthStatus.lastError = null;
  }

  recordFailure(error: Error) {
    this.healthStatus.consecutiveFailures++;
    this.healthStatus.totalFailures++;
    this.healthStatus.lastError = error;
    
    // Mark as unhealthy after 3 consecutive failures
    if (this.healthStatus.consecutiveFailures >= 3) {
      this.healthStatus.isHealthy = false;
    }
  }

  getHealthStatus() {
    return {
      ...this.healthStatus,
      timeSinceLastSuccess: Date.now() - this.healthStatus.lastSuccessfulConnection,
    };
  }

  isHealthy(): boolean {
    return this.healthStatus.isHealthy;
  }
}

export const dbHealthMonitor = DatabaseHealthMonitor.getInstance();

// Enhanced database operation wrapper with health monitoring
export async function withHealthMonitoring<T>(
  operation: () => Promise<T>,
  operationName: string = 'database operation'
): Promise<T> {
  try {
    const result = await operation();
    dbHealthMonitor.recordSuccess();
    return result;
  } catch (error) {
    const err = error as Error;
    dbHealthMonitor.recordFailure(err);
    
    console.error(`Database health check failed for ${operationName}:`, {
      error: err.message,
      healthStatus: dbHealthMonitor.getHealthStatus(),
    });
    
    throw error;
  }
}