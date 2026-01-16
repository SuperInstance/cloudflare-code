/**
 * Latency monitoring system
 * Actively measures latency between regions using various methods
 */

import type {
  Region,
  LatencyMeasurement,
  LatencyMetrics,
} from '../types/index.js';

export interface MonitoringConfig {
  enabled: boolean;
  measurementInterval: number; // milliseconds
  timeout: number; // milliseconds
  sampleSize: number;
  endpoints: Map<Region, string[]>;
  useSyntheticRequests: boolean;
  usePassiveMeasurement: boolean;
}

export interface ProbeResult {
  region: Region;
  timestamp: number;
  latency: number;
  success: boolean;
  error?: string;
}

/**
 * Latency monitor for active and passive measurement
 */
export class LatencyMonitor {
  private config: MonitoringConfig;
  private measurements: Map<Region, LatencyMeasurement[]>;
  private isMonitoring: boolean = false;
  private monitoringInterval?: ReturnType<typeof setInterval>;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      enabled: true,
      measurementInterval: 30000, // 30 seconds
      timeout: 5000, // 5 seconds
      sampleSize: 10,
      endpoints: new Map(),
      useSyntheticRequests: true,
      usePassiveMeasurement: true,
      ...config,
    };

    this.measurements = new Map();
  }

  /**
   * Start active monitoring
   */
  start(sourceRegion: Region, targetRegions: Region[]): void {
    if (this.isMonitoring || !this.config.enabled) {
      return;
    }

    this.isMonitoring = true;

    this.monitoringInterval = setInterval(async () => {
      await this.performMeasurements(sourceRegion, targetRegions);
    }, this.config.measurementInterval);

    // Perform initial measurement
    this.performMeasurements(sourceRegion, targetRegions);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
  }

  /**
   * Perform measurements to all target regions
   */
  private async performMeasurements(
    sourceRegion: Region,
    targetRegions: Region[]
  ): Promise<void> {
    const promises = targetRegions.map(region =>
      this.measureRegion(sourceRegion, region)
    );

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        this.recordMeasurement(result.value);
      }
    }
  }

  /**
   * Measure latency to a specific region
   */
  async measureRegion(
    sourceRegion: Region,
    targetRegion: Region
  ): Promise<LatencyMeasurement | null> {
    const endpoints = this.config.endpoints.get(targetRegion) || [];
    if (endpoints.length === 0) {
      return null;
    }

    const measurements: ProbeResult[] = [];

    for (const endpoint of endpoints) {
      const result = await this.probeEndpoint(targetRegion, endpoint);
      if (result.success) {
        measurements.push(result);
      }

      // Stop if we have enough samples
      if (measurements.length >= this.config.sampleSize) {
        break;
      }
    }

    if (measurements.length === 0) {
      return null;
    }

    // Calculate average latency
    const avgLatency = measurements.reduce((sum, m) => sum + m.latency, 0) / measurements.length;

    return {
      sourceRegion,
      targetRegion,
      latency: Math.round(avgLatency),
      timestamp: Date.now(),
      measurementMethod: 'active',
    };
  }

  /**
   * Probe a specific endpoint
   */
  private async probeEndpoint(
    region: Region,
    endpoint: string
  ): Promise<ProbeResult> {
    const startTime = performance.now();

    try {
      // In a real implementation, this would make an actual HTTP request
      // For now, we'll simulate the measurement
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      // Simulate network request
      await this.simulateRequest(endpoint);

      clearTimeout(timeoutId);
      const latency = performance.now() - startTime;

      return {
        region,
        timestamp: Date.now(),
        latency: Math.round(latency),
        success: true,
      };
    } catch (error) {
      return {
        region,
        timestamp: Date.now(),
        latency: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Simulate a request (placeholder for actual implementation)
   */
  private async simulateRequest(endpoint: string): Promise<void> {
    // In production, this would be:
    // const response = await fetch(endpoint, {
    //   method: 'HEAD',
    //   signal: controller.signal,
    // });

    // For now, simulate network delay
    const delay = Math.random() * 100 + 50; // 50-150ms
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Record a measurement
   */
  recordMeasurement(measurement: LatencyMeasurement): void {
    const { targetRegion } = measurement;
    const history = this.measurements.get(targetRegion) || [];

    history.push(measurement);

    // Keep only recent measurements (last 1000)
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }

    this.measurements.set(targetRegion, history);
  }

  /**
   * Get latency metrics for a region
   */
  getMetrics(region: Region): LatencyMetrics | null {
    const history = this.measurements.get(region);
    if (!history || history.length === 0) {
      return null;
    }

    const latencies = history
      .map(m => m.latency)
      .sort((a, b) => a - b);

    const n = latencies.length;

    return {
      region,
      timestamp: Date.now(),
      p50: latencies[Math.floor(n * 0.5)],
      p75: latencies[Math.floor(n * 0.75)],
      p90: latencies[Math.floor(n * 0.9)],
      p95: latencies[Math.floor(n * 0.95)],
      p99: latencies[Math.floor(n * 0.99)],
      p999: latencies[Math.floor(n * 0.999)],
      mean: latencies.reduce((sum, val) => sum + val, 0) / n,
      stdDev: this.calculateStdDev(latencies),
      sampleCount: n,
    };
  }

  /**
   * Get recent measurements for a region
   */
  getRecentMeasurements(
    region: Region,
    count: number = 100
  ): LatencyMeasurement[] {
    const history = this.measurements.get(region) || [];
    return history.slice(-count);
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Update endpoints for a region
   */
  setEndpoints(region: Region, endpoints: string[]): void {
    this.config.endpoints.set(region, endpoints);
  }

  /**
   * Get monitoring statistics
   */
  getStats(): {
    isMonitoring: boolean;
    totalMeasurements: number;
    measurementsByRegion: Map<Region, number>;
  } {
    const measurementsByRegion = new Map<Region, number>();

    for (const [region, history] of this.measurements) {
      measurementsByRegion.set(region, history.length);
    }

    return {
      isMonitoring: this.isMonitoring,
      totalMeasurements: Array.from(this.measurements.values()).reduce((sum, h) => sum + h.length, 0),
      measurementsByRegion,
    };
  }

  /**
   * Clear all measurements
   */
  clearMeasurements(): void {
    this.measurements.clear();
  }

  /**
   * Clear measurements for a specific region
   */
  clearRegionMeasurements(region: Region): void {
    this.measurements.delete(region);
  }
}
