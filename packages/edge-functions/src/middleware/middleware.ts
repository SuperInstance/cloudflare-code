/**
 * Middleware for Edge Functions
 *
 * Provides request/response interception, logging,
 * authentication, rate limiting, and other cross-cutting concerns.
 */

import {
  MiddlewareFunction,
  MiddlewareConfig,
  EdgeRequest,
  EdgeResponse,
  EdgeEnv,
} from '../types/index.js';

// ============================================================================
// Middleware Types
// ============================================================================

/**
 * Middleware execution context
 */
export interface MiddlewareContext {
  /**
   * Original request
   */
  request: EdgeRequest;

  /**
   * Environment
   */
  env: EdgeEnv;

  /**
   * Execution context
   */
  ctx: ExecutionContext;

  /**
   * Middleware metadata
   */
  metadata: Map<string, unknown>;
}

/**
 * Middleware chain
 */
export class MiddlewareChain {
  private readonly middlewares: MiddlewareConfig[] = [];

  /**
   * Add middleware to the chain
   */
  use(middleware: MiddlewareConfig): MiddlewareChain {
    this.middlewares.push(middleware);
    this.middlewares.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    return this;
  }

  /**
   * Execute middleware chain
   */
  async execute(
    request: EdgeRequest,
    context: ExecutionContext & { env: EdgeEnv },
    handler: () => Promise<EdgeResponse>
  ): Promise<EdgeResponse> {
    let index = 0;

    const next = async (): Promise<EdgeResponse> => {
      if (index >= this.middlewares.length) {
        return handler();
      }

      const middleware = this.middlewares[index++];

      // Check if middleware should be applied
      if (
        middleware.applyTo &&
        !middleware.applyTo.includes(request.functionId)
      ) {
        return next();
      }

      // Execute middleware
      return middleware.handler(request, context, next);
    };

    return next();
  }

  /**
   * Get all middlewares
   */
  getAll(): MiddlewareConfig[] {
    return [...this.middlewares];
  }

  /**
   * Clear all middlewares
   */
  clear(): void {
    this.middlewares.length = 0;
  }
}

// ============================================================================
// Built-in Middleware
// ============================================================================

/**
 * Logging middleware
 */
