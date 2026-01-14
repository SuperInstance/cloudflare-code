/**
 * Content Security Policy (CSP) Headers Module
 * Comprehensive CSP implementation for preventing XSS and data injection attacks
 */

import type { CSPConfig, CSPDirectives } from '../types';
import { securityLogger } from '../utils/logger';

// ============================================================================
// CSP Builder
// ============================================================================

export class CSPBuilder {
  private directives: CSPDirectives = {};

  constructor(directives: CSPDirectives = {}) {
    this.directives = directives;
  }

  /**
   * Add default-src directive
   */
  defaultSrc(sources: string[]): this {
    this.directives['default-src'] = sources;
    return this;
  }

  /**
   * Add script-src directive
   */
  scriptSrc(sources: string[]): this {
    this.directives['script-src'] = sources;
    return this;
  }

  /**
   * Add style-src directive
   */
  styleSrc(sources: string[]): this {
    this.directives['style-src'] = sources;
    return this;
  }

  /**
   * Add img-src directive
   */
  imgSrc(sources: string[]): this {
    this.directives['img-src'] = sources;
    return this;
  }

  /**
   * Add font-src directive
   */
  fontSrc(sources: string[]): this {
    this.directives['font-src'] = sources;
    return this;
  }

  /**
   * Add connect-src directive
   */
  connectSrc(sources: string[]): this {
    this.directives['connect-src'] = sources;
    return this;
  }

  /**
   * Add media-src directive
   */
  mediaSrc(sources: string[]): this {
    this.directives['media-src'] = sources;
    return this;
  }

  /**
   * Add object-src directive
   */
  objectSrc(sources: string[]): this {
    this.directives['object-src'] = sources;
    return this;
  }

  /**
   * Add frame-src directive
   */
  frameSrc(sources: string[]): this {
    this.directives['frame-src'] = sources;
    return this;
  }

  /**
   * Add base-uri directive
   */
  baseUri(sources: string[]): this {
    this.directives['base-uri'] = sources;
    return this;
  }

  /**
   * Add form-action directive
   */
  formAction(sources: string[]): this {
    this.directives['form-action'] = sources;
    return this;
  }

  /**
   * Add frame-ancestors directive
   */
  frameAncestors(sources: string[]): this {
    this.directives['frame-ancestors'] = sources;
    return this;
  }

  /**
   * Add report-uri directive
   */
  reportUri(uri: string): this {
    this.directives['report-uri'] = uri;
    return this;
  }

  /**
   * Add report-to directive
   */
  reportTo(group: string): this {
    this.directives['report-to'] = group;
    return this;
  }

  /**
   * Enable upgrade-insecure-requests
   */
  upgradeInsecureRequests(): this {
    this.directives['upgrade-insecure-requests'] = true;
    return this;
  }

  /**
   * Enable block-all-mixed-content
   */
  blockAllMixedContent(): this {
    this.directives['block-all-mixed-content'] = true;
    return this;
  }

  /**
   * Build CSP string
   */
  build(): string {
    const parts: string[] = [];

    for (const [directive, value] of Object.entries(this.directives)) {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          parts.push(`${directive} ${value.join(' ')}`);
        }
      } else if (typeof value === 'boolean' && value) {
        parts.push(directive);
      } else if (typeof value === 'string') {
        parts.push(`${directive} ${value}`);
      }
    }

    return parts.join('; ');
  }

  /**
   * Get directives
   */
  getDirectives(): CSPDirectives {
    return { ...this.directives };
  }

  /**
   * Reset builder
   */
  reset(): this {
    this.directives = {};
    return this;
  }
}

// ============================================================================
// CSP Presets
// ============================================================================

export class CSPPresets {
  /**
   * Strict CSP - maximum security
   */
  static strict(): CSPDirectives {
    return {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': true,
      'block-all-mixed-content': true
    };
  }

  /**
   * Moderate CSP - balanced security and functionality
   */
  static moderate(): CSPDirectives {
    return {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:', 'http:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'", 'https:'],
      'media-src': ["'self'", 'https:'],
      'object-src': ["'none'"],
      'frame-src': ["'self'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'self'"],
      'upgrade-insecure-requests': true
    };
  }

