/**
 * Vision Module Tests
 * Tests for image analysis and code extraction
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyzeImage,
  analyzeScreenshot,
  extractCodeFromImage,
  detectLanguage
} from '../src/vision';

describe('Vision Module', () => {
  describe('Image Analysis', () => {
    it('should analyze screenshot', async () => {
      const mockImage = Buffer.from('mock-image-data');

      // Mock the analysis
      const result = await analyzeImage({
        image: mockImage,
        type: 'screenshot',
        features: ['ui-elements', 'text']
      });

      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should extract UI elements', async () => {
      const mockImage = Buffer.from('mock-image-data');

      const result = await analyzeImage({
        image: mockImage,
        features: ['ui-elements']
      });

      expect(result.uiElements).toBeDefined();
      expect(Array.isArray(result.uiElements)).toBe(true);
    });

    it('should extract text from image', async () => {
      const mockImage = Buffer.from('mock-image-data');

      const result = await analyzeImage({
        image: mockImage,
        features: ['text']
      });

      expect(result.text).toBeDefined();
    });
  });

  describe('Code Extraction', () => {
    it('should extract code from image', async () => {
      const mockImage = Buffer.from('mock-code-image');

      const result = await extractCodeFromImage({
        image: mockImage,
        language: 'javascript'
      });

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
      expect(result.language).toBe('javascript');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should detect language from code', () => {
      const pythonCode = 'def hello():\n    print("Hello")';
      const language = detectLanguage(pythonCode);

      expect(language).toBe('python');
    });

    it('should detect JavaScript language', () => {
      const jsCode = 'const hello = () => { console.log("Hello"); };';
      const language = detectLanguage(jsCode);

      expect(language).toBe('javascript');
    });

    it('should detect TypeScript language', () => {
      const tsCode = 'interface User { name: string; }';
      const language = detectLanguage(tsCode);

      expect(language).toBe('typescript');
    });
  });

  describe('Language Detection', () => {
    it('should detect Python', () => {
      const code = 'def function(): pass';
      expect(detectLanguage(code)).toBe('python');
    });

    it('should detect JavaScript', () => {
      const code = 'const func = () => {}';
      expect(detectLanguage(code)).toBe('javascript');
    });

    it('should detect Go', () => {
      const code = 'func main() {}';
      expect(detectLanguage(code)).toBe('go');
    });

    it('should detect Rust', () => {
      const code = 'fn main() {}';
      expect(detectLanguage(code)).toBe('rust');
    });
  });
});
