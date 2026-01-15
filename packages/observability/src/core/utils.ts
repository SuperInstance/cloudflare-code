import { createHash, createHmac } from 'crypto-js';

export class Utils {
  // UUID generation
  static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Hash generation
  static generateHash(input: string, algorithm: 'md5' | 'sha1' | 'sha256' = 'sha256'): string {
    return createHash(algorithm).update(input).toString();
  }

  // HMAC generation
  static generateHMAC(input: string, secret: string, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
    return createHmac(algorithm, secret).update(input).toString();
  }

  // Deep clone object
  static deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  // Debounce function
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Throttle function
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Rate limiter
  static createRateLimit(maxRequests: number, windowMs: number) {
    const requests: number[] = [];

    return {
      isAllowed: (): boolean => {
        const now = Date.now();
        const windowStart = now - windowMs;

        // Remove old requests
        while (requests.length > 0 && requests[0] < windowStart) {
          requests.shift();
        }

        // Check if under limit
        if (requests.length < maxRequests) {
          requests.push(now);
          return true;
        }

        return false;
      },

      getRemainingRequests(): number {
        const now = Date.now();
        const windowStart = now - windowMs;
        const activeRequests = requests.filter(time => time >= windowStart);
        return Math.max(0, maxRequests - activeRequests.length);
      },

      getResetTime(): number {
        const now = Date.now();
        const windowStart = now - windowMs;
        const earliestRequest = requests.find(time => time >= windowStart);

        if (!earliestRequest) {
          return 0;
        }

        return windowStart + (earliestRequest - windowStart);
      }
    };
  }

  // Retry mechanism
  static async retry<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number;
      delayMs?: number;
      backoffFactor?: number;
      onRetry?: (error: Error, attempt: number) => void;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      delayMs = 1000,
      backoffFactor = 2,
      onRetry
    } = options;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          throw lastError;
        }

        if (onRetry) {
          onRetry(lastError, attempt);
        }

        const waitTime = delayMs * Math.pow(backoffFactor, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw lastError!;
  }

  // Format bytes
  static formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Format duration
  static formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    }

    if (milliseconds < 60000) {
      return `${(milliseconds / 1000).toFixed(2)}s`;
    }

    if (milliseconds < 3600000) {
      return `${Math.floor(milliseconds / 60000)}m ${Math.floor((milliseconds % 60000) / 1000)}s`;
    }

    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);

    return `${hours}h ${minutes}m`;
  }

  // Sanitize input
  static sanitize(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .replace(/[{}]/g, '') // Remove braces
      .replace(/\\/g, '') // Remove backslashes
      .trim();
  }

  // Validate email
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate URL
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Parse query string
  static parseQueryString(queryString: string): Record<string, string> {
    const params: Record<string, string> = {};
    const pairs = queryString.replace(/^\?/, '').split('&');

    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
    }

    return params;
  }

  // Build query string
  static buildQueryString(params: Record<string, string | number | boolean>): string {
    const query = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    return query ? `?${query}` : '';
  }

  // Object to query string
  static objectToQueryString(obj: Record<string, any>): string {
    return Object.entries(obj)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join('&');
  }

  // Flatten object
  static flattenObject(obj: Record<string, any>, prefix: string = ''): Record<string, any> {
    const result: Record<string, any> = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(result, this.flattenObject(obj[key], newKey));
        } else {
          result[newKey] = obj[key];
        }
      }
    }

    return result;
  }

  // Unflatten object
  static unflattenObject(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const keys = key.split('.');
        let current = result;

        for (let i = 0; i < keys.length - 1; i++) {
          const k = keys[i];
          if (!(k in current)) {
            current[k] = {};
          }
          current = current[k];
        }

        current[keys[keys.length - 1]] = obj[key];
      }
    }

    return result;
  }

  // Merge arrays without duplicates
  static mergeArrays<T>(...arrays: T[][]): T[] {
    const merged = arrays.flat();
    return [...new Set(merged)];
  }

  // Chunk array
  static chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Sample array
  static sampleArray<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  // Calculate percentage
  static calculatePercentage(value: number, total: number): number {
    return total === 0 ? 0 : (value / total) * 100;
  }

  // Clamp value
  static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  // Generate random string
  static randomString(length: number = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Wait for condition
  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeoutMs: number,
    intervalMs: number = 100
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Condition not met within ${timeoutMs}ms`);
  }
}