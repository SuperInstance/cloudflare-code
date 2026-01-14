/**
 * Security Headers Module
 * Comprehensive security headers for HTTP responses
 */

import type { SecurityHeadersConfig } from '../types';
import { securityLogger } from '../utils/logger';

// ============================================================================
// Security Headers Builder
// ============================================================================

export class SecurityHeadersBuilder {
  private headers: Map<string, string> = new Map();

  constructor() {
    // Initialize with default headers
    this.setDefaults();
  }

  /**
   * Set default security headers
   */
  private setDefaults(): void {
    this.setXContentTypeOptions('nosniff');
    this.setXFrameOptions('DENY');
    this.setXXSSProtection('1; mode=block');
    this.setReferrerPolicy('strict-origin-when-cross-origin');
    this.setPermissionsPolicy({
      geolocation: [],
      microphone: [],
      camera: []
    });
  }

  /**
   * Set Strict-Transport-Security header
   */
  setStrictTransportSecurity(options: {
    maxAge: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  }): this {
    const directives = [`max-age=${options.maxAge}`];

    if (options.includeSubDomains) {
      directives.push('includeSubDomains');
    }

    if (options.preload) {
      directives.push('preload');
    }

    this.headers.set('Strict-Transport-Security', directives.join('; '));
    return this;
  }

  /**
   * Set X-Frame-Options header
   */
  setXFrameOptions(option: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM' | string): this {
    this.headers.set('X-Frame-Options', option);
    return this;
  }

  /**
   * Set X-Content-Type-Options header
   */
  setXContentTypeOptions(option: 'nosniff'): this {
    this.headers.set('X-Content-Type-Options', option);
    return this;
  }

  /**
   * Set X-XSS-Protection header
   */
  setXXSSProtection(value: string): this {
    this.headers.set('X-XSS-Protection', value);
    return this;
  }

  /**
   * Set Referrer-Policy header
   */
  setReferrerPolicy(policy: string): this {
    const validPolicies = [
      'no-referrer',
      'no-referrer-when-downgrade',
      'origin',
      'origin-when-cross-origin',
      'same-origin',
      'strict-origin',
      'strict-origin-when-cross-origin',
      'unsafe-url'
    ];

    if (validPolicies.includes(policy)) {
      this.headers.set('Referrer-Policy', policy);
    } else {
      securityLogger.warn(`Invalid Referrer-Policy: ${policy}`);
    }

    return this;
  }

  /**
   * Set Permissions-Policy header
   */
  setPermissionsPolicy(features: Record<string, string[]>): this {
    const policies: string[] = [];

    for (const [feature, origins] of Object.entries(features)) {
      const originsList = origins.length > 0 ? origins.join(' ') : "'none'";
      policies.push(`${feature}=(${originsList})`);
    }

    this.headers.set('Permissions-Policy', policies.join(', '));
    return this;
  }

  /**
   * Set Cross-Origin-Opener-Policy header
   */
  setCrossOriginOpenerPolicy(policy: 'unsafe-none' | 'same-origin' | 'same-origin-allow-popups'): this {
    this.headers.set('Cross-Origin-Opener-Policy', policy);
    return this;
  }

  /**
   * Set Cross-Origin-Resource-Policy header
   */
  setCrossOriginResourcePolicy(policy: 'same-site' | 'same-origin' | 'cross-origin'): this {
    this.headers.set('Cross-Origin-Resource-Policy', policy);
    return this;
  }

  /**
   * Set Cross-Origin-Embedder-Policy header
   */
  setCrossOriginEmbedderPolicy(policy: 'unsafe-none' | 'require-corp'): this {
    this.headers.set('Cross-Origin-Embedder-Policy', policy);
    return this;
  }

  /**
   * Set Content-Security-Policy header
   */
  setContentSecurityPolicy(csp: string): this {
    this.headers.set('Content-Security-Policy', csp);
    return this;
  }

  /**
   * Set custom header
   */
  setHeader(name: string, value: string): this {
    this.headers.set(name, value);
    return this;
  }

  /**
   * Remove header
   */
  removeHeader(name: string): this {
    this.headers.delete(name);
    return this;
  }

  /**
   * Build headers object
   */
  build(): Record<string, string> {
    return Object.fromEntries(this.headers);
  }

  /**
   * Get headers as Map
   */
  getHeaders(): Map<string, string> {
    return new Map(this.headers);
  }

  /**
   * Clear all headers
   */
  clear(): this {
    this.headers.clear();
    return this;
  }

