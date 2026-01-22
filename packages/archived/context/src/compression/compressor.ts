/**
 * Context Compressor - Advanced compression algorithms for conversation context
 */

import {
  Message,
  CompressionConfig,
  CompressionResult,
  CompressionStrategy,
  Summary,
  CompressionMetadata,
  CompressionError,
  TokenCountResult,
} from '../types';

/**
 * Default compression configuration
 */
const DEFAULT_CONFIG: CompressionConfig = {
  level: 'medium',
  strategy: 'hybrid',
  preserveKeyPoints: true,
  preserveStructure: true,
  preserveSources: true,
  targetRatio: 0.3,
  minQuality: 0.8,
};

/**
 * Compression levels configuration
 */
const COMPRESSION_LEVELS: Record<
  string,
  { targetRatio: number; minQuality: number; strategy: CompressionStrategy }
> = {
  none: { targetRatio: 1.0, minQuality: 1.0, strategy: 'lossless' },
  low: { targetRatio: 0.7, minQuality: 0.9, strategy: 'extraction' },
  medium: { targetRatio: 0.4, minQuality: 0.8, strategy: 'hybrid' },
  high: { targetRatio: 0.2, minQuality: 0.7, strategy: 'hierarchical' },
  maximum: { targetRatio: 0.1, minQuality: 0.6, strategy: 'lossy' },
};

/**
 * Context Compressor - Compresses conversation context while preserving key information
 */
export class ContextCompressor {
  private config: CompressionConfig;

