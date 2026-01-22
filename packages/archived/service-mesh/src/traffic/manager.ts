// @ts-nocheck
/**
 * Traffic Management
 * Manages traffic routing, splitting, and canary deployments
 */

import {
  TrafficRule,
  TrafficMatch,
  TrafficRoute,
  TrafficSplit,
  TrafficVersion,
  CanaryConfig,
  TrafficMirror,
  HeaderOperations,
  LoadBalancingStrategy
} from '../types';

export interface TrafficRoutingResult {
  matched: boolean;
  rule?: TrafficRule;
  destination: string;
  mirrorDestinations?: string[];
  headers?: Headers;
  timeout?: number;
  retryPolicy?: any;
}

export class TrafficManager {
  private rules: TrafficRule[];
  private splits: Map<string, TrafficSplit>;
  private metrics: Map<string, RoutingMetrics>;

  constructor() {
    this.rules = [];
    this.splits = new Map();
    this.metrics = new Map();
  }

  /**
   * Add a traffic rule
   */
  addRule(rule: TrafficRule): void {
    this.rules.push(rule);
    this.sortRules();
  }

  /**
   * Remove a traffic rule
   */
  removeRule(ruleId: string): void {
    const index = this.rules.findIndex(r => r.id === ruleId);

    if (index !== -1) {
      this.rules.splice(index, 1);
    }
  }

  /**
   * Update a traffic rule
   */
  updateRule(ruleId: string, updates: Partial<TrafficRule>): boolean {
    const rule = this.rules.find(r => r.id === ruleId);

    if (!rule) {
      return false;
    }

    Object.assign(rule, updates);
    this.sortRules();

    return true;
  }

  /**
   * Get all traffic rules
   */
  getRules(): TrafficRule[] {
    return [...this.rules];
  }

  /**
   * Get a specific rule
   */
  getRule(ruleId: string): TrafficRule | undefined {
    return this.rules.find(r => r.id === ruleId);
  }

  /**
   * Add a traffic split
   */
  addSplit(split: TrafficSplit): void {
    this.splits.set(split.serviceName, split);
  }

  /**
   * Remove a traffic split
   */
  removeSplit(serviceName: string): void {
    this.splits.delete(serviceName);
  }

  /**
   * Get a traffic split
   */
  getSplit(serviceName: string): TrafficSplit | undefined {
    return this.splits.get(serviceName);
  }

  /**
   * Get all traffic splits
   */
  getSplits(): TrafficSplit[] {
    return Array.from(this.splits.values());
  }

  /**
   * Route a request based on rules
   */
  route(request: Request, metadata?: { clientIP?: string; userAgent?: string }): TrafficRoutingResult {
    const url = new URL(request.url);
    const method = request.method;

    // Find matching rule
    for (const rule of this.rules) {
      if (!rule.enabled) {
        continue;
      }

      if (this.matchesRule(request, url, method, rule.match, metadata)) {
        this.recordRouting(rule.id, true);

        const result: TrafficRoutingResult = {
          matched: true,
          rule,
          destination: this.buildDestination(rule.route, url),
          timeout: rule.timeout,
          retryPolicy: rule.retryPolicy
        };

        // Handle mirroring
        if (rule.mirror?.enabled) {
          result.mirrorDestinations = this.calculateMirrorDestinations(rule.mirror);
        }

        // Handle header operations
        if (rule.headers) {
          result.headers = this.applyHeaderOperations(request.headers, rule.headers);
        }

        return result;
      }
    }

    // No matching rule
    return {
      matched: false,
      destination: url.pathname
    };
  }

  /**
   * Route based on traffic split (canary, A/B testing)
   */
  routeSplit(
    serviceName: string,
    sessionId?: string
  ): { version: string; destination: string; weight: number } | null {
    const split = this.splits.get(serviceName);

    if (!split) {
      return null;
    }

    // Check for canary
    if (split.canary) {
      return this.routeCanary(split, sessionId);
    }

    // Standard weighted routing
    return this.routeWeighted(split, sessionId);
  }

  /**
   * Update canary weights
   */
  updateCanaryWeights(serviceName: string, metrics: { errorRate: number; latency: number }): void {
    const split = this.splits.get(serviceName);

    if (!split || !split.canary) {
      return;
    }

    const canary = split.canary;

    // Check if we should rollback
    if (metrics.errorRate > canary.rollbackThreshold ||
        metrics.latency > canary.latencyThreshold) {

      // Rollback to default
      canary.weight = 0;
      return;
    }

    // Gradually increase weight
    if (canary.weight < canary.maxWeight) {
      canary.weight = Math.min(
        canary.maxWeight,
        canary.weight + canary.incrementStep
      );
    }
  }

