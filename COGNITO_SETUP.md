# AWS Cognito SSO Setup Guide

## What You Need From Your Client

Your client needs to provide the following information from their AWS Cognito User Pool configuration:

### 1. Cognito Domain
**What to ask for:** The custom domain URL for their Cognito hosted UI
**Example from screenshot:** `users.login.theinstitutes.org`
**How they find it:** In AWS Console > Cognito > User Pool > App Integration > Domain

### 2. Client ID
**What to ask for:** The App Client ID from their Cognito User Pool
**Example from screenshot:** `6r574u9jasn360o9hg4ekht6g3`
**How they find it:** In AWS Console > Cognito > User Pool > App Integration > App Clients

### 3. Client Secret
**What to ask for:** The App Client Secret (if they enabled it)
**Example from screenshot:** `mgv0r2q6rk44m35peopfnc05sjpsh37bh03`
**How they find it:** In AWS Console > Cognito > User Pool > App Integration > App Clients > Show Details

### 4. Redirect URI Configuration
**What you need to tell them:** They need to add your app's callback URL to their allowed redirect URIs
**The URL to give them:** `https://your-app-domain.replit.app/auth/cognito/callback`
**Where they configure it:** In AWS Console > Cognito > User Pool > App Integration > App Clients > Hosted UI

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
COGNITO_DOMAIN=users.login.theinstitutes.org
COGNITO_CLIENT_ID=6r574u9jasn360o9hg4ekht6g3
COGNITO_CLIENT_SECRET=mgv0r2q6rk44m35peopfnc05sjpsh37bh03
COGNITO_REDIRECT_URI=https://your-app-domain.replit.app/auth/cognito/callback
```

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