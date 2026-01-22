// @ts-nocheck
/**
 * Data Subject Rights types for GDPR compliance
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// GDPR DATA SUBJECT RIGHTS
// ============================================================================

/**
 * GDPR Article 15-20: Data Subject Rights
 */
export enum DataSubjectRight {
  RIGHT_TO_BE_INFORMED = 'right_to_be_informed', // Article 13 & 14
  RIGHT_OF_ACCESS = 'right_of_access', // Article 15
  RIGHT_TO_RECTIFICATION = 'right_to_rectification', // Article 16
  RIGHT_TO_ERASURE = 'right_to_erasure', // Article 17
  RIGHT_TO_RESTRICT_PROCESSING = 'right_to_restrict_processing', // Article 18
  RIGHT_TO_DATA_PORTABILITY = 'right_to_data_portability', // Article 20
  RIGHT_TO_OBJECT = 'right_to_object', // Article 21
  RIGHT_NOT_TO_BE_SUBJECT_TO_AUTOMATED_DECISION_MAKING = 'right_no_automated_decision', // Article 22
}

/**
 * Request status for data subject rights
 */
export enum RightRequestStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  AWAITING_VERIFICATION = 'awaiting_verification',
  PARTIALLY_COMPLETED = 'partially_completed',
  ON_HOLD = 'on_hold',
  CANCELLED = 'cancelled',
}

/**
 * Verification methods for identity confirmation
 */
export enum VerificationMethod {
  EMAIL = 'email',
  SMS = 'sms',
  PHONE = 'phone',
  ID_DOCUMENT = 'id_document',
  DIGITAL_SIGNATURE = 'digital_signature',
  TWO_FACTOR = 'two_factor',
  IN_PERSON = 'in_person',
  NOTARY = 'notary',
}

/**
 * Priority levels for processing requests
 */
export enum RequestPriority {
  URGENT = 'urgent', // Process within 24 hours
  HIGH = 'high', // Process within 3 days
  NORMAL = 'normal', // Process within 30 days (GDPR requirement)
  LOW = 'low', // Process within 45 days
}

// ============================================================================
// DATA SUBJECT REQUEST TYPES
// ============================================================================

/**
 * Base data subject request
 */
