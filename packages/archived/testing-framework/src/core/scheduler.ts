import { TestSchedulerConfig } from './types';
import { Logger } from './logger';
import { TestCase, TestPriority, ExecutionState } from './types';
import { SchedulerTypes } from './constants';

/**
 * Test scheduler interface
 */
export interface TestScheduler {
  schedule(testCase: TestCase): TestCase[];
  addPriority(task: TestCase): void;
  getQueue(): TestCase[];
  clear(): void;
  pause(): void;
  resume(): void;
  stop(): void;
}

/**
 * Base test scheduler implementation
 */
export abstract class BaseScheduler implements TestScheduler {
  protected config: TestSchedulerConfig;
  protected queue: TestCase[] = [];
  protected paused: boolean = false;
  protected logger: Logger;

  constructor(config: TestSchedulerConfig) {
    this.config = config;
    this.logger = new Logger({ name: 'TestScheduler' });
  }

  /**
   * Schedule tests
   */
  abstract schedule(testCase: TestCase): TestCase[];

  /**
   * Add task to priority queue
   */
  abstract addPriority(task: TestCase): void;

  /**
   * Get current queue
   */
  getQueue(): TestCase[] {
    return [...this.queue];
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Pause scheduling
   */
  pause(): void {
    this.paused = true;
    this.logger.info('Scheduler paused');
  }

  /**
   * Resume scheduling
   */
  resume(): void {
    this.paused = false;
    this.logger.info('Scheduler resumed');
  }

  /**
   * Stop scheduler
   */
  stop(): void {
    this.paused = true;
    this.clear();
    this.logger.info('Scheduler stopped');
  }
}

/**
 * Parallel test scheduler
 */
export class ParallelScheduler extends BaseScheduler {
  private scheduledTests = new Set<string>();
  private maxParallel: number;

  constructor(config: TestSchedulerConfig) {
    super(config);
    this.maxParallel = config.maxParallel || 4;
  }

  /**
   * Schedule tests for parallel execution
   */
  schedule(testCase: TestCase): TestCase[] {
    if (this.paused || this.scheduledTests.has(testCase.id)) {
      return [];
    }

    const schedule: TestCase[] = [];
    const availableSlots = this.maxParallel - this.scheduledTests.size;

    if (availableSlots > 0) {
      this.scheduledTests.add(testCase.id);
      schedule.push(testCase);
    }

    return schedule;
  }

  /**
   * Add task to priority queue
   */
  addPriority(task: TestCase): void {
    if (!this.scheduledTests.has(task.id)) {
      // Insert at beginning of queue for priority
      this.queue.unshift(task);
      this.logger.debug(`Added priority task: ${task.name}`);
    }
  }

  /**
   * Release test slot
   */
  releaseSlot(testId: string): void {
    this.scheduledTests.delete(testId);
    this.logger.debug(`Released test slot: ${testId}`);
  }
}

/**
 * Sequential test scheduler
 */
export class SequentialScheduler extends BaseScheduler {
  constructor(config: TestSchedulerConfig) {
    super(config);
  }

  /**
   * Schedule tests for sequential execution
   */
  schedule(testCase: TestCase): TestCase[] {
    if (this.paused || this.queue.length > 0) {
      return [];
    }

    return [testCase];
  }

  /**
   * Add task to priority queue
   */
  addPriority(task: TestCase): void {
    if (this.queue.length === 0) {
      this.queue.unshift(task);
    }
  }
}

/**
 * Priority-based test scheduler
 */
export class PriorityScheduler extends BaseScheduler {
  private scheduledTests = new Set<string>();
  private maxParallel: number;

  constructor(config: TestSchedulerConfig) {
    super(config);
    this.maxParallel = config.maxParallel || 4;
  }

  /**
   * Schedule tests by priority
   */
  schedule(testCase: TestCase): TestCase[] {
    if (this.paused || this.scheduledTests.has(testCase.id)) {
      return [];
    }

    const priority = this.getTestPriority(testCase);
    const availableSlots = this.maxParallel - this.scheduledTests.size;

    // If we have available slots and this test is high priority, run it immediately
    if (availableSlots > 0 && priority >= TestPriority.HIGH) {
      this.scheduledTests.add(testCase.id);
      return [testCase];
    }

    // Otherwise, add to priority queue
    this.addToPriorityQueue(testCase, priority);
    return [];
  }

