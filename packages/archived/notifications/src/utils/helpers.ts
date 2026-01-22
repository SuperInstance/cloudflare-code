// @ts-nocheck
/**
 * Utility functions for the notification system
 */

import type {
  Notification,
  NotificationChannelType,
  NotificationPriority,
  NotificationCategory,
} from '../types';

/**
 * Generate a unique ID
 */
export function generateId(prefix: string = 'notif'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number
 */
export function isValidPhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Validate webhook URL
 */
export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitize HTML content
 */
export function sanitizeHtml(html: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return html.replace(/[&<>"']/g, (m) => map[m] || m);
}

/**
 * Truncate text to a maximum length
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Format date for notifications
 */
export function formatDate(date: Date, locale: string = 'en'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format relative time (e.g., "5 minutes ago")
 */
export function formatRelativeTime(date: Date, locale: string = 'en'): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffSeconds < 60) {
    return rtf.format(-diffSeconds, 'second');
  } else if (diffMinutes < 60) {
    return rtf.format(-diffMinutes, 'minute');
  } else if (diffHours < 24) {
    return rtf.format(-diffHours, 'hour');
  } else {
    return rtf.format(-diffDays, 'day');
  }
}

/**
 * Calculate priority score
 */
export function calculatePriorityScore(priority: NotificationPriority): number {
  const scores: Record<NotificationPriority, number> = {
    critical: 100,
    urgent: 80,
    high: 60,
    normal: 40,
    low: 20,
  };

  return scores[priority] || 0;
}

/**
 * Compare priorities
 */
export function comparePriorities(a: NotificationPriority, b: NotificationPriority): number {
  const scoreA = calculatePriorityScore(a);
  const scoreB = calculatePriorityScore(b);
  return scoreA - scoreB;
}

/**
 * Get higher priority
 */
export function getHigherPriority(
  a: NotificationPriority,
  b: NotificationPriority
): NotificationPriority {
  return comparePriorities(a, b) > 0 ? a : b;
}

/**
 * Check if priority meets threshold
 */
export function meetsThreshold(
  priority: NotificationPriority,
  threshold: NotificationPriority
): boolean {
  return calculatePriorityScore(priority) >= calculatePriorityScore(threshold);
}

/**
 * Parse channel from string
 */
export function parseChannel(channel: string): NotificationChannelType | null {
  const validChannels: NotificationChannelType[] = [
    'email',
    'sms',
    'push',
    'slack',
    'discord',
    'webhook',
    'in_app',
  ];

  if (validChannels.includes(channel as NotificationChannelType)) {
    return channel as NotificationChannelType;
  }

  return null;
}

/**
 * Parse category from string
 */
export function parseCategory(category: string): NotificationCategory | null {
  const validCategories: NotificationCategory[] = [
    'system',
    'security',
    'billing',
    'deployment',
    'performance',
    'alert',
    'social',
    'marketing',
    'workflow',
    'custom',
  ];

  if (validCategories.includes(category as NotificationCategory)) {
    return category as NotificationCategory;
  }

  return null;
}

/**
 * Parse priority from string
 */
export function parsePriority(priority: string): NotificationPriority | null {
  const validPriorities: NotificationPriority[] = [
    'critical',
    'urgent',
    'high',
    'normal',
    'low',
  ];

  if (validPriorities.includes(priority as NotificationPriority)) {
    return priority as NotificationPriority;
  }

  return null;
}

/**
 * Deep merge objects
 */
export function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] instanceof Object && key in target && !Array.isArray(source[key])) {
      result[key] = deepMerge(
        target[key] as unknown as T,
        source[key] as unknown as Partial<T>
      ) as unknown as T[keyof T];
    } else {
      result[key] = source[key] as T[keyof T];
    }
  }

  return result;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  func: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await func();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a promise with timeout
 */
export function promiseWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: Error = new Error('Promise timeout')
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(timeoutError), timeoutMs)
    ),
  ]);
}

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
 * Remove duplicates from array
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], key: keyof T): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of array) {
    const groupKey = String(item[key]);
    const group = groups.get(groupKey) || [];
    group.push(item);
    groups.set(groupKey, group);
  }

  return groups;
}

/**
 * Sort array by key
 */
export function sortBy<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (aVal < bVal) {
      return order === 'asc' ? -1 : 1;
    } else if (aVal > bVal) {
      return order === 'asc' ? 1 : -1;
    }

    return 0;
  });
}

/**
 * Validate notification object
 */
export function validateNotification(notification: Partial<Notification>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!notification.id) {
    errors.push('Notification ID is required');
  }

  if (!notification.userId) {
    errors.push('User ID is required');
  }

  if (!notification.channel) {
    errors.push('Channel is required');
  } else if (!parseChannel(notification.channel)) {
    errors.push(`Invalid channel: ${notification.channel}`);
  }

  if (!notification.category) {
    errors.push('Category is required');
  } else if (!parseCategory(notification.category)) {
    errors.push(`Invalid category: ${notification.category}`);
  }

  if (!notification.priority) {
    errors.push('Priority is required');
  } else if (!parsePriority(notification.priority)) {
    errors.push(`Invalid priority: ${notification.priority}`);
  }

  if (!notification.content || notification.content.trim().length === 0) {
    errors.push('Content is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Mask sensitive data
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars) {
    return '*'.repeat(data.length);
  }

  return data.substring(0, visibleChars) + '*'.repeat(data.length - visibleChars);
}

/**
 * Generate a fingerprint for deduplication
 */
export function generateFingerprint(data: Record<string, unknown>): string {
  const keys = Object.keys(data).sort();
  const fingerprintParts = keys.map((key) => `${key}:${String(data[key])}`);
  return fingerprintParts.join('|');
}

/**
 * Check if date is within range
 */
export function isWithinRange(
  date: Date,
  start: Date,
  end: Date
): boolean {
  return date >= start && date <= end;
}

/**
 * Get date range for period
 */
export function getDateRange(
  period: 'hour' | 'day' | 'week' | 'month' | 'year',
  endDate: Date = new Date()
): { start: Date; end: Date } {
  const start = new Date(endDate);

  switch (period) {
    case 'hour':
      start.setHours(start.getHours() - 1);
      break;
    case 'day':
      start.setDate(start.getDate() - 1);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
  }

  return { start, end };
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return (value / total) * 100;
}

/**
 * Format percentage for display
 */
export function formatPercentage(percentage: number, decimals: number = 1): string {
  return `${percentage.toFixed(decimals)}%`;
}
