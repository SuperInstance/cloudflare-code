// ============================================================================
// Troubleshooting Data
// ============================================================================

import type { TroubleshootingEntry, ErrorCode } from '@/types';

// ============================================================================
// Troubleshooting Entries
// ============================================================================

export const troubleshootingEntries: TroubleshootingEntry[] = [
  {
    id: 'api-key-not-working',
    title: 'API Key Not Working',
    category: 'Authentication',
    symptoms: [
      'Receiving 401 Unauthorized errors',
      'API key rejected by the server',
      'Authentication failing after recently regenerating key',
    ],
    causes: [
      'Invalid API key format',
      'API key was regenerated and old key is still being used',
      'API key copied incorrectly with extra spaces',
      'Environment variable not properly loaded',
      'Using test key in production or vice versa',
    ],
    solutions: [
      {
        description: 'Verify your API key is correct and properly formatted',
        steps: [
          'Go to your ClaudeFlare dashboard',
          'Navigate to API Keys section',
          'Copy the API key directly (make sure no extra spaces)',
          'Update your code or environment variables',
          'Restart your application to load new environment variables',
        ],
        codeExample: {
          language: 'bash',
          code: `# Verify environment variable is set
echo $CLAUDEFLARE_API_KEY

# Test API key with curl
curl -H "Authorization: Bearer YOUR_API_KEY" \\
     https://api.claudeflare.com/v1/models`,
        },
        verificationStep: 'Run the curl command above - you should see a list of available models',
      },
      {
        description: 'Check for common key formatting issues',
        steps: [
          'Ensure key starts with "cf_" prefix',
          'Verify key is exactly 32 characters long',
          'Check for trailing whitespace when copying',
          'Confirm you are using the correct environment (dev/prod)',
        ],
      },
      {
        description: 'Regenerate API key if necessary',
        steps: [
          'In the dashboard, revoke the old key',
          'Generate a new API key',
          'Update all applications using the old key',
          'Test the new key before deploying',
        ],
      },
    ],
    relatedErrors: ['INVALID_API_KEY', 'UNAUTHORIZED', 'FORBIDDEN'],
    relatedDocs: ['/docs/api-reference/authentication'],
    severity: 'high',
  },
  {
    id: 'rate-limit-exceeded',
    title: 'Rate Limit Exceeded',
    category: 'Rate Limiting',
    symptoms: [
      'Receiving 429 Too Many Requests errors',
      'Requests being throttled or blocked',
      'Intermittent failures during high traffic',
    ],
    causes: [
      'Exceeding free tier quota limits',
      'Too many requests in a short time period',
      'Multiple clients sharing the same API key',
      'Not implementing proper backoff strategy',
      'Inefficient API usage (redundant requests)',
    ],
    solutions: [
      {
        description: 'Implement exponential backoff for retries',
        steps: [
          'Catch rate limit errors (429 status)',
          'Wait for the duration specified in retry-after header',
          'Use exponential backoff for subsequent retries',
          'Add jitter to avoid thundering herd problem',
        ],
        codeExample: {
          language: 'javascript',
          code: `async function callWithRetry(apiCall, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiCall()
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries - 1) {
        const retryAfter = error.headers['retry-after'] || 1
        const waitTime = retryAfter * Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, waitTime))
        continue
      }
      throw error
    }
  }
}

// Usage
const response = await callWithRetry(() =>
  client.chat.completions.create({ messages })
)`,
          filename: 'retry.js',
        },
        verificationStep: 'Test by making rapid requests - they should be properly throttled',
      },
      {
        description: 'Optimize your API usage',
        steps: [
          'Cache responses when appropriate',
          'Batch requests when possible',
          'Use streaming instead of multiple requests',
          'Implement request queuing for high-volume scenarios',
        ],
        codeExample: {
          language: 'javascript',
          code: `// Simple cache implementation
const cache = new Map()

async function cachedChatCompletion(messages) {
  const cacheKey = JSON.stringify(messages)

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)
  }

  const response = await client.chat.completions.create({ messages })
  cache.set(cacheKey, response)
  return response
}`,
        },
      },
      {
        description: 'Upgrade your plan if needed',
        steps: [
          'Check your current usage in the dashboard',
          'Review pricing plans for higher limits',
          'Consider enterprise options for high-volume needs',
        ],
      },
    ],
    relatedErrors: ['RATE_LIMIT_EXCEEDED', 'TOO_MANY_REQUESTS'],
    relatedDocs: ['/docs/guides/rate-limiting'],
    severity: 'medium',
  },
  {
    id: 'slow-response-time',
    title: 'Slow Response Times',
    category: 'Performance',
    symptoms: [
      'API requests taking longer than expected',
      'Timeouts occurring intermittently',
      'Poor user experience due to latency',
    ],
    causes: [
      'Network latency issues',
      'AI provider experiencing high load',
      'Large prompt sizes',
      'Inefficient request batching',
      'Not using optimal routing strategy',
    ],
    solutions: [
      {
        description: 'Use the fastest routing strategy',
        steps: [
          'Set routing strategy to FASTEST in your configuration',
          'Monitor response times across providers',
          'Consider geographical proximity to providers',
        ],
        codeExample: {
          language: 'javascript',
          code: `const response = await client.chat.completions.create({
  messages,
  routing: {
    strategy: 'FASTEST'  // Prioritize lowest latency
  }
})`,
        },
        verificationStep: 'Monitor response times in dashboard - should see improvement',
      },
      {
        description: 'Optimize your prompt size',
        steps: [
          'Remove unnecessary context from prompts',
          'Use more concise language',
          'Implement context windowing for long conversations',
          'Consider summarization for long histories',
        ],
        codeExample: {
          language: 'javascript',
          code: `// Truncate conversation history
function truncateConversation(history, maxTokens = 2000) {
  // Keep only recent messages
  let totalTokens = 0
  const recentMessages = []

  for (let i = history.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(history[i].content)
    if (totalTokens + tokens > maxTokens) break

    recentMessages.unshift(history[i])
    totalTokens += tokens
  }

  return recentMessages
}

// Usage
const optimizedHistory = truncateConversation(fullHistory)
const response = await client.chat.completions.create({
  messages: optimizedHistory
})`,
        },
      },
      {
        description: 'Use streaming for perceived performance',
        steps: [
          'Enable streaming for all chat completions',
          'Display tokens as they arrive',
          'Implement smooth rendering of streamed content',
        ],
        codeExample: {
          language: 'javascript',
          code: `const stream = await client.chat.completions.stream({
  messages,
  stream: true
})

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content
  if (content) {
    // Display immediately for better UX
    appendToUI(content)
  }
}`,
        },
      },
    ],
    relatedErrors: ['TIMEOUT', 'SLOW_RESPONSE'],
    relatedDocs: ['/docs/troubleshooting/performance'],
    severity: 'medium',
  },
  {
    id: 'streaming-not-working',
    title: 'Streaming Not Working',
    category: 'API Usage',
    symptoms: [
      'Stream not returning data incrementally',
      'All data arriving at once instead of streaming',
      'Connection closing prematurely',
    ],
    causes: [
      'Not setting stream: true in request',
      'Improper handling of Server-Sent Events',
      'Proxy or buffering issues',
      'Client not reading stream properly',
    ],
    solutions: [
      {
        description: 'Enable streaming in your request',
        steps: [
          'Set stream: true in the request body',
          'Use the streaming endpoint (/v1/chat/completions)',
          'Handle SSE format correctly',
        ],
        codeExample: {
          language: 'javascript',
          code: `// Correct streaming implementation
const response = await fetch('https://api.claudeflare.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${apiKey}\`
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Hello!' }],
    stream: true  // Essential for streaming
  })
})

const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const text = decoder.decode(value)
  const lines = text.split('\\n')

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6)
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices[0]?.delta?.content
        if (content) {
          console.log(content)
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }
}`,
        },
        verificationStep: 'You should see tokens appearing one by one, not all at once',
      },
      {
        description: 'Check for proxy buffering issues',
        steps: [
          'If using a proxy, ensure it supports streaming',
          'Disable buffering in nginx/apache configurations',
          'Check CDN settings for streaming support',
        ],
        codeExample: {
          language: 'nginx',
          code: `# Nginx configuration for streaming
location /v1/ {
  proxy_pass https://api.claudeflare.com;
  proxy_buffering off;          # Disable buffering
  proxy_cache off;              # Disable caching
  proxy_set_header X-Accel-Buffering no;  # Important!
  proxy_read_timeout 300s;
  proxy_connect_timeout 75s;
}`,
        },
      },
    ],
    relatedErrors: ['STREAM_ERROR', 'INVALID_STREAM'],
    relatedDocs: ['/docs/api-reference/chat-api'],
    severity: 'low',
  },
  {
    id: 'model-unavailable',
    title: 'Requested Model Unavailable',
    category: 'API Usage',
    symptoms: [
      'Getting error that requested model is not available',
      'Cannot select specific AI provider model',
      'Auto-routing not finding any available models',
    ],
    causes: [
      'Model name spelled incorrectly or wrong format',
      'Provider temporarily down',
      'Model not supported by ClaudeFlare',
      'No API keys configured for requested provider',
    ],
    solutions: [
      {
        description: 'Use auto-routing instead of specific models',
        steps: [
          'Set model to "auto" for automatic selection',
          'Let ClaudeFlare choose the best available model',
          'Benefit from automatic failover',
        ],
        codeExample: {
          language: 'javascript',
          code: `// Instead of specific model
model: "llama-2-70b-chat"

// Use auto
model: "auto"  // ClaudeFlare will choose best available`,
        },
      },
      {
        description: 'Check provider status in dashboard',
        steps: [
          'Visit ClaudeFlare dashboard',
          'Check status page for provider outages',
          'Verify your API keys are configured for each provider',
        ],
      },
      {
        description: 'Use alternative model format',
        steps: [
          'Try provider/model format (e.g., "groq/llama-2-70b-chat")',
          'Refer to documentation for available models',
          'Test different providers to find available ones',
        ],
        codeExample: {
          language: 'javascript',
          code: `// Specific provider/model format
const response = await client.chat.completions.create({
  model: "groq/llama-2-70b-chat",  // provider/model
  messages
})

// Or check available models
const models = await client.models.list()
console.log(models.data)`,
        },
      },
    ],
    relatedErrors: ['MODEL_NOT_FOUND', 'MODEL_UNAVAILABLE', 'NO_PROVIDERS'],
    relatedDocs: ['/docs/api-reference/overview'],
    severity: 'medium',
  },
];

