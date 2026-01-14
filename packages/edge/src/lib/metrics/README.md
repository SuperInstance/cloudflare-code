# ClaudeFlare Metrics Collection System

Comprehensive observability and monitoring system for AI cost analytics, provider performance, and cache efficiency.

## Overview

The metrics collection system provides real-time visibility into:
- **Request Metrics**: Individual AI request tracking with tokens, latency, and costs
- **Provider Metrics**: Health monitoring and performance across AI providers
- **Cache Metrics**: Hit rates, savings, and performance across storage tiers
- **Dashboard Data**: Aggregated metrics for visualization and alerting

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Metrics Collection Layer                                   │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Request      │  │ Provider     │  │ Cache        │     │
│  │ Collector    │  │ Collector    │  │ Collector    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Metrics Aggregator                                         │
│  - Dashboard data                                          │
│  - Cost savings                                            │
│  - Anomaly detection                                       │
│  - Forecasting                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Storage Tiers                                             │
│  - HOT: Durable Object Memory (last hour)                  │
│  - WARM: KV Namespace (last 24 hours)                      │
│  - COLD: R2 Storage (archived)                             │
└─────────────────────────────────────────────────────────────┘
```

## Installation

The metrics system is integrated into ClaudeFlare by default. No additional installation required.

## Usage

### Basic Metrics Collection

Metrics are automatically collected for all API requests. To manually record metrics:

```typescript
import { setMetricsContext, calculateCost } from '../middleware/metrics';

// In your request handler
export async function handleChatRequest(c: Context) {
  const startTime = Date.now();

  try {
    // ... process request ...

    const response = await provider.complete(messages);

    // Set metrics context
    setMetricsContext(c, {
      provider: 'anthropic',
      model: 'claude-3-sonnet',
      tokens: {
        prompt: response.usage.prompt_tokens,
        completion: response.usage.completion_tokens,
        total: response.usage.total_tokens,
      },
      cacheHit: false,
      cost: calculateCost('anthropic', 'claude-3-sonnet', {
        prompt: response.usage.prompt_tokens,
        completion: response.usage.completion_tokens,
      }),
      success: true,
      feature: 'code-gen',
    });

    return c.json(response);
  } catch (error) {
    setMetricsContext(c, {
      provider: 'anthropic',
      success: false,
      errorCode: error.code,
    });
    throw error;
  }
}
```

### Accessing Metrics

#### Prometheus Metrics Endpoint

```bash
curl http://localhost:8787/metrics
```

Returns Prometheus-compatible metrics:
```
# HELP requests_total Total number of requests
# TYPE requests_total counter
requests_total 1234

# HELP request_success_rate Success rate of requests
# TYPE request_success_rate gauge
request_success_rate 0.995

# HELP cost_total_dollars Total cost in dollars
# TYPE cost_total_dollars counter
cost_total_dollars 12.34
```

#### Dashboard API

```bash
curl http://localhost:8787/v1/metrics/dashboard?timeRange=day
```

Returns dashboard data:
```json
{
  "timestamp": 1705177200000,
  "timeRange": {
    "start": 1705090800000,
    "end": 1705177200000,
    "label": "Last 24 Hours"
  },
  "overview": {
    "totalCost": 2.87,
    "totalRequests": 1234,
    "cacheHitRate": 0.678,
    "avgLatency": 234,
    "successRate": 99.5,
    "trends": {
      "cost": 12,
      "requests": 5,
      "cacheHitRate": 8,
      "latency": -15
    }
  },
  "costByProvider": {
    "anthropic": 1.20,
    "openai": 0.95,
    "groq": 0.72
  },
  "topProviders": [...],
  "recentAnomalies": [...]
}
```

#### Cost Savings

```bash
curl http://localhost:8787/v1/metrics/savings?period=day
```

Returns savings breakdown:
```json
{
  "totalSavings": 1.87,
  "savingsPercentage": 65.2,
  "cacheSavings": {
    "amount": 1.50,
    "percentage": 52.3,
    "tokensSaved": 150000
  },
  "routingSavings": {
    "amount": 0.25,
    "percentage": 8.7
  },
  "cascadeSavings": {
    "amount": 0.12,
    "percentage": 4.2
  }
}
```

#### Anomaly Detection

```bash
curl http://localhost:8787/v1/metrics/anomalies
```

Returns detected anomalies:
```json
{
  "anomalies": [
    {
      "id": "cost-spike-1705177200000",
      "type": "cost_spike",
      "severity": "critical",
      "timestamp": 1705177200000,
      "currentValue": 5.50,
      "baselineValue": 2.87,
      "deviation": 91.6,
      "description": "Cost spike detected: 5.50 vs baseline 2.87",
      "resolved": false
    }
  ],
  "count": 1,
  "timestamp": 1705177200000
}
```

## API Endpoints

### Metrics Collection

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/metrics/record` | POST | Record metrics for a request |

