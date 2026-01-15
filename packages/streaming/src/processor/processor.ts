import { EventEmitter } from 'events';
import {
  Event,
  Stream,
  StreamObserver,
  Subscription,
  WindowConfig,
  ProcessingConfig,
  FaultToleranceConfig,
  ProcessorMetrics
} from '../types';

export interface Window<T = any> {
  events: Event<T>[];
  startTime: number;
  endTime: number;
  id: string;
  close(): void;
  add(event: Event<T>): void;
  isFull(): boolean;
}

export interface WindowFunction<T = any, R = any> {
  (window: Window<T>): R | Promise<R>;
}

export interface StateFunction<T = any, R = any> {
  (key: string, state: R, event: Event<T>): Promise<R>;
}

export interface StreamProcessor<T = any> extends EventEmitter {
  process(stream: Stream<T>): void;
  addWindow(config: WindowConfig, fn: WindowFunction<T, any>): void;
  addState(key: string, initialState: any, fn: StateFunction<T, any>): void;
  checkpoint(): Promise<void>;
  recover(): Promise<void>;
  getMetrics(): ProcessorMetrics;
  stop(): void;
}

export class TimeWindow<T = any> implements Window<T> {
  public readonly events: Event<T>[] = [];
  public readonly startTime: number;
  public readonly endTime: number;
  public readonly id: string;
  private _closed = false;

  constructor(
    public readonly size: number,
    public readonly slide: number,
    private windowFn: WindowFunction<T, any>,
    public processor: StreamProcessor<T>
  ) {
    this.startTime = Date.now();
    this.endTime = this.startTime + size;
    this.id = `time_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  add(event: Event<T>): void {
    if (this._closed) return;

    this.events.push(event);

    if (event.timestamp >= this.endTime) {
      this.close();
    }
  }

  isFull(): boolean {
    return this.events.length > 0 &&
           this.events[this.events.length - 1].timestamp >= this.endTime;
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;

    this.processor.emit('windowClose', this);

    if (this.windowFn) {
      this.windowFn(this).then(result => {
        this.processor.emit('windowResult', this, result);
      }).catch(error => {
        this.processor.emit('windowError', this, error);
      });
    }
  }
}

export class CountWindow<T = any> implements Window<T> {
  public readonly events: Event<T>[] = [];
  public readonly startTime: number;
  public readonly endTime: number;
  public readonly id: string;
  private _closed = false;

  constructor(
    public readonly size: number,
    public readonly slide: number,
    private windowFn: WindowFunction<T, any>,
    public processor: StreamProcessor<T>
  ) {
    this.startTime = Date.now();
    this.endTime = this.startTime + (slide || size);
    this.id = `count_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  add(event: Event<T>): void {
    if (this._closed) return;

    this.events.push(event);

    if (this.events.length >= this.size) {
      this.close();
    }
  }

  isFull(): boolean {
    return this.events.length >= this.size;
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;

    this.processor.emit('windowClose', this);

    if (this.windowFn) {
      this.windowFn(this).then(result => {
        this.processor.emit('windowResult', this, result);
      }).catch(error => {
        this.processor.emit('windowError', this, error);
      });
    }
  }
}

export class SessionWindow<T = any> implements Window<T> {
  public readonly events: Event<T>[] = [];
  public readonly startTime: number;
  public readonly endTime: number;
  public readonly id: string;
  private _closed = false;
  private timeout: number;

  constructor(
    public readonly size: number,
    public readonly slide: number,
    private windowFn: WindowFunction<T, any>,
    public processor: StreamProcessor<T>,
    private sessionKey: (event: Event<T>) => string,
    private inactivityTimeout: number = 30000
  ) {
    this.startTime = Date.now();
    this.endTime = this.startTime + size;
    this.id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.timeout = setTimeout(() => this.checkInactivity(), inactivityTimeout);
  }

  add(event: Event<T>): void {
    if (this._closed) return;

    this.events.push(event);
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.checkInactivity(), this.inactivityTimeout);
  }

  private checkInactivity(): void {
    const lastEvent = this.events[this.events.length - 1];
    if (lastEvent && Date.now() - lastEvent.timestamp > this.inactivityTimeout) {
      this.close();
    }
  }

  isFull(): boolean {
    return this.events.length > 0 &&
           this.events[this.events.length - 1].timestamp >= this.endTime;
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    clearTimeout(this.timeout);

    this.processor.emit('windowClose', this);

    if (this.windowFn) {
      this.windowFn(this).then(result => {
        this.processor.emit('windowResult', this, result);
      }).catch(error => {
        this.processor.emit('windowError', this, error);
      });
    }
  }
}

export class StreamProcessorImpl<T = any> extends EventEmitter implements StreamProcessor<T> {
  private windows: Window<T>[] = [];
  private states: Map<string, { state: any; fn: StateFunction<T, any> }> = new Map();
  private activeStreams: Map<string, Subscription> = new Map();
  private metrics: ProcessorMetrics = {
    eventsProcessed: 0,
    errors: 0,
    lastProcessedTime: 0,
    avgProcessingTime: 0,
    throughput: 0,
    memoryUsage: 0,
    checkpointStatus: {
      lastCheckpoint: 0,
      nextCheckpoint: 0
    }
  };

  private processingQueue: Event<T>[] = [];
  private isProcessing = false;
  private config: ProcessingConfig;
  private faultConfig: FaultToleranceConfig;
  private stateStorage: Map<string, any> = new Map();

  constructor(
    config: ProcessingConfig,
    faultConfig: FaultToleranceConfig
  ) {
    super();
    this.config = {
      concurrency: 1,
      batchSize: 100,
      maxRetries: 3,
      timeout: 5000,
      backpressure: {
        enabled: true,
        threshold: 10000,
        strategy: 'buffer'
      },
      ...config
    };

    this.faultConfig = faultConfig;
    this.startProcessingLoop();
  }

