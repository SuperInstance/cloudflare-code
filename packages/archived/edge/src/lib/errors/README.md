# Error Handling and Recovery System

A comprehensive error handling and recovery system for ClaudeFlare distributed AI coding platform on Cloudflare Workers.

## Overview

This system provides intelligent error classification, retry mechanisms, fallback strategies, circuit breaking, dead letter queuing, and error reporting/analytics.

## Features

### 1. Error Taxonomy and Classification

Comprehensive error classification system with 20+ error types across 5 categories:

- **Transient Errors**: Retryable temporary failures (rate limits, timeouts, network errors)
- **Permanent Errors**: Non-retryable failures (invalid input, unauthorized, not found)
- **Throttling Errors**: Rate limiting with special backoff (API rate limits, overloads)
- **Content Errors**: Content policy violations and filtering
- **System Errors**: Internal system issues

```typescript
import { classifyError, ErrorType, isRetryable } from './errors';

// Classify error from status code and message
const errorType = classifyError(429, 'rate limit exceeded');
// => ErrorType.RATE_LIMITED

// Check if error is retryable
if (isRetryable(errorType)) {
  // Retry with backoff
}

// Get user-friendly message
const metadata = getErrorMetadata(errorType);
console.log(metadata.userMessage);
// => "Request rate limited. Please wait and try again."
```

### 2. Retry Policies

Advanced retry system with multiple backoff strategies:

- **Exponential Backoff**: Standard exponential retry with jitter
- **Linear Backoff**: Linearly increasing delays
- **Full Jitter**: Maximum randomness to prevent thundering herd
- **Decorrelated Jitter**: Advanced jitter for distributed systems

```typescript
import { createAPIRetryPolicy, BackoffStrategy } from './errors';

const retryPolicy = createAPIRetryPolicy(3);

try {
  const result = await retryPolicy.execute(async () => {
    return await fetchFromAPI();
  });
} catch (error) {
  // All retries exhausted
}

// Custom retry policy
const customPolicy = new RetryPolicy({
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 60000,
  strategy: BackoffStrategy.EXPONENTIAL,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
});
```

### 3. Fallback Strategies

Multiple fallback strategies for graceful degradation:

- **Provider Fallback**: Try alternative providers
- **Model Fallback**: Try smaller/faster models
- **Cache Fallback**: Use cached response if available
- **Graceful Degradation**: Reduce functionality
- **Fail Fast**: Immediate error for critical failures

```typescript
import { createFallbackExecutor, FallbackStrategy } from './errors';

const executor = createFallbackExecutor(providers, {
  primaryStrategy: FallbackStrategy.PROVIDER_FALLBACK,
  fallbackChain: [
    FallbackStrategy.PROVIDER_FALLBACK,
    FallbackStrategy.MODEL_FALLBACK,
    FallbackStrategy.CACHE_FALLBACK,
    FallbackStrategy.GRACEFUL_DEGRADATION,
  ],
  maxFallbackAttempts: 5,
});

const result = await executor.execute(request, error, providers);
if (result.success) {
  console.log('Fallback succeeded with:', result.strategy);
}
```

### 4. Enhanced Circuit Breaker

Circuit breaker pattern with error taxonomy integration:

```typescript
import { createEnhancedCircuitBreaker, CircuitState } from './errors';

const circuitBreaker = createEnhancedCircuitBreaker('api-service', {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
  ignoreErrorTypes: [ErrorType.INVALID_INPUT],
});

try {
  const result = await circuitBreaker.execute(
    () => provider.chat(request),
    { errorType }
  );
} catch (error) {
  if (circuitBreaker.getState() === CircuitState.OPEN) {
    console.log('Circuit is open, use fallback');
  }
}
```

### 5. Dead Letter Queue

Persistent storage for failed requests using R2:

```typescript
import { createDeadLetterQueue, DeadLetterStatus } from './errors';

const dlq = createDeadLetterQueue(bucket, {
  keyPrefix: 'dead-letter-queue',
  defaultTTL: 86400000, // 24 hours
  maxRetries: 3,
  enableAutoRetry: true,
});

// Add failed request
const id = await dlq.add(request, error, errorType, {
  provider: 'openai',
  model: 'gpt-4',
  priority: RetryPriority.HIGH,
});

// Retry failed requests
const result = await dlq.retry(id, async (req) => {
  return await provider.chat(req);
});

// Get metrics
const metrics = await dlq.getMetrics();
console.log('Total entries:', metrics.totalEntries);
console.log('Recovery rate:', metrics.successfulRecoveries);
```

