/**
 * Core types for the context management system
 */

import { DurableObjectStorage } from '@cloudflare/workers-types';

// ============================================================================
// Message Types
// ============================================================================

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool' | 'function';

export interface BaseMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  tokens?: number;
  embedding?: number[];
  sources?: string[];
  confidence?: number;
  compressed?: boolean;
  summary?: string;
  userId?: string;
  sessionId?: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  [key: string]: any;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

export interface ToolResult {
  toolCallId: string;
  output: string;
  error?: string;
}

export interface SystemMessage extends BaseMessage {
  role: 'system';
}

export interface UserMessage extends BaseMessage {
  role: 'user';
}

export interface AssistantMessage extends BaseMessage {
  role: 'assistant';
  reasoning?: string;
}

export interface ToolMessage extends BaseMessage {
  role: 'tool';
  toolCallId: string;
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

// ============================================================================
// Context Types
// ============================================================================

export interface ContextWindow {
  maxTokens: number;
  currentTokens: number;
  reservedTokens: number;
  availableTokens: number;
}

export interface ConversationContext {
  sessionId: string;
  userId?: string;
  messages: Message[];
  contextWindow: ContextWindow;
  metadata: ContextMetadata;
  state: ContextState;
}

export interface ContextMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  messageCount: number;
  totalTokens: number;
  compressedCount: number;
  sharedWith?: string[];
  isArchived?: boolean;
  retentionPolicy?: RetentionPolicy;
  [key: string]: any;
}

export type ContextState = 'active' | 'archived' | 'frozen' | 'deleted';

export interface ContextSnapshot {
  context: ConversationContext;
  timestamp: number;
  version: number;
  checksum: string;
}

// ============================================================================
// Memory Types
// ============================================================================

export type MemoryType = 'episodic' | 'semantic' | 'semantic_procedural' | 'working';

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  embedding?: number[];
  metadata: MemoryMetadata;
  createdAt: number;
  updatedAt: number;
  accessedAt: number;
  accessCount: number;
  importance: number;
  strength: number;
}

export interface MemoryMetadata {
  userId?: string;
  sessionId?: string;
  conversationId?: string;
  tags?: string[];
  categories?: string[];
  source?: string;
  confidence?: number;
  verified?: boolean;
  relatedMemories?: string[];
  [key: string]: any;
}

export interface EpisodicMemory extends Memory {
  type: 'episodic';
  timestamp: number;
  context?: string;
  participants?: string[];
  emotions?: string[];
}

export interface SemanticMemory extends Memory {
  type: 'semantic';
  facts: Fact[];
  relationships?: Relationship[];
}

export interface ProceduralMemory extends Memory {
  type: 'semantic_procedural';
  steps: ProcedureStep[];
  triggers?: string[];
  outcomes?: string[];
}

export interface WorkingMemory extends Memory {
  type: 'working';
  ttl: number;
  capacity: number;
  currentSize: number;
}

export interface Fact {
  id: string;
  statement: string;
  confidence: number;
  source?: string;
  verifiedAt?: number;
}

export interface Relationship {
  from: string;
  to: string;
  type: string;
  weight: number;
}

export interface ProcedureStep {
  order: number;
  action: string;
  parameters?: Record<string, any>;
  expectedOutcome?: string;
}

export interface MemoryConsolidation {
  memories: Memory[];
  consolidated: Memory[];
  forgotten: Memory[];
  timestamp: number;
}

// ============================================================================
// Compression Types
// ============================================================================

export type CompressionLevel = 'none' | 'low' | 'medium' | 'high' | 'maximum';

export interface CompressionConfig {
  level: CompressionLevel;
  strategy: CompressionStrategy;
  preserveKeyPoints: boolean;
  preserveStructure: boolean;
  preserveSources: boolean;
  targetRatio: number;
  minQuality: number;
}

export type CompressionStrategy =
  | 'summarization'
  | 'extraction'
  | 'hierarchical'
  | 'lossless'
  | 'lossy'
  | 'hybrid';

