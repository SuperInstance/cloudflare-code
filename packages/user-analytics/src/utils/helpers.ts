/**
 * Utility Functions
 * Helper functions for analytics operations
 */

import type { DateRange, AnalyticsEvent } from '../types/index.js';

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Get date range for last N days
 */
export function getLastNDays(n: number): DateRange {
  const end = Date.now();
  const start = end - n * 24 * 60 * 60 * 1000;

  return { start, end };
}

/**
 * Get date range for last N hours
 */
export function getLastNHours(n: number): DateRange {
  const end = Date.now();
  const start = end - n * 60 * 60 * 1000;

  return { start, end };
}

/**
 * Get date range for last N weeks
 */
export function getLastNWeeks(n: number): DateRange {
  const end = Date.now();
  const start = end - n * 7 * 24 * 60 * 60 * 1000;

  return { start, end };
}

/**
 * Get date range for last N months
 */
export function getLastNMonths(n: number): DateRange {
  const end = Date.now();
  const start = end - n * 30 * 24 * 60 * 60 * 1000;

  return { start, end };
}

/**
 * Get today's date range
 */
export function getToday(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 24 * 60 * 60 * 1000 - 1;

  return { start, end };
}

/**
 * Get this week's date range
 */
export function getThisWeek(): DateRange {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).getTime();
  const end = start + 7 * 24 * 60 * 60 * 1000 - 1;

  return { start, end };
}

/**
 * Get this month's date range
 */
export function getThisMonth(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1;

  return { start, end };
}

/**
 * Format timestamp to date string
 */
export function formatDate(timestamp: number, format: 'ISO' | 'readable' = 'ISO'): string {
  const date = new Date(timestamp);

  if (format === 'ISO') {
    return date.toISOString();
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Parse date string to timestamp
 */
export function parseDate(dateString: string): number {
  return new Date(dateString).getTime();
}

/**
 * Get timezone offset in milliseconds
 */
export function getTimezoneOffset(): number {
  return new Date().getTimezoneOffset() * 60 * 1000;
}

// ============================================================================
// Statistical Utilities
// ============================================================================>

/**
 * Calculate mean
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate median
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate mode
 */
export function mode(values: number[]): number[] {
  if (values.length === 0) return [];

  const frequency = new Map<number, number>();

  for (const value of values) {
    frequency.set(value, (frequency.get(value) || 0) + 1);
  }

  const maxFreq = Math.max(...frequency.values());
  const modes = Array.from(frequency.entries())
    .filter(([_, freq]) => freq === maxFreq)
    .map(([value]) => value);

  return modes;
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const avg = mean(values);
  const squareDiffs = values.map((v) => Math.pow(v - avg, 2));
  const avgSquareDiff = mean(squareDiffs);

  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate variance
 */
export function variance(values: number[]): number {
  return Math.pow(standardDeviation(values), 2);
}

/**
 * Calculate percentile
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);

  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate correlation coefficient
 */
export function correlation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator !== 0 ? numerator / denominator : 0;
}

/**
 * Calculate moving average
 */
export function movingAverage(values: number[], window: number): number[] {
  if (values.length === 0 || window === 0) return [];

  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    result.push(mean(slice));
  }

  return result;
}

/**
 * Calculate growth rate
 */
export function growthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Calculate compound annual growth rate (CAGR)
 */
export function cagr(
  startValue: number,
  endValue: number,
  periods: number
): number {
  if (startValue <= 0 || periods <= 0) return 0;
  return (Math.pow(endValue / startValue, 1 / periods) - 1) * 100;
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}

/**
 * Shuffle array
 */
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Sample array randomly
 */
export function sample<T>(array: T[], count: number): T[] {
  const shuffled = shuffle(array);
  return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], key: keyof T): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const item of array) {
    const keyValue = String(item[key]);

    if (!grouped.has(keyValue)) {
      grouped.set(keyValue, []);
    }

    grouped.get(keyValue)!.push(item);
  }

  return grouped;
}

