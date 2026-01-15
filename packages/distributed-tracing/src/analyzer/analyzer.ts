/**
 * Trace Analyzer - Advanced trace analysis and insights
 * Provides latency analysis, error analysis, critical path detection, and bottleneck identification
 */

import { EventEmitter } from 'eventemitter3';

import {
  Trace,
  Span,
  TraceId,
  SpanId,
  Duration,
  AnalysisOptions,
  TraceAnalysis,
  Bottleneck,
  CriticalPath,
  CriticalPathStep,
  ErrorAnalysis,
  ErrorPattern,
  RootCause,
  LatencyAnalysis,
  SlowOperation,
  TimeDistribution,
  PerformanceInsight,
  AnalysisStats,
} from '../types/trace.types';
import { hasErrors, getErrorSpans } from '../utils/validation.utils';
import { calculateDurationStatistics, calculatePercentile } from '../utils/time.utils';

/**
 * Default analysis options
 */
const DEFAULT_OPTIONS: Required<AnalysisOptions> = {
  includeBottlenecks: true,
  includeCriticalPath: true,
  includeErrorAnalysis: true,
  includeLatencyAnalysis: true,
  includePerformanceInsights: true,
  bottleneckThreshold: 0.5, // 50% of parent duration
  slowOperationThreshold: 1000000, // 1 second
  outlierThreshold: 3, // 3 standard deviations
};

/**
 * Path node for critical path calculation
 */
interface PathNode {
  span: Span;
  children: PathNode[];
  duration: Duration;
  pathDuration: Duration;
}

/**
 * Trace Analyzer class
 */
export class TraceAnalyzer extends EventEmitter {
  private options: Required<AnalysisOptions>;
  private stats: AnalysisStats;
  private cache: Map<TraceId, TraceAnalysis>;

  constructor(options: AnalysisOptions = {}) {
    super();

    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.stats = {
      tracesAnalyzed: 0,
      avgAnalysisTime: 0,
      bottlenecksFound: 0,
      errorsAnalyzed: 0,
      insightsGenerated: 0,
    };
    this.cache = new Map();
  }

  /**
   * Analyze a trace
   */
  async analyze(trace: Trace): Promise<TraceAnalysis> {
    const startTime = Date.now();

    // Check cache
    if (this.cache.has(trace.traceId)) {
      return this.cache.get(trace.traceId)!;
    }

    const analysis: TraceAnalysis = {
      bottlenecks: this.options.includeBottlenecks ? this.findBottlenecks(trace) : [],
      criticalPath: this.options.includeCriticalPath ? this.findCriticalPath(trace) : this.emptyCriticalPath(),
      errorAnalysis: this.options.includeErrorAnalysis ? this.analyzeErrors(trace) : this.emptyErrorAnalysis(),
      latencyAnalysis: this.options.includeLatencyAnalysis ? this.analyzeLatency(trace) : this.emptyLatencyAnalysis(),
      performanceInsights: this.options.includePerformanceInsights
        ? this.generatePerformanceInsights(trace)
        : [],
    };

    // Update stats
    const analysisTime = Date.now() - startTime;
    this.updateAnalysisTime(analysisTime);
    this.stats.tracesAnalyzed++;
    this.stats.bottlenecksFound += analysis.bottlenecks.length;
    this.stats.errorsAnalyzed += analysis.errorAnalysis.totalErrors;
    this.stats.insightsGenerated += analysis.performanceInsights.length;

    // Cache result
    this.cache.set(trace.traceId, analysis);

    this.emit('trace:analyzed', { traceId: trace.traceId, analysis });

    return analysis;
  }

  /**
   * Analyze multiple traces
   */
  async analyzeBatch(traces: Trace[]): Promise<Map<TraceId, TraceAnalysis>> {
    const results = new Map<TraceId, TraceAnalysis>();

    for (const trace of traces) {
      const analysis = await this.analyze(trace);
      results.set(trace.traceId, analysis);
    }

    return results;
  }

  /**
   * Find bottlenecks in trace
   */
  private findBottlenecks(trace: Trace): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    const spanMap = new Map<SpanId, Span>();

