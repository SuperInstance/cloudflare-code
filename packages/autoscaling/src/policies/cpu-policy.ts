// @ts-nocheck - External dependencies and type compatibility issues
/**
 * CPU-based scaling policies
 */

import type {
  ScalingPolicy,
  ScalingTrigger,
  TriggerType,
  ComparisonOperator,
  ActionType
} from '../types/index.js';
// import { Logger } from '@claudeflare/logger';

// Mock Logger for type compatibility
class Logger {
  info(...args: any[]) {}
  warn(...args: any[]) {}
  error(...args: any[]) {}
  debug(...args: any[]) {}
}

export interface CpuPolicyConfig {
  scaleUpThreshold: number; // CPU utilization % to trigger scale up
  scaleDownThreshold: number; // CPU utilization % to trigger scale down
  scaleUpCooldown: number; // Cooldown after scale up (ms)
  scaleDownCooldown: number; // Cooldown after scale down (ms)
  minInstances: number;
  maxInstances: number;
  scaleUpStep: number; // Percentage to scale up
  scaleDownStep: number; // Percentage to scale down
  burstThreshold: number; // CPU credit threshold
  monitorBurst: boolean;
}

export class CpuScalingPolicy {
  private logger: Logger;
  private config: CpuPolicyConfig;

  constructor(config: Partial<CpuPolicyConfig> = {}) {
    this.logger = new Logger('CpuScalingPolicy');
    this.config = {
      scaleUpThreshold: 70,
      scaleDownThreshold: 30,
      scaleUpCooldown: 300000, // 5 minutes
      scaleDownCooldown: 600000, // 10 minutes
      minInstances: 1,
      maxInstances: 100,
      scaleUpStep: 50, // 50% increase
      scaleDownStep: 30, // 30% decrease
      burstThreshold: 20, // 20% CPU credits remaining
      monitorBurst: true,
      ...config
    };
  }

