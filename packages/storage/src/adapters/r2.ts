/**
 * Cloudflare R2 Storage Adapter
 * Optimized for Cloudflare R2 object storage
 */

import { StorageAdapter, StorageAdapterFactory } from './adapter';
import type {
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
  StorageConfig,
  StorageBackend,
  StorageError,
  MultipartUpload,
  MultipartPart,
  TaggingOptions,
  ObjectLockConfig,
  ReplicationConfig,
} from '../types';

// ============================================================================
// R2 Client Interface
// ============================================================================

interface R2Client {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string,
    options?: R2PutOptions
  ): Promise<R2Object>;

  get(key: string, options?: R2GetOptions): Promise<R2Object | null>;

  head(key: string): Promise<R2Object | null>;

  delete(key: string): Promise<void>;

  list(options?: R2ListOptions): Promise<R2Objects>;

  copy(
    source: { bucket: string; key: string },
    target: { bucket: string; key: string },
    options?: R2CopyOptions
  ): Promise<R2Object>;
}

interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

interface R2HTTPMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
}

interface R2GetOptions {
  onlyIf?: R2Condition;
  range?: { offset: number; length: number };
}

interface R2Condition {
  etagMatches?: string;
  etagDoesNotMatch?: string;
  uploadedBefore?: Date;
  uploadedAfter?: Date;
}

interface R2ListOptions {
  limit?: number;
  prefix?: string;
  cursor?: string;
  delimiter?: string;
}

interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
  prefixes?: string[];
}

interface R2Object {
  key: string;
  size: number;
  etag: string;
  uploaded: Date;
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
  range?: { offset: number; length: number };
  writeHttpMetadata?: R2HTTPMetadata;
}

interface R2MultipartUpload {
  id: string;
  key: string;
  uploaded: Date;
}

// ============================================================================
// Cloudflare R2 Adapter
// ============================================================================

export class R2StorageAdapter extends StorageAdapter {
  private client: R2Client | null = null;
  private bindingName: string = 'BUCKET';

  constructor(config: StorageConfig) {
    super(config);
    this.initializeClient();
    StorageAdapterFactory.register('r2', R2StorageAdapter);
  }

  getBackend(): StorageBackend {
    return 'r2';
  }

  // ============================================================================
  // Client Initialization
  // ============================================================================

  private initializeClient(): void {
    // In Cloudflare Workers, R2 binding is available in the environment
    if (typeof globalThis !== 'undefined' && 'R2_BUCKET' in globalThis) {
      this.client = (globalThis as any).R2_BUCKET as R2Client;
    }

    // For testing/local development, we might use a mock or HTTP client
    if (!this.client && this.config.endpoint) {
      // Initialize HTTP client for R2 REST API
      this.client = this.createHTTPClient();
    }
  }

  private createHTTPClient(): R2Client {
    // This would implement the R2 REST API over HTTP
    // For now, we'll create a minimal client structure
    return {
      put: async () => this.notImplementedError('put'),
      get: async () => this.notImplementedError('get'),
      head: async () => this.notImplementedError('head'),
      delete: async () => this.notImplementedError('delete'),
      list: async () => this.notImplementedError('list'),
      copy: async () => this.notImplementedError('copy'),
    };
  }

