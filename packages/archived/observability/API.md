# API Reference

## Table of Contents

- [Observability](#observability)
- [DistributedTracer](#distributedtracer)
- [StructuredLogger](#structuredlogger)
- [LogStream](#logstream)
- [CPUProfiler](#cpuprofiler)
- [MemoryProfiler](#memoryprofiler)
- [MemoryLeakDetector](#memoryleakdetector)
- [HTTPInspector](#httpinspector)
- [DebugRecorder](#debugrecorder)
- [SessionReplayer](#sessionreplayer)

## Observability

Main class that integrates all observability components.

### Constructor

```typescript
constructor(config: ObservabilityConfig)
```

### Methods

#### `initialize(): Promise<void>`

Initialize all observability components.

```typescript
await observability.initialize();
```

#### `getTracer(): DistributedTracer`

Get the distributed tracer instance.

#### `getLogger(): StructuredLogger`

Get the structured logger instance.

#### `getLogStream(): LogStream`

Get the log stream instance.

#### `getCPUProfiler(): CPUProfiler`

Get the CPU profiler instance.

#### `getMemoryProfiler(): MemoryProfiler`

Get the memory profiler instance.

#### `getLeakDetector(): MemoryLeakDetector`

Get the memory leak detector instance.

#### `getHTTPInspector(): HTTPInspector`

Get the HTTP inspector instance.

#### `getDebugRecorder(): DebugRecorder`

Get the debug recorder instance.

#### `getHealthStatus(): HealthStatus`

Get system health status.

```typescript
interface HealthStatus {
  initialized: boolean;
  tracingEnabled: boolean;
  loggingEnabled: boolean;
  profilingEnabled: boolean;
  memoryEnabled: boolean;
  inspectionEnabled: boolean;
  recordingEnabled: boolean;
  uptime: number;
}
```

#### `exportData(): ExportedData`

Export all observability data.

#### `shutdown(): Promise<void>`

Shutdown all components gracefully.

## DistributedTracer

Distributed tracing with OpenTelemetry integration.

### Constructor

```typescript
constructor(serviceName: string)
```

### Methods

#### `startSpan(name: string, options?: SpanOptions): { span: Span; context: TraceInfo }`

Start a new trace span.

```typescript
interface SpanOptions {
  kind?: SpanKind;
  attributes?: Attributes;
  startTime?: number;
  links?: TraceLink[];
}
```

#### `injectContext(headers: Record<string, string>): Record<string, string>`

Inject trace context into headers for propagation.

#### `extractContext(headers: Record<string, string>): Context | null`

Extract trace context from headers.

#### `recordSpan(spanId: string, metadata: SpanMetadata, parentSpanId?: string): void`

Record span metadata.

#### `buildTraceTree(traceId: string): TraceTreeNode | null`

Build a trace tree from recorded spans.

#### `addDependency(dependency: ServiceDependency): void`

Add a service dependency.

#### `generateServiceMap(): ServiceMap`

Generate a complete service map.

#### `getSpan(spanId: string): SpanMetadata | undefined`

Get a span by ID.

#### `getTraceSpans(traceId: string): SpanMetadata[]`

Get all spans for a trace.

#### `clear(): void`

Clear all recorded spans.

## StructuredLogger

Structured logging with correlation support.

### Constructor

```typescript
constructor(serviceName: string, options?: LoggerOptions)
```

### Methods

#### `trace(message: string, attributes?: Attributes): void`

Log a trace level message.

#### `debug(message: string, attributes?: Attributes): void`

Log a debug level message.

#### `info(message: string, attributes?: Attributes): void`

Log an info level message.

#### `warn(message: string, attributes?: Attributes): void`

Log a warning level message.

#### `error(message: string, error?: Error | Attributes, attributes?: Attributes): void`

Log an error level message.

#### `fatal(message: string, error?: Error | Attributes, attributes?: Attributes): void`

Log a fatal level message.

#### `setTraceContext(traceId: string, spanId?: string): void`

Set trace context for correlation.

#### `clearTraceContext(): void`

Clear trace context.

#### `child(context: string, additionalMetadata?: Attributes): StructuredLogger`

Create a child logger with inherited context.

#### `filter(filter: LogFilter): LogEntry[]`

Filter log entries.

```typescript
interface LogFilter {
  levels?: LogLevel[];
  startTime?: number;
  endTime?: number;
  traceId?: string;
  userId?: string;
  requestId?: string;
  searchQuery?: string;
  minLevel?: LogLevel;
  attributes?: Attributes;
}
```

#### `aggregate(): LogAggregation`

Aggregate logs by various dimensions.

#### `search(query: string, limit?: number): LogEntry[]`

Search logs by content.

## LogStream

Real-time log streaming with filters.

### Methods

#### `subscribe(filter: LogFilter | LogFilterCallback, callback: LogStreamCallback): () => void`

Subscribe to log entries.

Returns an unsubscribe function.

#### `publish(entry: LogEntry): void`

Publish a log entry to subscribers.

#### `setEnabled(enabled: boolean): void`

Enable or disable streaming.

#### `clearBuffer(): void`

Clear the log buffer.

## CPUProfiler

CPU profiling with flame graph generation.

### Constructor

```typescript
constructor(options?: ProfilingOptions)
```

### Methods

#### `start(): void`

Start CPU profiling.

#### `stop(): CPUProfile`

Stop CPU profiling and get results.

#### `generateFlameGraph(profile: CPUProfile): FlameGraphFrame`

Generate flame graph from profile.

#### `analyzeHotPaths(profile: CPUProfile, limit?: number): HotPath[]`

Analyze hot paths in the profile.

#### `detectBottlenecks(profile: CPUProfile): Bottleneck[]`

Detect performance bottlenecks.

## MemoryProfiler

Memory profiling for tracking memory usage.

### Constructor

```typescript
constructor(samplingInterval: number)
```

### Methods

#### `start(): void`

Start memory profiling.

#### `stop(): MemoryTimelinePoint[]`

Stop memory profiling and get timeline.

#### `getTimeline(): MemoryTimelinePoint[]`

Get memory usage timeline.

#### `getStatistics(): MemoryStatistics`

Get memory statistics.

#### `detectPotentialLeaks(): LeakDetection`

Detect potential memory leaks.

## MemoryLeakDetector

Memory leak detection with heap snapshot comparison.

### Constructor

```typescript
constructor(options?: LeakDetectionOptions)
```

### Methods

#### `startMonitoring(): void`

Start monitoring for memory leaks.

#### `stopMonitoring(): void`

Stop monitoring.

#### `takeSnapshot(): Promise<HeapSnapshot>`

Take a heap snapshot.

#### `checkForLeaks(): MemoryLeak[]`

Check for memory leaks.

#### `getDetectionReport(): DetectionReport`

Get detection report.

## HTTPInspector

HTTP request/response inspection.

### Constructor

```typescript
constructor(options?: InspectorOptions)
```

### Methods

#### `interceptFetch(): void`

Intercept fetch requests.

#### `recordRequest(request: Partial<RequestInspection> & { id: string }): void`

Record a request.

#### `recordResponse(response: Partial<ResponseInspection> & { id: string; requestId: string }): void`

Record a response.

#### `getPairs(): RequestResponsePair[]`

Get all request/response pairs.

#### `filterPairs(filter: InspectionFilter): RequestResponsePair[]`

Filter pairs by criteria.

#### `exportAsHAR(): string`

Export as HTTP Archive format.

## DebugRecorder

Debug session recording with variable inspection.

### Constructor

```typescript
constructor(options?: RecordingOptions)
```

### Methods

#### `startSession(name: string): string`

Start a debug session.

Returns session ID.

#### `stopSession(sessionId?: string): void`

Stop a debug session.

#### `pauseSession(sessionId?: string): void`

Pause a session.

#### `resumeSession(sessionId?: string): void`

Resume a paused session.

#### `recordFrame(action: StepAction, file: string, line: number, variables?: Record<string, any>): void`

Record a debug frame.

#### `addBreakpoint(file: string, line: number, condition?: string): string`

Add a breakpoint.

#### `removeBreakpoint(breakpointId: string): boolean`

Remove a breakpoint.

#### `addWatchExpression(expression: string): string`

Add a watch expression.

#### `exportRecording(sessionId: string): string | null`

Export recording as JSON.

## SessionReplayer

Debug session replay functionality.

### Constructor

```typescript
constructor(recording: DebugRecording)
```

### Methods

#### `play(speed?: number): void`

Start playback.

#### `pause(): void`

Pause playback.

#### `stop(): void`

Stop and reset playback.

#### `nextFrame(): boolean`

Move to next frame.

#### `previousFrame(): boolean`

Move to previous frame.

#### `jumpToFrame(frameIndex: number): boolean`

Jump to specific frame.

#### `jumpToTime(timestamp: number): boolean`

Jump to specific time.

#### `getCurrentFrame(): DebugFrame | null`

Get current frame.

#### `searchFrames(query: string): DebugFrame[]`

Search for frames by content.
