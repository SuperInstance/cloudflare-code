/**
 * Connection Manager Tests
 * Tests connection lifecycle, state management, and reconnection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionManager, ReconnectionManager } from './connection';
import { MessageHandler } from './messaging';
import type { Connection, ConnectionState, ConnectMessage, MessageType } from './types';
import { ConnectionState as ConnState } from './types';

// Mock WebSocket
class MockWebSocket {
  readyState: number = WebSocket.OPEN;
  sentMessages: string[] = [];
  eventHandlers: Map<string, Set<(event: MessageEvent | CloseEvent | Event) => void>> = new Map();

  addEventListener(type: string, handler: (event: any) => void): void {
    let handlers = this.eventHandlers.get(type);
    if (!handlers) {
      handlers = new Set();
      this.eventHandlers.set(type, handlers);
    }
    handlers.add(handler);
  }

  removeEventListener(type: string, handler: (event: any) => void): void {
    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  send(data: string | ArrayBuffer): void {
    this.sentMessages.push(data as string);
  }

  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSED;
    const handlers = this.eventHandlers.get('close');
    if (handlers) {
      for (const handler of handlers) {
        const event = new CloseEvent('close', { code: code ?? 1000, reason: reason ?? '' });
        handler(event);
      }
    }
  }

  // Helper to simulate receiving a message
  simulateMessage(data: string): void {
    const handlers = this.eventHandlers.get('message');
    if (handlers) {
      for (const handler of handlers) {
        const event = new MessageEvent('message', { data });
        handler(event);
      }
    }
  }

  // Helper to simulate connection close
  simulateClose(code: number, reason: string): void {
    this.readyState = WebSocket.CLOSED;
    const handlers = this.eventHandlers.get('close');
    if (handlers) {
      for (const handler of handlers) {
        const event = new CloseEvent('close', { code, reason });
        handler(event);
      }
    }
  }
}

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let messageHandler: MessageHandler;

  beforeEach(() => {
    messageHandler = new MessageHandler();
    connectionManager = new ConnectionManager(
      {
        maxConnections: 100,
        maxConnectionsPerUser: 5,
        connectionTimeout: 30000,
        heartbeatInterval: 30000,
        heartbeatTimeout: 60000,
        enableMetrics: true,
      },
      messageHandler
    );
  });

  afterEach(() => {
    connectionManager.destroy();
  });

  describe('acceptConnection', () => {
    it('should accept a new WebSocket connection', async () => {
      const mockWs = new MockWebSocket() as unknown as WebSocket;
      const connectMessage: ConnectMessage = {
        type: 'connect' as MessageType.CONNECT,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          userId: 'user_123',
          sessionId: 'session_456',
          reconnect: false,
        },
      };

      const connection = await connectionManager.acceptConnection(mockWs, connectMessage);

      expect(connection).toBeDefined();
      expect(connection.userId).toBe('user_123');
      expect(connection.sessionId).toBe('session_456');
      expect(connection.state).toBe(ConnState.CONNECTED);
    });

    it('should enforce maximum connections per user', async () => {
      const userId = 'user_123';

      // Create maximum connections for user
      for (let i = 0; i < 5; i++) {
        const mockWs = new MockWebSocket() as unknown as WebSocket;
        const connectMessage: ConnectMessage = {
          type: 'connect' as MessageType.CONNECT,
          id: `msg_${i}`,
          timestamp: Date.now(),
          data: {
            userId,
            sessionId: `session_${i}`,
            reconnect: false,
          },
        };

        await connectionManager.acceptConnection(mockWs, connectMessage);
      }

      // Try to create one more connection (should fail)
      const mockWs = new MockWebSocket() as unknown as WebSocket;
      const connectMessage: ConnectMessage = {
        type: 'connect' as MessageType.CONNECT,
        id: 'msg_exceed',
        timestamp: Date.now(),
        data: {
          userId,
          sessionId: 'session_exceed',
          reconnect: false,
        },
      };

      await expect(connectionManager.acceptConnection(mockWs, connectMessage)).rejects.toThrow();
    });

    it('should update statistics on connection', async () => {
      const mockWs = new MockWebSocket() as unknown as WebSocket;
      const connectMessage: ConnectMessage = {
        type: 'connect' as MessageType.CONNECT,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          userId: 'user_123',
          sessionId: 'session_456',
          reconnect: false,
        },
      };

      await connectionManager.acceptConnection(mockWs, connectMessage);

      const stats = connectionManager.getStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.currentConnections).toBe(1);
    });
  });

  describe('getConnection', () => {
    it('should retrieve connection by ID', async () => {
      const mockWs = new MockWebSocket() as unknown as WebSocket;
      const connectMessage: ConnectMessage = {
        type: 'connect' as MessageType.CONNECT,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          userId: 'user_123',
          sessionId: 'session_456',
          reconnect: false,
        },
      };

      const connection = await connectionManager.acceptConnection(mockWs, connectMessage);
      const retrieved = connectionManager.getConnection(connection.connectionId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.connectionId).toBe(connection.connectionId);
    });

    it('should return null for non-existent connection', () => {
      const retrieved = connectionManager.getConnection('non_existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getUserConnections', () => {
    it('should retrieve all user connections', async () => {
      const userId = 'user_123';

      // Create multiple connections for user
      const connectionIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const mockWs = new MockWebSocket() as unknown as WebSocket;
        const connectMessage: ConnectMessage = {
          type: 'connect' as MessageType.CONNECT,
          id: `msg_${i}`,
          timestamp: Date.now(),
          data: {
            userId,
            sessionId: `session_${i}`,
            reconnect: false,
          },
        };

        const connection = await connectionManager.acceptConnection(mockWs, connectMessage);
        connectionIds.push(connection.connectionId);
      }

      const userConnections = connectionManager.getUserConnections(userId);
      expect(userConnections.length).toBe(3);
      expect(userConnections.map(c => c.connectionId)).toEqual(connectionIds);
    });
  });

  describe('updateConnectionState', () => {
    it('should update connection state', async () => {
      const mockWs = new MockWebSocket() as unknown as WebSocket;
      const connectMessage: ConnectMessage = {
        type: 'connect' as MessageType.CONNECT,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          userId: 'user_123',
          sessionId: 'session_456',
          reconnect: false,
        },
      };

      const connection = await connectionManager.acceptConnection(mockWs, connectMessage);
      const updated = connectionManager.updateConnectionState(
        connection.connectionId,
        ConnState.DISCONNECTING
      );

      expect(updated).toBe(true);
      expect(connection.state).toBe(ConnState.DISCONNECTING);
    });
  });

  describe('updateActivity', () => {
    it('should update connection activity timestamp', async () => {
      const mockWs = new MockWebSocket() as unknown as WebSocket;
      const connectMessage: ConnectMessage = {
        type: 'connect' as MessageType.CONNECT,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          userId: 'user_123',
          sessionId: 'session_456',
          reconnect: false,
        },
      };

      const connection = await connectionManager.acceptConnection(mockWs, connectMessage);
      const initialActivity = connection.lastActivity;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      connectionManager.updateActivity(connection.connectionId);

      expect(connection.lastActivity).toBeGreaterThan(initialActivity);
    });
  });

  describe('addRoomToConnection', () => {
    it('should add room to connection', async () => {
      const mockWs = new MockWebSocket() as unknown as WebSocket;
      const connectMessage: ConnectMessage = {
        type: 'connect' as MessageType.CONNECT,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          userId: 'user_123',
          sessionId: 'session_456',
          reconnect: false,
        },
      };

      const connection = await connectionManager.acceptConnection(mockWs, connectMessage);
      const added = connectionManager.addRoomToConnection(connection.connectionId, 'room_123');

      expect(added).toBe(true);
      expect(connection.rooms.has('room_123')).toBe(true);
    });
  });

  describe('removeRoomFromConnection', () => {
    it('should remove room from connection', async () => {
      const mockWs = new MockWebSocket() as unknown as WebSocket;
      const connectMessage: ConnectMessage = {
        type: 'connect' as MessageType.CONNECT,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          userId: 'user_123',
          sessionId: 'session_456',
          reconnect: false,
        },
      };

      const connection = await connectionManager.acceptConnection(mockWs, connectMessage);
      connectionManager.addRoomToConnection(connection.connectionId, 'room_123');

      const removed = connectionManager.removeRoomFromConnection(connection.connectionId, 'room_123');

      expect(removed).toBe(true);
      expect(connection.rooms.has('room_123')).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should disconnect connection', async () => {
      const mockWs = new MockWebSocket() as unknown as WebSocket;
      const connectMessage: ConnectMessage = {
        type: 'connect' as MessageType.CONNECT,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          userId: 'user_123',
          sessionId: 'session_456',
          reconnect: false,
        },
      };

      const connection = await connectionManager.acceptConnection(mockWs, connectMessage);
      const disconnected = connectionManager.disconnect(connection.connectionId, 'Test disconnect');

      expect(disconnected).toBe(true);
      expect((mockWs as any).readyState).toBe(WebSocket.CLOSED);
    });
  });

  describe('getConnectionCount', () => {
    it('should return correct connection count', async () => {
      expect(connectionManager.getConnectionCount()).toBe(0);

      const mockWs = new MockWebSocket() as unknown as WebSocket;
      const connectMessage: ConnectMessage = {
        type: 'connect' as MessageType.CONNECT,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          userId: 'user_123',
          sessionId: 'session_456',
          reconnect: false,
        },
      };

      await connectionManager.acceptConnection(mockWs, connectMessage);

      expect(connectionManager.getConnectionCount()).toBe(1);
    });
  });

  describe('cleanupIdleConnections', () => {
    it('should cleanup idle connections', async () => {
      const mockWs = new MockWebSocket() as unknown as WebSocket;
      const connectMessage: ConnectMessage = {
        type: 'connect' as MessageType.CONNECT,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          userId: 'user_123',
          sessionId: 'session_456',
          reconnect: false,
        },
      };

      const connection = await connectionManager.acceptConnection(mockWs, connectMessage);

      // Set last activity to past
      (connection as any).lastActivity = Date.now() - 40000;

      const cleaned = connectionManager.cleanupIdleConnections(30000);

      expect(cleaned).toBe(1);
      expect(connectionManager.getConnectionCount()).toBe(0);
    });
  });

  describe('event handling', () => {
    it('should emit connection events', async () => {
      const eventHandler = vi.fn();
      connectionManager.onEvent(eventHandler);

      const mockWs = new MockWebSocket() as unknown as WebSocket;
      const connectMessage: ConnectMessage = {
        type: 'connect' as MessageType.CONNECT,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          userId: 'user_123',
          sessionId: 'session_456',
          reconnect: false,
        },
      };

      await connectionManager.acceptConnection(mockWs, connectMessage);

      expect(eventHandler).toHaveBeenCalled();
      expect(eventHandler.mock.calls[0][0].type).toBe('connected');
    });
  });
});

describe('ReconnectionManager', () => {
  let reconnectionManager: ReconnectionManager;
  let reconnectCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    reconnectCallback = vi.fn();
    reconnectionManager = new ReconnectionManager(
      {
        enabled: true,
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        retryOn: [1000, 1006],
      },
      reconnectCallback
    );
  });

  afterEach(() => {
    reconnectionManager.clear();
  });

  describe('scheduleReconnection', () => {
    it('should schedule reconnection with exponential backoff', async () => {
      vi.useFakeTimers();

      reconnectionManager.scheduleReconnection('conn_123');

      // First attempt after initial delay
      vi.advanceTimersByTime(100);
      expect(reconnectCallback).toHaveBeenCalledWith('conn_123', 1);

      // Second attempt after 2x delay
      reconnectCallback.mockClear();
      reconnectionManager.scheduleReconnection('conn_123');
      vi.advanceTimersByTime(200);
      expect(reconnectCallback).toHaveBeenCalledWith('conn_123', 2);

      vi.useRealTimers();
    });

    it('should not exceed max retry attempts', () => {
      vi.useFakeTimers();

      for (let i = 0; i < 5; i++) {
        reconnectionManager.scheduleReconnection('conn_123');
        vi.advanceTimersByTime(100);
      }

      // Should only be called maxAttempts (3) times
      expect(reconnectCallback).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });
  });

  describe('cancelReconnection', () => {
    it('should cancel pending reconnection', () => {
      vi.useFakeTimers();

      reconnectionManager.scheduleReconnection('conn_123');
      reconnectionManager.cancelReconnection('conn_123');

      vi.advanceTimersByTime(1000);

      expect(reconnectCallback).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('resetAttempts', () => {
    it('should reset reconnection attempts', () => {
      reconnectionManager.scheduleReconnection('conn_123');
      reconnectionManager.cancelReconnection('conn_123');

      const attempts = reconnectionManager.getAttemptCount('conn_123');
      expect(attempts).toBe(0);
    });
  });

  describe('getAttemptCount', () => {
    it('should return current attempt count', () => {
      expect(reconnectionManager.getAttemptCount('conn_123')).toBe(0);

      reconnectionManager.scheduleReconnection('conn_123');
      reconnectionManager.cancelReconnection('conn_123');

      expect(reconnectionManager.getAttemptCount('conn_123')).toBe(1);
    });
  });
});
