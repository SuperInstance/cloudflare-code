/**
 * Example: Basic Usage Tracking
 *
 * This example demonstrates how to track usage for billing purposes
 */

import { createUsageMeter, createUsageCollector } from '../src/index.js';

// Initialize usage meter
const meter = createUsageMeter({
  enabled: true,
  aggregationWindow: 300, // 5 minutes
  retentionPeriod: 90, // 90 days
  realTimeEnabled: false,
  batchProcessingEnabled: true,
});

// Create usage collector
const collector = createUsageCollector(meter);

// Track API request
async function trackAPIRequest(userId: string, organizationId: string) {
  await collector.collectRequestMetrics({
    userId,
    organizationId,
    endpoint: '/api/v1/generate',
    method: 'POST',
    statusCode: 200,
    timestamp: new Date(),
    duration: 1500, // milliseconds
    tokenCount: {
      prompt: 100,
      completion: 200,
      total: 300,
    },
    requestBody: 1000, // bytes
    responseBody: 5000, // bytes
  });

  console.log('Request tracked successfully');
}

// Check usage limits
async function checkUsageLimits(organizationId: string) {
  const requests = await meter.getCurrentUsage(organizationId, 'requests' as any);
  const limit = 10000; // Pro plan limit

  if (requests >= limit) {
    console.log('Warning: Approaching request limit');
  }

  console.log(`Used ${requests} of ${limit} requests`);
}

// Example usage
async function main() {
  const userId = 'user_123';
  const organizationId = 'org_456';

  // Track some requests
  for (let i = 0; i < 10; i++) {
    await trackAPIRequest(userId, organizationId);
  }

  // Check usage
  await checkUsageLimits(organizationId);

  // Get usage summary
  const summary = await meter.getUsageSummary(organizationId);
  console.log('Usage summary:', summary);
}

// Uncomment to run
// main().catch(console.error);
