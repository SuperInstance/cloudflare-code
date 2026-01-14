/**
 * Error Taxonomy and Classification System
 *
 * Comprehensive error classification for ClaudeFlare platform.
 * Defines error types, categories, and their characteristics for
 * intelligent retry, fallback, and recovery strategies.
 */

// ============================================================================
// ERROR TYPE ENUMERATION
// ============================================================================

/**
 * Error types with retry and recovery behavior
 */
export enum ErrorType {
  // Transient errors (should retry with backoff)
  /** Rate limited by API - retry with exponential backoff */
  RATE_LIMITED = 'rate_limited',
  /** Request timeout - retry with longer timeout */
  TIMEOUT = 'timeout',
  /** Network connectivity issue - retry */
  NETWORK_ERROR = 'network_error',
  /** Provider temporarily unavailable - retry with fallback */
  PROVIDER_UNAVAILABLE = 'provider_unavailable',
  /** Temporary service disruption - retry */
  SERVICE_UNAVAILABLE = 'service_unavailable',
  /** Gateway timeout - retry with alternative route */
  GATEWAY_TIMEOUT = 'gateway_timeout',

  // Permanent errors (do not retry, fail immediately)
  /** Invalid request parameters - do not retry */
  INVALID_INPUT = 'invalid_input',
  /** Authentication/authorization failed - do not retry */
  UNAUTHORIZED = 'unauthorized',
  /** Resource not found - do not retry */
  NOT_FOUND = 'not_found',
  /** Quota permanently exceeded - do not retry */
  QUOTA_EXCEEDED = 'quota_exceeded',
  /** Method not supported - do not retry */
  NOT_SUPPORTED = 'not_supported',
  /** Invalid API key - do not retry */
  INVALID_API_KEY = 'invalid_api_key',
  /** Account suspended - do not retry */
  ACCOUNT_SUSPENDED = 'account_suspended',
  /** Feature not enabled - do not retry */
  FEATURE_NOT_ENABLED = 'feature_not_enabled',

  // Throttling errors (special retry with longer backoff)
  /** API rate limit - retry with respect to rate limits */
  API_RATE_LIMIT = 'api_rate_limit',
  /** Provider overloaded - retry with significant backoff */
  API_OVERLOADED = 'api_overloaded',
  /** Concurrent request limit - retry with serialization */
  CONCURRENT_LIMIT = 'concurrent_limit',
  /** Resource exhausted - retry after cooldown */
  RESOURCE_EXHAUSTED = 'resource_exhausted',

  // Content errors (may retry with modification)
  /** Content policy violation - may retry with different content */
  CONTENT_POLICY = 'content_policy',
  /** Content filtered - may retry with alternative */
  CONTENT_FILTERED = 'content_filtered',
  /** Response incomplete - may retry */
  INCOMPLETE_RESPONSE = 'incomplete_response',

  // System errors (log and monitor)
  /** Internal system error - monitor for patterns */
  INTERNAL_ERROR = 'internal_error',
  /** Unknown error - investigate */
  UNKNOWN_ERROR = 'unknown_error',
}

// ============================================================================
// ERROR CATEGORIES
// ============================================================================

/**
 * High-level error categories for grouping
 */
export enum ErrorCategory {
  /** Errors that may succeed on retry */
  TRANSIENT = 'transient',
  /** Errors that will never succeed */
  PERMANENT = 'permanent',
  /** Errors requiring special retry handling */
  THROTTLING = 'throttling',
  /** Errors related to content filtering */
  CONTENT = 'content',
  /** Internal system errors */
  SYSTEM = 'system',
}

// ============================================================================
// ERROR SEVERITY LEVELS
// ============================================================================

/**
 * Error severity for alerting and monitoring
 */
export enum ErrorSeverity {
  /** Critical - immediate attention required */
  CRITICAL = 'critical',
  /** High - investigate soon */
  HIGH = 'high',
  /** Medium - monitor */
  MEDIUM = 'medium',
  /** Low - informational */
  LOW = 'low',
}

// ============================================================================
// ERROR METADATA
// ============================================================================

/**
 * Retry configuration for an error type
 */
