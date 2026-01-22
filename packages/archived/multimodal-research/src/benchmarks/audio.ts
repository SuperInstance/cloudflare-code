/**
 * Audio Benchmarks
 * Standard benchmarks for evaluating audio models
 */

// @ts-nocheck

import type {
  AudioInput,
  BenchmarkConfig,
  BenchmarkResult
} from '../types';

// ============================================================================
// Speech Recognition Benchmark
// ============================================================================

export interface LibrispeechConfig extends BenchmarkConfig {
  name: 'librispeech';
  sampleRate: number;
}

export class LibrispeechBenchmark {
  private config: LibrispeechConfig;

  constructor(config?: Partial<LibrispeechConfig>) {
    this.config = {
      name: 'librispeech',
      dataset: 'librispeech',
      metrics: ['wer', 'cer', 'latency', 'throughput'],
      sampleRate: 16000,
      ...config
    };
  }

  /**
   * Run LibriSpeech benchmark
   */
  async benchmark(
    model: (audio: AudioInput) => Promise<string>,
    dataset: AudioInput[],
    transcripts: string[]
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let totalWer = 0;
    let totalCer = 0;
    const latencies: number[] = [];

    for (let i = 0; i < dataset.length; i++) {
      const inferenceStart = Date.now();
      const prediction = await model(dataset[i]);
      const latency = Date.now() - inferenceStart;
      latencies.push(latency);

      const reference = transcripts[i];
      totalWer += this.computeWER(prediction, reference);
      totalCer += this.computeCER(prediction, reference);
    }

    const duration = Date.now() - startTime;

    return {
      benchmark: this.config.name,
      model: 'whisper',
      metrics: {
        wer: totalWer / dataset.length,
        cer: totalCer / dataset.length,
        latency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
        throughput: (dataset.length * 1000) / duration
      },
      timestamp: Date.now(),
      duration
    };
  }

  /**
   * Compute Word Error Rate
   */
  private computeWER(prediction: string, reference: string): number {
    const predWords = prediction.toLowerCase().trim().split(/\s+/);
    const refWords = reference.toLowerCase().trim().split(/\s+/);

    const distance = this.editDistance(predWords, refWords);
    return distance / refWords.length;
  }

  /**
   * Compute Character Error Rate
   */
  private computeCER(prediction: string, reference: string): number {
    const predChars = prediction.toLowerCase().trim().split('');
    const refChars = reference.toLowerCase().trim().split('');

    const distance = this.editDistance(predChars, refChars);
    return distance / refChars.length;
  }

  /**
   * Levenshtein distance
   */
  private editDistance(a: string[], b: string[]): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array(m + 1)
      .fill(0)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
        }
      }
    }

    return dp[m][n];
  }
}

// ============================================================================
// Audio Classification Benchmark
// ============================================================================

export interface AudioSetConfig extends BenchmarkConfig {
  name: 'audioset';
  numClasses: number;
}

export class AudioSetBenchmark {
  private config: AudioSetConfig;

  constructor(config?: Partial<AudioSetConfig>) {
    this.config = {
      name: 'audioset',
      dataset: 'audioset',
      metrics: ['map', 'auc', 'precision', 'recall', 'f1'],
      numClasses: 527,
      ...config
    };
  }

  /**
   * Run AudioSet benchmark
   */
  async benchmark(
    model: (audio: AudioInput) => Promise<number[]>,
    dataset: AudioInput[],
    labels: number[][]
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let totalMap = 0;
    let totalAUC = 0;

    for (let i = 0; i < dataset.length; i++) {
      const predictions = await model(dataset[i]);
      const groundTruth = labels[i];

      const ap = this.computeAveragePrecision(predictions, groundTruth);
      const auc = this.computeAUC(predictions, groundTruth);

      totalMap += ap;
      totalAUC += auc;
    }

    const duration = Date.now() - startTime;

    return {
      benchmark: this.config.name,
      model: 'audio-classifier',
      metrics: {
        map: totalMap / dataset.length,
        auc: totalAUC / dataset.length
      },
      timestamp: Date.now(),
      duration
    };
  }

