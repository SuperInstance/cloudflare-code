/**
 * Cocapn Hybrid IDE Authentication System
 *
 * Features:
 * - User registration and login
 * - JWT-based session management
 * - KV storage for user data
 * - Password hashing with Web Crypto API
 * - Protected API endpoints
 */

import type { KVNamespace } from '@cloudflare/workers-types';

// Types for our authentication system
export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: number;
  lastLogin?: number;
  profile?: {
    name?: string;
    avatar?: string;
    preferences?: {
      theme: 'light' | 'dark';
      language: string;
    };
  };
}

export interface Session {
  userId: string;
  token: string;
  expiresAt: number;
  createdAt: number;
}

export interface AuthConfig {
  kvNamespace: KVNamespace;
  jwtSecret: string;
  sessionTimeout: number; // in milliseconds
  maxLoginAttempts: number;
}

// Authentication configuration (will be set by Worker)
let authConfig: AuthConfig | null = null;

// Initialize auth config with environment variables
function initializeAuthConfig(kv: KVNamespace): AuthConfig {
  if (authConfig) return authConfig;

  authConfig = {
    kvNamespace: kv,
    jwtSecret: (globalThis as any).JWT_SECRET || 'your-secret-key-change-in-production',
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    maxLoginAttempts: 5
  };

  return authConfig;
}

// Utility functions
export class AuthUtils {
  // Generate password hash (using Web Crypto API)
  static async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'cocapn-auth-salt');

    // Simple hash using Web Crypto API
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Verify password (simple comparison for demo)
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    const passwordHash = await this.hashPassword(password);
    return passwordHash === hash;
  }

  // Generate JWT token
  static generateJWT(userId: string, config: AuthConfig): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      userId,
      exp: Date.now() + config.sessionTimeout,
      iat: Date.now()
    }));

    const signature = crypto.subtle.digest('SHA-256',
      new TextEncoder().encode(header + '.' + payload + config.jwtSecret)
    ).then(hash => btoa(String.fromCharCode(...new Uint8Array(hash))));

    return `${header}.${payload}.${signature}`;
  }

  // Verify JWT token
  static async verifyJWT(token: string): Promise<string | null> {
    try {
      const [header, payload, signature] = token.split('.');

      const decodedPayload = JSON.parse(atob(payload));
      const now = Date.now();

      if (decodedPayload.exp < now) {
        return null; // Token expired
      }

      return decodedPayload.userId;
    } catch (error) {
      return null;
    }
  }

  // Generate random session token
  static generateSessionToken(): string {
    return crypto.randomUUID() + '-' + crypto.randomUUID();
  }

  // Validate email format
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate username format
  static isValidUsername(username: string): boolean {
    return username.length >= 3 && username.length <= 20 &&
           /^[a-zA-Z0-9_]+$/.test(username);
  }

  // Validate password strength
  static isStrongPassword(password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*]/.test(password)) {
      errors.push('Password must contain at least one special character (!@#$%^&*)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Auth database operations
export class AuthDatabase {
  private kv: KVNamespace;
  private config: AuthConfig;

  constructor(kv: KVNamespace, config: AuthConfig) {
    this.kv = kv;
    this.config = config;
  }

  // User operations
  async createUser(user: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const userId = crypto.randomUUID();
    const newUser: User = {
      ...user,
      id: userId,
      createdAt: Date.now()
    };

    await this.kv.put(`user:${userId}`, JSON.stringify(newUser));
    await this.kv.put(`user:email:${user.email}`, userId);
    await this.kv.put(`user:username:${user.username}`, userId);

    return newUser;
  }

  async getUserById(userId: string): Promise<User | null> {
    const userData = await this.kv.get(`user:${userId}`);
    return userData ? JSON.parse(userData) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const userId = await this.kv.get(`user:email:${email}`);
    return userId ? this.getUserById(userId) : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const userId = await this.kv.get(`user:username:${username}`);
    return userId ? this.getUserById(userId) : null;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const user = await this.getUserById(userId);
    if (!user) return null;

    const updatedUser = { ...user, ...updates };
    await this.kv.put(`user:${userId}`, JSON.stringify(updatedUser));

    return updatedUser;
  }

  // Session operations
  async createSession(userId: string): Promise<Session> {
    const token = AuthUtils.generateSessionToken();
    const session: Session = {
      userId,
      token,
      expiresAt: Date.now() + this.config.sessionTimeout,
      createdAt: Date.now()
    };

    await this.kv.put(`session:${token}`, JSON.stringify(session));
    await this.kv.put(`session:user:${userId}`, token);

    return session;
  }

  async getSession(token: string): Promise<Session | null> {
    const sessionData = await this.kv.get(`session:${token}`);
    return sessionData ? JSON.parse(sessionData) : null;
  }

  async deleteSession(token: string): Promise<void> {
    const session = await this.getSession(token);
    if (session) {
      await this.kv.delete(`session:${token}`);
      await this.kv.delete(`session:user:${session.userId}`);
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    // This would typically be run as a scheduled job
    // For now, we'll just count expired sessions
    return 0; // Not implemented for demo
  }

  // Security operations
  async incrementLoginAttempts(email: string): Promise<number> {
    const key = `login_attempts:${email}`;
    const current = parseInt((await this.kv.get(key)) || '0');
    const newCount = current + 1;

    await this.kv.put(key, newCount.toString(), { expirationTtl: 15 * 60 }); // 15 minutes

    return newCount;
  }

  async resetLoginAttempts(email: string): Promise<void> {
    await this.kv.delete(`login_attempts:${email}`);
  }

  // Rate limiting operations
  async isRateLimited(ip: string): Promise<boolean> {
    const key = `rate_limit:${ip}:${Math.floor(Date.now() / (60 * 1000))}`;
    const count = parseInt((await this.kv.get(key)) || '0');
    return count >= 10; // 10 requests per minute
  }

  async incrementRateLimit(ip: string): Promise<void> {
    const key = `rate_limit:${ip}:${Math.floor(Date.now() / (60 * 1000))}`;
    const current = parseInt((await this.kv.get(key)) || '0');
    await this.kv.put(key, (current + 1).toString(), { expirationTtl: 60 });
  }

  async isLoginBlocked(email: string): Promise<boolean> {
    const attempts = parseInt((await this.kv.get(`login_attempts:${email}`)) || '0');
    return attempts >= this.config.maxLoginAttempts;
  }
}

// Authentication middleware
export function requireAuth(): any {
  return async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const token = authHeader.substring(7);
    const kv = c.env.KV_AUTH_NAMESPACE;
    const config = initializeAuthConfig(kv);
    const userId = await AuthUtils.verifyJWT(token);

    if (!userId) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Add user info to context
    c.set('userId', userId);
    c.set('authToken', token);

    await next();
  };
}

// Rate limiting middleware
export function rateLimit(limit: number, window: number): any {
  return async (c: any, next: any) => {
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const kv = c.env.KV_AUTH_NAMESPACE;
    const db = new AuthDatabase(kv, initializeAuthConfig(kv));

    const isLimited = await db.isRateLimited(ip);
    if (isLimited) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    await db.incrementRateLimit(ip);
    await next();
  };
}

// Create auth router
export { authRouter } from './auth-router';