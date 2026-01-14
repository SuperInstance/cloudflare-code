/**
 * SIEM (Security Information and Event Management) System
 * Log collection, parsing, correlation, and alerting
 */

import {
  LogEntry,
  LogSourceType,
  LogLevel,
  LogParser,
  LogCorrelationRule,
  CorrelatedEvent,
  SIEMAlert,
  ThreatLevel,
  IncidentStatus,
  CorrelationCondition
} from '../types';
import { generateId } from '../utils/helpers';

// ============================================================================
// Log Collector
// ============================================================================

export interface LogCollectorConfig {
  maxBufferSize: number;
  flushInterval: number;
  retentionPeriod: number;
  enableCompression: boolean;
}

export class LogCollector {
  private logs: LogEntry[] = [];
  private config: LogCollectorConfig;
  private parsers: Map<string, LogParser> = new Map();
  private storage?: LogStorage;

  constructor(config: Partial<LogCollectorConfig> = {}) {
    this.config = {
      maxBufferSize: config.maxBufferSize || 10000,
      flushInterval: config.flushInterval || 60000, // 1 minute
      retentionPeriod: config.retentionPeriod || 30 * 24 * 60 * 60 * 1000, // 30 days
      enableCompression: config.enableCompression !== false
    };

    this.initializeDefaultParsers();
    this.startFlushInterval();
  }

  private initializeDefaultParsers(): void {
    // Apache/Nginx access log parser
    this.parsers.set('apache_access', {
      name: 'Apache Access Log',
      pattern: /^(\S+) \S+ \S+ \[([\w:/]+\s[+\-]\d{4})\] "(\S+)\s?(\S+)?\s?(\S+)?" (\d{3}) (\d+|-) "([^"]*)" "([^"]*)"/,
      fieldMappings: {
        '1': 'sourceIp',
        '2': 'timestamp',
        '3': 'method',
        '4': 'path',
        '5': 'protocol',
        '6': 'statusCode',
        '7': 'responseSize',
        '8': 'referer',
        '9': 'userAgent'
      },
      sampleLog: '127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /api/users HTTP/1.1" 200 1234 "-" "Mozilla/5.0"',
      description: 'Parses Apache and Nginx access logs'
    });

    // JSON log parser
    this.parsers.set('json', {
      name: 'JSON Log',
      pattern: /^\{.*\}$/,
      fieldMappings: {},
      sampleLog: '{"level":"info","message":"Request processed","timestamp":"2023-10-10T13:55:36Z"}',
      description: 'Parses JSON formatted logs'
    });

    // Syslog parser
    this.parsers.set('syslog', {
      name: 'Syslog',
      pattern: /^<(\d+)>(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.+)$/,
      fieldMappings: {
        '1': 'priority',
        '2': 'timestamp',
        '3': 'hostname',
        '4': 'message'
      },
      sampleLog: '<34>Oct 11 22:14:15 mymachine su: \'su root\' failed for user on /dev/pts/8',
      description: 'Parses standard syslog format'
    });

    // Security event parser
    this.parsers.set('security', {
      name: 'Security Event',
      pattern: /^\[(\w+)\]\s+\[(\w+)\]\s+(.+)$/,
      fieldMappings: {
        '1': 'eventType',
        '2': 'severity',
        '3': 'message'
      },
      sampleLog: '[AUTH_FAILURE] [HIGH] Failed login attempt for user admin from 192.168.1.100',
      description: 'Parses security event logs'
    });

    // Application error parser
    this.parsers.set('error', {
      name: 'Application Error',
      pattern: /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\s+(\w+)\s+\[(\w+)\]\s+(.+)/,
      fieldMappings: {
        '1': 'timestamp',
        '2': 'level',
        '3': 'component',
        '4': 'message'
      },
      sampleLog: '2023-10-10T13:55:36.123Z ERROR [AuthService] Authentication failed: Invalid credentials',
      description: 'Parses application error logs'
    });
  }

