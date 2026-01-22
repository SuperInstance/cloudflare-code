/**
 * Deployment Manager
 *
 * Manages multi-region deployments with support for canary releases,
 * blue-green deployments, traffic routing, and automatic rollback.
 */

import type {
  DeploymentConfig,
  DeploymentState,
  DeploymentStatus,
  RegionDeployment,
  DeploymentEvent,
  DeploymentMetrics,
  TrafficRule,
  TrafficRoutingResult,
  RollbackOptions,
  Region,
  DeploymentManagerOptions,
} from './types';

/**
 * Deployment Manager
 *
 * Orchestrates deployments across multiple regions with various strategies.
 */
export class DeploymentManager {
  private kv?: KVNamespace;
  private doNamespace?: DurableObjectNamespace;
  private options: Required<Omit<DeploymentManagerOptions, 'kv' | 'doNamespace'>> & {
    kv?: KVNamespace;
    doNamespace?: DurableObjectNamespace;
  };

  // Deployment state
  private deployments: Map<string, DeploymentState>;
  private activeDeployment?: string;
  private events: DeploymentEvent[] = [];

  // Metrics
  private metrics: Map<string, DeploymentMetrics>;

  // Timers
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private canaryProgressTimer?: Map<string, ReturnType<typeof setInterval>>;

