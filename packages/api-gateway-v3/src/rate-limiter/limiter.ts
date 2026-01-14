/**
 * Rate Limiter - Request rate limiting
 */

import { GatewayRequest, GatewayError } from '../types/index.js';

export interface RateLimitConfig {
  enabled: boolean;
  defaultLimit: number;
  defaultWindow: number;
  storage: 'memory' | 'kv' | 'durable-object';
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export interface TokenBucket {
  tokens: number;
  lastUpdate: number;
}

export interface LeakyBucket {
  tokens: number;
  lastUpdate: number;
}

export interface FixedWindow {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private config: RateLimitConfig;
  private storage: Map<string, TokenBucket | LeakyBucket | FixedWindow>;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.storage = new Map();
  }

  async check(request: GatewayRequest): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const key = this.getKey(request);
    const result = await this.checkLimit(key);

    if (!result.allowed) {
      throw new GatewayError(
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        429
      );
    }
  }

  private getKey(request: GatewayRequest): string {
    return `rate_limit:${request.metadata.sourceIp}`;
  }

  private async checkLimit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    let state = this.storage.get(key);

    if (!state) {
      state = {
        tokens: this.config.defaultLimit,
        lastUpdate: now,
      } as TokenBucket;
      this.storage.set(key, state);
    }

    const bucket = state as TokenBucket;
    const elapsed = now - bucket.lastUpdate;
    const tokensToAdd = Math.floor(elapsed / (this.config.defaultWindow / this.config.defaultLimit));

    bucket.tokens = Math.min(this.config.defaultLimit, bucket.tokens + tokensToAdd);
    bucket.lastUpdate = now;

    if (bucket.tokens < 1) {
      return {
        allowed: false,
        limit: this.config.defaultLimit,
        remaining: 0,
        reset: now + this.config.defaultWindow,
      };
    }

    bucket.tokens--;
    return {
      allowed: true,
      limit: this.config.defaultLimit,
      remaining: bucket.tokens,
      reset: now + this.config.defaultWindow,
    };
  }
}
