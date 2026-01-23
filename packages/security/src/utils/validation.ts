/**
 * Input Validation Utilities
 * Comprehensive validation for preventing common vulnerabilities
 */

import validator from 'validator';
import type { ValidationResult, ValidationError, ValidationRule } from '../types';

// ============================================================================
// SQL Injection Detection
// ============================================================================

const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE|UNION|INTERSECT|EXCEPT)\b)/i,
  /(;(\s+)?(SELECT|INSERT|UPDATE|DELETE|DROP|EXEC))/i,
  /(--)|(#)|(\/\*\*\/)/,
  /(\bor\b|\band\b).*?=/i,
  /('.*?(\bor\b|\band\b).*?')/i,
  /(\bxp_cmdshell\b)|(\bsp_executesql\b)/i,
  /(\bWAITFOR\b.*?\bDELAY\b)/i,
  /;\s*(?:EXEC|EXECUTE)\s/i,
  /(?:')|(?:--)|(\/\*)|(\*\/)|(\bOR\b)|(\bAND\b).*?=/i,
  /(\bunion\b.*?\bselect\b)/i,
  /(\b1\s*=\s*1\b)|(\b1\s*!=\s*0\b)/i
];

/**
 * Detect potential SQL injection in input
 */
export function detectSQLInjection(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  // Check against SQL injection patterns
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
}

/**
 * Sanitize input to prevent SQL injection
 */
export function sanitizeSQL(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }

  return input
    .replace(/'/g, "''")
    .replace(/;/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');
}

// ============================================================================
// XSS Detection and Prevention
// ============================================================================

const XSS_PATTERNS = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // Event handlers like onclick, onerror
  /<img[^>]+src[^>]*>/gi,
  /<object\b[^>]*>[\s\S]*?<\/object>/gi,
  /<embed\b[^>]*>/gi,
  /<link\b[^>]*>/gi,
  /<meta\b[^>]*>/gi,
  /<style\b[^>]*>[\s\S]*?<\/style>/gi,
  /<[^>]+>/g // All HTML tags (sanitized)
];

/**
 * Detect potential XSS in input
 */
export function detectXSS(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  // Check against XSS patterns
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  // Check for data URLs with JavaScript
  if (input.toLowerCase().includes('data:text/html')) {
    return true;
  }

  return false;
}

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHTML(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }

  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };

  return input.replace(/[&<>"'/`=]/g, char => escapeMap[char]);
}

/**
 * Sanitize HTML to remove dangerous tags and attributes
 */
export function sanitizeHTML(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }

  // Remove script tags and their content
  let sanitized = input.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  // Remove iframe tags
  sanitized = sanitized.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');

  // Remove object tags
  sanitized = sanitized.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '');

  // Remove embed tags
  sanitized = sanitized.replace(/<embed\b[^>]*>/gi, '');

  // Remove style tags
  sanitized = sanitized.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove event handlers from remaining tags
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove data: URLs that could execute code
  sanitized = sanitized.replace(/data:text\/html[^,]*/gi, '');

  return sanitized;
}

// ============================================================================
// Path Traversal Detection
// ============================================================================

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.\\/,
  /%2e%2e%2f/i,
  /%2e%2e\\/i,
  /\.\.%2f/i,
  /\.\.%5c/i,
  /%2e%2e/i,
  /~\//,
  /~\\/
];

/**
 * Detect path traversal attempts
 */
export function detectPathTraversal(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
}

/**
 * Normalize a file path to prevent path traversal
 */
export function normalizePath(path: string): string {
  if (!path || typeof path !== 'string') {
    return path;
  }

  // Remove path traversal sequences
  let normalized = path.replace(/\.\./g, '');
  normalized = normalized.replace(/[\/\\]/g, '/');

  // Remove leading slashes to prevent absolute paths
  normalized = normalized.replace(/^\/+/, '');

  // Remove null bytes
  normalized = normalized.replace(/\0/g, '');

  return normalized;
}

// ============================================================================
// Command Injection Detection
// ============================================================================

const COMMAND_INJECTION_PATTERNS = [
  /[;&|`$()]/, // Shell metacharacters
  /\|\|/, // Command chaining
  /&&/, // Command chaining
  /;.*?\b(cat|ls|rm|cp|mv|chmod|chown|kill|ps|top|netstat|nc|wget|curl)\b/i,
  /`.*?`/, // Backtick execution
  /\$\(.*?\)/, // Command substitution
  /\${.*?}/, // Variable expansion
  /bash.*?-[c]/i,
  /sh.*?-[c]/i,
  /eval\s*\(/i,
  /exec\s*\(/i,
  /system\s*\(/i,
  /passthru\s*\(/i,
  /popen\s*\(/i
];

/**
 * Detect command injection attempts
 */
export function detectCommandInjection(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  for (const pattern of COMMAND_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
}

/**
 * Sanitize input to prevent command injection
 */
export function sanitizeCommand(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }

  return input
    .replace(/[;&|`$()]/g, '')
    .replace(/--/g, '')
    .replace(/\|\|/g, '')
    .replace(/&&/g, '');
}

// ============================================================================
// Email Validation
// ============================================================================

/**
 * Validate an email address
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Use validator library for comprehensive email validation
  return validator.isEmail(email);
}

/**
 * Normalize an email address
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return email;
  }

  return email.toLowerCase().trim();
}

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Validate a URL
 */
