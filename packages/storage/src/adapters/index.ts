/**
 * Storage Adapters Module
 * Exports all storage adapter implementations
 */

export { StorageAdapter, StorageAdapterFactory } from './adapter';
export { R2StorageAdapter } from './r2';
export { S3StorageAdapter } from './s3';
export { LocalStorageAdapter } from './local';
export { MemoryStorageAdapter } from './memory';

// Re-export types
import type {
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
} from '../types';

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
};