    // Build span map
    for (const span of trace.spans) {
      spanMap.set(span.spanId, span);
    }

    // Analyze each span
    for (const span of trace.spans) {
      // Skip root span
      if (!span.parentSpanId) {
        continue;
      }

      const parent = spanMap.get(span.parentSpanId);
      if (!parent) {
        continue;
      }

      // Get siblings
      const siblings = trace.spans.filter(
        (s) => s.parentSpanId === span.parentSpanId && s.spanId !== span.spanId
      );

      // Calculate total duration of parent and children
      const parentDuration = parent.duration || 0;
      const spanDuration = span.duration || 0;
      const childrenDuration = siblings.reduce((sum, s) => sum + (s.duration || 0), 0) + spanDuration;

      // Detect sequential bottleneck
      if (spanDuration > parentDuration * this.options.bottleneckThreshold) {
        const severity = this.calculateBottleneckSeverity(spanDuration, parentDuration);
        bottlenecks.push({
          spanId: span.spanId,
          spanName: span.name,
          service: span.service,
          severity,
          reason: `Span takes ${((spanDuration / parentDuration) * 100).toFixed(1)}% of parent duration`,
          impact: spanDuration / parentDuration,
          suggestions: this.generateBottleneckSuggestions(span),
        });
      }

      // Detect slow operation
      if (spanDuration > this.options.slowOperationThreshold) {
        bottlenecks.push({
          spanId: span.spanId,
          spanName: span.name,
          service: span.service,
          severity: 'high',
          reason: `Operation took ${this.formatDuration(spanDuration)}`,
          impact: spanDuration / trace.duration,
          suggestions: this.generateSlowOperationSuggestions(span),
        });
      }

      // Detect error bottleneck
      if (hasErrors(span)) {
        bottlenecks.push({
          spanId: span.spanId,
          spanName: span.name,
          service: span.service,
          severity: 'critical',
          reason: `Span failed with error: ${span.status?.message || 'Unknown error'}`,
          impact: 1.0,
          suggestions: this.generateErrorSuggestions(span),
        });
      }
    }

    // Sort by impact
    return bottlenecks.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Find critical path through trace
   */
  private findCriticalPath(trace: Trace): CriticalPath {
    // Build span tree
    const spanMap = new Map<SpanId, PathNode>();
    const rootNodes: PathNode[] = [];

    for (const span of trace.spans) {
      const node: PathNode = {
        span,
        children: [],
        duration: span.duration || 0,
        pathDuration: 0,
      };
      spanMap.set(span.spanId, node);

      if (!span.parentSpanId) {
        rootNodes.push(node);
      }
    }

    // Link children
    for (const node of spanMap.values()) {
      if (node.span.parentSpanId) {
        const parent = spanMap.get(node.span.parentSpanId);
        if (parent) {
          parent.children.push(node);
        }
      }
    }

    // Calculate path durations
    for (const node of rootNodes) {
      this.calculatePathDuration(node);
    }

    // Find longest path
    let longestPath: PathNode | null = null;
    let maxDuration = 0;

    for (const node of rootNodes) {
      if (node.pathDuration > maxDuration) {
        maxDuration = node.pathDuration;
        longestPath = node;
      }
    }

    // Extract path
    const path = this.extractPath(longestPath!);

    return {
      spans: path.map((n) => n.span.spanId),
      totalDuration: maxDuration,
      pathPercentage: (maxDuration / trace.duration) * 100,
      steps: path.map((node) => ({
        spanId: node.span.spanId,
        spanName: node.span.name,
        duration: node.span.duration || 0,
        percentage: (node.span.duration! / maxDuration) * 100,
        service: node.span.service,
      })),
    };
  }

  /**
   * Calculate path duration for a node
   */
  private calculatePathDuration(node: PathNode): Duration {
    if (node.children.length === 0) {
      node.pathDuration = node.duration;
      return node.pathDuration;
    }

    let maxChildDuration = 0;
    for (const child of node.children) {
      const childDuration = this.calculatePathDuration(child);
      maxChildDuration = Math.max(maxChildDuration, childDuration);
    }

    node.pathDuration = node.duration + maxChildDuration;
    return node.pathDuration;
  }

