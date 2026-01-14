/**
 * State Machine Tester
 * Comprehensive testing framework for state machines
 */

import { StateMachineEngine, createStateMachine } from '../engine/engine.js';
import { StateManager } from '../state/manager.js';
import {
  State,
  StateMachineDefinition,
  StateContext,
  StatePath,
  TestOptions,
  TestResult,
  TestCoverage,
  Transition,
} from '../types/index.js';

/**
 * Test case definition
 */
export interface TestCase<TData = any> {
  name: string;
  initialEvent?: string;
  initialPayload?: any;
  steps: TestStep[];
  expectedFinalState: State;
  expectedResult?: any;
}

/**
 * Test step
 */
export interface TestStep<TData = any> {
  event: string;
  payload?: any;
  expectedState?: State;
  assertions?: ((context: StateContext<TData>) => void)[];
}

/**
 * Path exploration result
 */
export interface PathExplorationResult {
  paths: StatePath[];
  coverage: TestCoverage;
  unreachableStates: State[];
  deadEndStates: State[];
  loops: StatePath[];
}

/**
 * Property test result
 */
export interface PropertyTestResult {
  passed: boolean;
  iterations: number;
  failures: Array<{
    path: StatePath;
    error: string;
  }>;
  shrunkFailure?: {
    path: StatePath;
    error: string;
  };
}

/**
 * State machine tester class
 */
export class StateMachineTester<TData = any> {
  private machine: StateMachineEngine<TData>;
  private stateManager: StateManager<TData>;
  private testResults: TestResult[] = [];
  private coverage: TestCoverage = {
    states: new Set(),
    transitions: new Set(),
    events: new Set(),
    percentage: 0,
  };

  constructor(definition: StateMachineDefinition<TData>) {
    this.machine = createStateMachine(definition, {
      enableMetrics: true,
      enableLogging: false,
    });
    this.stateManager = new StateManager(this.machine, {
      enableValidation: false,
    });
  }

  /**
   * Run a test case
   */
  async runTestCase(testCase: TestCase<TData>): Promise<TestResult> {
    const startTime = performance.now();
    const path: StatePath = {
      states: [this.machine.state],
      events: [],
      length: 0,
    };

    try {
      // Reset machine
      this.machine.reset();

      // Send initial event if provided
      if (testCase.initialEvent) {
        await this.machine.send(testCase.initialEvent, testCase.initialPayload);
        path.events.push(testCase.initialEvent);
        path.states.push(this.machine.state);
      }

      // Execute steps
      for (const step of testCase.steps) {
        const previousState = this.machine.state;

        // Send event
        const result = await this.machine.send(step.event, step.payload);
        path.events.push(step.event);
        path.states.push(this.machine.state);
        path.length++;

        // Check expected state
        if (step.expectedState && this.machine.state !== step.expectedState) {
          throw new Error(
            `Expected state '${step.expectedState}' but got '${this.machine.state}'`
          );
        }

        // Run assertions
        if (step.assertions) {
          const context: StateContext = {
            current: this.machine.state,
            previous: previousState,
            event: step.event,
            payload: step.payload,
            timestamp: Date.now(),
          };

          for (const assertion of step.assertions) {
            assertion(context);
          }
        }
      }

      // Check final state
      if (this.machine.state !== testCase.expectedFinalState) {
        throw new Error(
          `Expected final state '${testCase.expectedFinalState}' but got '${this.machine.state}'`
        );
      }

      // Update coverage
      this.updateCoverage(path);

      const duration = performance.now() - startTime;
      const result: TestResult = {
        name: testCase.name,
        passed: true,
        path,
        coverage: { ...this.coverage },
        duration,
      };

      this.testResults.push(result);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      const result: TestResult = {
        name: testCase.name,
        passed: false,
        error: (error as Error).message,
        path,
        coverage: { ...this.coverage },
        duration,
      };

      this.testResults.push(result);
      return result;
    }
  }

