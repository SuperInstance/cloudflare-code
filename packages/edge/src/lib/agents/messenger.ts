/**
 * Agent Messenger - Inter-Agent Communication System
 *
 * Handles message passing between Durable Object instances:
 * - Point-to-point messaging
 * - Broadcast messaging
 * - Message queuing
 * - Delivery tracking
 * - Retry logic
 */

import type {
  AgentMessage,
  MessageStatus,
  AgentInfo,
} from './types';

export interface Env {
  DIRECTOR_DO: DurableObjectNamespace;
  PLANNER_DO: DurableObjectNamespace;
  EXECUTOR_DO: DurableObjectNamespace;
  AGENT_REGISTRY: DurableObjectNamespace;
  AGENTS_KV?: KVNamespace;
}

/**
 * Message Queue Entry
 */
interface MessageQueueEntry {
  message: AgentMessage;
  status: MessageStatus;
  attempts: number;
  lastAttempt: number;
  nextRetry: number;
}

/**
 * Agent Messenger State
 */
interface MessengerState {
  outbox: Map<string, MessageQueueEntry>;
  inbox: Map<string, AgentMessage>;
  sentMessages: Map<string, MessageStatus>;
  messageCount: number;
  lastCleanup: number;
}

/**
 * Agent Messenger - Handles inter-agent communication
 *
 * Features:
 * - <50ms message delivery
 * - Automatic retry with exponential backoff
 * - Message expiration (TTL)
 * - Delivery tracking
 * - Broadcast support
 */
export class AgentMessenger {
  private env: Env;
  private storage: DurableObjectStorage;
  private state: MessengerState;
  private maxRetries = 3;
  private baseRetryDelay = 1000; // 1 second

  constructor(env: Env, storage: DurableObjectStorage) {
    this.env = env;
    this.storage = storage;

    this.state = {
      outbox: new Map(),
      inbox: new Map(),
      sentMessages: new Map(),
      messageCount: 0,
      lastCleanup: Date.now(),
    };
  }

  /**
   * Initialize messenger from storage
   */
  async initialize(): Promise<void> {
    try {
      const stored = await this.storage.get<{
        outbox: Array<[string, MessageQueueEntry]>;
        inbox: Array<[string, AgentMessage]>;
        sentMessages: Array<[string, MessageStatus]>;
        messageCount: number;
        lastCleanup: number;
      }>('messengerState');

      if (stored) {
        this.state.outbox = new Map(stored.outbox);
        this.state.inbox = new Map(stored.inbox);
        this.state.sentMessages = new Map(stored.sentMessages);
        this.state.messageCount = stored.messageCount;
        this.state.lastCleanup = stored.lastCleanup;

        // Retry pending messages
        await this.retryPendingMessages();
      }
    } catch (error) {
      console.error('Failed to initialize messenger:', error);
    }
  }

  /**
   * Send message to a specific agent
   */
  async sendToAgent(
    from: string,
    to: string,
    message: Omit<AgentMessage, 'id' | 'from' | 'timestamp'>
  ): Promise<string> {
    const messageId = crypto.randomUUID();

    const agentMessage: AgentMessage = {
      id: messageId,
      from,
      to,
      type: message.type,
      payload: message.payload,
      timestamp: Date.now(),
      priority: message.priority || 0.5,
      ttl: message.ttl || 30000, // Default 30 seconds
    };

    // Add to outbox
    const queueEntry: MessageQueueEntry = {
      message: agentMessage,
      status: {
        messageId,
        status: 'pending',
        attempts: 0,
        lastAttempt: Date.now(),
      },
      attempts: 0,
      lastAttempt: Date.now(),
      nextRetry: Date.now(),
    };

    this.state.outbox.set(messageId, queueEntry);
    this.state.messageCount++;

    await this.persistState();

    // Attempt delivery
    await this.deliverMessage(queueEntry);

    return messageId;
  }

  /**
   * Broadcast message to multiple agents
   */
  async broadcast(
    from: string,
    to: string[],
    message: Omit<AgentMessage, 'id' | 'from' | 'timestamp'>
  ): Promise<string[]> {
    const messageIds: string[] = [];

    // Send to all recipients in parallel
    const sendPromises = to.map((agentId) =>
      this.sendToAgent(from, agentId, message)
    );

    const results = await Promise.allSettled(sendPromises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        messageIds.push(result.value);
      }
    }

