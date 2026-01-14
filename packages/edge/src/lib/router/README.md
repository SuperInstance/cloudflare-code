# Smart Router for ClaudeFlare

Intelligent request routing system with complexity-based routing, confidence cascading, and cost optimization.

## Overview

The Smart Router is a sophisticated request routing system that:

- **Analyzes request complexity** (simple/moderate/complex)
- **Detects intent** (chat/code/analysis/creative)
- **Selects optimal strategies** based on cost, quality, and speed
- **Executes through confidence cascade** starting with free tier
- **Optimizes costs** through intelligent batching and scheduling

## Architecture

```
Request → Semantic Cache → Request Analyzer → Strategy Selector
                                              ↓
                                       Confidence Cascade
                                              ↓
                                    (Tier 1 → Tier 2 → Tier 3)
                                              ↓
                                         Response → Cache
```

## Components

### 1. Request Analyzer (`analyzer.ts`)

Analyzes incoming requests to determine routing characteristics:

- **Complexity Detection**: simple, moderate, or complex
- **Intent Detection**: chat, code, analysis, or creative
- **Token Estimation**: Input and output token counts
- **Language Detection**: Programming languages in code
- **Code Snippet Detection**: Extracts code blocks
- **Semantic Hashing**: For cache lookup

```typescript
import { createRequestAnalyzer } from './lib/router';

const analyzer = createRequestAnalyzer();
const analysis = await analyzer.analyze(request);

console.log(analysis.complexity); // 'simple' | 'moderate' | 'complex'
console.log(analysis.intent);     // 'chat' | 'code' | 'analysis' | 'creative'
console.log(analysis.estimatedTokens.total);
```

### 2. Strategy Selector (`strategy.ts`)

Selects optimal execution strategies using multi-objective scoring:

- **Cost Score**: Prioritizes free tier and low-cost options
- **Quality Score**: Matches quality to request complexity
- **Speed Score**: Optimizes for low latency

```typescript
import { createStrategySelector } from './lib/router';

const selector = createStrategySelector(providerDefinitions);
const strategies = await selector.selectStrategies(analysis, providers);
```

### 3. Confidence Cascade (`cascade.ts`)

Executes requests through a tiered confidence cascade:

1. **Tier 1** (Free): Cloudflare Workers AI, Groq, Cerebras
2. **Tier 2** (Mid): OpenRouter, Together AI
3. **Tier 3** (Premium): Anthropic, OpenAI

Starts with Tier 1 and escalates only if confidence is low.

```typescript
import { createConfidenceCascade } from './lib/router';

const cascade = createConfidenceCascade(providers);
const result = await cascade.execute(request, strategies, analysis);

console.log(result.tierUsed);     // 1, 2, or 3
console.log(result.confidence);    // 0.0 - 1.0
console.log(result.cost);          // Actual cost in USD
console.log(result.attempts);      // Number of tiers tried
```

### 4. Cost Optimizer (`cost-optimizer.ts`)

Optimizes API costs through:

- **Request Batching**: Groups similar requests
- **Free Tier Scheduling**: Prioritizes free tier when available
- **Cost-Aware Selection**: Finds cheapest valid option

```typescript
import { createCostOptimizer } from './lib/router';

const optimizer = createCostOptimizer(providers);
const cheapest = await optimizer.findCheapest(request, analysis, strategies);
await optimizer.batchRequests(request, analysis);
```

### 5. Smart Router (`smart-router.ts`)

Main orchestration layer combining all components:

```typescript
import { createSmartRouter } from './lib/router';

const router = createSmartRouter(
  providers,
  providerDefinitions,
  semanticCache,
  {
    enableCache: true,
    enableCascade: true,
    minConfidence: 0.75,
    maxCascadeAttempts: 3,
  }
);

const response = await router.route(request);
```

## Performance Targets

| Metric | Target |
|--------|--------|
| Tier 1 (Free) Handling | 70-90% of requests |
| Cost Reduction | 90%+ vs premium only |
| Routing Overhead | <50ms |
| Cache Hit Rate | 45-80% |
| Average Latency | <500ms |

## Routing Strategy

### Complexity-Based Routing

- **Simple** (tokens < 200, short context):
  - Use Tier 1 (free)
  - Focus on speed
  - Accept lower quality

- **Moderate** (tokens 200-1000, some context):
  - Start with Tier 1
  - Escalate to Tier 2 if needed
  - Balance cost and quality

- **Complex** (tokens > 1000, long context, code):
  - Start with Tier 2
  - Escalate to Tier 3 if needed
  - Prioritize quality

### Intent-Based Routing

- **Chat**: Use free tier, focus on speed
- **Code**: Use higher tier, prioritize accuracy
- **Analysis**: Use mid-tier, balance quality/cost
- **Creative**: Use any tier, depends on complexity

## Confidence Evaluation

The cascade evaluates response confidence using:

