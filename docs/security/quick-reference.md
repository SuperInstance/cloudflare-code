# Security Quick Reference Guide

**Version**: 1.0
**Last Updated**: 2026-01-13
**Audience**: All ClaudeFlare Developers

---

## Quick Links

- **[Full Security Documentation](./README.md)**
- **[Security Best Practices](./best-practices.md)**
- **[Incident Response](./incident-response.md)**
- **[Threat Model](./threat-model.md)**

---

## Secure Coding Checklist

### Before You Commit Code

```typescript
// ✓ Input Validation
const validated = CreateUserSchema.parse(input);

// ✓ Parameterized Queries
await db.query('SELECT * FROM users WHERE id = ?', [userId]);

// ✓ Output Encoding
const output = escapeHtml(userInput);

// ✓ Error Handling
try {
  await operation();
} catch (error) {
  logError(error);
  return genericErrorResponse();
}

// ✓ Authentication/Authorization
if (!user.authenticated) throw new UnauthorizedError();
if (!await checkPermission(user, resource)) throw new ForbiddenError();
```

### Never Do This

```typescript
// ✗ No input validation
const userInput = req.body.value;

// ✗ SQL injection vulnerability
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// ✗ No output encoding
res.send(`<div>${userInput}</div>`);

// ✗ Exposing internal errors
res.send({ error: error.message, stack: error.stack });

// ✗ No authorization
await deleteUser(userId);
```

---

## Common Vulnerabilities

### OWASP Top 10 Quick Reference

| # | Vulnerability | Prevention |
|---|---------------|------------|
| **A01** | Broken Access Control | Implement proper RBAC |
| **A02** | Cryptographic Failures | Use strong encryption (AES-256-GCM) |
| **A03** | Injection | Use parameterized queries |
| **A04** | Insecure Design | Implement security by design |
| **A05** | Security Misconfiguration | Secure defaults, no hardcoded secrets |
| **A06** | Vulnerable Components | Keep dependencies updated |
| **A07** | Authentication Failures | Implement MFA, strong passwords |
| **A08** | Data Integrity Failures | Use digital signatures |
| **A09** | Logging Failures | Comprehensive audit logging |
| **A10** | Server-Side Request Forgery | Validate and sanitize URLs |

---

## Security Headers

### Required Headers

```typescript
// Add to all responses
const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'none'",
    "script-src 'self' https://cdn.claudeflare.com",
    "connect-src 'self' https://api.claudeflare.com",
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'"
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};
```

---

## Data Security

### Encryption

```typescript
// Password hashing
import bcrypt from 'bcrypt';
const hash = await bcrypt.hash(password, 12);

// Data encryption
const encrypted = await encryptData(data, {
  algorithm: 'AES-256-GCM',
  keyId: 'production-key'
});
```

### Data Classification

| Classification | Example | Handling |
|----------------|---------|----------|
| **PUBLIC** | Documentation | No restrictions |
| **INTERNAL** | Internal metrics | Company access only |
| **CONFIDENTIAL** | User data | Encrypted, audit logged |
| **RESTRICTED** | Credentials, keys | Hardware security, MFA |

---

## Authentication & Authorization

### JWT Best Practices

```typescript
// Generate token
const token = await jwt.sign({
  userId: user.id,
  email: user.email
}, SECRET, {
  expiresIn: '15m',
  issuer: 'claudeflare.com',
  audience: 'api.claudeflare.com'
});

// Verify token
const payload = await jwt.verify(token, SECRET, {
  issuer: 'claudeflare.com',
  audience: 'api.claudeflare.com'
});
```

### RBAC Pattern

```typescript
// Check permission
async function checkPermission(
  user: User,
  resource: string,
  action: string
): Promise<boolean> {
  const permissions = ROLE_PERMISSIONS[user.role];
  return permissions.includes(`${action}:${resource}`);
}
```

---

## Incident Response

### Reporting Security Issues

**Critical**: security@claudeflare.com (15 min response)
**High**: security@claudeflare.com (1 hour response)
**Medium**: security@claudeflare.com (4 hour response)
**Low**: security@claudeflare.com (1 day response)

### Immediate Steps

1. **Don't panic** - Follow procedures
2. **Report** - Notify security team immediately
3. **Contain** - If safe, limit damage
4. **Preserve** - Don't destroy evidence
5. **Document** - Record what you know

---

## Security Testing

### Pre-Commit Checklist

