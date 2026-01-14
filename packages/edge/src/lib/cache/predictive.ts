/**
 * Predictive Cache Prefetching
 *
 * Uses ML heuristics to predict and prefetch likely future queries.
 * Implements multiple prediction strategies:
 * - Sequential pattern mining
 * - Markov chain prediction
 * - Collaborative filtering
 * - Context-aware prediction
 *
 * Goals:
 * - Prefetch with >70% accuracy
 * - Reduce cache misses by 40%
 * - Minimize unnecessary prefetches
 * - Adapt to changing patterns
 *
 * Architecture:
 * 1. Feature Extraction: Extract features from queries
 * 2. Pattern Mining: Find sequential patterns
 * 3. Prediction: Predict next queries
 * 4. Prefetch: Load predicted queries into cache
 * 5. Evaluation: Measure prediction accuracy
 */

import type { ChatResponse } from '@claudeflare/shared';
import type { SemanticCache } from './semantic';

export interface QueryFeatures {
  query: string;
  normalized: string;
  length: number;
  tokens: string[];
  category: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface SequentialPattern {
  sequence: string[];
  support: number;
  confidence: number;
  lastSeen: number;
}

export interface MarkovState {
  state: string;
  transitions: Map<string, number>;
  totalTransitions: number;
}

export interface PredictionContext {
  recentQueries: string[];
  sessionId: string;
  userId?: string;
  language?: string;
  framework?: string;
  timeOfDay: number;
  dayOfWeek: number;
}

export interface PredictionResult {
  query: string;
  confidence: number;
  reason: string;
  features: QueryFeatures;
}

export interface PredictiveCacheOptions {
  /**
   * Enable predictive prefetching
   * @default true
   */
  enablePrefetch?: boolean;

  /**
   * Minimum confidence for prefetching
   * @default 0.6
   */
  minConfidence?: number;

  /**
   * Maximum number of predictions to prefetch
   * @default 5
   */
  maxPrefetchCount?: number;

  /**
   * Minimum pattern support
   * @default 3
   */
  minPatternSupport?: number;

  /**
   * Maximum pattern length
   * @default 5
   */
  maxPatternLength?: number;

  /**
   * Markov chain order (1 = first-order, 2 = second-order)
   * @default 1
   */
  markovOrder?: number;

  /**
   * Enable collaborative filtering
   * @default true
   */
  enableCollaborative?: boolean;

  /**
   * Semantic cache for prefetching
   */
  semanticCache?: SemanticCache;

  /**
   * Provider for generating responses
   */
  provider?: (query: string, metadata: Record<string, unknown>) => Promise<ChatResponse>;

  /**
   * Callback for prefetch completion
   */
  onPrefetch?: (query: string, success: boolean) => void;
}

export interface PredictiveStats {
  predictionsMade: number;
  predictionsCorrect: number;
  predictionsIncorrect: number;
  accuracy: number;
  prefetchesAttempted: number;
  prefetchesSuccessful: number;
  prefetchesUsed: number;
  prefetchHitRate: number;
  avgConfidence: number;
  patternsDiscovered: number;
  lastUpdateTime: number;
}

/**
 * Predictive Cache Manager
 *
 * Implements ML-based predictive prefetching.
 */
export class PredictiveCacheManager {
  private options: Required<PredictiveCacheOptions>;
  private queryHistory: Map<string, QueryFeatures[]>;
  private sequentialPatterns: SequentialPattern[];
  private markovChain: Map<string, MarkovState>;
  private userProfiles: Map<string, string[]>; // userId -> query categories
  private stats: PredictiveStats;
  private lastUpdate: number;

  constructor(options: PredictiveCacheOptions = {}) {
    this.options = {
      enablePrefetch: options.enablePrefetch ?? true,
      minConfidence: options.minConfidence ?? 0.6,
      maxPrefetchCount: options.maxPrefetchCount ?? 5,
      minPatternSupport: options.minPatternSupport ?? 3,
      maxPatternLength: options.maxPatternLength ?? 5,
      markovOrder: options.markovOrder ?? 1,
      enableCollaborative: options.enableCollaborative ?? true,
      semanticCache: options.semanticCache!,
      provider: options.provider!,
      onPrefetch: options.onPrefetch!,
    };

    this.queryHistory = new Map();
    this.sequentialPatterns = [];
    this.markovChain = new Map();
    this.userProfiles = new Map();

    this.stats = {
      predictionsMade: 0,
      predictionsCorrect: 0,
      predictionsIncorrect: 0,
      accuracy: 0,
      prefetchesAttempted: 0,
      prefetchesSuccessful: 0,
      prefetchesUsed: 0,
      prefetchHitRate: 0,
      avgConfidence: 0,
      patternsDiscovered: 0,
      lastUpdateTime: Date.now(),
    };

    this.lastUpdate = Date.now();
  }

