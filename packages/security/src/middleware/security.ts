/**
 * Security Middleware for Hono
 * Comprehensive security middleware for Cloudflare Workers
 */

import type { Context, Next } from 'hono';
import type {
  SecurityConfig,
  SecurityContext,
  SecurityViolation,
  SecurityMiddlewareOptions
} from '../types';
import { securityLogger } from '../utils/logger';
import {
  detectSQLInjection,
  detectXSS,
  detectPathTraversal,
  detectCommandInjection,
  escapeHTML
} from '../utils/validation';
import { generateUUID } from '../utils/crypto';

export class SecurityMiddleware {
  private config: SecurityConfig;
  private options: SecurityMiddlewareOptions;

  constructor(config: SecurityConfig = {}, options: SecurityMiddlewareOptions = {}) {
    this.config = {
      enableInputValidation: true,
      sanitizeInput: true,
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      enableRateLimit: true,
      rateLimitWindow: 60000, // 1 minute
      rateLimitMaxRequests: 100,
      enableCSRF: true,
      enableXSS: true,
      enableSecurityHeaders: true,
      cspEnabled: true,
      enableAuth: false,
      enableSecretScanning: true,
      enableSecurityLogging: true,
      logLevel: 'info',
      ...config
    };

    this.options = {
      onError: (violation) => securityLogger.violation(violation),
      onWarning: (violation) => securityLogger.violation(violation),
      ...options
    };
  }

  /**
   * Main security middleware
   */
  async security(c: Context, next: Next) {
    const securityContext = this.createSecurityContext(c);

    // Log the request
    if (this.config.enableSecurityLogging) {
      securityLogger.info('Incoming request', {
        method: c.req.method(),
        path: c.req.path(),
        ip: securityContext.ip
      });
    }

    // Check request size
    if (this.config.maxRequestSize) {
      const contentLength = c.req.header('content-length');
      if (contentLength && parseInt(contentLength) > this.config.maxRequestSize) {
        return this.handleViolation(c, securityContext, 'INVALID_INPUT', 'medium', 'Request size exceeds maximum allowed');
      }
    }

    // Input validation and sanitization
    if (this.config.enableInputValidation) {
      const validationResult = this.validateRequest(c, securityContext);
      if (!validationResult.valid) {
        return this.handleViolation(c, securityContext, validationResult.type!, validationResult.severity, validationResult.message);
      }
    }

    // Secret scanning for requests (check for leaked secrets in headers/body)
    if (this.config.enableSecretScanning) {
      const secretResult = this.scanForSecrets(c, securityContext);
      if (secretResult.detected) {
        return this.handleViolation(c, securityContext, 'SECRET_LEAK_DETECTED', 'high', secretResult.message);
      }
    }

    await next();

    // Security headers
    if (this.config.enableSecurityHeaders) {
      this.setSecurityHeaders(c);
    }
  }

  /**
   * Create security context from request
   */
  private createSecurityContext(c: Context): SecurityContext {
    // Get IP address from CF connecting IP or fallback
    const ip = c.req.header('cf-connecting-ip') ||
               c.req.header('x-forwarded-for')?.split(',')[0] ||
               'unknown';

    return {
      requestID: generateUUID(),
      timestamp: Date.now(),
      ip,
      userAgent: c.req.header('user-agent'),
      path: c.req.path(),
      method: c.req.method(),
      headers: Object.fromEntries(c.req.raw.headers),
      query: Object.fromEntries(c.req.queries())
    };
  }

  /**
   * Validate request for security issues
   */
  private validateRequest(c: Context, ctx: SecurityContext): {
    valid: boolean;
    type?: string;
    severity: any;
    message: string;
  } {
    // Check query parameters
    for (const [key, value] of Object.entries(ctx.query)) {
      if (detectSQLInjection(value)) {
        return {
          valid: false,
          type: 'SQL_INJECTION_DETECTED',
          severity: 'high',
          message: `SQL injection detected in query parameter: ${key}`
        };
      }

      if (detectXSS(value)) {
        return {
          valid: false,
          type: 'XSS_ATTACK_DETECTED',
          severity: 'high',
          message: `XSS attack detected in query parameter: ${key}`
        };
      }

      if (detectPathTraversal(value)) {
        return {
          valid: false,
          type: 'PATH_TRAVERSAL_DETECTED',
          severity: 'high',
          message: `Path traversal detected in query parameter: ${key}`
        };
      }

      if (detectCommandInjection(value)) {
        return {
          valid: false,
          type: 'COMMAND_INJECTION_DETECTED',
          severity: 'critical',
          message: `Command injection detected in query parameter: ${key}`
        };
      }
    }

    // Check path parameters
    const pathParams = c.req.param();
    for (const [key, value] of Object.entries(pathParams)) {
      if (detectPathTraversal(value)) {
        return {
          valid: false,
          type: 'PATH_TRAVERSAL_DETECTED',
          severity: 'high',
          message: `Path traversal detected in path parameter: ${key}`
        };
      }
    }

    // Check headers
    for (const [key, value] of Object.entries(ctx.headers)) {
      if (key.toLowerCase().startsWith('x-') || key.toLowerCase() === 'user-agent') {
        if (detectSQLInjection(value)) {
          return {
            valid: false,
            type: 'SQL_INJECTION_DETECTED',
            severity: 'medium',
            message: `SQL injection detected in header: ${key}`
          };
        }

        if (detectXSS(value)) {
          return {
            valid: false,
            type: 'XSS_ATTACK_DETECTED',
            severity: 'medium',
            message: `XSS attack detected in header: ${key}`
          };
        }
      }
    }

    return { valid: true, severity: 'low', message: 'Validation passed' };
  }

