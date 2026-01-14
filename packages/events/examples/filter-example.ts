/**
 * Event Filter Examples
 *
 * Examples demonstrating various filtering strategies and patterns
 */

import { EventFilter } from '../src/filter/filter';
import type { EventEnvelope } from '../src/filter/filter';

// Example 1: Basic Field Filtering
async function basicFieldFilteringExample() {
  const filter = new EventFilter();

  // Filter for admin users
  const adminFilterId = filter.addFilter({
    name: 'Admin users',
    expression: {
      type: 'field',
      field: 'role',
      operator: 'eq',
      value: 'admin',
    },
    enabled: true,
  });

  const event: EventEnvelope = {
    metadata: {
      eventId: 'evt_1',
      eventType: 'UserAction',
      timestamp: Date.now(),
      version: 1,
      source: 'user-service',
    },
    payload: {
      userId: 'user_123',
      role: 'admin',
      action: 'delete',
    },
  };

  const result = await filter.evaluate(event, adminFilterId);
  console.log('Admin filter result:', result.matched);
  // Output: true
}

// Example 2: Numeric Comparisons
async function numericComparisonsExample() {
  const filter = new EventFilter();

  // Filter for high-value transactions
  filter.addFilter({
    name: 'High value transactions',
    expression: {
      type: 'field',
      field: 'amount',
      operator: 'gte',
      value: 1000,
    },
    enabled: true,
  });

  // Filter for recent transactions (last hour)
  filter.addFilter({
    name: 'Recent transactions',
    expression: {
      type: 'temporal',
      ageRange: {
        maxAgeMs: 60 * 60 * 1000, // 1 hour
      },
    },
    enabled: true,
  });

  // Filter for transactions within a specific range
  filter.addFilter({
    name: 'Medium value transactions',
    expression: {
      type: 'field',
      field: 'amount',
      operator: 'between',
      value: [100, 1000],
    },
    enabled: true,
  });

  const event: EventEnvelope = {
    metadata: {
      eventId: 'evt_1',
      eventType: 'Transaction',
      timestamp: Date.now(),
      version: 1,
      source: 'payment-service',
    },
    payload: {
      transactionId: 'txn_123',
      amount: 1500,
      currency: 'USD',
    },
  };

  const results = await filter.evaluateAll(event);
  console.log('Filter results:', results.map((r) => r.matched));
  // Output: [true, true, false]
}

// Example 3: String Pattern Matching
async function stringPatternMatchingExample() {
  const filter = new EventFilter();

  // Filter by email domain
  filter.addFilter({
    name: 'Corporate email users',
    expression: {
      type: 'field',
      field: 'email',
      operator: 'contains',
      value: '@company.com',
    },
    enabled: true,
  });

  // Filter by email pattern using regex
  filter.addFilter({
    name: 'Valid email format',
    expression: {
      type: 'regex',
      patterns: [
        {
          field: 'email',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        },
      ],
      matchType: 'all',
    },
    enabled: true,
  });

  // Filter by wildcard pattern
  filter.addFilter({
    name: 'Gmail users',
    expression: {
      type: 'wildcard',
      patterns: [
        {
          field: 'email',
          pattern: '*@gmail.com',
        },
      ],
      matchType: 'all',
    },
    enabled: true,
  });

  const event: EventEnvelope = {
    metadata: {
      eventId: 'evt_1',
      eventType: 'UserCreated',
      timestamp: Date.now(),
      version: 1,
      source: 'user-service',
    },
    payload: {
      userId: 'user_123',
      email: 'john.doe@company.com',
    },
  };

  const results = await filter.evaluateAll(event);
  console.log('Pattern matching results:', results.map((r) => r.matched));
}

// Example 4: Composite Filters (AND/OR/NOT)
async function compositeFiltersExample() {
  const filter = new EventFilter();

  // Filter for adult users from US
  const adultUsFilterId = filter.addFilter({
    name: 'Adult US users',
    expression: {
      type: 'and',
      shortCircuit: true,
      filters: [
        {
          type: 'field',
          field: 'age',
          operator: 'gte',
          value: 18,
        },
        {
          type: 'field',
          field: 'country',
          operator: 'eq',
          value: 'US',
        },
      ],
    },
    enabled: true,
  });

  // Filter for VIP or premium users
  const vipFilterId = filter.addFilter({
    name: 'Important users',
    expression: {
      type: 'or',
      shortCircuit: true,
      filters: [
        {
          type: 'field',
          field: 'tier',
          operator: 'eq',
          value: 'vip',
        },
        {
          type: 'field',
          field: 'tier',
          operator: 'eq',
          value: 'premium',
        },
      ],
    },
    enabled: true,
  });

  // Filter out test users
  const productionFilterId = filter.addFilter({
    name: 'Production users only',
    expression: {
      type: 'not',
      filters: [
        {
          type: 'field',
          field: 'userType',
          operator: 'eq',
          value: 'test',
        },
      ],
    },
    enabled: true,
  });

  const event: EventEnvelope = {
    metadata: {
      eventId: 'evt_1',
      eventType: 'UserAction',
      timestamp: Date.now(),
      version: 1,
      source: 'user-service',
    },
    payload: {
      userId: 'user_123',
      age: 25,
      country: 'US',
      tier: 'premium',
      userType: 'production',
    },
  };

  const results = await Promise.all([
    filter.evaluate(event, adultUsFilterId),
    filter.evaluate(event, vipFilterId),
    filter.evaluate(event, productionFilterId),
  ]);

  console.log('Composite filter results:', results.map((r) => r.matched));
  // Output: [true, true, true]
}