export interface DataSubjectRequest {
  /** Unique request identifier */
  id: string;
  /** Data subject identifier */
  subjectId: string;
  /** Type of right being exercised */
  rightType: DataSubjectRight;
  /** Request status */
  status: RightRequestStatus;
  /** Request creation timestamp (Unix ms) */
  createdAt: number;
  /** Last update timestamp (Unix ms) */
  updatedAt: number;
  /** When request was completed (Unix ms) */
  completedAt?: number;
  /** Request priority */
  priority: RequestPriority;
  /** Reason for request */
  reason?: string;
  /** Additional details */
  details?: string;
  /** Request scope (what data is affected) */
  scope: RequestScope;
  /** Verification status */
  verification: VerificationStatus;
  /** Processing steps completed */
  stepsCompleted: string[];
  /** Processing steps remaining */
  stepsRemaining: string[];
  /** Estimated completion time (Unix ms) */
  estimatedCompletion?: number;
  /** Assigned to user/team */
  assignedTo?: string;
  /** Request notes */
  notes?: RequestNote[];
  /** Related requests */
  relatedRequests?: string[];
  /** Third parties notified */
  thirdPartiesNotified?: string[];
  /** Legal hold status */
  legalHold?: boolean;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Zod schema for DataSubjectRequest validation
 */
export const DataSubjectRequestSchema: z.ZodType<DataSubjectRequest> = z.object({
  id: z.string().uuid(),
  subjectId: z.string(),
  rightType: z.nativeEnum(DataSubjectRight),
  status: z.nativeEnum(RightRequestStatus),
  createdAt: z.number().nonnegative(),
  updatedAt: z.number().nonnegative(),
  completedAt: z.number().nonnegative().optional(),
  priority: z.nativeEnum(RequestPriority),
  reason: z.string().optional(),
  details: z.string().optional(),
  scope: RequestScopeSchema,
  verification: VerificationStatusSchema,
  stepsCompleted: z.array(z.string()),
  stepsRemaining: z.array(z.string()),
  estimatedCompletion: z.number().nonnegative().optional(),
  assignedTo: z.string().optional(),
  notes: z.array(RequestNoteSchema).optional(),
  relatedRequests: z.array(z.string()).optional(),
  thirdPartiesNotified: z.array(z.string()).optional(),
  legalHold: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Request scope definition
 */
export interface RequestScope {
  /** Specific data categories affected */
  dataCategories: DataCategory[];
  /** Time period of data */
  dateRange?: {
    from: number;
    to: number;
  };
  /** Specific systems/services affected */
  systems?: string[];
  /** Specific data records (by ID) */
  recordIds?: string[];
  /** Whether to include third-party data */
  includeThirdParty: boolean;
  /** Whether to include deleted/archived data */
  includeArchived: boolean;
}

/**
 * Zod schema for RequestScope validation
 */
export const RequestScopeSchema = z.object({
  dataCategories: z.array(z.nativeEnum(DataCategory)),
  dateRange: z
    .object({
      from: z.number().nonnegative(),
      to: z.number().nonnegative(),
    })
    .optional(),
  systems: z.array(z.string()).optional(),
  recordIds: z.array(z.string()).optional(),
  includeThirdParty: z.boolean(),
  includeArchived: z.boolean(),
});

/**
 * Data categories under GDPR
 */
export enum DataCategory {
  PERSONAL_DATA = 'personal_data', // General personal data
  IDENTIFICATION_DATA = 'identification_data', // Name, ID, DOB
  CONTACT_DATA = 'contact_data', // Email, phone, address
  FINANCIAL_DATA = 'financial_data', // Payment, billing
  TECHNICAL_DATA = 'technical_data', // IP, device info
  PROFILE_DATA = 'profile_data', // User preferences, settings
  USAGE_DATA = 'usage_data', // Activity, interactions
  LOCATION_DATA = 'location_data', // Geolocation
  HEALTH_DATA = 'health_data', // Special category data
  BIOMETRIC_DATA = 'biometric_data', // Special category data
  COMMUNICATION_DATA = 'communication_data', // Messages, emails
  TRANSACTION_DATA = 'transaction_data', // Orders, purchases
  BEHAVIORAL_DATA = 'behavioral_data', // Browsing, clicks
  DERIVED_DATA = 'derived_data', // Inferences, profiles
  SOCIAL_DATA = 'social_data', // Social media connections
  EMPLOYMENT_DATA = 'employment_data', // Employment related
  EDUCATION_DATA = 'education_data', // Education related
}

/**
 * Identity verification status
 */
export interface VerificationStatus {
  /** Whether identity has been verified */
  verified: boolean;
  /** Verification method used */
  method: VerificationMethod;
  /** Verification timestamp (Unix ms) */
  verifiedAt?: number;
  /** Verification token/code */
  verificationToken?: string;
  /** Verification attempts */
  attempts: number;
  /** Maximum attempts allowed */
  maxAttempts: number;
  /** Verification details */
  details?: string;
}

/**
 * Zod schema for VerificationStatus validation
 */
export const VerificationStatusSchema = z.object({
  verified: z.boolean(),
  method: z.nativeEnum(VerificationMethod),
  verifiedAt: z.number().nonnegative().optional(),
  verificationToken: z.string().optional(),
  attempts: z.number().nonnegative(),
  maxAttempts: z.number().positive(),
  details: z.string().optional(),
});

/**
 * Request note attachment
 */
export interface RequestNote {
  /** Note identifier */
  id: string;
  /** Note content */
  content: string;
  /** Note author */
  author: string;
  /** Note timestamp (Unix ms) */
  timestamp: number;
  /** Note type */
  type: NoteType;
}

/**
 * Zod schema for RequestNote validation
 */
export const RequestNoteSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  author: z.string(),
  timestamp: z.number().nonnegative(),
  type: z.nativeEnum(NoteType),
});

/**
 * Note types
 */
export enum NoteType {
  INTERNAL = 'internal',
  COMMUNICATION = 'communication',
  STATUS_UPDATE = 'status_update',
  LEGAL = 'legal',
  TECHNICAL = 'technical',
}

// ============================================================================
// RIGHT TO ACCESS (ARTICLE 15)
// ============================================================================

/**
 * Right to access request details
 * GDPR Article 15: Right of access
 */
export interface RightToAccessRequest extends DataSubjectRequest {
  rightType: DataSubjectRight.RIGHT_OF_ACCESS;
  /** Whether to include copies of documents */
  includeCopies: boolean;
  /** Desired output format */
  outputFormat: OutputFormat;
  /** Whether to include metadata */
  includeMetadata: boolean;
  /** Whether to include processing purposes */
  includePurposes: boolean;
  /** Whether to include recipients */
  includeRecipients: boolean;
  /** Whether to include retention period */
  includeRetentionPeriod: boolean;
  /** Whether to include rights information */
  includeRights: boolean;
  /** Whether to include source information */
  includeSources: boolean;
  /** Whether to include automated decision making info */
  includeAutomatedDecisionMaking: boolean;
}

/**
 * Zod schema for RightToAccessRequest validation
 */
export const RightToAccessRequestSchema = DataSubjectRequestSchema.extend({
  rightType: z.literal(DataSubjectRight.RIGHT_OF_ACCESS),
  includeCopies: z.boolean(),
  outputFormat: z.nativeEnum(OutputFormat),
  includeMetadata: z.boolean(),
  includePurposes: z.boolean(),
  includeRecipients: z.boolean(),
  includeRetentionPeriod: z.boolean(),
  includeRights: z.boolean(),
  includeSources: z.boolean(),
  includeAutomatedDecisionMaking: z.boolean(),
});

/**
 * Data export output formats
 */
export enum OutputFormat {
  JSON = 'json',
  XML = 'xml',
  CSV = 'csv',
  PDF = 'pdf',
  HTML = 'html',
  PORTABLE_FORMAT = 'portable', // Machine-readable, interoperable format (GDPR Art 20)
}

/**
 * Result of a right to access request
 */
export interface DataAccessResult {
  /** Request ID */
  requestId: string;
  /** Data subject ID */
  subjectId: string;
  /** Export timestamp (Unix ms) */
  exportedAt: number;
  /** Data export format */
  format: OutputFormat;
  /** Export file location/URL */
  fileUrl?: string;
  /** Export size in bytes */
  fileSize?: number;
  /** Number of records exported */
  recordCount: number;
  /** Data categories included */
  dataCategories: DataCategory[];
  /** Summary of exported data */
  summary: DataSummary;
  /** Processing purposes */
  purposes?: string[];
  /** Data recipients */
  recipients?: DataRecipient[];
  /** Retention periods */
  retentionPeriods?: RetentionPeriod[];
  /** Automated decision making info */
  automatedDecisionMaking?: AutomatedDecisionInfo;
  /** Data sources */
  sources?: DataSource[];
}

/**
 * Zod schema for DataAccessResult validation
 */
export const DataAccessResultSchema = z.object({
  requestId: z.string().uuid(),
  subjectId: z.string(),
  exportedAt: z.number().nonnegative(),
  format: z.nativeEnum(OutputFormat),
  fileUrl: z.string().optional(),
  fileSize: z.number().nonnegative().optional(),
  recordCount: z.number().nonnegative(),
  dataCategories: z.array(z.nativeEnum(DataCategory)),
  summary: DataSummarySchema,
  purposes: z.array(z.string()).optional(),
  recipients: z.array(DataRecipientSchema).optional(),
  retentionPeriods: z.array(RetentionPeriodSchema).optional(),
  automatedDecisionMaking: AutomatedDecisionInfoSchema.optional(),
  sources: z.array(DataSourceSchema).optional(),
});

/**
 * Data summary statistics
 */
export interface DataSummary {
  /** Total number of records */
  totalRecords: number;
  /** Records by category */
  recordsByCategory: Record<DataCategory, number>;
  /** Date range of data */
  dateRange: {
    earliest: number;
    latest: number;
  };
  /** Data size in bytes */
  totalSize: number;
  /** Systems containing data */
  systems: string[];
}

/**
 * Zod schema for DataSummary validation
 */
export const DataSummarySchema = z.object({
  totalRecords: z.number().nonnegative(),
  recordsByCategory: z.record(z.nativeEnum(DataCategory), z.number().nonnegative()),
  dateRange: z.object({
    earliest: z.number().nonnegative(),
    latest: z.number().nonnegative(),
  }),
  totalSize: z.number().nonnegative(),
  systems: z.array(z.string()),
});

/**
 * Data recipient information
 */
export interface DataRecipient {
  /** Recipient name */
  name: string;
  /** Recipient category */
  category: RecipientCategory;
  /** Data categories shared */
  dataCategories: DataCategory[];
  /** Purpose of sharing */
  purpose: string;
// Whether data is transferred outside EU */
  outsideEU: boolean;
// Safeguards in place */
  safeguards?: string;
}

/**
 * Zod schema for DataRecipient validation
 */
export const DataRecipientSchema = z.object({
  name: z.string(),
  category: z.nativeEnum(RecipientCategory),
  dataCategories: z.array(z.nativeEnum(DataCategory)),
  purpose: z.string(),
  outsideEU: z.boolean(),
  safeguards: z.string().optional(),
});

/**
 * Data recipient categories
 */
export enum RecipientCategory {
  CONTROLLER = 'controller',
  PROCESSOR = 'processor',
  THIRD_PARTY = 'third_party',
  AUTHORITY = 'authority',
  PUBLIC_BODY = 'public_body',
}

/**
 * Data retention period
 */
export interface RetentionPeriod {
  /** Data category */
  category: DataCategory;
  /** Retention period description */
  period: string;
  /** Retention rationale */
  rationale: string;
  /** When data will be deleted */
  deletionDate?: number;
}

/**
 * Zod schema for RetentionPeriod validation
 */
export const RetentionPeriodSchema = z.object({
  category: z.nativeEnum(DataCategory),
  period: z.string(),
  rationale: z.string(),
  deletionDate: z.number().nonnegative().optional(),
});

/**
 * Automated decision making information
 */
export interface AutomatedDecisionInfo {
  /** Whether automated decision making is used */
  usesAutomatedDecisionMaking: boolean;
// Logic involved */
  logic?: string;
  /** Significance and consequences */
  significance?: string;
// Measures to prevent errors */
  safeguards?: string[];
  /** Right to human intervention */
  rightToIntervention: boolean;
  /** Right to express opinion */
  rightToOpinion: boolean;
}

/**
 * Zod schema for AutomatedDecisionInfo validation
 */
export const AutomatedDecisionInfoSchema = z.object({
  usesAutomatedDecisionMaking: z.boolean(),
  logic: z.string().optional(),
  significance: z.string().optional(),
  safeguards: z.array(z.string()).optional(),
  rightToIntervention: z.boolean(),
  rightToOpinion: z.boolean(),
});

/**
 * Data source information
 */
export interface DataSource {
  /** Source name */
  name: string;
  /** Source type */
  type: SourceType;
  /** Data categories from source */
  dataCategories: DataCategory[];
// How data was obtained */
  method: string;
}

/**
 * Zod schema for DataSource validation
 */
export const DataSourceSchema = z.object({
  name: z.string(),
  type: z.nativeEnum(SourceType),
  dataCategories: z.array(z.nativeEnum(DataCategory)),
  method: z.string(),
});

/**
 * Data source types
 */
export enum SourceType {
  DIRECT = 'direct', // From data subject directly
  INDIRECT = 'indirect', // From third party
  PUBLIC = 'public', // Publicly available
  DERIVED = 'derived', // Derived from other data
  INFERRED = 'inferred', // Inferred by system
}

// ============================================================================
// RIGHT TO ERASURE (ARTICLE 17)
// ============================================================================

/**
 * Right to erasure request details
 * GDPR Article 17: Right to erasure ("right to be forgotten")
 */
export interface RightToErasureRequest extends DataSubjectRequest {
  rightType: DataSubjectRight.RIGHT_TO_ERASURE;
  /** Grounds for erasure */
  grounds: ErasureGround[];
  /** Whether to keep data for legal/defensive purposes */
  legalHoldOverride: boolean;
  /** Third parties to notify */
  notifyThirdParties: boolean;
// Whether to request search engine removal */
  searchEngineRemoval: boolean;
}

/**
 * Zod schema for RightToErasureRequest validation
 */
export const RightToErasureRequestSchema = DataSubjectRequestSchema.extend({
  rightType: z.literal(DataSubjectRight.RIGHT_TO_ERASURE),
  grounds: z.array(z.nativeEnum(ErasureGround)),
  legalHoldOverride: z.boolean(),
  notifyThirdParties: z.boolean(),
  searchEngineRemoval: z.boolean(),
});

/**
 * Grounds for erasure under GDPR Article 17(1)
 */
export enum ErasureGround {
  DATA_NO_LONGER_NEEDED = 'data_no_longer_needed', // (a) Purpose no longer necessary
  CONSENT_WITHDRAWN = 'consent_withdrawn', // (b) Consent withdrawn
  OBJECTS_PROCESSING = 'objects_processing', // (c) Objects to processing
  UNLAWFUL_PROCESSING = 'unlawful_processing', // (d) Unlawful processing
  LEGAL_OBLIGATION = 'legal_obligation', // (e) Legal obligation to erase
  CHILD_DATA = 'child_data', // (f) Information society services offered to child
}

/**
 * Result of a right to erasure request
 */
export interface DataErasureResult {
  /** Request ID */
  requestId: string;
  /** Data subject ID */
  subjectId: string;
  /** Erasure timestamp (Unix ms) */
  erasedAt: number;
  /** Number of records deleted */
  recordsDeleted: number;
  /** Number of records anonymized */
  recordsAnonymized: number;
  /** Data categories affected */
  dataCategories: DataCategory[];
  /** Systems affected */
  systems: string[];
  /** Third parties notified */
  thirdPartiesNotified: string[];
  /** Records that couldn't be deleted (and why) */
  exceptions: ErasureException[];
  /** Verification method */
  verificationMethod?: string;
}

/**
 * Zod schema for DataErasureResult validation
 */
export const DataErasureResultSchema = z.object({
  requestId: z.string().uuid(),
  subjectId: z.string(),
  erasedAt: z.number().nonnegative(),
  recordsDeleted: z.number().nonnegative(),
  recordsAnonymized: z.number().nonnegative(),
  dataCategories: z.array(z.nativeEnum(DataCategory)),
  systems: z.array(z.string()),
  thirdPartiesNotified: z.array(z.string()),
  exceptions: z.array(ErasureExceptionSchema),
  verificationMethod: z.string().optional(),
});

/**
 * Exception to erasure (records that couldn't be deleted)
 */
export interface ErasureException {
  /** Record identifier */
  recordId: string;
  /** Reason for exception */
  reason: ErasureExceptionReason;
// Legal basis for retaining data */
  legalBasis?: string;
  /** When data can be deleted (Unix ms) */
  deletableAfter?: number;
}

/**
 * Zod schema for ErasureException validation
 */
export const ErasureExceptionSchema = z.object({
  recordId: z.string(),
  reason: z.nativeEnum(ErasureExceptionReason),
  legalBasis: z.string().optional(),
  deletableAfter: z.number().nonnegative().optional(),
});

/**
 * Reasons for erasure exceptions
 */
export enum ErasureExceptionReason {
  LEGAL_HOLD = 'legal_hold',
  CONTRACTUAL_OBLIGATION = 'contractual_obligation',
  LEGAL_OBLIGATION = 'legal_obligation',
  PUBLIC_INTEREST = 'public_interest',
  PUBLIC_HEALTH = 'public_health',
  ARCHIVING_PURPOSE = 'archiving_purpose',
  EXERCISE_DEFENSE = 'exercise_defense',
}

// ============================================================================
// RIGHT TO RECTIFICATION (ARTICLE 16)
// ============================================================================

/**
 * Right to rectification request
 * GDPR Article 16: Right to rectification
 */
export interface RectificationRequest extends DataSubjectRequest {
  rightType: DataSubjectRight.RIGHT_TO_RECTIFICATION;
  /** Corrections to make */
  corrections: DataCorrection[];
}

/**
 * Zod schema for RectificationRequest validation
 */
export const RectificationRequestSchema = DataSubjectRequestSchema.extend({
  rightType: z.literal(DataSubjectRight.RIGHT_TO_RECTIFICATION),
  corrections: z.array(DataCorrectionSchema),
});

/**
 * Data correction specification
 */
export interface DataCorrection {
  /** Record identifier */
  recordId: string;
  /** Field/attribute to correct */
  field: string;
  /** Current (incorrect) value */
  currentValue: string;
  /** Correct value */
  correctValue: string;
  /** Reason for correction */
  reason: string;
  /** Supporting evidence */
  evidence?: string[];
}

/**
 * Zod schema for DataCorrection validation
 */
export const DataCorrectionSchema = z.object({
  recordId: z.string(),
  field: z.string(),
  currentValue: z.string(),
  correctValue: z.string(),
  reason: z.string(),
  evidence: z.array(z.string()).optional(),
});

// ============================================================================
// RIGHT TO RESTRICT PROCESSING (ARTICLE 18)
// ============================================================================

/**
 * Right to restrict processing request
 * GDPR Article 18: Right to restrict processing
 */
export interface RestrictionRequest extends DataSubjectRequest {
  rightType: DataSubjectRight.RIGHT_TO_RESTRICT_PROCESSING;
  /** Grounds for restriction */
  grounds: RestrictionGround[];
// Restricted data categories */
  restrictedCategories: DataCategory[];
  /** Allowed operations during restriction */
  allowedOperations: string[];
}

/**
 * Zod schema for RestrictionRequest validation
 */
export const RestrictionRequestSchema = DataSubjectRequestSchema.extend({
  rightType: z.literal(DataSubjectRight.RIGHT_TO_RESTRICT_PROCESSING),
  grounds: z.array(z.nativeEnum(RestrictionGround)),
  restrictedCategories: z.array(z.nativeEnum(DataCategory)),
  allowedOperations: z.array(z.string()),
});

/**
 * Grounds for restriction under GDPR Article 18
 */
export enum RestrictionGround {
  ACCURACY_CONTESTED = 'accuracy_contested', // (a) Accuracy contested
  UNLAWFUL_BUT_RETAIN = 'unlawful_but_retain', // (b) Unlawful but don't want erasure
  NO_LONGER_NEEDED_BUT_RETAIN = 'no_longer_needed_but_retain', // (c) No longer needed but needed for legal claims
  OBJECTED_PENDING = 'objected_pending', // (d) Objected, pending verification
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type DataSubjectRequestType = z.infer<typeof DataSubjectRequestSchema>;
export type RequestScopeType = z.infer<typeof RequestScopeSchema>;
export type VerificationStatusType = z.infer<typeof VerificationStatusSchema>;
export type RightToAccessRequestType = z.infer<typeof RightToAccessRequestSchema>;
export type DataAccessResultType = z.infer<typeof DataAccessResultSchema>;
export type DataSummaryType = z.infer<typeof DataSummarySchema>;
export type DataRecipientType = z.infer<typeof DataRecipientSchema>;
export type RightToErasureRequestType = z.infer<typeof RightToErasureRequestSchema>;
export type DataErasureResultType = z.infer<typeof DataErasureResultSchema>;
export type RectificationRequestType = z.infer<typeof RectificationRequestSchema>;
export type RestrictionRequestType = z.infer<typeof RestrictionRequestSchema>;
