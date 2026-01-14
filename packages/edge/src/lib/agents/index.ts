/**
 * Multi-Agent Conversation Orchestration System - Main Export
 *
 * Comprehensive system for coordinating AI agents with:
 * - 8 specialized agent types (Director, Planner, Executor, Reviewer, Analyst, Debugger, Documenter, Optimizer)
 * - Pub/sub messaging with <100ms delivery
 * - Agent registry with capability discovery
 * - 8 collaboration patterns (fan-out, fan-in, chain, pipeline, consensus, expert-finder, aggregation, fallback)
 * - Context management with threading
 * - Conflict resolution
 * - Message routing and dispatch
 *
 * Architecture:
 *   User Request → Director Agent (DO)
 *                    ↓
 *              Fan-out to Specialist Agents (DO)
 *                    ↓
 *              Execute Plans via Executors (DO)
 *                    ↓
 *              Aggregate & Return Response
 *
 * Performance Targets:
 * - <100ms message delivery
 * - Support 10K+ concurrent sessions
 * - 80%+ test coverage
 * - Sub-1ms state access latency
 */

// ==================== Durable Objects ====================

// Core Agents
export { DirectorAgent, createDirectorStub, orchestrateChat } from '../../do/director';
export { PlannerAgent, createPlannerStub } from '../../do/planner';
export { ExecutorAgent, createExecutorStub } from '../../do/executor';

// Specialist Agents
export { ReviewerAgent } from '../../do/reviewer';
export { AnalystAgent } from '../../do/analyst';
export { DebuggerAgent } from '../../do/debugger';
export { DocumenterAgent } from '../../do/documenter';
export { OptimizerAgent } from '../../do/optimizer';

// ==================== Communication & Messaging ====================

// Pub/Sub System
export { PubSubSystem, PubSubDO, createPubSubStub } from './pubsub';

// Agent Registry
export {
  AgentRegistry,
  AgentRegistryDO,
  createRegistryStub,
  registerAgent,
  updateHeartbeat,
  selectBestAgent,
  discoverAgents,
} from './registry';

// Context Management
export { ContextManager, ContextManagerDO, createContextStub } from './context';

// Message Routing & Dispatch
export { MessageRouter, MessageRouterDO, createRouterStub, routeMessage } from './messaging';

// Collaboration Patterns
export {
  CollaborationEngine,
  ConflictResolver,
  executeCollaboration,
} from './collaboration';

// Legacy Messenger (for backward compatibility)
export { AgentMessenger, AgentMessengerDO, createMessengerStub } from './messenger';

// ==================== Types ====================

export type {
  // Agent Types
  AgentType,
  PlannerExpertise,

  // Message Types
  MessageType,
  MessagePriority,
  MessageContext,

  // Agent Info
  AgentInfo,
  AgentCapability,

  // Message Schema
  AgentMessage,

  // Conversation
  ConversationContext,
  ConversationThread,

  // Message Delivery
  MessageStatus,

  // Pub/Sub
  Topic,
  Subscription,
  MessageFilter,

  // Chat
  ChatRequest,
  ChatResponse,

  // Planning
  Plan,
  PlanStep,
  PlanResult,
  StepResult,

  // Analysis
  Complexity,
  TokenEstimate,
  ModelSelection,

  // Coordination
  CollaborationPattern,
  CollaborationRequest,
  CollaborationResult,

  // Conflict Resolution
  ConflictResolution,
  ConflictResolutionResult,

  // Discovery
  DiscoveryCriteria,

  // Routing
  RoutingEntry,
  HistoryEntry,

  // Director State
  DirectorState,

  // Registry
  RegistryState,
  HealthStatus,
  LoadInfo,

  // Executor
  Context,
  ProgressUpdate,

  // Recovery
  RecoveryAction,
} from './types';

/**
 * Multi-Agent Conversation Orchestration System
 *
 * This comprehensive system provides stateful orchestration of AI agents using
 * Cloudflare Durable Objects.
 *
 * Features:
 * - 8 specialized agent types for different tasks
 * - Pub/sub messaging for scalable communication
 * - Capability-based agent discovery and routing
 * - 8 collaboration patterns for flexible coordination
 * - Thread-based conversation context management
 * - Conflict resolution for multi-agent scenarios
 *
 * Agent Types:
 * 1. Director: High-level task orchestration
 * 2. Planner: Break down complex tasks into steps
 * 3. Executor: Execute code changes
 * 4. Reviewer: Review code quality
 * 5. Analyst: Analyze codebase structure
 * 6. Debugger: Debug issues
 * 7. Documenter: Generate documentation
 * 8. Optimizer: Optimize performance
 *
 * Collaboration Patterns:
 * - Fan-out: One agent → Multiple agents
 * - Fan-in: Multiple agents → One aggregator
 * - Chain: A → B → C → D sequential execution
 * - Pipeline: Sequential stages with data flow
 * - Consensus: Majority vote decision making
 * - Expert-finder: Route to most capable agent
 * - Aggregation: Collect from multiple agents
 * - Fallback: Primary → Backup failover
 *
 * Usage Example:
 * ```typescript
 * import { orchestrateChat, executeCollaboration } from './lib/agents';
 *
 * // Simple chat orchestration
 * const response = await orchestrateChat(env, {
 *   sessionId: 'session-123',
 *   userId: 'user-456',
 *   messages: [
 *     { role: 'user', content: 'Write a function to sort an array' }
 *   ],
 *   context: { language: 'typescript' }
 * });
 *
 * // Advanced collaboration pattern
 * const result = await executeCollaboration(env, {
 *   pattern: 'fan-out',
 *   primaryAgent: 'director-1',
 *   secondaryAgents: ['planner-1', 'planner-2', 'planner-3'],
 *   timeout: 5000,
 *   fallbackEnabled: true,
 *   message: {
 *     id: crypto.randomUUID(),
 *     from: 'user',
 *     to: 'director-1',
 *     type: 'request',
 *     action: 'coordinate',
 *     payload: { task: 'Implement feature X' },
 *     context: {
 *       conversationId: 'conv-1',
 *       metadata: {},
 *       timestamp: Date.now()
 *     },
 *     priority: 'normal',
 *     timestamp: Date.now()
 *   }
 * });
 *
 * console.log(response.content);
 * console.log(result.status, result.results);
 * ```
 */
