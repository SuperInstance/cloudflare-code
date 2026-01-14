/**
 * Neural Architecture Search Type Definitions
 * Core types for the NAS system
 */

// ============================================================================
// Architecture Representation
// ============================================================================

export interface Architecture {
  id: string;
  genotype: Genotype;
  phenotype: Phenotype;
  metrics: ArchitectureMetrics;
  metadata: ArchitectureMetadata;
}

export interface Genotype {
  encoding: ArchitectureEncoding;
  constraints: ArchitectureConstraints;
  searchSpace: SearchSpace;
}

export interface Phenotype {
  layers: Layer[];
  connections: Connection[];
  topology: NetworkTopology;
}

export interface ArchitectureEncoding {
  type: 'direct' | 'cell-based' | 'path-based';
  representation: number[] | string[] | GraphEncoding;
  length: number;
}

export interface GraphEncoding {
  nodes: Node[];
  edges: Edge[];
  adjacencyMatrix: number[][];
}

export interface Node {
  id: string;
  type: LayerType;
  operation: Operation;
  parameters: LayerParameters;
}

export interface Edge {
  from: string;
  to: string;
  weight?: number;
}

// ============================================================================
// Search Space Definition
// ============================================================================

export interface SearchSpace {
  name: string;
  type: SearchSpaceType;
  layers: LayerSpace[];
  connections: ConnectionSpace;
  constraints: SearchConstraints;
  encoding: EncodingStrategy;
}

export type SearchSpaceType =
  | 'cell-based'
  | 'macro-architecture'
  | 'hierarchical'
  | 'neural-architecture'
  | 'differentiable';

export interface LayerSpace {
  types: LayerType[];
  operations: Operation[];
  parameterRanges: ParameterRange[];
  constraints: LayerConstraint[];
}

export interface ConnectionSpace {
  patterns: ConnectionPattern[];
  skipConnections: SkipConnectionConfig;
  normalization: NormalizationStrategy;
}

export interface SearchConstraints {
  maxLayers: number;
  minLayers: number;
  maxParameters: number;
  maxFLOPs: number;
  maxLatency: number;
  maxMemory: number;
}

export interface LayerConstraint {
  type: string;
  constraint: (layer: Layer) => boolean;
}

export interface SkipConnectionConfig {
  enabled: boolean;
  types: SkipConnectionType[];
  maxDepth: number;
  probability: number;
}

export type SkipConnectionType =
  | 'residual'
  | 'dense'
  | 'highway'
  | 'lstm'
  | 'attention';

export type NormalizationStrategy =
  | 'batch'
  | 'layer'
  | 'group'
  | 'instance'
  | 'none';

// ============================================================================
// Layer Definitions
// ============================================================================

export type LayerType =
  | 'conv1d'
  | 'conv2d'
  | 'conv3d'
  | 'depthwise-conv2d'
  | 'separable-conv2d'
  | 'transpose-conv2d'
  | 'dense'
  | 'lstm'
  | 'gru'
  | 'attention'
  | 'multihead-attention'
  | 'embed'
  | 'batch-normalization'
  | 'layer-normalization'
  | 'dropout'
  | 'pooling'
  | 'global-pooling'
  | 'flatten'
  | 'reshape'
  | 'concatenate'
  | 'add'
  | 'multiply'
  | 'activation'
  | 'up-sampling'
  | 'down-sampling';

export type Operation =
  | 'conv3x3'
  | 'conv5x5'
  | 'conv7x7'
  | 'dilated-conv3x3'
  | 'dilated-conv5x5'
  | 'max-pooling3x3'
  | 'avg-pooling3x3'
  | 'skip-connect'
  | 'zero'
  | 'identity'
  | 'sep-conv3x3'
  | 'sep-conv5x5'
  | 'dil-sep-conv3x3'
  | 'attention'
  | 'self-attention'
  | 'cross-attention';

export interface Layer {
  id: string;
  type: LayerType;
  operation: Operation;
  parameters: LayerParameters;
  inputs: string[];
  outputs: string[];
}

export interface LayerParameters {
  [key: string]: number | string | boolean | number[] | string[];
  filters?: number;
  kernelSize?: number | number[];
  strides?: number | number[];
  padding?: string;
  dilation?: number;
  units?: number;
  activation?: string;
  dropout?: number;
  useBias?: boolean;
  groups?: number;
  depthMultiplier?: number;
  attentionHeads?: number;
  keyDim?: number;
  valueDim?: number;
}

