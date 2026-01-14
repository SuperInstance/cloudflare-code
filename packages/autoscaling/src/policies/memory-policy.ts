/**
 * Memory-based scaling policies
 */

import type {
  ScalingPolicy,
  ScalingTrigger,
  TriggerType,
  ComparisonOperator,
  ActionType
} from '../types/index.js';
import { Logger } from '@claudeflare/logger';

export interface MemoryPolicyConfig {
  scaleUpThreshold: number; // Memory usage % to trigger scale up
  scaleDownThreshold: number; // Memory usage % to trigger scale down
  leakDetectionEnabled: boolean;
  leakThreshold: number; // Memory growth rate to detect leak (MB/min)
  leakWindow: number; // Time window to check for leaks (ms)
  oomPreventionEnabled: boolean;
  oomThreshold: number; // Memory usage % to trigger OOM prevention
  minInstances: number;
  maxInstances: number;
  monitoringInterval: number;
}

export class MemoryScalingPolicy {
  private logger: Logger;
  private config: MemoryPolicyConfig;
  private memoryHistory: Map<string, Array<{ timestamp: Date; usage: number }>> = new Map();

  constructor(config: Partial<MemoryPolicyConfig> = {}) {
    this.logger = new Logger('MemoryScalingPolicy');
    this.config = {
      scaleUpThreshold: 80,
      scaleDownThreshold: 40,
      leakDetectionEnabled: true,
      leakThreshold: 100, // 100 MB/min
      leakWindow: 600000, // 10 minutes
      oomPreventionEnabled: true,
      oomThreshold: 90,
      minInstances: 1,
      maxInstances: 100,
      monitoringInterval: 60000, // 1 minute
      ...config
    };
  }

