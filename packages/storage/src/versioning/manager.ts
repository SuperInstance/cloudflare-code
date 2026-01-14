/**
 * Versioning Manager
 * Manages file versioning and restoration
 */

import { StorageAdapter } from '../adapters/adapter';
import type {
  FileVersion,
  VersionDiff,
  VersionChange,
  VersionRetentionConfig,
  FileMetadata,
  ListOptions,
} from '../types';

// ============================================================================
// Version History
// ============================================================================

export interface VersionHistory {
  key: string;
  bucket: string;
  versions: FileVersion[];
  currentVersionId?: string;
  totalVersions: number;
  totalSize: number;
}

// ============================================================================
// Version Comparison Result
// ============================================================================

export interface VersionComparison {
  version1: FileVersion;
  version2: FileVersion;
  changes: VersionChange[];
  sizeDifference: number;
  timeDifference: number;
}

// ============================================================================
// Version Restoration Options
// ============================================================================

export interface VersionRestoreOptions {
  restoreToCurrent?: boolean;
  createNewVersion?: boolean;
  restoreMetadata?: boolean;
  restoreTags?: boolean;
}

// ============================================================================
// Version Retention Policy
// ============================================================================

export interface VersionRetentionPolicy {
  enabled: boolean;
  maxVersions?: number;
  maxAge?: number; // seconds
  minVersions?: number;
  deleteMarkers?: boolean;
}

// ============================================================================
// Versioning Manager
// ============================================================================

export class VersioningManager {
  constructor(private adapter: StorageAdapter) {}

  // ============================================================================
  // Version Listing
  // ============================================================================

  /**
   * List all versions of a file
   */
  async listVersions(bucket: string, key: string): Promise<VersionHistory> {
    const allVersions = await this.adapter.listFiles(bucket, {
      prefix: key,
      includeVersions: true,
    });

    const versions: FileVersion[] = [];

    for (const obj of allVersions.objects) {
      if (obj.key === key && obj.versionId) {
        versions.push({
          versionId: obj.versionId,
          key: obj.key,
          bucket,
          size: obj.size,
          contentType: obj.contentType,
          lastModified: obj.lastModified,
          isLatest: true, // Would be determined by the adapter
          isDeleteMarker: false,
          metadata: obj.customMetadata,
          storageClass: obj.storageClass,
        });
      }
    }

    // Sort by date descending
    versions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

    const totalSize = versions.reduce((sum, v) => sum + v.size, 0);

    return {
      key,
      bucket,
      versions,
      currentVersionId: versions[0]?.versionId,
      totalVersions: versions.length,
      totalSize,
    };
  }

  /**
   * Get specific version of a file
   */
  async getVersion(bucket: string, key: string, versionId: string): Promise<FileVersion> {
    const metadata = await this.adapter.getFileMetadata(bucket, key, versionId);

    return {
      versionId: versionId,
      key,
      bucket,
      size: metadata.size,
      contentType: metadata.contentType,
      lastModified: metadata.lastModified,
      isLatest: false,
      isDeleteMarker: false,
      metadata: metadata.customMetadata,
      storageClass: metadata.storageClass,
    };
  }

  /**
   * Get latest version of a file
   */
  async getLatestVersion(bucket: string, key: string): Promise<FileVersion> {
    const history = await this.listVersions(bucket, key);
    if (history.versions.length === 0) {
      throw new Error(`No versions found for ${key}`);
    }
    return history.versions[0];
  }

  // ============================================================================
  // Version Restoration
  // ============================================================================

  /**
   * Restore a specific version
   */
  async restoreVersion(
    bucket: string,
    key: string,
    versionId: string,
    options?: VersionRestoreOptions
  ): Promise<FileMetadata> {
    // Download the specific version
    const { data } = await this.adapter.downloadFile(bucket, key, {
      versionId,
    });

    // Upload as the current version
    const uploadOptions: any = {};
    if (options?.restoreMetadata) {
      const version = await this.getVersion(bucket, key, versionId);
      uploadOptions.metadata = version.metadata;
    }

    if (options?.createNewVersion) {
      // Upload as a new version
      return this.adapter.uploadFile(bucket, key, data, uploadOptions);
    } else {
      // Replace current version
      await this.adapter.deleteFile(bucket, key);
      return this.adapter.uploadFile(bucket, key, data, uploadOptions);
    }
  }

  /**
   * Restore to a specific point in time
   */
  async restoreToPointInTime(
    bucket: string,
    key: string,
    timestamp: Date
  ): Promise<FileMetadata> {
    const history = await this.listVersions(bucket, key);

    // Find version closest to but not after timestamp
    const targetVersion = history.versions.find(
      v => v.lastModified <= timestamp
    );

    if (!targetVersion) {
      throw new Error(`No version found before ${timestamp}`);
    }

    return this.restoreVersion(bucket, key, targetVersion.versionId, {
      restoreToCurrent: true,
    });
  }

