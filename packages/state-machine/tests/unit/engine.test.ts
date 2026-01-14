/**
 * State Machine Engine Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StateMachineEngine, createStateMachine } from '../../src/engine/engine.js';
import { StateMachineDefinition } from '../../src/types/index.js';

describe('StateMachineEngine', () => {
  let definition: StateMachineDefinition;

  beforeEach(() => {
    definition = {
      initial: 'idle',
      states: {
        idle: {
          onEntry: ctx => console.log('Entered idle'),
          onExit: ctx => console.log('Exited idle'),
          transitions: [
            { from: 'idle', to: 'running', on: 'START' },
            { from: 'idle', to: 'paused', on: 'PAUSE' },
          ],
        },
        running: {
          onEntry: ctx => console.log('Entered running'),
          onExit: ctx => console.log('Exited running'),
          transitions: [
            { from: 'running', to: 'paused', on: 'PAUSE' },
            { from: 'running', to: 'idle', on: 'STOP' },
            { from: 'running', to: 'completed', on: 'FINISH' },
          ],
        },
        paused: {
          transitions: [
            { from: 'paused', to: 'running', on: 'RESUME' },
            { from: 'paused', to: 'idle', on: 'STOP' },
          ],
        },
        completed: {
          final: true,
          transitions: [
            { from: 'completed', to: 'idle', on: 'RESET' },
          ],
        },
      },
    };
  });

  describe('Initialization', () => {
    it('should create a state machine with initial state', () => {
      const machine = new StateMachineEngine({ definition });
      expect(machine.state).toBe('idle');
    });

    it('should start with empty history except initial state', () => {
      const machine = new StateMachineEngine({ definition });
      expect(machine.history).toEqual(['idle']);
    });

    it('should generate unique ID', () => {
      const machine1 = new StateMachineEngine({ definition });
      const machine2 = new StateMachineEngine({ definition });
      expect(machine1.id).not.toBe(machine2.id);
    });

    it('should have version', () => {
      const machine = new StateMachineEngine({ definition });
      expect(machine.version).toBeTruthy();
    });
  });

  describe('State Transitions', () => {
    it('should transition on event', async () => {
      const machine = new StateMachineEngine({ definition });
      await machine.send('START');
      expect(machine.state).toBe('running');
    });

    it('should track history', async () => {
      const machine = new StateMachineEngine({ definition });
      await machine.send('START');
      await machine.send('PAUSE');
      expect(machine.history).toEqual(['idle', 'running', 'paused']);
    });

    it('should support multiple transitions', async () => {
      const machine = new StateMachineEngine({ definition });
      await machine.send('START');
      expect(machine.state).toBe('running');
      await machine.send('PAUSE');
      expect(machine.state).toBe('paused');
      await machine.send('RESUME');
      expect(machine.state).toBe('running');
    });

    it('should reject invalid transitions', async () => {
      const machine = new StateMachineEngine({ definition });
      await expect(machine.send('INVALID')).rejects.toThrow();
    });
  });

  describe('Guard Conditions', () => {
    it('should respect guard conditions', async () => {
      const guardedDefinition: StateMachineDefinition = {
        initial: 'idle',
        states: {
          idle: {
            transitions: [
              {
                from: 'idle',
                to: 'running',
                on: 'START',
                guard: ctx => (ctx.payload as any)?.allowed === true,
              },
            ],
          },
          running: {},
        },
      };

      const machine = new StateMachineEngine({ definition: guardedDefinition });

      // Should fail - guard not met
      await expect(machine.send('START', { allowed: false })).rejects.toThrow();

      // Should succeed - guard met
      await machine.send('START', { allowed: true });
      expect(machine.state).toBe('running');
    });

    it('should support async guard conditions', async () => {
      const asyncGuardDefinition: StateMachineDefinition = {
        initial: 'idle',
        states: {
          idle: {
            transitions: [
              {
                from: 'idle',
                to: 'running',
                on: 'START',
                guard: async ctx => {
                  return new Promise(resolve => {
                    setTimeout(() => resolve(true), 10);
                  });
                },
              },
            ],
          },
          running: {},
        },
      };

      const machine = new StateMachineEngine({ definition: asyncGuardDefinition });
      await machine.send('START');
      expect(machine.state).toBe('running');
    });
  });

  describe('Actions', () => {
    it('should execute transition actions', async () => {
      let actionExecuted = false;

      const actionDefinition: StateMachineDefinition = {
        initial: 'idle',
        states: {
          idle: {
            transitions: [
              {
                from: 'idle',
                to: 'running',
                on: 'START',
                action: () => {
                  actionExecuted = true;
                },
              },
            ],
          },
          running: {},
        },
      };

      const machine = new StateMachineEngine({ definition: actionDefinition });
      await machine.send('START');

      expect(actionExecuted).toBe(true);
      expect(machine.state).toBe('running');
    });

    it('should execute before and after actions', async () => {
      const executionOrder: string[] = [];

      const actionDefinition: StateMachineDefinition = {
        initial: 'idle',
        states: {
          idle: {
            transitions: [
              {
                from: 'idle',
                to: 'running',
                on: 'START',
                before: [
                  () => executionOrder.push('before1'),
                  () => executionOrder.push('before2'),
                ],
                action: () => executionOrder.push('action'),
                after: [
                  () => executionOrder.push('after1'),
                  () => executionOrder.push('after2'),
                ],
              },
            ],
          },
          running: {},
        },
      };

      const machine = new StateMachineEngine({ definition: actionDefinition });
      await machine.send('START');

      expect(executionOrder).toEqual([
        'before1',
        'before2',
        'action',
        'after1',
        'after2',
      ]);
    });
  });

  describe('State Entry/Exit', () => {
    it('should execute onEntry actions', async () => {
      let entryExecuted = false;

      const entryDefinition: StateMachineDefinition = {
        initial: 'idle',
        states: {
          idle: {
            transitions: [{ from: 'idle', to: 'running', on: 'START' }],
          },
          running: {
            onEntry: () => {
              entryExecuted = true;
            },
          },
        },
      };

      const machine = new StateMachineEngine({ definition: entryDefinition });
      await machine.send('START');

      expect(entryExecuted).toBe(true);
    });

    it('should execute onExit actions', async () => {
      let exitExecuted = false;

      const exitDefinition: StateMachineDefinition = {
        initial: 'idle',
        states: {
          idle: {
            onExit: () => {
              exitExecuted = true;
            },
            transitions: [{ from: 'idle', to: 'running', on: 'START' }],
          },
          running: {},
        },
      };

      const machine = new StateMachineEngine({ definition: exitDefinition });
      await machine.send('START');

      expect(exitExecuted).toBe(true);
    });
  });

  describe('Event Emitter', () => {
    it('should emit state:change event', async () => {
      const machine = new StateMachineEngine({ definition });
      let changeEmitted = false;

      machine.on('state:change', () => {
        changeEmitted = true;
      });

      await machine.send('START');
      expect(changeEmitted).toBe(true);
    });

    it('should emit transition:start event', async () => {
      const machine = new StateMachineEngine({ definition });
      let startEmitted = false;

      machine.on('transition:start', () => {
        startEmitted = true;
      });

      await machine.send('START');
      expect(startEmitted).toBe(true);
    });

    it('should emit transition:end event', async () => {
      const machine = new StateMachineEngine({ definition });
      let endEmitted = false;

      machine.on('transition:end', () => {
        endEmitted = true;
      });

      await machine.send('START');
      expect(endEmitted).toBe(true);
    });
  });

  describe('Context Data', () => {
    it('should store and retrieve context data', async () => {
      const contextDefinition: StateMachineDefinition = {
        initial: 'idle',
        context: { count: 0 },
        states: {
          idle: {
            transitions: [
              {
                from: 'idle',
                to: 'running',
                on: 'START',
                action: ctx => {
                  ctx.data!.count = (ctx.data!.count as number) + 1;
                },
              },
            ],
          },
          running: {},
        },
      };

      const machine = new StateMachineEngine({ definition: contextDefinition });
      expect(machine.context).toEqual({ count: 0 });

      await machine.send('START');
      expect(machine.context).toEqual({ count: 1 });
    });

    it('should allow updating context', () => {
      const machine = new StateMachineEngine({ definition });
      machine.context = { custom: 'data' };
      expect(machine.context).toEqual({ custom: 'data' });
    });
  });

  describe('Snapshots', () => {
    it('should create snapshot', () => {
      const machine = new StateMachineEngine({ definition });
      const snapshot = machine.createSnapshot();

      expect(snapshot.state).toBe('idle');
      expect(snapshot.history).toEqual(['idle']);
      expect(snapshot.version).toBeTruthy();
      expect(snapshot.timestamp).toBeTruthy();
    });

    it('should restore from snapshot', async () => {
      const machine = new StateMachineEngine({ definition });
      await machine.send('START');
      await machine.send('PAUSE');

      const snapshot = machine.createSnapshot();
      machine.reset();

      expect(machine.state).toBe('idle');

      machine.restoreSnapshot(snapshot);
      expect(machine.state).toBe('paused');
      expect(machine.history).toEqual(['idle', 'running', 'paused']);
    });
  });

  describe('Reset', () => {
    it('should reset to initial state', async () => {
      const machine = new StateMachineEngine({ definition });
      await machine.send('START');
      await machine.send('PAUSE');

      machine.reset();

      expect(machine.state).toBe('idle');
      expect(machine.history).toEqual(['idle']);
    });
  });

  describe('Validation', () => {
    it('should validate definition on creation', () => {
      const invalidDefinition = {
        initial: 'nonexistent',
        states: {},
      } as any;

      expect(() => new StateMachineEngine({ definition: invalidDefinition })).toThrow();
    });

    it('should check if state can transition', () => {
      const machine = new StateMachineEngine({ definition });
      expect(machine.can('START')).toBe(true);
      expect(machine.can('INVALID')).toBe(false);
    });

    it('should check if in specific state', async () => {
      const machine = new StateMachineEngine({ definition });
      expect(machine.isIn('idle')).toBe(true);

      await machine.send('START');
      expect(machine.isIn('running')).toBe(true);
      expect(machine.isIn('idle')).toBe(false);
    });
  });

  describe('Metrics', () => {
    it('should collect transition metrics', async () => {
      const machine = new StateMachineEngine({
        definition,
        enableMetrics: true,
      });

      await machine.send('START');
      await machine.send('PAUSE');

      const metrics = machine.getTransitionMetrics();
      expect(metrics.total).toBe(2);
      expect(metrics.successful).toBe(2);
      expect(metrics.byEvent.START).toBe(1);
      expect(metrics.byEvent.PAUSE).toBe(1);
    });

    it('should track transition duration', async () => {
      const machine = new StateMachineEngine({
        definition,
        enableMetrics: true,
      });

      await machine.send('START');

      const metrics = machine.getTransitionMetrics();
      expect(metrics.avgDuration).toBeGreaterThan(0);
      expect(metrics.maxDuration).toBeGreaterThan(0);
    });
  });

  describe('Destruction', () => {
    it('should destroy machine and cleanup', () => {
      const machine = new StateMachineEngine({ definition });
      expect(machine.destroyed).toBe(false);

      machine.destroy();
      expect(machine.destroyed).toBe(true);
    });

    it('should prevent operations after destruction', async () => {
      const machine = new StateMachineEngine({ definition });
      machine.destroy();

      await expect(machine.send('START')).rejects.toThrow();
    });
  });
});

describe('createStateMachine', () => {
  it('should create state machine from definition', () => {
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
    expect(machine.state).toBe('idle');
  });

  it('should accept config options', () => {
    const definition: StateMachineDefinition = {
      initial: 'idle',
      states: {
        idle: {},
      },
    };

    const machine = createStateMachine(definition, {
      enableLogging: true,
      enableMetrics: true,
    });

    expect(machine.state).toBe('idle');
  });
});
