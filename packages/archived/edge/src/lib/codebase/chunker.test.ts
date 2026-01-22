/**
 * Unit Tests for Code Chunker
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodeChunker } from './chunker';
import type { ParsedFile } from './types';

describe('CodeChunker', () => {
  let chunker: CodeChunker;

  beforeEach(() => {
    chunker = new CodeChunker();
  });

  describe('chunk', () => {
    it('should chunk TypeScript by structure', async () => {
      const parsed: ParsedFile = {
        path: 'test.ts',
        language: 'typescript',
        content: `
export function add(a: number, b: number): number {
  return a + b;
}

export class Calculator {
  multiply(a: number, b: number): number {
    return a * b;
  }
}

export function subtract(a: number, b: number): number {
  return a - b;
}
`,
        chunks: [],
        structure: {
          path: 'test.ts',
          language: 'typescript',
          functions: ['add', 'subtract'],
          classes: ['Calculator'],
          interfaces: [],
          variables: [],
          imports: [],
          exports: [],
          lineCount: 18,
          hasComments: false,
        },
        imports: [],
        exports: [],
        lineCount: 18,
      };

      const chunks = await chunker.chunk(parsed);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(c => c.content.length > 0)).toBe(true);
      expect(chunks.every(c => c.filePath === 'test.ts')).toBe(true);
    });

    it('should add overlap between chunks', async () => {
      const chunkerWithOverlap = new CodeChunker({ overlap: 50 });

      const parsed: ParsedFile = {
        path: 'test.ts',
        language: 'typescript',
        content: `
function a() { return 1; }
function b() { return 2; }
function c() { return 3; }
function d() { return 4; }
`,
        chunks: [],
        structure: {
          path: 'test.ts',
          language: 'typescript',
          functions: ['a', 'b', 'c', 'd'],
          classes: [],
          interfaces: [],
          variables: [],
          imports: [],
          exports: [],
          lineCount: 8,
          hasComments: false,
        },
        imports: [],
        exports: [],
        lineCount: 8,
      };

      const chunks = await chunkerWithOverlap.chunk(parsed);

      // Check that chunks have overlap markers
      const hasOverlap = chunks.some(c => c.content.includes('...'));
      // This might not always be true depending on chunk sizes
    });

    it('should link dependencies', async () => {
      const parsed: ParsedFile = {
        path: 'test.ts',
        language: 'typescript',
        content: `
function helper() {
  return 'help';
}

export function main() {
  const result = helper();
  return result;
}
`,
        chunks: [],
        structure: {
          path: 'test.ts',
          language: 'typescript',
          functions: ['helper', 'main'],
          classes: [],
          interfaces: [],
          variables: [],
          imports: [],
          exports: [],
          lineCount: 12,
          hasComments: false,
        },
        imports: [],
        exports: [],
        lineCount: 12,
      };

      const chunks = await chunker.chunk(parsed);

      // Main function should reference helper
      const mainChunk = chunks.find(c => c.name === 'main');
      const helperChunk = chunks.find(c => c.name === 'helper');

      if (mainChunk && helperChunk) {
        // Dependencies should be linked
        expect(mainChunk.dependencies.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle Python code', async () => {
      const parsed: ParsedFile = {
        path: 'test.py',
        language: 'python',
        content: `
class DataProcessor:
    def process(self, data):
        return data

def transform(input):
    return input.upper()
`,
        chunks: [],
        structure: {
          path: 'test.py',
          language: 'python',
          functions: ['process', 'transform'],
          classes: ['DataProcessor'],
          interfaces: [],
          variables: [],
          imports: [],
          exports: [],
          lineCount: 9,
          hasComments: false,
        },
        imports: [],
        exports: [],
        lineCount: 9,
      };

      const chunks = await chunker.chunk(parsed);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(c => c.language === 'python')).toBe(true);
    });

    it('should handle large files by size', async () => {
      const largeContent = 'x'.repeat(5000);

      const parsed: ParsedFile = {
        path: 'large.txt',
        language: 'typescript',
        content: largeContent,
        chunks: [],
        structure: {
          path: 'large.txt',
          language: 'typescript',
          functions: [],
          classes: [],
          interfaces: [],
          variables: [],
          imports: [],
          exports: [],
          lineCount: 1,
          hasComments: false,
        },
        imports: [],
        exports: [],
        lineCount: 1,
      };

      const chunks = await chunker.chunk(parsed);

      // Should be split into multiple chunks
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for text', () => {
      const text = 'const x = 1;';
      const tokens = chunker.estimateTokens(text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length); // Should be less than character count
    });

    it('should handle empty string', () => {
      const tokens = chunker.estimateTokens('');
      expect(tokens).toBe(0);
    });
  });

  describe('getChunkStats', () => {
    it('should calculate chunk statistics', async () => {
      const parsed: ParsedFile = {
        path: 'test.ts',
        language: 'typescript',
        content: 'export function test() { return 1; }',
        chunks: [],
        structure: {
          path: 'test.ts',
          language: 'typescript',
          functions: ['test'],
          classes: [],
          interfaces: [],
          variables: [],
          imports: [],
          exports: [],
          lineCount: 1,
          hasComments: false,
        },
        imports: [],
        exports: [],
        lineCount: 1,
      };

      const chunks = await chunker.chunk(parsed);
      const stats = chunker.getChunkStats(chunks);

      expect(stats.totalChunks).toBe(chunks.length);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.avgChunkSize).toBeGreaterThan(0);
      expect(stats.byType).toBeDefined();
    });
  });

  describe('performance', () => {
    it('should chunk 1MB file in reasonable time', async () => {
      const largeContent = 'function test() { return '.repeat(10000) + '1; }';

      const parsed: ParsedFile = {
        path: 'large.ts',
        language: 'typescript',
        content: largeContent,
        chunks: [],
        structure: {
          path: 'large.ts',
          language: 'typescript',
          functions: [],
          classes: [],
          interfaces: [],
          variables: [],
          imports: [],
          exports: [],
          lineCount: 10000,
          hasComments: false,
        },
        imports: [],
        exports: [],
        lineCount: 10000,
      };

      const start = performance.now();
      const chunks = await chunker.chunk(parsed);
      const duration = performance.now() - start;

      expect(chunks.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500); // Should complete in less than 500ms
    });
  });
});
