// ============================================================================
// Migration Guide Data
// ============================================================================

import type { MigrationGuide, BreakingChange } from '@/types';

// ============================================================================
// Migration Guides
// ============================================================================

export const migrationGuides: MigrationGuide[] = [
  {
    id: 'v0-to-v1',
    title: 'Migrating from v0 to v1',
    fromVersion: '0.x',
    toVersion: '1.0',
    breakingChanges: [
      {
        feature: 'API Endpoint Changes',
        description: 'The base API path has changed from /api to /v1',
        impact: 'high',
        replacement: '/v1/chat/completions',
        migrationExample: {
          language: 'javascript',
          code: `// Old (v0)
await fetch('https://api.claudeflare.com/api/chat', {
  method: 'POST',
  headers: { 'X-API-Key': apiKey },
  body: JSON.stringify({ messages })
})

// New (v1)
await fetch('https://api.claudeflare.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${apiKey}\`
  },
  body: JSON.stringify({ messages })
})`,
        },
      },
      {
        feature: 'Authentication Header',
        description: 'API key authentication now uses the standard Authorization header with Bearer token',
        impact: 'high',
        replacement: 'Authorization: Bearer <api-key>',
        migrationExample: {
          language: 'javascript',
          code: `// Old
headers: { 'X-API-Key': apiKey }

// New
headers: { 'Authorization': \`Bearer \${apiKey}\` }`,
        },
      },
      {
        feature: 'Response Format',
        description: 'The response structure has been standardized to match OpenAI format',
        impact: 'medium',
        replacement: 'OpenAI-compatible response format',
        migrationExample: {
          language: 'javascript',
          code: `// Old response
{
  "response": {
    "text": "Hello!",
    "model": "llama-2-70b"
  }
}

// New response
{
  "id": "chatcmpl-abc",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "llama-2-70b",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello!"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  }
}`,
        },
      },
      {
        feature: 'Streaming Format',
        description: 'Streaming now uses Server-Sent Events (SSE) format',
        impact: 'medium',
        replacement: 'SSE streaming',
        migrationExample: {
          language: 'javascript',
          code: `// Old streaming format
data: {"text": "Hello"}
data: {"text": " World"}

// New SSE format
data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"}}]}
data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" World"}}]}`,
        },
      },
      {
        feature: 'Error Response Format',
        description: 'Error responses now follow RFC 7807 Problem Details format',
        impact: 'low',
        replacement: 'RFC 7807 error format',
        migrationExample: {
          language: 'json',
          code: `// Old error
{
  "error": "Invalid request"
}

// New error
{
  "type": "https://api.claudeflare.com/errors/validation",
  "title": "Validation Error",
  "status": 400,
  "detail": "The request could not be validated",
  "instance": "/v1/chat/completions"
}`,
        },
      },
    ],
    newFeatures: [
      'OpenAI-compatible API format',
      'Improved error messages with detailed validation feedback',
      'Better streaming support with automatic retries',
      'Enhanced rate limit headers',
      'Request ID for tracing',
      'Multiple model selection options',
      'Custom system messages per conversation',
    ],
    deprecatedFeatures: [
      'X-API-Key header (use Authorization: Bearer instead)',
      '/api/* endpoints (use /v1/* instead)',
      'Response field "response.text" (use choices[0].message.content)',
      'Legacy streaming format',
    ],
    migrationSteps: [
      {
        step: 1,
        title: 'Update API Endpoints',
        description: 'Replace all /api/ endpoints with /v1/',
        action: 'Find and replace "/api/" with "/v1/" in your codebase',
        codeExample: {
          language: 'bash',
          code: `# Find all API endpoint references
grep -r "api.claudeflare.com/api" ./src

# Replace with v1 endpoints
sed -i 's|api.claudeflare.com/api|api.claudeflare.com/v1|g' ./src/**/*.js`,
        },
        verification: 'Check that all API calls use the /v1/ path',
      },
      {
        step: 2,
        title: 'Update Authentication Headers',
        description: 'Change X-API-Key header to Authorization: Bearer',
        action: 'Update your authentication code to use the Bearer token format',
        codeExample: {
          language: 'javascript',
          code: `// Before
const headers = {
  'X-API-Key': process.env.CLAUDEFLARE_API_KEY,
  'Content-Type': 'application/json'
}

// After
const headers = {
  'Authorization': \`Bearer \${process.env.CLAUDEFLARE_API_KEY}\`,
  'Content-Type': 'application/json'
}`,
        },
        verification: 'Test a simple API call to confirm authentication works',
      },
      {
        step: 3,
        title: 'Update Response Handling',
        description: 'Adapt your code to handle the new OpenAI-compatible response format',
        action: 'Update response parsing to use choices[0].message.content',
        codeExample: {
          language: 'javascript',
          code: `// Before
const response = await api.chat.create({ messages })
const text = response.response.text

// After
const response = await api.chat.completions.create({ messages })
const text = response.choices[0].message.content`,
        },
        verification: 'Test that your app correctly extracts AI responses',
      },
      {
        step: 4,
        title: 'Update Streaming Handlers',
        description: 'Modify streaming code to parse SSE format',
        action: 'Implement SSE parsing for streaming responses',
        codeExample: {
          language: 'javascript',
          code: `// New streaming handler
async function streamChat(messages) {
  const response = await fetch('/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${apiKey}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messages, stream: true })
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
          if (content) process.stdout.write(content)
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }
}`,
        },
        verification: 'Test streaming with a long conversation',
      },
      {
        step: 5,
        title: 'Update Error Handling',
        description: 'Handle the new error response format',
        action: 'Update error handlers to process RFC 7807 format',
        codeExample: {
          language: 'javascript',
          code: `try {
  const response = await fetch('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': \`Bearer \${apiKey}\` },
    body: JSON.stringify({ messages })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(\`\${error.title}: \${error.detail}\`)
  }

  const data = await response.json()
  return data
} catch (error) {
  console.error('API Error:', error.message)
  throw error
}`,
        },
        verification: 'Test with invalid requests to see proper error messages',
      },
      {
        step: 6,
        title: 'Test and Validate',
        description: 'Run comprehensive tests to ensure all functionality works',
        action: 'Run your test suite and perform manual testing',
        codeExample: {
          language: 'bash',
          code: `# Run automated tests
npm test

# Test key scenarios:
# 1. Simple chat completion
# 2. Multi-turn conversation
# 3. Streaming response
# 4. Error handling
# 5. Rate limiting`,
        },
        verification: 'All tests pass and manual testing confirms functionality',
      },
    ],
    estimatedTime: 30,
  },
  {
    id: 'openai-to-claudeflare',
    title: 'Migrating from OpenAI to ClaudeFlare',
    fromVersion: 'OpenAI SDK',
    toVersion: 'ClaudeFlare v1',
    breakingChanges: [
      {
        feature: 'Base URL',
        description: 'ClaudeFlare uses a different base URL',
        impact: 'low',
        replacement: 'https://api.claudeflare.com/v1',
        migrationExample: {
          language: 'python',
          code: `# OpenAI
client = OpenAI(base_url="https://api.openai.com/v1")

# ClaudeFlare
client = OpenAI(base_url="https://api.claudeflare.com/v1")`,
        },
      },
      {
        feature: 'Model Names',
        description: 'ClaudeFlare uses different model identifiers',
        impact: 'medium',
        replacement: 'Model auto-routing or specific provider models',
        migrationExample: {
          language: 'javascript',
          code: `// OpenAI
model: "gpt-4"

// ClaudeFlare (auto-routing)
model: "auto"

// Or specific model
model: "llama-2-70b-chat"`,
        },
      },
      {
        feature: 'Provider Selection',
        description: 'ClaudeFlare supports multiple AI providers',
        impact: 'low',
        replacement: 'Automatic or manual provider selection',
        migrationExample: {
          language: 'javascript',
          code: `// Let ClaudeFlare automatically choose the best provider
const response = await client.chat.completions.create({
  model: "auto",
  messages: [...]
})

// Or specify a provider
const response = await client.chat.completions.create({
  model: "groq/llama-2-70b-chat",
  messages: [...]
})`,
        },
      },
    ],
    newFeatures: [
      'Multi-provider routing',
      'Automatic fallback between providers',
      'Cost optimization',
      'Free tier support for multiple providers',
      'Enhanced rate limit handling',
      'Built-in caching options',
    ],
    deprecatedFeatures: [],
    migrationSteps: [
      {
        step: 1,
        title: 'Install ClaudeFlare SDK (Optional)',
        description: 'You can use the OpenAI SDK with ClaudeFlare by changing the base URL',
        action: 'Update base URL or install ClaudeFlare SDK',
        codeExample: {
          language: 'bash',
          code: `# Option 1: Use OpenAI SDK with different base URL
npm install openai

# Option 2: Install ClaudeFlare SDK
npm install @claudeflare/sdk`,
        },
      },
      {
        step: 2,
        title: 'Update Base URL',
        description: 'Change the API base URL to point to ClaudeFlare',
        action: 'Update your client initialization',
        codeExample: {
          language: 'javascript',
          code: `// Using OpenAI SDK with ClaudeFlare
const client = new OpenAI({
  baseURL: 'https://api.claudeflare.com/v1',
  apiKey: process.env.CLAUDEFLARE_API_KEY
})

// Using ClaudeFlare SDK
import { ClaudeFlare } from '@claudeflare/sdk'

const client = new ClaudeFlare({
  apiKey: process.env.CLAUDEFLARE_API_KEY
})`,
        },
      },
      {
        step: 3,
        title: 'Update Model Parameter',
        description: 'Change model parameter to use auto-routing',
        action: 'Replace specific models with "auto"',
        codeExample: {
          language: 'javascript',
          code: `// Before
model: "gpt-4"

// After
model: "auto"  // Let ClaudeFlare choose the best model`,
        },
      },
      {
        step: 4,
        title: 'Test Your Integration',
        description: 'Test that your application works with ClaudeFlare',
        action: 'Run your tests and verify functionality',
        codeExample: {
          language: 'javascript',
          code: `// Test basic functionality
const response = await client.chat.completions.create({
  model: "auto",
  messages: [
    { role: "user", content: "Hello, ClaudeFlare!" }
  ]
})

console.log(response.choices[0].message.content)`,
        },
      },
    ],
    estimatedTime: 15,
  },
  {
    id: 'anthropic-to-claudeflare',
    title: 'Migrating from Anthropic Claude to ClaudeFlare',
    fromVersion: 'Anthropic SDK',
    toVersion: 'ClaudeFlare v1',
    breakingChanges: [
      {
        feature: 'Message Format',
        description: 'ClaudeFlare uses OpenAI-compatible message format',
        impact: 'medium',
        replacement: 'OpenAI message format',
        migrationExample: {
          language: 'javascript',
          code: `// Anthropic
messages: [
  { role: "user", content: "Hello" }
]

// ClaudeFlare (same format!)
messages: [
  { role: "user", content: "Hello" }
]`,
        },
      },
      {
        feature: 'Streaming Response',
        description: 'ClaudeFlare uses SSE format for streaming',
        impact: 'medium',
        replacement: 'Server-Sent Events format',
        migrationExample: {
          language: 'javascript',
          code: `// Anthropic streaming
for await (const chunk of stream) {
  if (chunk.type === 'content_block_delta') {
    console.log(chunk.delta.text)
  }
}

// ClaudeFlare streaming (OpenAI-compatible)
for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content
  if (content) console.log(content)
}`,
        },
      },
    ],
    newFeatures: [
      'Multi-provider support',
      'Cost optimization through intelligent routing',
      'OpenAI-compatible API',
      'Easier migration path',
    ],
    deprecatedFeatures: [],
    migrationSteps: [
      {
        step: 1,
        title: 'Update Client Initialization',
        description: 'Switch from Anthropic to ClaudeFlare client',
        action: 'Replace Anthropic SDK with ClaudeFlare or OpenAI SDK',
        codeExample: {
          language: 'javascript',
          code: `// Before
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

// After
import { ClaudeFlare } from '@claudeflare/sdk'

const client = new ClaudeFlare({
  apiKey: process.env.CLAUDEFLARE_API_KEY
})`,
        },
      },
      {
        step: 2,
        title: 'Update Message Creation',
        description: 'Adapt to OpenAI-compatible API format',
        action: 'Minimal changes needed - format is very similar',
        codeExample: {
          language: 'javascript',
          code: `// Before
const msg = await anthropic.messages.create({
  model: "claude-3-opus-20240229",
  max_tokens: 1024,
  messages: [
    { role: "user", content: "Hello" }
  ]
})

// After
const msg = await client.chat.completions.create({
  model: "auto",
  max_tokens: 1024,
  messages: [
    { role: "user", content: "Hello" }
  ]
})`,
        },
      },
      {
        step: 3,
        title: 'Update Response Handling',
        description: 'Handle OpenAI-compatible response format',
        action: 'Update response extraction code',
        codeExample: {
          language: 'javascript',
          code: `// Before
const text = msg.content[0].text

// After
const text = msg.choices[0].message.content`,
        },
      },
    ],
    estimatedTime: 20,
  },
];

// ============================================================================
// Version History
// ============================================================================

export const versionHistory = [
  {
    version: '1.0.0',
    releaseDate: '2024-01-15',
    status: 'stable' as const,
    docsPath: '/docs',
    highlights: [
      'OpenAI-compatible API format',
      'Multi-provider routing',
      'Improved streaming support',
      'Enhanced error handling',
      'Better rate limiting',
    ],
    breakingChanges: 5,
  },
  {
    version: '0.9.0',
    releaseDate: '2023-12-01',
    status: 'deprecated' as const,
    docsPath: '/docs/v0.9',
    highlights: [
      'Initial beta release',
      'Basic chat completions',
      'Cloudflare Workers AI integration',
    ],
    breakingChanges: 0,
  },
];
