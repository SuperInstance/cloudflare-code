/**
 * Stream processing implementation
 * Supports transformation, aggregation, windowing, joins, and CEP
 */

import type {
  StreamEvent,
  StreamProcessor,
  WindowOptions,
  Aggregation,
  JoinOptions,
  CEPPattern,
  PatternExpression,
  PatternAction,
  PatternMatch
} from '../types/index.js';
import { EventStream } from '../stream/event-stream.js';
import { delay } from '../utils/timing.js';

// ============================================================================
// Stream Transformer
// ============================================================================

export class StreamTransformer<TInput = unknown, TOutput = unknown> {
  private processors: StreamProcessor<TInput, TOutput>[] = [];

  /**
   * Add a processor to the pipeline
   */
  pipe(processor: StreamProcessor<TInput, TOutput>): StreamTransformer<TInput, TOutput> {
    this.processors.push(processor);
    return this;
  }

  /**
   * Process events through all processors
   */
  async process(events: StreamEvent<TInput>[]): Promise<StreamEvent<TOutput>[]> {
    let currentEvents: StreamEvent<TInput>[] = events;

    for (const processor of this.processors) {
      const results: StreamEvent<TOutput>[] = [];

      for (const event of currentEvents) {
        try {
          const output = await processor.process(event);
          if (Array.isArray(output)) {
            for (const item of output) {
              results.push(this.createOutputEvent(item, event));
            }
          } else if (output !== null && output !== undefined) {
            results.push(this.createOutputEvent(output, event));
          }
        } catch (error) {
          // Log error but continue processing
          console.error('Processor error:', error);
        }
      }

      currentEvents = results as any;
    }

    return currentEvents as any;
  }

  /**
   * Create output event with causality tracking
   */
  private createOutputEvent<T>(data: T, sourceEvent: StreamEvent): StreamEvent<T> {
    return {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'transformed',
      data,
      timestamp: Date.now(),
      metadata: {
        source: sourceEvent.type,
        causationId: sourceEvent.id,
        correlationId: sourceEvent.metadata?.correlationId,
      },
    };
  }

  /**
   * Clear all processors
   */
  clear(): void {
    this.processors = [];
  }
}

// ============================================================================
// Window Operator
// ============================================================================

export class WindowOperator {
  private windows: Map<string, Window> = new Map();
  private options: WindowOptions;

  constructor(options: WindowOptions) {
    this.options = options;
  }

  /**
   * Process event through window
   */
  process(event: StreamEvent): WindowedEvent[] {
    const windowId = this.getWindowId(event);
    let window = this.windows.get(windowId);

    if (!window) {
      window = this.createWindow();
      this.windows.set(windowId, window);
    }

    // Add event to window
    window.events.push(event);

    // Update window metadata
    if (window.events.length === 1) {
      window.startTime = event.timestamp;
    }
    window.lastEventTime = event.timestamp;

    // Check if window should emit
    const shouldEmit = this.shouldEmit(window);

    if (shouldEmit) {
      const result = this.emitWindow(window);
      this.windows.delete(windowId);
      return result;
    }

    return [];
  }

  /**
   * Get window ID for event
   */
  private getWindowId(event: StreamEvent): string {
    switch (this.options.type) {
      case 'tumbling':
        // Floor timestamp to window size
        const windowStart = Math.floor(event.timestamp / this.options.size) * this.options.size;
        return `tumbling_${windowStart}`;

      case 'sliding':
        // Create window based on slide interval
        const slideStart = Math.floor(event.timestamp / (this.options.slide ?? this.options.size)) * (this.options.slide ?? this.options.size);
        return `sliding_${slideStart}`;

      case 'session':
        // Group by session key (e.g., user ID)
        const sessionKey = event.metadata?.sessionId ?? 'default';
        return `session_${sessionKey}`;
    }
  }

  /**
   * Create new window
   */
  private createWindow(): Window {
    return {
      events: [],
      startTime: 0,
      lastEventTime: 0,
    };
  }

  /**
   * Check if window should emit
   */
  private shouldEmit(window: Window): boolean {
    const now = Date.now();

    switch (this.options.type) {
      case 'tumbling':
        // Emit when window expires
        return now - window.startTime >= this.options.size;

      case 'sliding':
        // Emit on every slide interval
        return now - window.startTime >= (this.options.slide ?? this.options.size);

      case 'session':
        // Emit when session timeout expires
        return now - window.lastEventTime >= (this.options.sessionTimeout ?? 30000);
    }
  }

