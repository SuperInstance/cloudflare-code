/**
 * Model type definitions for XAI
 */

// ============================================================================
// Core Model Types
// ============================================================================

export type ModelType =
  | 'classification'
  | 'regression'
  | 'transformer'
  | 'neural_network'
  | 'tree_ensemble'
  | 'linear'
  | 'svm'
  | 'knn'
  | 'gradient_boosting'
  | 'random_forest'
  | 'neural_network_deep'
  | 'neural_network_convolutional'
  | 'neural_network_recurrent';

export type PredictionType = number | string | string[] | number[];

export interface ModelInfo {
  id: string;
  name: string;
  type: ModelType;
  version: string;
  framework?: string;
  inputShape: number[];
  outputShape: number[];
  parameters: number;
  trainable: boolean;
}

export interface ModelMetadata {
  modelInfo: ModelInfo;
  trainingDate?: Date;
  trainingDataSize?: number;
  featureNames: string[];
  targetNames?: string[];
  featureTypes: FeatureType[];
  hyperparameters: Record<string, any>;
  performanceMetrics?: PerformanceMetrics;
}

export interface FeatureType {
  name: string;
  type: 'numeric' | 'categorical' | 'text' | 'image' | 'datetime' | 'boolean';
  range?: [number, number];
  categories?: string[];
  nullable: boolean;
}

export interface PerformanceMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  auc?: number;
  mse?: number;
  mae?: number;
  r2Score?: number;
  logLoss?: number;
}

// ============================================================================
// Prediction Types
// ============================================================================

export interface Prediction {
  modelId: string;
  modelVersion: string;
  input: Record<string, any> | any[];
  output: PredictionType;
  probability?: number | number[];
  confidence: number;
  timestamp: Date;
  latency?: number;
}

export interface PredictionExplanation {
  prediction: Prediction;
  explanationId: string;
  method: string;
  explanation: any;
  confidence: number;
  timestamp: Date;
}

export interface PredictionBatch {
  predictions: Prediction[];
  batchId: string;
  modelId: string;
  timestamp: Date;
  averageLatency?: number;
  throughput?: number;
}

// ============================================================================
// Model Interface Types
// ============================================================================

export interface PredictiveModel {
  predict(input: Record<string, any> | any[]): Promise<PredictionType>;
  predict_proba?(input: Record<string, any> | any[]): Promise<number | number[]>;
  getMetadata(): ModelMetadata;
  getModelInfo(): ModelInfo;
}

export interface ExplainedModel extends PredictiveModel {
  explain?(input: Record<string, any> | any[]): Promise<any>;
  getFeatureImportance?(): Promise<Record<string, number>>;
  getDecisionPath?(input: Record<string, any> | any[]): Promise<any[]>;
}

// ============================================================================
// Tree Model Types
// ============================================================================

export interface TreeModel {
  trees: Tree[];
  numTrees: number;
  maxDepth: number;
  numFeatures: number;
  featureImportances: number[];
}

export interface TreeNode {
  featureIndex?: number;
  threshold?: number;
  leftChild?: TreeNode;
  rightChild?: TreeNode;
  leafValue?: number;
  samples?: number;
  value?: number;
  impurity?: number;
  isLeaf: boolean;
  depth: number;
}

export type Tree = TreeNode;

export interface TreePath {
  featureIndex: number;
  featureName: string;
  threshold: number;
  operator: '<=' | '>';
  value: number;
  nodeIndex: number;
}

export interface TreeExplanation {
  paths: TreePath[][];
  leafValues: number[];
  contributions: number[];
  featureImportance: Record<string, number>;
}

// ============================================================================
// Neural Network Types
// ============================================================================

export interface NeuralNetwork {
  layers: Layer[];
  activations: ActivationFunction[];
  numParameters: number;
  inputShape: number[];
  outputShape: number[];
}

export interface Layer {
  index: number;
  type: 'dense' | 'conv2d' | 'lstm' | 'attention' | 'embedding' | 'dropout' | 'batch_norm' | 'pooling';
  units?: number;
  activation?: ActivationFunction;
  weights?: number[][];
  biases?: number[];
  inputShape: number[];
  outputShape: number[];
}

export type ActivationFunction =
  | 'relu'
  | 'sigmoid'
  | 'tanh'
  | 'softmax'
  | 'linear'
  | 'gelu'
  | 'swish'
  | 'leaky_relu';

export interface NeuralNetworkExplanation {
  layerActivations: number[][][];
  gradients: number[][][];
  gradientFlow: number[][];
  neuronImportance: number[][];
}

// ============================================================================
// Transformer Types
// ============================================================================

