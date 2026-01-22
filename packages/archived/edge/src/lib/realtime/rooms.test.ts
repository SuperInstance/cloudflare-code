/**
 * Room Manager Tests
 * Tests room creation, membership, and broadcasting
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RoomManager, RoomEventBroadcaster } from './rooms';
import type { Room, RoomMembership } from './types';

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager({
      maxRooms: 100,
      maxMembersPerRoom: 10,
      maxRoomsPerUser: 5,
      roomTTL: 86400000,
      enableHistory: true,
      historyLimit: 100,
    });
  });

  afterEach(() => {
    // Cleanup is handled automatically
  });

  describe('createRoom', () => {
    it('should create a new public room', () => {
      const room = roomManager.createRoom('General', 'user_123', 'public', { topic: 'General discussion' });

      expect(room).toBeDefined();
      expect(room.roomId).toBeDefined();
      expect(room.name).toBe('General');
      expect(room.type).toBe('public');
      expect(room.owner).toBe('user_123');
      expect(room.currentSize).toBe(0);
      expect(room.maxSize).toBe(10);
    });

    it('should create a new private room', () => {
      const room = roomManager.createRoom('Private', 'user_456', 'private');

      expect(room.type).toBe('private');
      expect(room.permissions.canJoin).toBe(false);
      expect(room.permissions.canRead).toBe(false);
    });

    it('should create a direct message room with max 2 members', () => {
      const room = roomManager.createRoom('Direct', 'user_789', 'direct');

      expect(room.type).toBe('direct');
      expect(room.maxSize).toBe(2);
    });

    it('should enforce max rooms limit', () => {
      const manager = new RoomManager({
        maxRooms: 2,
        maxMembersPerRoom: 10,
        maxRoomsPerUser: 5,
      });

      manager.createRoom('Room1', 'user_1', 'public');
      manager.createRoom('Room2', 'user_2', 'public');

      expect(() => {
        manager.createRoom('Room3', 'user_3', 'public');
      }).toThrow('Maximum room limit reached');
    });

    it('should enforce max rooms per user limit', () => {
      const userId = 'user_limit';

      // Create max rooms
      for (let i = 0; i < 5; i++) {
        const room = roomManager.createRoom(`Room${i}`, userId, 'public');
        roomManager.joinRoom(room.roomId, userId);
      }

      // Try to create one more (should fail)
      expect(() => {
        roomManager.createRoom('RoomExceed', userId, 'public');
      }).toThrow('Maximum rooms per user limit reached');
    });
  });

  describe('getRoom', () => {
    it('should retrieve room by ID', () => {
      const createdRoom = roomManager.createRoom('Test', 'user_123', 'public');
      const retrievedRoom = roomManager.getRoom(createdRoom.roomId);

      expect(retrievedRoom).toBeDefined();
      expect(retrievedRoom?.roomId).toBe(createdRoom.roomId);
    });

    it('should return null for non-existent room', () => {
      const room = roomManager.getRoom('non_existent');
      expect(room).toBeNull();
    });
  });

  describe('deleteRoom', () => {
    it('should delete existing room', () => {
      const room = roomManager.createRoom('ToDelete', 'user_123', 'public');
      const deleted = roomManager.deleteRoom(room.roomId);

      expect(deleted).toBe(true);
      expect(roomManager.getRoom(room.roomId)).toBeNull();
    });

    it('should return false for non-existent room', () => {
      const deleted = roomManager.deleteRoom('non_existent');
      expect(deleted).toBe(false);
    });
  });

  describe('joinRoom', () => {
    it('should add user to room', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');
      const membership = roomManager.joinRoom(room.roomId, 'user_456');

      expect(membership).toBeDefined();
      expect(membership.userId).toBe('user_456');
      expect(membership.roomId).toBe(room.roomId);
      expect(membership.role).toBe('member');
    });

    it('should update room size when user joins', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');

      expect(room.currentSize).toBe(0);

      roomManager.joinRoom(room.roomId, 'user_1');
      expect(room.currentSize).toBe(1);

      roomManager.joinRoom(room.roomId, 'user_2');
      expect(room.currentSize).toBe(2);
    });

    it('should enforce max members per room', () => {
      const manager = new RoomManager({
        maxRooms: 100,
        maxMembersPerRoom: 2,
        maxRoomsPerUser: 5,
      });

      const room = manager.createRoom('SmallRoom', 'owner_123', 'public');
      manager.joinRoom(room.roomId, 'user_1');
      manager.joinRoom(room.roomId, 'user_2');

      expect(() => {
        manager.joinRoom(room.roomId, 'user_3');
      }).toThrow('Room is full');
    });

    it('should not allow user to join room twice', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');
      roomManager.joinRoom(room.roomId, 'user_456');

      expect(() => {
        roomManager.joinRoom(room.roomId, 'user_456');
      }).toThrow('User already in room');
    });
  });

  describe('leaveRoom', () => {
    it('should remove user from room', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');
      roomManager.joinRoom(room.roomId, 'user_456');

      const left = roomManager.leaveRoom(room.roomId, 'user_456');

      expect(left).toBe(true);
      expect(roomManager.getRoomMembers(room.roomId)).not.toContain('user_456');
    });

    it('should update room size when user leaves', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');
      roomManager.joinRoom(room.roomId, 'user_1');
      roomManager.joinRoom(room.roomId, 'user_2');

      expect(room.currentSize).toBe(2);

      roomManager.leaveRoom(room.roomId, 'user_1');

      expect(room.currentSize).toBe(1);
    });

    it('should return false for non-existent member', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');
      const left = roomManager.leaveRoom(room.roomId, 'non_existent');

      expect(left).toBe(false);
    });
  });

  describe('getRoomMembers', () => {
    it('should return all room members', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');
      roomManager.joinRoom(room.roomId, 'user_1');
      roomManager.joinRoom(room.roomId, 'user_2');
      roomManager.joinRoom(room.roomId, 'user_3');

      const members = roomManager.getRoomMembers(room.roomId);

      expect(members).toHaveLength(3);
      expect(members).toContain('user_1');
      expect(members).toContain('user_2');
      expect(members).toContain('user_3');
    });

    it('should return empty array for empty room', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');
      const members = roomManager.getRoomMembers(room.roomId);

      expect(members).toEqual([]);
    });
  });

  describe('getUserRooms', () => {
    it('should return all user rooms', () => {
      const room1 = roomManager.createRoom('Room1', 'owner_123', 'public');
      const room2 = roomManager.createRoom('Room2', 'owner_456', 'public');

      roomManager.joinRoom(room1.roomId, 'user_789');
      roomManager.joinRoom(room2.roomId, 'user_789');

      const userRooms = roomManager.getUserRooms('user_789');

      expect(userRooms).toHaveLength(2);
      expect(userRooms).toContain(room1.roomId);
      expect(userRooms).toContain(room2.roomId);
    });

    it('should return empty array for user with no rooms', () => {
      const userRooms = roomManager.getUserRooms('non_existent');
      expect(userRooms).toEqual([]);
    });
  });

  describe('isUserInRoom', () => {
    it('should return true if user is in room', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');
      roomManager.joinRoom(room.roomId, 'user_456');

      expect(roomManager.isUserInRoom(room.roomId, 'user_456')).toBe(true);
    });

    it('should return false if user is not in room', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');

      expect(roomManager.isUserInRoom(room.roomId, 'user_456')).toBe(false);
    });
  });

  describe('getRoomSize', () => {
    it('should return correct room size', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');

      expect(roomManager.getRoomSize(room.roomId)).toBe(0);

      roomManager.joinRoom(room.roomId, 'user_1');
      expect(roomManager.getRoomSize(room.roomId)).toBe(1);

      roomManager.joinRoom(room.roomId, 'user_2');
      expect(roomManager.getRoomSize(room.roomId)).toBe(2);

      roomManager.leaveRoom(room.roomId, 'user_1');
      expect(roomManager.getRoomSize(room.roomId)).toBe(1);
    });
  });

  describe('getAllRooms', () => {
    it('should return all rooms', () => {
      roomManager.createRoom('Room1', 'user_1', 'public');
      roomManager.createRoom('Room2', 'user_2', 'private');
      roomManager.createRoom('Room3', 'user_3', 'direct');

      const allRooms = roomManager.getAllRooms();

      expect(allRooms).toHaveLength(3);
    });
  });

  describe('getPublicRooms', () => {
    it('should return only public rooms', () => {
      roomManager.createRoom('Public1', 'user_1', 'public');
      roomManager.createRoom('Private1', 'user_2', 'private');
      roomManager.createRoom('Public2', 'user_3', 'public');
      roomManager.createRoom('Direct1', 'user_4', 'direct');

      const publicRooms = roomManager.getPublicRooms();

      expect(publicRooms).toHaveLength(2);
      expect(publicRooms.every(r => r.type === 'public')).toBe(true);
    });
  });

  describe('updateRoomMetadata', () => {
    it('should update room metadata', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public', { topic: 'Old topic' });

      const updated = roomManager.updateRoomMetadata(room.roomId, { topic: 'New topic' });

      expect(updated).toBe(true);
      expect(room.metadata.topic).toBe('New topic');
    });

    it('should merge metadata', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public', {
        topic: 'Topic',
        tags: ['tag1'],
      });

      roomManager.updateRoomMetadata(room.roomId, { tags: ['tag2'] });

      expect(room.metadata.topic).toBe('Topic');
      expect(room.metadata.tags).toEqual(['tag2']);
    });
  });

  describe('addMessageToHistory', () => {
    it('should add message to room history', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');
      const message = {
        type: 'message' as const,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello',
        },
      };

      roomManager.addMessageToHistory(room.roomId, message);

      const history = roomManager.getRoomHistory(room.roomId);
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(message);
    });

    it('should limit history size', () => {
      const manager = new RoomManager({
        maxRooms: 100,
        maxMembersPerRoom: 10,
        maxRoomsPerUser: 5,
        enableHistory: true,
        historyLimit: 5,
      });

      const room = manager.createRoom('TestRoom', 'owner_123', 'public');

      // Add more messages than limit
      for (let i = 0; i < 10; i++) {
        manager.addMessageToHistory(room.roomId, {
          type: 'message' as const,
          id: `msg_${i}`,
          timestamp: Date.now(),
          data: { content: `Message ${i}` },
        });
      }

      const history = manager.getRoomHistory(room.roomId);
      expect(history).toHaveLength(5);
    });
  });

  describe('getRoomHistory', () => {
    it('should return all messages when no limit specified', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');

      for (let i = 0; i < 5; i++) {
        roomManager.addMessageToHistory(room.roomId, {
          type: 'message' as const,
          id: `msg_${i}`,
          timestamp: Date.now(),
          data: { content: `Message ${i}` },
        });
      }

      const history = roomManager.getRoomHistory(room.roomId);
      expect(history).toHaveLength(5);
    });

    it('should return limited messages when limit specified', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');

      for (let i = 0; i < 10; i++) {
        roomManager.addMessageToHistory(room.roomId, {
          type: 'message' as const,
          id: `msg_${i}`,
          timestamp: Date.now(),
          data: { content: `Message ${i}` },
        });
      }

      const history = roomManager.getRoomHistory(room.roomId, 3);
      expect(history).toHaveLength(3);
    });
  });

  describe('getStats', () => {
    it('should return room statistics', () => {
      const room1 = roomManager.createRoom('Room1', 'user_1', 'public');
      const room2 = roomManager.createRoom('Room2', 'user_2', 'private');
      const room3 = roomManager.createRoom('Room3', 'user_3', 'direct');

      roomManager.joinRoom(room1.roomId, 'user_1');
      roomManager.joinRoom(room1.roomId, 'user_2');
      roomManager.joinRoom(room1.roomId, 'user_3');

      const stats = roomManager.getStats();

      expect(stats.totalRooms).toBe(3);
      expect(stats.publicRooms).toBe(1);
      expect(stats.privateRooms).toBe(1);
      expect(stats.directRooms).toBe(1);
      expect(stats.totalMemberships).toBe(3);
    });
  });

  describe('banUser', () => {
    it('should ban user from room', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');
      roomManager.joinRoom(room.roomId, 'user_456');

      const banned = roomManager.banUser(room.roomId, 'user_456');

      expect(banned).toBe(true);
      expect(roomManager.isUserBanned(room.roomId, 'user_456')).toBe(true);
      expect(roomManager.isUserInRoom(room.roomId, 'user_456')).toBe(false);
    });
  });

  describe('unbanUser', () => {
    it('should unban user from room', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');
      roomManager.banUser(room.roomId, 'user_456');

      const unbanned = roomManager.unbanUser(room.roomId, 'user_456');

      expect(unbanned).toBe(true);
      expect(roomManager.isUserBanned(room.roomId, 'user_456')).toBe(false);
    });
  });

  describe('isUserBanned', () => {
    it('should return true if user is banned', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');
      roomManager.banUser(room.roomId, 'user_456');

      expect(roomManager.isUserBanned(room.roomId, 'user_456')).toBe(true);
    });

    it('should return false if user is not banned', () => {
      const room = roomManager.createRoom('TestRoom', 'owner_123', 'public');

      expect(roomManager.isUserBanned(room.roomId, 'user_456')).toBe(false);
    });
  });
});

describe('RoomEventBroadcaster', () => {
  let broadcaster: RoomEventBroadcaster;

  beforeEach(() => {
    broadcaster = new RoomEventBroadcaster();
  });

  describe('subscribe', () => {
    it('should subscribe to room events', () => {
      const handler = () => {};
      const unsubscribe = broadcaster.subscribe('room_123', handler);

      expect(broadcaster.getSubscriberCount('room_123')).toBe(1);

      unsubscribe();
      expect(broadcaster.getSubscriberCount('room_123')).toBe(0);
    });

    it('should support multiple subscribers', () => {
      const handler1 = () => {};
      const handler2 = () => {};

      broadcaster.subscribe('room_123', handler1);
      broadcaster.subscribe('room_123', handler2);

      expect(broadcaster.getSubscriberCount('room_123')).toBe(2);
    });
  });

  describe('broadcast', () => {
    it('should broadcast event to subscribers', () => {
      const handler = vi.fn();
      broadcaster.subscribe('room_123', handler);

      const event = {
        type: 'user_joined' as const,
        roomId: 'room_123',
        userId: 'user_456',
        timestamp: Date.now(),
        data: {},
      };

      broadcaster.broadcast(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should not broadcast to unsubscribed handlers', () => {
      const handler = vi.fn();
      const unsubscribe = broadcaster.subscribe('room_123', handler);

      unsubscribe();

      const event = {
        type: 'user_joined' as const,
        roomId: 'room_123',
        userId: 'user_456',
        timestamp: Date.now(),
        data: {},
      };

      broadcaster.broadcast(event);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribeAll', () => {
    it('should unsubscribe all handlers for room', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      broadcaster.subscribe('room_123', handler1);
      broadcaster.subscribe('room_123', handler2);

      expect(broadcaster.getSubscriberCount('room_123')).toBe(2);

      broadcaster.unsubscribeAll('room_123');

      expect(broadcaster.getSubscriberCount('room_123')).toBe(0);
    });
  });
});
