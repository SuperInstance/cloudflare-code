/**
 * Base Storage Adapter Interface
 * Provides a unified interface for all storage backends
 */

import type {
  FileMetadata,
  FileUploadOptions,
  FileDownloadOptions,
  FileCopyOptions,
  FileMoveOptions,
  FileDeleteOptions,
  BatchOperationOptions,
  BatchResult,
  UploadResult,
  DownloadResult,
  CopyResult,
  MoveResult,
  DeleteResult,
  BatchUploadResult,
  BatchDownloadResult,
  BatchDeleteResult,
  ListOptions,
  ListResult,
  PresignedUrlOptions,
  BucketConfig,
  BucketMetadata,
  BucketPolicy,
  LifecycleRule,
  CORSConfig,
  StorageConfig,
  StorageResponse,
  StorageError,
  MultipartUpload,
  MultipartPart,
  MultipartUploadOptions,
  UploadProgress,
  TaggingOptions,
  ObjectLockConfig,
  ReplicationConfig,
  StorageBackend,
  Stream,
  Buffer,
} from '../types';

// ============================================================================
// Base Storage Adapter
// ============================================================================

export abstract class StorageAdapter {
  protected config: StorageConfig;
  protected retryCount: number = 0;

  constructor(config: StorageConfig) {
    this.config = config;
    this.validateConfig();
  }

  // ============================================================================
  // Abstract Methods - Must be implemented by concrete adapters
  // ============================================================================

  /**
   * Get the storage backend type
   */
  abstract getBackend(): StorageBackend;

  /**
   * Upload a file to storage
   */
  abstract uploadFile(
    bucket: string,
    key: string,
    data: Buffer | Stream | string,
    options?: FileUploadOptions
  ): Promise<UploadResult>;

  /**
   * Download a file from storage
   */
  abstract downloadFile(
    bucket: string,
    key: string,
    options?: FileDownloadOptions
  ): Promise<DownloadResult>;

  /**
   * Copy a file within storage
   */
  abstract copyFile(
    bucket: string,
    key: string,
    options: FileCopyOptions
  ): Promise<CopyResult>;

  /**
   * Move a file within storage
   */
  abstract moveFile(
    bucket: string,
    key: string,
    options: FileMoveOptions
  ): Promise<MoveResult>;

  /**
   * Delete a file from storage
   */
  abstract deleteFile(
    bucket: string,
    key: string,
    options?: FileDeleteOptions
  ): Promise<DeleteResult>;

  /**
   * Get file metadata
   */
  abstract getFileMetadata(
    bucket: string,
    key: string,
    versionId?: string
  ): Promise<FileMetadata>;

  /**
   * List files in a bucket
   */
  abstract listFiles(
    bucket: string,
    options?: ListOptions
  ): Promise<ListResult>;

  /**
   * Check if a file exists
   */
  abstract fileExists(
    bucket: string,
    key: string
  ): Promise<boolean>;

  /**
   * Generate a presigned URL
   */
  abstract generatePresignedUrl(
    bucket: string,
    key: string,
    options?: PresignedUrlOptions
  ): Promise<string>;

  // ============================================================================
  // Batch Operations - Default implementations provided
  // ============================================================================

  /**
   * Upload multiple files in batch
   */
  async batchUpload(
    bucket: string,
    files: Array<{ key: string; data: Buffer | Stream; options?: FileUploadOptions }>,
    batchOptions?: BatchOperationOptions
  ): Promise<BatchUploadResult> {
    return this.executeBatch(
      files.map(f => () => this.uploadFile(bucket, f.key, f.data, f.options)),
      files.map(f => f.key),
      batchOptions
    );
  }

  /**
   * Download multiple files in batch
   */
  async batchDownload(
    bucket: string,
    keys: string[],
    options?: FileDownloadOptions,
    batchOptions?: BatchOperationOptions
  ): Promise<BatchDownloadResult> {
    return this.executeBatch(
      keys.map(key => () => this.downloadFile(bucket, key, options)),
      keys,
      batchOptions
    );
  }

