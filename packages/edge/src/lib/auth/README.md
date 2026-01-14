# Authentication and Authorization System

Comprehensive authentication and authorization system for ClaudeFlare built on Cloudflare Workers.

## Features

- **JWT Authentication** with RS256 (RSA signatures)
- **OAuth 2.0** providers (GitHub, Google)
- **API Key Management** with secure hashing
- **Role-Based Access Control (RBAC)**
- **Session Management** with Durable Objects
- **Rate Limiting** per user/organization
- **Multi-tenant Support** with organizations
- **CSRF Protection**
- **Security Best Practices**

## Installation

```typescript
import { Hono } from 'hono';
import {
  authentication,
  requireAuth,
  requireRole,
  requirePermission,
  rateLimitMiddleware,
  AuthRateLimiter,
} from './lib/auth';

const app = new Hono();
```

## User Roles

### Anonymous
- Read-only access
- Public endpoints only
- Strict rate limiting

### User
- Basic features
- Personal API keys
- Codebase upload
- Metrics access

### Pro
- Higher rate limits
- Priority routing
- Premium models
- Agent orchestration

### Admin
- Full system access
- User management
- Organization management
- All permissions

### Service Account
- API-only access
- Elevated permissions
- No UI access
- High rate limits

## Quick Start

### 1. Setup Environment Variables

```typescript
// wrangler.toml
[vars]
JWT_ISSUER = "claudeflare"
JWT_AUDIENCE = "claudeflare-api"
JWT_PUBLIC_KEY = "YOUR_PUBLIC_KEY"

[[kv_namespaces]]
binding = "KV_CACHE"
id = "your-kv-id"

[[durable_objects.bindings]]
name = "AUTH_SESSION_DO"
class_name = "AuthSessionDO"
```

### 2. Initialize Auth Components

```typescript
import { AuthRateLimiter } from './lib/auth';

// Create rate limiter
const rateLimiter = new AuthRateLimiter(env.KV_CACHE);
```

### 3. Apply Middleware

```typescript
import { authentication, requireAuth, requireRole } from './lib/auth';

// Apply auth middleware
app.use('*', authentication);

// Require authentication
app.use('/api/v1/*', requireAuth);

// Require specific role
app.use('/admin/*', requireRole('admin'));
```

### 4. Protect Routes

```typescript
import { requirePermission, getAuthContext } from './lib/auth';

// Require specific permission
app.post(
  '/api/v1/codebase',
  requirePermission('codebase', 'create'),
  async (c) => {
    // Handle request
    const authContext = getAuthContext(c);
    console.log('User:', authContext.userId);
  }
);
```

## JWT Authentication

### Generate Token Pair

```typescript
import { generateTokenPair } from './lib/auth';

const tokenPair = await generateTokenPair({
  userId: 'user-123',
  role: 'user',
  permissions: [
    { resource: 'chat', action: 'execute' },
    { resource: 'models', action: 'read' },
  ],
  sessionId: 'session-123',
  organizationId: 'org-123', // Optional
  config: jwtConfig,
});

// Returns:
// {
//   accessToken: string;
//   refreshToken: string;
//   expiresAt: number;
//   tokenType: 'Bearer';
// }
```

### Validate Token

```typescript
import { validateAccessToken } from './lib/auth';

const payload = await validateAccessToken(token, jwtConfig);

// Returns JWTPayload:
// {
//   sub: string;        // User ID
//   iss: string;        // Issuer
//   aud: string;        // Audience
//   iat: number;        // Issued at
//   exp: number;        // Expiration
//   jti: string;        // Token ID
//   role: UserRole;
//   orgId?: string;
//   sessionId: string;
//   type: 'access' | 'refresh';
//   permissions: Permission[];
// }
```

### Use in Requests

```bash
# Include JWT in Authorization header
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://api.example.com/v1/chat
```

## OAuth 2.0

### GitHub OAuth

