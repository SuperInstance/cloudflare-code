/**
 * Tests for Delivery Engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeliveryEngine } from './engine.js';
import { WebhookEventType } from '../types/webhook.js';
import {
  MemoryWebhookStorage,
  MemoryDeliveryStorage,
  MemoryKVStorage,
} from '../storage/memory.js';
import { SecurityLayer } from '../security/layer.js';
import { RetryHandler } from '../retry/handler.js';

describe('DeliveryEngine', () => {
  let engine: DeliveryEngine;
  let webhookStorage: MemoryWebhookStorage;
  let deliveryStorage: MemoryDeliveryStorage;
  let kvStorage: MemoryKVStorage;
  let securityLayer: SecurityLayer;
  let retryHandler: RetryHandler;

  const config: any = {
    environment: 'test',
    defaultTimeout: 30000,
    maxTimeout: 300000,
    defaultSignatureAlgorithm: 'hmac_sha256',
    signatureTimestampTolerance: 300000,
    maxPayloadSize: 6 * 1024 * 1024,
    maxBatchSize: 100,
    maxBatchWaitTime: 5000,
    maxDeliveryAttempts: 5,
    rateLimit: {
      maxPerSecond: 100,
      burstAllowance: 20,
      windowSizeMs: 60000,
    },
    queue: {
      maxQueueSize: 10000,
      retentionMs: 7 * 24 * 60 * 60 * 1000,
      maxProcessingTime: 300000,
    },
    retry: {
      initialDelayMs: 1000,
      maxDelayMs: 60000,
      backoffMultiplier: 2,
      maxAttempts: 3,
    },
    deadLetter: {
      maxSize: 100000,
      retentionMs: 30 * 24 * 60 * 60 * 1000,
      autoRetry: false,
      autoRetryIntervalMs: 3600000,
    },
    storage: {
      deliveryRetentionMs: 90 * 24 * 60 * 60 * 1000,
      analyticsRetentionMs: 365 * 24 * 60 * 60 * 1000,
      maxRecordsPerQuery: 1000,
    },
    security: {
      enableIPWhitelist: false,
      enableReplayProtection: true,
      replayWindowMs: 3600000,
      requireHTTPS: true,
    },
    monitoring: {
      enabled: true,
      exportIntervalMs: 60000,
      alerts: {
        failureRateThreshold: 0.05,
        latencyThresholdMs: 5000,
        queueSizeThreshold: 5000,
      },
    },
    features: {
      batchDelivery: true,
      templates: true,
      filters: true,
      transformScripts: false,
      analytics: true,
    },
  };

  beforeEach(() => {
    webhookStorage = new MemoryWebhookStorage();
    deliveryStorage = new MemoryDeliveryStorage();
    kvStorage = new MemoryKVStorage();
    securityLayer = new SecurityLayer(config, kvStorage);
    retryHandler = new RetryHandler(config, deliveryStorage, kvStorage);
    engine = new DeliveryEngine(
      config,
      webhookStorage,
      deliveryStorage,
      kvStorage,
      securityLayer,
      retryHandler
    );

    // Mock fetch for testing
    global.fetch = vi.fn();
  });

  describe('Single Delivery', () => {
    it('should deliver a webhook successfully', async () => {
      const webhook = await webhookStorage.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
        httpMethod: 'POST',
        secret: 'test-secret-with-32-characters-1234567890',
        signatureAlgorithm: 'hmac_sha256',
        active: true,
        priority: 2,
        timeout: 30000,
        retryConfig: {
          enabled: true,
          strategy: 'exponential_backoff',
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 60000,
          backoffMultiplier: 2,
          retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        },
      });

      const event = {
        id: 'event-123',
        type: WebhookEventType.CODE_PUSH,
        source: 'claudeflare/git',
        subject: 'repo/test',
        timestamp: new Date(),
        data: {
          branch: 'main',
          commit: 'abc123',
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK',
        headers: new Headers(),
      });

      const result = await engine.deliver(webhook.id, event);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.deliveryId).toBeDefined();
    });

    it('should handle webhook delivery failures', async () => {
      const webhook = await webhookStorage.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
        httpMethod: 'POST',
        secret: 'test-secret-with-32-characters-1234567890',
        signatureAlgorithm: 'hmac_sha256',
        active: true,
        priority: 2,
        timeout: 30000,
        retryConfig: {
          enabled: true,
          strategy: 'exponential_backoff',
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 60000,
          backoffMultiplier: 2,
          retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        },
      });

      const event = {
        id: 'event-123',
        type: WebhookEventType.CODE_PUSH,
        source: 'claudeflare/git',
        subject: 'repo/test',
        timestamp: new Date(),
        data: {},
      };

      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await engine.deliver(webhook.id, event);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should not deliver to inactive webhooks', async () => {
      const webhook = await webhookStorage.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
        httpMethod: 'POST',
        secret: 'test-secret-with-32-characters-1234567890',
        signatureAlgorithm: 'hmac_sha256',
        active: false, // Inactive
        priority: 2,
        timeout: 30000,
        retryConfig: {
          enabled: true,
          strategy: 'exponential_backoff',
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 60000,
          backoffMultiplier: 2,
          retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        },
      });

      const event = {
        id: 'event-123',
        type: WebhookEventType.CODE_PUSH,
        source: 'claudeflare/git',
        subject: 'repo/test',
        timestamp: new Date(),
        data: {},
      };

      const result = await engine.deliver(webhook.id, event);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not active');
    });
  });

  describe('Batch Delivery', () => {
    it('should deliver multiple webhooks in batch', async () => {
      const webhook1 = await webhookStorage.create({
        name: 'Webhook 1',
        userId: 'user-123',
        url: 'https://example.com/webhook1',
        events: [WebhookEventType.CODE_PUSH],
        httpMethod: 'POST',
        secret: 'test-secret-with-32-characters-1234567890',
        signatureAlgorithm: 'hmac_sha256',
        active: true,
        priority: 2,
        timeout: 30000,
        retryConfig: {
          enabled: true,
          strategy: 'exponential_backoff',
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 60000,
          backoffMultiplier: 2,
          retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        },
      });

      const webhook2 = await webhookStorage.create({
        name: 'Webhook 2',
        userId: 'user-123',
        url: 'https://example.com/webhook2',
        events: [WebhookEventType.CODE_PUSH],
        httpMethod: 'POST',
        secret: 'test-secret-with-32-characters-1234567890',
        signatureAlgorithm: 'hmac_sha256',
        active: true,
        priority: 2,
        timeout: 30000,
        retryConfig: {
          enabled: true,
          strategy: 'exponential_backoff',
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 60000,
          backoffMultiplier: 2,
          retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        },
      });

      const event = {
        id: 'event-123',
        type: WebhookEventType.CODE_PUSH,
        source: 'claudeflare/git',
        subject: 'repo/test',
        timestamp: new Date(),
        data: {},
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK',
        headers: new Headers(),
      });

      const batchResult = await engine.deliverBatch([
        { webhookId: webhook1.id, event },
        { webhookId: webhook2.id, event },
      ]);

      expect(batchResult.total).toBe(2);
      expect(batchResult.successful).toBe(2);
      expect(batchResult.failed).toBe(0);
    });
  });

  describe('Queue Management', () => {
    it('should queue webhooks for later delivery', async () => {
      const webhook = await webhookStorage.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
        httpMethod: 'POST',
        secret: 'test-secret-with-32-characters-1234567890',
        signatureAlgorithm: 'hmac_sha256',
        active: true,
        priority: 2,
        timeout: 30000,
        retryConfig: {
          enabled: true,
          strategy: 'exponential_backoff',
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 60000,
          backoffMultiplier: 2,
          retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        },
      });

      const event = {
        id: 'event-123',
        type: WebhookEventType.CODE_PUSH,
        source: 'claudeflare/git',
        subject: 'repo/test',
        timestamp: new Date(),
        data: {},
      };

      const queueItemId = await engine.queueDelivery(webhook.id, event);

      expect(queueItemId).toBeDefined();
      expect(engine.getQueueSize()).toBeGreaterThan(0);
    });

    it('should process queued deliveries', async () => {
      const webhook = await webhookStorage.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
        httpMethod: 'POST',
        secret: 'test-secret-with-32-characters-1234567890',
        signatureAlgorithm: 'hmac_sha256',
        active: true,
        priority: 2,
        timeout: 30000,
        retryConfig: {
          enabled: true,
          strategy: 'exponential_backoff',
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 60000,
          backoffMultiplier: 2,
          retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        },
      });

      const event = {
        id: 'event-123',
        type: WebhookEventType.CODE_PUSH,
        source: 'claudeflare/git',
        subject: 'repo/test',
        timestamp: new Date(),
        data: {},
      };

      await engine.queueDelivery(webhook.id, event, new Date(Date.now() - 1000));

      const processed = await engine.processQueue();

      expect(processed).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should get delivery statistics', async () => {
      const stats = await engine.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalDeliveries).toBeDefined();
      expect(stats.queueSize).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const webhook = await webhookStorage.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
        httpMethod: 'POST',
        secret: 'test-secret-with-32-characters-1234567890',
        signatureAlgorithm: 'hmac_sha256',
        active: true,
        priority: 2,
        timeout: 30000,
        retryConfig: {
          enabled: true,
          strategy: 'exponential_backoff',
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 60000,
          backoffMultiplier: 2,
          retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        },
        rateLimit: {
          enabled: true,
          maxRequests: 5,
          windowMs: 60000,
          burstAllowance: 1,
        },
      });

      const event = {
        id: 'event-123',
        type: WebhookEventType.CODE_PUSH,
        source: 'claudeflare/git',
        subject: 'repo/test',
        timestamp: new Date(),
        data: {},
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK',
        headers: new Headers(),
      });

      // First 5 deliveries should succeed
      for (let i = 0; i < 5; i++) {
        const result = await engine.deliver(webhook.id, { ...event, id: `event-${i}` });
        expect(result.success).toBe(true);
      }

      // 6th delivery should fail due to rate limit
      const result = await engine.deliver(webhook.id, { ...event, id: 'event-6' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit');
    });
  });
});
