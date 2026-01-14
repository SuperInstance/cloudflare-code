# ClaudeFlare v1.0 Migration Guide

This guide helps you migrate from ClaudeFlare v0.x to v1.0.0.

## Overview

Version 1.0.0 introduces several breaking changes designed to improve security, performance, and developer experience. This guide will walk you through the migration process step by step.

## Pre-Migration Checklist

- [ ] Backup your current deployment
- [ ] Review breaking changes
- [ ] Test in staging environment
- [ ] Plan for downtime (if any)
- [ ] Notify users of upcoming changes

## Breaking Changes

### 1. API Endpoint Changes

#### Old (v0.x)
```typescript
// Old endpoints
GET /api/agents
POST /api/sessions
WS /ws
```

#### New (v1.0)
```typescript
// New endpoints with version prefix
GET /api/v1/agents
POST /api/v1/sessions
WS /api/v1/ws
```

**Migration:** Update all API calls to include `/api/v1/` prefix.

### 2. Authentication Changes

#### API Keys Deprecated

```typescript
// OLD - No longer supported
const response = await fetch('https://api.claudeflare.dev/agents', {
  headers: {
    'X-API-Key': 'your-api-key'
  }
});
```

#### OAuth 2.0 Required

```typescript
// NEW - OAuth 2.0 JWT tokens
const response = await fetch('https://api.claudeflare.dev/api/v1/agents', {
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
});
```

**Migration Steps:**

1. Create OAuth 2.0 application
2. Update authentication flow
3. Replace API keys with JWT tokens
4. Update all API calls

### 3. Environment Variable Changes

#### Renamed Variables

```bash
# OLD
CLOUDFLARE_API_KEY
DATABASE_URL
CACHE_BUCKET

# NEW
CLOUDFLARE_API_TOKEN
D1_DATABASE_URL
R2_BUCKET_NAME
```

#### New Required Variables

```bash
# OAuth Configuration
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_REDIRECT_URI=https://your-app.com/auth/callback

# LLM Provider Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=your-google-key
```

**Migration:** Update your `.env` file with new variable names and add new required variables.

### 4. Database Schema Changes

#### Sessions Table

```sql
-- OLD
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT,
  created_at TIMESTAMP
);

-- NEW
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active',
  metadata TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Migration Steps:**

1. Backup existing data
2. Run migration script
3. Verify data integrity
4. Update application code

### 5. Storage Changes

#### R2 Bucket Naming

```bash
# OLD format
claudeflare-cache

# NEW format
claudeflare-v1-{environment}-cache
# Example: claudeflare-v1-production-cache
```

**Migration:** Create new R2 buckets with updated naming and migrate data.

## Step-by-Step Migration

### Phase 1: Preparation (1-2 days)

#### 1.1 Backup Current Deployment

```bash
# Backup configuration
cp .env .env.backup

# Backup database
npm run db:backup

# Backup R2 storage
npm run storage:backup

# Backup KV namespace
npm run kv:backup
```

#### 1.2 Review Dependencies

```bash
# Update package.json
npm update

# Check for breaking changes in dependencies
npm outdated
```

#### 1.3 Update Configuration

```bash
# Copy new environment template
cp .env.v1.example .env

# Update with your values
nano .env
```

### Phase 2: Code Updates (2-3 days)

#### 2.1 Update API Calls

```typescript
// Create a migration helper
class ApiClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace('/api/', '/api/v1/');
    this.token = token;
  }

  async request(endpoint: string, options?: RequestInit) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }
}

// Use the new client
const api = new ApiClient(
  'https://api.claudeflare.dev',
  'your-jwt-token'
);

const agents = await api.request('/agents');
```

#### 2.2 Update WebSocket Connection

```typescript
// OLD
const ws = new WebSocket('wss://api.claudeflare.dev/ws');

