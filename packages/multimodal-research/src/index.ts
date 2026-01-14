/**
 * Multimodal AI Research Framework
 * Comprehensive toolkit for vision-language models, audio processing, and cross-modal embeddings
 */

// Vision module exports
export {
  // Vision transformers and models
  VisionTransformer,
  ViTConfig,
  VisionLanguageModel,
  SwinTransformer,
  SwinConfig,
  ConvNeXt,
  ConvNeXtConfig,
  DetectionModel,

  // Vision utilities
  ImageProcessor,
  OCRPipeline,
  OCRResult,
  CodeExtractor,
  ExtractedCode,

  // Types
  type ImageInput,
  type ImageEmbedding,
  type ImageMetadata,
  type VisionModelConfig,
  type ObjectDetection,
  type BoundingBox,
  type ImageSegmentation,
  type Captions,
  type VisualQuestionAnswer
} from './vision';

// Audio module exports
export {
  // Audio models
  WhisperModel,
  WhisperConfig,
  AudioClassifier,
  SpeakerIdentificationModel,
  EmotionRecognitionModel,

  // Audio feature extraction
  AudioFeatureExtractor,
  AdvancedAudioFeatures,

  // Types
  type AudioInput,
  type AudioEmbedding,
  type AudioMetadata,
  type AudioModelConfig,
  type SpeechRecognitionResult,
  type WordTimestamp,
  type AudioClassification,
  type SpeakerIdentification,
  type EmotionRecognition
} from './audio';

// Embeddings module exports
export {
  // Cross-modal encoders
  CLIPEncoder,
  CLIPEncoderConfig,
  UniversalEmbeddingSpace,
  UniversalEmbeddingConfig,

  // Contrastive learning
  ContrastiveLearning,

  // Multi-task learning
  MultiTaskEmbedding,
  MultiTaskConfig,

  // Alignment and evaluation
  EmbeddingAlignment,
  EmbeddingEvaluator,

  // Types
  type CrossModalEmbedding,
  type EmbeddingSpace,
  type Modality,
  type ContrastivePair,
  type Triplet
} from './embeddings';

// Fusion module exports
export {
  // Fusion strategies
  EarlyFusion,
  LateFusion,
  HybridFusion,
  AttentionFusion,
  TransformerFusion,
  GatedFusion,

  // Types
  type FusionConfig,
  type FusionResult,
  type FusionStrategy
} from './fusion';

// Benchmarks module exports
export {
  // Vision benchmarks
  ImageNetBenchmark,
  ImageNetConfig,
  COCOBenchmark,
  COCOConfig,
  VQABenchmark,
  VQAConfig,
  COCOCaptionsBenchmark,
  RetrievalBenchmark,
  RetrievalConfig,

  // Audio benchmarks
  LibrispeechBenchmark,
  LibrispeechConfig,
  AudioSetBenchmark,
  AudioSetConfig,
  VoxCelebBenchmark,
  VoxCelebConfig,
  IEMOCAPBenchmark,
  IEMOCAPConfig,

  // Types
  type BenchmarkConfig,
  type BenchmarkResult,
  type BenchmarkMetric
} from './benchmarks';

// Experiments module exports
export {
  // Experiment tracking
  ExperimentTracker,
  HyperparameterTuner,
  ModelCheckpoint,
  EarlyStopping,

  // Types
  type ExperimentConfig,
  type ExperimentRun,
  type MetricHistory,
  type Artifact,
  type HyperparameterSearch
} from './experiments';

// Utility exports
export {
  MathUtils,
  DataUtils,
  DataLoader,
  ImageUtils,
  AudioUtils,
  FileUtils,
  ValidationUtils,
  Logger,
  LogLevel,
  type LogEntry
} from './utils';

// Core types
export type {
  // Input types
  TextInput,
  TextInput as TextEmbeddingInput,

  // Tensor types
  Tensor,
  BatchInput,
  ModelOutput,

  // Evaluation types
  EvaluationMetrics,
  InferenceResult,

  // Training types
  TrainingConfig,
  SchedulerConfig,
  EarlyStoppingConfig
} from './types';

// ============================================================================
// Main API Classes
// ============================================================================

/**
 * Main class for multimodal AI research
 */
export class MultimodalResearch {
  private visionModels: Map<string, any>;
  private audioModels: Map<string, any>;
  private embeddingModels: Map<string, any>;
  private fusionModels: Map<string, any>;

  constructor() {
    this.visionModels = new Map();
    this.audioModels = new Map();
    this.embeddingModels = new Map();
    this.fusionModels = new Map();
  }

  /**
   * Create vision transformer
   */
  createVisionTransformer(config: Partial<ViTConfig> = {}): VisionTransformer {
    const defaultConfig: ViTConfig = {
      architecture: 'vit',
      embeddingSize: 768,
      patchSize: 16,
      numLayers: 12,
      numHeads: 12,
      hiddenSize: 768,
      dropout: 0.1,
      attentionDropout: 0.1
    };

    const model = new VisionTransformer({ ...defaultConfig, ...config });
    this.visionModels.set('vit', model);
    return model;
  }

