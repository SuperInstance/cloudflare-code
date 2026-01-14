/**
 * Service Types
 *
 * Type definitions for specific service implementations and integrations.
 */

import type { ServiceInstance, ServiceMetadata, ServiceType } from './core';

/**
 * AI Provider service interface
 */
export interface AIProviderService {
  readonly metadata: ServiceMetadata;

  chat(params: ChatParams): Promise<ChatResponse>;
  chatStream(params: ChatParams): AsyncIterable<ChatChunk>;
  embed(text: string): Promise<number[]>;
  listModels(): Promise<ModelInfo[]>;
}

export interface ChatParams {
  readonly messages: readonly ChatMessage[];
  readonly model: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly stream?: boolean;
}

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface ChatResponse {
  readonly content: string;
  readonly model: string;
  readonly usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
}

export interface ChatChunk {
  readonly content: string;
  readonly done: boolean;
}

export interface ModelInfo {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly capabilities: readonly string[];
}

/**
 * Agent orchestration service
 */
export interface AgentOrchestratorService {
  readonly metadata: ServiceMetadata;

  createAgent(params: CreateAgentParams): Promise<Agent>;
  executeAgent(agentId: string, input: unknown): Promise<AgentResult>;
  listAgents(): Promise<AgentInfo[]>;
  getAgent(agentId: string): Promise<Agent | undefined>;
}

export interface CreateAgentParams {
  readonly name: string;
  readonly type: string;
  readonly config: Record<string, unknown>;
}

export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly config: Record<string, unknown>;
  execute(input: unknown): Promise<AgentResult>;
}

export interface AgentResult {
  readonly success: boolean;
  readonly output: unknown;
  readonly error?: Error;
  readonly duration: number;
}

export interface AgentInfo {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly status: string;
}

/**
 * Semantic cache service
 */
export interface SemanticCacheService {
  readonly metadata: ServiceMetadata;

  get(query: string, threshold?: number): Promise<SemanticResult | undefined>;
  set(query: string, result: SemanticResult): Promise<void>;
  invalidate(query: string): Promise<void>;
  clear(): Promise<void>;
  findSimilar(query: string, limit: number): Promise<SemanticResult[]>;
}

export interface SemanticResult {
  readonly content: unknown;
  readonly similarity: number;
  readonly metadata: Record<string, unknown>;
}

/**
 * RAG indexer service
 */
export interface RAGIndexerService {
  readonly metadata: ServiceMetadata;

  index(params: IndexParams): Promise<IndexResult>;
  search(query: string, limit?: number): Promise<SearchResult[]>;
  delete(documentId: string): Promise<void>;
  update(documentId: string, content: string): Promise<void>;
  getStats(): Promise<IndexStats>;
}

export interface IndexParams {
  readonly documentId: string;
  readonly content: string;
  readonly metadata: Record<string, unknown>;
}

export interface IndexResult {
  readonly success: boolean;
  readonly documentId: string;
  readonly chunks: number;
  readonly duration: number;
}

export interface SearchResult {
  readonly documentId: string;
  readonly content: string;
  readonly score: number;
  readonly metadata: Record<string, unknown>;
}

export interface IndexStats {
  readonly documents: number;
  readonly chunks: number;
  readonly size: number;
}

/**
 * Storage service interfaces
 */
export interface StorageService {
  readonly metadata: ServiceMetadata;

  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  exists(key: string): Promise<boolean>;
}

export interface KVStorageService extends StorageService {
  // KV-specific operations
  getWithMetadata<T = unknown>(
    key: string
  ): Promise<{ value: T | undefined; metadata: Record<string, unknown> }>;
}

export interface R2StorageService extends StorageService {
  // R2-specific operations
  upload(key: string, data: ArrayBuffer, metadata?: Record<string, unknown>): Promise<void>;
  download(key: string): Promise<ArrayBuffer>;
  presignedUrl(key: string, expiresIn?: number): Promise<string>;
}

export interface D1DatabaseService {
  readonly metadata: ServiceMetadata;

  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<ExecuteResult>;
  batch(statements: BatchStatement[]): Promise<BatchResult>;
}

export interface ExecuteResult {
  readonly rowsRead: number;
  readonly rowsWritten: number;
  readonly duration: number;
}

export interface BatchStatement {
  readonly sql: string;
  readonly params?: unknown[];
}

export interface BatchResult {
  readonly success: boolean;
  readonly results: ReadonlyArray<ExecuteResult>;
}

/**
 * Cache service
 */
export interface CacheService {
  readonly metadata: ServiceMetadata;

  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;

  // Multi-level cache operations
  getL1<T = unknown>(key: string): Promise<T | undefined>;
  getL2<T = unknown>(key: string): Promise<T | undefined>;
  setL1<T = unknown>(key: string, value: T, ttl?: number): Promise<void>;
  setL2<T = unknown>(key: string, value: T, ttl?: number): Promise<void>;
}

/**
 * Load balancer service
 */
export interface LoadBalancerService {
  readonly metadata: ServiceMetadata;

  select(instance: LoadBalancerInstance): Promise<string>;
  register(instance: LoadBalancerInstance): Promise<void>;
  unregister(instanceId: string): Promise<void>;
  healthCheck(instanceId: string): Promise<boolean>;
  getStats(): Promise<LoadBalancerStats>;
}

export interface LoadBalancerInstance {
  readonly id: string;
  readonly address: string;
  readonly weight: number;
  readonly healthy: boolean;
}

