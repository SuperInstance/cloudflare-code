/**
 * Feature Flags System
 *
 * Provides comprehensive feature flag management with targeting,
 * gradual rollout, and evaluation capabilities.
 */

import type {
  FeatureFlag,
  EvaluationContext,
  EvaluationResult,
} from './types';
import { FeatureFlagSchema } from './validation';

/**
 * Feature flag manager class
 */
export class FeatureFlagManager {
  private flags: Map<string, FeatureFlag> = new Map();

  /**
   * Create a new feature flag manager
   */
  constructor(initialFlags: FeatureFlag[] = []) {
    for (const flag of initialFlags) {
      this.setFlag(flag);
    }
  }

  /**
   * Set a feature flag
   */
  setFlag(flag: FeatureFlag): void {
    const validated = FeatureFlagSchema.parse(flag);
    this.flags.set(validated.name, validated);
  }

  /**
   * Get a feature flag
   */
  getFlag(name: string): FeatureFlag | undefined {
    return this.flags.get(name);
  }

  /**
   * Get all feature flags
   */
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Delete a feature flag
   */
  deleteFlag(name: string): boolean {
    return this.flags.delete(name);
  }

  /**
   * Evaluate if a feature flag is enabled for a given context
   */
  evaluate(name: string, context: EvaluationContext = {}): EvaluationResult {
    const flag = this.flags.get(name);

    if (!flag) {
      return {
        enabled: false,
        reason: `Feature flag "${name}" not found`,
      };
    }

    // Check if flag is globally enabled
    if (!flag.enabled) {
      return {
        enabled: false,
        reason: `Feature flag "${name}" is disabled`,
      };
    }

    // Check if flag has expired
    if (flag.expiresAt && Date.now() > flag.expiresAt) {
      return {
        enabled: false,
        reason: `Feature flag "${name}" has expired`,
      };
    }

    // Check tier targeting
    if (flag.targeting.tier !== 'all') {
      if (context.tier && context.tier !== flag.targeting.tier) {
        return {
          enabled: false,
          reason: `User tier "${context.tier}" does not match required tier "${flag.targeting.tier}"`,
        };
      }
    }

    // Check explicit user targeting
    if (flag.targeting.users.length > 0 && context.userId) {
      if (flag.targeting.users.includes(context.userId)) {
        return {
          enabled: true,
          reason: `User "${context.userId}" is explicitly targeted`,
          config: flag.metadata,
        };
      }
    }

    // Check organization targeting
    if (flag.targeting.organizations.length > 0 && context.organizationId) {
      if (!flag.targeting.organizations.includes(context.organizationId)) {
        return {
          enabled: false,
          reason: `Organization "${context.organizationId}" is not targeted`,
        };
      }
    }

    // Check custom targeting rules
    if (flag.targeting.custom) {
      const customResult = this.evaluateCustomTargeting(flag, context);
      if (!customResult.matched) {
        return {
          enabled: false,
          reason: customResult.reason,
        };
      }
    }

    // Check percentage rollout
    if (flag.targeting.percentage > 0) {
      const rolloutResult = this.evaluatePercentageRollout(flag, context);
      return rolloutResult;
    }

    // Default to enabled if no targeting rules prevent it
    return {
      enabled: true,
      reason: `Feature flag "${name}" is enabled and user matches all targeting criteria`,
      config: flag.metadata,
    };
  }

  /**
   * Check if a feature flag is enabled (shorthand)
   */
  isEnabled(name: string, context: EvaluationContext = {}): boolean {
    return this.evaluate(name, context).enabled;
  }

  /**
   * Get feature flags for a specific user
   */
  getFlagsForUser(context: EvaluationContext): Map<string, boolean> {
    const result = new Map<string, boolean>();

    for (const flagName of this.flags.keys()) {
      const evaluation = this.evaluate(flagName, context);
      result.set(flagName, evaluation.enabled);
    }

    return result;
  }