  /**
   * Create speech recognition model
   */
  createSpeechRecognitionModel(config: Partial<WhisperConfig> = {}): WhisperModel {
    const defaultConfig: WhisperConfig = {
      architecture: 'whisper',
      embeddingSize: 512,
      sampleRate: 16000,
      windowSize: 512,
      hopLength: 256,
      numLayers: 6,
      numHeads: 8,
      hiddenSize: 512,
      vocabSize: 51865,
      maxContext: 448,
      pretrained: undefined
    };

    const model = new WhisperModel({ ...defaultConfig, ...config } as WhisperConfig);
    this.audioModels.set('whisper', model);
    return model;
  }

  /**
   * Create CLIP encoder
   */
  createCLIPEncoder(config: Partial<CLIPEncoderConfig> = {}): CLIPEncoder {
    const defaultConfig: CLIPEncoderConfig = {
      embeddingDim: 512,
      imageModel: 'vit',
      textModel: 'bert',
      temperature: 0.07,
      projectionDim: 512
    };

    const encoder = new CLIPEncoder({ ...defaultConfig, ...config });
    this.embeddingModels.set('clip', encoder);
    return encoder;
  }

  /**
   * Create fusion model
   */
  createFusionModel(
    strategy: FusionStrategy,
    config: Partial<FusionConfig> = {}
  ): EarlyFusion | LateFusion | HybridFusion | AttentionFusion | TransformerFusion | GatedFusion {
    const defaultConfig: FusionConfig = {
      strategy,
      dimensions: 512,
      numLayers: 2,
      numHeads: 8,
      dropout: 0.1
    };

    const fullConfig = { ...defaultConfig, ...config };

    let model;
    switch (strategy) {
      case 'early':
        model = new EarlyFusion(fullConfig);
        break;
      case 'late':
        model = new LateFusion(fullConfig);
        break;
      case 'hybrid':
        model = new HybridFusion(fullConfig);
        break;
      case 'attention':
        model = new AttentionFusion(fullConfig, ['image', 'text', 'audio']);
        break;
      case 'transformer':
        model = new TransformerFusion(fullConfig);
        break;
      case 'gated':
        model = new GatedFusion(fullConfig, 3);
        break;
      default:
        throw new Error(`Unknown fusion strategy: ${strategy}`);
    }

    this.fusionModels.set(strategy, model);
    return model;
  }

  /**
   * Get registered model
   */
  getModel(type: 'vision' | 'audio' | 'embedding' | 'fusion', name: string): unknown {
    const models = type === 'vision' ? this.visionModels :
                   type === 'audio' ? this.audioModels :
                   type === 'embedding' ? this.embeddingModels :
                   this.fusionModels;

    return models.get(name);
  }

  /**
   * List registered models
   */
  listModels(type?: 'vision' | 'audio' | 'embedding' | 'fusion'): string[] {
    if (!type) {
      const all = [
        ...this.visionModels.keys(),
        ...this.audioModels.keys(),
        ...this.embeddingModels.keys(),
        ...this.fusionModels.keys()
      ];
      return Array.from(new Set(all));
    }

    const models = type === 'vision' ? this.visionModels :
                   type === 'audio' ? this.audioModels :
                   type === 'embedding' ? this.embeddingModels :
                   this.fusionModels;

    return Array.from(models.keys());
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a new multimodal research instance
 */
export function createMultimodalResearch(): MultimodalResearch {
  return new MultimodalResearch();
}

/**
 * Quick image embedding
 */
export async function embedImage(image: ImageInput): Promise<ImageEmbedding> {
  const research = new MultimodalResearch();
  const model = research.createVisionTransformer();
  await model.initialize();
  return model.embed(image);
}

/**
 * Quick audio transcription
 */
export async function transcribeAudio(audio: AudioInput): Promise<SpeechRecognitionResult> {
  const research = new MultimodalResearch();
  const model = research.createSpeechRecognitionModel();
  return model.transcribe(audio);
}

/**
 * Quick image-text similarity
 */
export async function imageTextSimilarity(image: ImageInput, text: string): Promise<number> {
  const research = new MultimodalResearch();
  const encoder = research.createCLIPEncoder();

  const textInput: TextInput = { text };
  return encoder.similarity(image, textInput);
}

/**
 * Quick multimodal fusion
 */
export async function fuseModalities(
  embeddings: Map<string, Float32Array>,
  strategy: FusionStrategy = 'attention'
): Promise<FusionResult> {
  const research = new MultimodalResearch();
  const model = research.createFusionModel(strategy);

  const modalityMap = new Map(
    Array.from(embeddings.entries()).map(([k, v]) => [k as Modality, v])
  );

  return model.fuse(modalityMap);
}

// Version
export const VERSION = '0.1.0';

// Import all necessary types
import type { ViTConfig } from './vision/transformer';
import type { WhisperConfig } from './audio/models';
import type { CLIPEncoderConfig } from './embeddings/models';
import type { FusionConfig, FusionStrategy, FusionResult } from './types';
import type { Modality } from './types';