```typescript
import { OAuthService } from './lib/auth';

const oauthService = new OAuthService({
  github: {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    redirectUri: 'https://api.example.com/auth/github/callback',
    scope: ['read:user', 'user:email'],
  },
});

// Get authorization URL
const { url, state } = oauthService.getAuthorizationUrl('github', redirectUri);

// Exchange code for profile
const profile = await oauthService.exchangeCode('github', code);
```

### Google OAuth

```typescript
const oauthService = new OAuthService({
  google: {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    redirectUri: 'https://api.example.com/auth/google/callback',
    scope: ['openid', 'email', 'profile'],
  },
});

// PKCE is automatically handled
const { url, state, codeVerifier } = oauthService.getAuthorizationUrl(
  'google',
  redirectUri
);

// Exchange code (with verifier)
const profile = await oauthService.exchangeCode('google', code, codeVerifier);
```

## API Keys

### Create API Key

```typescript
import { APIKeyManager } from './lib/auth';

const apiKeyManager = new APIKeyManager(env.KV_CACHE, env.DB);

const { apiKey, response } = await apiKeyManager.createAPIKey(
  {
    name: 'Production Key',
    description: 'Key for production API',
    keyType: 'personal',
    permissions: [
      { resource: 'chat', action: 'execute' },
      { resource: 'models', action: 'read' },
    ],
    rateLimit: {
      requestsPerMinute: 100,
      requestsPerDay: 10000,
    },
    scopes: ['chat', 'models'],
  },
  'user-123'
);

// Save the key - it won't be shown again!
console.log('API Key:', apiKey); // pk_123abc...
```

### Validate API Key

```typescript
const apiKey = await apiKeyManager.validateAPIKey(requestApiKey);

if (!apiKey) {
  return new Response('Invalid API key', { status: 401 });
}

// Use apiKey.userId, apiKey.permissions, etc.
```

### List API Keys

```typescript
const keys = await apiKeyManager.getUserAPIKeys('user-123');

// Returns array of APIKeyResponse (without actual keys)
```

### Revoke API Key

```typescript
await apiKeyManager.revokeAPIKey('key-id', 'user-123');
```

### Use in Requests

```bash
# Include API key in Authorization header
curl -H "Authorization: Key pk_123abc..." \
  https://api.example.com/v1/chat
```

## Role-Based Access Control (RBAC)

### Check Permissions

```typescript
import { hasPermission, AuthorizationService } from './lib/auth';

// Simple check
if (hasPermission(user.permissions, 'chat', 'execute')) {
  // Allow access
}

// Authorize in middleware
AuthorizationService.authorize(
  authContext,
  [{ resource: 'chat', action: 'execute' }],
  false // Require any (not all)
);
```

### Define Custom Permissions

```typescript
const customPermissions: Permission[] = [
  { resource: 'custom_resource', action: 'create' },
  { resource: 'custom_resource', action: 'read' },
  { resource: 'custom_resource', action: 'update' },
  { resource: 'custom_resource', action: 'delete' },
];

// Assign to user
user.permissions = [
  ...getRolePermissions(user.role),
  ...customPermissions,
];
```

### Organization-based Authorization

```typescript
import { OrganizationRBAC } from './lib/auth';

const member: OrganizationMember = {
  userId: 'user-123',
  organizationId: 'org-123',
  role: 'user',
  permissions: [],
  invitedBy: 'admin-123',
  invitedAt: Date.now(),
};

// Check if member can perform action
if (OrganizationRBAC.canPerformAction(member, 'codebase', 'create')) {
  // Allow
}

// Check if member can invite users
if (OrganizationRBAC.canInviteUsers(member)) {
  // Allow
}
```

## Session Management

### Create Session

