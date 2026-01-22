/**
 * Event Aggregator - Advanced event aggregation system
 *
 * Provides event aggregation with time windows, count windows,
 * session windows, aggregation functions, and grouping operations
 */

// @ts-nocheck - Type issues with undefined arguments
import type { EventEnvelope } from '../types';

// ============================================================================
// Aggregation Types
// ============================================================================

export interface AggregationDefinition {
  aggregationId: string;
  name: string;
  description?: string;
  source: EventSource;
  window: WindowDefinition;
  aggregations: AggregationFunction[];
  grouping?: GroupingConfig;
  output: OutputConfig;
  enabled: boolean;
}

export interface EventSource {
  type: 'stream' | 'topic' | 'filter';
  source: string;
  filter?: AggregationFilter;
}

export interface AggregationFilter {
  eventType?: string | string[];
  condition?: (event: EventEnvelope) => boolean | Promise<boolean>;
}

export type WindowDefinition =
  | TimeWindow
  | CountWindow
  | SessionWindow
  | SlidingWindow
  | GlobalWindow;

export interface TimeWindow {
  type: 'time';
  durationMs: number;
  slideMs?: number; // For sliding windows
  graceMs?: number; // Late event handling
}

export interface CountWindow {
  type: 'count';
  size: number;
  slide?: number; // For sliding count windows
}

export interface SessionWindow {
  type: 'session';
  timeoutMs: number;
  maxSessionDurationMs?: number;
  gapThresholdMs: number;
}

export interface SlidingWindow {
  type: 'sliding';
  windowSizeMs: number;
  slideMs: number;
}

export interface GlobalWindow {
  type: 'global';
}

export interface GroupingConfig {
  type: 'field' | 'key' | 'custom';
  field?: string;
  keyFn?: (event: EventEnvelope) => string;
}

export type AggregationFunction =
  | CountAggregation
  | SumAggregation
  | AvgAggregation
  | MinAggregation
  | MaxAggregation
  | FirstAggregation
  | LastAggregation
  | ListAggregation
  | SetAggregation
  | HistogramAggregation
  | PercentileAggregation
  | CustomAggregation;

export interface BaseAggregation {
  name: string;
  field: string;
  outputField: string;
}

export interface CountAggregation extends BaseAggregation {
  type: 'count';
}

export interface SumAggregation extends BaseAggregation {
  type: 'sum';
}

export interface AvgAggregation extends BaseAggregation {
  type: 'avg';
}

export interface MinAggregation extends BaseAggregation {
  type: 'min';
}

export interface MaxAggregation extends BaseAggregation {
  type: 'max';
}

export interface FirstAggregation extends BaseAggregation {
  type: 'first';
}

export interface LastAggregation extends BaseAggregation {
  type: 'last';
}

export interface ListAggregation extends BaseAggregation {
  type: 'list';
  maxSize?: number;
}

export interface SetAggregation extends BaseAggregation {
  type: 'set';
  maxSize?: number;
}

export interface HistogramAggregation extends BaseAggregation {
  type: 'histogram';
  buckets: number[];
  bucketField?: string;
}

export interface PercentileAggregation extends BaseAggregation {
  type: 'percentile';
  percentiles: number[];
}

export interface CustomAggregation extends BaseAggregation {
  type: 'custom';
  fn: (events: EventEnvelope[]) => unknown;
  stateFn?: (currentState: unknown, event: EventEnvelope) => unknown;
}

export interface OutputConfig {
  type: 'stream' | 'callback' | 'topic' | 'storage';
  destination?: string;
  callback?: (result: AggregationResult) => void | Promise<void>;
  includeMetadata?: boolean;
  includeEvents?: boolean;
}

export interface AggregationResult {
  aggregationId: string;
  windowStart: number;
  windowEnd: number;
  groupKey?: string;
  results: Record<string, unknown>;
  eventCount: number;
  metadata?: {
    firstEventId?: string;
    lastEventId?: string;
    processingTimeMs?: number;
  };
}

export interface WindowState {
  windowId: string;
  start: number;
  end?: number;
  events: EventEnvelope[];
  groupKey?: string;
  metadata: Record<string, unknown>;
}

export interface AggregationStats {
  totalEventsProcessed: number;
  totalWindowsCreated: number;
  totalWindowsCompleted: number;
  totalOutputResults: number;
  averageProcessingTimeMs: number;
  activeWindowCount: number;
  lateEventCount: number;
}

// ============================================================================
// Window Manager
// ============================================================================

export class WindowManager {
  private windows: Map<string, WindowState>;
  private windowCounter: number;

