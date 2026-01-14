/**
 * Log Correlation Engine
 *
 * Advanced log correlation system for distributed systems debugging.
 * Features:
 * - Trace ID following across services
 * - Request/response matching
 * - Cross-service correlation
 * - Timeline reconstruction
 * - Causal relationship inference
 *
 * Integrates with:
 * - OpenTelemetry tracing for distributed trace context
 * - Error analyzer for error-log correlation
 * - Monitoring system for metrics correlation
 */

import type {
  LogEntry,
  CorrelatedLog,
  LogTimeline,
  CrossServiceCorrelation,
  ServiceCallGraph,
  ServiceNode,
  ServiceEdge,
  ErrorInfo,
  StackFrame,
  LogLevel,
} from './types';

// ============================================================================
// CORRELATION CONFIGURATION
// ============================================================================

interface CorrelationConfig {
  /** Time window for correlation (ms) */
  timeWindow: number;
  /** Maximum distance between logs */
  maxDistance: number;
  /** Similarity threshold for correlation */
  similarityThreshold: number;
  /** Whether to include debug logs */
  includeDebugLogs: boolean;
  /** Maximum logs to process */
  maxLogs: number;
}

const DEFAULT_CONFIG: CorrelationConfig = {
  timeWindow: 60000, // 1 minute
  maxDistance: 5,
  similarityThreshold: 0.5,
  includeDebugLogs: false,
  maxLogs: 10000,
};

// ============================================================================
// LOG CORRELATION ENGINE
// ============================================================================

export class LogCorrelationEngine {
  private config: CorrelationConfig;

  constructor(config: Partial<CorrelationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Correlate logs with an error
   */
  async correlateErrorLogs(
    error: ErrorInfo,
    allLogs: LogEntry[]
  ): Promise<CorrelatedLog[]> {
    // Filter logs by time window
    const windowStart = error.timestamp - this.config.timeWindow;
    const windowEnd = error.timestamp + this.config.timeWindow;

    let relevantLogs = allLogs.filter(log => {
      const inTimeWindow = log.timestamp >= windowStart && log.timestamp <= windowEnd;

      // Filter out debug logs if not included
      const levelMatch = this.config.includeDebugLogs || log.level !== 'debug';

      // Prefer logs with same trace/request ID
      const traceMatch = !error.traceId || log.traceId === error.traceId;
      const requestMatch = !error.requestId || log.requestId === error.requestId;

      return inTimeWindow && levelMatch && (traceMatch || requestMatch);
    });

    // Limit logs to process
    if (relevantLogs.length > this.config.maxLogs) {
      // Prioritize logs closer to error timestamp
      relevantLogs = relevantLogs
        .sort((a, b) => {
          const distA = Math.abs(a.timestamp - error.timestamp);
          const distB = Math.abs(b.timestamp - error.timestamp);
          return distA - distB;
        })
        .slice(0, this.config.maxLogs);
    }

    // Calculate correlation scores
    const correlatedLogs = relevantLogs.map(log => {
      const score = this.calculateCorrelationScore(error, log);
      const timeOffset = log.timestamp - error.timestamp;

      return {
        ...log,
        correlationScore: score,
        timeOffset,
        isLikelyCause: timeOffset < 0 && Math.abs(timeOffset) < 5000 && score > 0.7,
        errorInfo: score > 0.8 ? error : undefined,
      };
    });

    // Sort by correlation score
    return correlatedLogs.sort((a, b) => b.correlationScore - a.correlationScore);
  }

  /**
   * Reconstruct timeline from logs
   */
  async reconstructTimeline(
    error: ErrorInfo,
    logs: LogEntry[]
  ): Promise<LogTimeline> {
    const correlatedLogs = await this.correlateErrorLogs(error, logs);

    // Sort chronologically
    const sortedLogs = correlatedLogs.sort((a, b) => a.timestamp - b.timestamp);

    const services = [...new Set(sortedLogs.map(log => log.source))];

    const levelCounts: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      critical: 0,
    };

    for (const log of sortedLogs) {
      levelCounts[log.level]++;
    }

    // Identify key events
    const keyEvents = sortedLogs.filter(
      log => log.level === 'error' || log.level === 'critical' || log.level === 'warn'
    );

    // Identify potential causes (before error)
    const potentialCauses = sortedLogs.filter(
      log => log.timeOffset < 0 && log.isLikelyCause
    );

    // Identify consequences (after error)
    const consequences = sortedLogs.filter(
      log => log.timeOffset > 0 && log.correlationScore > 0.6
    );

    const startTime = sortedLogs[0]?.timestamp || error.timestamp;
    const endTime = sortedLogs[sortedLogs.length - 1]?.timestamp || error.timestamp;

    return {
      timelineId: this.generateTimelineId(),
      error,
      logs: sortedLogs,
      startTime,
      endTime,
      duration: endTime - startTime,
      services,
      levelCounts,
      keyEvents,
      potentialCauses,
      consequences,
    };
  }

