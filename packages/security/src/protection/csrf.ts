/**
 * CSRF Protection Module
 * Comprehensive Cross-Site Request Forgery protection
 */

import { generateRandomString, generateUUID, hmacSHA256, constantTimeCompare } from '../utils/crypto';
import type { CSRFConfig, CSRFTokenInfo, SecurityContext } from '../types';
import { securityLogger } from '../utils/logger';

// ============================================================================
// CSRF Token Manager
// ============================================================================

export class CSRFTokenManager {
  private config: Required<CSRFConfig>;
  private tokens: Map<string, CSRFTokenInfo> = new Map();

  constructor(config: CSRFConfig = {}) {
    this.config = {
      tokenLength: config.tokenLength || 32,
      secretLength: config.secretLength || 32,
      saltLength: config.saltLength || 8,
      excludedPaths: config.excludedPaths || [],
      tokenGenerator: config.tokenGenerator || (() => generateRandomString(this.config.tokenLength)),
      tokenValidator: config.tokenValidator || this.defaultTokenValidator.bind(this)
    };
  }

  private defaultTokenValidator(token: string, secret: string): boolean {
    try {
      const [tokenPart, signaturePart] = token.split('.');

      if (!tokenPart || !signaturePart) {
        return false;
      }

      // Verify HMAC signature
      const expectedSignature = hmacSHA256(secret, tokenPart);
      return constantTimeCompare(signaturePart, expectedSignature);
    } catch {
      return false;
    }
  }

  /**
   * Generate a new CSRF token
   */
  generateToken(sessionID: string): string {
    const token = this.config.tokenGenerator();
    const secret = generateRandomString(this.config.secretLength);
    const salt = generateRandomString(this.config.saltLength);

    // Create HMAC signature
    const signature = hmacSHA256(secret, token);
    const signedToken = `${token}.${signature}`;

    // Store token info
    const tokenInfo: CSRFTokenInfo = {
      token: signedToken,
      secret,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    this.tokens.set(sessionID, tokenInfo);

    securityLogger.debug('CSRF token generated', {
      sessionID,
      tokenLength: token.length
    });

    return signedToken;
  }

  /**
   * Validate a CSRF token
   */
  validateToken(sessionID: string, token: string): boolean {
    const tokenInfo = this.tokens.get(sessionID);

    if (!tokenInfo) {
      securityLogger.warn('CSRF token not found for session', {
        sessionID
      });
      return false;
    }

    // Check expiration
    if (Date.now() > tokenInfo.expiresAt) {
      securityLogger.warn('CSRF token expired', {
        sessionID
      });
      this.tokens.delete(sessionID);
      return false;
    }

    // Validate token
    const isValid = this.config.tokenValidator(token, tokenInfo.secret);

    if (!isValid) {
      securityLogger.warn('CSRF token validation failed', {
        sessionID,
        token: token.substring(0, 10) + '...'
      });
    }

    return isValid;
  }

  /**
   * Refresh a CSRF token
   */
  refreshToken(sessionID: string): string {
    this.tokens.delete(sessionID);
    return this.generateToken(sessionID);
  }

  /**
   * Revoke a CSRF token
   */
  revokeToken(sessionID: string): void {
    this.tokens.delete(sessionID);
    securityLogger.debug('CSRF token revoked', {
      sessionID
    });
  }

  /**
   * Clean up expired tokens
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionID, tokenInfo] of this.tokens.entries()) {
      if (now > tokenInfo.expiresAt) {
        this.tokens.delete(sessionID);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      securityLogger.debug(`Cleaned up ${cleaned} expired CSRF tokens`);
    }

    return cleaned;
  }

  /**
   * Get token info
   */
  getTokenInfo(sessionID: string): CSRFTokenInfo | null {
    return this.tokens.get(sessionID) || null;
  }

  /**
   * Clear all tokens
   */
  clear(): void {
    this.tokens.clear();
  }

  /**
   * Get token count
   */
  getCount(): number {
    return this.tokens.size;
  }
}

// ============================================================================
// CSRF Protection Middleware
// ============================================================================

export class CSRFProtection {
  private tokenManager: CSRFTokenManager;
  private config: Required<CSRFConfig>;

  constructor(config: CSRFConfig = {}) {
    this.config = {
      tokenLength: config.tokenLength || 32,
      secretLength: config.secretLength || 32,
      saltLength: config.saltLength || 8,
      excludedPaths: config.excludedPaths || [],
      tokenGenerator: config.tokenGenerator,
      tokenValidator: config.tokenValidator
    };

    this.tokenManager = new CSRFTokenManager(config);
  }

