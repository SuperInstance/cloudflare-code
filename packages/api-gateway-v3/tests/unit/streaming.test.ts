/**
 * Streaming Gateway Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SSEGateway,
  WebSocketGateway,
  StreamRouter,
  StreamProcessor,
  StreamManager,
} from '../../src/streaming/gateway.js';
import type { StreamConfig, SSEMessage, WebSocketMessage } from '../../src/types/index.js';

describe('SSEGateway', () => {
  let gateway: SSEGateway;

  beforeEach(() => {
    gateway = new SSEGateway({
      maxConnections: 100,
      bufferSize: 1024,
      heartbeatInterval: 1000,
      timeout: 5000,
    });
  });

  describe('connect', () => {
    it('should create SSE connection', async () => {
      const writable = new WritableStream({
        write(chunk) {
          // Mock write
        },
      });

      const connectionId = await gateway.connect('client-1', writable);

      expect(connectionId).toBeDefined();
      expect(connectionId).toMatch(/^sse_/);

      const connection = gateway.getConnection(connectionId);
      expect(connection).toBeDefined();
      expect(connection?.clientId).toBe('client-1');
    });

    it('should enforce max connections limit', async () => {
      const tinyGateway = new SSEGateway({ maxConnections: 2 });

      const writable = new WritableStream({
        write(chunk) {},
      });

      await tinyGateway.connect('client-1', writable);
      await tinyGateway.connect('client-2', writable);

      await expect(tinyGateway.connect('client-3', writable)).rejects.toThrow('Maximum connections exceeded');
    });
  });

  describe('subscribe', () => {
    it('should subscribe client to channel', async () => {
      const writable = new WritableStream({ write(chunk) {} });
      const connectionId = await gateway.connect('client-1', writable);

      await gateway.subscribe(connectionId, 'channel-1');

      const connection = gateway.getConnection(connectionId);
      expect(connection?.channels.has('channel-1')).toBe(true);
    });

    it('should emit subscribe event', async () => {
      const writable = new WritableStream({ write(chunk) {} });
      const connectionId = await gateway.connect('client-1', writable);

      const subscribeSpy = vi.fn();
      gateway.on('subscribe', subscribeSpy);

      await gateway.subscribe(connectionId, 'channel-1');

      expect(subscribeSpy).toHaveBeenCalledWith({
        connectionId,
        channel: 'channel-1',
      });
    });
  });

  describe('broadcast', () => {
    it('should broadcast message to channel subscribers', async () => {
      const messages: SSEMessage[] = [];
      const writable = new WritableStream({
        write(chunk) {
          const decoder = new TextDecoder();
          messages.push({
            data: decoder.decode(chunk),
          });
        },
      });

      const connectionId = await gateway.connect('client-1', writable);
      await gateway.subscribe(connectionId, 'channel-1');

      const message: SSEMessage = {
        event: 'update',
        data: 'test message',
      };

      const sent = await gateway.broadcast('channel-1', message);

      expect(sent).toBe(1);
    });

    it('should return 0 for non-existent channel', async () => {
      const message: SSEMessage = {
        data: 'test',
      };

      const sent = await gateway.broadcast('non-existent', message);

      expect(sent).toBe(0);
    });
  });

  describe('send', () => {
    it('should send message to specific connection', async () => {
      const messages: string[] = [];
      const writable = new WritableStream({
        write(chunk) {
          const decoder = new TextDecoder();
          messages.push(decoder.decode(chunk));
        },
      });

      const connectionId = await gateway.connect('client-1', writable);

      const message: SSEMessage = {
        id: 'msg-1',
        event: 'test',
        data: 'hello',
        retry: 1000,
      };

      await gateway.send(connectionId, message);

      expect(messages.length).toBeGreaterThan(0);
    });

    it('should throw for non-existent connection', async () => {
      const message: SSEMessage = {
        data: 'test',
      };

      await expect(gateway.send('non-existent', message)).rejects.toThrow('Connection not found');
    });
  });

  describe('disconnect', () => {
    it('should disconnect client and cleanup', async () => {
      const writable = new WritableStream({ write(chunk) {} });
      const connectionId = await gateway.connect('client-1', writable);
      await gateway.subscribe(connectionId, 'channel-1');

      await gateway.disconnect(connectionId);

      const connection = gateway.getConnection(connectionId);
      expect(connection).toBeUndefined();
    });

    it('should emit disconnect event', async () => {
      const writable = new WritableStream({ write(chunk) {} });
      const connectionId = await gateway.connect('client-1', writable);

      const disconnectSpy = vi.fn();
      gateway.on('disconnect', disconnectSpy);

      await gateway.disconnect(connectionId, 1000, 'Test disconnect');

      expect(disconnectSpy).toHaveBeenCalledWith({
        connectionId,
        code: 1000,
        reason: 'Test disconnect',
      });
    });
  });

  describe('metrics', () => {
    it('should track connection metrics', async () => {
      const metricsBefore = gateway.getMetrics();

      const writable = new WritableStream({ write(chunk) {} });
      await gateway.connect('client-1', writable);

      const metricsAfter = gateway.getMetrics();

      expect(metricsAfter.totalConnections).toBe(metricsBefore.totalConnections + 1);
      expect(metricsAfter.activeConnections).toBe(metricsBefore.activeConnections + 1);
    });
  });

  describe('cleanup', () => {
    it('should cleanup idle connections', async () => {
      const writable = new WritableStream({ write(chunk) {} });
      await gateway.connect('client-1', writable);

      // Set last activity to past
      const connection = Array.from(gateway['connections'].values())[0];
      connection.lastActivity = Date.now() - 10000;

      const cleaned = await gateway.cleanupIdle(5000);

      expect(cleaned).toBe(1);
    });
  });

  describe('shutdown', () => {
    it('should close all connections on shutdown', async () => {
      const writable1 = new WritableStream({ write(chunk) {} });
      const writable2 = new WritableStream({ write(chunk) {} });

      await gateway.connect('client-1', writable1);
      await gateway.connect('client-2', writable2);

      await gateway.shutdown();

      const metrics = gateway.getMetrics();
      expect(metrics.activeConnections).toBe(0);
    });
  });
});

describe('WebSocketGateway', () => {
  let gateway: WebSocketGateway;

  beforeEach(() => {
    gateway = new WebSocketGateway({
      maxConnections: 100,
      bufferSize: 1024,
      heartbeatInterval: 1000,
      timeout: 5000,
    });
  });

  describe('accept', () => {
    it('should accept WebSocket connection', async () => {
      const mockSocket = {
        send: vi.fn(),
        close: vi.fn(),
        onmessage: null,
        onclose: null,
        onerror: null,
      } as any;

      const connectionId = await gateway.accept(mockSocket, 'client-1');

      expect(connectionId).toBeDefined();
      expect(connectionId).toMatch(/^ws_/);
    });

    it('should send subscription confirmation', async () => {
      const mockSocket = {
        send: vi.fn(),
        close: vi.fn(),
        onmessage: null,
        onclose: null,
        onerror: null,
      } as any;

      const connectionId = await gateway.accept(mockSocket, 'client-1');
      await gateway.subscribe(connectionId, 'channel-1');

      expect(mockSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('subscribed')
      );
    });
  });

  describe('broadcast', () => {
    it('should broadcast to channel subscribers', async () => {
      const mockSocket = {
        send: vi.fn(),
        close: vi.fn(),
        onmessage: null,
        onclose: null,
        onerror: null,
      } as any;

      const connectionId = await gateway.accept(mockSocket, 'client-1');
      await gateway.subscribe(connectionId, 'channel-1');

      const sent = await gateway.broadcast('channel-1', { test: 'data' });

      expect(sent).toBe(1);
      expect(mockSocket.send).toHaveBeenCalled();
    });
  });

  describe('metrics', () => {
    it('should track connection metrics', async () => {
      const metricsBefore = gateway.getMetrics();

      const mockSocket = {
        send: vi.fn(),
        close: vi.fn(),
        onmessage: null,
        onclose: null,
        onerror: null,
      } as any;

      await gateway.accept(mockSocket, 'client-1');

      const metricsAfter = gateway.getMetrics();

      expect(metricsAfter.totalConnections).toBe(metricsBefore.totalConnections + 1);
    });
  });
});

describe('StreamRouter', () => {
  it('should route streams to matching patterns', async () => {
    const router = new StreamRouter({
      routes: [
        {
          pattern: '/api/v1',
          target: 'https://api-v1.example.com',
        },
        {
          pattern: '/api/v2',
          target: 'https://api-v2.example.com',
        },
      ],
    });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('test data'));
        controller.close();
      },
    });

    const routed = await router.route(stream, '/api/v1');

    expect(routed).toBeInstanceOf(ReadableStream);
  });

  it('should apply transforms to routed streams', async () => {
    const router = new StreamRouter({
      routes: [
        {
          pattern: '/api',
          target: 'https://api.example.com',
          transform: {
            type: 'json',
            encoder: (data) => JSON.stringify(data),
          },
        },
      ],
    });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('test'));
        controller.close();
      },
    });

    const routed = await router.route(stream, '/api');

    expect(routed).toBeInstanceOf(ReadableStream);
  });
});

describe('StreamProcessor', () => {
  it('should process stream chunks', async () => {
    const processor = new StreamProcessor(1024, 0.8);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('chunk1'));
        controller.enqueue(new TextEncoder().encode('chunk2'));
        controller.close();
      },
    });

    const results = await processor.process(stream, async (chunk) => {
      const decoder = new TextDecoder();
      return decoder.decode(chunk);
    });

    expect(results.length).toBeGreaterThan(0);
  });

  it('should split stream into chunks', async () => {
    const processor = new StreamProcessor();

    const data = new TextEncoder().encode('0123456789');
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });

    const chunks: Uint8Array[] = [];
    for await (const chunk of processor.chunkStream(stream, 3)) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe('StreamManager', () => {
  it('should provide access to all streaming components', () => {
    const manager = new StreamManager();

    expect(manager.getSSEGateway()).toBeInstanceOf(SSEGateway);
    expect(manager.getWebSocketGateway()).toBeInstanceOf(WebSocketGateway);
    expect(manager.getRouter()).toBeInstanceOf(StreamRouter);
    expect(manager.getProcessor()).toBeInstanceOf(StreamProcessor);
  });

  it('should aggregate metrics from all components', async () => {
    const manager = new StreamManager();

    const metrics = manager.getMetrics();

    expect(metrics.sse).toBeDefined();
    expect(metrics.websocket).toBeDefined();
  });
});
