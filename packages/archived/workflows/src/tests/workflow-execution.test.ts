/**
 * Workflow Execution Tests
 */

import { describe, it, expect } from '@jest/globals';
import { WorkflowExecutionEngine } from '../engine';
import { WorkflowBuilder } from '../builder';
import { TriggerManager } from '../triggers';

describe('Workflow Execution', () => {
  let engine: WorkflowExecutionEngine;
  let builder: WorkflowBuilder;
  let triggerManager: TriggerManager;

  beforeEach(() => {
    engine = new WorkflowExecutionEngine({
      maxConcurrentExecutions: 10,
      defaultTimeout: 30000,
      enableMetrics: true
    });
    builder = new WorkflowBuilder();
    triggerManager = new TriggerManager();
  });

  describe('Engine', () => {
    it('should create a new engine', () => {
      expect(engine).toBeDefined();
      expect(engine.getStats().maxConcurrent).toBe(10);
    });

    it('should execute a simple workflow', async () => {
      // Create a simple workflow
      const node1 = builder.addNode('action', 'log', { x: 100, y: 100 });
      builder.updateNode(node1.id, {
        config: {
          parameters: {
            level: 'info',
            message: 'Test workflow'
          }
        }
      });

      const workflow = builder.getWorkflow();

      const execution = await engine.execute(
        workflow,
        {},
        {
          type: 'manual',
          data: {}
        }
      );

      expect(execution.status).toBe('completed');
      expect(execution.duration).toBeGreaterThan(0);
    });

    it('should handle parallel execution', async () => {
      const node1 = builder.addNode('action', 'log', { x: 100, y: 100 });
      const node2 = builder.addNode('action', 'log', { x: 300, y: 100 });
      const node3 = builder.addNode('action', 'log', { x: 500, y: 100 });

      builder.connectNodes(node1.id, node3.id);
      builder.connectNodes(node2.id, node3.id);

      const workflow = builder.getWorkflow();
      const execution = await engine.execute(workflow, {}, { type: 'manual', data: {} });

      expect(execution.status).toBe('completed');
    });

    it('should cancel a running execution', async () => {
      const node1 = builder.addNode('action', 'wait', { x: 100, y: 100 });
      builder.updateNode(node1.id, {
        config: {
          waitTime: 10000
        }
      });

      const workflow = builder.getWorkflow();

      const executionPromise = engine.execute(workflow, {}, { type: 'manual', data: {} });
      await engine.cancelExecution(executionPromise.then(e => e.id));

      const execution = await executionPromise;
      expect(execution.status).toBe('cancelled');
    });
  });

  describe('Builder', () => {
    it('should create a new workflow', () => {
      builder.setMetadata({
        name: 'Test Workflow',
        description: 'A test workflow'
      });

      const workflow = builder.getWorkflow();
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.description).toBe('A test workflow');
    });

    it('should add and manage nodes', () => {
      const node = builder.addNode('action', 'send_slack', { x: 100, y: 100 });
      expect(node).toBeDefined();
      expect(node.type).toBe('action');
      expect(node.actionType).toBe('send_slack');

      const workflow = builder.getWorkflow();
      expect(workflow.nodes).toHaveLength(1);

      builder.updateNode(node.id, { name: 'Updated Node' });
      expect(workflow.nodes[0].name).toBe('Updated Node');

      builder.deleteNode(node.id);
      expect(workflow.nodes).toHaveLength(0);
    });

    it('should connect nodes', () => {
      const node1 = builder.addNode('action', 'log', { x: 100, y: 100 });
      const node2 = builder.addNode('action', 'log', { x: 300, y: 100 });

      const connection = builder.connectNodes(node1.id, node2.id);
      expect(connection).toBeDefined();
      expect(connection.sourceNodeId).toBe(node1.id);
      expect(connection.targetNodeId).toBe(node2.id);

      const workflow = builder.getWorkflow();
      expect(workflow.connections).toHaveLength(1);
    });

    it('should detect cycles', () => {
      const node1 = builder.addNode('action', 'log', { x: 100, y: 100 });
      const node2 = builder.addNode('action', 'log', { x: 300, y: 100 });
      const node3 = builder.addNode('action', 'log', { x: 500, y: 100 });

      builder.connectNodes(node1.id, node2.id);
      builder.connectNodes(node2.id, node3.id);
      builder.connectNodes(node3.id, node1.id);

      const validation = builder.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.message.includes('Cycle'))).toBe(true);
    });

    it('should support undo/redo', () => {
      const node1 = builder.addNode('action', 'log', { x: 100, y: 100 });
      const nodeCount1 = builder.getWorkflow().nodes.length;

      builder.addNode('action', 'log', { x: 300, y: 100 });
      const nodeCount2 = builder.getWorkflow().nodes.length;

      expect(nodeCount2).toBe(nodeCount1 + 1);

      builder.undo();
      expect(builder.getWorkflow().nodes.length).toBe(nodeCount1);

      builder.redo();
      expect(builder.getWorkflow().nodes.length).toBe(nodeCount2);
    });

    it('should copy and paste nodes', () => {
      const node1 = builder.addNode('action', 'send_slack', { x: 100, y: 100 });
      builder.selectNodes([node1.id]);
      builder.copy();
      builder.paste();

      const workflow = builder.getWorkflow();
      expect(workflow.nodes).toHaveLength(2);
      expect(workflow.nodes[1].name).toContain('copy');
    });
  });

  describe('Triggers', () => {
    it('should register a webhook trigger', async () => {
      const workflow = builder.getWorkflow();

      let triggered = false;
      const callback = async (triggerId: string, data: any) => {
        triggered = true;
      };

      await triggerManager.registerTrigger(
        {
          id: 'webhook-1',
          type: 'webhook',
          name: 'Test Webhook',
          nodeId: 'node-1',
          enabled: true,
          config: {
            type: 'webhook',
            endpoint: '/test',
            method: 'POST'
          }
        },
        callback
      );

      const stats = triggerManager.getStats();
      expect(stats.totalTriggers).toBe(1);
      expect(stats.triggersByType.webhook).toBe(1);
    });

    it('should register a schedule trigger', async () => {
      let triggered = false;
      const callback = async (triggerId: string, data: any) => {
        triggered = true;
      };

      await triggerManager.registerTrigger(
        {
          id: 'schedule-1',
          type: 'schedule',
          name: 'Test Schedule',
          nodeId: 'node-1',
          enabled: true,
          config: {
            type: 'schedule',
            scheduleType: 'cron',
            cron: '0 * * * *'
          }
        },
        callback
      );

      const stats = triggerManager.getStats();
      expect(stats.triggersByType.schedule).toBe(1);
    });

    it('should enable and disable triggers', async () => {
      const callback = async (triggerId: string, data: any) => {};

      await triggerManager.registerTrigger(
        {
          id: 'trigger-1',
          type: 'manual',
          name: 'Test Trigger',
          nodeId: 'node-1',
          enabled: true,
          config: {
            type: 'manual'
          }
        },
        callback
      );

      await triggerManager.disableTrigger('trigger-1');
      let trigger = triggerManager.getTrigger('trigger-1');
      expect(trigger?.enabled).toBe(false);

      await triggerManager.enableTrigger('trigger-1');
      trigger = triggerManager.getTrigger('trigger-1');
      expect(trigger?.enabled).toBe(true);
    });
  });

  describe('DAG', () => {
    it('should create valid execution plan', () => {
      const node1 = builder.addNode('action', 'log', { x: 100, y: 100 });
      const node2 = builder.addNode('action', 'log', { x: 300, y: 100 });
      const node3 = builder.addNode('action', 'log', { x: 500, y: 100 });

      builder.connectNodes(node1.id, node2.id);
      builder.connectNodes(node2.id, node3.id);

      const workflow = builder.getWorkflow();
      const execution = engine.execute(workflow, {}, { type: 'manual', data: {} });

      expect(execution).resolves.toBeDefined();
    });

    it('should execute parallel branches', () => {
      const node1 = builder.addNode('action', 'log', { x: 100, y: 100 });
      const node2 = builder.addNode('action', 'log', { x: 300, y: 50 });
      const node3 = builder.addNode('action', 'log', { x: 300, y: 150 });
      const node4 = builder.addNode('action', 'log', { x: 500, y: 100 });

      builder.connectNodes(node1.id, node2.id);
      builder.connectNodes(node1.id, node3.id);
      builder.connectNodes(node2.id, node4.id);
      builder.connectNodes(node3.id, node4.id);

      const workflow = builder.getWorkflow();
      const execution = engine.execute(workflow, {}, { type: 'manual', data: {} });

      expect(execution).resolves.toBeDefined();
    });
  });

  describe('Conditions', () => {
    it('should evaluate simple conditions', async () => {
      const node1 = builder.addNode('condition', undefined, { x: 100, y: 100 });
      builder.updateNode(node1.id, {
        config: {
          conditions: [
            {
              id: 'cond-1',
              operator: 'equals',
              leftOperand: 'status',
              rightOperand: 'success'
            }
          ]
        }
      });

      const workflow = builder.getWorkflow();
      const execution = engine.execute(
        workflow,
        { status: 'success' },
        { type: 'manual', data: {} }
      );

      expect(execution).resolves.toBeDefined();
    });
  });

  describe('Templates', () => {
    it('should create workflow from template', () => {
      const { TemplateRegistry } = require('../templates');
      const templates = new TemplateRegistry();

      const template = templates.get('template-pr-workflow');
      expect(template).toBeDefined();

      const workflow = templates.createFromTemplate('template-pr-workflow', {
        repoOwner: 'test-org',
        repoName: 'test-repo',
        testFramework: 'jest'
      });

      expect(workflow.name).toContain('test-org/test-repo');
      expect(workflow.nodes.length).toBeGreaterThan(0);
    });
  });
});
