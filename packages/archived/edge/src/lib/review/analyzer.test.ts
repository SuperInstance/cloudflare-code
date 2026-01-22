/**
 * Static Analyzer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StaticAnalyzer, createStaticAnalyzer } from './analyzer';
import { createParser } from '../codebase/parser';
import type { ReviewOptions } from './types';

describe('StaticAnalyzer', () => {
  let analyzer: StaticAnalyzer;
  let parser: ReturnType<typeof createParser>;

  beforeEach(() => {
    analyzer = createStaticAnalyzer();
    parser = createParser();
  });

  describe('analyzeFile', () => {
    it('should analyze TypeScript code', async () => {
      const code = `
function calculateSum(a: number, b: number): number {
  return a + b;
}

class Calculator {
  add(x: number, y: number): number {
    return x + y;
  }
}
      `;

      const parsedFile = await parser.parseFile(code, 'test.ts');
      const report = await analyzer.analyzeFile(parsedFile);

      expect(report).toBeDefined();
      expect(report.file).toBe('test.ts');
      expect(report.language).toBe('typescript');
      expect(report.score).toBeGreaterThan(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(report.metrics).toBeDefined();
    });

    it('should detect security issues', async () => {
      const code = `
const password = "hardcoded_password_123";
const apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz";

function queryUser(id: string) {
  db.query(\`SELECT * FROM users WHERE id = \${id}\`);
}
      `;

      const parsedFile = await parser.parseFile(code, 'test.ts');
      const report = await analyzer.analyzeFile(parsedFile);

      const securityIssues = report.issues.filter(i => i.category === 'security');
      expect(securityIssues.length).toBeGreaterThan(0);
    });

    it('should detect performance issues', async () => {
      const code = `
for (let i = 0; i < 100; i++) {
  for (let j = 0; j < 100; j++) {
    console.log(i, j);
  }
}
      `;

      const parsedFile = await parser.parseFile(code, 'test.ts');
      const report = await analyzer.analyzeFile(parsedFile);

      const performanceIssues = report.issues.filter(i => i.category === 'performance');
      expect(performanceIssues.length).toBeGreaterThan(0);
    });

    it('should detect quality issues', async () => {
      const code = `
// Very long function with many lines
function processData(data: any) {
  // Line 1
  const x = 1;
  // Line 2
  const y = 2;
  // Line 3
  const z = 3;
  // ... many more lines
  // Line 50
  const result = x + y + z;
  return result;
}
      `;

      const parsedFile = await parser.parseFile(code, 'test.ts');
      const options: ReviewOptions = {
        includeQuality: true,
        includeSecurity: false,
        includePerformance: false,
      };
      const report = await analyzer.analyzeFile(parsedFile, options);

      expect(report.issues.length).toBeGreaterThan(0);
    });

    it('should calculate metrics correctly', async () => {
      const code = `
// This is a comment
function hello() {
  console.log("Hello, world!");
}

const x = 42;
      `;

      const parsedFile = await parser.parseFile(code, 'test.ts');
      const report = await analyzer.analyzeFile(parsedFile);

      expect(report.metrics.linesOfCode).toBeGreaterThan(0);
      expect(report.metrics.totalLines).toBeGreaterThan(0);
      expect(report.metrics.cyclomaticComplexity).toBeGreaterThan(0);
      expect(report.metrics.maintainabilityIndex).toBeGreaterThan(0);
    });
  });

  describe('analyzeBatch', () => {
    it('should analyze multiple files', async () => {
      const files = [
        { content: 'function foo() {}', path: 'foo.ts' },
        { content: 'function bar() {}', path: 'bar.ts' },
        { content: 'function baz() {}', path: 'baz.ts' },
      ];

      const parsedFiles = await parser.parseBatch(files);
      const reports = await analyzer.analyzeBatch(parsedFiles);

      expect(reports).toHaveLength(3);
      expect(reports[0].file).toBe('foo.ts');
      expect(reports[1].file).toBe('bar.ts');
      expect(reports[2].file).toBe('baz.ts');
    });

    it('should report progress', async () => {
      const files = Array.from({ length: 10 }, (_, i) => ({
        content: `function func${i}() {}`,
        path: `file${i}.ts`,
      }));

      const parsedFiles = await parser.parseBatch(files);
      const progressUpdates: any[] = [];

      await analyzer.analyzeBatch(parsedFiles, {}, undefined, (progress) => {
        progressUpdates.push(progress);
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].progress).toBe(100);
    });
  });
});

describe('createStaticAnalyzer', () => {
  it('should create an analyzer instance', () => {
    const analyzer = createStaticAnalyzer();
    expect(analyzer).toBeInstanceOf(StaticAnalyzer);
  });

  it('should accept custom configuration', () => {
    const analyzer = createStaticAnalyzer({
      maxFileSize: 500000,
      parallelism: 8,
    });
    expect(analyzer).toBeInstanceOf(StaticAnalyzer);
  });
});
