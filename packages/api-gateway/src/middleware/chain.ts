/**
 * Middleware Chain
 *
 * Provides a flexible middleware system for the API Gateway with:
 * - Pre-request middleware
 * - Post-request middleware
 * - Error handling middleware
 * - Conditional middleware execution
 * - Middleware composition
 *
 * Features:
 * - Async middleware support
 * - Request/response transformation
 * - Early termination
 * - Error propagation
 * - Context sharing
 */

import type { GatewayRequest, GatewayResponse, GatewayContext } from '../types';

/**
 * Middleware function
 */
export type MiddlewareFunction = (
  request: GatewayRequest,
  context: GatewayContext,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Middleware definition
 */
export interface Middleware {
  name: string;
  execute: MiddlewareFunction;
  condition?: MiddlewareCondition;
  priority?: number;
}

/**
 * Middleware condition
 */
export interface MiddlewareCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'exists' | 'in';
  value?: unknown;
  scope?: 'header' | 'query' | 'path' | 'method';
}

/**
 * Middleware execution result
 */
interface MiddlewareResult {
  executed: boolean;
  terminated: boolean;
  error?: Error;
}

/**
 * Middleware Chain
 */
export class MiddlewareChain {
  private preRequest: Middleware[];
  private postRequest: Middleware[];
  private errorHandlers: Map<string, MiddlewareFunction>;
  private context: Map<string, unknown>;

  constructor() {
    this.preRequest = [];
    this.postRequest = [];
    this.errorHandlers = new Map();
    this.context = new Map();
  }

  /**
   * Add pre-request middleware
   */
  use(middleware: Middleware): void {
    this.preRequest.push(middleware);

    // Sort by priority
    this.preRequest.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Add post-request middleware
   */
  useAfter(middleware: Middleware): void {
    this.postRequest.push(middleware);

    // Sort by priority (reverse order)
    this.postRequest.sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }

  /**
   * Add error handler
   */
  onError(name: string, handler: MiddlewareFunction): void {
    this.errorHandlers.set(name, handler);
  }

  /**
   * Execute pre-request middleware
   */
  async executePreRequest(
    request: GatewayRequest,
    context: GatewayContext
  ): Promise<void> {
    for (const middleware of this.preRequest) {
      // Check condition
      if (middleware.condition && !this.evaluateCondition(middleware.condition, request)) {
        continue;
      }

      try {
        await middleware.execute(request, context, async () => {
          // Next function - does nothing in pre-request phase
        });
      } catch (error) {
        await this.handleError(error as Error, request, context);
        throw error;
      }
    }
  }

  /**
   * Execute post-request middleware
   */
  async executePostRequest(
    request: GatewayRequest,
    response: GatewayResponse,
    context: GatewayContext
  ): Promise<void> {
    for (const middleware of this.postRequest) {
      // Check condition
      if (middleware.condition && !this.evaluateCondition(middleware.condition, request)) {
        continue;
      }

      try {
        await middleware.execute(request as any, context, async () => {
          // Next function - does nothing in post-request phase
        });
      } catch (error) {
        await this.handleError(error as Error, request, context);
      }
    }
  }

  /**
   * Handle error
   */
  async handleError(
    error: Error,
    request: GatewayRequest,
    context: GatewayContext
  ): Promise<void> {
    for (const [name, handler] of this.errorHandlers) {
      try {
        await handler(request, context, async () => {});
      } catch (handlerError) {
        console.error(`Error handler "${name}" failed:`, handlerError);
      }
    }
  }

  /**
   * Set context value
   */
  setContext(key: string, value: unknown): void {
    this.context.set(key, value);
  }

  /**
   * Get context value
   */
  getContext<T = unknown>(key: string): T | undefined {
    return this.context.get(key) as T;
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.context.clear();
  }

  /**
   * Remove middleware by name
   */
  remove(name: string): boolean {
    const preIndex = this.preRequest.findIndex(m => m.name === name);
    if (preIndex !== -1) {
      this.preRequest.splice(preIndex, 1);
      return true;
    }

    const postIndex = this.postRequest.findIndex(m => m.name === name);
    if (postIndex !== -1) {
      this.postRequest.splice(postIndex, 1);
      return true;
    }

    return false;
  }

  /**
   * Get all middleware
   */
  getAll(): { preRequest: Middleware[]; postRequest: Middleware[] } {
    return {
      preRequest: [...this.preRequest],
      postRequest: [...this.postRequest],
    };
  }

  /**
   * Evaluate condition (private helper)
   */
  private evaluateCondition(condition: MiddlewareCondition, request: GatewayRequest): boolean {
    let value: unknown;

    switch (condition.scope) {
      case 'header':
        value = request.headers.get(condition.field);
        break;

      case 'query':
        value = request.query.get(condition.field);
        break;

      case 'path':
        value = request.url.pathname.split('/').includes(condition.field);
        break;

      case 'method':
        value = request.method;
        break;

      default:
        value = undefined;
    }

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;

      case 'contains':
        return typeof value === 'string' && value.includes(String(condition.value || ''));

      case 'matches':
        if (typeof value === 'string' && condition.value) {
          const regex = new RegExp(String(condition.value));
          return regex.test(value);
        }
        return false;

      case 'exists':
        return value !== undefined && value !== null;

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);

      default:
        return false;
    }
  }
}

