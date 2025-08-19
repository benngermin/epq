import { Express, Request, Response, NextFunction } from "express";
import { Strategy as OAuth2Strategy } from "passport-oauth2";
import passport from "passport";
import { storage } from "./storage";

interface CognitoTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  token_use: string;
}

declare module 'express-session' {
  interface SessionData {
    state?: string;
  }
}

export class CognitoAuth {
  private strategy: OAuth2Strategy;

  constructor(
    private cognitoDomain: string,
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string
  ) {
    // Clean the domain - remove protocol if included
    const cleanDomain = this.cognitoDomain.replace(/^https?:\/\//, '');
    this.cognitoDomain = cleanDomain;

    // Initialize the OAuth2 strategy for Cognito
    this.strategy = new OAuth2Strategy({
      authorizationURL: `https://${cleanDomain}/oauth2/authorize`,
      tokenURL: `https://${cleanDomain}/oauth2/token`,
      clientID: this.clientId,
      clientSecret: this.clientSecret,
      callbackURL: this.redirectUri,
      scope: 'openid email profile',
    }, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        // Make a request to get user info from Cognito
        const userInfoResponse = await fetch(`https://${this.cognitoDomain}/oauth2/userInfo`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!userInfoResponse.ok) {
          throw new Error('Failed to fetch user info from Cognito');
        }

        const userInfo = await userInfoResponse.json();

        // Check if user exists by Cognito sub
        let user = await storage.getUserByCognitoSub(userInfo.sub);

        if (!user) {
          // Create new user if doesn't exist
          const name = userInfo.name || userInfo.given_name || userInfo.email?.split('@')[0] || 'User';
          user = await storage.createUser({
            name,
            email: userInfo.email,
            cognitoSub: userInfo.sub,
            // No password needed for SSO users
          });
        }

        return done(null, user);
      } catch (error) {
        console.error('Error in Cognito OAuth strategy:', error);
        return done(error, null);
      }
    });
  }

  initialize() {
    // Register the strategy with Passport
    passport.use('cognito', this.strategy);
    if (process.env.NODE_ENV === 'development') {
      console.log('Cognito authentication initialized successfully');
    }
  }

  setupRoutes(app: Express) {
    if (process.env.NODE_ENV === 'development') {
      console.log('Setting up Cognito routes...');
    }

    // Route to initiate login
    app.get('/auth/cognito', (req: Request, res: Response, next: NextFunction) => {
      console.log('[Cognito Auth] Login route hit with query params:', req.query);
      console.log('[Cognito Auth] Full URL:', req.url);

      const state = Math.random().toString(36).substring(2, 15);
      req.session.state = state;

      // Capture URL parameters to preserve them through the OAuth flow
      // Support all case variations of course_id
      let courseIdParam: string | undefined;
      let foundParamName: string | undefined;
      
      // Check all common variations of course_id
      const variations = ['course_id', 'Course_ID', 'Course_id', 'courseId', 'CourseId', 'courseid', 'COURSE_ID'];
      for (const variation of variations) {
        if (req.query[variation]) {
          courseIdParam = req.query[variation] as string;
          foundParamName = variation;
          break;
        }
      }
      
      // If not found in common variations, check all query params case-insensitively
      if (!courseIdParam) {
        for (const [key, value] of Object.entries(req.query)) {
          if (key.toLowerCase() === 'course_id' || key.toLowerCase() === 'courseid') {
            courseIdParam = value as string;
            foundParamName = key;
            break;
          }
        }
      }
      
      if (courseIdParam) {
        req.session.courseId = courseIdParam;
        console.log(`[Cognito Auth] STORED courseId in session: ${courseIdParam} (from '${foundParamName}' param)`);
      } else {
        console.log('[Cognito Auth] WARNING: No course_id parameter found in request');
      }
      
      if (req.query.assignmentName) {
        req.session.assignmentName = req.query.assignmentName as string;
      }

      // Force session save before redirecting
      req.session.save((err) => {
        if (err) {
          console.error('[Cognito Auth] Failed to save session:', err);
          // Redirect to auth page with error instead of returning JSON
          return res.redirect('/auth?error=session_save_failed');
        }

        console.log('[Cognito Auth] Session saved successfully. Session ID:', req.sessionID);
        console.log('[Cognito Auth] Session contents:', {
          state: req.session.state,
          courseId: req.session.courseId,
          assignmentName: req.session.assignmentName
        });

        // Also encode the courseId in the state parameter as a backup
        let enhancedState = state;
        if (courseIdParam) {
          enhancedState = `${state}:${courseIdParam}`;
        }

        passport.authenticate('cognito', {
          state: enhancedState,
          scope: 'openid email profile',
        })(req, res, next);
      });
    });

    // Callback route
    app.get('/auth/cognito/callback', 
      (req: Request, res: Response, next: NextFunction) => {
        console.log('[Cognito Callback] Route hit! Session ID:', req.sessionID);
        console.log('[Cognito Callback] Session contents before auth:', {
          hasSession: !!req.session,
          state: req.session?.state,
          courseId: req.session?.courseId,
          assignmentName: req.session?.assignmentName
        });

        // Extract courseId from state parameter if session lost it
        const stateParam = req.query.state as string;
        let extractedCourseId: string | undefined;
        let cleanState: string = stateParam;
        
        if (stateParam && stateParam.includes(':')) {
          const [statePart, courseIdPart] = stateParam.split(':');
          cleanState = statePart;
          extractedCourseId = courseIdPart;
          console.log('[Cognito Callback] Extracted courseId from state:', extractedCourseId);
        }

        // In development, we might have session issues - be more lenient
        const isDevelopment = process.env.NODE_ENV === 'development';

        // Verify state parameter (skip in development if session is missing)
        if (!isDevelopment && cleanState !== req.session.state && !cleanState.startsWith(req.session.state || '')) {
          console.log('[Cognito Callback] State mismatch detected');
          // Instead of returning JSON error, redirect to auth page with error
          return res.redirect('/auth?error=state_mismatch');
        }

        // If we lost the courseId in session but have it in state, restore it
        if (!req.session.courseId && extractedCourseId) {
          req.session.courseId = extractedCourseId;
          console.log('[Cognito Callback] Restored courseId to session from state:', extractedCourseId);
        }

        // Clear the state from session
        delete req.session.state;

        console.log('[Cognito Callback] State verified, authenticating with Cognito...');
        passport.authenticate('cognito', {
          failureRedirect: '/auth?error=cognito_failed',
        })(req, res, next);
      },
      async (req: Request, res: Response) => {
        // Successful authentication
        console.log('[Cognito Callback] Authentication successful');
        console.log('[Cognito Callback] Session data:', {
          sessionId: req.sessionID,
          hasSession: !!req.session,
          sessionKeys: req.session ? Object.keys(req.session) : []
        });

        // Check if we have stored courseId from the initial request
        const externalCourseId = req.session.courseId;
        const assignmentName = req.session.assignmentName;

        console.log('[Cognito Callback] Retrieved parameters from session:', {
          externalCourseId,
          assignmentName
        });

        // Clear the stored parameters from session
        delete req.session.courseId;
        delete req.session.assignmentName;

        // Build redirect URL with parameters
        let redirectUrl = '/';
        const queryParams = new URLSearchParams();

        // Always pass course_id to the dashboard if we have it
        if (externalCourseId) {
          queryParams.append('course_id', externalCourseId);
          console.log(`[Cognito Callback] PASSING course_id=${externalCourseId} to dashboard`);
        } else {
          console.log('[Cognito Callback] WARNING: No course_id to pass to dashboard');
        }

        if (assignmentName) {
          queryParams.append('assignment_name', assignmentName);
        }

        // Add query parameters to redirect URL
        if (queryParams.toString()) {
          redirectUrl += '?' + queryParams.toString();
        }

        console.log(`[Cognito Callback] FINAL redirect URL: ${redirectUrl}`);

        // Save session before redirecting
        req.session.save((err) => {
          if (err) {
            console.error('Failed to save session after login:', err);
          }

          res.redirect(redirectUrl);
        });
      }
    );

    // Logout route
    app.post('/auth/logout', (req: Request, res: Response) => {
      req.logout((err) => {
        if (err) {
          console.error('Logout error:', err);
          return res.status(500).json({ error: 'Logout failed' });
        }

        // Redirect to Cognito logout URL
        const logoutUrl = `https://${this.cognitoDomain}/logout?client_id=${this.clientId}&logout_uri=${encodeURIComponent(this.redirectUri)}`;
        res.json({ logoutUrl });
      });
    });

    // Health check endpoint
    app.get('/auth/cognito/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        cognitoDomain: this.cognitoDomain,
        clientId: this.clientId,
        redirectUri: this.redirectUri,
      });
    });
  }

  getAuthUrl(): string {
    return '/auth/cognito';
  }

  getLogoutUrl(): string {
    return `https://${this.cognitoDomain}/logout?client_id=${this.clientId}&logout_uri=${encodeURIComponent(this.redirectUri)}`;
  }
}

export function createCognitoAuth(
  cognitoDomain: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): CognitoAuth {
  return new CognitoAuth(cognitoDomain, clientId, clientSecret, redirectUri);
}