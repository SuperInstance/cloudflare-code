/**
 * D1 Storage Layer
 * Cloudflare D1 database integration for analytics data
 */

import type {
  StorageConfig,
  QueryResult,
  AnalyticsEvent,
  User,
  Session,
  Segment,
  BatchOperation,
} from '../types/index.js';

// ============================================================================
// D1 Client
// ============================================================================

export class D1Client {
  private db: D1Database;
  private config: StorageConfig;

  constructor(db: D1Database, config: Partial<StorageConfig> = {}) {
    this.db = db;
    this.config = {
      bindingName: config.bindingName || 'DB',
      tableName: config.tableName || 'analytics_events',
      batchSize: config.batchSize || 100,
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 10000,
    };
  }

  /**
   * Execute a query with retry logic
   */
  async query<T>(
    sql: string,
    params: any[] = []
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.config.maxRetries!; attempt++) {
      try {
        const stmt = this.db.prepare(sql);
        const result = await stmt.bind(...params).all();

        return {
          results: result.results as T[],
          success: true,
          meta: {
            duration: Date.now() - startTime,
            rows_read: result.meta?.rows_read || 0,
            rows_written: result.meta?.rows_written || 0,
          },
        };
      } catch (error) {
        lastError = error as Error;

        // Wait before retry (exponential backoff)
        if (attempt < this.config.maxRetries! - 1) {
          await this.delay(Math.pow(2, attempt) * 100);
        }
      }
    }

