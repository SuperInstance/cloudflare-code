/**
 * Authentication Middleware for Hono
 *
 * Provides middleware for JWT, API key, and OAuth authentication.
 * Integrates with RBAC for authorization checks.
 */

import type { Context, Next } from 'hono';
import { AuthError } from './types';
import type {
  AuthContext,
  UserRole,
  Permission,
  Resource,
  Action,
  JWTPayload,
  APIKey,
} from './types';
import {
  extractToken,
  validateAccessToken,
  getUser as getUserFromKV,
} from './jwt';
import {
  extractAPIKeyFromHeader,
  validateAPIKeyFormat,
  type APIKeyManager,
} from './api-keys';
import {
  hasPermission,
  canAccessResource,
  AuthorizationService,
} from './rbac';

// ============================================================================
// ENVIRONMENT INTERFACE
// ============================================================================

export interface AuthEnv {
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  JWT_PUBLIC_KEY: string;
  KV_CACHE: KVNamespace;
  AUTH_SESSION_DO?: DurableObjectNamespace;
  DB?: D1Database;
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Authentication middleware
 *
 * Supports both JWT and API key authentication.
 * Attaches auth context to c.var.authContext
 */
export const authMiddleware = async (c: Context<{ Bindings: AuthEnv }>, next: Next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    // Set anonymous context
    c.set('authContext', createAnonymousContext(c));
    return next();
  }

  let authContext: AuthContext;

  // Try JWT authentication
  const token = extractToken(authHeader);
  if (token) {
    try {
      authContext = await authenticateJWT(token, c.env);
      c.set('authContext', authContext);

      // Add user ID to request ID for tracing
      const requestId = c.get('requestId');
      if (requestId && authContext.userId) {
        c.set('requestId', `${requestId}|user:${authContext.userId}`);
      }

      return next();
    } catch (error) {
      // JWT failed, try API key
    }
  }

  // Try API key authentication
  const apiKey = extractAPIKeyFromHeader(authHeader);
  if (apiKey) {
    try {
      authContext = await authenticateAPIKey(apiKey, c.env);
      c.set('authContext', authContext);

      // Add API key ID to request ID
      const requestId = c.get('requestId');
      if (requestId && authContext.apiKeyId) {
        c.set('requestId', `${requestId}|key:${authContext.apiKeyId}`);
      }

      return next();
    } catch (error) {
      // API key failed
    }
  }

  // All authentication failed
  c.set('authContext', createAnonymousContext(c));
  return next();
};

/**
 * Require authentication middleware
 *
 * Returns 401 if not authenticated
 */
export const requireAuth = async (c: Context<{ Bindings: AuthEnv }>, next: Next) => {
  await authMiddleware(c, async () => {});

  const authContext = c.get('authContext') as AuthContext;

  if (!authContext.authenticated) {
    throw new AuthError(
      'INVALID_CREDENTIALS',
      'Authentication required',
      401
    );
  }

  return next();
};

/**
 * Require specific role middleware
 *
 * Returns 403 if user doesn't have required role
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return async (c: Context<{ Bindings: AuthEnv }>, next: Next) => {
    await requireAuth(c, async () => {});

    const authContext = c.get('authContext') as AuthContext;

    if (!allowedRoles.includes(authContext.role)) {
      throw new AuthError(
        'INSUFFICIENT_PERMISSIONS',
        `Requires one of roles: ${allowedRoles.join(', ')}`,
        403,
        { requiredRoles: allowedRoles, userRole: authContext.role }
      );
    }

    return next();
  };
};

/**
 * Require permission middleware
 *
 * Returns 403 if user doesn't have required permission
 */
export const requirePermission = (resource: Resource, action: Action) => {
  return async (c: Context<{ Bindings: AuthEnv }>, next: Next) => {
    await requireAuth(c, async () => {});

    const authContext = c.get('authContext') as AuthContext;

    if (!hasPermission(authContext.permissions, resource, action)) {
      throw new AuthError(
        'INSUFFICIENT_PERMISSIONS',
        `Not authorized to ${action} on ${resource}`,
        403,
        { resource, action, userRole: authContext.role }
      );
    }

    return next();
  };
};

