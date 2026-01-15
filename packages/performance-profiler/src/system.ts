/**
 * Performance Profiler System - Optimized
 */

import { CPUProfiler, startProfiling } from './cpu/profiler';
import { MemoryProfiler, startMemoryProfiling } from './memory/profiler';
import { ExecutionTracer, createTracer } from './tracing/tracer';
import { PerformanceAnalyzer, createAnalyzer } from './analytics/analyzer';

export interface PerformanceProfilerOptions {
  cpu?: any;
  memory?: any;
  tracing?: any;
  analytics?: any;
}

export class PerformanceProfiler {
  private cpuProfiler: CPUProfiler;
  private memoryProfiler: MemoryProfiler;
  private tracer: ExecutionTracer;
  private analyzer: PerformanceAnalyzer;

  constructor(options: PerformanceProfilerOptions = {}) {
    this.cpuProfiler = new CPUProfiler(options.cpu || {});
    this.memoryProfiler = new MemoryProfiler(options.memory || {});
    this.tracer = createTracer(options.tracing || {});
    this.analyzer = createAnalyzer(options.analytics || {});
  }

  async startProfiling(): Promise<void> {
    await Promise.all([startProfiling(), startMemoryProfiling()]);
  }

  async stopProfiling(): Promise<any> {
    const cpuResults = await this.cpuProfiler.getResults();
    const memoryResults = await this.memoryProfiler.getResults();
    return this.analyzer.analyze({ cpu: cpuResults, memory: memoryResults });
  }

  getStats(): any {
    return {
      cpu: this.cpuProfiler.getStats(),
      memory: this.memoryProfiler.getStats(),
      tracing: this.tracer.getStats(),
      analytics: this.analyzer.getStats()
    };
  }
}

export function createPerformanceProfiler(options: PerformanceProfilerOptions = {}): PerformanceProfiler {
  return new PerformanceProfiler(options);
}
