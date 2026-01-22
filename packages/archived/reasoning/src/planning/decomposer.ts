/**
 * Task Decomposition System
 *
 * Breaks down complex tasks into manageable subtasks with dependency analysis,
 * resource allocation, timeline estimation, and risk assessment.
 */

import type {
  Task,
  TaskDecompositionConfig,
  TaskDecompositionResult,
  TaskGraph,
  ResourceAllocation,
  ResourceAllocationItem,
  ResourceConflict,
  TaskTimeline,
  Milestone,
  Phase,
  Resource,
  Risk,
  PlanningError,
} from '../types';

// ============================================================================
// Task Decomposition Engine
// ============================================================================

export class TaskDecomposer {
  private config: Required<TaskDecompositionConfig>;
  private taskIdCounter = 0;

  constructor(config: TaskDecompositionConfig = {}) {
    this.config = {
      maxDepth: config.maxDepth ?? 5,
      granularity: config.granularity ?? 'medium',
      includeTimeEstimates: config.includeTimeEstimates ?? true,
      includeResourceAnalysis: config.includeResourceAnalysis ?? true,
      includeRiskAssessment: config.includeRiskAssessment ?? true,
      parallelizationThreshold: config.parallelizationThreshold ?? 0.3,
    };
  }

  /**
   * Decompose a complex task into subtasks
   */
  async decompose(
    problem: string,
    context?: string
  ): Promise<TaskDecompositionResult> {
    const startTime = Date.now();

    try {
      // Create root task
      const rootTask = await this.createRootTask(problem, context);

      // Decompose recursively
      await this.decomposeTaskRecursive(rootTask, 0);

      // Build task graph
      const taskGraph = this.buildTaskGraph(rootTask);

      // Analyze critical path
      const criticalPath = this.analyzeCriticalPath(taskGraph);

      // Allocate resources
      const resourceAllocation = await this.allocateResources(taskGraph);

      // Create timeline
      const timeline = this.createTimeline(taskGraph, resourceAllocation);

      // Calculate metadata
      const totalTasks = this.countTasks(rootTask);
      const maxDepth = this.calculateMaxDepth(rootTask);
      const estimatedCompletionTime = this.calculateTotalTime(timeline);

      const executionTime = Date.now() - startTime;

      return {
        rootTask,
        taskGraph,
        criticalPath,
        resourceAllocation,
        timeline,
        metadata: {
          totalTasks,
          maxDepth,
          estimatedCompletionTime,
        },
      };
    } catch (error) {
      throw this.createError(
        'Task decomposition failed',
        'DECOMPOSITION_FAILED',
        { problem, error }
      );
    }
  }

  /**
   * Create root task from problem description
   */
  private async createRootTask(
    problem: string,
    context?: string
  ): Promise<Task> {
    const task: Task = {
      id: this.generateTaskId(),
      description: context
        ? `${problem}\n\nContext: ${context}`
        : problem,
      dependencies: [],
      estimatedDuration: this.config.includeTimeEstimates
        ? await this.estimateDuration(problem)
        : undefined,
      priority: this.determinePriority(problem),
      status: 'pending',
      metadata: {
        isRoot: true,
        level: 0,
      },
      subtasks: [],
      resources: this.config.includeResourceAnalysis
        ? await this.identifyResources(problem)
        : undefined,
      risks: this.config.includeRiskAssessment
        ? await this.assessRisks(problem)
        : undefined,
    };

    return task;
  }

  /**
   * Recursively decompose tasks
   */
  private async decomposeTaskRecursive(
    task: Task,
    currentDepth: number
  ): Promise<void> {
    if (currentDepth >= this.config.maxDepth) {
      return;
    }

    // Check if task should be decomposed further
    if (!this.shouldDecompose(task, currentDepth)) {
      return;
    }

    // Generate subtasks
    const subtasks = await this.generateSubtasks(task, currentDepth);

    task.subtasks = subtasks;

    // Recursively decompose subtasks
    for (const subtask of subtasks) {
      await this.decomposeTaskRecursive(subtask, currentDepth + 1);
    }
  }

