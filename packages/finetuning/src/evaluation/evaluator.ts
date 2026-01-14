/**
 * Model Evaluator
 *
 * Comprehensive model evaluation system including:
 * - Benchmark suite with standard metrics
 * - Metric calculation and aggregation
 * - A/B testing framework
 * - Model comparison and analysis
 * - Error analysis and insights
 * - Performance profiling
 * - Leaderboard tracking and ranking
 */

import type { ModelMetrics, Evaluation, EvaluationResult } from '../types';

// ============================================================================
// Metrics Calculator
// ============================================================================

export interface MetricConfig {
  name: string;
  type: 'loss' | 'accuracy' | 'perplexity' | 'bleu' | 'rouge' | 'custom';
  direction: 'lower_is_better' | 'higher_is_better';
  threshold?: number;
  weight?: number;
}

export interface MetricResult {
  name: string;
  value: number;
  confidence: [number, number]; // [lower, upper]
  samples: number;
  metadata?: Record<string, any>;
}

export class MetricsCalculator {
  /**
   * Calculate loss metric
   */
  static calculateLoss(
    predictions: number[][],
    targets: number[][],
    reduction: 'mean' | 'sum' | 'none' = 'mean'
  ): number {
    let totalLoss = 0;
    let totalCount = 0;

    for (let i = 0; i < predictions.length; i++) {
      for (let j = 0; j < predictions[i].length; j++) {
        const diff = predictions[i][j] - targets[i][j];
        totalLoss += diff * diff;
        totalCount++;
      }
    }

    return reduction === 'mean' ? totalLoss / totalCount : totalLoss;
  }

  /**
   * Calculate cross-entropy loss
   */
  static calculateCrossEntropyLoss(
    logits: number[][],
    targets: number[]
  ): number {
    let totalLoss = 0;

    for (let i = 0; i < logits.length; i++) {
      const logit = logits[i];
      const target = targets[i];

      // Softmax
      const maxLogit = Math.max(...logit);
      const expLogits = logit.map(l => Math.exp(l - maxLogit));
      const sumExp = expLogits.reduce((a, b) => a + b, 0);
      const probs = expLogits.map(e => e / sumExp);

      // Cross-entropy
      totalLoss -= Math.log(probs[target] + 1e-10);
    }

    return totalLoss / logits.length;
  }

