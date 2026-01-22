/**
 * Unit tests for Review Engine
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ReviewEngine } from '../../src/review/engine.js';
import { RuleRegistry } from '../../src/review/rule-registry.js';
import { TemplateManager } from '../../src/review/template-manager.js';
import { Issue, Severity, Category } from '../../src/types/index.js';

describe('ReviewEngine', () => {
  let engine: ReviewEngine;

  beforeEach(() => {
    engine = new ReviewEngine({
      maxConcurrentFiles: 2,
      timeoutPerFile: 5000,
    });
  });

  afterEach(() => {
    engine.clearCache();
  });

  describe('reviewFile', () => {
    it('should review a TypeScript file', async () => {
      const testCode = `
function add(a: number, b: number): number {
  return a + b;
}

const result = add(1, 2);
console.log(result);
      `;

      const result = await engine.reviewFile('/test/test.ts', {});

      expect(result.success).toBe(true);
      expect(result.issues).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    it('should detect console.log statements', async () => {
      const testCode = `
function test() {
  console.log('debug info');
  console.error('error');
}
      `;

      const result = await engine.reviewFile('/test/test.ts', {});

      const consoleIssues = result.issues.filter(i => i.ruleId === 'practices-console-log');
      expect(consoleIssues.length).toBeGreaterThan(0);
    });

    it('should detect trailing whitespace', async () => {
      const testCode = `
function test() {
  const x = 1;
  const y = 2;
}
      `.split('\n').map(line => line + '  ').join('\n');

      const result = await engine.reviewFile('/test/test.ts', {});

      const trailingIssues = result.issues.filter(i => i.ruleId === 'style-trailing-whitespace');
      expect(trailingIssues.length).toBeGreaterThan(0);
    });

    it('should detect hardcoded secrets', async () => {
      const testCode = `
const apiKey = 'sk_test_1234567890abcdef';
const password = 'mySecretPassword123';
      `;

      const result = await engine.reviewFile('/test/test.ts', {});

      const secretIssues = result.issues.filter(i => i.ruleId === 'security-hardcoded-secret');
      expect(secretIssues.length).toBeGreaterThan(0);
    });

    it('should detect SQL injection vulnerabilities', async () => {
      const testCode = `
const query = execute('SELECT * FROM users WHERE id = ' + userId);
      `;

      const result = await engine.reviewFile('/test/test.ts', {});

      const sqlIssues = result.issues.filter(i => i.ruleId === 'security-sql-injection');
      expect(sqlIssues.length).toBeGreaterThan(0);
    });

    it('should detect XSS vulnerabilities', async () => {
      const testCode = `
element.innerHTML = userInput;
      `;

      const result = await engine.reviewFile('/test/test.ts', {});

      const xssIssues = result.issues.filter(i => i.ruleId === 'security-xss');
      expect(xssIssues.length).toBeGreaterThan(0);
    });
  });

  describe('reviewFiles', () => {
    it('should review multiple files', async () => {
      const testFiles = [
        { path: '/test/test1.ts', content: 'function test1() { return 1; }' },
        { path: '/test/test2.ts', content: 'function test2() { return 2; }' },
      ];

      // Mock file system
      jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValueOnce(testFiles[0].content);
      jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValueOnce(testFiles[1].content);

      const result = await engine.reviewFiles([testFiles[0].path, testFiles[1].path]);

      expect(result.success).toBe(true);
      expect(result.metrics.filesScanned).toBe(2);
    });
  });

  describe('calculateScore', () => {
    it('should calculate correct score for no issues', () => {
      const summary = {
        total: 0,
        bySeverity: { error: 0, warning: 0, info: 0, hint: 0 },
        byCategory: {} as Record<Category, number>,
        byFile: {},
      };

      const score = (engine as any).calculateScore(summary);
      expect(score).toBe(100);
    });

    it('should calculate lower score for critical issues', () => {
      const summary = {
        total: 5,
        bySeverity: { error: 5, warning: 0, info: 0, hint: 0 },
        byCategory: { security: 5 } as Record<Category, number>,
        byFile: {},
      };

      const score = (engine as any).calculateScore(summary);
      expect(score).toBeLessThan(50);
    });
  });

  describe('caching', () => {
    it('should cache review results', async () => {
      const testCode = 'function test() { return 1; }';

      jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(testCode);

      const result1 = await engine.reviewFile('/test/test.ts', {});
      const cacheStats1 = engine.getCacheStats();

      expect(cacheStats1.size).toBe(1);

      const result2 = await engine.reviewFile('/test/test.ts', {});
      const cacheStats2 = engine.getCacheStats();

      expect(cacheStats2.size).toBe(1);
      expect(result2).toEqual(result1);
    });

    it('should clear cache', () => {
      engine.clearCache();
      const stats = engine.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });
});

describe('RuleRegistry', () => {
  let registry: RuleRegistry;

  beforeEach(() => {
    registry = new RuleRegistry();
  });

  describe('getRulesForLanguage', () => {
    it('should return TypeScript rules', () => {
      const rules = registry.getRulesForLanguage('typescript');
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should return JavaScript rules', () => {
      const rules = registry.getRulesForLanguage('javascript');
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should return Python rules', () => {
      const rules = registry.getRulesForLanguage('python');
      expect(rules.length).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      const stats = registry.getStats();

      expect(stats.total).toBeGreaterThan(0);
      expect(stats.enabled).toBeGreaterThan(0);
      expect(stats.byLanguage).toBeDefined();
      expect(stats.byCategory).toBeDefined();
    });
  });

  describe('setRuleEnabled', () => {
    it('should enable and disable rules', () => {
      const ruleId = 'security-hardcoded-secret';

      expect(registry.setRuleEnabled(ruleId, false)).toBe(true);
      expect(registry.setRuleEnabled(ruleId, true)).toBe(true);
      expect(registry.setRuleEnabled('non-existent', false)).toBe(false);
    });
  });
});

describe('TemplateManager', () => {
  let manager: TemplateManager;

  beforeEach(() => {
    manager = new TemplateManager();
  });

  describe('renderComment', () => {
    it('should render security error comment', async () => {
      const issue: Issue = {
        id: 'test-1',
        ruleId: 'security-test',
        severity: 'error',
        category: 'security',
        title: 'Test Security Issue',
        description: 'This is a test',
        location: { path: '/test.ts', line: 1 },
        timestamp: new Date(),
      };

      const pr: any = {
        number: 123,
        title: 'Test PR',
        author: 'test-user',
        sourceBranch: 'feature',
        targetBranch: 'main',
      };

      const comment = await manager.renderComment(issue, pr);

      expect(comment).toContain('Security Issue');
      expect(comment).toContain(issue.title);
      expect(comment).toContain(issue.description);
    });

    it('should render performance warning comment', async () => {
      const issue: Issue = {
        id: 'test-2',
        ruleId: 'performance-test',
        severity: 'warning',
        category: 'performance',
        title: 'Performance Issue',
        description: 'This is slow',
        location: { path: '/test.ts', line: 1 },
        timestamp: new Date(),
      };

      const pr: any = {
        number: 123,
        title: 'Test PR',
        author: 'test-user',
      };

      const comment = await manager.renderComment(issue, pr);

      expect(comment).toContain('Performance Issue');
    });
  });

  describe('renderMarkdownReport', () => {
    it('should render markdown report', async () => {
      const data: any = {
        summary: {
          total: 10,
          bySeverity: { error: 2, warning: 3, info: 5, hint: 0 },
          byCategory: {},
          byFile: {},
        },
        issues: [],
        metrics: { score: 75 },
      };

      const report = await manager.renderMarkdownReport(data);

      expect(report).toContain('# Code Review Report');
      expect(report).toContain('Total Issues');
      expect(report).toContain('Severity Breakdown');
    });
  });

  describe('renderHtmlReport', () => {
    it('should render HTML report', async () => {
      const data: any = {
        summary: {
          total: 10,
          bySeverity: { error: 2, warning: 3, info: 5, hint: 0 },
          byCategory: {},
          byFile: {},
        },
        issues: [],
        metrics: { score: 75 },
      };

      const html = await manager.renderHtmlReport(data);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Code Review Report');
      expect(html).toContain('Total Issues');
    });
  });
});
