/**
 * Security Core - Ultra-Optimized
 * Essential security capabilities
 */

export * from './types';

// Core exports (minimal)
export { SecretsManager, CloudflareSecretStorage } from './secrets/manager';
export { EncryptionEngine, CryptoUtils } from './encryption/crypto';
export { AuthService, AuthorizationService, SessionManager } from './auth/authz';
export { AuditLogger, AuditMiddleware } from './audit/logger';
export { ComplianceAutomationEngine } from './compliance/automation';
// export { SecurityPolicyEngine } from './policies/engine'; // Commented out - module doesn't exist

export const VERSION = '1.0.0';