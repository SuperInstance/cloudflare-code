/**
 * Attention mechanism type definitions
 */

import { AttentionPattern } from './explanations';

// ============================================================================
// Core Attention Types
// ============================================================================

export interface AttentionVisualization {
  layer: number;
  head: number;
  tokens: string[];
  weights: number[][];
  heatmap: HeatmapData;
  patterns: AttentionPattern[];
}

export interface AttentionConfig {
  layer?: number;
  head?: number;
  aggregateLayers?: boolean;
  aggregateHeads?: boolean;
  normalization?: 'softmax' | 'layer_norm' | 'none';
}

export interface AttentionWeights {
  layer: number;
  head: number;
  weights: number[][];
  tokens: string[];
}

export interface HeatmapData {
  rows: string[];
  cols: string[];
  values: number[][];
  colorScale?: string;
  annotations?: string[][];
}

export interface AttentionHead {
  layer: number;
  head: number;
  weights: number[][];
  tokens: string[];
  queryProjection: number[][];
  keyProjection: number[][];
  valueProjection: number[][];
}

export interface MultiHeadAttention {
  layers: AttentionLayer[];
  numLayers: number;
  numHeads: number;
  hiddenSize: number;
}

export interface AttentionLayer {
  layerIndex: number;
  heads: AttentionHead[];
  aggregatedWeights?: number[][];
  patterns: AttentionPattern[];
}

// ============================================================================
// Attention Analysis Types
// ============================================================================

export interface AttentionAnalysis {
  layerAnalysis: LayerAttentionAnalysis[];
  globalPatterns: GlobalPattern[];
  headImportance: HeadImportance[];
  tokenImportance: TokenImportance[];
}

export interface LayerAttentionAnalysis {
  layer: number;
  dominantPattern: AttentionPattern;
  entropy: number;
  sparsity: number;
  focus: number;
  diversity: number;
}

export interface GlobalPattern {
  type: 'local' | 'global' | 'diagonal' | 'vertical' | 'heterogeneous';
  frequency: number;
  layers: number[];
  heads: number[];
  description: string;
}

export interface HeadImportance {
  layer: number;
  head: number;
  importance: number;
  role: string;
  specializedIn: string[];
}

export interface TokenImportance {
  token: string;
  position: number;
  importance: number;
  sources: number[];
  targets: number[];
}

// ============================================================================
// Attention Flow Types
// ============================================================================

export interface AttentionFlow {
  flowMatrix: number[][];
  flowPath: FlowPath[];
  criticalNodes: FlowNode[];
  flowMetrics: FlowMetrics;
}

export interface FlowPath {
  from: number;
  to: number;
  flow: number;
  layers: number[];
  heads: number[];
}

export interface FlowNode {
  token: string;
  position: number;
  inputFlow: number;
  outputFlow: number;
  throughFlow: number;
}

export interface FlowMetrics {
  totalFlow: number;
  averagePathLength: number;
  bottlenecks: number[];
  dispersal: number;
  integration: number;
}

// ============================================================================
// Rollout Attention Types
// ============================================================================

export interface RolloutConfig {
  startLayer?: number;
  endLayer?: number;
  normalization?: 'softmax' | 'layer_norm' | 'none';
  aggregation?: 'sum' | 'mean' | 'max';
}

export interface RolloutAttention {
  rolloutMatrix: number[][];
  cumulativeAttention: number[][];
  tokenContributions: TokenContribution[];
}

export interface TokenContribution {
  token: string;
  position: number;
  totalContribution: number;
  contributionByLayer: number[];
  contributionByHead: number[][];
}

// ============================================================================
// Attention Visualization Types
// ============================================================================

export interface AttentionVisualizationConfig {
  layer?: number;
  head?: number;
  aggregateLayers?: boolean;
  aggregateHeads?: boolean;
  threshold?: number;
  colorScheme?: 'blue' | 'red' | 'green' | 'viridis' | 'plasma';
  showValues?: boolean;
  showTokens?: boolean;
}

export interface AttentionHeatmap {
  layer: number;
  head: number;
  heatmap: HeatmapData;
  summary: HeatmapSummary;
}

export interface HeatmapSummary {
  maxAttention: number;
  minAttention: number;
  averageAttention: number;
  sparsity: number;
  entropy: number;
  dominantPatterns: string[];
}

export interface AttentionGraph {
  nodes: AttentionNode[];
  edges: AttentionEdge[];
  layout: 'force' | 'circular' | 'hierarchical' | 'random';
}

export interface AttentionNode {
  id: string;
  token: string;
  position: number;
  importance: number;
  layer: number;
  attributes?: Record<string, any>;
}

export interface AttentionEdge {
  from: number;
  to: number;
  weight: number;
  layer: number;
  head?: number;
  color?: string;
}

// ============================================================================
// Attention Metrics Types
// ============================================================================

export interface AttentionMetrics {
  entropy: number;
  sparsity: number;
  focus: number;
  uniformity: number;
  specialization: number;
  diversity: number;
}

export interface AttentionComparison {
  modelA: string;
  modelB: string;
  layerComparison: LayerComparison[];
  headComparison: HeadComparison[];
  patternSimilarity: number;
}

export interface LayerComparison {
  layer: number;
  modelAMetrics: AttentionMetrics;
  modelBMetrics: AttentionMetrics;
  similarity: number;
}

export interface HeadComparison {
  layer: number;
  head: number;
  modelAPattern: AttentionPattern;
  modelBPattern: AttentionPattern;
  similarity: number;
}

// ============================================================================
// Attention Intervention Types
// ============================================================================

export interface AttentionIntervention {
  type: 'suppress' | 'enhance' | 'redirect' | 'swap';
  layer: number;
  head: number;
  target: number[];
  effect?: InterventionEffect;
}

export interface InterventionEffect {
  predictionChange: number;
  confidenceChange: number;
  outputChange: string;
  description: string;
}

export interface AttentionAblation {
  ablatedLayers: number[];
  ablatedHeads: number[][];
  performance: AblationPerformance;
  robustness: number;
  importance: number[];
}

export interface AblationPerformance {
  accuracy: number;
  f1Score: number;
  confidence: number;
  calibration: number;
}

// ============================================================================
// Attention Debugging Types
// ============================================================================

export interface AttentionDebugging {
  suspiciousPatterns: SuspiciousPattern[];
  anomalies: AttentionAnomaly[];
  recommendations: string[];
}

export interface SuspiciousPattern {
  type: 'attention_sink' | 'attention_dropout' | 'repeated_pattern' | 'uniform_attention';
  layer: number;
  head: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: number[];
}

export interface AttentionAnomaly {
  layer: number;
  head: number;
  anomalyType: string;
  zScore: number;
  description: string;
  suggestedAction: string;
}

// ============================================================================
// Attention Recording Types
// ============================================================================

export interface AttentionRecording {
  recordingId: string;
  timestamp: Date;
  input: string | number[];
  attentionWeights: number[][][][];
  metadata: RecordingMetadata;
}

export interface RecordingMetadata {
  modelId: string;
  modelVersion: string;
  layers: number;
  heads: number;
  contextLength: number;
  batchSize?: number;
}

export interface AttentionQuery {
  layers?: number[];
  heads?: number[];
  positions?: number[];
  threshold?: number;
  patternTypes?: string[];
}

export interface AttentionSearchResult {
  matches: AttentionMatch[];
  totalMatches: number;
  query: AttentionQuery;
}

export interface AttentionMatch {
  recordingId: string;
  layer: number;
  head: number;
  position: number;
  weight: number;
  pattern: AttentionPattern;
  similarity: number;
}