1. **Response Length**: Substantial responses score higher
2. **Finish Reason**: Natural completion > truncated
3. **Content Patterns**: Certainty vs uncertainty indicators
4. **Structure**: Code blocks, lists increase confidence
5. **Complexity Match**: Simpler queries need higher confidence

## Configuration

### Analyzer Configuration

```typescript
{
  simpleThreshold: 200,      // Tokens for simple complexity
  complexThreshold: 1000,    // Tokens for complex complexity
  codeLineThreshold: 20,     // Code lines for complexity
}
```

### Cascade Configuration

```typescript
{
  minConfidence: 0.75,       // Minimum confidence to accept
  maxAttempts: 3,            // Maximum cascade attempts
  confidenceThresholds: {
    tier1: 0.85,            // Confidence needed for Tier 1
    tier2: 0.90,            // Confidence needed for Tier 2
    tier3: 0.95,            // Confidence needed for Tier 3
  },
  enableAutoEscalation: true, // Auto-escalate if not confident
}
```

### Router Configuration

```typescript
{
  enableCache: true,          // Enable semantic caching
  enableCascade: true,        // Enable confidence cascade
  enableCostOptimization: true, // Enable cost optimization
  enableBatching: false,      // Enable request batching
  minQuality: 0.7,           // Minimum quality threshold
  weights: {
    cost: 0.4,               // Cost weight in strategy scoring
    quality: 0.4,            // Quality weight in strategy scoring
    speed: 0.2,              // Speed weight in strategy scoring
  },
}
```

## Statistics

The router tracks detailed statistics:

```typescript
const stats = router.getDetailedStats();

console.log(stats.router.totalRequests);
console.log(stats.router.cacheHits, stats.router.cacheMisses);
console.log(stats.router.requestsByTier);     // Map<tier, count>
console.log(stats.router.requestsByComplexity); // Map<complexity, count>
console.log(stats.router.totalCost);          // Total USD spent
console.log(stats.router.averageLatency);     // Average ms

console.log(stats.cascade.averageAttempts);   // Avg tiers per request
console.log(stats.cascade.tierDistribution);  // Which tiers were used

console.log(stats.costOptimizer.batchesProcessed);
console.log(stats.costOptimizer.freeTierRequests);

console.log(stats.cache.hitRate);             // Cache hit percentage
console.log(stats.cache.tokensSaved);         // Tokens saved by caching
```

## Examples

### Basic Usage

```typescript
import { createSmartRouter } from './lib/router';
import { ProviderRegistry } from './lib/providers/registry';

// Set up providers
const registry = new ProviderRegistry();
registry.register(cloudflareProvider);
registry.register(groqProvider);
registry.register(anthropicProvider);

// Create router
const router = createSmartRouter(
  registry.getAll(),
  providerDefinitions,
  semanticCache
);

// Route requests
const response = await router.route({
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### With Custom Configuration

```typescript
const router = createSmartRouter(
  providers,
  providerDefinitions,
  semanticCache,
  {
    minConfidence: 0.8,        // Higher confidence threshold
    maxCascadeAttempts: 2,     // Limit to 2 tiers
    enableCache: true,
    enableCostOptimization: true,
    weights: {
      cost: 0.5,   // Prioritize cost more
      quality: 0.3,
      speed: 0.2,
    },
  }
);
```

### Monitoring Performance

```typescript
// Route some requests
for (let i = 0; i < 100; i++) {
  await router.route(requests[i]);
}

// Get statistics
const stats = router.getDetailedStats();

console.log('Total Requests:', stats.router.totalRequests);
console.log('Tier Distribution:', Object.fromEntries(stats.router.requestsByTier));
console.log('Average Attempts:', stats.cascade.averageAttempts);
console.log('Total Cost:', `$${stats.router.totalCost.toFixed(4)}`);
console.log('Cache Hit Rate:', `${stats.cache!.hitRate.toFixed(1)}%`);
console.log('Cost Savings:', `$${stats.router.costSavings.toFixed(4)}`);
```

### Health Checking

```typescript
const health = await router.healthCheck();

if (!health.healthy) {
  console.error('Router is unhealthy!');
  console.error('Healthy providers:', health.providersHealthy, '/', health.providersTotal);
}

if (!health.cacheHealthy) {
  console.warn('Cache is not healthy');
}
```

## Testing

Run unit tests:

```bash
npm test -- tests/router/analyzer.test.ts
npm test -- tests/router/strategy.test.ts
npm test -- tests/router/cascade.test.ts
npm test -- tests/router/smart-router.test.ts
```

Run all router tests:

```bash
npm test -- tests/router/
```

## Best Practices

1. **Enable Semantic Caching**: Achieve 45-80% cache hit rate
2. **Use Confidence Cascade**: Let quality determine tier escalation
3. **Monitor Statistics**: Track tier distribution and costs
4. **Tune Thresholds**: Adjust confidence thresholds based on your needs
5. **Check Health**: Monitor provider health status
6. **Handle Failures**: Always wrap router calls in try-catch

## License

MIT
