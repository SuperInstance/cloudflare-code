/**
 * Error Capture Module
 * Captures and processes errors with full context and stack traces
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ErrorEvent,
  ErrorContext,
  StackFrame,
  Breadcrumb,
  User,
  ErrorSeverity,
  ErrorCategory,
  ErrorPriority,
  ErrorStatus
} from '../types';
import { ConfigurationManager } from '../config/config';

// ============================================================================
// Stack Trace Parser
// ============================================================================

export class StackTraceParser {
  /**
   * Parse error stack trace into frames
   */
  static parse(stack?: string): StackFrame[] {
    if (!stack) {
      return [];
    }

    const frames: StackFrame[] = [];
    const lines = stack.split('\n');

    for (const line of lines) {
      const frame = StackTraceParser.parseLine(line);
      if (frame) {
        frames.push(frame);
      }
    }

    return frames;
  }

  /**
   * Parse a single stack frame line
   */
  private static parseLine(line: string): StackFrame | null {
    // Match various stack trace formats
    const patterns = [
      // Chrome/V8: at functionName (filename:line:column)
      /at\s+([^\s]+)\s+\(([^\s]+):(\d+):(\d+)\)$/,
      // Chrome/V8: at filename:line:column
      /at\s+([^\s]+):(\d+):(\d+)$/,
      // Firefox: functionName@filename:line:column
      /([^\s]+)@([^\s]+):(\d+):(\d+)$/,
      // Safari: functionName@filename:line:column
      /([^\s]+)@(.+):(\d+):(\d+)/,
      // Node.js: at functionName (filename:line:column)
      /\s*at\s+([^\s]+)\s+\((.+):(\d+):(\d+)\)/,
      // Generic
      /([^\s]+):(\d+):(\d+)/
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const [, func, file, lineStr, colStr] = match;
        return {
          functionName: func || '(anonymous)',
          filename: file || '(unknown)',
          lineNumber: lineStr ? parseInt(lineStr, 10) : undefined,
          columnNumber: colStr ? parseInt(colStr, 10) : undefined
        };
      }
    }

    return null;
  }

  /**
   * Enhance stack frames with source context
   */
  static async enhanceWithSource(
    frames: StackFrame[],
    sourceMap?: any
  ): Promise<StackFrame[]> {
    // In a real implementation, this would:
    // 1. Use source maps to map minified code to original
    // 2. Fetch source code for context
    // 3. Add pre/post context lines

    // For now, return as-is
    return frames;
  }

  /**
   * Generate a fingerprint from stack frames
   */
  static generateFingerprint(frames: StackFrame[]): string {
    if (frames.length === 0) {
      return 'no-stack';
    }

    // Use top 3 frames for fingerprinting
    const relevantFrames = frames.slice(0, 3);
    const signature = relevantFrames
      .map(frame => {
        const func = frame.functionName || '(anonymous)';
        const file = frame.filename || '(unknown)';
        return `${func}@${file}`;
      })
      .join('|');

    return signature;
  }
}

// ============================================================================
// Breadcrumb Manager
// ============================================================================

export class BreadcrumbManager {
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs: number;

  constructor(maxBreadcrumbs: number = 100) {
    this.maxBreadcrumbs = maxBreadcrumbs;
  }

  /**
   * Add a breadcrumb
   */
  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push(breadcrumb);

    // Trim to max size
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }
  }

  /**
   * Get all breadcrumbs
   */
  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  /**
   * Clear all breadcrumbs
   */
  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

  /**
   * Capture console breadcrumb
   */
  captureConsole(level: Breadcrumb['level'], message: string, data?: any): void {
    this.addBreadcrumb({
      timestamp: Date.now(),
      level,
      category: 'console',
      message,
      data,
      type: 'console'
    });
  }

  /**
   * Capture HTTP breadcrumb
   */
  captureHttp(
    type: 'request' | 'response',
    url: string,
    method?: string,
    statusCode?: number,
    duration?: number
  ): void {
    this.addBreadcrumb({
      timestamp: Date.now(),
      level: statusCode && statusCode >= 400 ? 'error' : 'info',
      category: 'http',
      message: `${type.toUpperCase()} ${method || 'GET'} ${url}`,
      type: 'http',
      data: {
        url,
        method,
        statusCode,
        duration
      }
    });
  }

  /**
   * Capture navigation breadcrumb
   */
  captureNavigation(from: string, to: string): void {
    this.addBreadcrumb({
      timestamp: Date.now(),
      level: 'info',
      category: 'navigation',
      message: `Navigation from ${from} to ${to}`,
      type: 'navigation',
      data: { from, to }
    });
  }

  /**
   * Capture user action breadcrumb
   */
  captureUserAction(action: string, target?: string, data?: any): void {
    this.addBreadcrumb({
      timestamp: Date.now(),
      level: 'info',
      category: 'user',
      message: `User action: ${action}${target ? ` on ${target}` : ''}`,
      type: 'user',
      data: { action, target, ...data }
    });
  }
}

