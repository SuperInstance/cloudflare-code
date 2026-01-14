/**
 * Utils Module Tests
 * Tests for image processing and embedding utilities
 */

import { describe, it, expect } from 'vitest';
import {
  isValidImage,
  detectImageFormat,
  getMimeType,
  cosineSimilarity,
  normalizeVector,
  validateEmbedding
} from '../src/utils';

describe('Utils Module', () => {
  describe('Image Validation', () => {
    it('should validate PNG image', () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D
      ]);

      expect(isValidImage(pngBuffer)).toBe(true);
      expect(detectImageFormat(pngBuffer)).toBe('PNG');
      expect(getMimeType('PNG')).toBe('image/png');
    });

    it('should validate JPEG image', () => {
      const jpegBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46
      ]);

      expect(isValidImage(jpegBuffer)).toBe(true);
      expect(detectImageFormat(jpegBuffer)).toBe('JPEG');
    });

    it('should reject invalid image', () => {
      const invalidBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);

      expect(isValidImage(invalidBuffer)).toBe(false);
    });

    it('should handle empty buffer', () => {
      const emptyBuffer = Buffer.from([]);

      expect(isValidImage(emptyBuffer)).toBe(false);
    });
  });

  describe('Vector Operations', () => {
    it('should calculate cosine similarity', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [4, 5, 6];

      const similarity = cosineSimilarity(vec1, vec2);

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should calculate perfect similarity', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2, 3];

      const similarity = cosineSimilarity(vec1, vec2);

      expect(similarity).toBeCloseTo(1);
    });

    it('should calculate zero similarity for orthogonal vectors', () => {
      const vec1 = [1, 0];
      const vec2 = [0, 1];

      const similarity = cosineSimilarity(vec1, vec2);

      expect(similarity).toBeCloseTo(0);
    });

    it('should normalize vector', () => {
      const vec = [3, 4];
      const normalized = normalizeVector(vec);

      const magnitude = Math.sqrt(
        normalized.reduce((sum, val) => sum + val * val, 0)
      );

      expect(magnitude).toBeCloseTo(1);
    });
  });

  describe('Embedding Validation', () => {
    it('should validate correct embedding', () => {
      const embedding = {
        vector: [1, 2, 3],
        dimension: 3,
        model: 'test-model'
      };

      expect(validateEmbedding(embedding)).toBe(true);
    });

    it('should reject embedding with wrong dimension', () => {
      const embedding = {
        vector: [1, 2, 3],
        dimension: 5,
        model: 'test-model'
      };

      expect(validateEmbedding(embedding)).toBe(false);
    });

    it('should reject embedding without vector', () => {
      const embedding = {
        vector: [] as number[],
        dimension: 0,
        model: 'test-model'
      };

      expect(validateEmbedding(embedding)).toBe(false);
    });

    it('should reject embedding without model', () => {
      const embedding = {
        vector: [1, 2, 3],
        dimension: 3,
        model: ''
      };

      expect(validateEmbedding(embedding)).toBe(false);
    });
  });

  describe('Image Format Detection', () => {
    it('should detect GIF format', () => {
      const gifBuffer = Buffer.from([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61
      ]);

      expect(detectImageFormat(gifBuffer)).toBe('GIF');
    });

    it('should detect BMP format', () => {
      const bmpBuffer = Buffer.from([
        0x42, 0x4D, 0x00, 0x00
      ]);

      expect(detectImageFormat(bmpBuffer)).toBe('BMP');
    });

    it('should return null for unknown format', () => {
      const unknownBuffer = Buffer.from([
        0x00, 0x00, 0x00, 0x00
      ]);

      expect(detectImageFormat(unknownBuffer)).toBeNull();
    });
  });
});
