/**
 * CPU Profiler - Advanced CPU profiling with sampling and instrumentation
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  CPUProfileData,
  CPUProfileFrame,
  CPUProfileNode,
  CPUProfileSample,
  HotPathResult,
  ProfilerConfig,
  ProfilerEvent,
} from '../types';

export interface CPUProfilerOptions extends Partial<ProfilerConfig> {
  /**
   * Sampling interval in microseconds (default: 1000 = 1ms)
   */
  samplingInterval?: number;

  /**
   * Maximum number of samples to collect
   */
  maxSamples?: number;

  /**
   * Enable call tree reconstruction
   */
  enableCallTree?: boolean;

  /**
   * Enable function-level timing
   */
  enableFunctionTiming?: boolean;

  /**
   * Filter functions by pattern
   */
  includePatterns?: RegExp[];

  /**
   * Exclude functions matching patterns
   */
  excludePatterns?: RegExp[];
}

export interface FunctionTiming {
  functionName: string;
  totalTime: number;
  selfTime: number;
  calls: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
}

export interface CallStackFrame {
  name: string;
  scriptId?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  timestamp: number;
}

/**
 * CPU Profiler implementation supporting both sampling and instrumentation
 */
export class CPUProfiler extends EventEmitter {
  private profiling: boolean = false;
  private startTime: number = 0;
  private endTime: number = 0;
  private samples: CPUProfileSample[] = [];
  private nodes: Map<number, CPUProfileNode> = new Map();
  private nodeIdCounter: number = 0;
  private callStacks: CallStackFrame[][] = [];
  private functionTimings: Map<string, FunctionTiming> = new Map();
  private currentCallStack: CallStackFrame[] = [];
  private options: Required<CPUProfilerOptions>;
  private samplingTimer?: NodeJS.Timeout;

  constructor(options: CPUProfilerOptions = {}) {
    super();
    this.options = {
      samplingInterval: options.samplingInterval ?? 1000,
      maxSamples: options.maxSamples ?? 100000,
      enableCallTree: options.enableCallTree ?? true,
      enableFunctionTiming: options.enableFunctionTiming ?? true,
      includePatterns: options.includePatterns ?? [],
      excludePatterns: options.excludePatterns ?? [],
      enabled: options.enabled ?? true,
      autoStart: options.autoStart ?? false,
      maxProfiles: options.maxProfiles ?? 10,
    };

    if (this.options.autoStart && this.options.enabled) {
      this.start();
    }
  }

  /**
   * Start CPU profiling
   */
  public start(): void {
    if (this.profiling) {
      throw new Error('Profiling already in progress');
    }

    if (!this.options.enabled) {
      throw new Error('Profiler is disabled');
    }

    this.profiling = true;
    this.startTime = performance.now();
    this.samples = [];
    this.nodes.clear();
    this.callStacks = [];
    this.functionTimings.clear();
    this.currentCallStack = [];
    this.nodeIdCounter = 0;

    this.emit({ type: 'profile-started', timestamp: this.startTime } as ProfilerEvent);

    // Start sampling
    this.startSampling();
  }

  /**
   * Stop CPU profiling and return results
   */
  public stop(): CPUProfileData {
    if (!this.profiling) {
      throw new Error('No profiling in progress');
    }

    this.profiling = false;
    this.endTime = performance.now();

    // Stop sampling
    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
      this.samplingTimer = undefined;
    }

    const profileData: CPUProfileData = {
      startTime: this.startTime,
      endTime: this.endTime,
      nodes: Array.from(this.nodes.values()),
      samples: this.samples,
      totalDuration: this.endTime - this.startTime,
      samplingInterval: this.options.samplingInterval,
    };

    this.emit({ type: 'profile-stopped', timestamp: this.endTime, data: profileData } as ProfilerEvent);

