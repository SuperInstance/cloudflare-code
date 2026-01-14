/**
 * Dependency Injection Tokens
 *
 * Standard tokens for platform services.
 */

import { InjectionToken } from '../types/di';

/**
 * Core service tokens
 */
export const CORE_TOKENS = {
  // Registry
  SERVICE_REGISTRY: new InjectionToken<ServiceRegistry>('SERVICE_REGISTRY'),

  // Event Bus
  EVENT_BUS: new InjectionToken<EventBus>('EVENT_BUS'),

  // State Manager
  STATE_MANAGER: new InjectionToken<StateManager>('STATE_MANAGER'),

  // Config Manager
  CONFIG_MANAGER: new InjectionToken<ConfigManager>('CONFIG_MANAGER'),

  // DI Container
  DI_CONTAINER: new InjectionToken<DIContainer>('DI_CONTAINER'),
} as const;

/**
 * AI service tokens
 */
export const AI_TOKENS = {
  PROVIDER: new InjectionToken<AIProviderService>('AI_PROVIDER'),
  EMBEDDINGS: new InjectionToken<EmbeddingsService>('EMBEDDINGS'),
  SEMANTIC_CACHE: new InjectionToken<SemanticCacheService>('SEMANTIC_CACHE'),
  RAG_INDEXER: new InjectionToken<RAGIndexerService>('RAG_INDEXER'),
  AGENT_ORCHESTRATOR: new InjectionToken<AgentOrchestratorService>(
    'AGENT_ORCHESTRATOR'
  ),
} as const;

/**
 * Storage service tokens
 */
export const STORAGE_TOKENS = {
  KV: new InjectionToken<KVStorageService>('STORAGE_KV'),
  R2: new InjectionToken<R2StorageService>('STORAGE_R2'),
  D1: new InjectionToken<D1DatabaseService>('STORAGE_D1'),
  VECTOR: new InjectionToken<VectorStorageService>('STORAGE_VECTOR'),
} as const;

/**
 * Cache service tokens
 */
export const CACHE_TOKENS = {
  L1: new InjectionToken<CacheService>('CACHE_L1'),
  L2: new InjectionToken<CacheService>('CACHE_L2'),
  MULTI: new InjectionToken<MultiLevelCacheService>('CACHE_MULTI'),
} as const;

/**
 * Security service tokens
 */
export const SECURITY_TOKENS = {
  AUTHENTICATION: new InjectionToken<AuthenticationService>(
    'AUTHENTICATION'
  ),
  AUTHORIZATION: new InjectionToken<AuthorizationService>('AUTHORIZATION'),
  ENCRYPTION: new InjectionToken<EncryptionService>('ENCRYPTION'),
  AUDIT: new InjectionToken<AuditLoggingService>('AUDIT_LOGGING'),
} as const;

/**
 * Monitoring service tokens
 */
export const MONITORING_TOKENS = {
  METRICS: new InjectionToken<MetricsService>('METRICS'),
  TRACING: new InjectionToken<TracingService>('TRACING'),
  LOGGING: new InjectionToken<LoggingService>('LOGGING'),
} as const;

/**
 * Developer tool tokens
 */
export const DEV_TOOL_TOKENS = {
  CLI: new InjectionToken<CLIService>('CLI'),
  VSCODE: new InjectionToken<VSCodeExtensionService>('VSCODE_EXTENSION'),
  DASHBOARD: new InjectionToken<DashboardService>('DASHBOARD'),
  PORTAL: new InjectionToken<DeveloperPortalService>('DEVELOPER_PORTAL'),
} as const;

/**
 * All tokens
 */
export const ALL_TOKENS = {
  ...CORE_TOKENS,
  ...AI_TOKENS,
  ...STORAGE_TOKENS,
  ...CACHE_TOKENS,
  ...SECURITY_TOKENS,
  ...MONITORING_TOKENS,
  ...DEV_TOOL_TOKENS,
} as const;

/**
 * Token type definitions (forward declarations)
 */
interface ServiceRegistry {}
interface EventBus {}
interface StateManager {}
interface ConfigManager {}
interface DIContainer {}
interface AIProviderService {}
interface EmbeddingsService {}
interface SemanticCacheService {}
interface RAGIndexerService {}
interface AgentOrchestratorService {}
interface KVStorageService {}
interface R2StorageService {}
interface D1DatabaseService {}
interface VectorStorageService {}
interface CacheService {}
interface MultiLevelCacheService {}
interface AuthenticationService {}
interface AuthorizationService {}
interface EncryptionService {}
interface AuditLoggingService {}
interface MetricsService {}
interface TracingService {}
interface LoggingService {}
interface CLIService {}
interface VSCodeExtensionService {}
interface DashboardService {}
interface DeveloperPortalService {}

/**
 * Token utilities
 */
export class TokenUtils {
  /**
   * Get token name
   */
  static getName(token: InjectionToken<unknown>): string {
    return token.description;
  }

  /**
   * Check if token is a core token
   */
  static isCoreToken(token: InjectionToken<unknown>): boolean {
    return Object.values(CORE_TOKENS).includes(token);
  }

  /**
   * Check if token is an AI token
   */
  static isAIToken(token: InjectionToken<unknown>): boolean {
    return Object.values(AI_TOKENS).includes(token);
  }

  /**
   * Check if token is a storage token
   */
  static isStorageToken(token: InjectionToken<unknown>): boolean {
    return Object.values(STORAGE_TOKENS).includes(token);
  }

  /**
   * Check if token is a cache token
   */
  static isCacheToken(token: InjectionToken<unknown>): boolean {
    return Object.values(CACHE_TOKENS).includes(token);
  }

  /**
   * Check if token is a security token
   */
  static isSecurityToken(token: InjectionToken<unknown>): boolean {
    return Object.values(SECURITY_TOKENS).includes(token);
  }

  /**
   * Check if token is a monitoring token
   */
  static isMonitoringToken(token: InjectionToken<unknown>): boolean {
    return Object.values(MONITORING_TOKENS).includes(token);
  }

  /**
   * Check if token is a developer tool token
   */
  static isDevToolToken(token: InjectionToken<unknown>): boolean {
    return Object.values(DEV_TOOL_TOKENS).includes(token);
  }

  /**
   * Get token category
   */
  static getCategory(
    token: InjectionToken<unknown>
  ): 'core' | 'ai' | 'storage' | 'cache' | 'security' | 'monitoring' | 'dev-tools' | 'unknown' {
    if (this.isCoreToken(token)) return 'core';
    if (this.isAIToken(token)) return 'ai';
    if (this.isStorageToken(token)) return 'storage';
    if (this.isCacheToken(token)) return 'cache';
    if (this.isSecurityToken(token)) return 'security';
    if (this.isMonitoringToken(token)) return 'monitoring';
    if (this.isDevToolToken(token)) return 'dev-tools';
    return 'unknown';
  }
}
