/**
 * Saga Orchestrator implementation
 */

// @ts-nocheck - Cloudflare Workers DurableObject types not fully available
import type {
  SagaDefinition,
  SagaInstance,
  SagaContext,
  SagaExecutionRecord,
  SagaStep,
  SagaAction,
  SagaCompensation,
  RetryPolicy,
  SagaState,
  SagaCoordinationMessage,
  SagaTimeout,
} from '../types';
import { generateSagaId, generateEventId } from '../utils/id';
import { calculateRetryDelay, shouldRetry, executeWithRetry } from '../utils/retry';

// ============================================================================
// Saga Orchestrator State
// ============================================================================

interface OrchestratorState {
  definitions: Record<string, SagaDefinition>;
  instances: Record<string, SagaInstance>;
  pendingTimeouts: SagaTimeout[];
}

// ============================================================================
// Saga Orchestrator Durable Object
// ============================================================================

export interface SagaOrchestratorEnv {
  EVENT_BUS: DurableObjectNamespace;
  WORKFLOW_ENGINE?: DurableObjectNamespace;
}

export class SagaOrchestratorDurableObject implements DurableObject {
  private state: OrchestratorState;

  constructor(
    private durableObjectState: DurableObjectState,
    private env: SagaOrchestratorEnv
  ) {
    this.state = {
      definitions: {},
      instances: {},
      pendingTimeouts: [],
    };
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const saved = await this.durableObjectState.storage.get<OrchestratorState>('state');

    if (saved) {
      this.state = saved;
    }

    // Process any pending timeouts
    this.processTimeouts();
  }

  private async save(): Promise<void> {
    await this.durableObjectState.storage.put('state', this.state);
  }

  // ============================================================================
  // Saga Definition Management
  // ============================================================================

  async registerDefinition(definition: SagaDefinition): Promise<void> {
    this.state.definitions[definition.sagaType] = definition;
    await this.save();
  }

  async getDefinition(sagaType: string): Promise<SagaDefinition | null> {
    return this.state.definitions[sagaType] ?? null;
  }

  async listDefinitions(): Promise<SagaDefinition[]> {
    return Object.values(this.state.definitions);
  }

  async deleteDefinition(sagaType: string): Promise<void> {
    delete this.state.definitions[sagaType];
    await this.save();
  }

  // ============================================================================
  // Saga Instance Management
  // ============================================================================

  async startSaga(
    sagaType: string,
    context: Partial<SagaContext>
  ): Promise<string> {
    const definition = this.state.definitions[sagaType];
    if (!definition) {
      throw new Error(`Saga definition not found: ${sagaType}`);
    }

    const sagaId = generateSagaId(sagaType);

    const sagaContext: SagaContext = {
      sagaId,
      correlationId: context.correlationId ?? generateEventId(),
      variables: context.variables ?? {},
      accumulatedData: context.accumulatedData ?? {},
      compensations: [],
    };

    const instance: SagaInstance = {
      sagaId,
      sagaType,
      state: 'started',
      currentStep: 0,
      completedSteps: [],
      context: sagaContext,
      history: [],
      startedAt: Date.now(),
      lastUpdated: Date.now(),
    };

    this.state.instances[sagaId] = instance;
    await this.save();

    // Start executing the saga
    this.executeSaga(sagaId).catch((error) => {
      console.error(`Saga ${sagaId} failed:`, error);
      instance.state = 'failed';
      instance.failedAt = error.message;
      this.save();
    });

    return sagaId;
  }

  private async executeSaga(sagaId: string): Promise<void> {
    const instance = this.state.instances[sagaId];
    if (!instance) {
      throw new Error(`Saga instance not found: ${sagaId}`);
    }

    const definition = this.state.definitions[instance.sagaType];
    if (!definition) {
      throw new Error(`Saga definition not found: ${instance.sagaType}`);
    }

    instance.state = 'running';

    try {
      for (let i = instance.currentStep; i < definition.steps.length; i++) {
        const step = definition.steps[i];
        instance.currentStep = i;

        // Execute step
        await this.executeStep(instance, step, definition.retryPolicy);

        // Check if saga was suspended
        if (instance.state === 'suspended') {
          break;
        }
      }

      // Check if all steps completed
      if (
        instance.state === 'running' &&
        instance.completedSteps.length === definition.steps.length
      ) {
        instance.state = 'completed';
        instance.completedAt = Date.now();
      }

      instance.lastUpdated = Date.now();
      await this.save();
    } catch (error) {
      instance.state = 'failed';
      instance.failedAt = error instanceof Error ? error.message : String(error);
      instance.lastUpdated = Date.now();

      // Trigger compensation if configured
      if (definition.compensationStrategy !== 'none') {
        await this.compensateSaga(sagaId);
      }

      await this.save();
    }
  }

