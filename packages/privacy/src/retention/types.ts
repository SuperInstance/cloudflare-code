// @ts-nocheck
/**
 * Data Retention Policy types for GDPR compliance
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// RETENTION POLICY TYPES
// ============================================================================

/**
 * Retention action types
 */
export enum RetentionAction {
  DELETE = 'delete', // Delete data after retention period
  ARCHIVE = 'archive', // Archive data after retention period
  ANONYMIZE = 'anonymize', // Anonymize data after retention period
  AGGREGATE = 'aggregate', // Aggregate data after retention period
}

/**
 * Retention trigger types
 */
export enum RetentionTrigger {
  ACCOUNT_CLOSURE = 'account_closure', // Retention period starts when account is closed
  LAST_ACTIVITY = 'last_activity', // Retention period starts from last activity
  CREATION_DATE = 'creation_date', // Retention period starts from data creation
  FIXED_DATE = 'fixed_date', // Fixed retention date
  LEGAL_EVENT = 'legal_event', // Retention period starts from a legal event
  CONSENT_WITHDRAWN = 'consent_withdrawn', // Retention period starts when consent is withdrawn
}

/**
 * Data category for retention
 */
export enum RetentionCategory {
  PERSONAL_DATA = 'personal_data',
  IDENTIFICATION_DATA = 'identification_data',
  CONTACT_DATA = 'contact_data',
  FINANCIAL_DATA = 'financial_data',
  TRANSACTION_DATA = 'transaction_data',
  COMMUNICATION_DATA = 'communication_data',
  USAGE_DATA = 'usage_data',
  BEHAVIORAL_DATA = 'behavioral_data',
  TECHNICAL_DATA = 'technical_data',
  LOCATION_DATA = 'location_data',
  PROFILE_DATA = 'profile_data',
  HEALTH_DATA = 'health_data',
  BIOMETRIC_DATA = 'biometric_data',
  SUPPORT_TICKETS = 'support_tickets',
  MARKETING_DATA = 'marketing_data',
  ANALYTICS_DATA = 'analytics_data',
  LOGS = 'logs',
  BACKUPS = 'backups',
}

/**
 * Legal basis for retention
 */
export enum RetentionBasis {
  LEGAL_OBLIGATION = 'legal_obligation', // Retain for legal requirements
  CONTRACTUAL = 'contractual', // Retain for contractual obligations
  LEGITIMATE_INTEREST = 'legitimate_interest', // Retain for legitimate interests
  CONSENT = 'consent', // Retain based on user consent
  PUBLIC_TASK = 'public_task', // Retain for public task
  VITAL_INTERESTS = 'vital_interests', // Retain for vital interests
}

// ============================================================================
// RETENTION POLICY
// ============================================================================

/**
 * Data retention policy
 * GDPR Article 5(1)(e): Storage limitation - personal data must be kept no longer than necessary
 */
