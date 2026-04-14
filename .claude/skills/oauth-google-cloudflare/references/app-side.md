# App Side — What the App Needs

## Overview

With Cloudflare Access handling auth, the app receives **authenticated requests** without implementing any OAuth flow. Cloudflare validates the user and passes their identity via headers.

## What the App Receives

When a request passes through Cloudflare Access, the app receives these headers:

| Header | Description |
|--------|-------------|
| `Cf-Access-Jwt-Assertion` | JWT token with user identity |
| `Cf-Access-User-Email` | User's email address |
| `Cf-Access-User-Name` | User's display name (if available) |
| `Cf-Access-User-Id` | User's unique ID in CF Access |

---

## Option A: Trust the Headers (Simplest)

For most internal apps, you can simply trust that Cloudflare validated the user. No JWT verification needed.

### Nginx Configuration

```nginx
location / {
    proxy_pass http://10.0.x.x:8080;
    proxy_set_header Cf-Access-Jwt-Assertion $http_cf_access_jwt_assertion;
    proxy_set_header Cf-Access-User-Email $http_cf_access_user_email;
    proxy_set_header Cf-Access-User-Name $http_cf_access_user_name;
}
```

### Express.js — Log the user

```javascript
app.use((req, res, next) => {
    const userEmail = req.headers['cf-access-user-email'];
    const jwt = req.headers['cf-access-jwt-assertion'];

    if (userEmail) {
        console.log(`Request from: ${userEmail}`);
        req.user = { email: userEmail };
    }
    next();
});
```

---

## Option B: Validate the JWT (Recommended for Sensitive Apps)

### Node.js — Full JWT Validation

```javascript
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

// CF Access public keys endpoint
const CF_ACCESS_PUBLIC_KEY_URL = 'https://zappro.cloudflareaccess.com/cdn-cgi/access/certs/public_key';

async function getSigningKey(header, callback) {
    const client = jwksClient({
        jwksUri: CF_ACCESS_PUBLIC_KEY_URL,
        cache: true,
        cacheMaxAge: 86400000 // 24 hours
    });

    client.getSigningKey(header.kid, (err, key) => {
        if (err) {
            callback(err);
            return;
        }
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
}

async function validateCFJWT(token, audience) {
    return new Promise((resolve, reject) => {
        jwt.verify(
            token,
            getSigningKey,
            {
                algorithms: ['RS256'],
                audience: audience,
            },
            (err, decoded) => {
                if (err) reject(err);
                else resolve(decoded);
            }
        );
    });
}

// Usage
app.use(async (req, res, next) => {
    const token = req.headers['cf-access-jwt-assertion'];

    if (!token) {
        return res.status(401).json({ error: 'No auth token' });
    }

    try {
        const user = await validateCFJWT(token, 'myapp.zappro.site');
        req.user = {
            email: user.email,
            sub: user.sub,
            name: user.name
        };
        next();
    } catch (err) {
        console.error('JWT validation failed:', err.message);
        return res.status(401).json({ error: 'Invalid token' });
    }
});
```

### JWT Payload Example

Decoded JWT contains:

```json
{
  "aud": "myapp.zappro.site",
  "iss": "https://zappro.cloudflareaccess.com",
  "sub": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "email": "user@zappro.site",
  "name": "User Name",
  "exp": 1713000000,
  "iat": 1712996400
}
```

---

## No Auth Code Needed

**What the app does NOT need:**
- No OAuth client ID/Secret
- No token exchange code
- No callback endpoint
- No Google OAuth SDK
- No session management for auth

**What the app DOES:**
- Optionally validate the JWT (Option B)
- Or simply read the email header (Option A)
- Handle authorization based on user identity

---

## Static Sites

For static sites behind Cloudflare Access, no app code changes needed. Cloudflare handles the auth and passes the request through with headers.

---

## Reverse Proxy (nginx)

```nginx
# Complete nginx config for CF Access passthrough
server {
    listen 80;
    server_name myapp.zappro.site;

    location / {
        # Verify CF Access cookie/token is present
        if ($http_cf_access_jwt_assertion = "") {
            return 403;
        }

        proxy_pass http://10.0.x.x:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Cf-Access-Jwt-Assertion $http_cf_access_jwt_assertion;
        proxy_set_header Cf-Access-User-Email $http_cf_access_user_email;
    }
}
```

---

## Security Notes

1. **Always use HTTPS** — Cloudflare Access requires HTTPS
2. **Validate audience** — Ensure JWT `aud` claim matches your domain
3. **Check expiration** — JWTs expire; CF handles refresh automatically
4. **No sensitive data in app** — Credentials stay in Cloudflare/Google

---

## Testing

```bash
# With valid token (from browser)
curl -sfI -H "Cf-Access-Jwt-Assertion: eyJ..." https://myapp.zappro.site/
# Should return: 200 OK

# Without token
curl -sfI https://myapp.zappro.site/
# Should return: 302 redirect to Google/CF login
```
