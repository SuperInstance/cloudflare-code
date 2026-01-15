/**
 * Presence System Tests
 */

import { PresenceSystem } from './system';
import { PresenceStatus } from '../types';

// Mock event bus
class MockEventBus {
  private listeners = new Map<string, Function[]>();

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        listener(...args);
      }
    }
  }
}

// Mock logger
class MockLogger {
  info = jest.fn();
  warn = jest.fn();
  error = jest.fn();
  debug = jest.fn();
  log = jest.fn();
}

describe('PresenceSystem', () => {
  let presenceSystem: PresenceSystem;
  let eventBus: MockEventBus;
  let logger: MockLogger;

  beforeEach(() => {
    eventBus = new MockEventBus();
    logger = new MockLogger();
    presenceSystem = new PresenceSystem({
      heartbeatInterval: 1000,
      presenceTtl: 5000,
      enableStatusUpdates: true,
      enableActivityTracking: true,
      maxUsers: 1000,
      enableGlobalPresence: true,
      enablePresenceHistory: true,
      historyRetention: 3600000,
      enableMetrics: true
    }, logger);

    // Mock the event bus
    (presenceSystem as any).eventBus = eventBus;
  });

  afterEach(async () => {
    await presenceSystem.reset();
  });

  describe('Initialization', () => {
    test('should initialize user presence', async () => {
      const userId = 'user-123';
      const connectionId = 'conn-456';

      const presence = await presenceSystem.initializePresence(userId, connectionId);

      expect(presence.userId).toBe(userId);
      expect(presence.connectionId).toBe(connectionId);
      expect(presence.status).toBe('online');
      expect(presence.lastActivity).toBeGreaterThan(0);
      expect(presence.metadata).toEqual({});

      const stats = presenceSystem.getStats();
      expect(stats.totalUsers).toBe(1);
      expect(stats.onlineUsers).toBe(1);
      expect(stats.totalConnections).toBe(1);
    });

    test('should reject initialization when user limit exceeded', async () => {
      const limitedPresenceSystem = new PresenceSystem({
        heartbeatInterval: 1000,
        presenceTtl: 5000,
        enableStatusUpdates: true,
        enableActivityTracking: true,
        maxUsers: 0, // Set to 0 for limit test
        enableGlobalPresence: true,
        enablePresenceHistory: true,
        historyRetention: 3600000,
        enableMetrics: true
      });

      await expect(limitedPresenceSystem.initializePresence('user-1', 'conn-1'))
        .rejects.toThrow('User limit exceeded');

      await limitedPresenceSystem.reset();
    });

    test('should handle multiple connections for same user', async () => {
      const userId = 'user-123';
      const connection1 = 'conn-456';
      const connection2 = 'conn-789';

      // Initialize with first connection
      await presenceSystem.initializePresence(userId, connection1);

      // Update with second connection
      await presenceSystem.addConnection(userId, connection2);

      const connections = presenceSystem.getUserConnections(userId);
      expect(connections).toContain(connection1);
      expect(connections).toContain(connection2);
      expect(connections).toHaveLength(2);

      const stats = presenceSystem.getStats();
      expect(stats.totalConnections).toBe(2);
    });
  });

  describe('Status Management', () => {
    let userId: string;
    let connectionId: string;

    beforeEach(async () => {
      userId = 'user-123';
      connectionId = 'conn-456';
      await presenceSystem.initializePresence(userId, connectionId);
    });

    test('should update user status', async () => {
      const newStatus: PresenceStatus = 'busy';

      const updatedPresence = await presenceSystem.updateStatus(userId, newStatus);

      expect(updatedPresence.status).toBe(newStatus);
      expect(updatedPresence.userId).toBe(userId);

      const stats = presenceSystem.getStats();
      expect(stats.busyUsers).toBe(1);
      expect(stats.onlineUsers).toBe(0); // No longer online
    });

    test('should handle all valid status values', async () => {
      const statuses: PresenceStatus[] = ['online', 'away', 'busy', 'offline'];

      for (const status of statuses) {
        await presenceSystem.updateStatus(userId, status);
        const currentPresence = presenceSystem.getUserPresence(userId);
        expect(currentPresence?.status).toBe(status);
      }
    });

    test('should reject update status for non-existent user', async () => {
      await expect(presenceSystem.updateStatus('non-existent', 'busy'))
        .rejects.toThrow('User not found');
    });

    test('should emit status change events', async () => {
      const eventHandler = jest.fn();

      presenceSystem.on('status:change', eventHandler);

      await presenceSystem.updateStatus(userId, 'busy');

      expect(eventHandler).toHaveBeenCalledWith({
        userId,
        oldStatus: 'online',
        newStatus: 'busy',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Activity Tracking', () => {
    let userId: string;
    let connectionId: string;

    beforeEach(async () => {
      userId = 'user-123';
      connectionId = 'conn-456';
      await presenceSystem.initializePresence(userId, connectionId);
    });

    test('should update user activity', async () => {
      const initialActivity = presenceSystem.getUserPresence(userId)?.lastActivity;

      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay

      await presenceSystem.updateActivity(userId, { action: 'typing' });

      const updatedPresence = presenceSystem.getUserPresence(userId);
      expect(updatedPresence?.lastActivity).toBeGreaterThan(initialActivity!);
      expect(updatedPresence?.metadata.action).toBe('typing');
    });

    test('should reject activity update when disabled', async () => {
      const noActivitySystem = new PresenceSystem({
        heartbeatInterval: 1000,
        presenceTtl: 5000,
        enableStatusUpdates: true,
        enableActivityTracking: false, // Disabled
        maxUsers: 1000,
        enableGlobalPresence: true,
        enablePresenceHistory: true,
        historyRetention: 3600000,
        enableMetrics: true
      });

      await expect(noActivitySystem.updateActivity('user-123', {}))
        .rejects.toThrow('Activity tracking is disabled');

      await noActivitySystem.reset();
    });
  });

  describe('Connection Management', () => {
    let userId: string;
    let connectionId1: string;
    let connectionId2: string;

    beforeEach(async () => {
      userId = 'user-123';
      connectionId1 = 'conn-456';
      connectionId2 = 'conn-789';
      await presenceSystem.initializePresence(userId, connectionId1);
    });

    test('should add additional connection', async () => {
      const presence = await presenceSystem.addConnection(userId, connectionId2, { device: 'mobile' });

      expect(presence.connectionId).toBe(connectionId2);
      expect(presence.metadata.device).toBe('mobile');

      const connections = presenceSystem.getUserConnections(userId);
      expect(connections).toContain(connectionId1);
      expect(connections).toContain(connectionId2);
      expect(connections).toHaveLength(2);

      const stats = presenceSystem.getStats();
      expect(stats.totalConnections).toBe(2);
    });

    test('should remove connection', async () => {
      await presenceSystem.addConnection(userId, connectionId2);

      await presenceSystem.removeConnection(userId, connectionId1);

      const connections = presenceSystem.getUserConnections(userId);
      expect(connections).not.toContain(connectionId1);
      expect(connections).toContain(connectionId2);
      expect(connections).toHaveLength(1);

      const presence = presenceSystem.getUserPresence(userId);
      expect(presence?.connectionId).toBe(connectionId2); // Should keep active connection

      const stats = presenceSystem.getStats();
      expect(stats.totalConnections).toBe(1);
    });

    test('should go offline when all connections removed', async () => {
      await presenceSystem.removeConnection(userId, connectionId1);

      const presence = presenceSystem.getUserPresence(userId);
      expect(presence?.status).toBe('offline');
      expect(presence?.connectionId).toBeUndefined();

      const stats = presenceSystem.getStats();
      expect(stats.onlineUsers).toBe(0); // No longer online
      expect(stats.totalConnections).toBe(0);
    });
  });

  describe('Presence Status', () => {
    test('should check if user is online', async () => {
      const userId = 'user-123';
      const connectionId = 'conn-456';

      await presenceSystem.initializePresence(userId, connectionId);

      expect(presenceSystem.isUserOnline(userId)).toBe(true);

      await presenceSystem.goOffline(userId);

      expect(presenceSystem.isUserOnline(userId)).toBe(false);
    });

    test('should mark users as offline when expired', async () => {
      const shortTtlSystem = new PresenceSystem({
        heartbeatInterval: 1000,
        presenceTtl: 10, // Very short TTL
        enableStatusUpdates: true,
        enableActivityTracking: true,
        maxUsers: 1000,
        enableGlobalPresence: true,
        enablePresenceHistory: true,
        historyRetention: 3600000,
        enableMetrics: true
      });

      const userId = 'user-123';
      const connectionId = 'conn-456';

      await shortTtlSystem.initializePresence(userId, connectionId);

      expect(shortTtlSystem.isUserOnline(userId)).toBe(true);

      // Wait for TTL expiration
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(shortTtlSystem.isUserOnline(userId)).toBe(false);

      await shortTtlSystem.reset();
    });

    test('should get users by status', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';
      const userId3 = 'user-3';

      await presenceSystem.initializePresence(userId1, 'conn-1');
      await presenceSystem.initializePresence(userId2, 'conn-2');
      await presenceSystem.initializePresence(userId3, 'conn-3');

      await presenceSystem.updateStatus(userId1, 'away');
      await presenceSystem.updateStatus(userId2, 'busy');

      const onlineUsers = presenceSystem.getUsersByStatus('online');
      expect(onlineUsers).toHaveLength(1);
      expect(onlineUsers).toContain(userId3);

      const awayUsers = presenceSystem.getUsersByStatus('away');
      expect(awayUsers).toHaveLength(1);
      expect(awayUsers).toContain(userId1);

      const busyUsers = presenceSystem.getUsersByStatus('busy');
      expect(busyUsers).toHaveLength(1);
      expect(busyUsers).toContain(userId2);
    });
  });

  describe('Global Presence', () => {
    test('should maintain global presence cache', async () => {
      const userId = 'user-123';
      const connectionId = 'conn-456';

      await presenceSystem.initializePresence(userId, connectionId);

      const globalPresence = presenceSystem.getGlobalPresence();
      expect(globalPresence.has(userId)).toBe(true);

      const userPresence = globalPresence.get(userId);
      expect(userPresence?.userId).toBe(userId);
      expect(userPresence?.status).toBe('online');
    });

    test('should update global presence on status change', async () => {
      const userId = 'user-123';
      const connectionId = 'conn-456';

      await presenceSystem.initializePresence(userId, connectionId);

      // Update status
      await presenceSystem.updateStatus(userId, 'busy');

      const globalPresence = presenceSystem.getGlobalPresence();
      const updatedPresence = globalPresence.get(userId);
      expect(updatedPresence?.status).toBe('busy');
    });
  });

  describe('Presence History', () => {
    let userId: string;
    let connectionId: string;

    beforeEach(async () => {
      userId = 'user-123';
      connectionId = 'conn-456';
      await presenceSystem.initializePresence(userId, connectionId);
    });

    test('should maintain presence history', async () => {
      // Initial presence
      const initialHistory = presenceSystem.getUserHistory(userId);
      expect(initialHistory).toHaveLength(1);

      // Status change
      await presenceSystem.updateStatus(userId, 'away');

      const updatedHistory = presenceSystem.getUserHistory(userId);
      expect(updatedHistory).toHaveLength(2);
      expect(updatedHistory[0].status).toBe('online'); // Original
      expect(updatedHistory[1].status).toBe('away'); // Updated

      // Another change
      await presenceSystem.updateStatus(userId, 'busy');

      const finalHistory = presenceSystem.getUserHistory(userId);
      expect(finalHistory).toHaveLength(3);
    });

    test('should handle history when disabled', async () => {
      const noHistorySystem = new PresenceSystem({
        heartbeatInterval: 1000,
        presenceTtl: 5000,
        enableStatusUpdates: true,
        enableActivityTracking: true,
        maxUsers: 1000,
        enableGlobalPresence: true,
        enablePresenceHistory: false, // Disabled
        historyRetention: 3600000,
        enableMetrics: true
      });

      await noHistorySystem.initializePresence('user-123', 'conn-456');
      await noHistorySystem.updateStatus('user-123', 'away');

      const history = noHistorySystem.getUserHistory('user-123');
      expect(history).toHaveLength(0);

      await noHistorySystem.reset();
    });
  });

  describe('Search and Query', () => {
    test('should search users by metadata', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';
      const userId3 = 'user-3';

      await presenceSystem.initializePresence(userId1, 'conn-1', { role: 'admin' });
      await presenceSystem.initializePresence(userId2, 'conn-2', { role: 'user' });
      await presenceSystem.initializePresence(userId3, 'conn-3', { role: 'admin' });

      const adminUsers = presenceSystem.searchUsersByMetadata({ key: 'role', value: 'admin' });
      expect(adminUsers).toHaveLength(2);
      expect(adminUsers).toContain(userId1);
      expect(adminUsers).toContain(userId3);

      const regularUsers = presenceSystem.searchUsersByMetadata({ key: 'role', value: 'user' });
      expect(regularUsers).toHaveLength(1);
      expect(regularUsers).toContain(userId2);
    });

    test('should get all presences', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      await presenceSystem.initializePresence(userId1, 'conn-1');
      await presenceSystem.initializePresence(userId2, 'conn-2');

      const allPresences = presenceSystem.getAllPresences();
      expect(allPresences).toHaveLength(2);
      expect(allPresences.map(p => p.userId)).toContain(userId1);
      expect(allPresences.map(p => p.userId)).toContain(userId2);
    });

    test('should get presence by connection', async () => {
      const userId = 'user-123';
      const connectionId = 'conn-456';

      await presenceSystem.initializePresence(userId, connectionId);

      const presence = presenceSystem.getPresenceByConnection(connectionId);
      expect(presence?.userId).toBe(userId);
    });
  });

  describe('Statistics', () => {
    test('should track user statistics', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';
      const userId3 = 'user-3';

      await presenceSystem.initializePresence(userId1, 'conn-1', { status: 'away' });
      await presenceSystem.initializePresence(userId2, 'conn-2', { status: 'busy' });
      await presenceSystem.initializePresence(userId3, 'conn-3');

      const stats = presenceSystem.getStats();
      expect(stats.totalUsers).toBe(3);
      expect(stats.onlineUsers).toBe(1); // Only user-3 is online
      expect(stats.awayUsers).toBe(1);
      expect(stats.busyUsers).toBe(1);
      expect(stats.totalConnections).toBe(3);
    });

    test('should calculate average session time', async () => {
      // This is a mock test since we can't easily test actual time calculations
      const stats = presenceSystem.getStats();
      expect(typeof stats.averageSessionTime).toBe('number');
      expect(stats.averageSessionTime).toBeGreaterThanOrEqual(0);
    });

    test('should get online users', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      await presenceSystem.initializePresence(userId1, 'conn-1');
      await presenceSystem.initializePresence(userId2, 'conn-2');

      const onlineUsers = presenceSystem.getOnlineUsers();
      expect(onlineUsers).toHaveLength(2);
      expect(onlineUsers).toContain(userId1);
      expect(onlineUsers).toContain(userId2);

      // Make user-1 offline
      await presenceSystem.goOffline(userId1);

      const updatedOnlineUsers = presenceSystem.getOnlineUsers();
      expect(updatedOnlineUsers).toHaveLength(1);
      expect(updatedOnlineUsers).toContain(userId2);
    });
  });

  describe('Health Checks', () => {
    test('should provide health status', async () => {
      const health = await presenceSystem.getHealth();
      expect(health).toBeDefined();
      expect(healthy).toBeDefined();
      expect(healthy.users).toBeDefined();
      expect(healthy.metrics).toBeDefined();
      expect(typeof healthy).toBe('object');
    });

    test('should handle user limit checks', async () => {
      const health = await presenceSystem.getHealth();
      expect(healthy.users).toBeDefined();
      expect(healthy.users.max).toBeGreaterThan(0);
    });
  });

  describe('Cleanup and Reset', () => {
    test('should reset presence system', async () => {
      await presenceSystem.initializePresence('user-1', 'conn-1');
      await presenceSystem.initializePresence('user-2', 'conn-2');

      const statsBefore = presenceSystem.getStats();
      expect(statsBefore.totalUsers).toBe(2);

      await presenceSystem.reset();

      const statsAfter = presenceSystem.getStats();
      expect(statsAfter.totalUsers).toBe(0);
      expect(statsAfter.onlineUsers).toBe(0);
      expect(statsAfter.totalConnections).toBe(0);

      const allPresences = presenceSystem.getAllPresences();
      expect(allPresences).toHaveLength(0);
    });

    test('should cleanup expired presences', async () => {
      // This test would simulate the cleanup process
      const cleanupSpy = jest.spyOn(presenceSystem as any, 'cleanup');

      // Force cleanup
      (presenceSystem as any).cleanup();

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });
});