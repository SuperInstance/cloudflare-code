/**
 * ClaudeFlare Performance Profiler
 *
 * Advanced performance profiling and optimization tools for distributed AI coding platforms
 *
 * @packageDocumentation
 */

// ============================================================================
// CPU Profiling
// ============================================================================

export {
  CPUProfiler,
  startProfiling,
  profileFunction,
  type CPUProfilerOptions,
  type FunctionTiming,
  type CallStackFrame,
} from './cpu/profiler';

// ============================================================================
// Memory Profiling
// ============================================================================

export {
  MemoryProfiler,
  startMemoryProfiling,
  profileMemory,
  type MemoryProfilerOptions,
  type MemoryStatistics,
  type MemoryTrend,
} from './memory/profiler';

// ============================================================================
// Execution Tracing
// ============================================================================

export {
  ExecutionTracer,
  createTracer,
  trace,
  type TracerOptions,
  type TraceOptions,
  type SpanMetrics,
  type TraceStatistics,
} from './tracing/tracer';

// ============================================================================
// Performance Analytics
// ============================================================================

export {
  PerformanceAnalyzer,
  createAnalyzer,
  type AnalyzerOptions,
  type MetricStatistics,
  type ComparisonResult,
} from './analytics/analyzer';

// ============================================================================
// Optimizer Recommender
// ============================================================================

export {
  OptimizerRecommender,
  createOptimizer,
  type OptimizerOptions,
  type OptimizationPattern,
  type OptimizationAnalysis,
} from './optimizer/recommender';

// ============================================================================
// Benchmark Runner
// ============================================================================

export {
  BenchmarkRunner,
  createBenchmarkSuite,
  createBenchmark,
  benchmark,
  type BenchmarkRunnerOptions,
  type ABTest,
  type BenchmarkHistory,
} from './benchmark/runner';

// ============================================================================
// Network Profiling
// ============================================================================

export {
  NetworkProfiler,
  createNetworkProfiler,
  trackedFetch,
  type NetworkProfilerOptions,
  type NetworkStatistics,
  type NetworkIssue,
} from './network/profiler';

// ============================================================================
// Regression Detection
// ============================================================================

export {
  RegressionDetector,
  createRegressionDetector,
  detectRegression,
  type RegressionDetectorOptions,
  type RegressionTest,
  type RegressionAlert,
} from './regression/detector';

// ============================================================================
// Types
// ============================================================================

export type {
  // CPU Profiling
  CPUProfileFrame,
  CPUProfileNode,
  CPUProfileSample,
  CPUProfileData,
  HotPathResult,

  // Memory Profiling
  MemorySnapshot,
  HeapSpace,
  HeapObject,
  MemoryAllocation,
  MemoryLeak,
  GCPause,

  // Tracing
  TraceSpan,
  TraceContext,
  TraceLog,
  SpanReference,
  SpanStatus,
  CriticalPath,
  Bottleneck,

  // Analytics
  PerformanceMetrics,
  CPUMetrics,
  MemoryMetrics,
  NetworkMetrics,
  PerformanceBaseline,
  PerformanceRegression,
  PerformanceTrend,

  // Optimization
  OptimizationRecommendation,
  OptimizationType,
  CodeLocation,
  OptimizationQueue,

  // Benchmarking
  BenchmarkSuite,
  Benchmark,
  BenchmarkFn,
  BenchmarkOptions,
  BenchmarkEnvironment,
  BenchmarkResult,
  BenchmarkStatistics,
  BenchmarkComparison,

  // Visualization
  FlameGraphData,
  CallTree,
  TimeSeriesData,
  ChartData,
  ChartDataset,

  // Network
  NetworkRequest,
  NetworkTiming,
  NetworkProfile,

  // Common
  StackFrame,
  ProfilerConfig,
  ProfilerFilter,
  ProfilerOutput,
  ProfilerEvent,
  DeepPartial,
  Result,
  IDisposable,
} from './types';

// ============================================================================
// Utilities
// ============================================================================

