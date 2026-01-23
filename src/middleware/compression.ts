/**
 * Compression Middleware
 * Brotli and Gzip compression for Cloudflare Workers
 */

import type { MiddlewareHandler } from 'hono';

export interface CompressionOptions {
  threshold?: number; // Minimum size to compress (bytes)
  types?: string[]; // Content types to compress
  brotli?: boolean; // Enable Brotli (preferred)
  gzip?: boolean; // Enable Gzip (fallback)
}

const DEFAULT_OPTIONS: CompressionOptions = {
  threshold: 1024, // 1KB
  types: [
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript',
    'application/json',
    'application/xml',
    'text/xml'
  ],
  brotli: true,
  gzip: true
};

/**
 * Compression middleware for Hono
 * Note: Cloudflare Workers handles compression automatically
 * This middleware adds compression hints and handles edge cases
 */
export function compression(options?: CompressionOptions): MiddlewareHandler {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async (c, next) => {
    await next();

    const response = c.res;
    if (!response) return;

    const contentType = response.headers.get('content-type') || '';
    const contentLength = response.headers.get('content-length');
    const size = contentLength ? parseInt(contentLength) : 0;

    // Check if response should be compressed
    if (size > 0 && size < opts.threshold!) {
      // Too small to compress
      return;
    }

    if (!shouldCompress(contentType, opts.types!)) {
      // Content type not configured for compression
      return;
    }

    // Check client accept encoding
    const acceptEncoding = c.req.header('accept-encoding') || '';

    if (opts.brotli && acceptEncoding.includes('br')) {
      // Cloudflare will automatically use Brotli
      c.header('Content-Encoding', 'br');
    } else if (opts.gz && acceptEncoding.includes('gzip')) {
      // Cloudflare will automatically use Gzip
      c.header('Content-Encoding', 'gzip');
    }

    // Add Vary header for proper caching
    const varyHeader = response.headers.get('Vary') || '';
    if (!varyHeader.includes('Accept-Encoding')) {
      c.header('Vary', varyHeader ? `${varyHeader}, Accept-Encoding` : 'Accept-Encoding');
    }
  };
}

/**
 * Check if content type should be compressed
 */
function shouldCompress(contentType: string, types: string[]): boolean {
  return types.some(type => contentType.startsWith(type));
}

/**
 * Get compressed size estimate
 */
export function getCompressedSize(originalSize: number, type: 'br' | 'gzip' = 'br'): number {
  // Brotli typically achieves 15-25% better compression than Gzip
  // Gzip typically achieves 60-80% compression
  const ratio = type === 'br' ? 0.2 : 0.3;
  return Math.floor(originalSize * ratio);
}

/**
 * Add compression headers to response
 */
export function addCompressionHeaders(response: Response, options?: CompressionOptions): Response {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const newHeaders = new Headers(response.headers);

  // Add compression hints for Cloudflare
  newHeaders.set('X-Content-Type-Options', 'nosniff');

  // Cloudflare will handle actual compression
  // These headers just provide hints

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
