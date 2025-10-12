## Executive Summary

The TI Lab mobile app now sends authenticated users to the EPQ web application via a new `/auth/mobile-sso` endpoint. The mobile app passes a JWT ID token from AWS Cognito along with an integer course identifier. The EPQ web app must validate the token, extract user information, create a session, and redirect to the appropriate course content.

**Critical Information:**
- **Course ID Format:** 4-digit integers (e.g., 8433), NOT alphanumeric strings
- **CPCU 500 Course ID:** 8433
- **Authentication:** JWT ID tokens from AWS Cognito User Pool `us-east-1_vAMMFcpew`
- **Endpoint:** New route at `/auth/mobile-sso` accepting `token` and `courseId` query parameters
- **Production Domain:** exampracticequestions.theinstituteslab.org

---

## 1. Endpoint Specification

### HTTP Route
```
GET /auth/mobile-sso
```

### Query Parameters

| Parameter | Type | Format | Required | Description | Example |
|-----------|------|--------|----------|-------------|---------|
| `token` | string | JWT | Yes | AWS Cognito ID token (not access token) | `eyJraWQiOiJ...` |
| `courseId` | string | integer | Yes | 4-digit course identifier as string | `"8433"` |

### URL Example
```
https://exampracticequestions.theinstituteslab.org/auth/mobile-sso?token=eyJraWQiOiJrZ0...&courseId=8433
```

**Important Notes:**
- `courseId` is transmitted as a string in the URL but represents a 4-digit positive integer
- Convert to integer for database queries: `parseInt(courseId, 10)`
- Validate range: 1000-9999 (4-digit validation)
- Token is a Cognito ID token, not an access token (verify `token_use: "id"`)

---

## 2. AWS Cognito Configuration

### Cognito Details

| Setting | Value |
|---------|-------|
| **Region** | us-east-1 |
| **User Pool ID** | us-east-1_vAMMFcpew |
| **JWKS URL** | https://cognito-idp.us-east-1.amazonaws.com/us-east-1_vAMMFcpew/.well-known/jwks.json |
| **Issuer** | https://cognito-idp.us-east-1.amazonaws.com/us-east-1_vAMMFcpew |
| **Token Type** | ID Token (not Access Token) |
| **Algorithm** | RS256 (RSA with SHA-256) |

### Required npm Packages

```bash
npm install jsonwebtoken jwks-rsa
```

---

## 3. Token Validation Implementation

### Step 1: Configure JWKS Client

```javascript
const jwksClient = require('jwks-rsa');

// Create JWKS client (cache keys for performance)
const client = jwksClient({
  jwksUri: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_vAMMFcpew/.well-known/jwks.json',
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

// Function to get signing key from JWKS
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error('Failed to get signing key:', err);
      return callback(err);
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}
```

### Step 2: Validate JWT Token

```javascript
const jwt = require('jsonwebtoken');

/**
 * Validate Cognito ID token
 * @param {string} token - JWT ID token from mobile app
 * @returns {Promise<object>} Decoded token payload
 * @throws {Error} If validation fails
 */
function validateCognitoToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_vAMMFcpew',
        algorithms: ['RS256']
      },
      (err, decoded) => {
        if (err) {
          console.error('Token validation failed:', err.message);
          return reject(err);
        }

        // Verify this is an ID token, not an access token
        if (decoded.token_use !== 'id') {
          return reject(new Error('Token is not an ID token'));
        }

        // Check token hasn't expired
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp < now) {
          return reject(new Error('Token has expired'));
        }

        resolve(decoded);
      }
    );
  });
}
```

### Token Payload Structure

```javascript
// Example decoded token
{
  "sub": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",  // Unique user ID
  "email_verified": true,
  "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_vAMMFcpew",
  "cognito:username": "user@example.com",
  "aud": "...",                                    // Client ID
  "event_id": "...",
  "token_use": "id",                               // MUST be "id"
  "auth_time": 1705012345,
  "exp": 1705015945,                               // Expiration timestamp
  "iat": 1705012345,                               // Issued at timestamp
  "jti": "...",                                    // Unique token ID
  "email": "user@example.com"
}
```

