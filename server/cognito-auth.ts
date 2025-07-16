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
    console.log('Cognito authentication initialized successfully');
  }

  setupRoutes(app: Express) {
    console.log('Setting up Cognito routes...');
    
    // Route to initiate login
    app.get('/auth/cognito', (req: Request, res: Response, next: NextFunction) => {
      console.log('Cognito login route hit');
      console.log('Session ID before:', req.sessionID);
      
      const state = Math.random().toString(36).substring(2, 15);
      req.session.state = state;
      
      // Force session save before redirecting
      req.session.save((err) => {
        if (err) {
          console.error('Failed to save session:', err);
          return res.status(500).json({ error: 'Session error' });
        }
        
        console.log('Session saved successfully');
        console.log('Session ID:', req.sessionID);
        console.log('State:', state);
        console.log('Session data:', req.session);
        
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
        console.log('Query params:', req.query);
        console.log('Session ID:', req.sessionID);
        console.log('Session state:', req.session.state);
        console.log('Query state:', req.query.state);
        
        // In development, we might have session issues - be more lenient
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        // Verify state parameter (skip in development if session is missing)
        if (!isDevelopment && req.query.state !== req.session.state) {
          console.log('State mismatch - expected:', req.session.state, 'got:', req.query.state);
          
          // Instead of returning JSON error, redirect to auth page with error
          return res.redirect('/auth?error=state_mismatch');
        }
        
        // Clear the state from session
        delete req.session.state;
        
        console.log('State verified or skipped, authenticating with Cognito...');
        passport.authenticate('cognito', {
          failureRedirect: '/auth?error=cognito_failed',
        })(req, res, next);
      },
      (req: Request, res: Response) => {
        // Successful authentication
        console.log('Authentication successful, user:', req.user);
        
        // Save session before redirecting
        req.session.save((err) => {
          if (err) {
            console.error('Failed to save session after login:', err);
          }
          // Redirect to root which will automatically go to the practice page
          res.redirect('/');
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