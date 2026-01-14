/**
 * Test Setup
 */

import { vi } from 'vitest';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// Mock process.cwd
vi.stubGlobal('process', {
  ...process,
  cwd: () => '/tmp/test-project',
});

// Setup test environment
beforeEach(() => {
  vi.clearAllMocks();
});
