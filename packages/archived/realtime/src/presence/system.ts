// @ts-nocheck
/**
 * Presence System - Advanced user presence tracking
 * Manages online/offline status, activity tracking, and presence events
 */

import { UserPresence, PresenceStatus, PresenceEvent } from '../types';
import {
  IdGenerator,
  PerformanceTimer,
  EventBus,
  LRUCache,
  HealthChecker
} from '../utils';
import { Logger } from '@claudeflare/logger';

export interface PresenceConfig {
  heartbeatInterval: number;
  presenceTtl: number;
  enableStatusUpdates: boolean;
  enableActivityTracking: boolean;
  maxUsers: number;
  enableGlobalPresence: boolean;
  enablePresenceHistory: boolean;
  historyRetention: number;
  enableMetrics: boolean;
}

export interface PresenceOptions {
  status?: PresenceStatus;
  metadata?: Record<string, any>;
  connectionId?: string;
  autoRefresh?: boolean;
}

export interface PresenceStats {
  totalUsers: number;
  onlineUsers: number;
  awayUsers: number;
  busyUsers: number;
  averageSessionTime: number;
  totalConnections: number;
}

export class PresenceSystem {
  private config: PresenceConfig;
  private users = new Map<string, UserPresence>();
  private connections = new Map<string, string>(); // connectionId -> userId
  private globalPresence: LRUCache<string, UserPresence>;
  private eventBus: EventBus;
  private logger: Logger;
  private metrics: {
    totalUsers: number;
    onlineUsers: number;
    awayUsers: number;
    busyUsers: number;
    totalConnections: number;
    totalEvents: number;
    averageSessionTime: number;
  };
  private presenceHistory: Map<string, UserPresence[]>;
  private healthChecker: HealthChecker;
  private heartbeatTimers = new Map<string, NodeJS.Timeout>();

  constructor(config: Partial<PresenceConfig> = {}, logger?: Logger) {
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      presenceTtl: 300000, // 5 minutes
      enableStatusUpdates: true,
      enableActivityTracking: true,
      maxUsers: 100000,
      enableGlobalPresence: true,
      enablePresenceHistory: true,
      historyRetention: 86400000, // 24 hours
      enableMetrics: true,
      ...config
    };

    this.logger = logger || new Logger('PresenceSystem');
    this.eventBus = new EventBus();
    this.globalPresence = new LRUCache(this.config.maxUsers);
    this.presenceHistory = new Map();

    this.metrics = {
      totalUsers: 0,
      onlineUsers: 0,
      awayUsers: 0,
      busyUsers: 0,
      totalConnections: 0,
      totalEvents: 0,
      averageSessionTime: 0
    };

    this.healthChecker = new HealthChecker(30000);
    this.healthChecker.addCheck('presence-memory', () => this.checkMemoryUsage());
    this.healthChecker.addCheck('presence-user-limits', () => this.checkUserLimits());
    this.healthChecker.start();

