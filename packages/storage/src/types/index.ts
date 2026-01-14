/**
 * Core type definitions for the storage package
 * Provides unified interfaces across all storage backends
 */

// ============================================================================
// Storage Backend Types
// ============================================================================

export type StorageBackend =
  | 'r2'
  | 's3'
  | 'gcs'
  | 'azure'
  | 'local'
  | 'memory';

export interface StorageCredentials {
  backend: StorageBackend;
  credentials: Record<string, string | undefined>;
}

// ============================================================================
// File Types
// ============================================================================

export interface FileMetadata {
  key: string;
  bucket: string;
  size: number;
  contentType: string;
  etag?: string;
  versionId?: string;
  lastModified: Date;
  customMetadata?: Record<string, string>;
  storageClass?: string;
  encryption?: EncryptionInfo;
  tags?: Record<string, string>;
}

export interface FileUploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
  storageClass?: string;
  encryption?: EncryptionOptions;
  chunkSize?: number;
  multipart?: boolean;
  multipartThreshold?: number;
  cacheControl?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  contentLanguage?: string;
  checksum?: string;
  preconditions?: Preconditions;
}

export interface FileDownloadOptions {
  versionId?: string;
  range?: { start: number; end: number };
  encryption?: EncryptionOptions;
  preconditions?: Preconditions;
}

export interface FileCopyOptions {
  destinationKey: string;
  destinationBucket?: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
  storageClass?: string;
  encryption?: EncryptionOptions;
  multipart?: boolean;
}

export interface FileMoveOptions {
  destinationKey: string;
  destinationBucket?: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
}

export interface FileDeleteOptions {
  versionId?: string;
  bypassGovernance?: boolean;
}

export interface BatchOperationOptions {
  concurrency?: number;
  continueOnError?: boolean;
  progressCallback?: (progress: BatchProgress) => void;
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string;
}

export interface BatchResult<T> {
  successful: Array<{ key: string; result: T }>;
  failed: Array<{ key: string; error: Error }>;
}

// ============================================================================
// Preconditions
// ============================================================================

export interface Preconditions {
  ifMatch?: string;
  ifNoneMatch?: string;
  ifModifiedSince?: Date;
  ifUnmodifiedSince?: Date;
  ifMatches?: Record<string, string>;
}

// ============================================================================
// Encryption Types
// ============================================================================

export type EncryptionType =
  | 'none'
  | 'server-side'
  | 'client-side'
  | 'hybrid';

export type EncryptionAlgorithm =
  | 'AES256'
  | 'AES-GCM-256'
  | 'RSA-OAEP'
  | 'AWS-KMS'
  | 'GCP-KMS'
  | 'Azure-KMS';

export interface EncryptionOptions {
  type: EncryptionType;
  algorithm?: EncryptionAlgorithm;
  keyId?: string;
  key?: Buffer;
  kmsKeyArn?: string;
  kmsContext?: Record<string, string>;
}

export interface EncryptionInfo {
  type: EncryptionType;
  algorithm: EncryptionAlgorithm;
  keyId?: string;
  kmsKeyArn?: string;
  encrypted: boolean;
  iv?: string;
  authTag?: string;
}

// ============================================================================
// Bucket Types
// ============================================================================

export interface BucketConfig {
  name: string;
  location?: string;
  locationType?: string;
  storageClass?: string;
  versioning?: VersioningConfig;
  encryption?: EncryptionOptions;
  logging?: LoggingConfig;
  website?: WebsiteConfig;
  cors?: CORSConfig[];
  lifecycle?: LifecycleRule[];
  labels?: Record<string, string>;
  requesterPays?: boolean;
  publicAccess?: PublicAccessConfig;
}

export interface BucketMetadata {
  name: string;
  createdAt: Date;
  location: string;
  locationType: string;
  storageClass: string;
  versioning: VersioningStatus;
  encryption: EncryptionInfo;
  size?: number;
  objectCount?: number;
  publicAccess?: PublicAccessConfig;
}

export interface BucketPolicy {
  version: string;
  statements: PolicyStatement[];
}

export interface PolicyStatement {
  sid?: string;
  effect: 'Allow' | 'Deny';
  principals?: Principal[];
  actions: string[];
  resources: string[];
  conditions?: Record<string, string[]>;
}