  /**
   * Create a memory-based scaling policy
   */
  createPolicy(resourceId: string): ScalingPolicy {
    const triggers: ScalingTrigger[] = [
      // Scale up on high memory usage
      {
        id: `memory-high-${resourceId}`,
        type: TriggerType.MEMORY_USAGE,
        condition: {
          metric: 'memory.usage',
          aggregation: 'average' as const,
          window: 180000 // 3 minutes
        },
        threshold: this.config.scaleUpThreshold,
        comparison: ComparisonOperator.GREATER_THAN,
        duration: 60000, // Sustained for 1 minute
        evaluationInterval: 30000
      },
      // Scale down on low memory usage
      {
        id: `memory-low-${resourceId}`,
        type: TriggerType.MEMORY_USAGE,
        condition: {
          metric: 'memory.usage',
          aggregation: 'average' as const,
          window: 600000 // 10 minutes
        },
        threshold: this.config.scaleDownThreshold,
        comparison: ComparisonOperator.LESS_THAN,
        duration: 900000, // Sustained for 15 minutes
        evaluationInterval: 60000
      }
    ];

    // Add OOM prevention trigger if enabled
    if (this.config.oomPreventionEnabled) {
      triggers.push({
        id: `memory-oom-${resourceId}`,
        type: TriggerType.MEMORY_USAGE,
        condition: {
          metric: 'memory.usage',
          aggregation: 'max' as const,
          window: 30000 // 30 seconds
        },
        threshold: this.config.oomThreshold,
        comparison: ComparisonOperator.GREATER_THAN,
        duration: 30000, // Immediate action
        evaluationInterval: 10000 // Check every 10 seconds
      });
    }

    // Add memory leak detection trigger if enabled
    if (this.config.leakDetectionEnabled) {
      triggers.push({
        id: `memory-leak-${resourceId}`,
        type: TriggerType.MEMORY_LEAK,
        condition: {
          metric: 'memory.growth_rate',
          aggregation: 'average' as const,
          window: this.config.leakWindow
        },
        threshold: this.config.leakThreshold,
        comparison: ComparisonOperator.GREATER_THAN,
        duration: this.config.leakWindow,
        evaluationInterval: 60000
      });
    }

    return {
      id: `memory-policy-${resourceId}`,
      name: `Memory Scaling Policy for ${resourceId}`,
      description: 'Automatically scales based on memory usage and leak detection',
      resourceType: 'worker' as const,
      enabled: true,
      triggers,
      actions: [
        {
          id: 'scale-up',
          type: ActionType.SCALE_UP,
          target: resourceId,
          parameters: {
            step: 50,
            maxInstances: this.config.maxInstances
          },
          order: 1
        },
        {
          id: 'scale-down',
          type: ActionType.SCALE_DOWN,
          target: resourceId,
          parameters: {
            step: 30,
            minInstances: this.config.minInstances
          },
          order: 2
        },
        {
          id: 'restart-leak',
          type: ActionType.SCALE_UP,
          target: resourceId,
          parameters: {
            reason: 'memory_leak',
            action: 'restart'
          },
          order: 3
        }
      ],
      cooldownPeriod: 300000,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Record memory usage for history tracking
   */
  recordMemoryUsage(resourceId: string, usage: number): void {
    if (!this.memoryHistory.has(resourceId)) {
      this.memoryHistory.set(resourceId, []);
    }

    const history = this.memoryHistory.get(resourceId)!;
    history.push({
      timestamp: new Date(),
      usage
    });

    // Keep last 100 data points
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Detect memory leaks
   */
  detectMemoryLeak(resourceId: string): {
    isLeaking: boolean;
    growthRate: number;
    confidence: number;
  } {
    const history = this.memoryHistory.get(resourceId);
    if (!history || history.length < 10) {
      return { isLeaking: false, growthRate: 0, confidence: 0 };
    }

    // Calculate memory growth rate
    const recentHistory = history.slice(-20);
    const oldest = recentHistory[0];
    const newest = recentHistory[recentHistory.length - 1];

    const timeDiff = newest.timestamp.getTime() - oldest.timestamp.getTime();
    const memoryDiff = newest.usage - oldest.usage;

    // Growth rate in MB/min
    const growthRate = (memoryDiff / (timeDiff / 60000));

    // Calculate confidence based on correlation
    const confidence = this.calculateGrowthConfidence(recentHistory);

    const isLeaking =
      growthRate > this.config.leakThreshold &&
      confidence > 0.7;

    if (isLeaking) {
      this.logger.warn(
        `Memory leak detected for ${resourceId}: ${growthRate.toFixed(2)} MB/min (confidence: ${(confidence * 100).toFixed(1)}%)`
      );
    }

    return { isLeaking, growthRate, confidence };
  }

  /**
   * Calculate confidence in memory growth pattern
   */
  private calculateGrowthConfidence(history: Array<{ timestamp: Date; usage: number }>): number {
    if (history.length < 5) return 0;

    // Simple linear regression to check trend
    const n = history.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = history[i].usage;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const meanY = sumY / n;

    // Calculate R²
    let ssTotal = 0;
    let ssResidual = 0;

    for (let i = 0; i < n; i++) {
      const y = history[i].usage;
      const predicted = meanY + slope * (i - n / 2);
      ssTotal += Math.pow(y - meanY, 2);
      ssResidual += Math.pow(y - predicted, 2);
    }

    const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

    // High R² and positive slope indicate confident growth
    return slope > 0 ? rSquared : 0;
  }

  /**
   * Predict when memory will be exhausted
   */
  predictMemoryExhaustion(
    resourceId: string,
    totalMemory: number
  ): { estimatedExhaustion: Date | null; confidence: number } {
    const history = this.memoryHistory.get(resourceId);
    if (!history || history.length < 10) {
      return { estimatedExhaustion: null, confidence: 0 };
    }

    const recentHistory = history.slice(-20);
    const growthAnalysis = this.detectMemoryLeak(resourceId);

    if (growthAnalysis.growthRate <= 0) {
      return { estimatedExhaustion: null, confidence: 0 };
    }

    const currentUsage = recentHistory[recentHistory.length - 1].usage;
    const remainingMemory = totalMemory - currentUsage;
    const minutesUntilExhaustion = remainingMemory / growthAnalysis.growthRate;

    if (minutesUntilExhaustion < 0 || !isFinite(minutesUntilExhaustion)) {
      return { estimatedExhaustion: null, confidence: 0 };
    }

    const estimatedExhaustion = new Date(
      Date.now() + minutesUntilExhaustion * 60000
    );

    return {
      estimatedExhaustion,
      confidence: growthAnalysis.confidence
    };
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(resourceId: string): {
    current: number;
    average: number;
    peak: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  } | null {
    const history = this.memoryHistory.get(resourceId);
    if (!history || history.length === 0) {
      return null;
    }

    const current = history[history.length - 1].usage;
    const average = history.reduce((sum, h) => sum + h.usage, 0) / history.length;
    const peak = Math.max(...history.map((h) => h.usage));

    // Determine trend
    const recentAvg = history.slice(-5).reduce((sum, h) => sum + h.usage, 0) / Math.min(5, history.length);
    const olderAvg = history.slice(0, 5).reduce((sum, h) => sum + h.usage, 0) / Math.min(5, history.length);

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (recentAvg > olderAvg * 1.1) {
      trend = 'increasing';
    } else if (recentAvg < olderAvg * 0.9) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return { current, average, peak, trend };
  }

  /**
   * Detect OOM risk
   */
  detectOomRisk(resourceId: string): boolean {
    const history = this.memoryHistory.get(resourceId);
    if (!history || history.length === 0) {
      return false;
    }

    const currentUsage = history[history.length - 1].usage;

    // Check if usage is above OOM threshold
    if (currentUsage > this.config.oomThreshold) {
      this.logger.error(`OOM risk detected for ${resourceId}: ${currentUsage}% memory usage`);
      return true;
    }

    // Check if we're trending toward OOM
    const exhaustionPrediction = this.predictMemoryExhaustion(resourceId, 100);
    if (exhaustionPrediction.estimatedExhaustion) {
      const minutesUntilExhaustion =
        (exhaustionPrediction.estimatedExhaustion.getTime() - Date.now()) / 60000;

      if (minutesUntilExhaustion < 30 && exhaustionPrediction.confidence > 0.7) {
        this.logger.warn(
          `OOM risk detected for ${resourceId}: ${minutesUntilExhaustion.toFixed(0)} minutes until exhaustion`
        );
        return true;
      }
    }

    return false;
  }

  /**
   * Get recommended actions based on memory state
   */
  getRecommendedActions(resourceId: string): string[] {
    const actions: string[] = [];
    const leakStatus = this.detectMemoryLeak(resourceId);
    const oomRisk = this.detectOomRisk(resourceId);
    const stats = this.getMemoryStats(resourceId);

    if (!stats) {
      return actions;
    }

    if (oomRisk) {
      actions.push('URGENT: Scale up immediately to prevent OOM');
      actions.push('Consider restarting instances to free memory');
    }

    if (leakStatus.isLeaking) {
      actions.push(`Memory leak detected: ${leakStatus.growthRate.toFixed(2)} MB/min`);
      actions.push('Schedule instance restart during maintenance window');
      actions.push('Investigate application for memory leaks');
    }

    if (stats.trend === 'increasing' && stats.current > this.config.scaleUpThreshold * 0.8) {
      actions.push('Memory trending upward: Prepare to scale up');
    }

    if (stats.trend === 'decreasing' && stats.current < this.config.scaleDownThreshold) {
      actions.push('Memory trending downward: Consider scaling down');
    }

    return actions;
  }

  /**
   * Clear memory history for a resource
   */
  clearHistory(resourceId: string): void {
    this.memoryHistory.delete(resourceId);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MemoryPolicyConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.info('Memory scaling policy configuration updated', updates);
  }

  /**
   * Get current configuration
   */
  getConfig(): MemoryPolicyConfig {
    return { ...this.config };
  }
}
