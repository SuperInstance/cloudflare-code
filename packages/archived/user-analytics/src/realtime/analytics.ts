/**
 * Real-time Analytics
 * Real-time event processing and metrics calculation
 */

import type {
  RealtimeEvent,
  RealtimeMetrics,
  RealtimeEventMetrics,
  RealtimeUserMetrics,
  RealtimeSessionMetrics,
  RealtimeConversionMetrics,
  RealtimeTopEvent,
  RealtimeTopPage,
  RealtimeAlert,
  AlertType,
  AlertSeverity,
  AnalyticsEvent,
  AlertThreshold,
} from '../types/index.js';

// ============================================================================
// Real-time Event Processor
// ============================================================================

export class RealtimeProcessor {
  private eventBuffer: RealtimeEvent[] = [];
  private bufferSize: number;
  private windowMs: number;

  constructor(bufferSize = 10000, windowMs = 60000) {
    this.bufferSize = bufferSize;
    this.windowMs = windowMs;
  }

  /**
   * Process an event in real-time
   */
  processEvent(event: AnalyticsEvent): RealtimeEvent {
    const processedAt = Date.now();
    const latency = processedAt - event.timestamp;

    const realtimeEvent: RealtimeEvent = {
      event,
      processedAt,
      latency,
    };

    // Add to buffer
    this.eventBuffer.push(realtimeEvent);

    // Trim buffer if needed
    if (this.eventBuffer.length > this.bufferSize) {
      this.eventBuffer = this.eventBuffer.slice(-this.bufferSize);
    }

    return realtimeEvent;
  }

  /**
   * Get events within time window
   */
  getEventsInWindow(windowMs?: number): RealtimeEvent[] {
    const now = Date.now();
    const window = windowMs || this.windowMs;
    const cutoff = now - window;

    return this.eventBuffer.filter((e) => e.processedAt >= cutoff);
  }

  /**
   * Get buffer statistics
   */
  getBufferStats(): { size: number; windowMs: number; avgLatency: number } {
    const avgLatency =
      this.eventBuffer.length > 0
        ? this.eventBuffer.reduce((sum, e) => sum + e.latency, 0) / this.eventBuffer.length
        : 0;

    return {
      size: this.eventBuffer.length,
      windowMs: this.windowMs,
      avgLatency,
    };
  }

  /**
   * Clear buffer
   */
  clearBuffer(): void {
    this.eventBuffer = [];
  }
}

// ============================================================================
// Real-time Metrics Calculator
// ============================================================================

export class RealtimeMetricsCalculator {
  /**
   * Calculate real-time metrics
   */
  calculateMetrics(
    events: RealtimeEvent[],
    windowMs: number
  ): RealtimeMetrics {
    const now = Date.now();
    const cutoff = now - windowMs;
    const windowEvents = events.filter((e) => e.processedAt >= cutoff);

    return {
      timestamp: now,
      window: windowMs,
      events: this.calculateEventMetrics(windowEvents, windowMs),
      users: this.calculateUserMetrics(windowEvents),
      sessions: this.calculateSessionMetrics(windowEvents),
      conversions: this.calculateConversionMetrics(windowEvents),
      topEvents: this.getTopEvents(windowEvents, 5),
      topPages: this.getTopPages(windowEvents, 5),
    };
  }

  /**
   * Calculate event metrics
   */
  private calculateEventMetrics(
    events: RealtimeEvent[],
    windowMs: number
  ): RealtimeEventMetrics {
    const total = events.length;
    const rate = (total / windowMs) * 1000; // Events per second

    const byType = new Map<string, number>();

    for (const { event } of events) {
      byType.set(event.eventType, (byType.get(event.eventType) || 0) + 1);
    }

    return {
      total,
      rate,
      byType: Object.fromEntries(byType),
    };
  }

  /**
   * Calculate user metrics
   */
  private calculateUserMetrics(events: RealtimeEvent[]): RealtimeUserMetrics {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    const userIds = new Set(
      events
        .filter((e) => e.event.userId)
        .map((e) => e.event.userId!)
    );

    const anonymousIds = new Set(
      events
        .filter((e) => e.event.anonymousId && !e.event.userId)
        .map((e) => e.event.anonymousId!)
    );

    const activeUsers = new Set<string>();
    const newUsers = new Set<string>();
    const returningUsers = new Set<string>();

    for (const { event } of events) {
      if (!event.userId) continue;

      if (event.timestamp >= fiveMinutesAgo) {
        activeUsers.add(event.userId);
      }

      // Check if new user (first event)
      const userEvents = events.filter((e) => e.event.userId === event.userId);
      if (userEvents.length === 1) {
        newUsers.add(event.userId);
      } else {
        returningUsers.add(event.userId);
      }
    }

    return {
      active: activeUsers.size,
      new: newUsers.size,
      returning: returningUsers.size,
      anonymous: anonymousIds.size,
    };
  }

