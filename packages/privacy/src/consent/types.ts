/**
 * Consent management types for GDPR compliance
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// GDPR CONSENT CATEGORIES
// ============================================================================

/**
 * GDPR consent categories as defined in GDPR Article 6 and 9
 */
export enum ConsentCategory {
  // Article 6(1) Lawful bases for processing
  NECESSARY = 'necessary', // Contract performance, legal obligation
  LEGITIMATE_INTEREST = 'legitimate_interest', // Legitimate interest
  CONTRACT = 'contract', // Contract performance
  LEGAL_OBLIGATION = 'legal_obligation', // Legal obligation
  VITAL_INTERESTS = 'vital_interests', // Vital interests
  PUBLIC_TASK = 'public_task', // Public task
  // Article 9(2) Special categories of data
  HEALTH_DATA = 'health_data', // Health data
  BIOMETRIC_DATA = 'biometric_data', // Biometric data
  // Additional categories for processing
  ANALYTICS = 'analytics', // Analytics and statistics
  MARKETING = 'marketing', // Marketing communications
  ADVERTISING = 'advertising', // Personalized advertising
  FUNCTIONAL = 'functional', // Functional services
  PERSONALIZATION = 'personalization', // Personalization features
  RESEARCH = 'research', // Research purposes
  COOKIES = 'cookies', // Cookie consent
  TRACKING = 'tracking', // Cross-site tracking
  THIRD_PARTY = 'third_party', // Third-party data sharing
  LOCATION = 'location', // Location data
  PROFILING = 'profiling', // Profiling and automated decision making
}

/**
 * GDPR Article 7 conditions for consent
 */
export enum ConsentCondition {
  EXPLICIT = 'explicit', // Explicit consent (required for special categories)
  OPT_IN = 'opt_in', // Clear affirmative action
  OPT_OUT = 'opt_out', // Pre-checked with ability to opt-out
  GRANULAR = 'granular', // Granular consent options
  INFORMED = 'informed', // Properly informed consent
  SPECIFIC = 'specific', // Specific purpose consent
  UNAMBIGUOUS = 'unambiguous', // Unambiguous indication
}

/**
 * Consent status according to GDPR requirements
 */
export enum ConsentStatus {
  GRANTED = 'granted', // Consent has been given
  DENIED = 'denied', // Consent has been refused
  REVOKED = 'revoked', // Consent has been withdrawn (GDPR right to withdraw)
  PENDING = 'pending', // Awaiting user decision
  EXPIRED = 'expired', // Consent has expired
  PARTIAL = 'partial', // Partial consent (some categories granted, others denied)
  NOT_ASKED = 'not_asked', // User hasn't been asked for consent
}

/**
 * Cookie categories for GDPR compliance
 */
export enum CookieCategory {
  STRICTLY_NECESSARY = 'strictly_necessary', // Essential cookies
  FUNCTIONAL = 'functional', // Functional cookies
  PERFORMANCE = 'performance', // Performance cookies
  TARGETING = 'targeting', // Targeting/advertising cookies
  SOCIAL_MEDIA = 'social_media', // Social media cookies
}

// ============================================================================
// CONSENT TYPES
// ============================================================================

/**
 * Individual consent record for a specific category
 */