  /**
   * Determine if a task should be decomposed
   */
  private shouldDecompose(task: Task, currentDepth: number): boolean {
    // Check depth limit
    if (currentDepth >= this.config.maxDepth) {
      return false;
    }

    // Check granularity
    const complexity = this.estimateComplexity(task);
    const granularityThreshold = {
      coarse: 0.8,
      medium: 0.5,
      fine: 0.2,
    };

    return complexity > granularityThreshold[this.config.granularity];
  }

  /**
   * Estimate task complexity
   */
  private estimateComplexity(task: Task): number {
    let complexity = 0.5;

    // Analyze description length
    const descriptionLength = task.description.length;
    complexity += Math.min(descriptionLength / 500, 0.3);

    // Check for complexity indicators
    const complexityIndicators = [
      'multiple',
      'several',
      'various',
      'complex',
      'integrate',
      'coordinate',
      'manage',
    ];

    const lowerDescription = task.description.toLowerCase();
    for (const indicator of complexityIndicators) {
      if (lowerDescription.includes(indicator)) {
        complexity += 0.1;
      }
    }

    // Consider dependencies
    complexity += Math.min(task.dependencies.length * 0.05, 0.2);

    // Consider resources
    if (task.resources && task.resources.length > 2) {
      complexity += 0.1;
    }

    return Math.min(1, complexity);
  }

  /**
   * Generate subtasks for a given task
   */
  private async generateSubtasks(
    parentTask: Task,
    currentDepth: number
  ): Promise<Task[]> {
    // Analyze parent task to identify components
    const components = await this.identifyTaskComponents(parentTask);

    const subtasks: Task[] = [];

    for (let i = 0; i < components.length; i++) {
      const component = components[i];

      const subtask: Task = {
        id: this.generateTaskId(),
        description: component.description,
        dependencies: component.dependencies,
        estimatedDuration: this.config.includeTimeEstimates
          ? await this.estimateDuration(component.description)
          : undefined,
        priority: this.determinePriority(component.description),
        status: 'pending',
        metadata: {
          parentTask: parentTask.id,
          level: currentDepth + 1,
          componentIndex: i,
        },
        subtasks: [],
        resources: this.config.includeResourceAnalysis
          ? await this.identifyResources(component.description)
          : undefined,
        risks: this.config.includeRiskAssessment
          ? await this.assessRisks(component.description)
          : undefined,
      };

      subtasks.push(subtask);
    }

    return subtasks;
  }

  /**
   * Identify task components for decomposition
   */
  private async identifyTaskComponents(
    task: Task
  ): Promise<Array<{ description: string; dependencies: string[] }>> {
    // In a real implementation, this would use NLP/LLM
    // For now, we provide heuristic-based decomposition

    const components: Array<{
      description: string;
      dependencies: string[];
    }> = [];

    const lowerDescription = task.description.toLowerCase();

    // Pattern-based decomposition
    if (lowerDescription.includes(' and ')) {
      const parts = task.description.split(/\s+and\s+/i);
      for (const part of parts) {
        components.push({
          description: part.trim(),
          dependencies: [],
        });
      }
    } else if (lowerDescription.includes(' then ')) {
      const parts = task.description.split(/\s+then\s+/i);
      for (let i = 0; i < parts.length; i++) {
        components.push({
          description: parts[i].trim(),
          dependencies: i > 0 ? [components[i - 1].description] : [],
        });
      }
    } else if (lowerDescription.includes(' implement ')) {
      components.push({
        description: 'Design and plan implementation',
        dependencies: [],
      });
      components.push({
        description: 'Implement core functionality',
        dependencies: [components[0].description],
      });
      components.push({
        description: 'Test and validate',
        dependencies: [components[1].description],
      });
    } else {
      // Generic decomposition
      components.push({
        description: `Analyze: ${task.description}`,
        dependencies: [],
      });
      components.push({
        description: `Execute: ${task.description}`,
        dependencies: [components[0].description],
      });
      components.push({
        description: `Verify: ${task.description}`,
        dependencies: [components[1].description],
      });
    }

    return components;
  }

