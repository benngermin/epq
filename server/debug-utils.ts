/**
 * Debug Utilities
 * Provides consistent logging and debugging functionality
 * Respects environment settings and Replit constraints
 */

const isDevelopment = process.env.NODE_ENV !== 'production';
const isReplit = Boolean(process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN);

/**
 * Log debug information (development only)
 */
export function debugLog(message: string, data?: any): void {
  if (isDevelopment || isReplit) {
    const timestamp = new Date().toISOString();
    console.log(`[DEBUG ${timestamp}] ${message}`);
    if (data) {
      // Sanitize sensitive data before logging
      const sanitized = sanitizeForLogging(data);
      console.log(JSON.stringify(sanitized, null, 2));
    }
  }
}

/**
 * Log error information
 */
export function debugError(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  console.error(`[ERROR ${timestamp}] ${message}`);
  if (data) {
    // Sanitize sensitive data before logging
    const sanitized = sanitizeForLogging(data);
    console.error(JSON.stringify(sanitized, null, 2));
  }
}

/**
 * Log warning information
 */
export function debugWarn(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  console.warn(`[WARN ${timestamp}] ${message}`);
  if (data) {
    // Sanitize sensitive data before logging
    const sanitized = sanitizeForLogging(data);
    console.warn(JSON.stringify(sanitized, null, 2));
  }
}

/**
 * Sanitize data for logging
 * Removes or masks sensitive information
 */
function sanitizeForLogging(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (typeof data === 'string') {
    // Truncate very long strings
    return data.length > 1000 ? data.substring(0, 1000) + '...' : data;
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeForLogging);
  }
  
  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
      // Skip or mask sensitive fields
      if (key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('api_key')) {
        sanitized[key] = '[REDACTED]';
      } else if (key.toLowerCase().includes('email')) {
        // Partially mask emails
        const email = String(data[key]);
        const atIndex = email.indexOf('@');
        if (atIndex > 2) {
          sanitized[key] = email.substring(0, 2) + '***' + email.substring(atIndex);
        } else {
          sanitized[key] = '[EMAIL]';
        }
      } else {
        sanitized[key] = sanitizeForLogging(data[key]);
      }
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Performance timer for measuring operation duration
 */
export class PerformanceTimer {
  private startTime: number;
  private label: string;
  
  constructor(label: string) {
    this.label = label;
    this.startTime = Date.now();
    if (isDevelopment) {
      debugLog(`Timer started: ${label}`);
    }
  }
  
  end(): number {
    const duration = Date.now() - this.startTime;
    if (isDevelopment) {
      debugLog(`Timer ended: ${this.label}`, { duration: `${duration}ms` });
    }
    return duration;
  }
}

/**
 * Log validation results for debugging
 */
export function logValidationResult(
  questionType: string,
  userAnswer: any,
  correctAnswer: any,
  isCorrect: boolean,
  details?: any
): void {
  if (isDevelopment) {
    debugLog('Answer validation result', {
      questionType,
      isCorrect,
      userAnswerType: typeof userAnswer,
      correctAnswerType: typeof correctAnswer,
      ...details
    });
  }
}