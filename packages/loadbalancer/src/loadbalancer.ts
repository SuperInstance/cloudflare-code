/**
 * Main load balancer orchestrator
 * Coordinates all load balancing components
 */

import type {
  Region,
  RegionInfo,
  RoutingContext,
  RoutingDecision,
  RoutingStrategy,
  RoutingConfig,
  LoadBalancerMetrics,
} from './types/index.js';

import { GeographicRouter } from './geographic/router.js';
import { GeographicMapper } from './geographic/mapper.js';
import { LatencyRouter } from './latency/router.js';
import { LatencyMonitor } from './latency/monitor.js';
import { CapacityRouter } from './capacity/router.js';
import { HealthChecker } from './health/checker.js';
import { TrafficShaper } from './traffic/shaper.js';
import { AnycastRouter } from './anycast/router.js';

import {
  NoHealthyRegionsError,
  CapacityExceededError,
  ThrottledError,
  RegionUnavailableError,
} from './types/index.js';
import type { HealthCheckerConfig } from './health/checker.js';

export interface LoadBalancerConfig {
  regions: Map<Region, RegionInfo>;
  defaultStrategy: RoutingStrategy;
  fallbackStrategy: RoutingStrategy;
  geographic: {
    preferContinentLocal: boolean;
    maxDistanceKm: number;
  };
  latency: {
    preferP50: boolean;
    maxLatency: number;
    enablePrediction: boolean;
  };
  capacity: {
    maxUtilization: number;
    enablePrediction: boolean;
  };
  health: {
    checkInterval: number;
  } & Partial<HealthCheckerConfig>;
  traffic: {
    enableRateLimiting: boolean;
    enableThrottling: boolean;
    enableDDoSProtection: boolean;
  };
  anycast: {
    enabled: boolean;
  };
}

export interface LoadBalancerStats {
  totalRequests: number;
  requestsByStrategy: Map<RoutingStrategy, number>;
  requestsByRegion: Map<Region, number>;
  averageRoutingTime: number;
  errorRate: number;
}

/**
 * Main load balancer class
 */
export class LoadBalancer {
  private config: LoadBalancerConfig;
  private geographicRouter: GeographicRouter;
  private geographicMapper: GeographicMapper;
  private latencyRouter: LatencyRouter;
  private latencyMonitor: LatencyMonitor;
  private capacityRouter: CapacityRouter;
  private healthChecker: HealthChecker;
  private trafficShaper: TrafficShaper;
  private anycastRouter: AnycastRouter;

  private stats: LoadBalancerStats;
  private routingHistory: RoutingDecision[];

  constructor(config: LoadBalancerConfig) {
    this.config = config;

    // Initialize components
    this.geographicRouter = new GeographicRouter(
      config.regions,
      config.geographic
    );

    this.geographicMapper = new GeographicMapper();

    this.latencyRouter = new LatencyRouter(
      Array.from(config.regions.keys()),
      config.latency
    );

    this.latencyMonitor = new LatencyMonitor();

    this.capacityRouter = new CapacityRouter(config.capacity);

    this.healthChecker = new HealthChecker(config.health);

    this.trafficShaper = new TrafficShaper(config.traffic);

    this.anycastRouter = new AnycastRouter(
      config.anycast,
      { enabled: config.anycast.enabled }
    );

    // Initialize stats
    this.stats = {
      totalRequests: 0,
      requestsByStrategy: new Map(),
      requestsByRegion: new Map(),
      averageRoutingTime: 0,
      errorRate: 0,
    };

    this.routingHistory = [];

    // Initialize health checks for all regions
    this.initializeHealthChecks();
  }

