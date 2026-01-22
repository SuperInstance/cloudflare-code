/**
 * Unit tests for subscription management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SubscriptionManager,
  createSubscriptionManager,
} from '../../src/subscriptions/index.js';
import {
  SubscriptionStatus,
  PlanType,
  BillingInterval,
  BillingError,
  BillingErrorCode,
} from '../../src/types/index.js';

describe('SubscriptionManager', () => {
  let manager: SubscriptionManager;

  beforeEach(() => {
    manager = createSubscriptionManager();
  });

  describe('createSubscription', () => {
    it('should create a new subscription', async () => {
      const subscription = await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_pro_monthly',
        trialDays: 14,
      });

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(subscription.organizationId).toBe('org123');
      expect(subscription.userId).toBe('user123');
      expect(subscription.planId).toBe('plan_pro_monthly');
      expect(subscription.status).toBe(SubscriptionStatus.TRIALING);
      expect(subscription.trialEnd).toBeDefined();
    });

    it('should create subscription without trial', async () => {
      const subscription = await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_free',
      });

      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription.trialStart).toBeUndefined();
      expect(subscription.trialEnd).toBeUndefined();
    });

    it('should reject duplicate active subscription', async () => {
      await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_free',
      });

      await expect(
        manager.createSubscription({
          organizationId: 'org123',
          userId: 'user123',
          planId: 'plan_pro_monthly',
        })
      ).rejects.toThrow('Organization already has an active subscription');
    });

    it('should reject invalid plan', async () => {
      await expect(
        manager.createSubscription({
          organizationId: 'org123',
          userId: 'user123',
          planId: 'plan_invalid',
        })
      ).rejects.toThrow('Plan plan_invalid not found');
    });
  });

  describe('getSubscription', () => {
    it('should retrieve subscription by ID', async () => {
      const created = await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_pro_monthly',
      });

      const retrieved = await manager.getSubscription(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return undefined for non-existent subscription', async () => {
      const subscription = await manager.getSubscription('nonexistent');
      expect(subscription).toBeUndefined();
    });
  });

  describe('getActiveSubscription', () => {
    it('should return active subscription', async () => {
      await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_pro_monthly',
      });

      const active = await manager.getActiveSubscription('org123');
      expect(active).toBeDefined();
      expect(active?.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('should return undefined when no active subscription', async () => {
      const active = await manager.getActiveSubscription('org999');
      expect(active).toBeUndefined();
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription metadata', async () => {
      const subscription = await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_pro_monthly',
      });

      const updated = await manager.updateSubscription(subscription.id, {
        metadata: { key: 'value' },
      });

      expect(updated.metadata?.key).toBe('value');
    });

    it('should reject update for non-existent subscription', async () => {
      await expect(
        manager.updateSubscription('nonexistent', { metadata: {} })
      ).rejects.toThrow('Subscription nonexistent not found');
    });
  });

  describe('changePlan', () => {
    it('should upgrade subscription plan', async () => {
      const subscription = await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_free',
      });

      const updated = await manager.changePlan({
        subscriptionId: subscription.id,
        newPlanId: 'plan_pro_monthly',
        prorate: true,
        effectiveImmediately: true,
      });

      expect(updated.planId).toBe('plan_pro_monthly');
    });

    it('should downgrade subscription plan', async () => {
      const subscription = await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_pro_monthly',
      });

      const updated = await manager.changePlan({
        subscriptionId: subscription.id,
        newPlanId: 'plan_free',
        prorate: true,
        effectiveImmediately: true,
      });

      expect(updated.planId).toBe('plan_free');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      const subscription = await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_pro_monthly',
      });

      const canceled = await manager.cancelSubscription(subscription.id, true);

      expect(canceled.cancelAtPeriodEnd).toBe(true);
      expect(canceled.canceledAt).toBeDefined();
    });

    it('should cancel subscription immediately', async () => {
      const subscription = await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_pro_monthly',
      });

      const canceled = await manager.cancelSubscription(subscription.id, false);

      expect(canceled.status).toBe(SubscriptionStatus.CANCELED);
      expect(canceled.canceledAt).toBeDefined();
    });
  });

  describe('resumeSubscription', () => {
    it('should resume scheduled cancellation', async () => {
      const subscription = await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_pro_monthly',
      });

      await manager.cancelSubscription(subscription.id, true);
      const resumed = await manager.resumeSubscription(subscription.id);

      expect(resumed.cancelAtPeriodEnd).toBe(false);
      expect(resumed.canceledAt).toBeUndefined();
    });

    it('should reject resume for non-cancellable subscription', async () => {
      const subscription = await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_pro_monthly',
      });

      await expect(
        manager.resumeSubscription(subscription.id)
      ).rejects.toThrow('Subscription is not scheduled for cancellation');
    });
  });

  describe('extendTrial', () => {
    it('should extend trial period', async () => {
      const subscription = await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_pro_monthly',
        trialDays: 7,
      });

      const originalTrialEnd = subscription.trialEnd!;
      const extended = await manager.extendTrial({
        subscriptionId: subscription.id,
        additionalDays: 7,
        reason: 'Customer request',
      });

      expect(extended.trialEnd!.getTime()).toBeGreaterThan(originalTrialEnd.getTime());
    });

    it('should reject trial extension for non-trial subscription', async () => {
      const subscription = await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_pro_monthly',
      });

      await expect(
        manager.extendTrial({
          subscriptionId: subscription.id,
          additionalDays: 7,
          reason: 'Test',
        })
      ).rejects.toThrow('Subscription is not in trial status');
    });
  });

  describe('subscription status helpers', () => {
    it('should identify active subscription', async () => {
      const subscription = await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_pro_monthly',
      });

      expect(manager.isSubscriptionActive(subscription)).toBe(true);
    });

    it('should identify expired trial', async () => {
      const subscription = await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_pro_monthly',
        trialDays: -1, // Already expired
      });

      expect(manager.hasTrialExpired(subscription)).toBe(true);
    });
  });

  describe('getOrganizationSubscriptions', () => {
    it('should return all subscriptions for organization', async () => {
      await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_free',
      });

      await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user456',
        planId: 'plan_pro_monthly',
      });

      // Cancel first subscription
      const first = await manager.getActiveSubscription('org123');
      await manager.cancelSubscription(first!.id, false);

      const subscriptions = await manager.getOrganizationSubscriptions('org123');
      expect(subscriptions.length).toBe(2);
    });
  });

  describe('processRenewals', () => {
    it('should renew expiring subscriptions', async () => {
      const subscription = await manager.createSubscription({
        organizationId: 'org123',
        userId: 'user123',
        planId: 'plan_pro_monthly',
      });

      // Manually set period end to past
      await manager.updateSubscription(subscription.id, {
        currentPeriodEnd: new Date(Date.now() - 1000),
      });

      const renewed = await manager.processRenewals();
      expect(renewed.length).toBeGreaterThan(0);
    });
  });
});
