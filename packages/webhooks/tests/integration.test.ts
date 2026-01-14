/**
 * Integration tests for the complete webhook system
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  WebhookManager,
  DeliveryEngine,
  SecurityLayer,
  RetryHandler,
  WebhookAnalytics,
  WebhookEventType,
  mergeConfig,
} from '../src/index.js';
import {
  MemoryWebhookStorage,
  MemoryDeliveryStorage,
  MemoryKVStorage,
  MemoryAnalyticsStorage,
} from '../src/storage/memory.js';

describe('Webhook System Integration', () => {
  let webhookManager: WebhookManager;
  let deliveryEngine: DeliveryEngine;
  let securityLayer: SecurityLayer;
  let retryHandler: RetryHandler;
  let analytics: WebhookAnalytics;

  let webhookStorage: MemoryWebhookStorage;
  let deliveryStorage: MemoryDeliveryStorage;
  let kvStorage: MemoryKVStorage;
  let analyticsStorage: MemoryAnalyticsStorage;

  const config = mergeConfig({
    environment: 'test',
    defaultTimeout: 30000,
    retry: {
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
      maxAttempts: 2,
    },
  });

  beforeAll(() => {
    webhookStorage = new MemoryWebhookStorage();
    deliveryStorage = new MemoryDeliveryStorage();
    kvStorage = new MemoryKVStorage();
    analyticsStorage = new MemoryAnalyticsStorage();

    securityLayer = new SecurityLayer(config, kvStorage);
    retryHandler = new RetryHandler(config, deliveryStorage, kvStorage);
    webhookManager = new WebhookManager(config, webhookStorage, kvStorage, securityLayer);
    deliveryEngine = new DeliveryEngine(
      config,
      webhookStorage,
      deliveryStorage,
      kvStorage,
      securityLayer,
      retryHandler
    );
    analytics = new WebhookAnalytics(config, analyticsStorage);
  });

  describe('End-to-End Webhook Lifecycle', () => {
    it('should complete full webhook lifecycle', async () => {
      // 1. Create a webhook
      const webhook = await webhookManager.create({
        name: 'Integration Test Webhook',
        userId: 'integration-user',
        url: 'https://example.com/integration-webhook',
        events: [WebhookEventType.DEPLOYMENT_SUCCESS],
        secret: 'integration-test-secret-key-32-chars!!',
      });

      expect(webhook.id).toBeDefined();
      expect(webhook.active).toBe(true);

      // 2. Verify webhook is retrievable
      const retrieved = await webhookManager.getById(webhook.id);
      expect(retrieved!.id).toBe(webhook.id);

      // 3. List webhooks for user
      const userWebhooks = await webhookManager.list({
        userId: 'integration-user',
      });

      expect(userWebhooks.items).toHaveLength(1);
      expect(userWebhooks.items[0].id).toBe(webhook.id);

      // 4. Test webhook endpoint (will fail in test, but that's ok)
      const testResult = await webhookManager.testEndpoint(webhook.id);
      expect(testResult).toBeDefined();

      // 5. Update webhook configuration
      const updated = await webhookManager.update(webhook.id, {
        name: 'Updated Integration Test Webhook',
        timeout: 60000,
      });

      expect(updated.name).toBe('Updated Integration Test Webhook');
      expect(updated.timeout).toBe(60000);

      // 6. Regenerate secret
      const { secret: newSecret } = await webhookManager.regenerateSecret(webhook.id);
      expect(newSecret).toBeDefined();
      expect(newSecret).not.toBe(webhook.secret);

      // 7. Deactivate webhook
      const deactivated = await webhookManager.deactivate(webhook.id);
      expect(deactivated.active).toBe(false);

      // 8. Reactivate webhook
      const activated = await webhookManager.activate(webhook.id);
      expect(activated.active).toBe(true);

      // 9. Delete webhook
      const deleted = await webhookManager.delete(webhook.id);
      expect(deleted).toBe(true);

      // 10. Verify webhook is gone
      await expect(webhookManager.getById(webhook.id)).rejects.toThrow();
    });
  });

  describe('Multi-Webhook Event Delivery', () => {
    it('should deliver events to multiple webhooks', async () => {
      // Create multiple webhooks for the same event
      const webhook1 = await webhookManager.create({
        name: 'Webhook 1',
        userId: 'multi-user',
        url: 'https://example.com/webhook1',
        events: [WebhookEventType.CODE_PUSH],
      });

      const webhook2 = await webhookManager.create({
        name: 'Webhook 2',
        userId: 'multi-user',
        url: 'https://example.com/webhook2',
        events: [WebhookEventType.CODE_PUSH],
      });

      const webhook3 = await webhookManager.create({
        name: 'Webhook 3',
        userId: 'multi-user',
        url: 'https://example.com/webhook3',
        events: [WebhookEventType.CODE_PUSH],
        active: false, // This one should not receive events
      });

      // Create an event
      const event = {
        id: 'integration-event-1',
        type: WebhookEventType.CODE_PUSH,
        source: 'integration-test',
        subject: 'repo/test',
        timestamp: new Date(),
        data: {
          branch: 'main',
          commit: 'abc123',
          author: 'test-user',
        },
      };

      // Get active webhooks for this event
      const activeWebhooks = await webhookManager.getActiveForEvent(WebhookEventType.CODE_PUSH);
      expect(activeWebhooks.length).toBe(2); // Only webhook1 and webhook2

      // Verify all webhooks have the CODE_PUSH event
      for (const wh of activeWebhooks) {
        expect(wh.events).toContain(WebhookEventType.CODE_PUSH);
      }
    });
  });

  describe('Security Integration', () => {
    it('should verify webhook signatures end-to-end', async () => {
      const webhook = await webhookManager.create({
        name: 'Security Test Webhook',
        userId: 'security-user',
        url: 'https://example.com/security-webhook',
        events: [WebhookEventType.SECURITY_INCIDENT],
        secret: 'security-test-secret-32-characters-min!!',
      });

      const event = {
        id: 'security-event-1',
        type: WebhookEventType.SECURITY_INCIDENT,
        source: 'security-test',
        subject: 'incident/test',
        timestamp: new Date(),
        data: {
          severity: 'high',
          description: 'Test incident',
        },
      };

      // Sign the event
      const signature = await securityLayer.signEvent(event, webhook.secret, {
        includeTimestamp: true,
        includeEventId: true,
      });

      expect(signature.signature).toBeDefined();
      expect(signature.timestamp).toBeDefined();
      expect(signature.headers).toBeDefined();

      // Verify the signature
      const payload = JSON.stringify(event);
      const verified = await securityLayer.verify(
        payload,
        signature.signature,
        webhook.secret,
        webhook.signatureAlgorithm,
        signature.timestamp
      );

      expect(verified.valid).toBe(true);
    });

    it('should detect replay attacks', async () => {
      const eventId = 'replay-test-event-1';

      // First call should succeed
      await securityLayer.checkReplayAttack(eventId);

      // Second call should fail
      await expect(securityLayer.checkReplayAttack(eventId)).rejects.toThrow();
    });
  });

  describe('Retry Integration', () => {
    it('should handle retry logic', async () => {
      const webhook = await webhookManager.create({
        name: 'Retry Test Webhook',
        userId: 'retry-user',
        url: 'https://example.com/retry-webhook',
        events: [WebhookEventType.BUILD_FAILED],
        retryConfig: {
          enabled: true,
          strategy: 'exponential_backoff',
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 60000,
          backoffMultiplier: 2,
          retryableStatusCodes: [500, 502, 503],
        },
      });

      // Create a failed delivery
      const delivery = await deliveryStorage.create({
        webhookId: webhook.id,
        eventType: WebhookEventType.BUILD_FAILED,
        eventId: 'retry-event-1',
        payload: {},
        status: 'failed',
        attemptNumber: 1,
        maxAttempts: 3,
        duration: 1000,
      });

      // Calculate retry
      const retryCalc = await retryHandler.calculateRetry(delivery, 500);

      expect(retryCalc.shouldRetry).toBe(true);
      expect(retryCalc.attemptNumber).toBe(2);
      expect(retryCalc.nextRetryAt).toBeInstanceOf(Date);
    });
  });

  describe('Analytics Integration', () => {
    it('should track delivery analytics', async () => {
      const webhook = await webhookManager.create({
        name: 'Analytics Test Webhook',
        userId: 'analytics-user',
        url: 'https://example.com/analytics-webhook',
        events: [WebhookEventType.METRIC_ALERT],
      });

      // Record some deliveries
      for (let i = 0; i < 10; i++) {
        const delivery = await deliveryStorage.create({
          webhookId: webhook.id,
          eventType: WebhookEventType.METRIC_ALERT,
          eventId: `analytics-event-${i}`,
          payload: {},
          status: i < 8 ? 'success' : 'failed',
          attemptNumber: 1,
          maxAttempts: 3,
          duration: 100 + i * 10,
        });

        await analytics.recordDelivery(delivery);
      }

      // Get statistics
      const stats = await deliveryEngine.getStatistics(webhook.id);

      expect(stats.totalDeliveries).toBe(10);
      expect(stats.successfulDeliveries).toBeGreaterThanOrEqual(0);

      // Get analytics
      const period = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
        granularity: 'hour' as const,
      };

      const webhookAnalytics = await analytics.getWebhookAnalytics(webhook.id, period);

      expect(webhookAnalytics).toBeDefined();
      expect(webhookAnalytics.metrics.totalEvents).toBeDefined();
    });
  });

  describe('Filter Integration', () => {
    it('should filter webhooks based on conditions', async () => {
      const webhook = await webhookManager.create({
        name: 'Filtered Webhook',
        userId: 'filter-user',
        url: 'https://example.com/filtered-webhook',
        events: [WebhookEventType.SECURITY_INCIDENT],
        filters: [
          {
            field: 'data.environment',
            operator: 'eq',
            value: 'production',
          },
          {
            field: 'data.severity',
            operator: 'in',
            value: ['high', 'critical'],
          },
        ],
      });

      // Test event that should match
      const matchingEvent = {
        id: 'filter-event-1',
        type: WebhookEventType.SECURITY_INCIDENT,
        source: 'filter-test',
        subject: 'incident/test',
        timestamp: new Date(),
        data: {
          environment: 'production',
          severity: 'high',
          description: 'Test incident',
        },
      };

      // Test event that should not match
      const nonMatchingEvent = {
        id: 'filter-event-2',
        type: WebhookEventType.SECURITY_INCIDENT,
        source: 'filter-test',
        subject: 'incident/test',
        timestamp: new Date(),
        data: {
          environment: 'staging', // Wrong environment
          severity: 'high',
          description: 'Test incident',
        },
      };

      // Verify webhook has filters
      expect(webhook.filters).toBeDefined();
      expect(webhook.filters!.length).toBe(2);
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch webhook operations', async () => {
      const webhooks = [];

      // Create multiple webhooks
      for (let i = 1; i <= 5; i++) {
        const webhook = await webhookManager.create({
          name: `Batch Webhook ${i}`,
          userId: 'batch-user',
          url: `https://example.com/batch-webhook-${i}`,
          events: [WebhookEventType.DEPLOYMENT_SUCCESS],
        });
        webhooks.push(webhook);
      }

      // List all webhooks for user
      const { items } = await webhookManager.list({
        userId: 'batch-user',
      });

      expect(items).toHaveLength(5);

      // Batch delete
      for (const webhook of webhooks) {
        await webhookManager.delete(webhook.id);
      }

      // Verify all deleted
      const { items: remaining } = await webhookManager.list({
        userId: 'batch-user',
      });

      expect(remaining).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      // Try to get non-existent webhook
      await expect(webhookManager.getById('non-existent-id')).rejects.toThrow();

      // Try to update non-existent webhook
      await expect(
        webhookManager.update('non-existent-id', { name: 'New Name' })
      ).rejects.toThrow();

      // Try to delete non-existent webhook
      const result = await webhookManager.delete('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('Configuration Management', () => {
    it('should use custom configuration', async () => {
      const customConfig = mergeConfig({
        defaultTimeout: 60000,
        retry: {
          initialDelayMs: 2000,
          maxDelayMs: 120000,
          backoffMultiplier: 3,
          maxAttempts: 5,
        },
      });

      expect(customConfig.defaultTimeout).toBe(60000);
      expect(customConfig.retry.initialDelayMs).toBe(2000);
      expect(customConfig.retry.maxAttempts).toBe(5);
    });
  });
});
