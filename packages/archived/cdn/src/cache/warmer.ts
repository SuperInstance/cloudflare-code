// @ts-nocheck - Missing type definitions for p-queue
/**
 * Cache Warmer
 *
 * Intelligent cache warming with strategies for optimal cache population.
 */

import PQueue from 'p-limit';
import type { ICacheWarmerConfig, ICacheWarmerResult, IWarmupStrategy } from '../types/index.js';
import { CacheController } from './controller.js';

export class CacheWarmer {
  private controller: CacheController;
  private config: ICacheWarmerConfig;
  private results: Map<string, ICacheWarmerResult>;

  constructor(
    controller: CacheController,
    config?: Partial<ICacheWarmerConfig>
  ) {
    this.controller = controller;
    this.config = {
      concurrency: config?.concurrency ?? 10,
      timeout: config?.timeout ?? 30000,
      retryAttempts: config?.retryAttempts ?? 3,
      retryDelay: config?.retryDelay ?? 1000,
      strategy: config?.strategy ?? 'popularity',
      enableProgressReporting: config?.enableProgressReporting ?? true,
      prioritizeBy: config?.prioritizeBy ?? 'access_frequency'
    };

    this.results = new Map();
  }

  /**
   * Warm cache with URLs
   */
  public async warmup(urls: string[]): Promise<ICacheWarmerResult> {
    const startTime = Date.now();
    const strategy = this.getStrategy(this.config.strategy);

    // Sort URLs based on strategy
    const prioritizedURLs = await strategy.prioritize(urls);

    // Process URLs with concurrency control
    const limit = PQueue(this.config.concurrency);
    const total = prioritizedURLs.length;
    let completed = 0;
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ url: string; error: string }> = [];

    const processURL = async (url: string): Promise<void> => {
      try {
        await this.warmURL(url, this.config.timeout);

        succeeded++;
        completed++;

        if (this.config.enableProgressReporting) {
          this.reportProgress(completed, total, url, 'success');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ url, error: errorMessage });
        failed++;
        completed++;

        if (this.config.enableProgressReporting) {
          this.reportProgress(completed, total, url, 'error', errorMessage);
        }
      }
    };

    const promises = prioritizedURLs.map(url => limit(() => processURL(url)));
    await Promise.all(promises);

    const result: ICacheWarmerResult = {
      success: failed === 0,
      total,
      succeeded,
      failed,
      duration: Date.now() - startTime,
      errors,
      throughput: total / ((Date.now() - startTime) / 1000)
    };

    this.results.set(Date.now().toString(), result);

    return result;
  }

  /**
   * Warm single URL
   */
  private async warmURL(url: string, timeout: number): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const body = await response.text();
      const key = this.controller.generateCacheKey(url, {});

      await this.controller.set(key, {
        url,
        status: response.status,
        size: body.length,
        contentType: response.headers.get('content-type') || 'text/plain',
        tags: ['warmup'],
        ttl: 3600000,
        age: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {
          headers: Object.fromEntries(response.headers.entries()),
          warmedAt: new Date().toISOString()
        }
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get warmup strategy
   */
  private getStrategy(name: string): IWarmupStrategy {
    const strategies: Record<string, IWarmupStrategy> = {
      popularity: {
        prioritize: async (urls: string[]) => {
          // In a real implementation, this would query analytics
          // For now, return as-is
          return urls;
        }
      },
      size: {
        prioritize: async (urls: string[]) => {
          // Prioritize smaller assets first
          return urls.sort((a, b) => a.length - b.length);
        }
      },
      alphabetical: {
        prioritize: async (urls: string[]) => {
          return urls.sort();
        }
      },
      random: {
        prioritize: async (urls: string[]) => {
          return urls.sort(() => Math.random() - 0.5);
        }
      }
    };

    return strategies[name] ?? strategies.popularity;
  }

  /**
   * Report progress
   */
  private reportProgress(
    completed: number,
    total: number,
    url: string,
    status: 'success' | 'error',
    error?: string
  ): void {
    const percentage = (completed / total) * 100;
    console.log(`[${percentage.toFixed(1)}%] ${status.toUpperCase()}: ${url}`);

    if (error) {
      console.error(`  Error: ${error}`);
    }
  }

  /**
   * Get previous results
   */
  public getResults(limit?: number): ICacheWarmerResult[] {
    const results = Array.from(this.results.values())
      .sort((a, b) => b.duration - a.duration);

    return limit ? results.slice(0, limit) : results;
  }

  /**
   * Clear results
   */
  public clearResults(): void {
    this.results.clear();
  }
}

export default CacheWarmer;
