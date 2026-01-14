/**
 * Incremental Static Regeneration (ISR) Optimization
 *
 * Implements ISR with on-demand regeneration and fallback pages.
 */

import type {
  RenderRequest,
  RenderResult,
  RenderMetadata,
  CacheTier,
} from '../types';

export interface ISRConfig {
  revalidate: number; // Time in seconds before revalidation
  regenerateOnDemand: boolean;
  fallbackPages: string[];
  maxConcurrentRegenerations: number;
  regenerationTimeout: number;
}

export interface ISRPageData {
  path: string;
  html: string;
  data: unknown;
  generatedAt: number;
  revalidateAt: number;
  isFallback: boolean;
  tags: string[];
}

export interface RegenerationTask {
  path: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  error?: string;
}

/**
 * ISR Optimizer
 *
 * Manages incremental static regeneration with fallback support.
 */
export class ISROptimizer {
  private kv: KVNamespace;
  private config: ISRConfig;
  private activeRegenerations: Map<string, RegenerationTask>;
  private regenerationQueue: string[];

  constructor(kv: KVNamespace, config: Partial<ISRConfig> = {}) {
    this.kv = kv;
    this.config = {
      revalidate: 3600, // 1 hour
      regenerateOnDemand: true,
      fallbackPages: [],
      maxConcurrentRegenerations: 3,
      regenerationTimeout: 30000, // 30 seconds
      ...config,
    };

    this.activeRegenerations = new Map();
    this.regenerationQueue = [];
  }

  /**
   * Get a page with ISR
   */
  async getPage(path: string): Promise<RenderResult> {
    const cacheKey = `isr:${path}`;
    const startTime = Date.now();

    // Try to get cached page
    const cached = await this.getCachedPage(cacheKey);
    if (cached) {
      // Check if revalidation is needed
      const now = Date.now();
      if (now >= cached.revalidateAt) {
        // Trigger background revalidation
        this.triggerRegeneration(path, cacheKey);
      }

      return {
        content: cached.html,
        status: 200,
        headers: new Headers({
          'Content-Type': 'text/html',
          'X-ISR': 'hit',
          'X-ISR-Stale': now >= cached.revalidateAt ? 'true' : 'false',
          'Cache-Control': `s-maxage=${this.config.revalidate}, stale-while-revalidate=300`,
        }),
        metadata: {
          strategy: 'isr',
          generatedAt: cached.generatedAt,
          expiresAt: cached.revalidateAt,
          cacheKey,
          tags: cached.tags,
          size: cached.html.length,
          compressed: false,
        },
        cached: true,
        duration: Date.now() - startTime,
      };
    }

    // No cached page, try fallback or regenerate
    if (this.config.fallbackPages.includes(path)) {
      const fallback = await this.getFallbackPage(path);
      if (fallback) {
        // Trigger regeneration in background
        this.triggerRegeneration(path, cacheKey);

        return {
          content: fallback,
          status: 200,
          headers: new Headers({
            'Content-Type': 'text/html',
            'X-ISR': 'fallback',
          }),
          metadata: {
            strategy: 'isr',
            generatedAt: Date.now(),
            expiresAt: 0,
            cacheKey,
            tags: [],
            size: fallback.length,
            compressed: false,
          },
          cached: false,
          duration: Date.now() - startTime,
        };
      }
    }

    // Generate page on-demand
    return await this.generatePage(path, cacheKey);
  }

