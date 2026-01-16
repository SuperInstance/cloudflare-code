/**
 * Middleware Pipeline
 * Composable middleware system for request/response processing
 */

// @ts-nocheck - Middleware function signature variations
import {
  MiddlewareFunction,
  MiddlewareContext,
  MiddlewarePipeline,
  RequestMetadata,
  GatewayError,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Middleware Pipeline
// ============================================================================

export class Pipeline implements MiddlewarePipeline {
  public middleware: MiddlewareFunction[];

  constructor() {
    this.middleware = [];
  }

  /**
   * Add middleware to pipeline
   */
  use(middleware: MiddlewareFunction): this {
    this.middleware.push(middleware);
    return this;
  }

  /**
   * Execute middleware pipeline
   */
  async execute(context: MiddlewareContext): Promise<Response> {
    let index = 0;

    const next = async (): Promise<Response> => {
      if (index >= this.middleware.length) {
        // No more middleware, return default response
        return new Response(null, { status: 404 });
      }

      const mw = this.middleware[index++];

      try {
        return await mw(context, next);
      } catch (error) {
        // Handle error
        return this.handleError(error, context);
      }
    };

    return next();
  }

  /**
   * Handle middleware error
   */
  private handleError(
    error: any,
    context: MiddlewareContext
  ): Response {
    if (error instanceof GatewayError) {
      return new Response(
        JSON.stringify({
          error: error.message,
          code: error.code,
          details: error.details,
        }),
        {
          status: error.statusCode,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Clear all middleware
   */
  clear(): void {
    this.middleware = [];
  }

  /**
   * Get middleware count
   */
  get length(): number {
    return this.middleware.length;
  }
}

// ============================================================================
// Middleware Factory Functions
// ============================================================================

/**
 * Create logging middleware
 */
export function createLoggingMiddleware(options?: {
  logRequests?: boolean;
  logResponses?: boolean;
  logErrors?: boolean;
}): MiddlewareFunction {
  return async (context: MiddlewareContext, next) => {
    const { metadata } = context;

    if (options?.logRequests !== false) {
      console.log(`[${metadata.requestId}] ${metadata.method} ${metadata.path}`);
    }

    try {
      const response = await next();

      if (options?.logResponses !== false) {
        console.log(
          `[${metadata.requestId}] Response: ${response.status}`
        );
      }

      return response;
    } catch (error) {
      if (options?.logErrors !== false) {
        console.error(
          `[${metadata.requestId}] Error:`,
          error
        );
      }
      throw error;
    }
  };
}

/**
 * Create authentication middleware
 */
export function createAuthenticationMiddleware(options?: {
  validateToken?: (token: string) => Promise<boolean>;
  unauthorizedHandler?: (context: MiddlewareContext) => Response;
}): MiddlewareFunction {
  return async (context: MiddlewareContext, next) => {
    const authHeader = context.request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (options?.unauthorizedHandler) {
        return options.unauthorizedHandler(context);
      }
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.substring(7);

    if (options?.validateToken) {
      const valid = await options.validateToken(token);
      if (!valid) {
        if (options?.unauthorizedHandler) {
          return options.unauthorizedHandler(context);
        }
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Store authentication in context state
    context.state.set('authenticated', true);
    context.state.set('token', token);

    return next();
  };
}

/**
 * Create CORS middleware
 */
export function createCORSMiddleware(options?: {
  origins?: string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
}): MiddlewareFunction {
  const defaultOrigins = ['*'];
  const defaultMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
  const defaultHeaders = ['Content-Type', 'Authorization'];

  return async (context: MiddlewareContext, next) => {
    const origin = context.request.headers.get('Origin');
    const allowedOrigins = options?.origins || defaultOrigins;

    // Check if origin is allowed
    const isAllowed = allowedOrigins.includes('*') ||
      (origin && allowedOrigins.includes(origin));

    // Handle preflight requests
    if (context.request.method === 'OPTIONS') {
      const headers = new Headers();

      if (isAllowed) {
        headers.set('Access-Control-Allow-Origin', origin || '*');
      }

      headers.set(
        'Access-Control-Allow-Methods',
        (options?.methods || defaultMethods).join(', ')
      );
      headers.set(
        'Access-Control-Allow-Headers',
        (options?.headers || defaultHeaders).join(', ')
      );

      if (options?.credentials) {
        headers.set('Access-Control-Allow-Credentials', 'true');
      }

      if (options?.maxAge) {
        headers.set('Access-Control-Max-Age', options.maxAge.toString());
      }

      return new Response(null, { headers });
    }

    // Process request
    const response = await next();

    // Add CORS headers to response
    const responseHeaders = new Headers(response.headers);

    if (isAllowed) {
      responseHeaders.set('Access-Control-Allow-Origin', origin || '*');
    }

    if (options?.credentials) {
      responseHeaders.set('Access-Control-Allow-Credentials', 'true');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  };
}

/**
 * Create request ID middleware
 */
export function createRequestIdMiddleware(options?: {
  headerName?: string;
  generator?: () => string;
}): MiddlewareFunction {
  const headerName = options?.headerName || 'X-Request-ID';
  const generator = options?.generator || uuidv4;

  return async (context: MiddlewareContext, next) => {
    const requestId = context.request.headers.get(headerName) || generator();

    // Store in metadata and state
    context.metadata.requestId = requestId;
    context.state.set('requestId', requestId);

    const response = await next();

    // Add request ID to response headers
    const headers = new Headers(response.headers);
    headers.set(headerName, requestId);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

/**
 * Create timeout middleware
 */
export function createTimeoutMiddleware(timeoutMs: number): MiddlewareFunction {
  return async (context: MiddlewareContext, next) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await next();
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'Request timeout' }),
          {
            status: 408,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      throw error;
    }
  };
}

/**
 * Create compression middleware
 */
export function createCompressionMiddleware(options?: {
  threshold?: number;
}): MiddlewareFunction {
  const threshold = options?.threshold || 1024;

  return async (context: MiddlewareContext, next) => {
    const response = await next();

    // Only compress successful responses
    if (response.status >= 400) {
      return response;
    }

    // Check if client accepts compression
    const acceptEncoding = context.request.headers.get('Accept-Encoding');
    if (!acceptEncoding?.includes('gzip')) {
      return response;
    }

    // Get response size
    const contentLength = response.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength) < threshold) {
      return response;
    }

    // Add compression header
    const headers = new Headers(response.headers);
    headers.set('Content-Encoding', 'gzip');

    // Note: Actual compression would be done by the edge/platform
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

/**
 * Create metrics collection middleware
 */
export function createMetricsMiddleware(options?: {
  collector?: (metrics: RequestMetrics) => void;
}): MiddlewareFunction {
  return async (context: MiddlewareContext, next) => {
    const startTime = Date.now();

    const response = await next();

    const duration = Date.now() - startTime;

    const metrics: RequestMetrics = {
      requestId: context.metadata.requestId,
      method: context.metadata.method,
      path: context.metadata.path,
      status: response.status,
      duration,
      timestamp: Date.now(),
      userId: context.metadata.userId,
    };

    if (options?.collector) {
      options.collector(metrics);
    }

    return response;
  };
}

// ============================================================================
// Context Creation
// ============================================================================

/**
 * Create middleware context from request
 */
export async function createMiddlewareContext(
  request: Request
): Promise<MiddlewareContext> {
  const url = new URL(request.url);
  const cfConnectingIp = request.headers.get('CF-Connecting-IP');
  const xForwardedFor = request.headers.get('X-Forwarded-For');

  const metadata: RequestMetadata = {
    requestId: uuidv4(),
    timestamp: Date.now(),
    userId: undefined, // Would be extracted from auth
    clientIp: cfConnectingIp || xForwardedFor || 'unknown',
    userAgent: request.headers.get('User-Agent') || 'unknown',
    path: url.pathname + url.search,
    method: request.method,
  };

  return {
    request,
    metadata,
    state: new Map(),
  };
}

// ============================================================================
// Types
// ============================================================================

export interface RequestMetrics {
  requestId: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  timestamp: number;
  userId?: string;
}
