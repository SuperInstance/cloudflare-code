/**
 * Authentication and Authorization Type Definitions
 *
 * Comprehensive types for JWT, OAuth, API keys, sessions, RBAC, and multi-tenancy
 */

import { z } from 'zod';

// ============================================================================
// USER ROLES
// ============================================================================

/**
 * User roles with hierarchical permissions
 */
export enum UserRole {
  ANONYMOUS = 'anonymous',     // Read-only, rate limited
  USER = 'user',               // Basic features, personal API key
  PRO = 'pro',                 // Higher limits, priority routing
  ADMIN = 'admin',             // Full access, user management
  SERVICE_ACCOUNT = 'service_account', // API-only, elevated permissions
}

/**
 * Zod schema for UserRole
 */
export const UserRoleSchema = z.enum([
  'anonymous',
  'user',
  'pro',
  'admin',
  'service_account',
]);

// ============================================================================
// PERMISSIONS
// ============================================================================

/**
 * Resource types for fine-grained permissions
 */
export enum Resource {
  // Chat resources
  CHAT = 'chat',
  CHAT_STREAM = 'chat_stream',

  // Model resources
  MODELS = 'models',
  MODELS_PREMIUM = 'models_premium',

  // Codebase resources
  CODEBASE = 'codebase',
  CODEBASE_UPLOAD = 'codebase_upload',
  CODEBASE_SEARCH = 'codebase_search',

  // Agent resources
  AGENTS = 'agents',
  AGENTS_ORCHESTRATE = 'agents_orchestrate',

  // Metrics resources
  METRICS = 'metrics',
  METRICS_DETAILED = 'metrics_detailed',

  // User management
  USERS = 'users',
  USERS_MANAGE = 'users_manage',

  // Organization resources
  ORGANIZATIONS = 'organizations',
  ORGANIZATIONS_MANAGE = 'organizations_manage',

  // API keys
  API_KEYS = 'api_keys',
  API_KEYS_MANAGE = 'api_keys_manage',

  // Sessions
  SESSIONS = 'sessions',
  SESSIONS_MANAGE = 'sessions_manage',
}

/**
 * Action types for permissions
 */
export enum Action {
  READ = 'read',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  EXECUTE = 'execute',
  MANAGE = 'manage',
}

/**
 * Permission definition
 */
export interface Permission {
  resource: Resource;
  action: Action;
  conditions?: Record<string, unknown>;
}

/**
 * Zod schema for Permission
 */
export const PermissionSchema = z.object({
  resource: z.nativeEnum(Resource),
  action: z.nativeEnum(Action),
  conditions: z.record(z.unknown()).optional(),
});

// ============================================================================
// JWT TOKEN TYPES
// ============================================================================

/**
 * JWT token payload
 */
export interface JWTPayload {
  /** Subject - user ID */
  sub: string;
  /** Issuer */
  iss: string;
  /** Audience */
  aud: string;
  /** Issued at */
  iat: number;
  /** Expiration time */
  exp: number;
  /** JWT ID */
  jti: string;
  /** User role */
  role: UserRole;
  /** Organization ID (optional) */
  orgId?: string;
  /** Session ID */
  sessionId: string;
  /** Token type */
  type: 'access' | 'refresh';
  /** Permissions array */
  permissions: Permission[];
  /** Additional claims */
  [key: string]: unknown;
}

/**
 * Zod schema for JWTPayload
 */
export const JWTPayloadSchema = z.object({
  sub: z.string(),
  iss: z.string(),
  aud: z.string(),
  iat: z.number(),
  exp: z.number(),
  jti: z.string(),
  role: UserRoleSchema,
  orgId: z.string().optional(),
  sessionId: z.string(),
  type: z.enum(['access', 'refresh']),
  permissions: z.array(PermissionSchema),
});

/**
 * JWT token pair
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: 'Bearer';
}

/**
 * Zod schema for TokenPair
 */
export const TokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
  tokenType: z.literal('Bearer'),
});

/**
 * JWT configuration
 */
export interface JWTConfig {
  /** Issuer */
  issuer: string;
  /** Audience */
  audience: string;
  /** Access token expiration (seconds) */
  accessTokenTTL: number;
  /** Refresh token expiration (seconds) */
  refreshTokenTTL: number;
  /** RSA private key for signing */
  privateKey: string;
  /** RSA public key for verification */
  publicKey: string;
  /** Key ID for key rotation */
  keyId: string;
}

