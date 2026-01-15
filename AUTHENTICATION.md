# ClaudeFlare Authentication Guide

## Overview
ClaudeFlare uses a tiered authentication system that provides both enterprise-grade security and easy public access for testing.

## Authentication Methods

### 1. Demo Authentication (Recommended for Testing)
Easy way to access all endpoints for demonstration purposes.

**Endpoint:** `POST /api/v1/demo-auth`

**Response Example:**
```json
{
  "success": true,
  "message": "Demo authentication successful",
  "auth": {
    "userId": "demo-user-id",
    "userEmail": "demo@claudeflare.com",
    "userRole": "developer",
    "permissions": ["read", "write", "demo"]
  },
  "token": "demo_token_jmqzsm",
  "usage": "Use this token in Authorization header as \"Bearer demo_token_...\" for API access"
}
```

### 2. Real User Authentication
Full authentication with JWT tokens for production use.

**Login Endpoint:** `POST /api/v1/auth/login`
```json
{
  "email": "admin@claudeflare.com",
  "password": "password"
}
```

**Demo Users:**
- Admin: `admin@claudeflare.com` / `password`
- Developer: `developer@claudeflare.com` / `password`

## Using Authentication

### Demo Flow
1. Get a demo token: `POST /api/v1/demo-auth`
2. Use the token in Authorization header: `Authorization: Bearer demo_token_...`

### Production Flow
1. Login to get JWT tokens: `POST /api/v1/auth/login`
2. Use the access token: `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## Protected Endpoints

All endpoints under `/api/v1/` (except public ones) require authentication:

### Require Authentication
- `POST /api/v1/code-review`
- `POST /api/v1/code-review/:filePath`
- `POST /api/v1/security-test`
- `POST /api/v1/security-test/quick`
- `POST /api/v1/security-test/status/:scanId`
- `GET /api/v1/security-test/vulnerability/:ecosystem/:package/:version`
- All testing endpoints under `/api/v1/testing/*`

### Public Endpoints (No Auth Required)
- `GET /health`
- `GET /version`
- `GET /metrics`

## Authentication Error Responses

### Missing Authentication
```json
{
  "success": false,
  "error": "Authentication required"
}
```

### Invalid Authentication
```json
{
  "success": false,
  "error": "Authentication failed"
}
```

## Usage Examples

### Code Review with Demo Auth
```bash
# Get demo token
curl -X POST https://claudeflare-dev.casey-digennaro.workers.dev/api/v1/demo-auth

# Use token for code review
curl -X POST https://claudeflare-dev.casey-digennaro.workers.dev/api/v1/code-review \
  -H "Authorization: Bearer demo_token_jmqzsm" \
  -H "Content-Type: application/json" \
  -d '{"content":"function test() { return true; }"}'
```

### Security Scan with Real Auth
```bash
# Login
curl -X POST https://claudeflare-dev.casey-digennaro.workers.dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@claudeflare.com","password":"password"}'

# Use JWT token
curl -X POST https://claudeflare-dev.casey-digennaro.workers.dev/api/v1/security-test \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"target":"https://example.com"}'
```

## Security Features

- JWT-based authentication with configurable expiry
- Role-based access control (admin, developer, user)
- Permission-based authorization
- API key support
- Session management
- Login attempt tracking with brute force protection
- MFA support ready

## Environment Configuration

- **Development**: Demo mode enabled, relaxed security
- **Production**: Full authentication, strict security checks
- **Environment**: Available via `ENVIRONMENT` binding

## Best Practices

1. **For Testing**: Use demo authentication for quick access
2. **For Production**: Implement proper JWT validation and refresh tokens
3. **For Security**: Enable MFA and configure appropriate role permissions
4. **For Monitoring**: Review authentication logs in server logs