  constructor(options: DeploymentManagerOptions = {}) {
    if (options.kv !== undefined) {
      this.kv = options.kv;
    }
    if (options.doNamespace !== undefined) {
      this.doNamespace = options.doNamespace;
    }

    this.options = {
      enableAutoRollback: options.enableAutoRollback ?? true,
      enableMetrics: options.enableMetrics ?? true,
      enableEventLogging: options.enableEventLogging ?? true,
      defaultTimeout: options.defaultTimeout ?? 600000, // 10 minutes
      healthCheckInterval: options.healthCheckInterval ?? 30000, // 30 seconds
      maxConcurrentDeployments: options.maxConcurrentDeployments ?? 5,
      kv: options.kv,
      doNamespace: options.doNamespace,
    };

    this.deployments = new Map();
    this.metrics = new Map();

    // Load persisted state
    this.loadState();

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Create a new deployment
   */
  async createDeployment(config: DeploymentConfig): Promise<string> {
    const deploymentId = config.id;

    // Check for concurrent deployment limit
    if (this.activeDeployment && this.deployments.has(this.activeDeployment)) {
      const active = this.deployments.get(this.activeDeployment);
      if (
        active &&
        (active.status === 'deploying' ||
          active.status === 'pending')
      ) {
        throw new Error('Another deployment is already in progress');
      }
    }

    // Initialize deployment state
    const now = Date.now();
    const state: DeploymentState = {
      config,
      status: 'pending',
      regions: new Map(),
      createdAt: now,
      updatedAt: now,
    };

    // Initialize region deployments
    for (const region of config.regions) {
      state.regions.set(region, {
        region,
        version: config.version,
        status: 'pending',
        health: 'unknown',
      });
    }

    // Store deployment
    this.deployments.set(deploymentId, state);

    // Log event
    this.logEvent({
      id: this.generateEventId(),
      timestamp: now,
      deploymentId,
      type: 'created',
      message: `Deployment ${deploymentId} created for version ${config.version.version}`,
    });

    // Persist state
    await this.saveState();

    return deploymentId;
  }

  /**
   * Start a deployment
   */
  async startDeployment(deploymentId: string): Promise<void> {
    const state = this.deployments.get(deploymentId);
    if (!state) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    if (state.status !== 'pending') {
      throw new Error(`Deployment ${deploymentId} is not in pending state`);
    }

    // Set as active deployment
    this.activeDeployment = deploymentId;

    // Update status
    state.status = 'deploying';
    state.startedAt = Date.now();
    state.updatedAt = Date.now();

    // Log event
    this.logEvent({
      id: this.generateEventId(),
      timestamp: state.startedAt,
      deploymentId,
      type: 'started',
      previousState: 'pending',
      newState: 'deploying',
      message: `Deployment ${deploymentId} started`,
    });

    // Execute deployment based on strategy
    switch (state.config.strategy) {
      case 'canary':
        await this.executeCanaryDeployment(state);
        break;
      case 'blue-green':
        await this.executeBlueGreenDeployment(state);
        break;
      case 'rolling':
        await this.executeRollingDeployment(state);
        break;
      case 'all-at-once':
        await this.executeAllAtOnceDeployment(state);
        break;
      default:
        throw new Error(`Unknown deployment strategy: ${state.config.strategy}`);
    }

    // Persist state
    await this.saveState();
  }

  /**
   * Get deployment state
   */
  getDeployment(deploymentId: string): DeploymentState | undefined {
    return this.deployments.get(deploymentId);
  }

  /**
   * Get all deployments
   */
  getAllDeployments(): DeploymentState[] {
    return Array.from(this.deployments.values());
  }

  /**
   * Get active deployment
   */
  getActiveDeployment(): DeploymentState | undefined {
    if (this.activeDeployment) {
      return this.deployments.get(this.activeDeployment);
    }
    return undefined;
  }

  /**
   * Rollback a deployment
   */
  async rollback(deploymentId: string, options?: RollbackOptions): Promise<void> {
    const state = this.deployments.get(deploymentId);
    if (!state) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    if (!state.previousDeployment) {
      throw new Error(`No previous deployment to rollback to`);
    }

    state.status = 'rolling-back';
    state.updatedAt = Date.now();

    this.logEvent({
      id: this.generateEventId(),
      timestamp: state.updatedAt,
      deploymentId,
      type: 'rollback',
      message: `Rolling back deployment ${deploymentId}`,
    });

    // Determine target version
    const targetVersion = options?.version ?? state.previousDeployment.config.version.version;
    const targetRegions = options?.regions ?? state.config.regions;

    // Execute rollback
    if (options?.immediate) {
      // Immediate rollback - switch all traffic back
      for (const region of targetRegions) {
        const regionDeployment = state.regions.get(region);
        if (regionDeployment) {
          regionDeployment.status = 'rolled-back';
          regionDeployment.version = state.previousDeployment!.config.version;
          regionDeployment.health = 'unknown';
        }
      }
    } else {
      // Gradual rollback
      for (const region of targetRegions) {
        await this.deployToRegion(
          deploymentId,
          region,
          state.previousDeployment.config.version
        );
      }
    }

    state.status = 'rolled-back';
    state.updatedAt = Date.now();
    state.completedAt = Date.now();

    this.logEvent({
      id: this.generateEventId(),
      timestamp: state.updatedAt,
      deploymentId,
      type: 'rolled-back',
      message: `Deployment ${deploymentId} rolled back to version ${targetVersion}`,
    });

    await this.saveState();
  }

  /**
   * Route traffic based on rules
   */
  routeTraffic(
    deploymentId: string,
    request: Request
  ): TrafficRoutingResult {
    const state = this.deployments.get(deploymentId);
    if (!state) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    // Check traffic rules
    if (state.config.trafficRules) {
      for (const rule of state.config.trafficRules) {
        if (!rule.enabled) continue;

        const match = this.evaluateTrafficRule(rule, request);
        if (match) {
          return {
            version: rule.condition.version,
            region: this.selectRegionForVersion(state, rule.condition.version),
            reason: `Matched traffic rule ${rule.id}`,
            matchedRule: rule,
          };
        }
      }
    }

    // Default routing - use primary version
    return {
      version: state.config.version.version,
      region: this.selectRegionForVersion(state, state.config.version.version),
      reason: 'Default routing to primary version',
    };
  }

  /**
   * Get deployment events
   */
  getEvents(deploymentId?: string, limit?: number): DeploymentEvent[] {
    let events = this.events;

    if (deploymentId) {
      events = events.filter((e) => e.deploymentId === deploymentId);
    }

    if (limit) {
      events = events.slice(-limit);
    }

    return events;
  }

  /**
   * Get deployment metrics
   */
  getMetrics(deploymentId: string): DeploymentMetrics | undefined {
    return this.metrics.get(deploymentId);
  }

  /**
   * Update deployment metrics
   */
  async updateMetrics(
    deploymentId: string,
    metrics: Partial<DeploymentMetrics>
  ): Promise<void> {
    const existing = this.metrics.get(deploymentId) ?? {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errorRate: 0,
      avgResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestsByRegion: new Map(),
      requestsByVersion: new Map(),
    };

    // Merge metrics
    const updated: DeploymentMetrics = {
      ...existing,
      ...metrics,
      requestsByRegion: new Map([...existing.requestsByRegion, ...(metrics.requestsByRegion ?? [])]),
      requestsByVersion: new Map([...existing.requestsByVersion, ...(metrics.requestsByVersion ?? [])]),
    };

    // Calculate error rate
    if (updated.totalRequests > 0) {
      updated.errorRate = updated.failedRequests / updated.totalRequests;
    }

    this.metrics.set(deploymentId, updated);

    // Check auto-rollback thresholds
    if (this.options.enableAutoRollback) {
      const state = this.deployments.get(deploymentId);
      if (state && state.config.rollback?.autoRollback) {
        const threshold = state.config.rollback.threshold ?? 0.05; // 5% default
        if (updated.errorRate > threshold) {
          console.warn(`Error rate ${updated.errorRate} exceeds threshold ${threshold}, triggering rollback`);
          await this.rollback(deploymentId);
        }
      }
    }
  }

  /**
   * Execute canary deployment strategy
   */
  private async executeCanaryDeployment(state: DeploymentState): Promise<void> {
    const config = state.config.canary;
    if (!config) {
      throw new Error('Canary configuration not provided');
    }

    let currentPercentage = config.initialPercentage;
    const targetVersion = state.config.version.version;

    // Deploy canary to initial percentage
    for (const region of state.config.regions) {
      const regionDeployment = state.regions.get(region);
      if (regionDeployment) {
        regionDeployment.percentage = currentPercentage;
        await this.deployToRegion(state.config.id, region, state.config.version);
      }
    }

    // Set up gradual traffic increase
    const progressTimer = setInterval(async () => {
      // Check if deployment is still active
      const currentState = this.deployments.get(state.config.id);
      if (!currentState || currentState.status !== 'deploying') {
        clearInterval(progressTimer);
        return;
      }

      // Get current metrics
      const metrics = this.metrics.get(state.config.id);
      if (metrics) {
        // Check if we should auto-promote or rollback
        if (metrics.errorRate < config.autoPromoteThreshold) {
          // Increase traffic percentage
          currentPercentage = Math.min(
            100,
            currentPercentage + config.incrementPercentage
          );

          this.logEvent({
            id: this.generateEventId(),
            timestamp: Date.now(),
            deploymentId: state.config.id,
            type: 'progress',
            message: `Increasing canary traffic to ${currentPercentage}%`,
          });

          // Update region percentages
          for (const region of state.config.regions) {
            const regionDeployment = state.regions.get(region);
            if (regionDeployment) {
              regionDeployment.percentage = currentPercentage;
            }
          }

          // Check if fully promoted
          if (currentPercentage >= 100) {
            clearInterval(progressTimer);
            await this.completeDeployment(state.config.id);
          }
        } else if (metrics.errorRate > config.autoRollbackThreshold) {
          // Auto-rollback
          clearInterval(progressTimer);
          await this.rollback(state.config.id);
        }
      }

      await this.saveState();
    }, config.incrementInterval);

    this.canaryProgressTimer?.set(state.config.id, progressTimer);
  }

  /**
   * Execute blue-green deployment strategy
   */
  private async executeBlueGreenDeployment(state: DeploymentState): Promise<void> {
    const config = state.config.blueGreen;
    if (!config) {
      throw new Error('Blue-green configuration not provided');
    }

    // Deploy to all regions (green environment)
    for (const region of state.config.regions) {
      await this.deployToRegion(state.config.id, region, state.config.version);
    }

    // Wait for health check duration
    await this.delay(config.healthCheckDuration);

    // Check health of all regions
    let allHealthy = true;
    for (const [region, regionDeployment] of state.regions) {
      if (regionDeployment.health !== 'healthy') {
        allHealthy = false;
        break;
      }
    }

    if (allHealthy) {
      // All regions healthy, perform cutover
      if (config.autoCutover) {
        await this.completeDeployment(state.config.id);
      }
    } else {
      // Some regions unhealthy, rollback
      await this.rollback(state.config.id);
    }
  }

  /**
   * Execute rolling deployment strategy
   */
  private async executeRollingDeployment(state: DeploymentState): Promise<void> {
    const config = state.config.rolling;
    if (!config) {
      throw new Error('Rolling configuration not provided');
    }

    const regions = state.config.regions;
    const batchSize = Math.max(1, Math.floor((config.batchSize / 100) * regions.length));

    // Deploy in batches
    for (let i = 0; i < regions.length; i += batchSize) {
      const batch = regions.slice(i, i + batchSize);

      // Deploy to batch
      for (const region of batch) {
        await this.deployToRegion(state.config.id, region, state.config.version);
      }

      // Wait for health check duration
      await this.delay(config.healthCheckDuration);

      // Wait batch interval
      await this.delay(config.batchInterval);
    }

    await this.completeDeployment(state.config.id);
  }

  /**
   * Execute all-at-once deployment strategy
   */
  private async executeAllAtOnceDeployment(state: DeploymentState): Promise<void> {
    // Deploy to all regions simultaneously
    await Promise.all(
      state.config.regions.map((region) =>
        this.deployToRegion(state.config.id, region, state.config.version)
      )
    );

    await this.completeDeployment(state.config.id);
  }

  /**
   * Deploy to a specific region
   */
  private async deployToRegion(
    deploymentId: string,
    region: Region,
    version: { version: string; commitSha: string; buildTime: number }
  ): Promise<void> {
    const state = this.deployments.get(deploymentId);
    if (!state) return;

    const regionDeployment = state.regions.get(region);
    if (!regionDeployment) return;

    regionDeployment.status = 'deploying';
    regionDeployment.version = version;

    this.logEvent({
      id: this.generateEventId(),
      timestamp: Date.now(),
      deploymentId,
      region,
      type: 'progress',
      message: `Deploying version ${version.version} to ${region}`,
    });

    // Simulate deployment (in real implementation, would deploy to region)
    await this.delay(1000);

    regionDeployment.status = 'deployed';
    regionDeployment.health = 'healthy';
    regionDeployment.deployedAt = Date.now();
    regionDeployment.lastHealthCheck = Date.now();
  }

  /**
   * Complete a deployment
   */
  private async completeDeployment(deploymentId: string): Promise<void> {
    const state = this.deployments.get(deploymentId);
    if (!state) return;

    state.status = 'deployed';
    state.updatedAt = Date.now();
    state.completedAt = Date.now();

    this.activeDeployment = undefined;

    this.logEvent({
      id: this.generateEventId(),
      timestamp: state.completedAt,
      deploymentId,
      type: 'completed',
      previousState: 'deploying',
      newState: 'deployed',
      message: `Deployment ${deploymentId} completed successfully`,
    });

    await this.saveState();
  }

  /**
   * Evaluate traffic rule
   */
  private evaluateTrafficRule(rule: TrafficRule, request: Request): boolean {
    switch (rule.type) {
      case 'percentage':
        // Random percentage match
        return Math.random() * 100 < (rule.condition.percentage ?? 100);

      case 'header': {
        const header = request.headers.get(rule.condition.header!.name);
        const value = rule.condition.header!.value;
        if (value instanceof RegExp) {
          return header !== null && value.test(header);
        }
        return header === value;
      }

      case 'cookie': {
        const cookieHeader = request.headers.get('Cookie');
        if (!cookieHeader) return false;

        const cookies = cookieHeader.split(';').map((c) => c.trim());
        const targetCookie = cookies.find((c) =>
          c.startsWith(`${rule.condition.cookie!.name}=`)
        );

        if (!targetCookie) return false;

        const value = targetCookie.split('=')[1];
        const expectedValue = rule.condition.cookie!.value;

        if (expectedValue instanceof RegExp) {
          return expectedValue.test(value);
        }
        return value === expectedValue;
      }

      case 'geo':
        // Would need to determine user's region from request
        // For now, return false
        return false;

      case 'weighted':
        // Weighted random selection
        return Math.random() * 100 < (rule.condition.weight ?? 50);

      default:
        return false;
    }
  }

  /**
   * Select region for a specific version
   */
  private selectRegionForVersion(state: DeploymentState, version: string): Region {
    // Find regions with the specified version
    const regions = Array.from(state.regions.entries())
      .filter(([, deployment]) => deployment.version.version === version)
      .map(([region]) => region);

    // Return first healthy region, or first region if none healthy
    const healthyRegion = regions.find((region) => {
      const deployment = state.regions.get(region);
      return deployment?.health === 'healthy';
    });

    return healthyRegion ?? regions[0] ?? state.config.regions[0];
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      for (const [deploymentId, state] of this.deployments.entries()) {
        if (state.status !== 'deploying' && state.status !== 'deployed') {
          continue;
        }

        for (const [region, regionDeployment] of state.regions) {
          // Perform health check
          const health = await this.performHealthCheck(regionDeployment);

          // Update if health changed
          if (health !== regionDeployment.health) {
            regionDeployment.health = health;
            regionDeployment.lastHealthCheck = Date.now();

            this.logEvent({
              id: this.generateEventId(),
              timestamp: Date.now(),
              deploymentId,
              region,
              type: 'progress',
              message: `Health status for ${region} changed to ${health}`,
            });
          }
        }
      }

      await this.saveState();
    }, this.options.healthCheckInterval);
  }

  /**
   * Perform health check for a region deployment
   */
  private async performHealthCheck(deployment: RegionDeployment): Promise<'healthy' | 'degraded' | 'unhealthy' | 'unknown'> {
    // In real implementation, would call health check endpoint
    // For now, return healthy
    return 'healthy';
  }

  /**
   * Log deployment event
   */
  private logEvent(event: DeploymentEvent): void {
    this.events.push(event);

    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    if (this.options.enableEventLogging) {
      console.log('[Deployment Event]', event.type, event.message);
    }
  }

  /**
   * Generate event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save state to persistence
   */
  private async saveState(): Promise<void> {
    if (!this.kv) return;

    try {
      const state = {
        deployments: Array.from(this.deployments.entries()).map(([id, state]) => [
          id,
          {
            ...state,
            regions: Array.from(state.regions.entries()),
          },
        ]),
        activeDeployment: this.activeDeployment,
        metrics: Array.from(this.metrics.entries()),
      };

      await this.kv.put('deployment-manager', JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save deployment manager state:', error);
    }
  }

  /**
   * Load state from persistence
   */
  private async loadState(): Promise<void> {
    if (!this.kv) return;

    try {
      const data = await this.kv.get('deployment-manager', 'json');
      if (!data) return;

      const state = data as {
        deployments: Array<[string, Omit<DeploymentState, 'regions'> & { regions: Array<[Region, RegionDeployment]> }]>;
        activeDeployment?: string;
        metrics: Array<[string, DeploymentMetrics]>;
      };

      this.deployments = new Map(
        state.deployments.map(([id, state]) => [
          id,
          { ...state, regions: new Map(state.regions) },
        ])
      );
      this.activeDeployment = state.activeDeployment;
      this.metrics = new Map(state.metrics);
    } catch (error) {
      console.error('Failed to load deployment manager state:', error);
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Dispose of deployment manager
   */
  dispose(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    for (const timer of this.canaryProgressTimer?.values() ?? []) {
      clearInterval(timer);
    }

    this.deployments.clear();
    this.metrics.clear();
    this.events = [];
  }
}

/**
 * Create a deployment manager
 */
export function createDeploymentManager(
  options?: DeploymentManagerOptions
): DeploymentManager {
  return new DeploymentManager(options);
}