  /**
   * Check if path is excluded from CSRF protection
   */
  private isPathExcluded(path: string): boolean {
    return this.config.excludedPaths.some(excludedPath => {
      // Convert to regex pattern
      const pattern = excludedPath
        .replace(/\*/g, '.*')
        .replace(/\//g, '\\/');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(path);
    });
  }

  /**
   * Extract CSRF token from request
   */
  private extractToken(request: Request): string | null {
    // Try header first
    const headerToken = request.headers.get('x-csrf-token');
    if (headerToken) {
      return headerToken;
    }

    // Try cookie
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim());
      const csrfCookie = cookies.find(c => c.startsWith('csrf_token='));
      if (csrfCookie) {
        return csrfCookie.split('=')[1];
      }
    }

    return null;
  }

  /**
   * Generate session ID from request
   */
  private generateSessionID(request: Request): string {
    const ip = request.headers.get('cf-connecting-ip') ||
               request.headers.get('x-forwarded-for')?.split(',')[0] ||
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const data = `${ip}:${userAgent}:${Date.now()}`;

    // Create a simple session ID
    return generateUUID();
  }

  /**
   * Middleware for CSRF protection
   */
  async middleware(request: Request, env: any): Promise<{
    valid: boolean;
    token?: string;
    error?: string;
  }> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Skip if path is excluded
    if (this.isPathExcluded(path)) {
      securityLogger.debug('CSRF protection skipped for excluded path', { path });
      return { valid: true };
    }

    // Skip for safe methods (GET, HEAD, OPTIONS)
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(request.method)) {
      return { valid: true };
    }

    // For state-changing methods, validate token
    const sessionID = this.generateSessionID(request);
    const token = this.extractToken(request);

    if (!token) {
      securityLogger.warn('CSRF token missing', {
        path,
        method: request.method
      });

      return {
        valid: false,
        error: 'CSRF token is missing'
      };
    }

    const isValid = this.tokenManager.validateToken(sessionID, token);

    if (!isValid) {
      securityLogger.warn('CSRF token validation failed', {
        path,
        method: request.method
      });
    }

    return {
      valid: isValid,
      error: isValid ? undefined : 'CSRF token is invalid'
    };
  }

  /**
   * Generate token for a session
   */
  generateToken(sessionID: string): string {
    return this.tokenManager.generateToken(sessionID);
  }

  /**
   * Validate token
   */
  validateToken(sessionID: string, token: string): boolean {
    return this.tokenManager.validateToken(sessionID, token);
  }

  /**
   * Refresh token
   */
  refreshToken(sessionID: string): string {
    return this.tokenManager.refreshToken(sessionID);
  }

  /**
   * Revoke token
   */
  revokeToken(sessionID: string): void {
    this.tokenManager.revokeToken(sessionID);
  }

  /**
   * Cleanup expired tokens
   */
  cleanup(): number {
    return this.tokenManager.cleanup();
  }
}

// ============================================================================
// Double Submit Cookie Pattern
// ============================================================================

export class DoubleSubmitCookieCSRF {
  private cookieName: string;
  private headerName: string;
  private tokenLength: number;
  private maxAge: number;

  constructor(
    cookieName: string = 'csrf_token',
    headerName: string = 'x-csrf-token',
    tokenLength: number = 32,
    maxAge: number = 24 * 60 * 60 * 1000 // 24 hours
  ) {
    this.cookieName = cookieName;
    this.headerName = headerName;
    this.tokenLength = tokenLength;
    this.maxAge = maxAge;
  }

  /**
   * Generate CSRF token for double submit cookie pattern
   */
  generateToken(): string {
    return generateRandomString(this.tokenLength);
  }

  /**
   * Validate CSRF token using double submit cookie pattern
   */
  validateToken(request: Request): boolean {
    const cookieToken = this.getTokenFromCookie(request);
    const headerToken = this.getTokenFromHeader(request);

    if (!cookieToken || !headerToken) {
      return false;
    }

    // Use constant-time comparison to prevent timing attacks
    return constantTimeCompare(cookieToken, headerToken);
  }

  /**
   * Get token from cookie
   */
  private getTokenFromCookie(request: Request): string | null {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) {
      return null;
    }

    const cookies = cookieHeader.split(';').map(c => c.trim());
    const csrfCookie = cookies.find(c => c.startsWith(`${this.cookieName}=`));

    if (!csrfCookie) {
      return null;
    }

    return csrfCookie.split('=')[1];
  }

  /**
   * Get token from header
   */
  private getTokenFromHeader(request: Request): string | null {
    return request.headers.get(this.headerName);
  }

  /**
   * Set CSRF cookie
   */
  setCookie(token: string): string {
    const maxAgeSeconds = Math.floor(this.maxAge / 1000);
    return `${this.cookieName}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`;
  }
}

// ============================================================================
// Synchronizer Token Pattern
// ============================================================================

export class SynchronizerTokenCSRF {
  private tokenManager: CSRFTokenManager;

  constructor(config: CSRFConfig = {}) {
    this.tokenManager = new CSRFTokenManager(config);
  }

  /**
   * Generate synchronizer token
   */
  generateToken(sessionID: string): string {
    return this.tokenManager.generateToken(sessionID);
  }

