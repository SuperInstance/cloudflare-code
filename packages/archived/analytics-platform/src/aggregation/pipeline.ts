/**
 * Aggregation Pipeline
 * Multi-stage data processing pipeline for complex aggregations
 */

import type { AnalyticsEvent, AggregationResult } from '../types/index.js';
import { AggregationEngine } from './engine.js';

export interface PipelineConfig {
  stages: PipelineStage[];
  parallelism?: number;
  bufferSize?: number;
  errorHandling?: 'fail' | 'skip' | 'continue';
}

export interface PipelineStage {
  id: string;
  name: string;
  type: StageType;
  config: any;
  dependencies?: string[];
}

export type StageType =
  | 'filter'
  | 'transform'
  | 'aggregate'
  | 'join'
  | 'window'
  | 'group'
  | 'calculate';

export interface PipelineResult {
  stageResults: Map<string, any>;
  finalResults: AggregationResult[];
  metrics: PipelineMetrics;
  errors: PipelineError[];
}

export interface PipelineMetrics {
  totalTime: number;
  stageTimes: Record<string, number>;
  eventsProcessed: number;
  eventsFiltered: number;
  throughput: number;
}

export interface PipelineError {
  stage: string;
  error: string;
  timestamp: number;
}

/**
 * Aggregation Pipeline
 */
export class AggregationPipeline {
  private config: PipelineConfig;
  private engine: AggregationEngine;
  private stages: Map<string, PipelineStage> = new Map();
  private stageResults: Map<string, any> = new Map();

  constructor(config: PipelineConfig, engine?: AggregationEngine) {
    this.config = {
      parallelism: 4,
      bufferSize: 10000,
      errorHandling: 'continue',
      ...config,
    };

    this.engine = engine || new AggregationEngine();
    this.initializeStages();
  }

