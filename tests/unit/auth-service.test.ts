/**
 * Authentication Service Tests
 * Tests for EnterpriseAuthService including login, JWT, sessions, and multi-user support
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnterpriseAuthService } from '../../src/services/auth-service';

describe('EnterpriseAuthService', () => {
  let authService: EnterpriseAuthService;

  beforeEach(() => {
    authService = new EnterpriseAuthService({
      jwtSecret: 'test-secret-key',
      jwtAlgorithm: 'HS256',
      jwtExpiry: 3600,
      refreshTokenExpiry: 86400,
      maxLoginAttempts: 5,
      lockoutDuration: 15,
      mfaRequired: false,
      sessionTimeout: 3600,
      cookieSecure: false,
      cookieSameSite: 'lax'
    });
  });

  describe('Login Flow', () => {
    it('should successfully login with valid credentials', async () => {
      const result = await authService.login({
        email: 'admin@claudeflare.com',
        password: 'admin123'
      });

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('admin@claudeflare.com');
    });

    it('should reject login with invalid credentials', async () => {
      const result = await authService.login({
        email: 'admin@claudeflare.com',
        password: 'wrongpassword'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should require email and password', async () => {
      const result = await authService.login({
        email: '',
        password: ''
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('JWT Token Management', () => {
    it('should generate access and refresh tokens', async () => {
      const result = await authService.login({
        email: 'admin@claudeflare.com',
        password: 'admin123'
      });

      expect(result.token?.accessToken).toBeDefined();
      expect(result.token?.refreshToken).toBeDefined();
      expect(result.token?.tokenType).toBe('Bearer');
    });

    it('should refresh expired token', async () => {
      const loginResult = await authService.login({
        email: 'admin@claudeflare.com',
        password: 'admin123'
      });

      const refreshResult = await authService.refreshToken({
        refreshToken: loginResult.token?.refreshToken || ''
      });

      expect(refreshResult.success).toBe(true);
      expect(refreshResult.token?.accessToken).toBeDefined();
    });

    it('should reject invalid refresh token', async () => {
      const result = await authService.refreshToken({
        refreshToken: 'invalid-token'
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Logout Flow', () => {
    it('should successfully logout user', async () => {
      const loginResult = await authService.login({
        email: 'admin@claudeflare.com',
        password: 'admin123'
      });

      const result = await authService.logout({
        accessToken: loginResult.token?.accessToken || ''
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Registration Flow', () => {
    it('should register new user successfully', async () => {
      const result = await authService.register({
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User'
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.username).toBe('newuser');
    });

    it('should reject registration with existing email', async () => {
      const result = await authService.register({
        username: 'admin',
        email: 'admin@claudeflare.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should require all mandatory fields', async () => {
      const result = await authService.register({
        username: '',
        email: '',
        password: '',
        firstName: '',
        lastName: ''
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('Login Attempt Tracking', () => {
    it('should track failed login attempts', async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await authService.login({
            email: 'admin@claudeflare.com',
            password: 'wrong'
          });
        } catch {}
      }

      // Should still allow login after 3 failed attempts (max is 5)
      const result = await authService.login({
        email: 'admin@claudeflare.com',
        password: 'admin123'
      });

      expect(result.success).toBe(true);
    });

    it('should lock account after max attempts', async () => {
      const lockoutService = new EnterpriseAuthService({
        jwtSecret: 'test',
        jwtAlgorithm: 'HS256',
        jwtExpiry: 3600,
        refreshTokenExpiry: 86400,
        maxLoginAttempts: 3,
        lockoutDuration: 15,
        mfaRequired: false,
        sessionTimeout: 3600,
        cookieSecure: false,
        cookieSameSite: 'lax'
      });

      for (let i = 0; i < 5; i++) {
        try {
          await lockoutService.login({
            email: 'admin@claudeflare.com',
            password: 'wrong'
          });
        } catch {}
      }

      // Should fail after max attempts
      const result = await lockoutService.login({
        email: 'admin@claudeflare.com',
        password: 'admin123'
      });

      expect(result.success).toBe(false);
    });
  });

  describe('API Key Management', () => {
    it('should create API key', async () => {
      const key = await authService.createApiKey('user-1', 'Test Key', ['read', 'write']);

      expect(key).toBeDefined();
      expect(key.startsWith('cf_')).toBe(true);
    });

    it('should validate API key', async () => {
      const key = await authService.createApiKey('user-1', 'Test Key', ['read']);
      const validation = await authService.validateApiKey(key);

      expect(validation).not.toBeNull();
      expect(validation?.userId).toBe('user-1');
      expect(validation?.permissions).toEqual(['read']);
    });

    it('should reject invalid API key', async () => {
      const validation = await authService.validateApiKey('invalid-key');
      expect(validation).toBeNull();
    });

    it('should list API keys for user', async () => {
      await authService.createApiKey('user-1', 'Key 1', ['read']);
      await authService.createApiKey('user-1', 'Key 2', ['write']);

      const keys = await authService.listApiKeys('user-1');
      expect(keys.length).toBe(2);
    });

    it('should revoke API key', async () => {
      const key = await authService.createApiKey('user-1', 'Test Key', ['read']);

      const revoked = await authService.revokeApiKey('user-1', key);
      expect(revoked).toBe(true);

      const validation = await authService.validateApiKey(key);
      expect(validation).toBeNull();
    });
  });

  describe('Multi-Factor Authentication', () => {
    it('should setup MFA for user', async () => {
      const result = await authService.setupMFA('user-1', 'totp');

      expect(result.success).toBe(true);
      expect(result.secret).toBeDefined();
      expect(result.backupCodes).toBeDefined();
    });

    it('should verify MFA code', async () => {
      const result = await authService.verifyMFA('user-1', '123456');

      expect(result.success).toBe(true);
    });
  });

  describe('OAuth2 Integration', () => {
    it('should generate OAuth2 authorization URL', async () => {
      const result = await authService.getOAuth2AuthorizationUrl('github');

      expect(result.url).toBeDefined();
      expect(result.state).toBeDefined();
    });

    it('should handle OAuth2 callback', async () => {
      const result = await authService.handleOAuth2Callback('github', {
        code: 'test-code',
        state: 'test-state'
      });

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
    });
  });

  describe('SAML2 Integration', () => {
    it('should generate SAML2 authorization URL', async () => {
      const url = await authService.getSAML2AuthorizationUrl('saml-provider');

      expect(url).toBeDefined();
      expect(url).toContain('saml2');
    });

    it('should handle SAML2 callback', async () => {
      const result = await authService.handleSAML2Callback('saml-provider', {
        assertion: 'test-assertion'
      });

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
    });
  });
});
