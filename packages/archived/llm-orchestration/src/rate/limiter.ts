/**
 * Rate Limiter - Advanced rate limiting and quota management for LLM APIs
 */

import { EventEmitter } from 'eventemitter3';
import {
  RateLimitConfig,
  RateLimitQuota,
  RateLimitState,
  ThrottleConfig,
  RateLimitExceededError,
} from '../types/index.js';

// Simple queue implementation to replace p-queue
class SimpleQueue {
  private queue: Array<{ task: () => Promise<unknown>; resolve: (value: unknown) => void; reject: (error: Error) => void }> = [];
  private active = false;
  private concurrency: number;
  private pendingCount = 0;

  constructor(concurrency = 1) {
    this.concurrency = concurrency;
  }

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve: resolve as (value: unknown) => void, reject });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.active || this.pendingCount >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.active = true;
    const item = this.queue.shift();
    if (!item) {
      this.active = false;
      return;
    }

    this.pendingCount++;
    try {
      const result = await item.task();
      item.resolve(result);
    } catch (error) {
      item.reject(error as Error);
    } finally {
      this.pendingCount--;
      this.active = false;
      this.process();
    }
  }

  get size(): number {
    return this.queue.length + this.pendingCount;
  }

  get pending(): number {
    return this.pendingCount;
  }

  clear(): void {
    this.queue = [];
  }
}

// ============================================================================
// Rate Limiter Configuration
// ============================================================================

export interface RateLimiterConfig {
  enableRateLimiting: boolean;
  enableThrottling: boolean;
  defaultQuota: RateLimitConfig;
  throttleConfig: ThrottleConfig;
  cleanupInterval: number;
  stateRetentionTime: number;
}

export interface PriorityRequest {
  id: string;
  priority: number;
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

// ============================================================================
// Rate Limiter Class
// ============================================================================

export class RateLimiter {
  private quotas: Map<string, RateLimitQuota>;
  private states: Map<string, RateLimitState>;
  private queues: Map<string, SimpleQueue>;
  private priorityQueues: Map<number, SimpleQueue>;
  private events: EventEmitter;
  private config: Required<RateLimiterConfig>;
  private cleanupTimer: NodeJS.Timeout | null;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.quotas = new Map();
    this.states = new Map();
    this.queues = new Map();
    this.priorityQueues = new Map();
    this.events = new EventEmitter();
    this.cleanupTimer = null;

    this.config = {
      enableRateLimiting: config.enableRateLimiting ?? true,
      enableThrottling: config.enableThrottling ?? true,
      defaultQuota: config.defaultQuota || {
        requests: 100,
        tokens: 100000,
        window: 60000, // 1 minute
      },
      throttleConfig: config.throttleConfig || {
        strategy: 'token-bucket',
        queueSize: 100,
        queueTimeout: 30000,
        retryAfter: 1000,
      },
      cleanupInterval: config.cleanupInterval || 300000, // 5 minutes
      stateRetentionTime: config.stateRetentionTime || 3600000, // 1 hour
    };

    this.initializeDefaultQuotas();
    this.startCleanup();
  }

  // ========================================================================
  // Quota Management
  // ========================================================================

  public setQuota(quota: RateLimitQuota): void {
    this.quotas.set(quota.id, quota);
    this.events.emit('quota:set', { quotaId: quota.id });
  }

  public getQuota(quotaId: string): RateLimitQuota | undefined {
    return this.quotas.get(quotaId);
  }

  public getAllQuotas(): RateLimitQuota[] {
    return Array.from(this.quotas.values());
  }

  public updateQuota(quotaId: string, updates: Partial<RateLimitQuota>): void {
    const quota = this.quotas.get(quotaId);
    if (!quota) return;

    const updated = { ...quota, ...updates };
    this.quotas.set(quotaId, updated);
    this.events.emit('quota:updated', { quotaId, updates });
  }

  public deleteQuota(quotaId: string): boolean {
    const deleted = this.quotas.delete(quotaId);
    if (deleted) {
      this.states.delete(quotaId);
      this.events.emit('quota:deleted', { quotaId });
    }
    return deleted;
  }

  private initializeDefaultQuotas(): void {
    // Global quota
    this.setQuota({
      id: 'global',
      name: 'Global Rate Limit',
      scope: 'global',
      limits: this.config.defaultQuota,
      priority: 0,
    });

    // Provider-specific quotas
    this.setQuota({
      id: 'openai',
      name: 'OpenAI Rate Limit',
      scope: 'global',
      limits: {
        requests: 10000,
        tokens: 150000,
        window: 60000,
      },
      priority: 10,
    });

    this.setQuota({
      id: 'anthropic',
      name: 'Anthropic Rate Limit',
      scope: 'global',
      limits: {
        requests: 5000,
        tokens: 400000,
        window: 60000,
      },
      priority: 10,
    });

    this.setQuota({
      id: 'google',
      name: 'Google Rate Limit',
      scope: 'global',
      limits: {
        requests: 60,
        tokens: 100000,
        window: 60000,
      },
      priority: 10,
    });
  }

