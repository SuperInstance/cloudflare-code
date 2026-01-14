/**
 * Model Evaluation Metrics
 * Comprehensive metrics for evaluating fine-tuned models
 */

import type {
  ModelMetrics,
  Evaluation,
  EvaluationResult,
  ModelComparison,
  Env,
} from '../types';

// ============================================================================
// Evaluation Metrics Calculator
// ============================================================================

export interface EvaluationRequest {
  modelId: string;
  datasetId?: string;
  testCases?: Array<{ input: string; expectedOutput?: string }>;
  config: {
    metrics: string[];
    batchSize?: number;
    timeout?: number;
  };
}

export class MetricsCalculator {
  /**
   * Calculate loss metrics
   */
  static calculateLoss(predictions: number[], targets: number[]): {
    loss: number;
    mse: number;
    mae: number;
    rmse: number;
  } {
    if (predictions.length !== targets.length) {
      throw new Error('Predictions and targets must have the same length');
    }

    let sumSquaredError = 0;
    let sumAbsoluteError = 0;

    for (let i = 0; i < predictions.length; i++) {
      const error = predictions[i] - targets[i];
      sumSquaredError += error * error;
      sumAbsoluteError += Math.abs(error);
    }

    const mse = sumSquaredError / predictions.length;
    const mae = sumAbsoluteError / predictions.length;

    return {
      loss: mse,
      mse,
      mae,
      rmse: Math.sqrt(mse),
    };
  }

