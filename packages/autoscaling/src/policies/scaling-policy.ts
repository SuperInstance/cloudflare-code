/**
 * Core scaling policy implementation
 */

import type {
  ScalingPolicy,
  ScalingTrigger,
  ScalingAction,
  ScalingMetrics,
  ResourceState,
  ResourceType,
  ScalingEvent,
  ScalingEventType,
  ScalingStatus,
  ScalingImpact,
  ComparisonOperator,
  TriggerType,
  ActionType
} from '../types/index.js';
import { Logger } from '@claudeflare/logger';

export interface PolicyEvaluationResult {
  shouldScale: boolean;
  action: ActionType | null;
  reason: string;
  confidence: number;
  estimatedCost: number;
  estimatedDuration: number;
}

export interface PolicyExecutionResult {
  success: boolean;
  event: ScalingEvent;
  error?: string;
}

export class ScalingPolicyManager {
  private policies: Map<string, ScalingPolicy> = new Map();
  private activeEvaluations: Set<string> = new Set();
  private cooldowns: Map<string, Date> = new Map();
  private logger: Logger;
  private metricsHistory: Map<string, ScalingMetrics[]> = new Map();

  constructor() {
    this.logger = new Logger('ScalingPolicyManager');
  }

  /**
   * Add a new scaling policy
   */
  addPolicy(policy: ScalingPolicy): void {
    this.policies.set(policy.id, policy);
    this.logger.info(`Added scaling policy: ${policy.name} (${policy.id})`);
  }

  /**
   * Remove a scaling policy
   */
  removePolicy(policyId: string): boolean {
    const deleted = this.policies.delete(policyId);
    if (deleted) {
      this.logger.info(`Removed scaling policy: ${policyId}`);
    }
    return deleted;
  }

  /**
   * Get a policy by ID
   */
  getPolicy(policyId: string): ScalingPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Get all policies
   */
  getAllPolicies(): ScalingPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get policies by resource type
   */
  getPoliciesByResourceType(resourceType: ResourceType): ScalingPolicy[] {
    return Array.from(this.policies.values()).filter(
      (policy) => policy.resourceType === resourceType
    );
  }

  /**
   * Get enabled policies
   */
  getEnabledPolicies(): ScalingPolicy[] {
    return Array.from(this.policies.values()).filter((policy) => policy.enabled);
  }

