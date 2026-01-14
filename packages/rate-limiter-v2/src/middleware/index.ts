/**
 * Middleware module exports
 */

export {
  expressMiddleware,
  ipRateLimiter,
  userRateLimiter,
  apiKeyRateLimiter,
  endpointRateLimiter,
  type ExpressMiddlewareOptions
} from './express.js';

export {
  fastifyRateLimiter,
  createIpRateLimiter as createFastifyIpRateLimiter,
  createUserRateLimiter as createFastifyUserRateLimiter,
  createApiKeyRateLimiter as createFastifyApiKeyRateLimiter,
  type FastifyMiddlewareOptions
} from './fastify.js';

export {
  workersMiddleware,
  createIpRateLimiter as createWorkersIpRateLimiter,
  createApiKeyRateLimiter as createWorkersApiKeyRateLimiter,
  createCountryRateLimiter,
  createColoRateLimiter,
  withRateLimit,
  type WorkersMiddlewareOptions
} from './cloudflare-workers.js';
