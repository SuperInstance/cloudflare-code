/**
 * Rollout Engine - Advanced rollout strategies for feature flags
 * Supports gradual rollouts, canary deployments, blue-green deployments, and automatic rollbacks
 */

import type {
  RolloutStrategy,
  RolloutSchedule,
  RolloutStage,
  CanaryDeployment,
  CanaryCriteria,
  Flag,
  FlagStorageEnv,
  UserAttributes,
  EvaluationContext,
  EvaluationResult,
  EventType,
  Event,
} from '../types/index.js';

// ============================================================================
// Rollout Configuration
// ============================================================================

export interface RolloutConfig {
  flagKey: string;
  strategy: RolloutStrategy;
  monitorMetrics?: boolean;
  autoRollback?: boolean;
  rollbackThreshold?: number;
  notifyOnChange?: boolean;
}

export interface GradualRolloutConfig {
  stages: Array<{
    percentage: number;
    duration: number; // in milliseconds
  }>;
  interval: number; // Check interval in milliseconds
  autoProgress: boolean;
}

// ============================================================================
// Rollout Engine
// ============================================================================

export class RolloutEngine {
  private storage: DurableObjectStub;
  private activeRollouts: Map<string, RolloutState>;
  private canaryDeployments: Map<string, CanaryDeployment>;
  private monitors: Map<string, ReturnType<typeof setInterval>>;

  constructor(env: FlagStorageEnv) {
    this.storage = env.FLAGS_DURABLE_OBJECT.idFromName('rollouts');
    this.activeRollouts = new Map();
    this.canaryDeployments = new Map();
    this.monitors = new Map();
  }

  // ========================================================================
  // Gradual Rollout
  // ========================================================================

  /**
   * Start a gradual rollout with multiple stages
   */
  async startGradualRollout(
    config: RolloutConfig & {
      gradualConfig: GradualRolloutConfig;
    }
  ): Promise<string> {
    const flag = await this.storage.getFlag(config.flagKey);
    if (!flag) {
      throw new Error(`Flag '${config.flagKey}' not found`);
    }

    const rolloutId = this.generateRolloutId();

    const stages: RolloutStage[] = config.gradualConfig.stages.map(
      (stage, index) => ({
        percentage: stage.percentage,
        duration: stage.duration,
        startTime: new Date(
          Date.now() +
            index * config.gradualConfig.interval +
            (index > 0 ? config.gradualConfig.stages[index - 1].duration : 0)
        ),
      })
    );

    const rolloutState: RolloutState = {
      id: rolloutId,
      flagKey: config.flagKey,
      type: 'gradual',
      currentStage: 0,
      stages,
      startTime: new Date(),
      status: 'active',
      config,
    };

    this.activeRollouts.set(rolloutId, rolloutState);

    // Start monitoring
    if (config.gradualConfig.autoProgress) {
      this.startGradualRolloutMonitor(rolloutId);
    }

    // Record event
    await this.recordEvent({
      type: 'flag_updated',
      flagId: config.flagKey,
      data: {
        rolloutId,
        rolloutType: 'gradual',
        stages: stages.length,
      },
    });

    return rolloutId;
  }

  /**
   * Progress to the next stage of a gradual rollout
   */
  async progressGradualRollout(rolloutId: string): Promise<void> {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout || rollout.type !== 'gradual') {
      throw new Error(`Gradual rollout '${rolloutId}' not found`);
    }

    if (rollout.currentStage >= rollout.stages.length - 1) {
      // Rollout complete
      rollout.status = 'completed';
      this.activeRollouts.set(rolloutId, rollout);
      this.stopMonitor(rolloutId);
      return;
    }

    rollout.currentStage++;
    const stage = rollout.stages[rollout.currentStage];

    // Update flag with new percentage
    await this.updateRolloutPercentage(rollout.flagKey, stage.percentage);

