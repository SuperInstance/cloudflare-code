import { Topic, TopicStats, TopicPattern } from '../types';
import { createTopic, validateTopicName, formatBytes } from '../utils';

export namespace TopicManager {
  export interface Config {
    maxTopics: number;
    maxPartitions: number;
    enableMetrics: boolean;
    retentionEnabled: boolean;
    retentionInterval: number;
    storageBackend: 'kv' | 'durable' | 'memory';
  }

  export interface TopicCreationOptions {
    partitions?: number;
    replicationFactor?: number;
    retention?: Topic['retention'];
    metadata?: Record<string, any>;
  }

  export interface TopicUpdateOptions {
    partitions?: number;
    retention?: Topic['retention'];
    metadata?: Record<string, any>;
  }
}

export class TopicManager {
  private topics: Map<string, Topic> = new Map();
  private topicStats: Map<string, TopicStats> = new Map();
  private config: TopicManager.Config;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: Partial<TopicManager.Config> = {}) {
    this.config = {
      maxTopics: 1000,
      maxPartitions: 10,
      enableMetrics: true,
      retentionEnabled: true,
      retentionInterval: 60000, // 1 minute
      storageBackend: 'memory',
      ...config
    };
  }

  async initialize(): Promise<void> {
    // Start retention cleanup if enabled
    if (this.config.retentionEnabled) {
      this.cleanupInterval = setInterval(
        () => this.cleanupRetainedTopics(),
        this.config.retentionInterval
      );
    }
  }

  async createTopic(
    name: string,
    options: TopicManager.TopicCreationOptions = {}
  ): Promise<Topic> {
    // Validate topic name
    if (!validateTopicName(name)) {
      throw new Error(`Invalid topic name: ${name}`);
    }

    // Check max topics limit
    if (this.topics.size >= this.config.maxTopics) {
      throw new Error('Maximum number of topics reached');
    }

    // Check if topic already exists
    if (this.topics.has(name)) {
      throw new Error(`Topic already exists: ${name}`);
    }

    const partitions = Math.min(options.partitions || 1, this.config.maxPartitions);
    const replicationFactor = options.replicationFactor || 1;

    const topic = createTopic(name, partitions, replicationFactor, options);
    this.topics.set(name, topic);

    // Initialize stats
    if (this.config.enableMetrics) {
      this.topicStats.set(name, {
        messageCount: 0,
        byteSize: 0,
        producerCount: 0,
        consumerCount: 0,
        messageRate: 0,
        errorRate: 0,
        lastMessageTime: 0
      });
    }

    return topic;
  }

  async getTopic(name: string): Promise<Topic | undefined> {
    return this.topics.get(name);
  }

  async updateTopic(
    name: string,
    options: TopicManager.TopicUpdateOptions
  ): Promise<Topic | undefined> {
    const topic = this.topics.get(name);
    if (!topic) {
      return undefined;
    }

    // Validate partition count
    if (options.partitions && options.partitions > this.config.maxPartitions) {
      throw new Error(`Maximum partitions exceeded: ${this.config.maxPartitions}`);
    }

    // Update topic
    if (options.partitions) {
      topic.partitions = options.partitions;
    }
    if (options.retention) {
      topic.retention = options.retention;
    }
    if (options.metadata) {
      topic.metadata = options.metadata;
    }

    topic.updatedAt = Date.now();
    this.topics.set(name, topic);

    return topic;
  }

  async deleteTopic(name: string): Promise<boolean> {
    const deleted = this.topics.delete(name);
    if (deleted) {
      this.topicStats.delete(name);
    }
    return deleted;
  }

  async getAllTopics(): Promise<Topic[]> {
    return Array.from(this.topics.values());
  }

  async getTopicsByPattern(pattern: TopicPattern, filter?: string): Promise<Topic[]> {
    const topics = Array.from(this.topics.values());

    if (pattern === 'wildcard') {
      // Implement wildcard matching
      const regex = new RegExp(filter || '.*');
      return topics.filter(topic => regex.test(topic.name));
    }

    if (pattern === 'prefix') {
      const prefix = filter || '';
      return topics.filter(topic => topic.name.startsWith(prefix));
    }

    if (pattern === 'regex') {
      const regex = new RegExp(filter || '.*');
      return topics.filter(topic => regex.test(topic.name));
    }

    return topics;
  }

  async topicExists(name: string): Promise<boolean> {
    return this.topics.has(name);
  }

  async getTopicStats(name: string): Promise<TopicStats | undefined> {
    if (!this.config.enableMetrics) {
      return undefined;
    }

    return this.topicStats.get(name);
  }

  async getTopicStatsAll(): Promise<Map<string, TopicStats>> {
    if (!this.config.enableMetrics) {
      return new Map();
    }

    return new Map(this.topicStats);
  }

  async updateTopicStats(
    name: string,
    updates: Partial<TopicStats>
  ): Promise<void> {
    if (!this.config.enableMetrics) {
      return;
    }

    let stats = this.topicStats.get(name);
    if (!stats) {
      stats = {
        messageCount: 0,
        byteSize: 0,
        producerCount: 0,
        consumerCount: 0,
        messageRate: 0,
        errorRate: 0,
        lastMessageTime: 0
      };
    }

    Object.assign(stats, updates);
    this.topicStats.set(name, stats);
  }

  async incrementMessageCount(name: string, count: number = 1): Promise<void> {
    await this.updateTopicStats(name, {
      messageCount: (this.topicStats.get(name)?.messageCount || 0) + count,
      lastMessageTime: Date.now()
    });
  }

  async incrementByteSize(name: string, bytes: number): Promise<void> {
    await this.updateTopicStats(name, {
      byteSize: (this.topicStats.get(name)?.byteSize || 0) + bytes
    });
  }

  async incrementProducerCount(name: string, delta: number = 1): Promise<void> {
    await this.updateTopicStats(name, {
      producerCount: (this.topicStats.get(name)?.producerCount || 0) + delta
    });
  }

  async incrementConsumerCount(name: string, delta: number = 1): Promise<void> {
    await this.updateTopicStats(name, {
      consumerCount: (this.topicStats.get(name)?.consumerCount || 0) + delta
    });
  }

  async calculateMessageRate(name: string): Promise<number> {
    if (!this.config.enableMetrics) {
      return 0;
    }

    const stats = this.topicStats.get(name);
    if (!stats) {
      return 0;
    }

    // Simple rate calculation based on last message time
    const now = Date.now();
    const timeDiff = now - (stats.lastMessageTime || now);

    if (timeDiff <= 0) {
      return stats.messageRate;
    }

    return stats.messageCount / (timeDiff / 1000);
  }

  async cleanupRetainedTopics(): Promise<void> {
    if (!this.config.retentionEnabled) {
      return;
    }

    const now = Date.now();
    let cleanedTopics = 0;

    for (const [name, topic] of this.topics.entries()) {
      const stats = this.topicStats.get(name);
      if (!stats) continue;

      // Check time-based retention
      if (topic.retention?.duration) {
        if (now - (stats.lastMessageTime || 0) > topic.retention.duration) {
          // In a real implementation, this would delete old messages
          console.log(`Cleaned up messages from topic: ${name}`);
          cleanedTopics++;
        }
      }

      // Check size-based retention
      if (topic.retention?.size) {
        if (stats.byteSize > topic.retention.size) {
          console.log(`Would prune messages from topic: ${name} (size: ${formatBytes(stats.byteSize)})`);
        }
      }

      // Check count-based retention
      if (topic.retention?.count) {
        if (stats.messageCount > topic.retention.count) {
          console.log(`Would prune messages from topic: ${name} (count: ${stats.messageCount})`);
        }
      }
    }

    if (cleanedTopics > 0) {
      console.log(`Cleaned up ${cleanedTopics} topics based on retention policy`);
    }
  }

  async getMetrics(): Promise<{
    totalTopics: number;
    totalMessages: number;
    totalSize: number;
    avgMessagesPerTopic: number;
    avgSizePerTopic: number;
  }> {
    const topics = Array.from(this.topicStats.values());
    const totalMessages = topics.reduce((sum, stats) => sum + stats.messageCount, 0);
    const totalSize = topics.reduce((sum, stats) => sum + stats.byteSize, 0);

    return {
      totalTopics: this.topics.size,
      totalMessages,
      totalSize,
      avgMessagesPerTopic: this.topics.size > 0 ? totalMessages / this.topics.size : 0,
      avgSizePerTopic: this.topics.size > 0 ? totalSize / this.topics.size : 0
    };
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}