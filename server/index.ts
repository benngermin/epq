import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { closeDatabase } from "./db";
import { createDatabaseIndexes } from "./utils/db-indexes";
import { logWithEST } from "./utils/logger";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const app = express();

// Security headers middleware - Enhanced security configuration
app.use((req, res, next) => {
  // Prevent MIME type sniffing attacks
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking attacks by denying iframe embedding
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable XSS filtering (legacy but still useful for older browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // HTTPS enforcement in production - ensures all future requests use HTTPS
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  /**
   * Content Security Policy (CSP) Configuration
   * 
   * SECURITY NOTE: 'unsafe-inline' for scripts and styles
   * 
   * Why we need 'unsafe-inline':
   * 1. React development mode injects inline scripts for hot reloading
   * 2. Tailwind CSS uses inline styles for dynamic utility classes  
   * 3. Some UI libraries (Radix UI) inject inline styles for positioning
   * 
   * Mitigation strategies in place:
   * - All user input is sanitized before rendering
   * - React's built-in XSS protection (dangerouslySetInnerHTML avoided)
   * - 'unsafe-eval' has been removed for better security
   * - All other directives are as restrictive as possible
   * 
   * Future improvements could include:
   * - Moving to a nonce-based approach for inline scripts
   * - Using CSS-in-JS solutions that support CSP
   * - Pre-compiling all Tailwind utilities
   */
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +  // Required for React dev mode and some libraries
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " + // Required for Tailwind and inline styles
    "img-src 'self' data: https:; " + // Allow images from self, data URIs, and any HTTPS source
    "connect-src 'self' https://openrouter.ai; " + // API connections
    "font-src 'self' data: https://fonts.gstatic.com; " + // Font sources
    "object-src 'none'; " + // Disable plugins like Flash
    "base-uri 'self'; " + // Restrict base tag usage
    "form-action 'self'; " + // Forms can only submit to same origin
    "frame-ancestors 'none'; " + // Prevent embedding in iframes
    "upgrade-insecure-requests;" // Automatically upgrade HTTP to HTTPS
  );
  
  // Control referrer information sent with requests
  // 'strict-origin-when-cross-origin' provides good balance of privacy and functionality
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy (formerly Feature Policy) 
  // Explicitly disable features we don't use
  res.setHeader('Permissions-Policy', 
    'camera=(), ' +           // No camera access
    'microphone=(), ' +        // No microphone access  
    'geolocation=(), ' +       // No location access
    'interest-cohort=(), ' +   // Opt out of FLoC
    'payment=(), ' +           // No payment APIs
    'usb=(), ' +               // No USB access
    'magnetometer=(), ' +      // No magnetometer
    'gyroscope=(), ' +         // No gyroscope
    'accelerometer=()'         // No accelerometer
  );
  
  // Prevent Adobe Flash and other cross-domain policies
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Disable DNS prefetching to prevent privacy leaks
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  
  // Prevent IE from executing downloads in site context
  res.setHeader('X-Download-Options', 'noopen');
  
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// CORS headers for authentication
app.use((req, res, next) => {
  // Allow credentials for authentication
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // In development, be more permissive with origins
  if (process.env.NODE_ENV === 'development') {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      // Use EST logging instead of the default UTC logging
      logWithEST(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize database indexes for performance
  await createDatabaseIndexes();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (process.env.NODE_ENV === "development") {
      console.error("Server error:", err);
    }
    
    // Don't throw the error after sending response - this causes memory leaks
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // Add 404 handler for API routes before Vite/static file serving
  app.use("/api/*", (req, res) => {
    res.status(404).json({ 
      message: "API endpoint not found",
      path: req.path 
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Graceful shutdown handlers
  const gracefulShutdown = async () => {
    log('Shutting down gracefully...');
    server.close(async () => {
      await closeDatabase();
      log('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    const timestamp = new Date().toISOString();
    const errorDetails = {
      timestamp,
      type: 'UnhandledRejection',
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: String(promise)
    };
    
    // Always log unhandled rejections for monitoring
    console.error('[CRITICAL] Unhandled Promise Rejection:', errorDetails);
    
    // In development, exit to catch issues early
    if (process.env.NODE_ENV === 'development') {
      console.error('Exiting due to unhandled promise rejection in development mode');
      process.exit(1);
    } else {
      // In production, log for monitoring but keep service running
      // Consider sending to error tracking service here
      console.error('[PRODUCTION] Service continuing after unhandled rejection - investigate immediately');
    }
  });
})().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