**Extract User Information:**
```javascript
const userId = decoded.sub;              // Unique Cognito user identifier (UUID)
const userEmail = decoded.email;         // User's email address
const emailVerified = decoded.email_verified; // Boolean
const tokenId = decoded.jti;             // Unique token ID (for replay prevention)
```

---

## 4. Complete Endpoint Implementation

### Full Working Example

```javascript
const express = require('express');
const rateLimit = require('express-rate-limit');
const validator = require('validator');

const app = express();

// Rate limiter for mobile SSO endpoint
const ssoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // Max 10 requests per IP
  message: 'Too many authentication attempts'
});

/**
 * Mobile SSO Authentication Endpoint
 * Accepts JWT token from mobile app and creates EPQ session
 */
app.get('/auth/mobile-sso', ssoLimiter, async (req, res) => {
  const startTime = Date.now();
  const { token, courseId } = req.query;

  try {
    // ====================================================================
    // STEP 1: Validate Parameters
    // ====================================================================

    if (!token || !courseId) {
      console.error('Mobile SSO: Missing parameters', {
        hasToken: !!token,
        hasCourseId: !!courseId
      });
      return res.redirect('/auth/cognito'); // Fallback to OAuth
    }

    // Validate courseId is a 4-digit integer
    if (!validator.isInt(courseId, { min: 1000, max: 9999 })) {
      console.error('Mobile SSO: Invalid course ID format', { courseId });
      return res.redirect('/auth/cognito');
    }
    const courseIdInt = parseInt(courseId, 10);

    // ====================================================================
    // STEP 2: Validate JWT Token
    // ====================================================================

    const decoded = await validateCognitoToken(token);

    // Extract user information
    const {
      sub: cognitoUserId,
      email: userEmail,
      email_verified: emailVerified,
      jti: tokenId
    } = decoded;

    console.log('Mobile SSO: Token validated', {
      userId: cognitoUserId,
      email: userEmail,
      courseId: courseIdInt
    });

    // Optional: Prevent token replay attacks
    // Check if token has been used before (requires Redis/cache)
    // const tokenUsed = await checkTokenUsed(tokenId);
    // if (tokenUsed) throw new Error('Token already used');
    // await markTokenAsUsed(tokenId, decoded.exp);

    // ====================================================================
    // STEP 3: Find or Create EPQ User
    // ====================================================================

    let epqUser = await findUserByEmail(userEmail);

    if (!epqUser) {
      // Create new EPQ user
      epqUser = await createUser({
        cognitoUserId,
        email: userEmail,
        emailVerified,
        authSource: 'mobile_sso',
        createdAt: new Date()
      });

      console.log('Mobile SSO: Created new user', {
        epqUserId: epqUser.id,
        email: userEmail
      });
    } else {
      console.log('Mobile SSO: Existing user found', {
        epqUserId: epqUser.id,
        email: userEmail
      });
    }

    // ====================================================================
    // STEP 4: Validate Course Access
    // ====================================================================

    const course = await findCourseById(courseIdInt);

    if (!course) {
      console.error('Mobile SSO: Course not found', { courseId: courseIdInt });
      // Redirect to course list instead of auth error
      return res.redirect('/courses');
    }

    // Check if user has access to this course
    const hasAccess = await checkCourseAccess(epqUser.id, courseIdInt);

    if (!hasAccess) {
      console.warn('Mobile SSO: User lacks course access', {
        userId: epqUser.id,
        courseId: courseIdInt
      });

      // Option A: Auto-grant access for mobile users
      await grantCourseAccess(epqUser.id, courseIdInt);

      // Option B: Redirect to enrollment page
      // return res.redirect(`/enroll?courseId=${courseIdInt}`);
    }

    // ====================================================================
    // STEP 5: Create Session
    // ====================================================================

    // Regenerate session ID for security
    req.session.regenerate((err) => {
      if (err) {
        console.error('Mobile SSO: Session regeneration failed', err);
        return res.redirect('/auth/cognito');
      }

      // Set session data
      req.session.userId = epqUser.id;
      req.session.email = userEmail;
      req.session.authMethod = 'mobile_sso';
      req.session.courseId = courseIdInt;

      // Save session before redirect
      req.session.save((err) => {
        if (err) {
          console.error('Mobile SSO: Session save failed', err);
          return res.redirect('/auth/cognito');
        }

        // Log success
        console.log('MOBILE_SSO_SUCCESS', {
          timestamp: new Date().toISOString(),
          userId: epqUser.id,
          email: userEmail,
          courseId: courseIdInt,
          courseName: course.name,
          duration: Date.now() - startTime
        });

        // Redirect to course content
        res.redirect(`/course/${courseIdInt}`);
      });
    });

  } catch (err) {
    // ====================================================================
    // ERROR HANDLING
    // ====================================================================

    console.error('MOBILE_SSO_ERROR', {
      timestamp: new Date().toISOString(),
      errorType: err.name,
      errorMessage: err.message,
      courseId,
      duration: Date.now() - startTime
    });

    // Log full error for debugging (not exposed to user)
    console.error('Full error:', err);

    // Always redirect to OAuth on any error
    res.redirect('/auth/cognito');
  }
});

module.exports = app;
```

