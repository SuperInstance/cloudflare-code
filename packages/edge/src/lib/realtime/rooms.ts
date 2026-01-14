/**
 * Room Management for Real-time Communication
 * Handles room creation, membership, and broadcasting
 */

import type {
  Room,
  RoomMembership,
  RoomPermissions,
  RoomEvent,
  ConnectedUser,
  ChatMessage,
  AnyMessage,
  MessageType,
} from './types';
import { generateId } from '../utils';

/**
 * Room management configuration
 */
interface RoomConfig {
  maxRooms: number;
  maxMembersPerRoom: number;
  maxRoomsPerUser: number;
  roomTTL: number;
  enableHistory: boolean;
  historyLimit: number;
}

/**
 * Room manager class
 */
export class RoomManager {
  private rooms: Map<string, Room>;
  private memberships: Map<string, Set<string>>; // roomId -> userIds
  private userMemberships: Map<string, Set<string>>; // userId -> roomIds
  private roomHistory: Map<string, AnyMessage[]>; // roomId -> messages
  private config: RoomConfig;

  constructor(config?: Partial<RoomConfig>) {
    this.rooms = new Map();
    this.memberships = new Map();
    this.userMemberships = new Map();
    this.roomHistory = new Map();

    this.config = {
      maxRooms: config?.maxRooms ?? 10000,
      maxMembersPerRoom: config?.maxMembersPerRoom ?? 1000,
      maxRoomsPerUser: config?.maxRoomsPerUser ?? 100,
      roomTTL: config?.roomTTL ?? 24 * 60 * 60 * 1000, // 24 hours
      enableHistory: config?.enableHistory ?? true,
      historyLimit: config?.historyLimit ?? 1000,
    };
  }

  /**
   * Create a new room
   */
  createRoom(
    name: string,
    owner: string,
    type: 'public' | 'private' | 'direct' = 'public',
    metadata: Record<string, unknown> = {}
  ): Room {
    if (this.rooms.size >= this.config.maxRooms) {
      throw new Error('Maximum room limit reached');
    }

    const userRoomCount = this.userMemberships.get(owner)?.size ?? 0;
    if (userRoomCount >= this.config.maxRoomsPerUser) {
      throw new Error('Maximum rooms per user limit reached');
    }

    const roomId = generateId('room');
    const now = Date.now();

    const room: Room = {
      roomId,
      name,
      type,
      owner,
      created: now,
      currentSize: 0,
      maxSize: type === 'direct' ? 2 : this.config.maxMembersPerRoom,
      metadata,
      permissions: this.getDefaultPermissions(type, owner),
    };

    this.rooms.set(roomId, room);
    this.memberships.set(roomId, new Set());

    if (this.config.enableHistory) {
      this.roomHistory.set(roomId, []);
    }

    return room;
  }

