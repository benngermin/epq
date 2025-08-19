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

      // Create a simple state string that includes parameters
      // Format: token|courseId|assignmentName
      const token = Math.random().toString(36).substring(2, 15);
      const courseId = (req.query.course_id || req.query.courseId) as string || '';
      const assignmentName = req.query.assignmentName as string || '';
      
      // Create simple delimited state string
      const state = `${token}|${courseId}|${assignmentName}`;
      
      console.log('Creating state with params:', {
        token,
        courseId: courseId || 'none',
        assignmentName: assignmentName || 'none',
        stateString: state
      });
      
      // Store the token in session for validation
      req.session.stateToken = token;
      
      // Also store in session as backup (keep existing logic)
      const courseIdParam = req.query.course_id || req.query.courseId;
      if (courseIdParam) {
        req.session.courseId = courseIdParam as string;
        console.log(`Stored courseId in state and session: ${courseIdParam} (from ${req.query.course_id ? 'course_id' : 'courseId'} param)`);
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

        console.log('Session saved successfully with state:', {
          stateToken: req.session.stateToken,
          courseId: req.session.courseId,
          assignmentName: req.session.assignmentName
        });

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
        console.log('Callback session ID:', req.sessionID);
        console.log('Callback session data:', {
          stateToken: req.session.stateToken,
          courseId: req.session.courseId,
          assignmentName: req.session.assignmentName
        });

        // Decode state parameter to extract course information
        let stateData: any = {};
        try {
          if (req.query.state) {
            console.log('Raw state parameter:', req.query.state);
            // Parse simple delimited format: token|courseId|assignmentName
            const stateParts = (req.query.state as string).split('|');
            stateData = {
              token: stateParts[0] || '',
              courseId: stateParts[1] || undefined,
              assignmentName: stateParts[2] || undefined
            };
            console.log('Decoded state data:', stateData);
          } else {
            console.log('No state parameter in callback');
          }
        } catch (error) {
          console.error('Failed to decode state parameter:', error);
        }

        // In development, we might have session issues - be more lenient
        const isDevelopment = process.env.NODE_ENV === 'development';

        // Verify state token (skip in development if session is missing)
        if (!isDevelopment && stateData.token !== req.session.stateToken) {
          console.log('State token mismatch detected:', {
            stateToken: stateData.token,
            sessionToken: req.session.stateToken
          });

          // Instead of returning JSON error, redirect to auth page with error
          return res.redirect('/auth?error=state_mismatch');
        }

        // Store the parameters from state in request for later use
        req.stateParams = {
          courseId: stateData.courseId,
          assignmentName: stateData.assignmentName
        };

        // Clear the state token from session
        delete req.session.stateToken;

        console.log('State verified or skipped, authenticating with Cognito...');
        passport.authenticate('cognito', {
          failureRedirect: '/auth?error=cognito_failed',
        })(req, res, next);
      },
      async (req: Request, res: Response) => {
        // Successful authentication
        console.log('Authentication successful');

        // Check for courseId from state parameter first, then fall back to session
        const externalCourseId = (req as any).stateParams?.courseId || req.session.courseId;
        const assignmentName = (req as any).stateParams?.assignmentName || req.session.assignmentName;

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