  /**
   * Get routing metrics
   */
  getMetrics(ruleId?: string): RoutingMetrics | Map<string, RoutingMetrics> {
    if (ruleId) {
      return this.metrics.get(ruleId) || this.createRoutingMetrics();
    }

    return new Map(this.metrics);
  }

  /**
   * Reset routing metrics
   */
  resetMetrics(ruleId?: string): void {
    if (ruleId) {
      this.metrics.delete(ruleId);
    } else {
      this.metrics.clear();
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private sortRules(): void {
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  private matchesRule(
    request: Request,
    url: URL,
    method: string,
    match: TrafficMatch,
    metadata?: { clientIP?: string; userAgent?: string }
  ): boolean {
    // Check method
    if (match.method && match.method !== method) {
      return false;
    }

    // Check path
    if (match.path && match.path !== url.pathname) {
      return false;
    }

    // Check path prefix
    if (match.pathPrefix && !url.pathname.startsWith(match.pathPrefix)) {
      return false;
    }

    // Check query parameters
    if (match.queryParams) {
      for (const [key, value] of Object.entries(match.queryParams)) {
        const paramValue = url.searchParams.get(key);
        if (paramValue !== value) {
          return false;
        }
      }
    }

    // Check headers
    if (match.headers) {
      for (const [key, value] of Object.entries(match.headers)) {
        const headerValue = request.headers.get(key);
        if (headerValue !== value) {
          return false;
        }
      }
    }

    // Check source service
    if (match.sourceService) {
      const sourceService = request.headers.get('x-source-service');
      if (sourceService !== match.sourceService) {
        return false;
      }
    }

    // Check user agent
    if (match.userAgent) {
      const userAgent = request.headers.get('user-agent') || '';
      if (!userAgent.includes(match.userAgent)) {
        return false;
      }
    }

    return true;
  }

  private buildDestination(route: TrafficRoute, url: URL): string {
    switch (route.type) {
      case 'service':
        return route.destination;

      case 'url':
        return route.destination;

      case 'redirect':
        return route.destination;

      default:
        return url.pathname;
    }
  }

  private calculateMirrorDestinations(mirror: TrafficMirror): string[] {
    const destinations: string[] = [];

    if (Math.random() * 100 < mirror.sampleRate) {
      destinations.push(mirror.destination);
    }

    return destinations;
  }

  private applyHeaderOperations(
    requestHeaders: Headers,
    operations: HeaderOperations
  ): Headers {
    const headers = new Headers(requestHeaders);

    // Apply request header operations
    if (operations.request) {
      for (const op of operations.request) {
        switch (op.action) {
          case 'add':
            if (!headers.has(op.header)) {
              headers.set(op.header, op.value || '');
            }
            break;

          case 'remove':
            headers.delete(op.header);
            break;

          case 'replace':
            headers.set(op.header, op.value || '');
            break;
        }
      }
    }

    return headers;
  }

  private routeCanary(
    split: TrafficSplit,
    sessionId?: string
  ): { version: string; destination: string; weight: number } {
    const canary = split.canary!;

    // Check if session is in canary
    if (sessionId && this.isSessionInCanary(sessionId, canary.weight)) {
      const version = split.versions.find(v => v.name === canary.version);
      if (version) {
        return {
          version: canary.version,
          destination: version.instances[0], // Simplified
          weight: canary.weight
        };
      }
    }

    // Route to default version
    const defaultVersion = split.versions.find(v => v.name === split.defaultVersion);
    if (defaultVersion) {
      return {
        version: split.defaultVersion,
        destination: defaultVersion.instances[0],
        weight: 100 - canary.weight
      };
    }

    return {
      version: split.defaultVersion,
      destination: split.versions[0]?.instances[0] || '',
      weight: 100
    };
  }

  private routeWeighted(
    split: TrafficSplit,
    sessionId?: string
  ): { version: string; destination: string; weight: number } | null {
    // Validate total weight
    const totalWeight = split.versions.reduce((sum, v) => sum + v.weight, 0);

    if (totalWeight === 0) {
      return null;
    }

    // Select version based on weight
    let random = Math.random() * totalWeight;

    for (const version of split.versions) {
      random -= version.weight;

      if (random <= 0) {
        return {
          version: version.name,
          destination: version.instances[0] || '', // Simplified
          weight: version.weight
        };
      }
    }

    // Fallback to first version
    return {
      version: split.versions[0].name,
      destination: split.versions[0].instances[0] || '',
      weight: split.versions[0].weight
    };
  }

  private isSessionInCanary(sessionId: string, canaryWeight: number): boolean {
    // Consistent hashing based on session ID
    const hash = this.hashCode(sessionId);
    const normalizedHash = Math.abs(hash) % 100;

    return normalizedHash < canaryWeight;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash;
  }

  private recordRouting(ruleId: string, matched: boolean): void {
    let metrics = this.metrics.get(ruleId);

    if (!metrics) {
      metrics = this.createRoutingMetrics();
      this.metrics.set(ruleId, metrics);
    }

    metrics.totalRequests++;

    if (matched) {
      metrics.matchedRequests++;
    }
  }

  private createRoutingMetrics(): RoutingMetrics {
    return {
      totalRequests: 0,
      matchedRequests: 0,
      timestamps: []
    };
  }
}

/**
 * Routing Metrics
 */
export interface RoutingMetrics {
  totalRequests: number;
  matchedRequests: number;
  timestamps: number[];
}

// ========================================================================
// Traffic Split Controller
// ========================================================================

export class TrafficSplitController {
  private trafficManager: TrafficManager;
  private metricsCollector: any;

  constructor(trafficManager: TrafficManager, metricsCollector?: any) {
    this.trafficManager = trafficManager;
    this.metricsCollector = metricsCollector;
  }

  /**
   * Start canary deployment
   */
  async startCanary(
    serviceName: string,
    canaryVersion: string,
    config: Partial<CanaryConfig> = {}
  ): Promise<void> {
    const split = this.trafficManager.getSplit(serviceName);

    if (!split) {
      throw new Error(`Traffic split not found for service: ${serviceName}`);
    }

    split.canary = {
      version: canaryVersion,
      weight: config.weight || 10,
      incrementStep: config.incrementStep || 5,
      incrementInterval: config.incrementInterval || 300000, // 5 minutes
      maxWeight: config.maxWeight || 100,
      metrics: config.metrics || { errorRate: 5, latencyThreshold: 1000 },
      rollbackThreshold: config.rollbackThreshold || 10
    };

    // Start gradual rollout
    this.startCanaryRollout(serviceName, split.canary);
  }

  /**
   * Stop canary deployment
   */
  stopCanary(serviceName: string, promote: boolean = false): void {
    const split = this.trafficManager.getSplit(serviceName);

    if (!split || !split.canary) {
      return;
    }

    if (promote) {
      // Promote canary to default
      split.defaultVersion = split.canary.version;
      split.canary = undefined;
    } else {
      // Rollback
      split.canary = undefined;
    }
  }

  /**
   * Promote canary to production
   */
  promoteCanary(serviceName: string): void {
    this.stopCanary(serviceName, true);
  }

  /**
   * Rollback canary
   */
  rollbackCanary(serviceName: string): void {
    this.stopCanary(serviceName, false);
  }

  /**
   * Get canary status
   */
  getCanaryStatus(serviceName: string): {
    active: boolean;
    version?: string;
    currentWeight: number;
    maxWeight: number;
    metrics?: CanaryConfig['metrics'];
  } | null {
    const split = this.trafficManager.getSplit(serviceName);

    if (!split || !split.canary) {
      return null;
    }

    return {
      active: true,
      version: split.canary.version,
      currentWeight: split.canary.weight,
      maxWeight: split.canary.maxWeight,
      metrics: split.canary.metrics
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private startCanaryRollout(serviceName: string, canary: CanaryConfig): void {
    const rolloutInterval = setInterval(async () => {
      const split = this.trafficManager.getSplit(serviceName);

      if (!split || !split.canary) {
        clearInterval(rolloutInterval);
        return;
      }

      // Get metrics for canary version
      const metrics = await this.getCanaryMetrics(serviceName, canary.version);

      if (metrics) {
        this.trafficManager.updateCanaryWeights(serviceName, metrics);
      }

      // Check if we've reached max weight
      if (canary.weight >= canary.maxWeight) {
        clearInterval(rolloutInterval);
      }
    }, canary.incrementInterval);
  }

  private async getCanaryMetrics(
    serviceName: string,
    version: string
  ): Promise<{ errorRate: number; latency: number } | null> {
    // This would integrate with the metrics collector
    // For now, return null
    return null;
  }
}
