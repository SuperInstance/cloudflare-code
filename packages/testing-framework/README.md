# ClaudeFlare Testing Framework

A comprehensive testing solution for ClaudeFlare applications that provides unified testing across multiple dimensions including unit, integration, end-to-end, performance, load, chaos engineering, and more.

## Features

- 🧪 **Unit Testing**: Jest-like assertions, mocking, and test structure
- 🔗 **Integration Testing**: Multi-service application testing with dependency injection
- 🌐 **End-to-End Testing**: Browser automation with Playwright support
- 🚀 **Performance Testing**: Benchmarking and profiling tools
- 💪 **Load Testing**: Scalable load testing for distributed systems
- ⚡ **Chaos Engineering**: Fault injection and resilience testing
- 📋 **Contract Testing**: Service interaction validation
- 👁️ **Visual Regression Testing**: UI consistency checking
- 🔒 **Security Testing**: Vulnerability scanning and validation
- 📊 **Coverage Reporting**: Multi-format code coverage analysis
- 👀 **Watch Mode**: Development-time test watching
- 🔧 **CI/CD Integration**: GitHub Actions, GitLab CI, and more
- 🏗️ **Plugin Architecture**: Extensible test types and reporters
- 📈 **Analytics Dashboard**: Real-time test analytics and visualization

## Installation

```bash
npm install @claudeflare/testing-framework
```

## Quick Start

### Basic Unit Test

```typescript
import { describe, test, expect } from '@claudeflare/testing-framework/unit';

describe('Math Operations', () => {
  test('should correctly add numbers', () => {
    const result = 2 + 2;
    expect(result).toBe(4);
  });

  test('should correctly multiply numbers', () => {
    expect(3 * 4).toBe(12);
  });
});
```

### Integration Test Example

```typescript
import { describe, test, createIntegrationTestRunner } from '@claudeflare/testing-framework/integration';
import { createServiceTest } from '@claudeflare/testing-framework/integration';

describe('API Service Integration', () => {
  const testRunner = createIntegrationTestRunner({
    pattern: ['**/*.integration.ts'],
    testDir: ['integration']
  });

  const apiService = createServiceTest({
    name: 'api-service',
    type: 'http',
    endpoint: 'http://localhost:3000',
    config: { timeout: 5000 },
    healthCheck: {
      endpoint: 'http://localhost:3000/health',
      expectedStatus: 200
    }
  });

  testRunner.addServiceTest(apiService);

  test('should validate service health', async () => {
    const results = await testRunner.runHealthChecks();
    expect(results.every(r => r.status === 'pass')).toBe(true);
  });

  test('should run integration scenarios', async () => {
    const scenario = createScenario('User Flow', async (services) => {
      // Test user registration and login flow
    });

    testRunner.addScenario(scenario);
    const results = await testRunner.runScenarios();
    expect(results.every(r => r.status === 'pass')).toBe(true);
  });
});
```

### End-to-End Testing

```typescript
import { describe, test, createE2ETestRunner } from '@claudeflare/testing-framework/e2e';
import { BrowserManager, Page } from '@claudeflare/testing-framework/e2e';

describe('Login E2E Test', () => {
  test('should allow user to login', async () => {
    const browser = new BrowserManager();
    await browser.launch({ headless: false });

    const page = await browser.newPage();
    await page.goto('https://app.example.com/login');

    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('/dashboard');
    expect(page.url()).toContain('/dashboard');

    await browser.close();
  });
});
```

## Configuration

### Basic Configuration

```typescript
import { createTestRunner } from '@claudeflare/testing-framework';

const config = {
  pattern: ['**/*.test.{ts,js}'],
  testDir: ['test'],
  maxParallel: 4,
  coverage: {
    enabled: true,
    outputDir: 'coverage',
    reporters: ['html', 'lcov', 'text']
  },
  reporters: [
    { type: 'console' },
    { type: 'json', output: 'test-results.json' },
    { type: 'html', output: 'test-report.html' }
  ]
};

const testRunner = createTestRunner(config);
```

