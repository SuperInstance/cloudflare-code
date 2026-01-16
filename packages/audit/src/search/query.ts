// @ts-nocheck - External dependencies and type compatibility issues
/**
 * Audit Log Search and Query Engine
 * Provides advanced search capabilities for audit logs with filtering,
 * aggregation, and analytics
 */

import {
  type BaseAuditEvent,
  type AuditQueryParams,
  type AuditQueryResult,
  AuditEventType,
  ActorType,
  ResourceType,
  EventSeverity,
  EventOutcome,
  ComplianceFramework,
  SOC2TrustService,
  ISO27001Domain
} from '../types/events';

/**
 * Search query operator
 */
export enum QueryOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'ne',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  IN = 'in',
  NOT_IN = 'not_in',
  BETWEEN = 'between',
  REGEX = 'regex'
}

/**
 * Search filter condition
 */
export interface SearchCondition {
  field: string;
  operator: QueryOperator;
  value: any;
  values?: any[];
}

/**
 * Search query with complex conditions
 */
export interface SearchQuery {
  conditions: SearchCondition[];
  logic: 'AND' | 'OR';
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeAggregations?: boolean;
}

/**
 * Time series aggregation
 */
export interface TimeSeriesAggregation {
  interval: 'minute' | 'hour' | 'day' | 'week' | 'month';
  field?: string;
  groupBy?: string[];
}

/**
 * Aggregation result
 */
export interface AggregationResult {
  groupBy: Record<string, any>;
  count: number;
  percentage: number;
  firstSeen: Date;
  lastSeen: Date;
}

/**
 * Search statistics
 */
export interface SearchStats {
  totalEvents: number;
  filteredEvents: number;
  searchTime: number;
  averageEventSize: number;
}

/**
 * Audit log search engine
 */
export class AuditLogSearchEngine {
  private eventIndex: Map<string, BaseAuditEvent[]> = new Map();
  private fullTextIndex: Map<string, Set<string>> = new Map();
  private aggregateCache: Map<string, AggregationResult[]> = new Map();

  /**
   * Index an event for searching
   */
  indexEvent(event: BaseAuditEvent): void {
    // Index by event type
    this.addToIndex('eventType', event.eventType, event);

    // Index by actor
    this.addToIndex('actorId', event.actor.id, event);
    this.addToIndex('actorType', event.actor.type, event);

    // Index by resource
    if (event.resource) {
      this.addToIndex('resourceType', event.resource.type, event);
      this.addToIndex('resourceId', event.resource.id, event);
    }

    // Index by severity
    this.addToIndex('severity', event.severity, event);

    // Index by outcome
    this.addToIndex('outcome', event.outcome, event);

    // Index by timestamp (hourly buckets)
    const hourKey = this.getHourBucket(event.timestamp);
    this.addToIndex('timestamp', hourKey, event);

    // Index by compliance frameworks
    for (const framework of event.complianceFrameworks) {
      this.addToIndex('framework', framework, event);
    }

    // Index by SOC 2 trust services
    for (const service of event.soc2TrustServices) {
      this.addToIndex('soc2Service', service, event);
    }

    // Index by ISO 27001 domains
    for (const domain of event.iso27001Domains) {
      this.addToIndex('isoDomain', domain, event);
    }

    // Index by tags
    for (const tag of event.tags) {
      this.addToIndex('tag', tag, event);
    }

    // Full-text index
    this.indexForFullTextSearch(event);
  }

  /**
   * Index multiple events
   */
  indexBatch(events: BaseAuditEvent[]): void {
    for (const event of events) {
      this.indexEvent(event);
    }
  }

  /**
   * Search events with query parameters
   */
  search(params: AuditQueryParams): AuditQueryResult {
    const startTime = Date.now();

    let events: BaseAuditEvent[] = [];

    // Use indexed lookups when possible
    if (params.eventType) {
      events = this.getFromIndex('eventType', params.eventType) || [];
    } else if (params.eventTypes && params.eventTypes.length > 0) {
      events = [];
      for (const type of params.eventTypes) {
        const indexed = this.getFromIndex('eventType', type) || [];
        events.push(...indexed);
      }
    } else if (params.actorId) {
      events = this.getFromIndex('actorId', params.actorId) || [];
    } else if (params.resourceType && params.resourceId) {
      const byType = this.getFromIndex('resourceType', params.resourceType) || [];
      events = byType.filter(e => e.resource?.id === params.resourceId);
    } else {
      // Fallback to scanning all events (inefficient but complete)
      events = this.getAllEvents();
    }

    // Apply filters
    events = this.applyFilters(events, params);

    // Sort
    events = this.sortEvents(events, params.sortBy || 'timestamp', params.sortOrder || 'desc');

    // Calculate total before pagination
    const total = events.length;

    // Paginate
    const offset = params.offset || 0;
    const limit = params.limit || 100;
    const paginatedEvents = events.slice(offset, offset + limit);

    // Calculate aggregations
    const aggregations = this.calculateAggregations(events, params);

    const searchTime = Date.now() - startTime;

    return {
      total,
      limit,
      offset,
      events: paginatedEvents,
      aggregations
    };
  }

