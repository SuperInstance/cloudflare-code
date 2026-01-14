/**
 * Cross-Modal Embedding Evaluation
 * Metrics and benchmarks for evaluating embedding quality
 */

import type { CrossModalEmbedding, Modality } from '../types';

export interface EvaluationConfig {
  metrics: EmbeddingMetric[];
  retrievalKs: number[];
  classificationTasks: string[];
}

export type EmbeddingMetric =
  | 'retrieval_recall'
  | 'retrieval_precision'
  | 'retrieval_map'
  | 'retrieval_mrr'
  | 'classification_accuracy'
  | 'clustering_purity'
  | 'clustering_nmi'
  | 'alignment_quality'
  | 'domain_transfer';

export interface RetrievalResults {
  recallAtK: Map<number, number>;
  precisionAtK: Map<number, number>;
  map: number;
  mrr: number;
}

export interface ClassificationResults {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  confusionMatrix: number[][];
}

export interface ClusteringResults {
  purity: number;
  nmi: number;
  ari: number;
}

export class EmbeddingEvaluator {
  private config: EvaluationConfig;

  constructor(config?: Partial<EvaluationConfig>) {
    this.config = {
      metrics: ['retrieval_recall', 'retrieval_map', 'classification_accuracy'],
      retrievalKs: [1, 5, 10, 50],
      classificationTasks: [],
      ...config
    };
  }

  /**
   * Evaluate embeddings comprehensively
   */
  async evaluate(
    queryEmbeddings: Float32Array[],
    targetEmbeddings: Float32Array[],
    labels: string[],
    queryModalities: Modality[],
    targetModalities: Modality[]
  ): Promise<{
    retrieval?: RetrievalResults;
    classification?: ClassificationResults;
    clustering?: ClusteringResults;
    alignment?: number;
  }> {
    const results: {
      retrieval?: RetrievalResults;
      classification?: ClassificationResults;
      clustering?: ClusteringResults;
      alignment?: number;
    } = {};

    for (const metric of this.config.metrics) {
      switch (metric) {
        case 'retrieval_recall':
        case 'retrieval_precision':
        case 'retrieval_map':
        case 'retrieval_mrr':
          results.retrieval = this.evaluateRetrieval(queryEmbeddings, targetEmbeddings, labels);
          break;

        case 'classification_accuracy':
          results.classification = this.evaluateClassification(
            queryEmbeddings,
            labels
          );
          break;

        case 'clustering_purity':
        case 'clustering_nmi':
          results.clustering = this.evaluateClustering(queryEmbeddings, labels);
          break;

        case 'alignment_quality':
          results.alignment = this.evaluateAlignment(queryEmbeddings, targetEmbeddings);
          break;
      }
    }

    return results;
  }

  /**
   * Evaluate retrieval performance
   */
  evaluateRetrieval(
    queryEmbeddings: Float32Array[],
    targetEmbeddings: Float32Array[],
    labels: string[]
  ): RetrievalResults {
    const recallAtK = new Map<number, number>();
    const precisionAtK = new Map<number, number>();
    let totalReciprocalRank = 0;

    for (const k of this.config.retrievalKs) {
      let totalRecall = 0;
      let totalPrecision = 0;

      for (let i = 0; i < queryEmbeddings.length; i++) {
        const similarities = this.computeSimilarities(queryEmbeddings[i], targetEmbeddings);
        const topKIndices = this.topKIndices(similarities, k);

        const relevantCount = topKIndices.filter(
          idx => labels[idx] === labels[i]
        ).length;

        totalRecall += relevantCount / this.countRelevant(labels, labels[i]);
        totalPrecision += relevantCount / k;

        // MRR
        const rank = similarities
          .map((sim, idx) => ({ sim, idx }))
          .sort((a, b) => b.sim - a.sim)
          .findIndex(item => labels[item.idx] === labels[i]);

        if (rank >= 0) {
          totalReciprocalRank += 1 / (rank + 1);
        }
      }

      recallAtK.set(k, totalRecall / queryEmbeddings.length);
      precisionAtK.set(k, totalPrecision / queryEmbeddings.length);
    }

    // Compute MAP
    const map = this.computeMAP(queryEmbeddings, targetEmbeddings, labels);

    return {
      recallAtK,
      precisionAtK,
      map,
      mrr: totalReciprocalRank / queryEmbeddings.length
    };
  }

