/**
 * Test Setup File
 */

import { beforeAll, afterEach, vi } from 'vitest';

// Mock environment
global.process = {
  ...process,
  env: {
    NODE_ENV: 'test',
  },
} as NodeJS.Process;

// Setup mocks
beforeAll(() => {
  // Initialize test environment
});

afterEach(() => {
  vi.clearAllMocks();
});
