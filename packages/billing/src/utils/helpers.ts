/**
 * Utility functions for billing system
 */

import { PlanType, BillingInterval } from '../types/index.js';

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format seconds for display
 */
export function formatSeconds(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const remainingMinutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${remainingMinutes}m`;
  }
}

/**
 * Calculate date difference in days
 */
export function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((date2.getTime() - date1.getTime()) / msPerDay);
}

/**
 * Add days to date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add months to date
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Get start of day
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Get start of month
 */
export function startOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of month
 */
export function endOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1);
  result.setDate(0);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Check if date is in range
 */
export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

/**
 * Generate unique ID
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sleep/delay function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}

/**
 * Batch processing helper
 */
export async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Merge objects deeply
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize string for safe storage
 */
export function sanitizeString(str: string): string {
  return str.trim().replace(/[<>]/g, '');
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substr(0, maxLength - 3) + '...';
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate exponential moving average
 */
export function calculateEMA(data: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const ema: number[] = [data[0]];

  for (let i = 1; i < data.length; i++) {
    const value = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
    ema.push(value);
  }

  return ema;
}

/**
 * Calculate simple moving average
 */
export function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }

  return sma;
}

/**
 * Get plan display name
 */
export function getPlanDisplayName(planType: PlanType): string {
  const names: Record<PlanType, string> = {
    [PlanType.FREE]: 'Free',
    [PlanType.PRO]: 'Pro',
    [PlanType.TEAM]: 'Team',
    [PlanType.ENTERPRISE]: 'Enterprise',
  };
  return names[planType] || planType;
}

/**
 * Get interval display name
 */
export function getIntervalDisplayName(interval: BillingInterval): string {
  const names: Record<BillingInterval, string> = {
    [BillingInterval.MONTHLY]: 'Monthly',
    [BillingInterval.YEARLY]: 'Yearly',
  };
  return names[interval] || interval;
}

/**
 * Parse plan type from string
 */
export function parsePlanType(str: string): PlanType | null {
  const normalized = str.toLowerCase();
  const mapping: Record<string, PlanType> = {
    free: PlanType.FREE,
    pro: PlanType.PRO,
    team: PlanType.TEAM,
    enterprise: PlanType.ENTERPRISE,
  };
  return mapping[normalized] || null;
}

/**
 * Parse billing interval from string
 */
export function parseBillingInterval(str: string): BillingInterval | null {
  const normalized = str.toLowerCase();
  const mapping: Record<string, BillingInterval> = {
    monthly: BillingInterval.MONTHLY,
    yearly: BillingInterval.YEARLY,
    annual: BillingInterval.YEARLY,
  };
  return mapping[normalized] || null;
}

/**
 * Generate random string
 */
export function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Hash string (simple implementation)
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

/**
 * Parse user agent
 */
export function parseUserAgent(userAgent: string): {
  browser: string;
  os: string;
  device: string;
} {
  // Simplified user agent parsing
  const browser = userAgent.includes('Chrome')
    ? 'Chrome'
    : userAgent.includes('Firefox')
    ? 'Firefox'
    : userAgent.includes('Safari')
    ? 'Safari'
    : 'Unknown';

  const os = userAgent.includes('Windows')
    ? 'Windows'
    : userAgent.includes('Mac')
    ? 'MacOS'
    : userAgent.includes('Linux')
    ? 'Linux'
    : 'Unknown';

  const device = userAgent.includes('Mobile') ? 'Mobile' : 'Desktop';

  return { browser, os, device };
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: Request): string {
  // Check various headers for IP
  const headers = [
    'CF-Connecting-IP',
    'X-Forwarded-For',
    'X-Real-IP',
    'X-Client-IP',
  ];

  for (const header of headers) {
    const ip = request.headers.get(header);
    if (ip) {
      return ip.split(',')[0].trim();
    }
  }

  return 'unknown';
}