  private async executeStep(
    instance: SagaInstance,
    step: SagaStep,
    retryPolicy: RetryPolicy
  ): Promise<void> {
    const record: SagaExecutionRecord = {
      recordId: generateEventId(),
      stepId: step.stepId,
      action: step.action,
      status: 'started',
      startedAt: Date.now(),
    };

    instance.history.push(record);

    try {
      // Execute with retry logic
      const result = await executeWithRetry(
        async () => {
          return await this.invokeAction(instance, step.action);
        },
        retryPolicy,
        async (attempt, error) => {
          console.error(
            `Step ${step.stepId} attempt ${attempt} failed:`,
            error
          );
        }
      );

      record.status = 'completed';
      record.completedAt = Date.now();
      record.result = result;

      instance.completedSteps.push(step.stepId);

      // Store compensation for later if needed
      if (step.compensation) {
        instance.context.compensations.push({
          stepId: step.stepId,
          action: step.compensation,
          executed: false,
        });
      }

      // Accumulate data
      if (result && typeof result === 'object') {
        instance.context.accumulatedData = {
          ...instance.context.accumulatedData,
          ...result,
        };
      }
    } catch (error) {
      record.status = 'failed';
      record.completedAt = Date.now();
      record.error = error instanceof Error ? error : new Error(String(error));

      throw error;
    }

    instance.lastUpdated = Date.now();
  }

  private async invokeAction(
    instance: SagaInstance,
    action: SagaAction
  ): Promise<unknown> {
    switch (action.type) {
      case 'invoke':
        return this.invokeService(instance, action.target, action.payload);

      case 'publish':
        return this.publishEvent(instance, action.target, action.payload);

      case 'wait':
        return this.waitAction(action);

      case 'branch':
        return this.branchAction(instance, action);

      case 'parallel':
        return this.parallelAction(instance, action);

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async invokeService(
    instance: SagaInstance,
    target: string,
    payload: unknown
  ): Promise<unknown> {
    // Invoke a service/endpoint
    // This would typically make an HTTP request or call a Worker
    const url = new URL(target);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Saga-Id': instance.sagaId,
        'X-Correlation-Id': instance.context.correlationId,
      },
      body: JSON.stringify({
        ...payload,
        ...instance.context.accumulatedData,
      }),
    });

    if (!response.ok) {
      throw new Error(`Service invocation failed: ${response.statusText}`);
    }