export interface Principal {
  type: 'User' | 'Group' | 'Service' | 'Account' | '*';
  values: string[];
}

export type VersioningStatus = 'Enabled' | 'Suspended' | 'Disabled';

export interface VersioningConfig {
  status: VersioningStatus;
  mfaDelete?: 'Enabled' | 'Disabled';
}

// ============================================================================
// Lifecycle Management
// ============================================================================

export interface LifecycleRule {
  id?: string;
  status: 'Enabled' | 'Disabled';
  filter?: LifecycleFilter;
  transitions?: Transition[];
  expiration?: Expiration;
  abortIncompleteMultipartUpload?: AbortIncompleteMultipartUpload;
  noncurrentVersionTransitions?: NoncurrentVersionTransition[];
  noncurrentVersionExpiration?: NoncurrentVersionExpiration;
}

export interface LifecycleFilter {
  prefix?: string;
  tags?: Record<string, string>;
  and?: LifecycleFilterAnd;
}

export interface LifecycleFilterAnd {
  prefix?: string;
  tags?: Record<string, string>;
}

export interface Transition {
  days?: number;
  date?: Date;
  storageClass: string;
}

export interface Expiration {
  days?: number;
  date?: Date;
  expiredObjectDeleteMarker?: boolean;
}

export interface NoncurrentVersionTransition {
  noncurrentDays?: number;
  storageClass: string;
}

export interface NoncurrentVersionExpiration {
  noncurrentDays?: number;
}

export interface AbortIncompleteMultipartUpload {
  daysAfterInitiation?: number;
}

// ============================================================================
// CORS Configuration
// ============================================================================

export interface CORSConfig {
  id?: string;
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposeHeaders: string[];
  maxAgeSeconds?: number;
  allowCredentials?: boolean;
}

// ============================================================================
// Website Configuration
// ============================================================================

export interface WebsiteConfig {
  indexDocument?: string;
  errorDocument?: string;
  redirectAllRequestsTo?: string;
  routingRules?: RoutingRule[];
}

export interface RoutingRule {
  condition?: RoutingRuleCondition;
  redirect: RoutingRuleRedirect;
}

export interface RoutingRuleCondition {
  keyPrefixEquals?: string;
  httpErrorCodeReturnedEquals?: string;
}

export interface RoutingRuleRedirect {
  protocol?: string;
  hostname?: string;
  replaceKeyPrefixWith?: string;
  replaceKeyWith?: string;
  httpRedirectCode?: string;
}

// ============================================================================
// Logging Configuration
// ============================================================================

export interface LoggingConfig {
  targetBucket: string;
  targetPrefix: string;
  targetGrants?: PolicyGrant[];
}

export interface PolicyGrant {
  grantee: Grantee;
  permission: 'READ' | 'WRITE' | 'FULL_CONTROL';
}

export interface Grantee {
  type: 'User' | 'Group' | 'Email' | 'CanonicalUser';
  displayName?: string;
  emailAddress?: string;
  id?: string;
  uri?: string;
}

// ============================================================================
// Public Access Configuration
// ============================================================================

export interface PublicAccessConfig {
  blockPublicAccess: boolean;
  blockPublicPolicy: boolean;
  ignorePublicAcls: boolean;
  restrictPublicBuckets: boolean;
}

// ============================================================================
// Multipart Upload
// ============================================================================

export interface MultipartUpload {
  uploadId: string;
  key: string;
  bucket: string;
  initiated: Date;
  storageClass?: string;
  owner?: string;
  initiator?: string;
}

export interface MultipartPart {
  partNumber: number;
  etag: string;
  size?: number;
}

export interface MultipartUploadOptions {
  concurrency?: number;
  chunkSize?: number;
  progressCallback?: (progress: UploadProgress) => void;
}

export interface UploadProgress {
  uploaded: number;
  total: number;
  percentage: number;
  speed?: number;
  eta?: number;
}

// ============================================================================
// CDN Types
// ============================================================================

export type CDNProvider = 'cloudflare' | 'akamai' | 'fastly' | 'aws';

export interface CDNConfig {
  provider: CDNProvider;
  zoneId?: string;
  distributionId?: string;
  customDomains?: string[];
  sslConfig?: SSLConfig;
  cacheRules?: CacheRule[];
  origin?: OriginConfig;
}

