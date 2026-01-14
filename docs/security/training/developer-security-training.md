# Developer Security Training

**Document Version:** 1.0
**Status:** Production-Ready
**Last Updated:** 2026-01-13
**Target Audience**: All Developers

---

## Course Overview

This comprehensive security training program is designed for ClaudeFlare developers to understand and implement security best practices throughout the software development lifecycle.

### Learning Objectives

By the end of this training, developers will be able to:

1. Identify and mitigate common security vulnerabilities
2. Implement secure coding practices
3. Conduct security testing and code reviews
4. Respond to security incidents effectively
5. Maintain compliance with security policies

### Training Format

- **Duration**: 4 hours
- **Format**: Interactive modules with hands-on exercises
- **Frequency**: Quarterly
- **Assessment**: Quiz and practical exam

---

## Module 1: Security Fundamentals (30 minutes)

### Learning Goals

- Understand the CIA triad
- Recognize common threat actors
- Apply defense-in-depth principles
- Implement the principle of least privilege

### Key Concepts

#### CIA Triad

```
┌─────────────────────────────────────────────────────────────┐
│                        CIA TRIAD                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐│
│  │              │     │              │     │             ││
│  │ CONFIDENTIALITY│    │  INTEGRITY   │     │ AVAILABILITY││
│  │              │     │              │     │             ││
│  │ Protecting   │     │ Ensuring     │     │ Ensuring    ││
│  │ data from    │     │ data         │     │ systems are ││
│  │ unauthorized │     │ accuracy     │     │ available   ││
│  │ access       │     │ and          │     │ when needed ││
│  │              │     │ consistency  │     │             ││
│  └──────────────┘     └──────────────┘     └─────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Threat Actors

| Actor | Motivation | Capabilities | Mitigation |
|-------|------------|--------------|------------|
| **Script Kiddies** | Notoriety | Low | Basic security controls |
| **Hacktivists** | Political | Medium | Network security |
| **Cybercriminals** | Financial | High | Comprehensive security |
| **Nation-States** | Espionage | Very High | Advanced threat protection |
| **Insiders** | Various | High | Access controls, monitoring |

### Exercise 1: Threat Modeling

**Objective**: Identify potential threats to a simple login system.

**Scenario**:
```
User → Login Page → Backend API → Database
```

**Task**: List 3 potential threats and their mitigations.

**Solution**:
1. **Credential stuffing**: Implement rate limiting and MFA
2. **SQL injection**: Use parameterized queries
3. **Session hijacking**: Use secure cookies and HTTPS

---

## Module 2: Secure Coding Practices (60 minutes)

### Learning Goals

- Write secure code by default
- Validate and sanitize all inputs
- Implement proper authentication and authorization
- Use cryptography correctly

### Input Validation

#### Rule #1: Never Trust User Input

```typescript
// ✗ BAD: Trusting user input
function getUserEmail(req: Request) {
  return req.body.email; // No validation!
}

// ✓ GOOD: Validating input
import { z } from 'zod';

const EmailSchema = z.string().email().max(255);

function getUserEmail(req: Request) {
  try {
    return EmailSchema.parse(req.body.email);
  } catch (error) {
    throw new ValidationError('Invalid email format');
  }
}
```

### Authentication

#### Implement Proper Authentication

```typescript
// ✓ GOOD: Secure authentication
async function authenticate(credentials: Credentials): Promise<Session> {
  // 1. Validate input
  const validated = await validateCredentials(credentials);

  // 2. Check user exists
  const user = await db.users.findByEmail(validated.email);
  if (!user) {
    throw new AuthenticationError('Invalid credentials');
  }

  // 3. Verify password
  const passwordValid = await bcrypt.compare(
    validated.password,
    user.passwordHash
  );
  if (!passwordValid) {
    throw new AuthenticationError('Invalid credentials');
  }

  // 4. Check account status
  if (user.suspended) {
    throw new AuthenticationError('Account suspended');
  }

  // 5. Create secure session
  const session = await createSecureSession(user);

  // 6. Log successful authentication
  await logSecurityEvent({
    type: 'AUTH_SUCCESS',
    userId: user.id,
    timestamp: Date.now()
  });

  return session;
}
```

### Authorization

#### Implement Least Privilege

```typescript
// ✓ GOOD: Role-based access control
enum Permission {
  READ_USERS = 'read:users',
  WRITE_USERS = 'write:users',
  DELETE_USERS = 'delete:users'
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    Permission.READ_USERS,
    Permission.WRITE_USERS,
    Permission.DELETE_USERS
  ],
  developer: [
    Permission.READ_USERS
  ]
};

