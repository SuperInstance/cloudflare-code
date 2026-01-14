/**
 * Time utility functions
 */

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now();
}

/**
 * Get current timestamp in microseconds
 */
export function nowMicro(): number {
  return Date.now() * 1000;
}

/**
 * Get current timestamp in nanoseconds
 */
export function nowNano(): number {
  return Date.now() * 1000000;
}

/**
 * Format timestamp as ISO string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Parse timestamp from ISO string
 */
export function parseTimestamp(isoString: string): number {
  return new Date(isoString).getTime();
}

/**
 * Calculate duration between two timestamps
 */
export function duration(start: number, end: number): number {
  return end - start;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  } else {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Format bytes in human-readable format
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
 * Convert milliseconds to seconds
 */
export function msToSeconds(ms: number): number {
  return ms / 1000;
}

/**
 * Convert seconds to milliseconds
 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

/**
 * Convert microseconds to milliseconds
 */
export function microToMs(micro: number): number {
  return micro / 1000;
}

/**
 * Convert milliseconds to microseconds
 */
export function msToMicro(ms: number): number {
  return ms * 1000;
}

/**
 * Get time since a timestamp
 */
export function timeSince(timestamp: number): number {
  return Date.now() - timestamp;
}

/**
 * Check if a timestamp is recent (within given milliseconds)
 */
export function isRecent(timestamp: number, withinMs: number): boolean {
  return Date.now() - timestamp <= withinMs;
}

/**
 * Calculate time bucket for time series data
 */
export function getTimeBucket(timestamp: number, bucketSizeMs: number): number {
  return Math.floor(timestamp / bucketSizeMs) * bucketSizeMs;
}

/**
 * Sleep for a given duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
