/**
 * Query Optimizer
 *
 * Analyzes and optimizes database queries for better performance
 */

import type { QueryMetrics, QueryPlan, IndexSuggestion, PerformanceReport } from './types';
import { QueryCache } from './cache';

export class QueryOptimizer {
  private queryMetrics: Map<string, QueryMetrics>;
  private queryPlans: Map<string, QueryPlan>;
  private slowQueryThreshold: number;
  private cache: QueryCache;

  constructor(slowQueryThreshold: number = 1000) {
    this.queryMetrics = new Map();
    this.queryPlans = new Map();
    this.slowQueryThreshold = slowQueryThreshold;
    this.cache = new QueryCache({
      maxSize: 1000,
      defaultTTL: 300000, // 5 minutes
      evictionPolicy: 'lru',
      maxSizeBytes: 100 * 1024 * 1024, // 100MB
    });
  }

  /**
   * Record query execution metrics
   */
  recordQuery(
    query: string,
    executionTime: number,
    rowsScanned: number,
    rowsReturned: number
  ): void {
    const normalized = this.normalizeQuery(query);
    let metrics = this.queryMetrics.get(normalized);

    if (!metrics) {
      metrics = {
        query: normalized,
        executionCount: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: executionTime,
        maxTime: executionTime,
        rowsScanned: 0,
        rowsReturned: 0,
        cacheHits: 0,
        cacheMisses: 0,
      };
      this.queryMetrics.set(normalized, metrics);
    }

    metrics.executionCount++;
    metrics.totalTime += executionTime;
    metrics.avgTime = metrics.totalTime / metrics.executionCount;
    metrics.minTime = Math.min(metrics.minTime, executionTime);
    metrics.maxTime = Math.max(metrics.maxTime, executionTime);
    metrics.rowsScanned += rowsScanned;
    metrics.rowsReturned += rowsReturned;
  }

  /**
   * Analyze query and generate optimization suggestions
   */
  analyzeQuery(query: string): QueryPlan {
    const normalized = this.normalizeQuery(query);
    const metrics = this.queryMetrics.get(normalized);

    const plan: QueryPlan = {
      query: normalized,
      plan: this.generateExplainPlan(query),
      estimatedCost: this.estimateCost(query),
      indexes: this.extractIndexes(query),
      suggestions: [],
    };

    // Generate suggestions based on metrics
    if (metrics) {
      // Check for slow queries
      if (metrics.avgTime > this.slowQueryThreshold) {
        plan.suggestions.push({
          table: this.extractTable(query),
          columns: this.extractColumns(query),
          type: 'btree',
          reason: `Query is slow (avg: ${metrics.avgTime}ms)`,
          estimatedImprovement: 0.5,
        });
      }

      // Check for high row scans
      if (metrics.rowsScanned > metrics.rowsReturned * 10) {
        plan.suggestions.push({
          table: this.extractTable(query),
          columns: this.extractWhereColumns(query),
          type: 'btree',
          reason: 'Query scans many more rows than it returns',
          estimatedImprovement: 0.8,
        });
      }
    }

    this.queryPlans.set(normalized, plan);
    return plan;
  }

  /**
   * Optimize a query
   */
  optimizeQuery(query: string): string {
    const plan = this.analyzeQuery(query);

    // Apply basic optimizations
    let optimized = query;

    // Add LIMIT if missing
    if (!/\bLIMIT\b/i.test(optimized) && /^\s*SELECT\b/i.test(optimized)) {
      optimized += ' LIMIT 1000';
    }

    // Suggest index usage
    for (const suggestion of plan.suggestions) {
      if (suggestion.estimatedImprovement > 0.5) {
        // In real implementation, would modify query to use index hints
      }
    }

    return optimized;
  }

  /**
   * Get query execution plan
   */
  async explainQuery(query: string): Promise<QueryPlan> {
    const normalized = this.normalizeQuery(query);
    let plan = this.queryPlans.get(normalized);

    if (!plan) {
      plan = this.analyzeQuery(query);
    }

    // Update with actual cost if available
    if (plan) {
      const metrics = this.queryMetrics.get(normalized);
      if (metrics) {
        plan.actualCost = metrics.avgTime;
      }
    }

    return plan!;
  }

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport {
    const allMetrics = Array.from(this.queryMetrics.values());
    const slowQueries = allMetrics.filter((m) => m.avgTime > this.slowQueryThreshold);

    const latencies = allMetrics.map((m) => m.avgTime).sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    const totalQueries = allMetrics.reduce((sum, m) => sum + m.executionCount, 0);
    const avgLatency = allMetrics.reduce((sum, m) => sum + m.totalTime, 0) / totalQueries;

    const cacheStats = this.cache.getStats();

    return {
      timestamp: new Date(),
      totalQueries,
      avgLatency,
      p95Latency: latencies[p95Index] || 0,
      p99Latency: latencies[p99Index] || 0,
      cacheHitRate: cacheStats.hitRate,
      slowQueries: slowQueries.sort((a, b) => b.avgTime - a.avgTime).slice(0, 10),
      indexSuggestions: this.generateIndexSuggestions(),
    };
  }

