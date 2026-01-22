/**
 * Unit tests for vector utility functions
 */

import {
  euclideanDistance,
  cosineSimilarity,
  dotProduct,
  manhattanDistance,
  normalizeVector,
  validateVectorDimension,
  cloneVector,
  addVectors,
  subtractVectors,
  multiplyScalar,
  meanVector,
  vectorMagnitude,
  isNormalized,
} from '../../src/utils/vector.js';
import { NormalizationMethod } from '../../src/types/index.js';

describe('Vector Utilities', () => {
  describe('euclideanDistance', () => {
    it('should calculate correct Euclidean distance', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([4, 5, 6]);
      const distance = euclideanDistance(a, b);

      expect(distance).toBeCloseTo(5.196, 3);
    });

    it('should throw error for mismatched dimensions', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([4, 5]);

      expect(() => euclideanDistance(a, b)).toThrow();
    });

    it('should return 0 for identical vectors', () => {
      const a = new Float32Array([1, 2, 3]);
      const distance = euclideanDistance(a, a);

      expect(distance).toBe(0);
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate correct cosine similarity', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([2, 4, 6]);
      const similarity = cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = new Float32Array([1, 0]);
      const b = new Float32Array([0, 1]);
      const similarity = cosineSimilarity(a, b);

      expect(similarity).toBe(0);
    });

    it('should return 1 for identical vectors', () => {
      const a = new Float32Array([1, 2, 3]);
      const similarity = cosineSimilarity(a, a);

      expect(similarity).toBe(1);
    });
  });

  describe('dotProduct', () => {
    it('should calculate correct dot product', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([4, 5, 6]);
      const product = dotProduct(a, b);

      expect(product).toBe(32);
    });
  });

  describe('manhattanDistance', () => {
    it('should calculate correct Manhattan distance', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([4, 5, 6]);
      const distance = manhattanDistance(a, b);

      expect(distance).toBe(9);
    });
  });

  describe('normalizeVector', () => {
    it('should normalize vector using L2 norm', () => {
      const vector = new Float32Array([3, 4]);
      const normalized = normalizeVector(vector, NormalizationMethod.L2);

      expect(normalized[0]).toBeCloseTo(0.6, 5);
      expect(normalized[1]).toBeCloseTo(0.8, 5);
    });

    it('should normalize vector using max norm', () => {
      const vector = new Float32Array([3, 4]);
      const normalized = normalizeVector(vector, NormalizationMethod.MAX);

      expect(normalized[0]).toBeCloseTo(0.75, 5);
      expect(normalized[1]).toBeCloseTo(1.0, 5);
    });

    it('should return original vector for NONE normalization', () => {
      const vector = new Float32Array([3, 4]);
      const normalized = normalizeVector(vector, NormalizationMethod.NONE);

      expect(normalated).toEqual(vector);
    });

    it('should handle zero vector', () => {
      const vector = new Float32Array([0, 0, 0]);
      const normalized = normalizeVector(vector, NormalizationMethod.L2);

      expect(normalated).toEqual(vector);
    });
  });

  describe('validateVectorDimension', () => {
    it('should return true for matching dimensions', () => {
      const vector = new Float32Array([1, 2, 3]);
      const valid = validateVectorDimension(vector, 3);

      expect(valid).toBe(true);
    });

    it('should return false for mismatched dimensions', () => {
      const vector = new Float32Array([1, 2, 3]);
      const valid = validateVectorDimension(vector, 4);

      expect(valid).toBe(false);
    });
  });

  describe('cloneVector', () => {
    it('should create a deep copy of vector', () => {
      const original = new Float32Array([1, 2, 3]);
      const clone = cloneVector(original);

      expect(clone).toEqual(original);
      expect(clone).not.toBe(original);
    });
  });

  describe('addVectors', () => {
    it('should add two vectors', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([4, 5, 6]);
      const result = addVectors(a, b);

      expect(result).toEqual(new Float32Array([5, 7, 9]));
    });

    it('should throw error for mismatched dimensions', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([4, 5]);

      expect(() => addVectors(a, b)).toThrow();
    });
  });

  describe('subtractVectors', () => {
    it('should subtract two vectors', () => {
      const a = new Float32Array([4, 5, 6]);
      const b = new Float32Array([1, 2, 3]);
      const result = subtractVectors(a, b);

      expect(result).toEqual(new Float32Array([3, 3, 3]));
    });
  });

  describe('multiplyScalar', () => {
    it('should multiply vector by scalar', () => {
      const vector = new Float32Array([1, 2, 3]);
      const result = multiplyScalar(vector, 2);

      expect(result).toEqual(new Float32Array([2, 4, 6]));
    });
  });

  describe('meanVector', () => {
    it('should calculate mean of vectors', () => {
      const vectors = [
        new Float32Array([1, 2, 3]),
        new Float32Array([4, 5, 6]),
        new Float32Array([7, 8, 9]),
      ];
      const mean = meanVector(vectors);

      expect(mean).toEqual(new Float32Array([4, 5, 6]));
    });

    it('should throw error for empty array', () => {
      expect(() => meanVector([])).toThrow();
    });
  });

  describe('vectorMagnitude', () => {
    it('should calculate correct magnitude', () => {
      const vector = new Float32Array([3, 4]);
      const magnitude = vectorMagnitude(vector);

      expect(magnitude).toBe(5);
    });
  });

  describe('isNormalized', () => {
    it('should return true for normalized vector', () => {
      const vector = new Float32Array([0.6, 0.8]);

      expect(isNormalized(vector)).toBe(true);
    });

    it('should return false for non-normalized vector', () => {
      const vector = new Float32Array([3, 4]);

      expect(isNormalized(vector)).toBe(false);
    });
  });
});
