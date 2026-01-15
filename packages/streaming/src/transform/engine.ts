import { EventEmitter } from 'events';
import {
  Event,
  Stream,
  StreamTransformer,
  StreamObserver,
  Subscription,
  WindowConfig,
  AggregationConfig,
  JoinConfig,
  TransformMetrics
} from '../types';

export interface TransformFunction<T = any, U = any> {
  (event: Event<T>, ctx?: TransformContext): Event<U> | Promise<Event<U>>;
}

export interface TransformContext {
  batch: Event<any>[];
  state: Map<string, any>;
  metrics: TransformMetrics;
  timestamp: number;
}

export interface TransformOperation {
  type: 'map' | 'filter' | 'join' | 'aggregate' | 'custom';
  name: string;
  config: any;
  fn: TransformFunction;
  enabled?: boolean;
}

export class TransformEngine<T = any> extends EventEmitter implements StreamTransformer<T, T> {
  private operations: TransformOperation[] = [];
  private metrics: TransformMetrics = {
    operations: {},
    cache: {
      hits: 0,
      misses: 0,
      size: 0
    }
  };

  private state: Map<string, any> = new Map();
  private batch: Event<any>[] = [];
  private cache: Map<string, any> = new Map();
  private cacheTTL: number = 60000;
  private maxCacheSize: number = 10000;

  constructor(
    private config: {
      batchSize?: number;
      enableCaching?: boolean;
      cacheSize?: number;
      cacheTTL?: number;
    } = {}
  ) {
    super();
    this.config = {
      batchSize: 1000,
      enableCaching: true,
      cacheSize: 10000,
      cacheTTL: 60000,
      ...config
    };

    if (this.config.enableCaching) {
      this.startCacheCleanup();
    }
  }

  map<U>(fn: TransformFunction<T, U>, name = 'map'): TransformEngine<T> {
    this.operations.push({
      type: 'map',
      name,
      config: { preserveKey: true },
      fn
    });
    return this;
  }

  filter(predicate: TransformFunction<T, T>, name = 'filter'): TransformEngine<T> {
    this.operations.push({
      type: 'filter',
      name,
      config: { allowPass: true },
      fn
    });
    return this;
  }

  join<Target>(
    otherStream: Stream<Target>,
    on: (left: Event<T>, right: Event<Target>) => boolean,
    config: Partial<JoinConfig> = {}
  ): TransformEngine<T> {
    this.operations.push({
      type: 'join',
      name: 'join',
      config: { otherStream, on, ...config },
      fn: async (event: Event<T>) => {
        const otherEvents = this.getStreamEvents(otherStream);
        const matches = otherEvents.filter(e => on(event, e));

        if (matches.length > 0) {
          return { ...event, joined: matches };
        }

        return config.type === 'left' || config.type === 'full' ? event : null;
      }
    });
    return this;
  }

  aggregate(config: AggregationConfig, name = 'aggregate'): TransformEngine<T> {
    let window: Window<T>;

    switch (config.windows?.[0]?.type) {
      case 'time':
        window = new TimeWindow<T>(config.windows[0].size, config.windows[0].slide || config.windows[0].size);
        break;
      case 'count':
        window = new CountWindow<T>(config.windows[0].size, config.windows[0].slide || config.windows[0].size);
        break;
      default:
        window = new Window<T>(config.size, config.slide || config.size);
    }

    this.operations.push({
      type: 'aggregate',
      name,
      config,
      fn: (event: Event<T>) => {
        window.add(event);
        return this.performAggregation(window, config);
      }
    });
    return this;
  }

  custom<U>(fn: TransformFunction<T, U>, name: string, config = {}): TransformEngine<T> {
    this.operations.push({
      type: 'custom',
      name,
      config,
      fn
    });
    return this;
  }

  transform(event: Event<T>): Promise<Event<T>> {
    const startTime = performance.now();
    const operationName = this.getOperationName(event);

    this.metrics.operations[operationName] = {
      count: (this.metrics.operations[operationName]?.count || 0) + 1,
      duration: this.metrics.operations[operationName]?.duration || 0,
      errors: this.metrics.operations[operationName]?.errors || 0
    };

    const ctx: TransformContext = {
      batch: this.batch,
      state: this.state,
      metrics: this.metrics,
      timestamp: Date.now()
    };

    return this.transformEvent(event, ctx, startTime);
  }

