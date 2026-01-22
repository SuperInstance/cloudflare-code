/**
 * Message Router Examples
 *
 * Examples demonstrating various routing strategies and patterns
 */

import { MessageRouter } from '../src/router/router';
import type { EventEnvelope, RouteRule } from '../src/router/router';

// Example 1: Content-Based Routing
async function contentBasedRoutingExample() {
  const router = new MessageRouter();

  // Route high-value orders to premium processing
  router.addRule({
    name: 'Premium orders',
    priority: 10,
    enabled: true,
    condition: {
      type: 'content',
      fieldPath: 'orderValue',
      operator: 'gte',
      value: 1000,
    },
    target: {
      type: 'topic',
      name: 'premium-orders',
    },
  });

  // Route international orders
  router.addRule({
    name: 'International orders',
    priority: 9,
    enabled: true,
    condition: {
      type: 'content',
      fieldPath: 'country',
      operator: 'ne',
      value: 'US',
    },
    target: {
      type: 'topic',
      name: 'international-orders',
    },
  });

  // Route standard orders
  router.addRule({
    name: 'Standard orders',
    priority: 1,
    enabled: true,
    condition: {
      type: 'content',
      fieldPath: 'orderType',
      operator: 'eq',
      value: 'standard',
    },
    target: {
      type: 'topic',
      name: 'standard-orders',
    },
  });

  const event: EventEnvelope = {
    metadata: {
      eventId: 'order_123',
      eventType: 'OrderCreated',
      timestamp: Date.now(),
      version: 1,
      source: 'order-service',
    },
    payload: {
      orderId: 'order_123',
      orderValue: 1500,
      country: 'CA',
      orderType: 'standard',
    },
  };

  const result = await router.route(event);
  console.log('Route result:', result);
  // Output: { matched: true, targets: [{ type: 'topic', name: 'premium-orders' }] }
}

// Example 2: Header-Based Routing
async function headerBasedRoutingExample() {
  const router = new MessageRouter();

  // Route events by region
  router.addRule({
    name: 'US East events',
    priority: 10,
    enabled: true,
    condition: {
      type: 'header',
      headerName: 'region',
      operator: 'eq',
      value: 'us-east-1',
    },
    target: {
      type: 'topic',
      name: 'us-east-events',
    },
  });

  router.addRule({
    name: 'EU events',
    priority: 10,
    enabled: true,
    condition: {
      type: 'header',
      headerName: 'region',
      operator: 'eq',
      value: 'eu-west-1',
    },
    target: {
      type: 'topic',
      name: 'eu-events',
    },
  });

  const event: EventEnvelope = {
    metadata: {
      eventId: 'evt_1',
      eventType: 'UserAction',
      timestamp: Date.now(),
      version: 1,
      source: 'web-service',
      region: 'us-east-1' as unknown as string,
    },
    payload: {
      action: 'click',
      userId: 'user_123',
    },
  };

  const result = await router.route(event);
  console.log('Route result:', result);
}

// Example 3: Pattern-Based Routing with Wildcards
async function patternBasedRoutingExample() {
  const router = new MessageRouter();

  // Route all user events
  router.addRule({
    name: 'All user events',
    priority: 10,
    enabled: true,
    condition: {
      type: 'pattern',
      pattern: 'User*',
      matchType: 'wildcard',
      scope: 'eventType',
    },
    target: {
      type: 'topic',
      name: 'user-events',
    },
  });

  // Route all order events
  router.addRule({
    name: 'All order events',
    priority: 10,
    enabled: true,
    condition: {
      type: 'pattern',
      pattern: 'Order*',
      matchType: 'wildcard',
      scope: 'eventType',
    },
    target: {
      type: 'topic',
      name: 'order-events',
    },
  });

  const userEvent: EventEnvelope = {
    metadata: {
      eventId: 'evt_1',
      eventType: 'UserCreated',
      timestamp: Date.now(),
      version: 1,
      source: 'user-service',
    },
    payload: { userId: 'user_123' },
  };

  const result = await router.route(userEvent);
  console.log('Route result:', result);
  // Output: { matched: true, targets: [{ type: 'topic', name: 'user-events' }] }
}

// Example 4: Composite Conditions (AND/OR/NOT)
async function compositeConditionsExample() {
  const router = new MessageRouter();

  // Route VIP customers from US
  router.addRule({
    name: 'VIP US customers',
    priority: 10,
    enabled: true,
    condition: {
      type: 'and',
      shortCircuit: true,
      conditions: [
        {
          type: 'content',
          fieldPath: 'customerTier',
          operator: 'eq',
          value: 'vip',
        },
        {
          type: 'content',
          fieldPath: 'country',
          operator: 'eq',
          value: 'US',
        },
      ],
    },
    target: {
      type: 'multi',
      targets: [
        { type: 'topic', name: 'vip-events' },
        { type: 'queue', name: 'priority-processing' },
      ],
    },
  });

  // Route high-value or frequent customers
  router.addRule({
    name: 'Important customers',
    priority: 9,
    enabled: true,
    condition: {
      type: 'or',
      shortCircuit: true,
      conditions: [
        {
          type: 'content',
          fieldPath: 'totalPurchases',
          operator: 'gte',
          value: 10000,
        },
        {
          type: 'content',
          fieldPath: 'orderCount',
          operator: 'gte',
          value: 50,
        },
      ],
    },
    target: {
      type: 'topic',
      name: 'important-customer-events',
    },
  });

  // Exclude test users
  router.addRule({
    name: 'Non-test users',
    priority: 8,
    enabled: true,
    condition: {
      type: 'not',
      conditions: [
        {
          type: 'content',
          fieldPath: 'userType',
          operator: 'eq',
          value: 'test',
        },
      ],
    },
    target: {
      type: 'topic',
      name: 'production-events',
    },
  });

  const event: EventEnvelope = {
    metadata: {
      eventId: 'evt_1',
      eventType: 'Purchase',
      timestamp: Date.now(),
      version: 1,
      source: 'order-service',
    },
    payload: {
      customerId: 'cust_123',
      customerTier: 'vip',
      country: 'US',
      totalPurchases: 15000,
      orderCount: 75,
    },
  };

  const result = await router.route(event);
  console.log('Route result:', result);
}

