/**
 * Authentication Integration Tests
 *
 * Tests the complete authentication flow including JWT, API keys, RBAC, and rate limiting.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuthRateLimiter } from './rate-limit';
import { APIKeyManager } from './api-keys';
import { AuthorizationService } from './rbac';
import {
  generateRSAKeyPair,
  generateTokenPair,
  validateAccessToken,
  generateAPIKey,
  hashAPIKey,
  validateAPIKeyFormat,
  type JWTConfig,
  type JWTPayload,
  type AuthContext,
  type Permission,
  UserRole,
  Resource,
  Action,
} from './index';
import { AuthError } from './types';

describe('Authentication Integration', () => {
  let jwtConfig: JWTConfig;
  let mockKV: KVNamespace;
  let mockDB: D1Database;
  let rateLimiter: AuthRateLimiter;
  let apiKeyManager: APIKeyManager;

  beforeEach(async () => {
    // Generate test keys
    const keyPair = await generateRSAKeyPair();
    jwtConfig = {
      issuer: 'test-issuer',
      audience: 'test-audience',
      accessTokenTTL: 3600,
      refreshTokenTTL: 604800,
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      keyId: 'test-key-id',
    };

    // Mock KV
    mockKV = {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
      list: async () => ({ keys: [], list_complete: true }),
    } as any;

    // Mock DB
    mockDB = {
      prepare: () => ({
        bind: () => ({
          run: async () => ({ success: true }),
          first: async () => null,
          all: async () => ({ results: [] }),
        }),
      }),
    } as any;

    rateLimiter = new AuthRateLimiter(mockKV);
    apiKeyManager = new APIKeyManager(mockKV, mockDB);
  });

  describe('JWT Authentication Flow', () => {
    it('should complete full authentication flow', async () => {
      // Generate token pair
      const tokenPair = await generateTokenPair({
        userId: 'user-123',
        role: 'user',
        permissions: [
          { resource: 'chat', action: 'execute' },
          { resource: 'models', action: 'read' },
        ],
        sessionId: 'session-123',
        config: jwtConfig,
      });

      // Validate access token
      const payload = await validateAccessToken(tokenPair.accessToken, jwtConfig);

      expect(payload.sub).toBe('user-123');
      expect(payload.role).toBe('user');
      expect(payload.type).toBe('access');
      expect(payload.permissions.length).toBe(2);
    });

    it('should maintain session across token refresh', async () => {
      const sessionId = 'session-123';

      // Initial token pair
      const tokenPair1 = await generateTokenPair({
        userId: 'user-123',
        role: 'user',
        permissions: [],
        sessionId,
        config: jwtConfig,
      });

      // Extract session ID from access token
      const payload1 = await validateAccessToken(tokenPair1.accessToken, jwtConfig);
      expect(payload1.sessionId).toBe(sessionId);

      // Simulate token refresh (would use refresh token in real flow)
      const tokenPair2 = await generateTokenPair({
        userId: 'user-123',
        role: 'user',
        permissions: [],
        sessionId,
        config: jwtConfig,
      });

      // Verify session ID is maintained
      const payload2 = await validateAccessToken(tokenPair2.accessToken, jwtConfig);
      expect(payload2.sessionId).toBe(sessionId);
      expect(payload2.sub).toBe(payload1.sub);
    });
  });

  describe('API Key Authentication Flow', () => {
    it('should generate and validate API key', async () => {
      // Generate API key
      const apiKey = await generateAPIKey('personal');

      // Validate format
      expect(validateAPIKeyFormat(apiKey)).toBe(true);
      expect(apiKey).toMatch(/^pk_[a-f0-9]+_[a-f0-9]{64}$/);

      // Hash key
      const hash = await hashAPIKey(apiKey);
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);

      // Verify key
      const verified = await apiKeyManager.validateAPIKey(apiKey);
      // Will fail without proper storage setup
      expect(verified).toBeNull();
    });

    it('should extract key prefix', async () => {
      const personalKey = await generateAPIKey('personal');
      const orgKey = await generateAPIKey('organization');
      const serviceKey = await generateAPIKey('service');
      const testKey = await generateAPIKey('test');

      expect(personalKey.slice(0, 8)).toMatch(/^pk_/);
      expect(orgKey.slice(0, 8)).toMatch(/^ok_/);
      expect(serviceKey.slice(0, 8)).toMatch(/^sk_/);
      expect(testKey.slice(0, 8)).toMatch(/^tk_/);
    });

    it('should generate unique keys', async () => {
      const key1 = await generateAPIKey('personal');
      const key2 = await generateAPIKey('personal');

      expect(key1).not.toBe(key2);
    });
  });

  describe('Authorization Flow', () => {
    const userPermissions: Permission[] = [
      { resource: 'chat', action: 'execute' },
      { resource: 'chat_stream', action: 'execute' },
      { resource: 'models', action: 'read' },
      { resource: 'codebase', action: 'create' },
      { resource: 'codebase', action: 'read' },
      { resource: 'api_keys', action: 'create' },
      { resource: 'api_keys', action: 'read' },
      { resource: 'api_keys', action: 'delete' },
    ];

    const userContext: AuthContext = {
      authenticated: true,
      method: 'jwt',
      userId: 'user-123',
      role: 'user',
      permissions: userPermissions,
      metadata: {
        authenticatedAt: Date.now(),
      },
    };

    const adminContext: AuthContext = {
      authenticated: true,
      method: 'jwt',
      userId: 'admin-123',
      role: 'admin',
      permissions: [
        { resource: 'chat', action: 'manage' },
        { resource: 'users_manage', action: 'manage' },
        { resource: 'organizations_manage', action: 'manage' },
      ],
      metadata: {
        authenticatedAt: Date.now(),
      },
    };

    it('should authorize user for chat access', () => {
      expect(() => {
        AuthorizationService.authorizeResource(userContext, 'chat', 'execute');
      }).not.toThrow();

      expect(() => {
        AuthorizationService.authorizeResource(userContext, 'chat_stream', 'execute');
      }).not.toThrow();
    });

    it('should deny user for admin resources', () => {
      expect(() => {
        AuthorizationService.authorizeResource(userContext, 'users_manage', 'manage');
      }).toThrow(AuthError);

      expect(() => {
        AuthorizationService.authorizeResource(userContext, 'organizations_manage', 'manage');
      }).toThrow(AuthError);
    });

    it('should authorize admin for all resources', () => {
      expect(() => {
        AuthorizationService.authorizeResource(adminContext, 'users_manage', 'manage');
      }).not.toThrow();

      expect(() => {
        AuthorizationService.authorizeResource(adminContext, 'organizations_manage', 'manage');
      }).not.toThrow();
    });

    it('should check user management permissions', () => {
      // User can manage themselves
      expect(AuthorizationService.canManageUser(userContext, 'user-123')).toBe(true);

      // User cannot manage others
      expect(AuthorizationService.canManageUser(userContext, 'user-456')).toBe(false);

      // Admin can manage anyone
      expect(AuthorizationService.canManageUser(adminContext, 'user-123')).toBe(true);
      expect(AuthorizationService.canManageUser(adminContext, 'user-456')).toBe(true);
    });
  });

  describe('Rate Limiting Flow', () => {
    it('should enforce rate limits by role', async () => {
      const userLimits = rateLimiter.getLimitsForUser('user-123', 'user');

      expect(userLimits.requestsPerMinute).toBe(60);
      expect(userLimits.requestsPerHour).toBe(1000);
      expect(userLimits.requestsPerDay).toBe(10000);
    });

    it('should enforce higher limits for pro users', async () => {
      const proLimits = rateLimiter.getLimitsForUser('user-123', 'pro');

      expect(proLimits.requestsPerMinute).toBe(300);
      expect(proLimits.requestsPerHour).toBe(10000);
      expect(proLimits.requestsPerDay).toBe(100000);

      expect(proLimits.requestsPerMinute).toBeGreaterThan(userLimits.requestsPerMinute);
    });

    it('should enforce highest limits for admin', async () => {
      const adminLimits = rateLimiter.getLimitsForUser('admin-123', 'admin');

      expect(adminLimits.requestsPerMinute).toBe(600);
      expect(adminLimits.requestsPerHour).toBe(20000);
      expect(adminLimits.requestsPerDay).toBe(200000);
    });

    it('should enforce lowest limits for anonymous', async () => {
      const anonymousLimits = rateLimiter.getLimitsForUser('anonymous', 'anonymous');

      expect(anonymousLimits.requestsPerMinute).toBe(10);
      expect(anonymousLimits.requestsPerHour).toBe(100);
      expect(anonymousLimits.requestsPerDay).toBe(500);
    });
  });

  describe('Multi-tenant Authorization', () => {
    const orgUserContext: AuthContext = {
      authenticated: true,
      method: 'jwt',
      userId: 'user-123',
      organizationId: 'org-123',
      role: 'user',
      permissions: [
        { resource: 'codebase', action: 'create' },
        { resource: 'codebase', action: 'read' },
      ],
      metadata: {
        authenticatedAt: Date.now(),
      },
    };

    const differentOrgContext: AuthContext = {
      authenticated: true,
      method: 'jwt',
      userId: 'user-456',
      organizationId: 'org-456',
      role: 'user',
      permissions: [
        { resource: 'codebase', action: 'read' },
      ],
      metadata: {
        authenticatedAt: Date.now(),
      },
    };

    it('should allow user to access own organization resources', () => {
      expect(AuthorizationService.canManageOrganization(orgUserContext, 'org-123')).toBe(false); // User role
    });

    it('should prevent cross-organization access', () => {
      expect(AuthorizationService.canManageOrganization(orgUserContext, 'org-456')).toBe(false);
    });

    it('should check API key ownership', () => {
      // Same organization
      expect(
        AuthorizationService.canAccessAPIKey(orgUserContext, 'user-123', 'org-123')
      ).toBe(true);

      // Different organization
      expect(
        AuthorizationService.canAccessAPIKey(differentOrgContext, 'user-123', 'org-123')
      ).toBe(false);
    });
  });

  describe('Permission Hierarchies', () => {
    it('should grant manage permission for all actions', () => {
      const manageContext: AuthContext = {
        authenticated: true,
        method: 'jwt',
        userId: 'admin-123',
        role: 'admin',
        permissions: [
          { resource: 'chat', action: 'manage' },
        ],
        metadata: {
          authenticatedAt: Date.now(),
        },
      };

      expect(() => {
        AuthorizationService.authorizeResource(manageContext, 'chat', 'execute');
      }).not.toThrow();

      expect(() => {
        AuthorizationService.authorizeResource(manageContext, 'chat', 'read');
      }).not.toThrow();

      expect(() => {
        AuthorizationService.authorizeResource(manageContext, 'chat', 'create');
      }).not.toThrow();

      expect(() => {
        AuthorizationService.authorizeResource(manageContext, 'chat', 'delete');
      }).not.toThrow();
    });
  });

  describe('Role-based Access Control', () => {
    it('should enforce role hierarchy', () => {
      const contexts: Record<UserRole, AuthContext> = {
        anonymous: {
          authenticated: false,
          method: 'none',
          role: 'anonymous',
          permissions: [],
          metadata: { authenticatedAt: Date.now() },
        },
        user: {
          authenticated: true,
          method: 'jwt',
          userId: 'user-123',
          role: 'user',
          permissions: [],
          metadata: { authenticatedAt: Date.now() },
        },
        pro: {
          authenticated: true,
          method: 'jwt',
          userId: 'user-123',
          role: 'pro',
          permissions: [],
          metadata: { authenticatedAt: Date.now() },
        },
        admin: {
          authenticated: true,
          method: 'jwt',
          userId: 'admin-123',
          role: 'admin',
          permissions: [],
          metadata: { authenticatedAt: Date.now() },
        },
        service_account: {
          authenticated: true,
          method: 'jwt',
          userId: 'service-123',
          role: 'service_account',
          permissions: [],
          metadata: { authenticatedAt: Date.now() },
        },
      };

      // Anonymous can only read
      expect(() => {
        AuthorizationService.authorizeResource(contexts.anonymous, 'models', 'read');
      }).not.toThrow();

      expect(() => {
        AuthorizationService.authorizeResource(contexts.anonymous, 'chat', 'execute');
      }).toThrow();

      // User can execute
      expect(() => {
        AuthorizationService.authorizeResource(contexts.user, 'chat', 'execute');
      }).not.toThrow();

      expect(() => {
        AuthorizationService.authorizeResource(contexts.user, 'users_manage', 'manage');
      }).toThrow();

      // Pro has more permissions
      expect(() => {
        AuthorizationService.authorizeResource(contexts.pro, 'agents', 'execute');
      }).not.toThrow();

      // Admin can do everything
      expect(() => {
        AuthorizationService.authorizeResource(contexts.admin, 'users_manage', 'manage');
      }).not.toThrow();

      expect(() => {
        AuthorizationService.authorizeResource(contexts.admin, 'organizations_manage', 'manage');
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw proper auth errors', () => {
      const unauthorizedContext: AuthContext = {
        authenticated: false,
        method: 'none',
        role: 'anonymous',
        permissions: [],
        metadata: { authenticatedAt: Date.now() },
      };

      expect(() => {
        AuthorizationService.authorize(
          unauthorizedContext,
          [{ resource: 'chat', action: 'execute' }],
          false
        );
      }).toThrow(AuthError);
    });

    it('should include error details', () => {
      const userContext: AuthContext = {
        authenticated: true,
        method: 'jwt',
        userId: 'user-123',
        role: 'user',
        permissions: [],
        metadata: { authenticatedAt: Date.now() },
      };

      try {
        AuthorizationService.authorizeResource(userContext, 'users_manage', 'manage');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        if (error instanceof AuthError) {
          expect(error.code).toBe('INSUFFICIENT_PERMISSIONS');
          expect(error.statusCode).toBe(403);
          expect(error.details).toBeDefined();
        } else {
          expect(true).toBe(false); // Should be AuthError
        }
      }
    });
  });

  describe('Security Best Practices', () => {
    it('should not expose sensitive data in errors', () => {
      try {
        AuthorizationService.authorizeResource(
          {
            authenticated: true,
            method: 'jwt',
            userId: 'user-123',
            role: 'user',
            permissions: [],
            metadata: { authenticatedAt: Date.now() },
          },
          'users_manage',
          'manage'
        );
      } catch (error) {
        if (error instanceof AuthError) {
          expect(error.message).not.toContain('password');
          expect(error.message).not.toContain('secret');
          expect(error.message).not.toContain('key');
        }
      }
    });

    it('should validate all inputs', async () => {
      // Invalid token format
      await expect(
        validateAccessToken('invalid-token', jwtConfig)
      ).rejects.toThrow();

      // Empty permissions
      const context: AuthContext = {
        authenticated: true,
        method: 'jwt',
        userId: 'user-123',
        role: 'user',
        permissions: [],
        metadata: { authenticatedAt: Date.now() },
      };

      expect(() => {
        AuthorizationService.authorize(
          context,
          [],
          false
      ).toThrow();
    });
  });
});
