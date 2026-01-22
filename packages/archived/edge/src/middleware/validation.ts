import type { Context, Next } from 'hono';
import { ZodError } from 'zod';
import { handleValidationError } from './error-handler';

/**
 * Request Validation Middleware
 *
 * Validates request bodies using Zod schemas
 */

/**
 * Validate request body against a Zod schema
 */
export function validateBody<T>(schema: {
  parse: (data: unknown) => T;
}) {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const validated = schema.parse(body);

      // Store validated data in context for later use
      c.set('validatedBody', validated);

      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        return handleValidationError(c, error);
      }
      throw error;
    }
  };
}

/**
 * Validate request query parameters against a Zod schema
 */
export function validateQuery<T>(schema: {
  parse: (data: unknown) => T;
}) {
  return async (c: Context, next: Next) => {
    try {
      const query = Object.fromEntries(
        new URLSearchParams(c.req.query())
      );
      const validated = schema.parse(query);

      // Store validated data in context for later use
      c.set('validatedQuery', validated);

      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        return handleValidationError(c, error);
      }
      throw error;
    }
  };
}

/**
 * Validate request path parameters against a Zod schema
 */
export function validateParams<T>(schema: {
  parse: (data: unknown) => T;
}) {
  return async (c: Context, next: Next) => {
    try {
      const params = c.req.param();
      const validated = schema.parse(params);

      // Store validated data in context for later use
      c.set('validatedParams', validated);

      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        return handleValidationError(c, error);
      }
      throw error;
    }
  };
}

/**
 * Validate request headers against a Zod schema
 */
export function validateHeaders<T>(schema: {
  parse: (data: unknown) => T;
}) {
  return async (c: Context, next: Next) => {
    try {
      const headers = Object.fromEntries(c.req.header());
      const validated = schema.parse(headers);

      // Store validated data in context for later use
      c.set('validatedHeaders', validated);

      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        return handleValidationError(c, error);
      }
      throw error;
    }
  };
}

/**
 * Validate content type header
 */
export function validateContentType(...allowedTypes: string[]) {
  return async (c: Context, next: Next) => {
    const contentType = c.req.header('Content-Type');

    if (!contentType) {
      return c.json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Content-Type header is required',
          timestamp: Date.now(),
        },
      }, 400);
    }

    const isAllowed = allowedTypes.some(type => {
      // Handle wildcards like 'application/*'
      if (type.endsWith('/*')) {
        const prefix = type.slice(0, -1);
        return contentType.startsWith(prefix);
      }
      return contentType.includes(type);
    });

    if (!isAllowed) {
      return c.json({
        error: {
          code: 'INVALID_REQUEST',
          message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
          timestamp: Date.now(),
        },
      }, 415);
    }

    await next();
  };
}

/**
 * Validate required headers
 */
export function requireHeaders(...headers: string[]) {
  return async (c: Context, next: Next) => {
    const missing: string[] = [];

    for (const header of headers) {
      if (!c.req.header(header)) {
        missing.push(header);
      }
    }

    if (missing.length > 0) {
      return c.json({
        error: {
          code: 'MISSING_REQUIRED_FIELD',
          message: `Missing required headers: ${missing.join(', ')}`,
          timestamp: Date.now(),
        },
      }, 400);
    }

    await next();
  };
}

/**
 * Sanitize request body (remove potentially dangerous fields)
 */
export function sanitizeBody() {
  const dangerousFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'accessToken',
    'refreshToken',
  ];

  return async (c: Context, next: Next) => {
    const body = await c.req.json().catch(() => ({}));

    // Remove dangerous fields from logs
    const sanitized = { ...body };
    for (const field of dangerousFields) {
      if (field in sanitized) {
        (sanitized as any)[field] = '[REDACTED]';
      }
    }

    c.set('sanitizedBody', sanitized);

    await next();
  };
}
