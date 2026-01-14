/**
 * ClaudeFlare Storage Package
 * A comprehensive storage abstraction layer for multi-cloud file management
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Adapters
// ============================================================================

export {
  StorageAdapter,
  StorageAdapterFactory,
  R2StorageAdapter,
  S3StorageAdapter,
  LocalStorageAdapter,
  MemoryStorageAdapter,
} from './adapters';

export type {
  StorageConfig,
  StorageBackend,
  FileMetadata,
  FileUploadOptions,
  FileDownloadOptions,
  FileCopyOptions,
  FileMoveOptions,
  FileDeleteOptions,
  ListOptions,
  ListResult,
  PresignedUrlOptions,
  BucketConfig,
  BucketMetadata,
  BucketPolicy,
  LifecycleRule,
  CORSConfig,
  MultipartUpload,
  MultipartPart,
  MultipartUploadOptions,
  UploadProgress,
  TaggingOptions,
  ObjectLockConfig,
  ReplicationConfig,
} from './adapters';

// ============================================================================
// File Manager
// ============================================================================

export { FileManager } from './files';
export type {
  FileSearchOptions,
  FileOperationsSummary,
  FileValidationOptions,
  FileTransformOptions,
} from './files';

// ============================================================================
// Bucket Manager
// ============================================================================

export { BucketManager } from './buckets';
export type {
  BucketAnalytics,
  BucketComparison,
  BucketReplicationStatus,
} from './buckets';

// ============================================================================
// CDN Integration
// ============================================================================

export { CDNIntegration } from './cdn';
export type {
  CDNStatistics,
  CachePerformance,
  CustomDomainConfig,
  DNSRecord,
} from './cdn';

// ============================================================================
// Versioning Manager
// ============================================================================

export { VersioningManager } from './versioning';
export type {
  VersionHistory,
  VersionComparison,
  VersionRestoreOptions,
  VersionRetentionPolicy,
} from './versioning';

// ============================================================================
// Encryption Manager
// ============================================================================

export { EncryptionManager } from './encryption';
export type {
  KeyInfo,
  KeyGenerationOptions,
  EncryptionResult,
  DecryptionResult,
} from './encryption';

// ============================================================================
// Analytics Manager
// ============================================================================

export { StorageAnalyticsManager } from './analytics';
export type {
  RealTimeAnalytics,
  CapacityPlanning,
  CostOptimization,
  CostOptimizationRecommendation,
  AccessPattern,
} from './analytics';

// ============================================================================
// Types
// ============================================================================

export type {
  StorageBackend as Backend,
  FileMetadata as Metadata,
  EncryptionType,
  EncryptionAlgorithm,
  EncryptionOptions,
  EncryptionInfo,
  VersioningStatus,
  VersioningConfig,
  TagSet,
  TaggingOptions,
  ObjectLockConfig,
  LegalHold,
  ReplicationConfig,
  ReplicationDestination,
  ReplicationRule,
  StorageEvent,
  StorageEventType,
  StorageResponse,
  ResponseMetadata,
  StorageError,
  BatchOperationOptions,
  BatchProgress,
  BatchResult,
  UploadResult,
  DownloadResult,
  CopyResult,
  MoveResult,
  DeleteResult,
  BatchUploadResult,
  BatchDownloadResult,
  BatchDeleteResult,
  Preconditions,
  LoggingConfig,
  WebsiteConfig,
  RoutingRule,
  RoutingRuleCondition,
  RoutingRuleRedirect,
  PolicyGrant,
  Grantee,
  PublicAccessConfig,
  Transition,
  Expiration,
  NoncurrentVersionTransition,
  NoncurrentVersionExpiration,
  AbortIncompleteMultipartUpload,
  LifecycleFilter,
  LifecycleFilterAnd,
  FileVersion,
  VersionDiff,
  VersionChange,
  VersionRetentionConfig,
  StorageMetrics,
  MetricsPeriod,
  StorageMetricsData,
  RequestMetricsData,
  TransferMetricsData,
  ErrorMetricsData,
  UsageReport,
  UsageSummary,
  TopObjectSummary,
  UserSummary,
  CostAnalysis,
  PerformanceMetrics,
  LatencyMetrics,
  ThroughputMetrics,
  AvailabilityMetrics,
  IncidentSummary,
  StreamOptions,
  UploadStreamOptions,
  CDNProvider,
  CDNConfig,
  SSLConfig,
  CacheRule,
  CacheKeyConfig,
  OriginConfig,
  CacheInvalidationOptions,
  CacheInvalidationResult,
  PolicyStatement,
  Principal,
} from './types';

// ============================================================================
// Utilities
// ============================================================================

export * from './utils';

// ============================================================================
// Default Exports
// ============================================================================

export { StorageAdapterFactory as default } from './adapters';
