/**
 * Context Management for Multi-Agent Conversations
 *
 * Manages conversation context propagation across agents:
 * - Thread-based conversations
 * - Context merging and propagation
 * - History tracking
 * - Message threading
 * - Cross-agent context sharing
 */

import type {
  ConversationContext,
  ConversationThread,
  AgentMessage,
  MessageContext,
  HistoryEntry,
} from './types';

export interface ContextEnv {
  AGENT_CONTEXT: DurableObjectNamespace;
  AGENTS_KV?: KVNamespace;
}

/**
 * Context state
 */
interface ContextManagerState {
  conversations: Map<string, ConversationContext>;
  threads: Map<string, ConversationThread>;
  history: Map<string, HistoryEntry[]>;
  stats: {
    conversationsCreated: number;
    threadsCreated: number;
    messagesStored: number;
    lastActivity: number;
  };
}

/**
 * Context Manager - Manages conversation context across agents
 *
 * Features:
 * - Thread-based conversation tracking
 * - Context propagation with message threading
 * - History management with efficient storage
 * - Cross-agent context sharing
 * - Automatic cleanup of old contexts
 */
export class ContextManager {
  private env: ContextEnv;
  private storage: DurableObjectStorage;
  private state: ContextManagerState;
  private maxHistoryLength = 1000;
  private maxThreadsPerConversation = 100;

  constructor(env: ContextEnv, storage: DurableObjectStorage) {
    this.env = env;
    this.storage = storage;

    this.state = {
      conversations: new Map(),
      threads: new Map(),
      history: new Map(),
      stats: {
        conversationsCreated: 0,
        threadsCreated: 0,
        messagesStored: 0,
        lastActivity: Date.now(),
      },
    };
  }

  /**
   * Initialize from storage
   */
  async initialize(): Promise<void> {
    try {
      const stored = await this.storage.get<{
        conversations: Array<[string, Omit<ConversationContext, 'threads'> & { threads: Array<[string, ConversationThread]> }]>;
        threads: Array<[string, ConversationThread]>;
        history: Array<[string, HistoryEntry[]]>;
        stats: ContextManagerState['stats'];
      }>('contextState');

      if (stored) {
        // Restore conversations with proper Map for threads
        for (const [id, ctx] of stored.conversations) {
          this.state.conversations.set(id, {
            ...ctx,
            threads: new Map(ctx.threads),
          });
        }

        this.state.threads = new Map(stored.threads);
        this.state.history = new Map(stored.history);
        this.state.stats = stored.stats;
      }
    } catch (error) {
      console.error('Failed to initialize context manager:', error);
    }
  }

  /**
   * Create or get conversation context
   */
  async getOrCreateConversation(conversationId: string, sessionId?: string, userId?: string): Promise<ConversationContext> {
    let context = this.state.conversations.get(conversationId);

    if (!context) {
      context = this.createConversation(conversationId, sessionId, userId);
      this.state.stats.conversationsCreated++;
      await this.persistState();
    }

    return context;
  }

  /**
   * Create a new conversation context
   */
  private createConversation(conversationId: string, sessionId?: string, userId?: string): ConversationContext {
    const context: ConversationContext = {
      conversationId,
      sessionId,
      userId,
      messageCount: 0,
      totalTokens: 0,
      lastActivity: Date.now(),
      preferences: {},
      history: [],
      threads: new Map(),
      metadata: {},
    };

    this.state.conversations.set(conversationId, context);
    return context;
  }

  /**
   * Update conversation context with a message
   */
  async updateConversation(conversationId: string, message: AgentMessage, tokens?: number): Promise<void> {
    const context = this.state.conversations.get(conversationId);

    if (!context) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    // Add message to history
    context.history.push({
      role: 'assistant',
      content: typeof message.payload === 'string' ? message.payload : JSON.stringify(message.payload),
      timestamp: message.timestamp,
      agentId: message.from,
    });

    // Update stats
    context.messageCount++;
    if (tokens) {
      context.totalTokens += tokens;
    }
    context.lastActivity = message.timestamp;

    // Keep history manageable
    if (context.history.length > this.maxHistoryLength) {
      context.history = context.history.slice(-this.maxHistoryLength);
    }

    await this.persistState();
  }

