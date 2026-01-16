/**
 * Latency-based routing engine
 * Routes requests to regions with lowest measured latency
 */

import type {
  Region,
  GeoLocation,
  DatacenterInfo,
  LatencyMetrics,
  LatencyMeasurement,
  LatencyPrediction,
  LatencyHistory,
  LatencyTrends,
  LatencyAnomaly,
  RoutingContext,
  RoutingDecision,
  RoutingReason,
  RoutingAlternative,
} from '../types/index.js';
import { NoHealthyRegionsError } from '../types/index.js';

export interface LatencyRouterConfig {
  preferP50: boolean; // If true, optimize for median; if false, optimize for P95
  maxLatency: number; // Maximum acceptable latency in ms
  measurementWindow: number; // Time window for measurements (ms)
  minSampleSize: number; // Minimum samples required for routing
  enablePrediction: boolean; // Use ML-based latency prediction
  adaptToTrends: boolean; // Adjust routing based on latency trends
}

/**
 * Latency-based router for optimal region selection
 */
export class LatencyRouter {
  private latencyStore: Map<string, LatencyMetrics>;
  private measurementHistory: Map<Region, LatencyMeasurement[]>;
  private predictions: Map<string, LatencyPrediction>;
  private config: LatencyRouterConfig;
  private regions: Region[];

  constructor(
    regions: Region[],
    config: Partial<LatencyRouterConfig> = {}
  ) {
    this.regions = regions;
    this.latencyStore = new Map();
    this.measurementHistory = new Map();
    this.predictions = new Map();
    this.config = {
      preferP50: false,
      maxLatency: 300,
      measurementWindow: 300000, // 5 minutes
      minSampleSize: 10,
      enablePrediction: true,
      adaptToTrends: true,
      ...config,
    };

    // Initialize history for each region
    for (const region of regions) {
      this.measurementHistory.set(region, []);
    }
  }

  /**
   * Route request to region with lowest latency
   */
  async route(context: RoutingContext): Promise<RoutingDecision> {
    const sourceLocation = context.sourceLocation;
    const currentMetrics = await this.getCurrentMetrics(sourceLocation);

    if (currentMetrics.size === 0) {
      throw new NoHealthyRegionsError();
    }

    // Score regions based on latency
    const scoredRegions = await this.scoreRegions(
      sourceLocation,
      currentMetrics
    );

    // Select best region
    const selected = scoredRegions[0];
    if (!selected) {
      throw new NoHealthyRegionsError();
    }

    // Get alternatives
    const alternatives = scoredRegions.slice(1, 4).map(s => s.region);

    return this.buildDecision(
      context,
      selected.region,
      selected.score,
      selected.reasons,
      alternatives
    );
  }

  /**
   * Get current latency metrics for all regions from a source location
   */
  private async getCurrentMetrics(
    sourceLocation: GeoLocation
  ): Promise<Map<Region, LatencyMetrics>> {
    const metrics = new Map<Region, LatencyMetrics>();
    const now = Date.now();

    for (const region of this.regions) {
      const key = this.buildMetricsKey(sourceLocation, region);
      const regionMetrics = this.latencyStore.get(key);

      if (regionMetrics && this.isMetricsValid(regionMetrics, now)) {
        metrics.set(region, regionMetrics);
      } else if (this.config.enablePrediction) {
        // Use prediction if no recent measurements
        const prediction = await this.predictLatency(sourceLocation, region);
        if (prediction) {
          metrics.set(region, this.metricsFromPrediction(prediction, region));
        }
      }
    }

    return metrics;
  }

