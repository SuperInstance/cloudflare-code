/**
 * Performance Analyzer and Bottleneck Detector
 *
 * Comprehensive performance analysis system that detects:
 * - Slow operations and bottlenecks
 * - Memory leaks
 * - N+1 query problems
 * - Hot paths
 * - Performance regression
 *
 * Features:
 * - Real-time performance monitoring
 * - Historical performance comparison
 * - Optimization recommendations
 * - Performance profiling
 */

import type {
  PerformanceAnalysis,
  Bottleneck,
  BottleneckType,
  SlowOperation,
  MemoryAnalysis,
  MemoryLeak,
  LargeAllocation,
  HotPath,
  NPlusOneQuery,
  OptimizationSuggestion,
  OptimizationType,
  MetricSnapshot,
  Reference,
} from './types';
import { BottleneckType as BT, OptimizationType as OT } from './types';

// ============================================================================
// PERFORMANCE THRESHOLDS
// ============================================================================

interface PerformanceThresholds {
  /** Slow operation threshold (ms) */
  slowOperationThreshold: number;
  /** Slow query threshold (ms) */
  slowQueryThreshold: number;
  /** Memory leak threshold (bytes) */
  memoryLeakThreshold: number;
  /** Hot path minimum calls */
  hotPathMinCalls: number;
  /** N+1 query threshold */
  nPlusOneThreshold: number;
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  slowOperationThreshold: 1000, // 1 second
  slowQueryThreshold: 100, // 100ms
  memoryLeakThreshold: 10 * 1024 * 1024, // 10MB
  hotPathMinCalls: 1000,
  nPlusOneThreshold: 10,
};

// ============================================================================
// PERFORMANCE ANALYZER
// ============================================================================

export class PerformanceAnalyzer {
  private thresholds: PerformanceThresholds;
  private historicalSnapshots: MetricSnapshot[] = [];

  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Analyze performance from metrics
   */
  analyzePerformance(metrics: MetricSnapshot): PerformanceAnalysis {
    const bottlenecks = this.detectBottlenecks(metrics);
    const slowOperations = this.detectSlowOperations(metrics);
    const memoryAnalysis = this.analyzeMemory(metrics);
    const hotPaths = this.identifyHotPaths(metrics);
    const nPlusOneQueries = this.detectNPlusOneQueries(metrics);
    const optimizations = this.generateOptimizations(
      bottlenecks,
      slowOperations,
      nPlusOneQueries
    );

    return {
      analysisId: this.generateAnalysisId(),
      bottlenecks,
      slowOperations,
      memoryAnalysis,
      hotPaths,
      nPlusOneQueries,
      optimizations,
    };
  }

  /**
   * Detect performance bottlenecks
   */
  private detectBottlenecks(metrics: MetricSnapshot): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Check request latency
    if (metrics.requests.p95 > this.thresholds.slowOperationThreshold) {
      bottlenecks.push({
        bottleneckId: this.generateBottleneckId(),
        type: BT.SLOW_QUERY,
        location: {
          filePath: 'unknown',
          functionName: 'request_handler',
          lineNumber: 0,
        },
        severity: this.calculateSeverity(metrics.requests.p95, this.thresholds.slowOperationThreshold),
        impact: (metrics.requests.p95 - this.thresholds.slowOperationThreshold) / this.thresholds.slowOperationThreshold,
        description: `P95 latency of ${metrics.requests.p95}ms exceeds threshold of ${this.thresholds.slowOperationThreshold}ms`,
        metrics: {
          avgTime: metrics.requests.avgLatency,
          maxTime: metrics.requests.p99,
          callCount: metrics.requests.total,
          percentage: (metrics.requests.p95 / this.thresholds.slowOperationThreshold) * 100,
        },
      });
    }

    // Check error rate
    if (metrics.errors.errorRate > 0.05) {
      // 5% error rate
      bottlenecks.push({
        bottleneckId: this.generateBottleneckId(),
        type: BT.CACHE_MISS,
        location: {
          filePath: 'unknown',
          functionName: 'error_handling',
          lineNumber: 0,
        },
        severity: this.calculateSeverity(metrics.errors.errorRate, 0.05),
        impact: metrics.errors.errorRate,
        description: `Error rate of ${(metrics.errors.errorRate * 100).toFixed(2)}% is elevated`,
        metrics: {
          avgTime: 0,
          maxTime: 0,
          callCount: metrics.errors.total,
          percentage: metrics.errors.errorRate * 100,
        },
      });
    }

    // Check memory usage
    if (metrics.resources.heapUsed / metrics.resources.heapLimit > 0.9) {
      bottlenecks.push({
        bottleneckId: this.generateBottleneckId(),
        type: BT.MEMORY_ALLOCATION,
        location: {
          filePath: 'unknown',
          functionName: 'memory_allocation',
          lineNumber: 0,
        },
        severity: 'critical',
        impact: (metrics.resources.heapUsed / metrics.resources.heapLimit) * 100,
        description: `Heap usage at ${((metrics.resources.heapUsed / metrics.resources.heapLimit) * 100).toFixed(2)}%`,
        metrics: {
          avgTime: 0,
          maxTime: 0,
          callCount: 0,
          percentage: (metrics.resources.heapUsed / metrics.resources.heapLimit) * 100,
        },
      });
    }

