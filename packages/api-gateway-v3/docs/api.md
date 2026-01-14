# API Gateway v3 - API Reference

## Core Classes

### APIGateway

Main gateway class that integrates all components.

```typescript
class APIGateway {
  constructor(config: GatewayConfig)
  async initialize(): Promise<void>
  async handle(request: GatewayRequest): Promise<GatewayResponse>
  async executeComposition(request: CompositionRequest): Promise<CompositionResult>
  async executeBatch(requests: CompositionRequest[]): Promise<CompositionResult[]>
  async createStream(type: 'sse' | 'websocket', clientId: string): Promise<string>
  async executeEdgeFunction(functionId: string, input: unknown, context: EdgeRequestContext): Promise<unknown>
  async executeWorkflow(workflowId: string, input: Record<string, unknown>): Promise<WorkflowExecution>
  async executeGraphQL(request: GraphQLRequest): Promise<GraphQLResponse>
  getAnalytics(): AnalyticsEngine
  getMetrics(): GatewayMetrics
  async shutdown(): Promise<void>
}
```

### CompositionEngine

Handles API composition and service orchestration.

```typescript
class CompositionEngine {
  constructor(serviceRegistry: ServiceRegistry, config?: Partial<CompositionEngineConfig>)
  async execute(request: CompositionRequest): Promise<CompositionResult>
  async executeBatch(requests: CompositionRequest[]): Promise<CompositionResult[]>
  async getStatus(requestId: string): Promise<CompositionResult | null>
  async cancel(requestId: string): Promise<boolean>
  clearCache(pattern?: string): void
  getMetrics(): CompositionMetricsSnapshot
  resetMetrics(): void
}
```

### SSEGateway

Server-Sent Events gateway for real-time streaming.

```typescript
class SSEGateway extends EventEmitter {
  constructor(config?: Partial<StreamGatewayConfig>)
  async connect(clientId: string, writable: WritableStream, headers?: Headers): Promise<string>
  async subscribe(connectionId: string, channel: string): Promise<void>
  async unsubscribe(connectionId: string, channel: string): Promise<void>
  async broadcast(channel: string, message: SSEMessage): Promise<number>
  async send(connectionId: string, message: SSEMessage): Promise<void>
  async disconnect(connectionId: string, code?: number, reason?: string): Promise<void>
  getConnection(connectionId: string): SSEConnection | undefined
  getClientConnections(clientId: string): SSEConnection[]
  getMetrics(): StreamMetrics
  async cleanupIdle(idleTimeout: number): Promise<number>
  async shutdown(): Promise<void>
}
```

### WebSocketGateway

WebSocket gateway for bidirectional real-time communication.

```typescript
class WebSocketGateway extends EventEmitter {
  constructor(config?: Partial<StreamGatewayConfig>)
  async accept(socket: WebSocket, clientId: string, headers?: Headers): Promise<string>
  async subscribe(connectionId: string, channel: string): Promise<void>
  async unsubscribe(connectionId: string, channel: string): Promise<void>
  async broadcast(channel: string, message: unknown): Promise<number>
  async send(connectionId: string, message: WebSocketMessage): Promise<void>
  async disconnect(connectionId: string, code?: number, reason?: string): Promise<void>
  getConnection(connectionId: string): WebSocketConnection | undefined
  getMetrics(): StreamMetrics
}
```

### EdgeOptimizer

Edge computing optimization and caching.

```typescript
class EdgeOptimizer {
  constructor(config?: Partial<EdgeOptimizerConfig>)
  async optimizeRequest(request: GatewayRequest, context: EdgeRequestContext): Promise<OptimizedRequest>
  async optimizeResponse(response: GatewayResponse, cacheConfig?: EdgeCacheConfig): Promise<GatewayResponse>
  async executeFunction(functionId: string, input: unknown, context: EdgeRequestContext): Promise<unknown>
  async set(key: string, value: unknown, options?: CacheOptions): Promise<void>
  async get(key: string): Promise<EdgeCacheEntry | null>
  async invalidate(pattern?: string, tags?: string[]): Promise<number>
  async purge(): Promise<void>
  getMetrics(): EdgeMetrics
  addFunction(fn: EdgeFunction): void
  removeFunction(functionId: string): boolean
  async warmup(keys: string[], fetcher: (key: string) => Promise<unknown>): Promise<void>
}
```

### AnalyticsEngine

Real-time analytics and metrics collection.

```typescript
class AnalyticsEngine extends EventEmitter {
  constructor(config?: Partial<AnalyticsEngineConfig>)
  recordEvent(event: AnalyticsEvent): void
  recordMetric(metric: AnalyticsMetric): void
  increment(name: string, value?: number, dimensions?: Record<string, string>, tags?: string[]): void
  gauge(name: string, value: number, dimensions?: Record<string, string>, tags?: string[]): void
  histogram(name: string, value: number, dimensions?: Record<string, string>, tags?: string[]): void
  timing(name: string, duration: number, dimensions?: Record<string, string>, tags?: string[]): void
  queryEvents(query: AnalyticsQuery): AnalyticsEvent[]
  queryMetrics(query: AnalyticsQuery): TimeSeries
  createDashboard(dashboard: AnalyticsDashboard): void
  getDashboard(id: string): AnalyticsDashboard | undefined
  listDashboards(): AnalyticsDashboard[]
  updateDashboard(id: string, updates: Partial<AnalyticsDashboard>): boolean
  deleteDashboard(id: string): boolean
  async executeWidget(dashboardId: string, widgetId: string): Promise<unknown>
  async executeQuery(query: AnalyticsQuery): Promise<unknown>
  getMetricSummary(metric: string): MetricSummary | undefined
  getAllMetricSummaries(): Map<string, MetricSummary>
  async flush(): Promise<void>
  async shutdown(): Promise<void>
}
```

