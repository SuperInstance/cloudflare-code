/**
 * Default configuration for the memory system
 */

import { MemorySystemConfig, PruningConfig, VectorStoreConfig } from './types';

export const defaultVectorStoreConfig: VectorStoreConfig = {
  dimension: 128,
  metric: 'cosine',
  indexType: 'hnsw',
  maxVectors: 10000,
  efConstruction: 200,
  efSearch: 50,
};

export const defaultPruningConfig: PruningConfig = {
  enabled: true,
  maxMemorySize: 100000000, // 100MB
  minImportance: 2, // LOW
  maxAge: 365, // 1 year in days
  minAccessFrequency: 5,
  decayRate: 0.1,
  pruningThreshold: 0.7,
  batchSize: 100,
  preserveCritical: true,
};

export const defaultConfig: MemorySystemConfig = {
  episodic: {
    enabled: true,
    maxMemories: 10000,
    consolidationInterval: 3600000, // 1 hour
    retentionDays: 365,
  },
  semantic: {
    enabled: true,
    vectorStore: defaultVectorStoreConfig,
    maxMemories: 10000,
    updateInterval: 3600000, // 1 hour
  },
  procedural: {
    enabled: true,
    maxProcedures: 1000,
    minSuccessRate: 0.5,
    practiceInterval: 7, // 7 days
  },
  working: {
    capacity: 7, // ±7 items
    decayRate: 0.5,
    refreshThreshold: 0.3,
  },
  knowledge: {
    enabled: true,
    maxNodes: 5000,
    maxEdges: 20000,
    updateThreshold: 0.8,
  },
  learning: {
    enabled: true,
    algorithm: 'q-learning',
    learningRate: 0.1,
    explorationRate: 0.3,
    discountFactor: 0.95,
  },
  pruning: defaultPruningConfig,
};