/**
 * Zod schema for JWTConfig
 */
export const JWTConfigSchema = z.object({
  issuer: z.string(),
  audience: z.string(),
  accessTokenTTL: z.number().positive(),
  refreshTokenTTL: z.number().positive(),
  privateKey: z.string(),
  publicKey: z.string(),
  keyId: z.string(),
});

// ============================================================================
// OAUTH TYPES
// ============================================================================

/**
 * OAuth providers
 */
export enum OAuthProvider {
  GITHUB = 'github',
  GOOGLE = 'google',
}

/**
 * Zod schema for OAuthProvider
 */
export const OAuthProviderSchema = z.enum(['github', 'google']);

/**
 * OAuth user profile from provider
 */
export interface OAuthProfile {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  name?: string;
  avatar?: string;
  username?: string;
  verified: boolean;
}

/**
 * Zod schema for OAuthProfile
 */
export const OAuthProfileSchema = z.object({
  provider: OAuthProviderSchema,
  providerId: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  avatar: z.string().url().optional(),
  username: z.string().optional(),
  verified: z.boolean(),
});

/**
 * OAuth configuration
 */
export interface OAuthConfig {
  github?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
  };
  google?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
  };
}

/**
 * Zod schema for OAuthConfig
 */
export const OAuthConfigSchema = z.object({
  github: z.object({
    clientId: z.string(),
    clientSecret: z.string(),
    redirectUri: z.string().url(),
    scope: z.array(z.string()),
  }).optional(),
  google: z.object({
    clientId: z.string(),
    clientSecret: z.string(),
    redirectUri: z.string().url(),
    scope: z.array(z.string()),
  }).optional(),
});

/**
 * OAuth state for CSRF protection
 */
export interface OAuthState {
  state: string;
  provider: OAuthProvider;
  redirectUri: string;
  createdAt: number;
  codeVerifier?: string; // PKCE
  nonce?: string; // OpenID Connect
}

/**
 * Zod schema for OAuthState
 */
export const OAuthStateSchema = z.object({
  state: z.string(),
  provider: OAuthProviderSchema,
  redirectUri: z.string().url(),
  createdAt: z.number(),
  codeVerifier: z.string().optional(),
  nonce: z.string().optional(),
});

// ============================================================================
// API KEY TYPES
// ============================================================================

/**
 * API key types
 */
export enum APIKeyType {
  PERSONAL = 'personal',        // User personal key
  ORGANIZATION = 'organization', // Organization key
  SERVICE = 'service',          // Service account key
  TEST = 'test',                // Test key with restrictions
}

/**
 * Zod schema for APIKeyType
 */
export const APIKeyTypeSchema = z.enum(['personal', 'organization', 'service', 'test']);

/**
 * API key metadata
 */
export interface APIKey {
  id: string;
  userId: string;
  organizationId?: string;
  keyType: APIKeyType;
  keyPrefix: string; // First 8 chars for identification
  keyHash: string;   // SHA-256 hash
  name: string;
  description?: string;
  permissions: Permission[];
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  scopes: string[];
  expiresAt?: number;
  lastUsedAt?: number;
  createdAt: number;
  revoked: boolean;
  revokedAt?: number;
}

/**
 * Zod schema for APIKey
 */
export const APIKeySchema = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string().optional(),
  keyType: APIKeyTypeSchema,
  keyPrefix: z.string().length(8),
  keyHash: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  permissions: z.array(PermissionSchema),
  rateLimit: z.object({
    requestsPerMinute: z.number().positive(),
    requestsPerDay: z.number().positive(),
  }).optional(),
  scopes: z.array(z.string()),
  expiresAt: z.number().optional(),
  lastUsedAt: z.number().optional(),
  createdAt: z.number(),
  revoked: z.boolean(),
  revokedAt: z.number().optional(),
});

/**
 * API key creation request
 */
export interface CreateAPIKeyRequest {
  name: string;
  description?: string;
  keyType: APIKeyType;
  permissions: Permission[];
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  scopes: string[];
  expiresAt?: number;
}

