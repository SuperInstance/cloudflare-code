/**
 * Core type definitions for ClaudeFlare Enterprise Identity Management
 */

import { z } from 'zod';

// ============================================================================
// SAML Types
// ============================================================================

export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificate: string;
  privateKey?: string;
  nameIdFormat?: SAMLNameIdFormat;
  assertionConsumerServiceUrl: string;
  attributeConsumingServiceIndex?: number;
  organization?: SAMLOrganization;
  contactPerson?: SAMLContactPerson;
  signingAlgorithm?: SAMLSigningAlgorithm;
  digestAlgorithm?: SAMLDigestAlgorithm;
  wantAssertionsSigned?: boolean;
  wantAssertionsEncrypted?: boolean;
  signingContext?: 'context' | 'message';
}

export type SAMLNameIdFormat =
  | 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified'
  | 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'
  | 'urn:oasis:names:tc:SAML:1.1:nameid-format:X509SubjectName'
  | 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent'
  | 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient'
  | 'urn:oasis:names:tc:SAML:1.1:nameid-format:WindowsDomainQualifiedName';

export type SAMLSigningAlgorithm =
  | 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'
  | 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
  | 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512';

export type SAMLDigestAlgorithm =
  | 'http://www.w3.org/2000/09/xmldsig#sha1'
  | 'http://www.w3.org/2001/04/xmlenc#sha256'
  | 'http://www.w3.org/2001/04/xmlenc#sha512';

export interface SAMLOrganization {
  name: string;
  displayName: string;
  url: string;
}

export interface SAMLContactPerson {
  contactType: 'technical' | 'support' | 'administrative' | 'billing' | 'other';
  company?: string;
  givenName?: string;
  surName?: string;
  emailAddresses: string[];
  telephoneNumbers?: string[];
}

export interface SAMLRequest {
  id: string;
  issueInstant: Date;
  issuer: string;
  assertionConsumerServiceUrl: string;
  destination?: string;
  nameIdPolicy?: SAMLNameIdPolicy;
  requestedAuthnContext?: SAMLRequestedAuthnContext;
  attributeConsumingServiceIndex?: number;
  forceAuthn?: boolean;
  isPassive?: boolean;
}

export interface SAMLNameIdPolicy {
  format: SAMLNameIdFormat;
  allowCreate?: boolean;
  spNameQualifier?: string;
}

export interface SAMLRequestedAuthnContext {
  comparison?: 'exact' | 'minimum' | 'maximum' | 'better';
  authnContextClassRefs: string[];
}

export interface SAMLResponse {
  id: string;
  inResponseTo: string;
  issueInstant: Date;
  issuer: string;
  destination: string;
  status: SAMLStatus;
  assertions?: SAMLAssertion[];
  encryptedAssertions?: any[];
}

export interface SAMLStatus {
  statusCode: SAMLStatusCode;
  statusMessage?: string;
  statusDetail?: any;
}

export interface SAMLStatusCode {
  value: string;
  subStatusCode?: SAMLStatusCode;
}

export interface SAMLAssertion {
  id: string;
  issueInstant: Date;
  issuer: string;
  subject: SAMLSubject;
  conditions?: SAMLConditions;
  authnStatements?: SAMLAuthnStatement[];
  attributeStatements?: SAMLAttributeStatement[];
  signature?: SAMLSignature;
}

export interface SAMLSubject {
  nameId: SAMLNameId;
  subjectConfirmations: SAMLSubjectConfirmation[];
}

export interface SAMLNameId {
  format: SAMLNameIdFormat;
  value: string;
  nameQualifier?: string;
  spNameQualifier?: string;
  spProvidedId?: string;
}

export interface SAMLSubjectConfirmation {
  method: string;
  subjectConfirmationData: SAMLSubjectConfirmationData;
}

