/**
 * Event Tracker - Core event collection and processing system
 * Handles event validation, enrichment, batching, and routing
 */

import type {
  AnalyticsEvent,
  EventValidationResult,
  EventBatch,
  EventMetadata,
  AnalyticsConfig,
} from '../types/index.js';

// ============================================================================
// Event Validation
// ============================================================================

export class EventValidator {
  private schema: ValidationSchema;
  private strictMode: boolean;

  constructor(strictMode = false) {
    this.strictMode = strictMode;
    this.schema = this.buildDefaultSchema();
  }

  /**
   * Validate an analytics event against schema rules
   */
  validate(event: AnalyticsEvent): EventValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];
    let sanitizedEvent = { ...event };

    // Required fields
    if (!event.id || typeof event.id !== 'string') {
      errors.push({
        field: 'id',
        message: 'Event ID is required and must be a string',
        code: 'MISSING_ID',
        severity: 'error',
      });
    }

    if (!event.eventType || typeof event.eventType !== 'string') {
      errors.push({
        field: 'eventType',
        message: 'Event type is required and must be a string',
        code: 'MISSING_EVENT_TYPE',
        severity: 'error',
      });
    }

    if (!event.eventName || typeof event.eventName !== 'string') {
      errors.push({
        field: 'eventName',
        message: 'Event name is required and must be a string',
        code: 'MISSING_EVENT_NAME',
        severity: 'error',
      });
    }

    // User identification
    if (!event.userId && !event.anonymousId) {
      warnings.push({
        field: 'userId',
        message: 'Event has no user identification (userId or anonymousId)',
        code: 'NO_USER_ID',
      });
    }

    // Session validation
    if (!event.sessionId || typeof event.sessionId !== 'string') {
      errors.push({
        field: 'sessionId',
        message: 'Session ID is required and must be a string',
        code: 'MISSING_SESSION_ID',
        severity: 'error',
      });
    }

    // Timestamp validation
    if (!event.timestamp || typeof event.timestamp !== 'number') {
      errors.push({
        field: 'timestamp',
        message: 'Timestamp is required and must be a number',
        code: 'INVALID_TIMESTAMP',
        severity: 'error',
      });
    } else {
      const now = Date.now();
      const maxFutureTolerance = 5 * 60 * 1000; // 5 minutes
      const maxPastTolerance = 365 * 24 * 60 * 60 * 1000; // 1 year

      if (event.timestamp > now + maxFutureTolerance) {
        warnings.push({
          field: 'timestamp',
          message: 'Event timestamp is significantly in the future',
          code: 'FUTURE_TIMESTAMP',
        });
        sanitizedEvent.timestamp = now;
      }

      if (event.timestamp < now - maxPastTolerance) {
        warnings.push({
          field: 'timestamp',
          message: 'Event timestamp is very old',
          code: 'OLD_TIMESTAMP',
        });
      }
    }

    // Context validation
    if (!event.context) {
      warnings.push({
        field: 'context',
        message: 'Event context is missing',
        code: 'MISSING_CONTEXT',
      });
      sanitizedEvent.context = this.buildDefaultContext();
    } else {
      // Validate context fields
      if (!event.context.appId) {
        errors.push({
          field: 'context.appId',
          message: 'App ID is required in context',
          code: 'MISSING_APP_ID',
          severity: 'error',
        });
      }

      // Sanitize potentially sensitive data
      if (this.strictMode) {
        sanitizedEvent.context = this.sanitizeContext(event.context);
      }
    }

    // Properties validation
    if (event.properties) {
      const propertyValidation = this.validateProperties(event.properties);
      errors.push(...propertyValidation.errors);
      warnings.push(...propertyValidation.warnings);

      if (this.strictMode) {
        sanitizedEvent.properties = this.sanitizeProperties(event.properties);
      }
    }

    // User properties validation
    if (event.userProperties) {
      const userPropValidation = this.validateProperties(event.userProperties);
      errors.push(...userPropValidation.errors);
      warnings.push(...userPropValidation.warnings);

      if (this.strictMode) {
        sanitizedEvent.userProperties = this.sanitizeProperties(event.userProperties);
      }
    }

    // Size validation
    const eventSize = this.calculateEventSize(sanitizedEvent);
    const maxSize = 64 * 1024; // 64KB

    if (eventSize > maxSize) {
      errors.push({
        field: 'event',
        message: `Event size (${eventSize} bytes) exceeds maximum (${maxSize} bytes)`,
        code: 'EVENT_TOO_LARGE',
        severity: 'error',
      });
    }

    // Metadata validation
    if (event.metadata) {
      sanitizedEvent.metadata = {
        validated: true,
        ...event.metadata,
      };
    } else {
      sanitizedEvent.metadata = {
        validated: true,
      };
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitizedEvent,
    };
  }

  /**
   * Validate event properties
   */
  private validateProperties(
    properties: Record<string, unknown>
  ): { errors: any[]; warnings: any[] } {
    const errors: any[] = [];
    const warnings: any[] = [];

    for (const [key, value] of Object.entries(properties)) {
      // Check for sensitive data patterns
      if (this.isSensitiveField(key)) {
        warnings.push({
          field: `properties.${key}`,
          message: 'Field name suggests sensitive data',
          code: 'SENSITIVE_FIELD',
        });
      }

      // Validate value types
      if (value === null || value === undefined) {
        warnings.push({
          field: `properties.${key}`,
          message: 'Property value is null or undefined',
          code: 'NULL_PROPERTY',
        });
        continue;
      }

      const valueType = typeof value;
      if (
        ![
          'string',
          'number',
          'boolean',
          'object',
          'bigint',
        ].includes(valueType)
      ) {
        errors.push({
          field: `properties.${key}`,
          message: `Unsupported property type: ${valueType}`,
          code: 'INVALID_PROPERTY_TYPE',
          severity: 'error',
        });
      }

      // Check array values
      if (Array.isArray(value)) {
        if (value.length > 1000) {
          warnings.push({
            field: `properties.${key}`,
            message: 'Array property is very large',
            code: 'LARGE_ARRAY',
          });
        }
      }

      // Check string values
      if (typeof value === 'string') {
        if (value.length > 4096) {
          warnings.push({
            field: `properties.${key}`,
            message: 'String property is very long',
            code: 'LONG_STRING',
          });
        }

        // Check for potential PII
        if (this.looksLikePII(key, value)) {
          warnings.push({
            field: `properties.${key}`,
            message: 'Property value may contain PII',
            code: 'POTENTIAL_PII',
          });
        }
      }

      // Check nested objects
      if (typeof value === 'object' && !Array.isArray(value)) {
        const nestedValidation = this.validateProperties(
          value as Record<string, unknown>
        );
        errors.push(...nestedValidation.errors);
        warnings.push(...nestedValidation.warnings);
      }
    }

    // Check total number of properties
    const propertyCount = Object.keys(properties).length;
    if (propertyCount > 100) {
      warnings.push({
        field: 'properties',
        message: `Event has many properties (${propertyCount})`,
        code: 'MANY_PROPERTIES',
      });
    }

    return { errors, warnings };
  }

  /**
   * Sanitize event context to remove sensitive information
   */
  private sanitizeContext(context: any): any {
    const sanitized = { ...context };

    // Remove IP if configured
    if (sanitized.ip) {
      sanitized.ip = this.hashValue(sanitized.ip);
    }

    // Remove or hash user agent
    if (sanitized.userAgent) {
      // Keep user agent but strip identifying info
      sanitized.userAgent = this.sanitizeUserAgent(sanitized.userAgent);
    }

    return sanitized;
  }

  /**
   * Sanitize event properties
   */
  private sanitizeProperties(
    properties: Record<string, unknown>
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(properties)) {
      if (this.isSensitiveField(key)) {
        // Hash sensitive values
        sanitized[key] = this.hashValue(String(value));
      } else if (typeof value === 'string' && this.looksLikeEmail(value)) {
        // Hash email addresses
        sanitized[key] = this.hashValue(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Check if a field name suggests sensitive data
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /api[_-]?key/i,
      /credit[_-]?card/i,
      /ssn/i,
      /social[_-]?security/i,
      /bank/i,
      /account/i,
    ];

    return sensitivePatterns.some((pattern) => pattern.test(fieldName));
  }

  /**
   * Check if a value looks like PII
   */
  private looksLikePII(key: string, value: string): boolean {
    if (this.looksLikeEmail(value)) return true;
    if (this.looksLikePhoneNumber(value)) return true;
    if (this.looksLikeSSN(value)) return true;
    if (this.looksLikeCreditCard(value)) return true;

    // Check key for PII indicators
    const piiKeys = [/email/i, /phone/i, /ssn/i, /credit/i];
    return piiKeys.some((pattern) => pattern.test(key));
  }

  private looksLikeEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private looksLikePhoneNumber(value: string): boolean {
    return /^\+?[\d\s\-\(\)]{10,}$/.test(value);
  }

  private looksLikeSSN(value: string): boolean {
    return /^\d{3}-?\d{2}-?\d{4}$/.test(value);
  }

  private looksLikeCreditCard(value: string): boolean {
    return /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/.test(value);
  }

  /**
   * Hash a value for privacy
   */
  private hashValue(value: string): string {
    // Simple hash for demonstration - use proper hashing in production
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `HASH_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Sanitize user agent string
   */
  private sanitizeUserAgent(userAgent: string): string {
    // Remove version numbers and other identifying info
    return userAgent
      .replace(/\d+\.\d+(\.\d+)?/g, 'X.X.X')
      .replace(/[a-f0-9]{32,}/gi, 'REDACTED');
  }

  /**
   * Calculate event size in bytes
   */
  private calculateEventSize(event: AnalyticsEvent): number {
    return JSON.stringify(event).length * 2; // Approximate UTF-16 size
  }

  /**
   * Build default validation schema
   */
  private buildDefaultSchema(): ValidationSchema {
    return {
      requiredFields: ['id', 'eventType', 'eventName', 'timestamp', 'sessionId'],
      optionalFields: ['userId', 'anonymousId', 'properties', 'userProperties'],
      maxProperties: 100,
      maxPropertyValueLength: 4096,
      maxEventSize: 64 * 1024,
    };
  }

  /**
   * Build default context
   */
  private buildDefaultContext(): any {
    return {
      appId: 'unknown',
      platform: 'web',
      timestamp: Date.now(),
    };
  }
}

interface ValidationSchema {
  requiredFields: string[];
  optionalFields: string[];
  maxProperties: number;
  maxPropertyValueLength: number;
  maxEventSize: number;
}

// ============================================================================
// Event Enrichment
// ============================================================================

export class EventEnricher {
  private enrichmentRules: EnrichmentRule[];

  constructor() {
    this.enrichmentRules = this.buildDefaultRules();
  }

  /**
   * Enrich an event with additional context and computed properties
   */
  enrich(event: AnalyticsEvent): AnalyticsEvent {
    let enrichedEvent = { ...event };

    for (const rule of this.enrichmentRules) {
      try {
        enrichedEvent = rule.apply(enrichedEvent);
      } catch (error) {
        console.error(`Enrichment rule failed: ${rule.name}`, error);
      }
    }

    // Mark as enriched
    if (enrichedEvent.metadata) {
      enrichedEvent.metadata.enriched = true;
      enrichedEvent.metadata.enrichedAt = Date.now();
    }

    return enrichedEvent;
  }

  /**
   * Build default enrichment rules
   */
  private buildDefaultRules(): EnrichmentRule[] {
    return [
      new TimeEnrichmentRule(),
      new GeoEnrichmentRule(),
      new CampaignEnrichmentRule(),
      new UserEnrichmentRule(),
      new SessionEnrichmentRule(),
      new DeviceEnrichmentRule(),
      new ContentEnrichmentRule(),
    ];
  }
}

abstract class EnrichmentRule {
  abstract name: string;
  abstract apply(event: AnalyticsEvent): AnalyticsEvent;
}

class TimeEnrichmentRule extends EnrichmentRule {
  name = 'time_enrichment';

  apply(event: AnalyticsEvent): AnalyticsEvent {
    const timestamp = event.timestamp || Date.now();
    const date = new Date(timestamp);

    return {
      ...event,
      properties: {
        ...event.properties,
        hour_of_day: date.getHours(),
        day_of_week: date.getDay(),
        day_of_month: date.getDate(),
        month: date.getMonth(),
        year: date.getFullYear(),
        week: this.getWeekNumber(date),
        is_weekend: date.getDay() === 0 || date.getDay() === 6,
        is_business_hours: date.getHours() >= 9 && date.getHours() < 17,
      },
    };
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear =
      (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
}

class GeoEnrichmentRule extends EnrichmentRule {
  name = 'geo_enrichment';

  apply(event: AnalyticsEvent): AnalyticsEvent {
    // Geo enrichment would typically call an external service
    // For now, we just ensure the location object exists
    return {
      ...event,
      context: {
        ...event.context,
        location: event.context.location || {
          country: 'unknown',
          timezone: event.context.timezone || 'UTC',
        },
      },
    };
  }
}

class CampaignEnrichmentRule extends EnrichmentRule {
  name = 'campaign_enrichment';

  apply(event: AnalyticsEvent): AnalyticsEvent {
    const url = event.context.url;
    const campaign = event.context.campaign || {};

    // Extract UTM parameters from URL
    if (url) {
      try {
        const urlObj = new URL(url);
        const utmSource = urlObj.searchParams.get('utm_source');
        const utmMedium = urlObj.searchParams.get('utm_medium');
        const utmCampaign = urlObj.searchParams.get('utm_campaign');
        const utmTerm = urlObj.searchParams.get('utm_term');
        const utmContent = urlObj.searchParams.get('utm_content');

        if (utmSource || utmMedium || utmCampaign) {
          campaign.source = campaign.source || utmSource;
          campaign.medium = campaign.medium || utmMedium;
          campaign.campaign = campaign.campaign || utmCampaign;
          campaign.term = campaign.term || utmTerm;
          campaign.content = campaign.content || utmContent;
        }
      } catch (error) {
        // Invalid URL, skip enrichment
      }
    }

    return {
      ...event,
      context: {
        ...event.context,
        campaign,
      },
    };
  }
}

class UserEnrichmentRule extends EnrichmentRule {
  name = 'user_enrichment';

  apply(event: AnalyticsEvent): AnalyticsEvent {
    // Add user-type categorization
    const userType = this.determineUserType(event);

    return {
      ...event,
      properties: {
        ...event.properties,
        user_type: userType,
        is_identified: !!event.userId,
      },
    };
  }

  private determineUserType(event: AnalyticsEvent): string {
    if (!event.userId) return 'anonymous';
    if (event.userProperties?.subscription) return 'subscriber';
    if (event.userProperties?.plan) return 'paid_user';
    return 'free_user';
  }
}

class SessionEnrichmentRule extends EnrichmentRule {
  name = 'session_enrichment';

  apply(event: AnalyticsEvent): AnalyticsEvent {
    // Add session-based properties
    const sessionAge = Date.now() - (event.timestamp || Date.now());

    return {
      ...event,
      properties: {
        ...event.properties,
        session_age_seconds: Math.floor(sessionAge / 1000),
      },
    };
  }
}

class DeviceEnrichmentRule extends EnrichmentRule {
  name = 'device_enrichment';

  apply(event: AnalyticsEvent): AnalyticsEvent {
    const userAgent = event.context.userAgent || '';
    const deviceInfo = this.parseUserAgent(userAgent);

    return {
      ...event,
      context: {
        ...event.context,
        ...deviceInfo,
      },
    };
  }

  private parseUserAgent(userAgent: string): any {
    // Simple UA parsing - in production, use a proper library
    const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
    const isTablet = /tablet|ipad/i.test(userAgent);

    return {
      deviceType: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
      isMobile: isMobile && !isTablet,
      isTablet,
    };
  }
}

class ContentEnrichmentRule extends EnrichmentRule {
  name = 'content_enrichment';

  apply(event: AnalyticsEvent): AnalyticsEvent {
    const url = event.context.url;

    if (!url) return event;

    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);

      return {
        ...event,
        properties: {
          ...event.properties,
          url_path: urlObj.pathname,
          url_domain: urlObj.hostname,
          content_category: pathParts[0] || 'root',
          content_subcategory: pathParts[1] || null,
          has_query_params: urlObj.searchParams.toString().length > 0,
        },
      };
    } catch (error) {
      return event;
    }
  }
}

// ============================================================================
// Event Batching
// ============================================================================

export class EventBatcher {
  private batches: Map<string, AnalyticsEvent[]>;
  private config: BatchingConfig;
  private flushTimers: Map<string, NodeJS.Timeout>;

  constructor(config: Partial<BatchingConfig> = {}) {
    this.batches = new Map();
    this.flushTimers = new Map();
    this.config = {
      maxBatchSize: config.maxBatchSize || 100,
      maxBatchWait: config.maxBatchWait || 5000,
      maxBatchSizeBytes: config.maxBatchSizeBytes || 1024 * 1024, // 1MB
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
    };
  }

  /**
   * Add an event to a batch
   */
  async add(event: AnalyticsEvent, batchKey = 'default'): Promise<string> {
    const batch = this.batches.get(batchKey) || [];

    batch.push(event);
    this.batches.set(batchKey, batch);

    // Check if we should flush
    if (this.shouldFlush(batch)) {
      await this.flush(batchKey);
    } else {
      // Set flush timer if not already set
      if (!this.flushTimers.has(batchKey)) {
        const timer = setTimeout(() => {
          this.flush(batchKey);
        }, this.config.maxBatchWait);
        this.flushTimers.set(batchKey, timer);
      }
    }

    return batchKey;
  }

  /**
   * Check if a batch should be flushed
   */
  private shouldFlush(batch: AnalyticsEvent[]): boolean {
    if (batch.length >= this.config.maxBatchSize) return true;

    const batchSize = this.calculateBatchSize(batch);
    if (batchSize >= this.config.maxBatchSizeBytes) return true;

    return false;
  }

  /**
   * Calculate batch size in bytes
   */
  private calculateBatchSize(batch: AnalyticsEvent[]): number {
    return JSON.stringify(batch).length * 2;
  }

  /**
   * Flush a batch
   */
  async flush(batchKey: string): Promise<EventBatch | null> {
    const events = this.batches.get(batchKey);

    if (!events || events.length === 0) {
      return null;
    }

    // Clear timer
    const timer = this.flushTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.flushTimers.delete(batchKey);
    }

    // Remove from batch map
    this.batches.delete(batchKey);

    // Create batch
    const batch: EventBatch = {
      id: this.generateBatchId(),
      events,
      count: events.length,
      size: this.calculateBatchSize(events),
      createdAt: Date.now(),
      status: 'pending',
      retryCount: 0,
    };

    return batch;
  }

  /**
   * Flush all pending batches
   */
  async flushAll(): Promise<EventBatch[]> {
    const batchKeys = Array.from(this.batches.keys());
    const batches: EventBatch[] = [];

    for (const key of batchKeys) {
      const batch = await this.flush(key);
      if (batch) {
        batches.push(batch);
      }
    }

    return batches;
  }

  /**
   * Get batch statistics
   */
  getStats(): BatchingStats {
    const totalEvents = Array.from(this.batches.values()).reduce(
      (sum, batch) => sum + batch.length,
      0
    );

    return {
      pendingBatches: this.batches.size,
      totalEvents,
      averageBatchSize:
        this.batches.size > 0 ? totalEvents / this.batches.size : 0,
    };
  }

  /**
   * Generate a unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface BatchingConfig {
  maxBatchSize: number;
  maxBatchWait: number;
  maxBatchSizeBytes: number;
  maxRetries: number;
  retryDelay: number;
}

interface BatchingStats {
  pendingBatches: number;
  totalEvents: number;
  averageBatchSize: number;
}

// ============================================================================
// Event Router
// ============================================================================

export class EventRouter {
  private routes: Route[];
  private defaultRoute: Route | null;

  constructor() {
    this.routes = [];
    this.defaultRoute = null;
  }

  /**
   * Register a route for events
   */
  registerRoute(route: Route): void {
    this.routes.push(route);
  }

  /**
   * Set the default route for unmatched events
   */
  setDefaultRoute(route: Route): void {
    this.defaultRoute = route;
  }

  /**
   * Route an event to the appropriate destination
   */
  async route(event: AnalyticsEvent): Promise<string[]> {
    const destinations: string[] = [];

    // Find matching routes
    for (const route of this.routes) {
      if (this.matchesRoute(event, route)) {
        destinations.push(route.destination);
        await route.handler?.(event);
      }
    }

    // Use default route if no matches
    if (destinations.length === 0 && this.defaultRoute) {
      destinations.push(this.defaultRoute.destination);
      await this.defaultRoute.handler?.(event);
    }

    return destinations;
  }

  /**
   * Route a batch of events
   */
  async routeBatch(events: AnalyticsEvent[]): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};

    for (const event of events) {
      const destinations = await this.route(event);

      for (const dest of destinations) {
        counts[dest] = (counts[dest] || 0) + 1;
      }
    }

    return counts;
  }

  /**
   * Check if an event matches a route
   */
  private matchesRoute(event: AnalyticsEvent, route: Route): boolean {
    if (route.filter.eventTypes && !route.filter.eventTypes.includes(event.eventType)) {
      return false;
    }

    if (route.filter.eventNames && !route.filter.eventNames.includes(event.eventName)) {
      return false;
    }

    if (route.filter.properties) {
      for (const [key, value] of Object.entries(route.filter.properties)) {
        if (event.properties[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }
}

interface Route {
  name: string;
  destination: string;
  filter: RouteFilter;
  handler?: (event: AnalyticsEvent) => Promise<void>;
}

interface RouteFilter {
  eventTypes?: string[];
  eventNames?: string[];
  properties?: Record<string, unknown>;
}

// ============================================================================
// Main Event Tracker
// ============================================================================

export class EventTracker {
  private validator: EventValidator;
  private enricher: EventEnricher;
  private batcher: EventBatcher;
  private router: EventRouter;
  private config: AnalyticsConfig;
  private metrics: TrackerMetrics;

  constructor(config: AnalyticsConfig) {
    this.config = config;
    this.validator = new EventValidator(config.events?.validation || false);
    this.enricher = new EventEnricher();
    this.batcher = new EventBatcher({
      maxBatchSize: config.events?.batchSize || 100,
      maxBatchWait: config.events?.flushInterval || 5000,
    });
    this.router = new EventRouter();
    this.metrics = {
      totalEvents: 0,
      validatedEvents: 0,
      invalidEvents: 0,
      enrichedEvents: 0,
      batchedEvents: 0,
      routedEvents: 0,
      errors: 0,
    };

    this.setupDefaultRoutes();
  }

  /**
   * Track an event
   */
  async track(event: AnalyticsEvent): Promise<{ success: boolean; error?: string }> {
    try {
      this.metrics.totalEvents++;

      // Validate event
      const validation = this.validator.validate(event);
      if (!validation.valid && this.config.events?.validation) {
        this.metrics.invalidEvents++;
        return {
          success: false,
          error: `Event validation failed: ${validation.errors.map((e) => e.message).join(', ')}`,
        };
      }
      this.metrics.validatedEvents++;

      // Use sanitized event if available
      const eventToProcess = validation.sanitizedEvent || event;

      // Enrich event
      const enrichedEvent = this.enricher.enrich(eventToProcess);
      this.metrics.enrichedEvents++;

      // Add to batch
      await this.batcher.add(enrichedEvent);
      this.metrics.batchedEvents++;

      // Route event
      await this.router.route(enrichedEvent);
      this.metrics.routedEvents++;

      return { success: true };
    } catch (error) {
      this.metrics.errors++;
      console.error('Error tracking event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Track multiple events
   */
  async trackBatch(events: AnalyticsEvent[]): Promise<{
    successful: number;
    failed: number;
    errors: string[];
  }> {
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const event of events) {
      const result = await this.track(event);
      if (result.success) {
        successful++;
      } else {
        failed++;
        if (result.error) {
          errors.push(result.error);
        }
      }
    }

    return { successful, failed, errors };
  }

  /**
   * Flush all pending events
   */
  async flush(): Promise<EventBatch[]> {
    return await this.batcher.flushAll();
  }

  /**
   * Get tracker metrics
   */
  getMetrics(): TrackerMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalEvents: 0,
      validatedEvents: 0,
      invalidEvents: 0,
      enrichedEvents: 0,
      batchedEvents: 0,
      routedEvents: 0,
      errors: 0,
    };
  }

  /**
   * Setup default routing rules
   */
  private setupDefaultRoutes(): void {
    // Route all events to storage
    this.router.registerRoute({
      name: 'storage',
      destination: 'storage',
      filter: {},
    });

    // Route conversion events to real-time analytics
    this.router.registerRoute({
      name: 'conversions',
      destination: 'realtime',
      filter: {
        eventTypes: ['conversion'],
      },
    });

    // Route page views to session analytics
    this.router.registerRoute({
      name: 'page_views',
      destination: 'session',
      filter: {
        eventTypes: ['page_view'],
      },
    });
  }
}

interface TrackerMetrics {
  totalEvents: number;
  validatedEvents: number;
  invalidEvents: number;
  enrichedEvents: number;
  batchedEvents: number;
  routedEvents: number;
  errors: number;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique anonymous user ID
 */
export function generateAnonymousId(): string {
  return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