  // ========================================================================
  // Rate Limiting
  // ========================================================================

  public async checkRateLimit(
    quotaId: string,
    tokens = 0
  ): Promise<{ allowed: boolean; retryAfter?: number; resetTime?: Date }> {
    if (!this.config.enableRateLimiting) {
      return { allowed: true };
    }

    const quota = this.quotas.get(quotaId);
    if (!quota) {
      return { allowed: true };
    }

    const state = this.getOrCreateState(quotaId, quota);
    const now = Date.now();

    // Reset window if expired
    if (now - state.windowStart >= quota.limits.window) {
      state.requests = 0;
      state.tokens = 0;
      state.windowStart = now;
    }

    // Check limits
    const requestsExceeded =
      quota.limits.requests && state.requests >= quota.limits.requests;
    const tokensExceeded =
      quota.limits.tokens && state.tokens + tokens > quota.limits.tokens!;

    if (requestsExceeded || tokensExceeded) {
      const resetTime = new Date(state.windowStart + quota.limits.window);
      const retryAfter = resetTime.getTime() - now;

      this.events.emit('rate-limit:exceeded', {
        quotaId,
        state,
        resetTime,
      });

      return {
        allowed: false,
        retryAfter,
        resetTime,
      };
    }

    return { allowed: true };
  }

  public async recordRequest(
    quotaId: string,
    tokens = 0,
    cost = 0
  ): Promise<void> {
    const quota = this.quotas.get(quotaId);
    if (!quota) return;

    const state = this.getOrCreateState(quotaId, quota);
    const now = Date.now();

    // Reset window if expired
    if (now - state.windowStart >= quota.limits.window) {
      state.requests = 0;
      state.tokens = 0;
      state.cost = 0;
      state.windowStart = now;
    }

    // Update state
    state.requests++;
    state.tokens += tokens;
    state.cost += cost;
    state.lastRequest = now;

    this.events.emit('rate-limit:recorded', {
      quotaId,
      state,
    });
  }

  public async acquireSlot(
    quotaId: string,
    tokens = 0,
    priority = 0
  ): Promise<void> {
    const check = await this.checkRateLimit(quotaId, tokens);

    if (!check.allowed) {
      if (this.config.enableThrottling) {
        // Queue the request
        return this.throttleRequest(quotaId, tokens, priority, check.retryAfter);
      } else {
        throw new RateLimitExceededError(
          quotaId,
          this.quotas.get(quotaId)?.limits.requests || 0,
          check.resetTime
        );
      }
    }

    // Record the request
    await this.recordRequest(quotaId, tokens);
  }

  // ========================================================================
  // Throttling
  // ========================================================================

  private async throttleRequest(
    quotaId: string,
    tokens: number,
    priority: number,
    retryAfter?: number
  ): Promise<void> {
    const quota = this.quotas.get(quotaId);
    if (!quota) {
      throw new RateLimitExceededError(quotaId, 0, new Date());
    }

    // Get or create queue for this quota
    let queue = this.queues.get(quotaId);
    if (!queue) {
      queue = new SimpleQueue(1);
      this.queues.set(quotaId, queue);
    }

    // Add to queue
    return queue.add(async () => {
      // Wait for retry time
      if (retryAfter) {
        await this.sleep(retryAfter);
      }

      // Try again
      const check = await this.checkRateLimit(quotaId, tokens);
      if (!check.allowed) {
        // Still rate limited, continue waiting
        return this.throttleRequest(quotaId, tokens, priority, check.retryAfter);
      }

      // Record the request
      await this.recordRequest(quotaId, tokens);
    });
  }

  public async executeWithRateLimit<T>(
    quotaId: string,
    fn: () => Promise<T>,
    tokens = 0,
    priority = 0
  ): Promise<T> {
    // Acquire slot
    await this.acquireSlot(quotaId, tokens, priority);

    // Execute function
    try {
      const result = await fn();
      return result;
    } catch (error) {
      // Revert the request count on error
      const state = this.states.get(quotaId);
      if (state) {
        state.requests = Math.max(0, state.requests - 1);
        state.tokens = Math.max(0, state.tokens - tokens);
      }
      throw error;
    }
  }

  // ========================================================================
  // Priority Queuing
  // ========================================================================

  public async executeWithPriority<T>(
    priority: number,
    fn: () => Promise<T>
  ): Promise<T> {
    // Get or create priority queue
    let queue = this.priorityQueues.get(priority);
    if (!queue) {
      queue = new SimpleQueue(1);
      this.priorityQueues.set(priority, queue);
    }

    return queue.add(fn);
  }

