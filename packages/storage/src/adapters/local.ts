/**
 * Local Filesystem Storage Adapter
 * For development and testing purposes
 */

import { promises as fs } from 'fs';
import * as path from 'path';
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

// ============================================================================
// Local Storage Adapter
// ============================================================================

export class LocalStorageAdapter extends StorageAdapter {
  private baseDir: string;
  private metadataCache: Map<string, any> = new Map();

  constructor(config: StorageConfig) {
    super(config);
    this.baseDir = this.config.credentials.credentials.baseDir ?? '/tmp/storage';
    this.ensureBaseDir();
    StorageAdapterFactory.register('local', LocalStorageAdapter);
  }

  getBackend(): StorageBackend {
    return 'local';
  }

  // ============================================================================
  // Directory Management
  // ============================================================================

  private async ensureBaseDir(): Promise<void> {
    try {
      await fs.access(this.baseDir);
    } catch {
      await fs.mkdir(this.baseDir, { recursive: true });
    }
  }

  private getBucketPath(bucket: string): string {
    return path.join(this.baseDir, bucket);
  }

  private getFilePath(bucket: string, key: string): string {
    return path.join(this.getBucketPath(bucket), key);
  }

  private getMetadataPath(bucket: string, key: string): string {
    return path.join(this.getBucketPath(bucket), `${key}.metadata`);
  }

  private async ensureBucketDir(bucket: string): Promise<void> {
    const bucketPath = this.getBucketPath(bucket);
    try {
      await fs.access(bucketPath);
    } catch {
      await fs.mkdir(bucketPath, { recursive: true });
    }
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
      await this.ensureBucketDir(bucket);

      const sanitizedKey = this.sanitizeKey(key);
      const filePath = this.getFilePath(bucket, sanitizedKey);
      const metadataPath = this.getMetadataPath(bucket, sanitizedKey);

      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      let buffer: Buffer;
      if (Buffer.isBuffer(data)) {
        buffer = data;
      } else if (typeof data === 'string') {
        buffer = Buffer.from(data);
      } else {
        // Stream
        const chunks: Buffer[] = [];
        for await (const chunk of data) {
          chunks.push(chunk);
        }
        buffer = Buffer.concat(chunks);
      }

      await fs.writeFile(filePath, buffer);

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

      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

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
      const filePath = this.getFilePath(bucket, sanitizedKey);
      const metadataPath = this.getMetadataPath(bucket, sanitizedKey);

      try {
        const data = await fs.readFile(filePath);
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
        metadata.lastModified = new Date(metadata.lastModified);

        return { data, metadata };
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          throw this.createError(`File not found: ${key}`, 'NoSuchKey', 404, bucket, key);
        }
        throw error;
      }
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
      const filePath = this.getFilePath(bucket, sanitizedKey);
      const metadataPath = this.getMetadataPath(bucket, sanitizedKey);

