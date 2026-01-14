/**
 * Context Optimizer - Token budget management and priority-based context optimization
 */

import {
  Message,
  OptimizerConfig,
  ContextPriority,
  OptimizationResult,
  PriorityStrategy,
  QualityMetrics,
} from '../types';

/**
 * Default optimizer configuration
 */
const DEFAULT_CONFIG: OptimizerConfig = {
  maxTokens: 200000,
  reservedTokens: 10000,
  priorityStrategy: 'hybrid',
  relevanceThreshold: 0.5,
  temporalDecay: 0.95,
  qualityThreshold: 0.7,
  dynamicSizing: true,
};

/**
 * Context Optimizer - Optimizes context for token efficiency and quality
 */
export class ContextOptimizer {
  private config: OptimizerConfig;

  constructor(config: Partial<OptimizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ========================================================================
  // Main Optimization
  // ========================================================================

  /**
   * Optimize messages for token budget
   */
  async optimize(
    messages: Message[],
    query?: string,
    queryEmbedding?: number[]
  ): Promise<OptimizationResult> {
    // Calculate priorities for all messages
    const priorities = await this.calculatePriorities(messages, query, queryEmbedding);

    // Sort messages by priority
    const sorted = messages
      .map((msg, i) => ({ message: msg, priority: priorities[i] }))
      .sort((a, b) => b.priority.priority - a.priority.priority);

    // Select messages within token budget
    const included: Message[] = [];
    const excluded: Message[] = [];
    const compressed: Message[] = [];
    let currentTokens = 0;

    for (const { message, priority } of sorted) {
      const messageTokens = message.metadata?.tokens || (await this.countTokens(message.content));

      // Always include system messages
      if (message.role === 'system') {
        included.push(message);
        currentTokens += messageTokens;
        continue;
      }

      // Check if we can include this message
      const availableTokens = this.config.maxTokens - this.config.reservedTokens - currentTokens;

      if (messageTokens <= availableTokens) {
        if (priority.priority >= this.config.relevanceThreshold) {
          included.push(message);
          currentTokens += messageTokens;
        } else {
          // Compress low priority messages
          const compressedMessage = await this.compressMessage(message);
          compressed.push(compressedMessage);
          currentTokens += compressedMessage.metadata?.tokens || 0;
        }
      } else {
        excluded.push(message);
      }
    }

    // Sort included messages back to original order
    included.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate quality metrics
    const qualityScore = await this.calculateQualityScore(included, query);

    // Calculate coverage and diversity
    const coverage = this.calculateCoverage(included, messages);
    const diversity = this.calculateDiversity(included);

    return {
      included,
      excluded,
      compressed,
      totalTokens: currentTokens,
      qualityScore,
      coverage,
      diversity,
    };
  }

  /**
   * Optimize for specific token count
   */
  async optimizeToTokens(
    messages: Message[],
    targetTokens: number,
    query?: string
  ): Promise<OptimizationResult> {
    const originalConfig = this.config.maxTokens;
    this.config.maxTokens = targetTokens;

    const result = await this.optimize(messages, query);

    this.config.maxTokens = originalConfig;

    return result;
  }

  // ========================================================================
  // Priority Calculation
  // ========================================================================

  /**
   * Calculate priority scores for messages
   */
  async calculatePriorities(
    messages: Message[],
    query?: string,
    queryEmbedding?: number[]
  ): Promise<ContextPriority[]> {
    const priorities: ContextPriority[] = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const priority = await this.calculateMessagePriority(message, i, messages.length, query, queryEmbedding);
      priorities.push(priority);
    }

    return priorities;
  }

  /**
   * Calculate priority for a single message
   */
  private async calculateMessagePriority(
    message: Message,
    index: number,
    totalCount: number,
    query?: string,
    queryEmbedding?: number[]
  ): Promise<ContextPriority> {
    let priority = 0.5;
    const reasons: string[] = [];

    switch (this.config.priorityStrategy) {
      case 'recency':
        priority = this.calculateRecencyPriority(index, totalCount);
        reasons.push('recency');
        break;

      case 'relevance':
        priority = await this.calculateRelevancePriority(message, query, queryEmbedding);
        reasons.push('relevance');
        break;

      case 'importance':
        priority = this.calculateImportancePriority(message);
        reasons.push('importance');
        break;

      case 'hybrid':
        const recency = this.calculateRecencyPriority(index, totalCount);
        const relevance = await this.calculateRelevancePriority(message, query, queryEmbedding);
        const importance = this.calculateImportancePriority(message);

        priority = recency * 0.3 + relevance * 0.5 + importance * 0.2;
        reasons.push('recency', 'relevance', 'importance');
        break;

      case 'custom':
        priority = await this.calculateCustomPriority(message, index, totalCount, query);
        reasons.push('custom');
        break;
    }

    return {
      messageId: message.id,
      priority,
      score: priority,
      reasons,
    };
  }

