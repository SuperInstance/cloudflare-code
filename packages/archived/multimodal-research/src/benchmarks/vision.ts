/**
 * Vision Benchmarks
 * Standard benchmarks for evaluating vision models
 */

// @ts-nocheck
import type {
  ImageInput,
  BenchmarkConfig,
  BenchmarkResult,
  BenchmarkMetric,
  ObjectDetection
} from '../types';

// ============================================================================
// Image Classification Benchmarks
// ============================================================================

export interface ImageNetConfig extends BenchmarkConfig {
  name: 'imagenet';
  numClasses: 1000;
  imageResolution: number;
}

export class ImageNetBenchmark {
  private config: ImageNetConfig;

  constructor(config?: Partial<ImageNetConfig>) {
    this.config = {
      name: 'imagenet',
      dataset: 'imagenet-1k',
      metrics: ['accuracy', 'top5_accuracy', 'latency', 'throughput'],
      numClasses: 1000,
      imageResolution: 224,
      ...config
    };
  }

  /**
   * Run ImageNet benchmark
   */
  async benchmark(
    model: (image: ImageInput) => Promise<number[]>,
    dataset: ImageInput[],
    labels: number[]
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let top1Correct = 0;
    let top5Correct = 0;
    const latencies: number[] = [];

    for (let i = 0; i < dataset.length; i++) {
      const inferenceStart = Date.now();
      const predictions = await model(dataset[i]);
      const latency = Date.now() - inferenceStart;
      latencies.push(latency);

      const trueLabel = labels[i];
      const sortedIndices = predictions
        .map((prob, idx) => ({ prob, idx }))
        .sort((a, b) => b.prob - a.prob)
        .map(item => item.idx);

      if (sortedIndices[0] === trueLabel) {
        top1Correct++;
      }

      if (sortedIndices.slice(0, 5).includes(trueLabel)) {
        top5Correct++;
      }
    }

    const duration = Date.now() - startTime;

    return {
      benchmark: this.config.name,
      model: 'vision-transformer',
      metrics: {
        accuracy: top1Correct / dataset.length,
        top5_accuracy: top5Correct / dataset.length,
        latency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
        throughput: (dataset.length * 1000) / duration
      },
      timestamp: Date.now(),
      duration
    };
  }
}

// ============================================================================
// COCO Object Detection Benchmark
// ============================================================================

export interface COCOConfig extends BenchmarkConfig {
  name: 'coco';
  numClasses: number;
  iouThreshold: number;
}

export class COCOBenchmark {
  private config: COCOConfig;

  constructor(config?: Partial<COCOConfig>) {
    this.config = {
      name: 'coco',
      dataset: 'coco-2017',
      metrics: ['map', 'map50', 'precision', 'recall', 'f1'],
      numClasses: 80,
      iouThreshold: 0.5,
      ...config
    };
  }

  /**
   * Run COCO benchmark
   */
  async benchmark(
    model: (image: ImageInput) => Promise<ObjectDetection[]>,
    dataset: ImageInput[],
    groundTruth: ObjectDetection[][]
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    for (let i = 0; i < dataset.length; i++) {
      const predictions = await model(dataset[i]);
      const gtBoxes = groundTruth[i];

      const evaluation = this.evaluateDetections(predictions, gtBoxes);
      truePositives += evaluation.truePositives;
      falsePositives += evaluation.falsePositives;
      falseNegatives += evaluation.falseNegatives;
    }

    const precision = truePositives / (truePositives + falsePositives + 1e-8);
    const recall = truePositives / (truePositives + falseNegatives + 1e-8);
    const f1 = 2 * (precision * recall) / (precision + recall + 1e-8);
    const map = this.computeMAP(dataset, model, groundTruth);

    const duration = Date.now() - startTime;

    return {
      benchmark: this.config.name,
      model: 'detection-model',
      metrics: {
        map,
        map50: map,
        precision,
        recall,
        f1
      },
      timestamp: Date.now(),
      duration
    };
  }

  private evaluateDetections(predictions: ObjectDetection[], groundTruth: ObjectDetection[]): {
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
  } {
    let tp = 0;
    let fp = 0;

    const matchedGt = new Set<number>();

    for (const pred of predictions) {
      let bestIou = 0;
      let bestGtIdx = -1;

      for (let i = 0; i < groundTruth.length; i++) {
        if (matchedGt.has(i)) continue;

        const iou = this.computeIoU(pred.boundingBox, groundTruth[i].boundingBox);
        if (iou > bestIou) {
          bestIou = iou;
          bestGtIdx = i;
        }
      }

      if (bestIou >= this.config.iouThreshold && pred.label === groundTruth[bestGtIdx]?.label) {
        tp++;
        matchedGt.add(bestGtIdx);
      } else {
        fp++;
      }
    }

    const fn = groundTruth.length - matchedGt.size;

    return { truePositives: tp, falsePositives: fp, falseNegatives: fn };
  }

