/**
 * Security Types and Interfaces
 * Comprehensive type definitions for security features
 */

import type { Context, Next } from 'hono';

// ============================================================================
// Core Security Types
// ============================================================================

export interface SecurityConfig {
  // Input Validation
  enableInputValidation?: boolean;
  sanitizeInput?: boolean;
  maxRequestSize?: number;

  // Rate Limiting
  enableRateLimit?: boolean;
  rateLimitWindow?: number;
  rateLimitMaxRequests?: number;

  // CSRF Protection
  enableCSRF?: boolean;
  csrfTokenLength?: number;
  csrfExcludedPaths?: string[];

  // XSS Protection
  enableXSS?: boolean;
  xssWhitelist?: Record<string, string[]>;

  // Security Headers
  enableSecurityHeaders?: boolean;
  cspEnabled?: boolean;
  cspDirectives?: CSPDirectives;

  // Authentication
  enableAuth?: boolean;
  jwtSecret?: string;
  jwtExpiry?: string;

  // Secret Scanning
  enableSecretScanning?: boolean;
  secretPatterns?: SecretPattern[];

  // Logging
  enableSecurityLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// ============================================================================
// Security Context Types
// ============================================================================

export interface SecurityContext {
  requestID: string;
  timestamp: number;
  ip: string;
  userAgent?: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}

export interface SecurityViolation {
  type: ViolationType;
  severity: SeverityLevel;
  message: string;
  context: SecurityContext;
  timestamp: number;
  metadata?: Record<string, any>;
  blocked: boolean;
}

export type ViolationType =
  | 'RATE_LIMIT_EXCEEDED'
  | 'CSRF_TOKEN_INVALID'
  | 'CSRF_TOKEN_MISSING'
  | 'XSS_ATTACK_DETECTED'
  | 'SQL_INJECTION_DETECTED'
  | 'PATH_TRAVERSAL_DETECTED'
  | 'COMMAND_INJECTION_DETECTED'
  | 'INVALID_JWT'
  | 'MISSING_AUTH'
  | 'SECRET_LEAK_DETECTED'
  | 'INVALID_INPUT'
  | 'SUSPICIOUS_REQUEST'
  | 'DDOS_ATTACK';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (c: Context) => string | Promise<string>;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  handler?: (c: Context, next: Next) => Response | Promise<Response>;
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
}

// ============================================================================
// CSRF Types
// ============================================================================

export interface CSRFConfig {
  tokenLength?: number;
  secretLength?: number;
  saltLength?: number;
  excludedPaths?: string[];
  tokenGenerator?: () => string;
  tokenValidator?: (token: string, secret: string) => boolean;
}

export interface CSRFTokenInfo {
  token: string;
  secret: string;
  expiresAt: number;
}

// ============================================================================
// XSS Protection Types
// ============================================================================

export interface XSSConfig {
  whitelist?: Record<string, string[]>;
  stripIgnoreTag?: boolean;
  stripIgnoreTagBody?: boolean;
  css?: boolean;
  escapeHtml?: boolean;
}

export interface XSSRule {
  tagName: string;
  attributes?: string[];
  cssFilter?: (css: string) => boolean;
}

// ============================================================================
// Input Validation Types
// ============================================================================

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'uuid' | 'date';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | Promise<boolean>;
  errorMessage?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  sanitized?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// ============================================================================
// Secret Scanning Types
// ============================================================================

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  description: string;
  severity: SeverityLevel;
  examples?: string[];
}

export interface SecretMatch {
  patternName: string;
  match: string;
  line: number;
  column: number;
  file: string;
  severity: SeverityLevel;
  context?: string;
}

export interface SecretScanResult {
  file: string;
  matches: SecretMatch[];
  scannedAt: number;
}

// ============================================================================
// Dependency Scanning Types
// ============================================================================

export interface DependencyVulnerability {
  packageName: string;
  version: string;
  severity: SeverityLevel;
  title: string;
  description: string;
  cve?: string;
  cvss?: number;
  patchedIn?: string[];
  recommendation: string;
  references?: string[];
}

export interface DependencyScanResult {
  packageName: string;
  version: string;
  vulnerabilities: DependencyVulnerability[];
  scanTime: number;
}

export interface AuditReport {
  scanned: number;
  vulnerable: number;
  dependencies: DependencyScanResult[];
  scanTime: number;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// ============================================================================
// CSP Types
// ============================================================================

export interface CSPDirectives {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'font-src'?: string[];
  'connect-src'?: string[];
  'media-src'?: string[];
  'object-src'?: string[];
  'frame-src'?: string[];
  'base-uri'?: string[];
  'form-action'?: string[];
  'frame-ancestors'?: string[];
  'report-uri'?: string;
  'report-to'?: string;
  'upgrade-insecure-requests'?: boolean;
  'block-all-mixed-content'?: boolean;
}

export interface CSPConfig {
  directives: CSPDirectives;
  reportOnly?: boolean;
  reportURI?: string;
}

// ============================================================================
// Security Headers Types
// ============================================================================

export interface SecurityHeadersConfig {
  'Strict-Transport-Security'?: {
    maxAge: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  'X-Frame-Options'?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM' | string;
  'X-Content-Type-Options'?: 'nosniff';
  'X-XSS-Protection'?: string;
  'Referrer-Policy'?: string;
  'Permissions-Policy'?: Record<string, string[]>;
  'Cross-Origin-Opener-Policy'?: string;
  'Cross-Origin-Resource-Policy'?: string;
  'Cross-Origin-Embedder-Policy'?: string;
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiry?: string;
  jwtAlgorithm?: string;
  tokenExtractor?: (c: Context) => string | null;
  skipPaths?: string[];
  refreshThreshold?: number;
}

export interface JWTPayload {
  sub: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
  [key: string]: any;
}

export interface AuthResult {
  authenticated: boolean;
  payload?: JWTPayload;
  error?: string;
}

// ============================================================================
// Encryption Types
// ============================================================================

export interface EncryptionConfig {
  algorithm?: 'AES-256-GCM' | 'AES-256-CBC';
  keyLength?: number;
  ivLength?: number;
  authTagLength?: number;
}

export interface EncryptedData {
  data: string;
  iv: string;
  authTag?: string;
  algorithm: string;
}

// ============================================================================
// Security Event Types
// ============================================================================

export interface SecurityEvent {
  id: string;
  type: ViolationType;
  severity: SeverityLevel;
  timestamp: number;
  context: SecurityContext;
  metadata?: Record<string, any>;
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface SecurityReport {
  period: {
    start: number;
    end: number;
  };
  summary: {
    totalEvents: number;
    bySeverity: Record<SeverityLevel, number>;
    byType: Record<ViolationType, number>;
    blockedRequests: number;
  };
  events: SecurityEvent[];
  recommendations: string[];
}

// ============================================================================
// DDoS Protection Types
// ============================================================================

export interface DDoSConfig {
  enabled: boolean;
  threshold: number;
  windowMs: number;
  blacklistDuration: number;
  whitelist: string[];
  blacklist: string[];
  mitigationLevel: 'low' | 'medium' | 'high';
}

export interface DDoSMetrics {
  requestsPerSecond: number;
  uniqueIPs: number;
  averageResponseTime: number;
  errorRate: number;
  blacklistedIPs: number;
}

// ============================================================================
// Middleware Types
// ============================================================================

export interface SecurityMiddlewareOptions {
  config: SecurityConfig;
  onError?: (violation: SecurityViolation) => void;
  onWarning?: (violation: SecurityViolation) => void;
}

export type SecurityMiddleware = (c: Context, next: Next) => Promise<void | Response>;
