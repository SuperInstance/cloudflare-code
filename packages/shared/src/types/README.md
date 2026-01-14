# @claudeflare/shared-types

Shared TypeScript type definitions for the ClaudeFlare platform.

## Overview

This package provides comprehensive type definitions used across all ClaudeFlare packages. All types are strictly typed with zero `any` types and include Zod schemas for runtime validation.

## Features

- **Strict Type Safety**: No `any` types - all types are properly defined
- **Runtime Validation**: Zod schemas for all public types
- **JSDoc Comments**: Comprehensive documentation for all types
- **Type Utilities**: Helper types for common operations
- **Error Classes**: Custom error classes with proper typing

## Installation

```bash
npm install @claudeflare/shared-types
```

## Usage

### Importing Types

```typescript
// Import all types
import * as Types from '@claudeflare/shared-types';

// Import specific types
import { Message, ChatRequest, ChatResponse } from '@claudeflare/shared-types';

// Import with Zod schemas
import { Message, MessageSchema } from '@claudeflare/shared-types';
```

### Core Types

```typescript
import { Message, ChatRequest, ChatResponse } from '@claudeflare/shared-types';

const message: Message = {
  role: 'user',
  content: 'Hello, ClaudeFlare!',
  timestamp: Date.now()
};

const request: ChatRequest = {
  messages: [message],
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000
};
```

### Validation with Zod

```typescript
import { MessageSchema } from '@claudeflare/shared-types';

const result = MessageSchema.safeParse({
  role: 'user',
  content: 'Hello'
});

if (result.success) {
  console.log('Valid message:', result.data);
} else {
  console.error('Validation error:', result.error);
}
```

### Error Handling

```typescript
import {
  APIError,
  RateLimitError,
  ProviderError,
  isRateLimitError,
  extractErrorInfo
} from '@claudeflare/shared-types';

try {
  // API call
} catch (error) {
  if (isRateLimitError(error)) {
    console.log(`Retry after ${error.retryAfter}ms`);
  }

  const info = extractErrorInfo(error);
  console.log('Error info:', info);
}
```

### Type Utilities

```typescript
import {
  Partial,
  Required,
  Pick,
  Omit,
  PartialBy,
  Nullable,
  Dictionary
} from '@claudeflare/shared-types';

// Make specific fields optional
type UserUpdate = PartialBy<User, 'email' | 'name'>;

// Create a dictionary
type Cache = Dictionary<string, number>;

// Nullable type
type OptionalUser = Nullable<User>;
```

## Type Categories

### Core Types (`core.ts`)

- `Message` - Chat message structure
- `ChatRequest` - LLM request parameters
- `ChatResponse` - LLM response structure
- `StreamChunk` - Streaming response chunk
- `RequestContext` - Request context for routing
- `RoutingRequest` - Routing decision request
- `TokenUsage` - Token usage information
- Enums: `MessageRole`, `QualityTier`, `TaskType`

### Storage Types (`storage.ts`)

- `SessionData` - Session data structure
- `SessionMetadata` - Session metadata
- `CacheEntry<T>` - Generic cache entry
- `CacheStats` - Cache statistics
- `CacheConfig` - Cache configuration
- `SemanticCacheEntry` - Semantic cache entry
- `StorageConfig` - Storage backend configuration
- Enums: `SessionStatus`, `StorageBackend`

### Provider Types (`providers.ts`)

- `Provider` - AI provider configuration
- `ProviderConfig` - Provider configuration options
- `ProviderPerformance` - Performance metrics
- `ProviderAvailability` - Availability status
- `ProviderConstraints` - Technical constraints
- `ProviderHealth` - Health status
- `ProviderRequest` - Provider API request
- `ProviderResponse` - Provider API response
- Enums: `ProviderFeature`, `RateLimitStatus`

### Metrics Types (`metrics.ts`)

- `RequestMetrics` - Request-level metrics
- `AggregatedMetrics` - Time-aggregated metrics
- `QuotaInfo` - Provider quota information
- `UserQuota` - User quota information
- `ProviderMetrics` - Provider performance metrics
- `CacheMetrics` - Cache performance metrics
- `CostBreakdown` - Cost breakdown by provider
- `CostSummary` - Cost summary over time
- `MetricAlert` - Alert configuration
- Enums: `QuotaStatus`, `AlertCondition`, `AlertSeverity`, `CostTrend`

### Error Types (`errors.ts`)

- `APIError` - Base API error class
- `RateLimitError` - Rate limit exceeded
- `ProviderError` - Provider request failed
- `ValidationError` - Input validation failed
- `QuotaExceededError` - Quota limit exceeded
- `CacheError` - Cache operation failed
- `RoutingError` - Routing failed
- `SessionError` - Session operation failed
- Type guards: `isAPIError`, `isRateLimitError`, etc.

### Utils Types (`utils.ts`)

- Type transformations: `Partial`, `Required`, `Pick`, `Omit`
- Advanced types: `DeepPartial`, `PartialBy`, `RequiredBy`
- String types: `CamelCase`, `PascalCase`, `SnakeCase`, `KebabCase`
- Function types: `ReturnType`, `Parameters`, `Promisify`
- Collection types: `Dictionary`, `EventMap`
- Type guards: `isString`, `isNumber`, `isObject`, etc.

## Type Safety Guarantees

All types in this package adhere to:

- ✅ **No `any` types** - All types are properly defined
- ✅ **Strict null checks** - All nullable types are explicit
- ✅ **Proper exports** - All public types are exported
- ✅ **Zod schemas** - Runtime validation schemas match TypeScript types
- ✅ **JSDoc comments** - All public types are documented

## Contributing

When adding new types:

1. Add type definition to appropriate file
2. Create corresponding Zod schema
3. Add comprehensive JSDoc comments
4. Export from `index.ts`
5. Add usage examples to this README

## License

MIT
