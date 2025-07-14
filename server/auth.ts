import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { createCognitoAuth, CognitoAuth } from "./cognito-auth";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string | null) {
  if (!stored) {
    return false;
  }
  const [hashed, salt] = stored.split(".");
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
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "fallback-secret-for-development",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for better persistence
      sameSite: 'lax'
    },
    rolling: true, // Reset expiration on each request
    name: 'connect.sid', // Standard session name for better compatibility
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Initialize Cognito SSO - REQUIRED for authentication
  const cognitoDomain = process.env.COGNITO_DOMAIN;
  const cognitoClientId = process.env.COGNITO_CLIENT_ID;
  const cognitoClientSecret = process.env.COGNITO_CLIENT_SECRET;
  const cognitoRedirectUri = process.env.COGNITO_REDIRECT_URI;

  let cognitoAuth: CognitoAuth | null = null;
  
  if (cognitoDomain && cognitoClientId && cognitoClientSecret && cognitoRedirectUri) {
    try {
      cognitoAuth = createCognitoAuth(cognitoDomain, cognitoClientId, cognitoClientSecret, cognitoRedirectUri);
      cognitoAuth.initialize();
      cognitoAuth.setupRoutes(app);
      console.log('✓ Cognito SSO authentication enabled (MANDATORY)');
    } catch (error) {
      console.error('❌ CRITICAL: Failed to initialize Cognito SSO - Authentication will not work!', error);
      throw new Error('Cognito SSO configuration is required but failed to initialize');
    }
  } else {
    console.error('❌ CRITICAL: Cognito SSO environment variables are missing!');
    console.error('Required: COGNITO_DOMAIN, COGNITO_CLIENT_ID, COGNITO_CLIENT_SECRET, COGNITO_REDIRECT_URI');
    throw new Error('Cognito SSO configuration is required but missing');
  }

  // Local authentication is disabled - SSO only
  // Keeping the strategy for potential admin/emergency access only
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      // Local auth is disabled for SSO-only mode
      return done(null, false);
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  // Local authentication endpoints are disabled - SSO only
  app.post("/api/register", async (req, res, next) => {
    res.status(403).json({ message: "Registration is disabled. Please use Single Sign-On." });
  });

  app.post("/api/login", (req, res, next) => {
    res.status(403).json({ message: "Local login is disabled. Please use Single Sign-On." });
  });

  app.post("/api/demo-login", async (req, res, next) => {
    res.status(403).json({ message: "Demo login is disabled. Please use Single Sign-On." });
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      // Log authentication failure details for debugging
      console.log(`/api/user authentication check failed:`, {
        isAuthenticated: req.isAuthenticated(),
        hasUser: !!req.user,
        sessionId: req.sessionID,
        method: req.method,
        path: req.path,
        userAgent: req.headers['user-agent']?.slice(0, 50)
      });
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });

  // Authentication configuration endpoint
  app.get("/api/auth/config", (req, res) => {
    const hasLocalAuth = false; // Disabled for SSO-only mode
    const hasCognitoSSO = true; // Always required
    const ssoRequired = true; // New field to indicate SSO is mandatory
    
    res.json({
      hasLocalAuth,
      hasCognitoSSO,
      ssoRequired,
      cognitoLoginUrl: '/auth/cognito',
      cognitoDomain: cognitoDomain || null,
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

  // Debug endpoint to list all registered routes
  app.get("/api/debug/routes", (req, res) => {
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
