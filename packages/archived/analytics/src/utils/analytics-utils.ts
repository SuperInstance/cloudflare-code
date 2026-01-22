/**
 * Analytics Utilities
 * Helper functions for analytics operations
 */

export class AnalyticsUtils {
  /**
   * Calculate percentile from array of values
   */
  static percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor((p / 100) * sorted.length);
    return sorted[index] || 0;
  }

  /**
   * Calculate mean of values
   */
  static mean(values: number[]): number {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  /**
   * Calculate median of values
   */
  static median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Calculate standard deviation
   */
  static standardDeviation(values: number[]): number {
    const m = this.mean(values);
    return Math.sqrt(values.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / values.length);
  }

  /**
   * Calculate variance
   */
  static variance(values: number[]): number {
    const m = this.mean(values);
    return values.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / values.length;
  }

  /**
   * Calculate moving average
   */
  static movingAverage(values: number[], window: number): number[] {
    const result: number[] = [];

    for (let i = window - 1; i < values.length; i++) {
      const slice = values.slice(i - window + 1, i + 1);
      result.push(this.mean(slice));
    }

    return result;
  }

  /**
   * Calculate exponential moving average
   */
  static exponentialMovingAverage(values: number[], alpha: number = 0.5): number[] {
    const result: number[] = [values[0]];

    for (let i = 1; i < values.length; i++) {
      const ema = alpha * values[i] + (1 - alpha) * result[i - 1];
      result.push(ema);
    }

    return result;
  }

  /**
   * Calculate rate per time unit
   */
  static rate(values: number[], timeWindow: number): number {
    return values.length / (timeWindow / 1000);
  }

  /**
   * Resample time series data
   */
  static resample(
    data: Array<{ timestamp: number; value: number }>,
    interval: number,
    method: 'avg' | 'sum' | 'min' | 'max' | 'count' = 'avg'
  ): Array<{ timestamp: number; value: number }> {
    const buckets = new Map<number, number[]>();

    for (const point of data) {
      const bucketKey = Math.floor(point.timestamp / interval) * interval;

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }

      buckets.get(bucketKey)!.push(point.value);
    }

    const result: Array<{ timestamp: number; value: number }> = [];

    for (const [timestamp, values] of buckets.entries()) {
      let value: number;

      switch (method) {
        case 'avg':
          value = this.mean(values);
          break;
        case 'sum':
          value = values.reduce((a, b) => a + b, 0);
          break;
        case 'min':
          value = Math.min(...values);
          break;
        case 'max':
          value = Math.max(...values);
          break;
        case 'count':
          value = values.length;
          break;
        default:
          value = this.mean(values);
      }

      result.push({ timestamp, value });
    }

    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Smooth data using moving average
   */
  static smooth(
    data: Array<{ timestamp: number; value: number }>,
    window: number = 5
  ): Array<{ timestamp: number; value: number }> {
    const values = data.map(d => d.value);
    const smoothed = this.movingAverage(values, window);

    return data.slice(window - 1).map((d, i) => ({
      timestamp: d.timestamp,
      value: smoothed[i],
    }));
  }

  /**
   * Detect outliers using IQR method
   */
  static detectOutliers(values: number[]): { outliers: number[]; indices: number[] } {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = this.percentile(sorted, 25);
    const q3 = this.percentile(sorted, 75);
    const iqr = q3 - q1;

    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const outliers: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < values.length; i++) {
      if (values[i] < lowerBound || values[i] > upperBound) {
        outliers.push(values[i]);
        indices.push(i);
      }
    }

    return { outliers, indices };
  }

  /**
   * Calculate correlation coefficient
   */
  static correlation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate linear regression
   */
  static linearRegression(data: Array<{ x: number; y: number }>): {
    slope: number;
    intercept: number;
    r2: number;
  } {
    const n = data.length;
    const sumX = data.reduce((sum, p) => sum + p.x, 0);
    const sumY = data.reduce((sum, p) => sum + p.y, 0);
    const sumXY = data.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumX2 = data.reduce((sum, p) => sum + p.x * p.x, 0);
    const sumY2 = data.reduce((sum, p) => sum + p.y * p.y, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R²
    const yMean = sumY / n;
    const ssTot = data.reduce((sum, p) => sum + Math.pow(p.y - yMean, 2), 0);
    const ssRes = data.reduce((sum, p) => sum + Math.pow(p.y - (slope * p.x + intercept), 2), 0);
    const r2 = 1 - ssRes / ssTot;

    return { slope, intercept, r2 };
  }

  /**
   * Format number with suffixes
   */
  static formatNumber(num: number, decimals: number = 1): string {
    if (num >= 1e9) {
      return (num / 1e9).toFixed(decimals) + 'B';
    }
    if (num >= 1e6) {
      return (num / 1e6).toFixed(decimals) + 'M';
    }
    if (num >= 1e3) {
      return (num / 1e3).toFixed(decimals) + 'K';
    }
    return num.toFixed(decimals);
  }

  /**
   * Format duration
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    if (ms < 3600000) {
      return `${(ms / 60000).toFixed(1)}m`;
    }
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  /**
   * Format percentage
   */
  static formatPercentage(value: number, decimals: number = 1): string {
    return `${(value * 100).toFixed(decimals)}%`;
  }

  /**
   * Format bytes
   */
  static formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes}B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)}KB`;
    }
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }

  /**
   * Generate color scale
   */
  static generateColorScale(n: number): string[] {
    const colors: string[] = [];

    for (let i = 0; i < n; i++) {
      const hue = (i * 360) / n;
      colors.push(`hsl(${hue}, 70%, 50%)`);
    }

    return colors;
  }

  /**
   * Hash string to number
   */
  static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generate consistent color for string
   */
  static stringToColor(str: string): string {
    const hash = this.hashString(str);
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  /**
   * Chunk array into smaller arrays
   */
  static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];

    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }

    return chunks;
  }

  /**
   * Debounce function
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(() => {
        func(...args);
        timeout = null;
      }, wait);
    };
  }

  /**
   * Throttle function
   */
  static throttle<T extends (...args: any[]) => any>(
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

  /**
   * Sleep for specified duration
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry function with exponential backoff
   */
  static async retry<T>(
    func: () => Promise<T>,
    options: {
      maxAttempts?: number;
      initialDelay?: number;
      maxDelay?: number;
      backoffMultiplier?: number;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      backoffMultiplier = 2,
    } = options;

    let lastError: Error | undefined;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await func();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          break;
        }

        await this.sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }

    throw lastError;
  }

  /**
   * Validate timestamp
   */
  static isValidTimestamp(timestamp: number): boolean {
    return (
      typeof timestamp === 'number' &&
      timestamp > 0 &&
      timestamp <= Date.now() &&
      timestamp >= 946684800000 // Year 2000
    );
  }

  /**
   * Get time range from preset
   */
  static getTimeRange(preset: 'last_hour' | 'last_day' | 'last_week' | 'last_month' | 'last_year'): {
    start: number;
    end: number;
    duration: number;
  } {
    const now = Date.now();
    let duration: number;

    switch (preset) {
      case 'last_hour':
        duration = 60 * 60 * 1000;
        break;
      case 'last_day':
        duration = 24 * 60 * 60 * 1000;
        break;
      case 'last_week':
        duration = 7 * 24 * 60 * 60 * 1000;
        break;
      case 'last_month':
        duration = 30 * 24 * 60 * 60 * 1000;
        break;
      case 'last_year':
        duration = 365 * 24 * 60 * 60 * 1000;
        break;
    }

    return {
      start: now - duration,
      end: now,
      duration,
    };
  }

  /**
   * Generate unique ID
   */
  static generateId(prefix: string = ''): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
  }

  /**
   * Parse query string
   */
  static parseQueryString(query: string): Record<string, string> {
    const params: Record<string, string> = {};

    const pairs = query.split('&');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        params[decodeURIComponent(key)] = decodeURIComponent(value || '');
      }
    }

    return params;
  }

  /**
   * Build query string
   */
  static buildQueryString(params: Record<string, any>): string {
    const pairs = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

    return pairs.length > 0 ? `?${pairs.join('&')}` : '';
  }
}
