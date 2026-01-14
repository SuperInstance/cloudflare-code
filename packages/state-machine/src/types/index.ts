/**
 * Core state machine types and interfaces
 */

import { EventEmitter } from 'eventemitter3';

/**
 * Base state type
 */
export type State = string;

/**
 * State context - data available during state transitions
 */
export interface StateContext<TData = any> {
  /** Current state */
  current: State;
  /** Previous state */
  previous?: State;
  /** Event that triggered the transition */
  event: string;
  /** Event payload */
  payload?: any;
  /** State machine data */
  data?: TData;
  /** Metadata */
  metadata?: Record<string, any>;
  /** Timestamp of transition */
  timestamp: number;
}

/**
 * Transition definition
 */
export interface Transition<TData = any> {
  /** Source state(s) - use '*' for wildcard */
  from: State | State[] | '*';
  /** Target state */
  to: State;
  /** Event that triggers this transition */
  on: string;
  /** Guard condition - must return true for transition to occur */
  guard?: Guard<TData>;
  /** Action to execute during transition */
  action?: Action<TData>;
  /** Actions to execute before transition */
  before?: Action<TData> | Action<TData>[];
  /** Actions to execute after transition */
  after?: Action<TData> | Action<TData>[];
  /** Transition metadata */
  metadata?: Record<string, any>;
  /** Priority for conflict resolution (higher = more priority) */
  priority?: number;
}

/**
 * Guard condition function
 */
export type Guard<TData = any> = (
  context: StateContext<TData>
) => boolean | Promise<boolean>;

/**
 * Action function
 */
export type Action<TData = any> = (
  context: StateContext<TData>
) => void | Promise<void> | any | Promise<any>;

/**
 * State definition
 */
export interface StateDefinition<TData = any> {
  /** State name */
  name: State;
  /** Parent state for hierarchical states */
  parent?: State;
  /** Initial child state for compound states */
  initial?: State;
  /** Enter action */
  onEntry?: Action<TData> | Action<TData>[];
  /** Exit action */
  onExit?: Action<TData> | Action<TData>[];
  /** Internal transitions */
  transitions?: Transition<TData>[];
  /** Parallel states */
  parallel?: StateMachineDefinition<TData>[];
  /** History type (shallow or deep) */
  history?: 'shallow' | 'deep';
  /** State metadata */
  metadata?: Record<string, any>;
  /** Is this a final state? */
  final?: boolean;
}

/**
 * State machine definition
 */
export interface StateMachineDefinition<TData = any> {
  /** Initial state */
  initial: State;
  /** States map */
  states: Record<State, StateDefinition<TData>>;
  /** Global transitions (apply to all states) */
  transitions?: Transition<TData>[];
  /** Context data */
  context?: TData;
  /** Metadata */
  metadata?: Record<string, any>;
  /** Machine ID */
  id?: string;
  /** Version */
  version?: string;
}

/**
 * State machine configuration
 */
export interface StateMachineConfig<TData = any> {
  /** State machine definition */
  definition: StateMachineDefinition<TData>;
  /** Enable auto-transition to initial state */
  autoStart?: boolean;
  /** Enable transition logging */
  enableLogging?: boolean;
  /** Enable metrics collection */
  enableMetrics?: boolean;
  /** Transition timeout in milliseconds */
  transitionTimeout?: number;
  /** Maximum parallel transitions */
  maxParallelTransitions?: number;
  /** Custom event emitter */
  emitter?: EventEmitter;
  /** Persist state changes */
  persist?: boolean;
  /** Persistence key */
  persistenceKey?: string;
  /** Enable dev mode (more verbose logging) */
  devMode?: boolean;
}

/**
 * State transition event
 */
