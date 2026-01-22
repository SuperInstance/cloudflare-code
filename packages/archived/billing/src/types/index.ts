/**
 * Core types and interfaces for the billing system
 */

// ============================================================================
// Pricing and Plan Types
// ============================================================================

export enum PlanType {
  FREE = 'free',
  PRO = 'pro',
  TEAM = 'team',
  ENTERPRISE = 'enterprise',
}

export enum BillingInterval {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum UsageMetricType {
  REQUESTS = 'requests',
  TOKENS = 'tokens',
  CPU_TIME = 'cpu_time',
  STORAGE = 'storage',
  BANDWIDTH = 'bandwidth',
  API_CALLS = 'api_calls',
  SEATS = 'seats',
  PROJECTS = 'projects',
}

export interface PricingTier {
  id: string;
  name: string;
  type: PlanType;
  description: string;
  price: number;
  interval: BillingInterval;
  currency: string;
  limits: UsageLimits;
  features: string[];
  stripePriceId?: string;
  metadata?: Record<string, any>;
}

export interface UsageLimits {
  requestsPerDay: number;
  requestsPerMonth: number;
  tokensPerMonth: number;
  cpuTimePerMonth: number; // in seconds
  storage: number; // in bytes
  bandwidth: number; // in bytes
  apiCallsPerMonth: number;
  seats: number;
  projects: number;
}

export interface UsageMetric {
  type: UsageMetricType;
  value: number;
  unit: string;
  timestamp: Date;
  userId: string;
  organizationId: string;
  projectId?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Subscription Types
// ============================================================================

export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIALING = 'trialing',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid',
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired',
}

export interface Subscription {
  id: string;
  organizationId: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionItem {
  id: string;
  subscriptionId: string;
  priceId: string;
  quantity: number;
  metadata?: Record<string, any>;
}

export interface SubscriptionChangeRequest {
  subscriptionId: string;
  newPlanId: string;
  prorate: boolean;
  effectiveImmediately: boolean;
  reason?: string;
}

export interface TrialExtension {
  subscriptionId: string;
  additionalDays: number;
  reason: string;
}

// ============================================================================
// Invoice Types
// ============================================================================

export enum InvoiceStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  PAID = 'paid',
  VOID = 'void',
  UNCOLLECTIBLE = 'uncollectible',
}

export interface Invoice {
  id: string;
  subscriptionId: string;
  organizationId: string;
  userId: string;
  status: InvoiceStatus;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  currency: string;
  dueDate: Date;
  paidAt?: Date;
  stripeInvoiceId?: string;
  lineItems: InvoiceLineItem[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  metadata?: Record<string, any>;
}

export interface InvoiceItem {
  subscriptionId: string;
  amount: number;
  currency: string;
  description: string;
  quantity?: number;
  unitPrice?: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// Payment Types
// ============================================================================

export enum PaymentMethodType {
  CARD = 'card',
  BANK_ACCOUNT = 'bank_account',
  SEPA_DEBIT = 'sepa_debit',
  US_BANK_ACCOUNT = 'us_bank_account',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export interface PaymentMethod {
  id: string;
  organizationId: string;
  userId: string;
  type: PaymentMethodType;
  isDefault: boolean;
  lastFour?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  stripePaymentMethodId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface Payment {
  id: string;
  invoiceId: string;
  subscriptionId: string;
  organizationId: string;
  userId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethodId: string;
  stripePaymentIntentId?: string;
  failureCode?: string;
  failureMessage?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  reason: string;
  status: PaymentStatus;
  stripeRefundId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// ============================================================================
// Usage Analytics Types
// ============================================================================

export interface UsageSummary {
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  metrics: {
    requests: UsageMetricSummary;
    tokens: UsageMetricSummary;
    cpuTime: UsageMetricSummary;
    storage: UsageMetricSummary;
    bandwidth: UsageMetricSummary;
    apiCalls: UsageMetricSummary;
  };
  costBreakdown: CostBreakdown;
}

export interface UsageMetricSummary {
  total: number;
  average: number;
  peak: number;
  unit: string;
  limit?: number;
  utilizationPercent?: number;
}

export interface CostBreakdown {
  baseCost: number;
  usageCost: number;
  overageCost: number;
  totalCost: number;
  currency: string;
  items: CostItem[];
}

export interface CostItem {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface UsageForecast {
  organizationId: string;
  forecastPeriod: {
    start: Date;
    end: Date;
  };
  metrics: {
    requests: ForecastData;
    tokens: ForecastData;
    cpuTime: ForecastData;
    storage: ForecastData;
    bandwidth: ForecastData;
  };
  projectedCost: number;
  recommendations: string[];
}

export interface ForecastData {
  projected: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
  unit: string;
}

// ============================================================================
// Metering Types
// ============================================================================

export interface MeteringConfig {
  enabled: boolean;
  aggregationWindow: number; // in seconds
  retentionPeriod: number; // in days
  realTimeEnabled: boolean;
  batchProcessingEnabled: boolean;
}

export interface MeteringEvent {
  eventType: string;
  organizationId: string;
  userId: string;
  timestamp: Date;
  metrics: Record<string, number>;
  metadata?: Record<string, any>;
}

export interface UsageRecord {
  id: string;
  organizationId: string;
  userId: string;
  metricType: UsageMetricType;
  quantity: number;
  unit: string;
  timestamp: Date;
  projectId?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Billing Configuration Types
// ============================================================================

export interface BillingConfig {
  stripe: {
    secretKey: string;
    publishableKey: string;
    webhookSecret: string;
    apiUrl: string;
  };
  metering: MeteringConfig;
  pricing: {
    currency: string;
    taxRate: number;
    overageMultiplier: number;
  };
  invoicing: {
    autoGenerate: boolean;
    billingDayOfMonth: number;
    dueDays: number;
    reminderDays: number[];
  };
  payment: {
    autoRetry: boolean;
    retrySchedule: number[];
    maxRetryAttempts: number;
  };
}

// ============================================================================
// Error Types
// ============================================================================

export enum BillingErrorCode {
  INVALID_PLAN = 'INVALID_PLAN',
  SUBSCRIPTION_NOT_FOUND = 'SUBSCRIPTION_NOT_FOUND',
  SUBSCRIPTION_ACTIVE = 'SUBSCRIPTION_ACTIVE',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_METHOD_NOT_FOUND = 'PAYMENT_METHOD_NOT_FOUND',
  INVOICE_NOT_FOUND = 'INVOICE_NOT_FOUND',
  USAGE_LIMIT_EXCEEDED = 'USAGE_LIMIT_EXCEEDED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TRIAL_EXPIRED = 'TRIAL_EXPIRED',
  CUSTOMER_NOT_FOUND = 'CUSTOMER_NOT_FOUND',
  INVALID_SUBSCRIPTION_CHANGE = 'INVALID_SUBSCRIPTION_CHANGE',
  PRORATION_FAILED = 'PRORATION_FAILED',
  REFUND_FAILED = 'REFUND_FAILED',
  STRIPE_ERROR = 'STRIPE_ERROR',
  METERING_ERROR = 'METERING_ERROR',
}

export class BillingError extends Error {
  constructor(
    public code: BillingErrorCode,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'BillingError';
  }
}

// ============================================================================
// Webhook Types
// ============================================================================

export enum WebhookEventType {
  INVOICE_CREATED = 'invoice.created',
  INVOICE_PAID = 'invoice.paid',
  INVOICE_PAYMENT_FAILED = 'invoice.payment_failed',
  CUSTOMER_SUBSCRIPTION_CREATED = 'customer.subscription.created',
  CUSTOMER_SUBSCRIPTION_UPDATED = 'customer.subscription.updated',
  CUSTOMER_SUBSCRIPTION_DELETED = 'customer.subscription.deleted',
  PAYMENT_INTENT_SUCCEEDED = 'payment_intent.succeeded',
  PAYMENT_INTENT_PAYMENT_FAILED = 'payment_intent.payment_failed',
}

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  data: any;
  timestamp: Date;
  processed: boolean;
}

// ============================================================================
// Report Types
// ============================================================================

export interface BillingReport {
  id: string;
  organizationId: string;
  reportType: 'usage' | 'cost' | 'revenue' | 'churn';
  periodStart: Date;
  periodEnd: Date;
  data: any;
  generatedAt: Date;
}

export interface RevenueMetrics {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  arpu: number; // Average Revenue Per User
  ltv: number; // Lifetime Value
  churnRate: number;
  growthRate: number;
}

export interface ChurnAnalysis {
  totalSubscriptions: number;
  churnedSubscriptions: number;
  churnRate: number;
  reasons: ChurnReason[];
  byPlan: Record<PlanType, number>;
}

export interface ChurnReason {
  reason: string;
  count: number;
  percentage: number;
}

// ============================================================================
// Discount and Coupon Types
// ============================================================================

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed_amount';
  amountOff?: number;
  percentOff?: number;
  currency?: string;
  duration: 'once' | 'repeating' | 'forever';
  durationInMonths?: number;
  maxRedemptions?: number;
  timesRedeemed: number;
  valid: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface Discount {
  couponId: string;
  subscriptionId: string;
  amountOff: number;
  validFrom: Date;
  validUntil?: Date;
}

// ============================================================================
// Audit Types
// ============================================================================

export interface BillingAuditLog {
  id: string;
  organizationId: string;
  userId: string;
  action: string;
  entityType: 'subscription' | 'invoice' | 'payment' | 'plan' | 'coupon';
  entityId: string;
  changes: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