  /**
   * Execute pipeline on events
   */
  async execute(events: AnalyticsEvent[]): Promise<PipelineResult> {
    const startTime = Date.now();
    const errors: PipelineError[] = [];
    const stageTimes: Record<string, number> = {};
    let currentEvents = [...events];
    let eventsProcessed = 0;
    let eventsFiltered = 0;

    // Sort stages by dependencies
    const sortedStages = this.topologicalSort();

    // Execute stages in order
    for (const stage of sortedStages) {
      const stageStart = Date.now();

      try {
        console.log(`Executing stage: ${stage.name}`);

        // Check dependencies
        if (!this.checkDependencies(stage, this.stageResults)) {
          throw new Error(`Dependencies not met for stage ${stage.id}`);
        }

        // Execute stage
        const result = await this.executeStage(stage, currentEvents, this.stageResults);

        // Store result
        this.stageResults.set(stage.id, result);

        // Update current events for next stage
        if (result.events) {
          currentEvents = result.events;
          eventsProcessed = result.events.length;
          eventsFiltered = events.length - eventsProcessed;
        }

        stageTimes[stage.id] = Date.now() - stageStart;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          stage: stage.id,
          error: errorMessage,
          timestamp: Date.now(),
        });

        if (this.config.errorHandling === 'fail') {
          throw error;
        }
      }
    }

    const totalTime = Date.now() - startTime;

    // Extract final results
    const finalResults = this.extractFinalResults();

    return {
      stageResults: this.stageResults,
      finalResults,
      metrics: {
        totalTime,
        stageTimes,
        eventsProcessed,
        eventsFiltered,
        throughput: eventsProcessed / (totalTime / 1000),
      },
      errors,
    };
  }

  /**
   * Execute single stage
   */
  private async executeStage(
    stage: PipelineStage,
    events: AnalyticsEvent[],
    context: Map<string, any>
  ): Promise<any> {
    switch (stage.type) {
      case 'filter':
        return this.executeFilterStage(stage, events);
      case 'transform':
        return this.executeTransformStage(stage, events);
      case 'aggregate':
        return this.executeAggregateStage(stage, events);
      case 'join':
        return this.executeJoinStage(stage, events, context);
      case 'window':
        return this.executeWindowStage(stage, events);
      case 'group':
        return this.executeGroupStage(stage, events);
      case 'calculate':
        return this.executeCalculateStage(stage, events, context);
      default:
        throw new Error(`Unknown stage type: ${stage.type}`);
    }
  }

  /**
   * Execute filter stage
   */
  private async executeFilterStage(
    stage: PipelineStage,
    events: AnalyticsEvent[]
  ): Promise<{ events: AnalyticsEvent[] }> {
    const { conditions } = stage.config;

    const filtered = events.filter((event) => {
      return this.matchesConditions(event, conditions);
    });

    return { events: filtered };
  }

  /**
   * Execute transform stage
   */
  private async executeTransformStage(
    stage: PipelineStage,
    events: AnalyticsEvent[]
  ): Promise<{ events: AnalyticsEvent[] }> {
    const { transformations } = stage.config;

    const transformed = events.map((event) => {
      return this.applyTransformations(event, transformations);
    });

    return { events: transformed };
  }

  /**
   * Execute aggregate stage
   */
  private async executeAggregateStage(
    stage: PipelineStage,
    events: AnalyticsEvent[]
  ): Promise<{ results: AggregationResult[] }> {
    const results = await this.engine.aggregate(events, stage.config);
    return { results };
  }

  /**
   * Execute join stage
   */
  private async executeJoinStage(
    stage: PipelineStage,
    events: AnalyticsEvent[],
    context: Map<string, any>
  ): Promise<{ events: AnalyticsEvent[] }> {
    const { sourceStage, joinKey, how = 'inner' } = stage.config;

    const sourceData = context.get(sourceStage);
    if (!sourceData) {
      throw new Error(`Source stage ${sourceStage} not found`);
    }

    const joined = this.joinData(events, sourceData.results || sourceData.events, joinKey, how);

    return { events: joined };
  }

  /**
   * Execute window stage
   */
  private async executeWindowStage(
    stage: PipelineStage,
    events: AnalyticsEvent[]
  ): Promise<{ windows: Map<string, AnalyticsEvent[]> }> {
    const { windowSize, slideSize, keyField } = stage.config;

    const windows = this.createWindows(events, windowSize, slideSize, keyField);

    return { windows };
  }

  /**
   * Execute group stage
   */
  private async executeGroupStage(
    stage: PipelineStage,
    events: AnalyticsEvent[]
  ): Promise<{ groups: Map<string, AnalyticsEvent[]> }> {
    const { keyFields } = stage.config;

    const groups = this.groupEvents(events, keyFields);

    return { groups };
  }

  /**
   * Execute calculate stage
   */
  private async executeCalculateStage(
    stage: PipelineStage,
    events: AnalyticsEvent[],
    context: Map<string, any>
  ): Promise<{ calculations: Record<string, number> }> {
    const { calculations } = stage.config;

    const results: Record<string, number> = {};

    for (const calculation of calculations) {
      results[calculation.name] = await this.performCalculation(
        events,
        calculation,
        context
      );
    }

    return { calculations: results };
  }

  /**
   * Check if event matches conditions
   */
  private matchesConditions(event: AnalyticsEvent, conditions: any): boolean {
    if (Array.isArray(conditions)) {
      return conditions.every((condition) => this.matchesCondition(event, condition));
    }
    return this.matchesCondition(event, conditions);
  }

  /**
   * Check if event matches condition
   */
  private matchesCondition(event: AnalyticsEvent, condition: any): boolean {
    const { field, operator, value } = condition;
    const eventValue = this.getFieldValue(event, field);

    switch (operator) {
      case 'eq':
        return eventValue === value;
      case 'neq':
        return eventValue !== value;
      case 'gt':
        return typeof eventValue === 'number' && eventValue > value;
      case 'lt':
        return typeof eventValue === 'number' && eventValue < value;
      case 'gte':
        return typeof eventValue === 'number' && eventValue >= value;
      case 'lte':
        return typeof eventValue === 'number' && eventValue <= value;
      case 'in':
        return Array.isArray(value) && value.includes(eventValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(eventValue);
      case 'contains':
        return typeof eventValue === 'string' && eventValue.includes(value);
      case 'exists':
        return eventValue !== undefined && eventValue !== null;
      default:
        return true;
    }
  }

  /**
   * Get field value from event
   */
  private getFieldValue(event: AnalyticsEvent, field: string): any {
    const parts = field.split('.');
    let value: any = event;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Apply transformations to event
   */
  private applyTransformations(event: AnalyticsEvent, transformations: any[]): AnalyticsEvent {
    let transformed = { ...event };

    for (const transform of transformations) {
      transformed = this.applyTransformation(transformed, transform);
    }

    return transformed;
  }

  /**
   * Apply single transformation
   */
  private applyTransformation(event: AnalyticsEvent, transform: any): AnalyticsEvent {
    const { type, field, value, formula } = transform;

    switch (type) {
      case 'add':
        return this.addField(event, field, value);
      case 'remove':
        return this.removeField(event, field);
      case 'rename':
        return this.renameField(event, field, value);
      case 'calculate':
        return this.calculateField(event, field, formula);
      default:
        return event;
    }
  }

  /**
   * Add field to event
   */
  private addField(event: AnalyticsEvent, field: string, value: any): AnalyticsEvent {
    const newEvent = JSON.parse(JSON.stringify(event));
    this.setNestedValue(newEvent, field.split('.'), value);
    return newEvent;
  }

  /**
   * Remove field from event
   */
  private removeField(event: AnalyticsEvent, field: string): AnalyticsEvent {
    const newEvent = JSON.parse(JSON.stringify(event));
    this.deleteNestedValue(newEvent, field.split('.'));
    return newEvent;
  }

  /**
   * Rename field in event
   */
  private renameField(event: AnalyticsEvent, oldField: string, newField: string): AnalyticsEvent {
    const value = this.getFieldValue(event, oldField);
    const newEvent = this.removeField(event, oldField);
    return this.addField(newEvent, newField, value);
  }

  /**
   * Calculate field value
   */
  private calculateField(event: AnalyticsEvent, field: string, formula: string): AnalyticsEvent {
    const context = { event, math: Math };
    const value = eval(formula); // eslint-disable-line no-eval
    return this.addField(event, field, value);
  }

  /**
   * Set nested value
   */
  private setNestedValue(obj: any, parts: string[], value: any): void {
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }

  /**
   * Delete nested value
   */
  private deleteNestedValue(obj: any, parts: string[]): void {
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        return;
      }
      current = current[parts[i]];
    }
    delete current[parts[parts.length - 1]];
  }

  /**
   * Join two datasets
   */
  private joinData(
    left: AnalyticsEvent[],
    right: any[],
    key: string,
    how: 'inner' | 'left' | 'right' | 'outer'
  ): AnalyticsEvent[] {
    const rightMap = new Map();

    for (const item of right) {
      const keyValue = this.getItemValue(item, key);
      if (!rightMap.has(keyValue)) {
        rightMap.set(keyValue, []);
      }
      rightMap.get(keyValue).push(item);
    }

    const joined: AnalyticsEvent[] = [];

    for (const leftItem of left) {
      const keyValue = this.getFieldValue(leftItem, key);
      const rightItems = rightMap.get(keyValue) || [];

      if (rightItems.length > 0 || (how === 'left' || how === 'outer')) {
        for (const rightItem of rightItems.length > 0 ? rightItems : [{}]) {
          joined.push({
            ...leftItem,
            _joined: rightItem,
          });
        }
      }
    }

    return joined;
  }

  /**
   * Get value from item
   */
  private getItemValue(item: any, key: string): any {
    const parts = key.split('.');
    let value: any = item;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Create time windows
   */
  private createWindows(
    events: AnalyticsEvent[],
    windowSize: number,
    slideSize: number,
    keyField?: string
  ): Map<string, AnalyticsEvent[]> {
    const windows = new Map<string, AnalyticsEvent[]>();

    if (events.length === 0) {
      return windows;
    }

    const startTime = events[0].timestamp;
    const endTime = events[events.length - 1].timestamp;

    for (let windowStart = startTime; windowStart <= endTime; windowStart += slideSize) {
      const windowEnd = windowStart + windowSize;
      const windowEvents = events.filter(
        (e) => e.timestamp >= windowStart && e.timestamp < windowEnd
      );

      if (windowEvents.length > 0) {
        const key = keyField
          ? `${keyField}_${windowStart}_${windowEnd}`
          : `${windowStart}_${windowEnd}`;
        windows.set(key, windowEvents);
      }
    }

    return windows;
  }

  /**
   * Group events by key fields
   */
  private groupEvents(events: AnalyticsEvent[], keyFields: string[]): Map<string, AnalyticsEvent[]> {
    const groups = new Map<string, AnalyticsEvent[]>();

    for (const event of events) {
      const key = this.getGroupKey(event, keyFields);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    }

    return groups;
  }

  /**
   * Get group key for event
   */
  private getGroupKey(event: AnalyticsEvent, keyFields: string[]): string {
    return keyFields
      .map((field) => {
        const value = this.getFieldValue(event, field);
        return `${field}=${value}`;
      })
      .join('|');
  }

  /**
   * Perform calculation
   */
  private async performCalculation(
    events: AnalyticsEvent[],
    calculation: any,
    context: Map<string, any>
  ): Promise<number> {
    const { type, field, formula } = calculation;

    switch (type) {
      case 'count':
        return events.length;
      case 'sum':
        return events.reduce((sum, e) => sum + (this.getFieldValue(e, field) || 0), 0);
      case 'avg':
        return (
          events.reduce((sum, e) => sum + (this.getFieldValue(e, field) || 0), 0) / events.length
        );
      case 'min':
        return Math.min(...events.map((e) => this.getFieldValue(e, field) || 0));
      case 'max':
        return Math.max(...events.map((e) => this.getFieldValue(e, field) || 0));
      case 'custom':
        return this.evaluateFormula(formula, { events, context });
      default:
        return 0;
    }
  }

  /**
   * Evaluate formula
   */
  private evaluateFormula(formula: string, context: any): number {
    return eval(formula); // eslint-disable-line no-eval
  }

  /**
   * Initialize stages
   */
  private initializeStages(): void {
    for (const stage of this.config.stages) {
      this.stages.set(stage.id, stage);
    }
  }

  /**
   * Topological sort of stages
   */
  private topologicalSort(): PipelineStage[] {
    const sorted: PipelineStage[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (stageId: string): void => {
      if (visited.has(stageId)) {
        return;
      }

      if (visiting.has(stageId)) {
        throw new Error(`Cycle detected in stage dependencies involving ${stageId}`);
      }

      visiting.add(stageId);

      const stage = this.stages.get(stageId);
      if (stage?.dependencies) {
        for (const dep of stage.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(stageId);
      visited.add(stageId);

      if (stage) {
        sorted.push(stage);
      }
    };

    for (const stageId of this.stages.keys()) {
      visit(stageId);
    }

    return sorted;
  }

  /**
   * Check if stage dependencies are met
   */
  private checkDependencies(stage: PipelineStage, results: Map<string, any>): boolean {
    if (!stage.dependencies || stage.dependencies.length === 0) {
      return true;
    }

    return stage.dependencies.every((dep) => results.has(dep));
  }

  /**
   * Extract final results
   */
  private extractFinalResults(): AggregationResult[] {
    // Find the last aggregate stage and return its results
    const aggregateStages = Array.from(this.stages.values())
      .filter((s) => s.type === 'aggregate')
      .sort((a, b) => {
        // Simple sort - in production, use proper dependency ordering
        return a.id.localeCompare(b.id);
      });

    if (aggregateStages.length > 0) {
      const lastStage = aggregateStages[aggregateStages.length - 1];
      const result = this.stageResults.get(lastStage.id);
      return result?.results || [];
    }

    return [];
  }
}

/**
 * Stream Processor for real-time event processing
 */
export class StreamProcessor {
  private pipeline: AggregationPipeline;
  private buffer: AnalyticsEvent[] = [];
  private batchSize: number;
  private flushInterval: number;
  private flushTimer: number | null = null;

  constructor(pipeline: AggregationPipeline, batchSize = 100, flushInterval = 5000) {
    this.pipeline = pipeline;
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.startFlushTimer();
  }

  /**
   * Process event stream
   */
  async process(event: AnalyticsEvent): Promise<void> {
    this.buffer.push(event);

    if (this.buffer.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * Flush buffer
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const events = [...this.buffer];
    this.buffer = [];

    await this.pipeline.execute(events);
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = window.setInterval(() => {
      this.flush().catch((error) => {
        console.error('Stream processor flush error:', error);
      });
    }, this.flushInterval);
  }

  /**
   * Stop stream processor
   */
  async stop(): Promise<void> {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}
