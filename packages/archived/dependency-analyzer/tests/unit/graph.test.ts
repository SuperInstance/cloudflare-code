/**
 * Unit tests for Dependency Graph module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraphBuilder, GraphVisualizer, GraphAnalyzer } from '../../src/graph/graph.js';
import type { AnalyzerConfig, DependencyGraph } from '../../src/types/index.js';

describe('DependencyGraphBuilder', () => {
  let builder: DependencyGraphBuilder;
  let config: AnalyzerConfig;

  beforeEach(() => {
    config = {
      projectPath: '/tmp/test',
      packageManager: 'npm',
      include: ['**/*.ts'],
      exclude: ['node_modules/**'],
    };
    builder = new DependencyGraphBuilder(config);
  });

  describe('Graph Construction', () => {
    it('should initialize empty graph', () => {
      const graph = builder['initializeGraph']();

      expect(graph.nodes).toBeInstanceOf(Map);
      expect(graph.nodes.size).toBe(0);
      expect(graph.edges).toEqual([]);
      expect(graph.adjacencies).toBeInstanceOf(Map);
      expect(graph.reverseAdjacencies).toBeInstanceOf(Map);
    });

    it('should add node to graph', () => {
      builder['addNode']({
        id: '/tmp/test/file.ts',
        label: 'file.ts',
        type: 'module',
        path: '/tmp/test/file.ts',
      });

      const graph = builder.getGraph();
      expect(graph.nodes.size).toBe(1);
      expect(graph.nodes.has('/tmp/test/file.ts')).toBe(true);
    });

    it('should add edge to graph', () => {
      builder['addNode']({
        id: '/tmp/test/a.ts',
        label: 'a.ts',
        type: 'module',
        path: '/tmp/test/a.ts',
      });

      builder['addNode']({
        id: '/tmp/test/b.ts',
        label: 'b.ts',
        type: 'module',
        path: '/tmp/test/b.ts',
      });

      builder['addEdge']('/tmp/test/a.ts', '/tmp/test/b.ts', 'imports');

      const graph = builder.getGraph();
      expect(graph.edges.length).toBe(1);
      expect(graph.edges[0]).toEqual({
        from: '/tmp/test/a.ts',
        to: '/tmp/test/b.ts',
        type: 'imports',
        weight: 1,
      });
    });
  });

  describe('Import Extraction', () => {
    it('should extract ES6 imports', () => {
      const code = `
        import { foo } from './bar';
        import baz from './qux';
      `;

      const ast = builder['parseJavaScript'](code);
      const imports = builder['extractImports'](ast, 'test.ts');

      expect(imports).toHaveLength(2);
      expect(imports[0].source).toBe('./bar');
      expect(imports[0].specifiers).toContain('foo');
      expect(imports[1].source).toBe('./qux');
    });

    it('should extract dynamic imports', () => {
      const code = `
        const module = await import('./lazy');
      `;

      const ast = builder['parseJavaScript'](code);
      const imports = builder['extractImports'](ast, 'test.ts');

      const dynamicImports = imports.filter((imp) => imp.type === 'dynamic-import');
      expect(dynamicImports).toHaveLength(1);
      expect(dynamicImports[0].source).toBe('./lazy');
    });

    it('should extract CommonJS requires', () => {
      const code = `
        const fs = require('fs');
        const path = require('path');
      `;

      const ast = builder['parseJavaScript'](code);
      const imports = builder['extractImports'](ast, 'test.ts');

      expect(imports).toHaveLength(2);
      expect(imports[0].source).toBe('fs');
      expect(imports[1].source).toBe('path');
    });
  });

  describe('Export Extraction', () => {
    it('should extract named exports', () => {
      const code = `
        export { foo, bar };
        export const baz = 1;
      `;

      const ast = builder['parseJavaScript'](code);
      const exports = builder['extractExports'](ast, 'test.ts');

      expect(exports.length).toBeGreaterThan(0);
      const namedExports = exports.filter((e) => e.specifiers.length > 0);
      expect(namedExports.length).toBeGreaterThan(0);
    });

    it('should extract default exports', () => {
      const code = `
        export default class MyClass {}
      `;

      const ast = builder['parseJavaScript'](code);
      const exports = builder['extractExports'](ast, 'test.ts');

      const defaultExports = exports.filter((e) => e.specifiers.includes('default'));
      expect(defaultExports).toHaveLength(1);
    });
  });

  describe('Path Resolution', () => {
    it('should generate possible paths for import', () => {
      const paths = builder['generatePossiblePaths']('./utils', '/tmp/test/src');

      expect(paths).toContain('/tmp/test/src/utils.ts');
      expect(paths).toContain('/tmp/test/src/utils.js');
      expect(paths).toContain('/tmp/test/src/utils/index.ts');
    });

    it('should resolve relative imports', () => {
      expect(builder['isLocalImport']('./foo')).toBe(true);
      expect(builder['isLocalImport']('../bar')).toBe(true);
      expect(builder['isLocalImport']('/baz')).toBe(true);
      expect(builder['isLocalImport']('fs')).toBe(false);
      expect(builder['isLocalImport']('@scope/package')).toBe(false);
    });
  });

  describe('Graph Analysis', () => {
    it('should find shortest path between nodes', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['a', { id: 'a', label: 'A', type: 'module', path: '/a' }],
          ['b', { id: 'b', label: 'B', type: 'module', path: '/b' }],
          ['c', { id: 'c', label: 'C', type: 'module', path: '/c' }],
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

      builder['graph'] = graph;
      const path = builder.findShortestPath('a', 'c');

      expect(path).toEqual(['a', 'b', 'c']);
    });

    it('should return null when no path exists', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['a', { id: 'a', label: 'A', type: 'module', path: '/a' }],
          ['b', { id: 'b', label: 'B', type: 'module', path: '/b' }],
        ]),
        edges: [],
        adjacencies: new Map([
          ['a', new Set()],
          ['b', new Set()],
        ]),
        reverseAdjacencies: new Map([
          ['a', new Set()],
          ['b', new Set()],
        ]),
      };

      builder['graph'] = graph;
      const path = builder.findShortestPath('a', 'b');

      expect(path).toBeNull();
    });

    it('should calculate graph metrics', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['a', { id: 'a', label: 'A', type: 'module', path: '/a' }],
          ['b', { id: 'b', label: 'B', type: 'module', path: '/b' }],
        ]),
        edges: [
          { from: 'a', to: 'b', type: 'imports' },
        ],
        adjacencies: new Map([
          ['a', new Set(['b'])],
          ['b', new Set()],
        ]),
        reverseAdjacencies: new Map([
          ['a', new Set()],
          ['b', new Set(['a'])],
        ]),
      };

      builder['graph'] = graph;
      const metrics = builder.calculateMetrics();

      expect(metrics.nodes).toBe(2);
      expect(metrics.edges).toBe(1);
      expect(metrics.avgDegree).toBe(1);
      expect(metrics.maxDegree).toBe(1);
    });
  });
});