/**
 * Require all permissions middleware
 *
 * Returns 403 if user doesn't have all required permissions
 */
export const requireAllPermissions = (...requiredPermissions: Permission[]) => {
  return async (c: Context<{ Bindings: AuthEnv }>, next: Next) => {
    await requireAuth(c, async () => {});

    const authContext = c.get('authContext') as AuthContext;

    AuthorizationService.authorize(authContext, requiredPermissions, true);

    return next();
  };
};

/**
 * Require any permission middleware
 *
 * Returns 403 if user doesn't have any of the required permissions
 */
export const requireAnyPermission = (...requiredPermissions: Permission[]) => {
  return async (c: Context<{ Bindings: AuthEnv }>, next: Next) => {
    await requireAuth(c, async () => {});

    const authContext = c.get('authContext') as AuthContext;

    AuthorizationService.authorize(authContext, requiredPermissions, false);

    return next();
  };
};

/**
 * Require organization membership middleware
 */
export const requireOrganization = async (c: Context<{ Bindings: AuthEnv }>, next: Next) => {
  await requireAuth(c, async () => {});

  const authContext = c.get('authContext') as AuthContext;

  if (!authContext.organizationId) {
    throw new AuthError(
      'INSUFFICIENT_PERMISSIONS',
      'Organization membership required',
      403
    );
  }

  return next();
};

/**
 * Optional authentication middleware
 *
 * Attempts authentication but doesn't require it.
 * Useful for endpoints that work for both authenticated and anonymous users.
 */
export const optionalAuth = async (c: Context<{ Bindings: AuthEnv }>, next: Next) => {
  await authMiddleware(c, next);
  return next();
};

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

/**
 * Authenticate using JWT token
 */
async function authenticateJWT(
  token: string,
  env: AuthEnv
): Promise<AuthContext> {
  try {
    // Validate token
    const payload = await validateAccessToken(token, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      accessTokenTTL: 0,
      refreshTokenTTL: 0,
      privateKey: '',
      publicKey: env.JWT_PUBLIC_KEY,
      keyId: '',
    });

    // Get user from KV
    const user = await getUserFromKV(env, payload.sub);
    if (!user) {
      throw new AuthError('USER_NOT_FOUND', 'User not found', 401);
    }

    // Check if session is valid
    if (payload.sessionId) {
      // TODO: Validate session with DO
    }

    return {
      authenticated: true,
      method: 'jwt',
      userId: payload.sub,
      organizationId: payload.orgId,
      role: payload.role,
      permissions: payload.permissions,
      sessionId: payload.sessionId,
      tokenId: payload.jti,
      metadata: {
        authenticatedAt: Date.now(),
        expiresAt: payload.exp * 1000,
      },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError('INVALID_TOKEN', 'Token validation failed', 401);
  }
}

/**
 * Authenticate using API key
 */
async function authenticateAPIKey(
  apiKey: string,
  env: AuthEnv
): Promise<AuthContext> {
  try {
    // Validate format
    if (!validateAPIKeyFormat(apiKey)) {
      throw new AuthError('INVALID_API_KEY', 'Invalid API key format', 401);
    }

    // Get API key from KV
    const keyHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(apiKey)
    );
    const hashArray = Array.from(new Uint8Array(keyHash));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const cached = await env.KV_CACHE.get<{ apiKey: APIKey; user: any }>(
      `api_key:${hashHex}`,
      'json'
    );

    if (!cached) {
      throw new AuthError('INVALID_API_KEY', 'API key not found', 401);
    }

    const { apiKey: key, user } = cached;

    // Check if key is valid
    if (key.revoked) {
      throw new AuthError('REVOKED_API_KEY', 'API key has been revoked', 401);
    }

    if (key.expiresAt && key.expiresAt < Date.now()) {
      throw new AuthError('EXPIRED_API_KEY', 'API key has expired', 401);
    }

    return {
      authenticated: true,
      method: 'api_key',
      userId: key.userId,
      organizationId: key.organizationId,
      role: user.role,
      permissions: key.permissions,
      apiKeyId: key.id,
      metadata: {
        authenticatedAt: Date.now(),
        expiresAt: key.expiresAt,
      },
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError('INVALID_API_KEY', 'API key validation failed', 401);
  }
}

