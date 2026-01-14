/**
 * Procedural Memory System
 *
 * Manages procedural knowledge - execution strategies, problem-solving methods,
 * optimization techniques, and refactoring patterns with success rate tracking.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ProceduralMemory,
  MemoryImportance,
  MemoryStatus,
  ProcedureStep,
  MemoryError,
  RetrievalQuery,
  RetrievalResult,
} from '../types';

export interface ProceduralMemoryConfig {
  maxProcedures: number;
  minSuccessRate: number;
  practiceInterval: number;
  autoOptimize: boolean;
  trackExecution: boolean;
}

export interface ProceduralStorage {
  getMemory(id: string): Promise<ProceduralMemory | null>;
  saveMemory(memory: ProceduralMemory): Promise<void>;
  deleteMemory(id: string): Promise<void>;
  searchByName(name: string): Promise<ProceduralMemory[]>;
  getBySuccessRate(minRate: number): Promise<ProceduralMemory[]>;
  getAllMemories(): Promise<ProceduralMemory[]>;
  updateMemory(id: string, updates: Partial<ProceduralMemory>): Promise<void>;
}

export interface ProcedureExecution {
  procedureId: string;
  startTime: Date;
  endTime?: Date;
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
  stepResults: Array<{
    step: number;
    success: boolean;
    duration: number;
    output?: string;
    error?: string;
  }>;
}

export class ProceduralMemorySystem {
  private config: ProceduralMemoryConfig;
  private storage: ProceduralStorage;
  private cache: Map<string, ProceduralMemory>;
  private executionHistory: Map<string, ProcedureExecution[]>;
  private practiceQueue: Set<string>;

  constructor(config: ProceduralMemoryConfig, storage: ProceduralStorage) {
    this.config = config;
    this.storage = storage;
    this.cache = new Map();
    this.executionHistory = new Map();
    this.practiceQueue = new Set();
  }

  /**
   * Create a new procedural memory
   */
  async createMemory(
    name: string,
    description: string,
    steps: ProcedureStep[],
    options: {
      preconditions?: string[];
      postconditions?: string[];
      dependencies?: string[];
      importance?: MemoryImportance;
      tags?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<ProceduralMemory> {
    const now = new Date();

    const memory: ProceduralMemory = {
      id: uuidv4(),
      type: 'procedural' as const,
      importance: options.importance ?? MemoryImportance.MEDIUM,
      status: MemoryStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      lastAccessed: now,
      accessCount: 0,
      name,
      description,
      steps: steps.sort((a, b) => a.order - b.order),
      preconditions: options.preconditions ?? [],
      postconditions: options.postconditions ?? [],
      successRate: 0,
      executionTime: 0,
      dependencies: options.dependencies ?? [],
      tags: options.tags ?? [],
      metadata: options.metadata ?? {},
    };

    await this.storage.saveMemory(memory);
    this.cache.set(memory.id, memory);
    this.executionHistory.set(memory.id, []);

    return memory;
  }

  /**
   * Retrieve a procedure by ID
   */
  async getMemory(id: string): Promise<ProceduralMemory | null> {
    // Check cache first
    if (this.cache.has(id)) {
      const memory = this.cache.get(id)!;
      await this.updateAccessStats(id);
      return memory;
    }

    // Load from storage
    const memory = await this.storage.getMemory(id);
    if (memory) {
      this.cache.set(id, memory);
      await this.updateAccessStats(id);
    }

    return memory;
  }

  /**
   * Execute a procedure
   */
  async executeProcedure(
    id: string,
    context: Record<string, unknown>,
    options: {
      timeout?: number;
      dryRun?: boolean;
      onStepComplete?: (step: number, result: unknown) => void;
    } = {}
  ): Promise<{
    success: boolean;
    output?: string;
    error?: string;
    executionTime: number;
    stepResults: ProcedureExecution['stepResults'];
  }> {
    const procedure = await this.getMemory(id);
    if (!procedure) {
      throw new MemoryError(`Procedure not found: ${id}`, 'NOT_FOUND');
    }

    // Check preconditions
    if (!this.checkPreconditions(procedure, context)) {
      throw new MemoryError(
        'Preconditions not met',
        'PRECONDITION_FAILED',
        { preconditions: procedure.preconditions }
      );
    }

    const startTime = Date.now();
    const stepResults: ProcedureExecution['stepResults'] = [];
    let success = true;
    let finalOutput: string | undefined;
    let finalError: string | undefined;

    // Execute steps
    for (const step of procedure.steps) {
      if (options.dryRun) {
        stepResults.push({
          step: step.order,
          success: true,
          duration: 0,
          output: `Dry run: ${step.description}`,
        });
        continue;
      }

      try {
        const stepStart = Date.now();
        const result = await this.executeStep(step, context);
        const stepDuration = Date.now() - stepStart;

        stepResults.push({
          step: step.order,
          success: true,
          duration: stepDuration,
          output: JSON.stringify(result),
        });

        if (options.onStepComplete) {
          options.onStepComplete(step.order, result);
        }

        // Update context with step result
        context[`step_${step.order}_result`] = result;
      } catch (error) {
        const stepDuration = Date.now() - startTime;
        stepResults.push({
          step: step.order,
          success: false,
          duration: stepDuration,
          error: error instanceof Error ? error.message : String(error),
        });

        success = false;
        finalError = `Step ${step.order} failed: ${error}`;
        break;
      }
    }

    const executionTime = Date.now() - startTime;

    if (success) {
      // Check postconditions
      const postconditionsMet = this.checkPostconditions(procedure, context);
      if (!postconditionsMet) {
        success = false;
        finalError = 'Postconditions not met';
      } else {
        finalOutput = `Procedure ${procedure.name} completed successfully`;
      }
    }

    // Record execution
    const execution: ProcedureExecution = {
      procedureId: id,
      startTime: new Date(startTime),
      endTime: new Date(),
      success,
      output: finalOutput,
      error: finalError,
      executionTime,
      stepResults,
    };

    await this.recordExecution(id, execution);

    // Update procedure statistics
    await this.updateProcedureStats(id);

    return {
      success,
      output: finalOutput,
      error: finalError,
      executionTime,
      stepResults,
    };
  }

  /**
   * Search procedures by name
   */
  async searchByName(query: string): Promise<ProceduralMemory[]> {
    const procedures = await this.storage.searchByName(query);

    // Update access stats
    for (const procedure of procedures) {
      await this.updateAccessStats(procedure.id);
    }

    return procedures;
  }

  /**
   * Get procedures by success rate
   */
  async getBySuccessRate(minRate: number): Promise<ProceduralMemory[]> {
    return this.storage.getBySuccessRate(minRate);
  }

  /**
   * Get best performing procedures
   */
  async getBestProcedures(limit: number = 10): Promise<ProceduralMemory[]> {
    const allProcedures = await this.storage.getAllMemories();

    return allProcedures
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, limit);
  }

  /**
   * Find procedures for a given task
   */
  async findProceduresForTask(
    task: string,
    context: Record<string, unknown>
  ): Promise<Array<{ procedure: ProceduralMemory; matchScore: number }>> {
    const allProcedures = await this.storage.getAllMemories();

    const matches: Array<{ procedure: ProceduralMemory; matchScore: number }> = [];

    for (const procedure of allProcedures) {
      const matchScore = this.calculateMatchScore(procedure, task, context);
      if (matchScore > 0.3) {
        matches.push({ procedure, matchScore });
      }
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Optimize a procedure based on execution history
   */
  async optimizeProcedure(id: string): Promise<void> {
    const procedure = await this.getMemory(id);
    if (!procedure) {
      throw new MemoryError(`Procedure not found: ${id}`, 'NOT_FOUND');
    }

    const executions = this.executionHistory.get(id) ?? [];
    if (executions.length < 3) {
      return; // Not enough data to optimize
    }

    // Analyze execution patterns
    const stepAnalysis = this.analyzeSteps(executions);

    // Identify slow or failing steps
    const stepsToOptimize = procedure.steps.filter((step) => {
      const analysis = stepAnalysis.get(step.order);
      if (!analysis) return false;

      return analysis.avgDuration > 5000 || analysis.failureRate > 0.2;
    });

    if (stepsToOptimize.length === 0) {
      return; // No optimization needed
    }

    // Generate optimized steps
    const optimizedSteps = await this.generateOptimizedSteps(
      stepsToOptimize,
      stepAnalysis
    );

    // Update procedure
    const updatedSteps = procedure.steps.map((step) => {
      const optimized = optimizedSteps.find((s) => s.order === step.order);
      return optimized ?? step;
    });

    await this.storage.updateMemory(id, { steps: updatedSteps });
    this.cache.set(id, { ...procedure, steps: updatedSteps });
  }

  /**
   * Practice procedures to improve performance
   */
  async practiceProcedures(): Promise<number> {
    const now = Date.now();
    let practiced = 0;

    for (const id of this.practiceQueue) {
      const procedure = await this.getMemory(id);
      if (!procedure) continue;

      const lastAccessed = procedure.lastAccessed.getTime();
      const daysSinceLastAccess = (now - lastAccessed) / (1000 * 60 * 60 * 24);

      if (daysSinceLastAccess >= this.config.practiceInterval) {
        // Execute in dry-run mode
        await this.executeProcedure(id, {}, { dryRun: true });
        practiced++;
      }
    }

    return practiced;
  }

  /**
   * Update an existing procedure
   */
  async updateMemory(
    id: string,
    updates: Partial<Omit<ProceduralMemory, 'id' | 'type' | 'createdAt'>>
  ): Promise<void> {
    const procedure = await this.getMemory(id);
    if (!procedure) {
      throw new MemoryError(`Procedure not found: ${id}`, 'NOT_FOUND');
    }

    const updatedProcedure: ProceduralMemory = {
      ...procedure,
      ...updates,
      updatedAt: new Date(),
    };

    // Sort steps by order
    if (updatedProcedure.steps) {
      updatedProcedure.steps = updatedProcedure.steps.sort((a, b) => a.order - b.order);
    }

    await this.storage.updateMemory(id, updatedProcedure);
    this.cache.set(id, updatedProcedure);
  }

  /**
   * Delete a procedure
   */
  async deleteMemory(id: string): Promise<void> {
    await this.storage.deleteMemory(id);
    this.cache.delete(id);
    this.executionHistory.delete(id);
    this.practiceQueue.delete(id);
  }

  /**
   * Get execution statistics for a procedure
   */
  async getExecutionStats(id: string): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    avgExecutionTime: number;
    successRate: number;
    lastExecution?: Date;
  } | null> {
    const executions = this.executionHistory.get(id);
    if (!executions || executions.length === 0) {
      return null;
    }

    const successful = executions.filter((e) => e.success).length;
    const failed = executions.length - successful;
    const avgTime =
      executions.reduce((sum, e) => sum + e.executionTime, 0) / executions.length;

    return {
      totalExecutions: executions.length,
      successfulExecutions: successful,
      failedExecutions: failed,
      avgExecutionTime: avgTime,
      successRate: successful / executions.length,
      lastExecution: executions[executions.length - 1].startTime,
    };
  }

  /**
   * Get procedures that need practice
   */
  async getProceduresNeedingPractice(): Promise<ProceduralMemory[]> {
    const now = Date.now();
    const needingPractice: ProceduralMemory[] = [];

    for (const [id, procedure] of this.cache.entries()) {
      const lastAccessed = procedure.lastAccessed.getTime();
      const daysSinceLastAccess = (now - lastAccessed) / (1000 * 60 * 60 * 24);

      if (daysSinceLastAccess >= this.config.practiceInterval) {
        needingPractice.push(procedure);
      }
    }

    return needingPractice;
  }

  /**
   * Check if preconditions are met
   */
  private checkPreconditions(
    procedure: ProceduralMemory,
    context: Record<string, unknown>
  ): boolean {
    if (procedure.preconditions.length === 0) return true;

    for (const condition of procedure.preconditions) {
      // Simple condition checking
      // In production, implement more sophisticated condition evaluation
      if (condition.includes('exists') && !context[condition.split(':')[1]]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if postconditions are met
   */
  private checkPostconditions(
    procedure: ProceduralMemory,
    context: Record<string, unknown>
  ): boolean {
    if (procedure.postconditions.length === 0) return true;

    for (const condition of procedure.postconditions) {
      // Simple condition checking
      if (condition.includes('exists') && !context[condition.split(':')[1]]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: ProcedureStep,
    context: Record<string, unknown>
  ): Promise<unknown> {
    // This is a placeholder for actual step execution
    // In production, implement actual execution logic based on step type

    // Simulate execution time
    const executionTime = Math.random() * 1000 + 100;
    await new Promise((resolve) => setTimeout(resolve, executionTime));

    // Simulate occasional failure
    if (Math.random() < 0.1) {
      throw new Error(`Step execution failed: ${step.description}`);
    }

    return { success: true, output: `Executed: ${step.description}` };
  }

  /**
   * Record procedure execution
   */
  private async recordExecution(
    id: string,
    execution: ProcedureExecution
  ): Promise<void> {
    const executions = this.executionHistory.get(id) ?? [];
    executions.push(execution);

    // Keep only last 100 executions
    if (executions.length > 100) {
      executions.shift();
    }

    this.executionHistory.set(id, executions);
  }

  /**
   * Update procedure statistics based on execution history
   */
  private async updateProcedureStats(id: string): Promise<void> {
    const executions = this.executionHistory.get(id);
    if (!executions || executions.length === 0) return;

    const successful = executions.filter((e) => e.success).length;
    const successRate = successful / executions.length;
    const avgTime =
      executions.reduce((sum, e) => sum + e.executionTime, 0) / executions.length;

    await this.storage.updateMemory(id, {
      successRate,
      executionTime: avgTime,
    });
  }

  /**
   * Calculate match score for procedure selection
   */
  private calculateMatchScore(
    procedure: ProceduralMemory,
    task: string,
    context: Record<string, unknown>
  ): number {
    let score = 0;

    // Check name similarity
    const taskLower = task.toLowerCase();
    const nameLower = procedure.name.toLowerCase();
    if (nameLower.includes(taskLower) || taskLower.includes(nameLower)) {
      score += 0.5;
    }

    // Check description similarity
    const descLower = procedure.description.toLowerCase();
    if (descLower.includes(taskLower) || taskLower.includes(descLower)) {
      score += 0.3;
    }

    // Check success rate
    score += procedure.successRate * 0.2;

    return Math.min(score, 1);
  }

  /**
   * Analyze step performance
   */
  private analyzeSteps(
    executions: ProcedureExecution[]
  ): Map<number, { avgDuration: number; failureRate: number; count: number }> {
    const analysis = new Map<
      number,
      { avgDuration: number; failureRate: number; count: number }
    >();

    for (const execution of executions) {
      for (const stepResult of execution.stepResults) {
        const existing = analysis.get(stepResult.step);
        const duration = stepResult.duration;
        const failed = !stepResult.success;

        if (existing) {
          existing.count++;
          existing.avgDuration =
            (existing.avgDuration * (existing.count - 1) + duration) / existing.count;
          existing.failureRate =
            (existing.failureRate * (existing.count - 1) + (failed ? 1 : 0)) / existing.count;
        } else {
          analysis.set(stepResult.step, {
            avgDuration: duration,
            failureRate: failed ? 1 : 0,
            count: 1,
          });
        }
      }
    }

    return analysis;
  }

  /**
   * Generate optimized steps
   */
  private async generateOptimizedSteps(
    stepsToOptimize: ProcedureStep[],
    analysis: Map<number, { avgDuration: number; failureRate: number; count: number }>
  ): Promise<ProcedureStep[]> {
    // This is a placeholder for actual optimization logic
    // In production, use ML models or expert systems to generate optimizations

    return stepsToOptimize.map((step) => {
      const stepAnalysis = analysis.get(step.order);
      if (!stepAnalysis) return step;

      // Increase timeout for slow steps
      if (stepAnalysis.avgDuration > 5000) {
        return {
          ...step,
          timeout: step.timeout * 2,
        };
      }

      return step;
    });
  }

  /**
   * Update access statistics
   */
  private async updateAccessStats(id: string): Promise<void> {
    const procedure = await this.storage.getMemory(id);
    if (!procedure) return;

    await this.storage.updateMemory(id, {
      lastAccessed: new Date(),
      accessCount: procedure.accessCount + 1,
    });
  }

  /**
   * Get overall statistics
   */
  async getStats(): Promise<{
    totalProcedures: number;
    avgSuccessRate: number;
    highSuccessRateCount: number;
    lowSuccessRateCount: number;
    totalExecutions: number;
  }> {
    const allProcedures = await this.storage.getAllMemories();

    let totalSuccessRate = 0;
    let highSuccessRate = 0;
    let lowSuccessRate = 0;
    let totalExecutions = 0;

    for (const procedure of allProcedures) {
      totalSuccessRate += procedure.successRate;
      if (procedure.successRate >= 0.8) highSuccessRate++;
      else if (procedure.successRate < 0.5) lowSuccessRate++;

      const executions = this.executionHistory.get(procedure.id)?.length ?? 0;
      totalExecutions += executions;
    }

    return {
      totalProcedures: allProcedures.length,
      avgSuccessRate:
        allProcedures.length > 0 ? totalSuccessRate / allProcedures.length : 0,
      highSuccessRateCount: highSuccessRate,
      lowSuccessRateCount: lowSuccessRate,
      totalExecutions,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * D1-based storage for procedural memories
 */
export class D1ProceduralStorage implements ProceduralStorage {
  constructor(private db: D1Database) {
    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    await this.db.batch([
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS procedural_memories (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          importance INTEGER NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_accessed TEXT NOT NULL,
          access_count INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          steps TEXT NOT NULL,
          preconditions TEXT NOT NULL,
          postconditions TEXT NOT NULL,
          success_rate REAL NOT NULL,
          execution_time REAL NOT NULL,
          dependencies TEXT NOT NULL,
          tags TEXT NOT NULL,
          metadata TEXT NOT NULL
        )
      `),
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_procedural_name
        ON procedural_memories(name)
      `),
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_procedural_success_rate
        ON procedural_memories(success_rate)
      `),
    ]);
  }

  async getMemory(id: string): Promise<ProceduralMemory | null> {
    const result = await this.db
      .prepare('SELECT * FROM procedural_memories WHERE id = ?')
      .bind(id)
      .first();

    if (!result) return null;

    return this.deserialize(result);
  }

  async saveMemory(memory: ProceduralMemory): Promise<void> {
    await this.db
      .prepare(`
        INSERT OR REPLACE INTO procedural_memories
        (id, type, importance, status, created_at, updated_at, last_accessed,
         access_count, name, description, steps, preconditions, postconditions,
         success_rate, execution_time, dependencies, tags, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        memory.id,
        memory.type,
        memory.importance,
        memory.status,
        memory.createdAt.toISOString(),
        memory.updatedAt.toISOString(),
        memory.lastAccessed.toISOString(),
        memory.accessCount,
        memory.name,
        memory.description,
        JSON.stringify(memory.steps),
        JSON.stringify(memory.preconditions),
        JSON.stringify(memory.postconditions),
        memory.successRate,
        memory.executionTime,
        JSON.stringify(memory.dependencies),
        JSON.stringify(memory.tags),
        JSON.stringify(memory.metadata)
      )
      .run();
  }

  async deleteMemory(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM procedural_memories WHERE id = ?')
      .bind(id)
      .run();
  }

  async searchByName(name: string): Promise<ProceduralMemory[]> {
    const results = await this.db
      .prepare('SELECT * FROM procedural_memories WHERE name LIKE ?')
      .bind(`%${name}%`)
      .all();

    return results.results.map((r) => this.deserialize(r));
  }

  async getBySuccessRate(minRate: number): Promise<ProceduralMemory[]> {
    const results = await this.db
      .prepare('SELECT * FROM procedural_memories WHERE success_rate >= ?')
      .bind(minRate)
      .all();

    return results.results.map((r) => this.deserialize(r));
  }

  async getAllMemories(): Promise<ProceduralMemory[]> {
    const results = await this.db
      .prepare('SELECT * FROM procedural_memories')
      .all();

    return results.results.map((r) => this.deserialize(r));
  }

  async updateMemory(
    id: string,
    updates: Partial<ProceduralMemory>
  ): Promise<void> {
    const current = await this.getMemory(id);
    if (!current) {
      throw new MemoryError(`Procedure not found: ${id}`, 'NOT_FOUND');
    }

    const updated = { ...current, ...updates };
    await this.saveMemory(updated);
  }

  private deserialize(data: any): ProceduralMemory {
    return {
      id: data.id,
      type: data.type,
      importance: data.importance,
      status: data.status,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      lastAccessed: new Date(data.last_accessed),
      accessCount: data.access_count,
      name: data.name,
      description: data.description,
      steps: JSON.parse(data.steps),
      preconditions: JSON.parse(data.preconditions),
      postconditions: JSON.parse(data.postconditions),
      successRate: data.success_rate,
      executionTime: data.execution_time,
      dependencies: JSON.parse(data.dependencies),
      tags: JSON.parse(data.tags),
      metadata: JSON.parse(data.metadata),
    } as ProceduralMemory;
  }
}
