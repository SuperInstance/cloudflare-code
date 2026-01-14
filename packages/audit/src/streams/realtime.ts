/**
 * Real-time Audit Log Streaming
 * Provides WebSocket-based real-time streaming of audit events
 * Supports filtering, aggregation, and alerting on audit events
 */

import type { BaseAuditEvent, AuditEventType, EventSeverity } from '../types/events';

/**
 * Stream configuration
 */
export interface StreamConfig {
  maxConnections: number;
  heartbeatInterval: number; // milliseconds
  bufferSize: number;
  enableAggregation: boolean;
  enableAlerting: boolean;
  alertThresholds: AlertThresholds;
}

/**
 * Alert thresholds
 */
export interface AlertThresholds {
  failedLoginAttempts: number;
  criticalEventsPerMinute: number;
  dataExportEventsPerHour: number;
  privilegedOperationsPerHour: number;
}

/**
 * Stream filter
 */
export interface StreamFilter {
  eventTypes?: AuditEventType[];
  actorIds?: string[];
  actorTypes?: string[];
  resourceTypes?: string[];
  resourceIds?: string[];
  severities?: EventSeverity[];
  includeMetadata?: boolean;
}

/**
 * Stream subscription
 */
export interface StreamSubscription {
  id: string;
  clientId: string;
  filter: StreamFilter;
  connectedAt: Date;
  lastActivityAt: Date;
  eventsSent: number;
  isBuffered: boolean;
}

/**
 * Alert notification
 */
export interface AlertNotification {
  id: string;
  alertType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: Date;
  message: string;
  details: Record<string, any>;
  events: BaseAuditEvent[];
  threshold: number;
  actual: number;
  timeWindow: string;
}

/**
 * Stream statistics
 */
export interface StreamStats {
  activeConnections: number;
  totalSubscriptions: number;
  eventsStreamed: number;
  alertsTriggered: number;
  averageLatency: number;
  bufferUtilization: number;
}

/**
 * Real-time audit event stream
 */
export class AuditEventStream {
  private config: StreamConfig;
  private subscriptions: Map<string, StreamSubscription> = new Map();
  private clientBuffers: Map<string, BaseAuditEvent[]> = new Map();
  private alertCounters: Map<string, number[]> = new Map();
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();
  private stats: StreamStats;
  private eventHandlers: Map<string, Set<(event: BaseAuditEvent) => void>> = new Map();

  constructor(config: Partial<StreamConfig> = {}) {
    this.config = {
      maxConnections: config.maxConnections || 100,
      heartbeatInterval: config.heartbeatInterval || 30000, // 30 seconds
      bufferSize: config.bufferSize || 1000,
      enableAggregation: config.enableAggregation !== false,
      enableAlerting: config.enableAlerting !== false,
      alertThresholds: config.alertThresholds || {
        failedLoginAttempts: 5,
        criticalEventsPerMinute: 10,
        dataExportEventsPerHour: 20,
        privilegedOperationsPerHour: 50
      }
    };

    this.stats = {
      activeConnections: 0,
      totalSubscriptions: 0,
      eventsStreamed: 0,
      alertsTriggered: 0,
      averageLatency: 0,
      bufferUtilization: 0
    };
  }

