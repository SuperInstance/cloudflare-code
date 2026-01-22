/**
 * Curriculum Learning Framework
 * Progressively increases task difficulty during training
 */

import { Env, StepResult } from '../envs/base.js';

export interface CurriculumStage {
  name: string;
  difficulty: number;
  envConfig: Record<string, any>;
  evaluationThreshold: number;
  maxEpisodes: number;
}

export interface CurriculumProgress {
  currentStage: number;
  completedStages: string[];
  totalEpisodes: number;
  stagePerformance: Map<string, number>;
}

/**
 * Curriculum Learning Manager
 */
export class CurriculumLearning {
  private stages: CurriculumStage[] = [];
  private currentStage: number = 0;
  private stagePerformance: Map<string, number> = new Map();
  private totalEpisodes: number = 0;
  private stageEpisodeCount: number = 0;

  addStage(stage: CurriculumStage): void {
    this.stages.push(stage);
  }

  getCurrentStage(): CurriculumStage | null {
    if (this.currentStage >= this.stages.length) {
      return null;
    }
    return this.stages[this.currentStage];
  }

  getCurrentDifficulty(): number {
    const stage = this.getCurrentStage();
    return stage?.difficulty ?? 1.0;
  }

  updatePerformance(performance: number): boolean {
    const stage = this.getCurrentStage();
    if (!stage) {
      return false;
    }

    this.stagePerformance.set(stage.name, performance);
    this.stageEpisodeCount++;
    this.totalEpisodes++;

    // Check if we should advance to next stage
    if (this.shouldAdvanceStage(performance, stage)) {
      return this.advanceStage();
    }

    return false;
  }

  private shouldAdvanceStage(performance: number, stage: CurriculumStage): boolean {
    // Advance if performance exceeds threshold
    if (performance >= stage.evaluationThreshold) {
      return true;
    }

    // Advance if we've exceeded max episodes for this stage
    if (this.stageEpisodeCount >= stage.maxEpisodes) {
      return true;
    }

    return false;
  }

  private advanceStage(): boolean {
    const currentStage = this.getCurrentStage();
    if (currentStage) {
      console.log(`\n=== Advancing from stage: ${currentStage.name} ===`);
    }

    this.currentStage++;
    this.stageEpisodeCount = 0;

    const nextStage = this.getCurrentStage();
    if (nextStage) {
      console.log(`=== To stage: ${nextStage.name} ===\n`);
      console.log(`Difficulty: ${nextStage.difficulty}`);
      console.log(`Evaluation Threshold: ${nextStage.evaluationThreshold}\n`);
      return true;
    }

    console.log('\n=== Curriculum completed! ===\n');
    return false;
  }

  getProgress(): CurriculumProgress {
    return {
      currentStage: this.currentStage,
      completedStages: Array.from(this.stagePerformance.keys()),
      totalEpisodes: this.totalEpisodes,
      stagePerformance: new Map(this.stagePerformance),
    };
  }

  reset(): void {
    this.currentStage = 0;
    this.stagePerformance.clear();
    this.totalEpisodes = 0;
    this.stageEpisodeCount = 0;
  }

  isComplete(): boolean {
    return this.currentStage >= this.stages.length;
  }
}

/**
 * Self-Paced Learning
 * Automatically adjusts difficulty based on performance
 */
export class SelfPacedLearning {
  private minDifficulty: number = 0.1;
  private maxDifficulty: number = 1.0;
  private currentDifficulty: number = 0.1;
  private performanceHistory: number[] = [];
  private windowSize: number = 10;
  private adjustmentFactor: number = 0.1;

  getCurrentDifficulty(): number {
    return this.currentDifficulty;
  }

  updatePerformance(performance: number): void {
    this.performanceHistory.push(performance);

    if (this.performanceHistory.length > this.windowSize) {
      this.performanceHistory.shift();
    }

    // Calculate average performance
    const avgPerformance = this.performanceHistory.reduce((a, b) => a + b, 0) / this.performanceHistory.length;

    // Adjust difficulty
    if (avgPerformance > 0.8) {
      // Increase difficulty
      this.currentDifficulty = Math.min(
        this.maxDifficulty,
        this.currentDifficulty + this.adjustmentFactor
      );
    } else if (avgPerformance < 0.3) {
      // Decrease difficulty
      this.currentDifficulty = Math.max(
        this.minDifficulty,
        this.currentDifficulty - this.adjustmentFactor
      );
    }
  }

  reset(): void {
    this.currentDifficulty = this.minDifficulty;
    this.performanceHistory = [];
  }

  setDifficultyRange(min: number, max: number): void {
    this.minDifficulty = min;
    this.maxDifficulty = max;
  }

  setAdjustmentFactor(factor: number): void {
    this.adjustmentFactor = factor;
  }
}

/**
 * Teacher-Student Curriculum
 * Teacher selects tasks for student based on learning progress
 */