/**
 * Create middleware chain
 */
export function createMiddlewareChain(): MiddlewareChain {
  return new MiddlewareChain();
}

/**
 * Common middleware factory functions
 */
export const Middleware = {
  /**
   * Logging middleware
   */
  logging: (options: { logBody?: boolean; logHeaders?: boolean } = {}): Middleware => ({
    name: 'logging',
    priority: 100,
    execute: async (request, context, next) => {
      const start = Date.now();

      console.log('[Request]', {
        method: request.method,
        path: request.url.pathname,
        query: request.url.search,
        ip: request.ip,
        headers: options.logHeaders ? Object.fromEntries(request.headers.entries()) : undefined,
      });

      await next();

      const duration = Date.now() - start;
      console.log('[Response]', {
        duration: `${duration}ms`,
        status: (context as any).response?.status,
      });
    },
  }),

  /**
   * CORS middleware
   */
  cors: (options: {
    origin?: string;
    methods?: string[];
    headers?: string[];
    credentials?: boolean;
    maxAge?: number;
  } = {}): Middleware => ({
    name: 'cors',
    priority: 90,
    execute: async (request, context, next) => {
      const response = (context as any).response as GatewayResponse;

      if (response) {
        response.headers.set('Access-Control-Allow-Origin', options.origin || '*');
        response.headers.set(
          'Access-Control-Allow-Methods',
          options.methods?.join(', ') || 'GET, POST, PUT, DELETE, OPTIONS'
        );
        response.headers.set(
          'Access-Control-Allow-Headers',
          options.headers?.join(', ') || 'Content-Type, Authorization'
        );

        if (options.credentials) {
          response.headers.set('Access-Control-Allow-Credentials', 'true');
        }

        if (options.maxAge) {
          response.headers.set('Access-Control-Max-Age', String(options.maxAge));
        }
      }

      await next();
    },
  }),

  /**
   * Request ID middleware
   */
  requestId: (headerName: string = 'X-Request-ID'): Middleware => ({
    name: 'requestId',
    priority: 100,
    execute: async (request, context, next) => {
      let requestId = request.headers.get(headerName);

      if (!requestId) {
        requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        request.headers.set(headerName, requestId);
      }

      request.id = requestId;

      await next();
    },
  }),

  /**
   * Timeout middleware
   */
  timeout: (ms: number): Middleware => ({
    name: 'timeout',
    priority: 50,
    execute: async (request, context, next) => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), ms);
      });

      await Promise.race([next(), timeoutPromise]);
    },
  }),

  /**
   * Rate limiting middleware
   */
  rateLimit: (checkFn: (request: GatewayRequest) => Promise<boolean>): Middleware => ({
    name: 'rateLimit',
    priority: 80,
    execute: async (request, context, next) => {
      const allowed = await checkFn(request);

      if (!allowed) {
        const error = new Error('Rate limit exceeded');
        (error as any).status = 429;
        throw error;
      }

      await next();
    },
  }),

  /**
   * Authentication middleware
   */
  auth: (authFn: (request: GatewayRequest) => Promise<boolean>): Middleware => ({
    name: 'auth',
    priority: 70,
    execute: async (request, context, next) => {
      const authenticated = await authFn(request);

      if (!authenticated) {
        const error = new Error('Unauthorized');
        (error as any).status = 401;
        throw error;
      }

      await next();
    },
  }),

  /**
   * Compression middleware
   */
  compression: (threshold: number = 1024): Middleware => ({
    name: 'compression',
    priority: 30,
    execute: async (request, context, next) => {
      await next();

      const response = (context as any).response as GatewayResponse;

      if (response && response.headers.get('Content-Encoding') !== 'gzip') {
        const acceptEncoding = request.headers.get('Accept-Encoding') || '';

        if (acceptEncoding.includes('gzip')) {
          // In a real implementation, compress the response body
          response.headers.set('Content-Encoding', 'gzip');
        }
      }
    },
  }),
};
