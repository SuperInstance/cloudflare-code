// @ts-nocheck
/**
 * Code Generation Environments for RL
 */

import { Env, StepResult, Box, Discrete, Space } from './base.js';

export interface CodeState {
  partialCode: string;
  context: string[];
  cursorPosition: number;
  ast?: any;
  typeInfo?: any;
}

export interface CodeAction {
  token: number;
  position?: number;
}

/**
 * Code Completion Environment
 * Agent learns to complete code snippets
 */
export class CodeCompletionEnv extends Env<CodeState, number> {
  readonly observationSpace: Box;
  readonly actionSpace: Discrete;

  private dataset: CodeSnippet[];
  private currentSnippet: CodeSnippet | null = null;
  private maxLength: number = 512;
  private vocabSize: number;
  private tokens: string[];
  private tokenToId: Map<string, number>;
  private idToToken: Map<number, string>;

  constructor(
    vocab: string[],
    dataset: CodeSnippet[],
    options: {
      maxLength?: number;
      contextWindowSize?: number;
    } = {}
  ) {
    super();

    this.vocabSize = vocab.length;
    this.tokens = vocab;
    this.tokenToId = new Map(vocab.map((t, i) => [t, i]));
    this.idToToken = new Map(vocab.map((t, i) => [i.toString(), t]));

    const maxLength = options.maxLength ?? 512;
    this.maxlength = maxLength;

    this.observationSpace = new Box(0, vocabSize - 1, 'int32', [maxLength]);
    this.actionSpace = new Discrete(vocabSize);

    this.dataset = dataset;
    this._metadata = {
      'render.modes': ['human', 'ansi'],
      'vocab.size': vocabSize,
      'max.length': maxLength,
    };
  }

  async reset(options?: Record<string, any>): Promise<CodeState> {
    // Select random snippet from dataset
    this.currentSnippet = this.dataset[Math.floor(Math.random() * this.dataset.length)];
    this._elapsedSteps = 0;

    const prefixLength = Math.floor(Math.random() * (this.currentSnippet.prefix.length / 2));

    return {
      partialCode: this.currentSnippet.prefix.slice(0, prefixLength),
      context: [],
      cursorPosition: prefixLength,
    };
  }

  async step(action: number): Promise<StepResult<CodeState>> {
    if (!this.currentSnippet) {
      throw new Error('Environment not reset');
    }

    this._elapsedSteps++;

    const token = this.idToToken.get(action) ?? '<UNK>';
    const currentCode = this.getCurrentCode();

    // Append token
    const newCode = currentCode + token;

    // Calculate reward
    const reward = this.calculateReward(newCode);

    // Check if done
    const { terminated, truncated } = this.checkTermination(newCode);

    const newState: CodeState = {
      partialCode: newCode,
      context: [],
      cursorPosition: newCode.length,
    };

    return {
      observation: newState,
      reward,
      terminated,
      truncated,
      info: {
        token,
        editDistance: this.editDistance(newCode, this.currentSnippet.target),
        matchRatio: this.calculateMatchRatio(newCode, this.currentSnippet.target),
      },
    };
  }

  private getCurrentCode(): string {
    return this.currentSnippet?.prefix ?? '';
  }

  private calculateReward(code: string): number {
    if (!this.currentSnippet) return 0;

    const target = this.currentSnippet.target;

    // Base reward from edit distance
    const editDist = this.editDistance(code, target);
    const maxLen = Math.max(code.length, target.length);
    const editReward = 1 - editDist / maxLen;

    // Syntax correctness bonus
    const syntaxBonus = this.checkSyntax(code) ? 0.1 : 0;

    // Semantic correctness bonus
    const semanticBonus = this.checkSemantics(code) ? 0.2 : 0;

    // Exact match bonus
    const exactBonus = code === target ? 0.5 : 0;

    return editReward + syntaxBonus + semanticBonus + exactBonus;
  }

  private checkTermination(code: string): { terminated: boolean; truncated: boolean } {
    const terminated = code === this.currentSnippet?.target;
    const truncated = this._elapsedSteps >= this.maxlength || code.length >= this.maxlength;

    return { terminated, truncated };
  }

