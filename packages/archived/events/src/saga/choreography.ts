/**
 * Saga Choreography implementation
 */

// @ts-nocheck - Cloudflare Workers DurableObject types not fully available
import type {
  ChoreographyDefinition,
  ChoreographyParticipant,
  ChoreographyEvent,
  SagaCoordinationMessage,
} from '../types';
import { generateEventId } from '../utils/id';

// ============================================================================
// Choreography State
// ============================================================================

interface ChoreographyState {
  definitions: Record<string, ChoreographyDefinition>;
  activeInstances: Record<string, {
    choreographyId: string;
    correlationId: string;
    currentStep: string;
    participants: Record<string, {
      status: 'pending' | 'active' | 'completed' | 'failed';
      events: string[];
    }>;
    startedAt: number;
    lastUpdated: number;
  }>;
}

// ============================================================================
// Choreography Coordinator Durable Object
// ============================================================================

export interface ChoreographyEnv {
  EVENT_BUS: DurableObjectNamespace;
}

export class ChoreographyCoordinatorDurableObject implements DurableObject {
  private state: ChoreographyState;

  constructor(
    private durableObjectState: DurableObjectState,
    private env: ChoreographyEnv
  ) {
    this.state = {
      definitions: {},
      activeInstances: {},
    };
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const saved = await this.durableObjectState.storage.get<ChoreographyState>('state');

    if (saved) {
      this.state = saved;
    }
  }

  private async save(): Promise<void> {
    await this.durableObjectState.storage.put('state', this.state);
  }

  // ============================================================================
  // Choreography Definition Management
  // ============================================================================

  async registerDefinition(definition: ChoreographyDefinition): Promise<void> {
    this.state.definitions[definition.choreographyId] = definition;
    await this.save();
  }

  async getDefinition(choreographyId: string): Promise<ChoreographyDefinition | null> {
    return this.state.definitions[choreographyId] ?? null;
  }

  async listDefinitions(): Promise<ChoreographyDefinition[]> {
    return Object.values(this.state.definitions);
  }

  // ============================================================================
  // Choreography Instance Management
  // ============================================================================

  async startChoreography(
    choreographyId: string,
    correlationId: string,
    initialData: Record<string, unknown> = {}
  ): Promise<void> {
    const definition = this.state.definitions[choreographyId];
    if (!definition) {
      throw new Error(`Choreography not found: ${choreographyId}`);
    }

    const instanceId = `${choreographyId}_${correlationId}`;

    // Initialize participant states
    const participants: Record<string, {
      status: 'pending' | 'active' | 'completed' | 'failed';
      events: string[];
    }> = {};

    for (const participant of definition.participants) {
      participants[participant.participantId] = {
        status: 'pending',
        events: [],
      };
    }

    this.state.activeInstances[instanceId] = {
      choreographyId,
      correlationId,
      currentStep: '',
      participants,
      startedAt: Date.now(),
      lastUpdated: Date.now(),
    };

    await this.save();

    // Publish start event to first participant
    await this.publishStartEvent(definition, correlationId, initialData);
  }

