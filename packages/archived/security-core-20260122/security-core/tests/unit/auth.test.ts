/**
 * Authentication System Tests
 * Comprehensive test suite for authentication and authorization components
 */

import { AuthService } from '../../src/auth/auth-service';
import { JwtService } from '../../src/auth/jwt-service';
import { SessionService } from '../../src/auth/session-service';
import { MfaService } from '../../src/auth/mfa-service';
import { OAuth2Service } from '../../src/auth/oauth2-service';
import { SAML2Service } from '../../src/auth/saml2-service';
import { AuthConfig } from '../../src/auth/types';
import { SecurityError } from '../../src/types';

describe('Authentication System', () => {
  let authService: AuthService;
  let jwtService: JwtService;
  let sessionService: SessionService;
  let mfaService: MfaService;
  let oauth2Service: OAuth2Service;
  let saml2Service: SAML2Service;

  const mockAuthConfig: AuthConfig = {
    jwtSecret: 'test-secret-key-12345678901234567890123456789012',
    jwtAlgorithm: 'HS256',
    jwtExpiry: 3600,
    refreshTokenExpiry: 86400,
    maxLoginAttempts: 5,
    lockoutDuration: 15,
    mfaRequired: false,
    allowedProviders: [],
    sessionTimeout: 60,
    cookieSecure: false,
    cookieSameSite: 'lax'
  };

  beforeEach(() => {
    authService = new AuthService(mockAuthConfig);
    jwtService = new JwtService(mockAuthConfig);
    sessionService = new SessionService(mockAuthConfig);
    mfaService = new MfaService();
    oauth2Service = new OAuth2Service({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback',
      authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
      tokenEndpoint: 'https://auth.example.com/oauth/token',
      scopes: ['read', 'write'],
      provider: 'google'
    }, authService);
    saml2Service = new SAML2Service({
      entityId: 'https://app.example.com/metadata',
      assertionConsumerServiceUrl: 'https://app.example.com/saml/callback',
      singleSignOnServiceUrl: 'https://auth.example.com/saml/sso',
      privateKey: 'test-private-key',
      certificate: 'test-certificate',
      idp: {
        entityId: 'https://auth.example.com/saml/idp',
        ssoUrl: 'https://auth.example.com/saml/sso',
        certificate: 'test-idp-certificate'
      }
    }, authService);
  });

  describe('AuthService', () => {
    describe('login', () => {
      it('should authenticate user with valid credentials', async () => {
        // Mock user data
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          password: await bcrypt.hash('password123', 12),
          firstName: 'Test',
          lastName: 'User',
          role: 'user',
          permissions: ['read:own'],
          mfaEnabled: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Mock required methods
        jest.spyOn(authService as any, 'findUserByEmail').mockResolvedValue(mockUser);
        jest.spyOn(authService as any, 'verifyPassword').mockResolvedValue(true);
        jest.spyOn(authService as any, 'generateTokens').mockResolvedValue({
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          scope: ['read', 'write']
        });
        jest.spyOn(authService as any, 'updateUserLoginInfo').mockResolvedValue(undefined);
        jest.spyOn(authService as any, 'logAuthEvent').mockResolvedValue(undefined);

        const request = {
          email: 'test@example.com',
          password: 'password123'
        };

        const result = await authService.login(request);

        expect(result.success).toBe(true);
        expect(result.token).toBeDefined();
        expect(result.user).toBeDefined();
        expect(result.user?.email).toBe('test@example.com');
      });

      it('should reject invalid credentials', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          password: await bcrypt.hash('password123', 12),
          isActive: true
        };

        jest.spyOn(authService as any, 'findUserByEmail').mockResolvedValue(mockUser);
        jest.spyOn(authService as any, 'verifyPassword').mockResolvedValue(false);

        const request = {
          email: 'test@example.com',
          password: 'wrongpassword'
        };

        await expect(authService.login(request)).rejects.toThrow(SecurityError);
      });

      it('should handle MFA requirement', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          password: await bcrypt.hash('password123', 12),
          mfaEnabled: true,
          isActive: true
        };

        jest.spyOn(authService as any, 'findUserByEmail').mockResolvedValue(mockUser);
        jest.spyOn(authService as any, 'verifyPassword').mockResolvedValue(true);
        jest.spyOn(authService as any, 'createMfaChallenge').mockResolvedValue('mock-challenge');

        const request = {
          email: 'test@example.com',
          password: 'password123'
        };

        const result = await authService.login(request);

        expect(result.success).toBe(true);
        expect(result.requiresMFA).toBe(true);
        expect(result.mfaChallenge).toBeDefined();
      });
    });

    describe('register', () => {
      it('should register new user successfully', async () => {
        const request = {
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'password123',
          firstName: 'New',
          lastName: 'User'
        };

        const mockUser = {
          id: 'user-123',
          ...request,
          role: 'user',
          mfaEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true
        };

        jest.spyOn(authService as any, 'findUserByEmail').mockResolvedValue(null);
        jest.spyOn(authService as any, 'createUser').mockResolvedValue(mockUser);
        jest.spyOn(authService as any, 'generateTokens').mockResolvedValue({
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          scope: ['read', 'write']
        });
        jest.spyOn(authService as any, 'logAuthEvent').mockResolvedValue(undefined);

        const result = await authService.register(request);

        expect(result.success).toBe(true);
        expect(result.user).toBeDefined();
        expect(result.user?.email).toBe('newuser@example.com');
      });

      it('should reject duplicate email registration', async () => {
        const request = {
          username: 'newuser',
          email: 'existing@example.com',
          password: 'password123'
        };

        jest.spyOn(authService as any, 'findUserByEmail').mockResolvedValue({
          id: 'existing-123',
          email: 'existing@example.com'
        });

        const result = await authService.register(request);

        expect(result.success).toBe(false);
        expect(result.error).toContain('already exists');
      });
    });

    describe('password reset', () => {
      it('should initiate password reset', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com'
        };

        jest.spyOn(authService as any, 'findUserByEmail').mockResolvedValue(mockUser);
        jest.spyOn(authService as any, 'generatePasswordResetToken').mockResolvedValue('reset-token-123');
        jest.spyOn(authService as any, 'sendPasswordResetEmail').mockResolvedValue(undefined);
        jest.spyOn(authService as any, 'logAuthEvent').mockResolvedValue(undefined);

        const result = await authService.requestPasswordReset('test@example.com');

        expect(result.success).toBe(true);
      });

      it('should confirm password reset', async () => {
        const request = {
          token: 'reset-token-123',
          newPassword: 'newpassword123',
          confirmPassword: 'newpassword123'
        };

        jest.spyOn(authService as any, 'validatePasswordResetToken').mockResolvedValue(true);
        jest.spyOn(authService as any, 'decodeToken').mockResolvedValue({ sub: 'user-123' });
        jest.spyOn(authService as any, 'findUserById').mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com'
        });
        jest.spyOn(authService as any, 'updateUserPassword').mockResolvedValue(undefined);
        jest.spyOn(authService as any, 'logAuthEvent').mockResolvedValue(undefined);
        jest.spyOn(jwtService, 'invalidateToken').mockResolvedValue(undefined);

        const result = await authService.confirmPasswordReset(request);

        expect(result.success).toBe(true);
      });
    });
  });

  describe('JwtService', () => {
    describe('token generation and validation', () => {
      it('should generate valid JWT token', async () => {
        const payload = {
          sub: 'user-123',
          email: 'test@example.com',
          roles: ['user'],
          iat: Math.floor(Date.now() / 1000)
        };

        const token = await jwtService.generateToken(payload);

        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
      });

      it('should validate valid JWT token', async () => {
        const payload = {
          sub: 'user-123',
          email: 'test@example.com',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        };

        const token = await jwtService.generateToken(payload);
        const isValid = await jwtService.validateToken(token);

        expect(isValid).toBe(true);
      });

      it('should reject expired JWT token', async () => {
        const payload = {
          sub: 'user-123',
          exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
        };

        const token = await jwtService.generateToken(payload);
        const isValid = await jwtService.validateToken(token);

        expect(isValid).toBe(false);
      });

      it('should invalidate token', async () => {
        const payload = {
          sub: 'user-123',
          exp: Math.floor(Date.now() / 1000) + 3600
        };

        const token = await jwtService.generateToken(payload);
        await jwtService.invalidateToken(token);
        const isValid = await jwtService.validateToken(token);

        expect(isValid).toBe(false);
      });
    });

    describe('refresh token', () => {
      it('should generate access and refresh tokens', async () => {
        const user = {
          id: 'user-123',
          email: 'test@example.com',
          roles: ['user']
        };

        const token = await jwtService.generateAccessToken(user);
        const refreshToken = await jwtService.generateRefreshToken(user);

        expect(token).toBeDefined();
        expect(refreshToken).toBeDefined();
        expect(token).not.toBe(refreshToken);
      });

      it('should validate refresh token', async () => {
        const user = {
          id: 'user-123'
        };

        const refreshToken = await jwtService.generateRefreshToken(user);
        const isValid = await jwtService.validateRefreshToken(refreshToken);

        expect(isValid).toBe(true);
      });
    });
  });

  describe('SessionService', () => {
    describe('session management', () => {
      it('should create new session', async () => {
        const user = {
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          roles: ['user'],
          permissions: ['read:own']
        };

        const ipAddress = '192.168.1.1';
        const userAgent = 'Mozilla/5.0';

        const session = await sessionService.createSession(user, ipAddress, userAgent);

        expect(session).toBeDefined();
        expect(session.sessionId).toBeDefined();
        expect(session.userId).toBe('user-123');
        expect(session.ip).toBe(ipAddress);
        expect(session.userAgent).toBe(userAgent);
      });

      it('should get active session', async () => {
        const user = { id: 'user-123', username: 'testuser' };
        const session = await sessionService.createSession(user, '192.168.1.1', 'Mozilla/5.0');

        const retrievedSession = await sessionService.getSession(session.sessionId);

        expect(retrievedSession).toBeDefined();
        expect(retrievedSession?.sessionId).toBe(session.sessionId);
      });

      it('should terminate session', async () => {
        const user = { id: 'user-123', username: 'testuser' };
        const session = await sessionService.createSession(user, '192.168.1.1', 'Mozilla/5.0');

        const terminated = await sessionService.terminateSession(session.sessionId);

        expect(terminated).toBe(true);

        const retrievedSession = await sessionService.getSession(session.sessionId);
        expect(retrievedSession).toBeNull();
      });

      it('should terminate user sessions', async () => {
        const userId = 'user-123';

        // Create multiple sessions
        const session1 = await sessionService.createSession(
          { id: userId, username: 'testuser' },
          '192.168.1.1',
          'Mozilla/5.0'
        );
        const session2 = await sessionService.createSession(
          { id: userId, username: 'testuser' },
          '192.168.1.2',
          'Chrome/90'
        );

        // Keep one session active
        const terminated = await sessionService.terminateAllUserSessions(userId, session1.sessionId);

        expect(terminated).toBe(1);

        const session1Exists = await sessionService.getSession(session1.sessionId);
        const session2Exists = await sessionService.getSession(session2.sessionId);

        expect(session1Exists).toBeDefined();
        expect(session2Exists).toBeNull();
      });
    });

    describe('session validation', () => {
      it('should validate session activity', async () => {
        const user = { id: 'user-123', username: 'testuser' };
        const session = await sessionService.createSession(user, '192.168.1.1', 'Mozilla/5.0');

        const isValid = await sessionService.validateSessionActivity(
          session.sessionId,
          '192.168.1.1',
          'Mozilla/5.0'
        );

        expect(isValid).toBe(true);
      });

      it('should detect IP mismatch', async () => {
        const user = { id: 'user-123', username: 'testuser' };
        const session = await sessionService.createSession(user, '192.168.1.1', 'Mozilla/5.0');

        const isValid = await sessionService.validateSessionActivity(
          session.sessionId,
          '192.168.1.2', // Different IP
          'Mozilla/5.0'
        );

        expect(isValid).toBe(false);
      });
    });
  });

  describe('MfaService', () => {
    describe('TOTP setup', () => {
      it('should generate TOTP secret and QR code', async () => {
        const result = await mfaService.setupMFA('user-123', 'totp');

        expect(result.success).toBe(true);
        expect(result.secret).toBeDefined();
        expect(result.qrCodeUrl).toBeDefined();
      });

      it('should verify TOTP setup', async () => {
        const setupResult = await mfaService.setupMFA('user-123', 'totp');

        // Mock verification code generation
        jest.spyOn(speakeasy, 'totp').mockReturnValueOnce(true);

        const result = await mfaService.verifySetup('user-123', 'totp', '123456');

        expect(result.success).toBe(true);
        expect(result.backupCodes).toBeDefined();
      });
    });

    describe('MFA challenge', () => {
      it('should generate MFA challenge', async () => {
        const challenge = await mfaService.generateChallenge('user-123', 'totp');

        expect(challenge).toBeDefined();
        expect(challenge.userId).toBe('user-123');
        expect(challenge.method).toBe('totp');
        expect(challenge.verified).toBe(false);
      });

      it('should verify MFA code', async () => {
        await mfaService.setupMFA('user-123', 'totp');

        jest.spyOn(speakeasy, 'totp').mockReturnValue(true);

        const isValid = await mfaService.verifyMFA('user-123', 'totp', '123456');

        expect(isValid).toBe(true);
      });
    });
  });

  describe('OAuth2Service', () => {
    describe('authorization', () => {
      it('should generate authorization URL', () => {
        const result = oauth2Service.generateAuthorizationUrl();

        expect(result.url).toBeDefined();
        expect(result.state).toBeDefined();
        expect(result.codeVerifier).toBeDefined();
        expect(result.url).toContain('response_type=code');
        expect(result.url).toContain('client_id=test-client-id');
      });
    });

    describe('callback handling', () => {
      it('should handle OAuth2 callback', async () => {
        const request = {
          code: 'auth-code-123',
          state: 'test-state'
        };

        jest.spyOn(oauth2Service as any, 'exchangeCodeForToken').mockResolvedValue({
          access_token: 'access-token-123',
          refresh_token: 'refresh-token-123'
        });

        jest.spyOn(oauth2Service as any, 'getUserInfo').mockResolvedValue({
          id: 'oauth-user-123',
          email: 'oauth@example.com',
          name: 'OAuth User'
        });

        jest.spyOn(authService as any, 'findOrCreateOAuth2User').mockResolvedValue({
          id: 'user-123',
          email: 'oauth@example.com',
          username: 'oauthuser'
        });

        jest.spyOn(authService as any, 'generateTokens').mockResolvedValue({
          accessToken: 'jwt-token-123',
          refreshToken: 'refresh-token-123',
          tokenType: 'Bearer',
          expiresIn: 3600,
          scope: ['read', 'write']
        });

        const result = await oauth2Service.handleCallback(request, 'code-verifier-123');

        expect(result.success).toBe(true);
        expect(result.token).toBeDefined();
        expect(result.user).toBeDefined();
      });
    });
  });

  describe('SAML2Service', () => {
    describe('metadata', () => {
      it('should generate SAML2 metadata', () => {
        const metadata = saml2Service.generateMetadata();

        expect(metadata).toBeDefined();
        expect(metadata).toContain('<EntityDescriptor');
        expect(metadata).toContain('entityID="https://app.example.com/metadata"');
      });
    });

    describe('authentication request', () => {
      it('should generate authentication request', async () => {
        const result = await saml2Service.generateAuthRequest();

        expect(result.samlRequest).toBeDefined();
        expect(result.relayState).toBeDefined();
        expect(typeof result.samlRequest).toBe('string');
      });
    });
  });

  // Helper functions
  const bcrypt = require('bcrypt');
});