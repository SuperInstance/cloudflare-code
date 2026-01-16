/**
 * Audit Logging - Comprehensive audit trail and compliance logging
 * Provides immutable audit logs, event correlation, and compliance reporting
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import {
  AuditEvent,
  AuditEventType,
  AuditCategory,
  AuditSeverity,
  AuditOutcome,
  PrincipalInfo,
  PrincipalType,
  ResourceInfo,
  DataClassification,
  AuditMetadata,
  AuditQuery,
  AuditReport,
  AuditSummary,
  ComplianceMapping,
  ComplianceFramework,
} from '../types';

// ============================================================================
// AUDIT EVENT STORAGE
// ============================================================================

export interface AuditEventStorage {
  append(event: AuditEvent): Promise<void>;
  query(query: AuditQuery): Promise<AuditEvent[]>;
  getEvent(eventId: string): Promise<AuditEvent | null>;
  getEventsByCorrelationId(correlationId: string): Promise<AuditEvent[]>;
  deleteOldEvents(beforeDate: Date): Promise<number>;
  count(query?: AuditQuery): Promise<number>;
}

export class InMemoryAuditStorage implements AuditEventStorage {
  private events: AuditEvent[] = [];
  private maxEvents: number = 100000;

  async append(event: AuditEvent): Promise<void> {
    this.events.push(event);

    // Prevent unbounded growth
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  async query(query: AuditQuery): Promise<AuditEvent[]> {
    let results = [...this.events];

    // Apply filters
    if (query.startDate) {
      results = results.filter(e => e.timestamp >= query.startDate!);
    }

    if (query.endDate) {
      results = results.filter(e => e.timestamp <= query.endDate!);
    }

    if (query.eventTypes && query.eventTypes.length > 0) {
      results = results.filter(e => query.eventTypes!.includes(e.eventType));
    }

    if (query.categories && query.categories.length > 0) {
      results = results.filter(e => query.categories!.includes(e.category));
    }

    if (query.severities && query.severities.length > 0) {
      results = results.filter(e => query.severities!.includes(e.severity));
    }

    if (query.principals && query.principals.length > 0) {
      results = results.filter(e => query.principals!.includes(e.principal.id));
    }

    if (query.resources && query.resources.length > 0) {
      results = results.filter(e => query.resources!.includes(e.resource.id));
    }

    if (query.outcomes && query.outcomes.length > 0) {
      results = results.filter(e => query.outcomes!.includes(e.outcome));
    }

    // Sort
    results.sort((a, b) => {
      const dateA = a.timestamp.getTime();
      const dateB = b.timestamp.getTime();
      return query.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    // Apply pagination
    if (query.offset) {
      results = results.slice(query.offset);
    }

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async getEvent(eventId: string): Promise<AuditEvent | null> {
    return this.events.find(e => e.eventId === eventId) || null;
  }

  async getEventsByCorrelationId(correlationId: string): Promise<AuditEvent[]> {
    return this.events.filter(e => e.correlationId === correlationId);
  }

  async deleteOldEvents(beforeDate: Date): Promise<number> {
    const beforeCount = this.events.length;
    this.events = this.events.filter(e => e.timestamp >= beforeDate);
    return beforeCount - this.events.length;
  }

  async count(query?: AuditQuery): Promise<number> {
    if (!query) {
      return this.events.length;
    }
    return (await this.query(query)).length;
  }
}

// ============================================================================
// AUDIT LOGGER
// ============================================================================

export interface AuditLoggerConfig {
  storage?: AuditEventStorage;
  source: string;
  environment: string;
  platform: string;
  version?: string;
  asyncLogging?: boolean;
  flushInterval?: number;
  bufferSize?: number;
  retentionDays?: number;
}

export class AuditLogger extends EventEmitter {
  private storage: AuditEventStorage;
  private config: Required<Omit<AuditLoggerConfig, 'storage' | 'version'>> & {
    version?: string;
  };
  private buffer: AuditEvent[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: AuditLoggerConfig) {
    super();
    this.storage = config.storage || new InMemoryAuditStorage();
    this.config = {
      source: config.source,
      environment: config.environment,
      platform: config.platform,
      version: config.version,
      asyncLogging: config.asyncLogging ?? true,
      flushInterval: config.flushInterval || 5000,
      bufferSize: config.bufferSize || 100,
      retentionDays: config.retentionDays || 90,
    };

    // Start flush timer for async logging
    if (this.config.asyncLogging) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
  }

  /**
   * Log an audit event
   */
  async log(event: Omit<AuditEvent, 'eventId' | 'timestamp' | 'metadata'>): Promise<string> {
    const auditEvent: AuditEvent = {
      eventId: uuidv4(),
      timestamp: new Date(),
      metadata: this.buildMetadata(),
      ...event,
    };

    if (this.config.asyncLogging) {
      this.buffer.push(auditEvent);

      // Flush if buffer is full
      if (this.buffer.length >= this.config.bufferSize) {
        await this.flush();
      }

      // Emit event for real-time monitoring
      this.emit('event', auditEvent);

      // Emit alerts for critical events
      if (auditEvent.severity === AuditSeverity.CRITICAL) {
        this.emit('critical', auditEvent);
      }

      return auditEvent.eventId;
    } else {
      await this.storage.append(auditEvent);
      this.emit('event', auditEvent);
      return auditEvent.eventId;
    }
  }

  /**
   * Flush buffered events to storage
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const eventsToFlush = [...this.buffer];
    this.buffer = [];

    for (const event of eventsToFlush) {
      await this.storage.append(event);
    }
  }

  /**
   * Query audit events
   */
  async query(query: AuditQuery): Promise<AuditEvent[]> {
    return this.storage.query(query);
  }

  /**
   * Get a specific event by ID
   */
  async getEvent(eventId: string): Promise<AuditEvent | null> {
    return this.storage.getEvent(eventId);
  }

  /**
   * Get all events for a correlation ID
   */
  async getEventsByCorrelationId(correlationId: string): Promise<AuditEvent[]> {
    return this.storage.getEventsByCorrelationId(correlationId);
  }

  /**
   * Count events matching a query
   */
  async count(query?: AuditQuery): Promise<number> {
    return this.storage.count(query);
  }

  /**
   * Delete old events (for retention management)
   */
  async deleteOldEvents(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    return this.storage.deleteOldEvents(cutoffDate);
  }

  /**
   * Generate an audit report
   */
  async generateReport(params: {
    startDate: Date;
    endDate: Date;
    frameworks?: ComplianceFramework[];
  }): Promise<AuditReport> {
    const query: AuditQuery = {
      startDate: params.startDate,
      endDate: params.endDate,
      sortOrder: 'asc',
    };

    const events = await this.query(query);
    const summary = this.generateSummary(events);
    const complianceMappings = this.mapToCompliance(events, params.frameworks);

    return {
      reportId: uuidv4(),
      generatedAt: new Date(),
      period: {
        start: params.startDate,
        end: params.endDate,
      },
      summary,
      events,
      complianceMappings,
    };
  }

  /**
   * Close the audit logger and flush remaining events
   */
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private buildMetadata(): AuditMetadata {
    return {
      source: this.config.source,
      environment: this.config.environment,
      platform: this.config.platform,
      version: this.config.version,
      tags: {},
      retentionPeriod: this.config.retentionDays * 24 * 60 * 60 * 1000,
    };
  }

  private generateSummary(events: AuditEvent[]): AuditSummary {
    const summary: AuditSummary = {
      totalEvents: events.length,
      eventsByType: {} as Record<AuditEventType, number>,
      eventsByCategory: {} as Record<AuditCategory, number>,
      eventsBySeverity: {} as Record<AuditSeverity, number>,
      eventsByOutcome: {} as Record<AuditOutcome, number>,
    };

    // Initialize counters
    Object.values(AuditEventType).forEach(type => {
      summary.eventsByType[type] = 0;
    });
    Object.values(AuditCategory).forEach(category => {
      summary.eventsByCategory[category] = 0;
    });
    Object.values(AuditSeverity).forEach(severity => {
      summary.eventsBySeverity[severity] = 0;
    });
    Object.values(AuditOutcome).forEach(outcome => {
      summary.eventsByOutcome[outcome] = 0;
    });

    // Count events
    for (const event of events) {
      summary.eventsByType[event.eventType]++;
      summary.eventsByCategory[event.category]++;
      summary.eventsBySeverity[event.severity]++;
      summary.eventsByOutcome[event.outcome]++;
    }

    return summary;
  }

  private mapToCompliance(
    events: AuditEvent[],
    frameworks?: ComplianceFramework[]
  ): ComplianceMapping[] {
    const mappings: ComplianceMapping[] = [];

    if (!frameworks || frameworks.length === 0) {
      return mappings;
    }

    // Define compliance mappings
    const controlMappings: Record<ComplianceFramework, Map<string, AuditEvent[]>> = {
      [ComplianceFramework.SOC2]: new Map(),
      [ComplianceFramework.ISO27001]: new Map(),
      [ComplianceFramework.GDPR]: new Map(),
      [ComplianceFramework.HIPAA]: new Map(),
      [ComplianceFramework.PCI_DSS]: new Map(),
      [ComplianceFramework.NIST_800_53]: new Map(),
      [ComplianceFramework.CSA_STAR]: new Map(),
    };

    // Map events to controls
    for (const event of events) {
      for (const framework of frameworks) {
        const controls = this.getControlsForEvent(framework, event);
        for (const control of controls) {
          if (!controlMappings[framework].has(control)) {
            controlMappings[framework].set(control, []);
          }
          controlMappings[framework].get(control)!.push(event);
        }
      }
    }

    // Create mappings
    for (const framework of frameworks) {
      const frameworkControls = controlMappings[framework];
      for (const [control, controlEvents] of frameworkControls.entries()) {
        mappings.push({
          framework,
          controls: [control],
          evidence: controlEvents,
        });
      }
    }

    return mappings;
  }

  private getControlsForEvent(framework: ComplianceFramework, event: AuditEvent): string[] {
    const controls: string[] = [];

    switch (framework) {
      case ComplianceFramework.SOC2:
        // Map to SOC2 controls
        if (event.eventType === AuditEventType.AUTHENTICATION) {
          controls.push('AC-7', 'AC-8');
        }
        if (event.eventType === AuditEventType.DATA_ACCESS) {
          controls.push('AC-3', 'AU-2');
        }
        if (event.category === AuditCategory.SECURITY) {
          controls.push('CC-6', 'CC-7');
        }
        break;

      case ComplianceFramework.ISO27001:
        // Map to ISO27001 controls
        if (event.eventType === AuditEventType.AUTHENTICATION) {
          controls.push('A.9.2.1', 'A.9.2.3');
        }
        if (event.eventType === AuditEventType.DATA_ACCESS) {
          controls.push('A.9.4.1', 'A.9.4.2');
        }
        break;

      case ComplianceFramework.GDPR:
        // Map to GDPR controls
        if (event.eventType === AuditEventType.DATA_ACCESS) {
          controls.push('Art.32', 'Art.30');
        }
        if (event.category === AuditCategory.PRIVACY) {
          controls.push('Art.25', 'Art.35');
        }
        break;

      case ComplianceFramework.HIPAA:
        // Map to HIPAA controls
        if (event.eventType === AuditEventType.AUTHENTICATION) {
          controls.push('164.312(a)(2)(i)', '164.312(d)');
        }
        if (event.eventType === AuditEventType.DATA_ACCESS) {
          controls.push('164.312(a)(1)', '164.312(b)');
        }
        break;

      case ComplianceFramework.PCI_DSS:
        // Map to PCI DSS controls
        if (event.eventType === AuditEventType.AUTHENTICATION) {
          controls.push('8.2', '8.3');
        }
        if (event.eventType === AuditEventType.DATA_MODIFICATION) {
          controls.push('10.2', '10.3');
        }
        break;
    }

    return controls;
  }
}