  constructor() {
    this.windows = new Map();
    this.windowCounter = 0;
  }

  createWindow(start: number, end: number, groupKey?: string): WindowState {
    const windowId = this.generateWindowId();
    const window: WindowState = {
      windowId,
      start,
      end,
      events: [],
      groupKey,
      metadata: {},
    };

    this.windows.set(windowId, window);
    this.windowCounter++;

    return window;
  }

  getWindow(windowId: string): WindowState | undefined {
    return this.windows.get(windowId);
  }

  addEventToWindow(windowId: string, event: EventEnvelope): void {
    const window = this.windows.get(windowId);
    if (window) {
      window.events.push(event);
    }
  }

  removeWindow(windowId: string): void {
    this.windows.delete(windowId);
  }

  getWindows(): WindowState[] {
    return Array.from(this.windows.values());
  }

  getActiveWindowsCount(): number {
    return this.windows.size;
  }

  clear(): void {
    this.windows.clear();
  }

  private generateWindowId(): string {
    return `window_${Date.now()}_${this.windowCounter}`;
  }
}

// ============================================================================
// Event Aggregator
// ============================================================================

export class EventAggregator {
  private aggregations: Map<string, AggregationDefinition>;
  private windowManagers: Map<string, WindowManager>;
  private stats: AggregationStats;
  private timers: Map<string, NodeJS.Timeout>;

  constructor() {
    this.aggregations = new Map();
    this.windowManagers = new Map();
    this.stats = {
      totalEventsProcessed: 0,
      totalWindowsCreated: 0,
      totalWindowsCompleted: 0,
      totalOutputResults: 0,
      averageProcessingTimeMs: 0,
      activeWindowCount: 0,
      lateEventCount: 0,
    };
    this.timers = new Map();
  }

  // ========================================================================
  // Aggregation Management
  // ========================================================================

  addAggregation(
    aggregation: Omit<AggregationDefinition, 'aggregationId'>
  ): string {
    const aggregationId = this.generateAggregationId();
    const newAggregation: AggregationDefinition = {
      ...aggregation,
      aggregationId,
    };

    this.aggregations.set(aggregationId, newAggregation);
    this.windowManagers.set(aggregationId, new WindowManager());

    // Start time-based window timers
    if (this.isTimeBasedWindow(newAggregation.window)) {
      this.startTimeBasedProcessing(aggregationId);
    }

    return aggregationId;
  }

  removeAggregation(aggregationId: string): boolean {
    // Stop timers
    const timer = this.timers.get(aggregationId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(aggregationId);
    }

    const deleted = this.aggregations.delete(aggregationId);
    this.windowManagers.delete(aggregationId);

    return deleted;
  }

  getAggregation(aggregationId: string): AggregationDefinition | null {
    return this.aggregations.get(aggregationId) || null;
  }

  listAggregations(): AggregationDefinition[] {
    return Array.from(this.aggregations.values());
  }

  // ========================================================================
  // Event Processing
  // ========================================================================

  async processEvent(event: EventEnvelope): Promise<void> {
    for (const [aggregationId, aggregation] of this.aggregations) {
      if (!aggregation.enabled) {
        continue;
      }

      // Check if event matches source filter
      if (!this.matchesSource(event, aggregation.source)) {
        continue;
      }

      // Get group key
      const groupKey = this.getGroupKey(event, aggregation.grouping);

      // Get window manager
      const windowManager = this.windowManagers.get(aggregationId);
      if (!windowManager) {
        continue;
      }

      // Process based on window type
      await this.processEventForWindow(
        aggregationId,
        aggregation,
        event,
        groupKey,
        windowManager
      );

      this.stats.totalEventsProcessed++;
    }
  }

  async processEventBatch(events: EventEnvelope[]): Promise<void> {
    for (const event of events) {
      await this.processEvent(event);
    }
  }

  // ========================================================================
  // Window Processing
  // ========================================================================

