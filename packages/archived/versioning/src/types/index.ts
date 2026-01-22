/**
 * Core type definitions for the API versioning system
 */

import { z } from 'zod';

/**
 * Semantic version representation
 */
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string[];
  build?: string[];
}

/**
 * API version strategy types
 */
export enum VersioningStrategy {
  URL_PATH = 'url_path',
  HEADER = 'header',
  QUERY_PARAM = 'query_param',
  CONTENT_TYPE = 'content_type',
  ACCEPT_HEADER = 'accept_header',
}

/**
 * Version location in request
 */
export interface VersionLocation {
  strategy: VersioningStrategy;
  parameter?: string; // e.g., 'API-Version', 'version'
  prefix?: string; // e.g., '/api/v', 'application/vnd.claudeflare.v'
}

/**
 * API version definition
 */
export interface APIVersion {
  version: string;
  semver: SemVer;
  status: VersionStatus;
  releasedAt: Date;
  deprecatedAt?: Date;
  sunsetAt?: Date;
  description: string;
  breakingChanges: string[];
  features: string[];
  deprecations: DeprecationRecord[];
}

/**
 * Version status lifecycle
 */
export enum VersionStatus {
  DEVELOPMENT = 'development',
  ALPHA = 'alpha',
  BETA = 'beta',
  STABLE = 'stable',
  DEPRECATED = 'deprecated',
  SUNSET = 'sunset',
  RETIRED = 'retired',
}

/**
 * Deprecation record
 */
export interface DeprecationRecord {
  id: string;
  apiVersion: string;
  endpoint?: string;
  method?: string;
  deprecationDate: Date;
  sunsetDate: Date;
  reason: string;
  successorVersion?: string;
  successorEndpoint?: string;
  migrationGuide?: string;
  warnings: DeprecationWarning[];
  affectedClients: string[];
}

/**
 * Deprecation warning configuration
 */
export interface DeprecationWarning {
  type: WarningType;
  severity: WarningSeverity;
  message: string;
  code: string;
  documentation?: string;
}

/**
 * Warning types
 */
export enum WarningType {
  DEPRECATION = 'deprecation',
  SUNSET = 'sunset',
  BREAKING_CHANGE = 'breaking_change',
  REMOVAL = 'removal',
  BEHAVIOR_CHANGE = 'behavior_change',
}

/**
 * Warning severity levels
 */
export enum WarningSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Breaking change types
 */
export enum BreakingChangeType {
  PARAMETER_REMOVED = 'parameter_removed',
  PARAMETER_RENAMED = 'parameter_renamed',
  PARAMETER_TYPE_CHANGED = 'parameter_type_changed',
  PARAMETER_REQUIRED_CHANGED = 'parameter_required_changed',
  RESPONSE_FIELD_REMOVED = 'response_field_removed',
  RESPONSE_FIELD_RENAMED = 'response_field_renamed',
  RESPONSE_FIELD_TYPE_CHANGED = 'response_field_type_changed',
  RESPONSE_STRUCTURE_CHANGED = 'response_structure_changed',
  ENDPOINT_REMOVED = 'endpoint_removed',
  ENDPOINT_RENAMED = 'endpoint_renamed',
  HTTP_METHOD_CHANGED = 'http_method_changed',
  AUTHENTICATION_CHANGED = 'authentication_changed',
  RATE_LIMIT_CHANGED = 'rate_limit_changed',
  BEHAVIOR_CHANGED = 'behavior_changed',
  SECURITY_CHANGE = 'security_change',
}

/**
 * Breaking change analysis result
 */
export interface BreakingChange {
  type: BreakingChangeType;
  severity: 'major' | 'minor' | 'patch';
  category: 'breaking' | 'non-breaking';
  description: string;
  impact: string[];
  affectedEndpoints: string[];
  migration: MigrationStep[];
  automatedFix?: boolean;
}

/**
 * API endpoint definition
 */
