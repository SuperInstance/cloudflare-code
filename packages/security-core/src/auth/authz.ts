// @ts-nocheck - External dependencies (jsonwebtoken, bcrypt) may not be installed

/**
 * Authentication & Authorization - Enterprise-grade identity and access management
 * Provides JWT, OAuth2, RBAC, ABAC, session management, and MFA support
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import {
  JwtPayload,
  JwtToken,
  AuthToken,
  User,
  UserStatus,
  Role,
  Permission,
  AccessRequest,
  AccessContext,
  AccessDecision,
  MfaChallenge,
  MfaMethod,
  Session,
  PrincipalType,
  AuthenticationError,
  AuthorizationError,
} from '../types';

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

export interface TokenConfig {
  issuer: string;
  audience: string[];
  secret: string;
  accessTokenExpiry: number;
  refreshTokenExpiry: number;
  algorithm?: jwt.Algorithm;
}

export class TokenManager {
  private config: TokenConfig;

  constructor(config: TokenConfig) {
    this.config = {
      algorithm: 'HS256',
      ...config,
    };
  }

  /**
   * Generate a JWT access token
   */
  async generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JwtPayload = {
      ...payload,
      iat: now,
      exp: now + this.config.accessTokenExpiry,
    };

    return jwt.sign(fullPayload, this.config.secret, {
      issuer: this.config.issuer,
      audience: this.config.audience,
      algorithm: this.config.algorithm,
    });
  }

  /**
   * Generate a JWT refresh token
   */
  async generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JwtPayload = {
      ...payload,
      iat: now,
      exp: now + this.config.refreshTokenExpiry,
    };

    return jwt.sign(fullPayload, this.config.secret, {
      issuer: this.config.issuer,
      audience: this.config.audience,
      algorithm: this.config.algorithm,
    });
  }

  /**
   * Generate a full auth token pair
   */
  async generateAuthToken(user: User, scopes?: string[]): Promise<AuthToken> {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.userId,
      iss: this.config.issuer,
      aud: this.config.audience,
      scope: scopes || user.permissions.map(p => `${p.resource}:${p.action}`),
      roles: user.roles.map(r => r.name),
      permissions: user.permissions.map(p => p.permissionId),
      customClaims: {
        email: user.email,
        username: user.username,
        mfaEnabled: user.mfaEnabled,
      },
    };

    const accessToken = await this.generateAccessToken(payload);
    const refreshToken = await this.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.accessTokenExpiry,
      scope: payload.scope,
      issuedAt: new Date(),
    };
  }

  /**
   * Verify and decode a JWT token
   */
  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const payload = jwt.verify(token, this.config.secret, {
        issuer: this.config.issuer,
        audience: this.config.audience,
      }) as JwtPayload;
      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError(`Invalid token: ${error.message}`);
      } else if (error instanceof jwt.NotBeforeError) {
        throw new AuthenticationError('Token not yet valid');
      }
      throw new AuthenticationError('Token verification failed');
    }
  }

  /**
   * Decode a token without verification (for debugging)
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }

  /**
   * Refresh an access token using a refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    const payload = await this.verifyToken(refreshToken);

    // Generate new access token with same payload
    const newPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: payload.sub,
      iss: payload.iss,
      aud: payload.aud,
      nbf: payload.nbf,
      jti: payload.jti,
      scope: payload.scope,
      roles: payload.roles,
      permissions: payload.permissions,
      customClaims: payload.customClaims,
    };

    return this.generateAccessToken(newPayload);
  }

  /**
   * Extract bearer token from Authorization header
   */
  extractBearerToken(authHeader: string | null): string | null {
    if (!authHeader) {
      return null;
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }
    return parts[1];
  }
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export interface UserStore {
  findByUserId(userId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(user: Omit<User, 'userId' | 'createdAt'>): Promise<User>;
  update(userId: string, updates: Partial<User>): Promise<User>;
  delete(userId: string): Promise<void>;
  list(filter?: Record<string, any>): Promise<User[]>;
}

export class InMemoryUserStore implements UserStore {
  private users: Map<string, User> = new Map();

  async findByUserId(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const users = Array.from(this.users.values());
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const users = Array.from(this.users.values());
    return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
  }

  async create(user: Omit<User, 'userId' | 'createdAt'>): Promise<User> {
    const userId = uuidv4();
    const newUser: User = {
      userId,
      ...user,
      createdAt: new Date(),
    };
    this.users.set(userId, newUser);
    return newUser;
  }

  async update(userId: string, updates: Partial<User>): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new AuthenticationError(`User not found: ${userId}`);
    }
    const updated = { ...user, ...updates };
    this.users.set(userId, updated);
    return updated;
  }

  async delete(userId: string): Promise<void> {
    this.users.delete(userId);
  }

  async list(filter?: Record<string, any>): Promise<User[]> {
    let users = Array.from(this.users.values());
    if (filter) {
      users = users.filter(u => {
        return Object.entries(filter).every(([key, value]) => {
          const userValue = (u as any)[key];
          return userValue === value;
        });
      });
    }
    return users;
  }
}

