/**
 * Edge Rendering Optimization Module
 *
 * Optimizes edge-side rendering with SSR, ISR, SSG,
 * and streaming capabilities.
 */

export { SSROptimizer, createSSROptimizer } from './ssr';
export { ISROptimizer, createISROptimizer } from './isr';

import type {
  RenderRequest,
  RenderResult,
  RenderStrategy,
  EdgeCacheEnv,
} from '../types';
import { SSROptimizer } from './ssr';
import { ISROptimizer } from './isr';

/**
 * Unified Rendering Manager
 *
 * Orchestrates different rendering strategies based on
 * content type and requirements.
 */
export class RenderingManager {
  private env: EdgeCacheEnv;
  private ssrOptimizer: SSROptimizer;
  private isrOptimizer: ISROptimizer;
  private strategies: Map<string, RenderStrategy>;

  constructor(env: EdgeCacheEnv) {
    this.env = env;
    this.ssrOptimizer = new SSROptimizer(env.CACHE_KV);
    this.isrOptimizer = new ISROptimizer(env.CACHE_KV);
    this.strategies = new Map();
  }

  /**
   * Initialize the rendering manager
   */
  async initialize(): Promise<void> {
    // Load default strategies
    this.registerDefaultStrategies();
    console.log('Rendering manager initialized');
  }

  /**
   * Render a request using the appropriate strategy
   */
  async render(request: RenderRequest): Promise<RenderResult> {
    const strategy = this.selectStrategy(request);

    if (!strategy.enabled) {
      throw new Error(`Strategy ${strategy.type} is disabled`);
    }

    switch (strategy.type) {
      case 'ssr':
        return await this.ssrOptimizer.render(request);

      case 'isr':
        return await this.isrOptimizer.getPage(new URL(request.url).pathname);

      case 'ssg':
        // SSG is handled by ISR with very long revalidation
        return await this.isrOptimizer.getPage(new URL(request.url).pathname);

      case 'streaming':
        // Streaming is handled by SSR with streaming enabled
        return await this.ssrOptimizer.render(request);

      case 'hybrid':
        // Hybrid uses a combination of strategies
        return await this.renderHybrid(request);

      default:
        throw new Error(`Unknown strategy: ${strategy.type}`);
    }
  }

  /**
   * Stream render a request
   */
  async streamRender(
    request: RenderRequest,
    stream: WritableStream<Uint8Array>
  ): Promise<void> {
    const strategy = this.selectStrategy(request);

    if (strategy.type === 'streaming' || strategy.type === 'ssr') {
      return await this.ssrOptimizer.streamRender(request, stream);
    }

    // For other strategies, fall back to regular render
    const result = await this.render(request);
    const writer = stream.getWriter();
    const encoder = new TextEncoder();

    try {
      await writer.write(encoder.encode(result.content));
      await writer.close();
    } catch (error) {
      await writer.abort(error);
    }
  }

  /**
   * Register a rendering strategy
   */
  registerStrategy(strategy: RenderStrategy): void {
    this.strategies.set(strategy.type, strategy);
  }

  /**
   * Unregister a rendering strategy
   */
  unregisterStrategy(type: string): void {
    this.strategies.delete(type);
  }

  /**
   * Get a strategy
   */
  getStrategy(type: string): RenderStrategy | undefined {
    return this.strategies.get(type);
  }

  /**
   * Get all strategies
   */
  getStrategies(): RenderStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Enable a strategy
   */
  enableStrategy(type: string): void {
    const strategy = this.strategies.get(type);
    if (strategy) {
      strategy.enabled = true;
    }
  }

  /**
   * Disable a strategy
   */
  disableStrategy(type: string): void {
    const strategy = this.strategies.get(type);
    if (strategy) {
      strategy.enabled = false;
    }
  }

  /**
   * Select the appropriate strategy for a request
   */
  private selectStrategy(request: RenderRequest): RenderStrategy {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Check for explicit strategy in query
    const strategyParam = url.searchParams.get('render');
    if (strategyParam) {
      const strategy = this.strategies.get(strategyParam);
      if (strategy) {
        return strategy;
      }
    }

    // Select based on path patterns
    for (const strategy of this.strategies.values()) {
      if (!strategy.enabled) continue;

      // Check if path matches strategy patterns
      if (this.pathMatchesStrategy(pathname, strategy)) {
        return strategy;
      }
    }

    // Default to SSR
    return this.strategies.get('ssr') || this.createDefaultSSRStrategy();
  }

