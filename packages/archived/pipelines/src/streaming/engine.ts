// @ts-nocheck
/**
 * Stream Processing Engine
 * Real-time data stream processing with transformations and windowing
 */

import type {
  StreamEvent,
  TransformConfig,
  WindowConfig,
  AggregationOperation,
  AggregateResult
} from '../types';

export interface StreamProcessorConfig {
  id: string;
  transforms: TransformConfig[];
  windowing?: WindowConfig;
  parallelism?: number;
  bufferSize?: number;
}

export class StreamProcessor {
  private config: StreamProcessorConfig;
  private transformFns: Map<string, TransformFunction> = new Map();
  private windowBuffer: WindowBuffer | null = null;
  private isRunning = false;
  private controller: AbortController | null = null;
  private metrics: ProcessingMetrics = {
    recordsProcessed: 0,
    recordsDropped: 0,
    errors: 0,
    startTime: null,
    endTime: null
  };

  constructor(config: StreamProcessorConfig) {
    this.config = config;
    this.initializeTransforms();

    if (config.windowing) {
      this.windowBuffer = new WindowBuffer(config.windowing);
    }
  }

  /**
   * Process a stream of events
   */
  async *process(events: AsyncIterable<StreamEvent>): AsyncGenerator<StreamEvent> {
    this.isRunning = true;
    this.metrics.startTime = new Date();
    this.controller = new AbortController();

    try {
      for await (const event of events) {
        if (this.controller?.signal.aborted) {
          break;
        }

        try {
          // Apply transforms
          let result = event;
          for (const transform of this.config.transforms) {
            result = await this.applyTransform(result, transform);

            // Skip if transform filtered out the event
            if (!result) {
              this.metrics.recordsDropped++;
              continue;
            }
          }

          // Apply windowing if configured
          if (this.windowBuffer) {
            const windowResults = this.windowBuffer.add(result);
            for (const windowResult of windowResults) {
              yield this.createAggregateEvent(windowResult);
            }
          } else {
            yield result;
          }

          this.metrics.recordsProcessed++;
        } catch (error) {
          this.metrics.errors++;
          console.error('Error processing event:', error);
        }
      }

      // Flush any remaining window data
      if (this.windowBuffer) {
        const finalResults = this.windowBuffer.flush();
        for (const result of finalResults) {
          yield this.createAggregateEvent(result);
        }
      }
    } finally {
      this.isRunning = false;
      this.metrics.endTime = new Date();
    }
  }

  /**
   * Process a single event
   */
  async processOne(event: StreamEvent): Promise<StreamEvent | null> {
    let result = event;

    for (const transform of this.config.transforms) {
      result = await this.applyTransform(result, transform);
      if (!result) {
        return null;
      }
    }

    return result;
  }

  /**
   * Stop processing
   */
  stop(): void {
    if (this.controller) {
      this.controller.abort();
    }
    this.isRunning = false;
  }

  /**
   * Get processing metrics
   */
  getMetrics(): ProcessingMetrics {
    return { ...this.metrics };
  }

  /**
   * Initialize transform functions
   */
  private initializeTransforms(): void {
    for (const transform of this.config.transforms) {
      const fn = this.createTransformFunction(transform);
      this.transformFns.set(transform.id, fn);
    }
  }

  /**
   * Create transform function from config
   */
  private createTransformFunction(config: TransformConfig): TransformFunction {
    switch (config.type) {
      case 'map':
        return this.createMapTransform(config.config as any);
      case 'filter':
        return this.createFilterTransform(config.config as any);
      case 'aggregate':
        return this.createAggregateTransform(config.config as any);
      case 'normalize':
        return this.createNormalizeTransform(config.config as any);
      case 'enrich':
        return this.createEnrichTransform(config.config as any);
      case 'validate':
        return this.createValidateTransform(config.config as any);
      default:
        throw new Error(`Unsupported transform type: ${config.type}`);
    }
  }

  /**
   * Create map transform
   */
  private createMapTransform(config: any): TransformFunction {
    const fn = new Function('record', 'timestamp', `
      "use strict";
      try {
        ${config.script}
      } catch (error) {
        console.error("Map transform error:", error);
        return record;
      }
    `);

    return async (event: StreamEvent) => {
      const mappedValue = fn(event.value, event.timestamp);
      return {
        ...event,
        value: mappedValue
      };
    };
  }

