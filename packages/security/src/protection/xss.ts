/**
 * XSS Protection Module
 * Comprehensive XSS attack prevention and sanitization
 */

import xss from 'xss';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import type { XSSConfig, XSSRule, SecurityContext } from '../types';
import { securityLogger } from '../utils/logger';
import { detectXSS, escapeHTML } from '../utils/validation';

// ============================================================================
// XSS Detector
// ============================================================================

export class XSSDetector {
  private patterns: RegExp[];

  constructor() {
    this.patterns = [
      // Script tags
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      /<script\b[^>]*>/gi,

      // JavaScript in various contexts
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
      /ondblclick\s*=/gi,
      /onmousedown\s*=/gi,
      /onmouseup\s*=/gi,
      /onmouseover\s*=/gi,
      /onmousemove\s*=/gi,
      /onmouseout\s*=/gi,
      /onfocus\s*=/gi,
      /onblur\s*=/gi,
      /onkeydown\s*=/gi,
      /onkeypress\s*=/gi,
      /onkeyup\s*=/gi,
      /onscroll\s*=/gi,

      // Style expressions
      /<style\b[^>]*>[\s\S]*?<\/style>/gi,
      /expression\s*\(/gi,
      /behavior\s*:/gi,

      // Dangerous HTML entities
      /&#[xX]0*[9][aA][eE]/gi, // Tab, newline, carriage return
      /&#0*(13|10);/gi,

      // Data URLs
      /data:text\/html/gi,
      /data:image\/svg\+xml/gi,

      // iframe and embed
      /<iframe\b[^>]*>/gi,
      /<embed\b[^>]*>/gi,
      /<object\b[^>]*>/gi,

      // Form action with javascript
      /<form[^>]+action\s*=\s*["']javascript:/gi,

      // Meta refresh with javascript
      /<meta[^>]+http-equiv\s*=\s*["']refresh["'][^>]*content\s*=\s*[^>]*url\s*=\s*javascript:/gi,

      // Link with javascript
      /<link[^>]+href\s*=\s*["']javascript:/gi,

      // Background with javascript
      /background\s*:\s*url\s*\(\s*javascript:/gi,

      // Style attribute with javascript
      /style\s*=\s*["'][^"']*javascript:/gi,

      // SVG with javascript
      /<svg[^>]*>[\s\S]*?<\/svg>/gi,
    ];
  }

  /**
   * Detect XSS in input
   */
  detect(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }

    for (const pattern of this.patterns) {
      if (pattern.test(input)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get XSS details
   */
  detectWithDetails(input: string): {
    detected: boolean;
    matches: Array<{ pattern: RegExp; match: string; index: number }>;
  } {
    const matches: Array<{ pattern: RegExp; match: string; index: number }> = [];

    if (!input || typeof input !== 'string') {
      return { detected: false, matches };
    }

    for (const pattern of this.patterns) {
      const match = pattern.exec(input);
      if (match) {
        matches.push({
          pattern,
          match: match[0],
          index: match.index
        });
      }
    }

    return {
      detected: matches.length > 0,
      matches
    };
  }

  /**
   * Add custom detection pattern
   */
  addPattern(pattern: RegExp): void {
    this.patterns.push(pattern);
  }

  /**
   * Remove pattern by index
   */
  removePattern(index: number): void {
    if (index >= 0 && index < this.patterns.length) {
      this.patterns.splice(index, 1);
    }
  }
}

// ============================================================================
// XSS Sanitizer
// ============================================================================

export class XSSSanitizer {
  private config: XSSConfig;

  constructor(config: XSSConfig = {}) {
    this.config = {
      whitelist: config.whitelist || this.getDefaultWhitelist(),
      stripIgnoreTag: config.stripIgnoreTag !== false,
      stripIgnoreTagBody: config.stripIgnoreTagBody !== false,
      css: config.css !== false,
      escapeHtml: config.escapeHtml !== false
    };
  }

  private getDefaultWhitelist(): Record<string, string[]> {
    return {
      a: ['href', 'title', 'target', 'rel'],
      b: [],
      br: [],
      div: ['class', 'id'],
      em: [],
      h1: ['class', 'id'],
      h2: ['class', 'id'],
      h3: ['class', 'id'],
      h4: ['class', 'id'],
      h5: ['class', 'id'],
      h6: ['class', 'id'],
      hr: [],
      i: [],
      img: ['src', 'alt', 'title', 'width', 'height', 'class', 'id'],
      p: ['class', 'id'],
      pre: ['class'],
      span: ['class', 'id'],
      strong: [],
      sub: [],
      sup: [],
      ul: ['class'],
      ol: ['class', 'start'],
      li: ['class'],
      code: ['class'],
      blockquote: ['class'],
      table: ['class', 'border', 'cellpadding', 'cellspacing'],
      thead: [],
      tbody: [],
      tfoot: [],
      tr: [],
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
      del: [],
      ins: [],
      mark: [],
      small: [],
      s: [],
      strike: [],
      u: []
    };
  }

  /**
   * Sanitize HTML string
   */
  sanitize(html: string): string {
    const xssOptions = {
      whiteList: this.config.whitelist,
      stripIgnoreTag: this.config.stripIgnoreTag,
      stripIgnoreTagBody: this.config.stripIgnoreTagBody,
      css: this.config.css,
      escapeHtml: this.config.escapeHtml,
      onIgnoreTag: (tag: string, html: string, options: any) => {
        // Log ignored tags for security monitoring
        securityLogger.debug(`Ignored potentially dangerous tag: ${tag}`);
      },
      onIgnoreTagAttr: (tag: string, name: string, value: string) => {
        // Log ignored attributes for security monitoring
        securityLogger.debug(`Ignored attribute: ${name} on ${tag}`);
      }
    };

    return xss(html, xssOptions);
  }

  /**
   * Sanitize with custom rules
   */
  sanitizeWithRules(html: string, rules: XSSRule[]): string {
    const whitelist: Record<string, string[]> = {};

    for (const rule of rules) {
      whitelist[rule.tagName] = rule.attributes || [];
    }

    const xssOptions = {
      whiteList: whitelist,
      stripIgnoreTag: true,
      stripIgnoreTagBody: true,
      css: false,
      escapeHtml: true
    };

    return xss(html, xssOptions);
  }

  /**
   * Deep sanitize an object
   */
  deepSanitize(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitize(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepSanitize(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = this.deepSanitize(obj[key]);
        }
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Update whitelist
   */
  updateWhitelist(whitelist: Record<string, string[]>): void {
    this.config.whitelist = whitelist;
  }

  /**
   * Add allowed tag
   */
  addAllowedTag(tag: string, attributes: string[] = []): void {
    if (!this.config.whitelist) {
      this.config.whitelist = {};
    }
    this.config.whitelist[tag] = attributes;
  }

  /**
   * Remove allowed tag
   */
  removeAllowedTag(tag: string): void {
    if (this.config.whitelist) {
      delete this.config.whitelist[tag];
    }
  }
}

// ============================================================================
// Advanced XSS Protection with DOMPurify
// ============================================================================

export class AdvancedXSSProtection {
  private window: Window;
  private DOMPurify: any;

  constructor() {
    // Create a virtual window for DOMPurify
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    this.window = dom.window;
    this.DOMPurify = DOMPurify(dom.window);
  }

  /**
   * Sanitize HTML with DOMPurify
   */
  sanitize(html: string, config?: {
    ALLOWED_TAGS?: string[];
    ALLOWED_ATTR?: string[];
    FORBID_TAGS?: string[];
    FORBID_ATTR?: string[];
    ALLOW_DATA_ATTR?: boolean;
    SAFE_FOR_TEMPLATES?: boolean;
    WHOLE_DOCUMENT?: boolean;
    RETURN_DOM?: boolean;
    RETURN_DOM_FRAGMENT?: boolean;
    RETURN_TRUSTED_TYPE?: boolean;
    SANITIZE_DOM?: boolean;
    SANITIZE_NAMED_PROPS?: boolean;
    KEEP_CONTENT?: boolean;
  }): string {
    const clean = this.DOMPurify.sanitize(html, {
      RETURN_TRUSTED_TYPE: false,
      ...config
    });

    return clean.toString();
  }

  /**
   * Sanitize and return as DOM node
   */
  sanitizeToDOM(html: string): Node | null {
    return this.DOMPurify.sanitize(html, {
      RETURN_DOM: true,
      RETURN_DOM_FRAGMENT: false,
      SANITIZE_DOM: true
    });
  }

  /**
   * Sanitize and return as DOM fragment
   */
  sanitizeToFragment(html: string): DocumentFragment | null {
    return this.DOMPurify.sanitize(html, {
      RETURN_DOM: true,
      RETURN_DOM_FRAGMENT: true,
      SANITIZE_DOM: true
    });
  }

  /**
   * Check if HTML is safe
   */
  isSafe(html: string): boolean {
    const sanitized = this.sanitize(html);
    return sanitized === html;
  }

  /**
   * Get DOMPurify instance for advanced usage
   */
  getPurifier(): any {
    return this.DOMPurify;
  }

  /**
   * Add hook to DOMPurify
   */
  addHook(name: 'uponSanitizeAttribute' | 'uponSanitizeElement' | 'beforeSanitizeElements' | 'afterSanitizeAttributes' | 'beforeSanitizeShadowDOM' | 'uponSanitizeShadowNode', func: (...args: any[]) => void): void {
    this.DOMPurify.addHook(name, func);
  }

  /**
   * Remove hook from DOMPurify
   */
  removeHook(name: string, func?: (...args: any[]) => void): void {
    this.DOMPurify.removeHook(name, func);
  }
}

// ============================================================================
// Context-Aware XSS Protection
// ============================================================================

export class ContextAwareXSSProtection {
  private detector: XSSDetector;
  private sanitizer: XSSSanitizer;
  private advanced: AdvancedXSSProtection;

  constructor(config: XSSConfig = {}) {
    this.detector = new XSSDetector();
    this.sanitizer = new XSSSanitizer(config);
    this.advanced = new AdvancedXSSProtection();
  }

  /**
   * Protect based on context (HTML, attribute, JavaScript, CSS, URL)
   */
  protect(input: string, context: 'html' | 'attribute' | 'javascript' | 'css' | 'url'): string {
    switch (context) {
      case 'html':
        return this.protectForHTML(input);

      case 'attribute':
        return this.protectForAttribute(input);

      case 'javascript':
        return this.protectForJavaScript(input);

      case 'css':
        return this.protectForCSS(input);

      case 'url':
        return this.protectForURL(input);

      default:
        return escapeHTML(input);
    }
  }

  /**
   * Protect for HTML context
   */
  private protectForHTML(input: string): string {
    // Sanitize with DOMPurify for HTML content
    return this.advanced.sanitize(input, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'span'],
      ALLOWED_ATTR: ['href', 'title', 'class'],
      ALLOW_DATA_ATTR: false
    });
  }

  /**
   * Protect for HTML attribute context
   */
  private protectForAttribute(input: string): string {
    // Escape HTML entities
    return escapeHTML(input)
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/`/g, '&#x60;');
  }

  /**
   * Protect for JavaScript context
   */
  private protectForJavaScript(input: string): string {
    // Escape for JavaScript strings
    return input
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/\f/g, '\\f')
      .replace(/\v/g, '\\v')
      .replace(/\0/g, '\\0');
  }

  /**
   * Protect for CSS context
   */
  private protectForCSS(input: string): string {
    // Remove dangerous CSS functions
    return input
      .replace(/expression\s*\(/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/behavior\s*:/gi, '')
      .replace(/url\s*\(\s*["']?javascript:/gi, 'url("")');
  }

  /**
   * Protect for URL context
   */
  private protectForURL(input: string): string {
    // Validate and sanitize URL
    try {
      const url = new URL(input);

      // Block dangerous protocols
      const dangerousProtocols = ['javascript:', 'vbscript:', 'data:', 'file:'];
      if (dangerousProtocols.includes(url.protocol)) {
        return '';
      }

      return input;
    } catch {
      // Invalid URL, escape it
      return encodeURIComponent(input);
    }
  }

  /**
   * Middleware for Hono to protect all outputs
   */
  async protectResponse(body: any, contentType: string): Promise<any> {
    if (typeof body === 'string') {
      if (contentType.includes('text/html')) {
        return this.protect(body, 'html');
      } else if (contentType.includes('application/json')) {
        // JSON is safe by default, just ensure no script tags
        return JSON.stringify(this.sanitizer.deepSanitize(JSON.parse(body)));
      }
    }

    return body;
  }
}

// ============================================================================
// XSS Protection Middleware
// ============================================================================

export function createXSSProtection(config: XSSConfig = {}) {
  const protection = new ContextAwareXSSProtection(config);

  return {
    /**
     * Protect input
     */
    protect(input: string, context: 'html' | 'attribute' | 'javascript' | 'css' | 'url' = 'html'): string {
      return protection.protect(input, context);
    },

    /**
     * Sanitize HTML
     */
    sanitize(html: string): string {
      return protection.sanitizer.sanitize(html);
    },

    /**
     * Detect XSS
     */
    detect(input: string): boolean {
      return protection.detector.detect(input);
    },

    /**
     * Get XSS detection details
     */
    detectWithDetails(input: string) {
      return protection.detector.detectWithDetails(input);
    },

    /**
     * Deep sanitize object
     */
    deepSanitize(obj: any): any {
      return protection.sanitizer.deepSanitize(obj);
    }
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Quick XSS detection
 */
export function detectXSSQuick(input: string): boolean {
  return detectXSS(input);
}

/**
 * Quick XSS sanitization
 */
export function sanitizeXSSQuick(input: string): string {
  const sanitizer = new XSSSanitizer();
  return sanitizer.sanitize(input);
}

/**
 * Escape for HTML context
 */
export function escapeHTMLContext(input: string): string {
  return escapeHTML(input);
}

/**
 * Escape for JavaScript context
 */
export function escapeJavaScriptContext(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
    .replace(/\v/g, '\\v')
    .replace(/\0/g, '\\0');
}

/**
 * Escape for URL context
 */
export function escapeURLContext(input: string): string {
  return encodeURIComponent(input);
}

/**
 * Escape for CSS context
 */
export function escapeCSSContext(input: string): string {
  return input
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/behavior\s*:/gi, '')
    .replace(/url\s*\(\s*["']?javascript:/gi, 'url("")');
}
