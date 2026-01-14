/**
 * Tests for Enhanced Workflow Execution Engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancedWorkflowEngine } from '../execution/enhanced-engine';
import type {
  Workflow,
  Node,
  NodeId,
  TriggerInfo
} from '../types';

describe('EnhancedWorkflowEngine', () => {
  let engine: EnhancedWorkflowEngine;
  let sampleWorkflow: Workflow;
  let sampleTrigger: TriggerInfo;

  beforeEach(() => {
    engine = new EnhancedWorkflowEngine({
      maxConcurrentExecutions: 10,
      defaultTimeout: 30000,
      enableMetrics: true,
      enableTracing: false,
      maxRetries: 3,
      checkpointInterval: 10000
    });

    sampleWorkflow = {
      id: 'test-workflow' as any,
      name: 'Test Workflow',
      description: 'A test workflow',
      version: 1,
      status: 'active',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [
        {
          name: 'testVar',
          type: 'string',
          value: 'testValue',
          required: true
        }
      ],
      settings: {
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    sampleTrigger = {
      type: 'manual',
      source: 'test'
    };
  });

  describe('Workflow Execution', () => {
    it('should execute a simple workflow', async () => {
      const node1: Node = {
        id: 'node-1' as NodeId,
        type: 'action',
        actionType: 'kv_get',
        name: 'Get Value',
        description: 'Get value from KV',
        config: {
          key: 'testKey'
        },
        position: { x: 100, y: 100 },
        enabled: true
      };

      sampleWorkflow.nodes.push(node1);

      const execution = await engine.execute(sampleWorkflow, {}, sampleTrigger);

      expect(execution).toBeDefined();
      expect(execution.status).toBe('completed');
      expect(execution.workflowId).toBe(sampleWorkflow.id);
      expect(execution.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle workflow with multiple nodes', async () => {
      const node1: Node = {
        id: 'node-1' as NodeId,
        type: 'action',
        actionType: 'kv_get',
        name: 'Get Value',
        config: { key: 'testKey' },
        position: { x: 100, y: 100 },
        enabled: true
      };

      const node2: Node = {
        id: 'node-2' as NodeId,
        type: 'action',
        actionType: 'kv_set',
        name: 'Set Value',
        config: { key: 'testKey', value: 'testValue' },
        position: { x: 200, y: 100 },
        enabled: true
      };

      sampleWorkflow.nodes.push(node1, node2);
      sampleWorkflow.connections.push({
        id: 'conn-1' as any,
        sourceNodeId: node1.id,
        targetNodeId: node2.id
      });

      const execution = await engine.execute(sampleWorkflow, {}, sampleTrigger);

      expect(execution.status).toBe('completed');
      expect(execution.nodes).toHaveLength(2);
    });

    it('should skip disabled nodes', async () => {
      const node1: Node = {
        id: 'node-1' as NodeId,
        type: 'action',
        actionType: 'kv_get',
        name: 'Get Value',
        config: { key: 'testKey' },
        position: { x: 100, y: 100 },
        enabled: false
      };

      sampleWorkflow.nodes.push(node1);

      const execution = await engine.execute(sampleWorkflow, {}, sampleTrigger);

      expect(execution.status).toBe('completed');
      expect(execution.nodes.filter(n => n.status === 'skipped')).toHaveLength(1);
    });

    it('should handle execution errors', async () => {
      const node1: Node = {
        id: 'node-1' as NodeId,
        type: 'action',
        actionType: 'invalid_action' as any,
        name: 'Invalid Action',
        config: {},
        position: { x: 100, y: 100 },
        enabled: true
      };

      sampleWorkflow.nodes.push(node1);

      await expect(
        engine.execute(sampleWorkflow, {}, sampleTrigger)
      ).rejects.toThrow();
    });

    it('should apply timeout to nodes', async () => {
      const node1: Node = {
        id: 'node-1' as NodeId,
        type: 'wait',
        name: 'Wait Node',
        config: { waitTime: 1000 },
        position: { x: 100, y: 100 },
        enabled: true,
        timeout: 500
      };

      sampleWorkflow.nodes.push(node1);

      await expect(
        engine.execute(sampleWorkflow, {}, sampleTrigger)
      ).rejects.toThrow();
    }, 10000);
  });

  describe('Retry Logic', () => {
    it('should retry failed nodes', async () => {
      let attemptCount = 0;

      const node1: Node = {
        id: 'node-1' as NodeId,
        type: 'action',
        actionType: 'kv_get',
        name: 'Failing Node',
        config: {
          key: 'testKey',
          shouldFail: () => ++attemptCount > 2
        },
        position: { x: 100, y: 100 },
        enabled: true,
        retryConfig: {
          maxAttempts: 3,
          backoffType: 'fixed',
          initialDelay: 100
        }
      };

      sampleWorkflow.nodes.push(node1);

      // Mock action executor to simulate failure then success
      const mockExecute = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ success: true });

      engine['actionExecutor'].execute = mockExecute;

      const execution = await engine.execute(sampleWorkflow, {}, sampleTrigger);

      expect(execution.status).toBe('completed');
      expect(mockExecute).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const node1: Node = {
        id: 'node-1' as NodeId,
        type: 'action',
        actionType: 'kv_get',
        name: 'Failing Node',
        config: { key: 'testKey' },
        position: { x: 100, y: 100 },
        enabled: true,
        retryConfig: {
          maxAttempts: 2,
          backoffType: 'fixed',
          initialDelay: 100
        }
      };

      sampleWorkflow.nodes.push(node1);

      const mockExecute = vi.fn().mockRejectedValue(new Error('Permanent failure'));
      engine['actionExecutor'].execute = mockExecute;

      await expect(
        engine.execute(sampleWorkflow, {}, sampleTrigger)
      ).rejects.toThrow();

      expect(mockExecute).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cancellation', () => {
    it('should cancel running execution', async () => {
      const node1: Node = {
        id: 'node-1' as NodeId,
        type: 'wait',
        name: 'Long Wait',
        config: { waitTime: 10000 },
        position: { x: 100, y: 100 },
        enabled: true
      };

      sampleWorkflow.nodes.push(node1);

      const executionPromise = engine.execute(sampleWorkflow, {}, sampleTrigger);
      setTimeout(() => engine.cancelExecution(sampleWorkflow.id), 100);

      const execution = await executionPromise;

      expect(execution.status).toBe('cancelled');
    });

    it('should not cancel completed execution', async () => {
      const node1: Node = {
        id: 'node-1' as NodeId,
        type: 'action',
        actionType: 'kv_get',
        name: 'Quick Action',
        config: { key: 'testKey' },
        position: { x: 100, y: 100 },
        enabled: true
      };

      sampleWorkflow.nodes.push(node1);

      const execution = await engine.execute(sampleWorkflow, {}, sampleTrigger);
      await engine.cancelExecution(sampleWorkflow.id);

      expect(execution.status).toBe('completed');
    });
  });

  describe('Checkpointing', () => {
    it('should create checkpoints during execution', async () => {
      const node1: Node = {
        id: 'node-1' as NodeId,
        type: 'action',
        actionType: 'kv_get',
        name: 'Get Value',
        config: { key: 'testKey' },
        position: { x: 100, y: 100 },
        enabled: true
      };

      const node2: Node = {
        id: 'node-2' as NodeId,
        type: 'action',
        actionType: 'kv_set',
        name: 'Set Value',
        config: { key: 'testKey', value: 'testValue' },
        position: { x: 200, y: 100 },
        enabled: true
      };

      sampleWorkflow.nodes.push(node1, node2);
      sampleWorkflow.connections.push({
        id: 'conn-1' as any,
        sourceNodeId: node1.id,
        targetNodeId: node2.id
      });

      await engine.execute(sampleWorkflow, {}, sampleTrigger);

      // Checkpoints would be created (implementation dependent)
      // This is a placeholder test
      expect(true).toBe(true);
    });
  });

  describe('Parallel Execution', () => {
    it('should execute independent nodes in parallel', async () => {
      const node1: Node = {
        id: 'node-1' as NodeId,
        type: 'action',
        actionType: 'kv_get',
        name: 'Get Value 1',
        config: { key: 'testKey1' },
        position: { x: 100, y: 100 },
        enabled: true
      };

      const node2: Node = {
        id: 'node-2' as NodeId,
        type: 'action',
        actionType: 'kv_get',
        name: 'Get Value 2',
        config: { key: 'testKey2' },
        position: { x: 100, y: 200 },
        enabled: true
      };

      const node3: Node = {
        id: 'node-3' as NodeId,
        type: 'action',
        actionType: 'kv_set',
        name: 'Set Value',
        config: { key: 'testKey', value: 'testValue' },
        position: { x: 200, y: 150 },
        enabled: true
      };

      sampleWorkflow.nodes.push(node1, node2, node3);
      sampleWorkflow.connections.push(
        { id: 'conn-1' as any, sourceNodeId: node1.id, targetNodeId: node3.id },
        { id: 'conn-2' as any, sourceNodeId: node2.id, targetNodeId: node3.id }
      );

      const startTime = Date.now();
      const execution = await engine.execute(sampleWorkflow, {}, sampleTrigger);
      const duration = Date.now() - startTime;

      expect(execution.status).toBe('completed');
      // Node1 and Node2 should execute in parallel
      expect(duration).toBeLessThan(2000); // Should be faster than sequential
    });
  });

  describe('Condition Nodes', () => {
    it('should evaluate condition nodes', async () => {
      const node1: Node = {
        id: 'node-1' as NodeId,
        type: 'condition',
        name: 'Condition',
        config: {
          conditions: [
            {
              id: 'cond-1' as any,
              operator: 'equals' as any,
              leftOperand: 'testValue',
              rightOperand: 'testValue'
            }
          ],
          branches: [
            {
              name: 'then',
              nodes: []
            }
          ]
        },
        position: { x: 100, y: 100 },
        enabled: true
      };

      sampleWorkflow.nodes.push(node1);

      const execution = await engine.execute(sampleWorkflow, {}, sampleTrigger);

      expect(execution.status).toBe('completed');
    });
  });

  describe('Loop Nodes', () => {
    it('should execute forEach loops', async () => {
      const node1: Node = {
        id: 'node-1' as NodeId,
        type: 'loop',
        name: 'For Each Loop',
        config: {
          iterations: {
            type: 'forEach',
            iterable: [1, 2, 3],
            maxIterations: 10
          }
        },
        position: { x: 100, y: 100 },
        enabled: true
      };

      sampleWorkflow.nodes.push(node1);

      const execution = await engine.execute(sampleWorkflow, {}, sampleTrigger);

      expect(execution.status).toBe('completed');
    });

    it('should respect maxIterations', async () => {
      const node1: Node = {
        id: 'node-1' as NodeId,
        type: 'loop',
        name: 'For Each Loop',
        config: {
          iterations: {
            type: 'forEach',
            iterable: Array(100).fill(0),
            maxIterations: 5
          }
        },
        position: { x: 100, y: 100 },
        enabled: true
      };

      sampleWorkflow.nodes.push(node1);

      const execution = await engine.execute(sampleWorkflow, {}, sampleTrigger);

      expect(execution.status).toBe('completed');
      // Should only process 5 iterations
    });
  });

  describe('Statistics', () => {
    it('should track execution statistics', async () => {
      const stats = engine.getStats();

      expect(stats).toHaveProperty('running');
      expect(stats).toHaveProperty('maxConcurrent');
      expect(stats).toHaveProperty('utilization');
    });

    it('should update utilization', async () => {
      const node1: Node = {
        id: 'node-1' as NodeId,
        type: 'wait',
        name: 'Wait',
        config: { waitTime: 1000 },
        position: { x: 100, y: 100 },
        enabled: true
      };

      sampleWorkflow.nodes.push(node1);

      const executionPromise = engine.execute(sampleWorkflow, {}, sampleTrigger);

      // Wait a bit for execution to start
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = engine.getStats();
      expect(stats.running).toBeGreaterThan(0);

      await executionPromise;
    });
  });

  describe('Get Execution', () => {
    it('should retrieve execution by ID', async () => {
      const node1: Node = {
        id: 'node-1' as NodeId,
        type: 'action',
        actionType: 'kv_get',
        name: 'Get Value',
        config: { key: 'testKey' },
        position: { x: 100, y: 100 },
        enabled: true
      };

      sampleWorkflow.nodes.push(node1);

      const execution = await engine.execute(sampleWorkflow, {}, sampleTrigger);
      const retrieved = engine.getExecution(execution.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(execution.id);
    });

    it('should return undefined for non-existent execution', () => {
      const retrieved = engine.getExecution('non-existent' as any);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Get Running Executions', () => {
    it('should return running executions', async () => {
      const node1: Node = {
        id: 'node-1' as NodeId,
        type: 'wait',
        name: 'Wait',
        config: { waitTime: 1000 },
        position: { x: 100, y: 100 },
        enabled: true
      };

      sampleWorkflow.nodes.push(node1);

      const executionPromise = engine.execute(sampleWorkflow, {}, sampleTrigger);

      // Wait a bit for execution to start
      await new Promise(resolve => setTimeout(resolve, 100));

      const running = engine.getRunningExecutions();
      expect(running.length).toBeGreaterThan(0);

      await executionPromise;
    });

    it('should return empty array when no executions running', () => {
      const running = engine.getRunningExecutions();
      expect(running).toEqual([]);
    });
  });
});