export interface SSLConfig {
  enabled: boolean;
  certificateId?: string;
  certificateArn?: string;
  minimumTLSVersion?: string;
  tlsVersions?: string[];
}

export interface CacheRule {
  id?: string;
  pattern: string;
  cacheLevel: 'bypass' | 'basic' | 'simplified' | 'aggressive';
  edgeTTL?: number;
  browserTTL?: number;
  respectStrongETags?: boolean;
  bypassCacheOnCookie?: string;
  cacheKey?: CacheKeyConfig;
}

export interface CacheKeyConfig {
  ignoreCase?: boolean;
  includeProtocol?: boolean;
  includeHost?: boolean;
  includeQueryString?: boolean;
  querystring?: {
    exclude?: string[];
    include?: string[];
  };
}

export interface OriginConfig {
  endpoint: string;
  sslProtocols?: string[];
  readTimeout?: number;
  keepAlive?: boolean;
  http2?: boolean;
  compress?: boolean;
}

export interface CacheInvalidationOptions {
  paths: string[];
  tags?: string[];
  invalidateAll?: boolean;
  purgeEverything?: boolean;
}

export interface CacheInvalidationResult {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  created: Date;
  completed?: Date;
  files: number;
}

// ============================================================================
// Versioning Types
// ============================================================================

export interface FileVersion {
  versionId: string;
  key: string;
  bucket: string;
  size: number;
  contentType: string;
  lastModified: Date;
  isLatest: boolean;
  isDeleteMarker: boolean;
  metadata?: Record<string, string>;
  storageClass?: string;
}

export interface VersionDiff {
  added: FileVersion[];
  modified: Array<{
    version: FileVersion;
    changes: VersionChange[];
  }>;
  deleted: FileVersion[];
}