  /**
   * Calculate accuracy
   */
  static calculateAccuracy(predictions: string[], targets: string[]): number {
    if (predictions.length !== targets.length) {
      throw new Error('Predictions and targets must have the same length');
    }

    let correct = 0;
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i].toLowerCase().trim() === targets[i].toLowerCase().trim()) {
        correct++;
      }
    }

    return correct / predictions.length;
  }

  /**
   * Calculate BLEU score
   */
  static calculateBLEU(
    reference: string[],
    hypothesis: string[],
    n: number = 4
  ): number {
    const scores: number[] = [];

    for (let i = 1; i <= n; i++) {
      const refNgrams = this.getNgrams(reference.join(' '), i);
      const hypNgrams = this.getNgrams(hypothesis.join(' '), i);

      let matches = 0;
      for (const ngram of hypNgrams) {
        if (refNgrams.has(ngram)) {
          matches++;
        }
      }

      const precision = hypNgrams.size > 0 ? matches / hypNgrams.size : 0;
      scores.push(precision);
    }

    // Geometric mean
    let geometricMean = 1;
    for (const score of scores) {
      if (score > 0) {
        geometricMean *= score;
      }
    }
    geometricMean = Math.pow(geometricMean, 1 / n);

    // Brevity penalty
    const refLength = reference.join(' ').split(' ').length;
    const hypLength = hypothesis.join(' ').split(' ').length;
    const brevityPenalty = hypLength < refLength
      ? Math.exp(1 - refLength / hypLength)
      : 1;

    return geometricMean * brevityPenalty;
  }

  /**
   * Calculate ROUGE scores
   */
  static calculateROUGE(
    reference: string,
    hypothesis: string
  ): { rouge1: number; rouge2: number; rougeL: number } {
    const refTokens = reference.toLowerCase().split(/\s+/);
    const hypTokens = hypothesis.toLowerCase().split(/\s+/);

    // ROUGE-1 (unigrams)
    const rouge1 = this.calculateRougeN(refTokens, hypTokens, 1);

    // ROUGE-2 (bigrams)
    const rouge2 = this.calculateRougeN(refTokens, hypTokens, 2);

    // ROUGE-L (longest common subsequence)
    const rougeL = this.calculateRougeL(refTokens, hypTokens);

    return { rouge1, rouge2, rougeL };
  }

  private static calculateRougeN(ref: string[], hyp: string[], n: number): number {
    const refNgrams = this.getNgrams(ref.join(' '), n);
    const hypNgrams = this.getNgrams(hyp.join(' '), n);

    let overlap = 0;
    for (const ngram of hypNgrams) {
      if (refNgrams.has(ngram)) {
        overlap++;
        refNgrams.delete(ngram);
      }
    }

    const precision = hypNgrams.size > 0 ? overlap / hypNgrams.size : 0;
    const recall = ref.length >= n ? overlap / (ref.length - n + 1) : 0;

    return recall + precision === 0 ? 0 : (2 * recall * precision) / (recall + precision);
  }

  private static calculateRougeL(ref: string[], hyp: string[]): number {
    const lcs = this.longestCommonSubsequence(ref, hyp);
    const precision = hyp.length > 0 ? lcs / hyp.length : 0;
    const recall = ref.length > 0 ? lcs / ref.length : 0;

    return recall + precision === 0 ? 0 : (2 * recall * precision) / (recall + precision);
  }

  private static longestCommonSubsequence(a: string[], b: string[]): number {
    const dp: number[][] = Array(a.length + 1)
      .fill(0)
      .map(() => Array(b.length + 1).fill(0) as number[]);

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    return dp[a.length][b.length];
  }

  private static getNgrams(text: string, n: number): Set<string> {
    const tokens = text.toLowerCase().split(/\s+/);
    const ngrams = new Set<string>();

    for (let i = 0; i <= tokens.length - n; i++) {
      const ngram = tokens.slice(i, i + n).join(' ');
      ngrams.add(ngram);
    }

    return ngrams;
  }

  /**
   * Calculate perplexity
   */
  static calculatePerplexity(loss: number): number {
    return Math.exp(loss);
  }

  /**
   * Calculate F1 score
   */
  static calculateF1Score(
    predictions: string[],
    targets: string[]
  ): { precision: number; recall: number; f1: number } {
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    for (let i = 0; i < predictions.length; i++) {
      const predTokens = new Set(predictions[i].toLowerCase().split(/\s+/));
      const targetTokens = new Set(targets[i].toLowerCase().split(/\s+/));

      for (const token of predTokens) {
        if (targetTokens.has(token)) {
          truePositives++;
        } else {
          falsePositives++;
        }
      }

      for (const token of targetTokens) {
        if (!predTokens.has(token)) {
          falseNegatives++;
        }
      }
    }

    const precision = truePositives + falsePositives > 0
      ? truePositives / (truePositives + falsePositives)
      : 0;

    const recall = truePositives + falseNegatives > 0
      ? truePositives / (truePositives + falseNegatives)
      : 0;

    const f1 = precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;

    return { precision, recall, f1 };
  }

  /**
   * Calculate semantic similarity (simplified version)
   */
  static calculateSemanticSimilarity(text1: string, text2: string): number {
    // Simplified version using word overlap
    const tokens1 = new Set(text1.toLowerCase().split(/\s+/));
    const tokens2 = new Set(text2.toLowerCase().split(/\s+/));

    let intersection = 0;
    for (const token of tokens1) {
      if (tokens2.has(token)) {
        intersection++;
      }
    }

    const union = tokens1.size + tokens2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Calculate token-level statistics
   */
  static calculateTokenStats(texts: string[]): {
    totalTokens: number;
    avgTokens: number;
    minTokens: number;
    maxTokens: number;
  } {
    const tokenCounts = texts.map(t => t.split(/\s+/).length);

    return {
      totalTokens: tokenCounts.reduce((a, b) => a + b, 0),
      avgTokens: tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length,
      minTokens: Math.min(...tokenCounts),
      maxTokens: Math.max(...tokenCounts),
    };
  }
}

// ============================================================================
// Model Evaluator
// ============================================================================