export function validateURL(url: string, protocols?: string[]): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const allowedProtocols = protocols || ['http', 'https', 'ftp', 'ftps'];

  if (!validator.isURL(url, { protocols: allowedProtocols as any })) {
    return false;
  }

  try {
    const parsed = new URL(url);

    // Check for forbidden protocols
    if (!allowedProtocols.includes(parsed.protocol.replace(':', ''))) {
      return false;
    }

    // Check for JavaScript protocol
    if (parsed.protocol === 'javascript:') {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Phone Validation
// ============================================================================

/**
 * Validate a phone number
 */
export function validatePhone(phone: string, locale?: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  return validator.isMobilePhone(phone, locale as any || 'any');
}

// ============================================================================
// UUID Validation
// ============================================================================

/**
 * Validate a UUID
 */
export function validateUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }

  return validator.isUUID(uuid);
}

// ============================================================================
// Credit Card Validation
// ============================================================================

/**
 * Validate a credit card number
 */
export function validateCreditCard(cardNumber: string): boolean {
  if (!cardNumber || typeof cardNumber !== 'string') {
    return false;
  }

  // Remove spaces and dashes
  const cleaned = cardNumber.replace(/[\s-]/g, '');

  // Check if it's all digits
  if (!/^\d+$/.test(cleaned)) {
    return false;
  }

  // Check length (13-19 digits)
  if (cleaned.length < 13 || cleaned.length > 19) {
    return false;
  }

  // Luhn algorithm check
  return luhnCheck(cleaned);
}

/**
 * Luhn algorithm for credit card validation
 */
function luhnCheck(cardNumber: string): boolean {
  let sum = 0;
  let isEven = false;

  // Loop through digits from right to left
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

// ============================================================================
// General Validation Rules
// ============================================================================

/**
 * Validate input against a set of rules
 */
export function validateRules(
  data: Record<string, any>,
  rules: ValidationRule[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const sanitized: Record<string, any> = { ...data };

  for (const rule of rules) {
    const value = data[rule.field];
    const isMissing = value === undefined || value === null || value === '';

    // Check required fields
    if (rule.required && isMissing) {
      errors.push({
        field: rule.field,
        message: rule.errorMessage || `${rule.field} is required`,
        value
      });
      continue;
    }

    // Skip validation if not required and missing
    if (!rule.required && isMissing) {
      continue;
    }

    // Type validation
    if (rule.type) {
      let validType = true;

      switch (rule.type) {
        case 'string':
          validType = typeof value === 'string';
          break;
        case 'number':
          validType = typeof value === 'number' && !isNaN(value);
          break;
        case 'boolean':
          validType = typeof value === 'boolean';
          break;
        case 'email':
          validType = validateEmail(value);
          break;
        case 'url':
          validType = validateURL(value);
          break;
        case 'uuid':
          validType = validateUUID(value);
          break;
        case 'date':
          validType = !isNaN(Date.parse(value));
          break;
      }

      if (!validType) {
        errors.push({
          field: rule.field,
          message: rule.errorMessage || `${rule.field} must be a valid ${rule.type}`,
          value
        });
        continue;
      }
    }

    // String length validation
    if (typeof value === 'string') {
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        errors.push({
          field: rule.field,
          message: rule.errorMessage || `${rule.field} must be at least ${rule.minLength} characters`,
          value
        });
      }

      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        errors.push({
          field: rule.field,
          message: rule.errorMessage || `${rule.field} must not exceed ${rule.maxLength} characters`,
          value
        });
      }
    }

    // Number range validation
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push({
          field: rule.field,
          message: rule.errorMessage || `${rule.field} must be at least ${rule.min}`,
          value
        });
      }

      if (rule.max !== undefined && value > rule.max) {
        errors.push({
          field: rule.field,
          message: rule.errorMessage || `${rule.field} must not exceed ${rule.max}`,
          value
        });
      }
    }

    // Pattern validation
    if (rule.pattern && !rule.pattern.test(value)) {
      errors.push({
        field: rule.field,
        message: rule.errorMessage || `${rule.field} format is invalid`,
        value
      });
    }

    // Custom validation
    if (rule.custom) {
      const isValid = await rule.custom(value);
      if (!isValid) {
        errors.push({
          field: rule.field,
          message: rule.errorMessage || `${rule.field} validation failed`,
          value
        });
      }
    }

    // Sanitize string values
    if (typeof value === 'string') {
      sanitized[rule.field] = value.trim();
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : data
  };
}

/**
 * Deep sanitize an object
 */
export function deepSanitize(obj: any): any {
  if (typeof obj === 'string') {
    return escapeHTML(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitize(item));
  }

  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = deepSanitize(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

// ============================================================================
// OWASP Validation
// ============================================================================

/**
 * Comprehensive security validation following OWASP guidelines
 */
export function securityValidation(input: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!input) {
    return { valid: true, issues: [] };
  }

  // Check for SQL injection
  if (detectSQLInjection(input)) {
    issues.push('Potential SQL injection detected');
  }

  // Check for XSS
  if (detectXSS(input)) {
    issues.push('Potential XSS attack detected');
  }

  // Check for path traversal
  if (detectPathTraversal(input)) {
    issues.push('Path traversal attempt detected');
  }

  // Check for command injection
  if (detectCommandInjection(input)) {
    issues.push('Command injection attempt detected');
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
