/**
 * Test Fixtures - Response Data
 *
 * Sample API responses for testing
 */

import type { ChatResponse, Model, ModelsResponse, HealthResponse, StatusResponse, ErrorResponse } from '../../src/types';

/**
 * Successful chat responses
 */
export const successfulChatResponses = {
  simpleText: {
    id: 'msg-abc123',
    content: 'Hello! I am doing well, thank you for asking. How can I help you today?',
    model: 'claude-3-opus-20240229',
    provider: 'anthropic',
    finishReason: 'stop',
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    },
    timestamp: 1704067200000,
  } as ChatResponse,

  codeResponse: {
    id: 'msg-def456',
    content: 'Here is a TypeScript function to calculate fibonacci numbers:\n\n```typescript\nfunction fibonacci(n: number): number {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n```',
    model: 'claude-3-opus-20240229',
    provider: 'anthropic',
    finishReason: 'stop',
    usage: {
      promptTokens: 25,
      completionTokens: 80,
      totalTokens: 105,
    },
    timestamp: 1704067200000,
  } as ChatResponse,

  longResponse: {
    id: 'msg-ghi789',
    content: 'A'.repeat(5000),
    model: 'claude-3-opus-20240229',
    provider: 'anthropic',
    finishReason: 'length',
    usage: {
      promptTokens: 10,
      completionTokens: 4000,
      totalTokens: 4010,
    },
    timestamp: 1704067200000,
  } as ChatResponse,

  streamingChunk: {
    id: 'msg-jkl012',
    content: 'Hello',
    model: 'claude-3-opus-20240229',
    provider: 'anthropic',
    finishReason: 'stop',
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    },
    timestamp: 1704067200000,
  } as ChatResponse,

  multiLanguage: {
    id: 'msg-mno345',
    content: 'Hello! / Bonjour! / ¡Hola! / こんにちは! / 안녕하세요!',
    model: 'claude-3-opus-20240229',
    provider: 'anthropic',
    finishReason: 'stop',
    usage: {
      promptTokens: 10,
      completionTokens: 25,
      totalTokens: 35,
    },
    timestamp: 1704067200000,
  } as ChatResponse,
};

/**
 * Model information
 */
export const modelFixtures = {
  anthropicModels: [
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      contextLength: 200000,
      description: 'Most powerful model for complex tasks',
      capabilities: {
        streaming: true,
        functionCalling: true,
        vision: true,
      },
      pricing: {
        inputCostPer1K: 0.015,
        outputCostPer1K: 0.075,
      },
    },
    {
      id: 'claude-3-sonnet-20240229',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      contextLength: 200000,
      description: 'Balanced model for most tasks',
      capabilities: {
        streaming: true,
        functionCalling: true,
        vision: true,
      },
      pricing: {
        inputCostPer1K: 0.003,
        outputCostPer1K: 0.015,
      },
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      contextLength: 200000,
      description: 'Fastest model for simple tasks',
      capabilities: {
        streaming: true,
        functionCalling: true,
        vision: true,
      },
      pricing: {
        inputCostPer1K: 0.00025,
        outputCostPer1K: 0.00125,
      },
    },
  ] as Model[],

  openaiModels: [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      provider: 'openai',
      contextLength: 8192,
      description: 'OpenAI\'s most capable model',
      capabilities: {
        streaming: true,
        functionCalling: true,
        vision: false,
      },
      pricing: {
        inputCostPer1K: 0.03,
        outputCostPer1K: 0.06,
      },
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      contextLength: 16385,
      description: 'Fast and efficient model',
      capabilities: {
        streaming: true,
        functionCalling: true,
        vision: false,
      },
      pricing: {
        inputCostPer1K: 0.0005,
        outputCostPer1K: 0.0015,
      },
    },
  ] as Model[],

  allModels: {
    models: [
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        contextLength: 200000,
        description: 'Most powerful model for complex tasks',
        capabilities: {
          streaming: true,
          functionCalling: true,
          vision: true,
        },
        pricing: {
          inputCostPer1K: 0.015,
          outputCostPer1K: 0.075,
        },
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        provider: 'anthropic',
        contextLength: 200000,
        description: 'Balanced model for most tasks',
        capabilities: {
          streaming: true,
          functionCalling: true,
          vision: true,
        },
        pricing: {
          inputCostPer1K: 0.003,
          outputCostPer1K: 0.015,
        },
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        contextLength: 200000,
        description: 'Fastest model for simple tasks',
        capabilities: {
          streaming: true,
          functionCalling: true,
          vision: true,
        },
        pricing: {
          inputCostPer1K: 0.00025,
          outputCostPer1K: 0.00125,
        },
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
        contextLength: 8192,
        description: 'OpenAI\'s most capable model',
        capabilities: {
          streaming: true,
          functionCalling: true,
          vision: false,
        },
        pricing: {
          inputCostPer1K: 0.03,
          outputCostPer1K: 0.06,
        },
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        contextLength: 16385,
        description: 'Fast and efficient model',
        capabilities: {
          streaming: true,
          functionCalling: true,
          vision: false,
        },
        pricing: {
          inputCostPer1K: 0.0005,
          outputCostPer1K: 0.0015,
        },
      },
    ],
    count: 5,
    timestamp: 1704067200000,
  } as ModelsResponse,
};