  /**
   * Add task to priority queue
   */
  addPriority(task: TestCase): void {
    const priority = this.getTestPriority(task);
    this.addToPriorityQueue(task, priority);
  }

  /**
   * Add test to priority-ordered queue
   */
  private addToPriorityQueue(testCase: TestCase, priority: number): void {
    let inserted = false;
    const queueWithPriority = this.queue.map(test => ({
      test,
      priority: this.getTestPriority(test)
    }));

    // Insert at correct position based on priority
    for (let i = 0; i < queueWithPriority.length; i++) {
      if (priority > queueWithPriority[i].priority) {
        this.queue.splice(i, 0, testCase);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.queue.push(testCase);
    }

    this.logger.debug(`Added task with priority ${priority}: ${testCase.name}`);
  }

  /**
   * Get test priority
   */
  private getTestPriority(testCase: TestCase): number {
    // Test case priority takes precedence
    if (testCase.priority) {
      return testCase.priority;
    }

    // Default to NORMAL priority
    return TestPriority.NORMAL;
  }

  /**
   * Release test slot
   */
  releaseSlot(testId: string): void {
    this.scheduledTests.delete(testId);

    // Schedule next test from queue
    const nextTest = this.queue.shift();
    if (nextTest) {
      const availableSlots = this.maxParallel - this.scheduledTests.size;
      if (availableSlots > 0) {
        this.scheduledTests.add(nextTest.id);
        // Emit event for next test to be scheduled
        this.emit('schedule', nextTest);
      }
    }
  }
}

/**
 * Adaptive test scheduler
 */
export class AdaptiveScheduler extends BaseScheduler {
  private scheduledTests = new Set<string>();
  private maxParallel: number;
  private testHistory: Map<string, TestHistoryEntry> = new Map();
  private currentLoad: number = 0;

  constructor(config: TestSchedulerConfig) {
    super(config);
    this.maxParallel = config.maxParallel || 4;
  }

  /**
   * Schedule tests adaptively based on history and current load
   */
  schedule(testCase: TestCase): TestCase[] {
    if (this.paused || this.scheduledTests.has(testCase.id)) {
      return [];
    }

    const priority = this.getAdaptivePriority(testCase);
    const availableSlots = this.maxParallel - this.scheduledTests.size;

    // If we have available slots and this test has high adaptive priority, run it immediately
    if (availableSlots > 0 && priority >= this.getAdaptiveThreshold()) {
      this.scheduledTests.add(testCase.id);
      this.updateLoad(testCase);
      return [testCase];
    }

    // Otherwise, add to adaptive queue
    this.addToAdaptiveQueue(testCase, priority);
    return [];
  }

  /**
   * Add task to adaptive priority queue
   */
  addPriority(task: TestCase): void {
    const priority = this.getAdaptivePriority(task);
    this.addToAdaptiveQueue(task, priority);
  }