---

## 5. Database Requirements

### Users Table Schema

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  cognito_user_id VARCHAR(255) UNIQUE,  -- AWS Cognito sub claim
  email VARCHAR(255) UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  auth_source VARCHAR(50),               -- 'mobile_sso', 'cognito_oauth', etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);

-- Indexes for fast lookups
CREATE INDEX idx_users_cognito_id ON users(cognito_user_id);
CREATE INDEX idx_users_email ON users(email);
```

### User Database Functions

```javascript
/**
 * Find user by email address
 * @param {string} email - User's email
 * @returns {Promise<object|null>} User object or null
 */
async function findUserByEmail(email) {
  const result = await db.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Create new EPQ user
 * @param {object} userData - User data from Cognito token
 * @returns {Promise<object>} Created user object
 */
async function createUser(userData) {
  const { cognitoUserId, email, emailVerified, authSource } = userData;

  const result = await db.query(
    `INSERT INTO users (cognito_user_id, email, email_verified, auth_source, created_at, last_login_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING *`,
    [cognitoUserId, email, emailVerified, authSource]
  );

  return result.rows[0];
}
```

### Courses Table

Ensure your courses table uses integer IDs:

```sql
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY,              -- 4-digit integer (e.g., 8433)
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Example data
INSERT INTO courses (id, name, title) VALUES
  (8433, 'CPCU 500', 'Foundations of Risk Management, Insurance, and Professionalism');
```

### Course Access Functions

```javascript
/**
 * Find course by integer ID
 * @param {number} courseId - 4-digit course ID
 * @returns {Promise<object|null>} Course object or null
 */
async function findCourseById(courseId) {
  const result = await db.query(
    'SELECT * FROM courses WHERE id = $1',
    [courseId]
  );
  return result.rows[0] || null;
}

/**
 * Check if user has access to course
 * @param {number} userId - EPQ user ID
 * @param {number} courseId - Course ID
 * @returns {Promise<boolean>} True if user has access
 */
async function checkCourseAccess(userId, courseId) {
  const result = await db.query(
    'SELECT 1 FROM user_course_access WHERE user_id = $1 AND course_id = $2',
    [userId, courseId]
  );
  return result.rows.length > 0;
}

/**
 * Grant course access to user
 * @param {number} userId - EPQ user ID
 * @param {number} courseId - Course ID
 * @returns {Promise<void>}
 */
async function grantCourseAccess(userId, courseId) {
  await db.query(
    `INSERT INTO user_course_access (user_id, course_id, granted_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT DO NOTHING`,
    [userId, courseId]
  );
}
```

---

## 6. Error Handling

### Error Response Strategy

| Error Condition | Log Level | User Action | Implementation |
|----------------|-----------|-------------|----------------|
| Missing token or courseId | ERROR | Redirect to `/auth/cognito` | Standard OAuth flow |
| Invalid course ID format | ERROR | Redirect to `/auth/cognito` | Parse/validation failure |
| Token validation fails | ERROR | Redirect to `/auth/cognito` | JWT verification error |
| Token expired | WARN | Redirect to `/auth/cognito` | Token past exp time |
| Token already used | ERROR | Redirect to `/auth/cognito` | Replay attack prevention |
| Course not found | WARN | Redirect to `/courses` | Unknown course ID |
| User lacks access | WARN | Auto-grant or redirect to `/enroll` | Business logic decision |
| Session creation fails | ERROR | Redirect to `/auth/cognito` | Session storage issue |

**Key Principle:** Never expose technical error details to users. Always log detailed errors server-side and redirect to a safe, functional page.

### Error Logging Function

```javascript
/**
 * Log mobile SSO errors with structured data
 * @param {string} errorType - Error category
 * @param {object} details - Additional error context
 * @param {Error} error - Error object
 */
function logMobileSsoError(errorType, details, error) {
  console.error('MOBILE_SSO_ERROR', {
    timestamp: new Date().toISOString(),
    errorType,
    details,
    errorMessage: error?.message,
    errorStack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
  });

  // Optional: Send to error tracking service
  // if (errorTracker) {
  //   errorTracker.captureException(error, {
  //     tags: { type: 'mobile_sso', errorType },
  //     extra: details
  //   });
  // }
}
```

---

## 7. Security Implementation

### Security Checklist

- [ ] **HTTPS Only:** Enforce HTTPS in production
- [ ] **Rate Limiting:** Max 10 requests per 15 minutes per IP
- [ ] **Token Replay Prevention:** Track used token IDs
- [ ] **Input Validation:** Sanitize all inputs
- [ ] **Secure Sessions:** httpOnly, secure, sameSite cookies
- [ ] **Session Regeneration:** Regenerate session ID after auth
- [ ] **CORS:** Restrict to trusted origins
- [ ] **CSP:** Content Security Policy headers
- [ ] **Logging:** No tokens in logs (redact sensitive data)

### HTTPS Enforcement

```javascript
app.use((req, res, next) => {
  if (req.protocol !== 'https' && process.env.NODE_ENV === 'production') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});
```

### Token Replay Prevention (Redis Example)

```javascript
const redis = require('redis');
const redisClient = redis.createClient();

/**
 * Check if token has been used before
 * @param {string} tokenId - JWT jti claim
 * @returns {Promise<boolean>} True if already used
 */
async function checkTokenUsed(tokenId) {
  const key = `used_token:${tokenId}`;
  const exists = await redisClient.exists(key);
  return exists === 1;
}

/**
 * Mark token as used
 * @param {string} tokenId - JWT jti claim
 * @param {number} exp - Token expiration timestamp
 * @returns {Promise<void>}
 */
async function markTokenAsUsed(tokenId, exp) {
  const key = `used_token:${tokenId}`;
  const ttl = exp - Math.floor(Date.now() / 1000); // Time until expiration

  if (ttl > 0) {
    await redisClient.setEx(key, ttl, 'true');
  }
}
```

### Secure Session Configuration

```javascript
const session = require('express-session');

app.use(session({
  secret: process.env.SESSION_SECRET,  // Use strong random secret
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    httpOnly: true,                                  // No JavaScript access
    sameSite: 'lax',                                 // CSRF protection
    maxAge: 24 * 60 * 60 * 1000                     // 24 hours
  },
  store: new RedisStore({ client: redisClient })    // Use persistent store
}));
```

---

## 8. Testing Guide

### Test Case 1: Successful Authentication

**Test Steps:**
1. Launch mobile app and log in with valid Cognito credentials
2. Navigate to CPCU 500 course
3. Tap "Exam Practice" button
4. Observe browser opens EPQ application

**Expected Result:**
- No login screen shown
- User lands directly on CPCU 500 course content (course ID 8433)
- Session is established
- EPQ logs show "MOBILE_SSO_SUCCESS"

**Verification:**
```bash
# Check EPQ logs
grep "MOBILE_SSO_SUCCESS" logs/app.log | tail -n 1