  constructor(config: Partial<CompressionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ========================================================================
  // Main Compression Methods
  // ========================================================================

  /**
   * Compress messages using configured strategy
   */
  async compress(messages: Message[]): Promise<CompressionResult> {
    const startTime = Date.now();

    // Count original tokens
    const originalTokens = await this.countTotalTokens(messages);

    // Select compression strategy
    const strategy = this.selectStrategy(messages, originalTokens);

    // Compress based on strategy
    let compressed: Message[];
    switch (strategy) {
      case 'summarization':
        compressed = await this.summarize(messages);
        break;
      case 'extraction':
        compressed = await this.extract(messages);
        break;
      case 'hierarchical':
        compressed = await this.hierarchicalCompress(messages);
        break;
      case 'lossless':
        compressed = await this.losslessCompress(messages);
        break;
      case 'lossy':
        compressed = await this.lossyCompress(messages);
        break;
      case 'hybrid':
        compressed = await this.hybridCompress(messages);
        break;
      default:
        throw new CompressionError(`Unknown strategy: ${strategy}`);
    }

    // Count compressed tokens
    const compressedTokens = await this.countTotalTokens(compressed);

    // Calculate quality score
    const quality = await this.assessQuality(messages, compressed);

    // Calculate ratio
    const ratio = originalTokens === 0 ? 1 : compressedTokens / originalTokens;

    // Generate metadata
    const metadata: CompressionMetadata = {
      compressedAt: Date.now(),
      algorithm: strategy,
      version: '1.0.0',
      checksum: await this.generateChecksum(compressed),
      keyPoints: await this.extractKeyPoints(messages),
      summaries: await this.generateSummaries(messages),
    };

    return {
      original: messages,
      compressed,
      ratio,
      tokensSaved: originalTokens - compressedTokens,
      quality,
      strategy,
      metadata,
    };
  }

  /**
   * Compress to specific token count
   */
  async compressToTokens(messages: Message[], targetTokens: number): Promise<CompressionResult> {
    const originalTokens = await this.countTotalTokens(messages);

    if (originalTokens <= targetTokens) {
      return {
        original: messages,
        compressed: messages,
        ratio: 1.0,
        tokensSaved: 0,
        quality: 1.0,
        strategy: 'lossless',
        metadata: {
          compressedAt: Date.now(),
          algorithm: 'lossless',
          version: '1.0.0',
          checksum: await this.generateChecksum(messages),
          keyPoints: [],
          summaries: [],
        },
      };
    }

    // Try increasingly aggressive strategies
    const strategies: CompressionStrategy[] = [
      'extraction',
      'summarization',
      'hierarchical',
      'hybrid',
      'lossy',
    ];

    for (const strategy of strategies) {
      this.config.strategy = strategy;
      const result = await this.compress(messages);

      const compressedTokens = await this.countTotalTokens(result.compressed);
      if (compressedTokens <= targetTokens) {
        return result;
      }
    }

    // If all strategies fail, use maximum compression and truncate
    const result = await this.compress(messages);
    const truncated = await this.truncateToTokens(result.compressed, targetTokens);
    const truncatedTokens = await this.countTotalTokens(truncated);

    return {
      ...result,
      compressed: truncated,
      tokensSaved: originalTokens - truncatedTokens,
      ratio: truncatedTokens / originalTokens,
    };
  }

  // ========================================================================
  // Compression Strategies
  // ========================================================================

  /**
   * Summarization strategy - Create summaries of message groups
   */
  private async summarize(messages: Message[]): Promise<Message[]> {
    const compressed: Message[] = [];
    const groups = this.groupMessages(messages, 10); // Group by 10 messages

    for (const group of groups) {
      if (group.length === 1) {
        compressed.push(group[0]);
      } else {
        // Create summary message
        const summary = await this.createSummary(group);
        compressed.push(summary);
      }
    }

    return compressed;
  }

  /**
   * Extraction strategy - Extract only key messages
   */
  private async extract(messages: Message[]): Promise<Message[]> {
    const scores = await this.scoreMessages(messages);

    // Sort by score and select top messages
    const scored = messages.map((msg, i) => ({ message: msg, score: scores[i] }));
    scored.sort((a, b) => b.score - a.score);

    // Select messages based on target ratio
    const targetCount = Math.ceil(messages.length * this.config.targetRatio);
    const selected = scored.slice(0, targetCount).map(s => s.message);

    // Sort back to original order
    selected.sort((a, b) => a.timestamp - b.timestamp);

    return selected;
  }

  /**
   * Hierarchical compression - Multi-level summarization
   */
  private async hierarchicalCompress(messages: Message[]): Promise<Message[]> {
    const levels = this.getCompressionLevels();
    const summaries: Summary[] = [];

    // Create hierarchical summaries
    for (const level of levels) {
      const groupSize = Math.pow(10, level);
      const groups = this.groupMessages(messages, groupSize);

      for (const group of groups) {
        const summary = await this.createSummary(group, level);
        summaries.push({
          id: summary.id,
          content: summary.content,
          level,
          tokens: summary.metadata?.tokens || 0,
          quality: 1.0,
        });
      }
    }

    // Select best combination of summaries
    return this.selectOptimalSummaries(messages, summaries);
  }

  /**
   * Lossless compression - Preserve all information
   */
  private async losslessCompress(messages: Message[]): Promise<Message[]> {
    // Simply return original messages
    // Could use actual compression algorithms here
    return messages.map(m => ({ ...m }));
  }

  /**
   * Lossy compression - Aggressive compression with quality loss
   */
  private async lossyCompress(messages: Message[]): Promise<Message[]> {
    const compressed: Message[] = [];

    // Keep only system messages and very recent messages
    const recentCount = Math.max(3, Math.floor(messages.length * 0.1));

    for (const message of messages) {
      // Always keep system messages
      if (message.role === 'system') {
        compressed.push(message);
        continue;
      }

      // Keep recent messages
      const isRecent =
        messages.indexOf(message) >= messages.length - recentCount;
      if (isRecent) {
        compressed.push(message);
        continue;
      }

      // Summarize older messages
      if (message.role === 'assistant') {
        const summary = await this.createSummary([message]);
        compressed.push(summary);
      }
    }

    return compressed;
  }

  /**
   * Hybrid compression - Combine multiple strategies
   */
  private async hybridCompress(messages: Message[]): Promise<Message[]> {
    const compressed: Message[] = [];

    // Use different strategies for different message types
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const isRecent = i >= messages.length - 5;

      if (message.role === 'system' || isRecent) {
        // Keep system and recent messages as-is
        compressed.push(message);
      } else if (message.role === 'assistant') {
        // Summarize assistant messages
        const summary = await this.createSummary([message]);
        compressed.push(summary);
      } else if (message.role === 'user') {
        // Extract key information from user messages
        const extracted = await this.extractKeyInfo(message);
        compressed.push(extracted);
      } else {
        compressed.push(message);
      }
    }

    return compressed;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Select appropriate compression strategy
   */
  private selectStrategy(
    messages: Message[],
    tokenCount: number
  ): CompressionStrategy {
    // Use configured strategy if valid
    if (this.config.strategy !== 'hybrid') {
      return this.config.strategy;
    }

    // Auto-select based on compression level
    const levelConfig = COMPRESSION_LEVELS[this.config.level];
    return levelConfig.strategy;
  }

  /**
   * Group messages for compression
   */
  private groupMessages(messages: Message[], groupSize: number): Message[][] {
    const groups: Message[][] = [];

    for (let i = 0; i < messages.length; i += groupSize) {
      groups.push(messages.slice(i, i + groupSize));
    }

    return groups;
  }

  /**
   * Create summary message from message group
   */
  private async createSummary(
    messages: Message[],
    level: number = 0
  ): Promise<Message> {
    const contents = messages.map(m => m.content).join('\n\n');
    const summary = await this.generateSummaryText(contents);

    return {
      id: `summary-${Date.now()}-${Math.random()}`,
      role: 'system',
      content: summary,
      timestamp: Date.now(),
      metadata: {
        compressed: true,
        summary: true,
        level,
        originalMessageIds: messages.map(m => m.id),
        tokens: await this.countTokens(summary),
      },
    };
  }

  /**
   * Generate summary text
   */
  private async generateSummaryText(content: string): Promise<string> {
    // Extract key sentences
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

    if (sentences.length <= 2) {
      return content;
    }

    // Keep first and last sentences, plus middle sentences with key words
    const keyWords = ['important', 'key', 'main', 'critical', 'essential'];
    const middle = sentences.slice(1, -1);

    const selected: string[] = [
      sentences[0],
      ...middle.filter(s =>
        keyWords.some(kw => s.toLowerCase().includes(kw))
      ),
      sentences[sentences.length - 1],
    ];

    return selected.join('. ').trim() + '.';
  }

  /**
   * Score messages for extraction
   */
  private async scoreMessages(messages: Message[]): Promise<number[]> {
    const scores: number[] = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      let score = 0.5;

      // Boost for system messages
      if (message.role === 'system') {
        score += 0.4;
      }

      // Boost for recent messages
      const recencyBoost = 1 - i / messages.length;
      score += recencyBoost * 0.3;

      // Boost for messages with sources
      if (message.metadata?.sources && message.metadata.sources.length > 0) {
        score += 0.1;
      }

      // Boost for long messages (likely important)
      const length = message.content.length;
      if (length > 500) {
        score += 0.1;
      }

      scores.push(Math.min(1.0, score));
    }

    return scores;
  }

