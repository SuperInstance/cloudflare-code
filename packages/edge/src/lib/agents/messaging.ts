/**
 * Message Routing and Dispatch System
 *
 * Handles intelligent message routing and delivery:
 * - Message routing based on agent capabilities
 * - Priority-based dispatch
 * - Load-aware routing
 * - Message queuing
 * - Delivery tracking
 */

import type {
  AgentMessage,
  AgentInfo,
  MessageStatus,
  MessagePriority,
  RoutingEntry,
  DiscoveryCriteria,
} from './types';
import { discoverAgents } from './registry';

export interface MessagingEnv {
  AGENT_REGISTRY: DurableObjectNamespace;
  DIRECTOR_DO: DurableObjectNamespace;
  PLANNER_DO: DurableObjectNamespace;
  EXECUTOR_DO: DurableObjectNamespace;
  AGENT_PUBSUB: DurableObjectNamespace;
  AGENTS_KV?: KVNamespace;
}

/**
 * Routing table entry with priority
 */
interface PriorityRoutingEntry extends RoutingEntry {
  priority: number;
}

/**
 * Message queue entry
 */
interface QueuedMessage {
  message: AgentMessage;
  priority: number;
  queuedAt: number;
  retryCount: number;
  maxRetries: number;
}

/**
 * Messaging state
 */
interface MessagingState {
  routingTable: Map<string, PriorityRoutingEntry>;
  messageQueue: QueuedMessage[];
  deliveryStatus: Map<string, MessageStatus>;
  stats: {
    messagesRouted: number;
    messagesDelivered: number;
    messagesFailed: number;
    averageDeliveryTime: number;
  };
}

/**
 * Message Router - Intelligent message routing and dispatch
 *
 * Features:
 * - Capability-based routing
 * - Priority queue
 * - Load balancing
 * - Automatic retry
 * - <100ms delivery
 */
export class MessageRouter {
  private env: MessagingEnv;
  private storage: DurableObjectStorage;
  private state: MessagingState;
  private maxQueueSize = 10000;
  private maxRetries = 3;
  private baseRetryDelay = 1000; // 1 second

  constructor(env: MessagingEnv, storage: DurableObjectStorage) {
    this.env = env;
    this.storage = storage;

    this.state = {
      routingTable: new Map(),
      messageQueue: [],
      deliveryStatus: new Map(),
      stats: {
        messagesRouted: 0,
        messagesDelivered: 0,
        messagesFailed: 0,
        averageDeliveryTime: 0,
      },
    };
  }

  /**
   * Initialize from storage
   */
  async initialize(): Promise<void> {
    try {
      const stored = await this.storage.get<{
        routingTable: Array<[string, PriorityRoutingEntry]>;
        messageQueue: QueuedMessage[];
        deliveryStatus: Array<[string, MessageStatus]>;
        stats: MessagingState['stats'];
      }>('messagingState');

      if (stored) {
        this.state.routingTable = new Map(stored.routingTable);
        this.state.messageQueue = stored.messageQueue;
        this.state.deliveryStatus = new Map(stored.deliveryStatus);
        this.state.stats = stored.stats;

        // Rebuild routing table from registry
        await this.rebuildRoutingTable();

        // Process queued messages
        await this.processQueue();
      }
    } catch (error) {
      console.error('Failed to initialize message router:', error);
    }
  }

