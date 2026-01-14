/**
 * Bundle Optimization Tests
 */

import { describe, it, expect } from 'vitest';
import { BundleAnalyzer } from '../src/bundle/analyzer.js';
import { CodeSplittingOptimizer } from '../src/bundle/code-splitting.js';
import { TreeShakingOptimizer } from '../src/bundle/tree-shaking.js';
import type { BundleModule, BundleConfig } from '../src/types/index.js';

describe('BundleAnalyzer', () => {
  it('should create analyzer instance', () => {
    const analyzer = new BundleAnalyzer();
    expect(analyzer).toBeDefined();
  });

  it('should generate bundle recommendations', () => {
    const analyzer = new BundleAnalyzer();
    const modules: BundleModule[] = [
      {
        id: 'test',
        name: 'test-module',
        size: 600 * 1024,
        renderedSize: 0,
        originalSize: 0,
        isEntry: false,
        isDynamicImport: false,
        imports: [],
        dependents: [],
      },
    ];

    const recommendations = analyzer['generateRecommendations'](modules, [], []);
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].type).toBe('code-splitting');
  });

  it('should format size correctly', () => {
    const analyzer = new BundleAnalyzer();
    const format = (analyzer as any).formatSize.bind(analyzer);

    expect(format(1024)).toBe('1.00 KB');
    expect(format(1024 * 1024)).toBe('1.00 MB');
    expect(format(500)).toBe('500.00 B');
  });
});

describe('CodeSplittingOptimizer', () => {
  it('should create optimizer instance', () => {
    const optimizer = new CodeSplittingOptimizer();
    expect(optimizer).toBeDefined();
  });

  it('should generate split chunks configuration', () => {
    const optimizer = new CodeSplittingOptimizer();
    const modules: BundleModule[] = [
      {
        id: 'route1',
        name: 'pages/dashboard',
        size: 100 * 1024,
        renderedSize: 0,
        originalSize: 0,
        isEntry: false,
        isDynamicImport: false,
        imports: [],
        dependents: [],
      },
      {
        id: 'vendor1',
        name: 'node_modules/react',
        size: 50 * 1024,
        renderedSize: 0,
        originalSize: 0,
        isEntry: false,
        isDynamicImport: false,
        imports: [],
        dependents: [],
      },
    ];

    const chunks = optimizer.generateSplitChunks(modules);
    expect(chunks).toHaveProperty('vendor');
    expect(chunks).toHaveProperty('routes');
  });

  it('should analyze route splitting', () => {
    const optimizer = new CodeSplittingOptimizer();
    const modules: BundleModule[] = [
      {
        id: 'large-route',
        name: 'pages/heavy-page',
        size: 200 * 1024,
        renderedSize: 0,
        originalSize: 0,
        isEntry: false,
        isDynamicImport: false,
        imports: [],
        dependents: [],
      },
    ];

    const recommendations = optimizer['analyzeRouteSplitting'](modules);
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].type).toBe('code-splitting');
  });
});

describe('TreeShakingOptimizer', () => {
  it('should create optimizer instance', () => {
    const optimizer = new TreeShakingOptimizer();
    expect(optimizer).toBeDefined();
  });

  it('should analyze code for tree shaking', async () => {
    const optimizer = new TreeShakingOptimizer();
    const code = `
      export function used() { return 1; }
      function unused() { return 2; }
      export const usedVar = 3;
      const unusedVar = 4;
    `;

    const modules: BundleModule[] = [];
    const analysis = await optimizer.analyze(code, modules);

    expect(analysis).toHaveProperty('totalModules');
    expect(analysis).toHaveProperty('deadCode');
    expect(analysis).toHaveProperty('recommendations');
  });

  it('should generate webpack config', () => {
    const optimizer = new TreeShakingOptimizer();
    const config = optimizer.generateWebpackConfig();

    expect(config).toContain('optimization');
    expect(config).toContain('usedExports');
    expect(config).toContain('sideEffects');
  });
});