### Advanced Configuration

```typescript
const advancedConfig = {
  // Test patterns
  pattern: [
    '**/*.test.{ts,js}',
    '**/*.spec.{ts,js}'
  ],

  // Directories
  testDir: ['test', 'tests'],
  ignore: ['node_modules', 'dist'],

  // Parallel execution
  maxParallel: 8,
  maxSuitesParallel: 4,

  // Coverage configuration
  coverage: {
    enabled: true,
    outputDir: 'coverage',
    reporters: ['html', 'lcov', 'text', 'json'],
    exclude: [
      '**/node_modules/**',
      '**/*.d.ts',
      '**/*.config.*'
    ],
    threshold: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    }
  },

  // Performance testing
  performance: {
    enabled: true,
    metrics: ['time', 'memory', 'cpu'],
    threshold: {
      time: 5000,
      memory: 100 * 1024 * 1024 // 100MB
    }
  },

  // Chaos engineering
  chaos: {
    enabled: true,
    rate: 0.1,
    experiments: [
      {
        name: 'latency',
        type: 'latency',
        rate: 0.05,
        config: { min: 100, max: 1000 }
      }
    ]
  },

  // Environment support
  environments: [
    {
      name: 'local',
      variables: { API_URL: 'http://localhost:3000' }
    },
    {
      name: 'staging',
      variables: { API_URL: 'https://staging.example.com' }
    },
    {
      name: 'production',
      variables: { API_URL: 'https://app.example.com' }
    }
  ],

  // CI/CD integration
  cicd: {
    enabled: true,
    provider: 'github',
    config: {
      artifacts: ['test-results/**', 'coverage/**']
    }
  },

  // Plugin configuration
  plugins: [
    {
      name: 'custom-reporter',
      enabled: true,
      config: { outputFormat: 'custom' }
    }
  ]
};
```

## Test Organization

### Unit Tests

```typescript
// math.test.ts
import { describe, test, expect } from '@claudeflare/testing-framework/unit';

describe('Math Utils', () => {
  test('should add two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  test('should handle negative numbers', () => {
    expect(add(-1, 5)).toBe(4);
  });
});
```

### Integration Tests

```typescript
// user-api.integration.ts
import { describe, test, createServiceTest, assertIntegration } from '@claudeflare/testing-framework/integration';

const userService = createServiceTest({
  name: 'user-service',
  type: 'http',
  endpoint: 'http://localhost:3001',
  config: { timeout: 5000 }
});

const databaseService = createServiceTest({
  name: 'database',
  type: 'database',
  endpoint: 'postgresql://localhost:5432/myapp'
});

describe('User API Integration', () => {
  test('should create user', async () => {
    const services = new Map([
      ['user-service', userService],
      ['database', databaseService]
    ]);

    const response = await fetch('http://localhost:3001/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com'
      })
    });

    assertIntegration(response).toHaveStatus(201);
    assertIntegration(response).toHaveJsonBody('id');
    assertIntegration(response).toHaveJsonBody('email', 'john@example.com');
  });
});
```

### End-to-End Tests

```typescript
// login.spec.ts
import { test, Page, Browser, BrowserManager } from '@claudeflare/testing-framework/e2e';

test('should login successfully', async () => {
  const browser = new BrowserManager();
  await browser.launch({ headless: true });

  const page = await browser.newPage();
  await page.goto('https://app.example.com');

  // Navigate to login page
  await page.click('#login-btn');

  // Fill form
  await page.fill('#email-input', 'test@example.com');
  await page.fill('#password-input', 'password123');

  // Submit
  await page.click('#submit-btn');

  // Verify redirect to dashboard
  await page.waitForSelector('#dashboard');
  expect(page.url()).toContain('/dashboard');

  await browser.close();
});
```

## Mocking and Spies

