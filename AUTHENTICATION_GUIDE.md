# ClaudeFlare Enterprise Authentication System

## Overview

The ClaudeFlare platform now includes a comprehensive enterprise authentication system built on top of the security-core package. This system provides secure authentication with multiple methods, session management, API key support, and role-based access control.

## Features

- **Multiple Authentication Methods**:
  - Username/password authentication
  - OAuth 2.0 integration (GitHub, Google, etc.)
  - SAML 2.0 integration (Okta, Azure AD, etc.)
  - Multi-Factor Authentication (MFA)
  - API key authentication

- **Security Features**:
  - JWT token-based authentication
  - Session management with timeout
  - Role-based access control (RBAC)
  - Permission-based access control
  - Account lockout after failed attempts
  - Secure password hashing with bcrypt

- **Enterprise Features**:
  - Audit logging
  - API key management
  - Session management
  - Password reset functionality
  - Configurable auth providers

## Authentication Endpoints

### Base URL: `/api/v1/auth`

#### Authentication Flow

1. **Login**
   ```bash
   POST /api/v1/auth/login
   Content-Type: application/json

   {
     "email": "user@example.com",
     "password": "password123",
     "rememberMe": false
   }
   ```

2. **Registration**
   ```bash
   POST /api/v1/auth/register
   Content-Type: application/json

   {
     "username": "newuser",
     "email": "user@example.com",
     "password": "password123",
     "firstName": "John",
     "lastName": "Doe"
   }
   ```

3. **Logout**
   ```bash
   POST /api/v1/auth/logout
   Authorization: Bearer <token>
   ```

#### MFA (Multi-Factor Authentication)

1. **Setup MFA**
   ```bash
   POST /api/v1/auth/mfa/setup
   Authorization: Bearer <token>
   Content-Type: application/json

   {
     "method": "totp"
   }
   ```

2. **Verify MFA**
   ```bash
   POST /api/v1/auth/mfa/verify
   Content-Type: application/json

   {
     "userId": "user123",
     "code": "123456"
   }
   ```

#### OAuth 2.0 Integration

1. **Get Authorization URL**
   ```bash
   GET /api/v1/auth/oauth2/github/authorize
   ```

2. **Handle Callback**
   ```bash
   POST /api/v1/auth/oauth2/github/callback
   Content-Type: application/json

   {
     "code": "authorization_code",
     "state": "state_string"
   }
   ```

#### SAML 2.0 Integration

1. **Get Authorization URL**
   ```bash
   GET /api/v1/auth/saml2/okta/authorize
   ```

2. **Handle Callback**
   ```bash
   POST /api/v1/auth/saml2/okta/callback
   Content-Type: application/json

   {
     "assertion": "<saml:Assertion>...</saml:Assertion>"
   }
   ```

#### API Key Management

1. **Create API Key**
   ```bash
   POST /api/v1/auth/api-keys
   Authorization: Bearer <token>
   Content-Type: application/json

   {
     "name": "My API Key",
     "permissions": ["read", "write"]
   }
   ```

2. **List API Keys**
   ```bash
   GET /api/v1/auth/api-keys
   Authorization: Bearer <token>
   ```

3. **Revoke API Key**
   ```bash
   DELETE /api/v1/auth/api-keys/{apiKey}
   Authorization: Bearer <token>
   ```

#### Session Management

1. **Get Current Session**
   ```bash
   GET /api/v1/auth/session
   Authorization: Bearer <token>
   X-Session-ID: {sessionId}
   ```

2. **Terminate Session**
   ```bash
   DELETE /api/v1/auth/session
   Authorization: Bearer <token>
   X-Session-ID: {sessionId}
   ```

#### User Profile

1. **Get Profile**
   ```bash
   GET /api/v1/auth/profile
   Authorization: Bearer <token>
   ```

## Protecting Endpoints

The system provides middleware to protect your valuable endpoints:

### Basic Authentication

```typescript
// Require authentication
router.post('/protected-endpoint', authMiddleware({ requireAuth: true }), async (c) => {
  // Protected endpoint logic
});
```

### Role-Based Access Control

```typescript
// Require specific role
router.post('/admin-endpoint', authMiddleware({
  requireAuth: true,
  requiredRoles: ['admin']
}), async (c) => {
  // Admin-only endpoint logic
});
```

### Permission-Based Access Control

```typescript
// Require specific permissions
router.post('/write-endpoint', authMiddleware({
  requireAuth: true,
  requiredPermissions: ['write']
}), async (c) => {
  // Write permission required
});
```

### API Key Authentication

```typescript
// Allow API key authentication
router.post('/api-endpoint', authMiddleware({
  requireAuth: true,
  allowApiKey: true
}), async (c) => {
  // Can be accessed with either token or API key
});
```

## Authentication Methods

### JWT Tokens

Use the `Authorization` header with a Bearer token:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### API Keys

Use the `X-API-Key` header:

```bash
X-API-Key: cf_your_api_key_here
```

### Session IDs

Use the `X-Session-ID` header:

```bash
X-Session-ID: session123
```

## Configuration

### Environment Variables

