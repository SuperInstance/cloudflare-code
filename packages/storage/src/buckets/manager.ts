/**
 * Bucket Manager
 * High-level bucket management operations
 */

import { StorageAdapter } from '../adapters/adapter';
import type {
  BucketConfig,
  BucketMetadata,
  BucketPolicy,
  LifecycleRule,
  CORSConfig,
  ListOptions,
  FileMetadata,
  VersioningConfig,
  VersioningStatus,
  LoggingConfig,
  WebsiteConfig,
  PublicAccessConfig,
  StorageResponse,
} from '../types';

// ============================================================================
// Bucket Analytics
// ============================================================================

export interface BucketAnalytics {
  bucket: string;
  objectCount: number;
  totalSize: number;
  averageSize: number;
  largestObject?: FileMetadata;
  smallestObject?: FileMetadata;
  sizeDistribution: Record<string, number>;
  contentTypeDistribution: Record<string, number>;
  storageClassDistribution: Record<string, number>;
  versioningEnabled: boolean;
  encryptionEnabled: boolean;
  publicAccess: boolean;
  lastUpdated: Date;
}

// ============================================================================
// Bucket Comparison
// ============================================================================

export interface BucketComparison {
  bucket1: string;
  bucket2: string;
  onlyInBucket1: string[];
  onlyInBucket2: string[];
  different: Array<{
    key: string;
    bucket1: FileMetadata;
    bucket2: FileMetadata;
  }>;
  same: string[];
}

// ============================================================================
// Bucket Replication Status
// ============================================================================

export interface BucketReplicationStatus {
  source: string;
  destination: string;
  status: 'pending' | 'in_sync' | 'failed';
  pendingObjects: number;
  lastSync: Date;
  lag: number; // seconds
}

// ============================================================================
// Bucket Manager
// ============================================================================

export class BucketManager {
  constructor(private adapter: StorageAdapter) {}

  // ============================================================================
  // Basic Bucket Operations
  // ============================================================================

  /**
   * Create a new bucket
   */
  async createBucket(config: BucketConfig): Promise<void> {
    return this.adapter.createBucket(config);
  }

  /**
   * Delete a bucket
   */
  async deleteBucket(bucket: string, force?: boolean): Promise<void> {
    return this.adapter.deleteBucket(bucket, force);
  }

  /**
   * Get bucket metadata
   */
  async getBucket(bucket: string): Promise<BucketMetadata> {
    return this.adapter.getBucket(bucket);
  }

  /**
   * List all buckets
   */
  async listBuckets(): Promise<BucketMetadata[]> {
    return this.adapter.listBuckets();
  }

  /**
   * Check if bucket exists
   */
  async bucketExists(bucket: string): Promise<boolean> {
    return this.adapter.bucketExists(bucket);
  }

  /**
   * Update bucket configuration
   */
  async updateBucket(bucket: string, config: Partial<BucketConfig>): Promise<void> {
    return this.adapter.updateBucket(bucket, config);
  }

  // ============================================================================
  // Bucket Lifecycle Management
  // ============================================================================

  /**
   * Empty a bucket (delete all objects)
   */
  async emptyBucket(bucket: string): Promise<void> {
    return this.adapter.emptyBucket(bucket);
  }

  /**
   * Sync two buckets
   */
  async syncBuckets(
    source: string,
    destination: string,
    options?: {
      delete?: boolean;
      dryRun?: boolean;
      prefix?: string;
    }
  ): Promise<{
    copied: number;
    deleted: number;
    skipped: number;
    errors: number;
  }> {
    const sourceFiles = await this.adapter.listFiles(source, { prefix: options?.prefix });
    const destFiles = await this.adapter.listFiles(destination, { prefix: options?.prefix });

    const destKeys = new Set(destFiles.objects.map(f => f.key));

    let copied = 0;
    let deleted = 0;
    let skipped = 0;
    let errors = 0;

    // Copy new or updated files
    for (const file of sourceFiles.objects) {
      try {
        const destFile = destFiles.objects.find(f => f.key === file.key);
        const needsCopy =
          !destFile ||
          destFile.etag !== file.etag ||
          destFile.lastModified < file.lastModified;

        if (needsCopy) {
          if (!options?.dryRun) {
            await this.adapter.copyFile(source, file.key, {
              destinationKey: file.key,
              destinationBucket: destination,
            });
          }
          copied++;
        } else {
          skipped++;
        }
      } catch {
        errors++;
      }
    }

    // Delete files not in source if requested
    if (options?.delete) {
      for (const file of destFiles.objects) {
        if (!sourceFiles.objects.find(f => f.key === file.key)) {
          try {
            if (!options?.dryRun) {
              await this.adapter.deleteFile(destination, file.key);
            }
            deleted++;
          } catch {
            errors++;
          }
        }
      }
    }

    return { copied, deleted, skipped, errors };
  }

