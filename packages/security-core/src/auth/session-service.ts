/**
 * Session Service
 * Manages user sessions, session storage, and session lifecycle
 */

import { Session, AuthConfig } from './types';
import { SecurityError } from '../types';
import { Logger } from '../utils/logger';
import { EventEmitter } from 'events';

export class SessionService extends EventEmitter {
  private config: AuthConfig;
  private logger: Logger;
  private activeSessions: Map<string, Session> = new Map();
  private userSessions: Map<string, string[]> = new Map();
  private sessionStore: Map<string, Session> = new Map();

  constructor(config: AuthConfig) {
    super();
    this.config = config;
    this.logger = new Logger('SessionService');
    this.startCleanupTimer();
  }

  /**
   * Create a new session
   */
  async createSession(user: any, ipAddress: string, userAgent: string): Promise<Session> {
    try {
      const sessionId = this.generateSessionId();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.config.sessionTimeout * 60 * 1000);

      const session: Session = {
        sessionId,
        userId: user.id,
        createdAt: now,
        expiresAt,
        lastActivityAt: now,
        ip: ipAddress,
        userAgent,
        mfaVerified: user.mfaEnabled || false,
        data: {
          username: user.username,
          email: user.email,
          roles: user.roles,
          permissions: user.permissions
        }
      };

      // Store session
      this.sessionStore.set(sessionId, session);

      // Track user sessions
      const userSessions = this.userSessions.get(user.id) || [];
      userSessions.push(sessionId);
      this.userSessions.set(user.id, userSessions);

      // Track active sessions
      this.activeSessions.set(sessionId, session);

      this.logger.info(`Session created for user ${user.email}`, { sessionId });
      this.emit('sessionCreated', session);

      return session;

    } catch (error) {
      this.logger.error('Failed to create session', error);
      throw new SecurityError('Failed to create session', 'SESSION_CREATE_FAILED', 500);
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    try {
      const session = this.sessionStore.get(sessionId);

      if (!session) {
        return null;
      }

      // Check if session is expired
      if (this.isSessionExpired(session)) {
        await this.terminateSession(sessionId);
        return null;
      }

      // Update last activity
      session.lastActivityAt = new Date();
      this.sessionStore.set(sessionId, session);

      return session;

    } catch (error) {
      this.logger.error('Failed to get session', error);
      throw new SecurityError('Failed to get session', 'SESSION_GET_FAILED', 500);
    }
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    try {
      const sessionIds = this.userSessions.get(userId) || [];
      const sessions: Session[] = [];

      for (const sessionId of sessionIds) {
        const session = this.sessionStore.get(sessionId);
        if (session && !this.isSessionExpired(session)) {
          sessions.push(session);
        }
      }

      return sessions;

    } catch (error) {
      this.logger.error('Failed to get user sessions', error);
      throw new SecurityError('Failed to get user sessions', 'USER_SESSIONS_GET_FAILED', 500);
    }
  }

  /**
   * Update session data
   */
  async updateSession(sessionId: string, updates: Partial<Session>): Promise<boolean> {
    try {
      const session = this.sessionStore.get(sessionId);

      if (!session) {
        return false;
      }

      // Merge updates
      const updatedSession = {
        ...session,
        ...updates,
        lastActivityAt: new Date()
      };

      this.sessionStore.set(sessionId, updatedSession);
      this.logger.info(`Session updated`, { sessionId });

      return true;

    } catch (error) {
      this.logger.error('Failed to update session', error);
      throw new SecurityError('Failed to update session', 'SESSION_UPDATE_FAILED', 500);
    }
  }

  /**
   * Terminate session
   */
  async terminateSession(sessionId: string): Promise<boolean> {
    try {
      const session = this.sessionStore.get(sessionId);

      if (!session) {
        return false;
      }

      // Remove from storage
      this.sessionStore.delete(sessionId);
      this.activeSessions.delete(sessionId);

      // Remove from user sessions
      const userSessions = this.userSessions.get(session.userId) || [];
      const index = userSessions.indexOf(sessionId);
      if (index > -1) {
        userSessions.splice(index, 1);
        this.userSessions.set(session.userId, userSessions);
      }

      this.logger.info(`Session terminated`, { sessionId, userId: session.userId });
      this.emit('sessionTerminated', session);

      return true;

    } catch (error) {
      this.logger.error('Failed to terminate session', error);
      throw new SecurityError('Failed to terminate session', 'SESSION_TERMINATE_FAILED', 500);
    }
  }

  /**
   * Terminate all user sessions except current one
   */
  async terminateAllUserSessions(userId: string, currentSessionId?: string): Promise<number> {
    try {
      const sessionIds = this.userSessions.get(userId) || [];
      let terminatedCount = 0;

      for (const sessionId of sessionIds) {
        if (sessionId !== currentSessionId) {
          const terminated = await this.terminateSession(sessionId);
          if (terminated) {
            terminatedCount++;
          }
        }
      }

      this.logger.info(`Terminated ${terminatedCount} sessions for user ${userId}`);
      this.emit('userSessionsTerminated', { userId, terminatedCount });

      return terminatedCount;

    } catch (error) {
      this.logger.error('Failed to terminate user sessions', error);
      throw new SecurityError('Failed to terminate user sessions', 'USER_SESSIONS_TERMINATE_FAILED', 500);
    }
  }