/**
 * Create anonymous auth context
 */
function createAnonymousContext(c: Context): AuthContext {
  return {
    authenticated: false,
    method: 'none',
    role: 'anonymous',
    permissions: [
      { resource: 'chat' as Resource, action: 'read' as Action },
      { resource: 'models' as Resource, action: 'read' as Action },
    ],
    metadata: {
      authenticatedAt: Date.now(),
    },
  };
}

/**
 * Get user from KV
 */
async function getUserFromKV(env: AuthEnv, userId: string): Promise<any> {
  const cached = await env.KV_CACHE.get(`user:${userId}`, 'json');
  if (cached) {
    return cached;
  }

  // Try database
  if (env.DB) {
    const result = await env.DB
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (result) {
      // Cache in KV
      await env.KV_CACHE.put(`user:${userId}`, JSON.stringify(result), {
        expirationTtl: 3600,
      });
      return result;
    }
  }

  return null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get auth context from request
 */
export function getAuthContext(c: Context): AuthContext {
  return c.get('authContext') as AuthContext;
}

/**
 * Check if request is authenticated
 */
export function isAuthenticated(c: Context): boolean {
  const authContext = getAuthContext(c);
  return authContext.authenticated;
}

/**
 * Get user ID from request
 */
export function getUserId(c: Context): string | undefined {
  const authContext = getAuthContext(c);
  return authContext.userId;
}

/**
 * Get user role from request
 */
export function getUserRole(c: Context): UserRole {
  const authContext = getAuthContext(c);
  return authContext.role;
}

/**
 * Check if user has permission
 */
export function checkPermission(c: Context, resource: Resource, action: Action): boolean {
  const authContext = getAuthContext(c);
  return hasPermission(authContext.permissions, resource, action);
}

/**
 * Require admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Require pro role or higher
 */
export const requirePro = requireRole('pro', 'admin');

/**
 * Require user role or higher
 */
export const requireUser = requireRole('user', 'pro', 'admin');

// ============================================================================
// CSRF PROTECTION
// ============================================================================

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(token: string, storedToken: string): boolean {
  return token === storedToken;
}

/**
 * CSRF middleware for state-changing operations
 */
export const csrfMiddleware = async (c: Context<{ Bindings: AuthEnv }>, next: Next) => {
  // Only validate CSRF for POST, PUT, DELETE, PATCH
  const method = c.req.method();
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return next();
  }

  const csrfToken = c.req.header('X-CSRF-Token');
  const sessionToken = c.get('csrfToken');

  if (!csrfToken || !sessionToken || !validateCSRFToken(csrfToken, sessionToken)) {
    throw new AuthError(
      'INVALID_CREDENTIALS',
      'Invalid CSRF token',
      403
    );
  }

  return next();
};

// ============================================================================
// SECURITY HEADERS
// ============================================================================

/**
 * Add security headers middleware
 */
export const securityHeaders = async (c: Context, next: Next) => {
  await next();

  // Set security headers
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('X-XSS-Protection', '1; mode=block');
  c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Remove server header
  c.res.headers.delete('Server');
};

// ============================================================================
// EXPORTS
// ============================================================================

export {
  authMiddleware as authentication,
  requireAuth,
  requireRole,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  requireOrganization,
  optionalAuth,
};