  /**
   * Ingest log entry
   */
  ingest(log: Partial<LogEntry> & { message: string; level: LogLevel; source: LogSourceType }): string {
    const entry: LogEntry = {
      id: generateId(),
      timestamp: log.timestamp || Date.now(),
      level: log.level,
      source: log.source,
      sourceIp: log.sourceIp,
      message: log.message,
      details: log.details || {},
      tags: log.tags || [],
      correlationId: log.correlationId,
      userId: log.userId,
      sessionId: log.sessionId,
      hostname: log.hostname,
      environment: log.environment,
      parsedData: log.parsedData,
      normalizedData: log.normalizedData
    };

    this.logs.push(entry);

    // Auto-flush if buffer is full
    if (this.logs.length >= this.config.maxBufferSize) {
      this.flush();
    }

    return entry.id;
  }

  /**
   * Parse raw log string
   */
  parse(rawLog: string, parserName: string, context?: {
    source?: LogSourceType;
    level?: LogLevel;
    tags?: string[];
    correlationId?: string;
  }): LogEntry | null {
    const parser = this.parsers.get(parserName);
    if (!parser) {
      // Try to parse as JSON
      try {
        const jsonLog = JSON.parse(rawLog);
        return {
          id: generateId(),
          timestamp: jsonLog.timestamp ? new Date(jsonLog.timestamp).getTime() : Date.now(),
          level: jsonLog.level || LogLevel.INFO,
          source: context?.source || LogSourceType.APPLICATION,
          message: jsonLog.message || rawLog,
          details: jsonLog,
          tags: context?.tags || [],
          correlationId: context?.correlationId,
          parsedData: jsonLog,
          normalizedData: this.normalizeLog(jsonLog)
        };
      } catch {
        // Fall back to generic parsing
        return this.createGenericLog(rawLog, context);
      }
    }

    if (parserName === 'json') {
      try {
        const data = JSON.parse(rawLog);
        return {
          id: generateId(),
          timestamp: data.timestamp ? new Date(data.timestamp).getTime() : Date.now(),
          level: data.level || LogLevel.INFO,
          source: context?.source || LogSourceType.APPLICATION,
          message: data.message || rawLog,
          details: data,
          tags: context?.tags || [],
          correlationId: context?.correlationId,
          parsedData: data,
          normalizedData: this.normalizeLog(data)
        };
      } catch {
        return this.createGenericLog(rawLog, context);
      }
    }

    // Apply regex parser
    const match = rawLog.match(parser.pattern);
    if (!match) {
      return this.createGenericLog(rawLog, context);
    }

    const parsedData: Record<string, any> = {};
    for (const [groupIndex, fieldName] of Object.entries(parser.fieldMappings)) {
      const index = parseInt(groupIndex);
      if (match[index]) {
        parsedData[fieldName] = match[index];
      }
    }

    return {
      id: generateId(),
      timestamp: parsedData.timestamp ? new Date(parsedData.timestamp).getTime() : Date.now(),
      level: context?.level || this.mapSeverity(parsedData.severity || parsedData.level),
      source: context?.source || LogSourceType.APPLICATION,
      message: parsedData.message || rawLog,
      sourceIp: parsedData.sourceIp || parsedData.ip,
      details: parsedData,
      tags: context?.tags || [],
      correlationId: context?.correlationId,
      parsedData,
      normalizedData: this.normalizeLog(parsedData)
    };
  }

  /**
   * Create generic log entry
   */
  private createGenericLog(rawLog: string, context?: any): LogEntry {
    return {
      id: generateId(),
      timestamp: Date.now(),
      level: context?.level || LogLevel.INFO,
      source: context?.source || LogSourceType.APPLICATION,
      message: rawLog,
      details: {},
      tags: context?.tags || [],
      correlationId: context?.correlationId,
      parsedData: { raw: rawLog },
      normalizedData: { message: rawLog }
    };
  }

  /**
   * Normalize log data for consistent querying
   */
  private normalizeLog(data: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};