  /**
   * Reset to defaults
   */
  reset(): this {
    this.clear();
    this.setDefaults();
    return this;
  }
}

// ============================================================================
// Security Headers Presets
// ============================================================================

export class SecurityHeadersPresets {
  /**
   * Strict security headers
   */
  static strict(): Record<string, string> {
    return {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'geolocation=(self), microphone=(), camera=(), payment=()',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    };
  }

  /**
   * Moderate security headers
   */
  static moderate(): Record<string, string> {
    return {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(self), microphone=(self), camera=(self)',
      'Cross-Origin-Opener-Policy': 'unsafe-none',
      'Cross-Origin-Resource-Policy': 'same-site',
      'Cross-Origin-Embedder-Policy': 'unsafe-none'
    };
  }

  /**
   * Permissive security headers (for development)
   */
  static permissive(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
  }

  /**
   * Security headers for API responses
   */
  static api(): Record<string, string> {
    return {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      'Cross-Origin-Resource-Policy': 'same-origin'
    };
  }

  /**
   * Security headers for Cloudflare Workers
   */
  static cloudflareWorker(): Record<string, string> {
    return {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(self), microphone=(), camera=()',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin'
    };
  }
}

// ============================================================================
// Security Headers Middleware
// ============================================================================

export class SecurityHeadersMiddleware {
  private config: SecurityHeadersConfig;
  private headers: Record<string, string>;

  constructor(config: SecurityHeadersConfig = {}) {
    this.config = config;
    this.headers = this.buildHeaders();
  }

  /**
   * Build security headers from config
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    // Strict-Transport-Security
    if (this.config['Strict-Transport-Security']) {
      const hsts = this.config['Strict-Transport-Security'];
      const directives = [`max-age=${hsts.maxAge}`];

      if (hsts.includeSubDomains) {
        directives.push('includeSubDomains');
      }

      if (hsts.preload) {
        directives.push('preload');
      }

      headers['Strict-Transport-Security'] = directives.join('; ');
    }

    // X-Frame-Options
    if (this.config['X-Frame-Options']) {
      headers['X-Frame-Options'] = this.config['X-Frame-Options'];
    }

    // X-Content-Type-Options
    if (this.config['X-Content-Type-Options']) {
      headers['X-Content-Type-Options'] = this.config['X-Content-Type-Options'];
    }

    // X-XSS-Protection
    if (this.config['X-XSS-Protection']) {
      headers['X-XSS-Protection'] = this.config['X-XSS-Protection'];
    }

    // Referrer-Policy
    if (this.config['Referrer-Policy']) {
      headers['Referrer-Policy'] = this.config['Referrer-Policy'];
    }

    // Permissions-Policy
    if (this.config['Permissions-Policy']) {
      const policies: string[] = [];

      for (const [feature, origins] of Object.entries(this.config['Permissions-Policy'])) {
        const originsList = origins.length > 0 ? origins.join(' ') : "'none'";
        policies.push(`${feature}=(${originsList})`);
      }

      headers['Permissions-Policy'] = policies.join(', ');
    }

    // Cross-Origin-Opener-Policy
    if (this.config['Cross-Origin-Opener-Policy']) {
      headers['Cross-Origin-Opener-Policy'] = this.config['Cross-Origin-Opener-Policy'];
    }

    // Cross-Origin-Resource-Policy
    if (this.config['Cross-Origin-Resource-Policy']) {
      headers['Cross-Origin-Resource-Policy'] = this.config['Cross-Origin-Resource-Policy'];
    }

    // Cross-Origin-Embedder-Policy
    if (this.config['Cross-Origin-Embedder-Policy']) {
      headers['Cross-Origin-Embedder-Policy'] = this.config['Cross-Origin-Embedder-Policy'];
    }

    return headers;
  }

  /**
   * Get headers
   */
  getHeaders(): Record<string, string> {
    return { ...this.headers };
  }

