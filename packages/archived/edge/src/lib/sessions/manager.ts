/**
 * Session Manager - Lifecycle Management for Sessions
 *
 * Manages session lifecycle including creation, retrieval, cleanup,
 * and archival across storage tiers.
 */

import type {
  SessionData,
  ConversationMessage,
} from '../../types/index';
import type {
  SessionInfo,
  SessionMetadata,
} from '../../do/session';
import type { DurableObjectNamespace } from '@cloudflare/workers-types';
import { KVCache } from '../kv';
import { R2Storage } from '../r2';

export interface SessionManagerOptions {
  /**
   * Session timeout in milliseconds (default: 1 hour)
   */
  sessionTimeout?: number;

  /**
   * Archive threshold in milliseconds (default: 1 hour)
   */
  archiveThreshold?: number;

  /**
   * Delete threshold in milliseconds (default: 30 days)
   */
  deleteThreshold?: number;

  /**
   * Max messages per session (default: 10,000)
   */
  maxMessages?: number;

  /**
   * Context window size in tokens (default: 128K)
   */
  contextWindow?: number;
}

/**
 * Session Manager - Comprehensive session lifecycle management
 *
 * Features:
 * - Get or create sessions
 * - List user sessions
 * - Clean up inactive sessions
 * - Archive old sessions to R2
 * - Delete old archives
 */
export class SessionManager {
  private sessionDO: DurableObjectNamespace;
  private kvCache: KVCache;
  private r2Storage: R2Storage;
  private options: Required<SessionManagerOptions>;

  constructor(
    sessionDO: DurableObjectNamespace,
    kvCache: KVCache,
    r2Storage: R2Storage,
    options: SessionManagerOptions = {}
  ) {
    this.sessionDO = sessionDO;
    this.kvCache = kvCache;
    this.r2Storage = r2Storage;
    this.options = {
      sessionTimeout: options.sessionTimeout ?? 60 * 60 * 1000, // 1 hour
      archiveThreshold: options.archiveThreshold ?? 60 * 60 * 1000, // 1 hour
      deleteThreshold: options.deleteThreshold ?? 30 * 24 * 60 * 60 * 1000, // 30 days
      maxMessages: options.maxMessages ?? 10000,
      contextWindow: options.contextWindow ?? 128000,
    };
  }

  /**
   * Get or create session for user
   */
  async getOrCreate(sessionId: string, userId: string): Promise<SessionData> {
    // Try to get existing session
    const session = await this.get(sessionId);

    if (session) {
      // Update last activity
      await this.touchSession(sessionId);
      return session;
    }

    // Create new session
    return this.create(sessionId, userId);
  }