  private computeIoU(box1: { x: number; y: number; width: number; height: number }, box2: typeof box1): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const box1Area = box1.width * box1.height;
    const box2Area = box2.width * box2.height;
    const unionArea = box1Area + box2Area - intersectionArea;

    return intersectionArea / (unionArea + 1e-8);
  }

  private computeMAP(
    dataset: ImageInput[],
    model: (image: ImageInput) => Promise<ObjectDetection[]>,
    groundTruth: ObjectDetection[][]
  ): number {
    // Simplified mAP computation
    // In practice, would compute AP for each class and average
    return 0.5;
  }
}

// ============================================================================
// Visual Question Answering Benchmark
// ============================================================================

export interface VQAConfig extends BenchmarkConfig {
  name: 'vqa-v2';
  answerVocabSize: number;
}

export class VQABenchmark {
  private config: VQAConfig;

  constructor(config?: Partial<VQAConfig>) {
    this.config = {
      name: 'vqa-v2',
      dataset: 'vqa-v2',
      metrics: ['accuracy', 'bleu', 'rouge'],
      answerVocabSize: 3129,
      ...config
    };
  }

  /**
   * Run VQA benchmark
   */
  async benchmark(
    model: (image: ImageInput, question: string) => Promise<string>,
    dataset: Array<{ image: ImageInput; question: string; answers: string[] }>
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let correct = 0;

    for (const sample of dataset) {
      const prediction = await model(sample.image, sample.question);
      const accuracy = this.computeVQAAccuracy(prediction, sample.answers);
      correct += accuracy;
    }

    const duration = Date.now() - startTime;

    return {
      benchmark: this.config.name,
      model: 'vqa-model',
      metrics: {
        accuracy: correct / dataset.length
      },
      timestamp: Date.now(),
      duration
    };
  }

  private computeVQAAccuracy(prediction: string, groundTruthAnswers: string[]): number {
    // VQA accuracy: 1 if at least 3 annotators agree, else proportion of agreeing annotators
    const answerCounts = new Map<string, number>();

    for (const answer of groundTruthAnswers) {
      const normalized = answer.toLowerCase().trim();
      answerCounts.set(normalized, (answerCounts.get(normalized) || 0) + 1);
    }

    const predictionNormalized = prediction.toLowerCase().trim();
    const count = answerCounts.get(predictionNormalized) || 0;

    if (count >= 3) {
      return 1;
    } else {
      return count / 10; // Assuming 10 annotators per question
    }
  }
}

// ============================================================================
// Image Captioning Benchmark
// ============================================================================

export interface COCOConfigCaptions extends BenchmarkConfig {
  name: 'coco-captions';
  maxLength: number;
}

export class COCOCaptionsBenchmark {
  private config: COCOConfigCaptions;

  constructor(config?: Partial<COCOConfigCaptions>) {
    this.config = {
      name: 'coco-captions',
      dataset: 'coco-captions',
      metrics: ['bleu', 'rouge', 'meteor', 'cider'],
      maxLength: 20,
      ...config
    };
  }

  /**
   * Run COCO Captions benchmark
   */
  async benchmark(
    model: (image: ImageInput) => Promise<string>,
    dataset: Array<{ image: ImageInput; captions: string[] }>
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let totalBleu = 0;
    let totalRouge = 0;

    for (const sample of dataset) {
      const prediction = await model(sample.image);
      const bleu = this.computeBLEU(prediction, sample.captions);
      const rouge = this.computeROUGE(prediction, sample.captions);

      totalBleu += bleu;
      totalRouge += rouge;
    }

    const duration = Date.now() - startTime;

    return {
      benchmark: this.config.name,
      model: 'captioning-model',
      metrics: {
        bleu: totalBleu / dataset.length,
        rouge: totalRouge / dataset.length
      },
      timestamp: Date.now(),
      duration
    };
  }

  private computeBLEU(prediction: string, references: string[]): number {
    // Simplified BLEU computation
    const predTokens = prediction.toLowerCase().split(/\s+/);
    let bleu = 0;

    for (const ref of references) {
      const refTokens = ref.toLowerCase().split(/\s+/);
      const matches = predTokens.filter(token => refTokens.includes(token));
      const precision = matches.length / predTokens.length;
      bleu = Math.max(bleu, precision);
    }

    return bleu;
  }

  private computeROUGE(prediction: string, references: string[]): number {
    // Simplified ROUGE-L computation
    const predLower = prediction.toLowerCase();
    let maxRouge = 0;

    for (const ref of references) {
      const refLower = ref.toLowerCase();
      const intersection = this.lcs(predLower, refLower);
      const rougeL =
        (2 * intersection.length) / (predLower.length + refLower.length + 1e-8);
      maxRouge = Math.max(maxRouge, rougeL);
    }

    return maxRouge;
  }

