/**
 * Performance Targets Configuration
 *
 * Defines performance targets for different metrics
 */

import type { PerformanceTarget } from '../src/types/index.js';

export const PERFORMANCE_TARGETS: PerformanceTarget[] = [
  // Latency targets
  {
    metric: 'cold-start',
    target: 100, // ms
    threshold: 20, // 20% tolerance
    direction: 'lower-is-better',
    category: 'latency',
  },
  {
    metric: 'hot-path',
    target: 50, // ms
    threshold: 20,
    direction: 'lower-is-better',
    category: 'latency',
  },
  {
    metric: 'api-response',
    target: 500, // ms
    threshold: 20,
    direction: 'lower-is-better',
    category: 'latency',
  },
  {
    metric: 'websocket-message',
    target: 10, // ms
    threshold: 50,
    direction: 'lower-is-better',
    category: 'latency',
  },
  {
    metric: 'kv-read',
    target: 5, // ms
    threshold: 50,
    direction: 'lower-is-better',
    category: 'latency',
  },
  {
    metric: 'r2-request',
    target: 100, // ms
    threshold: 30,
    direction: 'lower-is-better',
    category: 'latency',
  },
  {
    metric: 'do-request',
    target: 50, // ms
    threshold: 30,
    direction: 'lower-is-better',
    category: 'latency',
  },

  // Throughput targets
  {
    metric: 'requests-per-second',
    target: 10000,
    threshold: 20,
    direction: 'higher-is-better',
    category: 'throughput',
  },
  {
    metric: 'concurrent-connections',
    target: 1000,
    threshold: 20,
    direction: 'higher-is-better',
    category: 'throughput',
  },
  {
    metric: 'websocket-messages-per-second',
    target: 100000,
    threshold: 30,
    direction: 'higher-is-better',
    category: 'throughput',
  },

  // Resource targets
  {
    metric: 'cpu-usage',
    target: 50, // %
    threshold: 20,
    direction: 'lower-is-better',
    category: 'resource',
  },
  {
    metric: 'memory-per-do',
    target: 128, // MB
    threshold: 20,
    direction: 'lower-is-better',
    category: 'resource',
  },
  {
    metric: 'bundle-size',
    target: 3, // MB
    threshold: 20,
    direction: 'lower-is-better',
    category: 'resource',
  },
  {
    metric: 'event-loop-lag',
    target: 10, // ms
    threshold: 50,
    direction: 'lower-is-better',
    category: 'resource',
  },
];

export const BENCHMARK_TARGETS: Record<string, PerformanceTarget> = {
  'string-concat': {
    metric: 'string-concat.avgTime',
    target: 0.001, // ms
    threshold: 50,
    direction: 'lower-is-better',
    category: 'latency',
  },
  'json-parse': {
    metric: 'json-parse.avgTime',
    target: 0.01, // ms
    threshold: 50,
    direction: 'lower-is-better',
    category: 'latency',
  },
  'array-map': {
    metric: 'array-map.avgTime',
    target: 0.005, // ms
    threshold: 50,
    direction: 'lower-is-better',
    category: 'latency',
  },
  'map-set': {
    metric: 'map-set.avgTime',
    target: 0.001, // ms
    threshold: 50,
    direction: 'lower-is-better',
    category: 'latency',
  },
};

export const LOAD_TEST_TARGETS: Record<string, PerformanceTarget> = {
  'standard-api': {
    metric: 'latency',
    target: 500, // ms
    threshold: 20,
    direction: 'lower-is-better',
    category: 'latency',
  },
  'high-throughput': {
    metric: 'throughput',
    target: 1000, // req/s
    threshold: 20,
    direction: 'higher-is-better',
    category: 'throughput',
  },
  'cold-start': {
    metric: 'latency',
    target: 1000, // ms
    threshold: 20,
    direction: 'lower-is-better',
    category: 'latency',
  },
};

export default {
  PERFORMANCE_TARGETS,
  BENCHMARK_TARGETS,
  LOAD_TEST_TARGETS,
};
