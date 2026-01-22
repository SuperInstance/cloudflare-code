/**
 * Router Types and Interfaces
 *
 * Defines all types for the complexity-based routing system with
 * confidence cascading and cost optimization.
 */

import type { ChatRequest, ChatResponse } from '../../types/index';

/**
 * Complexity levels for routing
 */
export type ComplexityLevel = 'simple' | 'moderate' | 'complex';

/**
 * Intent detection results
 */
export type IntentType = 'chat' | 'code' | 'analysis' | 'creative';

/**
 * Code snippet detected in request
 */
export interface CodeSnippet {
  language: string;
  code: string;
  lineCount: number;
  startLine?: number;
}

/**
 * Token estimation
 */
export interface TokenEstimate {
  input: number;
  output: number;
  total: number;
}

/**
 * Request analysis result
 */
export interface RequestAnalysis {
  /** Complexity level */
  complexity: ComplexityLevel;
  /** Detected intent */
  intent: IntentType;
  /** Estimated token usage */
  estimatedTokens: TokenEstimate;
  /** Detected languages */
  languages: string[];
  /** Contains code */
  hasCode: boolean;
  /** Code snippets */
  codeSnippets: CodeSnippet[];
  /** Semantic hash for caching */
  semanticHash: string;
  /** Analysis timestamp */
  timestamp: number;
}

/**
 * Execution strategy for a request
 */
export interface ExecutionStrategy {
  /** Strategy name */
  name: string;
  /** Provider to use */
  provider: string;
  /** Model to use */
  model: string;
  /** Expected quality score (0-1) */
  expectedQuality: number;
  /** Expected confidence score (0-1) */
  confidence: number;
  /** Cost per 1M tokens (USD) */
  costPer1M: number;
  /** Expected latency (ms) */
  expectedLatency: number;
  /** Maximum tokens for this strategy */
  maxTokens: number;
  /** Tier level (1=free, 2=mid, 3=premium) */
  tier: 1 | 2 | 3;
}

/**
 * Cascade execution result
 */
export interface CascadeResult {
  /** Final response */
  response: ChatResponse;
  /** Tier used */
  tierUsed: number;
  /** Strategy used */
  strategy: ExecutionStrategy;
  /** Confidence score */
  confidence: number;
  /** Actual cost (USD) */
  cost: number;
  /** Number of attempts */
  attempts: number;
  /** Total latency (ms) */
  latency: number;
  /** All attempts made */
  attemptsLog: CascadeAttempt[];
}

/**
 * Individual cascade attempt
 */
export interface CascadeAttempt {
  /** Attempt number */
  attempt: number;
  /** Strategy used */
  strategy: ExecutionStrategy;
  /** Success or failure */
  success: boolean;
  /** Confidence score */
  confidence: number;
  /** Error if failed */
  error?: string;
  /** Latency (ms) */
  latency: number;
}

/**
 * Scheduled request for free tier
 */
export interface ScheduledRequest {
  /** Request ID */
  requestId: string;
  /** The request itself */
  request: ChatRequest;
  /** Scheduled time */
  scheduledTime: number;
  /** Priority */
  priority: number;
}

/**
 * Batch group for similar requests
 */
export interface RequestBatch {
  /** Batch key */
  key: string;
  /** Requests in batch */
  requests: ChatRequest[];
  /** Total estimated tokens */
  totalTokens: number;
  /** Created timestamp */
  createdAt: number;
}

/**
 * Router configuration
 */
export interface SmartRouterConfig {
  /** Enable semantic caching */
  enableCache: boolean;
  /** Enable confidence cascade */
  enableCascade: boolean;
  /** Minimum confidence threshold */
  minConfidence: number;
  /** Maximum cascade attempts */
  maxCascadeAttempts: number;
  /** Enable cost optimization */
  enableCostOptimization: boolean;
  /** Minimum quality threshold */
  minQuality: number;
  /** Enable batching */
  enableBatching: boolean;
  /** Batch timeout (ms) */
  batchTimeout: number;
  /** Minimum batch size */
  minBatchSize: number;
  /** Maximum batch size */
  maxBatchSize: number;
  /** Routing weights */
  weights: {
    /** Weight for cost in scoring */
    cost: number;
    /** Weight for quality in scoring */
    quality: number;
    /** Weight for speed in scoring */
    speed: number;
  };
}

/**
 * Router statistics
 */
export interface RouterStats {
  /** Total requests routed */
  totalRequests: number;
  /** Cache hits */
  cacheHits: number;
  /** Cache misses */
  cacheMisses: number;
  /** Requests by tier */
  requestsByTier: Map<number, number>;
  /** Requests by complexity */
  requestsByComplexity: Map<ComplexityLevel, number>;
  /** Requests by intent */
  requestsByIntent: Map<IntentType, number>;
  /** Total cost (USD) */
  totalCost: number;
  /** Total latency (ms) */
  totalLatency: number;
  /** Average latency (ms) */
  averageLatency: number;
  /** Cascade statistics */
  cascadeStats: {
    /** Single attempt successes */
    singleAttempt: number;
    /** Two attempts */
    twoAttempts: number;
    /** Three attempts */
    threeAttempts: number;
    /** Failed cascades */
    failures: number;
  };
  /** Cost savings (USD) */
  costSavings: number;
  /** Timestamp */
  timestamp: number;
}
