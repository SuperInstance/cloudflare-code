/**
 * Basic usage examples for ClaudeFlare Webhooks
 */

import {
  WebhookManager,
  DeliveryEngine,
  SecurityLayer,
  RetryHandler,
  WebhookAnalytics,
  WebhookEventType,
  mergeConfig,
} from '@claudeflare/webhooks';
import {
  MemoryWebhookStorage,
  MemoryDeliveryStorage,
  MemoryKVStorage,
  MemoryAnalyticsStorage,
} from '@claudeflare/webhooks/src/storage/memory.js';

// Initialize storage
const webhookStorage = new MemoryWebhookStorage();
const deliveryStorage = new MemoryDeliveryStorage();
const kvStorage = new MemoryKVStorage();
const analyticsStorage = new MemoryAnalyticsStorage();

// Initialize configuration
const config = mergeConfig({
  environment: 'development',
  defaultTimeout: 30000,
  retry: {
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    maxAttempts: 3,
  },
});

// Initialize components
const securityLayer = new SecurityLayer(config, kvStorage);
const retryHandler = new RetryHandler(config, deliveryStorage, kvStorage);
const deliveryEngine = new DeliveryEngine(
  config,
  webhookStorage,
  deliveryStorage,
  kvStorage,
  securityLayer,
  retryHandler
);
const webhookManager = new WebhookManager(
  config,
  webhookStorage,
  kvStorage,
  securityLayer
);
const analytics = new WebhookAnalytics(config, analyticsStorage);

/**
 * Example 1: Create a webhook
 */
async function createWebhookExample() {
  console.log('=== Creating Webhook ===');

  const webhook = await webhookManager.create({
    name: 'Deployment Notifications',
    description: 'Get notified when deployments complete',
    userId: 'user-123',
    projectId: 'project-abc',
    url: 'https://example.com/webhooks/deployments',
    events: [
      WebhookEventType.DEPLOYMENT_STARTED,
      WebhookEventType.DEPLOYMENT_SUCCESS,
      WebhookEventType.DEPLOYMENT_FAILED,
    ],
    secret: 'your-secure-secret-key-here-min-32-chars!!',
    timeout: 30000,
    retryConfig: {
      enabled: true,
      strategy: 'exponential_backoff',
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 60000,
      backoffMultiplier: 2,
    },
  });

  console.log('Created webhook:', webhook.id);
  console.log('Webhook URL:', webhook.url);
  console.log('Webhook events:', webhook.events);

  return webhook;
}

/**
 * Example 2: Trigger a webhook
 */
async function triggerWebhookExample(webhookId: string) {
  console.log('\n=== Triggering Webhook ===');

  const event = {
    id: 'event-123',
    type: WebhookEventType.DEPLOYMENT_SUCCESS,
    source: 'claudeflare/deploy',
    subject: 'deployment/deploy-123',
    timestamp: new Date(),
    data: {
      deploymentId: 'deploy-123',
      status: 'success',
      environment: 'production',
      commit: 'abc123',
      duration: 45000,
    },
  };

  const result = await deliveryEngine.deliver(webhookId, event);

  console.log('Delivery result:', {
    success: result.success,
    statusCode: result.statusCode,
    duration: result.duration,
    willRetry: result.willRetry,
  });

  return result;
}

/**
 * Example 3: List webhooks
 */
async function listWebhooksExample() {
  console.log('\n=== Listing Webhooks ===');

  const { items, total } = await webhookManager.list({
    userId: 'user-123',
    active: true,
    limit: 10,
  });

  console.log(`Found ${total} webhooks:`);
  for (const webhook of items) {
    console.log(`- ${webhook.name} (${webhook.url})`);
  }
}

/**
 * Example 4: Update webhook configuration
 */
async function updateWebhookExample(webhookId: string) {
  console.log('\n=== Updating Webhook ===');

  const updated = await webhookManager.update(webhookId, {
    name: 'Production Deployment Notifications',
    timeout: 60000,
    retryConfig: {
      enabled: true,
      strategy: 'exponential_backoff',
      maxRetries: 5,
      initialDelay: 2000,
      maxDelay: 120000,
      backoffMultiplier: 2,
    },
  });

  console.log('Updated webhook:', updated.name);
  console.log('New timeout:', updated.timeout);
}

/**
 * Example 5: Test webhook endpoint
 */
async function testWebhookExample(webhookId: string) {
  console.log('\n=== Testing Webhook Endpoint ===');

  const testResult = await webhookManager.testEndpoint(webhookId);

  console.log('Test result:', {
    success: testResult.success,
    statusCode: testResult.statusCode,
    responseTime: testResult.responseTime,
    error: testResult.error,
  });
}

