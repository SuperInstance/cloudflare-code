/**
 * Metrics System - Index
 *
 * Central export point for all metrics-related functionality.
 */

// Types
export type {
  RequestMetrics,
  AggregateMetrics,
  ProviderMetrics,
  CacheMetrics,
  CostSavings,
  ProviderStats,
  Anomaly,
  DashboardData,
  MetricsQueryOptions,
  MetricsStorageStrategy,
  AlertConfig,
  Alert,
} from './types';

// Collectors
export { RequestMetricsCollector } from './request';
export { ProviderMetricsCollector } from './provider';
export { CacheMetricsCollector } from './cache';

// Aggregator
export { MetricsAggregator } from './aggregator';

// Factory function
export function createMetricsSystem(kvCache: KVNamespace, r2Storage: R2Bucket) {
  const requestCollector = new RequestMetricsCollector(kvCache, r2Storage);
  const providerCollector = new ProviderMetricsCollector(kvCache, r2Storage);
  const cacheCollector = new CacheMetricsCollector(kvCache, r2Storage);
  const aggregator = new MetricsAggregator(
    requestCollector,
    providerCollector,
    cacheCollector
  );

  return {
    requestCollector,
    providerCollector,
    cacheCollector,
    aggregator,
  };
}
