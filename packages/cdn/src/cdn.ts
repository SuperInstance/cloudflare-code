/**
 * Main CDN Class
 *
 * Unified interface for all CDN operations.
 */

import { CacheController } from './cache/controller.js';
import { InvalidationEngine } from './invalidation/engine.js';
import { AssetOptimizer } from './optimizer/optimizer.js';
import { EdgeDeployer } from './edge/deployer.js';
import { CDNAnalytics } from './analytics/analytics.js';
import { MultiCDNProvider } from './multi-cdn/provider.js';
import type {
  ICDNConfig,
  IRequestContext,
  ICDNResponse,
  IPurgeResult,
  IDeploymentResult,
  IOptimizedAsset
} from './types/index.js';

export class CDN {
  private cacheController: CacheController;
  private invalidationEngine: InvalidationEngine;
  private assetOptimizer: AssetOptimizer;
  private edgeDeployer: EdgeDeployer;
  private analytics: CDNAnalytics;
  private multiCDN?: MultiCDNProvider;
  private config: ICDNConfig;

  constructor(config: ICDNConfig) {
    this.config = config;

    // Initialize cache controller
    this.cacheController = new CacheController({
      maxCacheSize: 10000,
      defaultTTL: 3600,
      enableHierarchy: true,
      hierarchyLevels: 3
    });

    // Register default cache policies
    this.registerDefaultPolicies();

    // Initialize invalidation engine
    this.invalidationEngine = new InvalidationEngine(this.cacheController);

    if (config.zoneId && config.apiKey && config.apiEmail && config.accountId) {
      this.invalidationEngine.configureCloudflare({
        apiKey: config.apiKey,
        email: config.apiEmail,
        zoneId: config.zoneId,
        accountId: config.accountId
      });
    }

    // Initialize asset optimizer
    this.assetOptimizer = new AssetOptimizer();

    // Initialize edge deployer
    this.edgeDeployer = new EdgeDeployer();

    if (config.zoneId && config.apiKey && config.apiEmail && config.accountId) {
      this.edgeDeployer.configureCloudflare({
        apiKey: config.apiKey,
        email: config.apiEmail,
        zoneId: config.zoneId,
        accountId: config.accountId
      });
    }

    // Initialize analytics
    this.analytics = new CDNAnalytics({
      retentionPeriod: 24 * 60 * 60 * 1000,
      aggregationInterval: 60000,
      enableRealTime: config.analytics ?? true,
      enableHistorical: config.analytics ?? true
    });

    // Initialize multi-CDN if configured
    if (typeof config.provider !== 'string') {
      this.multiCDN = new MultiCDNProvider(config.provider);
    }
  }

