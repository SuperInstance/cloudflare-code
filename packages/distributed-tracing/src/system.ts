/**
 * Distributed Tracing System - Optimized
 */

import { TraceCollector } from './collector';
import { TraceAggregator } from './aggregation';
import { TraceAnalyzer } from './analyzer';
import { DependencyMapper } from './dependency';
import { MemoryStorage } from './storage/memory.storage';
import { GraphVisualizer } from './visualization';

export class DistributedTracing {
  public readonly collector: TraceCollector;
  public readonly aggregator: TraceAggregator;
  public readonly analyzer: TraceAnalyzer;
  public readonly dependencyMapper: DependencyMapper;
  public readonly storage: MemoryStorage;
  public readonly visualizer: GraphVisualizer;

  constructor(config: any = {}) {
    this.storage = new MemoryStorage(config.storage || {});
    this.collector = new TraceCollector(config.collector || {});
    this.aggregator = new TraceAggregator(config.aggregator || {});
    this.analyzer = new TraceAnalyzer(config.analyzer || {});
    this.dependencyMapper = new DependencyMapper();
    this.visualizer = new GraphVisualizer();

    // Wire up event handlers
    this.collector.on('span:collected', async (span: any) => await this.aggregator.addSpan(span));
    this.aggregator.on('trace:aggregated', async (trace: any) => {
      await this.storage.putTrace(trace.traceId, trace);
      this.dependencyMapper.processTrace(trace);
    });
  }

  async processSpan(span: any): Promise<any> {
    await this.collector.collect(span);
    return { success: true };
  }

  async getTraceAnalysis(traceId: string): Promise<any> {
    const trace = await this.storage.getTrace(traceId);
    if (!trace) throw new Error(`Trace not found: ${traceId}`);
    return await this.analyzer.analyze(trace);
  }

  getDependencyGraph(): any {
    return this.dependencyMapper.buildGraph();
  }

  async shutdown(): Promise<void> {
    await this.collector.shutdown();
    await this.aggregator.shutdown();
  }

  getStats(): any {
    return {
      collector: this.collector.getStats(),
      aggregator: this.aggregator.getStats(),
      analyzer: this.analyzer.getStats(),
      storage: this.storage.getStats(),
      dependency: this.dependencyMapper.getStats()
    };
  }
}

export function createDistributedTracing(config: any = {}): DistributedTracing {
  return new DistributedTracing(config);
}
