/**
 * Core type definitions for ClaudeFlare TypeScript SDK
 */

// ============================================================================
// Core Configuration
// ============================================================================

export interface ClaudeFlareConfig {
  /**
   * API key for authentication
   */
  apiKey: string;

  /**
   * Base URL for API requests
   * @default 'https://api.claudeflare.com'
   */
  baseURL?: string;

  /**
   * API version to use
   * @default 'v1'
   */
  apiVersion?: string;

  /**
   * Timeout for requests in milliseconds
   * @default 60000
   */
  timeout?: number;

  /**
   * Maximum number of retries
   * @default 3
   */
  maxRetries?: number;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;

  /**
   * Custom headers to include in all requests
   */
  defaultHeaders?: Record<string, string>;

  /**
   * Custom fetch implementation
   */
  fetch?: typeof fetch;

  /**
   * HTTP agent for node.js (for connection pooling)
   */
  httpAgent?: unknown;
}

// ============================================================================
// Error Types
// ============================================================================

export interface ClaudeFlareError extends Error {
  code: ErrorCode;
  statusCode: number;
  requestId?: string;
  details?: unknown;
}

export enum ErrorCode {
  // Validation Errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_JSON = 'INVALID_JSON',

  // Authentication/Authorization Errors (4xx)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_API_KEY = 'INVALID_API_KEY',

  // Rate Limiting (4xx)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Not Found (4xx)
  NOT_FOUND = 'NOT_FOUND',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',

  // Server Errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  UPSTREAM_ERROR = 'UPSTREAM_ERROR',
  TIMEOUT = 'TIMEOUT',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',

  // Provider Errors (5xx)
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
}

// ============================================================================
// Chat API Types
// ============================================================================

export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
  role: MessageRole;
  content: string;
  timestamp?: number;
}

export interface ChatCompletionParams {
  /**
   * Array of messages in the conversation
   */
  messages: Message[];

  /**
   * Model to use for completion
   * @default 'claude-3-5-sonnet-20241022'
   */
  model?: string;

  /**
   * AI provider to use
   * @default 'anthropic'
   */
  provider?: AIProvider;

  /**
   * Temperature for sampling (0.0 to 1.0)
   * @default 0.7
   */
  temperature?: number;

  /**
   * Maximum tokens to generate
   * @default 4096
   */
  maxTokens?: number;

  /**
   * Enable streaming response
   * @default false
   */
  stream?: boolean;

  /**
   * Stop sequences
   */
  stopSequences?: string[];

  /**
   * Top-k sampling parameter
   */
  topK?: number;

  /**
   * Top-p sampling parameter
   */
  topP?: number;

  /**
   * Session ID for conversation continuity
   */
  sessionId?: string;

  /**
   * Metadata to attach to the request
   */
  metadata?: Record<string, unknown>;

  /**
   * Tools/functions to enable
   */
  tools?: Tool[];

