/**
 * Request-based scaling policies
 */

import type {
  ScalingPolicy,
  ScalingTrigger,
  TriggerType,
  ComparisonOperator,
  ActionType
} from '../types/index.js';
import { Logger } from '@claudeflare/logger';

export interface RequestPolicyConfig {
  scaleUpRequestRate: number; // Requests per second to trigger scale up
  scaleDownRequestRate: number; // Requests per second to trigger scale down
  queueLengthThreshold: number; // Queue length to trigger scaling
  latencyThreshold: number; // Latency in ms to trigger scaling
  latencyPercentile: number; // Which percentile to use (50, 90, 95, 99)
  maxQueueLength: number;
  minInstances: number;
  maxInstances: number;
  warmupTime: number; // Time for new instances to warm up (ms)
  scaleUpFactor: number; // Multiplier for scale up
  scaleDownFactor: number; // Multiplier for scale down
}

export class RequestScalingPolicy {
  private logger: Logger;
  private config: RequestPolicyConfig;
  private requestHistory: Map<string, RequestHistoryEntry[]> = new Map();

  constructor(config: Partial<RequestPolicyConfig> = {}) {
    this.logger = new Logger('RequestScalingPolicy');
    this.config = {
      scaleUpRequestRate: 1000,
      scaleDownRequestRate: 200,
      queueLengthThreshold: 100,
      latencyThreshold: 500,
      latencyPercentile: 95,
      maxQueueLength: 1000,
      minInstances: 1,
      maxInstances: 100,
      warmupTime: 60000, // 1 minute
      scaleUpFactor: 2,
      scaleDownFactor: 0.7,
      ...config
    };
  }

