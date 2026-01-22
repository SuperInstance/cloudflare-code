/**
 * Dependency Manager
 * Manages job dependency graphs, resolution, topological sorting, and cascade handling
 */

import {
  Job,
  JobStatus,
  JobResult,
  Dependency,
  DependencyGraph,
  Logger
} from '../types';

/**
 * Configuration for dependency manager
 */
export interface DependencyManagerConfig {
  enableCascade?: boolean;
  maxDepth?: number;
  logger?: Logger;
}

/**
 * Topological sort result
 */
export interface TopologicalSortResult {
  sortedJobs: string[];
  cyclicDependencies: string[][];
  missingDependencies: string[];
}

/**
 * Dependency resolution result
 */
export interface DependencyResolutionResult {
  readyJobs: string[];
  blockedJobs: Map<string, string[]>; // jobId -> blocking dependencies
  failedJobs: string[];
}

/**
 * Dependency manager class
 */
export class DependencyManager {
  private config: DependencyManagerConfig;
  private logger: Logger;
  private dependencyGraph: DependencyGraph;
  private dependencies: Map<string, Dependency>;
  private jobStatuses: Map<string, JobStatus>;
  private jobResults: Map<string, JobResult>;

  constructor(config: DependencyManagerConfig = {}) {
    this.config = {
      enableCascade: config.enableCascade ?? true,
      maxDepth: config.maxDepth || 100
    };

    this.logger = config.logger || this.createDefaultLogger();

    this.dependencyGraph = {
      nodes: new Map(),
      edges: new Map(),
      reverseEdges: new Map()
    };

    this.dependencies = new Map();
    this.jobStatuses = new Map();
    this.jobResults = new Map();
  }

  /**
   * Add a job to the dependency graph
   */
  addJob(job: Job): void {
    this.dependencyGraph.nodes.set(job.id, job);
    this.jobStatuses.set(job.id, job.status);
    this.dependencyGraph.edges.set(job.id, new Set(job.dependencies));
    this.dependencyGraph.reverseEdges.set(job.id, new Set());

    // Update reverse edges
    for (const depId of job.dependencies) {
      if (!this.dependencyGraph.reverseEdges.has(depId)) {
        this.dependencyGraph.reverseEdges.set(depId, new Set());
      }
      this.dependencyGraph.reverseEdges.get(depId)!.add(job.id);
    }

    this.logger.debug(`Job added to dependency graph: ${job.id}`);
  }

  /**
   * Remove a job from the dependency graph
   */
  removeJob(jobId: string): void {
    const job = this.dependencyGraph.nodes.get(jobId);
    if (!job) {
      return;
    }

    // Remove edges
    const dependencies = this.dependencyGraph.edges.get(jobId) || new Set();
    for (const depId of dependencies) {
      const reverseEdges = this.dependencyGraph.reverseEdges.get(depId);
      if (reverseEdges) {
        reverseEdges.delete(jobId);
      }
    }

    const reverseEdges = this.dependencyGraph.reverseEdges.get(jobId) || new Set();
    for (const dependentId of reverseEdges) {
      const edges = this.dependencyGraph.edges.get(dependentId);
      if (edges) {
        edges.delete(jobId);
      }
    }

    this.dependencyGraph.nodes.delete(jobId);
    this.dependencyGraph.edges.delete(jobId);
    this.dependencyGraph.reverseEdges.delete(jobId);
    this.jobStatuses.delete(jobId);
    this.jobResults.delete(jobId);

    this.logger.debug(`Job removed from dependency graph: ${jobId}`);
  }