  /**
   * Calculate accuracy
   */
  static calculateAccuracy(
    predictions: number[],
    targets: number[]
  ): number {
    let correct = 0;
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === targets[i]) {
        correct++;
      }
    }
    return correct / predictions.length;
  }

  /**
   * Calculate top-k accuracy
   */
  static calculateTopKAccuracy(
    logits: number[][],
    targets: number[],
    k: number
  ): number {
    let correct = 0;

    for (let i = 0; i < logits.length; i++) {
      const sorted = logits[i]
        .map((logit, idx) => ({ logit, idx }))
        .sort((a, b) => b.logit - a.logit);

      const topK = sorted.slice(0, k).map(s => s.idx);
      if (topK.includes(targets[i])) {
        correct++;
      }
    }

    return correct / logits.length;
  }

  /**
   * Calculate perplexity
   */
  static calculatePerplexity(crossEntropyLoss: number): number {
    return Math.exp(crossEntropyLoss);
  }

  /**
   * Calculate BLEU score
   */
  static calculateBLEU(
    predictions: string[],
    references: string[][],
    maxOrder: number = 4
  ): number {
    const precisions: number[] = [];

    for (let n = 1; n <= maxOrder; n++) {
      let matches = 0;
      let total = 0;

      for (let i = 0; i < predictions.length; i++) {
        const predNGrams = this.getNGrams(predictions[i], n);
        const refNGramsList = references[i].map(r => this.getNGrams(r, n));

        for (const [ngram, count] of predNGrams) {
          const maxRefCount = Math.max(
            ...refNGramsList.map(refNGrams => refNGrams.get(ngram) || 0)
          );
          matches += Math.min(count, maxRefCount);
          total += count;
        }
      }

      if (total > 0) {
        precisions.push(matches / total);
      } else {
        precisions.push(0);
      }
    }

    // Geometric mean
    const logPrecisions = precisions.map(p => Math.log(p + 1e-10));
    const avgLogPrecision =
      logPrecisions.reduce((a, b) => a + b, 0) / maxOrder;
    const geometricMean = Math.exp(avgLogPrecision);

    // Brevity penalty
    const predLengths = predictions.map(p => p.split(/\s+/).length);
    const refLengths = references.map(r =>
      Math.min(...r.map(ref => ref.split(/\s+/).length))
    );

    const totalPredLength = predLengths.reduce((a, b) => a + b, 0);
    const totalRefLength = refLengths.reduce((a, b) => a + b, 0);

    const brevityPenalty =
      totalPredLength < totalRefLength
        ? Math.exp(1 - totalRefLength / totalPredLength)
        : 1;

    return brevityPenalty * geometricMean;
  }

  /**
   * Calculate ROUGE score
   */
  static calculateROUGE(
    predictions: string[],
    references: string[]
  ): { rouge1: number; rouge2: number; rougeL: number } {
    let rouge1Sum = 0;
    let rouge2Sum = 0;
    let rougeLSum = 0;

    for (let i = 0; i < predictions.length; i++) {
      const predTokens = predictions[i].split(/\s+/);
      const refTokens = references[i].split(/\s+/);

      rouge1Sum += this.calculateROUGEN(predTokens, refTokens, 1);
      rouge2Sum += this.calculateROUGEN(predTokens, refTokens, 2);
      rougeLSum += this.calculateROUGEL(predictions[i], references[i]);
    }

    const n = predictions.length;
    return {
      rouge1: rouge1Sum / n,
      rouge2: rouge2Sum / n,
      rougeL: rougeLSum / n,
    };
  }

  private static calculateROUGEN(
    prediction: string[],
    reference: string[],
    n: number
  ): number {
    const predNGrams = this.getNGramsFromArray(prediction, n);
    const refNGrams = this.getNGramsFromArray(reference, n);

    let overlap = 0;
    for (const [ngram, count] of predNGrams) {
      overlap += Math.min(count, refNGrams.get(ngram) || 0);
    }

    const predCount = Array.from(predNGrams.values()).reduce((a, b) => a + b, 0);
    const refCount = Array.from(refNGrams.values()).reduce((a, b) => a + b, 0);

    const precision = predCount > 0 ? overlap / predCount : 0;
    const recall = refCount > 0 ? overlap / refCount : 0;

    return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  }

  private static calculateROUGEL(prediction: string, reference: string): number {
    const predTokens = prediction.split(/\s+/);
    const refTokens = reference.split(/\s+/);

    const lcs = this.longestCommonSubsequence(predTokens, refTokens);

    const precision = predTokens.length > 0 ? lcs / predTokens.length : 0;
    const recall = refTokens.length > 0 ? lcs / refTokens.length : 0;

    return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  }

  private static longestCommonSubsequence(arr1: string[], arr2: string[]): number {
    const m = arr1.length;
    const n = arr2.length;
    const dp: number[][] = Array(m + 1)
      .fill(0)
      .map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (arr1[i - 1] === arr2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  private static getNGrams(text: string, n: number): Map<string, number> {
    const tokens = text.split(/\s+/);
    return this.getNGramsFromArray(tokens, n);
  }

  private static getNGramsFromArray(
    tokens: string[],
    n: number
  ): Map<string, number> {
    const ngrams = new Map<string, number>();

    for (let i = 0; i <= tokens.length - n; i++) {
      const ngram = tokens.slice(i, i + n).join(' ');
      ngrams.set(ngram, (ngrams.get(ngram) || 0) + 1);
    }

    return ngrams;
  }

  /**
   * Calculate F1 score
   */
  static calculateF1(
    predictions: number[],
    targets: number[],
    positiveLabel: number = 1
  ): number {
    let tp = 0, fp = 0, fn = 0;

    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === positiveLabel && targets[i] === positiveLabel) {
        tp++;
      } else if (predictions[i] === positiveLabel && targets[i] !== positiveLabel) {
        fp++;
      } else if (predictions[i] !== positiveLabel && targets[i] === positiveLabel) {
        fn++;
      }
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;

    return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  }

  /**
   * Calculate confidence interval using bootstrap
   */
  static calculateConfidenceInterval(
    values: number[],
    confidence: number = 0.95
  ): [number, number] {
    const n = values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const lowerIndex = Math.floor((1 - confidence) / 2 * n);
    const upperIndex = Math.ceil((1 + confidence) / 2 * n);

    return [sorted[lowerIndex], sorted[upperIndex]];
  }

  /**
   * Calculate all metrics for a model
   */
  static calculateAllMetrics(
    predictions: string[],
    references: string[][],
    config?: MetricConfig[]
  ): MetricResult[] {
    const results: MetricResult[] = [];

    // BLEU
    const bleu = this.calculateBLEU(predictions, references);
    results.push({
      name: 'bleu',
      value: bleu,
      confidence: [bleu * 0.9, bleu * 1.1], // Approximate
      samples: predictions.length,
    });

    // ROUGE
    const rouge = this.calculateROUGE(predictions, references.map(r => r[0]));
    results.push({
      name: 'rouge1',
      value: rouge.rouge1,
      confidence: [rouge.rouge1 * 0.9, rouge.rouge1 * 1.1],
      samples: predictions.length,
    });

    return results;
  }
}

