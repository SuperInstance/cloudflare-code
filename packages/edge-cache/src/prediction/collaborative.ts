/**
 * Collaborative Filtering Prediction Engine
 *
 * Uses collaborative filtering to predict content based on
 * similar users' behavior patterns.
 */

import type {
  CollaborativeFilteringResult,
  AccessPattern,
  PredictionResult,
  UserPreferences,
} from '../types';

export interface CollaborativeConfig {
  minSimilarity: number;
  maxSimilarUsers: number;
  predictionLimit: number;
  updateInterval: number;
  cacheTtl: number;
}

interface UserProfile {
  userId?: string;
  sessionId: string;
  preferences: UserPreferences;
  history: AccessPattern[];
  vector: Map<string, number>; // URL -> normalized frequency
  lastUpdate: number;
}

interface SimilarityScore {
  userId: string;
  similarity: number;
  commonUrls: number;
}

/**
 * Collaborative Filtering Prediction Engine
 *
 * Finds similar users and recommends content they've accessed.
 */
export class CollaborativeFilteringEngine {
  private kv: KVNamespace;
  private config: CollaborativeConfig;
  private userProfiles: Map<string, UserProfile>;
  private similarityCache: Map<string, SimilarityScore[]>;
  private lastUpdate: number;

  constructor(kv: KVNamespace, config: Partial<CollaborativeConfig> = {}) {
    this.kv = kv;
    this.config = {
      minSimilarity: 0.3,
      maxSimilarUsers: 20,
      predictionLimit: 10,
      updateInterval: 300000, // 5 minutes
      cacheTtl: 3600, // 1 hour
      ...config,
    };

    this.userProfiles = new Map();
    this.similarityCache = new Map();
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

    // Get or create user profile
    let profile = this.userProfiles.get(key);
    if (!profile) {
      profile = {
        userId,
        sessionId,
        preferences: this.createDefaultPreferences(),
        history: [],
        vector: new Map(),
        lastUpdate: Date.now(),
      };
      this.userProfiles.set(key, profile);
    }

    // Add to history
    profile.history.push(pattern);

    // Trim history
    if (profile.history.length > 500) {
      profile.history = profile.history.slice(-500);
    }

    // Update vector
    const urlCount = profile.vector.get(pattern.url) || 0;
    profile.vector.set(pattern.url, urlCount + 1);

    // Normalize vector
    this.normalizeVector(profile);

    profile.lastUpdate = Date.now();

    // Invalidate similarity cache
    this.similarityCache.delete(key);

    // Update periodically
    if (Date.now() - this.lastUpdate > this.config.updateInterval) {
      await this.updateAllSimilarities();
      this.lastUpdate = Date.now();
    }

    // Persist
    await this.persistProfile(key);
  }

  /**
   * Get predictions based on collaborative filtering
   */
  async getPredictions(
    userId: string | undefined,
    sessionId: string,
    currentUrl?: string
  ): Promise<PredictionResult[]> {
    const key = userId || `session:${sessionId}`;
    const profile = this.userProfiles.get(key);

    if (!profile || profile.history.length < 5) {
      return []; // Not enough data
    }

    // Get similar users
    let similarUsers = this.similarityCache.get(key);
    if (!similarUsers) {
      similarUsers = await this.findSimilarUsers(key);
      this.similarityCache.set(key, similarUsers);
    }

    if (similarUsers.length === 0) {
      return [];
    }

    // Collect recommendations from similar users
    const recommendations = new Map<string, { score: number; sources: string[] }>();

    for (const similar of similarUsers.slice(0, this.config.maxSimilarUsers)) {
      const similarProfile = this.userProfiles.get(similar.userId);
      if (!similarProfile) continue;

      // For each URL in similar user's history
      for (const [url, frequency] of similarProfile.vector) {
        // Skip if current user already accessed
        if (profile.vector.has(url)) continue;

        // Skip if it's the current URL
        if (url === currentUrl) continue;

        // Weight by similarity and frequency
        const score = similar.similarity * frequency;
        const existing = recommendations.get(url);

        if (existing) {
          existing.score += score;
          existing.sources.push(similar.userId);
        } else {
          recommendations.set(url, { score, sources: [similar.userId] });
        }
      }
    }

    // Convert to predictions
    const predictions: PredictionResult[] = [];

    for (const [url, data] of recommendations.entries()) {
      predictions.push({
        url,
        probability: Math.min(data.score, 1),
        reason: 'collaborative-filtering',
        confidence: data.score,
        category: this.categorizeUrl(url),
        priority: Math.round(data.score * 100),
      });
    }

    // Sort by priority and limit
    predictions.sort((a, b) => b.priority - a.priority);
    return predictions.slice(0, this.config.predictionLimit);
  }

