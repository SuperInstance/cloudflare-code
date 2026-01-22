import { WindowDataPoint, CircuitMetrics } from '../types/index.js';

/**
 * Sliding window implementation for metrics collection
 * Uses circular buffer for O(1) operations
 */
export class SlidingWindow {
  private window: WindowDataPoint[];
  private size: number;
  private position: number;
  private count: number;
  private totalDuration: number;
  private successCount: number;
  private failureCount: number;
  private slowCallCount: number;
  private durations: number[];

  constructor(size: number) {
    this.size = size;
    this.window = new Array(size);
    this.position = 0;
    this.count = 0;
    this.totalDuration = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.slowCallCount = 0;
    this.durations = [];
  }

  /**
   * Add a data point to the window
   */
  add(dataPoint: WindowDataPoint): void {
    // If window is full, subtract old values
    if (this.count >= this.size) {
      const oldPoint = this.window[this.position];
      if (oldPoint) {
        this.totalDuration -= oldPoint.duration;
        if (oldPoint.success) {
          this.successCount--;
        } else {
          this.failureCount--;
        }
        if (oldPoint.duration > 1000) {
          this.slowCallCount--;
        }
        // Remove from durations array
        const index = this.durations.indexOf(oldPoint.duration);
        if (index > -1) {
          this.durations.splice(index, 1);
        }
      }
    }

    // Add new point
    this.window[this.position] = dataPoint;
    this.totalDuration += dataPoint.duration;
    if (dataPoint.success) {
      this.successCount++;
    } else {
      this.failureCount++;
    }
    if (dataPoint.duration > 1000) {
      this.slowCallCount++;
    }
    this.durations.push(dataPoint.duration);

    // Move position and increment count
    this.position = (this.position + 1) % this.size;
    this.count = Math.min(this.count + 1, this.size);
  }

  /**
   * Get current metrics from the window
   */
  getMetrics(_slowCallThreshold: number = 1000): CircuitMetrics {
    const totalRequests = this.count;
    const successfulRequests = this.successCount;
    const failedRequests = this.failureCount;
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
    const averageDuration = totalRequests > 0 ? this.totalDuration / totalRequests : 0;

    // Calculate percentiles
    const sortedDurations = [...this.durations].sort((a, b) => a - b);
    const p50 = this.getPercentile(sortedDurations, 50);
    const p95 = this.getPercentile(sortedDurations, 95);
    const p99 = this.getPercentile(sortedDurations, 99);

    const slowCallRate = totalRequests > 0 ? (this.slowCallCount / totalRequests) * 100 : 0;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      rejectedRequests: 0, // Tracked separately
      timeoutRequests: 0, // Tracked separately
      errorRate,
      averageDuration,
      p50Duration: p50,
      p95Duration: p95,
      p99Duration: p99,
      slowCallRate,
      lastStateChange: 0, // Tracked by engine
      timeInCurrentState: 0, // Tracked by engine
      state: 'CLOSED' as any, // Tracked by engine
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Clear the window
   */
  clear(): void {
    this.window = new Array(this.size);
    this.position = 0;
    this.count = 0;
    this.totalDuration = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.slowCallCount = 0;
    this.durations = [];
  }

  /**
   * Get current count
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Check if window is full
   */
  isFull(): boolean {
    return this.count >= this.size;
  }

  /**
   * Get raw window data
   */
  getData(): WindowDataPoint[] {
    if (this.count < this.size) {
      return this.window.slice(0, this.count);
    }
    return [...this.window.slice(this.position), ...this.window.slice(0, this.position)];
  }

  /**
   * Get error rate for specific time window
   */
  getErrorRateInWindow(windowMs: number): number {
    const now = Date.now();
    const recentPoints = this.getData().filter((p) => now - p.timestamp <= windowMs);

    if (recentPoints.length === 0) return 0;

    const failures = recentPoints.filter((p) => !p.success).length;
    return (failures / recentPoints.length) * 100;
  }

  /**
   * Get average duration for specific time window
   */
  getAverageDurationInWindow(windowMs: number): number {
    const now = Date.now();
    const recentPoints = this.getData().filter((p) => now - p.timestamp <= windowMs);

    if (recentPoints.length === 0) return 0;

    const totalDuration = recentPoints.reduce((sum, p) => sum + p.duration, 0);
    return totalDuration / recentPoints.length;
  }
}
