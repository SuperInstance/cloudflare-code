/**
 * Context Builder - Build conversation context for LLM
 *
 * Provides multiple strategies for building conversation context
 * including recent messages, summarization, and full history.
 */

import type {
  SessionData,
  ConversationMessage,
} from '../../types/index';
import type { ConversationContext } from '../../do/session';

export type ContextStrategy = 'recent' | 'summary' | 'all';

export interface ContextBuilderOptions {
  /**
   * Default context window in tokens (default: 128K)
   */
  contextWindow?: number;

  /**
   * Enable message summarization (default: true)
   */
  enableSummarization?: boolean;

  /**
   * Summary target length in tokens (default: 10K)
   */
  summaryTargetTokens?: number;

  /**
   * Reserve tokens for system prompt (default: 4K)
   */
  reservedTokens?: number;
}

/**
 * Context Builder - Build optimized conversation context for LLM
 *
 * Features:
 * - Multiple context building strategies
 * - Automatic token estimation
 * - Message summarization
 * - Context window management
 * - Metadata preservation
 */
export class ContextBuilder {
  private options: Required<ContextBuilderOptions>;

  constructor(options: ContextBuilderOptions = {}) {
    this.options = {
      contextWindow: options.contextWindow ?? 128000,
      enableSummarization: options.enableSummarization ?? true,
      summaryTargetTokens: options.summaryTargetTokens ?? 10000,
      reservedTokens: options.reservedTokens ?? 4000,
    };
  }

  /**
   * Build conversation context for LLM
   */
  async buildContext(
    session: SessionData,
    strategy: ContextStrategy = 'recent'
  ): Promise<ConversationContext> {
    switch (strategy) {
      case 'recent':
        return this.buildRecentContext(session);
      case 'summary':
        return this.buildSummaryContext(session);
      case 'all':
        return this.buildAllContext(session);
      default:
        throw new Error(`Unknown context strategy: ${strategy}`);
    }
  }

  /**
   * Build recent messages context
   * Keeps most recent messages that fit in context window
   */
  private async buildRecentContext(
    session: SessionData
  ): Promise<ConversationContext> {
    const availableTokens = this.options.contextWindow - this.options.reservedTokens;
    const messages: ConversationMessage[] = [];
    let totalTokens = 0;
    let truncated = false;

    // Start from most recent messages
    for (let i = session.messages.length - 1; i >= 0; i--) {
      const message = session.messages[i];
      if (!message) continue;
      const msgTokens = message.tokens || this.estimateTokens(message.content);

      if (totalTokens + msgTokens > availableTokens) {
        truncated = true;
        break;
      }

      messages.unshift(message);
      totalTokens += msgTokens;
    }

    return {
      messages,
      totalTokens,
      messageCount: messages.length,
      truncated,
      metadata: {
        sessionId: session.sessionId,
        userId: session.userId,
        language: session.metadata.language,
        framework: session.metadata.framework,
        projectPath: session.metadata.projectPath,
      },
    };
  }

  /**
   * Build summary context
   * Summarizes old messages and keeps recent ones
   */
  private async buildSummaryContext(
    session: SessionData
  ): Promise<ConversationContext> {
    const availableTokens = this.options.contextWindow - this.options.reservedTokens;
    const messages: ConversationMessage[] = [];
    let totalTokens = 0;
    let truncated = false;

    // Reserve space for summary
    const summaryReserve = Math.min(
      this.options.summaryTargetTokens,
      availableTokens * 0.3
    );

    // Calculate remaining tokens for messages
    const messageTokens = availableTokens - summaryReserve;

    // Find point where we need to start summarizing
    let summaryStartIndex = session.messages.length;
    let messageTotal = 0;

    for (let i = session.messages.length - 1; i >= 0; i--) {
      const message = session.messages[i];
      if (!message) continue;
      const msgTokens =
        message.tokens ||
        this.estimateTokens(message.content);

      if (messageTotal + msgTokens > messageTokens) {
        summaryStartIndex = i;
        break;
      }

      messageTotal += msgTokens;
    }

    // Add recent messages
    const recentMessages = session.messages.slice(summaryStartIndex);
    for (const message of recentMessages) {
      messages.push(message);
      totalTokens += message.tokens || this.estimateTokens(message.content);
    }

    // Add summary if we have older messages
    let summary: string | undefined;
    if (summaryStartIndex > 0 && this.options.enableSummarization) {
      const oldMessages = session.messages.slice(0, summaryStartIndex);
      summary = await this.summarize(oldMessages);
      const summaryTokens = this.estimateTokens(summary);
      totalTokens += summaryTokens;

      // Create summary message
      const lastOldMessage = oldMessages[oldMessages.length - 1];
      if (lastOldMessage) {
        messages.unshift({
          role: 'system',
          content: `[Previous conversation summary]\n${summary}`,
          timestamp: lastOldMessage.timestamp,
          tokens: summaryTokens,
        });
      }
    }

    // Check if we're still over limit
    if (totalTokens > availableTokens) {
      truncated = true;
    }

    return {
      messages,
      ...(summary !== undefined ? { summary } : {}),
      totalTokens,
      messageCount: messages.length,
      truncated,
      metadata: {
        sessionId: session.sessionId,
        userId: session.userId,
        language: session.metadata.language,
        framework: session.metadata.framework,
        projectPath: session.metadata.projectPath,
      },
    };
  }

