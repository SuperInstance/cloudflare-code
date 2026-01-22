/**
 * Presence Tracking System
 * Tracks user online/offline status across sessions
 */

import type {
  Presence,
  PresenceStatus,
  ConnectedUser,
  PresenceUpdateMessage,
  MessageType,
} from './types';
import { generateId } from '../utils';

/**
 * Presence configuration
 */
interface PresenceConfig {
  // Time thresholds (in milliseconds)
  onlineThreshold: number;
  awayThreshold: number;
  offlineThreshold: number;

  // Cleanup
  cleanupInterval: number;
  staleThreshold: number;

  // Heartbeat
  heartbeatInterval: number;
  heartbeatTimeout: number;
}

/**
 * Presence change event
 */
export interface PresenceChangeEvent {
  userId: string;
  oldStatus: PresenceStatus;
  newStatus: PresenceStatus;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Presence tracker class
 */
export class PresenceTracker {
  private presence: Map<string, Presence>;
  private connections: Map<string, Set<string>>; // userId -> connectionIds
  private connectionUsers: Map<string, string>; // connectionId -> userId
  private lastActivity: Map<string, number>; // userId -> last activity
  private config: PresenceConfig;
  private handlers: Set<(event: PresenceChangeEvent) => void>;
  private cleanupTimer: ReturnType<typeof setInterval> | null;

  constructor(config?: Partial<PresenceConfig>) {
    this.presence = new Map();
    this.connections = new Map();
    this.connectionUsers = new Map();
    this.lastActivity = new Map();
    this.handlers = new Set();

    this.config = {
      onlineThreshold: config?.onlineThreshold ?? 30 * 1000, // 30 seconds
      awayThreshold: config?.awayThreshold ?? 5 * 60 * 1000, // 5 minutes
      offlineThreshold: config?.offlineThreshold ?? 10 * 60 * 1000, // 10 minutes
      cleanupInterval: config?.cleanupInterval ?? 60 * 1000, // 1 minute
      staleThreshold: config?.staleThreshold ?? 24 * 60 * 60 * 1000, // 24 hours
      heartbeatInterval: config?.heartbeatInterval ?? 30 * 1000, // 30 seconds
      heartbeatTimeout: config?.heartbeatTimeout ?? 60 * 1000, // 1 minute
    };

    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Register user connection
   */
  connect(userId: string, connectionId: string, metadata: Record<string, unknown> = {}): Presence {
    const now = Date.now();

    // Add to connections
    let userConnections = this.connections.get(userId);
    if (!userConnections) {
      userConnections = new Set();
      this.connections.set(userId, userConnections);
    }
    userConnections.add(connectionId);
    this.connectionUsers.set(connectionId, userId);

    // Update last activity
    this.lastActivity.set(userId, now);

    // Get or create presence
    let presence = this.presence.get(userId);
    const oldStatus = presence?.status ?? ('offline' as PresenceStatus);

    if (!presence) {
      presence = {
        userId,
        status: 'online' as PresenceStatus,
        lastSeen: now,
        capabilities: (metadata.capabilities as string[]) ?? [],
      };
      this.presence.set(userId, presence);
    } else {
      presence.status = 'online' as PresenceStatus;
      presence.lastSeen = now;
    }

    // Emit presence change event
    if (oldStatus !== 'online') {
      this.emitChangeEvent({
        userId,
        oldStatus,
        newStatus: 'online' as PresenceStatus,
        timestamp: now,
      });
    }

    return presence;
  }

  /**
   * Disconnect user connection
   */
  disconnect(connectionId: string): Presence | null {
    const userId = this.connectionUsers.get(connectionId);
    if (!userId) {
      return null;
    }

    const userConnections = this.connections.get(userId);
    if (!userConnections) {
      return null;
    }

    // Remove connection
    userConnections.delete(connectionId);
    this.connectionUsers.delete(connectionId);

    const now = Date.now();

    // If no more connections, mark as offline
    if (userConnections.size === 0) {
      this.connections.delete(userId);
      const presence = this.presence.get(userId);

      if (presence) {
        const oldStatus = presence.status;
        presence.status = 'offline' as PresenceStatus;
        presence.lastSeen = now;

        this.emitChangeEvent({
          userId,
          oldStatus,
          newStatus: 'offline' as PresenceStatus,
          timestamp: now,
        });

        return presence;
      }
    }

    return this.presence.get(userId) ?? null;
  }

  /**
   * Update user activity
   */
  updateActivity(userId: string, status?: PresenceStatus, customStatus?: string): Presence | null {
    const presence = this.presence.get(userId);
    if (!presence) {
      return null;
    }

    const oldStatus = presence.status;
    const now = Date.now();

    this.lastActivity.set(userId, now);

    if (status) {
      presence.status = status;
    }

    if (customStatus !== undefined) {
      presence.customStatus = customStatus;
    }

    presence.lastSeen = now;

    // Emit event if status changed
    if (oldStatus !== presence.status) {
      this.emitChangeEvent({
        userId,
        oldStatus,
        newStatus: presence.status,
        timestamp: now,
      });
    }

    return presence;
  }

  /**
   * Get user presence
   */
  getPresence(userId: string): Presence | null {
    return this.presence.get(userId) ?? null;
  }

  /**
   * Get multiple users' presence
   */
  getPresenceBatch(userIds: string[]): Map<string, Presence> {
    const result = new Map<string, Presence>();

    for (const userId of userIds) {
      const presence = this.presence.get(userId);
      if (presence) {
        result.set(userId, presence);
      }
    }

    return result;
  }

  /**
   * Get all online users
   */
  getOnlineUsers(): Presence[] {
    return Array.from(this.presence.values()).filter(p => p.status === 'online');
  }

  /**
   * Get all users in a room
   */
  getUsersInRoom(roomId: string, roomMembers: string[]): Presence[] {
    return roomMembers
      .map(userId => this.presence.get(userId))
      .filter((p): p is Presence => p !== undefined && p.status !== 'offline');
  }

  /**
   * Check if user is online
   */
  isOnline(userId: string): boolean {
    const presence = this.presence.get(userId);
    return presence?.status === 'online';
  }

  /**
   * Get user connection count
   */
  getConnectionCount(userId: string): number {
    const connections = this.connections.get(userId);
    return connections ? connections.size : 0;
  }

  /**
   * Get user connection IDs
   */
  getConnectionIds(userId: string): string[] {
    const connections = this.connections.get(userId);
    return connections ? Array.from(connections) : [];
  }

  /**
   * Update user capabilities
   */
  updateCapabilities(userId: string, capabilities: string[]): boolean {
    const presence = this.presence.get(userId);
    if (!presence) {
      return false;
    }

    presence.capabilities = capabilities;
    return true;
  }

  /**
   * Subscribe to presence changes
   */
  subscribe(handler: (event: PresenceChangeEvent) => void): () => void {
    this.handlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalUsers: number;
    onlineUsers: number;
    awayUsers: number;
    offlineUsers: number;
    totalConnections: number;
  } {
    let online = 0;
    let away = 0;
    let offline = 0;

    for (const presence of this.presence.values()) {
      switch (presence.status) {
        case 'online':
          online++;
          break;
        case 'away':
          away++;
          break;
        case 'offline':
          offline++;
          break;
        case 'busy':
          online++; // Count busy as online
          break;
      }
    }

    const totalConnections = Array.from(this.connections.values()).reduce(
      (sum, conns) => sum + conns.size,
      0
    );

    return {
      totalUsers: this.presence.size,
      onlineUsers: online,
      awayUsers: away,
      offlineUsers: offline,
      totalConnections,
    };
  }

  /**
   * Emit presence change event
   */
  private emitChangeEvent(event: PresenceChangeEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in presence change handler:', error);
      }
    }
  }

