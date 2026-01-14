/**
 * Event Tracking System
 * Collects, validates, and processes analytics events
 */

import type {
  AnalyticsEvent,
  EventType,
  EventContext,
  EventMetadata,
} from '../types/index.js';

export interface EventTrackerConfig {
  batchSize: number;
  flushInterval: number;
  maxRetries: number;
  enableValidation: boolean;
  enableSampling: boolean;
  samplingRate: number;
}

export interface EventValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

/**
 * Event Tracker - Main event collection and validation system
 */
export class EventTracker {
  private config: EventTrackerConfig;
  private eventBuffer: AnalyticsEvent[] = [];
  private flushTimer: number | null = null;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private validators: Map<string, EventValidator[]> = new Map();

  constructor(config: Partial<EventTrackerConfig> = {}) {
    this.config = {
      batchSize: 100,
      flushInterval: 60000,
      maxRetries: 3,
      enableValidation: true,
      enableSampling: false,
      samplingRate: 1.0,
      ...config,
    };

    this.startFlushTimer();
  }

  /**
   * Track an event
   */
  async track(
    type: EventType,
    userId: string,
    properties: Record<string, any>,
    context?: Partial<EventContext>,
    metadata?: EventMetadata
  ): Promise<string> {
    const event = this.createEvent(type, userId, properties, context, metadata);

    // Validation
    if (this.config.enableValidation) {
      const validation = this.validateEvent(event);
      if (!validation.valid) {
        throw new Error(
          `Event validation failed: ${validation.errors.map((e) => e.message).join(', ')}`
        );
      }
    }

    // Sampling
    if (this.config.enableSampling && !this.shouldSample()) {
      return event.id; // Return ID but don't process
    }

    // Add to buffer
    this.eventBuffer.push(event);

    // Check if buffer is full
    if (this.eventBuffer.length >= this.config.batchSize) {
      await this.flush();
    }

    // Trigger handlers
    await this.triggerHandlers(event);

    return event.id;
  }

  /**
   * Track multiple events in batch
   */
  async trackBatch(events: {
    type: EventType;
    userId: string;
    properties: Record<string, any>;
    context?: Partial<EventContext>;
    metadata?: EventMetadata;
  }[]): Promise<string[]> {
    const eventIds: string[] = [];

    for (const eventData of events) {
      const id = await this.track(
        eventData.type,
        eventData.userId,
        eventData.properties,
        eventData.context,
        eventData.metadata
      );
      eventIds.push(id);
    }

    return eventIds;
  }

  /**
   * Track page view
   */
  async trackPageView(
    userId: string,
    url: string,
    properties: Record<string, any> = {},
    context?: Partial<EventContext>
  ): Promise<string> {
    return this.track('page_view', userId, {
      url,
      title: properties.title || '',
      referrer: properties.referrer || '',
      ...properties,
    }, context);
  }

  /**
   * Track custom event
   */
  async trackCustom(
    eventName: string,
    userId: string,
    properties: Record<string, any>,
    context?: Partial<EventContext>
  ): Promise<string> {
    return this.track('custom', userId, {
      event_name: eventName,
      ...properties,
    }, context);
  }

  /**
   * Create event object
   */
  private createEvent(
    type: EventType,
    userId: string,
    properties: Record<string, any>,
    context?: Partial<EventContext>,
    metadata?: EventMetadata
  ): AnalyticsEvent {
    return {
      id: this.generateEventId(),
      type,
      timestamp: Date.now(),
      userId,
      sessionId: this.generateSessionId(userId),
      properties,
      context: this.buildContext(context),
      metadata,
    };
  }

  /**
   * Build event context
   */
  private buildContext(partial?: Partial<EventContext>): EventContext {
    return {
      userAgent: partial?.userAgent || '',
      ipAddress: partial?.ipAddress,
      referrer: partial?.referrer,
      url: partial?.url || '',
      platform: partial?.platform || 'unknown',
      browser: partial?.browser,
      deviceType: partial?.deviceType || 'desktop',
      screenSize: partial?.screenSize,
      locale: partial?.locale,
      timezone: partial?.timezone,
    };
  }

