-- Authentication and Authorization Database Schema
-- For Cloudflare D1 (SQLite)

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT, -- Optional (OAuth users won't have this)
  name TEXT,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('anonymous', 'user', 'pro', 'admin', 'service_account')),
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  mfa_secret TEXT,
  recovery_codes TEXT, -- JSON array
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER,
  metadata TEXT, -- JSON object
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- ORGANIZATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL REFERENCES users(id),
  settings TEXT, -- JSON object
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_owner ON organizations(owner_id);

-- ============================================================================
-- ORGANIZATION MEMBERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_members (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'pro', 'admin')),
  permissions TEXT, -- JSON array of permissions
  invited_by TEXT NOT NULL REFERENCES users(id),
  invited_at INTEGER NOT NULL,
  joined_at INTEGER,
  PRIMARY KEY (user_id, organization_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

-- ============================================================================
-- API KEYS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  key_type TEXT NOT NULL CHECK (key_type IN ('personal', 'organization', 'service', 'test')),
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  permissions TEXT, -- JSON array
  rate_limit TEXT, -- JSON object
  scopes TEXT, -- JSON array
  expires_at INTEGER,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  revoked_at INTEGER,
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

-- ============================================================================
-- REFRESH TOKENS TABLE (optional, if not using DO)
-- ============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  revoked_at INTEGER,
  rotation_count INTEGER NOT NULL DEFAULT 0,
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_session ON refresh_tokens(session_id);

-- ============================================================================
-- AUDIT LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  session_id TEXT,
  resource_id TEXT,
  resource_type TEXT,
  action TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp INTEGER NOT NULL,
  metadata TEXT, -- JSON object
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_event ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

-- ============================================================================
-- SESSION METADATA TABLE (optional, for enhanced tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS session_metadata (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  location TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  created_at INTEGER NOT NULL,
  last_activity INTEGER NOT NULL,
);

CREATE INDEX idx_session_metadata_user ON session_metadata(user_id);
CREATE INDEX idx_session_metadata_activity ON session_metadata(last_activity);

-- ============================================================================
-- RATE LIMIT TRACKING TABLE (optional, if not using KV)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limit_tracking (
  identifier TEXT NOT NULL,
  window TEXT NOT NULL, -- 'minute', 'hour', 'day'
  count INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL,
  last_request INTEGER NOT NULL,
  PRIMARY KEY (identifier, window)
);

CREATE INDEX idx_rate_limit_reset ON rate_limit_tracking(reset_at);

-- ============================================================================
-- OAUTH ACCOUNTS TABLE (link external accounts to users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'github', 'google'
  provider_user_id TEXT NOT NULL,
  provider_email TEXT,
  provider_username TEXT,
  provider_avatar TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX idx_oauth_accounts_user ON oauth_accounts(user_id);
CREATE INDEX idx_oauth_accounts_provider ON oauth_accounts(provider, provider_user_id);

-- ============================================================================
-- MFA SECRETS TABLE (separate table for security)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mfa_secrets (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  backup_codes TEXT, -- JSON array
  verified INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
);

-- ============================================================================
-- PASSWORD RESET TOKENS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  used_at INTEGER,
);

CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_expires ON password_reset_tokens(expires_at);

-- ============================================================================
-- INVITATIONS TABLE (for organization invitations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  invited_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  accepted INTEGER NOT NULL DEFAULT 0,
  accepted_at INTEGER,
  accepted_by TEXT REFERENCES users(id),
);

CREATE INDEX idx_invitations_org ON invitations(organization_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_expires ON invitations(expires_at);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active users (logged in within last 30 days)
CREATE VIEW IF NOT EXISTS active_users AS
SELECT DISTINCT u.*
FROM users u
WHERE u.last_login_at > (strftime('%s', 'now') - 30 * 24 * 60 * 60) * 1000;

-- Organization members with user details
CREATE VIEW IF NOT EXISTS organization_members_details AS
SELECT
  om.user_id,
  om.organization_id,
  om.role,
  u.email,
  u.name,
  u.avatar,
  om.invited_at,
  om.joined_at
FROM organization_members om
JOIN users u ON om.user_id = u.id;

-- Active API keys (not revoked and not expired)
CREATE VIEW IF NOT EXISTS active_api_keys AS
SELECT *
FROM api_keys
WHERE revoked = 0
  AND (expires_at IS NULL OR expires_at > strftime('%s', 'now') * 1000);

-- Recent audit logs (last 7 days)
CREATE VIEW IF NOT EXISTS recent_audit_logs AS
SELECT *
FROM audit_logs
WHERE timestamp > (strftime('%s', 'now') - 7 * 24 * 60 * 60) * 1000
ORDER BY timestamp DESC;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Update user updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_user_timestamp
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = strftime('%s', 'now') * 1000
  WHERE id = NEW.id;
END;

-- Update organization updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_organization_timestamp
AFTER UPDATE ON organizations
FOR EACH ROW
BEGIN
  UPDATE organizations SET updated_at = strftime('%s', 'now') * 1000
  WHERE id = NEW.id;
END;

-- Update organization member count
CREATE TRIGGER IF NOT EXISTS update_org_member_count
AFTER INSERT ON organization_members
FOR EACH ROW
BEGIN
  UPDATE organizations
  SET member_count = (
    SELECT COUNT(*)
    FROM organization_members
    WHERE organization_id = NEW.organization_id
  )
  WHERE id = NEW.organization_id;
END;

CREATE TRIGGER IF NOT EXISTS update_org_member_count_delete
AFTER DELETE ON organization_members
FOR EACH ROW
BEGIN
  UPDATE organizations
  SET member_count = (
    SELECT COUNT(*)
    FROM organization_members
    WHERE organization_id = OLD.organization_id
  )
  WHERE id = OLD.organization_id;
END;

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get user with permissions
-- SELECT u.*, JSON_GROUP_ARRAY(DISTINCT ap.scope) as available_scopes
-- FROM users u
-- LEFT JOIN api_keys ap ON u.id = ap.user_id AND ap.revoked = 0
-- WHERE u.id = ? GROUP BY u.id;

-- Get user's organizations
-- SELECT o.*, om.role as member_role, om.permissions as member_permissions
-- FROM organizations o
-- JOIN organization_members om ON o.id = om.organization_id
-- WHERE om.user_id = ?;

-- Get active sessions for user
-- SELECT * FROM session_metadata
-- WHERE user_id = ? AND last_activity > ?
-- ORDER BY last_activity DESC;

-- Get recent audit logs for user
-- SELECT * FROM audit_logs
-- WHERE user_id = ?
-- ORDER BY timestamp DESC
-- LIMIT 100;

-- Get rate limit status
-- SELECT * FROM rate_limit_tracking
-- WHERE identifier = ? AND reset_at > ?;

-- ============================================================================
-- CLEANUP JOBS (run periodically)
-- ============================================================================

-- Delete expired refresh tokens (older than 30 days)
-- DELETE FROM refresh_tokens WHERE expires_at < strftime('%s', 'now') * 1000 - 30 * 24 * 60 * 60 * 1000;

-- Delete old audit logs (older than 90 days)
-- DELETE FROM audit_logs WHERE timestamp < strftime('%s', 'now') * 1000 - 90 * 24 * 60 * 60 * 1000;

-- Delete expired invitations
-- DELETE FROM invitations WHERE expires_at < strftime('%s', 'now') * 1000 AND accepted = 0;

-- Delete used password reset tokens (older than 24 hours)
-- DELETE FROM password_reset_tokens WHERE used = 1 AND used_at < strftime('%s', 'now') * 1000 - 24 * 60 * 60 * 1000;

-- Delete old session metadata (older than 30 days)
-- DELETE FROM session_metadata WHERE last_activity < strftime('%s', 'now') * 1000 - 30 * 24 * 60 * 60 * 1000;
