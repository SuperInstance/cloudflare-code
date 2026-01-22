/**
 * Behavioral Prediction Engine
 *
 * Analyzes user behavior patterns to predict and preload
 * content that users are likely to request next.
 */

import type {
  UserBehavior,
  AccessPattern,
  UserPreferences,
  PredictionResult,
  SequentialPattern,
  PredictionContext,
} from '../types';

export interface BehavioralConfig {
  maxHistorySize: number;
  maxPatterns: number;
  minSupport: number;
  minConfidence: number;
  predictionLimit: number;
  updateInterval: number;
}

/**
 * Behavioral Prediction Engine
 *
 * Tracks user behavior and uses sequential pattern mining
 * to predict next likely requests.
 */
export class BehavioralPredictionEngine {
  private kv: KVNamespace;
  private config: BehavioralConfig;
  private userBehaviors: Map<string, UserBehavior>;
  private sequentialPatterns: SequentialPattern[];
  private lastUpdate: number;

  constructor(kv: KVNamespace, config: Partial<BehavioralConfig> = {}) {
    this.kv = kv;
    this.config = {
      maxHistorySize: 1000,
      maxPatterns: 100,
      minSupport: 3,
      minConfidence: 0.3,
      predictionLimit: 10,
      updateInterval: 60000, // 1 minute
      ...config,
    };

    this.userBehaviors = new Map();
    this.sequentialPatterns = [];
    this.lastUpdate = Date.now();
  }

  /**
   * Record an access event for a user
   */
  async recordAccess(
    userId: string | undefined,
    sessionId: string,
    pattern: AccessPattern
  ): Promise<void> {
    const key = userId || `session:${sessionId}`;

    // Get or create user behavior
    let behavior = this.userBehaviors.get(key);
    if (!behavior) {
      behavior = {
        userId,
        sessionId,
        history: [],
        preferences: this.createDefaultPreferences(),
        predictions: [],
      };
      this.userBehaviors.set(key, behavior);
    }

    // Add to history
    behavior.history.push(pattern);

    // Trim history if needed
    if (behavior.history.length > this.config.maxHistorySize) {
      behavior.history = behavior.history.slice(-this.config.maxHistorySize);
    }

    // Update preferences
    this.updatePreferences(behavior, pattern);

    // Update periodically
    if (Date.now() - this.lastUpdate > this.config.updateInterval) {
      await this.updatePatterns();
      this.lastUpdate = Date.now();
    }

    // Persist
    await this.persistBehavior(key);
  }

  /**
   * Get predictions for a user
   */
  async getPredictions(
    userId: string | undefined,
    sessionId: string,
    context: PredictionContext
  ): Promise<PredictionResult[]> {
    const key = userId || `session:${sessionId}`;
    const behavior = this.userBehaviors.get(key);

    if (!behavior || behavior.history.length === 0) {
      return [];
    }

    const predictions: PredictionResult[] = [];

    // Get recent access history
    const recentHistory = behavior.history.slice(-10);
    const lastUrl = recentHistory[recentHistory.length - 1]?.url;

    // Find matching sequential patterns
    for (const pattern of this.sequentialPatterns) {
      // Check if recent history matches pattern prefix
      const prefix = pattern.sequence.slice(0, -1);
      if (this.matchesPrefix(recentHistory.map(h => h.url), prefix)) {
        const nextUrl = pattern.sequence[pattern.sequence.length - 1];

        predictions.push({
          url: nextUrl,
          probability: pattern.confidence,
          reason: 'sequential-pattern',
          confidence: pattern.confidence * pattern.lift,
          category: this.categorizeUrl(nextUrl),
          priority: Math.round(pattern.confidence * 100),
        });
      }
    }

    // Add frequency-based predictions
    const urlFrequency = this.calculateUrlFrequency(behavior.history);
    for (const [url, frequency] of Object.entries(urlFrequency)) {
      if (url !== lastUrl && !predictions.find(p => p.url === url)) {
        predictions.push({
          url,
          probability: frequency,
          reason: 'frequency-based',
          confidence: frequency,
          category: this.categorizeUrl(url),
          priority: Math.round(frequency * 100),
        });
      }
    }

    // Sort by priority and limit
    predictions.sort((a, b) => b.priority - a.priority);
    return predictions.slice(0, this.config.predictionLimit);
  }

  /**
   * Update sequential patterns from all user behaviors
   */
  private async updatePatterns(): Promise<void> {
    const allSequences: string[][] = [];

    // Extract sequences from all user behaviors
    for (const behavior of this.userBehaviors.values()) {
      const urls = behavior.history.map(h => h.url);

      // Extract sequences of length 2-5
      for (let length = 2; length <= Math.min(5, urls.length); length++) {
        for (let i = 0; i <= urls.length - length; i++) {
          allSequences.push(urls.slice(i, i + length));
        }
      }
    }

    // Count pattern support
    const patternCounts = new Map<string, { count: number; sequence: string[] }>();

    for (const sequence of allSequences) {
      const key = sequence.join('->');
      const existing = patternCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        patternCounts.set(key, { count: 1, sequence });
      }
    }

    // Filter by minimum support
    const filteredPatterns = Array.from(patternCounts.values())
      .filter(p => p.count >= this.config.minSupport);

    // Calculate confidence and lift
    const patterns: SequentialPattern[] = [];