### Metrics Query

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/metrics` | GET | Prometheus metrics endpoint |
| `/v1/metrics/dashboard` | GET | Dashboard data |
| `/v1/metrics/savings` | GET | Cost savings breakdown |
| `/v1/metrics/providers` | GET | All provider metrics |
| `/v1/metrics/providers/:provider` | GET | Specific provider metrics |
| `/v1/metrics/cache` | GET | Cache performance metrics |
| `/v1/metrics/anomalies` | GET | Detected anomalies |
| `/v1/metrics/forecast` | GET | Cost forecast |
| `/v1/metrics/top-providers` | GET | Ranked providers |

## Metrics Types

### Request Metrics

```typescript
interface RequestMetrics {
  requestId: string;
  timestamp: number;
  provider: string;
  model: string;
  latency: number; // milliseconds
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  cacheHit: boolean;
  cacheTier?: 'hot' | 'warm' | 'cold';
  cost: number;
  success: boolean;
  errorCode?: string;
  userId?: string;
  sessionId?: string;
  feature?: string;
}
```

### Provider Metrics

```typescript
interface ProviderMetrics {
  provider: string;
  timestamp: number;
  health: 'healthy' | 'degraded' | 'down';
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  successRate: number;
  requestsPerMinute: number;
  quotaUsed: number;
  quotaTotal: number;
  costPer1KTokens: {
    input: number;
    output: number;
  };
}
```

### Cache Metrics

```typescript
interface CacheMetrics {
  tier: 'hot' | 'warm' | 'cold';
  timestamp: number;
  hitRate: number;
  totalRequests: number;
  hits: number;
  misses: number;
  avgLatency: number;
  size: number;
  entryCount: number;
  evictionCount: number;
}
```

## Storage Strategy

### HOT Tier (Durable Objects)
- **Retention**: 1 hour
- **Use Case**: Recent metrics for real-time monitoring
- **Performance**: Sub-millisecond access

### WARM Tier (KV Namespace)
- **Retention**: 24 hours
- **Use Case**: Aggregated metrics for dashboard queries
- **Performance**: 1-50ms access

### COLD Tier (R2 Storage)
- **Retention**: Indefinite
- **Use Case**: Historical analysis and auditing
- **Performance**: 50-100ms access

## Configuration

### Environment Variables

```typescript
interface Env {
  // KV Namespaces
  CACHE_KV?: KVNamespace;

  // R2 Storage
  STORAGE_R2?: R2Bucket;

  // Environment
  ENVIRONMENT: 'development' | 'staging' | 'production';
}
```

### Metrics Configuration

```typescript
import { metricsCollector } from './middleware/metrics';

app.use('*', metricsCollector({
  collectRequestMetrics: true,
  collectProviderMetrics: true,
  collectCacheMetrics: true,
  sampleRate: 1.0, // Collect 100% of metrics
}));
```

## Performance Considerations

### Sampling

For high-traffic deployments, consider sampling metrics:

```typescript
app.use('*', metricsCollector({
  sampleRate: 0.1, // Collect 10% of metrics
}));
```

### Async Collection

Metrics are collected asynchronously to minimize impact on request latency:

```typescript
// Metrics collection doesn't block responses
await recordMetrics(metric); // Fire and forget
```

### Storage Optimization

- Metrics are automatically aggregated before storage
- HOT tier is cleaned up hourly
- WARM tier expires after 24 hours
- COLD tier uses compressed JSON

## Monitoring

### Prometheus Setup

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'claudeflare'
    scrape_interval: 15s
    static_configs:
      - targets: ['your-worker.workers.dev']
```

### Grafana Dashboard

Import the provided Grafana dashboard for visualization:
- Cost overview
- Provider comparison
- Cache performance
- Anomaly alerts

## Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

## Troubleshooting

### Metrics Not Appearing

1. Check KV/R2 bindings are configured
2. Verify environment variables are set
3. Check logs for collection errors

### High Memory Usage

1. Reduce HOT tier retention
2. Enable sampling
3. Increase aggregation frequency

### Slow Queries

1. Check KV/R2 performance
2. Optimize time range queries
3. Use cached dashboard data

## Best Practices

1. **Always record metrics** for AI requests
2. **Use feature tags** to track different use cases
3. **Monitor cache hit rates** for optimization opportunities
4. **Set up alerts** for cost anomalies
5. **Review trends** weekly for optimization opportunities

## Contributing

When adding new metrics:

1. Update types in `lib/metrics/types.ts`
2. Add collection logic to appropriate collector
3. Update Prometheus formatter
4. Add tests
5. Update documentation

## License

MIT
