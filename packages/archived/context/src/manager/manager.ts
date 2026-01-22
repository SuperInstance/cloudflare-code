/**
 * Context Manager - Core conversation context tracking and management
 */

import {
  ConversationContext,
  Message,
  ContextWindow,
  ContextMetadata,
  ContextState,
  ContextEvent,
  ContextEventType,
  ContextManagerConfig,
  TokenCountResult,
  ContextError,
  TokenLimitError,
  SessionNotFoundError,
  EventHandler,
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ToolMessage,
} from '../types';
import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

/**
 * Default configuration for context manager
 */
const DEFAULT_CONFIG: ContextManagerConfig = {
  maxTokens: 200000,
  reservedTokens: 10000,
  compressionEnabled: true,
  compressionConfig: {
    level: 'medium',
    strategy: 'hybrid',
    preserveKeyPoints: true,
    preserveStructure: true,
    preserveSources: true,
    targetRatio: 0.3,
    minQuality: 0.8,
  },
  ragEnabled: true,
  ragConfig: {
    chunkSize: 512,
    chunkOverlap: 50,
    maxChunks: 10,
    retrievalStrategy: 'hybrid',
    embeddingModel: 'text-embedding-ada-002',
    rerankingEnabled: true,
    citationEnabled: true,
    minRelevanceScore: 0.7,
  },
  optimizerConfig: {
    maxTokens: 200000,
    reservedTokens: 10000,
    priorityStrategy: 'hybrid',
    relevanceThreshold: 0.5,
    temporalDecay: 0.95,
    qualityThreshold: 0.7,
    dynamicSizing: true,
  },
  enableAnalytics: true,
  enableEvents: true,
};

/**
 * Context Manager - Manages conversation context, message history, and state
 */
export class ContextManager extends EventEmitter {
  private contexts: Map<string, ConversationContext> = new Map();
  private config: ContextManagerConfig;
  private eventHandlers: Map<ContextEventType, Set<EventHandler>> = new Map();
  private metrics: Map<string, ContextMetrics> = new Map();

  constructor(config: Partial<ContextManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ========================================================================
  // Context Lifecycle
  // ========================================================================

  /**
   * Create a new conversation context
   */
  async createContext(
    userId?: string,
    metadata?: Partial<ContextMetadata>
  ): Promise<ConversationContext> {
    const sessionId = uuidv4();
    const now = Date.now();

    const contextWindow: ContextWindow = {
      maxTokens: this.config.maxTokens,
      currentTokens: 0,
      reservedTokens: this.config.reservedTokens,
      availableTokens: this.config.maxTokens - this.config.reservedTokens,
    };

    const contextMetadata: ContextMetadata = {
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      messageCount: 0,
      totalTokens: 0,
      compressedCount: 0,
      ...metadata,
    };

    const context: ConversationContext = {
      sessionId,
      userId,
      messages: [],
      contextWindow,
      metadata: contextMetadata,
      state: 'active',
    };

    this.contexts.set(sessionId, context);
    this.initializeMetrics(sessionId);

    await this.emitEvent({
      type: 'session_created',
      sessionId,
      timestamp: now,
      data: { userId, metadata: contextMetadata },
    });

    return context;
  }

  /**
   * Get an existing context by session ID
   */
  async getContext(sessionId: string): Promise<ConversationContext> {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw new SessionNotFoundError(sessionId);
    }

    // Update last accessed time
    context.metadata.lastAccessedAt = Date.now();

    return context;
  }

  /**
   * Update an existing context
   */
  async updateContext(
    sessionId: string,
    updates: Partial<ConversationContext>
  ): Promise<ConversationContext> {
    const context = await this.getContext(sessionId);

    // Merge updates
    Object.assign(context, updates);
    context.metadata.updatedAt = Date.now();

    await this.emitEvent({
      type: 'session_updated',
      sessionId,
      timestamp: Date.now(),
      data: { updates },
    });

    return context;
  }

  /**
   * Delete a context
   */
  async deleteContext(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw new SessionNotFoundError(sessionId);
    }

    context.state = 'deleted';
    this.contexts.delete(sessionId);
    this.metrics.delete(sessionId);

