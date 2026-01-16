/**
 * Storage Adapter
 * Provides storage abstraction with multiple backend implementations
 */

import {
  StorageAdapter,
  ErrorEvent,
  ErrorGroup,
  Alert,
  AlertRule,
  ErrorQuery,
  ErrorTrend,
  ErrorFrequency,
  ErrorImpact
} from '../types';

// ============================================================================
// In-Memory Storage Implementation
// ============================================================================

export class InMemoryStorage implements StorageAdapter {
  private errors: Map<string, ErrorEvent> = new Map();
  private groups: Map<string, ErrorGroup> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private errorGroupsByFingerprint: Map<string, string> = new Map();
  private initialized: boolean = false;

  async init(): Promise<void> {
    this.initialized = true;
  }

  // Error operations
  async storeError(error: ErrorEvent): Promise<void> {
    this.errors.set(error.id, error);

    // Update fingerprint index
    if (error.fingerprint) {
      this.errorGroupsByFingerprint.set(error.fingerprint, error.id);
    }
  }

  async getError(id: string): Promise<ErrorEvent | null> {
    return this.errors.get(id) || null;
  }

  async getErrors(query?: ErrorQuery): Promise<ErrorEvent[]> {
    let errors = Array.from(this.errors.values());

    if (query) {
      errors = this.applyErrorQuery(errors, query);
    }

    return errors;
  }

  async updateError(id: string, updates: Partial<ErrorEvent>): Promise<void> {
    const error = this.errors.get(id);
    if (error) {
      this.errors.set(id, { ...error, ...updates });
    }
  }

  async deleteError(id: string): Promise<void> {
    const error = this.errors.get(id);
    if (error) {
      if (error.fingerprint) {
        this.errorGroupsByFingerprint.delete(error.fingerprint);
      }
      this.errors.delete(id);
    }
  }

  // Group operations
  async getGroupedErrors(fingerprint: string): Promise<ErrorEvent[]> {
    return Array.from(this.errors.values()).filter(
      e => e.fingerprint === fingerprint
    );
  }

  async createGroup(group: ErrorGroup): Promise<void> {
    this.groups.set(group.id, group);
  }

  async getGroup(id: string): Promise<ErrorGroup | null> {
    return this.groups.get(id) || null;
  }

  async getGroups(query?: ErrorQuery): Promise<ErrorGroup[]> {
    let groups = Array.from(this.groups.values());

    if (query) {
      groups = this.applyGroupQuery(groups, query);
    }

    return groups;
  }

  async updateGroup(id: string, updates: Partial<ErrorGroup>): Promise<void> {
    const group = this.groups.get(id);
    if (group) {
      this.groups.set(id, { ...group, ...updates });
    }
  }

  async deleteGroup(id: string): Promise<void> {
    this.groups.delete(id);
  }

  // Search operations
  async searchErrors(searchTerm: string, query?: ErrorQuery): Promise<ErrorEvent[]> {
    const term = searchTerm.toLowerCase();
    let errors = Array.from(this.errors.values()).filter(error => {
      return (
        error.message.toLowerCase().includes(term) ||
        error.type.toLowerCase().includes(term) ||
        error.stack?.toLowerCase().includes(term)
      );
    });

    if (query) {
      errors = this.applyErrorQuery(errors, query);
    }

    return errors;
  }

  // Analytics operations
  async getErrorTrends(period: string, limit: number = 10): Promise<ErrorTrend[]> {
    const now = Date.now();
    let periodMs: number;

    switch (period) {
      case 'hour':
        periodMs = 3600000;
        break;
      case 'day':
        periodMs = 86400000;
        break;
      case 'week':
        periodMs = 604800000;
        break;
      default:
        periodMs = 86400000;
    }

    const grouped = new Map<number, ErrorEvent[]>();

    for (const error of this.errors.values()) {
      const periodStart = Math.floor(error.timestamp / periodMs) * periodMs;
      if (!grouped.has(periodStart)) {
        grouped.set(periodStart, []);
      }
      grouped.get(periodStart)!.push(error);
    }

    const trends: ErrorTrend[] = [];

    for (const [timestamp, periodErrors] of grouped.entries()) {
      const uniqueErrors = new Set(periodErrors.map(e => e.id)).size;
      const typeCounts = new Map<string, number>();

      for (const error of periodErrors) {
        typeCounts.set(error.type, (typeCounts.get(error.type) || 0) + 1);
      }

      const topErrors = Array.from(typeCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      trends.push({
        period: new Date(timestamp).toISOString(),
        timestamp,
        totalErrors: periodErrors.length,
        uniqueErrors,
        errorRate: 0, // Would need session data
        topErrors
      });
    }

    return trends
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-limit);
  }