  process(stream: Stream<T>): void {
    const subscription = stream.subscribe({
      next: (event) => this.handleEvent(event),
      error: (error) => this.handleError(error),
      complete: () => this.handleComplete()
    });

    this.activeStreams.set(stream.id, subscription);
  }

  private async handleEvent(event: Event<T>): Promise<void> {
    this.metrics.eventsProcessed++;
    this.metrics.lastProcessedTime = Date.now();

    this.processingQueue.push(event);

    if (this.config.backpressure.enabled &&
        this.processingQueue.length > this.config.backpressure.threshold) {
      this.emit('backpressure', this.processingQueue.length);
    }
  }

  private async processEvents(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) return;

    this.isProcessing = true;

    const batch = this.processingQueue.splice(0, this.config.batchSize);

    try {
      const promises = batch.map(event => this.processEventWithRetry(event));
      const results = await Promise.allSettled(promises);

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          this.metrics.errors++;
          this.emit('error', result.reason);
        }
      });

      this.updateMetrics(batch.length);
    } catch (error) {
      this.metrics.errors++;
      this.emit('error', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processEventWithRetry(event: Event<T>, retryCount = 0): Promise<void> {
    try {
      await this.processSingleEvent(event);
    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        const backoff = Math.min(
          this.faultConfig.recovery.backoff.max,
          this.faultConfig.recovery.backoff.initial *
            Math.pow(this.faultConfig.recovery.backoff.multiplier, retryCount)
        );

        await new Promise(resolve => setTimeout(resolve, backoff));
        return this.processEventWithRetry(event, retryCount + 1);
      }
      throw error;
    }
  }

  private async processSingleEvent(event: Event<T>): Promise<void> {
    const startTime = Date.now();

    for (const window of this.windows) {
      if (!window.isFull()) {
        window.add(event);
      }
    }

    for (const [key, { fn, state }] of this.states) {
      const newState = await fn(key, state, event);
      this.stateStorage.set(key, newState);
    }

    const processingTime = Date.now() - startTime;
    const totalProcessingTime = this.metrics.avgProcessingTime * this.metrics.eventsProcessed;
    this.metrics.avgProcessingTime = (totalProcessingTime + processingTime) / this.metrics.eventsProcessed;
  }

  private updateMetrics(batchSize: number): void {
    const now = Date.now();
    const timeDiff = now - this.metrics.lastProcessedTime;

    if (timeDiff > 0) {
      this.metrics.throughput = (batchSize / timeDiff) * 1000;
    }

    this.metrics.memoryUsage = process.memoryUsage ?
      process.memoryUsage().heapUsed : this.processingQueue.length * 1024;
  }

  addWindow(config: WindowConfig, fn: WindowFunction<T, any>): void {
    let window: Window<T>;

    switch (config.type) {
      case 'time':
        window = new TimeWindow(config.size, config.slide || config.size, fn, this);
        break;
      case 'count':
        window = new CountWindow(config.size, config.slide || config.size, fn, this);
        break;
      case 'session':
        window = new SessionWindow(
          config.size,
          config.slide || config.size,
          fn,
          this,
          (event) => event.key || event.id,
          config.gap
        );
        break;
      default:
        throw new Error(`Unknown window type: ${config.type}`);
    }

    this.windows.push(window);

    this.on('windowResult', (window, result) => {
      this.emit('windowAggregate', result);
    });
  }

  addState(key: string, initialState: any, fn: StateFunction<T, any>): void {
    this.states.set(key, {
      state: initialState,
      fn
    });
    this.stateStorage.set(key, initialState);
  }

  async checkpoint(): Promise<void> {
    const checkpointData = {
      windows: this.windows.map(w => ({
        id: w.id,
        events: w.events,
        startTime: w.startTime,
        endTime: w.endTime
      })),
      states: Object.fromEntries(this.stateStorage),
      timestamp: Date.now()
    };

    this.emit('checkpoint', checkpointData);
    this.metrics.checkpointStatus.lastCheckpoint = Date.now();
    this.metrics.checkpointStatus.nextCheckpoint =
      Date.now() + this.faultConfig.checkpointing.interval;
  }

  async recover(): Promise<void> {
    this.emit('recoveryStart');

    try {
      const checkpointData = await this.getLastCheckpoint();

      if (checkpointData) {
        for (const windowData of checkpointData.windows) {
          const window = this.windows.find(w => w.id === windowData.id);
          if (window) {
            windowData.events.forEach((event: any) => window.add(event));
          }
        }

        this.stateStorage = new Map(Object.entries(checkpointData.states));

        this.emit('recoveryComplete', checkpointData);
      }
    } catch (error) {
      this.emit('recoveryError', error);
    }
  }

  private async getLastCheckpoint(): Promise<any> {
    return null;
  }

  getMetrics(): ProcessorMetrics {
    return { ...this.metrics };
  }

  stop(): void {
    this.activeStreams.forEach(subscription => subscription.unsubscribe());
    this.activeStreams.clear();
    this.processingQueue.length = 0;
    this.windows.forEach(window => window.close());
    this.windows = [];
  }

  private startProcessingLoop(): void {
    setInterval(() => {
      this.processEvents();
    }, 1000 / this.config.concurrency);

    setInterval(() => {
      if (this.faultConfig.checkpointing.interval > 0) {
        this.checkpoint();
      }
    }, this.faultConfig.checkpointing.interval);
  }

  private handleError(error: Error): void {
    this.metrics.errors++;
    this.emit('error', error);
  }

  private handleComplete(): void {
    this.emit('complete');
  }
}