/**
 * Unique values in array
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * Remove duplicates from array
 */
export function deduplicate<T>(array: T[]): T[] {
  return unique(array);
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Generate a unique ID
 */
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hash a string
 */
export function hashString(str: string): string {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(16);
}

/**
 * Truncate string
 */
export function truncate(str: string, length: number, suffix = '...'): string {
  if (str.length <= length) return str;
  return str.substring(0, length - suffix.length) + suffix;
}

/**
 * Slugify string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format bytes
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Format duration
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

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Check if value is a valid email
 */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Check if value is a valid URL
 */
export function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if value is a valid date
 */
export function isValidDate(value: any): boolean {
  return value instanceof Date || !isNaN(Date.parse(value));
}

/**
 * Check if value is a valid number
 */
export function isValidNumber(value: any): boolean {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Check if value is empty
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Sanitize string input
 */
export function sanitizeString(str: string): string {
  return str.replace(/[<>]/g, '');
}

/**
 * Sanitize object by removing null/undefined values
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = { ...obj };

  for (const key in sanitized) {
    if (sanitized[key] === null || sanitized[key] === undefined) {
      delete sanitized[key];
    }
  }

  return sanitized;
}

// ============================================================================
// Event Utilities
// ============================================================================

/**
 * Filter events by date range
 */
export function filterEventsByDateRange(
  events: AnalyticsEvent[],
  range: DateRange
): AnalyticsEvent[] {
  return events.filter((e) => e.timestamp >= range.start && e.timestamp <= range.end);
}

/**
 * Filter events by user
 */
export function filterEventsByUser(
  events: AnalyticsEvent[],
  userId: string
): AnalyticsEvent[] {
  return events.filter((e) => e.userId === userId);
}

/**
 * Filter events by session
 */
export function filterEventsBySession(
  events: AnalyticsEvent[],
  sessionId: string
): AnalyticsEvent[] {
  return events.filter((e) => e.sessionId === sessionId);
}

/**
 * Filter events by type
 */
export function filterEventsByType(
  events: AnalyticsEvent[],
  eventType: string
): AnalyticsEvent[] {
  return events.filter((e) => e.eventType === eventType);
}

/**
 * Sort events by timestamp
 */
export function sortEventsByTimestamp(
  events: AnalyticsEvent[],
  order: 'asc' | 'desc' = 'asc'
): AnalyticsEvent[] {
  return [...events].sort((a, b) =>
    order === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
  );
}

/**
 * Group events by user
 */
export function groupEventsByUser(
  events: AnalyticsEvent[]
): Map<string, AnalyticsEvent[]> {
  const grouped = new Map<string, AnalyticsEvent[]>();

  for (const event of events) {
    if (!event.userId) continue;

    if (!grouped.has(event.userId)) {
      grouped.set(event.userId, []);
    }

    grouped.get(event.userId)!.push(event);
  }

  return grouped;
}

/**
 * Group events by session
 */
export function groupEventsBySession(
  events: AnalyticsEvent[]
): Map<string, AnalyticsEvent[]> {
  const grouped = new Map<string, AnalyticsEvent[]>();

  for (const event of events) {
    if (!grouped.has(event.sessionId)) {
      grouped.set(event.sessionId, []);
    }

    grouped.get(event.sessionId)!.push(event);
  }

  return grouped;
}

/**
 * Get unique users from events
 */
export function getUniqueUsers(events: AnalyticsEvent[]): string[] {
  const userIds = new Set(
    events
      .filter((e) => e.userId)
      .map((e) => e.userId!)
  );

  return Array.from(userIds);
}

/**
 * Get unique sessions from events
 */
export function getUniqueSessions(events: AnalyticsEvent[]): string[] {
  const sessionIds = new Set(events.map((e) => e.sessionId));

  return Array.from(sessionIds);
}