export interface APIEndpoint {
  path: string;
  method: string;
  version: string;
  deprecated?: boolean;
  sunsetAt?: Date;
  deprecation: DeprecationRecord;
  parameters: APIParameter[];
  response: APIResponse;
  authentication?: AuthenticationScheme;
  rateLimit?: RateLimit;
}

/**
 * API parameter definition
 */
export interface APIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie' | 'body';
  type: string;
  required: boolean;
  deprecated?: boolean;
  deprecationInfo?: DeprecationRecord;
  description?: string;
  schema?: any;
}

/**
 * API response definition
 */
export interface APIResponse {
  statusCode: number;
  description: string;
  schema?: any;
  headers?: Record<string, string>;
}

/**
 * Authentication scheme
 */
export interface AuthenticationScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  scheme?: string;
  bearerFormat?: string;
  flows?: any;
}

/**
 * Rate limit configuration
 */
export interface RateLimit {
  requests: number;
  period: number; // in seconds
  per?: 'user' | 'api_key' | 'ip';
}

/**
 * Migration step
 */
export interface MigrationStep {
  step: number;
  description: string;
  action: MigrationAction;
  automated: boolean;
  codeExample?: string;
}

/**
 * Migration action types
 */
export enum MigrationAction {
  RENAME_PARAMETER = 'rename_parameter',
  CHANGE_PARAMETER_TYPE = 'change_parameter_type',
  ADD_PARAMETER = 'add_parameter',
  REMOVE_PARAMETER = 'remove_parameter',
  RENAME_FIELD = 'rename_field',
  CHANGE_FIELD_TYPE = 'change_field_type',
  ADD_FIELD = 'add_field',
  REMOVE_FIELD = 'remove_field',
  CHANGE_ENDPOINT = 'change_endpoint',
  CHANGE_METHOD = 'change_method',
  UPDATE_AUTHENTICATION = 'update_authentication',
  MIGRATE_DATA = 'migrate_data',
  UPDATE_HEADERS = 'update_headers',
}

/**
 * Compatibility test result
 */
export interface CompatibilityTest {
  sourceVersion: string;
  targetVersion: string;
  compatible: boolean;
  breakingChanges: BreakingChange[];
  warnings: DeprecationWarning[];
  recommendations: string[];
  testResults: TestResult[];
}

/**
 * Individual test result
 */
export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  sourceVersion: string;
  targetVersion: string;
  majorChange: boolean;
  minorChange: boolean;
  patchChange: boolean;
  difference: 'major' | 'minor' | 'patch' | 'prerelease' | 'build' | 'equal';
  upgradeType: 'major' | 'minor' | 'patch' | 'downgrade';
}

/**
 * Migration guide
 */
export interface MigrationGuide {
  sourceVersion: string;
  targetVersion: string;
  overview: string;
  estimatedTime: string;
  difficulty: 'easy' | 'medium' | 'hard';
  steps: MigrationStep[];
  codeExamples: CodeExample[];
  commonIssues: CommonIssue[];
  rollbackInstructions: string;
  testingInstructions: string;
}

/**
 * Code example
 */
export interface CodeExample {
  language: string;
  description: string;
  before: string;
  after: string;
  diff?: string;
}

/**
 * Common issue during migration
 */
export interface CommonIssue {
  issue: string;
  solution: string;
  code?: string;
}

/**
 * Version transformation rule
 */
export interface TransformRule {
  name: string;
  fromVersion: string;
  toVersion: string;
  transform: Transform;
  priority: number;
}

/**
 * Transform types
 */
export enum Transform {
  REQUEST_TRANSFORM = 'request_transform',
  RESPONSE_TRANSFORM = 'response_transform',
  PARAMETER_TRANSFORM = 'parameter_transform',
  HEADER_TRANSFORM = 'header_transform',
  BODY_TRANSFORM = 'body_transform',
}

/**
 * Transform configuration
 */
export interface TransformConfig {
  sourceVersion: string;
  targetVersion: string;
  requestTransforms?: RequestTransform[];
  responseTransforms?: ResponseTransform[];
  headerTransforms?: HeaderTransform[];
}

/**
 * Request transformation
 */
