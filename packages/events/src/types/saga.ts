/**
 * Type definitions for saga orchestration
 */

// ============================================================================
// Saga Definition
// ============================================================================

export interface SagaDefinition {
  sagaId: string;
  sagaType: string;
  name: string;
  description?: string;
  steps: SagaStep[];
  compensationStrategy: 'automatic' | 'manual' | 'none';
  timeoutMs: number;
  retryPolicy: RetryPolicy;
}

// ============================================================================
// Saga Step
// ============================================================================

export interface SagaStep {
  stepId: string;
  name: string;
  action: SagaAction;
  compensation?: SagaCompensation;
  timeoutMs: number;
  retryPolicy: RetryPolicy;
  compensateOn?: string[];
  metadata?: Record<string, unknown>;
}

export interface SagaAction {
  type: 'invoke' | 'publish' | 'wait' | 'branch' | 'parallel';
  target: string;
  payload?: unknown;
  parameters?: Record<string, unknown>;
}

export interface SagaCompensation {
  type: 'invoke' | 'publish' | 'custom';
  target: string;
  payload?: unknown;
  parameters?: Record<string, unknown>;
}

// ============================================================================
// Saga Instance
// ============================================================================

export interface SagaInstance {
  sagaId: string;
  sagaType: string;
  state: SagaState;
  currentStep: number;
  completedSteps: string[];
  failedAt?: string;
  context: SagaContext;
  history: SagaExecutionRecord[];
  startedAt: number;
  completedAt?: number;
  lastUpdated: number;
}

export type SagaState =
  | 'pending'
  | 'started'
  | 'running'
  | 'waiting'
  | 'compensating'
  | 'completed'
  | 'failed'
  | 'timed-out'
  | 'suspended';

// ============================================================================
// Saga Context
// ============================================================================

export interface SagaContext {
  sagaId: string;
  correlationId: string;
  variables: Record<string, unknown>;
  accumulatedData: Record<string, unknown>;
  compensations: Array<{
    stepId: string;
    action: SagaCompensation;
    executed: boolean;
    executedAt?: number;
    result?: unknown;
  }>;
}

// ============================================================================
// Retry Policy
// ============================================================================

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  backoffType: 'fixed' | 'linear' | 'exponential';
}

// ============================================================================
// Saga Execution Record
// ============================================================================

export interface SagaExecutionRecord {
  recordId: string;
  stepId: string;
  action: SagaAction;
  status: 'pending' | 'started' | 'completed' | 'failed' | 'compensated';
  startedAt: number;
  completedAt?: number;
  result?: unknown;
  error?: Error;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Choreography
// ============================================================================

export interface ChoreographyDefinition {
  choreographyId: string;
  name: string;
  participants: ChoreographyParticipant[];
  events: ChoreographyEvent[];
  timeoutMs: number;
  orchestration?: boolean;
}

export interface ChoreographyParticipant {
  participantId: string;
  service: string;
  role: 'orchestrator' | 'participant';
  endpoints: string[];
}

export interface ChoreographyEvent {
  eventId: string;
  eventType: string;
  publisher: string;
  subscribers: string[];
  schema?: string;
}

// ============================================================================
// Saga Coordination
// ============================================================================

export interface SagaCoordinationMessage {
  messageId: string;
  sagaId: string;
  sagaType: string;
  messageType: 'start' | 'step-complete' | 'step-fail' | 'compensate' | 'complete' | 'timeout';
  stepId?: string;
  payload?: unknown;
  timestamp: number;
}

export interface SagaTimeout {
  sagaId: string;
  stepId: string;
  timeoutAt: number;
  action: 'abort' | 'compensate' | 'retry';
}