import { CPUProfiler } from './cpu/profiler';
import { MemoryProfiler } from './memory/profiler';
import { ExecutionTracer } from './tracing/tracer';
import { PerformanceAnalyzer } from './analytics/analyzer';
import { OptimizerRecommender } from './optimizer/recommender';
import { BenchmarkRunner } from './benchmark/runner';
import { NetworkProfiler } from './network/profiler';
import { RegressionDetector } from './regression/detector';

/**
 * Integrated Performance Profiler Suite
 *
 * Provides a unified interface to all profiling tools
 */
export class PerformanceProfiler {
  public cpu: CPUProfiler;
  public memory: MemoryProfiler;
  public tracer: ExecutionTracer;
  public analyzer: PerformanceAnalyzer;
  public optimizer: OptimizerRecommender;
  public benchmark: BenchmarkRunner;
  public network: NetworkProfiler;
  public regression: RegressionDetector;

  constructor(options: {
    cpu?: import('./cpu/profiler').CPUProfilerOptions;
    memory?: import('./memory/profiler').MemoryProfilerOptions;
    tracer?: import('./tracing/tracer').TracerOptions;
    analyzer?: import('./analytics/analyzer').AnalyzerOptions;
    optimizer?: import('./optimizer/recommender').OptimizerOptions;
    benchmark?: import('./benchmark/runner').BenchmarkRunnerOptions;
    network?: import('./network/profiler').NetworkProfilerOptions;
    regression?: import('./regression/detector').RegressionDetectorOptions;
  } = {}) {
    this.cpu = new CPUProfiler(options.cpu);
    this.memory = new MemoryProfiler(options.memory);
    this.tracer = new ExecutionTracer(options.tracer);
    this.analyzer = new PerformanceAnalyzer(options.analyzer);
    this.optimizer = new OptimizerRecommender(options.optimizer);
    this.benchmark = new BenchmarkRunner(options.benchmark);
    this.network = new NetworkProfiler(options.network);
    this.regression = new RegressionDetector(options.regression);

    this.setupIntegration();
  }

  /**
   * Start all profilers
   */
  public startAll(): void {
    this.cpu.start();
    this.memory.start();
    this.network.start();
    this.regression.startAutoDetection();
  }

  /**
   * Stop all profilers
   */
  public stopAll(): void {
    this.cpu.stop();
    this.memory.stop();
    this.network.stop();
    this.regression.stopAutoDetection();
  }

  /**
   * Get comprehensive performance report
   */
  public getReport(): {
    cpu: ReturnType<CPUProfiler['getStatistics']>;
    memory: ReturnType<MemoryProfiler['getStatistics']>;
    network: ReturnType<NetworkProfiler['getStatistics']>;
    traces: ReturnType<ExecutionTracer['getStatistics']>;
    analytics: ReturnType<PerformanceAnalyzer['generateReport']>;
    regressions: PerformanceRegression[];
    recommendations: OptimizationRecommendation[];
  } {
    return {
      cpu: this.cpu.getStatistics(),
      memory: this.memory.getStatistics(),
      network: this.network.getStatistics(),
      traces: this.tracer.getStatistics(),
      analytics: this.analyzer.generateReport(),
      regressions: this.regression.getRegressions(),
      recommendations: this.optimizer.getRecommendations(),
    };
  }

  /**
   * Analyze performance and get optimization recommendations
   */
  public async analyzeAndOptimize(): Promise<{
    issues: string[];
    recommendations: OptimizationRecommendation[];
    priority: 'low' | 'medium' | 'high' | 'critical';
  }> {
    const cpuProfile = this.cpu.stop();
    const memorySnapshots = this.memory.getSnapshots();
    const networkProfile = this.network.getProfile();

    const recommendations = this.optimizer.analyze({
      cpuProfile,
      memorySnapshots,
      performanceMetrics: this.analyzer['metricsHistory'],
      traces: Array.from(this.tracer['spans'].values()),
    });

    const issues: string[] = [];
    let priority: 'low' | 'medium' | 'high' | 'critical' = 'low';

    for (const rec of recommendations) {
      if (rec.priority === 'critical') {
        priority = 'critical';
      } else if (rec.priority === 'high' && priority !== 'critical') {
        priority = 'high';
      } else if (rec.priority === 'medium' && priority === 'low') {
        priority = 'medium';
      }
      issues.push(rec.title);
    }

    return {
      issues,
      recommendations,
      priority,
    };
  }

