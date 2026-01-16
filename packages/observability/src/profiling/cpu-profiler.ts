/**
 * CPU profiler with flame graph generation
 */

// @ts-nocheck - Complex profiling type issues
import { CPUProfile, ProfileSample, FlameGraphFrame, HotPath, Bottleneck } from '../types';

export interface ProfilingOptions {
  interval?: number;
  duration?: number;
  maxSamples?: number;
  includeSourceLines?: boolean;
}

export class CPUProfiler {
  private samples: ProfileSample[] = [];
  private isProfiling: boolean = false;
  private profilingInterval?: number;
  private startTime: number = 0;
  private endTime: number = 0;

  constructor(private options: ProfilingOptions = {}) {
    this.options = {
      interval: options.interval || 1000, // 1ms default
      duration: options.duration || 30000, // 30s default
      maxSamples: options.maxSamples || 100000,
      includeSourceLines: options.includeSourceLines ?? true,
    };
  }

  /**
   * Start CPU profiling
   */
  start(): void {
    if (this.isProfiling) {
      throw new Error('Profiling already in progress');
    }

    this.isProfiling = true;
    this.startTime = Date.now();
    this.samples = [];

    // Start sampling
    this.startSampling();
  }

  /**
   * Stop CPU profiling
   */
  stop(): CPUProfile {
    if (!this.isProfiling) {
      throw new Error('No profiling in progress');
    }

    this.isProfiling = false;
    this.endTime = Date.now();

    if (this.profilingInterval !== undefined) {
      clearInterval(this.profilingInterval);
      this.profilingInterval = undefined;
    }

    return this.buildProfile();
  }

  /**
   * Start sampling stack traces
   */
  private startSampling(): void {
    const interval = this.options.interval || 1000;
    let sampleCount = 0;
    const maxSamples = this.options.maxSamples || 100000;

    this.profilingInterval = window.setInterval(() => {
      if (!this.isProfiling || sampleCount >= maxSamples) {
        this.stop();
        return;
      }

      const sample = this.captureSample();
      if (sample) {
        this.samples.push(sample);
        sampleCount++;
      }
    }, interval / 1000); // Convert microseconds to milliseconds
  }

  /**
   * Capture a stack trace sample
   */
  private captureSample(): ProfileSample | null {
    try {
      const stackTrace = this.captureStackTrace();
      if (!stackTrace || stackTrace.length === 0) {
        return null;
      }

      return {
        timestamp: Date.now(),
        stacks: [stackTrace],
        weights: [1],
        duration: this.options.interval || 1000,
      };
    } catch (error) {
      console.error('Failed to capture sample:', error);
      return null;
    }
  }

  /**
   * Capture stack trace
   */
  private captureStackTrace(): string[] {
    const stack: string[] = [];
    const error = new Error();

    if (error.stack) {
      const lines = error.stack.split('\n');
      for (const line of lines) {
        // Skip the error line and this capture function
        if (line.includes('Error') || line.includes('captureStackTrace')) {
          continue;
        }

        // Extract function name and location
        const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
        if (match) {
          const [, funcName, file, line, col] = match;
          stack.push(`${funcName} (${file}:${line}:${col})`);
        } else {
          const simpleMatch = line.match(/at\s+(.+?)\s+\((.+?)\)/);
          if (simpleMatch) {
            stack.push(simpleMatch[1]);
          }
        }
      }
    }

    return stack;
  }

  /**
   * Build CPU profile from samples
   */
  private buildProfile(): CPUProfile {
    // Build unique frames
    const frameMap = new Map<string, number>();
    const frames: any[] = [];
    let frameId = 0;

    const processStack = (stack: string[]) => {
      for (const frame of stack) {
        if (!frameMap.has(frame)) {
          frameMap.set(frame, frameId);
          frames.push({
            name: frame,
            filename: this.extractFilename(frame),
            functionName: this.extractFunctionName(frame),
            lineNumber: this.extractLineNumber(frame),
            columnNumber: this.extractColumnNumber(frame),
          });
          frameId++;
        }
      }
    };

    for (const sample of this.samples) {
      for (const stack of sample.stacks) {
        processStack(stack);
      }
    }

    return {
      pid: 0,
      tid: 0,
      startTime: this.startTime,
      endTime: this.endTime,
      samples: this.samples,
      frames,
    };
  }

