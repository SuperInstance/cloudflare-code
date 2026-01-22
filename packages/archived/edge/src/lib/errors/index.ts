/**
 * Error Handling and Recovery System
 *
 * Comprehensive error handling with:
 * - Error taxonomy and classification
 * - Retry policies with exponential backoff
 * - Fallback strategies
 * - Enhanced circuit breaker
 * - Dead letter queue
 * - Error reporting and analytics
 * - Global error handler
 *
 * @example
 * ```typescript
 * import { createGlobalErrorHandler } from './errors';
 *
 * const errorHandler = createGlobalErrorHandler();
 *
 * try {
 *   const response = await errorHandler.execute(request);
 * } catch (error) {
 *   console.error('All recovery mechanisms failed:', error);
 * }
 * ```
 */

// Export all error types and taxonomy
export * from './types';

// Export retry policies
export * from './retry';

// Export fallback strategies
export * from './fallback';

// Export dead letter queue
export * from './dead-letter';

// Export enhanced circuit breaker
export * from './circuit-breaker';

// Export error reporting
export * from './reporting';

// Export global error handler
export * from './handler';