/**
 * Zod schema for CreateAPIKeyRequest
 */
export const CreateAPIKeyRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  keyType: APIKeyTypeSchema,
  permissions: z.array(PermissionSchema).min(1),
  rateLimit: z.object({
    requestsPerMinute: z.number().positive(),
    requestsPerDay: z.number().positive(),
  }).optional(),
  scopes: z.array(z.string()).min(1),
  expiresAt: z.number().optional(),
});

/**
 * API key response (without full key)
 */
export interface APIKeyResponse {
  id: string;
  keyPrefix: string;
  name: string;
  description?: string;
  keyType: APIKeyType;
  permissions: Permission[];
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  scopes: string[];
  expiresAt?: number;
  lastUsedAt?: number;
  createdAt: number;
  revoked: boolean;
}

/**
 * Zod schema for APIKeyResponse
 */
export const APIKeyResponseSchema = z.object({
  id: z.string(),
  keyPrefix: z.string().length(8),
  name: z.string(),
  description: z.string().optional(),
  keyType: APIKeyTypeSchema,
  permissions: z.array(PermissionSchema),
  rateLimit: z.object({
    requestsPerMinute: z.number().positive(),
    requestsPerDay: z.number().positive(),
  }).optional(),
  scopes: z.array(z.string()),
  expiresAt: z.number().optional(),
  lastUsedAt: z.number().optional(),
  createdAt: z.number(),
  revoked: z.boolean(),
});

// ============================================================================
// SESSION TYPES
// ============================================================================

/**
 * Session storage tiers
 */
export enum SessionTier {
  HOT = 'hot',     // Durable Object memory
  WARM = 'warm',   // KV cache
  COLD = 'cold',   // R2 archive
}

/**
 * Zod schema for SessionTier
 */
export const SessionTierSchema = z.enum(['hot', 'warm', 'cold']);

/**
 * Auth session data
 */
export interface AuthSession {
  sessionId: string;
  userId: string;
  organizationId?: string;
  role: UserRole;
  permissions: Permission[];
  createdAt: number;
  expiresAt: number;
  lastActivity: number;
  refreshTokenId: string;
  tier: SessionTier;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    location?: string;
    device?: string;
  };
  mfaVerified: boolean;
}

/**
 * Zod schema for AuthSession
 */
export const AuthSessionSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  organizationId: z.string().optional(),
  role: UserRoleSchema,
  permissions: z.array(PermissionSchema),
  createdAt: z.number(),
  expiresAt: z.number(),
  lastActivity: z.number(),
  refreshTokenId: z.string(),
  tier: SessionTierSchema,
  metadata: z.object({
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    location: z.string().optional(),
    device: z.string().optional(),
  }),
  mfaVerified: z.boolean(),
});

/**
 * Refresh token data
 */
export interface RefreshToken {
  tokenId: string;
  userId: string;
  sessionId: string;
  expiresAt: number;
  createdAt: number;
  revoked: boolean;
  revokedAt?: number;
  rotationCount: number;
}

/**
 * Zod schema for RefreshToken
 */
export const RefreshTokenSchema = z.object({
  tokenId: z.string(),
  userId: z.string(),
  sessionId: z.string(),
  expiresAt: z.number(),
  createdAt: z.number(),
  revoked: z.boolean(),
  revokedAt: z.number().optional(),
  rotationCount: z.number(),
});

// ============================================================================
// USER TYPES
// ============================================================================

/**
 * User account
 */
export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  avatar?: string;
  role: UserRole;
  organizationId?: string;
  permissions: Permission[];
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
  mfaEnabled: boolean;
  metadata: Record<string, unknown>;
}

/**
 * Zod schema for User
 */
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  name: z.string().optional(),
  avatar: z.string().url().optional(),
  role: UserRoleSchema,
  organizationId: z.string().optional(),
  permissions: z.array(PermissionSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastLoginAt: z.number().optional(),
  mfaEnabled: z.boolean(),
  metadata: z.record(z.unknown()),
});

/**
 * User registration request
 */
export interface RegisterRequest {
  email: string;
  password?: string;
  name?: string;
  role?: UserRole;
}

/**
 * Zod schema for RegisterRequest
 */
export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  name: z.string().optional(),
  role: UserRoleSchema.optional(),
});

