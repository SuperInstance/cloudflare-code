/**
 * Type definitions for the AI memory and learning system
 */

import { z } from 'zod';

// ============================================================================
// Memory Types
// ============================================================================

export enum MemoryType {
  EPISODIC = 'episodic',
  SEMANTIC = 'semantic',
  PROCEDURAL = 'procedural',
  WORKING = 'working',
}

export enum MemoryImportance {
  CRITICAL = 5,
  HIGH = 4,
  MEDIUM = 3,
  LOW = 2,
  TRIVIAL = 1,
}

export enum MemoryStatus {
  ACTIVE = 'active',
  CONSOLIDATING = 'consolidating',
  DORMANT = 'dormant',
  PRUNED = 'pruned',
}

export enum ConsolidationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// ============================================================================
// Base Memory Types
// ============================================================================

export interface BaseMemory {
  id: string;
  type: MemoryType;
  importance: MemoryImportance;
  status: MemoryStatus;
  createdAt: Date;
  updatedAt: Date;
  lastAccessed: Date;
  accessCount: number;
  embedding?: number[];
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface EpisodicMemory extends BaseMemory {
  type: MemoryType.EPISODIC;
  timestamp: Date;
  context: string;
  participants: string[];
  actions: Action[];
  outcome: string;
  emotionalWeight: number;
  relatedMemories: string[];
}

export interface SemanticMemory extends BaseMemory {
  type: MemoryType.SEMANTIC;
  content: string;
  category: string;
  confidence: number;
  source: string;
  examples: string[];
  relationships: SemanticRelationship[];
}

export interface ProceduralMemory extends BaseMemory {
  type: MemoryType.PROCEDURAL;
  name: string;
  description: string;
  steps: ProcedureStep[];
  preconditions: string[];
  postconditions: string[];
  successRate: number;
  executionTime: number;
  dependencies: string[];
}

export interface WorkingMemory extends BaseMemory {
  type: MemoryType.WORKING;
  content: string;
  capacity: number;
  decayRate: number;
  context: string;
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface Action {
  timestamp: Date;
  agent: string;
  action: string;
  parameters: Record<string, unknown>;
  result: string;
  duration: number;
}

export interface SemanticRelationship {
  type: 'related' | 'hierarchy' | 'causal' | 'temporal' | 'spatial';
  targetId: string;
  strength: number;
  description?: string;
}

export interface ProcedureStep {
  order: number;
  description: string;
  action: string;
  parameters: Record<string, unknown>;
  expectedOutcome: string;
  timeout: number;
}

// ============================================================================
// Knowledge Graph Types
// ============================================================================

export interface KnowledgeNode {
  id: string;
  type: 'concept' | 'entity' | 'event' | 'pattern' | 'procedure';
  label: string;
  properties: Record<string, unknown>;
  embedding?: number[];
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  properties: Record<string, unknown>;
  weight: number;
  confidence: number;
  createdAt: Date;
}

export interface KnowledgeGraph {
  nodes: Map<string, KnowledgeNode>;
  edges: Map<string, KnowledgeEdge[]>;
  adjacencyList: Map<string, Set<string>>;
  index: GraphIndex;
}

export interface GraphIndex {
  nodeTypeIndex: Map<string, Set<string>>;
  labelIndex: Map<string, Set<string>>;
  propertyIndex: Map<string, Set<string>>;
  fullTextIndex: Map<string, Set<string>>;
}

export interface GraphTraversal {
  path: string[];
  visited: Set<string>;
  currentDepth: number;
  accumulatedWeight: number;
}

// ============================================================================
// Consolidation Types
// ============================================================================

export interface ConsolidationTask {
  id: string;
  memoryType: MemoryType;
  memoryIds: string[];
  status: ConsolidationStatus;
  startedAt?: Date;
  completedAt?: Date;
  algorithm: ConsolidationAlgorithm;
  result?: ConsolidationResult;
}

export enum ConsolidationAlgorithm {
  SPACING_EFFECT = 'spacing_effect',
  INTERLEAVING = 'interleaving',
  RETRIEVAL_PRACTICE = 'retrieval_practice',
  ELABORATIVE = 'elaborative',
  CHUNKING = 'chunking',
  GENERALIZATION = 'generalization',
}

export interface ConsolidationResult {
  memoriesModified: number;
  memoriesMerged: number;
  newConnections: number;
  importanceUpdated: number;
  duration: number;
  timestamp: Date;
}

// ============================================================================
// Pruning Types
// ============================================================================

export interface PruningConfig {
  enabled: boolean;
  maxMemorySize: number;
  minImportance: number;
  maxAge: number;
  minAccessFrequency: number;
  decayRate: number;
  pruningThreshold: number;
  batchSize: number;
  preserveCritical: boolean;
}

export interface PruningResult {
  memoriesRemoved: number;
  spaceFreed: number;
  performanceImprovement: number;
  timestamp: Date;
  details: PruningDetail[];
}

export interface PruningDetail {
  memoryId: string;
  reason: string;
  importance: number;
  lastAccessed: Date;
}

export enum PruningStrategy {
  LRU = 'lru',
  LFU = 'lfu',
  IMPORTANCE_BASED = 'importance_based',
  TEMPORAL = 'temporal',
  COMPOSITE = 'composite',
}

// ============================================================================
// Learning Types
// ============================================================================

export interface LearningExperience {
  id: string;
  timestamp: Date;
  context: string;
  action: string;
  outcome: string;
  reward: number;
  state: Record<string, unknown>;
  nextState: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface LearningPattern {
  id: string;
  pattern: string;
  category: string;
  frequency: number;
  successRate: number;
  avgReward: number;
  lastSeen: Date;
  examples: LearningExperience[];
}

export interface LearningStrategy {
  name: string;
  description: string;
  algorithm: string;
  parameters: Record<string, unknown>;
  performance: PerformanceMetrics;
}

export interface PerformanceMetrics {
  totalTrials: number;
  successRate: number;
  avgReward: number;
  improvementRate: number;
  convergenceRate: number;
  lastUpdated: Date;
}

// ============================================================================
// Retrieval Types
// ============================================================================

export interface RetrievalQuery {
  query: string;
  type?: MemoryType;
  minImportance?: MemoryImportance;
  limit?: number;
  offset?: number;
  filters?: RetrievalFilter;
  sort?: RetrievalSort;
}

export interface RetrievalFilter {
  tags?: string[];
  dateRange?: { start: Date; end: Date };
  importance?: MemoryImportance[];
  status?: MemoryStatus[];
  metadata?: Record<string, unknown>;
}

export enum RetrievalSort {
  RELEVANCE = 'relevance',
  IMPORTANCE = 'importance',
  RECENCY = 'recency',
  ACCESS_COUNT = 'access_count',
  LAST_ACCESSED = 'last_accessed',
}

export interface RetrievalResult<T = BaseMemory> {
  memories: T[];
  totalCount: number;
  query: RetrievalQuery;
  duration: number;
  relevanceScores: number[];
}

// ============================================================================
// Vector Store Types
// ============================================================================

export interface VectorStoreConfig {
  dimension: number;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
  indexType: 'hnsw' | 'ivf' | 'flat';
  maxVectors: number;
  efConstruction: number;
  efSearch: number;
}

export interface Vector {
  id: string;
  values: number[];
  metadata: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface MemoryAnalytics {
  totalMemories: number;
  memoriesByType: Record<MemoryType, number>;
  memoriesByImportance: Record<MemoryImportance, number>;
  memoriesByStatus: Record<MemoryStatus, number>;
  avgAccessCount: number;
  storageUsed: number;
  retrievalLatency: number;
  consolidationRate: number;
  pruningRate: number;
  learningProgress: number;
}

export interface MemoryStats {
  dailyStats: DailyStats[];
  weeklyStats: WeeklyStats;
  monthlyStats: MonthlyStats;
}

export interface DailyStats {
  date: Date;
  memoriesAdded: number;
  memoriesAccessed: number;
  memoriesConsolidated: number;
  memoriesPruned: number;
  avgImportance: number;
}

export interface WeeklyStats {
  weekStart: Date;
  totalMemories: number;
  memoriesAdded: number;
  memoriesAccessed: number;
  avgSessionLength: number;
  topCategories: string[];
}

export interface MonthlyStats {
  month: Date;
  growthRate: number;
  retentionRate: number;
  learningVelocity: number;
  knowledgeCoverage: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface MemorySystemConfig {
  episodic: {
    enabled: boolean;
    maxMemories: number;
    consolidationInterval: number;
    retentionDays: number;
  };
  semantic: {
    enabled: boolean;
    vectorStore: VectorStoreConfig;
    maxMemories: number;
    updateInterval: number;
  };
  procedural: {
    enabled: boolean;
    maxProcedures: number;
    minSuccessRate: number;
    practiceInterval: number;
  };
  working: {
    capacity: number;
    decayRate: number;
    refreshThreshold: number;
  };
  knowledge: {
    enabled: boolean;
    maxNodes: number;
    maxEdges: number;
    updateThreshold: number;
  };
  learning: {
    enabled: boolean;
    algorithm: string;
    learningRate: number;
    explorationRate: number;
    discountFactor: number;
  };
  pruning: PruningConfig;
}

// ============================================================================
// Validation Schemas
// ============================================================================

export const BaseMemorySchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(MemoryType),
  importance: z.nativeEnum(MemoryImportance),
  status: z.nativeEnum(MemoryStatus),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastAccessed: z.date(),
  accessCount: z.number().int().min(0),
  embedding: z.array(z.number()).optional(),
  tags: z.array(z.string()),
  metadata: z.record(z.unknown()),
});

export const EpisodicMemorySchema = BaseMemorySchema.extend({
  type: z.literal(MemoryType.EPISODIC),
  timestamp: z.date(),
  context: z.string(),
  participants: z.array(z.string()),
  actions: z.array(z.object({
    timestamp: z.date(),
    agent: z.string(),
    action: z.string(),
    parameters: z.record(z.unknown()),
    result: z.string(),
    duration: z.number().min(0),
  })),
  outcome: z.string(),
  emotionalWeight: z.number().min(0).max(1),
  relatedMemories: z.array(z.string().uuid()),
});

export const SemanticMemorySchema = BaseMemorySchema.extend({
  type: z.literal(MemoryType.SEMANTIC),
  content: z.string(),
  category: z.string(),
  confidence: z.number().min(0).max(1),
  source: z.string(),
  examples: z.array(z.string()),
  relationships: z.array(z.object({
    type: z.enum(['related', 'hierarchy', 'causal', 'temporal', 'spatial']),
    targetId: z.string().uuid(),
    strength: z.number().min(0).max(1),
    description: z.string().optional(),
  })),
});

export const ProceduralMemorySchema = BaseMemorySchema.extend({
  type: z.literal(MemoryType.PROCEDURAL),
  name: z.string(),
  description: z.string(),
  steps: z.array(z.object({
    order: z.number().int().min(0),
    description: z.string(),
    action: z.string(),
    parameters: z.record(z.unknown()),
    expectedOutcome: z.string(),
    timeout: z.number().min(0),
  })),
  preconditions: z.array(z.string()),
  postconditions: z.array(z.string()),
  successRate: z.number().min(0).max(1),
  executionTime: z.number().min(0),
  dependencies: z.array(z.string().uuid()),
});

export const KnowledgeNodeSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['concept', 'entity', 'event', 'pattern', 'procedure']),
  label: z.string(),
  properties: z.record(z.unknown()),
  embedding: z.array(z.number()).optional(),
  confidence: z.number().min(0).max(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const KnowledgeEdgeSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  type: z.string(),
  properties: z.record(z.unknown()),
  weight: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  createdAt: z.date(),
});

export const MemorySystemConfigSchema = z.object({
  episodic: z.object({
    enabled: z.boolean(),
    maxMemories: z.number().int().min(0),
    consolidationInterval: z.number().min(0),
    retentionDays: z.number().min(0),
  }),
  semantic: z.object({
    enabled: z.boolean(),
    vectorStore: z.object({
      dimension: z.number().int().positive(),
      metric: z.enum(['cosine', 'euclidean', 'dotproduct']),
      indexType: z.enum(['hnsw', 'ivf', 'flat']),
      maxVectors: z.number().int().min(0),
      efConstruction: z.number().int().min(1),
      efSearch: z.number().int().min(1),
    }),
    maxMemories: z.number().int().min(0),
    updateInterval: z.number().min(0),
  }),
  procedural: z.object({
    enabled: z.boolean(),
    maxProcedures: z.number().int().min(0),
    minSuccessRate: z.number().min(0).max(1),
    practiceInterval: z.number().min(0),
  }),
  working: z.object({
    capacity: z.number().int().min(0),
    decayRate: z.number().min(0).max(1),
    refreshThreshold: z.number().min(0).max(1),
  }),
  knowledge: z.object({
    enabled: z.boolean(),
    maxNodes: z.number().int().min(0),
    maxEdges: z.number().int().min(0),
    updateThreshold: z.number().min(0).max(1),
  }),
  learning: z.object({
    enabled: z.boolean(),
    algorithm: z.string(),
    learningRate: z.number().min(0).max(1),
    explorationRate: z.number().min(0).max(1),
    discountFactor: z.number().min(0).max(1),
  }),
  pruning: z.object({
    enabled: z.boolean(),
    maxMemorySize: z.number().int().min(0),
    minImportance: z.number().min(0).max(5),
    maxAge: z.number().min(0),
    minAccessFrequency: z.number().min(0),
    decayRate: z.number().min(0).max(1),
    pruningThreshold: z.number().min(0).max(1),
    batchSize: z.number().int().min(1),
    preserveCritical: z.boolean(),
  }),
});

// ============================================================================
// Error Types
// ============================================================================

export class MemoryError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MemoryError';
  }
}

export class ConsolidationError extends MemoryError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONSOLIDATION_ERROR', details);
    this.name = 'ConsolidationError';
  }
}

export class PruningError extends MemoryError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PRUNING_ERROR', details);
    this.name = 'PruningError';
  }
}

export class RetrievalError extends MemoryError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'RETRIEVAL_ERROR', details);
    this.name = 'RetrievalError';
  }
}

export class StorageError extends MemoryError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'STORAGE_ERROR', details);
    this.name = 'StorageError';
  }
}

export class VectorStoreError extends MemoryError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VECTOR_STORE_ERROR', details);
    this.name = 'VectorStoreError';
  }
}
