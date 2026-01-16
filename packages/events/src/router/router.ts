/**
 * Message Router - Advanced routing system for events
 *
 * Provides content-based, header-based, and pattern-based routing
 * with dynamic rules, caching, and optimization
 */

// @ts-nocheck - Type conversion issues with EventMetadata
import type { EventEnvelope } from '../types';

// ============================================================================
// Routing Types
// ============================================================================

export interface RouteRule {
  ruleId: string;
  name: string;
  priority: number;
  enabled: boolean;
  condition: RouteCondition;
  target: RouteTarget;
  metadata?: Record<string, unknown>;
}

export type RouteCondition =
  | ContentBasedCondition
  | HeaderBasedCondition
  | PatternBasedCondition
  | CompositeCondition
  | CustomCondition;

export interface ContentBasedCondition {
  type: 'content';
  fieldPath: string;
  operator: ContentOperator;
  value: unknown;
}

export type ContentOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'matches'
  | 'in'
  | 'notIn'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'exists'
  | 'notExists'
  | 'type';

export interface HeaderBasedCondition {
  type: 'header';
  headerName: string;
  operator: ContentOperator;
  value: unknown;
}

export interface PatternBasedCondition {
  type: 'pattern';
  pattern: string;
  matchType: 'wildcard' | 'regex' | 'glob';
  scope: 'eventType' | 'source' | 'all';
}

export interface CompositeCondition {
  type: 'and' | 'or' | 'not';
  conditions: RouteCondition[];
}

export interface CustomCondition {
  type: 'custom';
  fn: (event: EventEnvelope) => boolean | Promise<boolean>;
  description?: string;
}

export type RouteTarget =
  | { type: 'topic'; name: string }
  | { type: 'queue'; name: string }
  | { type: 'handler'; id: string }
  | { type: 'webhook'; url: string }
  | { type: 'multi'; targets: RouteTarget[] }
  | { type: 'none' }; // Drop the event

export interface RoutingTable {
  version: number;
  rules: RouteRule[];
  defaultTarget?: RouteTarget;
  metadata: {
    createdAt: number;
    updatedAt: number;
    lastModifiedBy: string;
  };
}

export interface RoutingResult {
  matched: boolean;
  ruleId?: string;
  targets: RouteTarget[];
  executionTimeMs: number;
  cacheHit: boolean;
}

export interface RoutingStats {
  totalEvaluations: number;
  totalMatches: number;
  totalDrops: number;
  averageExecutionTimeMs: number;
  ruleStats: Map<string, RuleStats>;
  cacheHitRate: number;
}

export interface RuleStats {
  ruleId: string;
  evaluations: number;
  matches: number;
  averageExecutionTimeMs: number;
  lastMatchedAt?: number;
}

// ============================================================================
// Route Cache
// ============================================================================

interface CacheEntry {
  targets: RouteTarget[];
  ruleId?: string;
  timestamp: number;
  hitCount: number;
}

export class RouteCache {
  private cache = new Map<string, CacheEntry>();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries: number = 1000, ttlMs: number = 60000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  private generateKey(event: EventEnvelope): string {
    return JSON.stringify({
      eventType: event.metadata.eventType,
      source: event.metadata.source,
      correlationId: event.metadata.correlationId,
      payload: event.payload,
    });
  }

  get(event: EventEnvelope): CacheEntry | null {
    const key = this.generateKey(event);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    entry.hitCount++;
    return entry;
  }

  set(event: EventEnvelope, result: Omit<CacheEntry, 'timestamp' | 'hitCount'>): void {
    const key = this.generateKey(event);

    // Evict if necessary
    if (this.cache.size >= this.maxEntries) {
      this.evict();
    }

    this.cache.set(key, {
      ...result,
      timestamp: Date.now(),
      hitCount: 0,
    });
  }

