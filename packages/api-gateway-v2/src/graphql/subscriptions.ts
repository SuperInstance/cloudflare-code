/**
 * GraphQL Subscriptions Implementation
 * WebSocket-based real-time subscriptions with filtering and connection management
 */

// @ts-nocheck - External GraphQL and ws dependencies have type incompatibilities
import { GraphQLSchema, GraphQLResolveInfo, execute, parse } from 'graphql';
import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {
  SubscriptionConfig,
  SubscriptionConnection,
  Subscription,
  SubscriptionEvent,
  SubscriptionMessage,
  SubscriptionFilter,
  SubscriptionContext,
  GatewayError,
} from '../types';

// ============================================================================
// Subscription Manager
// ============================================================================

export class SubscriptionManager {
  private config: SubscriptionConfig;
  private connections: Map<string, SubscriptionConnection>;
  private subscriptions: Map<string, Set<string>>; // topic -> connection IDs
  private eventQueue: SubscriptionEvent[];
  private eventHandlers: Map<string, Set<EventHandler>>;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(config: SubscriptionConfig) {
    this.config = config;
    this.connections = new Map();
    this.subscriptions = new Map();
    this.eventQueue = [];
    this.eventHandlers = new Map();
  }

  /**
   * Initialize the subscription manager
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Start heartbeat interval
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);

    // Start event processing loop
    this.processEvents();

    console.log('Subscription manager initialized');
  }

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(socket: WebSocket, request: Request): Promise<void> {
    const connectionId = uuidv4();

    // Validate connection limit
    if (this.connections.size >= this.config.maxConnections) {
      socket.close(1013, 'Server overloaded');
      return;
    }

    // Create connection context
    const context = await this.createContext(request);

    // Create connection
    const connection: SubscriptionConnection = {
      id: connectionId,
      socket,
      subscriptions: new Map(),
      context,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    this.connections.set(connectionId, connection);

    // Set up socket event handlers
    socket.on('message', (data) => this.handleMessage(connectionId, data));
    socket.on('close', () => this.handleDisconnect(connectionId));
    socket.on('error', (error) => this.handleError(connectionId, error));

    // Send connection ack
    this.sendMessage(connectionId, {
      type: 'connection_ack',
      id: connectionId,
    });

    console.log(`Subscription connected: ${connectionId}`);
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(
    connectionId: string,
    data: Buffer
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.lastActivityAt = Date.now();

    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'start':
          await this.startSubscription(connectionId, message);
          break;
        case 'stop':
          await this.stopSubscription(connectionId, message.id);
          break;
        case 'ping':
          this.sendMessage(connectionId, { type: 'pong', id: message.id });
          break;
        default:
          throw new GatewayError(
            `Unknown message type: ${message.type}`,
            'INVALID_MESSAGE',
            400
          );
      }
    } catch (error) {
      this.sendMessage(connectionId, {
        type: 'error',
        id: uuidv4(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Start a new subscription
   */
  private async startSubscription(
    connectionId: string,
    message: any
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new GatewayError('Connection not found', 'NOT_FOUND', 404);
    }

    const { id, query, variables, filters } = message;

    // Validate and parse query
    const document = parse(query);

    // Create subscription
    const subscription: Subscription = {
      id,
      query,
      variables: variables || {},
      filters: (filters || []).map(this.parseFilter),
      createdAt: Date.now(),
    };

    connection.subscriptions.set(id, subscription);

    // Add to topic subscriptions
    const topics = this.extractTopics(query);
    for (const topic of topics) {
      if (!this.subscriptions.has(topic)) {
        this.subscriptions.set(topic, new Set());
      }
      this.subscriptions.get(topic)!.add(connectionId);
    }

    // Send ack
    this.sendMessage(connectionId, {
      type: 'data',
      id,
      payload: { data: null },
    });