  /**
   * Generate a page
   */
  async generatePage(path: string, cacheKey?: string): Promise<RenderResult> {
    const key = cacheKey || `isr:${path}`;
    const startTime = Date.now();

    try {
      // Generate the page
      const pageData = await this.performGeneration(path);

      // Cache the page
      await this.cachePage(key, pageData);

      return {
        content: pageData.html,
        status: 200,
        headers: new Headers({
          'Content-Type': 'text/html',
          'X-ISR': 'generated',
        }),
        metadata: {
          strategy: 'isr',
          generatedAt: pageData.generatedAt,
          expiresAt: pageData.revalidateAt,
          cacheKey: key,
          tags: pageData.tags,
          size: pageData.html.length,
          compressed: false,
        },
        cached: false,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error(`Failed to generate page ${path}:`, error);
      throw error;
    }
  }

  /**
   * Revalidate a page
   */
  async revalidatePage(path: string): Promise<void> {
    const cacheKey = `isr:${path}`;

    // Check if already regenerating
    if (this.activeRegenerations.has(path)) {
      return;
    }

    // Add to queue
    this.regenerationQueue.push(path);

    // Process queue
    await this.processRegenerationQueue();
  }

  /**
   * Trigger background regeneration
   */
  private triggerRegeneration(path: string, cacheKey: string): void {
    // Check if already regenerating
    if (this.activeRegenerations.has(path)) {
      return;
    }

    // Add to queue
    if (!this.regenerationQueue.includes(path)) {
      this.regenerationQueue.push(path);
    }

    // Process queue asynchronously
    this.processRegenerationQueue().catch((error) => {
      console.error('Regeneration queue error:', error);
    });
  }

  /**
   * Process regeneration queue
   */
  private async processRegenerationQueue(): Promise<void> {
    // Check if we can process more regenerations
    const activeCount = Array.from(this.activeRegenerations.values())
      .filter((t) => t.status === 'in-progress').length;

    if (activeCount >= this.config.maxConcurrentRegenerations) {
      return;
    }

    // Get next path from queue
    const path = this.regenerationQueue.shift();
    if (!path) {
      return;
    }

    // Start regeneration
    const task: RegenerationTask = {
      path,
      status: 'in-progress',
      startedAt: Date.now(),
    };

    this.activeRegenerations.set(path, task);

    try {
      const cacheKey = `isr:${path}`;
      const pageData = await this.performGeneration(path);
      await this.cachePage(cacheKey, pageData);

      task.status = 'completed';
      task.completedAt = Date.now();

      console.log(`Regenerated page: ${path}`);
    } catch (error) {
      task.status = 'failed';
      task.completedAt = Date.now();
      task.error = error instanceof Error ? error.message : String(error);

      console.error(`Failed to regenerate page ${path}:`, error);
    } finally {
      // Continue processing queue
      if (this.regenerationQueue.length > 0) {
        await this.processRegenerationQueue();
      }
    }
  }

  /**
   * Perform page generation
   */
  private async performGeneration(path: string): Promise<ISRPageData> {
    const timeoutId = setTimeout(() => {
      throw new Error('Generation timeout');
    }, this.config.regenerationTimeout);

    try {
      // Fetch the page from origin
      const response = await fetch(path, {
        headers: {
          'Accept': 'text/html',
          'X-ISR-Generation': 'true',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const now = Date.now();

      // Extract JSON-LD data if present
      let data: unknown = null;
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
      if (jsonLdMatch) {
        try {
          data = JSON.parse(jsonLdMatch[1]);
        } catch {
          // Ignore parse errors
        }
      }

      return {
        path,
        html,
        data,
        generatedAt: now,
        revalidateAt: now + this.config.revalidate * 1000,
        isFallback: false,
        tags: this.extractTags(path),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get cached page
   */
  private async getCachedPage(cacheKey: string): Promise<ISRPageData | null> {
    const cached = await this.kv.get(cacheKey, 'json');
    if (cached && typeof cached === 'object') {
      return cached as ISRPageData;
    }
    return null;
  }

  /**
   * Cache a page
   */
  private async cachePage(cacheKey: string, pageData: ISRPageData): Promise<void> {
    await this.kv.put(cacheKey, JSON.stringify(pageData), {
      expirationTtl: this.config.revalidate * 2, // Keep for 2x revalidate time
    });
  }

  /**
   * Get fallback page
   */
  private async getFallbackPage(path: string): Promise<string | null> {
    const fallbackKey = `fallback:${path}`;
    const cached = await this.kv.get(fallbackKey, 'text');

    if (cached) {
      return cached;
    }

    return null;
  }

  /**
   * Pre-generate pages for a path pattern
   */
  async preGeneratePages(paths: string[]): Promise<void> {
    const results = await Promise.allSettled(
      paths.map((path) => this.generatePage(path))
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`Pre-generation complete: ${successful} successful, ${failed} failed`);
  }

  /**
   * Extract tags from path
   */
  private extractTags(path: string): string[] {
    const tags: string[] = [];

    // Add path-based tags
    const parts = path.split('/').filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      tags.push(`path:${parts.slice(0, i + 1).join('/')}`);
    }

    return tags;
  }

  /**
   * Get regeneration status
   */
  getRegenerationStatus(): RegenerationTask[] {
    return Array.from(this.activeRegenerations.values());
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      activeRegenerations: this.activeRegenerations.size,
      queuedRegenerations: this.regenerationQueue.length,
      config: this.config,
    };
  }
}

/**
 * Create an ISR optimizer
 */
export function createISROptimizer(
  kv: KVNamespace,
  config?: Partial<ISRConfig>
): ISROptimizer {
  return new ISROptimizer(kv, config);
}
