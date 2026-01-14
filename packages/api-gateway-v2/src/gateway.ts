/**
 * API Gateway v2 - Main Entry Point
 * Next-generation API gateway with GraphQL federation, subscriptions, and advanced composition
 */

import { FederationGateway } from './graphql/federation';
import { SubscriptionManager, SubscriptionServer } from './graphql/subscriptions';
import { APIComposer } from './composition/composer';
import { ResponseAggregator } from './aggregation/aggregator';
import { OrchestrationEngine } from './orchestration/engine';
import { RateLimiter } from './rate-limit/rate-limiter';
import { VersionManager } from './versioning/version-manager';
import { Pipeline, createMiddlewareContext } from './middleware/pipeline';
import { ConfigManager } from './config/manager';
import { GatewayConfig, MiddlewareContext, ServiceConfig } from './types';

// ============================================================================
// API Gateway v2
// ============================================================================

export class APIGatewayV2 {
  private config: GatewayConfig;
  private configManager: ConfigManager;

  // Core components
  private federation?: FederationGateway;
  private subscriptions?: SubscriptionManager;
  private composer?: APIComposer;
  private aggregator?: ResponseAggregator;
  private orchestrator?: OrchestrationEngine;
  private rateLimiter?: RateLimiter;
  private versionManager?: VersionManager;

  // Middleware pipeline
  private pipeline: Pipeline;

  constructor(config: GatewayConfig) {
    this.config = config;
    this.configManager = new ConfigManager(config);
    this.pipeline = new Pipeline();

    this.initializeComponents();
  }

  /**
   * Initialize gateway components
   */
  private initializeComponents(): void {
    // Initialize GraphQL federation
    if (this.config.graphql?.federation.enabled) {
      this.federation = new FederationGateway(this.config.graphql.federation);

      // Register services with federation
      for (const service of this.config.services) {
        if (service.type === 'graphql') {
          // Service would be registered with its schema
          // this.federation.registerService(...);
        }
      }
    }

    // Initialize subscriptions
    if (this.config.subscriptions?.enabled) {
      this.subscriptions = new SubscriptionManager(this.config.subscriptions);
    }

    // Initialize composer
    if (this.config.composition) {
      this.composer = new APIComposer(this.config.composition);

      // Register services
      for (const service of this.config.services) {
        this.composer.registerService(service);
      }
    }

    // Initialize aggregator
    this.aggregator = new ResponseAggregator({
      strategy: 'merge',
      mergePolicies: new Map(),
      conflictResolution: {
        strategy: 'last-write-wins',
      },
      deduplication: {
        enabled: true,
        keyFields: ['id'],
        strategy: 'first',
      },
    });

    // Initialize orchestrator
    this.orchestrator = new OrchestrationEngine();

    // Register services with orchestrator
    for (const service of this.config.services) {
      this.orchestrator.registerService(service);
    }

    // Initialize rate limiter
    if (this.config.rateLimit?.enabled) {
      this.rateLimiter = new RateLimiter(this.config.rateLimit);
    }

    // Initialize version manager
    if (this.config.versioning) {
      this.versionManager = new VersionManager(this.config.versioning);
    }

    // Set up default middleware
    this.setupDefaultMiddleware();
  }

  /**
   * Setup default middleware pipeline
   */
  private setupDefaultMiddleware(): void {
    const {
      createRequestIdMiddleware,
      createCORSMiddleware,
      createLoggingMiddleware,
      createMetricsMiddleware,
    } = require('./middleware/pipeline');

    this.pipeline
      .use(createRequestIdMiddleware())
      .use(createCORSMiddleware())
      .use(createLoggingMiddleware())
      .use(createMetricsMiddleware());
  }