export interface RequestTransform {
  type: Transform;
  path: string;
  operation: 'rename' | 'remove' | 'add' | 'modify' | 'move';
  from: any;
  to: any;
  condition?: string;
}

/**
 * Response transformation
 */
export interface ResponseTransform {
  type: Transform;
  path: string;
  operation: 'rename' | 'remove' | 'add' | 'modify' | 'move';
  from: any;
  to: any;
}

/**
 * Header transformation
 */
export interface HeaderTransform {
  header: string;
  operation: 'rename' | 'remove' | 'add' | 'modify';
  value: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  version: string;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  recommendations: string[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  suggestion?: string;
}

/**
 * API contract
 */
export interface APIContract {
  version: string;
  endpoints: APIEndpoint[];
  schemas: Record<string, any>;
  securitySchemes: Record<string, AuthenticationScheme>;
  metadata: ContractMetadata;
}

/**
 * Contract metadata
 */
export interface ContractMetadata {
  title: string;
  description: string;
  version: string;
  baseUrl: string;
  contact?: {
    name: string;
    email: string;
    url: string;
  };
  license?: {
    name: string;
    url: string;
  };
}

/**
 * Version policy
 */
export interface VersionPolicy {
  supportedVersions: string[];
  defaultVersion: string;
  deprecationPolicy: DeprecationPolicy;
  migrationPolicy: MigrationPolicy;
  compatibilityPolicy: CompatibilityPolicy;
}

/**
 * Deprecation policy
 */
export interface DeprecationPolicy {
  minimumNoticePeriod: number; // days
  warningPeriod: number; // days
  defaultSunsetPeriod: number; // days
  requireSuccessorVersion: boolean;
  requireMigrationGuide: boolean;
}

/**
 * Migration policy
 */
export interface MigrationPolicy {
  automatedMigrationSupported: boolean;
  rollbackPeriod: number; // days
  testingRequired: boolean;
  documentationRequired: boolean;
}

/**
 * Compatibility policy
 */
export interface CompatibilityPolicy {
  backwardCompatible: boolean;
  forwardCompatible: boolean;
  gracePeriod: number; // days
  allowBreakingChanges: boolean;
}

/**
 * Version metadata
 */
export interface VersionMetadata {
  version: string;
  changelog: string;
  releaseNotes: string;
  upgradeGuide?: string;
  knownIssues: string[];
  dependencies: Record<string, string>;
}

/**
 * Analysis options
 */
export interface AnalysisOptions {
  strictMode: boolean;
  checkSecurityChanges: boolean;
  checkPerformanceChanges: boolean;
  generateMigrationGuide: boolean;
  includeRecommendations: boolean;
}

/**
 * Version registry
 */
export interface VersionRegistry {
  versions: Map<string, APIVersion>;
  endpoints: Map<string, APIEndpoint[]>;
  deprecations: Map<string, DeprecationRecord[]>;
  transforms: Map<string, TransformConfig[]>;
  contracts: Map<string, APIContract>;
}

/**
 * Context for version resolution
 */
export interface VersionContext {
  request: Request;
  headers: Headers;
  query: URLSearchParams;
  body?: any;
  cookies: Record<string, string>;
}

/**
 * Version resolution result
 */
export interface VersionResolution {
  version: string;
  strategy: VersioningStrategy;
  confidence: number;
  alternatives: string[];
  metadata: Record<string, any>;
}

/**
 * Deprecation header configuration
 */
export interface DeprecationHeaders {
  deprecation: boolean;
  sunset?: Date;
  link?: string;
  warning?: string;
  'api-version'?: string;
  'successor-version'?: string;
}

/**
 * Migration status
 */
export interface MigrationStatus {
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  progress: number;
  currentStep: number;
  totalSteps: number;
  errors: string[];
  warnings: string[];
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Export for module usage
 */
export const VersioningTypes = {
  VersioningStrategy,
  VersionStatus,
  WarningType,
  WarningSeverity,
  BreakingChangeType,
  MigrationAction,
  Transform,
};
