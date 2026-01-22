/**
 * Session Durable Object - HOT Tier Storage
 *
 * Provides ultra-fast (<1ms) session state storage using DO memory.
 * Limit: 128MB per DO instance
 */

import type { SessionData, ConversationMessage } from '../types/index';

export interface Env {
  SESSION_DO: DurableObjectNamespace;
  KV_CACHE: KVNamespace;
  R2_STORAGE: R2Bucket;
}

/**
 * Session state interface
 */
export interface SessionState {
  sessionId: string;
  userId: string;
  createdAt: number;
  lastActivity: number;
  messages: ConversationMessage[];
  metadata: SessionMetadata;
  tokenCount: number;
  cost: number;
  storage: {
    tier: 'hot' | 'warm' | 'cold';
    compressed: boolean;
    sizeBytes: number;
    checkpointCount: number;
    lastCheckpoint: number;
  };
}

/**
 * Session metadata interface
 */
export interface SessionMetadata {
  language?: string;
  framework?: string;
  projectPath?: string;
  repositoryHash?: string;
  messageCount: number;
  totalTokens: number;
  totalCost: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  customData?: Record<string, unknown>;
}

/**
 * Session info for listing
 */
export interface SessionInfo {
  sessionId: string;
  userId: string;
  createdAt: number;
  lastActivity: number;
  messageCount: number;
  totalTokens: number;
  tier: 'hot' | 'warm' | 'cold';
}

/**
 * Conversation context for LLM
 */
export interface ConversationContext {
  messages: ConversationMessage[];
  summary?: string;
  totalTokens: number;
  messageCount: number;
  truncated: boolean;
  metadata: {
    sessionId: string;
    userId: string;
    language?: string;
    framework?: string;
    projectPath?: string;
  };
}

/**
 * SessionDO - HOT Tier Storage for Active Sessions
 *
 * Features:
 * - Sub-millisecond access latency
 * - In-memory storage for active sessions
 * - Automatic persistence to Durable Object storage
 * - LRU eviction when approaching 128MB limit
 * - Real-time session updates
 */
export class SessionDO {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<string, SessionData>;
  private maxMemoryBytes: number = 128 * 1024 * 1024; // 128MB
  private currentMemoryBytes: number = 0;
  private accessLog: Map<string, number>; // Track last access time for LRU

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.accessLog = new Map();