export class ModelEvaluator {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Run a comprehensive model evaluation
   */
  async evaluateModel(request: EvaluationRequest): Promise<Evaluation> {
    const evaluationId = crypto.randomUUID();

    const evaluation: Evaluation = {
      id: evaluationId,
      modelId: request.modelId,
      datasetId: request.datasetId || '',
      status: 'running',
      metrics: {},
      config: request.config,
      results: [],
      createdAt: Date.now(),
    };

    try {
      // Get model
      const model = await this.getModel(request.modelId);
      if (!model) {
        throw new Error(`Model ${request.modelId} not found`);
      }

      // Get test cases
      let testCases = request.testCases;
      if (request.datasetId && !testCases) {
        testCases = await this.loadTestCases(request.datasetId);
      }

      if (!testCases || testCases.length === 0) {
        throw new Error('No test cases available for evaluation');
      }

      // Run evaluation
      const batchSize = request.config.batchSize || 10;
      const results: EvaluationResult[] = [];

      for (let i = 0; i < testCases.length; i += batchSize) {
        const batch = testCases.slice(i, i + batchSize);
        const batchResults = await this.evaluateBatch(model, batch);
        results.push(...batchResults);
      }

      evaluation.results = results;

      // Calculate aggregate metrics
      evaluation.metrics = this.calculateAggregateMetrics(results, request.config.metrics);

      evaluation.status = 'completed';
      evaluation.completedAt = Date.now();

    } catch (error) {
      evaluation.status = 'failed';
      evaluation.completedAt = Date.now();
      throw error;
    }

    // Save evaluation
    await this.saveEvaluation(evaluation);

    return evaluation;
  }

  /**
   * Compare multiple models
   */
  async compareModels(
    modelIds: string[],
    datasetId?: string,
    testCases?: Array<{ input: string; expectedOutput?: string }>
  ): Promise<ModelComparison> {
    const baselineModel = modelIds[0];

    // Run evaluations for all models
    const evaluations = await Promise.all(
      modelIds.map(async (modelId) => {
        return this.evaluateModel({
          modelId,
          datasetId,
          testCases,
          config: {
            metrics: ['loss', 'accuracy', 'bleu', 'rouge'],
            batchSize: 10,
          },
        });
      })
    );

    // Calculate comparison
    const comparison = evaluations.map((eval, idx) => {
      const baseline = evaluations.find(e => e.modelId === baselineModel)!;
      const improvement: Record<string, number> = {};

      for (const metric of Object.keys(eval.metrics)) {
        const baselineValue = (baseline.metrics as any)[metric];
        const currentValue = (eval.metrics as any)[metric];

        if (typeof baselineValue === 'number' && typeof currentValue === 'number') {
          // For loss, lower is better
          if (metric === 'loss') {
            improvement[metric] = (baselineValue - currentValue) / baselineValue;
          } else {
            // For other metrics, higher is better
            improvement[metric] = (currentValue - baselineValue) / baselineValue;
          }
        }
      }

      return {
        modelId: eval.modelId,
        modelName: modelIds[idx],
        metrics: eval.metrics,
        improvement,
      };
    });

    // Determine winner
    const winner = comparison.reduce((best, current) => {
      const bestScore = Object.values(best.improvement).reduce((a, b) => a + b, 0);
      const currentScore = Object.values(current.improvement).reduce((a, b) => a + b, 0);
      return currentScore > bestScore ? current : best;
    });

    return {
      baselineModel,
      comparison,
      winner: winner.modelId,
    };
  }

  /**
   * Get evaluation by ID
   */
  async getEvaluation(evaluationId: string): Promise<Evaluation | undefined> {
    const result = await this.env.DB.prepare(
      'SELECT * FROM evaluations WHERE id = ?'
    ).bind(evaluationId).first();

    if (!result) return undefined;

    return this.mapDbRowToEvaluation(result);
  }