export interface RetryConfig {
  /** Whether this error type should be retried */
  retryable: boolean;
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Jitter factor (0-1) */
  jitterFactor: number;
  /** Whether to use fallback providers */
  useFallback: boolean;
}

/**
 * Error metadata with recovery guidance
 */
export interface ErrorMetadata {
  /** Error type */
  type: ErrorType;
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** HTTP status code (if applicable) */
  statusCode?: number;
  /** Whether error is retryable */
  retryable: boolean;
  /** Retry configuration */
  retryConfig: RetryConfig;
  /** User-friendly message */
  userMessage: string;
  /** Suggested actions */
  suggestedActions: string[];
  /** Related documentation links */
  docsLinks?: string[];
}

// ============================================================================
// ERROR CLASSIFICATION MAPPING
// ============================================================================

/**
 * Comprehensive error type definitions with metadata
 */
export const ErrorDefinitions: Record<ErrorType, ErrorMetadata> = {
  // Transient errors
  [ErrorType.RATE_LIMITED]: {
    type: ErrorType.RATE_LIMITED,
    category: ErrorCategory.TRANSIENT,
    severity: ErrorSeverity.MEDIUM,
    statusCode: 429,
    retryable: true,
    retryConfig: {
      retryable: true,
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 60000,
      backoffMultiplier: 2,
      jitterFactor: 0.2,
      useFallback: true,
    },
    userMessage: 'Request rate limited. Please wait and try again.',
    suggestedActions: [
      'Wait a moment before retrying',
      'Reduce request frequency',
      'Check rate limit status',
    ],
    docsLinks: ['/docs/rate-limiting'],
  },

  [ErrorType.TIMEOUT]: {
    type: ErrorType.TIMEOUT,
    category: ErrorCategory.TRANSIENT,
    severity: ErrorSeverity.MEDIUM,
    statusCode: 408,
    retryable: true,
    retryConfig: {
      retryable: true,
      maxRetries: 3,
      baseDelay: 2000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitterFactor: 0.15,
      useFallback: true,
    },
    userMessage: 'Request timed out. Please try again.',
    suggestedActions: [
      'Try again with a shorter request',
      'Check network connectivity',
      'Use alternative provider',
    ],
  },

  [ErrorType.NETWORK_ERROR]: {
    type: ErrorType.NETWORK_ERROR,
    category: ErrorCategory.TRANSIENT,
    severity: ErrorSeverity.HIGH,
    retryable: true,
    retryConfig: {
      retryable: true,
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitterFactor: 0.3,
      useFallback: true,
    },
    userMessage: 'Network error occurred. Please check your connection.',
    suggestedActions: [
      'Check internet connection',
      'Try again shortly',
      'Use alternative provider',
    ],
  },

  [ErrorType.PROVIDER_UNAVAILABLE]: {
    type: ErrorType.PROVIDER_UNAVAILABLE,
    category: ErrorCategory.TRANSIENT,
    severity: ErrorSeverity.HIGH,
    statusCode: 503,
    retryable: true,
    retryConfig: {
      retryable: true,
      maxRetries: 3,
      baseDelay: 5000,
      maxDelay: 120000,
      backoffMultiplier: 2,
      jitterFactor: 0.25,
      useFallback: true,
    },
    userMessage: 'Service is temporarily unavailable. Please try again.',
    suggestedActions: [
      'Wait a moment and retry',
      'Try alternative provider',
      'Check service status page',
    ],
  },

  [ErrorType.SERVICE_UNAVAILABLE]: {
    type: ErrorType.SERVICE_UNAVAILABLE,
    category: ErrorCategory.TRANSIENT,
    severity: ErrorSeverity.HIGH,
    statusCode: 503,
    retryable: true,
    retryConfig: {
      retryable: true,
      maxRetries: 4,
      baseDelay: 3000,
      maxDelay: 60000,
      backoffMultiplier: 2,
      jitterFactor: 0.2,
      useFallback: true,
    },
    userMessage: 'Service temporarily unavailable. Please try again.',
    suggestedActions: [
      'Retry after a short delay',
      'Check service status',
      'Use fallback provider',
    ],
  },

  [ErrorType.GATEWAY_TIMEOUT]: {
    type: ErrorType.GATEWAY_TIMEOUT,
    category: ErrorCategory.TRANSIENT,
    severity: ErrorSeverity.MEDIUM,
    statusCode: 504,
    retryable: true,
    retryConfig: {
      retryable: true,
      maxRetries: 3,
      baseDelay: 2000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitterFactor: 0.2,
      useFallback: true,
    },
    userMessage: 'Gateway timeout. Please try again.',
    suggestedActions: [
      'Retry the request',
      'Reduce request complexity',
      'Use alternative provider',
    ],
  },

  // Permanent errors
  [ErrorType.INVALID_INPUT]: {
    type: ErrorType.INVALID_INPUT,
    category: ErrorCategory.PERMANENT,
    severity: ErrorSeverity.LOW,
    statusCode: 400,
    retryable: false,
    retryConfig: {
      retryable: false,
      maxRetries: 0,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitterFactor: 0,
      useFallback: false,
    },
    userMessage: 'Invalid request. Please check your input.',
    suggestedActions: [
      'Verify request parameters',
      'Check input format',
      'Review API documentation',
    ],
    docsLinks: ['/docs/api-reference'],
  },

  [ErrorType.UNAUTHORIZED]: {
    type: ErrorType.UNAUTHORIZED,
    category: ErrorCategory.PERMANENT,
    severity: ErrorSeverity.HIGH,
    statusCode: 401,
    retryable: false,
    retryConfig: {
      retryable: false,
      maxRetries: 0,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitterFactor: 0,
      useFallback: false,
    },
    userMessage: 'Authentication failed. Please check your credentials.',
    suggestedActions: [
      'Verify API key is valid',
      'Check account status',
      'Update credentials',
    ],
    docsLinks: ['/docs/authentication'],
  },

  [ErrorType.NOT_FOUND]: {
    type: ErrorType.NOT_FOUND,
    category: ErrorCategory.PERMANENT,
    severity: ErrorSeverity.LOW,
    statusCode: 404,
    retryable: false,
    retryConfig: {
      retryable: false,
      maxRetries: 0,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitterFactor: 0,
      useFallback: false,
    },
    userMessage: 'Requested resource not found.',
    suggestedActions: [
      'Verify resource identifier',
      'Check if resource exists',
      'Review available resources',
    ],
  },

  [ErrorType.QUOTA_EXCEEDED]: {
    type: ErrorType.QUOTA_EXCEEDED,
    category: ErrorCategory.PERMANENT,
    severity: ErrorSeverity.HIGH,
    statusCode: 429,
    retryable: false,
    retryConfig: {
      retryable: false,
      maxRetries: 0,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitterFactor: 0,
      useFallback: false,
    },
    userMessage: 'Quota exceeded. Please upgrade your plan.',
    suggestedActions: [
      'Upgrade to higher tier',
      'Wait for quota reset',
      'Reduce usage',
    ],
    docsLinks: ['/docs/pricing', '/docs/quotas'],
  },

  [ErrorType.NOT_SUPPORTED]: {
    type: ErrorType.NOT_SUPPORTED,
    category: ErrorCategory.PERMANENT,
    severity: ErrorSeverity.MEDIUM,
    statusCode: 501,
    retryable: false,
    retryConfig: {
      retryable: false,
      maxRetries: 0,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitterFactor: 0,
      useFallback: false,
    },
    userMessage: 'This feature is not supported.',
    suggestedActions: [
      'Check available features',
      'Use alternative method',
      'Contact support',
    ],
  },

  [ErrorType.INVALID_API_KEY]: {
    type: ErrorType.INVALID_API_KEY,
    category: ErrorCategory.PERMANENT,
    severity: ErrorSeverity.CRITICAL,
    statusCode: 401,
    retryable: false,
    retryConfig: {
      retryable: false,
      maxRetries: 0,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitterFactor: 0,
      useFallback: false,
    },
    userMessage: 'Invalid API key provided.',
    suggestedActions: [
      'Verify API key',
      'Generate new API key',
      'Check account status',
    ],
    docsLinks: ['/docs/api-keys'],
  },

  [ErrorType.ACCOUNT_SUSPENDED]: {
    type: ErrorType.ACCOUNT_SUSPENDED,
    category: ErrorCategory.PERMANENT,
    severity: ErrorSeverity.CRITICAL,
    statusCode: 403,
    retryable: false,
    retryConfig: {
      retryable: false,
      maxRetries: 0,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitterFactor: 0,
      useFallback: false,
    },
    userMessage: 'Account has been suspended. Please contact support.',
    suggestedActions: [
      'Contact support',
      'Check email for details',
      'Review account status',
    ],
  },

  [ErrorType.FEATURE_NOT_ENABLED]: {
    type: ErrorType.FEATURE_NOT_ENABLED,
    category: ErrorCategory.PERMANENT,
    severity: ErrorSeverity.MEDIUM,
    statusCode: 403,
    retryable: false,
    retryConfig: {
      retryable: false,
      maxRetries: 0,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitterFactor: 0,
      useFallback: false,
    },
    userMessage: 'This feature is not enabled on your account.',
    suggestedActions: [
      'Enable feature in settings',
      'Upgrade plan if needed',
      'Contact support',
    ],
    docsLinks: ['/docs/features'],
  },

  // Throttling errors
  [ErrorType.API_RATE_LIMIT]: {
    type: ErrorType.API_RATE_LIMIT,
    category: ErrorCategory.THROTTLING,
    severity: ErrorSeverity.MEDIUM,
    statusCode: 429,
    retryable: true,
    retryConfig: {
      retryable: true,
      maxRetries: 5,
      baseDelay: 5000,
      maxDelay: 120000,
      backoffMultiplier: 2,
      jitterFactor: 0.3,
      useFallback: true,
    },
    userMessage: 'API rate limit reached. Please wait before retrying.',
    suggestedActions: [
      'Wait for rate limit reset',
      'Reduce request rate',
      'Implement request queuing',
    ],
    docsLinks: ['/docs/rate-limits'],
  },

  [ErrorType.API_OVERLOADED]: {
    type: ErrorType.API_OVERLOADED,
    category: ErrorCategory.THROTTLING,
    severity: ErrorSeverity.HIGH,
    statusCode: 503,
    retryable: true,
    retryConfig: {
      retryable: true,
      maxRetries: 4,
      baseDelay: 10000,
      maxDelay: 300000,
      backoffMultiplier: 2.5,
      jitterFactor: 0.4,
      useFallback: true,
    },
    userMessage: 'API is currently overloaded. Please try again later.',
    suggestedActions: [
      'Wait longer before retrying',
      'Use alternative provider',
      'Implement request batching',
    ],
  },

  [ErrorType.CONCURRENT_LIMIT]: {
    type: ErrorType.CONCURRENT_LIMIT,
    category: ErrorCategory.THROTTLING,
    severity: ErrorSeverity.MEDIUM,
    statusCode: 429,
    retryable: true,
    retryConfig: {
      retryable: true,
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 5000,
      backoffMultiplier: 1.5,
      jitterFactor: 0.5,
      useFallback: false,
    },
    userMessage: 'Too many concurrent requests. Please serialize requests.',
    suggestedActions: [
      'Reduce concurrent requests',
      'Implement request queuing',
      'Use connection pooling',
    ],
  },

  [ErrorType.RESOURCE_EXHAUSTED]: {
    type: ErrorType.RESOURCE_EXHAUSTED,
    category: ErrorCategory.THROTTLING,
    severity: ErrorSeverity.HIGH,
    statusCode: 429,
    retryable: true,
    retryConfig: {
      retryable: true,
      maxRetries: 4,
      baseDelay: 15000,
      maxDelay: 300000,
      backoffMultiplier: 2,
      jitterFactor: 0.3,
      useFallback: true,
    },
    userMessage: 'Resource temporarily exhausted. Please wait.',
    suggestedActions: [
      'Wait before retrying',
      'Reduce resource usage',
      'Contact support if persistent',
    ],
  },

  // Content errors
  [ErrorType.CONTENT_POLICY]: {
    type: ErrorType.CONTENT_POLICY,
    category: ErrorCategory.CONTENT,
    severity: ErrorSeverity.MEDIUM,
    statusCode: 400,
    retryable: false,
    retryConfig: {
      retryable: false,
      maxRetries: 0,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitterFactor: 0,
      useFallback: false,
    },
    userMessage: 'Content violates policy. Please modify your request.',
    suggestedActions: [
      'Review content guidelines',
      'Modify request content',
      'Contact support for clarification',
    ],
    docsLinks: ['/docs/content-policy'],
  },

  [ErrorType.CONTENT_FILTERED]: {
    type: ErrorType.CONTENT_FILTERED,
    category: ErrorCategory.CONTENT,
    severity: ErrorSeverity.LOW,
    statusCode: 200,
    retryable: false,
    retryConfig: {
      retryable: false,
      maxRetries: 0,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitterFactor: 0,
      useFallback: false,
    },
    userMessage: 'Content was filtered by safety measures.',
    suggestedActions: [
      'Review safety guidelines',
      'Rephrase request',
      'Try alternative approach',
    ],
  },

  [ErrorType.INCOMPLETE_RESPONSE]: {
    type: ErrorType.INCOMPLETE_RESPONSE,
    category: ErrorCategory.CONTENT,
    severity: ErrorSeverity.MEDIUM,
    statusCode: 206,
    retryable: true,
    retryConfig: {
      retryable: true,
      maxRetries: 2,
      baseDelay: 1000,
      maxDelay: 5000,
      backoffMultiplier: 1.5,
      jitterFactor: 0.2,
      useFallback: false,
    },
    userMessage: 'Response was incomplete. Please try again.',
    suggestedActions: [
      'Retry the request',
      'Reduce request complexity',
      'Check for partial response',
    ],
  },

  // System errors
  [ErrorType.INTERNAL_ERROR]: {
    type: ErrorType.INTERNAL_ERROR,
    category: ErrorCategory.SYSTEM,
    severity: ErrorSeverity.CRITICAL,
    statusCode: 500,
    retryable: true,
    retryConfig: {
      retryable: true,
      maxRetries: 2,
      baseDelay: 1000,
      maxDelay: 5000,
      backoffMultiplier: 2,
      jitterFactor: 0.2,
      useFallback: true,
    },
    userMessage: 'An internal error occurred. Please try again.',
    suggestedActions: [
      'Retry the request',
      'Report issue if persistent',
      'Check system status',
    ],
  },

  [ErrorType.UNKNOWN_ERROR]: {
    type: ErrorType.UNKNOWN_ERROR,
    category: ErrorCategory.SYSTEM,
    severity: ErrorSeverity.HIGH,
    retryable: true,
    retryConfig: {
      retryable: true,
      maxRetries: 2,
      baseDelay: 2000,
      maxDelay: 10000,
      backoffMultiplier: 1.5,
      jitterFactor: 0.3,
      useFallback: true,
    },
    userMessage: 'An unexpected error occurred. Please try again.',
    suggestedActions: [
      'Retry the request',
      'Check request format',
      'Contact support if persistent',
    ],
  },
};