  /**
   * Extract path from node
   */
  private extractPath(node: PathNode): PathNode[] {
    const path: PathNode[] = [node];

    // Find child on longest path
    if (node.children.length > 0) {
      let longestChild: PathNode | null = null;
      let maxDuration = 0;

      for (const child of node.children) {
        if (child.pathDuration > maxDuration) {
          maxDuration = child.pathDuration;
          longestChild = child;
        }
      }

      if (longestChild) {
        path.push(...this.extractPath(longestChild));
      }
    }

    return path;
  }

  /**
   * Analyze errors in trace
   */
  private analyzeErrors(trace: Trace): ErrorAnalysis {
    const errorSpans = getErrorSpans(trace);

    // Group errors by type and message
    const errorGroups = new Map<string, Span[]>();
    for (const span of errorSpans) {
      const key = `${span.status?.code || 'ERROR'}:${span.status?.message || 'Unknown'}`;
      if (!errorGroups.has(key)) {
        errorGroups.set(key, []);
      }
      errorGroups.get(key)!.push(span);
    }

    // Create error patterns
    const patterns: ErrorPattern[] = [];
    for (const [key, spans] of errorGroups) {
      const [code, message] = key.split(':');
      patterns.push({
        type: code,
        message,
        count: spans.length,
        affectedSpans: spans.map((s) => s.spanId),
        service: spans[0].service,
      });
    }

    // Analyze root causes
    const rootCauses = this.identifyRootCauses(errorSpans, trace);

    return {
      totalErrors: errorSpans.length,
      errorRate: errorSpans.length / trace.spans.length,
      errorSpans,
      errorPatterns: patterns.sort((a, b) => b.count - a.count),
      rootCauses,
    };
  }