  /**
   * Delete multiple files in batch
   */
  async batchDelete(
    bucket: string,
    keys: string[],
    options?: FileDeleteOptions,
    batchOptions?: BatchOperationOptions
  ): Promise<BatchDeleteResult> {
    return this.executeBatch(
      keys.map(key => () => this.deleteFile(bucket, key, options)),
      keys,
      batchOptions
    );
  }

  /**
   * Execute batch operations with concurrency control
   */
  protected async executeBatch<T>(
    operations: Array<() => Promise<T>>,
    keys: string[],
    options?: BatchOperationOptions
  ): Promise<BatchResult<T>> {
    const concurrency = options?.concurrency ?? 10;
    const continueOnError = options?.continueOnError ?? true;

    const successful: Array<{ key: string; result: T }> = [];
    const failed: Array<{ key: string; error: Error }> = [];

    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      const batchKeys = keys.slice(i, i + concurrency);

      const results = await Promise.allSettled(
        batch.map(async (op, idx) => {
          if (options?.progressCallback) {
            options.progressCallback({
              total: operations.length,
              completed: successful.length + failed.length,
              failed: failed.length,
              current: batchKeys[idx],
            });
          }
          return op();
        })
      );

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          successful.push({ key: batchKeys[idx], result: result.value });
        } else {
          failed.push({ key: batchKeys[idx], error: result.reason });
          if (!continueOnError) {
            throw result.reason;
          }
        }
      });
    }

    return { successful, failed };
  }

  // ============================================================================
  // Multipart Upload Operations
  // ============================================================================

  /**
   * Create a multipart upload
   */
  abstract createMultipartUpload(
    bucket: string,
    key: string,
    options?: FileUploadOptions
  ): Promise<MultipartUpload>;

  /**
   * Upload a part in a multipart upload
   */
  abstract uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    data: Buffer | Stream
  ): Promise<MultipartPart>;

  /**
   * Complete a multipart upload
   */
  abstract completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: MultipartPart[]
  ): Promise<UploadResult>;

  /**
   * Abort a multipart upload
   */
  abstract abortMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string
  ): Promise<void>;

  /**
   * List multipart uploads
   */
  abstract listMultipartUploads(
    bucket: string,
    options?: ListOptions
  ): Promise<MultipartUpload[]>;

  /**
   * List parts in a multipart upload
   */
  abstract listParts(
    bucket: string,
    key: string,
    uploadId: string
  ): Promise<MultipartPart[]>;

  /**
   * Upload a large file using multipart upload
   */
  async uploadLargeFile(
    bucket: string,
    key: string,
    data: Buffer | Stream,
    options?: FileUploadOptions,
    multipartOptions?: MultipartUploadOptions
  ): Promise<UploadResult> {
    const chunkSize = multipartOptions?.chunkSize ?? 5 * 1024 * 1024; // 5MB default

    // Create multipart upload
    const upload = await this.createMultipartUpload(bucket, key, options);
    const parts: MultipartPart[] = [];
    let partNumber = 1;

    // Helper to process stream or buffer
    if (Buffer.isBuffer(data)) {
      // Handle buffer
      for (let offset = 0; offset < data.length; offset += chunkSize) {
        const chunk = data.subarray(offset, Math.min(offset + chunkSize, data.length));
        const part = await this.uploadPart(bucket, key, upload.uploadId, partNumber, chunk);
        parts.push(part);
        partNumber++;

        if (multipartOptions?.progressCallback) {
          multipartOptions.progressCallback({
            uploaded: offset + chunk.length,
            total: data.length,
            percentage: ((offset + chunk.length) / data.length) * 100,
          });
        }
      }
    } else {
      // Handle stream
      const chunks: Buffer[] = [];
      let currentChunk = Buffer.alloc(0);

      for await (const chunk of data) {
        currentChunk = Buffer.concat([currentChunk, chunk]);

        while (currentChunk.length >= chunkSize) {
          const part = currentChunk.subarray(0, chunkSize);
          const uploadedPart = await this.uploadPart(
            bucket,
            key,
            upload.uploadId,
            partNumber,
            part
          );
          parts.push(uploadedPart);
          partNumber++;
          currentChunk = currentChunk.subarray(chunkSize);
        }
      }

      // Upload remaining data
      if (currentChunk.length > 0) {
        const part = await this.uploadPart(bucket, key, upload.uploadId, partNumber, currentChunk);
        parts.push(part);
      }
    }

    // Complete multipart upload
    return this.completeMultipartUpload(bucket, key, upload.uploadId, parts);
  }

  // ============================================================================
  // Bucket Operations
  // ============================================================================

  /**
   * Create a new bucket
   */
  abstract createBucket(config: BucketConfig): Promise<void>;

  /**
   * Delete a bucket
   */
  abstract deleteBucket(bucket: string, force?: boolean): Promise<void>;

  /**
   * Get bucket metadata
   */
  abstract getBucket(bucket: string): Promise<BucketMetadata>;

  /**
   * List all buckets
   */
  abstract listBuckets(): Promise<BucketMetadata[]>;

  /**
   * Check if a bucket exists
   */
  abstract bucketExists(bucket: string): Promise<boolean>;

  /**
   * Update bucket configuration
   */
  abstract updateBucket(bucket: string, config: Partial<BucketConfig>): Promise<void>;

  /**
   * Empty a bucket (delete all objects)
   */
  async emptyBucket(bucket: string): Promise<void> {
    const objects = await this.listFiles(bucket);
    await this.batchDelete(
      bucket,
      objects.objects.map(obj => obj.key),
      undefined,
      { continueOnError: true, concurrency: 20 }
    );
  }

  // ============================================================================
  // Bucket Policy Operations
  // ============================================================================

  /**
   * Get bucket policy
   */
  abstract getBucketPolicy(bucket: string): Promise<BucketPolicy | null>;

  /**
   * Set bucket policy
   */
  abstract setBucketPolicy(bucket: string, policy: BucketPolicy): Promise<void>;

  /**
   * Delete bucket policy
   */
  abstract deleteBucketPolicy(bucket: string): Promise<void>;

  // ============================================================================
  // Lifecycle Configuration
  // ============================================================================

  /**
   * Get lifecycle configuration
   */
  abstract getLifecycleConfiguration(bucket: string): Promise<LifecycleRule[]>;

  /**
   * Set lifecycle configuration
   */
  abstract setLifecycleConfiguration(bucket: string, rules: LifecycleRule[]): Promise<void>;

  /**
   * Delete lifecycle configuration
   */
  abstract deleteLifecycleConfiguration(bucket: string): Promise<void>;

  // ============================================================================
  // CORS Configuration
  // ============================================================================

  /**
   * Get CORS configuration
   */
  abstract getCORSConfiguration(bucket: string): Promise<CORSConfig[]>;

  /**
   * Set CORS configuration
   */
  abstract setCORSConfiguration(bucket: string, config: CORSConfig[]): Promise<void>;

  /**
   * Delete CORS configuration
   */
  abstract deleteCORSConfiguration(bucket: string): Promise<void>;

  // ============================================================================
  // Tagging Operations
  // ============================================================================

  /**
   * Get object tags
   */
  abstract getObjectTags(bucket: string, key: string, versionId?: string): Promise<Record<string, string>>;

  /**
   * Set object tags
   */
  abstract setObjectTags(bucket: string, key: string, tags: Record<string, string>, versionId?: string): Promise<void>;

  /**
   * Delete object tags
   */
  abstract deleteObjectTags(bucket: string, key: string, versionId?: string): Promise<void>;

  // ============================================================================
  // Object Lock Operations
  // ============================================================================

  /**
   * Enable object lock on bucket
   */
  abstract enableObjectLock(bucket: string): Promise<void>;

  /**
   * Get object lock configuration
   */
  abstract getObjectLockConfiguration(bucket: string): Promise<ObjectLockConfig>;

  /**
   * Set object lock configuration
   */
  abstract setObjectLockConfiguration(bucket: string, config: ObjectLockConfig): Promise<void>;

  /**
   * Set legal hold on object
   */
  abstract setLegalHold(bucket: string, key: string, enabled: boolean, versionId?: string): Promise<void>;

  /**
   * Get legal hold on object
   */
  abstract getLegalHold(bucket: string, key: string, versionId?: string): Promise<boolean>;

  // ============================================================================
  // Replication Operations
  // ============================================================================

  /**
   * Get replication configuration
   */
  abstract getReplicationConfiguration(bucket: string): Promise<ReplicationConfig>;

  /**
   * Set replication configuration
   */
  abstract setReplicationConfiguration(bucket: string, config: ReplicationConfig): Promise<void>;

  /**
   * Delete replication configuration
   */
  abstract deleteReplicationConfiguration(bucket: string): Promise<void>;

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Validate configuration
   */
  protected validateConfig(): void {
    if (!this.config.backend) {
      throw new Error('Storage backend is required');
    }
    if (!this.config.credentials) {
      throw new Error('Storage credentials are required');
    }
  }

  /**
   * Create a storage error
   */
  protected createError(
    message: string,
    code: string,
    statusCode: number = 500,
    bucket?: string,
    key?: string
  ): StorageError {
    const error = new Error(message) as StorageError;
    error.code = code;
    error.statusCode = statusCode;
    error.bucket = bucket;
    error.key = key;
    error.retryable = this.isRetryable(statusCode);
    return error;
  }

  /**
   * Check if an error is retryable
   */
  protected isRetryable(statusCode: number): boolean {
    return statusCode >= 500 || statusCode === 429 || statusCode === 408;
  }

  /**
   * Execute with retry logic
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.config.maxRetries ?? 3
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const storageError = error as StorageError;

        if (!storageError.retryable || attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Convert stream to buffer
   */
  protected async streamToBuffer(stream: Stream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * Get content type from file extension
   */
  protected getContentType(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      txt: 'text/plain',
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      xml: 'application/xml',
      pdf: 'application/pdf',
      zip: 'application/zip',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      mp4: 'video/mp4',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
    };
    return contentTypes[ext || ''] || 'application/octet-stream';
  }

  /**
   * Sanitize key name
   */
  protected sanitizeKey(key: string): string {
    return key.replace(/\\/g, '/').replace(/\/+/g, '/');
  }

  /**
   * Get ETag hash
   */
  protected getETag(data: Buffer | string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5');
    hash.update(typeof data === 'string' ? data : data);
    return hash.digest('hex');
  }

  /**
   * Close and cleanup resources
   */
  abstract close(): Promise<void>;
}

// ============================================================================
// Storage Adapter Factory
// ============================================================================

export class StorageAdapterFactory {
  private static adapters: Map<StorageBackend, new (config: StorageConfig) => StorageAdapter> =
    new Map();

  /**
   * Register a storage adapter
   */
  static register(
    backend: StorageBackend,
    adapter: new (config: StorageConfig) => StorageAdapter
  ): void {
    this.adapters.set(backend, adapter);
  }

  /**
   * Create a storage adapter instance
   */
  static create(config: StorageConfig): StorageAdapter {
    const AdapterClass = this.adapters.get(config.backend);
    if (!AdapterClass) {
      throw new Error(`No adapter registered for backend: ${config.backend}`);
    }
    return new AdapterClass(config);
  }

  /**
   * Get registered backends
   */
  static getRegisteredBackends(): StorageBackend[] {
    return Array.from(this.adapters.keys());
  }
}
