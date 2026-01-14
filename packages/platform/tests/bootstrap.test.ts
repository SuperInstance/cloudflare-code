/**
 * Tests for enhanced platform bootstrap
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlatformInitializer, InitPhase, initPlatform } from '../src/bootstrap/init';

describe('PlatformInitializer', () => {
  let initializer: PlatformInitializer;

  beforeEach(() => {
    initializer = new PlatformInitializer();
  });

  afterEach(async () => {
    await initializer.dispose();
  });

  describe('initialization', () => {
    it('should initialize platform with default options', async () => {
      const result = await initializer.initialize();

      expect(result.success).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.services).toBeDefined();
      expect(result.readinessScore).toBeGreaterThan(0);
    });

    it('should track initialization progress', async () => {
      const phases: InitPhase[] = [];
      initializer.onProgress((progress) => {
        phases.push(progress.phase);
      });

      await initializer.initialize();

      expect(phases).toContain(InitPhase.READY);
      expect(phases).not.toContain(InitPhase.FAILED);
    });

    it('should validate environment before initialization', async () => {
      const result = await initializer.initialize({
        config: {
          limits: {
            maxConcurrentRequests: 0, // Invalid
            maxServiceInstances: 50,
            cacheSize: 1000000,
            timeout: 30000,
          },
        },
      });

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should initialize with custom configuration', async () => {
      const result = await initializer.initialize({
        environment: {
          mode: 'production',
          debug: false,
        },
        autoStart: false,
        enableDiscovery: true,
      });

      expect(result.success).toBe(true);
      expect(result.context.environment.mode).toBe('production');
      expect(result.context.environment.debug).toBe(false);
    });

    it('should fail if already initialized', async () => {
      await initializer.initialize();

      await expect(initializer.initialize()).rejects.toThrow(
        'Platform already initialized'
      );
    });
  });

  describe('progress tracking', () => {
    it('should call progress callbacks', async () => {
      const callback = vi.fn();
      initializer.onProgress(callback);

      await initializer.initialize();

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls.length).toBeGreaterThan(5);
    });

    it('should allow unsubscribing from progress', async () => {
      const callback = vi.fn();
      const unsubscribe = initializer.onProgress(callback);

      unsubscribe();
      await initializer.initialize();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should provide progress details', async () => {
      const progresses: any[] = [];
      initializer.onProgress((progress) => {
        progresses.push(progress);
      });

      await initializer.initialize();

      const lastProgress = progresses[progresses.length - 1];
      expect(lastProgress.phase).toBe(InitPhase.READY);
      expect(lastProgress.progress).toBe(100);
      expect(lastProgress.timestamp).toBeDefined();
    });
  });

  describe('disposal', () => {
    it('should dispose resources', async () => {
      await initializer.initialize();

      expect(initializer.getStatus().initialized).toBe(true);

      await initializer.dispose();

      expect(initializer.getStatus().disposed).toBe(true);
    });

    it('should not allow operations after disposal', async () => {
      await initializer.initialize();
      await initializer.dispose();

      await expect(initializer.initialize()).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors', async () => {
      const result = await initializer.initialize({
        config: {
          limits: {
            maxConcurrentRequests: -1, // Invalid
            maxServiceInstances: 50,
            cacheSize: 1000000,
            timeout: 30000,
          },
        },
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should call error hook on failure', async () => {
      const onError = vi.fn();
      await initializer.initialize({
        config: {
          limits: {
            maxConcurrentRequests: -1,
            maxServiceInstances: 50,
            cacheSize: 1000000,
            timeout: 30000,
          },
        },
        onError,
      });

      expect(onError).toHaveBeenCalled();
    });
  });
});

describe('initPlatform', () => {
  it('should create and initialize platform', async () => {
    const result = await initPlatform({
      environment: {
        mode: 'development',
      },
    });

    expect(result.success).toBe(true);
    expect(result.context).toBeDefined();
  });

  it('should support quick start with minimal options', async () => {
    const result = await initPlatform();

    expect(result.success).toBe(true);
  });
});
