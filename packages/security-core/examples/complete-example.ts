/**
 * Complete Example: Using Security Core Package
 *
 * This example demonstrates how to use all major features of the Security Core package
 */

import {
  SecretsManager,
  InMemorySecretStorage,
  ConsoleAuditLogger,
  EncryptionEngine,
  CryptoUtils,
  AuditLogger,
  AuditEventBuilder,
  AuditEventType,
  AuditCategory,
  AuditSeverity,
  AuditOutcome,
  PrincipalType,
  ComplianceAutomationEngine,
  InMemoryPolicyStore,
  PolicyEnforcer,
  CICDGateChecker,
  ThreatDetector,
  DataClassificationHelper,
  SecurityValidator,
  ComplianceHelper,
  EncryptionAlgorithm,
  HashAlgorithm,
  ComplianceFramework,
  PolicyCategory,
  ControlStatus,
  AssessmentResult,
  FindingSeverity,
  DataClassification,
} from '../src';

// ============================================================================
// EXAMPLE 1: SECRETS MANAGEMENT
// ============================================================================

async function secretsManagementExample() {
  console.log('\n=== Secrets Management Example ===\n');

  // Create a secrets manager
  const secretsManager = new SecretsManager({
    storage: new InMemorySecretStorage(),
    auditLogger: new ConsoleAuditLogger(),
    encryptionRequired: true,
    accessLoggingEnabled: true,
    defaultRotationDays: 90,
  });

  // Create a secret
  const secret = await secretsManager.createSecret({
    name: 'database-password',
    value: 'SuperSecurePassword123!',
    description: 'Production database password',
    createdBy: 'admin-123',
    tags: {
      environment: 'production',
      service: 'database',
    },
    accessPolicy: {
      allowedPrincipals: ['admin-123', 'db-admin-456'],
      requireMfa: true,
      auditAccess: true,
      allowedOperations: ['read', 'write', 'rotate'] as any,
      allowedIpRanges: ['10.0.0.0/8'],
    },
    rotationPolicy: {
      enabled: true,
      intervalDays: 90,
      automaticRotation: false,
      notificationDaysBefore: 7,
      gracePeriodDays: 30,
    },
  });

  console.log('Created secret:', {
    id: secret.id,
    name: secret.name,
    version: secret.version,
    checksum: secret.checksum,
  });

  // Retrieve the secret
  const retrieved = await secretsManager.getSecret('database-password', 'admin-123');
  console.log('Retrieved secret value:', retrieved.currentVersion.value);

  // List secrets
  const secrets = await secretsManager.listSecrets({ tags: { environment: 'production' } });
  console.log('Production secrets:', secrets.length);

  // Rotate secret
  const rotated = await secretsManager.rotateSecret(
    'database-password',
    'admin-123',
    'NewSecurePassword456!'
  );
  console.log('Rotated secret - new version:', rotated.version);

  // Create temporary credential for sharing
  const credential = await secretsManager.createTemporaryCredential({
    secretId: secret.id,
    principalId: 'temp-user-789',
    requesterId: 'admin-123',
    expiresAt: new Date(Date.now() + 3600000), // 1 hour
    permissions: ['read'] as any,
    maxUses: 5,
    justification: 'Temporary access for maintenance',
  });
  console.log('Created temporary credential:', credential.credentialId);
}

// ============================================================================
// EXAMPLE 2: ENCRYPTION
// ============================================================================