  /**
   * Emit windowed events
   */
  private emitWindow(window: Window): WindowedEvent[] {
    return [
      {
        events: window.events,
        windowStart: window.startTime,
        windowEnd: window.lastEventTime,
        count: window.events.length,
      },
    ];
  }

  /**
   * Close all windows
   */
  closeAll(): WindowedEvent[] {
    const results: WindowedEvent[] = [];

    for (const window of this.windows.values()) {
      results.push({
        events: window.events,
        windowStart: window.startTime,
        windowEnd: window.lastEventTime,
        count: window.events.length,
      });
    }

    this.windows.clear();
    return results;
  }
}

interface Window {
  events: StreamEvent[];
  startTime: number;
  lastEventTime: number;
}

export interface WindowedEvent {
  events: StreamEvent[];
  windowStart: number;
  windowEnd: number;
  count: number;
}

// ============================================================================
// Stream Aggregator
// ============================================================================

export class StreamAggregator<T> {
  private aggregation: Aggregation<T>;
  private current: T;
  private count = 0;

  constructor(aggregation: Aggregation<T>) {
    this.aggregation = aggregation;
    this.current = aggregation.initialValue;
  }

  /**
   * Add event to aggregation
   */
  add(event: StreamEvent): T {
    this.current = this.aggregation.accumulator(this.current, event);
    this.count++;
    return this.current;
  }

  /**
   * Get current aggregation value
   */
  getCurrent(): T {
    return this.current;
  }

  /**
   * Get event count
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Reset aggregation
   */
  reset(): void {
    this.current = this.aggregation.initialValue;
    this.count = 0;
  }
}

/**
 * Common aggregation functions
 */
export const Aggregations = {
  /**
   * Count events
   */
  count: (): Aggregation<number> => ({
    accumulator: (acc) => acc + 1,
    initialValue: 0,
  }),

  /**
   * Sum numeric values
   */
  sum: (selector: (event: StreamEvent) => number): Aggregation<number> => ({
    accumulator: (acc, event) => acc + selector(event),
    initialValue: 0,
  }),

  /**
   * Average numeric values
   */
  average: (selector: (event: StreamEvent) => number): Aggregation<{ sum: number; count: number }> => ({
    accumulator: (acc, event) => ({
      sum: acc.sum + selector(event),
      count: acc.count + 1,
    }),
    initialValue: { sum: 0, count: 0 },
    seed: { sum: 0, count: 0 },
  }),

  /**
   * Min value
   */
  min: (selector: (event: StreamEvent) => number): Aggregation<number | null> => ({
    accumulator: (acc, event) => {
      const value = selector(event);
      return acc === null ? value : Math.min(acc, value);
    },
    initialValue: null as any,
  }),

  /**
   * Max value
   */
  max: (selector: (event: StreamEvent) => number): Aggregation<number | null> => ({
    accumulator: (acc, event) => {
      const value = selector(event);
      return acc === null ? value : Math.max(acc, value);
    },
    initialValue: null as any,
  }),

  /**
   * Collect values into array
   */
  collect: <T>(selector: (event: StreamEvent) => T): Aggregation<T[]> => ({
    accumulator: (acc, event) => [...acc, selector(event)],
    initialValue: [],
  }),

  /**
   * First event
   */
  first: (): Aggregation<StreamEvent | null> => ({
    accumulator: (acc, event) => acc ?? event,
    initialValue: null as any,
  }),

  /**
   * Last event
   */
  last: (): Aggregation<StreamEvent | null> => ({
    accumulator: (_, event) => event,
    initialValue: null as any,
  }),

  /**
   * Distinct count
   */
  distinctCount: (selector: (event: StreamEvent) => string): Aggregation<Set<string>> => ({
    accumulator: (acc, event) => acc.add(selector(event)),
    initialValue: new Set<string>(),
  }),
};

// ============================================================================
// Stream Joiner
// ============================================================================

export class StreamJoiner {
  private leftBuffer: Map<string, StreamEvent[]> = new Map();
  private rightBuffer: Map<string, StreamEvent[]> = new Map();
  private options: JoinOptions;
  private windowOperator: WindowOperator;

  constructor(options: JoinOptions) {
    this.options = options;
    this.windowOperator = new WindowOperator(options.window);
  }

  /**
   * Join left stream event
   */
  joinLeft(event: StreamEvent): JoinedEvent[] {
    return this.join(event, this.leftBuffer, this.rightBuffer, true);
  }

  /**
   * Join right stream event
   */
  joinRight(event: StreamEvent): JoinedEvent[] {
    return this.join(event, this.rightBuffer, this.leftBuffer, false);
  }