  /**
   * Estimate task duration
   */
  private async estimateDuration(description: string): Promise<number> {
    // Simple heuristic-based estimation
    // In production, this would use historical data or ML models

    const wordCount = description.split(/\s+/).length;
    const baseTime = wordCount * 1000; // 1 second per word

    // Multipliers for complexity
    let multiplier = 1;

    if (description.toLowerCase().includes('complex')) {
      multiplier *= 2;
    }
    if (description.toLowerCase().includes('multiple')) {
      multiplier *= 1.5;
    }
    if (description.toLowerCase().includes('integrate')) {
      multiplier *= 1.3;
    }

    return baseTime * multiplier;
  }

  /**
   * Determine task priority
   */
  private determinePriority(description: string): Task['priority'] {
    const lowerDescription = description.toLowerCase();

    const criticalKeywords = ['urgent', 'critical', 'security', 'blocking'];
    const highKeywords = ['important', 'priority', 'asap', 'immediate'];
    const lowKeywords = ['nice-to-have', 'optional', 'later', 'eventually'];

    if (criticalKeywords.some((k) => lowerDescription.includes(k))) {
      return 'critical';
    }
    if (highKeywords.some((k) => lowerDescription.includes(k))) {
      return 'high';
    }
    if (lowKeywords.some((k) => lowerDescription.includes(k))) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Identify required resources
   */
  private async identifyResources(description: string): Promise<Resource[]> {
    const resources: Resource[] = [];

    const lowerDescription = description.toLowerCase();

    // Check for common resource types
    if (lowerDescription.includes('api') || lowerDescription.includes('http')) {
      resources.push({
        type: 'api',
        id: 'http-client',
        capacity: 100,
        allocated: 0,
        availability: 1,
      });
    }

    if (lowerDescription.includes('database') || lowerDescription.includes('storage')) {
      resources.push({
        type: 'database',
        id: 'db-connection',
        capacity: 50,
        allocated: 0,
        availability: 1,
      });
    }

    if (lowerDescription.includes('compute') || lowerDescription.includes('calculate')) {
      resources.push({
        type: 'compute',
        id: 'cpu',
        capacity: 1000,
        allocated: 0,
        availability: 1,
      });
    }

    return resources;
  }

  /**
   * Assess potential risks
   */
  private async assessRisks(description: string): Promise<Risk[]> {
    const risks: Risk[] = [];
    let riskId = 0;

    const lowerDescription = description.toLowerCase();

    // Check for common risk indicators
    if (lowerDescription.includes('external') || lowerDescription.includes('third-party')) {
      risks.push({
        id: `risk_${riskId++}`,
        description: 'Dependency on external services',
        probability: 0.3,
        impact: 'medium',
        mitigation: 'Implement fallback mechanisms and retry logic',
      });
    }

    if (lowerDescription.includes('complex') || lowerDescription.includes('complicated')) {
      risks.push({
        id: `risk_${riskId++}`,
        description: 'Complexity may lead to errors',
        probability: 0.4,
        impact: 'high',
        mitigation: 'Thorough testing and code review',
      });
    }

    if (lowerDescription.includes('large') || lowerDescription.includes('scale')) {
      risks.push({
        id: `risk_${riskId++}`,
        description: 'Performance issues at scale',
        probability: 0.5,
        impact: 'high',
        mitigation: 'Load testing and optimization',
      });
    }

    return risks;
  }

  /**
   * Build task graph structure
   */
  private buildTaskGraph(rootTask: Task): TaskGraph {
    const nodes = new Map<string, Task>();
    const edges = new Map<string, string[]>();
    const levels = new Map<number, string[]>();

    const processTask = (task: Task, level: number) => {
      nodes.set(task.id, task);
      edges.set(task.id, task.dependencies);

      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level)!.push(task.id);

      if (task.subtasks) {
        for (const subtask of task.subtasks) {
          processTask(subtask, level + 1);
        }
      }
    };

    processTask(rootTask, 0);

    return { nodes, edges, levels };
  }