// Example 5: Array and Object Filters
async function arrayObjectFiltersExample() {
  const filter = new EventFilter();

  // Filter for users with specific tag
  filter.addFilter({
    name: 'Premium users',
    expression: {
      type: 'field',
      field: 'tags',
      operator: 'contains',
      value: 'premium',
    },
    enabled: true,
  });

  // Filter for users with minimum number of items
  filter.addFilter({
    name: 'Active users',
    expression: {
      type: 'field',
      field: 'items',
      operator: 'size',
      value: 5,
    },
    enabled: true,
  });

  // Filter for users with specific permissions (every)
  filter.addFilter({
    name: 'Admin users',
    expression: {
      type: 'every',
      field: 'permissions',
      filter: {
        type: 'field',
        field: '',
        operator: 'in',
        value: ['read', 'write', 'delete'],
      },
    },
    enabled: true,
  });

  const event: EventEnvelope = {
    metadata: {
      eventId: 'evt_1',
      eventType: 'UserCheck',
      timestamp: Date.now(),
      version: 1,
      source: 'user-service',
    },
    payload: {
      userId: 'user_123',
      tags: ['premium', 'verified'],
      items: [1, 2, 3, 4, 5],
      permissions: ['read', 'write', 'delete'],
    },
  };

  const results = await filter.evaluateAll(event);
  console.log('Array/Object filter results:', results.map((r) => r.matched));
}

// Example 6: Temporal Filtering
async function temporalFilteringExample() {
  const filter = new EventFilter();

  // Filter for events in time range
  filter.addFilter({
    name: 'Events from last hour',
    expression: {
      type: 'temporal',
      timeRange: {
        from: Date.now() - 60 * 60 * 1000,
        to: Date.now(),
      },
    },
    enabled: true,
  });

  // Filter for recent events (not older than 24 hours)
  filter.addFilter({
    name: 'Recent events',
    expression: {
      type: 'temporal',
      ageRange: {
        maxAgeMs: 24 * 60 * 60 * 1000,
      },
    },
    enabled: true,
  });

  // Filter for events in current time window (5-minute windows)
  filter.addFilter({
    name: 'Current window events',
    expression: {
      type: 'temporal',
      timeWindow: {
        durationMs: 5 * 60 * 1000, // 5 minutes
      },
    },
    enabled: true,
  });

  const recentEvent: EventEnvelope = {
    metadata: {
      eventId: 'evt_1',
      eventType: 'UserAction',
      timestamp: Date.now() - 1000, // 1 second ago
      version: 1,
      source: 'user-service',
    },
    payload: { action: 'click' },
  };

  const results = await filter.evaluateAll(recentEvent);
  console.log('Temporal filter results:', results.map((r) => r.matched));
  // Output: [true, true, true]
}

// Example 7: Schema Validation Filters
async function schemaValidationFiltersExample() {
  const filter = new EventFilter();

  // Filter events with required fields
  filter.addFilter({
    name: 'Valid user events',
    expression: {
      type: 'schema',
      requiredFields: ['userId', 'email', 'username'],
      fieldTypes: {
        userId: 'string',
        email: 'string',
        age: 'number',
        active: 'boolean',
      },
      schemaVersion: 1,
    },
    enabled: true,
  });

  const validEvent: EventEnvelope = {
    metadata: {
      eventId: 'evt_1',
      eventType: 'UserCreated',
      timestamp: Date.now(),
      version: 1,
      source: 'user-service',
    },
    payload: {
      userId: 'user_123',
      email: 'test@example.com',
      username: 'johndoe',
      age: 30,
      active: true,
    },
  };

  const invalidEvent: EventEnvelope = {
    metadata: {
      eventId: 'evt_2',
      eventType: 'UserCreated',
      timestamp: Date.now(),
      version: 1,
      source: 'user-service',
    },
    payload: {
      userId: 'user_456',
      // Missing email and username
    },
  };

  const validResult = await filter.evaluate(validEvent, '0');
  const invalidResult = await filter.evaluate(invalidEvent, '0');

  console.log('Schema validation results:', {
    valid: validResult.matched,
    invalid: invalidResult.matched,
  });
  // Output: { valid: true, invalid: false }
}