  /**
   * Get conversation context
   */
  getConversation(conversationId: string): ConversationContext | null {
    return this.state.conversations.get(conversationId) || null;
  }

  /**
   * Create a new thread in a conversation
   */
  async createThread(
    conversationId: string,
    parentId: string,
    participants: string[]
  ): Promise<string> {
    const context = this.state.conversations.get(conversationId);

    if (!context) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    // Check thread limit
    if (context.threads.size >= this.maxThreadsPerConversation) {
      throw new Error('Maximum threads per conversation reached');
    }

    const threadId = crypto.randomUUID();

    const thread: ConversationThread = {
      threadId,
      parentId,
      messages: [],
      participants,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    context.threads.set(threadId, thread);
    this.state.threads.set(threadId, thread);
    this.state.stats.threadsCreated++;

    await this.persistState();

    return threadId;
  }

  /**
   * Add message to thread
   */
  async addToThread(threadId: string, messageId: string): Promise<void> {
    const thread = this.state.threads.get(threadId);

    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    if (thread.status === 'closed') {
      throw new Error(`Thread is closed: ${threadId}`);
    }

    thread.messages.push(messageId);
    thread.updatedAt = Date.now();

    await this.persistState();
  }

  /**
   * Get thread
   */
  getThread(threadId: string): ConversationThread | null {
    return this.state.threads.get(threadId) || null;
  }

  /**
   * Get threads for conversation
   */
  getThreads(conversationId: string): ConversationThread[] {
    const context = this.state.conversations.get(conversationId);

    if (!context) {
      return [];
    }

    return Array.from(context.threads.values());
  }

  /**
   * Resolve thread
   */
  async resolveThread(threadId: string): Promise<void> {
    const thread = this.state.threads.get(threadId);

    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    thread.status = 'resolved';
    thread.updatedAt = Date.now();

    await this.persistState();
  }

  /**
   * Close thread
   */
  async closeThread(threadId: string): Promise<void> {
    const thread = this.state.threads.get(threadId);

    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    thread.status = 'closed';
    thread.updatedAt = Date.now();

    await this.persistState();
  }

  /**
   * Create message context for propagation
   */
  createMessageContext(
    conversationId: string,
    parentId?: string,
    threadId?: string,
    metadata: Record<string, unknown> = {}
  ): MessageContext {
    return {
      conversationId,
      parentId,
      threadId,
      metadata,
      timestamp: Date.now(),
    };
  }

  /**
   * Propagate context to child message
   */
  propagateContext(parentContext: MessageContext, additionalMetadata: Record<string, unknown> = {}): MessageContext {
    return {
      conversationId: parentContext.conversationId,
      sessionId: parentContext.sessionId,
      userId: parentContext.userId,
      parentId: parentContext.parentId,
      threadId: parentContext.threadId,
      metadata: {
        ...parentContext.metadata,
        ...additionalMetadata,
      },
      timestamp: Date.now(),
      ttl: parentContext.ttl,
    };
  }

  /**
   * Merge contexts from multiple sources
   */
  mergeContexts(contexts: MessageContext[]): MessageContext {
    if (contexts.length === 0) {
      throw new Error('Cannot merge empty context list');
    }

    if (contexts.length === 1) {
      return contexts[0];
    }

    const baseContext = contexts[0];

    return {
      conversationId: baseContext.conversationId,
      sessionId: baseContext.sessionId,
      userId: baseContext.userId,
      parentId: baseContext.parentId,
      threadId: baseContext.threadId,
      metadata: contexts.reduce((acc, ctx) => ({ ...acc, ...ctx.metadata }), {}),
      timestamp: Date.now(),
      ttl: Math.min(...contexts.map((c) => c.ttl || Infinity)),
    };
  }

  /**
   * Add history entry
   */
  async addHistory(entry: HistoryEntry): Promise<void> {
    const history = this.state.history.get(entry.conversationId) || [];

    history.push(entry);

    // Keep history manageable
    if (history.length > this.maxHistoryLength) {
      history.shift();
    }

    this.state.history.set(entry.conversationId, history);
    this.state.stats.messagesStored++;

    await this.persistState();
  }

  /**
   * Get conversation history
   */
  getHistory(conversationId: string): HistoryEntry[] {
    return this.state.history.get(conversationId) || [];
  }

  /**
   * Get history range
   */
  getHistoryRange(conversationId: string, startTime: number, endTime: number): HistoryEntry[] {
    const history = this.state.history.get(conversationId) || [];

    return history.filter((entry) => entry.timestamp >= startTime && entry.timestamp <= endTime);
  }

  /**
   * Get thread history
   */
  getThreadHistory(threadId: string): HistoryEntry[] {
    const thread = this.state.threads.get(threadId);

    if (!thread) {
      return [];
    }

    const history: HistoryEntry[] = [];

    for (const messageId of thread.messages) {
      for (const [, conversationHistory] of this.state.history.entries()) {
        const entry = conversationHistory.find((e) => e.messageId === messageId);
        if (entry) {
          history.push(entry);
          break;
        }
      }
    }

    return history;
  }

  /**
   * Search history by action
   */
  searchByAction(conversationId: string, action: string): HistoryEntry[] {
    const history = this.state.history.get(conversationId) || [];

    return history.filter((entry) => entry.action === action);
  }

  /**
   * Search history by agent
   */
  searchByAgent(conversationId: string, agentId: string): HistoryEntry[] {
    const history = this.state.history.get(conversationId) || [];

    return history.filter((entry) => entry.from === agentId);
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const context = this.state.conversations.get(conversationId);

    if (!context) {
      return;
    }

    // Delete all threads
    for (const [threadId] of context.threads) {
      this.state.threads.delete(threadId);
    }

    // Delete conversation
    this.state.conversations.delete(conversationId);

    // Delete history
    this.state.history.delete(conversationId);

    await this.persistState();
  }

  /**
   * Cleanup old contexts
   */
  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    // Clean up old conversations
    for (const [id, context] of this.state.conversations.entries()) {
      if (now - context.lastActivity > maxAge) {
        await this.deleteConversation(id);
        cleaned++;
      }
    }

    // Clean up old history entries
    for (const [conversationId, history] of this.state.history.entries()) {
      const filtered = history.filter((entry) => now - entry.timestamp <= maxAge);

      if (filtered.length < history.length) {
        this.state.history.set(conversationId, filtered);
        cleaned++;
      }
    }

    await this.persistState();

    return cleaned;
  }

