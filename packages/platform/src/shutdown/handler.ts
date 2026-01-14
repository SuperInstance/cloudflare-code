/**
 * Graceful Shutdown Handler
 *
 * Comprehensive shutdown management with cleanup hooks,
 * connection draining, and state persistence.
 */

import { delay, generateId } from '../utils/helpers';

/**
 * Cleanup hook definition
 */
export interface CleanupHook {
  readonly id: string;
  readonly name: string;
  readonly priority: number;
  readonly timeout: number;
  readonly cleanup: () => Promise<void> | void;
  readonly forceCleanup?: () => Promise<void> | void;
}

/**
 * Shutdown state
 */
type ShutdownState = 'running' | 'initiated' | 'draining' | 'cleanup' | 'complete' | 'failed';

/**
 * Shutdown handler options
 */
export interface ShutdownHandlerOptions {
  readonly timeout?: number;
  readonly forceTimeout?: number;
  readonly drainTimeout?: number;
  readonly enableSignals?: boolean;
  readonly persistState?: boolean;
  readonly logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Shutdown status
 */
export interface ShutdownStatus {
  readonly state: ShutdownState;
  readonly reason?: string;
  readonly initiatedAt: number;
  readonly completedAt?: number;
  readonly duration?: number;
  readonly hooksExecuted: number;
  readonly hooksTotal: number;
  readonly errors: Array<{
    hook: string;
    error: string;
  }>;
  readonly forced: boolean;
}

/**
 * In-flight request tracking
 */
interface InFlightRequest {
  readonly id: string;
  readonly startTime: number;
  readonly type: string;
  readonly details?: Record<string, unknown>;
}

/**
 * Shutdown handler implementation
 */
export class ShutdownHandler {
  private hooks: CleanupHook[];
  private options: Required<ShutdownHandlerOptions>;
  private state: ShutdownState;
  private initiatedAt: number;
  private completedAt: number;
  private errors: Array<{ hook: string; error: string }>;
  private inFlightRequests: Map<string, InFlightRequest>;
  private disposed: boolean;
  private signalHandlers: Map<string, () => void>;
  private shutdownPromise: Promise<void> | null;
  private resolveShutdown: (() => void) | null;

  constructor(options: ShutdownHandlerOptions = {}) {
    this.hooks = [];
    this.inFlightRequests = new Map();
    this.disposed = false;
    this.signalHandlers = new Map();
    this.shutdownPromise = null;
    this.resolveShutdown = null;
    this.state = 'running';
    this.initiatedAt = 0;
    this.completedAt = 0;
    this.errors = [];

    this.options = {
      timeout: options.timeout || 10000,
      forceTimeout: options.forceTimeout || 30000,
      drainTimeout: options.drainTimeout || 5000,
      enableSignals: options.enableSignals ?? true,
      persistState: options.persistState ?? true,
      logLevel: options.logLevel || 'info',
    };

    // Setup signal handlers if enabled
    if (this.options.enableSignals && typeof process !== 'undefined') {
      this.setupSignalHandlers();
    }
  }

  /**
   * Initialize the shutdown handler
   */
  async initialize(options?: Partial<ShutdownHandlerOptions>): Promise<void> {
    if (options) {
      this.options = { ...this.options, ...options };
    }

    this.log('info', 'Shutdown handler initialized');
  }