  /**
   * Identify root causes of errors
   */
  private identifyRootCauses(errorSpans: Span[], trace: Trace): RootCause[] {
    const rootCauses: RootCause[] = [];
    const spanMap = new Map(errorSpans.map((s) => [s.spanId, s]));

    // Find errors without error parents (root causes)
    for (const span of errorSpans) {
      const isRootCause = !span.parentSpanId || !spanMap.has(span.parentSpanId);

      if (isRootCause) {
        rootCauses.push({
          description: `Error in ${span.service}: ${span.name}`,
          confidence: this.calculateRootCauseConfidence(span, trace),
          spanId: span.spanId,
          evidence: this.gatherEvidence(span, trace),
        });
      }
    }

    return rootCauses.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate root cause confidence
   */
  private calculateRootCauseConfidence(span: Span, trace: Trace): number {
    let confidence = 0.5;

    // Higher confidence if it's early in the trace
    const position = (span.startTime - trace.startTime) / trace.duration;
    confidence += (1 - position) * 0.3;

    // Higher confidence if it has many error descendants
    const errorDescendants = trace.spans.filter(
      (s) => s.spanId.startsWith(span.spanId) && hasErrors(s)
    ).length;
    confidence += Math.min(errorDescendants * 0.1, 0.2);

    return Math.min(confidence, 1.0);
  }

  /**
   * Gather evidence for root cause
   */
  private gatherEvidence(span: Span, trace: Trace): string[] {
    const evidence: string[] = [];

    evidence.push(`Service: ${span.service}`);
    evidence.push(`Operation: ${span.name}`);
    if (span.status?.message) {
      evidence.push(`Error: ${span.status.message}`);
    }

    // Check attributes for clues
    if (span.attributes) {
      for (const [key, value] of Object.entries(span.attributes)) {
        if (key.toLowerCase().includes('error') || key.toLowerCase().includes('exception')) {
          evidence.push(`${key}: ${value}`);
        }
      }
    }

    return evidence;
  }

  /**
   * Analyze latency in trace
   */
  private analyzeLatency(trace: Trace): LatencyAnalysis {
    const durations = trace.spans.map((s) => s.duration || 0);
    const stats = calculateDurationStatistics(durations);

    // Detect outliers
    const outliers = this.detectOutliers(trace, stats);

    // Find slow operations
    const slowOperations = this.findSlowOperations(trace);

    // Create time distribution
    const timeDistribution = this.createTimeDistribution(durations);

    return {
      percentiles: {
        p50: stats.p50,
        p75: stats.p75,
        p90: stats.p90,
        p95: stats.p95,
        p99: stats.p99,
        p999: stats.p999,
      },
      outliers,
      slowOperations,
      timeDistribution,
    };
  }

  /**
   * Detect outliers in trace
   */
  private detectOutliers(trace: Trace, stats: any): Span[] {
    const threshold = stats.avg + stats.stdDev * this.options.outlierThreshold;
    return trace.spans.filter((s) => (s.duration || 0) > threshold);
  }

  /**
   * Find slow operations
   */
  private findSlowOperations(trace: Trace): SlowOperation[] {
    const avgServiceDurations = new Map<string, Duration>();

    // Calculate average duration per service
    for (const span of trace.spans) {
      if (!avgServiceDurations.has(span.service)) {
        avgServiceDurations.set(span.service, 0);
      }
      avgServiceDurations.set(span.service, avgServiceDurations.get(span.service)! + (span.duration || 0));
    }

    for (const [service, total] of avgServiceDurations) {
      const count = trace.spans.filter((s) => s.service === service).length;
      avgServiceDurations.set(service, total / count);
    }

    // Find operations slower than expected
    const slowOps: SlowOperation[] = [];
    for (const span of trace.spans) {
      const expectedDuration = avgServiceDurations.get(span.service)!;
      const actualDuration = span.duration || 0;

      if (actualDuration > expectedDuration * 2) {
        slowOps.push({
          spanId: span.spanId,
          spanName: span.name,
          service: span.service,
          duration: actualDuration,
          expectedDuration,
          slownessFactor: actualDuration / expectedDuration,
        });
      }
    }

    return slowOps.sort((a, b) => b.slownessFactor - a.slownessFactor);
  }

  /**
   * Create time distribution
   */
  private createTimeDistribution(durations: Duration[]): TimeDistribution[] {
    const stats = calculateDurationStatistics(durations);
    const bucketCount = 10;
    const bucketSize = (stats.max - stats.min) / bucketCount;

    const distribution: TimeDistribution[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const min = stats.min + i * bucketSize;
      const max = i === bucketCount - 1 ? stats.max : min + bucketSize;

      const count = durations.filter((d) => d >= min && (i === bucketCount - 1 ? d <= max : d < max))
        .length;

      distribution.push({
        range: [min, max],
        count,
        percentage: (count / durations.length) * 100,
      });
    }

    return distribution;
  }

  /**
   * Generate performance insights
   */
  private generatePerformanceInsights(trace: Trace): PerformanceInsight[] {
    const insights: PerformanceInsight[] = [];

    // Check error rate
    const errorRate = trace.spans.filter(hasErrors).length / trace.spans.length;
    if (errorRate > 0.05) {
      insights.push({
        type: 'warning',
        category: 'reliability',
        title: 'High Error Rate',
        description: `Trace has ${((errorRate * 100).toFixed(1))}% error rate`,
        impact: errorRate > 0.1 ? 'high' : 'medium',
        recommendations: [
          'Review error logs for common patterns',
          'Check service health',
          'Verify service dependencies',
        ],
      });
    }

    // Check trace duration
    if (trace.duration > 5000000) {
      // 5 seconds
      insights.push({
        type: 'warning',
        category: 'latency',
        title: 'Long Trace Duration',
        description: `Trace took ${this.formatDuration(trace.duration)}`,
        impact: 'medium',
        recommendations: [
          'Review critical path',
          'Consider parallelizing operations',
          'Check for bottlenecks',
        ],
      });
    }

    // Check span count
    if (trace.spanCount > 100) {
      insights.push({
        type: 'info',
        category: 'complexity',
        title: 'High Span Count',
        description: `Trace contains ${trace.spanCount} spans`,
        impact: 'low',
        recommendations: [
          'Consider trace sampling',
          'Review span granularity',
          'Check for redundant spans',
        ],
      });
    }

    // Check service diversity
    const uniqueServices = new Set(trace.spans.map((s) => s.service)).size;
    if (uniqueServices > 10) {
      insights.push({
        type: 'info',
        category: 'architecture',
        title: 'High Service Diversity',
        description: `Trace involves ${uniqueServices} services`,
        impact: 'low',
        recommendations: [
          'Review service boundaries',
          'Consider service consolidation',
          'Check for chatty services',
        ],
      });
    }

    return insights;
  }

  /**
   * Calculate bottleneck severity
   */
  private calculateBottleneckSeverity(spanDuration: Duration, parentDuration: Duration): Bottleneck['severity'] {
    const ratio = spanDuration / parentDuration;

    if (ratio > 0.9) return 'critical';
    if (ratio > 0.7) return 'high';
    if (ratio > 0.5) return 'medium';
    return 'low';
  }

  /**
   * Generate bottleneck suggestions
   */
  private generateBottleneckSuggestions(span: Span): string[] {
    const suggestions: string[] = [];

    if (span.name.includes('database') || span.name.includes('query')) {
      suggestions.push('Consider adding database indexes');
      suggestions.push('Review query execution plan');
      suggestions.push('Check for N+1 queries');
    } else if (span.name.includes('http') || span.name.includes('request')) {
      suggestions.push('Consider using HTTP/2 or gRPC');
      suggestions.push('Implement request caching');
      suggestions.push('Review network latency');
    } else {
      suggestions.push('Review operation implementation');
      suggestions.push('Check for inefficient algorithms');
      suggestions.push('Consider caching results');
    }

    return suggestions;
  }

  /**
   * Generate slow operation suggestions
   */
  private generateSlowOperationSuggestions(span: Span): string[] {
    return [
      'Consider breaking operation into smaller chunks',
      'Implement async processing',
      'Add caching',
      'Review resource utilization',
    ];
  }

  /**
   * Generate error suggestions
   */
  private generateErrorSuggestions(span: Span): string[] {
    return [
      'Review error logs',
      'Check service dependencies',
      'Implement retry logic with exponential backoff',
      'Add circuit breaker pattern',
      'Improve error handling',
    ];
  }

  /**
   * Format duration for display
   */
  private formatDuration(us: Duration): string {
    if (us < 1000) return `${us}μs`;
    if (us < 1000000) return `${(us / 1000).toFixed(2)}ms`;
    return `${(us / 1000000).toFixed(2)}s`;
  }

  /**
   * Update analysis time
   */
  private updateAnalysisTime(time: number): void {
    const count = this.stats.tracesAnalyzed;
    this.stats.avgAnalysisTime =
      (this.stats.avgAnalysisTime * (count - 1) + time) / Math.max(1, count);
  }

  /**
   * Get empty critical path
   */
  private emptyCriticalPath(): CriticalPath {
    return {
      spans: [],
      totalDuration: 0,
      pathPercentage: 0,
      steps: [],
    };
  }

  /**
   * Get empty error analysis
   */
  private emptyErrorAnalysis(): ErrorAnalysis {
    return {
      totalErrors: 0,
      errorRate: 0,
      errorSpans: [],
      errorPatterns: [],
      rootCauses: [],
    };
  }

  /**
   * Get empty latency analysis
   */
  private emptyLatencyAnalysis(): LatencyAnalysis {
    return {
      percentiles: {
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        p999: 0,
      },
      outliers: [],
      slowOperations: [],
      timeDistribution: [],
    };
  }

  /**
   * Get statistics
   */
  getStats(): AnalysisStats {
    return { ...this.stats };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      tracesAnalyzed: 0,
      avgAnalysisTime: 0,
      bottlenecksFound: 0,
      errorsAnalyzed: 0,
      insightsGenerated: 0,
    };
  }
}

export default TraceAnalyzer;