  /**
   * Perform cross-service correlation
   */
  async correlateCrossService(
    traceId: string,
    allLogs: LogEntry[]
  ): Promise<CrossServiceCorrelation> {
    // Get all logs for this trace
    const traceLogs = allLogs.filter(log => log.traceId === traceId);

    if (traceLogs.length === 0) {
      throw new Error(`No logs found for trace ID: ${traceId}`);
    }

    // Group logs by service
    const serviceLogs = new Map<string, LogEntry[]>();
    for (const log of traceLogs) {
      if (!serviceLogs.has(log.source)) {
        serviceLogs.set(log.source, []);
      }
      serviceLogs.get(log.source)!.push(log);
    }

    const services = Array.from(serviceLogs.keys());

    // Build call graph
    const callGraph = this.buildCallGraph(traceLogs);

    // Reconstruct timeline
    const sortedLogs = traceLogs.sort((a, b) => a.timestamp - b.timestamp);
    const startTime = sortedLogs[0].timestamp;
    const endTime = sortedLogs[sortedLogs.length - 1].timestamp;

    // Create a mock error for timeline
    const mockError: ErrorInfo = {
      errorId: `trace_${traceId}`,
      errorType: 'TraceAnalysis',
      message: `Cross-service trace analysis for ${traceId}`,
      stackTrace: '',
      timestamp: (startTime + endTime) / 2,
      source: 'multiple',
      severity: 'medium',
      category: 'runtime' as any,
      recoverable: true,
      context: {},
    };

    const timeline = await this.reconstructTimeline(mockError, traceLogs);

    // Identify propagation path
    const propagationPath = this.identifyPropagationPath(callGraph);

    return {
      correlationId: this.generateCorrelationId(),
      traceId,
      services,
      serviceLogs,
      callGraph,
      timeline,
      propagationPath,
    };
  }

  /**
   * Follow trace ID through services
   */
  async followTrace(
    traceId: string,
    logs: LogEntry[]
  ): Promise<Map<string, LogEntry[]>> {
    const traceLogs = logs.filter(log => log.traceId === traceId);
    const serviceLogs = new Map<string, LogEntry[]>();

    for (const log of traceLogs) {
      const service = log.source;
      if (!serviceLogs.has(service)) {
        serviceLogs.set(service, []);
      }
      serviceLogs.get(service)!.push(log);
    }

    return serviceLogs;
  }

  /**
   * Match requests with responses
   */
  matchRequestResponse(logs: LogEntry[]): Array<{
    request: LogEntry;
    response: LogEntry;
    duration: number;
  }> {
    const matches: Array<{
      request: LogEntry;
      response: LogEntry;
      duration: number;
    }> = [];

    const requestLogs = logs.filter(log =>
      log.message.toLowerCase().includes('request') ||
      log.metadata.method
    );

    for (const request of requestLogs) {
      const requestId = request.requestId || request.metadata.requestId;
      if (!requestId) continue;

      // Find corresponding response
      const response = logs.find(log =>
        (log.requestId === requestId || log.metadata.requestId === requestId) &&
        (log.message.toLowerCase().includes('response') ||
         log.metadata.statusCode !== undefined) &&
        log.timestamp > request.timestamp
      );

      if (response) {
        matches.push({
          request,
          response,
          duration: response.timestamp - request.timestamp,
        });
      }
    }

    return matches.sort((a, b) => b.duration - a.duration);
  }