  /**
   * Cleanup stale presence data
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [userId, presence] of this.presence.entries()) {
      const timeSinceActivity = now - (this.lastActivity.get(userId) ?? presence.lastSeen);

      // Auto-update status based on inactivity
      if (presence.status === 'online' && timeSinceActivity > this.config.awayThreshold) {
        this.updateActivity(userId, 'away');
      } else if (
        presence.status !== 'offline' &&
        timeSinceActivity > this.config.offlineThreshold
      ) {
        this.updateActivity(userId, 'offline');
      }

      // Remove stale entries
      if (timeSinceActivity > this.config.staleThreshold) {
        this.presence.delete(userId);
        this.lastActivity.delete(userId);
        this.connections.delete(userId);
      }
    }
  }

  /**
   * Destroy tracker and cleanup
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.presence.clear();
    this.connections.clear();
    this.connectionUsers.clear();
    this.lastActivity.clear();
    this.handlers.clear();
  }

  /**
   * Export presence state
   */
  export(): Record<string, Omit<Presence, 'userId'>> {
    const exportData: Record<string, Omit<Presence, 'userId'>> = {};

    for (const [userId, presence] of this.presence.entries()) {
      exportData[userId] = {
        status: presence.status,
        customStatus: presence.customStatus,
        lastSeen: presence.lastSeen,
        currentRoom: presence.currentRoom,
        capabilities: presence.capabilities,
      };
    }

    return exportData;
  }

  /**
   * Import presence state
   */
  import(data: Record<string, Omit<Presence, 'userId'>>): void {
    for (const [userId, presenceData] of Object.entries(data)) {
      this.presence.set(userId, {
        userId,
        ...presenceData,
      });
      this.lastActivity.set(userId, presenceData.lastSeen);
    }
  }