  /**
   * Route a request to the optimal region
   */
  async route(request: Request, strategy?: RoutingStrategy): Promise<RoutingDecision> {
    const startTime = performance.now();
    this.stats.totalRequests++;

    try {
      // Extract geographic context
      const location = await this.geographicMapper.extractLocation(request);

      // Build routing context
      const context: RoutingContext = {
        requestId: this.generateRequestId(),
        timestamp: Date.now(),
        sourceLocation: location,
        priority: 5,
        tags: [],
      };

      // Evaluate traffic policies
      const trafficResult = await this.trafficShaper.evaluate(context);

      if (!trafficResult.allowed) {
        if (trafficResult.action?.type === 'block') {
          throw new ThrottledError();
        } else if (trafficResult.action?.type === 'redirect') {
          return this.buildRedirectDecision(context, trafficResult.action);
        }
      }

      // Select routing strategy
      const selectedStrategy = strategy || this.selectStrategy(context);

      // Route using selected strategy
      const decision = await this.executeRouting(context, selectedStrategy);

      // Record metrics
      const routingTime = performance.now() - startTime;
      this.recordMetrics(selectedStrategy, decision, routingTime, true);

      // Store decision in history
      this.routingHistory.push(decision);

      // Trim history if needed
      if (this.routingHistory.length > 10000) {
        this.routingHistory.splice(0, this.routingHistory.length - 10000);
      }

      return decision;

    } catch (error) {
      const routingTime = performance.now() - startTime;
      this.recordMetrics(
        strategy || this.config.defaultStrategy,
        null,
        routingTime,
        false
      );

      // Attempt fallback strategy
      if (strategy !== this.config.fallbackStrategy) {
        try {
          return await this.route(request, this.config.fallbackStrategy);
        } catch {
          // Fallback also failed
        }
      }

      throw error;
    }
  }

  /**
   * Select routing strategy based on context
   */
  private selectStrategy(context: RoutingContext): RoutingStrategy {
    // Check if we should use adaptive routing
    const healthScores = this.healthChecker.getAllHealthScores();
    const healthyRegions = Array.from(healthScores.values()).filter(s => s.score >= 70).length;

    // If few healthy regions, use geographic routing
    if (healthyRegions < 3) {
      return 'geographic';
    }

    // If latency data is available, use latency-based routing
    const latencyMetrics = this.latencyRouter.getAllMetrics();
    if (latencyMetrics.size > 0) {
      return 'latency';
    }

    // Check capacity
    const capacityStats = this.capacityRouter.getStats();
    if (capacityStats.averageUtilization > 0.8) {
      return 'capacity';
    }

    return this.config.defaultStrategy;
  }

  /**
   * Execute routing with specific strategy
   */
  private async executeRouting(
    context: RoutingContext,
    strategy: RoutingStrategy
  ): Promise<RoutingDecision> {
    switch (strategy) {
      case 'geographic':
        return await this.geographicRouter.route(context);

      case 'latency':
        return await this.latencyRouter.route(context);

      case 'capacity':
        return await this.capacityRouter.route(context);

      case 'adaptive':
        return await this.adaptiveRoute(context);

      default:
        return await this.geographicRouter.route(context);
    }
  }

  /**
   * Adaptive routing that combines multiple strategies
   */
  private async adaptiveRoute(context: RoutingContext): Promise<RoutingDecision> {
    // Get decisions from multiple strategies
    const geoDecision = await this.geographicRouter.route(context);
    const latencyDecision = await this.latencyRouter.route(context).catch(() => null);
    const capacityDecision = await this.capacityRouter.route(context).catch(() => null);

    // Score and combine decisions
    const decisions = [geoDecision];
    if (latencyDecision) decisions.push(latencyDecision);
    if (capacityDecision) decisions.push(capacityDecision);

    // Count votes for each region
    const votes = new Map<Region, number>();
    for (const decision of decisions) {
      const count = votes.get(decision.selectedRegion) || 0;
      votes.set(decision.selectedRegion, count + 1);
    }

    // Select region with most votes
    let bestRegion = geoDecision.selectedRegion;
    let maxVotes = 1;

    for (const [region, count] of votes) {
      if (count > maxVotes) {
        maxVotes = count;
        bestRegion = region;
      }
    }

    // Return decision for best region
    const bestDecision = decisions.find(d => d.selectedRegion === bestRegion) || geoDecision;

    // Update reasoning to reflect adaptive nature
    bestDecision.reasoning.push({
      factor: 'adaptive_consensus',
      weight: 0.2,
      score: maxVotes / decisions.length,
      description: `Selected by ${maxVotes} of ${decisions.length} strategies`,
    });

    return bestDecision;
  }