  /**
   * Calculate recency-based priority
   */
  private calculateRecencyPriority(index: number, totalCount: number): number {
    // More recent messages have higher priority
    const position = index / totalCount;
    return 1 - position * 0.7; // Range from 1.0 to 0.3
  }

  /**
   * Calculate relevance-based priority
   */
  private async calculateRelevancePriority(
    message: Message,
    query?: string,
    queryEmbedding?: number[]
  ): Promise<number> {
    if (!query) {
      return 0.5;
    }

    // Calculate text similarity
    const textSimilarity = this.calculateTextSimilarity(message.content, query);

    // Calculate embedding similarity if available
    let embeddingSimilarity = 0;
    if (queryEmbedding && message.metadata?.embedding) {
      embeddingSimilarity = this.cosineSimilarity(queryEmbedding, message.metadata.embedding);
    }

    // Combine similarities
    const relevance = Math.max(textSimilarity, embeddingSimilarity);

    return relevance;
  }

  /**
   * Calculate importance-based priority
   */
  private calculateImportancePriority(message: Message): number {
    let priority = 0.5;

    // Boost for system messages
    if (message.role === 'system') {
      priority += 0.5;
    }

    // Boost for messages with sources
    if (message.metadata?.sources && message.metadata.sources.length > 0) {
      priority += 0.2;
    }

    // Boost for messages with high confidence
    if (message.metadata?.confidence && message.metadata.confidence > 0.8) {
      priority += 0.1;
    }

    // Boost for longer messages (likely more important)
    const length = message.content.length;
    if (length > 500) {
      priority += 0.1;
    }

    return Math.min(1.0, priority);
  }

  /**
   * Calculate custom priority (can be overridden)
   */
  private async calculateCustomPriority(
    message: Message,
    index: number,
    totalCount: number,
    query?: string
  ): Promise<number> {
    // Default to hybrid behavior
    return this.calculateMessagePriority(message, index, totalCount, query).then(p => p.priority);
  }

  // ========================================================================
  // Quality Assessment
  // ========================================================================

  /**
   * Calculate overall quality score
   */
  private async calculateQualityScore(messages: Message[], query?: string): Promise<number> {
    const metrics = await this.calculateQualityMetrics(messages, query);

    // Weighted average of metrics
    return (
      metrics.relevance * 0.4 +
      metrics.coherence * 0.3 +
      metrics.completeness * 0.2 +
      metrics.diversity * 0.1
    );
  }

  /**
   * Calculate detailed quality metrics
   */
  async calculateQualityMetrics(messages: Message[], query?: string): Promise<QualityMetrics> {
    // Relevance: How well messages match the query
    const relevance = query
      ? this.calculateAverageRelevance(messages, query)
      : 0.8;

    // Coherence: How well messages flow together
    const coherence = this.calculateCoherence(messages);

    // Completeness: Coverage of important information
    const completeness = this.calculateCompleteness(messages);

    // Diversity: Variety of content
    const diversity = this.calculateDiversity(messages);

    const overall =
      relevance * 0.4 +
      coherence * 0.3 +
      completeness * 0.2 +
      diversity * 0.1;

    return {
      relevance,
      coherence,
      completeness,
      diversity,
      overall,
    };
  }

  /**
   * Calculate average relevance to query
   */
  private calculateAverageRelevance(messages: Message[], query: string): number {
    let totalRelevance = 0;

    for (const message of messages) {
      totalRelevance += this.calculateTextSimilarity(message.content, query);
    }

    return messages.length > 0 ? totalRelevance / messages.length : 0;
  }

  /**
   * Calculate coherence of message sequence
   */
  private calculateCoherence(messages: Message[]): number {
    if (messages.length < 2) return 1.0;

    let coherenceScore = 0;

    for (let i = 1; i < messages.length; i++) {
      const prevMessage = messages[i - 1];
      const currMessage = messages[i];

      // Calculate semantic similarity
      const similarity = this.calculateTextSimilarity(prevMessage.content, currMessage.content);

      coherenceScore += similarity;
    }

    return coherenceScore / (messages.length - 1);
  }

  /**
   * Calculate completeness (coverage of key topics)
   */
  private calculateCompleteness(messages: Message[]): number {
    // Check for presence of key message types
    const hasSystem = messages.some(m => m.role === 'system');
    const hasUser = messages.some(m => m.role === 'user');
    const hasAssistant = messages.some(m => m.role === 'assistant');

    let score = 0;
    if (hasSystem) score += 0.3;
    if (hasUser) score += 0.4;
    if (hasAssistant) score += 0.3;

    return score;
  }

