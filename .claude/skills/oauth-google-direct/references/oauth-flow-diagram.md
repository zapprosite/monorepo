# Google OAuth 2.0 PKCE Flow Diagram

## Overview

This document explains the Google OAuth 2.0 Authorization Code Flow with PKCE (Proof Key for Code Exchange) for static web applications.

## Why PKCE?

PKCE (pronounced "pixy") is a security extension to OAuth 2.0 that prevents authorization code interception attacks. It replaces the deprecated Implicit Flow.

**Key benefits:**
- No client_secret needed in the browser (PKCE provides equivalent security)
- Prevents authorization code interception via URI leakage
- Required for mobile apps, recommended for all OAuth clients

## Complete Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              STEP 1: INITIATE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐                    ┌──────────┐           ┌──────────────┐   │
│  │          │   1. User visits    │          │  2. Auth  │              │   │
│  │  Browser │ ─────────────────> │  index.  │ request   │   Google     │   │
│  │          │                    │  html     │ ────────> │   OAuth      │   │
│  │          │ <───────────────── │ (checks   │ <═══════  │   Server     │   │
│  │          │   3. Redirect to   │  session) │  4. Auth  │              │   │
│  │          │   Google           │          │ page      │              │   │
│  └──────────┘                    └──────────┘           └──────────────┘   │
│                                                                             │
│  Before redirect, JS generates:                                              │
│  - code_verifier: random 64-char string (stored in sessionStorage)          │
│  - code_challenge: SHA-256(code_verifier) base64url encoded                 │
│  - state: random 16-char string (stored in sessionStorage)                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         STEP 2: USER AUTHENTICATES                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐                    ┌──────────┐           ┌──────────────┐   │
│  │          │   User enters       │          │           │              │   │
│  │  Google  │ <────────────────── │   Auth   │           │              │   │
│  │  Login   │   credentials       │   Page    │           │              │   │
│  │  Page    │                    │           │           │              │   │
│  │          │ ─────────────────> │          │ ────────> │              │   │
│  │          │   Consent screen    │          │  Consent  │              │   │
│  │          │                    │          │           │              │   │
│  └──────────┘                    └──────────┘           └──────────────┘   │
│                                                                             │
│  Google shows:                                                               │
│  - Login form (if not logged in)                                            │
│  - Consent screen with requested scopes                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          STEP 3: CALLBACK                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐                    ┌───────────────┐           ┌──────────────┐ │
│  │          │   5. Redirect to   │               │           │              │ │
│  │  Google  │ ────────────────> │ auth-callback │ <═══════  │   Google     │ │
│  │  OAuth   │   /auth/callback  │     .html     │  6. Code  │   OAuth      │ │
│  │  Server  │   ?code=xxx       │               │  +state   │   Server     │ │
│  │          │   &state=xxx      │               │           │              │ │
│  └──────────┘                    └───────────────┘           └──────────────┘ │
│                                                                             │
│  URL contains:                                                              │
│  - code: authorization code (expires in ~60 seconds)                         │
│  - state: must match the state we stored                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                       STEP 4: TOKEN EXCHANGE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────┐                        ┌───────────────┐                 │
│  │               │   7. POST with:        │               │                 │
│  │  callback.js  │ ─────────────────────> │   Google      │                 │
│  │               │   code                 │   OAuth       │                 │
│  │               │   code_verifier        │   Token       │                 │
│  │               │   client_id            │   Endpoint    │                 │
│  │               │   client_secret        │               │                 │
│  │               │                        │               │                 │
│  │               │ <───────────────────── │               │                 │
│  │               │   access_token         │               │                 │
│  │               │   id_token             │               │                 │
│  │               │   refresh_token (opt)   │               │                 │
│  └───────────────┘                        └───────────────┘                 │
│                                                                             │
│  POST https://oauth2.googleapis.com/token                                   │
│  Content-Type: application/x-www-form-urlencoded                            │
│                                                                             │
│  body:                                                                       │
│    grant_type=authorization_code                                            │
│    &client_id=GOOGLE_CLIENT_ID                                               │
│    &client_secret=GOOGLE_CLIENT_SECRET                                       │
│    &code=AUTH_CODE                                                          │
│    &code_verifier=PKCE_VERIFIER                                             │
│    &redirect_uri=https://app.zappro.site/auth/callback                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         STEP 5: SESSION STORED                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────┐                                                         │
│  │               │   8. Store in sessionStorage:                           │
│  │  callback.js  │   - access_token                                        │
│  │               │   - id_token                                            │
│  │               │   - token_type                                          │
│  │               │                                                         │
│  │               │   9. Clear PKCE artifacts:                              │
│  │               │   - pkce_verifier                                       │
│  │               │   - oauth_state                                         │
│  │               │                                                         │
│  │               │   10. Redirect to / (index.html)                        │
│  └───────────────┘                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         STEP 6: AUTHENTICATED                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐                    ┌──────────┐           ┌──────────────┐   │
│  │          │   index.html       │          │           │   Google     │   │
│  │  Browser │ <───────────────── │  index.  │ ────────> │   Userinfo   │   │
│  │          │   renders app      │  html     │  API call │   API        │   │
│  │          │   with token       │  (shows   │ <═══════  │              │   │
│  │          │                    │  content) │  userinfo │              │   │
│  └──────────┘                    └──────────┘           └──────────────┘   │
│                                                                             │
│  sessionStorage contains:                                                    │
│  - access_token: for API calls                                               │
│  - id_token: contains user identity info (JWT)                              │
│  - token_type: Bearer                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Security Comparison

