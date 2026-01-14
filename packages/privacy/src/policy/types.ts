/**
 * Privacy Policy Generator types
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// PRIVACY POLICY TYPES
// ============================================================================

/**
 * Supported privacy policy formats
 */
export enum PolicyFormat {
  HTML = 'html',
  MARKDOWN = 'markdown',
  PDF = 'pdf',
  JSON = 'json',
  TEXT = 'text',
}

/**
 * Language for privacy policy
 */
export enum PolicyLanguage {
  EN = 'en',
  ES = 'es',
  FR = 'fr',
  DE = 'de',
  IT = 'it',
  PT = 'pt',
  NL = 'nl',
  PL = 'pl',
  SV = 'sv',
  DA = 'da',
  FI = 'fi',
  NO = 'no',
}

/**
 * GDPR compliance section
 */
export interface GDPRSection {
  /** Section identifier */
  id: string;
  /** Section title */
  title: string;
  /** Section content */
  content: string;
  /** Section order */
  order: number;
  ** Whether section is required for GDPR compliance */
  required: boolean;
  ** GDPR Article reference */
  gdprArticle?: string;
  /** Subsections */
  subsections?: GDPRSection[];
}

/**
 * Zod schema for GDPRSection validation
 */
export const GDPRSectionSchema: z.ZodType<GDPRSection> = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  order: z.number().int().nonnegative(),
  required: z.boolean(),
  gdprArticle: z.string().optional(),
  subsections: z.array(z.lazy(() => GDPRSectionSchema)).optional(),
});

// ============================================================================
// PRIVACY POLICY TEMPLATE
// ============================================================================

/**
 * Privacy policy template
 */
export interface PrivacyPolicyTemplate {
  /** Template identifier */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  ** Template version */
  version: string;
  ** Industry/category */
  industry: string;
  ** Template sections */
  sections: GDPRSection[];
  ** Default language */
  defaultLanguage: PolicyLanguage;
  ** Supported languages */
  supportedLanguages: PolicyLanguage[];
  ** Date template was created (Unix ms) */
  createdAt: number;
  /** Last update date (Unix ms) */
  updatedAt: number;
  ** Template variables */
  variables: TemplateVariable[];
}

/**
 * Zod schema for PrivacyPolicyTemplate validation
 */
export const PrivacyPolicyTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  version: z.string().min(1),
  industry: z.string(),
  sections: z.array(GDPRSectionSchema),
  defaultLanguage: z.nativeEnum(PolicyLanguage),
  supportedLanguages: z.array(z.nativeEnum(PolicyLanguage)),
  createdAt: z.number().nonnegative(),
  updatedAt: z.number().nonnegative(),
  variables: z.array(TemplateVariableSchema),
});

/**
 * Template variable for customization
 */
export interface TemplateVariable {
  /** Variable identifier */
  id: string;
  ** Variable name (e.g., {{company_name}}) */
  name: string;
  ** Variable label for UI */
  label: string;
  ** Variable description */
  description: string;
  ** Variable type */
  type: VariableType;
  ** Whether variable is required */
  required: boolean;
  ** Default value */
  defaultValue?: string;
  ** Options for select type */
  options?: string[];
  ** Validation regex */
  validation?: string;
}

/**
 * Zod schema for TemplateVariable validation
 */
export const TemplateVariableSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
  type: z.nativeEnum(VariableType),
  required: z.boolean(),
  defaultValue: z.string().optional(),
  options: z.array(z.string()).optional(),
  validation: z.string().optional(),
});

/**
 * Variable types
 */
export enum VariableType {
  TEXT = 'text',
  EMAIL = 'email',
  URL = 'url',
  DATE = 'date',
  NUMBER = 'number',
  SELECT = 'select',
  BOOLEAN = 'boolean',
  TEXTAREA = 'textarea',
}

// ============================================================================
// GENERATED POLICY
// ============================================================================

/**
 * Generated privacy policy
 */
export interface GeneratedPolicy {
  /** Policy identifier */
  id: string;
  /** Template ID used */
  templateId: string;
  ** Organization information */
  organization: OrganizationInfo;
  ** Policy format */
  format: PolicyFormat;
  ** Policy language */
  language: PolicyLanguage;
  ** Generated policy content */
  content: string;
  ** Policy sections */
  sections: GDPRSection[];
  ** Policy variables */
  variables: Record<string, string>;
  /** Date policy was generated (Unix ms) */
  generatedAt: number;
  /** Policy version */
  version: string;
  ** When policy becomes effective (Unix ms) */
  effectiveDate: number;
  ** Last review date (Unix ms) */
  lastReviewDate: number;
  ** Next review date (Unix ms) */
  nextReviewDate: number;
  ** Whether policy is published */
  published: boolean;
  ** Policy URL (if published) */
  url?: string;
  ** Policy hash for integrity verification */
  hash: string;
}

/**
 * Zod schema for GeneratedPolicy validation
 */