// NEW
const ws = new WebSocket('wss://api.claudeflare.dev/api/v1/ws', {
  headers: {
    'Authorization': 'Bearer your-jwt-token'
  }
});
```

#### 2.3 Update Authentication Flow

```typescript
// Implement OAuth 2.0 flow
async function authenticate() {
  // 1. Redirect to authorization page
  const authUrl = `https://auth.claudeflare.dev/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code`;

  // 2. Handle callback
  const code = new URLSearchParams(window.location.search).get('code');

  // 3. Exchange code for token
  const tokenResponse = await fetch('https://auth.claudeflare.dev/token', {
    method: 'POST',
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const { access_token } = await tokenResponse.json();

  // 4. Store token securely
  localStorage.setItem('access_token', access_token);

  return access_token;
}
```

### Phase 3: Database Migration (1 day)

#### 3.1 Run Migration Script

```bash
# Create migration
npm run db:migrate:create migration_v1_0

# Run migration
npm run db:migrate:up

# Verify migration
npm run db:migrate:status
```

#### 3.2 Verify Data Integrity

```bash
# Check table structure
npm run db:schema:diff

# Verify row counts
npm run db:verify

# Run data validation
npm run db:validate
```

### Phase 4: Testing (1-2 days)

#### 4.1 Unit Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Verify coverage >80%
npm run test:coverage-check
```

#### 4.2 Integration Tests

```bash
# Run integration tests
npm run test:integration
```

#### 4.3 Smoke Tests

```bash
# Run smoke tests against staging
TEST_URL=https://staging.claudeflare.dev npm run test:smoke
```

### Phase 5: Staging Deployment (1 day)

#### 5.1 Deploy to Staging

```bash
# Deploy to staging
npm run deploy:staging

# Verify deployment
npm run verify:staging
```

#### 5.2 Staging Validation

```bash
# Run smoke tests
npm run test:smoke

# Run canary validation
npm run test:canary

# Load testing
npm run test:load
```

### Phase 6: Production Deployment (1 day)

#### 6.1 Canary Deployment

```bash
# Start canary at 10%
npm run progressive:canary -- --percentage 10

# Monitor metrics
npm run metrics:collect

# Check error rates
npm run metrics:report
```

#### 6.2 Gradual Rollout

```bash
# Increase to 25%
npm run progressive:canary -- --percentage 25

# Increase to 50%
npm run progressive:canary -- --percentage 50

# Increase to 100%
npm run progressive:canary -- --percentage 100
```

#### 6.3 Final Verification

```bash
# Run production smoke tests
TEST_URL=https://claudeflare.dev npm run test:smoke

# Verify health endpoints
npm run health-check:production

# Check metrics
npm run metrics:report
```

## Rollback Plan

If issues arise during migration:

### Immediate Rollback

```bash
# Rollback to previous version
npm run rollback:production

# Verify rollback
npm run verify:production
```

### Database Rollback

```bash
# Rollback migrations
npm run db:migrate:down

# Restore from backup
npm run db:restore
```

### Data Validation

```bash
# Verify data integrity
npm run db:verify

# Compare data checksums
npm run db:checksum
```

## Post-Migration Tasks

### 1. Monitor Metrics

- Error rates
- Latency percentiles
- Cache hit rates
- Resource utilization

### 2. Update Documentation

- API documentation
- User guides
- Developer docs
- Architecture diagrams

### 3. User Communication

- Announce new features
- Document breaking changes
- Provide migration support
- Collect feedback

### 4. Performance Tuning

- Adjust cache sizes
- Optimize database queries
- Tune rate limits
- Configure auto-scaling

## Troubleshooting

### Common Issues

#### Issue: Authentication Failures

**Solution:**
1. Verify JWT token is valid
2. Check OAuth client credentials
3. Ensure token hasn't expired
4. Verify token format

#### Issue: API 404 Errors

**Solution:**
1. Check URL includes `/api/v1/` prefix
2. Verify endpoint exists in v1.0
3. Check routing configuration
4. Review API documentation

#### Issue: Database Connection Errors

**Solution:**
1. Verify `D1_DATABASE_URL` is correct
2. Check database credentials
3. Ensure D1 database is provisioned
4. Verify network connectivity

#### Issue: High Latency After Migration

**Solution:**
1. Check cache configuration
2. Verify database indexes
3. Monitor cold starts
4. Review resource allocation

## Support

If you encounter issues during migration:

1. Check [GitHub Issues](https://github.com/your-org/claudeflare/issues)
2. Join our [Discord server](https://discord.gg/claudeflare)
3. Contact support at migration@claudeflare.dev
4. Review [troubleshooting docs](../docs/troubleshooting.md)

## Checklist

### Pre-Migration
- [ ] Backup all data
- [ ] Review breaking changes
- [ ] Update dependencies
- [ ] Plan testing strategy

### Code Updates
- [ ] Update API endpoints
- [ ] Implement OAuth 2.0
- [ ] Update WebSocket connections
- [ ] Modify environment variables
- [ ] Update database queries

### Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Smoke tests pass
- [ ] Performance tests pass
- [ ] Security tests pass

### Deployment
- [ ] Staging deployment successful
- [ ] Canary deployment successful
- [ ] Production deployment successful
- [ ] Health checks passing
- [ ] Metrics within SLA

### Post-Migration
- [ ] Monitoring configured
- [ ] Documentation updated
- [ ] Users notified
- [ ] Support team trained
- [ ] Feedback collected

---

**Migration completed successfully! Welcome to ClaudeFlare v1.0.0! 🎉**