    // Initialize from storage
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<Map<string, SessionData>>('sessions');
      if (stored) {
        this.sessions = new Map(Object.entries(stored));
        this.calculateMemoryUsage();
      }
    });
  }

  /**
   * Fetch handler for incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const sessionId = url.pathname.split('/')[1];

    if (!sessionId) {
      return new Response('Session ID required', { status: 400 });
    }

    try {
      switch (method) {
        case 'GET':
          return this.handleGet(sessionId);
        case 'POST':
          return this.handlePost(sessionId, await request.json());
        case 'DELETE':
          return this.handleDelete(sessionId);
        case 'PUT':
          return this.handlePut(sessionId, await request.json());
        default:
          return new Response('Method not allowed', { status: 405 });
      }
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Get session data by ID
   */
  private async handleGet(sessionId: string): Promise<Response> {
    const startTime = performance.now();
    const session = await this.get(sessionId);
    const latency = performance.now() - startTime;

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update access time for LRU
    this.accessLog.set(sessionId, Date.now());

    return new Response(
      JSON.stringify({ session, latency, tier: 'hot' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Create new session
   */
  private async handlePost(sessionId: string, data: unknown): Promise<Response> {
    const sessionData = data as Partial<SessionData>;

    if (!sessionData.userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const newSession: SessionData = {
      sessionId,
      userId: sessionData.userId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messages: [],
      metadata: {
        language: sessionData.metadata?.language || 'en',
        framework: sessionData.metadata?.framework || 'unknown',
        projectPath: sessionData.metadata?.projectPath || '',
        repositoryHash: sessionData.metadata?.repositoryHash || '',
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
        cacheHits: 0,
        cacheMisses: 0,
        hitRate: 0,
      },
      storage: {
        tier: 'hot',
        compressed: false,
        sizeBytes: 0,
        checkpointCount: 0,
        lastCheckpoint: Date.now(),
      },
    };

    await this.set(sessionId, newSession);

    return new Response(
      JSON.stringify({ session: newSession, tier: 'hot' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Update existing session
   */
  private async handlePut(sessionId: string, data: unknown): Promise<Response> {
    const updateData = data as Partial<SessionData>;
    const existing = await this.get(sessionId);

    if (!existing) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updated: SessionData = {
      ...existing,
      ...updateData,
      sessionId, // Ensure sessionId doesn't change
      lastActivity: Date.now(),
    };

    await this.set(sessionId, updated);

    return new Response(
      JSON.stringify({ session: updated, tier: 'hot' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Delete session
   */
  private async handleDelete(sessionId: string): Promise<Response> {
    await this.delete(sessionId);
    return new Response(
      JSON.stringify({ success: true, message: 'Session deleted' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get session data from HOT tier
   * Latency: <1ms
   */
  async get(sessionId: string): Promise<SessionData | null> {
    const session = this.sessions.get(sessionId);

    if (session) {
      // Update access time for LRU
      this.accessLog.set(sessionId, Date.now());
      return session;
    }

    return null;
  }

  /**
   * Store session data in HOT tier
   * Latency: <1ms
   */
  async set(sessionId: string, value: SessionData): Promise<void> {
    // Calculate size before storing
    const size = this.calculateSessionSize(value);

    // Check if we need to evict (LRU)
    await this.ensureCapacity(size);

    // Store session
    this.sessions.set(sessionId, value);
    this.accessLog.set(sessionId, Date.now());
    this.currentMemoryBytes += size;

    // Update storage metadata
    value.storage.sizeBytes = size;
    value.storage.tier = 'hot';

    // Persist to DO storage
    await this.persist();
  }

  /**
   * Delete session from HOT tier
   */
  async delete(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      const size = this.calculateSessionSize(session);
      this.sessions.delete(sessionId);
      this.accessLog.delete(sessionId);
      this.currentMemoryBytes -= size;
      await this.persist();
    }
  }

  /**
   * Add message to session
   */
  async addMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.messages.push(message);
    session.metadata.messageCount++;
    session.lastActivity = Date.now();

    if (message.tokens) {
      session.metadata.totalTokens += message.tokens;
    }

    await this.set(sessionId, session);
  }

  /**
   * Get all active sessions
   */
  async getAllSessions(): Promise<SessionData[]> {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session count
   */
  async getSessionCount(): Promise<number> {
    return this.sessions.size;
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): { used: number; total: number; percentage: number } {
    return {
      used: this.currentMemoryBytes,
      total: this.maxMemoryBytes,
      percentage: (this.currentMemoryBytes / this.maxMemoryBytes) * 100,
    };
  }

  /**
   * Evict least recently used sessions if memory is full
   */
  private async ensureCapacity(requiredBytes: number): Promise<void> {
    const targetUsage = this.maxMemoryBytes * 0.8; // Keep at 80% max

    while (this.currentMemoryBytes + requiredBytes > targetUsage && this.sessions.size > 0) {
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
        await this.evictToWarm(lruSessionId);
      }
    }
  }

  /**
   * Evict session to WARM tier (KV)
   */
  private async evictToWarm(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Compress and store in KV
    const compressed = await this.compressSession(session);
    await this.env.KV_CACHE.put(
      `session:${sessionId}`,
      compressed,
      {
        expirationTtl: 60 * 60 * 24 * 30, // 30 days
        metadata: {
          tier: 'warm',
          originalSize: session.storage.sizeBytes,
          compressedSize: compressed.byteLength,
        },
      }
    );

    // Remove from HOT tier
    const size = this.calculateSessionSize(session);
    this.sessions.delete(sessionId);
    this.accessLog.delete(sessionId);
    this.currentMemoryBytes -= size;
  }

  /**
   * Persist sessions to DO storage
   */
  private async persist(): Promise<void> {
    const sessionsObj = Object.fromEntries(this.sessions.entries());
    await this.state.storage.put('sessions', sessionsObj);
  }

  /**
   * Calculate memory usage from stored sessions
   */
  private calculateMemoryUsage(): void {
    this.currentMemoryBytes = 0;
    for (const session of this.sessions.values()) {
      this.currentMemoryBytes += this.calculateSessionSize(session);
    }
  }

  /**
   * Calculate approximate session size in bytes
   */
  private calculateSessionSize(session: SessionData): number {
    // Rough estimation based on JSON size
    const json = JSON.stringify(session);
    return json.length * 2; // UTF-16 encoding
  }

  /**
   * Compress session data for KV storage
   */
  private async compressSession(session: SessionData): Promise<Uint8Array> {
    const json = JSON.stringify(session);
    const encoder = new TextEncoder();
    const data = encoder.encode(json);

    // Use CompressionStream if available, otherwise return as-is
    if (typeof CompressionStream !== 'undefined') {
      const compressed = new Response(data).body!
        .pipeThrough(new CompressionStream('gzip'));
      const arrayBuffer = await new Response(compressed).arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }

    return data;
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    sessionCount: number;
    totalMessages: number;
    totalTokens: number;
    memoryUsage: { used: number; total: number; percentage: number };
    averageSessionSize: number;
  }> {
    const stats = {
      sessionCount: this.sessions.size,
      totalMessages: 0,
      totalTokens: 0,
      memoryUsage: this.getMemoryUsage(),
      averageSessionSize: 0,
    };

    for (const session of this.sessions.values()) {
      stats.totalMessages += session.metadata.messageCount;
      stats.totalTokens += session.metadata.totalTokens;
    }

    stats.averageSessionSize = this.currentMemoryBytes / Math.max(1, this.sessions.size);

    return stats;
  }

  /**
   * Initialize session with user ID
   */
  async initialize(userId: string): Promise<SessionInfo> {
    const sessionId = crypto.randomUUID();
    const now = Date.now();

    const session: SessionData = {
      sessionId,
      userId,
      createdAt: now,
      lastActivity: now,
      messages: [],
      metadata: {
        language: 'en',
        framework: 'unknown',
        projectPath: '',
        repositoryHash: '',
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
        cacheHits: 0,
        cacheMisses: 0,
        hitRate: 0,
      },
      storage: {
        tier: 'hot',
        compressed: false,
        sizeBytes: 0,
        checkpointCount: 0,
        lastCheckpoint: now,
      },
    };

    await this.set(sessionId, session);

    return {
      sessionId,
      userId,
      createdAt: now,
      lastActivity: now,
      messageCount: 0,
      totalTokens: 0,
      tier: 'hot',
    };
  }

  /**
   * Get message history with limit
   */
  async getHistory(limit?: number): Promise<ConversationMessage[]> {
    const messages = await this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<ConversationMessage[]>('messages');
      return stored || [];
    });

    if (limit && limit > 0) {
      return messages.slice(-limit);
    }
    return messages;
  }

  /**
   * Get conversation context with token limit
   */
  async getContext(tokenLimit: number): Promise<ConversationContext> {
    const allSessions = Array.from(this.sessions.values());

    if (allSessions.length === 0) {
      throw new Error('No active session found');
    }

    const session = allSessions[0]!; // Use first session
    let messages = session.messages;
    let totalTokens = 0;
    let messageCount = 0;
    let truncated = false;

    // Calculate tokens and truncate if needed
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]!;
      const msgTokens = msg.tokens || this.estimateTokens(msg.content);

      if (totalTokens + msgTokens > tokenLimit) {
        messages = messages.slice(i + 1);
        truncated = true;
        break;
      }

      totalTokens += msgTokens;
      messageCount++;
    }

    return {
      messages: messages.reverse(),
      totalTokens,
      messageCount,
      truncated,
      metadata: {
        sessionId: session.sessionId,
        userId: session.userId!,
        language: session.metadata.language,
        framework: session.metadata.framework,
        projectPath: session.metadata.projectPath!,
      },
    };
  }

  /**
   * Update session metadata
   */
  async updateMetadata(metadata: Record<string, unknown>): Promise<void> {
    const allSessions = Array.from(this.sessions.entries());

    for (const [sessionId, session] of allSessions) {
      const updated = {
        ...session,
        metadata: {
          ...session.metadata,
          ...metadata,
        },
      };
      await this.set(sessionId, updated);
    }
  }

  /**
   * Update last activity timestamp
   */
  async touch(): Promise<void> {
    const allSessions = Array.from(this.sessions.entries());

    for (const [sessionId, session] of allSessions) {
      const updated = {
        ...session,
        lastActivity: Date.now(),
      };
      await this.set(sessionId, updated);
    }
  }

  /**
   * Destroy session and cleanup
   */
  async destroy(): Promise<void> {
    const allSessions = Array.from(this.sessions.keys());

    for (const sessionId of allSessions) {
      await this.delete(sessionId);
    }

    // Clear all storage
    await this.state.storage.deleteAll();
  }

  /**
   * Estimate token count for text
   * Rough estimation: ~4 characters per token
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

/**
 * Create a SessionDO stub for client-side usage
 */
export function createSessionStub(env: Env, sessionId: string): DurableObjectStub {
  return env.SESSION_DO.get(env.SESSION_DO.idFromName(sessionId));
}

/**
 * Helper function to get session from DO
 */
export async function getSession(env: Env, sessionId: string): Promise<SessionData | null> {
  const stub = createSessionStub(env, sessionId);
  const response = await stub.fetch(
    new Request(`https://do/${sessionId}`, { method: 'GET' })
  );

  if (response.status === 404) {
    return null;
  }

  const data = await response.json() as { session: SessionData };
  return data.session;
}

/**
 * Helper function to create session in DO
 */
export async function createSession(env: Env, sessionData: Partial<SessionData>): Promise<SessionData> {
  const sessionId = crypto.randomUUID();
  const stub = createSessionStub(env, sessionId);

  const response = await stub.fetch(
    new Request(`https://do/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify(sessionData),
    })
  );

  const data = await response.json() as { session: SessionData };
  return data.session;
}

/**
 * Helper function to update session in DO
 */
export async function updateSession(env: Env, sessionId: string, updates: Partial<SessionData>): Promise<SessionData> {
  const stub = createSessionStub(env, sessionId);

  const response = await stub.fetch(
    new Request(`https://do/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  );

  if (response.status === 404) {
    throw new Error('Session not found');
  }

  const data = await response.json() as { session: SessionData };
  return data.session;
}

/**
 * Helper function to delete session from DO
 */
export async function deleteSession(env: Env, sessionId: string): Promise<void> {
  const stub = createSessionStub(env, sessionId);
  await stub.fetch(
    new Request(`https://do/${sessionId}`, { method: 'DELETE' })
  );
}