  private editDistance(s1: string, s2: string): number {
    const dp: number[][] = Array(s1.length + 1)
      .fill(0)
      .map(() => Array(s2.length + 1).fill(0));

    for (let i = 0; i <= s1.length; i++) dp[i][0] = i;
    for (let j = 0; j <= s2.length; j++) dp[0][j] = j;

    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    return dp[s1.length][s2.length];
  }

  private calculateMatchRatio(generated: string, target: string): number {
    const distance = this.editDistance(generated, target);
    const maxLen = Math.max(generated.length, target.length);
    return maxLen > 0 ? 1 - distance / maxLen : 1;
  }

  private checkSyntax(code: string): boolean {
    // Basic syntax check - can be extended
    try {
      // Check balanced parentheses
      let depth = 0;
      for (const char of code) {
        if (char === '{') depth++;
        if (char === '}') depth--;
        if (depth < 0) return false;
      }
      return depth === 0;
    } catch {
      return false;
    }
  }

  private checkSemantics(code: string): boolean {
    // Basic semantic check - can be extended with type checking
    return code.length > 0 && this.checkSyntax(code);
  }

  render(mode: 'human' | 'rgb_array' | 'ansi' = 'human'): string {
    if (!this.currentSnippet) {
      return 'No active episode';
    }

    const currentCode = this.getCurrentCode();
    const targetCode = this.currentSnippet.target;

    if (mode === 'human') {
      return `
Current Code:
${currentCode}

Target Code:
${targetCode}

Edit Distance: ${this.editDistance(currentCode, targetCode)}
Match Ratio: ${this.calculateMatchRatio(currentCode, targetCode).toFixed(2)}
`;
    }

    return JSON.stringify({
      current: currentCode,
      target: targetCode,
      editDistance: this.editDistance(currentCode, targetCode),
    });
  }
}

/**
 * Code Optimization Environment
 * Agent learns to optimize code for performance
 */
export class CodeOptimizationEnv extends Env<any, number> {
  readonly observationSpace: Box;
  readonly actionSpace: Discrete;

  private actions: OptimizationAction[];

  constructor(
    actions: OptimizationAction[],
    options: {
      stateSize?: number;
      numActions?: number;
    } = {}
  ) {
    super();

    const stateSize = options.stateSize ?? 256;
    const numActions = options.numActions ?? actions.length;

    this.actions = actions;

    this.observationSpace = new Box(-Infinity, Infinity, 'float32', [stateSize]);
    this.actionSpace = new Discrete(numActions);

    this._metadata = {
      'render.modes': ['human'],
      'actions.count': actions.length,
    };
  }

  async reset(options?: Record<string, any>): Promise<any> {
    this._elapsedSteps = 0;
    return this.getInitialState(options);
  }

  async step(action: number): Promise<StepResult<any>> {
    this._elapsedSteps++;

    const optimizationAction = this.actions[action];
    const { newState, reward, done } = await this.applyAction(optimizationAction);

    return {
      observation: newState,
      reward,
      terminated: done,
      truncated: false,
      info: {
        action: optimizationAction.name,
        improvement: reward,
      },
    };
  }

  private async getInitialState(options?: Record<string, any>): Promise<any> {
    // Initialize with code to optimize
    const code = options?.code ?? this.getDefaultCode();
    return this.encodeState(code);
  }

  private async applyAction(action: OptimizationAction): Promise<{
    newState: any;
    reward: number;
    done: boolean;
  }> {
    // Apply optimization and measure improvement
    const originalPerf = this.measurePerformance();
    await action.transform();
    const newPerf = this.measurePerformance();

    const reward = (originalPerf - newPerf) / originalPerf; // Normalized improvement
    const done = this._elapsedSteps >= 10; // Max 10 optimization steps

    return {
      newState: this.encodeState(action.code),
      reward,
      done,
    };
  }

  private encodeState(code: string): any {
    // Encode code as feature vector
    return {
      features: this.extractFeatures(code),
      metrics: this.calculateMetrics(code),
    };
  }

