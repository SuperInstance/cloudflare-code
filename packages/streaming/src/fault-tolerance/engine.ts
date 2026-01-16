// @ts-nocheck
import { EventEmitter } from 'events';
import {
  Event,
  FaultToleranceConfig,
  CheckpointConfig,
  ProcessingConfig
} from '../types';

export interface CheckpointData {
  id: string;
  timestamp: number;
  sequence: number;
  state: any;
  metadata?: Record<string, any>;
}

export interface RecoveryContext {
  lastCheckpoint: CheckpointData | null;
  failedEvents: Event[];
  retryCount: number;
  recoveryStartTime: number;
}

export interface IdempotencyKey {
  key: string;
  event: Event;
  timestamp: number;
  ttl: number;
}

export class FaultToleranceEngine extends EventEmitter {
  private checkpoints: CheckpointData[] = [];
  private pendingCheckpoints: Map<string, CheckpointData> = new Map();
  private recoveryQueue: Event[] = [];
  private idempotencyStore: Map<string, IdempotencyKey> = new Map();
  private recoveryContext: RecoveryContext = {
    lastCheckpoint: null,
    failedEvents: [],
    retryCount: 0,
    recoveryStartTime: 0
  };

  constructor(
    private config: FaultToleranceConfig,
    private processingConfig: ProcessingConfig
  ) {
    super();
    this.startCheckpointing();
    this.startRecovery();
  }

  async checkpoint(
    event: Event,
    state: any,
    metadata?: Record<string, any>
  ): Promise<CheckpointData> {
    const checkpoint: CheckpointData = {
      id: this.generateCheckpointId(),
      timestamp: Date.now(),
      sequence: event.sequence || 0,
      state,
      metadata
    };

    this.pendingCheckpoints.set(checkpoint.id, checkpoint);

    if (this.shouldCommitCheckpoint()) {
      await this.commitCheckpoint(checkpoint);
    }

    return checkpoint;
  }

  private shouldCommitCheckpoint(): boolean {
    const now = Date.now();
    const lastCheckpoint = this.checkpoints[this.checkpoints.length - 1];

    if (!lastCheckpoint) return true;

    return now - lastCheckpoint.timestamp >= this.config.checkpointing.interval;
  }

  private async commitCheckpoint(checkpoint: CheckpointData): Promise<void> {
    const maxSnapshots = this.config.checkpointing.maxSnapshots;

    this.checkpoints.push(checkpoint);

    if (this.checkpoints.length > maxSnapshots) {
      const removed = this.checkpoints.splice(0, this.checkpoints.length - maxSnapshots);
      this.emit('checkpointPruned', removed);
    }

    this.pendingCheckpoints.delete(checkpoint.id);

    await this.persistCheckpoint(checkpoint);
    this.emit('checkpointCommitted', checkpoint);
  }

  private async persistCheckpoint(checkpoint: CheckpointData): Promise<void> {
    switch (this.config.checkpointing.storage.type) {
      case 'memory':
        break;
      case 'file':
        await this.persistToFile(checkpoint);
        break;
      case 'database':
        await this.persistToDatabase(checkpoint);
        break;
    }
  }

  private async persistToFile(checkpoint: CheckpointData): Promise<void> {
  }

  private async persistToDatabase(checkpoint: CheckpointData): Promise<void> {
  }

  async recover(event: Event, state?: any): Promise<any> {
    this.recoveryContext.recoveryStartTime = Date.now();
    this.recoveryContext.retryCount++;

    const lastCheckpoint = this.getLastCheckpoint();
    if (!lastCheckpoint) {
      throw new Error('No checkpoint available for recovery');
    }

    this.recoveryContext.lastCheckpoint = lastCheckpoint;

    try {
      let recoveredState = state || lastCheckpoint.state;

      if (this.config.idempotency.enabled) {
        const idempotencyKey = this.generateIdempotencyKey(event);
        const processed = this.idempotencyStore.get(idempotencyKey);

        if (processed && Date.now() - processed.timestamp < processed.ttl) {
          this.emit('idempotencyHit', event, idempotencyKey);
          return recoveredState;
        }
      }

      await this.processEventWithRecovery(event, recoveredState);

      if (this.config.idempotency.enabled) {
        this.idempotencyStore.set(this.generateIdempotencyKey(event), {
          key: this.generateIdempotencyKey(event),
          event,
          timestamp: Date.now(),
          ttl: this.config.idempotency.ttl
        });
      }

      this.recoveryContext.failedEvents = [];
      return recoveredState;

    } catch (error) {
      this.recoveryContext.failedEvents.push(event);
      this.emit('recoveryFailed', error, event, this.recoveryContext);
      throw error;
    }
  }

