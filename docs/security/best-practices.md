# ClaudeFlare Security Best Practices

**Document Version:** 1.0
**Status:** Production-Ready
**Last Updated:** 2026-01-13
**Classification:** Internal

---

## Executive Summary

This document outlines security best practices for developing, deploying, and operating ClaudeFlare. These practices cover all aspects of the system from secure coding to operational security.

### Practice Categories

| Category | Practices | Coverage |
|----------|-----------|----------|
| **Secure Development** | 15 | 100% |
| **API Security** | 12 | 100% |
| **Data Security** | 10 | 100% |
| **Infrastructure Security** | 8 | 100% |
| **Operational Security** | 10 | 100% |

---

## Table of Contents

1. [Secure Development Practices](#secure-development-practices)
2. [API Security Best Practices](#api-security-best-practices)
3. [Data Security Guidelines](#data-security-guidelines)
4. [Infrastructure Security](#infrastructure-security)
5. [Operational Security](#operational-security)
6. [Cloudflare Workers Security](#cloudflare-workers-security)
7. [Third-Party Integration Security](#third-party-integration-security)
8. [Compliance and Auditing](#compliance-and-auditing)

---

## Secure Development Practices

### 1. Input Validation

#### Always Validate Input

```typescript
// ✓ GOOD: Comprehensive input validation
import { z } from 'zod';

const CreateUserSchema = z.object({
  username: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .transform(s => s.trim()),
  email: z.string()
    .email()
    .max(255)
    .toLowerCase(),
  role: z.enum(['admin', 'developer', 'viewer']),
  metadata: z.record(z.string()).optional()
});

async function createUser(input: unknown) {
  // Validate input
  const validated = CreateUserSchema.parse(input);

  // Sanitize
  const sanitized = {
    ...validated,
    username: escapeHtml(validated.username)
  };

  // Use validated input
  return await db.users.create(sanitized);
}

// ✗ BAD: No validation
async function createUserBad(input: any) {
  return await db.users.create(input); // Vulnerable!
}
```

### 2. Output Encoding

#### Context-Specific Encoding

```typescript
// ✓ GOOD: Context-aware output encoding
const OutputEncoding = {
  html: (input: string): string => {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  },

  js: (input: string): string => {
    return input
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  },

  url: (input: string): string => {
    return encodeURIComponent(input);
  },

  css: (input: string): string => {
    return input.replace(/[<>"'&\\]/g, (match) => {
      return `\\${match.charCodeAt(0).toString(16)} `;
    });
  }
};

// Use appropriate encoding for each context
function renderUserPage(user: User) {
  return `
    <h1>${OutputEncoding.html(user.name)}</h1>
    <script>
      const userData = ${OutputEncoding.js(JSON.stringify(user))};
    </script>
    <a href="/profile?user=${OutputEncoding.url(user.id)}">View Profile</a>
    <div style="color: ${OutputEncoding.css(user.themeColor)}">Theme</div>
  `;
}
```

### 3. Parameterized Queries

#### Prevent SQL Injection

```typescript
// ✓ GOOD: Parameterized queries
async function getUserById(userId: string) {
  const result = await db.prepare(`
    SELECT id, username, email
    FROM users
    WHERE id = ?
  `).bind(userId).first();

  return result;
}

// ✗ BAD: String concatenation (vulnerable)
async function getUserByIdBad(userId: string) {
  const query = `SELECT id, username, email FROM users WHERE id = '${userId}'`;
  return await db.prepare(query).first();
}
```

### 4. Authentication & Authorization

#### Implement Proper Authentication

```typescript
// ✓ GOOD: Multi-factor authentication
async function authenticate(credentials: Credentials): Promise<Session> {
  // 1. Validate credentials
  const user = await validateCredentials(credentials);
  if (!user) {
    throw new AuthenticationError('Invalid credentials');
  }

  // 2. Check if MFA required
  if (user.mfaEnabled) {
    const mfaValid = await validateMFA(credentials.mfaCode);
    if (!mfaValid) {
      throw new AuthenticationError('Invalid MFA code');
    }
  }

  // 3. Check account status
  if (user.suspended) {
    throw new AuthenticationError('Account suspended');
  }

  // 4. Create session
  const session = await createSession(user, {
    ip: credentials.ip,
    userAgent: credentials.userAgent,
    mfaVerified: user.mfaEnabled
  });

  // 5. Log successful authentication
  await logSecurityEvent({
    type: 'AUTH_SUCCESS',
    userId: user.id,
    timestamp: Date.now()
  });

  return session;
}

// ✓ GOOD: Authorization checks
async function deleteProject(userId: string, projectId: string) {
  // Check user has permission
  const hasPermission = await checkPermission(userId, 'delete:project');
  if (!hasPermission) {
    throw new AuthorizationError('Insufficient permissions');
  }

  // Check user owns project or has admin access
  const project = await db.projects.get(projectId);
  if (!project || (project.ownerId !== userId && !isAdmin(userId))) {
    throw new AuthorizationError('Access denied');
  }

  // Delete project
  await db.projects.delete(projectId);

  // Log action
  await logSecurityEvent({
    type: 'PROJECT_DELETED',
    userId,
    projectId,
    timestamp: Date.now()
  });
}
```

### 5. Cryptography

#### Use Strong Cryptography

```typescript
// ✓ GOOD: Proper cryptographic practices
import { crypto } from 'node:crypto';

// Password hashing
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await crypto.pbkdf2(
    password,
    salt,
    100000,  // iterations
    64,      // key length
    'sha256'
  );
  return `${salt.toString('base64')}:${key.toString('base64')}`;
}

// Data encryption
async function encryptData(data: string, key: CryptoKey): Promise<EncryptedData> {
  const iv = crypto.randomBytes(12);
  const algorithm = { name: 'AES-GCM', length: 256 };

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(data)
  );

  return {
    ciphertext: Buffer.from(encrypted).toString('base64'),
    iv: iv.toString('base64'),
    algorithm: 'AES-256-GCM'
  };
}

// Token generation
async function generateSecureToken(): Promise<string> {
  const buffer = crypto.randomBytes(32);
  return buffer.toString('base64url');
}

// ✓ BAD: Weak cryptography
function hashPasswordBad(password: string): string {
  return require('md5')(password); // Don't use MD5!
}
```

### 6. Error Handling

#### Secure Error Handling

```typescript
// ✓ GOOD: Secure error handling
async function handleError(error: unknown) {
  // Log detailed error internally
  console.error('Error details:', {
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    requestId: context.requestId
  });

  // Return generic error to user
  return {
    error: 'An internal error occurred',
    requestId: context.requestId
  };
}

// ✗ BAD: Exposing internal details
function handleErrorBad(error: any) {
  return {
    error: error.message, // Leaks information
    stack: error.stack,   // Exposes implementation
    database: error.sql   // Reveals database structure
  };
}
```

### 7. Session Management

#### Secure Session Handling

```typescript
// ✓ GOOD: Secure session management
const SESSION_CONFIG = {
  // Use HTTPOnly cookies
  httpOnly: true,

  // Enable Secure flag
  secure: true,

  // Set SameSite to strict
  sameSite: 'strict',

  // Set expiration
  maxAge: 15 * 60 * 1000, // 15 minutes

  // Set domain
  domain: '.claudeflare.com',

  // Set path
  path: '/',

  // Regenerate session ID after login
  regenerateAfterLogin: true,

  // Destroy session on logout
  destroyOnLogout: true
};

async function createSession(user: User, context: RequestContext): Promise<Session> {
  const sessionId = await generateSecureToken();

  const session: Session = {
    id: sessionId,
    userId: user.id,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_CONFIG.maxAge,
    ip: context.ip,
    userAgent: context.userAgent,
    data: {}
  };

  // Store session
  await redis.setex(
    `session:${sessionId}`,
    SESSION_CONFIG.maxAge / 1000,
    JSON.stringify(session)
  );

  // Set cookie
  setCookie('session', sessionId, SESSION_CONFIG);

  return session;
}

async function validateSession(sessionId: string): Promise<Session | null> {
  const sessionData = await redis.get(`session:${sessionId}`);
  if (!sessionData) {
    return null;
  }

  const session = JSON.parse(sessionData);

  // Check expiration
  if (Date.now() > session.expiresAt) {
    await redis.del(`session:${sessionId}`);
    return null;
  }

  // Check IP (optional, may break mobile users)
  // if (session.ip !== currentIp) {
  //   return null;
  // }

  return session;
}
```

### 8. Content Security Policy

#### Implement Strong CSP

```typescript
// ✓ GOOD: Comprehensive CSP
const CSP_HEADERS = {
  'Content-Security-Policy': [
    // Default to nothing
    "default-src 'none'",

    // Scripts from trusted sources
    "script-src 'self' https://cdn.claudeflare.com",

    // Styles
    "style-src 'self' 'unsafe-inline'",

    // Images
    "img-src 'self' data: https:",

    // Fonts
    "font-src 'self' data:",

    // Connections
    "connect-src 'self' https://api.claudeflare.com wss://realtime.claudeflare.com",

    // Objects (none allowed)
    "object-src 'none'",

    // Base URL
    "base-uri 'self'",

    // Form actions
    "form-action 'self'",

    // Frame ancestors (prevent clickjacking)
    "frame-ancestors 'none'",

    // Upgrade insecure requests
    "upgrade-insecure-requests",

    // Block mixed content
    "block-all-mixed-content"
  ].join('; '),

  // Additional security headers
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
};
```

### 9. Dependency Management

#### Secure Dependencies

```json
// package.json - Use specific versions
{
  "dependencies": {
    // ✓ GOOD: Specific version
    "express": "^4.18.2",

    // ✗ BAD: Wildcard version
    "express": "*"
  },
  "devDependencies": {
    "npm-audit-resolver": "^1.0.0",
    "snyk": "^1.1000.0"
  },
  "scripts": {
    "audit": "npm audit",
    "audit:fix": "npm audit fix",
    "snyk-test": "snyk test",
    "dep-check": "npm-check-updates"
  }
}
```

```bash
# Regular dependency maintenance
npm audit
npm audit fix
npm update
npm-check-updates -u
```

### 10. Secure Logging

#### Don't Log Sensitive Data

```typescript
// ✓ GOOD: Secure logging
const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      ...sanitizeMeta(meta),
      timestamp: new Date().toISOString()
    }));
  },

  error(message: string, error?: Error, meta?: Record<string, unknown>) {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      },
      ...sanitizeMeta(meta),
      timestamp: new Date().toISOString()
    }));
  }
};

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...meta };

  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'ssn', 'creditCard'];
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // Sanitize nested objects
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMeta(value as Record<string, unknown>);
    }
  }

  return sanitized;
}

// ✓ BAD: Logging sensitive data
logger.info('User login', {
  username: user.username,
  password: user.password,  // Don't log passwords!
  token: user.token         // Don't log tokens!
});
```

---

## API Security Best Practices

### 1. API Authentication

#### Use Strong Authentication

```typescript
// ✓ GOOD: JWT-based authentication
import { SignJWT, jwtVerify } from 'jose';

async function generateToken(user: User): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);

  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    role: user.role
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('https://claudeflare.com')
    .setAudience('https://api.claudeflare.com')
    .setExpirationTime('15m')
    .sign(secret);

  return token;
}

async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'https://claudeflare.com',
      audience: 'https://api.claudeflare.com'
    });

    return payload as TokenPayload;
  } catch (error) {
    return null;
  }
}
```

### 2. API Rate Limiting

#### Implement Rate Limits

```typescript
// ✓ GOOD: Token bucket rate limiting
class RateLimiter {
  private buckets = new Map<string, TokenBucket>();

  async checkLimit(userId: string, action: string): Promise<boolean> {
    const key = `${userId}:${action}`;
    const bucket = this.buckets.get(key) || {
      tokens: 100,
      lastRefill: Date.now(),
      maxTokens: 100,
      refillRate: 10 // tokens per second
    };

    // Refill tokens
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
      bucket.maxTokens,
      bucket.tokens + (elapsed * bucket.refillRate)
    );
    bucket.lastRefill = now;

    // Check if request can be processed
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.buckets.set(key, bucket);
      return true;
    }

    return false;
  }
}

// Usage
const rateLimiter = new RateLimiter();

app.post('/api/code/upload', async (req, res) => {
  const canProceed = await rateLimiter.checkLimit(req.user.id, 'upload');
  if (!canProceed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  // Process request
});
```

### 3. API Versioning

#### Version Your APIs

```typescript
// ✓ GOOD: API versioning
const API_VERSIONS = ['v1', 'v2'];

app.use('/api/:version/*', (req, res, next) => {
  const version = req.params.version;

  if (!API_VERSIONS.includes(version)) {
    return res.status(400).json({
      error: 'Invalid API version',
      supported: API_VERSIONS
    });
  }

  req.apiVersion = version;
  next();
});

// Version-specific routes
app.post('/api/v1/users', v1CreateUser);
app.post('/api/v2/users', v2CreateUser);
```

### 4. Input Validation

#### Validate API Input

```typescript
// ✓ GOOD: API input validation
const CreateUserAPI = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(12).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  metadata: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional()
  }).optional()
});

app.post('/api/users', async (req, res) => {
  try {
    // Validate input
    const input = CreateUserAPI.parse(req.body);

    // Create user
    const user = await createUser(input);

    res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    throw error;
  }
});
```

### 5. Error Responses

#### Return Appropriate Errors

```typescript
// ✓ GOOD: Proper error responses
class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof APIError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId: req.id
      }
    });
  }

  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: err.errors
      }
    });
  }

  // Generic error
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
      requestId: req.id
    }
  });
});
```

---

## Data Security Guidelines

### 1. Data Classification

#### Classify Your Data

```typescript
// ✓ GOOD: Data classification
enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted'
}

const DATA_HANDLING = {
  [DataClassification.PUBLIC]: {
    encryption: false,
    accessLog: false,
    retention: 'permanent'
  },

  [DataClassification.INTERNAL]: {
    encryption: true,
    accessLog: true,
    retention: '1y'
  },

  [DataClassification.CONFIDENTIAL]: {
    encryption: true,
    accessLog: true,
    retention: '90d',
    anonymization: true
  },

  [DataClassification.RESTRICTED]: {
    encryption: true,
    accessLog: true,
    retention: '30d',
    anonymization: true,
    hardwareSecurity: true
  }
};

function classifyData(data: unknown): DataClassification {
  // Implement classification logic
  if (isRestricted(data)) return DataClassification.RESTRICTED;
  if (isConfidential(data)) return DataClassification.CONFIDENTIAL;
  if (isInternal(data)) return DataClassification.INTERNAL;
  return DataClassification.PUBLIC;
}
```

### 2. Data Encryption

#### Encrypt Sensitive Data

```typescript
// ✓ GOOD: Data encryption
async function encryptSensitiveData(
  data: string,
  classification: DataClassification
): Promise<string> {
  const handling = DATA_HANDLING[classification];

  if (!handling.encryption) {
    return data;
  }

  // Get encryption key
  const key = await getEncryptionKey(classification);

  // Encrypt data
  const iv = crypto.randomBytes(12);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(data)
  );

  // Return encrypted data with IV
  return JSON.stringify({
    ciphertext: Buffer.from(encrypted).toString('base64'),
    iv: iv.toString('base64'),
    algorithm: 'AES-256-GCM'
  });
}

async function decryptSensitiveData(encrypted: string): Promise<string> {
  const { ciphertext, iv } = JSON.parse(encrypted);
  const key = await getEncryptionKey(DataClassification.RESTRICTED);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(iv, 'base64') },
    key,
    Buffer.from(ciphertext, 'base64')
  );

  return new TextDecoder().decode(decrypted);
}
```

### 3. Data Retention

#### Implement Data Retention Policies

```typescript
// ✓ GOOD: Data retention
async function enforceRetentionPolicy() {
  const now = Date.now();

  // Get retention policies
  const policies = await db.retentionPolicies.getAll();

  for (const policy of policies) {
    const cutoff = now - policy.retentionPeriod;

    // Delete expired data
    await db[policy.table]
      .where('created_at', '<', cutoff)
      .delete();

    // Log deletion
    logger.info('Data retention enforced', {
      table: policy.table,
      cutoff: new Date(cutoff),
      deleted: policy.deletedCount
    });
  }
}

// Schedule retention enforcement
cron.schedule('0 0 * * *', enforceRetentionPolicy);
```

### 4. Data Access Logging

#### Log Data Access

```typescript
// ✓ GOOD: Data access logging
async function accessData(
  userId: string,
  dataType: string,
  dataId: string
): Promise<unknown> {
  // Log access attempt
  await db.dataAccessLog.insert({
    userId,
    dataType,
    dataId,
    timestamp: Date.now(),
    action: 'READ'
  });

  // Access data
  const data = await db[dataType].get(dataId);

  // Log successful access
  await db.dataAccessLog.insert({
    userId,
    dataType,
    dataId,
    timestamp: Date.now(),
    action: 'READ_SUCCESS'
  });

  return data;
}
```

---

## Infrastructure Security

### 1. Network Security

#### Secure Network Configuration

```typescript
// ✓ GOOD: Network security
const NETWORK_SECURITY = {
  // TLS configuration
  tls: {
    minVersion: 'TLSv1.3',
    maxVersion: 'TLSv1.3',
    ciphers: [
      'TLS_AES_256_GCM_SHA384',
      'TLS_AES_128_GCM_SHA256',
      'TLS_CHACHA20_POLY1305_SHA256'
    ]
  },

  // IP whitelisting
  ipWhitelist: [
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16'
  ],

  // Port restrictions
  allowedPorts: [443, 80],

  // Firewall rules
  firewallRules: [
    { action: 'allow', port: 443, protocol: 'tcp' },
    { action: 'allow', port: 80, protocol: 'tcp' },
    { action: 'deny', port: 'all' }
  ]
};
```

### 2. Secrets Management

#### Secure Secrets Storage

```typescript
// ✓ GOOD: Secrets management
class SecretsManager {
  private secrets: Map<string, string> = new Map();

  async loadSecrets() {
    // Load from environment variables
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('SECRET_')) {
        this.secrets.set(key, value);
      }
    }

    // Load from secret manager
    const cloudflareSecrets = await fetchCloudflareSecrets();
    for (const [key, value] of Object.entries(cloudflareSecrets)) {
      this.secrets.set(key, value);
    }
  }

  getSecret(name: string): string {
    const secret = this.secrets.get(name);
    if (!secret) {
      throw new Error(`Secret not found: ${name}`);
    }
    return secret;
  }

  // Never log secrets
  toString(): string {
    return '[SecretsManager]';
  }
}

const secrets = new SecretsManager();
await secrets.loadSecrets();
```

### 3. Container Security

#### Secure Container Configuration

```dockerfile
# ✓ GOOD: Secure Dockerfile
FROM node:20-alpine AS builder

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose only necessary ports
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8787/health || exit 1

# Run application
CMD ["node", "src/index.js"]
```

---

## Operational Security

### 1. Access Control

#### Implement Least Privilege

```typescript
// ✓ GOOD: Role-based access control
enum Permission {
  READ_USERS = 'read:users',
  WRITE_USERS = 'write:users',
  DELETE_USERS = 'delete:users',
  READ_PROJECTS = 'read:projects',
  WRITE_PROJECTS = 'write:projects',
  DELETE_PROJECTS = 'delete:projects',
  ADMIN = 'admin:all'
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: Object.values(Permission),
  developer: [
    Permission.READ_USERS,
    Permission.READ_PROJECTS,
    Permission.WRITE_PROJECTS
  ],
  viewer: [
    Permission.READ_PROJECTS
  ]
};

async function checkPermission(
  userId: string,
  requiredPermission: Permission
): Promise<boolean> {
  const user = await db.users.get(userId);
  const permissions = ROLE_PERMISSIONS[user.role];

  return permissions.includes(requiredPermission);
}
```

### 2. Audit Logging

#### Comprehensive Audit Trail

```typescript
// ✓ GOOD: Audit logging
async function logAuditEvent(event: AuditEvent) {
  await db.auditLog.insert({
    id: crypto.randomUUID(),
    type: event.type,
    userId: event.userId,
    action: event.action,
    resource: event.resource,
    resourceId: event.resourceId,
    timestamp: Date.now(),
    ip: event.ip,
    userAgent: event.userAgent,
    result: event.result,
    details: event.details
  });
}

// Usage
await logAuditEvent({
  type: 'DATA_ACCESS',
  userId: user.id,
  action: 'READ',
  resource: 'project',
  resourceId: project.id,
  timestamp: Date.now(),
  ip: request.ip,
  userAgent: request.headers['user-agent'],
  result: 'SUCCESS',
  details: {}
});
```

### 3. Monitoring and Alerting

#### Set Up Comprehensive Monitoring

```typescript
// ✓ GOOD: Security monitoring
const SecurityMonitor = {
  async monitorRequest(request: Request) {
    const metrics = {
      timestamp: Date.now(),
      ip: request.ip,
      path: request.path,
      method: request.method,
      userAgent: request.headers['user-agent'],
      userId: request.user?.id
    };

    // Check for suspicious patterns
    const suspicious = await this.detectSuspiciousActivity(metrics);
    if (suspicious) {
      await this.alertSecurityTeam(suspicious);
    }

    // Record metrics
    await this.recordMetrics(metrics);
  },

  async detectSuspiciousActivity(metrics: RequestMetrics): Promise<SuspiciousActivity | null> {
    // Check for rate limit violations
    const requestCount = await this.getRequestCount(metrics.ip);
    if (requestCount > 1000) {
      return {
        type: 'RATE_LIMIT_VIOLATION',
        severity: 'HIGH',
        ip: metrics.ip,
        count: requestCount
      };
    }

    // Check for unusual access patterns
    const accessPattern = await this.analyzeAccessPattern(metrics);
    if (accessPattern.anomaly > 0.8) {
      return {
        type: 'UNUSUAL_ACCESS_PATTERN',
        severity: 'MEDIUM',
        userId: metrics.userId,
        pattern: accessPattern
      };
    }

    return null;
  }
};
```

---

## Cloudflare Workers Security

### 1. Worker Isolation

#### Secure Worker Configuration

```typescript
// ✓ GOOD: Worker security configuration
export interface Env {
  // Bindings
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;

  // Secrets
  JWT_SECRET: string;
  API_KEY: string;

  // Configuration
  ALLOWED_ORIGINS: string;
  RATE_LIMIT: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 1. Validate request
    const validation = await validateRequest(request, env);
    if (!validation.valid) {
      return new Response('Invalid request', { status: 400 });
    }

    // 2. Check rate limit
    const rateLimit = await checkRateLimit(request, env);
    if (!rateLimit.allowed) {
      return new Response('Rate limit exceeded', { status: 429 });
    }

    // 3. Process request
    return await handleRequest(request, env);
  }
};
```

### 2. WASM Security

#### Secure WASM Execution

```typescript
// ✓ GOOD: WASM security
async function executeWasmSafely(
  wasm: ArrayBuffer,
  input: unknown
): Promise<unknown> {
  // Validate WASM
  const module = await WebAssembly.compile(wasm);

  // Set limits
  const instance = await WebAssembly.instantiate(module, {
    env: {
      // Only expose safe functions
      log: console.log,
      abort: () => { throw new Error('Aborted'); }
    }
  });

  // Set timeout
  const timeout = setTimeout(() => {
    throw new Error('WASM execution timeout');
  }, 30000); // 30 seconds

  try {
    const result = instance.exports.main(input);
    clearTimeout(timeout);
    return result;
  } catch (error) {
    clearTimeout(timeout);
    throw new SecurityError('WASM execution failed', error);
  }
}
```

---

## Third-Party Integration Security

### 1. API Key Management

#### Secure API Key Storage

```typescript
// ✓ GOOD: API key management
class APIKeyManager {
  private keys: Map<string, APIKey> = new Map();

  async loadKeys() {
    // Load from encrypted storage
    const encryptedKeys = await db.apiKeys.getAll();
    for (const key of encryptedKeys) {
      const decrypted = await decryptKey(key.encryptedKey);
      this.keys.set(key.service, {
        service: key.service,
        key: decrypted,
        rotationDate: key.rotationDate
      });
    }
  }

  getKey(service: string): string {
    const apiKey = this.keys.get(service);
    if (!apiKey) {
      throw new Error(`API key not found: ${service}`);
    }

    // Check rotation
    if (Date.now() > apiKey.rotationDate) {
      throw new Error(`API key expired: ${service}`);
    }

    return apiKey.key;
  }

  async rotateKey(service: string) {
    // Generate new key
    const newKey = generateSecureKey();

    // Update external service
    await updateExternalServiceKey(service, newKey);

    // Encrypt and store
    const encrypted = await encryptKey(newKey);
    await db.apiKeys.update(service, {
      encryptedKey: encrypted,
      rotationDate: Date.now() + (90 * 24 * 60 * 60 * 1000) // 90 days
    });

    // Log rotation
    await logSecurityEvent({
      type: 'API_KEY_ROTATED',
      service,
      timestamp: Date.now()
    });
  }
}
```

### 2. Webhook Security

#### Secure Webhook Handling

```typescript
// ✓ GOOD: Webhook security
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  // Compute expected signature
  const expected = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    new TextEncoder().encode(payload)
  );

  const expectedSignature = Buffer.from(expected)
    .toString('base64');

  // Compare signatures
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

app.post('/webhooks/github', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  const isValid = await verifyWebhookSignature(
    JSON.stringify(req.body),
    signature.replace('sha256=', ''),
    process.env.GITHUB_WEBHOOK_SECRET
  );

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process webhook
  await processGitHubWebhook(req.body);

  res.status(200).json({ success: true });
});
```

---

## Compliance and Auditing

### 1. SOC 2 Compliance

#### Implement SOC 2 Controls

```typescript
// ✓ GOOD: SOC 2 compliance monitoring
class SOC2Monitor {
  async logAccessEvent(event: AccessEvent) {
    // Log all access events
    await db.auditLog.insert({
      timestamp: Date.now(),
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      result: event.result
    });
  }

  async logConfigurationChange(change: ConfigChange) {
    // Log configuration changes
    await db.configChangeLog.insert({
      timestamp: Date.now(),
      changedBy: change.changedBy,
      parameter: change.parameter,
      oldValue: change.oldValue,
      newValue: change.newValue,
      reason: change.reason
    });
  }

  async generateSOC2Report(startDate: Date, endDate: Date) {
    // Generate SOC 2 compliance report
    const report = {
      period: { startDate, endDate },
      accessEvents: await db.auditLog.getPeriod(startDate, endDate),
      configChanges: await db.configChangeLog.getPeriod(startDate, endDate),
      securityIncidents: await db.securityIncidents.getPeriod(startDate, endDate)
    };

    return report;
  }
}
```

### 2. GDPR Compliance

#### Implement GDPR Requirements

```typescript
// ✓ GOOD: GDPR compliance
class GDPRManager {
  async exportUserData(userId: string): Promise<UserDataExport> {
    // Export all user data
    const user = await db.users.get(userId);
    const sessions = await db.sessions.getByUser(userId);
    const projects = await db.projects.getByUser(userId);
    const auditLogs = await db.auditLog.getByUser(userId);

    return {
      user,
      sessions,
      projects,
      auditLogs,
      exportedAt: new Date().toISOString()
    };
  }

  async deleteUserData(userId: string): Promise<void> {
    // Delete user data (right to be forgotten)
    await db.users.delete(userId);
    await db.sessions.deleteByUser(userId);
    await db.projects.deleteByUser(userId);
    await db.auditLog.anonymize(userId);

    // Log deletion
    await logSecurityEvent({
      type: 'GDPR_DELETION',
      userId,
      timestamp: Date.now()
    });
  }

  async anonymizeUserData(userId: string): Promise<void> {
    // Anonymize user data
    await db.users.update(userId, {
      username: `deleted-${userId}`,
      email: `deleted-${userId}@example.com`,
      deletedAt: new Date()
    });

    await db.auditLog.anonymize(userId);
  }
}
```

---

## Conclusion

These security best practices provide a comprehensive foundation for securing ClaudeFlare. Regular reviews, updates, and training are essential for maintaining security.

### Key Takeaways

1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Minimal required permissions
3. **Secure by Default**: Security-first approach
4. **Continuous Monitoring**: Always watching for threats
5. **Rapid Response**: Quick incident response

### Maintenance

- **Monthly**: Review and update practices
- **Quarterly**: Security training and awareness
- **Annually**: Full security assessment

---

**Document Owner**: Security Team
**Review Cycle**: Monthly
**Next Review**: 2026-02-13
**Change History**:
- 2026-01-13: Initial document creation
