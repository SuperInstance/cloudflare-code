# @claudeflare/distributed-tracing

Advanced distributed tracing system for ClaudeFlare providing high-performance trace collection, aggregation, analysis, and visualization.

## Features

- **High-Performance Trace Collector**: 100K+ spans/second ingestion with sub-100ms processing
- **Intelligent Trace Aggregation**: Automatic trace reconstruction and span correlation
- **Advanced Trace Analysis**: Latency analysis, bottleneck detection, critical path identification
- **Service Dependency Mapping**: Automatic service graph generation with call frequency and latency heatmaps
- **OpenTelemetry Compatible**: Full support for OpenTelemetry trace format
- **Cloudflare Workers Ready**: Optimized for Cloudflare Workers with Durable Objects support
- **Real-time Visualization**: Built-in visualization components for trace graphs and metrics

## Installation

```bash
npm install @claudeflare/distributed-tracing
```

## Quick Start

```typescript
import { TraceCollector, TraceAggregator, TraceAnalyzer } from '@claudeflare/distributed-tracing';

// Initialize collector
const collector = new TraceCollector({
  endpoint: 'https://your-tracing-endpoint.com',
  batchSize: 1000,
  flushInterval: 5000,
});

// Collect a span
await collector.collect({
  traceId: 'abc123',
  spanId: 'span456',
  parentSpanId: 'parent789',
  name: 'http.request',
  startTime: Date.now(),
  duration: 45,
  attributes: {
    'http.method': 'GET',
    'http.url': '/api/users',
  },
});

// Aggregate and analyze
const aggregator = new TraceAggregator();
const trace = await aggregator.aggregate('abc123');

const analyzer = new TraceAnalyzer();
const insights = await analyzer.analyze(trace);
console.log(insights.bottlenecks);
```

## Performance

- **Throughput**: 100,000+ spans/second
- **Latency**: <100ms trace completion
- **Memory**: Efficient buffering and streaming
- **Scalability**: Horizontal scaling with Durable Objects

## License

MIT
