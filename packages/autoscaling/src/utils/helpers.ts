/**
 * Utility functions for autoscaling
 */

import type {
  ResourceSpec,
  ResourceUsage,
  AllocationStatus,
  ScalingMetrics,
  TimeSeriesData
} from '../types/index.js';

/**
 * Calculate resource utilization percentage
 */
export function calculateUtilization(used: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return (used / total) * 100;
}

/**
 * Determine allocation status based on usage
 */
export function determineAllocationStatus(usage: ResourceUsage): AllocationStatus {
  const avgUtil = (usage.cpu + usage.memory) / 2;

  if (avgUtil > 90) {
    return AllocationStatus.UNDERPROVISIONED;
  } else if (avgUtil < 20) {
    return AllocationStatus.OVERPROVISIONED;
  } else {
    return AllocationStatus.ACTIVE;
  }
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(data: number[], window: number): number[] {
  if (data.length < window) {
    return [...data];
  }

  const result: number[] = [];

  for (let i = 0; i <= data.length - window; i++) {
    const slice = data.slice(i, i + window);
    const avg = slice.reduce((sum, val) => sum + val, 0) / window;
    result.push(avg);
  }

  return result;
}

/**
 * Calculate exponential moving average
 */
export function calculateExponentialMovingAverage(data: number[], alpha: number): number[] {
  if (data.length === 0) {
    return [];
  }

  const result: number[] = [data[0]];

  for (let i = 1; i < data.length; i++) {
    const ema = alpha * data[i] + (1 - alpha) * result[i - 1];
    result.push(ema);
  }

  return result;
}

/**
 * Calculate percentile
 */
export function calculatePercentile(data: number[], percentile: number): number {
  if (data.length === 0) {
    return 0;
  }

  const sorted = [...data].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

/**
 * Calculate standard deviation
 */
export function calculateStandardDeviation(data: number[]): number {
  if (data.length === 0) {
    return 0;
  }

  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  return Math.sqrt(variance);
}

/**
 * Detect outliers using z-score
 */
export function detectOutliers(data: number[], threshold: number = 3): number[] {
  if (data.length < 3) {
    return [];
  }

  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const stdDev = calculateStandardDeviation(data);

  const outliers: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const zScore = Math.abs((data[i] - mean) / stdDev);
    if (zScore > threshold) {
      outliers.push(i);
    }
  }

  return outliers;
}

/**
 * Smooth data using simple moving average
 */
export function smoothData(data: number[], window: number): number[] {
  return calculateMovingAverage(data, window);
}

/**
 * Normalize data to 0-1 range
 */
export function normalizeData(data: number[]): number[] {
  if (data.length === 0) {
    return [];
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  if (range === 0) {
    return data.map(() => 0.5);
  }

  return data.map((val) => (val - min) / range);
}

/**
 * Calculate rate of change
 */
export function calculateRateOfChange(data: number[]): number[] {
  if (data.length < 2) {
    return [];
  }

  const rates: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const rate = (data[i] - data[i - 1]) / data[i - 1];
    rates.push(rate);
  }

  return rates;
}

/**
 * Calculate compound annual growth rate (CAGR)
 */
export function calculateCAGR(startValue: number, endValue: number, periods: number): number {
  if (startValue <= 0 || periods <= 0) {
    return 0;
  }

  return Math.pow(endValue / startValue, 1 / periods) - 1;
}

/**
 * Calculate linear regression
 */
export function calculateLinearRegression(data: Array<{ x: number; y: number }>): {
  slope: number;
  intercept: number;
  r2: number;
} {
  if (data.length < 2) {
    return { slope: 0, intercept: 0, r2: 0 };
  }

  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;

  for (const point of data) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
    sumYY += point.y * point.y;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R²
  const ssTotal = sumYY - (sumY * sumY) / n;
  const ssResidual = sumYY - intercept * sumY - slope * sumXY;
  const r2 = ssTotal !== 0 ? 1 - ssResidual / ssTotal : 0;

  return { slope, intercept, r2 };
}

/**
 * Interpolate missing values in time series
 */
export function interpolateTimeSeries(
  data: Array<{ timestamp: Date; value: number }>,
  maxGap: number = 3600000
): Array<{ timestamp: Date; value: number }> {
  if (data.length < 2) {
    return [...data];
  }

  const result: Array<{ timestamp: Date; value: number }> = [];
  result.push(data[0]);

  for (let i = 1; i < data.length; i++) {
    const gap = data[i].timestamp.getTime() - data[i - 1].timestamp.getTime();

    if (gap > maxGap) {
      result.push(data[i]);
      continue;
    }

    // Interpolate missing points
    const steps = Math.floor(gap / 60000); // Assume 1-minute intervals
    const valueStep = (data[i].value - data[i - 1].value) / steps;

    for (let j = 1; j < steps; j++) {
      result.push({
        timestamp: new Date(data[i - 1].timestamp.getTime() + j * 60000),
        value: data[i - 1].value + valueStep * j
      });
    }

    result.push(data[i]);
  }

  return result;
}

/**
 * Downsample time series data
 */
export function downsampleTimeSeries(
  data: Array<{ timestamp: Date; value: number }>,
  targetPoints: number
): Array<{ timestamp: Date; value: number }> {
  if (data.length <= targetPoints) {
    return [...data];
  }

  const step = Math.ceil(data.length / targetPoints);
  const result: Array<{ timestamp: Date; value: number }> = [];

  for (let i = 0; i < data.length; i += step) {
    const slice = data.slice(i, Math.min(i + step, data.length));
    const avgValue = slice.reduce((sum, d) => sum + d.value, 0) / slice.length;
    const avgTimestamp = new Date(
      slice[0].timestamp.getTime() + (slice[slice.length - 1].timestamp.getTime() - slice[0].timestamp.getTime()) / 2
    );

    result.push({ timestamp: avgTimestamp, value: avgValue });
  }

  return result;
}

/**
 * Calculate correlation coefficient
 */
export function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) {
    return 0;
  }

  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;

  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumXX += x[i] * x[i];
    sumYY += y[i] * y[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

  return denominator !== 0 ? numerator / denominator : 0;
}

/**
 * Calculate capacity needed for target utilization
 */
export function calculateCapacityForUtilization(
  currentCapacity: number,
  currentUtil: number,
  targetUtil: number
): number {
  if (currentUtil === 0) {
    return currentCapacity;
  }

  const needed = (currentCapacity * currentUtil) / targetUtil;
  return Math.ceil(needed);
}

/**
 * Calculate scale factor
 */
export function calculateScaleFactor(
  currentValue: number,
  targetValue: number,
  minScale: number = 0.5,
  maxScale: number = 2.0
): number {
  const scale = targetValue / currentValue;
  return Math.max(minScale, Math.min(maxScale, scale));
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format duration to human readable
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Generate unique ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw new Error('Max retries exceeded');
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
 * Check if value is within range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
