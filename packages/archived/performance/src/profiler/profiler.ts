/**
 * Performance Profiler for Cloudflare Workers
 *
 * Provides comprehensive performance profiling capabilities:
 * - CPU usage monitoring
 * - Memory allocation tracking
 * - Event loop lag measurement
 * - Stack trace sampling
 * - Hot path identification
 */

import type {
  PerformanceMetrics,
  ProfileSnapshot,
  ProfilerConfig,
  ProfilerFilter,
  CPUProfile,
  StackFrame,
  MemorySnapshot,
  WorkerMetrics,
} from '../types/index.js';

export class PerformanceProfiler {
  private config: ProfilerConfig;
  private snapshots: ProfileSnapshot[] = [];
  private isProfiling = false;
  private startTime = 0;
  private sampleInterval?: NodeJS.Timeout;
  private cpuProfile: CPUProfile;
  private profileStack: Set<number> = new Set();

  constructor(config: ProfilerConfig = { enabled: true }) {
    this.config = {
      sampleInterval: 10,
      maxSamples: 10000,
      includeStackTrace: true,
      includeMemorySnapshot: true,
      includeCPUProfile: true,
      ...config,
    };

    this.cpuProfile = {
      samples: [],
      timestamps: [],
      nodes: [],
    };
  }

  /**
   * Start profiling
   */
  start(): void {
    if (this.isProfiling) {
      throw new Error('Profiling already in progress');
    }

    this.isProfiling = true;
    this.startTime = Date.now();
    this.snapshots = [];
    this.cpuProfile = { samples: [], timestamps: [], nodes: [] };
    this.profileStack.clear();

    // Start sampling
    if (this.config.sampleInterval) {
      this.sampleInterval = setInterval(() => {
        this.captureSnapshot();
      }, this.config.sampleInterval);
    }
  }