# Expected output:
# {
#   "timestamp": "2025-01-12T...",
#   "userId": 123,
#   "email": "user@example.com",
#   "courseId": 8433,
#   "courseName": "CPCU 500",
#   "duration": 234
# }
```

### Test Case 2: Invalid Token

**Test Steps:**
1. Manually construct URL with invalid token: `https://epq.../auth/mobile-sso?token=invalid&courseId=8433`
2. Visit URL in browser

**Expected Result:**
- Redirects to `/auth/cognito`
- Standard OAuth login flow initiates
- Logs show "Token validation failed"

### Test Case 3: Expired Token

**Test Steps:**
1. Use a token that's older than 1 hour
2. Try to authenticate

**Expected Result:**
- Redirects to `/auth/cognito`
- Logs show "Token has expired"

### Test Case 4: Invalid Course ID

**Test Steps:**
1. Use valid token but invalid courseId: `courseId=abc` or `courseId=999`
2. Try to authenticate

**Expected Result:**
- Redirects to `/auth/cognito`
- Logs show "Invalid course ID format"

### Test Case 5: Non-Existent Course

**Test Steps:**
1. Use valid token and valid format but non-existent course: `courseId=9999`
2. Try to authenticate

**Expected Result:**
- Session is created
- Redirects to `/courses` (course list)
- Logs show "Course not found"

