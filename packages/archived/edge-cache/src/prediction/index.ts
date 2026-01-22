/**
 * Predictive Preloading Module
 *
 * Combines multiple prediction strategies to intelligently
 * preload content before users request it.
 */

export { BehavioralPredictionEngine, createBehavioralPredictionEngine } from './behavioral';
export { CollaborativeFilteringEngine, createCollaborativeFilteringEngine } from './collaborative';

import type {
  PredictionRequest,
  PredictionResult,
  PredictionContext,
  EdgeCacheEnv,
} from '../types';
import { BehavioralPredictionEngine } from './behavioral';
import { CollaborativeFilteringEngine } from './collaborative';

/**
 * Unified Prediction Manager
 *
 * Combines behavioral and collaborative filtering predictions
 * to provide comprehensive content preloading recommendations.
 */
export class PredictionManager {
  private env: EdgeCacheEnv;
  private behavioral: BehavioralPredictionEngine;
  private collaborative: CollaborativeFilteringEngine;

  constructor(env: EdgeCacheEnv) {
    this.env = env;
    this.behavioral = new BehavioralPredictionEngine(env.PREDICTION_KV || env.CACHE_KV);
    this.collaborative = new CollaborativeFilteringEngine(env.PREDICTION_KV || env.CACHE_KV);
  }

  /**
   * Initialize the prediction manager
   */
  async initialize(): Promise<void> {
    await this.behavioral.loadPatterns();
    console.log('Prediction manager initialized');
  }

  /**
   * Record an access event
   */
  async recordAccess(
    userId: string | undefined,
    sessionId: string,
    url: string,
    method: string,
    context: PredictionContext
  ): Promise<void> {
    const pattern = {
      url,
      timestamp: context.timestamp,
      duration: 0,
      referrer: context.referrer,
      method,
      status: 200,
    };

    await this.behavioral.recordAccess(userId, sessionId, pattern);
    await this.collaborative.recordAccess(userId, sessionId, pattern);
  }

  /**
   * Get predictions for a user
   */
  async getPredictions(
    userId: string | undefined,
    sessionId: string,
    context: PredictionContext,
    limit: number = 10
  ): Promise<PredictionResult[]> {
    const [behavioralResults, collaborativeResults] = await Promise.all([
      this.behavioral.getPredictions(userId, sessionId, context),
      this.collaborative.getPredictions(userId, sessionId, context.currentUrl),
    ]);

    // Combine and deduplicate results
    const combined = new Map<string, PredictionResult>();

    for (const result of behavioralResults) {
      combined.set(result.url, result);
    }

    for (const result of collaborativeResults) {
      const existing = combined.get(result.url);
      if (existing) {
        // Average the probabilities and confidence
        existing.probability = (existing.probability + result.probability) / 2;
        existing.confidence = (existing.confidence + result.confidence) / 2;
        existing.priority = Math.round((existing.priority + result.priority) / 2);
        existing.reason = 'combined';
      } else {
        combined.set(result.url, result);
      }
    }

    // Sort by priority and limit
    const sorted = Array.from(combined.values())
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);

    return sorted;
  }

  /**
   * Preload predicted content
   */
  async preloadPredictions(
    userId: string | undefined,
    sessionId: string,
    context: PredictionContext,
    limit: number = 5
  ): Promise<void> {
    const predictions = await this.getPredictions(userId, sessionId, context, limit);

    console.log(`Preloading ${predictions.length} predicted items for ${userId || sessionId}`);

    for (const prediction of predictions) {
      try {
        // Fetch content to cache it
        const response = await fetch(prediction.url, {
          method: 'GET',
          headers: {
            'User-Agent': 'ClaudeFlare-Predictive-Preloader/1.0',
            'X-Preload': 'true',
            'X-Reason': prediction.reason,
          },
        });

        if (response.ok) {
          // Content is now cached by the edge
          console.log(`Preloaded: ${prediction.url} (${prediction.reason})`);
        }
      } catch (error) {
        console.error(`Failed to preload ${prediction.url}:`, error);
      }
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      behavioral: this.behavioral.getStats(),
      collaborative: this.collaborative.getStats(),
    };
  }
}

/**
 * Create a prediction manager
 */
export function createPredictionManager(env: EdgeCacheEnv): PredictionManager {
  return new PredictionManager(env);
}