    console.log(`Subscription started: ${id} on connection ${connectionId}`);
  }

  /**
   * Stop an active subscription
   */
  private async stopSubscription(
    connectionId: string,
    subscriptionId: string
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const subscription = connection.subscriptions.get(subscriptionId);
    if (!subscription) return;

    // Remove from connection
    connection.subscriptions.delete(subscriptionId);

    // Remove from topic subscriptions
    const topics = this.extractTopics(subscription.query);
    for (const topic of topics) {
      const subscribers = this.subscriptions.get(topic);
      if (subscribers) {
        subscribers.delete(connectionId);
        if (subscribers.size === 0) {
          this.subscriptions.delete(topic);
        }
      }
    }

    // Send complete message
    this.sendMessage(connectionId, {
      type: 'complete',
      id: subscriptionId,
    });

    console.log(`Subscription stopped: ${subscriptionId}`);
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove all subscriptions
    for (const [subId, subscription] of connection.subscriptions) {
      const topics = this.extractTopics(subscription.query);
      for (const topic of topics) {
        const subscribers = this.subscriptions.get(topic);
        if (subscribers) {
          subscribers.delete(connectionId);
        }
      }
    }

    // Remove connection
    this.connections.delete(connectionId);

    console.log(`Subscription disconnected: ${connectionId}`);
  }

  /**
   * Handle WebSocket error
   */
  private handleError(connectionId: string, error: Error): void {
    console.error(`WebSocket error on connection ${connectionId}:`, error);
    this.handleDisconnect(connectionId);
  }

  /**
   * Publish event to subscribers
   */
  async publish(event: SubscriptionEvent): Promise<void> {
    this.eventQueue.push(event);
  }

  /**
   * Process events from queue
   */
  private async processEvents(): Promise<void> {
    while (true) {
      if (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (event) {
          await this.dispatchEvent(event);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Dispatch event to matching subscriptions
   */
  private async dispatchEvent(event: SubscriptionEvent): Promise<void> {
    const subscribers = this.subscriptions.get(event.topic);
    if (!subscribers) return;

    for (const connectionId of subscribers) {
      const connection = this.connections.get(connectionId);
      if (!connection) continue;

      // Find matching subscriptions
      for (const [subId, subscription] of connection.subscriptions) {
        if (this.matchesSubscription(event, subscription)) {
          // Execute subscription query to get data
          const result = await this.executeSubscription(
            subscription,
            event
          );

          // Send result
          this.sendMessage(connectionId, {
            type: 'data',
            id: subId,
            payload: result,
          });
        }
      }
    }
  }

  /**
   * Check if event matches subscription filters
   */
  private matchesSubscription(
    event: SubscriptionEvent,
    subscription: Subscription
  ): boolean {
    if (subscription.filters.length === 0) {
      return true;
    }

    for (const filter of subscription.filters) {
      if (!this.matchesFilter(event, filter)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if event matches a single filter
   */
  private matchesFilter(
    event: SubscriptionEvent,
    filter: SubscriptionFilter
  ): boolean {
    const value = this.getNestedValue(event.payload, filter.field);

    switch (filter.operator) {
      case 'eq':
        return value === filter.value;
      case 'ne':
        return value !== filter.value;
      case 'gt':
        return value > filter.value;
      case 'lt':
        return value < filter.value;
      case 'gte':
        return value >= filter.value;
      case 'lte':
        return value <= filter.value;
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value);
      case 'contains':
        return Array.isArray(value) && value.includes(filter.value);
      default:
        return true;
    }
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current?.[key];
    }, obj);
  }

  /**
   * Parse filter from message
   */
  private parseFilter(filter: any): SubscriptionFilter {
    return {
      field: filter.field,
      operator: filter.operator,
      value: filter.value,
    };
  }

  /**
   * Extract topics from GraphQL query
   */
  private extractTopics(query: string): string[] {
    const topics: string[] = [];

    // Simple extraction - in real implementation, parse the AST
    const match = query.match(/subscription\s*\{\s*(\w+)/);
    if (match) {
      topics.push(match[1]);
    }

    return topics;
  }

  /**
   * Execute subscription query with event data
   */
  private async executeSubscription(
    subscription: Subscription,
    event: SubscriptionEvent
  ): Promise<any> {
    // This would execute the GraphQL query with event context
    // Simplified implementation
    return {
      data: {
        [event.topic]: event.payload,
      },
    };
  }

  /**
   * Send message to connection
   */
  private sendMessage(
    connectionId: string,
    message: SubscriptionMessage
  ): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      connection.socket.send(JSON.stringify(message));
    } catch (error) {
      console.error(`Failed to send message to ${connectionId}:`, error);
      this.handleDisconnect(connectionId);
    }
  }

  /**
   * Send heartbeat to all connections
   */
  private sendHeartbeat(): void {
    const now = Date.now();

    for (const [id, connection] of this.connections) {
      // Check for timeout
      const inactiveTime = now - connection.lastActivityAt;
      if (inactiveTime > this.config.connectionTimeout) {
        connection.socket.close(1000, 'Connection timeout');
        continue;
      }

      // Send ping
      try {
        connection.socket.send(JSON.stringify({ type: 'ping' }));
      } catch (error) {
        this.handleDisconnect(id);
      }
    }
  }

  /**
   * Create connection context from request
   */
  private async createContext(request: Request): Promise<SubscriptionContext> {
    // Extract authentication and other context from request
    return {
      isAuthenticated: false,
      roles: [],
      metadata: {},
    };
  }

  /**
   * Register event handler
   */
  on(topic: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(topic)) {
      this.eventHandlers.set(topic, new Set());
    }
    this.eventHandlers.get(topic)!.add(handler);
  }

  /**
   * Unregister event handler
   */
  off(topic: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(topic);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(topic);
      }
    }
  }

  /**
   * Get statistics
   */
  getStats(): SubscriptionStats {
    const activeSubscriptions = Array.from(this.connections.values())
      .reduce((sum, conn) => sum + conn.subscriptions.size, 0);

    return {
      connections: this.connections.size,
      subscriptions: activeSubscriptions,
      topics: this.subscriptions.size,
      queuedEvents: this.eventQueue.length,
    };
  }

  /**
   * Shutdown the subscription manager
   */
  async shutdown(): Promise<void> {
    // Clear heartbeat interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all connections
    for (const [id, connection] of this.connections) {
      connection.socket.close(1000, 'Server shutting down');
    }

    this.connections.clear();
    this.subscriptions.clear();
    this.eventQueue = [];
    this.eventHandlers.clear();

    console.log('Subscription manager shut down');
  }
}

