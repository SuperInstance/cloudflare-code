/**
 * Memory leak detection module
 * Exports memory analysis functionality
 */

export { MemoryLeakDetector } from './leak-detector';
export { HeapAnalyzer } from './heap-analyzer';
export type {
  LeakDetectionOptions,
  HeapStatistics,
  ObjectReference,
} from './leak-detector';