  /**
   * Create a request-based scaling policy
   */
  createPolicy(resourceId: string): ScalingPolicy {
    const triggers: ScalingTrigger[] = [
      // Scale up on high request rate
      {
        id: `request-high-${resourceId}`,
        type: TriggerType.REQUEST_RATE,
        condition: {
          metric: 'requests.rate',
          aggregation: 'average' as const,
          window: 60000 // 1 minute
        },
        threshold: this.config.scaleUpRequestRate,
        comparison: ComparisonOperator.GREATER_THAN,
        duration: 60000,
        evaluationInterval: 10000
      },
      // Scale down on low request rate
      {
        id: `request-low-${resourceId}`,
        type: TriggerType.REQUEST_RATE,
        condition: {
          metric: 'requests.rate',
          aggregation: 'average' as const,
          window: 300000 // 5 minutes
        },
        threshold: this.config.scaleDownRequestRate,
        comparison: ComparisonOperator.LESS_THAN,
        duration: 900000, // 15 minutes
        evaluationInterval: 30000
      },
      // Scale on high queue length
      {
        id: `queue-high-${resourceId}`,
        type: TriggerType.QUEUE_LENGTH,
        condition: {
          metric: 'queue.length',
          aggregation: 'max' as const,
          window: 30000 // 30 seconds
        },
        threshold: this.config.queueLengthThreshold,
        comparison: ComparisonOperator.GREATER_THAN,
        duration: 30000,
        evaluationInterval: 10000
      },
      // Scale on high latency
      {
        id: `latency-high-${resourceId}`,
        type: TriggerType.LATENCY,
        condition: {
          metric: `latency.p${this.config.latencyPercentile}`,
          aggregation: 'average' as const,
          window: 120000 // 2 minutes
        },
        threshold: this.config.latencyThreshold,
        comparison: ComparisonOperator.GREATER_THAN,
        duration: 120000,
        evaluationInterval: 15000
      }
    ];

    return {
      id: `request-policy-${resourceId}`,
      name: `Request Scaling Policy for ${resourceId}`,
      description: 'Automatically scales based on request rate, queue length, and latency',
      resourceType: 'worker' as const,
      enabled: true,
      triggers,
      actions: [
        {
          id: 'scale-up',
          type: ActionType.SCALE_UP,
          target: resourceId,
          parameters: {
            factor: this.config.scaleUpFactor,
            maxInstances: this.config.maxInstances,
            warmupTime: this.config.warmupTime
          },
          order: 1
        },
        {
          id: 'scale-down',
          type: ActionType.SCALE_DOWN,
          target: resourceId,
          parameters: {
            factor: this.config.scaleDownFactor,
            minInstances: this.config.minInstances
          },
          order: 2
        }
      ],
      cooldownPeriod: this.config.warmupTime,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Record request metrics for history tracking
   */
  recordRequestMetrics(
    resourceId: string,
    requestRate: number,
    queueLength: number,
    latency: number
  ): void {
    if (!this.requestHistory.has(resourceId)) {
      this.requestHistory.set(resourceId, []);
    }

    const history = this.requestHistory.get(resourceId)!;
    history.push({
      timestamp: new Date(),
      requestRate,
      queueLength,
      latency
    });

    // Keep last 200 data points
    if (history.length > 200) {
      history.shift();
    }
  }

  /**
   * Calculate target instances based on request metrics
   */
  calculateTargetInstances(
    currentInstances: number,
    requestRate: number,
    queueLength: number,
    latency: number
  ): number {
    let targetInstances = currentInstances;

    // Scale based on request rate
    const requestsPerInstance = 500; // Target capacity per instance
    const rateBasedInstances = Math.ceil(requestRate / requestsPerInstance);

    // Scale based on queue length
    const queueBasedInstances = Math.ceil(queueLength / 50); // 50 requests per instance in queue

    // Scale based on latency
    let latencyBasedInstances = currentInstances;
    if (latency > this.config.latencyThreshold) {
      const latencyFactor = 1 + (latency - this.config.latencyThreshold) / this.config.latencyThreshold;
      latencyBasedInstances = Math.ceil(currentInstances * latencyFactor);
    }

    // Take the maximum of all calculations
    targetInstances = Math.max(rateBasedInstances, queueBasedInstances, latencyBasedInstances);

    // Apply scaling limits
    targetInstances = Math.min(this.config.maxInstances, Math.max(this.config.minInstances, targetInstances));

    if (targetInstances !== currentInstances) {
      this.logger.info(
        `Request-based scaling: ${currentInstances} -> ${targetInstances} instances ` +
        `(rate: ${requestRate}/s, queue: ${queueLength}, latency: ${latency}ms)`
      );
    }

    return targetInstances;
  }

  /**
   * Predict future request rate
   */
  predictRequestRate(
    resourceId: string,
    forecastHorizon: number
  ): Array<{ timestamp: Date; requestRate: number; confidence: number }> {
    const history = this.requestHistory.get(resourceId);
    if (!history || history.length < 10) {
      return [];
    }

    // Use exponential smoothing for prediction
    const alpha = 0.3;
    let smoothed = history[0].requestRate;

    const smoothedValues: number[] = [];
    for (const entry of history) {
      smoothed = alpha * entry.requestRate + (1 - alpha) * smoothed;
      smoothedValues.push(smoothed);
    }

    // Calculate trend
    const recentValues = smoothedValues.slice(-10);
    const trend =
      (recentValues[recentValues.length - 1] - recentValues[0]) / recentValues.length;

    const predictions: Array<{ timestamp: Date; requestRate: number; confidence: number }> = [];
    const now = new Date();

    for (let i = 1; i <= forecastHorizon; i++) {
      const timestamp = new Date(now.getTime() + i * 60000); // 1-minute intervals
      const requestRate = Math.max(0, smoothed + trend * i);
      const confidence = Math.max(0.4, 1 - i * 0.03);

      predictions.push({ timestamp, requestRate, confidence });
    }

    return predictions;
  }

  /**
   * Detect traffic spikes
   */
  detectTrafficSpike(resourceId: string): {
    isSpike: boolean;
    magnitude: number;
    duration: number;
  } {
    const history = this.requestHistory.get(resourceId);
    if (!history || history.length < 20) {
      return { isSpike: false, magnitude: 0, duration: 0 };
    }

    const recentHistory = history.slice(-5);
    const baselineHistory = history.slice(-20, -10);

    const recentAvg = recentHistory.reduce((sum, h) => sum + h.requestRate, 0) / recentHistory.length;
    const baselineAvg = baselineHistory.reduce((sum, h) => sum + h.requestRate, 0) / baselineHistory.length;

    const magnitude = recentAvg / baselineAvg;

    // Spike is defined as 2x normal traffic
    const isSpike = magnitude > 2.0;

    if (isSpike) {
      // Estimate duration by looking at how long the spike has been sustained
      let duration = 0;
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].requestRate > baselineAvg * 1.5) {
          duration++;
        } else {
          break;
        }
      }
      duration *= 60000; // Convert to milliseconds (assuming 1-minute intervals)

      this.logger.warn(
        `Traffic spike detected for ${resourceId}: ${magnitude.toFixed(1)}x normal rate for ${duration / 1000}s`
      );

      return { isSpike, magnitude, duration };
    }