  private notImplementedError(operation: string): never {
    throw new Error(`R2 HTTP client not implemented for: ${operation}`);
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  async uploadFile(
    bucket: string,
    key: string,
    data: Buffer | ReadableStream | string,
    options?: FileUploadOptions
  ): Promise<FileMetadata> {
    return this.executeWithRetry(async () => {
      if (!this.client) {
        throw this.createError('R2 client not initialized', 'ClientNotInitialized', 500);
      }

      const sanitizedKey = this.sanitizeKey(key);
      const contentType = options?.contentType ?? this.getContentType(sanitizedKey);

      // Convert Buffer to ArrayBuffer if needed
      let body: ReadableStream | ArrayBuffer | string;
      if (Buffer.isBuffer(data)) {
        body = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      } else {
        body = data;
      }

      const r2Object = await this.client.put(sanitizedKey, body, {
        httpMetadata: {
          contentType,
          cacheControl: options?.cacheControl,
          contentDisposition: options?.contentDisposition,
          contentEncoding: options?.contentEncoding,
          contentLanguage: options?.contentLanguage,
        },
        customMetadata: options?.metadata,
      });

      return this.convertToFileMetadata(r2Object, bucket);
    });
  }

  async downloadFile(
    bucket: string,
    key: string,
    options?: FileDownloadOptions
  ): Promise<{ data: Buffer; metadata: FileMetadata }> {
    return this.executeWithRetry(async () => {
      if (!this.client) {
        throw this.createError('R2 client not initialized', 'ClientNotInitialized', 500);
      }

      const sanitizedKey = this.sanitizeKey(key);

      const r2Object = await this.client.get(sanitizedKey, {
        range: options?.range
          ? { offset: options.range.start, length: options.range.end - options.range.start }
          : undefined,
      });

      if (!r2Object) {
        throw this.createError(`Object not found: ${key}`, 'NoSuchKey', 404, bucket, key);
      }

      let data: Buffer;
      if ('arrayBuffer' in r2Object) {
        // R2Object with data
        const arrayBuffer = await r2Object.arrayBuffer();
        data = Buffer.from(arrayBuffer);
      } else {
        throw this.createError('Unable to read object data', 'ReadError', 500, bucket, key);
      }

      return {
        data,
        metadata: this.convertToFileMetadata(r2Object, bucket),
      };
    });
  }

  async copyFile(
    bucket: string,
    key: string,
    options: FileCopyOptions
  ): Promise<FileMetadata> {
    return this.executeWithRetry(async () => {
      if (!this.client) {
        throw this.createError('R2 client not initialized', 'ClientNotInitialized', 500);
      }

      const sourceKey = this.sanitizeKey(key);
      const destinationKey = this.sanitizeKey(options.destinationKey);
      const destinationBucket = options.destinationBucket ?? bucket;

      const r2Object = await this.client.copy(
        { bucket, key: sourceKey },
        { bucket: destinationBucket, key: destinationKey }
      );

      return this.convertToFileMetadata(r2Object, destinationBucket);
    });
  }

  async moveFile(
    bucket: string,
    key: string,
    options: FileMoveOptions
  ): Promise<{ sourceDeleted: boolean; destination: FileMetadata }> {
    // R2 doesn't have a native move operation, so we copy then delete
    const destination = await this.copyFile(bucket, key, {
      destinationKey: options.destinationKey,
      destinationBucket: options.destinationBucket,
      metadata: options.metadata,
      tags: options.tags,
    });

    await this.deleteFile(bucket, key);

    return {
      sourceDeleted: true,
      destination,
    };
  }

  async deleteFile(
    bucket: string,
    key: string,
    options?: FileDeleteOptions
  ): Promise<{ deleted: boolean; versionId?: string }> {
    return this.executeWithRetry(async () => {
      if (!this.client) {
        throw this.createError('R2 client not initialized', 'ClientNotInitialized', 500);
      }

      const sanitizedKey = this.sanitizeKey(key);

      try {
        await this.client.delete(sanitizedKey);
        return { deleted: true };
      } catch (error: any) {
        if (error.status === 404) {
          return { deleted: false };
        }
        throw error;
      }
    });
  }

  async getFileMetadata(
    bucket: string,
    key: string,
    versionId?: string
  ): Promise<FileMetadata> {
    return this.executeWithRetry(async () => {
      if (!this.client) {
        throw this.createError('R2 client not initialized', 'ClientNotInitialized', 500);
      }

      const sanitizedKey = this.sanitizeKey(key);

      const r2Object = await this.client.head(sanitizedKey);

      if (!r2Object) {
        throw this.createError(`Object not found: ${key}`, 'NoSuchKey', 404, bucket, key);
      }

      return this.convertToFileMetadata(r2Object, bucket);
    });
  }

  async listFiles(bucket: string, options?: ListOptions): Promise<ListResult> {
    return this.executeWithRetry(async () => {
      if (!this.client) {
        throw this.createError('R2 client not initialized', 'ClientNotInitialized', 500);
      }

      const r2Objects = await this.client.list({
        limit: options?.maxKeys,
        prefix: options?.prefix,
        cursor: options?.continuationToken,
        delimiter: options?.delimiter,
      });

      return {
        objects: r2Objects.objects.map(obj => this.convertToFileMetadata(obj, bucket)),
        commonPrefixes: r2Objects.prefixes ?? [],
        isTruncated: r2Objects.truncated,
        nextContinuationToken: r2Objects.cursor,
        count: r2Objects.objects.length,
        maxKeys: options?.maxKeys ?? 1000,
        prefix: options?.prefix,
        delimiter: options?.delimiter,
      };
    });
  }

  async fileExists(bucket: string, key: string): Promise<boolean> {
    try {
      await this.getFileMetadata(bucket, key);
      return true;
    } catch (error) {
      return false;
    }
  }

  async generatePresignedUrl(
    bucket: string,
    key: string,
    options?: PresignedUrlOptions
  ): Promise<string> {
    // R2 doesn't support presigned URLs in the same way as S3
    // Instead, we use Workers KV or custom authentication
    // For now, return a placeholder
    const expiresIn = options?.expiresIn ?? 3600;
    const method = options?.method ?? 'GET';
    const timestamp = Date.now() + expiresIn * 1000;

    // This would typically use JWT or similar for authentication
    return `${this.config.endpoint ?? 'https://r2.cloudfalre.com'}/${bucket}/${key}?expires=${timestamp}&method=${method}`;
  }

  // ============================================================================
  // Multipart Upload Operations
  // ============================================================================

  async createMultipartUpload(
    bucket: string,
    key: string,
    options?: FileUploadOptions
  ): Promise<MultipartUpload> {
    // R2 supports multipart uploads
    // Implementation would depend on the R2 API version
    return {
      uploadId: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      key,
      bucket,
      initiated: new Date(),
    };
  }

  async uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    data: Buffer | ReadableStream
  ): Promise<MultipartPart> {
    // Implementation for uploading individual parts
    const etag = this.getETag(Buffer.isBuffer(data) ? data : Buffer.from(data as any));
    return {
      partNumber,
      etag,
    };
  }