/**
 * Login request
 */
export interface LoginRequest {
  email?: string;
  password?: string;
  provider?: OAuthProvider;
  code?: string;
  state?: string;
  redirectUri?: string;
}

/**
 * Zod schema for LoginRequest
 */
export const LoginRequestSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  provider: OAuthProviderSchema.optional(),
  code: z.string().optional(),
  state: z.string().optional(),
  redirectUri: z.string().url().optional(),
});

/**
 * Login response
 */
export interface LoginResponse {
  user: User;
  tokens: TokenPair;
  session: AuthSession;
}

/**
 * Zod schema for LoginResponse
 */
export const LoginResponseSchema = z.object({
  user: UserSchema,
  tokens: TokenPairSchema,
  session: AuthSessionSchema,
});

// ============================================================================
// ORGANIZATION TYPES
// ============================================================================

/**
 * Organization
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: number;
  updatedAt: number;
  ownerId: string;
  memberCount: number;
  settings: {
    maxMembers?: number;
    maxAPIKeys?: number;
    defaultRole?: UserRole;
    requireMFA?: boolean;
  };
}

/**
 * Zod schema for Organization
 */
export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  slug: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  ownerId: z.string(),
  memberCount: z.number(),
  settings: z.object({
    maxMembers: z.number().optional(),
    maxAPIKeys: z.number().optional(),
    defaultRole: UserRoleSchema.optional(),
    requireMFA: z.boolean().optional(),
  }),
});

/**
 * Organization member
 */
export interface OrganizationMember {
  userId: string;
  organizationId: string;
  role: UserRole;
  permissions: Permission[];
  invitedBy: string;
  invitedAt: number;
  joinedAt?: number;
}

/**
 * Zod schema for OrganizationMember
 */
export const OrganizationMemberSchema = z.object({
  userId: z.string(),
  organizationId: z.string(),
  role: UserRoleSchema,
  permissions: z.array(PermissionSchema),
  invitedBy: z.string(),
  invitedAt: z.number(),
  joinedAt: z.number().optional(),
});

// ============================================================================
// AUTHENTICATION CONTEXT
// ============================================================================

/**
 * Authentication context attached to request
 */
export interface AuthContext {
  authenticated: boolean;
  method: 'jwt' | 'api_key' | 'oauth' | 'none';
  userId?: string;
  organizationId?: string;
  role: UserRole;
  permissions: Permission[];
  sessionId?: string;
  apiKeyId?: string;
  tokenId?: string;
  metadata: {
    authenticatedAt: number;
    expiresAt?: number;
    ipAddress?: string;
    userAgent?: string;
  };
}

/**
 * Zod schema for AuthContext
 */
export const AuthContextSchema = z.object({
  authenticated: z.boolean(),
  method: z.enum(['jwt', 'api_key', 'oauth', 'none']),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  role: UserRoleSchema,
  permissions: z.array(PermissionSchema),
  sessionId: z.string().optional(),
  apiKeyId: z.string().optional(),
  tokenId: z.string().optional(),
  metadata: z.object({
    authenticatedAt: z.number(),
    expiresAt: z.number().optional(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
  }),
});

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Rate limit configuration per role
 */
export interface RoleRateLimits {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  tokensPerDay: number;
  concurrentRequests: number;
}

/**
 * Default rate limits by role
 */
export const DEFAULT_RATE_LIMITS: Record<UserRole, RoleRateLimits> = {
  [UserRole.ANONYMOUS]: {
    requestsPerMinute: 10,
    requestsPerHour: 100,
    requestsPerDay: 500,
    tokensPerDay: 10000,
    concurrentRequests: 2,
  },
  [UserRole.USER]: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    tokensPerDay: 100000,
    concurrentRequests: 5,
  },
  [UserRole.PRO]: {
    requestsPerMinute: 300,
    requestsPerHour: 10000,
    requestsPerDay: 100000,
    tokensPerDay: 1000000,
    concurrentRequests: 20,
  },
  [UserRole.ADMIN]: {
    requestsPerMinute: 600,
    requestsPerHour: 20000,
    requestsPerDay: 200000,
    tokensPerDay: 2000000,
    concurrentRequests: 50,
  },
  [UserRole.SERVICE_ACCOUNT]: {
    requestsPerMinute: 1000,
    requestsPerHour: 50000,
    requestsPerDay: 500000,
    tokensPerDay: 5000000,
    concurrentRequests: 100,
  },
};

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