  /**
   * Check if a path matches a strategy
   */
  private pathMatchesStrategy(pathname: string, strategy: RenderStrategy): boolean {
    // This is a simplified implementation
    // In a real system, you'd have more sophisticated matching

    const config = strategy.config as any;
    if (config.paths && Array.isArray(config.paths)) {
      return config.paths.some((pattern: string) => {
        // Simple glob matching
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(pathname);
      });
    }

    return false;
  }

  /**
   * Render using hybrid strategy
   */
  private async renderHybrid(request: RenderRequest): Promise<RenderResult> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Check if this is a static or dynamic path
    const config = this.strategies.get('hybrid')?.config as any;
    const staticPaths = config?.staticPaths || [];
    const isStatic = staticPaths.some((pattern: string) => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(pathname);
    });

    if (isStatic) {
      // Use ISR for static paths
      return await this.isrOptimizer.getPage(pathname);
    } else {
      // Use SSR for dynamic paths
      return await this.ssrOptimizer.render(request);
    }
  }

  /**
   * Register default strategies
   */
  private registerDefaultStrategies(): void {
    // SSR Strategy
    this.strategies.set('ssr', {
      type: 'ssr',
      priority: 100,
      enabled: true,
      config: {
        timeout: 10000,
        maxRetries: 3,
        fallbackStrategy: 'static',
        cacheStrategy: {
          enabled: true,
          tier: 'hot',
          ttl: 3600,
          staleWhileRevalidate: 300,
        },
      },
    });

    // ISR Strategy
    this.strategies.set('isr', {
      type: 'isr',
      priority: 90,
      enabled: true,
      config: {
        timeout: 10000,
        maxRetries: 3,
        fallbackStrategy: 'stale',
        cacheStrategy: {
          enabled: true,
          tier: 'warm',
          ttl: 3600,
          staleWhileRevalidate: 300,
        },
      },
    });

    // Streaming Strategy
    this.strategies.set('streaming', {
      type: 'streaming',
      priority: 80,
      enabled: true,
      config: {
        timeout: 15000,
        maxRetries: 2,
        fallbackStrategy: 'static',
        cacheStrategy: {
          enabled: true,
          tier: 'hot',
          ttl: 1800,
          staleWhileRevalidate: 300,
        },
      },
    });

    // Hybrid Strategy
    this.strategies.set('hybrid', {
      type: 'hybrid',
      priority: 70,
      enabled: true,
      config: {
        timeout: 10000,
        maxRetries: 3,
        fallbackStrategy: 'static',
        cacheStrategy: {
          enabled: true,
          tier: 'warm',
          ttl: 3600,
          staleWhileRevalidate: 300,
        },
      },
    });
  }

  /**
   * Create default SSR strategy
   */
  private createDefaultSSRStrategy(): RenderStrategy {
    return {
      type: 'ssr',
      priority: 100,
      enabled: true,
      config: {
        timeout: 10000,
        maxRetries: 3,
        fallbackStrategy: 'static',
        cacheStrategy: {
          enabled: true,
          tier: 'hot',
          ttl: 3600,
          staleWhileRevalidate: 300,
        },
      },
    };
  }

  /**
   * Pre-generate static pages
   */
  async preGeneratePages(paths: string[]): Promise<void> {
    await this.isrOptimizer.preGeneratePages(paths);
  }

  /**
   * Revalidate a page
   */
  async revalidatePage(path: string): Promise<void> {
    await this.isrOptimizer.revalidatePage(path);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ssr: this.ssrOptimizer.getStats(),
      isr: this.isrOptimizer.getStats(),
      strategies: Array.from(this.strategies.values()).map((s) => ({
        type: s.type,
        enabled: s.enabled,
        priority: s.priority,
      })),
    };
  }
}

/**
 * Create a rendering manager
 */
export function createRenderingManager(env: EdgeCacheEnv): RenderingManager {
  return new RenderingManager(env);
}
