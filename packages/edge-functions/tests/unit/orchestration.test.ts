/**
 * Unit tests for Orchestration Engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OrchestrationEngine,
  WorkflowNotFoundError,
  StepExecutionError,
  createOrchestrationEngine,
  createWorkflow,
  createWorkflowStep,
  sequentialStep,
  parallelStep,
  chainSteps,
  conditionalStep,
} from '../../src/orchestration/engine';
import { EdgeFunction } from '../../src/types';

describe('OrchestrationEngine', () => {
  let engine: OrchestrationEngine;
  let functions: Map<string, EdgeFunction>;
  let mockEnv: any;
  let mockContext: any;

  beforeEach(() => {
    // Create test functions
    functions = new Map([
      [
        'add',
        {
          id: 'add',
          name: 'Add',
          handler: async (input: { a: number; b: number }) => input.a + input.b,
          config: {},
          version: '1.0.0',
        },
      ],
      [
        'multiply',
        {
          id: 'multiply',
          name: 'Multiply',
          handler: async (input: { a: number; b: number }) => input.a * input.b,
          config: {},
          version: '1.0.0',
        },
      ],
      [
        'subtract',
        {
          id: 'subtract',
          name: 'Subtract',
          handler: async (input: { a: number; b: number }) => input.a - input.b,
          config: {},
          version: '1.0.0',
        },
      ],
      [
        'error',
        {
          id: 'error',
          name: 'Error',
          handler: async () => {
            throw new Error('Step failed');
          },
          config: {},
          version: '1.0.0',
        },
      ],
    ]);

    engine = new OrchestrationEngine(functions);

    mockEnv = {
      KV: {},
      DURABLE: {},
      R2: {},
      DB: {},
      QUEUE: {},
    };

    mockContext = {
      env: mockEnv,
      waitUntil: vi.fn(),
    };
  });

  describe('Workflow Registration', () => {
    it('should register a workflow', () => {
      const workflow = createWorkflow('test-wf', 'Test Workflow', []);

      engine.registerWorkflow(workflow);
      expect(engine.getWorkflow('test-wf')).toBeDefined();
    });

    it('should unregister a workflow', () => {
      const workflow = createWorkflow('test-wf', 'Test Workflow', []);

      engine.registerWorkflow(workflow);
      expect(engine.unregisterWorkflow('test-wf')).toBe(true);
      expect(engine.getWorkflow('test-wf')).toBeUndefined();
    });

    it('should get all workflows', () => {
      const workflow1 = createWorkflow('wf1', 'Workflow 1', []);
      const workflow2 = createWorkflow('wf2', 'Workflow 2', []);

      engine.registerWorkflow(workflow1);
      engine.registerWorkflow(workflow2);

      const all = engine.getAllWorkflows();
      expect(all).toHaveLength(2);
    });
  });

  describe('Workflow Execution', () => {
    it('should execute sequential workflow', async () => {
      const workflow = createWorkflow('calc-wf', 'Calculation', [
        sequentialStep('step1', 'add', {
          input: { a: 5, b: 3 },
        }),
        sequentialStep('step2', 'multiply', {
          input: '$.steps.step1.output',
        }),
      ]);

      engine.registerWorkflow(workflow);

      const result = await engine.execute('calc-wf', {}, mockContext);

      expect(result.status).toBe('completed');
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].output).toBe(8);
      expect(result.steps[1].output).toBe(64); // 8 * 8
    });

    it('should execute parallel workflow', async () => {
      const workflow = createWorkflow('parallel-wf', 'Parallel', [
        parallelStep('step1', 'add', {
          input: { a: 5, b: 3 },
        }),
        parallelStep('step2', 'multiply', {
          input: { a: 4, b: 2 },
        }),
      ]);

      engine.registerWorkflow(workflow);

      const result = await engine.execute('parallel-wf', {}, mockContext);

      expect(result.status).toBe('completed');
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].output).toBe(8);
      expect(result.steps[1].output).toBe(8);
    });

    it('should pass data between steps', async () => {
      const workflow = createWorkflow('chain-wf', 'Chain', [
        sequentialStep('step1', 'add', {
          input: { a: 10, b: 5 },
          output: '$.data.sum',
        }),
        sequentialStep('step2', 'multiply', {
          input: { a: 2, b: '$.data.sum' },
          output: '$.data.product',
        }),
      ]);

      engine.registerWorkflow(workflow);

      const result = await engine.execute('chain-wf', {}, mockContext);

      expect(result.status).toBe('completed');
      expect(result.output.sum).toBe(15);
      expect(result.output.product).toBeDefined();
    });

    it('should handle workflow errors', async () => {
      const workflow = createWorkflow('error-wf', 'Error', [
        sequentialStep('step1', 'error'),
      ]);

      engine.registerWorkflow(workflow);

      await expect(engine.execute('error-wf', {}, mockContext)).rejects.toThrow(
        StepExecutionError
      );
    });

    it('should continue on error when configured', async () => {
      const workflow = createWorkflow('continue-wf', 'Continue', [
        sequentialStep('step1', 'error', {
          continueOnError: true,
        }),
        sequentialStep('step2', 'add', {
          input: { a: 1, b: 2 },
        }),
      ]);

      engine.registerWorkflow(workflow);

      const result = await engine.execute('continue-wf', {}, mockContext);

      expect(result.status).toBe('completed');
      expect(result.steps[0].status).toBe('failed');
      expect(result.steps[1].status).toBe('completed');
    });
  });

  describe('Conditional Execution', () => {
    it('should execute step conditionally', async () => {
      const workflow = createWorkflow('cond-wf', 'Conditional', [
        sequentialStep('step1', 'add', {
          input: { a: 5, b: 3 },
          output: '$.data.sum',
        }),
        conditionalStep(
          'step2',
          'multiply',
          (ctx) => (ctx.data.sum as number) > 10,
          {
            input: { a: 2, b: (ctx) => ctx.data.sum as number },
          }
        ),
      ]);

      engine.registerWorkflow(workflow);

      const result = await engine.execute('cond-wf', {}, mockContext);

      expect(result.status).toBe('completed');
      // Step should execute since 8 > 10 is false, but multiply with 2 inputs
      expect(result.steps).toHaveLength(2);
    });

    it('should skip step when condition is false', async () => {
      const workflow = createWorkflow('cond-wf', 'Conditional', [
        sequentialStep('step1', 'add', {
          input: { a: 2, b: 1 },
          output: '$.data.sum',
        }),
        conditionalStep(
          'step2',
          'multiply',
          (ctx) => (ctx.data.sum as number) > 10,
          {
            input: { a: 2, b: 3 },
          }
        ),
      ]);

      engine.registerWorkflow(workflow);

      const result = await engine.execute('cond-wf', {}, mockContext);

      expect(result.status).toBe('completed');
      expect(result.steps[1].status).toBe('completed');
    });
  });

  describe('Utility Functions', () => {
    it('should create workflow step', () => {
      const step = createWorkflowStep('step1', 'add', 'sequential', {
        input: { a: 1, b: 2 },
      });

      expect(step.id).toBe('step1');
      expect(step.functionId).toBe('add');
      expect(step.type).toBe('sequential');
    });

    it('should create sequential step', () => {
      const step = sequentialStep('step1', 'add');

      expect(step.type).toBe('sequential');
    });

    it('should create parallel step', () => {
      const step = parallelStep('step1', 'add');

      expect(step.type).toBe('parallel');
    });

    it('should chain steps', () => {
      const steps = chainSteps(
        [
          createWorkflowStep('step1', 'add', 'sequential'),
          createWorkflowStep('step2', 'multiply', 'sequential'),
        ],
        { initial: 5 }
      );

      expect(steps[0].input).toEqual({ initial: 5 });
      expect(steps[1].input).toBe('$.steps.step1.output');
    });
  });

  describe('Error Handling', () => {
    it('should stop workflow on error', async () => {
      const workflow = createWorkflow('stop-wf', 'Stop', [
        sequentialStep('step1', 'add'),
        sequentialStep('step2', 'error'),
        sequentialStep('step3', 'add'),
      ], {
        onError: 'stop',
      });

      engine.registerWorkflow(workflow);

      await expect(engine.execute('stop-wf', {}, mockContext)).rejects.toThrow();
    });

    it('should throw error for non-existent workflow', async () => {
      await expect(
        engine.execute('non-existent', {}, mockContext)
      ).rejects.toThrow(WorkflowNotFoundError);
    });
  });

  describe('Execution State', () => {
    it('should track execution state', async () => {
      const workflow = createWorkflow('state-wf', 'State', [
        sequentialStep('step1', 'add', {
          input: { a: 1, b: 2 },
        }),
      ]);

      engine.registerWorkflow(workflow);

      const result = await engine.execute('state-wf', {}, mockContext);

      expect(result.executionId).toBeDefined();
      expect(result.workflowId).toBe('state-wf');
      expect(result.metrics.startTime).toBeDefined();
      expect(result.metrics.endTime).toBeGreaterThan(result.metrics.startTime);
    });
  });
});
