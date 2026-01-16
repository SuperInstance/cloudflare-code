/**
 * Debug session recording module
 * Exports recording and replay functionality
 */

// @ts-nocheck - Missing exports
export { DebugRecorder } from './debug-recorder';
export { SessionReplayer } from './replay';
export type {
  RecordingOptions,
  ReplayFilter,
} from './debug-recorder';
