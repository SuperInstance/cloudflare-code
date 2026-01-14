/**
 * Authentication and Authorization Module
 *
 * Comprehensive auth system with JWT, OAuth, API keys, RBAC, and rate limiting.
 */

// Types
export * from './types';

// JWT
export {
  generateRSAKeyPair,
  signJWT,
  verifyJWT,
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  validateAccessToken,
  validateRefreshToken,
  decodeJWT,
  extractToken,
  getTokenExpiration,
  isTokenExpired,
  getTimeUntilExpiration,
  refreshAccessToken,
  getDefaultPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from './jwt';

// OAuth
export {
  generateOAuthState,
  generateCodeVerifier,
  generateCodeChallenge,
  generateNonce,
  getGitHubAuthUrl,
  exchangeGitHubCode,
  getGitHubProfile,
  getGoogleAuthUrl,
  exchangeGoogleCode,
  getGoogleProfile,
  OAuthService,
  DEFAULT_GITHUB_SCOPES,
  DEFAULT_GOOGLE_SCOPES,
  createOAuthConfig,
} from './oauth';

// API Keys
export {
  generateAPIKey,
  extractAPIKeyPrefix,
  hashAPIKey,
  verifyAPIKey,
  validateAPIKeyFormat,
  getAPIKeyTypeFromPrefix,
  isAPIKeyExpired,
  isAPIKeyValid,
  APIKeyManager,
  extractAPIKeyFromHeader,
  maskAPIKey,
  getAPIKeyInfo,
} from './api-keys';

// Session
export {
  AuthSessionDO,
  createAuthSessionStub,
  createAuthSession,
  validateAuthSession,
  deleteAuthSession,
  rotateAuthRefreshToken,
} from './session';

// RBAC
export {
  hasRoleLevel,
  getHigherOrEqualRoles,
  getRolePermissions,
  getUserPermissions,
  getMemberPermissions,
  hasPermission as rbacHasPermission,
  hasAnyPermission as rbacHasAnyPermission,
  hasAllPermissions as rbacHasAllPermissions,
  canAccessResource,
  AuthorizationService,
  parsePermission,
  stringifyPermission,
  parsePermissions,
  stringifyPermissions,
  isValidPermission,
  actionImplies,
  mergePermissions,
  hashPermissions,
  OrganizationRBAC,
} from './rbac';

// Middleware
export {
  authMiddleware as authentication,
  requireAuth,
  requireRole,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  requireOrganization,
  optionalAuth,
  requireAdmin,
  requirePro,
  requireUser,
  csrfMiddleware,
  securityHeaders,
  getAuthContext,
  isAuthenticated,
  getUserId,
  getUserRole,
  checkPermission,
  generateCSRFToken,
  validateCSRFToken,
} from './middleware';

// Rate Limiting
export {
  AuthRateLimiter,
  TokenBucketRateLimiter,
  ConcurrentRequestLimiter,
  rateLimitMiddleware,
  rateLimitHeaders,
  createRateLimitMiddleware,
  createRateLimitMiddlewareWithConfig,
  getRateLimitInfo,
  isRateLimited,
  getRetryAfter,
  type RateLimitConfig,
  type RateLimitInfo,
  type CustomRateLimit,
} from './rate-limit';

// Default exports
export { AuthError } from './types';
export { DEFAULT_RATE_LIMITS, type RoleRateLimits } from './types';