async function encryptionExample() {
  console.log('\n=== Encryption Example ===\n');

  const encryption = new EncryptionEngine({
    defaultAlgorithm: EncryptionAlgorithm.AES_256_GCM,
    fipsCompliant: false,
  });

  // Encrypt sensitive data
  const plaintext = 'This is highly sensitive information';
  const key = await encryption.generateKey(32);

  const encrypted = await encryption.encryptAES256GCM(plaintext, key);
  console.log('Encrypted data:', {
    algorithm: encrypted.algorithm,
    keyId: encrypted.keyId,
    ciphertextLength: encrypted.encryptedData.ciphertext.length,
  });

  // Decrypt data
  const decrypted = await encryption.decryptAES256GCM(encrypted.encryptedData, key);
  console.log('Decrypted text:', decrypted.plaintext.toString('utf8'));

  // Hash data
  const hash = await encryption.hashHex('password123', HashAlgorithm.SHA256);
  console.log('SHA-256 hash:', hash);

  // Generate HMAC
  const hmac = await encryption.generateHACHex('message', key);
  console.log('HMAC:', hmac);

  // Derive key from password
  const salt = await encryption.generateKey(16);
  const derivedKey = await encryption.deriveKeyPBKDF2('my-password', salt, 100000, 32);
  console.log('Derived key length:', derivedKey.length);

  // Generate RSA key pair
  const keyPair = await encryption.generateRSAKeyPair(2048);
  console.log('Generated RSA key pair:', keyPair.keyId);

  // Generate secure random values
  const token = await encryption.generateSecureRandom({
    length: 32,
    type: 'url-safe',
  });
  console.log('Secure token:', token);

  const password = await encryption.generatePassword(16, {
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
  });
  console.log('Generated password:', password);
}

// ============================================================================
// EXAMPLE 3: AUDIT LOGGING
// ============================================================================

async function auditLoggingExample() {
  console.log('\n=== Audit Logging Example ===\n');

  const auditLogger = new AuditLogger({
    source: 'claudeflare-api',
    environment: 'production',
    platform: 'claudeflare',
    version: '1.0.0',
    asyncLogging: true,
    flushInterval: 5000,
    retentionDays: 90,
  });

  // Log authentication event
  const authEvent = await auditLogger.log(
    new AuditEventBuilder()
      .setEventType(AuditEventType.AUTHENTICATION)
      .setCategory(AuditCategory.SECURITY)
      .setSeverity(AuditSeverity.HIGH)
      .setPrincipal({
        id: 'user-123',
        type: PrincipalType.USER,
        name: 'john.doe',
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
      })
      .setResource({
        id: 'auth-system',
        type: 'authentication_service',
        name: 'Authentication Service',
      })
      .setAction('user_login')
      .setOutcome(AuditOutcome.SUCCESS)
      .setDetails({
        method: 'password',
        mfaVerified: true,
      })
      .setCorrelationId('corr-123')
      .build()
  );
  console.log('Logged auth event:', authEvent);

  // Log data access event
  const dataAccessEvent = await auditLogger.log(
    new AuditEventBuilder()
      .setEventType(AuditEventType.DATA_ACCESS)
      .setCategory(AuditCategory.PRIVACY)
      .setSeverity(AuditSeverity.MEDIUM)
      .setPrincipal({
        id: 'user-123',
        type: PrincipalType.USER,
        name: 'john.doe',
      })
      .setResource({
        id: 'customer-record-456',
        type: 'customer_record',
        name: 'Customer Record',
        classification: DataClassification.CONFIDENTIAL,
      })
      .setAction('read')
      .setOutcome(AuditOutcome.SUCCESS)
      .setDetails({
        fieldsAccessed: ['name', 'email', 'phone'],
      })
      .build()
  );
  console.log('Logged data access event:', dataAccessEvent);

  // Query audit logs
  const query = {
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    endDate: new Date(),
    eventTypes: [AuditEventType.AUTHENTICATION],
    limit: 10,
  };
  const events = await auditLogger.query(query);
  console.log('Found events:', events.length);

  // Generate audit report
  const report = await auditLogger.generateReport({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.GDPR],
  });
  console.log('Audit report:', {
    reportId: report.reportId,
    totalEvents: report.summary.totalEvents,
    complianceMappings: report.complianceMappings.length,
  });

  await auditLogger.close();
}

// ============================================================================
// EXAMPLE 4: COMPLIANCE AUTOMATION
// ============================================================================

