/**
 * Cross-Session Manager - Session persistence, linking, and context sharing
 */

import {
  Session,
  SessionMetadata,
  SessionState,
  SessionPermissions,
  SessionLink,
  LinkType,
  RetentionPolicy,
  CrossSessionConfig,
  ConversationContext,
  ContextError,
  SessionNotFoundError,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';

/**
 * Default cross-session configuration
 */
const DEFAULT_CONFIG: CrossSessionConfig = {
  persistenceEnabled: true,
  linkingEnabled: true,
  sharingEnabled: true,
  defaultRetentionPolicy: {
    duration: 30 * 24 * 60 * 60 * 1000, // 30 days
    action: 'archive',
  },
  privacyControls: true,
  anonymizationEnabled: false,
};

/**
 * Cross-Session Manager - Manages session lifecycle and cross-session features
 */
export class CrossSessionManager extends EventEmitter {
  private sessions: Map<string, Session> = new Map();
  private links: Map<string, Set<SessionLink>> = new Map(); // sessionId -> links
  private userSessions: Map<string, Set<string>> = new Map(); // userId -> sessionIds
  private config: CrossSessionConfig;

  constructor(config: Partial<CrossSessionConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ========================================================================
  // Session Creation
  // ========================================================================

  /**
   * Create a new session
   */
  async createSession(
    context: ConversationContext,
    metadata?: Partial<SessionMetadata>
  ): Promise<Session> {
    const sessionId = context.sessionId;
    const now = Date.now();

    const sessionMetadata: SessionMetadata = {
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      permissions: {
        canRead: [context.userId || 'owner'],
        canWrite: [context.userId || 'owner'],
        canShare: [context.userId || 'owner'],
        canDelete: [context.userId || 'owner'],
        public: false,
      },
      retention: { ...this.config.defaultRetentionPolicy },
      ...metadata,
    };

    const session: Session = {
      id: sessionId,
      userId: context.userId,
      context,
      metadata: sessionMetadata,
      state: 'active',
    };

    this.sessions.set(sessionId, session);

    // Index by user
    if (context.userId) {
      if (!this.userSessions.has(context.userId)) {
        this.userSessions.set(context.userId, new Set());
      }
      this.userSessions.get(context.userId)!.add(sessionId);
    }

    this.emit('session_created', { sessionId, userId: context.userId });

    return session;
  }

  // ========================================================================
  // Session Retrieval
  // ========================================================================

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<Session> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // Update last accessed time
    session.metadata.lastAccessedAt = Date.now();

    // Check retention policy
    if (this.isSessionExpired(session)) {
      await this.handleExpiredSession(session);
    }

    return session;
  }

  /**
   * Get multiple sessions by IDs
   */
  async getSessions(sessionIds: string[]): Promise<Session[]> {
    const sessions: Session[] = [];

    for (const sessionId of sessionIds) {
      try {
        const session = await this.getSession(sessionId);
        sessions.push(session);
      } catch (error) {
        // Skip sessions that don't exist
        continue;
      }
    }

    return sessions;
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) return [];

    const sessions: Session[] = [];
    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId);
      if (session && session.state !== 'deleted') {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<Session[]> {
    const sessions = await this.getUserSessions(userId);
    return sessions.filter(s => s.state === 'active');
  }

  /**
   * Get archived sessions for a user
   */
  async getArchivedSessions(userId: string): Promise<Session[]> {
    const sessions = await this.getUserSessions(userId);
    return sessions.filter(s => s.state === 'archived');
  }

  // ========================================================================
  // Session Updates
  // ========================================================================

  /**
   * Update session metadata
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Session>
  ): Promise<Session> {
    const session = await this.getSession(sessionId);

    // Apply updates
    Object.assign(session, updates);
    session.metadata.updatedAt = Date.now();

    this.emit('session_updated', { sessionId, updates });

    return session;
  }

  /**
   * Update session permissions
   */
  async updatePermissions(
    sessionId: string,
    permissions: Partial<SessionPermissions>
  ): Promise<Session> {
    const session = await this.getSession(sessionId);

    session.metadata.permissions = {
      ...session.metadata.permissions,
      ...permissions,
    };
    session.metadata.updatedAt = Date.now();

    return session;
  }

  /**
   * Share session with users
   */
  async shareSession(
    sessionId: string,
    userIds: string[],
    permissions: 'read' | 'write' | 'admin' = 'read'
  ): Promise<Session> {
    if (!this.config.sharingEnabled) {
      throw new ContextError('Session sharing is disabled', 'SHARING_DISABLED');
    }

    const session = await this.getSession(sessionId);

    // Check if user has permission to share
    const requesterId = session.metadata.permissions.canShare[0]; // Owner
    if (!requesterId) {
      throw new ContextError('No permission to share session', 'PERMISSION_DENIED');
    }

    // Update permissions
    for (const userId of userIds) {
      switch (permissions) {
        case 'read':
          session.metadata.permissions.canRead.push(userId);
          break;
        case 'write':
          session.metadata.permissions.canRead.push(userId);
          session.metadata.permissions.canWrite.push(userId);
          break;
        case 'admin':
          session.metadata.permissions.canRead.push(userId);
          session.metadata.permissions.canWrite.push(userId);
          session.metadata.permissions.canShare.push(userId);
          break;
      }

      // Index shared sessions
      if (!this.userSessions.has(userId)) {
        this.userSessions.set(userId, new Set());
      }
      this.userSessions.get(userId)!.add(sessionId);
    }

    session.metadata.sharedWith = [
      ...(session.metadata.sharedWith || []),
      ...userIds,
    ];
    session.metadata.updatedAt = Date.now();

    this.emit('session_shared', { sessionId, userIds, permissions });

    return session;
  }

  // ========================================================================
  // Session Deletion
  // ========================================================================

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string, userId?: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // Check permissions
    if (userId && !this.canDelete(session, userId)) {
      throw new ContextError('No permission to delete session', 'PERMISSION_DENIED');
    }

    // Remove from user index
    if (session.userId) {
      const userSessions = this.userSessions.get(session.userId);
      if (userSessions) {
        userSessions.delete(sessionId);
      }
    }

    // Remove shared users' index
    if (session.metadata.sharedWith) {
      for (const sharedUserId of session.metadata.sharedWith) {
        const userSessions = this.userSessions.get(sharedUserId);
        if (userSessions) {
          userSessions.delete(sessionId);
        }
      }
    }

    // Remove links
    this.links.delete(sessionId);

    // Mark as deleted
    session.state = 'deleted';
    this.sessions.delete(sessionId);

    this.emit('session_deleted', { sessionId, userId });
  }

  /**
   * Archive a session
   */
  async archiveSession(sessionId: string): Promise<Session> {
    const session = await this.getSession(sessionId);
    session.state = 'archived';
    session.metadata.updatedAt = Date.now();

    this.emit('session_archived', { sessionId });

    return session;
  }

  /**
   * Restore an archived session
   */
  async restoreSession(sessionId: string): Promise<Session> {
    const session = this.sessions.get(sessionId);

    if (!session || session.state !== 'archived') {
      throw new ContextError('Session not archived', 'INVALID_SESSION_STATE');
    }

    session.state = 'active';
    session.metadata.updatedAt = Date.now();

    this.emit('session_restored', { sessionId });

    return session;
  }

  // ========================================================================
  // Session Linking
  // ========================================================================

  /**
   * Link two sessions
   */
  async linkSessions(
    fromSessionId: string,
    toSessionId: string,
    type: LinkType,
    strength: number = 0.5,
    metadata?: Record<string, any>
  ): Promise<SessionLink> {
    if (!this.config.linkingEnabled) {
      throw new ContextError('Session linking is disabled', 'LINKING_DISABLED');
    }

    const [fromSession, toSession] = await Promise.all([
      this.getSession(fromSessionId),
      this.getSession(toSessionId),
    ]);

    const link: SessionLink = {
      fromSessionId,
      toSessionId,
      type,
      strength: Math.max(0, Math.min(1, strength)),
      metadata,
    };

    // Add link
    if (!this.links.has(fromSessionId)) {
      this.links.set(fromSessionId, new Set());
    }
    this.links.get(fromSessionId)!.add(link);

    // Update metadata
    fromSession.metadata.linkedSessionIds = [
      ...(fromSession.metadata.linkedSessionIds || []),
      toSessionId,
    ];
    fromSession.metadata.updatedAt = Date.now();

    this.emit('sessions_linked', { fromSessionId, toSessionId, type });

    return link;
  }

  /**
   * Get linked sessions
   */
  async getLinkedSessions(
    sessionId: string,
    linkType?: LinkType
  ): Promise<Session[]> {
    const links = this.links.get(sessionId);
    if (!links) return [];

    const linkedSessionIds = linkType
      ? Array.from(links)
          .filter(l => l.type === linkType)
          .map(l => l.toSessionId)
      : Array.from(links).map(l => l.toSessionId);

    return this.getSessions(linkedSessionIds);
  }

  /**
   * Remove session link
   */
  async unlinkSessions(
    fromSessionId: string,
    toSessionId: string
  ): Promise<void> {
    const links = this.links.get(fromSessionId);
    if (!links) return;

    for (const link of links) {
      if (link.toSessionId === toSessionId) {
        links.delete(link);
        break;
      }
    }

    // Update metadata
    const session = this.sessions.get(fromSessionId);
    if (session) {
      session.metadata.linkedSessionIds = (
        session.metadata.linkedSessionIds || []
      ).filter(id => id !== toSessionId);
      session.metadata.updatedAt = Date.now();
    }

    this.emit('sessions_unlinked', { fromSessionId, toSessionId });
  }

  // ========================================================================
  // Context Persistence
  // ========================================================================

  /**
   * Persist session to storage
   */
  async persistSession(sessionId: string): Promise<void> {
    if (!this.config.persistenceEnabled) {
      throw new ContextError('Persistence is disabled', 'PERSISTENCE_DISABLED');
    }

    const session = await this.getSession(sessionId);

    // In production, this would save to Durable Object storage or database
    // For now, we just emit an event
    this.emit('session_persisted', { sessionId, session });

    // Update retention timestamp
    if (session.metadata.retention) {
      session.metadata.expiresAt =
        Date.now() + session.metadata.retention.duration;
    }
  }

  /**
   * Restore session from storage
   */
  async restorePersistedSession(sessionId: string): Promise<Session> {
    if (!this.config.persistenceEnabled) {
      throw new ContextError('Persistence is disabled', 'PERSISTENCE_DISABLED');
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    this.emit('session_restored', { sessionId });

    return session;
  }

  // ========================================================================
  // Privacy and Anonymization
  // ========================================================================

  /**
   * Anonymize session data
   */
  async anonymizeSession(sessionId: string): Promise<Session> {
    if (!this.config.anonymizationEnabled) {
      throw new ContextError('Anonymization is disabled', 'ANONYMIZATION_DISABLED');
    }

    const session = await this.getSession(sessionId);

    // Remove user identifiers
    session.userId = undefined;

    // Anonymize message content
    for (const message of session.context.messages) {
      message.metadata = message.metadata || {};
      delete message.metadata.userId;
      delete message.metadata.sessionId;

      // Remove PII from content (basic implementation)
      message.content = this.removePII(message.content);
    }

    session.metadata.updatedAt = Date.now();

    this.emit('session_anonymized', { sessionId });

    return session;
  }

  /**
   * Remove personally identifiable information from text
   */
  private removePII(text: string): string {
    // Basic PII removal - in production, use more sophisticated methods
    let cleaned = text;

    // Remove email addresses
    cleaned = cleaned.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');

    // Remove phone numbers
    cleaned = cleaned.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');

    // Remove SSNs (basic pattern)
    cleaned = cleaned.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');

    return cleaned;
  }

  // ========================================================================
  // Retention Policy Management
  // ========================================================================

  /**
   * Set retention policy for a session
   */
  async setRetentionPolicy(
    sessionId: string,
    policy: RetentionPolicy
  ): Promise<Session> {
    const session = await this.getSession(sessionId);

    session.metadata.retention = policy;
    session.metadata.expiresAt = Date.now() + policy.duration;
    session.metadata.updatedAt = Date.now();

    return session;
  }

  /**
   * Check if session is expired
   */
  private isSessionExpired(session: Session): boolean {
    if (!session.metadata.expiresAt) return false;
    return Date.now() > session.metadata.expiresAt;
  }

  /**
   * Handle expired session
   */
  private async handleExpiredSession(session: Session): Promise<void> {
    const policy = session.metadata.retention;
    if (!policy) return;

    switch (policy.action) {
      case 'archive':
        await this.archiveSession(session.id);
        break;
      case 'delete':
        await this.deleteSession(session.id);
        break;
      case 'anonymize':
        await this.anonymizeSession(session.id);
        break;
    }
  }

  // ========================================================================
  // Permission Checks
  // ========================================================================

  /**
   * Check if user can read session
   */
  canRead(session: Session, userId: string): boolean {
    return (
      session.metadata.permissions.public ||
      session.metadata.permissions.canRead.includes(userId) ||
      session.userId === userId
    );
  }

  /**
   * Check if user can write to session
   */
  canWrite(session: Session, userId: string): boolean {
    return (
      session.metadata.permissions.canWrite.includes(userId) ||
      session.userId === userId
    );
  }

  /**
   * Check if user can share session
   */
  canShare(session: Session, userId: string): boolean {
    return (
      session.metadata.permissions.canShare.includes(userId) ||
      session.userId === userId
    );
  }

  /**
   * Check if user can delete session
   */
  canDelete(session: Session, userId: string): boolean {
    return (
      session.metadata.permissions.canDelete.includes(userId) ||
      session.userId === userId
    );
  }

  // ========================================================================
  // Session Search and Discovery
  // ========================================================================

  /**
   * Search sessions by tags
   */
  async searchSessionsByTags(tags: string[], userId?: string): Promise<Session[]> {
    const sessions = userId ? await this.getUserSessions(userId) : Array.from(this.sessions.values());

    return sessions.filter(session =>
      tags.some(tag => session.metadata.tags?.includes(tag))
    );
  }

  /**
   * Search sessions by date range
   */
  async searchSessionsByDateRange(
    startDate: number,
    endDate: number,
    userId?: string
  ): Promise<Session[]> {
    const sessions = userId ? await this.getUserSessions(userId) : Array.from(this.sessions.values());

    return sessions.filter(session =>
      session.metadata.createdAt >= startDate &&
      session.metadata.createdAt <= endDate
    );
  }

  /**
   * Get sessions matching state
   */
  async getSessionsByState(state: SessionState, userId?: string): Promise<Session[]> {
    const sessions = userId ? await this.getUserSessions(userId) : Array.from(this.sessions.values());

    return sessions.filter(session => session.state === state);
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Get session statistics
   */
  getStats(userId?: string): {
    totalSessions: number;
    activeSessions: number;
    archivedSessions: number;
    totalLinks: number;
    avgSessionDuration: number;
  } {
    const sessions = userId
      ? Array.from(this.userSessions.get(userId) || []).map(id => this.sessions.get(id))
      : Array.from(this.sessions.values());

    const validSessions = sessions.filter(s => s && s.state !== 'deleted') as Session[];

    let totalLinks = 0;
    let totalDuration = 0;

    for (const session of validSessions) {
      const links = this.links.get(session.id);
      if (links) {
        totalLinks += links.size;
      }

      totalDuration += session.metadata.lastAccessedAt - session.metadata.createdAt;
    }

    return {
      totalSessions: validSessions.length,
      activeSessions: validSessions.filter(s => s.state === 'active').length,
      archivedSessions: validSessions.filter(s => s.state === 'archived').length,
      totalLinks,
      avgSessionDuration: validSessions.length > 0 ? totalDuration / validSessions.length : 0,
    };
  }

  /**
   * Clear all sessions
   */
  async clearAll(): Promise<void> {
    this.sessions.clear();
    this.links.clear();
    this.userSessions.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CrossSessionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): CrossSessionConfig {
    return { ...this.config };
  }
}
