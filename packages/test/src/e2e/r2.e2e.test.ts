/**
 * R2 E2E Tests
 *
 * Comprehensive tests for R2 bucket operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createR2Fixture, createCommonR2Objects } from '../fixtures/r2-fixture';

describe('R2 E2E Tests', () => {
  let fixture: ReturnType<typeof createR2Fixture>;

  beforeEach(() => {
    fixture = createR2Fixture();
  });

  afterEach(() => {
    fixture.clear();
  });

  describe('Basic Operations', () => {
    it('should put and get object', async () => {
      const r2 = fixture.createBucket();

      const content = new TextEncoder().encode('Hello, R2!');
      await r2.put('test-file.txt', content);

      const object = await r2.get('test-file.txt');

      expect(object).toBeDefined();
      expect(object?.key).toBe('test-file.txt');
    });

    it('should delete object', async () => {
      const r2 = fixture.createBucket();

      const content = new TextEncoder().encode('Hello, R2!');
      await r2.put('test-file.txt', content);
      await r2.delete('test-file.txt');

      const object = await r2.get('test-file.txt');

      expect(object).toBeNull();
    });

    it('should return null for non-existent object', async () => {
      const r2 = fixture.createBucket();

      const object = await r2.get('non-existent.txt');

      expect(object).toBeNull();
    });

    it('should head object', async () => {
      const r2 = fixture.createBucket();

      const content = new TextEncoder().encode('Hello, R2!');
      await r2.put('test-file.txt', content);

      const object = await r2.head('test-file.txt');

      expect(object).toBeDefined();
      expect(object?.key).toBe('test-file.txt');
    });
  });

  describe('Metadata Operations', () => {
    it('should store custom metadata', async () => {
      const r2 = fixture.createBucket();

      const content = new TextEncoder().encode('Hello, R2!');
      const metadata = {
        contentType: 'text/plain',
        uploadedBy: 'test-user',
      };

      await r2.put('test-file.txt', content, {
        customMetadata: metadata,
      });

      const object = await r2.get('test-file.txt');

      expect(object?.customMetadata).toEqual(metadata);
    });

    it('should store HTTP metadata', async () => {
      const r2 = fixture.createBucket();

      const content = new TextEncoder().encode('Hello, R2!');
      const httpMetadata: R2HTTPMetadata = {
        contentType: 'text/plain',
        contentLanguage: 'en',
        cacheControl: 'max-age=3600',
        contentDisposition: 'inline',
      };

      await r2.put('test-file.txt', content, {
        httpMetadata,
      });

      const object = await r2.get('test-file.txt');

      expect(object?.httpMetadata).toEqual(httpMetadata);
    });
  });

  describe('List Operations', () => {
    beforeEach(() => {
      const objects = [
        {
          key: 'prefix/file1.txt',
          value: new TextEncoder().encode('content1'),
        },
        {
          key: 'prefix/file2.txt',
          value: new TextEncoder().encode('content2'),
        },
        {
          key: 'prefix/file3.txt',
          value: new TextEncoder().encode('content3'),
        },
        {
          key: 'other/file1.txt',
          value: new TextEncoder().encode('content4'),
        },
      ];
      fixture.seed(objects);
    });

    it('should list all objects', async () => {
      const r2 = fixture.createBucket();

      const result = await r2.list();

      expect(result.objects).toHaveLength(4);
      expect(result.truncated).toBe(false);
    });

    it('should list objects with prefix', async () => {
      const r2 = fixture.createBucket();

      const result = await r2.list({ prefix: 'prefix/' });

      expect(result.objects).toHaveLength(3);
      expect(result.objects.every(obj => obj.key.startsWith('prefix/'))).toBe(true);
    });

    it('should list objects with limit', async () => {
      const r2 = fixture.createBucket();

      const result = await r2.list({ limit: 2 });

      expect(result.objects).toHaveLength(2);
    });

    it('should support pagination with cursor', async () => {
      const r2 = fixture.createBucket();

      const page1 = await r2.list({ limit: 2 });
      expect(page1.objects).toHaveLength(2);
      expect(page1.truncated).toBe(true);

      const page2 = await r2.list({ limit: 2, cursor: page1.cursor });
      expect(page2.objects).toHaveLength(2);
    });
  });

  describe('Batch Operations', () => {
    it('should delete multiple objects', async () => {
      const r2 = fixture.createBucket();

      for (let i = 0; i < 10; i++) {
        await r2.put(`file-${i}.txt`, new TextEncoder().encode(`content-${i}`));
      }

      await r2.delete(['file-0.txt', 'file-1.txt', 'file-2.txt']);

      expect(fixture.size()).toBe(7);
    });

    it('should handle multiple put operations', async () => {
      const r2 = fixture.createBucket();

      const promises = [];
      for (let i = 0; i < 100; i++) {
        const content = new TextEncoder().encode(`content-${i}`);
        promises.push(r2.put(`file-${i}.txt`, content));
      }

      await Promise.all(promises);

      expect(fixture.size()).toBe(100);
    });

    it('should handle multiple get operations', async () => {
      const r2 = fixture.createBucket();

      for (let i = 0; i < 100; i++) {
        const content = new TextEncoder().encode(`content-${i}`);
        await r2.put(`file-${i}.txt`, content);
      }

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(r2.get(`file-${i}.txt`));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      expect(results.every(r => r !== null)).toBe(true);
    });
  });

  describe('Large Objects', () => {
    it('should handle large files', async () => {
      const r2 = fixture.createBucket();

      const largeContent = new Uint8Array(10 * 1024 * 1024); // 10MB
      crypto.getRandomValues(largeContent);

      await r2.put('large-file.bin', largeContent);

      const object = await r2.get('large-file.bin');

      expect(object).toBeDefined();
      expect(object?.size).toBe(10 * 1024 * 1024);
    });

    it('should handle many small files', async () => {
      const r2 = fixture.createBucket();

      const promises = [];
      for (let i = 0; i < 1000; i++) {
        const content = new TextEncoder().encode(`small-file-${i}`);
        promises.push(r2.put(`file-${i}.txt`, content));
      }

      await Promise.all(promises);

      const result = await r2.list();

      expect(result.objects).toHaveLength(1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty object', async () => {
      const r2 = fixture.createBucket();

      const emptyContent = new Uint8Array(0);
      await r2.put('empty-file.txt', emptyContent);

      const object = await r2.get('empty-file.txt');

      expect(object).toBeDefined();
      expect(object?.size).toBe(0);
    });

    it('should handle special characters in keys', async () => {
      const r2 = fixture.createBucket();

      const specialKeys = [
        'path/with/slashes/file.txt',
        'path:with:colons:file.txt',
        'path-with-dashes-file.txt',
        'path_with_underscores_file.txt',
        'path.with.dots.file.txt',
        'path with spaces file.txt',
      ];

      for (const key of specialKeys) {
        const content = new TextEncoder().encode('test');
        await r2.put(key, content);
      }

      for (const key of specialKeys) {
        const object = await r2.get(key);
        expect(object).toBeDefined();
      }
    });

    it('should handle unicode in keys and metadata', async () => {
      const r2 = fixture.createBucket();

      const content = new TextEncoder().encode('Hello 世界 🌍');
      await r2.put('unicode-文件.txt', content, {
        customMetadata: {
          description: 'Test file with unicode 中文',
        },
      });

      const object = await r2.get('unicode-文件.txt');

      expect(object).toBeDefined();
      expect(object?.customMetadata?.description).toContain('中文');
    });
  });

  describe('Common Objects', () => {
    it('should load common R2 objects', async () => {
      const objects = createCommonR2Objects();
      fixture.seed(objects);

      expect(fixture.size()).toBeGreaterThan(0);

      const r2 = fixture.createBucket();
      const docObject = await r2.get('test/document.txt');

      expect(docObject).toBeDefined();
    });

    it('should access codebase files', async () => {
      const objects = createCommonR2Objects();
      fixture.seed(objects);

      const r2 = fixture.createBucket();
      const codeObject = await r2.get('codebase/index.ts');

      expect(codeObject).toBeDefined();
      expect(codeObject?.customMetadata?.language).toBe('typescript');
    });
  });

  describe('Performance Tests', () => {
    it('should handle 1000 put operations efficiently', async () => {
      const r2 = fixture.createBucket();

      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        const content = new TextEncoder().encode(`content-${i}`);
        await r2.put(`file-${i}.txt`, content);
      }

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10000); // Should complete in < 10s
      expect(fixture.size()).toBe(1000);
    });

    it('should handle 1000 get operations efficiently', async () => {
      const r2 = fixture.createBucket();

      for (let i = 0; i < 1000; i++) {
        const content = new TextEncoder().encode(`content-${i}`);
        await r2.put(`file-${i}.txt`, content);
      }

      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        await r2.get(`file-${i}.txt`);
      }

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10000); // Should complete in < 10s
    });

    it('should handle large list operations efficiently', async () => {
      const r2 = fixture.createBucket();

      for (let i = 0; i < 1000; i++) {
        const content = new TextEncoder().encode(`content-${i}`);
        await r2.put(`dir-${Math.floor(i / 100)}/file-${i}.txt`, content);
      }

      const start = Date.now();

      const result = await r2.list({ limit: 1000 });

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // Should complete in < 5s
      expect(result.objects).toBeDefined();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent puts', async () => {
      const r2 = fixture.createBucket();

      const promises = [];
      for (let i = 0; i < 100; i++) {
        const content = new TextEncoder().encode(`content-${i}`);
        promises.push(r2.put(`concurrent-${i}.txt`, content));
      }

      await Promise.all(promises);

      expect(fixture.size()).toBe(100);
    });

    it('should handle concurrent gets', async () => {
      const r2 = fixture.createBucket();

      for (let i = 0; i < 100; i++) {
        const content = new TextEncoder().encode(`content-${i}`);
        await r2.put(`file-${i}.txt`, content);
      }

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(r2.get(`file-${i}.txt`));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      expect(results.every(r => r !== null)).toBe(true);
    });

    it('should handle concurrent deletes', async () => {
      const r2 = fixture.createBucket();

      for (let i = 0; i < 100; i++) {
        const content = new TextEncoder().encode(`content-${i}`);
        await r2.put(`file-${i}.txt`, content);
      }

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(r2.delete(`file-${i}.txt`));
      }

      await Promise.all(promises);

      expect(fixture.size()).toBe(0);
    });
  });
});
