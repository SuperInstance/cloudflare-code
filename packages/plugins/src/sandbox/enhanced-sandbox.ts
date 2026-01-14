/**
 * Enhanced Sandbox - Advanced plugin execution environment
 *
 * Features:
 * - Web Worker isolation
 * - Durable Object state management
 * - Permission enforcement
 * - Resource limiting
 * - API exposure control
 * - Secure communication channels
 * - Audit logging
 * - Performance monitoring
 */

import { createLogger } from '../utils/logger';
import type { PermissionManager } from '../permissions';
import type { SecurityContext } from '../types';

const logger = createLogger('EnhancedSandbox');

// ============================================================================
// Types
// ============================================================================

export interface SandboxConfig {
  // Resource limits
  maxMemory?: number;
  maxCpuTime?: number;
  maxWallTime?: number;
  maxExecutionTime?: number;

  // Security
  permissions?: string[];
  allowedDomains?: string[];
  blockedDomains?: string[];
  allowedModules?: string[];
  blockedModules?: string[];

  // Networking
  networkAccess?: boolean;
  outboundRoutes?: string[];

  // Storage
  storageAccess?: boolean;
  storagePrefix?: string;

  // Environment
  envVars?: Record<string, string>;
  exposeEnv?: string[];

  // Monitoring
  enableProfiling?: boolean;
  enableTracing?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface SandboxContext {
  pluginId: string;
  sandboxId: string;
  permissions: PermissionManager;
  security: SecurityContext;
  config: SandboxConfig;
}

export interface ExecutionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
  metrics: ExecutionMetrics;
  logs: LogEntry[];
}

export interface ExecutionMetrics {
  executionTime: number;
  cpuTime: number;
  memoryUsed: number;
  memoryPeak: number;
  networkRequests: number;
  storageOperations: number;
  functionCalls: number;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

export interface WorkerMessage {
  id: string;
  type: 'execute' | 'terminate' | 'ping' | 'stats';
  payload?: unknown;
}

export interface WorkerResponse {
  id: string;
  type: 'result' | 'error' | 'pong' | 'stats';
  payload?: unknown;
}

// ============================================================================
// Worker-Based Sandbox
// ============================================================================

export class WorkerSandbox {
  private worker: Worker | null = null;
  private context: SandboxContext;
  private active = false;
  private executionCount = 0;
  private messageHandlers: Map<string, (response: WorkerResponse) => void> = new Map();

  constructor(context: SandboxContext) {
    this.context = context;
  }

  /**
   * Initialize the sandbox worker
   */
  async initialize(): Promise<void> {
    if (this.worker) {
      throw new Error('Sandbox already initialized');
    }

    const workerCode = this.createWorkerScript();
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    this.worker = new Worker(workerUrl, {
      type: 'module'
    });

    this.worker.onmessage = (event: MessageEvent) => {
      this.handleWorkerMessage(event.data);
    };

    this.worker.onerror = (error: ErrorEvent) => {
      logger.error('Worker error', { error });
      this.terminate();
    };

    this.active = true;

    logger.info('Sandbox initialized', {
      pluginId: this.context.pluginId,
      sandboxId: this.context.sandboxId
    });
  }

  /**
   * Execute code in the sandbox
   */
  async execute<T = unknown>(
    code: string,
    options: {
      timeout?: number;
      context?: Record<string, unknown>;
      transfer?: Transferable[];
    } = {}
  ): Promise<ExecutionResult<T>> {
    if (!this.worker || !this.active) {
      throw new Error('Sandbox not initialized');
    }

    const executionId = this.generateExecutionId();
    const startTime = Date.now();

    try {
      // Check permissions before execution
      await this.checkExecutionPermissions(code);

      // Send execution request to worker
      const message: WorkerMessage = {
        id: executionId,
        type: 'execute',
        payload: {
          code,
          context: options.context,
          timeout: options.timeout || this.context.config.maxExecutionTime,
          config: this.getWorkerConfig()
        }
      };

      const response = await this.sendMessage(message, options.timeout);

      this.executionCount++;

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: response.payload as T,
        metrics: {
          executionTime,
          cpuTime: 0, // Worker doesn't expose CPU time
          memoryUsed: 0,
          memoryPeak: 0,
          networkRequests: 0,
          storageOperations: 0,
          functionCalls: 0
        },
        logs: response.logs || []
      };
    } catch (error) {
      logger.error('Execution failed', {
        pluginId: this.context.pluginId,
        executionId,
        error
      });

      return {
        success: false,
        error: error as Error,
        metrics: {
          executionTime: Date.now() - startTime,
          cpuTime: 0,
          memoryUsed: 0,
          memoryPeak: 0,
          networkRequests: 0,
          storageOperations: 0,
          functionCalls: 0
        },
        logs: []
      };
    }
  }

  /**
   * Terminate the sandbox
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.active = false;
      this.messageHandlers.clear();

      logger.info('Sandbox terminated', {
        pluginId: this.context.pluginId,
        sandboxId: this.context.sandboxId,
        executionCount: this.executionCount
      });
    }
  }

  /**
   * Check if sandbox is active
   */
  isActive(): boolean {
    return this.active && this.worker !== null;
  }

