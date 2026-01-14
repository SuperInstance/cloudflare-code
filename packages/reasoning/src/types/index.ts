/**
 * Core type definitions for the reasoning and planning system
 */

// ============================================================================
// Base Types
// ============================================================================

export interface ReasoningStep {
  id: string;
  timestamp: number;
  content: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface ThoughtNode {
  id: string;
  content: string;
  depth: number;
  parentId: string | null;
  children: string[];
  score?: number;
  visited: boolean;
  evaluation?: ThoughtEvaluation;
}

export interface ThoughtEvaluation {
  value: number;
  reasoning: string;
  confidence: number;
}

// ============================================================================
// Chain-of-Thought Types
// ============================================================================

export interface ChainOfThoughtConfig {
  maxSteps?: number;
  temperature?: number;
  verbose?: boolean;
  includeIntermediateSteps?: boolean;
  selfConsistencySamples?: number;
  confidenceThreshold?: number;
}

export interface ChainOfThoughtResult {
  finalAnswer: string;
  reasoningChain: ReasoningStep[];
  confidence: number;
  metadata: {
    totalSteps: number;
    executionTime: number;
    tokensUsed?: number;
  };
}

export interface CoTIntermediateStep {
  step: number;
  thought: string;
  action?: string;
  observation?: string;
  confidence: number;
}

// ============================================================================
// Tree-of-Thoughts Types
// ============================================================================

export interface TreeOfThoughtsConfig {
  maxDepth?: number;
  branchingFactor?: number;
  evaluationMethod?: 'value' | 'vote' | 'comparison';
  pruningThreshold?: number;
  maxNodes?: number;
  explorationStrategy?: 'breadth' | 'depth' | 'best-first';
  beamWidth?: number;
}

export interface TreeOfThoughtsResult {
  finalAnswer: string;
  thoughtTree: ThoughtNode[];
  bestPath: string[];
  evaluation: TreeEvaluation;
  metadata: {
    totalNodes: number;
    maxDepthReached: number;
    executionTime: number;
    prunedNodes: number;
  };
}

export interface TreeEvaluation {
  bestNode: ThoughtNode;
  averageScore: number;
  exploredPaths: number;
  successfulPaths: number;
}

// ============================================================================
// ReAct Types
// ============================================================================

export interface ReActConfig {
  maxIterations?: number;
  toolTimeout?: number;
  verbose?: boolean;
  allowRepeatedActions?: boolean;
  maxToolErrors?: number;
  thoughtPrompt?: string;
  actionPrompt?: string;
}

export interface ReActStep {
  thought: string;
  action: string;
  actionInput: Record<string, unknown>;
  observation?: unknown;
  error?: string;
  timestamp: number;
}

export interface ReActResult {
  finalAnswer: string;
  steps: ReActStep[];
  toolCalls: ToolCall[];
  metadata: {
    totalSteps: number;
    totalToolCalls: number;
    executionTime: number;
    errors: number;
  };
}

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
  duration: number;
  success: boolean;
  timestamp: number;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
  timeout?: number;
}

// ============================================================================
// Task Decomposition Types
// ============================================================================

export interface Task {
  id: string;
  description: string;
  dependencies: string[];
  estimatedDuration?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'blocked';
  metadata?: Record<string, unknown>;
  subtasks?: Task[];
  resources?: Resource[];
  risks?: Risk[];
}

export interface Resource {
  type: string;
  id: string;
  capacity: number;
  allocated: number;
  availability: number;
}

export interface Risk {
  id: string;
  description: string;
  probability: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  mitigation?: string;
}

export interface TaskDecompositionConfig {
  maxDepth?: number;
  granularity?: 'coarse' | 'medium' | 'fine';
  includeTimeEstimates?: boolean;
  includeResourceAnalysis?: boolean;
  includeRiskAssessment?: boolean;
  parallelizationThreshold?: number;
}

export interface TaskDecompositionResult {
  rootTask: Task;
  taskGraph: TaskGraph;
  criticalPath: string[];
  resourceAllocation: ResourceAllocation;
  timeline: TaskTimeline;
  metadata: {
    totalTasks: number;
    maxDepth: number;
    estimatedCompletionTime: number;
  };
}

