/**
 * Integration Tests - Complete State Machine Workflows
 */

import { describe, it, expect } from 'vitest';
import { StateMachineEngine, createStateMachine } from '../../src/engine/engine.js';
import { StateManager, InMemoryPersistenceAdapter } from '../../src/state/manager.js';
import { TransitionHandler } from '../../src/transitions/handler.js';
import { StateVisualizer } from '../../src/visualization/visualizer.js';
import { StateMachineTester } from '../../src/testing/tester.js';
import { StateMachineAnalytics } from '../../src/analytics/analytics.js';
import { StateMachineDefinition } from '../../src/types/index.js';

describe('Complete Workflow Integration', () => {
  describe('Order Processing Workflow', () => {
    let definition: StateMachineDefinition;

    beforeAll(() => {
      definition = {
        initial: 'created',
        context: {
          orderId: null,
          items: [],
          total: 0,
          paymentStatus: 'pending',
        },
        states: {
          created: {
            onEntry: ctx => {
              ctx.data!.orderId = `ORD-${Date.now()}`;
            },
            transitions: [
              {
                from: 'created',
                to: 'validated',
                on: 'VALIDATE',
                guard: ctx => {
                  const items = (ctx.data!.items as any[]).length;
                  return items > 0 && items <= 100;
                },
              },
              {
                from: 'created',
                to: 'cancelled',
                on: 'CANCEL',
              },
            ],
          },
          validated: {
            transitions: [
              {
                from: 'validated',
                to: 'payment_pending',
                on: 'REQUEST_PAYMENT',
                action: ctx => {
                  ctx.data!.paymentStatus = 'pending';
                },
              },
              {
                from: 'validated',
                to: 'cancelled',
                on: 'CANCEL',
              },
            ],
          },
          payment_pending: {
            transitions: [
              {
                from: 'payment_pending',
                to: 'paid',
                on: 'PAYMENT_CONFIRMED',
                guard: ctx => ctx.data!.paymentStatus === 'paid',
              },
              {
                from: 'payment_pending',
                to: 'payment_failed',
                on: 'PAYMENT_FAILED',
              },
              {
                from: 'payment_pending',
                to: 'cancelled',
                on: 'CANCEL',
              },
            ],
          },
          paid: {
            transitions: [
              {
                from: 'paid',
                to: 'processing',
                on: 'PROCESS',
              },
            ],
          },
          processing: {
            transitions: [
              {
                from: 'processing',
                to: 'shipped',
                on: 'SHIP',
              },
              {
                from: 'processing',
                to: 'failed',
                on: 'FAIL',
              },
            ],
          },
          shipped: {
            onEntry: ctx => {
              ctx.data!.shippedAt = Date.now();
            },
            transitions: [
              {
                from: 'shipped',
                to: 'delivered',
                on: 'DELIVER',
              },
            ],
          },
          delivered: {
            final: true,
          },
          failed: {
            transitions: [
              {
                from: 'failed',
                to: 'cancelled',
                on: 'CANCEL',
              },
              {
                from: 'failed',
                to: 'processing',
                on: 'RETRY',
              },
            ],
          },
          cancelled: {
            final: true,
          },
          payment_failed: {
            transitions: [
              {
                from: 'payment_failed',
                to: 'payment_pending',
                on: 'RETRY_PAYMENT',
              },
              {
                from: 'payment_failed',
                to: 'cancelled',
                on: 'CANCEL',
              },
            ],
          },
        },
      };
    });

    it('should complete successful order flow', async () => {
      const machine = createStateMachine(definition, {
        enableMetrics: true,
      });

      expect(machine.state).toBe('created');

      // Set items
      machine.context = {
        orderId: null,
        items: ['item1', 'item2'],
        total: 100,
        paymentStatus: 'pending',
      };

      await machine.send('VALIDATE');
      expect(machine.state).toBe('validated');

      await machine.send('REQUEST_PAYMENT');
      expect(machine.state).toBe('payment_pending');

      machine.context!.paymentStatus = 'paid';
      await machine.send('PAYMENT_CONFIRMED');
      expect(machine.state).toBe('paid');

      await machine.send('PROCESS');
      expect(machine.state).toBe('processing');

      await machine.send('SHIP');
      expect(machine.state).toBe('shipped');

      await machine.send('DELIVER');
      expect(machine.state).toBe('delivered');

      // Verify history
      expect(machine.history).toEqual([
        'created',
        'validated',
        'payment_pending',
        'paid',
        'processing',
        'shipped',
        'delivered',
      ]);
    });

    it('should handle payment failure flow', async () => {
      const machine = createStateMachine(definition);

      machine.context = {
        orderId: null,
        items: ['item1'],
        total: 50,
        paymentStatus: 'pending',
      };

      await machine.send('VALIDATE');
      await machine.send('REQUEST_PAYMENT');
      await machine.send('PAYMENT_FAILED');

      expect(machine.state).toBe('payment_failed');

      // Retry payment
      machine.context!.paymentStatus = 'paid';
      await machine.send('RETRY_PAYMENT');

      expect(machine.state).toBe('payment_pending');
      await machine.send('PAYMENT_CONFIRMED');
      expect(machine.state).toBe('paid');
    });

    it('should handle cancellation from any state', async () => {
      const machine = createStateMachine(definition);

      machine.context = {
        orderId: null,
        items: ['item1'],
        total: 50,
        paymentStatus: 'pending',
      };

      await machine.send('VALIDATE');
      await machine.send('CANCEL');

      expect(machine.state).toBe('cancelled');
    });

    it('should enforce validation guard', async () => {
      const machine = createStateMachine(definition);

      // Try to validate without items
      machine.context = {
        orderId: null,
        items: [],
        total: 0,
        paymentStatus: 'pending',
      };

      await expect(machine.send('VALIDATE')).rejects.toThrow();
      expect(machine.state).toBe('created');
    });
  });

  describe('State Manager Integration', () => {
    it('should persist and restore state', async () => {
      const definition: StateMachineDefinition = {
        initial: 'idle',
        states: {
          idle: {
            transitions: [{ from: 'idle', to: 'running', on: 'START' }],
          },
          running: {
            transitions: [{ from: 'running', to: 'idle', on: 'STOP' }],
          },
        },
      };

      const persistence = new InMemoryPersistenceAdapter();

      // Create and use machine
      const machine1 = createStateMachine(definition);
      const manager1 = new StateManager(machine1, { persistenceAdapter: persistence });

      await machine1.send('START');
      await manager1.save('After start');

      expect(machine1.state).toBe('running');

      // Create new machine and restore
      const machine2 = createStateMachine(definition);
      const manager2 = new StateManager(machine2, { persistenceAdapter: persistence });

      await manager2.load();

      expect(machine2.state).toBe('running');
      expect(machine2.history).toEqual(['idle', 'running']);
    });

    it('should create and restore versions', async () => {
      const definition: StateMachineDefinition = {
        initial: 'A',
        states: {
          A: {
            transitions: [
              { from: 'A', to: 'B', on: 'GO' },
              { from: 'A', to: 'C', on: 'SKIP' },
            ],
          },
          B: {
            transitions: [{ from: 'B', to: 'C', on: 'GO' }],
          },
          C: {
            final: true,
          },
        },
      };

      const machine = createStateMachine(definition);
      const manager = new StateManager(machine, {
        enableVersioning: true,
        maxVersions: 10,
      });

      // Create version at A
      await manager.checkpoint('At A');

      await machine.send('GO');
      expect(machine.state).toBe('B');

      // Create version at B
      await manager.checkpoint('At B');

      await machine.send('GO');
      expect(machine.state).toBe('C');

      // Restore to B
      await manager.restoreVersion(2);
      expect(machine.state).toBe('B');

      // Restore to A
      await manager.restoreVersion(1);
      expect(machine.state).toBe('A');
    });
  });

  describe('Transition Handler Integration', () => {
    it('should execute transition hooks', async () => {
      const definition: StateMachineDefinition = {
        initial: 'idle',
        states: {
          idle: {
            transitions: [{ from: 'idle', to: 'running', on: 'START' }],
          },
          running: {},
        },
      };

      const machine = createStateMachine(definition);
      const handler = new TransitionHandler(machine);

      const beforeHook = vi.fn();
      const afterHook = vi.fn();

      handler.addBeforeHook(beforeHook);
      handler.addAfterHook(afterHook);

      await machine.send('START');

      expect(beforeHook).toHaveBeenCalledTimes(1);
      expect(afterHook).toHaveBeenCalledTimes(1);
      expect(machine.state).toBe('running');
    });

    it('should retry failed transitions', async () => {
      let attempts = 0;

      const definition: StateMachineDefinition = {
        initial: 'idle',
        states: {
          idle: {
            transitions: [
              {
                from: 'idle',
                to: 'running',
                on: 'START',
                action: () => {
                  attempts++;
                  if (attempts < 3) {
                    throw new Error('Not yet');
                  }
                },
              },
            ],
          },
          running: {},
        },
      };

      const machine = createStateMachine(definition);
      const handler = new TransitionHandler(machine, {
        retryAttempts: 3,
        retryDelay: 10,
      });

      await machine.send('START');

      expect(attempts).toBe(3);
      expect(machine.state).toBe('running');
    });
  });

  describe('Visualizer Integration', () => {
    it('should generate Mermaid diagram', () => {
      const definition: StateMachineDefinition = {
        initial: 'idle',
        states: {
          idle: {
            transitions: [
              { from: 'idle', to: 'running', on: 'START' },
              { from: 'idle', to: 'paused', on: 'PAUSE' },
            ],
          },
          running: {
            transitions: [
              { from: 'running', to: 'idle', on: 'STOP' },
              { from: 'running', to: 'paused', on: 'PAUSE' },
            ],
          },
          paused: {
            transitions: [
              { from: 'paused', to: 'running', on: 'RESUME' },
              { from: 'paused', to: 'idle', on: 'STOP' },
            ],
          },
        },
      };

      const machine = createStateMachine(definition);
      const visualizer = new StateVisualizer(machine);

      const mermaid = visualizer.generateMermaid();

      expect(mermaid).toContain('stateDiagram-v2');
      expect(mermaid).toContain('idle');
      expect(mermaid).toContain('running');
      expect(mermaid).toContain('paused');
      expect(mermaid).toContain('START');
      expect(mermaid).toContain('PAUSE');
      expect(mermaid).toContain('RESUME');
    });

    it('should generate DOT format', () => {
      const definition: StateMachineDefinition = {
        initial: 'idle',
        states: {
          idle: {
            transitions: [{ from: 'idle', to: 'running', on: 'START' }],
          },
          running: {},
        },
      };

      const machine = createStateMachine(definition);
      const visualizer = new StateVisualizer(machine);

      const dot = visualizer.generateDot();

      expect(dot).toContain('digraph');
      expect(dot).toContain('idle');
      expect(dot).toContain('running');
      expect(dot).toContain('->');
    });

    it('should generate SVG', () => {
      const definition: StateMachineDefinition = {
        initial: 'idle',
        states: {
          idle: {
            transitions: [{ from: 'idle', to: 'running', on: 'START' }],
          },
          running: {},
        },
      };

      const machine = createStateMachine(definition);
      const visualizer = new StateVisualizer(machine);

      const svg = visualizer.generateSvg();

      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });
  });

  describe('Tester Integration', () => {
    it('should run test cases', async () => {
      const definition: StateMachineDefinition = {
        initial: 'A',
        states: {
          A: {
            transitions: [
              { from: 'A', to: 'B', on: 'GO' },
              { from: 'A', to: 'C', on: 'SKIP' },
            ],
          },
          B: {
            transitions: [{ from: 'B', to: 'C', on: 'GO' }],
          },
          C: {
            final: true,
          },
        },
      };

      const tester = new StateMachineTester(definition);

      const testCase = {
        name: 'A to C via B',
        steps: [
          { event: 'GO', expectedState: 'B' },
          { event: 'GO', expectedState: 'C' },
        ],
        expectedFinalState: 'C',
      };

      const result = await tester.runTestCase(testCase);

      expect(result.passed).toBe(true);
      expect(result.path.states).toEqual(['A', 'B', 'C']);
      expect(result.path.events).toEqual(['GO', 'GO']);
    });

    it('should explore paths', async () => {
      const definition: StateMachineDefinition = {
        initial: 'A',
        states: {
          A: {
            transitions: [
              { from: 'A', to: 'B', on: 'GO' },
              { from: 'A', to: 'C', on: 'SKIP' },
            ],
          },
          B: {
            transitions: [{ from: 'B', to: 'C', on: 'GO' }],
          },
          C: {
            final: true,
          },
        },
      };

      const tester = new StateMachineTester(definition);
      const exploration = await tester.explorePaths({ maxPathLength: 5 });

      expect(exploration.paths.length).toBeGreaterThan(0);
      expect(exploration.coverage.states.size).toBeGreaterThan(0);
    });
  });

  describe('Analytics Integration', () => {
    it('should collect metrics', async () => {
      const definition: StateMachineDefinition = {
        initial: 'idle',
        states: {
          idle: {
            transitions: [
              { from: 'idle', to: 'running', on: 'START' },
              { from: 'idle', to: 'paused', on: 'PAUSE' },
            ],
          },
          running: {
            transitions: [
              { from: 'running', to: 'idle', on: 'STOP' },
              { from: 'running', to: 'paused', on: 'PAUSE' },
            ],
          },
          paused: {
            transitions: [
              { from: 'paused', to: 'running', on: 'RESUME' },
              { from: 'paused', to: 'idle', on: 'STOP' },
            ],
          },
        },
      };

      const machine = createStateMachine(definition, { enableMetrics: true });
      const analytics = new StateMachineAnalytics(machine);

      // Execute some transitions
      await machine.send('START');
      await machine.send('PAUSE');
      await machine.send('RESUME');
      await machine.send('STOP');

      const metrics = analytics.getTransitionMetrics();

      expect(metrics.total).toBe(4);
      expect(metrics.successful).toBe(4);
      expect(metrics.byEvent.START).toBe(1);
      expect(metrics.byEvent.PAUSE).toBe(1);
    });

    it('should detect anomalies', async () => {
      const definition: StateMachineDefinition = {
        initial: 'idle',
        states: {
          idle: {
            transitions: [{ from: 'idle', to: 'running', on: 'START' }],
          },
          running: {
            transitions: [{ from: 'running', to: 'idle', on: 'STOP' }],
          },
        },
      };

      const machine = createStateMachine(definition);
      const analytics = new StateMachineAnalytics(machine);

      // Execute transitions
      for (let i = 0; i < 20; i++) {
        await machine.send('START');
        await machine.send('STOP');
      }

      const anomalies = analytics.detectAnomalies();

      expect(Array.isArray(anomalies)).toBe(true);
    });
  });

  describe('Complex Hierarchical States', () => {
    it('should handle nested states', async () => {
      const definition: StateMachineDefinition = {
        initial: 'idle',
        states: {
          idle: {
            transitions: [{ from: 'idle', to: 'active', on: 'START' }],
          },
          active: {
            initial: 'running',
            transitions: [{ from: 'active', to: 'idle', on: 'STOP' }],
          },
          'active.running': {
            transitions: [{ from: 'active.running', to: 'active.paused', on: 'PAUSE' }],
          },
          'active.paused': {
            transitions: [{ from: 'active.paused', to: 'active.running', on: 'RESUME' }],
          },
        },
      };

      const machine = createStateMachine(definition);

      await machine.send('START');
      expect(machine.state).toBe('active');

      await machine.send('PAUSE');
      expect(machine.state).toBe('active.paused');

      await machine.send('RESUME');
      expect(machine.state).toBe('active.running');
    });
  });
});

// Helper function for tests
function vi_fn() {
  const calls: any[][] = [];
  return {
    fn: (...args: any[]) => {
      calls.push(args);
    },
    get mockCalls() {
      return calls;
    },
    get mockInvocationCount() {
      return calls.length;
    },
  };
}

// Mock vi for testing
const vi = {
  fn: vi_fn,
};
