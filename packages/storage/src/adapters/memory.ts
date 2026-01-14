/**
 * In-Memory Storage Adapter
 * For testing and development purposes
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
  MultipartUpload,
  MultipartPart,
} from '../types';

interface StoredFile {
  data: Buffer;
  metadata: FileMetadata;
}

interface MultipartData {
  uploadId: string;
  key: string;
  initiated: Date;
  parts: Map<number, Buffer>;
}

// ============================================================================
// Memory Storage Adapter
// ============================================================================

export class MemoryStorageAdapter extends StorageAdapter {
  private buckets: Map<string, Map<string, StoredFile>> = new Map();
  private bucketConfigs: Map<string, BucketConfig> = new Map();
  private multipartUploads: Map<string, MultipartData> = new Map();

  constructor(config: StorageConfig) {
    super(config);
    StorageAdapterFactory.register('memory', MemoryStorageAdapter);
  }

  getBackend(): StorageBackend {
    return 'memory';
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getBucket(bucket: string): Map<string, StoredFile> {
    if (!this.buckets.has(bucket)) {
      this.buckets.set(bucket, new Map());
    }
    return this.buckets.get(bucket)!;
  }

  private ensureBucket(bucket: string): void {
    if (!this.buckets.has(bucket)) {
      this.buckets.set(bucket, new Map());
    }
  }

  private getFile(bucket: string, key: string): StoredFile | undefined {
    const bucketMap = this.buckets.get(bucket);
    return bucketMap?.get(key);
  }

  private setFile(bucket: string, key: string, file: StoredFile): void {
    const bucketMap = this.getBucket(bucket);
    bucketMap.set(key, file);
  }

  private deleteFile(bucket: string, key: string): boolean {
    const bucketMap = this.buckets.get(bucket);
    return bucketMap?.delete(key) ?? false;
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  async uploadFile(
    bucket: string,
    key: string,
    data: Buffer | NodeJS.ReadableStream | string,
    options?: FileUploadOptions
  ): Promise<FileMetadata> {
    return this.executeWithRetry(async () => {
      this.ensureBucket(bucket);

      const sanitizedKey = this.sanitizeKey(key);

      let buffer: Buffer;
      if (Buffer.isBuffer(data)) {
        buffer = data;
      } else if (typeof data === 'string') {
        buffer = Buffer.from(data);
      } else {
        // Stream - collect all data
        const chunks: Buffer[] = [];
        for await (const chunk of data) {
          chunks.push(chunk);
        }
        buffer = Buffer.concat(chunks);
      }

      const metadata: FileMetadata = {
        key: sanitizedKey,
        bucket,
        size: buffer.length,
        contentType: options?.contentType ?? this.getContentType(sanitizedKey),
        etag: this.getETag(buffer),
        lastModified: new Date(),
        customMetadata: options?.metadata,
        tags: options?.tags,
        storageClass: options?.storageClass ?? 'STANDARD',
      };

      this.setFile(bucket, sanitizedKey, { data: buffer, metadata });

      return metadata;
    });
  }

  async downloadFile(
    bucket: string,
    key: string,
    options?: FileDownloadOptions
  ): Promise<{ data: Buffer; metadata: FileMetadata }> {
    return this.executeWithRetry(async () => {
      const sanitizedKey = this.sanitizeKey(key);
      const file = this.getFile(bucket, sanitizedKey);

      if (!file) {
        throw this.createError(`File not found: ${key}`, 'NoSuchKey', 404, bucket, key);
      }

      let data = file.data;
      if (options?.range) {
        data = data.subarray(options.range.start, options.range.end);
      }

      return {
        data,
        metadata: file.metadata,
      };
    });
  }

  async copyFile(
    bucket: string,
    key: string,
    options: FileCopyOptions
  ): Promise<FileMetadata> {
    const source = await this.downloadFile(bucket, key);
    const destinationBucket = options.destinationBucket ?? bucket;

    return this.uploadFile(destinationBucket, options.destinationKey, source.data, {
      contentType: source.metadata.contentType,
      metadata: options?.metadata ?? source.metadata.customMetadata,
      tags: options?.tags ?? source.metadata.tags,
      storageClass: options?.storageClass ?? source.metadata.storageClass,
    });
  }

  async moveFile(
    bucket: string,
    key: string,
    options: FileMoveOptions
  ): Promise<{ sourceDeleted: boolean; destination: FileMetadata }> {
    const destination = await this.copyFile(bucket, key, options);
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
      const sanitizedKey = this.sanitizeKey(key);
      const deleted = this.deleteFile(bucket, sanitizedKey);
      return { deleted };
    });
  }

  async getFileMetadata(
    bucket: string,
    key: string,
    versionId?: string
  ): Promise<FileMetadata> {
    const sanitizedKey = this.sanitizeKey(key);
    const file = this.getFile(bucket, sanitizedKey);

    if (!file) {
      throw this.createError(`File not found: ${key}`, 'NoSuchKey', 404, bucket, key);
    }

    return file.metadata;
  }

  async listFiles(bucket: string, options?: ListOptions): Promise<ListResult> {
    return this.executeWithRetry(async () => {
      const bucketMap = this.buckets.get(bucket);
      if (!bucketMap) {
        return {
          objects: [],
          commonPrefixes: [],
          isTruncated: false,
          count: 0,
          maxKeys: options?.maxKeys ?? 1000,
          prefix: options?.prefix,
          delimiter: options?.delimiter,
        };
      }

      const prefix = options?.prefix ?? '';
      const delimiter = options?.delimiter;
      const maxKeys = options?.maxKeys ?? 1000;

      const objects: FileMetadata[] = [];
      const commonPrefixes: Set<string> = new Set();

      let count = 0;
      for (const [key, file] of bucketMap.entries()) {
        if (count >= maxKeys) break;
        if (!key.startsWith(prefix)) continue;

        if (delimiter) {
          const relativeKey = key.slice(prefix.length);
          const delimiterIndex = relativeKey.indexOf(delimiter);

          if (delimiterIndex >= 0) {
            const commonPrefix = prefix + relativeKey.slice(0, delimiterIndex + 1);
            commonPrefixes.add(commonPrefix);
            continue;
          }
        }

        objects.push(file.metadata);
        count++;
      }

      return {
        objects,
        commonPrefixes: Array.from(commonPrefixes),
        isTruncated: count >= maxKeys,
        count: objects.length,
        maxKeys,
        prefix,
        delimiter,
      };
    });
  }

  async fileExists(bucket: string, key: string): Promise<boolean> {
    const sanitizedKey = this.sanitizeKey(key);
    return this.getFile(bucket, sanitizedKey) !== undefined;
  }

  async generatePresignedUrl(
    bucket: string,
    key: string,
    options?: PresignedUrlOptions
  ): Promise<string> {
    const expiresIn = options?.expiresIn ?? 3600;
    const expires = Date.now() + expiresIn * 1000;
    return `memory://${bucket}/${key}?expires=${expires}`;
  }

  // ============================================================================
  // Multipart Upload
  // ============================================================================

  async createMultipartUpload(
    bucket: string,
    key: string,
    options?: FileUploadOptions
  ): Promise<MultipartUpload> {
    const uploadId = `mpu-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.multipartUploads.set(uploadId, {
      uploadId,
      key,
      initiated: new Date(),
      parts: new Map(),
    });

    return {
      uploadId,
      key,
      bucket,
      initiated: new Date(),
      storageClass: options?.storageClass,
    };
  }

  async uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    data: Buffer | NodeJS.ReadableStream
  ): Promise<MultipartPart> {
    const upload = this.multipartUploads.get(uploadId);
    if (!upload) {
      throw this.createError(`Upload not found: ${uploadId}`, 'NoSuchUpload', 404);
    }

    let buffer: Buffer;
    if (Buffer.isBuffer(data)) {
      buffer = data;
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of data) {
        chunks.push(chunk);
      }
      buffer = Buffer.concat(chunks);
    }

    upload.parts.set(partNumber, buffer);

    return {
      partNumber,
      etag: this.getETag(buffer),
      size: buffer.length,
    };
  }

  async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: MultipartPart[]
  ): Promise<FileMetadata> {
    const upload = this.multipartUploads.get(uploadId);
    if (!upload) {
      throw this.createError(`Upload not found: ${uploadId}`, 'NoSuchUpload', 404);
    }

    // Combine all parts
    const buffers: Buffer[] = [];
    for (const part of parts.sort((a, b) => a.partNumber - b.partNumber)) {
      const partData = upload.parts.get(part.partNumber);
      if (partData) {
        buffers.push(partData);
      }
    }

    const combinedBuffer = Buffer.concat(buffers);

    // Upload the combined file
    const metadata = await this.uploadFile(bucket, key, combinedBuffer);

    // Clean up multipart upload
    this.multipartUploads.delete(uploadId);

    return metadata;
  }

  async abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void> {
    this.multipartUploads.delete(uploadId);
  }

  async listMultipartUploads(bucket: string, options?: ListOptions): Promise<MultipartUpload[]> {
    const uploads: MultipartUpload[] = [];

    for (const upload of this.multipartUploads.values()) {
      uploads.push({
        uploadId: upload.uploadId,
        key: upload.key,
        bucket,
        initiated: upload.initiated,
      });
    }

    return uploads;
  }

  async listParts(bucket: string, key: string, uploadId: string): Promise<MultipartPart[]> {
    const upload = this.multipartUploads.get(uploadId);
    if (!upload) {
      throw this.createError(`Upload not found: ${uploadId}`, 'NoSuchUpload', 404);
    }

    const parts: MultipartPart[] = [];
    for (const [partNumber, data] of upload.parts.entries()) {
      parts.push({
        partNumber,
        etag: this.getETag(data),
        size: data.length,
      });
    }

    return parts.sort((a, b) => a.partNumber - b.partNumber);
  }

  // ============================================================================
  // Bucket Operations
  // ============================================================================

  async createBucket(config: BucketConfig): Promise<void> {
    this.ensureBucket(config.name);
    this.bucketConfigs.set(config.name, config);
  }

  async deleteBucket(bucket: string, force?: boolean): Promise<void> {
    if (force) {
      await this.emptyBucket(bucket);
    }
    this.buckets.delete(bucket);
    this.bucketConfigs.delete(bucket);
  }

  async getBucket(bucket: string): Promise<BucketMetadata> {
    const bucketMap = this.buckets.get(bucket);
    if (!bucketMap) {
      throw this.createError(`Bucket not found: ${bucket}`, 'NoSuchBucket', 404);
    }

    const objects = Array.from(bucketMap.values());
    const totalSize = objects.reduce((sum, file) => sum + file.metadata.size, 0);

    return {
      name: bucket,
      createdAt: new Date(),
      location: 'memory',
      locationType: 'memory',
      storageClass: 'STANDARD',
      versioning: 'Disabled',
      encryption: {
        type: 'none',
        algorithm: 'none',
        encrypted: false,
      },
      size: totalSize,
      objectCount: objects.length,
    };
  }

  async listBuckets(): Promise<BucketMetadata[]> {
    const buckets: BucketMetadata[] = [];

    for (const bucketName of this.buckets.keys()) {
      try {
        const metadata = await this.getBucket(bucketName);
        buckets.push(metadata);
      } catch {
        // Skip invalid buckets
      }
    }

    return buckets;
  }

  async bucketExists(bucket: string): Promise<boolean> {
    return this.buckets.has(bucket);
  }

  async updateBucket(bucket: string, config: Partial<BucketConfig>): Promise<void> {
    const existing = this.bucketConfigs.get(bucket);
    if (existing) {
      this.bucketConfigs.set(bucket, { ...existing, ...config });
    }
  }

  // ============================================================================
  // Placeholder implementations
  // ============================================================================

  async getBucketPolicy(bucket: string): Promise<BucketPolicy | null> {
    return null;
  }

  async setBucketPolicy(bucket: string, policy: BucketPolicy): Promise<void> {
    throw this.createError('Bucket policies not supported', 'NotImplemented', 501);
  }

  async deleteBucketPolicy(bucket: string): Promise<void> {
    // No-op
  }

  async getLifecycleConfiguration(bucket: string): Promise<LifecycleRule[]> {
    return [];
  }

  async setLifecycleConfiguration(bucket: string, rules: LifecycleRule[]): Promise<void> {
    // No-op
  }

  async deleteLifecycleConfiguration(bucket: string): Promise<void> {
    // No-op
  }

  async getCORSConfiguration(bucket: string): Promise<CORSConfig[]> {
    return [];
  }

  async setCORSConfiguration(bucket: string, config: CORSConfig[]): Promise<void> {
    // No-op
  }

  async deleteCORSConfiguration(bucket: string): Promise<void> {
    // No-op
  }

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
    const file = this.getFile(bucket, key);
    if (file) {
      file.metadata.tags = tags;
    }
  }

  async deleteObjectTags(bucket: string, key: string, versionId?: string): Promise<void> {
    const file = this.getFile(bucket, key);
    if (file) {
      delete file.metadata.tags;
    }
  }

  async enableObjectLock(bucket: string): Promise<void> {
    throw this.createError('Object lock not supported', 'NotImplemented', 501);
  }

  async getObjectLockConfiguration(bucket: string): Promise<any> {
    return { enabled: false };
  }

  async setObjectLockConfiguration(bucket: string, config: any): Promise<void> {
    throw this.createError('Object lock not supported', 'NotImplemented', 501);
  }

  async setLegalHold(bucket: string, key: string, enabled: boolean, versionId?: string): Promise<void> {
    throw this.createError('Legal hold not supported', 'NotImplemented', 501);
  }

  async getLegalHold(bucket: string, key: string, versionId?: string): Promise<boolean> {
    return false;
  }

  async getReplicationConfiguration(bucket: string): Promise<any> {
    return { enabled: false, destination: { bucket: '' }, rules: [] };
  }

  async setReplicationConfiguration(bucket: string, config: any): Promise<void> {
    throw this.createError('Replication not supported', 'NotImplemented', 501);
  }

  async deleteReplicationConfiguration(bucket: string): Promise<void> {
    // No-op
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async close(): Promise<void> {
    this.buckets.clear();
    this.bucketConfigs.clear();
    this.multipartUploads.clear();
  }

  // ============================================================================
  // Utility methods for testing
  // ============================================================================

  /**
   * Clear all data (useful for testing)
   */
  clear(): void {
    this.buckets.clear();
    this.bucketConfigs.clear();
    this.multipartUploads.clear();
  }

  /**
   * Get total size of all stored data
   */
  getTotalSize(): number {
    let total = 0;
    for (const bucketMap of this.buckets.values()) {
      for (const file of bucketMap.values()) {
        total += file.data.length;
      }
    }
    return total;
  }

  /**
   * Get total count of all stored files
   */
  getTotalFileCount(): number {
    let count = 0;
    for (const bucketMap of this.buckets.values()) {
      count += bucketMap.size;
    }
    return count;
  }
}