    return profileData;
  }

  /**
   * Check if profiling is active
   */
  public isProfiling(): boolean {
    return this.profiling;
  }

  /**
   * Get current samples count
   */
  public getSampleCount(): number {
    return this.samples.length;
  }

  /**
   * Record a function call entry (instrumentation mode)
   */
  public recordFunctionEntry(functionName: string, metadata?: Partial<CPUProfileFrame>): void {
    if (!this.profiling || !this.options.enableFunctionTiming) {
      return;
    }

    const frame: CallStackFrame = {
      name: functionName,
      timestamp: performance.now(),
      ...metadata,
    };

    this.currentCallStack.push(frame);
  }

  /**
   * Record a function call exit (instrumentation mode)
   */
  public recordFunctionExit(functionName: string, metadata?: Partial<CPUProfileFrame>): void {
    if (!this.profiling || !this.options.enableFunctionTiming) {
      return;
    }

    const frame = this.currentCallStack.pop();
    if (!frame || frame.name !== functionName) {
      // Stack mismatch, but continue
      return;
    }

    const duration = performance.now() - frame.timestamp;

    // Update function timing
    let timing = this.functionTimings.get(functionName);
    if (!timing) {
      timing = {
        functionName,
        totalTime: 0,
        selfTime: 0,
        calls: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: -Infinity,
      };
      this.functionTimings.set(functionName, timing);
    }

    timing.totalTime += duration;
    timing.calls++;
    timing.minTime = Math.min(timing.minTime, duration);
    timing.maxTime = Math.max(timing.maxTime, duration);
    timing.averageTime = timing.totalTime / timing.calls;

    // Calculate self time (excluding children)
    if (this.currentCallStack.length > 0) {
      const parent = this.currentCallStack[this.currentCallStack.length - 1];
      let parentTiming = this.functionTimings.get(parent.name);
      if (parentTiming) {
        parentTiming.selfTime -= duration;
      }
    } else {
      timing.selfTime += duration;
    }
  }

  /**
   * Get function timing statistics
   */
  public getFunctionTimings(): FunctionTiming[] {
    return Array.from(this.functionTimings.values()).sort((a, b) => b.totalTime - a.totalTime);
  }

  /**
   * Identify hot paths in the execution
   */
  public identifyHotPaths(threshold: number = 0.1, maxDepth: number = 10): HotPathResult[] {
    const hotPaths: HotPathResult[] = [];
    const totalDuration = this.endTime - this.startTime;

    // Build call tree from samples
    const callTree = this.buildCallTree();

    // Find all paths that exceed threshold
    const findHotPaths = (
      node: CPUProfileNode,
      path: CPUProfileNode[],
      pathSelfTime: number,
      pathTotalTime: number,
      depth: number
    ) => {
      if (depth > maxDepth) {
        return;
      }

      const currentPath = [...path, node];
      const currentSelfTime = pathSelfTime + node.hitCount;
      const currentTotalTime = pathTotalTime + this.getNodeTotalTime(node);
      const percentage = (currentTotalTime / totalDuration) * 100;

      if (percentage >= threshold && depth > 0) {
        hotPaths.push({
          path: currentPath,
          totalSelfTime: currentSelfTime,
          totalTime: currentTotalTime,
          percentage,
          depth,
        });
      }

      // Recurse into children
      for (const child of node.children) {
        findHotPaths(child, currentPath, currentSelfTime, currentTotalTime, depth + 1);
      }
    };

    for (const node of this.nodes.values()) {
      if (node.parent === undefined) {
        findHotPaths(node, [], 0, 0, 0);
      }
    }

    return hotPaths.sort((a, b) => b.percentage - a.percentage);
  }

  /**
   * Get flame graph data
   */
  public getFlameGraph(): any {
    const hotPaths = this.identifyHotPaths(0.01);

    return {
      name: 'root',
      value: 0,
      children: hotPaths.map((path) => ({
        name: path.path[path.path.length - 1].callFrame.name || '(anonymous)',
        value: path.totalTime,
        children: [],
      })),
    };
  }

  /**
   * Get profile statistics
   */
  public getStatistics(): {
    totalDuration: number;
    sampleCount: number;
    samplesPerSecond: number;
    uniqueFunctions: number;
    averageDepth: number;
    maxDepth: number;
  } {
    const totalDuration = this.endTime - this.startTime;
    const sampleCount = this.samples.length;
    const uniqueFunctions = this.nodes.size;

    let totalDepth = 0;
    let maxDepth = 0;

    for (const sample of this.samples) {
      const node = this.nodes.get(sample.nodeId);
      if (node) {
        totalDepth += node.depth;
        maxDepth = Math.max(maxDepth, node.depth);
      }
    }

    const averageDepth = sampleCount > 0 ? totalDepth / sampleCount : 0;

    return {
      totalDuration,
      sampleCount,
      samplesPerSecond: totalDuration > 0 ? (sampleCount / totalDuration) * 1000 : 0,
      uniqueFunctions,
      averageDepth,
      maxDepth,
    };
  }

  /**
   * Export profile in Chrome Trace format
   */
  public exportChromeTrace(): any {
    const events: any[] = [];

    for (const sample of this.samples) {
      const node = this.nodes.get(sample.nodeId);
      if (!node) continue;

      events.push({
        name: node.callFrame.name || '(anonymous)',
        ph: 'X',
        ts: sample.timestamp * 1000, // Convert to microseconds
        dur: this.options.samplingInterval,
        pid: 0,
        tid: 0,
        args: {
          fileName: node.callFrame.url || '',
          lineNumber: node.callFrame.lineNumber || 0,
        },
      });
    }

    return { traceEvents: events };
  }

  /**
   * Reset profiler state
   */
  public reset(): void {
    if (this.profiling) {
      this.stop();
    }

    this.samples = [];
    this.nodes.clear();
    this.callStacks = [];
    this.functionTimings.clear();
    this.currentCallStack = [];
    this.nodeIdCounter = 0;
  }

  /**
   * Start sampling at configured interval
   */
  private startSampling(): void {
    const intervalMs = this.options.samplingInterval / 1000;

    this.samplingTimer = setInterval(() => {
      if (this.samples.length >= this.options.maxSamples) {
        this.stop();
        return;
      }

      this.takeSample();
    }, intervalMs);
  }

  /**
   * Take a single sample of the current call stack
   */
  private takeSample(): void {
    const timestamp = performance.now() - this.startTime;

    // Simulate stack capture (in real implementation, would use V8 API)
    const stack = this.captureStackTrace();

    // Create or find nodes for each frame
    let parentNode: CPUProfileNode | undefined;
    let nodeId: number | undefined;

    for (let i = stack.length - 1; i >= 0; i--) {
      const frame = stack[i];
      const node = this.getOrCreateNode(frame, i, parentNode);

      if (i === 0) {
        nodeId = node.id;
      }

      parentNode = node;
    }

    if (nodeId !== undefined) {
      this.samples.push({
        timestamp,
        nodeId,
        cpuTime: this.options.samplingInterval,
      });
    }
  }

  /**
   * Capture current stack trace
   */
  private captureStackTrace(): CPUProfileFrame[] {
    // In real implementation, this would use V8's stack capture API
    // For now, we'll use the current call stack if available
    const frames: CPUProfileFrame[] = [];

    for (let i = this.currentCallStack.length - 1; i >= 0; i--) {
      const frame = this.currentCallStack[i];
      frames.push({
        name: frame.name,
        url: frame.url,
        lineNumber: frame.lineNumber,
        columnNumber: frame.columnNumber,
      });
    }

    return frames;
  }

  /**
   * Get or create a node for a frame
   */
  private getOrCreateNode(
    frame: CPUProfileFrame,
    depth: number,
    parent?: CPUProfileNode
  ): CPUProfileNode {
    // Check if node already exists
    for (const node of this.nodes.values()) {
      if (
        node.callFrame.name === frame.name &&
        node.callFrame.url === frame.url &&
        node.depth === depth &&
        node.parent === parent
      ) {
        node.hitCount++;
        return node;
      }
    }

    // Create new node
    const node: CPUProfileNode = {
      id: this.nodeIdCounter++,
      callFrame: frame,
      hitCount: 1,
      children: [],
      parent,
      depth,
    };

    this.nodes.set(node.id, node);

    if (parent) {
      parent.children.push(node);
    }

    return node;
  }

  /**
   * Build call tree from samples
   */
  private buildCallTree(): CPUProfileNode[] {
    const roots: CPUProfileNode[] = [];

    for (const node of this.nodes.values()) {
      if (!node.parent) {
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * Get total time for a node (including children)
   */
  private getNodeTotalTime(node: CPUProfileNode): number {
    let total = node.hitCount * this.options.samplingInterval;

    for (const child of node.children) {
      total += this.getNodeTotalTime(child);
    }

    return total;
  }

  /**
   * Check if a frame should be included based on filters
   */
  private shouldIncludeFrame(frame: CPUProfileFrame): boolean {
    // Check exclude patterns first
    for (const pattern of this.options.excludePatterns) {
      if (pattern.test(frame.name)) {
        return false;
      }
    }

    // If no include patterns, include everything
    if (this.options.includePatterns.length === 0) {
      return true;
    }

    // Check include patterns
    for (const pattern of this.options.includePatterns) {
      if (pattern.test(frame.name)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Dispose of profiler resources
   */
  public dispose(): void {
    if (this.profiling) {
      this.stop();
    }

    this.removeAllListeners();
  }
}

/**
 * Convenience function to create and start a profiler
 */
export function startProfiling(options?: CPUProfilerOptions): CPUProfiler {
  const profiler = new CPUProfiler({ ...options, autoStart: true });
  return profiler;
}

/**
 * Convenience function to profile a function
 */
export async function profileFunction<T>(
  fn: () => T | Promise<T>,
  options?: CPUProfilerOptions
): Promise<{ result: T; profile: CPUProfileData }> {
  const profiler = new CPUProfiler(options);
  profiler.start();

  try {
    const result = await fn();
    const profile = profiler.stop();
    return { result, profile };
  } finally {
    profiler.dispose();
  }
}
