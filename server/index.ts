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

// Security headers
app.use((req, res, next) => {
  // Prevent XSS attacks
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // HTTPS enforcement in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy - Improved security by removing unsafe-eval
  // Note: unsafe-inline is still needed for React and Tailwind CSS
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +  // Removed unsafe-eval for better security
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://openrouter.ai; " +
    "font-src 'self' data: https://fonts.gstatic.com;"
  );
  
  // Additional Security Headers
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
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
    // Skip logging for chatbot streaming endpoints to reduce noise
    if (path.includes("/api/chatbot/stream-chunk/") || 
        path.includes("/api/chatbot/stream-init") ||
        path.includes("/api/chatbot/stream-abort/")) {
      return;
    }
    
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
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process in production, but log for monitoring
    if (process.env.NODE_ENV === 'development') {
      console.error('Exiting due to unhandled promise rejection in development');
      process.exit(1);
    }
  });
})().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
