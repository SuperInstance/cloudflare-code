/**
 * Traffic shaping and rate limiting system
 * Manages traffic flow, throttling, and prioritization
 */

import type {
  Region,
  TrafficRule,
  TrafficShapingPolicy,
  TrafficAction,
  ThrottleAction,
  RedirectAction,
  PrioritizeAction,
  BlockAction,
  ThrottlingConfig,
  QueueManagementConfig,
  DDoSProtectionConfig,
  RoutingContext,
} from '../types/index.js';
import { ThrottledError } from '../types/index.js';

export interface TrafficShaperConfig {
  defaultLimitPerSecond: number;
  defaultLimitPerMinute: number;
  defaultBurstSize: number;
  enableRateLimiting: boolean;
  enableThrottling: boolean;
  enablePrioritization: boolean;
  enableDDoSProtection: boolean;
}

export interface RateLimitState {
  count: number;
  windowStart: number;
  burstTokens: number;
  lastRefill: number;
}

export interface QueueEntry {
  id: string;
  context: RoutingContext;
  priority: number;
  queue: 'high' | 'medium' | 'low';
  timestamp: number;
  timeout: number;
  retries: number;
}

/**
 * Traffic shaper for managing request flow
 */
export class TrafficShaper {
  private policies: Map<string, TrafficShapingPolicy>;
  private rateLimitState: Map<string, RateLimitState>;
  private queues: Map<string, QueueEntry[]>;
  private throttlingConfig: ThrottlingConfig;
  private queueConfig: QueueManagementConfig;
  private ddosConfig: DDoSProtectionConfig;
  private config: TrafficShaperConfig;

  constructor(config: Partial<TrafficShaperConfig> = {}) {
    this.policies = new Map();
    this.rateLimitState = new Map();
    this.queues = new Map();
    this.config = {
      defaultLimitPerSecond: 100,
      defaultLimitPerMinute: 1000,
      defaultBurstSize: 10,
      enableRateLimiting: true,
      enableThrottling: true,
      enablePrioritization: true,
      enableDDoSProtection: true,
      ...config,
    };

    this.throttlingConfig = {
      enabled: true,
      globalLimit: 10000,
      perRegionLimit: new Map(),
      perUserLimit: 100,
      burstAllowance: 10,
      rateLimitWindow: 60000, // 1 minute
    };

    this.queueConfig = {
      maxQueueSize: 10000,
      priorityLevels: 3,
      queueTimeout: 30000, // 30 seconds
      requeuePolicy: 'fallback',
    };

    this.ddosConfig = {
      enabled: true,
      threshold: 1000, // requests per second
      burstThreshold: 2000,
      mitigationAction: 'throttle',
      whitelist: [],
      blacklist: [],
    };
  }

  /**
   * Evaluate routing context against traffic policies
   */
  async evaluate(context: RoutingContext): Promise<{
    allowed: boolean;
    action?: TrafficAction;
    reason?: string;
  }> {
    // Check DDoS protection first
    if (this.config.enableDDoSProtection && this.ddosConfig.enabled) {
      const ddosResult = await this.checkDDoS(context);
      if (!ddosResult.allowed) {
        return ddosResult;
      }
    }

    // Check rate limiting
    if (this.config.enableRateLimiting) {
      const rateLimitResult = await this.checkRateLimit(context);
      if (!rateLimitResult.allowed) {
        return rateLimitResult;
      }
    }

    // Evaluate traffic rules
    for (const [policyId, policy] of this.policies) {
      if (!policy.enabled) continue;

      for (const rule of policy.rules) {
        if (!rule.enabled) continue;

        if (await this.matchesRule(context, rule)) {
          return {
            allowed: rule.action.type !== 'block',
            action: rule.action,
            reason: `Matched rule ${rule.id} in policy ${policyId}`,
          };
        }
      }
    }

    // Default: allow
    return { allowed: true };
  }

  /**
   * Check if context matches a traffic rule
   */
  private async matchesRule(
    context: RoutingContext,
    rule: TrafficRule
  ): Promise<boolean> {
    const { condition } = rule;

    switch (condition.type) {
      case 'region':
        return this.matchRegion(context, condition);

      case 'latency':
        return this.matchLatency(context, condition);

      case 'capacity':
        return this.matchCapacity(context, condition);

      case 'user':
        return this.matchUser(context, condition);

      case 'composite':
        return this.matchComposite(context, condition);

      default:
        return false;
    }
  }

  /**
   * Match region condition
   */
  private matchRegion(context: RoutingContext, condition: any): boolean {
    const userRegion = context.sourceLocation.continent;

    switch (condition.operator) {
      case 'eq':
        return userRegion === condition.value;
      case 'ne':
        return userRegion !== condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(userRegion);
      default:
        return false;
    }
  }

  /**
   * Match latency condition
   */
  private matchLatency(context: RoutingContext, condition: any): boolean {
    // This would check against actual latency metrics
    // For now, return false
    return false;
  }

