/**
 * JWT Token Handling Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
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
  isTokenExpired,
  getTimeUntilExpiration,
  getDefaultPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  type JWTPayload,
  type JWTConfig,
  type Permission,
} from './jwt';
import { AuthError } from './types';

describe('JWT Token Handling', () => {
  let keyPair: { privateKey: string; publicKey: string };
  let config: JWTConfig;

  beforeEach(async () => {
    keyPair = await generateRSAKeyPair();
    config = {
      issuer: 'test-issuer',
      audience: 'test-audience',
      accessTokenTTL: 3600, // 1 hour
      refreshTokenTTL: 604800, // 7 days
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      keyId: 'test-key-id',
    };
  });

  describe('Key Generation', () => {
    it('should generate RSA key pair', async () => {
      const keys = await generateRSAKeyPair();

      expect(keys.privateKey).toBeDefined();
      expect(keys.publicKey).toBeDefined();
      expect(keys.privateKey.length).toBeGreaterThan(0);
      expect(keys.publicKey.length).toBeGreaterThan(0);
    });

    it('should generate different keys each time', async () => {
      const keys1 = await generateRSAKeyPair();
      const keys2 = await generateRSAKeyPair();

      expect(keys1.privateKey).not.toBe(keys2.privateKey);
      expect(keys1.publicKey).not.toBe(keys2.publicKey);
    });
  });

  describe('Token Signing', () => {
    it('should sign JWT token', async () => {
      const payload: JWTPayload = {
        sub: 'user-123',
        iss: config.issuer,
        aud: config.audience,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'token-123',
        role: 'user',
        sessionId: 'session-123',
        type: 'access',
        permissions: getDefaultPermissions('user'),
      };

      const token = await signJWT(payload, config.privateKey, config.keyId);

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3); // header.payload.signature
    });

    it('should include key ID in header when provided', async () => {
      const payload: JWTPayload = {
        sub: 'user-123',
        iss: config.issuer,
        aud: config.audience,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'token-123',
        role: 'user',
        sessionId: 'session-123',
        type: 'access',
        permissions: [],
      };

      const token = await signJWT(payload, config.privateKey, config.keyId);
      const header = JSON.parse(atob(token.split('.')[0]));

      expect(header.kid).toBe(config.keyId);
    });
  });

  describe('Token Verification', () => {
    it('should verify valid JWT token', async () => {
      const payload: JWTPayload = {
        sub: 'user-123',
        iss: config.issuer,
        aud: config.audience,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'token-123',
        role: 'user',
        sessionId: 'session-123',
        type: 'access',
        permissions: [],
      };

      const token = await signJWT(payload, config.privateKey);
      const { header, payload: verifiedPayload } = await verifyJWT(token, config.publicKey);

      expect(verifiedPayload.sub).toBe(payload.sub);
      expect(verifiedPayload.role).toBe(payload.role);
      expect(header.alg).toBe('RS256');
    });

    it('should reject token with invalid signature', async () => {
      const payload: JWTPayload = {
        sub: 'user-123',
        iss: config.issuer,
        aud: config.audience,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'token-123',
        role: 'user',
        sessionId: 'session-123',
        type: 'access',
        permissions: [],
      };

      const token = await signJWT(payload, config.privateKey);
      const tamperedToken = token.slice(0, -10) + 'tampered';

      await expect(verifyJWT(tamperedToken, config.publicKey)).rejects.toThrow(AuthError);
    });

    it('should reject expired token', async () => {
      const payload: JWTPayload = {
        sub: 'user-123',
        iss: config.issuer,
        aud: config.audience,
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        jti: 'token-123',
        role: 'user',
        sessionId: 'session-123',
        type: 'access',
        permissions: [],
      };

      const token = await signJWT(payload, config.privateKey);

      await expect(verifyJWT(token, config.publicKey)).rejects.toThrow(AuthError);
    });

    it('should reject token with invalid algorithm', async () => {
      const payload: JWTPayload = {
        sub: 'user-123',
        iss: config.issuer,
        aud: config.audience,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'token-123',
        role: 'user',
        sessionId: 'session-123',
        type: 'access',
        permissions: [],
      };

      const token = await signJWT(payload, config.privateKey);
      const parts = token.split('.');
      const header = JSON.parse(atob(parts[0]));
      header.alg = 'HS256';
      parts[0] = btoa(JSON.stringify(header));
      const tamperedToken = parts.join('.');

      await expect(verifyJWT(tamperedToken, config.publicKey)).rejects.toThrow(AuthError);
    });
  });

  describe('Token Generation', () => {
    it('should generate access token', async () => {
      const token = await generateAccessToken({
        userId: 'user-123',
        role: 'user',
        permissions: getDefaultPermissions('user'),
        sessionId: 'session-123',
        config,
      });

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);

      const payload = decodeJWT(token);
      expect(payload.sub).toBe('user-123');
      expect(payload.type).toBe('access');
    });

    it('should generate refresh token', async () => {
      const token = await generateRefreshToken({
        userId: 'user-123',
        role: 'user',
        permissions: getDefaultPermissions('user'),
        sessionId: 'session-123',
        config,
      });

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);

      const payload = decodeJWT(token);
      expect(payload.sub).toBe('user-123');
      expect(payload.type).toBe('refresh');
    });

    it('should generate token pair', async () => {
      const tokenPair = await generateTokenPair({
        userId: 'user-123',
        role: 'user',
        permissions: getDefaultPermissions('user'),
        sessionId: 'session-123',
        config,
      });

      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(tokenPair.expiresAt).toBeDefined();
      expect(tokenPair.tokenType).toBe('Bearer');

      const accessPayload = decodeJWT(tokenPair.accessToken);
      const refreshPayload = decodeJWT(tokenPair.refreshToken);

      expect(accessPayload.type).toBe('access');
      expect(refreshPayload.type).toBe('refresh');
      expect(accessPayload.sub).toBe(refreshPayload.sub);
    });

    it('should include organization ID when provided', async () => {
      const tokenPair = await generateTokenPair({
        userId: 'user-123',
        role: 'user',
        permissions: getDefaultPermissions('user'),
        sessionId: 'session-123',
        organizationId: 'org-123',
        config,
      });

      const accessPayload = decodeJWT(tokenPair.accessToken);
      expect(accessPayload.orgId).toBe('org-123');
    });
  });

  describe('Token Validation', () => {
    it('should validate access token', async () => {
      const token = await generateAccessToken({
        userId: 'user-123',
        role: 'user',
        permissions: getDefaultPermissions('user'),
        sessionId: 'session-123',
        config,
      });

      const payload = await validateAccessToken(token, config);
      expect(payload.type).toBe('access');
      expect(payload.sub).toBe('user-123');
    });

    it('should reject refresh token as access token', async () => {
      const token = await generateRefreshToken({
        userId: 'user-123',
        role: 'user',
        permissions: getDefaultPermissions('user'),
        sessionId: 'session-123',
        config,
      });

      await expect(validateAccessToken(token, config)).rejects.toThrow(AuthError);
    });

    it('should validate refresh token', async () => {
      const token = await generateRefreshToken({
        userId: 'user-123',
        role: 'user',
        permissions: getDefaultPermissions('user'),
        sessionId: 'session-123',
        config,
      });

      const payload = await validateRefreshToken(token, config);
      expect(payload.type).toBe('refresh');
      expect(payload.sub).toBe('user-123');
    });

    it('should reject access token as refresh token', async () => {
      const token = await generateAccessToken({
        userId: 'user-123',
        role: 'user',
        permissions: getDefaultPermissions('user'),
        sessionId: 'session-123',
        config,
      });

      await expect(validateRefreshToken(token, config)).rejects.toThrow(AuthError);
    });
  });

  describe('Token Decoding', () => {
    it('should decode JWT without verification', async () => {
      const token = await generateAccessToken({
        userId: 'user-123',
        role: 'user',
        permissions: getDefaultPermissions('user'),
        sessionId: 'session-123',
        config,
      });

      const payload = decodeJWT(token);
      expect(payload.sub).toBe('user-123');
      expect(payload.role).toBe('user');
    });

    it('should decode invalid JWT format', () => {
      expect(() => decodeJWT('invalid-token')).toThrow(AuthError);
    });
  });

  describe('Token Extraction', () => {
    it('should extract token from Bearer header', () => {
      const header = 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';
      const token = extractToken(header);

      expect(token).toBe('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...');
    });

    it('should return null for invalid header', () => {
      expect(extractToken(null)).toBeNull();
      expect(extractToken('Invalid')).toBeNull();
      expect(extractToken('Basic dXNlcjpwYXNz')).toBeNull();
    });
  });

  describe('Token Expiration', () => {
    it('should check if token is expired', async () => {
      const payload: JWTPayload = {
        sub: 'user-123',
        iss: config.issuer,
        aud: config.audience,
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired
        jti: 'token-123',
        role: 'user',
        sessionId: 'session-123',
        type: 'access',
        permissions: [],
      };

      const token = await signJWT(payload, config.privateKey);
      expect(isTokenExpired(token)).toBe(true);
    });

    it('should check if token is not expired', async () => {
      const token = await generateAccessToken({
        userId: 'user-123',
        role: 'user',
        permissions: getDefaultPermissions('user'),
        sessionId: 'session-123',
        config,
      });

      expect(isTokenExpired(token)).toBe(false);
    });

    it('should get time until expiration', async () => {
      const token = await generateAccessToken({
        userId: 'user-123',
        role: 'user',
        permissions: getDefaultPermissions('user'),
        sessionId: 'session-123',
        config,
      });

      const timeUntil = getTimeUntilExpiration(token);
      expect(timeUntil).toBeGreaterThan(0);
      expect(timeUntil).toBeLessThanOrEqual(3600);
    });
  });

  describe('Default Permissions', () => {
    it('should get default permissions for user role', () => {
      const permissions = getDefaultPermissions('user');

      expect(permissions).toBeDefined();
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.some(p => p.resource === 'chat')).toBe(true);
    });

    it('should get default permissions for admin role', () => {
      const permissions = getDefaultPermissions('admin');

      expect(permissions).toBeDefined();
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.some(p => p.action === 'manage')).toBe(true);
    });

    it('should get default permissions for anonymous role', () => {
      const permissions = getDefaultPermissions('anonymous');

      expect(permissions).toBeDefined();
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.every(p => p.action === 'read')).toBe(true);
    });
  });

  describe('Permission Checking', () => {
    const permissions: Permission[] = [
      { resource: 'chat', action: 'execute' },
      { resource: 'models', action: 'read' },
      { resource: 'codebase', action: 'create' },
    ];

    it('should check if user has permission', () => {
      expect(hasPermission(permissions, 'chat', 'execute')).toBe(true);
      expect(hasPermission(permissions, 'chat', 'read')).toBe(false);
    });

    it('should check if user has any permission', () => {
      const required: Permission[] = [
        { resource: 'chat', action: 'read' },
        { resource: 'models', action: 'read' },
      ];

      expect(hasAnyPermission(permissions, required)).toBe(true);
    });

    it('should check if user has all permissions', () => {
      const required: Permission[] = [
        { resource: 'chat', action: 'execute' },
        { resource: 'models', action: 'read' },
      ];

      expect(hasAllPermissions(permissions, required)).toBe(true);

      const notAllRequired: Permission[] = [
        { resource: 'chat', action: 'execute' },
        { resource: 'users', action: 'manage' },
      ];

      expect(hasAllPermissions(permissions, notAllRequired)).toBe(false);
    });
  });
});
