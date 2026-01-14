/**
 * Collaboration Pattern Type Definitions
 *
 * This file contains all types related to agent collaboration patterns,
 * including master-worker, peer-to-peer, hierarchical, and swarm patterns.
 */

import type { AgentId, TaskId } from './agent.types';
import type { Message } from './message.types';

/**
 * Collaboration pattern types
 */
export enum CollaborationPattern {
  // Basic patterns
  MASTER_WORKER = 'master_worker',
  PEER_TO_PEER = 'peer_to_peer',
  HIERARCHICAL = 'hierarchical',

  // Advanced patterns
  CONSENSUS = 'consensus',
  VOTING = 'voting',
  NEGOTIATION = 'negotiation',
  AUCTION = 'auction',

  // Communication patterns
  FAN_OUT = 'fan_out',
  FAN_IN = 'fan_in',
  PIPELINE = 'pipeline',
  BROADCAST = 'broadcast',

  // Swarm patterns
  SWARM = 'swarm',
  FLOCKING = 'flocking',
  FORAGING = 'foraging',

  // Market patterns
  MARKETPLACE = 'marketplace',
  CONTRACT_NET = 'contract_net',

  // Custom patterns
  CUSTOM = 'custom'
}

/**
 * Pattern configuration
 */
export interface PatternConfig {
  pattern: CollaborationPattern;
  participants: AgentId[];
  timeout: number;
  maxRetries: number;
  fallbackEnabled: boolean;
  fallbackPattern?: CollaborationPattern;
  metadata: Record<string, unknown>;
}

/**
 * Master-worker pattern configuration
 */
export interface MasterWorkerConfig extends PatternConfig {
  pattern: CollaborationPattern.MASTER_WORKER;
  masterId: AgentId;
  workerIds: AgentId[];
  taskDistribution: 'round_robin' | 'least_loaded' | 'random' | 'hash';
  resultAggregation: 'merge' | 'reduce' | 'custom';
  workerTimeout: number;
  maxConcurrentTasks: number;
}

/**
 * Peer-to-peer pattern configuration
 */
export interface PeerToPeerConfig extends PatternConfig {
  pattern: CollaborationPattern.PEER_TO_PEER;
  peers: AgentId[];
  gossipProtocol: 'push' | 'pull' | 'push_pull';
  gossipInterval: number;
  gossipFanout: number;
  consensusAlgorithm: 'raft' | 'paxos' | 'gossip';
}

/**
 * Hierarchical pattern configuration
 */
export interface HierarchicalConfig extends PatternConfig {
  pattern: CollaborationPattern.HIERARCHICAL;
  hierarchy: AgentHierarchy;
  escalationRules: EscalationRule[];
  delegationEnabled: boolean;
}

/**
 * Agent hierarchy definition
 */
export interface AgentHierarchy {
  levels: HierarchyLevel[];
  edges: HierarchyEdge[];
}

/**
 * Hierarchy level
 */
export interface HierarchyLevel {
  level: number;
  agents: AgentId[];
  supervisor?: AgentId;
}

/**
 * Hierarchy edge
 */
export interface HierarchyEdge {
  from: AgentId;
  to: AgentId;
  type: 'supervision' | 'delegation' | 'reporting';
}

/**
 * Escalation rule
 */
export interface EscalationRule {
  condition: EscalationCondition;
  escalateTo: AgentId;
  timeout: number;
  maxEscalations: number;
}

/**
 * Escalation condition
 */
export interface EscalationCondition {
  type: 'timeout' | 'failure' | 'load' | 'custom';
  threshold?: number;
  customCheck?: string;
}

/**
 * Consensus pattern configuration
 */
export interface ConsensusConfig extends PatternConfig {
  pattern: CollaborationPattern.CONSENSUS;
  algorithm: 'raft' | 'paxos' | 'pbft' | 'poa';
  participants: AgentId[];
  requiredQuorum: number;
  timeout: number;
  votingMechanism: VotingMechanism;
}

/**
 * Voting mechanism
 */
export enum VotingMechanism {
  MAJORITY = 'majority',
  SUPERMAJORITY = 'supermajority',
  UNANIMOUS = 'unanimous',
  WEIGHTED = 'weighted',
  CONSENSUS = 'consensus'
}

/**
 * Vote
 */
export interface Vote {
  voteId: string;
  voterId: AgentId;
  decision: 'approve' | 'reject' | 'abstain';
  weight: number;
  timestamp: number;
  reason?: string;
}

/**
 * Voting result
 */
export interface VotingResult {
  proposalId: string;
  votes: Vote[];
  outcome: 'approved' | 'rejected' | 'pending';
  approvalCount: number;
  rejectionCount: number;
  abstentionCount: number;
  totalWeight: number;
  approvalWeight: number;
  requiredWeight: number;
  timestamp: number;
}

/**
 * Negotiation configuration
 */
export interface NegotiationConfig extends PatternConfig {
  pattern: CollaborationPattern.NEGOTIATION;
  protocol: 'alternating_offers' | 'monotonic_concession' | 'simultaneous';
  participants: AgentId[];
  maxRounds: number;
  convergenceThreshold: number;
  utilityFunction?: UtilityFunction;
}

/**
 * Utility function for negotiation
 */
export interface UtilityFunction {
  type: 'linear' | 'exponential' | 'custom';
  parameters: Record<string, number>;
  customFunction?: string;
}

/**
 * Negotiation proposal
 */
