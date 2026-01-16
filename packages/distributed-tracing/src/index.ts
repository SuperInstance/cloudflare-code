/**
 * ClaudeFlare Distributed Tracing - Ultra-Optimized
 * High-performance distributed tracing
 */

export * from './types';
export * from './utils';
export { TraceCollector } from './collector';
export { TraceAggregator } from './aggregation';
export { TraceAnalyzer } from './analyzer';
export { DependencyMapper } from './dependency';
export { MemoryStorage, TraceStorageDurableObject } from './storage';
export { GraphVisualizer } from './visualization';

import { DistributedTracing, createDistributedTracing } from './system';
export { DistributedTracing, createDistributedTracing };

export const VERSION = '1.0.0';
export default DistributedTracing;