  /**
   * Evaluate classification performance
   */
  evaluateClassification(
    embeddings: Float32Array[],
    labels: string[]
  ): ClassificationResults {
    // Use k-NN classification
    const k = 5;
    const predictions = this.kNNClassify(embeddings, embeddings, labels, k);

    const uniqueLabels = Array.from(new Set(labels));
    const confusionMatrix = this.computeConfusionMatrix(labels, predictions, uniqueLabels);

    const accuracy = this.computeAccuracy(labels, predictions);
    const { precision, recall, f1 } = this.computePrecisionRecallF1(confusionMatrix);

    return {
      accuracy,
      precision,
      recall,
      f1,
      confusionMatrix
    };
  }

  /**
   * Evaluate clustering quality
   */
  evaluateClustering(
    embeddings: Float32Array[],
    labels: string[]
  ): ClusteringResults {
    // K-means clustering
    const numClusters = new Set(labels).size;
    const clusterAssignments = this.kMeans(embeddings, numClusters);

    const purity = this.computePurity(clusterAssignments, labels);
    const nmi = this.computeNMI(clusterAssignments, labels);
    const ari = this.computeARI(clusterAssignments, labels);

    return { purity, nmi, ari };
  }

  /**
   * Evaluate cross-modal alignment
   */
  evaluateAlignment(
    embeddings1: Float32Array[],
    embeddings2: Float32Array[]
  ): number {
    // Compute average cosine similarity between aligned pairs
    let totalSimilarity = 0;
    const numPairs = Math.min(embeddings1.length, embeddings2.length);

    for (let i = 0; i < numPairs; i++) {
      const similarity = this.cosineSimilarity(embeddings1[i], embeddings2[i]);
      totalSimilarity += similarity;
    }

    return totalSimilarity / numPairs;
  }

  /**
   * Compute similarities between query and all targets
   */
  private computeSimilarities(query: Float32Array, targets: Float32Array[]): Float32Array {
    const similarities = new Float32Array(targets.length);

    for (let i = 0; i < targets.length; i++) {
      similarities[i] = this.cosineSimilarity(query, targets[i]);
    }

    return similarities;
  }

  /**
   * Cosine similarity
   */
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

  /**
   * Get top K indices
   */
  private topKIndices(similarities: Float32Array, k: number): number[] {
    const indexed = similarities.map((sim, idx) => ({ sim, idx }));
    indexed.sort((a, b) => b.sim - a.sim);
    return indexed.slice(0, k).map(item => item.idx);
  }

  /**
   * Count relevant items
   */
  private countRelevant(labels: string[], label: string): number {
    return labels.filter(l => l === label).length;
  }

  /**
   * Compute Mean Average Precision
   */
  private computeMAP(
    queryEmbeddings: Float32Array[],
    targetEmbeddings: Float32Array[],
    labels: string[]
  ): number {
    let totalAP = 0;

    for (let i = 0; i < queryEmbeddings.length; i++) {
      const similarities = this.computeSimilarities(queryEmbeddings[i], targetEmbeddings);
      const ranked = similarities
        .map((sim, idx) => ({ sim, idx, label: labels[idx] }))
        .sort((a, b) => b.sim - a.sim);

      const queryLabel = labels[i];
      let precisionSum = 0;
      let relevantCount = 0;

      for (let j = 0; j < ranked.length; j++) {
        if (ranked[j].label === queryLabel) {
          relevantCount++;
          precisionSum += relevantCount / (j + 1);
        }
      }

      const numRelevant = this.countRelevant(labels, queryLabel);
      totalAP += numRelevant > 0 ? precisionSum / numRelevant : 0;
    }

    return totalAP / queryEmbeddings.length;
  }

