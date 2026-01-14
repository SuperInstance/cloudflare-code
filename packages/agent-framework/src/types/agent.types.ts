/**
 * Core Agent Type Definitions
 *
 * This file contains all fundamental types for the agent framework,
 * including agent identities, states, capabilities, and metadata.
 */

/**
 * Unique identifier for an agent
 */
export type AgentId = string;

/**
 * Unique identifier for a task
 */
export type TaskId = string;

/**
 * Unique identifier for a message
 */
export type MessageId = string;

/**
 * Unique identifier for a conversation/session
 */
export type ConversationId = string;

/**
 * Agent types supported by the framework
 */
export enum AgentType {
  // Core agent types
  ORCHESTRATOR = 'orchestrator',
  WORKER = 'worker',
  SUPERVISOR = 'supervisor',
  COORDINATOR = 'coordinator',

  // Specialized agent types
  PLANNER = 'planner',
  EXECUTOR = 'executor',
  ANALYZER = 'analyzer',
  REVIEWER = 'reviewer',
  OPTIMIZER = 'optimizer',

  // Domain-specific agents
  CODING = 'coding',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
  DEBUGGING = 'debugging',
  REFACTORING = 'refactoring',

  // Communication agents
  MESSENGER = 'messenger',
  BROADCASTER = 'broadcaster',

  // Custom agent types
  CUSTOM = 'custom'
}

/**
 * Agent lifecycle states
 */
export enum AgentState {
  STARTING = 'starting',
  IDLE = 'idle',
  BUSY = 'busy',
  SUSPENDED = 'suspended',
  TERMINATING = 'terminating',
  TERMINATED = 'terminated',
  ERROR = 'error'
}

/**
 * Agent health status
 */
export enum AgentHealth {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

/**
 * Agent capability definition
 */
export interface AgentCapability {
  name: string;
  version: string;
  description: string;
  category: string;
  features?: string[];
  dependencies?: string[];
  maxConcurrentTasks?: number;
  supportedModels?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Agent metadata and information
 */
export interface AgentInfo {
  id: AgentId;
  name: string;
  type: AgentType;
  state: AgentState;
  health: AgentHealth;
  capabilities: AgentCapability[];

  // Performance metrics
  load: number; // 0-1 scale
  taskQueueSize: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskDuration: number;

  // Timestamps
  createdAt: number;
  startedAt?: number;
  lastHeartbeat: number;
  lastActivityAt: number;

  // Resource information
  maxMemory?: number;
  currentMemory?: number;
  cpuUsage?: number;

  // Configuration
  config: AgentConfig;

  // Metadata
  metadata: Record<string, unknown>;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  maxConcurrentTasks: number;
  taskTimeout: number;
  heartbeatInterval: number;
  retryPolicy: RetryPolicy;
  scalingPolicy?: ScalingPolicy;
  resourceLimits?: ResourceLimits;
  communicationConfig: CommunicationConfig;
}

/**
 * Retry policy for failed operations
 */
export interface RetryPolicy {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

/**
 * Scaling policy for auto-scaling agents
 */
export interface ScalingPolicy {
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  scaleUpThreshold: number; // load percentage
  scaleDownThreshold: number; // load percentage
  cooldownPeriod: number;
}

/**
 * Resource limits for an agent
 */
export interface ResourceLimits {
  maxMemory: number;
  maxCpu: number;
  maxTasks: number;
  maxConnections: number;
}

/**
 * Communication configuration
 */
export interface CommunicationConfig {
  messageQueueSize: number;
  messageTimeout: number;
  maxMessageSize: number;
  enableCompression: boolean;
  enableEncryption: boolean;
}

/**
 * Agent creation parameters
 */
export interface CreateAgentParams {
  name: string;
  type: AgentType;
  capabilities: AgentCapability[];
  config?: Partial<AgentConfig>;
  metadata?: Record<string, unknown>;
}

/**
 * Agent spawn result
 */
export interface SpawnAgentResult {
  agentId: AgentId;
  success: boolean;
  error?: string;
  startTime: number;
}

/**
 * Agent statistics
 */
export interface AgentStats {
  agentId: AgentId;
  uptime: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskDuration: number;
  successRate: number;
  currentLoad: number;
  memoryUsage: number;
  cpuUsage: number;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
}

/**
 * Agent selection criteria
 */
export interface AgentSelectionCriteria {
  type?: AgentType;
  capabilities?: string[];
  minHealth?: AgentHealth;
  maxLoad?: number;
  requiredFeatures?: string[];
  excludeAgents?: AgentId[];
  priority?: 'load' | 'capability' | 'random' | 'round-robin';
}

/**
 * Agent filter for queries
 */
export interface AgentFilter {
  type?: AgentType | AgentType[];
  state?: AgentState | AgentState[];
  health?: AgentHealth | AgentHealth[];
  capabilities?: string[];
  minUptime?: number;
  maxLoad?: number;
  createdAfter?: number;
  createdBefore?: number;
}

/**
 * Agent update operation
 */
export interface AgentUpdate {
  state?: AgentState;
  health?: AgentHealth;
  load?: number;
  capabilities?: AgentCapability[];
  config?: Partial<AgentConfig>;
  metadata?: Record<string, unknown>;
}

/**
 * Bulk agent operation result
 */
export interface BulkOperationResult {
  successful: AgentId[];
  failed: Array<{ agentId: AgentId; error: string }>;
  totalCount: number;
  successCount: number;
  failureCount: number;
}