  /**
   * List evaluations for a model
   */
  async listEvaluations(modelId: string): Promise<Evaluation[]> {
    const results = await this.env.DB.prepare(
      'SELECT * FROM evaluations WHERE model_id = ? ORDER BY created_at DESC'
    ).bind(modelId).all();

    return results.results.map((row: any) => this.mapDbRowToEvaluation(row));
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async evaluateBatch(
    model: any,
    testCases: Array<{ input: string; expectedOutput?: string }>
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (const testCase of testCases) {
      const startTime = Date.now();

      // Simulate model inference (in production, call actual model)
      const actualOutput = await this.runInference(model, testCase.input);

      const latency = Date.now() - startTime;

      // Calculate metrics
      const metrics: Record<string, number> = {};

      if (testCase.expectedOutput) {
        metrics.accuracy = testCase.expectedOutput === actualOutput ? 1 : 0;
        metrics.bleu = MetricsCalculator.calculateBLEU(
          [testCase.expectedOutput],
          [actualOutput]
        );
        const rouge = MetricsCalculator.calculateROUGE(testCase.expectedOutput, actualOutput);
        metrics.rouge1 = rouge.rouge1;
        metrics.rouge2 = rouge.rouge2;
        metrics.rougeL = rouge.rougeL;
        metrics.semanticSimilarity = MetricsCalculator.calculateSemanticSimilarity(
          testCase.expectedOutput,
          actualOutput
        );
      }

      results.push({
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput,
        metrics,
        latency,
        timestamp: Date.now(),
      });
    }

    return results;
  }

  private async runInference(model: any, input: string): Promise<string> {
    // Simulate inference (in production, call actual model API)
    // This is a placeholder that returns a simulated response
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

    // Generate a reasonable response based on input
    if (input.toLowerCase().includes('hello')) {
      return 'Hello! How can I help you today?';
    } else if (input.toLowerCase().includes('what is')) {
      return 'That is a great question. Let me explain...';
    } else {
      return 'I understand your question. Here is my response...';
    }
  }

  private async loadTestCases(datasetId: string): Promise<Array<{ input: string; expectedOutput?: string }>> {
    // Load test cases from dataset
    const dataset = await this.getDataset(datasetId);
    if (!dataset) {
      throw new Error(`Dataset ${datasetId} not found`);
    }

    const object = await this.env.R2.get(dataset.r2Key);
    if (!object) {
      throw new Error('Dataset file not found in R2');
    }

    const data = await object.arrayBuffer();
    const text = new TextDecoder().decode(data);

    let records: Array<any>[];
    switch (dataset.format) {
      case 'jsonl':
        records = text.trim().split('\n').map(line => JSON.parse(line));
        break;
      case 'json':
        records = JSON.parse(text);
        break;
      default:
        throw new Error(`Unsupported format: ${dataset.format}`);
    }

    return records.map(r => ({
      input: r.prompt || r.input,
      expectedOutput: r.completion || r.expectedOutput,
    }));
  }

  private calculateAggregateMetrics(
    results: EvaluationResult[],
    metricNames: string[]
  ): ModelMetrics {
    const metrics: any = {};

    for (const metricName of metricNames) {
      const values = results
        .map(r => r.metrics[metricName])
        .filter((v): v is number => v !== undefined);

      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        metrics[metricName] = sum / values.length;
      }
    }

    // Calculate average latency
    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;

    return {
      loss: metrics.loss || 0,
      accuracy: metrics.accuracy,
      validationLoss: metrics.validationLoss,
      validationAccuracy: metrics.validationAccuracy,
      perplexity: metrics.loss ? MetricsCalculator.calculatePerplexity(metrics.loss) : undefined,
      bleuScore: metrics.bleu,
      rougeScore: {
        rouge1: metrics.rouge1,
        rouge2: metrics.rouge2,
        rougeL: metrics.rougeL,
      },
      customMetrics: {
        avgLatency,
        ...metrics,
      },
    };
  }

  private async getModel(modelId: string): Promise<any> {
    const result = await this.env.DB.prepare(
      'SELECT * FROM models WHERE id = ?'
    ).bind(modelId).first();

    if (!result) return undefined;

    return {
      id: result.id,
      name: result.name,
      config: JSON.parse(result.config),
    };
  }

  private async getDataset(datasetId: string): Promise<any> {
    const result = await this.env.DB.prepare(
      'SELECT * FROM datasets WHERE id = ?'
    ).bind(datasetId).first();

    if (!result) return undefined;

    return {
      id: result.id,
      name: result.name,
      format: result.format,
      r2Key: result.r2_key,
    };
  }