  /**
   * Update a feature flag
   */
  updateFlag(name: string, updates: Partial<FeatureFlag>): FeatureFlag | null {
    const existing = this.flags.get(name);
    if (!existing) {
      return null;
    }

    const updated: FeatureFlag = {
      ...existing,
      ...updates,
      name, // Ensure name doesn't change
      updatedAt: Date.now(),
    };

    this.setFlag(updated);
    return updated;
  }

  /**
   * Enable/disable a feature flag
   */
  setFlagEnabled(name: string, enabled: boolean): boolean {
    const flag = this.flags.get(name);
    if (!flag) {
      return false;
    }

    flag.enabled = enabled;
    flag.updatedAt = Date.now();
    return true;
  }

  /**
   * Set percentage rollout for a flag
   */
  setPercentageRollout(name: string, percentage: number): boolean {
    const flag = this.flags.get(name);
    if (!flag) {
      return false;
    }

    if (percentage < 0 || percentage > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }

    flag.targeting.percentage = percentage;
    flag.updatedAt = Date.now();
    return true;
  }

  /**
   * Add user to targeting list
   */
  addTargetUser(name: string, userId: string): boolean {
    const flag = this.flags.get(name);
    if (!flag) {
      return false;
    }

    if (!flag.targeting.users.includes(userId)) {
      flag.targeting.users.push(userId);
      flag.updatedAt = Date.now();
    }

    return true;
  }

  /**
   * Remove user from targeting list
   */
  removeTargetUser(name: string, userId: string): boolean {
    const flag = this.flags.get(name);
    if (!flag) {
      return false;
    }

    const index = flag.targeting.users.indexOf(userId);
    if (index > -1) {
      flag.targeting.users.splice(index, 1);
      flag.updatedAt = Date.now();
      return true;
    }

    return false;
  }

  /**
   * Add organization to targeting list
   */
  addTargetOrganization(name: string, organizationId: string): boolean {
    const flag = this.flags.get(name);
    if (!flag) {
      return false;
    }

    if (!flag.targeting.organizations.includes(organizationId)) {
      flag.targeting.organizations.push(organizationId);
      flag.updatedAt = Date.now();
    }

    return true;
  }

  /**
   * Remove organization from targeting list
   */
  removeTargetOrganization(name: string, organizationId: string): boolean {
    const flag = this.flags.get(name);
    if (!flag) {
      return false;
    }

    const index = flag.targeting.organizations.indexOf(organizationId);
    if (index > -1) {
      flag.targeting.organizations.splice(index, 1);
      flag.updatedAt = Date.now();
      return true;
    }

    return false;
  }

  /**
   * Evaluate custom targeting rules
   */
  private evaluateCustomTargeting(
    flag: FeatureFlag,
    context: EvaluationContext
  ): { matched: boolean; reason: string } {
    const custom = flag.targeting.custom;
    if (!custom) {
      return { matched: true, reason: 'No custom targeting rules' };
    }

    // Check environment targeting
    if (custom.environment && context.environment) {
      if (custom.environment !== context.environment) {
        return {
          matched: false,
          reason: `Environment "${context.environment}" does not match "${custom.environment}"`,
        };
      }
    }

    // Check country targeting
    if (custom.country && custom.country.length > 0 && context.country) {
      if (!custom.country.includes(context.country)) {
        return {
          matched: false,
          reason: `Country "${context.country}" is not in target list`,
        };
      }
    }

    // Check region targeting
    if (custom.region && custom.region.length > 0 && context.region) {
      if (!custom.region.includes(context.region)) {
        return {
          matched: false,
          reason: `Region "${context.region}" is not in target list`,
        };
      }
    }

    // Check user agent targeting
    if (custom.userAgent && custom.userAgent.length > 0 && context.userAgent) {
      const matches = custom.userAgent.some((pattern) =>
        context.userAgent!.includes(pattern)
      );
      if (!matches) {
        return {
          matched: false,
          reason: 'User agent does not match target patterns',
        };
      }
    }

    // Check IP range targeting (basic implementation)
    if (custom.ipRange && custom.ipRange.length > 0 && context.ip) {
      const matches = custom.ipRange.some((range) =>
        this.isIPInRange(context.ip!, range)
      );
      if (!matches) {
        return {
          matched: false,
          reason: 'IP address is not in target ranges',
        };
      }
    }

    return { matched: true, reason: 'Custom targeting rules passed' };
  }