### 6. Error Reporting and Analytics

Comprehensive error tracking and analytics:

```typescript
import { createErrorReporter } from './errors';

const errorReporter = createErrorReporter({
  kv: env.KV,
  enableAggregation: true,
  enableAnalytics: true,
  enableAlerts: true,
});

// Report error
const reportId = await errorReporter.report({
  errorType: ErrorType.RATE_LIMITED,
  message: 'Rate limit exceeded',
  stack: error.stack,
  statusCode: 429,
  provider: 'openai',
  model: 'gpt-4',
});

// Get analytics
const analytics = await errorReporter.getAnalytics(3600000);
console.log('Total errors:', analytics.totalErrors);
console.log('Error trend:', analytics.errorTrend);
console.log('Recovery rate:', analytics.overallRecoveryRate);

// Get user-friendly message
const message = errorReporter.getUserMessage(ErrorType.RATE_LIMITED);
// => "Request rate limited. Please wait and try again."

// Get suggested actions
const actions = errorReporter.getSuggestedActions(ErrorType.RATE_LIMITED);
// => ["Wait a moment before retrying", "Reduce request frequency", ...]
```

### 7. Global Error Handler

Unified error handling integrating all components:

```typescript
import { createGlobalErrorHandler } from './errors';

const errorHandler = createGlobalErrorHandler({
  enableRetry: true,
  enableFallback: true,
  enableCircuitBreaker: true,
  enableDeadLetterQueue: true,
  enableErrorReporting: true,
  maxRetries: 3,
  maxFallbackAttempts: 5,
});

// Register providers
errorHandler.registerProvider('openai', openaiProvider);
errorHandler.registerProvider('anthropic', anthropicProvider);

// Execute with full error handling
try {
  const response = await errorHandler.execute(request, {
    provider: 'openai',
    requestId: 'req-123',
    userId: 'user-456',
  });
  console.log(response);
} catch (error) {
  console.error('All recovery mechanisms failed:', error);
}
```

## Usage Examples

### Basic Error Handling

```typescript
import { classifyError, isRetryable } from './errors';

try {
  const response = await provider.chat(request);
} catch (error) {
  const errorType = classifyError(
    (error as any).status ?? 0,
    error.message
  );

  if (isRetryable(errorType)) {
    // Retry with backoff
    await delay(1000);
    return await provider.chat(request);
  } else {
    // Handle permanent error
    throw error;
  }
}
```

### Advanced Retry with Custom Strategy

```typescript
import { RetryPolicy, BackoffStrategy } from './errors';

const retryPolicy = new RetryPolicy({
  maxRetries: 5,
  baseDelay: 2000,
  maxDelay: 60000,
  strategy: BackoffStrategy.FULL_JITTER,
  backoffMultiplier: 2,
  jitterFactor: 0.5,
  shouldRetry: (error, attempt) => {
    // Custom retry logic
    return attempt < 3 && error.message.includes('timeout');
  },
  onRetry: (error, attempt, delay) => {
    console.log(`Retry ${attempt} after ${delay}ms`);
  },
});

const result = await retryPolicy.execute(async () => {
  return await provider.chat(request);
});
```

### Fallback Chain

```typescript
import { createFallbackExecutor } from './errors';

const executor = createFallbackExecutor(providers);

const result = await executor.execute(request, error, providers);

if (result.success) {
  console.log(`Succeeded with strategy: ${result.strategy}`);
  console.log(`Attempts: ${result.attempts}`);
  console.log(`Time: ${result.totalTime}ms`);
} else {
  console.error('All fallback strategies failed');
}
```

### Production Setup

```typescript
import { createProductionErrorHandler } from './errors';

const errorHandler = createProductionErrorHandler(
  providers,
  env.R2_BUCKET,
  env.KV_NAMESPACE
);

// Configure circuit breaker per provider
const openaiCircuitBreaker = createEnhancedCircuitBreaker('openai', {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
  kv: env.KV_NAMESPACE,
});

// Use in request handler
export async function handleRequest(request: ChatRequest) {
  try {
    return await errorHandler.execute(request);
  } catch (error) {
    // Get user-friendly error message
    const errorType = classifyError(
      (error as any).status ?? 0,
      error.message
    );
    const message = getUserMessage(errorType);

    return {
      error: message,
      suggestions: getSuggestedActions(errorType),
    };
  }
}
```

## Error Types Reference

### Transient Errors (Retryable)