  /**
   * Rebuild routing table from agent registry
   */
  private async rebuildRoutingTable(): Promise<void> {
    try {
      const registryStub = this.env.AGENT_REGISTRY.get(
        this.env.AGENT_REGISTRY.idFromName('global-registry')
      );

      const response = await registryStub.fetch(
        new Request('https://registry/stats', {
          method: 'GET',
        })
      );

      if (response.ok) {
        const stats = await response.json();

        // Get agents by type
        const types = ['director', 'planner', 'executor', 'reviewer', 'analyst', 'debugger', 'documenter', 'optimizer'] as const;

        for (const type of types) {
          const agentsResponse = await registryStub.fetch(
            new Request(`https://registry/agents?type=${type}`, {
              method: 'GET',
            })
          );

          if (agentsResponse.ok) {
            const data = await agentsResponse.json();
            const agents = data.agents || [];

            for (const agent: AgentInfo of agents) {
              this.updateRoutingEntry(agent);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to rebuild routing table:', error);
    }
  }

  /**
   * Update routing entry for agent
   */
  private updateRoutingEntry(agent: AgentInfo): void {
    const entry: PriorityRoutingEntry = {
      agentId: agent.id,
      topics: [agent.type],
      capabilities: agent.capabilities?.flatMap((cap) => cap.features || []) || [],
      load: agent.load,
      lastHeartbeat: agent.lastHeartbeat,
      priority: this.calculatePriority(agent),
    };

    this.state.routingTable.set(agent.id, entry);
  }

  /**
   * Calculate priority for routing
   */
  private calculatePriority(agent: AgentInfo): number {
    // Higher priority for:
    // - Lower load
    // - More recent heartbeat
    // - More capabilities

    const loadPriority = 1 - agent.load; // 0-1
    const heartbeatPriority = Math.min(1, (Date.now() - agent.lastHeartbeat) / 60000); // 0-1 based on minute
    const capabilityPriority = Math.min(1, (agent.capabilities?.length || 0) / 10); // 0-1 based on capabilities

    return (loadPriority * 0.5 + heartbeatPriority * 0.3 + capabilityPriority * 0.2);
  }

  /**
   * Route message to appropriate agent(s)
   */
  async route(message: AgentMessage): Promise<string[]> {
    this.state.stats.messagesRouted++;

    const deliveryIds: string[] = [];

    // Handle broadcast
    if (message.to === 'broadcast') {
      return this.broadcast(message);
    }

    // Handle multiple recipients
    if (Array.isArray(message.to)) {
      for (const recipient of message.to) {
        const id = await this.deliverToAgent(recipient, message);
        deliveryIds.push(id);
      }
      return deliveryIds;
    }

    // Single recipient
    const id = await this.deliverToAgent(message.to, message);
    deliveryIds.push(id);

    return deliveryIds;
  }

  /**
   * Broadcast message to all relevant agents
   */
  private async broadcast(message: AgentMessage): Promise<string[]> {
    const deliveryIds: string[] = [];

    // Find agents that should receive this message
    const criteria: DiscoveryCriteria = {
      capabilities: [message.action],
      maxLoad: 0.9,
    };

    const agents = await discoverAgents(this.env, criteria);

    for (const agent of agents) {
      const id = await this.deliverToAgent(agent.id, message);
      deliveryIds.push(id);
    }

    return deliveryIds;
  }

  /**
   * Deliver message to specific agent
   */
  private async deliverToAgent(agentId: string, message: AgentMessage): Promise<string> {
    const deliveryId = `${message.id}-${agentId}`;

    // Check if agent exists
    const routingEntry = this.state.routingTable.get(agentId);
    if (!routingEntry) {
      throw new Error(`Agent not found in routing table: ${agentId}`);
    }

    // Create delivery status
    const status: MessageStatus = {
      messageId: deliveryId,
      status: 'pending',
      attempts: 0,
      lastAttempt: Date.now(),
    };

    this.state.deliveryStatus.set(deliveryId, status);

    // Queue message
    this.queueMessage(agentId, message, this.getPriorityValue(message.priority));

    // Process queue
    await this.processQueue();

    return deliveryId;
  }

  /**
   * Get numeric priority value
   */
  private getPriorityValue(priority: MessagePriority): number {
    switch (priority) {
      case 'urgent':
        return 100;
      case 'high':
        return 75;
      case 'normal':
        return 50;
      case 'low':
        return 25;
      default:
        return 50;
    }
  }

  /**
   * Queue message for delivery
   */
  private queueMessage(agentId: string, message: AgentMessage, priority: number): void {
    const queuedMessage: QueuedMessage = {
      message: {
        ...message,
        to: agentId,
      },
      priority,
      queuedAt: Date.now(),
      retryCount: 0,
      maxRetries: this.maxRetries,
    };

    this.state.messageQueue.push(queuedMessage);

    // Sort by priority (descending)
    this.state.messageQueue.sort((a, b) => b.priority - a.priority);

    // Trim queue if necessary
    if (this.state.messageQueue.length > this.maxQueueSize) {
      this.state.messageQueue = this.state.messageQueue.slice(0, this.maxQueueSize);
    }
  }

  /**
   * Process message queue
   */
  async processQueue(): Promise<void> {
    const startTime = Date.now();

    while (this.state.messageQueue.length > 0) {
      const queued = this.state.messageQueue[0];

      try {
        await this.deliverMessage(queued);
        this.state.messageQueue.shift();
      } catch (error) {
        // Handle delivery failure
        if (queued.retryCount >= queued.maxRetries) {
          // Max retries reached, remove from queue
          this.state.messageQueue.shift();
          this.state.stats.messagesFailed++;

          const deliveryId = `${queued.message.id}-${queued.message.to}`;
          const status = this.state.deliveryStatus.get(deliveryId);
          if (status) {
            status.status = 'failed';
            status.error = error instanceof Error ? error.message : 'Unknown error';
          }
        } else {
          // Increment retry count and schedule retry
          queued.retryCount++;
          const backoffMs = this.baseRetryDelay * Math.pow(2, queued.retryCount);

          // Re-queue with delay
          this.state.messageQueue.shift();
          setTimeout(() => {
            this.state.messageQueue.push(queued);
            this.state.messageQueue.sort((a, b) => b.priority - a.priority);
          }, backoffMs);

          break; // Stop processing, wait for retry
        }
      }
    }

    const deliveryTime = Date.now() - startTime;
    this.updateAverageDeliveryTime(deliveryTime);

    await this.persistState();
  }

  /**
   * Deliver message to agent
   */
  private async deliverMessage(queued: QueuedMessage): Promise<void> {
    const message = queued.message;
    const agentId = message.to as string;
    const deliveryId = `${message.id}-${agentId}`;

    // Determine DO namespace
    let doNamespace: DurableObjectNamespace;

    if (agentId.startsWith('director-')) {
      doNamespace = this.env.DIRECTOR_DO;
    } else if (agentId.startsWith('planner-')) {
      doNamespace = this.env.PLANNER_DO;
    } else if (agentId.startsWith('executor-')) {
      doNamespace = this.env.EXECUTOR_DO;
    } else {
      throw new Error(`Unknown agent type: ${agentId}`);
    }

    const agentStub = doNamespace.get(doNamespace.idFromName(agentId));

    const response = await agentStub.fetch(
      new Request('https://agent/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      })
    );

    if (!response.ok) {
      throw new Error(`Agent error: ${response.status}`);
    }

    // Update delivery status
    const status = this.state.deliveryStatus.get(deliveryId);
    if (status) {
      status.status = 'delivered';
      status.deliveredAt = Date.now();
      this.state.stats.messagesDelivered++;
    }
  }

  /**
   * Update average delivery time
   */
  private updateAverageDeliveryTime(deliveryTime: number): void {
    const currentAvg = this.state.stats.averageDeliveryTime;
    const count = this.state.stats.messagesDelivered;

    this.state.stats.averageDeliveryTime = (currentAvg * count + deliveryTime) / (count + 1);
  }

  /**
   * Get delivery status
   */
  getDeliveryStatus(deliveryId: string): MessageStatus | null {
    return this.state.deliveryStatus.get(deliveryId) || null;
  }

  /**
   * Get routing table
   */
  getRoutingTable(): Map<string, PriorityRoutingEntry> {
    return this.state.routingTable;
  }

  /**
   * Find best route for message
   */
  async findBestRoute(message: AgentMessage): Promise<string | null> {
    const criteria: DiscoveryCriteria = {
      capabilities: [message.action],
      maxLoad: 0.8,
    };

    const agents = await discoverAgents(this.env, criteria);

    if (agents.length === 0) {
      return null;
    }

    // Return agent with highest priority
    return agents[0].id;
  }

  /**
   * Get router statistics
   */
  getStats(): MessagingState['stats'] {
    return { ...this.state.stats };
  }

  /**
   * Persist state to storage
   */
  private async persistState(): Promise<void> {
    try {
      await this.storage.put('messagingState', {
        routingTable: Array.from(this.state.routingTable.entries()),
        messageQueue: this.state.messageQueue,
        deliveryStatus: Array.from(this.state.deliveryStatus.entries()),
        stats: this.state.stats,
      });
    } catch (error) {
      console.error('Failed to persist messaging state:', error);
    }
  }

  /**
   * Cleanup old delivery status
   */
  async cleanup(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now();

    for (const [id, status] of this.state.deliveryStatus.entries()) {
      if (
        status.status !== 'pending' &&
        status.lastAttempt < now - maxAge
      ) {
        this.state.deliveryStatus.delete(id);
      }
    }

    await this.persistState();
  }
}

/**
 * Message Router Durable Object
 */
export class MessageRouterDO implements DurableObject {
  private state: DurableObjectState;
  private env: MessagingEnv;
  private router: MessageRouter;

  constructor(state: DurableObjectState, env: MessagingEnv) {
    this.state = state;
    this.env = env;
    this.router = new MessageRouter(env, state.storage);
    this.router.initialize();
  }

  /**
   * Fetch handler
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (method === 'POST' && path === '/route') {
        return this.handleRoute(request);
      }

      if (method === 'GET' && path === '/status') {
        return this.handleGetStatus(request);
      }

      if (method === 'GET' && path === '/routing') {
        return this.handleGetRouting();
      }

      if (method === 'GET' && path === '/best-route') {
        return this.handleFindBestRoute(request);
      }

      if (method === 'GET' && path === '/stats') {
        return this.handleGetStats();
      }

      if (method === 'POST' && path === '/cleanup') {
        return this.handleCleanup();
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Handle route request
   */
  private async handleRoute(request: Request): Promise<Response> {
    const body = await request.json() as { message: AgentMessage };

    const deliveryIds = await this.router.route(body.message);

    return new Response(
      JSON.stringify({ success: true, deliveryIds }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get status request
   */
  private async handleGetStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const deliveryId = url.searchParams.get('deliveryId') || '';

    const status = this.router.getDeliveryStatus(deliveryId);

    if (!status) {
      return new Response(
        JSON.stringify({ error: 'Delivery not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(status),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get routing table
   */
  private async handleGetRouting(): Promise<Response> {
    const routing = Array.from(this.router.getRoutingTable().values());

    return new Response(
      JSON.stringify({ routing, count: routing.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle find best route
   */
  private async handleFindBestRoute(request: Request): Promise<Response> {
    const body = await request.json() as { message: AgentMessage };

    const bestRoute = await this.router.findBestRoute(body.message);

    if (!bestRoute) {
      return new Response(
        JSON.stringify({ error: 'No suitable route found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ agentId: bestRoute }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get stats
   */
  private async handleGetStats(): Promise<Response> {
    const stats = this.router.getStats();

    return new Response(
      JSON.stringify(stats),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle cleanup
   */
  private async handleCleanup(): Promise<Response> {
    await this.router.cleanup();

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Alarm handler for periodic maintenance
   */
  async alarm(): Promise<void> {
    // Rebuild routing table
    await this.router['rebuildRoutingTable']();

    // Process queue
    await this.router.processQueue();

    // Cleanup old status
    await this.router.cleanup();
  }
}

/**
 * Helper function to create router stub
 */
export function createRouterStub(env: MessagingEnv): DurableObjectStub {
  return env.AGENT_PUBSUB.get(env.AGENT_PUBSUB.idFromName('global-router'));
}

/**
 * Helper function to route message
 */
export async function routeMessage(env: MessagingEnv, message: AgentMessage): Promise<string[]> {
  const stub = createRouterStub(env);

  const response = await stub.fetch(
    new Request('https://router/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
  );

  if (!response.ok) {
    throw new Error('Routing failed');
  }

  const data = await response.json();
  return data.deliveryIds;
}
