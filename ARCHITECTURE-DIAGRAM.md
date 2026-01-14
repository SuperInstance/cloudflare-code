# Multi-Provider Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ClaudeFlare API                            │
│                     (Cloudflare Workers)                           │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Chat Routes Layer                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐ │
│  │ POST /v1/chat    │  │ POST /v1/chat/   │  │ GET /v1/        │ │
│  │                  │  │   stream         │  │   providers/    │ │
│  │ Non-streaming    │  │                  │  │   status        │ │
│  │ completions      │  │ SSE streaming    │  │                 │ │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘ │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Request Router                                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Routing Strategy Selection                                 │   │
│  │  - FREE_TIER_FIRST (default)                                │   │
│  │  - LOWEST_LATENCY                                           │   │
│  │  - COST_OPTIMIZED                                           │   │
│  │  - LOAD_BALANCED                                            │   │
│  │  - QUALITY_FIRST                                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Provider Score Calculation                                  │   │
│  │  costScore (35%) + latencyScore (25%) +                      │   │
│  │  quotaScore (25%) + reliabilityScore (15%)                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Resilience Layer                                  │
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐    │
│  │  Circuit Breaker     │  │  Retry Policy                    │    │
│  │  - CLOSED (normal)   │  │  - Max retries: 3                │    │
│  │  - OPEN (failing)    │  │  - Exponential backoff           │    │
│  │  - HALF_OPEN (test)  │  │  - Jitter (10%)                  │    │
│  └──────────────────────┘  └──────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Fallback Chain                                             │   │
│  │  Primary → Alternative 1 → Alternative 2 → ...              │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Provider Registry                                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Health Monitoring (every 60s)                              │   │
│  │  - Provider availability check                              │   │
│  │  - Latency measurement                                      │   │
│  │  - Success rate tracking                                    │   │
│  │  - Circuit state monitoring                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Quota Tracking                                             │   │
│  │  - Real-time usage tracking                                 │   │
│  │  - Automatic daily/monthly resets                           │   │
│  │  - Predictive capacity planning                             │   │
│  │  - Alert system (80%, 95% thresholds)                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┬────────────────┐
        │                │                │                │
        ▼                ▼                ▼                ▼
┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  Cloudflare  │  │   Groq   │  │ Cerebras │  │OpenRouter│
│  Workers AI  │  │          │  │          │  │          │
│              │  │          │  │          │  │          │
│ Priority: 10 │  │Priority:8│  │Priority:7│  │Priority:5│
│              │  │          │  │          │  │          │
│ 10K neurons/ │  │Free tier │  │Free tier │  │$1 + 50/  │
│    day       │  │          │  │          │  │   day     │
│              │  │          │  │          │  │          │
│ Models:      │  │Models:   │  │Models:   │  │Models:   │
│ - Llama 3.1  │  │-Llama 3.3│  │-Llama 3.1│  │-Claude   │
│ - Llama 3.3  │  │-Llama 3.1│  │-Llama 3  │  │-Gemini   │
│ - Mistral    │  │-Mixtral  │  │          │  │-Llama    │
│ - Gemma      │  │-Gemma    │  │          │  │-300+ more│
│              │  │          │  │          │  │          │
│ Latency:     │  │Latency:  │  │Latency:  │  │Latency:  │
│ 200ms avg    │  │50ms avg  │  │30ms avg  │  │150ms avg │
│              │  │          │  │          │  │          │
│ TPS: N/A     │  │TPS: 840  │  │TPS: 2600 │  │TPS: Var. │
└──────────────┘  └──────────┘  └──────────┘  └──────────┘
```

## Request Flow

### 1. Incoming Request
```
Client → POST /v1/chat
{
  "messages": [{ "role": "user", "content": "Hello!" }],
  "temperature": 0.7
}
```

### 2. Route Selection
```
Request Router
├─ Check provider availability
├─ Check quota status
├─ Check health status
├─ Calculate provider scores
└─ Select optimal provider
```

### 3. Resilience Layer
```
Circuit Breaker Check
├─ Is circuit closed? → Proceed
├─ Is circuit open? → Check timeout
└─ Is circuit half-open? → Test recovery

Retry Policy
├─ Execute request
├─ On failure: Retry with backoff
└─ Max retries: 3

