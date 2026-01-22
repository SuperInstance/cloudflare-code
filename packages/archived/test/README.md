# ClaudeFlare E2E Test Infrastructure

Comprehensive end-to-end testing framework for Cloudflare Workers with Durable Objects, KV, R2, and AI provider integrations.

## Overview

This test infrastructure provides:

- **3000+ lines** of test infrastructure code
- **100+ E2E test cases** covering all features
- **DO lifecycle management** with isolated instances
- **Request/response recording** for debugging
- **Snapshot testing** for AI responses
- **Load testing** scenarios and benchmarks
- **Performance metrics** with percentiles
- **Test data generators** for realistic scenarios

## Installation

```bash
npm install
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run performance tests
npm run test:performance
```

## Architecture

### E2E Framework (`src/e2e/`)

- **setup.ts** - Global test configuration and utilities
- **framework.ts** - Core testing framework with recording and snapshot testing

### Test Fixtures (`src/fixtures/`)

- **kv-fixture.ts** - KV namespace isolation and seeding
- **r2-fixture.ts** - R2 bucket isolation and object management
- **d1-fixture.ts** - D1 database isolation with mock tables
- **do-fixture.ts** - Durable Object lifecycle management

### Test Helpers (`src/helpers/`)

- **do.ts** - DO test helpers with lifecycle testing
- **api.ts** - API test helpers with request/response recording

### Mocks (`src/mocks/`)

- **github.ts** - GitHub API mock responses
- **providers.ts** - AI provider mocks (Anthropic, OpenAI, Groq, Cerebras)

### Performance Testing (`src/performance/`)

- **benchmark.ts** - Benchmark, load test, and stress test utilities

### Data Generators (`src/generators/`)

- **data.ts** - Test data generators for various scenarios

## Test Coverage Areas

### Storage Operations
- KV put/get/delete/list with metadata
- R2 object upload/download/list
- D1 database queries and transactions

### Durable Objects
- Session DO lifecycle
- Director DO orchestration
- Planner DO task management
- Executor DO execution
- Agent Registry DO
- Vector DB DO operations

### API Routes
- Health check endpoint
- Status endpoint
- Chat completions
- Models listing
- Agent orchestration
- Error handling
- Rate limiting
- CORS

### AI Providers
- Anthropic Claude integration
- OpenAI GPT integration
- Groq LLaMA integration
- Cerebras integration
- Multi-provider routing
- Failover handling
- Streaming responses
- Token usage tracking

### Performance
- Throughput benchmarks
- Latency percentiles (p50, p95, p99)
- Load testing (sustained RPS)
- Stress testing (max concurrency)
- Memory usage tracking

### Data Generators
- String generators (random, email, URL, UUID)
- Number generators (integer, float, percentage)
- Date generators (date, ISO, ranges)
- Object generators (user, session, API request/response)
- Code generators (TypeScript, JavaScript, Python, JSON)
- Message generators (chat conversations)
- Test data generators (cache, rate limits, sessions, RAG, agents)

## Usage Examples

### Basic E2E Test

```typescript
import { createE2ETestSuite } from '@claudeflare/test';

createE2ETestSuite({
  name: 'My Feature Tests',
}).test('should work correctly', async () => {
  // Test implementation
});
```

### DO Lifecycle Testing

```typescript
import { buildDOTestSuite } from '@claudeflare/test';

buildDOTestSuite({
  namespace: 'MY_DO',
  instanceCount: 10,
  testOperations: ['create', 'read', 'update', 'delete', 'list'],
});
```

### API Testing

```typescript
import { createAPITestSuite, APIAssertions } from '@claudeflare/test';

const suite = createAPITestSuite({ app });
const result = await suite.get('/health');

APIAssertions.assertSuccess(result);
APIAssertions.assertStatus(result, 200);
```

### Performance Testing

```typescript
import { createBenchmarkSuite } from '@claudeflare/test';

const suite = createBenchmarkSuite();
const result = await suite.run({
  name: 'My Benchmark',
  fn: () => myFunction(),
  iterations: 1000,
});

console.log(`Average: ${result.avgTime}ms`);
console.log(`Throughput: ${result.throughput} ops/s`);
```

### Load Testing

```typescript
import { createLoadTester } from '@claudeflare/test';

const tester = createLoadTester();
const result = await tester.run({
  name: 'API Load Test',
  fn: () => fetch('https://api.example.com/health'),
  requestsPerSecond: 1000,
  duration: 10000,
  concurrency: 100,
});

console.log(`RPS: ${result.requestsPerSecond}`);
console.log(`P95 Latency: ${result.p95}ms`);
```

## Test Statistics

- **Total Lines**: 3000+
- **Test Files**: 10+
- **Test Cases**: 100+
- **Coverage Target**: 80%+

## Contributing

When adding new tests:

1. Use the test generators and helpers provided
2. Follow the existing test structure
3. Include both positive and negative test cases
4. Add performance benchmarks for critical paths
5. Document any new test utilities

## License

MIT
