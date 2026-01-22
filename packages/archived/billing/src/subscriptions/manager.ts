// @ts-nocheck - Unused imports and external dependencies
/**
 * Subscription management system
 */

import {
  Subscription,
  SubscriptionStatus,
  SubscriptionChangeRequest,
  SubscriptionItem,
  TrialExtension,
  PlanType,
  BillingInterval,
  BillingError,
  BillingErrorCode,
} from '../types/index.js';
import { pricingManager } from '../pricing/index.js';

/**
 * Subscription manager for handling subscription lifecycle
 */
export class SubscriptionManager {
  private subscriptions: Map<string, Subscription>;
  private stripe: any; // Stripe client (would be initialized in production)

  constructor(stripeSecretKey?: string) {
    this.subscriptions = new Map();
    // In production, initialize Stripe client
    // this.stripe = new Stripe(stripeSecretKey);
  }

  /**
   * Create a new subscription
   */
  async createSubscription(params: {
    organizationId: string;
    userId: string;
    planId: string;
    trialDays?: number;
    stripeCustomerId?: string;
    metadata?: Record<string, any>;
  }): Promise<Subscription> {
    const { organizationId, userId, planId, trialDays, stripeCustomerId, metadata } = params;

    // Check if organization already has an active subscription
    const existing = await this.getActiveSubscription(organizationId);
    if (existing) {
      throw new BillingError(
        BillingErrorCode.SUBSCRIPTION_ACTIVE,
        'Organization already has an active subscription'
      );
    }

    // Get pricing tier
    const plan = pricingManager.getTier(planId);
    if (!plan) {
      throw new BillingError(
        BillingErrorCode.INVALID_PLAN,
        `Plan ${planId} not found`
      );
    }

    // Create subscription
    const subscription: Subscription = {
      id: this.generateId(),
      organizationId,
      userId,
      planId,
      status: trialDays ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: this.calculatePeriodEnd(plan.interval),
      trialStart: trialDays ? new Date() : undefined,
      trialEnd: trialDays ? this.addDays(new Date(), trialDays) : undefined,
      cancelAtPeriodEnd: false,
      stripeCustomerId,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // In production, create Stripe subscription
    // if (stripeCustomerId) {
    //   const stripeSub = await this.stripe.subscriptions.create({
    //     customer: stripeCustomerId,
    //     items: [{ price: plan.stripePriceId }],
    //     trial_period_days: trialDays,
    //   });
    //   subscription.stripeSubscriptionId = stripeSub.id;
    // }

    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(id: string): Promise<Subscription | undefined> {
    return this.subscriptions.get(id);
  }

  /**
   * Get active subscription for an organization
   */
  async getActiveSubscription(organizationId: string): Promise<Subscription | undefined> {
    const subscriptions = Array.from(this.subscriptions.values());
    return subscriptions.find(
      (s) =>
        s.organizationId === organizationId &&
        (s.status === SubscriptionStatus.ACTIVE ||
          s.status === SubscriptionStatus.TRIALING)
    );
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    id: string,
    updates: Partial<Subscription>
  ): Promise<Subscription> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) {
      throw new BillingError(
        BillingErrorCode.SUBSCRIPTION_NOT_FOUND,
        `Subscription ${id} not found`
      );
    }

    const updated = {
      ...subscription,
      ...updates,
      updatedAt: new Date(),
    };

    this.subscriptions.set(id, updated);
    return updated;
  }