    // Normalize timestamp
    if (data.timestamp) {
      normalized.timestamp = new Date(data.timestamp).getTime();
    }

    // Normalize IP addresses
    if (data.ip || data.sourceIp || data.clientIp) {
      normalized.ip = data.ip || data.sourceIp || data.clientIp;
    }

    // Normalize user identifiers
    if (data.userId || data.user || data.username) {
      normalized.userId = data.userId || data.user || data.username;
    }

    // Normalize HTTP fields
    if (data.method || data.httpMethod) {
      normalized.method = data.method || data.httpMethod;
    }
    if (data.path || data.url || data.uri) {
      normalized.path = data.path || data.url || data.uri;
    }
    if (data.statusCode || data.status) {
      normalized.statusCode = parseInt(data.statusCode || data.status);
    }

    // Normalize severity
    if (data.severity || data.level) {
      normalized.severity = this.normalizeSeverity(data.severity || data.level);
    }

    return normalized;
  }

  /**
   * Map severity string to LogLevel
   */
  private mapSeverity(severity: any): LogLevel {
    if (!severity) return LogLevel.INFO;

    const s = severity.toString().toLowerCase();
    if (['debug', 'trace'].includes(s)) return LogLevel.DEBUG;
    if (['info', 'information'].includes(s)) return LogLevel.INFO;
    if (['warn', 'warning'].includes(s)) return LogLevel.WARN;
    if (['error', 'err'].includes(s)) return LogLevel.ERROR;
    if (['critical', 'fatal', 'emergency'].includes(s)) return LogLevel.CRITICAL;

    return LogLevel.INFO;
  }

  /**
   * Normalize severity to standard levels
   */
  private normalizeSeverity(severity: any): string {
    const s = severity.toString().toLowerCase();
    if (['critical', 'fatal', 'emergency', 'crit'].includes(s)) return 'critical';
    if (['error', 'err'].includes(s)) return 'error';
    if (['warn', 'warning'].includes(s)) return 'warning';
    if (['debug', 'trace'].includes(s)) return 'debug';
    return 'info';
  }

  /**
   * Query logs
   */
  query(filters: {
    level?: LogLevel;
    source?: LogSourceType;
    startTime?: number;
    endTime?: number;
    sourceIp?: string;
    userId?: string;
    correlationId?: string;
    tags?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }): { logs: LogEntry[]; total: number } {
    let filtered = [...this.logs];

    // Apply filters
    if (filters.level) {
      filtered = filtered.filter(log => log.level === filters.level);
    }

    if (filters.source) {
      filtered = filtered.filter(log => log.source === filters.source);
    }

    if (filters.startTime) {
      filtered = filtered.filter(log => log.timestamp >= filters.startTime!);
    }

    if (filters.endTime) {
      filtered = filtered.filter(log => log.timestamp <= filters.endTime!);
    }

    if (filters.sourceIp) {
      filtered = filtered.filter(log => log.sourceIp === filters.sourceIp);
    }

    if (filters.userId) {
      filtered = filtered.filter(log => log.userId === filters.userId);
    }

    if (filters.correlationId) {
      filtered = filtered.filter(log => log.correlationId === filters.correlationId);
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(log =>
        filters.tags!.some(tag => log.tags.includes(tag))
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.details).toLowerCase().includes(searchLower)
      );
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    const total = filtered.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 100;

    const paginated = filtered.slice(offset, offset + limit);

    return {
      logs: paginated,
      total
    };
  }

  /**
   * Flush logs to storage
   */
  async flush(): Promise<void> {
    if (this.logs.length === 0) {
      return;
    }

    const logsToFlush = [...this.logs];

    if (this.storage) {
      await this.storage.store(logsToFlush);
    }

    // Clear flushed logs
    this.logs = [];
  }

  /**
   * Set log storage
   */
  setStorage(storage: LogStorage): void {
    this.storage = storage;
  }

  /**
   * Get log by ID
   */
  getLog(id: string): LogEntry | null {
    return this.logs.find(log => log.id === id) || null;
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logs
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }

  /**
   * Get log statistics
   */
  getStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    bySource: Record<LogSourceType, number>;
    oldestTimestamp?: number;
    newestTimestamp?: number;
  } {
    const byLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      critical: 0
    };

    const bySource: Record<LogSourceType, number> = {} as any;

    let oldestTimestamp: number | undefined;
    let newestTimestamp: number | undefined;

    for (const log of this.logs) {
      byLevel[log.level]++;

      if (!bySource[log.source]) {
        bySource[log.source] = 0;
      }
      bySource[log.source]++;

      if (!oldestTimestamp || log.timestamp < oldestTimestamp) {
        oldestTimestamp = log.timestamp;
      }

      if (!newestTimestamp || log.timestamp > newestTimestamp) {
        newestTimestamp = log.timestamp;
      }
    }

    return {
      total: this.logs.length,
      byLevel,
      bySource,
      oldestTimestamp,
      newestTimestamp
    };
  }

  /**
   * Start automatic flush interval
   */
  private startFlushInterval(): void {
    setInterval(() => {
      this.flush().catch(err => {
        console.error('Failed to flush logs:', err);
      });
    }, this.config.flushInterval);
  }

  /**
   * Add custom parser
   */
  addParser(name: string, parser: LogParser): void {
    this.parsers.set(name, parser);
  }

  /**
   * Remove parser
   */
  removeParser(name: string): void {
    this.parsers.delete(name);
  }

  /**
   * Get parser
   */
  getParser(name: string): LogParser | undefined {
    return this.parsers.get(name);
  }

  /**
   * Get all parsers
   */
  getParsers(): LogParser[] {
    return Array.from(this.parsers.values());
  }
}