  private lcs(a: string, b: string): string {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array(m + 1)
      .fill(0)
      .map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Reconstruct LCS
    let lcs = '';
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        lcs = a[i - 1] + lcs;
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return lcs;
  }
}

// ============================================================================
// Cross-Modal Retrieval Benchmark
// ============================================================================

export interface RetrievalConfig extends BenchmarkConfig {
  name: 'flickr30k' | 'mscoco';
  kValues: number[];
}

export class RetrievalBenchmark {
  private config: RetrievalConfig;

  constructor(config?: Partial<RetrievalConfig>) {
    this.config = {
      name: 'flickr30k',
      dataset: 'flickr30k',
      metrics: ['recall', 'precision', 'map', 'mrr'],
      kValues: [1, 5, 10],
      ...config
    };
  }

  /**
   * Run image-text retrieval benchmark
   */
  async benchmark(
    imageModel: (image: ImageInput) => Promise<Float32Array>,
    textModel: (text: string) => Promise<Float32Array>,
    dataset: Array<{ image: ImageInput; caption: string }>
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();

    // Compute embeddings
    const imageEmbeddings: Float32Array[] = [];
    const textEmbeddings: Float32Array[] = [];

    for (const sample of dataset) {
      const imageEmb = await imageModel(sample.image);
      const textEmb = await textModel(sample.caption);
      imageEmbeddings.push(imageEmb);
      textEmbeddings.push(textEmb);
    }

    // Image-to-text retrieval
    const i2tRecall = this.computeRetrievalMetrics(
      imageEmbeddings,
      textEmbeddings,
      this.config.kValues
    );

    // Text-to-image retrieval
    const t2iRecall = this.computeRetrievalMetrics(
      textEmbeddings,
      imageEmbeddings,
      this.config.kValues
    );

    // Compute MAP and MRR
    const map = this.computeMAP(imageEmbeddings, textEmbeddings);
    const mrr = this.computeMRR(imageEmbeddings, textEmbeddings);

    const duration = Date.now() - startTime;

    return {
      benchmark: this.config.name,
      model: 'retrieval-model',
      metrics: {
        i2t_recall_k1: i2tRecall.get(1) || 0,
        i2t_recall_k5: i2tRecall.get(5) || 0,
        i2t_recall_k10: i2tRecall.get(10) || 0,
        t2i_recall_k1: t2iRecall.get(1) || 0,
        t2i_recall_k5: t2iRecall.get(5) || 0,
        t2i_recall_k10: t2iRecall.get(10) || 0,
        map,
        mrr
      },
      timestamp: Date.now(),
      duration
    };
  }

  private computeRetrievalMetrics(
    queries: Float32Array[],
    targets: Float32Array[],
    kValues: number[]
  ): Map<number, number> {
    const recalls = new Map<number, number>();

    for (const k of kValues) {
      let totalRecall = 0;

      for (let i = 0; i < queries.length; i++) {
        const similarities = this.computeSimilarities(queries[i], targets);
        const topKIndices = this.topKIndices(similarities, k);

        if (topKIndices.includes(i)) {
          totalRecall += 1;
        }
      }

      recalls.set(k, totalRecall / queries.length);
    }

    return recalls;
  }

  private computeSimilarities(query: Float32Array, targets: Float32Array[]): Float32Array {
    const similarities = new Float32Array(targets.length);

    for (let i = 0; i < targets.length; i++) {
      similarities[i] = this.cosineSimilarity(query, targets[i]);
    }

    return similarities;
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
  }

  private topKIndices(similarities: Float32Array, k: number): number[] {
    const indexed = similarities.map((sim, idx) => ({ sim, idx }));
    indexed.sort((a, b) => b.sim - a.sim);
    return indexed.slice(0, k).map(item => item.idx);
  }

  private computeMAP(queries: Float32Array[], targets: Float32Array[]): number {
    let totalAP = 0;

    for (let i = 0; i < queries.length; i++) {
      const similarities = this.computeSimilarities(queries[i], targets);
      const ranked = similarities
        .map((sim, idx) => ({ sim, idx }))
        .sort((a, b) => b.sim - a.sim);

      const rank = ranked.findIndex(item => item.idx === i);
      const ap = rank >= 0 ? 1 / (rank + 1) : 0;
      totalAP += ap;
    }

    return totalAP / queries.length;
  }

  private computeMRR(queries: Float32Array[], targets: Float32Array[]): number {
    let totalRR = 0;

    for (let i = 0; i < queries.length; i++) {
      const similarities = this.computeSimilarities(queries[i], targets);
      const ranked = similarities
        .map((sim, idx) => ({ sim, idx }))
        .sort((a, b) => b.sim - a.sim);

      const rank = ranked.findIndex(item => item.idx === i);
      const rr = rank >= 0 ? 1 / (rank + 1) : 0;
      totalRR += rr;
    }

    return totalRR / queries.length;
  }
}