    return { isSpike: false, magnitude: 0, duration: 0 };
  }

  /**
   * Calculate optimal instance count using queueing theory
   */
  calculateOptimalInstances(
    arrivalRate: number,
    serviceRate: number,
    targetLatency: number
  ): number {
    // M/M/c queueing model
    // λ = arrival rate, μ = service rate, c = number of servers

    const rho = arrivalRate / serviceRate; // Traffic intensity per server

    // Minimum servers to avoid instability
    const minServers = Math.ceil(rho) + 1;

    // Calculate expected waiting time for different server counts
    for (let c = minServers; c <= this.config.maxInstances; c++) {
      const utilization = arrivalRate / (c * serviceRate);

      if (utilization >= 1) {
        continue;
      }

      // Erlang C formula approximation for average waiting time
      const probabilityOfWaiting = this.calculateErlangC(arrivalRate, serviceRate, c);
      const avgWaitingTime = probabilityOfWaiting / (c * serviceRate - arrivalRate);

      if (avgWaitingTime * 1000 < targetLatency) {
        return c;
      }
    }

    return this.config.maxInstances;
  }

  /**
   * Calculate Erlang C probability
   */
  private calculateErlangC(lambda: number, mu: number, c: number): number {
    const rho = lambda / (c * mu);

    if (rho >= 1) {
      return 1;
    }

    // Simplified calculation
    let sum = 0;
    for (let i = 0; i < c; i++) {
      sum += Math.pow((lambda / mu), i) / this.factorial(i);
    }

    const lastTerm = Math.pow(lambda / mu, c) / (this.factorial(c) * (1 - rho));
    const probability = lastTerm / (sum + lastTerm);

    return probability;
  }

  private factorial(n: number): number {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    return result;
  }

  /**
   * Get request statistics
   */
  getRequestStats(resourceId: string): {
    currentRate: number;
    averageRate: number;
    peakRate: number;
    currentQueue: number;
    averageQueue: number;
    currentLatency: number;
    averageLatency: number;
  } | null {
    const history = this.requestHistory.get(resourceId);
    if (!history || history.length === 0) {
      return null;
    }

    const latest = history[history.length - 1];
    const averageRate = history.reduce((sum, h) => sum + h.requestRate, 0) / history.length;
    const peakRate = Math.max(...history.map((h) => h.requestRate));
    const averageQueue = history.reduce((sum, h) => sum + h.queueLength, 0) / history.length;
    const averageLatency = history.reduce((sum, h) => sum + h.latency, 0) / history.length;

    return {
      currentRate: latest.requestRate,
      averageRate,
      peakRate,
      currentQueue: latest.queueLength,
      averageQueue,
      currentLatency: latest.latency,
      averageLatency
    };
  }

  /**
   * Get scaling recommendation
   */
  getScalingRecommendation(resourceId: string): {
    action: 'scale_up' | 'scale_down' | 'maintain';
    reason: string;
    targetInstances: number;
    urgency: 'low' | 'medium' | 'high';
  } {
    const spike = this.detectTrafficSpike(resourceId);
    const stats = this.getRequestStats(resourceId);

    if (!stats) {
      return {
        action: 'maintain',
        reason: 'Insufficient data',
        targetInstances: this.config.minInstances,
        urgency: 'low'
      };
    }

    if (spike.isSpike) {
      return {
        action: 'scale_up',
        reason: `Traffic spike detected: ${spike.magnitude.toFixed(1)}x normal rate`,
        targetInstances: Math.ceil(stats.currentRate / 500 * spike.magnitude),
        urgency: 'high'
      };
    }

    if (stats.currentLatency > this.config.latencyThreshold) {
      return {
        action: 'scale_up',
        reason: `High latency: ${stats.currentLatency}ms exceeds threshold`,
        targetInstances: Math.ceil(stats.currentRate / 400),
        urgency: 'high'
      };
    }

    if (stats.currentQueue > this.config.queueLengthThreshold) {
      return {
        action: 'scale_up',
        reason: `High queue length: ${stats.currentQueue} requests`,
        targetInstances: Math.ceil(stats.currentRate / 400),
        urgency: 'medium'
      };
    }

    if (stats.currentRate < this.config.scaleDownRequestRate) {
      return {
        action: 'scale_down',
        reason: `Low request rate: ${stats.currentRate} req/s`,
        targetInstances: Math.max(this.config.minInstances, Math.ceil(stats.currentRate / 600)),
        urgency: 'low'
      };
    }

    return {
      action: 'maintain',
      reason: 'Metrics within normal range',
      targetInstances: Math.ceil(stats.currentRate / 500),
      urgency: 'low'
    };
  }

  /**
   * Clear request history for a resource
   */
  clearHistory(resourceId: string): void {
    this.requestHistory.delete(resourceId);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<RequestPolicyConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.info('Request scaling policy configuration updated', updates);
  }

  /**
   * Get current configuration
   */
  getConfig(): RequestPolicyConfig {
    return { ...this.config };
  }
}

interface RequestHistoryEntry {
  timestamp: Date;
  requestRate: number;
  queueLength: number;
  latency: number;
}