export function loggingMiddleware(config?: {
  logRequest?: boolean;
  logResponse?: boolean;
  logError?: boolean;
  logger?: (message: string, data?: unknown) => void;
}): MiddlewareConfig {
  return {
    name: 'logging',
    priority: 0,
    handler: async (request, context, next) => {
      const logger = config?.logger || console.log;

      if (config?.logRequest !== false) {
        logger(`[Request] ${request.functionId}`, {
          id: request.id,
          functionId: request.functionId,
          timestamp: request.timestamp,
          traceId: request.traceId,
        });
      }

      try {
        const response = await next();

        if (config?.logResponse !== false) {
          logger(`[Response] ${request.functionId}`, {
            requestId: request.id,
            status: response.status,
            duration: response.metrics.duration,
          });
        }

        return response;
      } catch (error) {
        if (config?.logError !== false) {
          logger(`[Error] ${request.functionId}`, {
            requestId: request.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        throw error;
      }
    },
  };
}

/**
 * Timing middleware
 */
export function timingMiddleware(): MiddlewareConfig {
  return {
    name: 'timing',
    priority: 0,
    handler: async (request, context, next) => {
      const start = performance.now();

      const response = await next();

      const duration = performance.now() - start;
      response.headers = response.headers || new Headers();
      response.headers.set('X-Function-Duration', duration.toFixed(2));

      return response;
    },
  };
}

/**
 * Authentication middleware
 */
export function authenticationMiddleware(config?: {
  authenticate?: (request: EdgeRequest) => Promise<boolean>;
  onUnauthorized?: (request: EdgeRequest) => EdgeResponse;
}): MiddlewareConfig {
  return {
    name: 'authentication',
    priority: -100,
    handler: async (request, context, next) => {
      if (!config?.authenticate) {
        return next();
      }

      const isAuthenticated = await config.authenticate(request);

      if (!isAuthenticated) {
        if (config.onUnauthorized) {
          return config.onUnauthorized(request);
        }

        return {
          id: generateId(),
          requestId: request.id,
          functionId: request.functionId,
          data: { error: 'Unauthorized' },
          status: 'error',
          metrics: {
            functionId: request.functionId,
            executionId: generateId(),
            startTime: Date.now(),
            endTime: Date.now(),
            duration: 0,
            memoryUsed: 0,
            cpuTime: 0,
            status: 'error',
          },
        };
      }

      return next();
    },
  };
}

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(config?: {
  keyGenerator?: (request: EdgeRequest) => string;
  limit?: number;
  window?: number;
  storage?: Map<string, { count: number; resetTime: number }>;
  onRateLimited?: (request: EdgeRequest) => EdgeResponse;
}): MiddlewareConfig {
  const storage = config?.storage || new Map();

  return {
    name: 'rate-limit',
    priority: -50,
    handler: async (request, context, next) => {
      if (!config?.limit) {
        return next();
      }

      const key = config.keyGenerator
        ? config.keyGenerator(request)
        : request.functionId;

      const now = Date.now();
      const window = config.window || 60000; // 1 minute default

      let entry = storage.get(key);

      if (!entry || now > entry.resetTime) {
        entry = { count: 0, resetTime: now + window };
        storage.set(key, entry);
      }

      entry.count++;

      if (entry.count > config.limit) {
        if (config.onRateLimited) {
          return config.onRateLimited(request);
        }

        return {
          id: generateId(),
          requestId: request.id,
          functionId: request.functionId,
          data: { error: 'Rate limit exceeded' },
          status: 'error',
          metrics: {
            functionId: request.functionId,
            executionId: generateId(),
            startTime: Date.now(),
            endTime: Date.now(),
            duration: 0,
            memoryUsed: 0,
            cpuTime: 0,
            status: 'error',
          },
        };
      }

      return next();
    },
  };
}

/**
 * CORS middleware
 */
export function corsMiddleware(config?: {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
}): MiddlewareConfig {
  return {
    name: 'cors',
    priority: 0,
    handler: async (request, context, next) => {
      const response = await next();

      // Add CORS headers
      response.headers = response.headers || new Headers();

      const origin = request.headers?.get('Origin') || '*';

      if (config?.origin) {
        if (typeof config.origin === 'function') {
          if (config.origin(origin)) {
            response.headers.set('Access-Control-Allow-Origin', origin);
          }
        } else if (Array.isArray(config.origin)) {
          if (config.origin.includes(origin)) {
            response.headers.set('Access-Control-Allow-Origin', origin);
          }
        } else {
          response.headers.set('Access-Control-Allow-Origin', config.origin);
        }
      } else {
        response.headers.set('Access-Control-Allow-Origin', '*');
      }

      if (config?.methods) {
        response.headers.set(
          'Access-Control-Allow-Methods',
          config.methods.join(', ')
        );
      }

      if (config?.headers) {
        response.headers.set(
          'Access-Control-Allow-Headers',
          config.headers.join(', ')
        );
      }

      if (config?.credentials) {
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }

      if (config?.maxAge) {
        response.headers.set('Access-Control-Max-Age', config.maxAge.toString());
      }

      return response;
    },
  };
}

/**
 * Error handling middleware
 */
export function errorHandlingMiddleware(config?: {
  onError?: (error: Error, request: EdgeRequest) => EdgeResponse;
  transformError?: (error: Error) => Error;
}): MiddlewareConfig {
  return {
    name: 'error-handling',
    priority: 100,
    handler: async (request, context, next) => {
      try {
        return await next();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        const transformedError = config?.transformError
          ? config.transformError(err)
          : err;

        if (config?.onError) {
          return config.onError(transformedError, request);
        }

        return {
          id: generateId(),
          requestId: request.id,
          functionId: request.functionId,
          data: {
            error: transformedError.message,
            stack: process.env.NODE_ENV === 'development' ? transformedError.stack : undefined,
          },
          status: 'error',
          metrics: {
            functionId: request.functionId,
            executionId: generateId(),
            startTime: Date.now(),
            endTime: Date.now(),
            duration: 0,
            memoryUsed: 0,
            cpuTime: 0,
            status: 'error',
          },
          error: transformedError,
        };
      }
    },
  };
}

/**
 * Compression middleware
 */
export function compressionMiddleware(config?: {
  threshold?: number;
  algorithm?: 'gzip' | 'deflate';
}): MiddlewareConfig {
  return {
    name: 'compression',
    priority: 50,
    handler: async (request, context, next) => {
      const response = await next();

      // Check if response should be compressed
      const acceptEncoding = request.headers?.get('Accept-Encoding') || '';
      const supportsGzip = acceptEncoding.includes('gzip');
      const supportsDeflate = acceptEncoding.includes('deflate');

      if (!supportsGzip && !supportsDeflate) {
        return response;
      }

      // In a real implementation, would compress the response body here
      // For now, just set the header
      response.headers = response.headers || new Headers();

      if (supportsGzip) {
        response.headers.set('Content-Encoding', 'gzip');
      } else if (supportsDeflate) {
        response.headers.set('Content-Encoding', 'deflate');
      }

      return response;
    },
  };
}

/**
 * Cache control middleware
 */
export function cacheControlMiddleware(config?: {
  maxAge?: number;
  noCache?: boolean;
  noStore?: boolean;
  mustRevalidate?: boolean;
  private?: boolean;
}): MiddlewareConfig {
  return {
    name: 'cache-control',
    priority: 10,
    handler: async (request, context, next) => {
      const response = await next();

      response.headers = response.headers || new Headers();

      if (config?.noCache) {
        response.headers.set('Cache-Control', 'no-cache');
        return response;
      }

      if (config?.noStore) {
        response.headers.set('Cache-Control', 'no-store');
        return response;
      }

      const directives: string[] = [];

      if (config?.maxAge !== undefined) {
        directives.push(`max-age=${config.maxAge}`);
      }

      if (config?.mustRevalidate) {
        directives.push('must-revalidate');
      }

      if (config?.private) {
        directives.push('private');
      }

      if (directives.length > 0) {
        response.headers.set('Cache-Control', directives.join(', '));
      }

      return response;
    },
  };
}

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(config?: {
  contentSecurityPolicy?: string;
  xFrameOptions?: string;
  xContentTypeOptions?: 'nosniff';
  strictTransportSecurity?: string;
  xXssProtection?: string;
  referrerPolicy?: string;
}): MiddlewareConfig {
  return {
    name: 'security-headers',
    priority: 20,
    handler: async (request, context, next) => {
      const response = await next();

      response.headers = response.headers || new Headers();

      if (config?.contentSecurityPolicy) {
        response.headers.set('Content-Security-Policy', config.contentSecurityPolicy);
      }

      if (config?.xFrameOptions) {
        response.headers.set('X-Frame-Options', config.xFrameOptions);
      }

      if (config?.xContentTypeOptions) {
        response.headers.set('X-Content-Type-Options', config.xContentTypeOptions);
      }

      if (config?.strictTransportSecurity) {
        response.headers.set('Strict-Transport-Security', config.strictTransportSecurity);
      }

      if (config?.xXssProtection) {
        response.headers.set('X-XSS-Protection', config.xXssProtection);
      }

      if (config?.referrerPolicy) {
        response.headers.set('Referrer-Policy', config.referrerPolicy);
      }

      return response;
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Create a middleware chain
 */
export function createMiddlewareChain(): MiddlewareChain {
  return new MiddlewareChain();
}

/**
 * Create a custom middleware
 */
export function createMiddleware(
  name: string,
  handler: MiddlewareFunction,
  config?: Partial<MiddlewareConfig>
): MiddlewareConfig {
  return {
    name,
    handler,
    ...config,
  };
}

/**
 * Combine multiple middleware into a chain
 */
export function combineMiddleware(...middlewares: MiddlewareConfig[]): MiddlewareChain {
  const chain = createMiddlewareChain();
  for (const middleware of middlewares) {
    chain.use(middleware);
  }
  return chain;
}

/**
 * Apply middleware to specific functions
 */
export function applyToFunctions(
  middleware: MiddlewareConfig,
  functionIds: string[]
): MiddlewareConfig {
  return {
    ...middleware,
    applyTo: functionIds,
  };
}
