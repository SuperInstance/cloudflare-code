/**
 * Metrics Calculator Tests
 */

import { describe, it, expect } from 'vitest';
import { MetricsCalculator } from '../evaluation/metrics';

describe('MetricsCalculator', () => {
  describe('Loss Calculation', () => {
    it('should calculate MSE loss', () => {
      const predictions = [1.0, 2.0, 3.0, 4.0];
      const targets = [1.1, 2.1, 2.9, 4.1];

      const metrics = MetricsCalculator.calculateLoss(predictions, targets);

      expect(metrics.mse).toBeGreaterThan(0);
      expect(metrics.mae).toBeGreaterThan(0);
      expect(metrics.rmse).toBeGreaterThan(0);
    });

    it('should handle empty arrays', () => {
      expect(() => {
        MetricsCalculator.calculateLoss([], []);
      }).toThrow();
    });

    it('should handle mismatched array lengths', () => {
      expect(() => {
        MetricsCalculator.calculateLoss([1, 2, 3], [1, 2]);
      }).toThrow();
    });
  });

  describe('Accuracy Calculation', () => {
    it('should calculate exact match accuracy', () => {
      const predictions = ['cat', 'dog', 'bird', 'cat'];
      const targets = ['cat', 'dog', 'fish', 'cat'];

      const accuracy = MetricsCalculator.calculateAccuracy(predictions, targets);

      expect(accuracy).toBe(0.75);
    });

    it('should be case-insensitive', () => {
      const predictions = ['Cat', 'DOG', 'Bird'];
      const targets = ['cat', 'dog', 'bird'];

      const accuracy = MetricsCalculator.calculateAccuracy(predictions, targets);

      expect(accuracy).toBe(1.0);
    });
  });

  describe('BLEU Score', () => {
    it('should calculate BLEU score', () => {
      const reference = ['the', 'cat', 'is', 'on', 'the', 'mat'];
      const hypothesis = ['the', 'cat', 'is', 'on', 'the', 'mat'];

      const bleu = MetricsCalculator.calculateBLEU(reference, hypothesis);

      expect(bleu).toBe(1.0);
    });

    it('should penalize imperfect matches', () => {
      const reference = ['the', 'cat', 'is', 'on', 'the', 'mat'];
      const hypothesis = ['the', 'cat', 'sat', 'on', 'the', 'mat'];

      const bleu = MetricsCalculator.calculateBLEU(reference, hypothesis);

      expect(bleu).toBeGreaterThan(0);
      expect(bleu).toBeLessThan(1);
    });
  });

  describe('ROUGE Score', () => {
    it('should calculate ROUGE-1', () => {
      const reference = 'the cat is on the mat';
      const hypothesis = 'the cat sat on the mat';

      const rouge = MetricsCalculator.calculateROUGE(reference, hypothesis);

      expect(rouge.rouge1).toBeGreaterThan(0);
      expect(rouge.rouge1).toBeLessThanOrEqual(1);
    });

    it('should calculate ROUGE-2', () => {
      const reference = 'the cat is on the mat';
      const hypothesis = 'the cat sat on the mat';

      const rouge = MetricsCalculator.calculateROUGE(reference, hypothesis);

      expect(rouge.rouge2).toBeGreaterThanOrEqual(0);
      expect(rouge.rouge2).toBeLessThanOrEqual(1);
    });

    it('should calculate ROUGE-L', () => {
      const reference = 'the cat is on the mat';
      const hypothesis = 'the cat sat on the mat';

      const rouge = MetricsCalculator.calculateROUGE(reference, hypothesis);

      expect(rouge.rougeL).toBeGreaterThan(0);
      expect(rouge.rougeL).toBeLessThanOrEqual(1);
    });
  });

  describe('Perplexity', () => {
    it('should calculate perplexity from loss', () => {
      const loss = 2.0;
      const perplexity = MetricsCalculator.calculatePerplexity(loss);

      expect(perplexity).toBe(Math.exp(loss));
    });

    it('should handle low loss', () => {
      const loss = 0.1;
      const perplexity = MetricsCalculator.calculatePerplexity(loss);

      expect(perplexity).toBeCloseTo(1.105, 2);
    });

    it('should handle high loss', () => {
      const loss = 5.0;
      const perplexity = MetricsCalculator.calculatePerplexity(loss);

      expect(perplexity).toBeGreaterThan(100);
    });
  });

  describe('F1 Score', () => {
    it('should calculate F1 score', () => {
      const predictions = ['hello world', 'foo bar'];
      const targets = ['hello world', 'foo bar'];

      const { precision, recall, f1 } = MetricsCalculator.calculateF1Score(predictions, targets);

      expect(precision).toBe(1.0);
      expect(recall).toBe(1.0);
      expect(f1).toBe(1.0);
    });

    it('should handle partial matches', () => {
      const predictions = ['hello world test', 'foo bar'];
      const targets = ['hello world', 'foo bar baz'];

      const { precision, recall, f1 } = MetricsCalculator.calculateF1Score(predictions, targets);

      expect(precision).toBeGreaterThan(0);
      expect(recall).toBeGreaterThan(0);
      expect(f1).toBeGreaterThan(0);
    });
  });

  describe('Semantic Similarity', () => {
    it('should calculate similarity for identical texts', () => {
      const text1 = 'the cat is on the mat';
      const text2 = 'the cat is on the mat';

      const similarity = MetricsCalculator.calculateSemanticSimilarity(text1, text2);

      expect(similarity).toBe(1.0);
    });

    it('should calculate similarity for different texts', () => {
      const text1 = 'the cat is on the mat';
      const text2 = 'the dog is on the rug';

      const similarity = MetricsCalculator.calculateSemanticSimilarity(text1, text2);

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('Token Statistics', () => {
    it('should calculate token stats', () => {
      const texts = ['hello world', 'foo bar baz', 'test'];

      const stats = MetricsCalculator.calculateTokenStats(texts);

      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.avgTokens).toBeGreaterThan(0);
      expect(stats.minTokens).toBeGreaterThan(0);
      expect(stats.maxTokens).toBeGreaterThanOrEqual(stats.minTokens);
    });

    it('should handle empty array', () => {
      const stats = MetricsCalculator.calculateTokenStats([]);

      expect(stats.totalTokens).toBe(0);
      expect(stats.avgTokens).toBe(0);
    });

    it('should handle single text', () => {
      const texts = ['hello world'];

      const stats = MetricsCalculator.calculateTokenStats(texts);

      expect(stats.totalTokens).toBe(2);
      expect(stats.minTokens).toBe(2);
      expect(stats.maxTokens).toBe(2);
    });
  });
});
