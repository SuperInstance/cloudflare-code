/**
 * Learning and Experience Replay System
 *
 * Implements reinforcement learning, experience replay, and meta-learning
 * to improve decision-making based on past experiences.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  LearningExperience,
  LearningPattern,
  LearningStrategy,
  PerformanceMetrics,
  MemoryType,
  MemoryError,
} from '../types';

export interface LearningConfig {
  enabled: boolean;
  algorithm: 'q-learning' | 'policy-gradient' | 'actor-critic' | 'meta-learning';
  learningRate: number;
  explorationRate: number;
  discountFactor: number;
  replayBufferSize: number;
  batchSize: number;
  targetUpdateFrequency: number;
}

export interface ExperienceStorage {
  saveExperience(experience: LearningExperience): Promise<void>;
  getExperiences(limit?: number): Promise<LearningExperience[]>;
  getExperiencesByState(state: Record<string, unknown>): Promise<LearningExperience[]>;
  deleteExperience(id: string): Promise<void>;
  clearExperiences(): Promise<void>;
}

export interface PatternStorage {
  savePattern(pattern: LearningPattern): Promise<void>;
  getPatterns(): Promise<LearningPattern[]>;
  getPatternById(id: string): Promise<LearningPattern | null>;
  updatePattern(id: string, updates: Partial<LearningPattern>): Promise<void>;
  deletePattern(id: string): Promise<void>;
}

export class ExperienceReplaySystem {
  private config: LearningConfig;
  private storage: ExperienceStorage;
  private patternStorage: PatternStorage;
  private replayBuffer: LearningExperience[];
  private qTable: Map<string, Map<string, number>>;
  private patterns: Map<string, LearningPattern>;
  private performance: Map<string, PerformanceMetrics>;

  constructor(
    config: LearningConfig,
    storage: ExperienceStorage,
    patternStorage: PatternStorage
  ) {
    this.config = config;
    this.storage = storage;
    this.patternStorage = patternStorage;
    this.replayBuffer = [];
    this.qTable = new Map();
    this.patterns = new Map();
    this.performance = new Map();

    this.initialize();
  }

  /**
   * Initialize the learning system
   */
  private async initialize(): Promise<void> {
    // Load existing experiences
    const experiences = await this.storage.getExperiences(this.config.replayBufferSize);
    this.replayBuffer = experiences;

    // Load existing patterns
    const savedPatterns = await this.patternStorage.getPatterns();
    for (const pattern of savedPatterns) {
      this.patterns.set(pattern.id, pattern);
    }
  }

  /**
   * Record a new experience
   */
  async recordExperience(
    context: string,
    action: string,
    outcome: string,
    reward: number,
    state: Record<string, unknown>,
    nextState: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const experience: LearningExperience = {
      id: uuidv4(),
      timestamp: new Date(),
      context,
      action,
      outcome,
      reward,
      state,
      nextState,
      metadata: metadata ?? {},
    };

    await this.storage.saveExperience(experience);
    this.addToReplayBuffer(experience);

    // Update Q-value if using Q-learning
    if (this.config.algorithm === 'q-learning') {
      await this.updateQValue(experience);
    }

    // Detect and update patterns
    await this.detectPatterns(experience);

    return experience.id;
  }

  /**
   * Select action using epsilon-greedy policy
   */
  async selectAction(
    state: Record<string, unknown>,
    availableActions: string[]
  ): Promise<{ action: string; exploration: boolean }> {
    // Exploration vs exploitation
    if (Math.random() < this.config.explorationRate) {
      // Explore: random action
      const action = availableActions[Math.floor(Math.random() * availableActions.length)];
      return { action, exploration: true };
    }

    // Exploit: best action according to Q-values
    const stateKey = this.getStateKey(state);
    const actionValues = this.qTable.get(stateKey);

    if (!actionValues || actionValues.size === 0) {
      // No Q-values yet, random action
      const action = availableActions[Math.floor(Math.random() * availableActions.length)];
      return { action, exploration: true };
    }

    // Find best action
    let bestAction = availableActions[0];
    let bestValue = -Infinity;

    for (const action of availableActions) {
      const value = actionValues.get(action) ?? 0;
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }

    return { action: bestAction, exploration: false };
  }

  /**
   * Perform experience replay training
   */
  async train(numSteps: number = 100): Promise<TrainingResult> {
    if (this.replayBuffer.length < this.config.batchSize) {
      throw new MemoryError(
        'Insufficient experiences for training',
        'INSUFFICIENT_DATA',
        { bufferSize: this.replayBuffer.length, minRequired: this.config.batchSize }
      );
    }

    let totalLoss = 0;
    let updates = 0;

    for (let step = 0; step < numSteps; step++) {
      // Sample batch from replay buffer
      const batch = this.sampleBatch(this.config.batchSize);

      // Train on batch
      const batchLoss = await this.trainOnBatch(batch);
      totalLoss += batchLoss;
      updates++;
    }

    return {
      steps: numSteps,
      avgLoss: totalLoss / updates,
      totalUpdates: updates,
      timestamp: new Date(),
    };
  }

  /**
   * Learn from patterns
   */
  async learnFromPatterns(): Promise<PatternLearningResult> {
    const patterns = Array.from(this.patterns.values());
    let learned = 0;
    let improved = 0;

    for (const pattern of patterns) {
      // Pattern-based learning
      if (pattern.successRate > 0.8 && pattern.frequency > 10) {
        // Strengthen Q-values for this pattern
        for (const example of pattern.examples) {
          await this.updateQValue(example, 0.1);
        }
        learned++;
      }

      // Improve pattern based on new experiences
      const improvedPattern = await this.improvePattern(pattern);
      if (improvedPattern) {
        improved++;
      }
    }

    return {
      patternsLearned: learned,
      patternsImproved: improved,
      totalPatterns: patterns.length,
      timestamp: new Date(),
    };
  }

  /**
   * Meta-learning: Learn to learn
   */
  async metaLearn(
    tasks: Array<{
      name: string;
      experiences: LearningExperience[];
    }>
  ): Promise<MetaLearningResult> {
    const metaPatterns: Map<string, number> = new Map();
    let adaptations = 0;

    // Analyze patterns across tasks
    for (const task of tasks) {
      for (const exp of task.experiences) {
        const patternKey = this.getPatternKey(exp);
        const count = metaPatterns.get(patternKey) ?? 0;
        metaPatterns.set(patternKey, count + 1);
      }
    }

    // Identify common patterns
    for (const [pattern, count] of metaPatterns.entries()) {
      if (count > tasks.length / 2) {
        // Common across tasks - use for faster adaptation
        adaptations++;
      }
    }

    return {
      commonPatternsFound: metaPatterns.size,
      adaptationsMade: adaptations,
      tasksAnalyzed: tasks.length,
      timestamp: new Date(),
    };
  }

  /**
   * Get learning progress
   */
  async getProgress(strategy?: string): Promise<LearningProgress> {
    const totalExperiences = this.replayBuffer.length;
    const totalPatterns = this.patterns.size;

    let avgReward = 0;
    let successRate = 0;

    if (totalExperiences > 0) {
      avgReward =
        this.replayBuffer.reduce((sum, exp) => sum + exp.reward, 0) / totalExperiences;
      successRate =
        this.replayBuffer.filter((exp) => exp.reward > 0).length / totalExperiences;
    }

    return {
      totalExperiences,
      totalPatterns,
      avgReward,
      successRate,
      explorationRate: this.config.explorationRate,
      learningRate: this.config.learningRate,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get performance metrics
   */
  async getPerformance(strategyName: string): Promise<PerformanceMetrics | null> {
    return this.performance.get(strategyName) ?? null;
  }

  /**
   * Update performance metrics
   */
  async updatePerformance(
    strategyName: string,
    success: boolean,
    reward: number
  ): Promise<void> {
    const existing = this.performance.get(strategyName);
    const now = new Date();

    if (existing) {
      existing.totalTrials++;
      existing.successRate =
        (existing.successRate * (existing.totalTrials - 1) + (success ? 1 : 0)) /
        existing.totalTrials;
      existing.avgReward =
        (existing.avgReward * (existing.totalTrials - 1) + reward) / existing.totalTrials;
      existing.lastUpdated = now;

      // Calculate improvement rate
      if (existing.totalTrials > 10) {
        const recentTrials = Math.min(100, existing.totalTrials);
        const improvement = (existing.successRate - 0.5) * 2; // Normalize to -1 to 1
        existing.improvementRate = improvement / recentTrials;
      }

      this.performance.set(strategyName, existing);
    } else {
      this.performance.set(strategyName, {
        totalTrials: 1,
        successRate: success ? 1 : 0,
        avgReward: reward,
        improvementRate: 0,
        convergenceRate: 0,
        lastUpdated: now,
      });
    }
  }

  /**
   * Decay exploration rate over time
   */
  decayExploration(rate: number = 0.995): void {
    this.config.explorationRate = Math.max(0.01, this.config.explorationRate * rate);
  }

  /**
   * Decay learning rate over time
   */
  decayLearningRate(rate: number = 0.995): void {
    this.config.learningRate = Math.max(0.001, this.config.learningRate * rate);
  }

  /**
   * Clear replay buffer
   */
  async clearReplayBuffer(): Promise<void> {
    this.replayBuffer = [];
    await this.storage.clearExperiences();
  }

  /**
   * Add experience to replay buffer
   */
  private addToReplayBuffer(experience: LearningExperience): void {
    this.replayBuffer.push(experience);

    // Maintain buffer size
    if (this.replayBuffer.length > this.config.replayBufferSize) {
      this.replayBuffer.shift();
    }
  }

  /**
   * Sample random batch from replay buffer
   */
  private sampleBatch(batchSize: number): LearningExperience[] {
    const batch: LearningExperience[] = [];
    const indices = new Set<number>();

    while (indices.size < batchSize && indices.size < this.replayBuffer.length) {
      const index = Math.floor(Math.random() * this.replayBuffer.length);
      indices.add(index);
    }

    for (const index of indices) {
      batch.push(this.replayBuffer[index]);
    }

    return batch;
  }

  /**
   * Train on a batch of experiences
   */
  private async trainOnBatch(batch: LearningExperience[]): Promise<number> {
    let totalLoss = 0;

    for (const experience of batch) {
      const loss = await this.updateQValue(experience);
      totalLoss += Math.abs(loss);
    }

    return totalLoss / batch.length;
  }

  /**
   * Update Q-value for a state-action pair
   */
  private async updateQValue(
    experience: LearningExperience,
    learningRate?: number
  ): Promise<number> {
    const stateKey = this.getStateKey(experience.state);
    const nextKey = this.getStateKey(experience.nextState);
    const lr = learningRate ?? this.config.learningRate;

    // Get current Q-value
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Map());
    }
    const stateActions = this.qTable.get(stateKey)!;
    const currentQ = stateActions.get(experience.action) ?? 0;

    // Calculate max Q-value for next state
    let maxNextQ = 0;
    if (this.qTable.has(nextKey)) {
      const nextActions = this.qTable.get(nextKey)!;
      for (const q of nextActions.values()) {
        maxNextQ = Math.max(maxNextQ, q);
      }
    }

    // Q-learning update
    const newQ =
      currentQ +
      lr * (experience.reward + this.config.discountFactor * maxNextQ - currentQ);

    stateActions.set(experience.action, newQ);

    return newQ - currentQ;
  }

  /**
   * Detect patterns in experiences
   */
  private async detectPatterns(experience: LearningExperience): Promise<void> {
    const patternKey = this.getPatternKey(experience);

    if (this.patterns.has(patternKey)) {
      // Update existing pattern
      const pattern = this.patterns.get(patternKey)!;
      pattern.frequency++;
      pattern.examples.push(experience);
      pattern.lastSeen = experience.timestamp;

      // Update success rate
      const positiveRewards = pattern.examples.filter((e) => e.reward > 0).length;
      pattern.successRate = positiveRewards / pattern.examples.length;

      // Update average reward
      pattern.avgReward =
        (pattern.avgReward * (pattern.frequency - 1) + experience.reward) /
        pattern.frequency;

      await this.patternStorage.updatePattern(pattern.id, pattern);
    } else {
      // Create new pattern
      const newPattern: LearningPattern = {
        id: uuidv4(),
        pattern: patternKey,
        category: experience.context,
        frequency: 1,
        successRate: experience.reward > 0 ? 1 : 0,
        avgReward: experience.reward,
        lastSeen: experience.timestamp,
        examples: [experience],
      };

      this.patterns.set(patternKey, newPattern);
      await this.patternStorage.savePattern(newPattern);
    }
  }

  /**
   * Improve pattern based on new data
   */
  private async improvePattern(pattern: LearningPattern): Promise<boolean> {
    if (pattern.examples.length < 10) return false;

    // Calculate pattern stability
    const recentExamples = pattern.examples.slice(-20);
    const recentSuccessRate =
      recentExamples.filter((e) => e.reward > 0).length / recentExamples.length;

    // If recent performance is better, update pattern
    if (recentSuccessRate > pattern.successRate + 0.1) {
      pattern.successRate = recentSuccessRate;
      await this.patternStorage.updatePattern(pattern.id, pattern);
      return true;
    }

    return false;
  }

  /**
   * Get state key for Q-table
   */
  private getStateKey(state: Record<string, unknown>): string {
    // Simplified state representation
    const keys = Object.keys(state).sort();
    const values = keys.map((k) => state[k]);
    return JSON.stringify(values);
  }

  /**
   * Get pattern key for experience
   */
  private getPatternKey(experience: LearningExperience): string {
    return `${experience.context}:${experience.action}`;
  }

  /**
   * Export Q-table
   */
  exportQTable(): Record<string, Record<string, number>> {
    const exported: Record<string, Record<string, number>> = {};

    for (const [state, actions] of this.qTable.entries()) {
      exported[state] = Object.fromEntries(actions);
    }

    return exported;
  }

  /**
   * Import Q-table
   */
  importQTable(qTable: Record<string, Record<string, number>>): void {
    for (const [state, actions] of Object.entries(qTable)) {
      const actionMap = new Map(Object.entries(actions));
      this.qTable.set(state, actionMap);
    }
  }

  /**
   * Get learning statistics
   */
  getStats(): LearningStats {
    const totalExperiences = this.replayBuffer.length;
    const totalStates = this.qTable.size;
    const totalPatterns = this.patterns.size;

    let avgQValue = 0;
    let totalQValues = 0;

    for (const actions of this.qTable.values()) {
      for (const q of actions.values()) {
        avgQValue += q;
        totalQValues++;
      }
    }

    avgQValue = totalQValues > 0 ? avgQValue / totalQValues : 0;

    return {
      totalExperiences,
      totalStates,
      totalActions: totalQValues,
      totalPatterns,
      avgQValue,
      explorationRate: this.config.explorationRate,
      learningRate: this.config.learningRate,
    };
  }
}

