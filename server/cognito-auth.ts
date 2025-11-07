import { Express, Request, Response, NextFunction } from "express";
import { Strategy as OAuth2Strategy } from "passport-oauth2";
import passport from "passport";
import { storage } from "./storage";
import { normalizeEmail } from "./lib/normalizeEmail";

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

        // Normalize email for case-insensitive matching
        const email = normalizeEmail(userInfo.email);
        const sub = userInfo.sub;
        const name = userInfo.name || userInfo.given_name || email.split('@')[0] || 'User';

        if (process.env.NODE_ENV === 'development') {
          console.info('Cognito login successful');
        }

        // 1) Try to find user by cognito_sub first
        let user = await storage.getUserByCognitoSub(sub);

        // 2) If not found by sub, use upsert by email
        if (!user) {
          if (process.env.NODE_ENV === 'development') {
            console.info('User not found by Cognito sub, attempting upsert by email');
          }
          
          // Use the improved upsertUserByEmail that handles race conditions
          user = await storage.upsertUserByEmail({ 
            email, 
            name, 
            cognitoSub: sub 
          });
        }

        return done(null, user);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in Cognito OAuth strategy:', error);
        }
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
      // Log auth flow start only in development
      if (process.env.NODE_ENV === 'development') {
        console.log('\n=== AUTH FLOW START ===');
        console.log('Step 1: Cognito Auth Route Hit');
        console.log('  Timestamp:', new Date().toISOString());
      }

      // Generate base state
      const baseState = Math.random().toString(36).substring(2, 15);
      
      // Capture and encode parameters
      const courseId = req.query.courseId || req.query.course_id || req.query.course_ID;
      const assignmentName = req.query.assignmentName || req.query.assignment_name;
      
      // Log course ID processing only in development
      if (process.env.NODE_ENV === 'development' && courseId) {
        console.log('\nDEBUG: Course ID detected');
      }
      
      // Create state object with parameters
      const stateData = {
        state: baseState,
        courseId: courseId || null,
        assignmentName: assignmentName || null
      };
      
      // Encode state as base64 JSON
      const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64');
      req.session.state = encodedState;

      // Store parameters in session as primary method
      if (courseId) {
        req.session.courseId = courseId as string;
        if (process.env.NODE_ENV === 'development') {
          console.log('  ✓ Stored courseId in session');
        }
      }
      if (assignmentName) {
        req.session.assignmentName = assignmentName as string;
        if (process.env.NODE_ENV === 'development') {
          console.log('  ✓ Stored assignmentName in session');
        }
      }

      // Force session save before redirecting
      req.session.save((err) => {
        if (err) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to save session:', err);
          }
          return res.redirect('/auth?error=session_save_failed&message=' + encodeURIComponent('Unable to save session. Please try again.'));
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('\nStep 2: Session Saved, redirecting to Cognito...');
        }

        passport.authenticate('cognito', {
          state: encodedState, // Use encoded state with parameters
          scope: 'openid email profile',
        })(req, res, next);
      });
    });

    // Callback route
    app.get('/auth/cognito/callback', 
      (req: Request, res: Response, next: NextFunction) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('\n=== AUTH FLOW CALLBACK ===');
          console.log('Step 3: Callback Route Hit');
        }

        // In development, we might have session issues - be more lenient
        const isDevelopment = process.env.NODE_ENV === 'development';

        // Decode state to extract parameters as fallback
        let stateParams: any = null;
        try {
          if (req.query.state) {
            const decodedState = JSON.parse(Buffer.from(req.query.state as string, 'base64').toString());
            stateParams = decodedState;
            
            // Verify the state matches
            if (!isDevelopment && decodedState.state !== JSON.parse(Buffer.from(req.session.state || '', 'base64').toString()).state) {
              if (process.env.NODE_ENV === 'development') {
                console.log('State mismatch detected');
              }
              return res.redirect('/auth?error=state_mismatch&message=' + encodeURIComponent('Security verification failed. Please try logging in again.'));
            }
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Failed to decode state parameters');
          }
          // Fall back to original state verification
          if (!isDevelopment && req.query.state !== req.session.state) {
            return res.redirect('/auth?error=state_mismatch&message=' + encodeURIComponent('Security verification failed. Please try logging in again.'));
          }
        }
        
        // Store decoded state params in request for later use
        (req as any).stateParams = stateParams;

        // Clear the state from session
        delete req.session.state;

        if (process.env.NODE_ENV === 'development') {
          console.log('State verified or skipped, authenticating with Cognito...');
        }
        passport.authenticate('cognito', {
          failureRedirect: '/auth?error=cognito_failed&message=' + encodeURIComponent('Authentication failed. Please check your credentials and try again.'),
        })(req, res, next);
      },
      async (req: Request, res: Response) => {
        // Successful authentication
        if (process.env.NODE_ENV === 'development') {
          console.log('Authentication successful');
        }

        // Try to get parameters from session first, then from decoded state
        let externalCourseId = req.session.courseId;
        let assignmentName = req.session.assignmentName;
        
        // Fallback to state parameters if session is empty
        const stateParams = (req as any).stateParams;
        
        if (process.env.NODE_ENV === 'development') {
          console.log('\nDEBUG: Parameter Retrieval');
          console.log('  Source:', req.session.courseId ? 'session' : stateParams?.courseId ? 'state' : 'none');
        }
        
        if (!externalCourseId && stateParams?.courseId) {
          externalCourseId = stateParams.courseId;
          if (process.env.NODE_ENV === 'development') {
            console.log('  ✓ Retrieved courseId from STATE');
          }
        }
        if (!assignmentName && stateParams?.assignmentName) {
          assignmentName = stateParams.assignmentName;
          if (process.env.NODE_ENV === 'development') {
            console.log('  ✓ Retrieved assignmentName from STATE');
          }
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('\nStep 4: Parameters Retrieved');
          console.log('  Course ID found:', !!externalCourseId);
          console.log('  Assignment found:', !!assignmentName);
        }

        // Clear the stored parameters from session
        delete req.session.courseId;
        delete req.session.assignmentName;

        // Determine redirect URL based on external course ID
        let redirectUrl = '/';

        if (externalCourseId) {
          try {
            // Import storage to look up course
            const { storage } = await import('./storage.js');
            
            if (process.env.NODE_ENV === 'development') {
              console.log('\nDEBUG: Database Lookup for course');
            }
            
            const course = await storage.getCourseByExternalId(String(externalCourseId));
            
            if (process.env.NODE_ENV === 'development') {
              console.log('  Course lookup:', course ? 'Found' : 'Not found');
            }

            if (course) {
              // Store courseNumber in session for use in chatbot endpoints
              req.session.courseNumber = course.courseNumber;
              
              // Get the first question set for this course
              const questionSets = await storage.getQuestionSetsByCourse(course.id);
              if (process.env.NODE_ENV === 'development') {
                console.log(`  Question sets found: ${questionSets.length}`);
              }

              if (questionSets.length > 0) {
                // Redirect to the first question set of the course
                redirectUrl = `/question-set/${questionSets[0].id}`;
                if (process.env.NODE_ENV === 'development') {
                  console.log('\nStep 5: SUCCESS - Auth flow complete');
                }
              } else {
                if (process.env.NODE_ENV === 'development') {
                  console.log('  ⚠️ No question sets found for course');
                }
              }
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.log('  ⚠️ No course found with provided external ID');
              }
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.log('  ⚠️ Error looking up course');
            }
          }
        }

        // Save session before redirecting
        req.session.save((err) => {
          if (err) {
            console.error('Failed to save session after login:', err);
            // Redirect to error page instead of continuing
            return res.redirect('/auth?error=session_error&message=' + encodeURIComponent('Unable to complete sign-in. Please try again.'));
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