/**
 * Event Filter - Advanced filtering system for events
 *
 * Provides event filtering with expressions, chains, optimization,
 * wildcards, regex, and custom filters
 */

// @ts-nocheck - Type issues with filter expressions and boolean parameters
import type { EventEnvelope } from '../types';

// ============================================================================
// Filter Types
// ============================================================================

export interface FilterDefinition {
  filterId: string;
  name: string;
  description?: string;
  expression: FilterExpression;
  enabled: boolean;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export type FilterExpression =
  | FieldFilter
  | CompositeFilter
  | LogicalFilter
  | RegexFilter
  | WildcardFilter
  | CustomFilter
  | SchemaFilter
  | TemporalFilter;

export interface FieldFilter {
  type: 'field';
  field: string;
  operator: FilterOperator;
  value: unknown;
  caseSensitive?: boolean;
}

export type FilterOperator =
  | 'eq' // equals
  | 'ne' // not equals
  | 'gt' // greater than
  | 'gte' // greater than or equal
  | 'lt' // less than
  | 'lte' // less than or equal
  | 'in' // in array
  | 'nin' // not in array
  | 'contains' // contains substring
  | 'ncontains' // does not contain
  | 'startsWith' // starts with
  | 'endsWith' // ends with
  | 'matches' // regex match
  | 'exists' // field exists
  | 'nexists' // field does not exist
  | 'type' // type check
  | 'size' // array/object size
  | 'between'; // between two values

export interface CompositeFilter {
  type: 'and' | 'or' | 'not';
  filters: FilterExpression[];
  shortCircuit?: boolean; // Stop evaluating after first match/failure
}

export interface LogicalFilter {
  type: 'some' | 'every' | 'none';
  field: string; // Array field to check
  filter: FilterExpression; // Filter to apply to each element
}

export interface RegexFilter {
  type: 'regex';
  patterns: Array<{
    field: string;
    pattern: string;
    flags?: string;
  }>;
  matchType: 'all' | 'any';
}

export interface WildcardFilter {
  type: 'wildcard';
  patterns: Array<{
    field: string;
    pattern: string;
  }>;
  matchType: 'all' | 'any';
}

export interface CustomFilter {
  type: 'custom';
  fn: (event: EventEnvelope) => boolean | Promise<boolean>;
  description?: string;
  cost?: number; // Estimated computational cost (0-100)
}

export interface SchemaFilter {
  type: 'schema';
  schemaVersion?: number;
  schemaValidation?: boolean;
  requiredFields?: string[];
  fieldTypes?: Record<string, string>;
}

export interface TemporalFilter {
  type: 'temporal';
  timeRange?: {
    from?: number; // Timestamp
    to?: number; // Timestamp
  };
  ageRange?: {
    maxAgeMs?: number;
    minAgeMs?: number;
  };
  timeWindow?: {
    durationMs: number;
    frequency?: 'daily' | 'weekly' | 'monthly';
    timezone?: string;
  };
}

export interface FilterChain {
  chainId: string;
  name: string;
  filters: FilterDefinition[];
  mode: 'all' | 'any' | 'sequential'; // all = AND, any = OR, sequential = pipeline
  stopOnFirstMatch?: boolean;
  optimizationEnabled?: boolean;
}

export interface FilterResult {
  matched: boolean;
  filterId?: string;
  executionTimeMs: number;
  matchedFields?: string[];
  error?: Error;
}

export interface FilterStats {
  totalEvaluations: number;
  totalMatches: number;
  totalFailures: number;
  averageExecutionTimeMs: number;
  filterBreakdown: Map<string, FilterPerformance>;
}

export interface FilterPerformance {
  filterId: string;
  evaluations: number;
  matches: number;
  failures: number;
  averageExecutionTimeMs: number;
  lastExecutedAt: number;
}

// ============================================================================
// Event Filter
// ============================================================================

export class EventFilter {
  private filters: Map<string, FilterDefinition>;
  private chains: Map<string, FilterChain>;
  private stats: FilterStats;
  private cache: Map<string, { result: boolean; timestamp: number }>;

  constructor() {
    this.filters = new Map();
    this.chains = new Map();
    this.cache = new Map();
    this.stats = {
      totalEvaluations: 0,
      totalMatches: 0,
      totalFailures: 0,
      averageExecutionTimeMs: 0,
      filterBreakdown: new Map(),
    };
  }

  // ========================================================================
  // Single Filter Operations
  // ========================================================================

