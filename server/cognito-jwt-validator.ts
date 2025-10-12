import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

// AWS Cognito configuration
const COGNITO_REGION = process.env.COGNITO_REGION || 'us-east-1';
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-1_vAMMFcpew';
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID; // Required for audience validation
const COGNITO_JWKS_URI = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
const COGNITO_ISSUER = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;

// Create JWKS client with caching for performance
const client = jwksClient({
  jwksUri: COGNITO_JWKS_URI,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

// Type definitions for JWT payload
export interface CognitoIdTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  'cognito:username'?: string;
  aud: string;
  event_id?: string;
  token_use: string;
  auth_time: number;
  exp: number;
  iat: number;
  jti: string;
  name?: string;
  given_name?: string;
  family_name?: string;
}

/**
 * Get the signing key from JWKS endpoint
 */
function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  if (!header.kid) {
    return callback(new Error('No kid specified in token header'));
  }

  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error('Failed to get signing key:', err);
      return callback(err);
    }
    
    if (!key) {
      return callback(new Error('No signing key found'));
    }
    
    const signingKey = 'publicKey' in key ? key.publicKey : key.rsaPublicKey;
    if (!signingKey) {
      return callback(new Error('No public key available'));
    }
    
    callback(null, signingKey);
  });
}

/**
 * Validate AWS Cognito ID token
 * @param token - JWT ID token from mobile app
 * @returns Decoded token payload
 * @throws Error if validation fails
 */
export function validateCognitoToken(token: string): Promise<CognitoIdTokenPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        issuer: COGNITO_ISSUER,
        algorithms: ['RS256']
      },
      (err, decoded) => {
        if (err) {
          console.error('Token validation failed:', err.message);
          return reject(err);
        }

        if (!decoded || typeof decoded === 'string') {
          return reject(new Error('Invalid token payload'));
        }

        const payload = decoded as CognitoIdTokenPayload;

        // Verify this is an ID token, not an access token
        if (payload.token_use !== 'id') {
          return reject(new Error('Token is not an ID token'));
        }

        // Critical: Verify the audience (aud) claim matches our client ID
        // This prevents tokens issued for other applications from being used here
        if (!COGNITO_CLIENT_ID) {
          return reject(new Error('COGNITO_CLIENT_ID not configured'));
        }
        
        if (payload.aud !== COGNITO_CLIENT_ID) {
          console.error(`Token audience mismatch: expected ${COGNITO_CLIENT_ID}, got ${payload.aud}`);
          return reject(new Error('Token audience does not match expected client'));
        }

        // Check token hasn't expired (jwt.verify already does this, but being explicit)
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
          return reject(new Error('Token has expired'));
        }

        resolve(payload);
      }
    );
  });
}

/**
 * Extract user information from validated token
 */
export function extractUserInfo(payload: CognitoIdTokenPayload) {
  return {
    cognitoUserId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified,
    name: payload.name || payload.given_name || payload.email.split('@')[0] || 'User',
    tokenId: payload.jti
  };
}