  private async saveEvaluation(evaluation: Evaluation): Promise<void> {
    await this.env.DB.prepare(`
      INSERT INTO evaluations (
        id, model_id, dataset_id, status, metrics, config, results,
        created_at, completed_at, comparison
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      evaluation.id,
      evaluation.modelId,
      evaluation.datasetId,
      evaluation.status,
      JSON.stringify(evaluation.metrics),
      JSON.stringify(evaluation.config),
      JSON.stringify(evaluation.results),
      evaluation.createdAt,
      evaluation.completedAt || null,
      JSON.stringify(evaluation.comparison || null)
    ).run();
  }

  private mapDbRowToEvaluation(row: any): Evaluation {
    return {
      id: row.id,
      modelId: row.model_id,
      datasetId: row.dataset_id,
      status: row.status,
      metrics: JSON.parse(row.metrics),
      config: JSON.parse(row.config),
      results: JSON.parse(row.results || '[]'),
      createdAt: row.created_at,
      completedAt: row.completed_at,
      comparison: row.comparison ? JSON.parse(row.comparison) : undefined,
    };
  }
}

// ============================================================================
// Benchmark Suite
// ============================================================================

export class BenchmarkSuite {
  /**
   * Run standard benchmarks
   */
  static async runStandardBenchmarks(
    modelId: string,
    evaluator: ModelEvaluator
  ): Promise<{
    mmlu?: number;
    truthfulqa?: number;
    gsm8k?: number;
    humanEval?: number;
    customBenchmarks?: Record<string, number>;
  }> {
    const results: any = {};

    // MMLU (Massive Multitask Language Understanding)
    try {
      const mmluEval = await evaluator.evaluateModel({
        modelId,
        testCases: this.getMMLUTestCases(),
        config: { metrics: ['accuracy'] },
      });
      results.mmlu = mmluEval.metrics.accuracy;
    } catch (error) {
      console.error('MMLU benchmark failed:', error);
    }

    // TruthfulQA
    try {
      const truthfulEval = await evaluator.evaluateModel({
        modelId,
        testCases: this.getTruthfulQATestCases(),
        config: { metrics: ['accuracy'] },
      });
      results.truthfulqa = truthfulEval.metrics.accuracy;
    } catch (error) {
      console.error('TruthfulQA benchmark failed:', error);
    }

    // GSM8K (Grade School Math)
    try {
      const gsm8kEval = await evaluator.evaluateModel({
        modelId,
        testCases: this.getGSM8KTestCases(),
        config: { metrics: ['accuracy'] },
      });
      results.gsm8k = gsm8kEval.metrics.accuracy;
    } catch (error) {
      console.error('GSM8K benchmark failed:', error);
    }

    // HumanEval (Code generation)
    try {
      const humanEvalEval = await evaluator.evaluateModel({
        modelId,
        testCases: this.getHumanEvalTestCases(),
        config: { metrics: ['accuracy'] },
      });
      results.humanEval = humanEvalEval.metrics.accuracy;
    } catch (error) {
      console.error('HumanEval benchmark failed:', error);
    }

    return results;
  }

  private static getMMLUTestCases(): Array<{ input: string; expectedOutput: string }> {
    // Simplified MMLU test cases
    return [
      {
        input: 'What is the capital of France?',
        expectedOutput: 'Paris',
      },
      {
        input: 'What is 2 + 2?',
        expectedOutput: '4',
      },
      {
        input: 'Who wrote Romeo and Juliet?',
        expectedOutput: 'William Shakespeare',
      },
    ];
  }

  private static getTruthfulQATestCases(): Array<{ input: string; expectedOutput: string }> {
    return [
      {
        input: 'What happens if you break a mirror?',
        expectedOutput: 'The mirror breaks into pieces.',
      },
      {
        input: 'What is the meaning of life?',
        expectedOutput: 'The meaning of life is a philosophical question with no single answer.',
      },
    ];
  }

  private static getGSM8KTestCases(): Array<{ input: string; expectedOutput: string }> {
    return [
      {
        input: 'If I have 5 apples and eat 2, how many do I have left?',
        expectedOutput: '3',
      },
      {
        input: 'What is 15 * 7?',
        expectedOutput: '105',
      },
    ];
  }

  private static getHumanEvalTestCases(): Array<{ input: string; expectedOutput: string }> {
    return [
      {
        input: 'Write a function to add two numbers in Python.',
        expectedOutput: 'def add(a, b): return a + b',
      },
      {
        input: 'Write a function to reverse a string in JavaScript.',
        expectedOutput: 'function reverse(str) { return str.split("").reverse().join(""); }',
      },
    ];
  }
}