// ============================================================================
// A/B Testing Framework
// ============================================================================

export interface ABTestConfig {
  name: string;
  description?: string;
  modelA: string;
  modelB: string;
  dataset: string;
  metrics: string[];
  sampleSize: number;
  significanceLevel: number;
  minEffectSize: number;
}

export interface ABTestResult {
  testId: string;
  config: ABTestConfig;
  status: 'pending' | 'running' | 'completed';
  results: {
    modelA: ModelMetrics;
    modelB: ModelMetrics;
    differences: Record<string, number>;
    significance: Record<string, {
      pValue: number;
      significant: boolean;
      confidenceInterval: [number, number];
    }>;
  };
  winner?: 'modelA' | 'modelB' | 'tie';
  recommendation?: string;
  startedAt?: number;
  completedAt?: number;
}

export class ABTester {
  private tests: Map<string, ABTestResult> = new Map();

  /**
   * Create a new A/B test
   */
  createTest(config: ABTestConfig): ABTestResult {
    const test: ABTestResult = {
      testId: this.generateTestId(),
      config,
      status: 'pending',
      results: {
        modelA: { loss: 0 },
        modelB: { loss: 0 },
        differences: {},
        significance: {},
      },
    };

    this.tests.set(test.testId, test);
    return test;
  }

  /**
   * Run an A/B test
   */
  async runTest(testId: string): Promise<ABTestResult> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    test.status = 'running';
    test.startedAt = Date.now();

    // In production, this would run actual inference and evaluation
    // For now, simulate results
    test.results.modelA = {
      loss: 0.8 + Math.random() * 0.2,
      accuracy: 0.85 + Math.random() * 0.1,
      validationLoss: 0.85 + Math.random() * 0.2,
      validationAccuracy: 0.82 + Math.random() * 0.1,
    };

    test.results.modelB = {
      loss: 0.75 + Math.random() * 0.2,
      accuracy: 0.88 + Math.random() * 0.1,
      validationLoss: 0.8 + Math.random() * 0.2,
      validationAccuracy: 0.85 + Math.random() * 0.1,
    };

    // Calculate differences
    for (const metric of test.config.metrics) {
      const valueA = test.results.modelA[metric as keyof ModelMetrics] as number;
      const valueB = test.results.modelB[metric as keyof ModelMetrics] as number;
      test.results.differences[metric] = valueB - valueA;

      // Run statistical test
      const significance = this.performTTest(
        [valueA],
        [valueB],
        test.config.significanceLevel
      );
      test.results.significance[metric] = significance;
    }

    // Determine winner
    test.winner = this.determineWinner(test);
    test.recommendation = this.generateRecommendation(test);

    test.status = 'completed';
    test.completedAt = Date.now();