export interface VersionChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface VersionRetentionConfig {
  enabled: boolean;
  retainUntil?: Date;
  mode?: 'governance' | 'compliance';
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface StorageMetrics {
  bucket: string;
  period: MetricsPeriod;
  timestamp: Date;
  storage: StorageMetricsData;
  requests: RequestMetricsData;
  transfer: TransferMetricsData;
  errors: ErrorMetricsData;
}

export interface MetricsPeriod {
  start: Date;
  end: Date;
}

export interface StorageMetricsData {
  totalSize: number;
  objectCount: number;
  averageSize: number;
  sizeDistribution: Record<string, number>;
  storageClassDistribution: Record<string, number>;
  growthRate: number;
}

export interface RequestMetricsData {
  total: number;
  get: number;
  put: number;
  delete: number;
  list: number;
  head: number;
  other: number;
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
}

export interface TransferMetricsData {
  bytesIn: number;
  bytesOut: number;
  bytesTransferred: number;
  averageTransferSize: number;
  peakTransferRate: number;
}

export interface ErrorMetricsData {
  total: number;
  byErrorCode: Record<string, number>;
  byErrorType: Record<string, number>;
}

export interface UsageReport {
  bucket: string;
  period: MetricsPeriod;
  summary: UsageSummary;
  topObjects: TopObjectSummary[];
  topUsers: UserSummary[];
  costAnalysis: CostAnalysis;
}

export interface UsageSummary {
  totalStorage: number;
  totalRequests: number;
  totalTransfer: number;
  averageObjectSize: number;
  totalObjects: number;
}

export interface TopObjectSummary {
  key: string;
  size: number;
  accessCount: number;
  bandwidth: number;
}

export interface UserSummary {
  userId: string;
  requestCount: number;
  transfer: number;
  operations: Record<string, number>;
}

export interface CostAnalysis {
  storageCost: number;
  requestCost: number;
  transferCost: number;
  totalCost: number;
  byStorageClass: Record<string, number>;
}

export interface PerformanceMetrics {
  latency: LatencyMetrics;
  throughput: ThroughputMetrics;
  availability: AvailabilityMetrics;
}

export interface LatencyMetrics {
  average: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  p999: number;
}

export interface ThroughputMetrics {
  requestsPerSecond: number;
  bytesPerSecond: number;
  peakRequestsPerSecond: number;
  peakBytesPerSecond: number;
}

export interface AvailabilityMetrics {
  uptime: number;
  downtime: number;
  availability: number;
  incidents: IncidentSummary[];
}

export interface IncidentSummary {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  affectedObjects: number;
  errorRate: number;
  resolved: boolean;
}

// ============================================================================
// Stream Types
// ============================================================================

export interface StreamOptions {
  highWaterMark?: number;
  encoding?: BufferEncoding;
  autoClose?: boolean;
  start?: number;
  end?: number;
}

export interface UploadStreamOptions extends FileUploadOptions {
  concurrency?: number;
  retries?: number;
  timeout?: number;
}

// ============================================================================
// List Options
// ============================================================================

export interface ListOptions {
  prefix?: string;
  delimiter?: string;
  maxKeys?: number;
  continuationToken?: string;
  startAfter?: string;
  versionId?: string;
  includeVersions?: boolean;
}

export interface ListResult {
  objects: FileMetadata[];
  commonPrefixes: string[];
  isTruncated: boolean;
  nextContinuationToken?: string;
  count: number;
  maxKeys: number;
  prefix?: string;
  delimiter?: string;
}

// ============================================================================
// Presigned URL Types
// ============================================================================

export interface PresignedUrlOptions {
  expiresIn?: number;
  method?: 'GET' | 'PUT' | 'DELETE' | 'HEAD';
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
}

// ============================================================================
// Tagging Types
// ============================================================================

export interface TagSet {
  tags: Record<string, string>;
}

export interface TaggingOptions {
  tags: Record<string, string>;
  versionId?: string;
}

// ============================================================================
// Lock Types
// ============================================================================

export interface ObjectLockConfig {
  enabled: boolean;
  mode?: 'governance' | 'compliance';
  retainUntil?: Date;
  legalHold?: boolean;
}

export interface LegalHold {
  enabled: boolean;
  status: 'ON' | 'OFF';
}

// ============================================================================
// Replication Types
// ============================================================================

export interface ReplicationConfig {
  enabled: boolean;
  destination: ReplicationDestination;
  rules: ReplicationRule[];
}

export interface ReplicationDestination {
  bucket: string;
  storageClass?: string;
  account?: string;
  region?: string;
}

export interface ReplicationRule {
  id?: string;
  status: 'Enabled' | 'Disabled';
  prefix?: string;
  destination: ReplicationDestination;
  deleteReplication?: boolean;
  priority?: number;
  filter?: LifecycleFilter;
}

// ============================================================================
// Event Types
// ============================================================================

export type StorageEventType =
  | 'object-created'
  | 'object-deleted'
  | 'object-restored'
  | 'object-expired'
  | 'lifecycle-transition'
  | 'bucket-created'
  | 'bucket-deleted';

export interface StorageEvent {
  type: StorageEventType;
  bucket: string;
  key: string;
  versionId?: string;
  size?: number;
  contentType?: string;
  etag?: string;
  timestamp: Date;
  userIdentity?: string;
  requestId?: string;
}

// ============================================================================
// Response Types
// ============================================================================

export interface StorageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: StorageError;
  metadata?: ResponseMetadata;
}

export interface ResponseMetadata {
  requestId: string;
  extensionId?: string;
  statusCode: number;
  headers?: Record<string, string>;
  retryCount?: number;
}

export interface StorageError extends Error {
  code: string;
  statusCode: number;
  bucket?: string;
  key?: string;
  requestId?: string;
  retryable?: boolean;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface StorageConfig {
  backend: StorageBackend;
  credentials: StorageCredentials;
  region?: string;
  endpoint?: string;
  maxRetries?: number;
  timeout?: number;
  userAgent?: string;
  acceleration?: boolean;
  forcePathStyle?: boolean;
  useSSL?: boolean;
  httpOptions?: {
    proxy?: string;
    connectTimeout?: number;
    socketTimeout?: number;
    agent?: any;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

export type UploadResult = FileMetadata;
export type DownloadResult = {
  data: Buffer | Stream;
  metadata: FileMetadata;
};
export type CopyResult = FileMetadata;
export type MoveResult = { sourceDeleted: boolean; destination: FileMetadata };
export type DeleteResult = { deleted: boolean; versionId?: string };
export type BatchUploadResult = BatchResult<UploadResult>;
export type BatchDownloadResult = BatchResult<DownloadResult>;
export type BatchDeleteResult = BatchResult<DeleteResult>;