    return messageIds;
  }

  /**
   * Receive messages for an agent
   */
  async receive(agentId: string): Promise<AgentMessage[]> {
    const messages: AgentMessage[] = [];

    // Find all messages for this agent
    for (const [id, message] of this.state.inbox.entries()) {
      if (message.to === agentId) {
        messages.push(message);
        this.state.inbox.delete(id);
      }
    }

    await this.persistState();

    return messages;
  }

  /**
   * Peek at messages without removing them
   */
  async peek(agentId: string): Promise<AgentMessage[]> {
    const messages: AgentMessage[] = [];

    for (const [, message] of this.state.inbox.entries()) {
      if (message.to === agentId) {
        messages.push(message);
      }
    }

    return messages;
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageId: string): Promise<MessageStatus | null> {
    const entry = this.state.outbox.get(messageId);

    if (entry) {
      return entry.status;
    }

    const sentStatus = this.state.sentMessages.get(messageId);
    if (sentStatus) {
      return sentStatus;
    }

    return null;
  }

  /**
   * Deliver message to target agent
   */
  private async deliverMessage(entry: MessageQueueEntry): Promise<void> {
    const { message } = entry;

    try {
      // Determine target DO namespace
      let targetDO: DurableObjectNamespace;

      if (message.to.startsWith('director-')) {
        targetDO = this.env.DIRECTOR_DO;
      } else if (message.to.startsWith('planner-')) {
        targetDO = this.env.PLANNER_DO;
      } else if (message.to.startsWith('executor-')) {
        targetDO = this.env.EXECUTOR_DO;
      } else if (message.to.startsWith('registry-')) {
        targetDO = this.env.AGENT_REGISTRY;
      } else {
        throw new Error(`Unknown agent type: ${message.to}`);
      }

      // Get agent stub
      const agentStub = targetDO.get(targetDO.idFromName(message.to));

      // Send message
      const response = await agentStub.fetch(
        new Request('https://agent/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        })
      );

      if (response.ok) {
        // Message delivered successfully
        entry.status.status = 'delivered';
        entry.status.attempts = entry.attempts;
        this.state.sentMessages.set(message.id, entry.status);
        this.state.outbox.delete(message.id);
      } else {
        // Delivery failed, schedule retry
        await this.scheduleRetry(entry);
      }
    } catch (error) {
      // Delivery failed, schedule retry
      await this.scheduleRetry(entry);
    }

    await this.persistState();
  }

  /**
   * Schedule retry for failed message
   */
  private async scheduleRetry(entry: MessageQueueEntry): Promise<void> {
    entry.attempts++;

    if (entry.attempts >= this.maxRetries) {
      // Max retries reached, mark as failed
      entry.status.status = 'failed';
      entry.status.error = 'Max retries exceeded';
      this.state.sentMessages.set(entry.message.id, entry.status);
      this.state.outbox.delete(entry.message.id);
    } else {
      // Schedule retry with exponential backoff
      const backoffMs = this.baseRetryDelay * Math.pow(2, entry.attempts);
      entry.nextRetry = Date.now() + backoffMs;
      entry.status.status = 'pending';
      entry.status.attempts = entry.attempts;
    }
  }

  /**
   * Retry pending messages
   */
  private async retryPendingMessages(): Promise<void> {
    const now = Date.now();

    for (const [id, entry] of this.state.outbox.entries()) {
      // Check if message has expired
      if (entry.message.ttl && now - entry.message.timestamp > entry.message.ttl) {
        entry.status.status = 'expired';
        this.state.sentMessages.set(id, entry.status);
        this.state.outbox.delete(id);
        continue;
      }

      // Check if it's time to retry
      if (entry.nextRetry <= now) {
        await this.deliverMessage(entry);
      }
    }

    await this.persistState();
  }

  /**
   * Store incoming message
   */
  async storeMessage(message: AgentMessage): Promise<void> {
    this.state.inbox.set(message.id, message);
    await this.persistState();
  }

  /**
   * Cleanup old messages
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up sent messages
    for (const [id, status] of this.state.sentMessages.entries()) {
      if (now - status.lastAttempt > maxAge) {
        this.state.sentMessages.delete(id);
      }
    }

    // Clean up inbox
    for (const [id, message] of this.state.inbox.entries()) {
      if (now - message.timestamp > maxAge) {
        this.state.inbox.delete(id);
      }
    }

    this.state.lastCleanup = now;
    this.state.messageCount = this.state.outbox.size + this.state.inbox.size;

    await this.persistState();
  }

  /**
   * Persist state to storage
   */
  private async persistState(): Promise<void> {
    try {
      await this.storage.put('messengerState', {
        outbox: Array.from(this.state.outbox.entries()),
        inbox: Array.from(this.state.inbox.entries()),
        sentMessages: Array.from(this.state.sentMessages.entries()),
        messageCount: this.state.messageCount,
        lastCleanup: this.state.lastCleanup,
      });
    } catch (error) {
      console.error('Failed to persist messenger state:', error);
    }
  }

  /**
   * Get messenger statistics
   */
  getStats(): {
    outboxSize: number;
    inboxSize: number;
    sentMessages: number;
    messageCount: number;
  } {
    return {
      outboxSize: this.state.outbox.size,
      inboxSize: this.state.inbox.size,
      sentMessages: this.state.sentMessages.size,
      messageCount: this.state.messageCount,
    };
  }
}

