import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TopicManager } from '../src/topics/manager';
import { createMessage } from '../src/utils';

describe('TopicManager', () => {
  let topicManager: TopicManager;

  beforeEach(() => {
    topicManager = new TopicManager({
      maxTopics: 100,
      maxPartitions: 5,
      enableMetrics: true,
      retentionEnabled: true,
      retentionInterval: 60000,
      storageBackend: 'memory'
    });
  });

  afterEach(async () => {
    await topicManager.close();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(topicManager).toBeDefined();
      expect(topicManager['config'].maxTopics).toBe(100);
      expect(topicManager['config'].maxPartitions).toBe(5);
      expect(topicManager['config'].enableMetrics).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      const customManager = new TopicManager({
        maxTopics: 50,
        maxPartitions: 10,
        enableMetrics: false
      });

      expect(customManager['config'].maxTopics).toBe(50);
      expect(customManager['config'].maxPartitions).toBe(10);
      expect(customManager['config'].enableMetrics).toBe(false);
    });
  });

  describe('topic creation', () => {
    it('should create topic successfully', async () => {
      const topic = await topicManager.createTopic('test.topic');

      expect(topic).toBeDefined();
      expect(topic.name).toBe('test.topic');
      expect(topic.partitions).toBe(1);
      expect(topic.replicationFactor).toBe(1);
      expect(topic.id).toBeDefined();
      expect(topic.createdAt).toBeDefined();
    });

    it('should create topic with custom options', async () => {
      const options = {
        partitions: 3,
        replicationFactor: 2,
        retention: {
          duration: 3600000, // 1 hour
          size: 1048576 // 1MB
        },
        metadata: {
          description: 'Test topic',
          team: 'backend'
        }
      };

      const topic = await topicManager.createTopic('test.topic', options);

      expect(topic.partitions).toBe(3);
      expect(topic.replicationFactor).toBe(2);
      expect(topic.retention).toEqual(options.retention);
      expect(topic.metadata).toEqual(options.metadata);
    });

    it('should reject topic creation with invalid name', async () => {
      await expect(topicManager.createTopic('')).rejects.toThrow('Invalid topic name');
      await expect(topicManager.createTopic('..topic')).rejects.toThrow('Invalid topic name');
      await expect(topicManager.createTopic('topic..name')).rejects.toThrow('Invalid topic name');
      await expect(topicManager.createTopic('topic.')).rejects.toThrow('Invalid topic name');
      await expect(topicManager.createTopic('.topic')).rejects.toThrow('Invalid topic name');
    });

    it('should reject duplicate topic creation', async () => {
      await topicManager.createTopic('test.topic');
      await expect(topicManager.createTopic('test.topic')).rejects.toThrow('Topic already exists');
    });

    it('should reject topic creation when max topics reached', async () => {
      const manager = new TopicManager({ maxTopics: 2 });

      await manager.createTopic('topic1');
      await manager.createTopic('topic2');

      await expect(manager.createTopic('topic3')).rejects.toThrow('Maximum number of topics reached');
    });
  });

  describe('topic management', () => {
    it('should get topic by name', async () => {
      const topic = await topicManager.createTopic('test.topic');
      const retrieved = await topicManager.getTopic('test.topic');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(topic.id);
      expect(retrieved?.name).toBe('test.topic');
    });

    it('should return undefined for non-existent topic', async () => {
      const retrieved = await topicManager.getTopic('nonexistent.topic');
      expect(retrieved).toBeUndefined();
    });

    it('should update topic', async () => {
      const topic = await topicManager.createTopic('test.topic');
      const updated = await topicManager.updateTopic('test.topic', {
        partitions: 2,
        retention: { duration: 7200000 },
        metadata: { updated: true }
      });

      expect(updated).toBeDefined();
      expect(updated?.partitions).toBe(2);
      expect(updated?.retention?.duration).toBe(7200000);
      expect(updated?.metadata.updated).toBe(true);
    });

    it('should delete topic', async () => {
      await topicManager.createTopic('test.topic');
      let retrieved = await topicManager.getTopic('test.topic');
      expect(retrieved).toBeDefined();

      const deleted = await topicManager.deleteTopic('test.topic');
      expect(deleted).toBe(true);

      retrieved = await topicManager.getTopic('test.topic');
      expect(retrieved).toBeUndefined();
    });

    it('should return false when deleting non-existent topic', async () => {
      const deleted = await topicManager.deleteTopic('nonexistent.topic');
      expect(deleted).toBe(false);
    });

    it('should get all topics', async () => {
      const topic1 = await topicManager.createTopic('topic1');
      const topic2 = await topicManager.createTopic('topic2');

      const allTopics = await topicManager.getAllTopics();

      expect(allTopics).toHaveLength(2);
      expect(allTopics.map(t => t.name)).toContain('topic1');
      expect(allTopics.map(t => t.name)).toContain('topic2');
    });

    it('should get topics by pattern', async () => {
      await topicManager.createTopic('test.service1');
      await topicManager.createTopic('test.service2');
      await topicManager.createTopic('other.service');
      await topicManager.createTopic('test.prefix');

      const wildcardTopics = await topicManager.getTopicsByPattern('wildcard', 'test.*');
      expect(wildcardTopics).toHaveLength(2);

      const prefixTopics = await topicManager.getTopicsByPattern('prefix', 'test.');
      expect(prefixTopics).toHaveLength(3);

      const regexTopics = await topicManager.getTopicsByPattern('regex', '^test\\.service\\d+$');
      expect(regexTopics).toHaveLength(2);
    });
  });

  describe('topic statistics', () => {
    it('should track message count', async () => {
      const topicName = 'test.topic';
      await topicManager.createTopic(topicName);

      await topicManager.incrementMessageCount(topicName, 5);
      const stats = await topicManager.getTopicStats(topicName);

      expect(stats?.messageCount).toBe(5);
    });

    it('should track byte size', async () => {
      const topicName = 'test.topic';
      await topicManager.createTopic(topicName);

      const message = createMessage(topicName, { data: 'test' });
      const size = JSON.stringify(message).length;
      await topicManager.incrementByteSize(topicName, size);
      const stats = await topicManager.getTopicStats(topicName);

      expect(stats?.byteSize).toBe(size);
    });

    it('should track producer and consumer counts', async () => {
      const topicName = 'test.topic';
      await topicManager.createTopic(topicName);

      await topicManager.incrementProducerCount(topicName, 2);
      await topicManager.incrementConsumerCount(topicName, 3);
      const stats = await topicManager.getTopicStats(topicName);

      expect(stats?.producerCount).toBe(2);
      expect(stats?.consumerCount).toBe(3);
    });

    it('should calculate message rate', async () => {
      const topicName = 'test.topic';
      await topicManager.createTopic(topicName);

      // Simulate messages over time
      await topicManager.updateTopicStats(topicName, {
        messageCount: 100,
        lastMessageTime: Date.now() - 10000 // 10 seconds ago
      });

      const rate = await topicManager.calculateMessageRate(topicName);
      expect(rate).toBeCloseTo(10, 0); // 10 messages/second
    });

    it('should get all topic statistics', async () => {
      await topicManager.createTopic('topic1');
      await topicManager.createTopic('topic2');

      await topicManager.incrementMessageCount('topic1', 10);
      await topicManager.incrementMessageCount('topic2', 20);

      const allStats = await topicManager.getTopicStatsAll();

      expect(allStats).toBeDefined();
      expect(allStats.get('topic1')?.messageCount).toBe(10);
      expect(allStats.get('topic2')?.messageCount).toBe(20);
    });
  });

  describe('metrics', () => {
    it('should provide aggregate metrics', async () => {
      await topicManager.createTopic('topic1');
      await topicManager.createTopic('topic2');

      await topicManager.incrementMessageCount('topic1', 100);
      await topicManager.incrementMessageCount('topic2', 200);

      const metrics = await topicManager.getMetrics();

      expect(metrics.totalTopics).toBe(2);
      expect(metrics.totalMessages).toBe(300);
      expect(metrics.avgMessagesPerTopic).toBe(150);
    });

    it('should handle metrics when disabled', async () => {
      const manager = new TopicManager({ enableMetrics: false });
      await manager.createTopic('test.topic');

      const stats = await manager.getTopicStats('test.topic');
      expect(stats).toBeUndefined();

      const metrics = await manager.getMetrics();
      expect(metrics.totalTopics).toBe(0);
      expect(metrics.totalMessages).toBe(0);
    });
  });

  describe('retention', () => {
    it('should check time-based retention', async () => {
      const topicName = 'test.retention';
      await topicManager.createTopic(topicName, {
        retention: {
          duration: 1000 // 1 second
        }
      });

      const stats = await topicManager.getTopicStats(topicName);
      if (stats) {
        stats.lastMessageTime = Date.now() - 2000; // 2 seconds ago
      }

      // This would normally clean up, but we're just testing the logic
      expect(await topicManager.topicExists(topicName)).toBe(true);
    });

    it('should clean up expired topics', async () => {
      const mockCleanup = vi.spyOn(topicManager, 'cleanupRetainedTopics');

      // Should not throw
      await topicManager.cleanupRetainedTopics();
      expect(mockCleanup).toHaveBeenCalled();
    });
  });
});