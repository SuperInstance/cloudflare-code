/**
 * Authentication Middleware
 * Handles JWT authentication and user context
 */

import { Request, Response } from '@cloudflare/workers-types';

export interface AuthContext {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
  token?: string;
}

export class AuthMiddleware {
  private jwtSecret: string;

  constructor(jwtSecret: string) {
    this.jwtSecret = jwtSecret;
  }

  async authenticate(request: Request): Promise<AuthContext> {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {};
    }

    const token = authHeader.substring(7);

    try {
      // Verify JWT token
      const payload = await this.verifyToken(token);

      return {
        user: payload,
        token
      };
    } catch (error) {
      console.error('Token verification failed:', error);
      return {};
    }
  }

  async verifyToken(token: string): Promise<any> {
    // Simple JWT verification - in production, use a proper JWT library
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }

    return payload;
  }

  requireAuth(handler: (request: Request, ctx: AuthContext) => Promise<Response>) {
    return async (request: Request): Promise<Response> => {
      const authCtx = await this.authenticate(request);

      if (!authCtx.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return handler(request, authCtx);
    };
  }

  requireRole(role: string | string[]) {
    return (handler: (request: Request, ctx: AuthContext) => Promise<Response>) => {
      return async (request: Request, ctx: any): Promise<Response> => {
        const authCtx = await this.authenticate(request);

        if (!authCtx.user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const allowedRoles = Array.isArray(role) ? role : [role];
        if (!allowedRoles.includes(authCtx.user.role)) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return handler(request, authCtx);
      };
    };
  }

  optionalAuth(handler: (request: Request, ctx: AuthContext) => Promise<Response>) {
    return async (request: Request): Promise<Response> => {
      const authCtx = await this.authenticate(request);
      return handler(request, authCtx);
    };
  }
}

export class RateLimitMiddleware {
  private limits: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000
  ) {}

  async checkRateLimit(identifier: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const now = Date.now();
    const record = this.limits.get(identifier);

    if (!record || now > record.resetTime) {
      // Create new window
      const resetTime = now + this.windowMs;
      this.limits.set(identifier, { count: 1, resetTime });

      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt: new Date(resetTime)
      };
    }

    if (record.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(record.resetTime)
      };
    }

    record.count++;
    return {
      allowed: true,
      remaining: this.maxRequests - record.count,
      resetAt: new Date(record.resetTime)
    };
  }

  limitByIP(handler: (request: Request) => Promise<Response>) {
    return async (request: Request): Promise<Response> => {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const result = await this.checkRateLimit(ip);

      if (!result.allowed) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          resetAt: result.resetAt
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': this.maxRequests.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetAt.toISOString()
          }
        });
      }

      const response = await handler(request);

      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', this.maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      response.headers.set('X-RateLimit-Reset', result.resetAt.toISOString());

      return response;
    };
  }

  limitByUser(handler: (request: Request, ctx: AuthContext) => Promise<Response>) {
    return async (request: Request, ctx: AuthContext): Promise<Response> => {
      const identifier = ctx.user?.id || request.headers.get('CF-Connecting-IP') || 'unknown';
      const result = await this.checkRateLimit(identifier);

      if (!result.allowed) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          resetAt: result.resetAt
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': this.maxRequests.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetAt.toISOString()
          }
        });
      }

      const response = await handler(request, ctx);

      response.headers.set('X-RateLimit-Limit', this.maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      response.headers.set('X-RateLimit-Reset', result.resetAt.toISOString());

      return response;
    };
  }
}

export class CORSMiddleware {
  constructor(
    private allowedOrigins: string[] = ['*'],
    private allowedMethods: string[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    private allowedHeaders: string[] = ['Content-Type', 'Authorization'],
    private exposeHeaders: string[] = ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    private maxAge: number = 86400
  ) {}

  handle(handler: (request: Request) => Promise<Response>) {
    return async (request: Request): Promise<Response> => {
      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        return this.createPreflightResponse(request);
      }

      const response = await handler(request);
      return this.addCORSHeaders(request, response);
    };
  }

  private createPreflightResponse(request: Request): Response {
    const origin = request.headers.get('Origin');
    const allowedOrigin = this.getAllowedOrigin(origin);

    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    headers.set('Access-Control-Allow-Methods', this.allowedMethods.join(', '));
    headers.set('Access-Control-Allow-Headers', this.allowedHeaders.join(', '));
    headers.set('Access-Control-Expose-Headers', this.exposeHeaders.join(', '));
    headers.set('Access-Control-Max-Age', this.maxAge.toString());

    return new Response(null, { status: 204, headers });
  }