  /**
   * Calculate diversity of content
   */
  private calculateDiversity(messages: Message[]): number {
    if (messages.length < 2) return 1.0;

    const uniqueWords = new Set<string>();

    for (const message of messages) {
      const words = message.content.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 4) { // Only count longer words
          uniqueWords.add(word);
        }
      }
    }

    const totalWords = messages.reduce((sum, m) => sum + m.content.split(/\s+/).length, 0);

    return totalWords > 0 ? Math.min(1.0, uniqueWords.size / (totalWords * 0.3)) : 1.0;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Calculate coverage of original messages
   */
  private calculateCoverage(included: Message[], original: Message[]): number {
    const includedIds = new Set(included.map(m => m.id));
    const coveredTopics = new Set<string>();

    for (const message of original) {
      if (includedIds.has(message.id)) {
        // Extract key topics
        const topics = this.extractTopics(message.content);
        for (const topic of topics) {
          coveredTopics.add(topic);
        }
      }
    }

    const totalTopics = new Set<string>();
    for (const message of original) {
      const topics = this.extractTopics(message.content);
      for (const topic of topics) {
        totalTopics.add(topic);
      }
    }

    return totalTopics.size > 0 ? coveredTopics.size / totalTopics.size : 1.0;
  }

  /**
   * Extract topics from text
   */
  private extractTopics(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const topics: string[] = [];

    // Extract nouns and meaningful phrases
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (word.length > 5 && !this.isStopWord(word)) {
        topics.push(word);
      }
    }

    return Array.from(new Set(topics));
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we',
      'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
    ]);

    return stopWords.has(word);
  }

  /**
   * Calculate text similarity
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate cosine similarity between embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }

  /**
   * Count tokens in text
   */
  private async countTokens(text: string): Promise<number> {
    return Math.ceil(text.length / 4);
  }

  /**
   * Compress a message
   */
  private async compressMessage(message: Message): Promise<Message> {
    // Create a compressed version
    const sentences = message.content.split(/[.!?]+/);
    const keySentences: string[] = [];

    // Keep first and last sentences
    if (sentences.length > 0) {
      keySentences.push(sentences[0]);
    }

    if (sentences.length > 1) {
      keySentences.push(sentences[sentences.length - 1]);
    }

    const compressedContent = keySentences.join('. ');

    return {
      ...message,
      content: compressedContent,
      metadata: {
        ...message.metadata,
        compressed: true,
        tokens: await this.countTokens(compressedContent),
      },
    };
  }

  // ========================================================================
  // Dynamic Context Sizing
  // ========================================================================

  /**
   * Calculate optimal context size
   */
  async calculateOptimalSize(
    messages: Message[],
    query?: string
  ): Promise<number> {
    if (!this.config.dynamicSizing) {
      return this.config.maxTokens;
    }

    // Analyze query complexity
    const queryComplexity = query ? this.assessQueryComplexity(query) : 0.5;

    // Analyze message diversity
    const diversity = await this.calculateQualityMetrics(messages, query);

    // Calculate optimal size based on factors
    const baseSize = this.config.maxTokens;
    const complexityMultiplier = 0.5 + queryComplexity * 0.5;
    const diversityMultiplier = 0.5 + diversity.diversity * 0.5;

    const optimalSize = Math.floor(
      baseSize * complexityMultiplier * diversityMultiplier
    );

    return Math.min(optimalSize, this.config.maxTokens);
  }

  /**
   * Assess query complexity
   */
  private assessQueryComplexity(query: string): number {
    let complexity = 0.5;

    // Length factor
    const wordCount = query.split(/\s+/).length;
    complexity += Math.min(0.2, wordCount / 100);

    // Question words
    const questionWords = ['how', 'what', 'why', 'when', 'where', 'who', 'which'];
    if (questionWords.some(w => query.toLowerCase().includes(w))) {
      complexity += 0.1;
    }

    // Multiple clauses
    const clauseCount = (query.match(/,/g) || []).length;
    complexity += Math.min(0.1, clauseCount * 0.05);

    return Math.min(1.0, complexity);
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OptimizerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): OptimizerConfig {
    return { ...this.config };
  }

  /**
   * Get token budget
   */
  getTokenBudget(): {
    max: number;
    reserved: number;
    available: number;
  } {
    return {
      max: this.config.maxTokens,
      reserved: this.config.reservedTokens,
      available: this.config.maxTokens - this.config.reservedTokens,
    };
  }
}