  /**
   * Get context statistics
   */
  getStats(): {
    totalConversations: number;
    totalThreads: number;
    totalHistoryEntries: number;
    stats: ContextManagerState['stats'];
  } {
    let totalHistoryEntries = 0;

    for (const history of this.state.history.values()) {
      totalHistoryEntries += history.length;
    }

    return {
      totalConversations: this.state.conversations.size,
      totalThreads: this.state.threads.size,
      totalHistoryEntries,
      stats: { ...this.state.stats },
    };
  }

  /**
   * Persist state to storage
   */
  private async persistState(): Promise<void> {
    try {
      // Convert threads Maps to arrays for serialization
      const conversationsArray = Array.from(this.state.conversations.entries()).map(([id, ctx]) => [
        id,
        {
          ...ctx,
          threads: Array.from(ctx.threads.entries()),
        },
      ]);

      await this.storage.put('contextState', {
        conversations: conversationsArray,
        threads: Array.from(this.state.threads.entries()),
        history: Array.from(this.state.history.entries()),
        stats: this.state.stats,
      });
    } catch (error) {
      console.error('Failed to persist context state:', error);
    }
  }
}

/**
 * Context Manager Durable Object
 */
export class ContextManagerDO implements DurableObject {
  private state: DurableObjectState;
  private env: ContextEnv;
  private contextManager: ContextManager;

  constructor(state: DurableObjectState, env: ContextEnv) {
    this.state = state;
    this.env = env;
    this.contextManager = new ContextManager(env, state.storage);
    this.contextManager.initialize();
  }