export const GeneratedPolicySchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  organization: OrganizationInfoSchema,
  format: z.nativeEnum(PolicyFormat),
  language: z.nativeEnum(PolicyLanguage),
  content: z.string(),
  sections: z.array(GDPRSectionSchema),
  variables: z.record(z.string()),
  generatedAt: z.number().nonnegative(),
  version: z.string().min(1),
  effectiveDate: z.number().nonnegative(),
  lastReviewDate: z.number().nonnegative(),
  nextReviewDate: z.number().nonnegative(),
  published: z.boolean(),
  url: z.string().optional(),
  hash: z.string(),
});

/**
 * Organization information for policy
 */
export interface OrganizationInfo {
  ** Organization name */
  name: string;
  ** Organization legal name */
  legalName?: string;
  ** Organization type */
  type: OrganizationType;
  ** Contact email */
  contactEmail: string;
  ** Contact phone */
  contactPhone?: string;
  ** Contact address */
  address: Address;
  ** Data Protection Officer information */
  dpo?: DataProtectionOfficer;
  ** Representative in EU (if non-EU company) */
  euRepresentative?: EURepresentative;
  ** Website URL */
  website: string;
  ** Jurisdiction */
  jurisdiction: string[];
}

/**
 * Zod schema for OrganizationInfo validation
 */
export const OrganizationInfoSchema = z.object({
  name: z.string().min(1),
  legalName: z.string().optional(),
  type: z.nativeEnum(OrganizationType),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  address: AddressSchema,
  dpo: DataProtectionOfficerSchema.optional(),
  euRepresentative: EURepresentativeSchema.optional(),
  website: z.string().url(),
  jurisdiction: z.array(z.string()),
});

/**
 * Organization types
 */
export enum OrganizationType {
  COMPANY = 'company',
  NON_PROFIT = 'non_profit',
  GOVERNMENT = 'government',
  EDUCATIONAL = 'educational',
  HEALTHCARE = 'healthcare',
  SOLE_PROPRIETOR = 'sole_proprietor',
  PARTNERSHIP = 'partnership',
}

/**
 * Address information
 */
export interface Address {
  /** Street address */
  street: string;
  ** City */
  city: string;
  ** State/Province/Region */
  state?: string;
  ** Postal/ZIP code */
  postalCode: string;
  ** Country */
  country: string;
}

/**
 * Zod schema for Address validation
 */
export const AddressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().optional(),
  postalCode: z.string().min(1),
  country: z.string().min(1),
});

/**
 * Data Protection Officer information
 * GDPR Article 37: Appointment of a data protection officer
 */
export interface DataProtectionOfficer {
  /** DPO name */
  name: string;
  ** DPO email */
  email: string;
  ** DPO phone */
  phone?: string;
  ** Whether DPO is independent */
  independent: boolean;
  ** DPO contact details */
  contactDetails: string;
}

/**
 * Zod schema for DataProtectionOfficer validation
 */
export const DataProtectionOfficerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  independent: z.boolean(),
  contactDetails: z.string().min(1),
});

/**
 * EU Representative information
 * GDPR Article 27: Representatives of controllers or processors not established in the Union
 */
export interface EURepresentative {
  ** Representative name */
  name: string;
  ** Representative address */
  address: Address;
  ** Representative email */
  email: string;
  ** Representative phone */
  phone?: string;
}

/**
 * Zod schema for EURepresentative validation
 */
export const EURepresentativeSchema = z.object({
  name: z.string().min(1),
  address: AddressSchema,
  email: z.string().email(),
  phone: z.string().optional(),
});

// ============================================================================
// DATA PROCESSING INFORMATION
// ============================================================================

/**
 * Data processing activity
 * GDPR Article 30: Records of processing activities
 */
export interface DataProcessingActivity {
  ** Activity identifier */
  id: string;
  ** Activity name */
  name: string;
  ** Activity description */
  description: string;
  ** Data categories processed */
  dataCategories: string[];
  ** Data subjects affected */
  dataSubjects: string[];
  ** Purpose of processing */
  purpose: string;
  ** Legal basis for processing (GDPR Article 6) */
  legalBasis: string[];
  ** Data recipients */
  dataRecipients: string[];
  ** International data transfers */
  internationalTransfers: InternationalTransfer[];
  ** Data retention period */
  retentionPeriod: string;
  ** Security measures */
  securityMeasures: string[];
}

/**
 * Zod schema for DataProcessingActivity validation
 */
export const DataProcessingActivitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  dataCategories: z.array(z.string()),
  dataSubjects: z.array(z.string()),
  purpose: z.string().min(1),
  legalBasis: z.array(z.string()),
  dataRecipients: z.array(z.string()),
  internationalTransfers: z.array(InternationalTransferSchema),
  retentionPeriod: z.string().min(1),
  securityMeasures: z.array(z.string()),
});

