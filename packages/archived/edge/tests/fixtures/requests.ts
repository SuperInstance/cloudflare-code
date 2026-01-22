/**
 * Test Fixtures - Request Data
 *
 * Sample request data for testing
 */

import type { ChatMessage, ChatRequest } from '../../src/types';

/**
 * Valid chat requests
 */
export const validChatRequests = {
  simple: {
    messages: [
      { role: 'user', content: 'Hello, how are you?' },
    ] as ChatMessage[],
    model: 'claude-3-opus-20240229',
    provider: 'anthropic' as const,
    temperature: 0.7,
    maxTokens: 4096,
  } as ChatRequest,

  multiTurn: {
    messages: [
      { role: 'user', content: 'What is the capital of France?' },
      { role: 'assistant', content: 'The capital of France is Paris.' },
      { role: 'user', content: 'What is its population?' },
    ] as ChatMessage[],
    model: 'claude-3-sonnet-20240229',
    provider: 'anthropic' as const,
    temperature: 0.5,
  } as ChatRequest,

  withSystemPrompt: {
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Explain quantum computing.' },
    ] as ChatMessage[],
    model: 'gpt-4',
    provider: 'openai' as const,
    temperature: 0.7,
  } as ChatRequest,

  streaming: {
    messages: [
      { role: 'user', content: 'Tell me a story.' },
    ] as ChatMessage[],
    model: 'claude-3-opus-20240229',
    provider: 'anthropic' as const,
    temperature: 0.8,
    stream: true,
  } as ChatRequest,

  longContext: {
    messages: Array(100).fill(null).map((_, i) => ({
      role: 'user' as const,
      content: `Message number ${i + 1} with some content to simulate a long conversation.`,
    })),
    model: 'claude-3-opus-20240229',
    provider: 'anthropic' as const,
    temperature: 0.7,
  } as ChatRequest,
};

/**
 * Invalid chat requests
 */
export const invalidChatRequests = {
  noMessages: {
    messages: [],
    model: 'claude-3-opus-20240229',
  } as any,

  emptyMessage: {
    messages: [
      { role: 'user', content: '' },
    ] as ChatMessage[],
    model: 'claude-3-opus-20240229',
  } as any,

  invalidRole: {
    messages: [
      { role: 'invalid' as any, content: 'Test' },
    ] as ChatMessage[],
    model: 'claude-3-opus-20240229',
  } as any,

  negativeTemperature: {
    messages: [
      { role: 'user', content: 'Test' },
    ] as ChatMessage[],
    model: 'claude-3-opus-20240229',
    temperature: -0.5,
  } as any,

  temperatureTooHigh: {
    messages: [
      { role: 'user', content: 'Test' },
    ] as ChatMessage[],
    model: 'claude-3-opus-20240229',
    temperature: 2.5,
  } as any,

  negativeMaxTokens: {
    messages: [
      { role: 'user', content: 'Test' },
    ] as ChatMessage[],
    model: 'claude-3-opus-20240229',
    maxTokens: -100,
  } as any,

  unknownModel: {
    messages: [
      { role: 'user', content: 'Test' },
    ] as ChatMessage[],
    model: 'unknown-model-123',
  } as any,
};

/**
 * Edge cases
 */
export const edgeCaseRequests = {
  specialCharacters: {
    messages: [
      { role: 'user', content: 'Test with émojis 🎉 and spëcial çharacters' },
    ] as ChatMessage[],
    model: 'claude-3-opus-20240229',
  } as ChatRequest,

  veryLongMessage: {
    messages: [
      { role: 'user', content: 'A'.repeat(100000) },
    ] as ChatMessage[],
    model: 'claude-3-opus-20240229',
  } as ChatRequest,

  manyMessages: {
    messages: Array(500).fill(null).map((_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as const,
      content: `Message ${i + 1}`,
    })),
    model: 'claude-3-opus-20240229',
  } as ChatRequest,

  unicodeContent: {
    messages: [
      { role: 'user', content: 'Hello in various languages: Hello, Bonjour, Hola, こんにちは, 안녕하세요, مرحبا' },
    ] as ChatMessage[],
    model: 'claude-3-opus-20240229',
  } as ChatRequest,

  codeBlocks: {
    messages: [
      { role: 'user', content: 'Explain this code:\n```typescript\nconst x = 42;\nconsole.log(x);\n```' },
    ] as ChatMessage[],
    model: 'claude-3-opus-20240229',
  } as ChatRequest,
};

/**
 * Rate limiting test requests
 */
export const rateLimitRequests = {
  singleUser: {
    userId: 'user-123',
    requests: Array(150).fill(null).map((_, i) => ({
      messages: [{ role: 'user' as const, content: `Request ${i + 1}` }],
      model: 'claude-3-opus-20240229' as const,
    })),
  },

  multipleUsers: {
    users: Array(10).fill(null).map((_, userIdx) => ({
      userId: `user-${userIdx}`,
      requests: Array(20).fill(null).map((_, reqIdx) => ({
        messages: [{ role: 'user' as const, content: `User ${userIdx} request ${reqIdx + 1}` }],
        model: 'claude-3-opus-20240229' as const,
      })),
    })),
  },
};

/**
 * HTTP request fixtures
 */
export const httpRequestFixtures = {
  withAuth: {
    headers: {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json',
    },
  },

  withRequestId: {
    headers: {
      'X-Request-ID': 'test-request-id-123',
      'Content-Type': 'application/json',
    },
  },

  withSessionId: {
    headers: {
      'X-Session-ID': 'session-456',
      'Content-Type': 'application/json',
    },
  },

  withAllHeaders: {
    headers: {
      'Authorization': 'Bearer test-token',
      'X-Request-ID': 'test-request-id-123',
      'X-Session-ID': 'session-456',
      'Content-Type': 'application/json',
      'User-Agent': 'ClaudeFlare-Test/1.0',
    },
  },

  malformedJSON: {
    body: '{ invalid json',
  },

  emptyJSON: {
    body: '{}',
  },
};