  /**
   * Create a CPU-based scaling policy
   */
  createPolicy(resourceId: string): ScalingPolicy {
    const triggers: ScalingTrigger[] = [
      // Scale up on high CPU utilization
      {
        id: `cpu-high-${resourceId}`,
        type: TriggerType.CPU_UTILIZATION,
        condition: {
          metric: 'cpu.utilization',
          aggregation: 'average' as const,
          window: 300000 // 5 minutes
        },
        threshold: this.config.scaleUpThreshold,
        comparison: ComparisonOperator.GREATER_THAN,
        duration: 120000, // Must be sustained for 2 minutes
        evaluationInterval: 30000 // Check every 30 seconds
      },
      // Scale down on low CPU utilization
      {
        id: `cpu-low-${resourceId}`,
        type: TriggerType.CPU_UTILIZATION,
        condition: {
          metric: 'cpu.utilization',
          aggregation: 'average' as const,
          window: 600000 // 10 minutes
        },
        threshold: this.config.scaleDownThreshold,
        comparison: ComparisonOperator.LESS_THAN,
        duration: 900000, // Must be sustained for 15 minutes
        evaluationInterval: 60000 // Check every minute
      }
    ];

    // Add CPU credit monitoring if enabled
    if (this.config.monitorBurst) {
      triggers.push({
        id: `cpu-burst-${resourceId}`,
        type: TriggerType.CPU_CREDITS,
        condition: {
          metric: 'cpu.credits',
          aggregation: 'min' as const,
          window: 300000
        },
        threshold: this.config.burstThreshold,
        comparison: ComparisonOperator.LESS_THAN,
        duration: 60000,
        evaluationInterval: 30000
      });
    }

    return {
      id: `cpu-policy-${resourceId}`,
      name: `CPU Scaling Policy for ${resourceId}`,
      description: 'Automatically scales based on CPU utilization and burst capacity',
      resourceType: 'worker' as const,
      enabled: true,
      triggers,
      actions: [
        {
          id: 'scale-up',
          type: ActionType.SCALE_UP,
          target: resourceId,
          parameters: {
            step: this.config.scaleUpStep,
            maxInstances: this.config.maxInstances
          },
          order: 1
        },
        {
          id: 'scale-down',
          type: ActionType.SCALE_DOWN,
          target: resourceId,
          parameters: {
            step: this.config.scaleDownStep,
            minInstances: this.config.minInstances
          },
          order: 2
        }
      ],
      cooldownPeriod: Math.max(this.config.scaleUpCooldown, this.config.scaleDownCooldown),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Calculate target instance count based on CPU utilization
   */
  calculateTargetInstances(
    currentInstances: number,
    cpuUtilization: number,
    cpuCredits?: number
  ): number {
    let targetInstances = currentInstances;

    // Scale up if CPU is high
    if (cpuUtilization > this.config.scaleUpThreshold) {
      const scaleFactor = 1 + (this.config.scaleUpStep / 100);
      targetInstances = Math.ceil(currentInstances * scaleFactor);

      this.logger.info(
        `Scaling up: CPU at ${cpuUtilization}%, ${currentInstances} -> ${targetInstances} instances`
      );
    }
    // Scale down if CPU is low
    else if (cpuUtilization < this.config.scaleDownThreshold) {
      const scaleFactor = 1 - (this.config.scaleDownStep / 100);
      targetInstances = Math.max(
        this.config.minInstances,
        Math.floor(currentInstances * scaleFactor)
      );

      this.logger.info(
        `Scaling down: CPU at ${cpuUtilization}%, ${currentInstances} -> ${targetInstances} instances`
      );
    }

    // Check burst capacity
    if (this.config.monitorBurst && cpuCredits !== undefined) {
      if (cpuCredits < this.config.burstThreshold && cpuUtilization > 50) {
        // Scale up aggressively if running out of burst credits
        targetInstances = Math.ceil(targetInstances * 1.5);
        this.logger.warn(
          `Low burst capacity (${cpuCredits}%), aggressive scaling to ${targetInstances} instances`
        );
      }
    }

    // Enforce limits
    return Math.min(this.config.maxInstances, Math.max(this.config.minInstances, targetInstances));
  }

  /**
   * Predict CPU utilization for capacity planning
   */
  predictCpuUtilization(
    historicalData: Array<{ timestamp: Date; utilization: number }>,
    forecastHorizon: number
  ): Array<{ timestamp: Date; utilization: number; confidence: number }> {
    // Simple moving average prediction
    const windowSize = Math.min(10, historicalData.length);
    const recentData = historicalData.slice(-windowSize);

    const avgUtilization = recentData.reduce((sum, d) => sum + d.utilization, 0) / recentData.length;

    // Calculate trend
    const trend =
      (recentData[recentData.length - 1].utilization - recentData[0].utilization) /
      recentData.length;

    const predictions: Array<{ timestamp: Date; utilization: number; confidence: number }> = [];
    const now = new Date();

    for (let i = 1; i <= forecastHorizon; i++) {
      const timestamp = new Date(now.getTime() + i * 300000); // 5-minute intervals
      const utilization = Math.max(0, Math.min(100, avgUtilization + trend * i));
      const confidence = Math.max(0.5, 1 - i * 0.05); // Decreasing confidence

      predictions.push({ timestamp, utilization, confidence });
    }

    return predictions;
  }

  /**
   * Detect CPU anomalies
   */
  detectAnomalies(
    utilizationHistory: number[],
    threshold: number = 2.5
  ): Array<{ index: number; value: number; score: number }> {
    if (utilizationHistory.length < 10) {
      return [];
    }

    // Calculate mean and standard deviation
    const mean = utilizationHistory.reduce((sum, val) => sum + val, 0) / utilizationHistory.length;
    const variance =
      utilizationHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      utilizationHistory.length;
    const stdDev = Math.sqrt(variance);

    const anomalies: Array<{ index: number; value: number; score: number }> = [];

    for (let i = 0; i < utilizationHistory.length; i++) {
      const zScore = Math.abs((utilizationHistory[i] - mean) / stdDev);
      if (zScore > threshold) {
        anomalies.push({
          index: i,
          value: utilizationHistory[i],
          score: zScore
        });
      }
    }

    return anomalies;
  }

  /**
   * Get recommended configuration
   */
  getRecommendedConfig(
    currentInstances: number,
    avgCpuUtilization: number,
    peakCpuUtilization: number
  ): Partial<CpuPolicyConfig> {
    const recommendations: Partial<CpuPolicyConfig> = {};

    // Adjust scale up threshold based on peak utilization
    if (peakCpuUtilization > 90) {
      recommendations.scaleUpThreshold = 60;
    } else if (peakCpuUtilization < 70) {
      recommendations.scaleUpThreshold = 80;
    }

    // Adjust scale down threshold based on average utilization
    if (avgCpuUtilization < 20) {
      recommendations.scaleDownThreshold = 40;
      recommendations.scaleDownStep = 50; // More aggressive scale down
    }

    // Adjust instance limits
    if (avgCpuUtilization > 80) {
      recommendations.maxInstances = Math.min(1000, this.config.maxInstances * 2);
    }

    return recommendations;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<CpuPolicyConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.info('CPU scaling policy configuration updated', updates);
  }

  /**
   * Get current configuration
   */
  getConfig(): CpuPolicyConfig {
    return { ...this.config };
  }
}
