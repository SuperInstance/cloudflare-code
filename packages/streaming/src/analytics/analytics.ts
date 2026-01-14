/**
 * Stream analytics implementation
 * Provides real-time metrics, anomaly detection, and pattern recognition
 */

import type {
  StreamEvent,
  StreamMetrics,
  LatencyMetrics,
  ThroughputMetrics,
  ErrorMetrics,
  AnomalyDetection,
  AnomalyAlert,
  PatternMatch
} from '../types/index.js';
import { LatencyTracker, ThroughputTracker, AnomalyDetector } from '../utils/metrics.js';

// ============================================================================
// Stream Analytics
// ============================================================================

export class StreamAnalytics {
  private latencyTracker: LatencyTracker;
  private throughputTracker: ThroughputTracker;
  private anomalyDetector: AnomalyDetector;
  private eventCounts: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private byteCounter = 0;
  private startTime: number;
  private lastUpdateTime: number;
  private options: Required<AnomalyDetection>;

  constructor(options: AnomalyDetection = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      algorithm: options.algorithm ?? 'statistical',
      sensitivity: options.sensitivity ?? 'medium',
      threshold: options.threshold ?? 3,
      windowSize: options.windowSize ?? 100,
    };

    this.latencyTracker = new LatencyTracker();
    this.throughputTracker = new ThroughputTracker();
    this.anomalyDetector = new AnomalyDetector(
      this.getThresholdValue(),
      this.options.windowSize
    );

    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
  }

  // ========================================================================
  // Event Tracking
  // ========================================================================

  /**
   * Record an event
   */
  recordEvent(event: StreamEvent, latencyMs?: number): void {
    const now = Date.now();

    // Track latency if provided
    if (latencyMs !== undefined) {
      this.latencyTracker.record(latencyMs);
    }

    // Track throughput
    this.throughputTracker.increment();

    // Track event type counts
    const typeCount = this.eventCounts.get(event.type) ?? 0;
    this.eventCounts.set(event.type, typeCount + 1);

    // Track byte size
    this.byteCounter += JSON.stringify(event).length;

    // Check for anomalies
    if (this.options.enabled && latencyMs !== undefined) {
      this.checkForAnomalies(latencyMs, event);
    }

    this.lastUpdateTime = now;
  }

  /**
   * Record an error
   */
  recordError(error: Error, eventType?: string): void {
    const errorKey = eventType ?? error.name ?? 'unknown';
    const count = this.errorCounts.get(errorKey) ?? 0;
    this.errorCounts.set(errorKey, count + 1);
  }

  // ========================================================================
  // Metrics Calculation
  // ========================================================================

  /**
   * Get current metrics
   */
  getMetrics(): StreamMetrics {
    const latency = this.latencyTracker.getStats();
    const rate = this.throughputTracker.getRate();
    const peak = this.throughputTracker.getPeak();
    const duration = (this.lastUpdateTime - this.startTime) / 1000;

    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const errorRate = duration > 0 ? totalErrors / duration : 0;

    return {
      eventCount: this.throughputTracker.getRate() * duration,
      eventRate: rate,
      byteRate: duration > 0 ? this.byteCounter / duration : 0,
      latency,
      throughput: {
        current: rate,
        peak,
        average: duration > 0 ? (this.throughputTracker.getRate() * duration) / duration : 0,
      },
      errors: {
        count: totalErrors,
        rate: errorRate,
        types: Object.fromEntries(this.errorCounts),
      },
    };
  }

  /**
   * Get latency metrics
   */
  getLatencyMetrics(): LatencyMetrics {
    return this.latencyTracker.getStats();
  }

  /**
   * Get throughput metrics
   */
  getThroughputMetrics(): ThroughputMetrics {
    const rate = this.throughputTracker.getRate();
    const peak = this.throughputTracker.getPeak();
    const duration = (this.lastUpdateTime - this.startTime) / 1000;

    return {
      current: rate,
      peak,
      average: duration > 0 ? (rate * duration) / duration : 0,
    };
  }

  /**
   * Get error metrics
   */
  getErrorMetrics(): ErrorMetrics {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const duration = (this.lastUpdateTime - this.startTime) / 1000;

    return {
      count: totalErrors,
      rate: duration > 0 ? totalErrors / duration : 0,
      types: Object.fromEntries(this.errorCounts),
    };
  }

  /**
   * Get event type distribution
   */
  getEventTypeDistribution(): Map<string, number> {
    return new Map(this.eventCounts);
  }

  // ========================================================================
  // Anomaly Detection
  // ========================================================================

  /**
   * Check if value is anomalous
   */
  isAnomalous(value: number): boolean {
    if (!this.options.enabled) {
      return false;
    }

    return this.anomalyDetector.isAnomalous(value);
  }

  /**
   * Get anomaly score
   */
  getAnomalyScore(value: number): number {
    return this.anomalyDetector.getAnomalyScore(value);
  }

  /**
   * Check for anomalies and generate alerts
   */
  private checkForAnomalies(latencyMs: number, event: StreamEvent): void {
    if (this.isAnomalous(latencyMs)) {
      const score = this.getAnomalyScore(latencyMs);
      this.generateAnomalyAlert(latencyMs, event, score);
    }
  }

  /**
   * Generate anomaly alert
   */
  private generateAnomalyAlert(
    latencyMs: number,
    event: StreamEvent,
    confidence: number
  ): AnomalyAlert {
    const metrics = this.getMetrics();

    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'statistical',
      severity: confidence > 5 ? 'critical' : confidence > 3 ? 'warning' : 'info',
      message: `Anomalous latency detected: ${latencyMs}ms (score: ${confidence.toFixed(2)})`,
      timestamp: Date.now(),
      metrics,
      confidence,
    };
  }

  /**
   * Get threshold value based on sensitivity
   */
  private getThresholdValue(): number {
    switch (this.options.sensitivity) {
      case 'low':
        return this.options.threshold * 2;
      case 'high':
        return this.options.threshold * 0.5;
      case 'medium':
      default:
        return this.options.threshold;
    }
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  /**
   * Reset all analytics
   */
  reset(): void {
    this.latencyTracker.reset();
    this.throughputTracker.reset();
    this.anomalyDetector.reset();
    this.eventCounts.clear();
    this.errorCounts.clear();
    this.byteCounter = 0;
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
  }

  /**
   * Get uptime
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }
}

// ============================================================================
// Pattern Recognition
// ============================================================================

export class PatternRecognizer {
  private patterns: Map<string, Pattern> = new Map();
  private patternMatches: PatternMatch[] = [];
  private eventHistory: StreamEvent[] = [];

  /**
   * Register a pattern
   */
  registerPattern(pattern: Pattern): void {
    this.patterns.set(pattern.id, pattern);
  }

  /**
   * Unregister a pattern
   */
  unregisterPattern(patternId: string): void {
    this.patterns.delete(patternId);
  }

  /**
   * Process event for pattern matching
   */
  async processEvent(event: StreamEvent): Promise<PatternMatch[]> {
    // Add to history
    this.eventHistory.push(event);

    // Limit history size
    if (this.eventHistory.length > 10000) {
      this.eventHistory = this.eventHistory.slice(-10000);
    }

    const matches: PatternMatch[] = [];

    // Check each pattern
    for (const [patternId, pattern] of this.patterns) {
      const patternMatches = await this.checkPattern(event, pattern);
      matches.push(...patternMatches);
    }

    return matches;
  }

  /**
   * Check if event matches pattern
   */
  private async checkPattern(event: StreamEvent, pattern: Pattern): Promise<PatternMatch[]> {
    const matches: PatternMatch[] = [];

    switch (pattern.type) {
      case 'sequence':
        const sequenceMatch = this.checkSequencePattern(event, pattern);
        if (sequenceMatch) {
          matches.push(sequenceMatch);
        }
        break;

      case 'frequency':
        const frequencyMatch = this.checkFrequencyPattern(pattern);
        if (frequencyMatch) {
          matches.push(frequencyMatch);
        }
        break;

      case 'threshold':
        const thresholdMatch = this.checkThresholdPattern(event, pattern);
        if (thresholdMatch) {
          matches.push(thresholdMatch);
        }
        break;

      case 'trend':
        const trendMatch = this.checkTrendPattern(pattern);
        if (trendMatch) {
          matches.push(trendMatch);
        }
        break;
    }

    return matches;
  }

  /**
   * Check sequence pattern
   */
  private checkSequencePattern(event: StreamEvent, pattern: Pattern): PatternMatch | null {
    if (!pattern.sequence || pattern.sequence.length === 0) {
      return null;
    }

    // Look for the sequence in recent events
    const recentEvents = this.eventHistory.slice(-100);
    const sequence = pattern.sequence;

    for (let i = 0; i <= recentEvents.length - sequence.length; i++) {
      let match = true;

      for (let j = 0; j < sequence.length; j++) {
        if (recentEvents[i + j].type !== sequence[j]) {
          match = false;
          break;
        }
      }

      if (match) {
        return {
          patternId: pattern.id,
          events: recentEvents.slice(i, i + sequence.length),
          timestamp: Date.now(),
          confidence: 1.0,
        };
      }
    }

    return null;
  }

  /**
   * Check frequency pattern
   */
  private checkFrequencyPattern(pattern: Pattern): PatternMatch | null {
    if (!pattern.eventType || pattern.frequency === undefined) {
      return null;
    }

    // Count events of the type in the window
    const windowStart = Date.now() - (pattern.windowMs ?? 60000);
    const eventsInWindow = this.eventHistory.filter(
      e => e.type === pattern.eventType! && e.timestamp >= windowStart
    );

    if (eventsInWindow.length >= pattern.frequency!) {
      return {
        patternId: pattern.id,
        events: eventsInWindow,
        timestamp: Date.now(),
        confidence: eventsInWindow.length / (pattern.frequency ?? 1),
      };
    }

    return null;
  }

  /**
   * Check threshold pattern
   */
  private checkThresholdPattern(event: StreamEvent, pattern: Pattern): PatternMatch | null {
    if (!pattern.threshold || !pattern.valueExtractor) {
      return null;
    }

    const value = pattern.valueExtractor(event);

    if (value >= pattern.threshold) {
      return {
        patternId: pattern.id,
        events: [event],
        timestamp: Date.now(),
        confidence: value / pattern.threshold,
      };
    }

    return null;
  }

  /**
   * Check trend pattern
   */
  private checkTrendPattern(pattern: Pattern): PatternMatch | null {
    if (!pattern.eventType || !pattern.valueExtractor) {
      return null;
    }

    const windowStart = Date.now() - (pattern.windowMs ?? 60000);
    const eventsInWindow = this.eventHistory.filter(
      e => e.type === pattern.eventType! && e.timestamp >= windowStart
    );

    if (eventsInWindow.length < 2) {
      return null;
    }

    // Calculate trend
    const values = eventsInWindow.map(e => pattern.valueExtractor!(e));
    const trend = this.calculateTrend(values);

    // Check if trend matches expected
    if (pattern.expectedTrend === 'increasing' && trend > 0.1) {
      return {
        patternId: pattern.id,
        events: eventsInWindow,
        timestamp: Date.now(),
        confidence: Math.abs(trend),
        metadata: { trend },
      };
    } else if (pattern.expectedTrend === 'decreasing' && trend < -0.1) {
      return {
        patternId: pattern.id,
        events: eventsInWindow,
        timestamp: Date.now(),
        confidence: Math.abs(trend),
        metadata: { trend },
      };
    }

    return null;
  }

  /**
   * Calculate linear trend
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    return slope;
  }

  /**
   * Get recent pattern matches
   */
  getPatternMatches(limit?: number): PatternMatch[] {
    let matches = this.patternMatches;

    if (limit) {
      matches = matches.slice(-limit);
    }

    return matches;
  }

  /**
   * Clear pattern matches
   */
  clearPatternMatches(): void {
    this.patternMatches = [];
  }

  /**
   * Reset recognizer
   */
  reset(): void {
    this.patternMatches = [];
    this.eventHistory = [];
  }
}

