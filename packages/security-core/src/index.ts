/**
 * Security Core - Enterprise-grade security and compliance for ClaudeFlare
 *
 * This package provides comprehensive security capabilities including:
 * - Secrets Management
 * - Encryption Utilities
 * - Authentication & Authorization
 * - Audit Logging
 * - Compliance Automation
 * - Security Policies
 * - Threat Detection
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export * from './types';

// ============================================================================
// SECRETS MANAGEMENT
// ============================================================================

export {
  SecretsManager,
  CloudflareSecretStorage,
  InMemorySecretStorage,
  ConsoleAuditLogger,
} from './secrets/manager';

export type {
  SecretsManagerConfig,
  SecretStorage,
  SecretAuditLogger,
} from './secrets/manager';

// ============================================================================
// ENCRYPTION
// ============================================================================

export {
  EncryptionEngine,
  CryptoUtils,
} from './encryption/crypto';

export type {
  EncryptionConfig,
} from './encryption/crypto';

// ============================================================================
// AUTHENTICATION & AUTHORIZATION
// ============================================================================

export {
  TokenManager,
  InMemoryUserStore,
  AuthService,
  AuthorizationService,
  MfaService,
  InMemorySessionStore,
  SessionManager,
  OAuth2Helper,
} from './auth/authz';

export type {
  TokenConfig,
  UserStore,
  AuthServiceConfig,
  AuthorizationServiceConfig,
  SessionStore,
  OAuth2Config,
} from './auth/authz';

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export {
  AuditLogger,
  InMemoryAuditStorage,
  AuditEventBuilder,
  AuditMiddleware,
  AlertingSystem,
} from './audit/logger';

export type {
  AuditEventStorage,
  AuditLoggerConfig,
  AuditContext,
  AlertRule,
  AlertCondition,
  Alert,
} from './audit/logger';

// ============================================================================
// COMPLIANCE AUTOMATION
// ============================================================================

export {
  ComplianceAutomationEngine,
  AutomatedEvidenceCollector,
  CONTROLS_LIBRARY,
} from './compliance/automation';

export type {
  ControlDefinition,
  EvidenceCollector,
  ComplianceAutomationConfig,
} from './compliance/automation';

// ============================================================================
// SECURITY POLICIES
// ============================================================================

export {
  InMemoryPolicyStore,
  PolicyEnforcer,
  CICDGateChecker,
  POLICY_TEMPLATES,
} from './policies/enforcer';

export type {
  PolicyTemplate,
  PolicyEvaluationContext,
  PolicyStore,
  PolicyEnforcerConfig,
  GateCheckResult,
} from './policies/enforcer';

// ============================================================================
// THREAT DETECTION
// ============================================================================

export {
  BaselineCalculator,
  AnomalyDetector,
  ThreatDetector,
  MockThreatFeed,
} from './threats/detector';

export type {
  MetricDataPoint,
  AnomalyDetectionConfig,
  ThreatFeed,
  ThreatDetectorConfig,
} from './threats/detector';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export {
  DataClassificationHelper,
  SecurityValidator,
  AuditHelper,
  EncryptionHelper,
  ComplianceHelper,
} from './utils/helpers';

// ============================================================================
// CONVENIENCE FACTORIES
// ============================================================================

import { SecretsManager } from './secrets/manager';
import { EncryptionEngine } from './encryption/crypto';
import { AuditLogger } from './audit/logger';
import { ComplianceAutomationEngine } from './compliance/automation';
import { InMemoryPolicyStore, PolicyEnforcer } from './policies/enforcer';
import { ThreatDetector } from './threats/detector';
import type { SecurityConfig } from './types';

/**
 * Create a complete security suite with default configuration
 */