Fallback Chain
├─ Primary provider fails?
├─ Try alternative 1
├─ Try alternative 2
└─ Try alternative 3
```

### 4. Provider Execution
```
Provider Client
├─ Call provider API
├─ Track usage
├─ Update quota
├─ Update health metrics
└─ Return response
```

### 5. Response
```
{
  "id": "uuid",
  "content": "Hello! How can I help you?",
  "model": "llama-3.1-8b-instruct",
  "provider": "cloudflare",
  "finishReason": "stop",
  "usage": {
    "promptTokens": 10,
    "completionTokens": 15,
    "totalTokens": 25
  },
  "timestamp": 1234567890,
  "_routing": {
    "totalLatency": 250,
    "routingOverhead": 50
  }
}
```

## Health Monitoring Flow

```
┌─────────────────────────────────────────────────────────┐
│  Health Check Timer (every 60 seconds)                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  For Each Provider:                                     │
│                                                         │
│  1. Call provider.test()                               │
│  2. Measure latency                                     │
│  3. Update success rate                                 │
│  4. Check circuit breaker state                         │
│  5. Update health status                                │
│                                                         │
│  If latency > 5000ms OR success rate < 90%:            │
│    - Mark as unhealthy                                  │
│    - Disable for routing                                │
│                                                         │
│  If provider recovers:                                  │
│    - Re-enable for routing                              │
│    - Reset circuit breaker                              │
└─────────────────────────────────────────────────────────┘
```

## Quota Tracking Flow

```
┌─────────────────────────────────────────────────────────┐
│  On Each Request:                                       │
│                                                         │
│  1. Get current quota from KV (or memory)               │
│  2. Check if quota needs reset (daily/monthly)          │
│  3. Add usage to quota.used                             │
│  4. Calculate remaining quota                           │
│  5. Check alert thresholds:                             │
│     - 80% used → Warning alert                          │
│     - 95% used → Critical alert                         │
│  6. Save quota to KV                                    │
│                                                         │
│  On Each Health Check:                                  │
│                                                         │
│  1. Calculate average hourly usage                       │
│  2. Detect usage trend (↑/→/↓)                          │
│  3. Project exhaustion time                             │
│  4. Generate recommendation                             │
└─────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────┐
│  Request Fails:                                         │
│                                                         │
│  1. Check error type:                                  │
│     - Rate limit (429) → Retry                          │
│     - Server error (5xx) → Retry                        │
│     - Timeout → Retry                                   │
│     - Network error → Retry                             │
│     - Other error → No retry                            │
│                                                         │
│  2. If retryable:                                       │
│     - Calculate delay: 1000ms * 2^attempt               │
│     - Add jitter: ±10%                                 │
│     - Wait                                              │
│     - Retry request                                     │
│                                                         │
│  3. If max retries exceeded:                            │
│     - Increment circuit breaker failure count           │
│     - If threshold reached → Open circuit               │
│     - Try next provider in fallback chain              │
│                                                         │
│  4. If all providers fail:                             │
│     - Return 503 Service Unavailable                    │
└─────────────────────────────────────────────────────────┘
```

## Cost Optimization Flow

```
┌─────────────────────────────────────────────────────────┐
│  Free Tier Maximization:                                │
│                                                         │
│  1. Check all providers' free tier quota                │
│  2. Sort by quota remaining (highest first)            │
│  3. Route to provider with most quota                   │
│  4. Track usage in real-time                            │
│  5. When quota < 10%: Switch to next provider          │
│                                                         │
│  Priority Order:                                        │
│  1. Cloudflare (10K neurons/day)                        │
│  2. OpenRouter (50 free requests/day)                   │
│  3. Groq (generous free tier)                           │
│  4. Cerebras (free tier)                                │
│  5. Paid tiers (if all free exhausted)                  │
└─────────────────────────────────────────────────────────┘
```

## Monitoring & Observability

```
┌─────────────────────────────────────────────────────────┐
│  Metrics Collected:                                     │
│                                                         │
│  Per Provider:                                          │
│  - Total requests                                       │
│  - Success rate                                         │
│  - Average latency (p50, p95, p99)                      │
│  - Quota usage/remaining                                │
│  - Circuit breaker state                                │
│  - Error rate                                           │
│                                                         │
│  Per Router:                                            │
│  - Total routings                                       │
│  - Routings per provider                                │
│  - Routings per strategy                                │
│  - Average selection time                               │
│  - Fallback rate                                        │
│                                                         │
│  Alerts Generated:                                      │
│  - Provider unhealthy                                   │
│  - Circuit breaker opened                               │
│  - Quota warning (80%)                                  │
│  - Quota critical (95%)                                 │
│  - High error rate (>5%)                                │
│  - High latency (>5s)                                   │
└─────────────────────────────────────────────────────────┘
```

## File Structure

```
packages/edge/src/lib/providers/
├── index.ts              # Exports and public API
├── base.ts               # Base types and interfaces
├── cloudflare-ai.ts      # Cloudflare Workers AI provider
├── groq.ts               # Groq provider
├── cerebras.ts           # Cerebras provider
├── openrouter.ts         # OpenRouter provider
├── registry.ts           # Provider registry
├── router.ts             # Request router
├── circuit-breaker.ts    # Circuit breaker & retry
├── quota.ts              # Quota tracking
└── README.md             # Documentation

tests/unit/lib/providers/
├── base.test.ts          # Base types tests
├── registry.test.ts      # Registry tests
└── circuit-breaker.test.ts # Circuit breaker tests
```

## Environment Variables

```bash
# Required
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_API_TOKEN=xxx

# Optional (for additional providers)
GROQ_API_KEY=xxx
CEREBRAS_API_KEY=xxx
OPENROUTER_API_KEY=xxx
```

## Deployment Checklist

- [ ] Configure environment variables
- [ ] Set up KV namespace for quota tracking
- [ ] Configure AI binding (or use HTTP API)
- [ ] Test provider connectivity
- [ ] Verify health checks
- [ ] Test routing strategies
- [ ] Test failover scenarios
- [ ] Set up monitoring dashboards
- [ ] Configure alert thresholds
- [ ] Load test (10K+ requests)
- [ ] Deploy to production