  /**
   * Analyze critical path using longest path algorithm
   */
  private analyzeCriticalPath(taskGraph: TaskGraph): string[] {
    const topologicalOrder = this.topologicalSort(taskGraph);
    const longestPath = new Map<string, number>();
    const predecessors = new Map<string, string | null>();

    // Initialize
    for (const nodeId of topologicalOrder) {
      longestPath.set(nodeId, 0);
      predecessors.set(nodeId, null);
    }

    // Dynamic programming for longest path
    for (const nodeId of topologicalOrder) {
      const node = taskGraph.nodes.get(nodeId)!;
      const currentDuration = longestPath.get(nodeId)! + (node.estimatedDuration ?? 0);

      for (const depId of node.dependencies) {
        const depDuration = longestPath.get(depId) ?? 0;
        if (currentDuration > depDuration) {
          longestPath.set(depId, currentDuration);
          predecessors.set(depId, nodeId);
        }
      }
    }

    // Reconstruct path
    const criticalPath: string[] = [];
    let currentId = Array.from(taskGraph.nodes.keys()).reduce((a, b) =>
      (longestPath.get(a) ?? 0) > (longestPath.get(b) ?? 0) ? a : b
    );

    while (currentId) {
      criticalPath.unshift(currentId);
      currentId = predecessors.get(currentId) ?? '';
    }

    return criticalPath;
  }

