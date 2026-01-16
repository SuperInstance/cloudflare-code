/**
 * API Gateway Package
 *
 * Enterprise-grade API Gateway for the ClaudeFlare platform.
 *
 * Features:
 * - Advanced request routing with path-based, header-based, and weighted routing
 * - Multiple rate limiting algorithms (token bucket, sliding window, fixed window, leaky bucket)
 * - Comprehensive authentication (API keys, JWT, OAuth, mTLS)
 * - Request/response transformation
 * - API versioning with deprecation workflows
 * - Circuit breaker pattern for fault tolerance
 * - Real-time analytics and monitoring
 * - Dynamic configuration management
 *
 * @packageDocumentation
 */

// Main gateway
export * from './gateway';

// Types
export * from './types';

// Router
export * from './router';

// Rate limiting
export * from './rate-limit';

// Authentication
export * from './auth';

// Transformation
export * from './transformer';

// Versioning
export * from './version';

// Circuit breaker
export * from './circuit';

// Analytics
export * from './analytics';

// Configuration
export * from './config';

// Middleware
export * from './middleware';
