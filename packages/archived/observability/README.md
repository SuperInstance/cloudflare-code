# @claudeflare/observability

Advanced debugging and observability tools for ClaudeFlare - a distributed AI coding platform on Cloudflare Workers.

## Features

### Distributed Tracing
- **OpenTelemetry Integration**: Full OpenTelemetry support for distributed tracing
- **Trace Context Propagation**: Automatic propagation of trace context across services
- **Span Management**: Create, manage, and correlate spans
- **Service Map Generation**: Automatically build service dependency graphs
- **Trace Visualization**: Generate waterfall charts, flame graphs, and Gantt charts
- **Latency Analysis**: P50, P95, P99 latency calculations

### Log Aggregation
- **Structured Logging**: JSON-structured logs with correlation
- **Log Correlation**: Automatic correlation with trace context
- **Real-time Streaming**: Subscribe to log streams with filters
- **Log Search**: Full-text search across log entries
- **Aggregation**: Aggregate logs by level, trace, user, etc.
- **Multiple Exporters**: Console, OTLP, or custom exporters

### Performance Profiling
- **CPU Profiling**: Capture CPU usage samples
- **Flame Graphs**: Generate flame graphs for visualization
- **Hot Path Analysis**: Identify performance bottlenecks
- **Bottleneck Detection**: Automatic detection of performance issues
- **Memory Profiling**: Track memory usage over time
- **Trend Analysis**: Detect memory leaks and growth patterns

### Memory Leak Detection
- **Heap Snapshot Comparison**: Compare snapshots to find leaks
- **Retained Size Analysis**: Analyze object retention
- **Leak Detection Algorithms**: Automatic leak detection
- **Memory Timeline**: Track memory usage over time
- **Object Reference Tracking**: Follow object references

### Request/Response Inspection
- **HTTP Interception**: Intercept and record fetch requests
- **Headers Inspection**: View request/response headers
- **Body Inspection**: Capture request/response bodies
- **Timing Breakdown**: Detailed timing information
- **HAR Export**: Export to HTTP Archive format

### Debug Recording
- **Session Recording**: Record debug sessions
- **Variable Inspection**: Inspect variables at any point
- **Breakpoint Management**: Set and manage breakpoints
- **Watch Expressions**: Monitor expressions
- **Session Replay**: Replay recorded sessions

## Installation

```bash
npm install @claudeflare/observability
```

## Quick Start

```typescript
import { createObservability } from '@claudeflare/observability';

// Create observability instance
const observability = createObservability({
  serviceName: 'my-service',
  environment: 'production',
});

// Initialize
await observability.initialize();

// Use components
const tracer = observability.getTracer();
const logger = observability.getLogger();
const profiler = observability.getCPUProfiler();

// Create a trace
const { span, context } = tracer.startSpan('my-operation');

// Log with correlation
logger.setTraceContext(context.traceId, context.spanId);
logger.info('Processing request', { userId: '123' });

// Do some work...
span.end();

// Shutdown when done
await observability.shutdown();
```

## Usage

### Distributed Tracing

```typescript
import { DistributedTracer } from '@claudeflare/observability';

const tracer = new DistributedTracer('my-service');

// Start a span
const { span, context } = tracer.startSpan('database-query', {
  kind: SpanKind.CLIENT,
  attributes: {
    'db.system': 'postgresql',
    'db.name': 'mydb',
  },
});

// Inject trace context for propagation
const headers = tracer.injectContext({});
// Send headers with downstream requests...

// End the span
span.end();

// Generate service map
const serviceMap = tracer.generateServiceMap();
```

### Structured Logging

```typescript
import { StructuredLogger, LogLevel } from '@claudeflare/observability';

const logger = new StructuredLogger('my-service', {
  level: LogLevel.INFO,
  enableCorrelation: true,
});

// Log at various levels
logger.trace('Detailed trace info', { detail: 'value' });
logger.debug('Debug message');
logger.info('Info message', { userId: '123' });
logger.warn('Warning message');
logger.error('Error message', error);
logger.fatal('Fatal error', error);

// Filter logs
const errors = logger.filter({
  levels: [LogLevel.ERROR, LogLevel.FATAL],
  startTime: Date.now() - 3600000,
});

// Aggregate logs
const aggregation = logger.aggregate();
console.log(aggregation.errorRate);
```

### Log Streaming

```typescript
import { LogStream } from '@claudeflare/observability';

const logStream = new LogStream();

// Subscribe to error logs
const unsubscribe = logStream.subscribe(
  {
    levels: [LogLevel.ERROR, LogLevel.FATAL],
  },
  (entry) => {
    console.error('Error received:', entry);
  }
);

// Unsubscribe when done
unsubscribe();
```

### CPU Profiling

```typescript
import { CPUProfiler } from '@claudeflare/observability';

const profiler = new CPUProfiler({
  interval: 1000, // 1ms sampling
  duration: 30000, // 30 seconds
});

// Start profiling
profiler.start();

// Do some work...

// Stop and get profile
const profile = profiler.stop();

// Generate flame graph
const flameGraph = profiler.generateFlameGraph(profile);

// Analyze hot paths
const hotPaths = profiler.analyzeHotPaths(profile, 10);

// Detect bottlenecks
const bottlenecks = profiler.detectBottlenecks(profile);
```