  /**
   * Create filter transform
   */
  private createFilterTransform(config: any): TransformFunction {
    const fn = new Function('record', 'timestamp', `
      "use strict";
      try {
        return ${config.condition};
      } catch (error) {
        console.error("Filter transform error:", error);
        return false;
      }
    `);

    return async (event: StreamEvent) => {
      const passes = fn(event.value, event.timestamp);
      return passes ? event : null;
    };
  }

  /**
   * Create aggregate transform
   */
  private createAggregateTransform(config: any): TransformFunction {
    return async (event: StreamEvent) => {
      // Aggregation is handled by window buffer
      return event;
    };
  }

  /**
   * Create normalize transform
   */
  private createNormalizeTransform(config: any): TransformFunction {
    return async (event: StreamEvent) => {
      if (typeof event.value !== 'object' || event.value === null) {
        return event;
      }

      const normalized = { ...event.value } as Record<string, unknown>;

      for (const operation of config.operations) {
        const value = (normalized as Record<string, unknown>)[operation.field];
        if (value !== undefined && value !== null) {
          (normalized as Record<string, unknown>)[operation.field] =
            this.applyNormalization(value, operation);
        }
      }

      return {
        ...event,
        value: normalized
      };
    };
  }

  /**
   * Apply normalization operation
   */
  private applyNormalization(value: unknown, operation: any): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    switch (operation.operation) {
      case 'lowercase':
        return value.toLowerCase();
      case 'uppercase':
        return value.toUpperCase();
      case 'trim':
        return value.trim();
      case 'replace':
        return value.replace(
          new RegExp(operation.params.pattern, operation.params.flags || 'g'),
          operation.params.replacement
        );
      default:
        return value;
    }
  }

  /**
   * Create enrich transform
   */
  private createEnrichTransform(config: any): TransformFunction {
    return async (event: StreamEvent) => {
      if (typeof event.value !== 'object' || event.value === null) {
        return event;
      }

      const enriched = { ...event.value } as Record<string, unknown>;

      for (const [targetField, sourceField] of Object.entries(config.mappings)) {
        enriched[targetField] = this.extractField(event.value, sourceField as string);
      }

      return {
        ...event,
        value: enriched
      };
    };
  }

  /**
   * Extract nested field from object
   */
  private extractField(obj: unknown, path: string): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return null;
    }

    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
      if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * Create validate transform
   */
  private createValidateTransform(config: any): TransformFunction {
    return async (event: StreamEvent) => {
      const isValid = this.validateSchema(event.value, config.schema);

      if (!isValid) {
        if (config.onFailure === 'drop') {
          return null;
        } else if (config.onFailure === 'quarantine') {
          return {
            ...event,
            metadata: {
              ...event.metadata,
              quarantined: true,
              validationError: 'Schema validation failed'
            }
          };
        }
      }

      return event;
    };
  }

  /**
   * Validate against schema (simplified)
   */
  private validateSchema(value: unknown, schema: any): boolean {
    // In a real implementation, this would use a proper schema validator
    // like Zod, Ajv, or similar
    return true;
  }

  /**
   * Apply transform to event
   */
  private async applyTransform(
    event: StreamEvent,
    config: TransformConfig
  ): Promise<StreamEvent | null> {
    const fn = this.transformFns.get(config.id);
    if (!fn) {
      throw new Error(`Transform function not found: ${config.id}`);
    }

    // Check condition
    if (config.condition) {
      const conditionFn = new Function('record', `return ${config.condition}`);
      const passesCondition = conditionFn(event.value);
      if (!passesCondition) {
        return event;
      }
    }

    return fn(event);
  }

  /**
   * Create aggregate event from window result
   */
  private createAggregateEvent(result: AggregateResult): StreamEvent {
    return {
      key: `window-${result.windowStart.getTime()}-${result.windowEnd.getTime()}`,
      value: result.value,
      timestamp: result.windowEnd,
      headers: {},
      metadata: {
        windowStart: result.windowStart,
        windowEnd: result.windowEnd,
        windowKey: result.key
      }
    };
  }
}

/**
 * Transform function type
 */
type TransformFunction = (event: StreamEvent) => Promise<StreamEvent | null>;

/**
 * Processing metrics
 */
