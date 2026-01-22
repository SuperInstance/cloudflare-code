# @claudeflare/billing

Enterprise-grade billing and pricing system for ClaudeFlare, built for Cloudflare Workers with D1 database support.

## Features

- **Usage-Based Billing**: Track and bill based on actual usage
- **Subscription Management**: Full lifecycle management with trials, upgrades, and downgrades
- **Enterprise Pricing Tiers**: Free, Pro, Team, and Enterprise plans
- **Invoice Generation**: Automated invoice creation and management
- **Payment Processing**: Stripe integration with payment method management
- **Usage Analytics**: Detailed usage tracking, forecasting, and insights
- **Dunning Management**: Automated retry logic for failed payments
- **Revenue Analytics**: MRR, ARR, churn analysis, and more

## Pricing Tiers

### Free Tier ($0/month)
- 100 requests/day
- 100,000 tokens/month
- 1 GB storage
- 10 GB bandwidth
- 1 user seat

### Pro Tier ($29/month)
- 10,000 requests/day
- 10M tokens/month
- 100 GB storage
- 1 TB bandwidth
- 5 user seats
- Advanced AI features
- API access

### Team Tier ($99/month)
- 50,000 requests/day
- 50M tokens/month
- 500 GB storage
- 5 TB bandwidth
- 20 user seats
- Team collaboration
- SSO authentication
- 99.9% SLA

### Enterprise Tier (Custom)
- Unlimited requests
- Custom AI models
- Dedicated support
- 99.99% SLA
- On-premise options
- Custom contracts

## Installation

```bash
npm install @claudeflare/billing
```

## Quick Start

```typescript
import {
  createSubscriptionManager,
  createUsageMeter,
  createInvoiceGenerator,
  createPaymentProcessor,
} from '@claudeflare/billing';

// Initialize services
const subscriptionManager = createSubscriptionManager();
const usageMeter = createUsageMeter();
const invoiceGenerator = createInvoiceGenerator();
const paymentProcessor = createPaymentProcessor();

// Create a subscription
const subscription = await subscriptionManager.createSubscription({
  organizationId: 'org_123',
  userId: 'user_456',
  planId: 'plan_pro_monthly',
  trialDays: 14,
});

// Track usage
await usageMeter.recordMetric({
  type: 'requests',
  value: 1,
  unit: 'requests',
  timestamp: new Date(),
  userId: 'user_456',
  organizationId: 'org_123',
});

// Generate invoice
const invoice = await invoiceGenerator.generateSubscriptionInvoice(subscription);

// Process payment
const payment = await paymentProcessor.createPaymentIntent({
  invoiceId: invoice.id,
  subscriptionId: subscription.id,
  organizationId: 'org_123',
  userId: 'user_456',
  amount: invoice.amountDue,
  currency: 'USD',
  paymentMethodId: 'pm_123',
});
```

## Usage Tracking

### Request Metrics

```typescript
import { createUsageCollector } from '@claudeflare/billing';

const collector = createUsageCollector(usageMeter);

await collector.collectRequestMetrics({
  userId: 'user_123',
  organizationId: 'org_456',
  endpoint: '/api/v1/generate',
  method: 'POST',
  statusCode: 200,
  timestamp: new Date(),
  duration: 1500, // milliseconds
  tokenCount: {
    prompt: 100,
    completion: 200,
    total: 300,
  },
  requestBody: 1000, // bytes
  responseBody: 5000, // bytes
});
```

### Check Usage Limits

```typescript
const { exceeds, current, remaining } = await usageMeter.checkLimit(
  'org_456',
  'requests',
  10000 // limit
);

if (exceeds) {
  console.log(`Over limit! Used ${current} of ${limit}`);
}
```

## Subscription Management

### Create Subscription

```typescript
const subscription = await subscriptionManager.createSubscription({
  organizationId: 'org_123',
  userId: 'user_456',
  planId: 'plan_pro_monthly',
  trialDays: 14,
  metadata: {
    source: 'website',
    campaign: 'launch_2024',
  },
});
```

### Change Plan

```typescript
await subscriptionManager.changePlan({
  subscriptionId: subscription.id,
  newPlanId: 'plan_team_monthly',
  prorate: true,
  effectiveImmediately: true,
  reason: 'Team expanded',
});
```

### Cancel Subscription

```typescript
// Cancel at period end
await subscriptionManager.cancelSubscription(subscription.id, true);

// Cancel immediately
await subscriptionManager.cancelSubscription(subscription.id, false);
```