  /**
   * Calculate correlation score between error and log
   */
  private calculateCorrelationScore(error: ErrorInfo, log: LogEntry): number {
    let score = 0;

    // Same trace ID (strong signal)
    if (error.traceId && log.traceId === error.traceId) {
      score += 0.5;
    }

    // Same request ID (strong signal)
    if (error.requestId && log.requestId === error.requestId) {
      score += 0.4;
    }

    // Same user ID
    if (error.userId && log.userId === error.userId) {
      score += 0.1;
    }

    // Same service
    if (error.source === log.source) {
      score += 0.15;
    }

    // Same error type
    if (log.message.includes(error.errorType)) {
      score += 0.2;
    }

    // Error/critical logs
    if (log.level === 'error' || log.level === 'critical') {
      score += 0.15;
    }

    // Temporal proximity (exponential decay)
    const timeDiff = Math.abs(log.timestamp - error.timestamp);
    const timeScore = Math.exp(-timeDiff / 10000); // 10 second half-life
    score += timeScore * 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Build service call graph from logs
   */
  private buildCallGraph(logs: LogEntry[]): ServiceCallGraph {
    const nodes = new Map<string, ServiceNode>();
    const edges = new Map<string, ServiceEdge>();

    // Count service metrics
    for (const log of logs) {
      const service = log.source;

      if (!nodes.has(service)) {
        nodes.set(service, {
          service,
          errorCount: 0,
          requestCount: 0,
          avgLatency: 0,
        });
      }

      const node = nodes.get(service)!;

      if (log.level === 'error' || log.level === 'critical') {
        node.errorCount++;
      }

      if (log.metadata.method) {
        node.requestCount++;
      }

      // Extract latency from metadata
      if (log.metadata.duration) {
        node.avgLatency =
          (node.avgLatency * (node.requestCount - 1) + log.metadata.duration) /
          node.requestCount;
      }
    }

    // Identify service relationships from span parentage
    for (const log of logs) {
      if (log.parentSpanId && log.spanId) {
        const from = log.source;
        const to = logs.find(l => l.spanId === log.parentSpanId)?.source;

        if (to && to !== from) {
          const edgeKey = `${from}->${to}`;

          if (!edges.has(edgeKey)) {
            edges.set(edgeKey, {
              from,
              to,
              callCount: 0,
              errorRate: 0,
            });
          }

          const edge = edges.get(edgeKey)!;
          edge.callCount++;

          if (log.level === 'error') {
            edge.errorRate = edge.errorRate * 0.9 + 0.1;
          }
        }
      }
    }

    return {
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values()),
    };
  }

  /**
   * Identify error propagation path
   */
  private identifyPropagationPath(callGraph: ServiceCallGraph): string[] {
    const path: string[] = [];

    // Build adjacency list
    const adjacency = new Map<string, string[]>();
    for (const edge of callGraph.edges) {
      if (!adjacency.has(edge.from)) {
        adjacency.set(edge.from, []);
      }
      adjacency.get(edge.from)!.push(edge.to);
    }

    // Find service with most errors (likely origin)
    const errorServices = callGraph.nodes
      .filter(n => n.errorCount > 0)
      .sort((a, b) => b.errorCount - a.errorCount);

    if (errorServices.length === 0) {
      return [];
    }

    // Start from service with most errors
    const start = errorServices[0].service;
    path.push(start);

    // Follow call chain
    let current = start;
    const visited = new Set<string>([current]);

    while (true) {
      const neighbors = adjacency.get(current) || [];

      // Find unvisited neighbor
      const next = neighbors.find(n => !visited.has(n));
      if (!next) break;

      path.push(next);
      visited.add(next);
      current = next;
    }

    return path;
  }

