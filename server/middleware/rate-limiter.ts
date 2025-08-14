import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

interface RequestData {
  count: number;
  resetTime: number;
}

// Simple in-memory rate limiter
// For production, consider using Redis or a dedicated rate limiting service
class RateLimiter {
  private requests: Map<string, RequestData> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private options: RateLimitOptions) {
    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const entries = Array.from(this.requests.entries());
      for (const [key, data] of entries) {
        if (data.resetTime < now) {
          this.requests.delete(key);
        }
      }
    }, 60000);
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip rate limiting in development unless explicitly enabled
      if (process.env.NODE_ENV === 'development' && !process.env.ENABLE_RATE_LIMITING) {
        return next();
      }

      // Use IP address as the key (consider using user ID for authenticated routes)
      const key = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      
      const requestData = this.requests.get(key);
      
      if (!requestData || requestData.resetTime < now) {
        // First request or window expired
        this.requests.set(key, {
          count: 1,
          resetTime: now + this.options.windowMs
        });
        return next();
      }
      
      if (requestData.count >= this.options.maxRequests) {
        // Rate limit exceeded
        const retryAfter = Math.ceil((requestData.resetTime - now) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());
        res.setHeader('X-RateLimit-Limit', this.options.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', new Date(requestData.resetTime).toISOString());
        
        return res.status(429).json({
          message: this.options.message || 'Too many requests, please try again later.',
          retryAfter
        });
      }
      
      // Increment request count
      requestData.count++;
      res.setHeader('X-RateLimit-Limit', this.options.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (this.options.maxRequests - requestData.count).toString());
      res.setHeader('X-RateLimit-Reset', new Date(requestData.resetTime).toISOString());
      
      next();
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requests.clear();
  }
}

// Create rate limiters for different endpoints
export const generalRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  message: 'Too many requests from this IP, please try again later.'
});

export const authRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 login attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later.'
});

export const aiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 AI requests per minute
  message: 'Too many AI requests, please wait a moment before trying again.'
});

// Cleanup on process termination
process.on('SIGINT', () => {
  generalRateLimiter.destroy();
  authRateLimiter.destroy();
  aiRateLimiter.destroy();
});

process.on('SIGTERM', () => {
  generalRateLimiter.destroy();
  authRateLimiter.destroy();
  aiRateLimiter.destroy();
});