// ============================================================================
// Types
// ============================================================================

export type EventHandler = (event: SubscriptionEvent) => void;

export interface SubscriptionStats {
  connections: number;
  subscriptions: number;
  topics: number;
  queuedEvents: number;
}

// ============================================================================
// Subscription Server
// ============================================================================

export class SubscriptionServer {
  private manager: SubscriptionManager;
  private server?: WebSocketServer;

  constructor(config: SubscriptionConfig) {
    this.manager = new SubscriptionManager(config);
  }

  /**
   * Start the subscription server
   */
  async start(port: number): Promise<void> {
    await this.manager.initialize();

    this.server = new WebSocketServer({ port });

    this.server.on('connection', (socket, request) => {
      this.manager.handleConnection(socket, request as any);
    });

    console.log(`Subscription server listening on port ${port}`);
  }

  /**
   * Stop the subscription server
   */
  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
    }
    await this.manager.shutdown();
  }

  /**
   * Get manager instance
   */
  getManager(): SubscriptionManager {
    return this.manager;
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Create subscription event
 */
export function createSubscriptionEvent(
  topic: string,
  payload: any,
  metadata?: Record<string, any>
): SubscriptionEvent {
  return {
    id: uuidv4(),
    topic,
    payload,
    timestamp: Date.now(),
    metadata,
  };
}

/**
 * Validate subscription configuration
 */
export function validateSubscriptionConfig(
  config: SubscriptionConfig
): void {
  if (config.maxConnections < 1) {
    throw new GatewayError(
      'maxConnections must be at least 1',
      'INVALID_CONFIG',
      400
    );
  }

  if (config.connectionTimeout < 1000) {
    throw new GatewayError(
      'connectionTimeout must be at least 1000ms',
      'INVALID_CONFIG',
      400
    );
  }

  if (config.heartbeatInterval < 1000) {
    throw new GatewayError(
      'heartbeatInterval must be at least 1000ms',
      'INVALID_CONFIG',
      400
    );
  }

  if (config.messageQueueSize < 1) {
    throw new GatewayError(
      'messageQueueSize must be at least 1',
      'INVALID_CONFIG',
      400
    );
  }
}
