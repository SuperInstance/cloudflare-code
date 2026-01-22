/**
 * Integration tests for billing workflow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SubscriptionManager,
  createSubscriptionManager,
} from '../../src/subscriptions/index.js';
import {
  UsageMeter,
  createUsageMeter,
  UsageCollector,
  createUsageCollector,
} from '../../src/metering/index.js';
import {
  InvoiceGenerator,
  createInvoiceGenerator,
} from '../../src/invoicing/index.js';
import {
  PaymentProcessor,
  createPaymentProcessor,
} from '../../src/payments/index.js';
import {
  UsageAnalyzer,
  createUsageAnalyzer,
} from '../../src/analytics/index.js';
import { PlanType, UsageMetricType, SubscriptionStatus } from '../../src/types/index.js';

describe('Billing Workflow Integration', () => {
  let subscriptionManager: SubscriptionManager;
  let usageMeter: UsageMeter;
  let usageCollector: UsageCollector;
  let invoiceGenerator: InvoiceGenerator;
  let paymentProcessor: PaymentProcessor;
  let usageAnalyzer: UsageAnalyzer;

  beforeEach(() => {
    subscriptionManager = createSubscriptionManager();
    usageMeter = createUsageMeter({ enabled: true });
    usageCollector = createUsageCollector(usageMeter);
    invoiceGenerator = createInvoiceGenerator();
    paymentProcessor = createPaymentProcessor();
    usageAnalyzer = createUsageAnalyzer();
  });

  describe('Complete billing workflow', () => {
    it('should handle full subscription lifecycle', async () => {
      // 1. Create subscription
      const subscription = await subscriptionManager.createSubscription({
        organizationId: 'org_integration',
        userId: 'user_integration',
        planId: 'plan_pro_monthly',
        trialDays: 14,
      });

      expect(subscription.status).toBe(SubscriptionStatus.TRIALING);

      // 2. Add payment method
      const paymentMethod = await paymentProcessor.addPaymentMethod({
        organizationId: 'org_integration',
        userId: 'user_integration',
        type: 'card',
        cardDetails: {
          lastFour: '4242',
          brand: 'visa',
          expiryMonth: 12,
          expiryYear: 2025,
        },
        isDefault: true,
      });

      expect(paymentMethod.id).toBeDefined();

      // 3. Collect usage during trial
      await usageCollector.collectRequestMetrics({
        userId: 'user_integration',
        organizationId: 'org_integration',
        endpoint: '/api/generate',
        method: 'POST',
        statusCode: 200,
        timestamp: new Date(),
        duration: 1500,
        tokenCount: {
          prompt: 100,
          completion: 200,
          total: 300,
        },
        requestBody: 1000,
        responseBody: 5000,
      });

      // Check usage
      const requests = await usageMeter.getCurrentUsage(
        'org_integration',
        UsageMetricType.REQUESTS
      );
      expect(requests).toBe(1);

      const tokens = await usageMeter.getCurrentUsage(
        'org_integration',
        UsageMetricType.TOKENS
      );
      expect(tokens).toBe(300);

      // 4. Generate invoice at end of trial
      const invoice = await invoiceGenerator.generateSubscriptionInvoice(subscription);

      expect(invoice.status).toBe('draft');
      expect(invoice.amountDue).toBeGreaterThan(0);

      // 5. Finalize invoice
      const finalizedInvoice = await invoiceGenerator.finalizeInvoice(invoice.id);
      expect(finalizedInvoice.status).toBe('open');

      // 6. Process payment
      const payment = await paymentProcessor.createPaymentIntent({
        invoiceId: invoice.id,
        subscriptionId: subscription.id,
        organizationId: 'org_integration',
        userId: 'user_integration',
        amount: invoice.amountDue,
        currency: invoice.currency,
        paymentMethodId: paymentMethod.id,
      });

      expect(payment.status).toBe('pending');

      // 7. Confirm payment
      const confirmedPayment = await paymentProcessor.confirmPayment(payment.id);
      expect(confirmedPayment.status).toBe('succeeded');

      // 8. Mark invoice as paid
      const paidInvoice = await invoiceGenerator.markAsPaid(invoice.id);
      expect(paidInvoice.status).toBe('paid');
      expect(paidInvoice.amountRemaining).toBe(0);

      // 9. Update subscription after successful payment
      const updatedSubscription = await subscriptionManager.updateStatusAfterPayment(
        subscription.id,
        true
      );
      expect(updatedSubscription.status).toBe(SubscriptionStatus.ACTIVE);

      // 10. Generate usage analytics
      const usageSummary = await usageAnalyzer.generateUsageSummary({
        organizationId: 'org_integration',
        periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(),
        usageData: {
          requests: 1000,
          tokens: 100000,
          cpuTime: 5000,
          storage: 1000000000,
          bandwidth: 5000000000,
          apiCalls: 500,
        },
        planType: PlanType.PRO,
      });

      expect(usageSummary.metrics.requests.total).toBe(1000);
      expect(usageSummary.costBreakdown.totalCost).toBeGreaterThan(0);

      // 11. Generate forecast
      const forecast = await usageAnalyzer.generateForecast({
        organizationId: 'org_integration',
        forecastStart: new Date(),
        forecastEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        historicalData: {
          requests: [800, 900, 1000, 1100],
          tokens: [80000, 90000, 100000, 110000],
          cpuTime: [4000, 4500, 5000, 5500],
          storage: [900000000, 950000000, 1000000000, 1050000000],
          bandwidth: [4500000000, 4750000000, 5000000000, 5250000000],
        },
        planType: PlanType.PRO,
      });

      expect(forecast.metrics.requests.projected).toBeGreaterThan(0);
      expect(forecast.projectedCost).toBeGreaterThan(0);
    });
  });

  describe('Plan upgrade workflow', () => {
    it('should handle plan upgrade with proration', async () => {
      // Start with free plan
      const subscription = await subscriptionManager.createSubscription({
        organizationId: 'org_upgrade',
        userId: 'user_upgrade',
        planId: 'plan_free',
      });

      // Upgrade to pro
      const upgraded = await subscriptionManager.changePlan({
        subscriptionId: subscription.id,
        newPlanId: 'plan_pro_monthly',
        prorate: true,
        effectiveImmediately: true,
        reason: 'User requested upgrade',
      });

      expect(upgraded.planId).toBe('plan_pro_monthly');
      expect(upgraded.metadata?.prorationAmount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Failed payment workflow', () => {
    it('should handle failed payment with dunning', async () => {
      const subscription = await subscriptionManager.createSubscription({
        organizationId: 'org_dunning',
        userId: 'user_dunning',
        planId: 'plan_pro_monthly',
      });

      const paymentMethod = await paymentProcessor.addPaymentMethod({
        organizationId: 'org_dunning',
        userId: 'user_dunning',
        type: 'card',
        cardDetails: {
          lastFour: '4242',
          brand: 'visa',
          expiryMonth: 12,
          expiryYear: 2025,
        },
        isDefault: true,
      });

      const invoice = await invoiceGenerator.generateSubscriptionInvoice(subscription);
      await invoiceGenerator.finalizeInvoice(invoice.id);

      const payment = await paymentProcessor.createPaymentIntent({
        invoiceId: invoice.id,
        subscriptionId: subscription.id,
        organizationId: 'org_dunning',
        userId: 'user_dunning',
        amount: invoice.amountDue,
        currency: invoice.currency,
        paymentMethodId: paymentMethod.id,
      });

      // Simulate failed payment
      payment.status = 'failed';
      payment.failureCode = 'card_declined';
      payment.failureMessage = 'Your card was declined.';

      // Update subscription status
      const updatedSubscription = await subscriptionManager.updateStatusAfterPayment(
        subscription.id,
        false
      );
      expect(updatedSubscription.status).toBe(SubscriptionStatus.PAST_DUE);

      // Process dunning
      const dunningResult = await paymentProcessor.processDunning(payment.id, 1);
      expect(dunningResult.shouldRetry).toBe(true);
      expect(dunningResult.nextRetryDate).toBeDefined();

      // Retry payment
      const retriedPayment = await paymentProcessor.retryPayment(payment.id);
      expect(retriedPayment.status).toBe('succeeded');
    });
  });

  describe('Usage-based billing workflow', () => {
    it('should calculate overage charges', async () => {
      const subscription = await subscriptionManager.createSubscription({
        organizationId: 'org_overage',
        userId: 'user_overage',
        planId: 'plan_pro_monthly',
      });

      // Collect usage beyond limits
      const usageData = {
        requests: 15000, // Over 10,000 limit
        tokens: 15000000, // Over 10M limit
        cpuTime: 200000, // Over 180,000 limit
        storage: 200000000000, // Over 100GB limit
        bandwidth: 2000000000000, // Over 1TB limit
        apiCalls: 150000, // Over 100,000 limit
      };

      const invoice = await invoiceGenerator.generateUsageInvoice({
        organizationId: 'org_overage',
        userId: 'user_overage',
        subscriptionId: subscription.id,
        usageItems: [
          {
            metricType: 'requests',
            quantity: usageData.requests,
            unitPrice: 0.0001,
            description: 'Request overage',
          },
          {
            metricType: 'tokens',
            quantity: usageData.tokens,
            unitPrice: 0.000001,
            description: 'Token overage',
          },
        ],
        periodStart: new Date(),
        periodEnd: new Date(),
      });

      expect(invoice.amountDue).toBeGreaterThan(29); // Base pro price + overage
    });
  });

  describe('Analytics workflow', () => {
    it('should generate comprehensive analytics', async () => {
      // Create multiple subscriptions
      await subscriptionManager.createSubscription({
        organizationId: 'org_analytics',
        userId: 'user1',
        planId: 'plan_pro_monthly',
      });

      await subscriptionManager.createSubscription({
        organizationId: 'org_analytics',
        userId: 'user2',
        planId: 'plan_team_monthly',
      });

      // Calculate revenue metrics
      const revenueMetrics = await usageAnalyzer.calculateRevenueMetrics({
        subscriptions: [
          {
            planId: 'plan_pro_monthly',
            status: 'active',
            createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          },
          {
            planId: 'plan_team_monthly',
            status: 'active',
            createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        ],
        churnedSubscriptions: [
          {
            planId: 'plan_pro_monthly',
            canceledAt: new Date(),
            lifetimeValue: 348, // $29 * 12
          },
        ],
      });

      expect(revenueMetrics.mrr).toBe(128); // $29 + $99
      expect(revenueMetrics.arr).toBe(1536); // $128 * 12
      expect(revenueMetrics.arpu).toBe(64); // $128 / 2

      // Analyze churn
      const churnAnalysis = await usageAnalyzer.analyzeChurn({
        totalSubscriptions: 100,
        churnedSubscriptions: [
          {
            planId: 'plan_pro_monthly',
            canceledAt: new Date(),
            reason: 'too_expensive',
          },
          {
            planId: 'plan_pro_monthly',
            canceledAt: new Date(),
            reason: 'too_expensive',
          },
          {
            planId: 'plan_free',
            canceledAt: new Date(),
            reason: 'upgraded',
          },
        ],
      });

      expect(churnAnalysis.churnRate).toBe(0.03); // 3/100
      expect(churnAnalysis.reasons.length).toBeGreaterThan(0);
    });
  });
});