describe('GraphVisualizer', () => {
  const graph: DependencyGraph = {
    nodes: new Map([
      ['a', { id: 'a', label: 'Module A', type: 'module', path: '/a' }],
      ['b', { id: 'b', label: 'Module B', type: 'module', path: '/b' }],
    ]),
    edges: [
      { from: 'a', to: 'b', type: 'imports' },
    ],
    adjacencies: new Map([
      ['a', new Set(['b'])],
      ['b', new Set()],
    ]),
    reverseAdjacencies: new Map([
      ['a', new Set()],
      ['b', new Set(['a'])],
    ]),
  };

  describe('DOT Format', () => {
    it('should generate DOT format', () => {
      const dot = GraphVisualizer.toDot(graph);

      expect(dot).toContain('digraph dependencies');
      expect(dot).toContain('"a" [label="Module A"]');
      expect(dot).toContain('"b" [label="Module B"]');
      expect(dot).toContain('"a" -> "b"');
    });

    it('should use dashed lines for dynamic imports', () => {
      const dynamicGraph: DependencyGraph = {
        ...graph,
        edges: [{ from: 'a', to: 'b', type: 'dynamic' }],
      };

      const dot = GraphVisualizer.toDot(dynamicGraph);
      expect(dot).toContain('[style=dashed]');
    });
  });

  describe('JSON Format', () => {
    it('should generate JSON format', () => {
      const json = GraphVisualizer.toJSON(graph);
      const parsed = JSON.parse(json);

      expect(parsed.nodes).toHaveLength(2);
      expect(parsed.links).toHaveLength(1);
      expect(parsed.nodes[0]).toHaveProperty('id');
      expect(parsed.nodes[0]).toHaveProperty('label');
      expect(parsed.links[0]).toHaveProperty('source');
      expect(parsed.links[0]).toHaveProperty('target');
    });
  });

  describe('Mermaid Format', () => {
    it('should generate Mermaid format', () => {
      const mermaid = GraphVisualizer.toMermaid(graph);

      expect(mermaid).toContain('graph TD');
      expect(mermaid).toContain('Module_A --> Module_B');
    });
  });
});

describe('GraphAnalyzer', () => {
  let graph: DependencyGraph;
  let analyzer: GraphAnalyzer;

  beforeEach(() => {
    graph = {
      nodes: new Map([
        ['a', { id: 'a', label: 'A', type: 'module', path: '/a' }],
        ['b', { id: 'b', label: 'B', type: 'module', path: '/b' }],
        ['c', { id: 'c', label: 'C', type: 'module', path: '/c' }],
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

    analyzer = new GraphAnalyzer(graph);
  });

  describe('Strongly Connected Components', () => {
    it('should find strongly connected components', () => {
      const components = analyzer.findStronglyConnectedComponents();

      expect(components.length).toBeGreaterThan(0);
      expect(components.every((c) => c.length > 0)).toBe(true);
    });
  });

  describe('Topological Sort', () => {
    it('should return topological order', () => {
      const order = analyzer.topologicalSort();

      expect(order).toHaveLength(3);
      expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
      expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
    });
  });

  describe('Articulation Points', () => {
    it('should find articulation points', () => {
      const points = analyzer.findArticulationPoints();

      expect(points).toBeInstanceOf(Set);
      // Node 'b' should be an articulation point
      expect(points.has('b')).toBe(true);
    });
  });

  describe('Centrality Metrics', () => {
    it('should calculate centrality metrics', () => {
      const centrality = analyzer.calculateCentrality();

      expect(centrality.size).toBe(3);
      expect(centrality.get('a')).toHaveProperty('degree');
      expect(centrality.get('a')).toHaveProperty('betweenness');
      expect(centrality.get('a')).toHaveProperty('closeness');
    });
  });
});