  /**
   * Rollback to previous version
   */
  async rollback(bucket: string, key: string, steps: number = 1): Promise<FileMetadata> {
    const history = await this.listVersions(bucket, key);

    if (history.versions.length <= steps) {
      throw new Error(`Not enough versions to rollback ${steps} steps`);
    }

    const targetVersion = history.versions[steps];
    return this.restoreVersion(bucket, key, targetVersion.versionId, {
      restoreToCurrent: true,
    });
  }

  // ============================================================================
  // Version Comparison
  // ============================================================================

  /**
   * Compare two versions
   */
  async compareVersions(
    bucket: string,
    key: string,
    versionId1: string,
    versionId2: string
  ): Promise<VersionComparison> {
    const version1 = await this.getVersion(bucket, key, versionId1);
    const version2 = await this.getVersion(bucket, key, versionId2);

    const changes: VersionChange[] = [];

    // Compare size
    if (version1.size !== version2.size) {
      changes.push({
        field: 'size',
        oldValue: version1.size,
        newValue: version2.size,
      });
    }

    // Compare content type
    if (version1.contentType !== version2.contentType) {
      changes.push({
        field: 'contentType',
        oldValue: version1.contentType,
        newValue: version2.contentType,
      });
    }

    // Compare metadata
    const metadata1 = version1.metadata ?? {};
    const metadata2 = version2.metadata ?? {};

    const allKeys = new Set([...Object.keys(metadata1), ...Object.keys(metadata2)]);
    for (const key of allKeys) {
      if (metadata1[key] !== metadata2[key]) {
        changes.push({
          field: `metadata.${key}`,
          oldValue: metadata1[key],
          newValue: metadata2[key],
        });
      }
    }

    return {
      version1,
      version2,
      changes,
      sizeDifference: version2.size - version1.size,
      timeDifference: version2.lastModified.getTime() - version1.lastModified.getTime(),
    };
  }

  /**
   * Compare current version with another version
   */
  async compareWithCurrent(
    bucket: string,
    key: string,
    versionId: string
  ): Promise<VersionComparison> {
    const current = await this.getLatestVersion(bucket, key);
    return this.compareVersions(bucket, key, current.versionId, versionId);
  }

  /**
   * Diff two versions
   */
  async diffVersions(
    bucket: string,
    key: string,
    versionId1: string,
    versionId2: string
  ): Promise<VersionDiff> {
    const allVersions = await this.listVersions(bucket, key);

    const version1 = await this.getVersion(bucket, key, versionId1);
    const version2 = await this.getVersion(bucket, key, versionId2);

    return {
      added: [],
      modified: [
        {
          version: version2,
          changes: [
            {
              field: 'version',
              oldValue: versionId1,
              newValue: versionId2,
            },
          ],
        },
      ],
      deleted: [],
    };
  }

  // ============================================================================
  // Version Deletion
  // ============================================================================

  /**
   * Delete a specific version
   */
  async deleteVersion(bucket: string, key: string, versionId: string): Promise<void> {
    await this.adapter.deleteFile(bucket, key, { versionId });
  }

  /**
   * Delete old versions
   */
  async deleteOldVersions(
    bucket: string,
    key: string,
    keep: number = 10
  ): Promise<number> {
    const history = await this.listVersions(bucket, key);

    if (history.versions.length <= keep) {
      return 0;
    }

    const toDelete = history.versions.slice(keep);

    for (const version of toDelete) {
      await this.deleteVersion(bucket, key, version.versionId);
    }

    return toDelete.length;
  }

  /**
   * Delete versions older than specified age
   */
  async deleteVersionsOlderThan(
    bucket: string,
    key: string,
    maxAge: number
  ): Promise<number> {
    const history = await this.listVersions(bucket, key);
    const cutoffDate = new Date(Date.now() - maxAge * 1000);

    const toDelete = history.versions.filter(v => v.lastModified < cutoffDate);

    for (const version of toDelete) {
      await this.deleteVersion(bucket, key, version.versionId);
    }

    return toDelete.length;
  }

  // ============================================================================
  // Version Retention
  // ============================================================================

  /**
   * Set version retention policy
   */
  async setRetentionPolicy(
    bucket: string,
    key: string,
    policy: VersionRetentionPolicy
  ): Promise<void> {
    // This would be implemented based on the storage backend
    // For now, it's a placeholder
  }

  /**
   * Get version retention policy
   */
  async getRetentionPolicy(bucket: string, key: string): Promise<VersionRetentionPolicy> {
    return {
      enabled: false,
    };
  }