  /**
   * Build redirect decision
   */
  private buildRedirectDecision(
    context: RoutingContext,
    action: any
  ): RoutingDecision {
    return {
      requestId: context.requestId,
      selectedRegion: action.targetRegion,
      selectedDatacenter: '',
      selectedEndpoint: '',
      reasoning: [{
        factor: 'traffic_policy',
        weight: 1,
        score: 1,
        description: 'Redirected by traffic policy',
      }],
      confidence: 1,
      timestamp: Date.now(),
      alternatives: [],
    };
  }

  /**
   * Initialize health checks for all regions
   */
  private initializeHealthChecks(): void {
    for (const [region, info] of this.config.regions) {
      for (const dc of info.datacenters) {
        for (const endpoint of dc.endpoints) {
          this.healthChecker.registerHealthCheck(
            `health-${dc.id}`,
            region,
            endpoint,
            {
              checkType: 'https',
              interval: this.config.health.checkInterval,
              unhealthyThreshold: 3,
              healthyThreshold: 2,
            }
          );
        }
      }
    }
  }

  /**
   * Record routing metrics
   */
  private recordMetrics(
    strategy: RoutingStrategy,
    decision: RoutingDecision | null,
    routingTime: number,
    success: boolean
  ): void {
    // Update strategy stats
    const strategyCount = this.stats.requestsByStrategy.get(strategy) || 0;
    this.stats.requestsByStrategy.set(strategy, strategyCount + 1);

    // Update region stats
    if (decision) {
      const regionCount = this.stats.requestsByRegion.get(decision.selectedRegion) || 0;
      this.stats.requestsByRegion.set(decision.selectedRegion, regionCount + 1);
    }

    // Update average routing time
    const total = this.stats.totalRequests;
    const currentAvg = this.stats.averageRoutingTime;
    this.stats.averageRoutingTime = (currentAvg * (total - 1) + routingTime) / total;

    // Update error rate
    if (!success) {
      const errorCount = Math.round(this.stats.errorRate * (total - 1));
      this.stats.errorRate = (errorCount + 1) / total;
    }
  }

  /**
   * Update region information
   */
  updateRegion(region: Region, info: Partial<RegionInfo>): void {
    const existing = this.config.regions.get(region);
    if (existing) {
      this.config.regions.set(region, { ...existing, ...info });
      this.geographicRouter.updateRegion(region, info);
    }
  }

  /**
   * Get load balancer statistics
   */
  getStats(): LoadBalancerStats {
    return { ...this.stats };
  }

  /**
   * Get routing history
   */
  getRoutingHistory(count?: number): RoutingDecision[] {
    if (count) {
      return this.routingHistory.slice(-count);
    }
    return [...this.routingHistory];
  }

  /**
   * Get health checker
   */
  getHealthChecker(): HealthChecker {
    return this.healthChecker;
  }

  /**
   * Get capacity router
   */
  getCapacityRouter(): CapacityRouter {
    return this.capacityRouter;
  }

  /**
   * Get latency router
   */
  getLatencyRouter(): LatencyRouter {
    return this.latencyRouter;
  }

  /**
   * Get traffic shaper
   */
  getTrafficShaper(): TrafficShaper {
    return this.trafficShaper;
  }

  /**
   * Get anycast router
   */
  getAnycastRouter(): AnycastRouter {
    return this.anycastRouter;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Health check for load balancer itself
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    components: Record<string, boolean>;
  }> {
    const components: Record<string, boolean> = {
      geographic: true,
      latency: true,
      capacity: true,
      health: true,
      traffic: true,
      anycast: true,
    };

    let healthy = true;

    // Check if we have healthy regions
    const healthyRegions = this.healthChecker.getHealthyRegions();
    if (healthyRegions.length === 0) {
      components.health = false;
      healthy = false;
    }

    return { healthy, components };
  }

  /**
   * Shutdown load balancer
   */
  async shutdown(): Promise<void> {
    this.latencyMonitor.stop();
  }
}
