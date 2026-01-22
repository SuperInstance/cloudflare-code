/**
 * Integration tests for Streaming Infrastructure
 * Tests end-to-end workflows across multiple components
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EventStream,
  MessageQueue,
  StreamTransformer,
  StreamAnalytics,
  PubSubBroker,
  EventStore,
  BackpressureController,
} from '../../src/index.js';
import type { StreamEvent, BackpressureStrategy } from '../../src/types/index.js';

describe('Integration Tests', () => {
  describe('Event Stream to Message Queue', () => {
    it('should bridge events to queue', async () => {
      const stream = new EventStream();
      const queue = new MessageQueue();

      // Subscribe to stream events and enqueue them
      stream.on('event', async (data: unknown) => {
        const event = data as StreamEvent;
        await queue.enqueue({
          type: event.type,
          data: event.data,
          timestamp: event.timestamp,
        });
      });

      // Publish event
      const publishedEvent = await stream.publish('test-event', { value: 123 });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Dequeue from queue
      const message = await queue.dequeue();

      expect(message).toBeDefined();
      expect(message?.payload.type).toBe('test-event');
      expect(message?.payload.data).toEqual({ value: 123 });
    });
  });

  describe('Stream Processing with Analytics', () => {
    it('should process events and track metrics', async () => {
      const stream = new EventStream();
      const analytics = new StreamAnalytics();

      // Create transformer
      const transformer = new StreamTransformer<number, number>();

      transformer.pipe({
        process: async (event) => event.data * 2,
      });

      // Publish events
      for (let i = 0; i < 10; i++) {
        const event = await stream.publish('number', i);
        analytics.recordEvent(event, Math.random() * 100);
      }

      // Get metrics
      const metrics = analytics.getMetrics();

      expect(metrics.eventCount).toBe(10);
      expect(metrics.latency.avg).toBeGreaterThan(0);
    });
  });

  describe('Pub/Sub with Event Sourcing', () => {
    it('should publish events and store them', async () => {
      const broker = new PubSubBroker();
      const eventStore = new EventStore();

      // Create topic
      broker.createTopic('events', { partitions: 1 });

      // Create stream for event sourcing
      eventStore.createStream('stream-1', 'test');

      // Publish to topic
      const eventId = await broker.publish('events', 'test-event', { data: 'test' });

      expect(eventId).toBeDefined();

      // Store in event store
      await eventStore.appendEvent('stream-1', {
        id: eventId,
        type: 'test-event',
        data: { data: 'test' },
        timestamp: Date.now(),
      });

      // Read from event store
      const events = eventStore.readStream('stream-1');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('test-event');
    });
  });

  describe('Backpressure with Message Queue', () => {
    it('should handle backpressure when queue is full', async () => {
      const queue = new MessageQueue({ maxSize: 5 });

      const strategy: BackpressureStrategy = {
        type: 'reject',
        bufferSize: 5,
      };

      const controller = new BackpressureController(strategy);

      // Fill queue
      for (let i = 0; i < 5; i++) {
        await queue.enqueue({ value: i });
      }

      // Try to enqueue with backpressure
      let acceptedCount = 0;
      let rejectedCount = 0;

      for (let i = 5; i < 10; i++) {
        const result = await controller.process(
          { value: i },
          async (item) => {
            try {
              await queue.enqueue(item);
              return true;
            } catch {
              return false;
            }
          }
        );

        if (result.status === 'accepted') {
          acceptedCount++;
        } else {
          rejectedCount++;
        }
      }

      // Should have rejected some items
      expect(rejectedCount).toBeGreaterThan(0);
    });
  });

  describe('Multi-Stage Pipeline', () => {
    it('should process events through multiple stages', async () => {
      const inputStream = new EventStream();
      const transformer = new StreamTransformer<number, number>();
      const outputStream = new EventStream();
      const analytics = new StreamAnalytics();

      // Set up transformer pipeline
      transformer.pipe({
        process: async (event) => event.data * 2,
      });

      transformer.pipe({
        process: async (value) => value + 10,
      });

      // Publish input events
      const inputEvents: StreamEvent<number>[] = [];
      for (let i = 0; i < 5; i++) {
        const event = await inputStream.publish('number', i);
        inputEvents.push(event);
      }

      // Transform
      const transformed = await transformer.process(inputEvents);

      // Publish to output stream
      for (const transformedEvent of transformed) {
        const outputEvent = await outputStream.publish('transformed', transformedEvent.data);
        analytics.recordEvent(outputEvent, Math.random() * 50);
      }

      // Verify results
      expect(transformed).toHaveLength(5);
      expect(transformed[0].data).toBe(10); // (0 * 2) + 10
      expect(transformed[4].data).toBe(18); // (4 * 2) + 10

      // Check analytics
      const metrics = analytics.getMetrics();
      expect(metrics.eventCount).toBe(5);
    });
  });

  describe('Event Replay with Processing', () => {
    it('should replay events and reprocess them', async () => {
      const eventStore = new EventStore();
      const processedEvents: string[] = [];

      // Create stream and append events
      eventStore.createStream('replay-test', 'test');

      await eventStore.appendEvent('replay-test', {
        id: '1',
        type: 'event-1',
        data: { value: 1 },
        timestamp: Date.now(),
      });

      await eventStore.appendEvent('replay-test', {
        id: '2',
        type: 'event-2',
        data: { value: 2 },
        timestamp: Date.now(),
      });

      // Replay events
      await eventStore.replayStream('replay-test', async (event) => {
        processedEvents.push(event.type);
      });

      expect(processedEvents).toEqual(['event-1', 'event-2']);
    });
  });

  describe('Pub/Sub Fan-out', () => {
    it('should fan-out messages to multiple subscribers', async () => {
      const broker = new PubSubBroker();

      // Create topic
      broker.createTopic('fanout', { partitions: 1 });

      // Create multiple subscribers
      broker.registerSubscriber({
        id: 'sub-1',
        endpoint: 'http://localhost:8001',
        protocol: 'http',
      });

      broker.registerSubscriber({
        id: 'sub-2',
        endpoint: 'http://localhost:8002',
        protocol: 'http',
      });

      broker.registerSubscriber({
        id: 'sub-3',
        endpoint: 'http://localhost:8003',
        protocol: 'http',
      });

      // Create subscriptions
      broker.createSubscription('fanout', 'sub-1');
      broker.createSubscription('fanout', 'sub-2');
      broker.createSubscription('fanout', 'sub-3');

      // Publish message
      await broker.publish('fanout', 'test', { data: 'test' });

      // Get topic stats
      const stats = broker.getTopicStats('fanout');

      expect(stats).toBeDefined();
      expect(stats?.subscriptionCount).toBe(3);
    });
  });

  describe('CQRS Pattern', () => {
    it('should implement CQRS with event sourcing', async () => {
      const { CQRS, createCQRS } = await import('../../src/sourcing/event-store.js');

      const cqrs = createCQRS();

      // Register command handler
      cqrs.registerCommand('create-user', async (payload, eventStore) => {
        const events = await eventStore.appendToStream(
          'user-123',
          [
            {
              id: '1',
              type: 'user-created',
              data: payload,
              timestamp: Date.now(),
            },
          ]
        );

        return {
          events: events.events ?? [],
          state: payload,
        };
      });

      // Register query handler
      cqrs.registerQuery('get-user', async (params, eventStore) => {
        const events = eventStore.readStream(params.streamId as string);
        return events[events.length - 1]?.data;
      });

      // Execute command
      const commandResult = await cqrs.executeCommand({
        commandId: 'cmd-1',
        commandType: 'create-user',
        payload: { name: 'John Doe', email: 'john@example.com' },
        timestamp: Date.now(),
      });

      expect(commandResult.success).toBe(true);

      // Execute query
      const queryResult = await cqrs.executeQuery({
        queryId: 'query-1',
        queryType: 'get-user',
        parameters: { streamId: 'user-123' },
        timestamp: Date.now(),
      });

      expect(queryResult.success).toBe(true);
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should open circuit after failures', async () => {
      const { FlowController, createFlowController } = await import('../../src/backpressure/controller.js');

      const controller = createFlowController({
        maxConcurrent: 10,
        timeout: 1000,
        circuitBreaker: {
          failureThreshold: 3,
          timeout: 5000,
          successThreshold: 2,
          halfOpenMaxCalls: 1,
        },
      });

      const failingRequest = async () => {
        throw new Error('Service unavailable');
      };

      // Execute failing requests
      for (let i = 0; i < 3; i++) {
        try {
          await controller.execute(failingRequest, { retries: false });
        } catch {
          // Expected to fail
        }
      }

      // Circuit should be open
      const state = controller.getCircuitBreakerState();
      expect(state?.state).toBe('open');

      // Next request should fail immediately
      let rejected = false;
      try {
        await controller.execute(failingRequest, { retries: false });
      } catch (error) {
        rejected = true;
      }

      expect(rejected).toBe(true);
    });
  });
});