## Types

### GatewayRequest

```typescript
interface GatewayRequest {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  headers: Headers;
  body: ReadableStream | null;
  query: URLSearchParams;
  params: Record<string, string>;
  context: RequestContext;
  metadata: RequestMetadata;
}
```

### GatewayResponse

```typescript
interface GatewayResponse {
  status: number;
  statusText: string;
  headers: Headers;
  body: ReadableStream | string | null;
  metadata: ResponseMetadata;
}
```

### CompositionRequest

```typescript
interface CompositionRequest {
  requestId: string;
  operations: CompositionOperation[];
  timeout?: number;
  mergeStrategy?: MergeStrategy;
  errorPolicy?: ErrorPolicy;
}
```

### CompositionResult

```typescript
interface CompositionResult {
  requestId: string;
  data: Record<string, unknown>;
  errors: CompositionError[];
  metadata: CompositionMetadata;
}
```

## Utilities

### createGateway

Factory function to create a new gateway instance.

```typescript
function createGateway(config: GatewayConfig): APIGateway
```

### initializeGateway

Factory function to create and initialize a gateway.

```typescript
function initializeGateway(config: GatewayConfig): Promise<APIGateway>
```

### QueryBuilder

Builder for creating analytics queries.

```typescript
class QueryBuilder {
  metric(name: string): QueryBuilder
  filter(field: string, operator: QueryFilter['operator'], value: unknown): QueryBuilder
  aggregation(type: AggregationType): QueryBuilder
  groupBy(...fields: string[]): QueryBuilder
  timeRange(start: number, end: number, interval?: number): QueryBuilder
  lastMinutes(minutes: number): QueryBuilder
  lastHours(hours: number): QueryBuilder
  build(): AnalyticsQuery
}
```

### DashboardBuilder

Builder for creating analytics dashboards.

```typescript
class DashboardBuilder {
  id(id: string): DashboardBuilder
  name(name: string): DashboardBuilder
  description(description: string): DashboardBuilder
  refreshInterval(interval: number): DashboardBuilder
  addWidget(widget: DashboardWidget): DashboardBuilder
  build(): AnalyticsDashboard
}
```

### WidgetBuilder

Builder for creating dashboard widgets.

```typescript
class WidgetBuilder {
  id(id: string): WidgetBuilder
  type(type: WidgetType): WidgetBuilder
  title(title: string): WidgetBuilder
  query(query: AnalyticsQuery): WidgetBuilder
  config(config: Partial<DashboardWidget['config']>): WidgetBuilder
  build(): DashboardWidget
}
```

## Error Classes

### GatewayError

Base error class for all gateway errors.

```typescript
class GatewayError extends Error {
  constructor(message: string, code: string, statusCode?: number, details?: unknown)
  code: string
  statusCode: number
  details?: unknown
}
```

### ServiceUnavailableError

Service is unavailable or unhealthy.

```typescript
class ServiceUnavailableError extends GatewayError
```

### TimeoutError

Operation timed out.

```typescript
class TimeoutError extends GatewayError
```

### CircuitBreakerOpenError

Circuit breaker is open for service.

```typescript
class CircuitBreakerOpenError extends GatewayError
```

### RateLimitExceededError

Rate limit exceeded.

```typescript
class RateLimitExceededError extends GatewayError
```

### ValidationError

Request validation failed.

```typescript
class ValidationError extends GatewayError
```

### AuthenticationError

Authentication required or failed.

```typescript
class AuthenticationError extends GatewayError
```

### AuthorizationError

Access denied.

```typescript
class AuthorizationError extends GatewayError
```

## Constants

```typescript
const VERSION = '3.0.0'
const DEFAULT_TIMEOUT = 30000
const MAX_REQUEST_SIZE = 104857600 // 100MB
const MAX_RESPONSE_SIZE = 104857600 // 100MB
const DEFAULT_CACHE_TTL = 3600000 // 1 hour
const DEFAULT_RATE_LIMIT = 1000
const DEFAULT_RATE_WINDOW = 60000 // 1 minute
const DEFAULT_CIRCUIT_THRESHOLD = 0.5 // 50%
const DEFAULT_CIRCUIT_RESET = 60000 // 1 minute
```

## Utility Functions

```typescript
function createRequestId(): string
function createTraceId(): string
function createSessionId(): string
function parseContentType(header: string | null): { type: string; charset?: string }
function parseAccept(header: string | null): string[]
function formatDuration(ms: number): string
function formatBytes(bytes: number): string
function isRetryableStatus(status: number): boolean
function isCacheableMethod(method: string): boolean
function isCacheableStatus(status: number): boolean
function isSafeMethod(method: string): boolean
function isIdempotentMethod(method: string): boolean
function sanitizeHeaders(headers: Headers): Headers
function mergeHeaders(...headers: Headers[]): Headers
function cloneHeaders(headers: Headers): Headers
function parseCacheControl(header: string | null): CacheControlDirectives
```