```typescript
import { createAuthSession } from './lib/auth';

const session = await createAuthSession(env, {
  userId: 'user-123',
  organizationId: 'org-123',
  role: 'user',
  permissions: getUserPermissions(user),
  metadata: {
    ipAddress: request.headers.get('CF-Connecting-IP'),
    userAgent: request.headers.get('User-Agent'),
    location: 'San Francisco, CA',
    device: 'desktop',
  },
  expiresIn: 24 * 60 * 60 * 1000, // 24 hours
});
```

### Validate Session

```typescript
import { validateAuthSession } from './lib/auth';

const { valid, session } = await validateAuthSession(env, 'user-123', 'session-id');

if (!valid) {
  // Session invalid or expired
}
```

### Delete Session

```typescript
import { deleteAuthSession } from './lib/auth';

await deleteAuthSession(env, 'user-123', 'session-id');
```

### Rotate Refresh Token

```typescript
import { rotateAuthRefreshToken } from './lib/auth';

const result = await rotateAuthRefreshToken(env, 'user-123', 'refresh-token-id');

if (result) {
  // Use newRefreshTokenId and updated session
}
```

## Rate Limiting

### Configure Rate Limits

```typescript
import { AuthRateLimiter, DEFAULT_RATE_LIMITS } from './lib/auth';

const rateLimiter = new AuthRateLimiter(env.KV_CACHE, {
  roleLimits: {
    ...DEFAULT_RATE_LIMITS,
    // Custom limits for specific roles
    pro: {
      requestsPerMinute: 500,
      requestsPerHour: 20000,
      requestsPerDay: 200000,
      tokensPerDay: 2000000,
      concurrentRequests: 30,
    },
  },
  customLimits: [
    {
      organizationId: 'org-123',
      limits: {
        requestsPerMinute: 1000,
        requestsPerDay: 1000000,
      },
    },
  ],
  prefix: 'rate_limit',
});
```

### Apply Rate Limiting

```typescript
import { rateLimitMiddleware, rateLimitHeaders } from './lib/auth';

// Apply rate limiting
app.use('/api/v1/*', rateLimitMiddleware(rateLimiter));

// Add rate limit headers to response
app.use('/api/v1/*', rateLimitHeaders);
```

### Check Rate Limits

```typescript
// Get current rate limit status
const status = await rateLimiter.getRateLimitStatus('user-123', 'user');

// Returns:
// {
//   minute: { limit: number; remaining: number; resetAt: number };
//   hour: { limit: number; remaining: number; resetAt: number };
//   day: { limit: number; remaining: number; resetAt: number };
// }
```

### Reset Rate Limits

```typescript
// Reset specific window
await rateLimiter.resetRateLimit('user-123', 'hour');

// Reset all windows
await rateLimiter.resetAllRateLimits('user-123');
```

## Security Best Practices

### 1. Always Use HTTPS

```typescript
// Redirect to HTTPS in production
if (env.ENVIRONMENT === 'production' && !url.secure) {
  return redirect(`https://${url.host}${url.pathname}`);
}
```

### 2. Validate All Inputs

```typescript
import { AuthError } from './lib/auth';

try {
  // Validate token
  const payload = await validateAccessToken(token, jwtConfig);
} catch (error) {
  if (error instanceof AuthError) {
    // Handle specific error codes
    switch (error.code) {
      case 'INVALID_TOKEN':
        return new Response('Invalid token', { status: 401 });
      case 'EXPIRED_TOKEN':
        return new Response('Token expired', { status: 401 });
      case 'REVOKED_TOKEN':
        return new Response('Token revoked', { status: 401 });
    }
  }
}
```

### 3. Implement CSRF Protection

```typescript
import { csrfMiddleware, generateCSRFToken } from './lib/auth';

// Apply CSRF middleware
app.use('/api/v1/*', csrfMiddleware);

// Generate CSRF token
app.get('/api/v1/csrf-token', (c) => {
  const token = generateCSRFToken();
  c.set('csrfToken', token);
  return c.json({ token });
});
```

### 4. Add Security Headers

```typescript
import { securityHeaders } from './lib/auth';