export interface SAMLSubjectConfirmationData {
  notOnOrAfter?: Date;
  recipient?: string;
  inResponseTo?: string;
  notBefore?: Date;
  address?: string;
}

export interface SAMLConditions {
  notBefore?: Date;
  notOnOrAfter: Date;
  audienceRestrictions?: SAMLAudienceRestriction[];
}

export interface SAMLAudienceRestriction {
  audience: string[];
}

export interface SAMLAuthnStatement {
  authnInstant: Date;
  sessionIndex?: string;
  sessionNotOnOrAfter?: Date;
  authnContext: SAMLAuthnContext;
}

export interface SAMLAuthnContext {
  authnContextClassRef?: string;
  authnContextDecl?: any;
  authnContextDeclRef?: string;
}

export interface SAMLAttributeStatement {
  attributes: SAMLAttribute[];
}

export interface SAMLAttribute {
  name: string;
  nameFormat?: string;
  friendlyName?: string;
  values: string[];
}

export interface SAMLSignature {
  signatureValue: string;
  keyInfo?: SAMLKeyInfo;
  signedInfo: SAMLSignedInfo;
}

export interface SAMLKeyInfo {
  x509Data?: SAMLX509Data;
}

export interface SAMLX509Data {
  certificates?: string[];
}

export interface SAMLSignedInfo {
  canonicalizationMethod: { algorithm: string };
  signatureMethod: { algorithm: string };
  references: any[];
}

export interface SAMLMetadata {
  entityID: string;
  idpssoDescriptor?: SAMLIdpSSODescriptor;
  spssodescriptor?: SAMLSpSSODescriptor;
  organization?: SAMLOrganization;
  contactPersons?: SAMLContactPerson[];
  validUntil?: Date;
  cacheDuration?: string;
}

export interface SAMLIdpSSODescriptor {
  singleSignOnServices: { binding: string; location: string }[];
  singleLogoutServices: { binding: string; location: string }[];
  keys: SAMLSKey[];
  nameIdFormats?: string[];
  attributes?: SAMLAttribute[];
}

export interface SAMLSpSSODescriptor {
  assertionConsumerServices: { binding: string; location: string; index: number }[];
  singleLogoutServices: { binding: string; location: string }[];
  keys: SAMLSKey[];
  nameIdFormats?: string[];
  attributes?: SAMLAttribute[];
}

export interface SAMLSKey {
  certificate: string;
  use?: 'signing' | 'encryption';
}

// ============================================================================
// LDAP Types
// ============================================================================

export interface LDAPConfig {
  url: string;
  bindDN: string;
  bindCredentials: string;
  searchBase: string;
  searchFilter?: string;
  searchScope?: 'base' | 'one' | 'sub';
  searchAttributes?: string[];
  groupSearchBase?: string;
  groupSearchFilter?: string;
  groupSearchScope?: 'base' | 'one' | 'sub';
  groupAttribute?: string;
  groupMemberAttribute?: string;
  groupMemberUseAttribute?: boolean;
  tlsOptions?: LDAPTLSOptions;
  reconnect?: boolean;
  timeout?: number;
  connectTimeout?: number;
  idleTimeout?: number;
  maxConnections?: number;
}

export interface LDAPTLSOptions {
  ca?: string | string[];
  cert?: string;
  key?: string;
  rejectUnauthorized?: boolean;
  minVersion?: string;
  maxVersion?: string;
}

export interface LDAPUser {
  dn: string;
  uid?: string;
  cn?: string;
  mail?: string;
  displayName?: string;
  givenName?: string;
  sn?: string;
  telephoneNumber?: string;
  mobile?: string;
  title?: string;
  department?: string;
  company?: string;
  physicalDeliveryOfficeName?: string;
  streetAddress?: string;
  l?: string;
  st?: string;
  postalCode?: string;
  c?: string;
  jpegPhoto?: Buffer;
  userAccountControl?: number;
  objectClass?: string[];
  memberOf?: string[];
  [key: string]: any;
}