export interface ParameterRange {
  name: string;
  type: 'discrete' | 'continuous' | 'categorical';
  range: number[] | [number, number] | string[];
  default?: number | string;
}

export interface Connection {
  from: string;
  to: string;
  type: 'direct' | 'skip' | 'residual';
  weight?: number;
  operation?: Operation;
}

export interface ConnectionPattern {
  type: 'sequential' | 'dense' | 'residual' | 'multi-path' | 'dag';
  minSkipDepth: number;
  maxSkipDepth: number;
  skipProbability: number;
}

export interface NetworkTopology {
  type: 'sequential' | 'dag' | 'multi-path';
  depth: number;
  width: number;
  branches: number;
}

// ============================================================================
// Architecture Metadata
// ============================================================================

export interface ArchitectureMetadata {
  createdAt: number;
  updatedAt: number;
  parentId?: string;
  generation: number;
  source: string;
  tags: string[];
}

export interface ArchitectureConstraints {
  maxDepth: number;
  maxWidth: number;
  maxConnections: number;
  allowedOperations: Operation[];
  forbiddenPatterns: string[];
}

// ============================================================================
// Architecture Metrics
// ============================================================================

export interface ArchitectureMetrics {
  accuracy?: number;
  loss?: number;
  flops: number;
  parameters: number;
  memory: number;
  latency: number;
  energy: number;
  throughput?: number;
  utilization?: number;
  multiObjectiveScore?: number;
  paretoRank?: number;
  validationMetrics?: ValidationMetrics;
}

export interface ValidationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  confusionMatrix?: number[][];
  customMetrics?: Record<string, number>;
}

export interface BenchmarkResult {
  architecture: Architecture;
  metrics: ArchitectureMetrics;
  timestamp: number;
  hardware: HardwareSpec;
  duration: number;
}

export interface HardwareSpec {
  device: string;
  memory: number;
  cores: number;
  frequency: number;
  cache: number;
}

// ============================================================================
// Encoding Strategy
// ============================================================================

export interface EncodingStrategy {
  type: 'one-hot' | 'embedding' | 'variable' | 'path';
  dimension: number;
  vocabulary: Map<string, number>;
}

// ============================================================================
// Search Strategy Types
// ============================================================================

export interface SearchStrategy {
  name: string;
  type: SearchStrategyType;
  config: SearchConfig;
  state: SearchState;
}

export type SearchStrategyType =
  | 'evolutionary'
  | 'reinforcement-learning'
  | 'bayesian-optimization'
  | 'random-search'
  | 'grid-search'
  | 'hyperband'
  | 'darts'
  | 'enas'
  | 'pnas'
  | 'gradient-based';

export interface SearchConfig {
  maxIterations: number;
  populationSize: number;
  parallelism: number;
  budget: SearchBudget;
  objectives: OptimizationObjective[];
  constraints: SearchConstraints;
  earlyStopping?: EarlyStoppingConfig;
}

export interface SearchBudget {
  type: 'time' | 'flops' | 'iterations' | 'evaluations';
  limit: number;
  current: number;
}

export interface OptimizationObjective {
  name: string;
  metric: string;
  direction: 'minimize' | 'maximize';
  weight: number;
  target?: number;
}

export interface EarlyStoppingConfig {
  enabled: boolean;
  patience: number;
  minDelta: number;
  metric: string;
}

export interface SearchState {
  iteration: number;
  evaluated: number;
  bestArchitecture: Architecture;
  history: Architecture[];
  paretoFront: Architecture[];
  convergence: ConvergenceMetrics;
}

export interface ConvergenceMetrics {
  score: number;
  improvement: number;
  stability: number;
  diversity: number;
}

// ============================================================================
// Evolutionary Algorithm Types
// ============================================================================

export interface EvolutionaryConfig extends SearchConfig {
  mutation: MutationConfig;
  crossover: CrossoverConfig;
  selection: SelectionConfig;
  population: PopulationConfig;
}

export interface MutationConfig {
  rate: number;
  operators: MutationOperator[];
  strength: number;
  adaptive: boolean;
}

export type MutationOperator =
  | 'layer-add'
  | 'layer-remove'
  | 'layer-modify'
  | 'connection-add'
  | 'connection-remove'
  | 'connection-modify'
  | 'parameter-mutate'
  | 'path-add'
  | 'path-remove';

export interface CrossoverConfig {
  rate: number;
  type: CrossoverType;
  points: number;
}

export type CrossoverType =
  | 'single-point'
  | 'two-point'
  | 'uniform'
  | 'layer-based'
  | 'path-based';

