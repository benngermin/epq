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
      if (process.env.NODE_ENV === 'development') {
        console.log('Cognito login route hit');
      }

      const state = Math.random().toString(36).substring(2, 15);
      req.session.state = state;

      // Capture URL parameters to preserve them through the OAuth flow
      // Support both course_id (with underscore) and courseId (camelCase)
      const courseIdParam = req.query.course_id || req.query.courseId;
      if (courseIdParam) {
        req.session.courseId = courseIdParam as string;
        console.log(`Stored courseId in session: ${courseIdParam} (from ${req.query.course_id ? 'course_id' : 'courseId'} param)`);
      }
      if (req.query.assignmentName) {
        req.session.assignmentName = req.query.assignmentName as string;
      }

      // Force session save before redirecting
      req.session.save((err) => {
        if (err) {
          console.error('Failed to save session:', err);
          // Redirect to auth page with error instead of returning JSON
          return res.redirect('/auth?error=session_save_failed');
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('Session saved successfully');
        }

        passport.authenticate('cognito', {
          state,
          scope: 'openid email profile',
        })(req, res, next);
      });
    });

    // Callback route
    app.get('/auth/cognito/callback', 
      (req: Request, res: Response, next: NextFunction) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('Cognito callback route hit!');
        }

        // In development, we might have session issues - be more lenient
        const isDevelopment = process.env.NODE_ENV === 'development';

        // Verify state parameter (skip in development if session is missing)
        if (!isDevelopment && req.query.state !== req.session.state) {
          if (process.env.NODE_ENV === 'development') {
            console.log('State mismatch detected');
          }

          // Instead of returning JSON error, redirect to auth page with error
          return res.redirect('/auth?error=state_mismatch');
        }

        // Clear the state from session
        delete req.session.state;

        if (process.env.NODE_ENV === 'development') {
          console.log('State verified or skipped, authenticating with Cognito...');
        }
        passport.authenticate('cognito', {
          failureRedirect: '/auth?error=cognito_failed',
        })(req, res, next);
      },
      async (req: Request, res: Response) => {
        // Successful authentication
        if (process.env.NODE_ENV === 'development') {
          console.log('Authentication successful');
        }

        // Check if we have stored courseId from the initial request
        const externalCourseId = req.session.courseId;
        const assignmentName = req.session.assignmentName;

        console.log('Retrieved parameters from session:', {
          externalCourseId,
          assignmentName
        });

        // Clear the stored parameters from session
        delete req.session.courseId;
        delete req.session.assignmentName;

        // Determine redirect URL based on external course ID
        let redirectUrl = '/';

        if (externalCourseId) {
          try {
            // Import storage to look up course
            const { storage } = await import('./storage.js');
            const course = await storage.getCourseByExternalId(externalCourseId);

            if (course) {
              // Get the first question set for this course
              const questionSets = await storage.getQuestionSetsByCourse(course.id);

              if (questionSets.length > 0) {
                // Redirect to the first question set of the course
                redirectUrl = `/question-set/${questionSets[0].id}`;
                console.log(`Redirecting to question set ${questionSets[0].id} for course ${course.courseTitle}`);
              } else {
                console.warn(`No question sets found for course ${course.courseTitle}`);
              }
            } else {
              console.warn(`No course found with external ID: ${externalCourseId}`);
            }
          } catch (error) {
            console.error('Error looking up course:', error);
          }
        }

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