  private async processEventForWindow(
    aggregationId: string,
    aggregation: AggregationDefinition,
    event: EventEnvelope,
    groupKey: string | undefined,
    windowManager: WindowManager
  ): Promise<void> {
    const eventTime = event.metadata.timestamp;
    const now = Date.now();

    switch (aggregation.window.type) {
      case 'time': {
        const timeWindow = aggregation.window as TimeWindow;
        const windowStart =
          Math.floor(eventTime / timeWindow.durationMs) * timeWindow.durationMs;
        const windowEnd = windowStart + timeWindow.durationMs;

        // Check if window exists
        let window = this.findWindow(windowManager, windowStart, windowEnd, groupKey);

        if (!window) {
          // Create new window
          window = windowManager.createWindow(windowStart, windowEnd, groupKey);
          this.stats.totalWindowsCreated++;
        }

        // Check grace period
        if (now > windowEnd + (timeWindow.graceMs ?? 0)) {
          this.stats.lateEventCount++;
          // Handle late event - either add to window or drop
          if (now <= windowEnd + (timeWindow.graceMs ?? 0) * 2) {
            windowManager.addEventToWindow(window.windowId, event);
          }
          return;
        }

        windowManager.addEventToWindow(window.windowId, event);

        // Check if window is complete
        if (now >= windowEnd) {
          await this.completeWindow(aggregationId, window);
        }

        break;
      }

      case 'count': {
        const countWindow = aggregation.window as CountWindow;
        const slideSize = countWindow.slide ?? countWindow.size;

        // Find or create window
        let windows = this.findActiveWindows(windowManager, groupKey);

        // If no windows or all windows are full, create new one
        if (windows.length === 0 || windows.every((w) => w.events.length >= countWindow.size)) {
          const newWindow = windowManager.createWindow(now, undefined, groupKey);
          this.stats.totalWindowsCreated++;
          windows = [newWindow];
        }

        // Add event to first window with space
        for (const window of windows) {
          if (window.events.length < countWindow.size) {
            windowManager.addEventToWindow(window.windowId, event);

            // Check if window is complete
            if (window.events.length >= countWindow.size) {
              await this.completeWindow(aggregationId, window);
            }
            break;
          }
        }

        break;
      }

      case 'session': {
        const sessionWindow = aggregation.window as SessionWindow;

        // Find active session for this group
        let activeSession = this.findActiveSession(windowManager, groupKey, now);

        if (!activeSession) {
          // Create new session
          activeSession = windowManager.createWindow(now, undefined, groupKey);
          this.stats.totalWindowsCreated++;
        }

        // Update session end time
        activeSession.end = now + sessionWindow.timeoutMs;
        windowManager.addEventToWindow(activeSession.windowId, event);

        // Check if session should be closed due to max duration
        if (
          sessionWindow.maxSessionDurationMs &&
          now - activeSession.start >= sessionWindow.maxSessionDurationMs
        ) {
          await this.completeWindow(aggregationId, activeSession);
        }

        break;
      }

      case 'sliding': {
        const slidingWindow = aggregation.window as SlidingWindow;

        // Calculate which windows this event belongs to
        const windowStartTime =
          Math.floor(eventTime / slidingWindow.slideMs) * slidingWindow.slideMs;

        // Create or update windows
        for (let offset = 0; offset < slidingWindow.windowSizeMs; offset += slidingWindow.slideMs) {
          const windowStart = windowStartTime - offset;
          const windowEnd = windowStart + slidingWindow.windowSizeMs;

          let window = this.findWindow(windowManager, windowStart, windowEnd, groupKey);

          if (!window) {
            window = windowManager.createWindow(windowStart, windowEnd, groupKey);
            this.stats.totalWindowsCreated++;
          }

          windowManager.addEventToWindow(window.windowId, event);
        }

        break;
      }

      case 'global': {
        // Global window - all events go into same window
        let window = this.findWindow(windowManager, 0, undefined, groupKey);

        if (!window) {
          window = windowManager.createWindow(0, undefined, groupKey);
          this.stats.totalWindowsCreated++;
        }

        windowManager.addEventToWindow(window.windowId, event);
        break;
      }
    }
  }

  // ========================================================================
  // Window Completion
  // ========================================================================

  private async completeWindow(
    aggregationId: string,
    window: WindowState
  ): Promise<void> {
    const aggregation = this.aggregations.get(aggregationId);
    if (!aggregation) {
      return;
    }

    const windowManager = this.windowManagers.get(aggregationId);
    if (!windowManager) {
      return;
    }

    const startTime = performance.now();

    // Compute aggregations
    const results = await this.computeAggregations(
      aggregation.aggregations,
      window.events
    );

    // Create result
    const result: AggregationResult = {
      aggregationId,
      windowStart: window.start,
      windowEnd: window.end ?? Date.now(),
      groupKey: window.groupKey,
      results,
      eventCount: window.events.length,
      metadata: {
        firstEventId: window.events[0]?.metadata.eventId,
        lastEventId: window.events[window.events.length - 1]?.metadata.eventId,
        processingTimeMs: performance.now() - startTime,
      },
    };

    // Output result
    await this.outputResult(aggregation.output, result);

    // Remove window
    windowManager.removeWindow(window.windowId);

    // Update stats
    this.stats.totalWindowsCompleted++;
    this.stats.totalOutputResults++;
    this.stats.activeWindowCount = windowManager.getActiveWindowsCount();
  }