  private extractFeatures(code: string): number[] {
    // Extract code features (AST, complexity, etc.)
    const features: number[] = [];

    // Length features
    features.push(code.length);
    features.push(code.split('\n').length);

    // Complexity features
    features.push((code.match(/\bif\b/g) ?? []).length);
    features.push((code.match(/\bfor\b/g) ?? []).length);
    features.push((code.match(/\bwhile\b/g) ?? []).length);
    features.push((code.match(/function/g) ?? []).length);

    // Fill to fixed size
    while (features.length < 256) {
      features.push(0);
    }

    return features.slice(0, 256);
  }

  private calculateMetrics(code: string): Record<string, number> {
    return {
      cyclomaticComplexity: this.calculateCyclomaticComplexity(code),
      linesOfCode: code.split('\n').length,
      tokenCount: code.split(/\s+/).length,
    };
  }

  private calculateCyclomaticComplexity(code: string): number {
    let complexity = 1;
    complexity += (code.match(/\bif\b/g) ?? []).length;
    complexity += (code.match(/\bfor\b/g) ?? []).length;
    complexity += (code.match(/\bwhile\b/g) ?? []).length;
    complexity += (code.match(/\bcase\b/g) ?? []).length;
    complexity += (code.match(/\bcatch\b/g) ?? []).length;
    complexity += (code.match(/\?\?/g) ?? []).length;
    return complexity;
  }

  private measurePerformance(): number {
    // Placeholder - would actually measure execution time
    return Math.random() * 100;
  }

  private getDefaultCode(): string {
    return `
function example(arr) {
  let result = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr[i].length; j++) {
      result.push(arr[i][j] * 2);
    }
  }
  return result;
}
`;
  }
}

export interface OptimizationAction {
  name: string;
  transform: () => Promise<void>;
  code: string;
}

/**
 * Bug Fixing Environment
 * Agent learns to fix bugs in code
 */
export class BugFixingEnv extends Env<BugFixState, number> {
  readonly observationSpace: Box;
  readonly actionSpace: Discrete;

  private bugs: BugInstance[];
  private currentBug: BugInstance | null = null;
  private fixes: FixAction[];

  constructor(bugs: BugInstance[], fixes: FixAction[], options: { maxSteps?: number } = {}) {
    super();

    const maxSteps = options.maxSteps ?? 20;

    this.bugs = bugs;
    this.fixes = fixes;

    this.observationSpace = new Box(0, 1, 'float32', [512]);
    this.actionSpace = new Discrete(fixes.length);

    this._metadata = {
      'render.modes': ['human'],
      'max.steps': maxSteps,
    };
  }

  async reset(options?: Record<string, any>): Promise<BugFixState> {
    this.currentBug = this.bugs[Math.floor(Math.random() * this.bugs.length)];
    this._elapsedSteps = 0;

    return {
      buggyCode: this.currentBug.buggyCode,
      error: this.currentBug.errorMessage,
      fixesAttempted: [],
      testResults: this.runTests(this.currentBug.buggyCode),
    };
  }

  async step(action: number): Promise<StepResult<BugFixState>> {
    if (!this.currentBug) {
      throw new Error('Environment not reset');
    }

    this._elapsedSteps++;

    const fix = this.fixes[action];
    const { newCode, fixed, reward } = this.applyFix(fix);

    const newState: BugFixState = {
      buggyCode: newCode,
      error: fixed ? '' : this.currentBug.errorMessage,
      fixesAttempted: [...(this.getCurrentState().fixesAttempted ?? []), fix.name],
      testResults: this.runTests(newCode),
    };

    return {
      observation: newState,
      reward,
      terminated: fixed,
      truncated: this._elapsedSteps >= 20,
      info: {
        fixApplied: fix.name,
        testsPassed: newState.testResults.passed,
        testsTotal: newState.testResults.total,
      },
    };
  }

  private getCurrentState(): BugFixState {
    return {
      buggyCode: this.currentBug?.buggyCode ?? '',
      error: this.currentBug?.errorMessage ?? '',
      fixesAttempted: [],
      testResults: { passed: 0, total: 0, failures: [] },
    };
  }

  private applyFix(fix: FixAction): { newCode: string; fixed: boolean; reward: number } {
    const currentCode = this.currentBug?.buggyCode ?? '';
    const newCode = fix.transform(currentCode);

    const testResults = this.runTests(newCode);
    const fixed = testResults.passed === testResults.total;

    const reward = fixed ? 1.0 : this.calculatePartialReward(testResults);

    return { newCode, fixed, reward };
  }