export class TeacherStudentCurriculum {
  private tasks: Task[] = [];
  private studentPerformance: Map<string, number> = new Map();
  private selectionStrategy: 'random' | 'sequential' | 'adaptive' = 'adaptive';

  addTask(task: Task): void {
    this.tasks.push(task);
  }

  selectNextTask(): Task | null {
    if (this.tasks.length === 0) {
      return null;
    }

    switch (this.selectionStrategy) {
      case 'random':
        return this.selectRandomTask();
      case 'sequential':
        return this.selectSequentialTask();
      case 'adaptive':
        return this.selectAdaptiveTask();
      default:
        return this.selectAdaptiveTask();
    }
  }

  private selectRandomTask(): Task {
    const idx = Math.floor(Math.random() * this.tasks.length);
    return this.tasks[idx];
  }

  private selectSequentialTask(): Task | null {
    // Find first task not yet mastered
    for (const task of this.tasks) {
      const performance = this.studentPerformance.get(task.name) ?? 0;
      if (performance < 0.8) {
        return task;
      }
    }
    return this.tasks[0] ?? null;
  }

  private selectAdaptiveTask(): Task | null {
    // Select task with appropriate difficulty based on recent performance
    const avgPerformance = this.getAveragePerformance();

    // Find tasks with difficulty close to current ability
    const appropriateTasks = this.tasks.filter(task => {
      const taskDifficulty = task.difficulty;
      return Math.abs(taskDifficulty - avgPerformance) < 0.2;
    });

    if (appropriateTasks.length > 0) {
      const idx = Math.floor(Math.random() * appropriateTasks.length);
      return appropriateTasks[idx];
    }

    // Fallback to sequential
    return this.selectSequentialTask();
  }

  updateTaskPerformance(taskName: string, performance: number): void {
    this.studentPerformance.set(taskName, performance);
  }

  private getAveragePerformance(): number {
    if (this.studentPerformance.size === 0) {
      return 0.5;
    }

    const performances = Array.from(this.studentPerformance.values());
    return performances.reduce((a, b) => a + b, 0) / performances.length;
  }

  reset(): void {
    this.studentPerformance.clear();
  }

  setSelectionStrategy(strategy: 'random' | 'sequential' | 'adaptive'): void {
    this.selectionStrategy = strategy;
  }
}

export interface Task {
  name: string;
  difficulty: number;
  envConfig: Record<string, any>;
}

/**
 * Automatic Curriculum Learning
 * Uses mutual information to select optimal task ordering
 */
export class AutomaticCurriculumLearning {
  private tasks: Task[] = [];
  private taskScores: Map<string, number> = new Map();
  private selectionHistory: string[] = [];
  private alpha: number = 0.5; // Balance between score and novelty

  addTask(task: Task): void {
    this.tasks.push(task);
    this.taskScores.set(task.name, 0.5);
  }

  selectNextTask(): Task | null {
    if (this.tasks.length === 0) {
      return null;
    }

    // Calculate task selection scores
    const scoredTasks = this.tasks.map(task => ({
      task,
      score: this.calculateTaskScore(task.name),
    }));

    // Sort by score
    scoredTasks.sort((a, b) => b.score - a.score);

    // Select task with highest score
    return scoredTasks[0]?.task ?? null;
  }

  private calculateTaskScore(taskName: string): number {
    const baseScore = this.taskScores.get(taskName) ?? 0.5;
    const noveltyScore = this.calculateNoveltyScore(taskName);

    return this.alpha * baseScore + (1 - this.alpha) * noveltyScore;
  }

  private calculateNoveltyScore(taskName: string): number {
    // Novelty is inversely proportional to recent selection frequency
    const recentSelections = this.selectionHistory.slice(-10);
    const count = recentSelections.filter(name => name === taskName).length;

    return 1 - count / 10;
  }

  updateTaskScore(taskName: string, performance: number): void {
    const currentScore = this.taskScores.get(taskName) ?? 0.5;

    // Update score using exponential moving average
    const newScore = 0.7 * currentScore + 0.3 * performance;
    this.taskScores.set(taskName, newScore);

    // Record selection
    this.selectionHistory.push(taskName);

    // Limit history size
    if (this.selectionHistory.length > 100) {
      this.selectionHistory.shift();
    }
  }

  reset(): void {
    this.taskScores.clear();
    this.selectionHistory = [];
  }

  setAlpha(alpha: number): void {
    this.alpha = Math.max(0, Math.min(1, alpha));
  }
}

/**
 * Progressive Neural Networks Curriculum
 * Uses progressive networks to transfer knowledge between stages
 */
export class ProgressiveNetworksCurriculum {
  private stages: CurriculumStage[] = [];
  private currentStage: number = 0;
  private networks: any[] = [];

  addStage(stage: CurriculumStage): void {
    this.stages.push(stage);
  }

  getCurrentStage(): CurriculumStage | null {
    if (this.currentStage >= this.stages.length) {
      return null;
    }
    return this.stages[this.currentStage];
  }