  /**
   * Handle incoming request
   */
  public async handleRequest(context: IRequestContext): Promise<ICDNResponse> {
    const startTime = Date.now();

    try {
      // Check if should bypass cache
      if (this.cacheController.shouldBypass(context)) {
        const response = await this.fetchFromOrigin(context);
        this.analytics.recordCacheMiss({
          url: context.url,
          responseTime: Date.now() - startTime,
          size: response.body.length,
          country: context.country,
          provider: response.provider
        });
        return response;
      }

      // Check cache
      const cacheKey = this.cacheController.generateCacheKey(
        context.url,
        context.headers
      );
      const cached = await this.cacheController.get(cacheKey);

      if (cached) {
        this.analytics.recordCacheHit({
          url: context.url,
          responseTime: Date.now() - startTime,
          size: cached.size,
          country: context.country
        });

        return {
          status: cached.status,
          headers: cached.metadata.headers ?? {},
          body: '',
          fromCache: true,
          cacheKey,
          provider: 'cloudflare',
          responseTime: Date.now() - startTime
        };
      }

      // Fetch from origin
      const response = await this.fetchFromOrigin(context);

      // Cache response
      const policy = this.cacheController.getPolicyForRequest(context);
      if (policy) {
        await this.cacheController.set(cacheKey, {
          url: context.url,
          status: response.status,
          size: response.body.length,
          contentType: response.headers['content-type'] ?? 'application/octet-stream',
          tags: policy.tags ?? [],
          ttl: policy.ttl * 1000,
          age: 0,
          lastAccessed: new Date(),
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + policy.ttl * 1000),
          metadata: {
            headers: response.headers
          }
        });
      }

      this.analytics.recordCacheMiss({
        url: context.url,
        responseTime: Date.now() - startTime,
        size: response.body.length,
        country: context.country,
        provider: response.provider
      });

      return response;
    } catch (error) {
      this.analytics.recordError({
        error: error instanceof Error ? error.message : String(error),
        url: context.url
      });

      throw error;
    }
  }

  /**
   * Purge cache
   */
  public async purge(type: 'url' | 'tag' | 'wildcard' | 'all', targets?: string[]): Promise<IPurgeResult> {
    const startTime = Date.now();

    let result: IPurgeResult;

    switch (type) {
      case 'url':
        result = await this.invalidationEngine.purgeURLs(targets ?? []);
        break;
      case 'tag':
        result = await this.invalidationEngine.purgeTags(targets ?? []);
        break;
      case 'wildcard':
        result = await this.invalidationEngine.purgeWildcard(targets?.[0] ?? '*');
        break;
      case 'all':
        result = await this.invalidationEngine.purgeAll();
        break;
    }

    this.analytics.recordPurge({
      type,
      targets: targets ?? [],
      duration: Date.now() - startTime,
      success: result.success
    });

    return result;
  }

  /**
   * Optimize asset
   */
  public async optimizeAsset(
    content: string | Buffer,
    assetType: 'image' | 'javascript' | 'css' | 'font',
    options?: {
      quality?: number;
      format?: string;
      minify?: boolean;
      compress?: boolean;
    }
  ): Promise<IOptimizedAsset> {
    return this.assetOptimizer.optimize(content, assetType, options);
  }

  /**
   * Deploy edge functions
   */
  public async deploy(config: {
    version: string;
    functions: Array<{
      name: string;
      content: string;
      routes: string[];
    }>;
    assets: Array<{
      path: string;
      content: string | Buffer;
      contentType: string;
    }>;
    routes: Array<{
      pattern: string;
      functionName?: string;
      cachePolicy?: string;
    }>;
  }): Promise<IDeploymentResult> {
    const deploymentConfig = {
      id: `deploy_${Date.now()}`,
      version: config.version,
      functions: config.functions.map(f => ({
        name: f.name,
        content: f.content,
        type: 'worker' as const,
        routes: f.routes,
        environment: {},
        bindings: [],
        enabled: true
      })),
      assets: config.assets.map(a => ({
        path: a.path,
        content: a.content,
        contentType: a.contentType
      })),
      routes: config.routes.map(r => ({
        pattern: r.pattern,
        functionName: r.functionName,
        cachePolicy: r.cachePolicy
      })),
      environment: {},
      strategy: 'rolling' as const
    };

    const result = await this.edgeDeployer.deploy(deploymentConfig);

    this.analytics.recordDeployment({
      deploymentId: result.deploymentId,
      version: config.version,
      functions: config.functions.length,
      assets: config.assets.length,
      duration: result.duration,
      success: result.status === 'success'
    });

    return result;
  }

  /**
   * Get analytics
   */
  public getAnalytics() {
    return this.analytics.getAnalytics();
  }

  /**
   * Get summary
   */
  public getSummary() {
    return this.analytics.getSummary();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats() {
    return this.cacheController.getStats();
  }

  /**
   * Warm cache
   */
  public async warmCache(urls: string[]): Promise<void> {
    await this.cacheController.warmup(urls);
  }

  /**
   * Fetch from origin
   */
  private async fetchFromOrigin(context: IRequestContext): Promise<ICDNResponse> {
    const startTime = Date.now();

    if (this.multiCDN) {
      return this.multiCDN.route(context);
    }

    // Direct fetch
    const response = await fetch(context.url, {
      method: context.method,
      headers: context.headers as HeadersInit
    });

    const body = await response.text();

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
      fromCache: false,
      provider: typeof this.config.provider === 'string' ? this.config.provider : 'cloudflare',
      responseTime: Date.now() - startTime
    };
  }

  /**
   * Register default cache policies
   */
  private registerDefaultPolicies(): void {
    // Static assets - long TTL
    this.cacheController.registerPolicy({
      name: 'static-assets',
      policy: 'public' as any,
      ttl: 86400 * 7, // 1 week
      staleWhileRevalidate: 86400,
      level: 'both' as any,
      tags: ['static']
    });

    // API responses - short TTL
    this.cacheController.registerPolicy({
      name: 'api',
      policy: 'public' as any,
      ttl: 60, // 1 minute
      staleWhileRevalidate: 30,
      level: 'edge' as any,
      tags: ['api']
    });

    // HTML - moderate TTL
    this.cacheController.registerPolicy({
      name: 'html',
      policy: 'public' as any,
      ttl: 3600, // 1 hour
      staleWhileRevalidate: 600,
      level: 'edge' as any,
      vary: ['Accept-Encoding'],
      tags: ['html']
    });

    // Default policy
    this.cacheController.registerPolicy({
      name: 'default',
      policy: 'public' as any,
      ttl: 3600,
      level: 'edge' as any
    });
  }

  /**
   * Cleanup
   */
  public async destroy(): Promise<void> {
    this.analytics.destroy();
    this.multiCDN?.destroy();
  }
}

export default CDN;
