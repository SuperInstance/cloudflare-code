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

  return cors({
    origin: mergedConfig.origin,
    allowMethods: mergedConfig.allowMethods,
    allowHeaders: mergedConfig.allowHeaders,
    credentials: mergedConfig.credentials,
    maxAge: mergedConfig.maxAge,
    exposeHeaders: mergedConfig.exposeHeaders,
  });
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
    c.header('Access-Control-Expose-Headers', 'X-Request-ID, X-RateLimit-Remaining, X-RateLimit-Reset');

    if (c.req.method === 'OPTIONS') {
      return c.text('', 204);
    }

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
