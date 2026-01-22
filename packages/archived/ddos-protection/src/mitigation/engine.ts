// @ts-nocheck
/**
 * Mitigation Engine
 * Executes mitigation actions to block or limit malicious traffic
 */

import type {
  RequestData,
  MitigationAction,
  MitigationResult,
  MitigationActionType,
  MitigationMetrics,
  TrafficShapingParams,
  RateLimitConfig,
  IPReputation
} from '../types';
import { IPUtils, TimeUtils, PerformanceUtils } from '../utils';

/**
 * Mitigation rule
 */
interface MitigationRule {
  id: string;
  name: string;
  condition: (request: RequestData) => boolean;
  action: MitigationActionType;
  parameters: Record<string, any>;
  priority: number;
  enabled: boolean;
  createdAt: number;
}

/**
 * Block list entry
 */
interface BlockListEntry {
  target: string; // IP, CIDR, or pattern
  type: 'ip' | 'cidr' | 'user-agent' | 'country';
  reason: string;
  expiresAt: number;
  createdAt: number;
}

/**
 * Rate limit state
 */
interface RateLimitState {
  tokens: number;
  lastRefill: number;
  blocked: number;
  allowed: number;
}

/**
 * Mitigation engine configuration
 */
interface MitigationConfig {
  mode: 'monitor' | 'mitigate' | 'aggressive';
  defaultRateLimit: RateLimitConfig;
  enableRateLimiting: boolean;
  enableIPBlocking: boolean;
  enableGeoBlocking: boolean;
  enableChallenge: boolean;
  enableBlackholing: boolean;
  blockTTL: number; // Default block duration in ms
  maxBlocks: number;
}

/**
 * Mitigation decision
 */
export interface MitigationDecision {
  allow: boolean;
  action?: MitigationAction;
  reason?: string;
  challengeRequired?: boolean;
}

/**
 * Mitigation Engine class
 */
export class MitigationEngine {
  private config: MitigationConfig;
  private blockList: Map<string, BlockListEntry>;
  private allowList: Map<string, BlockListEntry>;
  private rateLimitStates: Map<string, RateLimitState>;
  private customRules: Map<string, MitigationRule>;
  private mitigationHistory: MitigationResult[];
  private metrics: MitigationMetrics;
  private readonly MAX_HISTORY = 1000;

  constructor(config: Partial<MitigationConfig> = {}) {
    this.config = {
      mode: config.mode || 'mitigate',
      defaultRateLimit: config.defaultRateLimit || {
        requestsPerSecond: 100,
        requestsPerMinute: 1000,
        requestsPerHour: 10000,
        burstSize: 200,
        windowSize: 60
      },
      enableRateLimiting: config.enableRateLimiting !== false,
      enableIPBlocking: config.enableIPBlocking !== false,
      enableGeoBlocking: config.enableGeoBlocking !== false,
      enableChallenge: config.enableChallenge !== false,
      enableBlackholing: config.enableBlackholing !== false,
      blockTTL: config.blockTTL || 3600000, // 1 hour default
      maxBlocks: config.maxBlocks || 10000
    };

    this.blockList = new Map();
    this.allowList = new Map();
    this.rateLimitStates = new Map();
    this.customRules = new Map();
    this.mitigationHistory = [];

    this.metrics = {
      trafficBlocked: 0,
      trafficAllowed: 0,
      averageLatency: 0,
      cpuUsage: 0,
      memoryUsage: 0
    };

    this.startCleanupTimer();
  }

  /**
   * Process request through mitigation engine
   */
  async processRequest(request: RequestData, recommendedActions?: MitigationAction[]): Promise<MitigationDecision> {
    const endTimer = PerformanceUtils.hrtime();
    let decision: MitigationDecision = { allow: true };

    try {
      // Check if in monitor mode
      if (this.config.mode === 'monitor') {
        decision = { allow: true };
      } else {
        // Apply mitigation checks in order
        decision = await this.applyMitigationChecks(request, recommendedActions);
      }

      // Update metrics
      if (decision.allow) {
        this.metrics.trafficAllowed++;
      } else {
        this.metrics.trafficBlocked++;
      }

      // Record mitigation action
      if (decision.action) {
        this.recordMitigation(decision.action, true, endTimer());
      }

      return decision;
    } catch (error) {
      // On error, allow request (fail open)
      console.error('Mitigation engine error:', error);
      return { allow: true, reason: 'mitigation_error' };
    }
  }