  /**
   * Get presence summary for room
   */
  getRoomPresenceSummary(roomId: string, roomMembers: string[]): {
    total: number;
    online: number;
    away: number;
    offline: number;
    users: Array<{ userId: string; status: PresenceStatus; customStatus?: string }>;
  } {
    let online = 0;
    let away = 0;
    let offline = 0;
    const users: Array<{ userId: string; status: PresenceStatus; customStatus?: string }> = [];

    for (const userId of roomMembers) {
      const presence = this.presence.get(userId);
      if (presence) {
        users.push({
          userId,
          status: presence.status,
          customStatus: presence.customStatus,
        });

        switch (presence.status) {
          case 'online':
          case 'busy':
            online++;
            break;
          case 'away':
            away++;
            break;
          case 'offline':
            offline++;
            break;
        }
      } else {
        users.push({
          userId,
          status: 'offline' as PresenceStatus,
        });
        offline++;
      }
    }

    return {
      total: roomMembers.length,
      online,
      away,
      offline,
      users,
    };
  }
}

/**
 * Presence heartbeat manager
 */
export class PresenceHeartbeatManager {
  private lastHeartbeat: Map<string, number>;
  private missedHeartbeats: Map<string, number>;
  private config: PresenceConfig;
  private onTimeout?: (userId: string) => void;

  constructor(config: PresenceConfig, onTimeout?: (userId: string) => void) {
    this.lastHeartbeat = new Map();
    this.missedHeartbeats = new Map();
    this.config = config;
    this.onTimeout = onTimeout;
  }

  /**
   * Record heartbeat for user
   */
  recordHeartbeat(userId: string): void {
    const now = Date.now();
    this.lastHeartbeat.set(userId, now);
    this.missedHeartbeats.delete(userId);
  }

  /**
   * Check for timeouts
   */
  checkTimeouts(): string[] {
    const now = Date.now();
    const timeouts: string[] = [];

    for (const [userId, lastBeat] of this.lastHeartbeat.entries()) {
      const timeSince = now - lastBeat;

      if (timeSince > this.config.heartbeatTimeout) {
        timeouts.push(userId);

        if (this.onTimeout) {
          this.onTimeout(userId);
        }

        this.lastHeartbeat.delete(userId);
        this.missedHeartbeats.delete(userId);
      }
    }

    return timeouts;
  }

  /**
   * Get time since last heartbeat
   */
  getTimeSinceLastHeartbeat(userId: string): number | null {
    const lastBeat = this.lastHeartbeat.get(userId);
    return lastBeat ? Date.now() - lastBeat : null;
  }

  /**
   * Remove user from tracking
   */
  removeUser(userId: string): void {
    this.lastHeartbeat.delete(userId);
    this.missedHeartbeats.delete(userId);
  }

  /**
   * Clear all tracking
   */
  clear(): void {
    this.lastHeartbeat.clear();
    this.missedHeartbeats.clear();
  }
}

/**
 * Presence sync manager for multi-server scenarios
 */
export class PresenceSyncManager {
  private localPresence: PresenceTracker;
  private remotePresence: Map<string, Presence>; // serverId -> Map<userId, Presence>
  private syncInterval: number;
  private syncTimer: ReturnType<typeof setInterval> | null;

  constructor(localPresence: PresenceTracker, syncInterval: number = 5000) {
    this.localPresence = localPresence;
    this.remotePresence = new Map();
    this.syncInterval = syncInterval;
    this.syncTimer = null;
  }

  /**
   * Start sync timer
   */
  start(): void {
    if (this.syncTimer) {
      return;
    }

    this.syncTimer = setInterval(() => {
      this.sync();
    }, this.syncInterval);
  }

  /**
   * Stop sync timer
   */
  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Sync presence with remote servers
   */
  private async sync(): Promise<void> {
    // In a real implementation, this would sync with other servers via Durable Objects or a message queue
    const localData = this.localPresence.export();

    // Simulate sync by storing in remote presence map
    // In production, this would make HTTP requests or use Durable Objects
  }

  /**
   * Get combined presence (local + remote)
   */
  getCombinedPresence(userId: string): Presence | null {
    // Check local first
    const local = this.localPresence.getPresence(userId);
    if (local) {
      return local;
    }

    // Check remote
    for (const serverPresence of this.remotePresence.values()) {
      const presence = serverPresence.get(userId);
      if (presence) {
        return presence;
      }
    }

    return null;
  }

  /**
   * Destroy sync manager
   */
  destroy(): void {
    this.stop();
    this.remotePresence.clear();
  }
}
