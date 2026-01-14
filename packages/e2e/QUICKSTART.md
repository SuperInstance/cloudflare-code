# Quick Start Guide - ClaudeFlare E2E Testing

Get up and running with the ClaudeFlare E2E testing suite in 5 minutes.

## Prerequisites

- Node.js 20+
- npm 10+
- Git

## Installation

### 1. Install Dependencies

```bash
cd packages/e2e
npm install
```

### 2. Install Playwright Browsers

```bash
npm run install:browsers
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

Minimum required variables:
```bash
BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:8787
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
```

## Running Tests

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Specific Test Suite

```bash
# Authentication tests
npx playwright test tests/e2e/auth/

# Dashboard tests
npx playwright test tests/e2e/dashboard/

# Projects tests
npx playwright test tests/e2e/projects/
```

### Run on Specific Browser

```bash
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit
```

### Run in Debug Mode

```bash
npm run test:e2e:debug
```

### Run with UI

```bash
npm run test:e2e:ui
```

## Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run with watch mode
npm run test:integration:watch
```

## Contract Tests

```bash
# Run contract tests
npm run test:contract

# Publish contracts
npm run test:contract:publish
```

## Chaos Tests

```bash
# Run chaos engineering tests
npm run test:chaos

# Run with watch mode
npm run test:chaos:watch
```

## Quality Reports

### Generate Quality Dashboard

```bash
npm run test:quality:report
```

Open `reports/quality-dashboard.html` in your browser.

### Check Coverage

```bash
npm run quality:check
```

### Generate Coverage Report

```bash
npm run test:coverage -- --report
```

Open `reports/coverage-report.html` in your browser.

## View Test Results

### HTML Report

```bash
npm run report:show
```

### JSON Results

```bash
cat test-results/results.json
```

### JUnit Results

```bash
cat test-results/junit.xml
```

## Common Workflows

### 1. Run Tests Before Commit

```bash
npm run test:ci
```

### 2. Run Tests with Coverage

```bash
npm run test:coverage
```

### 3. Debug a Failing Test

```bash
npx playwright test tests/e2e/auth/login.spec.ts --debug
```

### 4. Run Specific Test

```bash
npx playwright test -g "should login with valid credentials"
```

### 5. Run Tests in Headed Mode

```bash
npx playwright test --headed
```

## Test Structure

```
tests/
├── e2e/              # Playwright E2E tests
├── integration/      # Integration tests
├── contract/         # Contract tests
└── chaos/           # Chaos engineering tests
```

## Writing Your First Test

Create a new file in `tests/e2e/`:

```typescript
import { test, expect } from '@playwright/test';
import { TestHelpers } from '../../utils/test-helpers';

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Login
    await helpers.login('test@example.com', 'password');

    // Navigate
    await helpers.navigateTo('/my-feature');

    // Assert
    await expect(page.locator('h1')).toContainText('My Feature');
  });
});
```

Run your new test:

```bash
npx playwright test tests/e2e/my-feature.spec.ts
```

## Troubleshooting

### Browser Not Found

```bash
npm run install:browsers
```

### Port Already in Use

Change the port in `.env`:
```bash
BASE_URL=http://localhost:3001
```

### Tests Timing Out

Increase timeout in `playwright.config.ts`:
```typescript
timeout: 120 * 1000, // 120 seconds
```

### Database Connection Issues

Ensure test database is running:
```bash
docker-compose up -d
```

## Tips

1. **Use data-testid attributes** for stable selectors
2. **Run tests locally** before pushing
3. **Check coverage** after adding new code
4. **Use test helpers** to reduce duplication
5. **Keep tests independent** and isolated

## Getting Help

- Documentation: `README.md`
- Test Examples: `tests/e2e/`
- Test Helpers: `utils/test-helpers.ts`
- Issues: [GitHub Issues](https://github.com/claudeflare/claudeflare/issues)

## Next Steps

1. Read the full documentation: `README.md`
2. Explore test examples
3. Customize configuration
4. Add your own tests
5. Set up CI/CD integration

Happy Testing! 🚀