  /**
   * Validate event
   */
  private validateEvent(event: AnalyticsEvent): EventValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields
    if (!event.id || event.id.trim() === '') {
      errors.push({
        field: 'id',
        message: 'Event ID is required',
        code: 'MISSING_ID',
      });
    }

    if (!event.type) {
      errors.push({
        field: 'type',
        message: 'Event type is required',
        code: 'MISSING_TYPE',
      });
    }

    if (!event.userId || event.userId.trim() === '') {
      errors.push({
        field: 'userId',
        message: 'User ID is required',
        code: 'MISSING_USER_ID',
      });
    }

    if (!event.timestamp || event.timestamp <= 0) {
      errors.push({
        field: 'timestamp',
        message: 'Valid timestamp is required',
        code: 'INVALID_TIMESTAMP',
      });
    }

    // Timestamp validation
    const now = Date.now();
    const maxFuture = 60000; // 1 minute in future
    const maxPast = 365 * 24 * 60 * 60 * 1000; // 1 year in past

    if (event.timestamp > now + maxFuture) {
      warnings.push({
        field: 'timestamp',
        message: 'Timestamp is too far in the future',
        code: 'FUTURE_TIMESTAMP',
      });
    }

    if (event.timestamp < now - maxPast) {
      warnings.push({
        field: 'timestamp',
        message: 'Timestamp is too far in the past',
        code: 'OLD_TIMESTAMP',
      });
    }

    // Property validation
    if (this.isPropertySizeExceeded(event.properties)) {
      warnings.push({
        field: 'properties',
        message: 'Properties size exceeds recommended limit',
        code: 'LARGE_PROPERTIES',
      });
    }