### Automated Testing

```javascript
const request = require('supertest');
const app = require('./app');

describe('Mobile SSO Endpoint', () => {

  test('should authenticate with valid token and courseId', async () => {
    const validToken = generateTestToken();

    const response = await request(app)
      .get('/auth/mobile-sso')
      .query({ token: validToken, courseId: '8433' });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/course/8433');
  });

  test('should reject invalid token', async () => {
    const response = await request(app)
      .get('/auth/mobile-sso')
      .query({ token: 'invalid', courseId: '8433' });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/auth/cognito');
  });

  test('should reject non-integer courseId', async () => {
    const validToken = generateTestToken();

    const response = await request(app)
      .get('/auth/mobile-sso')
      .query({ token: validToken, courseId: 'abc' });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/auth/cognito');
  });

  test('should reject courseId outside valid range', async () => {
    const validToken = generateTestToken();

    const response = await request(app)
      .get('/auth/mobile-sso')
      .query({ token: validToken, courseId: '999' });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/auth/cognito');
  });

});
```

---

## 9. Monitoring and Logging

### Key Metrics

**Success Metrics:**
- Mobile SSO success rate (%)
- Average authentication latency (ms)
- Daily active mobile SSO users

**Error Metrics:**
- Token validation failure rate
- Course not found errors
- Session creation failures

### Logging Structure

```javascript
// Success log
console.log('MOBILE_SSO_SUCCESS', {
  timestamp: new Date().toISOString(),
  userId: epqUser.id,
  email: userEmail,
  courseId: courseIdInt,
  courseName: course.name,
  duration: Date.now() - startTime,
  userAgent: req.get('user-agent')
});

// Error log
console.error('MOBILE_SSO_ERROR', {
  timestamp: new Date().toISOString(),
  errorType: 'token_validation_failed',
  errorMessage: err.message,
  courseId,
  duration: Date.now() - startTime,
  userAgent: req.get('user-agent')
});
```