// ============================================================================
// ERROR CLASSIFICATION UTILITIES
// ============================================================================

/**
 * Classify an error based on status code and message
 */
export function classifyError(
  statusCode: number,
  message: string
): ErrorType {
  const normalizedMessage = message.toLowerCase();

  // Check for specific error patterns first
  if (statusCode === 429) {
    if (normalizedMessage.includes('rate limit') || normalizedMessage.includes('rate-limit')) {
      return ErrorType.RATE_LIMITED;
    }
    if (normalizedMessage.includes('quota')) {
      return ErrorType.QUOTA_EXCEEDED;
    }
    if (normalizedMessage.includes('concurrent')) {
      return ErrorType.CONCURRENT_LIMIT;
    }
    if (normalizedMessage.includes('resource')) {
      return ErrorType.RESOURCE_EXHAUSTED;
    }
    return ErrorType.API_RATE_LIMIT;
  }

  if (statusCode === 401) {
    if (normalizedMessage.includes('api key') || normalizedMessage.includes('apikey')) {
      return ErrorType.INVALID_API_KEY;
    }
    if (normalizedMessage.includes('suspended')) {
      return ErrorType.ACCOUNT_SUSPENDED;
    }
    return ErrorType.UNAUTHORIZED;
  }

  if (statusCode === 403) {
    if (normalizedMessage.includes('suspended')) {
      return ErrorType.ACCOUNT_SUSPENDED;
    }
    if (normalizedMessage.includes('feature') || normalizedMessage.includes('enabled')) {
      return ErrorType.FEATURE_NOT_ENABLED;
    }
    return ErrorType.UNAUTHORIZED;
  }

  if (statusCode === 404) {
    return ErrorType.NOT_FOUND;
  }

  if (statusCode === 408) {
    return ErrorType.TIMEOUT;
  }

  if (statusCode === 429 || statusCode === 503) {
    if (normalizedMessage.includes('overload') || normalizedMessage.includes('overloaded')) {
      return ErrorType.API_OVERLOADED;
    }
    if (normalizedMessage.includes('unavailable')) {
      return ErrorType.SERVICE_UNAVAILABLE;
    }
    return ErrorType.SERVICE_UNAVAILABLE;
  }

  if (statusCode === 500) {
    return ErrorType.INTERNAL_ERROR;
  }

  if (statusCode === 501) {
    return ErrorType.NOT_SUPPORTED;
  }

  if (statusCode === 504) {
    return ErrorType.GATEWAY_TIMEOUT;
  }

  // Classify by message patterns
  if (normalizedMessage.includes('timeout')) {
    return ErrorType.TIMEOUT;
  }
  if (normalizedMessage.includes('network') || normalizedMessage.includes('connection')) {
    return ErrorType.NETWORK_ERROR;
  }
  if (normalizedMessage.includes('rate limit')) {
    return ErrorType.RATE_LIMITED;
  }
  if (normalizedMessage.includes('quota')) {
    return ErrorType.QUOTA_EXCEEDED;
  }
  if (normalizedMessage.includes('policy') || normalizedMessage.includes('violation')) {
    return ErrorType.CONTENT_POLICY;
  }
  if (normalizedMessage.includes('filter')) {
    return ErrorType.CONTENT_FILTERED;
  }
  if (normalizedMessage.includes('incomplete')) {
    return ErrorType.INCOMPLETE_RESPONSE;
  }

  // Default to unknown
  return ErrorType.UNKNOWN_ERROR;
}