  private computeAveragePrecision(predictions: number[], groundTruth: number[]): number {
    // Sort predictions by confidence
    const indexed = predictions.map((prob, idx) => ({ prob, idx, label: groundTruth[idx] }));
    indexed.sort((a, b) => b.prob - a.prob);

    let correct = 0;
    let totalAP = 0;

    for (let i = 0; i < indexed.length; i++) {
      if (indexed[i].label === 1) {
        correct++;
        totalAP += correct / (i + 1);
      }
    }

    const numPositives = groundTruth.filter(l => l === 1).length;
    return numPositives > 0 ? totalAP / numPositives : 0;
  }

  private computeAUC(predictions: number[], groundTruth: number[]): number {
    // Simplified AUC computation
    let auc = 0;
    const numPositives = groundTruth.filter(l => l === 1).length;
    const numNegatives = groundTruth.filter(l => l === 0).length;

    if (numPositives === 0 || numNegatives === 0) {
      return 0;
    }

    const indexed = predictions.map((prob, idx) => ({ prob, label: groundTruth[idx] }));
    indexed.sort((a, b) => b.prob - a.prob);

    let rankSum = 0;
    for (let i = 0; i < indexed.length; i++) {
      if (indexed[i].label === 1) {
        rankSum += i + 1;
      }
    }

    auc = (rankSum - numPositives * (numPositives + 1) / 2) / (numPositives * numNegatives);
    return auc;
  }
}

// ============================================================================
// Speaker Identification Benchmark
// ============================================================================

export interface VoxCelebConfig extends BenchmarkConfig {
  name: 'voxceleb';
  numSpeakers: number;
  numUtterances: number;
}

export class VoxCelebBenchmark {
  private config: VoxCelebConfig;

  constructor(config?: Partial<VoxCelebConfig>) {
    this.config = {
      name: 'voxceleb',
      dataset: 'voxceleb2',
      metrics: ['accuracy', 'eer', 'tar'],
      numSpeakers: 100,
      numUtterances: 5,
      ...config
    };
  }

  /**
   * Run VoxCeleb benchmark
   */
  async benchmark(
    model: (audio: AudioInput) => Promise<Float32Array>,
    dataset: Array<{ audio: AudioInput; speakerId: string }>
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();

    // Compute embeddings
    const embeddings: Map<string, Float32Array[]> = new Map();

    for (const sample of dataset) {
      const embedding = await model(sample.audio);

      if (!embeddings.has(sample.speakerId)) {
        embeddings.set(sample.speakerId, []);
      }
      embeddings.get(sample.speakerId)!.push(embedding);
    }

    // Speaker identification accuracy
    let correct = 0;
    let total = 0;

    for (const [speakerId, speakerEmbeddings] of embeddings) {
      // Use first embedding as enrollment, rest for testing
      const enrollment = speakerEmbeddings[0];
      const testEmbeddings = speakerEmbeddings.slice(1);

      for (const testEmbedding of testEmbeddings) {
        // Find closest speaker
        let minDist = Infinity;
        let predictedSpeaker = '';

        for (const [otherSpeakerId, otherSpeakerEmbeddings] of embeddings) {
          const otherEnrollment = otherSpeakerEmbeddings[0];
          const dist = this.euclideanDistance(enrollment, otherEnrollment);

          if (dist < minDist) {
            minDist = dist;
            predictedSpeaker = otherSpeakerId;
          }
        }

        if (predictedSpeaker === speakerId) {
          correct++;
        }
        total++;
      }
    }

    // Compute EER using verification trials
    const eer = this.computeEER(embeddings);

    const duration = Date.now() - startTime;

    return {
      benchmark: this.config.name,
      model: 'speaker-identification',
      metrics: {
        accuracy: correct / total,
        eer
      },
      timestamp: Date.now(),
      duration
    };
  }