  /**
   * Get sandbox statistics
   */
  getStats(): {
    active: boolean;
    executionCount: number;
    memoryUsage?: number;
  } {
    return {
      active: this.active,
      executionCount: this.executionCount
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private createWorkerScript(): string {
    return `
      // Sandboxed execution environment
      let executionTimeout = null;

      // Restricted global scope
      const restrictedGlobal = {
        console: createRestrictedConsole(),
        setTimeout: null,
        setInterval: null,
        setImmediate: null,
        require: null,
        import: null,
        fetch: null,
        WebSocket: null,
        XMLHttpRequest: null,
        process: null,
        Buffer: null,
        global: null,
        window: null,
        document: null,
        localStorage: null,
        sessionStorage: null,
        indexedDB: null,
        caches: null
      };

      function createRestrictedConsole() {
        const logQueue = [];
        return {
          debug: (...args) => logQueue.push({ level: 'debug', args }),
          info: (...args) => logQueue.push({ level: 'info', args }),
          warn: (...args) => logQueue.push({ level: 'warn', args }),
          error: (...args) => logQueue.push({ level: 'error', args }),
          getLogs: () => logQueue
        };
      }

      // Message handler
      self.onmessage = async (event) => {
        const message = event.data;

        if (message.type === 'execute') {
          await handleExecute(message);
        } else if (message.type === 'terminate') {
          self.close();
        } else if (message.type === 'ping') {
          self.postMessage({ id: message.id, type: 'pong' });
        } else if (message.type === 'stats') {
          self.postMessage({
            id: message.id,
            type: 'stats',
            payload: { memoryUsage: self.performance?.memory?.usedJSHeapSize }
          });
        }
      };

      async function handleExecute(message) {
        const { code, context, timeout, config } = message.payload;
        const startTime = Date.now();
        let timeoutId = null;

        try {
          // Set timeout
          if (timeout) {
            timeoutId = setTimeout(() => {
              throw new Error('Execution timeout');
            }, timeout);
          }

          // Create execution context
          const executionContext = { ...restrictedGlobal, ...context };

          // Create function with restricted scope
          const fn = new Function(...Object.keys(executionContext), \`
            "use strict";
            \${code}
          \`);

          // Execute
          const result = await fn(...Object.values(executionContext));

          // Clear timeout
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          // Get logs
          const logs = restrictedGlobal.console.getLogs().map(entry => ({
            level: entry.level,
            message: entry.args.map(arg =>
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' '),
            timestamp: new Date()
          }));

          // Send result
          self.postMessage({
            id: message.id,
            type: 'result',
            payload: result,
            logs,
            executionTime: Date.now() - startTime
          });
        } catch (error) {
          // Clear timeout
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          // Send error
          self.postMessage({
            id: message.id,
            type: 'error',
            payload: {
              name: error.name,
              message: error.message,
              stack: error.stack
            }
          });
        }
      }
    `;
  }

  private async sendMessage(
    message: WorkerMessage,
    timeout?: number
  ): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.messageHandlers.delete(message.id);
        reject(new Error('Message timeout'));
      }, timeout || 30000);

      this.messageHandlers.set(message.id, (response: WorkerResponse) => {
        clearTimeout(timeoutId);
        if (response.type === 'error') {
          reject(new Error(response.payload as string));
        } else {
          resolve(response);
        }
      });