export interface CompressionResult {
  original: Message[];
  compressed: Message[];
  ratio: number;
  tokensSaved: number;
  quality: number;
  strategy: CompressionStrategy;
  metadata: CompressionMetadata;
}

export interface CompressionMetadata {
  compressedAt: number;
  algorithm: string;
  version: string;
  checksum: string;
  keyPoints: string[];
  summaries: Summary[];
}

export interface Summary {
  id: string;
  content: string;
  level: number;
  children?: Summary[];
  tokens: number;
  quality: number;
}

// ============================================================================
// RAG Types
// ============================================================================

export interface RAGConfig {
  chunkSize: number;
  chunkOverlap: number;
  maxChunks: number;
  retrievalStrategy: RetrievalStrategy;
  embeddingModel: string;
  rerankingEnabled: boolean;
  citationEnabled: boolean;
  minRelevanceScore: number;
}

export type RetrievalStrategy = 'semantic' | 'keyword' | 'hybrid' | 'dense' | 'sparse';

export interface Document {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  chunks?: DocumentChunk[];
  embedding?: number[];
}

export interface DocumentMetadata {
  title?: string;
  source: string;
  author?: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  category?: string;
  language?: string;
  mimeType?: string;
  size?: number;
  checksum?: string;
  [key: string]: any;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  index: number;
  embedding?: number[];
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  startPosition: number;
  endPosition: number;
  tokens?: number;
  headings?: string[];
  links?: string[];
  images?: string[];
}

export interface RetrievalQuery {
  query: string;
  embedding?: number[];
  filters?: RetrievalFilter[];
  limit: number;
  minScore?: number;
}

export interface RetrievalFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: any;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  query: string;
  totalCount: number;
  retrievalTime: number;
}

export interface RetrievedChunk {
  chunk: DocumentChunk;
  score: number;
  relevance: number;
  citation?: string;
}

export interface Citation {
  id: string;
  source: string;
  text: string;
  startPosition: number;
  endPosition: number;
  confidence: number;
}

// ============================================================================
// Optimizer Types
// ============================================================================

export interface OptimizerConfig {
  maxTokens: number;
  reservedTokens: number;
  priorityStrategy: PriorityStrategy;
  relevanceThreshold: number;
  temporalDecay: number;
  qualityThreshold: number;
  dynamicSizing: boolean;
}

export type PriorityStrategy =
  | 'recency'
  | 'relevance'
  | 'importance'
  | 'hybrid'
  | 'custom';

export interface ContextPriority {
  messageId: string;
  priority: number;
  score: number;
  reasons: string[];
}

export interface OptimizationResult {
  included: Message[];
  excluded: Message[];
  compressed: Message[];
  totalTokens: number;
  qualityScore: number;
  coverage: number;
  diversity: number;
}

export interface QualityMetrics {
  relevance: number;
  coherence: number;
  completeness: number;
  diversity: number;
  overall: number;
}

// ============================================================================
// Session Types
// ============================================================================

export interface Session {
  id: string;
  userId?: string;
  context: ConversationContext;
  metadata: SessionMetadata;
  state: SessionState;
}

export interface SessionMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  expiresAt?: number;
  parentSessionId?: string;
  linkedSessionIds?: string[];
  sharedWith?: string[];
  permissions: SessionPermissions;
  retention?: RetentionPolicy;
}

export type SessionState = 'active' | 'inactive' | 'archived' | 'deleted';

export interface SessionPermissions {
  canRead: string[];
  canWrite: string[];
  canShare: string[];
  canDelete: string[];
  public: boolean;
}

export interface RetentionPolicy {
  duration: number;
  action: 'archive' | 'delete' | 'anonymize';
  exceptions?: string[];
}

export interface SessionLink {
  fromSessionId: string;
  toSessionId: string;
  type: LinkType;
  strength: number;
  metadata?: Record<string, any>;
}

export type LinkType = 'followup' | 'related' | 'reference' | 'branch' | 'merge';

