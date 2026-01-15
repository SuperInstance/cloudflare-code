/**
 * Test Setup File
 * Global test configuration and fixtures
 */

import { vi, afterEach } from 'vitest';

// Mock Cloudflare Workers environment
global.Request = Request as any;
global.Response = Response as any;
global.fetch = fetch as any;

// Mock environment variables
(process.env as any)['CLOUDFLARE_ACCOUNT_ID'] = 'test-account-id';
(process.env as any)['ENVIRONMENT'] = 'test';

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
});
