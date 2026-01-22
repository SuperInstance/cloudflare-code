# @claudeflare/sdk-ts

> TypeScript/JavaScript SDK for ClaudeFlare - Distributed AI coding platform

[![npm version](https://badge.fury.io/js/%40claudeflare%2Fsdk-ts.svg)](https://www.npmjs.com/package/@claudeflare/sdk-ts)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Full TypeScript support with comprehensive type definitions
- Chat completions with streaming support
- Code generation and analysis
- Multi-agent orchestration
- Codebase RAG (Retrieval Augmented Generation)
- Automatic retry with exponential backoff
- Comprehensive error handling
- Debug logging
- WebSocket support for real-time updates
- Works in Node.js, browsers, and edge runtimes

## Installation

```bash
npm install @claudeflare/sdk-ts
# or
yarn add @claudeflare/sdk-ts
# or
pnpm add @claudeflare/sdk-ts
```

## Quick Start

```typescript
import { ClaudeFlare } from '@claudeflare/sdk-ts';

const client = new ClaudeFlare({
  apiKey: 'your-api-key',
});

// Simple chat completion
const response = await client.chat.completions.create({
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.content);
```

## Usage Examples

### Chat Completions

#### Basic Usage

```typescript
const response = await client.chat.completions.create({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is Cloudflare Workers?' },
  ],
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.7,
  maxTokens: 1000,
});

console.log(response.content);
```

#### Streaming

```typescript
// Callback-based streaming
await client.chat.completions.createStream(
  {
    messages: [{ role: 'user', content: 'Tell me a story' }],
    stream: true,
  },
  (event) => {
    if (event.type === 'content' && event.content) {
      process.stdout.write(event.content);
    }
  }
);

// ReadableStream-based streaming
const stream = client.chat.completions.stream({
  messages: [{ role: 'user', content: 'Explain AI' }],
  stream: true,
});

const reader = stream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  if (value.type === 'content' && value.content) {
    process.stdout.write(value.content);
  }
}
```

### Code Generation

```typescript
const result = await client.code.generate.generate({
  prompt: 'Create a REST API for user management',
  language: 'typescript',
  framework: 'express',
  style: {
    indent: 'spaces',
    indentSize: 2,
    semicolons: true,
  },
});

console.log(result.code);
console.log(result.explanation);
```

### Code Analysis

```typescript
// Security analysis
const securityAnalysis = await client.code.analyze.security(code, 'typescript');
console.log(`Security Score: ${securityAnalysis.score}/100`);
for (const finding of securityAnalysis.findings) {
  console.log(`[${finding.severity}] ${finding.message}`);
}

// Performance analysis
const perfAnalysis = await client.code.analyze.performance(code, 'javascript');

// Quality analysis
const qualityAnalysis = await client.code.analyze.quality(code, 'typescript');

// Generate documentation
const docs = await client.code.analyze.document(code, 'typescript');
```

### Agent Orchestration

```typescript
// Orchestrate multiple agents
const result = await client.agents.orchestrate.create({
  task: 'Analyze this codebase and generate documentation',
  agents: ['code', 'analysis', 'search'],
  autoSelect: true,
  maxParallelism: 3,
});

console.log(result.result?.output);

// Orchestrate with streaming updates
await client.agents.orchestrate.createStream(
  {
    task: 'Review and refactor this code',
    agents: ['code', 'review'],
  },
  (update) => {
    console.log(`Status: ${update.status}`);
    for (const agent of update.agents) {
      console.log(`  ${agent.agent.name}: ${agent.status}`);
    }
  }
);

// List available agents
const agents = await client.agents.registry.list();
console.log(`Available agents: ${agents.count}`);
```

### Models

```typescript
// List all models
const models = await client.models.list();
for (const model of models.models) {
  console.log(`${model.name} - ${model.provider}`);
}

// Get specific model
const model = await client.models.get('claude-3-5-sonnet-20241022');

// Find model by name
const model = await client.models.find('claude-3');

// Get models by provider
const anthropicModels = await client.models.listByProvider('anthropic');

// Get cheapest model
const cheapest = await client.models.getCheapest('anthropic');

// Get model with largest context
const largest = await client.models.getLargestContext();
```

### Codebase RAG

```typescript
// Upload repository
const upload = await client.codebase.upload.create({
  repositoryUrl: 'https://github.com/user/repo',
  branch: 'main',
  includePatterns: ['src/**/*.ts'],
  excludePatterns: ['**/*.test.ts'],
});

// Upload files directly
const upload = await client.codebase.upload.uploadFiles([
  { path: 'src/index.ts', content: '...' },
  { path: 'src/utils.ts', content: '...' },
]);

// Search codebase
const results = await client.codebase.search.query({
  query: 'How is authentication implemented?',
  topK: 5,
  filters: {
    language: 'typescript',
  },
  includeSnippets: true,
});

for (const result of results.results) {
  console.log(`${result.file.path}:${result.location.startLine}`);
  console.log(result.content);
  console.log(`Score: ${result.score}`);
}

// Get codebase statistics
const stats = await client.codebase.management.getStats();
console.log(`Total files: ${stats.totalFiles}`);
console.log(`Total chunks: ${stats.totalChunks}`);

// Get a specific file
const file = await client.codebase.management.getFile('src/index.ts');

// Clear codebase
await client.codebase.management.clear();

// Reindex codebase
await client.codebase.management.reindex();
```

## Configuration

```typescript
const client = new ClaudeFlare({
  // Required
  apiKey: 'your-api-key',

  // Optional
  baseURL: 'https://api.claudeflare.com',
  apiVersion: 'v1',
  timeout: 60000,
  maxRetries: 3,
  debug: false,

  // Custom headers
  defaultHeaders: {
    'X-Custom-Header': 'value',
  },

  // Custom fetch implementation
  fetch: customFetch,
});
```

## Error Handling

```typescript
import {
  ValidationError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
} from '@claudeflare/sdk-ts';

try {
  const response = await client.chat.completions.create({ ... });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded, retry after:', error.retryAfter);
  } else if (error instanceof ValidationError) {
    console.error('Validation error:', error.message);
  } else if (error instanceof NotFoundError) {
    console.error('Resource not found');
  }
}
```

## Logging

```typescript
import { ClaudeFlare, setLogger, LogLevel } from '@claudeflare/sdk-ts';

// Enable debug logging
const client = new ClaudeFlare({
  apiKey: 'your-api-key',
  debug: true,
});

// Or configure globally
import { Logger } from '@claudeflare/sdk-ts';

const logger = new Logger({
  enabled: true,
  level: LogLevel.DEBUG,
});

setLogger(logger);
```

## Advanced Usage

### Custom Retry Configuration

```typescript
import { retryWithBackoff } from '@claudeflare/sdk-ts';

const result = await retryWithBackoff(
  async () => {
    return await client.chat.completions.create({ ... });
  },
  {
    maxRetries: 5,
    initialDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    onRetry: (attempt, error) => {
      console.log(`Retry attempt ${attempt}:`, error.message);
    },
  }
);
```

### Environment Variables

```typescript
// Load from environment
const client = ClaudeFlare.fromEnv();

// Requires CLAUDEFLARE_API_KEY environment variable
```

## TypeScript Support

This SDK is written in TypeScript and includes comprehensive type definitions:

```typescript
import type {
  ChatCompletionParams,
  ChatCompletionResponse,
  CodeGenerationParams,
  AgentOrchestrationParams,
  Model,
  ClaudeFlareConfig,
} from '@claudeflare/sdk-ts';
```

## Browser Support

The SDK works in modern browsers. For optimal performance, use a bundler like Vite, Webpack, or esbuild.

## Edge Runtime Support

The SDK is compatible with edge runtimes like Cloudflare Workers, Vercel Edge Functions, and Deno.

## License

MIT

## Support

- Documentation: https://docs.claudeflare.com
- GitHub: https://github.com/claudeflare/sdk-ts
- Issues: https://github.com/claudeflare/sdk-ts/issues
