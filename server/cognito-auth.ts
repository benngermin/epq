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
    stateToken?: string;
    courseId?: string;
    assignmentName?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      stateParams?: {
        courseId?: string;
        assignmentName?: string;
      };
    }
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
    console.log('Cognito authentication initialized successfully');
  }

  setupRoutes(app: Express) {
    console.log('Setting up Cognito routes...');

    // Route to initiate login
    app.get('/auth/cognito', (req: Request, res: Response, next: NextFunction) => {
      console.log('Cognito login route hit');

      // Create a state object that includes CSRF token and parameters
      const stateData = {
        csrf: Math.random().toString(36).substring(2, 15),
        courseId: req.query.course_id || req.query.courseId || undefined,
        assignmentName: req.query.assignmentName || undefined
      };

      // Encode the state data as base64 JSON
      const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

      // Store just the CSRF token in session for validation
      req.session.state = stateData.csrf;

      // Save session and redirect
      req.session.save((err) => {
        if (err) {
          console.error('Failed to save session:', err);
          return res.redirect('/auth?error=session_save_failed');
        }

        console.log('State parameter being sent:', state);

        passport.authenticate('cognito', {
          state,
          scope: 'openid email profile',
        })(req, res, next);
      });
    });

    // Callback route
    app.get('/auth/cognito/callback', 
      (req: Request, res: Response, next: NextFunction) => {
        console.log('Cognito callback route hit!');
        console.log('Callback query params:', JSON.stringify(req.query));

        const stateFromQuery = req.query.state as string;

        try {
          // Decode the state parameter
          const stateData = JSON.parse(Buffer.from(stateFromQuery, 'base64url').toString());
          console.log('Decoded state data:', stateData);

          // Verify CSRF token
          if (stateData.csrf !== req.session.state) {
            console.log('State mismatch detected');
            return res.redirect('/auth?error=state_mismatch');
          }

          // Store the parameters in session for the next handler
          if (stateData.courseId) {
            req.session.courseId = stateData.courseId;
          }
          if (stateData.assignmentName) {
            req.session.assignmentName = stateData.assignmentName;
          }

          // Clear the CSRF token
          delete req.session.state;

          console.log('State verified, authenticating with Cognito...');
          passport.authenticate('cognito', {
            failureRedirect: '/auth?error=cognito_failed',
          })(req, res, next);
        } catch (error) {
          console.error('Failed to decode state:', error);
          return res.redirect('/auth?error=invalid_state');
        }
      },
      async (req: Request, res: Response) => {
        // Successful authentication
        console.log('Authentication successful');

        // Get parameters from session (where they were stored during initial auth request)
        const externalCourseId = req.session.courseId;
        const assignmentName = req.session.assignmentName;

        console.log('Retrieved parameters from state/session:', {
          externalCourseId,
          assignmentName,
          fromState: !!(req as any).stateParams?.courseId,
          fromSession: !!req.session.courseId
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

          // Preserve URL parameters in the redirect
          if (externalCourseId || assignmentName) {
            const urlParams = new URLSearchParams();

            // CRITICAL: Use 'course_id' with underscore for dashboard compatibility
            if (externalCourseId) {
              urlParams.append('course_id', externalCourseId);
            }

            if (assignmentName) {
              urlParams.append('assignmentName', assignmentName);
            }

            const queryString = urlParams.toString();
            if (queryString) {
              redirectUrl += (redirectUrl.includes('?') ? '&' : '?') + queryString;
            }

            console.log(`Redirecting to: ${redirectUrl}`);
          } else {
            console.log(`No parameters to append, redirecting to: ${redirectUrl}`);
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