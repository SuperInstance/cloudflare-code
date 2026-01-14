/**
 * Traffic Manager for Canary Deployments
 * Manages traffic distribution between baseline and canary
 */

import { DeploymentTarget } from '../types';
import { Logger } from '../utils/logger';

export interface TrafficManagerOptions {
  baselineTargets: DeploymentTarget[];
  canaryTargets: DeploymentTarget[];
  logger?: Logger;
}

export interface TrafficDistribution {
  baselinePercentage: number;
  canaryPercentage: number;
  timestamp: Date;
}

export class TrafficManager {
  private baselineTargets: DeploymentTarget[];
  private canaryTargets: DeploymentTarget[];
  private logger: Logger;
  private currentPercentage: number = 0;
  private trafficHistory: TrafficDistribution[] = [];

  constructor(options: TrafficManagerOptions) {
    this.baselineTargets = options.baselineTargets;
    this.canaryTargets = options.canaryTargets;
    this.logger = options.logger || new Logger({ component: 'TrafficManager' });
  }

  /**
   * Set traffic percentage for canary
   */
  async setTrafficPercentage(percentage: number): Promise<void> {
    this.logger.info('Setting canary traffic percentage', {
      percentage,
      baselinePercentage: 100 - percentage,
    });

    this.currentPercentage = percentage;

    // Record traffic distribution
    this.trafficHistory.push({
      baselinePercentage: 100 - percentage,
      canaryPercentage: percentage,
      timestamp: new Date(),
    });

    // Update load balancer configuration
    await this.updateLoadBalancer(percentage);

    // Update routing rules
    await this.updateRoutingRules(percentage);

    this.logger.info('Traffic percentage updated successfully', {
      percentage,
    });
  }

  /**
   * Get current traffic percentage
   */
  getCurrentPercentage(): number {
    return this.currentPercentage;
  }

  /**
   * Gradually increase traffic to canary
   */
  async graduallyIncreaseTraffic(
    steps: { percentage: number; duration: number }[]
  ): Promise<void> {
    this.logger.info('Gradually increasing canary traffic', {
      steps: steps.length,
    });

    for (const step of steps) {
      this.logger.info('Increasing traffic to next step', {
        percentage: step.percentage,
        duration: step.duration,
      });

      await this.setTrafficPercentage(step.percentage);

      // Wait for the specified duration
      await this.sleep(step.duration);
    }

    this.logger.info('Traffic increase completed');
  }

  /**
   * Update load balancer configuration
   */
  private async updateLoadBalancer(percentage: number): Promise<void> {
    this.logger.debug('Updating load balancer configuration', {
      percentage,
    });

    // In a real implementation, this would:
    // 1. Update Cloudflare Load Balancer pool weights
    // 2. Update Kubernetes service weights
    // 3. Update CDN cache rules
    // 4. Update API gateway routing

    // Simulate load balancer update
    await this.sleep(1000);
  }

  /**
   * Update routing rules
   */
  private async updateRoutingRules(percentage: number): Promise<void> {
    this.logger.debug('Updating routing rules', {
      percentage,
    });

    // In a real implementation, this would:
    // 1. Update Cloudflare Workers routing
    // 2. Update API gateway routes
    // 3. Update service mesh rules
    // 4. Update DNS records

    // Simulate routing rule update
    await this.sleep(500);
  }

  /**
   * Get traffic distribution for a specific request
   */
  getDistributionForRequest(
    requestId: string,
    userId?: string,
    sessionId?: string
  ): 'baseline' | 'canary' {
    // Use consistent hashing to ensure the same request always goes to the same environment
    const hash = this.hashString(requestId + (userId || '') + (sessionId || ''));
    const bucket = hash % 100;

    return bucket < this.currentPercentage ? 'canary' : 'baseline';
  }

  /**
   * Hash a string to a number
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get traffic history
   */
  getTrafficHistory(): TrafficDistribution[] {
    return [...this.trafficHistory];
  }

  /**
   * Reset traffic to baseline
   */
  async resetToBaseline(): Promise<void> {
    this.logger.info('Resetting traffic to baseline');

    await this.setTrafficPercentage(0);
  }

  /**
   * Set all traffic to canary
   */
  async setAllToCanary(): Promise<void> {
    this.logger.info('Setting all traffic to canary');

    await this.setTrafficPercentage(100);
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
