/**
 * Edge-Side Rendering (SSR) Optimization
 *
 * Optimizes server-side rendering at the edge with intelligent
 * caching, partial rendering, and streaming capabilities.
 */

import type {
  RenderRequest,
  RenderResult,
  RenderContext,
  RenderMetadata,
  CacheTier,
  EdgeCacheEnv,
} from '../types';

export interface SSROptimizationConfig {
  enableStreaming: boolean;
  enablePartialRendering: boolean;
  enableShellCaching: boolean;
  streamChunkSize: number;
  maxRenderTime: number;
  cacheStrategy: {
    enabled: boolean;
    tier: CacheTier;
    ttl: number;
    staleWhileRevalidate: number;
  };
}

export interface RenderShell {
  html: string;
  styles: string[];
  scripts: string[];
  metadata: Record<string, unknown>;
  cachedAt: number;
}

export interface RenderData {
  json: unknown;
  cachedAt: number;
  variesBy: string[];
}

/**
 * Edge SSR Optimizer
 *
 * Optimizes server-side rendering with caching and streaming.
 */
export class SSROptimizer {
  private kv: KVNamespace;
  private config: SSROptimizationConfig;
  private shellCache: Map<string, RenderShell>;
  private dataCache: Map<string, RenderData>;

  constructor(kv: KVNamespace, config: Partial<SSROptimizationConfig> = {}) {
    this.kv = kv;
    this.config = {
      enableStreaming: true,
      enablePartialRendering: true,
      enableShellCaching: true,
      streamChunkSize: 4096,
      maxRenderTime: 10000, // 10 seconds
      cacheStrategy: {
        enabled: true,
        tier: 'hot',
        ttl: 3600, // 1 hour
        staleWhileRevalidate: 300, // 5 minutes
      },
      ...config,
    };

    this.shellCache = new Map();
    this.dataCache = new Map();
  }

  /**
   * Render a page with optimization
   */
  async render(request: RenderRequest): Promise<RenderResult> {
    const startTime = Date.now();
    const cacheKey = this.getRenderCacheKey(request);

    // Try to get from cache
    if (this.config.cacheStrategy.enabled) {
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        return {
          ...cached,
          cached: true,
          duration: Date.now() - startTime,
        };
      }
    }

    // Perform rendering
    const result = await this.performRender(request);

    // Cache the result
    if (this.config.cacheStrategy.enabled && result.status === 200) {
      await this.cacheResult(cacheKey, result);
    }