### Dashboard Queries (CloudWatch/Datadog)

```sql
-- Success rate last 24 hours
SELECT
  COUNT(*) FILTER (WHERE message LIKE '%MOBILE_SSO_SUCCESS%') * 100.0 / COUNT(*) as success_rate
FROM logs
WHERE timestamp > NOW() - INTERVAL '1 day'
  AND (message LIKE '%MOBILE_SSO_SUCCESS%' OR message LIKE '%MOBILE_SSO_ERROR%');

-- Most common errors
SELECT
  json_extract(message, '$.errorType') as error_type,
  COUNT(*) as count
FROM logs
WHERE message LIKE '%MOBILE_SSO_ERROR%'
  AND timestamp > NOW() - INTERVAL '1 day'
GROUP BY error_type
ORDER BY count DESC;

-- Average authentication latency
SELECT AVG(json_extract(message, '$.duration')) as avg_duration_ms
FROM logs
WHERE message LIKE '%MOBILE_SSO_SUCCESS%'
  AND timestamp > NOW() - INTERVAL '1 day';
```

---

## 10. Deployment Checklist

### Environment Variables

```bash
# Required environment variables
NODE_ENV=production
EPQ_DOMAIN=exampracticequestions.theinstituteslab.org

# Session
SESSION_SECRET=<strong-random-secret>  # Generate with: openssl rand -hex 32

# AWS Cognito
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_vAMMFcpew
COGNITO_JWKS_URI=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_vAMMFcpew/.well-known/jwks.json

# Database
DATABASE_URL=<postgresql-connection-string>

# Redis (for session store and token tracking)
REDIS_URL=<redis-connection-string>

# Optional: Error tracking
SENTRY_DSN=<sentry-dsn>
```

### Pre-Deployment Checks

- [ ] All dependencies installed (`npm install`)
- [ ] Environment variables configured
- [ ] Database schema updated (users table, courses table)
- [ ] Course ID 8433 exists in courses table for CPCU 500
- [ ] Redis/session store configured and reachable
- [ ] HTTPS enforced in production
- [ ] Rate limiting configured
- [ ] Error logging functional
- [ ] All tests pass (`npm test`)
- [ ] Security headers configured
- [ ] CORS policy set
- [ ] Monitoring dashboard ready

### Deployment Steps

1. **Stage 1: Deploy to Staging**
   ```bash
   git checkout main
   git pull origin main
   npm run build
   npm run deploy:staging
   ```

2. **Stage 2: Verify Staging**
   - Run manual test cases
   - Check logs for errors
   - Verify database connectivity
   - Test token validation

3. **Stage 3: Deploy to Production**
   ```bash
   npm run deploy:production
   ```

4. **Stage 4: Monitor Production**
   - Watch logs for first hour
   - Monitor error rates
   - Check success metrics
   - Verify user reports

### Rollback Plan

If critical issues occur:

1. **Immediate Action:** Disable endpoint temporarily
   ```javascript
   app.get('/auth/mobile-sso', (req, res) => {
     // Temporary: Redirect all to OAuth during incident
     res.redirect('/auth/cognito');
   });
   ```

2. **Investigate:** Review logs to identify root cause

3. **Fix:** Address issue in code

4. **Redeploy:** Apply fix and re-enable full functionality

**Impact of Rollback:** Mobile app users will see standard OAuth login screen (no service disruption)

---

## 11. Course ID Reference

### Current Mappings

| Course Number | Course Title | EPQ Course ID (Integer) |
|---------------|--------------|-------------------------|
| CPCU 500 | Foundations of Risk Management, Insurance, and Professionalism | 8433 |

