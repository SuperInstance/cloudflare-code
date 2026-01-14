/**
 * Code Validator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodeValidator, validateCode } from './validator';
import type { ValidationRequest, SupportedLanguage } from './types';

describe('CodeValidator', () => {
  let validator: CodeValidator;

  beforeEach(() => {
    validator = new CodeValidator();
  });

  describe('validate', () => {
    it('should detect TypeScript any types', async () => {
      const request: ValidationRequest = {
        code: 'function test(x: any): any { return x; }',
        language: 'typescript',
        categories: ['type-safety'],
      };

      const result = await validator.validate(request);

      expect(result.issues).toBeDefined();
      expect(result.issues.some(i => i.id === 'ts-no-any')).toBe(true);
    });

    it('should detect console.log statements', async () => {
      const request: ValidationRequest = {
        code: 'function test() { console.log("debug"); }',
        language: 'typescript',
        categories: ['performance'],
      };

      const result = await validator.validate(request);

      expect(result.issues.some(i => i.id === 'performance-console-log')).toBe(true);
    });

    it('should detect eval usage', async () => {
      const request: ValidationRequest = {
        code: 'const result = eval("2 + 2");',
        language: 'javascript',
        categories: ['security'],
      };

      const result = await validator.validate(request);

      expect(result.issues.some(i => i.id === 'security-eval')).toBe(true);
      expect(result.issues.find(i => i.id === 'security-eval')?.severity).toBe('error');
    });

    it('should detect hardcoded secrets', async () => {
      const request: ValidationRequest = {
        code: 'const apiKey = "sk-1234567890abcdef";',
        language: 'typescript',
        categories: ['security'],
      };

      const result = await validator.validate(request);

      expect(result.issues.some(i => i.id === 'security-hardcoded-secrets')).toBe(true);
    });

    it('should calculate quality metrics', async () => {
      const request: ValidationRequest = {
        code: `
function add(a: number, b: number): number {
  // Add two numbers
  return a + b;
}
`,
        language: 'typescript',
      };

      const result = await validator.validate(request);

      expect(result.metrics).toBeDefined();
      expect(result.metrics.complexity).toBeGreaterThan(0);
      expect(result.metrics.linesOfCode).toBeGreaterThan(0);
      expect(result.metrics.score).toBeGreaterThanOrEqual(0);
      expect(result.metrics.score).toBeLessThanOrEqual(100);
    });

    it('should generate suggestions', async () => {
      const request: ValidationRequest = {
        code: 'function test() { return true; }',
        language: 'typescript',
      };

      const result = await validator.validate(request);

      expect(result.suggestions).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should apply auto-fix', async () => {
      const request: ValidationRequest = {
        code: 'function test() { console.log("debug"); }',
        language: 'typescript',
        options: {
          autoFix: true,
        },
      };

      const result = await validator.validate(request);

      expect(result.fixedCode).toBeDefined();
      expect(result.fixedCode).toContain('//');
    });

    it('should filter by severity threshold', async () => {
      const request: ValidationRequest = {
        code: 'function test(x: any) { console.log(x); }',
        language: 'typescript',
        options: {
          severityThreshold: 'error',
        },
      };

      const result = await validator.validate(request);

      // Only errors should be present
      expect(result.issues.filter(i => i.severity === 'error').length).toBe(result.issues.length);
    });

    it('should filter by categories', async () => {
      const request: ValidationRequest = {
        code: 'function test(x: any) { console.log(x); }',
        language: 'typescript',
        categories: ['security'],
      };

      const result = await validator.validate(request);

      // Only security issues should be present
      expect(result.issues.every(i => i.category === 'security')).toBe(true);
    });
  });

  describe('rule registration', () => {
    it('should register custom rule', () => {
      const customRule = {
        id: 'test-rule',
        name: 'Test Rule',
        category: 'best-practices' as const,
        severity: 'warning' as const,
        description: 'Test rule',
        check: (code: string) => ({
          valid: !code.includes('TODO'),
          issues: [],
        }),
      };

      validator.registerCustomRule(customRule);

      expect(() => validator.registerCustomRule(customRule)).not.toThrow();
    });
  });

  describe('getCategoryRules', () => {
    it('should return rules by category', () => {
      const rules = validator.getCategoryRules();

      expect(rules).toBeDefined();
      expect(rules['type-safety']).toBeDefined();
      expect(rules['security']).toBeDefined();
      expect(rules['performance']).toBeDefined();
    });
  });

  describe('caching', () => {
    it('should cache validation results', async () => {
      const request: ValidationRequest = {
        code: 'function test() { return true; }',
        language: 'typescript',
      };

      const result1 = await validator.validate(request);
      const result2 = await validator.validate(request);

      expect(result1).toEqual(result2);
    });

    it('should clear cache', () => {
      expect(() => validator.clearCache()).not.toThrow();
    });
  });
});

describe('validateCode', () => {
  it('should use default validator', async () => {
    const request: ValidationRequest = {
      code: 'const x: any = 10;',
      language: 'typescript',
    };

    const result = await validateCode(request);

    expect(result).toBeDefined();
  });
});
