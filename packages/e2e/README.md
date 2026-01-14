# ClaudeFlare E2E Testing Suite

Comprehensive end-to-end testing and quality assurance for the ClaudeFlare platform.

## Overview

This package provides a complete testing infrastructure including:
- 200+ E2E tests with Playwright
- 100+ integration tests
- 50+ contract tests with Pact
- 20+ chaos engineering scenarios
- Quality metrics dashboard
- 90%+ test coverage target

## Test Structure

```
packages/e2e/
├── tests/
│   ├── e2e/                 # Playwright E2E tests
│   │   ├── auth/           # Authentication flows
│   │   ├── dashboard/      # Dashboard navigation
│   │   ├── projects/       # Project CRUD operations
│   │   ├── chat/          # Chat workflows
│   │   ├── code/          # Code generation
│   │   ├── api/           # API endpoint tests
│   │   ├── visual/        # Visual regression tests
│   │   └── performance/   # Performance tests
│   ├── integration/        # Integration tests
│   │   ├── api/           # API integration tests
│   │   ├── database/      # Database integration tests
│   │   ├── workers/       # Durable Objects tests
│   │   ├── websockets/    # WebSocket tests
│   │   └── routing/       # Provider routing tests
│   ├── contract/          # Contract tests
│   │   └── chat-provider-contract.spec.ts
│   └── chaos/             # Chaos engineering tests
│       ├── providers/     # Provider failure scenarios
│       ├── network/       # Network failure tests
│       ├── database/      # Database failure tests
│       └── resilience/    # Resilience tests
├── scripts/               # Utility scripts
│   ├── quality.ts        # Quality metrics analysis
│   └── test-coverage.ts  # Coverage analysis
├── utils/                # Test helpers
│   ├── test-helpers.ts   # Common test utilities
│   ├── global-setup.ts   # Global test setup
│   └── global-teardown.ts # Global test teardown
└── config/              # Test configurations
    ├── vitest.integration.config.ts
    ├── vitest.chaos.config.ts
    └── jest.contract.config.js
```

## Installation

```bash
npm install
npm run install:browsers
```

## Running Tests

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific browser
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit

# Run with UI
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug

# Run mobile tests
npm run test:e2e:mobile
```

### Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run with watch mode
npm run test:integration:watch
```

### Contract Tests

```bash
# Run contract tests
npm run test:contract

# Publish contracts
npm run test:contract:publish
```

### Chaos Tests

```bash
# Run chaos engineering tests
npm run test:chaos

# Run with watch mode
npm run test:chaos:watch
```

### All Tests

```bash
# Run complete test suite
npm run test:all

# Run with coverage
npm run test:coverage

# Run CI pipeline
npm run test:ci
```

## Quality Metrics

### Generate Quality Dashboard

```bash
npm run test:quality:report
```

This generates an interactive HTML dashboard at `reports/quality-dashboard.html` with:
- Overall quality score
- Test metrics (pass rate, flaky tests, duration)
- Coverage metrics (statements, branches, functions, lines)
- Performance metrics (response times, throughput, error rate)
- Security metrics (vulnerabilities, security score)
- Actionable recommendations

### Check Coverage

```bash
npm run quality:check
```

Enforces 90% coverage threshold across all metrics.

## Test Categories

### E2E Tests (200+ tests)

#### Authentication (50+ tests)
- Login flows
- Registration flows
- Password reset
- OAuth integration
- Session management
- Security measures

#### Dashboard (40+ tests)
- Navigation
- Layout and responsive design
- Stats cards
- Recent activity
- Quick actions

#### Projects (60+ tests)
- Project CRUD operations
- File management
- Collaboration features
- Batch operations
- Search and filtering

#### Chat (30+ tests)
- Message sending
- Streaming responses
- Conversation history
- Model selection
- Code generation
- File upload

#### API (20+ tests)
- Endpoint testing
- Error handling
- Rate limiting
- Performance

#### Visual (10+ tests)
- Cross-browser testing
- Responsive design
- Dark mode
- Component screenshots

### Integration Tests (100+ tests)

#### API Integration (30+ tests)
- Chat API endpoints
- WebSocket communication
- Session management
- File upload
- Streaming responses

#### Database Integration (25+ tests)
- Database operations
- Transactions
- Migrations
- Data integrity
- Performance

#### Worker Integration (20+ tests)
- Durable Objects
- Worker-to-DO communication
- State management
- Event handling

#### WebSocket Integration (15+ tests)
- Connection management
- Message routing
- Broadcasting
- Error handling

#### Routing Integration (10+ tests)
- Provider selection
- Failover logic
- Load balancing
- Circuit breaker

### Contract Tests (50+ tests)