  advanceStage(): boolean {
    if (this.currentStage >= this.stages.length - 1) {
      return false;
    }

    this.currentStage++;

    // Create new network with lateral connections to previous networks
    const newNetwork = this.createNetworkWithLateralConnections();
    this.networks.push(newNetwork);

    return true;
  }

  private createNetworkWithLateralConnections(): any {
    // In practice, would create network with lateral connections
    // to all previous networks
    return {
      lateralConnections: this.networks.length,
      previousNetworks: [...this.networks],
    };
  }

  reset(): void {
    this.currentStage = 0;
    this.networks = [];
  }
}

/**
 * Domain Randomization Curriculum
 * Gradually increases domain randomization
 */
export class DomainRandomizationCurriculum {
  private minRandomization: number = 0.0;
  private maxRandomization: number = 1.0;
  private currentRandomization: number = 0.0;
  private performanceHistory: number[] = [];
  private windowSize: number = 10;

  getCurrentRandomization(): number {
    return this.currentRandomization;
  }

  updatePerformance(performance: number): void {
    this.performanceHistory.push(performance);

    if (this.performanceHistory.length > this.windowSize) {
      this.performanceHistory.shift();
    }

    // Calculate average performance
    const avgPerformance = this.performanceHistory.reduce((a, b) => a + b, 0) / this.performanceHistory.length;

    // Increase randomization as performance improves
    if (avgPerformance > 0.8) {
      this.currentRandomization = Math.min(
        this.maxRandomization,
        this.currentRandomization + 0.1
      );
    }
  }

  reset(): void {
    this.currentRandomization = this.minRandomization;
    this.performanceHistory = [];
  }

  setRandomizationRange(min: number, max: number): void {
    this.minRandomization = min;
    this.maxRandomization = max;
  }
}

/**
 * Curriculum Wrapper
 * Wraps an environment and applies curriculum learning
 */
export class CurriculumWrapper {
  private curriculum: CurriculumLearning;
  private baseEnv: Env;
  private currentEnv: Env;

  constructor(curriculum: CurriculumLearning, baseEnv: Env) {
    this.curriculum = curriculum;
    this.baseEnv = baseEnv;
    this.currentEnv = baseEnv;
  }

  async reset(options?: Record<string, any>): Promise<any> {
    const stage = this.curriculum.getCurrentStage();

    if (stage) {
      // Apply stage configuration
      const stageOptions = { ...options, ...stage.envConfig };
      return this.currentEnv.reset(stageOptions);
    }

    return this.currentEnv.reset(options);
  }

  async step(action: any): Promise<StepResult<any>> {
    return this.currentEnv.step(action);
  }

  updatePerformance(performance: number): boolean {
    return this.curriculum.updatePerformance(performance);
  }

  getCurrentDifficulty(): number {
    return this.curriculum.getCurrentDifficulty();
  }

  getProgress(): CurriculumProgress {
    return this.curriculum.getProgress();
  }
}

/**
 * Curriculum Factory
 */
export class CurriculumFactory {
  static createSequentialCurriculum(stages: CurriculumStage[]): CurriculumLearning {
    const curriculum = new CurriculumLearning();

    for (const stage of stages) {
      curriculum.addStage(stage);
    }

    return curriculum;
  }

  static createSelfPacedCurriculum(
    minDifficulty: number = 0.1,
    maxDifficulty: number = 1.0
  ): SelfPacedLearning {
    const spl = new SelfPacedLearning();
    spl.setDifficultyRange(minDifficulty, maxDifficulty);
    return spl;
  }

  static createTeacherStudentCurriculum(tasks: Task[]): TeacherStudentCurriculum {
    const tsc = new TeacherStudentCurriculum();

    for (const task of tasks) {
      tsc.addTask(task);
    }

    return tsc;
  }

  static createAutomaticCurriculum(tasks: Task[]): AutomaticCurriculumLearning {
    const acl = new AutomaticCurriculumLearning();

    for (const task of tasks) {
      acl.addTask(task);
    }

    return acl;
  }

  static createDefaultCodeCompletionCurriculum(): CurriculumLearning {
    const stages: CurriculumStage[] = [
      {
        name: 'easy_completion',
        difficulty: 0.2,
        envConfig: { maxCodeLength: 50, vocabSize: 100 },
        evaluationThreshold: 0.7,
        maxEpisodes: 1000,
      },
      {
        name: 'medium_completion',
        difficulty: 0.5,
        envConfig: { maxCodeLength: 100, vocabSize: 500 },
        evaluationThreshold: 0.6,
        maxEpisodes: 2000,
      },
      {
        name: 'hard_completion',
        difficulty: 0.8,
        envConfig: { maxCodeLength: 200, vocabSize: 1000 },
        evaluationThreshold: 0.5,
        maxEpisodes: 3000,
      },
    ];

    return this.createSequentialCurriculum(stages);
  }
}
