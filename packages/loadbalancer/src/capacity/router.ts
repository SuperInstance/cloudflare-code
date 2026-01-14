/**
 * Capacity-based routing engine
 * Routes requests based on real-time capacity and load
 */

import type {
  Region,
  CapacityMetrics,
  CapacityPrediction,
  CapacitySnapshot,
  RoutingContext,
  RoutingDecision,
  RoutingReason,
  RoutingAlternative,
} from '../types/index.js';
import { NoHealthyRegionsError, CapacityExceededError } from '../types/index.js';

export interface CapacityRouterConfig {
  maxUtilization: number; // Maximum utilization before redirect (0-1)
  warningThreshold: number; // Warning threshold (0-1)
  criticalThreshold: number; // Critical threshold (0-1)
  preferLowestUtilization: boolean;
  enablePrediction: boolean;
  autoScalingEnabled: boolean;
}

/**
 * Capacity-based router for load-aware routing
 */
export class CapacityRouter {
  private capacityStore: Map<Region, CapacityMetrics>;
  private predictions: Map<Region, CapacityPrediction>;
  private snapshots: Map<Region, CapacitySnapshot[]>;
  private config: CapacityRouterConfig;

  constructor(config: Partial<CapacityRouterConfig> = {}) {
    this.capacityStore = new Map();
    this.predictions = new Map();
    this.snapshots = new Map();
    this.config = {
      maxUtilization: 0.85,
      warningThreshold: 0.7,
      criticalThreshold: 0.9,
      preferLowestUtilization: true,
      enablePrediction: true,
      autoScalingEnabled: true,
      ...config,
    };
  }

  /**
   * Route request to region with best capacity availability
   */
  async route(context: RoutingContext): Promise<RoutingDecision> {
    const currentCapacity = await this.getCurrentCapacity();

    if (currentCapacity.size === 0) {
      throw new NoHealthyRegionsError();
    }

    // Score regions based on capacity
    const scoredRegions = this.scoreRegions(currentCapacity);

    // Select best region
    const selected = scoredRegions[0];
    if (!selected) {
      throw new NoHealthyRegionsError();
    }

    // Check if selected region has sufficient capacity
    if (selected.utilization > this.config.maxUtilization) {
      // Try to find a region with better capacity
      const alternative = scoredRegions.find(r => r.utilization <= this.config.maxUtilization);
      if (alternative) {
        return this.buildDecision(
          context,
          alternative.region,
          alternative.score,
          alternative.reasons,
          scoredRegions.slice(1, 4).map(s => s.region)
        );
      }

      // All regions are overloaded
      throw new CapacityExceededError(
        selected.region,
        Math.round(selected.utilization * 100)
      );
    }

    return this.buildDecision(
      context,
      selected.region,
      selected.score,
      selected.reasons,
      scoredRegions.slice(1, 4).map(s => s.region)
    );
  }

  /**
   * Get current capacity for all regions
   */
  private async getCurrentCapacity(): Promise<Map<Region, CapacityMetrics>> {
    const current = new Map<Region, CapacityMetrics>();

    for (const [region, metrics] of this.capacityStore) {
      // Check if metrics are recent (within 5 seconds)
      if (Date.now() - metrics.timestamp < 5000) {
        current.set(region, metrics);
      }
    }

    return current;
  }