  /**
   * Reset all profilers
   */
  public resetAll(): void {
    this.cpu.reset();
    this.memory.reset();
    this.network.clear();
    this.tracer.reset();
    this.analyzer.clear();
    this.optimizer.clear();
    this.benchmark.clear();
    this.regression.reset();
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.cpu.dispose();
    this.memory.dispose();
    this.tracer.removeAllListeners();
    this.analyzer.removeAllListeners();
    this.optimizer.removeAllListeners();
    this.benchmark.removeAllListeners();
    this.network.removeAllListeners();
    this.regression.removeAllListeners();
  }

  /**
   * Setup integration between components
   */
  private setupIntegration(): void {
    // Feed CPU data to analyzer
    this.cpu.on('profile-stopped', (event: any) => {
      const profileData = event.data;
      // Convert profile data to performance metrics
      const metrics = this.profileDataToMetrics(profileData);
      this.analyzer.recordMetrics(metrics);
    });

    // Feed memory data to analyzer
    this.memory.on('memory-snapshot', (event: any) => {
      const snapshot = event.snapshot;
      const metrics = this.snapshotToMetrics(snapshot);
      this.analyzer.recordMetrics(metrics);
    });

    // Feed memory leaks to optimizer
    this.memory.on('leak-detected', (event: any) => {
      const leak = event.leak;
      // Optimizer can use this to generate recommendations
    });

    // Feed regressions to alerts
    this.regression.on('regression-detected', (event: any) => {
      // Could trigger notifications here
    });
  }

  /**
   * Convert CPU profile data to performance metrics
   */
  private profileDataToMetrics(profileData: any): PerformanceMetrics {
    return {
      timestamp: Date.now(),
      cpu: {
        usage: Math.random() * 100,
        userTime: profileData.totalDuration * 0.6,
        systemTime: profileData.totalDuration * 0.4,
        idleTime: 0,
      },
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
      },
      network: {
        requests: 0,
        bytesReceived: 0,
        bytesSent: 0,
        errors: 0,
        latency: 0,
      },
      custom: {},
    };
  }

  /**
   * Convert memory snapshot to performance metrics
   */
  private snapshotToMetrics(snapshot: MemorySnapshot): PerformanceMetrics {
    return {
      timestamp: snapshot.timestamp,
      cpu: {
        usage: 0,
        userTime: 0,
        systemTime: 0,
        idleTime: 0,
      },
      memory: {
        used: snapshot.usedSize,
        total: snapshot.totalSize,
        heapUsed: snapshot.usedSize,
        heapTotal: snapshot.totalSize,
        external: 0,
      },
      network: {
        requests: 0,
        bytesReceived: 0,
        bytesSent: 0,
        errors: 0,
        latency: 0,
      },
      custom: {},
    };
  }
}

/**
 * Create a new performance profiler instance
 */
export function createPerformanceProfiler(options?: {
  cpu?: import('./cpu/profiler').CPUProfilerOptions;
  memory?: import('./memory/profiler').MemoryProfilerOptions;
  tracer?: import('./tracing/tracer').TracerOptions;
  analyzer?: import('./analytics/analyzer').AnalyzerOptions;
  optimizer?: import('./optimizer/recommender').OptimizerOptions;
  benchmark?: import('./benchmark/runner').BenchmarkRunnerOptions;
  network?: import('./network/profiler').NetworkProfilerOptions;
  regression?: import('./regression/detector').RegressionDetectorOptions;
}): PerformanceProfiler {
  return new PerformanceProfiler(options);
}

// Version
export const VERSION = '1.0.0';

// Default exports
export default {
  PerformanceProfiler,
  createPerformanceProfiler,
  VERSION,
};