    return {
      results: [],
      success: false,
      error: lastError?.message || 'Unknown error',
      meta: {
        duration: Date.now() - startTime,
        rows_read: 0,
        rows_written: 0,
      },
    };
  }

  /**
   * Execute a batch of operations
   */
  async batch(operations: BatchOperation[]): Promise<QueryResult<any>> {
    const startTime = Date.now();

    try {
      const statements: D1PreparedStatement[] = [];

      for (const op of operations) {
        const sql = this.buildBatchSQL(op);
        const stmt = this.db.prepare(sql);

        for (const row of op.data) {
          const values = Object.values(row);
          statements.push(stmt.bind(...values));
        }
      }

      const results = await this.db.batch(statements);

      return {
        results: results.map((r) => r.toJSON()),
        success: true,
        meta: {
          duration: Date.now() - startTime,
          rows_read: 0,
          rows_written: operations.length,
        },
      };
    } catch (error) {
      return {
        results: [],
        success: false,
        error: (error as Error).message,
        meta: {
          duration: Date.now() - startTime,
          rows_read: 0,
          rows_written: 0,
        },
      };
    }
  }

  /**
   * Build SQL for batch operation
   */
  private buildBatchSQL(operation: BatchOperation): string {
    const { operation: op, table, data } = operation;

    switch (op) {
      case 'insert':
        const columns = Object.keys(data[0] || {}).join(', ');
        const placeholders = Object.keys(data[0] || {}).map(() => '?').join(', ');
        return `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;

      case 'update':
        const setClause = Object.keys(data[0] || {})
          .map((key) => `${key} = ?`)
          .join(', ');
        return `UPDATE ${table} SET ${setClause} WHERE ${operation.condition || '1=1'}`;

      case 'delete':
        return `DELETE FROM ${table} WHERE ${operation.condition || '1=1'}`;

      default:
        throw new Error(`Unknown operation: ${op}`);
    }
  }

  /**
   * Delay for retry
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Event Storage
// ============================================================================

export class EventStorage {
  private client: D1Client;

  constructor(client: D1Client) {
    this.client = client;
  }

  /**
   * Store a single event
   */
  async storeEvent(event: AnalyticsEvent): Promise<boolean> {
    const sql = `
      INSERT INTO analytics_events (
        id, user_id, anonymous_id, session_id, event_type, event_name,
        properties, user_properties, context, timestamp, received_at,
        processed_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await this.client.query(sql, [
      event.id,
      event.userId || null,
      event.anonymousId || null,
      event.sessionId,
      event.eventType,
      event.eventName,
      JSON.stringify(event.properties),
      JSON.stringify(event.userProperties || {}),
      JSON.stringify(event.context),
      event.timestamp,
      event.receivedAt || Date.now(),
      event.processedAt || null,
      JSON.stringify(event.metadata || {}),
    ]);

    return result.success;
  }

  /**
   * Store multiple events
   */
  async storeEvents(events: AnalyticsEvent[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // Process in batches
    const batchSize = 100;
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);

      const operations: BatchOperation[] = [
        {
          operation: 'insert',
          table: 'analytics_events',
          data: batch.map((e) => ({
            id: e.id,
            user_id: e.userId || null,
            anonymous_id: e.anonymousId || null,
            session_id: e.sessionId,
            event_type: e.eventType,
            event_name: e.eventName,
            properties: JSON.stringify(e.properties),
            user_properties: JSON.stringify(e.userProperties || {}),
            context: JSON.stringify(e.context),
            timestamp: e.timestamp,
            received_at: e.receivedAt || Date.now(),
            processed_at: e.processedAt || null,
            metadata: JSON.stringify(e.metadata || {}),
          })),
        },
      ];

      const result = await this.client.batch(operations);

      if (result.success) {
        success += batch.length;
      } else {
        failed += batch.length;
      }
    }

    return { success, failed };
  }

  /**
   * Query events
   */
  async queryEvents(options: EventQueryOptions): Promise<AnalyticsEvent[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.userId) {
      conditions.push('user_id = ?');
      params.push(options.userId);
    }

    if (options.sessionId) {
      conditions.push('session_id = ?');
      params.push(options.sessionId);
    }

    if (options.eventType) {
      conditions.push('event_type = ?');
      params.push(options.eventType);
    }

    if (options.eventName) {
      conditions.push('event_name = ?');
      params.push(options.eventName);
    }

    if (options.startTime) {
      conditions.push('timestamp >= ?');
      params.push(options.startTime);
    }

    if (options.endTime) {
      conditions.push('timestamp <= ?');
      params.push(options.endTime);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = options.limit ? `LIMIT ${options.limit}` : '';
    const offsetClause = options.offset ? `OFFSET ${options.offset}` : '';

    const sql = `
      SELECT * FROM analytics_events
      ${whereClause}
      ORDER BY timestamp DESC
      ${limitClause}
      ${offsetClause}
    `;

    const result = await this.client.query<any>(sql, params);

    if (!result.success) {
      return [];
    }

    return result.results.map((row) => this.mapRowToEvent(row));
  }

  /**
   * Count events
   */
  async countEvents(options: Partial<EventQueryOptions> = {}): Promise<number> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.userId) {
      conditions.push('user_id = ?');
      params.push(options.userId);
    }

    if (options.eventType) {
      conditions.push('event_type = ?');
      params.push(options.eventType);
    }

    if (options.startTime) {
      conditions.push('timestamp >= ?');
      params.push(options.startTime);
    }

    if (options.endTime) {
      conditions.push('timestamp <= ?');
      params.push(options.endTime);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `SELECT COUNT(*) as count FROM analytics_events ${whereClause}`;
    const result = await this.client.query<{ count: number }>(sql, params);

    return result.results[0]?.count || 0;
  }

  /**
   * Delete events
   */
  async deleteEvents(eventIds: string[]): Promise<boolean> {
    if (eventIds.length === 0) return true;

    const placeholders = eventIds.map(() => '?').join(', ');
    const sql = `DELETE FROM analytics_events WHERE id IN (${placeholders})`;

    const result = await this.client.query(sql, eventIds);
    return result.success;
  }

  /**
   * Map database row to event
   */
  private mapRowToEvent(row: any): AnalyticsEvent {
    return {
      id: row.id,
      userId: row.user_id,
      anonymousId: row.anonymous_id,
      sessionId: row.session_id,
      eventType: row.event_type,
      eventName: row.event_name,
      properties: JSON.parse(row.properties || '{}'),
      userProperties: JSON.parse(row.user_properties || '{}'),
      context: JSON.parse(row.context || '{}'),
      timestamp: row.timestamp,
      receivedAt: row.received_at,
      processedAt: row.processed_at,
      metadata: JSON.parse(row.metadata || '{}'),
    };
  }
}