/**
 * Health check responses
 */
export const healthCheckResponses = {
  healthy: {
    status: 'healthy',
    timestamp: 1704067200000,
    version: '0.1.0',
    environment: 'production',
    uptime: 3600000,
  } as HealthResponse,

  degraded: {
    status: 'degraded',
    timestamp: 1704067200000,
    version: '0.1.0',
    environment: 'production',
    uptime: 3600000,
  } as HealthResponse,

  unhealthy: {
    status: 'unhealthy',
    timestamp: 1704067200000,
    version: '0.1.0',
    environment: 'production',
    uptime: 3600000,
  } as HealthResponse,
};

/**
 * Status responses
 */
export const statusResponses = {
  operational: {
    status: 'operational',
    version: '0.1.0',
    environment: 'production',
    timestamp: 1704067200000,
    services: {
      api: true,
      cache: true,
      storage: true,
      database: true,
      queue: true,
    },
    metrics: {
      requestsPerSecond: 1000,
      averageLatency: 50,
      errorRate: 0.001,
    },
  } as StatusResponse,

  degraded: {
    status: 'degraded',
    version: '0.1.0',
    environment: 'production',
    timestamp: 1704067200000,
    services: {
      api: true,
      cache: false,
      storage: true,
      database: true,
      queue: true,
    },
    metrics: {
      requestsPerSecond: 500,
      averageLatency: 200,
      errorRate: 0.05,
    },
  } as StatusResponse,

  down: {
    status: 'down',
    version: '0.1.0',
    environment: 'production',
    timestamp: 1704067200000,
    services: {
      api: false,
      cache: false,
      storage: false,
      database: false,
      queue: false,
    },
    metrics: {
      requestsPerSecond: 0,
      averageLatency: 0,
      errorRate: 1,
    },
  } as StatusResponse,
};

/**
 * Error responses
 */
export const errorResponses = {
  validationError: {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: {
        field: 'messages',
        issue: 'Must not be empty',
        code: 'invalid_type',
      },
      requestId: 'req-123',
      timestamp: 1704067200000,
    },
  } as ErrorResponse,

  notFound: {
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found',
      requestId: 'req-123',
      timestamp: 1704067200000,
    },
  } as ErrorResponse,

  modelNotFound: {
    error: {
      code: 'MODEL_NOT_FOUND',
      message: 'Model "unknown-model" not found',
      requestId: 'req-123',
      timestamp: 1704067200000,
    },
  } as ErrorResponse,

  unauthorized: {
    error: {
      code: 'UNAUTHORIZED',
      message: 'Invalid or missing API key',
      requestId: 'req-123',
      timestamp: 1704067200000,
    },
  } as ErrorResponse,

  rateLimitExceeded: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded',
      details: {
        retryAfter: 60,
      },
      requestId: 'req-123',
      timestamp: 1704067200000,
    },
  } as ErrorResponse,

  internalError: {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal server error occurred',
      requestId: 'req-123',
      timestamp: 1704067200000,
    },
  } as ErrorResponse,

  timeout: {
    error: {
      code: 'TIMEOUT',
      message: 'Request timed out',
      requestId: 'req-123',
      timestamp: 1704067200000,
    },
  } as ErrorResponse,

  upstreamError: {
    error: {
      code: 'UPSTREAM_ERROR',
      message: 'Error communicating with upstream provider',
      details: {
        provider: 'anthropic',
        originalError: 'Connection timeout',
      },
      requestId: 'req-123',
      timestamp: 1704067200000,
    },
  } as ErrorResponse,
};

/**
 * Streaming responses
 */
export const streamingFixtures = {
  chunks: [
    'Hello',
    ' there',
    '!',
    ' How',
    ' can',
    ' I',
    ' help',
    ' you',
    ' today',
    '?',
  ],

  sseChunks: [
    'data: {"content":"Hello","done":false}\n\n',
    'data: {"content":" there","done":false}\n\n',
    'data: {"content":"!","done":false}\n\n',
    'data: {"content":"","done":true}\n\n',
  ],
};

/**
 * Cache responses
 */
export const cacheFixtures = {
  hit: {
    response: 'This is a cached response',
    metadata: {
      model: 'claude-3-opus-20240229',
      tokens: 100,
      cost: 0.01,
      latency: 50,
    },
    timestamp: 1704067200000,
  },

  miss: null,
};

/**
 * Performance benchmarks
 */
export const performanceBenchmarks = {
  latency: {
    excellent: 10,      // < 10ms
    good: 50,           // < 50ms
    acceptable: 200,    // < 200ms
    poor: 1000,         // < 1000ms
  },

  throughput: {
    low: 10,            // 10 req/s
    medium: 100,        // 100 req/s
    high: 1000,         // 1000 req/s
    veryHigh: 10000,    // 10000 req/s
  },

  cacheHitRate: {
    poor: 0.5,          // 50%
    good: 0.8,          // 80%
    excellent: 0.95,    // 95%
  },
};