// ============================================================================
// Log Storage Interface
// ============================================================================

export interface LogStorage {
  store(logs: LogEntry[]): Promise<void>;
  retrieve(query: any): Promise<LogEntry[]>;
  delete(olderThan: number): Promise<number>;
}

export class InMemoryLogStorage implements LogStorage {
  private storage: Map<string, LogEntry[]> = new Map();

  async store(logs: LogEntry[]): Promise<void> {
    const key = new Date().toISOString().split('T')[0]; // Group by date
    if (!this.storage.has(key)) {
      this.storage.set(key, []);
    }
    this.storage.get(key)!.push(...logs);
  }

  async retrieve(query: any): Promise<LogEntry[]> {
    const allLogs = Array.from(this.storage.values()).flat();
    // Simple implementation - in production, use proper query
    return allLogs.filter(log => {
      if (query.startTime && log.timestamp < query.startTime) return false;
      if (query.endTime && log.timestamp > query.endTime) return false;
      if (query.level && log.level !== query.level) return false;
      return true;
    });
  }

  async delete(olderThan: number): Promise<number> {
    let deleted = 0;
    for (const [key, logs] of this.storage.entries()) {
      const filtered = logs.filter(log => log.timestamp >= olderThan);
      deleted += logs.length - filtered.length;
      if (filtered.length > 0) {
        this.storage.set(key, filtered);
      } else {
        this.storage.delete(key);
      }
    }
    return deleted;
  }
}

// ============================================================================
// Event Correlator
// ============================================================================