  /**
   * Apply mitigation checks
   */
  private async applyMitigationChecks(
    request: RequestData,
    recommendedActions?: MitigationAction[]
  ): Promise<MitigationDecision> {
    // 1. Check allow list (whitelist)
    if (this.isAllowed(request)) {
      return { allow: true, reason: 'whitelisted' };
    }

    // 2. Check block list
    const blockResult = this.checkBlockList(request);
    if (blockResult.blocked) {
      return {
        allow: false,
        action: blockResult.action,
        reason: blockResult.reason
      };
    }

    // 3. Apply custom rules
    const ruleResult = this.applyCustomRules(request);
    if (ruleResult) {
      return ruleResult;
    }

    // 4. Apply rate limiting
    if (this.config.enableRateLimiting) {
      const rateLimitResult = this.applyRateLimit(request);
      if (!rateLimitResult.allow) {
        return rateLimitResult;
      }
    }

    // 5. Apply geo-blocking
    if (this.config.enableGeoBlocking) {
      const geoBlockResult = this.applyGeoBlocking(request);
      if (!geoBlockResult.allow) {
        return geoBlockResult;
      }
    }

    // 6. Apply recommended actions from attack detector
    if (recommendedActions && recommendedActions.length > 0) {
      const actionResult = this.applyRecommendedActions(request, recommendedActions);
      if (!actionResult.allow) {
        return actionResult;
      }
    }

    // Allow request
    return { allow: true };
  }

