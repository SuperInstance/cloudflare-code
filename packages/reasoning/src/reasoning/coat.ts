/**
 * Chain-of-Thought (CoT) Reasoning Engine
 *
 * Implements multi-step reasoning with intermediate step tracking,
 * self-consistency checking, and confidence estimation.
 */

import type {
  ReasoningStep,
  ChainOfThoughtConfig,
  ChainOfThoughtResult,
  CoTIntermediateStep,
  SelfConsistencyConfig,
  SelfConsistencyResult,
  Sample,
  ReasoningError,
} from '../types';

// ============================================================================
// Chain-of-Thought Core Engine
// ============================================================================

export class ChainOfThoughtEngine {
  private config: Required<ChainOfThoughtConfig>;

  constructor(config: ChainOfThoughtConfig = {}) {
    this.config = {
      maxSteps: config.maxSteps ?? 10,
      temperature: config.temperature ?? 0.7,
      verbose: config.verbose ?? false,
      includeIntermediateSteps: config.includeIntermediateSteps ?? true,
      selfConsistencySamples: config.selfConsistencySamples ?? 1,
      confidenceThreshold: config.confidenceThreshold ?? 0.5,
    };
  }

  /**
   * Perform chain-of-thought reasoning on a given problem
   */
  async reason(
    problem: string,
    context?: string
  ): Promise<ChainOfThoughtResult> {
    const startTime = Date.now();
    const reasoningChain: ReasoningStep[] = [];

    try {
      // Generate reasoning chain
      const steps = await this.generateReasoningChain(problem, context);

      // Apply confidence filtering if threshold is set
      const filteredSteps = this.filterByConfidence(steps);

      reasoningChain.push(...filteredSteps);

      // Extract final answer from the last step
      const finalAnswer = this.extractFinalAnswer(filteredSteps);

      // Calculate overall confidence
      const confidence = this.calculateOverallConfidence(filteredSteps);

      const executionTime = Date.now() - startTime;

      return {
        finalAnswer,
        reasoningChain: filteredSteps,
        confidence,
        metadata: {
          totalSteps: filteredSteps.length,
          executionTime,
          tokensUsed: undefined, // Can be populated by actual LLM calls
        },
      };
    } catch (error) {
      throw this.createError(
        'Chain-of-thought reasoning failed',
        'COT_REASONING_FAILED',
        { problem, error }
      );
    }
  }

  /**
   * Generate reasoning chain with intermediate steps
   */
  private async generateReasoningChain(
    problem: string,
    context?: string
  ): Promise<ReasoningStep[]> {
    const steps: ReasoningStep[] = [];
    let currentThought = this.buildInitialPrompt(problem, context);

    for (let i = 0; i < this.config.maxSteps; i++) {
      const step = await this.generateStep(currentThought, i);
      steps.push(step);

      // Check if we've reached a conclusion
      if (this.isConclusion(step.content)) {
        break;
      }

      currentThought = step.content;
    }

    return steps;
  }

  /**
   * Generate a single reasoning step
   */
  private async generateStep(
    previousThought: string,
    stepNumber: number
  ): Promise<ReasoningStep> {
    // In a real implementation, this would call an LLM
    // For now, we simulate the step generation
    const content = await this.simulateStepGeneration(
      previousThought,
      stepNumber
    );

    const confidence = this.estimateConfidence(content);

    return {
      id: this.generateStepId(stepNumber),
      timestamp: Date.now(),
      content,
      confidence,
      metadata: {
        stepNumber,
        temperature: this.config.temperature,
      },
    };
  }

  /**
   * Simulate step generation (placeholder for actual LLM call)
   */
  private async simulateStepGeneration(
    previousThought: string,
    stepNumber: number
  ): Promise<string> {
    // This would be replaced with actual LLM API call
    return `Step ${stepNumber + 1}: Analyzing the problem based on previous reasoning.`;
  }

  /**
   * Build initial prompt with problem and context
   */
  private buildInitialPrompt(problem: string, context?: string): string {
    let prompt = `Problem: ${problem}\n\n`;

    if (context) {
      prompt += `Context: ${context}\n\n`;
    }

    prompt += `Let's think through this step by step:`;

    return prompt;
  }

