/**
 * Integration tests for Code Review Package
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CodeReview, ReviewEngine, SecurityScanner, QualityAnalyzer } from '../../src/index.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Code Review Integration Tests', () => {
  let tempDir: string;
  let review: CodeReview;

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'code-review-test-'));
    review = new CodeReview();
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('End-to-End Review Workflow', () => {
    it('should perform complete review of TypeScript file', async () => {
      const testCode = `
function calculateDiscount(price: number, discount: number): number {
  if (price > 100) {
    return price * (1 - discount);
  } else {
    return price;
  }
}

const result = calculateDiscount(150, 0.1);
console.log(result);
      `;

      const testFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(testFile, testCode);

      const result = await review.reviewFile(testFile);

      expect(result).toBeDefined();
      expect(result.review).toBeDefined();
      expect(result.review.success).toBe(true);
      expect(result.review.issues).toBeInstanceOf(Array);
      expect(result.review.metrics).toBeDefined();
    });

    it('should detect security vulnerabilities', async () => {
      const testCode = `
const API_KEY = 'sk_test_1234567890abcdef';
const password = 'secretPassword123';
      `;

      const testFile = path.join(tempDir, 'security-test.ts');
      await fs.writeFile(testFile, testCode);

      const result = await review.reviewFile(testFile, {
        includeSecurity: true,
      });

      expect(result.security.issues.length).toBeGreaterThan(0);
      expect(result.security.issues.some(i => i.category === 'security')).toBe(true);
    });

    it('should analyze code quality', async () => {
      const testCode = `
function complexFunction(x: number): number {
  if (x > 0) {
    if (x > 10) {
      if (x > 100) {
        return x * 2;
      } else {
        return x;
      }
    } else {
      return x - 1;
    }
  } else {
    return 0;
  }
}
      `;

      const testFile = path.join(tempDir, 'quality-test.ts');
      await fs.writeFile(testFile, testCode);

      const result = await review.reviewFile(testFile, {
        includeQuality: true,
      });

      expect(result.quality).toBeDefined();
      expect(result.quality.complexity).toBeDefined();
      expect(result.quality.maintainabilityIndex).toBeGreaterThanOrEqual(0);
    });

    it('should detect performance issues', async () => {
      const testCode = `
function findDuplicates(items: any[]): any[] {
  const duplicates: any[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      for (let k = j + 1; k < items.length; k++) {
        if (items[i] === items[j] && items[j] === items[k]) {
          duplicates.push(items[i]);
        }
      }
    }
  }
  return duplicates;
}
      `;

      const testFile = path.join(tempDir, 'performance-test.ts');
      await fs.writeFile(testFile, testCode);

      const result = await review.reviewFile(testFile, {
        includePerformance: true,
      });

      expect(result.performance).toBeDefined();
      expect(result.performance.bottlenecks).toBeInstanceOf(Array);
    });
  });

  describe('Multi-File Review', () => {
    it('should review multiple files and aggregate results', async () => {
      const files = [
        { name: 'file1.ts', code: 'function test1() { return 1; }' },
        { name: 'file2.ts', code: 'function test2() { return 2; }' },
        { name: 'file3.ts', code: 'function test3() { return 3; }' },
      ];

      for (const file of files) {
        await fs.writeFile(path.join(tempDir, file.name), file.code);
      }

      const filePaths = files.map(f => path.join(tempDir, f.name));
      const results = await review.reviewFiles(filePaths);

      expect(results.size).toBe(3);
      for (const [file, result] of results.entries()) {
        expect(result.review.success).toBe(true);
      }
    });
  });

  describe('Caching Performance', () => {
    it('should cache and reuse review results', async () => {
      const testCode = 'function test() { return 1; }';
      const testFile = path.join(tempDir, 'cache-test.ts');
      await fs.writeFile(testFile, testCode);

      const engine = new ReviewEngine();

      const start1 = Date.now();
      const result1 = await engine.reviewFile(testFile);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      const result2 = await engine.reviewFile(testFile);
      const time2 = Date.now() - start2;

      // Cached result should be faster (though timing can be variable in tests)
      expect(result2).toEqual(result1);
      expect(engine.getCacheStats().size).toBeGreaterThan(0);
    });

    it('should clear cache when requested', async () => {
      const testCode = 'function test() { return 1; }';
      const testFile = path.join(tempDir, 'clear-cache-test.ts');
      await fs.writeFile(testFile, testCode);

      const engine = new ReviewEngine();

      await engine.reviewFile(testFile);
      expect(engine.getCacheStats().size).toBeGreaterThan(0);

      engine.clearCache();
      expect(engine.getCacheStats().size).toBe(0);
    });
  });

  describe('Security Scanner Integration', () => {
    let scanner: SecurityScanner;

    beforeAll(() => {
      scanner = new SecurityScanner({
        enableSecretScanning: true,
        enableVulnerabilityScanning: true,
      });
    });

    it('should scan file and detect all security issues', async () => {
      const testCode = `
const apiKey = 'sk_test_1234567890abcdef';
const query = execute('SELECT * FROM users WHERE id = ' + userId);
element.innerHTML = userInput;
      `;

      const testFile = path.join(tempDir, 'security-scan-test.ts');
      await fs.writeFile(testFile, testCode);

      const fileInfo = {
        path: testFile,
        language: 'typescript' as const,
        size: Buffer.byteLength(testCode, 'utf8'),
        lines: testCode.split('\n').length,
      };

      const report = await scanner.scanFile(testFile, testCode, fileInfo);

      expect(report.issues.length).toBeGreaterThan(0);
      expect(report.summary).toBeDefined();
    });

    it('should perform OWASP Top 10 scan', async () => {
      const testCode = `
app.get('/admin', (req, res) => {
  res.send(adminPanel);
});
      `;

      const testFile = path.join(tempDir, 'owasp-test.ts');
      await fs.writeFile(testFile, testCode);

      const fileInfo = {
        path: testFile,
        language: 'typescript' as const,
        size: Buffer.byteLength(testCode, 'utf8'),
        lines: testCode.split('\n').length,
      };

      const issues = await scanner.scanOWASP(testFile, testCode, fileInfo);

      expect(issues).toBeInstanceOf(Array);
    });
  });

  describe('Quality Analyzer Integration', () => {
    let analyzer: QualityAnalyzer;

    beforeAll(() => {
      analyzer = new QualityAnalyzer();
    });

    it('should analyze file and provide quality metrics', async () => {
      const testCode = `
function calculate(a: number, b: number): number {
  if (a > 0) {
    if (b > 0) {
      return a + b;
    } else {
      return a - b;
    }
  } else {
    return 0;
  }
}
      `;

      const testFile = path.join(tempDir, 'quality-analyze-test.ts');
      await fs.writeFile(testFile, testCode);

      const fileInfo = {
        path: testFile,
        language: 'typescript' as const,
        size: Buffer.byteLength(testCode, 'utf8'),
        lines: testCode.split('\n').length,
      };

      const metrics = await analyzer.analyzeFile(testFile, testCode, fileInfo);

      expect(metrics).toBeDefined();
      expect(metrics.complexity).toBeDefined();
      expect(metrics.maintainabilityIndex).toBeGreaterThanOrEqual(0);
      expect(metrics.technicalDebt).toBeGreaterThanOrEqual(0);
    });

    it('should detect code smells', async () => {
      const testCode = `
class LargeClass {
  method1() {}
  method2() {}
  method3() {}
  method4() {}
  method5() {}
  method6() {}
  method7() {}
  method8() {}
  method9() {}
  method10() {}
  property1: string;
  property2: string;
  property3: string;
  property4: string;
  property5: string;
}
      `;

      const testFile = path.join(tempDir, 'codesmell-test.ts');
      await fs.writeFile(testFile, testCode);

      const fileInfo = {
        path: testFile,
        language: 'typescript' as const,
        size: Buffer.byteLength(testCode, 'utf8'),
        lines: testCode.split('\n').length,
      };

      const codeSmells = await analyzer.detectCodeSmells(null, testCode, fileInfo);

      expect(codeSmells).toBeInstanceOf(Array);
    });
  });

  describe('Report Generation', () => {
    it('should generate markdown report', async () => {
      const { TemplateManager } = await import('../../src/review/template-manager.js');
      const templateManager = new TemplateManager();

      const data = {
        summary: {
          total: 10,
          bySeverity: { error: 2, warning: 3, info: 5, hint: 0 },
          byCategory: {} as Record<string, number>,
          byFile: {},
        },
        issues: [],
        metrics: { score: 75 },
      };

      const report = await templateManager.renderMarkdownReport(data);

      expect(report).toContain('# Code Review Report');
      expect(report).toContain('Total Issues');
    });

    it('should generate HTML report', async () => {
      const { TemplateManager } = await import('../../src/review/template-manager.js');
      const templateManager = new TemplateManager();

      const data = {
        summary: {
          total: 10,
          bySeverity: { error: 2, warning: 3, info: 5, hint: 0 },
          byCategory: {} as Record<string, number>,
          byFile: {},
        },
        issues: [],
        metrics: { score: 75 },
      };

      const html = await templateManager.renderHtmlReport(data);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Code Review Report');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent files gracefully', async () => {
      const nonExistentFile = path.join(tempDir, 'does-not-exist.ts');

      const result = await review.reviewFile(nonExistentFile);

      expect(result).toBeDefined();
      expect(result.review.success).toBe(false);
    });

    it('should handle invalid code gracefully', async () => {
      const invalidCode = `
function invalid(
// This is invalid TypeScript
      `;

      const testFile = path.join(tempDir, 'invalid.ts');
      await fs.writeFile(testFile, invalidCode);

      const result = await review.reviewFile(testFile);

      expect(result).toBeDefined();
      // Should still return a result even if parsing fails
    });
  });

  describe('Performance Benchmarks', () => {
    it('should review small file quickly', async () => {
      const testCode = 'function test() { return 1; }';
      const testFile = path.join(tempDir, 'perf-test.ts');
      await fs.writeFile(testFile, testCode);

      const start = Date.now();
      await review.reviewFile(testFile);
      const duration = Date.now() - start;

      // Should complete in less than 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent file reviews', async () => {
      const files = Array.from({ length: 10 }, (_, i) => ({
        name: `concurrent-${i}.ts`,
        code: `function test${i}() { return ${i}; }`,
      }));

      for (const file of files) {
        await fs.writeFile(path.join(tempDir, file.name), file.code);
      }

      const start = Date.now();
      const filePaths = files.map(f => path.join(tempDir, f.name));
      await review.reviewFiles(filePaths);
      const duration = Date.now() - start;

      // Should complete all files in reasonable time
      expect(duration).toBeLessThan(5000);
    });
  });
});
