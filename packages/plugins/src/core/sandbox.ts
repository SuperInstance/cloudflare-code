/**
 * WASM-based sandbox for secure plugin execution
 */

import type {
  SandboxConfig,
  PluginContext,
  SecurityContext,
} from '../types';
import { PluginSandboxError } from '../types/errors';

/**
 * WASM module wrapper
 */
interface WASMModule {
  instance: WebAssembly.Instance;
  memory: WebAssembly.Memory;
  exports: Record<string, unknown>;
}

/**
 * Sandbox execution result
 */
export interface SandboxResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  executionTime: number;
  memoryUsed: number;
  cpuTime: number;
}

/**
 * Sandbox statistics
 */
export interface SandboxStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalCpuTime: number;
  totalWallTime: number;
  peakMemoryUsage: number;
  averageExecutionTime: number;
}

/**
 * WASM Sandbox implementation
 */
export class WASMSandbox {
  private config: SandboxConfig;
  private module?: WASMModule;
  private stats: SandboxStats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalCpuTime: 0,
    totalWallTime: 0,
    peakMemoryUsage: 0,
    averageExecutionTime: 0,
  };

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = {
      memoryLimit: 64, // 64 MB default
      cpuTimeLimit: 5000, // 5 seconds default
      wallTimeLimit: 10000, // 10 seconds default
      allowedModules: [],
      blockedModules: ['fs', 'child_process', 'cluster'],
      networkAccess: false,
      allowedDomains: [],
      fsAccess: false,
      allowedPaths: [],
      envVars: {},
      ...config,
    };
  }

  /**
   * Load WASM module
   */
  async loadModule(wasmBytes: ArrayBuffer): Promise<void> {
    const startTime = Date.now();

    try {
      // Create WASM module with memory limits
      const memory = new WebAssembly.Memory({
        initial: this.config.memoryLimit / 64, // WebAssembly pages are 64KB
        maximum: this.config.memoryLimit / 64,
      });

      const module = await WebAssembly.compile(wasmBytes);
      const instance = await WebAssembly.instantiate(module, {
        env: this.createWasmImports(memory),
      });

      this.module = {
        instance,
        memory,
        exports: instance.exports as Record<string, unknown>,
      };

      this.recordSuccess(Date.now() - startTime, 0, 0);
    } catch (error) {
      this.recordFailure();
      throw new PluginSandboxError(
        'unknown',
        `Failed to load WASM module: ${(error as Error).message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Execute function in sandbox
   */
  async execute<T = unknown>(
    functionName: string,
    args: unknown[],
    context?: PluginContext,
    securityContext?: SecurityContext
  ): Promise<SandboxResult<T>> {
    if (!this.module) {
      throw new PluginSandboxError('unknown', 'No WASM module loaded');
    }

    const func = this.module.exports[functionName];
    if (typeof func !== 'function') {
      throw new PluginSandboxError('unknown', `Function ${functionName} not found in WASM module`);
    }

    const startTime = Date.now();
    const startMemory = this.getMemoryUsage();

    try {
      // Set up timeout monitoring
      const timeoutId = this.setupTimeout(this.config.wallTimeLimit);

      // Prepare execution context
      const execContext = this.prepareExecutionContext(context, securityContext);

      // Execute function
      const result = await (func as (...args: unknown[]) => unknown)(
        ...args,
        execContext
      );

      // Clear timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const executionTime = Date.now() - startTime;
      const memoryUsed = this.getMemoryUsage() - startMemory;

      // Check limits
      this.checkLimits(executionTime, memoryUsed);

      // Record success
      this.recordSuccess(executionTime, memoryUsed, executionTime);

      return {
        success: true,
        data: result as T,
        executionTime,
        memoryUsed,
        cpuTime: executionTime, // Approximation
      };
    } catch (error) {
      this.recordFailure();
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
        memoryUsed: 0,
        cpuTime: 0,
      };
    }
  }

  /**
   * Execute JavaScript code in sandbox
   */
  async executeJS<T = unknown>(
    code: string,
    context?: PluginContext,
    securityContext?: SecurityContext
  ): Promise<SandboxResult<T>> {
    const startTime = Date.now();
    const startMemory = this.getMemoryUsage();

    try {
      // Create isolated context
      const isolatedContext = this.createIsolatedContext(context, securityContext);

      // Create AsyncFunction with isolated context
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction(
        ...Object.keys(isolatedContext),
        `
        'use strict';
        ${code}
        `
      );

      // Set up timeout
      const timeoutId = this.setupTimeout(this.config.wallTimeLimit);

      // Execute
      const result = await fn(...Object.values(isolatedContext));

      // Clear timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const executionTime = Date.now() - startTime;
      const memoryUsed = this.getMemoryUsage() - startMemory;

      // Check limits
      this.checkLimits(executionTime, memoryUsed);

      this.recordSuccess(executionTime, memoryUsed, executionTime);

      return {
        success: true,
        data: result as T,
        executionTime,
        memoryUsed,
        cpuTime: executionTime,
      };
    } catch (error) {
      this.recordFailure();
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
        memoryUsed: 0,
        cpuTime: 0,
      };
    }
  }

  /**
   * Create WASM imports
   */
  private createWasmImports(memory: WebAssembly.Memory): Record<string, unknown> {
    return {
      memory,
      // Console logging (limited)
      log: (ptr: number, len: number) => {
        const bytes = new Uint8Array(memory.buffer, ptr, len);
        const message = new TextDecoder().decode(bytes);
        console.log(`[WASM Sandbox] ${message}`);
      },
      // System time
      time: () => Date.now(),
      // Random numbers
      random: () => Math.random(),
      // Abort
      abort: () => {
        throw new PluginSandboxError('unknown', 'WASM module aborted');
      },
    };
  }

  /**
   * Create isolated execution context
   */
  private createIsolatedContext(
    pluginContext?: PluginContext,
    securityContext?: SecurityContext
  ): Record<string, unknown> {
    const context: Record<string, unknown> = {
      // Safe built-ins
      console: this.createSafeConsole(),
      Math,
      Date,
      JSON,
      Promise,
      setTimeout: this.config.cpuTimeLimit > 0 ? setTimeout : undefined,
      clearTimeout,
      setInterval: this.config.cpuTimeLimit > 0 ? setInterval : undefined,
      clearInterval,
      // Safe globals
      undefined,
      null: null,
      NaN,
      Infinity,
      isNaN,
      isFinite,
      parseFloat,
      parseInt,
      decodeURI,
      decodeURIComponent,
      encodeURI,
      encodeURIComponent,
      Object,
      Array,
      String,
      Number,
      Boolean,
      Error,
      TypeError,
      RangeError,
      SyntaxError,
      ReferenceError,
      Map,
      Set,
      WeakMap,
      WeakSet,
      ArrayBuffer,
      Uint8Array,
      Int8Array,
      Uint16Array,
      Int16Array,
      Uint32Array,
      Int32Array,
      Float32Array,
      Float64Array,
      BigInt,
      BigInt64Array,
      BigUint64Array,
    };

    // Add context if provided and allowed
    if (pluginContext) {
      if (this.config.networkAccess) {
        context.fetch = this.createSafeFetch(pluginContext, securityContext);
      }
      context.storage = this.createSafeStorage(pluginContext);
    }

    // Add safe environment variables
    context.env = { ...this.config.envVars };

    return context;
  }

  /**
   * Create safe console
   */
  private createSafeConsole() {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const shouldLog = (level: string) => {
      const levels = ['debug', 'info', 'warn', 'error'];
      return levels.indexOf(level) >= levels.indexOf(logLevel);
    };

    return {
      debug: (...args: unknown[]) => {
        if (shouldLog('debug')) console.debug('[Sandbox]', ...args);
      },
      log: (...args: unknown[]) => {
        if (shouldLog('info')) console.log('[Sandbox]', ...args);
      },
      info: (...args: unknown[]) => {
        if (shouldLog('info')) console.info('[Sandbox]', ...args);
      },
      warn: (...args: unknown[]) => {
        if (shouldLog('warn')) console.warn('[Sandbox]', ...args);
      },
      error: (...args: unknown[]) => {
        if (shouldLog('error')) console.error('[Sandbox]', ...args);
      },
    };
  }

  /**
   * Create safe fetch
   */
  private createSafeFetch(
    pluginContext: PluginContext,
    securityContext?: SecurityContext
  ) {
    return async (url: string, options?: RequestInit) => {
      if (!this.config.networkAccess) {
        throw new Error('Network access is disabled in this sandbox');
      }

      // Check domain whitelist
      if (this.config.allowedDomains && this.config.allowedDomains.length > 0) {
        const urlObj = new URL(url);
        if (!this.config.allowedDomains.includes(urlObj.hostname)) {
          throw new Error(`Domain ${urlObj.hostname} is not allowed`);
        }
      }

      // Add security context to headers
      const headers: HeadersInit = {
        ...options?.headers,
      };

      if (securityContext?.userId) {
        headers['X-User-Id'] = securityContext.userId;
      }
      if (securityContext?.sessionId) {
        headers['X-Session-Id'] = securityContext.sessionId;
      }

      return fetch(url, { ...options, headers });
    };
  }

  /**
   * Create safe storage
   */
  private createSafeStorage(pluginContext: PluginContext) {
    const storage = pluginContext.storage;
    const pluginId = pluginContext.pluginId;

    return {
      async get(key: string): Promise<unknown> {
        // Prefix keys with plugin ID for isolation
        const isolatedKey = `${pluginId}:${key}`;
        return storage.get(isolatedKey);
      },
      async set(key: string, value: unknown, ttl?: number): Promise<void> {
        const isolatedKey = `${pluginId}:${key}`;
        return storage.set(isolatedKey, value, ttl);
      },
      async delete(key: string): Promise<void> {
        const isolatedKey = `${pluginId}:${key}`;
        return storage.delete(isolatedKey);
      },
      async list(prefix?: string): Promise<string[]> {
        const isolatedPrefix = prefix ? `${pluginId}:${prefix}` : pluginId;
        const keys = await storage.list(isolatedPrefix);
        // Remove plugin prefix from returned keys
        return keys.map((k) => k.replace(`${pluginId}:`, ''));
      },
      async clear(prefix?: string): Promise<void> {
        const isolatedPrefix = prefix ? `${pluginId}:${prefix}` : pluginId;
        return storage.clear(isolatedPrefix);
      },
    };
  }

  /**
   * Prepare execution context for WASM
   */
  private prepareExecutionContext(
    pluginContext?: PluginContext,
    securityContext?: SecurityContext
  ): number {
    // Create context object and return pointer to it
    // This is a simplified implementation
    // In a real implementation, you'd serialize the context to WASM memory
    return 0;
  }

  /**
   * Setup timeout
   */
  private setupTimeout(timeout: number): ReturnType<typeof setTimeout> | undefined {
    if (timeout <= 0) return undefined;

    return setTimeout(() => {
      throw new PluginSandboxError(
        'unknown',
        `Sandbox execution timeout (${timeout}ms exceeded)`
      );
    }, timeout);
  }

  /**
   * Check execution limits
   */
  private checkLimits(executionTime: number, memoryUsed: number): void {
    if (executionTime > this.config.wallTimeLimit) {
      throw new PluginSandboxError(
        'unknown',
        `Wall time limit exceeded: ${executionTime}ms > ${this.config.wallTimeLimit}ms`
      );
    }

    if (executionTime > this.config.cpuTimeLimit) {
      throw new PluginSandboxError(
        'unknown',
        `CPU time limit exceeded: ${executionTime}ms > ${this.config.cpuTimeLimit}ms`
      );
    }

    const currentMemory = this.getMemoryUsage();
    if (currentMemory > this.config.memoryLimit * 1024 * 1024) {
      throw new PluginSandboxError(
        'unknown',
        `Memory limit exceeded: ${currentMemory} bytes > ${this.config.memoryLimit}MB`
      );
    }
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    if (this.module?.memory) {
      return this.module.memory.buffer.byteLength;
    }
    return 0;
  }

  /**
   * Record successful execution
   */
  private recordSuccess(
    wallTime: number,
    memoryUsed: number,
    cpuTime: number
  ): void {
    this.stats.totalExecutions++;
    this.stats.successfulExecutions++;
    this.stats.totalWallTime += wallTime;
    this.stats.totalCpuTime += cpuTime;
    this.stats.peakMemoryUsage = Math.max(this.stats.peakMemoryUsage, memoryUsed);
    this.stats.averageExecutionTime =
      this.stats.totalWallTime / this.stats.totalExecutions;
  }

  /**
   * Record failed execution
   */
  private recordFailure(): void {
    this.stats.totalExecutions++;
    this.stats.failedExecutions++;
  }

  /**
   * Get sandbox statistics
   */
  getStats(): SandboxStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalCpuTime: 0,
      totalWallTime: 0,
      peakMemoryUsage: 0,
      averageExecutionTime: 0,
    };
  }

  /**
   * Get sandbox configuration
   */
  getConfig(): SandboxConfig {
    return { ...this.config };
  }

  /**
   * Update sandbox configuration
   */
  updateConfig(updates: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Cleanup sandbox
   */
  async cleanup(): Promise<void> {
    this.module = undefined;
    this.resetStats();
  }
}

/**
 * Create default sandbox config for plugin type
 */
export function createDefaultSandboxConfig(
  pluginType: string,
  capabilities?: {
    sandboxed?: boolean;
    networkAccess?: boolean;
    fsAccess?: boolean;
    dbAccess?: boolean;
  }
): Partial<SandboxConfig> {
  const baseConfig: Partial<SandboxConfig> = {
    memoryLimit: 64,
    cpuTimeLimit: 5000,
    wallTimeLimit: 10000,
    allowedModules: [],
    blockedModules: ['fs', 'child_process', 'cluster'],
    networkAccess: false,
    fsAccess: false,
    envVars: {},
  };

  // Adjust based on plugin type
  switch (pluginType) {
    case 'ai_provider':
      return {
        ...baseConfig,
        memoryLimit: 128,
        cpuTimeLimit: 30000,
        wallTimeLimit: 60000,
        networkAccess: capabilities?.networkAccess ?? true,
      };

    case 'storage':
      return {
        ...baseConfig,
        memoryLimit: 256,
        cpuTimeLimit: 10000,
        wallTimeLimit: 20000,
        networkAccess: capabilities?.networkAccess ?? true,
        dbAccess: capabilities?.dbAccess ?? true,
      };

    case 'webhook':
      return {
        ...baseConfig,
        memoryLimit: 32,
        cpuTimeLimit: 3000,
        wallTimeLimit: 5000,
        networkAccess: true,
      };

    case 'agent':
      return {
        ...baseConfig,
        memoryLimit: 256,
        cpuTimeLimit: 60000,
        wallTimeLimit: 120000,
        networkAccess: capabilities?.networkAccess ?? true,
      };

    default:
      return baseConfig;
  }
}