```bash
# Run security checks
npm audit
npm run test:security
npm run lint
npm run typecheck

# Check dependencies
npm outdated
npm-check-updates -u
```

### Security Test Example

```typescript
describe('Security Tests', () => {
  test('should prevent SQL injection', async () => {
    const malicious = "'; DROP TABLE users; --";
    const response = await request(app)
      .post('/api/users')
      .send({ userId: malicious });
    expect(response.status).toBe(400);
  });

  test('should prevent XSS', async () => {
    const xss = '<script>alert("XSS")</script>';
    const response = await request(app)
      .post('/api/comments')
      .send({ comment: xss });
    expect(response.body.comment).not.toContain('<script>');
  });
});
```

---

## Common Security Mistakes

### Mistake #1: Hardcoded Secrets

```typescript
// ✗ BAD
const apiKey = 'sk-1234567890abcdef';

// ✓ GOOD
const apiKey = process.env.API_KEY;
```

### Mistake #2: Logging Sensitive Data

```typescript
// ✗ BAD
console.log('User login:', { email, password });

// ✓ GOOD
console.log('User login:', { email: maskEmail(email) });
```

### Mistake #3: Trusting Client Input

```typescript
// ✗ BAD
const isAdmin = req.body.isAdmin;

// ✓ GOOD
const isAdmin = await checkAdminPermission(req.user);
```

### Mistake #4: Insecure Random Values

```typescript
// ✗ BAD
const id = Math.random().toString();

// ✓ GOOD
const id = crypto.randomUUID();
```

### Mistake #5: Timing Attacks

```typescript
// ✗ BAD
if (user.password === storedPassword) {
  // login
}

// ✓ GOOD
if (await bcrypt.compare(password, storedHash)) {
  // login
}
```

---

## Security Resources

### Internal Tools

- **Security Dashboard**: https://security.claudeflare.com
- **Incident Response**: https://incident.claudeflare.com
- **Vulnerability Scanner**: Run `npm audit`
- **Dependency Check**: Run `npm-check-updates`

### External Resources

- **OWASP**: https://owasp.org
- **CWE**: https://cwe.mitre.org
- **NIST**: https://www.nist.gov/cyberframework

### Security Contacts

- **Security Team**: security@claudeflare.com
- **Incidents**: security@claudeflare.com
- **Questions**: #security Slack channel

---

## Quick Reference Cards

### Password Security
- ✓ Minimum 12 characters
- ✓ Use password manager
- ✓ Unique per service
- ✓ Enable MFA where available

### API Security
- ✓ Use HTTPS only
- ✓ Validate all input
- ✓ Implement rate limiting
- ✓ Use API keys (rotate regularly)

### Data Security
- ✓ Encrypt at rest (AES-256-GCM)
- ✓ Encrypt in transit (TLS 1.3)
- ✓ Classify data
- ✓ Implement retention policies

### Code Security
- ✓ Review code for vulnerabilities
- ✓ Use static analysis tools
- ✓ Keep dependencies updated
- ✓ Follow security best practices

---

## Monthly Security Tasks

### Week 1
- [ ] Review security alerts
- [ ] Update dependencies
- [ ] Run security scans

### Week 2
- [ ] Review access logs
- [ ] Check for vulnerabilities
- [ ] Update security documentation

### Week 3
- [ ] Security training
- [ ] Incident response drill
- [ ] Threat model review

### Week 4
- [ ] Monthly security report
- [ ] Review metrics
- [ ] Plan improvements

---

## Emergency Contacts

| Severity | Contact | Response Time |
|----------|---------|---------------|
| **Critical** | security@claudeflare.com | 15 minutes |
| **High** | security@claudeflare.com | 1 hour |
| **Medium** | security@claudeflare.com | 4 hours |
| **Low** | security@claudeflare.com | 1 day |

**After Hours**: On-call security team via PagerDuty

---

## Reminders

### Security is Everyone's Responsibility

- ✓ Think security first
- ✓ Follow best practices
- ✓ Report issues promptly
- ✓ Keep learning
- ✓ Stay vigilant

### If in Doubt

1. **Don't proceed** - Stop and think
2. **Ask questions** - #security Slack channel
3. **Review docs** - Full security documentation
4. **Contact team** - security@claudeflare.com

---

**Remember**: Security is a journey, not a destination. Stay vigilant, keep learning, and always prioritize security in your work.

---

**Version**: 1.0
**Last Updated**: 2026-01-13
**Next Review**: 2026-02-13