  /**
   * Validate synchronizer token
   */
  validateToken(sessionID: string, token: string): boolean {
    return this.tokenManager.validateToken(sessionID, token);
  }

  /**
   * Get token as hidden input field for forms
   */
  getHiddenInput(sessionID: string): string {
    const token = this.generateToken(sessionID);
    return `<input type="hidden" name="csrf_token" value="${token}">`;
  }

  /**
   * Get token as meta tag for AJAX
   */
  getMetaTag(sessionID: string): string {
    const token = this.generateToken(sessionID);
    return `<meta name="csrf-token" content="${token}">`;
  }
}

// ============================================================================
// CSRF Protection with Cloudflare KV
// ============================================================================

export class CloudflareKVCSRFProtection {
  private kv: KVNamespace;
  private prefix: string;
  private tokenLength: number;
  private maxAge: number;

  constructor(
    kv: KVNamespace,
    prefix: string = 'csrf:',
    tokenLength: number = 32,
    maxAge: number = 24 * 60 * 60 * 1000
  ) {
    this.kv = kv;
    this.prefix = prefix;
    this.tokenLength = tokenLength;
    this.maxAge = maxAge;
  }

  /**
   * Generate and store CSRF token
   */
  async generateToken(sessionID: string): Promise<string> {
    const token = generateRandomString(this.tokenLength);
    const key = this.prefix + sessionID;
    const ttl = Math.floor(this.maxAge / 1000);

    await this.kv.put(key, token, { expirationTtl: ttl });

    securityLogger.debug('CSRF token stored in KV', {
      sessionID,
      ttl
    });

    return token;
  }

  /**
   * Validate CSRF token
   */
  async validateToken(sessionID: string, token: string): Promise<boolean> {
    const key = this.prefix + sessionID;
    const storedToken = await this.kv.get(key);

    if (!storedToken) {
      securityLogger.warn('CSRF token not found in KV', {
        sessionID
      });
      return false;
    }

    const isValid = constantTimeCompare(storedToken, token);

    if (!isValid) {
      securityLogger.warn('CSRF token mismatch', {
        sessionID
      });
    }

    return isValid;
  }

  /**
   * Refresh CSRF token
   */
  async refreshToken(sessionID: string): Promise<string> {
    const key = this.prefix + sessionID;
    await this.kv.delete(key);
    return this.generateToken(sessionID);
  }

  /**
   * Revoke CSRF token
   */
  async revokeToken(sessionID: string): Promise<void> {
    const key = this.prefix + sessionID;
    await this.kv.delete(key);

    securityLogger.debug('CSRF token revoked from KV', {
      sessionID
    });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create CSRF protection
 */
export function createCSRFProtection(config?: CSRFConfig) {
  return new CSRFProtection(config);
}

/**
 * Create double submit cookie CSRF protection
 */
export function createDoubleSubmitCookieCSRF(
  cookieName?: string,
  headerName?: string,
  tokenLength?: number,
  maxAge?: number
) {
  return new DoubleSubmitCookieCSRF(cookieName, headerName, tokenLength, maxAge);
}

/**
 * Create synchronizer token CSRF protection
 */
export function createSynchronizerTokenCSRF(config?: CSRFConfig) {
  return new SynchronizerTokenCSRF(config);
}

/**
 * Create Cloudflare KV CSRF protection
 */
export function createCloudflareKVCSRFProtection(
  kv: KVNamespace,
  prefix?: string,
  tokenLength?: number,
  maxAge?: number
) {
  return new CloudflareKVCSRFProtection(kv, prefix, tokenLength, maxAge);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a random CSRF token
 */
export function generateCSRFToken(length: number = 32): string {
  return generateRandomString(length);
}

/**
 * Validate CSRF token format
 */
export function validateCSRFTokenFormat(token: string): boolean {
  // Basic format validation
  if (!token || typeof token !== 'string') {
    return false;
  }

  // Check length (should be reasonable)
  if (token.length < 16 || token.length > 256) {
    return false;
  }

  // Check for valid characters
  const validChars = /^[a-zA-Z0-9_-]+$/;
  return validChars.test(token);
}

/**
 * Extract CSRF token from various sources
 */
export function extractCSRFToken(request: Request): {
  header?: string;
  cookie?: string;
  body?: string;
  query?: string;
} {
  const result: {
    header?: string;
    cookie?: string;
    body?: string;
    query?: string;
  } = {};

  // Header
  result.header = request.headers.get('x-csrf-token') || undefined;

  // Cookie
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const csrfCookie = cookies.find(c => c.startsWith('csrf_token='));
    if (csrfCookie) {
      result.cookie = csrfCookie.split('=')[1];
    }
  }

  // Query parameter (less secure, not recommended)
  try {
    const url = new URL(request.url);
    result.query = url.searchParams.get('csrf_token') || undefined;
  } catch {
    // Invalid URL
  }

  return result;
}
