/**
 * State Manager Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StateMachineEngine } from '../../src/engine/engine.js';
import { StateManager, InMemoryPersistenceAdapter } from '../../src/state/manager.js';
import { StateMachineDefinition } from '../../src/types/index.js';

describe('StateManager', () => {
  let definition: StateMachineDefinition;
  let machine: StateMachineEngine;
  let manager: StateManager;
  let persistence: InMemoryPersistenceAdapter;

  beforeEach(() => {
    definition = {
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
            { from: 'running', to: 'paused', on: 'PAUSE' },
            { from: 'running', to: 'idle', on: 'STOP' },
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

    machine = new StateMachineEngine({ definition });
    persistence = new InMemoryPersistenceAdapter();
    manager = new StateManager(machine, {
      persistenceAdapter: persistence,
      enableVersioning: true,
      maxVersions: 5,
    });
  });

  describe('Initialization', () => {
    it('should get current state', () => {
      expect(manager.currentState).toBe('idle');
    });

    it('should get state history', () => {
      expect(manager.history).toEqual(['idle']);
    });

    it('should start with empty change log', () => {
      expect(manager.changeHistory).toHaveLength(0);
    });

    it('should start with no versions', () => {
      expect(manager.allVersions).toHaveLength(0);
    });
  });

  describe('State Validation', () => {
    it('should validate valid state', async () => {
      const result = await manager.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid state', async () => {
      // Manually set invalid state
      (machine as any).currentState = 'invalid';

      const result = await manager.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate transitions', async () => {
      const result = await manager.validateTransition('idle', 'running', 'START');
      expect(result.valid).toBe(true);
    });

    it('should detect invalid transitions', async () => {
      const result = await manager.validateTransition('idle', 'invalid', 'START');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about final states', async () => {
      const finalDefinition: StateMachineDefinition = {
        initial: 'idle',
        states: {
          idle: {
            transitions: [{ from: 'idle', to: 'final', on: 'DONE' }],
          },
          final: {
            final: true,
          },
        },
      };

      const finalMachine = new StateMachineEngine({ definition: finalDefinition });
      const finalManager = new StateManager(finalMachine);

      const result = await finalManager.validateTransition('idle', 'final', 'DONE');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Persistence', () => {
    it('should save state', async () => {
      await manager.save();
      const exists = await persistence.exists(manager['getPersistenceKey']());
      expect(exists).toBe(true);
    });

    it('should load state', async () => {
      await machine.send('START');
      await manager.save();

      const newMachine = new StateMachineEngine({ definition });
      const newManager = new StateManager(newMachine, {
        persistenceAdapter: persistence,
      });

      await newManager.load();
      expect(newManager.currentState).toBe('running');
    });

    it('should return null when loading non-existent state', async () => {
      const result = await manager.load();
      expect(result).toBeNull();
    });

    it('should delete saved state', async () => {
      await manager.save();
      await manager.delete();

      const exists = await persistence.exists(manager['getPersistenceKey']());
      expect(exists).toBe(false);
    });

    it('should check if state exists', async () => {
      expect(await manager.exists()).toBe(false);

      await manager.save();
      expect(await manager.exists()).toBe(true);
    });
  });

  describe('Versioning', () => {
    it('should create checkpoint', async () => {
      const version = await manager.checkpoint('Initial state');
      expect(version).toBe(1);
      expect(manager.allVersions).toHaveLength(1);
    });

    it('should create multiple checkpoints', async () => {
      await manager.checkpoint('Version 1');
      await machine.send('START');
      await manager.checkpoint('Version 2');

      expect(manager.allVersions).toHaveLength(2);
    });

    it('should restore from version', async () => {
      await manager.checkpoint('Version 1');
      await machine.send('START');
      await manager.checkpoint('Version 2');
      await machine.send('PAUSE');

      expect(manager.currentState).toBe('paused');

      await manager.restoreVersion(1);
      expect(manager.currentState).toBe('idle');
    });

    it('should get version by number', async () => {
      await manager.checkpoint('Test version');
      const version = manager.getVersion(1);

      expect(version).toBeDefined();
      expect(version?.version).toBe(1);
      expect(version?.description).toBe('Test version');
    });

    it('should get latest version', async () => {
      await manager.checkpoint('Version 1');
      await machine.send('START');
      await manager.checkpoint('Version 2');

      const latest = manager.getLatestVersion();
      expect(latest?.version).toBe(2);
    });

    it('should prune old versions', async () => {
      const limitedManager = new StateManager(machine, {
        persistenceAdapter,
        maxVersions: 3,
        enableVersioning: true,
      });

      for (let i = 0; i < 5; i++) {
        await limitedManager.checkpoint(`Version ${i}`);
      }

      expect(limitedManager.allVersions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Migrations', () => {
    it('should register migration', () => {
      manager.registerMigration({
        from: '1.0.0',
        to: '2.0.0',
        migrate: snapshot => snapshot,
      });

      // Migration should be registered
      expect(manager['migrations'].size).toBeGreaterThan(0);
    });

    it('should migrate snapshot', async () => {
      const oldSnapshot = machine.createSnapshot();
      oldSnapshot.version = '1.0.0';

      manager.registerMigration({
        from: '1.0.0',
        to: '2.0.0',
        migrate: async snapshot => {
          snapshot.version = '2.0.0';
          return snapshot;
        },
      });

      const migrated = await manager['migrateSnapshot'](oldSnapshot);
      expect(migrated.version).toBe('2.0.0');
    });
  });

  describe('Validation Rules', () => {
    it('should add validation rule', async () => {
      manager.addValidationRule('testRule', state => state === 'idle');

      const result = await manager.validate();
      expect(result.valid).toBe(true);
    });

    it('should fail validation rule', async () => {
      manager.addValidationRule('testRule', state => state === 'running');

      const result = await manager.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Validation rule \'testRule\' failed');
    });

    it('should remove validation rule', async () => {
      manager.addValidationRule('testRule', () => false);
      manager.removeValidationRule('testRule');

      const result = await manager.validate();
      expect(result.valid).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should get state statistics', async () => {
      await machine.send('START');
      await machine.send('PAUSE');

      const stats = manager.getStateStatistics();

      expect(stats.currentState).toBe('paused');
      expect(stats.historyLength).toBe(3);
      expect(stats.totalTransitions).toBe(2);
    });

    it('should calculate state durations', async () => {
      await machine.send('START');
      await machine.send('PAUSE');

      const stats = manager.getStateStatistics();
      expect(stats.stateDurations).toBeDefined();
      expect(stats.stateVisits).toBeDefined();
    });

    it('should find most visited state', async () => {
      await machine.send('START');
      await machine.send('PAUSE');
      await machine.send('RESUME');
      await machine.send('PAUSE');

      const stats = manager.getStateStatistics();
      expect(stats.mostVisitedState).toBe('paused');
    });
  });

  describe('Import/Export', () => {
    it('should export state to JSON', () => {
      const json = manager.exportState();

      expect(json).toBeDefined();
      const data = JSON.parse(json);
      expect(data.snapshot).toBeDefined();
      expect(data.changeLog).toBeDefined();
    });

    it('should import state from JSON', () => {
      await machine.send('START');
      const json = manager.exportState();

      const newMachine = new StateMachineEngine({ definition });
      const newManager = new StateManager(newMachine);

      newManager.importState(json);

      expect(newManager.currentState).toBe('running');
    });

    it('should import versions', async () => {
      await manager.checkpoint('Version 1');
      const json = manager.exportState();

      const newManager = new StateManager(machine);
      newManager.importState(json);

      expect(newManager.allVersions.length).toBeGreaterThan(0);
    });
  });

  describe('Change Log', () => {
    it('should record state changes', async () => {
      await machine.send('START');
      await machine.send('PAUSE');

      const log = manager.changeHistory;
      expect(log).toHaveLength(2);
      expect(log[0].from).toBe('idle');
      expect(log[0].to).toBe('running');
    });

    it('should limit change log size', async () => {
      const limitedManager = new StateManager(machine, {
        maxHistoryLength: 3,
      });

      for (let i = 0; i < 10; i++) {
        await machine.send('START');
        await machine.send('STOP');
      }

      expect(limitedManager.changeHistory.length).toBeLessThanOrEqual(3);
    });

    it('should clear history', async () => {
      await machine.send('START');
      await manager.clearHistory();

      expect(manager.changeHistory).toHaveLength(0);
    });
  });

  describe('Destroy', () => {
    it('should cleanup resources', () => {
      expect(manager.changeHistory).toBeDefined();
      expect(manager.allVersions).toBeDefined();

      manager.destroy();

      expect(manager.changeHistory).toHaveLength(0);
      expect(manager.allVersions).toHaveLength(0);
    });
  });
});

describe('InMemoryPersistenceAdapter', () => {
  it('should save and load snapshots', async () => {
    const adapter = new InMemoryPersistenceAdapter();
    const snapshot = {
      state: 'running',
      history: ['idle', 'running'],
      version: '1.0.0',
      timestamp: Date.now(),
    };

    await adapter.save('test-key', snapshot);
    const loaded = await adapter.load('test-key');

    expect(loaded).toEqual(snapshot);
  });

  it('should check existence', async () => {
    const adapter = new InMemoryPersistenceAdapter();

    expect(await adapter.exists('test-key')).toBe(false);

    await adapter.save('test-key', {} as any);
    expect(await adapter.exists('test-key')).toBe(true);
  });

  it('should delete snapshots', async () => {
    const adapter = new InMemoryPersistenceAdapter();
    await adapter.save('test-key', {} as any);

    expect(await adapter.exists('test-key')).toBe(true);

    await adapter.delete('test-key');
    expect(await adapter.exists('test-key')).toBe(false);
  });

  it('should clear all snapshots', async () => {
    const adapter = new InMemoryPersistenceAdapter();

    await adapter.save('key1', {} as any);
    await adapter.save('key2', {} as any);

    adapter.clear();

    expect(await adapter.exists('key1')).toBe(false);
    expect(await adapter.exists('key2')).toBe(false);
  });
});
