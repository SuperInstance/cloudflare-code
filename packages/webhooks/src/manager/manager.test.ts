/**
 * Tests for Webhook Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookManager } from './manager.js';
import { MemoryWebhookStorage, MemoryKVStorage } from '../storage/memory.js';
import { SecurityLayer } from '../security/layer.js';
import { WebhookEventType } from '../types/webhook.js';
import { InvalidWebhookConfigError, WebhookNotFoundError } from '../types/errors.js';

describe('WebhookManager', () => {
  let manager: WebhookManager;
  let storage: MemoryWebhookStorage;
  let kvStorage: MemoryKVStorage;
  let securityLayer: SecurityLayer;

  const config: any = {
    environment: 'test',
    defaultTimeout: 30000,
    maxTimeout: 300000,
    defaultSignatureAlgorithm: 'hmac_sha256',
    retry: {
      initialDelayMs: 1000,
      maxDelayMs: 60000,
      backoffMultiplier: 2,
      maxAttempts: 3,
    },
    security: {
      enableIPWhitelist: false,
      enableReplayProtection: true,
      replayWindowMs: 3600000,
      requireHTTPS: true,
    },
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
    storage = new MemoryWebhookStorage();
    kvStorage = new MemoryKVStorage();
    securityLayer = new SecurityLayer(config, kvStorage);
    manager = new WebhookManager(config, storage, kvStorage, securityLayer);
  });

  describe('Webhook Creation', () => {
    it('should create a webhook with valid configuration', async () => {
      const webhook = await manager.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
      });

      expect(webhook).toBeDefined();
      expect(webhook.id).toBeDefined();
      expect(webhook.name).toBe('Test Webhook');
      expect(webhook.userId).toBe('user-123');
      expect(webhook.url).toBe('https://example.com/webhook');
      expect(webhook.events).toContain(WebhookEventType.CODE_PUSH);
      expect(webhook.active).toBe(true);
      expect(webhook.secret).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it('should generate a secret if not provided', async () => {
      const webhook = await manager.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
      });

      expect(webhook.secret).toBeDefined();
      expect(webhook.secret.length).toBeGreaterThanOrEqual(32);
    });

    it('should use provided secret if valid', async () => {
      const customSecret = 'CustomSecret123!@#CustomSecret123!@#';

      const webhook = await manager.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
        secret: customSecret,
      });

      expect(webhook.secret).toBe(customSecret);
    });

    it('should reject webhook with invalid URL', async () => {
      await expect(
        manager.create({
          name: 'Test Webhook',
          userId: 'user-123',
          url: 'not-a-valid-url',
          events: [WebhookEventType.CODE_PUSH],
        })
      ).rejects.toThrow();
    });

    it('should reject webhook with no events', async () => {
      await expect(
        manager.create({
          name: 'Test Webhook',
          userId: 'user-123',
          url: 'https://example.com/webhook',
          events: [],
        })
      ).rejects.toThrow(InvalidWebhookConfigError);
    });

    it('should reject webhook with weak secret', async () => {
      await expect(
        manager.create({
          name: 'Test Webhook',
          userId: 'user-123',
          url: 'https://example.com/webhook',
          events: [WebhookEventType.CODE_PUSH],
          secret: 'weak',
        })
      ).rejects.toThrow(InvalidWebhookConfigError);
    });
  });

  describe('Webhook Retrieval', () => {
    it('should get a webhook by ID', async () => {
      const created = await manager.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
      });

      const retrieved = await manager.getById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe('Test Webhook');
    });

    it('should throw error for non-existent webhook', async () => {
      await expect(manager.getById('non-existent')).rejects.toThrow(
        WebhookNotFoundError
      );
    });

    it('should get webhooks by user ID', async () => {
      await manager.create({
        name: 'Webhook 1',
        userId: 'user-123',
        url: 'https://example.com/webhook1',
        events: [WebhookEventType.CODE_PUSH],
      });

      await manager.create({
        name: 'Webhook 2',
        userId: 'user-123',
        url: 'https://example.com/webhook2',
        events: [WebhookEventType.BUILD_STARTED],
      });

      await manager.create({
        name: 'Webhook 3',
        userId: 'user-456',
        url: 'https://example.com/webhook3',
        events: [WebhookEventType.DEPLOYMENT_STARTED],
      });

      const user123Webhooks = await manager.getByUserId('user-123');

      expect(user123Webhooks).toHaveLength(2);
      expect(user123Webhooks.every(w => w.userId === 'user-123')).toBe(true);
    });
  });

  describe('Webhook Updates', () => {
    it('should update webhook name', async () => {
      const webhook = await manager.create({
        name: 'Original Name',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
      });

      const updated = await manager.update(webhook.id, {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
    });

    it('should update webhook URL', async () => {
      const webhook = await manager.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
      });

      const updated = await manager.update(webhook.id, {
        url: 'https://other.com/webhook',
      });

      expect(updated.url).toBe('https://other.com/webhook');
    });

    it('should add events to webhook', async () => {
      const webhook = await manager.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
      });

      const updated = await manager.update(webhook.id, {
        events: [WebhookEventType.CODE_PUSH, WebhookEventType.BUILD_STARTED],
      });

      expect(updated.events).toHaveLength(2);
      expect(updated.events).toContain(WebhookEventType.BUILD_STARTED);
    });
  });

  describe('Webhook Activation/Deactivation', () => {
    it('should deactivate a webhook', async () => {
      const webhook = await manager.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
      });

      const deactivated = await manager.deactivate(webhook.id);

      expect(deactivated.active).toBe(false);
    });

    it('should activate a deactivated webhook', async () => {
      const webhook = await manager.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
      });

      await manager.deactivate(webhook.id);
      const activated = await manager.activate(webhook.id);

      expect(activated.active).toBe(true);
    });
  });

  describe('Webhook Deletion', () => {
    it('should delete a webhook', async () => {
      const webhook = await manager.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
      });

      const deleted = await manager.delete(webhook.id);

      expect(deleted).toBe(true);

      await expect(manager.getById(webhook.id)).rejects.toThrow(
        WebhookNotFoundError
      );
    });

    it('should return false when deleting non-existent webhook', async () => {
      const deleted = await manager.delete('non-existent');

      expect(deleted).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate webhook configuration', async () => {
      const validation = await manager.validateConfig({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
      });

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid config', async () => {
      const validation = await manager.validateConfig({
        name: '',
        userId: 'user-123',
        url: 'not-a-url',
        events: [],
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Secret Regeneration', () => {
    it('should regenerate webhook secret', async () => {
      const webhook = await manager.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
        secret: 'OriginalSecret123!@#OriginalSecret123!@#',
      });

      const originalSecret = webhook.secret;

      const { secret: newSecret } = await manager.regenerateSecret(webhook.id);

      expect(newSecret).toBeDefined();
      expect(newSecret).not.toBe(originalSecret);
    });
  });

  describe('Statistics', () => {
    it('should get webhook statistics', async () => {
      const webhook = await manager.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
      });

      const stats = await manager.getStatistics(webhook.id);

      expect(stats).toBeDefined();
      expect(stats.totalDeliveries).toBe(0);
      expect(stats.successfulDeliveries).toBe(0);
      expect(stats.failedDeliveries).toBe(0);
    });
  });

  describe('Caching', () => {
    it('should cache webhooks', async () => {
      const webhook = await manager.create({
        name: 'Test Webhook',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.CODE_PUSH],
      });

      // First call - cache miss
      await manager.getById(webhook.id);

      // Second call - cache hit
      await manager.getById(webhook.id);

      expect(manager.getCacheSize()).toBeGreaterThan(0);
    });

    it('should clear cache', () => {
      manager.clearCache();

      expect(manager.getCacheSize()).toBe(0);
    });
  });
});
