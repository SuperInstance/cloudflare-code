/**
 * Utility functions for load balancing calculations
 */

import type { GeoLocation, Region } from '../types/index.js';
import { REGION_COORDINATES } from '../geographic/router.js';

/**
 * Calculate distance between two geographic points using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimate network latency based on distance
 */
export function estimateLatency(distanceKm: number): number {
  // Base latency: 2ms per 100km + 10ms fixed overhead
  // This accounts for speed of light in fiber + processing overhead
  const speedOfLightLatency = (distanceKm / 100000) * 1000 / 0.66; // ~66% speed of light in fiber
  const processingOverhead = 10; // 10ms base overhead
  const routerHops = Math.floor(distanceKm / 1000) * 2; // ~2ms per router hop per 1000km

  return Math.round(speedOfLightLatency + processingOverhead + routerHops);
}

/**
 * Calculate percentile from sorted array of values
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;

  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(
  values: number[],
  window: number
): number[] {
  if (values.length === 0) return [];

  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const windowValues = values.slice(start, i + 1);
    const avg = windowValues.reduce((sum, val) => sum + val, 0) / windowValues.length;
    result.push(avg);
  }

  return result;
}

/**
 * Calculate exponential moving average
 */
export function calculateEMA(values: number[], alpha: number): number[] {
  if (values.length === 0) return [];

  const result: number[] = [values[0]];

  for (let i = 1; i < values.length; i++) {
    const ema = alpha * values[i] + (1 - alpha) * result[i - 1];
    result.push(ema);
  }

  return result;
}

/**
 * Calculate standard deviation
 */
export function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Calculate variance
 */
export function calculateVariance(values: number[], mean?: number): number {
  if (values.length === 0) return 0;

  const avg = mean ?? values.reduce((sum, val) => sum + val, 0) / values.length;
  return values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
}

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Calculate bearing between two points
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = toRadians(lon2 - lon1);

  const y = Math.sin(dLon) * Math.cos(toRadians(lat2));
  const x =
    Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(dLon);

  const bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * Calculate midpoint between two geographic points
 */
export function calculateMidpoint(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): { latitude: number; longitude: number } {
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const lon1Rad = toRadians(lon1);
  const lon2Rad = toRadians(lon2);

  const dLon = lon2Rad - lon1Rad;

  const bx = Math.cos(lat2Rad) * Math.cos(dLon);
  const by = Math.cos(lat2Rad) * Math.sin(dLon);

  const lat3 = Math.atan2(
    Math.sin(lat1Rad) + Math.sin(lat2Rad),
    Math.sqrt((Math.cos(lat1Rad) + bx) ** 2 + by ** 2)
  );

  const lon3 = lon1Rad + Math.atan2(by, Math.cos(lat1Rad) + bx);

  return {
    latitude: toDegrees(lat3),
    longitude: toDegrees(lon3),
  };
}

/**
 * Find nearest region to a location
 */
export function findNearestRegion(location: GeoLocation, regions: Region[]): Region | null {
  if (regions.length === 0) return null;

  let nearest: Region | null = null;
  let minDistance = Infinity;

  for (const region of regions) {
    const coords = REGION_COORDINATES[region];
    if (!coords) continue;

    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      coords.lat,
      coords.lon
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearest = region;
    }
  }

  return nearest;
}

/**
 * Calculate availability score
 */
export function calculateAvailabilityScore(
  uptime: number,
  downtime: number
): number {
  const total = uptime + downtime;
  if (total === 0) return 100;

  return (uptime / total) * 100;
}

/**
 * Calculate error rate
 */
export function calculateErrorRate(
  successCount: number,
  errorCount: number
): number {
  const total = successCount + errorCount;
  if (total === 0) return 0;

  return errorCount / total;
}

/**
 * Calculate throughput
 */
export function calculateThroughput(
  requestCount: number,
  timeWindowMs: number
): number {
  if (timeWindowMs === 0) return 0;

  return (requestCount / timeWindowMs) * 1000; // requests per second
}

/**
 * Smooth data using simple moving average
 */
export function smoothData(data: number[], windowSize: number): number[] {
  if (data.length < windowSize) return [...data];

  const smoothed: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
    const window = data.slice(start, end);
    const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
    smoothed.push(avg);
  }

  return smoothed;
}

/**
 * Detect outliers using IQR method
 */
export function detectOutliers(values: number[]): {
  outliers: number[];
  cleaned: number[];
} {
  if (values.length < 4) {
    return { outliers: [], cleaned: [...values] };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const outliers: number[] = [];
  const cleaned: number[] = [];

  for (const value of values) {
    if (value < lowerBound || value > upperBound) {
      outliers.push(value);
    } else {
      cleaned.push(value);
    }
  }

  return { outliers, cleaned };
}

/**
 * Weighted average calculation
 */
export function calculateWeightedAverage(values: number[], weights: number[]): number {
  if (values.length !== weights.length || values.length === 0) return 0;

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = values.reduce((sum, val, i) => sum + val * weights[i], 0);

  return weightedSum / totalWeight;
}

/**
 * Linear regression for trend prediction
 */
export function linearRegression(data: number[]): {
  slope: number;
  intercept: number;
  predict: (x: number) => number;
} {
  const n = data.length;
  if (n < 2) {
    return {
      slope: 0,
      intercept: data[0] || 0,
      predict: (x: number) => data[0] || 0,
    };
  }

  const sumX = (n * (n - 1)) / 2;
  const sumY = data.reduce((sum, val) => sum + val, 0);
  const sumXY = data.reduce((sum, val, i) => sum + i * val, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return {
    slope,
    intercept,
    predict: (x: number) => slope * x + intercept,
  };
}

/**
 * Calculate confidence interval
 */
export function calculateConfidenceInterval(
  values: number[],
  confidence: number = 0.95
): { lower: number; upper: number } {
  if (values.length < 2) {
    return { lower: values[0] || 0, upper: values[0] || 0 };
  }

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const stdError = calculateStdDev(values) / Math.sqrt(values.length);

  // t-distribution critical values (approximate for large samples)
  const tValues: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  };

  const t = tValues[confidence] || 1.96;

  return {
    lower: mean - t * stdError,
    upper: mean + t * stdError,
  };
}

/**
 * Format latency for display
 */
export function formatLatency(ms: number): string {
  if (ms < 1) return `${Math.round(ms * 1000)}μs`;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Map value from one range to another
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Lerp between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
