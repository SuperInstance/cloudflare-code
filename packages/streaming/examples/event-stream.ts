/**
 * Event Stream Example
 * Demonstrates real-time event streaming with SSE and WebSocket support
 */

import { EventStream } from '../src/stream/event-stream.js';
import { formatSSE } from '../src/stream/event-stream.js';
import type { EventFilter, StreamEvent } from '../src/types/index.js';

// Create an event stream
const stream = new EventStream({
  batchSize: 100,
  batchTimeout: 100,
  compression: false,
  encryption: false,
  retention: {
    duration: 24 * 60 * 60 * 1000, // 24 hours
    maxSize: 1024 * 1024 * 1024, // 1GB
    maxEvents: 1000000,
  },
});

async function main() {
  console.log('=== Event Stream Example ===\n');

  // ========================================================================
  // Publishing Events
  // ========================================================================

  console.log('1. Publishing events...');

  const event1 = await stream.publish('user-login', {
    userId: 'user-123',
    timestamp: Date.now(),
    metadata: {
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    },
  });

  console.log(`   Published event: ${event1.id} (type: ${event1.type})`);

  const event2 = await stream.publish('user-action', {
    userId: 'user-123',
    action: 'click',
    element: 'button',
  });

  console.log(`   Published event: ${event2.id} (type: ${event2.type})`);

  // Publish batch
  const batchEvents = await stream.publishBatch([
    { type: 'page-view', data: { page: '/home' } },
    { type: 'page-view', data: { page: '/about' } },
    { type: 'page-view', data: { page: '/contact' } },
  ]);

  console.log(`   Published batch: ${batchEvents.length} events`);

  // ========================================================================
  // Subscribing to Events
  // ========================================================================

  console.log('\n2. Creating subscriptions...');

  // SSE subscription
  const sseConnection = stream.subscribeSSE('client-1', [], 3000);
  console.log(`   SSE connection: ${sseConnection.id} for client ${sseConnection.clientId}`);

  // WebSocket subscription with filters
  const userActionFilter: EventFilter = {
    types: ['user-action', 'user-login'],
  };

  const wsConnection = stream.subscribeWebSocket('client-2', [userActionFilter], 'chat');
  console.log(`   WebSocket connection: ${wsConnection.id} for client ${wsConnection.clientId}`);

  console.log(`   Total connections: ${stream.getConnectionCount()}`);

  // ========================================================================
  // Querying Events
  // ========================================================================

  console.log('\n3. Querying events...');

  // Get event by ID
  const retrievedEvent = stream.getEvent(event1.id);
  console.log(`   Retrieved event: ${retrievedEvent?.id}`);

  // Get all events
  const allEvents = stream.getEvents({});
  console.log(`   Total events: ${allEvents.length}`);

  // Filter by type
  const pageViews = stream.getEvents({ types: ['page-view'] });
  console.log(`   Page views: ${pageViews.length}`);

  // Filter by custom predicate
  const recentEvents = stream.getEvents({
    custom: (e) => e.timestamp > Date.now() - 60000,
  });
  console.log(`   Recent events: ${recentEvents.length}`);

  // Get recent events
  const recent = stream.getRecentEvents(5);
  console.log(`   Last 5 events: ${recent.length}`);

  // ========================================================================
  // Event Transformation
  // ========================================================================

  console.log('\n4. Transforming events...');

  // Filter events
  const userEventsStream = stream.filter((e) => e.type.startsWith('user-'));
  console.log(`   Created filtered stream for user events`);

  // Transform events
  const enrichedStream = stream.transform((event) => ({
    ...event,
    data: {
      ...event.data,
      enriched: true,
      processedAt: Date.now(),
    },
  }));
  console.log(`   Created enriched stream`);

  // Batch events
  const batchedStream = stream.batch(10, 5000);
  console.log(`   Created batched stream (10 events or 5 seconds)`);

  // ========================================================================
  // Statistics
  // ========================================================================

  console.log('\n5. Stream statistics...');

  const stats = stream.getStats();
  console.log(`   Event count: ${stats.eventCount}`);
  console.log(`   Byte size: ${stats.byteSize}`);
  console.log(`   Average rate: ${stats.averageEventRate.toFixed(2)} events/sec`);
  console.log(`   First event: ${new Date(stats.firstEventTime).toISOString()}`);
  console.log(`   Last event: ${new Date(stats.lastEventTime).toISOString()}`);

  // ========================================================================
  // SSE Formatting
  // ========================================================================

  console.log('\n6. SSE formatting...');

  const sseEvent = formatSSE({
    id: event1.id,
    event: event1.type,
    data: JSON.stringify(event1.data),
    retry: 3000,
  });

  console.log('   SSE formatted event:');
  console.log('   ' + sseEvent.replace(/\n/g, '\n   '));

  // ========================================================================
  // Cleanup
  // ========================================================================

  console.log('\n7. Cleanup...');

  // Unsubscribe specific connection
  stream.unsubscribe(sseConnection.id);
  console.log(`   Unsubscribed: ${sseConnection.id}`);

  // Unsubscribe all connections for a client
  stream.unsubscribeClient('client-2');
  console.log(`   Unsubscribed all for client-2`);

  // Clear stream
  stream.clear();
  console.log('   Cleared stream');

  console.log('\n=== Example Complete ===');
}

// Run the example
main().catch(console.error);