export interface LoadBalancerStats {
  readonly totalRequests: number;
  readonly activeConnections: number;
  readonly instanceStats: ReadonlyArray<{
    readonly instanceId: string;
    readonly requests: number;
    readonly connections: number;
    readonly avgResponseTime: number;
  }>;
}

/**
 * Monitoring service
 */
export interface MonitoringService {
  readonly metadata: ServiceMetadata;

  recordMetric(metric: Metric): Promise<void>;
  recordEvent(event: Event): Promise<void>;
  recordError(error: Error): Promise<void>;
  getMetrics(filters?: MetricFilters): Promise<Metric[]>;
  getEvents(filters?: EventFilters): Promise<Event[]>;
  getHealth(): Promise<HealthStatus>;
}

export interface Metric {
  readonly name: string;
  readonly value: number;
  readonly timestamp: number;
  readonly tags: Record<string, string>;
}

export interface Event {
  readonly name: string;
  readonly data: Record<string, unknown>;
  readonly timestamp: number;
  readonly level: 'info' | 'warn' | 'error';
}

export interface MetricFilters {
  readonly name?: string;
  readonly from?: number;
  readonly to?: number;
  readonly tags?: Record<string, string>;
}

export interface EventFilters {
  readonly name?: string;
  readonly level?: string;
  readonly from?: number;
  readonly to?: number;
}

export interface HealthStatus {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly checks: ReadonlyArray<{
    readonly name: string;
    readonly status: 'pass' | 'fail' | 'warn';
    readonly message?: string;
  }>;
}

/**
 * Security service interfaces
 */
export interface AuthenticationService {
  readonly metadata: ServiceMetadata;

  authenticate(credentials: Credentials): Promise<AuthResult>;
  validate(token: string): Promise<ValidationResult>;
  refresh(token: string): Promise<string>;
  revoke(token: string): Promise<void>;
}

export interface Credentials {
  readonly type: 'api_key' | 'jwt' | 'oauth';
  readonly value: string;
}

export interface AuthResult {
  readonly success: boolean;
  readonly token?: string;
  readonly expires?: number;
  readonly error?: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly userId?: string;
  readonly permissions: readonly string[];
  readonly expires?: number;
}

export interface AuthorizationService {
  readonly metadata: ServiceMetadata;

  check(userId: string, resource: string, action: string): Promise<boolean>;
  grant(userId: string, permission: Permission): Promise<void>;
  revoke(userId: string, permission: Permission): Promise<void>;
  list(userId: string): Promise<Permission[]>;
}

export interface Permission {
  readonly resource: string;
  readonly actions: readonly string[];
}

export interface EncryptionService {
  readonly metadata: ServiceMetadata;

  encrypt(data: string): Promise<EncryptedData>;
  decrypt(encryptedData: EncryptedData): Promise<string>;
  hash(data: string): Promise<string>;
  verify(data: string, hash: string): Promise<boolean>;
}

export interface EncryptedData {
  readonly ciphertext: string;
  readonly iv: string;
  readonly tag: string;
}

export interface AuditLoggingService {
  readonly metadata: ServiceMetadata;

  log(event: AuditEvent): Promise<void>;
  query(filters: AuditFilters): Promise<AuditEvent[]>;
  export(filters: AuditFilters): Promise<string>;
}

export interface AuditEvent {
  readonly id: string;
  readonly timestamp: number;
  readonly userId?: string;
  readonly action: string;
  readonly resource: string;
  readonly outcome: 'success' | 'failure';
  readonly metadata: Record<string, unknown>;
}

export interface AuditFilters {
  readonly userId?: string;
  readonly action?: string;
  readonly resource?: string;
  readonly from?: number;
  readonly to?: number;
}

/**
 * Developer tool services
 */
export interface CLIService {
  readonly metadata: ServiceMetadata;

  execute(command: string, args: string[]): Promise<CLIResult>;
  autoComplete(input: string): Promise<string[]>;
  validate(command: string): Promise<ValidationResult>;
}

export interface CLIResult {
  readonly success: boolean;
  readonly output: string;
  readonly error?: string;
  readonly exitCode: number;
}

export interface VSCodeExtensionService {
  readonly metadata: ServiceMetadata;

  execute(command: string, args: unknown[]): Promise<unknown>;
  notify(event: string, data: unknown): Promise<void>;
  getState(): Promise<Record<string, unknown>>;
  setState(state: Record<string, unknown>): Promise<void>;
}

export interface DashboardService {
  readonly metadata: ServiceMetadata;

  getData(panel: string): Promise<unknown>;
  updatePanel(panel: string, data: unknown): Promise<void>;
  broadcast(event: string, data: unknown): Promise<void>;
}

export interface DeveloperPortalService {
  readonly metadata: ServiceMetadata;

  createKey(userId: string): Promise<APIKey>;
  revokeKey(keyId: string): Promise<void>;
  listKeys(userId: string): Promise<APIKey[]>;
  getUsage(userId: string, from: number, to: number): Promise<UsageStats>;
}

export interface APIKey {
  readonly id: string;
  readonly key: string;
  readonly userId: string;
  readonly created: number;
  readonly expires: number;
  readonly scopes: readonly string[];
}

export interface UsageStats {
  readonly requests: number;
  readonly tokens: number;
  readonly cost: number;
  readonly breakdown: Record<string, number>;
}