  /**
   * Add test to adaptive-ordered queue
   */
  private addToAdaptiveQueue(testCase: TestCase, priority: number): void {
    let inserted = false;
    const queueWithPriority = this.queue.map(test => ({
      test,
      priority: this.getAdaptivePriority(test)
    }));

    // Insert at correct position based on adaptive priority
    for (let i = 0; i < queueWithPriority.length; i++) {
      if (priority > queueWithPriority[i].priority) {
        this.queue.splice(i, 0, testCase);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.queue.push(testCase);
    }

    this.logger.debug(`Added adaptive task with priority ${priority}: ${testCase.name}`);
  }

  /**
   * Get adaptive priority based on test history
   */
  private getAdaptivePriority(testCase: TestCase): number {
    const history = this.testHistory.get(testCase.id);

    if (!history) {
      return TestPriority.NORMAL; // No history, default priority
    }

    // Calculate adaptive priority based on:
    // 1. Test type (some types are prioritized)
    // 2. Past performance
    // 3. Past reliability
    // 4. Current system load

    let priority = TestPriority.NORMAL;

    // Test type priority
    switch (testCase.type) {
      case 'e2e':
      case 'performance':
      case 'security':
        priority += 1; // High priority tests
        break;
      case 'integration':
        priority += 0.5; // Medium priority
        break;
    }

    // Past performance
    if (history.averageDuration > 5000) {
      priority -= 1; // Long tests deprioritized
    }

    // Past reliability
    if (history.successRate < 0.8) {
      priority -= 0.5; // Unreliable tests deprioritized
    }

    // Current system load adjustment
    priority = this.adjustPriorityForLoad(priority, testCase);

    return Math.max(TestPriority.LOW, Math.min(TestPriority.CRITICAL, priority));
  }

  /**
   * Adjust priority based on current load
   */
  private adjustPriorityForLoad(priority: number, testCase: TestCase): number {
    const loadFactor = this.currentLoad / this.maxParallel;

    // Deprioritize non-critical tests when system is overloaded
    if (loadFactor > 0.8 && priority < TestPriority.HIGH) {
      return priority - 0.5;
    }

    return priority;
  }

  /**
   * Get adaptive threshold for immediate scheduling
   */
  private getAdaptiveThreshold(): number {
    const loadFactor = this.currentLoad / this.maxParallel;

    // Lower threshold when system is under low load
    if (loadFactor < 0.5) {
      return TestPriority.HIGH - 0.5;
    }

    // Higher threshold when system is under high load
    return TestPriority.HIGH;
  }

  /**
   * Update current load based on scheduled test
   */
  private updateLoad(testCase: TestCase): void {
    const history = this.testHistory.get(testCase.id);
    const estimatedDuration = history?.averageDuration || 5000;

    // Update current load (simplified calculation)
    this.currentLoad += Math.ceil(estimatedDuration / 1000);

    this.logger.debug(`Updated load: ${this.currentLoad} (scheduled ${testCase.name})`);
  }

  /**
   * Release test slot and update load
   */
  releaseSlot(testId: string): void {
    const test = this.scheduledTests.has(testId);
    if (!test) return;

    this.scheduledTests.delete(testId);

    // Update load based on completed test
    const history = this.testHistory.get(testId);
    if (history) {
      this.currentLoad -= Math.ceil(history.averageDuration / 1000);
    }

    // Ensure load doesn't go negative
    this.currentLoad = Math.max(0, this.currentLoad);

    this.logger.debug(`Released test slot: ${testId}, load: ${this.currentLoad}`);

    // Schedule next test from queue
    this.scheduleNextTest();
  }

  /**
   * Schedule next test from queue
   */
  private scheduleNextTest(): void {
    if (this.queue.length === 0) return;

    const availableSlots = this.maxParallel - this.scheduledTests.size;
    if (availableSlots > 0) {
      const nextTest = this.queue.shift()!;
      if (!this.scheduledTests.has(nextTest.id)) {
        this.scheduledTests.add(nextTest.id);
        this.updateLoad(nextTest);
        this.emit('schedule', nextTest);
      }
    }
  }

  /**
   * Update test history
   */
  updateTestHistory(testId: string, duration: number, success: boolean): void {
    const existing = this.testHistory.get(testId) || {
      runs: 0,
      totalDuration: 0,
      successes: 0
    };

    existing.runs++;
    existing.totalDuration += duration;
    existing.successes += success ? 1 : 0;

    existing.averageDuration = existing.totalDuration / existing.runs;
    existing.successRate = existing.successes / existing.runs;

    this.testHistory.set(testId, existing);

    this.logger.debug(`Updated history for ${testId}: avg=${existing.averageDuration}, success=${existing.successRate}`);
  }
}

/**
 * Test scheduler factory
 */
export function createTestScheduler(type: string, config: TestSchedulerConfig): TestScheduler {
  switch (type) {
    case SchedulerTypes.PARALLEL:
      return new ParallelScheduler(config);
    case SchedulerTypes.SEQUENTIAL:
      return new SequentialScheduler(config);
    case SchedulerTypes.PRIORITY:
      return new PriorityScheduler(config);
    case SchedulerTypes.ADAPTIVE:
      return new AdaptiveScheduler(config);
    default:
      throw new Error(`Unknown scheduler type: ${type}`);
  }
}

/**
 * Test scheduler configuration
 */
export interface TestSchedulerConfig {
  type: string;
  maxParallel?: number;
  maxSuitesParallel?: number;
  adaptive?: {
    enabled: boolean;
    historyRetention: number;
    loadBalancing: boolean;
  };
}

/**
 * Test history entry
 */
interface TestHistoryEntry {
  runs: number;
  totalDuration: number;
  successes: number;
  averageDuration: number;
  successRate: number;
}