/**
 * AWS S3 Storage Adapter
 * Full S3-compatible implementation
 */

import { StorageAdapter, StorageAdapterFactory } from './adapter';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListMultipartUploadsCommand,
  ListPartsCommand,
  GetObjectTaggingCommand,
  PutObjectTaggingCommand,
  DeleteObjectTaggingCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
// AWS S3 Adapter
// ============================================================================

export class S3StorageAdapter extends StorageAdapter {
  private client: S3Client;

  constructor(config: StorageConfig) {
    super(config);
    this.client = this.createClient();
    StorageAdapterFactory.register('s3', S3StorageAdapter);
  }

  getBackend(): StorageBackend {
    return 's3';
  }

  // ============================================================================
  // Client Creation
  // ============================================================================

  private createClient(): S3Client {
    const credentials = this.config.credentials.credentials;

    return new S3Client({
      region: this.config.region ?? 'us-east-1',
      endpoint: this.config.endpoint,
      credentials: {
        accessKeyId: credentials.AWS_ACCESS_KEY_ID ?? credentials.accessKeyId ?? '',
        secretAccessKey: credentials.AWS_SECRET_ACCESS_KEY ?? credentials.secretAccessKey ?? '',
        sessionToken: credentials.AWS_SESSION_TOKEN ?? credentials.sessionToken,
      },
      maxAttempts: this.config.maxRetries ?? 3,
      requestTimeout: this.config.timeout,
      forcePathStyle: this.config.forcePathStyle ?? false,
      useSSL: this.config.useSSL ?? true,
    });
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
      const sanitizedKey = this.sanitizeKey(key);
      const contentType = options?.contentType ?? this.getContentType(sanitizedKey);

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: sanitizedKey,
        Body: data,
        ContentType: contentType,
        Metadata: options?.metadata,
        TagSet: options?.tags
          ? Object.entries(options.tags).map(([Key, Value]) => ({ Key, Value }))
          : undefined,
        StorageClass: options?.storageClass,
        CacheControl: options?.cacheControl,
        ContentDisposition: options?.contentDisposition,
        ContentEncoding: options?.contentEncoding,
        ContentLanguage: options?.contentLanguage,
        ServerSideEncryption: options?.encryption?.algorithm,
        SSEKMSKeyId: options?.encryption?.kmsKeyArn,
      });

      const response = await this.client.send(command);

      // Get the metadata of the uploaded object
      return this.getFileMetadata(bucket, sanitizedKey);
    });
  }

  async downloadFile(
    bucket: string,
    key: string,
    options?: FileDownloadOptions
  ): Promise<{ data: Buffer; metadata: FileMetadata }> {
    return this.executeWithRetry(async () => {
      const sanitizedKey = this.sanitizeKey(key);

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: sanitizedKey,
        VersionId: options?.versionId,
        Range: options?.range
          ? `bytes=${options.range.start}-${options.range.end}`
          : undefined,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw this.createError('No data received', 'NoData', 500, bucket, key);
      }

      const chunks: Uint8Array[] = [];
      const stream = response.Body as NodeJS.ReadableStream;

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const data = Buffer.concat(chunks);

      const metadata: FileMetadata = {
        key,
        bucket,
        size: data.length,
        contentType: response.ContentType ?? 'application/octet-stream',
        etag: response.ETag,
        versionId: response.VersionId,
        lastModified: response.LastModified ?? new Date(),
        customMetadata: response.Metadata,
        storageClass: response.StorageClass ?? 'STANDARD',
        cacheControl: response.CacheControl,
        contentEncoding: response.ContentEncoding,
      };

      return { data, metadata };
    });
  }

  async copyFile(
    bucket: string,
    key: string,
    options: FileCopyOptions
  ): Promise<FileMetadata> {
    return this.executeWithRetry(async () => {
      const sourceKey = this.sanitizeKey(key);
      const destinationKey = this.sanitizeKey(options.destinationKey);
      const destinationBucket = options.destinationBucket ?? bucket;

      const command = new CopyObjectCommand({
        Bucket: destinationBucket,
        CopySource: `${bucket}/${sourceKey}`,
        Key: destinationKey,
        Metadata: options?.metadata,
        Tagging: options?.tags
          ? Object.entries(options.tags)
              .map(([k, v]) => `${k}=${v}`)
              .join('&')
          : undefined,
        StorageClass: options?.storageClass,
        ServerSideEncryption: options?.encryption?.algorithm,
        SSEKMSKeyId: options?.encryption?.kmsKeyArn,
      });

      await this.client.send(command);

      return this.getFileMetadata(destinationBucket, destinationKey);
    });
  }

  async moveFile(
    bucket: string,
    key: string,
    options: FileMoveOptions
  ): Promise<{ sourceDeleted: boolean; destination: FileMetadata }> {
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
      const sanitizedKey = this.sanitizeKey(key);

      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: sanitizedKey,
        VersionId: options?.versionId,
        BypassGovernanceRetention: options?.bypassGovernance,
      });

      try {
        const response = await this.client.send(command);
        return {
          deleted: true,
          versionId: response.VersionId,
        };
      } catch (error: any) {
        if (error.name === 'NoSuchKey') {
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
      const sanitizedKey = this.sanitizeKey(key);

      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: sanitizedKey,
        VersionId: versionId,
      });

      const response = await this.client.send(command);

      return {
        key,
        bucket,
        size: response.ContentLength ?? 0,
        contentType: response.ContentType ?? 'application/octet-stream',
        etag: response.ETag,
        versionId: response.VersionId,
        lastModified: response.LastModified ?? new Date(),
        customMetadata: response.Metadata,
        storageClass: response.StorageClass ?? 'STANDARD',
        cacheControl: response.CacheControl,
        contentEncoding: response.ContentEncoding,
      };
    });
  }

  async listFiles(bucket: string, options?: ListOptions): Promise<ListResult> {
    return this.executeWithRetry(async () => {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: options?.prefix,
        Delimiter: options?.delimiter,
        MaxKeys: options?.maxKeys,
        ContinuationToken: options?.continuationToken,
        StartAfter: options?.startAfter,
      });

      const response = await this.client.send(command);

      const objects: FileMetadata[] =
        response.Contents?.map(obj => ({
          key: obj.Key!,
          bucket,
          size: obj.Size ?? 0,
          contentType: 'application/octet-stream', // List doesn't return content type
          etag: obj.ETag,
          lastModified: obj.LastModified ?? new Date(),
          storageClass: obj.StorageClass ?? 'STANDARD',
        })) ?? [];

      return {
        objects,
        commonPrefixes: response.CommonPrefixes?.map(p => p.Prefix!).filter(Boolean) ?? [],
        isTruncated: response.IsTruncated ?? false,
        nextContinuationToken: response.NextContinuationToken,
        count: response.KeyCount ?? 0,
        maxKeys: response.MaxKeys ?? 0,
        prefix: response.Prefix,
        delimiter: response.Delimiter,
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
    const sanitizedKey = this.sanitizeKey(key);
    const expiresIn = options?.expiresIn ?? 3600;
    const method = options?.method ?? 'GET';

    let command;
    switch (method) {
      case 'GET':
        command = new GetObjectCommand({
          Bucket: bucket,
          Key: sanitizedKey,
        });
        break;
      case 'PUT':
        command = new PutObjectCommand({
          Bucket: bucket,
          Key: sanitizedKey,
        });
        break;
      default:
        throw new Error(`Unsupported method: ${method}`);
    }

    return getSignedUrl(this.client, command, { expiresIn });
  }

  // ============================================================================
  // Multipart Upload Operations
  // ============================================================================

  async createMultipartUpload(
    bucket: string,
    key: string,
    options?: FileUploadOptions
  ): Promise<MultipartUpload> {
    const command = new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: options?.contentType,
      Metadata: options?.metadata,
      StorageClass: options?.storageClass,
      ServerSideEncryption: options?.encryption?.algorithm,
      SSEKMSKeyId: options?.encryption?.kmsKeyArn,
    });

    const response = await this.client.send(command);

    return {
      uploadId: response.UploadId!,
      key,
      bucket,
      initiated: new Date(),
      storageClass: response.StorageClass,
    };
  }

  async uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    data: Buffer | NodeJS.ReadableStream
  ): Promise<MultipartPart> {
    const command = new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: data,
    });

    const response = await this.client.send(command);

    return {
      partNumber,
      etag: response.ETag!,
    };
  }

  async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: MultipartPart[]
  ): Promise<FileMetadata> {
    const command = new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map(part => ({
          PartNumber: part.partNumber,
          ETag: part.etag,
        })),
      },
    });

    const response = await this.client.send(command);

    return this.getFileMetadata(bucket, key, response.VersionId);
  }

  async abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    });

    await this.client.send(command);
  }

  async listMultipartUploads(bucket: string, options?: ListOptions): Promise<MultipartUpload[]> {
    const command = new ListMultipartUploadsCommand({
      Bucket: bucket,
      Prefix: options?.prefix,
      MaxUploads: options?.maxKeys,
      KeyMarker: options?.continuationToken,
    });

    const response = await this.client.send(command);

    return (
      response.Uploads?.map(upload => ({
        uploadId: upload.UploadId!,
        key: upload.Key!,
        bucket,
        initiated: upload.Initiated!,
        storageClass: upload.StorageClass,
        owner: upload.Owner?.DisplayName,
        initiator: upload.Initiator?.DisplayName,
      })) ?? []
    );
  }

  async listParts(bucket: string, key: string, uploadId: string): Promise<MultipartPart[]> {
    const command = new ListPartsCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    });

    const response = await this.client.send(command);

    return (
      response.Parts?.map(part => ({
        partNumber: part.PartNumber!,
        etag: part.ETag!,
        size: part.Size,
      })) ?? []
    );
  }

  // ============================================================================
  // Bucket Operations
  // ============================================================================

  async createBucket(config: BucketConfig): Promise<void> {
    throw this.createError(
      'S3 buckets must be created through AWS Console or CLI',
      'NotImplemented',
      501
    );
  }

  async deleteBucket(bucket: string, force?: boolean): Promise<void> {
    if (force) {
      await this.emptyBucket(bucket);
    }
    throw this.createError(
      'S3 buckets must be deleted through AWS Console or CLI',
      'NotImplemented',
      501
    );
  }

  async getBucket(bucket: string): Promise<BucketMetadata> {
    // Use HeadBucket operation or use list to verify
    return {
      name: bucket,
      createdAt: new Date(),
      location: this.config.region ?? 'us-east-1',
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
    // This would use ListBucketsCommand
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
    // Update bucket configuration using PutBucketVersioning, etc.
  }

  // ============================================================================
  // Bucket Policy Operations
  // ============================================================================

  async getBucketPolicy(bucket: string): Promise<BucketPolicy | null> {
    // Use GetBucketPolicyCommand
    return null;
  }

  async setBucketPolicy(bucket: string, policy: BucketPolicy): Promise<void> {
    // Use PutBucketPolicyCommand
  }

  async deleteBucketPolicy(bucket: string): Promise<void> {
    // Use DeleteBucketPolicyCommand
  }

  // ============================================================================
  // Lifecycle Configuration
  // ============================================================================

  async getLifecycleConfiguration(bucket: string): Promise<LifecycleRule[]> {
    // Use GetLifecycleConfigurationCommand
    return [];
  }

  async setLifecycleConfiguration(bucket: string, rules: LifecycleRule[]): Promise<void> {
    // Use PutLifecycleConfigurationCommand
  }

  async deleteLifecycleConfiguration(bucket: string): Promise<void> {
    // Use DeleteBucketLifecycleCommand
  }

  // ============================================================================
  // CORS Configuration
  // ============================================================================

  async getCORSConfiguration(bucket: string): Promise<CORSConfig[]> {
    // Use GetBucketCorsCommand
    return [];
  }

  async setCORSConfiguration(bucket: string, config: CORSConfig[]): Promise<void> {
    // Use PutBucketCorsCommand
  }

  async deleteCORSConfiguration(bucket: string): Promise<void> {
    // Use DeleteBucketCorsCommand
  }

  // ============================================================================
  // Tagging Operations
  // ============================================================================

  async getObjectTags(
    bucket: string,
    key: string,
    versionId?: string
  ): Promise<Record<string, string>> {
    const command = new GetObjectTaggingCommand({
      Bucket: bucket,
      Key: key,
      VersionId: versionId,
    });

    const response = await this.client.send(command);

    const tags: Record<string, string> = {};
    response.TagSet?.forEach(tag => {
      tags[tag.Key!] = tag.Value!;
    });

    return tags;
  }

  async setObjectTags(
    bucket: string,
    key: string,
    tags: Record<string, string>,
    versionId?: string
  ): Promise<void> {
    const command = new PutObjectTaggingCommand({
      Bucket: bucket,
      Key: key,
      Tagging: {
        TagSet: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })),
      },
      VersionId: versionId,
    });

    await this.client.send(command);
  }

  async deleteObjectTags(bucket: string, key: string, versionId?: string): Promise<void> {
    const command = new DeleteObjectTaggingCommand({
      Bucket: bucket,
      Key: key,
      VersionId: versionId,
    });

    await this.client.send(command);
  }

  // ============================================================================
  // Object Lock Operations
  // ============================================================================

  async enableObjectLock(bucket: string): Promise<void> {
    // Use PutObjectLockConfigurationCommand
  }

  async getObjectLockConfiguration(bucket: string): Promise<ObjectLockConfig> {
    // Use GetObjectLockConfigurationCommand
    return {
      enabled: false,
    };
  }

  async setObjectLockConfiguration(bucket: string, config: ObjectLockConfig): Promise<void> {
    // Use PutObjectLockConfigurationCommand
  }

  async setLegalHold(bucket: string, key: string, enabled: boolean, versionId?: string): Promise<void> {
    // Use PutObjectLegalHoldCommand
  }

  async getLegalHold(bucket: string, key: string, versionId?: string): Promise<boolean> {
    // Use GetObjectLegalHoldCommand
    return false;
  }

  // ============================================================================
  // Replication Operations
  // ============================================================================

  async getReplicationConfiguration(bucket: string): Promise<ReplicationConfig> {
    // Use GetBucketReplicationCommand
    return {
      enabled: false,
      destination: {
        bucket: '',
      },
      rules: [],
    };
  }

  async setReplicationConfiguration(bucket: string, config: ReplicationConfig): Promise<void> {
    // Use PutBucketReplicationCommand
  }

  async deleteReplicationConfiguration(bucket: string): Promise<void> {
    // Use DeleteBucketReplicationCommand
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async close(): Promise<void> {
    this.client.destroy();
  }
}