  /**
   * Advanced search with complex conditions
   */
  advancedSearch(query: SearchQuery): AuditQueryResult {
    let events = this.getAllEvents();

    // Apply conditions
    for (const condition of query.conditions) {
      events = this.applyCondition(events, condition);

      if (query.logic === 'OR') {
        // For OR logic, we need different approach
        // This is simplified - real implementation would be more complex
        break;
      }
    }

    // Sort
    events = this.sortEvents(
      events,
      query.sortBy || 'timestamp',
      query.sortOrder || 'desc'
    );

    // Paginate
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    const paginatedEvents = events.slice(offset, offset + limit);

    return {
      total: events.length,
      limit,
      offset,
      events: paginatedEvents,
      aggregations: query.includeAggregations ? this.calculateAdvancedAggregations(events) : undefined
    };
  }

  /**
   * Full-text search
   */
  fullTextSearch(query: string, limit: number = 100): BaseAuditEvent[] {
    const terms = query.toLowerCase().split(/\s+/);
    const results: Map<string, BaseAuditEvent> = new Map();

    for (const term of terms) {
      const eventIds = this.fullTextIndex.get(term);
      if (eventIds) {
        for (const eventId of eventIds) {
          // Get event (this would be more efficient with a proper event store)
          // For now, we'll return empty
        }
      }
    }

    return Array.from(results.values()).slice(0, limit);
  }