// ============================================================================
// AUDIT EVENT BUILDER
// ============================================================================

export class AuditEventBuilder {
  private event: Partial<AuditEvent> = {};

  setEventType(eventType: AuditEventType): this {
    this.event.eventType = eventType;
    return this;
  }

  setCategory(category: AuditCategory): this {
    this.event.category = category;
    return this;
  }

  setSeverity(severity: AuditSeverity): this {
    this.event.severity = severity;
    return this;
  }

  setPrincipal(principal: Partial<PrincipalInfo>): this {
    this.event.principal = {
      id: principal.id || 'system',
      type: principal.type || PrincipalType.SYSTEM,
      name: principal.name,
      roles: principal.roles,
      permissions: principal.permissions,
      ip: principal.ip,
      userAgent: principal.userAgent,
    };
    return this;
  }

  setResource(resource: Partial<ResourceInfo>): this {
    this.event.resource = {
      id: resource.id || 'unknown',
      type: resource.type || 'unknown',
      name: resource.name,
      owner: resource.owner,
      classification: resource.classification,
      location: resource.location,
    };
    return this;
  }

  setAction(action: string): this {
    this.event.action = action;
    return this;
  }

  setOutcome(outcome: AuditOutcome): this {
    this.event.outcome = outcome;
    return this;
  }