  /**
   * Calculate session metrics
   */
  private calculateSessionMetrics(events: RealtimeEvent[]): RealtimeSessionMetrics {
    const sessions = new Set(events.map((e) => e.event.sessionId));

    // Calculate average session duration (simplified)
    const sessionDurations = new Map<string, number>();

    for (const { event } of events) {
      const existing = sessionDurations.get(event.sessionId);

      if (!existing) {
        sessionDurations.set(event.sessionId, 0);
      }
    }

    const avgDuration =
      sessionDurations.size > 0
        ? Array.from(sessionDurations.values()).reduce((a, b) => a + b, 0) / sessionDurations.size
        : 0;

    // Calculate bounce rate (sessions with 1 page view)
    const sessionPageViews = new Map<string, number>();

    for (const { event } of events) {
      if (event.eventType === 'page_view') {
        sessionPageViews.set(
          event.sessionId,
          (sessionPageViews.get(event.sessionId) || 0) + 1
        );
      }
    }

    const singlePageSessions = Array.from(sessionPageViews.values()).filter(
      (count) => count === 1
    ).length;

    const bounceRate =
      sessionPageViews.size > 0 ? (singlePageSessions / sessionPageViews.size) * 100 : 0;

    return {
      active: sessions.size,
      avgDuration,
      bounceRate,
    };
  }

  /**
   * Calculate conversion metrics
   */
  private calculateConversionMetrics(events: RealtimeEvent[]): RealtimeConversionMetrics {
    const conversions = events.filter((e) => e.event.eventType === 'conversion');

    const total = conversions.length;

    // Calculate total value
    let value = 0;
    for (const { event } of conversions) {
      const eventValue = event.properties?.value as number | undefined;
      if (eventValue) {
        value += eventValue;
      }
    }

    // Calculate rate (conversions per total events)
    const rate = events.length > 0 ? (total / events.length) * 100 : 0;

    // Group by type
    const byType = new Map<string, number>();

    for (const { event } of conversions) {
      byType.set(event.eventName, (byType.get(event.eventName) || 0) + 1);
    }

    return {
      total,
      rate,
      value,
      byType: Object.fromEntries(byType),
    };
  }

