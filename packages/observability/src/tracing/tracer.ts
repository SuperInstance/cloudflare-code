/**
 * Distributed tracer with OpenTelemetry integration
 */

import {
  trace,
  Span,
  SpanOptions,
  SpanKind,
  Context,
  Attributes,
  propagation,
  SpanStatusCode,
} from '@opentelemetry/api';
import { v4 as uuidv4 } from 'uuid';
import {
  TraceInfo,
  TraceTreeNode,
  TraceOptions,
  ServiceMap,
  ServiceMapNode,
  ServiceMapEdge,
  SpanMetadata,
} from '../types';

export class DistributedTracer {
  private spans: Map<string, SpanMetadata> = new Map();
  private childParentMap: Map<string, string> = new Map();
  private serviceDependencies: Map<string, ServiceMapNode> = new Map();
  private edges: ServiceMapEdge[] = [];

  constructor(private serviceName: string = 'unknown') {}

  /**
   * Start a new span
   */
  startSpan(
    name: string,
    options: Partial<SpanOptions> = {}
  ): { span: Span; context: TraceInfo } {
    const spanOptions: SpanOptions = {
      kind: options.kind || SpanKind.INTERNAL,
      attributes: {
        ...options.attributes,
        'service.name': this.serviceName,
      },
    };

    const span = trace.getTracer(this.serviceName).startSpan(name, spanOptions);

    const context = this.extractTraceInfo(span);

    return { span, context };
  }

  /**
   * Start a span with automatic parent context
   */
  startSpanWithContext(
    name: string,
    parentContext: Context,
    options: Partial<SpanOptions> = {}
  ): Span {
    const spanOptions: SpanOptions = {
      kind: options.kind || SpanKind.INTERNAL,
      attributes: {
        ...options.attributes,
        'service.name': this.serviceName,
      },
    };

    return trace.getTracer(this.serviceName).startSpan(name, spanOptions, parentContext);
  }

  /**
   * Extract trace information from a span
   */
  extractTraceInfo(span: Span): TraceInfo {
    const context = span.spanContext();
    return {
      traceId: context.traceId,
      spanId: context.spanId,
      sampled: context.isRemote,
    };
  }

  /**
   * Inject trace context into headers for propagation
   */
  injectContext(headers: Record<string, string>): Record<string, string> {
    const carrier: Record<string, string> = { ...headers };

    propagation.inject(trace.getSpanContext(), carrier, {
      set: (carrier, key, value) => {
        carrier[key] = value as string;
      },
    });

    return carrier;
  }

  /**
   * Extract trace context from headers
   */
  extractContext(headers: Record<string, string>): Context | null {
    try {
      const context = propagation.extract({}, headers, {
        get: (carrier, key) => {
          return carrier[key] || null;
        },
      });
      return context;
    } catch (error) {
      console.error('Failed to extract trace context:', error);
      return null;
    }
  }

  /**
   * Record a span completion
   */
  recordSpan(
    spanId: string,
    metadata: SpanMetadata,
    parentSpanId?: string
  ): void {
    this.spans.set(spanId, metadata);
    if (parentSpanId) {
      this.childParentMap.set(spanId, parentSpanId);
    }
  }

  /**
   * Build a trace tree from recorded spans
   */
  buildTraceTree(traceId: string): TraceTreeNode | null {
    const traceSpans = Array.from(this.spans.entries()).filter(
      ([_, meta]) => meta.attributes['trace.id'] === traceId
    );

    if (traceSpans.length === 0) {
      return null;
    }

    // Find root spans (spans without parents in this trace)
    const rootSpans = traceSpans.filter(([spanId]) => {
      const parentId = this.childParentMap.get(spanId);
      if (!parentId) return true;

      // Check if parent is in this trace
      const parentMeta = this.spans.get(parentId);
      return !parentMeta || parentMeta.attributes['trace.id'] !== traceId;
    });

    if (rootSpans.length === 0) {
      // Fallback: use the first span as root
      const [rootId, rootMeta] = traceSpans[0];
      return this.buildTreeNode(rootId, rootMeta, 0);
    }

    // Build tree from roots
    const trees = rootSpans.map(([rootId, rootMeta]) =>
      this.buildTreeNode(rootId, rootMeta, 0)
    );

    // Return the first tree or combine them
    return trees[0] || null;
  }