    this.activeRollouts.set(rolloutId, rollout);
  }

  /**
   * Pause a gradual rollout
   */
  async pauseGradualRollout(rolloutId: string): Promise<void> {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout || rollout.type !== 'gradual') {
      throw new Error(`Gradual rollout '${rolloutId}' not found`);
    }

    rollout.status = 'paused';
    this.activeRollouts.set(rolloutId, rollout);
    this.stopMonitor(rolloutId);
  }

  /**
   * Resume a paused gradual rollout
   */
  async resumeGradualRollout(rolloutId: string): Promise<void> {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout || rollout.type !== 'gradual') {
      throw new Error(`Gradual rollout '${rolloutId}' not found`);
    }

    rollout.status = 'active';
    this.activeRollouts.set(rolloutId, rollout);
    this.startGradualRolloutMonitor(rolloutId);
  }

  // ========================================================================
  // Percentage Rollout
  // ========================================================================

  /**
   * Start a percentage-based rollout
   */
  async startPercentageRollout(
    flagKey: string,
    percentage: number,
    duration?: number
  ): Promise<string> {
    const flag = await this.storage.getFlag(flagKey);
    if (!flag) {
      throw new Error(`Flag '${flagKey}' not found`);
    }

    if (percentage < 0 || percentage > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }

    const rolloutId = this.generateRolloutId();

    const rolloutState: RolloutState = {
      id: rolloutId,
      flagKey,
      type: 'percentage',
      currentPercentage: percentage,
      startTime: new Date(),
      endTime: duration ? new Date(Date.now() + duration) : undefined,
      status: 'active',
    };

    this.activeRollouts.set(rolloutId, rolloutState);

    // Update flag immediately
    await this.updateRolloutPercentage(flagKey, percentage);

    // Set up auto-revert if duration is specified
    if (duration) {
      this.monitors.set(
        rolloutId,
        setTimeout(async () => {
          await this.rollbackRollout(rolloutId);
        }, duration)
      );
    }

    return rolloutId;
  }

  /**
   * Update percentage of an active rollout
   */
  async updatePercentageRollout(
    rolloutId: string,
    newPercentage: number
  ): Promise<void> {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout || rollout.type !== 'percentage') {
      throw new Error(`Percentage rollout '${rolloutId}' not found`);
    }

    if (newPercentage < 0 || newPercentage > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }

    rollout.currentPercentage = newPercentage;
    this.activeRollouts.set(rolloutId, rollout);

    await this.updateRolloutPercentage(rollout.flagKey, newPercentage);
  }

  // ========================================================================
  // Canary Deployment
  // ========================================================================

  /**
   * Start a canary deployment
   */
  async startCanaryDeployment(
    flagKey: string,
    percentage: number,
    criteria: CanaryCriteria
  ): Promise<string> {
    const flag = await this.storage.getFlag(flagKey);
    if (!flag) {
      throw new Error(`Flag '${flagKey}' not found`);
    }

    const canaryId = this.generateRolloutId();

    const canary: CanaryDeployment = {
      id: canaryId,
      flagId: flagKey,
      percentage,
      criteria,
      startTime: new Date(),
      status: 'active',
    };

    this.canaryDeployments.set(canaryId, canary);

    // Start with initial percentage
    await this.updateRolloutPercentage(flagKey, percentage);

    // Start monitoring canary metrics
    this.startCanaryMonitor(canaryId);

    await this.recordEvent({
      type: 'canary_started',
      flagId: flagKey,
      data: {
        canaryId,
        percentage,
        criteria,
      },
    });

    return canaryId;
  }

  /**
   * Increase canary rollout percentage
   */
  async increaseCanaryPercentage(
    canaryId: string,
    additionalPercentage: number
  ): Promise<void> {
    const canary = this.canaryDeployments.get(canaryId);
    if (!canary) {
      throw new Error(`Canary deployment '${canaryId}' not found`);
    }

    canary.percentage = Math.min(100, canary.percentage + additionalPercentage);
    this.canaryDeployments.set(canaryId, canary);

    await this.updateRolloutPercentage(canary.flagId, canary.percentage);
  }

  /**
   * Promote canary to full rollout
   */
  async promoteCanary(canaryId: string): Promise<void> {
    const canary = this.canaryDeployments.get(canaryId);
    if (!canary) {
      throw new Error(`Canary deployment '${canaryId}' not found`);
    }

    canary.status = 'completed';
    this.canaryDeployments.set(canaryId, canary);

    await this.updateRolloutPercentage(canary.flagId, 100);
    this.stopMonitor(canaryId);
  }

  /**
   * Rollback a canary deployment
   */
  async rollbackCanary(canaryId: string): Promise<void> {
    const canary = this.canaryDeployments.get(canaryId);
    if (!canary) {
      throw new Error(`Canary deployment '${canaryId}' not found`);
    }

    canary.status = 'rolled_back';
    this.canaryDeployments.set(canaryId, canary);

    await this.updateRolloutPercentage(canary.flagId, 0);
    this.stopMonitor(canaryId);

    await this.recordEvent({
      type: 'canary_rolled_back',
      flagId: canary.flagId,
      data: { canaryId },
    });
  }

  // ========================================================================
  // Blue-Green Deployment
  // ========================================================================

  /**
   * Start a blue-green deployment
   */
  async startBlueGreenDeployment(
    flagKey: string,
    greenVariant: string
  ): Promise<string> {
    const rolloutId = this.generateRolloutId();

    const rolloutState: RolloutState = {
      id: rolloutId,
      flagKey,
      type: 'blue_green',
      greenVariant,
      startTime: new Date(),
      status: 'active',
    };

    this.activeRollouts.set(rolloutId, rolloutState);

    // Initially keep blue (default) active
    return rolloutId;
  }

  /**
   * Switch traffic to green
   */
  async switchToGreen(rolloutId: string): Promise<void> {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout || rollout.type !== 'blue_green') {
      throw new Error(`Blue-green deployment '${rolloutId}' not found`);
    }

    rollout.isGreenActive = true;
    this.activeRollouts.set(rolloutId, rollout);

    // Update flag to use green variant
    await this.storage.setRules({
      flagId: rollout.flagKey,
      rules: [
        {
          id: this.generateRolloutId(),
          name: 'Green deployment',
          conditions: [],
          逻辑: 'AND',
          variant: rollout.greenVariant!,
          enabled: true,
          priority: 100,
          rolloutPercentage: 100,
        },
      ],
      updatedAt: new Date(),
      version: 1,
    });
  }

  /**
   * Switch traffic back to blue
   */
  async switchToBlue(rolloutId: string): Promise<void> {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout || rollout.type !== 'blue_green') {
      throw new Error(`Blue-green deployment '${rolloutId}' not found`);
    }

    rollout.isGreenActive = false;
    this.activeRollouts.set(rolloutId, rollout);

    // Clear rules to revert to default (blue)
    await this.storage.deleteRules(rollout.flagKey);
  }

  /**
   * Complete blue-green deployment
   */
  async completeBlueGreenDeployment(rolloutId: string): Promise<void> {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout || rollout.type !== 'blue_green') {
      throw new Error(`Blue-green deployment '${rolloutId}' not found`);
    }

    rollout.status = 'completed';
    this.activeRollouts.delete(rolloutId);
  }

  // ========================================================================
  // Rollback Operations
  // ========================================================================

  /**
   * Rollback an active rollout
   */
  async rollbackRollout(rolloutId: string): Promise<void> {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout) {
      throw new Error(`Rollout '${rolloutId}' not found`);
    }

    // Revert to 0% or default
    await this.updateRolloutPercentage(rollout.flagKey, 0);

    rollout.status = 'rolled_back';
    this.activeRollouts.set(rolloutId, rollout);
    this.stopMonitor(rolloutId);

    await this.recordEvent({
      type: 'flag_updated',
      flagId: rollout.flagKey,
      data: {
        rolloutId,
        action: 'rollback',
      },
    });
  }

  /**
   * Rollback multiple rollouts for a flag
   */
  async rollbackFlagRollouts(flagKey: string): Promise<void> {
    const rolloutsToRollback = Array.from(this.activeRollouts.values()).filter(
      (r) => r.flagKey === flagKey && r.status === 'active'
    );

    for (const rollout of rolloutsToRollback) {
      await this.rollbackRollout(rollout.id);
    }
  }

  // ========================================================================
  // Rollout Status and Monitoring
  // ========================================================================

  /**
   * Get status of a rollout
   */
  getRolloutStatus(rolloutId: string): RolloutState | undefined {
    return this.activeRollouts.get(rolloutId);
  }

  /**
   * Get all active rollouts
   */
  getActiveRollouts(): RolloutState[] {
    return Array.from(this.activeRollouts.values()).filter(
      (r) => r.status === 'active'
    );
  }

  /**
   * Get rollout history for a flag
   */
  getFlagRolloutHistory(flagKey: string): RolloutState[] {
    return Array.from(this.activeRollouts.values()).filter(
      (r) => r.flagKey === flagKey
    );
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  private async updateRolloutPercentage(
    flagKey: string,
    percentage: number
  ): Promise<void> {
    // This would update the flag's rules with the new percentage
    const rules = await this.storage.getRules(flagKey);
    if (rules && rules.rules.length > 0) {
      // Update first rule's percentage
      rules.rules[0].rolloutPercentage = percentage;
      await this.storage.setRules(rules);
    }
  }

  private startGradualRolloutMonitor(rolloutId: string): void {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout || rollout.type !== 'gradual') {
      return;
    }

    const currentStage = rollout.stages[rollout.currentStage];
    const nextStageTime = currentStage.startTime.getTime() + currentStage.duration;
    const delay = nextStageTime - Date.now();

    if (delay <= 0) {
      // Already time to progress
      this.progressGradualRollout(rolloutId);
      return;
    }

    const timer = setTimeout(async () => {
      await this.progressGradualRollout(rolloutId);
      if (
        this.activeRollouts.get(rolloutId)?.status === 'active' &&
        this.activeRollouts.get(rolloutId)?.type === 'gradual'
      ) {
        this.startGradualRolloutMonitor(rolloutId);
      }
    }, delay);

    this.monitors.set(rolloutId, timer);
  }

  private startCanaryMonitor(canaryId: string): void {
    const canary = this.canaryDeployments.get(canaryId);
    if (!canary) {
      return;
    }

    // Monitor every 30 seconds
    const timer = setInterval(async () => {
      const metrics = await this.getCanaryMetrics(canaryId);
      const shouldRollback = this.evaluateCanaryMetrics(canary, metrics);

      if (shouldRollback) {
        await this.rollbackCanary(canaryId);
      }
    }, 30_000);

    this.monitors.set(canaryId, timer);
  }

  private async getCanaryMetrics(canaryId: string): Promise<CanaryMetrics> {
    const canary = this.canaryDeployments.get(canaryId);
    if (!canary) {
      throw new Error(`Canary deployment '${canaryId}' not found`);
    }

    // Fetch metrics from analytics
    // This is a simplified version - in production, you'd query your metrics store
    return {
      errorRate: 0.01, // 1% error rate
      latency: 150, // 150ms average latency
      customMetrics: {},
    };
  }

  private evaluateCanaryMetrics(
    canary: CanaryDeployment,
    metrics: CanaryMetrics
  ): boolean {
    // Check error rate threshold
    if (
      canary.criteria.errorRateThreshold &&
      metrics.errorRate > canary.criteria.errorRateThreshold
    ) {
      return true;
    }

    // Check latency threshold
    if (
      canary.criteria.latencyThreshold &&
      metrics.latency > canary.criteria.latencyThreshold
    ) {
      return true;
    }

    // Check custom metrics
    if (canary.criteria.customMetrics) {
      for (const customMetric of canary.criteria.customMetrics) {
        const value = metrics.customMetrics[customMetric.name];
        if (value === undefined) continue;

        switch (customMetric.operator) {
          case 'greater_than':
            if (value > customMetric.threshold) return true;
            break;
          case 'less_than':
            if (value < customMetric.threshold) return true;
            break;
          case 'equals':
            if (value === customMetric.threshold) return true;
            break;
        }
      }
    }

    return false;
  }

  private stopMonitor(rolloutId: string): void {
    const timer = this.monitors.get(rolloutId);
    if (timer) {
      clearTimeout(timer as unknown as number);
      clearInterval(timer as unknown as number);
      this.monitors.delete(rolloutId);
    }
  }

  private generateRolloutId(): string {
    return `rollout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async recordEvent(eventData: {
    type: EventType;
    flagId?: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    const event: Event = {
      id: this.generateRolloutId(),
      type: eventData.type,
      timestamp: new Date(),
      flagId: eventData.flagId,
      data: eventData.data,
    };

    // Store event
    await this.storage.recordEvent(event);
  }
}

// ============================================================================
// Internal Types
// ============================================================================

interface RolloutState {
  id: string;
  flagKey: string;
  type: 'gradual' | 'percentage' | 'blue_green';
  currentStage?: number;
  stages?: RolloutStage[];
  currentPercentage?: number;
  greenVariant?: string;
  isGreenActive?: boolean;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'paused' | 'completed' | 'rolled_back';
  config?: RolloutConfig;
}

interface CanaryMetrics {
  errorRate: number;
  latency: number;
  customMetrics: Record<string, number>;
}