  /**
   * Match capacity condition
   */
  private matchCapacity(context: RoutingContext, condition: any): boolean {
    // This would check against actual capacity metrics
    // For now, return false
    return false;
  }

  /**
   * Match user condition
   */
  private matchUser(context: RoutingContext, condition: any): boolean {
    if (!context.userId) return false;

    switch (condition.operator) {
      case 'eq':
        return context.userId === condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(context.userId);
      case 'contains':
        return context.userId.includes(condition.value);
      default:
        return false;
    }
  }

  /**
   * Match composite condition (AND/OR logic)
   */
  private async matchComposite(
    context: RoutingContext,
    condition: any
  ): Promise<boolean> {
    if (!condition.conditions || !Array.isArray(condition.conditions)) {
      return false;
    }

    const results = await Promise.all(
      condition.conditions.map((c: any) => this.matchesRule(context, { ...condition, condition: c }))
    );

    // Default to AND logic
    return results.every(r => r);
  }

  /**
   * Check rate limit for a request
   */
  private async checkRateLimit(context: RoutingContext): Promise<{
    allowed: boolean;
    action?: TrafficAction;
    reason?: string;
  }> {
    const key = this.getRateLimitKey(context);
    const now = Date.now();

    let state = this.rateLimitState.get(key);

    if (!state || now - state.windowStart >= this.throttlingConfig.rateLimitWindow) {
      // Initialize or reset state
      state = {
        count: 0,
        windowStart: now,
        burstTokens: this.config.defaultBurstSize,
        lastRefill: now,
      };
      this.rateLimitState.set(key, state);
    }

    // Check burst tokens first
    if (state.burstTokens > 0) {
      state.burstTokens--;
      state.count++;
      return { allowed: true };
    }

    // Check rate limit
    if (state.count >= this.config.defaultLimitPerMinute) {
      return {
        allowed: false,
        action: {
          type: 'throttle',
          maxRequestsPerSecond: this.config.defaultLimitPerSecond,
          maxConcurrentRequests: this.config.defaultLimitPerSecond * 5,
          burstSize: this.config.defaultBurstSize,
        } as ThrottleAction,
        reason: `Rate limit exceeded: ${state.count}/${this.config.defaultLimitPerMinute}`,
      };
    }

    state.count++;
    return { allowed: true };
  }

  /**
   * Check for DDoS attack patterns
   */
  private async checkDDoS(context: RoutingContext): Promise<{
    allowed: boolean;
    action?: TrafficAction;
    reason?: string;
  }> {
    const ip = this.extractIP(context);

    // Check blacklist
    if (this.ddosConfig.blacklist.includes(ip)) {
      return {
        allowed: false,
        action: {
          type: 'block',
          reason: 'IP blacklisted',
          statusCode: 403,
        } as BlockAction,
        reason: 'IP address is blacklisted',
      };
    }

    // Check whitelist
    if (this.ddosConfig.whitelist.includes(ip)) {
      return { allowed: true };
    }

    // Check request rate from this IP
    const key = `ddos:${ip}`;
    const state = this.rateLimitState.get(key);

    if (state && state.count > this.ddosConfig.threshold) {
      const action: TrafficAction = this.ddosConfig.mitigationAction === 'throttle'
        ? {
            type: 'throttle',
            maxRequestsPerSecond: Math.floor(this.ddosConfig.threshold / 10),
            maxConcurrentRequests: 50,
            burstSize: 5,
          } as ThrottleAction
        : {
            type: 'block',
            reason: 'DDoS protection triggered',
            statusCode: 429,
          } as BlockAction;

      return {
        allowed: false,
        action,
        reason: 'DDoS protection triggered',
      };
    }

    return { allowed: true };
  }

  /**
   * Add request to priority queue
   */
  async enqueue(context: RoutingContext, priority: number = 5): Promise<string> {
    const entryId = `${context.requestId}-${Date.now()}`;

    const entry: QueueEntry = {
      id: entryId,
      context,
      priority,
      queue: this.getQueueLevel(priority),
      timestamp: Date.now(),
      timeout: this.queueConfig.queueTimeout,
      retries: 0,
    };

    const region = context.sourceLocation.continent;
    const queue = this.queues.get(region) || [];

    // Check queue size limit
    if (queue.length >= this.queueConfig.maxQueueSize) {
      // Remove lowest priority entry
      queue.sort((a, b) => a.priority - b.priority);
      queue.shift();
    }

    queue.push(entry);

    // Sort by priority
    queue.sort((a, b) => b.priority - a.priority);

    this.queues.set(region, queue);

    return entryId;
  }