    return bottlenecks;
  }

  /**
   * Detect slow operations
   */
  private detectSlowOperations(metrics: MetricSnapshot): SlowOperation[] {
    const operations: SlowOperation[] = [];

    // This would be populated by actual operation timing data
    // For now, return empty array

    return operations;
  }

  /**
   * Analyze memory usage
   */
  private analyzeMemory(metrics: MetricSnapshot): MemoryAnalysis {
    const heapUsed = metrics.resources.heapUsed;
    const heapLimit = metrics.resources.heapLimit;
    const percentage = (heapUsed / heapLimit) * 100;

    const memoryLeaks: MemoryLeak[] = [];

    // Detect potential memory leaks
    if (percentage > 80) {
      memoryLeaks.push({
        leakId: this.generateLeakId(),
        objectType: 'Unknown',
        size: heapUsed,
        growthRate: percentage,
        location: {
          filePath: 'unknown',
          functionName: 'unknown',
          lineNumber: 0,
        },
        confidence: 0.7,
      });
    }

    const largeAllocations: LargeAllocation[] = [];

    // Detect large allocations
    if (metrics.resources.arrayBuffers > 1024 * 1024) {
      // > 1MB
      largeAllocations.push({
        allocationId: this.generateAllocationId(),
        size: metrics.resources.arrayBuffers,
        type: 'ArrayBuffer',
        location: {
          filePath: 'unknown',
          lineNumber: 0,
        },
      });
    }

    return {
      heapUsed,
      heapLimit,
      percentage,
      memoryLeaks,
      largeAllocations,
    };
  }

  /**
   * Identify hot paths
   */
  private identifyHotPaths(metrics: MetricSnapshot): HotPath[] {
    const hotPaths: HotPath[] = [];

    // This would be populated by actual profiling data
    // For now, return empty array

    return hotPaths;
  }

  /**
   * Detect N+1 query problems
   */
  private detectNPlusOneQueries(metrics: MetricSnapshot): NPlusOneQuery[] {
    const queries: NPlusOneQuery[] = [];

    // This would be populated by actual query analysis
    // For now, return empty array

    return queries;
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizations(
    bottlenecks: Bottleneck[],
    slowOperations: SlowOperation[],
    nPlusOneQueries: NPlusOneQuery[]
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Suggest caching for slow operations
    for (const bottleneck of bottlenecks) {
      if (bottleneck.type === BT.SLOW_QUERY || bottleneck.type === BT.CACHE_MISS) {
        suggestions.push({
          suggestionId: this.generateSuggestionId(),
          type: OT.ADD_CACHE,
          description: 'Add caching to reduce repeated expensive operations',
          expectedImprovement: 0.5, // 50% improvement
          references: [
            {
              title: 'Caching Best Practices',
              url: 'https://aws.amazon.com/caching/best-practices/',
              type: 'documentation',
            },
          ],
        });
      }

      if (bottleneck.type === BT.MEMORY_ALLOCATION) {
        suggestions.push({
          suggestionId: this.generateSuggestionId(),
          type: OT.CONNECTION_POOL,
          description: 'Implement connection pooling to reduce memory overhead',
          expectedImprovement: 0.3,
          references: [],
        });
      }
    }

    // Suggest batching for N+1 queries
    for (const query of nPlusOneQueries) {
      suggestions.push({
        suggestionId: this.generateSuggestionId(),
        type: OT.BATCH_OPERATIONS,
        description: 'Batch queries to reduce round trips',
        expectedImprovement: 0.8,
        codeExample: query.suggestedFix,
        references: [
          {
            title: 'Solving N+1 Query Problems',
            url: 'https://stackoverflow.com/questions/97197/what-is-the-n1-selects-issue',
            type: 'stackoverflow',
          },
        ],
      });
    }

    return suggestions;
  }

  /**
   * Calculate severity based on threshold
   */
  private calculateSeverity(value: number, threshold: number): 'critical' | 'high' | 'medium' | 'low' {
    const ratio = value / threshold;

    if (ratio > 3) return 'critical';
    if (ratio > 2) return 'high';
    if (ratio > 1.5) return 'medium';
    return 'low';
  }

  /**
   * Add metrics snapshot for historical comparison
   */
  addSnapshot(snapshot: MetricSnapshot): void {
    this.historicalSnapshots.push(snapshot);

    // Keep only last 1000 snapshots
    if (this.historicalSnapshots.length > 1000) {
      this.historicalSnapshots.shift();
    }
  }

  /**
   * Compare current metrics with historical baseline
   */
  compareWithBaseline(current: MetricSnapshot): {
    latencyChange: number;
    errorRateChange: number;
    memoryChange: number;
    isRegression: boolean;
  } {
    if (this.historicalSnapshots.length === 0) {
      return {
        latencyChange: 0,
        errorRateChange: 0,
        memoryChange: 0,
        isRegression: false,
      };
    }

    // Calculate baseline from last 100 snapshots
    const baselineCount = Math.min(100, this.historicalSnapshots.length);
    const baseline = this.historicalSnapshots.slice(-baselineCount);

    const avgBaselineLatency =
      baseline.reduce((sum, s) => sum + s.requests.avgLatency, 0) / baseline.length;
    const avgBaselineErrorRate =
      baseline.reduce((sum, s) => sum + s.errors.errorRate, 0) / baseline.length;
    const avgBaselineMemory =
      baseline.reduce((sum, s) => sum + s.resources.heapUsed, 0) / baseline.length;

    const latencyChange = ((current.requests.avgLatency - avgBaselineLatency) / avgBaselineLatency) * 100;
    const errorRateChange = ((current.errors.errorRate - avgBaselineErrorRate) / (avgBaselineErrorRate || 0.01)) * 100;
    const memoryChange = ((current.resources.heapUsed - avgBaselineMemory) / avgBaselineMemory) * 100;

    // Detect regression (significant degradation)
    const isRegression =
      latencyChange > 50 ||
      errorRateChange > 100 ||
      memoryChange > 50;

    return {
      latencyChange,
      errorRateChange,
      memoryChange,
      isRegression,
    };
  }

  /**
   * Generate analysis ID
   */
  private generateAnalysisId(): string {
    return `perf_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate bottleneck ID
   */
  private generateBottleneckId(): string {
    return `bottleneck_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate leak ID
   */
  private generateLeakId(): string {
    return `leak_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate allocation ID
   */
  private generateAllocationId(): string {
    return `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate suggestion ID
   */
  private generateSuggestionId(): string {
    return `opt_suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// ANOMALY DETECTOR
// ============================================================================

export class AnomalyDetector {
  private baseline: Map<string, number[]> = new Map();
  private readonly baselineSize = 100;
  private readonly threshold = 2.5; // Z-score threshold

  /**
   * Train the detector with baseline data
   */
  train(metrics: Map<string, number>): void {
    for (const [key, value] of metrics.entries()) {
      if (!this.baseline.has(key)) {
        this.baseline.set(key, []);
      }

      const values = this.baseline.get(key)!;
      values.push(value);

      // Keep only baselineSize values
      if (values.length > this.baselineSize) {
        values.shift();
      }
    }
  }

  /**
   * Detect anomalies in current metrics
   */
  detect(metrics: Map<string, number>): Array<{
    metric: string;
    currentValue: number;
    expectedValue: number;
    deviation: number;
    zScore: number;
    isAnomaly: boolean;
  }> {
    const results: Array<{
      metric: string;
      currentValue: number;
      expectedValue: number;
      deviation: number;
      zScore: number;
      isAnomaly: boolean;
    }> = [];

    for (const [key, value] of metrics.entries()) {
      const baseline = this.baseline.get(key);

      if (!baseline || baseline.length < 10) {
        // Not enough baseline data
        continue;
      }

      const mean = baseline.reduce((sum, v) => sum + v, 0) / baseline.length;
      const variance = baseline.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / baseline.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev === 0) {
        // No variance, can't detect anomalies
        continue;
      }

      const zScore = (value - mean) / stdDev;
      const deviation = Math.abs(value - mean);
      const expectedValue = mean;

      results.push({
        metric: key,
        currentValue: value,
        expectedValue,
        deviation,
        zScore,
        isAnomaly: Math.abs(zScore) > this.threshold,
      });
    }

    return results;
  }

  /**
   * Get statistics for a metric
   */
  getStats(metric: string): {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    count: number;
  } | null {
    const baseline = this.baseline.get(metric);

    if (!baseline || baseline.length === 0) {
      return null;
    }

    const mean = baseline.reduce((sum, v) => sum + v, 0) / baseline.length;
    const variance = baseline.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / baseline.length;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...baseline);
    const max = Math.max(...baseline);

    return {
      mean,
      stdDev,
      min,
      max,
      count: baseline.length,
    };
  }

  /**
   * Clear baseline data
   */
  clear(): void {
    this.baseline.clear();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create performance analyzer
 */
export function createPerformanceAnalyzer(
  thresholds?: Partial<PerformanceThresholds>
): PerformanceAnalyzer {
  return new PerformanceAnalyzer(thresholds);
}

/**
 * Create anomaly detector
 */
export function createAnomalyDetector(): AnomalyDetector {
  return new AnomalyDetector();
}

/**
 * Detect performance anomalies (convenience function)
 */
export function detectAnomalies(
  detector: AnomalyDetector,
  metrics: Map<string, number>
): Array<{
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  zScore: number;
  isAnomaly: boolean;
}> {
  return detector.detect(metrics);
}