async function checkPermission(
  user: User,
  required: Permission
): Promise<boolean> {
  const permissions = ROLE_PERMISSIONS[user.role];
  return permissions.includes(required);
}

// Usage
async function deleteUser(userId: string, actor: User) {
  if (!await checkPermission(actor, Permission.DELETE_USERS)) {
    throw new AuthorizationError('Insufficient permissions');
  }

  await db.users.delete(userId);
}
```

### Cryptography

#### Use Strong Cryptography

```typescript
// ✓ GOOD: Password hashing
import bcrypt from 'bcrypt';

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

// ✓ GOOD: Data encryption
async function encryptData(data: string, key: CryptoKey): Promise<string> {
  const iv = crypto.randomBytes(12);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(data)
  );

  return JSON.stringify({
    ciphertext: Buffer.from(encrypted).toString('base64'),
    iv: iv.toString('base64')
  });
}
```

### Exercise 2: Code Review

**Objective**: Find security vulnerabilities in code.

**Code to Review**:
```typescript
app.post('/api/users', async (req, res) => {
  const { username, password, email } = req.body;
  await db.users.create({ username, password, email });
  res.json({ success: true });
});
```

**Issues Found**:
1. No input validation
2. Password stored in plain text
3. No rate limiting
4. No authentication required

**Fixed Code**:
```typescript
app.post('/api/users', async (req, res) => {
  // Validate input
  const input = CreateUserSchema.parse(req.body);

  // Hash password
  const passwordHash = await hashPassword(input.password);

  // Create user
  await db.users.create({
    username: input.username,
    email: input.email,
    passwordHash
  });

  res.json({ success: true });
});
```

---

## Module 3: Common Vulnerabilities (60 minutes)

### Learning Goals

- Identify OWASP Top 10 vulnerabilities
- Understand injection attacks
- Prevent XSS and CSRF
- Secure session management

### OWASP Top 10 (2021)

| # | Vulnerability | Description | Mitigation |
|---|---------------|-------------|------------|
| **A01** | Broken Access Control | Users can access unauthorized data | Implement proper authorization |
| **A02** | Cryptographic Failures | Sensitive data not protected | Encrypt data at rest and in transit |
| **A03** | Injection | Malicious data interpreted as code | Use parameterized queries |
| **A04** | Insecure Design | Flaws in system design | Implement secure design patterns |
| **A05** | Security Misconfiguration | Default configurations left insecure | Secure configurations |
| **A06** | Vulnerable Components | Outdated or vulnerable libraries | Keep dependencies updated |
| **A07** | Authentication Failures | Weak authentication mechanisms | Implement MFA, strong passwords |
| **A08** | Data Integrity Failures | Data can be modified without detection | Use digital signatures |
| **A09** | Logging Failures | Insufficient logging and monitoring | Comprehensive audit logging |
| **A10** | Server-Side Request Forgery | Server fetches malicious URLs | Validate and sanitize URLs |

### SQL Injection

#### Understanding SQL Injection

```typescript
// ✗ BAD: Vulnerable to SQL injection
async function getUser(userId: string) {
  const query = `SELECT * FROM users WHERE id = '${userId}'`;
  return await db.query(query);
}

// Attack: userId = "' OR '1'='1"
// Result: SELECT * FROM users WHERE id = '' OR '1'='1'
// Returns all users!

// ✓ GOOD: Parameterized query
async function getUser(userId: string) {
  const query = 'SELECT * FROM users WHERE id = ?';
  return await db.query(query, [userId]);
}
```

### Cross-Site Scripting (XSS)

#### Preventing XSS

```typescript
// ✗ BAD: Vulnerable to XSS
app.get('/search', (req, res) => {
  const query = req.query.q;
  res.send(`<h1>Results for: ${query}</h1>`);
});

// Attack: query = "<script>alert('XSS')</script>"
// Result: JavaScript executes in user's browser

