/**
 * Fusion Module Exports
 */

export { EarlyFusion } from './strategies';
export { LateFusion } from './strategies';
export { HybridFusion } from './strategies';
export { AttentionFusion } from './strategies';
export { TransformerFusion } from './strategies';
export { GatedFusion } from './strategies';

// Re-export types from main types module
export type {
  FusionConfig,
  FusionResult,
  FusionStrategy,
  Modality
} from '../types';