export interface SelectionConfig {
  method: SelectionMethod;
  pressure: number;
  tournamentSize?: number;
  elitism?: number;
}

export type SelectionMethod =
  | 'tournament'
  | 'roulette'
  | 'rank'
  | 'sus'
  | 'pareto';

export interface PopulationConfig {
  size: number;
  initialization: InitializationStrategy;
  diversity: DiversityMaintenance;
}

export type InitializationStrategy =
  | 'random'
  | 'heuristic'
  | 'seeded'
  | 'guided';

export interface DiversityMaintenance {
  enabled: boolean;
  method: 'crowding' | 'sharing' | 'novelty' | 'none';
  threshold: number;
}

// ============================================================================
// Reinforcement Learning Types
// ============================================================================

export interface RLConfig extends SearchConfig {
  controller: ControllerConfig;
  reward: RewardConfig;
  policy: PolicyConfig;
  training: TrainingConfig;
}

export interface ControllerConfig {
  type: 'rnn' | 'lstm' | 'transformer' | 'mlp';
  hiddenSize: number[];
  attention: boolean;
  embedding: EmbeddingConfig;
}

export interface EmbeddingConfig {
  dimension: number;
  type: 'learned' | 'positional' | 'hybrid';
}

export interface RewardConfig {
  type: 'accuracy' | 'multi-objective' | 'custom';
  metrics: string[];
  weights: number[];
  baseline: 'moving-average' | 'exponential' | 'none';
  baselineDecay?: number;
  normalization: 'none' | 'z-score' | 'min-max';
}

export interface PolicyConfig {
  algorithm: 'reinforce' | 'ppo' | 'a3c' | 'actor-critic';
  learningRate: number;
  entropyCoefficient: number;
  valueLossCoefficient: number;
  gradientClip: number;
}

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  optimizer: OptimizerConfig;
  discount: number;
  episodeLength: number;
}

export interface OptimizerConfig {
  type: 'adam' | 'rmsprop' | 'sgd';
  learningRate: number;
  beta1?: number;
  beta2?: number;
  momentum?: number;
}

export interface Episode {
  id: string;
  architectures: Architecture[];
  rewards: number[];
  actions: Action[];
  states: State[];
  logProbabilities: number[];
  values?: number[];
  totalReward: number;
}

export interface Action {
  layerType: LayerType;
  operation: Operation;
  parameters: LayerParameters;
  connection?: Connection;
}

export interface State {
  encoding: ArchitectureEncoding;
  hidden: number[];
  attention?: AttentionWeights;
}

export interface AttentionWeights {
  weights: number[][];
  heads: number;
}

// ============================================================================
// Bayesian Optimization Types
// ============================================================================

export interface BayesianConfig extends SearchConfig {
  surrogate: SurrogateConfig;
  acquisition: AcquisitionConfig;
  kernel: KernelConfig;
  exploration: ExplorationConfig;
}

export interface SurrogateConfig {
  type: 'gaussian-process' | 'random-forest' | 'tpe' | 'boosting';
  noise: number;
  normalize: boolean;
}

export interface AcquisitionConfig {
  function: AcquisitionFunction;
  optimizeMethod: 'lbfgs' | 'direct' | 'sampling';
  samples: number;
}

export type AcquisitionFunction =
  | 'ei'
  | 'pi'
  | 'ucb'
  | 'thompson-sampling'
  | 'expected-hyper-improvement';

export interface KernelConfig {
  type: 'rbf' | 'matern' | 'rational-quadratic' | 'periodic';
  lengthScale: number | number[];
  variance: number;
  nu?: number;
}

export interface ExplorationConfig {
  initialSamples: number;
  randomFraction: number;
  kappa: number;
  xi: number;
}

export interface GaussianProcess {
  kernel: KernelConfig;
  noise: number;
  mean: number;
  X: number[][];
  y: number[];
  hyperparameters: number[];
}

// ============================================================================
// Evaluation Types
// ============================================================================

export interface EvaluationConfig {
  metrics: EvaluationMetric[];
  dataset: DatasetConfig;
  training: TrainingConfig;
  validation: ValidationConfig;
  hardware: HardwareSpec;
  fidelity: FidelityConfig;
}

export interface EvaluationMetric {
  name: string;
  type: 'accuracy' | 'loss' | 'flops' | 'latency' | 'memory' | 'energy' | 'custom';
  priority: number;
  target?: number;
}

