/**
 * ClaudeFlare Pipelines - Ultra-Optimized
 * Advanced pipeline and workflow system
 */

export * from './types';
export { PipelineEngine } from './engine';
export { PipelineBuilder } from './builder';
export { StageExecutor } from './executor';
export { PipelineMonitor } from './monitor';
export { PipelineSystem, createPipelineSystem } from './system';

export const VERSION = '1.0.0';
export default PipelineSystem;