| Error Type | Status Code | Retry Config |
|------------|-------------|--------------|
| `RATE_LIMITED` | 429 | 5 retries, 1s base delay |
| `TIMEOUT` | 408 | 3 retries, 2s base delay |
| `NETWORK_ERROR` | - | 3 retries, 1s base delay |
| `PROVIDER_UNAVAILABLE` | 503 | 3 retries, 5s base delay |
| `SERVICE_UNAVAILABLE` | 503 | 4 retries, 3s base delay |
| `GATEWAY_TIMEOUT` | 504 | 3 retries, 2s base delay |

### Permanent Errors (No Retry)

| Error Type | Status Code | Action |
|------------|-------------|--------|
| `INVALID_INPUT` | 400 | Fix input |
| `UNAUTHORIZED` | 401 | Check credentials |
| `NOT_FOUND` | 404 | Verify resource |
| `QUOTA_EXCEEDED` | 429 | Upgrade plan |
| `INVALID_API_KEY` | 401 | Update API key |
| `ACCOUNT_SUSPENDED` | 403 | Contact support |

### Throttling Errors (Special Retry)

| Error Type | Status Code | Retry Config |
|------------|-------------|--------------|
| `API_RATE_LIMIT` | 429 | 5 retries, 5s base delay |
| `API_OVERLOADED` | 503 | 4 retries, 10s base delay |
| `CONCURRENT_LIMIT` | 429 | 3 retries, 1s base delay |
| `RESOURCE_EXHAUSTED` | 429 | 4 retries, 15s base delay |

## Configuration

### Error Handler Configuration

```typescript
interface ErrorHandlerConfig {
  enableRetry: boolean;              // Enable retry logic
  enableFallback: boolean;           // Enable fallback strategies
  enableCircuitBreaker: boolean;     // Enable circuit breaker
  enableDeadLetterQueue: boolean;    // Enable dead letter queue
  enableErrorReporting: boolean;     // Enable error reporting
  maxRetries: number;                // Maximum retry attempts
  maxFallbackAttempts: number;       // Maximum fallback attempts
  sendToDeadLetterQueue: boolean;    // Send failures to DLQ
  reportErrors: boolean;             // Report errors for analytics
}
```

### Retry Policy Configuration

```typescript
interface RetryPolicyConfig {
  maxRetries: number;           // Maximum retry attempts
  baseDelay: number;            // Base delay in milliseconds
  maxDelay: number;             // Maximum delay in milliseconds
  strategy: BackoffStrategy;    // Backoff strategy
  backoffMultiplier: number;    // Exponential multiplier
  jitterFactor: number;         // Jitter factor (0-1)
  useRetryBudget: boolean;      // Enable retry budget
  retryBudget: number;          // Retry budget per minute
}
```

### Circuit Breaker Configuration

```typescript
interface CircuitBreakerConfig {
  name: string;                      // Circuit name
  failureThreshold: number;          // Failures before opening
  successThreshold: number;          // Successes to close
  timeout: number;                   // Recovery timeout (ms)
  halfOpenMaxCalls: number;          // Max calls in half-open
  failureRateThreshold: number;      // Failure rate threshold (0-1)
  breakOnNonRetryable: boolean;      // Break on permanent errors
  ignoreErrorTypes: ErrorType[];     // Errors to ignore
}
```

## Best Practices

1. **Always classify errors**: Use `classifyError()` to determine error type
2. **Configure appropriate retries**: Transient errors get more retries than permanent ones
3. **Use fallback chains**: Start with provider fallback, end with fail-fast
4. **Monitor circuit breakers**: Track circuit states and metrics
5. **Process dead letter queue**: Regularly retry failed requests
6. **Analyze error patterns**: Use analytics to identify systemic issues
7. **Set appropriate TTLs**: Balance between retry window and storage costs
8. **Implement alerts**: Configure alerts for critical errors

## Testing

```bash
# Run all error handling tests
npm test -- packages/edge/src/lib/errors

# Run specific test file
npm test -- packages/edge/src/lib/errors/types.test.ts

# Run with coverage
npm test -- --coverage packages/edge/src/lib/errors
```

## Performance Considerations

- **Retry delays**: Use appropriate backoff to avoid overwhelming providers
- **Circuit breakers**: Prevent cascading failures by opening circuits early
- **Dead letter queue**: Offload failed requests for async processing
- **Error reporting**: Batch error reports to reduce KV writes
- **Cache fallback**: Use cache to reduce load on failing providers

## Monitoring

Monitor these key metrics:

- Error rate by type and category
- Retry success rate
- Circuit breaker state changes
- Dead letter queue size
- Recovery rate
- Average recovery time

## License

MIT
