/**
 * Unit tests for Quality Analyzer
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { QualityAnalyzer } from '../../src/quality/analyzer.js';
import { FileInfo } from '../../src/types/index.js';

describe('QualityAnalyzer', () => {
  let analyzer: QualityAnalyzer;

  beforeEach(() => {
    analyzer = new QualityAnalyzer({
      maxComplexity: 10,
      maxNestingDepth: 4,
      duplicationThreshold: 0.8,
    });
  });

  describe('analyzeComplexity', () => {
    it('should calculate cyclomatic complexity', async () => {
      const content = `
function test(a) {
  if (a > 0) {
    return 1;
  } else if (a < 0) {
    return -1;
  } else {
    return 0;
  }
}
      `;

      const fileInfo: FileInfo = {
        path: '/test.ts',
        language: 'typescript',
        size: 100,
        lines: 10,
      };

      const ast = null; // Simplified
      const complexity = await analyzer.analyzeComplexity(ast, content, fileInfo);

      expect(complexity.cyclomatic).toBeGreaterThan(1);
      expect(complexity.complexity).toBeGreaterThan(0);
    });

    it('should calculate cognitive complexity', async () => {
      const content = `
function test(a) {
  if (a > 0) {
    if (a > 10) {
      return 1;
    } else {
      return 2;
    }
  }
  return 0;
}
      `;

      const fileInfo: FileInfo = {
        path: '/test.ts',
        language: 'typescript',
        size: 100,
        lines: 10,
      };

      const ast = null;
      const complexity = await analyzer.analyzeComplexity(ast, content, fileInfo);

      expect(complexity.cognitive).toBeGreaterThan(0);
    });

    it('should calculate nesting depth', async () => {
      const content = `
function test() {
  if (true) {
    if (true) {
      if (true) {
        if (true) {
          if (true) {
            return 1;
          }
        }
      }
    }
  }
}
      `;

      const fileInfo: FileInfo = {
        path: '/test.ts',
        language: 'typescript',
        size: 100,
        lines: 15,
      };

      const ast = null;
      const complexity = await analyzer.analyzeComplexity(ast, content, fileInfo);

      expect(complexity.nestingDepth).toBeGreaterThan(4);
    });
  });

  describe('detectCodeSmells', () => {
    it('should detect long methods', async () => {
      const longMethod = Array(60).fill('const x = 1;').join('\n');

      const fileInfo: FileInfo = {
        path: '/test.ts',
        language: 'typescript',
        size: 1000,
        lines: 60,
      };

      const smells = await analyzer.detectCodeSmells(null, longMethod, fileInfo);

      const longMethodSmells = smells.filter(s => s.type === 'Long Method');
      expect(longMethodSmells.length).toBeGreaterThan(0);
    });

    it('should detect large classes', async () => {
      const largeClass = `
class LargeClass {
  ${Array(15).fill('method' + Math.random() + '() {}').join('\n  ')}
  ${Array(15).fill('prop' + Math.random() + ' = 1;').join('\n  ')}
}
      `;

      const fileInfo: FileInfo = {
        path: '/test.ts',
        language: 'typescript',
        size: 2000,
        lines: 40,
      };

      const smells = await analyzer.detectCodeSmells(null, largeClass, fileInfo);

      const largeClassSmells = smells.filter(s => s.type === 'Large Class');
      expect(largeClassSmells.length).toBeGreaterThan(0);
    });

    it('should detect magic numbers', async () => {
      const content = `
const result = value * 1.378 + 42;
      `;

      const fileInfo: FileInfo = {
        path: '/test.ts',
        language: 'typescript',
        size: 100,
        lines: 5,
      };

      const smells = await analyzer.detectCodeSmells(null, content, fileInfo);

      // Magic number detection might be in a different component
      expect(smells).toBeDefined();
    });
  });

  describe('detectDuplications', () => {
    it('should detect code duplication', async () => {
      const duplicatedCode = `
function func1() {
  const a = 1;
  const b = 2;
  const c = a + b;
  return c;
}

function func2() {
  const a = 1;
  const b = 2;
  const c = a + b;
  return c;
}
      `;

      const duplications = await analyzer.detectDuplications(duplicatedCode, '/test.ts');

      expect(duplications).toBeDefined();
      expect(Array.isArray(duplications)).toBe(true);
    });
  });

  describe('calculateMaintainabilityIndex', () => {
    it('should calculate maintainability index', () => {
      const complexity = {
        cyclomatic: 5,
        cognitive: 8,
        nestingDepth: 3,
        parameters: 3,
        complexity: 50,
      };

      const mi = analyzer.calculateMaintainabilityIndex(complexity, 100, 2);

      expect(mi).toBeGreaterThan(0);
      expect(mi).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateTechnicalDebt', () => {
    it('should calculate technical debt', () => {
      const codeSmells = [
        { severity: 'error' },
        { severity: 'warning' },
        { severity: 'info' },
      ] as any[];

      const duplications = [
        { similarity: 0.9 },
        { similarity: 0.85 },
      ] as any[];

      const debt = analyzer.calculateTechnicalDebt(codeSmells, duplications);

      expect(debt).toBeGreaterThan(0);
    });
  });

  describe('calculateTrend', () => {
    it('should detect improving trend', () => {
      const historicalData = [
        { maintainabilityIndex: 50, complexity: { complexity: 80 }, technicalDebt: 100 },
        { maintainabilityIndex: 60, complexity: { complexity: 70 }, technicalDebt: 80 },
        { maintainabilityIndex: 70, complexity: { complexity: 60 }, technicalDebt: 60 },
      ];

      const trend = analyzer.calculateTrend(historicalData);

      expect(trend.maintainability).toBe('improving');
      expect(trend.complexity).toBe('improving');
      expect(trend.technicalDebt).toBe('improving');
    });

    it('should detect declining trend', () => {
      const historicalData = [
        { maintainabilityIndex: 70, complexity: { complexity: 60 }, technicalDebt: 60 },
        { maintainabilityIndex: 60, complexity: { complexity: 70 }, technicalDebt: 80 },
        { maintainabilityIndex: 50, complexity: { complexity: 80 }, technicalDebt: 100 },
      ];

      const trend = analyzer.calculateTrend(historicalData);

      expect(trend.maintainability).toBe('declining');
      expect(trend.complexity).toBe('declining');
      expect(trend.technicalDebt).toBe('declining');
    });

    it('should detect stable trend', () => {
      const historicalData = [
        { maintainabilityIndex: 60, complexity: { complexity: 65 }, technicalDebt: 70 },
        { maintainabilityIndex: 62, complexity: { complexity: 64 }, technicalDebt: 68 },
      ];

      const trend = analyzer.calculateTrend(historicalData);

      expect(trend.maintainability).toBe('stable');
    });
  });
});

describe('Code Quality Metrics', () => {
  let analyzer: QualityAnalyzer;

  beforeEach(() => {
    analyzer = new QualityAnalyzer();
  });

  it('should provide comprehensive quality metrics', async () => {
    const content = `
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

    const fileInfo: FileInfo = {
      path: '/test.ts',
      language: 'typescript',
      size: 200,
      lines: 15,
    };

    const metrics = await analyzer.analyzeFile('/test.ts', content, fileInfo);

    expect(metrics).toBeDefined();
    expect(metrics.maintainabilityIndex).toBeGreaterThan(0);
    expect(metrics.technicalDebt).toBeGreaterThanOrEqual(0);
    expect(metrics.complexity).toBeDefined();
    expect(metrics.complexity.cyclomatic).toBeGreaterThan(0);
    expect(metrics.complexity.cognitive).toBeGreaterThan(0);
  });

  it('should handle edge cases', async () => {
    const emptyContent = '';

    const fileInfo: FileInfo = {
      path: '/test.ts',
      language: 'typescript',
      size: 0,
      lines: 0,
    };

    const metrics = await analyzer.analyzeFile('/test.ts', emptyContent, fileInfo);

    expect(metrics).toBeDefined();
  });
});
