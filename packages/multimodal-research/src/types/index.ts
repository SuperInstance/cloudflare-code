/**
 * Core type definitions for Multimodal AI Research Framework
 */

// ============================================================================
// Vision Types
// ============================================================================

export interface ImageInput {
  data: Uint8Array | ArrayBuffer;
  format?: 'png' | 'jpeg' | 'webp' | 'gif';
  width?: number;
  height?: number;
  metadata?: ImageMetadata;
}

export interface ImageMetadata {
  timestamp?: number;
  source?: string;
  device?: string;
  location?: GeoLocation;
  tags?: string[];
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
}

export interface VisionModelConfig {
  architecture: 'vit' | 'swin' | 'convnext' | 'resnet' | 'efficientnet';
  embeddingSize: number;
  patchSize?: number;
  numLayers?: number;
  numHeads?: number;
  hiddenSize?: number;
  pretrained?: string;
}

export interface ImageEmbedding {
  vector: Float32Array;
  dimensions: number;
  model: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ObjectDetection {
  boundingBox: BoundingBox;
  label: string;
  confidence: number;
  classId: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageSegmentation {
  mask: Uint8Array;
  label: string;
  confidence: number;
}

export interface Captions {
  captions: string[];
  confidence: number[];
  model: string;
}

export interface VisualQuestionAnswer {
  question: string;
  answer: string;
  confidence: number;
  reasoning?: string;
}

// ============================================================================
// Audio Types
// ============================================================================

export interface AudioInput {
  data: Float32Array | Int16Array | ArrayBuffer;
  sampleRate: number;
  channels?: number;
  duration?: number;
  format?: 'wav' | 'mp3' | 'ogg' | 'flac';
  metadata?: AudioMetadata;
}

export interface AudioMetadata {
  timestamp?: number;
  source?: string;
  device?: string;
  language?: string;
  speaker?: string;
  tags?: string[];
}

export interface AudioModelConfig {
  architecture: 'wav2vec' | 'whisper' | 'conformer' | 'transformer';
  embeddingSize: number;
  sampleRate: number;
  windowSize?: number;
  hopLength?: number;
  numLayers?: number;
  numHeads?: number;
  pretrained?: string;
}

export interface AudioEmbedding {
  vector: Float32Array;
  dimensions: number;
  model: string;
  timestamp: number;
  segmentStart?: number;
  segmentEnd?: number;
  metadata?: Record<string, unknown>;
}

export interface SpeechRecognitionResult {
  text: string;
  confidence: number;
  words?: WordTimestamp[];
  language?: string;
  model: string;
}

export interface WordTimestamp {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface AudioClassification {
  label: string;
  confidence: number;
  category: string;
  timestamp: number;
}

export interface SpeakerIdentification {
  speakerId: string;
  confidence: number;
  embedding: Float32Array;
  segmentStart: number;
  segmentEnd: number;
}

export interface EmotionRecognition {
  emotion: 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'neutral';
  confidence: number;
  arousal: number;
  valence: number;
}

// ============================================================================
// Text Types
// ============================================================================

export interface TextInput {
  text: string;
  language?: string;
  tokens?: string[];
  metadata?: TextMetadata;
}

export interface TextMetadata {
  timestamp?: number;
  source?: string;
  author?: string;
  tags?: string[];
}

export interface TextEmbedding {
  vector: Float32Array;
  dimensions: number;
  model: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Cross-Modal Embedding Types
// ============================================================================

export interface CrossModalEmbedding {
  image?: ImageEmbedding;
  audio?: AudioEmbedding;
  text?: TextEmbedding;
  fusion?: Float32Array;
  alignmentMatrix?: Float32Array;
  timestamp: number;
}

export interface EmbeddingSpace {
  dimension: number;
  modality: Modality;
  model: string;
  normalization?: 'L2' | 'none';
}

export type Modality = 'image' | 'audio' | 'text' | 'video' | 'multimodal';

export interface ContrastivePair {
  anchor: Float32Array;
  positive: Float32Array;
  negative: Float32Array;
  label: number;
}

export interface Triplet {
  anchor: Modality;
  positive: Modality;
  negative: Modality;
  anchorData: Float32Array;
  positiveData: Float32Array;
  negativeData: Float32Array;
}

// ============================================================================
// Fusion Types
// ============================================================================

export interface FusionConfig {
  strategy: FusionStrategy;
  dimensions: number;
  attentionHeads?: number;
  numLayers?: number;
  dropout?: number;
  normalization?: 'layer' | 'batch' | 'none';
  activation?: 'relu' | 'gelu' | 'swish';
}

export type FusionStrategy =
  | 'early'        // Concatenate raw features
  | 'late'         // Combine predictions
  | 'hybrid'       // Mix of early and late
  | 'attention'    // Cross-modal attention
  | 'transformer'  // Transformer-based fusion
  | 'gated'        // Gated fusion
  | 'coattention'; // Co-attention mechanism

export interface FusionResult {
  output: Float32Array;
  attentionWeights?: Float32Array[];
  modalityWeights?: Record<Modality, number>;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface AttentionWeights {
  query: Float32Array;
  key: Float32Array;
  value: Float32Array;
  weights: Float32Array;
}

// ============================================================================
// Benchmark Types
// ============================================================================

export interface BenchmarkConfig {
  name: string;
  dataset: string;
  metrics: BenchmarkMetric[];
  batchSizes?: number[];
  splits?: ('train' | 'validation' | 'test')[];
  seed?: number;
}

export type BenchmarkMetric =
  | 'accuracy'
  | 'precision'
  | 'recall'
  | 'f1'
  | 'auc'
  | 'map'
  | 'mrr'
  | 'bleu'
  | 'rouge'
  | 'meteor'
  | 'cer'
  | 'wer'
  | 'latency'
  | 'throughput'
  | 'memory';

export interface BenchmarkResult {
  benchmark: string;
  model: string;
  metrics: Record<string, number>;
  timestamp: number;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface DatasetSplit {
  name: string;
  size: number;
  samples: Sample[];
}

export interface Sample {
  id: string;
  inputs: Record<string, unknown>;
  labels: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Experiment Types
// ============================================================================

export interface ExperimentConfig {
  id: string;
  name: string;
  description?: string;
  model: ModelConfig;
  dataset: string;
  hyperparameters: Record<string, unknown>;
  metrics: string[];
  tracking: ExperimentTracking;
}

export interface ModelConfig {
  architecture: string;
  parameters: Record<string, unknown>;
  pretrained?: string;
}

export interface ExperimentTracking {
  tensorboard: boolean;
  checkpoints: boolean;
  logging: 'minimal' | 'medium' | 'verbose';
  saveInterval?: number;
}

export interface ExperimentRun {
  id: string;
  experimentId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  metrics: MetricHistory[];
  checkpoints: string[];
  artifacts: Artifact[];
  metadata?: Record<string, unknown>;
}

export interface MetricHistory {
  name: string;
  values: number[];
  steps: number[];
  timestamps: number[];
}

export interface Artifact {
  name: string;
  path: string;
  type: 'model' | 'checkpoint' | 'log' | 'visualization' | 'data';
  size: number;
  timestamp: number;
}

export interface HyperparameterSearch {
  parameter: string;
  values: (number | string)[];
  type: 'grid' | 'random' | 'bayesian';
  iterations?: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface Tensor {
  data: Float32Array;
  shape: number[];
  dtype: 'float32' | 'int32' | 'bool';
}

export interface BatchInput {
  images?: ImageInput[];
  audio?: AudioInput[];
  text?: TextInput[];
  metadata?: Record<string, unknown>;
}

export interface ModelOutput {
  logits?: Float32Array;
  embeddings?: Float32Array;
  predictions?: string[];
  confidence?: number[];
  metadata?: Record<string, unknown>;
}

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
  optimizer: 'adam' | 'sgd' | 'adamw' | 'rmsprop';
  scheduler?: SchedulerConfig;
  earlyStopping?: EarlyStoppingConfig;
}

export interface SchedulerConfig {
  type: 'step' | 'cosine' | 'exponential' | 'plateau';
  parameters: Record<string, number>;
}

export interface EarlyStoppingConfig {
  patience: number;
  minDelta: number;
  monitor: string;
  mode: 'min' | 'max';
}

export interface EvaluationMetrics {
  loss: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  customMetrics?: Record<string, number>;
}

export interface InferenceResult<T = unknown> {
  output: T;
  latency: number;
  memoryUsage: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}