export interface NegotiationProposal {
  proposalId: string;
  proposerId: AgentId;
  offer: Record<string, unknown>;
  utility: number;
  round: number;
  timestamp: number;
  expiresAt: number;
}

/**
 * Negotiation outcome
 */
export interface NegotiationOutcome {
  proposalId: string;
  outcome: 'agreement' | 'breakdown' | 'timeout';
  finalOffer?: Record<string, unknown>;
  rounds: number;
  participants: AgentId[];
  completedAt: number;
  reason?: string;
}

/**
 * Fan-out configuration
 */
export interface FanOutConfig extends PatternConfig {
  pattern: CollaborationPattern.FAN_OUT;
  sourceId: AgentId;
  destinations: AgentId[];
  message: Message;
  aggregationStrategy: 'wait_all' | 'wait_first' | 'wait_quorum' | 'custom';
  quorumSize?: number;
  aggregationTimeout: number;
}

/**
 * Fan-in configuration
 */
export interface FanInConfig extends PatternConfig {
  pattern: CollaborationPattern.FAN_IN;
  sources: AgentId[];
  destinationId: AgentId;
  aggregationFunction: AggregationFunction;
  bufferSize: number;
  flushInterval: number;
}

/**
 * Aggregation function
 */
export enum AggregationFunction {
  MERGE = 'merge',
  REDUCE = 'reduce',
  CONCATENATE = 'concatenate',
  AVERAGE = 'average',
  SUM = 'sum',
  MAX = 'max',
  MIN = 'min',
  CUSTOM = 'custom'
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig extends PatternConfig {
  pattern: CollaborationPattern.PIPELINE;
  stages: PipelineStage[];
  parallelism: number;
  bufferSizes: number[];
  errorHandling: 'stop' | 'skip' | 'retry';
}

/**
 * Pipeline stage
 */
export interface PipelineStage {
  stageId: string;
  agentId: AgentId;
  order: number;
  inputTransform?: string;
  outputTransform?: string;
  timeout: number;
}

/**
 * Swarm configuration
 */
export interface SwarmConfig extends PatternConfig {
  pattern: CollaborationPattern.SWARM;
  agents: AgentId[];
  behavior: SwarmBehavior;
  communicationRadius: number;
  alignmentForce: number;
  cohesionForce: number;
  separationForce: number;
}

/**
 * Swarm behavior
 */
export enum SwarmBehavior {
  FLOCKING = 'flocking',
  FORAGING = 'foraging',
  SWARMING = 'swarming',
  DISPERSING = 'dispersing'
}

/**
 * Contract net configuration
 */
export interface ContractNetConfig extends PatternConfig {
  pattern: CollaborationPattern.CONTRACT_NET;
  initiatorId: AgentId;
  participants: AgentId[];
  announcement: ContractAnnouncement;
  biddingTimeout: number;
  awardingCriteria: AwardingCriteria;
}

/**
 * Contract announcement
 */
export interface ContractAnnouncement {
  taskId: TaskId;
  taskDescription: string;
  requirements: Record<string, unknown>;
  constraints: Record<string, unknown>;
  expiration: number;
}

/**
 * Contract bid
 */
export interface ContractBid {
  bidId: string;
  bidderId: AgentId;
  taskId: TaskId;
  proposal: Record<string, unknown>;
  estimatedCost: number;
  estimatedDuration: number;
  confidence: number;
  timestamp: number;
}

/**
 * Awarding criteria
 */
export enum AwardingCriteria {
  LOWEST_COST = 'lowest_cost',
  FASTEST = 'fastest',
  HIGHEST_CONFIDENCE = 'highest_confidence',
  WEIGHTED = 'weighted',
  CUSTOM = 'custom'
}

/**
 * Contract award
 */
export interface ContractAward {
  taskId: TaskId;
  winnerId: AgentId;
  awardTime: number;
  terms: Record<string, unknown>;
}

/**
 * Collaboration session
 */
export interface CollaborationSession {
  sessionId: string;
  pattern: CollaborationPattern;
  config: PatternConfig;
  participants: AgentId[];
  status: CollaborationStatus;
  startTime: number;
  endTime?: number;
  messages: Message[];
  results: Map<AgentId, unknown>;
  errors: Map<AgentId, string>;
  metadata: Record<string, unknown>;
}

/**
 * Collaboration status
 */
export enum CollaborationStatus {
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Collaboration result
 */
export interface CollaborationResult {
  sessionId: string;
  pattern: CollaborationPattern;
  status: CollaborationStatus;
  participants: AgentId[];
  results: Map<AgentId, unknown>;
  aggregatedResult?: unknown;
  errors: Map<AgentId, string>;
  metrics: CollaborationMetrics;
  completedAt: number;
}

/**
 * Collaboration metrics
 */
export interface CollaborationMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  messagesExchanged: number;
  participantsInvolved: number;
  tasksCompleted: number;
  tasksFailed: number;
  averageResponseTime: number;
  throughput: number;
}

/**
 * Pattern execution context
 */
export interface PatternExecutionContext {
  sessionId: string;
  pattern: CollaborationPattern;
  currentStep: string;
  variables: Map<string, unknown>;
  history: PatternExecutionStep[];
  startTime: number;
}

/**
 * Pattern execution step
 */
export interface PatternExecutionStep {
  stepId: string;
  name: string;
  timestamp: number;
  agentId: AgentId;
  action: string;
  input: unknown;
  output: unknown;
  duration: number;
  status: 'success' | 'failure' | 'pending';
}

/**
 * Pattern validation result
 */
export interface PatternValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}
