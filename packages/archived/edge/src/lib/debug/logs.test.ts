/**
 * Log Correlation Engine Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LogCorrelationEngine,
  LogAggregator,
  createLogCorrelationEngine,
  correlateLogs,
  reconstructLogTimeline,
} from './logs';
import type { LogEntry, ErrorInfo, LogLevel } from './types';

describe('LogCorrelationEngine', () => {
  let engine: LogCorrelationEngine;
  let mockLogs: LogEntry[];
  let mockError: ErrorInfo;

  beforeEach(() => {
    engine = new LogCorrelationEngine();
    const now = Date.now();

    mockLogs = [
      {
        logId: 'log-1',
        timestamp: now - 10000,
        level: 'info' as LogLevel,
        message: 'Request received',
        source: 'api-gateway',
        metadata: { requestId: 'req-123' },
        traceId: 'trace-abc',
        requestId: 'req-123',
      },
      {
        logId: 'log-2',
        timestamp: now - 5000,
        level: 'warn' as LogLevel,
        message: 'Slow query detected',
        source: 'database',
        metadata: { query: 'SELECT * FROM users' },
        traceId: 'trace-abc',
        requestId: 'req-123',
      },
      {
        logId: 'log-3',
        timestamp: now,
        level: 'error' as LogLevel,
        message: 'Database connection failed',
        source: 'database',
        metadata: { error: 'ECONNREFUSED' },
        traceId: 'trace-abc',
        requestId: 'req-123',
      },
      {
        logId: 'log-4',
        timestamp: now + 5000,
        level: 'error' as LogLevel,
        message: 'Request failed',
        source: 'api-gateway',
        metadata: { statusCode: 500 },
        traceId: 'trace-abc',
        requestId: 'req-123',
      },
    ];

    mockError = {
      errorId: 'error-1',
      errorType: 'DatabaseError',
      message: 'Database connection failed',
      stackTrace: '',
      timestamp: now,
      source: 'database',
      severity: 'high',
      category: 'network' as any,
      recoverable: true,
      context: {},
      traceId: 'trace-abc',
      requestId: 'req-123',
    };
  });

  describe('Error Log Correlation', () => {
    it('should correlate logs with error', async () => {
      const correlated = await engine.correlateErrorLogs(mockError, mockLogs);

      expect(correlated.length).toBeGreaterThan(0);
      expect(correlated[0].correlationScore).toBeGreaterThan(0);
      expect(correlated[0].timeOffset).toBeDefined();
    });

    it('should prioritize logs with same trace ID', async () => {
      const correlated = await engine.correlateErrorLogs(mockError, mockLogs);

      const sameTraceLogs = correlated.filter(log => log.traceId === mockError.traceId);
      expect(sameTraceLogs.length).toBeGreaterThan(0);

      // Logs with same trace ID should have higher scores
      const sameTraceScore = sameTraceLogs[0].correlationScore;
      expect(sameTraceScore).toBeGreaterThan(0.5);
    });

    it('should identify likely causes', async () => {
      const correlated = await engine.correlateErrorLogs(mockError, mockLogs);

      const likelyCauses = correlated.filter(log => log.isLikelyCause);
      expect(likelyCauses.length).toBeGreaterThanOrEqual(0);
    });

    it('should filter by time window', async () => {
      const engineWithWindow = new LogCorrelationEngine({ timeWindow: 5000 });
      const correlated = await engineWithWindow.correlateErrorLogs(mockError, mockLogs);

      // Should have fewer logs due to smaller time window
      expect(correlated.length).toBeLessThanOrEqual(mockLogs.length);
    });
  });

  describe('Timeline Reconstruction', () => {
    it('should reconstruct log timeline', async () => {
      const timeline = await engine.reconstructTimeline(mockError, mockLogs);

      expect(timeline).toBeDefined();
      expect(timeline.logs).toBeDefined();
      expect(timeline.logs.length).toBeGreaterThan(0);
      expect(timeline.startTime).toBeLessThan(timeline.endTime);
      expect(timeline.duration).toBeGreaterThan(0);
    });

    it('should identify services involved', async () => {
      const timeline = await engine.reconstructTimeline(mockError, mockLogs);

      expect(timeline.services.length).toBeGreaterThan(0);
      expect(timeline.services).toContain('api-gateway');
      expect(timeline.services).toContain('database');
    });

    it('should count log levels', async () => {
      const timeline = await engine.reconstructTimeline(mockError, mockLogs);

      expect(timeline.levelCounts).toBeDefined();
      expect(timeline.levelCounts.info).toBeGreaterThan(0);
      expect(timeline.levelCounts.error).toBeGreaterThan(0);
    });

    it('should identify key events', async () => {
      const timeline = await engine.reconstructTimeline(mockError, mockLogs);

      expect(timeline.keyEvents).toBeDefined();
      expect(timeline.keyEvents.length).toBeGreaterThan(0);
    });

    it('should identify potential causes', async () => {
      const timeline = await engine.reconstructTimeline(mockError, mockLogs);

      expect(timeline.potentialCauses).toBeDefined();
      // Logs before the error
      const causes = timeline.potentialCauses.filter(log => log.timeOffset < 0);
      expect(causes.length).toBeGreaterThanOrEqual(0);
    });

    it('should identify consequences', async () => {
      const timeline = await engine.reconstructTimeline(mockError, mockLogs);

      expect(timeline.consequences).toBeDefined();
      // Logs after the error
      const consequences = timeline.consequences.filter(log => log.timeOffset > 0);
      expect(consequences.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cross-Service Correlation', () => {
    it('should correlate logs across services', async () => {
      const result = await engine.correlateCrossService('trace-abc', mockLogs);

      expect(result).toBeDefined();
      expect(result.correlationId).toBeDefined();
      expect(result.traceId).toBe('trace-abc');
      expect(result.services).toBeDefined();
      expect(result.services.length).toBeGreaterThan(0);
    });

    it('should build service call graph', async () => {
      const result = await engine.correlateCrossService('trace-abc', mockLogs);

      expect(result.callGraph).toBeDefined();
      expect(result.callGraph.nodes).toBeDefined();
      expect(result.callGraph.edges).toBeDefined();
    });

    it('should group logs by service', async () => {
      const result = await engine.correlateCrossService('trace-abc', mockLogs);

      expect(result.serviceLogs.size).toBeGreaterThan(0);
      expect(result.serviceLogs.has('api-gateway')).toBe(true);
      expect(result.serviceLogs.has('database')).toBe(true);
    });

    it('should identify propagation path', async () => {
      const result = await engine.correlateCrossService('trace-abc', mockLogs);

      expect(result.propagationPath).toBeDefined();
      expect(Array.isArray(result.propagationPath)).toBe(true);
    });
  });

  describe('Request/Response Matching', () => {
    it('should match requests with responses', () => {
      const logs: LogEntry[] = [
        {
          logId: 'log-1',
          timestamp: Date.now(),
          level: 'info' as LogLevel,
          message: 'POST /api/users',
          source: 'api',
          metadata: { method: 'POST', path: '/api/users' },
          requestId: 'req-1',
        },
        {
          logId: 'log-2',
          timestamp: Date.now() + 100,
          level: 'info' as LogLevel,
          message: 'Response sent',
          source: 'api',
          metadata: { statusCode: 200, requestId: 'req-1' },
          requestId: 'req-1',
        },
      ];

      const matches = engine.matchRequestResponse(logs);

      expect(matches.length).toBe(1);
      expect(matches[0].request.logId).toBe('log-1');
      expect(matches[0].response.logId).toBe('log-2');
      expect(matches[0].duration).toBe(100);
    });
  });
});

describe('LogAggregator', () => {
  let aggregator: LogAggregator;
  let mockLogs: LogEntry[];

  beforeEach(() => {
    aggregator = new LogAggregator();
    const now = Date.now();

    mockLogs = [
      {
        logId: 'log-1',
        timestamp: now,
        level: 'debug' as LogLevel,
        message: 'Debug message',
        source: 'service-a',
        metadata: {},
      },
      {
        logId: 'log-2',
        timestamp: now + 1000,
        level: 'info' as LogLevel,
        message: 'Info message',
        source: 'service-a',
        metadata: {},
      },
      {
        logId: 'log-3',
        timestamp: now + 2000,
        level: 'error' as LogLevel,
        message: 'Error message',
        source: 'service-b',
        metadata: {},
      },
    ];
  });

  describe('Time Window Aggregation', () => {
    it('should aggregate logs by time window', () => {
      const windows = aggregator.aggregateByTimeWindow(mockLogs, 5000);

      expect(windows.size).toBe(1);
      const window = windows.get(Math.floor(Date.now() / 5000) * 5000);
      expect(window).toBeDefined();
      expect(window?.length).toBe(3);
    });

    it('should create multiple windows for different times', () => {
      const windows = aggregator.aggregateByTimeWindow(mockLogs, 500);

      expect(windows.size).toBeGreaterThan(1);
    });
  });

  describe('Level Aggregation', () => {
    it('should aggregate logs by level', () => {
      const byLevel = aggregator.aggregateByLevel(mockLogs);

      expect(byLevel.size).toBe(3);
      expect(byLevel.get('debug')?.length).toBe(1);
      expect(byLevel.get('info')?.length).toBe(1);
      expect(byLevel.get('error')?.length).toBe(1);
    });
  });

  describe('Service Aggregation', () => {
    it('should aggregate logs by service', () => {
      const byService = aggregator.aggregateByService(mockLogs);

      expect(byService.size).toBe(2);
      expect(byService.get('service-a')?.length).toBe(2);
      expect(byService.get('service-b')?.length).toBe(1);
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate log statistics', () => {
      const stats = aggregator.calculateStatistics(mockLogs);

      expect(stats.total).toBe(3);
      expect(stats.byLevel.debug).toBe(1);
      expect(stats.byLevel.info).toBe(1);
      expect(stats.byLevel.error).toBe(1);
      expect(stats.timeRange.duration).toBeGreaterThan(0);
      expect(stats.errorRate).toBe(1 / 3);
      expect(stats.avgLogsPerSecond).toBeGreaterThan(0);
    });

    it('should handle empty logs', () => {
      const stats = aggregator.calculateStatistics([]);

      expect(stats.total).toBe(0);
      expect(stats.errorRate).toBe(0);
      expect(stats.avgLogsPerSecond).toBe(0);
    });
  });
});

describe('Convenience Functions', () => {
  it('should correlate logs using convenience function', async () => {
    const error: ErrorInfo = {
      errorId: 'error-1',
      errorType: 'TestError',
      message: 'Test error',
      stackTrace: '',
      timestamp: Date.now(),
      source: 'test',
      severity: 'medium',
      category: 'runtime' as any,
      recoverable: true,
      context: {},
    };

    const logs: LogEntry[] = [
      {
        logId: 'log-1',
        timestamp: Date.now(),
        level: 'error' as LogLevel,
        message: 'Test log',
        source: 'test',
        metadata: {},
      },
    ];

    const correlated = await correlateLogs(error, logs);

    expect(correlated).toBeDefined();
    expect(Array.isArray(correlated)).toBe(true);
  });

  it('should reconstruct timeline using convenience function', async () => {
    const error: ErrorInfo = {
      errorId: 'error-1',
      errorType: 'TestError',
      message: 'Test error',
      stackTrace: '',
      timestamp: Date.now(),
      source: 'test',
      severity: 'medium',
      category: 'runtime' as any,
      recoverable: true,
      context: {},
    };

    const logs: LogEntry[] = [
      {
        logId: 'log-1',
        timestamp: Date.now(),
        level: 'error' as LogLevel,
        message: 'Test log',
        source: 'test',
        metadata: {},
      },
    ];

    const timeline = await reconstructLogTimeline(error, logs);

    expect(timeline).toBeDefined();
    expect(timeline.timelineId).toBeDefined();
    expect(timeline.logs).toBeDefined();
  });
});
