/**
 * Audit Module
 * Main entry point for audit logging functionality
 */

// Re-export all types
export * from '../types';

// Re-export audit service
export {
  AuditService,
  AuditServiceFactory,
  type EventContext,
  type AuditServiceOptions,
} from './audit-service';