  /**
   * Tool choice behavior
   */
  toolChoice?: 'auto' | 'any' | 'none';
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ChatCompletionResponse {
  id: string;
  content: string;
  model: string;
  provider: AIProvider;
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_use';
  usage: TokenUsage;
  timestamp: number;
  requestId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatCompletionStreamEvent {
  type: 'content' | 'error' | 'done';
  content?: string;
  error?: ClaudeFlareError;
  done?: boolean;
  usage?: TokenUsage;
  finishReason?: string;
}

// ============================================================================
// Code Generation API Types
// ============================================================================

export interface CodeGenerationParams {
  /**
   * Prompt describing the code to generate
   */
  prompt: string;

  /**
   * Programming language
   */
  language: string;

  /**
   * Framework or library (optional)
   */
  framework?: string;

  /**
   * Model to use
   */
  model?: string;

  /**
   * Temperature for sampling
   */
  temperature?: number;

  /**
   * Maximum tokens to generate
   */
  maxTokens?: number;

  /**
   * Enable streaming
   */
  stream?: boolean;

  /**
   * Context files for reference
   */
  context?: string[];

  /**
   * Code style preferences
   */
  style?: CodeStyle;
}

export interface CodeStyle {
  /**
   * Indentation type
   */
  indent?: 'spaces' | 'tabs';

  /**
   * Indentation size
   */
  indentSize?: number;

  /**
   * Semicolons
   */
  semicolons?: boolean;

  /**
   * Quote style
   */
  quotes?: 'single' | 'double';

  /**
   * Trailing commas
   */
  trailingCommas?: boolean;
}

export interface CodeGenerationResponse {
  id: string;
  code: string;
  language: string;
  framework?: string;
  explanation?: string;
  usage: TokenUsage;
  timestamp: number;
  requestId?: string;
}

export interface CodeAnalysisParams {
  /**
   * Code to analyze
   */
  code: string;

  /**
   * Programming language
   */
  language: string;

  /**
   * Type of analysis
   */
  analysisType: CodeAnalysisType;

  /**
   * Model to use
   */
  model?: string;
}

export type CodeAnalysisType =
  | 'security'
  | 'performance'
  | 'quality'
  | 'complexity'
  | 'documentation';

export interface CodeAnalysisResponse {
  id: string;
  analysisType: CodeAnalysisType;
  findings: CodeFinding[];
  summary: string;
  score: number;
  timestamp: number;
  requestId?: string;
}

export interface CodeFinding {
  type: 'error' | 'warning' | 'info' | 'suggestion';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  location?: CodeLocation;
  suggestion?: string;
}

export interface CodeLocation {
  file?: string;
  line?: number;
  column?: number;
}

// ============================================================================
// Agents API Types
// ============================================================================

export type AgentType = 'chat' | 'code' | 'search' | 'analysis' | 'review';

export type AgentStatus = 'idle' | 'busy' | 'offline';

export interface Agent {
  id: string;
  name: string;
  description: string;
  type: AgentType;
  status: AgentStatus;
  capabilities: string[];
  createdAt: number;
}

export interface AgentOrchestrationParams {
  /**
   * Task to orchestrate
   */
  task: string;

  /**
   * Agent types to use
   */
  agents?: AgentType[];

  /**
   * Enable automatic agent selection
   */
  autoSelect?: boolean;

  /**
   * Context for the task
   */
  context?: Record<string, unknown>;

  /**
   * Maximum parallelism
   */
  maxParallelism?: number;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;
}

export interface AgentOrchestrationResponse {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: AgentResult;
  agents: AgentExecution[];
  timestamp: number;
  requestId?: string;
}

export interface AgentExecution {
  agent: Agent;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface AgentResult {
  output: string;
  artifacts?: Artifact[];
  metrics: {
    duration: number;
    tokensUsed: number;
    agentsInvoked: number;
  };
}

export interface Artifact {
  type: 'code' | 'document' | 'data';
  content: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Codebase RAG API Types
// ============================================================================

export interface CodebaseUploadParams {
  /**
   * Repository URL
   */
  repositoryUrl?: string;

  /**
   * Files to upload
   */
  files?: CodebaseFile[];

  /**
   * Branch to analyze
   */
  branch?: string;

  /**
   * Include patterns
   */
  includePatterns?: string[];

  /**
   * Exclude patterns
   */
  excludePatterns?: string[];

  /**
   * Maximum file size in bytes
   */
  maxFileSize?: number;
}

export interface CodebaseFile {
  path: string;
  content: string;
}

export interface CodebaseUploadResponse {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  filesProcessed: number;
  chunksIndexed: number;
  timestamp: number;
}

export interface CodebaseSearchParams {
  /**
   * Search query
   */
  query: string;

  /**
   * Number of results to return
   */
  topK?: number;

  /**
   * Filters to apply
   */
  filters?: CodebaseFilter;

  /**
   * Include code snippets
   */
  includeSnippets?: boolean;
}

export interface CodebaseFilter {
  /**
   * File path pattern
   */
  path?: string;

  /**
   * Programming language
   */
  language?: string;

  /**
   * Tags
   */
  tags?: string[];
}

export interface CodebaseSearchResponse {
  query: string;
  results: CodebaseResult[];
  totalResults: number;
  timestamp: number;
}

export interface CodebaseResult {
  chunkId: string;
  file: {
    path: string;
    language: string;
  };
  content: string;
  score: number;
  location: {
    startLine: number;
    endLine: number;
  };
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Models API Types
// ============================================================================

export type AIProvider = 'anthropic' | 'openai' | 'groq' | 'cerebras' | 'cloudflare';

export interface Model {
  id: string;
  name: string;
  provider: AIProvider;
  contextLength: number;
  description: string;
  capabilities: ModelCapabilities;
  pricing?: ModelPricing;
}

export interface ModelCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
  codeGeneration: boolean;
  analysis: boolean;
}

export interface ModelPricing {
  inputCostPer1K: number;
  outputCostPer1K: number;
}

export interface ModelsListResponse {
  models: Model[];
  count: number;
  timestamp: number;
}

// ============================================================================
// WebSocket Types
// ============================================================================

export interface WebSocketConfig {
  /**
   * WebSocket URL
   */
  url?: string;

  /**
   * Connection timeout in milliseconds
   */
  timeout?: number;

  /**
   * Reconnect automatically
   */
  autoReconnect?: boolean;

  /**
   * Maximum reconnection attempts
   */
  maxReconnectAttempts?: number;

  /**
   * Reconnection delay in milliseconds
   */
  reconnectDelay?: number;

  /**
   * Enable ping/pong heartbeat
   */
  heartbeat?: boolean;

  /**
   * Heartbeat interval in milliseconds
   */
  heartbeatInterval?: number;
}

export interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp: number;
}

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

export type WebSocketErrorHandler = (error: Error) => void;

export interface WebSocketClient {
  connect(): Promise<void>;
  disconnect(): void;
  send(type: string, data: unknown): void;
  on(event: string, handler: WebSocketEventHandler): void;
  off(event: string, handler: WebSocketEventHandler): void;
  isConnected(): boolean;
}

// ============================================================================
// Streaming Types
// ============================================================================

export interface StreamConfig {
  /**
   * Enable streaming
   */
  enabled: boolean;

  /**
   * Chunk size in tokens
   */
  chunkSize?: number;

  /**
   * Delay between chunks in milliseconds
   */
  chunkDelay?: number;
}

export type StreamEventHandler = (event: ChatCompletionStreamEvent) => void;

export interface StreamController {
  cancel(): void;
  isComplete(): boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

export type PaginationParams = {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type ListResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type RequestOptions = {
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
};
