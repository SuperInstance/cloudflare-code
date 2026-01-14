/**
 * Integration Tests for Codebase RAG Pipeline
 *
 * Tests the complete flow from parsing to retrieval
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodebaseParser } from './parser';
import { CodeChunker } from './chunker';
import { CodeEmbeddingGenerator } from './embeddings';
import { CodeVectorStore } from './vector-store';
import { CodeRetriever } from './retriever';

describe('Codebase RAG Pipeline Integration', () => {
  let parser: CodebaseParser;
  let chunker: CodeChunker;
  let embedder: CodeEmbeddingGenerator;
  let store: CodeVectorStore;
  let retriever: CodeRetriever;

  beforeEach(() => {
    parser = new CodebaseParser();
    chunker = new CodeChunker();
    embedder = new CodeEmbeddingGenerator();
    store = new CodeVectorStore();
    retriever = new CodeRetriever(store, embedder, {
      maxChunks: 5,
      minSimilarity: 0.3,
    });
  });

  describe('Full Pipeline: Single File', () => {
    const sampleCode = `
/**
 * UserService handles user-related operations
 */
export class UserService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch a user by ID
   */
  async getUser(id: number): Promise<User> {
    const response = await fetch(\`\${this.baseUrl}/users/\${id}\`);
    return response.json();
  }

  /**
   * Create a new user
   */
  async createUser(user: CreateUserDto): Promise<User> {
    const response = await fetch(\`\${this.baseUrl}/users\`, {
      method: 'POST',
      body: JSON.stringify(user),
    });
    return response.json();
  }
}

/**
 * User interface
 */
export interface User {
  id: number;
  name: string;
  email: string;
}

/**
 * DTO for creating users
 */
export interface CreateUserDto {
  name: string;
  email: string;
}

/**
 * Format user email
 */
export function formatUserEmail(user: User): string {
  return \`\${user.name} <\${user.email}>\`;
}
`;

    it('should parse, chunk, embed, and retrieve code', async () => {
      // Step 1: Parse
      const parsed = await parser.parseFile(sampleCode, 'src/services/UserService.ts');

      expect(parsed.language).toBe('typescript');
      expect(parsed.structure.classes).toContain('UserService');
      expect(parsed.structure.interfaces).toContain('User');
      expect(parsed.structure.functions).toContain('formatUserEmail');

      // Step 2: Chunk
      const chunks = await chunker.chunk(parsed);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(c => c.filePath === 'src/services/UserService.ts')).toBe(true);

      // Add mock embeddings (in real scenario, embedder.generateEmbeddings would be used)
      chunks.forEach(chunk => {
        chunk.embedding = new Float32Array(768).fill(Math.random());
      });

      // Step 3: Index
      await store.index(chunks);

      const stats = store.getStats();
      expect(stats.totalChunks).toBe(chunks.length);
      expect(stats.totalFiles).toBe(1);

      // Step 4: Retrieve
      const mockQueryEmbedding = new Float32Array(768).fill(0.5);
      vi.spyOn(embedder, 'generateQueryEmbedding').mockResolvedValue(mockQueryEmbedding);

      const retrieved = await retriever.retrieve('user service methods');

      expect(retrieved.chunks.length).toBeGreaterThan(0);
      expect(retrieved.context).toBeTruthy();
      expect(retrieved.metadata.totalTokens).toBeGreaterThan(0);
    });
  });

  describe('Full Pipeline: Multiple Files', () => {
    const files = [
      {
        path: 'src/utils/math.ts',
        content: `
export const PI = 3.14159;

export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export function divide(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}
`,
      },
      {
        path: 'src/utils/string.ts',
        content: `
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function reverse(str: string): string {
  return str.split('').reverse().join('');
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.slice(0, length) + '...' : str;
}
`,
      },
      {
        path: 'src/services/calculator.ts',
        content: `
import { add, multiply, divide } from '../utils/math';

export class Calculator {
  add(a: number, b: number): number {
    return add(a, b);
  }

  multiply(a: number, b: number): number {
    return multiply(a, b);
  }

  divide(a: number, b: number): number {
    return divide(a, b);
  }
}
`,
      },
    ];

    it('should process multiple files through the pipeline', async () => {
      // Parse all files
      const parsedFiles = await Promise.all(
        files.map(f => parser.parseFile(f.content, f.path))
      );

      expect(parsedFiles).toHaveLength(3);

      // Chunk all files
      const allChunks: any[] = [];
      for (const parsed of parsedFiles) {
        const chunks = await chunker.chunk(parsed);
        allChunks.push(...chunks);
      }

      expect(allChunks.length).toBeGreaterThan(0);

      // Add mock embeddings
      allChunks.forEach(chunk => {
        chunk.embedding = new Float32Array(768).fill(Math.random());
      });

      // Index all chunks
      await store.index(allChunks);

      const stats = store.getStats();
      expect(stats.totalFiles).toBe(3);
      expect(stats.totalChunks).toBe(allChunks.length);

      // Test retrieval
      const mockQueryEmbedding = new Float32Array(768).fill(0.5);
      vi.spyOn(embedder, 'generateQueryEmbedding').mockResolvedValue(mockQueryEmbedding);

      const retrieved = await retriever.retrieve('mathematical operations');

      expect(retrieved.chunks.length).toBeGreaterThan(0);
      expect(retrieved.metadata.fileCount).toBeGreaterThan(0);
    });
  });

  describe('End-to-End: Large Codebase', () => {
    it('should handle 100+ files efficiently', async () => {
      const files: Array<{ path: string; content: string }> = [];

      // Generate 100 mock files
      for (let i = 0; i < 100; i++) {
        files.push({
          path: `src/module${i}/service${i}.ts`,
          content: `
export class Service${i} {
  private id: number;

  constructor() {
    this.id = ${i};
  }

  method${i}A(): string {
    return 'result-${i}-A';
  }

  method${i}B(): number {
    return ${i} * 2;
  }
}

export function helper${i}(value: number): number {
  return value + ${i};
}
`,
        });
      }

      const startTime = performance.now();

      // Parse
      const parsedFiles = await parser.parseBatch(files);
      expect(parsedFiles).toHaveLength(100);

      // Chunk
      const allChunks: any[] = [];
      for (const parsed of parsedFiles) {
        const chunks = await chunker.chunk(parsed);
        allChunks.push(...chunks);
      }

      // Add mock embeddings
      allChunks.forEach(chunk => {
        chunk.embedding = new Float32Array(768).fill(Math.random());
      });

      // Index
      await store.index(allChunks);

      const indexTime = performance.now() - startTime;

      // Should complete indexing in reasonable time
      expect(indexTime).toBeLessThan(5000); // 5 seconds for 100 files

      // Verify stats
      const stats = store.getStats();
      expect(stats.totalFiles).toBe(100);
      expect(stats.totalChunks).toBeGreaterThan(100);

      // Test retrieval performance
      const mockQueryEmbedding = new Float32Array(768).fill(0.5);
      vi.spyOn(embedder, 'generateQueryEmbedding').mockResolvedValue(mockQueryEmbedding);

      const searchStart = performance.now();
      const retrieved = await retriever.retrieve('service methods');
      const searchTime = performance.now() - searchStart;

      expect(retrieved.chunks.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(100); // Should be very fast
    });
  });

  describe('Cross-File Dependencies', () => {
    it('should track and retrieve dependencies', async () => {
      const files = [
        {
          path: 'types.ts',
          content: `
export interface User {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  price: number;
}
`,
        },
        {
          path: 'api.ts',
          content: `
import { User, Product } from './types';

export async function getUser(id: number): Promise<User> {
  return { id, name: 'Test' };
}

export async function getProduct(id: number): Promise<Product> {
  return { id, price: 10 };
}
`,
        },
        {
          path: 'service.ts',
          content: `
import { getUser } from './api';

export class UserService {
  async loadUser(id: number) {
    return await getUser(id);
  }
}
`,
        },
      ];

      // Parse and chunk
      const parsedFiles = await Promise.all(
        files.map(f => parser.parseFile(f.content, f.path))
      );

      const allChunks: any[] = [];
      for (const parsed of parsedFiles) {
        const chunks = await chunker.chunk(parsed);
        allChunks.push(...chunks);
      }

      // Add embeddings
      allChunks.forEach((chunk, i) => {
        chunk.embedding = new Float32Array(768).fill(i * 0.1);
      });

      await store.index(allChunks);

      // Test retrieval with related chunks
      const mockQueryEmbedding = new Float32Array(768).fill(0.5);
      vi.spyOn(embedder, 'generateQueryEmbedding').mockResolvedValue(mockQueryEmbedding);

      const retrieved = await retriever.retrieve('user loading');

      expect(retrieved.chunks.length).toBeGreaterThan(0);

      // Verify chunks can be retrieved by file
      const apiChunks = await store.getByFile('api.ts');
      expect(apiChunks.length).toBeGreaterThan(0);
    });
  });

  describe('Different Languages', () => {
    it('should handle mixed language codebase', async () => {
      const files = [
        {
          path: 'src/app.ts',
          content: 'export const version = "1.0.0";',
          language: 'typescript' as const,
        },
        {
          path: 'src/utils.py',
          content: 'def helper(): return True',
          language: 'python' as const,
        },
        {
          path: 'src/config.json',
          content: '{"name": "test"}',
          language: 'json' as const,
        },
      ];

      for (const file of files) {
        const parsed = await parser.parseFile(file.content, file.path);
        const chunks = await chunker.chunk(parsed);

        chunks.forEach(chunk => {
          chunk.embedding = new Float32Array(768).fill(Math.random());
        });

        await store.index(chunks);
      }

      const stats = store.getStats();
      expect(stats.totalFiles).toBe(3);
      expect(stats.languages.typescript).toBeGreaterThan(0);
      expect(stats.languages.python).toBeGreaterThan(0);
      expect(stats.languages.json).toBeGreaterThan(0);
    });
  });
});
