/**
 * Network Optimization Module
 *
 * Network performance optimization including batching and connection pooling
 */

export { NetworkOptimizer } from './optimizer.js';

export type {
  NetworkConfig,
  NetworkMetrics,
  RequestBatch,
  BatchedRequest,
  ConnectionPool,
  NetworkOptimizationResult,
  NetworkRecommendation,
  RequestBatchStats,
} from '../types/index.js';
