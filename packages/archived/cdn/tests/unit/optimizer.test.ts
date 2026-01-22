/**
 * Asset Optimizer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AssetOptimizer } from '../../src/optimizer/optimizer.js';
import type { AssetType } from '../../src/types/index.js';

describe('AssetOptimizer', () => {
  let optimizer: AssetOptimizer;

  beforeEach(() => {
    optimizer = new AssetOptimizer({
      parallelism: 2,
      maxFileSize: 5 * 1024 * 1024,
      timeout: 30000
    });
  });

  describe('JavaScript Optimization', () => {
    it('should minify JavaScript', async () => {
      const jsCode = `
        function test() {
          // This is a comment
          var x = 1;
          var y = 2;
          return x + y;
        }
      `;

      const result = await optimizer.optimize(jsCode, 'javascript', {
        minify: true
      });

      expect(result.optimized.size).toBeLessThan(result.original.size);
      expect(result.savings.percentage).toBeGreaterThan(0);
    });

    it('should not minify when disabled', async () => {
      const jsCode = 'function test() { return 1 + 2; }';

      const result = await optimizer.optimize(jsCode, 'javascript', {
        minify: false
      });

      expect(result.savings.percentage).toBe(0);
    });

    it('should handle complex JavaScript', async () => {
      const jsCode = `
        class Calculator {
          constructor() {
            this.result = 0;
          }

          add(x) {
            this.result += x;
            return this;
          }

          subtract(x) {
            this.result -= x;
            return this;
          }

          getResult() {
            return this.result;
          }
        }

        // Create instance
        const calc = new Calculator();
        calc.add(5).subtract(3);
      `;

      const result = await optimizer.optimize(jsCode, 'javascript', {
        minify: true
      });

      expect(result.optimized.size).toBeLessThan(result.original.size);
    });
  });

  describe('CSS Optimization', () => {
    it('should minify CSS', async () => {
      const css = `
        .container {
          width: 100%;
          margin: 0 auto;
          /* Center content */
          padding: 20px;
        }

        .button {
          background-color: #007bff;
          color: white;
        }
      `;

      const result = await optimizer.optimize(css, 'css', {
        minify: true
      });

      expect(result.optimized.size).toBeLessThan(result.original.size);
      expect(result.savings.bytes).toBeGreaterThan(0);
    });

    it('should preserve CSS rules when not minifying', async () => {
      const css = '.test { color: red; }';

      const result = await optimizer.optimize(css, 'css', {
        minify: false
      });

      expect(result.savings.percentage).toBe(0);
    });
  });

  describe('Image Optimization', () => {
    it('should optimize images with quality setting', async () => {
      const imageBuffer = Buffer.from('fake-image-data');

      const result = await optimizer.optimize(imageBuffer, 'image', {
        quality: 80,
        format: 'webp'
      });

      expect(result).toHaveProperty('original');
      expect(result).toHaveProperty('optimized');
      expect(result).toHaveProperty('savings');
    });

    it('should handle image dimensions', async () => {
      const imageBuffer = Buffer.from('fake-image-data');

      const result = await optimizer.optimize(imageBuffer, 'image', {
        dimensions: { width: 800, height: 600 },
        quality: 85
      });

      expect(result.metadata).toHaveProperty('quality', 85);
    });
  });

  describe('Batch Optimization', () => {
    it('should optimize multiple assets', async () => {
      const assets = [
        { content: 'function test() {}', type: 'javascript' as AssetType },
        { content: '.test { color: red; }', type: 'css' as AssetType },
        { content: 'var x = 1;', type: 'javascript' as AssetType }
      ];

      const results = await optimizer.optimizeBatch(assets);

      expect(results.length).toBe(3);
      expect(results[0]).toHaveProperty('original');
      expect(results[0]).toHaveProperty('optimized');
    });
  });

  describe('Validation', () => {
    it('should validate JavaScript assets', () => {
      const result = optimizer.validateAsset(
        Buffer.from('function test() {}'),
        'javascript'
      );

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate CSS assets', () => {
      const result = optimizer.validateAsset(
        Buffer.from('.test { color: red; }'),
        'css'
      );

      expect(result.valid).toBe(true);
    });

    it('should reject files exceeding max size', () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

      const result = optimizer.validateAsset(largeBuffer, 'javascript');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject empty files', () => {
      const result = optimizer.validateAsset(Buffer.alloc(0), 'javascript');

      expect(result.valid).toBe(false);
    });
  });

  describe('Recommendations', () => {
    it('should provide recommendations for large images', () => {
      const largeImage = Buffer.alloc(600 * 1024); // 600KB

      const recommendations = optimizer.getRecommendations(largeImage, 'image');

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.impact === 'high')).toBe(true);
    });

    it('should provide recommendations for JavaScript', () => {
      const js = Buffer.alloc(150 * 1024); // 150KB

      const recommendations = optimizer.getRecommendations(js, 'javascript');

      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Cache', () => {
    it('should cache optimization results', async () => {
      const jsCode = 'function test() { return 1 + 2; }';

      await optimizer.optimize(jsCode, 'javascript', { minify: true });
      const result2 = await optimizer.optimize(jsCode, 'javascript', { minify: true });

      expect(result2).toBeDefined();
    });

    it('should track cache size', () => {
      const initialSize = optimizer.getCacheSize();

      expect(initialSize).toBeGreaterThanOrEqual(0);
    });

    it('should clear cache', async () => {
      await optimizer.optimize('test', 'javascript');
      optimizer.clearCache();

      expect(optimizer.getCacheSize()).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should provide optimization statistics', async () => {
      await optimizer.optimize('function test() {}', 'javascript', { minify: true });
      await optimizer.optimize('.test {}', 'css', { minify: true });

      const stats = optimizer.getStatistics();

      expect(stats.totalOptimized).toBe(2);
      expect(stats.avgSavings).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Supported Formats', () => {
    it('should list supported image formats', () => {
      const formats = optimizer.getSupportedFormats('image');

      expect(formats).toContain('jpeg');
      expect(formats).toContain('png');
      expect(formats).toContain('webp');
    });

    it('should list supported JavaScript formats', () => {
      const formats = optimizer.getSupportedFormats('javascript');

      expect(formats).toContain('js');
      expect(formats).toContain('mjs');
    });

    it('should list supported CSS formats', () => {
      const formats = optimizer.getSupportedFormats('css');

      expect(formats).toContain('css');
    });
  });
});
