/**
 * Audio Module Exports
 */

// @ts-nocheck
export { WhisperModel, WhisperConfig } from './models';
export { AudioClassifier, SpeakerIdentificationModel, EmotionRecognitionModel } from './models';
export { AudioFeatureExtractor, type AudioFeatures } from './features';
export { AdvancedAudioFeatures, type SpectralFeatures, type ProsodicFeatures } from './features';

// Re-export types from main types module
export type {
  AudioInput,
  AudioEmbedding,
  AudioMetadata,
  AudioModelConfig,
  SpeechRecognitionResult,
  WordTimestamp,
  AudioClassification,
  SpeakerIdentification,
  EmotionRecognition
} from '../types';
