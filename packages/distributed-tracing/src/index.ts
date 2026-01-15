/**
 * @claudeflare/distributed-tracing
 *
 * Advanced distributed tracing system for ClaudeFlare
 * High-performance trace collection, aggregation, analysis, and visualization
 */

// Core types
export * from './types';

// Utilities
export * from './utils';

// Trace Collector
export { TraceCollector } from './collector';

// Trace Aggregator
export { TraceAggregator } from './aggregation';

// Trace Analyzer
export { TraceAnalyzer } from './analyzer';

// Dependency Mapper
export { DependencyMapper } from './dependency';

// Storage
export { MemoryStorage, TraceStorageDurableObject, DurableObjectStorage } from './storage';

// Visualization
export { GraphVisualizer } from './visualization';

// Re-export default exports
export { default as TraceCollectorDefault } from './collector';
export { default as TraceAggregatorDefault } from './aggregation';
export { default as TraceAnalyzerDefault } from './analyzer';
export { default as DependencyMapperDefault } from './dependency';
export { default as MemoryStorageDefault } from './storage/memory.storage';
export { default as GraphVisualizerDefault } from './visualization';

// Version
export const VERSION = '1.0.0';

/**
 * Create a complete distributed tracing setup
 */
export function createDistributedTracing(config: {
  collector?: any;
  aggregator?: any;
  analyzer?: any;
  storage?: any;
}) {
  const {
    collector: collectorConfig = {},
    aggregator: aggregatorConfig = {},
    analyzer: analyzerConfig = {},
    storage: storageConfig = {},
  } = config;

  const storage = new MemoryStorage(storageConfig);
  const collector = new TraceCollector(collectorConfig);
  const aggregator = new TraceAggregator(aggregatorConfig);
  const analyzer = new TraceAnalyzer(analyzerConfig);

  return {
    collector,
    aggregator,
    analyzer,
    storage,
  };
}

/**
 * DistributedTracing class that combines all components
 */
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
    this.collector.on('span:collected', async (span: any) => {
      await this.aggregator.addSpan(span);
    });

    this.aggregator.on('trace:aggregated', async (trace: any) => {
      await this.storage.putTrace(trace.traceId, trace);
      this.dependencyMapper.processTrace(trace);
    });
  }

  /**
   * Process a span through the entire pipeline
   */
  async processSpan(span: any): Promise<any> {
    // Collect
    await this.collector.collect(span);

    // The rest happens via event handlers
    return { success: true };
  }

  /**
   * Get trace analysis
   */
  async getTraceAnalysis(traceId: string): Promise<any> {
    const trace = await this.storage.getTrace(traceId);
    if (!trace) {
      throw new Error(`Trace not found: ${traceId}`);
    }

    return await this.analyzer.analyze(trace);
  }

  /**
   * Get dependency graph
   */
  getDependencyGraph(): any {
    return this.dependencyMapper.buildGraph();
  }

  /**
   * Shutdown all components
   */
  async shutdown(): Promise<void> {
    await this.collector.shutdown();
    await this.aggregator.shutdown();
  }

  /**
   * Get statistics from all components
   */
  getStats(): any {
    return {
      collector: this.collector.getStats(),
      aggregator: this.aggregator.getStats(),
      analyzer: this.analyzer.getStats(),
      storage: this.storage.getStats(),
      dependency: this.dependencyMapper.getStats(),
    };
  }
}

export default DistributedTracing;
