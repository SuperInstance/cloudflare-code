/**
 * File Manager
 * High-level file management operations with advanced features
 */

import { StorageAdapter } from '../adapters/adapter';
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
  StreamOptions,
  UploadStreamOptions,
  PresignedUrlOptions,
  Preconditions,
  TagSet,
  StorageResponse,
} from '../types';

// ============================================================================
// File Search Options
// ============================================================================

export interface FileSearchOptions {
  prefix?: string;
  suffix?: string;
  contentType?: string;
  minSize?: number;
  maxSize?: number;
  modifiedBefore?: Date;
  modifiedAfter?: Date;
  tags?: Record<string, string>;
  limit?: number;
}

// ============================================================================
// File Operations Result
// ============================================================================

export interface FileOperationsSummary {
  uploaded: number;
  downloaded: number;
  copied: number;
  moved: number;
  deleted: number;
  totalBytes: number;
  duration: number;
}

// ============================================================================
// File Validation Options
// ============================================================================

export interface FileValidationOptions {
  maxFileSize?: number;
  allowedContentTypes?: string[];
  allowedExtensions?: string[];
  scanForViruses?: boolean;
  validateChecksum?: boolean;
  expectedChecksum?: string;
}

// ============================================================================
// File Transform Options
// ============================================================================

export interface FileTransformOptions {
  compress?: boolean;
  compressionLevel?: number;
  resize?: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  };
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  quality?: number;
  stripMetadata?: boolean;
  thumbnail?: {
    width: number;
    height: number;
  };
}

// ============================================================================
// File Manager
// ============================================================================

export class FileManager {
  constructor(private adapter: StorageAdapter) {}

  // ============================================================================
  // Basic File Operations
  // ============================================================================

  /**
   * Upload a file with validation and transformation
   */
  async uploadFile(
    bucket: string,
    key: string,
    data: Buffer | NodeJS.ReadableStream | string,
    options?: FileUploadOptions,
    validation?: FileValidationOptions,
    transform?: FileTransformOptions
  ): Promise<UploadResult> {
    // Validate file if options provided
    if (validation) {
      await this.validateFile(bucket, key, data, validation);
    }

    // Transform file if options provided
    let uploadData = data;
    if (transform) {
      uploadData = await this.transformFile(data, transform);
    }

    // Upload the file
    return this.adapter.uploadFile(bucket, key, uploadData, options);
  }

  /**
   * Download a file with optional validation
   */
  async downloadFile(
    bucket: string,
    key: string,
    options?: FileDownloadOptions,
    validation?: FileValidationOptions
  ): Promise<DownloadResult> {
    const result = await this.adapter.downloadFile(bucket, key, options);

    // Validate downloaded file if requested
    if (validation && validation.validateChecksum) {
      const actualChecksum = this.adapter['getETag'](result.data);
      if (validation.expectedChecksum && actualChecksum !== validation.expectedChecksum) {
        throw new Error(`Checksum mismatch: expected ${validation.expectedChecksum}, got ${actualChecksum}`);
      }
    }

    return result;
  }

  /**
   * Copy a file to a new location
   */
  async copyFile(bucket: string, key: string, options: FileCopyOptions): Promise<CopyResult> {
    return this.adapter.copyFile(bucket, key, options);
  }

  /**
   * Move a file to a new location
   */
  async moveFile(bucket: string, key: string, options: FileMoveOptions): Promise<MoveResult> {
    return this.adapter.moveFile(bucket, key, options);
  }

