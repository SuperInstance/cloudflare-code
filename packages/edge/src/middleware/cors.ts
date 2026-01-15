import type { Context, Next } from 'hono';
import { cors } from 'hono/cors';

/**
 * CORS Configuration
 *
 * Edge-optimized CORS middleware for Cloudflare Workers
 */

export interface CORSConfig {
  origin?: string | string[] | ((origin: string) => boolean);
  allowMethods?: string[];
  allowHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  exposeHeaders?: string[];
}

const DEFAULT_CORS_CONFIG: CORSConfig = {
  origin: '*', // In production, specify exact origins
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-Session-ID',
    'Accept',
    'Accept-Encoding',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
  exposeHeaders: ['X-Request-ID', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
};

/**
 * Create CORS middleware with Hono
 */
export function createCORS(config: CORSConfig = {}) {
  const mergedConfig = { ...DEFAULT_CORS_CONFIG, ...config };

  const corsOptions: {
    origin: string | string[] | ((origin: string) => string | null | undefined);
    allowMethods?: string[];
    allowHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
    exposeHeaders?: string[];
  } = {
    origin: typeof mergedConfig.origin === 'string'
      ? mergedConfig.origin
      : Array.isArray(mergedConfig.origin)
      ? mergedConfig.origin
      : mergedConfig.origin === undefined
      ? '*'
      : (origin: string) => (mergedConfig.origin as (origin: string) => boolean)(origin) ? origin : null,
  };

  if (mergedConfig.allowMethods) {
    corsOptions.allowMethods = mergedConfig.allowMethods;
  }
  if (mergedConfig.allowHeaders) {
    corsOptions.allowHeaders = mergedConfig.allowHeaders;
  }
  if (mergedConfig.credentials !== undefined) {
    corsOptions.credentials = mergedConfig.credentials;
  }
  if (mergedConfig.maxAge !== undefined) {
    corsOptions.maxAge = mergedConfig.maxAge;
  }
  if (mergedConfig.exposeHeaders) {
    corsOptions.exposeHeaders = mergedConfig.exposeHeaders;
  }

  return cors(corsOptions);
}

/**
 * CORS middleware with origin validation
 */
export function corsWithOriginValidation(allowedOrigins: string[]) {
  return async (c: Context, next: Next) => {
    const origin = c.req.header('Origin');

    if (origin) {
      // Check if origin is in allowed list
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed === '*') return true;
        if (allowed === origin) return true;
        // Support wildcard subdomains
        if (allowed.startsWith('*.')) {
          const domain = allowed.slice(2);
          return origin.endsWith(domain);
        }
        return false;
      });

      if (isAllowed) {
        c.header('Access-Control-Allow-Origin', origin);
      }
    }

    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-Session-ID');
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Max-Age', '86400');

    await next();
  };
}

/**
 * CORS middleware for local development
 */
export const devCORS = createCORS({
  origin: '*',
  credentials: true,
});

/**
 * CORS middleware for production
 */
export const prodCORS = createCORS({
  origin: [
    'https://claudeflare.com',
    'https://www.claudeflare.com',
    'https://app.claudeflare.com',
  ],
  credentials: true,
});