  /**
   * Time series aggregation
   */
  timeSeriesAggregation(
    params: AuditQueryParams,
    aggregation: TimeSeriesAggregation
  ): Array<{ timestamp: string; count: number }> {
    const events = this.search(params).events;
    const timeSeries: Map<string, number> = new Map();

    for (const event of events) {
      const bucket = this.getTimeBucket(event.timestamp, aggregation.interval);
      timeSeries.set(bucket, (timeSeries.get(bucket) || 0) + 1);
    }

    // Convert to array and sort
    return Array.from(timeSeries.entries())
      .map(([timestamp, count]) => ({ timestamp, count }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Group by aggregation
   */
  groupBy(
    params: AuditQueryParams,
    fields: string[]
  ): AggregationResult[] {
    const events = this.search(params).events;
    const groups: Map<string, BaseAuditEvent[]> = new Map();

    // Group events
    for (const event of events) {
      const groupKey = this.getGroupKey(event, fields);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(event);
    }

    // Calculate aggregations for each group
    const results: AggregationResult[] = [];
    const total = events.length;

    for (const [groupKey, groupEvents] of groups.entries()) {
      const groupByValues = this.parseGroupKey(groupKey, fields);

      results.push({
        groupBy: groupByValues,
        count: groupEvents.length,
        percentage: (groupEvents.length / total) * 100,
        firstSeen: new Date(groupEvents[0].timestamp),
        lastSeen: new Date(groupEvents[groupEvents.length - 1].timestamp)
      });
    }

    // Sort by count descending
    return results.sort((a, b) => b.count - a.count);
  }

  /**
   * Get search statistics
   */
  getStats(): SearchStats {
    const allEvents = this.getAllEvents();
    const totalSize = allEvents.reduce((sum, e) => sum + JSON.stringify(e).length, 0);

    return {
      totalEvents: allEvents.length,
      filteredEvents: allEvents.length,
      searchTime: 0,
      averageEventSize: totalSize / allEvents.length
    };
  }

  /**
   * Clear all indexes
   */
  clearIndexes(): void {
    this.eventIndex.clear();
    this.fullTextIndex.clear();
    this.aggregateCache.clear();
  }

  /**
   * Private helper methods
   */

  private addToIndex(field: string, value: string, event: BaseAuditEvent): void {
    const key = `${field}:${value}`;

    if (!this.eventIndex.has(key)) {
      this.eventIndex.set(key, []);
    }

    this.eventIndex.get(key)!.push(event);
  }

  private getFromIndex(field: string, value: string): BaseAuditEvent[] | undefined {
    const key = `${field}:${value}`;
    return this.eventIndex.get(key);
  }

  private indexForFullTextSearch(event: BaseAuditEvent): void {
    const text = [
      event.description,
      event.eventType,
      event.actor.id,
      event.actor.name,
      event.resource?.name,
      JSON.stringify(event.details),
      ...event.tags
    ].join(' ').toLowerCase();

    const words = text.split(/\s+/);

    for (const word of words) {
      if (word.length < 3) continue; // Skip short words

      if (!this.fullTextIndex.has(word)) {
        this.fullTextIndex.set(word, new Set());
      }

      this.fullTextIndex.get(word)!.add(event.id);
    }
  }

  private getAllEvents(): BaseAuditEvent[] {
    const allEvents: BaseAuditEvent[] = [];
    const seen = new Set<string>();

    for (const events of this.eventIndex.values()) {
      for (const event of events) {
        if (!seen.has(event.id)) {
          seen.add(event.id);
          allEvents.push(event);
        }
      }
    }

    return allEvents;
  }

  private applyFilters(events: BaseAuditEvent[], params: AuditQueryParams): BaseAuditEvent[] {
    let filtered = events;

    // Filter by actor type
    if (params.actorType) {
      filtered = filtered.filter(e => e.actor.type === params.actorType);
    }

    // Filter by resource type
    if (params.resourceType) {
      filtered = filtered.filter(e => e.resource?.type === params.resourceType);
    }

    // Filter by resource ID
    if (params.resourceId) {
      filtered = filtered.filter(e => e.resource?.id === params.resourceId);
    }

    // Filter by time range
    if (params.startTime) {
      filtered = filtered.filter(e => e.timestamp >= params.startTime!);
    }

    if (params.endTime) {
      filtered = filtered.filter(e => e.timestamp <= params.endTime!);
    }

    // Filter by severity
    if (params.severity) {
      filtered = filtered.filter(e => e.severity === params.severity);
    }

    // Filter by outcome
    if (params.outcome) {
      filtered = filtered.filter(e => e.outcome === params.outcome);
    }

    // Filter by tags
    if (params.tags && params.tags.length > 0) {
      filtered = filtered.filter(e =>
        params.tags!.some(tag => e.tags.includes(tag))
      );
    }

    // Filter by compliance framework
    if (params.complianceFramework) {
      filtered = filtered.filter(e =>
        e.complianceFrameworks.includes(params.complianceFramework!)
      );
    }

    // Filter by SOC 2 trust service
    if (params.soc2TrustService) {
      filtered = filtered.filter(e =>
        e.soc2TrustServices.includes(params.soc2TrustService!)
      );
    }

    // Filter by ISO 27001 domain
    if (params.iso27001Domain) {
      filtered = filtered.filter(e =>
        e.iso27001Domains.includes(params.iso27001Domain!)
      );
    }

    return filtered;
  }

  private applyCondition(events: BaseAuditEvent[], condition: SearchCondition): BaseAuditEvent[] {
    const { field, operator, value, values } = condition;

    return events.filter(event => {
      const fieldValue = this.getFieldValue(event, field);

      switch (operator) {
        case QueryOperator.EQUALS:
          return fieldValue === value;

        case QueryOperator.NOT_EQUALS:
          return fieldValue !== value;

        case QueryOperator.CONTAINS:
          return typeof fieldValue === 'string' && fieldValue.includes(value);

        case QueryOperator.STARTS_WITH:
          return typeof fieldValue === 'string' && fieldValue.startsWith(value);

        case QueryOperator.ENDS_WITH:
          return typeof fieldValue === 'string' && fieldValue.endsWith(value);

        case QueryOperator.GREATER_THAN:
          return typeof fieldValue === 'number' && fieldValue > value;

        case QueryOperator.GREATER_THAN_OR_EQUAL:
          return typeof fieldValue === 'number' && fieldValue >= value;

        case QueryOperator.LESS_THAN:
          return typeof fieldValue === 'number' && fieldValue < value;

        case QueryOperator.LESS_THAN_OR_EQUAL:
          return typeof fieldValue === 'number' && fieldValue <= value;

        case QueryOperator.IN:
          return values ? values.includes(fieldValue) : false;

        case QueryOperator.NOT_IN:
          return values ? !values.includes(fieldValue) : true;

        case QueryOperator.BETWEEN:
          return values &&
            typeof fieldValue === 'number' &&
            fieldValue >= values[0] &&
            fieldValue <= values[1];

        case QueryOperator.REGEX:
          return typeof fieldValue === 'string' &&
            new RegExp(value).test(fieldValue);

        default:
          return true;
      }
    });
  }

  private getFieldValue(event: BaseAuditEvent, field: string): any {
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

  private sortEvents(
    events: BaseAuditEvent[],
    sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): BaseAuditEvent[] {
    return [...events].sort((a, b) => {
      const aValue = this.getFieldValue(a, sortBy);
      const bValue = this.getFieldValue(b, sortBy);

      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  private calculateAggregations(
    events: BaseAuditEvent[],
    params: AuditQueryParams
  ): AuditQueryResult['aggregations'] {
    return {
      byEventType: this.countByField(events, 'eventType'),
      bySeverity: this.countByField(events, 'severity'),
      byActorType: this.countByField(events, 'actor.type'),
      byResourceType: this.countByField(events, 'resource.type'),
      byOutcome: this.countByField(events, 'outcome'),
      byTime: this.calculateTimeDistribution(events)
    };
  }

  private calculateAdvancedAggregations(events: BaseAuditEvent[]): AuditQueryResult['aggregations'] {
    return this.calculateAggregations(events, {});
  }

  private countByField(events: BaseAuditEvent[], field: string): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const event of events) {
      const value = this.getFieldValue(event, field);
      const key = String(value);

      counts[key] = (counts[key] || 0) + 1;
    }

    return counts;
  }

  private calculateTimeDistribution(events: BaseAuditEvent[]): Array<{ timestamp: string; count: number }> {
    const timeBuckets: Map<string, number> = new Map();

    for (const event of events) {
      const hour = this.getHourBucket(event.timestamp);
      timeBuckets.set(hour, (timeBuckets.get(hour) || 0) + 1);
    }

    return Array.from(timeBuckets.entries())
      .map(([timestamp, count]) => ({ timestamp, count }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  private getGroupKey(event: BaseAuditEvent, fields: string[]): string {
    const values = fields.map(field => this.getFieldValue(event, field));
    return values.join('|');
  }

  private parseGroupKey(groupKey: string, fields: string[]): Record<string, any> {
    const values = groupKey.split('|');
    const result: Record<string, any> = {};

    fields.forEach((field, index) => {
      result[field] = values[index];
    });

    return result;
  }

  private getHourBucket(timestamp: string): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
  }

  private getTimeBucket(timestamp: string, interval: TimeSeriesAggregation['interval']): string {
    const date = new Date(timestamp);

    switch (interval) {
      case 'minute':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

      case 'hour':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;

      case 'day':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      case 'week':
        const weekNumber = this.getWeekNumber(date);
        return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;

      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
}

/**
 * Factory function to create audit log search engine
 */
export function createAuditLogSearchEngine(): AuditLogSearchEngine {
  return new AuditLogSearchEngine();
}

/**
 * Query builder for constructing complex queries
 */
export class AuditQueryBuilder {
  private conditions: SearchCondition[] = [];
  private logic: 'AND' | 'OR' = 'AND';
  private limit?: number;
  private offset?: number;
  private sortBy?: string;
  private sortOrder: 'asc' | 'desc' = 'desc';
  private includeAggregations = false;

  where(field: string, operator: QueryOperator, value: any, values?: any[]): this {
    this.conditions.push({ field, operator, value, values });
    return this;
  }

  and(): this {
    this.logic = 'AND';
    return this;
  }

  or(): this {
    this.logic = 'OR';
    return this;
  }

  setLimit(limit: number): this {
    this.limit = limit;
    return this;
  }

  setOffset(offset: number): this {
    this.offset = offset;
    return this;
  }

  sortBy(field: string, order: 'asc' | 'desc' = 'desc'): this {
    this.sortBy = field;
    this.sortOrder = order;
    return this;
  }

  includeAggregations(value: boolean = true): this {
    this.includeAggregations = value;
    return this;
  }

  build(): SearchQuery {
    return {
      conditions: this.conditions,
      logic: this.logic,
      limit: this.limit,
      offset: this.offset,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder,
      includeAggregations: this.includeAggregations
    };
  }
}

/**
 * Create a new query builder
 */
export function createQueryBuilder(): AuditQueryBuilder {
  return new AuditQueryBuilder();
}
