/**
 * DAG Tests
 */

import { describe, it, expect } from '@jest/globals';
import { DAGManager } from '../engine/dag';
import type { Node, Connection } from '../types';

describe('DAG Manager', () => {
  const createNode = (id: string, x: number, y: number): Node => ({
    id,
    type: 'action',
    actionType: 'log',
    name: `Node ${id}`,
    position: { x, y },
    config: {},
    enabled: true
  });

  const createConnection = (source: string, target: string): Connection => ({
    id: `conn-${source}-${target}`,
    sourceNodeId: source,
    targetNodeId: target
  });

  describe('Construction', () => {
    it('should build DAG from nodes and connections', () => {
      const nodes = [
        createNode('1', 0, 0),
        createNode('2', 1, 0),
        createNode('3', 2, 0)
      ];
      const connections = [
        createConnection('1', '2'),
        createConnection('2', '3')
      ];

      const dag = new DAGManager(nodes, connections);

      expect(dag.getNode('1')).toBeDefined();
      expect(dag.getNode('2')).toBeDefined();
      expect(dag.getNode('3')).toBeDefined();
    });

    it('should calculate node levels correctly', () => {
      const nodes = [
        createNode('1', 0, 0),
        createNode('2', 1, 0),
        createNode('3', 2, 0)
      ];
      const connections = [
        createConnection('1', '2'),
        createConnection('2', '3')
      ];

      const dag = new DAGManager(nodes, connections);

      expect(dag.getLevel('1')).toBe(0);
      expect(dag.getLevel('2')).toBe(1);
      expect(dag.getLevel('3')).toBe(2);
    });
  });

  describe('Cycle Detection', () => {
    it('should detect cycles', () => {
      const nodes = [
        createNode('1', 0, 0),
        createNode('2', 1, 0),
        createNode('3', 2, 0)
      ];
      const connections = [
        createConnection('1', '2'),
        createConnection('2', '3'),
        createConnection('3', '1')
      ];

      const dag = new DAGManager(nodes, connections);
      const cycles = dag.detectCycles();

      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should not detect cycles in acyclic graph', () => {
      const nodes = [
        createNode('1', 0, 0),
        createNode('2', 1, 0),
        createNode('3', 2, 0)
      ];
      const connections = [
        createConnection('1', '2'),
        createConnection('2', '3')
      ];

      const dag = new DAGManager(nodes, connections);
      const cycles = dag.detectCycles();

      expect(cycles.length).toBe(0);
    });
  });

  describe('Topological Sort', () => {
    it('should sort nodes topologically', () => {
      const nodes = [
        createNode('1', 0, 0),
        createNode('2', 1, 0),
        createNode('3', 2, 0)
      ];
      const connections = [
        createConnection('1', '2'),
        createConnection('2', '3')
      ];

      const dag = new DAGManager(nodes, connections);
      const result = dag.topologicalSort();

      expect(result.cycles.length).toBe(0);
      expect(result.sorted).toEqual(['1', '2', '3']);
    });

    it('should handle parallel branches', () => {
      const nodes = [
        createNode('1', 0, 0),
        createNode('2', 1, 0),
        createNode('3', 1, 1)
      ];
      const connections = [
        createConnection('1', '2'),
        createConnection('1', '3')
      ];

      const dag = new DAGManager(nodes, connections);
      const result = dag.topologicalSort();

      expect(result.cycles.length).toBe(0);
      expect(result.sorted[0]).toBe('1');
      expect(result.sorted.includes('2')).toBe(true);
      expect(result.sorted.includes('3')).toBe(true);
    });
  });

  describe('Execution Plan', () => {
    it('should create execution plan with levels', () => {
      const nodes = [
        createNode('1', 0, 0),
        createNode('2', 1, 0),
        createNode('3', 2, 0),
        createNode('4', 1, 1)
      ];
      const connections = [
        createConnection('1', '2'),
        createConnection('2', '3'),
        createConnection('1', '4')
      ];

      const dag = new DAGManager(nodes, connections);
      const plan = dag.createExecutionPlan();

      expect(plan.levels).toHaveLength(3);
      expect(plan.levels[0]).toContain('1');
      expect(plan.levels[1]).toContain('2');
      expect(plan.levels[1]).toContain('4');
      expect(plan.levels[2]).toContain('3');
    });

    it('should identify parallel executions', () => {
      const nodes = [
        createNode('1', 0, 0),
        createNode('2', 1, 0),
        createNode('3', 1, 1)
      ];
      const connections = [
        createConnection('1', '2'),
        createConnection('1', '3')
      ];

      const dag = new DAGManager(nodes, connections);
      const plan = dag.createExecutionPlan();

      const parallel1 = plan.parallelExecutions.get('2');
      const parallel3 = plan.parallelExecutions.get('3');

      expect(parallel1).toBeDefined();
      expect(parallel3).toBeDefined();
      expect(parallel1?.has('3')).toBe(true);
      expect(parallel3?.has('2')).toBe(true);
    });
  });

  describe('Navigation', () => {
    it('should get root nodes', () => {
      const nodes = [
        createNode('1', 0, 0),
        createNode('2', 1, 0),
        createNode('3', 2, 0)
      ];
      const connections = [
        createConnection('1', '2'),
        createConnection('2', '3')
      ];

      const dag = new DAGManager(nodes, connections);
      const roots = dag.getRootNodes();

      expect(roots).toHaveLength(1);
      expect(roots[0].id).toBe('1');
    });

    it('should get leaf nodes', () => {
      const nodes = [
        createNode('1', 0, 0),
        createNode('2', 1, 0),
        createNode('3', 2, 0)
      ];
      const connections = [
        createConnection('1', '2'),
        createConnection('2', '3')
      ];

      const dag = new DAGManager(nodes, connections);
      const leaves = dag.getLeafNodes();

      expect(leaves).toHaveLength(1);
      expect(leaves[0].id).toBe('3');
    });

    it('should get children', () => {
      const nodes = [
        createNode('1', 0, 0),
        createNode('2', 1, 0),
        createNode('3', 2, 0)
      ];
      const connections = [
        createConnection('1', '2'),
        createConnection('1', '3')
      ];

      const dag = new DAGManager(nodes, connections);
      const children = dag.getChildren('1');

      expect(children).toHaveLength(2);
      expect(children.map(c => c.id).sort()).toEqual(['2', '3']);
    });

    it('should get parents', () => {
      const nodes = [
        createNode('1', 0, 0),
        createNode('2', 1, 0),
        createNode('3', 2, 0)
      ];
      const connections = [
        createConnection('1', '3'),
        createConnection('2', '3')
      ];

      const dag = new DAGManager(nodes, connections);
      const parents = dag.getParents('3');

      expect(parents).toHaveLength(2);
      expect(parents.map(p => p.id).sort()).toEqual(['1', '2']);
    });
  });

  describe('Critical Path', () => {
    it('should calculate critical path', () => {
      const nodes = [
        createNode('1', 0, 0),
        createNode('2', 1, 0),
        createNode('3', 2, 0),
        createNode('4', 1, 1)
      ];
      const connections = [
        createConnection('1', '2'),
        createConnection('2', '3'),
        createConnection('1', '4')
      ];

      const dag = new DAGManager(nodes, connections);
      const path = dag.getCriticalPath();

      expect(path).toContain('1');
      expect(path.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Validation', () => {
    it('should validate DAG', () => {
      const nodes = [
        createNode('1', 0, 0),
        createNode('2', 1, 0)
      ];
      const connections = [
        createConnection('1', '2')
      ];

      const dag = new DAGManager(nodes, connections);
      const validation = dag.validate();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect validation errors', () => {
      const nodes = [
        createNode('1', 0, 0)
      ];
      const connections = [
        createConnection('1', '2') // Invalid target
      ];

      const dag = new DAGManager(nodes, connections);
      const validation = dag.validate();

      // Should have errors due to invalid connection
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should calculate DAG statistics', () => {
      const nodes = [
        createNode('1', 0, 0),
        createNode('2', 1, 0),
        createNode('3', 2, 0)
      ];
      const connections = [
        createConnection('1', '2'),
        createConnection('2', '3')
      ];

      const dag = new DAGManager(nodes, connections);
      const stats = dag.getStats();

      expect(stats.nodeCount).toBe(3);
      expect(stats.edgeCount).toBe(2);
      expect(stats.maxLevel).toBe(2);
      expect(stats.criticalPathLength).toBe(3);
    });
  });

  describe('DOT Export', () => {
    it('should export DAG as DOT format', () => {
      const nodes = [
        createNode('1', 0, 0),
        createNode('2', 1, 0)
      ];
      const connections = [
        createConnection('1', '2')
      ];

      const dag = new DAGManager(nodes, connections);
      const dot = dag.toDot();

      expect(dot).toContain('digraph Workflow');
      expect(dot).toContain('"1" -> "2"');
    });
  });
});
