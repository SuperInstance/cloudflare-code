/**
 * Basic Usage Examples
 * Demonstrates fundamental observability features
 */

import {
  Tracer,
  MetricsCollector,
  StructuredLogger,
  LoggerFactory,
} from '../src';

// ============================================================================
// Tracing Example
// ============================================================================

async function tracingExample() {
  console.log('\n=== Distributed Tracing Example ===\n');

  const tracer = new Tracer({
    serviceName: 'my-service',
    serviceVersion: '1.0.0',
    environment: 'production',
    samplingRate: 1.0,
    exporter: 'console',
  });

  // Create a span for an operation
  const span = tracer.startSpan({
    name: 'process-payment',
    kind: 'server',
    attributes: {
      'user.id': 'user-123',
      'payment.amount': 99.99,
    },
  });

  // Add events to the span
  span.addEvent('validation-start', { step: 'validate-payment' });
  // ... perform validation
  span.addEvent('validation-complete', { valid: true });

  span.addEvent('processing-start', { step: 'process-payment' });
  // ... perform processing
  span.addEvent('processing-complete', { success: true });

  // End the span
  span.end();

  // Use async/await with automatic span management
  await tracer.withSpan(
    { name: 'handle-request', kind: 'server' },
    async (span) => {
      span.setAttribute('http.method', 'GET');
      span.setAttribute('http.path', '/api/users');

      // Nested span
      await tracer.withSpan(
        { name: 'query-database', kind: 'client' },
        async (dbSpan) => {
          dbSpan.setAttribute('db.system', 'postgresql');
          dbSpan.setAttribute('db.name', 'users');
          // ... query database
        }
      );
    }
  );

  // Inject trace context for outbound requests
  const headers = {};
  const requestSpan = tracer.startSpan({ name: 'outbound-call' });
  const traceHeaders = tracer.injectTraceContext(headers);
  console.log('Trace headers:', traceHeaders);
  requestSpan.end();

  await tracer.shutdown();
}

// ============================================================================
// Metrics Example
// ============================================================================

function metricsExample() {
  console.log('\n=== Metrics Collection Example ===\n');

  const metrics = new MetricsCollector('my-service');

  // Counter metrics
  const requestCounter = metrics.counter({
    name: 'http_requests_total',
    description: 'Total number of HTTP requests',
  });

  requestCounter.increment(1, { method: 'GET', status: '200' });
  requestCounter.increment(1, { method: 'POST', status: '201' });
  requestCounter.increment(1, { method: 'GET', status: '404' });

  console.log('Total requests:', requestCounter.getValue());
  console.log('GET rate:', requestCounter.getRate(undefined, 60000), 'req/s');

  // Gauge metrics
  const activeConnections = metrics.gauge({
    name: 'http_active_connections',
    description: 'Number of active HTTP connections',
  });

  activeConnections.set(50);
  console.log('Active connections:', activeConnections.getValue());

  // Histogram metrics
  const requestDuration = metrics.histogram({
    name: 'http_request_duration_ms',
    description: 'HTTP request duration in milliseconds',
    buckets: [10, 50, 100, 500, 1000, 5000],
  });

  // Record some request durations
  for (let i = 0; i < 100; i++) {
    const duration = Math.random() * 1000;
    requestDuration.record(duration);
  }

  const percentiles = requestDuration.getPercentiles();
  console.log('Request duration percentiles:', percentiles);
  console.log('Average:', requestDuration.getAverage());

  // Export metrics
  metrics.export({ format: 'prometheus' })
    .then(result => {
      console.log('Export result:', result);
    });
}

// ============================================================================
// Logging Example
// ============================================================================

function loggingExample() {
  console.log('\n=== Structured Logging Example ===\n');

  const logger = LoggerFactory.create('my-service', {
    level: 'info',
    format: 'json',
    redaction: {
      enabled: true,
      fields: ['password', 'secret'],
    },
  });

  // Basic logging
  logger.trace('Trace message');
  logger.debug('Debug message');
  logger.info('Info message');
  logger.warn('Warning message');

  // Error logging
  try {
    throw new Error('Something went wrong');
  } catch (error) {
    logger.error('Operation failed', error, {
      operation: 'process-payment',
      userId: 'user-123',
    });
  }

  // Contextual logging
  logger.setTraceContext('trace-123', 'span-456');
  logger.info('Request processed', { userId: 'user-123', duration: 150 });

  // Child logger with inherited context
  const childLogger = logger.child({ requestId: 'req-789' });
  childLogger.info('Child logger message');

  // Create child logger with additional metadata
  const requestLogger = logger.child('request-processor', {
    endpoint: '/api/users',
  });
  requestLogger.info('Processing user request');

  // View log entries
  const entries = logger.getEntries();
  console.log('Total log entries:', entries.length);

  // Search logs
  const errorLogs = logger.search('error', 10);
  console.log('Error logs found:', errorLogs.length);
}

// ============================================================================
// Combined Example
// ============================================================================

async function combinedExample() {
  console.log('\n=== Combined Observability Example ===\n');

  const tracer = new Tracer({
    serviceName: 'api-service',
    exporter: 'console',
  });

  const metrics = new MetricsCollector('api-service');
  const logger = LoggerFactory.create('api-service', { level: 'info' });

  // Track an API request
  await tracer.withSpan(
    { name: 'handle-api-request', kind: 'server' },
    async (span) => {
      const traceId = span.getContext().traceId;
      logger.setTraceContext(traceId);

      logger.info('API request received');

      const startTime = Date.now();

      try {
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 100));

        // Record metrics
        metrics.counter({ name: 'api_requests_total' }).increment(1);
        metrics.histogram({ name: 'api_request_duration_ms' }).record(Date.now() - startTime);

        logger.info('API request completed');
        span.setStatus(0); // OK
      } catch (error) {
        span.recordException(error as Error);
        logger.error('API request failed', error as Error);
        span.setStatus(2); // Error
      }
    }
  );

  await tracer.shutdown();
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  try {
    await tracingExample();
    metricsExample();
    loggingExample();
    await combinedExample();
  } catch (error) {
    console.error('Example failed:', error);
  }
}

if (require.main === module) {
  main();
}

export {
  tracingExample,
  metricsExample,
  loggingExample,
  combinedExample,
};