  setDetails(details: Record<string, any>): this {
    this.event.details = details;
    return this;
  }

  setCorrelationId(correlationId: string): this {
    this.event.correlationId = correlationId;
    return this;
  }

  setRequestId(requestId: string): this {
    this.event.requestId = requestId;
    return this;
  }

  build(): Omit<AuditEvent, 'eventId' | 'timestamp' | 'metadata'> {
    if (!this.event.eventType) {
      throw new Error('Event type is required');
    }
    if (!this.event.category) {
      throw new Error('Category is required');
    }
    if (!this.event.severity) {
      throw new Error('Severity is required');
    }
    if (!this.event.principal) {
      throw new Error('Principal is required');
    }
    if (!this.event.resource) {
      throw new Error('Resource is required');
    }
    if (!this.event.action) {
      throw new Error('Action is required');
    }
    if (!this.event.outcome) {
      throw new Error('Outcome is required');
    }
    if (!this.event.details) {
      this.event.details = {};
    }

    return this.event as Omit<AuditEvent, 'eventId' | 'timestamp' | 'metadata'>;
  }
}

// ============================================================================
// AUDIT MIDDLEWARE
// ============================================================================

export interface AuditContext {
  principalId: string;
  principalType?: PrincipalType;
  principalName?: string;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
  requestId?: string;
}