  // ========================================================================
  // State Management
  // ========================================================================

  private getOrCreateState(
    quotaId: string,
    quota: RateLimitQuota
  ): RateLimitState {
    if (!this.states.has(quotaId)) {
      this.states.set(quotaId, {
        requests: 0,
        tokens: 0,
        cost: 0,
        windowStart: Date.now(),
        lastRequest: Date.now(),
      });
    }
    return this.states.get(quotaId)!;
  }

  public getState(quotaId: string): RateLimitState | undefined {
    return this.states.get(quotaId);
  }

  public getAllStates(): Map<string, RateLimitState> {
    return new Map(this.states);
  }

  public resetState(quotaId: string): void {
    this.states.delete(quotaId);
    this.events.emit('rate-limit:reset', { quotaId });
  }

  public resetAllStates(): void {
    this.states.clear();
    this.events.emit('rate-limit:reset-all');
  }

  // ========================================================================
  // Status and Monitoring
  // ========================================================================

  public getQuotaStatus(quotaId: string): QuotaStatus | undefined {
    const quota = this.quotas.get(quotaId);
    const state = this.states.get(quotaId);

    if (!quota || !state) return undefined;

    const now = Date.now();
    const windowElapsed = now - state.windowStart;
    const windowRemaining = quota.limits.window - windowElapsed;

    return {
      quotaId: quota.id,
      quotaName: quota.name,
      scope: quota.scope,
      limits: quota.limits,
      usage: {
        requests: state.requests,
        tokens: state.tokens,
        cost: state.cost,
      },
      remaining: {
        requests: quota.limits.requests
          ? quota.limits.requests - state.requests
          : undefined,
        tokens: quota.limits.tokens
          ? quota.limits.tokens! - state.tokens
          : undefined,
      },
      windowReset: new Date(state.windowStart + quota.limits.window),
      windowRemaining,
      utilization: this.calculateUtilization(quota, state),
    };
  }

  public getAllStatuses(): QuotaStatus[] {
    const statuses: QuotaStatus[] = [];

    for (const quotaId of this.quotas.keys()) {
      const status = this.getQuotaStatus(quotaId);
      if (status) {
        statuses.push(status);
      }
    }

    return statuses;
  }

  private calculateUtilization(
    quota: RateLimitQuota,
    state: RateLimitState
  ): number {
    let utilization = 0;

    if (quota.limits.requests) {
      utilization += state.requests / quota.limits.requests;
    }

    if (quota.limits.tokens) {
      utilization += state.tokens / quota.limits.tokens!;
    }

    const divisor =
      (quota.limits.requests ? 1 : 0) + (quota.limits.tokens ? 1 : 0);

    return divisor > 0 ? utilization / divisor : 0;
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();

    // Clean up old states
    for (const [quotaId, state] of this.states) {
      const age = now - state.lastRequest;
      if (age > this.config.stateRetentionTime) {
        this.states.delete(quotaId);
      }
    }

    // Clean up empty queues
    for (const [quotaId, queue] of this.queues) {
      if (queue.size === 0 && queue.pending === 0) {
        this.queues.delete(quotaId);
      }
    }

    // Clean up empty priority queues
    for (const [priority, queue] of this.priorityQueues) {
      if (queue.size === 0 && queue.pending === 0) {
        this.priorityQueues.delete(priority);
      }
    }

    this.events.emit('rate-limit:cleanup');
  }

  public stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ========================================================================
  // Event Handling
  // ========================================================================

  public on(event: string, listener: (...args: unknown[]) => void): void {
    this.events.on(event, listener);
  }

  public off(event: string, listener: (...args: unknown[]) => void): void {
    this.events.off(event, listener);
  }

  // ========================================================================
  // Analytics
  // ========================================================================

  public getAnalytics() {
    return {
      totalQuotas: this.quotas.size,
      activeStates: this.states.size,
      activeQueues: this.queues.size,
      activePriorityQueues: this.priorityQueues.size,
      statuses: this.getAllStatuses(),
      totalPendingRequests: Array.from(this.queues.values()).reduce(
        (sum, queue) => sum + queue.pending,
        0
      ),
      totalQueuedRequests: Array.from(this.queues.values()).reduce(
        (sum, queue) => sum + queue.size,
        0
      ),
    };
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface QuotaStatus {
  quotaId: string;
  quotaName: string;
  scope: string;
  limits: RateLimitConfig;
  usage: {
    requests: number;
    tokens: number;
    cost: number;
  };
  remaining: {
    requests?: number;
    tokens?: number;
  };
  windowReset: Date;
  windowRemaining: number;
  utilization: number;
}