  /**
   * Permissive CSP - for development
   */
  static permissive(): CSPDirectives {
    return {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'http:', 'https:'],
      'style-src': ["'self'", "'unsafe-inline'", 'http:', 'https:'],
      'img-src': ["'self'", 'data:', 'http:', 'https:'],
      'font-src': ["'self'", 'data:', 'http:', 'https:'],
      'connect-src': ["'self'", 'http:', 'https:'],
      'media-src': ["'self'", 'http:', 'https:'],
      'object-src': ["'none'"],
      'frame-src': ["'self'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"]
    };
  }

  /**
   * CSP for SPA (Single Page Application)
   */
  static spa(apiDomain: string): CSPDirectives {
    return {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self>", 'data:', 'https:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'", apiDomain],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': true
    };
  }

  /**
   * CSP for API-only responses
   */
  static apiOnly(): CSPDirectives {
    return {
      'default-src': ["'none'"],
      'script-src': ["'none'"],
      'style-src': ["'none'"],
      'img-src': ["'none'"],
      'font-src': ["'none'"],
      'connect-src': ["'none'"],
      'media-src': ["'none'"],
      'object-src': ["'none'"],
      'frame-src': ["'none'"],
      'base-uri': ["'none'"],
      'form-action': ["'none'"],
      'frame-ancestors': ["'none'"]
    };
  }

  /**
   * CSP for web workers
   */
  static webWorker(domain: string): CSPDirectives {
    return {
      'default-src': ["'self'"],
      'script-src': ["'self'", 'blob:'],
      'worker-src': ["'self'", 'blob:'],
      'connect-src': ["'self'", domain],
      'object-src': ["'none'"],
      'frame-src': ["'none'"],
      'base-uri': ["'self'"],
      'frame-ancestors': ["'none'"]
    };
  }

  /**
   * CSP with reporting
   */
  static withReporting(directives: CSPDirectives, reportUri: string): CSPDirectives {
    return {
      ...directives,
      'report-uri': reportUri
    };
  }

  /**
   * CSP for Cloudflare Workers
   */
  static cloudflareWorker(): CSPDirectives {
    return {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'", 'https:'],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': true
    };
  }
}

// ============================================================================
// CSP Middleware
// ============================================================================

export class CSPMiddleware {
  private config: CSPConfig;
  private reportOnly: boolean;

  constructor(config: CSPConfig) {
    this.config = config;
    this.reportOnly = config.reportOnly || false;
  }

  /**
   * Generate CSP header name
   */
  private getHeaderName(): string {
    return this.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
  }

  /**
   * Build CSP string from directives
   */
  private buildCSP(): string {
    const parts: string[] = [];

    for (const [directive, value] of Object.entries(this.config.directives)) {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          parts.push(`${directive} ${value.join(' ')}`);
        }
      } else if (typeof value === 'boolean' && value) {
        parts.push(directive);
      } else if (typeof value === 'string') {
        parts.push(`${directive} ${value}`);
      }
    }

    return parts.join('; ');
  }

  /**
   * Get CSP header
   */
  getHeader(): { name: string; value: string } {
    return {
      name: this.getHeaderName(),
      value: this.buildCSP()
    };
  }

  /**
   * Get CSP header value
   */
  getHeaderValue(): string {
    return this.buildCSP();
  }

  /**
   * Set CSP header on response
   */
  setHeader(response: Response): Response {
    const header = this.getHeader();
    const newHeaders = new Headers(response.headers);
    newHeaders.set(header.name, header.value);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
}

// ============================================================================
// CSP Violation Reporter
// ============================================================================

export interface CSPViolationReport {
  'csp-report': {
    'document-uri': string;
    'referrer': string;
    'violated-directive': string;
    'effective-directive': string;
    'original-policy': string;
    'disposition': string;
    'blocked-uri': string;
    'line-number': number;
    'column-number': number;
    'source-file': string;
    'status-code': number;
    'script-sample'?: string;
  };
}

export class CSPViolationReporter {
  private reportEndpoint: string;
  private kv: KVNamespace | null;

  constructor(reportEndpoint: string, kv?: KVNamespace) {
    this.reportEndpoint = reportEndpoint;
    this.kv = kv || null;
  }