// ============================================================================
// Error Codes
// ============================================================================

export const errorCodes: ErrorCode[] = [
  {
    code: 'INVALID_API_KEY',
    title: 'Invalid API Key',
    description: 'The API key provided is invalid or cannot be used with this endpoint',
    httpStatus: 401,
    category: 'Authentication',
    causes: [
      'API key was entered incorrectly',
      'API key has been revoked',
      'Using production key in test environment or vice versa',
    ],
    solutions: [
      'Verify API key in dashboard',
      'Check for extra spaces or characters',
      'Generate a new API key if necessary',
    ],
    example: {
      request: {
        method: 'POST',
        url: '/v1/chat/completions',
        headers: { 'Authorization': 'Bearer invalid_key' },
        body: { messages: [{ role: 'user', content: 'Hello' }] },
      },
      response: {
        error: {
          code: 'INVALID_API_KEY',
          message: 'The API key provided is invalid',
          type: 'authentication_error',
        },
      },
    },
  },
  {
    code: 'RATE_LIMIT_EXCEEDED',
    title: 'Rate Limit Exceeded',
    description: 'You have exceeded the rate limit for your API key',
    httpStatus: 429,
    category: 'Rate Limiting',
    causes: [
      'Too many requests in a short time',
      'Exceeded free tier quota',
      'Multiple applications sharing same API key',
    ],
    solutions: [
      'Implement exponential backoff',
      'Upgrade your plan for higher limits',
      'Cache responses to reduce requests',
    ],
    example: {
      request: {
        method: 'POST',
        url: '/v1/chat/completions',
        headers: { 'Authorization': 'Bearer your_key' },
        body: { messages: [{ role: 'user', content: 'Hello' }] },
      },
      response: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Retry after 60 seconds.',
          retry_after: 60,
        },
      },
    },
  },
  {
    code: 'VALIDATION_ERROR',
    title: 'Validation Error',
    description: 'The request could not be validated',
    httpStatus: 400,
    category: 'Validation',
    causes: [
      'Missing required fields',
      'Invalid message format',
      'Parameters out of valid range',
    ],
    solutions: [
      'Check all required fields are present',
      'Verify message format matches API spec',
      'Review parameter constraints',
    ],
    example: {
      request: {
        method: 'POST',
        url: '/v1/chat/completions',
        headers: { 'Authorization': 'Bearer your_key' },
        body: { messages: [] },
      },
      response: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'messages field is required and must not be empty',
          type: 'invalid_request_error',
        },
      },
    },
  },
  {
    code: 'MODEL_NOT_FOUND',
    title: 'Model Not Found',
    description: 'The requested model is not available',
    httpStatus: 404,
    category: 'API Usage',
    causes: [
      'Model name incorrect',
      'Model not supported',
      'Provider temporarily unavailable',
    ],
    solutions: [
      'Use "auto" for automatic model selection',
      'Check available models in documentation',
      'Verify provider status',
    ],
    example: {
      request: {
        method: 'POST',
        url: '/v1/chat/completions',
        headers: { 'Authorization': 'Bearer your_key' },
        body: { messages: [{ role: 'user', content: 'Hello' }], model: 'invalid-model' },
      },
      response: {
        error: {
          code: 'MODEL_NOT_FOUND',
          message: 'Model "invalid-model" not found. Use "auto" or check available models.',
          type: 'invalid_request_error',
        },
      },
    },
  },
];