  private async processEventWithRecovery(
    event: Event,
    state: any
  ): Promise<void> {
    const maxAttempts = this.config.recovery.maxAttempts;
    let attempt = 0;

    while (attempt < maxAttempts) {
      try {
        const backoffTime = this.calculateBackoff(attempt);

        if (backoffTime > 0) {
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }

        return await this.processEvent(event, state);

      } catch (error) {
        attempt++;
        this.emit('recoveryAttempt', attempt, maxAttempts, event);

        if (attempt >= maxAttempts) {
          throw error;
        }

        this.recoveryContext.retryCount++;
      }
    }
  }

  private calculateBackoff(attempt: number): number {
    const config = this.config.recovery.backoff;
    return Math.min(config.max, config.initial * Math.pow(config.multiplier, attempt));
  }

  private async processEvent(event: Event, state: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Processing timeout for event ${event.id}`));
      }, this.processingConfig.timeout);

      const processed = () => {
        clearTimeout(timeout);
        resolve();
      };

      const handleSuccess = () => processed();
      const handleError = (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      };

      this.emit('processEvent', event, state, { handleSuccess, handleError });
    });
  }

  private getLastCheckpoint(): CheckpointData | null {
    return this.checkpoints[this.checkpoints.length - 1] || null;
  }

  public getLastCheckpointSafe(): CheckpointData | null {
    return this.getLastCheckpoint();
  }

  generateIdempotencyKey(event: Event): string {
    if (this.config.idempotency.keyGenerator) {
      return this.config.idempotency.keyGenerator(event);
    }
    return `${event.id}:${event.timestamp}`;
  }

  generateCheckpointId(): string {
    return `ckpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startCheckpointing(): void {
    setInterval(async () => {
      if (this.pendingCheckpoints.size > 0) {
        const checkpoints = Array.from(this.pendingCheckpoints.values());
        for (const checkpoint of checkpoints) {
          await this.commitCheckpoint(checkpoint);
        }
      }

      this.cleanupExpiredCheckpoints();
    }, this.config.checkpointing.interval);
  }

  private startRecovery(): void {
    setInterval(() => {
      this.processRecoveryQueue();
    }, 1000);

    this.cleanupExpiredIdempotencyEntries();
  }

  private async processRecoveryQueue(): Promise<void> {
    const events = this.recoveryQueue.splice(0, this.processingConfig.batchSize);

    for (const event of events) {
      try {
        await this.recover(event);
        this.emit('eventRecovered', event);
      } catch (error) {
        this.emit('recoveryError', error, event);
        this.recoveryQueue.push(event);
      }
    }
  }

  private cleanupExpiredCheckpoints(): void {
    const now = Date.now();
    const cutoff = now - (this.config.checkpointing.maxSnapshots * this.config.checkpointing.interval);

    const expired = this.checkpoints.filter(cp => cp.timestamp < cutoff);
    if (expired.length > 0) {
      this.checkpoints = this.checkpoints.filter(cp => cp.timestamp >= cutoff);
      this.emit('checkpointsCleaned', expired);
    }
  }

  private cleanupExpiredIdempotencyEntries(): void {
    const now = Date.now();
    const expired: IdempotencyKey[] = [];

    for (const [key, entry] of this.idempotencyStore.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expired.push(entry);
        this.idempotencyStore.delete(key);
      }
    }

    if (expired.length > 0) {
      this.emit('idempotencyEntriesCleaned', expired);
    }
  }

  addEventToRecoveryQueue(event: Event): void {
    this.recoveryQueue.push(event);
  }

  getRecoveryStatus(): RecoveryContext {
    return { ...this.recoveryContext };
  }

  getCheckpointHistory(): CheckpointData[] {
    return [...this.checkpoints];
  }

  getIdempotencyStatus(): {
    count: number;
    expired: number;
    memoryUsage: number;
  } {
    const now = Date.now();
    let expired = 0;

    for (const entry of this.idempotencyStore.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expired++;
      }
    }

