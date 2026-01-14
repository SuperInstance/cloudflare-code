/**
 * ClaudeFlare Observability Package
 * Advanced debugging and observability tools for distributed systems
 *
 * @packageDocumentation
 */

// Main exports
export { Observability, createObservability } from './observability';

// Module exports
export { DistributedTracer, TraceExporter, TraceVisualizer } from './tracing';
export { StructuredLogger, LogStream, LogExporter } from './logging';
export { CPUProfiler, MemoryProfiler } from './profiling';
export { MemoryLeakDetector, HeapAnalyzer } from './memory';
export { HTTPInspector } from './inspection';
export { DebugRecorder, SessionReplayer } from './recording';

// Utility exports
export * from './utils';

// Type exports
export * from './types';

// Version
export const VERSION = '0.1.0';
