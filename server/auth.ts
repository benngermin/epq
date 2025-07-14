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
      console.log(`✓ Using dynamic redirect URI for development: ${cognitoRedirectUri}`);
    } else {
      // Fallback to localhost for local development
      cognitoRedirectUri = `http://localhost:${process.env.PORT || 5000}/auth/cognito/callback`;
      console.log(`✓ Using localhost redirect URI: ${cognitoRedirectUri}`);
    }
  }

  let cognitoAuth: CognitoAuth | null = null;
  
  if (cognitoDomain && cognitoClientId && cognitoClientSecret && cognitoRedirectUri) {
    try {
      cognitoAuth = createCognitoAuth(cognitoDomain, cognitoClientId, cognitoClientSecret, cognitoRedirectUri);
      cognitoAuth.initialize();
      cognitoAuth.setupRoutes(app);
      console.log('✓ Cognito SSO authentication enabled (MANDATORY)');
      console.log(`✓ Redirect URI: ${cognitoRedirectUri}`);
    } catch (error) {
      console.error('❌ CRITICAL: Failed to initialize Cognito SSO - Authentication will not work!', error);
      throw new Error('Cognito SSO configuration is required but failed to initialize');
    }
  } else {
    console.error('❌ CRITICAL: Cognito SSO environment variables are missing!');
    console.error('Required: COGNITO_DOMAIN, COGNITO_CLIENT_ID, COGNITO_CLIENT_SECRET');
    console.error('Optional: COGNITO_REDIRECT_URI (will be auto-detected if not provided)');
    throw new Error('Cognito SSO configuration is required but missing');
  }

  // Local authentication strategy
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      // In development, allow local auth as a bypass
      if (process.env.NODE_ENV === 'development') {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false);
          }
          
          const isValid = await comparePasswords(password, user.password);
          if (!isValid) {
            return done(null, false);
          }
          
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
      
      // In production, SSO only
      return done(null, false);
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  // Local authentication endpoints - available in development only
  app.post("/api/register", async (req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
      const userWithEmail = await storage.getUserByEmail(req.body.email);
      if (userWithEmail) {
        return res.status(400).json({ message: "User already exists" });
      }

      const userInsert = insertUserSchema.parse(req.body);
      const hashedPassword = await hashPassword(userInsert.password);
      const user = await storage.createUser({
        ...userInsert,
        password: hashedPassword,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.json(user);
      });
    } else {
      res.status(403).json({ message: "Registration is disabled. Please use Single Sign-On." });
    }
  });

  app.post("/api/login", (req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
      passport.authenticate("local", (err: any, user: any, info: any) => {
        if (err) return next(err);
        if (!user) {
          return res.status(401).json({ message: "Invalid email or password" });
        }
        req.login(user, (err) => {
          if (err) return next(err);
          res.json(user);
        });
      })(req, res, next);
    } else {
      res.status(403).json({ message: "Local login is disabled. Please use Single Sign-On." });
    }
  });

  app.post("/api/demo-login", async (req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
      // Create or get demo user
      let demoUser = await storage.getUserByEmail("demo@example.com");
      if (!demoUser) {
        const hashedPassword = await hashPassword("demo123");
        demoUser = await storage.createUser({
          name: "Demo User",
          email: "demo@example.com",
          password: hashedPassword,
        });
      }
      req.login(demoUser, (err) => {
        if (err) return next(err);
        res.json(demoUser);
      });
    } else {
      res.status(403).json({ message: "Demo login is disabled. Please use Single Sign-On." });
    }
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
    const isDevelopment = process.env.NODE_ENV === 'development';
    const hasLocalAuth = isDevelopment; // Enabled in development only
    const hasCognitoSSO = true; // Always available
    const ssoRequired = !isDevelopment; // SSO required in production only
    
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