export interface RetentionPolicy {
  /** Unique policy identifier */
  id: string;
  /** Policy name */
  name: string;
  /** Policy description */
  description: string;
  /** Data category this policy applies to */
  category: RetentionCategory;
  /** Retention period in milliseconds */
  retentionPeriod: number;
  /** Retention action */
  action: RetentionAction;
  /** What triggers the retention period */
  trigger: RetentionTrigger;
  /** Legal basis for retention */
  legalBasis: RetentionBasis;
  /** Legal basis description */
  legalBasisDescription: string;
  /** Whether policy is active */
  active: boolean;
  /** Priority (higher = more important) */
  priority: number;
  /** Systems this policy applies to */
  systems: string[];
  /** Data tables/collections this applies to */
  tables: string[];
  /** Exceptions to the policy */
  exceptions: RetentionException[];
// Whether legal hold overrides this policy */
  legalHoldOverride: boolean;
  /** Policy version */
  version: string;
  /** Policy creation timestamp (Unix ms) */
  createdAt: number;
  /** Policy last updated timestamp (Unix ms) */
  updatedAt: number;
  /** Policy review date (Unix ms) */
  reviewDate?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Zod schema for RetentionPolicy validation
 */
export const RetentionPolicySchema: z.ZodType<RetentionPolicy> = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.nativeEnum(RetentionCategory),
  retentionPeriod: z.number().positive(),
  action: z.nativeEnum(RetentionAction),
  trigger: z.nativeEnum(RetentionTrigger),
  legalBasis: z.nativeEnum(RetentionBasis),
  legalBasisDescription: z.string().min(1),
  active: z.boolean(),
  priority: z.number().int().min(0),
  systems: z.array(z.string()),
  tables: z.array(z.string()),
  exceptions: z.array(RetentionExceptionSchema),
  legalHoldOverride: z.boolean(),
  version: z.string().min(1),
  createdAt: z.number().nonnegative(),
  updatedAt: z.number().nonnegative(),
  reviewDate: z.number().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Exception to retention policy
 */
export interface RetentionException {
  /** Exception identifier */
  id: string;
// Exception condition */
  condition: string;
// Description of exception */
  description: string;
// Whether exception extends retention period */
  extendsRetention: boolean;
// Extended retention period (if applicable) */
  extendedPeriod?: number;
// Whether exception prevents deletion */
  preventsDeletion: boolean;
}

/**
 * Zod schema for RetentionException validation
 */
export const RetentionExceptionSchema = z.object({
  id: z.string().uuid(),
  condition: z.string().min(1),
  description: z.string().min(1),
  extendsRetention: z.boolean(),
  extendedPeriod: z.number().positive().optional(),
  preventsDeletion: z.boolean(),
});

// ============================================================================
// RETENTION SCHEDULE
// ============================================================================

/**
 * Scheduled retention task
 */
export interface RetentionSchedule {
  /** Schedule identifier */
  id: string;
  /** Policy ID this schedule is for */
  policyId: string;
  /** User/subject ID (optional, null = applies to all) */
  subjectId?: string;
// Scheduled execution timestamp (Unix ms) */
  scheduledFor: number;
  /** Schedule status */
  status: ScheduleStatus;
  /** Schedule creation timestamp (Unix ms) */
  createdAt: number;
  /** Number of retries */
  retries: number;
  /** Maximum retries allowed */
  maxRetries: number;
  /** Last error message */
  lastError?: string;
  /** Execution result (after completion) */
  result?: RetentionResult;
}

/**
 * Zod schema for RetentionSchedule validation
 */
export const RetentionScheduleSchema = z.object({
  id: z.string().uuid(),
  policyId: z.string().uuid(),
  subjectId: z.string().optional(),
  scheduledFor: z.number().nonnegative(),
  status: z.nativeEnum(ScheduleStatus),
  createdAt: z.number().nonnegative(),
  retries: z.number().nonnegative(),
  maxRetries: z.number().nonnegative(),
  lastError: z.string().optional(),
  result: RetentionResultSchema.optional(),
});

/**
 * Schedule status
 */
export enum ScheduleStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SKIPPED = 'skipped',
}

/**
 * Retention execution result
 */
export interface RetentionResult {
  /** Execution timestamp (Unix ms) */
  executedAt: number;
  /** Number of records processed */
  recordsProcessed: number;
  /** Number of records deleted */
  recordsDeleted: number;
  /** Number of records archived */
  recordsArchived: number;
  /** Number of records anonymized */
  recordsAnonymized: number;
  /** Number of records aggregated */
  recordsAggregated: number;
  /** Number of records skipped due to exceptions */
  recordsSkipped: number;
  /** Duration in milliseconds */
  duration: number;
  /** Whether execution was successful */
  success: boolean;
  /** Error message if failed */
  errorMessage?: string;
// Exceptions that occurred */
  exceptions: RetentionExecutionException[];
}

/**
 * Zod schema for RetentionResult validation
 */
export const RetentionResultSchema = z.object({
  executedAt: z.number().nonnegative(),
  recordsProcessed: z.number().nonnegative(),
  recordsDeleted: z.number().nonnegative(),
  recordsArchived: z.number().nonnegative(),
  recordsAnonymized: z.number().nonnegative(),
  recordsAggregated: z.number().nonnegative(),
  recordsSkipped: z.number().nonnegative(),
  duration: z.number().nonnegative(),
  success: z.boolean(),
  errorMessage: z.string().optional(),
  exceptions: z.array(RetentionExecutionExceptionSchema),
});

/**
 * Exception during retention execution
 */
export interface RetentionExecutionException {
  /** Record identifier */
  recordId: string;
  /** Exception reason */
  reason: string;
// Whether record was retained due to exception */
  retained: boolean;
}

/**
 * Zod schema for RetentionExecutionException validation
 */
export const RetentionExecutionExceptionSchema = z.object({
  recordId: z.string(),
  reason: z.string(),
  retained: z.boolean(),
});

// ============================================================================
// LEGAL HOLD
// ============================================================================