export interface DatasetConfig {
  name: string;
  split: 'train' | 'val' | 'test' | 'full';
  subset?: number;
  preprocessing: string[];
  augmentation: string[];
}

export interface ValidationConfig {
  method: 'k-fold' | 'holdout' | 'leave-one-out';
  folds?: number;
  splitRatio?: number;
  stratified?: boolean;
  seed?: number;
}

export interface FidelityConfig {
  type: 'full' | 'partial' | 'low-fidelity' | 'multi-fidelity';
  epochs?: number;
  subsetRatio?: number;
  resolution?: number;
  proxy: boolean;
}

// ============================================================================
// Hyperparameter Optimization Types
// ============================================================================

export interface HyperparameterSpace {
  hyperparameters: HyperparameterDefinition[];
  constraints: HyperparameterConstraint[];
  conditional: ConditionalSpace[];
}

export interface HyperparameterDefinition {
  name: string;
  type: HyperparameterType;
  space: ParameterSpace;
  scale: 'linear' | 'log' | 'bilog';
  prior?: PriorDistribution;
}

export type HyperparameterType =
  | 'learning-rate'
  | 'batch-size'
  | 'optimizer'
  | 'weight-decay'
  | 'momentum'
  | 'dropout'
  | 'activation'
  | 'normalization'
  | 'custom';

export interface ParameterSpace {
  type: 'continuous' | 'discrete' | 'categorical';
  range: [number, number] | number[] | string[];
  steps?: number;
}

export interface PriorDistribution {
  type: 'uniform' | 'normal' | 'log-normal' | 'beta';
  parameters: number[];
}

export interface HyperparameterConstraint {
  type: 'equality' | 'inequality' | 'conditional';
  expression: string;
  hyperparameters: string[];
}

export interface ConditionalSpace {
  parent: string;
  condition: (value: any) => boolean;
  child: string;
  space: ParameterSpace;
}

export interface Hyperparameters {
  learningRate: number;
  batchSize: number;
  optimizer: string;
  weightDecay: number;
  momentum?: number;
  dropout?: number;
  activation?: string;
  [key: string]: any;
}

// ============================================================================
// Compression Types
// ============================================================================

export interface CompressionConfig {
  method: CompressionMethod;
  target: CompressionTarget;
  constraints: CompressionConstraints;
  schedule: CompressionSchedule;
}

export type CompressionMethod =
  | 'pruning'
  | 'quantization'
  | 'distillation'
  | 'factorization'
  | 'clustering'
  | 'hybrid';

export interface CompressionTarget {
  metric: string;
  ratio: number;
  tolerance: number;
}

export interface CompressionConstraints {
  accuracyDrop: number;
  latencyBudget: number;
  memoryBudget: number;
  energyBudget: number;
}

export interface CompressionSchedule {
  type: 'gradual' | 'one-shot' | 'automated' | 'iterative';
  phases: CompressionPhase[];
}

export interface CompressionPhase {
  epoch: number;
  target: number;
  method: CompressionMethod;
  fineTune: boolean;
}

// ============================================================================
// Pruning Types
// ============================================================================

export interface PruningConfig {
  method: PruningMethod;
  granularity: PruningGranularity;
  criterion: PruningCriterion;
  schedule: PruningSchedule;
  fineTuning: FineTuningConfig;
}

export type PruningMethod =
  | 'magnitude'
  | 'gradient'
  | 'structured'
  | 'unstructured'
  | 'iterative'
  | 'lottery-ticket'
  | 'snip'
  | 'synflow';

export type PruningGranularity =
  | 'weight'
  | 'filter'
  | 'channel'
  | 'layer'
  | 'block';

export type PruningCriterion =
  | 'magnitude'
  | 'gradient'
  | 'taylor'
  | 'hessian'
  | 'optimal-brain-surgeon'
  | 'movement';

export interface PruningSchedule {
  type: 'gradual' | 'one-shot' | 'automated';
  initialSparsity: number;
  targetSparsity: number;
  frequency: number;
  steps: number;
}

export interface FineTuningConfig {
  enabled: boolean;
  epochs: number;
  learningRate: number;
  schedule: string;
}

export interface PruningResult {
  originalArchitecture: Architecture;
  prunedArchitecture: Architecture;
  sparsity: number;
  metrics: ArchitectureMetrics;
  compressionRatio: number;
  speedup: number;
}

// ============================================================================
// Quantization Types
// ============================================================================

export interface QuantizationConfig {
  mode: QuantizationMode;
  precision: QuantizationPrecision;
  method: QuantizationMethod;
  calibration: CalibrationConfig;
  awareTraining: QuantizationAwareTrainingConfig;
}

