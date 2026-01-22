/**
 * Threat Detection Tests
 */

import { describe, it, expect } from 'vitest';
import { ThreatDetectionEngine } from '../threat/detectors';
import { ThreatType } from '../types';

describe('ThreatDetectionEngine', () => {
  let engine: ThreatDetectionEngine;

  beforeEach(() => {
    engine = new ThreatDetectionEngine();
  });

  describe('Signature-Based Detection', () => {
    it('should detect SQL injection', () => {
      const request = {
        body: { query: "SELECT * FROM users WHERE id = 1 OR 1=1" },
        ip: '192.168.1.100'
      };

      const detections = engine.analyzeRequest(request);

      expect(detections.length).toBeGreaterThan(0);
      expect(detections[0].threatType).toBe(ThreatType.SQL_INJECTION);
    });

    it('should detect XSS attacks', () => {
      const request = {
        query: { input: '<script>alert("XSS")</script>' },
        ip: '192.168.1.101'
      };

      const detections = engine.analyzeRequest(request);

      expect(detections.length).toBeGreaterThan(0);
      expect(detections[0].threatType).toBe(ThreatType.XSS_ATTACK);
    });

    it('should detect command injection', () => {
      const request = {
        body: { command: 'ls; rm -rf /' },
        ip: '192.168.1.102'
      };

      const detections = engine.analyzeRequest(request);

      expect(detections.length).toBeGreaterThan(0);
      expect(detections[0].threatType).toBe(ThreatType.COMMAND_INJECTION);
    });

    it('should detect path traversal', () => {
      const request = {
        query: { file: '../../../etc/passwd' },
        ip: '192.168.1.103'
      };

      const detections = engine.analyzeRequest(request);

      expect(detections.length).toBeGreaterThan(0);
      expect(detections[0].threatType).toBe(ThreatType.PATH_TRAVERSAL);
    });

    it('should not detect false positives in benign input', () => {
      const request = {
        body: { name: 'John Doe', email: 'john@example.com' },
        ip: '192.168.1.104'
      };

      const detections = engine.analyzeRequest(request);

      expect(detections.length).toBe(0);
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect anomalies in metrics', () => {
      const detector = engine.getAnomalyDetector();

      // Build baseline
      for (let i = 0; i < 100; i++) {
        detector.recordMetric('requests_per_second', 50 + Math.random() * 10);
      }

      // Anomalous value
      const anomaly = detector.detectAnomaly('requests_per_second', 500);

      expect(anomaly).not.toBeNull();
      expect(anomaly!.severity).toBe('critical');
    });

    it('should not flag normal values as anomalies', () => {
      const detector = engine.getAnomalyDetector();

      // Build baseline
      for (let i = 0; i < 100; i++) {
        detector.recordMetric('requests_per_second', 50 + Math.random() * 10);
      }

      // Normal value
      const anomaly = detector.detectAnomaly('requests_per_second', 55);

      expect(anomaly).toBeNull();
    });
  });

  describe('Behavioral Analysis', () => {
    it('should detect anomalous behavior', () => {
      const analyzer = engine.getBehavioralAnalyzer();

      // Build profile
      for (let i = 0; i < 10; i++) {
        analyzer.analyzeBehavior('user123', 'user', {
          action: 'login',
          resource: '/dashboard',
          timestamp: Date.now() - (10 - i) * 60000,
          location: 'New York'
        });
      }

      // Anomalous login from different location
      const analysis = analyzer.analyzeBehavior('user123', 'user', {
        action: 'login',
        resource: '/dashboard',
        timestamp: Date.now(),
        location: 'Moscow'
      });

      expect(analysis.isAnomalous).toBe(true);
      expect(analysis.riskScore).toBeGreaterThan(0);
    });

    it('should not flag normal behavior', () => {
      const analyzer = engine.getBehavioralAnalyzer();

      // Build profile
      for (let i = 0; i < 10; i++) {
        analyzer.analyzeBehavior('user123', 'user', {
          action: 'login',
          resource: '/dashboard',
          timestamp: Date.now() - (10 - i) * 60000,
          location: 'New York'
        });
      }

      // Normal login
      const analysis = analyzer.analyzeBehavior('user123', 'user', {
        action: 'login',
        resource: '/dashboard',
        timestamp: Date.now(),
        location: 'New York'
      });

      expect(analysis.isAnomalous).toBe(false);
    });
  });
});