  /**
   * Delete a file
   */
  async deleteFile(
    bucket: string,
    key: string,
    options?: FileDeleteOptions
  ): Promise<DeleteResult> {
    return this.adapter.deleteFile(bucket, key, options);
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Upload multiple files in batch
   */
  async batchUpload(
    bucket: string,
    files: Array<{ key: string; data: Buffer | NodeJS.ReadableStream; options?: FileUploadOptions }>,
    batchOptions?: BatchOperationOptions
  ): Promise<BatchUploadResult> {
    return this.adapter.batchUpload(bucket, files, batchOptions);
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
    return this.adapter.batchDownload(bucket, keys, options, batchOptions);
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
    return this.adapter.batchDelete(bucket, keys, options, batchOptions);
  }

  /**
   * Copy multiple files in batch
   */
  async batchCopy(
    bucket: string,
    operations: Array<{ key: string; options: FileCopyOptions }>,
    batchOptions?: BatchOperationOptions
  ): Promise<BatchResult<CopyResult>> {
    return this.executeBatch(
      operations.map(op => () => this.copyFile(bucket, op.key, op.options)),
      operations.map(op => op.key),
      batchOptions
    );
  }

  /**
   * Move multiple files in batch
   */
  async batchMove(
    bucket: string,
    operations: Array<{ key: string; options: FileMoveOptions }>,
    batchOptions?: BatchOperationOptions
  ): Promise<BatchResult<MoveResult>> {
    return this.executeBatch(
      operations.map(op => () => this.moveFile(bucket, op.key, op.options)),
      operations.map(op => op.key),
      batchOptions
    );
  }

  /**
   * Execute batch operations with concurrency control
   */
  private async executeBatch<T>(
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
  // File Search and Discovery
  // ============================================================================

  /**
   * Search for files based on criteria
   */
  async searchFiles(bucket: string, options: FileSearchOptions): Promise<FileMetadata[]> {
    const listOptions: ListOptions = {
      prefix: options.prefix,
      maxKeys: options.limit,
    };

    const result = await this.adapter.listFiles(bucket, listOptions);

    let files = result.objects;

    // Apply filters
    if (options.suffix) {
      files = files.filter(file => file.key.endsWith(options.suffix!));
    }

    if (options.contentType) {
      files = files.filter(file => file.contentType === options.contentType);
    }

    if (options.minSize !== undefined) {
      files = files.filter(file => file.size >= options.minSize!);
    }

    if (options.maxSize !== undefined) {
      files = files.filter(file => file.size <= options.maxSize!);
    }

    if (options.modifiedBefore) {
      files = files.filter(file => file.lastModified <= options.modifiedBefore!);
    }

    if (options.modifiedAfter) {
      files = files.filter(file => file.lastModified >= options.modifiedAfter!);
    }

    if (options.tags) {
      files = await this.filterByTags(files, bucket, options.tags);
    }

    return files;
  }

  /**
   * Find duplicate files by content hash
   */
  async findDuplicates(bucket: string, prefix?: string): Promise<Map<string, FileMetadata[]>> {
    const files = await this.adapter.listFiles(bucket, { prefix });
    const duplicates = new Map<string, FileMetadata[]>();

    for (const file of files.objects) {
      if (file.etag) {
        if (!duplicates.has(file.etag)) {
          duplicates.set(file.etag, []);
        }
        duplicates.get(file.etag)!.push(file);
      }
    }

    // Remove non-duplicates
    for (const [hash, files] of duplicates.entries()) {
      if (files.length < 2) {
        duplicates.delete(hash);
      }
    }

    return duplicates;
  }

  /**
   * Find files by tag
   */
  async findByTag(
    bucket: string,
    tag: string,
    value?: string
  ): Promise<FileMetadata[]> {
    const files = await this.adapter.listFiles(bucket);
    const tagged: FileMetadata[] = [];

    for (const file of files.objects) {
      const tags = await this.adapter.getObjectTags(bucket, file.key);
      if (value) {
        if (tags[tag] === value) {
          tagged.push(file);
        }
      } else {
        if (tag in tags) {
          tagged.push(file);
        }
      }
    }

    return tagged;
  }

  // ============================================================================
  // File Validation
  // ============================================================================

  /**
   * Validate a file before upload
   */
  private async validateFile(
    bucket: string,
    key: string,
    data: Buffer | NodeJS.ReadableStream | string,
    options: FileValidationOptions
  ): Promise<void> {
    let size: number;
    let contentType: string;

    if (Buffer.isBuffer(data) || typeof data === 'string') {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      size = buffer.length;
    } else {
      // For streams, we might need to check size differently
      size = 0; // Placeholder
    }

    // Check file size
    if (options.maxFileSize && size > options.maxFileSize) {
      throw new Error(`File size ${size} exceeds maximum ${options.maxFileSize}`);
    }

    // Check content type
    const inferredContentType = this.adapter['getContentType'](key);
    if (options.allowedContentTypes && !options.allowedContentTypes.includes(inferredContentType)) {
      throw new Error(`Content type ${inferredContentType} not allowed`);
    }

    // Check extension
    const ext = key.split('.').pop();
    if (options.allowedExtensions && ext && !options.allowedExtensions.includes(`.${ext}`)) {
      throw new Error(`File extension .${ext} not allowed`);
    }
  }

  // ============================================================================
  // File Transformation
  // ============================================================================

  /**
   * Transform a file before upload
   */
  private async transformFile(
    data: Buffer | NodeJS.ReadableStream | string,
    options: FileTransformOptions
  ): Promise<Buffer> {
    let buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    // Compression
    if (options.compress) {
      buffer = await this.compressBuffer(buffer, options.compressionLevel);
    }

    // Note: Image transformation would require additional libraries
    // This is a placeholder for the implementation

    return buffer;
  }

  /**
   * Compress a buffer
   */
  private async compressBuffer(buffer: Buffer, level: number = 6): Promise<Buffer> {
    // Placeholder for compression logic
    // Would use zlib or similar
    return buffer;
  }

  // ============================================================================
  // File Metadata Operations
  // ============================================================================

  /**
   * Get file metadata
   */
  async getFileMetadata(bucket: string, key: string): Promise<FileMetadata> {
    return this.adapter.getFileMetadata(bucket, key);
  }

  /**
   * Update file metadata
   */
  async updateFileMetadata(
    bucket: string,
    key: string,
    metadata: Partial<FileMetadata>
  ): Promise<FileMetadata> {
    const current = await this.getFileMetadata(bucket, key);

    // To update metadata, we need to copy the file to itself with new metadata
    return this.adapter.copyFile(bucket, key, {
      destinationKey: key,
      metadata: { ...current.customMetadata, ...metadata.customMetadata },
      tags: metadata.tags,
    });
  }

  // ============================================================================
  // File Tagging Operations
  // ============================================================================

  /**
   * Get file tags
   */
  async getFileTags(bucket: string, key: string): Promise<Record<string, string>> {
    return this.adapter.getObjectTags(bucket, key);
  }

  /**
   * Set file tags
   */
  async setFileTags(
    bucket: string,
    key: string,
    tags: Record<string, string>
  ): Promise<void> {
    return this.adapter.setObjectTags(bucket, key, tags);
  }

  /**
   * Delete file tags
   */
  async deleteFileTags(bucket: string, key: string): Promise<void> {
    return this.adapter.deleteObjectTags(bucket, key);
  }

  /**
   * Add tag to file
   */
  async addFileTag(bucket: string, key: string, tag: string, value: string): Promise<void> {
    const tags = await this.getFileTags(bucket, key);
    tags[tag] = value;
    await this.setFileTags(bucket, key, tags);
  }

  /**
   * Remove tag from file
   */
  async removeFileTag(bucket: string, key: string, tag: string): Promise<void> {
    const tags = await this.getFileTags(bucket, key);
    delete tags[tag];
    await this.setFileTags(bucket, key, tags);
  }

  // ============================================================================
  // File Existence Checks
  // ============================================================================

  /**
   * Check if file exists
   */
  async fileExists(bucket: string, key: string): Promise<boolean> {
    return this.adapter.fileExists(bucket, key);
  }

  /**
   * Check if multiple files exist
   */
  async filesExist(bucket: string, keys: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    await Promise.all(
      keys.map(async key => {
        results.set(key, await this.fileExists(bucket, key));
      })
    );

    return results;
  }

  // ============================================================================
  // Presigned URLs
  // ============================================================================

  /**
   * Generate presigned URL for file
   */
  async generatePresignedUrl(
    bucket: string,
    key: string,
    options?: PresignedUrlOptions
  ): Promise<string> {
    return this.adapter.generatePresignedUrl(bucket, key, options);
  }

  /**
   * Generate presigned URLs for multiple files
   */
  async generatePresignedUrls(
    bucket: string,
    keys: string[],
    options?: PresignedUrlOptions
  ): Promise<Map<string, string>> {
    const urls = new Map<string, string>();

    await Promise.all(
      keys.map(async key => {
        urls.set(key, await this.generatePresignedUrl(bucket, key, options));
      })
    );

    return urls;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get file URL
   */
  async getFileUrl(bucket: string, key: string, expiresIn?: number): Promise<string> {
    return this.generatePresignedUrl(bucket, key, { expiresIn });
  }

  /**
   * Get file size in human-readable format
   */
  getHumanReadableSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Calculate total size of files
   */
  async calculateTotalSize(bucket: string, prefix?: string): Promise<number> {
    const files = await this.adapter.listFiles(bucket, { prefix });
    return files.objects.reduce((sum, file) => sum + file.size, 0);
  }

  /**
   * Get file statistics
   */
  async getFileStatistics(
    bucket: string,
    prefix?: string
  ): Promise<{
    totalFiles: number;
    totalSize: number;
    averageSize: number;
    largestFile?: FileMetadata;
    smallestFile?: FileMetadata;
    byContentType: Record<string, number>;
  }> {
    const files = await this.adapter.listFiles(bucket, { prefix });

    const totalFiles = files.objects.length;
    const totalSize = files.objects.reduce((sum, file) => sum + file.size, 0);
    const averageSize = totalFiles > 0 ? totalSize / totalFiles : 0;

    const sortedBySize = [...files.objects].sort((a, b) => b.size - a.size);
    const largestFile = sortedBySize[0];
    const smallestFile = sortedBySize[sortedBySize.length - 1];

    const byContentType: Record<string, number> = {};
    for (const file of files.objects) {
      byContentType[file.contentType] = (byContentType[file.contentType] || 0) + 1;
    }

    return {
      totalFiles,
      totalSize,
      averageSize,
      largestFile,
      smallestFile,
      byContentType,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async filterByTags(
    files: FileMetadata[],
    bucket: string,
    tags: Record<string, string>
  ): Promise<FileMetadata[]> {
    const filtered: FileMetadata[] = [];

    for (const file of files) {
      const fileTags = await this.adapter.getObjectTags(bucket, file.key);
      let matches = true;

      for (const [key, value] of Object.entries(tags)) {
        if (fileTags[key] !== value) {
          matches = false;
          break;
        }
      }

      if (matches) {
        filtered.push(file);
      }
    }

    return filtered;
  }
}
