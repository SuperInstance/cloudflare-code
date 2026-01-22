/**
 * Load Tester
 * Concurrent execution and scaling tests
 */

import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import type {
  LoadTestConfig,
  LoadTestResult,
  LoadTestLevel,
  LoadTestStatistics,
  ResourceUsage
} from '../types/index.js';
import { percentile, mean } from '../utils/statistics.js';
import { getProcessCpuUsage, getProcessMemoryUsage } from '../utils/system.js';

/**
 * Load tester for concurrent execution testing
 */
export class LoadTester extends EventEmitter {
  private running = false;

  /**
   * Run a load test
   */
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    this.running = true;
    const startTime = performance.now();
    const levels: LoadTestLevel[] = [];

    // Ramp-up phase
    if (config.rampUpDuration && config.rampUpDuration > 0) {
      await this.rampUp(config);
    }

    // Test each concurrency level
    for (let concurrency = config.initialConcurrency;
         concurrency <= config.maxConcurrency && this.running;
         concurrency += config.concurrencyStep) {

      this.emit('progress', { concurrency, phase: 'testing' });

      const levelResult = await this.runConcurrencyLevel(config, concurrency);
      levels.push(levelResult);

      // Check if error rate is too high
      if (levelResult.errorRate > 0.5) {
        this.emit('warning', {
          type: 'high-error-rate',
          concurrency,
          errorRate: levelResult.errorRate
        });
      }
    }

    // Cooldown phase
    if (config.coolDownDuration && config.coolDownDuration > 0) {
      await this.coolDown(config);
    }

    const endTime = performance.now();