export type QuantizationMode =
  | 'post-training'
  | 'quantization-aware'
  | 'dynamic'
  | 'static';

export interface QuantizationPrecision {
  weights: number;
  activations: number;
  gradients?: number;
  mixed: boolean;
  layers?: LayerPrecision[];
}

export interface LayerPrecision {
  layerId: string;
  precision: number;
  range: [number, number];
}

export type QuantizationMethod =
  | 'min-max'
  | 'kl-divergence'
  | 'percentile'
  | 'entropy'
  | 'learned'
  | 'gptq';

export interface CalibrationConfig {
  dataset: string;
  samples: number;
  batchSize: number;
  method: 'min-max' | 'entropy' | 'percentile';
}

export interface QuantizationAwareTrainingConfig {
  epochs: number;
  learningRate: number;
  fakeQuant: boolean;
  straightThrough: boolean;
}

export interface QuantizationResult {
  originalArchitecture: Architecture;
  quantizedArchitecture: Architecture;
  precision: QuantizationPrecision;
  metrics: ArchitectureMetrics;
  compressionRatio: number;
  speedup: number;
}

// ============================================================================
// Knowledge Distillation Types
// ============================================================================

export interface DistillationConfig {
  teacher: Architecture;
  temperature: number;
  loss: DistillationLoss;
  alpha: number;
  intermediate: IntermediateDistillationConfig;
  training: DistillationTrainingConfig;
}

export interface DistillationLoss {
  type: 'kl-divergence' | 'mse' | 'cosine' | 'custom';
  weight: number;
}

export interface IntermediateDistillationConfig {
  enabled: boolean;
  layers: LayerMapping[];
  loss: string;
  weight: number;
}

export interface LayerMapping {
  teacher: string;
  student: string;
  weight: number;
}

export interface DistillationTrainingConfig {
  epochs: number;
  learningRate: number;
  optimizer: string;
  schedule: string;
}

export interface DistillationResult {
  teacherArchitecture: Architecture;
  studentArchitecture: Architecture;
  metrics: ArchitectureMetrics;
  compressionRatio: number;
  distillationLoss: number;
}

// ============================================================================
// Ranking Types
// ============================================================================

export interface RankingConfig {
  method: RankingMethod;
  criteria: RankingCriteria[];
  aggregation: AggregationMethod;
  normalization: NormalizationMethod;
  diversity: DiversityConfig;
}

export type RankingMethod =
  | 'weighted-sum'
  | 'pareto'
  | 'lexicographic'
  | 'topsis'
  | 'analytic-hierarchy'
  | 'tournament'
  | 'machine-learning';

export interface RankingCriteria {
  name: string;
  weight: number;
  direction: 'minimize' | 'maximize';
  threshold?: number;
}

export type AggregationMethod =
  | 'weighted-sum'
  | 'geometric-mean'
  | 'harmonic-mean'
  | 'product'
  | 'min'
  | 'max';

export type NormalizationMethod =
  | 'min-max'
  | 'z-score'
  | 'vector'
  | 'ordinal'
  | 'none';

export interface DiversityConfig {
  enabled: boolean;
  method: 'novelty' | 'distance' | 'entropy';
  weight: number;
  threshold: number;
}

export interface RankingResult {
  architectures: RankedArchitecture[];
  paretoFront: Architecture[];
  diversityScore: number[];
  rankingTime: number;
}

export interface RankedArchitecture extends Architecture {
  rank: number;
  score: number;
  scores: Record<string, number>;
  diversity: number;
}

// ============================================================================
// Result and Export Types
// ============================================================================

export interface SearchResult {
  strategy: SearchStrategyType;
  iterations: number;
  bestArchitecture: Architecture;
  paretoFront: Architecture[];
  history: Architecture[];
  statistics: SearchStatistics;
  duration: number;
}

export interface SearchStatistics {
  totalEvaluated: number;
  uniqueArchitectures: number;
  convergence: number;
  diversity: number;
  improvementRate: number;
}

export interface ExportConfig {
  format: 'json' | 'yaml' | 'binary' | 'custom';
  includeMetrics: boolean;
  includeHistory: boolean;
  pretty: boolean;
}

export interface NASConfig {
  searchSpace: SearchSpace;
  strategy: SearchStrategy;
  evaluation: EvaluationConfig;
  hyperparameters: HyperparameterSpace;
  compression?: CompressionConfig;
  ranking: RankingConfig;
  export: ExportConfig;
}
