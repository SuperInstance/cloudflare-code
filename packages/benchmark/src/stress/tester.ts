/**
 * Stress Tester
 * Breaking point analysis and capacity planning
 */

import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import type {
  StressTestConfig,
  StressTestResult,
  StressTestLevel,
  BreakdownAnalysis,
  BottleneckAnalysis,
  CapacityRecommendation,
  ResourceUsage
} from '../types/index.js';
import { mean, percentile } from '../utils/statistics.js';
import { getProcessMemoryUsage } from '../utils/system.js';

/**
 * Stress tester for breaking point analysis
 */
export class StressTester extends EventEmitter {
  private running = false;

  /**
   * Run a stress test
   */
  async runStressTest(config: StressTestConfig): Promise<StressTestResult> {
    this.running = true;
    const startTime = performance.now();
    const levels: StressTestLevel[] = [];

    // Test each stress level
    for (let load = config.startLoad;
         load <= config.maxLoad && this.running;
         load += config.loadIncrement) {

      this.emit('progress', { load, phase: 'testing' });

      const levelResult = await this.runStressLevel(config, load);
      levels.push(levelResult);

      // Check if we should stop at breakdown
      if (config.stopAtBreakdown && !levelResult.stable) {
        this.emit('breakdown', { load, level: levelResult });
        break;
      }
    }

    const endTime = performance.now();

    return {
      name: config.name,
      levels,
      breakdown: this.analyzeBreakdown(levels),
      bottlenecks: this.analyzeBottlenecks(levels),
      recommendations: this.generateRecommendations(levels, config),
      startTime,
      endTime,
      duration: endTime - startTime
    };
  }

  /**
   * Run a single stress level
   */
  private async runStressLevel(
    config: StressTestConfig,
    load: number
  ): Promise<StressTestLevel> {
    const levelStartTime = performance.now();
    const latencies: number[] = [];
    let successful = 0;
    let failed = 0;

    // Run operations at this load level
    const duration = config.durationPerLevel;
    const operationsPerSecond = load;
    const totalOperations = Math.floor((duration / 1000) * operationsPerSecond);
    const workers: Promise<void>[] = [];
    const workerCount = Math.min(load, 100); // Limit concurrent workers

    for (let i = 0; i < workerCount; i++) {
      const operationsPerWorker = Math.ceil(totalOperations / workerCount);
      workers.push(
        this.runStressWorker(config, operationsPerWorker, load, latencies, successful, failed)
      );
    }

    await Promise.allSettled(workers);

    const total = successful + failed;
    const sortedLatencies = [...latencies].sort((a, b) => a - b);

    const resources = await this.getCurrentResources();

    // Determine if system is stable at this level
    const stable =
      failed / total < config.maxErrorRate &&
      percentile(sortedLatencies, 95) < config.maxLatency;

    const levelEndTime = performance.now();

    return {
      level: load,
      totalOperations: total,
      successful,
      failed,
      errorRate: total > 0 ? failed / total : 0,
      avgLatency: mean(latencies),
      p95Latency: percentile(sortedLatencies, 95),
      p99Latency: percentile(sortedLatencies, 99),
      maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
      resources,
      stable
    };
  }

  /**
   * Run a single stress worker
   */
  private async runStressWorker(
    config: StressTestConfig,
    operations: number,
    load: number,
    latencies: number[],
    successfulRef: { value: number },
    failedRef: { value: number }
  ): Promise<void> {
    for (let i = 0; i < operations; i++) {
      const start = performance.now();

      try {
        await Promise.race([
          config.fn(),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 30000)
          )
        ]);
        successfulRef.value++;
        latencies.push(performance.now() - start);
      } catch (error) {
        failedRef.value++;
        latencies.push(performance.now() - start);
      }

