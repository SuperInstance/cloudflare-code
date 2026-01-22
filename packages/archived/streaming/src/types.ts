export interface Event<T = any> {
  id: string;
  timestamp: number;
  data: T;
  metadata?: Record<string, any>;
  key?: string;
  headers?: Record<string, string>;
  sequence?: number;
}

export interface Stream<T = any> {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly schema?: {
    type: 'json' | 'avro' | 'protobuf' | 'string';
    schema?: any;
  };

  subscribe(observer: StreamObserver<T>): Subscription;
  unsubscribe(subscription: Subscription): void;
  pipe<Target>(transformer: StreamTransformer<T, Target>): Stream<Target>;
  filter(predicate: (event: Event<T>) => boolean): Stream<T>;
  map<U>(mapper: (event: Event<T>) => Event<U>): Stream<U>;
  take(count: number): Stream<T>;
  throttle(duration: number): Stream<T>;
  debounce(duration: number): Stream<T>;
}

export interface StreamObserver<T> {
  next?(event: Event<T>): void;
  error?(error: Error): void;
  complete?(): void;
}

export interface Subscription {
  unsubscribe(): void;
  closed: boolean;
  id: string;
}

export interface StreamTransformer<T, U> {
  transform(event: Event<T>): Event<U> | Promise<Event<U>>;
  error?(error: Error, event: Event<T>): Event<U> | Promise<Event<U>>;
  complete?(): void;
}

export interface WindowConfig {
  type: 'time' | 'count' | 'session';
  size: number;
  slide?: number;
  gap?: number;
}

export interface AggregationConfig {
  operation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'custom';
  field: string;
  windows?: WindowConfig[];
  groupBy?: string[];
}

export interface JoinConfig {
  type: 'inner' | 'left' | 'right' | 'full';
  streams: string[];
  fields: { [key: string]: string };
  window?: WindowConfig;
}

export interface ProcessingConfig {
  concurrency: number;
  batchSize: number;
  maxRetries: number;
  timeout: number;
  backpressure: {
    enabled: boolean;
    threshold: number;
    strategy: 'drop' | 'buffer' | 'wait';
  };
}

export interface CheckpointConfig {
  interval: number;
  maxSnapshots: number;
  storage: {
    type: 'memory' | 'file' | 'database';
    config: any;
  };
}

export interface FaultToleranceConfig {
  strategy: 'at-least-once' | 'at-most-once' | 'exactly-once';
  checkpointing: CheckpointConfig;
  recovery: {
    maxAttempts: number;
    backoff: {
      initial: number;
      max: number;
      multiplier: number;
    };
  };
  idempotency: {
    enabled: boolean;
    keyGenerator?: (event: Event) => string;
    ttl: number;
  };
}

export interface SourceConfig {
  type: 'kafka' | 'http' | 'websocket' | 'database' | 'file';
  connection: any;
  options?: {
    batchSize?: number;
    maxRetries?: number;
    timeout?: number;
    partitioning?: {
      strategy: 'round-robin' | 'hash' | 'consistent';
      key?: string;
    };
  };
}

export interface ProcessorMetrics {
  eventsProcessed: number;
  errors: number;
  lastProcessedTime: number;
  avgProcessingTime: number;
  throughput: number;
  memoryUsage: number;
  checkpointStatus: {
    lastCheckpoint: number;
    nextCheckpoint: number;
  };
}

export interface TransformMetrics {
  operations: {
    [key: string]: {
      count: number;
      duration: number;
      errors: number;
    };
  };
  cache: {
    hits: number;
    misses: number;
    size: number;
  };
}