  private euclideanDistance(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
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

  private computeEER(embeddings: Map<string, Float32Array[]>): number {
    // Generate verification trials
    const trials: Array<{ label: number; score: number }> = [];

    const speakers = Array.from(embeddings.keys());

    for (let i = 0; i < speakers.length; i++) {
      for (let j = i + 1; j < speakers.length; j++) {
        const speaker1Embeddings = embeddings.get(speakers[i])!;
        const speaker2Embeddings = embeddings.get(speakers[j])!;

        // Same speaker trials (positive)
        for (let k = 0; k < speaker1Embeddings.length - 1; k++) {
          for (let l = k + 1; l < speaker1Embeddings.length; l++) {
            const score = this.cosineSimilarity(speaker1Embeddings[k], speaker1Embeddings[l]);
            trials.push({ label: 1, score });
          }
        }

        // Different speaker trials (negative)
        for (let k = 0; k < Math.min(speaker1Embeddings.length, speaker2Embeddings.length); k++) {
          const score = this.cosineSimilarity(speaker1Embeddings[k], speaker2Embeddings[k]);
          trials.push({ label: 0, score });
        }
      }
    }

    // Compute EER
    trials.sort((a, b) => a.score - b.score);

    let minDiff = Infinity;
    let eer = 0;

    for (let threshold = 0; threshold <= 1; threshold += 0.01) {
      let fa = 0; // False accept
      let fr = 0; // False reject

      for (const trial of trials) {
        if (trial.label === 0 && trial.score > threshold) {
          fa++;
        } else if (trial.label === 1 && trial.score <= threshold) {
          fr++;
        }
      }

      const far = fa / (fa + trials.filter(t => t.label === 0).length + 1e-8);
      const frr = fr / (fr + trials.filter(t => t.label === 1).length + 1e-8);

      const diff = Math.abs(far - frr);
      if (diff < minDiff) {
        minDiff = diff;
        eer = (far + frr) / 2;
      }
    }

    return eer;
  }
}

// ============================================================================
// Emotion Recognition Benchmark
// ============================================================================

export interface IEMOCAPConfig extends BenchmarkConfig {
  name: 'iemocap';
  numEmotions: number;
}

export class IEMOCAPBenchmark {
  private config: IEMOCAPConfig;

  constructor(config?: Partial<IEMOCAPConfig>) {
    this.config = {
      name: 'iemocap',
      dataset: 'iemocap',
      metrics: ['accuracy', 'uar', 'f1'],
      numEmotions: 4,
      ...config
    };
  }

  /**
   * Run IEMOCAP benchmark
   */
  async benchmark(
    model: (audio: AudioInput) => Promise<string>,
    dataset: AudioInput[],
    emotions: string[]
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let correct = 0;
    const emotionCounts: Record<string, number> = {};
    const emotionCorrect: Record<string, number> = {};

    for (let i = 0; i < dataset.length; i++) {
      const prediction = await model(dataset[i]);
      const groundTruth = emotions[i];

      if (!emotionCounts[groundTruth]) {
        emotionCounts[groundTruth] = 0;
        emotionCorrect[groundTruth] = 0;
      }

      emotionCounts[groundTruth]++;

      if (prediction === groundTruth) {
        correct++;
        emotionCorrect[groundTruth]++;
      }
    }

    // Compute Unweighted Average Recall (UAR)
    let totalRecall = 0;
    for (const emotion in emotionCounts) {
      const recall = emotionCorrect[emotion] / emotionCounts[emotion];
      totalRecall += recall;
    }
    const uar = totalRecall / Object.keys(emotionCounts).length;

    const duration = Date.now() - startTime;

    return {
      benchmark: this.config.name,
      model: 'emotion-recognition',
      metrics: {
        accuracy: correct / dataset.length,
        uar
      },
      timestamp: Date.now(),
      duration
    };
  }
}