  /**
   * Handle CSP violation report
   */
  async handleReport(report: CSPViolationReport): Promise<void> {
    const violation = report['csp-report'];

    securityLogger.warn('CSP violation detected', {
      documentUri: violation['document-uri'],
      violatedDirective: violation['violated-directive'],
      blockedUri: violation['blocked-uri'],
      sourceFile: violation['source-file']
    });

    // Store report in KV if available
    if (this.kv) {
      const reportId = `csp-violation-${Date.now()}-${Math.random()}`;
      await this.kv.put(reportId, JSON.stringify(report), {
        expirationTtl: 30 * 24 * 60 * 60 // 30 days
      });
    }

    // Forward to report endpoint
    try {
      await fetch(this.reportEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(report)
      });
    } catch (error) {
      securityLogger.error('Failed to forward CSP report', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get violation reports from KV
   */
  async getReports(limit: number = 100): Promise<CSPViolationReport[]> {
    if (!this.kv) {
      return [];
    }

    const reports: CSPViolationReport[] = [];
    const keys = await this.kv.list({ limit });

    for (const key of keys.keys) {
      const report = await this.kv.get(key.name, 'json');
      if (report) {
        reports.push(report as CSPViolationReport);
      }
    }

    return reports;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create CSP builder
 */
export function createCSPBuilder(directives?: CSPDirectives): CSPBuilder {
  return new CSPBuilder(directives);
}

/**
 * Create CSP middleware
 */
export function createCSPMiddleware(config: CSPConfig): CSPMiddleware {
  return new CSPMiddleware(config);
}

/**
 * Create CSP violation reporter
 */
export function createCSPViolationReporter(
  reportEndpoint: string,
  kv?: KVNamespace
): CSPViolationReporter {
  return new CSPViolationReporter(reportEndpoint, kv);
}

/**
 * Get CSP preset
 */
export function getCSPPreset(
  preset: 'strict' | 'moderate' | 'permissive' | 'spa' | 'apiOnly' | 'webWorker' | 'cloudflareWorker',
  options?: { apiDomain?: string }
): CSPDirectives {
  switch (preset) {
    case 'strict':
      return CSPPresets.strict();
    case 'moderate':
      return CSPPresets.moderate();
    case 'permissive':
      return CSPPresets.permissive();
    case 'spa':
      return CSPPresets.spa(options?.apiDomain || '');
    case 'apiOnly':
      return CSPPresets.apiOnly();
    case 'webWorker':
      return CSPPresets.webWorker(options?.apiDomain || '');
    case 'cloudflareWorker':
      return CSPPresets.cloudflareWorker();
    default:
      return CSPPresets.moderate();
  }
}

/**
 * Build CSP string from directives
 */
export function buildCSPString(directives: CSPDirectives): string {
  const parts: string[] = [];

  for (const [directive, value] of Object.entries(directives)) {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        parts.push(`${directive} ${value.join(' ')}`);
      }
    } else if (typeof value === 'boolean' && value) {
      parts.push(directive);
    } else if (typeof value === 'string') {
      parts.push(`${directive} ${value}`);
    }
  }

  return parts.join('; ');
}

/**
 * Validate CSP directives
 */
export function validateCSPDirectives(directives: CSPDirectives): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const validDirectives = [
    'default-src', 'script-src', 'style-src', 'img-src', 'font-src',
    'connect-src', 'media-src', 'object-src', 'frame-src', 'base-uri',
    'form-action', 'frame-ancestors', 'report-uri', 'report-to',
    'upgrade-insecure-requests', 'block-all-mixed-content', 'plugin-types',
    'require-trusted-types-for', 'trusted-types', 'sandbox',
    'disown-opener', 'manifest-src', 'worker-src', 'prefetch-src',
    'navigate-to', 'child-src', 'form-action', 'frame-src'
  ];

  for (const directive of Object.keys(directives)) {
    if (!validDirectives.includes(directive)) {
      errors.push(`Invalid CSP directive: ${directive}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Parse CSP string into directives
 */
export function parseCSPString(cspString: string): CSPDirectives {
  const directives: CSPDirectives = {};
  const parts = cspString.split(';').map(p => p.trim());

  for (const part of parts) {
    if (!part) continue;

    const [directive, ...sources] = part.split(/\s+/);
    if (directive && sources.length > 0) {
      directives[directive] = sources;
    } else if (directive) {
      directives[directive] = true;
    }
  }

  return directives;
}

/**
 * Merge CSP directives
 */
export function mergeCSPDirectives(
  ...directivesArray: CSPDirectives[]
): CSPDirectives {
  const merged: CSPDirectives = {};

  for (const directives of directivesArray) {
    for (const [directive, value] of Object.entries(directives)) {
      merged[directive] = value;
    }
  }

  return merged;
}