export class AuditMiddleware {
  constructor(private auditLogger: AuditLogger) {}

  /**
   * Create middleware for Express.js
   */
  expressMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();

      // Set correlation ID if not present
      if (!req.correlationId) {
        req.correlationId = uuidv4();
      }

      // Log on response finish
      res.on('finish', async () => {
        const duration = Date.now() - startTime;

        const event = new AuditEventBuilder()
          .setEventType(AuditEventType.SYSTEM_EVENT)
          .setCategory(AuditCategory.OPERATIONS)
          .setSeverity(
            res.statusCode >= 500
              ? AuditSeverity.HIGH
              : res.statusCode >= 400
              ? AuditSeverity.MEDIUM
              : AuditSeverity.INFO
          )
          .setPrincipal({
            id: req.user?.userId || 'anonymous',
            type: req.user ? PrincipalType.USER : PrincipalType.SYSTEM,
            name: req.user?.username || 'anonymous',
            ip: req.ip,
            userAgent: req.get('user-agent'),
          })
          .setResource({
            id: req.path,
            type: 'http_endpoint',
            name: req.method + ' ' + req.path,
          })
          .setAction('http_request')
          .setOutcome(
            res.statusCode < 400 ? AuditOutcome.SUCCESS : AuditOutcome.FAILURE
          )
          .setDetails({
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            query: req.query,
          })
          .setCorrelationId(req.correlationId)
          .setRequestId(req.id)
          .build();

        await this.auditLogger.log(event);
      });