export interface ConsentRecord {
  /** Unique identifier for this consent record */
  id: string;
  /** User or data subject identifier */
  userId: string;
  /** Consent category */
  category: ConsentCategory;
  /** Current consent status */
  status: ConsentStatus;
  /** When consent was first recorded (Unix ms) */
  grantedAt: number;
  /** When consent was last modified (Unix ms) */
  updatedAt: number;
  /** When consent expires (Unix ms, optional) */
  expiresAt?: number;
  /** Consent condition used */
  condition: ConsentCondition;
  /** Purpose of data processing */
  purpose: string;
  /** Legal basis for processing (GDPR Article 6) */
  legalBasis: string;
  /** Where consent was collected from */
  source: ConsentSource;
  /** IP address when consent was given */
  ipAddress?: string;
  /** User agent when consent was given */
  userAgent?: string;
  /** Version of privacy policy */
  policyVersion: string;
  /** Whether consent was explicitly withdrawn */
  withdrawnAt?: number;
  /** Reason for withdrawal */
  withdrawalReason?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Zod schema for ConsentRecord validation
 */
export const ConsentRecordSchema: z.ZodType<ConsentRecord> = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  category: z.nativeEnum(ConsentCategory),
  status: z.nativeEnum(ConsentStatus),
  grantedAt: z.number().nonnegative(),
  updatedAt: z.number().nonnegative(),
  expiresAt: z.number().nonnegative().optional(),
  condition: z.nativeEnum(ConsentCondition),
  purpose: z.string().min(1),
  legalBasis: z.string().min(1),
  source: z.nativeEnum(ConsentSource),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  policyVersion: z.string().min(1),
  withdrawnAt: z.number().nonnegative().optional(),
  withdrawalReason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Where consent was collected from
 */
export enum ConsentSource {
  WEBSITE = 'website',
  MOBILE_APP = 'mobile_app',
  DESKTOP_APP = 'desktop_app',
  API = 'api',
  EMAIL = 'email',
  PAPER_FORM = 'paper_form',
  PHONE = 'phone',
  IN_PERSON = 'in_person',
  THIRD_PARTY = 'third_party',
}

/**
 * User's comprehensive consent profile
 */
export interface ConsentProfile {
  /** User or data subject identifier */
  userId: string;
  /** All consent records for this user */
  consents: ConsentRecord[];
  /** Overall consent status */
  status: ConsentStatus;
  /** Profile creation timestamp (Unix ms) */
  createdAt: number;
  /** Last update timestamp (Unix ms) */
  updatedAt: number;
  /** IP address of most recent update */
  lastIpAddress?: string;
  /** Current privacy policy version */
  policyVersion: string;
  /** Cookie preferences */
  cookiePreferences: CookiePreferences;
  /** Marketing preferences */
  marketingPreferences: MarketingPreferences;
  /** Communication preferences */
  communicationPreferences: CommunicationPreferences;
}

/**
 * Zod schema for ConsentProfile validation
 */
export const ConsentProfileSchema: z.ZodType<ConsentProfile> = z.object({
  userId: z.string(),
  consents: z.array(ConsentRecordSchema),
  status: z.nativeEnum(ConsentStatus),
  createdAt: z.number().nonnegative(),
  updatedAt: z.number().nonnegative(),
  lastIpAddress: z.string().optional(),
  policyVersion: z.string().min(1),
  cookiePreferences: CookiePreferencesSchema,
  marketingPreferences: MarketingPreferencesSchema,
  communicationPreferences: CommunicationPreferencesSchema,
});

/**
 * Cookie consent preferences
 */
export interface CookiePreferences {
  /** Essential cookies (always allowed) */
  essential: boolean;
  /** Functional cookies */
  functional: boolean;
  /** Performance/analytics cookies */
  performance: boolean;
  /** Marketing/targeting cookies */
  marketing: boolean;
  /** Social media cookies */
  socialMedia: boolean;
  /** Last updated timestamp (Unix ms) */
  updatedAt: number;
}

/**
 * Zod schema for CookiePreferences validation
 */
export const CookiePreferencesSchema = z.object({
  essential: z.boolean(),
  functional: z.boolean(),
  performance: z.boolean(),
  marketing: z.boolean(),
  socialMedia: z.boolean(),
  updatedAt: z.number().nonnegative(),
});

/**
 * Marketing consent preferences
 */
export interface MarketingPreferences {
  /** Email marketing consent */
  email: boolean;
  /** SMS marketing consent */
  sms: boolean;
  /** Phone marketing consent */
  phone: boolean;
  /** Direct mail consent */
  directMail: boolean;
  /** Online advertising consent */
  onlineAdvertising: boolean;
  /** Personalized content consent */
  personalizedContent: boolean;
  /** Last updated timestamp (Unix ms) */
  updatedAt: number;
}

/**
 * Zod schema for MarketingPreferences validation
 */
export const MarketingPreferencesSchema = z.object({
  email: z.boolean(),
  sms: z.boolean(),
  phone: z.boolean(),
  directMail: z.boolean(),
  onlineAdvertising: z.boolean(),
  personalizedContent: z.boolean(),
  updatedAt: z.number().nonnegative(),
});

/**
 * Communication preferences
 */
export interface CommunicationPreferences {
  /** Newsletter subscription */
  newsletter: boolean;
  /** Product updates */
  productUpdates: boolean;
  /** Security alerts */
  securityAlerts: boolean;
  /** Feature announcements */
  featureAnnouncements: boolean;
  /** Survey invitations */
  surveys: boolean;
  /** Beta program invitations */
  betaInvitations: boolean;
  /** Last updated timestamp (Unix ms) */
  updatedAt: number;
}

/**
 * Zod schema for CommunicationPreferences validation
 */
export const CommunicationPreferencesSchema = z.object({
  newsletter: z.boolean(),
  productUpdates: z.boolean(),
  securityAlerts: z.boolean(),
  featureAnnouncements: z.boolean(),
  surveys: z.boolean(),
  betaInvitations: z.boolean(),
  updatedAt: z.number().nonnegative(),
});

// ============================================================================
// CONSENT REQUEST TYPES
// ============================================================================

/**
 * Request to grant consent
 */
export interface GrantConsentRequest {
  /** User identifier */
  userId: string;
  /** Consent category */
  category: ConsentCategory;
  /** Purpose of data processing */
  purpose: string;
  /** Legal basis for processing */
  legalBasis: string;
  /** Where consent is being collected from */
  source: ConsentSource;
  /** IP address */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
  /** Privacy policy version */
  policyVersion: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Zod schema for GrantConsentRequest validation
 */
export const GrantConsentRequestSchema = z.object({
  userId: z.string().min(1),
  category: z.nativeEnum(ConsentCategory),
  purpose: z.string().min(1),
  legalBasis: z.string().min(1),
  source: z.nativeEnum(ConsentSource),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  policyVersion: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Request to revoke/withdraw consent
 */
export interface RevokeConsentRequest {
  /** User identifier */
  userId: string;
  /** Consent record ID */
  consentId: string;
  /** Reason for withdrawal */
  reason?: string;
  /** IP address */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
}

/**
 * Zod schema for RevokeConsentRequest validation
 */
export const RevokeConsentRequestSchema = z.object({
  userId: z.string().min(1),
  consentId: z.string().uuid(),
  reason: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

/**
 * Batch consent update request
 */
export interface BatchConsentUpdate {
  /** User identifier */
  userId: string;
  /** Consent categories to grant */
  grant: ConsentCategory[];
  /** Consent categories to revoke */
  revoke: ConsentCategory[];
  /** Source of consent update */
  source: ConsentSource;
  /** IP address */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
  /** Privacy policy version */
  policyVersion: string;
}

/**
 * Zod schema for BatchConsentUpdate validation
 */
export const BatchConsentUpdateSchema = z.object({
  userId: z.string().min(1),
  grant: z.array(z.nativeEnum(ConsentCategory)),
  revoke: z.array(z.nativeEnum(ConsentCategory)),
  source: z.nativeEnum(ConsentSource),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  policyVersion: z.string().min(1),
});

// ============================================================================
// CONSENT HISTORY TYPES
// ============================================================================

/**
 * Audit log entry for consent changes
 */
export interface ConsentAuditLog {
  /** Unique identifier */
  id: string;
  /** User identifier */
  userId: string;
  /** Consent category affected */
  category: ConsentCategory;
  /** Action performed */
  action: ConsentAction;
  /** Previous status */
  previousStatus: ConsentStatus;
  /** New status */
  newStatus: ConsentStatus;
  /** Timestamp of change (Unix ms) */
  timestamp: number;
  /** Who made the change */
  actor: ConsentActor;
  /** IP address */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
  /** Reason for change */
  reason?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Zod schema for ConsentAuditLog validation
 */
export const ConsentAuditLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  category: z.nativeEnum(ConsentCategory),
  action: z.nativeEnum(ConsentAction),
  previousStatus: z.nativeEnum(ConsentStatus),
  newStatus: z.nativeEnum(ConsentStatus),
  timestamp: z.number().nonnegative(),
  actor: z.nativeEnum(ConsentActor),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  reason: z.string().optional(),
  context: z.record(z.unknown()).optional(),
});

/**
 * Actions that can be performed on consent
 */
export enum ConsentAction {
  GRANTED = 'granted',
  REVOKED = 'revoked',
  RENEWED = 'renewed',
  UPDATED = 'updated',
  EXPIRED = 'expired',
  WITHDRAWN = 'withdrawn',
  MODIFIED = 'modified',
}

/**
 * Who can perform consent actions
 */
export enum ConsentActor {
  USER = 'user',
  ADMIN = 'admin',
  SYSTEM = 'system',
  AUTOMATED = 'automated',
  THIRD_PARTY = 'third_party',
}

// ============================================================================
// CONSENT VALIDATION TYPES
// ============================================================================

/**
 * Result of consent validation
 */
export interface ConsentValidationResult {
  /** Whether consent is valid */
  valid: boolean;
  /** Whether consent is required */
  required: boolean;
  /** Whether consent has been granted */
  granted: boolean;
  /** Whether consent is expired */
  expired: boolean;
  /** Whether consent was revoked */
  revoked: boolean;
  /** Validation errors */
  errors: string[];
  /** Relevant consent records */
  consents: ConsentRecord[];
  /** Recommended action */
  recommendation: ConsentRecommendation;
}

/**
 * Zod schema for ConsentValidationResult validation
 */
export const ConsentValidationResultSchema = z.object({
  valid: z.boolean(),
  required: z.boolean(),
  granted: z.boolean(),
  expired: z.boolean(),
  revoked: z.boolean(),
  errors: z.array(z.string()),
  consents: z.array(ConsentRecordSchema),
  recommendation: z.nativeEnum(ConsentRecommendation),
});

/**
 * Recommendations for consent actions
 */
export enum ConsentRecommendation {
  PROCEED = 'proceed', // Consent is valid, proceed with processing
  REQUEST_CONSENT = 'request_consent', // Need to request consent
  RENEW_CONSENT = 'renew_consent', // Consent expired, needs renewal
  UPDATE_CONSENT = 'update_consent', // Consent needs updating
  NO_ACTION = 'no_action', // No consent needed
  DENY_PROCESSING = 'deny_processing', // Deny processing
}

// ============================================================================
// CONSENT CONFIGURATION
// ============================================================================

/**
 * Consent manager configuration
 */
export interface ConsentConfig {
  /** Default consent TTL in milliseconds (undefined = never expires) */
  defaultConsentTtl?: number;
  /** Per-category consent TTLs */
  consentTtls?: Partial<Record<ConsentCategory, number>>;
  /** Whether to require explicit consent for all categories */
  requireExplicitConsent?: boolean;
  /** Whether to track consent history */
  trackHistory?: boolean;
  /** How long to keep audit logs (milliseconds) */
  auditRetentionPeriod?: number;
  /** Whether to automatically expire consents */
  autoExpire?: boolean;
  /** Whether to require granular consent */
  requireGranularConsent?: boolean;
  /** Default consent status for new users */
  defaultStatus?: ConsentStatus;
  /** Whether to use cookie consent */
  useCookieConsent?: boolean;
  /** Cookie consent TTL */
  cookieConsentTtl?: number;
  /** Whether to track IP addresses */
  trackIpAddresses?: boolean;
  /** Whether to track user agents */
  trackUserAgents?: boolean;
}

/**
 * Zod schema for ConsentConfig validation
 */
export const ConsentConfigSchema = z.object({
  defaultConsentTtl: z.number().positive().optional(),
  consentTtls: z.record(z.nativeEnum(ConsentCategory), z.number().positive()).optional(),
  requireExplicitConsent: z.boolean().optional(),
  trackHistory: z.boolean().optional(),
  auditRetentionPeriod: z.number().positive().optional(),
  autoExpire: z.boolean().optional(),
  requireGranularConsent: z.boolean().optional(),
  defaultStatus: z.nativeEnum(ConsentStatus).optional(),
  useCookieConsent: z.boolean().optional(),
  cookieConsentTtl: z.number().positive().optional(),
  trackIpAddresses: z.boolean().optional(),
  trackUserAgents: z.boolean().optional(),
});

// ============================================================================
// TYPE INFERENCE UTILITIES
// ============================================================================

/**
 * Infer types from schemas
 */
export type ConsentRecordType = z.infer<typeof ConsentRecordSchema>;
export type ConsentProfileType = z.infer<typeof ConsentProfileSchema>;
export type CookiePreferencesType = z.infer<typeof CookiePreferencesSchema>;
export type MarketingPreferencesType = z.infer<typeof MarketingPreferencesSchema>;
export type CommunicationPreferencesType = z.infer<typeof CommunicationPreferencesSchema>;
export type GrantConsentRequestType = z.infer<typeof GrantConsentRequestSchema>;
export type RevokeConsentRequestType = z.infer<typeof RevokeConsentRequestSchema>;
export type BatchConsentUpdateType = z.infer<typeof BatchConsentUpdateSchema>;
export type ConsentAuditLogType = z.infer<typeof ConsentAuditLogSchema>;
export type ConsentValidationResultType = z.infer<typeof ConsentValidationResultSchema>;
export type ConsentConfigType = z.infer<typeof ConsentConfigSchema>;