  /**
   * Generate index suggestions
   */
  private generateIndexSuggestions(): IndexSuggestion[] {
    const suggestions: IndexSuggestion[] = [];

    for (const metrics of this.queryMetrics.values()) {
      if (metrics.avgTime > this.slowQueryThreshold) {
        const query = metrics.query;
        suggestions.push({
          table: this.extractTable(query),
          columns: this.extractWhereColumns(query),
          type: 'btree',
          reason: `Frequently executed slow query (avg: ${metrics.avgTime}ms)`,
          estimatedImprovement: 1 - (this.slowQueryThreshold / metrics.avgTime),
        });
      }
    }

    // Deduplicate and rank suggestions
    const unique = new Map<string, IndexSuggestion>();

    for (const suggestion of suggestions) {
      const key = `${suggestion.table}:${suggestion.columns.join(',')}`;
      const existing = unique.get(key);

      if (!existing || suggestion.estimatedImprovement > existing.estimatedImprovement) {
        unique.set(key, suggestion);
      }
    }

    return Array.from(unique.values()).sort((a, b) =>
      b.estimatedImprovement - a.estimatedImprovement
    );
  }

  /**
   * Normalize query for metrics aggregation
   */
  private normalizeQuery(query: string): string {
    return query
      .replace(/\s+/g, ' ')
      .replace(/\d+/g, '?')
      .replace(/'[^']*'/g, '?')
      .trim()
      .toLowerCase();
  }

  /**
   * Generate EXPLAIN plan (simplified)
   */
  private generateExplainPlan(query: string): string {
    const upper = query.toUpperCase();

    if (upper.startsWith('SELECT')) {
      return 'Seq Scan on table -> Filter -> Sort -> Limit';
    } else if (upper.startsWith('INSERT')) {
      return 'Insert on table';
    } else if (upper.startsWith('UPDATE')) {
      return 'Update on table -> Seq Scan -> Filter';
    } else if (upper.startsWith('DELETE')) {
      return 'Delete on table -> Seq Scan -> Filter';
    }

    return 'Unknown plan';
  }

  /**
   * Estimate query cost
   */
  private estimateCost(query: string): number {
    const normalized = this.normalizeQuery(query);
    const metrics = this.queryMetrics.get(normalized);

    if (metrics) {
      return metrics.avgTime;
    }

    // Base cost estimate
    let cost = 100;

    // Add cost for complex operations
    if (/JOIN/i.test(query)) cost *= 2;
    if (/ORDER BY/i.test(query)) cost *= 1.5;
    if (/GROUP BY/i.test(query)) cost *= 1.5;
    if (/DISTINCT/i.test(query)) cost *= 1.3;
    if (/LIKE/i.test(query)) cost *= 2;
    if (/\bIN\s*\(/i.test(query)) cost *= 1.5;

    return cost;
  }

  /**
   * Extract table name from query
   */
  private extractTable(query: string): string {
    const match = query.match(/(?:FROM|INSERT INTO|UPDATE|DELETE FROM)\s+(\w+)/i);
    return match ? match[1] : 'unknown';
  }

  /**
   * Extract column names from query
   */
  private extractColumns(query: string): string[] {
    const columns: string[] = [];

    // Extract SELECT columns
    const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM/i);
    if (selectMatch) {
      const cols = selectMatch[1].split(',');
      for (const col of cols) {
        const trimmed = col.trim();
        if (trimmed !== '*') {
          columns.push(trimmed.split(/\s+/)[0]);
        }
      }
    }

    return columns;
  }

  /**
   * Extract WHERE clause columns
   */
  private extractWhereColumns(query: string): string[] {
    const columns: string[] = [];
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+GROUP|\s+ORDER|\s+LIMIT|$)/i);

    if (whereMatch) {
      const conditions = whereMatch[1].split(/\bAND\b|\bOR\b/i);
      for (const condition of conditions) {
        const match = condition.match(/(\w+)\s*[=<>]/);
        if (match) {
          columns.push(match[1]);
        }
      }
    }

    return columns;
  }

  /**
   * Extract indexes mentioned in query
   */
  private extractIndexes(query: string): string[] {
    // In real implementation, would parse query and find index hints
    return [];
  }

  /**
   * Get query cache
   */
  getCache(): QueryCache {
    return this.cache;
  }

  /**
   * Get all query metrics
   */
  getMetrics(): QueryMetrics[] {
    return Array.from(this.queryMetrics.values());
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.queryMetrics.clear();
    this.queryPlans.clear();
  }

  /**
   * Update slow query threshold
   */
  setSlowQueryThreshold(threshold: number): void {
    this.slowQueryThreshold = threshold;
  }
}
