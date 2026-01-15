/**
 * Error Tracking SDK
 * Main SDK interface for error tracking integration
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ErrorEvent,
  ErrorTrackingSDK as IErrorTrackingSDK,
  Scope,
  User,
  Breadcrumb,
  Attachment,
  ErrorTrackingConfig
} from '../types';
import { ConfigurationManager, createConfig, DEFAULT_ALERT_RULES } from '../config/config';
import { ErrorCaptureManager } from '../capture/capture';
import { ErrorGrouper } from '../grouping/grouper';
import { ErrorAnalyzer } from '../analyzer/analyzer';
import { AlertManager } from '../alerting/manager';
import { StorageFactory, StorageAdapter } from '../storage/adapter';
import { ErrorTrackingEventEmitter } from '../types';

// ============================================================================
// Scope Implementation
// ============================================================================()

class ScopeImpl implements Scope {
  private level: ErrorEvent['level'] = 'info';
  private user?: User;
  private tags: Record<string, string> = {};
  private extra: Record<string, any> = {};
  private contexts: Record<string, any> = {};
  private breadcrumbs: Breadcrumb[] = [];
  private fingerprint?: string[];
  private attachments: Attachment[] = [];

  setLevel(level: ErrorEvent['level']): void {
    this.level = level;
  }

  setUser(user: User | null): void {
    this.user = user || undefined;
  }

  setTag(key: string, value: string): void {
    this.tags[key] = value;
  }

  setTags(tags: Record<string, string>): void {
    this.tags = { ...this.tags, ...tags };
  }

  setExtra(key: string, value: any): void {
    this.extra[key] = value;
  }

  setContext(key: string, context: any): void {
    this.contexts[key] = context;
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push(breadcrumb);
  }

  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

  setFingerprint(fingerprint: string[]): void {
    this.fingerprint = fingerprint;
  }

  addAttachment(attachment: Attachment): void {
    this.attachments.push(attachment);
  }

  applyToEvent(event: ErrorEvent): ErrorEvent {
    const updated: ErrorEvent = { ...event };

    if (this.user) {
      updated.user = this.user;
    }

    if (Object.keys(this.tags).length > 0) {
      updated.tags = { ...this.tags, ...event.tags };
    }

    if (Object.keys(this.extra).length > 0) {
      updated.customData = { ...this.extra, ...event.customData };
    }

    if (Object.keys(this.contexts).length > 0) {
      updated.context = { ...this.contexts, ...event.context };
    }

    if (this.breadcrumbs.length > 0) {
      updated.breadcrumbs = [...this.breadcrumbs, ...event.breadcrumbs];
    }

    if (this.attachments.length > 0) {
      updated.attachments = [...this.attachments, ...(event.attachments || [])];
    }

    if (this.fingerprint) {
      updated.fingerprint = this.fingerprint.join('|');
    }

    return updated;
  }

  clear(): void {
    this.level = 'info';
    this.user = undefined;
    this.tags = {};
    this.extra = {};
    this.contexts = {};
    this.breadcrumbs = [];
    this.fingerprint = undefined;
    this.attachments = [];
  }

  getLevel(): ErrorEvent['level'] {
    return this.level;
  }

  getUser(): User | undefined {
    return this.user;
  }
}

// ============================================================================
// Main SDK Implementation
// ============================================================================()

export class ErrorTrackingSDK
  extends ErrorTrackingEventEmitter
  implements IErrorTrackingSDK
{
  private static instance: ErrorTrackingSDK | null = null;

  private config: ConfigurationManager;
  private captureManager: ErrorCaptureManager;
  private grouper: ErrorGrouper;
  private analyzer: typeof ErrorAnalyzer;
  private alertManager: AlertManager;
  private storage: StorageAdapter;
  private scope: ScopeImpl;
  private enabled: boolean = true;
  private eventQueue: ErrorEvent[] = [];
  private processingQueue: boolean = false;

  private constructor(config: ErrorTrackingConfig) {
    super();

    this.config = createConfig(config);
    this.captureManager = new ErrorCaptureManager(this.config);
    this.grouper = new ErrorGrouper(0.8);
    this.analyzer = ErrorAnalyzer;
    this.alertManager = new AlertManager();
    this.storage = StorageFactory.create(config.storageType || 'memory', config.storageConfig);
    this.scope = new ScopeImpl();

    this.initialize();
  }

  /**
   * Initialize SDK
   */
  private async initialize(): Promise<void> {
    await this.storage.init();

    // Setup default alert rules
    const defaultRules = DEFAULT_ALERT_RULES;
    for (const rule of defaultRules) {
      this.alertManager.addRule(rule);
    }

    // Setup global error handlers
    this.setupGlobalHandlers();

    // Enable if not disabled
    this.enabled = true;
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalHandlers(): void {
    if (typeof window === 'undefined') {
      // Node.js environment
      this.setupNodeHandlers();
    } else {
      // Browser environment
      this.setupBrowserHandlers();
    }
  }

  /**
   * Setup Node.js error handlers
   */
  private setupNodeHandlers(): void {
    if (this.config.get('captureUnhandledRejections')) {
      process.on('unhandledRejection', (reason: any) => {
        const error = reason instanceof Error
          ? reason
          : new Error(String(reason));

        this.captureException(error, { handled: false });
      });

      process.on('uncaughtException', (error: Error) => {
        this.captureException(error, { handled: false });
      });
    }
  }

  /**
   * Setup browser error handlers
   */
  private setupBrowserHandlers(): void {
    if (this.config.get('captureUnhandledRejections')) {
      window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason));

        this.captureException(error, { handled: false });
      });
    }

    window.addEventListener('error', (event) => {
      this.captureException(event.error || new Error(event.message), {
        handled: false
      });
    });

    if (this.config.get('captureConsole')) {
      const consoleMethods = ['log', 'warn', 'error', 'info'];
      const originalConsole: any = {};

      consoleMethods.forEach((method) => {
        originalConsole[method] = console[method];
        console[method] = (...args: any[]) => {
          const breadcrumbManager = this.captureManager.getBreadcrumbManager();
          breadcrumbManager.captureConsole(
            method as Breadcrumb['level'],
            args.map((a) => String(a)).join(' ')
          );

          originalConsole[method].apply(console, args);
        };
      });
    }
  }

  /**
   * Get or create SDK instance
   */
  static getInstance(config?: ErrorTrackingConfig): ErrorTrackingSDK {
    if (!ErrorTrackingSDK.instance) {
      if (!config) {
        throw new Error('Config is required for first initialization');
      }
      ErrorTrackingSDK.instance = new ErrorTrackingSDK(config);
    }
    return ErrorTrackingSDK.instance;
  }

  /**
   * Capture an exception
   */
  captureException(error: Error, context?: Partial<ErrorEvent>): string {
    if (!this.enabled) return '';

    try {
      let event = this.captureManager.captureException(error, context);

      // Apply scope
      event = this.scope.applyToEvent(event);

      // Apply beforeSend hook
      if (this.config.get('beforeSend')) {
        const processed = this.config.get('beforeSend')!(event);
        if (!processed) {
          return '';
        }
        event = processed;
      }

      // Queue event
      this.queueEvent(event);

      // Emit event
      this.emit('error:captured', event);

      return event.id;
    } catch (err) {
      console.error('Failed to capture exception:', err);
      return '';
    }
  }

  /**
   * Capture a message
   */
  captureMessage(
    message: string,
    level?: ErrorEvent['level'],
    context?: Partial<ErrorEvent>
  ): string {
    if (!this.enabled) return '';

    try {
      let event = this.captureManager.captureMessage(
        message,
        level || this.scope.getLevel(),
        context
      );

      // Apply scope
      event = this.scope.applyToEvent(event);

      // Apply beforeSend hook
      if (this.config.get('beforeSend')) {
        const processed = this.config.get('beforeSend')!(event);
        if (!processed) {
          return '';
        }
        event = processed;
      }

      // Queue event
      this.queueEvent(event);

      // Emit event
      this.emit('error:captured', event);

      return event.id;
    } catch (err) {
      console.error('Failed to capture message:', err);
      return '';
    }
  }

  /**
   * Capture an event
   */
  captureEvent(event: Partial<ErrorEvent>): string {
    if (!this.enabled) return '';

    try {
      let fullEvent: ErrorEvent = {
        id: uuidv4(),
        timestamp: Date.now(),
        error: event.error || new Error(event.message || 'Unknown error'),
        type: event.type || 'Error',
        message: event.message || 'Unknown error',
        severity: event.severity || 'medium',
        category: event.category || 'unknown',
        priority: event.priority || 3,
        status: event.status || 'new',
        context: event.context || {},
        breadcrumbs: event.breadcrumbs || [],
        user: event.user || this.scope.getUser(),
        customData: event.customData,
        tags: event.tags,
        occurrences: event.occurrences || 1,
        firstSeen: event.firstSeen || Date.now(),
        lastSeen: event.lastSeen || Date.now(),
        affectedUsers: event.affectedUsers || 0,
        handled: event.handled !== false,
        environment: event.environment || this.config.getEnvironment(),
        release: event.release || this.config.get('release'),
        serverName: event.serverName || this.config.get('serverName'),
        level: event.level || 'error'
      } as ErrorEvent;

      // Apply scope
      fullEvent = this.scope.applyToEvent(fullEvent);

      // Queue event
      this.queueEvent(fullEvent);

      // Emit event
      this.emit('error:captured', fullEvent);

      return fullEvent.id;
    } catch (err) {
      console.error('Failed to capture event:', err);
      return '';
    }
  }

  /**
   * Capture a breadcrumb
   */
  captureBreadcrumb(breadcrumb: Breadcrumb): void {
    if (!this.enabled) return;

    this.scope.addBreadcrumb(breadcrumb);
    this.emit('breadcrumb', breadcrumb);
  }

  /**
   * Set current user
   */
  setUser(user: User | null): void {
    this.captureManager.setUser(user);
    this.scope.setUser(user);
  }

  /**
   * Set context
   */
  setContext(key: string, context: any): void {
    this.captureManager.setContext(key, context);
    this.scope.setContext(key, context);
  }

  /**
   * Set tag
   */
  setTag(key: string, value: string): void {
    this.captureManager.setTag(key, value);
    this.scope.setTag(key, value);
  }

  /**
   * Set tags
   */
  setTags(tags: Record<string, string>): void {
    this.captureManager.setTags(tags);
    this.scope.setTags(tags);
  }

  /**
   * Set extra data
   */
  setExtra(key: string, value: any): void {
    this.captureManager.setExtra(key, value);
    this.scope.setExtra(key, value);
  }

  /**
   * Clear breadcrumbs
   */
  clearBreadcrumbs(): void {
    this.captureManager.clearBreadcrumbs();
    this.scope.clearBreadcrumbs();
  }

  /**
   * Add attachment
   */
  addAttachment(attachment: Attachment): void {
    this.captureManager.addAttachment(attachment);
    this.scope.addAttachment(attachment);
  }

  /**
   * Execute callback with scope
   */
  withScope(callback: (scope: Scope) => void): void {
    const newScope = new ScopeImpl();

    // Copy current scope
    Object.assign(newScope, this.scope);

    // Execute callback with new scope
    callback(newScope);

    // Restore original scope
    this.scope.clear();
    Object.assign(this.scope, newScope);
  }

  /**
   * Configure SDK
   */
  configure(updates: Partial<ErrorTrackingConfig>): void {
    this.config.updateConfig(updates);
  }

  /**
   * Flush queued events
   */
  async flush(): Promise<void> {
    await this.processQueue();
  }

  /**
   * Close SDK
   */
  async close(): Promise<void> {
    this.enabled = false;
    await this.flush();
    await this.storage.close();
    ErrorTrackingSDK.instance = null;
  }

  /**
   * Queue event for processing
   */
  private queueEvent(event: ErrorEvent): void {
    const maxQueueSize = this.config.get('maxEventQueueSize') || 100;

    if (this.eventQueue.length >= maxQueueSize) {
      this.eventQueue.shift(); // Remove oldest event
    }

    this.eventQueue.push(event);

    // Process queue asynchronously
    if (!this.processingQueue) {
      this.processQueue();
    }
  }

  /**
   * Process event queue
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (!event) continue;

        await this.processEvent(event);
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: ErrorEvent): Promise<void> {
    try {
      // Store error
      await this.storage.storeError(event);

      // Group error
      const group = this.grouper.addError(event);
      await this.storage.createGroup(group);

      this.emit('error:grouped', group);

      // Evaluate for alerts
      const alerts = await this.alertManager.evaluateError(event, group);
      for (const alert of alerts) {
        await this.storage.storeAlert(alert);
      }

      this.emit('after-send', event);
    } catch (error) {
      this.emit('send-failed', event, error as Error);

      if (this.config.isDebugEnabled()) {
        console.error('Failed to process event:', error);
      }
    }
  }

  /**
   * Get alert manager
   */
  getAlertManager(): AlertManager {
    return this.alertManager;
  }

  /**
   * Get storage
   */
  getStorage(): StorageAdapter {
    return this.storage;
  }

  /**
   * Get grouper
   */
  getGrouper(): ErrorGrouper {
    return this.grouper;
  }

  /**
   * Get analyzer
   */
  getAnalyzer() {
    return this.analyzer;
  }

  /**
   * Check if SDK is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable SDK
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable SDK
   */
  disable(): void {
    this.enabled = false;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Initialize error tracking
 */
export function init(config: ErrorTrackingConfig): ErrorTrackingSDK {
  return ErrorTrackingSDK.getInstance(config);
}

/**
 * Get SDK instance
 */
export function getSDK(): ErrorTrackingSDK | null {
  return ErrorTrackingSDK.getInstance();
}

/**
 * Capture exception
 */
export function captureException(error: Error, context?: Partial<ErrorEvent>): string {
  const sdk = ErrorTrackingSDK.getInstance();
  return sdk ? sdk.captureException(error, context) : '';
}

/**
 * Capture message
 */
export function captureMessage(
  message: string,
  level?: ErrorEvent['level'],
  context?: Partial<ErrorEvent>
): string {
  const sdk = ErrorTrackingSDK.getInstance();
  return sdk ? sdk.captureMessage(message, level, context) : '';
}

/**
 * Set user
 */
export function setUser(user: User | null): void {
  const sdk = ErrorTrackingSDK.getInstance();
  if (sdk) {
    sdk.setUser(user);
  }
}

/**
 * Set tag
 */
export function setTag(key: string, value: string): void {
  const sdk = ErrorTrackingSDK.getInstance();
  if (sdk) {
    sdk.setTag(key, value);
  }
}

/**
 * Set tags
 */
export function setTags(tags: Record<string, string>): void {
  const sdk = ErrorTrackingSDK.getInstance();
  if (sdk) {
    sdk.setTags(tags);
  }
}

/**
 * Set context
 */
export function setContext(key: string, context: any): void {
  const sdk = ErrorTrackingSDK.getInstance();
  if (sdk) {
    sdk.setContext(key, context);
  }
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(breadcrumb: Breadcrumb): void {
  const sdk = ErrorTrackingSDK.getInstance();
  if (sdk) {
    sdk.captureBreadcrumb(breadcrumb);
  }
}

// Export all types
export * from '../types';
export { ConfigurationManager, createConfig } from '../config/config';
export { ErrorCaptureManager } from '../capture/capture';
export { ErrorGrouper } from '../grouping/grouper';
export { ErrorAnalyzer } from '../analyzer/analyzer';
export { AlertManager } from '../alerting/manager';
export { StorageFactory, InMemoryStorage, PostgreSQLStorage } from '../storage/adapter';