interface EventQueryOptions {
  userId?: string;
  sessionId?: string;
  eventType?: string;
  eventName?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
}

// ============================================================================
// User Storage
// ============================================================================

export class UserStorage {
  private client: D1Client;

  constructor(client: D1Client) {
    this.client = client;
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE id = ?';
    const result = await this.client.query<any>(sql, [userId]);

    if (!result.success || result.results.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.results[0]);
  }

  /**
   * Create or update user
   */
  async upsertUser(user: User): Promise<boolean> {
    const sql = `
      INSERT INTO users (
        id, anonymous_id, email, first_name, last_name, name, avatar,
        properties, demographics, created_at, updated_at, last_seen_at,
        sessions, total_events, lifetime_value, engagement_score,
        segments, cohorts, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        email = excluded.email,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        name = excluded.name,
        avatar = excluded.avatar,
        properties = excluded.properties,
        demographics = excluded.demographics,
        updated_at = excluded.updated_at,
        last_seen_at = excluded.last_seen_at,
        sessions = excluded.sessions,
        total_events = excluded.total_events,
        lifetime_value = excluded.lifetime_value,
        engagement_score = excluded.engagement_score,
        segments = excluded.segments,
        cohorts = excluded.cohorts,
        metadata = excluded.metadata
    `;

    const result = await this.client.query(sql, [
      user.id,
      user.anonymousId || null,
      user.email || null,
      user.firstName || null,
      user.lastName || null,
      user.name || null,
      user.avatar || null,
      JSON.stringify(user.properties),
      JSON.stringify(user.demographics || {}),
      user.createdAt,
      user.updatedAt,
      user.lastSeenAt,
      user.sessions,
      user.totalEvents,
      user.lifetimeValue || null,
      user.engagementScore || null,
      JSON.stringify(user.segments || []),
      JSON.stringify(user.cohorts || []),
      JSON.stringify(user.metadata || {}),
    ]);

    return result.success;
  }

  /**
   * Query users
   */
  async queryUsers(options: UserQueryOptions = {}): Promise<User[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.segment) {
      conditions.push('segments LIKE ?');
      params.push(`%"${options.segment}"%`);
    }

    if (options.minSessions) {
      conditions.push('sessions >= ?');
      params.push(options.minSessions);
    }

    if (options.minLastSeen) {
      conditions.push('last_seen_at >= ?');
      params.push(options.minLastSeen);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = options.limit ? `LIMIT ${options.limit}` : '';
    const offsetClause = options.offset ? `OFFSET ${options.offset}` : '';

    const sql = `
      SELECT * FROM users
      ${whereClause}
      ORDER BY last_seen_at DESC
      ${limitClause}
      ${offsetClause}
    `;

    const result = await this.client.query<any>(sql, params);

    if (!result.success) {
      return [];
    }

    return result.results.map((row) => this.mapRowToUser(row));
  }

  /**
   * Delete user (for GDPR)
   */
  async deleteUser(userId: string): Promise<boolean> {
    const sql = 'DELETE FROM users WHERE id = ?';
    const result = await this.client.query(sql, [userId]);
    return result.success;
  }

  /**
   * Anonymize user (for GDPR)
   */
  async anonymizeUser(userId: string): Promise<boolean> {
    const sql = `
      UPDATE users SET
        email = NULL,
        first_name = NULL,
        last_name = NULL,
        name = NULL,
        avatar = NULL,
        properties = json_set(properties, '$.anonymized', 'true'),
        metadata = json_set(metadata, '$.anonymized', 'true'),
        updated_at = ?
      WHERE id = ?
    `;

    const result = await this.client.query(sql, [Date.now(), userId]);
    return result.success;
  }