// Example 5: Custom Routing Logic
async function customRoutingExample() {
  const router = new MessageRouter();

  // Route based on custom business logic
  router.addRule({
    name: 'Complex business rule',
    priority: 10,
    enabled: true,
    condition: {
      type: 'custom',
      fn: async (event: EventEnvelope) => {
        const payload = event.payload as {
          userId: string;
          purchaseAmount: number;
          accountAge: number;
        };

        // Complex business logic:
        // Route to special handling if user is new (< 30 days) but made large purchase
        const accountAgeInDays = accountAge / (1000 * 60 * 60 * 24);
        return accountAgeInDays < 30 && purchaseAmount > 500;
      },
    },
    target: {
      type: 'handler',
      id: 'special-verification',
    },
  });

  const event: EventEnvelope = {
    metadata: {
      eventId: 'evt_1',
      eventType: 'Purchase',
      timestamp: Date.now(),
      version: 1,
      source: 'order-service',
    },
    payload: {
      userId: 'user_123',
      purchaseAmount: 750,
      accountAge: 10 * 24 * 60 * 60 * 1000, // 10 days in milliseconds
    },
  };

  const result = await router.route(event);
  console.log('Route result:', result);
}

// Example 6: Route Optimization and Statistics
async function routeOptimizationExample() {
  const router = new MessageRouter();

  // Add multiple rules
  router.addRule({
    name: 'Rule 1',
    priority: 1,
    enabled: true,
    condition: { type: 'content', fieldPath: 'type', operator: 'eq', value: 'a' },
    target: { type: 'topic', name: 'topic-a' },
  });

  router.addRule({
    name: 'Rule 2',
    priority: 5,
    enabled: true,
    condition: { type: 'content', fieldPath: 'type', operator: 'eq', value: 'b' },
    target: { type: 'topic', name: 'topic-b' },
  });

  router.addRule({
    name: 'Rule 3',
    priority: 10,
    enabled: true,
    condition: { type: 'content', fieldPath: 'type', operator: 'eq', value: 'c' },
    target: { type: 'topic', name: 'topic-c' },
  });

  // Get routing statistics
  const event: EventEnvelope = {
    metadata: {
      eventId: 'evt_1',
      eventType: 'Test',
      timestamp: Date.now(),
      version: 1,
      source: 'test',
    },
    payload: { type: 'c' },
  };

  await router.route(event);
  await router.route(event);

  const stats = router.getStats();
  console.log('Routing stats:', {
    totalEvaluations: stats.totalEvaluations,
    totalMatches: stats.totalMatches,
    averageExecutionTimeMs: stats.averageExecutionTimeMs,
    cacheHitRate: stats.cacheHitRate,
  });
}

// Example 7: Dynamic Rule Updates
async function dynamicRuleUpdatesExample() {
  const router = new MessageRouter();

  // Initial rule
  const ruleId = router.addRule({
    name: 'Initial rule',
    priority: 10,
    enabled: true,
    condition: {
      type: 'content',
      fieldPath: 'status',
      operator: 'eq',
      value: 'active',
    },
    target: { type: 'topic', name: 'active-users' },
  });

  // Update rule to change priority
  router.updateRule(ruleId, { priority: 20 });

  // Update rule to disable temporarily
  router.updateRule(ruleId, { enabled: false });

  // Re-enable the rule
  router.updateRule(ruleId, { enabled: true });

  // Remove the rule
  router.removeRule(ruleId);

  console.log('Rule management complete');
}

// Example 8: Setting Default Target
async function defaultTargetExample() {
  const router = new MessageRouter();

  // Set default target for unmatched events
  router.setDefaultTarget({
    type: 'topic',
    name: 'unmatched-events',
  });

  // Add specific rules
  router.addRule({
    name: 'Important events',
    priority: 10,
    enabled: true,
    condition: {
      type: 'content',
      fieldPath: 'priority',
      operator: 'eq',
      value: 'high',
    },
    target: { type: 'topic', name: 'high-priority-events' },
  });

  const unmatchedEvent: EventEnvelope = {
    metadata: {
      eventId: 'evt_1',
      eventType: 'UnknownEvent',
      timestamp: Date.now(),
      version: 1,
      source: 'unknown',
    },
    payload: { data: 'test' },
  };

  const result = await router.route(unmatchedEvent);
  console.log('Route result:', result);
  // Output: { matched: false, targets: [{ type: 'topic', name: 'unmatched-events' }] }
}

// Run all examples
async function main() {
  console.log('=== Content-Based Routing ===');
  await contentBasedRoutingExample();

  console.log('\n=== Header-Based Routing ===');
  await headerBasedRoutingExample();

  console.log('\n=== Pattern-Based Routing ===');
  await patternBasedRoutingExample();

  console.log('\n=== Composite Conditions ===');
  await compositeConditionsExample();

  console.log('\n=== Custom Routing ===');
  await customRoutingExample();

  console.log('\n=== Route Optimization ===');
  await routeOptimizationExample();

  console.log('\n=== Dynamic Rule Updates ===');
  await dynamicRuleUpdatesExample();

  console.log('\n=== Default Target ===');
  await defaultTargetExample();
}

export { main as routerExamples };