async function complianceExample() {
  console.log('\n=== Compliance Automation Example ===\n');

  const complianceEngine = new ComplianceAutomationEngine({
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001],
    autoAssessmentEnabled: true,
    assessmentIntervalDays: 90,
    evidenceCollectionEnabled: true,
    reportingEnabled: true,
  });

  // Get controls for a framework
  const soc2Controls = complianceEngine.getControls(ComplianceFramework.SOC2);
  console.log('SOC 2 controls:', soc2Controls.length);

  // Get a specific control
  const control = complianceEngine.getControl(
    ComplianceFramework.SOC2,
    'CC-6.1'
  );
  console.log('Control:', control?.title, control?.status);

  // Run assessments
  const assessments = await complianceEngine.runAssessments(ComplianceFramework.SOC2);
  console.log('Completed assessments:', assessments.length);

  // Generate compliance report
  const report = await complianceEngine.generateReport(ComplianceFramework.SOC2, {
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    end: new Date(),
  });
  console.log('Compliance report:', {
    framework: report.framework,
    totalControls: report.summary.totalControls,
    compliantPercentage: report.summary.compliancePercentage,
    criticalFindings: report.summary.criticalFindings,
  });

  // Get controls needing attention
  const needsAttention = complianceEngine.getControlsNeedingAttention(
    ComplianceFramework.SOC2
  );
  console.log('Controls needing attention:', needsAttention.length);
}

// ============================================================================
// EXAMPLE 5: SECURITY POLICIES
// ============================================================================

async function policiesExample() {
  console.log('\n=== Security Policies Example ===\n');

  const policyStore = new InMemoryPolicyStore();
  const enforcer = new PolicyEnforcer({
    policyStore,
    enforcementMode: 'enforced' as any,
    allowOverrides: false,
    violationAction: 'block' as any,
  });

  // Create policy from template
  const mfaPolicy = await enforcer.createFromTemplate('enforce-mfa', {
    scope: {
      environments: ['production'],
    },
  });
  console.log('Created MFA policy:', mfaPolicy.name);

  const encryptionPolicy = await enforcer.createFromTemplate('encrypt-data-at-rest');
  console.log('Created encryption policy:', encryptionPolicy.name);

  // Evaluate policies
  const context = {
    resource: {
      id: 'database-1',
      type: 'database',
      name: 'Production Database',
      attributes: { encrypted: true },
    },
    principal: {
      id: 'user-123',
      roles: ['admin'],
      permissions: ['database:read', 'database:write'],
      attributes: { mfaVerified: false },
    },
    action: 'database:write',
    environment: 'production',
    timestamp: new Date(),
  };

  const results = await enforcer.evaluate(context);
  console.log('Policy evaluation results:', results.length);

  for (const result of results) {
    console.log(`- ${result.policyName}: ${result.passed ? 'PASS' : 'FAIL'}`);
    if (!result.passed) {
      result.violations.forEach(v => {
        console.log(`  Violation: ${v.message} (${v.severity})`);
      });
    }
  }

  // CI/CD gate checks
  const gateChecker = new CICDGateChecker(enforcer);
  const preDeployResult = await gateChecker.preDeployCheck(context);
  console.log('Pre-deploy gate check:', preDeployResult.passed ? 'PASS' : 'FAIL');
}

// ============================================================================
// EXAMPLE 6: THREAT DETECTION
// ============================================================================

async function threatDetectionExample() {
  console.log('\n=== Threat Detection Example ===\n');

  const threatDetector = new ThreatDetector({
    anomalyDetectionEnabled: true,
    intelligenceFeeds: [],
    autoResponseEnabled: false,
    alertOnDetection: true,
  });

  // Simulate metric recording and anomaly detection
  const baseline = threatDetector['anomalyDetector']['baselineCalculator'];

  // Establish baseline with normal traffic
  for (let i = 0; i < 100; i++) {
    baseline.addMetric('api.request_rate', Math.floor(Math.random() * 20) + 80); // 80-100 req/s
  }

  // Normal request
  const normalAnomaly = await threatDetector['anomalyDetector'].detectAnomaly('api.request_rate', 95);
  console.log('Normal request anomaly:', normalAnomaly ? 'DETECTED' : 'None');

  // Anomalous request (spike)
  const spikeAnomaly = await threatDetector['anomalyDetector'].detectAnomaly('api.request_rate', 500);
  console.log('Spike anomaly:', spikeAnomaly ? 'DETECTED' : 'None');

  if (spikeAnomaly) {
    console.log('  Severity:', spikeAnomaly.severity);
    console.log('  Confidence:', spikeAnomaly.confidence);
    console.log('  Description:', spikeAnomaly.description);
  }

  // Get all threats
  const threats = threatDetector.getThreats({ status: 'detected' as any });
  console.log('Active threats:', threats.length);
}