  /**
   * Record query for predictive modeling
   *
   * @param query - Query that was executed
   * @param context - Prediction context
   */
  recordQuery(query: string, context: PredictionContext): void {
    const features = this.extractFeatures(query, context);

    // Add to history
    let history = this.queryHistory.get(context.sessionId);
    if (!history) {
      history = [];
      this.queryHistory.set(context.sessionId, history);
    }

    history.push(features);

    // Limit history size
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }

    // Update user profile
    if (context.userId) {
      this.updateUserProfile(context.userId, features);
    }

    // Update Markov chain
    this.updateMarkovChain(history);

    // Update patterns periodically
    if (history.length % 10 === 0) {
      this.updateSequentialPatterns();
    }
  }

  /**
   * Predict next queries based on context
   *
   * @param context - Prediction context
   * @returns Predicted queries with confidence scores
   */
  predictNextQueries(context: PredictionContext): PredictionResult[] {
    const predictions: PredictionResult[] = [];

    // Get recent queries
    const recentQueries = context.recentQueries
      .map(q => this.normalizeQuery(q))
      .slice(-this.options.maxPatternLength);

    if (recentQueries.length === 0) {
      return predictions;
    }

    // Strategy 1: Sequential pattern mining
    const patternPredictions = this.predictBySequentialPatterns(recentQueries);
    predictions.push(...patternPredictions);

    // Strategy 2: Markov chain prediction
    const markovPredictions = this.predictByMarkovChain(recentQueries);
    predictions.push(...markovPredictions);

    // Strategy 3: Collaborative filtering
    if (this.options.enableCollaborative && context.userId) {
      const collaborativePredictions = this.predictByCollaborativeFiltering(context);
      predictions.push(...collaborativePredictions);
    }

    // Strategy 4: Context-aware prediction
    const contextPredictions = this.predictByContext(context);
    predictions.push(...contextPredictions);

    // Merge and rank predictions
    const merged = this.mergePredictions(predictions);

    // Filter by confidence
    const filtered = merged.filter(p => p.confidence >= this.options.minConfidence);

    // Return top predictions
    return filtered.slice(0, this.options.maxPrefetchCount);
  }

  /**
   * Prefetch predicted queries
   *
   * @param context - Prediction context
   * @returns Number of queries prefetched
   */
  async prefetch(context: PredictionContext): Promise<number> {
    if (!this.options.enablePrefetch || !this.options.provider || !this.options.semanticCache) {
      return 0;
    }

    const predictions = this.predictNextQueries(context);

    let prefetched = 0;
    const totalConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0);
    this.stats.avgConfidence = predictions.length > 0 ? totalConfidence / predictions.length : 0;

    for (const prediction of predictions) {
      if (prefetched >= this.options.maxPrefetchCount) {
        break;
      }

      try {
        // Check if already in cache
        const cacheResult = await this.options.semanticCache.check(
          prediction.query,
          prediction.features.metadata
        );

        if (!cacheResult.hit) {
          this.stats.prefetchesAttempted++;

          // Generate and cache response
          const response = await this.options.provider(
            prediction.query,
            prediction.features.metadata
          );

          await this.options.semanticCache.store(
            prediction.query,
            response,
            prediction.features.metadata
          );

          this.stats.prefetchesSuccessful++;
          prefetched++;

          if (this.options.onPrefetch) {
            this.options.onPrefetch(prediction.query, true);
          }

          console.log(`Prefetched: ${prediction.query} (${(prediction.confidence * 100).toFixed(1)}% confidence)`);
        }
      } catch (error) {
        console.error(`Failed to prefetch: ${prediction.query}`, error);

        if (this.options.onPrefetch) {
          this.options.onPrefetch(prediction.query, false);
        }
      }
    }