      this.worker!.postMessage(message);
    });
  }

  private handleWorkerMessage(response: WorkerResponse): void {
    const handler = this.messageHandlers.get(response.id);
    if (handler) {
      handler(response);
      this.messageHandlers.delete(response.id);
    }
  }

  private async checkExecutionPermissions(code: string): Promise<void> {
    // Check for dangerous patterns
    const dangerousPatterns = [
      /require\s*\(/,
      /import\s+/,
      /eval\s*\(/,
      /Function\s*\(/,
      /process\./,
      /child_process/,
      /fs\./,
      /\.exec\s*\(/,
      /\.spawn\s*\(/,
      /__proto__/,
      /constructor\s*\[/,
      /<script>/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error(`Code contains dangerous pattern: ${pattern.source}`);
      }
    }

    // Check network access permission
    if (code.includes('fetch') || code.includes('XMLHttpRequest')) {
      const hasPermission = await this.context.permissions.checkPermission(
        this.context.pluginId,
        'network.https'
      );
      if (!hasPermission) {
        throw new Error('Plugin does not have network access permission');
      }
    }

    // Check storage access permission
    if (code.includes('localStorage') || code.includes('sessionStorage')) {
      const hasPermission = await this.context.permissions.checkPermission(
        this.context.pluginId,
        'storage.kv'
      );
      if (!hasPermission) {
        throw new Error('Plugin does not have storage access permission');
      }
    }
  }

  private getWorkerConfig(): Record<string, unknown> {
    return {
      maxMemory: this.context.config.maxMemory,
      maxCpuTime: this.context.config.maxCpuTime,
      networkAccess: this.context.config.networkAccess,
      allowedDomains: this.context.config.allowedDomains,
      blockedDomains: this.context.config.blockedDomains,
      storageAccess: this.context.config.storageAccess,
      storagePrefix: this.context.config.storagePrefix,
      envVars: this.context.config.envVars,
      exposeEnv: this.context.config.exposeEnv
    };
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Durable Object Sandbox
// ============================================================================

export class DurableObjectSandbox {
  private context: SandboxContext;
  private state: Map<string, unknown> = new Map();
  private executionCount = 0;
  private metrics: ExecutionMetrics = {
    executionTime: 0,
    cpuTime: 0,
    memoryUsed: 0,
    memoryPeak: 0,
    networkRequests: 0,
    storageOperations: 0,
    functionCalls: 0
  };

  constructor(context: SandboxContext) {
    this.context = context;
  }

  /**
   * Initialize the sandbox
   */
  async initialize(): Promise<void> {
    logger.info('Durable Object sandbox initialized', {
      pluginId: this.context.pluginId,
      sandboxId: this.context.sandboxId
    });
  }

  /**
   * Execute code in the sandbox
   */
  async execute<T = unknown>(
    code: string,
    options: {
      timeout?: number;
      context?: Record<string, unknown>;
    } = {}
  ): Promise<ExecutionResult<T>> {
    const startTime = Date.now();
    const logs: LogEntry[] = [];

    try {
      // Create restricted console
      const sandboxConsole = {
        debug: (message: string, context?: Record<string, unknown>) => {
          logs.push({ level: 'debug', message, timestamp: new Date(), context });
        },
        info: (message: string, context?: Record<string, unknown>) => {
          logs.push({ level: 'info', message, timestamp: new Date(), context });
        },
        warn: (message: string, context?: Record<string, unknown>) => {
          logs.push({ level: 'warn', message, timestamp: new Date(), context });
        },
        error: (message: string, context?: Record<string, unknown>) => {
          logs.push({ level: 'error', message, timestamp: new Date(), context });
        }
      };

      // Create execution context
      const executionContext: Record<string, unknown> = {
        console: sandboxConsole,
        state: this.state,
        ...options.context
      };

      // Create async function
      const fn = new Function(
        ...Object.keys(executionContext),
        `"use strict"; return (${code})`
      );

      // Execute with timeout
      const timeout = options.timeout || this.context.config.maxExecutionTime || 30000;
      const result = await this.withTimeout(fn(...Object.values(executionContext)), timeout);

      this.executionCount++;
      this.metrics.executionTime += Date.now() - startTime;
      this.metrics.functionCalls++;

      return {
        success: true,
        data: result as T,
        metrics: { ...this.metrics },
        logs
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        metrics: { ...this.metrics },
        logs
      };
    }
  }

  /**
   * Get sandbox state
   */
  getState(): Map<string, unknown> {
    return new Map(this.state);
  }

  /**
   * Set sandbox state
   */
  setState(state: Map<string, unknown>): void {
    this.state = new Map(state);
  }

  /**
   * Get statistics
   */
  getStats(): {
    executionCount: number;
    metrics: ExecutionMetrics;
  } {
    return {
      executionCount: this.executionCount,
      metrics: { ...this.metrics }
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.executionCount = 0;
    this.metrics = {
      executionTime: 0,
      cpuTime: 0,
      memoryUsed: 0,
      memoryPeak: 0,
      networkRequests: 0,
      storageOperations: 0,
      functionCalls: 0
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error('Execution timeout'));
      }, timeout);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutHandle!);
      return result;
    } catch (error) {
      clearTimeout(timeoutHandle!);
      throw error;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createWorkerSandbox(
  pluginId: string,
  permissions: PermissionManager,
  security: SecurityContext,
  config: SandboxConfig = {}
): WorkerSandbox {
  const sandboxId = `worker_${pluginId}_${Date.now()}`;
  const context: SandboxContext = {
    pluginId,
    sandboxId,
    permissions,
    security,
    config: {
      maxMemory: 128 * 1024 * 1024, // 128MB
      maxCpuTime: 5000, // 5 seconds
      maxExecutionTime: 30000, // 30 seconds
      networkAccess: false,
      storageAccess: false,
      logLevel: 'info',
      ...config
    }
  };

  return new WorkerSandbox(context);
}

export function createDurableObjectSandbox(
  pluginId: string,
  permissions: PermissionManager,
  security: SecurityContext,
  config: SandboxConfig = {}
): DurableObjectSandbox {
  const sandboxId = `durable_${pluginId}_${Date.now()}`;
  const context: SandboxContext = {
    pluginId,
    sandboxId,
    permissions,
    security,
    config: {
      maxMemory: 128 * 1024 * 1024,
      maxExecutionTime: 30000,
      networkAccess: false,
      storageAccess: true,
      storagePrefix: `plugin_${pluginId}_`,
      logLevel: 'info',
      ...config
    }
  };

  return new DurableObjectSandbox(context);
}

// ============================================================================
// Exports
// ============================================================================

export default {
  WorkerSandbox,
  DurableObjectSandbox,
  createWorkerSandbox,
  createDurableObjectSandbox
};