### Memory Profiling

```typescript
import { MemoryProfiler } from '@claudeflare/observability';

const profiler = new MemoryProfiler(1000); // 1 second intervals

// Start profiling
profiler.start();

// Get timeline while profiling
const timeline = profiler.getTimeline();

// Stop profiling
const finalTimeline = profiler.stop();

// Get statistics
const stats = profiler.getStatistics();
console.log(stats.trend); // 'increasing' | 'decreasing' | 'stable'
```

### Memory Leak Detection

```typescript
import { MemoryLeakDetector } from '@claudeflare/observability';

const detector = new MemoryLeakDetector({
  threshold: 20, // 20% growth
  minSnapshots: 3,
});

// Start monitoring
detector.startMonitoring();

// Take snapshots periodically
await detector.takeSnapshot();
await detector.takeSnapshot();

// Check for leaks
const leaks = detector.checkForLeaks();

// Get detection report
const report = detector.getDetectionReport();
if (report.leakDetected) {
  console.warn('Memory leak detected:', report.leaks);
}
```

### HTTP Inspection

```typescript
import { HTTPInspector } from '@claudeflare/observability';

const inspector = new HTTPInspector({
  recordHeaders: true,
  recordBody: true,
  maxBodySize: 102400, // 100KB
  maskSensitiveHeaders: ['authorization', 'cookie'],
});

// Intercept fetch calls
inspector.interceptFetch();

// Get request/response pairs
const pairs = inspector.getPairs();

// Filter pairs
const errors = inspector.filterPairs({
  hasError: true,
  startTime: Date.now() - 3600000,
});

// Get statistics
const stats = inspector.getStatistics();
console.log(stats.errorRate);

// Export as HAR
const har = inspector.exportAsHAR();
```

### Debug Recording

```typescript
import { DebugRecorder } from '@claudeflare/observability';

const recorder = new DebugRecorder({
  maxSessionDuration: 300000, // 5 minutes
  maxFramesPerSession: 10000,
  autoRecordOnError: true,
});

// Start a session
const sessionId = recorder.startSession('debugging-issue-123');

// Record frames during execution
recorder.recordFrame(
  StepAction.STEP_OVER,
  'app.js',
  42,
  { variable1: 'value1', variable2: 'value2' }
);

// Add breakpoints
const bpId = recorder.addBreakpoint('app.js', 42, 'x > 10');

// Add watch expressions
const watchId = recorder.addWatchExpression('user.profile.name');

// Stop session
recorder.stopSession(sessionId);

// Get recording
const recording = recorder.getRecording(sessionId);

// Export recording
const exported = recorder.exportRecording(sessionId);
```

### Session Replay

```typescript
import { SessionReplayer } from '@claudeflare/observability';

const replayer = new SessionReplayer(recording);

// Play recording
replayer.play(1); // 1x speed

// Pause
replayer.pause();

// Navigate frames
replayer.nextFrame();
replayer.previousFrame();
replayer.jumpToFrame(100);
replayer.jumpToTime(timestamp);

// Get current state
const frame = replayer.getCurrentFrame();
const state = replayer.getState();

// Search frames
const results = replayer.searchFrames('functionName');

// Get call frequency
const frequency = replayer.getCallFrequency();

// Get variable changes
const changes = replayer.getVariableChanges('myVariable');
```

## Configuration

```typescript
import { ObservabilityConfig } from '@claudeflare/observability';

const config: ObservabilityConfig = {
  enabled: true,
  serviceName: 'my-service',
  serviceVersion: '1.0.0',
  environment: 'production',

  tracing: {
    enabled: true,
    sampleRate: 1.0, // 100% sampling
    exporter: 'otlp',
    exporterEndpoint: 'https://otlp-collector.example.com',
    propagateHeaders: ['traceparent', 'uber-trace-id'],
    batchSize: 100,
    batchTimeout: 5000,
  },

  logging: {
    enabled: true,
    level: LogLevel.INFO,
    format: 'json',
    exporter: 'otlp',
    exporterEndpoint: 'https://logs-collector.example.com',
    correlationEnabled: true,
  },

  profiling: {
    enabled: true,
    interval: 1000,
    duration: 30000,
    maxSamples: 100000,
    exporter: 'otlp',
  },

  memory: {
    enabled: true,
    samplingInterval: 1000,
    heapSnapshotInterval: 60000,
    leakDetectionThreshold: 20,
  },

  inspection: {
    enabled: true,
    recordHeaders: true,
    recordBody: true,
    maxBodySize: 102400,
    maskSensitiveHeaders: ['authorization', 'cookie', 'set-cookie'],
  },

  recording: {
    enabled: true,
    maxSessionDuration: 300000,
    maxFramesPerSession: 10000,
    autoRecordOnError: true,
  },
};
```

## API Reference

See [API.md](./API.md) for detailed API documentation.

## Examples

See [examples/](./examples) directory for complete examples:

- [Basic Tracing](./examples/basic-tracing.ts)
- [Log Correlation](./examples/log-correlation.ts)
- [Performance Profiling](./examples/profiling.ts)
- [Memory Leak Detection](./examples/memory-leaks.ts)
- [HTTP Inspection](./examples/http-inspection.ts)
- [Debug Recording](./examples/debug-recording.ts)

## License

MIT