// Example 8: Custom Filter Functions
async function customFilterFunctionsExample() {
  const filter = new EventFilter();

  // Custom business logic filter
  filter.addFilter({
    name: 'Risk score filter',
    expression: {
      type: 'custom',
      fn: (event: EventEnvelope) => {
        const payload = event.payload as {
          riskFactors: { type: string; score: number }[];
        };

        // Calculate total risk score
        const totalRisk = payload.riskFactors.reduce(
          (sum, factor) => sum + factor.score,
          0
        );

        return totalRisk > 50;
      },
    },
    enabled: true,
  });

  // Async custom filter
  filter.addFilter({
    name: 'Database validation filter',
    expression: {
      type: 'custom',
      fn: async (event: EventEnvelope) => {
        const payload = event.payload as { userId: string };

        // Simulate database lookup
        await new Promise((resolve) => setTimeout(resolve, 10));

        // In real implementation, would check database
        return payload.userId.startsWith('user_');
      },
    },
    enabled: true,
  });

  const event: EventEnvelope = {
    metadata: {
      eventId: 'evt_1',
      eventType: 'RiskAssessment',
      timestamp: Date.now(),
      version: 1,
      source: 'risk-service',
    },
    payload: {
      userId: 'user_123',
      riskFactors: [
        { type: 'fraud', score: 30 },
        { type: 'suspicious', score: 25 },
      ],
    },
  };

  const results = await filter.evaluateAll(event);
  console.log('Custom filter results:', results.map((r) => r.matched));
}

// Example 9: Filter Chains
async function filterChainsExample() {
  const filter = new EventFilter();

  // Add individual filters
  filter.addFilter({
    name: 'Has userId',
    expression: { type: 'field', field: 'userId', operator: 'exists', value: null },
    enabled: true,
  });

  filter.addFilter({
    name: 'Has email',
    expression: { type: 'field', field: 'email', operator: 'exists', value: null },
    enabled: true,
  });

  filter.addFilter({
    name: 'Is adult',
    expression: { type: 'field', field: 'age', operator: 'gte', value: 18 },
    enabled: true,
  });

  // Create filter chain with AND mode (all must match)
  const andChainId = filter.addChain({
    name: 'Complete adult user',
    mode: 'all',
    filters: filter.listFilters(),
  });

  // Create filter chain with OR mode (any can match)
  const orChainId = filter.addChain({
    name: 'Has required fields',
    mode: 'any',
    filters: filter.listFilters().slice(0, 2), // Just userId and email
  });

  const validEvent: EventEnvelope = {
    metadata: {
      eventId: 'evt_1',
      eventType: 'UserCreated',
      timestamp: Date.now(),
      version: 1,
      source: 'user-service',
    },
    payload: {
      userId: 'user_123',
      email: 'test@example.com',
      age: 25,
    },
  };

  const andResult = await filter.evaluateChain(validEvent, andChainId);
  const orResult = await filter.evaluateChain(validEvent, orChainId);

  console.log('Filter chain results:', {
    andChain: andResult.matched,
    orChain: orResult.matched,
  });
  // Output: { andChain: true, orChain: true }
}

// Example 10: Filter Optimization
async function filterOptimizationExample() {
  const filter = new EventFilter();

  // Add filters with different costs
  filter.addFilter({
    name: 'Simple field check',
    expression: { type: 'field', field: 'role', operator: 'exists', value: null },
    enabled: true,
    priority: 10, // High priority = runs first
  });

  filter.addFilter({
    name: 'Complex regex',
    expression: {
      type: 'regex',
      patterns: [
        {
          field: 'email',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        },
      ],
      matchType: 'all',
    },
    enabled: true,
    priority: 1, // Low priority = runs later
  });

  // Get stats before optimization
  const statsBefore = filter.getStats();
  console.log('Stats before optimization:', statsBefore);

  // Optimize filters
  filter.optimizeFilters();

  // Get optimized filter list
  const optimizedFilters = filter.listFilters();
  console.log('Optimized filter order:', optimizedFilters.map((f) => f.name));
  // Output: ['Simple field check', 'Complex regex']
}

// Run all examples
async function main() {
  console.log('=== Basic Field Filtering ===');
  await basicFieldFilteringExample();

  console.log('\n=== Numeric Comparisons ===');
  await numericComparisonsExample();

  console.log('\n=== String Pattern Matching ===');
  await stringPatternMatchingExample();

  console.log('\n=== Composite Filters ===');
  await compositeFiltersExample();

  console.log('\n=== Array/Object Filters ===');
  await arrayObjectFiltersExample();

  console.log('\n=== Temporal Filtering ===');
  await temporalFilteringExample();

  console.log('\n=== Schema Validation Filters ===');
  await schemaValidationFiltersExample();

  console.log('\n=== Custom Filter Functions ===');
  await customFilterFunctionsExample();

  console.log('\n=== Filter Chains ===');
  await filterChainsExample();

  console.log('\n=== Filter Optimization ===');
  await filterOptimizationExample();
}

export { main as filterExamples };