export class EventCorrelator {
  private rules: Map<string, LogCorrelationRule> = new Map();
  private eventBuffer: Map<string, LogEntry[]> = new Map();
  private correlatedEvents: CorrelatedEvent[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // Brute force attack detection
    this.addRule({
      id: 'brute_force_login',
      name: 'Multiple Failed Login Attempts',
      description: 'Detects potential brute force attacks on authentication',
      conditions: [
        { field: 'normalizedData.severity', operator: 'equals', value: 'error' },
        { field: 'message', operator: 'contains', value: 'failed login' }
      ],
      timeWindow: 300000, // 5 minutes
      threshold: 5,
      severity: 'high',
      enabled: true,
      actions: ['alert', 'block']
    });

    // DDoS attack detection
    this.addRule({
      id: 'ddos_attack',
      name: 'High Request Rate',
      description: 'Detects potential DDoS attacks',
      conditions: [
        { field: 'source', operator: 'equals', value: LogSourceType.APPLICATION }
      ],
      timeWindow: 60000, // 1 minute
      threshold: 1000,
      severity: 'critical',
      enabled: true,
      actions: ['alert', 'block']
    });

    // SQL Injection detection
    this.addRule({
      id: 'sql_injection',
      name: 'SQL Injection Attempt',
      description: 'Detects SQL injection patterns',
      conditions: [
        { field: 'message', operator: 'matches', value: /(SELECT|INSERT|UPDATE|DELETE|DROP|UNION).*OR.*\d+\s*=\s*\d/i }
      ],
      timeWindow: 10000, // 10 seconds
      threshold: 1,
      severity: 'critical',
      enabled: true,
      actions: ['alert', 'block', 'log']
    });

    // XSS attack detection
    this.addRule({
      id: 'xss_attack',
      name: 'XSS Attack Attempt',
      description: 'Detects cross-site scripting patterns',
      conditions: [
        { field: 'message', operator: 'matches', value: /<script|javascript:|on\w+\s*=/i }
      ],
      timeWindow: 10000,
      threshold: 1,
      severity: 'high',
      enabled: true,
      actions: ['alert', 'block', 'log']
    });

    // Data exfiltration detection
    this.addRule({
      id: 'data_exfiltration',
      name: 'Potential Data Exfiltration',
      description: 'Detects large data transfers',
      conditions: [
        { field: 'normalizedData.statusCode', operator: 'equals', value: 200 },
        { field: 'normalizedData.responseSize', operator: 'gt', value: 10485760 } // > 10MB
      ],
      timeWindow: 300000,
      threshold: 3,
      severity: 'high',
      enabled: true,
      actions: ['alert', 'quarantine']
    });

    // Multiple authentication failures from same IP
    this.addRule({
      id: 'auth_failures_by_ip',
      name: 'Authentication Failures from Single IP',
      description: 'Detects multiple auth failures from same IP address',
      conditions: [
        { field: 'normalizedData.ip', operator: 'equals', value: '*' },
        { field: 'level', operator: 'equals', value: LogLevel.ERROR }
      ],
      timeWindow: 300000,
      threshold: 10,
      severity: 'medium',
      enabled: true,
      actions: ['alert', 'block']
    });
  }

  /**
   * Process log entry for correlation
   */
  process(log: LogEntry): CorrelatedEvent[] {
    const correlations: CorrelatedEvent[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      if (this.matchesRule(log, rule)) {
        const correlation = this.addToCorrelation(log, rule);
        if (correlation) {
          correlations.push(correlation);
        }
      }
    }

    return correlations;
  }