/**
 * Training result interface
 */
export interface TrainingResult {
  steps: number;
  avgLoss: number;
  totalUpdates: number;
  timestamp: Date;
}

/**
 * Pattern learning result interface
 */
export interface PatternLearningResult {
  patternsLearned: number;
  patternsImproved: number;
  totalPatterns: number;
  timestamp: Date;
}

/**
 * Meta-learning result interface
 */
export interface MetaLearningResult {
  commonPatternsFound: number;
  adaptationsMade: number;
  tasksAnalyzed: number;
  timestamp: Date;
}

/**
 * Learning progress interface
 */
export interface LearningProgress {
  totalExperiences: number;
  totalPatterns: number;
  avgReward: number;
  successRate: number;
  explorationRate: number;
  learningRate: number;
  lastUpdated: Date;
}

/**
 * Learning statistics interface
 */
export interface LearningStats {
  totalExperiences: number;
  totalStates: number;
  totalActions: number;
  totalPatterns: number;
  avgQValue: number;
  explorationRate: number;
  learningRate: number;
}

/**
 * D1-based storage for learning experiences
 */
export class D1ExperienceStorage implements ExperienceStorage {
  constructor(private db: D1Database) {
    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    await this.db.batch([
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS learning_experiences (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          context TEXT NOT NULL,
          action TEXT NOT NULL,
          outcome TEXT NOT NULL,
          reward REAL NOT NULL,
          state TEXT NOT NULL,
          next_state TEXT NOT NULL,
          metadata TEXT NOT NULL
        )
      `),
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_experiences_context
        ON learning_experiences(context)
      `),
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_experiences_timestamp
        ON learning_experiences(timestamp)
      `),
    ]);
  }

  async saveExperience(experience: LearningExperience): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO learning_experiences
        (id, timestamp, context, action, outcome, reward, state, next_state, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        experience.id,
        experience.timestamp.toISOString(),
        experience.context,
        experience.action,
        experience.outcome,
        experience.reward,
        JSON.stringify(experience.state),
        JSON.stringify(experience.nextState),
        JSON.stringify(experience.metadata)
      )
      .run();
  }

  async getExperiences(limit?: number): Promise<LearningExperience[]> {
    let sql = 'SELECT * FROM learning_experiences ORDER BY timestamp DESC';
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    const results = await this.db.prepare(sql).all();
    return results.results.map((r) => this.deserialize(r));
  }

  async getExperiencesByState(
    state: Record<string, unknown>
  ): Promise<LearningExperience[]> {
    const stateStr = JSON.stringify(state);
    const results = await this.db
      .prepare('SELECT * FROM learning_experiences WHERE state = ?')
      .bind(stateStr)
      .all();

    return results.results.map((r) => this.deserialize(r));
  }

  async deleteExperience(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM learning_experiences WHERE id = ?')
      .bind(id)
      .run();
  }

  async clearExperiences(): Promise<void> {
    await this.db.prepare('DELETE FROM learning_experiences').run();
  }

  private deserialize(data: any): LearningExperience {
    return {
      id: data.id,
      timestamp: new Date(data.timestamp),
      context: data.context,
      action: data.action,
      outcome: data.outcome,
      reward: data.reward,
      state: JSON.parse(data.state),
      nextState: JSON.parse(data.next_state),
      metadata: JSON.parse(data.metadata),
    } as LearningExperience;
  }
}

/**
 * D1-based storage for learning patterns
 */
export class D1PatternStorage implements PatternStorage {
  constructor(private db: D1Database) {
    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    await this.db.batch([
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS learning_patterns (
          id TEXT PRIMARY KEY,
          pattern TEXT NOT NULL,
          category TEXT NOT NULL,
          frequency INTEGER NOT NULL,
          success_rate REAL NOT NULL,
          avg_reward REAL NOT NULL,
          last_seen TEXT NOT NULL,
          examples TEXT NOT NULL
        )
      `),
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_patterns_category
        ON learning_patterns(category)
      `),
    ]);
  }

  async savePattern(pattern: LearningPattern): Promise<void> {
    await this.db
      .prepare(`
        INSERT OR REPLACE INTO learning_patterns
        (id, pattern, category, frequency, success_rate, avg_reward, last_seen, examples)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        pattern.id,
        pattern.pattern,
        pattern.category,
        pattern.frequency,
        pattern.successRate,
        pattern.avgReward,
        pattern.lastSeen.toISOString(),
        JSON.stringify(pattern.examples)
      )
      .run();
  }

  async getPatterns(): Promise<LearningPattern[]> {
    const results = await this.db
      .prepare('SELECT * FROM learning_patterns')
      .all();

    return results.results.map((r) => this.deserialize(r));
  }

  async getPatternById(id: string): Promise<LearningPattern | null> {
    const result = await this.db
      .prepare('SELECT * FROM learning_patterns WHERE id = ?')
      .bind(id)
      .first();

    if (!result) return null;

    return this.deserialize(result);
  }

  async updatePattern(
    id: string,
    updates: Partial<LearningPattern>
  ): Promise<void> {
    const current = await this.getPatternById(id);
    if (!current) {
      throw new MemoryError(`Pattern not found: ${id}`, 'NOT_FOUND');
    }

    const updated = { ...current, ...updates };
    await this.savePattern(updated);
  }

  async deletePattern(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM learning_patterns WHERE id = ?')
      .bind(id)
      .run();
  }

  private deserialize(data: any): LearningPattern {
    return {
      id: data.id,
      pattern: data.pattern,
      category: data.category,
      frequency: data.frequency,
      successRate: data.success_rate,
      avgReward: data.avg_reward,
      lastSeen: new Date(data.last_seen),
      examples: JSON.parse(data.examples),
    } as LearningPattern;
  }
}