  /**
   * Build all messages context
   * Returns all messages (may exceed context window)
   */
  private async buildAllContext(
    session: SessionData
  ): Promise<ConversationContext> {
    const totalTokens = session.messages.reduce(
      (sum, msg) => sum + (msg.tokens || this.estimateTokens(msg.content)),
      0
    );

    const availableTokens = this.options.contextWindow - this.options.reservedTokens;

    return {
      messages: session.messages,
      totalTokens,
      messageCount: session.messages.length,
      truncated: totalTokens > availableTokens,
      metadata: {
        sessionId: session.sessionId,
        userId: session.userId,
        language: session.metadata.language,
        framework: session.metadata.framework,
        projectPath: session.metadata.projectPath,
      },
    };
  }

  /**
   * Summarize old messages
   * Creates a concise summary of conversation history
   */
  private async summarize(messages: ConversationMessage[]): Promise<string> {
    if (messages.length === 0) {
      return '';
    }

    // Extract key information
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    const systemMessages = messages.filter(m => m.role === 'system');

    // Build summary
    const parts: string[] = [];

    // Add context
    parts.push(`Conversation history (${messages.length} messages)`);

    // Count by type
    parts.push(
      `- ${userMessages.length} user messages`,
      `- ${assistantMessages.length} assistant responses`,
      `- ${systemMessages.length} system messages`
    );

    // Extract key topics from recent messages
    const recentUserMessages = userMessages.slice(-5);
    if (recentUserMessages.length > 0) {
      parts.push('\nRecent topics:');
      for (const msg of recentUserMessages) {
        const preview = msg.content.slice(0, 100);
        parts.push(`- ${preview}${msg.content.length > 100 ? '...' : ''}`);
      }
    }

    // Calculate total tokens
    const totalTokens = messages.reduce(
      (sum, msg) => sum + (msg.tokens || this.estimateTokens(msg.content)),
      0
    );
    parts.push(`\nTotal tokens in history: ${totalTokens}`);

    return parts.join('\n');
  }

  /**
   * Estimate token count for text
   * Rough estimation: ~4 characters per token
   * More accurate would be to use a tokenizer
   */
  estimateTokens(text: string): number {
    // Basic estimation
    let tokens = Math.ceil(text.length / 4);

    // Adjust for common patterns
    // Code typically has more tokens per character
    if (text.includes('function') || text.includes('const') || text.includes('=>')) {
      tokens = Math.ceil(tokens * 1.5);
    }

    // URLs and structured data have different ratios
    if (text.startsWith('http') || text.startsWith('{')) {
      tokens = Math.ceil(tokens * 0.8);
    }

    return tokens;
  }

  /**
   * Truncate messages to fit token limit
   */
  async truncateToLimit(
    messages: ConversationMessage[],
    limit: number
  ): Promise<ConversationMessage[]> {
    const result: ConversationMessage[] = [];
    let totalTokens = 0;

    for (const message of messages) {
      const msgTokens = message.tokens || this.estimateTokens(message.content);

      if (totalTokens + msgTokens > limit) {
        break;
      }

      result.push(message);
      totalTokens += msgTokens;
    }

    return result;
  }