// Apply security headers
app.use('*', securityHeaders);
```

### 5. Log Security Events

```typescript
import type { AuditLog } from './lib/auth';

const auditLog: AuditLog = {
  id: crypto.randomUUID(),
  eventType: 'AUTH_LOGIN',
  userId: 'user-123',
  sessionId: 'session-123',
  action: 'login',
  success: true,
  ipAddress: request.headers.get('CF-Connecting-IP'),
  userAgent: request.headers.get('User-Agent'),
  timestamp: Date.now(),
  metadata: {},
};

// Store in audit log
await env.DB.prepare('INSERT INTO audit_logs ...').run(auditLog);
```

## Multi-tenant Support

### Create Organization

```typescript
const organization: Organization = {
  id: 'org-123',
  name: 'Acme Corp',
  slug: 'acme-corp',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ownerId: 'user-123',
  memberCount: 1,
  settings: {
    maxMembers: 100,
    maxAPIKeys: 50,
    defaultRole: 'user',
    requireMFA: true,
  },
};
```

### Invite Member

```typescript
const member: OrganizationMember = {
  userId: 'user-456',
  organizationId: 'org-123',
  role: 'user',
  permissions: getRolePermissions('user'),
  invitedBy: 'user-123',
  invitedAt: Date.now(),
};
```

### Check Organization Access

```typescript
// User can access organization resources
if (authContext.organizationId === 'org-123') {
  // Allow access
}

// Admin can manage organization
if (AuthorizationService.canManageOrganization(authContext, 'org-123')) {
  // Allow management
}
```

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import { generateTokenPair, validateAccessToken } from './lib/auth';

describe('Authentication', () => {
  it('should generate and validate token', async () => {
    const tokenPair = await generateTokenPair({
      userId: 'user-123',
      role: 'user',
      permissions: [],
      sessionId: 'session-123',
      config: jwtConfig,
    });

    const payload = await validateAccessToken(tokenPair.accessToken, jwtConfig);

    expect(payload.sub).toBe('user-123');
    expect(payload.role).toBe('user');
  });
});
```

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `INVALID_CREDENTIALS` | Invalid credentials provided | 401 |
| `INVALID_TOKEN` | Token is invalid or malformed | 401 |
| `EXPIRED_TOKEN` | Token has expired | 401 |
| `REVOKED_TOKEN` | Token has been revoked | 401 |
| `INVALID_API_KEY` | API key is invalid | 401 |
| `REVOKED_API_KEY` | API key has been revoked | 401 |
| `EXPIRED_API_KEY` | API key has expired | 401 |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permission | 403 |
| `SESSION_NOT_FOUND` | Session not found | 404 |
| `SESSION_EXPIRED` | Session has expired | 401 |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded | 429 |
| `OAUTH_ERROR` | OAuth error occurred | 502 |
| `OAUTH_STATE_MISMATCH` | OAuth state mismatch | 401 |
| `MFA_REQUIRED` | Multi-factor auth required | 403 |
| `MFA_INVALID` | Invalid MFA code | 403 |
| `USER_NOT_FOUND` | User not found | 404 |
| `USER_DISABLED` | User account disabled | 403 |

## Performance Considerations

1. **Cache User Data**: Store frequently accessed user data in KV
2. **Lazy Loading**: Load permissions only when needed
3. **Batch Operations**: Batch database queries when possible
4. **Durable Objects**: Use DOs for session management
5. **Token Caching**: Cache validated tokens with TTL

## Deployment

1. **Generate RSA Keys**: Run once and store in secrets
2. **Configure KV/D1**: Setup KV namespace and D1 database
3. **Setup Durable Objects**: Deploy AuthSessionDO
4. **Configure OAuth**: Set up OAuth apps in GitHub/Google
5. **Update wrangler.toml**: Add all bindings

## License

MIT

## Support

For issues and questions, please open a GitHub issue.