#### Provider Contracts (30+ tests)
- OpenAI API contracts
- Anthropic API contracts
- Cohere API contracts
- Streaming contracts
- Error response contracts

#### Internal API Contracts (20+ tests)
- Code generation contracts
- Routing contracts
- Storage contracts
- Webhook contracts

### Chaos Tests (20+ scenarios)

#### Provider Failures (8 scenarios)
- Primary provider failure
- Provider timeout
- Provider outage
- Response degradation
- Rate limiting
- Circuit breaker
- Cascading failures
- Recovery scenarios

#### Network Failures (5 scenarios)
- Network latency
- Packet loss
- Connection drops
- DNS failures
- Partial failures

#### Database Failures (4 scenarios)
- Connection pool exhaustion
- Query timeouts
- Transaction failures
- Replica lag

#### Resilience Tests (3 scenarios)
- Concurrent request handling
- Memory pressure
- CPU saturation

## Quality Gates

The following quality gates are enforced:

### Test Coverage
- Statements: ≥90%
- Branches: ≥85%
- Functions: ≥90%
- Lines: ≥90%

### Quality Metrics
- Overall Score: ≥70/100
- Test Pass Rate: ≥95%
- Security Score: ≥80/100
- Performance: P95 < 1000ms

### Code Quality
- Cyclomatic Complexity: <10
- Code Duplication: <5%
- Maintainability Index: >70

## CI/CD Integration

The test suite integrates with GitHub Actions:

### E2E Test Workflow
- Runs on every push and PR
- Tests across multiple browsers
- Parallel execution with sharding
- Uploads test reports and artifacts
- Generates quality dashboard

### Quality Gate Workflow
- Runs on every PR
- Type checking
- Linting
- Unit tests with coverage
- Security audit
- Bundle size check
- Dependency review

## Configuration

### Environment Variables

```bash
# Required
BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:8787
WS_BASE_URL=ws://localhost:8787
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword

# Optional
TEST_ENV=development
PACT_BROKER_BASE_URL=https://pact-broker.example.com
PACT_BROKER_TOKEN=your-token
```

### Playwright Configuration

Edit `playwright.config.ts` to customize:
- Browser versions
- Viewport sizes
- Timeouts
- Parallel execution
- Reporting options

## Test Helpers

### TestHelpers Class

```typescript
import { TestHelpers } from '@utils/test-helpers';

const helpers = new TestHelpers(page);

// Navigation
await helpers.navigateTo('/dashboard');

// Forms
await helpers.fillForm('#login-form', { email, password });

// Assertions
await helpers.waitForVisible('[data-testid="user-menu"]');
```

### TestDataGenerator Class

```typescript
import { TestDataGenerator } from '@utils/test-helpers';

const email = TestDataGenerator.email();
const password = TestDataGenerator.password();
const projectName = TestDataGenerator.projectName();
```

### TestApiClient Class

```typescript
import { TestApiClient } from '@utils/test-helpers';

const client = new TestApiClient(baseUrl, token);
const response = await client.get('/api/projects');
```

## Debugging

### Debug E2E Tests

```bash
# Run with Playwright Inspector
npm run test:e2e:debug

# Run with headed mode
npm run test:e2e:headed

# Run specific test file
npx playwright test tests/e2e/auth/login.spec.ts --debug
```

### Debug Integration Tests

```bash
# Run with watch mode
npm run test:integration:watch

# Run specific test file
npm run test:integration -- api/chat-api.spec.ts
```

## Reports

### Test Reports

- HTML Report: `playwright-report/index.html`
- JSON Report: `test-results/results.json`
- JUnit Report: `test-results/junit.xml`

### Coverage Reports

- HTML Report: `coverage/index.html`
- Summary: `coverage/coverage-summary.json`

### Quality Dashboard

- HTML Dashboard: `reports/quality-dashboard.html`
- Coverage Report: `reports/coverage-report.html`

## Best Practices

1. **Use data-testid attributes** for test selectors
2. **Wait for network idle** before assertions
3. **Use test helpers** to reduce code duplication
4. **Generate test data** with TestDataGenerator
5. **Mock external services** in integration tests
6. **Clean up test data** after each test
7. **Use descriptive test names**
8. **Group related tests** with describe blocks
9. **Use beforeAll/afterAll** for expensive setup
10. **Keep tests independent** and isolated

## Contributing

When adding new tests:

1. Place tests in appropriate directory
2. Follow existing test patterns
3. Use helper functions where possible
4. Add data-testid attributes to UI components
5. Update test documentation
6. Ensure coverage thresholds are met
7. Run tests locally before committing

## License

MIT

## Support

For issues or questions:
- GitHub Issues: [claudeflare/issues](https://github.com/claudeflare/claudeflare/issues)
- Documentation: [docs.claudeflare.dev](https://docs.claudeflare.dev)