  /**
   * K-NN classification
   */
  private kNNClassify(
    trainEmbeddings: Float32Array[],
    testEmbeddings: Float32Array[],
    trainLabels: string[],
    k: number
  ): string[] {
    const predictions: string[] = [];

    for (const testEmbedding of testEmbeddings) {
      const similarities = this.computeSimilarities(testEmbedding, trainEmbeddings);
      const topK = this.topKIndices(similarities, k);

      // Majority vote
      const labelCounts = new Map<string, number>();
      for (const idx of topK) {
        const label = trainLabels[idx];
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
      }

      let maxCount = 0;
      let predictedLabel = '';
      for (const [label, count] of labelCounts) {
        if (count > maxCount) {
          maxCount = count;
          predictedLabel = label;
        }
      }

      predictions.push(predictedLabel);
    }

    return predictions;
  }

  /**
   * Compute confusion matrix
   */
  private computeConfusionMatrix(
    trueLabels: string[],
    predLabels: string[],
    uniqueLabels: string[]
  ): number[][] {
    const n = uniqueLabels.length;
    const matrix: number[][] = Array(n)
      .fill(0)
      .map(() => Array(n).fill(0));

    for (let i = 0; i < trueLabels.length; i++) {
      const trueIdx = uniqueLabels.indexOf(trueLabels[i]);
      const predIdx = uniqueLabels.indexOf(predLabels[i]);
      if (trueIdx >= 0 && predIdx >= 0) {
        matrix[trueIdx][predIdx]++;
      }
    }

    return matrix;
  }

  /**
   * Compute accuracy
   */
  private computeAccuracy(trueLabels: string[], predLabels: string[]): number {
    let correct = 0;
    for (let i = 0; i < trueLabels.length; i++) {
      if (trueLabels[i] === predLabels[i]) {
        correct++;
      }
    }
    return correct / trueLabels.length;
  }

  /**
   * Compute precision, recall, and F1
   */
  private computePrecisionRecallF1(confusionMatrix: number[][]): {
    precision: number;
    recall: number;
    f1: number;
  } {
    const n = confusionMatrix.length;
    let totalPrecision = 0;
    let totalRecall = 0;

    for (let i = 0; i < n; i++) {
      const tp = confusionMatrix[i][i];
      const fp = confusionMatrix
        .map((row, idx) => (idx !== i ? row[i] : 0))
        .reduce((a, b) => a + b, 0);
      const fn = confusionMatrix[i].reduce((a, b) => a + b, 0) - tp;

      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;

      totalPrecision += precision;
      totalRecall += recall;
    }

    const avgPrecision = totalPrecision / n;
    const avgRecall = totalRecall / n;
    const f1 =
      avgPrecision + avgRecall > 0
        ? 2 * avgPrecision * avgRecall / (avgPrecision + avgRecall)
        : 0;

    return {
      precision: avgPrecision,
      recall: avgRecall,
      f1
    };
  }

  /**
   * K-means clustering
   */
  private kMeans(embeddings: Float32Array[], numClusters: number): number[] {
    const assignments: number[] = new Array(embeddings.length).fill(0);
    const centroids: Float32Array[] = [];

    // Initialize centroids randomly
    for (let i = 0; i < numClusters; i++) {
      const idx = Math.floor(Math.random() * embeddings.length);
      centroids.push(new Float32Array(embeddings[idx]));
    }

    // K-means iterations
    for (let iter = 0; iter < 10; iter++) {
      // Assign to nearest centroid
      for (let i = 0; i < embeddings.length; i++) {
        let minDist = Infinity;
        let cluster = 0;

        for (let c = 0; c < numClusters; c++) {
          const dist = this.euclideanDistance(embeddings[i], centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            cluster = c;
          }
        }

        assignments[i] = cluster;
      }

      // Update centroids
      for (let c = 0; c < numClusters; c++) {
        const clusterPoints = embeddings.filter((_, i) => assignments[i] === c);
        if (clusterPoints.length > 0) {
          const mean = this.computeMean(clusterPoints);
          centroids[c] = mean;
        }
      }
    }

    return assignments;
  }