  private addCORSHeaders(request: Request, response: Response): Response {
    const origin = request.headers.get('Origin');
    const allowedOrigin = this.getAllowedOrigin(origin);

    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    newResponse.headers.set('Access-Control-Expose-Headers', this.exposeHeaders.join(', '));

    return newResponse;
  }

  private getAllowedOrigin(origin: string | null): string {
    if (!origin) return '*';

    if (this.allowedOrigins.includes('*')) {
      return '*';
    }

    if (this.allowedOrigins.includes(origin)) {
      return origin;
    }

    return this.allowedOrigins[0] || '*';
  }
}

export class ValidationMiddleware {
  static validateBody(schema: any) {
    return (handler: (request: Request) => Promise<Response>) => {
      return async (request: Request): Promise<Response> => {
        try {
          const body = await request.json();

          // Validate against schema
          const errors = this.validateSchema(body, schema);

          if (errors.length > 0) {
            return new Response(JSON.stringify({
              error: 'Validation failed',
              errors
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          return handler(request);
        } catch (error) {
          return new Response(JSON.stringify({
            error: 'Invalid JSON'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      };
    };
  }

  private static validateSchema(data: any, schema: any): string[] {
    const errors: string[] = [];

    for (const [key, rules] of Object.entries(schema)) {
      const value = data[key];

      if (rules.required && (value === undefined || value === null)) {
        errors.push(`${key} is required`);
        continue;
      }

      if (value !== undefined && rules.type) {
        if (rules.type === 'string' && typeof value !== 'string') {
          errors.push(`${key} must be a string`);
        } else if (rules.type === 'number' && typeof value !== 'number') {
          errors.push(`${key} must be a number`);
        } else if (rules.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`${key} must be a boolean`);
        } else if (rules.type === 'array' && !Array.isArray(value)) {
          errors.push(`${key} must be an array`);
        }
      }

      if (value !== undefined && rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
        errors.push(`${key} must be at least ${rules.minLength} characters`);
      }

      if (value !== undefined && rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
        errors.push(`${key} must be at most ${rules.maxLength} characters`);
      }

      if (value !== undefined && rules.min && typeof value === 'number' && value < rules.min) {
        errors.push(`${key} must be at least ${rules.min}`);
      }

      if (value !== undefined && rules.max && typeof value === 'number' && value > rules.max) {
        errors.push(`${key} must be at most ${rules.max}`);
      }

      if (value !== undefined && rules.enum && !rules.enum.includes(value)) {
        errors.push(`${key} must be one of: ${rules.enum.join(', ')}`);
      }
    }

    return errors;
  }
}

export class ErrorHandlerMiddleware {
  static handle(handler: (request: Request) => Promise<Response>) {
    return async (request: Request): Promise<Response> => {
      try {
        return await handler(request);
      } catch (error) {
        console.error('Request error:', error);

        if (error instanceof Error) {
          return new Response(JSON.stringify({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          error: 'Internal server error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    };
  }
}

export class LoggingMiddleware {
  static log(handler: (request: Request) => Promise<Response>) {
    return async (request: Request): Promise<Response> => {
      const start = Date.now();
      const url = new URL(request.url);
      const method = request.method;
      const path = url.pathname;
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

      console.log(`[Request] ${method} ${path} from ${ip}`);

      try {
        const response = await handler(request);
        const duration = Date.now() - start;

        console.log(`[Response] ${method} ${path} ${response.status} ${duration}ms`);

        return response;
      } catch (error) {
        const duration = Date.now() - start;

        console.error(`[Error] ${method} ${path} ${duration}ms`, error);

        throw error;
      }
    };
  }
}

export class CacheMiddleware {
  constructor(
    private cache: Cache,
    private defaultTTL: number = 300
  ) {}

  cacheGet(ttl?: number) {
    return (handler: (request: Request) => Promise<Response>) => {
      return async (request: Request): Promise<Response> => {
        if (request.method !== 'GET') {
          return handler(request);
        }

        const cacheKey = new Request(request.url, request);

        try {
          const cached = await this.cache.match(cacheKey);
          if (cached) {
            return cached;
          }
        } catch (error) {
          console.error('Cache lookup failed:', error);
        }

        const response = await handler(request);

        if (response.ok) {
          const responseToCache = new Response(response.body, response);
          responseToCache.headers.set('Cache-Control', `public, max-age=${ttl || this.defaultTTL}`);

          try {
            await this.cache.put(cacheKey, responseToCache.clone());
          } catch (error) {
            console.error('Cache store failed:', error);
          }
        }

        return response;
      };
    };
  }

  async invalidate(pattern: string): Promise<void> {
    // Cache invalidation would be implemented here
    // This would typically use cache tags or key-based invalidation
  }
}