      next();
    };
  }

  /**
   * Wrap a function with audit logging
   */
  async auditFunction<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context: {
      eventType: AuditEventType;
      category: AuditCategory;
      severity: AuditSeverity;
      action: string;
      resourceBuilder: (...args: Parameters<T>) => Partial<ResourceInfo>;
    },
    auditContext: AuditContext
  ): Promise<ReturnType<T>> {
    const correlationId = auditContext.correlationId || uuidv4();
    const requestId = auditContext.requestId || uuidv4();

    try {
      const result = await fn(...([] as any));
      const resource = context.resourceBuilder(...([] as any));

      const event = new AuditEventBuilder()
        .setEventType(context.eventType)
        .setCategory(context.category)
        .setSeverity(context.severity)
        .setPrincipal({
          id: auditContext.principalId,
          type: auditContext.principalType || PrincipalType.USER,
          name: auditContext.principalName,
          ip: auditContext.ip,
          userAgent: auditContext.userAgent,
        })
        .setResource(resource)
        .setAction(context.action)
        .setOutcome(AuditOutcome.SUCCESS)
        .setDetails({
          result: typeof result === 'object' ? JSON.stringify(result) : result,
        })
        .setCorrelationId(correlationId)
        .setRequestId(requestId)
        .build();

      await this.auditLogger.log(event);
      return result;
    } catch (error) {
      const resource = context.resourceBuilder(...([] as any));

      const event = new AuditEventBuilder()
        .setEventType(context.eventType)
        .setCategory(context.category)
        .setSeverity(AuditSeverity.HIGH)
        .setPrincipal({
          id: auditContext.principalId,
          type: auditContext.principalType || PrincipalType.USER,
          name: auditContext.principalName,
          ip: auditContext.ip,
          userAgent: auditContext.userAgent,
        })
        .setResource(resource)
        .setAction(context.action)
        .setOutcome(AuditOutcome.ERROR)
        .setDetails({
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        .setCorrelationId(correlationId)
        .setRequestId(requestId)
        .build();

      await this.auditLogger.log(event);
      throw error;
    }
  }
}

// ============================================================================
// ALERTING SYSTEM
// ============================================================================

export interface AlertRule {
  ruleId: string;
  name: string;
  description: string;
  conditions: AlertCondition[];
  severity: AuditSeverity;
  enabled: boolean;
  throttleMinutes?: number;
  notificationChannels: string[];
  lastTriggered?: Date;
}

export interface AlertCondition {
  eventType?: AuditEventType;
  category?: AuditCategory;
  severity?: AuditSeverity;
  outcome?: AuditOutcome;
  principalId?: string;
  resourceId?: string;
  customCondition?: (event: AuditEvent) => boolean;
}

export interface Alert {
  alertId: string;
  ruleId: string;
  ruleName: string;
  severity: AuditSeverity;
  triggeredAt: Date;
  events: AuditEvent[];
  message: string;
}

export class AlertingSystem {
  private rules: Map<string, AlertRule> = new Map();
  private alertHistory: Alert[] = [];

  constructor(private auditLogger: AuditLogger) {
    // Listen for events
    this.auditLogger.on('event', (event: AuditEvent) => {
      this.checkRules(event);
    });

    // Listen for critical events
    this.auditLogger.on('critical', (event: AuditEvent) => {
      this.handleCriticalEvent(event);
    });
  }

  /**
   * Add an alert rule
   */
  addRule(rule: Omit<AlertRule, 'ruleId'>): AlertRule {
    const alertRule: AlertRule = {
      ruleId: uuidv4(),
      ...rule,
    };
    this.rules.set(alertRule.ruleId, alertRule);
    return alertRule;
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Get all rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit?: number): Alert[] {
    const history = [...this.alertHistory].sort((a, b) =>
      b.triggeredAt.getTime() - a.triggeredAt.getTime()
    );
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Check if an event triggers any rules
   */
  private checkRules(event: AuditEvent): void {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      // Check throttle
      if (rule.lastTriggered && rule.throttleMinutes) {
        const throttleExpiry = new Date(
          rule.lastTriggered.getTime() + rule.throttleMinutes * 60 * 1000
        );
        if (new Date() < throttleExpiry) {
          continue;
        }
      }

      // Check conditions
      const triggered = rule.conditions.every(condition => {
        if (condition.eventType && event.eventType !== condition.eventType) {
          return false;
        }
        if (condition.category && event.category !== condition.category) {
          return false;
        }
        if (condition.severity && event.severity !== condition.severity) {
          return false;
        }
        if (condition.outcome && event.outcome !== condition.outcome) {
          return false;
        }
        if (condition.principalId && event.principal.id !== condition.principalId) {
          return false;
        }
        if (condition.resourceId && event.resource.id !== condition.resourceId) {
          return false;
        }
        if (condition.customCondition && !condition.customCondition(event)) {
          return false;
        }
        return true;
      });

      if (triggered) {
        this.triggerAlert(rule, [event]);
      }
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(rule: AlertRule, events: AuditEvent[]): void {
    const alert: Alert = {
      alertId: uuidv4(),
      ruleId: rule.ruleId,
      ruleName: rule.name,
      severity: rule.severity,
      triggeredAt: new Date(),
      events,
      message: `Alert triggered: ${rule.name}`,
    };

    this.alertHistory.push(alert);
    rule.lastTriggered = new Date();

    // Send notifications
    // In a real implementation, this would send to notification channels
    console.log('[ALERT]', JSON.stringify(alert));

    // Emit alert event
    this.auditLogger.emit('alert', alert);
  }

  /**
   * Handle critical events
   */
  private handleCriticalEvent(event: AuditEvent): void {
    // Trigger immediate alert for critical events
    const alert: Alert = {
      alertId: uuidv4(),
      ruleId: 'critical-event',
      ruleName: 'Critical Event',
      severity: AuditSeverity.CRITICAL,
      triggeredAt: new Date(),
      events: [event],
      message: `Critical event detected: ${event.action}`,
    };

    this.alertHistory.push(alert);
    this.auditLogger.emit('alert', alert);
  }
}

// All classes are already exported inline - no duplicate export needed