// ✓ GOOD: Output encoding
app.get('/search', (req, res) => {
  const query = escapeHtml(req.query.q);
  res.send(`<h1>Results for: ${query}</h1>`);
});

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

### Cross-Site Request Forgery (CSRF)

#### Preventing CSRF

```typescript
// ✓ GOOD: CSRF protection
import { csrf } from 'csrf';

const tokens = new csrf();

app.post('/api/transfer', (req, res) => {
  // Verify CSRF token
  const token = req.body.csrfToken;
  const secret = req.session.csrfSecret;

  if (!tokens.verify(secret, token)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  // Process transfer
  await processTransfer(req.body);

  res.json({ success: true });
});
```

### Exercise 3: Vulnerability Identification

**Objective**: Identify vulnerabilities in code.

**Code**:
```typescript
app.post('/api/comments', async (req, res) => {
  const { comment, userId } = req.body;
  await db.comments.create({ comment, userId, createdAt: Date.now() });
  res.json({ success: true });
});

app.get('/api/comments/:id', async (req, res) => {
  const comment = await db.comments.get(req.params.id);
  res.send(`<div>${comment.comment}</div>`);
});
```

**Vulnerabilities**:
1. No input validation (POST)
2. No authentication required (POST)
3. Stored XSS (comment stored)
3. Reflected XSS (GET endpoint)
4. No rate limiting
5. No output encoding (GET endpoint)

---

## Module 4: Security Testing (45 minutes)

### Learning Goals

- Write security tests
- Perform static analysis
- Conduct dependency scanning
- Use penetration testing tools

### Static Application Security Testing (SAST)

#### Using SAST Tools

```bash
# npm audit
npm audit

# Snyk
npx snyk test

# Semgrep
semgrep --config=auto .

# ESLint security plugin
eslint --plugin security src/
```

### Dynamic Application Security Testing (DAST)

#### Security Testing Example

```typescript
// Security test example
describe('Security Tests', () => {
  test('should reject SQL injection', async () => {
    const maliciousInput = "'; DROP TABLE users; --";

    const response = await request(app)
      .post('/api/users')
      .send({ userId: maliciousInput });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid input');
  });

  test('should prevent XSS', async () => {
    const xssPayload = '<script>alert("XSS")</script>';

    const response = await request(app)
      .post('/api/comments')
      .send({ comment: xssPayload });

    expect(response.status).toBe(201);
    expect(response.body.comment).not.toContain('<script>');
  });

  test('should enforce rate limiting', async () => {
    const requests = Array(100).fill(null).map(() =>
      request(app).get('/api/users')
    );

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);

    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

### Dependency Scanning

#### Automated Dependency Scanning

```json
// .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run npm audit
        run: npm audit --audit-level=moderate

      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### Exercise 4: Security Test Writing

**Objective**: Write security tests for a login endpoint.

**Task**: Write tests for:
1. SQL injection protection
2. Rate limiting
3. Password hashing verification

**Solution**:
```typescript
describe('Login Security Tests', () => {
  test('should prevent SQL injection', async () => {
    const response = await request(app)
      .post('/api/login')
      .send({
        email: "' OR '1'='1",
        password: "password"
      });

    expect(response.status).toBe(401);
  });

  test('should enforce rate limiting', async () => {
    const requests = Array(20).fill(null).map(() =>
      request(app).post('/api/login').send({
        email: 'test@example.com',
        password: 'wrong'
      })
    );

    const responses = await Promise.all(requests);
    const lastResponse = responses[responses.length - 1];

    expect(lastResponse.status).toBe(429);
  });

  test('should hash passwords', async () => {
    const user = await db.users.get('test@example.com');

    expect(user.passwordHash).not.toBe('password');
    expect(user.passwordHash).toMatch(/^\$2[aby]\$\d+\$/);
  });
});
```

---

## Module 5: Incident Response (30 minutes)

### Learning Goals

- Recognize security incidents
- Follow incident response procedures
- Preserve evidence
- Communicate effectively

### Incident Recognition

#### Signs of Security Incidents

1. **Unusual system behavior**
   - Slow performance
   - High CPU/memory usage
   - Unexpected crashes

2. **Security alerts**
   - Failed authentication attempts
   - Unusual login locations
   - Multiple failed requests