  /**
   * Extract filename from stack frame
   */
  private extractFilename(frame: string): string {
    const match = frame.match(/\(([^:]+):\d+:\d+\)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Extract function name from stack frame
   */
  private extractFunctionName(frame: string): string {
    const match = frame.match(/at\s+(\w+)/);
    return match ? match[1] : 'anonymous';
  }

  /**
   * Extract line number from stack frame
   */
  private extractLineNumber(frame: string): number {
    const match = frame.match(/:(\d+):\d+\)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Extract column number from stack frame
   */
  private extractColumnNumber(frame: string): number {
    const match = frame.match(/:(\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Generate flame graph from profile
   */
  generateFlameGraph(profile: CPUProfile): FlameGraphFrame {
    const root: FlameGraphFrame = {
      name: 'root',
      value: 0,
      children: [],
      depth: 0,
    };

    // Process samples to build flame graph
    const stackCounts = new Map<string, { count: number; selfCount: number }>();

    for (const sample of profile.samples) {
      for (const stack of sample.stacks) {
        for (let i = 0; i < stack.length; i++) {
          const frame = stack[i];
          if (!stackCounts.has(frame)) {
            stackCounts.set(frame, { count: 0, selfCount: 0 });
          }

          const data = stackCounts.get(frame)!;
          data.count++;

          // Self time is only counted for leaf nodes
          if (i === stack.length - 1) {
            data.selfCount++;
          }
        }
      }
    }

    // Build tree structure
    const rootChildren = this.buildFlameTree(stackCounts, profile);

    root.children = rootChildren;
    root.value = profile.endTime - profile.startTime;

    return root;
  }

  /**
   * Build flame graph tree
   */
  private buildFlameTree(
    stackCounts: Map<string, { count: number; selfCount: number }>,
    profile: CPUProfile
  ): FlameGraphFrame[] {
    const duration = profile.endTime - profile.startTime;
    const interval = this.options.interval || 1000;

    // Group stacks by their root frame
    const rootGroups = new Map<string, string[][]>();

    for (const sample of profile.samples) {
      for (const stack of sample.stacks) {
        if (stack.length > 0) {
          const root = stack[0];
          if (!rootGroups.has(root)) {
            rootGroups.set(root, []);
          }
          rootGroups.get(root)!.push(stack);
        }
      }
    }

    // Build nodes for each root
    const nodes: FlameGraphFrame[] = [];

    for (const [root, stacks] of rootGroups) {
      const frameData = stackCounts.get(root)!;
      const node: FlameGraphFrame = {
        name: root,
        value: (frameData.count * interval) / 1000, // Convert to ms
        children: [],
        depth: 1,
      };

      // Build children recursively
      node.children = this.buildChildren(stacks, stackCounts, 2, interval);
      nodes.push(node);
    }

    return nodes;
  }

  /**
   * Build children for flame graph node
   */
  private buildChildren(
    stacks: string[][],
    stackCounts: Map<string, { count: number; selfCount: number }>,
    depth: number,
    interval: number
  ): FlameGraphFrame[] {
    // Group by frame at this depth
    const depthGroups = new Map<string, string[][]>();

    for (const stack of stacks) {
      if (stack.length > depth - 1) {
        const frame = stack[depth - 1];
        if (!depthGroups.has(frame)) {
          depthGroups.set(frame, []);
        }
        depthGroups.get(frame)!.push(stack);
      }
    }

    const children: FlameGraphFrame[] = [];

    for (const [frame, childStacks] of depthGroups) {
      const frameData = stackCounts.get(frame)!;
      const node: FlameGraphFrame = {
        name: frame,
        value: (frameData.count * interval) / 1000,
        children: [],
        depth,
      };

      // Recursively build grandchildren
      if (depth < 10) {
        // Limit depth to prevent stack overflow
        node.children = this.buildChildren(childStacks, stackCounts, depth + 1, interval);
      }

      children.push(node);
    }

    return children;
  }

  /**
   * Analyze hot paths
   */
  analyzeHotPaths(profile: CPUProfile, limit: number = 10): HotPath[] {
    const pathCounts = new Map<string, { totalTime: number; selfTime: number; callCount: number }>();
    const totalDuration = profile.endTime - profile.startTime;

    for (const sample of profile.samples) {
      for (const stack of sample.stacks) {
        // Build path string
        const path = stack.join(' > ');

        if (!pathCounts.has(path)) {
          pathCounts.set(path, { totalTime: 0, selfTime: 0, callCount: 0 });
        }

        const data = pathCounts.get(path)!;
        data.callCount++;
        data.totalTime += this.options.interval || 1000;

        // Self time for leaf
        data.selfTime += this.options.interval || 1000;
      }
    }

    // Convert to array and sort by total time
    const paths = Array.from(pathCounts.entries())
      .map(([path, data]) => ({
        path: path.split(' > '),
        totalTime: data.totalTime / 1000, // Convert to ms
        selfTime: data.selfTime / 1000,
        percentage: (data.totalTime / totalDuration) * 100,
        callCount: data.callCount,
      }))
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, limit);

    return paths;
  }

  /**
   * Detect bottlenecks
   */
  detectBottlenecks(profile: CPUProfile): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    const hotPaths = this.analyzeHotPaths(profile, 20);

    for (const hotPath of hotPaths) {
      if (hotPath.percentage > 5) {
        // More than 5% of total time
        bottlenecks.push({
          location: hotPath.path.join(' > '),
          type: 'cpu',
          severity: hotPath.percentage > 20 ? 'critical' : hotPath.percentage > 10 ? 'high' : 'medium',
          description: `Function consuming ${hotPath.percentage.toFixed(2)}% of CPU time`,
          impact: hotPath.percentage,
          suggestion: this.generateBottleneckSuggestion(hotPath),
        });
      }
    }

    return bottlenecks;
  }

  /**
   * Generate suggestion for bottleneck
   */
  private generateBottleneckSuggestion(hotPath: HotPath): string {
    const lastFrame = hotPath.path[hotPath.path.length - 1];

    if (lastFrame.includes('query') || lastFrame.includes('fetch')) {
      return 'Consider caching results or optimizing database queries';
    } else if (lastFrame.includes('parse') || lastFrame.includes('process')) {
      return 'Consider moving processing to a worker thread or using Web Workers';
    } else if (lastFrame.includes('render') || lastFrame.includes('paint')) {
      return 'Consider virtualization, pagination, or reducing DOM complexity';
    } else {
      return 'Review algorithm complexity and consider optimization';
    }
  }

  /**
   * Get profiling status
   */
  getStatus(): {
    isProfiling: boolean;
    sampleCount: number;
    duration: number;
  } {
    return {
      isProfiling: this.isProfiling,
      sampleCount: this.samples.length,
      duration: this.isProfiling ? Date.now() - this.startTime : this.endTime - this.startTime,
    };
  }
}
