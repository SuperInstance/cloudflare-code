/**
 * Unit tests for Context Compressor
 */

import { ContextCompressor } from '../../src/compression/compressor';
import { Message, CompressionConfig } from '../../src/types';

describe('ContextCompressor', () => {
  let compressor: ContextCompressor;
  let messages: Message[];

  beforeEach(() => {
    const config: Partial<CompressionConfig> = {
      level: 'medium',
      strategy: 'hybrid',
      targetRatio: 0.5,
      minQuality: 0.7,
    };

    compressor = new ContextCompressor(config);

    // Create test messages
    messages = [
      {
        id: '1',
        role: 'system',
        content: 'You are a helpful assistant.',
        timestamp: Date.now() - 4000,
      },
      {
        id: '2',
        role: 'user',
        content: 'What is artificial intelligence?',
        timestamp: Date.now() - 3000,
      },
      {
        id: '3',
        role: 'assistant',
        content:
          'Artificial intelligence (AI) is a branch of computer science that aims to create machines capable of performing tasks that typically require human intelligence.',
        timestamp: Date.now() - 2000,
      },
      {
        id: '4',
        role: 'user',
        content: 'Can you give me examples?',
        timestamp: Date.now() - 1000,
      },
      {
        id: '5',
        role: 'assistant',
        content:
          'Sure! Examples of AI include natural language processing, computer vision, robotics, machine learning, and autonomous vehicles.',
        timestamp: Date.now(),
      },
    ];
  });

  describe('Compression', () => {
    test('should compress messages', async () => {
      const result = await compressor.compress(messages);

      expect(result.original).toEqual(messages);
      expect(result.compressed).toBeDefined();
      expect(result.compressed.length).toBeGreaterThan(0);
      expect(result.ratio).toBeGreaterThanOrEqual(0);
      expect(result.ratio).toBeLessThanOrEqual(1);
      expect(result.tokensSaved).toBeGreaterThan(0);
      expect(result.quality).toBeGreaterThanOrEqual(0);
      expect(result.quality).toBeLessThanOrEqual(1);
    });

    test('should compress to target token count', async () => {
      const targetTokens = 100;
      const result = await compressor.compressToTokens(messages, targetTokens);

      const compressedTokens = await countTotalTokens(result.compressed);

      expect(compressedTokens).toBeLessThanOrEqual(targetTokens + 50); // Allow some tolerance
    });

    test('should preserve system messages', async () => {
      const result = await compressor.compress(messages);

      const systemMessages = result.compressed.filter(m => m.role === 'system');

      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0].content).toContain('helpful assistant');
    });

    test('should generate compression metadata', async () => {
      const result = await compressor.compress(messages);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.compressedAt).toBeDefined();
      expect(result.metadata.algorithm).toBeDefined();
      expect(result.metadata.checksum).toBeDefined();
      expect(result.metadata.keyPoints).toBeDefined();
      expect(result.metadata.summaries).toBeDefined();
    });
  });

  describe('Compression Strategies', () => {
    test('should use summarization strategy', async () => {
      compressor.updateConfig({ strategy: 'summarization' });

      const result = await compressor.compress(messages);

      expect(result.strategy).toBe('summarization');
      expect(result.compressed).toBeDefined();
    });

    test('should use extraction strategy', async () => {
      compressor.updateConfig({ strategy: 'extraction' });

      const result = await compressor.compress(messages);

      expect(result.strategy).toBe('extraction');
      expect(result.compressed.length).toBeLessThanOrEqual(messages.length);
    });

    test('should use hierarchical strategy', async () => {
      compressor.updateConfig({ strategy: 'hierarchical' });

      const result = await compressor.compress(messages);

      expect(result.strategy).toBe('hierarchical');
    });

    test('should use lossless strategy', async () => {
      compressor.updateConfig({ strategy: 'lossless' });

      const result = await compressor.compress(messages);

      expect(result.strategy).toBe('lossless');
      expect(result.compressed).toEqual(messages);
    });

    test('should use lossy strategy', async () => {
      compressor.updateConfig({ strategy: 'lossy' });

      const result = await compressor.compress(messages);

      expect(result.strategy).toBe('lossy');
      expect(result.compressed.length).toBeLessThan(messages.length);
    });

    test('should use hybrid strategy', async () => {
      compressor.updateConfig({ strategy: 'hybrid' });

      const result = await compressor.compress(messages);

      expect(result.strategy).toBe('hybrid');
    });
  });

  describe('Compression Levels', () => {
    test('should apply low compression level', async () => {
      compressor.updateConfig({ level: 'low' });

      const result = await compressor.compress(messages);

      expect(result.ratio).toBeGreaterThan(0.5);
    });

    test('should apply medium compression level', async () => {
      compressor.updateConfig({ level: 'medium' });

      const result = await compressor.compress(messages);

      expect(result.ratio).toBeGreaterThan(0.2);
      expect(result.ratio).toBeLessThan(0.6);
    });

    test('should apply high compression level', async () => {
      compressor.updateConfig({ level: 'high' });

      const result = await compressor.compress(messages);

      expect(result.ratio).toBeLessThan(0.4);
    });

    test('should apply maximum compression level', async () => {
      compressor.updateConfig({ level: 'maximum' });

      const result = await compressor.compress(messages);

      expect(result.ratio).toBeLessThan(0.2);
    });

    test('should not compress with none level', async () => {
      compressor.updateConfig({ level: 'none' });

      const result = await compressor.compress(messages);

      expect(result.ratio).toBe(1.0);
      expect(result.compressed).toEqual(messages);
    });
  });

  describe('Quality Assessment', () => {
    test('should assess compression quality', async () => {
      const result = await compressor.compress(messages);

      expect(result.quality).toBeGreaterThanOrEqual(0);
      expect(result.quality).toBeLessThanOrEqual(1);
    });

    test('should maintain high quality for low compression', async () => {
      compressor.updateConfig({ level: 'low' });

      const result = await compressor.compress(messages);

      expect(result.quality).toBeGreaterThan(0.8);
    });

    test('should have lower quality for high compression', async () => {
      compressor.updateConfig({ level: 'maximum' });

      const result = await compressor.compress(messages);

      expect(result.quality).toBeLessThan(0.9);
    });
  });

  describe('Key Point Extraction', () => {
    test('should extract key points', async () => {
      const result = await compressor.compress(messages);

      expect(result.metadata.keyPoints).toBeDefined();
      expect(Array.isArray(result.metadata.keyPoints)).toBe(true);
    });

    test('should extract questions from user messages', async () => {
      const result = await compressor.compress(messages);

      const hasQuestion = result.metadata.keyPoints.some(kp =>
        kp.includes('?')
      );

      expect(hasQuestion).toBe(true);
    });
  });

  describe('Summary Generation', () => {
    test('should generate summaries', async () => {
      const result = await compressor.compress(messages);

      expect(result.metadata.summaries).toBeDefined();
      expect(Array.isArray(result.metadata.summaries)).toBe(true);
    });

    test('should create summary with metadata', async () => {
      const result = await compressor.compress(messages);

      if (result.metadata.summaries.length > 0) {
        const summary = result.metadata.summaries[0];

        expect(summary.id).toBeDefined();
        expect(summary.content).toBeDefined();
        expect(summary.level).toBeDefined();
        expect(summary.tokens).toBeDefined();
        expect(summary.quality).toBeDefined();
      }
    });
  });

  describe('Configuration', () => {
    test('should update configuration', () => {
      const newConfig: Partial<CompressionConfig> = {
        level: 'high',
        strategy: 'lossy',
        targetRatio: 0.2,
      };

      compressor.updateConfig(newConfig);

      const config = compressor.getConfig();

      expect(config.level).toBe('high');
      expect(config.strategy).toBe('lossy');
      expect(config.targetRatio).toBe(0.2);
    });

    test('should get current configuration', () => {
      const config = compressor.getConfig();

      expect(config).toBeDefined();
      expect(config.level).toBeDefined();
      expect(config.strategy).toBeDefined();
      expect(config.targetRatio).toBeDefined();
      expect(config.minQuality).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty message array', async () => {
      const result = await compressor.compress([]);

      expect(result.compressed).toEqual([]);
      expect(result.ratio).toBe(0);
    });

    test('should handle single message', async () => {
      const singleMessage = [messages[0]];

      const result = await compressor.compress(singleMessage);

      expect(result.compressed).toBeDefined();
      expect(result.compressed.length).toBeGreaterThan(0);
    });

    test('should handle very long messages', async () => {
      const longMessage: Message = {
        id: 'long',
        role: 'assistant',
        content: 'A'.repeat(10000),
        timestamp: Date.now(),
      };

      const result = await compressor.compress([longMessage]);

      expect(result.compressed).toBeDefined();
    });

    test('should handle messages with empty content', async () => {
      const emptyMessage: Message = {
        id: 'empty',
        role: 'user',
        content: '',
        timestamp: Date.now(),
      };

      const result = await compressor.compress([emptyMessage]);

      expect(result.compressed).toBeDefined();
    });
  });
});

// Helper function
async function countTotalTokens(messages: Message[]): Promise<number> {
  let total = 0;

  for (const message of messages) {
    total += Math.ceil(message.content.length / 4);
  }

  return total;
}
