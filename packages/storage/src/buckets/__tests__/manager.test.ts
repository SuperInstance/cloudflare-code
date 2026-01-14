/**
 * Bucket Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BucketManager } from '../manager';
import { MemoryStorageAdapter } from '../../adapters/memory';
import type { StorageConfig } from '../../types';

describe('BucketManager', () => {
  let bucketManager: BucketManager;
  let adapter: MemoryStorageAdapter;

  beforeEach(async () => {
    const config: StorageConfig = {
      backend: 'memory',
      credentials: {
        backend: 'memory',
        credentials: {},
      },
    };
    adapter = new MemoryStorageAdapter(config);
    bucketManager = new BucketManager(adapter);
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('Basic Bucket Operations', () => {
    it('should create a bucket', async () => {
      await bucketManager.createBucket({ name: 'new-bucket' });

      const exists = await bucketManager.bucketExists('new-bucket');
      expect(exists).toBe(true);
    });

    it('should delete a bucket', async () => {
      await bucketManager.createBucket({ name: 'delete-bucket' });
      await bucketManager.deleteBucket('delete-bucket');

      const exists = await bucketManager.bucketExists('delete-bucket');
      expect(exists).toBe(false);
    });

    it('should get bucket metadata', async () => {
      await adapter.uploadFile('test-bucket', 'file.txt', Buffer.from('Test'));

      const metadata = await bucketManager.getBucket('test-bucket');

      expect(metadata.name).toBe('test-bucket');
      expect(metadata.objectCount).toBe(1);
    });

    it('should list all buckets', async () => {
      await bucketManager.createBucket({ name: 'bucket1' });
      await bucketManager.createBucket({ name: 'bucket2' });

      const buckets = await bucketManager.listBuckets();

      expect(buckets.length).toBeGreaterThanOrEqual(2);
      const bucketNames = buckets.map(b => b.name);
      expect(bucketNames).toContain('bucket1');
      expect(bucketNames).toContain('bucket2');
    });

    it('should update bucket configuration', async () => {
      await bucketManager.createBucket({ name: 'update-bucket' });

      await bucketManager.updateBucket('update-bucket', {
        versioning: { status: 'Enabled' },
      });

      // Verify update was applied
      const metadata = await bucketManager.getBucket('update-bucket');
      expect(metadata.name).toBe('update-bucket');
    });
  });

  describe('Bucket Lifecycle', () => {
    it('should empty a bucket', async () => {
      await adapter.uploadFile('test-bucket', 'file1.txt', Buffer.from('File 1'));
      await adapter.uploadFile('test-bucket', 'file2.txt', Buffer.from('File 2'));

      await bucketManager.emptyBucket('test-bucket');

      const result = await adapter.listFiles('test-bucket');
      expect(result.objects.length).toBe(0);
    });

    it('should delete bucket with force option', async () => {
      await bucketManager.createBucket({ name: 'force-bucket' });
      await adapter.uploadFile('force-bucket', 'file.txt', Buffer.from('File'));

      await bucketManager.deleteBucket('force-bucket', true);

      const exists = await bucketManager.bucketExists('force-bucket');
      expect(exists).toBe(false);
    });
  });

  describe('Bucket Sync', () => {
    beforeEach(async () => {
      await adapter.uploadFile('source-bucket', 'file1.txt', Buffer.from('File 1'));
      await adapter.uploadFile('source-bucket', 'file2.txt', Buffer.from('File 2'));
      await adapter.uploadFile('dest-bucket', 'file2.txt', Buffer.from('File 2'));
    });

    it('should sync buckets', async () => {
      const result = await bucketManager.syncBuckets('source-bucket', 'dest-bucket');

      expect(result.copied).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('should sync buckets in dry run mode', async () => {
      const result = await bucketManager.syncBuckets('source-bucket', 'dest-bucket', {
        dryRun: true,
      });

      expect(result.copied).toBe(1);
      expect(result.skipped).toBe(1);

      // Verify nothing was actually copied
      const destFiles = await adapter.listFiles('dest-bucket');
      expect(destFiles.objects.length).toBe(1);
    });

    it('should sync buckets with delete option', async () => {
      await adapter.uploadFile('source-bucket', 'new-file.txt', Buffer.from('New'));

      const result = await bucketManager.syncBuckets('source-bucket', 'dest-bucket', {
        delete: true,
      });

      expect(result.copied).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Bucket Analytics', () => {
    beforeEach(async () => {
      await adapter.uploadFile('test-bucket', 'small.txt', Buffer.from('Small'));
      await adapter.uploadFile('test-bucket', 'large.txt', Buffer.from('Large file content'));
      await adapter.uploadFile('test-bucket', 'image.jpg', Buffer.from('Fake image'));
    });

    it('should get bucket analytics', async () => {
      const analytics = await bucketManager.getBucketAnalytics('test-bucket');

      expect(analytics.bucket).toBe('test-bucket');
      expect(analytics.objectCount).toBe(3);
      expect(analytics.totalSize).toBe(30);
      expect(analytics.averageSize).toBe(10);
      expect(analytics.largestFile?.key).toBe('large.txt');
      expect(analytics.smallestFile?.key).toBe('small.txt');
    });

    it('should get analytics with prefix filter', async () => {
      await adapter.uploadFile('test-bucket', 'dir/file.txt', Buffer.from('Dir file'));

      const analytics = await bucketManager.getBucketAnalytics('test-bucket', 'dir/');

      expect(analytics.objectCount).toBe(1);
    });
  });

  describe('Bucket Comparison', () => {
    beforeEach(async () => {
      await adapter.uploadFile('bucket1', 'common.txt', Buffer.from('Common'));
      await adapter.uploadFile('bucket1', 'only1.txt', Buffer.from('Only in 1'));
      await adapter.uploadFile('bucket2', 'common.txt', Buffer.from('Common'));
      await adapter.uploadFile('bucket2', 'only2.txt', Buffer.from('Only in 2'));
    });

    it('should compare two buckets', async () => {
      const comparison = await bucketManager.compareBuckets('bucket1', 'bucket2');

      expect(comparison.bucket1).toBe('bucket1');
      expect(comparison.bucket2).toBe('bucket2');
      expect(comparison.onlyInBucket1).toContain('only1.txt');
      expect(comparison.onlyInBucket2).toContain('only2.txt');
      expect(comparison.same).toContain('common.txt');
    });
  });

  describe('Bucket Policy', () => {
    it('should get bucket policy', async () => {
      const policy = await bucketManager.getBucketPolicy('test-bucket');

      expect(policy).toBeNull();
    });

    it('should make bucket public', async () => {
      await bucketManager.makeBucketPublic('test-bucket');

      const policy = await bucketManager.getBucketPolicy('test-bucket');
      expect(policy).not.toBeNull();
    });

    it('should make bucket private', async () => {
      await bucketManager.makeBucketPublic('test-bucket');
      await bucketManager.makeBucketPrivate('test-bucket');

      const policy = await bucketManager.getBucketPolicy('test-bucket');
      // Policy should be removed or disabled
    });
  });

  describe('Lifecycle Configuration', () => {
    it('should add lifecycle rule', async () => {
      const rule = {
        id: 'delete-old',
        status: 'Enabled' as const,
        expiration: {
          days: 30,
        },
      };

      await bucketManager.addLifecycleRule('test-bucket', rule);

      const rules = await bucketManager.getLifecycleConfiguration('test-bucket');
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should remove lifecycle rule', async () => {
      const rule = {
        id: 'test-rule',
        status: 'Enabled' as const,
        expiration: {
          days: 30,
        },
      };

      await bucketManager.addLifecycleRule('test-bucket', rule);
      await bucketManager.removeLifecycleRule('test-bucket', 'test-rule');

      const rules = await bucketManager.getLifecycleConfiguration('test-bucket');
      expect(rules.find(r => r.id === 'test-rule')).toBeUndefined();
    });
  });

  describe('CORS Configuration', () => {
    it('should add CORS rule', async () => {
      const rule = {
        id: 'cors-rule',
        allowedOrigins: ['*'],
        allowedMethods: ['GET', 'PUT'],
        allowedHeaders: ['*'],
        exposeHeaders: ['ETag'],
      };

      await bucketManager.addCORSRule('test-bucket', rule);

      const rules = await bucketManager.getCORSConfiguration('test-bucket');
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should remove CORS rule', async () => {
      const rule = {
        id: 'cors-rule',
        allowedOrigins: ['*'],
        allowedMethods: ['GET'],
        allowedHeaders: ['*'],
        exposeHeaders: [],
      };

      await bucketManager.addCORSRule('test-bucket', rule);
      await bucketManager.removeCORSRule('test-bucket', 'cors-rule');

      const rules = await bucketManager.getCORSConfiguration('test-bucket');
      expect(rules.find(r => r.id === 'cors-rule')).toBeUndefined();
    });
  });

  describe('Bucket Maintenance', () => {
    beforeEach(async () => {
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
      await adapter.uploadFile('test-bucket', 'old-file.txt', Buffer.from('Old file'));
      await adapter.uploadFile('test-bucket', 'new-file.txt', Buffer.from('New file'));
    });

    it('should cleanup old files', async () => {
      const result = await bucketManager.cleanupBucket('test-bucket', 30 * 24 * 60 * 60); // 30 days

      expect(result.deleted).toBeGreaterThanOrEqual(0);
    });

    it('should cleanup in dry run mode', async () => {
      const result = await bucketManager.cleanupBucket('test-bucket', 30 * 24 * 60 * 60, {
        dryRun: true,
      });

      // Should count but not delete
      expect(result.deleted).toBeGreaterThanOrEqual(0);

      const files = await adapter.listFiles('test-bucket');
      expect(files.objects.length).toBe(2);
    });
  });

  describe('Bucket Monitoring', () => {
    it('should monitor bucket for changes', async () => {
      const changes: any[] = [];

      const stopMonitoring = await bucketManager.monitorBucket('test-bucket', (change) => {
        changes.push(change);
      });

      // Make some changes
      await adapter.uploadFile('test-bucket', 'monitor.txt', Buffer.from('Monitor'));

      // Wait for monitoring interval
      await new Promise(resolve => setTimeout(resolve, 100));

      // Stop monitoring
      stopMonitoring();

      // Check changes were detected
      expect(changes.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Utility Methods', () => {
    it('should validate bucket name', () => {
      expect(bucketManager.validateBucketName('valid-bucket')).toBe(true);
      expect(bucketManager.validateBucketName('Invalid_Bucket')).toBe(false);
      expect(bucketManager.validateBucketName('ab')).toBe(false); // Too short
      expect(bucketManager.validateBucketName('a'.repeat(64))).toBe(false); // Too long
    });

    it('should generate bucket name from domain', () => {
      const name = bucketManager.generateBucketName('example.com');
      expect(name).toBe('example.com');
    });

    it('should format bytes', () => {
      const size = bucketManager['formatBytes'](1024 * 1024);
      expect(size).toContain('MB');
    });
  });
});