export interface LDAPGroup {
  dn: string;
  cn: string;
  description?: string;
  member?: string[];
  uniqueMember?: string[];
  memberOf?: string[];
  objectClass?: string[];
  [key: string]: any;
}

export interface LDAPAuthResult {
  success: boolean;
  user?: LDAPUser;
  error?: string;
  errorCode?: number;
}

export interface LDAPSearchResult {
  entries: LDAPUser[];
  count: number;
  error?: string;
}

export interface LDAPSyncResult {
  added: number;
  updated: number;
  removed: number;
  failed: number;
  errors: Array<{ dn: string; error: string }>;
}

export enum LDAPErrorCodes {
  SUCCESS = 0,
  OPERATIONS_ERROR = 1,
  PROTOCOL_ERROR = 2,
  TIME_LIMIT_EXCEEDED = 3,
  SIZE_LIMIT_EXCEEDED = 4,
  COMPARE_FALSE = 5,
  COMPARE_TRUE = 6,
  AUTH_METHOD_NOT_SUPPORTED = 7,
  STRONG_AUTH_REQUIRED = 8,
  REFERRAL = 10,
  ADMIN_LIMIT_EXCEEDED = 11,
  UNAVAILABLE_CRITICAL_EXTENSION = 12,
  CONFIDENTIALITY_REQUIRED = 13,
  SASL_BIND_IN_PROGRESS = 14,
  NO_SUCH_ATTRIBUTE = 16,
  UNDEFINED_ATTRIBUTE_TYPE = 17,
  INAPPROPRIATE_MATCHING = 18,
  CONSTRAINT_VIOLATION = 19,
  ATTRIBUTE_OR_VALUE_EXISTS = 20,
  INVALID_ATTRIBUTE_SYNTAX = 21,
  NO_SUCH_OBJECT = 32,
  ALIAS_PROBLEM = 33,
  INVALID_DN_SYNTAX = 34,
  IS_LEAF = 35,
  ALIAS_DEREFERENCING_PROBLEM = 36,
  INAPPROPRIATE_AUTHENTICATION = 48,
  INVALID_CREDENTIALS = 49,
  INSUFFICIENT_ACCESS_RIGHTS = 50,
  BUSY = 51,
  UNAVAILABLE = 52,
  UNWILLING_TO_PERFORM = 53,
  LOOP_DETECTED = 54,
  NAMING_VIOLATION = 64,
  OBJECT_CLASS_VIOLATION = 65,
  NOT_ALLOWED_ON_NON_LEAF = 66,
  NOT_ALLOWED_ON_RDN = 67,
  ENTRY_ALREADY_EXISTS = 68,
  OBJECT_CLASS_MODS_PROHIBITED = 69,
  AFFECTS_MULTIPLE_DSAS = 71,
  OTHER = 80,
}

// ============================================================================
// SCIM Types
// ============================================================================

export interface SCIMConfig {
  baseUrl: string;
  authenticationToken: string;
  serviceProviderConfig?: SCIMServiceProviderConfig;
  patchConfig?: SCIMPatchConfig;
  bulkConfig?: SCIMBulkConfig;
  changePasswordConfig?: SCIMChangePasswordConfig;
  bulkMaxOperations?: number;
  bulkMaxPayloadSize?: number;
  maxResults?: number;
  authenticationScheme?: 'Bearer' | 'Basic' | 'OAuth';
}

export interface SCIMServiceProviderConfig {
  authenticationSchemes: SCIMAuthenticationScheme[];
  patch?: SCIMPatchConfig;
  bulk?: SCIMBulkConfig;
  changePassword?: SCIMChangePasswordConfig;
  sort?: SCIMSortConfig;
  etag?: SCIMEtagConfig;
}

export interface SCIMAuthenticationScheme {
  name: string;
  description?: string;
  specUri?: string;
  type: 'oauthbearertoken' | 'oauth2' | 'basic' | 'httpbasic';
  primary?: boolean;
}