  /**
   * Handle incoming request
   */
  async handle(request: Request): Promise<Response> {
    try {
      // Create middleware context
      const context = await createMiddlewareContext(request);

      // Execute middleware pipeline
      const response = await this.pipeline.execute(context);

      return response;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: any): Response {
    const { GatewayError } = require('./types');

    if (error instanceof GatewayError) {
      return new Response(
        JSON.stringify({
          error: error.message,
          code: error.code,
          details: error.details,
        }),
        {
          status: error.statusCode,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Get federation gateway instance
   */
  getFederation(): FederationGateway | undefined {
    return this.federation;
  }

  /**
   * Get subscription manager instance
   */
  getSubscriptions(): SubscriptionManager | undefined {
    return this.subscriptions;
  }

  /**
   * Get composer instance
   */
  getComposer(): APIComposer | undefined {
    return this.composer;
  }

  /**
   * Get aggregator instance
   */
  getAggregator(): ResponseAggregator | undefined {
    return this.aggregator;
  }

  /**
   * Get orchestrator instance
   */
  getOrchestrator(): OrchestrationEngine | undefined {
    return this.orchestrator;
  }

  /**
   * Get rate limiter instance
   */
  getRateLimiter(): RateLimiter | undefined {
    return this.rateLimiter;
  }

  /**
   * Get version manager instance
   */
  getVersionManager(): VersionManager | undefined {
    return this.versionManager;
  }

  /**
   * Get middleware pipeline
   */
  getPipeline(): Pipeline {
    return this.pipeline;
  }

  /**
   * Get configuration
   */
  getConfig(): GatewayConfig {
    return this.config;
  }

  /**
   * Get configuration manager
   */
  getConfigManager(): ConfigManager {
    return this.configManager;
  }

  /**
   * Register service
   */
  registerService(service: ServiceConfig): void {
    this.config.services.push(service);

    this.composer?.registerService(service);
    this.orchestrator?.registerService(service);
  }

  /**
   * Unregister service
   */
  unregisterService(serviceName: string): void {
    this.config.services = this.config.services.filter(
      s => s.name !== serviceName
    );

    this.composer?.unregisterService(serviceName);
  }

  /**
   * Get registered services
   */
  getServices(): ServiceConfig[] {
    return this.config.services;
  }

  /**
   * Start gateway
   */
  async start(): Promise<void> {
    console.log('Starting API Gateway v2...');

    // Initialize subscriptions if enabled
    if (this.subscriptions) {
      await this.subscriptions.initialize();
    }

    console.log('API Gateway v2 started');
  }

  /**
   * Stop gateway
   */
  async stop(): Promise<void> {
    console.log('Stopping API Gateway v2...');

    // Shutdown subscriptions
    if (this.subscriptions) {
      await this.subscriptions.shutdown();
    }

    console.log('API Gateway v2 stopped');
  }

  /**
   * Get gateway statistics
   */
  getStats(): GatewayStats {
    return {
      services: this.config.services.length,
      federationEnabled: !!this.federation,
      subscriptionsEnabled: !!this.subscriptions,
      compositionEnabled: !!this.composer,
      rateLimitEnabled: !!this.rateLimiter,
      versioningEnabled: !!this.versionManager,
      middlewareCount: this.pipeline.length,
    };
  }
}

// ============================================================================
// Types
// ============================================================================

export interface GatewayStats {
  services: number;
  federationEnabled: boolean;
  subscriptionsEnabled: boolean;
  compositionEnabled: boolean;
  rateLimitEnabled: boolean;
  versioningEnabled: boolean;
  middlewareCount: number;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create API Gateway v2 instance
 */
export function createAPIGateway(config: GatewayConfig): APIGatewayV2 {
  return new APIGatewayV2(config);
}

/**
 * Create API Gateway with default configuration
 */
export function createDefaultAPIGateway(): APIGatewayV2 {
  return new APIGatewayV2({
    services: [],
    rateLimit: {
      enabled: true,
      default: {
        requests: 100,
        window: 60000,
        burst: 150,
      },
      endpoints: new Map(),
      storage: {
        type: 'memory',
      },
      algorithm: 'token-bucket',
    },
    versioning: {
      strategy: 'header',
      defaultVersion: '1',
      versions: [
        {
          version: '1',
          deprecated: false,
          services: new Map(),
          headers: {},
          transformations: [],
        },
      ],
    },
  });
}

// ============================================================================
// Cloudflare Worker Export
// ============================================================================

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    // Create gateway from config
    const gateway = createAPIGateway(env.GATEWAY_CONFIG || {});

    // Handle request
    return gateway.handle(request);
  },
};
