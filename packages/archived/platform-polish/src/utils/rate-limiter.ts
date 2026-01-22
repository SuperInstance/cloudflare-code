// @ts-nocheck
import { LRUCache } from './helpers';

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private burst: number;
  private limit: number;
  private windowMs: number;
  private cache: LRUCache<string, any>;

  constructor(requestsPerMinute: number, burst: number) {
    this.limit = requestsPerMinute;
    this.burst = burst;
    this.windowMs = 60 * 1000; // 1 minute window
    this.cache = new LRUCache(1000);
  }

  async tryAcquire(identifier: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }

    let requests = this.requests.get(identifier)!;

    // Remove old requests
    requests = requests.filter(timestamp => timestamp > windowStart);
    this.requests.set(identifier, requests);

    // Check if limit exceeded
    if (requests.length >= this.limit) {
      return false;
    }

    // Add current request
    requests.push(now);
    this.requests.set(identifier, requests);

    return true;
  }

  reset(): void {
    this.requests.clear();
    this.cache.clear();
  }

  getStats(): any {
    let totalRequests = 0;
    let maxRequests = 0;

    for (const requests of this.requests.values()) {
      totalRequests += requests.length;
      maxRequests = Math.max(maxRequests, requests.length);
    }

    return {
      totalIdentifiers: this.requests.size,
      totalRequests,
      maxRequests,
      limit: this.limit,
      burst: this.burst
    };
  }
}