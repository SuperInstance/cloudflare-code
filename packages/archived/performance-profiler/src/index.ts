/**
 * ClaudeFlare Performance Profiler - Ultra-Optimized
 * Advanced performance profiling and optimization tools
 */

export * from './types';

// Core profiling components
export { CPUProfiler, startProfiling, profileFunction } from './cpu/profiler';
export { MemoryProfiler, startMemoryProfiling, profileMemory } from './memory/profiler';
export { ExecutionTracer, createTracer, trace } from './tracing/tracer';
export { PerformanceAnalyzer, createAnalyzer } from './analytics/analyzer';

// Main system
export { PerformanceProfiler, createPerformanceProfiler } from './system';

export const VERSION = '1.0.0';
export default PerformanceProfiler;