  /**
   * Extract key information from message
   */
  private async extractKeyInfo(message: Message): Promise<Message> {
    // Extract key phrases and entities
    const sentences = message.content.split(/[.!?]+/);
    const keyPhrases: string[] = [];

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 20 && trimmed.length < 200) {
        keyPhrases.push(trimmed);
      }
    }

    // Select top 3 key phrases
    const selected = keyPhrases.slice(0, 3);

    return {
      ...message,
      content: selected.join('. '),
      metadata: {
        ...message.metadata,
        compressed: true,
        extracted: true,
      },
    };
  }

  /**
   * Get compression levels for hierarchical summarization
   */
  private getCompressionLevels(): number[] {
    return [0, 1, 2, 3]; // 4 levels of hierarchy
  }

  /**
   * Select optimal combination of summaries
   */
  private selectOptimalSummaries(
    messages: Message[],
    summaries: Summary[]
  ): Message[] {
    // Select summaries that maximize coverage while minimizing tokens
    const selected: Message[] = [];

    // Start with highest level summaries
    const highestLevel = Math.max(...summaries.map(s => s.level));
    const topLevelSummaries = summaries.filter(s => s.level === highestLevel);

    for (const summary of topLevelSummaries) {
      selected.push({
        id: summary.id,
        role: 'system',
        content: summary.content,
        timestamp: Date.now(),
        metadata: {
          compressed: true,
          summary: true,
          level: summary.level,
          tokens: summary.tokens,
        },
      });
    }

    return selected;
  }

  /**
   * Extract key points from messages
   */
  private async extractKeyPoints(messages: Message[]): Promise<string[]> {
    const keyPoints: string[] = [];

    for (const message of messages) {
      // Extract from user questions
      if (message.role === 'user') {
        const sentences = message.content.split(/[.!?]+/);
        for (const sentence of sentences) {
          const trimmed = sentence.trim();
          if (
            trimmed.includes('?') ||
            trimmed.toLowerCase().startsWith('how') ||
            trimmed.toLowerCase().startsWith('what') ||
            trimmed.toLowerCase().startsWith('why')
          ) {
            keyPoints.push(trimmed);
          }
        }
      }

      // Extract from assistant answers with key indicators
      if (message.role === 'assistant') {
        const indicators = [
          'important',
          'key',
          'remember',
          'note that',
          'critical',
        ];
        const sentences = message.content.split(/[.!?]+/);
        for (const sentence of sentences) {
          const trimmed = sentence.trim();
          if (
            indicators.some(indicator =>
              trimmed.toLowerCase().includes(indicator)
            )
          ) {
            keyPoints.push(trimmed);
          }
        }
      }
    }

    return keyPoints.slice(0, 20); // Max 20 key points
  }

  /**
   * Generate summaries from messages
   */
  private async generateSummaries(messages: Message[]): Promise<Summary[]> {
    const summaries: Summary[] = [];
    const groups = this.groupMessages(messages, 10);

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const summary = await this.createSummary(group, i);
      summaries.push({
        id: summary.id,
        content: summary.content,
        level: 0,
        tokens: await this.countTokens(summary.content),
        quality: 1.0,
      });
    }

    return summaries;
  }

  /**
   * Assess quality of compression
   */
  private async assessQuality(
    original: Message[],
    compressed: Message[]
  ): Promise<number> {
    // Calculate quality based on multiple factors

    // 1. Information retention (key points preserved)
    const originalKeyPoints = await this.extractKeyPoints(original);
    const compressedKeyPoints = await this.extractKeyPoints(compressed);
    const keyPointRetention =
      originalKeyPoints.length === 0
        ? 1
        : compressedKeyPoints.length / originalKeyPoints.length;

    // 2. Structure preservation
    const structurePreservation =
      original.length === 0
        ? 1
        : Math.min(1, compressed.length / original.length);

    // 3. Token efficiency
    const originalTokens = await this.countTotalTokens(original);
    const compressedTokens = await this.countTotalTokens(compressed);
    const tokenEfficiency =
      originalTokens === 0 ? 1 : 1 - (originalTokens - compressedTokens) / originalTokens;

    // Combine scores
    const quality =
      keyPointRetention * 0.5 +
      structurePreservation * 0.3 +
      tokenEfficiency * 0.2;

    return Math.min(1.0, quality);
  }

  /**
   * Count total tokens in messages
   */
  private async countTotalTokens(messages: Message[]): Promise<number> {
    let total = 0;

    for (const message of messages) {
      const count = await this.countTokens(message.content);
      total += count;
    }

    return total;
  }

  /**
   * Count tokens in text
   */
  private async countTokens(text: string): Promise<number> {
    // Simple approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate checksum for messages
   */
  private async generateChecksum(messages: Message[]): Promise<string> {
    const content = messages.map(m => m.content).join('');
    let hash = 0;

    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Truncate messages to fit token count
   */
  private async truncateToTokens(
    messages: Message[],
    targetTokens: number
  ): Promise<Message[]> {
    const result: Message[] = [];
    let currentTokens = 0;

    // Keep system messages and recent messages
    const systemMessages = messages.filter(m => m.role === 'system');
    const otherMessages = messages
      .filter(m => m.role !== 'system')
      .reverse(); // Start from most recent

    // Add system messages first
    for (const message of systemMessages) {
      const tokens = await this.countTokens(message.content);
      if (currentTokens + tokens > targetTokens) break;
      result.push(message);
      currentTokens += tokens;
    }

    // Add recent messages
    for (const message of otherMessages) {
      const tokens = await this.countTokens(message.content);
      if (currentTokens + tokens > targetTokens) break;
      result.unshift(message); // Add in original order
      currentTokens += tokens;
    }

    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): CompressionConfig {
    return { ...this.config };
  }
}