  /**
   * Apply retention policy to file
   */
  async applyRetentionPolicy(
    bucket: string,
    key: string,
    policy: VersionRetentionPolicy
  ): Promise<{
    deleted: number;
    kept: number;
  }> {
    const history = await this.listVersions(bucket, key);
    let deleted = 0;
    let kept = 0;

    if (policy.maxVersions && history.versions.length > policy.maxVersions) {
      const toDelete = history.versions.slice(policy.maxVersions);
      for (const version of toDelete) {
        await this.deleteVersion(bucket, key, version.versionId);
        deleted++;
      }
      kept = policy.maxVersions;
    }

    if (policy.maxAge) {
      const cutoffDate = new Date(Date.now() - policy.maxAge * 1000);
      const toDelete = history.versions.filter(v => v.lastModified < cutoffDate);

      if (policy.minVersions && toDelete.length >= history.versions.length - policy.minVersions) {
        // Keep minimum versions
        const keepCount = Math.min(policy.minVersions, toDelete.length);
        const deleteCount = toDelete.length - keepCount;

        for (let i = 0; i < deleteCount; i++) {
          await this.deleteVersion(bucket, key, toDelete[i].versionId);
          deleted++;
        }
      } else {
        for (const version of toDelete) {
          await this.deleteVersion(bucket, key, version.versionId);
          deleted++;
        }
      }

      kept = history.versions.length - deleted;
    }

    return { deleted, kept };
  }

  // ============================================================================
  // Version Analytics
  // ============================================================================

  /**
   * Get version statistics for a file
   */
  async getVersionStatistics(bucket: string, key: string): Promise<{
    totalVersions: number;
    totalSize: number;
    averageSize: number;
    oldestVersion?: FileVersion;
    newestVersion?: FileVersion;
    sizeGrowth: number;
    modificationFrequency: number; // versions per day
  }> {
    const history = await this.listVersions(bucket, key);

    if (history.versions.length === 0) {
      return {
        totalVersions: 0,
        totalSize: 0,
        averageSize: 0,
        sizeGrowth: 0,
        modificationFrequency: 0,
      };
    }

    const totalVersions = history.versions.length;
    const totalSize = history.totalSize;
    const averageSize = totalSize / totalVersions;

    const oldestVersion = history.versions[totalVersions - 1];
    const newestVersion = history.versions[0];

    const sizeGrowth = newestVersion.size - oldestVersion.size;

    const timeSpan = newestVersion.lastModified.getTime() - oldestVersion.lastModified.getTime();
    const daysSinceCreation = timeSpan / (1000 * 60 * 60 * 24);
    const modificationFrequency = daysSinceCreation > 0 ? totalVersions / daysSinceCreation : 0;

    return {
      totalVersions,
      totalSize,
      averageSize,
      oldestVersion,
      newestVersion,
      sizeGrowth,
      modificationFrequency,
    };
  }

  /**
   * Get version statistics for bucket
   */
  async getBucketVersionStatistics(bucket: string, prefix?: string): Promise<{
    totalFiles: number;
    totalVersions: number;
    totalSize: number;
    averageVersionsPerFile: number;
    largestVersionedFile?: {
      key: string;
      versions: number;
      size: number;
    };
  }> {
    const files = await this.adapter.listFiles(bucket, { prefix });

    let totalVersions = 0;
    let totalSize = 0;
    let largestVersionedFile: {
      key: string;
      versions: number;
      size: number;
    } | undefined;

    for (const file of files.objects) {
      const stats = await this.getVersionStatistics(bucket, file.key);
      totalVersions += stats.totalVersions;
      totalSize += stats.totalSize;

      if (!largestVersionedFile || stats.totalSize > largestVersionedFile.size) {
        largestVersionedFile = {
          key: file.key,
          versions: stats.totalVersions,
          size: stats.totalSize,
        };
      }
    }

    return {
      totalFiles: files.objects.length,
      totalVersions,
      totalSize,
      averageVersionsPerFile: files.objects.length > 0 ? totalVersions / files.objects.length : 0,
      largestVersionedFile,
    };
  }

  // ============================================================================
  // Version Search
  // ============================================================================

  /**
   * Find versions by date range
   */
  async findVersionsByDateRange(
    bucket: string,
    key: string,
    startDate: Date,
    endDate: Date
  ): Promise<FileVersion[]> {
    const history = await this.listVersions(bucket, key);

    return history.versions.filter(
      v => v.lastModified >= startDate && v.lastModified <= endDate
    );
  }

  /**
   * Find versions by size range
   */
  async findVersionsBySizeRange(
    bucket: string,
    key: string,
    minSize: number,
    maxSize: number
  ): Promise<FileVersion[]> {
    const history = await this.listVersions(bucket, key);

    return history.versions.filter(
      v => v.size >= minSize && v.size <= maxSize
    );
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Enable versioning on bucket
   */
  async enableVersioning(bucket: string): Promise<void> {
    // Implementation depends on storage backend
  }

  /**
   * Disable versioning on bucket
   */
  async disableVersioning(bucket: string): Promise<void> {
    // Implementation depends on storage backend
  }

  /**
   * Suspend versioning on bucket
   */
  async suspendVersioning(bucket: string): Promise<void> {
    // Implementation depends on storage backend
  }

  /**
   * Check if versioning is enabled
   */
  async isVersioningEnabled(bucket: string): Promise<boolean> {
    const metadata = await this.adapter.getBucket(bucket);
    return metadata.versioning === 'Enabled';
  }
}