      try {
        await fs.unlink(filePath);
        await fs.unlink(metadataPath);
        return { deleted: true };
      } catch (error: any) {
        if (error.code === 'ENOENT') {
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
    const sanitizedKey = this.sanitizeKey(key);
    const metadataPath = this.getMetadataPath(bucket, sanitizedKey);

    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      metadata.lastModified = new Date(metadata.lastModified);
      return metadata;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw this.createError(`File not found: ${key}`, 'NoSuchKey', 404, bucket, key);
      }
      throw error;
    }
  }

  async listFiles(bucket: string, options?: ListOptions): Promise<ListResult> {
    return this.executeWithRetry(async () => {
      const bucketPath = this.getBucketPath(bucket);
      const prefix = options?.prefix ?? '';
      const delimiter = options?.delimiter;
      const maxKeys = options?.maxKeys ?? 1000;

      try {
        await fs.access(bucketPath);
      } catch {
        return {
          objects: [],
          commonPrefixes: [],
          isTruncated: false,
          count: 0,
          maxKeys,
        };
      }

      const objects: FileMetadata[] = [];
      const commonPrefixes: Set<string> = new Set();
      let count = 0;

      const walkDir = async (dir: string, currentPrefix: string): Promise<void> => {
        if (count >= maxKeys) return;

        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            if (count >= maxKeys) break;

            const fullPath = path.join(dir, entry.name);
            const relativePath = path.join(currentPrefix, entry.name);

            if (!relativePath.startsWith(prefix)) continue;

            if (entry.isDirectory()) {
              if (delimiter) {
                commonPrefixes.add(relativePath + delimiter);
              } else {
                await walkDir(fullPath, relativePath);
              }
            } else if (!entry.name.endsWith('.metadata')) {
              const key = relativePath;
              try {
                const metadata = await this.getFileMetadata(bucket, key);
                objects.push(metadata);
                count++;
              } catch {
                // Skip files without metadata
              }
            }
          }
        } catch {
          // Directory doesn't exist or isn't accessible
        }
      };

      await walkDir(bucketPath, '');

      return {
        objects,
        commonPrefixes: Array.from(commonPrefixes),
        isTruncated: false,
        count: objects.length,
        maxKeys,
        prefix,
        delimiter,
      };
    });
  }

  async fileExists(bucket: string, key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(bucket, this.sanitizeKey(key));
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async generatePresignedUrl(
    bucket: string,
    key: string,
    options?: PresignedUrlOptions
  ): Promise<string> {
    const expiresIn = options?.expiresIn ?? 3600;
    const expires = Date.now() + expiresIn * 1000;
    return `file://${this.getFilePath(bucket, key)}?expires=${expires}`;
  }

  // ============================================================================
  // Multipart Upload (Simulated)
  // ============================================================================

  async createMultipartUpload(
    bucket: string,
    key: string,
    options?: FileUploadOptions
  ): Promise<MultipartUpload> {
    const uploadId = `mpu-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const partsPath = path.join(this.getBucketPath(bucket), `.mpu-${uploadId}`);

    await fs.mkdir(partsPath, { recursive: true });

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
    const partsPath = path.join(this.getBucketPath(bucket), `.mpu-${uploadId}`);
    const partPath = path.join(partsPath, `part-${partNumber}`);

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

    await fs.writeFile(partPath, buffer);

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
    const partsPath = path.join(this.getBucketPath(bucket), `.mpu-${uploadId}`);

    // Combine all parts
    const buffers: Buffer[] = [];
    for (const part of parts.sort((a, b) => a.partNumber - b.partNumber)) {
      const partPath = path.join(partsPath, `part-${part.partNumber}`);
      const buffer = await fs.readFile(partPath);
      buffers.push(buffer);
    }

    const combinedBuffer = Buffer.concat(buffers);

    // Upload the combined file
    const metadata = await this.uploadFile(bucket, key, combinedBuffer);

    // Cleanup parts directory
    await fs.rm(partsPath, { recursive: true, force: true });

    return metadata;
  }

  async abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void> {
    const partsPath = path.join(this.getBucketPath(bucket), `.mpu-${uploadId}`);
    await fs.rm(partsPath, { recursive: true, force: true });
  }

  async listMultipartUploads(bucket: string, options?: ListOptions): Promise<MultipartUpload[]> {
    const bucketPath = this.getBucketPath(bucket);
    const entries = await fs.readdir(bucketPath, { withFileTypes: true });

    const uploads: MultipartUpload[] = [];
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('.mpu-')) {
        const uploadId = entry.name.replace('.mpu-', '');
        uploads.push({
          uploadId,
          key: 'unknown',
          bucket,
          initiated: new Date(),
        });
      }
    }

    return uploads;
  }

  async listParts(bucket: string, key: string, uploadId: string): Promise<MultipartPart[]> {
    const partsPath = path.join(this.getBucketPath(bucket), `.mpu-${uploadId}`);
    const entries = await fs.readdir(partsPath);

    const parts: MultipartPart[] = [];
    for (const entry of entries) {
      const match = entry.match(/part-(\d+)/);
      if (match) {
        const partNumber = parseInt(match[1], 10);
        const partPath = path.join(partsPath, entry);
        const buffer = await fs.readFile(partPath);
        parts.push({
          partNumber,
          etag: this.getETag(buffer),
          size: buffer.length,
        });
      }
    }

    return parts.sort((a, b) => a.partNumber - b.partNumber);
  }

  // ============================================================================
  // Bucket Operations
  // ============================================================================

  async createBucket(config: BucketConfig): Promise<void> {
    const bucketPath = this.getBucketPath(config.name);
    await fs.mkdir(bucketPath, { recursive: true });
  }

  async deleteBucket(bucket: string, force?: boolean): Promise<void> {
    const bucketPath = this.getBucketPath(bucket);

    if (force) {
      await this.emptyBucket(bucket);
    }

    await fs.rm(bucketPath, { recursive: true, force: true });
  }

  async getBucket(bucket: string): Promise<BucketMetadata> {
    const bucketPath = this.getBucketPath(bucket);

    try {
      const stats = await fs.stat(bucketPath);
      const objects = await this.listFiles(bucket);
      const totalSize = objects.objects.reduce((sum, obj) => sum + obj.size, 0);

      return {
        name: bucket,
        createdAt: stats.birthtime,
        location: 'local',
        locationType: 'local',
        storageClass: 'STANDARD',
        versioning: 'Disabled',
        encryption: {
          type: 'none',
          algorithm: 'none',
          encrypted: false,
        },
        size: totalSize,
        objectCount: objects.objects.length,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw this.createError(`Bucket not found: ${bucket}`, 'NoSuchBucket', 404);
      }
      throw error;
    }
  }

  async listBuckets(): Promise<BucketMetadata[]> {
    const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
    const buckets: BucketMetadata[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          const metadata = await this.getBucket(entry.name);
          buckets.push(metadata);
        } catch {
          // Skip invalid buckets
        }
      }
    }

    return buckets;
  }

  async bucketExists(bucket: string): Promise<boolean> {
    try {
      const bucketPath = this.getBucketPath(bucket);
      await fs.access(bucketPath);
      return true;
    } catch {
      return false;
    }
  }

  async updateBucket(bucket: string, config: Partial<BucketConfig>): Promise<void> {
    // Local storage doesn't support bucket configuration
  }

  // ============================================================================
  // Placeholder implementations for unsupported features
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
    const sanitizedKey = this.sanitizeKey(key);
    const metadataPath = this.getMetadataPath(bucket, sanitizedKey);
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    metadata.tags = tags;
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  async deleteObjectTags(bucket: string, key: string, versionId?: string): Promise<void> {
    const sanitizedKey = this.sanitizeKey(key);
    const metadataPath = this.getMetadataPath(bucket, sanitizedKey);
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    delete metadata.tags;
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
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
    this.metadataCache.clear();
  }
}
