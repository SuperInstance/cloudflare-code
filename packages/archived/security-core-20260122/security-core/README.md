# @claudeflare/security-core

Enterprise-grade security and compliance automation for the ClaudeFlare distributed AI coding platform.

## Overview

This package provides comprehensive security capabilities including:

- **Secrets Management** - Secure storage, rotation, versioning, and access control
- **Encryption Utilities** - AES-256-GCM, RSA, hashing, HMAC, and key derivation
- **Authentication & Authorization** - JWT, OAuth2, RBAC, ABAC, session management, and MFA
- **Audit Logging** - Immutable audit trails with compliance reporting
- **Compliance Automation** - SOC2, ISO27001, GDPR, HIPAA, PCI DSS automation
- **Security Policies** - Policy-as-code engine with CI/CD gate enforcement
- **Threat Detection** - Anomaly detection and automated threat response

## Installation

```bash
npm install @claudeflare/security-core
```

## Quick Start

```typescript
import { createSecuritySuite } from '@claudeflare/security-core';

// Initialize the complete security suite
const security = createSecuritySuite({
  secrets: {
    provider: 'cloudflare',
    defaultRotationDays: 90,
    encryptionRequired: true,
  },
  encryption: {
    defaultAlgorithm: 'aes-256-gcm',
    fipsCompliant: false,
  },
  audit: {
    enabled: true,
    retentionDays: 90,
    asyncLogging: true,
  },
  compliance: {
    frameworks: ['soc2', 'iso27001'],
    autoAssessmentEnabled: true,
  },
}).initialize();

// Use security components
await security.secrets.createSecret({
  name: 'database-password',
  value: 'SecurePassword123!',
  createdBy: 'admin-123',
});

const encrypted = await security.encryption.encryptAES256GCM(
  'Sensitive data',
  key
);
```

## Features

### 1. Secrets Management

```typescript
import { SecretsManager } from '@claudeflare/security-core';

const manager = new SecretsManager({
  encryptionRequired: true,
  accessLoggingEnabled: true,
  defaultRotationDays: 90,
});

// Create a secret
const secret = await manager.createSecret({
  name: 'api-key',
  value: 'sk_live_1234567890',
  description: 'Production API key',
  createdBy: 'admin-123',
  tags: { environment: 'production' },
});

// Retrieve secret
const retrieved = await manager.getSecret('api-key', 'user-123');

// Rotate secret
const rotated = await manager.rotateSecret(
  'api-key',
  'admin-123',
  'new-api-key-value'
);
```

### 2. Encryption

```typescript
import { EncryptionEngine } from '@claudeflare/security-core';

const engine = new EncryptionEngine();

// Encrypt with AES-256-GCM
const encrypted = await engine.encryptAES256GCM('Sensitive data', key);
const decrypted = await engine.decryptAES256GCM(encrypted.encryptedData, key);

// Generate RSA key pair
const keyPair = await engine.generateRSAKeyPair(2048);

// Hash data
const hash = await engine.hashHex('password', 'sha256');

// Derive key from password
const derived = await engine.deriveKeyPBKDF2('password', salt, 100000, 32);
```

### 3. Authentication & Authorization

```typescript
import {
  TokenManager,
  AuthService,
  AuthorizationService,
} from '@claudeflare/security-core';

// Generate JWT tokens
const tokenManager = new TokenManager({
  issuer: 'claudeflare',
  audience: ['claudeflare-api'],
  secret: 'your-secret-key',
  accessTokenExpiry: 3600,
});

const token = await tokenManager.generateAuthToken(user);

// Authenticate users
const authService = new AuthService({ tokenManager, userStore });
const { user, requiresMfa } = await authService.authenticate(
  'user@example.com',
  'password123'
);

// Check permissions
const authService = new AuthorizationService({ userStore });
const decision = await authService.checkAccess(user, 'resource', 'read');
```

### 4. Audit Logging

```typescript
import { AuditLogger, AuditEventBuilder } from '@claudeflare/security-core';

const logger = new AuditLogger({
  source: 'my-app',
  environment: 'production',
  platform: 'claudeflare',
});

// Log an event
await logger.log(
  new AuditEventBuilder()
    .setEventType('authentication')
    .setCategory('security')
    .setSeverity('high')
    .setPrincipal({ id: 'user-123', type: 'user' })
    .setResource({ id: 'auth-system', type: 'service' })
    .setAction('user_login')
    .setOutcome('success')
    .build()
);

// Query events
const events = await logger.query({
  startDate: new Date('2024-01-01'),
  endDate: new Date(),
  eventTypes: ['authentication'],
});

// Generate compliance report
const report = await logger.generateReport({
  startDate: new Date('2024-01-01'),
  endDate: new Date(),
  frameworks: ['soc2', 'gdpr'],
});
```