  private runTests(code: string): TestResults {
    if (!this.currentBug) {
      return { passed: 0, total: 0, failures: [] };
    }

    let passed = 0;
    const failures: string[] = [];

    for (const test of this.currentBug.tests) {
      try {
        const result = eval(test.testCode);
        if (result === test.expected) {
          passed++;
        } else {
          failures.push(test.name);
        }
      } catch {
        failures.push(test.name);
      }
    }

    return { passed, total: this.currentBug.tests.length, failures };
  }

  private calculatePartialReward(testResults: TestResults): number {
    if (testResults.total === 0) return 0;
    return testResults.passed / testResults.total;
  }

  render(mode: 'human' | 'rgb_array' | 'ansi' = 'human'): string {
    if (!this.currentBug) {
      return 'No active episode';
    }

    const state = this.getCurrentState();

    if (mode === 'human') {
      return `
Buggy Code:
${state.buggyCode}

Error: ${state.error}

Tests: ${state.testResults.passed}/${state.testResults.total} passed
Fixes Attempted: ${state.fixesAttempted.join(', ')}
`;
    }

    return JSON.stringify(state);
  }
}

export interface BugFixState {
  buggyCode: string;
  error: string;
  fixesAttempted: string[];
  testResults: TestResults;
}

export interface BugInstance {
  buggyCode: string;
  fixedCode: string;
  errorMessage: string;
  tests: TestCase[];
}

export interface FixAction {
  name: string;
  transform: (code: string) => string;
}

export interface TestCase {
  name: string;
  testCode: string;
  expected: any;
}

export interface TestResults {
  passed: number;
  total: number;
  failures: string[];
}

/**
 * Code Refactoring Environment
 * Agent learns to refactor code for better structure
 */
export class CodeRefactoringEnv extends Env<any, number> {
  readonly observationSpace: Box;
  readonly actionSpace: Discrete;

  private refactors: RefactorAction[];

  constructor(refactors: RefactorAction[], options: { stateSize?: number } = {}) {
    super();

    const stateSize = options.stateSize ?? 256;

    this.refactors = refactors;

    this.observationSpace = new Box(-Infinity, Infinity, 'float32', [stateSize]);
    this.actionSpace = new Discrete(refactors.length);

    this._metadata = {
      'render.modes': ['human'],
    };
  }

  async reset(options?: Record<string, any>): Promise<any> {
    this._elapsedSteps = 0;
    return {
      code: options?.initialCode ?? this.getInitialCode(),
      metrics: this.calculateMetrics(options?.initialCode ?? this.getInitialCode()),
    };
  }

  async step(action: number): Promise<StepResult<any>> {
    this._elapsedSteps++;

    const refactor = this.refactors[action];
    const { newCode, improvement } = this.applyRefactor(refactor);

    const oldMetrics = this.getCurrentMetrics();
    const newMetrics = this.calculateMetrics(newCode);

    const reward = this.calculateReward(oldMetrics, newMetrics);

    return {
      observation: {
        code: newCode,
        metrics: newMetrics,
      },
      reward,
      terminated: this._elapsedSteps >= 10,
      truncated: false,
      info: {
        refactor: refactor.name,
        improvement,
      },
    };
  }

  private applyRefactor(refactor: RefactorAction): { newCode: string; improvement: number } {
    const currentCode = this.getCurrentCode();
    const newCode = refactor.transform(currentCode);

    const oldComplexity = this.calculateComplexity(currentCode);
    const newComplexity = this.calculateComplexity(newCode);
    const improvement = (oldComplexity - newComplexity) / oldComplexity;

    return { newCode, improvement };
  }

  private getCurrentCode(): string {
    return '';
  }

  private getCurrentMetrics(): CodeMetrics {
    return {
      complexity: 0,
      maintainability: 0,
      duplication: 0,
    };
  }

  private calculateMetrics(code: string): CodeMetrics {
    return {
      complexity: this.calculateComplexity(code),
      maintainability: this.calculateMaintainability(code),
      duplication: this.calculateDuplication(code),
    };
  }