### Creating Mocks

```typescript
import { mock, spyOn, jest } from '@claudeflare/testing-framework/unit';

// Create mock function
const mockFn = mock.fn(() => 'mocked value');
expect(mockFn()).toBe('mocked value');

// Track calls
mockFn('arg1', 'arg2');
expect(mockFn.mock.callCount).toBe(1);
expect(mockFn.mock.calls[0]).toEqual(['arg1', 'arg2']);

// Implement mock
mockFn.mockImplementation((arg: string) => `processed: ${arg}`);
expect(mockFn('hello')).toBe('processed: hello');

// Promise mocking
mockFn.mockImplementation(() => Promise.resolve('async result'));
await expect(mockFn()).resolves.toBe('async result');
```

### Spying on Methods

```typescript
const calculator = {
  add: (a: number, b: number) => a + b,
  multiply: (a: number, b: number) => a * b
};

const spyAdd = spyOn(calculator, 'add');
const result = calculator.add(2, 3);

expect(spyAdd).toHaveBeenCalled();
expect(spyAdd).toHaveBeenCalledWith(2, 3);
expect(result).toBe(5);
```

## Performance Testing

### Basic Benchmark

```typescript
import { benchmark } from '@claudeflare/testing-framework/unit';

test('should benchmark performance', async () => {
  const results = await benchmark(() => {
    // Code to benchmark
    let sum = 0;
    for (let i = 0; i < 100000; i++) {
      sum += i;
    }
    return sum;
  }, { iterations: 100, warmup: 10 });

  console.log(`Average: ${results.average}ms`);
  console.log(`95th percentile: ${results.p95}ms`);
  console.log(`99th percentile: ${results.p99}ms`);
});
```

### Load Testing

```typescript
import { createLoadTest } from '@claudeflare/testing-framework/integration';

const loadTest = createLoadTest({
  name: 'api-load-test',
  target: 'http://localhost:3000/api/users',
  method: 'GET',
  concurrentUsers: 100,
  duration: 300, // seconds
  rampUp: 30 // seconds to ramp up
});

const results = await loadTest.run();
console.log(`Requests per second: ${results.rps}`);
console.log(`Error rate: ${results.errorRate}%`);
```

## Chaos Engineering

### Fault Injection

```typescript
import { createChaosEngine, ChaosExperiment } from '@claudeflare/testing-framework/chaos';

const chaosEngine = createChaosEngine({
  enabled: true,
  rate: 0.1, // 10% of requests
  experiments: [
    new ChaosExperiment({
      name: 'latency-spike',
      type: 'latency',
      rate: 0.05,
      config: { min: 1000, max: 5000 }
    }),
    new ChaosExperiment({
      name: 'random-errors',
      type: 'error',
      rate: 0.02,
      config: { statusCode: 500 }
    })
  ]
});

// Enable chaos during tests
await chaosEngine.start();
// Run tests
await chaosEngine.stop();
```

## Code Coverage

### Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts'
      ]
    }
  }
});
```

### Generating Coverage

```typescript
import { createCoverageCollector } from '@claudeflare/testing-framework/coverage';

const coverage = createCoverageCollector({
  enabled: true,
  outputDir: 'coverage',
  reporters: ['html', 'lcov', 'text']
});

await coverage.start();
// Run tests
const report = await coverage.generate();
console.log(`Coverage: ${report.stats.statements}%`);
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run tests
      run: npm run test:all

    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: unit, integration, e2e
        name: codecov-umbrella

    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-results
        path: test-results/
