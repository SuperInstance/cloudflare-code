import { describe, it, expect, beforeEach } from 'vitest';
import { FaultDetector, FaultDetectorConfig } from '../../src/fault/detector';
import { CircuitMetrics, CircuitState } from '../../src/types';

describe('FaultDetector', () => {
  let detector: FaultDetector;
  let config: FaultDetectorConfig;

  beforeEach(() => {
    config = {
      enablePredictive: true,
      anomalyThreshold: 0.7,
      patternWindowSize: 100,
      minConfidence: 0.6,
      learningRate: 0.1,
      enableTrendAnalysis: true,
      trendThreshold: 0.3,
    };
    detector = new FaultDetector(config);
  });

  const createHealthyMetrics = (): CircuitMetrics => ({
    totalRequests: 100,
    successfulRequests: 95,
    failedRequests: 5,
    rejectedRequests: 0,
    timeoutRequests: 0,
    errorRate: 5,
    averageDuration: 100,
    p50Duration: 80,
    p95Duration: 150,
    p99Duration: 200,
    slowCallRate: 2,
    lastStateChange: Date.now(),
    timeInCurrentState: 10000,
    state: CircuitState.CLOSED,
  });

  const createUnhealthyMetrics = (): CircuitMetrics => ({
    totalRequests: 100,
    successfulRequests: 30,
    failedRequests: 70,
    rejectedRequests: 0,
    timeoutRequests: 0,
    errorRate: 70,
    averageDuration: 5000,
    p50Duration: 4000,
    p95Duration: 8000,
    p99Duration: 12000,
    slowCallRate: 60,
    lastStateChange: Date.now(),
    timeInCurrentState: 10000,
    state: CircuitState.CLOSED,
  });

  describe('Fault Detection', () => {
    it('should not detect faults in healthy metrics', () => {
      const metrics = createHealthyMetrics();
      const result = detector.detect(metrics, CircuitState.CLOSED);

      expect(result.faultDetected).toBe(false);
      expect(result.issues.length).toBe(0);
    });

    it('should detect high error rate', () => {
      const metrics = createUnhealthyMetrics();
      const result = detector.detect(metrics, CircuitState.CLOSED);

      expect(result.faultDetected).toBe(true);

      const errorRateIssue = result.issues.find((i) => i.type === 'high_error_rate');
      expect(errorRateIssue).toBeDefined();
      expect(errorRateIssue?.severity).toBeGreaterThan(0.5);
    });

    it('should detect high slow call rate', () => {
      const metrics = createUnhealthyMetrics();
      const result = detector.detect(metrics, CircuitState.CLOSED);

      const slowCallIssue = result.issues.find((i) => i.type === 'high_slow_call_rate');
      expect(slowCallIssue).toBeDefined();
    });

    it('should detect high latency', () => {
      const metrics = createUnhealthyMetrics();
      const result = detector.detect(metrics, CircuitState.CLOSED);

      const latencyIssue = result.issues.find((i) => i.type === 'high_latency');
      expect(latencyIssue).toBeDefined();
    });

    it('should detect high p99 latency', () => {
      const metrics = createUnhealthyMetrics();
      const result = detector.detect(metrics, CircuitState.CLOSED);

      const p99Issue = result.issues.find((i) => i.type === 'high_p99_latency');
      expect(p99Issue).toBeDefined();
    });

    it('should return fault detected when circuit is open', () => {
      const metrics = createHealthyMetrics();
      const result = detector.detect(metrics, CircuitState.OPEN);

      expect(result.faultDetected).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('should return fault detected when circuit is isolated', () => {
      const metrics = createHealthyMetrics();
      const result = detector.detect(metrics, CircuitState.ISOLATED);

      expect(result.faultDetected).toBe(true);
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('Anomaly Detection', () => {
    it('should establish baseline from healthy metrics', () => {
      const metrics = createHealthyMetrics();
      detector.updateBaseline(metrics);

      // Should not detect anomalies initially
      const result = detector.detect(metrics, CircuitState.CLOSED);
      const anomalyIssue = result.issues.find((i) => i.type === 'anomaly_detected');

      expect(anomalyIssue).toBeUndefined();
    });

    it('should detect anomalies after baseline established', () => {
      // Establish baseline
      const healthyMetrics = createHealthyMetrics();
      detector.updateBaseline(healthyMetrics);

      // Check unhealthy metrics
      const unhealthyMetrics = createUnhealthyMetrics();
      const result = detector.detect(unhealthyMetrics, CircuitState.CLOSED);

      const anomalyIssue = result.issues.find((i) => i.type === 'anomaly_detected');
      expect(anomalyIssue).toBeDefined();
    });
  });

  describe('Trend Analysis', () => {
    it('should detect increasing error rate trend', () => {
      const metrics: CircuitMetrics[] = [
        { ...createHealthyMetrics(), errorRate: 5 },
        { ...createHealthyMetrics(), errorRate: 10 },
        { ...createHealthyMetrics(), errorRate: 15 },
        { ...createHealthyMetrics(), errorRate: 20 },
        { ...createHealthyMetrics(), errorRate: 25 },
      ];

      metrics.forEach((m) => detector.detect(m, CircuitState.CLOSED));

      const result = detector.detect(metrics[4], CircuitState.CLOSED);
      const trendIssue = result.issues.find((i) => i.type === 'error_rate_trend');

      expect(trendIssue).toBeDefined();
    });

    it('should detect increasing latency trend', () => {
      const metrics: CircuitMetrics[] = [
        { ...createHealthyMetrics(), averageDuration: 100 },
        { ...createHealthyMetrics(), averageDuration: 200 },
        { ...createHealthyMetrics(), averageDuration: 400 },
        { ...createHealthyMetrics(), averageDuration: 800 },
        { ...createHealthyMetrics(), averageDuration: 1600 },
      ];

      metrics.forEach((m) => detector.detect(m, CircuitState.CLOSED));

      const result = detector.detect(metrics[4], CircuitState.CLOSED);
      const trendIssue = result.issues.find((i) => i.type === 'latency_trend');

      expect(trendIssue).toBeDefined();
    });
  });

  describe('Predictive Failure Detection', () => {
    it('should predict failure probability', () => {
      const unhealthyMetrics = createUnhealthyMetrics();

      // Feed multiple data points for trend analysis
      for (let i = 0; i < 10; i++) {
        const metrics = {
          ...unhealthyMetrics,
          errorRate: 50 + i * 5,
          averageDuration: 1000 + i * 500,
        };
        detector.detect(metrics, CircuitState.CLOSED);
      }

      const result = detector.detect(unhealthyMetrics, CircuitState.CLOSED);

      expect(result.failureProbability).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should estimate time until failure', () => {
      const unhealthyMetrics = createUnhealthyMetrics();

      // Feed deteriorating metrics
      for (let i = 0; i < 10; i++) {
        const metrics = {
          ...unhealthyMetrics,
          errorRate: 40 + i * 5,
        };
        detector.detect(metrics, CircuitState.CLOSED);
      }

      const result = detector.detect(unhealthyMetrics, CircuitState.CLOSED);

      if (result.failureProbability > 0.5) {
        expect(result.timeUntilFailure).toBeLessThan(Infinity);
      }
    });
  });

  describe('Confidence Calculation', () => {
    it('should calculate higher confidence with more issues', () => {
      const metrics = createUnhealthyMetrics();
      const result = detector.detect(metrics, CircuitState.CLOSED);

      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should calculate higher confidence with higher severity issues', () => {
      const metrics = {
        ...createUnhealthyMetrics(),
        errorRate: 90,
        slowCallRate: 80,
      };

      const result = detector.detect(metrics, CircuitState.CLOSED);

      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Recommendations', () => {
    it('should provide recommendations for detected issues', () => {
      const metrics = createUnhealthyMetrics();
      const result = detector.detect(metrics, CircuitState.CLOSED);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations).toContainEqual(
        expect.stringContaining('open circuit')
      );
    });

    it('should provide no-action recommendation when healthy', () => {
      const metrics = createHealthyMetrics();
      const result = detector.detect(metrics, CircuitState.CLOSED);

      expect(result.recommendations).toContain('No action required');
    });
  });

  describe('Baseline Management', () => {
    it('should update baseline only for healthy metrics', () => {
      const healthyMetrics = createHealthyMetrics();
      const unhealthyMetrics = createUnhealthyMetrics();

      detector.updateBaseline(unhealthyMetrics);
      detector.updateBaseline(healthyMetrics);

      // Baseline should be updated with healthy metrics
      const result = detector.detect(unhealthyMetrics, CircuitState.CLOSED);
      const anomalyIssue = result.issues.find((i) => i.type === 'anomaly_detected');

      expect(anomalyIssue).toBeDefined();
    });
  });

  describe('Reset', () => {
    it('should reset detector state', () => {
      const metrics = createUnhealthyMetrics();
      detector.detect(metrics, CircuitState.CLOSED);

      detector.reset();

      // Should not have baseline after reset
      const result = detector.detect(createUnhealthyMetrics(), CircuitState.CLOSED);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Adaptive Thresholds', () => {
    it('should get and update adaptive thresholds', () => {
      const initialThreshold = detector.getAdaptiveThreshold('error_rate');
      expect(initialThreshold).toBe(0);

      detector.updateAdaptiveThreshold('error_rate', 50);

      const updatedThreshold = detector.getAdaptiveThreshold('error_rate');
      expect(updatedThreshold).toBeGreaterThan(0);
    });

    it('should apply learning rate to threshold updates', () => {
      detector.updateAdaptiveThreshold('test_threshold', 100);
      detector.updateAdaptiveThreshold('test_threshold', 200);

      const threshold = detector.getAdaptiveThreshold('test_threshold');

      // Should be between 100 and 200 due to learning rate
      expect(threshold).toBeGreaterThan(100);
      expect(threshold).toBeLessThan(200);
    });
  });

  describe('Last Prediction', () => {
    it('should store last prediction', () => {
      const metrics = createUnhealthyMetrics();

      // Feed enough data for prediction
      for (let i = 0; i < 10; i++) {
        detector.detect(metrics, CircuitState.CLOSED);
      }

      const prediction = detector.getLastPrediction();

      expect(prediction).toBeDefined();
      expect(prediction?.failureProbability).toBeGreaterThanOrEqual(0);
      expect(prediction?.confidence).toBeGreaterThanOrEqual(0);
    });
  });
});
