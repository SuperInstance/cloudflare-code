/**
 * ClaudeFlare Audit Logging - Ultra-Optimized
 * Enterprise-grade audit logging and compliance
 */

export * from './types';

// Core components (minimal exports)
export { IAuditCollector, createAuditCollector } from './collector';
export { ImmutableAuditLogStorage, createAuditLogStorage } from './storage';
export { ComplianceReportGenerator } from './reports';
export { AuditLogSearchEngine } from './search';
export { AuditEventStream } from './streams';
export { ChangeTrackingSystem } from './tracking';

// Main system
export { AuditSystem, createAuditSystem } from './system';

export const VERSION = '1.0.0';
export default AuditSystem;