  /**
   * Find similar users using cosine similarity
   */
  private async findSimilarUsers(targetKey: string): Promise<SimilarityScore[]> {
    const targetProfile = this.userProfiles.get(targetKey);
    if (!targetProfile) return [];

    const similarities: SimilarityScore[] = [];

    for (const [key, profile] of this.userProfiles.entries()) {
      if (key === targetKey) continue;

      const similarity = this.calculateCosineSimilarity(targetProfile.vector, profile.vector);

      if (similarity >= this.config.minSimilarity) {
        const commonUrls = this.countCommonUrls(targetProfile.vector, profile.vector);

        similarities.push({
          userId: key,
          similarity,
          commonUrls,
        });
      }
    }

    // Sort by similarity
    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities;
  }

  /**
   * Update similarities for all users
   */
  private async updateAllSimilarities(): Promise<void> {
    this.similarityCache.clear();

    for (const key of this.userProfiles.keys()) {
      const similarUsers = await this.findSimilarUsers(key);
      this.similarityCache.set(key, similarUsers);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(
    vec1: Map<string, number>,
    vec2: Map<string, number>
  ): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    // Calculate dot product and norms
    for (const [url, freq1] of vec1) {
      const freq2 = vec2.get(url) || 0;
      dotProduct += freq1 * freq2;
      norm1 += freq1 * freq1;
    }

    for (const freq2 of vec2.values()) {
      norm2 += freq2 * freq2;
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Count common URLs between two vectors
   */
  private countCommonUrls(vec1: Map<string, number>, vec2: Map<string, number>): number {
    let count = 0;
    for (const url of vec1.keys()) {
      if (vec2.has(url)) count++;
    }
    return count;
  }

  /**
   * Normalize a user vector
   */
  private normalizeVector(profile: UserProfile): void {
    const max = Math.max(...profile.vector.values());
    if (max === 0) return;

    for (const [url, freq] of profile.vector) {
      profile.vector.set(url, freq / max);
    }
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
      return 'other';
    } catch {
      return 'other';
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
   * Persist user profile to KV
   */
  private async persistProfile(key: string): Promise<void> {
    const profile = this.userProfiles.get(key);
    if (!profile) return;

    const data = {
      userId: profile.userId,
      sessionId: profile.sessionId,
      preferences: profile.preferences,
      history: profile.history.slice(-100),
      vector: Array.from(profile.vector.entries()),
      lastUpdate: profile.lastUpdate,
    };

    await this.kv.put(`collaborative:${key}`, JSON.stringify(data), {
      expirationTtl: 86400 * 7, // 7 days
    });
  }

  /**
   * Load profile from KV
   */
  async loadProfile(userId?: string, sessionId?: string): Promise<void> {
    if (!userId && !sessionId) return;

    const key = userId || `session:${sessionId}`;
    const data = await this.kv.get(`collaborative:${key}`, 'json');

    if (data && typeof data === 'object') {
      const profileData = data as {
        userId?: string;
        sessionId: string;
        preferences: UserPreferences;
        history: AccessPattern[];
        vector: [string, number][];
        lastUpdate: number;
      };

      this.userProfiles.set(key, {
        userId: profileData.userId,
        sessionId: profileData.sessionId,
        preferences: profileData.preferences,
        history: profileData.history,
        vector: new Map(profileData.vector),
        lastUpdate: profileData.lastUpdate,
      });
    }
  }

  /**
   * Get collaborative filtering results
   */
  getCollaborativeFilteringResult(userId: string, sessionId: string): CollaborativeFilteringResult {
    const key = userId || `session:${sessionId}`;
    const similarUsers = this.similarityCache.get(key) || [];

    const recommendedUrls: string[] = [];
    const scores: number[] = [];

    for (const similar of similarUsers.slice(0, 10)) {
      const profile = this.userProfiles.get(similar.userId);
      if (!profile) continue;

      for (const [url, freq] of profile.vector) {
        if (!recommendedUrls.includes(url)) {
          recommendedUrls.push(url);
          scores.push(similar.similarity * freq);
        }
      }
    }

    return {
      similarUsers: similarUsers.map(s => s.userId),
      recommendedUrls,
      scores,
    };
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalUsers: this.userProfiles.size,
      cachedSimilarities: this.similarityCache.size,
      lastUpdate: this.lastUpdate,
      avgVectorSize: Array.from(this.userProfiles.values())
        .reduce((sum, p) => sum + p.vector.size, 0) / Math.max(this.userProfiles.size, 1),
    };
  }
}

/**
 * Create a collaborative filtering engine
 */
export function createCollaborativeFilteringEngine(
  kv: KVNamespace,
  config?: Partial<CollaborativeConfig>
): CollaborativeFilteringEngine {
  return new CollaborativeFilteringEngine(kv, config);
}