  /**
   * Check if log matches rule conditions
   */
  private matchesRule(log: LogEntry, rule: LogCorrelationRule): boolean {
    for (const condition of rule.conditions) {
      if (!this.matchesCondition(log, condition)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if log matches a single condition
   */
  private matchesCondition(log: LogEntry, condition: CorrelationCondition): boolean {
    let fieldValue: any;

    // Navigate nested fields
    const fieldPath = condition.field.split('.');
    fieldValue = log as any;
    for (const part of fieldPath) {
      if (fieldValue && typeof fieldValue === 'object') {
        fieldValue = fieldValue[part];
      } else {
        fieldValue = undefined;
        break;
      }
    }

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(condition.value);
      case 'matches':
        return typeof fieldValue === 'string' && new RegExp(condition.value).test(fieldValue);
      case 'gt':
        return typeof fieldValue === 'number' && fieldValue > condition.value;
      case 'lt':
        return typeof fieldValue === 'number' && fieldValue < condition.value;
      case 'gte':
        return typeof fieldValue === 'number' && fieldValue >= condition.value;
      case 'lte':
        return typeof fieldValue === 'number' && fieldValue <= condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      default:
        return false;
    }
  }

  /**
   * Add log to correlation buffer
   */
  private addToCorrelation(log: LogEntry, rule: LogCorrelationRule): CorrelatedEvent | null {
    const key = rule.id;
    const now = Date.now();

    // Initialize buffer for rule
    if (!this.eventBuffer.has(key)) {
      this.eventBuffer.set(key, []);
    }

    const buffer = this.eventBuffer.get(key)!;

    // Add new event
    buffer.push(log);

    // Remove old events outside time window
    const cutoffTime = now - rule.timeWindow;
    const validEvents = buffer.filter(e => e.timestamp >= cutoffTime);
    this.eventBuffer.set(key, validEvents);

    // Check if threshold is met
    if (validEvents.length >= rule.threshold) {
      const correlation: CorrelatedEvent = {
        id: generateId(),
        ruleId: rule.id,
        ruleName: rule.name,
        events: validEvents,
        matchCount: validEvents.length,
        firstEvent: validEvents[0].timestamp,
        lastEvent: validEvents[validEvents.length - 1].timestamp,
        severity: rule.severity,
        confidence: Math.min(validEvents.length / rule.threshold, 1),
        description: `${rule.name}: ${validEvents.length} events in ${rule.timeWindow / 1000} seconds`,
        indicators: this.extractIndicators(validEvents),
        status: 'open'
      };

      this.correlatedEvents.push(correlation);

      // Clear buffer after correlation
      this.eventBuffer.set(key, []);

      return correlation;
    }

    return null;
  }

  /**
   * Extract indicators from correlated events
   */
  private extractIndicators(events: LogEntry[]): string[] {
    const indicators: string[] = [];
    const ips = new Set<string>();
    const userIds = new Set<string>();

    for (const event of events) {
      if (event.sourceIp) {
        ips.add(event.sourceIp);
      }
      if (event.userId) {
        userIds.add(event.userId);
      }
    }

    if (ips.size > 0) {
      indicators.push(`IPs: ${Array.from(ips).join(', ')}`);
    }

    if (userIds.size > 0) {
      indicators.push(`Users: ${Array.from(userIds).join(', ')}`);
    }

    return indicators;
  }

  /**
   * Add correlation rule
   */
  addRule(rule: LogCorrelationRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove correlation rule
   */
  removeRule(id: string): void {
    this.rules.delete(id);
  }

  /**
   * Get rule
   */
  getRule(id: string): LogCorrelationRule | undefined {
    return this.rules.get(id);
  }

  /**
   * Get all rules
   */
  getRules(): LogCorrelationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get correlated events
   */
  getCorrelatedEvents(filters?: {
    ruleId?: string;
    severity?: ThreatLevel;
    status?: IncidentStatus;
    startTime?: number;
    endTime?: number;
  }): CorrelatedEvent[] {
    let filtered = [...this.correlatedEvents];

    if (filters) {
      if (filters.ruleId) {
        filtered = filtered.filter(e => e.ruleId === filters.ruleId);
      }
      if (filters.severity) {
        filtered = filtered.filter(e => e.severity === filters.severity);
      }
      if (filters.status) {
        filtered = filtered.filter(e => e.status === filters.status);
      }
      if (filters.startTime) {
        filtered = filtered.filter(e => e.firstEvent >= filters.startTime!);
      }
      if (filters.endTime) {
        filtered = filtered.filter(e => e.lastEvent <= filters.endTime!);
      }
    }

    return filtered.sort((a, b) => b.lastEvent - a.lastEvent);
  }

  /**
   * Update correlated event status
   */
  updateEventStatus(id: string, status: IncidentStatus): boolean {
    const event = this.correlatedEvents.find(e => e.id === id);
    if (event) {
      event.status = status;
      return true;
    }
    return false;
  }

  /**
   * Clear old correlated events
   */
  clearOldEvents(olderThan: number): number {
    const before = this.correlatedEvents.length;
    this.correlatedEvents = this.correlatedEvents.filter(e => e.lastEvent >= olderThan);
    return before - this.correlatedEvents.length;
  }
}

// ============================================================================
// Alert Manager
// ============================================================================

export class AlertManager {
  private alerts: Map<string, SIEMAlert> = new Map();
  private alertHandlers: Map<string, (alert: SIEMAlert) => Promise<void>> = new Map();

  /**
   * Create alert from correlated event
   */
  createFromCorrelation(correlation: CorrelatedEvent): SIEMAlert {
    const alert: SIEMAlert = {
      id: generateId(),
      title: correlation.ruleName,
      description: correlation.description,
      severity: correlation.severity,
      status: correlation.severity === 'critical' ? 'investigating' : 'open',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      correlatedEvent: correlation,
      incidents: [],
      tags: ['correlation', correlation.ruleId]
    };

    this.alerts.set(alert.id, alert);
    this.notifyHandlers(alert);

    return alert;
  }

  /**
   * Create alert from threat detection
   */
  createFromThreat(detection: any): SIEMAlert {
    const alert: SIEMAlert = {
      id: generateId(),
      title: `${detection.threatType} detected`,
      description: `Threat detected with ${detection.confidence} confidence`,
      severity: detection.severity,
      status: detection.isBlocked ? 'resolved' : 'open',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      threatDetection: detection,
      incidents: [],
      tags: ['threat', detection.threatType]
    };

    this.alerts.set(alert.id, alert);
    this.notifyHandlers(alert);

    return alert;
  }

  /**
   * Update alert
   */
  updateAlert(id: string, updates: Partial<SIEMAlert>): SIEMAlert | null {
    const alert = this.alerts.get(id);
    if (!alert) {
      return null;
    }

    const updated = {
      ...alert,
      ...updates,
      updatedAt: Date.now()
    };

    this.alerts.set(id, updated);
    return updated;
  }

  /**
   * Assign alert to user
   */
  assignAlert(id: string, userId: string): boolean {
    const alert = this.alerts.get(id);
    if (!alert) {
      return false;
    }

    alert.assignedTo = userId;
    alert.updatedAt = Date.now();
    return true;
  }

  /**
   * Close alert
   */
  closeAlert(id: string): boolean {
    const alert = this.alerts.get(id);
    if (!alert) {
      return false;
    }

    alert.status = 'closed';
    alert.updatedAt = Date.now();
    return true;
  }

  /**
   * Get alert
   */
  getAlert(id: string): SIEMAlert | undefined {
    return this.alerts.get(id);
  }

  /**
   * Get all alerts
   */
  getAlerts(filters?: {
    severity?: ThreatLevel;
    status?: IncidentStatus;
    assignedTo?: string;
    tags?: string[];
  }): SIEMAlert[] {
    let alerts = Array.from(this.alerts.values());

    if (filters) {
      if (filters.severity) {
        alerts = alerts.filter(a => a.severity === filters.severity);
      }
      if (filters.status) {
        alerts = alerts.filter(a => a.status === filters.status);
      }
      if (filters.assignedTo) {
        alerts = alerts.filter(a => a.assignedTo === filters.assignedTo);
      }
      if (filters.tags && filters.tags.length > 0) {
        alerts = alerts.filter(a =>
          filters.tags!.some(tag => a.tags.includes(tag))
        );
      }
    }

    return alerts.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Register alert handler
   */
  registerHandler(name: string, handler: (alert: SIEMAlert) => Promise<void>): void {
    this.alertHandlers.set(name, handler);
  }

  /**
   * Unregister alert handler
   */
  unregisterHandler(name: string): void {
    this.alertHandlers.delete(name);
  }

  /**
   * Notify all handlers
   */
  private async notifyHandlers(alert: SIEMAlert): Promise<void> {
    const promises = Array.from(this.alertHandlers.values()).map(handler => handler(alert));
    await Promise.allSettled(promises);
  }
}