/**
 * Legal hold on data retention
 * Prevents deletion even when retention period expires
 */
export interface LegalHold {
  /** Legal hold identifier */
  id: string;
  /** User/subject ID this applies to */
  subjectId: string;
// Legal hold name/title */
  name: string;
  /** Legal hold description */
  description: string;
// Case reference */
  caseReference?: string;
// Legal hold type */
  type: LegalHoldType;
  /** Whether hold is active */
  active: boolean;
  /** Hold creation timestamp (Unix ms) */
  createdAt: number;
  /** Hold expiry timestamp (Unix ms, optional) */
  expiresAt?: number;
// User who placed the hold */
  createdBy: string;
// Hold notes */
  notes?: string[];
// Data categories affected */
  categories?: RetentionCategory[];
// Systems affected */
  systems?: string[];
}

/**
 * Zod schema for LegalHold validation
 */
export const LegalHoldSchema = z.object({
  id: z.string().uuid(),
  subjectId: z.string(),
  name: z.string().min(1),
  description: z.string().min(1),
  caseReference: z.string().optional(),
  type: z.nativeEnum(LegalHoldType),
  active: z.boolean(),
  createdAt: z.number().nonnegative(),
  expiresAt: z.number().nonnegative().optional(),
  createdBy: z.string(),
  notes: z.array(z.string()).optional(),
  categories: z.array(z.nativeEnum(RetentionCategory)).optional(),
  systems: z.array(z.string()).optional(),
});

/**
 * Legal hold types
 */
export enum LegalHoldType {
  LITIGATION = 'litigation', // Litigation hold
  INVESTIGATION = 'investigation', // Investigation hold
  AUDIT = 'audit', // Audit hold
  REGULATORY = 'regulatory', // Regulatory hold
  GOVERNMENT_REQUEST = 'government_request', // Government request hold
  OTHER = 'other', // Other type of hold
}

// ============================================================================
// RETENTION STATISTICS
// ============================================================================

/**
 * Retention statistics for monitoring and reporting
 */
export interface RetentionStatistics {
  /** Timestamp of statistics (Unix ms) */
  timestamp: number;
  /** Total number of policies */
  totalPolicies: number;
  /** Active policies */
  activePolicies: number;
// Total scheduled tasks */
  totalScheduled: number;
  /** Pending scheduled tasks */
  pendingScheduled: number;
  /** Failed scheduled tasks */
  failedScheduled: number;
  /** Total records processed (all time) */
  totalRecordsProcessed: number;
  /** Total records deleted (all time) */
  totalRecordsDeleted: number;
  /** Total records archived (all time) */
  totalRecordsArchived: number;
  /** Total records anonymized (all time) */
  totalRecordsAnonymized: number;
  /** Active legal holds */
  activeLegalHolds: number;
  /** Records under legal hold */
  recordsUnderLegalHold: number;
// Storage saved by retention (bytes) */
  storageSaved: number;
  /** Average processing time (ms) */
  averageProcessingTime: number;
}

/**
 * Zod schema for RetentionStatistics validation
 */
export const RetentionStatisticsSchema = z.object({
  timestamp: z.number().nonnegative(),
  totalPolicies: z.number().nonnegative(),
  activePolicies: z.number().nonnegative(),
  totalScheduled: z.number().nonnegative(),
  pendingScheduled: z.number().nonnegative(),
  failedScheduled: z.number().nonnegative(),
  totalRecordsProcessed: z.number().nonnegative(),
  totalRecordsDeleted: z.number().nonnegative(),
  totalRecordsArchived: z.number().nonnegative(),
  totalRecordsAnonymized: z.number().nonnegative(),
  activeLegalHolds: z.number().nonnegative(),
  recordsUnderLegalHold: z.number().nonnegative(),
  storageSaved: z.number().nonnegative(),
  averageProcessingTime: z.number().nonnegative(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type RetentionPolicyType = z.infer<typeof RetentionPolicySchema>;
export type RetentionExceptionType = z.infer<typeof RetentionExceptionSchema>;
export type RetentionScheduleType = z.infer<typeof RetentionScheduleSchema>;
export type RetentionResultType = z.infer<typeof RetentionResultSchema>;
export type RetentionExecutionExceptionType = z.infer<typeof RetentionExecutionExceptionSchema>;
export type LegalHoldType = z.infer<typeof LegalHoldSchema>;
export type RetentionStatisticsType = z.infer<typeof RetentionStatisticsSchema>;
