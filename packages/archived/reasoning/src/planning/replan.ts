/**
 * Adaptive Replanning Engine
 *
 * Monitors execution progress, detects failures or changes,
 * and dynamically adjusts plans with alternative strategies.
 */

import type {
  Task,
  ReplanConfig,
  ReplanTrigger,
  ReplanContext,
  ReplanResult,
  PlanChange,
  ExecutionEvent,
  ReplanningError,
  Resource,
} from '../types';

// ============================================================================
// Replanning Engine
// ============================================================================

export class AdaptiveReplanner {
  private config: Required<ReplanConfig>;
  private executionHistory: ExecutionEvent[] = [];
  private replanAttempts = 0;
  private activePlan: Task[] = [];

  constructor(config: ReplanConfig = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 0.3,
      timeoutThreshold: config.timeoutThreshold ?? 2.0,
      qualityThreshold: config.qualityThreshold ?? 0.6,
      maxReplanAttempts: config.maxReplanAttempts ?? 3,
      replanningStrategy: config.replanningStrategy ?? 'moderate',
      triggerSensitivity: config.triggerSensitivity ?? 'medium',
      includeAlternativePaths: config.includeAlternativePaths ?? true,
    };
  }

  /**
   * Initialize with a plan
   */
  initializePlan(plan: Task[]): void {
    this.activePlan = plan;
    this.executionHistory = [];
    this.replanAttempts = 0;
  }

  /**
   * Record execution event
   */
  recordEvent(event: ExecutionEvent): void {
    this.executionHistory.push(event);
  }

  /**
   * Check if replanning is needed
   */
  async shouldReplan(currentTaskId: string): Promise<ReplanTrigger | null> {
    const context = this.buildReplanContext(currentTaskId);

    // Check for various trigger conditions
    const failureTrigger = this.checkFailureTrigger(context);
    if (failureTrigger) {
      return failureTrigger;
    }

    const timeoutTrigger = this.checkTimeoutTrigger(context);
    if (timeoutTrigger) {
      return timeoutTrigger;
    }

    const qualityTrigger = this.checkQualityTrigger(context);
    if (qualityTrigger) {
      return qualityTrigger;
    }

    const resourceTrigger = this.checkResourceTrigger(context);
    if (resourceTrigger) {
      return resourceTrigger;
    }

    const dependencyTrigger = this.checkDependencyTrigger(context);
    if (dependencyTrigger) {
      return dependencyTrigger;
    }

    return null;
  }

  /**
   * Generate new plan based on trigger
   */
  async replan(trigger: ReplanTrigger): Promise<ReplanResult> {
    const startTime = Date.now();

    if (this.replanAttempts >= this.config.maxReplanAttempts) {
      throw new Error(
        `Maximum replan attempts (${this.config.maxReplanAttempts}) reached`
      );
    }

    this.replanAttempts++;

    try {
      // Analyze current situation
      const analysis = await this.analyzeCurrentSituation(trigger);

      // Generate new plan
      const newPlan = await this.generateNewPlan(trigger, analysis);

      // Identify changes
      const changes = this.identifyChanges(this.activePlan, newPlan);

      // Generate reasoning explanation
      const reasoning = this.generateReplanningReasoning(trigger, changes);

      // Calculate confidence
      const confidence = this.calculateReplanConfidence(trigger, changes);

      // Update active plan
      const originalPlan = [...this.activePlan];
      this.activePlan = newPlan;

      const replanTime = Date.now() - startTime;

      return {
        originalPlan,
        newPlan,
        changes,
        reasoning,
        confidence,
        metadata: {
          triggerType: trigger.type,
          replanTime,
          affectedTasks: changes.length,
          estimatedDelay: this.estimateDelay(changes),
        },
      };
    } catch (error) {
      throw this.createError(
        'Replanning failed',
        'REPLAN_FAILED',
        { trigger, error }
      );
    }
  }

  /**
   * Build replanning context
   */
  private buildReplanContext(currentTaskId: string): ReplanContext {
    const completedTasks = new Set<string>();
    const failedTasks = new Set<string>();
    const resourceState = new Map<string, number>();

    for (const event of this.executionHistory) {
      if (event.type === 'complete') {
        completedTasks.add(event.taskId);
      } else if (event.type === 'fail') {
        failedTasks.add(event.taskId);
      }
    }

    // Calculate resource availability
    for (const task of this.activePlan) {
      if (task.resources) {
        for (const resource of task.resources) {
          const key = `${resource.type}_${resource.id}`;
          const currentAvailability = resourceState.get(key) ?? resource.capacity;
          resourceState.set(
            key,
            currentAvailability - (task.status === 'in-progress' ? resource.allocated : 0)
          );
        }
      }
    }

    const timeElapsed = this.executionHistory.length > 0
      ? Date.now() - this.executionHistory[0].timestamp
      : 0;

    return {
      currentTask: currentTaskId,
      completedTasks: Array.from(completedTasks),
      failedTasks: Array.from(failedTasks),
      executionHistory: this.executionHistory,
      resourceState,
      timeElapsed,
    };
  }

  /**
   * Check for failure trigger
   */
  private checkFailureTrigger(context: ReplanContext): ReplanTrigger | null {
    const failureRate =
      context.failedTasks.length /
      Math.max(1, context.completedTasks.length + context.failedTasks.length);

    const sensitivityThresholds = {
      low: 0.5,
      medium: this.config.failureThreshold,
      high: 0.2,
    };

    const threshold = sensitivityThresholds[this.config.triggerSensitivity];

    if (failureRate >= threshold) {
      return {
        type: 'failure',
        severity: failureRate > 0.5 ? 'critical' : failureRate > 0.3 ? 'high' : 'medium',
        timestamp: Date.now(),
        context,
      };
    }

    return null;
  }

  /**
   * Check for timeout trigger
   */
  private checkTimeoutTrigger(context: ReplanContext): ReplanTrigger | null {
    // Check if tasks are taking significantly longer than estimated
    const overdueEvents = context.executionHistory.filter((event) => {
      if (event.type !== 'start') {
        return false;
      }

      const task = this.activePlan.find((t) => t.id === event.taskId);
      if (!task || !task.estimatedDuration) {
        return false;
      }

      const elapsed = Date.now() - event.timestamp;
      return elapsed > task.estimatedDuration * this.config.timeoutThreshold;
    });

    if (overdueEvents.length > 0) {
      return {
        type: 'timeout',
        severity: overdueEvents.length > 3 ? 'high' : 'medium',
        timestamp: Date.now(),
        context,
      };
    }

    return null;
  }

  /**
   * Check for quality trigger
   */
  private checkQualityTrigger(context: ReplanContext): ReplanTrigger | null {
    // Analyze quality based on execution details
    let qualityScore = 1.0;

    for (const event of context.executionHistory) {
      if (event.details && typeof event.details === 'object') {
        const details = event.details as Record<string, unknown>;
        if (details.quality && typeof details.quality === 'number') {
          qualityScore = Math.min(qualityScore, details.quality);
        }
        if (details.errors && typeof details.errors === 'number') {
          qualityScore -= details.errors * 0.1;
        }
      }
    }

    if (qualityScore < this.config.qualityThreshold) {
      return {
        type: 'quality-drop',
        severity: qualityScore < 0.3 ? 'high' : 'medium',
        timestamp: Date.now(),
        context,
      };
    }

    return null;
  }

  /**
   * Check for resource constraint trigger
   */
  private checkResourceTrigger(context: ReplanContext): ReplanTrigger | null {
    let constrainedResources = 0;

    for (const [key, availability] of context.resourceState) {
      if (availability < 0) {
        constrainedResources++;
      }
    }

    if (constrainedResources > 0) {
      return {
        type: 'resource-constraint',
        severity: constrainedResources > 2 ? 'high' : 'medium',
        timestamp: Date.now(),
        context,
      };
    }

    return null;
  }

  /**
   * Check for dependency failure trigger
   */
  private checkDependencyTrigger(context: ReplanContext): ReplanTrigger | null {
    // Check if any completed tasks have failed dependencies
    const blockedTasks = new Set<string>();

    for (const task of this.activePlan) {
      for (const depId of task.dependencies) {
        if (context.failedTasks.includes(depId)) {
          blockedTasks.add(task.id);
        }
      }
    }

    if (blockedTasks.size > 0) {
      return {
        type: 'dependency-failure',
        severity: blockedTasks.size > 3 ? 'high' : 'medium',
        timestamp: Date.now(),
        context,
      };
    }

    return null;
  }

  /**
   * Analyze current situation
   */
  private async analyzeCurrentSituation(
    trigger: ReplanTrigger
  ): Promise<{
    problematicTasks: string[];
    availableResources: Map<string, number>;
    timeConstraints: number[];
  }> {
    const problematicTasks: string[] = [];
    const availableResources = new Map<string, number>();
    const timeConstraints: number[] = [];

    // Identify problematic tasks
    if (trigger.type === 'failure' || trigger.type === 'dependency-failure') {
      problematicTasks.push(...trigger.context.failedTasks);
    }

    if (trigger.type === 'timeout') {
      for (const event of trigger.context.executionHistory) {
        if (event.type === 'start') {
          const task = this.activePlan.find((t) => t.id === event.taskId);
          if (task) {
            const elapsed = Date.now() - event.timestamp;
            if (
              task.estimatedDuration &&
              elapsed > task.estimatedDuration * this.config.timeoutThreshold
            ) {
              problematicTasks.push(task.id);
            }
          }
        }
      }
    }

    // Collect available resources
    for (const [key, availability] of trigger.context.resourceState) {
      availableResources.set(key, availability);
    }

    // Calculate time constraints
    for (const task of this.activePlan) {
      if (task.estimatedDuration && !trigger.context.completedTasks.includes(task.id)) {
        timeConstraints.push(task.estimatedDuration);
      }
    }

    return {
      problematicTasks,
      availableResources,
      timeConstraints,
    };
  }

  /**
   * Generate new plan
   */
  private async generateNewPlan(
    trigger: ReplanTrigger,
    analysis: {
      problematicTasks: string[];
      availableResources: Map<string, number>;
      timeConstraints: number[];
    }
  ): Promise<Task[]> {
    const newPlan: Task[] = [];

    // Determine strategy based on trigger type and config
    const strategy = this.determineReplanningStrategy(trigger);

    switch (strategy) {
      case 'conservative':
        return this.conservativeReplan(trigger, analysis);
      case 'aggressive':
        return this.aggressiveReplan(trigger, analysis);
      case 'moderate':
      default:
        return this.moderateReplan(trigger, analysis);
    }
  }

  /**
   * Determine replanning strategy
   */
  private determineReplanningStrategy(trigger: ReplanTrigger): 'conservative' | 'moderate' | 'aggressive' {
    // Override with config if specified
    if (this.config.replanningStrategy !== 'moderate') {
      return this.config.replanningStrategy;
    }

    // Determine based on trigger severity
    if (trigger.severity === 'critical') {
      return 'aggressive';
    } else if (trigger.severity === 'high') {
      return 'moderate';
    } else {
      return 'conservative';
    }
  }

  /**
   * Conservative replanning - minimal changes
   */
  private conservativeReplan(
    trigger: ReplanTrigger,
    analysis: { problematicTasks: string[]; availableResources: Map<string, number>; timeConstraints: number[] }
  ): Task[] {
    const newPlan: Task[] = [];

    for (const task of this.activePlan) {
      // Skip failed tasks
      if (trigger.context.failedTasks.includes(task.id)) {
        continue;
      }

      // Adjust resources for constrained tasks
      if (task.resources) {
        const adjustedResources = task.resources.map((resource) => {
          const key = `${resource.type}_${resource.id}`;
          const availability = analysis.availableResources.get(key) ?? resource.capacity;

          return {
            ...resource,
            allocated: Math.min(resource.allocated, availability),
          };
        });

        newPlan.push({
          ...task,
          resources: adjustedResources,
        });
      } else {
        newPlan.push({ ...task });
      }
    }

    return newPlan;
  }

  /**
   * Moderate replanning - balance between conservative and aggressive
   */
  private moderateReplan(
    trigger: ReplanTrigger,
    analysis: { problematicTasks: string[]; availableResources: Map<string, number>; timeConstraints: number[] }
  ): Task[] {
    const newPlan: Task[] = [];
    const taskReplacements = new Map<string, Task>();

    // Generate replacements for problematic tasks
    for (const taskId of analysis.problematicTasks) {
      const originalTask = this.activePlan.find((t) => t.id === taskId);
      if (originalTask) {
        const replacement = this.generateAlternativeTask(originalTask, trigger);
        taskReplacements.set(taskId, replacement);
      }
    }

    // Build new plan with replacements
    for (const task of this.activePlan) {
      if (taskReplacements.has(task.id)) {
        newPlan.push(taskReplacements.get(task.id)!);
      } else if (!trigger.context.failedTasks.includes(task.id)) {
        newPlan.push({ ...task });
      }
    }

    return newPlan;
  }

  /**
   * Aggressive replanning - significant changes
   */
  private aggressiveReplan(
    trigger: ReplanTrigger,
    analysis: { problematicTasks: string[]; availableResources: Map<string, number>; timeConstraints: number[] }
  ): Task[] {
    // Start with completed tasks only
    const newPlan: Task[] = this.activePlan.filter((task) =>
      trigger.context.completedTasks.includes(task.id)
    );

    // Regenerate remaining tasks with optimizations
    const remainingTasks = this.activePlan.filter(
      (task) => !trigger.context.completedTasks.includes(task.id)
    );

    // Merge parallelizable tasks
    const mergedTasks = this.mergeParallelizableTasks(remainingTasks);
    newPlan.push(...mergedTasks);

    // Re-optimize resource allocation
    for (const task of newPlan) {
      if (task.resources) {
        task.resources = this.optimizeResourceAllocation(
          task.resources,
          analysis.availableResources
        );
      }
    }

    return newPlan;
  }

  /**
   * Generate alternative task
   */
  private generateAlternativeTask(originalTask: Task, trigger: ReplanTrigger): Task {
    const alternative: Task = {
      ...originalTask,
      id: `alt_${originalTask.id}_${Date.now()}`,
      description: `Alternative approach for: ${originalTask.description}`,
      status: 'pending',
      estimatedDuration: originalTask.estimatedDuration
        ? originalTask.estimatedDuration * 1.2 // Add buffer
        : undefined,
      metadata: {
        ...originalTask.metadata,
        originalTaskId: originalTask.id,
        alternativeReason: trigger.type,
        generatedAt: Date.now(),
      },
    };

    // Copy dependencies but map to alternative IDs if needed
    alternative.dependencies = [...originalTask.dependencies];

    // Adjust resources
    if (originalTask.resources) {
      alternative.resources = originalTask.resources.map((r) => ({
        ...r,
        allocated: Math.floor(r.allocated * 0.8), // Use fewer resources
      }));
    }

    return alternative;
  }

  /**
   * Merge parallelizable tasks
   */
  private mergeParallelizableTasks(tasks: Task[]): Task[] {
    const merged: Task[] = [];
    const processed = new Set<string>();

    for (const task of tasks) {
      if (processed.has(task.id)) {
        continue;
      }

      // Find tasks that can be merged
      const mergeCandidates = tasks.filter((t) => {
        if (processed.has(t.id) || t.id === task.id) {
          return false;
        }

        // Check if tasks are independent (no shared dependencies)
        const hasSharedDependencies =
          task.dependencies.some((d) => t.dependencies.includes(d)) ||
          t.dependencies.some((d) => task.dependencies.includes(d));

        return !hasSharedDependencies && task.priority === t.priority;
      });

      if (mergeCandidates.length > 0) {
        // Create merged task
        const mergedTask: Task = {
          id: `merged_${task.id}_${Date.now()}`,
          description: `Merged task: ${task.description} and ${mergeCandidates.length} others`,
          dependencies: [...new Set([...task.dependencies, ...mergeCandidates.flatMap((t) => t.dependencies)])],
          estimatedDuration: Math.max(
            task.estimatedDuration ?? 0,
            ...mergeCandidates.map((t) => t.estimatedDuration ?? 0)
          ),
          priority: task.priority,
          status: 'pending',
          metadata: {
            mergedTaskIds: [task.id, ...mergeCandidates.map((t) => t.id)],
          },
        };

        merged.push(mergedTask);
        processed.add(task.id);
        mergeCandidates.forEach((t) => processed.add(t.id));
      } else {
        merged.push(task);
        processed.add(task.id);
      }
    }

    return merged;
  }

  /**
   * Optimize resource allocation
   */
  private optimizeResourceAllocation(
    resources: Resource[],
    availableResources: Map<string, number>
  ): Resource[] {
    return resources.map((resource) => {
      const key = `${resource.type}_${resource.id}`;
      const availability = availableResources.get(key) ?? resource.capacity;

      return {
        ...resource,
        allocated: Math.min(resource.allocated, availability),
        availability: availability / resource.capacity,
      };
    });
  }

  /**
   * Identify changes between plans
   */
  private identifyChanges(originalPlan: Task[], newPlan: Task[]): PlanChange[] {
    const changes: PlanChange[] = [];
    const originalIds = new Set(originalPlan.map((t) => t.id));
    const newIds = new Set(newPlan.map((t) => t.id));

    // Find added tasks
    for (const taskId of newIds) {
      if (!originalIds.has(taskId)) {
        const task = newPlan.find((t) => t.id === taskId)!;
        changes.push({
          type: 'add',
          taskId,
          description: `Added new task: ${task.description}`,
          impact: 'medium',
          justification: 'Required to adapt to changed conditions',
        });
      }
    }

    // Find removed tasks
    for (const taskId of originalIds) {
      if (!newIds.has(taskId)) {
        const task = originalPlan.find((t) => t.id === taskId)!;
        changes.push({
          type: 'remove',
          taskId,
          description: `Removed task: ${task.description}`,
          impact: 'low',
          justification: 'No longer necessary or replaced',
        });
      }
    }

    // Find modified tasks
    for (const taskId of originalIds) {
      if (newIds.has(taskId)) {
        const original = originalPlan.find((t) => t.id === taskId)!;
        const updated = newPlan.find((t) => t.id === taskId)!;

        if (
          original.description !== updated.description ||
          original.estimatedDuration !== updated.estimatedDuration ||
          original.priority !== updated.priority
        ) {
          changes.push({
            type: 'modify',
            taskId,
            description: `Modified task: ${updated.description}`,
            impact: 'low',
            justification: 'Adjusted to improve execution',
          });
        }
      }
    }

    return changes;
  }

  /**
   * Generate replanning reasoning
   */
  private generateReplanningReasoning(
    trigger: ReplanTrigger,
    changes: PlanChange[]
  ): string {
    let reasoning = `Replanning triggered by ${trigger.type} event (severity: ${trigger.severity}).\n\n`;

    reasoning += `Changes made:\n`;
    reasoning += `- Added: ${changes.filter((c) => c.type === 'add').length} tasks\n`;
    reasoning += `- Removed: ${changes.filter((c) => c.type === 'remove').length} tasks\n`;
    reasoning += `- Modified: ${changes.filter((c) => c.type === 'modify').length} tasks\n\n`;

    if (changes.length > 0) {
      reasoning += `Key changes:\n`;
      for (const change of changes.slice(0, 5)) {
        reasoning += `- ${change.description}\n`;
      }
    }

    reasoning += `\nStrategy: ${this.config.replanningStrategy}\n`;
    reasoning += `Attempt ${this.replanAttempts} of ${this.config.maxReplanAttempts}`;

    return reasoning;
  }

  /**
   * Calculate replanning confidence
   */
  private calculateReplanConfidence(
    trigger: ReplanTrigger,
    changes: PlanChange[]
  ): number {
    let confidence = 0.7;

    // Adjust based on severity
    switch (trigger.severity) {
      case 'critical':
        confidence -= 0.2;
        break;
      case 'high':
        confidence -= 0.1;
        break;
      case 'low':
        confidence += 0.1;
        break;
    }

    // Adjust based on number of changes
    const changeCount = changes.length;
    if (changeCount === 0) {
      confidence -= 0.3;
    } else if (changeCount > 10) {
      confidence -= 0.2;
    } else if (changeCount < 5) {
      confidence += 0.1;
    }

    // Adjust based on replan attempts
    confidence -= (this.replanAttempts - 1) * 0.1;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Estimate delay from changes
   */
  private estimateDelay(changes: PlanChange[]): number {
    // Simple heuristic: each change adds ~5 minutes delay
    return changes.length * 5 * 60 * 1000;
  }

  /**
   * Create error with proper type
   */
  private createError(
    message: string,
    code: string,
    details?: Record<string, unknown>
  ): ReplanningError {
    const error = new Error(message) as ReplanningError;
    error.name = 'ReplanningError';
    error.code = code;
    error.details = details;
    return error;
  }
}

