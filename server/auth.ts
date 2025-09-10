import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { createCognitoAuth, CognitoAuth } from "./cognito-auth";
import { authRateLimiter } from "./middleware/rate-limiter";
import { normalizeEmail } from "./lib/normalizeEmail";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString("hex")}`;
}

async function comparePasswords(supplied: string, stored: string | null) {
  if (!stored) {
    return false;
  }
  // Handle both formats (: and .) for backward compatibility
  const separator = stored.includes(':') ? ':' : '.';
  const parts = stored.split(separator);
  if (parts.length !== 2) {
    return false;
  }
  
  const [salt, hashed] = separator === ':' ? parts : [parts[1], parts[0]];
  if (!hashed || !salt) {
    return false;
  }
  
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  
  // Ensure buffers are the same length before comparison
  if (hashedBuf.length !== suppliedBuf.length) {
    return false;
  }
  
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Critical: Ensure SESSION_SECRET is set in production
  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET environment variable is required in production');
  }
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "fallback-secret-for-development",
    resave: false, // Don't resave unchanged sessions to reduce database writes
    saveUninitialized: false, // Don't save empty sessions
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for better persistence
      sameSite: 'lax', // Use 'lax' for both dev and production for consistency
      path: '/', // Explicitly set path to ensure cookie is sent with all requests
      domain: undefined // Let the browser handle domain automatically
    },
    rolling: true, // Reset expiration on each request
    name: 'connect.sid', // Standard session name for better compatibility
    proxy: true, // Trust the proxy (required for secure cookies behind proxy)
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Session middleware is already configured to handle saving automatically
  // The express-session middleware saves sessions when they are modified

  // Initialize Cognito SSO - REQUIRED for authentication
  const cognitoDomain = process.env.COGNITO_DOMAIN;
  const cognitoClientId = process.env.COGNITO_CLIENT_ID;
  const cognitoClientSecret = process.env.COGNITO_CLIENT_SECRET;
  
  // Dynamic redirect URI detection
  let cognitoRedirectUri = process.env.COGNITO_REDIRECT_URI;
  
  // If no redirect URI is set, or if we're in development, use dynamic detection
  if (!cognitoRedirectUri || process.env.NODE_ENV === 'development') {
    // In Replit, we can use the REPL_SLUG and REPL_OWNER to construct the URL
    const replSlug = process.env.REPL_SLUG;
    const replOwner = process.env.REPL_OWNER;
    const replitDomains = process.env.REPLIT_DOMAINS;
    
    if (replSlug && replOwner && replitDomains) {
      // Use the first domain from REPLIT_DOMAINS
      const domain = replitDomains.split(',')[0];
      cognitoRedirectUri = `https://${domain}/auth/cognito/callback`;
      if (process.env.NODE_ENV === 'development') {
        console.log(`✓ Using dynamic redirect URI for development: ${cognitoRedirectUri}`);
      }
    } else {
      // Fallback to localhost for local development
      cognitoRedirectUri = `${process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`}/auth/cognito/callback`;
      if (process.env.NODE_ENV === 'development') {
        console.log(`✓ Using localhost redirect URI: ${cognitoRedirectUri}`);
      }
    }
  }

  let cognitoAuth: CognitoAuth | null = null;
  
  if (cognitoDomain && cognitoClientId && cognitoClientSecret && cognitoRedirectUri) {
    try {
      cognitoAuth = createCognitoAuth(cognitoDomain, cognitoClientId, cognitoClientSecret, cognitoRedirectUri);
      cognitoAuth.initialize();
      cognitoAuth.setupRoutes(app);
      if (process.env.NODE_ENV === 'development') {
        console.log('✓ Cognito SSO authentication enabled');
        console.log(`✓ Redirect URI: ${cognitoRedirectUri}`);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ CRITICAL: Failed to initialize Cognito SSO - Authentication will not work!', error);
      }
      throw new Error('Cognito SSO configuration is required but failed to initialize');
    }
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ WARNING: Cognito SSO environment variables are missing!');
      console.warn('Required for production: COGNITO_DOMAIN, COGNITO_CLIENT_ID, COGNITO_CLIENT_SECRET');
      console.warn('Optional: COGNITO_REDIRECT_URI (will be auto-detected if not provided)');
      console.warn('Running in development mode with local authentication only');
    }
  }

  // Local authentication strategy - now available for admin users only
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        const normalizedEmail = normalizeEmail(email);
        if (process.env.NODE_ENV === 'development') {
          console.log('Login attempt received');
        }
        const user = await storage.getUserByEmailCI(normalizedEmail);
        if (!user || !user.password) {
          return done(null, false);
        }
        
        const isValid = await comparePasswords(password, user.password);
        
        if (!isValid) {
          return done(null, false);
        }
        
        return done(null, user);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Authentication error:', err);
        }
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        // User no longer exists (e.g., deleted)
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deserializing user:', error);
      }
      done(error, null);
    }
  });

  // Local authentication endpoints - available in development only
  app.post("/api/register", authRateLimiter.middleware(), async (req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
      const normalizedEmail = normalizeEmail(req.body.email);
      const userWithEmail = await storage.getUserByEmailCI(normalizedEmail);
      if (userWithEmail) {
        return res.status(400).json({ message: "User already exists" });
      }

      const userInsert = insertUserSchema.parse({...req.body, email: normalizedEmail});
      if (!userInsert.password) {
        return res.status(400).json({ message: "Password is required for local registration" });
      }
      const hashedPassword = await hashPassword(userInsert.password);
      const user = await storage.createUser({
        ...userInsert,
        email: normalizedEmail,
        password: hashedPassword,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        // Ensure session is saved before sending response
        req.session.save((saveErr) => {
          if (saveErr) {
            if (process.env.NODE_ENV === 'development') {
              console.error('Failed to save session after registration:', saveErr);
            }
            return next(saveErr);
          }
          res.json(user);
        });
      });
    } else {
      res.status(403).json({ message: "Registration is disabled. Please use Single Sign-On." });
    }
  });

  app.post("/api/login", authRateLimiter.middleware(), async (req, res, next) => {
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Check if user is admin - only admins can use non-SSO login
      if (!user.isAdmin) {
        return res.status(403).json({ message: "Non-SSO login is restricted to admin users only. Please use Single Sign-On." });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        // Ensure session is saved before sending response
        req.session.save((saveErr) => {
          if (saveErr) {
            if (process.env.NODE_ENV === 'development') {
              console.error('Failed to save session after login:', saveErr);
            }
            return next(saveErr);
          }
          res.json(user);
        });
      });
    })(req, res, next);
  });

  // Demo login endpoint removed - no longer supported

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      // Ensure session is properly destroyed
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error('Failed to destroy session:', destroyErr);
          return next(destroyErr);
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.sendStatus(200);
      });
    });
  });

  app.get("/api/user", async (req, res) => {
    // Add session debugging
    if (!req.session) {
      console.error('No session object found on request');
      return res.status(500).json({ message: "Session not initialized" });
    }

    // Touch the session to keep it alive
    req.session.touch();

    if (!req.isAuthenticated() || !req.user) {
      // Authentication failed - minimal logging in development only
      if (process.env.NODE_ENV === 'development') {
        console.log(`Authentication check failed for ${req.method} ${req.path}`);
      }
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Ensure session is saved before responding
    req.session.save((err) => {
      if (err) {
        console.error('Failed to save session:', err);
        return res.status(500).json({ message: "Session save failed" });
      }
      res.json(req.user);
    });
  });

  // Authentication configuration endpoint
  app.get("/api/auth/config", (req, res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // In production: SSO is required, no local auth
    // In development: Both SSO and local auth are available
    const hasLocalAuth = !isProduction; // Only show local auth in development
    const hasCognitoSSO = true; // Always available
    const ssoRequired = isProduction; // Auto-redirect to SSO in production
    
    res.json({
      hasLocalAuth,
      hasCognitoSSO,
      ssoRequired,
      cognitoLoginUrl: '/auth/cognito',
      cognitoDomain: cognitoDomain || null,
      localAuthAdminOnly: true, // New flag to indicate local auth is admin-only
      environment: isProduction ? 'production' : 'development', // Add for debugging
    });
  });

  // Session health check endpoint
  app.get("/api/session-health", (req, res) => {
    res.json({
      isAuthenticated: req.isAuthenticated(),
      hasUser: !!req.user,
      sessionId: req.sessionID,
      timestamp: new Date().toISOString()
    });
  });

  // Debug endpoint to list all registered routes - restricted to development or admin users
  app.get("/api/debug/routes", (req, res) => {
    // Only allow in development mode or for authenticated admin users
    if (process.env.NODE_ENV !== 'development' && (!req.user || !req.user.isAdmin)) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const routes: any[] = [];
    app._router.stack.forEach((middleware: any) => {
      if (middleware.route) {
        // Routes registered directly on the app
        routes.push({
          path: middleware.route.path,
          methods: Object.keys(middleware.route.methods)
        });
      } else if (middleware.name === 'router') {
        // Routes registered via Router
        middleware.handle.stack.forEach((handler: any) => {
          if (handler.route) {
            routes.push({
              path: handler.route.path,
              methods: Object.keys(handler.route.methods)
            });
          }
        });
      }
    });
    res.json(routes);
  });
}
