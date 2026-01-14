/**
 * Code Generation Integration Tests
 *
 * End-to-end tests for the complete code generation workflow.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodeGenerator, CodeCompletionEngine, CodeValidator } from './index';
import type { GenerationRequest, CompletionRequest, ValidationRequest, SupportedLanguage } from './types';

describe('Code Generation Integration', () => {
  let generator: CodeGenerator;
  let completion: CodeCompletionEngine;
  let validator: CodeValidator;

  beforeEach(() => {
    generator = new CodeGenerator();
    completion = new CodeCompletionEngine();
    validator = new CodeValidator();
  });

  describe('Full workflow: Generate, Complete, Validate', () => {
    it('should complete full workflow for TypeScript function', async () => {
      // Step 1: Generate code
      const genRequest: GenerationRequest = {
        type: 'function',
        language: 'typescript',
        description: 'Calculate factorial',
        context: {
          name: 'factorial',
          params: [{ name: 'n', type: 'number' }],
          returnType: 'number',
          body: 'if (n <= 1) return 1;\nreturn n * factorial(n - 1);',
        },
      };

      const genResult = await generator.generate(genRequest);

      expect(genResult.success).toBe(true);
      expect(genResult.code).toContain('function factorial');

      // Step 2: Get completions for the generated code
      const compRequest: CompletionRequest = {
        code: genResult.code,
        language: 'typescript',
        cursor: { line: 0, column: 20 },
      };

      const compResult = await completion.complete(compRequest);

      expect(compResult.items.length).toBeGreaterThan(0);

      // Step 3: Validate the generated code
      const valRequest: ValidationRequest = {
        code: genResult.code,
        language: 'typescript',
        categories: ['type-safety', 'best-practices'],
      };

      const valResult = await validator.validate(valRequest);

      expect(valResult.valid).toBe(true);
      expect(valResult.metrics).toBeDefined();
    });
  });

  describe('Multi-language support', () => {
    const languages: SupportedLanguage[] = [
      'typescript',
      'python',
      'go',
      'rust',
      'java',
    ];

    it.each(languages)('should generate code for %s', async (lang) => {
      const request: GenerationRequest = {
        type: 'function',
        language: lang,
        description: 'Add two numbers',
        context: {
          name: 'add',
          params: [
            { name: 'a', type: 'number' },
            { name: 'b', type: 'number' },
          ],
          body: 'return a + b;',
        },
      };

      const result = await generator.generate(request);

      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      expect(result.code.length).toBeGreaterThan(0);
      expect(result.language).toBe(lang);
    });
  });

  describe('API endpoint generation', () => {
    it('should generate and validate API endpoint', async () => {
      const request: GenerationRequest = {
        type: 'api',
        language: 'typescript',
        description: 'User creation endpoint',
        templateId: 'ts-api-endpoint',
        context: {
          name: 'createUser',
          params: [
            { name: 'email', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'age', type: 'number' },
          ],
        },
      };

      const result = await generator.generate(request);

      expect(result.success).toBe(true);
      expect(result.code).toContain('createUser');
      expect(result.code).toContain('z.object');

      // Validate the generated endpoint
      const validation = await validator.validate({
        code: result.code,
        language: 'typescript',
        categories: ['security', 'best-practices'],
      });

      expect(validation.metrics).toBeDefined();
    });
  });

  describe('Test generation', () => {
    it('should generate unit tests', async () => {
      const request: GenerationRequest = {
        type: 'test',
        language: 'typescript',
        description: 'Test for add function',
        templateId: 'ts-test-unit',
        context: {
          name: 'add',
          scenario: 'adds two positive numbers',
          expected: 'returns sum',
          assert: 'expect(result).toBe(5);',
          arrange: 'const a = 2; const b = 3;',
          act: 'const result = add(a, b);',
        },
      };

      const result = await generator.generate(request);

      expect(result.success).toBe(true);
      expect(result.code).toContain('describe');
      expect(result.code).toContain('it');
      expect(result.code).toContain('expect');
    });
  });

  describe('Code completion in context', () => {
    it('should provide relevant completions based on context', async () => {
      const code = `
interface User {
  id: string;
  name: string;
}

function processUser(user: U) {
  user.
}
`;

      const request: CompletionRequest = {
        code,
        language: 'typescript',
        cursor: { line: 7, column: 7 },
      };

      const result = await completion.complete(request);

      expect(result.items).toBeDefined();
      expect(result.items.length).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid template ID gracefully', async () => {
      const request: GenerationRequest = {
        type: 'function',
        language: 'typescript',
        description: 'Test',
        templateId: 'invalid-template-id',
      };

      const result = await generator.generate(request);

      expect(result.success).toBe(false);
      expect(result.issues).toBeDefined();
      expect(result.issues!.some(i => i.severity === 'error')).toBe(true);
    });

    it('should handle validation errors gracefully', async () => {
      const request: ValidationRequest = {
        code: 'function test( { return; }', // Invalid syntax
        language: 'typescript',
      };

      const result = await validator.validate(request);

      // Should not throw, should return result
      expect(result).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should generate code within reasonable time', async () => {
      const start = Date.now();

      const request: GenerationRequest = {
        type: 'function',
        language: 'typescript',
        description: 'Complex function',
        context: {
          name: 'complex',
          params: Array.from({ length: 10 }, (_, i) => ({
            name: `param${i}`,
            type: 'string',
          })),
          body: '// Complex implementation',
        },
      };

      const result = await generator.generate(request);
      const elapsed = Date.now() - start;

      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(2000); // Should complete in < 2s
    });

    it('should validate code quickly', async () => {
      const code = `
function example() {
  for (let i = 0; i < 100; i++) {
    for (let j = 0; j < 100; j++) {
      console.log(i, j);
    }
  }
}
`;

      const start = Date.now();
      const result = await validator.validate({
        code,
        language: 'typescript',
      });
      const elapsed = Date.now() - start;

      expect(result).toBeDefined();
      expect(elapsed).toBeLessThan(1000); // Should validate in < 1s
    });
  });

  describe('Batch operations', () => {
    it('should generate multiple code snippets efficiently', async () => {
      const requests: GenerationRequest[] = Array.from({ length: 10 }, (_, i) => ({
        type: 'function' as const,
        language: 'typescript' as SupportedLanguage,
        description: `Function ${i}`,
        context: {
          name: `func${i}`,
          body: `return ${i};`,
        },
      }));

      const start = Date.now();
      const result = await generator.generateBatch({ requests, parallel: true });
      const elapsed = Date.now() - start;

      expect(result.results).toHaveLength(10);
      expect(result.successCount).toBe(10);
      expect(elapsed).toBeLessThan(5000); // Should complete in < 5s
    });
  });

  describe('Quality metrics', () => {
    it('should calculate accurate quality metrics', async () => {
      const code = `
/**
 * Calculate the sum of an array of numbers
 * @param numbers - Array of numbers to sum
 * @returns Sum of all numbers
 */
function sum(numbers: number[]): number {
  let total = 0;
  for (const num of numbers) {
    total += num;
  }
  return total;
}
`;

      const result = await validator.validate({
        code,
        language: 'typescript',
      });

      expect(result.metrics).toBeDefined();
      expect(result.metrics.score).toBeGreaterThan(50); // Should have good score
      expect(result.metrics.complexity).toBeGreaterThan(0);
      expect(result.metrics.linesOfCode).toBeGreaterThan(0);
    });
  });
});