```bash
# Authentication Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_ALGORITHM=HS256
JWT_EXPIRY=3600
REFRESH_TOKEN_EXPIRY=86400
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=15
MFA_REQUIRED=false

# OAuth 2.0 Providers
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# SAML 2.0 Providers
OKTA_ENTITY_ID=your-okta-entity-id
OKTA_ASSERTION_CONSUMER_URL=your-okta-acs-url
```

### Auth Configuration

```typescript
const authConfig = {
  jwtSecret: 'your-secret-key-change-in-production',
  jwtAlgorithm: 'HS256',
  jwtExpiry: 3600, // 1 hour
  refreshTokenExpiry: 86400, // 24 hours
  maxLoginAttempts: 5,
  lockoutDuration: 15, // minutes
  mfaRequired: false,
  allowedProviders: [
    {
      name: 'github',
      type: 'oauth2',
      enabled: true,
      config: {
        clientId: 'your-github-client-id',
        clientSecret: 'your-github-client-secret',
        redirectUri: 'https://your-domain.com/api/v1/auth/oauth2/github/callback'
      }
    },
    {
      name: 'okta',
      type: 'saml2',
      enabled: false,
      config: {
        entityId: 'your-entity-id',
        assertionConsumerServiceUrl: 'https://your-domain.com/api/v1/auth/saml2/okta/callback'
      }
    }
  ],
  sessionTimeout: 3600, // 1 hour
  cookieSecure: false,
  cookieSameSite: 'lax'
};
```

## User Roles and Permissions

### Default Roles

- **admin**: Full access to all features
- **developer**: Access to code review and security testing
- **user**: Basic read access

### Permissions

- **read**: Read access to resources
- **write**: Write access to resources
- **delete**: Delete access to resources
- **admin**: Administrative access

## Security Best Practices

1. **Change Default Secrets**: Always change the default JWT secret in production
2. **Use HTTPS**: Ensure all authentication traffic is over HTTPS
3. **Implement Rate Limiting**: Add rate limiting to authentication endpoints
4. **Monitor Failed Login Attempts**: Set up alerts for suspicious activity
5. **Use Strong Passwords**: Enforce strong password policies
6. **Enable MFA**: Enable multi-factor authentication for enhanced security
7. **Regular Key Rotation**: Rotate API keys and secrets regularly
8. **Audit Logs**: Keep comprehensive audit logs of all authentication events

## Demo Users

The system includes demo users for testing:

- **Admin**: admin@claudeflare.com / admin123!
- **Developer**: developer@claudeflare.com / dev456!

## Error Handling

Authentication errors return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `INVALID_CREDENTIALS`: Invalid username or password
- `INVALID_TOKEN`: Invalid or expired token
- `INSUFFICIENT_PERMISSIONS`: Missing required permissions
- `ACCOUNT_LOCKED`: Account locked due to too many failed attempts
- `MFA_REQUIRED`: Multi-factor authentication required

## Integration Example

```typescript
import { EnterpriseAuthService } from './services/auth-service';
import { createAuthMiddleware } from './middleware/auth-middleware';

// Initialize authentication service
const authService = new EnterpriseAuthService(authConfig);
const authMiddleware = createAuthMiddleware(authService);

// Protect valuable endpoints
router.post('/code-review', authMiddleware({ requireAuth: true }), async (c) => {
  const result = await codeReviewService.reviewCode(request);
  return c.json(result);
});

// Require specific permissions
router.post('/security-test', authMiddleware({
  requireAuth: true,
  requiredPermissions: ['write']
}), async (c) => {
  const result = await securityTestingService.performSecurityScan(request);
  return c.json(result);
});
```

## Testing

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Register a new user**:
   ```bash
   curl -X POST http://localhost:8787/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"testuser","email":"test@example.com","password":"test123!","firstName":"Test","lastName":"User"}'
   ```

3. **Login**:
   ```bash
   curl -X POST http://localhost:8787/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test123!"}'
   ```

4. **Access protected endpoint**:
   ```bash
   curl -X POST http://localhost:8787/api/v1/code-review \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"content":"console.log(\"Hello World\");"}'
   ```

## Deployment

1. **Configure Environment Variables**:
   - Set up all required environment variables
   - Use strong secrets in production
   - Configure OAuth/SAML providers

2. **Update CORS Settings**:
   - Configure appropriate CORS origins for your domain
   - Restrict access to trusted domains

3. **Enable SSL/TLS**:
   - Use Cloudflare's automatic HTTPS
   - Configure secure cookies

4. **Set Up Monitoring**:
   - Monitor authentication failures
   - Set up alerts for suspicious activity
   - Track authentication metrics

## Troubleshooting

### Common Issues

1. **Invalid Token Errors**:
   - Check JWT secret configuration
   - Verify token expiry settings
   - Ensure proper token format

2. **Permission Denied Errors**:
   - Check user role assignments
   - Verify permission requirements
   - Review API key permissions

3. **OAuth/SAML Issues**:
   - Verify provider configuration
   - Check redirect URIs
   - Validate certificate settings

4. **MFA Issues**:
   - Ensure MFA is properly set up
   - Check TOTP application configuration
   - Verify SMS/Email delivery

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
const authConfig = {
  // ... other config
  debug: process.env.NODE_ENV === 'development'
};
```

## Support

For issues and questions:
- Check the troubleshooting section
- Review the error codes and messages
- Enable debug logging for detailed information
- Consult the security-core package documentation