// ============================================================================
// EXAMPLE 7: UTILITY FUNCTIONS
// ============================================================================

async function utilityHelpersExample() {
  console.log('\n=== Utility Helpers Example ===\n');

  // Data classification
  const ssnData = 'SSN: 123-45-6789';
  const ssnClassification = DataClassificationHelper.classifyData(ssnData);
  console.log('SSN classification:', ssnClassification);

  const emailData = 'Contact: user@example.com';
  const emailClassification = DataClassificationHelper.classifyData(emailData);
  console.log('Email classification:', emailClassification);

  // Password validation
  const passwordResult = SecurityValidator.validatePassword('MyStr0ng!Pass');
  console.log('Password validation:', passwordResult.valid, passwordResult.score);
  if (!passwordResult.valid) {
    console.log('  Feedback:', passwordResult.feedback);
  }

  // Email validation
  const emailValid = SecurityValidator.validateEmail('user@example.com');
  console.log('Email validation:', emailValid);

  // Input sanitization
  const dirty = '<script>alert("XSS")</script>Hello';
  const clean = SecurityValidator.sanitizeInput(dirty);
  console.log('Sanitized input:', clean);

  // Audit helpers
  const severity = AuditHelper.determineSeverity('authentication', 'failure');
  console.log('Audit severity:', severity);

  const correlationId = AuditHelper.generateCorrelationId();
  console.log('Correlation ID:', correlationId);

  const masked = AuditHelper.maskSensitiveData({
    username: 'john',
    password: 'secret123',
  });
  console.log('Masked data:', masked);

  // Compliance helpers
  const gdprCheck = ComplianceHelper.checkGDPRCompliance(DataClassification.HIGHLY_CONFIDENTIAL);
  console.log('GDPR compliance:', gdprCheck.compliant);
  if (!gdprCheck.compliant) {
    console.log('  Requirements:', gdprCheck.requirements);
  }

  const checklist = ComplianceHelper.generateChecklist(['soc2', 'iso27001']);
  console.log('Compliance checklists:', checklist.length);
  checklist.forEach(cl => {
    console.log(`  ${cl.framework}: ${cl.items.length} items`);
  });
}

// ============================================================================
// EXAMPLE 8: CRYPTO UTILITIES QUICK HELPERS
// ============================================================================

async function cryptoUtilsExample() {
  console.log('\n=== Crypto Utils Quick Helpers ===\n');

  // Quick encryption/decryption
  const plaintext = 'Sensitive data';
  const key = Buffer.from('01234567890123456789012345678901'); // 32 bytes

  const encrypted = await CryptoUtils.encrypt(plaintext, key);
  console.log('Encrypted:', encrypted.substring(0, 50) + '...');

  const decrypted = await CryptoUtils.decrypt(encrypted, key);
  console.log('Decrypted:', decrypted);

  // Quick hash
  const hash = await CryptoUtils.hash('password123');
  console.log('Hash:', hash);

  // Generate token
  const token = await CryptoUtils.generateToken(32);
  console.log('Token:', token);

  // Generate UUID
  const uuid = CryptoUtils.generateUUID();
  console.log('UUID:', uuid);
}

// ============================================================================
// RUN ALL EXAMPLES
// ============================================================================

async function main() {
  try {
    await secretsManagementExample();
    await encryptionExample();
    await auditLoggingExample();
    await complianceExample();
    await policiesExample();
    await threatDetectionExample();
    await utilityHelpersExample();
    await cryptoUtilsExample();

    console.log('\n=== All examples completed successfully! ===\n');
  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  main();
}

export {
  secretsManagementExample,
  encryptionExample,
  auditLoggingExample,
  complianceExample,
  policiesExample,
  threatDetectionExample,
  utilityHelpersExample,
  cryptoUtilsExample,
};