  /**
   * Apply headers to response
   */
  applyToResponse(response: Response): Response {
    const newHeaders = new Headers(response.headers);

    for (const [name, value] of Object.entries(this.headers)) {
      newHeaders.set(name, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }

  /**
   * Add custom header
   */
  addHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  /**
   * Remove header
   */
  removeHeader(name: string): void {
    delete this.headers[name];
  }
}

// ============================================================================
// Header Validation
// ============================================================================

export function validateSecurityHeaders(headers: Record<string, string>): {
  valid: boolean;
  warnings: string[];
  recommendations: string[];
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check HSTS
  if (!headers['Strict-Transport-Security']) {
    recommendations.push('Add Strict-Transport-Security header for HTTPS enforcement');
  } else {
    const hsts = headers['Strict-Transport-Security'];
    if (!hsts.includes('max-age=') || !hsts.includes('includeSubDomains')) {
      warnings.push('Strict-Transport-Security should include max-age and includeSubDomains');
    }
  }

  // Check X-Frame-Options
  if (!headers['X-Frame-Options']) {
    recommendations.push('Add X-Frame-Options header to prevent clickjacking');
  }

  // Check X-Content-Type-Options
  if (!headers['X-Content-Type-Options']) {
    recommendations.push('Add X-Content-Type-Options header to prevent MIME sniffing');
  }

  // Check X-XSS-Protection
  if (!headers['X-XSS-Protection']) {
    recommendations.push('Add X-XSS-Protection header for XSS filtering');
  }

  // Check Referrer-Policy
  if (!headers['Referrer-Policy']) {
    recommendations.push('Add Referrer-Policy header to control referrer information');
  }

  // Check Permissions-Policy
  if (!headers['Permissions-Policy']) {
    recommendations.push('Add Permissions-Policy header to control browser features');
  }

  // Check CSP
  if (!headers['Content-Security-Policy']) {
    recommendations.push('Add Content-Security-Policy header to prevent XSS attacks');
  }

  // Check Cross-Origin headers
  if (!headers['Cross-Origin-Resource-Policy']) {
    recommendations.push('Add Cross-Origin-Resource-Policy header for CORS protection');
  }

  return {
    valid: warnings.length === 0,
    warnings,
    recommendations
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create security headers builder
 */
export function createSecurityHeadersBuilder(): SecurityHeadersBuilder {
  return new SecurityHeadersBuilder();
}

/**
 * Create security headers middleware
 */
export function createSecurityHeadersMiddleware(config?: SecurityHeadersConfig): SecurityHeadersMiddleware {
  return new SecurityHeadersMiddleware(config);
}

/**
 * Get security headers preset
 */
export function getSecurityHeadersPreset(
  preset: 'strict' | 'moderate' | 'permissive' | 'api' | 'cloudflareWorker'
): Record<string, string> {
  switch (preset) {
    case 'strict':
      return SecurityHeadersPresets.strict();
    case 'moderate':
      return SecurityHeadersPresets.moderate();
    case 'permissive':
      return SecurityHeadersPresets.permissive();
    case 'api':
      return SecurityHeadersPresets.api();
    case 'cloudflareWorker':
      return SecurityHeadersPresets.cloudflareWorker();
    default:
      return SecurityHeadersPresets.moderate();
  }
}

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(
  response: Response,
  headers: Record<string, string>
): Response {
  const newHeaders = new Headers(response.headers);

  for (const [name, value] of Object.entries(headers)) {
    newHeaders.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

/**
 * Apply preset security headers
 */
export function applySecurityHeadersPreset(
  response: Response,
  preset: 'strict' | 'moderate' | 'permissive' | 'api' | 'cloudflareWorker'
): Response {
  const headers = getSecurityHeadersPreset(preset);
  return applySecurityHeaders(response, headers);
}

/**
 * Merge security headers
 */
export function mergeSecurityHeaders(
  ...headersArray: Record<string, string>[]
): Record<string, string> {
  return Object.assign({}, ...headersArray);
}

/**
 * Remove security headers
 */
export function removeSecurityHeaders(
  response: Response,
  headersToRemove: string[]
): Response {
  const newHeaders = new Headers(response.headers);

  for (const header of headersToRemove) {
    newHeaders.delete(header);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

/**
 * Get security score for headers
 */
export function getSecurityScore(headers: Record<string, string>): {
  score: number;
  maxScore: number;
  percentage: number;
  missingHeaders: string[];
} {
  const requiredHeaders = [
    'Strict-Transport-Security',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'X-XSS-Protection',
    'Referrer-Policy',
    'Permissions-Policy',
    'Content-Security-Policy',
    'Cross-Origin-Resource-Policy'
  ];

  const missingHeaders: string[] = [];
  let presentCount = 0;

  for (const header of requiredHeaders) {
    if (headers[header]) {
      presentCount++;
    } else {
      missingHeaders.push(header);
    }
  }

  const maxScore = requiredHeaders.length;
  const score = presentCount;
  const percentage = (score / maxScore) * 100;

  return {
    score,
    maxScore,
    percentage: Math.round(percentage),
    missingHeaders
  };
}