| Aspect | Implicit Flow (Deprecated) | PKCE Flow (Recommended) |
|--------|---------------------------|-------------------------|
| Token exposure | In URL fragment | In POST body only |
| Code interception risk | High | Low |
| client_secret required | No | Yes (in token exchange) |
| CSRF protection | State only | State + PKCE verifier |
| Browser history | Token in history | No token in URL |

## Token Storage

### sessionStorage (Recommended for OAuth)

```javascript
// Stored
sessionStorage.setItem('access_token', tokens.access_token);
sessionStorage.setItem('id_token', tokens.id_token);

// Cleared on tab close
sessionStorage.removeItem('access_token');
sessionStorage.removeItem('id_token');
```

### Why NOT localStorage?

- localStorage persists across browser sessions
- XSS attacks can read localStorage
- OAuth tokens should be short-lived and cleared on tab close

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `invalid_client` | Wrong client_id or client_secret | Verify credentials in Infisical |
| `client_secret is missing` | Secret not in POST body | Add client_secret to token exchange |
| `State mismatch` | CSRF attack or state lost | Check sessionStorage state matches URL |
| `Code verifier not found` | PKCE verifier lost | User must restart auth flow |
| `redirect_uri_mismatch` | Wrong URI in Google Console | Add exact redirect URI to OAuth client |

### Error Recovery

```javascript
async function handleCallback() {
  try {
    const tokens = await exchangeCodeForToken(code);
    // Success
  } catch (err) {
    if (err.message.includes('State mismatch')) {
      // CSRF detected — log and reject
      console.error('CSRF attack detected');
      return;
    }
    if (err.message.includes('Code verifier')) {
      // PKCE verifier lost — redirect to login
      window.location.href = '/';
      return;
    }
    // Other errors — show to user
    document.getElementById('status').textContent = err.message;
  }
}
```

## Google Cloud Console Setup

### Required Settings

1. **OAuth 2.0 Client ID** — Create Web Application type
2. **Authorized Redirect URI:**
   ```
   https://app.zappro.site/auth/callback
   ```
3. **Authorized JavaScript Origin:**
   ```
   https://app.zappro.site
   ```

### Testing the Flow

```bash
# 1. Build with env vars
GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy ./build.sh

# 2. Start container
docker compose up -d

# 3. Smoke test
curl -sfI https://app.zappro.site
curl -sfI https://app.zappro.site/auth/callback

# 4. Open browser and test full OAuth flow
open https://app.zappro.site
```