  /**
   * Perform join
   */
  private join(
    event: StreamEvent,
    thisBuffer: Map<string, StreamEvent[]>,
    otherBuffer: Map<string, StreamEvent[]>,
    isLeft: boolean
  ): JoinedEvent[] {
    const key = this.options.keySelector(event);
    const results: JoinedEvent[] = [];

    // Add to buffer
    if (!thisBuffer.has(key)) {
      thisBuffer.set(key, []);
    }
    thisBuffer.get(key)!.push(event);

    // Find matching events in other buffer
    const otherEvents = otherBuffer.get(key) ?? [];

    switch (this.options.type) {
      case 'inner':
        // Only emit if both sides have events
        if (isLeft) {
          for (const rightEvent of otherEvents) {
            results.push({ left: event, right: rightEvent });
          }
        }
        break;

      case 'left':
        // Emit all left events with matching right events
        if (isLeft) {
          if (otherEvents.length > 0) {
            for (const rightEvent of otherEvents) {
              results.push({ left: event, right: rightEvent });
            }
          } else {
            results.push({ left: event, right: null });
          }
        }
        break;

      case 'right':
        // Emit all right events with matching left events
        if (!isLeft) {
          if (otherEvents.length > 0) {
            for (const leftEvent of otherEvents) {
              results.push({ left: leftEvent, right: event });
            }
          } else {
            results.push({ left: null, right: event });
          }
        }
        break;

      case 'outer':
        // Emit all combinations
        if (isLeft) {
          if (otherEvents.length > 0) {
            for (const rightEvent of otherEvents) {
              results.push({ left: event, right: rightEvent });
            }
          } else {
            results.push({ left: event, right: null });
          }
        }
        break;
    }

    // Clean up old events based on window
    const windowedEvents = this.windowOperator.process(event);
    for (const windowed of windowedEvents) {
      // Remove events outside window
      for (const [bufferKey, buffer] of [...thisBuffer.entries()]) {
        thisBuffer.set(
          bufferKey,
          buffer.filter(e => e.timestamp >= windowed.windowStart)
        );
      }
    }

    return results;
  }

  /**
   * Clear buffers
   */
  clear(): void {
    this.leftBuffer.clear();
    this.rightBuffer.clear();
  }
}

export interface JoinedEvent {
  left: StreamEvent | null;
  right: StreamEvent | null;
}

// ============================================================================
// Complex Event Processor (CEP)
// ============================================================================

export class ComplexEventProcessor {
  private patterns: Map<string, CEPPattern> = new Map();
  private patternStates: Map<string, PatternState[]> = new Map();
  private eventBuffer: StreamEvent[] = [];

  /**
   * Register a pattern
   */
  registerPattern(pattern: CEPPattern): void {
    this.patterns.set(pattern.id, pattern);
    this.patternStates.set(pattern.id, []);
  }

  /**
   * Unregister a pattern
   */
  unregisterPattern(patternId: string): void {
    this.patterns.delete(patternId);
    this.patternStates.delete(patternId);
  }

  /**
   * Process event through all patterns
   */
  async process(event: StreamEvent): Promise<PatternMatch[]> {
    const matches: PatternMatch[] = [];

    // Add to buffer
    this.eventBuffer.push(event);

    // Process each pattern
    for (const [patternId, pattern] of this.patterns) {
      const patternMatches = await this.processPattern(event, pattern);
      matches.push(...patternMatches);
    }

    // Clean up old events from buffer
    this.cleanupEventBuffer();

    return matches;
  }

  /**
   * Process event through a single pattern
   */
  private async processPattern(event: StreamEvent, pattern: CEPPattern): Promise<PatternMatch[]> {
    const matches: PatternMatch[] = [];
    const states = this.patternStates.get(pattern.id) ?? [];

    // Update existing states
    for (const state of states) {
      if (this.tryAdvanceState(state, event, pattern.pattern)) {
        // Pattern matched!
        if (this.isPatternComplete(state, pattern.pattern)) {
          const match: PatternMatch = {
            patternId: pattern.id,
            events: state.matchedEvents,
            timestamp: Date.now(),
            confidence: this.calculateConfidence(state, pattern),
          };

          matches.push(match);

          // Execute actions
          for (const action of pattern.actions) {
            await action.handler(state.matchedEvents);
          }

          // Reset state
          this.resetState(state);
        }
      }
    }

    // Try to start new pattern matches
    if (this.matchesExpression(event, pattern.pattern)) {
      states.push({
        currentPosition: 0,
        matchedEvents: [event],
        startTime: event.timestamp,
      });
    }

    // Clean up expired states
    this.cleanupStates(states, pattern);

    this.patternStates.set(pattern.id, states);

    return matches;
  }