  private evict(): void {
    // Find least recently used entry
    let lruKey: string | null = null;
    let lruTime = Infinity;
    let lowestHits = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hitCount < lowestHits || entry.timestamp < lruTime) {
        lruKey = key;
        lruTime = entry.timestamp;
        lowestHits = entry.hitCount;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; hitRate: number } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
    }

    return {
      size: this.cache.size,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
    };
  }
}

// ============================================================================
// Message Router
// ============================================================================

export class MessageRouter {
  private routingTable: RoutingTable;
  private cache: RouteCache;
  private stats: RoutingStats;

  constructor(
    initialRules: RouteRule[] = [],
    options: {
      enableCache?: boolean;
      cacheMaxEntries?: number;
      cacheTtlMs?: number;
    } = {}
  ) {
    this.routingTable = {
      version: 1,
      rules: this.sortRulesByPriority(initialRules),
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastModifiedBy: 'system',
      },
    };

    this.cache = new RouteCache(
      options.cacheMaxEntries ?? 1000,
      options.cacheTtlMs ?? 60000
    );

    this.stats = {
      totalEvaluations: 0,
      totalMatches: 0,
      totalDrops: 0,
      averageExecutionTimeMs: 0,
      ruleStats: new Map(),
      cacheHitRate: 0,
    };
  }

  // ========================================================================
  // Routing
  // ========================================================================

  async route(event: EventEnvelope): Promise<RoutingResult> {
    const startTime = performance.now();

    // Check cache
    const cached = this.cache.get(event);
    if (cached) {
      return {
        matched: true,
        ruleId: cached.ruleId,
        targets: cached.targets,
        executionTimeMs: performance.now() - startTime,
        cacheHit: true,
      };
    }

    // Evaluate rules
    for (const rule of this.routingTable.rules) {
      if (!rule.enabled) {
        continue;
      }

      const ruleStartTime = performance.now();
      const matches = await this.evaluateCondition(rule.condition, event);
      const ruleExecutionTime = performance.now() - ruleStartTime;

      // Update rule stats
      this.updateRuleStats(rule.ruleId, ruleExecutionTime, matches);

      if (matches) {
        const result: RoutingResult = {
          matched: true,
          ruleId: rule.ruleId,
          targets: this.expandTargets(rule.target),
          executionTimeMs: performance.now() - startTime,
          cacheHit: false,
        };

        // Cache result
        this.cache.set(event, {
          targets: result.targets,
          ruleId: result.ruleId,
        });

        this.updateGlobalStats(true, false, result.executionTimeMs);
        return result;
      }
    }

    // No match - use default target if available
    const result: RoutingResult = {
      matched: false,
      targets: this.routingTable.defaultTarget ? [this.routingTable.defaultTarget] : [],
      executionTimeMs: performance.now() - startTime,
      cacheHit: false,
    };

    this.updateGlobalStats(false, !this.routingTable.defaultTarget, result.executionTimeMs);
    return result;
  }

  async routeBatch(events: EventEnvelope[]): Promise<RoutingResult[]> {
    const results: RoutingResult[] = [];

    for (const event of events) {
      const result = await this.route(event);
      results.push(result);
    }

    return results;
  }

  // ========================================================================
  // Condition Evaluation
  // ========================================================================

  private async evaluateCondition(
    condition: RouteCondition,
    event: EventEnvelope
  ): Promise<boolean> {
    switch (condition.type) {
      case 'content':
        return this.evaluateContentCondition(condition, event);
      case 'header':
        return this.evaluateHeaderCondition(condition, event);
      case 'pattern':
        return this.evaluatePatternCondition(condition, event);
      case 'and':
        return this.evaluateAndCondition(condition, event);
      case 'or':
        return this.evaluateOrCondition(condition, event);
      case 'not':
        return this.evaluateNotCondition(condition, event);
      case 'custom':
        return condition.fn(event);
      default:
        return false;
    }
  }

  private evaluateContentCondition(
    condition: ContentBasedCondition,
    event: EventEnvelope
  ): boolean {
    const value = this.getFieldValue(event.payload, condition.fieldPath);
    return this.compareValues(value, condition.operator, condition.value);
  }

  private evaluateHeaderCondition(
    condition: HeaderBasedCondition,
    event: EventEnvelope
  ): boolean {
    const value = (event.metadata as Record<string, unknown>)[condition.headerName];
    return this.compareValues(value, condition.operator, condition.value);
  }

  private evaluatePatternCondition(
    condition: PatternBasedCondition,
    event: EventEnvelope
  ): boolean {
    const value =
      condition.scope === 'eventType'
        ? event.metadata.eventType
        : condition.scope === 'source'
        ? event.metadata.source
        : `${event.metadata.eventType}:${event.metadata.source}`;

    switch (condition.matchType) {
      case 'wildcard':
        return this.matchWildcard(value, condition.pattern);
      case 'regex':
        return new RegExp(condition.pattern).test(value);
      case 'glob':
        return this.matchGlob(value, condition.pattern);
      default:
        return false;
    }
  }

  private async evaluateAndCondition(
    condition: CompositeCondition,
    event: EventEnvelope
  ): Promise<boolean> {
    for (const cond of condition.conditions) {
      if (!(await this.evaluateCondition(cond, event))) {
        return false;
      }
    }
    return true;
  }

  private async evaluateOrCondition(
    condition: CompositeCondition,
    event: EventEnvelope
  ): Promise<boolean> {
    for (const cond of condition.conditions) {
      if (await this.evaluateCondition(cond, event)) {
        return true;
      }
    }
    return false;
  }

  private async evaluateNotCondition(
    condition: CompositeCondition,
    event: EventEnvelope
  ): Promise<boolean> {
    if (condition.conditions.length !== 1) {
      throw new Error('NOT condition must have exactly one child condition');
    }
    return !(await this.evaluateCondition(condition.conditions[0], event));
  }

  // ========================================================================
  // Value Comparison
  // ========================================================================

  private compareValues(
    actual: unknown,
    operator: ContentOperator,
    expected: unknown
  ): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'notEquals':
        return actual !== expected;
      case 'contains':
        return typeof actual === 'string' && typeof expected === 'string'
          ? actual.includes(expected as string)
          : Array.isArray(actual) && actual.includes(expected);
      case 'notContains':
        return typeof actual === 'string' && typeof expected === 'string'
          ? !actual.includes(expected as string)
          : Array.isArray(actual) && !actual.includes(expected);
      case 'startsWith':
        return typeof actual === 'string' && typeof expected === 'string'
          ? actual.startsWith(expected)
          : false;
      case 'endsWith':
        return typeof actual === 'string' && typeof expected === 'string'
          ? actual.endsWith(expected)
          : false;
      case 'matches':
        return typeof actual === 'string' && typeof expected === 'string'
          ? new RegExp(expected).test(actual)
          : false;
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'notIn':
        return Array.isArray(expected) && !expected.includes(actual);
      case 'gt':
        return typeof actual === 'number' && typeof expected === 'number'
          ? actual > expected
          : false;
      case 'gte':
        return typeof actual === 'number' && typeof expected === 'number'
          ? actual >= expected
          : false;
      case 'lt':
        return typeof actual === 'number' && typeof expected === 'number'
          ? actual < expected
          : false;
      case 'lte':
        return typeof actual === 'number' && typeof expected === 'number'
          ? actual <= expected
          : false;
      case 'exists':
        return actual !== undefined && actual !== null;
      case 'notExists':
        return actual === undefined || actual === null;
      case 'type':
        return typeof actual === (expected as string);
      default:
        return false;
    }
  }

  // ========================================================================
  // Pattern Matching
  // ========================================================================

  private matchWildcard(value: string, pattern: string): boolean {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return regex.test(value);
  }

  private matchGlob(value: string, pattern: string): boolean {
    // Simplified glob matching
    const regex = new RegExp(
      '^' +
        pattern
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '[^/]') +
        '$'
    );
    return regex.test(value);
  }

  // ========================================================================
  // Field Extraction
  // ========================================================================

  private getFieldValue(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  // ========================================================================
  // Target Expansion
  // ========================================================================

  private expandTargets(target: RouteTarget): RouteTarget[] {
    if (target.type === 'multi') {
      const expanded: RouteTarget[] = [];
      for (const t of target.targets) {
        expanded.push(...this.expandTargets(t));
      }
      return expanded;
    }
    return [target];
  }

  // ========================================================================
  // Rule Management
  // ========================================================================

  addRule(rule: Omit<RouteRule, 'ruleId'>): string {
    const newRule: RouteRule = {
      ...rule,
      ruleId: this.generateRuleId(),
    };

    this.routingTable.rules.push(newRule);
    this.routingTable.rules = this.sortRulesByPriority(this.routingTable.rules);
    this.routingTable.version++;
    this.routingTable.metadata.updatedAt = Date.now();

    this.cache.clear(); // Clear cache on rule change
    return newRule.ruleId;
  }

  updateRule(ruleId: string, updates: Partial<RouteRule>): boolean {
    const index = this.routingTable.rules.findIndex((r) => r.ruleId === ruleId);
    if (index === -1) {
      return false;
    }

    this.routingTable.rules[index] = {
      ...this.routingTable.rules[index],
      ...updates,
    };

    this.routingTable.rules = this.sortRulesByPriority(this.routingTable.rules);
    this.routingTable.version++;
    this.routingTable.metadata.updatedAt = Date.now();

    this.cache.clear();
    return true;
  }

  removeRule(ruleId: string): boolean {
    const index = this.routingTable.rules.findIndex((r) => r.ruleId === ruleId);
    if (index === -1) {
      return false;
    }

    this.routingTable.rules.splice(index, 1);
    this.routingTable.version++;
    this.routingTable.metadata.updatedAt = Date.now();

    this.cache.clear();
    return true;
  }

  getRule(ruleId: string): RouteRule | null {
    return this.routingTable.rules.find((r) => r.ruleId === ruleId) || null;
  }

  listRules(): RouteRule[] {
    return [...this.routingTable.rules];
  }

  setDefaultTarget(target: RouteTarget): void {
    this.routingTable.defaultTarget = target;
    this.routingTable.version++;
    this.routingTable.metadata.updatedAt = Date.now();
  }

  loadRoutingTable(table: RoutingTable): void {
    this.routingTable = {
      ...table,
      rules: this.sortRulesByPriority(table.rules),
    };
    this.cache.clear();
  }

  getRoutingTable(): RoutingTable {
    return { ...this.routingTable };
  }

  // ========================================================================
  // Optimization
  // ========================================================================

  optimizeRules(): void {
    // Remove duplicate rules
    const uniqueRules: RouteRule[] = [];
    const seen = new Set<string>();

    for (const rule of this.routingTable.rules) {
      const key = JSON.stringify(rule.condition);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueRules.push(rule);
      }
    }

    // Remove unreachable rules (rules that can never match)
    const reachableRules: RouteRule[] = [];
    for (const rule of uniqueRules) {
      if (this.isRuleReachable(rule)) {
        reachableRules.push(rule);
      }
    }

    this.routingTable.rules = reachableRules;
    this.routingTable.version++;
    this.routingTable.metadata.updatedAt = Date.now();
  }

  private isRuleReachable(rule: RouteRule): boolean {
    // Check if rule conditions are possible to satisfy
    // This is a simplified check - a full implementation would be more sophisticated
    return true;
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  private updateRuleStats(
    ruleId: string,
    executionTimeMs: number,
    matched: boolean
  ): void {
    let stats = this.stats.ruleStats.get(ruleId);

    if (!stats) {
      stats = {
        ruleId,
        evaluations: 0,
        matches: 0,
        averageExecutionTimeMs: 0,
      };
      this.stats.ruleStats.set(ruleId, stats);
    }

    stats.evaluations++;
    if (matched) {
      stats.matches++;
      stats.lastMatchedAt = Date.now();
    }

    // Update average execution time
    stats.averageExecutionTimeMs =
      (stats.averageExecutionTimeMs * (stats.evaluations - 1) + executionTimeMs) /
      stats.evaluations;
  }

  private updateGlobalStats(
    matched: boolean,
    dropped: boolean,
    executionTimeMs: number
  ): void {
    this.stats.totalEvaluations++;
    if (matched) {
      this.stats.totalMatches++;
    }
    if (dropped) {
      this.stats.totalDrops++;
    }

    this.stats.averageExecutionTimeMs =
      (this.stats.averageExecutionTimeMs * (this.stats.totalEvaluations - 1) +
        executionTimeMs) /
      this.stats.totalEvaluations;

    // Update cache hit rate
    const cacheStats = this.cache.getStats();
    this.stats.cacheHitRate = cacheStats.hitRate;
  }

  getStats(): RoutingStats {
    return {
      ...this.stats,
      ruleStats: new Map(this.stats.ruleStats),
    };
  }

  resetStats(): void {
    this.stats = {
      totalEvaluations: 0,
      totalMatches: 0,
      totalDrops: 0,
      averageExecutionTimeMs: 0,
      ruleStats: new Map(),
      cacheHitRate: 0,
    };
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private sortRulesByPriority(rules: RouteRule[]): RouteRule[] {
    return [...rules].sort((a, b) => b.priority - a.priority);
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Routing Durable Object
// ============================================================================

export interface RouterEnv {
  ROUTER_STORAGE: DurableObjectNamespace;
}

export class MessageRouterDurableObject implements DurableObject {
  private router: MessageRouter;
  private storage: DurableObjectStorage;

  constructor(private state: DurableObjectState, private env: RouterEnv) {
    this.storage = state.storage;
    this.router = new MessageRouter();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Load routing table from storage
    const tableData = await this.storage.get<RoutingTable>('routing-table');
    if (tableData) {
      this.router.loadRoutingTable(tableData);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/route':
          const event = (await request.json()) as EventEnvelope;
          const result = await this.router.route(event);
          return Response.json(result);

        case '/route/batch':
          const events = (await request.json()) as EventEnvelope[];
          const results = await this.router.routeBatch(events);
          return Response.json(results);

        case '/rules':
          if (request.method === 'POST') {
            const rule = (await request.json()) as Omit<RouteRule, 'ruleId'>;
            const ruleId = this.router.addRule(rule);
            await this.persistRoutingTable();
            return Response.json({ ruleId });
          } else if (request.method === 'GET') {
            const rules = this.router.listRules();
            return Response.json(rules);
          }
          break;

        case '/stats':
          if (request.method === 'GET') {
            const stats = this.router.getStats();
            return Response.json({
              totalEvaluations: stats.totalEvaluations,
              totalMatches: stats.totalMatches,
              totalDrops: stats.totalDrops,
              averageExecutionTimeMs: stats.averageExecutionTimeMs,
              cacheHitRate: stats.cacheHitRate,
              ruleStats: Array.from(stats.ruleStats.values()),
            });
          } else if (request.method === 'DELETE') {
            this.router.resetStats();
            return Response.json({ success: true });
          }
          break;

        default:
          return Response.json({ error: 'Not found' }, { status: 404 });
      }
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  private async persistRoutingTable(): Promise<void> {
    await this.storage.put('routing-table', this.router.getRoutingTable());
  }

  async alarm(): Promise<void> {
    // Periodic cleanup or maintenance
    this.router.optimizeRules();
    await this.persistRoutingTable();
  }
}