  async getErrorFrequencies(period: string, limit: number = 10): Promise<ErrorFrequency[]> {
    const now = Date.now();
    let periodMs: number;

    switch (period) {
      case 'hour':
        periodMs = 3600000;
        break;
      case 'day':
        periodMs = 86400000;
        break;
      case 'week':
        periodMs = 604800000;
        break;
      default:
        periodMs = 86400000;
    }

    const cutoff = now - periodMs;
    const recentErrors = Array.from(this.errors.values()).filter(
      e => e.timestamp >= cutoff
    );

    const frequencies = new Map<string, number>();
    let total = 0;

    for (const error of recentErrors) {
      frequencies.set(error.type, (frequencies.get(error.type) || 0) + 1);
      total++;
    }

    return Array.from(frequencies.entries())
      .map(([errorType, count]) => ({
        errorType,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
        trend: 'stable' as const,
        changePercent: 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getErrorImpact(period: string): Promise<ErrorImpact> {
    const now = Date.now();
    let periodMs: number;

    switch (period) {
      case 'hour':
        periodMs = 3600000;
        break;
      case 'day':
        periodMs = 86400000;
        break;
      case 'week':
        periodMs = 604800000;
        break;
      default:
        periodMs = 86400000;
    }

    const cutoff = now - periodMs;
    const errors = Array.from(this.errors.values()).filter(
      e => e.timestamp >= cutoff
    );

    const uniqueErrors = new Set(errors.map(e => e.id)).size;
    const uniqueUsers = new Set(
      errors.filter(e => e.user?.id).map(e => e.user!.id!)
    ).size;

    const severityDistribution: Record<string, number> = {};
    const categoryDistribution: Record<string, number> = {};

    for (const error of errors) {
      severityDistribution[error.severity] =
        (severityDistribution[error.severity] || 0) + 1;
      categoryDistribution[error.category] =
        (categoryDistribution[error.category] || 0) + 1;
    }

    return {
      affectedUsers: uniqueUsers,
      affectedSessions: uniqueErrors,
      totalErrors: errors.length,
      errorRate: 0,
      severityDistribution: severityDistribution as any,
      categoryDistribution: categoryDistribution as any
    };
  }

  // Alert operations
  async storeAlert(alert: Alert): Promise<void> {
    this.alerts.set(alert.id, alert);
  }

  async getAlert(id: string): Promise<Alert | null> {
    return this.alerts.get(id) || null;
  }

  async getAlerts(query?: ErrorQuery): Promise<Alert[]> {
    let alerts = Array.from(this.alerts.values());

    if (query) {
      alerts = this.applyAlertQuery(alerts, query);
    }

    return alerts;
  }

  async updateAlert(id: string, updates: Partial<Alert>): Promise<void> {
    const alert = this.alerts.get(id);
    if (alert) {
      this.alerts.set(id, { ...alert, ...updates });
    }
  }

  async deleteAlert(id: string): Promise<void> {
    this.alerts.delete(id);
  }

  // Rule operations
  async storeRule(rule: AlertRule): Promise<void> {
    this.rules.set(rule.id, rule);
  }

  async getRule(id: string): Promise<AlertRule | null> {
    return this.rules.get(id) || null;
  }

  async getRules(): Promise<AlertRule[]> {
    return Array.from(this.rules.values());
  }

  async updateRule(id: string, updates: Partial<AlertRule>): Promise<void> {
    const rule = this.rules.get(id);
    if (rule) {
      this.rules.set(id, { ...rule, ...updates });
    }
  }

  async deleteRule(id: string): Promise<void> {
    this.rules.delete(id);
  }

  // Maintenance
  async cleanup(retentionDays: number): Promise<void> {
    const cutoff = Date.now() - retentionDays * 86400000;

    for (const [id, error] of this.errors.entries()) {
      if (error.timestamp < cutoff) {
        this.errors.delete(id);
      }
    }

    for (const [id, group] of this.groups.entries()) {
      if (group.lastSeen < cutoff) {
        this.groups.delete(id);
      }
    }
  }

  async close(): Promise<void> {
    this.errors.clear();
    this.groups.clear();
    this.alerts.clear();
    this.rules.clear();
    this.errorGroupsByFingerprint.clear();
    this.initialized = false;
  }

  // Query helpers
  private applyErrorQuery(errors: ErrorEvent[], query: ErrorQuery): ErrorEvent[] {
    let filtered = errors;

    if (query.filters) {
      filtered = filtered.filter(error =>
        query.filters!.every(filter =>
          this.matchesFilter(error, filter)
        )
      );
    }

    if (query.sortBy) {
      filtered.sort((a, b) => {
        const aVal = this.getNestedValue(a, query.sortBy!);
        const bVal = this.getNestedValue(b, query.sortBy!);

        if (query.sortOrder === 'desc') {
          return bVal > aVal ? 1 : -1;
        }
        return aVal > bVal ? 1 : -1;
      });
    }

    if (query.limit) {
      const start = query.offset || 0;
      filtered = filtered.slice(start, start + query.limit);
    }

    return filtered;
  }

  private applyGroupQuery(groups: ErrorGroup[], query: ErrorQuery): ErrorGroup[] {
    let filtered = groups;

    if (query.filters) {
      filtered = filtered.filter(group =>
        query.filters!.every(filter =>
          this.matchesGroupFilter(group, filter)
        )
      );
    }

    if (query.sortBy) {
      filtered.sort((a, b) => {
        const aVal = this.getNestedValue(a, query.sortBy!);
        const bVal = this.getNestedValue(b, query.sortBy!);

        if (query.sortOrder === 'desc') {
          return bVal > aVal ? 1 : -1;
        }
        return aVal > bVal ? 1 : -1;
      });
    }

    if (query.limit) {
      const start = query.offset || 0;
      filtered = filtered.slice(start, start + query.limit);
    }

    return filtered;
  }

  private applyAlertQuery(alerts: Alert[], query: ErrorQuery): Alert[] {
    let filtered = alerts;

    if (query.filters) {
      filtered = filtered.filter(alert =>
        query.filters!.every(filter =>
          this.matchesAlertFilter(alert, filter)
        )
      );
    }

    if (query.sortBy) {
      filtered.sort((a, b) => {
        const aVal = this.getNestedValue(a, query.sortBy!);
        const bVal = this.getNestedValue(b, query.sortBy!);

        if (query.sortOrder === 'desc') {
          return bVal > aVal ? 1 : -1;
        }
        return aVal > bVal ? 1 : -1;
      });
    }

    if (query.limit) {
      const start = query.offset || 0;
      filtered = filtered.slice(start, start + query.limit);
    }

    return filtered;
  }

  private matchesFilter(error: ErrorEvent, filter: any): boolean {
    const value = this.getNestedValue(error, filter.field);

    switch (filter.operator) {
      case 'eq':
        return value === filter.value;
      case 'ne':
        return value !== filter.value;
      case 'gt':
        return typeof value === 'number' && value > filter.value;
      case 'gte':
        return typeof value === 'number' && value >= filter.value;
      case 'lt':
        return typeof value === 'number' && value < filter.value;
      case 'lte':
        return typeof value === 'number' && value <= filter.value;
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value);
      case 'contains':
        return typeof value === 'string' && value.includes(filter.value);
      default:
        return false;
    }
  }

  private matchesGroupFilter(group: ErrorGroup, filter: any): boolean {
    const value = this.getNestedValue(group, filter.field);
    // Similar logic to matchesFilter
    return value === filter.value;
  }

  private matchesAlertFilter(alert: Alert, filter: any): boolean {
    const value = this.getNestedValue(alert, filter.field);
    // Similar logic to matchesFilter
    return value === filter.value;
  }

  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let value = obj;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }
}

// ============================================================================
// PostgreSQL Storage Implementation
// ============================================================================()

export class PostgreSQLStorage implements StorageAdapter {
  private pool: any;
  private initialized: boolean = false;

  constructor(connectionConfig: any) {
    // In a real implementation, this would use pg (node-postgres)
    // For now, we'll use a mock
    this.pool = {
      query: async (text: string, params?: any[]) => {
        console.log('PostgreSQL query:', text, params);
        return { rows: [] };
      },
      connect: async () => ({
        query: async (text: string, params?: any[]) => ({ rows: [] }),
        release: () => {}
      }),
      end: async () => {}
    };
  }

  async init(): Promise<void> {
    // Create tables
    await this.createTables();
    this.initialized = true;
  }

  private async createTables(): Promise<void> {
    const client = await this.pool.connect();

    try {
      // Errors table
      await client.query(`
        CREATE TABLE IF NOT EXISTS error_events (
          id UUID PRIMARY KEY,
          timestamp BIGINT NOT NULL,
          error_type VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          stack TEXT,
          severity VARCHAR(50) NOT NULL,
          category VARCHAR(100) NOT NULL,
          priority INTEGER NOT NULL,
          status VARCHAR(50) NOT NULL,
          context JSONB,
          breadcrumbs JSONB,
          user_id VARCHAR(255),
          request JSONB,
          custom_data JSONB,
          attachments JSONB,
          tags JSONB,
          fingerprint VARCHAR(255),
          group_id VARCHAR(255),
          occurrences INTEGER NOT NULL DEFAULT 1,
          first_seen BIGINT NOT NULL,
          last_seen BIGINT NOT NULL,
          affected_users INTEGER NOT NULL DEFAULT 0,
          handled BOOLEAN NOT NULL DEFAULT false,
          environment VARCHAR(100) NOT NULL,
          release VARCHAR(255),
          distribution VARCHAR(255),
          server_name VARCHAR(255),
          level VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_error_events_timestamp ON error_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_error_events_fingerprint ON error_events(fingerprint);
        CREATE INDEX IF NOT EXISTS idx_error_events_group_id ON error_events(group_id);
        CREATE INDEX IF NOT EXISTS idx_error_events_severity ON error_events(severity);
        CREATE INDEX IF NOT EXISTS idx_error_events_environment ON error_events(environment);

        CREATE TABLE IF NOT EXISTS error_groups (
          id VARCHAR(255) PRIMARY KEY,
          fingerprint VARCHAR(255) UNIQUE NOT NULL,
          title TEXT NOT NULL,
          error_type VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          severity VARCHAR(50) NOT NULL,
          category VARCHAR(100) NOT NULL,
          priority INTEGER NOT NULL,
          status VARCHAR(50) NOT NULL,
          first_seen BIGINT NOT NULL,
          last_seen BIGINT NOT NULL,
          occurrences INTEGER NOT NULL DEFAULT 0,
          affected_users INTEGER NOT NULL DEFAULT 0,
          patterns JSONB,
          potential_causes JSONB,
          suggested_fixes JSONB,
          related_issues JSONB,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_error_groups_fingerprint ON error_groups(fingerprint);
        CREATE INDEX IF NOT EXISTS idx_error_groups_severity ON error_groups(severity);
        CREATE INDEX IF NOT EXISTS idx_error_groups_status ON error_groups(status);

        CREATE TABLE IF NOT EXISTS alerts (
          id UUID PRIMARY KEY,
          rule_id VARCHAR(255) NOT NULL,
          rule_name VARCHAR(255) NOT NULL,
          type VARCHAR(100) NOT NULL,
          severity VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL,
          timestamp BIGINT NOT NULL,
          trigger_data JSONB NOT NULL,
          occurrences INTEGER NOT NULL DEFAULT 0,
          affected_users INTEGER NOT NULL DEFAULT 0,
          acknowledged_by VARCHAR(255),
          acknowledged_at BIGINT,
          resolved_by VARCHAR(255),
          resolved_at BIGINT,
          suppress_until BIGINT,
          suppress_reason TEXT,
          notification_status JSONB,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_alert_rule FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_alerts_rule_id ON alerts(rule_id);
        CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
        CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
        CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);

        CREATE TABLE IF NOT EXISTS alert_rules (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          type VARCHAR(100) NOT NULL,
          enabled BOOLEAN NOT NULL DEFAULT true,
          conditions JSONB NOT NULL,
          actions JSONB NOT NULL,
          cooldown BIGINT,
          throttle_window BIGINT,
          max_alerts_per_window INTEGER,
          group_by JSONB,
          filters JSONB,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);

        CREATE TABLE IF NOT EXISTS alert_history (
          id SERIAL PRIMARY KEY,
          alert_id UUID NOT NULL,
          timestamp BIGINT NOT NULL,
          action VARCHAR(50) NOT NULL,
          user_id VARCHAR(255),
          details JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_alert_history_alert FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id ON alert_history(alert_id);
        CREATE INDEX IF NOT EXISTS idx_alert_history_timestamp ON alert_history(timestamp);
      `);
    } finally {
      client.release();
    }
  }

  // Error operations
  async storeError(error: ErrorEvent): Promise<void> {
    const query = `
      INSERT INTO error_events (
        id, timestamp, error_type, message, stack, severity, category,
        priority, status, context, breadcrumbs, user_id, request, custom_data,
        attachments, tags, fingerprint, group_id, occurrences, first_seen,
        last_seen, affected_users, handled, environment, release, distribution,
        server_name, level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
                $27, $28)
      ON CONFLICT (id) DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        message = EXCLUDED.message,
        occurrences = EXCLUDED.occurrences,
        last_seen = EXCLUDED.last_seen,
        affected_users = EXCLUDED.affected_users,
        updated_at = CURRENT_TIMESTAMP
    `;

    const params = [
      error.id,
      error.timestamp,
      error.type,
      error.message,
      error.stack,
      error.severity,
      error.category,
      error.priority,
      error.status,
      JSON.stringify(error.context),
      JSON.stringify(error.breadcrumbs),
      error.user?.id,
      JSON.stringify(error.request),
      JSON.stringify(error.customData),
      JSON.stringify(error.attachments),
      JSON.stringify(error.tags),
      error.fingerprint,
      error.groupId,
      error.occurrences,
      error.firstSeen,
      error.lastSeen,
      error.affectedUsers,
      error.handled,
      error.environment,
      error.release,
      error.distribution,
      error.serverName,
      error.level
    ];

    await this.pool.query(query, params);
  }

  async getError(id: string): Promise<ErrorEvent | null> {
    const query = 'SELECT * FROM error_events WHERE id = $1';
    const result = await this.pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToErrorEvent(result.rows[0]);
  }

  async getErrors(query?: ErrorQuery): Promise<ErrorEvent[]> {
    // This is a simplified implementation
    // A real implementation would build dynamic SQL based on query parameters
    const sql = 'SELECT * FROM error_events ORDER BY timestamp DESC LIMIT 1000';
    const result = await this.pool.query(sql);

    return result.rows.map((row: any) => this.mapRowToErrorEvent(row));
  }

  async updateError(id: string, updates: Partial<ErrorEvent>): Promise<void> {
    const setClause = Object.keys(updates)
      .map((key, i) => `${this.camelToSnake(key)} = $${i + 2}`)
      .join(', ');

    const query = `
      UPDATE error_events
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    const params = [id, ...Object.values(updates)];
    await this.pool.query(query, params);
  }

  async deleteError(id: string): Promise<void> {
    const query = 'DELETE FROM error_events WHERE id = $1';
    await this.pool.query(query, [id]);
  }

  // Group operations
  async getGroupedErrors(fingerprint: string): Promise<ErrorEvent[]> {
    const query = 'SELECT * FROM error_events WHERE fingerprint = $1 ORDER BY timestamp DESC';
    const result = await this.pool.query(query, [fingerprint]);

    return result.rows.map((row: any) => this.mapRowToErrorEvent(row));
  }

  async createGroup(group: ErrorGroup): Promise<void> {
    const query = `
      INSERT INTO error_groups (
        id, fingerprint, title, error_type, message, severity, category,
        priority, status, first_seen, last_seen, occurrences, affected_users,
        patterns, potential_causes, suggested_fixes, related_issues, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                $15, $16, $17, $18)
      ON CONFLICT (fingerprint) DO UPDATE SET
        occurrences = EXCLUDED.occurrences,
        last_seen = EXCLUDED.last_seen,
        affected_users = EXCLUDED.affected_users,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    `;

    const params = [
      group.id,
      group.fingerprint,
      group.title,
      group.type,
      group.message,
      group.severity,
      group.category,
      group.priority,
      group.status,
      group.firstSeen,
      group.lastSeen,
      group.occurrences,
      group.affectedUsers,
      JSON.stringify(group.patterns),
      JSON.stringify(group.potentialCauses),
      JSON.stringify(group.suggestedFixes),
      JSON.stringify(group.relatedIssues),
      JSON.stringify(group.metadata)
    ];

    await this.pool.query(query, params);
  }

  async getGroup(id: string): Promise<ErrorGroup | null> {
    const query = 'SELECT * FROM error_groups WHERE id = $1';
    const result = await this.pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToErrorGroup(result.rows[0]);
  }

  async getGroups(query?: ErrorQuery): Promise<ErrorGroup[]> {
    const sql = 'SELECT * FROM error_groups ORDER BY last_seen DESC LIMIT 1000';
    const result = await this.pool.query(sql);

    return result.rows.map((row: any) => this.mapRowToErrorGroup(row));
  }

  async updateGroup(id: string, updates: Partial<ErrorGroup>): Promise<void> {
    const setClause = Object.keys(updates)
      .map((key, i) => `${this.camelToSnake(key)} = $${i + 2}`)
      .join(', ');

    const query = `
      UPDATE error_groups
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    const params = [id, ...Object.values(updates)];
    await this.pool.query(query, params);
  }

  async deleteGroup(id: string): Promise<void> {
    const query = 'DELETE FROM error_groups WHERE id = $1';
    await this.pool.query(query, [id]);
  }

  // Search operations
  async searchErrors(searchTerm: string, query?: ErrorQuery): Promise<ErrorEvent[]> {
    const sql = `
      SELECT * FROM error_events
      WHERE message ILIKE $1 OR error_type ILIKE $1 OR stack ILIKE $1
      ORDER BY timestamp DESC
      LIMIT 1000
    `;

    const result = await this.pool.query(sql, [`%${searchTerm}%`]);

    return result.rows.map((row: any) => this.mapRowToErrorEvent(row));
  }

  // Analytics operations (simplified)
  async getErrorTrends(period: string, limit: number = 10): Promise<ErrorTrend[]> {
    // Simplified implementation
    return [];
  }

  async getErrorFrequencies(period: string, limit: number = 10): Promise<ErrorFrequency[]> {
    const sql = `
      SELECT
        error_type,
        COUNT(*) as count,
        (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM error_events)) as percentage
      FROM error_events
      WHERE timestamp >= $1
      GROUP BY error_type
      ORDER BY count DESC
      LIMIT $2
    `;

    const now = Date.now();
    let periodMs: number;

    switch (period) {
      case 'hour':
        periodMs = 3600000;
        break;
      case 'day':
        periodMs = 86400000;
        break;
      case 'week':
        periodMs = 604800000;
        break;
      default:
        periodMs = 86400000;
    }

    const result = await this.pool.query(sql, [now - periodMs, limit]);

    return result.rows.map((row: any) => ({
      errorType: row.error_type,
      count: parseInt(row.count),
      percentage: parseFloat(row.percentage),
      trend: 'stable' as const,
      changePercent: 0
    }));
  }

  async getErrorImpact(period: string): Promise<ErrorImpact> {
    // Simplified implementation
    return {
      affectedUsers: 0,
      affectedSessions: 0,
      totalErrors: 0,
      errorRate: 0,
      severityDistribution: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0
      },
      categoryDistribution: {
        runtime: 0,
        syntax: 0,
        type: 0,
        reference: 0,
        range: 0,
        network: 0,
        api: 0,
        database: 0,
        authentication: 0,
        authorization: 0,
        validation: 0,
        business_logic: 0,
        integration: 0,
        performance: 0,
        memory: 0,
        concurrency: 0,
        unknown: 0
      }
    };
  }

  // Alert operations
  async storeAlert(alert: Alert): Promise<void> {
    const query = `
      INSERT INTO alerts (
        id, rule_id, rule_name, type, severity, status, timestamp,
        trigger_data, occurrences, affected_users, acknowledged_by,
        acknowledged_at, resolved_by, resolved_at, suppress_until,
        suppress_reason, notification_status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                $15, $16, $17, $18)
    `;

    const params = [
      alert.id,
      alert.ruleId,
      alert.ruleName,
      alert.type,
      alert.severity,
      alert.status,
      alert.timestamp,
      JSON.stringify(alert.triggerData),
      alert.occurrences,
      alert.affectedUsers,
      alert.acknowledgedBy,
      alert.acknowledgedAt,
      alert.resolvedBy,
      alert.resolvedAt,
      alert.suppressUntil,
      alert.suppressReason,
      JSON.stringify(alert.notificationStatus),
      JSON.stringify(alert.metadata)
    ];

    await this.pool.query(query, params);
  }

  async getAlert(id: string): Promise<Alert | null> {
    const query = 'SELECT * FROM alerts WHERE id = $1';
    const result = await this.pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToAlert(result.rows[0]);
  }

  async getAlerts(query?: ErrorQuery): Promise<Alert[]> {
    const sql = 'SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 1000';
    const result = await this.pool.query(sql);

    return result.rows.map((row: any) => this.mapRowToAlert(row));
  }

  async updateAlert(id: string, updates: Partial<Alert>): Promise<void> {
    const setClause = Object.keys(updates)
      .map((key, i) => `${this.camelToSnake(key)} = $${i + 2}`)
      .join(', ');

    const query = `
      UPDATE alerts
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    const params = [id, ...Object.values(updates)];
    await this.pool.query(query, params);
  }

  async deleteAlert(id: string): Promise<void> {
    const query = 'DELETE FROM alerts WHERE id = $1';
    await this.pool.query(query, [id]);
  }

  // Rule operations
  async storeRule(rule: AlertRule): Promise<void> {
    const query = `
      INSERT INTO alert_rules (
        id, name, description, type, enabled, conditions, actions,
        cooldown, throttle_window, max_alerts_per_window, group_by,
        filters, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        enabled = EXCLUDED.enabled,
        conditions = EXCLUDED.conditions,
        actions = EXCLUDED.actions,
        updated_at = CURRENT_TIMESTAMP
    `;

    const params = [
      rule.id,
      rule.name,
      rule.description,
      rule.type,
      rule.enabled,
      JSON.stringify(rule.conditions),
      JSON.stringify(rule.actions),
      rule.cooldown,
      rule.throttleWindow,
      rule.maxAlertsPerWindow,
      JSON.stringify(rule.groupBy),
      JSON.stringify(rule.filters),
      JSON.stringify(rule.metadata)
    ];

    await this.pool.query(query, params);
  }

  async getRule(id: string): Promise<AlertRule | null> {
    const query = 'SELECT * FROM alert_rules WHERE id = $1';
    const result = await this.pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToAlertRule(result.rows[0]);
  }

  async getRules(): Promise<AlertRule[]> {
    const sql = 'SELECT * FROM alert_rules ORDER BY created_at DESC';
    const result = await this.pool.query(sql);

    return result.rows.map((row: any) => this.mapRowToAlertRule(row));
  }

  async updateRule(id: string, updates: Partial<AlertRule>): Promise<void> {
    const setClause = Object.keys(updates)
      .map((key, i) => `${this.camelToSnake(key)} = $${i + 2}`)
      .join(', ');

    const query = `
      UPDATE alert_rules
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    const params = [id, ...Object.values(updates)];
    await this.pool.query(query, params);
  }

  async deleteRule(id: string): Promise<void> {
    const query = 'DELETE FROM alert_rules WHERE id = $1';
    await this.pool.query(query, [id]);
  }

  // Maintenance
  async cleanup(retentionDays: number): Promise<void> {
    const cutoff = Date.now() - retentionDays * 86400000;

    await this.pool.query('DELETE FROM error_events WHERE timestamp < $1', [cutoff]);
    await this.pool.query('DELETE FROM error_groups WHERE last_seen < $1', [cutoff]);
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.initialized = false;
  }

  // Mapping helpers
  private mapRowToErrorEvent(row: any): ErrorEvent {
    return {
      id: row.id,
      timestamp: row.timestamp,
      error: new Error(row.message),
      type: row.error_type,
      message: row.message,
      stack: row.stack,
      severity: row.severity,
      category: row.category,
      priority: row.priority,
      status: row.status,
      context: row.context || {},
      breadcrumbs: row.breadcrumbs || [],
      user: row.user_id ? { id: row.user_id } : undefined,
      request: row.request,
      customData: row.custom_data,
      attachments: row.attachments,
      tags: row.tags,
      fingerprint: row.fingerprint,
      groupId: row.group_id,
      occurrences: row.occurrences,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      affectedUsers: row.affected_users,
      handled: row.handled,
      environment: row.environment,
      release: row.release,
      distribution: row.distribution,
      serverName: row.server_name,
      level: row.level
    };
  }

  private mapRowToErrorGroup(row: any): ErrorGroup {
    return {
      id: row.id,
      fingerprint: row.fingerprint,
      title: row.title,
      type: row.error_type,
      message: row.message,
      severity: row.severity,
      category: row.category,
      priority: row.priority,
      status: row.status,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      occurrences: row.occurrences,
      affectedUsers: row.affected_users,
      errors: [],
      patterns: row.patterns || [],
      potentialCauses: row.potential_causes || [],
      suggestedFixes: row.suggested_fixes || [],
      relatedIssues: row.related_issues || [],
      metadata: row.metadata || {}
    };
  }

  private mapRowToAlert(row: any): Alert {
    return {
      id: row.id,
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      type: row.type,
      severity: row.severity,
      status: row.status,
      timestamp: row.timestamp,
      triggerData: row.trigger_data,
      occurrences: row.occurrences,
      affectedUsers: row.affected_users,
      acknowledgedBy: row.acknowledged_by,
      acknowledgedAt: row.acknowledged_at,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      suppressUntil: row.suppress_until,
      suppressReason: row.suppress_reason,
      notificationStatus: row.notification_status,
      metadata: row.metadata
    };
  }

  private mapRowToAlertRule(row: any): AlertRule {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      enabled: row.enabled,
      conditions: row.conditions,
      actions: row.actions,
      cooldown: row.cooldown,
      throttleWindow: row.throttle_window,
      maxAlertsPerWindow: row.max_alerts_per_window,
      groupBy: row.group_by,
      filters: row.filters,
      metadata: row.metadata
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

// ============================================================================
// Storage Factory
// ============================================================================

export class StorageFactory {
  static create(type: 'memory' | 'postgresql', config?: any): StorageAdapter {
    switch (type) {
      case 'memory':
        return new InMemoryStorage();
      case 'postgresql':
        return new PostgreSQLStorage(config);
      default:
        throw new Error(`Unknown storage type: ${type}`);
    }
  }
}