**Future Course IDs:**
- As new courses are added, ensure they use 4-digit integer IDs (1000-9999)
- Coordinate with mobile team to update TI Lab database with EPQ course IDs
- Test each new course before production deployment

---

## 12. Troubleshooting

### Issue: "Token validation failed"

**Symptoms:** Users redirected to OAuth, logs show token validation error

**Possible Causes:**
- Token expired (tokens valid for 1 hour)
- Wrong user pool ID or JWKS URL
- Network issues reaching Cognito JWKS endpoint
- Token signature mismatch

**Debug Steps:**
```javascript
// Enable verbose logging
if (process.env.DEBUG_MOBILE_SSO === 'true') {
  console.log('Token received (first 50 chars):', token.substring(0, 50));
  console.log('Token decoded (before verification):', jwt.decode(token));
  console.log('JWKS client status:', client);
}
```

**Solution:**
- Verify `COGNITO_USER_POOL_ID` is correct: `us-east-1_vAMMFcpew`
- Check JWKS URL is reachable: `curl https://cognito-idp.us-east-1.amazonaws.com/us-east-1_vAMMFcpew/.well-known/jwks.json`
- Ensure token is an ID token (`token_use: "id"`)

### Issue: "User not found after successful token validation"

**Symptoms:** Token validates but session creation fails

**Possible Causes:**
- User doesn't exist in EPQ database
- Email lookup failing

**Solution:**
- Implement auto-creation for new users (see `createUser` function)
- Check database connectivity
- Verify email field is properly populated

### Issue: "Course not found"

**Symptoms:** Valid token and user but course doesn't load

**Possible Causes:**
- Course ID doesn't exist in EPQ database
- Course ID format mismatch (expecting string, receiving integer)

**Solution:**
- Verify course ID 8433 exists: `SELECT * FROM courses WHERE id = 8433;`
- Ensure courses table uses integer IDs, not strings
- Check course ID parsing: `parseInt(courseId, 10)`

### Issue: "Redirect loop"

**Symptoms:** Browser keeps redirecting between EPQ and mobile app

**Possible Causes:**
- Session not being created
- Session store not working (Redis/PostgreSQL down)
- Cookie settings preventing session persistence

**Solution:**
- Check session store connectivity
- Verify cookie settings (secure, httpOnly, sameSite)
- Enable session debugging: `app.use(session({ ...config, debug: true }))`

---

## 13. Support Contacts

### Mobile App Team
- **Codebase:** `ti-lab-mobile-app`
- **Key Files:**
  - `lib/services/epq_launcher_service.dart`
  - `lib/models/course.dart`

### AWS Cognito
- **User Pool:** us-east-1_vAMMFcpew
- **Region:** us-east-1
- **JWKS:** https://cognito-idp.us-east-1.amazonaws.com/us-east-1_vAMMFcpew/.well-known/jwks.json

### EPQ Infrastructure
- **Production Domain:** exampracticequestions.theinstituteslab.org
- **Endpoint:** `/auth/mobile-sso`

---

## Appendix A: Quick Reference

### Critical Values
```javascript
const COGNITO_CONFIG = {
  region: 'us-east-1',
  userPoolId: 'us-east-1_vAMMFcpew',
  jwksUri: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_vAMMFcpew/.well-known/jwks.json',
  issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_vAMMFcpew'
};

const CPCU_500_COURSE_ID = 8433; // 4-digit integer
```

### Validation Rules
```javascript
// Course ID validation
const isValidCourseId = (id) => {
  const num = parseInt(id, 10);
  return Number.isInteger(num) && num >= 1000 && num <= 9999;
};

// Token type validation
const isIdToken = (decoded) => decoded.token_use === 'id';

// Token expiration validation
const isTokenExpired = (decoded) => {
  return decoded.exp < Math.floor(Date.now() / 1000);
};
```

---

**End of Document**

**Version:** 1.0
**Last Updated:** 2025-01-12
**Next Review:** After initial deployment
