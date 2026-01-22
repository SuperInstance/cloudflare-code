/**
 * Authentication Session Durable Object
 *
 * Manages user sessions, refresh tokens, and session state.
 * Provides fast access to session data with automatic cleanup.
 */

import type {
  AuthSession,
  RefreshToken,
  UserRole,
  Permission,
  SessionTier,
} from './types';

// ============================================================================
// ENVIRONMENT INTERFACE
// ============================================================================

export interface AuthEnv {
  AUTH_SESSION_DO: DurableObjectNamespace;
  KV_CACHE: KVNamespace;
  DB?: D1Database;
}

// ============================================================================
// SESSION STATE
// ============================================================================

/**
 * Session storage state
 */
interface SessionStorageState {
  sessions: Map<string, AuthSession>;
  refreshTokens: Map<string, RefreshToken>;
  userSessions: Map<string, Set<string>>; // userId -> sessionIds
}

// ============================================================================
// AUTH SESSION DURABLE OBJECT
// ============================================================================

/**
 * AuthSessionDO - Manages authentication sessions
 *
 * Features:
 * - Fast in-memory session storage
 * - Refresh token management
 * - Automatic session expiration
 * - Session rotation
 * - Multi-user support
 */
export class AuthSessionDO {
  private state: DurableObjectState;
  private env: AuthEnv;
  private storage: SessionStorageState;
  private maxMemoryBytes: number = 128 * 1024 * 1024; // 128MB
  private currentMemoryBytes: number = 0;
  private accessLog: Map<string, number>; // Track last access for LRU

  constructor(state: DurableObjectState, env: AuthEnv) {
    this.state = state;
    this.env = env;
    this.storage = {
      sessions: new Map(),
      refreshTokens: new Map(),
      userSessions: new Map(),
    };
    this.accessLog = new Map();

    // Initialize from storage
    this.state.blockConcurrencyWhile(async () => {
      await this.loadFromStorage();
    });
  }

  /**
   * Fetch handler for incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname.split('/').filter(Boolean);

    try {
      if (method === 'GET' && path[0] === 'session' && path[1]) {
        return this.handleGetSession(path[1]);
      }

      if (method === 'POST' && path[0] === 'session') {
        const data = await request.json();
        return this.handleCreateSession(data);
      }

      if (method === 'PUT' && path[0] === 'session' && path[1]) {
        const data = await request.json();
        return this.handleUpdateSession(path[1], data);
      }

      if (method === 'DELETE' && path[0] === 'session' && path[1]) {
        return this.handleDeleteSession(path[1]);
      }

      if (method === 'POST' && path[0] === 'refresh') {
        const data = await request.json();
        return this.handleRefreshToken(data);
      }

      if (method === 'POST' && path[0] === 'validate') {
        const data = await request.json();
        return this.handleValidateSession(data);
      }

      if (method === 'GET' && path[0] === 'user' && path[1] && path[2] === 'sessions') {
        return this.handleGetUserSessions(path[1]);
      }

      if (method === 'POST' && path[0] === 'cleanup') {
        return this.handleCleanup();
      }

      if (method === 'GET' && path[0] === 'stats') {
        return this.handleGetStats();
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // ========================================================================
  // SESSION HANDLERS
  // ========================================================================

  /**
   * Get session by ID
   */
  private async handleGetSession(sessionId: string): Promise<Response> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    this.accessLog.set(sessionId, Date.now());

