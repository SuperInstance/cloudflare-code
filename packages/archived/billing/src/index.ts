/**
 * ClaudeFlare Billing System
 *
 * Enterprise-grade billing and pricing system with:
 * - Usage-based billing
 * - Subscription management
 * - Enterprise pricing tiers
 * - Invoice generation
 * - Payment processing
 * - Usage analytics and forecasting
 */

// Export types
export * from './types/index.js';

// Export pricing
export * from './pricing/index.js';

// Export metering
export * from './metering/index.js';

// Export subscriptions
export * from './subscriptions/index.js';

// Export invoicing
export * from './invoicing/index.js';

// Export payments
export * from './payments/index.js';

// Export analytics
export * from './analytics/index.js';

// Export utilities
export * from './utils/index.js';

// Re-export commonly used items
export {
  // Pricing
  PRICING_TIERS,
  YEARLY_PRICING_TIERS,
  OVERAGE_RATES,
  PricingManager,
  pricingManager,
} from './pricing/index.js';

// Re-export factory functions
export {
  createUsageMeter,
} from './metering/index.js';

export {
  createUsageCollector,
} from './metering/collector.js';

export {
  createSubscriptionManager,
} from './subscriptions/index.js';

export {
  createInvoiceGenerator,
} from './invoicing/index.js';

export {
  createPaymentProcessor,
} from './payments/index.js';

export {
  createUsageAnalyzer,
} from './analytics/index.js';