export interface SCIMPatchConfig {
  supported: boolean;
}

export interface SCIMBulkConfig {
  supported: boolean;
  maxOperations: number;
  maxPayloadSize: number;
}

export interface SCIMChangePasswordConfig {
  supported: boolean;
}

export interface SCIMSortConfig {
  supported: boolean;
}

export interface SCIMEtagConfig {
  supported: boolean;
}

export interface SCIMUser {
  schemas?: string[];
  id?: string;
  externalId?: string;
  userName: string;
  name?: SCIMName;
  displayName?: string;
  nickName?: string;
  profileUrl?: string;
  title?: string;
  userType?: string;
  preferredLanguage?: string;
  locale?: string;
  timezone?: string;
  active?: boolean;
  password?: string;
  emails?: SCIMEmail[];
  phoneNumbers?: SCIMPhoneNumber[];
  ims?: SCIMIm[];
  photos?: SCIMPhoto[];
  addresses?: SCIMAddress[];
  groups?: SCIMGroupReference[];
  entitlements?: SCIMENTitlement[];
  roles?: SCIMRole[];
  x509Certificates?: SCIMX509Certificate[];
  enterprise?: SCIMENTerpriseExtension;
  manager?: SCIMManager;
  meta?: SCIMMeta;
}

export interface SCIMName {
  formatted?: string;
  familyName?: string;
  givenName?: string;
  middleName?: string;
  honorificPrefix?: string;
  honorificSuffix?: string;
}

export interface SCIMEmail {
  value: string;
  type?: 'work' | 'home' | 'other';
  primary?: boolean;
  display?: string;
  ref?: string;
}

export interface SCIMPhoneNumber {
  value: string;
  type?: 'work' | 'home' | 'mobile' | 'fax' | 'pager' | 'other';
  primary?: boolean;
  display?: string;
  ref?: string;
}

export interface SCIMIm {
  value: string;
  type?: 'aim' | 'gtalk' | 'icq' | 'xmpp' | 'msn' | 'skype' | 'qq' | 'yahoo';
  primary?: boolean;
  display?: string;
  ref?: string;
}

export interface SCIMPhoto {
  value: string;
  type?: 'photo' | 'thumbnail';
  primary?: boolean;
  display?: string;
  ref?: string;
}

export interface SCIMAddress {
  formatted?: string;
  streetAddress?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  type?: 'work' | 'home' | 'other';
  primary?: boolean;
}

export interface SCIMGroupReference {
  value: string;
  ref?: string;
  type?: string;
  display?: string;
  primary?: boolean;
}

export interface SCIMENTitlement {
  value: string;
  display?: string;
  type?: string;
  primary?: boolean;
}

export interface SCIMRole {
  value: string;
  display?: string;
  type?: string;
  primary?: boolean;
}

export interface SCIMX509Certificate {
  value: string;
  display?: string;
  type?: string;
  primary?: boolean;
}

export interface SCIMENTerpriseExtension {
  employeeNumber?: string;
  costCenter?: string;
  organization?: string;
  division?: string;
  department?: string;
  manager?: SCIMManager;
}

export interface SCIMManager {
  value?: string;
  ref?: string;
  displayName?: string;
}

export interface SCIMMeta {
  resourceType: 'User' | 'Group';
  location?: string;
  created?: Date;
  lastModified?: Date;
  version?: string;
}

export interface SCIMGroup {
  schemas?: string[];
  id?: string;
  externalId?: string;
  displayName: string;
  members?: SCIMGroupMember[];
  meta?: SCIMMeta;
}

export interface SCIMGroupMember {
  value: string;
  ref?: string;
  type?: 'User' | 'Group';
  display?: string;
}

export interface SCIMListResponse<T> {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: T[];
}

export interface SCIMCreateRequest<T> {
  schemas: string[];
  [key: string]: any;
}

