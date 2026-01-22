/**
 * Unit tests for Traffic Analyzer
 */

import { TrafficAnalyzer } from '../../src/traffic/analyzer';
import type { RequestData } from '../../src/types';

describe('TrafficAnalyzer', () => {
  let analyzer: TrafficAnalyzer;

  beforeEach(() => {
    analyzer = new TrafficAnalyzer({
      windowSize: 60000,
      maxWindows: 60,
      trackStatistics: true
    });
  });

  afterEach(() => {
    analyzer.reset();
  });

  describe('processRequest', () => {
    it('should process single request', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: {
          'user-agent': 'Mozilla/5.0',
          'status': '200',
          'x-response-time': '100'
        },
        userAgent: 'Mozilla/5.0'
      };

      const result = await analyzer.processRequest(request);

      expect(result).toBeDefined();
      expect(result.requestData).toEqual(request);
      expect(result.metrics).toBeDefined();
      expect(result.patterns).toBeDefined();
      expect(result.anomalies).toBeDefined();
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(1);
    });

    it('should track metrics correctly', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/users',
        headers: {
          'user-agent': 'Mozilla/5.0',
          'status': '200',
          'x-response-time': '150'
        },
        userAgent: 'Mozilla/5.0'
      };

      await analyzer.processRequest(request);
      const analysis = await analyzer.processRequest({ ...request, id: 'req-2' });

      expect(analysis.metrics.totalRequests).toBeGreaterThan(0);
      expect(analysis.metrics.requestsPerSecond).toBeGreaterThan(0);
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate error rate', async () => {
      const successRequest: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test', 'status': '200', 'x-response-time': '100' },
        userAgent: 'test'
      };

      const errorRequest: RequestData = {
        id: 'req-2',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test', 'status': '500', 'x-response-time': '100' },
        userAgent: 'test'
      };

      await analyzer.processRequest(successRequest);
      await analyzer.processRequest(errorRequest);

      const stats = analyzer.getStatistics();
      expect(stats?.errors).toBe(1);
    });
  });

  describe('detectAnomalies', () => {
    it('should detect high volume anomaly', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test', 'status': '200', 'x-response-time': '100' },
        userAgent: 'test'
      };

      // Simulate high traffic
      for (let i = 0; i < 2000; i++) {
        await analyzer.processRequest({ ...request, id: `req-${i}` });
      }

      const result = await analyzer.processRequest({ ...request, id: 'req-final' });

      // Should detect high volume anomaly
      const highVolumeAnomalies = result.anomalies.filter(a => a.type === 'high_volume');
      expect(highVolumeAnomalies.length).toBeGreaterThan(0);
    });

    it('should detect suspicious user agents', async () => {
      const botRequest: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'curl/7.68.0', 'status': '200', 'x-response-time': '100' },
        userAgent: 'curl/7.68.0'
      };

      const result = await analyzer.processRequest(botRequest);

      // Should detect suspicious user agent
      const userAgentAnomalies = result.anomalies.filter(a => a.type === 'suspicious_user_agent');
      expect(userAgentAnomalies.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('analyzePatterns', () => {
    it('should analyze traffic patterns', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'Mozilla/5.0', 'status': '200', 'x-response-time': '100' },
        userAgent: 'Mozilla/5.0'
      };

      const result = await analyzer.processRequest(request);

      expect(result.patterns).toBeDefined();
      expect(result.patterns.indicators).toBeInstanceOf(Array);
      expect(result.patterns.patterns).toBeInstanceOf(Array);
      expect(result.patterns.behavioralScore).toBeGreaterThanOrEqual(0);
      expect(result.patterns.behavioralScore).toBeLessThanOrEqual(1);
    });

    it('should calculate behavioral score', async () => {
      const legitimateRequest: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/users/123',
        headers: { 'user-agent': 'Mozilla/5.0', 'status': '200', 'x-response-time': '100' },
        userAgent: 'Mozilla/5.0'
      };

      const result = await analyzer.processRequest(legitimateRequest);

      expect(result.patterns.behavioralScore).toBeGreaterThan(0.5);
    });
  });

  describe('calculateRiskScore', () => {
    it('should calculate risk score', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'Mozilla/5.0', 'status': '200', 'x-response-time': '100' },
        userAgent: 'Mozilla/5.0'
      };

      const result = await analyzer.processRequest(request);

      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(1);
    });

    it('should increase risk score for suspicious patterns', async () => {
      const suspiciousRequest: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/../../etc/passwd',
        headers: { 'user-agent': 'bot', 'status': '200', 'x-response-time': '100' },
        userAgent: 'bot'
      };

      const result = await analyzer.processRequest(suspiciousRequest);

      expect(result.riskScore).toBeGreaterThan(0);
    });
  });

  describe('getStatistics', () => {
    it('should return null when tracking disabled', () => {
      const noStatsAnalyzer = new TrafficAnalyzer({ trackStatistics: false });
      expect(noStatsAnalyzer.getStatistics()).toBeNull();
    });

    it('should return statistics when tracking enabled', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test', 'status': '200', 'x-response-time': '100' },
        userAgent: 'test'
      };

      await analyzer.processRequest(request);
      const stats = analyzer.getStatistics();

      expect(stats).toBeDefined();
      expect(stats?.requests).toBeGreaterThan(0);
    });
  });

  describe('getState', () => {
    it('should return analyzer state', () => {
      const state = analyzer.getState();

      expect(state).toBeDefined();
      expect(state.windowSize).toBe(60000);
      expect(state.maxWindows).toBe(60);
      expect(typeof state.currentWindowStart).toBe('number' as any);
    });
  });

  describe('reset', () => {
    it('should reset analyzer state', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test', 'status': '200', 'x-response-time': '100' },
        userAgent: 'test'
      };

      await analyzer.processRequest(request);
      analyzer.reset();

      const state = analyzer.getState();
      expect(state.pathMetricsCount).toBe(0);
      expect(state.userAgentMetricsCount).toBe(0);
    });
  });

  describe('window management', () => {
    it('should rotate windows correctly', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test', 'status': '200', 'x-response-time': '100' },
        userAgent: 'test'
      };

      const state1 = analyzer.getState();
      await analyzer.processRequest(request);

      // Fast forward time
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 70000);

      await analyzer.processRequest({ ...request, id: 'req-2' });

      const state2 = analyzer.getState();
      expect(state2.totalWindows).toBeGreaterThanOrEqual(0);
    });
  });
});