// ============================================================================
// Token Counting
// ============================================================================

export interface TokenCountResult {
  tokens: number;
  characters: number;
  estimated: boolean;
  model?: string;
}

export interface TokenCounter {
  count(text: string): Promise<number>;
  countBatch(texts: string[]): Promise<number[]>;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface ContextStorage {
  get(sessionId: string): Promise<ConversationContext | null>;
  set(sessionId: string, context: ConversationContext): Promise<void>;
  delete(sessionId: string): Promise<void>;
  list(userId?: string, filters?: StorageFilter): Promise<string[]>;
  query(query: StorageQuery): Promise<ConversationContext[]>;
}

export interface StorageFilter {
  state?: SessionState;
  tags?: string[];
  dateFrom?: number;
  dateTo?: number;
  limit?: number;
  offset?: number;
}

export interface StorageQuery {
  userId?: string;
  query: string;
  filters?: StorageFilter;
  limit?: number;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface ContextAnalytics {
  sessionId: string;
  metrics: ContextMetrics;
  insights: ContextInsight[];
  recommendations: string[];
}

export interface ContextMetrics {
  totalMessages: number;
  totalTokens: number;
  avgTokensPerMessage: number;
  compressionRatio: number;
  retrievalAccuracy: number;
  contextQuality: number;
  memoryUtilization: number;
  sessionDuration: number;
}

export interface ContextInsight {
  type: InsightType;
  message: string;
  confidence: number;
  timestamp: number;
  data?: Record<string, any>;
}

export type InsightType =
  | 'pattern'
  | 'anomaly'
  | 'optimization'
  | 'quality'
  | 'performance';

// ============================================================================
// Event Types
// ============================================================================

export type ContextEventType =
  | 'message_added'
  | 'message_removed'
  | 'context_compressed'
  | 'context_restored'
  | 'memory_created'
  | 'memory_retrieved'
  | 'session_created'
  | 'session_updated'
  | 'session_deleted'
  | 'context_optimized';

export interface ContextEvent {
  type: ContextEventType;
  sessionId: string;
  timestamp: number;
  data: Record<string, any>;
}

export interface EventHandler {
  (event: ContextEvent): void | Promise<void>;
}

// ============================================================================
// Error Types
// ============================================================================

export class ContextError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ContextError';
  }
}

export class TokenLimitError extends ContextError {
  constructor(details?: Record<string, any>) {
    super('Token limit exceeded', 'TOKEN_LIMIT_EXCEEDED', details);
    this.name = 'TokenLimitError';
  }
}

export class SessionNotFoundError extends ContextError {
  constructor(sessionId: string, details?: Record<string, any>) {
    super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND', details);
    this.name = 'SessionNotFoundError';
  }
}

export class CompressionError extends ContextError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'COMPRESSION_ERROR', details);
    this.name = 'CompressionError';
  }
}

export class RetrievalError extends ContextError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'RETRIEVAL_ERROR', details);
    this.name = 'RetrievalError';
  }
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface ContextManagerConfig {
  maxTokens: number;
  reservedTokens: number;
  compressionEnabled: boolean;
  compressionConfig: CompressionConfig;
  ragEnabled: boolean;
  ragConfig: RAGConfig;
  optimizerConfig: OptimizerConfig;
  storage?: ContextStorage;
  enableAnalytics: boolean;
  enableEvents: boolean;
}

export interface MemoryStoreConfig {
  maxSize: number;
  consolidationThreshold: number;
  forgettingEnabled: boolean;
  forgettingRate: number;
  embeddingModel: string;
  vectorDimension: number;
}

export interface CrossSessionConfig {
  persistenceEnabled: boolean;
  linkingEnabled: boolean;
  sharingEnabled: boolean;
  defaultRetentionPolicy: RetentionPolicy;
  privacyControls: boolean;
  anonymizationEnabled: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export type AsyncResult<T> = Promise<{ data?: T; error?: Error }>;
