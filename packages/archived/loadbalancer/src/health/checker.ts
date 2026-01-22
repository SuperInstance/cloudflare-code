/**
 * Health checking system
 * Monitors health of regions and triggers failover
 */

import type {
  Region,
  HealthCheckConfig,
  HealthCheck,
  HealthStatus,
  HealthCheckResult,
  HealthScore,
  HealthScoreComponent,
  FailoverConfig,
  FailoverEvent,
} from '../types/index.js';

export interface HealthCheckerConfig {
  defaultCheckInterval: number;
  defaultTimeout: number;
  defaultUnhealthyThreshold: number;
  defaultHealthyThreshold: number;
  failoverConfig: FailoverConfig;
  enableActiveChecks: boolean;
  enablePassiveChecks: boolean;
}

export interface PassiveHealthMetric {
  region: Region;
  timestamp: number;
  errorRate: number;
  latency: number;
  timeoutRate: number;
  successRate: number;
}

/**
 * Health checker for monitoring region health
 */
export class HealthChecker {
  private healthChecks: Map<string, HealthCheck>;
  private healthResults: Map<Region, HealthCheckResult[]>;
  private healthScores: Map<Region, HealthScore>;
  private passiveMetrics: Map<Region, PassiveHealthMetric[]>;
  private failoverHistory: FailoverEvent[];
  private config: HealthCheckerConfig;

  constructor(config: Partial<HealthCheckerConfig> = {}) {
    this.healthChecks = new Map();
    this.healthResults = new Map();
    this.healthScores = new Map();
    this.passiveMetrics = new Map();
    this.failoverHistory = [];

    this.config = {
      defaultCheckInterval: 30000, // 30 seconds
      defaultTimeout: 5000, // 5 seconds
      defaultUnhealthyThreshold: 3,
      defaultHealthyThreshold: 2,
      failoverConfig: {
        enabled: true,
        automaticFailover: true,
        failoverThreshold: 0.3,
        recoveryMode: 'automatic',
        minHealthyRegions: 2,
      },
      enableActiveChecks: true,
      enablePassiveChecks: true,
      ...config,
    };
  }

  /**
   * Register a health check for a region
   */
  registerHealthCheck(
    id: string,
    region: Region,
    target: string,
    config: Partial<HealthCheckConfig> = {}
  ): void {
    const checkConfig: HealthCheckConfig = {
      interval: this.config.defaultCheckInterval,
      timeout: this.config.defaultTimeout,
      unhealthyThreshold: this.config.defaultUnhealthyThreshold,
      healthyThreshold: this.config.defaultHealthyThreshold,
      checkType: 'https',
      ...config,
    };

    const healthCheck: HealthCheck = {
      id,
      region,
      target,
      config: checkConfig,
      status: 'unknown',
      lastCheckTime: 0,
      nextCheckTime: Date.now(),
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
    };

    this.healthChecks.set(id, healthCheck);
  }

  /**
   * Perform health check
   */
  async performHealthCheck(checkId: string): Promise<HealthCheckResult> {
    const check = this.healthChecks.get(checkId);
    if (!check) {
      throw new Error(`Health check ${checkId} not found`);
    }

    const startTime = performance.now();
    let result: HealthCheckResult;

    try {
      // Perform the actual health check
      const isHealthy = await this.executeHealthCheck(check);
      const latency = performance.now() - startTime;

      result = {
        checkId,
        region: check.region,
        timestamp: Date.now(),
        status: isHealthy ? 'healthy' : 'unhealthy',
        latency: Math.round(latency),
        details: {
          checkType: check.config.checkType,
          target: check.target,
        },
      };

      // Update check state
      if (isHealthy) {
        check.consecutiveSuccesses++;
        check.consecutiveFailures = 0;

        // Mark as healthy if threshold reached
        if (check.consecutiveSuccesses >= check.config.healthyThreshold) {
          check.status = 'healthy';
        }
      } else {
        check.consecutiveFailures++;
        check.consecutiveSuccesses = 0;

        // Mark as unhealthy if threshold reached
        if (check.consecutiveFailures >= check.config.unhealthyThreshold) {
          check.status = 'unhealthy';

          // Trigger failover if enabled
          if (this.config.failoverConfig.automaticFailover) {
            await this.evaluateFailover(check.region);
          }
        }
      }

      check.lastCheckTime = Date.now();
      check.nextCheckTime = Date.now() + check.config.interval;

    } catch (error) {
      result = {
        checkId,
        region: check.region,
        timestamp: Date.now(),
        status: 'unhealthy',
        latency: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          checkType: check.config.checkType,
          target: check.target,
        },
      };

      check.consecutiveFailures++;
      check.consecutiveSuccesses = 0;
      check.lastCheckTime = Date.now();
      check.nextCheckTime = Date.now() + check.config.interval;
    }

