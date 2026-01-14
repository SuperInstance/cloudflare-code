/**
 * Shared type definitions for ClaudeFlare
 */

// ============================================================================
// Core Types
// ============================================================================

export type Environment = 'development' | 'staging' | 'production';

export interface AppConfig {
  environment: Environment;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  apiVersion: string;
}

// ============================================================================
// AI Provider Types
// ============================================================================

export type AIProvider = 'anthropic' | 'openai' | 'cohere' | 'mistral';

export interface AIModel {
  id: string;
  provider: AIProvider;
  name: string;
  contextWindow: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  content: string;
  finishReason: 'stop' | 'length' | 'content_filter';
  usage: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ============================================================================
// Cost Analytics Types
// ============================================================================

export interface CostMetrics {
  requestId: string;
  timestamp: number;
  provider: AIProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  latency: number;
}

export interface CostSummary {
  totalCost: number;
  totalTokens: number;
  requestCount: number;
  averageLatency: number;
  byProvider: Record<AIProvider, ProviderCostSummary>;
}

export interface ProviderCostSummary {
  cost: number;
  tokens: number;
  requests: number;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry {
  key: string;
  value: unknown;
  ttl: number;
  createdAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

// ============================================================================
// WebRTC Types
// ============================================================================

export interface WebRTCSession {
  sessionId: string;
  userId: string;
  peerConnections: Map<string, PeerConnectionInfo>;
  dataChannels: Map<string, DataChannelInfo>;
  createdAt: number;
  lastActivityAt: number;
}

export interface PeerConnectionInfo {
  id: string;
  connectionState: string;
  iceConnectionState: string;
  signalingState: string;
}

export interface DataChannelInfo {
  label: string;
  readyState: string;
  bufferedAmount: number;
}

// ============================================================================
// RAG Types
// ============================================================================

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  source: string;
  startLine: number;
  endLine: number;
  language: string;
  tags: string[];
}

export interface RetrievalQuery {
  query: string;
  topK: number;
  filters?: Record<string, unknown>;
}

export interface RetrievalResult {
  chunks: DocumentChunk[];
  scores: number[];
  totalResults: number;
}

// ============================================================================
// User Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  createdAt: number;
  lastLoginAt: number;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultProvider: AIProvider;
  defaultModel: string;
  notificationsEnabled: boolean;
}

// ============================================================================
// Agent Types
// ============================================================================

export interface Agent {
  id: string;
  name: string;
  description: string;
  type: AgentType;
  status: AgentStatus;
  capabilities: string[];
}

export type AgentType = 'chat' | 'code' | 'search' | 'analysis';

export type AgentStatus = 'idle' | 'busy' | 'offline';

// ============================================================================
// Error Types
// ============================================================================

export class ClaudeFlareError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ClaudeFlareError';
  }
}

export class APIError extends ClaudeFlareError {
  constructor(message: string, statusCode: number = 500) {
    super(message, 'API_ERROR', statusCode);
    this.name = 'APIError';
  }
}

export class ValidationError extends ClaudeFlareError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ClaudeFlareError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends ClaudeFlareError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.name = 'RateLimitError';
  }
}