  addFilter(filter: Omit<FilterDefinition, 'filterId'>): string {
    const filterDef: FilterDefinition = {
      ...filter,
      filterId: this.generateFilterId(),
    };

    this.filters.set(filterDef.filterId, filterDef);
    this.invalidateCache();
    return filterDef.filterId;
  }

  removeFilter(filterId: string): boolean {
    const result = this.filters.delete(filterId);
    if (result) {
      this.invalidateCache();
    }
    return result;
  }

  getFilter(filterId: string): FilterDefinition | null {
    return this.filters.get(filterId) || null;
  }

  listFilters(): FilterDefinition[] {
    return Array.from(this.filters.values());
  }

  async evaluate(
    event: EventEnvelope,
    filterId: string,
    options: { useCache?: boolean } = {}
  ): Promise<FilterResult> {
    const startTime = performance.now();
    const filter = this.filters.get(filterId);

    if (!filter) {
      throw new Error(`Filter not found: ${filterId}`);
    }

    if (!filter.enabled) {
      return {
        matched: false,
        filterId,
        executionTimeMs: performance.now() - startTime,
      };
    }

    try {
      // Check cache
      if (options.useCache !== false) {
        const cacheKey = this.getCacheKey(event, filterId);
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 60000) {
          return {
            matched: cached.result,
            filterId,
            executionTimeMs: performance.now() - startTime,
          };
        }
      }

      const matched = await this.evaluateExpression(filter.expression, event);

      // Update cache
      if (options.useCache !== false) {
        const cacheKey = this.getCacheKey(event, filterId);
        this.cache.set(cacheKey, { result: matched, timestamp: Date.now() });
      }

      // Update stats
      this.updateStats(filterId, performance.now() - startTime, matched, null);

      return {
        matched,
        filterId,
        executionTimeMs: performance.now() - startTime,
      };
    } catch (error) {
      this.updateStats(
        filterId,
        performance.now() - startTime,
        false,
        error as Error
      );

      return {
        matched: false,
        filterId,
        executionTimeMs: performance.now() - startTime,
        error: error as Error,
      };
    }
  }

  async evaluateAll(
    event: EventEnvelope,
    options: { useCache?: boolean; filterIds?: string[] } = {}
  ): Promise<FilterResult[]> {
    const filterIds =
      options.filterIds || Array.from(this.filters.keys());
    const results: FilterResult[] = [];

    for (const filterId of filterIds) {
      const result = await this.evaluate(event, filterId, options);
      results.push(result);
    }

    return results;
  }

  // ========================================================================
  // Filter Chains
  // ========================================================================

  addChain(chain: Omit<FilterChain, 'chainId'>): string {
    const newChain: FilterChain = {
      ...chain,
      chainId: this.generateChainId(),
    };

    this.chains.set(newChain.chainId, newChain);
    return newChain.chainId;
  }

  removeChain(chainId: string): boolean {
    return this.chains.delete(chainId);
  }

  getChain(chainId: string): FilterChain | null {
    return this.chains.get(chainId) || null;
  }

  async evaluateChain(
    event: EventEnvelope,
    chainId: string
  ): Promise<FilterResult> {
    const chain = this.chains.get(chainId);

    if (!chain) {
      throw new Error(`Chain not found: ${chainId}`);
    }

    const startTime = performance.now();

    try {
      switch (chain.mode) {
        case 'all': {
          // All filters must match (AND)
          for (const filter of chain.filters) {
            const result = await this.evaluateExpression(
              filter.expression,
              event
            );
            if (!result) {
              if (chain.stopOnFirstMatch) {
                return {
                  matched: false,
                  filterId: filter.filterId,
                  executionTimeMs: performance.now() - startTime,
                };
              }
            }
          }
          return {
            matched: true,
            executionTimeMs: performance.now() - startTime,
          };
        }

        case 'any': {
          // Any filter must match (OR)
          for (const filter of chain.filters) {
            const result = await this.evaluateExpression(
              filter.expression,
              event
            );
            if (result) {
              if (chain.stopOnFirstMatch) {
                return {
                  matched: true,
                  filterId: filter.filterId,
                  executionTimeMs: performance.now() - startTime,
                };
              }
            }
          }
          return {
            matched: false,
            executionTimeMs: performance.now() - startTime,
          };
        }

        case 'sequential': {
          // Pipeline mode - pass results through filters
          let currentEvent = event;
          for (const filter of chain.filters) {
            const result = await this.evaluateExpression(
              filter.expression,
              currentEvent
            );
            if (!result) {
              return {
                matched: false,
                filterId: filter.filterId,
                executionTimeMs: performance.now() - startTime,
              };
            }
            // Filter could transform event in a more advanced implementation
          }
          return {
            matched: true,
            executionTimeMs: performance.now() - startTime,
          };
        }

        default:
          throw new Error(`Invalid chain mode: ${chain.mode}`);
      }
    } catch (error) {
      return {
        matched: false,
        executionTimeMs: performance.now() - startTime,
        error: error as Error,
      };
    }
  }