  // ============================================================================
  // Bucket Policy Management
  // ============================================================================

  /**
   * Get bucket policy
   */
  async getBucketPolicy(bucket: string): Promise<BucketPolicy | null> {
    return this.adapter.getBucketPolicy(bucket);
  }

  /**
   * Set bucket policy
   */
  async setBucketPolicy(bucket: string, policy: BucketPolicy): Promise<void> {
    return this.adapter.setBucketPolicy(bucket, policy);
  }

  /**
   * Delete bucket policy
   */
  async deleteBucketPolicy(bucket: string): Promise<void> {
    return this.adapter.deleteBucketPolicy(bucket);
  }

  /**
   * Make bucket public
   */
  async makeBucketPublic(bucket: string): Promise<void> {
    const publicPolicy: BucketPolicy = {
      version: '2012-10-17',
      statements: [
        {
          sid: 'PublicReadGetObject',
          effect: 'Allow',
          principals: [{ type: 'User', values: ['*'] }],
          actions: ['s3:GetObject'],
          resources: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    };

    await this.setBucketPolicy(bucket, publicPolicy);
  }

  /**
   * Make bucket private
   */
  async makeBucketPrivate(bucket: string): Promise<void> {
    await this.deleteBucketPolicy(bucket);
  }

  // ============================================================================
  // Lifecycle Configuration
  // ============================================================================

  /**
   * Get lifecycle configuration
   */
  async getLifecycleConfiguration(bucket: string): Promise<LifecycleRule[]> {
    return this.adapter.getLifecycleConfiguration(bucket);
  }

  /**
   * Set lifecycle configuration
   */
  async setLifecycleConfiguration(bucket: string, rules: LifecycleRule[]): Promise<void> {
    return this.adapter.setLifecycleConfiguration(bucket, rules);
  }

  /**
   * Delete lifecycle configuration
   */
  async deleteLifecycleConfiguration(bucket: string): Promise<void> {
    return this.adapter.deleteLifecycleConfiguration(bucket);
  }

  /**
   * Add lifecycle rule
   */
  async addLifecycleRule(bucket: string, rule: LifecycleRule): Promise<void> {
    const rules = await this.getLifecycleConfiguration(bucket);
    rules.push(rule);
    await this.setLifecycleConfiguration(bucket, rules);
  }

  /**
   * Remove lifecycle rule
   */
  async removeLifecycleRule(bucket: string, ruleId: string): Promise<void> {
    const rules = await this.getLifecycleConfiguration(bucket);
    const filtered = rules.filter(r => r.id !== ruleId);
    await this.setLifecycleConfiguration(bucket, filtered);
  }

  /**
   * Enable versioning on bucket
   */
  async enableVersioning(bucket: string): Promise<void> {
    const config: VersioningConfig = {
      status: 'Enabled',
    };

    await this.updateBucket(bucket, { versioning: config });
  }

  /**
   * Suspend versioning on bucket
   */
  async suspendVersioning(bucket: string): Promise<void> {
    const config: VersioningConfig = {
      status: 'Suspended',
    };

    await this.updateBucket(bucket, { versioning: config });
  }

  // ============================================================================
  // CORS Configuration
  // ============================================================================

  /**
   * Get CORS configuration
   */
  async getCORSConfiguration(bucket: string): Promise<CORSConfig[]> {
    return this.adapter.getCORSConfiguration(bucket);
  }

  /**
   * Set CORS configuration
   */
  async setCORSConfiguration(bucket: string, config: CORSConfig[]): Promise<void> {
    return this.adapter.setCORSConfiguration(bucket, config);
  }

  /**
   * Delete CORS configuration
   */
  async deleteCORSConfiguration(bucket: string): Promise<void> {
    return this.adapter.deleteCORSConfiguration(bucket);
  }

  /**
   * Add CORS rule
   */
  async addCORSRule(bucket: string, rule: CORSConfig): Promise<void> {
    const rules = await this.getCORSConfiguration(bucket);
    rules.push(rule);
    await this.setCORSConfiguration(bucket, rules);
  }

  /**
   * Remove CORS rule
   */
  async removeCORSRule(bucket: string, ruleId: string): Promise<void> {
    const rules = await this.getCORSConfiguration(bucket);
    const filtered = rules.filter(r => r.id !== ruleId);
    await this.setCORSConfiguration(bucket, filtered);
  }

  // ============================================================================
  // Bucket Analytics
  // ============================================================================

  /**
   * Get comprehensive bucket analytics
   */
  async getBucketAnalytics(bucket: string, prefix?: string): Promise<BucketAnalytics> {
    const metadata = await this.getBucket(bucket);
    const files = await this.adapter.listFiles(bucket, { prefix });

    const totalSize = files.objects.reduce((sum, file) => sum + file.size, 0);
    const averageSize = files.objects.length > 0 ? totalSize / files.objects.length : 0;

    const sortedBySize = [...files.objects].sort((a, b) => b.size - a.size);
    const largestObject = sortedBySize[0];
    const smallestObject = sortedBySize[sortedBySize.length - 1];

    // Size distribution
    const sizeDistribution: Record<string, number> = {
      '0-1KB': 0,
      '1KB-10KB': 0,
      '10KB-100KB': 0,
      '100KB-1MB': 0,
      '1MB-10MB': 0,
      '10MB-100MB': 0,
      '100MB-1GB': 0,
      '1GB+': 0,
    };

    for (const file of files.objects) {
      const size = file.size;
      if (size < 1024) sizeDistribution['0-1KB']++;
      else if (size < 10240) sizeDistribution['1KB-10KB']++;
      else if (size < 102400) sizeDistribution['10KB-100KB']++;
      else if (size < 1048576) sizeDistribution['100KB-1MB']++;
      else if (size < 10485760) sizeDistribution['1MB-10MB']++;
      else if (size < 104857600) sizeDistribution['10MB-100MB']++;
      else if (size < 1073741824) sizeDistribution['100MB-1GB']++;
      else sizeDistribution['1GB+']++;
    }

    // Content type distribution
    const contentTypeDistribution: Record<string, number> = {};
    for (const file of files.objects) {
      const type = file.contentType;
      contentTypeDistribution[type] = (contentTypeDistribution[type] || 0) + 1;
    }

    // Storage class distribution
    const storageClassDistribution: Record<string, number> = {};
    for (const file of files.objects) {
      const sc = file.storageClass || 'STANDARD';
      storageClassDistribution[sc] = (storageClassDistribution[sc] || 0) + 1;
    }

    return {
      bucket,
      objectCount: files.objects.length,
      totalSize,
      averageSize,
      largestObject,
      smallestObject,
      sizeDistribution,
      contentTypeDistribution,
      storageClassDistribution,
      versioningEnabled: metadata.versioning === 'Enabled',
      encryptionEnabled: metadata.encryption?.encrypted ?? false,
      publicAccess: !metadata.publicAccess?.blockPublicAccess,
      lastUpdated: new Date(),
    };
  }

  /**
   * Compare two buckets
   */
  async compareBuckets(bucket1: string, bucket2: string): Promise<BucketComparison> {
    const files1 = await this.adapter.listFiles(bucket1);
    const files2 = await this.adapter.listFiles(bucket2);

    const map1 = new Map(files1.objects.map(f => [f.key, f]));
    const map2 = new Map(files2.objects.map(f => [f.key, f]));

    const onlyInBucket1: string[] = [];
    const onlyInBucket2: string[] = [];
    const different: Array<{
      key: string;
      bucket1: FileMetadata;
      bucket2: FileMetadata;
    }> = [];
    const same: string[] = [];

    const allKeys = new Set([...map1.keys(), ...map2.keys()]);

    for (const key of allKeys) {
      const file1 = map1.get(key);
      const file2 = map2.get(key);

      if (!file1) {
        onlyInBucket2.push(key);
      } else if (!file2) {
        onlyInBucket1.push(key);
      } else if (file1.etag !== file2.etag || file1.size !== file2.size) {
        different.push({ key, bucket1: file1, bucket2: file2 });
      } else {
        same.push(key);
      }
    }

    return {
      bucket1,
      bucket2,
      onlyInBucket1,
      onlyInBucket2,
      different,
      same,
    };
  }

  // ============================================================================
  // Bucket Monitoring
  // ============================================================================

  /**
   * Monitor bucket for changes
   */
  async monitorBucket(
    bucket: string,
    callback: (change: {
      type: 'added' | 'modified' | 'deleted';
      file: FileMetadata;
    }) => void,
    options?: {
      interval?: number;
      prefix?: string;
    }
  ): Promise<() => void> {
    const interval = options?.interval ?? 60000; // 1 minute default
    const prefix = options?.prefix;

    let previousFiles = new Map<string, FileMetadata>();
    const currentFiles = await this.adapter.listFiles(bucket, { prefix });
    for (const file of currentFiles.objects) {
      previousFiles.set(file.key, file);
    }

    const timer = setInterval(async () => {
      try {
        const currentFiles = await this.adapter.listFiles(bucket, { prefix });
        const currentMap = new Map<string, FileMetadata>();
        for (const file of currentFiles.objects) {
          currentMap.set(file.key, file);
        }

        // Check for additions and modifications
        for (const [key, file] of currentMap) {
          const previous = previousFiles.get(key);
          if (!previous) {
            callback({ type: 'added', file });
          } else if (previous.etag !== file.etag || previous.lastModified < file.lastModified) {
            callback({ type: 'modified', file });
          }
        }

        // Check for deletions
        for (const [key, file] of previousFiles) {
          if (!currentMap.has(key)) {
            callback({ type: 'deleted', file });
          }
        }

        previousFiles = currentMap;
      } catch (error) {
        console.error('Error monitoring bucket:', error);
      }
    }, interval);

    // Return cleanup function
    return () => clearInterval(timer);
  }

  // ============================================================================
  // Bucket Maintenance
  // ============================================================================

  /**
   * Clean up bucket (delete old files based on age)
   */
  async cleanupBucket(
    bucket: string,
    maxAge: number,
    options?: {
      prefix?: string;
      dryRun?: boolean;
    }
  ): Promise<{
    deleted: number;
    totalSize: number;
  }> {
    const files = await this.adapter.listFiles(bucket, { prefix: options?.prefix });
    const cutoffDate = new Date(Date.now() - maxAge * 1000);

    let deleted = 0;
    let totalSize = 0;

    for (const file of files.objects) {
      if (file.lastModified < cutoffDate) {
        if (!options?.dryRun) {
          await this.adapter.deleteFile(bucket, file.key);
        }
        deleted++;
        totalSize += file.size;
      }
    }

    return { deleted, totalSize };
  }

  /**
   * Optimize bucket (move old files to cheaper storage)
   */
  async optimizeBucket(
    bucket: string,
    rules: Array<{
      age: number;
      storageClass: string;
    }>,
    options?: {
      prefix?: string;
      dryRun?: boolean;
    }
  ): Promise<{
    moved: number;
    totalSize: number;
  }> {
    const files = await this.adapter.listFiles(bucket, { prefix: options?.prefix });
    const now = Date.now();

    let moved = 0;
    let totalSize = 0;

    for (const file of files.objects) {
      const age = (now - file.lastModified.getTime()) / 1000;

      for (const rule of rules) {
        if (age >= rule.age && file.storageClass !== rule.storageClass) {
          if (!options?.dryRun) {
            await this.adapter.copyFile(bucket, file.key, {
              destinationKey: file.key,
              storageClass: rule.storageClass,
            });
          }
          moved++;
          totalSize += file.size;
          break;
        }
      }
    }

    return { moved, totalSize };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get bucket size in human-readable format
   */
  async getHumanReadableBucketSize(bucket: string, prefix?: string): Promise<string> {
    const analytics = await this.getBucketAnalytics(bucket, prefix);
    return this.formatBytes(analytics.totalSize);
  }

  /**
   * Format bytes to human-readable format
   */
  private formatBytes(bytes: number): string {
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
   * Validate bucket name
   */
  validateBucketName(name: string): boolean {
    // Bucket name rules:
    // - 3-63 characters long
    // - Only lowercase letters, numbers, dots, and hyphens
    // - Must start and end with letter or number
    // - Not formatted as IP address
    const regex = /^(?!.*\.\.)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
    return regex.test(name) && name.length >= 3 && name.length <= 63;
  }

  /**
   * Generate bucket name from domain
   */
  generateBucketName(domain: string): string {
    return domain
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-')
      .replace(/^-|-$/g, '');
  }
}
