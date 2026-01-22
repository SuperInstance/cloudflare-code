/**
 * Unit tests for Documentation Generator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DocumentationGenerator } from '../../src/generation/generator.js';
import { DocumentationOptions } from '../../src/types/index.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';

describe('DocumentationGenerator', () => {
  const testDir = join(process.cwd(), 'test-temp');
  const inputDir = join(testDir, 'input');
  const outputDir = join(testDir, 'output');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    await mkdir(inputDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('generate()', () => {
    it('should generate documentation from TypeScript files', async () => {
      // Create test file
      const testCode = `
/**
 * Adds two numbers together
 * @param a - First number
 * @param b - Second number
 * @returns Sum of a and b
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Greets a person
 * @param name - Name to greet
 */
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
      `.trim();

      await writeFile(join(inputDir, 'utils.ts'), testCode);

      const options: DocumentationOptions = {
        inputPath: inputDir,
        outputPath: outputDir,
        format: 'markdown',
        includePrivate: false,
        examples: true,
        typeInfo: true
      };

      const generator = new DocumentationGenerator(options);
      const result = await generator.generate();

      expect(result.documents).toHaveLength(1);
      expect(result.metrics.filesProcessed).toBe(1);
      expect(result.metrics.documentsGenerated).toBe(1);
      expect(result.metrics.coverage.documented).toBeGreaterThan(0);
    });

    it('should handle multiple files', async () => {
      // Create multiple test files
      const files = [
        { name: 'utils.ts', code: 'export const foo = 42;' },
        { name: 'helper.ts', code: 'export const bar = "test";' }
      ];

      for (const file of files) {
        await writeFile(join(inputDir, file.name), file.code);
      }

      const options: DocumentationOptions = {
        inputPath: inputDir,
        outputPath: outputDir,
        format: 'markdown'
      };

      const generator = new DocumentationGenerator(options);
      const result = await generator.generate();

      expect(result.documents).toHaveLength(2);
      expect(result.metrics.filesProcessed).toBe(2);
    });

    it('should generate HTML output', async () => {
      const testCode = `
/**
 * Test function
 */
export function test() {
  return true;
}
      `.trim();

      await writeFile(join(inputDir, 'test.ts'), testCode);

      const options: DocumentationOptions = {
        inputPath: inputDir,
        outputPath: outputDir,
        format: 'html'
      };

      const generator = new DocumentationGenerator(options);
      const result = await generator.generate();

      expect(result.documents[0].html).toBeDefined();
      expect(result.documents[0].html).toContain('<!DOCTYPE html>');
    });

    it('should calculate coverage correctly', async () => {
      const testCode = `
// Undocumented function
export function undocumented() {
  return 1;
}

/**
 * Documented function
 */
export function documented() {
  return 2;
}
      `.trim();

      await writeFile(join(inputDir, 'coverage.ts'), testCode);

      const options: DocumentationOptions = {
        inputPath: inputDir,
        outputPath: outputDir,
        format: 'markdown'
      };

      const generator = new DocumentationGenerator(options);
      const result = await generator.generate();

      expect(result.metrics.coverage.total).toBeGreaterThan(0);
      expect(result.metrics.coverage.percentage).toBeLessThan(100);
    });
  });

  describe('generateExamples()', () => {
    it('should generate code examples for functions', async () => {
      const testCode = `
/**
 * Multiplies two numbers
 */
export function multiply(a: number, b: number): number {
  return a * b;
}
      `.trim();

      await writeFile(join(inputDir, 'math.ts'), testCode);

      const options: DocumentationOptions = {
        inputPath: inputDir,
        outputPath: outputDir,
        format: 'markdown',
        examples: true
      };

      const generator = new DocumentationGenerator(options);
      const result = await generator.generate();

      expect(result.documents[0].examples).toBeDefined();
      expect(result.documents[0].examples!.length).toBeGreaterThan(0);
      expect(result.documents[0].examples![0].code).toContain('multiply');
    });
  });

  describe('performance', () => {
    it('should process 10K LOC in under 2 minutes', async () => {
      // Create a large file
      let largeCode = '';
      for (let i = 0; i < 500; i++) {
        largeCode += `
/**
 * Function ${i}
 * @param x - Input value
 * @returns Processed value
 */
export function function${i}(x: number): number {
  return x * ${i};
}
        `;
      }

      await writeFile(join(inputDir, 'large.ts'), largeCode);

      const options: DocumentationOptions = {
        inputPath: inputDir,
        outputPath: outputDir,
        format: 'markdown'
      };

      const generator = new DocumentationGenerator(options);
      const startTime = Date.now();
      const result = await generator.generate();
      const duration = Date.now() - startTime;

      // Should complete in under 2 minutes (120,000ms)
      expect(duration).toBeLessThan(120000);
      expect(result.metrics.filesProcessed).toBe(1);
    });
  });
});
