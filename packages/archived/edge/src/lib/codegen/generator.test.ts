/**
 * Code Generator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodeGenerator, createGenerator } from './generator';
import type { GenerationRequest, SupportedLanguage } from './types';

describe('CodeGenerator', () => {
  let generator: CodeGenerator;

  beforeEach(() => {
    generator = new CodeGenerator();
  });

  describe('generate', () => {
    it('should generate TypeScript function', async () => {
      const request: GenerationRequest = {
        type: 'function',
        language: 'typescript',
        description: 'Add two numbers',
        context: {
          name: 'add',
          params: [
            { name: 'a', type: 'number' },
            { name: 'b', type: 'number' },
          ],
          returnType: 'number',
          body: 'return a + b;',
        },
      };

      const result = await generator.generate(request);

      expect(result.success).toBe(true);
      expect(result.code).toContain('function add');
      expect(result.code).toContain('a: number');
      expect(result.code).toContain('b: number');
      expect(result.metadata.generationTime).toBeGreaterThan(0);
    });

    it('should generate API endpoint', async () => {
      const request: GenerationRequest = {
        type: 'api',
        language: 'typescript',
        description: 'Create user endpoint',
        templateId: 'ts-api-endpoint',
        context: {
          name: 'createUser',
          params: [
            { name: 'email', type: 'string' },
            { name: 'name', type: 'string' },
          ],
        },
      };

      const result = await generator.generate(request);

      expect(result.success).toBe(true);
      expect(result.code).toContain('export async function createUser');
      expect(result.code).toContain('Request');
      expect(result.code).toContain('Response');
    });

    it('should generate Python function', async () => {
      const request: GenerationRequest = {
        type: 'function',
        language: 'python',
        description: 'Calculate factorial',
        context: {
          name: 'factorial',
          params: [{ name: 'n', type: 'int' }],
          returnType: 'int',
          body: 'if n <= 1: return 1\nreturn n * factorial(n - 1)',
        },
      };

      const result = await generator.generate(request);

      expect(result.success).toBe(true);
      expect(result.code).toContain('def factorial');
      expect(result.language).toBe('python');
    });

    it('should handle errors gracefully', async () => {
      const request: GenerationRequest = {
        type: 'function',
        language: 'typescript',
        description: 'Test',
        templateId: 'non-existent',
      };

      const result = await generator.generate(request);

      expect(result.success).toBe(false);
      expect(result.issues).toBeDefined();
      expect(result.issues!.length).toBeGreaterThan(0);
    });

    it('should validate constraints', async () => {
      const request: GenerationRequest = {
        type: 'function',
        language: 'typescript',
        description: 'Test function',
        context: {
          name: 'test',
          body: 'eval("malicious code");',
        },
        options: {
          constraints: {
            forbiddenPatterns: ['eval\\s*\\('],
          },
        },
      };

      const result = await generator.generate(request);

      expect(result.issues).toBeDefined();
      expect(result.issues!.some(i => i.id === 'forbidden-pattern')).toBe(true);
    });
  });

  describe('generateBatch', () => {
    it('should generate multiple code snippets', async () => {
      const requests: GenerationRequest[] = [
        {
          type: 'function',
          language: 'typescript',
          description: 'Function 1',
          context: { name: 'func1', body: 'return 1;' },
        },
        {
          type: 'function',
          language: 'python',
          description: 'Function 2',
          context: { name: 'func2', body: 'return 2' },
        },
      ];

      const result = await generator.generateBatch({ requests });

      expect(result.results).toHaveLength(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
    });

    it('should handle parallel generation', async () => {
      const requests: GenerationRequest[] = Array.from({ length: 5 }, (_, i) => ({
        type: 'function' as const,
        language: 'typescript' as SupportedLanguage,
        description: `Function ${i}`,
        context: { name: `func${i}`, body: `return ${i};` },
      }));

      const result = await generator.generateBatch({ requests, parallel: true });

      expect(result.results).toHaveLength(5);
      expect(result.totalGenerationTime).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('should track generation statistics', async () => {
      const request: GenerationRequest = {
        type: 'function',
        language: 'typescript',
        description: 'Test',
        context: { name: 'test', body: 'return true;' },
      };

      await generator.generate(request);
      await generator.generate(request);

      const stats = generator.getStats();

      expect(stats.totalGenerations).toBe(2);
      expect(stats.avgGenerationTime).toBeGreaterThan(0);
    });

    it('should reset statistics', async () => {
      const request: GenerationRequest = {
        type: 'function',
        language: 'typescript',
        description: 'Test',
        context: { name: 'test', body: 'return true;' },
      };

      await generator.generate(request);
      generator.resetStats();

      const stats = generator.getStats();

      expect(stats.totalGenerations).toBe(0);
    });
  });
});

describe('createGenerator', () => {
  it('should create generator instance', () => {
    const generator = createGenerator({ timeout: 5000 });
    expect(generator).toBeInstanceOf(CodeGenerator);
  });

  it('should accept custom config', () => {
    const generator = createGenerator({
      defaults: {
        includeTypes: true,
        includeErrorHandling: true,
      },
    });
    expect(generator).toBeInstanceOf(CodeGenerator);
  });
});
