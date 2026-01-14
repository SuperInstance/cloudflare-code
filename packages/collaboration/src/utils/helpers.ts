/**
 * Collaboration Utility Functions
 * Helper functions used across collaboration modules
 */

import { nanoid } from 'nanoid';

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return nanoid();
}

/**
 * Generate a unique document ID
 */
export function generateDocumentId(): string {
  return `doc_${nanoid()}`;
}

/**
 * Generate a unique comment ID
 */
export function generateCommentId(): string {
  return `comment_${nanoid()}`;
}

// ============================================================================
// Color Generation
// ============================================================================

/**
 * Generate a random color for a user
 */
export function generateUserColor(userId: string): string {
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Sky Blue
    '#F8B739', // Orange
    '#52C7B8', // Turquoise
    '#FF69B4', // Hot Pink
    '#32CD32', // Lime Green
    '#FFD700', // Gold
    '#8A2BE2', // Blue Violet
    '#FF4500', // Orange Red
  ];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Generate a color palette for multiple users
 */
export function generateColorPalette(userCount: number): string[] {
  const colors: string[] = [];
  const hueStep = 360 / userCount;

  for (let i = 0; i < userCount; i++) {
    const hue = Math.floor(i * hueStep);
    const saturation = 70;
    const lightness = 50;
    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
  }

  return colors;
}

// ============================================================================
// Text Processing
// ============================================================================

/**
 * Truncate text to a maximum length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Normalize whitespace in text
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extract mention IDs from text
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }

  return mentions;
}

/**
 * Extract hashtags from text
 */
export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#(\w+)/g;
  const hashtags: string[] = [];
  let match;

  while ((match = hashtagRegex.exec(text)) !== null) {
    hashtags.push(match[1]);
  }

  return hashtags;
}

// ============================================================================
// Date/Time Utilities
// ============================================================================

/**
 * Format a timestamp as a relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) {
    return 'just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else if (weeks < 4) {
    return `${weeks}w ago`;
  } else if (months < 12) {
    return `${months}mo ago`;
  } else {
    return `${years}y ago`;
  }
}

/**
 * Format a timestamp as a date string
 */
export function formatDate(timestamp: number, format: 'short' | 'long' = 'short'): string {
  const date = new Date(timestamp);

  if (format === 'short') {
    return date.toLocaleDateString();
  } else {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

/**
 * Check if a timestamp is within a time window
 */
export function isWithinTimeWindow(
  timestamp: number,
  windowMs: number
): boolean {
  const now = Date.now();
  return timestamp >= now - windowMs;
}

/**
 * Get time difference in human-readable format
 */
export function getTimeDifference(timestamp1: number, timestamp2: number): string {
  const diff = Math.abs(timestamp1 - timestamp2);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate an email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate a slug
 */
export function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9-]+$/;
  return slugRegex.test(slug);
}

/**
 * Validate a URL
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
 * Sanitize HTML content
 */
export function sanitizeHtml(html: string): string {
  // Basic HTML sanitization
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Generate a slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Convert a string to title case
 */
export function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Calculate string similarity (0-1)
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1;
  }

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Chunk an array into smaller arrays
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Shuffle an array
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Remove duplicates from an array
 */
export function uniqueArray<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * Group array items by a key
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

// ============================================================================
// Map Utilities
// ============================================================================

/**
 * Convert a Map to an object
 */
export function mapToObject<K extends string, V>(map: Map<K, V>): Record<K, V> {
  const obj = {} as Record<K, V>;
  for (const [key, value] of map.entries()) {
    obj[key] = value;
  }
  return obj;
}

/**
 * Convert an object to a Map
 */
export function objectToMap<K extends string, V>(obj: Record<K, V>): Map<K, V> {
  return new Map(Object.entries(obj) as [K, V][]);
}

// ============================================================================
// Statistics Utilities
// ============================================================================

/**
 * Calculate the average of an array of numbers
 */
export function average(numbers: number[]): number {
  if (numbers.length === 0) {
    return 0;
  }
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

/**
 * Calculate the median of an array of numbers
 */
export function median(numbers: number[]): number {
  if (numbers.length === 0) {
    return 0;
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Calculate the standard deviation of an array of numbers
 */
export function standardDeviation(numbers: number[]): number {
  if (numbers.length === 0) {
    return 0;
  }

  const avg = average(numbers);
  const squareDiffs = numbers.map((n) => Math.pow(n - avg, 2));
  const avgSquareDiff = average(squareDiffs);

  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate the percentile of an array of numbers
 */
export function percentile(numbers: number[], p: number): number {
  if (numbers.length === 0) {
    return 0;
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;

  return sorted[index];
}

// ============================================================================
// Debounce/Throttle Utilities
// ============================================================================

/**
 * Debounce a function
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
 * Throttle a function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

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

// ============================================================================
// Promise Utilities
// ============================================================================

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  func: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await func();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Execute promises in parallel with concurrency limit
 */
export async function parallel<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number = 5
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = task().then((result) => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

// ============================================================================
// Debugging Utilities
// ============================================================================

/**
 * Create a logger with context
 */
export function createLogger(context: string) {
  return {
    debug: (...args: any[]) => console.debug(`[${context}]`, ...args),
    info: (...args: any[]) => console.info(`[${context}]`, ...args),
    warn: (...args: any[]) => console.warn(`[${context}]`, ...args),
    error: (...args: any[]) => console.error(`[${context}]`, ...args),
  };
}

/**
 * Measure execution time of a function
 */
export async function measureTime<T>(
  func: () => T | Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await func();
  const duration = Date.now() - start;

  return { result, duration };
}