  /**
   * Update a policy
   */
  updatePolicy(policyId: string, updates: Partial<ScalingPolicy>): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    const updatedPolicy = { ...policy, ...updates, updatedAt: new Date() };
    this.policies.set(policyId, updatedPolicy);
    this.logger.info(`Updated scaling policy: ${policyId}`);
    return true;
  }

  /**
   * Evaluate a policy against current metrics
   */
  async evaluatePolicy(
    policyId: string,
    metrics: ScalingMetrics,
    currentState: ResourceState
  ): Promise<PolicyEvaluationResult> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    if (!policy.enabled) {
      return {
        shouldScale: false,
        action: null,
        reason: 'Policy is disabled',
        confidence: 0,
        estimatedCost: 0,
        estimatedDuration: 0
      };
    }

    // Check cooldown
    if (this.isInCooldown(policyId)) {
      return {
        shouldScale: false,
        action: null,
        reason: 'Policy is in cooldown period',
        confidence: 0,
        estimatedCost: 0,
        estimatedDuration: 0
      };
    }

    // Check if already evaluating
    if (this.activeEvaluations.has(policyId)) {
      return {
        shouldScale: false,
        action: null,
        reason: 'Policy is already being evaluated',
        confidence: 0,
        estimatedCost: 0,
        estimatedDuration: 0
      };
    }

    this.activeEvaluations.add(policyId);

    try {
      // Evaluate triggers
      const triggeredActions = await this.evaluateTriggers(
        policy.triggers,
        metrics,
        currentState
      );

      if (triggeredActions.length === 0) {
        return {
          shouldScale: false,
          action: null,
          reason: 'No triggers matched',
          confidence: 0,
          estimatedCost: 0,
          estimatedDuration: 0
        };
      }

      // Get the highest priority action
      const action = triggeredActions[0];

      // Estimate cost and duration
      const estimatedCost = this.estimateActionCost(action, currentState);
      const estimatedDuration = this.estimateActionDuration(action);

      return {
        shouldScale: true,
        action: action.type,
        reason: `Triggered by ${action.type}`,
        confidence: this.calculateConfidence(metrics, policy.triggers),
        estimatedCost,
        estimatedDuration
      };
    } finally {
      this.activeEvaluations.delete(policyId);
    }
  }

  /**
   * Evaluate all enabled policies
   */
  async evaluateAllPolicies(
    metrics: ScalingMetrics,
    currentState: ResourceState
  ): Promise<Map<string, PolicyEvaluationResult>> {
    const results = new Map<string, PolicyEvaluationResult>();
    const enabledPolicies = this.getEnabledPolicies();

    for (const policy of enabledPolicies) {
      const result = await this.evaluatePolicy(policy.id, metrics, currentState);
      results.set(policy.id, result);
    }

    return results;
  }

  /**
   * Execute a scaling policy
   */
  async executePolicy(
    policyId: string,
    action: ScalingAction,
    currentState: ResourceState
  ): Promise<PolicyExecutionResult> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    const startTime = Date.now();
    const beforeState = { ...currentState };

    try {
      // Execute the scaling action
      const afterState = await this.executeAction(action, currentState);

      const duration = Date.now() - startTime;
      const event: ScalingEvent = {
        id: this.generateEventId(),
        timestamp: new Date(),
        type: this.mapActionToEventType(action.type),
        trigger: policyId,
        before: beforeState,
        after: afterState,
        duration,
        status: ScalingStatus.SUCCESS,
        impact: this.calculateImpact(beforeState, afterState)
      };

      // Set cooldown
      this.cooldowns.set(policyId, new Date(Date.now() + policy.cooldownPeriod));

      this.logger.info(
        `Executed scaling action: ${action.type} for policy ${policyId} in ${duration}ms`
      );

      return {
        success: true,
        event
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const event: ScalingEvent = {
        id: this.generateEventId(),
        timestamp: new Date(),
        type: this.mapActionToEventType(action.type),
        trigger: policyId,
        before: beforeState,
        after: beforeState,
        duration,
        status: ScalingStatus.FAILED,
        impact: {
          performanceChange: 0,
          costChange: 0,
          availabilityChange: 0,
          userImpact: 'none' as const
        }
      };

      this.logger.error(`Failed to execute scaling action: ${errorMessage}`);

      return {
        success: false,
        event,
        error: errorMessage
      };
    }
  }

  /**
   * Evaluate triggers against metrics
   */
  private async evaluateTriggers(
    triggers: ScalingTrigger[],
    metrics: ScalingMetrics,
    state: ResourceState
  ): Promise<ScalingAction[]> {
    const triggered: ScalingAction[] = [];

    for (const trigger of triggers) {
      if (await this.evaluateTrigger(trigger, metrics, state)) {
        // Get corresponding action for this trigger
        const action = this.getTriggerAction(trigger);
        if (action) {
          triggered.push(action);
        }
      }
    }

    // Sort by priority (order)
    return triggered.sort((a, b) => a.order - b.order);
  }

  /**
   * Evaluate a single trigger
   */
  private async evaluateTrigger(
    trigger: ScalingTrigger,
    metrics: ScalingMetrics,
    state: ResourceState
  ): Promise<boolean> {
    const metricValue = this.getMetricValue(trigger.type, metrics, state);

    if (metricValue === null) {
      return false;
    }

    return this.compareValues(metricValue, trigger.threshold, trigger.comparison);
  }

  /**
   * Get the value of a metric
   */
  private getMetricValue(
    triggerType: TriggerType,
    metrics: ScalingMetrics,
    state: ResourceState
  ): number | null {
    switch (triggerType) {
      case TriggerType.CPU_UTILIZATION:
        return metrics.cpuMetrics.utilization;

      case TriggerType.CPU_CREDITS:
        return metrics.cpuMetrics.credits;

      case TriggerType.MEMORY_USAGE:
        return metrics.memoryMetrics.usage;

      case TriggerType.REQUEST_RATE:
        return metrics.requestMetrics.rate;

      case TriggerType.QUEUE_LENGTH:
        return state.instances; // Approximate with instance count

      case TriggerType.LATENCY:
        return metrics.performanceMetrics.latency.p95;

      case TriggerType.ERROR_RATE:
        return metrics.performanceMetrics.errorRate;

      default:
        return null;
    }
  }

  /**
   * Compare values based on operator
   */
  private compareValues(
    value: number,
    threshold: number,
    operator: ComparisonOperator
  ): boolean {
    switch (operator) {
      case ComparisonOperator.GREATER_THAN:
        return value > threshold;

      case ComparisonOperator.LESS_THAN:
        return value < threshold;

      case ComparisonOperator.EQUALS:
        return value === threshold;

      case ComparisonOperator.GREATER_THAN_OR_EQUAL:
        return value >= threshold;

      case ComparisonOperator.LESS_THAN_OR_EQUAL:
        return value <= threshold;

      default:
        return false;
    }
  }

  /**
   * Get the action associated with a trigger
   */
  private getTriggerAction(trigger: ScalingTrigger): ScalingAction | null {
    // This would be determined by the trigger type and threshold direction
    // For now, return a placeholder
    return {
      id: `action-${trigger.id}`,
      type: trigger.threshold > 50 ? ActionType.SCALE_UP : ActionType.SCALE_DOWN,
      target: 'default',
      parameters: {},
      order: 1
    };
  }

  /**
   * Execute a scaling action
   */
  private async executeAction(
    action: ScalingAction,
    currentState: ResourceState
  ): Promise<ResourceState> {
    const newState = { ...currentState };

    switch (action.type) {
      case ActionType.SCALE_UP:
        newState.instances = Math.ceil(currentState.instances * 1.5);
        newState.capacity = currentState.capacity * 1.5;
        newState.cost = currentState.cost * 1.5;
        break;

      case ActionType.SCALE_DOWN:
        newState.instances = Math.max(1, Math.floor(currentState.instances * 0.7));
        newState.capacity = currentState.capacity * 0.7;
        newState.cost = currentState.cost * 0.7;
        break;

      case ActionType.ADJUST_CPU:
        newState.cpu = (action.parameters.cpu as number) ?? currentState.cpu;
        break;

      case ActionType.ADJUST_MEMORY:
        newState.memory = (action.parameters.memory as number) ?? currentState.memory;
        break;

      case ActionType.ADJUST_CAPACITY:
        newState.capacity = (action.parameters.capacity as number) ?? currentState.capacity;
        break;

      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }

    return newState;
  }

  /**
   * Calculate confidence in the scaling decision
   */
  private calculateConfidence(
    metrics: ScalingMetrics,
    triggers: ScalingTrigger[]
  ): number {
    let confidence = 0.5;

    // Increase confidence if multiple triggers match
    const matchingTriggers = triggers.filter((trigger) => {
      const value = this.getMetricValue(trigger.type, metrics, {} as ResourceState);
      return value !== null && this.compareValues(value, trigger.threshold, trigger.comparison);
    });

    confidence += matchingTriggers.length * 0.1;
    confidence = Math.min(confidence, 1.0);

    return confidence;
  }

  /**
   * Estimate the cost of an action
   */
  private estimateActionCost(action: ScalingAction, state: ResourceState): number {
    switch (action.type) {
      case ActionType.SCALE_UP:
        return state.cost * 0.5;

      case ActionType.SCALE_DOWN:
        return -state.cost * 0.3;

      default:
        return 0;
    }
  }

  /**
   * Estimate the duration of an action
   */
  private estimateActionDuration(action: ScalingAction): number {
    switch (action.type) {
      case ActionType.SCALE_UP:
        return 300000; // 5 minutes

      case ActionType.SCALE_DOWN:
        return 120000; // 2 minutes

      default:
        return 60000; // 1 minute
    }
  }

  /**
   * Calculate the impact of a scaling action
   */
  private calculateImpact(before: ResourceState, after: ResourceState): ScalingImpact {
    const performanceChange = (after.capacity - before.capacity) / before.capacity;
    const costChange = (after.cost - before.cost) / before.cost;

    return {
      performanceChange,
      costChange,
      availabilityChange: 0,
      userImpact: this.determineUserImpact(Math.abs(performanceChange))
    };
  }

  /**
   * Determine user impact level
   */
  private determineUserImpact(change: number): 'none' | 'low' | 'medium' | 'high' {
    if (change < 0.1) return 'none';
    if (change < 0.3) return 'low';
    if (change < 0.5) return 'medium';
    return 'high';
  }

  /**
   * Map action type to event type
   */
  private mapActionToEventType(action: ActionType): ScalingEventType {
    switch (action) {
      case ActionType.SCALE_UP:
        return ScalingEventType.SCALE_UP;

      case ActionType.SCALE_DOWN:
        return ScalingEventType.SCALE_DOWN;

      default:
        return ScalingEventType.ADJUSTMENT;
    }
  }

  /**
   * Check if policy is in cooldown
   */
  private isInCooldown(policyId: string): boolean {
    const cooldownEnd = this.cooldowns.get(policyId);
    if (!cooldownEnd) {
      return false;
    }
    return new Date() < cooldownEnd;
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Store metrics for historical analysis
   */
  storeMetrics(resourceId: string, metrics: ScalingMetrics): void {
    if (!this.metricsHistory.has(resourceId)) {
      this.metricsHistory.set(resourceId, []);
    }

    const history = this.metricsHistory.get(resourceId)!;
    history.push(metrics);

    // Keep only last 1000 data points
    if (history.length > 1000) {
      history.shift();
    }
  }

  /**
   * Get metrics history for a resource
   */
  getMetricsHistory(resourceId: string): ScalingMetrics[] {
    return this.metricsHistory.get(resourceId) || [];
  }

  /**
   * Clear cooldown for a policy
   */
  clearCooldown(policyId: string): void {
    this.cooldowns.delete(policyId);
  }

  /**
   * Get active evaluations
   */
  getActiveEvaluations(): string[] {
    return Array.from(this.activeEvaluations);
  }
}