/**
 * Audit event types
 */
export enum AuditEventType {
  AUTH_LOGIN = 'auth.login',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_REGISTER = 'auth.register',
  AUTH_PASSWORD_CHANGE = 'auth.password_change',
  AUTH_MFA_ENABLED = 'auth.mfa_enabled',
  AUTH_MFA_DISABLED = 'auth.mfa_disabled',

  TOKEN_REFRESH = 'token.refresh',
  TOKEN_REVOKE = 'token.revoke',

  API_KEY_CREATE = 'api_key.create',
  API_KEY_READ = 'api_key.read',
  API_KEY_UPDATE = 'api_key.update',
  API_KEY_DELETE = 'api_key.delete',
  API_KEY_REVOKE = 'api_key.revoke',

  USER_CREATE = 'user.create',
  USER_UPDATE = 'user.update',
  USER_DELETE = 'user.delete',
  USER_ROLE_CHANGE = 'user.role_change',

  ORG_CREATE = 'org.create',
  ORG_UPDATE = 'org.update',
  ORG_DELETE = 'org.delete',
  ORG_MEMBER_INVITE = 'org.member_invite',
  ORG_MEMBER_REMOVE = 'org.member_remove',

  PERMISSION_GRANTED = 'permission.granted',
  PERMISSION_REVOKED = 'permission.revoked',

  RATE_LIMIT_EXCEEDED = 'rate_limit.exceeded',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
}

/**
 * Zod schema for AuditEventType
 */
export const AuditEventTypeSchema = z.nativeEnum(AuditEventType);

/**
 * Audit log entry
 */
export interface AuditLog {
  id: string;
  eventType: AuditEventType;
  userId?: string;
  organizationId?: string;
  sessionId?: string;
  resourceId?: string;
  resourceType?: string;
  action: string;
  success: boolean;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

/**
 * Zod schema for AuditLog
 */
export const AuditLogSchema = z.object({
  id: z.string(),
  eventType: AuditEventTypeSchema,
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  sessionId: z.string().optional(),
  resourceId: z.string().optional(),
  resourceType: z.string().optional(),
  action: z.string(),
  success: z.boolean(),
  errorMessage: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  timestamp: z.number(),
  metadata: z.record(z.unknown()),
});

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Authentication error codes
 */
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  REVOKED_TOKEN = 'REVOKED_TOKEN',
  INVALID_API_KEY = 'INVALID_API_KEY',
  REVOKED_API_KEY = 'REVOKED_API_KEY',
  EXPIRED_API_KEY = 'EXPIRED_API_KEY',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  OAUTH_ERROR = 'OAUTH_ERROR',
  OAUTH_STATE_MISMATCH = 'OAUTH_STATE_MISMATCH',
  MFA_REQUIRED = 'MFA_REQUIRED',
  MFA_INVALID = 'MFA_INVALID',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_DISABLED = 'USER_DISABLED',
  ORGANIZATION_NOT_FOUND = 'ORGANIZATION_NOT_FOUND',
  ORGANIZATION_DISABLED = 'ORGANIZATION_DISABLED',
}

/**
 * Zod schema for AuthErrorCode
 */
export const AuthErrorCodeSchema = z.nativeEnum(AuthErrorCode);

/**
 * Authentication error
 */
export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
    public statusCode: number = 401,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ============================================================================
// EXPORT TYPE INFERENCE
// ============================================================================

export type JWTPayloadType = z.infer<typeof JWTPayloadSchema>;
export type TokenPairType = z.infer<typeof TokenPairSchema>;
export type OAuthProfileType = z.infer<typeof OAuthProfileSchema>;
export type APIKeyTypeType = z.infer<typeof APIKeySchema>;
export type CreateAPIKeyRequestType = z.infer<typeof CreateAPIKeyRequestSchema>;
export type AuthSessionType = z.infer<typeof AuthSessionSchema>;
export type UserType = z.infer<typeof UserSchema>;
export type AuthContextType = z.infer<typeof AuthContextSchema>;