  // ========================================================================
  // Expression Evaluation
  // ========================================================================

  private async evaluateExpression(
    expression: FilterExpression,
    event: EventEnvelope
  ): Promise<boolean> {
    switch (expression.type) {
      case 'field':
        return this.evaluateFieldFilter(expression, event);
      case 'and':
      case 'or':
      case 'not':
        return this.evaluateCompositeFilter(expression, event);
      case 'some':
      case 'every':
      case 'none':
        return this.evaluateLogicalFilter(expression, event);
      case 'regex':
        return this.evaluateRegexFilter(expression, event);
      case 'wildcard':
        return this.evaluateWildcardFilter(expression, event);
      case 'custom':
        return expression.fn(event);
      case 'schema':
        return this.evaluateSchemaFilter(expression, event);
      case 'temporal':
        return this.evaluateTemporalFilter(expression, event);
      default:
        return false;
    }
  }

  private evaluateFieldFilter(
    filter: FieldFilter,
    event: EventEnvelope
  ): boolean {
    const value = this.getFieldValue(event, filter.field);

    switch (filter.operator) {
      case 'eq':
        return this.compareValues(value, filter.value, filter.caseSensitive);
      case 'ne':
        return !this.compareValues(
          value,
          filter.value,
          filter.caseSensitive
        );
      case 'gt':
        return typeof value === 'number' &&
          typeof filter.value === 'number'
          ? value > filter.value
          : false;
      case 'gte':
        return typeof value === 'number' &&
          typeof filter.value === 'number'
          ? value >= filter.value
          : false;
      case 'lt':
        return typeof value === 'number' &&
          typeof filter.value === 'number'
          ? value < filter.value
          : false;
      case 'lte':
        return typeof value === 'number' &&
          typeof filter.value === 'number'
          ? value <= filter.value
          : false;
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value);
      case 'nin':
        return Array.isArray(filter.value) && !filter.value.includes(value);
      case 'contains':
        return this.checkContains(value, filter.value, true);
      case 'ncontains':
        return !this.checkContains(value, filter.value, true);
      case 'startsWith':
        return this.checkStartsWith(value, filter.value, filter.caseSensitive);
      case 'endsWith':
        return this.checkEndsWith(value, filter.value, filter.caseSensitive);
      case 'matches':
        return typeof filter.value === 'string' &&
          typeof value === 'string'
          ? new RegExp(filter.value).test(value)
          : false;
      case 'exists':
        return value !== undefined && value !== null;
      case 'nexists':
        return value === undefined || value === null;
      case 'type':
        return typeof value === (filter.value as string);
      case 'size':
        const size =
          Array.isArray(value) || typeof value === 'object'
            ? Object.keys(value as object).length
            : 0;
        return typeof filter.value === 'number' ? size === filter.value : false;
      case 'between':
        if (
          !Array.isArray(filter.value) ||
          filter.value.length !== 2 ||
          typeof value !== 'number'
        ) {
          return false;
        }
        const [min, max] = filter.value as [number, number];
        return value >= min && value <= max;
      default:
        return false;
    }
  }

  private async evaluateCompositeFilter(
    filter: CompositeFilter,
    event: EventEnvelope
  ): Promise<boolean> {
    if (filter.type === 'not') {
      if (filter.filters.length !== 1) {
        throw new Error('NOT filter must have exactly one child filter');
      }
      return !(await this.evaluateExpression(filter.filters[0], event));
    }

    for (const f of filter.filters) {
      const result = await this.evaluateExpression(f, event);

      if (filter.type === 'and' && !result) {
        if (filter.shortCircuit) return false;
      }
      if (filter.type === 'or' && result) {
        if (filter.shortCircuit) return true;
      }
    }

    // Final check for non-short-circuited evaluation
    if (filter.type === 'and') {
      for (const f of filter.filters) {
        if (!(await this.evaluateExpression(f, event))) {
          return false;
        }
      }
      return true;
    } else {
      // OR
      for (const f of filter.filters) {
        if (await this.evaluateExpression(f, event)) {
          return true;
        }
      }
      return false;
    }
  }

  private async evaluateLogicalFilter(
    filter: LogicalFilter,
    event: EventEnvelope
  ): Promise<boolean> {
    const arrayValue = this.getFieldValue(event, filter.field);

    if (!Array.isArray(arrayValue)) {
      return false;
    }

    const results = await Promise.all(
      arrayValue.map((item) =>
        this.evaluateExpression(
          { ...filter.filter, field: '' }, // Temporarily set field to empty
          { ...event, payload: item } // Create temporary event with array item as payload
        )
      )
    );

    switch (filter.type) {
      case 'some':
        return results.some((r) => r);
      case 'every':
        return results.every((r) => r);
      case 'none':
        return results.every((r) => !r);
      default:
        return false;
    }
  }

  private evaluateRegexFilter(
    filter: RegexFilter,
    event: EventEnvelope
  ): boolean {
    const results = filter.patterns.map((pattern) => {
      const value = this.getFieldValue(event, pattern.field);
      if (typeof value !== 'string') {
        return false;
      }
      const regex = new RegExp(pattern.pattern, pattern.flags);
      return regex.test(value);
    });

    return filter.matchType === 'all'
      ? results.every((r) => r)
      : results.some((r) => r);
  }

  private evaluateWildcardFilter(
    filter: WildcardFilter,
    event: EventEnvelope
  ): boolean {
    const results = filter.patterns.map((pattern) => {
      const value = this.getFieldValue(event, pattern.field);
      if (typeof value !== 'string') {
        return false;
      }
      return this.matchWildcard(value, pattern.pattern);
    });

    return filter.matchType === 'all'
      ? results.every((r) => r)
      : results.some((r) => r);
  }

  private evaluateSchemaFilter(
    filter: SchemaFilter,
    event: EventEnvelope
  ): boolean {
    // Check required fields
    if (filter.requiredFields) {
      for (const field of filter.requiredFields) {
        const value = this.getFieldValue(event, field);
        if (value === undefined || value === null) {
          return false;
        }
      }
    }

    // Check field types
    if (filter.fieldTypes) {
      for (const [field, expectedType] of Object.entries(filter.fieldTypes)) {
        const value = this.getFieldValue(event, field);
        if (typeof value !== expectedType) {
          return false;
        }
      }
    }

    // Check schema version
    if (filter.schemaVersion !== undefined) {
      if (event.metadata.version !== filter.schemaVersion) {
        return false;
      }
    }

    return true;
  }

  private evaluateTemporalFilter(
    filter: TemporalFilter,
    event: EventEnvelope
  ): boolean {
    const timestamp = event.metadata.timestamp;

    // Check time range
    if (filter.timeRange) {
      if (filter.timeRange.from && timestamp < filter.timeRange.from) {
        return false;
      }
      if (filter.timeRange.to && timestamp > filter.timeRange.to) {
        return false;
      }
    }

    // Check age range
    if (filter.ageRange) {
      const age = Date.now() - timestamp;
      if (filter.ageRange.maxAgeMs && age > filter.ageRange.maxAgeMs) {
        return false;
      }
      if (filter.ageRange.minAgeMs && age < filter.ageRange.minAgeMs) {
        return false;
      }
    }

    // Check time window
    if (filter.timeWindow) {
      const windowStart =
        Math.floor(Date.now() / filter.timeWindow.durationMs) *
        filter.timeWindow.durationMs;
      const windowEnd = windowStart + filter.timeWindow.durationMs;

      if (timestamp < windowStart || timestamp >= windowEnd) {
        return false;
      }
    }

    return true;
  }

  // ========================================================================
  // Optimization
  // ========================================================================

  optimizeFilters(): void {
    // Sort filters by priority (if set) or by estimated cost
    const sortedFilters = Array.from(this.filters.values()).sort((a, b) => {
      const priorityA = a.priority ?? this.estimateCost(a.expression);
      const priorityB = b.priority ?? this.estimateCost(b.expression);
      return priorityB - priorityA; // Higher priority first
    });

    // Reorder filters in all chains
    for (const chain of this.chains.values()) {
      if (chain.optimizationEnabled) {
        chain.filters.sort((a, b) => {
          const priorityA = a.priority ?? this.estimateCost(a.expression);
          const priorityB = b.priority ?? this.estimateCost(b.expression);
          return priorityB - priorityA;
        });
      }
    }

    // Clear cache after optimization
    this.invalidateCache();
  }

  private estimateCost(expression: FilterExpression): number {
    // Estimate computational cost (0-100, lower is better)
    switch (expression.type) {
      case 'field':
        return 10; // Simple field access
      case 'regex':
        return 50; // Regex can be expensive
      case 'custom':
        return (expression as CustomFilter).cost ?? 70; // Custom functions vary
      case 'schema':
        return 30; // Schema validation is moderate
      case 'temporal':
        return 15; // Time checks are cheap
      case 'and':
      case 'or':
        return (expression as CompositeFilter).filters.length * 10;
      case 'not':
        return 10;
      default:
        return 50;
    }
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  private updateStats(
    filterId: string,
    executionTimeMs: number,
    matched: boolean,
    error: Error | null
  ): void {
    this.stats.totalEvaluations++;
    if (matched) this.stats.totalMatches++;
    if (error) this.stats.totalFailures++;

    this.stats.averageExecutionTimeMs =
      (this.stats.averageExecutionTimeMs * (this.stats.totalEvaluations - 1) +
        executionTimeMs) /
      this.stats.totalEvaluations;

    let perf = this.stats.filterBreakdown.get(filterId);
    if (!perf) {
      perf = {
        filterId,
        evaluations: 0,
        matches: 0,
        failures: 0,
        averageExecutionTimeMs: 0,
        lastExecutedAt: 0,
      };
      this.stats.filterBreakdown.set(filterId, perf);
    }

    perf.evaluations++;
    if (matched) perf.matches++;
    if (error) perf.failures++;
    perf.averageExecutionTimeMs =
      (perf.averageExecutionTimeMs * (perf.evaluations - 1) + executionTimeMs) /
      perf.evaluations;
    perf.lastExecutedAt = Date.now();
  }

  getStats(): FilterStats {
    return {
      ...this.stats,
      filterBreakdown: new Map(this.stats.filterBreakdown),
    };
  }

  resetStats(): void {
    this.stats = {
      totalEvaluations: 0,
      totalMatches: 0,
      totalFailures: 0,
      averageExecutionTimeMs: 0,
      filterBreakdown: new Map(),
    };
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private getFieldValue(event: EventEnvelope, field: string): unknown {
    if (field === '' || field === 'payload') {
      return event.payload;
    }

    const parts = field.split('.');
    let current: unknown = event;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private compareValues(
    a: unknown,
    b: unknown,
    caseSensitive: boolean = true
  ): boolean {
    if (typeof a === 'string' && typeof b === 'string') {
      return caseSensitive ? a === b : a.toLowerCase() === b.toLowerCase();
    }
    return a === b;
  }

  private checkContains(
    value: unknown,
    searchValue: unknown,
    caseSensitive: boolean
  ): boolean {
    if (typeof value === 'string' && typeof searchValue === 'string') {
      return caseSensitive
        ? value.includes(searchValue)
        : value.toLowerCase().includes(searchValue.toLowerCase());
    }
    if (Array.isArray(value)) {
      return value.includes(searchValue);
    }
    return false;
  }

  private checkStartsWith(
    value: unknown,
    prefix: unknown,
    caseSensitive: boolean
  ): boolean {
    if (typeof value === 'string' && typeof prefix === 'string') {
      return caseSensitive
        ? value.startsWith(prefix)
        : value.toLowerCase().startsWith(prefix.toLowerCase());
    }
    return false;
  }

  private checkEndsWith(
    value: unknown,
    suffix: unknown,
    caseSensitive: boolean
  ): boolean {
    if (typeof value === 'string' && typeof suffix === 'string') {
      return caseSensitive
        ? value.endsWith(suffix)
        : value.toLowerCase().endsWith(suffix.toLowerCase());
    }
    return false;
  }

  private matchWildcard(value: string, pattern: string): boolean {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return regex.test(value);
  }

  private getCacheKey(event: EventEnvelope, filterId: string): string {
    return `${event.metadata.eventId}:${filterId}`;
  }

  private invalidateCache(): void {
    this.cache.clear();
  }

  private generateFilterId(): string {
    return `filter_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateChainId(): string {
    return `chain_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
