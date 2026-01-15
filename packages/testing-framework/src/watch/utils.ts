/**
 * Watch Mode Utilities
 * Utility functions for file watching and test execution
 */

import { WatchEvent, WatchConfig } from './types';

/**
 * Debounce function for limiting function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number,
  options: { leading?: boolean; trailing?: boolean; maxWait?: number } = {}
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout;
  let maxTimer: NodeJS.Timeout;
  let lastCallTime = 0;
  let lastArgs: Parameters<T> | null = null;

  const { leading = false, trailing = true, maxWait } = options;

  return function debounced(...args: Parameters<T>): void {
    lastCallTime = Date.now();
    lastArgs = args;

    const callNow = leading && !timer;

    if (callNow) {
      func.apply(this, args);
    }

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      if (trailing && lastArgs) {
        func.apply(this, lastArgs);
      }
      timer = undefined;
      lastArgs = null;
    }, delay);

    if (maxWait && !maxTimer) {
      maxTimer = setTimeout(() => {
        if (lastArgs) {
          func.apply(this, lastArgs);
        }
        maxTimer = undefined;
        timer = undefined;
        lastArgs = null;
      }, maxWait);
    }
  };
}

/**
 * Throttle function for limiting function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function throttled(...args: Parameters<T>): void {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Convert glob patterns to regex
 */
export function globToRegex(pattern: string): RegExp {
  let regexStr = pattern
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\//g, '\\/')
    .replace(/\./g, '\\.')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

  // Handle exact match patterns
  if (!pattern.includes('*')) {
    regexStr = `^${regexStr}$`;
  } else {
    regexStr = `^${regexStr}$`;
  }

  return new RegExp(regexStr);
}

/**
 * Normalize file path
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

/**
 * Check if path matches any pattern
 */
export function pathMatchesPattern(path: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    const regex = globToRegex(pattern);
    return regex.test(normalizePath(path));
  });
}

/**
 * Calculate rate
 */
export function calculateRate(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

/**
 * Format duration
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = ((milliseconds % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Deep merge objects
 */
export function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

/**
 * Safe JSON parse
 */
export function safeJsonParse(jsonString: string, defaultValue: any = null): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Validate watch config
 */
export function validateWatchConfig(config: Partial<WatchConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.watch || config.watch.length === 0) {
    errors.push('Watch patterns are required');
  }

  if (!config.tests) {
    errors.push('Test configuration is required');
  }

  if (config.tests?.run?.maxWorkers && config.tests.run.maxWorkers < 1) {
    errors.push('maxWorkers must be at least 1');
  }

  if (config.debounce?.delay && config.debounce.delay < 0) {
    errors.push('debounce.delay must be non-negative');
  }

  if (config.debounce?.maxWait && config.debounce.maxWait < 0) {
    errors.push('debounce.maxWait must be non-negative');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get file extension
 */
export function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  return lastDot === -1 ? '' : filePath.slice(lastDot);
}

/**
 * Is test file
 */
export function isTestFile(filePath: string, extensions: string[]): boolean {
  const ext = getFileExtension(filePath);
  return extensions.some(testExt => ext === testExt);
}

/**
 * Filter events by type
 */
export function filterEventsByType(events: WatchEvent[], types: WatchEvent['type'][]): WatchEvent[] {
  return events.filter(event => types.includes(event.type));
}

/**
 * Group events by file
 */
export function groupEventsByFile(events: WatchEvent[]): { [filePath: string]: WatchEvent[] } {
  const grouped: { [filePath: string]: WatchEvent[] } = {};

  for (const event of events) {
    if (!grouped[event.path]) {
      grouped[event.path] = [];
    }
    grouped[event.path].push(event);
  }

  return grouped;
}

/**
 * Get event frequency
 */
export function getEventFrequency(events: WatchEvent[], timeWindow: number = 60000): number {
  if (events.length === 0) return 0;

  const now = Date.now();
  const recentEvents = events.filter(event => now - event.timestamp < timeWindow);

  return recentEvents.length / (timeWindow / 1000);
}

/**
 * Check if path is within directory
 */
export function isPathWithinDirectory(path: string, directory: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedDirectory = normalizePath(directory);

  return normalizedPath === normalizedDirectory ||
    normalizedPath.startsWith(normalizedDirectory + '/');
}

/**
 * Get relative path
 */
export function getRelativePath(path: string, from: string): string {
  const normalizedPath = normalizePath(path);
  const normalizedFrom = normalizePath(from);

  return normalizedPath.replace(normalizedFrom, '');
}

/**
 * Escape special characters for regex
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}