export interface TransformerModel {
  numLayers: number;
  numHeads: number;
  hiddenSize: number;
  vocabSize: number;
  maxLength: number;
  attentionMechanism: 'self' | 'cross' | 'both';
  encoder?: TransformerLayer[];
  decoder?: TransformerLayer[];
}

export interface TransformerLayer {
  selfAttention: AttentionLayer;
  feedForward: FeedForwardLayer;
  normalization: string;
}

export interface AttentionLayer {
  numHeads: number;
  headSize: number;
  queryProjection: number[][];
  keyProjection: number[][];
  valueProjection: number[][];
  outputProjection: number[][];
}

export interface FeedForwardLayer {
  hiddenSize: number;
  outputSize: number;
  activation: ActivationFunction;
  weights1: number[][];
  weights2: number[][];
}

export interface TransformerExplanation {
  attentionWeights: number[][][][];
  tokenEmbeddings: number[][];
  positionEmbeddings: number[][];
  layerOutputs: number[][][];
}

// ============================================================================
// Gradient Types
// ============================================================================

export interface GradientExplanation {
  inputGradients: number[];
  featureGradients: Record<string, number>;
  integratedGradients: number[];
  gradientSmoothed: number[];
  saliencyMap: number[][];
  gradCAM?: number[][];
}

export interface IntegratedGradientsConfig {
  baseline?: number[];
  numSteps?: number;
  method?: 'riemann_sum' | 'gauss_legendre';
  batchSize?: number;
}

export interface GradCAMConfig {
  targetLayer?: number;
  relu?: boolean;
  normalize?: boolean;
}

// ============================================================================
// Model Comparison Types
// ============================================================================

export interface ModelComparison {
  modelA: ModelInfo;
  modelB: ModelInfo;
  performanceComparison: PerformanceComparison;
  featureImportanceComparison: FeatureImportanceComparison;
  behaviorComparison: BehaviorComparison;
  recommendation: string;
}

export interface PerformanceComparison {
  metric: string;
  modelAValue: number;
  modelBValue: number;
  difference: number;
  significant: boolean;
  pValue?: number;
}[];

export interface FeatureImportanceComparison {
  features: FeatureImportanceDiff[];
  correlation: number;
  rankCorrelation: number;
  agreement: number;
}

export interface FeatureImportanceDiff {
  featureName: string;
  modelAImportance: number;
  modelBImportance: number;
  difference: number;
  rankA: number;
  rankB: number;
  rankDifference: number;
}

export interface BehaviorComparison {
  agreementRate: number;
  disagreementCases: number;
  confusionMatrix?: number[][];
  disagreementAnalysis: DisagreementAnalysis[];
}

export interface DisagreementAnalysis {
  caseId: string;
  modelAPrediction: PredictionType;
  modelBPrediction: PredictionType;
  correctPrediction?: PredictionType;
  difficulty: 'easy' | 'medium' | 'hard';
  features: string[];
}

// ============================================================================
// Model Testing Types
// ============================================================================

export interface ModelTestCase {
  testCaseId: string;
  input: Record<string, any> | any[];
  expectedOutput?: PredictionType;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ModelTestResult {
  testCaseId: string;
  prediction: PredictionType;
  expectedOutput?: PredictionType;
  correct?: boolean;
  confidence: number;
  explanation?: any;
  latency: number;
}

export interface ModelTestSuite {
  suiteId: string;
  name: string;
  description: string;
  testCases: ModelTestCase[];
  results: ModelTestResult[];
  summary: TestSummary;
}

export interface TestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  accuracy: number;
  averageConfidence: number;
  averageLatency: number;
  failures: string[];
}

// ============================================================================
// Model Monitoring Types
// ============================================================================

export interface ModelMonitoring {
  modelId: string;
  timestamp: Date;
  predictions: number;
  accuracy: number;
  confidence: number;
  drift: DataDrift;
  performance: PerformanceDrift;
  alerts: MonitoringAlert[];
}

export interface DataDrift {
  featureDrift: FeatureDrift[];
  overallDrift: number;
  significant: boolean;
}

export interface FeatureDrift {
  featureName: string;
  driftScore: number;
  driftType: 'covariate' | 'prior' | 'concept';
  significant: boolean;
}

export interface PerformanceDrift {
  metric: string;
  currentValue: number;
  baselineValue: number;
  change: number;
  significant: boolean;
}

export interface MonitoringAlert {
  alertType: 'drift' | 'performance' | 'data_quality' | 'anomaly';
  severity: 'low' | 'medium' | 'high';
  message: string;
  recommendation: string;
  timestamp: Date;
}