  /**
   * Get session by ID
   */
  async get(sessionId: string): Promise<SessionData | null> {
    try {
      const stub = this.sessionDO.get(this.sessionDO.idFromName(sessionId));
      const response = await stub.fetch(
        new Request(`https://do/${sessionId}`, { method: 'GET' })
      );

      if (response.status === 404) {
        return null;
      }

      const data = await response.json() as { session: SessionData };
      return data.session;
    } catch (error) {
      console.error(`Failed to get session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Create new session
   */
  async create(sessionId: string, userId: string): Promise<SessionData> {
    const sessionData: Partial<SessionData> = {
      userId,
    };

    const stub = this.sessionDO.get(this.sessionDO.idFromName(sessionId));
    const response = await stub.fetch(
      new Request(`https://do/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify(sessionData),
      })
    );

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    const data = await response.json() as { session: SessionData };
    return data.session;
  }

  /**
   * List all active sessions for user
   */
  async listUserSessions(userId: string): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];

    // Try to get from KV index
    const indexKey = `user_sessions:${userId}`;
    const sessionIds = await this.kvCache.get<string[]>(indexKey);

    if (sessionIds) {
      for (const sessionId of sessionIds) {
        const session = await this.get(sessionId);
        if (session && session.userId === userId) {
          sessions.push({
            sessionId: session.sessionId,
            userId: session.userId,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            messageCount: session.metadata.messageCount,
            totalTokens: session.metadata.totalTokens,
            tier: session.storage.tier,
          });
        }
      }
    }

    // Sort by last activity
    return sessions.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  /**
   * Clean up inactive sessions
   * Returns number of sessions archived
   */
  async cleanupInactive(olderThan: number): Promise<number> {
    const now = Date.now();
    let archived = 0;

    // Get all session IDs from KV
    const allSessions = await this.kvCache.list('session_index:', 1000);

    for (const sessionKey of allSessions) {
      const sessionId = sessionKey.replace('session_index:', '');

      try {
        const session = await this.get(sessionId);

        if (!session) {
          continue;
        }

        const inactiveTime = now - session.lastActivity;

        // Archive if inactive for longer than threshold
        if (inactiveTime > olderThan) {
          await this.archiveSession(sessionId);
          archived++;
        }
      } catch (error) {
        console.error(`Failed to cleanup session ${sessionId}:`, error);
      }
    }

    return archived;
  }

  /**
   * Archive session to R2
   */
  async archiveSession(sessionId: string): Promise<void> {
    const session = await this.get(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Store in R2
    await this.r2Storage.archiveSession(session);

    // Store in KV for quick retrieval
    await this.kvCache.set(
      `archived_session:${sessionId}`,
      session,
      60 * 60 * 24 * 30 // 30 days TTL
    );

    // Update archive index
    const archiveKey = `archive_index:${session.userId}`;
    const archives = await this.kvCache.get<string[]>(archiveKey) || [];
    archives.push(sessionId);
    await this.kvCache.set(archiveKey, archives, 60 * 60 * 24 * 30);

    // Delete from DO
    const stub = this.sessionDO.get(this.sessionDO.idFromName(sessionId));
    await stub.fetch(
      new Request(`https://do/${sessionId}`, { method: 'DELETE' })
    );

    // Remove from active index
    await this.removeFromIndex(sessionId, session.userId);
  }

  /**
   * Delete old archived sessions
   * Returns number of sessions deleted
   */
  async deleteOldArchives(olderThan: number): Promise<number> {
    const now = Date.now();
    let deleted = 0;

    // Get all archive keys
    const allArchives = await this.kvCache.list('archive_index:', 1000);

    for (const archiveKey of allArchives) {
      const userId = archiveKey.replace('archive_index:', '');
      const sessionIds = await this.kvCache.get<string[]>(archiveKey) || [];

      for (const sessionId of sessionIds) {
        try {
          const session = await this.kvCache.get<SessionData>(
            `archived_session:${sessionId}`
          );

          if (!session) {
            continue;
          }

          const archiveAge = now - session.lastActivity;

          // Delete if archived for longer than threshold
          if (archiveAge > olderThan) {
            await this.deleteArchive(sessionId, userId);
            deleted++;
          }
        } catch (error) {
          console.error(`Failed to delete archive ${sessionId}:`, error);
        }
      }
    }

    return deleted;
  }

  /**
   * Get archived session
   */
  async getArchive(sessionId: string): Promise<SessionData | null> {
    // Try KV first (faster)
    const cached = await this.kvCache.get<SessionData>(
      `archived_session:${sessionId}`
    );

    if (cached) {
      return cached;
    }

    // Fall back to R2
    const archives = await this.r2Storage.getSessionArchive(sessionId);

    if (archives.length > 0) {
      // Return most recent archive
      const lastArchive = archives[archives.length - 1];
      return lastArchive ?? null;
    }

    return null;
  }

  /**
   * Restore archived session to active
   */
  async restoreSession(sessionId: string): Promise<SessionData> {
    const archived = await this.getArchive(sessionId);

    if (!archived) {
      throw new Error(`Archived session ${sessionId} not found`);
    }

    // Create new session with archived data
    const newSession: SessionData = {
      ...archived,
      storage: {
        tier: 'hot',
        compressed: false,
        sizeBytes: 0,
        checkpointCount: 0,
        lastCheckpoint: Date.now(),
      },
    };

    const stub = this.sessionDO.get(this.sessionDO.idFromName(sessionId));
    const response = await stub.fetch(
      new Request(`https://do/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify(newSession),
      })
    );

    if (!response.ok) {
      throw new Error(`Failed to restore session: ${response.statusText}`);
    }

    const data = await response.json() as { session: SessionData };
    const session = data.session;

    // Add to index
    await this.addToIndex(session);

    return session;
  }

  /**
   * Add message to session
   */
  async addMessage(
    sessionId: string,
    message: ConversationMessage
  ): Promise<void> {
    const session = await this.get(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Check message limit
    if (session.messages.length >= this.options.maxMessages) {
      // Archive session if too many messages
      await this.archiveSession(sessionId);
      throw new Error(
        `Session ${sessionId} archived: exceeded max message limit`
      );
    }

    const stub = this.sessionDO.get(this.sessionDO.idFromName(sessionId));

    // Call DO's addMessage method
    await stub.fetch(
      new Request(`https://do/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify(message),
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }

  /**
   * Touch session to update last activity
   */
  async touchSession(sessionId: string): Promise<void> {
    const stub = this.sessionDO.get(this.sessionDO.idFromName(sessionId));

    await stub.fetch(
      new Request(`https://do/${sessionId}/touch`, {
        method: 'POST',
      })
    );
  }

  /**
   * Update session metadata
   */
  async updateSessionMetadata(
    sessionId: string,
    metadata: Partial<SessionMetadata>
  ): Promise<void> {
    const session = await this.get(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const updated = {
      ...session,
      metadata: {
        ...session.metadata,
        ...metadata,
      },
    };

    const stub = this.sessionDO.get(this.sessionDO.idFromName(sessionId));
    await stub.fetch(
      new Request(`https://do/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify(updated),
      })
    );
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.get(sessionId);

    if (session) {
      await this.removeFromIndex(sessionId, session.userId);
    }

    const stub = this.sessionDO.get(this.sessionDO.idFromName(sessionId));
    await stub.fetch(
      new Request(`https://do/${sessionId}`, { method: 'DELETE' })
    );
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    activeSessions: number;
    archivedSessions: number;
    totalMessages: number;
    totalTokens: number;
  }> {
    // Count active sessions
    const activeSessionKeys = await this.kvCache.list('session_index:', 1000);
    const activeSessions = activeSessionKeys.length;

    // Count archived sessions
    const archiveKeys = await this.kvCache.list('archive_index:', 1000);
    let archivedSessions = 0;
    for (const key of archiveKeys) {
      const sessions = await this.kvCache.get<string[]>(key) || [];
      archivedSessions += sessions.length;
    }

    // Calculate totals
    let totalMessages = 0;
    let totalTokens = 0;

    for (const sessionKey of activeSessionKeys) {
      const sessionId = sessionKey.replace('session_index:', '');
      const session = await this.get(sessionId);
      if (session) {
        totalMessages += session.metadata.messageCount;
        totalTokens += session.metadata.totalTokens;
      }
    }

    return {
      activeSessions,
      archivedSessions,
      totalMessages,
      totalTokens,
    };
  }

  /**
   * Add session to index
   */
  private async addToIndex(session: SessionData): Promise<void> {
    const userKey = `user_sessions:${session.userId}`;
    const sessionKey = `session_index:${session.sessionId}`;

    // Add to user's session list
    const userSessions = await this.kvCache.get<string[]>(userKey) || [];
    userSessions.push(session.sessionId);
    await this.kvCache.set(userKey, userSessions, 60 * 60 * 24 * 7); // 7 days

    // Add to session index
    await this.kvCache.set(sessionKey, session.userId, 60 * 60 * 24 * 7);
  }

  /**
   * Remove session from index
   */
  private async removeFromIndex(sessionId: string, userId: string): Promise<void> {
    const userKey = `user_sessions:${userId}`;
    const sessionKey = `session_index:${sessionId}`;

    // Remove from user's session list
    const userSessions = await this.kvCache.get<string[]>(userKey) || [];
    const filtered = userSessions.filter(id => id !== sessionId);
    await this.kvCache.set(userKey, filtered, 60 * 60 * 24 * 7);

    // Remove from session index
    await this.kvCache.delete(sessionKey);
  }

  /**
   * Delete archive
   */
  private async deleteArchive(sessionId: string, userId: string): Promise<void> {
    // Remove from KV
    await this.kvCache.delete(`archived_session:${sessionId}`);

    // Update archive index
    const archiveKey = `archive_index:${userId}`;
    const archives = await this.kvCache.get<string[]>(archiveKey) || [];
    const filtered = archives.filter(id => id !== sessionId);
    await this.kvCache.set(archiveKey, filtered, 60 * 60 * 24 * 30);

    // Delete from R2
    const r2Key = `sessions/${sessionId}/`;
    const objects = await this.r2Storage.list(r2Key);
    for (const object of objects.objects) {
      await this.r2Storage.delete(object.key);
    }
  }
}

/**
 * Helper function to create SessionManager instance
 */
export function createSessionManager(
  sessionDO: DurableObjectNamespace,
  kvCache: KVCache,
  r2Storage: R2Storage,
  options?: SessionManagerOptions
): SessionManager {
  return new SessionManager(sessionDO, kvCache, r2Storage, options);
}
