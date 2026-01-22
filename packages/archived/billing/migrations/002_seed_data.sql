-- Seed data for ClaudeFlare billing system

-- ============================================================================
-- Seed Coupons
-- ============================================================================

INSERT INTO coupons (id, code, discount_type, percent_off, duration, max_redemptions, valid, metadata) VALUES
  ('coupon_welcome2024', 'WELCOME2024', 'percentage', 50.00, 'once', 1000, 1, '{"description": "50% off first month for new users"}'),
  ('coupon_annual20', 'ANNUAL20', 'percentage', 20.00, 'repeating', 5000, 1, '{"description": "20% off annual plans", "duration_in_months": 12}'),
  ('coupon_startup25', 'STARTUP25', 'percentage', 25.00, 'repeating', 500, 1, '{"description": "25% off for startups", "duration_in_months": 3}'),
  ('coupon_free_trial', 'FREETRIAL', 'fixed_amount', 29.00, 'once', 10000, 1, '{"description": "Free trial of Pro plan"}');

-- ============================================================================
-- Seed Default Organizations (for testing)
-- ============================================================================

-- Note: In production, these would be created through the application
-- This is just for development/testing purposes

-- ============================================================================
-- Seed Audit Logs
-- ============================================================================

INSERT INTO billing_audit_logs (id, organization_id, user_id, action, entity_type, entity_id, changes) VALUES
  ('audit_001', 'org_demo', 'user_admin', 'create', 'subscription', 'sub_demo_001', '{"plan": "pro", "interval": "monthly"}'),
  ('audit_002', 'org_demo', 'user_admin', 'update', 'subscription', 'sub_demo_001', '{"status": "active"}');