  /**
   * Check if request is allowed (whitelisted)
   */
  private isAllowed(request: RequestData): boolean {
    // Check IP allow list
    const ipEntry = this.allowList.get(request.ip);
    if (ipEntry && ipEntry.expiresAt > TimeUtils.now()) {
      return true;
    }

    // Check CIDR allow list
    for (const [key, entry] of this.allowList.entries()) {
      if (entry.type === 'cidr' && entry.expiresAt > TimeUtils.now()) {
        if (IPUtils.isIPInCIDR(request.ip, entry.target)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check block list
   */
  private checkBlockList(request: RequestData): {
    blocked: boolean;
    action?: MitigationAction;
    reason?: string;
  } {
    const now = TimeUtils.now();

    // Check IP block list
    const ipEntry = this.blockList.get(request.ip);
    if (ipEntry && ipEntry.expiresAt > now) {
      return {
        blocked: true,
        action: {
          type: 'ip_block' as MitigationActionType,
          target: request.ip,
          parameters: { reason: ipEntry.reason },
          timestamp: now
        },
        reason: `IP blocked: ${ipEntry.reason}`
      };
    }

    // Check CIDR block list
    for (const [key, entry] of this.blockList.entries()) {
      if (entry.type === 'cidr' && entry.expiresAt > now) {
        if (IPUtils.isIPInCIDR(request.ip, entry.target)) {
          return {
            blocked: true,
            action: {
              type: 'ip_block' as MitigationActionType,
              target: request.ip,
              parameters: { reason: entry.reason },
              timestamp: now
            },
            reason: `CIDR blocked: ${entry.reason}`
          };
        }
      }
    }

    // Check user agent block list
    for (const [key, entry] of this.blockList.entries()) {
      if (entry.type === 'user-agent' && entry.expiresAt > now) {
        if (request.userAgent.includes(entry.target)) {
          return {
            blocked: true,
            action: {
              type: 'ip_block' as MitigationActionType,
              target: request.ip,
              parameters: { reason: entry.reason },
              timestamp: now
            },
            reason: `User agent blocked: ${entry.reason}`
          };
        }
      }
    }

    return { blocked: false };
  }

  /**
   * Apply custom rules
   */
  private applyCustomRules(request: RequestData): MitigationDecision | null {
    const rules = Array.from(this.customRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of rules) {
      try {
        if (rule.condition(request)) {
          return {
            allow: false,
            action: {
              type: rule.action,
              target: request.ip,
              parameters: rule.parameters,
              priority: rule.priority,
              timestamp: TimeUtils.now()
            },
            reason: `Rule matched: ${rule.name}`
          };
        }
      } catch (error) {
        console.error(`Error applying rule ${rule.name}:`, error);
      }
    }

    return null;
  }

  /**
   * Apply rate limiting using token bucket algorithm
   */
  private applyRateLimit(request: RequestData): MitigationDecision {
    const key = `rate:${request.ip}`;
    const now = TimeUtils.now();
    const config = this.config.defaultRateLimit;

    // Get or create rate limit state
    let state = this.rateLimitStates.get(key);
    if (!state) {
      state = {
        tokens: config.burstSize,
        lastRefill: now,
        blocked: 0,
        allowed: 0
      };
      this.rateLimitStates.set(key, state);
    }

    // Refill tokens
    const timePassed = now - state.lastRefill;
    const refillRate = config.requestsPerSecond;
    const tokensToAdd = (timePassed / 1000) * refillRate;
    state.tokens = Math.min(config.burstSize, state.tokens + tokensToAdd);
    state.lastRefill = now;

    // Check if request can be allowed
    if (state.tokens >= 1) {
      state.tokens--;
      state.allowed++;
      return { allow: true };
    } else {
      state.blocked++;
      return {
        allow: false,
        action: {
          type: 'rate_limit' as MitigationActionType,
          target: request.ip,
          parameters: {
            limit: config.requestsPerSecond,
            retryAfter: Math.ceil(1000 / refillRate)
          },
          timestamp: now
        },
        reason: 'Rate limit exceeded'
      };
    }
  }

  /**
   * Apply geo-blocking
   */
  private applyGeoBlocking(request: RequestData): MitigationDecision {
    if (!request.geo || !request.geo.country) {
      return { allow: true };
    }

    const country = request.geo.country;
    const blockKey = `country:${country}`;

    const entry = this.blockList.get(blockKey);
    if (entry && entry.type === 'country' && entry.expiresAt > TimeUtils.now()) {
      return {
        allow: false,
        action: {
          type: 'geo_block' as MitigationActionType,
          target: country,
          parameters: { reason: entry.reason },
          timestamp: TimeUtils.now()
        },
        reason: `Country blocked: ${entry.reason}`
      };
    }

    return { allow: true };
  }

  /**
   * Apply recommended mitigation actions
   */
  private applyRecommendedActions(
    request: RequestData,
    actions: MitigationAction[]
  ): MitigationDecision {
    // Sort actions by priority
    const sortedActions = actions.sort((a, b) => a.priority - b.priority);

    for (const action of sortedActions) {
      const result = this.executeMitigationAction(request, action);
      if (!result.allow) {
        return result;
      }
    }

    return { allow: true };
  }

  /**
   * Execute a mitigation action
   */
  private executeMitigationAction(
    request: RequestData,
    action: MitigationAction
  ): MitigationDecision {
    const target = action.target;

    switch (action.type) {
      case 'ip_block':
        return this.blockIP(request.ip, action.parameters);

      case 'geo_block':
        if (request.geo) {
          return this.blockCountry(request.geo.country, action.parameters);
        }
        return { allow: true };

      case 'rate_limit':
        return this.applyCustomRateLimit(request.ip, action.parameters);

      case 'challenge':
      case 'captcha':
      case 'js_challenge':
        return {
          allow: false,
          action,
          reason: 'Challenge required',
          challengeRequired: true
        };

      case 'blackhole':
        if (this.config.enableBlackholing) {
          return {
            allow: false,
            action,
            reason: 'Traffic blackholed'
          };
        }
        return { allow: true };

      default:
        return { allow: true };
    }
  }

  /**
   * Block an IP address
   */
  blockIP(ip: string, parameters: Record<string, any> = {}): MitigationDecision {
    const duration = parameters.duration || this.config.blockTTL;
    const reason = parameters.reason || 'Manual block';

    this.blockList.set(ip, {
      target: ip,
      type: 'ip',
      reason,
      expiresAt: TimeUtils.now() + duration,
      createdAt: TimeUtils.now()
    });

    return {
      allow: false,
      action: {
        type: 'ip_block' as MitigationActionType,
        target: ip,
        parameters: { duration, reason },
        timestamp: TimeUtils.now()
      },
      reason: `IP blocked: ${reason}`
    };
  }

  /**
   * Block a CIDR range
   */
  blockCIDR(cidr: string, parameters: Record<string, any> = {}): void {
    const duration = parameters.duration || this.config.blockTTL;
    const reason = parameters.reason || 'Manual block';

    this.blockList.set(cidr, {
      target: cidr,
      type: 'cidr',
      reason,
      expiresAt: TimeUtils.now() + duration,
      createdAt: TimeUtils.now()
    });
  }

  /**
   * Block a country
   */
  blockCountry(country: string, parameters: Record<string, any> = {}): MitigationDecision {
    const duration = parameters.duration || this.config.blockTTL;
    const reason = parameters.reason || 'Geo block';

    const key = `country:${country}`;
    this.blockList.set(key, {
      target: country,
      type: 'country',
      reason,
      expiresAt: TimeUtils.now() + duration,
      createdAt: TimeUtils.now()
    });

    return {
      allow: false,
      action: {
        type: 'geo_block' as MitigationActionType,
        target: country,
        parameters: { duration, reason },
        timestamp: TimeUtils.now()
      },
      reason: `Country blocked: ${reason}`
    };
  }

  /**
   * Apply custom rate limit
   */
  private applyCustomRateLimit(
    ip: string,
    parameters: Record<string, any>
  ): MitigationDecision {
    // For now, use default rate limiting logic
    // In production, would create custom rate limit state
    return this.applyRateLimit({ ip } as RequestData);
  }

  /**
   * Allow an IP address (whitelist)
   */
  allowIP(ip: string, duration?: number): void {
    this.allowList.set(ip, {
      target: ip,
      type: 'ip',
      reason: 'Whitelisted',
      expiresAt: TimeUtils.now() + (duration || 86400000), // 24 hours default
      createdAt: TimeUtils.now()
    });
  }

  /**
   * Unblock an IP address
   */
  unblockIP(ip: string): boolean {
    return this.blockList.delete(ip);
  }

  /**
   * Unblock a country
   */
  unblockCountry(country: string): boolean {
    const key = `country:${country}`;
    return this.blockList.delete(key);
  }

  /**
   * Add custom rule
   */
  addRule(rule: Omit<MitigationRule, 'id' | 'createdAt'>): string {
    const id = `rule:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const fullRule: MitigationRule = {
      ...rule,
      id,
      createdAt: TimeUtils.now()
    };

    this.customRules.set(id, fullRule);
    return id;
  }

  /**
   * Remove rule
   */
  removeRule(id: string): boolean {
    return this.customRules.delete(id);
  }

  /**
   * Enable/disable rule
   */
  toggleRule(id: string, enabled: boolean): boolean {
    const rule = this.customRules.get(id);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Record mitigation action
   */
  private recordMitigation(
    action: MitigationAction,
    success: boolean,
    timeToMitigate: number
  ): void {
    const result: MitigationResult = {
      action,
      success,
      timeToMitigate,
      affectedRequests: 1,
      falsePositiveRate: 0,
      timestamp: TimeUtils.now(),
      metrics: {
        trafficBlocked: success ? 1 : 0,
        trafficAllowed: success ? 0 : 1,
        averageLatency: timeToMitigate,
        cpuUsage: this.metrics.cpuUsage,
        memoryUsage: this.metrics.memoryUsage
      }
    };

    this.mitigationHistory.push(result);

    // Trim history if needed
    if (this.mitigationHistory.length > this.MAX_HISTORY) {
      this.mitigationHistory.shift();
    }
  }

  /**
   * Start cleanup timer for expired entries
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Run every minute
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = TimeUtils.now();

    // Clean block list
    for (const [key, entry] of this.blockList.entries()) {
      if (entry.expiresAt < now) {
        this.blockList.delete(key);
      }
    }

    // Clean allow list
    for (const [key, entry] of this.allowList.entries()) {
      if (entry.expiresAt < now) {
        this.allowList.delete(key);
      }
    }

    // Clean rate limit states (older than 1 hour)
    for (const [key, state] of this.rateLimitStates.entries()) {
      if (now - state.lastRefill > 3600000) {
        this.rateLimitStates.delete(key);
      }
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): MitigationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get mitigation history
   */
  getHistory(limit?: number): MitigationResult[] {
    const history = [...this.mitigationHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get block list
   */
  getBlockList(): BlockListEntry[] {
    return Array.from(this.blockList.values());
  }

  /**
   * Get allow list
   */
  getAllowList(): BlockListEntry[] {
    return Array.from(this.allowList.values());
  }

  /**
   * Get custom rules
   */
  getRules(): MitigationRule[] {
    return Array.from(this.customRules.values());
  }

  /**
   * Get rate limit stats for IP
   */
  getRateLimitStats(ip: string): { allowed: number; blocked: number; tokens: number } | null {
    const state = this.rateLimitStates.get(`rate:${ip}`);
    if (!state) return null;

    return {
      allowed: state.allowed,
      blocked: state.blocked,
      tokens: state.tokens
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      trafficBlocked: 0,
      trafficAllowed: 0,
      averageLatency: 0,
      cpuUsage: 0,
      memoryUsage: 0
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MitigationConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get configuration
   */
  getConfig(): MitigationConfig {
    return { ...this.config };
  }

  /**
   * Reset engine state
   */
  reset(): void {
    this.blockList.clear();
    this.allowList.clear();
    this.rateLimitStates.clear();
    this.customRules.clear();
    this.mitigationHistory = [];
    this.resetMetrics();
  }

  /**
   * Export state for backup/analysis
   */
  exportState(): {
    blockList: BlockListEntry[];
    allowList: BlockListEntry[];
    rules: MitigationRule[];
    metrics: MitigationMetrics;
  } {
    return {
      blockList: this.getBlockList(),
      allowList: this.getAllowList(),
      rules: this.getRules(),
      metrics: this.getMetrics()
    };
  }

  /**
   * Import state
   */
  importState(state: {
    blockList?: BlockListEntry[];
    allowList?: BlockListEntry[];
    rules?: MitigationRule[];
  }): void {
    if (state.blockList) {
      for (const entry of state.blockList) {
        this.blockList.set(entry.target, entry);
      }
    }

    if (state.allowList) {
      for (const entry of state.allowList) {
        this.allowList.set(entry.target, entry);
      }
    }

    if (state.rules) {
      for (const rule of state.rules) {
        this.customRules.set(rule.id, rule);
      }
    }
  }
}

/**
 * Traffic shaping implementation
 */
export class TrafficShaper {
  private queues: Map<string, number[]> = new Map();
  private maxQueueSize: number;
  private processingRate: number;

  constructor(config: { maxQueueSize?: number; processingRate?: number } = {}) {
    this.maxQueueSize = config.maxQueueSize || 1000;
    this.processingRate = config.processingRate || 100; // requests per second
  }

  /**
   * Shape traffic for an IP
   */
  async shapeTraffic(ip: string, params: TrafficShapingParams): Promise<boolean> {
    const queue = this.queues.get(ip) || [];

    // Check if queue is full
    if (queue.length >= this.maxQueueSize) {
      return false; // Drop request
    }

    // Add to queue
    queue.push(Date.now());
    this.queues.set(ip, queue);

    // Simulate processing delay
    const delay = Math.max(0, 1000 / this.processingRate);
    await new Promise(resolve => setTimeout(resolve, delay));

    return true;
  }

  /**
   * Get queue size for IP
   */
  getQueueSize(ip: string): number {
    return this.queues.get(ip)?.length || 0;
  }

  /**
   * Clear queue for IP
   */
  clearQueue(ip: string): void {
    this.queues.delete(ip);
  }
}