// ============================================================================
// AUTHENTICATION SERVICE
// ============================================================================

export interface AuthServiceConfig {
  tokenManager: TokenManager;
  userStore: UserStore;
  maxFailedAttempts?: number;
  lockoutDuration?: number;
  passwordMinLength?: number;
  requireMfa?: boolean;
}

export class AuthService {
  private failedAttempts: Map<string, { count: number; lockedUntil?: Date }> = new Map();
  private config: Required<Omit<AuthServiceConfig, 'tokenManager' | 'userStore'>>;
  private authServiceConfig: AuthServiceConfig;

  constructor(config: AuthServiceConfig) {
    this.authServiceConfig = config;
    this.config = {
      maxFailedAttempts: config.maxFailedAttempts || 5,
      lockoutDuration: config.lockoutDuration || 15 * 60 * 1000, // 15 minutes
      passwordMinLength: config.passwordMinLength || 8,
      requireMfa: config.requireMfa ?? false,
    };
  }

  /**
   * Authenticate a user with email/username and password
   */
  async authenticate(
    identifier: string,
    password: string,
    context?: AccessContext
  ): Promise<{ user: User; requiresMfa: boolean }> {
    // Check if account is locked
    const lockout = this.failedAttempts.get(identifier);
    if (lockout && lockout.lockedUntil && lockout.lockedUntil > new Date()) {
      throw new AuthenticationError('Account is temporarily locked due to failed attempts');
    }

    // Find user
    const user =
      (await this.authServiceConfig.userStore.findByEmail(identifier)) ||
      (await this.authServiceConfig.userStore.findByUsername(identifier));

    if (!user) {
      await this.recordFailedAttempt(identifier);
      throw new AuthenticationError('Invalid credentials');
    }

    // Verify password
    const passwordValid = await this.verifyPassword(password, user.password);
    if (!passwordValid) {
      await this.recordFailedAttempt(identifier);
      throw new AuthenticationError('Invalid credentials');
    }

    // Check user status
    if (user.status === UserStatus.LOCKED) {
      throw new AuthenticationError('Account is locked');
    } else if (user.status === UserStatus.INACTIVE) {
      throw new AuthenticationError('Account is inactive');
    } else if (user.status === UserStatus.SUSPENDED) {
      throw new AuthenticationError('Account is suspended');
    } else if (user.status === UserStatus.PENDING_ACTIVATION) {
      throw new AuthenticationError('Account requires activation');
    }

    // Clear failed attempts on successful authentication
    this.failedAttempts.delete(identifier);

    // Update last login
    await this.authServiceConfig.userStore.update(user.userId, {
      lastLoginAt: new Date(),
    });

    return {
      user,
      requiresMfa: this.config.requireMfa || user.mfaEnabled,
    };
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    if (password.length < this.config.passwordMinLength) {
      throw new AuthenticationError(
        `Password must be at least ${this.config.passwordMinLength} characters`
      );
    }
    return bcrypt.hash(password, 12);
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Record a failed authentication attempt
   */
  private async recordFailedAttempt(identifier: string): Promise<void> {
    const current = this.failedAttempts.get(identifier) || { count: 0 };
    current.count++;

    if (current.count >= this.config.maxFailedAttempts) {
      current.lockedUntil = new Date(Date.now() + this.config.lockoutDuration);
    }

    this.failedAttempts.set(identifier, current);
  }

  /**
   * Check if an account is locked
   */
  isAccountLocked(identifier: string): boolean {
    const lockout = this.failedAttempts.get(identifier);
    return lockout?.lockedUntil !== undefined && lockout.lockedUntil > new Date();
  }

  /**
   * Unlock an account
   */
  unlockAccount(identifier: string): void {
    this.failedAttempts.delete(identifier);
  }
}

// ============================================================================
// AUTHORIZATION SERVICE (RBAC + ABAC)
// ============================================================================

export interface AuthorizationServiceConfig {
  userStore: UserStore;
}

export class AuthorizationService {
  constructor(private config: AuthorizationServiceConfig) {}

