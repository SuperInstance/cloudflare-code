/**
 * Data processing utilities
 */

// @ts-nocheck
import type { BatchInput, ImageInput, AudioInput, TextInput } from '../types';

export class DataUtils {
  /**
   * Create batches from data
   */
  static createBatches<T>(data: T[], batchSize: number): T[][] {
    const batches: T[][] = [];

    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Shuffle array in place
   */
  static shuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * Split data into train/validation/test
   */
  static splitData<T>(
    data: T[],
    trainRatio: number = 0.8,
    valRatio: number = 0.1,
    testRatio: number = 0.1
  ): { train: T[]; validation: T[]; test: T[] } {
    const total = data.length;
    const trainEnd = Math.floor(total * trainRatio);
    const valEnd = trainEnd + Math.floor(total * valRatio);

    return {
      train: data.slice(0, trainEnd),
      validation: data.slice(trainEnd, valEnd),
      test: data.slice(valEnd)
    };
  }

  /**
   * Normalize features
   */
  static normalizeFeatures(features: number[][]): number[][] {
    const numFeatures = features[0].length;
    const means: number[] = new Array(numFeatures).fill(0);
    const stds: number[] = new Array(numFeatures).fill(0);

    // Compute means
    for (const sample of features) {
      for (let i = 0; i < numFeatures; i++) {
        means[i] += sample[i];
      }
    }
    for (let i = 0; i < numFeatures; i++) {
      means[i] /= features.length;
    }

    // Compute standard deviations
    for (const sample of features) {
      for (let i = 0; i < numFeatures; i++) {
        stds[i] += (sample[i] - means[i]) ** 2;
      }
    }
    for (let i = 0; i < numFeatures; i++) {
      stds[i] = Math.sqrt(stds[i] / features.length);
    }

    // Normalize
    return features.map(sample =>
      sample.map((value, i) => (value - means[i]) / (stds[i] + 1e-8))
    );
  }

  /**
   * Create DataLoader for batched processing
   */
  static createDataLoader<T>(
    data: T[],
    batchSize: number,
    shuffle: boolean = true
  ): DataLoader<T> {
    return new DataLoader(data, batchSize, shuffle);
  }

  /**
   * One-hot encode labels
   */
  static oneHotEncode(labels: number[], numClasses: number): number[][] {
    return labels.map(label => {
      const encoded = new Array(numClasses).fill(0);
      encoded[label] = 1;
      return encoded;
    });
  }

  /**
   * Decode one-hot labels
   */
  static oneHotDecode(encoded: number[][]): number[] {
    return encoded.map(e => e.indexOf(Math.max(...e)));
  }

  /**
   * Pad sequences to same length
   */
  static padSequences(sequences: number[][], padding: number = 0, maxLength?: number): number[][] {
    const length = maxLength || Math.max(...sequences.map(s => s.length));

    return sequences.map(sequence => {
      const padded = [...sequence];
      while (padded.length < length) {
        padded.push(padding);
      }
      return padded;
    });
  }

  /**
   * Truncate sequences to max length
   */
  static truncateSequences(sequences: number[][], maxLength: number): number[][] {
    return sequences.map(sequence => sequence.slice(0, maxLength));
  }

  /**
   * Create attention mask
   */
  static createAttentionMask(lengths: number[], maxLength: number): number[][] {
    return lengths.map(length => {
      const mask = new Array(maxLength).fill(0);
      for (let i = 0; i < Math.min(length, maxLength); i++) {
        mask[i] = 1;
      }
      return mask;
    });
  }

  /**
   * Sample from dataset with replacement
   */
  static sampleWithReplacement<T>(data: T[], sampleSize: number): T[] {
    return Array.from({ length: sampleSize }, () => data[Math.floor(Math.random() * data.length)]);
  }

  /**
   * Sample from dataset without replacement
   */
  static sampleWithoutReplacement<T>(data: T[], sampleSize: number): T[] {
    const sampled = [...data];
    this.shuffle(sampled);
    return sampled.slice(0, sampleSize);
  }

  /**
   * Stratified split
   */
  static stratifiedSplit<T>(
    data: T[],
    labels: number[],
    trainRatio: number = 0.8,
    valRatio: number = 0.1,
    testRatio: number = 0.1
  ): { train: T[]; validation: T[]; test: T[] } {
    const labelGroups = new Map<number, T[]>();

    for (let i = 0; i < data.length; i++) {
      const label = labels[i];
      if (!labelGroups.has(label)) {
        labelGroups.set(label, []);
      }
      labelGroups.get(label)!.push(data[i]);
    }

    const train: T[] = [];
    const validation: T[] = [];
    const test: T[] = [];

    for (const samples of labelGroups.values()) {
      const split = this.splitData(samples, trainRatio, valRatio, testRatio);
      train.push(...split.train);
      validation.push(...split.validation);
      test.push(...split.test);
    }

    return { train, validation, test };
  }

  /**
   * Balance dataset by oversampling minority classes
   */
  static balanceDataset<T>(data: T[], labels: number[]): T[] {
    const labelCounts = new Map<number, number>();

    for (const label of labels) {
      labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
    }

    const maxCount = Math.max(...labelCounts.values());
    const balanced: T[] = [];

    for (let i = 0; i < data.length; i++) {
      const label = labels[i];
      const count = labelCounts.get(label)!;

      balanced.push(data[i]);

      // Oversample minority classes
      const oversampleFactor = Math.floor(maxCount / count) - 1;
      for (let j = 0; j < oversampleFactor; j++) {
        balanced.push(data[i]);
      }
    }

    return balanced;
  }

  /**
   * Apply data augmentation
   */
  static applyAugmentation<T>(
    data: T[],
    augmentations: Array<(data: T) => T>,
    augmentationFactor: number = 1
  ): T[] {
    const augmented: T[] = [...data];

    for (const sample of data) {
      for (let i = 0; i < augmentationFactor; i++) {
        const aug = augmentations[Math.floor(Math.random() * augmentations.length)];
        augmented.push(aug(sample));
      }
    }

    return augmented;
  }
}

/**
 * DataLoader for batched iteration
 */
export class DataLoader<T> {
  private data: T[];
  private batchSize: number;
  private shuffle: boolean;
  private currentIndex: number = 0;

  constructor(data: T[], batchSize: number, shuffle: boolean = true) {
    this.data = [...data];
    this.batchSize = batchSize;
    this.shuffle = shuffle;

    if (this.shuffle) {
      DataUtils.shuffle(this.data);
    }
  }

  /**
   * Get next batch
   */
  nextBatch(): T[] | null {
    if (this.currentIndex >= this.data.length) {
      return null;
    }

    const batch = this.data.slice(
      this.currentIndex,
      this.currentIndex + this.batchSize
    );

    this.currentIndex += this.batchSize;

    return batch;
  }

  /**
   * Reset to beginning
   */
  reset(): void {
    this.currentIndex = 0;

    if (this.shuffle) {
      DataUtils.shuffle(this.data);
    }
  }

  /**
   * Get total number of batches
   */
  getNumBatches(): number {
    return Math.ceil(this.data.length / this.batchSize);
  }

  /**
   * Iterate over all batches
   */
  *batches(): Generator<T[], void, void> {
    this.reset();

    let batch = this.nextBatch();
    while (batch !== null) {
      yield batch;
      batch = this.nextBatch();
    }
  }
}
