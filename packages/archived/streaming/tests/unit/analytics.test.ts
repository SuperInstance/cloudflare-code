/**
 * Unit tests for Stream Analytics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StreamAnalytics,
  PatternRecognizer,
  TrendAnalyzer,
  createStreamAnalytics,
  createPatternRecognizer,
  createTrendAnalyzer,
} from '../../src/analytics/analytics';
import type { StreamEvent, AnomalyDetection, Pattern } from '../../src/types';

describe('StreamAnalytics', () => {
  let analytics: StreamAnalytics;

  beforeEach(() => {
    analytics = new StreamAnalytics();
  });

  describe('recordEvent', () => {
    it('should record event with latency', () => {
      const event: StreamEvent = {
        id: '1',
        type: 'test',
        data: null,
        timestamp: Date.now(),
      };

      analytics.recordEvent(event, 100);

      const metrics = analytics.getMetrics();

      expect(metrics.eventCount).toBeGreaterThan(0);
    });

    it('should track event type distribution', () => {
      const event1: StreamEvent = {
        id: '1',
        type: 'type1',
        data: null,
        timestamp: Date.now(),
      };

      const event2: StreamEvent = {
        id: '2',
        type: 'type2',
        data: null,
        timestamp: Date.now(),
      };

      analytics.recordEvent(event1);
      analytics.recordEvent(event2);

      const distribution = analytics.getEventTypeDistribution();

      expect(distribution.get('type1')).toBe(1);
      expect(distribution.get('type2')).toBe(1);
    });
  });

  describe('recordError', () => {
    it('should record errors', () => {
      analytics.recordError(new Error('Test error'), 'eventType');

      const errorMetrics = analytics.getErrorMetrics();

      expect(errorMetrics.count).toBe(1);
      expect(errorMetrics.types['eventType']).toBe(1);
    });
  });

  describe('getMetrics', () => {
    it('should return current metrics', () => {
      const event: StreamEvent = {
        id: '1',
        type: 'test',
        data: null,
        timestamp: Date.now(),
      };

      analytics.recordEvent(event, 100);

      const metrics = analytics.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.eventCount).toBeGreaterThan(0);
      expect(metrics.latency).toBeDefined();
      expect(metrics.throughput).toBeDefined();
      expect(metrics.errors).toBeDefined();
    });
  });

  describe('getLatencyMetrics', () => {
    it('should return latency metrics', () => {
      analytics.recordEvent(
        {
          id: '1',
          type: 'test',
          data: null,
          timestamp: Date.now(),
        },
        100
      );

      analytics.recordEvent(
        {
          id: '2',
          type: 'test',
          data: null,
          timestamp: Date.now(),
        },
        200
      );

      const latency = analytics.getLatencyMetrics();

      expect(latency.min).toBe(100);
      expect(latency.max).toBe(200);
      expect(latency.avg).toBeGreaterThan(0);
    });
  });

  describe('getThroughputMetrics', () => {
    it('should return throughput metrics', () => {
      const event: StreamEvent = {
        id: '1',
        type: 'test',
        data: null,
        timestamp: Date.now(),
      };

      analytics.recordEvent(event);

      const throughput = analytics.getThroughputMetrics();

      expect(throughput.current).toBeGreaterThanOrEqual(0);
      expect(throughput.peak).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getErrorMetrics', () => {
    it('should return error metrics', () => {
      analytics.recordError(new Error('Error 1'));
      analytics.recordError(new Error('Error 2'));

      const errors = analytics.getErrorMetrics();

      expect(errors.count).toBe(2);
      expect(errors.rate).toBeGreaterThan(0);
    });
  });

  describe('anomaly detection', () => {
    it('should detect anomalies with high threshold', () => {
      const analyticsWithHighThreshold = new StreamAnalytics({
        enabled: true,
        threshold: 2,
      });

      // Record normal values
      for (let i = 0; i < 10; i++) {
        analyticsWithHighThreshold.recordEvent(
          {
            id: `${i}`,
            type: 'test',
            data: null,
            timestamp: Date.now(),
          },
          100
        );
      }

      // Record anomalous value
      const isAnomalous = analyticsWithHighThreshold.isAnomalous(1000);

      expect(isAnomalous).toBe(true);
    });

    it('should not detect anomalies with disabled detection', () => {
      const analyticsDisabled = new StreamAnalytics({
        enabled: false,
      });

      analyticsDisabled.recordEvent(
        {
          id: '1',
          type: 'test',
          data: null,
          timestamp: Date.now(),
        },
        100
      );

      const isAnomalous = analyticsDisabled.isAnomalous(10000);

      expect(isAnomalous).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all analytics', () => {
      const event: StreamEvent = {
        id: '1',
        type: 'test',
        data: null,
        timestamp: Date.now(),
      };

      analytics.recordEvent(event, 100);
      analytics.recordError(new Error('Test'));

      analytics.reset();

      const metrics = analytics.getMetrics();

      expect(metrics.eventCount).toBe(0);
      expect(metrics.errors.count).toBe(0);
    });
  });

  describe('getUptime', () => {
    it('should return uptime', () => {
      const uptime = analytics.getUptime();

      expect(uptime).toBeGreaterThan(0);
    });
  });
});

describe('PatternRecognizer', () => {
  let recognizer: PatternRecognizer;

  beforeEach(() => {
    recognizer = createPatternRecognizer();
  });

  describe('sequence pattern', () => {
    it('should recognize sequence pattern', async () => {
      const pattern: Pattern = {
        id: 'seq1',
        type: 'sequence',
        sequence: ['start', 'middle', 'end'],
      };

      recognizer.registerPattern(pattern);

      await recognizer.processEvent({
        id: '1',
        type: 'start',
        data: null,
        timestamp: Date.now(),
      });

      await recognizer.processEvent({
        id: '2',
        type: 'middle',
        data: null,
        timestamp: Date.now(),
      });

      await recognizer.processEvent({
        id: '3',
        type: 'end',
        data: null,
        timestamp: Date.now(),
      });

      const matches = recognizer.getPatternMatches();

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].patternId).toBe('seq1');
    });
  });

  describe('frequency pattern', () => {
    it('should recognize frequency pattern', async () => {
      const pattern: Pattern = {
        id: 'freq1',
        type: 'frequency',
        eventType: 'test',
        frequency: 5,
        windowMs: 1000,
      };

      recognizer.registerPattern(pattern);

      // Add 5 events
      for (let i = 0; i < 5; i++) {
        await recognizer.processEvent({
          id: `${i}`,
          type: 'test',
          data: null,
          timestamp: Date.now(),
        });
      }

      const matches = recognizer.getPatternMatches();

      expect(matches.length).toBeGreaterThan(0);
    });
  });

  describe('threshold pattern', () => {
    it('should recognize threshold pattern', async () => {
      const pattern: Pattern = {
        id: 'thresh1',
        type: 'threshold',
        threshold: 100,
        valueExtractor: (e) => (e.data as { value: number }).value,
      };

      recognizer.registerPattern(pattern);

      await recognizer.processEvent({
        id: '1',
        type: 'test',
        data: { value: 150 },
        timestamp: Date.now(),
      });

      const matches = recognizer.getPatternMatches();

      expect(matches.length).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should reset recognizer', async () => {
      await recognizer.processEvent({
        id: '1',
        type: 'test',
        data: null,
        timestamp: Date.now(),
      });

      recognizer.reset();

      expect(recognizer['eventHistory']).toHaveLength(0);
    });
  });
});

describe('TrendAnalyzer', () => {
  let analyzer: TrendAnalyzer;

  beforeEach(() => {
    analyzer = createTrendAnalyzer();
  });

  describe('addDataPoint', () => {
    it('should add data point', () => {
      analyzer.addDataPoint(Date.now(), 100);

      expect(analyzer['dataPoints']).toHaveLength(1);
    });

    it('should limit data points', () => {
      for (let i = 0; i < 2000; i++) {
        analyzer.addDataPoint(Date.now() + i, i);
      }

      expect(analyzer['dataPoints'].length).toBeLessThanOrEqual(1000);
    });
  });

  describe('analyzeTrend', () => {
    it('should detect increasing trend', () => {
      const now = Date.now();

      for (let i = 0; i < 10; i++) {
        analyzer.addDataPoint(now + i * 1000, i * 10);
      }

      const analysis = analyzer.analyzeTrend();

      expect(analysis.direction).toBe('increasing');
      expect(analysis.slope).toBeGreaterThan(0);
    });

    it('should detect decreasing trend', () => {
      const now = Date.now();

      for (let i = 0; i < 10; i++) {
        analyzer.addDataPoint(now + i * 1000, 100 - i * 10);
      }

      const analysis = analyzer.analyzeTrend();

      expect(analysis.direction).toBe('decreasing');
      expect(analysis.slope).toBeLessThan(0);
    });

    it('should detect stable trend', () => {
      const now = Date.now();

      for (let i = 0; i < 10; i++) {
        analyzer.addDataPoint(now + i * 1000, 50);
      }

      const analysis = analyzer.analyzeTrend();

      expect(analysis.direction).toBe('stable');
    });

    it('should return correlation coefficient', () => {
      const now = Date.now();

      for (let i = 0; i < 10; i++) {
        analyzer.addDataPoint(now + i * 1000, i * 10);
      }

      const analysis = analyzer.analyzeTrend();

      expect(analysis.correlation).toBeGreaterThanOrEqual(-1);
      expect(analysis.correlation).toBeLessThanOrEqual(1);
    });
  });

  describe('predictNext', () => {
    it('should predict next value', () => {
      const now = Date.now();

      for (let i = 0; i < 10; i++) {
        analyzer.addDataPoint(now + i * 1000, i * 10);
      }

      const prediction = analyzer.predictNext();

      expect(prediction).not.toBeNull();
    });

    it('should return null for insufficient data', () => {
      const prediction = analyzer.predictNext();

      expect(prediction).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset analyzer', () => {
      analyzer.addDataPoint(Date.now(), 100);
      analyzer.reset();

      expect(analyzer['dataPoints']).toHaveLength(0);
    });
  });
});

describe('Helper functions', () => {
  it('should create stream analytics', () => {
    const analytics = createStreamAnalytics();

    expect(analytics).toBeInstanceOf(StreamAnalytics);
  });

  it('should create pattern recognizer', () => {
    const recognizer = createPatternRecognizer();

    expect(recognizer).toBeInstanceOf(PatternRecognizer);
  });

  it('should create trend analyzer', () => {
    const analyzer = createTrendAnalyzer();

    expect(analyzer).toBeInstanceOf(TrendAnalyzer);
  });
});