  /**
   * Get room by ID
   */
  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) ?? null;
  }

  /**
   * Delete a room
   */
  deleteRoom(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    // Remove all memberships
    const members = this.memberships.get(roomId);
    if (members) {
      for (const userId of members) {
        const userRooms = this.userMemberships.get(userId);
        if (userRooms) {
          userRooms.delete(roomId);
        }
      }
    }

    this.rooms.delete(roomId);
    this.memberships.delete(roomId);
    this.roomHistory.delete(roomId);

    return true;
  }

  /**
   * Join a room
   */
  joinRoom(roomId: string, userId: string, metadata: Record<string, unknown> = {}): RoomMembership {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const members = this.memberships.get(roomId);
    if (!members) {
      throw new Error('Room membership not found');
    }

    if (members.has(userId)) {
      throw new Error('User already in room');
    }

    if (room.currentSize >= room.maxSize!) {
      throw new Error('Room is full');
    }

    // Check user room limit
    const userRooms = this.userMemberships.get(userId) ?? new Set();
    if (userRooms.size >= this.config.maxRoomsPerUser) {
      throw new Error('Maximum rooms per user limit reached');
    }

    // Add to memberships
    members.add(userId);
    userRooms.add(roomId);
    this.userMemberships.set(userId, userRooms);

    // Update room size
    room.currentSize = members.size;

    const membership: RoomMembership = {
      roomId,
      userId,
      role: userId === room.owner ? 'owner' : 'member',
      joinedAt: Date.now(),
      permissions: this.getUserPermissions(room, userId),
      metadata,
    };

    return membership;
  }

  /**
   * Leave a room
   */
  leaveRoom(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const members = this.memberships.get(roomId);
    if (!members || !members.has(userId)) {
      return false;
    }

    // Remove from memberships
    members.delete(userId);
    room.currentSize = members.size;

    const userRooms = this.userMemberships.get(userId);
    if (userRooms) {
      userRooms.delete(roomId);
    }

    // Delete room if empty and not persistent
    if (members.size === 0 && !room.metadata.persistent) {
      this.deleteRoom(roomId);
    }

    return true;
  }

  /**
   * Get room members
   */
  getRoomMembers(roomId: string): string[] {
    const members = this.memberships.get(roomId);
    return members ? Array.from(members) : [];
  }

  /**
   * Get user's rooms
   */
  getUserRooms(userId: string): string[] {
    const userRooms = this.userMemberships.get(userId);
    return userRooms ? Array.from(userRooms) : [];
  }

  /**
   * Check if user is in room
   */
  isUserInRoom(roomId: string, userId: string): boolean {
    const members = this.memberships.get(roomId);
    return members ? members.has(userId) : false;
  }

  /**
   * Get room membership count
   */
  getRoomSize(roomId: string): number {
    const members = this.memberships.get(roomId);
    return members ? members.size : 0;
  }

  /**
   * Get all rooms
   */
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Get public rooms
   */
  getPublicRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(room => room.type === 'public');
  }

  /**
   * Update room metadata
   */
  updateRoomMetadata(roomId: string, metadata: Record<string, unknown>): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    room.metadata = { ...room.metadata, ...metadata };
    return true;
  }

  /**
   * Add message to room history
   */
  addMessageToHistory(roomId: string, message: AnyMessage): void {
    if (!this.config.enableHistory) {
      return;
    }

    let history = this.roomHistory.get(roomId);
    if (!history) {
      history = [];
      this.roomHistory.set(roomId, history);
    }

    history.push(message);

    // Trim history if over limit
    if (history.length > this.config.historyLimit) {
      history.splice(0, history.length - this.config.historyLimit);
    }
  }

  /**
   * Get room history
   */
  getRoomHistory(roomId: string, limit?: number): AnyMessage[] {
    const history = this.roomHistory.get(roomId);
    if (!history) {
      return [];
    }

    if (limit && limit > 0) {
      return history.slice(-limit);
    }

    return history;
  }

  /**
   * Clear room history
   */
  clearRoomHistory(roomId: string): boolean {
    return this.roomHistory.delete(roomId);
  }

  /**
   * Get room statistics
   */
  getStats(): {
    totalRooms: number;
    totalMemberships: number;
    publicRooms: number;
    privateRooms: number;
    directRooms: number;
    averageMembersPerRoom: number;
  } {
    const rooms = Array.from(this.rooms.values());
    const totalMemberships = Array.from(this.memberships.values()).reduce(
      (sum, members) => sum + members.size,
      0
    );

    return {
      totalRooms: rooms.length,
      totalMemberships,
      publicRooms: rooms.filter(r => r.type === 'public').length,
      privateRooms: rooms.filter(r => r.type === 'private').length,
      directRooms: rooms.filter(r => r.type === 'direct').length,
      averageMembersPerRoom: rooms.length > 0 ? totalMemberships / rooms.length : 0,
    };
  }

  /**
   * Clean up expired rooms
   */
  cleanupExpiredRooms(now: number = Date.now()): number {
    let cleaned = 0;

    for (const [roomId, room] of this.rooms.entries()) {
      const age = now - room.created;
      if (age > this.config.roomTTL && room.currentSize === 0) {
        this.deleteRoom(roomId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get default permissions for room type
   */
  private getDefaultPermissions(
    type: 'public' | 'private' | 'direct',
    owner: string
  ): RoomPermissions {
    switch (type) {
      case 'public':
        return {
          canRead: true,
          canWrite: true,
          canJoin: true,
          canModerate: false,
        };
      case 'private':
        return {
          canRead: false,
          canWrite: false,
          canJoin: false,
          canModerate: false,
        };
      case 'direct':
        return {
          canRead: true,
          canWrite: true,
          canJoin: false,
          canModerate: false,
        };
    }
  }

  /**
   * Get user-specific permissions
   */
  private getUserPermissions(room: Room, userId: string): RoomPermissions {
    if (userId === room.owner) {
      return {
        canRead: true,
        canWrite: true,
        canJoin: true,
        canModerate: true,
      };
    }

    return room.permissions;
  }

  /**
   * Update user role in room
   */
  updateUserRole(roomId: string, userId: string, role: 'admin' | 'moderator' | 'member'): boolean {
    const room = this.rooms.get(roomId);
    if (!room || userId === room.owner) {
      return false;
    }

    const members = this.memberships.get(roomId);
    if (!members || !members.has(userId)) {
      return false;
    }

    // Role is stored in membership, not in room
    // This would be tracked in a separate membership map in a full implementation
    return true;
  }

  /**
   * Ban user from room
   */
  banUser(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    // Store banned users in room metadata
    const banned = (room.metadata.banned as string[]) ?? [];
    if (!banned.includes(userId)) {
      banned.push(userId);
      room.metadata.banned = banned;
    }

    return this.leaveRoom(roomId, userId);
  }

  /**
   * Unban user from room
   */
  unbanUser(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const banned = (room.metadata.banned as string[]) ?? [];
    const index = banned.indexOf(userId);
    if (index > -1) {
      banned.splice(index, 1);
      room.metadata.banned = banned;
      return true;
    }

    return false;
  }

  /**
   * Check if user is banned from room
   */
  isUserBanned(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const banned = (room.metadata.banned as string[]) ?? [];
    return banned.includes(userId);
  }

  /**
   * Migrate room data to storage
   */
  async migrateToStorage(): Promise<void> {
    // Implementation would serialize all room data to persistent storage
    const data = {
      rooms: Array.from(this.rooms.entries()),
      memberships: Array.from(this.memberships.entries()).map(([roomId, members]) => [
        roomId,
        Array.from(members),
      ]),
      userMemberships: Array.from(this.userMemberships.entries()).map(([userId, rooms]) => [
        userId,
        Array.from(rooms),
      ]),
    };

    // In a real implementation, this would use KV or R2
    // await this.env.STORAGE.put('rooms', JSON.stringify(data));
  }

  /**
   * Load room data from storage
   */
  async loadFromStorage(): Promise<void> {
    // Implementation would deserialize room data from persistent storage
    // const data = await this.env.STORAGE.get('rooms');
    // if (data) {
    //   const parsed = JSON.parse(data);
    //   this.rooms = new Map(parsed.rooms);
    //   this.memberships = new Map(parsed.memberships.map(([k, v]: [string, string[]]) => [k, new Set(v)]));
    //   this.userMemberships = new Map(parsed.userMemberships.map(([k, v]: [string, string[]]) => [k, new Set(v)]));
    // }
  }
}

/**
 * Room event broadcaster
 */
export class RoomEventBroadcaster {
  private handlers: Map<string, Set<(event: RoomEvent) => void>>;

  constructor() {
    this.handlers = new Map();
  }

  /**
   * Subscribe to room events
   */
  subscribe(roomId: string, handler: (event: RoomEvent) => void): () => void {
    let handlers = this.handlers.get(roomId);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(roomId, handlers);
    }

    handlers.add(handler);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(roomId);
      }
    };
  }

  /**
   * Broadcast event to room subscribers
   */
  broadcast(event: RoomEvent): void {
    const handlers = this.handlers.get(event.roomId);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in room event handler:', error);
        }
      }
    }
  }

  /**
   * Unsubscribe all handlers for a room
   */
  unsubscribeAll(roomId: string): void {
    this.handlers.delete(roomId);
  }

  /**
   * Get subscriber count for room
   */
  getSubscriberCount(roomId: string): number {
    const handlers = this.handlers.get(roomId);
    return handlers ? handlers.size : 0;
  }
}