    return test;
  }

  /**
   * Get test by ID
   */
  getTest(testId: string): ABTestResult | undefined {
    return this.tests.get(testId);
  }

  /**
   * Get all tests
   */
  getTests(): ABTestResult[] {
    return Array.from(this.tests.values());
  }

  /**
   * Perform two-sample t-test
   */
  private performTTest(
    sampleA: number[],
    sampleB: number[],
    alpha: number
  ): {
    pValue: number;
    significant: boolean;
    confidenceInterval: [number, number];
  } {
    // Calculate means
    const meanA =
      sampleA.reduce((a, b) => a + b, 0) / sampleA.length;
    const meanB =
      sampleB.reduce((a, b) => a + b, 0) / sampleB.length;

    // Calculate variance
    const varA =
      sampleA.reduce((sum, x) => sum + Math.pow(x - meanA, 2), 0) /
      (sampleA.length - 1);
    const varB =
      sampleB.reduce((sum, x) => sum + Math.pow(x - meanB, 2), 0) /
      (sampleB.length - 1);

    // Pooled standard error
    const se = Math.sqrt(varA / sampleA.length + varB / sampleB.length);

    // t-statistic
    const t = (meanB - meanA) / se;

    // Degrees of freedom (Welch-Satterthwaite)
    const df =
      Math.pow(varA / sampleA.length + varB / sampleB.length, 2) /
      (Math.pow(varA / sampleA.length, 2) / (sampleA.length - 1) +
        Math.pow(varB / sampleB.length, 2) / (sampleB.length - 1));

    // p-value (two-tailed)
    const pValue = 2 * (1 - this.tCDF(Math.abs(t), df));

    // Confidence interval
    const ci = [
      (meanB - meanA) - 1.96 * se,
      (meanB - meanA) + 1.96 * se,
    ] as [number, number];

    return {
      pValue,
      significant: pValue < alpha,
      confidenceInterval: ci,
    };
  }

  private tCDF(t: number, df: number): number {
    // Approximation of t-distribution CDF
    // For large df, approximates normal distribution
    if (df > 100) {
      return this.normalCDF(t);
    }
    // For smaller df, use approximation (simplified)
    return this.normalCDF(t);
  }

  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t =
      1.0 /
      (1.0 +
        p *
          x -
          a1 * x * x +
          a2 * x * x * x +
          a3 * x * x * x * x +
          a4 * x * x * x * x * x +
          a5 * x * x * x * x * x * x);

    return 0.5 * (1.0 + sign * (1 - t * t));
  }

  private determineWinner(test: ABTestResult): 'modelA' | 'modelB' | 'tie' {
    let modelAWins = 0;
    let modelBWins = 0;

    for (const [metric, significance] of Object.entries(test.results.significance)) {
      if (significance.significant) {
        const diff = test.results.differences[metric];
        if (diff > 0) {
          modelBWins++;
        } else {
          modelAWins++;
        }
      }
    }

    if (modelBWins > modelAWins) return 'modelB';
    if (modelAWins > modelBWins) return 'modelA';
    return 'tie';
  }

  private generateRecommendation(test: ABTestResult): string {
    if (test.winner === 'modelB') {
      return `Model B (${test.config.modelB}) shows statistically significant improvements. Recommended for deployment.`;
    } else if (test.winner === 'modelA') {
      return `Model A (${test.config.modelA}) performs better. Keep Model A in production.`;
    } else {
      return `No statistically significant difference found. Consider running a longer test or gathering more data.`;
    }
  }

  private generateTestId(): string {
    return `abtest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Error Analysis
// ============================================================================

export interface ErrorAnalysisResult {
  totalErrors: number;
  errorTypes: Record<string, number>;
  errorDistribution: Record<string, number>;
  commonMistakes: Array<{
    pattern: string;
    count: number;
    examples: string[];
  }>;
  severityDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  suggestions: string[];
}

export class ErrorAnalyzer {
  /**
   * Analyze errors in predictions
   */
  static analyzeErrors(
    predictions: string[],
    references: string[],
    inputs?: string[]
  ): ErrorAnalysisResult {
    const errors: Array<{ pred: string; ref: string; input?: string }> = [];

    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] !== references[i]) {
        errors.push({
          pred: predictions[i],
          ref: references[i],
          input: inputs?.[i],
        });
      }
    }

    return {
      totalErrors: errors.length,
      errorTypes: this.classifyErrors(errors),
      errorDistribution: this.calculateErrorDistribution(errors),
      commonMistakes: this.findCommonMistakes(errors),
      severityDistribution: this.calculateSeverity(errors),
      suggestions: this.generateSuggestions(errors),
    };
  }

  private static classifyErrors(
    errors: Array<{ pred: string; ref: string }>
  ): Record<string, number> {
    const types: Record<string, number> = {
      'wrong-length': 0,
      'missing-content': 0,
      'hallucination': 0,
      'format-error': 0,
      'semantic-error': 0,
    };

    for (const error of errors) {
      const predLength = error.pred.split(/\s+/).length;
      const refLength = error.ref.split(/\s+/).length;

      if (Math.abs(predLength - refLength) / refLength > 0.5) {
        types['wrong-length']++;
      }

      if (predLength === 0) {
        types['missing-content']++;
      }

      // Check for hallucination (words in pred not in ref)
      const predWords = new Set(error.pred.toLowerCase().split(/\s+/));
      const refWords = new Set(error.ref.toLowerCase().split(/\s+/));
      const extraWords = [...predWords].filter(w => !refWords.has(w));
      if (extraWords.length > predWords.size * 0.3) {
        types['hallucination']++;
      }

      // Check for format errors
      if (error.pred.includes('[NaN]') || error.pred.includes('[ERROR]')) {
        types['format-error']++;
      }
    }

    // Remaining errors are semantic
    const classified = Object.values(types).reduce((a, b) => a + b, 0);
    types['semantic-error'] = errors.length - classified;

    return types;
  }

  private static calculateErrorDistribution(
    errors: Array<{ pred: string; ref: string }>
  ): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const error of errors) {
      const similarity = this.cosineSimilarity(error.pred, error.ref);
      const bucket = similarity < 0.2 ? 'very-different' : similarity < 0.5 ? 'different' : 'similar';
      distribution[bucket] = (distribution[bucket] || 0) + 1;
    }

    return distribution;
  }

  private static findCommonMistakes(
    errors: Array<{ pred: string; ref: string }>
  ): Array<{ pattern: string; count: number; examples: string[] }> {
    const patterns: Map<string, { count: number; examples: string[] }> = new Map();

    for (const error of errors) {
      // Find common error patterns (simplified)
      if (error.pred.length < error.ref.length * 0.5) {
        const pattern = 'truncation';
        const existing = patterns.get(pattern) || { count: 0, examples: [] };
        existing.count++;
        if (existing.examples.length < 3) {
          existing.examples.push(`Pred: "${error.pred}" | Ref: "${error.ref}"`);
        }
        patterns.set(pattern, existing);
      }
    }

    return Array.from(patterns.entries()).map(([pattern, data]) => ({
      pattern,
      count: data.count,
      examples: data.examples,
    }));
  }

  private static calculateSeverity(
    errors: Array<{ pred: string; ref: string }>
  ): { critical: number; high: number; medium: number; low: number } {
    let critical = 0, high = 0, medium = 0, low = 0;

    for (const error of errors) {
      const similarity = this.cosineSimilarity(error.pred, error.ref);

      if (similarity < 0.2) {
        critical++;
      } else if (similarity < 0.4) {
        high++;
      } else if (similarity < 0.6) {
        medium++;
      } else {
        low++;
      }
    }

    return { critical, high, medium, low };
  }

  private static generateSuggestions(
    errors: Array<{ pred: string; ref: string }>
  ): string[] {
    const suggestions: string[] = [];

    const errorTypes = this.classifyErrors(errors);

    if (errorTypes['wrong-length'] > errors.length * 0.2) {
      suggestions.push(
        'Consider adjusting the model\'s length penalty or max tokens parameter'
      );
    }

    if (errorTypes['hallucination'] > errors.length * 0.1) {
      suggestions.push(
        'Model is hallucinating content. Consider adding more diverse training data or adjusting temperature'
      );
    }

    if (errorTypes['missing-content'] > errors.length * 0.05) {
      suggestions.push(
        'Model is generating empty responses. Check for training data issues or reduce temperature'
      );
    }

    if (errorTypes['semantic-error'] > errors.length * 0.5) {
      suggestions.push(
        'High semantic error rate. Consider fine-tuning on domain-specific data'
      );
    }

    if (suggestions.length === 0) {
      suggestions.push('Model performance is good. Consider collecting more edge case data for further improvement.');
    }

    return suggestions;
  }

  private static cosineSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = [...set1].filter(x => set2.has(x));
    const union = new Set([...set1, ...set2]);

    return union.size === 0 ? 0 : intersection.length / union.size;
  }
}

// ============================================================================
// Benchmark Suite
// ============================================================================

export interface Benchmark {
  id: string;
  name: string;
  description: string;
  category: 'text-generation' | 'classification' | 'qa' | 'summarization' | 'translation';
  dataset: string;
  metrics: string[];
  evaluate: (model: any, inputs: string[]) => Promise<EvaluationResult[]>;
}

export class BenchmarkSuite {
  private benchmarks: Map<string, Benchmark> = new Map();

  constructor() {
    this.initializeBenchmarks();
  }

  private initializeBenchmarks(): void {
    // Text generation benchmark
    this.addBenchmark({
      id: 'text-generation-default',
      name: 'Text Generation',
      description: 'Evaluate text generation quality',
      category: 'text-generation',
      dataset: 'common-crawl',
      metrics: ['bleu', 'rouge', 'perplexity'],
      evaluate: async (model, inputs) => {
        // Placeholder for actual evaluation
        return inputs.map((input, i) => ({
          input,
          actualOutput: `Generated output ${i}`,
          metrics: { bleu: 0.8, rouge: 0.75 },
          latency: 100,
          timestamp: Date.now(),
        }));
      },
    });

    // Classification benchmark
    this.addBenchmark({
      id: 'classification-default',
      name: 'Text Classification',
      description: 'Evaluate classification accuracy',
      category: 'classification',
      dataset: 'imdb',
      metrics: ['accuracy', 'f1'],
      evaluate: async (model, inputs) => {
        return inputs.map((input, i) => ({
          input,
          actualOutput: `Class: ${i % 2}`,
          metrics: { accuracy: 0.9 },
          latency: 50,
          timestamp: Date.now(),
        }));
      },
    });

    // QA benchmark
    this.addBenchmark({
      id: 'qa-default',
      name: 'Question Answering',
      description: 'Evaluate QA performance',
      category: 'qa',
      dataset: 'squad',
      metrics: ['f1', 'exact-match'],
      evaluate: async (model, inputs) => {
        return inputs.map((input, i) => ({
          input,
          actualOutput: `Answer ${i}`,
          metrics: { f1: 0.85 },
          latency: 75,
          timestamp: Date.now(),
        }));
      },
    });
  }

  addBenchmark(benchmark: Benchmark): void {
    this.benchmarks.set(benchmark.id, benchmark);
  }

  getBenchmark(id: string): Benchmark | undefined {
    return this.benchmarks.get(id);
  }

  listBenchmarks(): Benchmark[] {
    return Array.from(this.benchmarks.values());
  }

  async runBenchmark(
    benchmarkId: string,
    model: any,
    inputs: string[]
  ): Promise<EvaluationResult[]> {
    const benchmark = this.benchmarks.get(benchmarkId);
    if (!benchmark) {
      throw new Error(`Benchmark not found: ${benchmarkId}`);
    }

    return benchmark.evaluate(model, inputs);
  }

  async runAllBenchmarks(
    model: any,
    inputs: Map<string, string[]>
  ): Promise<Map<string, EvaluationResult[]>> {
    const results = new Map<string, EvaluationResult[]>();

    for (const [id, benchmark] of this.benchmarks) {
      const benchmarkInputs = inputs.get(id) || [];
      if (benchmarkInputs.length > 0) {
        const result = await this.runBenchmark(id, model, benchmarkInputs);
        results.set(id, result);
      }
    }

    return results;
  }
}

// ============================================================================
// Leaderboard
// ============================================================================

export interface LeaderboardEntry {
  rank: number;
  modelId: string;
  modelName: string;
  metrics: ModelMetrics;
  score: number;
  submittedAt: number;
  submittedBy: string;
  metadata?: Record<string, any>;
}

export class Leaderboard {
  private entries: LeaderboardEntry[] = [];
  private scoringWeights: Map<string, number> = new Map();

  constructor() {
    this.initializeDefaultWeights();
  }

  private initializeDefaultWeights(): void {
    this.scoringWeights.set('loss', -1);
    this.scoringWeights.set('accuracy', 1);
    this.scoringWeights.set('validationLoss', -1);
    this.scoringWeights.set('validationAccuracy', 1);
    this.scoringWeights.set('bleuScore', 1);
  }

  addEntry(entry: Omit<LeaderboardEntry, 'rank' | 'score'>): LeaderboardEntry {
    const score = this.calculateScore(entry.metrics);
    const rankedEntry: LeaderboardEntry = {
      ...entry,
      score,
      rank: 0, // Will be updated on re-rank
    };

    this.entries.push(rankedEntry);
    this.rerank();

    return rankedEntry;
  }

  getLeaderboard(limit?: number): LeaderboardEntry[] {
    const sorted = [...this.entries].sort((a, b) => b.score - a.score);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  getTopN(n: number): LeaderboardEntry[] {
    return this.getLeaderboard(n);
  }

  getModelRank(modelId: string): number {
    const entry = this.entries.find(e => e.modelId === modelId);
    return entry?.rank || -1;
  }

  private calculateScore(metrics: ModelMetrics): number {
    let score = 0;

    for (const [metric, weight] of this.scoringWeights) {
      const value = metrics[metric as keyof ModelMetrics] as number;
      if (value !== undefined) {
        score += weight * value;
      }
    }

    return score;
  }

  private rerank(): void {
    const sorted = [...this.entries].sort((a, b) => b.score - a.score);
    sorted.forEach((entry, index) => {
      entry.rank = index + 1;
    });
    this.entries = sorted;
  }
}

// ============================================================================
// Model Evaluator (Main Class)
// ============================================================================

export interface EvaluationConfig {
  modelId: string;
  datasetId: string;
  metrics: string[];
  benchmarks?: string[];
  runErrorAnalysis: boolean;
  runABTest?: {
    againstModel: string;
    significanceLevel: number;
  };
}

export interface EvaluationReport {
  evaluation: Evaluation;
  metrics: ModelMetrics;
  benchmarkResults?: Map<string, EvaluationResult[]>;
  errorAnalysis?: ErrorAnalysisResult;
  abTestResult?: ABTestResult;
  summary: {
    overallScore: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
}

export class ModelEvaluator {
  private calculator: MetricsCalculator;
  private abTester: ABTester;
  private benchmarkSuite: BenchmarkSuite;
  private leaderboard: Leaderboard;

  constructor() {
    this.calculator = new MetricsCalculator();
    this.abTester = new ABTester();
    this.benchmarkSuite = new BenchmarkSuite();
    this.leaderboard = new Leaderboard();
  }

  /**
   * Evaluate a model
   */
  async evaluate(config: EvaluationConfig): Promise<EvaluationReport> {
    // Run evaluation
    const metrics = await this.calculateMetrics(config);

    // Run benchmarks if specified
    let benchmarkResults: Map<string, EvaluationResult[]> | undefined;
    if (config.benchmarks && config.benchmarks.length > 0) {
      benchmarkResults = new Map();
      for (const benchmarkId of config.benchmarks) {
        // In production, would run actual benchmarks
        const results = await this.benchmarkSuite.runBenchmark(
          benchmarkId,
          { id: config.modelId },
          []
        );
        benchmarkResults.set(benchmarkId, results);
      }
    }

    // Run error analysis if specified
    let errorAnalysis: ErrorAnalysisResult | undefined;
    if (config.runErrorAnalysis) {
      // In production, would analyze actual errors
      errorAnalysis = ErrorAnalyzer.analyzeErrors([], []);
    }

    // Run A/B test if specified
    let abTestResult: ABTestResult | undefined;
    if (config.runABTest) {
      const test = this.abTester.createTest({
        name: `A/B Test: ${config.modelId} vs ${config.runABTest.againstModel}`,
        modelA: config.modelId,
        modelB: config.runABTest.againstModel,
        dataset: config.datasetId,
        metrics: config.metrics,
        sampleSize: 1000,
        significanceLevel: config.runABTest.significanceLevel,
        minEffectSize: 0.05,
      });
      abTestResult = await this.abTester.runTest(test.testId);
    }

    // Add to leaderboard
    this.leaderboard.addEntry({
      modelId: config.modelId,
      modelName: config.modelId,
      metrics,
      submittedAt: Date.now(),
      submittedBy: 'system',
    });

    // Generate summary
    const summary = this.generateSummary(metrics, errorAnalysis, abTestResult);

    return {
      evaluation: {
        id: this.generateEvaluationId(),
        modelId: config.modelId,
        datasetId: config.datasetId,
        status: 'completed',
        metrics,
        config: {} as any,
        results: [],
        createdAt: Date.now(),
        completedAt: Date.now(),
      },
      metrics,
      benchmarkResults,
      errorAnalysis,
      abTestResult,
      summary,
    };
  }

  /**
   * Get leaderboard
   */
  getLeaderboard(limit?: number): LeaderboardEntry[] {
    return this.leaderboard.getLeaderboard(limit);
  }

  /**
   * Get A/B test results
   */
  getABTest(testId: string): ABTestResult | undefined {
    return this.abTester.getTest(testId);
  }

  /**
   * Get available benchmarks
   */
  getBenchmarks(): Benchmark[] {
    return this.benchmarkSuite.listBenchmarks();
  }

  private async calculateMetrics(config: EvaluationConfig): Promise<ModelMetrics> {
    // In production, would calculate actual metrics from model outputs
    return {
      loss: 0.5 + Math.random() * 0.3,
      accuracy: 0.85 + Math.random() * 0.1,
      validationLoss: 0.55 + Math.random() * 0.3,
      validationAccuracy: 0.82 + Math.random() * 0.1,
      perplexity: 1.5 + Math.random() * 0.5,
      bleuScore: 0.75 + Math.random() * 0.15,
      rougeScore: {
        rouge1: 0.7 + Math.random() * 0.15,
        rouge2: 0.5 + Math.random() * 0.15,
        rougeL: 0.65 + Math.random() * 0.15,
      },
    };
  }

  private generateSummary(
    metrics: ModelMetrics,
    errorAnalysis?: ErrorAnalysisResult,
    abTestResult?: ABTestResult
  ): {
    overallScore: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];

    // Analyze metrics
    if (metrics.accuracy && metrics.accuracy > 0.9) {
      strengths.push(`Excellent accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
    } else if (metrics.accuracy && metrics.accuracy < 0.8) {
      weaknesses.push(`Low accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
      recommendations.push('Consider collecting more training data or adjusting hyperparameters');
    }

    if (metrics.bleuScore && metrics.bleuScore > 0.8) {
      strengths.push(`High BLEU score: ${metrics.bleuScore.toFixed(3)}`);
    } else if (metrics.bleuScore && metrics.bleuScore < 0.7) {
      weaknesses.push(`Low BLEU score: ${metrics.bleuScore.toFixed(3)}`);
      recommendations.push('Model may struggle with text generation. Consider fine-tuning on similar data');
    }

    // Add error analysis suggestions
    if (errorAnalysis) {
      recommendations.push(...errorAnalysis.suggestions);
    }

    // Add A/B test recommendations
    if (abTestResult?.recommendation) {
      recommendations.push(abTestResult.recommendation);
    }

    // Calculate overall score
    const overallScore = this.calculateOverallScore(metrics);

    return {
      overallScore,
      strengths,
      weaknesses,
      recommendations,
    };
  }

  private calculateOverallScore(metrics: ModelMetrics): number {
    let score = 0;
    let count = 0;

    if (metrics.accuracy) {
      score += metrics.accuracy;
      count++;
    }

    if (metrics.validationAccuracy) {
      score += metrics.validationAccuracy;
      count++;
    }

    if (metrics.bleuScore) {
      score += metrics.bleuScore;
      count++;
    }

    if (metrics.rougeScore) {
      score += (metrics.rougeScore.rouge1 + metrics.rougeScore.rougeL) / 2;
      count++;
    }

    return count > 0 ? score / count : 0;
  }

  private generateEvaluationId(): string {
    return `eval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
