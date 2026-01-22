/**
 * Agent Type Definitions for Multi-Agent Conversation Orchestration
 */

/**
 * All agent types in the system
 */
export type AgentType =
  | 'director'
  | 'planner'
  | 'executor'
  | 'reviewer'
  | 'analyst'
  | 'debugger'
  | 'documenter'
  | 'optimizer';

/**
 * Planner expertise areas
 */
export type PlannerExpertise = 'code' | 'documentation' | 'debugging' | 'architecture';

/**
 * Message priority levels
 */
export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Message types
 */
export type MessageType = 'request' | 'response' | 'notification' | 'error' | 'broadcast';

/**
 * Collaboration patterns
 */
export type CollaborationPattern =
  | 'fan-out' // One agent → Multiple agents
  | 'fan-in' // Multiple agents → One aggregator
  | 'chain' // A → B → C → D
  | 'pipeline' // Sequential stages
  | 'consensus' // Majority vote
  | 'expert-finder' // Route to most capable agent
  | 'aggregation' // Collect from multiple agents
  | 'fallback'; // Primary → Backup

/**
 * Agent capabilities for discovery
 */
export interface AgentCapability {
  name: string;
  version: string;
  description: string;
  expertise?: string[];
  maxTokens?: number;
  supportedModels?: string[];
  features?: string[];
}

/**
 * Agent information for registry
 */
export interface AgentInfo {
  id: string;
  type: AgentType;
  expertise?: PlannerExpertise;
  status: 'idle' | 'busy' | 'error';
  load: number; // 0-1 scale
  lastHeartbeat: number;
  createdAt: number;
  capabilities?: AgentCapability[];
}

/**
 * Enhanced message schema for agent communication
 */
export interface AgentMessage {
  id: string;
  from: string; // Agent ID
  to: string | string[]; // Agent ID(s) or "broadcast"
  type: MessageType;
  action: string;
  payload: unknown;
  context: MessageContext;
  priority: MessagePriority;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds
  correlationId?: string; // For request-response tracking
  replyTo?: string; // For response messages
}

/**
 * Message context for propagation
 */
export interface MessageContext {
  conversationId: string;
  sessionId?: string;
  userId?: string;
  parentId?: string; // Parent message ID for threading
  threadId?: string; // Thread ID for grouped conversations
  metadata: Record<string, unknown>;
  timestamp: number;
  ttl?: number;
}

/**
 * Conversation context for agents
 */
export interface ConversationContext {
  conversationId: string;
  sessionId?: string;
  userId?: string;
  messageCount: number;
  totalTokens: number;
  lastActivity: number;
  preferences: {
    language?: string;
    framework?: string;
    model?: string;
    temperature?: number;
  };
  history: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: number;
    agentId?: string;
  }>;
  threads: Map<string, ConversationThread>;
  metadata: Record<string, unknown>;
}

/**
 * Conversation thread for grouped discussions
 */
export interface ConversationThread {
  threadId: string;
  parentId: string;
  messages: string[]; // Message IDs
  participants: string[]; // Agent IDs
  status: 'active' | 'resolved' | 'closed';
  createdAt: number;
  updatedAt: number;
}

/**
 * Message delivery status
 */
export interface MessageStatus {
  messageId: string;
  status: 'pending' | 'delivered' | 'processing' | 'failed' | 'expired';
  attempts: number;
  lastAttempt: number;
  error?: string;
  deliveredAt?: number;
  processedAt?: number;
}

/**
 * Pub/sub subscription
 */
export interface Subscription {
  subscriptionId: string;
  subscriberId: string; // Agent ID
  topic: string;
  filter?: MessageFilter;
  createdAt: number;
  lastMessageAt?: number;
}

/**
 * Message filter for subscriptions
 */
export interface MessageFilter {
  messageType?: MessageType[];
  actions?: string[];
  priority?: MessagePriority[];
  fromAgent?: string[];
}

/**
 * Pub/sub topic
 */
export interface Topic {
  name: string;
  subscribers: Map<string, Subscription>;
  messageCount: number;
  lastMessageAt?: number;
  createdAt: number;
}

/**
 * Chat request from user
 */
export interface ChatRequest {
  sessionId: string;
  userId: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp?: number;
  }>;
  context?: {
    language?: string;
    framework?: string;
    projectPath?: string;
    repositoryHash?: string;
  };
  preferences?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  };
}

/**
 * Chat response to user
 */
export interface ChatResponse {
  id: string;
  sessionId: string;
  content: string;
  model: string;
  provider: string;
  finishReason: 'stop' | 'length' | 'content_filter';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  timestamp: number;
  latency: number;
  metadata?: {
    plansGenerated?: number;
    agentsInvolved?: string[];
    cacheHit?: boolean;
    collaborationPattern?: CollaborationPattern;
  };
}

/**
 * Plan generated by planner agent
 */
