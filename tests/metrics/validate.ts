/**
 * Metrics System Validation Script
 *
 * Validates the metrics collection system implementation.
 * Run with: npm run validate:metrics
 */

import { RequestMetricsCollector } from '../../packages/edge/src/lib/metrics/request';
import { ProviderMetricsCollector } from '../../packages/edge/src/lib/metrics/provider';
import { CacheMetricsCollector } from '../../packages/edge/src/lib/metrics/cache';
import { MetricsAggregator } from '../../packages/edge/src/lib/metrics/aggregator';

interface ValidationResult {
  category: string;
  test: string;
  passed: boolean;
  message: string;
  duration: number;
}

const results: ValidationResult[] = [];

function validate(category: string, test: string, fn: () => boolean | Promise<boolean>): void {
  const start = Date.now();
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.then((passed) => {
        results.push({
          category,
          test,
          passed,
          message: passed ? '✓ Passed' : '✗ Failed',
          duration: Date.now() - start,
        });
      });
    } else {
      results.push({
        category,
        test,
        passed: result,
        message: result ? '✓ Passed' : '✗ Failed',
        duration: Date.now() - start,
      });
    }
  } catch (error) {
    results.push({
      category,
      test,
      passed: false,
      message: `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - start,
    });
  }
}

// Mock storage
const mockKV = {
  get: async () => null,
  put: async () => undefined,
  delete: async () => undefined,
  list: async () => ({ keys: [], list_complete: true }),
} as unknown as KVNamespace;

const mockR2 = {
  get: async () => null,
  put: async () => undefined,
  delete: async () => undefined,
  list: async () => ({ objects: [], truncated: false }),
} as unknown as R2Bucket;

async function runValidation() {
  console.log('🔍 Validating Metrics System...\n');

  // Initialize collectors
  const requestCollector = new RequestMetricsCollector(mockKV, mockR2);
  const providerCollector = new ProviderMetricsCollector(mockKV, mockR2);
  const cacheCollector = new CacheMetricsCollector(mockKV, mockR2);
  const aggregator = new MetricsAggregator(
    requestCollector,
    providerCollector,
    cacheCollector
  );

  // Validate Request Metrics Collector
  console.log('📊 Request Metrics Collector');

  validate('Request Collector', 'Initialize', () => {
    return requestCollector !== null && typeof requestCollector.record === 'function';
  });

  validate('Request Collector', 'Record metric', async () => {
    await requestCollector.record({
      requestId: 'test-1',
      timestamp: Date.now(),
      provider: 'anthropic',
      model: 'claude-3-sonnet',
      latency: 1234,
      tokens: { prompt: 100, completion: 50, total: 150 },
      cacheHit: false,
      cost: 0.01,
      success: true,
    });
    return true;
  });

  validate('Request Collector', 'Get recent metrics', async () => {
    const metrics = await requestCollector.getRecent(1);
    return metrics.length >= 1;
  });

  validate('Request Collector', 'Calculate statistics', () => {
    const stats = requestCollector.calculateStatistics([
      {
        requestId: 'test-1',
        timestamp: Date.now(),
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        latency: 1000,
        tokens: { prompt: 100, completion: 50, total: 150 },
        cacheHit: false,
        cost: 0.01,
        success: true,
      },
      {
        requestId: 'test-2',
        timestamp: Date.now(),
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        latency: 2000,
        tokens: { prompt: 200, completion: 100, total: 300 },
        cacheHit: true,
        cost: 0.005,
        success: true,
      },
    ]);
    return stats.count === 2 && stats.avgLatency === 1500;
  });

  console.log('');

  // Validate Provider Metrics Collector
  console.log('🏢 Provider Metrics Collector');

  validate('Provider Collector', 'Initialize', () => {
    return (
      providerCollector !== null &&
      typeof providerCollector.record === 'function'
    );
  });

  validate('Provider Collector', 'Record success', () => {
    providerCollector.recordSuccess('anthropic', 1234, 150);
    return true;
  });

  validate('Provider Collector', 'Record failure', () => {
    providerCollector.recordFailure('anthropic', 'RATE_LIMIT');
    return true;
  });

  validate('Provider Collector', 'Get provider status', async () => {
    const status = await providerCollector.getProviderStatus('anthropic');
    return status !== null && status.provider === 'anthropic';
  });

  console.log('');

  // Validate Cache Metrics Collector
  console.log('💾 Cache Metrics Collector');

  validate('Cache Collector', 'Initialize', () => {
    return (
      cacheCollector !== null && typeof cacheCollector.recordHit === 'function'
    );
  });

  validate('Cache Collector', 'Record hit', () => {
    cacheCollector.recordHit('hot', 5);
    return true;
  });

  validate('Cache Collector', 'Record miss', () => {
    cacheCollector.recordMiss('warm', 50);
    return true;
  });

  validate('Cache Collector', 'Get tier metrics', async () => {
    const metrics = await cacheCollector.getTierMetrics('hot');
    return metrics.tier === 'hot' && typeof metrics.hitRate === 'number';
  });

  validate('Cache Collector', 'Get overall metrics', async () => {
    const metrics = await cacheCollector.getOverallMetrics();
    return typeof metrics.hitRate === 'number' && typeof metrics.totalRequests === 'number';
  });

  console.log('');

  // Validate Metrics Aggregator
  console.log('📈 Metrics Aggregator');

  validate('Aggregator', 'Initialize', () => {
    return (
      aggregator !== null &&
      typeof aggregator.getDashboardData === 'function'
    );
  });

  validate('Aggregator', 'Get dashboard data', async () => {
    const data = await aggregator.getDashboardData('hour');
    return (
      data.timestamp > 0 &&
      typeof data.overview.totalRequests === 'number'
    );
  });

  validate('Aggregator', 'Calculate savings', async () => {
    const savings = await aggregator.calculateSavings('hour');
    return typeof savings.totalSavings === 'number';
  });

  validate('Aggregator', 'Detect anomalies', async () => {
    const anomalies = await aggregator.detectAnomalies();
    return Array.isArray(anomalies);
  });

  validate('Aggregator', 'Generate forecast', async () => {
    const forecast = await aggregator.generateForecast(Date.now(), 'day');
    return (
      typeof forecast.nextDay === 'number' &&
      typeof forecast.confidence === 'number'
    );
  });

  validate('Aggregator', 'Get Prometheus metrics', async () => {
    const metrics = await aggregator.getPrometheusMetrics();
    return (
      typeof metrics === 'string' &&
      metrics.includes('# HELP') &&
      metrics.includes('# TYPE')
    );
  });

  console.log('');

  // Wait for async validations to complete
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Print results
  console.log('📋 Validation Results\n');

  const byCategory: Record<string, ValidationResult[]> = {};
  for (const result of results) {
    if (!byCategory[result.category]) {
      byCategory[result.category] = [];
    }
    byCategory[result.category].push(result);
  }

  let totalPassed = 0;
  let totalFailed = 0;

  for (const [category, tests] of Object.entries(byCategory)) {
    console.log(`${category}:`);
    for (const test of tests) {
      console.log(`  ${test.message} - ${test.test} (${test.duration}ms)`);
      if (test.passed) {
        totalPassed++;
      } else {
        totalFailed++;
      }
    }
    console.log('');
  }

  console.log(`✓ Passed: ${totalPassed}`);
  console.log(`✗ Failed: ${totalFailed}`);
  console.log(`Total: ${totalPassed + totalFailed}`);

  if (totalFailed > 0) {
    console.log('\n❌ Validation failed');
    process.exit(1);
  } else {
    console.log('\n✅ All validations passed!');
    process.exit(0);
  }
}

// Run validation
runValidation().catch((error) => {
  console.error('Validation error:', error);
  process.exit(1);
});