  /**
   * Run all test cases
   */
  async runTestCases(testCases: TestCase<TData>[]): Promise<TestResult[]> {
    this.testResults = [];
    this.coverage = {
      states: new Set(),
      transitions: new Set(),
      events: new Set(),
      percentage: 0,
    };

    const results: TestResult[] = [];

    for (const testCase of testCases) {
      const result = await this.runTestCase(testCase);
      results.push(result);
    }

    return results;
  }

  /**
   * Explore all possible paths
   */
  async explorePaths(options: TestOptions = {}): Promise<PathExplorationResult> {
    const maxPathLength = options.maxPathLength || 10;
    const paths: StatePath[] = [];
    const visited = new Set<string>();
    const queue: StatePath[] = [
      {
        states: [this.machine.definition.initial],
        events: [],
        length: 0,
      },
    ];

    while (queue.length > 0) {
      const path = queue.shift()!;
      const currentState = path.states[path.states.length - 1];
      const pathKey = path.states.join(',');

      if (visited.has(pathKey)) {
        continue;
      }

      visited.add(pathKey);
      paths.push(path);

      if (path.length >= maxPathLength) {
        continue;
      }

      // Get available transitions from current state
      const transitions = this.getTransitionsFromState(currentState);

      for (const transition of transitions) {
        const newPath: StatePath = {
          states: [...path.states, transition.to],
          events: [...path.events, transition.on],
          length: path.length + 1,
        };

        queue.push(newPath);
      }
    }

    // Calculate coverage
    const coverage = this.calculateCoverage(paths);

    // Find unreachable states
    const allStates = new Set(Object.keys(this.machine.definition.states));
    const reachedStates = new Set(coverage.states);
    const unreachableStates = Array.from(allStates).filter(s => !reachedStates.has(s));

    // Find dead ends (states with no outgoing transitions)
    const deadEndStates: State[] = [];
    for (const state of allStates) {
      const transitions = this.getTransitionsFromState(state);
      if (transitions.length === 0 && !this.machine.definition.states[state]?.final) {
        deadEndStates.push(state);
      }
    }

    // Find loops
    const loops: StatePath[] = [];
    for (const path of paths) {
      const stateCounts = new Map<State, number>();
      for (const state of path.states) {
        stateCounts.set(state, (stateCounts.get(state) || 0) + 1);
      }

      if (Array.from(stateCounts.values()).some(count => count > 1)) {
        loops.push(path);
      }
    }

    return {
      paths,
      coverage,
      unreachableStates,
      deadEndStates,
      loops,
    };
  }

  /**
   * Run property-based tests
   */
  async runPropertyTests(
    property: (path: StatePath) => boolean,
    options: TestOptions = {}
  ): Promise<PropertyTestResult> {
    const iterations = options.propertyIterations || 100;
    const failures: Array<{ path: StatePath; error: string }> = [];

    for (let i = 0; i < iterations; i++) {
      // Generate random path
      const path = await this.generateRandomPath(options);

      try {
        const result = property(path);
        if (!result) {
          failures.push({
            path,
            error: 'Property returned false',
          });
        }
      } catch (error) {
        failures.push({
          path,
          error: (error as Error).message,
        });
      }
    }

    // Shrink failures
    let shrunkFailure: { path: StatePath; error: string } | undefined;
    if (failures.length > 0) {
      shrunkFailure = await this.shrinkFailure(failures[0], property);
    }

    return {
      passed: failures.length === 0,
      iterations,
      failures,
      shrunkFailure,
    };
  }

  /**
   * Generate coverage report
   */
  generateCoverageReport(): string {
    const totalStates = Object.keys(this.machine.definition.states).length;
    const totalTransitions = this.countTotalTransitions();
    const totalEvents = this.getAllEvents().length;

    let report = '=== State Machine Coverage Report ===\n\n';
    report += `States Covered: ${this.coverage.states.size}/${totalStates} (${((this.coverage.states.size / totalStates) * 100).toFixed(1)}%)\n`;
    report += `Transitions Covered: ${this.coverage.transitions.size}/${totalTransitions} (${((this.coverage.transitions.size / totalTransitions) * 100).toFixed(1)}%)\n`;
    report += `Events Covered: ${this.coverage.events.size}/${totalEvents} (${((this.coverage.events.size / totalEvents) * 100).toFixed(1)}%)\n\n`;

    // List uncovered states
    const uncoveredStates = Object.keys(this.machine.definition.states).filter(
      s => !this.coverage.states.has(s)
    );
    if (uncoveredStates.length > 0) {
      report += `Uncovered States: ${uncoveredStates.join(', ')}\n`;
    }

    // List uncovered transitions
    const allTransitions = this.getAllTransitions();
    const uncoveredTransitions = allTransitions.filter(
      t => !this.coverage.transitions.has(t)
    );
    if (uncoveredTransitions.length > 0) {
      report += `\nUncovered Transitions:\n`;
      for (const transition of uncoveredTransitions) {
        report += `  - ${transition}\n`;
      }
    }

    return report;
  }