      // Maintain load rate
      const delay = 1000 / load;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Analyze breakdown point
   */
  private analyzeBreakdown(levels: StressTestLevel[]): BreakdownAnalysis {
    if (levels.length === 0) {
      return {
        detected: false,
        description: 'No stress levels tested'
      };
    }

    // Find first unstable level
    let breakdownLevel: StressTestLevel | undefined;
    let breakdownType: 'memory' | 'cpu' | 'latency' | 'errors' | 'timeout' | 'crash' | undefined;

    for (const level of levels) {
      if (!level.stable) {
        breakdownLevel = level;
        break;
      }
    }

    if (!breakdownLevel) {
      return {
        detected: false,
        description: 'System remained stable across all tested load levels'
      };
    }

    // Determine breakdown type
    if (breakdownLevel.errorRate > 0.5) {
      breakdownType = 'errors';
    } else if (breakdownLevel.p99Latency > breakdownLevel.p95Latency * 2) {
      breakdownType = 'latency';
    } else if (breakdownLevel.resources.memory > 1024 * 1024 * 1024) {
      breakdownType = 'memory';
    } else if (breakdownLevel.resources.cpu > 90) {
      breakdownType = 'cpu';
    }

    return {
      detected: true,
      loadLevel: breakdownLevel.level,
      type: breakdownType,
      description: `System breakdown detected at load level ${breakdownLevel.level}`,
      latencyAtBreakdown: breakdownLevel.p99Latency,
      errorRateAtBreakdown: breakdownLevel.errorRate
    };
  }

  /**
   * Analyze bottlenecks
   */
  private analyzeBottlenecks(levels: StressTestLevel[]): BottleneckAnalysis[] {
    const bottlenecks: BottleneckAnalysis[] = [];

    if (levels.length === 0) {
      return bottlenecks;
    }

    // Find max stable level
    const maxStableLevel = [...levels].reverse().find(level => level.stable);

    if (!maxStableLevel) {
      bottlenecks.push({
        resource: 'cpu',
        severity: 1,
        description: 'System unstable even at minimum load',
        utilization: 0,
        recommendation: 'Investigate baseline performance issues'
      });
      return bottlenecks;
    }

    // Analyze resource usage at max stable level
    const { resources } = maxStableLevel;

    // Memory bottleneck
    if (resources.memory > 512 * 1024 * 1024) {
      bottlenecks.push({
        resource: 'memory',
        severity: Math.min(resources.memory / (1024 * 1024 * 1024), 1),
        description: 'High memory usage detected',
        utilization: resources.memory / (1024 * 1024 * 1024) * 100,
        recommendation: 'Optimize memory usage or increase available memory'
      });
    }

    // CPU bottleneck
    if (resources.cpu > 70) {
      bottlenecks.push({
        resource: 'cpu',
        severity: resources.cpu / 100,
        description: 'High CPU usage detected',
        utilization: resources.cpu,
        recommendation: 'Optimize CPU-intensive operations or scale horizontally'
      });
    }

    // Event loop bottleneck
    if (resources.eventLoopLag > 100) {
      bottlenecks.push({
        resource: 'event-loop',
        severity: Math.min(resources.eventLoopLag / 1000, 1),
        description: 'Event loop lag detected',
        utilization: resources.eventLoopLag,
        recommendation: 'Offload blocking operations to worker threads'
      });
    }

    // I/O bottleneck (inferred from latency patterns)
    const avgLatencyIncrease = levels.length > 1
      ? (levels[levels.length - 1].avgLatency - levels[0].avgLatency) / levels[0].avgLatency
      : 0;

    if (avgLatencyIncrease > 1) {
      bottlenecks.push({
        resource: 'io',
        severity: Math.min(avgLatencyIncrease, 1),
        description: 'Latency increases with load, possible I/O bottleneck',
        utilization: avgLatencyIncrease * 100,
        recommendation: 'Optimize database queries and I/O operations'
      });
    }

    return bottlenecks;
  }