    return result;
  }

  /**
   * Stream render with progressive loading
   */
  async streamRender(
    request: RenderRequest,
    stream: WritableStream<Uint8Array>
  ): Promise<void> {
    const writer = stream.getWriter();
    const encoder = new TextEncoder();

    try {
      // Check if we can stream the shell
      if (this.config.enableShellCaching) {
        const shell = await this.getRenderShell(request);
        if (shell) {
          await writer.write(encoder.encode(shell.html));
          await writer.write(encoder.encode('<!-- Shell from cache -->'));
        }
      }

      // Stream the data
      if (this.config.enableStreaming) {
        const data = await this.fetchRenderData(request);
        await writer.write(encoder.encode(`<script id="__DATA__" type="application/json">${JSON.stringify(data)}</script>`));
      }

      // Close the stream
      await writer.close();
    } catch (error) {
      console.error('Stream render error:', error);
      await writer.abort(error);
    }
  }

  /**
   * Perform partial rendering for a component
   */
  async renderPartial(
    request: RenderRequest,
    componentId: string
  ): Promise<string> {
    const cacheKey = `partial:${componentId}:${this.getRenderCacheKey(request)}`;

    // Try cache first
    const cached = await this.kv.get(cacheKey, 'text');
    if (cached) {
      return cached;
    }

    // Render the partial
    const html = await this.renderComponent(request, componentId);

    // Cache the result
    await this.kv.put(cacheKey, html, {
      expirationTtl: this.config.cacheStrategy.ttl,
    });

    return html;
  }

  /**
   * Perform the actual rendering
   */
  private async performRender(request: RenderRequest): Promise<RenderResult> {
    // This is a simplified implementation
    // In a real system, this would call your rendering framework

    const startTime = Date.now();
    let timeout = false;

    // Set timeout
    const timeoutId = setTimeout(() => {
      timeout = true;
    }, this.config.maxRenderTime);

    try {
      // Fetch the content
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      if (timeout) {
        throw new Error('Render timeout');
      }

      clearTimeout(timeoutId);

      const content = await response.text();
      const headers = new Headers(response.headers);

      return {
        content,
        status: response.status,
        headers,
        metadata: {
          strategy: 'ssr',
          generatedAt: Date.now(),
          expiresAt: Date.now() + this.config.cacheStrategy.ttl * 1000,
          cacheKey: this.getRenderCacheKey(request),
          tags: this.extractTags(request),
          size: content.length,
          compressed: false,
        },
        cached: false,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // Return error or fallback
      return {
        content: this.getErrorHtml(error),
        status: 500,
        headers: new Headers(),
        metadata: {
          strategy: 'ssr',
          generatedAt: Date.now(),
          expiresAt: 0,
          cacheKey: '',
          tags: [],
          size: 0,
          compressed: false,
        },
        cached: false,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get render shell from cache
   */
  private async getRenderShell(request: RenderRequest): Promise<RenderShell | null> {
    const shellKey = `shell:${this.getRenderCacheKey(request)}`;

    // Check memory cache first
    if (this.shellCache.has(shellKey)) {
      return this.shellCache.get(shellKey)!;
    }

    // Check KV cache
    const cached = await this.kv.get(shellKey, 'json');
    if (cached && typeof cached === 'object') {
      const shell = cached as RenderShell;
      this.shellCache.set(shellKey, shell);
      return shell;
    }

    return null;
  }

  /**
   * Fetch render data
   */
  private async fetchRenderData(request: RenderRequest): Promise<unknown> {
    const dataKey = `data:${this.getRenderCacheKey(request)}`;

    // Check memory cache first
    if (this.dataCache.has(dataKey)) {
      return this.dataCache.get(dataKey)!.json;
    }

    // Check KV cache
    const cached = await this.kv.get(dataKey, 'json');
    if (cached) {
      return cached;
    }

    // Fetch data
    try {
      const response = await fetch(request.url, {
        headers: {
          ...Object.fromEntries(request.headers),
          'Accept': 'application/json',
        },
      });

      const data = await response.json();

      // Cache the data
      this.dataCache.set(dataKey, {
        json: data,
        cachedAt: Date.now(),
        variesBy: [],
      });

      return data;
    } catch (error) {
      console.error('Failed to fetch render data:', error);
      return null;
    }
  }

  /**
   * Render a specific component
   */
  private async renderComponent(request: RenderRequest, componentId: string): Promise<string> {
    // This is a simplified implementation
    // In a real system, this would call your component rendering framework

    try {
      const response = await fetch(`${request.url}__component/${componentId}`, {
        method: request.method,
        headers: request.headers,
      });

      if (response.ok) {
        return await response.text();
      }

      return `<div>Error loading component: ${componentId}</div>`;
    } catch (error) {
      console.error(`Failed to render component ${componentId}:`, error);
      return `<div>Error loading component: ${componentId}</div>`;
    }
  }

  /**
   * Get result from cache
   */
  private async getFromCache(cacheKey: string): Promise<RenderResult | null> {
    const cached = await this.kv.get(cacheKey, 'json');
    if (!cached || typeof cached !== 'object') {
      return null;
    }

    const result = cached as RenderResult;
    return result;
  }

  /**
   * Cache a render result
   */
  private async cacheResult(cacheKey: string, result: RenderResult): Promise<void> {
    await this.kv.put(cacheKey, JSON.stringify(result), {
      expirationTtl: this.config.cacheStrategy.ttl,
      metadata: {
        cachedAt: Date.now(),
        url: result.metadata.cacheKey,
        size: result.metadata.size,
      },
    });
  }

  /**
   * Get cache key for a render request
   */
  private getRenderCacheKey(request: RenderRequest): string {
    const url = new URL(request.url);
    const parts = ['render', url.pathname, request.method];

    // Add query parameters for cache key
    const cacheableParams = this.getCacheableParams(url.searchParams);
    if (cacheableParams.length > 0) {
      parts.push(cacheableParams.sort().join('&'));
    }

    // Add variation headers
    const varyHeaders = this.getVaryHeaders(request);
    if (varyHeaders.length > 0) {
      parts.push(varyHeaders.sort().join(','));
    }

    return parts.join(':');
  }

  /**
   * Get cacheable query parameters
   */
  private getCacheableParams(searchParams: URLSearchParams): string[] {
    const cacheableParams = ['page', 'limit', 'sort', 'filter'];
    const params: string[] = [];

    for (const [key, value] of searchParams) {
      if (cacheableParams.includes(key)) {
        params.push(`${key}=${value}`);
      }
    }

    return params;
  }

  /**
   * Get vary headers for cache key
   */
  private getVaryHeaders(request: RenderRequest): string[] {
    const varyHeaders = ['Accept-Encoding', 'Accept-Language'];
    const headers: string[] = [];

    for (const header of varyHeaders) {
      const value = request.headers.get(header);
      if (value) {
        headers.push(`${header}=${value}`);
      }
    }

    return headers;
  }

  /**
   * Extract tags from request for cache tagging
   */
  private extractTags(request: RenderRequest): string[] {
    const url = new URL(request.url);
    const tags: string[] = [];

    // Add path-based tags
    const pathParts = url.pathname.split('/').filter(Boolean);
    for (let i = 0; i < pathParts.length; i++) {
      tags.push(`path:${pathParts.slice(0, i + 1).join('/')}`);
    }

    // Add content type tag
    const contentType = request.headers.get('Accept');
    if (contentType) {
      tags.push(`content:${contentType.split(',')[0]}`);
    }

    return tags;
  }

  /**
   * Get error HTML
   */
  private getErrorHtml(error: unknown): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Render Error</title>
        </head>
        <body>
          <h1>Rendering Error</h1>
          <p>An error occurred while rendering this page.</p>
          <pre>${error instanceof Error ? error.message : String(error)}</pre>
        </body>
      </html>
    `;
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.shellCache.clear();
    this.dataCache.clear();
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      shellCacheSize: this.shellCache.size,
      dataCacheSize: this.dataCache.size,
      config: this.config,
    };
  }
}

/**
 * Create an SSR optimizer
 */
export function createSSROptimizer(
  kv: KVNamespace,
  config?: Partial<SSROptimizationConfig>
): SSROptimizer {
  return new SSROptimizer(kv, config);
}