  /**
   * Change subscription plan
   */
  async changePlan(request: SubscriptionChangeRequest): Promise<Subscription> {
    const subscription = this.subscriptions.get(request.subscriptionId);
    if (!subscription) {
      throw new BillingError(
        BillingErrorCode.SUBSCRIPTION_NOT_FOUND,
        `Subscription ${request.subscriptionId} not found`
      );
    }

    const currentPlan = pricingManager.getTier(subscription.planId);
    const newPlan = pricingManager.getTier(request.newPlanId);

    if (!currentPlan || !newPlan) {
      throw new BillingError(
        BillingErrorCode.INVALID_PLAN,
        'Invalid plan ID'
      );
    }

    // Calculate proration if enabled
    let prorationAmount = 0;
    if (request.prorate) {
      const daysInPeriod = this.daysBetween(
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd
      );
      const daysRemaining = this.daysBetween(
        new Date(),
        subscription.currentPeriodEnd
      );
      prorationAmount = pricingManager.calculateProration(
        currentPlan,
        newPlan,
        daysInPeriod,
        daysRemaining
      );
    }

    // Update subscription
    const updated = await this.updateSubscription(request.subscriptionId, {
      planId: request.newPlanId,
      metadata: {
        ...subscription.metadata,
        changeReason: request.reason,
        prorationAmount,
        previousPlanId: subscription.planId,
      },
    });

    // In production, update Stripe subscription
    // if (subscription.stripeSubscriptionId) {
    //   await this.stripe.subscriptions.update(
    //     subscription.stripeSubscriptionId,
    //     {
    //       items: [{ price: newPlan.stripePriceId }],
    //       proration_behavior: request.prorate ? 'create_prorations' : 'none',
    //     }
    //   );
    // }

    return updated;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    id: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<Subscription> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) {
      throw new BillingError(
        BillingErrorCode.SUBSCRIPTION_NOT_FOUND,
        `Subscription ${id} not found`
      );
    }