  /**
   * Add a dependency relationship
   */
  addDependency(
    jobId: string,
    dependsOn: string,
    type: 'hard' | 'soft' = 'hard',
    condition?: (result: JobResult) => boolean
  ): void {
    const job = this.dependencyGraph.nodes.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found in graph`);
    }

    const dependency: Dependency = {
      jobId,
      dependsOn,
      type,
      condition
    };

    this.dependencies.set(`${jobId}:${dependsOn}`, dependency);

    // Update edges
    if (!this.dependencyGraph.edges.has(jobId)) {
      this.dependencyGraph.edges.set(jobId, new Set());
    }
    this.dependencyGraph.edges.get(jobId)!.add(dependsOn);

    if (!this.dependencyGraph.reverseEdges.has(dependsOn)) {
      this.dependencyGraph.reverseEdges.set(dependsOn, new Set());
    }
    this.dependencyGraph.reverseEdges.get(dependsOn)!.add(jobId);

    this.logger.debug(`Dependency added: ${jobId} depends on ${dependsOn}`);
  }

  /**
   * Remove a dependency relationship
   */
  removeDependency(jobId: string, dependsOn: string): void {
    const key = `${jobId}:${dependsOn}`;
    this.dependencies.delete(key);

    const edges = this.dependencyGraph.edges.get(jobId);
    if (edges) {
      edges.delete(dependsOn);
    }

    const reverseEdges = this.dependencyGraph.reverseEdges.get(dependsOn);
    if (reverseEdges) {
      reverseEdges.delete(jobId);
    }

    this.logger.debug(`Dependency removed: ${jobId} depends on ${dependsOn}`);
  }

  /**
   * Update job status
   */
  updateJobStatus(jobId: string, status: JobStatus): void {
    const oldStatus = this.jobStatuses.get(jobId);
    this.jobStatuses.set(jobId, status);

    this.logger.debug(`Job ${jobId} status updated: ${oldStatus} -> ${status}`);

    // Handle cascade if enabled
    if (this.config.enableCascade) {
      this.handleCascade(jobId, status);
    }
  }

  /**
   * Update job result
   */
  updateJobResult(jobId: string, result: JobResult): void {
    this.jobResults.set(jobId, result);

    // Check if this affects any dependent jobs
    const reverseEdges = this.dependencyGraph.reverseEdges.get(jobId) || new Set();
    for (const dependentId of reverseEdges) {
      const depKey = `${dependentId}:${jobId}`;
      const dependency = this.dependencies.get(depKey);

      if (dependency && dependency.condition) {
        const satisfied = dependency.condition(result);
        if (!satisfied) {
          this.logger.warn(`Job ${dependentId} dependency condition not satisfied for ${jobId}`);
        }
      }
    }
  }

  /**
   * Handle cascade effects
   */
  private handleCascade(jobId: string, status: JobStatus): void {
    const reverseEdges = this.dependencyGraph.reverseEdges.get(jobId) || new Set();

    if (status === JobStatus.FAILED) {
      // Cancel or fail dependent jobs
      for (const dependentId of reverseEdges) {
        const depKey = `${dependentId}:${jobId}`;
        const dependency = this.dependencies.get(depKey);

        if (dependency && dependency.type === 'hard') {
          const depStatus = this.jobStatuses.get(dependentId);
          if (
            depStatus === JobStatus.PENDING ||
            depStatus === JobStatus.QUEUED ||
            depStatus === JobStatus.RETRYING
          ) {
            this.logger.warn(`Cancelling job ${dependentId} due to failed dependency ${jobId}`);
            this.jobStatuses.set(dependentId, JobStatus.CANCELLED);
          }
        }
      }
    } else if (status === JobStatus.COMPLETED) {
      // Check if any dependent jobs are now ready
      for (const dependentId of reverseEdges) {
        if (this.areDependenciesSatisfied(dependentId)) {
          this.logger.debug(`Job ${dependentId} is now ready to execute`);
        }
      }
    }
  }

  /**
   * Check if all dependencies are satisfied
   */
  areDependenciesSatisfied(jobId: string): boolean {
    const job = this.dependencyGraph.nodes.get(jobId);
    if (!job) {
      return false;
    }

    const dependencies = this.dependencyGraph.edges.get(jobId) || new Set();

    for (const depId of dependencies) {
      const depStatus = this.jobStatuses.get(depId);
      const depResult = this.jobResults.get(depId);

      // Check if dependency exists and is complete
      if (!depStatus) {
        return false;
      }

      // Check if dependency is in a terminal state
      if (
        depStatus !== JobStatus.COMPLETED &&
        depStatus !== JobStatus.FAILED &&
        depStatus !== JobStatus.CANCELLED
      ) {
        return false;
      }

      // Check dependency condition
      if (depResult) {
        const depKey = `${jobId}:${depId}`;
        const dependency = this.dependencies.get(depKey);

        if (dependency && dependency.condition) {
          if (!dependency.condition(depResult)) {
            return false;
          }
        }
      }

      // Hard dependencies must succeed
      if (depStatus === JobStatus.FAILED || depStatus === JobStatus.CANCELLED) {
        const depKey = `${jobId}:${depId}`;
        const dependency = this.dependencies.get(depKey);

        if (dependency && dependency.type === 'hard') {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Resolve dependencies for all jobs
   */
  resolveDependencies(): DependencyResolutionResult {
    const readyJobs: string[] = [];
    const blockedJobs = new Map<string, string[]>();
    const failedJobs: string[] = [];

    for (const [jobId, job] of this.dependencyGraph.nodes) {
      const status = this.jobStatuses.get(jobId);

      // Skip jobs that are already in terminal states
      if (
        status === JobStatus.COMPLETED ||
        status === JobStatus.FAILED ||
        status === JobStatus.CANCELLED
      ) {
        continue;
      }

      // Check if job has failed hard dependencies
      const dependencies = this.dependencyGraph.edges.get(jobId) || new Set();
      const failedDeps: string[] = [];

      for (const depId of dependencies) {
        const depStatus = this.jobStatuses.get(depId);
        const depKey = `${jobId}:${depId}`;
        const dependency = this.dependencies.get(depKey);

        if (
          (depStatus === JobStatus.FAILED || depStatus === JobStatus.CANCELLED) &&
          dependency?.type === 'hard'
        ) {
          failedDeps.push(depId);
        }
      }

      if (failedDeps.length > 0) {
        failedJobs.push(jobId);
        continue;
      }

      // Check if dependencies are satisfied
      if (this.areDependenciesSatisfied(jobId)) {
        readyJobs.push(jobId);
      } else {
        const blockingDeps: string[] = [];

        for (const depId of dependencies) {
          const depStatus = this.jobStatuses.get(depId);
          if (
            depStatus !== JobStatus.COMPLETED &&
            depStatus !== JobStatus.FAILED &&
            depStatus !== JobStatus.CANCELLED
          ) {
            blockingDeps.push(depId);
          }
        }

        blockedJobs.set(jobId, blockingDeps);
      }
    }

    return {
      readyJobs,
      blockedJobs,
      failedJobs
    };
  }

  /**
   * Perform topological sort
   */
  topologicalSort(): TopologicalSortResult {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const cyclicDependencies: string[][] = [];
    const missingDependencies: string[] = [];

    const visit = (jobId: string, path: string[]): void => {
      if (visited.has(jobId)) {
        return;
      }

      if (visiting.has(jobId)) {
        // Found a cycle
        const cycleStart = path.indexOf(jobId);
        const cycle = path.slice(cycleStart).concat([jobId]);
        cyclicDependencies.push(cycle);
        return;
      }

      visiting.add(jobId);
      path.push(jobId);

      const job = this.dependencyGraph.nodes.get(jobId);
      if (!job) {
        missingDependencies.push(jobId);
        return;
      }

      const dependencies = this.dependencyGraph.edges.get(jobId) || new Set();

      for (const depId of dependencies) {
        visit(depId, path);
      }

      visiting.delete(jobId);
      path.pop();
      visited.add(jobId);
      sorted.push(jobId);
    };

    for (const jobId of this.dependencyGraph.nodes.keys()) {
      if (!visited.has(jobId)) {
        visit(jobId, []);
      }
    }

    return {
      sortedJobs: sorted,
      cyclicDependencies,
      missingDependencies
    };
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies(): string[][] {
    const result = this.topologicalSort();
    return result.cyclicDependencies;
  }

  /**
   * Get dependency depth for a job
   */
  getDependencyDepth(jobId: string): number {
    return this.calculateDepth(jobId, new Set());
  }

  /**
   * Calculate depth recursively
   */
  private calculateDepth(jobId: string, visited: Set<string>): number {
    if (visited.has(jobId)) {
      // Circular dependency detected
      return 0;
    }

    visited.add(jobId);

    const dependencies = this.dependencyGraph.edges.get(jobId) || new Set();
    let maxDepth = 0;

    for (const depId of dependencies) {
      const depth = this.calculateDepth(depId, new Set(visited));
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth + 1;
  }

  /**
   * Get execution order for jobs
   */
  getExecutionOrder(): string[] {
    const result = this.topologicalSort();

    if (result.cyclicDependencies.length > 0) {
      this.logger.warn(
        `Circular dependencies detected: ${JSON.stringify(result.cyclicDependencies)}`
      );
    }

    if (result.missingDependencies.length > 0) {
      this.logger.warn(
        `Missing dependencies detected: ${JSON.stringify(result.missingDependencies)}`
      );
    }

    return result.sortedJobs;
  }

  /**
   * Get dependent jobs
   */
  getDependentJobs(jobId: string): string[] {
    const reverseEdges = this.dependencyGraph.reverseEdges.get(jobId);
    return reverseEdges ? Array.from(reverseEdges) : [];
  }

  /**
   * Get dependency chain for a job
   */
  getDependencyChain(jobId: string): string[] {
    const chain: string[] = [];
    const visited = new Set<string>();

    const buildChain = (id: string): void => {
      if (visited.has(id)) {
        return;
      }

      visited.add(id);
      const dependencies = this.dependencyGraph.edges.get(id) || new Set();

      for (const depId of dependencies) {
        chain.push(depId);
        buildChain(depId);
      }
    };

    buildChain(jobId);
    return chain;
  }

  /**
   * Get dependency graph
   */
  getDependencyGraph(): DependencyGraph {
    return {
      nodes: new Map(this.dependencyGraph.nodes),
      edges: new Map(this.dependencyGraph.edges),
      reverseEdges: new Map(this.dependencyGraph.reverseEdges)
    };
  }

  /**
   * Validate dependency graph
   */
  validateGraph(): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for circular dependencies
    const cycles = this.detectCircularDependencies();
    if (cycles.length > 0) {
      errors.push(
        `Circular dependencies detected: ${cycles.map((c) => c.join(' -> ')).join('; ')}`
      );
    }

    // Check for missing dependencies
    for (const [jobId, dependencies] of this.dependencyGraph.edges) {
      for (const depId of dependencies) {
        if (!this.dependencyGraph.nodes.has(depId)) {
          warnings.push(`Job ${jobId} depends on missing job ${depId}`);
        }
      }
    }

    // Check for excessive depth
    for (const jobId of this.dependencyGraph.nodes.keys()) {
      const depth = this.getDependencyDepth(jobId);
      if (depth > this.config.maxDepth!) {
        warnings.push(`Job ${jobId} has excessive dependency depth: ${depth}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Clear the dependency graph
   */
  clear(): void {
    this.dependencyGraph = {
      nodes: new Map(),
      edges: new Map(),
      reverseEdges: new Map()
    };
    this.dependencies.clear();
    this.jobStatuses.clear();
    this.jobResults.clear();

    this.logger.debug('Dependency graph cleared');
  }

  /**
   * Create default logger
   */
  private createDefaultLogger(): Logger {
    return {
      debug: (message: string, ...args: any[]) => {
        if (process.env.DEBUG) {
          console.debug(`[DependencyManager] DEBUG: ${message}`, ...args);
        }
      },
      info: (message: string, ...args: any[]) => {
        console.info(`[DependencyManager] INFO: ${message}`, ...args);
      },
      warn: (message: string, ...args: any[]) => {
        console.warn(`[DependencyManager] WARN: ${message}`, ...args);
      },
      error: (message: string, ...args: any[]) => {
        console.error(`[DependencyManager] ERROR: ${message}`, ...args);
      }
    };
  }
}