  private async publishStartEvent(
    definition: ChoreographyDefinition,
    correlationId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const eventBusStub = this.getEventBusStub();

    // Find the first event in the choreography
    const firstEvent = definition.events[0];

    await eventBusStub.publish({
      metadata: {
        eventId: generateEventId(),
        eventType: firstEvent.eventType,
        timestamp: Date.now(),
        correlationId,
        version: 1,
        source: 'choreography',
      },
      payload: data,
    });

    // Update participant state
    const instanceId = `${definition.choreographyId}_${correlationId}`;
    const instance = this.state.activeInstances[instanceId];
    if (instance) {
      const publisher = definition.participants.find(
        (p) => p.service === firstEvent.publisher
      );
      if (publisher) {
        instance.participants[publisher.participantId].status = 'active';
        instance.participants[publisher.participantId].events.push(
          firstEvent.eventType
        );
      }
    }

    await this.save();
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  async handleCoordinationMessage(message: SagaCoordinationMessage): Promise<void> {
    const instanceId = `${message.sagaType}_${message.correlationId}`;
    const instance = this.state.activeInstances[instanceId];

    if (!instance) {
      console.warn(`Choreography instance not found: ${instanceId}`);
      return;
    }

    instance.lastUpdated = Date.now();

    switch (message.messageType) {
      case 'step-complete':
        await this.handleStepComplete(instance, message);
        break;

      case 'step-fail':
        await this.handleStepFail(instance, message);
        break;

      case 'complete':
        await this.handleChoreographyComplete(instance);
        break;

      case 'timeout':
        await this.handleChoreographyTimeout(instance, message);
        break;
    }

    await this.save();
  }

  private async handleStepComplete(
    instance: ChoreographyState['activeInstances'][string],
    message: SagaCoordinationMessage
  ): Promise<void> {
    if (!message.stepId) {
      return;
    }

    const definition = this.state.definitions[instance.choreographyId];
    if (!definition) {
      return;
    }

    // Update participant status
    const participant = definition.participants.find((p) =>
      p.endpoints.includes(message.stepId)
    );
    if (participant) {
      instance.participants[participant.participantId].status = 'completed';
    }

    // Find next events to publish
    const currentEvent = definition.events.find((e) => e.eventType === message.stepId);
    if (!currentEvent) {
      return;
    }

    // Publish to subscribers
    const eventBusStub = this.getEventBusStub();

    for (const subscriber of currentEvent.subscribers) {
      const subscriberParticipant = definition.participants.find((p) => p.service === subscriber);
      if (subscriberParticipant) {
        instance.participants[subscriberParticipant.participantId].status = 'active';

        // Find the event this subscriber should receive
        const nextEvent = definition.events.find((e) => e.publisher === subscriber);
        if (nextEvent) {
          await eventBusStub.publish({
            metadata: {
              eventId: generateEventId(),
              eventType: nextEvent.eventType,
              timestamp: Date.now(),
              correlationId: instance.correlationId,
              causationId: message.messageId,
              version: 1,
              source: 'choreography',
            },
            payload: message.payload,
          });

          instance.participants[subscriberParticipant.participantId].events.push(
            nextEvent.eventType
          );
        }
      }
    }
  }

  private async handleStepFail(
    instance: ChoreographyState['activeInstances'][string],
    message: SagaCoordinationMessage
  ): Promise<void> {
    // Mark the participant as failed
    const definition = this.state.definitions[instance.choreographyId];
    if (!definition) {
      return;
    }

    if (message.stepId) {
      const participant = definition.participants.find((p) =>
        p.endpoints.includes(message.stepId)
      );
      if (participant) {
        instance.participants[participant.participantId].status = 'failed';
      }
    }

    // If orchestration is enabled, trigger compensation
    if (definition.orchestration) {
      await this.triggerCompensation(instance, message);
    }
  }

  private async handleChoreographyComplete(
    instance: ChoreographyState['activeInstances'][string]
  ): Promise<void> {
    // All participants completed - cleanup
    delete this.state.activeInstances[
      `${instance.choreographyId}_${instance.correlationId}`
    ];
  }

  private async handleChoreographyTimeout(
    instance: ChoreographyState['activeInstances'][string],
    message: SagaCoordinationMessage
  ): Promise<void> {
    const definition = this.state.definitions[instance.choreographyId];
    if (!definition) {
      return;
    }

    // Mark all active participants as failed
    for (const [participantId, state] of Object.entries(instance.participants)) {
      if (state.status === 'active') {
        state.status = 'failed';
      }
    }

    // Trigger compensation if enabled
    if (definition.orchestration) {
      await this.triggerCompensation(instance, message);
    }
  }

  private async triggerCompensation(
    instance: ChoreographyState['activeInstances'][string],
    message: SagaCoordinationMessage
  ): Promise<void> {
    const eventBusStub = this.getEventBusStub();

    // Publish compensation events in reverse order
    const definition = this.state.definitions[instance.choreographyId];
    if (!definition) {
      return;
    }

    const completedParticipants = Object.entries(instance.participants)
      .filter(([_, state]) => state.status === 'completed')
      .reverse();

    for (const [participantId, state] of completedParticipants) {
      const participant = definition.participants.find((p) => p.participantId === participantId);
      if (participant) {
        // Publish compensation event
        await eventBusStub.publish({
          metadata: {
            eventId: generateEventId(),
            eventType: `${participant.service}.compensate`,
            timestamp: Date.now(),
            correlationId: instance.correlationId,
            causationId: message.messageId,
            version: 1,
            source: 'choreography-compensation',
          },
          payload: {
            originalEvents: state.events,
          },
        });

        state.status = 'pending';
      }
    }
  }

  // ============================================================================
  // Status Queries
  // ============================================================================

  async getInstance(
    choreographyId: string,
    correlationId: string
  ): Promise<ChoreographyState['activeInstances'][string] | null> {
    const instanceId = `${choreographyId}_${correlationId}`;
    return this.state.activeInstances[instanceId] ?? null;
  }

  async listInstances(choreographyId?: string): Promise<Array<{
    instanceId: string;
    correlationId: string;
    status: string;
    startedAt: number;
    lastUpdated: number;
  }>> {
    const instances: Array<{
      instanceId: string;
      correlationId: string;
      status: string;
      startedAt: number;
      lastUpdated: number;
    }> = [];

    for (const [instanceId, instance] of Object.entries(this.state.activeInstances)) {
      if (choreographyId && instance.choreographyId !== choreographyId) {
        continue;
      }

      const participantStatuses = Object.values(instance.participants).map((p) => p.status);
      let overallStatus = 'running';

      if (participantStatuses.every((s) => s === 'completed')) {
        overallStatus = 'completed';
      } else if (participantStatuses.some((s) => s === 'failed')) {
        overallStatus = 'failed';
      }

      instances.push({
        instanceId,
        correlationId: instance.correlationId,
        status: overallStatus,
        startedAt: instance.startedAt,
        lastUpdated: instance.lastUpdated,
      });
    }

    return instances;
  }

  // ============================================================================
  // Maintenance
  // ============================================================================

  async alarm(): Promise<void> {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Clean up old instances
    for (const [instanceId, instance] of Object.entries(this.state.activeInstances)) {
      if (now - instance.lastUpdated > 7 * dayMs) {
        delete this.state.activeInstances[instanceId];
      }
    }

    // Check for timeouts
    for (const [instanceId, instance] of Object.entries(this.state.activeInstances)) {
      const definition = this.state.definitions[instance.choreographyId];
      if (definition && definition.timeoutMs) {
        if (now - instance.startedAt > definition.timeoutMs) {
          await this.handleCoordinationMessage({
            messageId: generateEventId(),
            sagaId: instanceId,
            sagaType: instance.choreographyId,
            messageType: 'timeout',
            timestamp: now,
          });
        }
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
// Choreography Client
// ============================================================================

export class ChoreographyClient {
  constructor(
    private namespace: DurableObjectNamespace,
    private id: DurableObjectId
  ) {}

  private getStub(): ChoreographyCoordinatorDurableObjectStub {
    return this.namespace.get(this.id);
  }

  async registerDefinition(definition: ChoreographyDefinition): Promise<void> {
    return this.getStub().registerDefinition(definition);
  }

  async startChoreography(
    choreographyId: string,
    correlationId: string,
    initialData?: Record<string, unknown>
  ): Promise<void> {
    return this.getStub().startChoreography(choreographyId, correlationId, initialData);
  }

  async handleCoordinationMessage(message: SagaCoordinationMessage): Promise<void> {
    return this.getStub().handleCoordinationMessage(message);
  }

  async getInstance(
    choreographyId: string,
    correlationId: string
  ): Promise<ChoreographyState['activeInstances'][string] | null> {
    return this.getStub().getInstance(choreographyId, correlationId);
  }

  async listInstances(choreographyId?: string): Promise<Array<{
    instanceId: string;
    correlationId: string;
    status: string;
    startedAt: number;
    lastUpdated: number;
  }>> {
    return this.getStub().listInstances(choreographyId);
  }
}

// ============================================================================
// Choreography Factory
// ============================================================================

export class ChoreographyFactory {
  constructor(private namespace: DurableObjectNamespace) {}

  create(id: string = 'default'): ChoreographyClient {
    const durableObjectId = this.namespace.idFromString(id);
    return new ChoreographyClient(this.namespace, durableObjectId);
  }

  createFromName(name: string): ChoreographyClient {
    const durableObjectId = this.namespace.idFromName(name);
    return new ChoreographyClient(this.namespace, durableObjectId);
  }
}