  /**
   * Score regions based on capacity metrics
   */
  private scoreRegions(
    capacityData: Map<Region, CapacityMetrics>
  ): Array<{
    region: Region;
    utilization: number;
    score: number;
    reasons: RoutingReason[];
  }> {
    const scores: Array<{
      region: Region;
      utilization: number;
      score: number;
      reasons: RoutingReason[];
    }> = [];

    for (const [region, metrics] of capacityData) {
      const utilization = metrics.utilizationPercentage;
      const reasons: RoutingReason[] = [];
      let score = 1000;

      // Primary factor: utilization (lower is better)
      const utilizationScore = (1 - utilization) * 500;
      score += utilizationScore;

      reasons.push({
        factor: 'capacity_utilization',
        weight: 0.5,
        score: 1 - utilization,
        description: `Utilization: ${(utilization * 100).toFixed(1)}% (${metrics.availableCapacity}/${metrics.totalCapacity} available)`,
      });

      // Factor 2: Queue length
      const queueScore = Math.max(0, 1 - (metrics.queueLength / 1000)) * 100;
      score += queueScore;

      reasons.push({
        factor: 'queue_length',
        weight: 0.2,
        score: Math.max(0, 1 - (metrics.queueLength / 1000)),
        description: `Queue length: ${metrics.queueLength}`,
      });

      // Factor 3: Active connections
      const connectionScore = Math.max(0, 1 - (metrics.activeConnections / 10000)) * 100;
      score += connectionScore;

      reasons.push({
        factor: 'active_connections',
        weight: 0.1,
        score: Math.max(0, 1 - (metrics.activeConnections / 10000)),
        description: `Active connections: ${metrics.activeConnections}`,
      });

      // Factor 4: Predicted capacity (if enabled)
      if (this.config.enablePrediction) {
        const prediction = this.predictions.get(region);
        if (prediction) {
          const predictionScore = (1 - prediction.predictedUtilization) * 100;
          score += predictionScore;

          reasons.push({
            factor: 'predicted_capacity',
            weight: 0.1,
            score: 1 - prediction.predictedUtilization,
            description: `Predicted utilization in 5min: ${(prediction.predictedUtilization * 100).toFixed(1)}%`,
          });

          // Consider time until overload
          if (prediction.timeUntilOverload < 300) {
            // Less than 5 minutes until overload
            score -= 200;
          }
        }
      }

      // Factor 5: Capacity trend
      const trend = this.analyzeTrend(region);
      if (trend === 'increasing') {
        score -= 50;
        reasons.push({
          factor: 'capacity_trend',
          weight: 0.1,
          score: 0.5,
          description: 'Capacity usage trending upward',
        });
      } else if (trend === 'decreasing') {
        score += 50;
        reasons.push({
          factor: 'capacity_trend',
          weight: 0.1,
          score: 1,
          description: 'Capacity usage trending downward',
        });
      }

      scores.push({
        region,
        utilization,
        score,
        reasons,
      });
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Update capacity metrics for a region
   */
  async updateCapacity(region: Region, metrics: CapacityMetrics): Promise<void> {
    this.capacityStore.set(region, metrics);

    // Store snapshot
    const snapshots = this.snapshots.get(region) || [];
    snapshots.push({
      region,
      timestamp: metrics.timestamp,
      metrics,
      prediction: this.predictions.get(region) || this.createEmptyPrediction(region),
      scalingEvents: [],
    });

    // Keep only last 100 snapshots
    if (snapshots.length > 100) {
      snapshots.splice(0, snapshots.length - 100);
    }

    this.snapshots.set(region, snapshots);

    // Trigger prediction update
    if (this.config.enablePrediction) {
      await this.updatePrediction(region);
    }

    // Check if scaling is needed
    if (this.config.autoScalingEnabled) {
      await this.checkScalingNeeded(region, metrics);
    }
  }

  /**
   * Update capacity prediction for a region
   */
  private async updatePrediction(region: Region): Promise<void> {
    const snapshots = this.snapshots.get(region) || [];
    if (snapshots.length < 10) return;

    const recent = snapshots.slice(-20);
    const utilizations = recent.map(s => s.metrics.utilizationPercentage);

    // Linear regression for prediction
    const n = utilizations.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = utilizations.reduce((sum, val) => sum + val, 0);
    const sumXY = utilizations.reduce((sum, val, i) => sum + (i * val), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict utilization 5 minutes in the future
    const futureSteps = 10; // Assuming snapshots every 30 seconds
    const predictedUtilization = Math.max(0, Math.min(1, slope * (n + futureSteps) + intercept));

    // Calculate time until overload
    const currentUtilization = utilizations[n - 1];
    let timeUntilOverload = Infinity;

    if (slope > 0) {
      timeUntilOverload = ((1 - currentUtilization) / slope) * 30; // 30 seconds per step
    }

    const prediction: CapacityPrediction = {
      region,
      currentCapacity: recent[n - 1].metrics.totalCapacity,
      predictedCapacity: recent[n - 1].metrics.totalCapacity, // Assuming constant capacity
      predictedUtilization,
      timeUntilOverload: Math.round(timeUntilOverload),
      confidence: Math.max(0, 1 - Math.abs(slope) * 10), // Higher confidence for stable trends
    };

    this.predictions.set(region, prediction);
  }

  /**
   * Check if scaling is needed for a region
   */
  private async checkScalingNeeded(
    region: Region,
    metrics: CapacityMetrics
  ): Promise<void> {
    if (metrics.utilizationPercentage >= this.config.criticalThreshold) {
      // Trigger scale up
      await this.triggerScaleUp(region, metrics);
    } else if (metrics.utilizationPercentage < this.config.warningThreshold * 0.5) {
      // Consider scale down
      await this.triggerScaleDown(region, metrics);
    }
  }

  /**
   * Trigger scale up for a region
   */
  private async triggerScaleUp(
    region: Region,
    metrics: CapacityMetrics
  ): Promise<void> {
    // In production, this would call auto-scaling service
    console.log(`[CapacityRouter] Scale up triggered for ${region}`, {
      currentUtilization: metrics.utilizationPercentage,
      threshold: this.config.criticalThreshold,
    });
  }

  /**
   * Trigger scale down for a region
   */
  private async triggerScaleDown(
    region: Region,
    metrics: CapacityMetrics
  ): Promise<void> {
    // In production, this would call auto-scaling service
    console.log(`[CapacityRouter] Scale down triggered for ${region}`, {
      currentUtilization: metrics.utilizationPercentage,
      threshold: this.config.warningThreshold * 0.5,
    });
  }

  /**
   * Analyze capacity trend for a region
   */
  private analyzeTrend(region: Region): 'increasing' | 'stable' | 'decreasing' {
    const snapshots = this.snapshots.get(region) || [];
    if (snapshots.length < 5) return 'stable';

    const recent = snapshots.slice(-10);
    const utilizations = recent.map(s => s.metrics.utilizationPercentage);

    const firstHalf = utilizations.slice(0, Math.floor(utilizations.length / 2));
    const secondHalf = utilizations.slice(Math.floor(utilizations.length / 2));

    const avgFirst = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    const change = (avgSecond - avgFirst) / avgFirst;

    if (change > 0.05) return 'increasing';
    if (change < -0.05) return 'decreasing';
    return 'stable';
  }

  /**
   * Build routing decision
   */
  private buildDecision(
    context: RoutingContext,
    selectedRegion: Region,
    score: number,
    reasons: RoutingReason[],
    alternatives: Region[]
  ): RoutingDecision {
    return {
      requestId: context.requestId,
      selectedRegion,
      selectedDatacenter: '',
      selectedEndpoint: '',
      reasoning: reasons,
      confidence: Math.min(1, score / 1000),
      timestamp: Date.now(),
      alternatives: alternatives.map(alt => ({
        region: alt,
        score: 0.8,
        reason: 'Alternative region with available capacity',
      })),
    };
  }

  /**
   * Create empty prediction
   */
  private createEmptyPrediction(region: Region): CapacityPrediction {
    return {
      region,
      currentCapacity: 0,
      predictedCapacity: 0,
      predictedUtilization: 0,
      timeUntilOverload: Infinity,
      confidence: 0,
    };
  }

  /**
   * Get capacity metrics for a region
   */
  getCapacity(region: Region): CapacityMetrics | null {
    return this.capacityStore.get(region) || null;
  }

  /**
   * Get capacity prediction for a region
   */
  getPrediction(region: Region): CapacityPrediction | null {
    return this.predictions.get(region) || null;
  }

  /**
   * Get capacity snapshots for a region
   */
  getSnapshots(region: Region, count: number = 10): CapacitySnapshot[] {
    const snapshots = this.snapshots.get(region) || [];
    return snapshots.slice(-count);
  }

  /**
   * Get all capacity metrics
   */
  getAllCapacity(): Map<Region, CapacityMetrics> {
    return new Map(this.capacityStore);
  }

  /**
   * Check if region is at capacity
   */
  isRegionAtCapacity(region: Region): boolean {
    const metrics = this.capacityStore.get(region);
    if (!metrics) return false;

    return metrics.utilizationPercentage >= this.config.maxUtilization;
  }

  /**
   * Get regions sorted by available capacity
   */
  getRegionsByCapacity(): Region[] {
    const regions = Array.from(this.capacityStore.entries())
      .sort(([, a], [, b]) => a.availableCapacity - b.availableCapacity)
      .map(([region]) => region);

    return regions;
  }

  /**
   * Get capacity statistics
   */
  getStats(): {
    totalRegions: number;
    overloadedRegions: number;
    warningRegions: number;
    healthyRegions: number;
    averageUtilization: number;
  } {
    const regions = Array.from(this.capacityStore.values());

    if (regions.length === 0) {
      return {
        totalRegions: 0,
        overloadedRegions: 0,
        warningRegions: 0,
        healthyRegions: 0,
        averageUtilization: 0,
      };
    }

    const overloaded = regions.filter(r => r.utilizationPercentage >= this.config.criticalThreshold).length;
    const warning = regions.filter(r =>
      r.utilizationPercentage >= this.config.warningThreshold &&
      r.utilizationPercentage < this.config.criticalThreshold
    ).length;
    const healthy = regions.length - overloaded - warning;
    const avgUtil = regions.reduce((sum, r) => sum + r.utilizationPercentage, 0) / regions.length;

    return {
      totalRegions: regions.length,
      overloadedRegions: overloaded,
      warningRegions: warning,
      healthyRegions: healthy,
      averageUtilization: avgUtil,
    };
  }
}
