/**
 * Basic distributed tracing example
 */

import { DistributedTracer, SpanKind } from '@claudeflare/observability';

async function main() {
  const tracer = new DistributedTracer('example-service');

  // Start a root span for the request
  const { span: rootSpan, context: rootContext } = tracer.startSpan('handle-request', {
    kind: SpanKind.SERVER,
    attributes: {
      'http.method': 'GET',
      'http.url': '/api/users/123',
    },
  });

  try {
    // Simulate database query
    const { span: dbSpan } = tracer.startSpan('database-query', {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.system': 'postgresql',
        'db.name': 'users_db',
        'db.statement': 'SELECT * FROM users WHERE id = $1',
      },
    });

    await simulateDatabaseQuery();

    dbSpan.end();

    // Simulate cache operation
    const { span: cacheSpan } = tracer.startSpan('cache-get', {
      kind: SpanKind.CLIENT,
      attributes: {
        'cache.system': 'redis',
        'cache.key': 'user:123',
      },
    });

    await simulateCacheOperation();

    cacheSpan.end();

    // Simulate external API call
    const { span: apiSpan } = tracer.startSpan('external-api-call', {
      kind: SpanKind.CLIENT,
      attributes: {
        'http.method': 'GET',
        'http.url': 'https://api.example.com/profile/123',
      },
    });

    await simulateAPICall();

    apiSpan.end();

    // Record the spans
    tracer.recordSpan(rootContext.spanId, {
      name: 'handle-request',
      kind: SpanKind.SERVER,
      startTime: Date.now() - 1000,
      duration: 1000,
      status: 1,
      attributes: {
        'trace.id': rootContext.traceId,
        'span.id': rootContext.spanId,
      },
      events: [],
      links: [],
      resource: {
        serviceName: 'example-service',
        attributes: {},
      },
    });

    // Generate service map
    const serviceMap = tracer.generateServiceMap();
    console.log('Service Map:', JSON.stringify(serviceMap, null, 2));

  } catch (error) {
    rootSpan.setAttribute('error', true);
    throw error;
  } finally {
    rootSpan.end();
  }

  // Get trace statistics
  const stats = tracer.getTraceStatistics();
  console.log('Trace Statistics:', stats);
}

async function simulateDatabaseQuery(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50));
}

async function simulateCacheOperation(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

async function simulateAPICall(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));
}

main().catch(console.error);