export interface SCIMUpdateRequest {
  schemas: string[];
  id: string;
  operations?: SCIMPatchOperation[];
  [key: string]: any;
}

export interface SCIMPatchOperation {
  op: 'add' | 'replace' | 'remove';
  path?: string;
  value: any;
}

export interface SCIMBulkRequest {
  schemas: string[];
  failOnErrors?: number;
  Operations: SCIMBulkOperation[];
}

export interface SCIMBulkOperation {
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  bulkId?: string;
  path: string;
  data: any;
}

export interface SCIMBulkResponse {
  schemas: string[];
  Operations: SCIMBulkOperationResponse[];
}

export interface SCIMBulkOperationResponse {
  status: {
    code: number;
    description?: string;
  };
  location?: string;
  bulkId?: string;
  response?: any;
}

export interface SCIMError {
  schemas: string[];
  status: string;
  detail?: string;
  scimType?: string;
}

export enum SCIMErrorTypes {
  INVALID_SYNTAX = 'invalidSyntax',
  INVALID_FILTER = 'invalidFilter',
  NO_TARGET = 'noTarget',
  INVALID_PATH = 'invalidPath',
  INVALID_VALUE = 'invalidValue',
  UNIQUENESS = 'uniqueness',
  MUTABILITY = 'mutability',
  TOO_MANY = 'tooMany',
}

// ============================================================================
// JIT Provisioning Types
// ============================================================================

export interface JITConfig {
  enabled: boolean;
  autoCreateUsers: boolean;
  autoUpdateUsers: boolean;
  defaultRoles?: string[];
  defaultGroups?: string[];
  attributeMapping: JITAttributeMapping;
  groupMapping?: JITGroupMapping;
  roleMapping?: JITRoleMapping;
  licenseAssignment?: JITLicenseAssignment;
  provisioningRules?: JITProvisioningRule[];
  domainRestrictions?: string[];
  emailVerification?: boolean;
  approvalRequired?: boolean;
  approvalWorkflow?: JITApprovalWorkflow;
}

export interface JITAttributeMapping {
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  department?: string;
  title?: string;
  manager?: string;
  phone?: string;
  mobile?: string;
  location?: string;
  timezone?: string;
  locale?: string;
  custom?: Record<string, string>;
}

export interface JITGroupMapping {
  enabled: boolean;
  sourceAttribute: string;
  groupMapping?: Record<string, string>;
  defaultGroups?: string[];
  autoCreateGroups: boolean;
}

export interface JITRoleMapping {
  enabled: boolean;
  sourceAttribute: string;
  roleMapping?: Record<string, string>;
  defaultRoles?: string[];
}

export interface JITLicenseAssignment {
  enabled: boolean;
  licensePools?: Record<string, number>;
  defaultLicense?: string;
  licenseAttribute?: string;
}

export interface JITProvisioningRule {
  name: string;
  condition: JITCondition;
  actions: JITAction[];
  priority: number;
}

export interface JITCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'matches' | 'in' | 'notIn';
  value: any;
}

export interface JITAction {
  type: 'assignRole' | 'assignGroup' | 'assignLicense' | 'setAttribute' | 'skipProvisioning';
  target: string;
  value?: any;
}

export interface JITApprovalWorkflow {
  enabled: boolean;
  approvers: string[];
  timeout?: number;
  autoApproveDomains?: string[];
}

export interface JITProvisioningResult {
  success: boolean;
  userId?: string;
  action: 'created' | 'updated' | 'skipped' | 'pending';
  roles: string[];
  groups: string[];
  licenses: string[];
  warnings: string[];
  errors: string[];
}

// ============================================================================
// Group and Role Mapping Types
// ============================================================================