export function createSecuritySuite(config: Partial<SecurityConfig> = {}) {
  const fullConfig: SecurityConfig = {
    secrets: {
      provider: 'cloudflare',
      defaultRotationDays: 90,
      autoRotationEnabled: true,
      encryptionRequired: true,
      accessLoggingEnabled: true,
      quotaLimit: 1000,
      ...config.secrets,
    },
    encryption: {
      defaultAlgorithm: 'aes-256-gcm' as any,
      keyRotationDays: 90,
      keyDerivationAlgorithm: 'pbkdf2' as any,
      fipsCompliant: false,
      keyManagementService: 'builtin',
      ...config.encryption,
    },
    auth: {
      jwtIssuer: 'claudeflare',
      jwtAudience: ['claudeflare-api'],
      jwtExpirySeconds: 3600,
      mfaRequired: false,
      mfaMethods: ['totp' as any],
      sessionTimeoutMinutes: 60,
      maxFailedAttempts: 5,
      lockoutDurationMinutes: 15,
      ...config.auth,
    },
    audit: {
      enabled: true,
      retentionDays: 90,
      logLevel: 'info' as any,
      asyncLogging: true,
      batchSize: 100,
      flushIntervalMs: 5000,
      exportEnabled: false,
      exportFormat: 'json',
      ...config.audit,
    },
    compliance: {
      frameworks: [],
      autoAssessmentEnabled: true,
      assessmentIntervalDays: 90,
      evidenceCollectionEnabled: true,
      reportingEnabled: true,
      notificationEmails: [],
      ...config.compliance,
    },
    policies: {
      enforcementMode: 'enforced' as any,
      allowExceptions: false,
      exceptionApprovalRequired: true,
      gateChecksEnabled: true,
      violationAction: 'block' as any,
      ...config.policies,
    },
    threats: {
      detectionEnabled: true,
      responseEnabled: false,
      autoMitigation: false,
      intelligenceFeeds: [],
      anomalyDetectionEnabled: true,
      baselineWindowDays: 7,
      sensitivityThreshold: 3,
      ...config.threats,
    },
  };

  return {
    secrets: new SecretsManager({
      encryptionRequired: fullConfig.secrets.encryptionRequired,
      accessLoggingEnabled: fullConfig.secrets.accessLoggingEnabled,
      defaultRotationDays: fullConfig.secrets.defaultRotationDays,
    }),

    encryption: new EncryptionEngine({
      defaultAlgorithm: fullConfig.encryption.defaultAlgorithm,
      keyRotationDays: fullConfig.encryption.keyRotationDays,
      fipsCompliant: fullConfig.encryption.fipsCompliant,
    }),

    audit: new AuditLogger({
      source: 'claudeflare-security',
      environment: process.env.NODE_ENV || 'development',
      platform: 'claudeflare',
      version: '1.0.0',
      asyncLogging: fullConfig.audit.asyncLogging,
      flushInterval: fullConfig.audit.flushIntervalMs,
      bufferSize: fullConfig.audit.batchSize,
      retentionDays: fullConfig.audit.retentionDays,
    }),

    compliance: new ComplianceAutomationEngine({
      frameworks: fullConfig.compliance.frameworks,
      autoAssessmentEnabled: fullConfig.compliance.autoAssessmentEnabled,
      assessmentIntervalDays: fullConfig.compliance.assessmentIntervalDays,
      evidenceCollectionEnabled: fullConfig.compliance.evidenceCollectionEnabled,
      reportingEnabled: fullConfig.compliance.reportingEnabled,
    }),

    policies: {
      store: new InMemoryPolicyStore(),
      enforcer: null as PolicyEnforcer | null,
    },

    threats: null as ThreatDetector | null,

    initialize() {
      // Initialize policy enforcer
      this.policies.enforcer = new PolicyEnforcer({
        policyStore: this.policies.store,
        enforcementMode: fullConfig.policies.enforcementMode,
        allowOverrides: fullConfig.policies.allowExceptions,
        violationAction: fullConfig.policies.violationAction,
      });

      // Initialize threat detector
      if (fullConfig.threats.detectionEnabled) {
        this.threats = new ThreatDetector({
          anomalyDetectionEnabled: fullConfig.threats.anomalyDetectionEnabled,
          intelligenceFeeds: fullConfig.threats.intelligenceFeeds as any,
          autoResponseEnabled: fullConfig.threats.autoMitigation,
          alertOnDetection: true,
        });
      }

      return this;
    },
  };
}

// ============================================================================
// VERSION
// ============================================================================

export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  VERSION,
  BUILD_DATE,
  createSecuritySuite,
};
