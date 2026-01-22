import { nanoid } from 'nanoid';
import { Message, Topic, Subscription, RoutingRule } from '../types';

export const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function createMessage(
  topic: string,
  payload: any,
  headers: Partial<Message['headers']> = {}
): Message {
  return {
    id: nanoid(),
    topic,
    payload,
    headers: {
      contentType: 'application/json',
      priority: 'normal',
      timestamp: Date.now(),
      ...headers
    },
    timestamp: Date.now(),
    retryCount: 0,
    ttl: headers.ttl || DEFAULT_TTL
  };
}

export function createTopic(
  name: string,
  partitions: number = 1,
  replicationFactor: number = 1,
  options: Partial<Topic> = {}
): Topic {
  return {
    id: nanoid(),
    name,
    pattern: options.pattern,
    partitions,
    replicationFactor,
    retention: options.retention,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: options.metadata || {}
  };
}

export function createSubscription(
  topic: string,
  subscriber: string,
  options: Partial<Subscription> = {}
): Subscription {
  return {
    id: nanoid(),
    topic,
    subscriber,
    deliveryGuarantee: options.deliveryGuarantee || 'at-least-once',
    batchSize: options.batchSize || 1,
    batchSizeBytes: options.batchSizeBytes || 1024 * 1024, // 1MB
    maxConcurrency: options.maxConcurrency || 10,
    retryPolicy: options.retryPolicy || {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true
    },
    deadLetterQueue: options.deadLetterQueue,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: options.metadata || {}
  };
}

export function createRoutingRule(
  pattern: string,
  actions: RoutingRule['actions'],
  options: Partial<RoutingRule> = {}
): RoutingRule {
  return {
    id: nanoid(),
    name: options.name || pattern,
    pattern,
    type: options.type || 'wildcard',
    actions,
    priority: options.priority || 0,
    enabled: options.enabled !== false,
    createdAt: Date.now()
  };
}

export function matchTopicPattern(topic: string, pattern: string, type: string): boolean {
  switch (type) {
    case 'exact':
      return topic === pattern;

    case 'wildcard':
      return matchWildcard(topic, pattern);

    case 'prefix':
      return topic.startsWith(pattern);

    case 'regex':
      return new RegExp(pattern).test(topic);

    default:
      return false;
  }
}

function matchWildcard(topic: string, pattern: string): boolean {
  // Convert wildcard pattern to regex
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  return new RegExp(`^${regexPattern}$`).test(topic);
}

export function validateTopicName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }

  // Check length
  if (name.length < 1 || name.length > 255) {
    return false;
  }

  // Check characters (alphanumeric, _, -, .)
  if (!/^[a-zA-Z0-9_\-./]+$/.test(name)) {
    return false;
  }

  // Check for consecutive dots
  if (name.includes('..')) {
    return false;
  }

  // Check for leading or trailing dots
  if (name.startsWith('.') || name.endsWith('.')) {
    return false;
  }

  return true;
}

export function compressMessage(message: Message, compression: string): Message {
  if (compression === 'none') {
    return message;
  }

  // Implementation for compression would go here
  // For now, return the original message
  return message;
}

export function decompressMessage(message: Message, compression: string): Message {
  if (compression === 'none') {
    return message;
  }

  // Implementation for decompression would go here
  // For now, return the original message
  return message;
}

export function calculateMessageSize(message: Message): number {
  const serialized = JSON.stringify(message);
  return new Blob([serialized]).size;
}

export function isMessageExpired(message: Message): boolean {
  if (!message.ttl) {
    return false;
  }

  return Date.now() - message.timestamp > message.ttl;
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatRate(rate: number, unit: string = 'messages'): string {
  if (rate < 1000) {
    return `${rate.toFixed(2)} ${unit}/s`;
  }

  if (rate < 1000000) {
    return `${(rate / 1000).toFixed(2)} K${unit}/s`;
  }

  return `${(rate / 1000000).toFixed(2)} M${unit}/s`;
}