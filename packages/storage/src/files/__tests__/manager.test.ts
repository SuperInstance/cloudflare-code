/**
 * File Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileManager } from '../manager';
import { MemoryStorageAdapter } from '../../adapters/memory';
import type { StorageConfig } from '../../types';

describe('FileManager', () => {
  let fileManager: FileManager;
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
    fileManager = new FileManager(adapter);
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('Basic File Operations', () => {
    it('should upload and download a file', async () => {
      const data = Buffer.from('Test file content');
      const metadata = await fileManager.uploadFile('test-bucket', 'test.txt', data);

      expect(metadata.key).toBe('test.txt');
      expect(metadata.size).toBe(17);

      const result = await fileManager.downloadFile('test-bucket', 'test.txt');
      expect(result.data.toString()).toBe('Test file content');
    });

    it('should copy a file', async () => {
      const data = Buffer.from('Copy test');
      await fileManager.uploadFile('test-bucket', 'source.txt', data);

      const metadata = await fileManager.copyFile('test-bucket', 'source.txt', {
        destinationKey: 'dest.txt',
      });

      expect(metadata.key).toBe('dest.txt');
    });

    it('should move a file', async () => {
      const data = Buffer.from('Move test');
      await fileManager.uploadFile('test-bucket', 'old.txt', data);

      const result = await fileManager.moveFile('test-bucket', 'old.txt', {
        destinationKey: 'new.txt',
      });

      expect(result.sourceDeleted).toBe(true);
      expect(result.destination.key).toBe('new.txt');
    });

    it('should delete a file', async () => {
      const data = Buffer.from('Delete test');
      await fileManager.uploadFile('test-bucket', 'delete.txt', data);

      const result = await fileManager.deleteFile('test-bucket', 'delete.txt');
      expect(result.deleted).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    beforeEach(async () => {
      await fileManager.uploadFile('test-bucket', 'file1.txt', Buffer.from('File 1'));
      await fileManager.uploadFile('test-bucket', 'file2.txt', Buffer.from('File 2'));
      await fileManager.uploadFile('test-bucket', 'file3.txt', Buffer.from('File 3'));
    });

    it('should batch upload files', async () => {
      const files = [
        { key: 'batch1.txt', data: Buffer.from('Batch 1') },
        { key: 'batch2.txt', data: Buffer.from('Batch 2') },
      ];

      const result = await fileManager.batchUpload('test-bucket', files);

      expect(result.successful.length).toBe(2);
      expect(result.failed.length).toBe(0);
    });

    it('should batch download files', async () => {
      const result = await fileManager.batchDownload(
        'test-bucket',
        ['file1.txt', 'file2.txt', 'file3.txt']
      );

      expect(result.successful.length).toBe(3);
      expect(result.failed.length).toBe(0);
    });

    it('should batch delete files', async () => {
      const result = await fileManager.batchDelete(
        'test-bucket',
        ['file1.txt', 'file2.txt']
      );

      expect(result.successful.length).toBe(2);
      expect(result.failed.length).toBe(0);
    });

    it('should batch copy files', async () => {
      const operations = [
        { key: 'file1.txt', options: { destinationKey: 'copy1.txt' } },
        { key: 'file2.txt', options: { destinationKey: 'copy2.txt' } },
      ];

      const result = await fileManager.batchCopy('test-bucket', operations);

      expect(result.successful.length).toBe(2);
      expect(result.failed.length).toBe(0);
    });

    it('should batch move files', async () => {
      const operations = [
        { key: 'file1.txt', options: { destinationKey: 'move1.txt' } },
        { key: 'file2.txt', options: { destinationKey: 'move2.txt' } },
      ];

      const result = await fileManager.batchMove('test-bucket', operations);

      expect(result.successful.length).toBe(2);
      expect(result.failed.length).toBe(0);
    });
  });

  describe('File Search', () => {
    beforeEach(async () => {
      await fileManager.uploadFile('test-bucket', 'file1.txt', Buffer.from('File 1'));
      await fileManager.uploadFile('test-bucket', 'file2.jpg', Buffer.from('File 2'));
      await fileManager.uploadFile('test-bucket', 'doc.txt', Buffer.from('Doc'));
      await fileManager.uploadFile('test-bucket', 'dir/file3.txt', Buffer.from('File 3'));
    });

    it('should search by prefix', async () => {
      const results = await fileManager.searchFiles('test-bucket', { prefix: 'file' });

      expect(results.length).toBe(2);
      expect(results.every(f => f.key.startsWith('file'))).toBe(true);
    });

    it('should search by suffix', async () => {
      const results = await fileManager.searchFiles('test-bucket', { suffix: '.txt' });

      expect(results.length).toBe(3);
      expect(results.every(f => f.key.endsWith('.txt'))).toBe(true);
    });

    it('should search by content type', async () => {
      const results = await fileManager.searchFiles('test-bucket', {
        contentType: 'text/plain',
      });

      expect(results.length).toBe(3);
    });

    it('should search by size range', async () => {
      const results = await fileManager.searchFiles('test-bucket', {
        minSize: 6,
        maxSize: 10,
      });

      expect(results.length).toBe(2);
    });

    it('should limit results', async () => {
      const results = await fileManager.searchFiles('test-bucket', { limit: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('File Metadata', () => {
    it('should get file metadata', async () => {
      await fileManager.uploadFile('test-bucket', 'metadata.txt', Buffer.from('Metadata'));

      const metadata = await fileManager.getFileMetadata('test-bucket', 'metadata.txt');

      expect(metadata.key).toBe('metadata.txt');
      expect(metadata.size).toBe(8);
      expect(metadata.bucket).toBe('test-bucket');
    });

    it('should update file metadata', async () => {
      await fileManager.uploadFile('test-bucket', 'update.txt', Buffer.from('Update'));

      const updated = await fileManager.updateFileMetadata('test-bucket', 'update.txt', {
        customMetadata: { custom: 'value' },
      });

      expect(updated.customMetadata?.custom).toBe('value');
    });
  });

  describe('File Tagging', () => {
    it('should set and get file tags', async () => {
      await fileManager.uploadFile('test-bucket', 'tagged.txt', Buffer.from('Tagged'));

      await fileManager.setFileTags('test-bucket', 'tagged.txt', {
        tag1: 'value1',
        tag2: 'value2',
      });

      const tags = await fileManager.getFileTags('test-bucket', 'tagged.txt');
      expect(tags.tag1).toBe('value1');
      expect(tags.tag2).toBe('value2');
    });

    it('should add file tag', async () => {
      await fileManager.uploadFile('test-bucket', 'tag.txt', Buffer.from('Tag'));
      await fileManager.addFileTag('test-bucket', 'tag.txt', 'new-tag', 'new-value');

      const tags = await fileManager.getFileTags('test-bucket', 'tag.txt');
      expect(tags['new-tag']).toBe('new-value');
    });

    it('should remove file tag', async () => {
      await fileManager.uploadFile('test-bucket', 'tag.txt', Buffer.from('Tag'));
      await fileManager.setFileTags('test-bucket', 'tag.txt', { tag1: 'value1' });
      await fileManager.removeFileTag('test-bucket', 'tag.txt', 'tag1');

      const tags = await fileManager.getFileTags('test-bucket', 'tag.txt');
      expect(tags.tag1).toBeUndefined();
    });

    it('should delete file tags', async () => {
      await fileManager.uploadFile('test-bucket', 'tag.txt', Buffer.from('Tag'));
      await fileManager.setFileTags('test-bucket', 'tag.txt', { tag1: 'value1' });
      await fileManager.deleteFileTags('test-bucket', 'tag.txt');

      const tags = await fileManager.getFileTags('test-bucket', 'tag.txt');
      expect(tags).toEqual({});
    });
  });

  describe('File Existence', () => {
    it('should check if file exists', async () => {
      await fileManager.uploadFile('test-bucket', 'exists.txt', Buffer.from('Exists'));

      const exists = await fileManager.fileExists('test-bucket', 'exists.txt');
      expect(exists).toBe(true);

      const notExists = await fileManager.fileExists('test-bucket', 'not-exists.txt');
      expect(notExists).toBe(false);
    });

    it('should check if multiple files exist', async () => {
      await fileManager.uploadFile('test-bucket', 'file1.txt', Buffer.from('File 1'));
      await fileManager.uploadFile('test-bucket', 'file2.txt', Buffer.from('File 2'));

      const existence = await fileManager.filesExist('test-bucket', [
        'file1.txt',
        'file2.txt',
        'file3.txt',
      ]);

      expect(existence.get('file1.txt')).toBe(true);
      expect(existence.get('file2.txt')).toBe(true);
      expect(existence.get('file3.txt')).toBe(false);
    });
  });

  describe('Presigned URLs', () => {
    it('should generate presigned URL', async () => {
      await fileManager.uploadFile('test-bucket', 'url.txt', Buffer.from('URL'));

      const url = await fileManager.generatePresignedUrl('test-bucket', 'url.txt');

      expect(url).toContain('memory://');
      expect(url).toContain('url.txt');
    });

    it('should generate multiple presigned URLs', async () => {
      await fileManager.uploadFile('test-bucket', 'file1.txt', Buffer.from('File 1'));
      await fileManager.uploadFile('test-bucket', 'file2.txt', Buffer.from('File 2'));

      const urls = await fileManager.generatePresignedUrls('test-bucket', [
        'file1.txt',
        'file2.txt',
      ]);

      expect(urls.size).toBe(2);
      expect(urls.get('file1.txt')).toContain('file1.txt');
      expect(urls.get('file2.txt')).toContain('file2.txt');
    });
  });

  describe('File Statistics', () => {
    beforeEach(async () => {
      await fileManager.uploadFile('test-bucket', 'small.txt', Buffer.from('Small'));
      await fileManager.uploadFile('test-bucket', 'large.txt', Buffer.from('Large file content'));
      await fileManager.uploadFile('test-bucket', 'medium.txt', Buffer.from('Medium file'));
    });

    it('should calculate total size', async () => {
      const totalSize = await fileManager.calculateTotalSize('test-bucket');

      expect(totalSize).toBe(30); // 5 + 17 + 8
    });

    it('should get file statistics', async () => {
      const stats = await fileManager.getFileStatistics('test-bucket');

      expect(stats.totalFiles).toBe(3);
      expect(stats.totalSize).toBe(30);
      expect(stats.averageSize).toBe(10);
      expect(stats.largestFile?.key).toBe('large.txt');
      expect(stats.smallestFile?.key).toBe('small.txt');
      expect(stats.byContentType['text/plain']).toBe(3);
    });
  });

  describe('Duplicate Detection', () => {
    it('should find duplicate files', async () => {
      const data = Buffer.from('Duplicate');
      await fileManager.uploadFile('test-bucket', 'file1.txt', data);
      await fileManager.uploadFile('test-bucket', 'file2.txt', data);
      await fileManager.uploadFile('test-bucket', 'file3.txt', Buffer.from('Unique'));

      const duplicates = await fileManager.findDuplicates('test-bucket');

      expect(duplicates.size).toBe(1);
      const duplicateFiles = duplicates.get(duplicates.keys().next().value)!;
      expect(duplicateFiles.length).toBe(2);
    });
  });

  describe('Utility Methods', () => {
    it('should get human-readable size', () => {
      expect(fileManager.getHumanReadableSize(1024)).toBe('1 KB');
      expect(fileManager.getHumanReadableSize(1024 * 1024)).toBe('1 MB');
      expect(fileManager.getHumanReadableSize(1536)).toBe('1.5 KB');
    });

    it('should get file URL', async () => {
      await fileManager.uploadFile('test-bucket', 'url.txt', Buffer.from('URL'));

      const url = await fileManager.getFileUrl('test-bucket', 'url.txt');

      expect(url).toContain('url.txt');
    });
  });
});
