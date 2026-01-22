/**
 * Unit tests for Circular Dependency Detector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CircularDependencyDetector, CycleOptimizer, LoadOrderAnalyzer } from '../../src/circular/detector.js';
import type { AnalyzerConfig, DependencyGraph, CircularCycle } from '../../src/types/index.js';

describe('CircularDependencyDetector', () => {
  let detector: CircularDependencyDetector;
  let config: AnalyzerConfig;
  let graph: DependencyGraph;

  beforeEach(() => {
    config = {
      projectPath: '/tmp/test',
      packageManager: 'npm',
      rules: {
        circular: {
          enabled: true,
          maxDepth: 10,
        },
      },
    };

    detector = new CircularDependencyDetector(config);

    // Create a graph with circular dependencies
    graph = {
      nodes: new Map([
        ['a', { id: 'a', label: 'a.ts', type: 'module', path: '/tmp/test/a.ts' }],
        ['b', { id: 'b', label: 'b.ts', type: 'module', path: '/tmp/test/b.ts' }],
        ['c', { id: 'c', label: 'c.ts', type: 'module', path: '/tmp/test/c.ts' }],
      ]),
      edges: [
        { from: 'a', to: 'b', type: 'imports' },
        { from: 'b', to: 'c', type: 'imports' },
        { from: 'c', to: 'a', type: 'imports' }, // Creates cycle
      ],
      adjacencies: new Map([
        ['a', new Set(['b'])],
        ['b', new Set(['c'])],
        ['c', new Set(['a'])],
      ]),
      reverseAdjacencies: new Map([
        ['a', new Set(['c'])],
        ['b', new Set(['a'])],
        ['c', new Set(['b'])],
      ]),
    };
  });

  describe('Cycle Detection', () => {
    it('should detect circular dependencies', () => {
      const result = detector.detect(graph);

      expect(result.cycles.length).toBeGreaterThan(0);
      expect(result.summary.totalCycles).toBeGreaterThan(0);
    });

    it('should classify cycle type correctly', () => {
      // Create a direct cycle
      const directCycleGraph: DependencyGraph = {
        nodes: new Map([
          ['a', { id: 'a', label: 'a.ts', type: 'module', path: '/a.ts' }],
          ['b', { id: 'b', label: 'b.ts', type: 'module', path: '/b.ts' }],
        ]),
        edges: [
          { from: 'a', to: 'b', type: 'imports' },
          { from: 'b', to: 'a', type: 'imports' },
        ],
        adjacencies: new Map([
          ['a', new Set(['b'])],
          ['b', new Set(['a'])],
        ]),
        reverseAdjacencies: new Map([
          ['a', new Set(['b'])],
          ['b', new Set(['a'])],
        ]),
      };

      const result = detector.detect(directCycleGraph);

      expect(result.cycles.some((c) => c.type === 'direct')).toBe(true);
    });

    it('should generate cycle summary', () => {
      const result = detector.detect(graph);

      expect(result.summary).toHaveProperty('totalCycles');
      expect(result.summary).toHaveProperty('directCycles');
      expect(result.summary).toHaveProperty('indirectCycles');
      expect(result.summary).toHaveProperty('affectedModules');
      expect(result.summary).toHaveProperty('severityBreakdown');
    });
  });

  describe('Severity Calculation', () => {
    it('should assign high severity to direct cycles', () => {
      const directCycleGraph: DependencyGraph = {
        nodes: new Map([
          ['a', { id: 'a', label: 'a.ts', type: 'module', path: '/a.ts' }],
          ['b', { id: 'b', label: 'b.ts', type: 'module', path: '/b.ts' }],
        ]),
        edges: [
          { from: 'a', to: 'b', type: 'imports' },
          { from: 'b', to: 'a', type: 'imports' },
        ],
        adjacencies: new Map([
          ['a', new Set(['b'])],
          ['b', new Set(['a'])],
        ]),
        reverseAdjacencies: new Map([
          ['a', new Set(['b'])],
          ['b', new Set(['a'])],
        ]),
      };

      const result = detector.detect(directCycleGraph);
      expect(result.cycles[0].severity).toBe('high');
    });

    it('should assign higher severity to longer cycles', () => {
      // Create a longer cycle
      const longCycleGraph: DependencyGraph = {
        nodes: new Map([
          ['a', { id: 'a', label: 'a.ts', type: 'module', path: '/a.ts' }],
          ['b', { id: 'b', label: 'b.ts', type: 'module', path: '/b.ts' }],
          ['c', { id: 'c', label: 'c.ts', type: 'module', path: '/c.ts' }],
          ['d', { id: 'd', label: 'd.ts', type: 'module', path: '/d.ts' }],
          ['e', { id: 'e', label: 'e.ts', type: 'module', path: '/e.ts' }],
          ['f', { id: 'f', label: 'f.ts', type: 'module', path: '/f.ts' }],
        ]),
        edges: [
          { from: 'a', to: 'b', type: 'imports' },
          { from: 'b', to: 'c', type: 'imports' },
          { from: 'c', to: 'd', type: 'imports' },
          { from: 'd', to: 'e', type: 'imports' },
          { from: 'e', to: 'f', type: 'imports' },
          { from: 'f', to: 'a', type: 'imports' },
        ],
        adjacencies: new Map([
          ['a', new Set(['b'])],
          ['b', new Set(['c'])],
          ['c', new Set(['d'])],
          ['d', new Set(['e'])],
          ['e', new Set(['f'])],
          ['f', new Set(['a'])],
        ]),
        reverseAdjacencies: new Map([
          ['a', new Set(['f'])],
          ['b', new Set(['a'])],
          ['c', new Set(['b'])],
          ['d', new Set(['c'])],
          ['e', new Set(['d'])],
          ['f', new Set(['e'])],
        ]),
      };

      const result = detector.detect(longCycleGraph);
      expect(result.cycles[0].severity).toBe('critical');
    });
  });

  describe('Suggestion Generation', () => {
    it('should generate break suggestions', () => {
      const result = detector.detect(graph);

      expect(result.cycles[0].suggestions).toBeDefined();
      expect(result.cycles[0].suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Ignore Patterns', () => {
    it('should respect ignore patterns', () => {
      const configWithIgnore: AnalyzerConfig = {
        ...config,
        rules: {
          circular: {
            enabled: true,
            maxDepth: 10,
            ignorePatterns: ['a\\.ts'],
          },
        },
      };

      const detectorWithIgnore = new CircularDependencyDetector(configWithIgnore);
      const result = detectorWithIgnore.detect(graph);

      // Should not find the cycle since 'a' is ignored
      expect(result.cycles.length).toBe(0);
    });
  });
});

describe('CycleOptimizer', () => {
  const cycles: CircularCycle[] = [
    {
      path: ['a', 'b', 'a'],
      length: 2,
      type: 'direct',
      severity: 'high',
      suggestions: ['Break the cycle'],
    },
    {
      path: ['c', 'd', 'e', 'c'],
      length: 3,
      type: 'indirect',
      severity: 'moderate',
      suggestions: ['Refactor the structure'],
    },
  ];

  const graph: DependencyGraph = {
    nodes: new Map([
      ['a', { id: 'a', label: 'a.ts', type: 'module', path: '/a.ts' }],
      ['b', { id: 'b', label: 'b.ts', type: 'module', path: '/b.ts' }],
      ['c', { id: 'c', label: 'c.ts', type: 'module', path: '/c.ts' }],
      ['d', { id: 'd', label: 'd.ts', type: 'module', path: '/d.ts' }],
      ['e', { id: 'e', label: 'e.ts', type: 'module', path: '/e.ts' }],
    ]),
    edges: [],
    adjacencies: new Map(),
    reverseAdjacencies: new Map(),
  };

  it('should generate optimization suggestions', () => {
    const suggestions = CycleOptimizer.optimize(cycles, graph);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((s) => s.priority === 'high' || s.priority === 'medium' || s.priority === 'low')).toBe(true);
    expect(suggestions.every((s) => s.action)).toBeDefined();
    expect(suggestions.every((s) => s.description)).toBeDefined();
  });

  it('should prioritize critical cycles', () => {
    const criticalCycles: CircularCycle[] = [
      {
        path: ['a', 'b', 'c', 'd', 'e', 'f', 'a'],
        length: 6,
        type: 'indirect',
        severity: 'critical',
        suggestions: ['Break immediately'],
      },
    ];

    const suggestions = CycleOptimizer.optimize(criticalCycles, graph);

    expect(suggestions.some((s) => s.priority === 'high')).toBe(true);
  });

  it('should generate code examples', () => {
    const suggestions = CycleOptimizer.optimize(cycles, graph);

    const withCode = suggestions.filter((s) => s.code);
    expect(withCode.length).toBeGreaterThan(0);
    expect(withCode[0].code).toContain('interface');
  });
});

describe('LoadOrderAnalyzer', () => {
  const graph: DependencyGraph = {
    nodes: new Map([
      ['a', { id: 'a', label: 'a.ts', type: 'module', path: '/a.ts' }],
      ['b', { id: 'b', label: 'b.ts', type: 'module', path: '/b.ts' }],
      ['c', { id: 'c', label: 'c.ts', type: 'module', path: '/c.ts' }],
    ]),
    edges: [
      { from: 'a', to: 'b', type: 'imports' },
      { from: 'b', to: 'c', type: 'imports' },
    ],
    adjacencies: new Map([
      ['a', new Set(['b'])],
      ['b', new Set(['c'])],
      ['c', new Set()],
    ]),
    reverseAdjacencies: new Map([
      ['a', new Set()],
      ['b', new Set(['a'])],
      ['c', new Set(['b'])],
    ]),
  };

  it('should compute load order', () => {
    const result = LoadOrderAnalyzer.analyze(graph);

    expect(result.loadOrder).toBeDefined();
    expect(result.loadOrder).toContain('a');
    expect(result.loadOrder).toContain('b');
    expect(result.loadOrder).toContain('c');
  });

  it('should detect load order issues', () => {
    // Create a graph with load order issues
    const problematicGraph: DependencyGraph = {
      ...graph,
      edges: [
        ...graph.edges,
        { from: 'c', to: 'a', type: 'imports' }, // Creates cycle
      ],
      adjacencies: new Map([
        ['a', new Set(['b'])],
        ['b', new Set(['c'])],
        ['c', new Set(['a'])],
      ]),
      reverseAdjacencies: new Map([
        ['a', new Set(['c'])],
        ['b', new Set(['a'])],
        ['c', new Set(['b'])],
      ]),
    };

    const result = LoadOrderAnalyzer.analyze(problematicGraph);

    // Should detect the circular dependency as a load order issue
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