  /**
   * Check if session is expired
   */
  isSessionExpired(session: Session): boolean {
    const now = new Date();
    return session.expiresAt.getTime() < now.getTime();
  }

  /**
   * Extend session expiry
   */
  async extendSession(sessionId: string, additionalMinutes?: number): Promise<boolean> {
    try {
      const session = this.sessionStore.get(sessionId);

      if (!session) {
        return false;
      }

      const extendTime = additionalMinutes || this.config.sessionTimeout;
      const newExpiry = new Date(session.lastActivityAt.getTime() + extendTime * 60 * 1000);

      session.expiresAt = newExpiry;
      this.sessionStore.set(sessionId, session);

      this.logger.info(`Session extended`, { sessionId, newExpiry });
      this.emit('sessionExtended', session);

      return true;

    } catch (error) {
      this.logger.error('Failed to extend session', error);
      throw new SecurityError('Failed to extend session', 'SESSION_EXTEND_FAILED', 500);
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    const totalSessions = this.sessionStore.size;
    const activeSessions = this.activeSessions.size;
    const uniqueUsers = new Set(this.userSessions.keys()).size;

    return {
      totalSessions,
      activeSessions,
      uniqueUsers,
      sessionsByUser: Object.fromEntries(this.userSessions)
    };
  }

  /**
   * Validate session activity
   */
  async validateSessionActivity(sessionId: string, ipAddress: string, userAgent?: string): Promise<boolean> {
    try {
      const session = this.sessionStore.get(sessionId);

      if (!session) {
        return false;
      }

      // Check if session is expired
      if (this.isSessionExpired(session)) {
        await this.terminateSession(sessionId);
        return false;
      }

      // Security checks
      if (session.ip !== ipAddress && !this.isTrustedIP(session.ip, ipAddress)) {
        this.logger.warn('Session IP mismatch detected', {
          sessionId,
          sessionIP: session.ip,
          currentIP: ipAddress
        });
        // Optionally terminate session
        // await this.terminateSession(sessionId);
        return false;
      }

      if (userAgent && session.userAgent !== userAgent) {
        this.logger.warn('Session user agent mismatch detected', {
          sessionId,
          sessionUA: session.userAgent,
          currentUA: userAgent
        });
      }

      // Update last activity
      session.lastActivityAt = new Date();
      this.sessionStore.set(sessionId, session);

      return true;

    } catch (error) {
      this.logger.error('Failed to validate session activity', error);
      return false;
    }
  }

  /**
   * Set session data
   */
  async setSessionData(sessionId: string, key: string, value: any): Promise<boolean> {
    try {
      const session = this.sessionStore.get(sessionId);

      if (!session) {
        return false;
      }

      if (!session.data) {
        session.data = {};
      }

      session.data[key] = value;
      this.sessionStore.set(sessionId, session);

      return true;

    } catch (error) {
      this.logger.error('Failed to set session data', error);
      return false;
    }
  }

  /**
   * Get session data
   */
  async getSessionData(sessionId: string, key?: string): Promise<any> {
    try {
      const session = this.sessionStore.get(sessionId);

      if (!session) {
        return null;
      }

      if (key) {
        return session.data ? session.data[key] : null;
      }

      return session.data || null;

    } catch (error) {
      this.logger.error('Failed to get session data', error);
      return null;
    }
  }

  /**
   * Clear session data
   */
  async clearSessionData(sessionId: string, keys?: string[]): Promise<boolean> {
    try {
      const session = this.sessionStore.get(sessionId);

      if (!session || !session.data) {
        return false;
      }

      if (keys) {
        for (const key of keys) {
          delete session.data[key];
        }
      } else {
        session.data = {};
      }

      this.sessionStore.set(sessionId, session);

      return true;

    } catch (error) {
      this.logger.error('Failed to clear session data', error);
      return false;
    }
  }

  /**
   * Check if IP addresses are trusted (same subnet or VPN)
   */
  private isTrustedIP(sessionIP: string, currentIP: string): boolean {
    // Implement IP trust logic
    // For now, allow same IP
    return sessionIP === currentIP;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return require('uuid').v4();
  }

  /**
   * Start cleanup timer for expired sessions
   */
  private startCleanupTimer(): void {
    setInterval(async () => {
      try {
        await this.cleanupExpiredSessions();
      } catch (error) {
        this.logger.error('Failed to cleanup expired sessions', error);
      }
    }, 60 * 1000); // Run every minute
  }

  /**
   * Cleanup expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessionStore) {
      if (session.expiresAt.getTime() < now.getTime()) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      await this.terminateSession(sessionId);
    }

    if (expiredSessions.length > 0) {
      this.logger.info(`Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }
}