  /**
   * Topological sort of task graph
   */
  private topologicalSort(taskGraph: TaskGraph): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);

      const node = taskGraph.nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          visit(depId);
        }
      }

      result.push(nodeId);
    };

    for (const nodeId of taskGraph.nodes.keys()) {
      visit(nodeId);
    }

    return result;
  }

  /**
   * Allocate resources to tasks
   */
  private async allocateResources(
    taskGraph: TaskGraph
  ): Promise<ResourceAllocation> {
    const allocations = new Map<string, ResourceAllocationItem[]>();
    const conflicts: ResourceConflict[] = [];
    let totalAllocated = 0;
    let totalCapacity = 0;

    // Collect all resources
    const resourceMap = new Map<string, Resource>();

    for (const task of taskGraph.nodes.values()) {
      if (task.resources) {
        for (const resource of task.resources) {
          const key = `${resource.type}_${resource.id}`;
          if (!resourceMap.has(key)) {
            resourceMap.set(key, { ...resource });
          }
        }
      }
    }

    // Allocate resources based on task priority and dependencies
    const sortedTasks = Array.from(taskGraph.nodes.values()).sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    for (const task of sortedTasks) {
      if (!task.resources) {
        continue;
      }

      for (const resource of task.resources) {
        const key = `${resource.type}_${resource.id}`;
        const globalResource = resourceMap.get(key);

        if (!globalResource) {
          continue;
        }

        // Check if resource is available
        if (globalResource.allocated + resource.capacity <= globalResource.capacity) {
          const allocation: ResourceAllocationItem = {
            taskId: task.id,
            resourceId: key,
            amount: resource.capacity,
            startTime: Date.now(),
            endTime: Date.now() + (task.estimatedDuration ?? 0),
          };

          if (!allocations.has(task.id)) {
            allocations.set(task.id, []);
          }
          allocations.get(task.id)!.push(allocation);

          globalResource.allocated += resource.capacity;
          totalAllocated += resource.capacity;
        } else {
          // Resource conflict
          conflicts.push({
            resourceId: key,
            tasks: [task.id],
            conflictType: 'overallocation',
            resolution: 'Queue task for later execution when resource is available',
          });
        }

        totalCapacity += globalResource.capacity;
      }
    }

    const utilization = totalCapacity > 0 ? totalAllocated / totalCapacity : 0;

    return {
      resources: allocations,
      conflicts,
      utilization,
    };
  }

  /**
   * Create timeline for task execution
   */
  private createTimeline(
    taskGraph: TaskGraph,
    resourceAllocation: ResourceAllocation
  ): TaskTimeline {
    const startTime = Date.now();
    let endTime = startTime;

    const milestones: Milestone[] = [];
    const phases: Phase[] = [];

    // Calculate end time based on task durations
    for (const task of taskGraph.nodes.values()) {
      if (task.estimatedDuration) {
        const taskEnd = startTime + task.estimatedDuration;
        if (taskEnd > endTime) {
          endTime = taskEnd;
        }
      }
    }

    // Create milestones for critical tasks
    for (const task of taskGraph.nodes.values()) {
      if (task.priority === 'critical' || task.priority === 'high') {
        milestones.push({
          id: `milestone_${task.id}`,
          name: task.description.substring(0, 50),
          taskId: task.id,
          timestamp: startTime + (task.estimatedDuration ?? 0),
          completed: false,
        });
      }
    }

    // Create phases based on task levels
    for (const [level, taskIds] of taskGraph.levels) {
      const phaseTasks = taskIds;
      const phaseStartTime = startTime + level * 1000;
      const phaseEndTime = phaseStartTime + 5000;

      phases.push({
        id: `phase_${level}`,
        name: `Phase ${level + 1}`,
        tasks: phaseTasks,
        startTime: phaseStartTime,
        endTime: phaseEndTime,
        parallelizable: this.canParallelize(taskIds, taskGraph),
      });
    }

    return {
      startTime,
      endTime,
      milestones,
      phases,
    };
  }

  /**
   * Determine if tasks can be parallelized
   */
  private canParallelize(taskIds: string[], taskGraph: TaskGraph): boolean {
    // Check if tasks have dependencies on each other
    for (const taskId of taskIds) {
      const task = taskGraph.nodes.get(taskId);
      if (!task) {
        continue;
      }

      for (const depId of task.dependencies) {
        if (taskIds.includes(depId)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Count total tasks in tree
   */
  private countTasks(task: Task): number {
    let count = 1;
    if (task.subtasks) {
      for (const subtask of task.subtasks) {
        count += this.countTasks(subtask);
      }
    }
    return count;
  }

  /**
   * Calculate maximum depth of task tree
   */
  private calculateMaxDepth(task: Task): number {
    if (!task.subtasks || task.subtasks.length === 0) {
      return 0;
    }

    return (
      1 +
      Math.max(...task.subtasks.map((st) => this.calculateMaxDepth(st)))
    );
  }

  /**
   * Calculate total timeline duration
   */
  private calculateTotalTime(timeline: TaskTimeline): number {
    return timeline.endTime - timeline.startTime;
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${this.taskIdCounter++}_${Date.now()}`;
  }

  /**
   * Create error with proper type
   */
  private createError(
    message: string,
    code: string,
    details?: Record<string, unknown>
  ): PlanningError {
    const error = new Error(message) as PlanningError;
    error.name = 'PlanningError';
    error.code = code;
    error.details = details;
    return error;
  }
}

// ============================================================================
// Task Graph Analysis
// ============================================================================

export class TaskGraphAnalyzer {
  /**
   * Find all tasks with no dependencies (entry points)
   */
  static findEntryPoints(taskGraph: TaskGraph): string[] {
    const entryPoints: string[] = [];

    for (const [id, task] of taskGraph.nodes) {
      if (task.dependencies.length === 0) {
        entryPoints.push(id);
      }
    }

    return entryPoints;
  }

  /**
   * Find all tasks with no dependents (exit points)
   */
  static findExitPoints(taskGraph: TaskGraph): string[] {
    const allTasks = new Set(taskGraph.nodes.keys());
    const dependentTasks = new Set<string>();

    for (const task of taskGraph.nodes.values()) {
      for (const dep of task.dependencies) {
        dependentTasks.add(dep);
      }
    }

    const exitPoints: string[] = [];
    for (const taskId of allTasks) {
      if (!dependentTasks.has(taskId)) {
        exitPoints.push(taskId);
      }
    }

    return exitPoints;
  }

  /**
   * Detect cycles in task graph
   */
  static detectCycles(taskGraph: TaskGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const node = taskGraph.nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          if (!visited.has(depId)) {
            if (dfs(depId)) {
              return true;
            }
          } else if (recursionStack.has(depId)) {
            // Found cycle
            const cycleStart = path.indexOf(depId);
            cycles.push([...path.slice(cycleStart), depId]);
            return true;
          }
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of taskGraph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  /**
   * Calculate task dependencies depth
   */
  static calculateDependencyDepth(taskGraph: TaskGraph, taskId: string): number {
    const depths = new Map<string, number>();

    const calculate = (id: string): number => {
      if (depths.has(id)) {
        return depths.get(id)!;
      }

      const task = taskGraph.nodes.get(id);
      if (!task || task.dependencies.length === 0) {
        depths.set(id, 0);
        return 0;
      }

      let maxDepth = 0;
      for (const depId of task.dependencies) {
        const depDepth = calculate(depId);
        if (depDepth > maxDepth) {
          maxDepth = depDepth;
        }
      }

      depths.set(id, maxDepth + 1);
      return maxDepth + 1;
    };

    return calculate(taskId);
  }

  /**
   * Find parallelizable tasks
   */
  static findParallelizableTasks(taskGraph: TaskGraph): string[][] {
    const parallelGroups: string[][] = [];
    const processed = new Set<string>();

    for (const taskId of taskGraph.nodes.keys()) {
      if (processed.has(taskId)) {
        continue;
      }

      const group: string[] = [taskId];
      const task = taskGraph.nodes.get(taskId)!;

      // Find tasks with no dependencies on each other
      for (const otherId of taskGraph.nodes.keys()) {
        if (otherId === taskId || processed.has(otherId)) {
          continue;
        }

        const otherTask = taskGraph.nodes.get(otherId)!;

        // Check if tasks are independent
        const hasDependency =
          task.dependencies.includes(otherId) ||
          otherTask.dependencies.includes(taskId);

        if (!hasDependency) {
          group.push(otherId);
        }
      }

      if (group.length > 1) {
        parallelGroups.push(group);
        for (const id of group) {
          processed.add(id);
        }
      }
    }

    return parallelGroups;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate task decomposition configuration
 */
export function validateDecompositionConfig(
  config: TaskDecompositionConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.maxDepth !== undefined && config.maxDepth < 1) {
    errors.push('maxDepth must be at least 1');
  }

  if (
    config.parallelizationThreshold !== undefined &&
    (config.parallelizationThreshold < 0 || config.parallelizationThreshold > 1)
  ) {
    errors.push('parallelizationThreshold must be between 0 and 1');
  }

  const validGranularity = ['coarse', 'medium', 'fine'];
  if (
    config.granularity !== undefined &&
    !validGranularity.includes(config.granularity)
  ) {
    errors.push(
      `granularity must be one of: ${validGranularity.join(', ')}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate task completion percentage
 */
export function calculateCompletionPercentage(task: Task): number {
  if (task.status === 'completed') {
    return 1;
  }
  if (task.status === 'pending') {
    return 0;
  }

  if (!task.subtasks || task.subtasks.length === 0) {
    return task.status === 'in-progress' ? 0.5 : 0;
  }

  const totalCompletion = task.subtasks.reduce(
    (sum, subtask) => sum + calculateCompletionPercentage(subtask),
    0
  );

  return totalCompletion / task.subtasks.length;
}

/**
 * Find blocked tasks
 */
export function findBlockedTasks(taskGraph: TaskGraph): string[] {
  const blocked: string[] = [];

  for (const [id, task] of taskGraph.nodes) {
    for (const depId of task.dependencies) {
      const depTask = taskGraph.nodes.get(depId);
      if (!depTask) {
        continue;
      }

      if (
        depTask.status === 'failed' ||
        depTask.status === 'blocked' ||
        depTask.status === 'in-progress'
      ) {
        blocked.push(id);
        break;
      }
    }
  }

  return blocked;
}

/**
 * Export task tree as indented text
 */
export function exportTaskTreeAsText(task: Task, indent: number = 0): string {
  const prefix = '  '.repeat(indent);
  let output = `${prefix}${task.description}`;

  if (task.status !== 'pending') {
    output += ` [${task.status}]`;
  }

  if (task.estimatedDuration) {
    output += ` (${Math.round(task.estimatedDuration / 1000)}s)`;
  }

  output += '\n';

  if (task.subtasks) {
    for (const subtask of task.subtasks) {
      output += exportTaskTreeAsText(subtask, indent + 1);
    }
  }

  return output;
}
