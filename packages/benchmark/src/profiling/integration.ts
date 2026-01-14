/**
 * Profiling Integration
 * CPU and memory profiling with flame graphs and hot path analysis
 */

import { performance } from 'perf_hooks';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type {
  ProfileOptions,
  CpuProfile,
  ProfileNode,
  MemoryProfile,
  MemorySample,
  MemoryLeakInfo
} from '../types/index.js';

/**
 * Profiler integration for capturing performance profiles
 */
export class ProfilerIntegration {
  private cpuProfiles: Map<string, CpuProfile> = new Map();
  private memoryProfiles: Map<string, MemoryProfile> = new Map();

  /**
   * Profile CPU usage during function execution
   */
  async profileCpu<T>(
    name: string,
    fn: () => Promise<T>,
    options?: Partial<ProfileOptions>
  ): Promise<{ result: T; profile: CpuProfile }> {
    const opts: ProfileOptions = {
      type: 'cpu',
      samplingInterval: 1000,
      flameGraph: true,
      callTree: true,
      name,
      ...options
    };

    const startTime = performance.now();
    const samples: ProfileNode[] = [];
    const callStack: ProfileNode[] = [];
    let totalSamples = 0;

    // Create root node
    const root: ProfileNode = {
      name: 'root',
      time: 0,
      selfTime: 0,
      callCount: 0,
      percentage: 0,
      children: []
    };

    // Start profiling
    const originalProfiling = (profiler as any).startProfiling;
    let profiler: any = null;

    try {
      // Try to use V8 profiler if available
      if (typeof (global as any).profiler !== 'undefined') {
        profiler = (global as any).profiler;
        profiler.startProfiling(name, true);
      }

      // Execute function
      const result = await fn();

      // Stop profiling
      if (profiler) {
        const profile = profiler.stopProfiling(name);
        this.processCpuProfile(profile, samples);
      }

      const endTime = performance.now();

      // Calculate times and percentages
      const totalTime = endTime - startTime;
      this.calculateNodeTimes(root, totalTime);

      const profileResult: CpuProfile = {
        nodes: [root],
        startTime,
        endTime,
        duration: totalTime,
        sampleCount: totalSamples,
        hotPath: this.findHotPath(root)
      };

      this.cpuProfiles.set(name, profileResult);

      // Save profile if output directory specified
      if (opts.outputDir) {
        this.saveCpuProfile(name, profileResult, opts.outputDir);
      }

      return { result, profile: profileResult };
    } catch (error) {
      if (profiler) {
        try {
          profiler.stopProfiling(name);
        } catch (e) {
          // Ignore
        }
      }
      throw error;
    }
  }

  /**
   * Profile memory usage during function execution
   */
  async profileMemory<T>(
    name: string,
    fn: () => Promise<T>,
    options?: Partial<ProfileOptions>
  ): Promise<{ result: T; profile: MemoryProfile }> {
    const opts: ProfileOptions = {
      type: 'memory',
      samplingInterval: 100,
      name,
      ...options
    };

    const startTime = performance.now();
    const samples: MemorySample[] = [];
    let peakMemory = 0;

    // Start sampling
    const samplingInterval = setInterval(() => {
      const mem = process.memoryUsage();
      samples.push({
        timestamp: performance.now(),
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external
      });

      if (mem.heapUsed > peakMemory) {
        peakMemory = mem.heapUsed;
      }
    }, opts.samplingInterval);

    try {
      const result = await fn();
      clearInterval(samplingInterval);

      // Take final sample
      const finalMem = process.memoryUsage();
      samples.push({
        timestamp: performance.now(),
        heapUsed: finalMem.heapUsed,
        heapTotal: finalMem.heapTotal,
        external: finalMem.external
      });

      const endTime = performance.now();

      // Calculate growth rate
      const growthRate = samples.length > 1
        ? (samples[samples.length - 1].heapUsed - samples[0].heapUsed) / (endTime - startTime)
        : 0;

      // Detect potential memory leaks
      const leaks = this.detectMemoryLeaks(samples);

      const profile: MemoryProfile = {
        samples,
        startTime,
        endTime,
        peakMemory,
        growthRate,
        leaks
      };

      this.memoryProfiles.set(name, profile);

      // Save profile if output directory specified
      if (opts.outputDir) {
        this.saveMemoryProfile(name, profile, opts.outputDir);
      }

      return { result, profile };
    } catch (error) {
      clearInterval(samplingInterval);
      throw error;
    }
  }

  /**
   * Process V8 CPU profile
   */
  private processCpuProfile(profile: any, samples: ProfileNode[]): void {
    if (!profile || !profile.nodes) {
      return;
    }

    // Process profile nodes
    for (const node of profile.nodes) {
      const profileNode: ProfileNode = {
        name: node.callFrame.functionName || node.callFrame.url || 'anonymous',
        scriptName: node.callFrame.url,
        lineNumber: node.callFrame.lineNumber,
        columnNumber: node.callFrame.columnNumber,
        time: node.hitCount || 0,
        selfTime: 0,
        callCount: node.hitCount || 0,
        percentage: 0
      };
      samples.push(profileNode);
    }
  }

