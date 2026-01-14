/**
 * Cross-Modal Embeddings Module Exports
 */

export { CLIPEncoder, CLIPEncoderConfig } from './models';
export { UniversalEmbeddingSpace, UniversalEmbeddingConfig } from './models';
export { ContrastiveLearning } from './models';
export { MultiTaskEmbedding, MultiTaskConfig } from './models';
export { EmbeddingAlignment } from './alignment';
export { EmbeddingEvaluator } from './evaluator';

// Re-export types from main types module
export type {
  ImageInput,
  AudioInput,
  TextInput,
  ImageEmbedding,
  AudioEmbedding,
  TextEmbedding,
  CrossModalEmbedding,
  EmbeddingSpace,
  Modality,
  ContrastivePair,
  Triplet
} from '../types';