    this.startCleanup();
    this.startHeartbeatMonitoring();
  }

  /**
   * Initialize user presence
   */
  public async initializePresence(
    userId: string,
    connectionId: string,
    options: PresenceOptions = {}
  ): Promise<UserPresence> {
    try {
      await PerformanceTimer.measure('presence-initialize', async () => {
        // Check user limit
        if (this.users.size >= this.config.maxUsers) {
          throw new Error(`User limit exceeded: ${this.config.maxUsers} max`);
        }

        // Check if user already exists
        if (this.users.has(userId)) {
          await this.updateConnection(userId, connectionId);
        }

        const now = Date.now();
        const presence: UserPresence = {
          userId,
          status: options.status || 'online',
          lastActivity: now,
          connectionId,
          metadata: options.metadata || {}
        };

        // Update user presence
        this.users.set(userId, presence);
        this.connections.set(connectionId, userId);

        // Update global presence
        if (this.config.enableGlobalPresence) {
          this.globalPresence.set(userId, presence);
        }

        // Update metrics
        this.updateMetrics(presence.status);

        // Add to history
        if (this.config.enablePresenceHistory) {
          this.addToHistory(userId, presence);
        }

        this.logger.info('User presence initialized', {
          userId,
          connectionId,
          status: presence.status,
          isFirstTime: !this.users.has(userId)
        });

        // Emit presence event
        const event: PresenceEvent = {
          type: 'join',
          userId,
          presence,
          timestamp: now
        };

        this.emitPresenceEvent(event);

        // Set heartbeat timer if auto-refresh enabled
        if (options.autoRefresh !== false) {
          this.setHeartbeatTimer(userId, connectionId);
        }

        return presence;
      });

    } catch (error) {
      this.logger.error('Failed to initialize presence', error, { userId, connectionId });
      throw error;
    }
  }

  /**
   * Update user status
   */
  public async updateStatus(
    userId: string,
    newStatus: PresenceStatus,
    metadata?: Record<string, any>
  ): Promise<UserPresence> {
    try {
      await PerformanceTimer.measure('presence-update-status', async () => {
        const presence = this.users.get(userId);
        if (!presence) {
          throw new Error(`User not found: ${userId}`);
        }

        const oldStatus = presence.status;
        const now = Date.now();

        // Update presence
        presence.status = newStatus;
        if (metadata) {
          presence.metadata = { ...presence.metadata, ...metadata };
        }

        // Update last activity
        if (this.config.enableActivityTracking) {
          presence.lastActivity = now;
        }

        // Update global presence
        if (this.config.enableGlobalPresence) {
          this.globalPresence.set(userId, presence);
        }

        // Update metrics
        this.updateMetricsForStatusChange(oldStatus, newStatus);

        // Add to history
        if (this.config.enablePresenceHistory) {
          this.addToHistory(userId, presence);
        }

        this.logger.info('User status updated', {
          userId,
          oldStatus,
          newStatus,
          timestamp: now
        });

        // Emit presence event
        const event: PresenceEvent = {
          type: 'update',
          userId,
          presence,
          timestamp: now
        };

        this.emitPresenceEvent(event);

        return presence;
      });

    } catch (error) {
      this.logger.error('Failed to update status', error, { userId, newStatus });
      throw error;
    }
  }

  /**
   * Update user activity
   */
  public async updateActivity(userId: string, metadata?: Record<string, any>): Promise<UserPresence> {
    try {
      if (!this.config.enableActivityTracking) {
        throw new Error('Activity tracking is disabled');
      }

      const presence = this.users.get(userId);
      if (!presence) {
        throw new Error(`User not found: ${userId}`);
      }

      const now = Date.now();

      // Update activity
      presence.lastActivity = now;
      if (metadata) {
        presence.metadata = { ...presence.metadata, ...metadata };
      }

      // Update global presence
      if (this.config.enableGlobalPresence) {
        this.globalPresence.set(userId, presence);
      }

      this.logger.debug('User activity updated', {
        userId,
        timestamp: now
      });

      return presence;

    } catch (error) {
      this.logger.error('Failed to update activity', error, { userId });
      throw error;
    }
  }

  /**
   * Add user connection
   */
  public async addConnection(userId: string, connectionId: string, metadata?: Record<string, any>): Promise<UserPresence> {
    try {
      await PerformanceTimer.measure('presence-add-connection', async () => {
        const presence = this.users.get(userId);
        if (!presence) {
          throw new Error(`User not found: ${userId}`);
        }

        // Update connection
        presence.connectionId = connectionId;
        presence.metadata = { ...presence.metadata, ...metadata };

        this.connections.set(connectionId, userId);

        // Update global presence
        if (this.config.enableGlobalPresence) {
          this.globalPresence.set(userId, presence);
        }

        this.metrics.totalConnections++;

        this.logger.debug('User connection added', {
          userId,
          connectionId
        });

        return presence;
      });

    } catch (error) {
      this.logger.error('Failed to add connection', error, { userId, connectionId });
      throw error;
    }
  }

  /**
   * Update user connection
   */
  private async updateConnection(userId: string, connectionId: string): Promise<void> {
    const presence = this.users.get(userId)!;
    presence.connectionId = connectionId;
    this.connections.set(connectionId, userId);

    // Update global presence
    if (this.config.enableGlobalPresence) {
      this.globalPresence.set(userId, presence);
    }

    this.logger.debug('User connection updated', {
      userId,
      connectionId
    });
  }

  /**
   * Remove user connection
   */
  public async removeConnection(userId: string, connectionId: string): Promise<void> {
    try {
      await PerformanceTimer.measure('presence-remove-connection', async () => {
        const presence = this.users.get(userId);
        if (!presence) {
          throw new Error(`User not found: ${userId}`);
        }

        // Remove connection
        if (presence.connectionId === connectionId) {
          presence.connectionId = undefined;
        }

        this.connections.delete(connectionId);

        // Update global presence
        if (this.config.enableGlobalPresence) {
          this.globalPresence.set(userId, presence);
        }

        this.metrics.totalConnections--;

        this.logger.debug('User connection removed', {
          userId,
          connectionId
        });

        // Check if user should go offline
        const userConnections = this.getUserConnections(userId);
        if (userConnections.length === 0) {
          await this.goOffline(userId);
        }
      });

    } catch (error) {
      this.logger.error('Failed to remove connection', error, { userId, connectionId });
      throw error;
    }
  }

  /**
   * Go offline
   */
  public async goOffline(userId: string): Promise<void> {
    try {
      const presence = this.users.get(userId);
      if (!presence) {
        throw new Error(`User not found: ${userId}`);
      }

      const oldStatus = presence.status;
      const now = Date.now();

      // Update status to offline
      presence.status = 'offline';
      presence.connectionId = undefined;

      // Update global presence
      if (this.config.enableGlobalPresence) {
        this.globalPresence.set(userId, presence);
      }

      // Update metrics
      this.updateMetricsForStatusChange(oldStatus, 'offline');

      // Add to history
      if (this.config.enablePresenceHistory) {
        this.addToHistory(userId, presence);
      }

      // Clear heartbeat timer
      this.clearHeartbeatTimer(userId);

      this.logger.info('User went offline', {
        userId,
        oldStatus,
        timestamp: now
      });

      // Emit presence event
      const event: PresenceEvent = {
        type: 'leave',
        userId,
        presence,
        timestamp: now
      };

      this.emitPresenceEvent(event);

    } catch (error) {
      this.logger.error('Failed to go offline', error, { userId });
      throw error;
    }
  }

  /**
   * Get user presence
   */
  public getUserPresence(userId: string): UserPresence | undefined {
    return this.users.get(userId);
  }

  /**
   * Get user connections
   */
  public getUserConnections(userId: string): string[] {
    const connections: string[] = [];
    for (const [connectionId, userId_] of this.connections) {
      if (userId_ === userId) {
        connections.push(connectionId);
      }
    }
    return connections;
  }

  /**
   * Get presence by connection
   */
  public getPresenceByConnection(connectionId: string): UserPresence | undefined {
    const userId = this.connections.get(connectionId);
    return userId ? this.users.get(userId) : undefined;
  }

  /**
   * Get all presences
   */
  public getAllPresences(): UserPresence[] {
    return Array.from(this.users.values());
  }

  /**
   * Get global presence
   */
  public getGlobalPresence(): Map<string, UserPresence> {
    return new Map(this.globalPresence.cache);
  }

  /**
   * Get user presence history
   */
  public getUserHistory(userId: string): UserPresence[] {
    return this.presenceHistory.get(userId) || [];
  }

  /**
   * Get presence statistics
   */
  public getStats(): PresenceStats {
    return {
      totalUsers: this.metrics.totalUsers,
      onlineUsers: this.metrics.onlineUsers,
      awayUsers: this.metrics.awayUsers,
      busyUsers: this.metrics.busyUsers,
      averageSessionTime: this.metrics.averageSessionTime,
      totalConnections: this.metrics.totalConnections
    };
  }

  /**
   * Check if user is online
   */
  public isUserOnline(userId: string): boolean {
    const presence = this.users.get(userId);
    if (!presence) return false;

    if (presence.status === 'offline') return false;

    // Check if presence is expired
    if (this.config.presenceTtl > 0) {
      const expired = Date.now() - presence.lastActivity > this.config.presenceTtl;
      if (expired) {
        this.goOffline(userId).catch(error => {
          this.logger.error('Failed to set user offline due to expiry', error, { userId });
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Get online users
   */
  public getOnlineUsers(): string[] {
    const online: string[] = [];
    for (const [userId, presence] of this.users) {
      if (this.isUserOnline(userId)) {
        online.push(userId);
      }
    }
    return online;
  }

  /**
   * Get users by status
   */
  public getUsersByStatus(status: PresenceStatus): string[] {
    const users: string[] = [];
    for (const [userId, presence] of this.users) {
      if (presence.status === status) {
        users.push(userId);
      }
    }
    return users;
  }

  /**
   * Search users by metadata
   */
  public searchUsersByMetadata(query: { key: string; value: any }): string[] {
    const users: string[] = [];
    for (const [userId, presence] of this.users) {
      if (presence.metadata && presence.metadata[query.key] === query.value) {
        users.push(userId);
      }
    }
    return users;
  }

  /**
   * Set heartbeat timer
   */
  private setHeartbeatTimer(userId: string, connectionId: string): void {
    if (this.heartbeatTimers.has(userId)) {
      this.clearHeartbeatTimer(userId);
    }

    const timer = setInterval(() => {
      this.checkUserActivity(userId, connectionId);
    }, this.config.heartbeatInterval);

    this.heartbeatTimers.set(userId, timer);
  }

  /**
   * Clear heartbeat timer
   */
  private clearHeartbeatTimer(userId: string): void {
    const timer = this.heartbeatTimers.get(userId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(userId);
    }
  }

  /**
   * Check user activity
   */
  private checkUserActivity(userId: string, connectionId: string): void {
    const presence = this.users.get(userId);
    if (!presence || presence.connectionId !== connectionId) {
      // User connection has changed or user doesn't exist
      return;
    }

    const now = Date.now();
    const timeSinceActivity = now - presence.lastActivity;

    // Check if user has been inactive for too long
    if (timeSinceActivity > this.config.presenceTtl) {
      this.goOffline(userId).catch(error => {
        this.logger.error('Failed to set user offline due to inactivity', error, { userId });
      });
    } else if (timeSinceActivity > this.config.heartbeatInterval * 2) {
      // User might be away
      if (presence.status === 'online') {
        this.updateStatus(userId, 'away').catch(error => {
          this.logger.error('Failed to set user to away', error, { userId });
        });
      }
    }
  }

  /**
   * Start activity monitoring
   */
  private startHeartbeatMonitoring(): void {
    setInterval(() => {
      // Check all users
      for (const userId of this.users.keys()) {
        const presence = this.users.get(userId);
        if (presence && presence.connectionId) {
          this.checkUserActivity(userId, presence.connectionId);
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Update metrics
   */
  private updateMetrics(status: PresenceStatus): void {
    this.metrics.totalUsers++;

    switch (status) {
      case 'online':
        this.metrics.onlineUsers++;
        break;
      case 'away':
        this.metrics.awayUsers++;
        break;
      case 'busy':
        this.metrics.busyUsers++;
        break;
    }
  }

  /**
   * Update metrics for status change
   */
  private updateMetricsForStatusChange(oldStatus: PresenceStatus, newStatus: PresenceStatus): void {
    // Decrement old status
    switch (oldStatus) {
      case 'online':
        this.metrics.onlineUsers = Math.max(0, this.metrics.onlineUsers - 1);
        break;
      case 'away':
        this.metrics.awayUsers = Math.max(0, this.metrics.awayUsers - 1);
        break;
      case 'busy':
        this.metrics.busyUsers = Math.max(0, this.metrics.busyUsers - 1);
        break;
    }

    // Increment new status
    switch (newStatus) {
      case 'online':
        this.metrics.onlineUsers++;
        break;
      case 'away':
        this.metrics.awayUsers++;
        break;
      case 'busy':
        this.metrics.busyUsers++;
        break;
    }
  }

  /**
   * Add to history
   */
  private addToHistory(userId: string, presence: UserPresence): void {
    if (!this.config.enablePresenceHistory) return;

    if (!this.presenceHistory.has(userId)) {
      this.presenceHistory.set(userId, []);
    }

    const history = this.presenceHistory.get(userId)!;
    history.push(presence);

    // Trim history
    const maxHistory = Math.floor(this.config.historyRetention / this.config.heartbeatInterval);
    if (history.length > maxHistory) {
      history.shift();
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanup(): void {
    setInterval(() => {
      this.cleanup();
    }, this.config.presenceTtl);
  }

  /**
   * Cleanup expired presences
   */
  private cleanup(): void {
    const now = Date.now();
    const cleanupThreshold = now - this.config.presenceTtl;

    for (const [userId, presence] of this.users) {
      // Check if user should be marked as offline
      if (presence.connectionId && presence.status !== 'offline') {
        if (now - presence.lastActivity > cleanupThreshold) {
          this.goOffline(userId).catch(error => {
            this.logger.error('Cleanup failed to set user offline', error, { userId });
          });
        }
      }
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemoryUsage(): Promise<boolean> {
    const memoryUsage = process.memoryUsage();
    const memoryThreshold = this.config.maxUsers * 0.001 * 1024 * 1024; // 1KB per user

    return memoryUsage.heapUsed < memoryThreshold;
  }

  /**
   * Check user limits
   */
  private async checkUserLimits(): Promise<boolean> {
    return this.users.size < this.config.maxUsers;
  }

  /**
   * Emit presence event
   */
  private emitPresenceEvent(event: PresenceEvent): void {
    this.metrics.totalEvents++;

    this.eventBus.emit('presence', event);

    if (this.config.enableStatusUpdates) {
      this.eventBus.emit('status:change', {
        userId: event.userId,
        oldStatus: this.presenceHistory.get(event.userId)?.[this.presenceHistory.get(event.userId)!.length - 2]?.status,
        newStatus: event.presence.status,
        timestamp: event.timestamp
      });
    }
  }

  /**
   * Listen for presence events
   */
  public on(event: string, handler: Function): void {
    this.eventBus.on(event, handler);
  }

  /**
   * Stop listening for presence events
   */
  public off(event: string, handler: Function): void {
    this.eventBus.off(event, handler);
  }

  /**
   * Get health check status
   */
  public async getHealth(): Promise<any> {
    return {
      healthy: this.users.size < this.config.maxUsers,
      users: {
        total: this.metrics.totalUsers,
        online: this.metrics.onlineUsers,
        max: this.config.maxUsers
      },
      memory: {
        used: process.memoryUsage().heapUsed,
        limit: this.config.maxUsers * 0.001 * 1024 * 1024
      },
      metrics: this.metrics
    };
  }

  /**
   * Reset presence system
   */
  public async reset(): Promise<void> {
    // Clear all users
    this.users.clear();
    this.connections.clear();
    this.globalPresence.clear();
    this.presenceHistory.clear();

    // Clear timers
    for (const timer of this.heartbeatTimers.values()) {
      clearInterval(timer);
    }
    this.heartbeatTimers.clear();

    // Reset metrics
    this.metrics = {
      totalUsers: 0,
      onlineUsers: 0,
      awayUsers: 0,
      busyUsers: 0,
      totalConnections: 0,
      totalEvents: 0,
      averageSessionTime: 0
    };

    this.logger.info('Presence system reset');
  }

  /**
   * Cleanup resources
   */
  public async dispose(): Promise<void> {
    // Stop health checker
    this.healthChecker.stop();

    // Clear all data
    await this.reset();

    this.logger.info('Presence system disposed');
  }
}