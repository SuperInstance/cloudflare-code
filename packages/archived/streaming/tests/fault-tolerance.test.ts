import {
  FaultToleranceEngine,
  FaultToleranceManager,
  FaultToleranceStrategy
} from '../src/fault-tolerance';
import { Event, FaultToleranceConfig, ProcessingConfig } from '../src/types';

describe('FaultToleranceEngine', () => {
  let engine: FaultToleranceEngine;
  let processingConfig: ProcessingConfig;
  let faultConfig: FaultToleranceConfig;

  beforeEach(() => {
    processingConfig = {
      concurrency: 1,
      batchSize: 10,
      maxRetries: 3,
      timeout: 5000,
      backpressure: {
        enabled: true,
        threshold: 100,
        strategy: 'buffer'
      }
    };

    faultConfig = {
      strategy: 'at-least-once',
      checkpointing: {
        interval: 1000,
        maxSnapshots: 5,
        storage: { type: 'memory', config: {} }
      },
      recovery: {
        maxAttempts: 3,
        backoff: {
          initial: 1000,
          max: 5000,
          multiplier: 2
        }
      },
      idempotency: {
        enabled: true,
        ttl: 60000
      }
    };

    engine = new FaultToleranceEngine(faultConfig, processingConfig);
  });

  afterEach(() => {
    engine.cleanup();
  });

  describe('Checkpointing', () => {
    it('should create checkpoints', async () => {
      const event: Event = {
        id: '1',
        timestamp: Date.now(),
        data: { value: 'test' },
        sequence: 1
      };

      const state = { count: 1 };
      const checkpoint = await engine.checkpoint(event, state);

      expect(checkpoint).toMatchObject({
        id: expect.stringMatching(/ckpt_/),
        timestamp: expect.any(Number),
        sequence: 1,
        state: { count: 1 }
      });
    });

    it('should store checkpoints in memory', async () => {
      const event: Event = {
        id: '1',
        timestamp: Date.now(),
        data: { value: 'test' }
      };

      await engine.checkpoint(event, { data: 'test' });

      const history = engine.getCheckpointHistory();
      expect(history).toHaveLength(1);
    });

    it('should prune old checkpoints', async () => {
      faultConfig.checkpointing.maxSnapshots = 2;
      const localEngine = new FaultToleranceEngine(faultConfig, processingConfig);

      const event1 = { id: '1', timestamp: Date.now(), data: { value: '1' } };
      const event2 = { id: '2', timestamp: Date.now() + 1000, data: { value: '2' } };
      const event3 = { id: '3', timestamp: Date.now() + 2000, data: { value: '3' } };

      await localEngine.checkpoint(event1, { data: '1' });
      await localEngine.checkpoint(event2, { data: '2' });
      await localEngine.checkpoint(event3, { data: '3' });

      const history = localEngine.getCheckpointHistory();
      expect(history).toHaveLength(2);
      expect(history[0].data.value).toBe('2');
    });
  });

  describe('Recovery', () => {
    it('should recover from last checkpoint', async () => {
      const event: Event = {
        id: '1',
        timestamp: Date.now(),
        data: { value: 'test' },
        sequence: 1
      };

      await engine.checkpoint(event, { count: 1 });

      const recoveredState = await engine.recover(event, {});

      expect(recoveredState).toEqual({ count: 1 });
    });

    it('should handle recovery with retries', async () => {
      const processEventSpy = jest.fn()
        .mockImplementationOnce(() => Promise.reject(new Error('Failed')))
        .mockImplementationOnce(() => Promise.resolve());

      engine.on('processEvent', (event, state, callbacks) => {
        processEventSpy();
        callbacks.handleSuccess();
      });

      const event: Event = {
        id: '1',
        timestamp: Date.now(),
        data: { value: 'test' }
      };

      const recoveredState = await engine.recover(event);

      expect(recoveredState).toBeDefined();
      expect(processEventSpy).toHaveBeenCalledTimes(2);
    });

    it('should respect max retry attempts', async () => {
      const processEventSpy = jest.fn(() => Promise.reject(new Error('Always fails')));

      engine.on('processEvent', (event, state, callbacks) => {
        processEventSpy();
        callbacks.handleSuccess();
      });

      const event: Event = {
        id: '1',
        timestamp: Date.now(),
        data: { value: 'test' }
      };

      await expect(engine.recover(event)).rejects.toThrow('Always fails');
    });
  });

  describe('Idempotency', () => {
    it('should prevent duplicate processing', async () => {
      const event: Event = {
        id: '1',
        timestamp: Date.now(),
        data: { value: 'test' }
      };

      await engine.recover(event);

      const idempotencyStatus = engine.getIdempotencyStatus();
      expect(idempotencyStatus.count).toBe(1);

      const recoveredState = await engine.recover(event);
      expect(recoveredState).toBeDefined();
    });

    it('should generate custom idempotency keys', async () => {
      faultConfig.idempotency.keyGenerator = (event: Event) => `custom_${event.id}`;
      const customEngine = new FaultToleranceEngine(faultConfig, processingConfig);

      const event: Event = {
        id: '1',
        timestamp: Date.now(),
        data: { value: 'test' }
      };

      await customEngine.recover(event);

      const idempotencyStatus = customEngine.getIdempotencyStatus();
      expect(idempotencyStatus.count).toBe(1);
    });
  });

  describe('Backoff Strategy', () => {
    it('should calculate exponential backoff', () => {
      const attempt1 = engine.calculateBackoff(0);
      const attempt2 = engine.calculateBackoff(1);
      const attempt3 = engine.calculateBackoff(2);

      expect(attempt2).toBeGreaterThan(attempt1);
      expect(attempt3).toBeGreaterThan(attempt2);
    });

    it('should respect max backoff time', () => {
      const maxBackoff = engine.calculateBackoff(10);
      const backoffConfig = engine.config.recovery.backoff;

      expect(maxBackoff).toBeLessThanOrEqual(backoffConfig.max);
    });
  });
});