  /**
   * Calculate context window usage
   */
  calculateUsage(context: ConversationContext): {
    used: number;
    available: number;
    percentage: number;
  } {
    const available = this.options.contextWindow - this.options.reservedTokens;
    const percentage = (context.totalTokens / available) * 100;

    return {
      used: context.totalTokens,
      available,
      percentage: Math.min(percentage, 100),
    };
  }

  /**
   * Optimize context by removing redundant messages
   */
  async optimizeContext(
    context: ConversationContext
  ): Promise<ConversationContext> {
    const optimizedMessages: ConversationMessage[] = [];
    const seen = new Set<string>();

    // Remove duplicate messages
    for (const message of context.messages) {
      const key = `${message.role}:${message.content.slice(0, 50)}`;

      if (!seen.has(key)) {
        seen.add(key);
        optimizedMessages.push(message);
      }
    }

    // Recalculate tokens
    const totalTokens = optimizedMessages.reduce(
      (sum, msg) => sum + (msg.tokens || this.estimateTokens(msg.content)),
      0
    );

    return {
      ...context,
      messages: optimizedMessages,
      totalTokens,
      messageCount: optimizedMessages.length,
    };
  }

  /**
   * Build context with specific metadata
   */
  async buildContextWithMetadata(
    session: SessionData,
    strategy: ContextStrategy,
    metadata: Record<string, unknown>
  ): Promise<ConversationContext> {
    const context = await this.buildContext(session, strategy);

    // Add metadata as system message
    if (Object.keys(metadata).length > 0) {
      const metadataMsg = `[Session Metadata]\n${JSON.stringify(metadata, null, 2)}`;
      const metadataTokens = this.estimateTokens(metadataMsg);

      context.messages.unshift({
        role: 'system',
        content: metadataMsg,
        timestamp: Date.now(),
        tokens: metadataTokens,
      });
      context.totalTokens += metadataTokens;
      context.messageCount += 1;
    }

    return context;
  }

  /**
   * Estimate context quality score
   */
  estimateQuality(context: ConversationContext): {
    score: number;
    factors: {
      messageCount: number;
      tokenUtilization: number;
      truncation: number;
      diversity: number;
    };
  } {
    // Message count score (optimal: 10-50 messages)
    const messageCount = context.messageCount;
    const messageScore =
      messageCount >= 10 && messageCount <= 50
        ? 1
        : messageCount < 10
        ? messageCount / 10
        : Math.max(0, 1 - (messageCount - 50) / 100);

    // Token utilization (optimal: 60-90% of context window)
    const available = this.options.contextWindow - this.options.reservedTokens;
    const utilization = context.totalTokens / available;
    const utilizationScore =
      utilization >= 0.6 && utilization <= 0.9
        ? 1
        : utilization < 0.6
        ? utilization / 0.6
        : Math.max(0, 1 - (utilization - 0.9) / 0.1);

    // Truncation penalty
    const truncationScore = context.truncated ? 0.7 : 1;

    // Message diversity (ratio of user to assistant messages)
    const userMessages = context.messages.filter(m => m.role === 'user').length;
    const assistantMessages = context.messages.filter(
      m => m.role === 'assistant'
    ).length;
    const diversityScore =
      userMessages > 0 && assistantMessages > 0
        ? 1
        : Math.max(0, Math.min(userMessages, assistantMessages) / 5);

    // Calculate overall score
    const score =
      (messageScore * 0.2 +
        utilizationScore * 0.3 +
        truncationScore * 0.3 +
        diversityScore * 0.2) *
      100;

    return {
      score: Math.round(score),
      factors: {
        messageCount: Math.round(messageScore * 100),
        tokenUtilization: Math.round(utilizationScore * 100),
        truncation: Math.round(truncationScore * 100),
        diversity: Math.round(diversityScore * 100),
      },
    };
  }
}

/**
 * Helper function to create ContextBuilder instance
 */
export function createContextBuilder(
  options?: ContextBuilderOptions
): ContextBuilder {
  return new ContextBuilder(options);
}