    return {
      count: this.idempotencyStore.size,
      expired,
      memoryUsage: this.idempotencyStore.size * 1024
    };
  }

  forceCheckpoint(): Promise<CheckpointData> {
    const lastCheckpoint = this.getLastCheckpoint();
    const checkpoint = {
      id: this.generateCheckpointId(),
      timestamp: Date.now(),
      sequence: (lastCheckpoint?.sequence ?? 0) + 1,
      state: {}
    };

    return this.commitCheckpoint(checkpoint) as Promise<CheckpointData>;
  }

  cleanup(): void {
    this.checkpoints = [];
    this.pendingCheckpoints.clear();
    this.recoveryQueue = [];
    this.idempotencyStore.clear();
    this.recoveryContext = {
      lastCheckpoint: null,
      failedEvents: [],
      retryCount: 0,
      recoveryStartTime: 0
    };
    this.emit('cleanupComplete');
  }
}

export class FaultToleranceStrategy {
  static atLeastOnce(config: Partial<FaultToleranceConfig>): FaultToleranceConfig {
    return {
      strategy: 'at-least-once',
      checkpointing: {
        interval: 10000,
        maxSnapshots: 10,
        storage: { type: 'memory', config: {} }
      },
      recovery: {
        maxAttempts: 3,
        backoff: {
          initial: 1000,
          max: 10000,
          multiplier: 2
        }
      },
      idempotency: {
        enabled: true,
        ttl: 60000
      },
      ...config
    };
  }

  static atMostOnce(config: Partial<FaultToleranceConfig>): FaultToleranceConfig {
    return {
      strategy: 'at-most-once',
      checkpointing: {
        interval: 5000,
        maxSnapshots: 5,
        storage: { type: 'memory', config: {} }
      },
      recovery: {
        maxAttempts: 1,
        backoff: {
          initial: 0,
          max: 0,
          multiplier: 1
        }
      },
      idempotency: {
        enabled: false,
        keyGenerator: undefined,
        ttl: 0
      },
      ...config
    };
  }

  static exactlyOnce(config: Partial<FaultToleranceConfig>): FaultToleranceConfig {
    return {
      strategy: 'exactly-once',
      checkpointing: {
        interval: 5000,
        maxSnapshots: 20,
        storage: { type: 'memory', config: {} }
      },
      recovery: {
        maxAttempts: 5,
        backoff: {
          initial: 500,
          max: 15000,
          multiplier: 1.5
        }
      },
      idempotency: {
        enabled: true,
        keyGenerator: (event: Event) => `${event.key || event.id}:${event.sequence || 0}`,
        ttl: 120000
      },
      ...config
    };
  }
}

export class FaultToleranceManager {
  private engine: FaultToleranceEngine;
  private isInitialized = false;

  constructor(config: FaultToleranceConfig, processingConfig: ProcessingConfig) {
    this.engine = new FaultToleranceEngine(config, processingConfig);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await this.engine.forceCheckpoint();
    this.isInitialized = true;
  }

  async processEvent(event: Event): Promise<any> {
    const lastCheckpoint = this.engine.getLastCheckpointSafe();
    const state = lastCheckpoint?.state || {};

    return this.engine.recover(event, state);
  }

  async checkpoint(state: any, metadata?: Record<string, any>): Promise<CheckpointData> {
    const lastCp = this.engine.getLastCheckpointSafe();
    const event = {
      id: 'checkpoint_' + Date.now(),
      timestamp: Date.now(),
      data: {},
      sequence: (lastCp?.sequence ?? 0) + 1
    };

    return this.engine.checkpoint(event, state, metadata);
  }

  getStatus() {
    return {
      faultTolerance: this.engine.getRecoveryStatus(),
      checkpoints: {
        history: this.engine.getCheckpointHistory(),
        pending: this.engine.getCheckpointHistory().length,
        last: this.engine.getLastCheckpointSafe()
      },
      idempotency: this.engine.getIdempotencyStatus()
    };
  }

  onCheckpoint(callback: (checkpoint: CheckpointData) => void): void {
    this.engine.on('checkpointCommitted', callback);
  }

  onRecovery(callback: (error: Error, event: Event, context: RecoveryContext) => void): void {
    this.engine.on('recoveryFailed', callback);
  }

  cleanup(): void {
    this.engine.cleanup();
    this.isInitialized = false;
  }
}