export interface StateTransitionEvent<TData = any> {
  /** From state */
  from: State;
  /** To state */
  to: State;
  /** Event that triggered transition */
  event: string;
  /** Event payload */
  payload?: any;
  /** Transition result */
  result?: any;
  /** Error if transition failed */
  error?: Error;
  /** Duration in milliseconds */
  duration: number;
  /** Timestamp */
  timestamp: number;
  /** Context data */
  context?: TData;
  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * State machine events
 */
export interface StateMachineEvents<TData = any> {
  /** Fired when state changes */
  'state:change': (event: StateTransitionEvent<TData>) => void;
  /** Fired before transition */
  'transition:start': (context: StateContext<TData>) => void;
  /** Fired after transition */
  'transition:end': (event: StateTransitionEvent<TData>) => void;
  /** Fired on transition error */
  'transition:error': (error: Error, context: StateContext<TData>) => void;
  /** Fired when guard fails */
  'guard:fail': (context: StateContext<TData>) => void;
  /** Fired on action execution */
  'action:execute': (action: Action<TData>, context: StateContext<TData>) => void;
  /** Fired on action error */
  'action:error': (error: Error, action: Action<TData>, context: StateContext<TData>) => void;
  /** Fired on state entry */
  'state:entry': (state: State, context: StateContext<TData>) => void;
  /** Fired on state exit */
  'state:exit': (state: State, context: StateContext<TData>) => void;
  /** Fired when machine is reset */
  'machine:reset': () => void;
  /** Fired when machine is destroyed */
  'machine:destroy': () => void;
}

/**
 * State path for testing
 */
export interface StatePath {
  /** Sequence of states */
  states: State[];
  /** Events that caused transitions */
  events: string[];
  /** Transition count */
  length: number;
}

/**
 * State machine snapshot
 */
export interface StateMachineSnapshot<TData = any> {
  /** Current state */
  state: State;
  /** State history */
  history: State[];
  /** Context data */
  context?: TData;
  /** Metadata */
  metadata?: Record<string, any>;
  /** Version */
  version: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * State transition metrics
 */
export interface TransitionMetrics {
  /** Total transitions */
  total: number;
  /** Successful transitions */
  successful: number;
  /** Failed transitions */
  failed: number;
  /** Transition count by state */
  byState: Record<State, number>;
  /** Transition count by event */
  byEvent: Record<string, number>;
  /** Average transition duration */
  avgDuration: number;
  /** Min transition duration */
  minDuration: number;
  /** Max transition duration */
  maxDuration: number;
  /** Last transition timestamp */
  lastTransition?: number;
}

/**
 * State statistics
 */
export interface StateStatistics {
  /** State name */
  state: State;
  /** Entry count */
  entries: number;
  /** Exit count */
  exits: number;
  /** Total time spent in state (ms) */
  totalTime: number;
  /** Average time in state (ms) */
  avgTime: number;
  /** Min time in state (ms) */
  minTime: number;
  /** Max time in state (ms) */
  maxTime: number;
  /** First entry timestamp */
  firstEntry?: number;
  /** Last exit timestamp */
  lastExit?: number;
}

/**
 * Visualization options
 */
export interface VisualizationOptions {
  /** Output format */
  format?: 'svg' | 'png' | 'mermaid' | 'dot';
  /** Include state metadata */
  includeMetadata?: boolean;
  /** Include transition labels */
  includeLabels?: boolean;
  /** Color scheme */
  colors?: Record<string, string>;
  /** Layout direction */
  direction?: 'TB' | 'LR' | 'RL';
  /** Font size */
  fontSize?: number;
  /** Show only active states */
  activeOnly?: boolean;
  /** Animation duration */
  animationDuration?: number;
}

/**
 * Test options
 */
export interface TestOptions {
  /** Maximum path length to explore */
  maxPathLength?: number;
  /** Maximum test duration */
  maxDuration?: number;
  /** Include error paths */
  includeErrors?: boolean;
  /** Custom test data */
  testData?: any;
  /** Enable property-based testing */
  propertyBased?: boolean;
  /** Number of property test iterations */
  propertyIterations?: number;
}

/**
 * Test result
 */
export interface TestResult {
  /** Test name */
  name: string;
  /** Whether test passed */
  passed: boolean;
  /** Error message if failed */
  error?: string;
  /** State path taken */
  path: StatePath;
  /** Coverage data */
  coverage?: TestCoverage;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Test coverage
 */
export interface TestCoverage {
  /** States covered */
  states: Set<State>;
  /** Transitions covered */
  transitions: Set<string>;
  /** Events covered */
  events: Set<string>;
  /** Coverage percentage */
  percentage: number;
}

/**
 * Distributed state configuration
 */
export interface DistributedStateConfig {
  /** Node ID */
  nodeId: string;
  /** Cluster members */
  cluster: string[];
  /** Replication factor */
  replicationFactor?: number;
  /** Election timeout */
  electionTimeout?: number;
  /** Heartbeat interval */
  heartbeatInterval?: number;
  /** Sync timeout */
  syncTimeout?: number;
}

/**
 * State synchronization message
 */
export interface StateSyncMessage {
  /** Message type */
  type: 'sync' | 'sync_req' | 'heartbeat' | 'elect' | 'vote';
  /** Sender node ID */
  from: string;
  /** Current state */
  state?: State;
  /** State version */
  version?: number;
  /** Term for leader election */
  term?: number;
  /** Candidate ID for voting */
  candidateId?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Consensus result
 */
export interface ConsensusResult {
  /** Whether consensus was reached */
  reached: boolean;
  /** Agreed state */
  state?: State;
  /** Term */
  term: number;
  /** Votes for */
  votesFor: number;
  /** Votes against */
  votesAgainst: number;
}

/**
 * State machine error
 */
export class StateMachineError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: StateContext
  ) {
    super(message);
    this.name = 'StateMachineError';
  }
}

/**
 * Transition validation error
 */
export class TransitionError extends StateMachineError {
  constructor(
    message: string,
    context?: StateContext,
    public from?: State,
    public to?: State,
    public event?: string
  ) {
    super(message, 'TRANSITION_ERROR', context);
    this.name = 'TransitionError';
  }
}

/**
 * Guard error
 */
export class GuardError extends StateMachineError {
  constructor(
    message: string,
    context?: StateContext,
    public guard?: Guard
  ) {
    super(message, 'GUARD_ERROR', context);
    this.name = 'GuardError';
  }
}

/**
 * Action error
 */
export class ActionError extends StateMachineError {
  constructor(
    message: string,
    context?: StateContext,
    public action?: Action
  ) {
    super(message, 'ACTION_ERROR', context);
    this.name = 'ActionError';
  }
}