  /**
   * Register a cleanup hook
   */
  registerCleanup(hook: Omit<CleanupHook, 'id'>): string {
    this.assertNotDisposed();
    this.assertNotShutdown();

    const id = generateId();
    const cleanupHook: CleanupHook = {
      ...hook,
      id,
      timeout: hook.timeout || this.options.timeout,
    };

    // Insert in priority order (higher priority first)
    let inserted = false;
    for (let i = 0; i < this.hooks.length; i++) {
      if (hook.priority > this.hooks[i].priority) {
        this.hooks.splice(i, 0, cleanupHook);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.hooks.push(cleanupHook);
    }

    this.log('debug', `Registered cleanup hook: ${hook.name} (priority: ${hook.priority})`);

    return id;
  }

  /**
   * Unregister a cleanup hook
   */
  unregisterCleanup(id: string): void {
    this.assertNotDisposed();
    this.assertNotShutdown();

    const index = this.hooks.findIndex((h) => h.id === id);
    if (index !== -1) {
      const hook = this.hooks[index];
      this.hooks.splice(index, 1);
      this.log('debug', `Unregistered cleanup hook: ${hook.name}`);
    }
  }

  /**
   * Track an in-flight request
   */
  trackRequest(
    id: string,
    type: string,
    details?: Record<string, unknown>
  ): void {
    this.assertNotDisposed();

    this.inFlightRequests.set(id, {
      id,
      startTime: Date.now(),
      type,
      details,
    });

    this.log('debug', `Tracking request: ${id} (${type})`);
  }

  /**
   * Complete an in-flight request
   */
  completeRequest(id: string): void {
    this.assertNotDisposed();

    const request = this.inFlightRequests.get(id);
    if (request) {
      const duration = Date.now() - request.startTime;
      this.inFlightRequests.delete(id);
      this.log('debug', `Completed request: ${id} (${duration}ms)`);
    }
  }

  /**
   * Get in-flight requests count
   */
  getInFlightCount(): number {
    return this.inFlightRequests.size;
  }

  /**
   * Get in-flight requests
   */
  getInFlightRequests(): InFlightRequest[] {
    return Array.from(this.inFlightRequests.values());
  }

  /**
   * Initiate graceful shutdown
   */
  async shutdown(reason = 'manual'): Promise<void> {
    // Return existing promise if shutdown is in progress
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.shutdownPromise = this.performShutdown(reason);
    return this.shutdownPromise;
  }

  /**
   * Force shutdown immediately
   */
  async forceShutdown(reason = 'force'): Promise<void> {
    this.log('warn', `Force shutdown initiated: ${reason}`);

    // Set state to cleanup directly
    this.state = 'cleanup';

    // Run force cleanup for all hooks
    await this.runForceCleanup();

    // Complete shutdown
    this.completeShutdown();

    this.log('warn', `Force shutdown completed: ${reason}`);
  }

  /**
   * Get shutdown status
   */
  getStatus(): ShutdownStatus {
    return {
      state: this.state,
      reason: this.state !== 'running' ? 'shutdown' : undefined,
      initiatedAt: this.initiatedAt,
      completedAt: this.completedAt,
      duration: this.completedAt ? this.completedAt - this.initiatedAt : undefined,
      hooksExecuted: this.hooks.length - this.errors.length,
      hooksTotal: this.hooks.length,
      errors: this.errors,
      forced: false,
    };
  }

  /**
   * Check if shutdown is in progress
   */
  isShuttingDown(): boolean {
    return this.state !== 'running';
  }

  /**
   * Check if shutdown is complete
   */
  isShutdownComplete(): boolean {
    return this.state === 'complete' || this.state === 'failed';
  }

  /**
   * Dispose of shutdown handler
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Remove signal handlers
    for (const [signal, handler] of this.signalHandlers) {
      if (typeof process !== 'undefined') {
        process.removeListener(signal, handler);
      }
    }

    this.signalHandlers.clear();
    this.hooks = [];
    this.inFlightRequests.clear();
  }

  private async performShutdown(reason: string): Promise<void> {
    if (this.state !== 'running') {
      this.log('warn', 'Shutdown already in progress');
      return;
    }

    this.initiatedAt = Date.now();
    this.state = 'initiated';

    this.log('info', `Shutdown initiated: ${reason}`);

    try {
      // Phase 1: Drain connections
      await this.drainConnections();

      // Phase 2: Run cleanup hooks
      await this.runCleanup();

      // Phase 3: Persist state if enabled
      if (this.options.persistState) {
        await this.persistState();
      }

      // Complete shutdown
      this.completeShutdown();

      this.log('info', `Shutdown completed: ${reason} (${this.completedAt - this.initiatedAt}ms)`);

      // Resolve promise if waiting
      if (this.resolveShutdown) {
        this.resolveShutdown();
      }
    } catch (error) {
      this.state = 'failed';
      this.completedAt = Date.now();

      this.log('error', `Shutdown failed: ${error}`);

      // Resolve promise even on failure
      if (this.resolveShutdown) {
        this.resolveShutdown();
      }

      throw error;
    }
  }

  private async drainConnections(): Promise<void> {
    this.state = 'draining';

    this.log('info', `Draining connections (${this.inFlightRequests.size} in-flight)`);

    const startTime = Date.now();
    const checkInterval = 100;

    // Wait for in-flight requests to complete or timeout
    while (this.inFlightRequests.size > 0) {
      const elapsed = Date.now() - startTime;

      if (elapsed > this.options.drainTimeout) {
        this.log(
          'warn',
          `Drain timeout reached with ${this.inFlightRequests.size} requests remaining`
        );

        // Log remaining requests
        for (const request of this.inFlightRequests.values()) {
          const duration = Date.now() - request.startTime;
          this.log('warn', `Remaining request: ${request.id} (${duration}ms)`);
        }

        break;
      }

      this.log('debug', `Waiting for ${this.inFlightRequests.size} requests to complete`);

      await delay(checkInterval);
    }

    this.log('info', 'Connection draining completed');
  }

  private async runCleanup(): Promise<void> {
    this.state = 'cleanup';

    this.log('info', `Running cleanup hooks (${this.hooks.length} hooks)`);

    const startTime = Date.now();

    for (const hook of this.hooks) {
      const hookStartTime = Date.now();

      try {
        this.log('debug', `Running cleanup hook: ${hook.name}`);

        // Run with timeout
        await Promise.race([
          hook.cleanup(),
          delay(hook.timeout).then(() => {
            throw new Error(`Cleanup hook ${hook.name} timeout after ${hook.timeout}ms`);
          }),
        ]);

        const duration = Date.now() - hookStartTime;
        this.log('debug', `Cleanup hook completed: ${hook.name} (${duration}ms)`);
      } catch (error) {
        const duration = Date.now() - hookStartTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        this.log('error', `Cleanup hook failed: ${hook.name} (${duration}ms) - ${errorMessage}`);

        this.errors.push({
          hook: hook.name,
          error: errorMessage,
        });

        // Try force cleanup if available
        if (hook.forceCleanup) {
          try {
            this.log('warn', `Attempting force cleanup: ${hook.name}`);
            await hook.forceCleanup();
            this.log('info', `Force cleanup succeeded: ${hook.name}`);
          } catch (forceError) {
            this.log('error', `Force cleanup failed: ${hook.name}`);
          }
        }
      }

      // Check if we've exceeded total timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > this.options.forceTimeout) {
        this.log('warn', 'Force timeout reached, forcing shutdown');
        await this.runForceCleanup();
        break;
      }
    }

    this.log('info', `Cleanup hooks completed (${Date.now() - startTime}ms)`);
  }

  private async runForceCleanup(): Promise<void> {
    this.log('warn', 'Running force cleanup for remaining hooks');

    for (const hook of this.hooks) {
      if (hook.forceCleanup) {
        try {
          await Promise.race([
            hook.forceCleanup(),
            delay(1000).then(() => {
              // Force cleanup has short timeout
              throw new Error('Force cleanup timeout');
            }),
          ]);
        } catch (error) {
          this.log('error', `Force cleanup failed: ${hook.name}`);
        }
      }
    }
  }

  private async persistState(): Promise<void> {
    this.log('debug', 'Persisting state');

    try {
      // Implement state persistence based on environment
      // For Cloudflare Workers, this would be to KV or Durable Objects

      const state = {
        shutdownTime: Date.now(),
        inFlightRequests: Array.from(this.inFlightRequests.values()).map((r) => ({
          id: r.id,
          type: r.type,
          duration: Date.now() - r.startTime,
        })),
        errors: this.errors,
      };

      // Persist state (implementation depends on environment)
      this.log('debug', 'State persisted', state);
    } catch (error) {
      this.log('error', `Failed to persist state: ${error}`);
    }
  }

  private completeShutdown(): void {
    this.completedAt = Date.now();
    this.state = 'complete';

    // Clear in-flight requests
    this.inFlightRequests.clear();
  }

  private setupSignalHandlers(): void {
    const signals = ['SIGTERM', 'SIGINT'];

    for (const signal of signals) {
      const handler = () => {
        this.log('info', `Received signal: ${signal}`);
        this.shutdown(signal).catch((error) => {
          this.log('error', `Shutdown failed on signal ${signal}: ${error}`);
          process.exit(1);
        });
      };

      process.on(signal as NodeJS.Signals, handler);
      this.signalHandlers.set(signal, handler);
    }

    this.log('debug', `Signal handlers registered: ${signals.join(', ')}`);
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('ShutdownHandler has been disposed');
    }
  }

  private assertNotShutdown(): void {
    if (this.state !== 'running') {
      throw new Error('Shutdown has been initiated');
    }
  }

  private log(level: string, message: string, data?: unknown): void {
    const shouldLog = this.shouldLog(level);

    if (!shouldLog) {
      return;
    }

    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(data !== undefined && { data }),
    };

    // Log based on environment
    if (typeof console !== 'undefined') {
      switch (level) {
        case 'debug':
          console.debug('[ShutdownHandler]', logEntry);
          break;
        case 'info':
          console.info('[ShutdownHandler]', logEntry);
          break;
        case 'warn':
          console.warn('[ShutdownHandler]', logEntry);
          break;
        case 'error':
          console.error('[ShutdownHandler]', logEntry);
          break;
      }
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.options.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }
}

/**
 * Create a shutdown handler with default cleanup hooks
 */
export function createShutdownHandler(
  options?: ShutdownHandlerOptions
): ShutdownHandler {
  const handler = new ShutdownHandler(options);

  // Register default cleanup hooks
  handler.registerCleanup({
    name: 'connections',
    priority: 100,
    timeout: 5000,
    cleanup: async () => {
      // Close connections
    },
  });

  handler.registerCleanup({
    name: 'state',
    priority: 90,
    timeout: 3000,
    cleanup: async () => {
      // Flush state
    },
  });

  handler.registerCleanup({
    name: 'logs',
    priority: 80,
    timeout: 2000,
    cleanup: async () => {
      // Flush logs
    },
  });

  return handler;
}

/**
 * Global shutdown handler instance
 */
let globalShutdownHandler: ShutdownHandler | null = null;

/**
 * Get or create global shutdown handler
 */
export function getGlobalShutdownHandler(
  options?: ShutdownHandlerOptions
): ShutdownHandler {
  if (!globalShutdownHandler) {
    globalShutdownHandler = new ShutdownHandler(options);
  }

  return globalShutdownHandler;
}

/**
 * Setup global shutdown hooks
 */
export function setupGlobalShutdown(options?: ShutdownHandlerOptions): void {
  const handler = getGlobalShutdownHandler(options);

  if (typeof process !== 'undefined') {
    process.on('beforeExit', async () => {
      await handler.shutdown('beforeExit');
    });

    process.on('exit', (code) => {
      console.log(`Process exiting with code ${code}`);
    });
  }
}