  /**
   * Compute mean of embeddings
   */
  private computeMean(embeddings: Float32Array[]): Float32Array {
    const dim = embeddings[0].length;
    const mean = new Float32Array(dim);

    for (const emb of embeddings) {
      for (let i = 0; i < dim; i++) {
        mean[i] += emb[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      mean[i] /= embeddings.length;
    }

    return mean;
  }

  /**
   * Euclidean distance
   */
  private euclideanDistance(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Compute clustering purity
   */
  private computePurity(assignments: number[], labels: string[]): number {
    const numClusters = new Set(assignments).size;
    let totalCorrect = 0;

    for (let c = 0; c < numClusters; c++) {
      const clusterIndices = assignments
        .map((a, i) => (a === c ? i : -1))
        .filter(i => i >= 0);

      const clusterLabels = clusterIndices.map(i => labels[i]);
      const labelCounts = new Map<string, number>();

      for (const label of clusterLabels) {
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
      }

      let maxCount = 0;
      for (const count of labelCounts.values()) {
        maxCount = Math.max(maxCount, count);
      }

      totalCorrect += maxCount;
    }

    return totalCorrect / assignments.length;
  }

  /**
   * Compute Normalized Mutual Information
   */
  private computeNMI(assignments: number[], labels: string[]): number {
    const clusterEntropy = this.computeEntropy(assignments);
    const labelEntropy = this.computeEntropy(labels.map(l => l.charCodeAt(0)));
    const mutualInfo = this.computeMutualInformation(assignments, labels);

    const normalization = Math.sqrt(clusterEntropy * labelEntropy);
    return normalization > 0 ? mutualInfo / normalization : 0;
  }

  /**
   * Compute Adjusted Rand Index
   */
  private computeARI(assignments: number[], labels: string[]): number {
    // Simplified ARI computation
    const n = assignments.length;
    const labelMap = new Map<string, number>();
    let nextLabelIdx = 0;

    const labelIndices = labels.map(l => {
      if (!labelMap.has(l)) {
        labelMap.set(l, nextLabelIdx++);
      }
      return labelMap.get(l)!;
    });

    let a = 0; // Pairs in same cluster and same class
    let b = 0; // Pairs in different cluster and different class

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const sameCluster = assignments[i] === assignments[j];
        const sameClass = labelIndices[i] === labelIndices[j];

        if (sameCluster && sameClass) a++;
        if (!sameCluster && !sameClass) b++;
      }
    }

    const totalPairs = (n * (n - 1)) / 2;
    const c = totalPairs - a - b;

    const expectedA = ((a + b) * (a + c)) / totalPairs;
    const expectedB = ((a + b) * (b + c)) / totalPairs;

    const maxA = ((a + b) + (a + c)) / 2;
    const maxB = ((a + b) + (b + c)) / 2;

    const numerator = a - expectedA;
    const denominator = (maxA - expectedA + maxB - expectedB) / 2;

    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Compute entropy
   */
  private computeEntropy(values: number[]): number {
    const counts = new Map<number, number>();
    for (const v of values) {
      counts.set(v, (counts.get(v) || 0) + 1);
    }

    let entropy = 0;
    const total = values.length;
    for (const count of counts.values()) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Compute mutual information
   */
  private computeMutualInformation(assignments: number[], labels: string[]): number {
    const clusterCounts = new Map<number, number>();
    const labelCounts = new Map<string, number>();
    const jointCounts = new Map<string, Map<number, number>>();

    for (let i = 0; i < assignments.length; i++) {
      const cluster = assignments[i];
      const label = labels[i];

      clusterCounts.set(cluster, (clusterCounts.get(cluster) || 0) + 1);
      labelCounts.set(label, (labelCounts.get(label) || 0) + 1);

      if (!jointCounts.has(label)) {
        jointCounts.set(label, new Map());
      }
      jointCounts.get(label)!.set(cluster, (jointCounts.get(label)!.get(cluster) || 0) + 1);
    }

    let mi = 0;
    const total = assignments.length;

    for (const [label, clusterMap] of jointCounts) {
      const labelProb = (labelCounts.get(label) || 0) / total;

      for (const [cluster, count] of clusterMap) {
        const clusterProb = (clusterCounts.get(cluster) || 0) / total;
        const jointProb = count / total;

        mi += jointProb * Math.log2(jointProb / (labelProb * clusterProb));
      }
    }

    return mi;
  }
}
