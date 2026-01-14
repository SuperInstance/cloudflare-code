/**
 * Documentation Generator Tests
 */

import { describe, it, expect } from 'vitest';
import { DocumentationGenerator, createDocGenerator } from './generator';
import type { DocOutput, GenerationResult } from './types';

describe('DocumentationGenerator', () => {
  const generator = new DocumentationGenerator({
    projectName: 'TestProject',
    version: '1.0.0',
    description: 'A test project',
    author: 'Test Author',
    license: 'MIT',
  });

  const sampleFiles = [
    {
      path: 'src/utils.ts',
      content: `
/**
 * Utility functions
 */

/**
 * Adds two numbers
 * @param a - First number
 * @param b - Second number
 * @returns Sum of a and b
 * @example
 *   add(1, 2) // returns 3
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Multiplies two numbers
 */
export function multiply(a: number, b: number): number {
  return a * b;
}
`,
    },
    {
      path: 'src/types.ts',
      content: `
/**
 * Type definitions
 */

/**
 * User interface
 */
export interface User {
  id: string;
  name: string;
  email: string;
}

/**
 * Configuration type
 */
export type Config = {
  apiUrl: string;
  timeout: number;
};
`,
    },
    {
      path: 'src/models/User.ts',
      content: `
/**
 * User model class
 */
export class User {
  /**
   * User ID
   */
  id: string;

  /**
   * User name
   */
  name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  /**
   * Get user info
   */
  getInfo(): string {
    return \`\${this.name} (\${this.id})\`;
  }
}
`,
    },
  ];

  describe('generate', () => {
    it('should generate documentation successfully', async () => {
      const result = await generator.generate(sampleFiles);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.outputs).toHaveLengthGreaterThan(0);
      expect(result.stats.filesParsed).toBe(3);
      expect(result.stats.symbolsExtracted).toBeGreaterThan(0);
    });

    it('should generate markdown output', async () => {
      const result = await generator.generate(sampleFiles);
      const markdownOutput = result.outputs.find(o => o.format === 'markdown');

      expect(markdownOutput).toBeDefined();
      expect(markdownOutput?.content).toContain('# TestProject');
      expect(markdownOutput?.content).toContain('## API Reference');
      expect(markdownOutput?.content).toContain('add');
      expect(markdownOutput?.content).toContain('multiply');
    });

    it('should generate HTML output', async () => {
      const result = await generator.generate(sampleFiles);
      const htmlOutput = result.outputs.find(o => o.format === 'html');

      expect(htmlOutput).toBeDefined();
      expect(htmlOutput?.content).toContain('<!DOCTYPE html>');
      expect(htmlOutput?.content).toContain('TestProject');
      expect(htmlOutput?.content).toContain('<title>');
    });

    it('should generate JSON output', async () => {
      const result = await generator.generate(sampleFiles);
      const jsonOutput = result.outputs.find(o => o.format === 'json');

      expect(jsonOutput).toBeDefined();
      expect(jsonOutput?.content).toContain('{');

      const parsed = JSON.parse(jsonOutput!.content);
      expect(parsed).toHaveProperty('format');
      expect(parsed).toHaveProperty('type');
      expect(parsed).toHaveProperty('metadata');
    });

    it('should include metadata in outputs', async () => {
      const result = await generator.generate(sampleFiles);

      for (const output of result.outputs) {
        expect(output.metadata).toBeDefined();
        expect(output.metadata.version).toBe('1.0.0');
        expect(output.metadata.generatedAt).toBeLessThanOrEqual(Date.now());
        expect(output.metadata.sourceFiles).toHaveLength(3);
        expect(output.metadata.symbols).toBeGreaterThan(0);
      }
    });

    it('should generate API reference documentation', async () => {
      const apiGenerator = new DocumentationGenerator({
        ...generator['options'],
        type: ['api-reference'],
        format: ['markdown'],
      });

      const result = await apiGenerator.generate(sampleFiles);
      const apiOutput = result.outputs.find(o => o.type === 'api-reference');

      expect(apiOutput).toBeDefined();
      expect(apiOutput?.type).toBe('api-reference');
      expect(apiOutput?.content).toContain('add');
      expect(apiOutput?.content).toContain('multiply');
      expect(apiOutput?.content).toContain('User');
    });

    it('should generate README documentation', async () => {
      const readmeGenerator = new DocumentationGenerator({
        ...generator['options'],
        type: ['readme'],
        format: ['markdown'],
      });

      const result = await readmeGenerator.generate(sampleFiles);
      const readmeOutput = result.outputs.find(o => o.type === 'readme');

      expect(readmeOutput).toBeDefined();
      expect(readmeOutput?.type).be('readme');
      expect(readmeOutput?.content).toContain('# TestProject');
      expect(readmeOutput?.content).toContain('## Installation');
      expect(readmeOutput?.content).toContain('## API Reference');
    });

    it('should generate architecture documentation', async () => {
      const archGenerator = new DocumentationGenerator({
        ...generator['options'],
        type: ['architecture'],
        format: ['markdown'],
        includeDiagrams: true,
      });

      const result = await archGenerator.generate(sampleFiles);
      const archOutput = result.outputs.find(o => o.type === 'architecture');

      expect(archOutput).toBeDefined();
      expect(archOutput?.type).be('architecture');
      expect(archOutput?.content).toContain('mermaid');
    });

    it('should handle empty files', async () => {
      const result = await generator.generate([]);

      expect(result.success).toBe(true);
      expect(result.outputs).toHaveLength(0);
      expect(result.stats.filesParsed).toBe(0);
    });

    it('should handle files with no symbols', async () => {
      const result = await generator.generate([
        { path: 'empty.ts', content: '// Just a comment\n' },
      ]);

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('createDocGenerator', () => {
    it('should create generator with custom options', () => {
      const customGenerator = createDocGenerator({
        projectName: 'CustomProject',
        version: '2.0.0',
        format: ['markdown'],
        type: ['api-reference'],
      });

      expect(customGenerator).toBeInstanceOf(DocumentationGenerator);
      expect(customGenerator['options'].projectName).toBe('CustomProject');
      expect(customGenerator['options'].version).toBe('2.0.0');
    });
  });

  describe('error handling', () => {
    it('should handle parse errors gracefully', async () => {
      const invalidFiles = [
        { path: 'invalid.ts', content: 'function broken( {' }, // Syntax error
      ];

      const result = await generator.generate(invalidFiles);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.success).toBe(false);
    });

    it('should continue processing other files if one fails', async () => {
      const mixedFiles = [
        { path: 'valid.ts', content: 'export function valid() {}' },
        { path: 'invalid.ts', content: 'function broken( {' },
        { path: 'also-valid.ts', content: 'export function alsoValid() {}' },
      ];

      const result = await generator.generate(mixedFiles);

      expect(result.outputs).not.toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('performance', () => {
    it('should generate documentation within reasonable time', async () => {
      const startTime = performance.now();

      const result = await generator.generate(sampleFiles);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should handle larger codebases efficiently', async () => {
      const largeFiles = Array.from({ length: 50 }, (_, i) => ({
        path: `src/module${i}.ts`,
        content: `
/**
 * Module ${i}
 */
export function func${i}(a: number, b: number): number {
  return a + b + ${i};
}

export class Class${i} {
  constructor(public value: number) {}
  method(): number { return this.value; }
}
`,
      }));

      const startTime = performance.now();
      const result = await generator.generate(largeFiles);
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds
    });
  });

  describe('output quality', () => {
    it('should include table of contents in markdown', async () => {
      const result = await generator.generate(sampleFiles);
      const markdown = result.outputs.find(o => o.format === 'markdown');

      expect(markdown?.content).toContain('## Table of Contents');
    });

    it('should include code examples in documentation', async () => {
      const result = await generator.generate(sampleFiles);
      const markdown = result.outputs.find(o => o.format === 'markdown');

      expect(markdown?.content).toContain('```');
      expect(markdown?.content).toContain('add(1, 2)');
    });

    it('should include type signatures', async () => {
      const result = await generator.generate(sampleFiles);
      const markdown = result.outputs.find(o => o.format === 'markdown');

      expect(markdown?.content).toContain('add(a: number, b: number): number');
    });

    it('should organize symbols by category', async () => {
      const result = await generator.generate(sampleFiles);
      const markdown = result.outputs.find(o => o.format === 'markdown');

      expect(markdown?.content).toMatch(/## (Utils|Models|Types)/);
    });
  });
});
