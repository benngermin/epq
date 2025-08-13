# AWS Cognito SSO Setup Guide

## What You Need From Your Client

Your client needs to provide the following information from their AWS Cognito User Pool configuration:

### 1. Cognito Domain
**What to ask for:** The custom domain URL for their Cognito hosted UI
**Example:** `your-domain.auth.us-east-1.amazoncognito.com`
**How they find it:** In AWS Console > Cognito > User Pool > App Integration > Domain

### 2. Client ID
**What to ask for:** The App Client ID from their Cognito User Pool
**Example:** `1a2b3c4d5e6f7g8h9i0j1k2l3m`
**How they find it:** In AWS Console > Cognito > User Pool > App Integration > App Clients

### 3. Client Secret
**What to ask for:** The App Client Secret (if they enabled it)
**Example:** `your-client-secret-here-32chars-long`
**How they find it:** In AWS Console > Cognito > User Pool > App Integration > App Clients > Show Details

### 4. Redirect URI Configuration
**What you need to tell them:** They need to add BOTH your development and production callback URLs to their allowed redirect URIs

**URLs to give them:**
- **Development:** `https://[your-repl-name].[your-username].repl.co/auth/cognito/callback`
- **Production:** `https://your-app-domain.replit.app/auth/cognito/callback`

**Where they configure it:** In AWS Console > Cognito > User Pool > App Integration > App Clients > Hosted UI

**Important:** AWS Cognito allows multiple redirect URIs. They should add both URLs to support both development and production environments.

## Required Cognito Settings

Tell your client to verify these settings in their Cognito User Pool:

### OAuth 2.0 Settings
- **Allowed OAuth Flows:** Authorization code grant
- **Allowed OAuth Scopes:** `openid`, `email`, `profile`
- **Callback URLs:** Must include `https://your-app-domain.replit.app/auth/cognito/callback`

### User Pool Settings
- **User ID Key Path:** `sub` (standard)
- **Email Key Path:** `email` (standard)

## Environment Variables Setup

Once you have the information, add these environment variables to your Replit project:

```env
COGNITO_DOMAIN=your-domain.auth.us-east-1.amazoncognito.com
COGNITO_CLIENT_ID=your-client-id-here
COGNITO_CLIENT_SECRET=your-client-secret-here
# COGNITO_REDIRECT_URI is optional - it will be auto-detected in development
# Only set this for production if your production URL differs from the auto-detected one
# COGNITO_REDIRECT_URI=https://your-app-domain.replit.app/auth/cognito/callback
```

**Note:** The application now automatically detects the correct redirect URI based on your environment:
- In development: Uses your Replit development URL automatically
- In production: Uses the COGNITO_REDIRECT_URI if set, otherwise auto-detects from Replit environment

## Testing the Integration

After configuration:
1. The SSO button will automatically appear on the login page
2. Users can click "Sign in with Single Sign-On"
3. They'll be redirected to the Cognito hosted UI
4. After successful login, they'll return to your app dashboard
5. New users will be automatically created in your database

## Troubleshooting

**If SSO button doesn't appear:**
- Check that all environment variables are set correctly
- Restart the application to pick up new environment variables

**If login fails:**
- Verify the redirect URI matches exactly in Cognito settings
- Check that OAuth scopes include `openid`, `email`, and `profile`
- Ensure the client secret is correct (if using confidential client)

## Security Notes

- The app supports both SSO and local authentication simultaneously
- SSO users are identified by their Cognito `sub` (subject) ID
- Existing local users are unaffected by SSO integration
- All user data is stored securely in your database