export interface GroupMappingConfig {
  enabled: boolean;
  syncMode: 'automatic' | 'manual' | 'scheduled';
  syncInterval?: number;
  source: 'ldap' | 'saml' | 'scim' | 'manual';
  mappings: GroupMapping[];
  autoCreateGroups: boolean;
  preserveManualAssignments: boolean;
}

export interface GroupMapping {
  sourceGroup: string;
  targetGroup: string;
  transformation?: GroupTransformation;
  attributeSync?: AttributeSync;
  roleMappings?: RoleMapping[];
}

export interface GroupTransformation {
  namePattern?: string;
  descriptionPattern?: string;
  metadataMapping?: Record<string, string>;
}

export interface AttributeSync {
  enabled: boolean;
  attributes: string[];
  syncInterval?: number;
}

export interface RoleMapping {
  sourceRole: string;
  targetRole: string;
  permissions?: string[];
  conditions?: RoleCondition[];
}

export interface RoleCondition {
  field: string;
  operator: 'equals' | 'contains' | 'in' | 'notIn';
  value: any;
}

export interface GroupSyncResult {
  success: boolean;
  added: number;
  updated: number;
  removed: number;
  failed: number;
  errors: Array<{ group: string; error: string }>;
}

export interface RoleAssignment {
  userId: string;
  roleId: string;
  source: string;
  sourceId?: string;
  expiresAt?: Date;
  conditions?: RoleCondition[];
}

// ============================================================================
// Audit Types
// ============================================================================

export interface AuditConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  storage: AuditStorageConfig;
  retention: AuditRetentionConfig;
  events: AuditEventConfig;
  masking: AuditMaskingConfig;
  alerts: AuditAlertConfig;
}

export interface AuditStorageConfig {
  type: 'database' | 'file' | 'cloud' | 'hybrid';
  connectionString?: string;
  tableName?: string;
  filePath?: string;
  cloudProvider?: 'aws' | 'gcp' | 'azure' | 'cloudflare';
  cloudBucket?: string;
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
}

export interface AuditRetentionConfig {
  enabled: boolean;
  retentionDays: number;
  archiveDays?: number;
  archiveStorage?: AuditStorageConfig;
  deleteAfterRetention: boolean;
}

export interface AuditEventConfig {
  includeSuccessfulEvents: boolean;
  includeFailedEvents: boolean;
  eventTypes: AuditEventType[];
  excludeEventTypes?: string[];
  detailedLogging: boolean;
}

export interface AuditMaskingConfig {
  enabled: boolean;
  fieldsToMask: string[];
  maskingPattern: string;
  preserveLength: boolean;
}

export interface AuditAlertConfig {
  enabled: boolean;
  alertOn: AuditAlertType[];
  notificationChannels: AuditNotificationChannel[];
  throttleMinutes?: number;
}

export type AuditAlertType =
  | 'failedAuthentication'
  | 'unauthorizedAccess'
  | 'privilegeEscalation'
  | 'dataAccess'
  | 'configurationChange'
  | 'provisioningFailure';

export interface AuditNotificationChannel {
  type: 'email' | 'webhook' | 'slack' | 'pagerduty';
  config: Record<string, any>;
}

export type AuditEventType =
  | 'user.login'
  | 'user.logout'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.provisioned'
  | 'user.deprovisioned'
  | 'group.created'
  | 'group.updated'
  | 'group.deleted'
  | 'group.member_added'
  | 'group.member_removed'
  | 'role.assigned'
  | 'role.revoked'
  | 'saml.sso_initiated'
  | 'saml.sso_completed'
  | 'saml.slo_initiated'
  | 'saml.slo_completed'
  | 'saml.assertion_received'
  | 'ldap.sync_started'
  | 'ldap.sync_completed'
  | 'ldap.sync_failed'
  | 'scim.user_created'
  | 'scim.user_updated'
  | 'scim.user_deleted'
  | 'scim.group_created'
  | 'scim.group_updated'
  | 'scim.group_deleted'
  | 'jit.provisioning_started'
  | 'jit.provisioning_completed'
  | 'jit.provisioning_failed'
  | 'permission.granted'
  | 'permission.revoked'
  | 'configuration.changed'
  | 'certificate.expired'
  | 'certificate.expiring';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  category: AuditCategory;
  severity: AuditSeverity;
  userId?: string;
  actorId?: string;
  actorType?: 'user' | 'service' | 'system';
  resourceId?: string;
  resourceType?: string;
  action: string;
  result: AuditResult;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  details?: Record<string, any>;
  correlationId?: string;
  sessionId?: string;
}