  private async computeAggregations(
    aggregations: AggregationFunction[],
    events: EventEnvelope[]
  ): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};

    for (const aggregation of aggregations) {
      const value = await this.computeAggregation(aggregation, events);
      results[aggregation.outputField] = value;
    }

    return results;
  }

  private async computeAggregation(
    aggregation: AggregationFunction,
    events: EventEnvelope[]
  ): Promise<unknown> {
    switch (aggregation.type) {
      case 'count':
        return this.computeCount(events, aggregation.field);

      case 'sum':
        return this.computeSum(events, aggregation.field);

      case 'avg':
        return this.computeAvg(events, aggregation.field);

      case 'min':
        return this.computeMin(events, aggregation.field);

      case 'max':
        return this.computeMax(events, aggregation.field);

      case 'first':
        return this.computeFirst(events, aggregation.field);

      case 'last':
        return this.computeLast(events, aggregation.field);

      case 'list':
        return this.computeList(events, aggregation.field, aggregation.maxSize);

      case 'set':
        return this.computeSet(events, aggregation.field, aggregation.maxSize);

      case 'histogram':
        return this.computeHistogram(events, aggregation.field, aggregation.buckets, aggregation.bucketField);

      case 'percentile':
        return this.computePercentile(events, aggregation.field, aggregation.percentiles);

      case 'custom':
        return aggregation.fn(events);

      default:
        return null;
    }
  }

  // ========================================================================
  // Aggregation Functions
  // ========================================================================

  private computeCount(events: EventEnvelope[], field: string): number {
    return events.filter((e) => this.getFieldValue(e, field) !== undefined).length;
  }

  private computeSum(events: EventEnvelope[], field: string): number {
    return events.reduce((sum, event) => {
      const value = this.getFieldValue(event, field);
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
  }

  private computeAvg(events: EventEnvelope[], field: string): number {
    const numericValues = events
      .map((e) => this.getFieldValue(e, field))
      .filter((v) => typeof v === 'number') as number[];

    if (numericValues.length === 0) return 0;
    return numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
  }

  private computeMin(events: EventEnvelope[], field: string): number | null {
    const numericValues = events
      .map((e) => this.getFieldValue(e, field))
      .filter((v) => typeof v === 'number') as number[];

    if (numericValues.length === 0) return null;
    return Math.min(...numericValues);
  }

  private computeMax(events: EventEnvelope[], field: string): number | null {
    const numericValues = events
      .map((e) => this.getFieldValue(e, field))
      .filter((v) => typeof v === 'number') as number[];

    if (numericValues.length === 0) return null;
    return Math.max(...numericValues);
  }

  private computeFirst(events: EventEnvelope[], field: string): unknown {
    if (events.length === 0) return null;
    return this.getFieldValue(events[0], field);
  }

  private computeLast(events: EventEnvelope[], field: string): unknown {
    if (events.length === 0) return null;
    return this.getFieldValue(events[events.length - 1], field);
  }

  private computeList(events: EventEnvelope[], field: string, maxSize?: number): unknown[] {
    const values = events.map((e) => this.getFieldValue(e, field));
    return maxSize ? values.slice(-maxSize) : values;
  }

  private computeSet(events: EventEnvelope[], field: string, maxSize?: number): unknown[] {
    const uniqueValues = new Set(
      events.map((e) => this.getFieldValue(e, field))
    );
    const array = Array.from(uniqueValues);
    return maxSize ? array.slice(0, maxSize) : array;
  }

  private computeHistogram(events: EventEnvelope[], field: string, buckets: number[], bucketField?: string): Record<string, number> {
    const histogram: Record<string, number> = {};

    // Initialize buckets
    for (let i = 0; i < buckets.length - 1; i++) {
      histogram[`[${buckets[i]},${buckets[i + 1]})`] = 0;
    }
    histogram[`[>=${buckets[buckets.length - 1]}]`] = 0;

    // Count values in each bucket
    for (const event of events) {
      const value = this.getFieldValue(event, field);
      if (typeof value !== 'number') continue;

      let bucketFound = false;
      for (let i = 0; i < buckets.length - 1; i++) {
        if (value >= buckets[i] && value < buckets[i + 1]) {
          histogram[`[${buckets[i]},${buckets[i + 1]})`]++;
          bucketFound = true;
          break;
        }
      }
      if (!bucketFound && value >= buckets[buckets.length - 1]) {
        histogram[`[>=${buckets[buckets.length - 1]}]`]++;
      }
    }

    return histogram;
  }

  private computePercentile(events: EventEnvelope[], field: string, percentiles: number[]): Record<string, number> {
    const numericValues = events
      .map((e) => this.getFieldValue(e, field))
      .filter((v) => typeof v === 'number') as number[];

    if (numericValues.length === 0) {
      return percentiles.reduce((acc, p) => {
        acc[`p${p}`] = 0;
        return acc;
      }, {} as Record<string, number>);
    }

    numericValues.sort((a, b) => a - b);

    const result: Record<string, number> = {};
    for (const percentile of percentiles) {
      const index = Math.ceil((percentile / 100) * numericValues.length) - 1;
      result[`p${percentile}`] = numericValues[Math.max(0, index)];
    }

    return result;
  }

  // ========================================================================
  // Output Handling
  // ========================================================================

  private async outputResult(output: OutputConfig, result: AggregationResult): Promise<void> {
    switch (output.type) {
      case 'callback':
        if (output.callback) {
          await output.callback(result);
        }
        break;

      case 'stream':
        // In a real implementation, would write to a stream
        break;

      case 'topic':
        // In a real implementation, would publish to a topic
        break;

      case 'storage':
        // In a real implementation, would store in database
        break;
    }
  }

  // ========================================================================
  // Time-based Processing
  // ========================================================================

  private startTimeBasedProcessing(aggregationId: string): void {
    const aggregation = this.aggregations.get(aggregationId);
    if (!aggregation || !this.isTimeBasedWindow(aggregation.window)) {
      return;
    }

    const windowManager = this.windowManagers.get(aggregationId);
    if (!windowManager) {
      return;
    }

    const checkInterval = 1000; // Check every second

    const timer = setInterval(async () => {
      const now = Date.now();
      const windows = windowManager.getWindows();

      for (const window of windows) {
        if (window.end && now >= window.end) {
          await this.completeWindow(aggregationId, window);
        }
      }
    }, checkInterval);

    this.timers.set(aggregationId, timer);
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private matchesSource(event: EventEnvelope, source: EventSource): boolean {
    if (source.type === 'filter') {
      if (source.filter?.eventType) {
        const eventTypes = Array.isArray(source.filter.eventType)
          ? source.filter.eventType
          : [source.filter.eventType];
        if (!eventTypes.includes(event.metadata.eventType)) {
          return false;
        }
      }
      if (source.filter?.condition) {
        return source.filter.condition(event);
      }
    }
    return true;
  }

  private getGroupKey(
    event: EventEnvelope,
    grouping?: GroupingConfig
  ): string | undefined {
    if (!grouping) {
      return undefined;
    }

    switch (grouping.type) {
      case 'field':
        return grouping.field ? this.getFieldValue(event, grouping.field) as string : undefined;

      case 'key':
        return grouping.keyFn ? grouping.keyFn(event) : undefined;

      default:
        return undefined;
    }
  }

  private findWindow(
    windowManager: WindowManager,
    start: number,
    end: number | undefined,
    groupKey: string | undefined
  ): WindowState | undefined {
    const windows = windowManager.getWindows();
    return windows.find(
      (w) => w.start === start && w.end === end && w.groupKey === groupKey
    );
  }

  private findActiveWindows(
    windowManager: WindowManager,
    groupKey: string | undefined
  ): WindowState[] {
    const windows = windowManager.getWindows();
    return windows.filter((w) => w.groupKey === groupKey);
  }

  private findActiveSession(
    windowManager: WindowManager,
    groupKey: string | undefined,
    now: number
  ): WindowState | undefined {
    const windows = windowManager.getWindows();
    return windows.find(
      (w) => w.groupKey === groupKey && (!w.end || w.end > now)
    );
  }

  private isTimeBasedWindow(window: WindowDefinition): boolean {
    return window.type === 'time' || window.type === 'sliding';
  }

  private getFieldValue(event: EventEnvelope, field: string): unknown {
    const parts = field.split('.');
    let current: unknown = event.payload;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private generateAggregationId(): string {
    return `agg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  getStats(): AggregationStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      totalEventsProcessed: 0,
      totalWindowsCreated: 0,
      totalWindowsCompleted: 0,
      totalOutputResults: 0,
      averageProcessingTimeMs: 0,
      activeWindowCount: 0,
      lateEventCount: 0,
    };
  }

  // Trigger manual completion for global windows or testing
  async triggerCompletion(aggregationId: string): Promise<void> {
    const windowManager = this.windowManagers.get(aggregationId);
    if (!windowManager) {
      return;
    }

    const windows = windowManager.getWindows();
    for (const window of windows) {
      await this.completeWindow(aggregationId, window);
    }
  }
}
