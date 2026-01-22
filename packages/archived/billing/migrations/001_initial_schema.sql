-- Initial schema for ClaudeFlare billing system
-- This file contains the database schema for D1 (Cloudflare's SQLite)

-- ============================================================================
-- Subscriptions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired')),
  current_period_start DATETIME NOT NULL,
  current_period_end DATETIME NOT NULL,
  trial_start DATETIME,
  trial_end DATETIME,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT 0,
  canceled_at DATETIME,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  metadata TEXT, -- JSON
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_organization ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);

-- ============================================================================
-- Subscription Items Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscription_items (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  price_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  metadata TEXT, -- JSON
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(subscription_id, price_id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_items_subscription ON subscription_items(subscription_id);

-- ============================================================================
-- Invoices Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  amount_due DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
  amount_remaining DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  due_date DATETIME NOT NULL,
  paid_at DATETIME,
  stripe_invoice_id TEXT UNIQUE,
  invoice_number TEXT,
  metadata TEXT, -- JSON
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_organization ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- ============================================================================
-- Invoice Line Items Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  period_start DATETIME NOT NULL,
  period_end DATETIME NOT NULL,
  metadata TEXT, -- JSON
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);

-- ============================================================================
-- Payment Methods Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('card', 'bank_account', 'sepa_debit', 'us_bank_account')),
  is_default BOOLEAN NOT NULL DEFAULT 0,
  last_four TEXT,
  brand TEXT,
  expiry_month INTEGER,
  expiry_year INTEGER,
  stripe_payment_method_id TEXT UNIQUE,
  metadata TEXT, -- JSON
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_organization ON payment_methods(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(organization_id, is_default);

-- ============================================================================
-- Payments Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
  payment_method_id TEXT NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
  stripe_payment_intent_id TEXT UNIQUE,
  failure_code TEXT,
  failure_message TEXT,
  metadata TEXT, -- JSON
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_organization ON payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- ============================================================================
-- Refunds Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
  stripe_refund_id TEXT UNIQUE,
  metadata TEXT, -- JSON
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- ============================================================================
-- Usage Records Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('requests', 'tokens', 'cpu_time', 'storage', 'bandwidth', 'api_calls', 'seats', 'projects')),
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  project_id TEXT,
  metadata TEXT, -- JSON
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usage_records_organization ON usage_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_user ON usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_metric_type ON usage_records(metric_type);
CREATE INDEX IF NOT EXISTS idx_usage_records_timestamp ON usage_records(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_records_org_timestamp ON usage_records(organization_id, timestamp);

-- ============================================================================
-- Usage Aggregates Table (for faster queries)
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage_aggregates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  period_start DATETIME NOT NULL,
  period_end DATETIME NOT NULL,
  total_quantity INTEGER NOT NULL,
  record_count INTEGER NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, metric_type, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_usage_aggregates_organization ON usage_aggregates(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_aggregates_metric_type ON usage_aggregates(metric_type);
CREATE INDEX IF NOT EXISTS idx_usage_aggregates_period ON usage_aggregates(period_start, period_end);

-- ============================================================================
-- Coupons Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  amount_off DECIMAL(10, 2),
  percent_off DECIMAL(5, 2),
  currency TEXT DEFAULT 'USD',
  duration TEXT NOT NULL CHECK (duration IN ('once', 'repeating', 'forever')),
  duration_in_months INTEGER,
  max_redemptions INTEGER,
  times_redeemed INTEGER NOT NULL DEFAULT 0,
  valid BOOLEAN NOT NULL DEFAULT 1,
  metadata TEXT, -- JSON
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_valid ON coupons(valid);

-- ============================================================================
-- Discounts Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS discounts (
  id TEXT PRIMARY KEY,
  coupon_id TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount_off DECIMAL(10, 2) NOT NULL,
  valid_from DATETIME NOT NULL,
  valid_until DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(subscription_id, coupon_id)
);

CREATE INDEX IF NOT EXISTS idx_discounts_subscription ON discounts(subscription_id);
CREATE INDEX IF NOT EXISTS idx_discounts_coupon ON discounts(coupon_id);

-- ============================================================================
-- Audit Log Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS billing_audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('subscription', 'invoice', 'payment', 'plan', 'coupon')),
  entity_id TEXT NOT NULL,
  changes TEXT, -- JSON
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_organization ON billing_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON billing_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON billing_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON billing_audit_logs(created_at);

-- ============================================================================
-- Webhook Events Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON
  processed BOOLEAN NOT NULL DEFAULT 0,
  processing_attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);

-- ============================================================================
-- Billing Reports Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS billing_reports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('usage', 'cost', 'revenue', 'churn')),
  period_start DATETIME NOT NULL,
  period_end DATETIME NOT NULL,
  data TEXT NOT NULL, -- JSON
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_reports_organization ON billing_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_reports_type ON billing_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_billing_reports_period ON billing_reports(period_start, period_end);

-- ============================================================================
-- Triggers for automatic timestamp updates
-- ============================================================================

-- Update updated_at timestamp for subscriptions
CREATE TRIGGER IF NOT EXISTS update_subscriptions_updated_at
AFTER UPDATE ON subscriptions
BEGIN
  UPDATE subscriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update updated_at timestamp for invoices
CREATE TRIGGER IF NOT EXISTS update_invoices_updated_at
AFTER UPDATE ON invoices
BEGIN
  UPDATE invoices SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update updated_at timestamp for payments
CREATE TRIGGER IF NOT EXISTS update_payments_updated_at
AFTER UPDATE ON payments
BEGIN
  UPDATE payments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update updated_at timestamp for usage aggregates
CREATE TRIGGER IF NOT EXISTS update_usage_aggregates_updated_at
AFTER UPDATE ON usage_aggregates
BEGIN
  UPDATE usage_aggregates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