    // Custom validators
    const typeValidators = this.validators.get(event.type) || [];
    for (const validator of typeValidators) {
      const result = validator.validate(event);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if properties size is exceeded
   */
  private isPropertySizeExceeded(properties: Record<string, any>): boolean {
    const size = JSON.stringify(properties).length;
    return size > 10000; // 10KB limit
  }

  /**
   * Check if event should be sampled
   */
  private shouldSample(): boolean {
    return Math.random() < this.config.samplingRate;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate or retrieve session ID
   */
  private generateSessionId(userId: string): string {
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return `sess_${userId}_${dateStr}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add event handler
   */
  on(eventType: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Remove event handler
   */
  off(eventType: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Trigger event handlers
   */
  private async triggerHandlers(event: AnalyticsEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type) || [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error('Event handler error:', error);
      }
    }
  }

  /**
   * Add custom validator
   */
  addValidator(eventType: string, validator: EventValidator): void {
    if (!this.validators.has(eventType)) {
      this.validators.set(eventType, []);
    }
    this.validators.get(eventType)!.push(validator);
  }

  /**
   * Flush event buffer
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      await this.persistEvents(events);
    } catch (error) {
      // Re-add events to buffer on failure
      this.eventBuffer.unshift(...events);
      throw error;
    }
  }

  /**
   * Persist events to storage
   */
  private async persistEvents(events: AnalyticsEvent[]): Promise<void> {
    // This would be implemented by the storage layer
    // For now, we'll just log
    console.log(`Persisting ${events.length} events`);
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer !== null) {
      return;
    }

    this.flushTimer = window.setInterval(() => {
      this.flush().catch((error) => {
        console.error('Flush timer error:', error);
      });
    }, this.config.flushInterval);
  }

  /**
   * Stop automatic flush timer
   */
  stopFlushTimer(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.eventBuffer.length;
  }

  /**
   * Get event statistics
   */
  getStats(): EventTrackerStats {
    return {
      bufferSize: this.eventBuffer.length,
      handlerCount: Array.from(this.eventHandlers.values()).reduce(
        (sum, handlers) => sum + handlers.length,
        0
      ),
      validatorCount: Array.from(this.validators.values()).reduce(
        (sum, validators) => sum + validators.length,
        0
      ),
    };
  }

  /**
   * Clear event buffer
   */
  clearBuffer(): void {
    this.eventBuffer = [];
  }

  /**
   * Shutdown tracker
   */
  async shutdown(): Promise<void> {
    this.stopFlushTimer();
    await this.flush();
  }
}

export interface EventTrackerStats {
  bufferSize: number;
  handlerCount: number;
  validatorCount: number;
}

/**
 * Event handler function type
 */
export type EventHandler = (event: AnalyticsEvent) => void | Promise<void>;

/**
 * Event validator interface
 */
export interface EventValidator {
  validate(event: AnalyticsEvent): EventValidationResult;
}

/**
 * Schema-based event validator
 */
export class SchemaValidator implements EventValidator {
  constructor(private schema: EventSchema) {}

  validate(event: AnalyticsEvent): EventValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate properties against schema
    for (const [field, rule] of Object.entries(this.schema.properties)) {
      const value = event.properties[field];

      if (rule.required && (value === undefined || value === null)) {
        errors.push({
          field,
          message: `Required field '${field}' is missing`,
          code: 'MISSING_REQUIRED_FIELD',
        });
        continue;
      }

      if (value !== undefined && value !== null) {
        // Type validation
        if (rule.type && !this.validateType(value, rule.type)) {
          errors.push({
            field,
            message: `Field '${field}' must be of type ${rule.type}`,
            code: 'INVALID_TYPE',
          });
        }

        // Range validation
        if (rule.min !== undefined && value < rule.min) {
          errors.push({
            field,
            message: `Field '${field}' must be >= ${rule.min}`,
            code: 'VALUE_TOO_SMALL',
          });
        }

        if (rule.max !== undefined && value > rule.max) {
          errors.push({
            field,
            message: `Field '${field}' must be <= ${rule.max}`,
            code: 'VALUE_TOO_LARGE',
          });
        }

        // Enum validation
        if (rule.enum && !rule.enum.includes(value)) {
          errors.push({
            field,
            message: `Field '${field}' must be one of: ${rule.enum.join(', ')}`,
            code: 'INVALID_ENUM_VALUE',
          });
        }

        // Pattern validation
        if (rule.pattern && !new RegExp(rule.pattern).test(String(value))) {
          errors.push({
            field,
            message: `Field '${field}' does not match pattern ${rule.pattern}`,
            code: 'PATTERN_MISMATCH',
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }
}

export interface EventSchema {
  properties: Record<string, PropertyRule>;
}

export interface PropertyRule {
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  min?: number;
  max?: number;
  enum?: any[];
  pattern?: string;
  default?: any;
}

/**
 * Event filter for filtering events
 */
export class EventFilter {
  private filters: EventFilterRule[] = [];

  constructor(filters?: EventFilterRule[]) {
    if (filters) {
      this.filters = filters;
    }
  }

  /**
   * Add filter rule
   */
  addFilter(rule: EventFilterRule): void {
    this.filters.push(rule);
  }

  /**
   * Test if event matches filters
   */
  matches(event: AnalyticsEvent): boolean {
    return this.filters.every((filter) => this.testFilter(event, filter));
  }

  /**
   * Test individual filter
   */
  private testFilter(event: AnalyticsEvent, filter: EventFilterRule): boolean {
    const value = this.getFieldValue(event, filter.field);

    switch (filter.operator) {
      case 'equals':
        return value === filter.value;
      case 'not_equals':
        return value !== filter.value;
      case 'contains':
        return typeof value === 'string' && value.includes(filter.value as string);
      case 'not_contains':
        return typeof value === 'string' && !value.includes(filter.value as string);
      case 'greater_than':
        return typeof value === 'number' && value > filter.value;
      case 'less_than':
        return typeof value === 'number' && value < filter.value;
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value);
      case 'not_in':
        return Array.isArray(filter.value) && !filter.value.includes(value);
      case 'exists':
        return value !== undefined && value !== null;
      case 'not_exists':
        return value === undefined || value === null;
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
}

export interface EventFilterRule {
  field: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'greater_than'
    | 'less_than'
    | 'in'
    | 'not_in'
    | 'exists'
    | 'not_exists';
  value: any;
}

/**
 * Event transformer for transforming events
 */
export class EventTransformer {
  private transformations: TransformationRule[] = [];

  constructor(transformations?: TransformationRule[]) {
    if (transformations) {
      this.transformations = transformations;
    }
  }

  /**
   * Add transformation rule
   */
  addTransformation(rule: TransformationRule): void {
    this.transformations.push(rule);
  }

  /**
   * Transform event
   */
  transform(event: AnalyticsEvent): AnalyticsEvent {
    let transformed = { ...event };

    for (const rule of this.transformations) {
      transformed = this.applyTransformation(transformed, rule);
    }

    return transformed;
  }

  /**
   * Apply transformation rule
   */
  private applyTransformation(
    event: AnalyticsEvent,
    rule: TransformationRule
  ): AnalyticsEvent {
    switch (rule.type) {
      case 'rename':
        return this.renameField(event, rule.from as string, rule.to as string);
      case 'remove':
        return this.removeField(event, rule.field as string);
      case 'add':
        return this.addField(event, rule.field as string, rule.value);
      case 'map':
        return this.mapField(event, rule.field as string, rule.mapping as Record<string, any>);
      case 'calculate':
        return this.calculateField(event, rule.field as string, rule.formula as string);
      default:
        return event;
    }
  }

  private renameField(event: AnalyticsEvent, from: string, to: string): AnalyticsEvent {
    const parts = from.split('.');
    const value = this.getNestedValue(event, parts);
    const newEvent = JSON.parse(JSON.stringify(event));
    this.setNestedValue(newEvent, to.split('.'), value);
    this.deleteNestedValue(newEvent, parts);
    return newEvent;
  }

  private removeField(event: AnalyticsEvent, field: string): AnalyticsEvent {
    const newEvent = JSON.parse(JSON.stringify(event));
    this.deleteNestedValue(newEvent, field.split('.'));
    return newEvent;
  }

  private addField(event: AnalyticsEvent, field: string, value: any): AnalyticsEvent {
    const newEvent = JSON.parse(JSON.stringify(event));
    this.setNestedValue(newEvent, field.split('.'), value);
    return newEvent;
  }

  private mapField(
    event: AnalyticsEvent,
    field: string,
    mapping: Record<string, any>
  ): AnalyticsEvent {
    const value = this.getNestedValue(event, field.split('.'));
    const mappedValue = mapping[value] || value;
    const newEvent = JSON.parse(JSON.stringify(event));
    this.setNestedValue(newEvent, field.split('.'), mappedValue);
    return newEvent;
  }

  private calculateField(
    event: AnalyticsEvent,
    field: string,
    formula: string
  ): AnalyticsEvent {
    // Simple formula evaluation (in production, use a proper expression evaluator)
    const context = { event, math: Math };
    const value = eval(formula); // eslint-disable-line no-eval
    const newEvent = JSON.parse(JSON.stringify(event));
    this.setNestedValue(newEvent, field.split('.'), value);
    return newEvent;
  }

  private getNestedValue(obj: any, parts: string[]): any {
    let value = obj;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    return value;
  }

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
}

export interface TransformationRule {
  type: 'rename' | 'remove' | 'add' | 'map' | 'calculate';
  field?: string;
  from?: string;
  to?: string;
  value?: any;
  mapping?: Record<string, any>;
  formula?: string;
}