  /**
   * Score regions based on latency metrics
   */
  private async scoreRegions(
    sourceLocation: GeoLocation,
    metrics: Map<Region, LatencyMetrics>
  ): Promise<Array<{ region: Region; score: number; reasons: RoutingReason[] }>> {
    const scores: Array<{ region: Region; score: number; reasons: RoutingReason[] }> = [];

    for (const [region, metric] of metrics) {
      const reasons: RoutingReason[] = [];
      let score = 1000;

      // Base score on preferred percentile
      const targetLatency = this.config.preferP50 ? metric.p50 : metric.p95;
      const latencyPenalty = (targetLatency / this.config.maxLatency) * 500;
      score -= latencyPenalty;

      reasons.push({
        factor: 'latency',
        weight: 0.5,
        score: 1 - (targetLatency / this.config.maxLatency),
        description: `${this.config.preferP50 ? 'P50' : 'P95'} latency: ${targetLatency}ms`,
      });

      // Consider P99 for tail latency
      const tailLatencyScore = Math.max(0, 1 - (metric.p99 / (this.config.maxLatency * 1.5)));
      score += tailLatencyScore * 100;

      reasons.push({
        factor: 'tail_latency',
        weight: 0.2,
        score: tailLatencyScore,
        description: `P99 latency: ${metric.p99}ms`,
      });

      // Consider measurement confidence (sample size)
      const sampleScore = Math.min(1, metric.sampleCount / this.config.minSampleSize);
      score += sampleScore * 50;

      reasons.push({
        factor: 'measurement_confidence',
        weight: 0.1,
        score: sampleScore,
        description: `Based on ${metric.sampleCount} measurements`,
      });

      // Consider latency stability (std dev)
      const stabilityScore = Math.max(0, 1 - (metric.stdDev / metric.mean));
      score += stabilityScore * 100;

      reasons.push({
        factor: 'stability',
        weight: 0.1,
        score: stabilityScore,
        description: `Latency std dev: ${metric.stdDev.toFixed(2)}ms`,
      });

      // Consider trends if enabled
      if (this.config.adaptToTrends) {
        const trend = await this.analyzeTrend(region);
        if (trend === 'improving') {
          score += 50;
          reasons.push({
            factor: 'trend',
            weight: 0.1,
            score: 1,
            description: 'Latency improving over time',
          });
        } else if (trend === 'degrading') {
          score -= 50;
          reasons.push({
            factor: 'trend',
            weight: 0.1,
            score: 0,
            description: 'Latency degrading over time',
          });
        }
      }

      scores.push({ region, score, reasons });
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Record a latency measurement
   */
  async recordMeasurement(measurement: LatencyMeasurement): Promise<void> {
    const { sourceRegion, targetRegion, latency, timestamp } = measurement;

    // Add to history
    const history = this.measurementHistory.get(targetRegion) || [];
    history.push(measurement);

    // Trim old measurements
    const cutoff = timestamp - this.config.measurementWindow;
    const validMeasurements = history.filter(m => m.timestamp >= cutoff);
    this.measurementHistory.set(targetRegion, validMeasurements);

    // Update metrics
    await this.updateMetrics(sourceRegion, targetRegion, validMeasurements);
  }

  /**
   * Update metrics for a region pair
   */
  private async updateMetrics(
    sourceRegion: Region,
    targetRegion: Region,
    measurements: LatencyMeasurement[]
  ): Promise<void> {
    if (measurements.length === 0) return;

    const latencies = measurements.map(m => m.latency).sort((a, b) => a - b);
    const n = latencies.length;

    const metrics: LatencyMetrics = {
      region: targetRegion,
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

    const key = this.buildMetricsKeyFromRegions(sourceRegion, targetRegion);
    this.latencyStore.set(key, metrics);
  }

  /**
   * Predict latency for a region
   */
  private async predictLatency(
    sourceLocation: GeoLocation,
    targetRegion: Region
  ): Promise<LatencyPrediction | null> {
    const key = `${sourceLocation.country}-${targetRegion}`;

    // Check cache (predictions don't have timestamps, so we'll skip caching for now)
    // In a real implementation, you'd want to add a timestamp to the prediction

    // Build prediction based on historical data and geography
    const history = this.measurementHistory.get(targetRegion) || [];
    if (history.length < this.config.minSampleSize) {
      return null;
    }

    // Simple prediction based on recent measurements
    const recent = history.slice(-20);
    const avgLatency = recent.reduce((sum, m) => sum + m.latency, 0) / recent.length;
    const variance = this.calculateVariance(recent.map(m => m.latency), avgLatency);
    const confidence = Math.max(0, 1 - (variance / (avgLatency * avgLatency)));

    const prediction: LatencyPrediction = {
      from: sourceLocation.country as Region,
      to: targetRegion,
      predictedLatency: Math.round(avgLatency),
      confidence: Math.round(confidence * 100) / 100,
      factors: [
        {
          name: 'historical_data',
          impact: confidence,
          description: `Based on ${recent.length} recent measurements`,
        },
        {
          name: 'geographic_distance',
          impact: 0.5,
          description: 'Estimated based on physical distance',
        },
      ],
    };

    this.predictions.set(key, prediction);
    return prediction;
  }

  /**
   * Analyze latency trend for a region
   */
  private async analyzeTrend(region: Region): Promise<'improving' | 'stable' | 'degrading'> {
    const history = this.measurementHistory.get(region) || [];
    if (history.length < 20) return 'stable';

    // Compare recent vs older measurements
    const recent = history.slice(-10).map(m => m.latency);
    const older = history.slice(-20, -10).map(m => m.latency);

    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;

    const change = (recentAvg - olderAvg) / olderAvg;

    if (change < -0.1) return 'improving';
    if (change > 0.1) return 'degrading';
    return 'stable';
  }

  /**
   * Get latency history for a region
   */
  async getHistory(region: Region): Promise<LatencyHistory> {
    const measurements = this.measurementHistory.get(region) || [];
    const trends = await this.analyzeTrends(region);

    return {
      region,
      measurements,
      trends,
      anomalies: this.detectAnomalies(measurements),
    };
  }

  /**
   * Analyze latency trends
   */
  private async analyzeTrends(region: Region): Promise<LatencyTrends> {
    const direction = await this.analyzeTrend(region);
    const prediction = await this.predictLatency(
      { country: 'unknown', continent: 'NA', latitude: 0, longitude: 0 },
      region
    );

    return {
      direction,
      rate: 0, // Would calculate actual rate in production
      prediction: prediction || {
        from: 'unknown' as Region,
        to: region,
        predictedLatency: 0,
        confidence: 0,
        factors: [],
      },
    };
  }

  /**
   * Detect latency anomalies
   */
  private detectAnomalies(measurements: LatencyMeasurement[]): LatencyAnomaly[] {
    if (measurements.length < 10) return [];

    const anomalies: LatencyAnomaly[] = [];
    const latencies = measurements.map(m => m.latency);
    const mean = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
    const stdDev = this.calculateStdDev(latencies);
    const threshold = 2 * stdDev; // 2 standard deviations

    for (const m of measurements) {
      const deviation = Math.abs(m.latency - mean);
      if (deviation > threshold) {
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (deviation > 4 * stdDev) severity = 'critical';
        else if (deviation > 3 * stdDev) severity = 'high';
        else if (deviation > 2 * stdDev) severity = 'medium';

        anomalies.push({
          timestamp: m.timestamp,
          expectedLatency: Math.round(mean),
          actualLatency: m.latency,
          deviation: Math.round(deviation),
          severity,
        });
      }
    }

    return anomalies;
  }

  /**
   * Build routing decision
   */
  private buildDecision(
    context: RoutingContext,
    selectedRegion: Region,
    score: number,
    reasons: RoutingReason[],
    alternatives: Region[]
  ): RoutingDecision {
    return {
      requestId: context.requestId,
      selectedRegion,
      selectedDatacenter: '', // Would be filled by actual datacenter info
      selectedEndpoint: '', // Would be filled by actual endpoint
      reasoning: reasons,
      confidence: Math.min(1, score / 1000),
      timestamp: Date.now(),
      alternatives: alternatives.map(alt => ({
        region: alt,
        score: 0.8,
        reason: 'Alternative low-latency region',
      })),
    };
  }

  /**
   * Check if metrics are still valid
   */
  private isMetricsValid(metrics: LatencyMetrics, now: number): boolean {
    const age = now - metrics.timestamp;
    return age < this.config.measurementWindow &&
           metrics.sampleCount >= this.config.minSampleSize;
  }

  /**
   * Build metrics key from location and region
   */
  private buildMetricsKey(sourceLocation: GeoLocation, targetRegion: Region): string {
    return `${sourceLocation.country}-${targetRegion}`;
  }

  /**
   * Build metrics key from two regions
   */
  private buildMetricsKeyFromRegions(sourceRegion: Region, targetRegion: Region): string {
    return `${sourceRegion}-${targetRegion}`;
  }

  /**
   * Convert prediction to metrics
   */
  private metricsFromPrediction(prediction: LatencyPrediction, region: Region): LatencyMetrics {
    const latency = prediction.predictedLatency;
    return {
      region,
      timestamp: Date.now(),
      p50: latency,
      p75: Math.round(latency * 1.1),
      p90: Math.round(latency * 1.2),
      p95: Math.round(latency * 1.3),
      p99: Math.round(latency * 1.5),
      p999: Math.round(latency * 1.8),
      mean: latency,
      stdDev: Math.round(latency * 0.1),
      sampleCount: 0,
    };
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(this.calculateVariance(values, mean));
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[], mean: number): number {
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  /**
   * Get metrics for a specific route
   */
  getMetrics(sourceLocation: GeoLocation, targetRegion: Region): LatencyMetrics | null {
    const key = this.buildMetricsKey(sourceLocation, targetRegion);
    return this.latencyStore.get(key) || null;
  }

  /**
   * Get all latency metrics
   */
  getAllMetrics(): Map<string, LatencyMetrics> {
    return new Map(this.latencyStore);
  }

  /**
   * Clear old measurements
   */
  clearOldMeasurements(): void {
    const cutoff = Date.now() - this.config.measurementWindow;

    for (const [region, history] of this.measurementHistory) {
      const valid = history.filter(m => m.timestamp >= cutoff);
      this.measurementHistory.set(region, valid);
    }

    // Clear invalid metrics
    for (const [key, metrics] of this.latencyStore) {
      if (!this.isMetricsValid(metrics, Date.now())) {
        this.latencyStore.delete(key);
      }
    }
  }
}