interface ProcessingMetrics {
  recordsProcessed: number;
  recordsDropped: number;
  errors: number;
  startTime: Date | null;
  endTime: Date | null;
}

/**
 * Window buffer for time-based aggregation
 */
class WindowBuffer {
  private config: WindowConfig;
  private windows: Map<string, Window> = new Map();
  private currentWindowId: string | null = null;

  constructor(config: WindowConfig) {
    this.config = config;
  }

  /**
   * Add event to window buffer
   */
  add(event: StreamEvent): AggregateResult[] {
    const results: AggregateResult[] = [];
    const windowId = this.getWindowId(event.timestamp);

    // Create new window if needed
    if (!this.windows.has(windowId)) {
      this.windows.set(windowId, {
        id: windowId,
        start: this.getWindowStart(event.timestamp),
        end: this.getWindowEnd(event.timestamp),
        events: []
      });
    }

    // Add event to window
    const window = this.windows.get(windowId)!;
    window.events.push(event);

    // Emit completed windows
    if (this.config.type === 'tumbling' || this.config.type === 'sliding') {
      const completedWindows = this.getCompletedWindows(event.timestamp);
      for (const completedWindow of completedWindows) {
        results.push(this.aggregateWindow(completedWindow));
        this.windows.delete(completedWindow.id);
      }
    }

    return results;
  }

  /**
   * Flush all windows
   */
  flush(): AggregateResult[] {
    const results: AggregateResult[] = [];

    for (const window of this.windows.values()) {
      results.push(this.aggregateWindow(window));
    }

    this.windows.clear();
    return results;
  }

  /**
   * Get window ID for timestamp
   */
  private getWindowId(timestamp: Date): string {
    const time = timestamp.getTime();
    const size = this.config.size;

    if (this.config.type === 'tumbling') {
      return `window-${Math.floor(time / size) * size}`;
    } else if (this.config.type === 'sliding') {
      const slide = this.config.slide || size;
      return `window-${Math.floor(time / slide) * slide}`;
    } else {
      // Session windows use event-based IDs
      return `session-${time}`;
    }
  }

  /**
   * Get window start time
   */
  private getWindowStart(timestamp: Date): Date {
    const time = timestamp.getTime();
    const size = this.config.size;

    if (this.config.type === 'tumbling') {
      return new Date(Math.floor(time / size) * size);
    } else if (this.config.type === 'sliding') {
      const slide = this.config.slide || size;
      return new Date(Math.floor(time / slide) * slide);
    } else {
      return new Date(time);
    }
  }

  /**
   * Get window end time
   */
  private getWindowEnd(timestamp: Date): Date {
    const start = this.getWindowStart(timestamp).getTime();
    const size = this.config.size;
    return new Date(start + size);
  }

  /**
   * Get completed windows
   */
  private getCompletedWindows(currentTime: Date): Window[] {
    const completed: Window[] = [];
    const currentTimeMs = currentTime.getTime();

    for (const window of this.windows.values()) {
      if (window.end.getTime() <= currentTimeMs) {
        completed.push(window);
      }
    }

    return completed;
  }

  /**
   * Aggregate window
   */
  private aggregateWindow(window: Window): AggregateResult {
    const value: Record<string, unknown> = {
      windowStart: window.start,
      windowEnd: window.end,
      count: window.events.length
    };

    // Calculate basic aggregations
    if (window.events.length > 0) {
      const firstEvent = window.events[0];
      if (typeof firstEvent.value === 'object' && firstEvent.value !== null) {
        const obj = firstEvent.value as Record<string, unknown>;

        // Sum numeric fields
        for (const [key, val] of Object.entries(obj)) {
          if (typeof val === 'number') {
            const sum = window.events.reduce((acc, e) => {
              if (typeof e.value === 'object' && e.value !== null) {
                const v = (e.value as Record<string, unknown>)[key];
                return acc + (typeof v === 'number' ? v : 0);
              }
              return acc;
            }, 0);

            value[`${key}_sum`] = sum;
            value[`${key}_avg`] = sum / window.events.length;
          }
        }
      }
    }

    return {
      windowStart: window.start,
      windowEnd: window.end,
      key: window.id,
      value
    };
  }
}

/**
 * Window representation
 */
interface Window {
  id: string;
  start: Date;
  end: Date;
  events: StreamEvent[];
}