  /**
   * Fetch handler
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (method === 'GET' && path === '/conversation') {
        return this.handleGetConversation(request);
      }

      if (method === 'POST' && path === '/conversation/update') {
        return this.handleUpdateConversation(request);
      }

      if (method === 'POST' && path === '/thread/create') {
        return this.handleCreateThread(request);
      }

      if (method === 'POST' && path === '/thread/add') {
        return this.handleAddToThread(request);
      }

      if (method === 'GET' && path === '/thread') {
        return this.handleGetThread(request);
      }

      if (method === 'POST' && path === '/thread/resolve') {
        return this.handleResolveThread(request);
      }

      if (method === 'POST' && path === '/thread/close') {
        return this.handleCloseThread(request);
      }

      if (method === 'GET' && path === '/history') {
        return this.handleGetHistory(request);
      }

      if (method === 'GET' && path === '/thread/history') {
        return this.handleGetThreadHistory(request);
      }

      if (method === 'POST' && path === '/history/add') {
        return this.handleAddHistory(request);
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
   * Handle get conversation
   */
  private async handleGetConversation(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversationId') || '';

    const context = await this.contextManager.getOrCreateConversation(
      conversationId,
      url.searchParams.get('sessionId') || undefined,
      url.searchParams.get('userId') || undefined
    );

    return new Response(
      JSON.stringify(context),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle update conversation
   */
  private async handleUpdateConversation(request: Request): Promise<Response> {
    const body = await request.json() as {
      conversationId: string;
      message: AgentMessage;
      tokens?: number;
    };

    await this.contextManager.updateConversation(
      body.conversationId,
      body.message,
      body.tokens
    );

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle create thread
   */
  private async handleCreateThread(request: Request): Promise<Response> {
    const body = await request.json() as {
      conversationId: string;
      parentId: string;
      participants: string[];
    };

    const threadId = await this.contextManager.createThread(
      body.conversationId,
      body.parentId,
      body.participants
    );

    return new Response(
      JSON.stringify({ success: true, threadId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle add to thread
   */
  private async handleAddToThread(request: Request): Promise<Response> {
    const body = await request.json() as {
      threadId: string;
      messageId: string;
    };

    await this.contextManager.addToThread(body.threadId, body.messageId);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get thread
   */
  private async handleGetThread(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const threadId = url.searchParams.get('threadId') || '';

    const thread = this.contextManager.getThread(threadId);

    if (!thread) {
      return new Response(
        JSON.stringify({ error: 'Thread not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(thread),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle resolve thread
   */
  private async handleResolveThread(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const threadId = url.searchParams.get('threadId') || '';

    await this.contextManager.resolveThread(threadId);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle close thread
   */
  private async handleCloseThread(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const threadId = url.searchParams.get('threadId') || '';

    await this.contextManager.closeThread(threadId);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get history
   */
  private async handleGetHistory(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversationId') || '';

    const history = this.contextManager.getHistory(conversationId);

    return new Response(
      JSON.stringify({ history, count: history.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get thread history
   */
  private async handleGetThreadHistory(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const threadId = url.searchParams.get('threadId') || '';

    const history = this.contextManager.getThreadHistory(threadId);

    return new Response(
      JSON.stringify({ history, count: history.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle add history
   */
  private async handleAddHistory(request: Request): Promise<Response> {
    const body = await request.json() as { entry: HistoryEntry };

    await this.contextManager.addHistory(body.entry);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get stats
   */
  private async handleGetStats(): Promise<Response> {
    const stats = this.contextManager.getStats();

    return new Response(
      JSON.stringify(stats),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle cleanup
   */
  private async handleCleanup(): Promise<Response> {
    const url = new URL(request.url);
    const maxAge = parseInt(url.searchParams.get('maxAge') || '');

    const cleaned = await this.contextManager.cleanup(maxAge);

    return new Response(
      JSON.stringify({ success: true, cleaned }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Alarm handler for periodic cleanup
   */
  async alarm(): Promise<void> {
    // Cleanup old contexts (older than 7 days)
    await this.contextManager.cleanup(7 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Helper function to create context manager stub
 */
export function createContextStub(env: ContextEnv, conversationId: string): DurableObjectStub {
  return env.AGENT_CONTEXT.get(env.AGENT_CONTEXT.idFromName(conversationId));
}