// ============================================================================
// Trend Analyzer
// ============================================================================

export class TrendAnalyzer {
  private dataPoints: Array<{ timestamp: number; value: number }> = [];

  /**
   * Add data point
   */
  addDataPoint(timestamp: number, value: number): void {
    this.dataPoints.push({ timestamp, value });

    // Limit data points
    if (this.dataPoints.length > 1000) {
      this.dataPoints = this.dataPoints.slice(-1000);
    }
  }

  /**
   * Analyze trend
   */
  analyzeTrend(windowMs?: number): TrendAnalysis {
    if (this.dataPoints.length < 2) {
      return {
        direction: 'stable',
        slope: 0,
        correlation: 0,
        confidence: 0,
      };
    }

    let data = this.dataPoints;

    if (windowMs) {
      const cutoff = Date.now() - windowMs;
      data = data.filter(d => d.timestamp >= cutoff);
    }

    if (data.length < 2) {
      return {
        direction: 'stable',
        slope: 0,
        correlation: 0,
        confidence: 0,
      };
    }

    // Calculate linear regression
    const n = data.length;
    const sumX = data.reduce((sum, d) => sum + d.timestamp, 0);
    const sumY = data.reduce((sum, d) => sum + d.value, 0);
    const sumXY = data.reduce((sum, d) => sum + d.timestamp * d.value, 0);
    const sumX2 = data.reduce((sum, d) => sum + d.timestamp * d.timestamp, 0);
    const sumY2 = data.reduce((sum, d) => sum + d.value * d.value, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate correlation coefficient
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    const correlation = denominator !== 0 ? numerator / denominator : 0;

    // Determine direction
    const direction = Math.abs(slope) < 0.001 ? 'stable' : slope > 0 ? 'increasing' : 'decreasing';

    // Calculate confidence based on correlation
    const confidence = Math.abs(correlation);

    return {
      direction,
      slope,
      correlation,
      confidence,
      intercept,
    };
  }

  /**
   * Predict next value
   */
  predictNext(windowMs?: number): number | null {
    const analysis = this.analyzeTrend(windowMs);

    if (analysis.confidence < 0.5) {
      return null;
    }

    const lastTimestamp = this.dataPoints[this.dataPoints.length - 1]?.timestamp ?? Date.now();
    const prediction = analysis.intercept! + analysis.slope * (lastTimestamp + 1000);

    return prediction;
  }

  /**
   * Reset analyzer
   */
  reset(): void {
    this.dataPoints = [];
  }
}

// ============================================================================
// Types
// ============================================================================

export interface Pattern {
  id: string;
  type: 'sequence' | 'frequency' | 'threshold' | 'trend';
  eventType?: string;
  sequence?: string[];
  frequency?: number;
  threshold?: number;
  windowMs?: number;
  valueExtractor?: (event: StreamEvent) => number;
  expectedTrend?: 'increasing' | 'decreasing' | 'stable';
}

export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable';
  slope: number;
  correlation: number;
  confidence: number;
  intercept?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create stream analytics with default configuration
 */
export function createStreamAnalytics(options?: AnomalyDetection): StreamAnalytics {
  return new StreamAnalytics(options);
}

/**
 * Create pattern recognizer
 */
export function createPatternRecognizer(): PatternRecognizer {
  return new PatternRecognizer();
}

/**
 * Create trend analyzer
 */
export function createTrendAnalyzer(): TrendAnalyzer {
  return new TrendAnalyzer();
}