  /**
   * Get top events
   */
  private getTopEvents(events: RealtimeEvent[], limit: number): RealtimeTopEvent[] {
    const eventCounts = new Map<string, { count: number; type: string }>();

    for (const { event } of events) {
      const key = `${event.eventType}:${event.eventName}`;
      eventCounts.set(key, {
        count: (eventCounts.get(key)?.count || 0) + 1,
        type: event.eventType,
      });
    }

    const total = events.length;

    return Array.from(eventCounts.entries())
      .map(([key, data]) => {
        const [eventType, eventName] = key.split(':');
        return {
          eventType,
          eventName,
          count: data.count,
          rate: total > 0 ? (data.count / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get top pages
   */
  private getTopPages(events: RealtimeEvent[], limit: number): RealtimeTopPage[] {
    const pageViews = events.filter((e) => e.event.eventType === 'page_view');

    const pageCounts = new Map<string, { views: number; uniqueUsers: Set<string> }>();

    for (const { event } of pageViews) {
      const page = event.context?.page || event.context?.url || 'unknown';

      const existing = pageCounts.get(page);
      if (existing) {
        existing.views++;
        if (event.userId) {
          existing.uniqueUsers.add(event.userId);
        }
      } else {
        pageCounts.set(page, {
          views: 1,
          uniqueUsers: new Set(event.userId ? [event.userId] : []),
        });
      }
    }

    return Array.from(pageCounts.entries())
      .map(([page, data]) => ({
        page,
        views: data.views,
        activeUsers: data.uniqueUsers.size,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);
  }
}

// ============================================================================
// Real-time Alert Manager
// ============================================================================

export class RealtimeAlertManager {
  private thresholds: AlertThreshold[];
  private alerts: Map<string, RealtimeAlert>;

  constructor(thresholds: AlertThreshold[] = []) {
    this.thresholds = thresholds;
    this.alerts = new Map();
  }

  /**
   * Set alert thresholds
   */
  setThresholds(thresholds: AlertThreshold[]): void {
    this.thresholds = thresholds;
  }

  /**
   * Check metrics against thresholds and generate alerts
   */
  checkAlerts(metrics: RealtimeMetrics): RealtimeAlert[] {
    const newAlerts: RealtimeAlert[] = [];

    for (const threshold of this.thresholds) {
      const alert = this.checkThreshold(threshold, metrics);

      if (alert) {
        this.alerts.set(alert.id, alert);
        newAlerts.push(alert);
      }
    }

    return newAlerts;
  }

  /**
   * Check a single threshold
   */
  private checkThreshold(
    threshold: AlertThreshold,
    metrics: RealtimeMetrics
  ): RealtimeAlert | null {
    let currentValue: number;
    let details: Record<string, unknown>;

    switch (threshold.metric) {
      case 'event_rate':
        currentValue = metrics.events.rate;
        details = { event_rate: currentValue, threshold: threshold.threshold };
        break;

      case 'active_users':
        currentValue = metrics.users.active;
        details = { active_users: currentValue, threshold: threshold.threshold };
        break;

      case 'conversion_rate':
        currentValue = metrics.conversions.rate;
        details = { conversion_rate: currentValue, threshold: threshold.threshold };
        break;

      default:
        return null;
    }

    let shouldAlert = false;

    switch (threshold.operator) {
      case 'greater_than':
        shouldAlert = currentValue > threshold.threshold;
        break;

      case 'less_than':
        shouldAlert = currentValue < threshold.threshold;
        break;

      case 'equals':
        shouldAlert = currentValue === threshold.threshold;
        break;

      case 'anomaly':
        // Simple anomaly detection (would use more sophisticated algorithm in production)
        shouldAlert = this.isAnomalous(currentValue, threshold.metric);
        break;
    }

    if (!shouldAlert) return null;

    return {
      id: `alert_${Date.now()}_${threshold.metric}`,
      type: this.getAlertType(threshold.operator),
      severity: threshold.severity,
      message: this.generateAlertMessage(threshold, currentValue),
      details,
      timestamp: Date.now(),
    };
  }

  /**
   * Check if value is anomalous
   */
  private isAnomalous(value: number, metric: string): boolean {
    // Simplified anomaly detection
    // In production, use statistical methods like Z-score or machine learning

    const typicalValues: Record<string, { min: number; max: number }> = {
      event_rate: { min: 1, max: 1000 },
      active_users: { min: 1, max: 10000 },
      conversion_rate: { min: 0, max: 100 },
    };

    const typical = typicalValues[metric];

    if (!typical) return false;

    return value < typical.min || value > typical.max;
  }

  /**
   * Get alert type from operator
   */
  private getAlertType(operator: string): AlertType {
    switch (operator) {
      case 'greater_than':
        return 'spike';
      case 'less_than':
        return 'drop';
      case 'anomaly':
        return 'anomaly';
      default:
        return 'threshold';
    }
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(threshold: AlertThreshold, currentValue: number): string {
    const direction = threshold.operator === 'greater_than' ? 'exceeded' : 'below';

    return `Metric "${threshold.metric}" is ${direction} threshold: ${currentValue} vs ${threshold.threshold}`;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);

    if (!alert) return false;

    alert.acknowledgedBy = acknowledgedBy;
    alert.resolvedAt = Date.now();

    return true;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): RealtimeAlert[] {
    return Array.from(this.alerts.values()).filter((a) => !a.resolvedAt);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): RealtimeAlert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Clear resolved alerts
   */
  clearResolvedAlerts(): void {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;

    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolvedAt && alert.resolvedAt < hourAgo) {
        this.alerts.delete(id);
      }
    }
  }
}

// ============================================================================
// Real-time Analytics Engine
// ============================================================================>

export class RealtimeAnalytics {
  private processor: RealtimeProcessor;
  private calculator: RealtimeMetricsCalculator;
  private alertManager: RealtimeAlertManager;
  private windowMs: number;

  constructor(
    windowMs = 60000,
    thresholds: AlertThreshold[] = []
  ) {
    this.processor = new RealtimeProcessor(10000, windowMs);
    this.calculator = new RealtimeMetricsCalculator();
    this.alertManager = new RealtimeAlertManager(thresholds);
    this.windowMs = windowMs;
  }

  /**
   * Process an event in real-time
   */
  processEvent(event: AnalyticsEvent): RealtimeEvent {
    return this.processor.processEvent(event);
  }

  /**
   * Get current metrics
   */
  getMetrics(): RealtimeMetrics {
    const events = this.processor.getEventsInWindow(this.windowMs);
    return this.calculator.calculateMetrics(events, this.windowMs);
  }

  /**
   * Get metrics for a custom window
   */
  getMetricsForWindow(windowMs: number): RealtimeMetrics {
    const events = this.processor.getEventsInWindow(windowMs);
    return this.calculator.calculateMetrics(events, windowMs);
  }

  /**
   * Check for alerts
   */
  checkAlerts(): RealtimeAlert[] {
    const metrics = this.getMetrics();
    return this.alertManager.checkAlerts(metrics);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): RealtimeAlert[] {
    return this.alertManager.getActiveAlerts();
  }

  /**
   * Get buffer statistics
   */
  getBufferStats(): { size: number; windowMs: number; avgLatency: number } {
    return this.processor.getBufferStats();
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    return this.alertManager.acknowledgeAlert(alertId, acknowledgedBy);
  }

  /**
   * Update alert thresholds
   */
  updateThresholds(thresholds: AlertThreshold[]): void {
    this.alertManager.setThresholds(thresholds);
  }

  /**
   * Clear old data
   */
  clearOldData(): void {
    this.processor.clearBuffer();
    this.alertManager.clearResolvedAlerts();
  }
}