export interface Plan {
  id: string;
  plannerId: string;
  expertise: PlannerExpertise;
  steps: PlanStep[];
  estimatedTokens: number;
  selectedModel: string;
  provider: string;
  priority: number; // 0-1, higher is better
  confidence: number; // 0-1
  createdAt: number;
}

/**
 * Individual step in a plan
 */
export interface PlanStep {
  id: string;
  type: 'analyze' | 'generate' | 'validate' | 'retrieve';
  description: string;
  input: Record<string, unknown>;
  estimatedTokens: number;
  dependencies: string[]; // Step IDs that must complete first
}

/**
 * Plan execution result
 */
export interface PlanResult {
  planId: string;
  executorId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  steps: StepResult[];
  output: string;
  error?: string;
  metrics: {
    totalTokens: number;
    latency: number;
    startTime: number;
    endTime: number;
  };
}

/**
 * Result of executing a single step
 */
export interface StepResult {
  stepId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  output?: string;
  error?: string;
  tokens: number;
  latency: number;
  retries: number;
}

/**
 * Complexity analysis result
 */
export interface Complexity {
  level: 'low' | 'medium' | 'high';
  score: number; // 0-1
  factors: {
    codeComplexity: number;
    contextLength: number;
    multiFile: boolean;
    requiresResearch: boolean;
  };
}

/**
 * Token estimation
 */
export interface TokenEstimate {
  input: number;
  output: number;
  total: number;
  confidence: number; // 0-1
}

/**
 * Model selection
 */
export interface ModelSelection {
  model: string;
  provider: string;
  reason: string;
  estimatedCost: number;
  estimatedLatency: number;
}

/**
 * Director Agent state
 */
export interface DirectorState {
  sessionId: string;
  activePlanners: Set<string>;
  completedPlans: Map<string, Plan>;
  context: ConversationContext;
  metrics: {
    requestsProcessed: number;
    totalLatency: number;
    averageLatency: number;
    lastUpdate: number;
  };
}

/**
 * Recovery action for error handling
 */
export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'skip' | 'abort';
  retryWith?: {
    agentId?: string;
    backoffMs: number;
  };
  fallbackTo?: {
    agentId: string;
    reason: string;
  };
}

/**
 * Health status for agents
 */
export interface HealthStatus {
  healthy: number;
  unhealthy: number;
  total: number;
  details: Map<string, AgentInfo>;
}

/**
 * Load balancing info
 */
export interface LoadInfo {
  agentId: string;
  load: number; // 0-1
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
}

/**
 * Agent registry state
 */
export interface RegistryState {
  agents: Map<string, AgentInfo>;
  loadHistory: Map<string, number[]>;
  lastHealthCheck: number;
}

/**
 * Context for executor agent
 */
export interface Context {
  sessionId: string;
  userId: string;
  conversationHistory: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  metadata: Record<string, unknown>;
}

/**
 * Progress update during execution
 */
export interface ProgressUpdate {
  planId: string;
  stepNumber: number;
  totalSteps: number;
  currentStep: string;
  percentage: number;
  estimatedTimeRemaining: number;
}

/**
 * Collaboration request
 */
export interface CollaborationRequest {
  pattern: CollaborationPattern;
  primaryAgent: string;
  secondaryAgents?: string[];
  timeout: number;
  fallbackEnabled: boolean;
  message: AgentMessage;
}

/**
 * Collaboration result
 */
export interface CollaborationResult {
  pattern: CollaborationPattern;
  status: 'success' | 'partial' | 'failed';
  results: Map<string, unknown>;
  errors: Map<string, string>;
  metrics: {
    startTime: number;
    endTime: number;
    agentsInvolved: number;
    messagesExchanged: number;
  };
}

/**
 * Conflict resolution strategy
 */
export type ConflictResolution =
  | 'first-come-first-served'
  | 'last-write-wins'
  | 'merge'
  | 'vote'
  | 'priority'
  | 'custom';

/**
 * Conflict resolution result
 */
export interface ConflictResolutionResult {
  strategy: ConflictResolution;
  resolved: boolean;
  winner?: string; // Agent ID that won
  mergedValue?: unknown;
  votes?: Map<string, 'accept' | 'reject'>;
  reason: string;
}

/**
 * Agent discovery criteria
 */
export interface DiscoveryCriteria {
  agentType?: AgentType;
  expertise?: string;
  capabilities?: string[];
  minAvailability?: number; // 0-1
  maxLoad?: number; // 0-1
  requiredFeatures?: string[];
}

/**
 * Message routing table entry
 */
export interface RoutingEntry {
  agentId: string;
  topics: string[];
  capabilities: string[];
  load: number;
  lastHeartbeat: number;
}

/**
 * Conversation history entry
 */
export interface HistoryEntry {
  messageId: string;
  conversationId: string;
  from: string;
  to: string | string[];
  action: string;
  payload: unknown;
  timestamp: number;
  threadId?: string;
}