  /**
   * Subscribe to audit event stream
   */
  async subscribe(
    clientId: string,
    filter: StreamFilter = {},
    websocket?: WebSocket
  ): Promise<string> {
    // Check connection limit
    const activeClients = new Set(
      Array.from(this.subscriptions.values()).map(s => s.clientId)
    ).size;

    if (activeClients >= this.config.maxConnections) {
      throw new Error('Maximum connections reached');
    }

    const subscriptionId = crypto.randomUUID();

    const subscription: StreamSubscription = {
      id: subscriptionId,
      clientId,
      filter,
      connectedAt: new Date(),
      lastActivityAt: new Date(),
      eventsSent: 0,
      isBuffered: true
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.clientBuffers.set(subscriptionId, []);

    this.stats.totalSubscriptions++;
    this.stats.activeConnections = activeClients + 1;

    // Start heartbeat for this connection
    if (websocket) {
      this.startHeartbeat(subscriptionId, websocket);
    }

    // Send buffered events if available
    await this.flushBuffer(subscriptionId, websocket);

    return subscriptionId;
  }

  /**
   * Unsubscribe from audit event stream
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);

    if (!subscription) {
      return;
    }

    this.subscriptions.delete(subscriptionId);
    this.clientBuffers.delete(subscriptionId);

    // Clear heartbeat timer
    const timer = this.heartbeatTimers.get(subscriptionId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(subscriptionId);
    }

    this.stats.activeConnections = new Set(
      Array.from(this.subscriptions.values()).map(s => s.clientId)
    ).size;
  }

  /**
   * Publish an event to all matching subscriptions
   */
  async publish(event: BaseAuditEvent): Promise<void> {
    const startTime = Date.now();

    // Check alerting conditions
    if (this.config.enableAlerting) {
      await this.checkAlerts(event);
    }

    // Find matching subscriptions
    const matchingSubscriptions = Array.from(this.subscriptions.values()).filter(
      sub => this.eventMatchesFilter(event, sub.filter)
    );

    // Send to each matching subscription
    for (const subscription of matchingSubscriptions) {
      if (subscription.isBuffered) {
        // Add to buffer
        const buffer = this.clientBuffers.get(subscription.id);
        if (buffer) {
          buffer.push(event);

          // Trim buffer if exceeds size
          if (buffer.length > this.config.bufferSize) {
            buffer.shift();
          }

          subscription.lastActivityAt = new Date();
          subscription.eventsSent++;
        }
      } else {
        // Send immediately (if websocket available)
        // This would be handled by the WebSocket handler
      }
    }

    this.stats.eventsStreamed += matchingSubscriptions.length;

    // Update latency stats
    const latency = Date.now() - startTime;
    this.stats.averageLatency =
      (this.stats.averageLatency * (this.stats.eventsStreamed - 1) + latency) /
      this.stats.eventsStreamed;
  }

  /**
   * Publish multiple events in batch
   */
  async publishBatch(events: BaseAuditEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Get buffer for a subscription
   */
  getBuffer(subscriptionId: string): BaseAuditEvent[] {
    return this.clientBuffers.get(subscriptionId) || [];
  }

  /**
   * Flush buffer to websocket
   */
  async flushBuffer(subscriptionId: string, websocket?: WebSocket): Promise<void> {
    const buffer = this.clientBuffers.get(subscriptionId);

    if (!buffer || buffer.length === 0 || !websocket) {
      return;
    }

    try {
      const message = JSON.stringify({
        type: 'batch',
        events: buffer
      });

      websocket.send(message);

      // Clear buffer after sending
      this.clientBuffers.set(subscriptionId, []);
    } catch (error) {
      console.error('Error flushing buffer:', error);
    }
  }

  /**
   * Add event handler for specific event type
   */
  on(eventType: string, handler: (event: BaseAuditEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  /**
   * Remove event handler
   */
  off(eventType: string, handler: (event: BaseAuditEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Get stream statistics
   */
  getStats(): StreamStats {
    this.stats.bufferUtilization =
      Array.from(this.clientBuffers.values()).reduce(
        (sum, buffer) => sum + buffer.length,
        0
      ) / (this.subscriptions.size * this.config.bufferSize || 1);

    return { ...this.stats };
  }

  /**
   * Get subscription info
   */
  getSubscription(subscriptionId: string): StreamSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * Get all subscriptions for a client
   */
  getClientSubscriptions(clientId: string): StreamSubscription[] {
    return Array.from(this.subscriptions.values()).filter(
      sub => sub.clientId === clientId
    );
  }

  /**
   * Update subscription filter
   */
  async updateFilter(subscriptionId: string, filter: StreamFilter): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    subscription.filter = filter;
    subscription.lastActivityAt = new Date();
  }

  /**
   * Clear old buffers and inactive subscriptions
   */
  async cleanup(inactiveTimeout: number = 3600000): Promise<void> {
    const now = new Date();
    const toRemove: string[] = [];

    for (const [id, subscription] of this.subscriptions.entries()) {
      const inactiveTime = now.getTime() - subscription.lastActivityAt.getTime();

      if (inactiveTime > inactiveTimeout) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      await this.unsubscribe(id);
    }
  }

  /**
   * Private helper methods
   */

  private eventMatchesFilter(event: BaseAuditEvent, filter: StreamFilter): boolean {
    // Filter by event types
    if (filter.eventTypes && filter.eventTypes.length > 0) {
      if (!filter.eventTypes.includes(event.eventType)) {
        return false;
      }
    }

    // Filter by actor IDs
    if (filter.actorIds && filter.actorIds.length > 0) {
      if (!filter.actorIds.includes(event.actor.id)) {
        return false;
      }
    }

    // Filter by actor types
    if (filter.actorTypes && filter.actorTypes.length > 0) {
      if (!filter.actorTypes.includes(event.actor.type)) {
        return false;
      }
    }

    // Filter by resource types
    if (filter.resourceTypes && filter.resourceTypes.length > 0) {
      if (!event.resource || !filter.resourceTypes.includes(event.resource.type)) {
        return false;
      }
    }

    // Filter by resource IDs
    if (filter.resourceIds && filter.resourceIds.length > 0) {
      if (!event.resource || !filter.resourceIds.includes(event.resource.id)) {
        return false;
      }
    }

    // Filter by severities
    if (filter.severities && filter.severities.length > 0) {
      if (!filter.severities.includes(event.severity)) {
        return false;
      }
    }

    return true;
  }

  private async checkAlerts(event: BaseAuditEvent): Promise<void> {
    const now = Date.now();
    const timeKey = Math.floor(now / 60000); // Minute-based buckets

    // Failed login attempts
    if (event.eventType === 'auth.failed_login') {
      const counter = this.getAlertCounter('failed_login', timeKey);
      counter.push(now);

      // Clean old entries (older than 1 minute)
      const recent = counter.filter(t => now - t < 60000);

      if (recent.length >= this.config.alertThresholds.failedLoginAttempts) {
        await this.triggerAlert({
          id: crypto.randomUUID(),
          alertType: 'brute_force_detected',
          severity: 'high',
          timestamp: new Date(),
          message: `Multiple failed login attempts detected for actor: ${event.actor.id}`,
          details: {
            actorId: event.actor.id,
            ipAddress: event.actor.ipAddress,
            attempts: recent.length
          },
          events: [event],
          threshold: this.config.alertThresholds.failedLoginAttempts,
          actual: recent.length,
          timeWindow: '1 minute'
        });
      }
    }

    // Critical events per minute
    if (event.severity === 'critical') {
      const counter = this.getAlertCounter('critical_events', timeKey);
      counter.push(now);

      const recent = counter.filter(t => now - t < 60000);

      if (recent.length >= this.config.alertThresholds.criticalEventsPerMinute) {
        await this.triggerAlert({
          id: crypto.randomUUID(),
          alertType: 'critical_events_surge',
          severity: 'critical',
          timestamp: new Date(),
          message: `Surge in critical events detected: ${recent.length} in last minute`,
          details: {
            events: recent.length
          },
          events: [event],
          threshold: this.config.alertThresholds.criticalEventsPerMinute,
          actual: recent.length,
          timeWindow: '1 minute'
        });
      }
    }

    // Data export events
    if (event.eventType === 'data.exported' || event.eventType === 'data.bulk_export') {
      const hourKey = Math.floor(now / 3600000);
      const counter = this.getAlertCounter('data_export', hourKey);
      counter.push(now);

      const recent = counter.filter(t => now - t < 3600000);

      if (recent.length >= this.config.alertThresholds.dataExportEventsPerHour) {
        await this.triggerAlert({
          id: crypto.randomUUID(),
          alertType: 'excessive_data_exports',
          severity: 'high',
          timestamp: new Date(),
          message: `Excessive data export activity detected: ${recent.length} exports in last hour`,
          details: {
            exports: recent.length,
            actors: this.getUniqueActors(recent)
          },
          events: [event],
          threshold: this.config.alertThresholds.dataExportEventsPerHour,
          actual: recent.length,
          timeWindow: '1 hour'
        });
      }
    }

    // Privileged operations
    if (event.eventType === 'authz.privilege_escalation' || event.eventType === 'authz.admin_access') {
      const hourKey = Math.floor(now / 3600000);
      const counter = this.getAlertCounter('privileged_ops', hourKey);
      counter.push(now);

      const recent = counter.filter(t => now - t < 3600000);

      if (recent.length >= this.config.alertThresholds.privilegedOperationsPerHour) {
        await this.triggerAlert({
          id: crypto.randomUUID(),
          alertType: 'excessive_privileged_operations',
          severity: 'high',
          timestamp: new Date(),
          message: `Excessive privileged operations detected: ${recent.length} in last hour`,
          details: {
            operations: recent.length
          },
          events: [event],
          threshold: this.config.alertThresholds.privilegedOperationsPerHour,
          actual: recent.length,
          timeWindow: '1 hour'
        });
      }
    }
  }

  private getAlertCounter(type: string, timeKey: number): number[] {
    const key = `${type}:${timeKey}`;
    if (!this.alertCounters.has(key)) {
      this.alertCounters.set(key, []);

      // Clean old counters periodically
      if (this.alertCounters.size > 1000) {
        const now = Date.now();
        const currentMinute = Math.floor(now / 60000);

        for (const [counterKey, _] of this.alertCounters.entries()) {
          const keyMinute = parseInt(counterKey.split(':')[1]);
          if (currentMinute - keyMinute > 60) {
            this.alertCounters.delete(counterKey);
          }
        }
      }
    }
    return this.alertCounters.get(key)!;
  }

  private async triggerAlert(alert: AlertNotification): Promise<void> {
    this.stats.alertsTriggered++;

    // Emit alert to all subscribers
    for (const subscription of this.subscriptions.values()) {
      if (subscription.isBuffered) {
        const buffer = this.clientBuffers.get(subscription.id);
        if (buffer) {
          // Add alert as a special event
          buffer.push({
            id: alert.id,
            eventType: 'alert.triggered' as any,
            timestamp: alert.timestamp.toISOString(),
            sequenceNumber: 0,
            actor: {
              id: 'alerting-system',
              type: 'system' as any,
              name: 'Alerting System'
            },
            outcome: 'success' as any,
            severity: alert.severity as any,
            complianceFrameworks: [],
            soc2TrustServices: [],
            iso27001Domains: [],
            description: alert.message,
            details: alert.details,
            isImmutable: true,
            isArchived: false,
            checksum: ''
          });
        }
      }
    }
  }

  private startHeartbeat(subscriptionId: string, websocket: WebSocket): void {
    const timer = setInterval(() => {
      try {
        websocket.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
      } catch (error) {
        // Connection likely closed, unsubscribe
        this.unsubscribe(subscriptionId);
      }
    }, this.config.heartbeatInterval);

    this.heartbeatTimers.set(subscriptionId, timer);
  }

  private getUniqueActors(timestamps: number[]): string[] {
    // Placeholder - would need to track actor IDs with timestamps
    return [];
  }

  /**
   * Destroy the stream and cleanup resources
   */
  async destroy(): Promise<void> {
    // Clear all subscriptions
    for (const subscriptionId of this.subscriptions.keys()) {
      await this.unsubscribe(subscriptionId);
    }

    // Clear alert counters
    this.alertCounters.clear();

    // Clear event handlers
    this.eventHandlers.clear();
  }
}

/**
 * Factory function to create audit event stream
 */
export function createAuditEventStream(config?: Partial<StreamConfig>): AuditEventStream {
  return new AuditEventStream(config);
}

/**
 * WebSocket message handler for audit stream
 */
export function createAuditStreamHandler(stream: AuditEventStream) {
  return async (websocket: WebSocket, clientId: string): Promise<void> => {
    let subscriptionId: string | null = null;

    // Handle incoming messages
    websocket.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'subscribe':
            subscriptionId = await stream.subscribe(clientId, message.filter, websocket);
            websocket.send(JSON.stringify({
              type: 'subscribed',
              subscriptionId
            }));
            break;

          case 'unsubscribe':
            if (subscriptionId) {
              await stream.unsubscribe(subscriptionId);
              websocket.send(JSON.stringify({
                type: 'unsubscribed',
                subscriptionId
              }));
            }
            break;

          case 'update_filter':
            if (subscriptionId) {
              await stream.updateFilter(subscriptionId, message.filter);
              websocket.send(JSON.stringify({
                type: 'filter_updated',
                subscriptionId
              }));
            }
            break;

          case 'get_buffer':
            if (subscriptionId) {
              const buffer = stream.getBuffer(subscriptionId);
              websocket.send(JSON.stringify({
                type: 'buffer',
                events: buffer
              }));
            }
            break;

          case 'flush':
            if (subscriptionId) {
              await stream.flushBuffer(subscriptionId, websocket);
            }
            break;

          case 'get_stats':
            const stats = stream.getStats();
            websocket.send(JSON.stringify({
              type: 'stats',
              stats
            }));
            break;

          default:
            websocket.send(JSON.stringify({
              type: 'error',
              message: `Unknown message type: ${message.type}`
            }));
        }
      } catch (error) {
        websocket.send(JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    });

    // Handle connection close
    websocket.addEventListener('close', async () => {
      if (subscriptionId) {
        await stream.unsubscribe(subscriptionId);
      }
    });

    // Handle connection error
    websocket.addEventListener('error', async () => {
      if (subscriptionId) {
        await stream.unsubscribe(subscriptionId);
      }
    });
  };
}