    // Store result
    const results = this.healthResults.get(check.region) || [];
    results.push(result);

    // Keep only last 100 results
    if (results.length > 100) {
      results.splice(0, results.length - 100);
    }

    this.healthResults.set(check.region, results);

    // Update health score
    await this.updateHealthScore(check.region);

    return result;
  }

  /**
   * Execute health check based on type
   */
  private async executeHealthCheck(check: HealthCheck): Promise<boolean> {
    const { target, config } = check;

    switch (config.checkType) {
      case 'http':
      case 'https':
        return await this.performHTTPCheck(target, config.timeout);

      case 'tcp':
        return await this.performTCPCheck(target, config.timeout);

      case 'icmp':
        return await this.performICMPCheck(target, config.timeout);

      default:
        return false;
    }
  }

  /**
   * Perform HTTP/HTTPS health check
   */
  private async performHTTPCheck(target: string, timeout: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(target, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'ClaudeFlare-HealthCheck/1.0',
        },
      });

      clearTimeout(timeoutId);

      // Consider 2xx and 3xx as healthy
      return response.status >= 200 && response.status < 400;
    } catch {
      return false;
    }
  }

  /**
   * Perform TCP health check
   */
  private async performTCPCheck(target: string, timeout: number): Promise<boolean> {
    try {
      const url = new URL(target);
      const host = url.hostname;
      const port = parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);

      // In a real implementation, this would attempt a TCP connection
      // For now, simulate the check
      await new Promise(resolve => setTimeout(resolve, 100));

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Perform ICMP health check
   */
  private async performICMPCheck(target: string, timeout: number): Promise<boolean> {
    try {
      const url = new URL(target);
      const host = url.hostname;

      // In a real implementation, this would perform an actual ping
      // For now, simulate the check
      await new Promise(resolve => setTimeout(resolve, 50));

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update health score for a region
   */
  private async updateHealthScore(region: Region): Promise<void> {
    const results = this.healthResults.get(region) || [];
    if (results.length === 0) {
      return;
    }

    const recent = results.slice(-20);
    const successCount = recent.filter(r => r.status === 'healthy').length;
    const avgLatency = recent.reduce((sum, r) => sum + r.latency, 0) / recent.length;

    // Calculate component scores
    const components: HealthScoreComponent[] = [
      {
        name: 'success_rate',
        weight: 0.4,
        score: successCount / recent.length,
        details: `Recent success rate: ${((successCount / recent.length) * 100).toFixed(1)}%`,
      },
      {
        name: 'latency',
        weight: 0.3,
        score: Math.max(0, 1 - (avgLatency / 1000)),
        details: `Average latency: ${avgLatency.toFixed(0)}ms`,
      },
      {
        name: 'consistency',
        weight: 0.2,
        score: this.calculateConsistency(recent),
        details: 'Latency consistency score',
      },
      {
        name: 'passive_metrics',
        weight: 0.1,
        score: this.getPassiveMetricScore(region),
        details: 'Passive health metrics',
      },
    ];

    // Calculate weighted score
    let totalScore = 0;
    for (const component of components) {
      totalScore += component.score * component.weight;
    }

    // Determine trend
    const older = results.slice(-40, -20);
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';

    if (older.length > 0) {
      const olderSuccess = older.filter(r => r.status === 'healthy').length;
      const newerSuccess = successCount;

      if (newerSuccess > olderSuccess + 2) trend = 'improving';
      else if (newerSuccess < olderSuccess - 2) trend = 'degrading';
    }

    const healthScore: HealthScore = {
      region,
      score: Math.round(totalScore * 100),
      components,
      timestamp: Date.now(),
      trend,
    };

    this.healthScores.set(region, healthScore);
  }

  /**
   * Calculate consistency score based on latency variance
   */
  private calculateConsistency(results: HealthCheckResult[]): number {
    if (results.length < 2) return 1;

    const latencies = results.map(r => r.latency);
    const mean = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
    const variance = latencies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / latencies.length;
    const stdDev = Math.sqrt(variance);

    // Lower std dev = higher consistency
    return Math.max(0, 1 - (stdDev / mean));
  }

  /**
   * Get passive metric score for a region
   */
  private getPassiveMetricScore(region: Region): number {
    const metrics = this.passiveMetrics.get(region) || [];
    if (metrics.length === 0) return 1;

    const recent = metrics.slice(-100);
    const avgSuccessRate = recent.reduce((sum, m) => sum + m.successRate, 0) / recent.length;
    const avgErrorRate = recent.reduce((sum, m) => sum + m.errorRate, 0) / recent.length;

    return Math.max(0, avgSuccessRate - avgErrorRate);
  }

  /**
   * Record passive health metric
   */
  recordPassiveMetric(metric: PassiveHealthMetric): void {
    const metrics = this.passiveMetrics.get(metric.region) || [];
    metrics.push(metric);

    // Keep only last 1000 metrics
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }

    this.passiveMetrics.set(metric.region, metrics);

    // Update health score if passive checks are enabled
    if (this.config.enablePassiveChecks) {
      this.updateHealthScore(metric.region);
    }
  }

  /**
   * Evaluate if failover is needed
   */
  private async evaluateFailover(region: Region): Promise<void> {
    if (!this.config.failoverConfig.enabled) return;

    const healthScore = this.healthScores.get(region);
    if (!healthScore) return;

    // Check if score is below failover threshold
    if (healthScore.score < this.config.failoverConfig.failoverThreshold * 100) {
      // Check if we have enough healthy regions
      const healthyRegions = this.getHealthyRegions();

      if (healthyRegions.length < this.config.failoverConfig.minHealthyRegions) {
        console.warn(`[HealthChecker] Not enough healthy regions for failover`);
        return;
      }

      // Select best alternative region
      const alternative = this.selectFailoverTarget(region, healthyRegions);
      if (!alternative) return;

      // Create failover event
      const event: FailoverEvent = {
        id: `failover-${Date.now()}`,
        timestamp: Date.now(),
        fromRegion: region,
        toRegion: alternative,
        reason: `Health score ${healthScore.score} below threshold`,
        affectedUsers: 0, // Would be calculated from actual data
        status: 'in-progress',
      };

      this.failoverHistory.push(event);

      console.log(`[HealthChecker] Failover triggered: ${region} -> ${alternative}`);
    }
  }

  /**
   * Select best failover target region
   */
  private selectFailoverTarget(
    currentRegion: Region,
    healthyRegions: Region[]
  ): Region | null {
    // Score regions based on health score and other factors
    const scored = healthyRegions
      .filter(r => r !== currentRegion)
      .map(region => {
        const healthScore = this.healthScores.get(region);
        return {
          region,
          score: healthScore?.score || 0,
        };
      })
      .sort((a, b) => b.score - a.score);

    return scored[0]?.region || null;
  }

  /**
   * Get healthy regions
   */
  getHealthyRegions(): Region[] {
    const healthy: Region[] = [];

    for (const [region, score] of this.healthScores) {
      if (score.score >= 70) { // Consider 70+ as healthy
        healthy.push(region);
      }
    }

    return healthy;
  }

  /**
   * Get health status for a region
   */
  getHealthStatus(region: Region): HealthStatus {
    const checks = Array.from(this.healthChecks.values()).filter(c => c.region === region);

    if (checks.length === 0) return 'unknown';

    const allHealthy = checks.every(c => c.status === 'healthy');
    const anyUnhealthy = checks.some(c => c.status === 'unhealthy');

    if (allHealthy) return 'healthy';
    if (anyUnhealthy) return 'unhealthy';
    return 'unknown';
  }

  /**
   * Get health score for a region
   */
  getHealthScore(region: Region): HealthScore | null {
    return this.healthScores.get(region) || null;
  }

  /**
   * Get all health scores
   */
  getAllHealthScores(): Map<Region, HealthScore> {
    return new Map(this.healthScores);
  }

  /**
   * Get recent health results for a region
   */
  getRecentResults(region: Region, count: number = 10): HealthCheckResult[] {
    const results = this.healthResults.get(region) || [];
    return results.slice(-count);
  }

  /**
   * Get failover history
   */
  getFailoverHistory(): FailoverEvent[] {
    return [...this.failoverHistory];
  }

  /**
   * Update health check configuration
   */
  updateCheckConfig(checkId: string, config: Partial<HealthCheckConfig>): void {
    const check = this.healthChecks.get(checkId);
    if (check) {
      check.config = { ...check.config, ...config };
    }
  }

  /**
   * Remove health check
   */
  removeHealthCheck(checkId: string): void {
    this.healthChecks.delete(checkId);
  }

  /**
   * Get health checker statistics
   */
  getStats(): {
    totalChecks: number;
    healthyChecks: number;
    unhealthyChecks: number;
    unknownChecks: number;
    totalResults: number;
  } {
    const checks = Array.from(this.healthChecks.values());
    const healthy = checks.filter(c => c.status === 'healthy').length;
    const unhealthy = checks.filter(c => c.status === 'unhealthy').length;
    const unknown = checks.filter(c => c.status === 'unknown').length;

    const totalResults = Array.from(this.healthResults.values())
      .reduce((sum, results) => sum + results.length, 0);

    return {
      totalChecks: checks.length,
      healthyChecks: healthy,
      unhealthyChecks: unhealthy,
      unknownChecks: unknown,
      totalResults,
    };
  }
}