  private async transformEvent(
    event: Event<T>,
    ctx: TransformContext,
    startTime: number
  ): Promise<Event<T>> {
    let result: Event<T> = event;
    let operationIndex = 0;

    for (const operation of this.operations) {
      if (!operation.enabled) continue;

      try {
        const operationStartTime = performance.now();

        if (operation.type === 'filter') {
          const filterResult = await operation.fn(result, ctx);
          if (!filterResult) {
            this.metrics.operations[operation.name].errors++;
            return null;
          }
          result = filterResult;
        } else {
          result = await operation.fn(result, ctx);
          if (!result) {
            return null;
          }
        }

        const operationDuration = performance.now() - operationStartTime;
        this.metrics.operations[operation.name].duration += operationDuration;

        if (operation.type === 'map' && operation.config?.preserveKey !== false) {
          result.key = result.key || event.key;
        }

      } catch (error) {
        this.metrics.operations[operation.name].errors++;
        this.emit('transformError', error, event, operation);
        throw error;
      }

      operationIndex++;
    }

    const totalTime = performance.now() - startTime;
    this.metrics.operations[this.getOperationName(event)].duration += totalTime;

    if (this.config.enableCaching) {
      this.setCache(event.id, result);
    }

    this.addBatch(event);

    return result;
  }

  private performAggregation(window: Window<T>, config: AggregationConfig): Event<T> {
    const values = window.events.map(e => {
      if (config.field.includes('.')) {
        return this.getNestedValue(e.data, config.field);
      }
      return e.data[config.field];
    }).filter(v => v !== undefined);

    let result: any;

    switch (config.operation) {
      case 'sum':
        result = values.reduce((sum, val) => sum + Number(val), 0);
        break;
      case 'avg':
        result = values.length > 0 ? values.reduce((sum, val) => sum + Number(val), 0) / values.length : 0;
        break;
      case 'min':
        result = values.length > 0 ? Math.min(...values.map(Number)) : 0;
        break;
      case 'max':
        result = values.length > 0 ? Math.max(...values.map(Number)) : 0;
        break;
      case 'count':
        result = values.length;
        break;
      case 'custom':
        result = config.customFn?.(values);
        break;
      default:
        throw new Error(`Unknown aggregation operation: ${config.operation}`);
    }

    return {
      id: `agg_${Date.now()}`,
      timestamp: Date.now(),
      data: result,
      metadata: {
        operation: config.operation,
        field: config.field,
        count: values.length
      }
    };
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private getOperationName(event: Event<T>): string {
    const keys = Object.keys(event.data || {});
    return keys.length > 0 ? `op_${keys[0]}` : 'default';
  }

  private setCache(key: string, value: any): void {
    if (this.cache.size >= this.config.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
    this.metrics.cache.size = this.cache.size;
    this.metrics.cache.misses++;
  }

  private getCache(key: string): any {
    const cached = this.cache.get(key);
    if (!cached) {
      this.metrics.cache.misses++;
      return null;
    }

    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      this.metrics.cache.misses++;
      return null;
    }

    this.metrics.cache.hits++;
    return cached.value;
  }

  private addBatch(event: Event<T>): void {
    this.batch.push(event);
    if (this.batch.length >= this.config.batchSize) {
      this.emit('batch', this.batch);
      this.batch = [];
    }
  }

  private getStreamEvents<Target>(stream: Stream<Target>): Event<Target>[] {
    return [];
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.cacheTTL) {
          this.cache.delete(key);
        }
      }
      this.metrics.cache.size = this.cache.size;
    }, 30000);
  }

  getMetrics(): TransformMetrics {
    return { ...this.metrics };
  }

  enableOperation(name: string): void {
    const operation = this.operations.find(op => op.name === name);
    if (operation) {
      operation.enabled = true;
    }
  }

  disableOperation(name: string): void {
    const operation = this.operations.find(op => op.name === name);
    if (operation) {
      operation.enabled = false;
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.metrics.cache = {
      hits: 0,
      misses: 0,
      size: 0
    };
  }

  resetMetrics(): void {
    this.metrics = {
      operations: {},
      cache: {
        hits: 0,
        misses: 0,
        size: 0
      }
    };
  }

  error(error: Error, event: Event<T>): Promise<Event<T>> {
    this.emit('transformError', error, event);
    return Promise.reject(error);
  }

  complete(): void {
    this.emit('transformComplete');
  }
}

class Window<T = any> {
  constructor(
    private size: number,
    private slide: number
  ) {}

  add(event: Event<T>): void {}
  get events(): Event<T>[] { return []; }
}

interface StreamCollection<T = any> {
  addStream(stream: Stream<T>): void;
  removeStream(streamId: string): void;
  getStreams(): Stream<T>[];
}

export class TransformEngineFactory {
  static create<T>(config?: ConstructorParameters<typeof TransformEngine>[0]): TransformEngine<T> {
    return new TransformEngine<T>(config);
  }

  static createWithAggregation<T>(
    configs: AggregationConfig[],
    baseConfig?: ConstructorParameters<typeof TransformEngine>[0]
  ): TransformEngine<T> {
    const engine = new TransformEngine<T>(baseConfig);

    configs.forEach((config, index) => {
      engine.aggregate(config, `agg_${index}`);
    });

    return engine;
  }

  static createWithPipeline<T>(
    operations: TransformOperation[],
    baseConfig?: ConstructorParameters<typeof TransformEngine>[0]
  ): TransformEngine<T> {
    const engine = new TransformEngine<T>(baseConfig);

    operations.forEach(op => {
      engine.operations.push(op);
    });

    return engine;
  }
}