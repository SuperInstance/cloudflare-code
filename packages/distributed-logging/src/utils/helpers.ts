/**
 * Utility helper functions
 */

import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';
import { LogEntry, LogLevel, LogMetadata, CompressionType } from '../types';

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique log entry ID
 */
export function generateLogId(): string {
  return uuidv4();
}

/**
 * Generate a trace ID
 */
export function generateTraceId(): string {
  return nanoid(32);
}

/**
 * Generate a span ID
 */
export function generateSpanId(): string {
  return nanoid(16);
}

/**
 * Generate a batch ID
 */
export function generateBatchId(): string {
  return `batch_${Date.now()}_${nanoid(8)}`;
}

// ============================================================================
// Time Utilities
// ============================================================================

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now();
}

/**
 * Convert timestamp to ISO string
 */
export function toISOString(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Parse ISO string to timestamp
 */
export function fromISOString(isoString: string): number {
  return new Date(isoString).getTime();
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number, format: 'iso' | 'unix' | 'readable' = 'iso'): string {
  switch (format) {
    case 'iso':
      return toISOString(timestamp);
    case 'unix':
      return timestamp.toString();
    case 'readable':
      return new Date(timestamp).toLocaleString();
    default:
      return toISOString(timestamp);
  }
}

/**
 * Calculate duration between two timestamps
 */
export function duration(start: number, end: number): number {
  return end - start;
}

/**
 * Check if timestamp is within time range
 */
export function isWithinRange(timestamp: number, rangeStart: number, rangeEnd: number): boolean {
  return timestamp >= rangeStart && timestamp <= rangeEnd;
}

// ============================================================================
// Log Level Utilities
// ============================================================================

/**
 * Convert string to log level
 */
export function stringToLogLevel(level: string): LogLevel | undefined {
  const upperLevel = level.toUpperCase();
  return LogLevel[upperLevel as keyof typeof LogLevel];
}

/**
 * Convert log level to string
 */
export function logLevelToString(level: LogLevel): string {
  return LogLevel[level].toLowerCase();
}

/**
 * Check if log level is error or higher
 */
export function isErrorLevel(level: LogLevel): boolean {
  return level >= LogLevel.ERROR;
}

/**
 * Check if log level is warning or higher
 */
export function isWarningLevel(level: LogLevel): boolean {
  return level >= LogLevel.WARN;
}

// ============================================================================
// Size Utilities
// ============================================================================

/**
 * Calculate size of log entry in bytes
 */
export function calculateLogSize(entry: LogEntry): number {
  return Buffer.byteLength(JSON.stringify(entry), 'utf8');
}

/**
 * Calculate size of log batch in bytes
 */
export function calculateBatchSize(entries: LogEntry[]): number {
  return entries.reduce((total, entry) => total + calculateLogSize(entry), 0);
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ============================================================================
// Compression Utilities
// ============================================================================

/**
 * Estimate compression ratio
 */
export function estimateCompressionRatio(
  data: string,
  compressionType: CompressionType
): number {
  switch (compressionType) {
    case CompressionType.NONE:
      return 1.0;
    case CompressionType.GZIP:
      return 0.3; // Typical gzip ratio
    case CompressionType.LZ4:
      return 0.5; // Typical LZ4 ratio
    case CompressionType.SNAPPY:
      return 0.4; // Typical snappy ratio
    default:
      return 1.0;
  }
}

/**
 * Calculate compressed size
 */
export function calculateCompressedSize(size: number, compressionType: CompressionType): number {
  const ratio = estimateCompressionRatio('', compressionType);
  return Math.ceil(size * ratio);
}

// ============================================================================
// Log Processing Utilities
// ============================================================================

/**
 * Extract error information from error object
 */
export function extractErrorInfo(error: Error): {
  name: string;
  message: string;
  code?: string;
  stack?: string;
} {
  const errorInfo: any = {
    name: error.name,
    message: error.message,
  };

  if ('code' in error) {
    errorInfo.code = (error as any).code;
  }

  if (error.stack) {
    errorInfo.stack = error.stack;
  }

  return errorInfo;
}

/**
 * Sanitize metadata to ensure it's serializable
 */
export function sanitizeMetadata(metadata: LogMetadata): LogMetadata {
  const sanitized: LogMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) {
      continue;
    }

    if (value === null) {
      sanitized[key] = null;
      continue;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      sanitized[key] = value.filter((v) => v !== undefined);
      continue;
    }

    if (typeof value === 'object') {
      sanitized[key] = sanitizeMetadata(value as LogMetadata);
      continue;
    }

    // Convert other types to string
    sanitized[key] = String(value);
  }

  return sanitized;
}

/**
 * Merge two metadata objects
 */
export function mergeMetadata(base: LogMetadata, override: LogMetadata): LogMetadata {
  return {
    ...base,
    ...override,
  };
}

/**
 * Flatten nested metadata
 */
export function flattenMetadata(metadata: LogMetadata, separator = '.'): LogMetadata {
  const flattened: LogMetadata = {};

  function flatten(obj: LogMetadata, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}${separator}${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        flatten(value as LogMetadata, newKey);
      } else {
        flattened[newKey] = value;
      }
    }
  }

  flatten(metadata);
  return flattened;
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Truncate string to max length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Escape special characters for regex
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if string matches pattern
 */
export function matchesPattern(str: string, pattern: string, caseSensitive = false): boolean {
  const flags = caseSensitive ? '' : 'i';
  const regex = new RegExp(pattern, flags);
  return regex.test(str);
}

/**
 * Wildcard match (supports * and ?)
 */
export function wildcardMatch(str: string, pattern: string, caseSensitive = false): boolean {
  const regexString = pattern
    .split('*')
    .map((part) => escapeRegex(part))
    .join('.*')
    .replace(/\?/g, '.');

  const flags = caseSensitive ? '' : 'i';
  const regex = new RegExp(`^${regexString}$`, flags);
  return regex.test(str);
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
 * Deduplicate array
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
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
 * Sample random elements from array
 */
export function sample<T>(array: T[], count: number): T[] {
  const shuffled = shuffle(array);
  return shuffled.slice(0, Math.min(count, array.length));
}

// ============================================================================
// Math Utilities
// ============================================================================

/**
 * Calculate average
 */
export function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

/**
 * Calculate median
 */
export function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate percentile
 */
export function percentile(numbers: number[], p: number): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const avg = average(numbers);
  const squareDiffs = numbers.map((n) => Math.pow(n - avg, 2));
  return Math.sqrt(average(squareDiffs));
}

/**
 * Calculate rate (items per second)
 */
export function calculateRate(count: number, timeWindowMs: number): number {
  if (timeWindowMs <= 0) return 0;
  return (count / timeWindowMs) * 1000;
}

// ============================================================================
// Hash Utilities
// ============================================================================

/**
 * Simple hash function for strings
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Hash metadata for deduplication
 */
export function hashMetadata(metadata: LogMetadata): string {
  const keys = Object.keys(metadata).sort();
  const values = keys.map((k) => JSON.stringify(metadata[k]));
  return simpleHash(keys.join(',') + values.join(','));
}
