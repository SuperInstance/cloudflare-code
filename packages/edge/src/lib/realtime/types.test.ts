/**
 * Type Definitions Tests
 * Validates all real-time communication types
 */

import { describe, it, expect } from 'vitest';
import type {
  AnyMessage,
  ConnectMessage,
  DisconnectMessage,
  JoinRoomMessage,
  LeaveRoomMessage,
  ChatMessage,
  DirectMessage,
  PresenceUpdateMessage,
  StreamDataMessage,
  ErrorMessage,
  Connection,
  Room,
  RoomMembership,
  Presence,
  RoomEvent,
  MessageDelivery,
  QueuedMessage,
} from './types';
import {
  MessageType,
  ConnectionState,
  PresenceStatus,
  MessagePriority,
  SerializationFormat,
} from './types';

describe('Real-time Communication Types', () => {
  describe('MessageType Enum', () => {
    it('should have all required message types', () => {
      expect(MessageType.CONNECT).toBe('connect');
      expect(MessageType.DISCONNECT).toBe('disconnect');
      expect(MessageType.JOIN_ROOM).toBe('join_room');
      expect(MessageType.LEAVE_ROOM).toBe('leave_room');
      expect(MessageType.MESSAGE).toBe('message');
      expect(MessageType.PRESENCE_UPDATE).toBe('presence_update');
      expect(MessageType.PING).toBe('ping');
      expect(MessageType.PONG).toBe('pong');
    });
  });

  describe('ConnectionState Enum', () => {
    it('should have all connection states', () => {
      expect(ConnectionState.CONNECTING).toBe('connecting');
      expect(ConnectionState.CONNECTED).toBe('connected');
      expect(ConnectionState.DISCONNECTING).toBe('disconnecting');
      expect(ConnectionState.DISCONNECTED).toBe('disconnected');
      expect(ConnectionState.RECONNECTING).toBe('reconnecting');
    });
  });

  describe('PresenceStatus Enum', () => {
    it('should have all presence statuses', () => {
      expect(PresenceStatus.ONLINE).toBe('online');
      expect(PresenceStatus.AWAY).toBe('away');
      expect(PresenceStatus.BUSY).toBe('busy');
      expect(PresenceStatus.OFFLINE).toBe('offline');
    });
  });

  describe('MessagePriority Enum', () => {
    it('should have all priority levels in correct order', () => {
      expect(MessagePriority.LOW).toBe(0);
      expect(MessagePriority.NORMAL).toBe(1);
      expect(MessagePriority.HIGH).toBe(2);
      expect(MessagePriority.URGENT).toBe(3);
    });
  });

  describe('SerializationFormat Enum', () => {
    it('should have all serialization formats', () => {
      expect(SerializationFormat.JSON).toBe('json');
      expect(SerializationFormat.MESSAGE_PACK).toBe('messagepack');
      expect(SerializationFormat.CBOR).toBe('cbor');
    });
  });

  describe('Message Types', () => {
    it('should create valid connect message', () => {
      const message: ConnectMessage = {
        type: MessageType.CONNECT,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          userId: 'user_123',
          sessionId: 'session_456',
          token: 'token_abc',
          capabilities: ['read', 'write'],
          reconnect: false,
        },
      };

      expect(message.type).toBe(MessageType.CONNECT);
      expect(message.data.userId).toBe('user_123');
      expect(message.data.capabilities).toContain('read');
    });

    it('should create valid disconnect message', () => {
      const message: DisconnectMessage = {
        type: MessageType.DISCONNECT,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          reason: 'Client disconnect',
          code: 1000,
          reconnect: true,
        },
      };

      expect(message.type).toBe(MessageType.DISCONNECT);
      expect(message.data.reason).toBe('Client disconnect');
      expect(message.data.code).toBe(1000);
    });

    it('should create valid join room message', () => {
      const message: JoinRoomMessage = {
        type: MessageType.JOIN_ROOM,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          roomId: 'room_789',
          password: 'password',
          metadata: { theme: 'dark' },
        },
      };

      expect(message.type).toBe(MessageType.JOIN_ROOM);
      expect(message.data.roomId).toBe('room_789');
    });

    it('should create valid leave room message', () => {
      const message: LeaveRoomMessage = {
        type: MessageType.LEAVE_ROOM,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          roomId: 'room_789',
        },
      };

      expect(message.type).toBe(MessageType.LEAVE_ROOM);
      expect(message.data.roomId).toBe('room_789');
    });

    it('should create valid chat message', () => {
      const message: ChatMessage = {
        type: MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        priority: MessagePriority.NORMAL,
        data: {
          roomId: 'room_789',
          content: 'Hello, world!',
          contentType: 'text',
          replyTo: 'msg_456',
          mentions: ['user_456'],
          ephemeral: false,
        },
      };

      expect(message.type).toBe(MessageType.MESSAGE);
      expect(message.data.content).toBe('Hello, world!');
      expect(message.data.contentType).toBe('text');
      expect(message.priority).toBe(MessagePriority.NORMAL);
    });

    it('should create valid direct message', () => {
      const message: DirectMessage = {
        type: MessageType.DIRECT_MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          toUserId: 'user_456',
          content: 'Private message',
          contentType: 'text',
        },
      };

      expect(message.type).toBe(MessageType.DIRECT_MESSAGE);
      expect(message.data.toUserId).toBe('user_456');
    });

    it('should create valid presence update message', () => {
      const message: PresenceUpdateMessage = {
        type: MessageType.PRESENCE_UPDATE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          status: PresenceStatus.AWAY,
          customStatus: 'In a meeting',
          capabilities: ['read', 'write'],
        },
      };

      expect(message.type).toBe(MessageType.PRESENCE_UPDATE);
      expect(message.data.status).toBe(PresenceStatus.AWAY);
      expect(message.data.customStatus).toBe('In a meeting');
    });

    it('should create valid stream data message', () => {
      const message: StreamDataMessage = {
        type: MessageType.STREAM_DATA,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          streamId: 'stream_abc',
          sequence: 1,
          chunk: 'data chunk',
          encoding: 'utf-8',
          final: false,
        },
      };

      expect(message.type).toBe(MessageType.STREAM_DATA);
      expect(message.data.streamId).toBe('stream_abc');
      expect(message.data.sequence).toBe(1);
    });

    it('should create valid error message', () => {
      const message: ErrorMessage = {
        type: MessageType.ERROR,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          code: 'ERROR_CODE',
          message: 'An error occurred',
          details: { field: 'value' },
          recoverable: true,
        },
      };

      expect(message.type).toBe(MessageType.ERROR);
      expect(message.data.code).toBe('ERROR_CODE');
      expect(message.data.recoverable).toBe(true);
    });
  });

  describe('Connection Type', () => {
    it('should create valid connection object', () => {
      const connection: Connection = {
        connectionId: 'conn_123',
        userId: 'user_456',
        sessionId: 'session_789',
        state: ConnectionState.CONNECTED,
        socket: {} as WebSocket,
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        rooms: new Set(['room_1', 'room_2']),
        metadata: { theme: 'dark' },
        capabilities: ['read', 'write'],
      };

      expect(connection.connectionId).toBe('conn_123');
      expect(connection.state).toBe(ConnectionState.CONNECTED);
      expect(connection.rooms.size).toBe(2);
      expect(connection.capabilities).toContain('read');
    });
  });

  describe('Room Type', () => {
    it('should create valid room object', () => {
      const room: Room = {
        roomId: 'room_123',
        name: 'General',
        type: 'public',
        owner: 'user_456',
        created: Date.now(),
        maxSize: 1000,
        currentSize: 5,
        metadata: { topic: 'General discussion' },
        permissions: {
          canRead: true,
          canWrite: true,
          canJoin: true,
          canModerate: false,
        },
      };

      expect(room.roomId).toBe('room_123');
      expect(room.type).toBe('public');
      expect(room.permissions.canRead).toBe(true);
    });
  });

  describe('Presence Type', () => {
    it('should create valid presence object', () => {
      const presence: Presence = {
        userId: 'user_123',
        status: PresenceStatus.ONLINE,
        customStatus: 'Available',
        lastSeen: Date.now(),
        currentRoom: 'room_456',
        capabilities: ['read', 'write'],
      };

      expect(presence.userId).toBe('user_123');
      expect(presence.status).toBe(PresenceStatus.ONLINE);
      expect(presence.capabilities).toContain('read');
    });
  });

  describe('RoomEvent Type', () => {
    it('should create valid room event', () => {
      const event: RoomEvent = {
        type: 'user_joined',
        roomId: 'room_123',
        userId: 'user_456',
        timestamp: Date.now(),
        data: { userId: 'user_456' },
      };

      expect(event.type).toBe('user_joined');
      expect(event.roomId).toBe('room_123');
    });
  });

  describe('MessageDelivery Type', () => {
    it('should create valid message delivery', () => {
      const delivery: MessageDelivery = {
        messageId: 'msg_123',
        status: 'delivered',
        attempts: 1,
        deliveredAt: Date.now(),
      };

      expect(delivery.messageId).toBe('msg_123');
      expect(delivery.status).toBe('delivered');
      expect(delivery.attempts).toBe(1);
    });
  });

  describe('QueuedMessage Type', () => {
    it('should create valid queued message', () => {
      const queued: QueuedMessage = {
        message: {} as AnyMessage,
        targetConnectionId: 'conn_123',
        targetRoomId: 'room_456',
        expiresAt: Date.now() + 60000,
        delivery: {
          messageId: 'msg_789',
          status: 'pending',
          attempts: 0,
        },
      };

      expect(queued.targetConnectionId).toBe('conn_123');
      expect(queued.delivery.status).toBe('pending');
    });
  });
});