/**
 * International data transfer
 * GDPR Chapter V: Transfer of personal data to third countries or international organizations
 */
export interface InternationalTransfer {
  /** Destination country */
  country: string;
  ** Transfer mechanism */
  mechanism: TransferMechanism;
  ** Safeguards in place */
  safeguards: string[];
  ** Whether EU Commission has adequacy decision */
  adequacyDecision: boolean;
}

/**
 * Zod schema for InternationalTransfer validation
 */
export const InternationalTransferSchema = z.object({
  country: z.string().min(1),
  mechanism: z.nativeEnum(TransferMechanism),
  safeguards: z.array(z.string()),
  adequacyDecision: z.boolean(),
});

/**
 * Transfer mechanisms for international data transfers
 */
export enum TransferMechanism {
  ADEQUACY_DECISION = 'adequacy_decision', // GDPR Article 45
  SCC = 'scc', // Standard Contractual Clauses - GDPR Article 46(2)(c)
  BCR = 'bcr', // Binding Corporate Rules - GDPR Article 47
  LEGAL_INSTRUMENT = 'legal_instrument', // GDPR Article 46(2)(a)
  CERTIFICATION = 'certification', // GDPR Article 42
  DEROGATION = 'derogation', // GDPR Article 49
}

// ============================================================================
// POLICY GENERATION REQUEST
// ============================================================================

/**
 * Request to generate a privacy policy
 */
export interface GeneratePolicyRequest {
  /** Template ID to use */
  templateId?: string;
  ** Organization information */
  organization: OrganizationInfo;
  ** Data processing activities */
  dataProcessing: DataProcessingActivity[];
  ** Cookie policy */
  cookiePolicy?: CookiePolicy;
  ** User rights */
  userRights: UserRights[];
  ** Policy format */
  format: PolicyFormat;
  ** Policy language */
  language: PolicyLanguage;
  ** Additional custom sections */
  customSections?: GDPRSection[];
  ** Variable values */
  variables?: Record<string, string>;
  ** Effective date (Unix ms) */
  effectiveDate?: number;
}

/**
 * Zod schema for GeneratePolicyRequest validation
 */
export const GeneratePolicyRequestSchema = z.object({
  templateId: z.string().uuid().optional(),
  organization: OrganizationInfoSchema,
  dataProcessing: z.array(DataProcessingActivitySchema),
  cookiePolicy: CookiePolicySchema.optional(),
  userRights: z.array(UserRightsSchema),
  format: z.nativeEnum(PolicyFormat),
  language: z.nativeEnum(PolicyLanguage),
  customSections: z.array(GDPRSectionSchema).optional(),
  variables: z.record(z.string()).optional(),
  effectiveDate: z.number().nonnegative().optional(),
});

/**
 * Cookie policy
 */
export interface CookiePolicy {
  ** Whether cookies are used */
  usesCookies: boolean;
  ** Cookie categories */
  categories: CookieCategory[];
  ** Cookie types */
  types: CookieType[];
  ** How to manage cookies */
  managementInstructions: string;
}

/**
 * Zod schema for CookiePolicy validation
 */
export const CookiePolicySchema = z.object({
  usesCookies: z.boolean(),
  categories: z.array(z.nativeEnum(CookieCategory)),
  types: z.array(z.nativeEnum(CookieType)),
  managementInstructions: z.string(),
});

/**
 * Cookie categories
 */
export enum CookieCategory {
  ESSENTIAL = 'essential',
  FUNCTIONAL = 'functional',
  ANALYTICS = 'analytics',
  MARKETING = 'marketing',
  ADVERTISING = 'advertising',
}

/**
 * Cookie types
 */
export enum CookieType {
  SESSION = 'session',
  PERSISTENT = 'persistent',
  FIRST_PARTY = 'first_party',
  THIRD_PARTY = 'third_party',
}

/**
 * User rights under GDPR
 */
export interface UserRights {
  ** Right identifier */
  id: string;
  ** Right name */
  name: string;
  ** Right description */
  description: string;
  ** How to exercise the right */
  howToExercise: string;
  ** GDPR Article reference */
  gdprArticle: string;
}

/**
 * Zod schema for UserRights validation
 */
export const UserRightsSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().min(1),
  howToExercise: z.string().min(1),
  gdprArticle: z.string().min(1),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type GDPRSectionType = z.infer<typeof GDPRSectionSchema>;
export type PrivacyPolicyTemplateType = z.infer<typeof PrivacyPolicyTemplateSchema>;
export type TemplateVariableType = z.infer<typeof TemplateVariableSchema>;
export type GeneratedPolicyType = z.infer<typeof GeneratedPolicySchema>;
export type OrganizationInfoType = z.infer<typeof OrganizationInfoSchema>;
export type DataProcessingActivityType = z.infer<typeof DataProcessingActivitySchema>;
export type GeneratePolicyRequestType = z.infer<typeof GeneratePolicyRequestSchema>;