  /**
   * Get test results
   */
  getResults(): readonly TestResult[] {
    return [...this.testResults];
  }

  /**
   * Get coverage
   */
  getCoverage(): TestCoverage {
    return { ...this.coverage };
  }

  /**
   * Reset tester
   */
  reset(): void {
    this.machine.reset();
    this.testResults = [];
    this.coverage = {
      states: new Set(),
      transitions: new Set(),
      events: new Set(),
      percentage: 0,
    };
  }

  /**
   * Update coverage from path
   */
  private updateCoverage(path: StatePath): void {
    // Add states
    for (const state of path.states) {
      this.coverage.states.add(state);
    }

    // Add transitions and events
    for (let i = 0; i < path.events.length; i++) {
      const from = path.states[i];
      const to = path.states[i + 1];
      const event = path.events[i];

      this.coverage.transitions.add(`${from}->${to}`);
      this.coverage.events.add(event);
    }

    // Calculate percentage
    const totalStates = Object.keys(this.machine.definition.states).length;
    const totalTransitions = this.countTotalTransitions();
    const totalElements = totalStates + totalTransitions;
    const coveredElements = this.coverage.states.size + this.coverage.transitions.size;

    this.coverage.percentage = (coveredElements / totalElements) * 100;
  }

  /**
   * Calculate coverage from paths
   */
  private calculateCoverage(paths: StatePath[]): TestCoverage {
    const coverage: TestCoverage = {
      states: new Set(),
      transitions: new Set(),
      events: new Set(),
      percentage: 0,
    };

    for (const path of paths) {
      for (const state of path.states) {
        coverage.states.add(state);
      }

      for (let i = 0; i < path.events.length; i++) {
        const from = path.states[i];
        const to = path.states[i + 1];
        const event = path.events[i];

        coverage.transitions.add(`${from}->${to}`);
        coverage.events.add(event);
      }
    }

    // Calculate percentage
    const totalStates = Object.keys(this.machine.definition.states).length;
    const totalTransitions = this.countTotalTransitions();
    const totalElements = totalStates + totalTransitions;
    const coveredElements = coverage.states.size + coverage.transitions.size;

    coverage.percentage = (coveredElements / totalElements) * 100;

    return coverage;
  }

  /**
   * Get transitions from a state
   */
  private getTransitionsFromState(state: State): Transition<TData>[] {
    const stateDef = this.machine.definition.states[state];
    const transitions: Transition<TData>[] = [];

    if (stateDef?.transitions) {
      transitions.push(...stateDef.transitions);
    }

    // Add global transitions
    if (this.machine.definition.transitions) {
      for (const transition of this.machine.definition.transitions) {
        if (transition.from === '*' || transition.from === state) {
          transitions.push(transition);
        }
      }
    }

    return transitions;
  }

  /**
   * Count total transitions
   */
  private countTotalTransitions(): number {
    let count = 0;

    for (const stateDef of Object.values(this.machine.definition.states)) {
      if (stateDef.transitions) {
        count += stateDef.transitions.length;
      }
    }

    if (this.machine.definition.transitions) {
      count += this.machine.definition.transitions.length;
    }

    return count;
  }

  /**
   * Get all events
   */
  private getAllEvents(): Set<string> {
    const events = new Set<string>();

    for (const stateDef of Object.values(this.machine.definition.states)) {
      if (stateDef.transitions) {
        for (const transition of stateDef.transitions) {
          events.add(transition.on);
        }
      }
    }

    if (this.machine.definition.transitions) {
      for (const transition of this.machine.definition.transitions) {
        events.add(transition.on);
      }
    }

    return events;
  }