/**
 * Get error metadata for an error type
 */
export function getErrorMetadata(errorType: ErrorType): ErrorMetadata {
  return ErrorDefinitions[errorType];
}

/**
 * Check if an error type is retryable
 */
export function isRetryable(errorType: ErrorType): boolean {
  return ErrorDefinitions[errorType].retryable;
}

/**
 * Check if an error type should use fallback
 */
export function shouldUseFallback(errorType: ErrorType): boolean {
  return ErrorDefinitions[errorType].retryConfig.useFallback;
}

/**
 * Get retry configuration for an error type
 */
export function getRetryConfig(errorType: ErrorType): RetryConfig {
  return ErrorDefinitions[errorType].retryConfig;
}

/**
 * Get user-friendly message for an error type
 */
export function getUserMessage(errorType: ErrorType): string {
  return ErrorDefinitions[errorType].userMessage;
}

/**
 * Get suggested actions for an error type
 */
export function getSuggestedActions(errorType: ErrorType): string[] {
  return ErrorDefinitions[errorType].suggestedActions;
}

/**
 * Get error severity for monitoring
 */
export function getErrorSeverity(errorType: ErrorType): ErrorSeverity {
  return ErrorDefinitions[errorType].severity;
}

/**
 * Get error category for grouping
 */
export function getErrorCategory(errorType: ErrorType): ErrorCategory {
  return ErrorDefinitions[errorType].category;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if value is valid ErrorType
 */
export function isErrorType(value: string): value is ErrorType {
  return Object.values(ErrorType).includes(value as ErrorType);
}

/**
 * Check if value is valid ErrorCategory
 */
export function isErrorCategory(value: string): value is ErrorCategory {
  return Object.values(ErrorCategory).includes(value as ErrorCategory);
}

/**
 * Check if value is valid ErrorSeverity
 */
export function isErrorSeverity(value: string): value is ErrorSeverity {
  return Object.values(ErrorSeverity).includes(value as ErrorSeverity);
}