// ============================================================================
// Context Capture
// ============================================================================

export class ContextCapture {
  /**
   * Capture browser/execution context
   */
  static captureExecutionContext(): ErrorContext {
    const context: ErrorContext = {};

    if (typeof window !== 'undefined') {
      // Browser context
      context.userAgent = navigator.userAgent;
      context.language = navigator.language;
      context.platform = navigator.platform;
      context.url = window.location.href;
      context.referrer = document.referrer;
      context.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      context.locale = navigator.language;

      if (window.screen) {
        context.screenSize = {
          width: window.screen.width,
          height: window.screen.height
        };
      }

      if (window.innerWidth && window.innerHeight) {
        context.viewportSize = {
          width: window.innerWidth,
          height: window.innerHeight
        };
      }
    }

    if (typeof process !== 'undefined') {
      // Node.js context
      context.platform = process.platform;
      context.arch = process.arch;
      context.nodeVersion = process.version;
    }

    return context;
  }

  /**
   * Capture request context
   */
  static captureRequestContext(req?: any): any {
    if (!req) {
      return undefined;
    }

    return {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: req.query,
      params: req.params,
      cookies: req.cookies,
      ip: req.ip || req.connection?.remoteAddress
    };
  }

  /**
   * Capture user context
   */
  static captureUserContext(user?: Partial<User>): User | undefined {
    if (!user) {
      return undefined;
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      ipAddress: user.ipAddress,
      segment: user.segment,
      roles: user.roles,
      metadata: user.metadata
    };
  }