describe('FaultToleranceStrategy', () => {
  describe('atLeastOnce', () => {
    it('should create at-least-once configuration', () => {
      const config = FaultToleranceStrategy.atLeastOnce({
        checkpointing: {
          interval: 2000
        }
      });

      expect(config.strategy).toBe('at-least-once');
      expect(config.checkpointing.interval).toBe(2000);
      expect(config.idempotency.enabled).toBe(true);
    });
  });

  describe('atMostOnce', () => {
    it('should create at-most-once configuration', () => {
      const config = FaultToleranceStrategy.atMostOnce();

      expect(config.strategy).toBe('at-most-once');
      expect(config.idempotency.enabled).toBe(false);
      expect(config.recovery.maxAttempts).toBe(1);
    });
  });

  describe('exactlyOnce', () => {
    it('should create exactly-once configuration', () => {
      const config = FaultToleranceStrategy.exactlyOnce();

      expect(config.strategy).toBe('exactly-once');
      expect(config.checkpointing.maxSnapshots).toBe(20);
      expect(config.idempotency.enabled).toBe(true);
    });
  });
});

describe('FaultToleranceManager', () => {
  let manager: FaultToleranceManager;

  beforeEach(() => {
    const processingConfig: ProcessingConfig = {
      concurrency: 1,
      batchSize: 10,
      maxRetries: 3,
      timeout: 5000
    };

    const faultConfig = FaultToleranceStrategy.atLeastOnce();
    manager = new FaultToleranceManager(faultConfig, processingConfig);
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize with checkpoint', async () => {
      await manager.initialize();
      const status = manager.getStatus();

      expect(status.checkpoints.last).toBeDefined();
      expect(status.checkpoints.last.id).toMatch(/ckpt_/);
    });

    it('should process events with recovery', async () => {
      const event: Event = {
        id: '1',
        timestamp: Date.now(),
        data: { value: 'test' }
      };

      manager.on('processEvent', (event, state, callbacks) => {
        callbacks.handleSuccess();
      });

      await manager.processEvent(event);
      const status = manager.getStatus();

      expect(status.faultTolerance.retryCount).toBe(1);
    });

    it('should handle event processing errors', async () => {
      const event: Event = {
        id: '1',
        timestamp: Date.now(),
        data: { value: 'test' }
      };

      manager.on('processEvent', (event, state, callbacks) => {
        callbacks.handleSuccess();
      });

      await manager.processEvent(event);
    });
  });

  describe('Status Monitoring', () => {
    it('should provide comprehensive status', () => {
      const status = manager.getStatus();

      expect(status).toHaveProperty('faultTolerance');
      expect(status).toHaveProperty('checkpoints');
      expect(status).toHaveProperty('idempotency');
    });

    it('should monitor checkpoint history', async () => {
      const event: Event = {
        id: '1',
        timestamp: Date.now(),
        data: { value: 'test' }
      };

      await manager.initialize();
      await manager.processEvent(event);

      const status = manager.getStatus();
      expect(status.checkpoints.history.length).toBeGreaterThan(0);
    });
  });

  describe('Event Handling', () => {
    it('should handle checkpoint events', async () => {
      const checkpointCallback = jest.fn();
      manager.onCheckpoint(checkpointCallback);

      const event: Event = {
        id: '1',
        timestamp: Date.now(),
        data: { value: 'test' }
      };

      await manager.initialize();
      await manager.processEvent(event);

      expect(checkpointCallback).toHaveBeenCalled();
    });

    it('should handle recovery errors', async () => {
      const errorCallback = jest.fn();
      manager.onRecovery(errorCallback);

      const event: Event = {
        id: '1',
        timestamp: Date.now(),
        data: { value: 'test' }
      };

      manager.on('processEvent', (event, state, callbacks) => {
        callbacks.handleSuccess();
      });

      await manager.processEvent(event);
      await manager.processEvent(event);

      expect(errorCallback).toHaveBeenCalled();
    });
  });
});