export type AuditCategory =
  | 'authentication'
  | 'authorization'
  | 'provisioning'
  | 'synchronization'
  | 'configuration'
  | 'security'
  | 'compliance';

export type AuditSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type AuditResult = 'success' | 'failure' | 'partial';

export interface AuditQuery {
  startTime?: Date;
  endTime?: Date;
  eventTypes?: AuditEventType[];
  categories?: AuditCategory[];
  severities?: AuditSeverity[];
  userIds?: string[];
  resourceIds?: string[];
  results?: AuditResult[];
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'eventType' | 'severity';
  sortOrder?: 'asc' | 'desc';
  includeDetails?: boolean;
}

export interface AuditReport {
  id: string;
  generatedAt: Date;
  generatedBy: string;
  query: AuditQuery;
  events: AuditEvent[];
  summary: AuditSummary;
  format: 'json' | 'csv' | 'pdf';
}

export interface AuditSummary {
  totalEvents: number;
  byEventType: Record<string, number>;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  byResult: Record<string, number>;
  uniqueUsers: number;
  uniqueResources: number;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const SAMLConfigSchema = z.object({
  entityId: z.string().url(),
  ssoUrl: z.string().url(),
  sloUrl: z.string().url().optional(),
  certificate: z.string(),
  privateKey: z.string().optional(),
  nameIdFormat: z.string().optional(),
  assertionConsumerServiceUrl: z.string().url(),
  attributeConsumingServiceIndex: z.number().optional(),
  organization: z.object({
    name: z.string(),
    displayName: z.string(),
    url: z.string().url(),
  }).optional(),
  contactPerson: z.object({
    contactType: z.enum(['technical', 'support', 'administrative', 'billing', 'other']),
    company: z.string().optional(),
    givenName: z.string().optional(),
    surName: z.string().optional(),
    emailAddresses: z.array(z.string().email()),
    telephoneNumbers: z.array(z.string()).optional(),
  }).optional(),
  signingAlgorithm: z.string().optional(),
  digestAlgorithm: z.string().optional(),
  wantAssertionsSigned: z.boolean().optional(),
  wantAssertionsEncrypted: z.boolean().optional(),
  signingContext: z.enum(['context', 'message']).optional(),
});

export const LDAPConfigSchema = z.object({
  url: z.string().url(),
  bindDN: z.string(),
  bindCredentials: z.string(),
  searchBase: z.string(),
  searchFilter: z.string().optional(),
  searchScope: z.enum(['base', 'one', 'sub']).optional(),
  searchAttributes: z.array(z.string()).optional(),
  groupSearchBase: z.string().optional(),
  groupSearchFilter: z.string().optional(),
  groupSearchScope: z.enum(['base', 'one', 'sub']).optional(),
  groupAttribute: z.string().optional(),
  groupMemberAttribute: z.string().optional(),
  groupMemberUseAttribute: z.boolean().optional(),
  tlsOptions: z.object({
    ca: z.union([z.string(), z.array(z.string())]).optional(),
    cert: z.string().optional(),
    key: z.string().optional(),
    rejectUnauthorized: z.boolean().optional(),
    minVersion: z.string().optional(),
    maxVersion: z.string().optional(),
  }).optional(),
  reconnect: z.boolean().optional(),
  timeout: z.number().optional(),
  connectTimeout: z.number().optional(),
  idleTimeout: z.number().optional(),
  maxConnections: z.number().optional(),
});

export const SCIMConfigSchema = z.object({
  baseUrl: z.string().url(),
  authenticationToken: z.string(),
  serviceProviderConfig: z.any().optional(),
  patchConfig: z.any().optional(),
  bulkConfig: z.any().optional(),
  changePasswordConfig: z.any().optional(),
  bulkMaxOperations: z.number().optional(),
  bulkMaxPayloadSize: z.number().optional(),
  maxResults: z.number().optional(),
  authenticationScheme: z.enum(['Bearer', 'Basic', 'OAuth']).optional(),
});

export const JITConfigSchema = z.object({
  enabled: z.boolean(),
  autoCreateUsers: z.boolean(),
  autoUpdateUsers: z.boolean(),
  defaultRoles: z.array(z.string()).optional(),
  defaultGroups: z.array(z.string()).optional(),
  attributeMapping: z.object({
    userId: z.string().optional(),
    email: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    displayName: z.string().optional(),
    department: z.string().optional(),
    title: z.string().optional(),
    manager: z.string().optional(),
    phone: z.string().optional(),
    mobile: z.string().optional(),
    location: z.string().optional(),
    timezone: z.string().optional(),
    locale: z.string().optional(),
    custom: z.record(z.string()).optional(),
  }),
  groupMapping: z.object({
    enabled: z.boolean(),
    sourceAttribute: z.string(),
    groupMapping: z.record(z.string()).optional(),
    defaultGroups: z.array(z.string()).optional(),
    autoCreateGroups: z.boolean(),
  }).optional(),
  roleMapping: z.object({
    enabled: z.boolean(),
    sourceAttribute: z.string(),
    roleMapping: z.record(z.string()).optional(),
    defaultRoles: z.array(z.string()).optional(),
  }).optional(),
  licenseAssignment: z.object({
    enabled: z.boolean(),
    licensePools: z.record(z.number()).optional(),
    defaultLicense: z.string().optional(),
    licenseAttribute: z.string().optional(),
  }).optional(),
  provisioningRules: z.array(z.any()).optional(),
  domainRestrictions: z.array(z.string()).optional(),
  emailVerification: z.boolean().optional(),
  approvalRequired: z.boolean().optional(),
  approvalWorkflow: z.any().optional(),
});

export const AuditConfigSchema = z.object({
  enabled: z.boolean(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
  storage: z.object({
    type: z.enum(['database', 'file', 'cloud', 'hybrid']),
    connectionString: z.string().optional(),
    tableName: z.string().optional(),
    filePath: z.string().optional(),
    cloudProvider: z.enum(['aws', 'gcp', 'azure', 'cloudflare']).optional(),
    cloudBucket: z.string().optional(),
    encryptionEnabled: z.boolean(),
    compressionEnabled: z.boolean(),
  }),
  retention: z.object({
    enabled: z.boolean(),
    retentionDays: z.number(),
    archiveDays: z.number().optional(),
    archiveStorage: z.any().optional(),
    deleteAfterRetention: z.boolean(),
  }),
  events: z.object({
    includeSuccessfulEvents: z.boolean(),
    includeFailedEvents: z.boolean(),
    eventTypes: z.array(z.string()),
    excludeEventTypes: z.array(z.string()).optional(),
    detailedLogging: z.boolean(),
  }),
  masking: z.object({
    enabled: z.boolean(),
    fieldsToMask: z.array(z.string()),
    maskingPattern: z.string(),
    preserveLength: z.boolean(),
  }),
  alerts: z.object({
    enabled: z.boolean(),
    alertOn: z.array(z.string()),
    notificationChannels: z.array(z.object({
      type: z.enum(['email', 'webhook', 'slack', 'pagerduty']),
      config: z.record(z.any()),
    })),
    throttleMinutes: z.number().optional(),
  }),
});