    return new Response(
      JSON.stringify({ session }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Create new session
   */
  private async handleCreateSession(data: any): Promise<Response> {
    const {
      userId,
      organizationId,
      role,
      permissions,
      metadata,
      expiresIn = 24 * 60 * 60 * 1000, // 24 hours default
    } = data;

    if (!userId || !role) {
      return new Response(
        JSON.stringify({ error: 'userId and role are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const session = await this.createSession({
      userId,
      organizationId,
      role,
      permissions,
      metadata,
      expiresIn,
    });

    return new Response(
      JSON.stringify({ session }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Update session
   */
  private async handleUpdateSession(sessionId: string, data: any): Promise<Response> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updated = await this.updateSession(sessionId, {
      ...data,
      lastActivity: Date.now(),
    });

    return new Response(
      JSON.stringify({ session: updated }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Delete session
   */
  private async handleDeleteSession(sessionId: string): Promise<Response> {
    await this.deleteSession(sessionId);
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Refresh token
   */
  private async handleRefreshToken(data: any): Promise<Response> {
    const { refreshTokenId, userId } = data;

    if (!refreshTokenId || !userId) {
      return new Response(
        JSON.stringify({ error: 'refreshTokenId and userId are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await this.rotateRefreshToken(refreshTokenId, userId);

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Invalid refresh token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Validate session
   */
  private async handleValidateSession(data: any): Promise<Response> {
    const { sessionId } = data;

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'sessionId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const session = await this.getSession(sessionId);
    const valid = session && session.expiresAt > Date.now();

    return new Response(
      JSON.stringify({ valid, session: valid ? session : null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get user sessions
   */
  private async handleGetUserSessions(userId: string): Promise<Response> {
    const sessions = await this.getUserSessions(userId);

    return new Response(
      JSON.stringify({ sessions }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Cleanup expired sessions
   */
  private async handleCleanup(): Promise<Response> {
    const stats = await this.cleanupExpiredSessions();

    return new Response(
      JSON.stringify({ stats }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get statistics
   */
  private async handleGetStats(): Promise<Response> {
    const stats = await this.getStats();

    return new Response(
      JSON.stringify(stats),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ========================================================================
  // SESSION METHODS
  // ========================================================================

  /**
   * Create new session
   */
  async createSession(params: {
    userId: string;
    organizationId?: string;
    role: UserRole;
    permissions: Permission[];
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      location?: string;
      device?: string;
    };
    expiresIn?: number;
  }): Promise<AuthSession> {
    const sessionId = crypto.randomUUID();
    const refreshTokenId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + (params.expiresIn || 24 * 60 * 60 * 1000);

    const session: AuthSession = {
      sessionId,
      userId: params.userId,
      organizationId: params.organizationId,
      role: params.role,
      permissions: params.permissions,
      createdAt: now,
      expiresAt,
      lastActivity: now,
      refreshTokenId,
      tier: 'hot',
      metadata: params.metadata || {},
      mfaVerified: false,
    };

    // Create refresh token
    const refreshToken: RefreshToken = {
      tokenId: refreshTokenId,
      userId: params.userId,
      sessionId,
      expiresAt: expiresAt + (7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: now,
      revoked: false,
      rotationCount: 0,
    };

    // Store session
    await this.setSession(session);

    // Store refresh token
    await this.setRefreshToken(refreshToken);

    // Index by user
    await this.indexUserSession(params.userId, sessionId);

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<AuthSession | null> {
    const session = this.storage.sessions.get(sessionId);

    if (session) {
      // Check expiration
      if (session.expiresAt < Date.now()) {
        await this.deleteSession(sessionId);
        return null;
      }

      this.accessLog.set(sessionId, Date.now());
      return session;
    }

    return null;
  }

  /**
   * Update session
   */
  async updateSession(sessionId: string, updates: Partial<AuthSession>): Promise<AuthSession> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    const updated: AuthSession = {
      ...session,
      ...updates,
      sessionId, // Ensure ID doesn't change
    };

    await this.setSession(updated);
    return updated;
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = this.storage.sessions.get(sessionId);

    if (session) {
      // Remove from user index
      const userSessions = this.storage.userSessions.get(session.userId);
      if (userSessions) {
        userSessions.delete(sessionId);
      }

      // Remove refresh token
      this.storage.refreshTokens.delete(session.refreshTokenId);

      // Remove session
      this.storage.sessions.delete(sessionId);
      this.accessLog.delete(sessionId);

      await this.persist();
    }
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId: string): Promise<AuthSession[]> {
    const userSessions = this.storage.userSessions.get(userId);
    if (!userSessions) {
      return [];
    }

    const sessions: AuthSession[] = [];
    for (const sessionId of userSessions) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Delete all user sessions
   */
  async deleteUserSessions(userId: string): Promise<void> {
    const userSessions = this.storage.userSessions.get(userId);
    if (!userSessions) {
      return;
    }

    for (const sessionId of Array.from(userSessions)) {
      await this.deleteSession(sessionId);
    }

    this.storage.userSessions.delete(userId);
    await this.persist();
  }

  // ========================================================================
  // REFRESH TOKEN METHODS
  // ========================================================================

  /**
   * Rotate refresh token
   */
  async rotateRefreshToken(
    refreshTokenId: string,
    userId: string
  ): Promise<{ newRefreshTokenId: string; session: AuthSession } | null> {
    const token = this.storage.refreshTokens.get(refreshTokenId);

    if (!token || token.userId !== userId) {
      return null;
    }

    if (token.revoked || token.expiresAt < Date.now()) {
      return null;
    }

    // Get session
    const session = await this.getSession(token.sessionId);
    if (!session) {
      return null;
    }

    // Create new refresh token
    const newRefreshTokenId = crypto.randomUUID();
    const now = Date.now();

    const newToken: RefreshToken = {
      tokenId: newRefreshTokenId,
      userId: token.userId,
      sessionId: token.sessionId,
      expiresAt: now + (7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: now,
      revoked: false,
      rotationCount: token.rotationCount + 1,
    };

    // Revoke old token
    token.revoked = true;
    token.revokedAt = now;

    // Store new token
    await this.setRefreshToken(newToken);

    // Update session
    const updatedSession = await this.updateSession(session.sessionId, {
      refreshTokenId: newRefreshTokenId,
      lastActivity: now,
    });

    return {
      newRefreshTokenId,
      session: updatedSession,
    };
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(refreshTokenId: string, userId: string): Promise<boolean> {
    const token = this.storage.refreshTokens.get(refreshTokenId);

    if (!token || token.userId !== userId) {
      return false;
    }

    token.revoked = true;
    token.revokedAt = Date.now();

    await this.persist();
    return true;
  }

  // ========================================================================
  // STORAGE METHODS
  // ========================================================================

  /**
   * Store session in memory
   */
  private async setSession(session: AuthSession): Promise<void> {
    const size = this.calculateSessionSize(session);

    // Ensure capacity
    await this.ensureCapacity(size);

    // Store session
    this.storage.sessions.set(session.sessionId, session);
    this.accessLog.set(session.sessionId, Date.now());
    this.currentMemoryBytes += size;

    await this.persist();
  }

  /**
   * Store refresh token
   */
  private async setRefreshToken(token: RefreshToken): Promise<void> {
    this.storage.refreshTokens.set(token.tokenId, token);
    await this.persist();
  }

  /**
   * Index session by user
   */
  private async indexUserSession(userId: string, sessionId: string): Promise<void> {
    let userSessions = this.storage.userSessions.get(userId);
    if (!userSessions) {
      userSessions = new Set();
      this.storage.userSessions.set(userId, userSessions);
    }
    userSessions.add(sessionId);
    await this.persist();
  }

  /**
   * Persist state to DO storage
   */
  private async persist(): Promise<void> {
    const sessionsObj = Object.fromEntries(this.storage.sessions.entries());
    const tokensObj = Object.fromEntries(this.storage.refreshTokens.entries());
    const userSessionsObj: Record<string, string[]> = {};

    for (const [userId, sessions] of this.storage.userSessions.entries()) {
      userSessionsObj[userId] = Array.from(sessions);
    }

    await this.state.storage.put({
      sessions: sessionsObj,
      refreshTokens: tokensObj,
      userSessions: userSessionsObj,
    });
  }

  /**
   * Load state from DO storage
   */
  private async loadFromStorage(): Promise<void> {
    const stored = await this.state.storage.get<{
      sessions: Record<string, AuthSession>;
      refreshTokens: Record<string, RefreshToken>;
      userSessions: Record<string, string[]>;
    }>(['sessions', 'refreshTokens', 'userSessions']);

    if (stored) {
      if (stored.sessions) {
        this.storage.sessions = new Map(Object.entries(stored.sessions));
      }
      if (stored.refreshTokens) {
        this.storage.refreshTokens = new Map(Object.entries(stored.refreshTokens));
      }
      if (stored.userSessions) {
        const userSessionsMap = new Map<string, Set<string>>();
        for (const [userId, sessions] of Object.entries(stored.userSessions)) {
          userSessionsMap.set(userId, new Set(sessions));
        }
        this.storage.userSessions = userSessionsMap;
      }
      this.calculateMemoryUsage();
    }
  }

  /**
   * Calculate memory usage
   */
  private calculateMemoryUsage(): void {
    this.currentMemoryBytes = 0;
    for (const session of this.storage.sessions.values()) {
      this.currentMemoryBytes += this.calculateSessionSize(session);
    }
  }

  /**
   * Calculate session size
   */
  private calculateSessionSize(session: AuthSession): number {
    const json = JSON.stringify(session);
    return json.length * 2; // UTF-16
  }

  /**
   * Ensure capacity for new session
   */
  private async ensureCapacity(requiredBytes: number): Promise<void> {
    const targetUsage = this.maxMemoryBytes * 0.8;

    while (this.currentMemoryBytes + requiredBytes > targetUsage && this.storage.sessions.size > 0) {
      // Find LRU session
      let lruSessionId: string | null = null;
      let lruTime = Infinity;

      for (const [sessionId, accessTime] of this.accessLog.entries()) {
        if (accessTime < lruTime) {
          lruTime = accessTime;
          lruSessionId = sessionId;
        }
      }

      if (lruSessionId) {
        await this.evictSession(lruSessionId);
      }
    }
  }

  /**
   * Evict session to KV
   */
  private async evictSession(sessionId: string): Promise<void> {
    const session = this.storage.sessions.get(sessionId);
    if (!session) return;

    // Store in KV
    await this.env.KV_CACHE.put(
      `session:${sessionId}`,
      JSON.stringify(session),
      {
        expirationTtl: Math.floor((session.expiresAt - Date.now()) / 1000),
        metadata: { tier: 'warm' },
      }
    );

    // Remove from HOT tier
    const size = this.calculateSessionSize(session);
    this.storage.sessions.delete(sessionId);
    this.accessLog.delete(sessionId);
    this.currentMemoryBytes -= size;
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<{
    sessionsDeleted: number;
    tokensDeleted: number;
  }> {
    const now = Date.now();
    let sessionsDeleted = 0;
    let tokensDeleted = 0;

    // Clean expired sessions
    for (const [sessionId, session] of this.storage.sessions.entries()) {
      if (session.expiresAt < now) {
        await this.deleteSession(sessionId);
        sessionsDeleted++;
      }
    }

    // Clean expired tokens
    for (const [tokenId, token] of this.storage.refreshTokens.entries()) {
      if (token.expiresAt < now) {
        this.storage.refreshTokens.delete(tokenId);
        tokensDeleted++;
      }
    }

    if (sessionsDeleted > 0 || tokensDeleted > 0) {
      await this.persist();
    }

    return { sessionsDeleted, tokensDeleted };
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    sessionCount: number;
    tokenCount: number;
    userCount: number;
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
  }> {
    return {
      sessionCount: this.storage.sessions.size,
      tokenCount: this.storage.refreshTokens.size,
      userCount: this.storage.userSessions.size,
      memoryUsage: {
        used: this.currentMemoryBytes,
        total: this.maxMemoryBytes,
        percentage: (this.currentMemoryBytes / this.maxMemoryBytes) * 100,
      },
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create AuthSessionDO stub
 */
export function createAuthSessionStub(env: AuthEnv, userId: string): DurableObjectStub {
  const id = env.AUTH_SESSION_DO.idFromName(userId);
  return env.AUTH_SESSION_DO.get(id);
}

/**
 * Create session via DO
 */
export async function createAuthSession(
  env: AuthEnv,
  params: {
    userId: string;
    organizationId?: string;
    role: UserRole;
    permissions: Permission[];
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      location?: string;
      device?: string;
    };
    expiresIn?: number;
  }
): Promise<AuthSession> {
  const stub = createAuthSessionStub(env, params.userId);
  const response = await stub.fetch(
    new Request('https://do/session', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  );

  const data = await response.json();
  return data.session;
}

/**
 * Validate session via DO
 */
export async function validateAuthSession(
  env: AuthEnv,
  userId: string,
  sessionId: string
): Promise<{ valid: boolean; session?: AuthSession }> {
  const stub = createAuthSessionStub(env, userId);
  const response = await stub.fetch(
    new Request('https://do/validate', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    })
  );

  const data = await response.json();
  return data;
}

/**
 * Delete session via DO
 */
export async function deleteAuthSession(
  env: AuthEnv,
  userId: string,
  sessionId: string
): Promise<void> {
  const stub = createAuthSessionStub(env, userId);
  await stub.fetch(
    new Request(`https://do/session/${sessionId}`, {
      method: 'DELETE',
    })
  );
}

/**
 * Rotate refresh token via DO
 */
export async function rotateAuthRefreshToken(
  env: AuthEnv,
  userId: string,
  refreshTokenId: string
): Promise<{ newRefreshTokenId: string; session: AuthSession } | null> {
  const stub = createAuthSessionStub(env, userId);
  const response = await stub.fetch(
    new Request('https://do/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshTokenId, userId }),
    })
  );

  if (response.status === 401) {
    return null;
  }

  const data = await response.json();
  return data;
}