## Invoice Generation

### Generate Invoice

```typescript
const invoice = await invoiceGenerator.generateSubscriptionInvoice(subscription);
await invoiceGenerator.finalizeInvoice(invoice.id);
```

### Usage-Based Invoice

```typescript
const invoice = await invoiceGenerator.generateUsageInvoice({
  organizationId: 'org_123',
  userId: 'user_456',
  subscriptionId: 'sub_789',
  usageItems: [
    {
      metricType: 'requests',
      quantity: 5000,
      unitPrice: 0.0001,
      description: 'API Requests overage',
    },
  ],
  periodStart: new Date('2024-01-01'),
  periodEnd: new Date('2024-01-31'),
});
```

## Payment Processing

### Add Payment Method

```typescript
const paymentMethod = await paymentProcessor.addPaymentMethod({
  organizationId: 'org_123',
  userId: 'user_456',
  type: 'card',
  cardDetails: {
    lastFour: '4242',
    brand: 'visa',
    expiryMonth: 12,
    expiryYear: 2025,
  },
  isDefault: true,
});
```

### Process Payment

```typescript
const payment = await paymentProcessor.createPaymentIntent({
  invoiceId: invoice.id,
  subscriptionId: subscription.id,
  organizationId: 'org_123',
  userId: 'user_456',
  amount: invoice.amountDue,
  currency: 'USD',
  paymentMethodId: paymentMethod.id,
});

const confirmed = await paymentProcessor.confirmPayment(payment.id);
```

## Analytics & Forecasting

### Usage Summary

```typescript
import { createUsageAnalyzer } from '@claudeflare/billing';

const analyzer = createUsageAnalyzer();

const summary = await analyzer.generateUsageSummary({
  organizationId: 'org_123',
  periodStart: new Date('2024-01-01'),
  periodEnd: new Date('2024-01-31'),
  usageData: {
    requests: 25000,
    tokens: 15000000,
    cpuTime: 150000,
    storage: 200000000000,
    bandwidth: 3000000000000,
    apiCalls: 250000,
  },
  planType: 'pro',
});

console.log('Total cost:', summary.costBreakdown.totalCost);
```

### Usage Forecast

```typescript
const forecast = await analyzer.generateForecast({
  organizationId: 'org_123',
  forecastStart: new Date('2024-02-01'),
  forecastEnd: new Date('2024-02-29'),
  historicalData: {
    requests: [20000, 22000, 25000, 27000],
    tokens: [12000000, 13500000, 15000000, 16500000],
    cpuTime: [120000, 135000, 150000, 165000],
    storage: [180000000000, 190000000000, 200000000000, 210000000000],
    bandwidth: [2500000000000, 2750000000000, 3000000000000, 3250000000000],
  },
  planType: 'pro',
});

console.log('Projected cost:', forecast.projectedCost);
console.log('Recommendations:', forecast.recommendations);
```

### Revenue Metrics

```typescript
const metrics = await analyzer.calculateRevenueMetrics({
  subscriptions: [...],
  churnedSubscriptions: [...],
});

console.log('MRR:', metrics.mrr);
console.log('ARR:', metrics.arr);
console.log('Churn rate:', metrics.churnRate);
```

## Database Schema

The system uses D1 (Cloudflare's SQLite) with the following main tables:

- `subscriptions` - Subscription records
- `invoices` - Invoice records
- `payments` - Payment records
- `payment_methods` - Payment method records
- `usage_records` - Raw usage data
- `usage_aggregates` - Aggregated usage for faster queries
- `coupons` - Discount coupons
- `billing_audit_logs` - Audit trail

See `migrations/001_initial_schema.sql` for the complete schema.

## Stripe Integration

The billing system integrates with Stripe for payment processing:

1. Set your Stripe API keys in environment variables:
   ```bash
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

2. Stripe objects are synced with local database for reliability

3. Webhooks are supported for real-time payment updates

## API Reference

### Classes

- `UsageMeter` - Track and aggregate usage metrics
- `UsageCollector` - Collect metrics from requests and API calls
- `SubscriptionManager` - Manage subscription lifecycle
- `InvoiceGenerator` - Generate and manage invoices
- `PaymentProcessor` - Process payments and refunds
- `UsageAnalyzer` - Analyze usage and generate forecasts
- `PricingManager` - Manage pricing tiers and calculate costs

### Types

See `src/types/index.ts` for complete type definitions.

## Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

## License

MIT

## Support

For issues and questions, please use the GitHub issue tracker.