    return {
      name: config.name,
      levels,
      statistics: this.calculateStatistics(levels),
      resources: await this.getCurrentResources(),
      duration: endTime - startTime,
      startTime,
      endTime,
      success: this.running
    };
  }

  /**
   * Ramp-up phase
   */
  private async rampUp(config: LoadTestConfig): Promise<void> {
    this.emit('progress', { phase: 'ramp-up' });
    const rampUpSteps = 5;
    const stepDuration = config.rampUpDuration! / rampUpSteps;

    for (let i = 0; i < rampUpSteps; i++) {
      const concurrency = Math.floor(
        config.initialConcurrency + (config.concurrencyStep * i)
      );
      await this.runConcurrencyLevel(config, concurrency, stepDuration);
    }
  }

  /**
   * Cooldown phase
   */
  private async coolDown(config: LoadTestConfig): Promise<void> {
    this.emit('progress', { phase: 'cool-down' });
    const cooldownSteps = 5;
    const stepDuration = config.coolDownDuration! / cooldownSteps;

    for (let i = 0; i < cooldownSteps; i++) {
      const concurrency = Math.floor(
        config.maxConcurrency - (config.concurrencyStep * (cooldownSteps - i))
      );
      await this.runConcurrencyLevel(config, Math.max(concurrency, 1), stepDuration);
    }
  }

  /**
   * Run a single concurrency level
   */
  private async runConcurrencyLevel(
    config: LoadTestConfig,
    concurrency: number,
    duration?: number
  ): Promise<LoadTestLevel> {
    const levelStartTime = performance.now();
    const levelDuration = duration ?? config.durationPerLevel;

    const latencies: number[] = [];
    let successful = 0;
    let failed = 0;

    // Create workers for concurrent execution
    const workers: Promise<void>[] = [];
    const operationsPerWorker = Math.ceil((config.rate || 10) * (levelDuration / 1000) / concurrency);

    for (let i = 0; i < concurrency; i++) {
      workers.push(this.runWorker(config, operationsPerWorker, latencies));
    }

    // Wait for all workers to complete
    await Promise.allSettled(workers);

    const total = successful + failed;
    const sortedLatencies = [...latencies].sort((a, b) => a - b);

    const levelEndTime = performance.now();
    const resources = await this.getCurrentResources();

    return {
      concurrency,
      totalOperations: total,
      successful,
      failed,
      ops: (successful / (levelEndTime - levelStartTime)) * 1000,
      avgLatency: mean(latencies),
      medianLatency: percentile(sortedLatencies, 50),
      percentiles: {
        50: percentile(sortedLatencies, 50),
        75: percentile(sortedLatencies, 75),
        90: percentile(sortedLatencies, 90),
        95: percentile(sortedLatencies, 95),
        99: percentile(sortedLatencies, 99)
      },
      minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
      maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
      errorRate: total > 0 ? failed / total : 0,
      timeoutRate: 0,
      resources
    };
  }

  /**
   * Run a single worker
   */
  private async runWorker(
    config: LoadTestConfig,
    operations: number,
    latencies: number[]
  ): Promise<void> {
    for (let i = 0; i < operations; i++) {
      const start = performance.now();

      try {
        await Promise.race([
          config.fn(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 30000)
          )
        ]);
        latencies.push(performance.now() - start);
      } catch (error) {
        // Operation failed
        latencies.push(performance.now() - start);
      }

      // Rate limiting if configured
      if (config.rateLimit && config.rate) {
        const delay = 1000 / config.rate;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Calculate statistics for all levels
   */
  private calculateStatistics(levels: LoadTestLevel[]): LoadTestStatistics {
    if (levels.length === 0) {
      return {
        totalOperations: 0,
        peakOps: 0,
        peakOpsConcurrency: 0,
        avgLatency: 0,
        maxLatency: 0
      };
    }

    const totalOperations = levels.reduce((sum, level) => sum + level.totalOperations, 0);
    const peakOpsLevel = levels.reduce((max, level) =>
      level.ops > max.ops ? level : max
    );

    let maxSustainableConcurrency: number | undefined;
    let breakdownPoint: number | undefined;

    // Find maximum sustainable concurrency (error rate < 5%)
    for (let i = levels.length - 1; i >= 0; i--) {
      if (levels[i].errorRate < 0.05) {
        maxSustainableConcurrency = levels[i].concurrency;
        break;
      }
    }

    // Find breakdown point (where error rate exceeds 10%)
    for (const level of levels) {
      if (level.errorRate > 0.1) {
        breakdownPoint = level.concurrency;
        break;
      }
    }

    const allLatencies = levels.flatMap(level => [
      level.avgLatency,
      level.minLatency,
      level.maxLatency
    ]);

    return {
      totalOperations,
      peakOps: peakOpsLevel.ops,
      peakOpsConcurrency: peakOpsLevel.concurrency,
      maxSustainableConcurrency,
      breakdownPoint,
      avgLatency: mean(allLatencies),
      maxLatency: Math.max(...allLatencies)
    };
  }

  /**
   * Get current resource usage
   */
  private async getCurrentResources(): Promise<ResourceUsage> {
    const memory = getProcessMemoryUsage();
    const cpu = getProcessCpuUsage();

    return {
      cpu: 0, // Would need pidusage for accurate CPU
      memory: memory.rss,
      eventLoopLag: 0,
      activeHandles: (process as any)._getActiveHandles()?.length || 0,
      activeRequests: (process as any)._getActiveRequests()?.length || 0
    };
  }

  /**
   * Stop the load test
   */
  stop(): void {
    this.running = false;
    this.emit('stopped');
  }
}

/**
 * Convenience function to run a load test
 */
export async function loadTest(
  name: string,
  fn: () => Promise<void>,
  options?: Partial<LoadTestConfig>
): Promise<LoadTestResult> {
  const config: LoadTestConfig = {
    name,
    fn,
    initialConcurrency: 1,
    maxConcurrency: 100,
    concurrencyStep: 10,
    durationPerLevel: 5000,
    ...options
  };

  const tester = new LoadTester();
  return tester.runLoadTest(config);
}

/**
 * Run sustained load test
 */
export async function sustainedLoadTest(
  name: string,
  fn: () => Promise<void>,
  concurrency: number,
  duration: number
): Promise<LoadTestResult> {
  const config: LoadTestConfig = {
    name,
    fn,
    initialConcurrency: concurrency,
    maxConcurrency: concurrency,
    concurrencyStep: 0,
    durationPerLevel: duration
  };

  const tester = new LoadTester();
  return tester.runLoadTest(config);
}

/**
 * Run spike test (sudden load increase)
 */
export async function spikeTest(
  name: string,
  fn: () => Promise<void>,
  baselineConcurrency: number,
  spikeConcurrency: number,
  spikeDuration: number,
  baselineDuration: number
): Promise<LoadTestResult> {
  const config: LoadTestConfig = {
    name,
    fn,
    initialConcurrency: baselineConcurrency,
    maxConcurrency: spikeConcurrency,
    concurrencyStep: spikeConcurrency - baselineConcurrency,
    durationPerLevel: baselineDuration,
    rampUpDuration: 1000,
    coolDownDuration: 1000
  };

  const tester = new LoadTester();
  return tester.runLoadTest(config);
}