/**
 * Standalone messenger DO for handling agent messages
 */
export class AgentMessengerDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private messenger: AgentMessenger;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.messenger = new AgentMessenger(env, state.storage);
    this.messenger.initialize();
  }

  /**
   * Fetch handler for incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (method === 'POST' && path === '/send') {
        return this.handleSend(request);
      }

      if (method === 'POST' && path === '/broadcast') {
        return this.handleBroadcast(request);
      }

      if (method === 'GET' && path === '/receive') {
        return this.handleReceive(request);
      }

      if (method === 'GET' && path === '/status') {
        return this.handleGetStatus(request);
      }

      if (method === 'POST' && path === '/cleanup') {
        return this.handleCleanup();
      }

      if (method === 'GET' && path === '/stats') {
        return this.handleGetStats();
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
   * Handle send request
   */
  private async handleSend(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      from: string;
      to: string;
      message: Omit<AgentMessage, 'id' | 'from' | 'timestamp'>;
    };

    const messageId = await this.messenger.sendToAgent(
      body.from,
      body.to,
      body.message
    );

    return new Response(
      JSON.stringify({ messageId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle broadcast request
   */
  private async handleBroadcast(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      from: string;
      to: string[];
      message: Omit<AgentMessage, 'id' | 'from' | 'timestamp'>;
    };

    const messageIds = await this.messenger.broadcast(
      body.from,
      body.to,
      body.message
    );

    return new Response(
      JSON.stringify({ messageIds, count: messageIds.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle receive request
   */
  private async handleReceive(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId') || '';

    const messages = await this.messenger.receive(agentId);

    return new Response(
      JSON.stringify({ messages, count: messages.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get status request
   */
  private async handleGetStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const messageId = url.searchParams.get('messageId') || '';

    const status = await this.messenger.getMessageStatus(messageId);

    if (!status) {
      return new Response(
        JSON.stringify({ error: 'Message not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(status),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle cleanup request
   */
  private async handleCleanup(): Promise<Response> {
    await this.messenger.cleanup();

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get stats request
   */
  private async handleGetStats(): Promise<Response> {
    const stats = this.messenger.getStats();

    return new Response(
      JSON.stringify(stats),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Alarm handler for periodic maintenance
   */
  async alarm(): Promise<void> {
    // Retry pending messages
    await this.messenger.retryPendingMessages?.();

    // Cleanup old messages
    await this.messenger.cleanup();
  }
}

/**
 * Helper function to create messenger stub
 */
export function createMessengerStub(env: Env, sessionId: string): DurableObjectStub {
  return env.AGENT_REGISTRY.get(env.AGENT_REGISTRY.idFromName(`messenger-${sessionId}`));
}