    return response.json();
  }

  private async publishEvent(
    instance: SagaInstance,
    target: string,
    payload: unknown
  ): Promise<unknown> {
    const eventBusStub = this.getEventBusStub();

    await eventBusStub.publish({
      metadata: {
        eventId: generateEventId(),
        eventType: target,
        timestamp: Date.now(),
        correlationId: instance.context.correlationId,
        causationId: instance.sagaId,
        version: 1,
        source: 'saga',
      },
      payload: {
        ...payload,
        ...instance.context.accumulatedData,
      },
    });

    return { published: true };
  }

  private async waitAction(action: SagaAction): Promise<unknown> {
    const durationMs = action.parameters?.durationMs as number ?? 1000;
    await new Promise((resolve) => setTimeout(resolve, durationMs));
    return { waited: durationMs };
  }

  private async branchAction(
    instance: SagaInstance,
    action: SagaAction
  ): Promise<unknown> {
    const condition = action.parameters?.condition as string;
    // Evaluate condition (simplified)
    const result = this.evaluateCondition(instance, condition);

    if (result && action.parameters?.then) {
      await this.invokeAction(instance, action.parameters.then as SagaAction);
    } else if (!result && action.parameters?.else) {
      await this.invokeAction(instance, action.parameters.else as SagaAction);
    }

    return { branched: result };
  }

  private async parallelAction(
    instance: SagaInstance,
    action: SagaAction
  ): Promise<unknown> {
    const actions = action.parameters?.actions as SagaAction[];

    if (!actions || actions.length === 0) {
      return {};
    }

    const results = await Promise.all(
      actions.map((a) => this.invokeAction(instance, a))
    );

    return { results };
  }

  private evaluateCondition(instance: SagaInstance, condition: string): boolean {
    // Simplified condition evaluation
    // In production, use a proper expression evaluator
    try {
      const data = instance.context.accumulatedData;
      // Very basic evaluation - extend as needed
      if (condition.includes('==')) {
        const [key, value] = condition.split('==').map((s) => s.trim());
        return (data as Record<string, unknown>)[key] === value;
      }
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Compensation
  // ============================================================================

  private async compensateSaga(sagaId: string): Promise<void> {
    const instance = this.state.instances[sagaId];
    if (!instance) {
      throw new Error(`Saga instance not found: ${sagaId}`);
    }

    instance.state = 'compensating';

    // Execute compensations in reverse order
    const compensations = instance.context.compensations.reverse();

    for (const comp of compensations) {
      if (comp.executed) {
        continue;
      }

      try {
        await this.invokeAction(instance, comp.action);
        comp.executed = true;
        comp.executedAt = Date.now();
      } catch (error) {
        console.error(`Compensation ${comp.stepId} failed:`, error);
        // Continue with other compensations
      }
    }

    instance.state = 'failed';
    instance.lastUpdated = Date.now();
    await this.save();
  }

  async manualCompensate(sagaId: string, stepId?: string): Promise<void> {
    const instance = this.state.instances[sagaId];
    if (!instance) {
      throw new Error(`Saga instance not found: ${sagaId}`);
    }

    if (stepId) {
      // Compensate specific step
      const comp = instance.context.compensations.find((c) => c.stepId === stepId);
      if (comp) {
        await this.invokeAction(instance, comp.action);
        comp.executed = true;
        comp.executedAt = Date.now();
      }
    } else {
      // Compensate all
      await this.compensateSaga(sagaId);
    }

    await this.save();
  }

  // ============================================================================
  // Saga Control
  // ============================================================================

  async suspendSaga(sagaId: string): Promise<void> {
    const instance = this.state.instances[sagaId];
    if (!instance) {
      throw new Error(`Saga instance not found: ${sagaId}`);
    }

    if (instance.state !== 'running') {
      throw new Error(`Cannot suspend saga with state: ${instance.state}`);
    }

    instance.state = 'suspended';
    instance.lastUpdated = Date.now();
    await this.save();
  }

  async resumeSaga(sagaId: string): Promise<void> {
    const instance = this.state.instances[sagaId];
    if (!instance) {
      throw new Error(`Saga instance not found: ${sagaId}`);
    }

    if (instance.state !== 'suspended') {
      throw new Error(`Cannot resume saga with state: ${instance.state}`);
    }

    instance.state = 'running';
    instance.lastUpdated = Date.now();
    await this.save();

    // Continue execution
    this.executeSaga(sagaId).catch((error) => {
      console.error(`Saga ${sagaId} failed on resume:`, error);
    });
  }

  async cancelSaga(sagaId: string): Promise<void> {
    const instance = this.state.instances[sagaId];
    if (!instance) {
      throw new Error(`Saga instance not found: ${sagaId}`);
    }

    instance.state = 'failed';
    instance.failedAt = 'Cancelled by user';
    instance.lastUpdated = Date.now();
    await this.save();

    // Trigger compensation
    const definition = this.state.definitions[instance.sagaType];
    if (definition && definition.compensationStrategy !== 'none') {
      await this.compensateSaga(sagaId);
    }
  }

  async deleteSaga(sagaId: string): Promise<void> {
    delete this.state.instances[sagaId];
    await this.save();
  }

  // ============================================================================
  // Saga Status
  // ============================================================================

  async getSaga(sagaId: string): Promise<SagaInstance | null> {
    return this.state.instances[sagaId] ?? null;
  }

  async listSagas(sagaType?: string): Promise<SagaInstance[]> {
    const instances = Object.values(this.state.instances);

    if (sagaType) {
      return instances.filter((i) => i.sagaType === sagaType);
    }

    return instances;
  }

  async getActiveSagas(): Promise<SagaInstance[]> {
    return Object.values(this.state.instances).filter(
      (i) => ['started', 'running', 'suspended'].includes(i.state)
    );
  }

  // ============================================================================
  // Timeout Handling
  // ============================================================================

  async setTimeout(sagaId: string, stepId: string, timeoutMs: number): Promise<void> {
    const timeout: SagaTimeout = {
      sagaId,
      stepId,
      timeoutAt: Date.now() + timeoutMs,
      action: 'abort',
    };

    this.state.pendingTimeouts.push(timeout);
    await this.save();
  }

  private async processTimeouts(): Promise<void> {
    const now = Date.now();

    for (const timeout of this.state.pendingTimeouts) {
      if (now >= timeout.timeoutAt) {
        await this.handleTimeout(timeout);
      }
    }

    // Remove processed timeouts
    this.state.pendingTimeouts = this.state.pendingTimeouts.filter(
      (t) => t.timeoutAt > now
    );

    await this.save();
  }

  private async handleTimeout(timeout: SagaTimeout): Promise<void> {
    const instance = this.state.instances[timeout.sagaId];
    if (!instance) {
      return;
    }

    switch (timeout.action) {
      case 'abort':
        instance.state = 'timed-out';
        instance.failedAt = `Timeout at step ${timeout.stepId}`;
        break;

      case 'compensate':
        await this.compensateSaga(timeout.sagaId);
        break;

      case 'retry':
        // Retry the step
        if (instance.state === 'running') {
          await this.executeSaga(timeout.sagaId);
        }
        break;
    }
  }

  // ============================================================================
  // Maintenance
  // ============================================================================

  async alarm(): Promise<void> {
    await this.processTimeouts();

    // Clean up old completed instances
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (const [sagaId, instance] of Object.entries(this.state.instances)) {
      if (
        (instance.state === 'completed' || instance.state === 'failed') &&
        instance.completedAt &&
        now - instance.completedAt > 7 * dayMs
      ) {
        delete this.state.instances[sagaId];
      }
    }

    await this.save();
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getEventBusStub(): EventBusDurableObjectStub {
    const id = this.env.EVENT_BUS.idFromName('default');
    return this.env.EVENT_BUS.get(id);
  }
}

// ============================================================================
// Saga Orchestrator Client
// ============================================================================

export class SagaOrchestratorClient {
  constructor(
    private namespace: DurableObjectNamespace,
    private id: DurableObjectId
  ) {}

  private getStub(): SagaOrchestratorDurableObjectStub {
    return this.namespace.get(this.id);
  }

  async registerDefinition(definition: SagaDefinition): Promise<void> {
    return this.getStub().registerDefinition(definition);
  }

  async startSaga(
    sagaType: string,
    context: Partial<SagaContext>
  ): Promise<string> {
    return this.getStub().startSaga(sagaType, context);
  }

  async suspendSaga(sagaId: string): Promise<void> {
    return this.getStub().suspendSaga(sagaId);
  }

  async resumeSaga(sagaId: string): Promise<void> {
    return this.getStub().resumeSaga(sagaId);
  }

  async cancelSaga(sagaId: string): Promise<void> {
    return this.getStub().cancelSaga(sagaId);
  }

  async getSaga(sagaId: string): Promise<SagaInstance | null> {
    return this.getStub().getSaga(sagaId);
  }

  async listSagas(sagaType?: string): Promise<SagaInstance[]> {
    return this.getStub().listSagas(sagaType);
  }

  async manualCompensate(sagaId: string, stepId?: string): Promise<void> {
    return this.getStub().manualCompensate(sagaId, stepId);
  }
}

// ============================================================================
// Saga Orchestrator Factory
// ============================================================================

export class SagaOrchestratorFactory {
  constructor(private namespace: DurableObjectNamespace) {}

  create(id: string = 'default'): SagaOrchestratorClient {
    const durableObjectId = this.namespace.idFromString(id);
    return new SagaOrchestratorClient(this.namespace, durableObjectId);
  }

  createFromName(name: string): SagaOrchestratorClient {
    const durableObjectId = this.namespace.idFromName(name);
    return new SagaOrchestratorClient(this.namespace, durableObjectId);
  }
}