/**
 * Example 6: Get webhook statistics
 */
async function getStatisticsExample(webhookId: string) {
  console.log('\n=== Webhook Statistics ===');

  const stats = await webhookManager.getStatistics(webhookId);

  console.log('Statistics:', {
    totalDeliveries: stats.totalDeliveries,
    successfulDeliveries: stats.successfulDeliveries,
    failedDeliveries: stats.failedDeliveries,
    successRate: `${(stats.successRate * 100).toFixed(2)}%`,
    averageDeliveryTime: `${stats.averageDeliveryTime.toFixed(0)}ms`,
  });
}

/**
 * Example 7: Batch webhook delivery
 */
async function batchDeliveryExample() {
  console.log('\n=== Batch Delivery ===');

  const webhook1 = await webhookManager.create({
    name: 'Webhook 1',
    userId: 'user-123',
    url: 'https://example.com/webhook1',
    events: [WebhookEventType.CODE_PUSH],
  });

  const webhook2 = await webhookManager.create({
    name: 'Webhook 2',
    userId: 'user-123',
    url: 'https://example.com/webhook2',
    events: [WebhookEventType.CODE_PUSH],
  });

  const event = {
    id: 'event-batch-1',
    type: WebhookEventType.CODE_PUSH,
    source: 'claudeflare/git',
    subject: 'repo/repo-name',
    timestamp: new Date(),
    data: {
      branch: 'main',
      commit: 'def456',
      author: 'developer',
    },
  };

  const batchResult = await deliveryEngine.deliverBatch([
    { webhookId: webhook1.id, event },
    { webhookId: webhook2.id, event },
  ]);

  console.log('Batch result:', {
    total: batchResult.total,
    successful: batchResult.successful,
    failed: batchResult.failed,
    duration: batchResult.duration,
  });
}

/**
 * Example 8: Webhook with filters
 */
async function filteredWebhookExample() {
  console.log('\n=== Filtered Webhook ===');

  const webhook = await webhookManager.create({
    name: 'Production Alerts Only',
    userId: 'user-123',
    url: 'https://example.com/webhooks/production',
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

  console.log('Created filtered webhook:', webhook.id);
  console.log('Filters:', webhook.filters);
}

/**
 * Example 9: Analytics and monitoring
 */
async function analyticsExample(webhookId: string) {
  console.log('\n=== Analytics ===');

  const period = {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    end: new Date(),
    granularity: 'hour' as const,
  };

  const analyticsData = await analytics.getWebhookAnalytics(webhookId, period);

  console.log('Analytics:', {
    totalEvents: analyticsData.metrics.totalEvents,
    deliveredEvents: analyticsData.metrics.deliveredEvents,
    failedEvents: analyticsData.metrics.failedEvents,
    averageLatency: `${analyticsData.metrics.averageLatency.toFixed(0)}ms`,
    p95Latency: `${analyticsData.metrics.p95Latency.toFixed(0)}ms`,
    throughput: `${analyticsData.metrics.throughput.toFixed(2)} events/sec`,
  });
}

/**
 * Example 10: Alert management
 */
async function alertsExample() {
  console.log('\n=== Alert Management ===');

  // Add custom alert condition
  const alert = analytics.addAlertCondition({
    name: 'Critical Failure Rate',
    type: 'failure_rate',
    threshold: 0.1, // 10%
    windowMinutes: 5,
    enabled: true,
  });

  console.log('Created alert:', alert.id, alert.name);

  // Check alerts
  const triggeredAlerts = await analytics.checkAlerts();

  console.log('Triggered alerts:', triggeredAlerts.length);

  // Get alert history
  const history = analytics.getAlertHistory({ limit: 10 });

  console.log('Recent alerts:', history.length);
}

/**
 * Main example runner
 */
async function main() {
  try {
    // Run examples
    const webhook = await createWebhookExample();
    await triggerWebhookExample(webhook.id);
    await listWebhooksExample();
    await updateWebhookExample(webhook.id);
    await testWebhookExample(webhook.id);
    await getStatisticsExample(webhook.id);
    await batchDeliveryExample();
    await filteredWebhookExample();
    await analyticsExample(webhook.id);
    await alertsExample();

    console.log('\n=== All Examples Completed ===');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export examples for use in other files
export {
  createWebhookExample,
  triggerWebhookExample,
  listWebhooksExample,
  updateWebhookExample,
  testWebhookExample,
  getStatisticsExample,
  batchDeliveryExample,
  filteredWebhookExample,
  analyticsExample,
  alertsExample,
};

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