  /**
   * Generate timeline ID
   */
  private generateTimelineId(): string {
    return `timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract trace ID from log
   */
  static extractTraceId(log: LogEntry): string | undefined {
    return log.traceId || log.metadata.traceId;
  }

  /**
   * Extract request ID from log
   */
  static extractRequestId(log: LogEntry): string | undefined {
    return log.requestId || log.metadata.requestId;
  }

  /**
   * Extract span ID from log
   */
  static extractSpanId(log: LogEntry): string | undefined {
    return log.spanId || log.metadata.spanId;
  }
}

// ============================================================================
// LOG AGGREGATOR
// ============================================================================

export class LogAggregator {
  /**
   * Aggregate logs by time window
   */
  aggregateByTimeWindow(
    logs: LogEntry[],
    windowSize: number
  ): Map<number, LogEntry[]> {
    const windows = new Map<number, LogEntry[]>();

    for (const log of logs) {
      const windowKey = Math.floor(log.timestamp / windowSize) * windowSize;

      if (!windows.has(windowKey)) {
        windows.set(windowKey, []);
      }

      windows.get(windowKey)!.push(log);
    }

    return windows;
  }

  /**
   * Aggregate logs by level
   */
  aggregateByLevel(logs: LogEntry[]): Map<LogLevel, LogEntry[]> {
    const byLevel = new Map<LogLevel, LogEntry[]>();

    for (const log of logs) {
      if (!byLevel.has(log.level)) {
        byLevel.set(log.level, []);
      }

      byLevel.get(log.level)!.push(log);
    }

    return byLevel;
  }

  /**
   * Aggregate logs by service
   */
  aggregateByService(logs: LogEntry[]): Map<string, LogEntry[]> {
    const byService = new Map<string, LogEntry[]>();

    for (const log of logs) {
      if (!byService.has(log.source)) {
        byService.set(log.source, []);
      }

      byService.get(log.source)!.push(log);
    }

    return byService;
  }

  /**
   * Calculate log statistics
   */
  calculateStatistics(logs: LogEntry[]): {
    total: number;
    byLevel: Record<LogLevel, number>;
    byService: Record<string, number>;
    timeRange: { start: number; end: number; duration: number };
    errorRate: number;
    avgLogsPerSecond: number;
  } {
    if (logs.length === 0) {
      return {
        total: 0,
        byLevel: { debug: 0, info: 0, warn: 0, error: 0, critical: 0 },
        byService: {},
        timeRange: { start: 0, end: 0, duration: 0 },
        errorRate: 0,
        avgLogsPerSecond: 0,
      };
    }

    const byLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      critical: 0,
    };

    const byService: Record<string, number> = {};

    for (const log of logs) {
      byLevel[log.level]++;
      byService[log.source] = (byService[log.source] || 0) + 1;
    }

    const timestamps = logs.map(l => l.timestamp).sort((a, b) => a - b);
    const start = timestamps[0];
    const end = timestamps[timestamps.length - 1];
    const duration = end - start;

    const errorCount = byLevel.error + byLevel.critical;
    const errorRate = errorCount / logs.length;
    const avgLogsPerSecond = logs.length / (duration / 1000);

    return {
      total: logs.length,
      byLevel,
      byService,
      timeRange: { start, end, duration },
      errorRate,
      avgLogsPerSecond,
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a log correlation engine
 */
export function createLogCorrelationEngine(
  config?: Partial<CorrelationConfig>
): LogCorrelationEngine {
  return new LogCorrelationEngine(config);
}

/**
 * Correlate logs with error (convenience function)
 */
export async function correlateLogs(
  error: ErrorInfo,
  logs: LogEntry[],
  config?: Partial<CorrelationConfig>
): Promise<CorrelatedLog[]> {
  const engine = new LogCorrelationEngine(config);
  return engine.correlateErrorLogs(error, logs);
}

/**
 * Reconstruct timeline (convenience function)
 */
export async function reconstructLogTimeline(
  error: ErrorInfo,
  logs: LogEntry[]
): Promise<LogTimeline> {
  const engine = new LogCorrelationEngine();
  return engine.reconstructTimeline(error, logs);
}

/**
 * Perform cross-service correlation (convenience function)
 */
export async function correlateCrossServiceLogs(
  traceId: string,
  logs: LogEntry[]
): Promise<CrossServiceCorrelation> {
  const engine = new LogCorrelationEngine();
  return engine.correlateCrossService(traceId, logs);
}