// ============================================================================
// Replanning Strategies
// ============================================================================

export class ReplanningStrategies {
  /**
   * Backtracking strategy - revert to last known good state
   */
  static async backtracking(
    currentPlan: Task[],
    executionHistory: ExecutionEvent[]
  ): Promise<Task[]> {
    // Find last successful state
    const lastSuccessfulEvent = [...executionHistory]
      .reverse()
      .find((e) => e.type === 'complete');

    if (!lastSuccessfulEvent) {
      return currentPlan; // No successful state to revert to
    }

    // Reset plan to state after last successful event
    return currentPlan.filter((task) => {
      const eventIndex = executionHistory.findIndex(
        (e) => e.taskId === task.id
      );
      return eventIndex <= executionHistory.indexOf(lastSuccessfulEvent);
    });
  }

  /**
   * Partial replanning - only modify affected portion
   */
  static async partialReplan(
    currentPlan: Task[],
    affectedTaskIds: string[]
  ): Promise<Task[]> {
    const unaffectedTasks = currentPlan.filter(
      (t) => !affectedTaskIds.includes(t.id)
    );

    // Regenerate only affected tasks
    // In practice, this would call a task generator
    const regeneratedTasks: Task[] = [];

    for (const taskId of affectedTaskIds) {
      const originalTask = currentPlan.find((t) => t.id === taskId);
      if (originalTask) {
        const regeneratedTask: Task = {
          ...originalTask,
          id: `regen_${originalTask.id}_${Date.now()}`,
          status: 'pending',
          metadata: {
            ...originalTask.metadata,
            regenerated: true,
            originalTaskId: originalTask.id,
          },
        };
        regeneratedTasks.push(regeneratedTask);
      }
    }

    return [...unaffectedTasks, ...regeneratedTasks];
  }

