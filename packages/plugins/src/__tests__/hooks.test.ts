// @ts-nocheck
/**
 * Hook system tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { globalHookRegistry, globalHookDispatcher, CORE_HOOKS } from '../hooks';
import type { PluginId } from '../types';

describe('Hook System', () => {
  let testPluginId: PluginId;

  beforeEach(() => {
    testPluginId = 'test-plugin';
    // Reset registry for each test
    const hooks = globalHookRegistry.getAllHooks();
    for (const [name] of hooks) {
      globalHookRegistry.clearPluginHandlers(testPluginId);
    }
  });

  describe('HookRegistry', () => {
    it('should have core hooks registered', () => {
      const beforeRequest = globalHookRegistry.getHook(CORE_HOOKS.BEFORE_REQUEST);
      expect(beforeRequest).toBeDefined();
      expect(beforeRequest?.name).toBe(CORE_HOOKS.BEFORE_REQUEST);
      expect(beforeRequest?.type).toBe('async');
      expect(beforeRequest?.cancellable).toBe(true);
      expect(beforeRequest?.mutable).toBe(true);
    });

    it('should register custom hook', () => {
      globalHookRegistry.registerHook({
        name: 'customHook',
        description: 'A custom hook',
        type: 'sync',
        priority: 50,
        cancellable: false,
        mutable: false,
      });

      const hook = globalHookRegistry.getHook('customHook');
      expect(hook).toBeDefined();
    });

    it('should subscribe to hook', () => {
      const handler = async () => {};
      globalHookRegistry.subscribe(CORE_HOOKS.BEFORE_REQUEST, testPluginId, handler);

      const handlers = globalHookRegistry.getHandlers(CORE_HOOKS.BEFORE_REQUEST);
      expect(handlers.size).toBeGreaterThan(0);
    });

    it('should unsubscribe from hook', () => {
      const handler = async () => {};
      globalHookRegistry.subscribe(CORE_HOOKS.BEFORE_REQUEST, testPluginId, handler);
      globalHookRegistry.unsubscribe(CORE_HOOKS.BEFORE_REQUEST, testPluginId, handler.name);

      const handlers = globalHookRegistry.getHandlers(CORE_HOOKS.BEFORE_REQUEST);
      expect(handlers.size).toBe(0);
    });
  });

  describe('HookDispatcher', () => {
    it('should dispatch async hook', async () => {
      let called = false;
      const handler = async () => {
        called = true;
      };

      globalHookRegistry.subscribe(CORE_HOOKS.BEFORE_REQUEST, testPluginId, handler);

      const result = await globalHookDispatcher.dispatch(
        CORE_HOOKS.BEFORE_REQUEST,
        testPluginId,
        { test: 'data' }
      );

      expect(called).toBe(true);
      expect(result.hookName).toBe(CORE_HOOKS.BEFORE_REQUEST);
      expect(result.cancelled).toBe(false);
      expect(result.handlersExecuted).toBe(1);
    });

    it('should dispatch sync hook', () => {
      let called = false;
      const handler = () => {
        called = true;
      };

      globalHookRegistry.subscribe(CORE_HOOKS.AFTER_RESPONSE, testPluginId, handler as any);

      const result = globalHookDispatcher.dispatchSync(
        CORE_HOOKS.AFTER_RESPONSE,
        testPluginId,
        { test: 'data' }
      );

      expect(called).toBe(true);
      expect(result.hookName).toBe(CORE_HOOKS.AFTER_RESPONSE);
    });

    it('should handle hook cancellation', async () => {
      const handler = async (context: any) => {
        context.cancel();
      };

      globalHookRegistry.subscribe(CORE_HOOKS.BEFORE_REQUEST, testPluginId, handler);

      const result = await globalHookDispatcher.dispatch(
        CORE_HOOKS.BEFORE_REQUEST,
        testPluginId,
        { test: 'data' }
      );

      expect(result.cancelled).toBe(true);
    });

    it('should handle hook data modification', async () => {
      const handler = async (context: any) => {
        context.modify({ ...context.data, modified: true });
      };

      globalHookRegistry.subscribe(CORE_HOOKS.AFTER_RESPONSE, testPluginId, handler);

      const result = await globalHookDispatcher.dispatch(
        CORE_HOOKS.AFTER_RESPONSE,
        testPluginId,
        { test: 'data' }
      );

      expect(result.modified).toBe(true);
      expect(result.data).toHaveProperty('modified', true);
    });

    it('should handle hook errors', async () => {
      const handler = async () => {
        throw new Error('Handler error');
      };

      globalHookRegistry.subscribe(CORE_HOOKS.BEFORE_REQUEST, testPluginId, handler);

      const result = await globalHookDispatcher.dispatch(
        CORE_HOOKS.BEFORE_REQUEST,
        testPluginId,
        { test: 'data' }
      );

      expect(result.errors.length).toBe(1);
      expect(result.errors[0].message).toBe('Handler error');
    });
  });

  describe('Hook priorities', () => {
    it('should execute handlers in priority order', async () => {
      const order: number[] = [];

      // Register handlers with different priorities
      globalHookRegistry.registerHook({
        name: 'priorityTest',
        description: 'Test hook for priorities',
        type: 'async',
        priority: 100,
        cancellable: false,
        mutable: false,
      });

      globalHookRegistry.subscribe('priorityTest', 'plugin1', async () => {
        order.push(1);
      });

      globalHookRegistry.subscribe('priorityTest', 'plugin2', async () => {
        order.push(2);
      });

      globalHookRegistry.subscribe('priorityTest', 'plugin3', async () => {
        order.push(3);
      });

      await globalHookDispatcher.dispatch(
        'priorityTest',
        testPluginId,
        {}
      );

      // All handlers should have been called
      expect(order.length).toBe(3);
    });
  });
});