export interface TaskGraph {
  nodes: Map<string, Task>;
  edges: Map<string, string[]>;
  levels: Map<number, string[]>;
}

export interface ResourceAllocation {
  resources: Map<string, ResourceAllocationItem>;
  conflicts: ResourceConflict[];
  utilization: number;
}

export interface ResourceAllocationItem {
  taskId: string;
  resourceId: string;
  amount: number;
  startTime: number;
  endTime: number;
}

export interface ResourceConflict {
  resourceId: string;
  tasks: string[];
  conflictType: 'overallocation' | 'scheduling' | 'dependency';
  resolution?: string;
}

export interface TaskTimeline {
  startTime: number;
  endTime: number;
  milestones: Milestone[];
  phases: Phase[];
}

export interface Milestone {
  id: string;
  name: string;
  taskId: string;
  timestamp: number;
  completed: boolean;
}

export interface Phase {
  id: string;
  name: string;
  tasks: string[];
  startTime: number;
  endTime: number;
  parallelizable: boolean;
}

// ============================================================================
// Adaptive Replanning Types
// ============================================================================

export interface ReplanConfig {
  failureThreshold?: number;
  timeoutThreshold?: number;
  qualityThreshold?: number;
  maxReplanAttempts?: number;
  replanningStrategy?: 'conservative' | 'moderate' | 'aggressive';
  triggerSensitivity?: 'low' | 'medium' | 'high';
  includeAlternativePaths?: boolean;
}

export interface ReplanTrigger {
  type: 'failure' | 'timeout' | 'quality-drop' | 'resource-constraint' | 'dependency-failure' | 'user-intervention';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  context: ReplanContext;
}

export interface ReplanContext {
  currentTask: string;
  completedTasks: string[];
  failedTasks: string[];
  executionHistory: ExecutionEvent[];
  resourceState: Map<string, number>;
  timeElapsed: number;
}

export interface ExecutionEvent {
  taskId: string;
  timestamp: number;
  type: 'start' | 'complete' | 'fail' | 'timeout';
  details?: Record<string, unknown>;
}

export interface ReplanResult {
  originalPlan: Task[];
  newPlan: Task[];
  changes: PlanChange[];
  reasoning: string;
  confidence: number;
  metadata: {
    triggerType: string;
    replanTime: number;
    affectedTasks: number;
    estimatedDelay: number;
  };
}

export interface PlanChange {
  type: 'add' | 'remove' | 'modify' | 'reorder' | 'split' | 'merge';
  taskId: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  justification: string;
}

// ============================================================================
// Self-Consistency Types
// ============================================================================

export interface SelfConsistencyConfig {
  samples: number;
  temperature: number;
  aggregationMethod: 'majority' | 'weighted' | 'ranked';
  diversityThreshold?: number;
  confidenceWeighting?: boolean;
}

export interface SelfConsistencyResult {
  finalAnswer: string;
  samples: Sample[];
  consensus: number;
  disagreement: number;
  metadata: {
    totalSamples: number;
    uniqueAnswers: number;
    majorityCount: number;
    executionTime: number;
  };
}

export interface Sample {
  answer: string;
  confidence: number;
  reasoning: string;
  timestamp: number;
}

// ============================================================================
// Multi-Agent Debate Types
// ============================================================================

export interface Agent {
  id: string;
  name: string;
  role: string;
  perspective: string;
  personality?: AgentPersonality;
}