  /**
   * Capture custom data
   */
  static captureCustomData(data?: Record<string, any>): Record<string, any> | undefined {
    if (!data) {
      return undefined;
    }

    // Sanitize sensitive data
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'access_token',
      'refresh_token',
      'private_key',
      'credit_card',
      'ssn',
      'social_security'
    ];

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Capture performance context
   */
  static capturePerformanceContext(): Record<string, any> | undefined {
    if (typeof performance === 'undefined') {
      return undefined;
    }

    const perfData: Record<string, any> = {};

    if (performance.memory) {
      perfData.memory = {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }

    if (performance.timing) {
      const timing = performance.timing;
      perfData.timing = {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        pageLoad: timing.loadEventEnd - timing.navigationStart,
        dns: timing.domainLookupEnd - timing.domainLookupStart,
        tcp: timing.connectEnd - timing.connectStart,
        ttfb: timing.responseStart - timing.navigationStart
      };
    }

    if (performance.getEntriesByType) {
      const navigation = performance.getEntriesByType('navigation')[0] as any;
      if (navigation) {
        perfData.navigationTiming = {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
          pageLoad: navigation.loadEventEnd - navigation.fetchStart,
          dns: navigation.domainLookupEnd - navigation.domainLookupStart,
          tcp: navigation.connectEnd - navigation.connectStart,
          ttfb: navigation.responseStart - navigation.fetchStart
        };
      }
    }

    return perfData;
  }
}

// ============================================================================
// Error Classification
// ============================================================================

export class ErrorClassifier {
  /**
   * Classify error by category
   */
  static classifyCategory(error: Error | string): ErrorCategory {
    const message = typeof error === 'string' ? error : error.message;
    const name = typeof error === 'string' ? '' : error.name;

    // Network errors
    if (this.matchesPattern(message, [
      'network',
      'fetch',
      'xhr',
      'ajax',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET'
    ])) {
      return ErrorCategory.NETWORK;
    }

    // API errors
    if (this.matchesPattern(message, [
      'api',
      'endpoint',
      '422',
      '500',
      '502',
      '503',
      '504'
    ])) {
      return ErrorCategory.API;
    }

    // Database errors
    if (this.matchesPattern(message, [
      'database',
      'query',
      'connection',
      'timeout',
      'ECONNREFUSED',
      'SQLITE',
      'MYSQL',
      'POSTGRES',
      'MONGO'
    ])) {
      return ErrorCategory.DATABASE;
    }

    // Authentication errors
    if (this.matchesPattern(message, [
      'unauthorized',
      'unauthenticated',
      '401',
      'invalid token',
      'expired token',
      'authentication'
    ])) {
      return ErrorCategory.AUTHENTICATION;
    }

    // Authorization errors
    if (this.matchesPattern(message, [
      'forbidden',
      '403',
      'access denied',
      'permission',
      'authorization'
    ])) {
      return ErrorCategory.AUTHORIZATION;
    }

    // Validation errors
    if (this.matchesPattern(message, [
      'validation',
      'invalid',
      'required',
      'malformed',
      '400',
      '422'
    ])) {
      return ErrorCategory.VALIDATION;
    }

    // Type errors
    if (name === 'TypeError' || this.matchesPattern(message, ['type error', 'not a'])) {
      return ErrorCategory.TYPE;
    }

    // Reference errors
    if (name === 'ReferenceError' || this.matchesPattern(message, ['is not defined', 'cannot access'])) {
      return ErrorCategory.REFERENCE;
    }

    // Range errors
    if (name === 'RangeError' || this.matchesPattern(message, ['range', 'maximum call stack'])) {
      return ErrorCategory.RANGE;
    }

    // Syntax errors
    if (name === 'SyntaxError') {
      return ErrorCategory.SYNTAX;
    }

    // Memory errors
    if (this.matchesPattern(message, ['memory', 'heap', 'out of memory'])) {
      return ErrorCategory.MEMORY;
    }

    // Performance errors
    if (this.matchesPattern(message, ['timeout', 'performance', 'slow', 'latency'])) {
      return ErrorCategory.PERFORMANCE;
    }

    // Concurrency errors
    if (this.matchesPattern(message, ['race', 'deadlock', 'concurrency', 'lock'])) {
      return ErrorCategory.CONCURRENCY;
    }

    // Runtime errors (default for most JavaScript errors)
    if (name === 'Error' || name === 'RuntimeError') {
      return ErrorCategory.RUNTIME;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Classify error by severity
   */
  static classifySeverity(error: Error | string, category: ErrorCategory): ErrorSeverity {
    const message = typeof error === 'string' ? error : error.message;
    const name = typeof error === 'string' ? '' : error.name;

    // Critical errors
    if (this.matchesPattern(message, [
      'fatal',
      'critical',
      'system down',
      'panic',
      'crash'
    ])) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity based on category
    if ([ErrorCategory.AUTHENTICATION, ErrorCategory.DATABASE].includes(category)) {
      return ErrorSeverity.HIGH;
    }

    // High severity based on error name
    if (['SyntaxError', 'RangeError'].includes(name)) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity
    if ([ErrorCategory.API, ErrorCategory.NETWORK, ErrorCategory.VALIDATION].includes(category)) {
      return ErrorSeverity.MEDIUM;
    }

    // Low severity
    if (category === ErrorCategory.PERFORMANCE) {
      return ErrorSeverity.LOW;
    }

    return ErrorSeverity.MEDIUM;
  }

  /**
   * Classify error by priority
   */
  static classifyPriority(
    severity: ErrorSeverity,
    category: ErrorCategory,
    occurrences: number = 1
  ): ErrorPriority {
    // Critical severity = P0
    if (severity === ErrorSeverity.CRITICAL) {
      return ErrorPriority.P0;
    }

    // High severity = P1
    if (severity === ErrorSeverity.HIGH) {
      return ErrorPriority.P1;
    }

    // Auth/DB errors = P1 or P2 based on frequency
    if ([ErrorCategory.AUTHENTICATION, ErrorCategory.DATABASE].includes(category)) {
      return occurrences > 10 ? ErrorPriority.P1 : ErrorPriority.P2;
    }

    // Medium severity = P2
    if (severity === ErrorSeverity.MEDIUM) {
      return ErrorPriority.P2;
    }

    // Low severity = P3
    if (severity === ErrorSeverity.LOW) {
      return ErrorPriority.P3;
    }

    return ErrorPriority.P4;
  }

  /**
   * Check if message matches any pattern
   */
  private static matchesPattern(message: string, patterns: string[]): boolean {
    const lowerMessage = message.toLowerCase();
    return patterns.some(pattern => lowerMessage.includes(pattern.toLowerCase()));
  }
}

// ============================================================================
// Error Capture Manager
// ============================================================================

export class ErrorCaptureManager {
  private config: ConfigurationManager;
  private breadcrumbManager: BreadcrumbManager;
  private currentUser?: User;
  private customContext: Record<string, any> = {};
  private tags: Record<string, string> = {};
  private extraData: Record<string, any> = {};
  private attachments: any[] = [];

  constructor(config: ConfigurationManager) {
    this.config = config;
    this.breadcrumbManager = new BreadcrumbManager(config.get('maxBreadcrumbs') || 100);
  }

  /**
   * Capture an exception
   */
  captureException(
    error: Error,
    context?: Partial<ErrorEvent>
  ): ErrorEvent {
    // Check if error should be ignored
    if (this.config.shouldIgnoreError(error)) {
      throw new Error('Error ignored by configuration');
    }

    // Check if error should be sampled
    if (!this.config.shouldSample()) {
      throw new Error('Error sampled out');
    }

    const now = Date.now();
    const stack = error.stack || '';
    const stackFrames = StackTraceParser.parse(stack);
    const category = ErrorClassifier.classifyCategory(error);
    const severity = ErrorClassifier.classifySeverity(error, category);

    const event: ErrorEvent = {
      id: uuidv4(),
      timestamp: now,
      error,
      type: error.name || 'Error',
      message: error.message || 'Unknown error',
      stack,
      stackFrames,
      severity,
      category,
      priority: ErrorClassifier.classifyPriority(severity, category),
      status: ErrorStatus.NEW,
      context: {
        ...ContextCapture.captureExecutionContext(),
        ...context?.context,
        ...this.customContext
      },
      breadcrumbs: this.breadcrumbManager.getBreadcrumbs(),
      user: context?.user || this.currentUser,
      request: context?.request,
      customData: {
        ...context?.customData,
        ...this.extraData
      },
      attachments: [...(context?.attachments || []), ...this.attachments],
      tags: {
        ...this.tags,
        ...context?.tags
      },
      fingerprint: StackTraceParser.generateFingerprint(stackFrames),
      occurrences: 1,
      firstSeen: now,
      lastSeen: now,
      affectedUsers: this.currentUser ? 1 : 0,
      handled: context?.handled || false,
      environment: this.config.getEnvironment(),
      release: this.config.get('release'),
      distribution: this.config.get('distribution'),
      serverName: this.config.get('serverName'),
      level: 'error'
    };

    return event;
  }

  /**
   * Capture a message
   */
  captureMessage(
    message: string,
    level: ErrorEvent['level'] = 'info',
    context?: Partial<ErrorEvent>
  ): ErrorEvent {
    const now = Date.now();
    const category = ErrorClassifier.classifyCategory(message);
    const severity = ErrorClassifier.classifySeverity(message, category);

    const event: ErrorEvent = {
      id: uuidv4(),
      timestamp: now,
      error: new Error(message),
      type: 'Message',
      message,
      severity,
      category,
      priority: ErrorClassifier.classifyPriority(severity, category),
      status: ErrorStatus.NEW,
      context: {
        ...ContextCapture.captureExecutionContext(),
        ...context?.context,
        ...this.customContext
      },
      breadcrumbs: this.breadcrumbManager.getBreadcrumbs(),
      user: context?.user || this.currentUser,
      customData: {
        ...context?.customData,
        ...this.extraData
      },
      tags: {
        ...this.tags,
        ...context?.tags
      },
      occurrences: 1,
      firstSeen: now,
      lastSeen: now,
      affectedUsers: this.currentUser ? 1 : 0,
      handled: true,
      environment: this.config.getEnvironment(),
      release: this.config.get('release'),
      distribution: this.config.get('distribution'),
      serverName: this.config.get('serverName'),
      level
    };

    return event;
  }

  /**
   * Set current user
   */
  setUser(user: User | null): void {
    this.currentUser = user || undefined;
  }

  /**
   * Set custom context
   */
  setContext(key: string, context: any): void {
    this.customContext[key] = context;
  }

  /**
   * Set tag
   */
  setTag(key: string, value: string): void {
    this.tags[key] = value;
  }

  /**
   * Set multiple tags
   */
  setTags(tags: Record<string, string>): void {
    this.tags = { ...this.tags, ...tags };
  }

  /**
   * Set extra data
   */
  setExtra(key: string, value: any): void {
    this.extraData[key] = value;
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbManager.addBreadcrumb(breadcrumb);
  }

  /**
   * Clear breadcrumbs
   */
  clearBreadcrumbs(): void {
    this.breadcrumbManager.clearBreadcrumbs();
  }

  /**
   * Add attachment
   */
  addAttachment(attachment: any): void {
    this.attachments.push(attachment);
  }

  /**
   * Clear all scope data
   */
  clearScope(): void {
    this.customContext = {};
    this.tags = {};
    this.extraData = {};
    this.attachments = [];
  }

  /**
   * Get breadcrumb manager
   */
  getBreadcrumbManager(): BreadcrumbManager {
    return this.breadcrumbManager;
  }
}
