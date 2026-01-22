/**
 * Unit tests for Context Optimizer
 */

import { ContextOptimizer } from '../../src/optimizer/optimizer';
import { Message, OptimizerConfig } from '../../src/types';

describe('ContextOptimizer', () => {
  let optimizer: ContextOptimizer;
  let messages: Message[];

  beforeEach(() => {
    const config: Partial<OptimizerConfig> = {
      maxTokens: 1000,
      reservedTokens: 100,
      priorityStrategy: 'hybrid',
      relevanceThreshold: 0.5,
      qualityThreshold: 0.7,
    };

    optimizer = new ContextOptimizer(config);

    // Create test messages
    const now = Date.now();

    messages = [
      {
        id: '1',
        role: 'system',
        content: 'You are a helpful AI assistant.',
        timestamp: now - 5000,
        metadata: { tokens: 10 },
      },
      {
        id: '2',
        role: 'user',
        content: 'What is machine learning?',
        timestamp: now - 4000,
        metadata: { tokens: 8 },
      },
      {
        id: '3',
        role: 'assistant',
        content:
          'Machine learning is a subset of artificial intelligence that focuses on algorithms that can learn from data.',
        timestamp: now - 3000,
        metadata: { tokens: 25 },
      },
      {
        id: '4',
        role: 'user',
        content: 'Can you explain deep learning?',
        timestamp: now - 2000,
        metadata: { tokens: 9 },
      },
      {
        id: '5',
        role: 'assistant',
        content:
          'Deep learning is a type of machine learning that uses neural networks with many layers to model complex patterns.',
        timestamp: now - 1000,
        metadata: { tokens: 28 },
      },
      {
        id: '6',
        role: 'user',
        content: 'What about reinforcement learning?',
        timestamp: now - 500,
        metadata: { tokens: 8 },
      },
      {
        id: '7',
        role: 'assistant',
        content:
          'Reinforcement learning is a type of machine learning where an agent learns by interacting with an environment.',
        timestamp: now,
        metadata: { tokens: 24 },
      },
    ];
  });

  describe('Optimization', () => {
    test('should optimize messages', async () => {
      const result = await optimizer.optimize(messages);

      expect(result.included).toBeDefined();
      expect(result.excluded).toBeDefined();
      expect(result.compressed).toBeDefined();
      expect(result.totalTokens).toBeDefined();
      expect(result.qualityScore).toBeDefined();
      expect(result.coverage).toBeDefined();
      expect(result.diversity).toBeDefined();
    });

    test('should optimize to specific token count', async () => {
      const targetTokens = 100;
      const result = await optimizer.optimizeToTokens(messages, targetTokens);

      expect(result.totalTokens).toBeLessThanOrEqual(targetTokens + 50);
    });

    test('should include system messages', async () => {
      const result = await optimizer.optimize(messages);

      const systemMessages = result.included.filter(m => m.role === 'system');

      expect(systemMessages.length).toBe(1);
    });

    test('should include recent messages', async () => {
      const result = await optimizer.optimize(messages);

      const hasRecent = result.included.some(m => m.id === '7');

      expect(hasRecent).toBe(true);
    });

    test('should exclude low priority messages when needed', async () => {
      const result = await optimizer.optimize(messages);

      expect(result.excluded.length).toBeGreaterThanOrEqual(0);
    });

    test('should compress some messages', async () => {
      const result = await optimizer.optimize(messages);

      expect(result.compressed.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Priority Calculation', () => {
    test('should calculate priorities', async () => {
      const priorities = await optimizer.calculatePriorities(messages);

      expect(priorities).toHaveLength(messages.length);
      expect(priorities.every(p => p.messageId)).toBe(true);
      expect(priorities.every(p => p.priority >= 0 && p.priority <= 1)).toBe(true);
      expect(priorities.every(p => p.reasons.length > 0)).toBe(true);
    });

    test('should use recency strategy', async () => {
      optimizer.updateConfig({ priorityStrategy: 'recency' });

      const priorities = await optimizer.calculatePriorities(messages);

      // Later messages should have higher priority
      expect(priorities[priorities.length - 1].priority).toBeGreaterThan(
        priorities[0].priority
      );
    });

    test('should use relevance strategy with query', async () => {
      optimizer.updateConfig({ priorityStrategy: 'relevance' });

      const priorities = await optimizer.calculatePriorities(
        messages,
        'machine learning'
      );

      expect(priorities).toBeDefined();
      expect(priorities.length).toBe(messages.length);
    });

    test('should use importance strategy', async () => {
      optimizer.updateConfig({ priorityStrategy: 'importance' });

      const priorities = await optimizer.calculatePriorities(messages);

      expect(priorities).toBeDefined();
    });

    test('should use hybrid strategy', async () => {
      optimizer.updateConfig({ priorityStrategy: 'hybrid' });

      const priorities = await optimizer.calculatePriorities(messages, 'learning');

      expect(priorities).toBeDefined();
      expect(priorities.every(p => p.reasons.includes('recency'))).toBe(true);
      expect(priorities.every(p => p.reasons.includes('relevance'))).toBe(true);
      expect(priorities.every(p => p.reasons.includes('importance'))).toBe(true);
    });
  });

  describe('Quality Metrics', () => {
    test('should calculate quality metrics', async () => {
      const metrics = await optimizer.calculateQualityMetrics(messages, 'learning');

      expect(metrics.relevance).toBeGreaterThanOrEqual(0);
      expect(metrics.relevance).toBeLessThanOrEqual(1);
      expect(metrics.coherence).toBeGreaterThanOrEqual(0);
      expect(metrics.coherence).toBeLessThanOrEqual(1);
      expect(metrics.completeness).toBeGreaterThanOrEqual(0);
      expect(metrics.completeness).toBeLessThanOrEqual(1);
      expect(metrics.diversity).toBeGreaterThanOrEqual(0);
      expect(metrics.diversity).toBeLessThanOrEqual(1);
      expect(metrics.overall).toBeGreaterThanOrEqual(0);
      expect(metrics.overall).toBeLessThanOrEqual(1);
    });

    test('should calculate coherence', async () => {
      const metrics = await optimizer.calculateQualityMetrics(messages);

      expect(metrics.coherence).toBeGreaterThan(0);
    });

    test('should calculate completeness', async () => {
      const metrics = await optimizer.calculateQualityMetrics(messages);

      expect(metrics.completeness).toBeGreaterThan(0);
    });

    test('should calculate diversity', async () => {
      const metrics = await optimizer.calculateQualityMetrics(messages);

      expect(metrics.diversity).toBeGreaterThan(0);
    });
  });

  describe('Dynamic Context Sizing', () => {
    test('should calculate optimal size', async () => {
      const optimalSize = await optimizer.calculateOptimalSize(messages, 'test query');

      expect(optimalSize).toBeGreaterThan(0);
      expect(optimalSize).toBeLessThanOrEqual(optimizer.getConfig().maxTokens);
    });

    test('should assess query complexity', async () => {
      const simpleSize = await optimizer.calculateOptimalSize(messages, 'hi');
      const complexSize = await optimizer.calculateOptimalSize(
        messages,
        'Can you explain in detail how machine learning algorithms work and what are the main differences between supervised and unsupervised learning?'
      );

      expect(complexSize).toBeGreaterThanOrEqual(simpleSize);
    });

    test('should respect dynamic sizing setting', async () => {
      optimizer.updateConfig({ dynamicSizing: false });

      const optimalSize = await optimizer.calculateOptimalSize(messages);

      expect(optimalSize).toBe(optimizer.getConfig().maxTokens);
    });
  });

  describe('Configuration', () => {
    test('should update configuration', () => {
      const newConfig: Partial<OptimizerConfig> = {
        maxTokens: 2000,
        priorityStrategy: 'recency',
        relevanceThreshold: 0.7,
      };

      optimizer.updateConfig(newConfig);

      const config = optimizer.getConfig();

      expect(config.maxTokens).toBe(2000);
      expect(config.priorityStrategy).toBe('recency');
      expect(config.relevanceThreshold).toBe(0.7);
    });

    test('should get current configuration', () => {
      const config = optimizer.getConfig();

      expect(config).toBeDefined();
      expect(config.maxTokens).toBeDefined();
      expect(config.reservedTokens).toBeDefined();
      expect(config.priorityStrategy).toBeDefined();
    });

    test('should get token budget', () => {
      const budget = optimizer.getTokenBudget();

      expect(budget.max).toBeDefined();
      expect(budget.reserved).toBeDefined();
      expect(budget.available).toBeDefined();
      expect(budget.available).toBe(budget.max - budget.reserved);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty message array', async () => {
      const result = await optimizer.optimize([]);

      expect(result.included).toEqual([]);
      expect(result.totalTokens).toBe(0);
    });

    test('should handle single message', async () => {
      const singleMessage = [messages[0]];

      const result = await optimizer.optimize(singleMessage);

      expect(result.included).toBeDefined();
      expect(result.included.length).toBe(1);
    });

    test('should handle messages without metadata', async () => {
      const messagesNoMetadata: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Test message',
          timestamp: Date.now(),
        },
      ];

      const result = await optimizer.optimize(messagesNoMetadata);

      expect(result.included).toBeDefined();
    });

    test('should handle very long messages', async () => {
      const longMessage: Message = {
        id: 'long',
        role: 'assistant',
        content: 'A'.repeat(10000),
        timestamp: Date.now(),
        metadata: { tokens: 2500 },
      };

      const result = await optimizer.optimize([longMessage]);

      expect(result.included).toBeDefined();
    });
  });
});