  /**
   * Try to advance pattern state
   */
  private tryAdvanceState(state: PatternState, event: StreamEvent, pattern: PatternExpression): boolean {
    // Check if event matches current position in pattern
    const currentExpression = this.getExpressionAtPosition(pattern, state.currentPosition);
    if (!currentExpression) return false;

    if (this.matchesExpression(event, currentExpression)) {
      state.currentPosition++;
      state.matchedEvents.push(event);
      return true;
    }

    return false;
  }

  /**
   * Check if event matches expression
   */
  private matchesExpression(event: StreamEvent, expression: PatternExpression): boolean {
    if (expression.filter && !expression.filter(event)) {
      return false;
    }
    return true;
  }

  /**
   * Get expression at position
   */
  private getExpressionAtPosition(pattern: PatternExpression, position: number): PatternExpression | null {
    if (!pattern.children || pattern.children.length === 0) {
      return position === 0 ? pattern : null;
    }

    if (position >= pattern.children.length) {
      return null;
    }

    return pattern.children[position];
  }

  /**
   * Check if pattern is complete
   */
  private isPatternComplete(state: PatternState, pattern: PatternExpression): boolean {
    const totalSteps = this.countPatternSteps(pattern);
    return state.currentPosition >= totalSteps;
  }

  /**
   * Count total steps in pattern
   */
  private countPatternSteps(pattern: PatternExpression): number {
    if (!pattern.children || pattern.children.length === 0) {
      return 1;
    }

    let count = 0;
    for (const child of pattern.children) {
      if (child.times) {
        count += child.times.max ?? child.times.min ?? 1;
      } else {
        count += this.countPatternSteps(child);
      }
    }

    return count;
  }

  /**
   * Calculate confidence of pattern match
   */
  private calculateConfidence(state: PatternState, pattern: CEPPattern): number {
    // Simple confidence based on event count
    const expectedEvents = this.countPatternSteps(pattern.pattern);
    const actualEvents = state.matchedEvents.length;

    if (expectedEvents === 0) return 1;

    return Math.min(1, actualEvents / expectedEvents);
  }

  /**
   * Reset pattern state
   */
  private resetState(state: PatternState): void {
    state.currentPosition = 0;
    state.matchedEvents = [];
    state.startTime = Date.now();
  }

  /**
   * Clean up expired pattern states
   */
  private cleanupStates(states: PatternState[], pattern: CEPPattern): void {
    if (!pattern.within) return;

    const now = Date.now();
    const cutoff = now - pattern.within;

    for (let i = states.length - 1; i >= 0; i--) {
      if (states[i].startTime < cutoff) {
        states.splice(i, 1);
      }
    }
  }

  /**
   * Clean up old events from buffer
   */
  private cleanupEventBuffer(): void {
    const maxAge = Math.max(
      ...Array.from(this.patterns.values()).map(p => p.within ?? 60000)
    );

    const cutoff = Date.now() - maxAge;
    this.eventBuffer = this.eventBuffer.filter(e => e.timestamp >= cutoff);
  }
}

interface PatternState {
  currentPosition: number;
  matchedEvents: StreamEvent[];
  startTime: number;
}

// ============================================================================
// Common Patterns
// ============================================================================

export const Patterns = {
  /**
   * Create sequence pattern
   */
  sequence(...filters: Array<(event: StreamEvent) => boolean>): CEPPattern {
    return {
      id: `sequence_${Date.now()}`,
      pattern: {
        type: 'sequence',
        children: filters.map(filter => ({ type: 'and', filter })),
      },
      actions: [],
    };
  },

  /**
   * Create repetition pattern
   */
  repeat(
    filter: (event: StreamEvent) => boolean,
    times: { min: number; max?: number }
  ): CEPPattern {
    return {
      id: `repeat_${Date.now()}`,
      pattern: {
        type: 'repeat',
        filter,
        times,
      },
      actions: [],
    };
  },

  /**
   * Create conjunction pattern
   */
  and(...patterns: PatternExpression[]): CEPPattern {
    return {
      id: `and_${Date.now()}`,
      pattern: {
        type: 'and',
        children: patterns,
      },
      actions: [],
    };
  },

  /**
   * Create disjunction pattern
   */
  or(...patterns: PatternExpression[]): CEPPattern {
    return {
      id: `or_${Date.now()}`,
      pattern: {
        type: 'or',
        children: patterns,
      },
      actions: [],
    };
  },
};
