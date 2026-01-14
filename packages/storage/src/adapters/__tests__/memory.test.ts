/**
 * Memory Storage Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStorageAdapter } from '../memory';
import type { StorageConfig, FileUploadOptions } from '../../types';

describe('MemoryStorageAdapter', () => {
  let adapter: MemoryStorageAdapter;
  let config: StorageConfig;

  beforeEach(() => {
    config = {
      backend: 'memory',
      credentials: {
        backend: 'memory',
        credentials: {},
      },
      region: 'test',
      maxRetries: 3,
    };
    adapter = new MemoryStorageAdapter(config);
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('File Operations', () => {
    it('should upload and download a file', async () => {
      const data = Buffer.from('Hello, World!');
      const metadata = await adapter.uploadFile('test-bucket', 'test.txt', data);

      expect(metadata.key).toBe('test.txt');
      expect(metadata.size).toBe(13);
      expect(metadata.bucket).toBe('test-bucket');

      const result = await adapter.downloadFile('test-bucket', 'test.txt');
      expect(result.data.toString()).toBe('Hello, World!');
      expect(result.metadata.key).toBe('test.txt');
    });

    it('should delete a file', async () => {
      const data = Buffer.from('Test data');
      await adapter.uploadFile('test-bucket', 'delete-me.txt', data);

      const result = await adapter.deleteFile('test-bucket', 'delete-me.txt');
      expect(result.deleted).toBe(true);

      const exists = await adapter.fileExists('test-bucket', 'delete-me.txt');
      expect(exists).toBe(false);
    });

    it('should copy a file', async () => {
      const data = Buffer.from('Copy test');
      await adapter.uploadFile('test-bucket', 'source.txt', data);

      const metadata = await adapter.copyFile('test-bucket', 'source.txt', {
        destinationKey: 'destination.txt',
      });

      expect(metadata.key).toBe('destination.txt');
      expect(metadata.bucket).toBe('test-bucket');

      const result = await adapter.downloadFile('test-bucket', 'destination.txt');
      expect(result.data.toString()).toBe('Copy test');
    });

    it('should move a file', async () => {
      const data = Buffer.from('Move test');
      await adapter.uploadFile('test-bucket', 'old-location.txt', data);

      const result = await adapter.moveFile('test-bucket', 'old-location.txt', {
        destinationKey: 'new-location.txt',
      });

      expect(result.sourceDeleted).toBe(true);
      expect(result.destination.key).toBe('new-location.txt');

      const exists = await adapter.fileExists('test-bucket', 'old-location.txt');
      expect(exists).toBe(false);
    });
  });

  describe('Metadata Operations', () => {
    it('should get file metadata', async () => {
      const data = Buffer.from('Metadata test');
      await adapter.uploadFile('test-bucket', 'metadata.txt', data);

      const metadata = await adapter.getFileMetadata('test-bucket', 'metadata.txt');

      expect(metadata.key).toBe('metadata.txt');
      expect(metadata.size).toBe(13);
      expect(metadata.bucket).toBe('test-bucket');
      expect(metadata.etag).toBeDefined();
      expect(metadata.lastModified).toBeInstanceOf(Date);
    });

    it('should check file existence', async () => {
      const data = Buffer.from('Exists test');
      await adapter.uploadFile('test-bucket', 'exists.txt', data);

      const exists = await adapter.fileExists('test-bucket', 'exists.txt');
      expect(exists).toBe(true);

      const notExists = await adapter.fileExists('test-bucket', 'not-exists.txt');
      expect(notExists).toBe(false);
    });
  });

  describe('List Operations', () => {
    beforeEach(async () => {
      await adapter.uploadFile('test-bucket', 'file1.txt', Buffer.from('File 1'));
      await adapter.uploadFile('test-bucket', 'file2.txt', Buffer.from('File 2'));
      await adapter.uploadFile('test-bucket', 'dir/file3.txt', Buffer.from('File 3'));
      await adapter.uploadFile('test-bucket', 'dir/subdir/file4.txt', Buffer.from('File 4'));
    });

    it('should list all files', async () => {
      const result = await adapter.listFiles('test-bucket');

      expect(result.objects.length).toBe(4);
      expect(result.count).toBe(4);
      expect(result.isTruncated).toBe(false);
    });

    it('should list files with prefix', async () => {
      const result = await adapter.listFiles('test-bucket', { prefix: 'dir/' });

      expect(result.objects.length).toBe(2);
      expect(result.objects.every(obj => obj.key.startsWith('dir/'))).toBe(true);
    });

    it('should list files with delimiter', async () => {
      const result = await adapter.listFiles('test-bucket', { delimiter: '/' });

      expect(result.objects.length).toBe(2);
      expect(result.commonPrefixes).toContain('dir/');
    });
  });

  describe('Batch Operations', () => {
    beforeEach(async () => {
      await adapter.uploadFile('test-bucket', 'file1.txt', Buffer.from('File 1'));
      await adapter.uploadFile('test-bucket', 'file2.txt', Buffer.from('File 2'));
      await adapter.uploadFile('test-bucket', 'file3.txt', Buffer.from('File 3'));
    });

    it('should batch download files', async () => {
      const result = await adapter.batchDownload(
        'test-bucket',
        ['file1.txt', 'file2.txt', 'file3.txt'],
        undefined,
        { concurrency: 2 }
      );

      expect(result.successful.length).toBe(3);
      expect(result.failed.length).toBe(0);
    });

    it('should batch delete files', async () => {
      const result = await adapter.batchDelete(
        'test-bucket',
        ['file1.txt', 'file2.txt', 'file3.txt']
      );

      expect(result.successful.length).toBe(3);
      expect(result.failed.length).toBe(0);

      const exists = await adapter.fileExists('test-bucket', 'file1.txt');
      expect(exists).toBe(false);
    });
  });

  describe('Multipart Upload', () => {
    it('should create and complete multipart upload', async () => {
      const upload = await adapter.createMultipartUpload('test-bucket', 'multipart.txt');
      expect(upload.uploadId).toBeDefined();
      expect(upload.key).toBe('multipart.txt');

      const data1 = Buffer.from('Part 1');
      const data2 = Buffer.from('Part 2');

      const part1 = await adapter.uploadPart(
        'test-bucket',
        'multipart.txt',
        upload.uploadId,
        1,
        data1
      );

      const part2 = await adapter.uploadPart(
        'test-bucket',
        'multipart.txt',
        upload.uploadId,
        2,
        data2
      );

      expect(part1.partNumber).toBe(1);
      expect(part1.etag).toBeDefined();
      expect(part2.partNumber).toBe(2);

      const metadata = await adapter.completeMultipartUpload(
        'test-bucket',
        'multipart.txt',
        upload.uploadId,
        [part1, part2]
      );

      expect(metadata.key).toBe('multipart.txt');
      expect(metadata.size).toBe(12); // "Part 1" + "Part 2"
    });

    it('should abort multipart upload', async () => {
      const upload = await adapter.createMultipartUpload('test-bucket', 'abort.txt');

      await adapter.abortMultipartUpload('test-bucket', 'abort.txt', upload.uploadId);

      const uploads = await adapter.listMultipartUploads('test-bucket');
      expect(uploads.find(u => u.uploadId === upload.uploadId)).toBeUndefined();
    });

    it('should list parts', async () => {
      const upload = await adapter.createMultipartUpload('test-bucket', 'parts.txt');

      const data = Buffer.from('Test data');
      await adapter.uploadPart('test-bucket', 'parts.txt', upload.uploadId, 1, data);

      const parts = await adapter.listParts('test-bucket', 'parts.txt', upload.uploadId);
      expect(parts.length).toBe(1);
      expect(parts[0].partNumber).toBe(1);
    });
  });

  describe('Bucket Operations', () => {
    it('should create a bucket', async () => {
      await adapter.createBucket({ name: 'new-bucket' });

      const exists = await adapter.bucketExists('new-bucket');
      expect(exists).toBe(true);
    });

    it('should list buckets', async () => {
      await adapter.createBucket({ name: 'bucket1' });
      await adapter.createBucket({ name: 'bucket2' });

      const buckets = await adapter.listBuckets();
      expect(buckets.length).toBeGreaterThanOrEqual(2);
    });

    it('should get bucket metadata', async () => {
      await adapter.uploadFile('test-bucket', 'file.txt', Buffer.from('Test'));

      const metadata = await adapter.getBucket('test-bucket');
      expect(metadata.name).toBe('test-bucket');
      expect(metadata.objectCount).toBe(1);
    });

    it('should delete a bucket', async () => {
      await adapter.createBucket({ name: 'delete-bucket' });

      await adapter.deleteBucket('delete-bucket');

      const exists = await adapter.bucketExists('delete-bucket');
      expect(exists).toBe(false);
    });

    it('should empty a bucket', async () => {
      await adapter.uploadFile('test-bucket', 'file1.txt', Buffer.from('File 1'));
      await adapter.uploadFile('test-bucket', 'file2.txt', Buffer.from('File 2'));

      await adapter.emptyBucket('test-bucket');

      const result = await adapter.listFiles('test-bucket');
      expect(result.objects.length).toBe(0);
    });
  });

  describe('Tagging Operations', () => {
    it('should set and get object tags', async () => {
      await adapter.uploadFile('test-bucket', 'tagged.txt', Buffer.from('Tagged'));

      await adapter.setObjectTags('test-bucket', 'tagged.txt', {
        tag1: 'value1',
        tag2: 'value2',
      });

      const tags = await adapter.getObjectTags('test-bucket', 'tagged.txt');
      expect(tags.tag1).toBe('value1');
      expect(tags.tag2).toBe('value2');
    });

    it('should delete object tags', async () => {
      await adapter.uploadFile('test-bucket', 'tagged.txt', Buffer.from('Tagged'));
      await adapter.setObjectTags('test-bucket', 'tagged.txt', { tag1: 'value1' });

      await adapter.deleteObjectTags('test-bucket', 'tagged.txt');

      const tags = await adapter.getObjectTags('test-bucket', 'tagged.txt');
      expect(tags).toEqual({});
    });
  });

  describe('Utility Methods', () => {
    it('should generate presigned URL', async () => {
      const url = await adapter.generatePresignedUrl('test-bucket', 'file.txt');

      expect(url).toContain('memory://');
      expect(url).toContain('test-bucket');
      expect(url).toContain('file.txt');
    });

    it('should get backend type', () => {
      expect(adapter.getBackend()).toBe('memory');
    });
  });

  describe('Memory-Specific Features', () => {
    it('should clear all data', async () => {
      await adapter.uploadFile('test-bucket', 'file.txt', Buffer.from('Test'));
      adapter['clear']();

      const exists = await adapter.fileExists('test-bucket', 'file.txt');
      expect(exists).toBe(false);
    });

    it('should get total size', async () => {
      await adapter.uploadFile('test-bucket', 'file1.txt', Buffer.from('Test'));
      await adapter.uploadFile('test-bucket', 'file2.txt', Buffer.from('Longer test data'));

      const totalSize = adapter['getTotalSize']();
      expect(totalSize).toBe(22); // 4 + 18
    });

    it('should get total file count', async () => {
      await adapter.uploadFile('test-bucket', 'file1.txt', Buffer.from('Test'));
      await adapter.uploadFile('test-bucket', 'file2.txt', Buffer.from('Test'));

      const count = adapter['getTotalFileCount']();
      expect(count).toBe(2);
    });
  });
});