  /**
   * Get next request from queue
   */
  async dequeue(region: Region): Promise<QueueEntry | null> {
    const queue = this.queues.get(region);
    if (!queue || queue.length === 0) {
      return null;
    }

    // Remove timed out entries
    const now = Date.now();
    const validEntries = queue.filter(e => now - e.timestamp < e.timeout);

    if (validEntries.length === 0) {
      this.queues.set(region, []);
      return null;
    }

    // Get highest priority entry
    const entry = validEntries[0];

    // Remove from queue
    const index = queue.findIndex(e => e.id === entry.id);
    if (index !== -1) {
      queue.splice(index, 1);
    }

    this.queues.set(region, queue);

    return entry;
  }

  /**
   * Get queue level based on priority
   */
  private getQueueLevel(priority: number): 'high' | 'medium' | 'low' {
    if (priority >= 8) return 'high';
    if (priority >= 5) return 'medium';
    return 'low';
  }

  /**
   * Get rate limit key for context
   */
  private getRateLimitKey(context: RoutingContext): string {
    if (context.userId) {
      return `user:${context.userId}`;
    }

    const ip = this.extractIP(context);
    return `ip:${ip}`;
  }

  /**
   * Extract IP from context
   */
  private extractIP(context: RoutingContext): string {
    // In a real implementation, this would extract from the request
    return '0.0.0.0';
  }

  /**
   * Add or update traffic policy
   */
  setPolicy(policy: TrafficShapingPolicy): void {
    this.policies.set(policy.id, policy);
  }

  /**
   * Remove traffic policy
   */
  removePolicy(policyId: string): void {
    this.policies.delete(policyId);
  }

  /**
   * Get policy by ID
   */
  getPolicy(policyId: string): TrafficShapingPolicy | null {
    return this.policies.get(policyId) || null;
  }

  /**
   * Get all policies
   */
  getAllPolicies(): TrafficShapingPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Update throttling configuration
   */
  updateThrottlingConfig(config: Partial<ThrottlingConfig>): void {
    this.throttlingConfig = { ...this.throttlingConfig, ...config };
  }

  /**
   * Update queue configuration
   */
  updateQueueConfig(config: Partial<QueueManagementConfig>): void {
    this.queueConfig = { ...this.queueConfig, ...config };
  }

  /**
   * Update DDoS configuration
   */
  updateDDoSConfig(config: Partial<DDoSProtectionConfig>): void {
    this.ddosConfig = { ...this.ddosConfig, ...config };
  }

  /**
   * Add IP to whitelist
   */
  addToWhitelist(ip: string): void {
    this.ddosConfig.whitelist.push(ip);
  }

  /**
   * Add IP to blacklist
   */
  addToBlacklist(ip: string): void {
    this.ddosConfig.blacklist.push(ip);
  }

  /**
   * Remove IP from whitelist
   */
  removeFromWhitelist(ip: string): void {
    this.ddosConfig.whitelist = this.ddosConfig.whitelist.filter(
      listed => listed !== ip
    );
  }

  /**
   * Remove IP from blacklist
   */
  removeFromBlacklist(ip: string): void {
    this.ddosConfig.blacklist = this.ddosConfig.blacklist.filter(
      listed => listed !== ip
    );
  }

  /**
   * Get queue statistics
   */
  getQueueStats(region: Region): {
    size: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
    averageWaitTime: number;
  } {
    const queue = this.queues.get(region) || [];
    const now = Date.now();

    const high = queue.filter(e => e.queue === 'high').length;
    const medium = queue.filter(e => e.queue === 'medium').length;
    const low = queue.filter(e => e.queue === 'low').length;

    const avgWait = queue.length > 0
      ? queue.reduce((sum, e) => sum + (now - e.timestamp), 0) / queue.length
      : 0;

    return {
      size: queue.length,
      highPriority: high,
      mediumPriority: medium,
      lowPriority: low,
      averageWaitTime: Math.round(avgWait),
    };
  }

  /**
   * Get rate limit statistics
   */
  getRateLimitStats(): {
    totalTracked: number;
    overLimit: number;
    averageUsage: number;
  } {
    const states = Array.from(this.rateLimitState.values());
    const overLimit = states.filter(s => s.count >= this.config.defaultLimitPerMinute).length;
    const avgUsage = states.length > 0
      ? states.reduce((sum, s) => sum + s.count, 0) / states.length
      : 0;

    return {
      totalTracked: states.length,
      overLimit,
      averageUsage: Math.round(avgUsage),
    };
  }

  /**
   * Clear old rate limit states
   */
  clearExpiredStates(): void {
    const now = Date.now();
    const windowStart = now - this.throttlingConfig.rateLimitWindow;

    for (const [key, state] of this.rateLimitState) {
      if (state.windowStart < windowStart) {
        this.rateLimitState.delete(key);
      }
    }
  }

  /**
   * Clear all queues
   */
  clearQueues(): void {
    this.queues.clear();
  }

  /**
   * Clear queue for specific region
   */
  clearRegionQueue(region: Region): void {
    this.queues.delete(region);
  }
}