    for (const pattern of filteredPatterns) {
      const sequence = pattern.sequence;
      const prefix = sequence.slice(0, -1);
      const consequent = sequence[sequence.length - 1];

      // Calculate support
      const support = pattern.count;

      // Calculate confidence: P(A->B) = count(A,B) / count(A)
      const prefixKey = prefix.join('->');
      const prefixCount = patternCounts.get(prefixKey)?.count || 1;
      const confidence = support / prefixCount;

      // Calculate lift: P(B|A) / P(B)
      const consequentCount = Array.from(patternCounts.values())
        .filter(p => p.sequence[p.sequence.length - 1] === consequent)
        .reduce((sum, p) => sum + p.count, 0);
      const consequentProbability = consequentCount / allSequences.length;
      const lift = consequentProbability > 0 ? confidence / consequentProbability : 1;

      patterns.push({
        sequence,
        support,
        confidence,
        lift,
        lastSeen: Date.now(),
      });
    }

    // Sort by confidence and limit
    patterns.sort((a, b) => b.confidence - a.confidence);
    this.sequentialPatterns = patterns.slice(0, this.config.maxPatterns);

    // Persist patterns
    await this.persistPatterns();
  }

  /**
   * Update user preferences based on access pattern
   */
  private updatePreferences(behavior: UserBehavior, pattern: AccessPattern): void {
    // Update category preferences
    const category = this.categorizeUrl(pattern.url);
    const catPref = behavior.preferences.preferredCategories.find(c => c === category);
    if (!catPref) {
      behavior.preferences.preferredCategories.push(category);
    }

    // Update path preferences
    const path = this.extractPath(pattern.url);
    if (!behavior.preferences.preferredPaths.includes(path)) {
      behavior.preferences.preferredPaths.push(path);
    }

    // Update time preferences
    const hour = new Date(pattern.timestamp).getHours();
    behavior.preferences.timePreferences[hour] = (behavior.preferences.timePreferences[hour] || 0) + 1;
  }

  /**
   * Calculate URL frequency from access history
   */
  private calculateUrlFrequency(history: AccessPattern[]): Record<string, number> {
    const frequency: Record<string, number> = {};
    const total = history.length;

    for (const pattern of history) {
      frequency[pattern.url] = (frequency[pattern.url] || 0) + 1;
    }

    // Normalize to 0-1
    for (const url in frequency) {
      frequency[url] = frequency[url] / total;
    }

    return frequency;
  }

  /**
   * Check if history matches pattern prefix
   */
  private matchesPrefix(history: string[], prefix: string[]): boolean {
    if (history.length < prefix.length) {
      return false;
    }

    const recentHistory = history.slice(-prefix.length);
    return recentHistory.every((url, i) => url === prefix[i]);
  }

  /**
   * Categorize a URL
   */
  private categorizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      if (path.startsWith('/api/')) return 'api';
      if (path.startsWith('/docs/')) return 'documentation';
      if (path.startsWith('/blog/')) return 'blog';
      if (path.startsWith('/user/')) return 'user';
      if (path.includes('search')) return 'search';
      if (path.includes('dashboard')) return 'dashboard';
      return 'other';
    } catch {
      return 'other';
    }
  }

  /**
   * Extract path from URL
   */
  private extractPath(url: string): string {
    try {
      const urlObj = new URL(url);
      // Get first two path segments
      const segments = urlObj.pathname.split('/').filter(Boolean).slice(0, 2);
      return '/' + segments.join('/');
    } catch {
      return '/';
    }
  }

  /**
   * Create default user preferences
   */
  private createDefaultPreferences(): UserPreferences {
    return {
      preferredCategories: [],
      preferredPaths: [],
      timePreferences: {},
      devicePreferences: {},
    };
  }

  /**
   * Persist user behavior to KV
   */
  private async persistBehavior(key: string): Promise<void> {
    const behavior = this.userBehaviors.get(key);
    if (!behavior) return;

    // Only keep recent history in KV
    const data = {
      ...behavior,
      history: behavior.history.slice(-100),
    };

    await this.kv.put(`behavior:${key}`, JSON.stringify(data), {
      expirationTtl: 86400 * 7, // 7 days
    });
  }

  /**
   * Persist patterns to KV
   */
  private async persistPatterns(): Promise<void> {
    await this.kv.put('behavioral:patterns', JSON.stringify(this.sequentialPatterns), {
      expirationTtl: 86400, // 24 hours
    });
  }

  /**
   * Load behavior from KV
   */
  async loadBehavior(userId?: string, sessionId?: string): Promise<void> {
    if (!userId && !sessionId) return;

    const key = userId || `session:${sessionId}`;
    const data = await this.kv.get(`behavior:${key}`, 'json');

    if (data && typeof data === 'object') {
      this.userBehaviors.set(key, data as UserBehavior);
    }
  }

  /**
   * Load patterns from KV
   */
  async loadPatterns(): Promise<void> {
    const data = await this.kv.get('behavioral:patterns', 'json');

    if (data && Array.isArray(data)) {
      this.sequentialPatterns = data as SequentialPattern[];
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalUsers: this.userBehaviors.size,
      totalPatterns: this.sequentialPatterns.length,
      lastUpdate: this.lastUpdate,
      avgHistorySize: Array.from(this.userBehaviors.values())
        .reduce((sum, b) => sum + b.history.length, 0) / Math.max(this.userBehaviors.size, 1),
    };
  }
}

/**
 * Create a behavioral prediction engine
 */
export function createBehavioralPredictionEngine(
  kv: KVNamespace,
  config?: Partial<BehavioralConfig>
): BehavioralPredictionEngine {
  return new BehavioralPredictionEngine(kv, config);
}
