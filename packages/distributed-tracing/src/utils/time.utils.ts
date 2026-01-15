/**
 * Time utilities for distributed tracing
 * Handles timestamp conversions, durations, and time-based operations
 */

import { Timestamp, Duration } from '../types/trace.types';

/**
 * Get current timestamp in microseconds
 */
export function getCurrentTimestamp(): Timestamp {
  return Date.now() * 1000;
}

/**
 * Convert milliseconds to microseconds
 */
export function msToUs(ms: number): Duration {
  return ms * 1000;
}

/**
 * Convert microseconds to milliseconds
 */
export function usToMs(us: Duration): number {
  return us / 1000;
}

/**
 * Convert seconds to microseconds
 */
export function sToUs(s: number): Duration {
  return s * 1000000;
}

/**
 * Convert microseconds to seconds
 */
export function usToS(us: Duration): number {
  return us / 1000000;
}

/**
 * Convert nanoseconds to microseconds
 */
export function nsToUs(ns: number): Duration {
  return ns / 1000;
}

/**
 * Convert microseconds to nanoseconds
 */
export function usToNs(us: Duration): number {
  return us * 1000;
}

/**
 * Convert Date to timestamp
 */
export function dateToTimestamp(date: Date): Timestamp {
  return date.getTime() * 1000;
}

/**
 * Convert timestamp to Date
 */
export function timestampToDate(timestamp: Timestamp): Date {
  return new Date(timestamp / 1000);
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(us: Duration, precision = 2): string {
  if (us < 1000) {
    return `${us.toFixed(precision)}μs`;
  } else if (us < 1000000) {
    return `${(us / 1000).toFixed(precision)}ms`;
  } else if (us < 60000000) {
    return `${(us / 1000000).toFixed(precision)}s`;
  } else {
    const minutes = Math.floor(us / 60000000);
    const seconds = (us % 60000000) / 1000000;
    return `${minutes}m ${seconds.toFixed(0)}s`;
  }
}

/**
 * Format timestamp in ISO format
 */
export function formatTimestamp(timestamp: Timestamp): string {
  return new Date(timestamp / 1000).toISOString();
}

/**
 * Calculate duration between two timestamps
 */
export function calculateDuration(start: Timestamp, end: Timestamp): Duration {
  return end - start;
}

/**
 * Calculate overlap between two time ranges
 */
export function calculateOverlap(
  start1: Timestamp,
  end1: Timestamp,
  start2: Timestamp,
  end2: Timestamp
): Duration {
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  return Math.max(0, overlapEnd - overlapStart);
}

/**
 * Check if two time ranges overlap
 */
export function hasOverlap(
  start1: Timestamp,
  end1: Timestamp,
  start2: Timestamp,
  end2: Timestamp
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Calculate percentile from array of durations
 */
export function calculatePercentile(values: Duration[], percentile: number): Duration {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

/**
 * Calculate average duration
 */
export function calculateAverage(values: Duration[]): Duration {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate median duration
 */
export function calculateMedian(values: Duration[]): Duration {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculate standard deviation
 */
export function calculateStandardDeviation(values: Duration[]): number {
  if (values.length === 0) {
    return 0;
  }

  const avg = calculateAverage(values);
  const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
  const avgSquareDiff = calculateAverage(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate duration statistics
 */
export interface DurationStatistics {
  count: number;
  min: Duration;
  max: Duration;
  avg: Duration;
  median: Duration;
  stdDev: number;
  p50: Duration;
  p75: Duration;
  p90: Duration;
  p95: Duration;
  p99: Duration;
  p999: Duration;
}

export function calculateDurationStatistics(values: Duration[]): DurationStatistics {
  if (values.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      avg: 0,
      median: 0,
      stdDev: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      p999: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);

  return {
    count: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: calculateAverage(values),
    median: calculateMedian(values),
    stdDev: calculateStandardDeviation(values),
    p50: calculatePercentile(values, 50),
    p75: calculatePercentile(values, 75),
    p90: calculatePercentile(values, 90),
    p95: calculatePercentile(values, 95),
    p99: calculatePercentile(values, 99),
    p999: calculatePercentile(values, 99.9),
  };
}

/**
 * Calculate time buckets for histogram
 */
export interface TimeBucket {
  min: Duration;
  max: Duration;
  count: number;
}

export function calculateTimeBuckets(values: Duration[], bucketCount: number): TimeBucket[] {
  if (values.length === 0) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const bucketSize = (max - min) / bucketCount;

  const buckets: TimeBucket[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const bucketMin = min + i * bucketSize;
    const bucketMax = i === bucketCount - 1 ? max : bucketMin + bucketSize;

    const count = values.filter((v) => v >= bucketMin && (i === bucketCount - 1 ? v <= bucketMax : v < bucketMax))
      .length;

    buckets.push({
      min: bucketMin,
      max: bucketMax,
      count,
    });
  }

  return buckets;
}

/**
 * Detect outliers using IQR method
 */
export function detectOutliers(values: Duration[]): Duration[] {
  if (values.length < 4) {
    return [];
  }

  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);

  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return values.filter((v) => v < lowerBound || v > upperBound);
}

/**
 * Round timestamp to nearest precision
 */
export function roundTimestamp(timestamp: Timestamp, precision: number): Timestamp {
  return Math.round(timestamp / precision) * precision;
}

/**
 * Truncate timestamp to precision
 */
export function truncateTimestamp(timestamp: Timestamp, precision: number): Timestamp {
  return Math.floor(timestamp / precision) * precision;
}