  /**
   * Stop profiling
   */
  stop(): void {
    if (!this.isProfiling) {
      throw new Error('No profiling in progress');
    }

    this.isProfiling = false;

    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = undefined;
    }
  }

  /**
   * Capture a performance snapshot
   */
  captureSnapshot(): ProfileSnapshot {
    const timestamp = Date.now();
    const metrics = this.captureMetrics();

    const snapshot: ProfileSnapshot = {
      timestamp,
      metrics,
    };

    if (this.config.includeStackTrace) {
      snapshot.stackTrace = this.captureStackTrace();
    }

    if (this.config.includeMemorySnapshot) {
      snapshot.memorySnapshot = this.captureMemorySnapshot();
    }

    if (this.config.includeCPUProfile) {
      this.updateCPUProfile(snapshot);
    }

    // Add to snapshots
    this.snapshots.push(snapshot);

    // Enforce max samples limit
    if (this.config.maxSamples && this.snapshots.length > this.config.maxSamples) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  /**
   * Capture current performance metrics
   */
  private captureMetrics(): PerformanceMetrics {
    const startTime = performance.now();

    // Memory metrics
    const memoryUsage = process.memoryUsage();
    const memoryUsed = memoryUsage.heapUsed;
    const memoryTotal = memoryUsage.heapTotal;

    // CPU metrics (approximate)
    const cpuUsage = process.cpuUsage();
    const cpuTime = cpuUsage.user + cpuUsage.system;

    // Event loop metrics
    const eventLoopLag = this.measureEventLoopLag();
    const eventLoopUtilization = this.calculateEventLoopUtilization();

    const endTime = performance.now();

    return {
      duration: endTime - startTime,
      startTime,
      endTime,
      cpuUsage: cpuTime / 1000000, // Convert to seconds
      cpuTime,
      memoryUsed,
      memoryTotal,
      memoryPercentage: (memoryUsed / memoryTotal) * 100,
      eventLoopLag,
      eventLoopUtilization,
    };
  }

  /**
   * Capture stack trace
   */
  private captureStackTrace(): StackFrame[] {
    const stackTrace: StackFrame[] = [];
    const limit = 10;
    const seen = new Set<number>();

    try {
      // Prepare a stack trace
      const prepareStackTrace = Error.prepareStackTrace;
      Error.prepareStackTrace = (_error, stack) => stack;

      // Capture stack
      const stack = new Error().stack as unknown as NodeJS.CallSite[];
      Error.prepareStackTrace = prepareStackTrace;

      if (stack) {
        for (let i = 0; i < Math.min(stack.length, limit); i++) {
          const frame = stack[i];
          const filename = frame.getFileName() || '';
          const lineNumber = frame.getLineNumber() || 0;
          const column = frame.getColumnNumber() || 0;
          const functionName = frame.getFunctionName() || frame.getMethodName() || 'anonymous';

          // Apply filters
          if (!this.shouldIncludeFrame(filename, functionName)) {
            continue;
          }

          // Create unique key for deduplication
          const key = `${filename}:${lineNumber}:${column}`;
          if (seen.has(key)) continue;
          seen.add(key);

          stackTrace.push({
            functionName,
            scriptName: filename,
            lineNumber,
            columnNumber: column,
            isNative: frame.isNative(),
          });
        }
      }
    } catch (error) {
      // Fallback to empty stack trace
    }

    return stackTrace;
  }

  /**
   * Capture memory snapshot
   */
  private captureMemorySnapshot(): MemorySnapshot {
    const memoryUsage = process.memoryUsage();

    return {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers,
      heapSpaces: [
        {
          name: 'new',
          size: memoryUsage.heapTotal,
          used: memoryUsage.heapUsed,
          available: memoryUsage.heapTotal - memoryUsage.heapUsed,
        },
        {
          name: 'old',
          size: memoryUsage.heapTotal,
          used: memoryUsage.heapUsed,
          available: memoryUsage.heapTotal - memoryUsage.heapUsed,
        },
      ],
    };
  }

  /**
   * Update CPU profile
   */
  private updateCPUProfile(snapshot: ProfileSnapshot): void {
    if (!snapshot.stackTrace || snapshot.stackTrace.length === 0) {
      return;
    }

    // Add samples
    this.cpuProfile.samples.push(0); // Root node
    this.cpuProfile.timestamps.push(snapshot.timestamp - this.startTime);

    // Add stack frames as nodes
    let parentId = 0;
    for (const frame of snapshot.stackTrace) {
      const nodeId = this.cpuProfile.nodes.length;

      // Check if node already exists
      const existingNode = this.cpuProfile.nodes.find(
        (n) =>
          n.callFrame.functionName === frame.functionName &&
          n.callFrame.scriptName === frame.scriptName &&
          n.callFrame.lineNumber === frame.lineNumber
      );

      if (existingNode) {
        parentId = existingNode.id;
      } else {
        const node = {
          id: nodeId,
          callFrame: frame,
          children: [],
          hitCount: 1,
        };

        this.cpuProfile.nodes.push(node);
        parentId = nodeId;
      }
    }
  }

  /**
   * Measure event loop lag
   */
  private measureEventLoopLag(): number {
    return new Promise<number>((resolve) => {
      const start = Date.now();
      setImmediate(() => {
        resolve(Date.now() - start);
      });
    }) as any;
  }

  /**
   * Calculate event loop utilization
   */
  private calculateEventLoopUtilization(): number {
    // Node.js 14+ has eventLoopUtilization
    if ('eventLoopUtilization' in process) {
      const util = (process as any).eventLoopUtilization();
      return util.utilization || 0;
    }
    return 0;
  }

  /**
   * Check if frame should be included based on filters
   */
  private shouldIncludeFrame(filename: string, functionName: string): boolean {
    if (!this.config.filters || this.config.filters.length === 0) {
      return true;
    }

    let include = true;

    for (const filter of this.config.filters) {
      const matches =
        (filter.property === 'functionName' &&
          this.matchPattern(functionName, filter.pattern)) ||
        (filter.property === 'scriptName' || !filter.property) &&
          this.matchPattern(filename, filter.pattern);

      if (filter.type === 'include' && matches) {
        include = true;
        break;
      } else if (filter.type === 'exclude' && matches) {
        include = false;
        break;
      }
    }

    return include;
  }

  /**
   * Match pattern against string
   */
  private matchPattern(str: string, pattern: string | RegExp): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(str);
    }
    return str.includes(pattern);
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): ProfileSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get CPU profile
   */
  getCPUProfile(): CPUProfile {
    return this.cpuProfile;
  }

  /**
   * Get profiling summary
   */
  getSummary() {
    if (this.snapshots.length === 0) {
      return {
        totalSnapshots: 0,
        duration: 0,
        avgCpuUsage: 0,
        avgMemoryUsage: 0,
        avgEventLoopLag: 0,
      };
    }

    const duration = this.snapshots[this.snapshots.length - 1].timestamp - this.startTime;
    const totalCpuUsage = this.snapshots.reduce((sum, s) => sum + s.metrics.cpuUsage, 0);
    const totalMemoryUsed = this.snapshots.reduce((sum, s) => sum + s.metrics.memoryUsed, 0);
    const totalEventLoopLag = this.snapshots.reduce(
      (sum, s) => sum + s.metrics.eventLoopLag,
      0
    );

    return {
      totalSnapshots: this.snapshots.length,
      duration,
      avgCpuUsage: totalCpuUsage / this.snapshots.length,
      avgMemoryUsage: totalMemoryUsed / this.snapshots.length,
      avgEventLoopLag: totalEventLoopLag / this.snapshots.length,
      maxMemoryUsage: Math.max(...this.snapshots.map((s) => s.metrics.memoryUsed)),
      maxCpuUsage: Math.max(...this.snapshots.map((s) => s.metrics.cpuUsage)),
      maxEventLoopLag: Math.max(...this.snapshots.map((s) => s.metrics.eventLoopLag)),
    };
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    this.snapshots = [];
    this.cpuProfile = { samples: [], timestamps: [], nodes: [] };
    this.profileStack.clear();
  }

  /**
   * Export profile to Chrome DevTools format
   */
  exportProfile(): string {
    return JSON.stringify({
      id: Date.now(),
      title: 'ClaudeFlare Profile',
      startTime: this.startTime,
      endTime: Date.now(),
      samples: this.cpuProfile.samples,
      timestamps: this.cpuProfile.timestamps,
      nodes: this.cpuProfile.nodes,
    }, null, 2);
  }

  /**
   * Profile Cloudflare Worker execution
   */
  static async profileWorker<T>(
    fn: () => T | Promise<T>,
    config?: ProfilerConfig
  ): Promise<{ result: T; metrics: WorkerMetrics }> {
    const profiler = new PerformanceProfiler(config);
    const startTime = performance.now();
    const startCpu = process.cpuUsage();
    const startMemory = process.memoryUsage();

    profiler.start();

    try {
      const result = await fn();

      profiler.stop();
      const endTime = performance.now();
      const endCpu = process.cpuUsage(startCpu);
      const endMemory = process.memoryUsage();

      const snapshot = profiler.captureSnapshot();
      const summary = profiler.getSummary();

      const metrics: WorkerMetrics = {
        coldStart: startTime, // Approximation
        warmStart: endTime - startTime,
        executionTime: endTime - startTime,
        cpuTime: (endCpu.user + endCpu.system) / 1000000,
        memoryUsed: endMemory.heapUsed - startMemory.heapUsed,
        kvReads: 0,
        kvWrites: 0,
        r2Requests: 0,
        doRequests: 0,
        subrequests: 0,
        errors: 0,
        exceptions: 0,
      };

      return { result, metrics };
    } catch (error) {
      profiler.stop();
      throw error;
    }
  }

  /**
   * Decorator for automatic function profiling
   */
  static profile(config?: ProfilerConfig) {
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const profiler = new PerformanceProfiler(config);
        profiler.start();

        try {
          const result = await originalMethod.apply(this, args);
          profiler.stop();

          const summary = profiler.getSummary();
          console.log(`[Profile] ${propertyKey}:`, {
            duration: summary.duration,
            avgCpuUsage: summary.avgCpuUsage,
            avgMemoryUsage: summary.avgMemoryUsage,
          });

          return result;
        } catch (error) {
          profiler.stop();
          throw error;
        }
      };

      return descriptor;
    };
  }
}

export default PerformanceProfiler;