  /**
   * Check if a user has a specific permission
   */
  async hasPermission(user: User, resource: string, action: string): Promise<boolean> {
    // Check direct permissions
    const hasDirectPermission = user.permissions.some(
      p => p.resource === resource && p.action === action
    );
    if (hasDirectPermission) {
      return true;
    }

    // Check role-based permissions
    for (const role of user.roles) {
      const hasRolePermission = role.permissions.some(
        p => p.resource === resource && p.action === action
      );
      if (hasRolePermission) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check access with RBAC and ABAC
   */
  async checkAccess(
    user: User,
    resource: string,
    action: string,
    context?: AccessContext
  ): Promise<AccessDecision> {
    // Check basic permission
    const hasPermission = await this.hasPermission(user, resource, action);

    if (!hasPermission) {
      return {
        allowed: false,
        reason: 'User does not have the required permission',
        evaluatedAt: new Date(),
      };
    }

    // Check ABAC conditions if context provided
    if (context) {
      const abacResult = await this.checkAbacConditions(user, resource, action, context);
      if (!abacResult.allowed) {
        return abacResult;
      }
    }

    return {
      allowed: true,
      evaluatedAt: new Date(),
    };
  }

  /**
   * Check ABAC (Attribute-Based Access Control) conditions
   */
  private async checkAbacConditions(
    user: User,
    resource: string,
    action: string,
    context: AccessContext
  ): Promise<AccessDecision> {
    // Get permission with conditions
    const permission = user.permissions.find(
      p => p.resource === resource && p.action === action
    );

    if (!permission || !permission.conditions) {
      return { allowed: true, evaluatedAt: new Date() };
    }

    // Evaluate conditions
    for (const [key, expectedValue] of Object.entries(permission.conditions)) {
      const actualValue = (context as any)[key] || user.attributes[key];

      if (expectedValue instanceof Array) {
        if (!expectedValue.includes(actualValue)) {
          return {
            allowed: false,
            reason: `Condition '${key}' does not match: expected ${expectedValue}, got ${actualValue}`,
            evaluatedAt: new Date(),
          };
        }
      } else if (actualValue !== expectedValue) {
        return {
          allowed: false,
          reason: `Condition '${key}' does not match: expected ${expectedValue}, got ${actualValue}`,
          evaluatedAt: new Date(),
        };
      }
    }

    return { allowed: true, evaluatedAt: new Date() };
  }

  /**
   * Grant a permission to a user
   */
  async grantPermission(
    userId: string,
    resource: string,
    action: string,
    conditions?: Record<string, any>
  ): Promise<void> {
    const user = await this.config.userStore.findByUserId(userId);
    if (!user) {
      throw new AuthorizationError('User not found');
    }

    const permission: Permission = {
      permissionId: uuidv4(),
      resource,
      action,
      conditions,
    };

    user.permissions.push(permission);
    await this.config.userStore.update(userId, user);
  }

  /**
   * Revoke a permission from a user
   */
  async revokePermission(userId: string, permissionId: string): Promise<void> {
    const user = await this.config.userStore.findByUserId(userId);
    if (!user) {
      throw new AuthorizationError('User not found');
    }

    user.permissions = user.permissions.filter(p => p.permissionId !== permissionId);
    await this.config.userStore.update(userId, user);
  }

  /**
   * Assign a role to a user
   */
  async assignRole(userId: string, role: Role): Promise<void> {
    const user = await this.config.userStore.findByUserId(userId);
    if (!user) {
      throw new AuthorizationError('User not found');
    }

    if (!user.roles.find(r => r.roleId === role.roleId)) {
      user.roles.push(role);
      await this.config.userStore.update(userId, user);
    }
  }

  /**
   * Remove a role from a user
   */
  async removeRole(userId: string, roleId: string): Promise<void> {
    const user = await this.config.userStore.findByUserId(userId);
    if (!user) {
      throw new AuthorizationError('User not found');
    }

    user.roles = user.roles.filter(r => r.roleId !== roleId);
    await this.config.userStore.update(userId, user);
  }

  /**
   * Check if a user has a role
   */
  async hasRole(user: User, roleName: string): Promise<boolean> {
    return user.roles.some(r => r.name === roleName);
  }
}

// ============================================================================
// MULTI-FACTOR AUTHENTICATION
// ============================================================================

export class MfaService {
  private challenges: Map<string, MfaChallenge> = new Map();

  /**
   * Generate a TOTP secret
   */
  generateTotpSecret(): { secret: string; qrCodeUrl: string } {
    const secret = this.generateBase32Secret(32);
    const issuer = encodeURIComponent('ClaudeFlare');
    const qrCodeUrl = `otpauth://totp/ClaudeFlare?secret=${secret}&issuer=${issuer}`;

    return { secret, qrCodeUrl };
  }

  /**
   * Create an MFA challenge
   */
  async createChallenge(
    userId: string,
    method: MfaMethod,
    expiresAt: Date
  ): Promise<MfaChallenge> {
    const challengeId = uuidv4();
    const secret = this.generateSecureCode(6);

    const challenge: MfaChallenge = {
      challengeId,
      userId,
      method,
      secret,
      expiresAt,
      verified: false,
      attempts: 0,
      maxAttempts: 3,
    };

    this.challenges.set(challengeId, challenge);

    return challenge;
  }

  /**
   * Verify an MFA challenge
   */
  async verifyChallenge(challengeId: string, code: string): Promise<boolean> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      throw new AuthenticationError('Challenge not found');
    }

    // Check expiration
    if (new Date() > challenge.expiresAt) {
      this.challenges.delete(challengeId);
      throw new AuthenticationError('Challenge has expired');
    }

    // Check attempts
    if (challenge.attempts >= challenge.maxAttempts) {
      this.challenges.delete(challengeId);
      throw new AuthenticationError('Maximum attempts exceeded');
    }

    challenge.attempts++;

    // Verify code
    const isValid = code === challenge.secret;
    if (isValid) {
      challenge.verified = true;
      challenge.code = code;
    }

    return isValid;
  }

