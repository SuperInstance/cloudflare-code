/**
 * Stream Processing Example
 * Demonstrates stream transformation, aggregation, windowing, and CEP
 */

import {
  StreamTransformer,
  WindowOperator,
  StreamAggregator,
  Aggregations,
  StreamJoiner,
  ComplexEventProcessor,
  Patterns,
} from '../src/processing/processor.js';
import type { StreamEvent, WindowOptions } from '../src/types/index.js';

async function main() {
  console.log('=== Stream Processing Example ===\n');

  // ========================================================================
  // Stream Transformation
  // ========================================================================

  console.log('1. Stream transformation...');

  const transformer = new StreamTransformer<number, number>();

  // Add processing stages
  transformer.pipe({
    process: async (event) => {
      console.log(`   Stage 1: Multiplying ${event.data} by 2`);
      return event.data * 2;
    },
  });

  transformer.pipe({
    process: async (value) => {
      console.log(`   Stage 2: Adding 10 to ${value}`);
      return value + 10;
    },
  });

  transformer.pipe({
    process: async (value) => {
      console.log(`   Stage 3: Dividing ${value} by 4`);
      return value / 4;
    },
  });

  // Process events
  const events: StreamEvent<number>[] = [
    {
      id: '1',
      type: 'number',
      data: 20,
      timestamp: Date.now(),
    },
  ];

  const results = await transformer.process(events);
  console.log(`   Final result: ${results[0].data}\n`);

  // ========================================================================
  // Stream Aggregation
  // ========================================================================

  console.log('2. Stream aggregation...');

  // Count aggregation
  const countAgg = new StreamAggregator(Aggregations.count());

  for (let i = 0; i < 5; i++) {
    const event: StreamEvent = {
      id: `${i}`,
      type: 'test',
      data: null,
      timestamp: Date.now(),
    };
    countAgg.add(event);
  }

  console.log(`   Count: ${countAgg.getCurrent()}`);

  // Sum aggregation
  const sumAgg = new StreamAggregator(
    Aggregations.sum((e) => (e.data as { value: number }).value)
  );

  const values = [10, 20, 30, 40, 50];
  for (const value of values) {
    sumAgg.add({
      id: `${value}`,
      type: 'value',
      data: { value },
      timestamp: Date.now(),
    });
  }

  console.log(`   Sum: ${sumAgg.getCurrent()}`);

  // Average aggregation
  const avgAgg = new StreamAggregator(
    Aggregations.average((e) => (e.data as { value: number }).value)
  );

  for (const value of values) {
    avgAgg.add({
      id: `${value}`,
      type: 'value',
      data: { value },
      timestamp: Date.now(),
    });
  }

  const avgResult = avgAgg.getCurrent() as { sum: number; count: number };
  console.log(`   Average: ${(avgResult.sum / avgResult.count).toFixed(2)}`);

  // Min/Max aggregation
  const minAgg = new StreamAggregator(
    Aggregations.min((e) => (e.data as { value: number }).value)
  );

  const maxAgg = new StreamAggregator(
    Aggregations.max((e) => (e.data as { value: number }).value)
  );

  for (const value of values) {
    const event = {
      id: `${value}`,
      type: 'value',
      data: { value },
      timestamp: Date.now(),
    };
    minAgg.add(event);
    maxAgg.add(event);
  }

  console.log(`   Min: ${minAgg.getCurrent()}`);
  console.log(`   Max: ${maxAgg.getCurrent()}`);

  // Distinct count aggregation
  const distinctAgg = new StreamAggregator(
    Aggregations.distinctCount((e) => (e.data as { category: string }).category)
  );

  const categories = ['A', 'B', 'A', 'C', 'B', 'A'];
  for (const category of categories) {
    distinctAgg.add({
      id: `${category}`,
      type: 'category',
      data: { category },
      timestamp: Date.now(),
    });
  }

  console.log(`   Distinct count: ${distinctAgg.getCurrent().size}\n`);

  // ========================================================================
  // Window Operations
  // ========================================================================

  console.log('3. Window operations...');

  // Tumbling window
  const tumblingOptions: WindowOptions = {
    size: 1000,
    type: 'tumbling',
  };

  const tumblingWindow = new WindowOperator(tumblingOptions);

  console.log('   Processing events through tumbling window...');
  for (let i = 0; i < 5; i++) {
    const event: StreamEvent = {
      id: `${i}`,
      type: 'test',
      data: { value: i },
      timestamp: Date.now(),
    };

    const windowed = tumblingWindow.process(event);
    if (windowed.length > 0) {
      console.log(`     Window emitted: ${windowed[0].count} events`);
    }
  }

  // Sliding window
  const slidingOptions: WindowOptions = {
    size: 1000,
    slide: 500,
    type: 'sliding',
  };

  const slidingWindow = new WindowOperator(slidingOptions);

  console.log('   Processing events through sliding window...');
  for (let i = 0; i < 5; i++) {
    const event: StreamEvent = {
      id: `${i}`,
      type: 'test',
      data: { value: i },
      timestamp: Date.now(),
    };

    const windowed = slidingWindow.process(event);
    if (windowed.length > 0) {
      console.log(`     Window emitted: ${windowed[0].count} events`);
    }
  }

  // Session window
  const sessionOptions: WindowOptions = {
    size: 1000,
    type: 'session',
    sessionTimeout: 2000,
  };

  const sessionWindow = new WindowOperator(sessionOptions);

  console.log('   Processing events through session window...\n');

  // ========================================================================
  // Stream Joining
  // ========================================================================

  console.log('4. Stream joining...');

  const joinOptions = {
    type: 'inner' as const,
    window: {
      size: 1000,
      type: 'tumbling' as const,
    },
    keySelector: (e: StreamEvent) => (e.data as { key: string }).key,
  };

  const joiner = new StreamJoiner(joinOptions);

  // Join left stream
  const leftEvent: StreamEvent = {
    id: '1',
    type: 'left',
    data: { key: 'user-123', action: 'click' },
    timestamp: Date.now(),
  };

  const leftResults = joiner.joinLeft(leftEvent);
  console.log(`   Left event processed: ${leftEvent.type}`);

  // Join right stream
  const rightEvent: StreamEvent = {
    id: '2',
    type: 'right',
    data: { key: 'user-123', page: '/home' },
    timestamp: Date.now(),
  };

  const rightResults = joiner.joinRight(rightEvent);
  console.log(`   Right event processed: ${rightEvent.type}`);

  if (rightResults.length > 0) {
    console.log(`   Join result: matched ${rightResults.length} pairs`);
  }

  // ========================================================================
  // Complex Event Processing (CEP)
  // ========================================================================

  console.log('\n5. Complex event processing...');

  const cep = new ComplexEventProcessor();

  // Register sequence pattern
  const sequencePattern = Patterns.sequence(
    (e) => e.type === 'login',
    (e) => e.type === 'view-product',
    (e) => e.type === 'add-to-cart',
    (e) => e.type === 'checkout'
  );

  cep.registerPattern(sequencePattern);
  console.log('   Registered pattern: login -> view-product -> add-to-cart -> checkout');

  // Process events matching the pattern
  const eventsToProcess = [
    { type: 'login', data: { userId: '123' } },
    { type: 'view-product', data: { productId: 'P1' } },
    { type: 'add-to-cart', data: { productId: 'P1' } },
    { type: 'checkout', data: { cartValue: 100 } },
  ];

  console.log('   Processing events...');
  for (const eventData of eventsToProcess) {
    const event: StreamEvent = {
      id: Math.random().toString(36),
      type: eventData.type,
      data: eventData.data,
      timestamp: Date.now(),
    };

    const matches = await cep.processEvent(event);
    if (matches.length > 0) {
      console.log(`   ✓ Pattern matched! Confidence: ${matches[0].confidence.toFixed(2)}`);
    }
  }

  // Register frequency pattern
  const frequencyPattern: any = {
    id: 'high-frequency',
    type: 'frequency',
    eventType: 'error',
    frequency: 3,
    windowMs: 5000,
  };

  cep.registerPattern(frequencyPattern);
  console.log('\n   Registered pattern: 3 errors in 5 seconds');

  console.log('\n=== Example Complete ===');
}

// Helper function
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the example
main().catch(console.error);