  /**
   * Get all transitions
   */
  private getAllTransitions(): string[] {
    const transitions: string[] = [];

    for (const [stateName, stateDef] of Object.entries(this.machine.definition.states)) {
      if (stateDef.transitions) {
        for (const transition of stateDef.transitions) {
          transitions.push(`${stateName}->${transition.to}`);
        }
      }
    }

    if (this.machine.definition.transitions) {
      for (const transition of this.machine.definition.transitions) {
        if (transition.from === '*') {
          for (const stateName of Object.keys(this.machine.definition.states)) {
            transitions.push(`${stateName}->${transition.to}`);
          }
        } else {
          transitions.push(`${transition.from}->${transition.to}`);
        }
      }
    }

    return transitions;
  }

  /**
   * Generate random path
   */
  private async generateRandomPath(options: TestOptions = {}): Promise<StatePath> {
    const maxLength = options.maxPathLength || 10;
    const path: StatePath = {
      states: [this.machine.definition.initial],
      events: [],
      length: 0,
    };

    this.machine.reset();

    for (let i = 0; i < maxLength; i++) {
      const currentState = path.states[path.states.length - 1];
      const transitions = this.getTransitionsFromState(currentState);

      if (transitions.length === 0) {
        break;
      }

      // Pick random transition
      const transition = transitions[Math.floor(Math.random() * transitions.length)];

      // Check guard
      const context: StateContext = {
        current: currentState,
        event: transition.on,
        timestamp: Date.now(),
      };

      let canExecute = true;
      if (transition.guard) {
        canExecute = await transition.guard(context);
      }

      if (!canExecute) {
        continue;
      }

      // Execute transition
      try {
        await this.machine.send(transition.on, options.testData);
        path.events.push(transition.on);
        path.states.push(this.machine.state);
        path.length++;
      } catch {
        break;
      }
    }

    return path;
  }

  /**
   * Shrink failure to minimal counterexample
   */
  private async shrinkFailure(
    failure: { path: StatePath; error: string },
    property: (path: StatePath) => boolean
  ): Promise<{ path: StatePath; error: string }> {
    let current = { ...failure, path: { ...failure.path } };

    // Try removing events from the end
    while (current.path.events.length > 0) {
      const shrunk: StatePath = {
        states: current.path.states.slice(0, -1),
        events: current.path.events.slice(0, -1),
        length: current.path.length - 1,
      };

      try {
        const result = property(shrunk);
        if (!result) {
          current.path = shrunk;
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    return current;
  }

  /**
   * Destroy tester
   */
  destroy(): void {
    this.machine.destroy();
    this.stateManager.destroy();
    this.testResults = [];
    this.coverage.states.clear();
    this.coverage.transitions.clear();
    this.coverage.events.clear();
  }
}

/**
 * Quick test helper
 */
export async function quickTest<TData = any>(
  definition: StateMachineDefinition<TData>,
  testCases: TestCase<TData>[]
): Promise<{
  passed: number;
  failed: number;
  results: TestResult[];
  coverage: TestCoverage;
}> {
  const tester = new StateMachineTester(definition);
  const results = await tester.runTestCases(testCases);

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const coverage = tester.getCoverage();

  tester.destroy();

  return { passed, failed, results, coverage };
}

/**
 * Generate test cases automatically
 */
export function generateTestCases<TData = any>(
  definition: StateMachineDefinition<TData>
): TestCase<TData>[] {
  const testCases: TestCase<TData>[] = [];

  // Generate a test case for each state
  for (const [stateName, stateDef] of Object.entries(definition.states)) {
    if (stateDef.transitions) {
      for (const transition of stateDef.transitions) {
        const testCase: TestCase<TData> = {
          name: `Transition from ${stateName} to ${transition.to} on ${transition.on}`,
          steps: [{ event: transition.on }],
          expectedFinalState: transition.to,
        };
        testCases.push(testCase);
      }
    }
  }

  return testCases;
}
