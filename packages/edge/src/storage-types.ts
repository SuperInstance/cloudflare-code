/**
 * Core type definitions for ClaudeFlare Storage System
 */

/**
 * Session data stored in HOT tier (DO Memory)
 */
export interface SessionData {
  sessionId: string;
  userId: string;
  createdAt: number;
  lastActivity: number;

  messages: ConversationMessage[];

  metadata: {
    language: string;
    framework: string;
    projectPath: string;
    repositoryHash: string;
    messageCount: number;
    totalTokens: number;
    totalCost: number;
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
  };

  storage: {
    tier: 'hot' | 'warm' | 'cold';
    compressed: boolean;
    sizeBytes: number;
    checkpointCount: number;
    lastCheckpoint: number;
  };
}

/**
 * Conversation message structure
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokens?: number;
  embedding?: Float32Array;
}

/**
 * Memory entry for agent interactions
 */
export interface MemoryEntry {
  id: string;
  sessionId: string;
  agentId: string;
  timestamp: number;

  prompt: string;
  response: string;
  context: string;

  embedding: Float32Array;

  metadata: {
    agentType: 'director' | 'planner' | 'executor';
    model: string;
    modelVersion: string;
    temperature: number;
    maxTokens: number;
    topP: number;
    contentType: 'code' | 'documentation' | 'debugging' | 'conversation';
    language: string;
    framework: string;
    filesReferenced: string[];
    repositoryHash: string;
    success: boolean;
    confidence: number;
  };

  metrics: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latency: number;
    embeddingTime: number;
    generationTime: number;
    cacheHit: boolean;
    cost: number;
  };

  storage: {
    tier: 'hot' | 'warm' | 'cold';
    compressed: boolean;
    quantization: 'float32' | 'int8' | 'binary';
    sizeBytes: number;
    accessCount: number;
    lastAccessed: number;
  };
}

/**
 * User preferences stored in WARM tier (KV)
 */
export interface UserPreferences {
  userId: string;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  framework: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  agentConfig: {
    directorEnabled: boolean;
    plannerEnabled: boolean;
    executorEnabled: boolean;
  };
  cacheConfig: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

/**
 * Storage tier types
 */
export type StorageTier = 'hot' | 'warm' | 'cold';

/**
 * Generic data type for storage operations
 */
export type Data = SessionData | MemoryEntry | UserPreferences | Record<string, unknown>;

/**
 * Storage operation result
 */
export interface StorageResult<T = Data> {
  success: boolean;
  data: T | null;
  tier: StorageTier;
  latency: number;
  error?: string;
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  from: StorageTier;
  to: StorageTier;
  key: string;
  latency: number;
  error?: string;
}
