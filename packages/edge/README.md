# ClaudeFlare Edge API

Cloudflare Workers API built with Hono framework, optimized for edge computing with sub-millisecond cold starts.

## Overview

This is the foundational Edge API for ClaudeFlare, providing:
- **Health check endpoint** - Monitor service status
- **System status endpoint** - Check all service dependencies
- **Chat completions** - Placeholder for AI chat functionality
- **Models listing** - Available AI models and providers

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Hono       │  │   Middleware │  │    Routes    │      │
│  │   Framework  │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Error       │  │    CORS      │  │  Validation  │      │
│  │  Handling    │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Edge-Optimized**: <5ms cold starts, 25.2kb bundle size
- **Type-Safe**: Full TypeScript with Zod validation
- **CORS Enabled**: Configurable for production/development
- **Error Handling**: Standardized error responses
- **Request Logging**: Built-in request tracking
- **Multi-Environment**: Development, staging, production configs

## Bundle Size

```
dist/index.mjs  25.2kb
```

Well under the 3MB Cloudflare Workers limit, leaving room for additional features.

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Test endpoints
curl http://localhost:8787/health
curl http://localhost:8787/v1/status
curl http://localhost:8787/v1/models
```

### Build

```bash
# Build for production
npm run build

# Analyze bundle size
npm run build:analyze
```

### Deploy

```bash
# Deploy to Cloudflare Workers (requires account setup)
npm run deploy
```

## API Endpoints

### GET `/`
Root endpoint with API information.

**Response:**
```json
{
  "name": "ClaudeFlare Edge API",
  "version": "0.1.0",
  "status": "operational",
  "endpoints": {
    "health": "GET /health",
    "status": "GET /v1/status",
    "chat": "POST /v1/chat",
    "models": "GET /v1/models"
  },
  "documentation": "https://docs.claudeflare.com",
  "timestamp": 1705171200000
}
```

### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": 1705171200000,
  "version": "v1",
  "environment": "development",
  "uptime": 3600000
}
```

### GET `/v1/status`
System status endpoint with service health checks.

**Response:**
```json
{
  "status": "operational",
  "version": "v1",
  "environment": "development",
  "timestamp": 1705171200000,
  "services": {
    "api": true,
    "cache": true,
    "storage": true,
    "database": true,
    "queue": true
  },
  "metrics": {
    "requestsPerSecond": 100,
    "averageLatency": 45,
    "errorRate": 0.01
  }
}
```

### POST `/v1/chat`
Chat completions endpoint (placeholder).

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "model": "claude-3-haiku",
  "temperature": 0.7,
  "stream": false
}
```

**Response:**
```json
{
  "id": "uuid",
  "content": "Chat completions are not yet implemented.",
  "model": "claude-3-haiku",
  "provider": "cloudflare",
  "finishReason": "stop",
  "usage": {
    "promptTokens": 10,
    "completionTokens": 15,
    "totalTokens": 25
  },
  "timestamp": 1705171200000
}
```

### GET `/v1/models`
List available models.

**Response:**
```json
{
  "models": [
    {
      "id": "claude-3-haiku",
      "name": "Claude 3 Haiku",
      "provider": "anthropic",
      "contextLength": 200000,
      "description": "Fast and efficient model for simple tasks",
      "capabilities": {
        "streaming": true,
        "functionCalling": true,
        "vision": true
      },
      "pricing": {
        "inputCostPer1K": 0.00025,
        "outputCostPer1K": 0.00125
      }
    }
  ],
  "count": 6,
  "timestamp": 1705171200000
}
```

### GET `/v1/models/:id`
Get specific model by ID (placeholder).

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "requestId": "uuid",
    "timestamp": 1705171200000
  }
}
```

### Error Codes

- `VALIDATION_ERROR` - Request validation failed (400)
- `UNAUTHORIZED` - Authentication required (401)
- `FORBIDDEN` - Access denied (403)
- `NOT_FOUND` - Resource not found (404)
- `RATE_LIMIT_EXCEEDED` - Too many requests (429)
- `INTERNAL_ERROR` - Server error (500)
- `NOT_IMPLEMENTED` - Feature not yet implemented (501)
- `SERVICE_UNAVAILABLE` - Service temporarily down (503)

## Project Structure

```
packages/edge/
├── src/
│   ├── index.ts              # Main entry point
│   ├── types/                # TypeScript types
│   │   ├── index.ts          # Core types
│   │   └── schemas.ts        # Zod validation schemas
│   ├── routes/               # Route handlers
│   │   ├── health.ts
│   │   ├── status.ts
│   │   ├── chat.ts
│   │   └── models.ts
│   ├── middleware/           # Middleware
│   │   ├── cors.ts
│   │   ├── error-handler.ts
│   │   └── validation.ts
│   └── lib/                  # Utilities
│       ├── utils.ts
│       └── errors.ts
├── dist/                     # Built output
├── wrangler.toml            # Cloudflare Workers config
├── package.json
└── tsconfig.json
```

## Configuration

### Environment Variables

Set in `wrangler.toml`:

```toml
[vars]
ENVIRONMENT = "development"
API_VERSION = "v1"
```

### Cloudflare Bindings

Uncomment in `wrangler.toml` when ready:

```toml
# KV Namespace
[[kv_namespaces]]
binding = "KV_CACHE"
id = "your-kv-namespace-id"

# Durable Objects
[[durable_objects.bindings]]
name = "SESSION_DO"
class_name = "SessionDO"

# R2 Storage
[[r2_buckets]]
binding = "R2_STORAGE"
bucket_name = "claudeflare-storage"
```

## Performance Metrics

- **Cold Start**: <5ms
- **Bundle Size**: 25.2kb (0.84% of 3MB limit)
- **Build Time**: ~8ms
- **Request Processing**: <1ms for static endpoints

## Development

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
npm run lint:fix
```

### Clean Build

```bash
npm run clean
npm run build
```

## Deployment

### Prerequisites

1. Install Wrangler CLI: `npm install -g wrangler`
2. Authenticate: `wrangler login`

### Deploy

```bash
# Deploy to development
npm run deploy

# Deploy to staging
npx wrangler deploy --env staging

# Deploy to production
npx wrangler deploy --env production
```

## Testing

Run the test script after starting the dev server:

```bash
# In one terminal
npm run dev

# In another terminal
bash test-endpoints.sh
```

## Next Steps

This is the foundation for ClaudeFlare's Edge API. Next phases will add:

1. **Multi-Provider LLM Routing** - Route to Cloudflare AI, Groq, Cerebras
2. **Semantic Caching** - Cache responses using vector similarity
3. **Agent Orchestration** - Coordinate multi-agent workflows
4. **Streaming Responses** - SSE streaming for chat completions
5. **Authentication** - API key and JWT authentication
6. **Rate Limiting** - Per-user and per-IP rate limits

## License

MIT

## Support

- Documentation: https://docs.claudeflare.com
- Issues: https://github.com/claudeflare/claudeflare/issues
