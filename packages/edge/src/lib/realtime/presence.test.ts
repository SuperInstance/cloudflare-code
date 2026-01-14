/**
 * Presence Tracker Tests
 * Tests user presence tracking and status management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PresenceTracker,
  PresenceHeartbeatManager,
  PresenceSyncManager,
} from './presence';
import type { PresenceStatus } from './types';

describe('PresenceTracker', () => {
  let presenceTracker: PresenceTracker;

  beforeEach(() => {
    presenceTracker = new PresenceTracker({
      onlineThreshold: 30000,
      awayThreshold: 300000,
      offlineThreshold: 600000,
      cleanupInterval: 60000,
      staleThreshold: 86400000,
    });
  });

  afterEach(() => {
    presenceTracker.destroy();
  });

  describe('connect', () => {
    it('should register user connection', () => {
      const presence = presenceTracker.connect('user_123', 'conn_456');

      expect(presence).toBeDefined();
      expect(presence.userId).toBe('user_123');
      expect(presence.status).toBe('online');
    });

    it('should update status to online on connect', () => {
      const presence = presenceTracker.connect('user_123', 'conn_456');

      expect(presence.status).toBe('online');
    });

    it('should support multiple connections per user', () => {
      presenceTracker.connect('user_123', 'conn_1');
      presenceTracker.connect('user_123', 'conn_2');

      const count = presenceTracker.getConnectionCount('user_123');
      expect(count).toBe(2);
    });

    it('should emit presence change event on connect', () => {
      const handler = vi.fn();
      presenceTracker.subscribe(handler);

      presenceTracker.connect('user_123', 'conn_456');

      expect(handler).toHaveBeenCalledWith({
        userId: 'user_123',
        oldStatus: 'offline',
        newStatus: 'online',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('disconnect', () => {
    it('should remove user connection', () => {
      presenceTracker.connect('user_123', 'conn_456');
      const presence = presenceTracker.disconnect('conn_456');

      expect(presence).toBeDefined();
      expect(presence.status).toBe('offline');
    });

    it('should mark user as offline when last connection closes', () => {
      presenceTracker.connect('user_123', 'conn_456');
      const presence = presenceTracker.disconnect('conn_456');

      expect(presence.status).toBe('offline');
    });

    it('should keep user online if other connections exist', () => {
      presenceTracker.connect('user_123', 'conn_1');
      presenceTracker.connect('user_123', 'conn_2');

      const presence = presenceTracker.disconnect('conn_1');

      expect(presence.status).toBe('online');
      expect(presenceTracker.getConnectionCount('user_123')).toBe(1);
    });

    it('should return null for non-existent connection', () => {
      const presence = presenceTracker.disconnect('non_existent');
      expect(presence).toBeNull();
    });
  });

  describe('updateActivity', () => {
    it('should update user status', () => {
      presenceTracker.connect('user_123', 'conn_456');
      const presence = presenceTracker.updateActivity('user_123', 'away' as PresenceStatus);

      expect(presence?.status).toBe('away');
    });

    it('should update custom status', () => {
      presenceTracker.connect('user_123', 'conn_456');
      const presence = presenceTracker.updateActivity('user_123', 'online', 'In a meeting');

      expect(presence?.customStatus).toBe('In a meeting');
    });

    it('should update last seen timestamp', () => {
      presenceTracker.connect('user_123', 'conn_456');

      const before = Date.now();
      presenceTracker.updateActivity('user_123');
      const presence = presenceTracker.getPresence('user_123');

      expect(presence?.lastSeen).toBeGreaterThanOrEqual(before);
    });

    it('should emit presence change event on status change', () => {
      const handler = vi.fn();
      presenceTracker.subscribe(handler);

      presenceTracker.connect('user_123', 'conn_456');
      presenceTracker.updateActivity('user_123', 'away' as PresenceStatus);

      expect(handler).toHaveBeenCalledWith({
        userId: 'user_123',
        oldStatus: 'online',
        newStatus: 'away',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('getPresence', () => {
    it('should return user presence', () => {
      presenceTracker.connect('user_123', 'conn_456');
      const presence = presenceTracker.getPresence('user_123');

      expect(presence).toBeDefined();
      expect(presence?.userId).toBe('user_123');
      expect(presence?.status).toBe('online');
    });

    it('should return null for non-existent user', () => {
      const presence = presenceTracker.getPresence('non_existent');
      expect(presence).toBeNull();
    });
  });

  describe('getPresenceBatch', () => {
    it('should return presence for multiple users', () => {
      presenceTracker.connect('user_1', 'conn_1');
      presenceTracker.connect('user_2', 'conn_2');
      presenceTracker.connect('user_3', 'conn_3');

      const presenceMap = presenceTracker.getPresenceBatch(['user_1', 'user_2', 'user_3']);

      expect(presenceMap.size).toBe(3);
      expect(presenceMap.get('user_1')).toBeDefined();
      expect(presenceMap.get('user_2')).toBeDefined();
      expect(presenceMap.get('user_3')).toBeDefined();
    });

    it('should skip non-existent users', () => {
      presenceTracker.connect('user_1', 'conn_1');

      const presenceMap = presenceTracker.getPresenceBatch(['user_1', 'non_existent']);

      expect(presenceMap.size).toBe(1);
      expect(presenceMap.has('user_1')).toBe(true);
      expect(presenceMap.has('non_existent')).toBe(false);
    });
  });

  describe('getOnlineUsers', () => {
    it('should return all online users', () => {
      presenceTracker.connect('user_1', 'conn_1');
      presenceTracker.connect('user_2', 'conn_2');
      presenceTracker.updateActivity('user_1', 'away' as PresenceStatus);

      const onlineUsers = presenceTracker.getOnlineUsers();

      expect(onlineUsers).toHaveLength(2);
    });

    it('should not include offline users', () => {
      presenceTracker.connect('user_1', 'conn_1');
      presenceTracker.updateActivity('user_1', 'offline' as PresenceStatus);

      const onlineUsers = presenceTracker.getOnlineUsers();

      expect(onlineUsers).toHaveLength(0);
    });
  });

  describe('isOnline', () => {
    it('should return true for online users', () => {
      presenceTracker.connect('user_123', 'conn_456');

      expect(presenceTracker.isOnline('user_123')).toBe(true);
    });

    it('should return false for offline users', () => {
      presenceTracker.connect('user_123', 'conn_456');
      presenceTracker.updateActivity('user_123', 'offline' as PresenceStatus);

      expect(presenceTracker.isOnline('user_123')).toBe(false);
    });

    it('should return false for non-existent users', () => {
      expect(presenceTracker.isOnline('non_existent')).toBe(false);
    });
  });

  describe('getConnectionCount', () => {
    it('should return connection count for user', () => {
      presenceTracker.connect('user_123', 'conn_1');
      presenceTracker.connect('user_123', 'conn_2');
      presenceTracker.connect('user_123', 'conn_3');

      expect(presenceTracker.getConnectionCount('user_123')).toBe(3);
    });

    it('should return 0 for users with no connections', () => {
      expect(presenceTracker.getConnectionCount('user_123')).toBe(0);
    });
  });

  describe('getConnectionIds', () => {
    it('should return all connection IDs for user', () => {
      presenceTracker.connect('user_123', 'conn_1');
      presenceTracker.connect('user_123', 'conn_2');

      const connectionIds = presenceTracker.getConnectionIds('user_123');

      expect(connectionIds).toHaveLength(2);
      expect(connectionIds).toContain('conn_1');
      expect(connectionIds).toContain('conn_2');
    });
  });

  describe('updateCapabilities', () => {
    it('should update user capabilities', () => {
      presenceTracker.connect('user_123', 'conn_456');

      const updated = presenceTracker.updateCapabilities('user_123', ['read', 'write', 'admin']);

      expect(updated).toBe(true);

      const presence = presenceTracker.getPresence('user_123');
      expect(presence?.capabilities).toEqual(['read', 'write', 'admin']);
    });

    it('should return false for non-existent user', () => {
      const updated = presenceTracker.updateCapabilities('non_existent', ['read']);
      expect(updated).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('should subscribe to presence changes', () => {
      const handler = vi.fn();
      const unsubscribe = presenceTracker.subscribe(handler);

      presenceTracker.connect('user_123', 'conn_456');

      expect(handler).toHaveBeenCalled();

      unsubscribe();
      presenceTracker.connect('user_456', 'conn_789');

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStats', () => {
    it('should return presence statistics', () => {
      presenceTracker.connect('user_1', 'conn_1');
      presenceTracker.connect('user_2', 'conn_2');
      presenceTracker.updateActivity('user_1', 'away' as PresenceStatus);
      presenceTracker.connect('user_3', 'conn_3');
      presenceTracker.updateActivity('user_3', 'busy' as PresenceStatus);

      const stats = presenceTracker.getStats();

      expect(stats.totalUsers).toBe(3);
      expect(stats.onlineUsers).toBe(3); // busy counts as online
      expect(stats.awayUsers).toBe(1);
      expect(stats.totalConnections).toBe(3);
    });
  });

  describe('getRoomPresenceSummary', () => {
    it('should return presence summary for room', () => {
      presenceTracker.connect('user_1', 'conn_1');
      presenceTracker.connect('user_2', 'conn_2');
      presenceTracker.connect('user_3', 'conn_3');
      presenceTracker.updateActivity('user_1', 'away' as PresenceStatus);

      const roomMembers = ['user_1', 'user_2', 'user_3', 'user_4'];
      const summary = presenceTracker.getRoomPresenceSummary('room_123', roomMembers);

      expect(summary.total).toBe(4);
      expect(summary.online).toBe(2);
      expect(summary.away).toBe(1);
      expect(summary.offline).toBe(1);
      expect(summary.users).toHaveLength(4);
    });
  });

  describe('export and import', () => {
    it('should export presence state', () => {
      presenceTracker.connect('user_123', 'conn_456');
      presenceTracker.updateActivity('user_123', 'away' as PresenceStatus, 'Custom status');

      const exported = presenceTracker.export();

      expect(exported['user_123']).toBeDefined();
      expect(exported['user_123'].status).toBe('away');
      expect(exported['user_123'].customStatus).toBe('Custom status');
    });

    it('should import presence state', () => {
      const data = {
        user_123: {
          status: 'away' as PresenceStatus,
          customStatus: 'Away',
          lastSeen: Date.now(),
          capabilities: ['read', 'write'],
        },
      };

      presenceTracker.import(data);

      const presence = presenceTracker.getPresence('user_123');
      expect(presence).toBeDefined();
      expect(presence?.status).toBe('away');
    });
  });
});

describe('PresenceHeartbeatManager', () => {
  let heartbeatManager: PresenceHeartbeatManager;

  beforeEach(() => {
    heartbeatManager = new PresenceHeartbeatManager(
      {
        heartbeatInterval: 30000,
        heartbeatTimeout: 60000,
      },
      vi.fn()
    );
  });

  afterEach(() => {
    heartbeatManager.clear();
  });

  describe('recordHeartbeat', () => {
    it('should record heartbeat for user', () => {
      heartbeatManager.recordHeartbeat('user_123');

      const timeSince = heartbeatManager.getTimeSinceLastHeartbeat('user_123');
      expect(timeSince).toBeGreaterThanOrEqual(0);
      expect(timeSince).toBeLessThan(100);
    });

    it('should reset missed heartbeats', () => {
      heartbeatManager.recordHeartbeat('user_123');
      heartbeatManager.recordHeartbeat('user_123');

      const timeSince = heartbeatManager.getTimeSinceLastHeartbeat('user_123');
      expect(timeSince).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkTimeouts', () => {
    it('should detect timed out users', () => {
      vi.useFakeTimers();

      const onTimeout = vi.fn();
      const manager = new PresenceHeartbeatManager(
        {
          heartbeatInterval: 1000,
          heartbeatTimeout: 2000,
        },
        onTimeout
      );

      manager.recordHeartbeat('user_123');

      // Advance time past timeout
      vi.advanceTimersByTime(3000);

      const timeouts = manager.checkTimeouts();

      expect(timeouts).toContain('user_123');
      expect(onTimeout).toHaveBeenCalledWith('user_123');

      vi.useRealTimers();
    });
  });

  describe('getTimeSinceLastHeartbeat', () => {
    it('should return time since last heartbeat', () => {
      vi.useFakeTimers();

      heartbeatManager.recordHeartbeat('user_123');

      vi.advanceTimersByTime(1000);

      const timeSince = heartbeatManager.getTimeSinceLastHeartbeat('user_123');
      expect(timeSince).toBeGreaterThanOrEqual(1000);

      vi.useRealTimers();
    });

    it('should return null for user with no heartbeat', () => {
      const timeSince = heartbeatManager.getTimeSinceLastHeartbeat('non_existent');
      expect(timeSince).toBeNull();
    });
  });

  describe('removeUser', () => {
    it('should remove user from tracking', () => {
      heartbeatManager.recordHeartbeat('user_123');

      heartbeatManager.removeUser('user_123');

      const timeSince = heartbeatManager.getTimeSinceLastHeartbeat('user_123');
      expect(timeSince).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all tracking', () => {
      heartbeatManager.recordHeartbeat('user_1');
      heartbeatManager.recordHeartbeat('user_2');

      heartbeatManager.clear();

      expect(heartbeatManager.getTimeSinceLastHeartbeat('user_1')).toBeNull();
      expect(heartbeatManager.getTimeSinceLastHeartbeat('user_2')).toBeNull();
    });
  });
});

describe('PresenceSyncManager', () => {
  let syncManager: PresenceSyncManager;
  let localPresence: PresenceTracker;

  beforeEach(() => {
    localPresence = new PresenceTracker();
    syncManager = new PresenceSyncManager(localPresence, 5000);
  });

  afterEach(() => {
    syncManager.destroy();
    localPresence.destroy();
  });

  describe('start and stop', () => {
    it('should start sync timer', () => {
      expect(() => syncManager.start()).not.toThrow();
    });

    it('should stop sync timer', () => {
      syncManager.start();
      expect(() => syncManager.stop()).not.toThrow();
    });
  });

  describe('getCombinedPresence', () => {
    it('should get presence from local tracker', () => {
      localPresence.connect('user_123', 'conn_456');

      const presence = syncManager.getCombinedPresence('user_123');

      expect(presence).toBeDefined();
      expect(presence?.userId).toBe('user_123');
    });

    it('should return null for non-existent user', () => {
      const presence = syncManager.getCombinedPresence('non_existent');
      expect(presence).toBeNull();
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      syncManager.start();
      expect(() => syncManager.destroy()).not.toThrow();
    });
  });
});