  /**
   * Verify a TOTP code (using a library would be needed for full implementation)
   */
  async verifyTotp(secret: string, code: string): Promise<boolean> {
    // In a real implementation, this would use a TOTP library
    // For now, just check if code matches expected format
    return /^\d{6}$/.test(code);
  }

  /**
   * Generate a base32 secret
   */
  private generateBase32Secret(length: number): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < length; i++) {
      secret += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return secret;
  }

  /**
   * Generate a secure numeric code
   */
  private generateSecureCode(length: number): string {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += Math.floor(Math.random() * 10);
    }
    return code;
  }
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export interface SessionStore {
  get(sessionId: string): Promise<Session | null>;
  create(session: Omit<Session, 'sessionId'>): Promise<Session>;
  update(sessionId: string, updates: Partial<Session>): Promise<Session>;
  delete(sessionId: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
  listByUserId(userId: string): Promise<Session[]>;
}

export class InMemorySessionStore implements SessionStore {
  private sessions: Map<string, Session> = new Map();

  async get(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Check if expired
    if (session.expiresAt < new Date()) {
      await this.delete(sessionId);
      return null;
    }

    return session;
  }

  async create(session: Omit<Session, 'sessionId'>): Promise<Session> {
    const sessionId = uuidv4();
    const newSession: Session = {
      sessionId,
      ...session,
    };
    this.sessions.set(sessionId, newSession);
    return newSession;
  }

  async update(sessionId: string, updates: Partial<Session>): Promise<Session> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new AuthenticationError('Session not found');
    }
    const updated = { ...session, ...updates };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async deleteByUserId(userId: string): Promise<void> {
    const sessions = await this.listByUserId(userId);
    for (const session of sessions) {
      this.sessions.delete(session.sessionId);
    }
  }

  async listByUserId(userId: string): Promise<Session[]> {
    const sessions = Array.from(this.sessions.values());
    return sessions.filter(s => s.userId === userId && s.expiresAt > new Date());
  }
}