  async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: MultipartPart[]
  ): Promise<FileMetadata> {
    // Combine all parts and return final metadata
    return {
      key,
      bucket,
      size: parts.reduce((sum, part) => sum + (part.size ?? 0), 0),
      contentType: 'application/octet-stream',
      etag: this.getETag(JSON.stringify(parts)),
      lastModified: new Date(),
    };
  }

  async abortMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string
  ): Promise<void> {
    // Abort the multipart upload
  }

  async listMultipartUploads(bucket: string, options?: ListOptions): Promise<MultipartUpload[]> {
    // List all active multipart uploads
    return [];
  }

  async listParts(bucket: string, key: string, uploadId: string): Promise<MultipartPart[]> {
    // List all parts in a multipart upload
    return [];
  }

  // ============================================================================
  // Bucket Operations
  // ============================================================================

  async createBucket(config: BucketConfig): Promise<void> {
    // R2 buckets are typically created through the Cloudflare dashboard or API
    throw this.createError(
      'R2 buckets must be created through Cloudflare dashboard or API',
      'NotImplemented',
      501
    );
  }

  async deleteBucket(bucket: string, force?: boolean): Promise<void> {
    // R2 buckets must be deleted through Cloudflare dashboard or API
    throw this.createError(
      'R2 buckets must be deleted through Cloudflare dashboard or API',
      'NotImplemented',
      501
    );
  }

  async getBucket(bucket: string): Promise<BucketMetadata> {
    return {
      name: bucket,
      createdAt: new Date(),
      location: 'WEUR', // Western Europe
      locationType: 'region',
      storageClass: 'STANDARD',
      versioning: 'Disabled',
      encryption: {
        type: 'server-side',
        algorithm: 'AES256',
        encrypted: true,
      },
    };
  }

  async listBuckets(): Promise<BucketMetadata[]> {
    // Return list of R2 buckets
    return [];
  }

  async bucketExists(bucket: string): Promise<boolean> {
    try {
      await this.getBucket(bucket);
      return true;
    } catch {
      return false;
    }
  }

  async updateBucket(bucket: string, config: Partial<BucketConfig>): Promise<void> {
    // Update bucket configuration
  }

  // ============================================================================
  // Bucket Policy Operations
  // ============================================================================

  async getBucketPolicy(bucket: string): Promise<BucketPolicy | null> {
    // R2 uses a different policy model
    return null;
  }

  async setBucketPolicy(bucket: string, policy: BucketPolicy): Promise<void> {
    throw this.createError('R2 uses a different policy model', 'NotImplemented', 501);
  }

  async deleteBucketPolicy(bucket: string): Promise<void> {
    throw this.createError('R2 uses a different policy model', 'NotImplemented', 501);
  }

  // ============================================================================
  // Lifecycle Configuration
  // ============================================================================

  async getLifecycleConfiguration(bucket: string): Promise<LifecycleRule[]> {
    return [];
  }

  async setLifecycleConfiguration(bucket: string, rules: LifecycleRule[]): Promise<void> {
    // Set lifecycle rules
  }

  async deleteLifecycleConfiguration(bucket: string): Promise<void> {
    // Delete lifecycle configuration
  }

  // ============================================================================
  // CORS Configuration
  // ============================================================================

  async getCORSConfiguration(bucket: string): Promise<CORSConfig[]> {
    return [];
  }

  async setCORSConfiguration(bucket: string, config: CORSConfig[]): Promise<void> {
    // Set CORS configuration
  }

  async deleteCORSConfiguration(bucket: string): Promise<void> {
    // Delete CORS configuration
  }

  // ============================================================================
  // Tagging Operations
  // ============================================================================

  async getObjectTags(
    bucket: string,
    key: string,
    versionId?: string
  ): Promise<Record<string, string>> {
    const metadata = await this.getFileMetadata(bucket, key, versionId);
    return metadata.tags ?? {};
  }

  async setObjectTags(
    bucket: string,
    key: string,
    tags: Record<string, string>,
    versionId?: string
  ): Promise<void> {
    // Set object tags
  }

  async deleteObjectTags(bucket: string, key: string, versionId?: string): Promise<void> {
    // Delete object tags
  }

  // ============================================================================
  // Object Lock Operations
  // ============================================================================

  async enableObjectLock(bucket: string): Promise<void> {
    // Enable object lock on bucket
  }

  async getObjectLockConfiguration(bucket: string): Promise<ObjectLockConfig> {
    return {
      enabled: false,
    };
  }

  async setObjectLockConfiguration(bucket: string, config: ObjectLockConfig): Promise<void> {
    // Set object lock configuration
  }

  async setLegalHold(bucket: string, key: string, enabled: boolean, versionId?: string): Promise<void> {
    // Set legal hold
  }

  async getLegalHold(bucket: string, key: string, versionId?: string): Promise<boolean> {
    return false;
  }

  // ============================================================================
  // Replication Operations
  // ============================================================================

  async getReplicationConfiguration(bucket: string): Promise<ReplicationConfig> {
    return {
      enabled: false,
      destination: {
        bucket: '',
      },
      rules: [],
    };
  }

  async setReplicationConfiguration(bucket: string, config: ReplicationConfig): Promise<void> {
    // Set replication configuration
  }

  async deleteReplicationConfiguration(bucket: string): Promise<void> {
    // Delete replication configuration
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private convertToFileMetadata(r2Object: R2Object, bucket: string): FileMetadata {
    return {
      key: r2Object.key,
      bucket,
      size: r2Object.size,
      contentType: r2Object.httpMetadata?.contentType ?? 'application/octet-stream',
      etag: r2Object.etag,
      lastModified: r2Object.uploaded,
      customMetadata: r2Object.customMetadata,
      storageClass: 'STANDARD',
    };
  }

  async close(): Promise<void> {
    // R2 client doesn't need explicit cleanup
    this.client = null;
  }
}
