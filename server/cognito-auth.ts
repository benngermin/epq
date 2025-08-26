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

        console.info('Cognito login', { sub, email });

        // 1) Try to find user by cognito_sub first
        let user = await storage.getUserByCognitoSub(sub);

        // 2) Fallback: try by email (case-insensitive)
        if (!user) {
          const existingUser = await storage.getUserByEmailCI(email);
          if (existingUser) {
            // Link existing user with Cognito sub
            console.info('Linking existing user to Cognito', { userId: existingUser.id, email });
            user = await storage.updateUser(existingUser.id, { 
              cognitoSub: sub,
              email // Update with normalized email
            });
          } else {
            // 3) Truly new user - use upsert to handle race conditions
            console.info('Creating new user via Cognito', { email });
            user = await storage.upsertUserByEmail({ 
              email, 
              name, 
              cognitoSub: sub 
            });
          }
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
      // Comprehensive parameter tracking
      console.log('\n=== AUTH FLOW START ===');
      console.log('Step 1: Cognito Auth Route Hit');
      console.log('  Full URL:', req.url);
      console.log('  Query params:', req.query);
      console.log('  courseId (camelCase):', req.query.courseId);
      console.log('  course_id (underscore):', req.query.course_id);
      console.log('  Session ID:', req.sessionID);
      console.log('  Timestamp:', new Date().toISOString());

      // Generate base state
      const baseState = Math.random().toString(36).substring(2, 15);
      
      // Capture and encode parameters
      const courseId = req.query.courseId || req.query.course_id || req.query.course_ID;
      const assignmentName = req.query.assignmentName || req.query.assignment_name;
      
      // Enhanced logging for debugging course ID issues
      console.log('\nDEBUG: Course ID Processing');
      console.log('  Raw courseId value:', courseId);
      console.log('  Type of courseId:', typeof courseId);
      console.log('  Length of courseId:', courseId ? String(courseId).length : 0);
      console.log('  First 4 chars:', courseId ? String(courseId).substring(0, 4) : 'N/A');
      
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
        console.log('  ✓ Stored courseId in session and state:', courseId);
        console.log('  Session storage confirmation:', req.session.courseId === courseId);
      }
      if (assignmentName) {
        req.session.assignmentName = assignmentName as string;
        console.log('  ✓ Stored assignmentName in session and state:', assignmentName);
      }

      // Force session save before redirecting
      req.session.save((err) => {
        if (err) {
          console.error('Failed to save session:', err);
          return res.redirect('/auth?error=session_save_failed');
        }

        console.log('\nStep 2: Session Saved Successfully');
        console.log('  Encoded state:', encodedState.substring(0, 50) + '...');
        console.log('  Session courseId:', req.session.courseId);
        console.log('  Session assignmentName:', req.session.assignmentName);
        console.log('  Redirecting to Cognito...');

        passport.authenticate('cognito', {
          state: encodedState, // Use encoded state with parameters
          scope: 'openid email profile',
        })(req, res, next);
      });
    });

    // Callback route
    app.get('/auth/cognito/callback', 
      (req: Request, res: Response, next: NextFunction) => {
        console.log('\n=== AUTH FLOW CALLBACK ===');
        console.log('Step 3: Cognito Callback Route Hit');
        console.log('  Query state:', req.query.state ? 'Present' : 'Missing');
        console.log('  Session state:', req.session.state ? 'Present' : 'Missing');

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
              console.log('State mismatch detected');
              return res.redirect('/auth?error=state_mismatch');
            }
          }
        } catch (error) {
          console.warn('Failed to decode state parameters:', error);
          // Fall back to original state verification
          if (!isDevelopment && req.query.state !== req.session.state) {
            return res.redirect('/auth?error=state_mismatch');
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
          failureRedirect: '/auth?error=cognito_failed',
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
        
        // Enhanced debug logging for parameter retrieval
        console.log('\nDEBUG: Callback Parameter Retrieval');
        console.log('  Session courseId:', req.session.courseId);
        console.log('  Session courseId type:', typeof req.session.courseId);
        console.log('  Session ID:', req.sessionID);
        
        // Fallback to state parameters if session is empty
        const stateParams = (req as any).stateParams;
        console.log('  State params object:', stateParams);
        console.log('  State courseId:', stateParams?.courseId);
        console.log('  State courseId type:', typeof stateParams?.courseId);
        
        if (!externalCourseId && stateParams?.courseId) {
          externalCourseId = stateParams.courseId;
          console.log('  ✓ Retrieved courseId from STATE parameter:', externalCourseId);
        }
        if (!assignmentName && stateParams?.assignmentName) {
          assignmentName = stateParams.assignmentName;
          console.log('  ✓ Retrieved assignmentName from STATE parameter:', assignmentName);
        }

        console.log('\nStep 4: Parameters Retrieved');
        console.log('  Final courseId:', externalCourseId || 'NOT FOUND');
        console.log('  Final courseId type:', typeof externalCourseId);
        console.log('  Final assignmentName:', assignmentName || 'NOT FOUND');
        
        // Log parameter preservation metrics
        const hasStoredCourseId = !!req.session.courseId;
        const hasStateCourseId = !!stateParams?.courseId;
        
        console.log('\nStep 5: Parameter Preservation Metrics');
        console.log('  Session success:', hasStoredCourseId);
        console.log('  State fallback used:', !hasStoredCourseId && hasStateCourseId);
        console.log('  Overall success:', hasStoredCourseId || hasStateCourseId);
        console.log('  Final courseId:', externalCourseId || 'NONE');
        console.log('  Timestamp:', new Date().toISOString());

        // Clear the stored parameters from session
        delete req.session.courseId;
        delete req.session.assignmentName;

        // Determine redirect URL based on external course ID
        let redirectUrl = '/';

        if (externalCourseId) {
          try {
            // Import storage to look up course
            const { storage } = await import('./storage.js');
            
            console.log('\nDEBUG: Database Lookup');
            console.log('  Looking up external ID:', externalCourseId);
            console.log('  External ID type:', typeof externalCourseId);
            console.log('  External ID as string:', String(externalCourseId));
            
            const course = await storage.getCourseByExternalId(String(externalCourseId));
            
            console.log('  Course lookup result:', course ? `Found: ${course.courseNumber} (ID: ${course.id})` : 'NOT FOUND');

            if (course) {
              // Get the first question set for this course
              const questionSets = await storage.getQuestionSetsByCourse(course.id);
              console.log(`  Question sets found: ${questionSets.length}`);

              if (questionSets.length > 0) {
                // Redirect to the first question set of the course
                redirectUrl = `/question-set/${questionSets[0].id}`;
                console.log(`\nStep 6: SUCCESS - Redirecting to question set ${questionSets[0].id} for course ${course.courseTitle}`);
                console.log('=== AUTH FLOW COMPLETE ===\n');
              } else {
                console.log(`  ⚠️ No question sets found for course ${course.courseTitle}`);
              }
            } else {
              console.log(`  ⚠️ No course found with external ID: ${externalCourseId}`);
              console.log('  Available courses should have external IDs like: 6128, 8426, 8431, 8432, etc.');
            }
          } catch (error) {
            console.log('  ⚠️ Error looking up course:', error);
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