// ============================================================================
// FAQ
// ============================================================================

export const faqItems = [
  {
    id: 'what-is-claudeflare',
    question: 'What is ClaudeFlare?',
    answer: 'ClaudeFlare is a distributed AI coding platform built on Cloudflare Workers that provides intelligent multi-provider routing for AI model inference. It automatically routes your requests to the optimal AI provider based on availability, cost, and performance.',
    category: 'General',
  },
  {
    id: 'how-does-routing-work',
    question: 'How does AI model routing work?',
    answer: 'ClaudeFlare supports multiple routing strategies: FREE_TIER_FIRST (prioritizes free quotas), FASTEST (lowest latency), COST_OPTIMIZED (minimizes costs), and ROUND_ROBIN (distributes load). By default, it automatically selects the best provider based on your configuration and current conditions.',
    category: 'Routing',
  },
  {
    id: 'free-tier-limits',
    question: 'What are the free tier limits?',
    answer: 'ClaudeFlare provides generous free tier access through our partner providers: Cloudflare Workers AI (100,000 requests/day), Groq (10,000 requests/day), Cerebras (5,000 requests/day), and OpenRouter (100 requests/day). Limits are reset daily.',
    category: 'Pricing',
  },
  {
    id: 'data-retention',
    question: 'Is my data stored or used for training?',
    answer: 'ClaudeFlare does not store your conversation data or use it for training. We simply route requests to AI providers and return responses. Each provider has their own data retention policies, which are documented in their respective terms of service.',
    category: 'Privacy',
  },
  {
    id: 'supported-models',
    question: 'What models are supported?',
    answer: 'ClaudeFlare supports models from Cloudflare Workers AI, Groq, Cerebras, and OpenRouter. Popular models include Llama 2 70B, Mixtral 8x7B, and more. Use the "auto" model setting to let us choose the best available model for your request.',
    category: 'Models',
  },
  {
    id: 'streaming-support',
    question: 'Does ClaudeFlare support streaming?',
    answer: 'Yes! ClaudeFlare fully supports streaming responses using Server-Sent Events (SSE). Simply set stream: true in your request and handle the streaming response. Our SDKs provide convenient methods for working with streams.',
    category: 'Features',
  },
  {
    id: 'enterprise-features',
    question: 'What enterprise features are available?',
    answer: 'Enterprise plans include: dedicated support, custom rate limits, priority routing, SLA guarantees, audit logging, custom model deployments, and on-premise deployment options. Contact sales for more information.',
    category: 'Enterprise',
  },
  {
    id: 'deployment-options',
    question: 'Can I self-host ClaudeFlare?',
    answer: 'Yes, for enterprise customers we offer self-hosted deployment options. This includes Docker containers, Kubernetes manifests, and Cloudflare Workers templates. Contact our enterprise team for details on licensing and deployment.',
    category: 'Deployment',
  },
];
