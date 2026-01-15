/**
 * WebSocket Manager Tests
 */

import { WebSocketManager } from './manager';
import { WebSocketEvent } from '../types';

// Mock WebSocket class
class MockWebSocket {
  public readyState = 1;
  public remoteAddress = '127.0.0.1';
  public onmessage: ((data: any) => void) | null = null;
  public onclose: ((event: any) => void) | null = null;
  public onerror: ((event: any) => void) | null = null;
  public receivedMessages: any[] = [];

  public send(data: any): void {
    this.receivedMessages.push(data);
  }

  public close(code?: number, reason?: string): void {
    this.readyState = 3;
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }

  public terminate(): void {
    this.readyState = 3;
  }
}

describe('WebSocketManager', () => {
  let manager: WebSocketManager;
  let mockSocket: MockWebSocket;
  let mockLogger: any;

  beforeEach(() => {
    mockSocket = new MockWebSocket();
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      log: jest.fn()
    };

    manager = new WebSocketManager({
      maxConnections: 100,
      heartbeatInterval: 1000,
      heartbeatTimeout: 2000,
      maxMessageSize: 1024,
      maxQueueSize: 100,
      compression: false,
      enableBackpressure: false,
      enableLogging: true,
      enableMetrics: true,
      rateLimiting: {
        enabled: false,
        windowMs: 60000,
        maxConnections: 1000
      }
    }, mockLogger);
  });

  afterEach(async () => {
    await manager.dispose();
  });

  describe('Connection Management', () => {
    test('should accept new connection', async () => {
      const connectionId = await manager.acceptConnection(
        mockSocket,
        'test-namespace',
        'user-123',
        { userAgent: 'test' }
      );

      expect(connectionId).toBeDefined();
      expect(typeof connectionId).toBe('string');
      expect(manager.getStats().connections.active).toBe(1);
    });

    test('should reject connection when limit exceeded', async () => {
      // Set very low limit for testing
      const limitedManager = new WebSocketManager({
        maxConnections: 0,
        heartbeatInterval: 1000,
        heartbeatTimeout: 2000,
        maxMessageSize: 1024,
        maxQueueSize: 100,
        compression: false,
        enableBackpressure: false,
        enableLogging: false,
        enableMetrics: true,
        rateLimiting: { enabled: false, windowMs: 60000, maxConnections: 1000 }
      });

      await expect(limitedManager.acceptConnection(
        mockSocket,
        'test-namespace'
      )).rejects.toThrow('Connection limit exceeded');
    });

    test('should handle connection lifecycle', async () => {
      const connectionId = await manager.acceptConnection(
        mockSocket,
        'test-namespace'
      );

      // Verify connection exists
      const connection = manager.getConnection(connectionId);
      expect(connection).toBeDefined();
      expect(connection?.id).toBe(connectionId);
      expect(connection?.state).toBe('connected');

      // Test connection by namespace
      const namespaceConnections = manager.getConnectionsByNamespace('test-namespace');
      expect(namespaceConnections).toHaveLength(1);
      expect(namespaceConnections[0].id).toBe(connectionId);

      // Close connection
      await manager.closeConnection(connectionId, {
        code: 1000,
        reason: 'test close',
        wasClean: true
      });

      // Verify connection is removed
      expect(manager.getConnection(connectionId)).toBeUndefined();
      expect(manager.getStats().connections.active).toBe(0);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await manager.acceptConnection(mockSocket, 'test-namespace');
    });

    test('should handle ping message', async () => {
      const pingMessage = {
        id: 'msg-123',
        type: 'ping',
        payload: {},
        timestamp: Date.now(),
        source: { id: 'conn-123', namespace: 'test-namespace' }
      };

      // Trigger message handling
      mockSocket.onmessage!(JSON.stringify(pingMessage));

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify pong was sent
      expect(mockSocket.receivedMessages).toHaveLength(1);
      const response = JSON.parse(mockSocket.receivedMessages[0]);
      expect(response.type).toBe('pong');
      expect(response.responseTo).toBe('msg-123');
    });

    test('should handle direct message', async () => {
      const message = {
        id: 'msg-456',
        type: 'message',
        payload: { text: 'Hello, World!' },
        timestamp: Date.now(),
        source: { id: 'conn-123', namespace: 'test-namespace' }
      };

      // Trigger message handling
      mockSocket.onmessage!(JSON.stringify(message));

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify acknowledgment was sent
      expect(mockSocket.receivedMessages).toHaveLength(1);
      const response = JSON.parse(mockSocket.receivedMessages[0]);
      expect(response.type).toBe('message:acknowledged');
      expect(response.messageId).toBe('msg-456');
    });

    test('should handle invalid message format', async () => {
      // Send invalid message
      mockSocket.onmessage!('invalid json');

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify error was sent
      expect(mockSocket.receivedMessages).toHaveLength(1);
      const response = JSON.parse(mockSocket.receivedMessages[0]);
      expect(response.type).toBe('error');
      expect(response.code).toBe('INVALID_MESSAGE_FORMAT');
    });

    test('should handle large message', async () => {
      const largeMessage = {
        id: 'msg-789',
        type: 'message',
        payload: { text: 'x'.repeat(1000000) }, // 1MB
        timestamp: Date.now(),
        source: { id: 'conn-123', namespace: 'test-namespace' }
      };

      // Trigger message handling
      mockSocket.onmessage!(JSON.stringify(largeMessage));

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not process large message
      expect(mockSocket.receivedMessages).toHaveLength(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to handle message',
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('Heartbeat', () => {
    beforeEach(async () => {
      await manager.acceptConnection(mockSocket, 'test-namespace');
    });

    test('should send heartbeat', async () => {
      // Wait for heartbeat interval
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Verify heartbeat was sent
      expect(mockSocket.receivedMessages.length).toBeGreaterThan(0);
      const messages = mockSocket.receivedMessages.map(msg => JSON.parse(msg));
      const heartbeatMessage = messages.find(msg => msg.type === 'ping');
      expect(heartbeatMessage).toBeDefined();
      expect(heartbeatMessage?.type).toBe('ping');
    });

    test('should handle pong response', async () => {
      // Send initial heartbeat
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Send pong response
      const pongMessage = {
        id: 'msg-pong',
        type: 'pong',
        timestamp: Date.now(),
        responseTo: expect.any(String)
      };

      mockSocket.onmessage!(JSON.stringify(pongMessage));

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify connection is still active
      const connections = manager.getAllConnections();
      expect(connections).toHaveLength(1);
      expect(connections[0].lastActivity).toBeGreaterThan(0);
    });
  });

  describe('Connection Events', () => {
    test('should emit connection events', (done) => {
      manager.on('connection', (event: WebSocketEvent) => {
        expect(event.type).toBe('connect');
        expect(event.connectionId).toBeDefined();
        expect(event.timestamp).toBeGreaterThan(0);
        done();
      });

      manager.acceptConnection(mockSocket, 'test-namespace');
    });

    test('should emit disconnection events', (done) => {
      manager.on('connection', (event: WebSocketEvent) => {
        if (event.type === 'disconnect') {
          expect(event.connectionId).toBeDefined();
          expect(event.timestamp).toBeGreaterThan(0);
          done();
        }
      });

      manager.acceptConnection(mockSocket, 'test-namespace')
        .then(connectionId => {
          // Close connection
          mockSocket.close(1000, 'test');
        });
    });

    test('should emit error events', (done) => {
      manager.on('connection', (event: WebSocketEvent) => {
        if (event.type === 'error') {
          expect(event.error).toBeDefined();
          expect(event.connectionId).toBeDefined();
          done();
        }
      });

      manager.acceptConnection(mockSocket, 'test-namespace')
        .then(connectionId => {
          // Trigger error
          mockSocket.onerror!(new Error('Test error'));
        });
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      const rateLimitedManager = new WebSocketManager({
        maxConnections: 100,
        heartbeatInterval: 1000,
        heartbeatTimeout: 2000,
        maxMessageSize: 1024,
        maxQueueSize: 100,
        compression: false,
        enableBackpressure: false,
        enableLogging: false,
        enableMetrics: true,
        rateLimiting: {
          enabled: true,
          windowMs: 1000,
          maxConnections: 1
        }
      });

      // First connection should succeed
      await rateLimitedManager.acceptConnection(mockSocket, 'test-namespace');

      // Second connection should be rejected
      await expect(rateLimitedManager.acceptConnection(
        new MockWebSocket(),
        'test-namespace'
      )).rejects.toThrow('Rate limit exceeded');

      await rateLimitedManager.dispose();
    });
  });

  describe('Statistics', () => {
    test('should track connection statistics', async () => {
      const statsBefore = manager.getStats();
      expect(statsBefore.connections.total).toBe(0);
      expect(statsBefore.connections.active).toBe(0);

      await manager.acceptConnection(mockSocket, 'test-namespace');

      const statsAfter = manager.getStats();
      expect(statsAfter.connections.total).toBe(1);
      expect(statsAfter.connections.active).toBe(1);

      await manager.closeConnection(manager.getAllConnections()[0].id, {
        code: 1000,
        reason: 'test',
        wasClean: true
      });

      const statsFinal = manager.getStats();
      expect(statsFinal.connections.total).toBe(1);
      expect(statsFinal.connections.active).toBe(0);
    });

    test('should track message statistics', async () => {
      await manager.acceptConnection(mockSocket, 'test-namespace');

      const message = {
        id: 'msg-test',
        type: 'message',
        payload: { text: 'test' },
        timestamp: Date.now(),
        source: { id: 'conn-123', namespace: 'test-namespace' }
      };

      mockSocket.onmessage!(JSON.stringify(message));

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = manager.getStats();
      expect(stats.messages.total).toBe(1);
    });

    test('should calculate average latency', async () => {
      await manager.acceptConnection(mockSocket, 'test-namespace');

      const statsBefore = manager.getStats();
      expect(typeof statsBefore.metrics.averageLatency).toBe('number');
    });
  });

  describe('Health Checks', () => {
    test('should provide health status', async () => {
      const health = await manager.getHealth();
      expect(healthy).toBeDefined();
      expect(typeof health).toBe('object');
      expect(healthy.connections).toBeDefined();
      expect(healthy.metrics).toBeDefined();
    });

    test('should handle memory pressure', async () => {
      // This is a mock test - in a real scenario, we'd simulate memory pressure
      const health = await manager.getHealth();
      expect(healthy.healthy).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    test('should dispose manager properly', async () => {
      await manager.acceptConnection(mockSocket, 'test-namespace');

      const statsBefore = manager.getStats();
      expect(statsBefore.connections.active).toBe(1);

      await manager.dispose();

      const statsAfter = manager.getStats();
      expect(statsAfter.connections.active).toBe(0);
    });
  });
});