  private calculateComplexity(code: string): number {
    let complexity = 1;
    complexity += (code.match(/\bif\b/g) ?? []).length;
    complexity += (code.match(/\bfor\b/g) ?? []).length;
    complexity += (code.match(/\bwhile\b/g) ?? []).length;
    complexity += (code.match(/\bcase\b/g) ?? []).length;
    complexity += (code.match(/\bcatch\b/g) ?? []).length;
    return complexity;
  }

  private calculateMaintainability(code: string): number {
    const lines = code.split('\n').length;
    const complexity = this.calculateComplexity(code);
    return 1000 / (lines * complexity + 1);
  }

  private calculateDuplication(code: string): number {
    // Simplified duplication check
    const lines = code.split('\n');
    const uniqueLines = new Set(lines);
    return 1 - uniqueLines.size / lines.length;
  }

  private calculateReward(oldMetrics: CodeMetrics, newMetrics: CodeMetrics): number {
    const complexityImprovement = oldMetrics.complexity - newMetrics.complexity;
    const maintainabilityImprovement = newMetrics.maintainability - oldMetrics.maintainability;
    const duplicationImprovement = oldMetrics.duplication - newMetrics.duplication;

    return complexityImprovement * 0.5 + maintainabilityImprovement * 0.3 + duplicationImprovement * 0.2;
  }

  private getInitialCode(): string {
    return `
function process(arr) {
  let result = [];
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > 0) {
      result.push(arr[i] * 2);
    }
  }
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < 0) {
      result.push(arr[i] * 3);
    }
  }
  return result;
}
`;
  }

  render(mode: 'human' | 'rgb_array' | 'ansi' = 'human'): string {
    return `Refactoring Environment - Step ${this._elapsedSteps}`;
  }
}

export interface RefactorAction {
  name: string;
  transform: (code: string) => string;
}

export interface CodeMetrics {
  complexity: number;
  maintainability: number;
  duplication: number;
}

/**
 * Test Generation Environment
 * Agent learns to generate comprehensive tests
 */
export class TestGenerationEnv extends Env<any, number> {
  readonly observationSpace: Box;
  readonly actionSpace: Discrete;

  constructor(
    vocab: string[],
    options: {
      maxCodeLength?: number;
      maxTestLength?: number;
    } = {}
  ) {
    super();

    const maxCodeLength = options.maxCodeLength ?? 512;
    const maxTestLength = options.maxTestLength ?? 256;

    this.observationSpace = new Box(0, vocab.length - 1, 'int32', [maxCodeLength + maxTestLength]);
    this.actionSpace = new Discrete(vocab.length);

    this._metadata = {
      'render.modes': ['human'],
    };
  }

  async reset(options?: Record<string, any>): Promise<any> {
    this._elapsedSteps = 0;
    return {
      code: options?.code ?? this.getExampleCode(),
      tests: [],
      coverage: 0,
    };
  }

  async step(action: number): Promise<StepResult<any>> {
    this._elapsedSteps++;

    const test = this.generateTest(action);
    const { passed, coverage, reward } = this.evaluateTest(test);

    return {
      observation: {
        code: this.getCurrentCode(),
        tests: [...(this.getCurrentTests() ?? []), test],
        coverage,
      },
      reward,
      terminated: coverage >= 0.8,
      truncated: this._elapsedSteps >= 20,
      info: {
        test,
        passed,
        coverage,
      },
    };
  }

  private getCurrentCode(): string {
    return this.getExampleCode();
  }

  private getCurrentTests(): string[] {
    return [];
  }

  private generateTest(action: number): string {
    // Generate test based on action
    return `assert.strictEqual(result, expected);`;
  }

  private evaluateTest(test: string): { passed: boolean; coverage: number; reward: number } {
    // Run test and calculate coverage
    const passed = Math.random() > 0.3;
    const coverage = Math.random();

    const reward = passed ? 0.5 + coverage * 0.5 : -0.1;

    return { passed, coverage, reward };
  }

  private getExampleCode(): string {
    return `
function add(a, b) {
  return a + b;
}
`;
  }

  render(mode: 'human' | 'rgb_array' | 'ansi' = 'human'): string {
    return `Test Generation Environment - Step ${this._elapsedSteps}`;
  }
}

export interface CodeSnippet {
  prefix: string;
  target: string;
  metadata?: Record<string, any>;
}