  /**
   * Generate capacity planning recommendations
   */
  private generateRecommendations(
    levels: StressTestLevel[],
    config: StressTestConfig
  ): CapacityRecommendation[] {
    const recommendations: CapacityRecommendation[] = [];

    if (levels.length === 0) {
      return recommendations;
    }

    // Find max stable level
    const maxStableLevel = [...levels].reverse().find(level => level.stable);

    if (maxStableLevel) {
      // Recommend capacity with buffer
      const bufferPercentage = 20;
      const recommendedMax = Math.floor(maxStableLevel.level * (1 - bufferPercentage / 100));

      recommendations.push({
        metric: 'throughput',
        maxCapacity: maxStableLevel.level,
        bufferPercentage,
        justification: `System stable up to ${maxStableLevel.level} ops/sec`,
        confidence: 'high'
      });

      recommendations.push({
        metric: 'concurrent-requests',
        maxCapacity: recommendedMax,
        bufferPercentage,
        justification: `Recommended safe capacity with ${bufferPercentage}% buffer`,
        confidence: 'high'
      });
    } else {
      recommendations.push({
        metric: 'baseline',
        maxCapacity: 0,
        bufferPercentage: 0,
        justification: 'System unstable at all tested levels',
        confidence: 'low'
      });
    }

    // Memory recommendations
    const maxMemoryLevel = levels.reduce((max, level) =>
      level.resources.memory > max.resources.memory ? level : max
    );

    if (maxMemoryLevel.resources.memory > 0) {
      const memoryGB = maxMemoryLevel.resources.memory / (1024 * 1024 * 1024);
      const recommendedMemory = memoryGB * 1.5; // 50% buffer

      recommendations.push({
        metric: 'memory',
        maxCapacity: Math.ceil(recommendedMemory),
        bufferPercentage: 50,
        justification: `Peak usage was ${memoryGB.toFixed(2)}GB`,
        confidence: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * Get current resource usage
   */
  private async getCurrentResources(): Promise<ResourceUsage> {
    const memory = getProcessMemoryUsage();

    return {
      cpu: 0, // Would need more sophisticated tracking
      memory: memory.rss,
      eventLoopLag: 0,
      activeHandles: (process as any)._getActiveHandles()?.length || 0,
      activeRequests: (process as any)._getActiveRequests()?.length || 0
    };
  }

  /**
   * Stop the stress test
   */
  stop(): void {
    this.running = false;
    this.emit('stopped');
  }

  /**
   * Run recovery test
   */
  async runRecoveryTest(
    config: StressTestConfig,
    recoveryTest: NonNullable<StressTestConfig['recoveryTest']>
  ): Promise<{
    recovers: boolean;
    recoveryTime: number;
    baselinePerformance: number;
    recoveryPerformance: number
  }> {
    if (!recoveryTest.enabled) {
      throw new Error('Recovery test not enabled in configuration');
    }

    const baselineStart = performance.now();
    const baselineLevel = await this.runStressLevel(config, config.startLoad);
    const baselineEnd = performance.now();
    const baselinePerformance = baselineLevel.successful / ((baselineEnd - baselineStart) / 1000);

    // Overload the system
    this.emit('progress', { phase: 'overload' });
    await this.runStressLevel(config, recoveryTest.loadLevel);

    // Wait for overload duration
    await new Promise(resolve => setTimeout(resolve, recoveryTest.overloadDuration));

    // Test recovery
    this.emit('progress', { phase: 'recovery' });
    const recoveryStart = performance.now();
    const recoveryLevel = await this.runStressLevel(config, config.startLoad);
    const recoveryEnd = performance.now();
    const recoveryPerformance = recoveryLevel.successful / ((recoveryEnd - recoveryStart) / 1000);

    const recovers = recoveryLevel.stable;
    const recoveryTime = recoveryEnd - baselineEnd;

    return {
      recovers,
      recoveryTime,
      baselinePerformance,
      recoveryPerformance
    };
  }
}

/**
 * Convenience function to run a stress test
 */
export async function stressTest(
  name: string,
  fn: () => Promise<void>,
  options?: Partial<StressTestConfig>
): Promise<StressTestResult> {
  const config: StressTestConfig = {
    name,
    fn,
    startLoad: 10,
    loadIncrement: 10,
    maxLoad: 1000,
    durationPerLevel: 5000,
    maxErrorRate: 0.05,
    maxLatency: 1000,
    stopAtBreakdown: true,
    ...options
  };

  const tester = new StressTester();
  return tester.runStressTest(config);
}

/**
 * Find breaking point
 */
export async function findBreakingPoint(
  name: string,
  fn: () => Promise<void>,
  startLoad: number = 10,
  maxLoad: number = 1000
): Promise<number> {
  const config: StressTestConfig = {
    name,
    fn,
    startLoad,
    loadIncrement: 10,
    maxLoad,
    durationPerLevel: 3000,
    maxErrorRate: 0.1,
    maxLatency: 2000,
    stopAtBreakdown: true
  };

  const tester = new StressTester();
  const result = await tester.runStressTest(config);

  return result.breakdown.detected && result.breakdown.loadLevel
    ? result.breakdown.loadLevel
    : maxLoad;
}