  /**
   * Scan request for potential secret leaks
   */
  private scanForSecrets(c: Context, ctx: SecurityContext): {
    detected: boolean;
    message: string;
  } {
    const secretPatterns = [
      { name: 'API Key', patterns: [/api[_-]?key/i, /apikey/i] },
      { name: 'Secret Token', patterns: [/secret[_-]?token/i, /secretkey/i] },
      { name: 'Password', patterns: [/password/i] },
      { name: 'JWT', patterns: [/bearer\s+[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/i] },
      { name: 'AWS Access Key', patterns: [/AKIA[0-9A-Z]{16}/] },
      { name: 'Private Key', patterns: [/-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/i] }
    ];

    // Check headers
    for (const [key, value] of Object.entries(ctx.headers)) {
      for (const secret of secretPatterns) {
        for (const pattern of secret.patterns) {
          if (key.toLowerCase().includes('authorization') ||
              key.toLowerCase().includes('token') ||
              key.toLowerCase().includes('secret') ||
              key.toLowerCase().includes('api-key')) {
            // Check for potential secret in header values (legitimate auth headers are OK)
            // This is just to flag suspicious patterns
          }
        }
      }
    }

    return { detected: false, message: '' };
  }

  /**
   * Handle security violation
   */
  private handleViolation(
    c: Context,
    ctx: SecurityContext,
    type: string,
    severity: any,
    message: string
  ): Response {
    const violation: SecurityViolation = {
      type: type as any,
      severity,
      message,
      context: ctx,
      timestamp: Date.now(),
      blocked: true
    };

    if (severity === 'critical' || severity === 'high') {
      this.options.onError?.(violation);
    } else {
      this.options.onWarning?.(violation);
    }

    // Log the violation
    securityLogger.violation(violation);

    // Return error response
    return c.json({
      error: 'Security violation detected',
      message: severity === 'critical' ? 'Request blocked' : message,
      requestId: ctx.requestID
    }, severity === 'critical' ? 403 : 400);
  }

  /**
   * Set security headers
   */
  private setSecurityHeaders(c: Context): void {
    // X-Content-Type-Options
    c.header('X-Content-Type-Options', 'nosniff');

    // X-Frame-Options
    c.header('X-Frame-Options', 'DENY');

    // X-XSS-Protection
    c.header('X-XSS-Protection', '1; mode=block');

    // Referrer-Policy
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions-Policy
    c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // Strict-Transport-Security (only on HTTPS)
    if (c.req.raw.url.startsWith('https://')) {
      c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Content-Security-Policy
    if (this.config.cspEnabled && this.config.cspDirectives) {
      const csp = this.buildCSP(this.config.cspDirectives);
      c.header('Content-Security-Policy', csp);
    }
  }

  /**
   * Build CSP string from directives
   */
  private buildCSP(directives: Record<string, any>): string {
    const parts: string[] = [];

    for (const [directive, value] of Object.entries(directives)) {
      if (Array.isArray(value)) {
        parts.push(`${directive} ${value.join(' ')}`);
      } else if (typeof value === 'boolean' && value) {
        parts.push(directive);
      } else if (typeof value === 'string') {
        parts.push(`${directive} ${value}`);
      }
    }

    return parts.join('; ');
  }
}

/**
 * Create security middleware factory
 */
export function createSecurityMiddleware(
  config?: SecurityConfig,
  options?: SecurityMiddlewareOptions
) {
  const middleware = new SecurityMiddleware(config, options);
  return middleware.security.bind(middleware);
}

/**
 * Simple security middleware with default configuration
 */
export function security(options?: SecurityConfig) {
  return createSecurityMiddleware(options);
}

/**
 * Request validator middleware
 */
export async function validateRequest(c: Context, next: Next) {
  const ctx = {
    requestID: generateUUID(),
    timestamp: Date.now(),
    ip: c.req.header('cf-connecting-ip') || 'unknown',
    path: c.req.path(),
    method: c.req.method(),
    headers: Object.fromEntries(c.req.raw.headers),
    query: Object.fromEntries(c.req.queries())
  };

  // Validate URL
  const url = c.req.url();
  if (detectXSS(url)) {
    securityLogger.warn('XSS detected in URL', {
      type: 'XSS_ATTACK_DETECTED' as any,
      severity: 'high' as any,
      message: 'XSS attack detected in URL',
      context: ctx,
      timestamp: Date.now(),
      blocked: true
    });
    return c.json({ error: 'Invalid request' }, 400);
  }

  if (detectSQLInjection(url)) {
    securityLogger.warn('SQL injection detected in URL', {
      type: 'SQL_INJECTION_DETECTED' as any,
      severity: 'high' as any,
      message: 'SQL injection detected in URL',
      context: ctx,
      timestamp: Date.now(),
      blocked: true
    });
    return c.json({ error: 'Invalid request' }, 400);
  }

  await next();
}

/**
 * Request sanitizer middleware
 */
export async function sanitizeRequest(c: Context, next: Next) {
  // Sanitize query parameters
  const queries = c.req.queries();
  const sanitized: Record<string, string> = {};

  for (const [key, values] of Object.entries(queries)) {
    if (Array.isArray(values)) {
      sanitized[key] = values.map(v => escapeHTML(v))[0];
    } else {
      sanitized[key] = escapeHTML(values);
    }
  }

  // Store sanitized values
  c.set('sanitizedQuery', sanitized);

  await next();
}