3. **User reports**
   - Account lockouts
   - Unauthorized access
   - Data discrepancies

### Incident Response Steps

```
┌─────────────────────────────────────────────────────────────┐
│              INCIDENT RESPONSE STEPS                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. IDENTIFY                                                │
│     └── Is this a security incident?                       │
│                                                              │
│  2. REPORT                                                  │
│     └── Notify security team immediately                   │
│                                                              │
│  3. CONTAIN                                                 │
│     └── Limit damage (if safe to do so)                    │
│                                                              │
│  4. PRESERVE                                                │
│     └── Don't destroy evidence                             │
│                                                              │
│  5. DOCUMENT                                                │
│     └── Record what you observed                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Exercise 5: Incident Scenario

**Scenario**: You notice unusual database queries in the logs.

**Questions**:
1. What do you do first?
2. Who do you notify?
3. What evidence do you preserve?

**Answers**:
1. First: Verify it's a real incident, not a false positive
2. Notify: Security team (security@claudeflare.com)
3. Preserve: Logs, database snapshots, memory dumps

---

## Module 6: Security Policy Review (15 minutes)

### Key Security Policies

#### Acceptable Use Policy

- Only use authorized systems and data
- Report security incidents immediately
- Don't share credentials
- Use strong passwords

#### Data Handling Policy

- Classify data appropriately
- Encrypt sensitive data
- Follow data retention policies
- Don't store sensitive data locally

#### Incident Response Policy

- Report incidents within 1 hour
- Don't attempt to investigate alone
- Preserve all evidence
- Follow official procedures

---

## Assessment

### Quiz (10 questions)

1. **What does CIA stand for?**
   - a) Confidentiality, Integrity, Availability
   - b) Central Intelligence Agency
   - c) Computer Incident Response

2. **What is the principle of least privilege?**
   - a) Give users maximum access
   - b) Give users minimum required access
   - c) Give users no access

3. **What is SQL injection?**
   - a) A database optimization technique
   - b) A code vulnerability
   - c) A testing methodology

4. **What is XSS?**
   - a) Cross-site scripting
   - b) Extra secure socket
   - c) XML stylesheet

5. **What should you do with user input?**
   - a) Trust it
   - b) Validate and sanitize it
   - c) Ignore it

6. **What is rate limiting?**
   - a) Speed testing
   - b) Limiting request frequency
   - c) Network optimization

7. **What is the purpose of encryption?**
   - a) To compress data
   - b) To protect data confidentiality
   - c) To speed up data transfer

8. **What should you do if you suspect a security incident?**
   - a) Investigate yourself
   - b) Report it immediately
   - c) Ignore it

9. **What is CSRF?**
   - a) Cross-site request forgery
   - b) Client-side rendering
   - c) Certificate signing request

10. **What is the best way to store passwords?**
    - a) Plain text
    - b) Encrypted
    - c) Hashed with salt

### Practical Exam

**Task**: Review the following code and identify security vulnerabilities.

```typescript
app.post('/api/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;

  const user = await db.users.findByEmail(email);
  if (user) {
    user.password = newPassword;
    await db.users.save(user);
  }

  res.json({ success: true });
});
```

**Vulnerabilities**:
1. No input validation
2. Password stored in plain text
3. No authentication required
4. No rate limiting
5. Information leakage (shows if email exists)

---

## Resources

### Internal Resources

- Security Policies: `/docs/security/policies/`
- Incident Response: `/docs/security/incident-response.md`
- Best Practices: `/docs/security/best-practices.md`

### External Resources

- OWASP: https://owasp.org
- CWE: https://cwe.mitre.org
- NIST Cybersecurity Framework: https://www.nist.gov/cyberframework

### Tools

- Snyk: https://snyk.io
- npm audit: `npm audit`
- Semgrep: https://semgrep.dev
- Burp Suite: https://portswigger.net/burp

---

## Completion Checklist

- [ ] Complete all 6 modules
- [ ] Pass quiz (80% minimum)
- [ ] Complete practical exam
- [ ] Sign security policy acknowledgment
- [ ] Schedule next training (quarterly)

---

## Contact

**Security Team**: security@claudeflare.com
**Training Questions**: training@claudeflare.com

---

**Document Owner**: Security Team
**Review Cycle**: Quarterly
**Next Review**: 2026-04-13