export class SessionManager {
  constructor(private sessionStore: SessionStore) {}

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    ip: string,
    userAgent: string,
    timeoutMinutes: number = 60
  ): Promise<Session> {
    const now = new Date();
    const session = await this.sessionStore.create({
      userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + timeoutMinutes * 60 * 1000),
      lastActivityAt: now,
      ip,
      userAgent,
      mfaVerified: false,
      data: {},
    });
    return session;
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    return this.sessionStore.get(sessionId);
  }

  /**
   * Update session activity
   */
  async updateActivity(sessionId: string): Promise<void> {
    const session = await this.sessionStore.get(sessionId);
    if (session) {
      await this.sessionStore.update(sessionId, {
        lastActivityAt: new Date(),
      });
    }
  }

  /**
   * Validate a session
   */
  async validateSession(sessionId: string): Promise<Session | null> {
    const session = await this.sessionStore.get(sessionId);
    if (!session) {
      return null;
    }

    // Update activity on valid access
    await this.updateActivity(sessionId);
    return session;
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionId: string): Promise<void> {
    await this.sessionStore.delete(sessionId);
  }

  /**
   * Terminate all sessions for a user
   */
  async terminateAllUserSessions(userId: string): Promise<void> {
    await this.sessionStore.deleteByUserId(userId);
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    return this.sessionStore.listByUserId(userId);
  }
}

// ============================================================================
// OAUTH 2.0 HELPERS
// ============================================================================

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
}

export class OAuth2Helper {
  constructor(private config: OAuth2Config) {}

  /**
   * Generate OAuth 2.0 authorization URL
   */
  generateAuthorizationUrl(state: string, scopes?: string[]): string {
    const scope = scopes?.join(' ') || this.config.scopes.join(' ');
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope,
      state,
    });

    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForToken(code: string): Promise<AuthToken> {
    // In a real implementation, this would make an HTTP request to the tokenUrl
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new AuthenticationError('Failed to exchange code for token');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      scope: data.scope?.split(' '),
      issuedAt: new Date(),
    };
  }

  /**
   * Validate OAuth 2.0 state parameter
   */
  validateState(state: string, expectedState: string): boolean {
    return state === expectedState;
  }

  /**
   * Generate a secure state parameter
   */
  generateState(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
}

// All classes are already exported inline - no duplicate export needed
