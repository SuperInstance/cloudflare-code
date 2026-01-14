/**
 * Integration Tests for Documentation Generation System
 *
 * Tests the complete documentation generation workflow
 */

import { describe, it, expect } from 'vitest';
import {
  DocumentationGenerator,
  DocumentationParser,
  APIDocGenerator,
  DiagramGenerator,
  ReadmeGenerator,
  generateDocs,
  generateAPIReference,
  generateReadme,
  generateArchitectureDiagram,
} from './index';

describe('Documentation System Integration', () => {
  const sampleCodebase = [
    {
      path: 'src/calculator.ts',
      content: `
/**
 * Calculator Module
 *
 * Provides basic arithmetic operations
 * @module calculator
 */

/**
 * Add two numbers
 * @param a - First addend
 * @param b - Second addend
 * @returns Sum of a and b
 * @example
 *   add(5, 3) // returns 8
 * @since 1.0.0
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Subtract two numbers
 * @param a - Minuend
 * @param b - Subtrahend
 * @returns Difference of a and b
 */
export function subtract(a: number, b: number): number {
  return a - b;
}

/**
 * Calculator class with state
 */
export class Calculator {
  private result: number = 0;

  /**
   * Add to the current result
   */
  add(value: number): this {
    this.result += value;
    return this;
  }

  /**
   * Get current result
   */
  getResult(): number {
    return this.result;
  }
}
`,
    },
    {
      path: 'src/types.ts',
      content: `
/**
 * Type Definitions
 */

/**
 * User interface
 */
export interface User {
  /** Unique identifier */
  id: string;
  /** User's full name */
  name: string;
  /** Email address */
  email: string;
  /** Account status */
  status: 'active' | 'inactive' | 'suspended';
}

/**
 * Generic API response
 * @template T - Response data type
 */
export type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};

/**
 * Configuration options
 */
export type Config = {
  apiUrl: string;
  timeout: number;
  retries?: number;
};
`,
    },
    {
      path: 'src/utils/helpers.ts',
      content: `
/**
 * Utility helper functions
 */

/**
 * Format a date to ISO string
 * @param date - Date to format
 * @returns ISO formatted date string
 * @example
 *   formatDate(new Date()) // "2024-01-13T..."
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Debounce a function
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}
`,
    },
  ];

  describe('end-to-end documentation generation', () => {
    it('should generate complete documentation with all formats', async () => {
      const generator = new DocumentationGenerator({
        projectName: 'TestProject',
        version: '1.0.0',
        description: 'A comprehensive test project',
        author: 'Test Author',
        license: 'MIT',
        format: ['markdown', 'html', 'json'],
        type: ['api-reference', 'readme', 'architecture'],
        includeDiagrams: true,
        includeExamples: true,
      });

      const result = await generator.generate(sampleCodebase);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.outputs.length).toBeGreaterThanOrEqual(3);

      // Check markdown output
      const markdown = result.outputs.find(o => o.format === 'markdown');
      expect(markdown).toBeDefined();
      expect(markdown?.content).toContain('# TestProject');
      expect(markdown?.content).toContain('## API Reference');
      expect(markdown?.content).toContain('add');
      expect(markdown?.content).toContain('Calculator');
      expect(markdown?.content).toContain('User');

      // Check HTML output
      const html = result.outputs.find(o => o.format === 'html');
      expect(html).toBeDefined();
      expect(html?.content).toContain('<!DOCTYPE html>');
      expect(html?.content).toContain('TestProject');

      // Check JSON output
      const json = result.outputs.find(o => o.format === 'json');
      expect(json).toBeDefined();
      const parsed = JSON.parse(json!.content);
      expect(parsed).toHaveProperty('format');
      expect(parsed).toHaveProperty('metadata');
    });

    it('should generate API reference with complete information', async () => {
      const apiDocs = await generateAPIReference(sampleCodebase, 'markdown');

      expect(apiDocs).toBeDefined();
      expect(apiDocs?.content).toContain('## API Reference');
      expect(apiDocs?.content).toContain('add(a: number, b: number)');
      expect(apiDocs?.content).toContain('subtract(a: number, b: number)');
      expect(apiDocs?.content).toContain('formatDate(date: Date)');
      expect(apiDocs?.content).toContain('debounce');

      // Should include examples
      expect(apiDocs?.content).toContain('```');
      expect(apiDocs?.content).toContain('add(5, 3)');

      // Should include parameter tables
      expect(apiDocs?.content).toContain('| Name | Type |');
    });

    it('should generate README with all sections', async () => {
      const readme = await generateReadme(sampleCodebase, {
        projectName: 'TestProject',
        version: '1.0.0',
        description: 'A test project',
        license: 'MIT',
      });

      expect(readme).toBeDefined();
      expect(readme?.content).toContain('# TestProject');
      expect(readme?.content).toContain('## Table of Contents');
      expect(readme?.content).toContain('## Installation');
      expect(readme?.content).toContain('## Quick Start');
      expect(readme?.content).toContain('## API Reference');
      expect(readme?.content).toContain('## Usage');
    });

    it('should generate architecture diagram', async () => {
      const diagram = await generateArchitectureDiagram(sampleCodebase, 'markdown');

      expect(diagram).toBeDefined();
      expect(diagram?.content).toContain('```mermaid');
      expect(diagram?.content).toContain('graph TD');
    });
  });

  describe('parsing and analysis', () => {
    it('should parse entire codebase and extract all symbols', async () => {
      const parser = new DocumentationParser();
      const docs = await parser.parseBatch(sampleCodebase);

      expect(docs).toHaveLength(3);

      const allSymbols = docs.flatMap(d => d.symbols);
      expect(allSymbols.length).toBeGreaterThan(5);

      // Should find functions
      const functions = allSymbols.filter(s => s.kind === 'function');
      expect(functions.length).toBeGreaterThan(0);

      // Should find classes
      const classes = allSymbols.filter(s => s.kind === 'class');
      expect(classes.length).toBeGreaterThan(0);

      // Should find interfaces
      const interfaces = allSymbols.filter(s => s.kind === 'interface');
      expect(interfaces.length).toBeGreaterThan(0);

      // Should find types
      const types = allSymbols.filter(s => s.kind === 'type');
      expect(types.length).toBeGreaterThan(0);
    });

    it('should extract documentation from docstrings', async () => {
      const parser = new DocumentationParser();
      const docs = await parser.parseBatch(sampleCodebase);

      const calculatorDoc = docs.find(d => d.filePath.includes('calculator'));
      expect(calculatorDoc).toBeDefined();

      const addFunc = calculatorDoc!.symbols.find(s => s.name === 'add');
      expect(addFunc?.description).toContain('Add two numbers');
      expect(addFunc?.summary).toBeDefined();
      expect(addFunc?.examples).toHaveLength(1);
      expect(addFunc?.since).toBe('1.0.0');
      expect(addFunc?.parameters).toHaveLength(2);
    });

    it('should extract type parameters correctly', async () => {
      const parser = new DocumentationParser();
      const docs = await parser.parseBatch(sampleCodebase);

      const debounceFunc = docs
        .flatMap(d => d.symbols)
        .find(s => s.name === 'debounce');

      expect(debounceFunc?.typeParameters).toBeDefined();
      expect(debounceFunc?.typeParameters).toHaveLength(1);
      expect(debounceFunc?.typeParameters?.[0].name).toBe('T');
    });

    it('should calculate statistics correctly', async () => {
      const parser = new DocumentationParser();
      const docs = await parser.parseBatch(sampleCodebase);

      for (const doc of docs) {
        expect(doc.stats.totalSymbols).toBe(doc.symbols.length);
        expect(doc.stats.functions).toBeGreaterThanOrEqual(0);
        expect(doc.stats.classes).toBeGreaterThanOrEqual(0);
        expect(doc.stats.interfaces).toBeGreaterThanOrEqual(0);
        expect(doc.stats.exported).toBeGreaterThanOrEqual(0);
        expect(doc.stats.documentationCoverage).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('diagram generation', () => {
    it('should generate architecture diagram with nodes and edges', async () => {
      const parser = new DocumentationParser();
      const diagramGenerator = new DiagramGenerator();

      const docs = await parser.parseBatch(sampleCodebase);
      const diagram = diagramGenerator.generateArchitectureDiagram(docs);

      expect(diagram.nodes.length).toBeGreaterThan(0);
      expect(diagram.edges.length).toBeGreaterThan(0);
      expect(diagram.title).toBeDefined();

      // Check node structure
      const node = diagram.nodes[0];
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('label');
      expect(node).toHaveProperty('type');

      // Check edge structure
      const edge = diagram.edges[0];
      expect(edge).toHaveProperty('from');
      expect(edge).toHaveProperty('to');
      expect(edge).toHaveProperty('type');
    });

    it('should generate Mermaid format', async () => {
      const parser = new DocumentationParser();
      const diagramGenerator = new DiagramGenerator();

      const docs = await parser.parseBatch(sampleCodebase);
      const diagram = diagramGenerator.generateArchitectureDiagram(docs);
      const mermaid = diagramGenerator.generateMermaid(diagram);

      expect(mermaid).toContain('graph');
      expect(mermaid).toContain('-->');
    });

    it('should group nodes by module', async () => {
      const diagramGenerator = new DiagramGenerator({
        groupByModule: true,
      });

      const parser = new DocumentationParser();
      const docs = await parser.parseBatch(sampleCodebase);
      const diagram = diagramGenerator.generateArchitectureDiagram(docs);

      expect(diagram.groups).toBeDefined();
      expect(diagram.groups!.length).toBeGreaterThan(0);

      const group = diagram.groups![0];
      expect(group).toHaveProperty('name');
      expect(group).toHaveProperty('nodes');
      expect(group.nodes.length).toBeGreaterThan(0);
    });
  });

  describe('convenience functions', () => {
    it('should work with generateDocs helper', async () => {
      const result = await generateDocs({
        files: sampleCodebase,
        options: {
          projectName: 'HelperTest',
          format: ['markdown'],
        },
      });

      expect(result.success).toBe(true);
      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0].format).toBe('markdown');
    });
  });

  describe('error handling', () => {
    it('should handle syntax errors gracefully', async () => {
      const generator = new DocumentationGenerator();
      const result = await generator.generate([
        { path: 'broken.ts', content: 'function broken( {' },
      ]);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.success).toBe(false);
    });

    it('should handle empty input', async () => {
      const generator = new DocumentationGenerator();
      const result = await generator.generate([]);

      expect(result.success).toBe(true);
      expect(result.outputs).toHaveLength(0);
    });
  });

  describe('performance', () => {
    it('should generate documentation quickly', async () => {
      const generator = new DocumentationGenerator();

      const start = performance.now();
      const result = await generator.generate(sampleCodebase);
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
    });
  });
});
