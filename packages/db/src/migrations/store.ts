/**
 * Migration store for tracking migration history
 */

export interface MigrationRecord {
  version: number;
  name: string;
  direction: 'up' | 'down';
  startedAt?: number;
  completedAt?: number;
  failedAt?: number;
  duration?: number;
  error?: string;
}

export interface MigrationHistory extends MigrationRecord {
  id: number;
  checksum?: string;
}

/**
 * Migration store for tracking migration state in D1
 */
export class MigrationStore {
  private readonly tableName = '_migrations';

  constructor(private readonly db: D1Database) {}

  /**
   * Initialize migrations table
   */
  async initialize(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        direction TEXT NOT NULL CHECK(direction IN ('up', 'down')),
        started_at INTEGER,
        completed_at INTEGER,
        failed_at INTEGER,
        duration INTEGER,
        error TEXT,
        checksum TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_migrations_version ON ${this.tableName}(version);
      CREATE INDEX IF NOT EXISTS idx_migrations_direction ON ${this.tableName}(direction);
    `);
  }

  /**
   * Get current database version
   */
  async getCurrentVersion(): Promise<number> {
    const result = await this.db
      .prepare(
        `
        SELECT version FROM ${this.tableName}
        WHERE direction = 'up' AND completed_at IS NOT NULL
        ORDER BY version DESC LIMIT 1
      `
      )
      .first();

    return (result?.version as number) || 0;
  }

  /**
   * Get list of applied migration versions
   */
  async getAppliedMigrations(): Promise<number[]> {
    const results = await this.db
      .prepare(
        `
        SELECT DISTINCT version FROM ${this.tableName}
        WHERE direction = 'up' AND completed_at IS NOT NULL
        ORDER BY version ASC
      `
      )
      .all();

    return (results.results || []).map((r: any) => r.version as number);
  }

  /**
   * Get migration history
   */
  async getHistory(limit = 50): Promise<MigrationHistory[]> {
    const results = await this.db
      .prepare(
        `
        SELECT * FROM ${this.tableName}
        ORDER BY created_at DESC LIMIT ?
      `
      )
      .bind(limit)
      .all();

    return (results.results || []).map(this.mapRecord);
  }

  /**
   * Get failed migrations
   */
  async getFailedMigrations(): Promise<Array<{ version: number; error: string }>> {
    const results = await this.db
      .prepare(
        `
        SELECT version, error FROM ${this.tableName}
        WHERE failed_at IS NOT NULL
        ORDER BY version ASC
      `
      )
      .all();

    return (results.results || []).map((r: any) => ({
      version: r.version as number,
      error: r.error as string
    }));
  }

  /**
   * Get migration record by version
   */
  async getRecord(version: number): Promise<MigrationHistory | null> {
    const result = await this.db
      .prepare(
        `
        SELECT * FROM ${this.tableName}
        WHERE version = ?
        ORDER BY created_at DESC LIMIT 1
      `
      )
      .bind(version)
      .first();

    return result ? this.mapRecord(result) : null;
  }

  /**
   * Record migration start
   */
  async recordStart(record: MigrationRecord): Promise<void> {
    await this.db
      .prepare(
        `
        INSERT INTO ${this.tableName} (
          version, name, direction, started_at
        ) VALUES (?, ?, ?, ?)
      `
      )
      .bind(record.version, record.name, record.direction, record.startedAt || Date.now())
      .run();
  }

  /**
   * Record migration completion
   */
  async recordComplete(record: MigrationRecord): Promise<void> {
    await this.db
      .prepare(
        `
        UPDATE ${this.tableName}
        SET completed_at = ?,
            duration = ?,
            error = NULL
        WHERE version = ?
          AND direction = ?
          AND started_at = ?
          AND completed_at IS NULL
      `
      )
      .bind(
        record.completedAt || Date.now(),
        record.duration,
        record.version,
        record.direction,
        record.startedAt || Date.now()
      )
      .run();
  }

  /**
   * Record migration failure
   */
  async recordFailure(record: MigrationRecord): Promise<void> {
    await this.db
      .prepare(
        `
        UPDATE ${this.tableName}
        SET failed_at = ?,
            duration = ?,
            error = ?
        WHERE version = ?
          AND direction = ?
          AND started_at = ?
          AND completed_at IS NULL
      `
      )
      .bind(
        record.failedAt || Date.now(),
        record.duration,
        record.error,
        record.version,
        record.direction,
        record.startedAt || Date.now()
      )
      .run();
  }

  /**
   * Clear migration history
   */
  async clearHistory(): Promise<void> {
    await this.db.prepare(`DELETE FROM ${this.tableName}`).run();
  }

  /**
   * Get migration checksum
   */
  async getChecksum(version: number): Promise<string | null> {
    const result = await this.db
      .prepare(
        `
        SELECT checksum FROM ${this.tableName}
        WHERE version = ? AND checksum IS NOT NULL
        ORDER BY created_at DESC LIMIT 1
      `
      )
      .bind(version)
      .first();

    return (result?.checksum as string) || null;
  }

  /**
   * Map database record to MigrationHistory
   */
  private mapRecord(row: any): MigrationHistory {
    return {
      id: row.id,
      version: row.version,
      name: row.name,
      direction: row.direction,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      failedAt: row.failed_at,
      duration: row.duration,
      error: row.error,
      checksum: row.checksum
    };
  }
}