  /**
   * Recursively build a tree node
   */
  private buildTreeNode(
    spanId: string,
    metadata: SpanMetadata,
    depth: number
  ): TraceTreeNode {
    const children = Array.from(this.childParentMap.entries())
      .filter(([_, parentId]) => parentId === spanId)
      .map(([childId, _]) => {
        const childMeta = this.spans.get(childId);
        return childMeta ? this.buildTreeNode(childId, childMeta, depth + 1) : null;
      })
      .filter((node): node is TraceTreeNode => node !== null);

    return {
      span: metadata,
      children,
      depth,
    };
  }

  /**
   * Add a service dependency
   */
  addDependency(dependency: {
    serviceName: string;
    operation: string;
    latency: number;
    success: boolean;
    error?: string;
  }): void {
    const key = `${dependency.serviceName}:${dependency.operation}`;

    if (!this.serviceDependencies.has(key)) {
      this.serviceDependencies.set(key, {
        serviceName: dependency.serviceName,
        type: 'external',
        endpointCount: 0,
        errorRate: 0,
        avgLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        requestRate: 0,
      });
    }

    const node = this.serviceDependencies.get(key)!;
    node.endpointCount++;
    node.avgLatency =
      (node.avgLatency * (node.endpointCount - 1) + dependency.latency) /
      node.endpointCount;
    node.errorRate = dependency.success ? node.errorRate : node.errorRate + 1;

    // Add edge
    this.edges.push({
      from: this.serviceName,
      to: dependency.serviceName,
      requestCount: 1,
      errorCount: dependency.success ? 0 : 1,
      avgLatency: dependency.latency,
    });
  }

  /**
   * Generate service map
   */
  generateServiceMap(): ServiceMap {
    const nodes = Array.from(this.serviceDependencies.values());

    // Add current service
    nodes.unshift({
      serviceName: this.serviceName,
      type: 'service',
      endpointCount: 1,
      errorRate: 0,
      avgLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      requestRate: 0,
    });

    // Aggregate edges
    const aggregatedEdges = new Map<string, ServiceMapEdge>();
    for (const edge of this.edges) {
      const key = `${edge.from}:${edge.to}`;
      const existing = aggregatedEdges.get(key);
      if (existing) {
        existing.requestCount += edge.requestCount;
        existing.errorCount += edge.errorCount;
        existing.avgLatency =
          (existing.avgLatency * (existing.requestCount - edge.requestCount) +
            edge.avgLatency * edge.requestCount) /
          existing.requestCount;
      } else {
        aggregatedEdges.set(key, { ...edge });
      }
    }

    return {
      nodes,
      edges: Array.from(aggregatedEdges.values()),
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate latency percentiles
   */
  calculatePercentiles(latencies: number[]): {
    p50: number;
    p95: number;
    p99: number;
  } {
    if (latencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = latencies.sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    return {
      p50: getPercentile(50),
      p95: getPercentile(95),
      p99: getPercentile(99),
    };
  }

  /**
   * Get span by ID
   */
  getSpan(spanId: string): SpanMetadata | undefined {
    return this.spans.get(spanId);
  }

  /**
   * Get all spans for a trace
   */
  getTraceSpans(traceId: string): SpanMetadata[] {
    return Array.from(this.spans.values()).filter(
      (span) => span.attributes['trace.id'] === traceId
    );
  }

  /**
   * Clear recorded spans
   */
  clear(): void {
    this.spans.clear();
    this.childParentMap.clear();
  }

  /**
   * Get trace statistics
   */
  getTraceStatistics(): {
    totalSpans: number;
    totalTraces: number;
    avgSpansPerTrace: number;
  } {
    const traceIds = new Set(
      Array.from(this.spans.values()).map((span) => span.attributes['trace.id'])
    );
    const totalTraces = traceIds.size;
    const totalSpans = this.spans.size;

    return {
      totalSpans,
      totalTraces,
      avgSpansPerTrace: totalTraces > 0 ? totalSpans / totalTraces : 0,
    };
  }
}