export interface AgentPersonality {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export interface DebateConfig {
  maxRounds?: number;
  convergenceThreshold?: number;
  votingMethod?: 'majority' | 'weighted' | 'consensus';
  argumentationStyle?: 'competitive' | 'collaborative' | 'mixed';
  timeLimitPerRound?: number;
}

export interface DebateRound {
  roundNumber: number;
  arguments: AgentArgument[];
  votes: AgentVote[];
  consensus: number;
  dominantView: string;
}

export interface AgentArgument {
  agentId: string;
  content: string;
  supportingPoints: string[];
  counterPoints: string[];
  confidence: number;
  timestamp: number;
}

export interface AgentVote {
  agentId: string;
  chosenAnswer: string;
  confidence: number;
  reasoning: string;
}

export interface DebateResult {
  finalAnswer: string;
  rounds: DebateRound[];
  consensus: number;
  participantContributions: Map<string, number>;
  metadata: {
    totalRounds: number;
    totalArguments: number;
    executionTime: number;
  };
}

// ============================================================================
// Analogical Reasoning Types
// ============================================================================

export interface Analogy {
  source: string;
  target: string;
  mapping: AnalogicalMapping;
  similarity: number;
  structuralAlignment: number;
}

export interface AnalogicalMapping {
  sourceElements: string[];
  targetElements: string[];
  relations: AnalogicalRelation[];
}

export interface AnalogicalRelation {
  sourcePair: [string, string];
  targetPair: [string, string];
  strength: number;
}

export interface AnalogicalReasoningConfig {
  maxAnalogies?: number;
  similarityThreshold?: number;
  abstractionLevel?: number;
  domain?: string;
}

export interface AnalogicalReasoningResult {
  targetProblem: string;
  retrievedAnalogies: Analogy[];
  selectedAnalogy: Analogy;
  solution: string;
  transferMapping: AnalogicalMapping;
  confidence: number;
}

// ============================================================================
// Visualization Types
// ============================================================================

export interface VisualizationConfig {
  format: 'graph' | 'tree' | 'timeline' | 'table' | 'mermaid';
  includeMetadata?: boolean;
  highlightPath?: string[];
  collapseThreshold?: number;
  interactive?: boolean;
  exportFormat?: 'svg' | 'png' | 'json' | 'html';
}

export interface GraphVisualization {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: 'hierarchical' | 'force' | 'circular' | 'grid';
  metadata?: GraphMetadata;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  status?: string;
  metadata?: Record<string, unknown>;
  position?: { x: number; y: number };
  style?: NodeStyle;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: string;
  weight?: number;
  style?: EdgeStyle;
}

export interface NodeStyle {
  color?: string;
  size?: number;
  shape?: 'circle' | 'rectangle' | 'diamond' | 'hexagon';
  border?: string;
  borderWidth?: number;
}

export interface EdgeStyle {
  color?: string;
  width?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  arrow?: boolean;
}

export interface GraphMetadata {
  title?: string;
  description?: string;
  legend?: LegendItem[];
  stats?: GraphStats;
}

export interface LegendItem {
  label: string;
  type: string;
  style: NodeStyle | EdgeStyle;
}

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  maxDepth: number;
  averageConnections: number;
}

export interface TimelineVisualization {
  events: TimelineEvent[];
  groups?: TimelineGroup[];
  metadata?: TimelineMetadata;
}

export interface TimelineEvent {
  id: string;
  label: string;
  start: number;
  end?: number;
  status?: string;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}

export interface TimelineGroup {
  id: string;
  label: string;
  events: string[];
  color?: string;
}

export interface TimelineMetadata {
  title?: string;
  startTime: number;
  endTime: number;
  totalEvents: number;
  milestones?: Milestone[];
}

// ============================================================================
// Progress Tracking Types
// ============================================================================

export interface ProgressTracker {
  taskId: string;
  totalSteps: number;
  completedSteps: number;
  currentStep: string;
  progress: number;
  eta?: number;
  milestones: ProgressMilestone[];
  status: 'in-progress' | 'completed' | 'failed' | 'paused';
}

export interface ProgressMilestone {
  id: string;
  name: string;
  achieved: boolean;
  timestamp?: number;
  position: number;
}

export interface ProgressUpdate {
  taskId: string;
  step: string;
  progress: number;
  timestamp: number;
  details?: Record<string, unknown>;
}

// ============================================================================
// Error Types
// ============================================================================

export class ReasoningError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ReasoningError';
  }
}

export class PlanningError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PlanningError';
  }
}

export class ReplanningError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ReplanningError';
  }
}

export class VisualizationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'VisualizationError';
  }
}