  /**
   * Calculate times and percentages for profile nodes
   */
  private calculateNodeTimes(node: ProfileNode, totalTime: number): void {
    if (node.children) {
      let childrenTime = 0;
      for (const child of node.children) {
        this.calculateNodeTimes(child, totalTime);
        childrenTime += child.time;
      }
      node.selfTime = node.time - childrenTime;
    } else {
      node.selfTime = node.time;
    }
    node.percentage = totalTime > 0 ? (node.time / totalTime) * 100 : 0;
  }

  /**
   * Find hot path (most time-consuming path) in profile
   */
  private findHotPath(root: ProfileNode): ProfileNode[] {
    const hotPath: ProfileNode[] = [];
    let current = root;

    while (current) {
      hotPath.push(current);

      if (!current.children || current.children.length === 0) {
        break;
      }

      // Find child with maximum self time
      const hottestChild = current.children.reduce((max, child) =>
        child.selfTime > max.selfTime ? child : max
      );

      current = hottestChild;
    }

    return hotPath;
  }

  /**
   * Detect potential memory leaks
   */
  private detectMemoryLeaks(samples: MemorySample[]): MemoryLeakInfo[] {
    const leaks: MemoryLeakInfo[] = [];

    if (samples.length < 10) {
      return leaks;
    }

    // Calculate growth trend
    const firstHalf = samples.slice(0, Math.floor(samples.length / 2));
    const secondHalf = samples.slice(Math.floor(samples.length / 2));

    const avgFirstHalf = firstHalf.reduce((sum, s) => sum + s.heapUsed, 0) / firstHalf.length;
    const avgSecondHalf = secondHalf.reduce((sum, s) => sum + s.heapUsed, 0) / secondHalf.length;

    const growthRate = (avgSecondHalf - avgFirstHalf) / avgFirstHalf;

    // Check for significant continuous growth
    if (growthRate > 0.1) {
      leaks.push({
        description: 'Continuous heap growth detected',
        count: samples.length,
        size: avgSecondHalf - avgFirstHalf,
        growthRate,
        confidence: growthRate > 0.3 ? 'high' : growthRate > 0.2 ? 'medium' : 'low'
      });
    }

    return leaks;
  }

  /**
   * Save CPU profile to file
   */
  private saveCpuProfile(name: string, profile: CpuProfile, outputDir: string): void {
    try {
      mkdirSync(outputDir, { recursive: true });

      // Save as JSON
      const jsonPath = join(outputDir, `${name}.cpuprofile.json`);
      writeFileSync(jsonPath, JSON.stringify(profile, null, 2));

      // Generate and save flame graph
      if (profile.flameGraph) {
        const flameGraphPath = join(outputDir, `${name}-flamegraph.json`);
        writeFileSync(flameGraphPath, JSON.stringify(this.generateFlameGraph(profile), null, 2));
      }
    } catch (error) {
      console.error('Failed to save CPU profile:', error);
    }
  }

  /**
   * Save memory profile to file
   */
  private saveMemoryProfile(name: string, profile: MemoryProfile, outputDir: string): void {
    try {
      mkdirSync(outputDir, { recursive: true });

      const path = join(outputDir, `${name}.memoryprofile.json`);
      writeFileSync(path, JSON.stringify(profile, null, 2));
    } catch (error) {
      console.error('Failed to save memory profile:', error);
    }
  }

  /**
   * Generate flame graph data from CPU profile
   */
  private generateFlameGraph(profile: CpuProfile): any {
    const flames: any[] = [];

    const processNode = (node: ProfileNode, depth: number = 0) => {
      const flame = {
        name: node.name,
        value: node.time,
        children: node.children?.map(child => processNode(child, depth + 1))
      };
      return flame;
    };

    for (const node of profile.nodes) {
      flames.push(processNode(node));
    }

    return { name: 'root', children: flames };
  }

  /**
   * Get CPU profile by name
   */
  getCpuProfile(name: string): CpuProfile | undefined {
    return this.cpuProfiles.get(name);
  }

  /**
   * Get memory profile by name
   */
  getMemoryProfile(name: string): MemoryProfile | undefined {
    return this.memoryProfiles.get(name);
  }

  /**
   * Get all CPU profiles
   */
  getAllCpuProfiles(): Map<string, CpuProfile> {
    return this.cpuProfiles;
  }

  /**
   * Get all memory profiles
   */
  getAllMemoryProfiles(): Map<string, MemoryProfile> {
    return this.memoryProfiles;
  }

  /**
   * Clear all profiles
   */
  clearProfiles(): void {
    this.cpuProfiles.clear();
    this.memoryProfiles.clear();
  }
}

/**
 * Convenience function to profile CPU usage
 */
export async function profileCpu<T>(
  name: string,
  fn: () => Promise<T>,
  options?: Partial<ProfileOptions>
): Promise<{ result: T; profile: CpuProfile }> {
  const profiler = new ProfilerIntegration();
  return profiler.profileCpu(name, fn, options);
}

/**
 * Convenience function to profile memory usage
 */
export async function profileMemory<T>(
  name: string,
  fn: () => Promise<T>,
  options?: Partial<ProfileOptions>
): Promise<{ result: T; profile: MemoryProfile }> {
  const profiler = new ProfilerIntegration();
  return profiler.profileMemory(name, fn, options);
}