  /**
   * Map database row to user
   */
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      anonymousId: row.anonymous_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      name: row.name,
      avatar: row.avatar,
      properties: JSON.parse(row.properties || '{}'),
      demographics: JSON.parse(row.demographics || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastSeenAt: row.last_seen_at,
      sessions: row.sessions,
      totalEvents: row.total_events,
      lifetimeValue: row.lifetime_value,
      engagementScore: row.engagement_score,
      segments: JSON.parse(row.segments || '[]'),
      cohorts: JSON.parse(row.cohorts || '[]'),
      metadata: JSON.parse(row.metadata || '{}'),
    };
  }
}

interface UserQueryOptions {
  segment?: string;
  minSessions?: number;
  minLastSeen?: number;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Segment Storage
// ============================================================================

export class SegmentStorage {
  private client: D1Client;

  constructor(client: D1Client) {
    this.client = client;
  }

  /**
   * Get segment by ID
   */
  async getSegment(segmentId: string): Promise<Segment | null> {
    const sql = 'SELECT * FROM segments WHERE id = ?';
    const result = await this.client.query<any>(sql, [segmentId]);

    if (!result.success || result.results.length === 0) {
      return null;
    }

    return this.mapRowToSegment(result.results[0]);
  }

  /**
   * Save segment
   */
  async saveSegment(segment: Segment): Promise<boolean> {
    const sql = `
      INSERT INTO segments (
        id, name, description, type, definition, users, count,
        created_at, updated_at, created_by, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        type = excluded.type,
        definition = excluded.definition,
        users = excluded.users,
        count = excluded.count,
        updated_at = excluded.updated_at,
        metadata = excluded.metadata
    `;

    const result = await this.client.query(sql, [
      segment.id,
      segment.name,
      segment.description || null,
      segment.type,
      JSON.stringify(segment.definition),
      JSON.stringify(segment.users),
      segment.count,
      segment.createdAt,
      segment.updatedAt,
      segment.createdBy || null,
      JSON.stringify(segment.metadata || {}),
    ]);

    return result.success;
  }

  /**
   * Delete segment
   */
  async deleteSegment(segmentId: string): Promise<boolean> {
    const sql = 'DELETE FROM segments WHERE id = ?';
    const result = await this.client.query(sql, [segmentId]);
    return result.success;
  }

  /**
   * List segments
   */
  async listSegments(options: SegmentQueryOptions = {}): Promise<Segment[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.type) {
      conditions.push('type = ?');
      params.push(options.type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT * FROM segments
      ${whereClause}
      ORDER BY updated_at DESC
    `;

    const result = await this.client.query<any>(sql, params);

    if (!result.success) {
      return [];
    }

    return result.results.map((row) => this.mapRowToSegment(row));
  }

  /**
   * Map database row to segment
   */
  private mapRowToSegment(row: any): Segment {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      definition: JSON.parse(row.definition || '{}'),
      users: JSON.parse(row.users || '[]'),
      count: row.count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      metadata: JSON.parse(row.metadata || '{}'),
    };
  }
}

interface SegmentQueryOptions {
  type?: string;
}

// ============================================================================
// Analytics Storage Factory
// ============================================================================

export class AnalyticsStorage {
  private eventStorage: EventStorage;
  private userStorage: UserStorage;
  private segmentStorage: SegmentStorage;

  constructor(db: D1Database, config?: Partial<StorageConfig>) {
    const client = new D1Client(db, config);
    this.eventStorage = new EventStorage(client);
    this.userStorage = new UserStorage(client);
    this.segmentStorage = new SegmentStorage(client);
  }

  get events(): EventStorage {
    return this.eventStorage;
  }

  get users(): UserStorage {
    return this.userStorage;
  }

  get segments(): SegmentStorage {
    return this.segmentStorage;
  }
}