### 5. Compliance Automation

```typescript
import { ComplianceAutomationEngine } from '@claudeflare/security-core';

const compliance = new ComplianceAutomationEngine({
  frameworks: ['soc2', 'iso27001', 'gdpr'],
  autoAssessmentEnabled: true,
  assessmentIntervalDays: 90,
});

// Get controls for a framework
const controls = compliance.getControls('soc2');

// Run automated assessments
const assessments = await compliance.runAssessments('soc2');

// Generate compliance report
const report = await compliance.generateReport('soc2', {
  start: new Date('2024-01-01'),
  end: new Date(),
});

console.log(`Compliance: ${report.summary.compliancePercentage}%`);
```

### 6. Security Policies

```typescript
import { PolicyEnforcer, CICDGateChecker } from '@claudeflare/security-core';

const enforcer = new PolicyEnforcer({
  policyStore,
  enforcementMode: 'enforced',
});

// Create policy from template
const policy = await enforcer.createFromTemplate('enforce-mfa', {
  scope: { environments: ['production'] },
});

// Evaluate policies
const results = await enforcer.evaluate(context);

// Enforce policies (throws on violation)
await enforcer.enforce(context);

// CI/CD gate checks
const gateChecker = new CICDGateChecker(enforcer);
const result = await gateChecker.preDeployCheck(context);
```

### 7. Threat Detection

```typescript
import { ThreatDetector } from '@claudeflare/security-core';

const detector = new ThreatDetector({
  anomalyDetectionEnabled: true,
  autoResponseEnabled: true,
});

// Analyze audit events for threats
const threat = await detector.analyzeEvent(auditEvent);

// Get detected threats
const threats = detector.getThreats({
  status: 'detected',
  severity: 'critical',
});
```

### 8. Utility Functions

```typescript
import {
  DataClassificationHelper,
  SecurityValidator,
  ComplianceHelper,
} from '@claudeflare/security-core';

// Classify data
const classification = DataClassificationHelper.classifyData('SSN: 123-45-6789');
// Returns: 'highly_confidential'

// Validate password
const result = SecurityValidator.validatePassword('MyStr0ng!Pass');
// Returns: { valid: true, score: 5, feedback: [] }

// Check compliance
const gdprCheck = ComplianceHelper.checkGDPRCompliance(classification);
// Returns: { compliant: false, requirements: [...] }
```

## API Reference

### Classes

- `SecretsManager` - Manage secrets with encryption and access control
- `EncryptionEngine` - Perform cryptographic operations
- `TokenManager` - Generate and verify JWT tokens
- `AuthService` - Authenticate users
- `AuthorizationService` - Check permissions
- `AuditLogger` - Log security events
- `ComplianceAutomationEngine` - Automate compliance assessments
- `PolicyEnforcer` - Enforce security policies
- `ThreatDetector` - Detect and respond to threats

### Types

- `Secret` - Secret with metadata and access policies
- `EncryptionKey` - Encryption key with versioning
- `User` - User with roles and permissions
- `AuditEvent` - Audit log entry
- `ComplianceControl` - Compliance control with assessments
- `SecurityPolicy` - Security policy with rules
- `Threat` - Detected threat with indicators

## Security Best Practices

1. **Always use encryption** for sensitive data at rest and in transit
2. **Enable audit logging** for all security-relevant operations
3. **Rotate secrets** regularly (default: 90 days)
4. **Implement MFA** for privileged operations
5. **Use the principle of least privilege** for access control
6. **Monitor for anomalies** and respond to threats automatically
7. **Maintain compliance** with automated assessments
8. **Enforce policies** at CI/CD gates

## Compliance Frameworks

This package supports automation for:

- **SOC 2 Type II** - Security, Availability, Processing Integrity, Confidentiality, Privacy
- **ISO 27001** - Information Security Management System
- **GDPR** - General Data Protection Regulation
- **HIPAA** - Health Insurance Portability and Accountability Act
- **PCI DSS** - Payment Card Industry Data Security Standard
- **NIST 800-53** - Security and Privacy Controls
- **CSA STAR** - Cloud Security Alliance Security, Trust & Assurance Registry

## Performance

- Encryption overhead: <1ms for typical operations
- Audit logging: Async with batch processing (5s default)
- Policy evaluation: <10ms for typical rulesets
- Threat detection: Real-time with streaming analysis

## License

MIT

## Support

For issues, questions, or contributions, please visit the [ClaudeFlare repository](https://github.com/claudeflare/claudeflare).
