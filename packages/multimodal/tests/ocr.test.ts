/**
 * OCR Module Tests
 * Tests for text recognition from images
 */

import { describe, it, expect } from 'vitest';
import {
  recognizeText,
  validateOCRQuality,
  detectLanguage
} from '../src/ocr';

describe('OCR Module', () => {
  describe('Text Recognition', () => {
    it('should recognize text from image', async () => {
      const mockImage = Buffer.from('mock-ocr-image');

      const result = await recognizeText({
        image: mockImage,
        language: 'eng',
        preprocess: true
      });

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.lines).toBeDefined();
      expect(Array.isArray(result.lines)).toBe(true);
    });

    it('should recognize text by lines', async () => {
      const mockImage = Buffer.from('mock-ocr-image');

      const result = await recognizeText({
        image: mockImage,
        segmentByLines: true
      });

      expect(result.lines).toBeDefined();
      expect(result.lines.length).toBeGreaterThan(0);

      if (result.lines.length > 0) {
        expect(result.lines[0].text).toBeDefined();
        expect(result.lines[0].confidence).toBeDefined();
        expect(result.lines[0].boundingBox).toBeDefined();
      }
    });
  });

  describe('Quality Validation', () => {
    it('should validate high quality OCR result', () => {
      const mockResult = {
        text: 'Sample text content',
        confidence: 0.95,
        lines: [],
        metadata: {
          engine: 'tesseract',
          language: 'eng',
          processingTime: 1000,
          preprocessed: true
        }
      };

      const validation = validateOCRQuality(mockResult);

      expect(validation.isValid).toBe(true);
      expect(validation.issues.length).toBe(0);
    });

    it('should detect low confidence OCR result', () => {
      const mockResult = {
        text: 'Sample text',
        confidence: 0.3,
        lines: [],
        metadata: {
          engine: 'tesseract',
          language: 'eng',
          processingTime: 1000,
          preprocessed: true
        }
      };

      const validation = validateOCRQuality(mockResult);

      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('should detect empty OCR result', () => {
      const mockResult = {
        text: '',
        confidence: 0.8,
        lines: [],
        metadata: {
          engine: 'tesseract',
          language: 'eng',
          processingTime: 1000,
          preprocessed: true
        }
      };

      const validation = validateOCRQuality(mockResult);

      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(i => i.includes('No text'))).toBe(true);
    });
  });

  describe('Language Detection', () => {
    it('should detect English text', async () => {
      const language = await detectLanguage('This is English text');
      expect(language).toBe('eng');
    });

    it('should detect Chinese characters', async () => {
      const language = await detectLanguage('中文文本');
      expect(language).toBe('chi_sim');
    });

    it('should default to English for unknown', async () => {
      const language = await detectLanguage('Unknown text');
      expect(language).toBe('eng');
    });
  });
});