  /**
   * Check if a step represents a conclusion
   */
  private isConclusion(content: string): boolean {
    const conclusionMarkers = [
      'therefore',
      'thus',
      'consequently',
      'in conclusion',
      'final answer',
      'answer:',
      'solution:',
    ];

    const lowerContent = content.toLowerCase();
    return conclusionMarkers.some((marker) => lowerContent.includes(marker));
  }

  /**
   * Extract final answer from reasoning chain
   */
  private extractFinalAnswer(steps: ReasoningStep[]): string {
    if (steps.length === 0) {
      return '';
    }

    const lastStep = steps[steps.length - 1];

    // Try to extract answer after common answer markers
    const answerPatterns = [
      /answer:\s*(.+)$/i,
      /solution:\s*(.+)$/i,
      /therefore,?\s*(.+)$/i,
      /thus,?\s*(.+)$/i,
      /final answer:?\s*(.+)$/i,
    ];

    for (const pattern of answerPatterns) {
      const match = lastStep.content.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // If no pattern matches, return the last step's content
    return lastStep.content;
  }

  /**
   * Filter steps by confidence threshold
   */
  private filterByConfidence(steps: ReasoningStep[]): ReasoningStep[] {
    return steps.filter(
      (step) =>
        step.confidence === undefined ||
        step.confidence >= this.config.confidenceThreshold
    );
  }

  /**
   * Calculate overall confidence from all steps
   */
  private calculateOverallConfidence(steps: ReasoningStep[]): number {
    if (steps.length === 0) {
      return 0;
    }

    const confidences = steps
      .map((step) => step.confidence ?? 0.5)
      .filter((c) => c > 0);

    if (confidences.length === 0) {
      return 0.5;
    }

    // Use weighted average, giving more weight to later steps
    const weights = confidences.map((_, i) => (i + 1) / confidences.length);
    const weightedSum = confidences.reduce(
      (sum, conf, i) => sum + conf * weights[i],
      0
    );
    const weightSum = weights.reduce((sum, w) => sum + w, 0);

    return weightedSum / weightSum;
  }

  /**
   * Estimate confidence of a reasoning step
   */
  private estimateConfidence(content: string): number {
    // Simple heuristic-based confidence estimation
    // In production, this would use a more sophisticated model

    let confidence = 0.5;

    // Increase confidence for certain linguistic markers
    const certainPhrases = [
      'clearly',
      'obviously',
      'definitely',
      'certainly',
      'undoubtedly',
      'must be',
    ];

    const uncertainPhrases = [
      'maybe',
      'perhaps',
      'possibly',
      'might be',
      'could be',
      'uncertain',
      'unsure',
    ];

    const lowerContent = content.toLowerCase();

    for (const phrase of certainPhrases) {
      if (lowerContent.includes(phrase)) {
        confidence += 0.1;
      }
    }

    for (const phrase of uncertainPhrases) {
      if (lowerContent.includes(phrase)) {
        confidence -= 0.1;
      }
    }

    // Increase confidence for structured reasoning
    if (content.includes('because') || content.includes('since')) {
      confidence += 0.05;
    }

    if (content.includes('therefore') || content.includes('thus')) {
      confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Generate unique step ID
   */
  private generateStepId(stepNumber: number): string {
    return `step_${stepNumber}_${Date.now()}`;
  }

  /**
   * Create error with proper type
   */
  private createError(
    message: string,
    code: string,
    details?: Record<string, unknown>
  ): ReasoningError {
    const error = new Error(message) as ReasoningError;
    error.name = 'ReasoningError';
    error.code = code;
    error.details = details;
    return error;
  }
}

// ============================================================================
// Self-Consistency Reasoning
// ============================================================================

export class SelfConsistencyEngine {
  private config: Required<SelfConsistencyConfig>;

  constructor(config: SelfConsistencyConfig) {
    this.config = {
      samples: config.samples,
      temperature: config.temperature,
      aggregationMethod: config.aggregationMethod ?? 'majority',
      diversityThreshold: config.diversityThreshold ?? 0.3,
      confidenceWeighting: config.confidenceWeighting ?? true,
    };
  }

  /**
   * Perform self-consistency reasoning with multiple samples
   */
  async reason(problem: string, context?: string): Promise<SelfConsistencyResult> {
    const startTime = Date.now();
    const samples: Sample[] = [];

    // Generate multiple reasoning samples
    for (let i = 0; i < this.config.samples; i++) {
      const sample = await this.generateSample(problem, context, i);
      samples.push(sample);
    }

    // Aggregate samples based on configured method
    const { finalAnswer, consensus } = this.aggregateSamples(samples);

    // Calculate disagreement metric
    const disagreement = this.calculateDisagreement(samples);

    const executionTime = Date.now() - startTime;

    return {
      finalAnswer,
      samples,
      consensus,
      disagreement,
      metadata: {
        totalSamples: this.config.samples,
        uniqueAnswers: this.countUniqueAnswers(samples),
        majorityCount: this.getMajorityCount(samples, finalAnswer),
        executionTime,
      },
    };
  }

  /**
   * Generate a single reasoning sample
   */
  private async generateSample(
    problem: string,
    context: string | undefined,
    sampleIndex: number
  ): Promise<Sample> {
    const cotEngine = new ChainOfThoughtEngine({
      temperature: this.config.temperature,
      includeIntermediateSteps: true,
    });

    const result = await cotEngine.reason(problem, context);

    return {
      answer: result.finalAnswer,
      confidence: result.confidence,
      reasoning: result.reasoningChain
        .map((step) => step.content)
        .join('\n\n'),
      timestamp: Date.now(),
    };
  }

  /**
   * Aggregate samples to determine final answer
   */
  private aggregateSamples(samples: Sample[]): {
    finalAnswer: string;
    consensus: number;
  } {
    const answerGroups = this.groupAnswers(samples);

    switch (this.config.aggregationMethod) {
      case 'majority':
        return this.majorityVote(answerGroups, samples);
      case 'weighted':
        return this.weightedVote(answerGroups, samples);
      case 'ranked':
        return this.rankedChoice(answerGroups, samples);
      default:
        return this.majorityVote(answerGroups, samples);
    }
  }

  /**
   * Group similar answers together
   */
  private groupAnswers(samples: Sample[]): Map<string, Sample[]> {
    const groups = new Map<string, Sample[]>();

    for (const sample of samples) {
      const normalizedAnswer = this.normalizeAnswer(sample.answer);
      const similarKey = this.findSimilarGroup(normalizedAnswer, groups);

      if (similarKey) {
        groups.get(similarKey)!.push(sample);
      } else {
        groups.set(normalizedAnswer, [sample]);
      }
    }

    return groups;
  }

  /**
   * Normalize answer for comparison
   */
  private normalizeAnswer(answer: string): string {
    return answer
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
  }

  /**
   * Find existing group with similar answer
   */
  private findSimilarGroup(
    answer: string,
    groups: Map<string, Sample[]>
  ): string | null {
    for (const [key, groupSamples] of groups.entries()) {
      const similarity = this.calculateSimilarity(answer, key);
      if (similarity >= 1 - this.config.diversityThreshold) {
        return key;
      }
    }
    return null;
  }

  /**
   * Calculate similarity between two answers
   */
  private calculateSimilarity(answer1: string, answer2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(answer1.split(' '));
    const words2 = new Set(answer2.split(' '));

    const intersection = new Set(
      [...words1].filter((word) => words2.has(word))
    );
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Majority vote aggregation
   */
  private majorityVote(
    groups: Map<string, Sample[]>,
    samples: Sample[]
  ): { finalAnswer: string; consensus: number } {
    let maxGroup: [string, Sample[]] | null = null;
    let maxSize = 0;

    for (const [answer, groupSamples] of groups.entries()) {
      if (groupSamples.length > maxSize) {
        maxSize = groupSamples.length;
        maxGroup = [answer, groupSamples];
      }
    }

    const consensus = maxGroup ? maxSize / samples.length : 0;
    const finalAnswer = maxGroup ? maxGroup[1][0].answer : '';

    return { finalAnswer, consensus };
  }

  /**
   * Weighted vote aggregation (by confidence)
   */
  private weightedVote(
    groups: Map<string, Sample[]>,
    samples: Sample[]
  ): { finalAnswer: string; consensus: number } {
    const groupWeights = new Map<string, number>();

    for (const [answer, groupSamples] of groups.entries()) {
      let totalWeight = 0;
      for (const sample of groupSamples) {
        totalWeight += this.config.confidenceWeighting
          ? sample.confidence
          : 1;
      }
      groupWeights.set(answer, totalWeight);
    }

    let maxWeight = 0;
    let finalAnswer = '';

    for (const [answer, weight] of groupWeights.entries()) {
      if (weight > maxWeight) {
        maxWeight = weight;
        finalAnswer = groups.get(answer)![0].answer;
      }
    }

    const totalWeight = Array.from(groupWeights.values()).reduce(
      (sum, w) => sum + w,
      0
    );
    const consensus = totalWeight > 0 ? maxWeight / totalWeight : 0;

    return { finalAnswer, consensus };
  }

  /**
   * Ranked choice aggregation
   */
  private rankedChoice(
    groups: Map<string, Sample[]>,
    samples: Sample[]
  ): { finalAnswer: string; consensus: number } {
    // Sort samples by confidence
    const sortedSamples = [...samples].sort((a, b) => b.confidence - a.confidence);

    // Transferable vote system
    const quota = Math.floor(samples.length / 2) + 1;
    const tallies = new Map<string, number>();

    for (const sample of sortedSamples) {
      const answer = this.normalizeAnswer(sample.answer);
      const count = (tallies.get(answer) ?? 0) + 1;
      tallies.set(answer, count);

      if (count >= quota) {
        const groupSize = groups.get(answer)?.length ?? 0;
        return {
          finalAnswer: sample.answer,
          consensus: groupSize / samples.length,
        };
      }
    }

    // If no quota reached, use plurality
    return this.majorityVote(groups, samples);
  }

  /**
   * Calculate disagreement metric
   */
  private calculateDisagreement(samples: Sample[]): number {
    const groups = this.groupAnswers(samples);
    const totalGroups = groups.size;

    if (totalGroups <= 1) {
      return 0;
    }

    // Calculate entropy-based disagreement
    const probabilities = Array.from(groups.values()).map(
      (group) => group.length / samples.length
    );

    const entropy = -probabilities.reduce(
      (sum, p) => sum + p * Math.log2(p),
      0
    );

    const maxEntropy = Math.log2(totalGroups);
    return entropy / maxEntropy;
  }

  /**
   * Count unique answers
   */
  private countUniqueAnswers(samples: Sample[]): number {
    const uniqueAnswers = new Set(
      samples.map((s) => this.normalizeAnswer(s.answer))
    );
    return uniqueAnswers.size;
  }

  /**
   * Get majority count
   */
  private getMajorityCount(samples: Sample[], finalAnswer: string): number {
    const normalizedFinal = this.normalizeAnswer(finalAnswer);
    return samples.filter(
      (s) => this.normalizeAnswer(s.answer) === normalizedFinal
    ).length;
  }
}

// ============================================================================
// Intermediate Step Tracking
// ============================================================================

export class StepTracker {
  private steps: CoTIntermediateStep[] = [];

  /**
   * Add a reasoning step
   */
  addStep(
    thought: string,
    action?: string,
    observation?: string,
    confidence: number = 0.5
  ): void {
    this.steps.push({
      step: this.steps.length + 1,
      thought,
      action,
      observation,
      confidence,
    });
  }

  /**
   * Get all steps
   */
  getSteps(): CoTIntermediateStep[] {
    return [...this.steps];
  }

  /**
   * Get step by number
   */
  getStep(stepNumber: number): CoTIntermediateStep | undefined {
    return this.steps.find((s) => s.step === stepNumber);
  }

  /**
   * Get last N steps
   */
  getLastSteps(n: number): CoTIntermediateStep[] {
    return this.steps.slice(-n);
  }

  /**
   * Clear all steps
   */
  clear(): void {
    this.steps = [];
  }

  /**
   * Get step statistics
   */
  getStatistics(): {
    totalSteps: number;
    averageConfidence: number;
    actionsTaken: number;
    observations: number;
  } {
    const totalSteps = this.steps.length;
    const averageConfidence =
      totalSteps > 0
        ? this.steps.reduce((sum, s) => sum + s.confidence, 0) / totalSteps
        : 0;
    const actionsTaken = this.steps.filter((s) => s.action).length;
    const observations = this.steps.filter((s) => s.observation).length;

    return {
      totalSteps,
      averageConfidence,
      actionsTaken,
      observations,
    };
  }

  /**
   * Export steps as formatted text
   */
  exportAsText(): string {
    return this.steps
      .map((step) => {
        let output = `Step ${step.step}:\n`;
        output += `  Thought: ${step.thought}\n`;
        if (step.action) {
          output += `  Action: ${step.action}\n`;
        }
        if (step.observation) {
          output += `  Observation: ${step.observation}\n`;
        }
        output += `  Confidence: ${(step.confidence * 100).toFixed(1)}%\n`;
        return output;
      })
      .join('\n');
  }

  /**
   * Export steps as JSON
   */
  exportAsJSON(): string {
    return JSON.stringify(this.steps, null, 2);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate chain-of-thought configuration
 */
export function validateCoTConfig(
  config: ChainOfThoughtConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.maxSteps !== undefined && config.maxSteps < 1) {
    errors.push('maxSteps must be at least 1');
  }

  if (config.temperature !== undefined) {
    if (config.temperature < 0 || config.temperature > 2) {
      errors.push('temperature must be between 0 and 2');
    }
  }

  if (config.confidenceThreshold !== undefined) {
    if (config.confidenceThreshold < 0 || config.confidenceThreshold > 1) {
      errors.push('confidenceThreshold must be between 0 and 1');
    }
  }

  if (
    config.selfConsistencySamples !== undefined &&
    config.selfConsistencySamples < 1
  ) {
    errors.push('selfConsistencySamples must be at least 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extract reasoning steps from text
 */
export function extractReasoningSteps(text: string): string[] {
  const stepPatterns = [
    /(?:Step\s+\d+:|(?:\d+\.?\s+))/gi,
    /(?:Therefore|Thus|Consequently|So)/gi,
  ];

  const steps: string[] = [];
  const lines = text.split('\n');
  let currentStep = '';

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      if (currentStep) {
        steps.push(currentStep.trim());
        currentStep = '';
      }
      continue;
    }

    const isNewStep = stepPatterns.some((pattern) =>
      pattern.test(trimmedLine)
    );

    if (isNewStep && currentStep) {
      steps.push(currentStep.trim());
      currentStep = trimmedLine;
    } else {
      currentStep += (currentStep ? ' ' : '') + trimmedLine;
    }
  }

  if (currentStep) {
    steps.push(currentStep.trim());
  }

  return steps;
}

/**
 * Calculate reasoning chain quality score
 */
export function calculateChainQuality(
  steps: ReasoningStep[]
): {
  score: number;
  coherence: number;
  depth: number;
  confidence: number;
} {
  if (steps.length === 0) {
    return { score: 0, coherence: 0, depth: 0, confidence: 0 };
  }

  // Coherence: how well steps connect
  let coherence = 0;
  for (let i = 1; i < steps.length; i++) {
    const prevContent = steps[i - 1].content.toLowerCase();
    const currContent = steps[i].content.toLowerCase();

    // Check for connective phrases
    const connectors = [
      'therefore',
      'thus',
      'because',
      'since',
      'consequently',
      'however',
      'moreover',
      'furthermore',
    ];

    const hasConnection = connectors.some((c) =>
      currContent.includes(c)
    );

    if (hasConnection) {
      coherence += 1;
    }
  }
  coherence = coherence / Math.max(1, steps.length - 1);

  // Depth: number of meaningful steps
  const depth = steps.length;

  // Confidence: average confidence across steps
  const confidence =
    steps.reduce((sum, step) => sum + (step.confidence ?? 0.5), 0) /
    steps.length;

  // Overall score: weighted combination
  const score = coherence * 0.4 + Math.min(depth / 10, 1) * 0.3 + confidence * 0.3;

  return {
    score: Math.min(1, score),
    coherence,
    depth: Math.min(depth / 10, 1),
    confidence,
  };
}