  /**
   * Evaluate percentage rollout
   */
  private evaluatePercentageRollout(
    flag: FeatureFlag,
    context: EvaluationContext
  ): EvaluationResult {
    // Generate consistent bucket for user (0-99)
    const bucket = this.getBucketForUser(flag.name, context.userId || 'anonymous');

    if (bucket < flag.targeting.percentage) {
      return {
        enabled: true,
        reason: `User is in ${flag.targeting.percentage}% rollout (bucket ${bucket})`,
        config: flag.metadata,
      };
    }

    return {
      enabled: false,
      reason: `User is not in ${flag.targeting.percentage}% rollout (bucket ${bucket})`,
    };
  }

  /**
   * Get consistent bucket for a user (0-99)
   * Uses deterministic hash so same user always gets same bucket
   */
  private getBucketForUser(flagName: string, userId: string): number {
    const input = `${flagName}:${userId}`;

    // Simple hash algorithm (djb2)
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xffffffff;
    }

    return Math.abs(hash) % 100;
  }

  /**
   * Check if IP is in CIDR range (basic implementation)
   */
  private isIPInRange(ip: string, range: string): boolean {
    // Simplified implementation - in production, use proper CIDR library
    return ip.startsWith(range.split('/')[0]);
  }

  /**
   * Get statistics about feature flags
   */
  getStats(): {
    total: number;
    enabled: number;
    disabled: number;
    withTargeting: number;
    withRollout: number;
  } {
    const flags = Array.from(this.flags.values());

    return {
      total: flags.length,
      enabled: flags.filter((f) => f.enabled).length,
      disabled: flags.filter((f) => !f.enabled).length,
      withTargeting: flags.filter(
        (f) =>
          f.targeting.users.length > 0 ||
          f.targeting.organizations.length > 0 ||
          f.targeting.tier !== 'all'
      ).length,
      withRollout: flags.filter((f) => f.targeting.percentage > 0).length,
    };
  }

  /**
   * Export all flags
   */
  export(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Import flags
   */
  import(flags: FeatureFlag[]): void {
    this.flags.clear();
    for (const flag of flags) {
      this.setFlag(flag);
    }
  }
}

/**
 * Helper function to create a feature flag
 */
export function createFeatureFlag(
  name: string,
  enabled: boolean,
  options?: Partial<FeatureFlag>
): FeatureFlag {
  const now = Date.now();

  return {
    name,
    enabled,
    targeting: {
      users: [],
      percentage: 0,
      organizations: [],
      tier: 'all',
    },
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...options,
  };
}

/**
 * Helper function to create percentage rollout flag
 */
export function createPercentageRolloutFlag(
  name: string,
  percentage: number,
  options?: Partial<FeatureFlag>
): FeatureFlag {
  return createFeatureFlag(name, true, {
    ...options,
    targeting: {
      users: [],
      percentage,
      organizations: [],
      tier: 'all',
      ...options?.targeting,
    },
  });
}

/**
 * Helper function to create user-targeted flag
 */
export function createUserTargetedFlag(
  name: string,
  users: string[],
  options?: Partial<FeatureFlag>
): FeatureFlag {
  return createFeatureFlag(name, true, {
    ...options,
    targeting: {
      users,
      percentage: 0,
      organizations: [],
      tier: 'all',
      ...options?.targeting,
    },
  });
}

/**
 * Helper function to create tier-targeted flag
 */
export function createTierTargetedFlag(
  name: string,
  tier: 'free' | 'pro' | 'enterprise',
  options?: Partial<FeatureFlag>
): FeatureFlag {
  return createFeatureFlag(name, true, {
    ...options,
    targeting: {
      users: [],
      percentage: 0,
      organizations: [],
      tier,
      ...options?.targeting,
    },
  });
}