  /**
   * Incremental adjustment - make small improvements
   */
  static async incrementalAdjustment(
    currentPlan: Task[],
    performanceMetrics: Record<string, number>
  ): Promise<Task[]> {
    return currentPlan.map((task) => {
      const performance = performanceMetrics[task.id] ?? 1.0;

      // Adjust based on performance
      if (performance < 0.5) {
        // Poor performance - increase resources
        return {
          ...task,
          resources: task.resources?.map((r) => ({
            ...r,
            allocated: Math.min(r.allocated * 1.5, r.capacity),
          })),
        };
      } else if (performance > 0.9) {
        // Excellent performance - can reduce resources
        return {
          ...task,
          resources: task.resources?.map((r) => ({
            ...r,
            allocated: Math.floor(r.allocated * 0.8),
          })),
        };
      }

      return task;
    });
  }
}

// ============================================================================
// Utility Functions
// ============================================================================>

/**
 * Validate replanning configuration
 */
export function validateReplanConfig(
  config: ReplanConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.failureThreshold !== undefined) {
    if (config.failureThreshold < 0 || config.failureThreshold > 1) {
      errors.push('failureThreshold must be between 0 and 1');
    }
  }

  if (config.qualityThreshold !== undefined) {
    if (config.qualityThreshold < 0 || config.qualityThreshold > 1) {
      errors.push('qualityThreshold must be between 0 and 1');
    }
  }

  if (config.maxReplanAttempts !== undefined && config.maxReplanAttempts < 1) {
    errors.push('maxReplanAttempts must be at least 1');
  }

  const validStrategies = ['conservative', 'moderate', 'aggressive'];
  if (
    config.replanningStrategy !== undefined &&
    !validStrategies.includes(config.replanningStrategy)
  ) {
    errors.push(
      `replanningStrategy must be one of: ${validStrategies.join(', ')}`
    );
  }

  const validSensitivity = ['low', 'medium', 'high'];
  if (
    config.triggerSensitivity !== undefined &&
    !validSensitivity.includes(config.triggerSensitivity)
  ) {
    errors.push(
      `triggerSensitivity must be one of: ${validSensitivity.join(', ')}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate execution progress percentage
 */
export function calculateExecutionProgress(
  plan: Task[],
  completedTasks: Set<string>
): number {
  if (plan.length === 0) {
    return 0;
  }

  const completedCount = plan.filter((t) => completedTasks.has(t.id)).length;
  return completedCount / plan.length;
}

/**
 * Identify bottleneck tasks
 */
export function identifyBottlenecks(
  plan: Task[],
  executionHistory: ExecutionEvent[]
): string[] {
  const bottlenecks: string[] = [];
  const taskDurations = new Map<string, number>();

  // Calculate durations
  for (let i = 0; i < executionHistory.length; i++) {
    const event = executionHistory[i];
    if (event.type === 'start') {
      const endEvent = executionHistory
        .slice(i + 1)
        .find((e) => e.taskId === event.taskId && e.type === 'complete');

      if (endEvent) {
        const duration = endEvent.timestamp - event.timestamp;
        taskDurations.set(event.taskId, duration);
      }
    }
  }

  // Find tasks taking significantly longer than estimated
  for (const task of plan) {
    const actualDuration = taskDurations.get(task.id);
    const estimatedDuration = task.estimatedDuration;

    if (
      actualDuration &&
      estimatedDuration &&
      actualDuration > estimatedDuration * 1.5
    ) {
      bottlenecks.push(task.id);
    }
  }

  return bottlenecks;
}

/**
 * Suggest alternative execution order
 */
export function suggestAlternativeOrder(
  plan: Task[],
  bottlenecks: string[]
): Task[] {
  // Prioritize non-bottleneck tasks
  const priorityTasks = plan.filter((t) => !bottlenecks.includes(t.id));
  const bottleneckTasks = plan.filter((t) => bottlenecks.includes(t.id));

  // Sort by priority and dependencies
  const sorted = [...priorityTasks, ...bottleneckTasks].sort((a, b) => {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    // Prefer tasks with fewer dependencies
    return a.dependencies.length - b.dependencies.length;
  });

  return sorted;
}