    return prefetched;
  }

  /**
   * Record that a prefetch was used (hit)
   *
   * @param query - Query that was prefetched and used
   */
  recordPrefetchHit(query: string): void {
    this.stats.prefetchesUsed++;
    this.stats.predictionsCorrect++;
    this.updateAccuracy();
    this.updatePrefetchHitRate();
  }

  /**
   * Record that a prefetch was not used (miss)
   *
   * @param query - Query that was prefetched but not used
   */
  recordPrefetchMiss(query: string): void {
    this.stats.predictionsIncorrect++;
    this.updateAccuracy();
  }

  /**
   * Get prediction statistics
   */
  getStats(): PredictiveStats {
    return { ...this.stats };
  }

  /**
   * Clear all learned patterns
   */
  clearPatterns(): void {
    this.queryHistory.clear();
    this.sequentialPatterns = [];
    this.markovChain.clear();
    this.userProfiles.clear();

    this.stats.patternsDiscovered = 0;
    this.lastUpdate = Date.now();
  }

  /**
   * Extract features from query
   *
   * @private
   */
  private extractFeatures(query: string, context: PredictionContext): QueryFeatures {
    const normalized = this.normalizeQuery(query);
    const tokens = this.tokenize(query);
    const category = this.categorizeQuery(tokens, context);

    return {
      query,
      normalized,
      length: query.length,
      tokens,
      category,
      timestamp: Date.now(),
      metadata: {
        sessionId: context.sessionId,
        userId: context.userId,
        language: context.language,
        framework: context.framework,
        timeOfDay: context.timeOfDay,
        dayOfWeek: context.dayOfWeek,
      },
    };
  }

  /**
   * Normalize query
   *
   * @private
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, 200);
  }

  /**
   * Tokenize query
   *
   * @private
   */
  private tokenize(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

  /**
   * Categorize query
   *
   * @private
   */
  private categorizeQuery(tokens: string[], context: PredictionContext): string {
    // Simple keyword-based categorization
    const codeKeywords = ['function', 'class', 'variable', 'api', 'endpoint', 'route', 'component'];
    const debugKeywords = ['error', 'bug', 'fix', 'debug', 'issue', 'problem'];
    const docKeywords = ['explain', 'document', 'what', 'how', 'why', 'describe'];
    const refactorKeywords = ['refactor', 'optimize', 'improve', 'clean', 'restructure'];

    const tokensSet = new Set(tokens);

    for (const keyword of codeKeywords) {
      if (tokensSet.has(keyword)) {
        return 'code-generation';
      }
    }

    for (const keyword of debugKeywords) {
      if (tokensSet.has(keyword)) {
        return 'debugging';
      }
    }

    for (const keyword of docKeywords) {
      if (tokensSet.has(keyword)) {
        return 'documentation';
      }
    }

    for (const keyword of refactorKeywords) {
      if (tokensSet.has(keyword)) {
        return 'refactoring';
      }
    }

    return 'general';
  }

  /**
   * Update user profile
   *
   * @private
   */
  private updateUserProfile(userId: string, features: QueryFeatures): void {
    let profile = this.userProfiles.get(userId);
    if (!profile) {
      profile = [];
      this.userProfiles.set(userId, profile);
    }

    profile.push(features.category);

    // Keep last 100 categories
    if (profile.length > 100) {
      profile.splice(0, profile.length - 100);
    }
  }

  /**
   * Update Markov chain
   *
   * @private
   */
  private updateMarkovChain(history: QueryFeatures[]): void {
    if (history.length < 2) {
      return;
    }

    for (let i = 0; i < history.length - 1; i++) {
      const currentState = history[i].normalized;
      const nextState = history[i + 1].normalized;

      let state = this.markovChain.get(currentState);
      if (!state) {
        state = {
          state: currentState,
          transitions: new Map(),
          totalTransitions: 0,
        };
        this.markovChain.set(currentState, state);
      }

      const count = state.transitions.get(nextState) ?? 0;
      state.transitions.set(nextState, count + 1);
      state.totalTransitions++;
    }
  }

  /**
   * Update sequential patterns
   *
   * @private
   */
  private updateSequentialPatterns(): void {
    const patterns: SequentialPattern[] = [];

    // Mine patterns from all histories
    for (const [sessionId, history] of this.queryHistory.entries()) {
      const sequences = this.mineSequentialPatterns(
        history.map(h => h.normalized),
        this.options.minPatternSupport,
        this.options.maxPatternLength
      );

      patterns.push(...sequences);
    }

    // Merge and rank patterns
    this.sequentialPatterns = this.mergePatterns(patterns);
    this.stats.patternsDiscovered = this.sequentialPatterns.length;
    this.lastUpdate = Date.now();
  }

  /**
   * Mine sequential patterns
   *
   * @private
   */
  private mineSequentialPatterns(
    sequence: string[],
    minSupport: number,
    maxLength: number
  ): SequentialPattern[] {
    const patterns: SequentialPattern[] = [];

    // Count all subsequences
    const patternCounts = new Map<string, { count: number; lastSeen: number }>();

    for (let length = 2; length <= Math.min(maxLength, sequence.length); length++) {
      for (let i = 0; i <= sequence.length - length; i++) {
        const subsequence = sequence.slice(i, i + length);
        const key = subsequence.join('->');

        const existing = patternCounts.get(key);
        if (existing) {
          existing.count++;
          existing.lastSeen = Date.now();
        } else {
          patternCounts.set(key, { count: 1, lastSeen: Date.now() });
        }
      }
    }

    // Convert to patterns
    for (const [key, data] of patternCounts.entries()) {
      if (data.count >= minSupport) {
        const sequence = key.split('->');
        patterns.push({
          sequence,
          support: data.count,
          confidence: data.count / sequence.length, // Simple confidence metric
          lastSeen: data.lastSeen,
        });
      }
    }

    return patterns;
  }

  /**
   * Merge patterns
   *
   * @private
   */
  private mergePatterns(patterns: SequentialPattern[]): SequentialPattern[] {
    const merged = new Map<string, SequentialPattern>();

    for (const pattern of patterns) {
      const key = pattern.sequence.join('->');

      const existing = merged.get(key);
      if (existing) {
        existing.support += pattern.support;
        existing.confidence = Math.max(existing.confidence, pattern.confidence);
        existing.lastSeen = Math.max(existing.lastSeen, pattern.lastSeen);
      } else {
        merged.set(key, { ...pattern });
      }
    }

    // Sort by support and confidence
    return Array.from(merged.values()).sort((a, b) => {
      if (b.support !== a.support) {
        return b.support - a.support;
      }
      return b.confidence - a.confidence;
    });
  }

  /**
   * Predict by sequential patterns
   *
   * @private
   */
  private predictBySequentialPatterns(recentQueries: string[]): PredictionResult[] {
    const predictions: PredictionResult[] = [];

    for (const pattern of this.sequentialPatterns) {
      // Check if recent queries match pattern prefix
      const prefixLength = Math.min(recentQueries.length, pattern.sequence.length - 1);
      const prefix = pattern.sequence.slice(0, prefixLength);
      const recent = recentQueries.slice(-prefixLength);

      let matches = true;
      for (let i = 0; i < prefix.length; i++) {
        if (prefix[i] !== recent[i]) {
          matches = false;
          break;
        }
      }

      if (matches && pattern.sequence.length > prefixLength) {
        const nextQuery = pattern.sequence[prefixLength];

        predictions.push({
          query: nextQuery,
          confidence: Math.min(pattern.confidence, 0.9),
          reason: `sequential pattern (support: ${pattern.support})`,
          features: {
            query: nextQuery,
            normalized: nextQuery,
            length: nextQuery.length,
            tokens: this.tokenize(nextQuery),
            category: this.categorizeQuery(this.tokenize(nextQuery), {}),
            timestamp: Date.now(),
            metadata: {},
          },
        });
      }
    }

    return predictions;
  }

  /**
   * Predict by Markov chain
   *
   * @private
   */
  private predictByMarkovChain(recentQueries: string[]): PredictionResult[] {
    const predictions: PredictionResult[] = [];

    if (recentQueries.length === 0) {
      return predictions;
    }

    const lastQuery = recentQueries[recentQueries.length - 1];
    const state = this.markovChain.get(lastQuery);

    if (!state) {
      return predictions;
    }

    // Get top transitions
    const transitions = Array.from(state.transitions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [nextQuery, count] of transitions) {
      const confidence = count / state.totalTransitions;

      predictions.push({
        query: nextQuery,
        confidence,
        reason: `markov transition (${count}/${state.totalTransitions})`,
        features: {
          query: nextQuery,
          normalized: nextQuery,
          length: nextQuery.length,
          tokens: this.tokenize(nextQuery),
          category: this.categorizeQuery(this.tokenize(nextQuery), {}),
          timestamp: Date.now(),
          metadata: {},
        },
      });
    }

    return predictions;
  }

  /**
   * Predict by collaborative filtering
   *
   * @private
   */
  private predictByCollaborativeFiltering(context: PredictionContext): PredictionResult[] {
    const predictions: PredictionResult[] = [];

    if (!context.userId) {
      return predictions;
    }

    const userProfile = this.userProfiles.get(context.userId);
    if (!userProfile || userProfile.length === 0) {
      return predictions;
    }

    // Find similar users
    const similarUsers = this.findSimilarUsers(userProfile);

    // Get their recent queries
    for (const [similarUserId, similarProfile] of similarUsers) {
      const history = this.queryHistory.get(similarUserId);
      if (!history) continue;

      // Get recent queries from similar users
      const recentFromSimilar = history.slice(-10);

      for (const features of recentFromSimilar) {
        predictions.push({
          query: features.query,
          confidence: 0.5, // Base confidence for collaborative filtering
          reason: `similar user: ${similarUserId}`,
          features,
        });
      }
    }

    return predictions;
  }

  /**
   * Find similar users
   *
   * @private
   */
  private findSimilarUsers(profile: string[]): Array<[string, string[]]> {
    const similarUsers: Array<[string, string[], number]> = [];

    for (const [userId, userProfile] of this.userProfiles.entries()) {
      if (userProfile === profile) continue;

      // Calculate Jaccard similarity
      const set1 = new Set(profile);
      const set2 = new Set(userProfile);

      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);

      const similarity = intersection.size / union.size;

      if (similarity > 0.3) {
        similarUsers.push([userId, userProfile, similarity]);
      }
    }

    // Sort by similarity
    similarUsers.sort((a, b) => b[2] - a[2]);

    return similarUsers.slice(0, 5).map(([userId, profile]) => [userId, profile]);
  }

  /**
   * Predict by context
   *
   * @private
   */
  private predictByContext(context: PredictionContext): PredictionResult[] {
    const predictions: PredictionResult[] = [];

    // Time-based predictions
    for (const [sessionId, history] of this.queryHistory.entries()) {
      for (const features of history) {
        const metadata = features.metadata as {
          timeOfDay?: number;
          dayOfWeek?: number;
        };

        if (metadata.timeOfDay === context.timeOfDay &&
            metadata.dayOfWeek === context.dayOfWeek) {
          predictions.push({
            query: features.query,
            confidence: 0.4,
            reason: 'time-based pattern',
            features,
          });
        }
      }
    }

    return predictions;
  }

  /**
   * Merge predictions
   *
   * @private
   */
  private mergePredictions(predictions: PredictionResult[]): PredictionResult[] {
    const merged = new Map<string, PredictionResult>();

    for (const prediction of predictions) {
      const existing = merged.get(prediction.query);

      if (existing) {
        // Combine confidences (weighted average)
        const combinedConfidence = Math.max(existing.confidence, prediction.confidence);
        const combinedReason = `${existing.reason}, ${prediction.reason}`;

        merged.set(prediction.query, {
          ...existing,
          confidence: combinedConfidence,
          reason: combinedReason,
        });
      } else {
        merged.set(prediction.query, prediction);
      }
    }

    // Sort by confidence
    return Array.from(merged.values()).sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Update accuracy
   *
   * @private
   */
  private updateAccuracy(): void {
    const total = this.stats.predictionsCorrect + this.stats.predictionsIncorrect;
    this.stats.accuracy = total > 0 ? (this.stats.predictionsCorrect / total) * 100 : 0;
  }

  /**
   * Update prefetch hit rate
   *
   * @private
   */
  private updatePrefetchHitRate(): void {
    this.stats.prefetchHitRate = this.stats.prefetchesSuccessful > 0
      ? (this.stats.prefetchesUsed / this.stats.prefetchesSuccessful) * 100
      : 0;
  }
}

/**
 * Create a predictive cache manager
 */
export function createPredictiveCacheManager(
  options?: PredictiveCacheOptions
): PredictiveCacheManager {
  return new PredictiveCacheManager(options);
}

/**
 * Default predictive cache manager
 */
export const defaultPredictiveCacheManager = new PredictiveCacheManager();