    await this.emitEvent({
      type: 'session_deleted',
      sessionId,
      timestamp: Date.now(),
      data: {},
    });
  }

  /**
   * Archive a context
   */
  async archiveContext(sessionId: string): Promise<ConversationContext> {
    const context = await this.getContext(sessionId);
    context.state = 'archived';
    context.metadata.isArchived = true;
    context.metadata.updatedAt = Date.now();

    return context;
  }

  // ========================================================================
  // Message Management
  // ========================================================================

  /**
   * Add a message to the context
   */
  async addMessage(
    sessionId: string,
    message: Omit<Message, 'id' | 'timestamp'>
  ): Promise<Message> {
    const context = await this.getContext(sessionId);

    if (context.state !== 'active') {
      throw new ContextError(
        `Cannot add message to ${context.state} context`,
        'INVALID_CONTEXT_STATE'
      );
    }

    // Create full message with ID and timestamp
    const fullMessage: Message = {
      id: uuidv4(),
      timestamp: Date.now(),
      ...message,
    };

    // Count tokens
    const tokenCount = await this.countTokens(fullMessage.content);
    fullMessage.metadata = {
      ...fullMessage.metadata,
      tokens: tokenCount.tokens,
      sessionId,
    };

    // Check token limit
    if (context.contextWindow.currentTokens + tokenCount.tokens > context.contextWindow.maxTokens) {
      if (this.config.compressionEnabled) {
        await this.compressContext(sessionId);
      } else {
        throw new TokenLimitError({
          current: context.contextWindow.currentTokens,
          requested: tokenCount.tokens,
          max: context.contextWindow.maxTokens,
        });
      }
    }

    // Add message
    context.messages.push(fullMessage);
    context.contextWindow.currentTokens += tokenCount.tokens;
    context.contextWindow.availableTokens = Math.max(
      0,
      context.contextWindow.maxTokens -
        context.contextWindow.reservedTokens -
        context.contextWindow.currentTokens
    );

    // Update metadata
    context.metadata.messageCount = context.messages.length;
    context.metadata.totalTokens = context.contextWindow.currentTokens;
    context.metadata.updatedAt = Date.now();

    // Update metrics
    this.updateMetrics(sessionId, fullMessage);

    await this.emitEvent({
      type: 'message_added',
      sessionId,
      timestamp: Date.now(),
      data: { messageId: fullMessage.id, role: fullMessage.role },
    });

    return fullMessage;
  }

  /**
   * Add multiple messages in batch
   */
  async addMessages(
    sessionId: string,
    messages: Array<Omit<Message, 'id' | 'timestamp'>>
  ): Promise<Message[]> {
    const addedMessages: Message[] = [];

    for (const message of messages) {
      const added = await this.addMessage(sessionId, message);
      addedMessages.push(added);
    }

    return addedMessages;
  }

  /**
   * Get a specific message by ID
   */
  async getMessage(sessionId: string, messageId: string): Promise<Message | null> {
    const context = await this.getContext(sessionId);
    return context.messages.find(m => m.id === messageId) || null;
  }

  /**
   * Get messages within a time range
   */
  async getMessagesByTimeRange(
    sessionId: string,
    startTime: number,
    endTime: number
  ): Promise<Message[]> {
    const context = await this.getContext(sessionId);
    return context.messages.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );
  }

  /**
   * Get last N messages
   */
  async getLastMessages(sessionId: string, count: number): Promise<Message[]> {
    const context = await this.getContext(sessionId);
    return context.messages.slice(-count);
  }

  /**
   * Remove a message
   */
  async removeMessage(sessionId: string, messageId: string): Promise<void> {
    const context = await this.getContext(sessionId);
    const index = context.messages.findIndex(m => m.id === messageId);

    if (index === -1) {
      throw new ContextError(
        `Message not found: ${messageId}`,
        'MESSAGE_NOT_FOUND'
      );
    }

    const message = context.messages[index];
    const tokenCount = message.metadata?.tokens || 0;

    context.messages.splice(index, 1);
    context.contextWindow.currentTokens -= tokenCount;
    context.contextWindow.availableTokens =
      context.contextWindow.maxTokens -
      context.contextWindow.reservedTokens -
      context.contextWindow.currentTokens;

    context.metadata.messageCount = context.messages.length;
    context.metadata.totalTokens = context.contextWindow.currentTokens;
    context.metadata.updatedAt = Date.now();

    await this.emitEvent({
      type: 'message_removed',
      sessionId,
      timestamp: Date.now(),
      data: { messageId },
    });
  }

  /**
   * Update a message
   */
  async updateMessage(
    sessionId: string,
    messageId: string,
    updates: Partial<Message>
  ): Promise<Message> {
    const context = await this.getContext(sessionId);
    const message = context.messages.find(m => m.id === messageId);

    if (!message) {
      throw new ContextError(
        `Message not found: ${messageId}`,
        'MESSAGE_NOT_FOUND'
      );
    }

    // Calculate token difference
    const oldTokenCount = message.metadata?.tokens || 0;
    const newContent = updates.content || message.content;
    const newTokenCount = (await this.countTokens(newContent)).tokens;
    const tokenDiff = newTokenCount - oldTokenCount;

    // Check if update would exceed limit
    if (
      context.contextWindow.currentTokens + tokenDiff >
      context.contextWindow.maxTokens
    ) {
      throw new TokenLimitError({
        current: context.contextWindow.currentTokens,
        requested: tokenDiff,
        max: context.contextWindow.maxTokens,
      });
    }

    // Apply updates
    Object.assign(message, updates);

    // Update token count
    message.metadata = {
      ...message.metadata,
      ...updates.metadata,
      tokens: newTokenCount,
    };

    context.contextWindow.currentTokens += tokenDiff;
    context.contextWindow.availableTokens =
      context.contextWindow.maxTokens -
      context.contextWindow.reservedTokens -
      context.contextWindow.currentTokens;

    context.metadata.totalTokens = context.contextWindow.currentTokens;
    context.metadata.updatedAt = Date.now();

    return message;
  }

  // ========================================================================
  // Context Window Management
  // ========================================================================

  /**
   * Get current context window state
   */
  getContextWindow(sessionId: string): ContextWindow {
    const context = this.contexts.get(sessionId);
    return context?.contextWindow || null;
  }

  /**
   * Update context window size
   */
  async updateContextWindow(
    sessionId: string,
    updates: Partial<ContextWindow>
  ): Promise<ContextWindow> {
    const context = await this.getContext(sessionId);

    Object.assign(context.contextWindow, updates);

    // Recalculate available tokens
    context.contextWindow.availableTokens =
      context.contextWindow.maxTokens -
      context.contextWindow.reservedTokens -
      context.contextWindow.currentTokens;

    return context.contextWindow;
  }

  /**
   * Get token usage statistics
   */
  getTokenUsage(sessionId: string): {
    current: number;
    max: number;
    reserved: number;
    available: number;
    percentage: number;
  } {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw new SessionNotFoundError(sessionId);
    }

    const { currentTokens, maxTokens, reservedTokens, availableTokens } =
      context.contextWindow;

    return {
      current: currentTokens,
      max: maxTokens,
      reserved: reservedTokens,
      available: availableTokens,
      percentage: (currentTokens / maxTokens) * 100,
    };
  }

  // ========================================================================
  // Context Compression
  // ========================================================================

  /**
   * Compress context to fit within token limits
   */
  async compressContext(sessionId: string): Promise<void> {
    const context = await this.getContext(sessionId);

    // Import compression module
    const { ContextCompressor } = await import('../compression/compressor');
    const compressor = new ContextCompressor(this.config.compressionConfig);

    // Compress messages
    const result = await compressor.compress(context.messages);

    // Replace messages with compressed version
    const tokensSaved = context.contextWindow.currentTokens - result.tokensSaved;
    context.messages = result.compressed;
    context.contextWindow.currentTokens = tokensSaved;
    context.contextWindow.availableTokens =
      context.contextWindow.maxTokens -
      context.contextWindow.reservedTokens -
      tokensSaved;

    context.metadata.compressedCount++;
    context.metadata.totalTokens = tokensSaved;
    context.metadata.updatedAt = Date.now();

    await this.emitEvent({
      type: 'context_compressed',
      sessionId,
      timestamp: Date.now(),
      data: {
        ratio: result.ratio,
        tokensSaved: result.tokensSaved,
        quality: result.quality,
      },
    });
  }

  // ========================================================================
  // Session Management
  // ========================================================================

  /**
   * List all sessions
   */
  listSessions(userId?: string): Array<{
    sessionId: string;
    userId?: string;
    state: ContextState;
    metadata: ContextMetadata;
  }> {
    const sessions = Array.from(this.contexts.values());

    return userId
      ? sessions
          .filter(s => s.userId === userId)
          .map(s => ({
            sessionId: s.sessionId,
            userId: s.userId,
            state: s.state,
            metadata: s.metadata,
          }))
      : sessions.map(s => ({
          sessionId: s.sessionId,
          userId: s.userId,
          state: s.state,
          metadata: s.metadata,
        }));
  }

  /**
   * Get active sessions
   */
  getActiveSessions(userId?: string): string[] {
    const sessions = Array.from(this.contexts.values());
    return sessions
      .filter(s => s.state === 'active' && (!userId || s.userId === userId))
      .map(s => s.sessionId);
  }

  /**
   * Get archived sessions
   */
  getArchivedSessions(userId?: string): string[] {
    const sessions = Array.from(this.contexts.values());
    return sessions
      .filter(s => s.state === 'archived' && (!userId || s.userId === userId))
      .map(s => s.sessionId);
  }

  // ========================================================================
  // Token Counting
  // ========================================================================

  /**
   * Count tokens in text
   */
  async countTokens(text: string): Promise<TokenCountResult> {
    // Simple approximation: ~4 characters per token
    const estimatedTokens = Math.ceil(text.length / 4);

    return {
      tokens: estimatedTokens,
      characters: text.length,
      estimated: true,
    };
  }

  /**
   * Count tokens in multiple texts
   */
  async countTokensBatch(texts: string[]): Promise<TokenCountResult[]> {
    return Promise.all(texts.map(text => this.countTokens(text)));
  }

  // ========================================================================
  // Event Handling
  // ========================================================================

  /**
   * Register event handler
   */
  on(event: ContextEventType, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unregister event handler
   */
  off(event: ContextEventType, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit event to all registered handlers
   */
  private async emitEvent(event: ContextEvent): Promise<void> {
    if (!this.config.enableEvents) return;

    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      await Promise.all(Array.from(handlers).map(h => h(event)));
    }

    this.emit(event.type, event);
  }

  // ========================================================================
  // Metrics and Analytics
  // ========================================================================

  /**
   * Initialize metrics for a session
   */
  private initializeMetrics(sessionId: string): void {
    this.metrics.set(sessionId, {
      totalMessages: 0,
      totalTokens: 0,
      compressionCount: 0,
      avgResponseTime: 0,
      lastActivity: Date.now(),
    });
  }

  /**
   * Update metrics for a session
   */
  private updateMetrics(sessionId: string, message: Message): void {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) return;

    metrics.totalMessages++;
    metrics.totalTokens += message.metadata?.tokens || 0;
    metrics.lastActivity = Date.now();
  }

  /**
   * Get metrics for a session
   */
  getMetrics(sessionId: string): ContextMetrics | null {
    return this.metrics.get(sessionId) || null;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, ContextMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Clear metrics for a session
   */
  clearMetrics(sessionId: string): void {
    this.metrics.delete(sessionId);
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Export context to JSON
   */
  async exportContext(sessionId: string): Promise<string> {
    const context = await this.getContext(sessionId);
    return JSON.stringify(context, null, 2);
  }

  /**
   * Import context from JSON
   */
  async importContext(json: string): Promise<ConversationContext> {
    const context = JSON.parse(json) as ConversationContext;
    this.contexts.set(context.sessionId, context);
    this.initializeMetrics(context.sessionId);
    return context;
  }

  /**
   * Clone a context
   */
  async cloneContext(sessionId: string): Promise<ConversationContext> {
    const original = await this.getContext(sessionId);
    const cloned = await this.createContext(original.userId, {
      ...original.metadata,
      title: original.metadata.title ? `${original.metadata.title} (Copy)` : undefined,
    });

    // Copy messages
    for (const message of original.messages) {
      await this.addMessage(cloned.sessionId, {
        role: message.role,
        content: message.content,
        metadata: message.metadata,
      });
    }

    return cloned;
  }

  /**
   * Clear all contexts
   */
  async clearAll(): Promise<void> {
    this.contexts.clear();
    this.metrics.clear();
  }

  /**
   * Get context count
   */
  getCount(): number {
    return this.contexts.size;
  }

  /**
   * Get context count by state
   */
  getCountByState(state: ContextState): number {
    return Array.from(this.contexts.values()).filter(c => c.state === state)
      .length;
  }
}

// ============================================================================
// Internal Types
// ============================================================================

interface ContextMetrics {
  totalMessages: number;
  totalTokens: number;
  compressionCount: number;
  avgResponseTime: number;
  lastActivity: number;
}