    if (cancelAtPeriodEnd) {
      // Cancel at period end
      return this.updateSubscription(id, {
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
      });
    } else {
      // Cancel immediately
      return this.updateSubscription(id, {
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date(),
      });
    }
  }

  /**
   * Resume canceled subscription
   */
  async resumeSubscription(id: string): Promise<Subscription> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) {
      throw new BillingError(
        BillingErrorCode.SUBSCRIPTION_NOT_FOUND,
        `Subscription ${id} not found`
      );
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw new BillingError(
        BillingErrorCode.INVALID_SUBSCRIPTION_CHANGE,
        'Subscription is not scheduled for cancellation'
      );
    }

    return this.updateSubscription(id, {
      cancelAtPeriodEnd: false,
      canceledAt: undefined,
    });
  }

  /**
   * Extend trial period
   */
  async extendTrial(extension: TrialExtension): Promise<Subscription> {
    const subscription = this.subscriptions.get(extension.subscriptionId);
    if (!subscription) {
      throw new BillingError(
        BillingErrorCode.SUBSCRIPTION_NOT_FOUND,
        `Subscription ${extension.subscriptionId} not found`
      );
    }

    if (subscription.status !== SubscriptionStatus.TRIALING) {
      throw new BillingError(
        BillingErrorCode.INVALID_SUBSCRIPTION_CHANGE,
        'Subscription is not in trial status'
      );
    }

    const newTrialEnd = subscription.trialEnd
      ? this.addDays(subscription.trialEnd, extension.additionalDays)
      : this.addDays(new Date(), extension.additionalDays);

    return this.updateSubscription(extension.subscriptionId, {
      trialEnd: newTrialEnd,
      metadata: {
        ...subscription.metadata,
        trialExtensionReason: extension.reason,
        originalTrialEnd: subscription.trialEnd,
      },
    });
  }

  /**
   * Check if subscription is active
   */
  isSubscriptionActive(subscription: Subscription): boolean {
    return (
      subscription.status === SubscriptionStatus.ACTIVE ||
      subscription.status === SubscriptionStatus.TRIALING
    );
  }

  /**
   * Check if trial has expired
   */
  hasTrialExpired(subscription: Subscription): boolean {
    if (!subscription.trialEnd) return false;
    return new Date() > subscription.trialEnd;
  }

  /**
   * Get subscription status
   */
  getSubscriptionStatus(subscription: Subscription): SubscriptionStatus {
    if (subscription.status === SubscriptionStatus.TRIALING) {
      if (this.hasTrialExpired(subscription)) {
        return SubscriptionStatus.PAST_DUE;
      }
    }
    return subscription.status;
  }

  /**
   * Update subscription status based on payment
   */
  async updateStatusAfterPayment(
    id: string,
    paymentSuccessful: boolean
  ): Promise<Subscription> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) {
      throw new BillingError(
        BillingErrorCode.SUBSCRIPTION_NOT_FOUND,
        `Subscription ${id} not found`
      );
    }

    if (paymentSuccessful) {
      // Reset period and keep active
      const plan = pricingManager.getTier(subscription.planId);
      return this.updateSubscription(id, {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: this.calculatePeriodEnd(plan?.interval || BillingInterval.MONTHLY),
      });
    } else {
      // Mark as past due
      return this.updateSubscription(id, {
        status: SubscriptionStatus.PAST_DUE,
      });
    }
  }

  /**
   * Get all subscriptions for an organization
   */
  async getOrganizationSubscriptions(organizationId: string): Promise<Subscription[]> {
    const subscriptions = Array.from(this.subscriptions.values());
    return subscriptions.filter((s) => s.organizationId === organizationId);
  }

  /**
   * Get all subscriptions for a user
   */
  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    const subscriptions = Array.from(this.subscriptions.values());
    return subscriptions.filter((s) => s.userId === userId);
  }

  /**
   * Get subscriptions by status
   */
  async getSubscriptionsByStatus(status: SubscriptionStatus): Promise<Subscription[]> {
    const subscriptions = Array.from(this.subscriptions.values());
    return subscriptions.filter((s) => s.status === status);
  }

  /**
   * Process subscription renewals
   */
  async processRenewals(): Promise<Subscription[]> {
    const now = new Date();
    const expiring = Array.from(this.subscriptions.values()).filter(
      (s) => s.currentPeriodEnd <= now && !s.cancelAtPeriodEnd
    );

    const renewed: Subscription[] = [];
    for (const subscription of expiring) {
      const plan = pricingManager.getTier(subscription.planId);
      const updated = await this.updateSubscription(subscription.id, {
        currentPeriodStart: now,
        currentPeriodEnd: this.calculatePeriodEnd(plan?.interval || BillingInterval.MONTHLY),
      });
      renewed.push(updated);
    }

    return renewed;
  }

  /**
   * Process subscription cancellations
   */
  async processCancellations(): Promise<Subscription[]> {
    const now = new Date();
    const toCancel = Array.from(this.subscriptions.values()).filter(
      (s) => s.cancelAtPeriodEnd && s.currentPeriodEnd <= now
    );

    const canceled: Subscription[] = [];
    for (const subscription of toCancel) {
      const updated = await this.updateSubscription(subscription.id, {
        status: SubscriptionStatus.CANCELED,
      });
      canceled.push(updated);
    }

    return canceled;
  }

  /**
   * Calculate period end date
   */
  private calculatePeriodEnd(interval: BillingInterval): Date {
    const now = new Date();
    if (interval === BillingInterval.YEARLY) {
      return new Date(now.setFullYear(now.getFullYear() + 1));
    } else {
      return new Date(now.setMonth(now.getMonth() + 1));
    }
  }

  /**
   * Add days to date
   */
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Calculate days between two dates
   */
  private daysBetween(start: Date, end: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((end.getTime() - start.getTime()) / msPerDay);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get subscription count by plan
   */
  async getSubscriptionCountByPlan(): Promise<Record<string, number>> {
    const subscriptions = Array.from(this.subscriptions.values());
    const counts: Record<string, number> = {};

    for (const subscription of subscriptions) {
      counts[subscription.planId] = (counts[subscription.planId] || 0) + 1;
    }

    return counts;
  }

  /**
   * Get subscription count by status
   */
  async getSubscriptionCountByStatus(): Promise<Record<SubscriptionStatus, number>> {
    const subscriptions = Array.from(this.subscriptions.values());
    const counts: Record<string, number> = {};

    for (const subscription of subscriptions) {
      counts[subscription.status] = (counts[subscription.status] || 0) + 1;
    }

    return counts as Record<SubscriptionStatus, number>;
  }
}

/**
 * Create a subscription manager
 */
export function createSubscriptionManager(stripeSecretKey?: string): SubscriptionManager {
  return new SubscriptionManager(stripeSecretKey);
}