```

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - test
  - coverage
  - deploy

unit-tests:
  stage: test
  script:
    - npm run test:unit
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      junit: test-results/unit.xml
    paths:
      - coverage/

integration-tests:
  stage: test
  script:
    - npm run test:integration
  artifacts:
    reports:
      junit: test-results/integration.xml
    paths:
      - test-results/

performance-tests:
  stage: test
  script:
    - npm run test:performance
  artifacts:
    paths:
      - performance-results/
    reports:
      performance: performance-results/performance.json

e2e-tests:
  stage: test
  script:
    - npm run test:e2e
  artifacts:
    paths:
      - test-results/e2e/
    reports:
      junit: test-results/e2e.xml

deploy-staging:
  stage: deploy
  script:
    - npm run deploy:staging
  only:
    - main
  when: manual

deploy-production:
  stage: deploy
  script:
    - npm run deploy:production
  only:
    - main
  when: manual
```

## Watch Mode

### Development Configuration

```typescript
import { createTestRunner } from '@claudeflare/testing-framework';

const testRunner = createTestRunner({
  pattern: ['**/*.test.{ts,js}', '**/*.spec.{ts,js}'],
  testDir: ['test', 'src'],
  watch: {
    enabled: true,
    patterns: ['**/*.{ts,js}', '**/*.{json,md}'],
    interval: 1000,
    ignore: ['node_modules', 'dist']
  }
});

// Run in watch mode
testRunner.watch();
```

## Plugins

### Creating Custom Plugins

```typescript
import { Plugin } from '@claudeflare/testing-framework/plugins';

class CustomReporterPlugin implements Plugin {
  name = 'custom-reporter';
  enabled = true;

  async init(config: any) {
    // Initialize plugin
  }

  async report(results: any) {
    // Generate custom report
    const report = this.generateCustomReport(results);
    await this.saveReport(report);
  }

  generateCustomReport(results: any) {
    // Custom report generation logic
    return {
      format: 'custom',
      data: results,
      timestamp: Date.now()
    };
  }

  async saveReport(report: any) {
    // Save report to file or database
    const fs = require('fs');
    fs.writeFileSync('custom-report.json', JSON.stringify(report, null, 2));
  }
}

// Register plugin
const plugin = new CustomReporterPlugin();
testRunner.registerPlugin(plugin);
```

## Best Practices

### Test Organization

1. **Separate Concerns**: Keep unit tests, integration tests, and E2E tests in separate directories
2. **Use Clear Naming**: Follow consistent naming conventions
3. **One Assertion per Test**: Each test should test one specific behavior
4. **Isolate Tests**: Ensure tests don't depend on each other

### Performance Considerations

1. **Parallel Execution**: Utilize parallel test execution for faster builds
2. **Smart Scheduling**: Use the adaptive scheduler for optimal performance
3. **Resource Management**: Clean up resources after each test
4. **Timeout Handling**: Set appropriate timeouts for tests

### Security

1. **Input Validation**: Test all user inputs
2. **Authentication**: Test login/logout flows
3. **Authorization**: Test permission controls
4. **Data Protection**: Test data encryption and secure storage

### Maintenance

1. **Regular Updates**: Keep dependencies and framework updated
2. **Code Review**: Review test changes alongside code changes
3. **Metrics**: Monitor test execution time and flakiness
4. **Documentation**: Keep test documentation up to date

## API Reference

### Core Classes

- `TestRunner`: Main test runner with scheduling and execution
- `TestCollector`: Discovers and collects test files
- `TestExecutor`: Executes tests in worker threads
- `TestScheduler`: Manages test execution scheduling

### Module Exports

- `@claudeflare/testing-framework/core`: Core framework components
- `@claudeflare/testing-framework/unit`: Unit testing utilities
- `@claudeflare/testing-framework/integration`: Integration testing
- `@claudeflare/testing-framework/e2e`: End-to-end testing
- `@claudeflare/testing-framework/performance`: Performance testing
- `@claudeflare/testing-framework/chaos`: Chaos engineering
- `@claudeflare/testing-framework/security`: Security testing
- `@claudeflare/testing-framework/dashboard`: Analytics dashboard

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for your changes
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Join our Discord community
- Check the documentation

---

Built with ❤️ for the ClaudeFlare ecosystem